import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const processHTTPRequest = vi.fn();
const processSettlement = vi.fn();
const initialize = vi.fn().mockResolvedValue(undefined);

vi.mock("@x402/core/server", () => ({
  HTTPFacilitatorClient: vi.fn().mockImplementation(() => ({})),
  x402ResourceServer: vi.fn().mockImplementation(() => ({ register: vi.fn().mockReturnThis() })),
}));
vi.mock("@x402/core/http", () => ({
  x402HTTPResourceServer: vi.fn().mockImplementation(() => ({ initialize, processHTTPRequest, processSettlement })),
}));
vi.mock("@x402/evm/exact/server", () => ({ ExactEvmScheme: vi.fn().mockImplementation(() => ({})) }));

const { X402Controller, X402Service } = await import("./x402.js");

function fakeDb() {
  return { insert: () => ({ values: async () => undefined }), select: () => ({ from: () => ({ where: () => ({ limit: async () => [] }) }) }) };
}
function fakeReply() {
  const reply: any = { statusCode: 0, sentBody: undefined, sentHeaders: {} };
  reply.status = (code: number) => { reply.statusCode = code; return reply; };
  reply.headers = (h: Record<string, string>) => { Object.assign(reply.sentHeaders, h); return reply; };
  reply.send = (body: any) => { reply.sentBody = body; return reply; };
  return reply;
}

let controller: InstanceType<typeof X402Controller>;

beforeEach(() => {
  processHTTPRequest.mockReset();
  processSettlement.mockReset();
  process.env.X402_PAY_TO_EVM = "0x000000000000000000000000000000000000aa";
  controller = new X402Controller(new X402Service(fakeDb() as any));
});
afterEach(() => {
  delete process.env.X402_PAY_TO_EVM;
});

describe("GET /v1/x402/example-resource", () => {
  it("returns the SDK's 402 challenge instructions verbatim when no/invalid payment is presented", async () => {
    processHTTPRequest.mockResolvedValue({
      type: "payment-error",
      response: { status: 402, headers: { "content-type": "application/json" }, body: { x402Version: 2, accepts: [{ scheme: "exact" }] } },
    });
    const reply = fakeReply();
    await controller.exampleResource({ headers: {}, method: "GET", url: "/v1/x402/example-resource" } as any, reply);
    expect(reply.statusCode).toBe(402);
    expect(reply.sentBody).toEqual({ x402Version: 2, accepts: [{ scheme: "exact" }] });
    expect(processSettlement).not.toHaveBeenCalled();
  });

  it("settles and returns 200 with settlement headers once payment is verified - never trusts a client-supplied paid claim", async () => {
    const paymentPayload = { x402Version: 2, accepted: { scheme: "exact" }, payload: {} };
    const paymentRequirements = { scheme: "exact", network: "eip155:84532", asset: "0xUSDC", amount: "10000", payTo: "0xaa", maxTimeoutSeconds: 60, extra: {} };
    processHTTPRequest.mockResolvedValue({ type: "payment-verified", paymentPayload, paymentRequirements });
    processSettlement.mockResolvedValue({ success: true, headers: { "payment-response": "abc" } });
    const reply = fakeReply();
    await controller.exampleResource({ headers: {}, method: "GET", url: "/v1/x402/example-resource" } as any, reply);
    expect(processSettlement).toHaveBeenCalledWith(paymentPayload, paymentRequirements);
    expect(reply.statusCode).toBe(200);
    expect(reply.sentHeaders).toEqual({ "payment-response": "abc" });
    expect(reply.sentBody.settled).toBe(true);
  });
});
