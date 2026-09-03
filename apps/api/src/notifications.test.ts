import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sendTransacEmail = vi.fn().mockResolvedValue({ messageId: "msg_1" });
let lastConstructedOptions: any;

vi.mock("@getbrevo/brevo", () => ({
  BrevoClient: vi.fn().mockImplementation((options: any) => {
    lastConstructedOptions = options;
    return { transactionalEmails: { sendTransacEmail } };
  }),
}));

const { NotificationService } = await import("./notifications.js");

function fakeDb() {
  return {
    insert: () => ({ values: async () => undefined }),
    select: () => ({ from: () => ({ where: async () => [] }) }),
  };
}

let svc: InstanceType<typeof NotificationService>;

beforeEach(() => {
  sendTransacEmail.mockClear();
  svc = new NotificationService(fakeDb() as any);
  delete process.env.BREVO_API_KEY;
  delete process.env.BREVO_FROM_EMAIL;
  delete process.env.BREVO_FROM_NAME;
});
afterEach(() => {
  delete process.env.BREVO_API_KEY;
  delete process.env.BREVO_FROM_EMAIL;
  delete process.env.BREVO_FROM_NAME;
});

describe("NotificationService.email()", () => {
  it("is a no-op when BREVO_API_KEY is unset (preserves the previous optional Resend behavior)", async () => {
    await svc.email("to@example.com", "Subject", "<p>hi</p>");
    expect(sendTransacEmail).not.toHaveBeenCalled();
  });

  it("throws if BREVO_API_KEY is set but BREVO_FROM_EMAIL is not - sender must be configured before attempting an email", async () => {
    process.env.BREVO_API_KEY = "fake-key";
    await expect(svc.email("to@example.com", "Subject", "<p>hi</p>")).rejects.toThrow(/BREVO_FROM_EMAIL/);
    expect(sendTransacEmail).not.toHaveBeenCalled();
  });

  it("sends via the Brevo transactional email API with the configured sender when fully configured", async () => {
    process.env.BREVO_API_KEY = "fake-key";
    process.env.BREVO_FROM_EMAIL = "notifications@example.com";
    process.env.BREVO_FROM_NAME = "PRAEST";

    await svc.email("to@example.com", "Subject", "<p>hi</p>");

    expect(lastConstructedOptions.apiKey).toBe("fake-key");
    expect(sendTransacEmail).toHaveBeenCalledTimes(1);
    const req = sendTransacEmail.mock.calls[0]![0];
    expect(req.subject).toBe("Subject");
    expect(req.htmlContent).toBe("<p>hi</p>");
    expect(req.sender).toEqual({ email: "notifications@example.com", name: "PRAEST" });
    expect(req.to).toEqual([{ email: "to@example.com" }]);
  });
});
