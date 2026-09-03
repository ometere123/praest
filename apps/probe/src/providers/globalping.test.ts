import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const createMeasurement = vi.fn();
const awaitMeasurement = vi.fn();
let lastConstructedOptions: any;

vi.mock("globalping", () => ({
  Globalping: vi.fn().mockImplementation((options: any) => {
    lastConstructedOptions = options;
    return { createMeasurement, awaitMeasurement };
  }),
}));

const { globalpingProvider, locationFor, client } = await import("./globalping.js");

const target = {
  id: "monitor-1",
  organizationId: "org-1",
  serviceId: "service-1",
  url: "https://example.com/health?x=1",
  method: "GET",
  timeoutMs: 5000,
  assertions: { expectedStatus: 200 },
  authHeaders: { authorization: "Bearer test" },
};

const finishedResult = (overrides: any = {}) => ({
  ok: true,
  data: {
    id: "m-1",
    status: "finished",
    results: [
      {
        probe: { continent: "NA", region: "Northern America", country: "US", state: null, city: "New York", asn: 13335, network: "Cloudflare", latitude: 40.7, longitude: -74, tags: [], resolvers: [] },
        result: {
          status: "finished",
          rawOutput: "",
          rawHeaders: "content-type: text/plain",
          rawBody: "ok",
          truncated: false,
          headers: { "content-type": "text/plain" },
          statusCode: 200,
          statusCodeName: "OK",
          resolvedAddress: "93.184.216.34",
          timings: { total: 120, dns: 10, tcp: 20, tls: 30, firstByte: 90, download: 30 },
          tls: null,
          ...overrides,
        },
      },
    ],
  },
});

beforeEach(() => {
  createMeasurement.mockReset();
  awaitMeasurement.mockReset();
  createMeasurement.mockResolvedValue({ ok: true, data: { id: "m-1", probesCount: 1 } });
  awaitMeasurement.mockResolvedValue(finishedResult());
  delete process.env.GLOBALPING_API_TOKEN;
  delete process.env.GLOBALPING_MEASUREMENT_TYPE;
});
afterEach(() => {
  delete process.env.GLOBALPING_API_TOKEN;
  delete process.env.GLOBALPING_MEASUREMENT_TYPE;
});

describe("locationFor (location selection)", () => {
  it("maps a plain region string to a Globalping fuzzy 'magic' location", () => {
    expect(locationFor("US")).toEqual({ magic: "US" });
    expect(locationFor("Germany")).toEqual({ magic: "Germany" });
  });
});

describe("no API token configuration", () => {
  it("constructs a client without auth when GLOBALPING_API_TOKEN is unset", () => {
    client();
    expect(lastConstructedOptions.auth).toBeUndefined();
  });
  it("passes the token through when configured", () => {
    process.env.GLOBALPING_API_TOKEN = "tok_123";
    client();
    expect(lastConstructedOptions.auth).toBe("tok_123");
  });
});

describe("request construction", () => {
  it("builds an http measurement request for the target and region", async () => {
    await globalpingProvider.run(target as any, "US");
    expect(createMeasurement).toHaveBeenCalledTimes(1);
    const req = createMeasurement.mock.calls[0]![0];
    expect(req.type).toBe("http");
    expect(req.target).toBe("example.com");
    expect(req.locations).toEqual([{ magic: "US" }]);
    expect(req.measurementOptions.request.path).toBe("/health");
    expect(req.measurementOptions.request.query).toBe("x=1");
    expect(req.measurementOptions.request.method).toBe("GET");
    expect(req.measurementOptions.request.headers.authorization).toBe("Bearer test");
    expect(req.measurementOptions.protocol).toBe("HTTPS");
  });

  it("rejects non-HTTPS targets before calling the API", async () => {
    const r = await globalpingProvider.run({ ...target, url: "http://example.com" } as any, "US");
    expect(r.collectorStatus).toBe("COLLECTOR_ERROR");
    expect(createMeasurement).not.toHaveBeenCalled();
  });
});

describe("successful normalization", () => {
  it("normalizes a finished measurement into the existing RegionalMeasurement shape plus evidence", async () => {
    const r = await globalpingProvider.run(target as any, "US");
    expect(r.collectorStatus).toBe("OK");
    expect(r.classification).toBe("SERVICE_OK");
    expect(r.statusCode).toBe(200);
    expect(r.dnsMs).toBe(10);
    expect(r.tcpMs).toBe(20);
    expect(r.tlsMs).toBe(30);
    expect(r.ttfbMs).toBe(90);
    expect(r.totalMs).toBe(120);
    expect(r.measurementId).toBe("m-1");
    expect(r.region).toBe("US");
    expect(r.responseDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(r.evidence?.probe.country).toBe("US");
    expect(r.evidence?.probe.city).toBe("New York");
    expect(r.evidence?.probe.asn).toBe(13335);
    expect(r.evidence?.resolvedAddress).toBe("93.184.216.34");
    expect(r.evidence?.measurementId).toBe("m-1");
  });

  it("classifies a failed assertion as SERVICE_FAILURE, not COLLECTOR_ERROR", async () => {
    awaitMeasurement.mockResolvedValue(finishedResult({ statusCode: 500 }));
    const r = await globalpingProvider.run(target as any, "US");
    expect(r.collectorStatus).toBe("OK");
    expect(r.classification).toBe("SERVICE_FAILURE");
  });
});

describe("pending measurement polling", () => {
  it("relies on the client's awaitMeasurement to resolve only once the measurement is no longer in-progress", async () => {
    let calls = 0;
    awaitMeasurement.mockImplementation(async () => {
      calls++;
      return finishedResult();
    });
    const r = await globalpingProvider.run(target as any, "US");
    expect(calls).toBe(1);
    expect(r.collectorStatus).toBe("OK");
  });
});

describe("timeout", () => {
  it("enforces GLOBALPING_MEASUREMENT_TIMEOUT via an aborted signal and reports it distinctly", async () => {
    awaitMeasurement.mockImplementation(async (_id: string, opts: { signal?: AbortSignal }) => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      if (opts?.signal?.aborted) throw new Error("aborted");
      return finishedResult();
    });
    const r = await globalpingProvider.run({ ...target, timeoutMs: 5 } as any, "US");
    expect(r.collectorStatus).toBe("COLLECTOR_ERROR");
    expect(r.classification).toBe("UNKNOWN");
    expect(r.error).toMatch(/timed out/i);
  });
});

describe("malformed provider response", () => {
  it("fails cleanly when the finished measurement has no results", async () => {
    awaitMeasurement.mockResolvedValue({ ok: true, data: { id: "m-1", status: "finished", results: [] } });
    const r = await globalpingProvider.run(target as any, "US");
    expect(r.collectorStatus).toBe("COLLECTOR_ERROR");
    expect(r.classification).toBe("UNKNOWN");
    expect(r.error).toMatch(/no results/i);
  });

  it("fails cleanly when a probe location has no available probes (offline)", async () => {
    awaitMeasurement.mockResolvedValue(finishedResult()).mockResolvedValueOnce({
      ok: true,
      data: { id: "m-1", status: "finished", results: [{ probe: {}, result: { status: "offline", rawOutput: "" } }] },
    });
    const r = await globalpingProvider.run(target as any, "US");
    expect(r.collectorStatus).toBe("COLLECTOR_ERROR");
    expect(r.error).toMatch(/no available probes/i);
  });
});

describe("provider/API error", () => {
  it("surfaces a createMeasurement validation/API error without throwing", async () => {
    createMeasurement.mockResolvedValue({ ok: false, data: { error: { message: "Invalid target" } } });
    const r = await globalpingProvider.run(target as any, "US");
    expect(r.collectorStatus).toBe("COLLECTOR_ERROR");
    expect(r.classification).toBe("UNKNOWN");
    expect(r.error).toMatch(/Invalid target/);
  });

  it("surfaces an awaitMeasurement rejection (network/API failure) without throwing", async () => {
    awaitMeasurement.mockRejectedValue(new Error("network error"));
    const r = await globalpingProvider.run(target as any, "US");
    expect(r.collectorStatus).toBe("COLLECTOR_ERROR");
    expect(r.error).toMatch(/network error/);
  });
});
