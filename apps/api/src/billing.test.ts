import { afterEach, beforeEach, describe, expect, it } from "vitest";
import Stripe from "stripe";
import { BillingDisabledError, BillingService, stripeEnabled } from "./billing.js";

process.env.STRIPE_SECRET_KEY = "sk_test_fake_for_unit_tests";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_fake_secret";
process.env.STRIPE_PRICE_STARTER = "price_starter_test";
process.env.STRIPE_PRICE_PRO = "price_pro_test";
// The rest of this file exercises Stripe *enabled* (regression coverage per TEST C); the dedicated
// "Stripe disabled" describe block below flips this off for its own tests and restores it after.
process.env.STRIPE_ENABLED = "true";

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET!;

function fakeDb(initialAccount: any) {
  const account = { ...initialAccount };
  const subscriptionUpserts: any[] = [];
  const accountUpdates: any[] = [];
  const db = {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => (account ? [account] : []),
        }),
      }),
    }),
    insert: () => ({
      values: (v: any) => ({
        onConflictDoUpdate: async ({ set }: any) => {
          subscriptionUpserts.push(v);
          Object.assign(v, set); // mimic "insert...on conflict update" ending state
          return [v];
        },
        returning: async () => [v],
      }),
    }),
    update: () => ({
      set: (v: any) => ({
        where: async () => {
          Object.assign(account, v);
          accountUpdates.push({ ...account });
          return [account];
        },
      }),
    }),
  };
  return { db, account, subscriptionUpserts, accountUpdates };
}

function subscriptionEvent(overrides: Partial<Stripe.Subscription> & { current_period_end?: number } = {}) {
  const periodEnd = overrides.current_period_end ?? Math.floor(Date.now() / 1000) + 30 * 24 * 3600;
  const sub: any = {
    id: "sub_test_1",
    object: "subscription",
    customer: "cus_test_1",
    status: overrides.status ?? "active",
    items: {
      object: "list",
      data: [{ id: "si_1", object: "subscription_item", price: { id: process.env.STRIPE_PRICE_PRO }, current_period_end: periodEnd, current_period_start: periodEnd - 30 * 24 * 3600 }],
    },
    ...overrides,
  };
  const event = { id: "evt_test_1", object: "event", type: "customer.subscription.updated", data: { object: sub }, api_version: "2026-08-26.dahlia", created: Math.floor(Date.now() / 1000) };
  const payload = JSON.stringify(event);
  const signature = Stripe.webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET });
  return { payload, signature, sub, event };
}

let svc: BillingService;
let dbh: ReturnType<typeof fakeDb>;

beforeEach(() => {
  dbh = fakeDb({ id: "ba_1", organizationId: "org_1", stripeCustomerId: "cus_test_1", plan: "starter", status: "inactive" });
  svc = new BillingService(dbh.db as any);
});

describe("webhook signature verification", () => {
  it("processes an event with a valid test-mode signature", async () => {
    const { payload, signature } = subscriptionEvent();
    const result = await svc.webhook(Buffer.from(payload), signature);
    expect(result.received).toBe(true);
    expect(result.type).toBe("customer.subscription.updated");
  });

  it("rejects a payload with an invalid/tampered signature", async () => {
    const { payload, signature } = subscriptionEvent();
    const tampered = payload.replace("cus_test_1", "cus_attacker");
    await expect(svc.webhook(Buffer.from(tampered), signature)).rejects.toThrow();
  });

  it("rejects a payload signed with the wrong secret", async () => {
    const { payload } = subscriptionEvent();
    const wrongSignature = Stripe.webhooks.generateTestHeaderString({ payload, secret: "whsec_wrong_secret" });
    await expect(svc.webhook(Buffer.from(payload), wrongSignature)).rejects.toThrow();
  });
});

describe("successful subscription normalization (current_period_end fix)", () => {
  it("reads current_period_end from the subscription item, not the subscription itself", async () => {
    const periodEnd = Math.floor(Date.now() / 1000) + 86400;
    const { payload, signature } = subscriptionEvent({ current_period_end: periodEnd });
    await svc.webhook(Buffer.from(payload), signature);
    expect(dbh.subscriptionUpserts[0].currentPeriodEnd.getTime()).toBe(periodEnd * 1000);
  });

  it("syncs billingAccounts.plan and .status (entitlement) from the subscription price/status", async () => {
    const { payload, signature } = subscriptionEvent({ status: "active" });
    await svc.webhook(Buffer.from(payload), signature);
    expect(dbh.account.plan).toBe("pro"); // items.data[0].price.id === STRIPE_PRICE_PRO
    expect(dbh.account.status).toBe("active");
  });
});

describe("failed/declined payment -> past_due propagation", () => {
  it("reflects a failed recurring payment's past_due status on the account", async () => {
    const { payload, signature } = subscriptionEvent({ status: "past_due" });
    await svc.webhook(Buffer.from(payload), signature);
    expect(dbh.account.status).toBe("past_due");
  });
});

describe("cancellation flow", () => {
  it("reflects subscription cancellation on the account", async () => {
    const { payload, signature } = subscriptionEvent({ status: "canceled" });
    await svc.webhook(Buffer.from(payload), signature);
    expect(dbh.account.status).toBe("canceled");
  });
});

describe("duplicate webhook / idempotency handling", () => {
  it("produces the same end state when the identical event is delivered twice", async () => {
    const { payload, signature } = subscriptionEvent({ status: "active" });
    await svc.webhook(Buffer.from(payload), signature);
    const { updatedAt: _first, ...afterFirst } = dbh.account;
    await svc.webhook(Buffer.from(payload), signature);
    const { updatedAt: _second, ...afterSecond } = dbh.account;
    expect(afterSecond).toEqual(afterFirst); // same plan/status/customer/etc. - only the update timestamp legitimately differs
    expect(dbh.subscriptionUpserts).toHaveLength(2); // both delivered and processed...
    expect(dbh.subscriptionUpserts[0]).toEqual(dbh.subscriptionUpserts[1]); // ...to an identical row (upsert-of-latest-state is naturally idempotent)
  });
});

describe("events outside customer.subscription.* are accepted but not processed", () => {
  it("acknowledges an unrelated event type without touching billing state", async () => {
    const event = { id: "evt_2", object: "event", type: "invoice.paid", data: { object: { id: "in_1" } }, api_version: "2026-08-26.dahlia", created: Math.floor(Date.now() / 1000) };
    const payload = JSON.stringify(event);
    const signature = Stripe.webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET });
    const result = await svc.webhook(Buffer.from(payload), signature);
    expect(result).toEqual({ received: true, type: "invoice.paid" });
    expect(dbh.accountUpdates).toHaveLength(0);
  });
});

describe("Stripe disabled (STRIPE_ENABLED != \"true\") - TEST B", () => {
  const savedFlag = process.env.STRIPE_ENABLED;
  const savedKeys = {
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
    STRIPE_PRICE_STARTER: process.env.STRIPE_PRICE_STARTER,
    STRIPE_PRICE_PRO: process.env.STRIPE_PRICE_PRO,
    STRIPE_METER_EVENT_NAME: process.env.STRIPE_METER_EVENT_NAME,
  };

  beforeEach(() => {
    process.env.STRIPE_ENABLED = "false";
    // Boot without any Stripe credentials at all - none of this should be needed while disabled.
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_WEBHOOK_SECRET;
    delete process.env.STRIPE_PRICE_STARTER;
    delete process.env.STRIPE_PRICE_PRO;
    delete process.env.STRIPE_METER_EVENT_NAME;
  });
  afterEach(() => {
    process.env.STRIPE_ENABLED = savedFlag;
    Object.assign(process.env, savedKeys);
  });

  it("reports disabled without requiring any Stripe credentials", () => {
    expect(stripeEnabled()).toBe(false);
  });

  it("checkout() fails cleanly with BillingDisabledError, never constructing a Stripe client", async () => {
    await expect(svc.checkout("org_1", "a@example.com", "starter")).rejects.toBeInstanceOf(BillingDisabledError);
  });

  it("portal() fails cleanly with BillingDisabledError", async () => {
    await expect(svc.portal("org_1")).rejects.toBeInstanceOf(BillingDisabledError);
  });

  it("usage() fails cleanly with BillingDisabledError before touching the meter API", async () => {
    await expect(svc.usage("org_1", "job.run", 1n, "idem-1")).rejects.toBeInstanceOf(BillingDisabledError);
  });

  it("webhook() short-circuits without requiring STRIPE_WEBHOOK_SECRET or verifying a signature", async () => {
    const result = await svc.webhook(Buffer.from("{}"), "not-a-real-signature");
    expect(result).toEqual({ received: false, reason: "stripe_disabled" });
  });
});
