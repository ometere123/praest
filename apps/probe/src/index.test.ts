import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const run = vi.fn();
vi.mock("./providers/index.js", () => ({
  getProvider: () => ({ name: "globalping", run }),
}));

const { runOnce } = await import("./index.js");

const target = { id: "monitor-1", organizationId: "org-1", serviceId: "service-1", url: "https://example.com" };

function mockFetchSequence(byUrl: (url: string) => any) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: any) => {
      const url = String(input);
      const body = byUrl(url);
      return { ok: true, json: async () => body } as any;
    }),
  );
}

beforeEach(() => {
  process.env.PRAEST_API_URL = "http://localhost:4000";
  process.env.PRAEST_INTERNAL_TOKEN = "internal-token";
  process.env.GLOBALPING_PROBE_LOCATIONS = "US,DE";
  run.mockReset();
});
afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.GLOBALPING_PROBE_LOCATIONS;
});

describe("probe coordinator - partial regional failure", () => {
  it("keeps going and reports both regions when one region's target fetch fails", async () => {
    mockFetchSequence((url) => {
      if (url.includes("region=US")) throw new Error("network down for US");
      if (url.includes("region=DE")) return [target];
      return null;
    });
    // withRetry backs off; make fetch reject synchronously each retry by overriding fetch to throw for US.
    (global.fetch as any).mockImplementation(async (input: any) => {
      const url = String(input);
      if (url.includes("region=US")) throw new Error("network down for US");
      if (url.includes("region=DE")) return { ok: true, json: async () => [target] };
      return { ok: true, json: async () => ({ accepted: true }) };
    });
    run.mockResolvedValue({
      measurementId: "m-de",
      monitorId: target.id,
      organizationId: target.organizationId,
      serviceId: target.serviceId,
      region: "DE",
      workerVersion: "globalping-1",
      collectorStatus: "OK",
      classification: "SERVICE_OK",
      observedAt: new Date().toISOString(),
    });

    const summary = await runOnce();

    expect(summary.locations).toEqual(["US", "DE"]);
    const us = summary.results.find((r: any) => r.region === "US")!;
    const de = summary.results.find((r: any) => r.region === "DE")!;
    expect((us as any).error).toMatch(/network down for US/);
    expect((de as any).ran).toBe(1);
    expect(run).toHaveBeenCalledTimes(1); // only DE's target ever reached the provider
  });

  it("keeps going and reports both regions when one region's provider run fails for a target", async () => {
    mockFetchSequence(() => [target]);
    run.mockImplementation(async (_t: any, region: string) => {
      if (region === "US") throw new Error("globalping unavailable");
      return {
        measurementId: "m-de",
        monitorId: target.id,
        organizationId: target.organizationId,
        serviceId: target.serviceId,
        region,
        workerVersion: "globalping-1",
        collectorStatus: "OK",
        classification: "SERVICE_OK",
        observedAt: new Date().toISOString(),
      };
    });

    const summary = await runOnce();

    const us = summary.results.find((r: any) => r.region === "US")!;
    const de = summary.results.find((r: any) => r.region === "DE")!;
    expect((us as any).ran).toBe(1); // still posted a COLLECTOR_ERROR/UNKNOWN measurement, not dropped
    expect((de as any).ran).toBe(1);
  });
}, 20000);
