import { describe, expect, it } from "vitest";
import { temporalConnectionOptions } from "./temporal.js";

describe("temporalConnectionOptions", () => {
  it("defaults to a local, unauthenticated, non-TLS connection", () => {
    const o = temporalConnectionOptions({});
    expect(o).toEqual({
      address: "localhost:7233",
      namespace: "default",
      taskQueue: "praest",
      tls: undefined,
      apiKey: undefined,
    });
  });

  it("supports a self-hosted server (e.g. Railway private networking) with no TLS/API key", () => {
    const o = temporalConnectionOptions({
      TEMPORAL_ADDRESS: "temporal.railway.internal:7233",
      TEMPORAL_NAMESPACE: "default",
      TEMPORAL_TASK_QUEUE: "praest",
    });
    expect(o.address).toBe("temporal.railway.internal:7233");
    expect(o.tls).toBeUndefined();
    expect(o.apiKey).toBeUndefined();
  });

  it("treats a blank TEMPORAL_API_KEY (e.g. copied from .env.example) as absent, not as TLS-on", () => {
    const o = temporalConnectionOptions({ TEMPORAL_API_KEY: "" });
    expect(o.apiKey).toBeUndefined();
    expect(o.tls).toBeUndefined();
  });

  it("enables TLS when TEMPORAL_TLS=true even without an API key", () => {
    const o = temporalConnectionOptions({ TEMPORAL_TLS: "true" });
    expect(o.tls).toEqual({});
  });

  it("enables TLS automatically for Temporal Cloud once a real API key is set", () => {
    const o = temporalConnectionOptions({
      TEMPORAL_ADDRESS: "my-namespace.a1b2c.tmprl.cloud:7233",
      TEMPORAL_API_KEY: "cloud-api-key",
    });
    expect(o.tls).toEqual({});
    expect(o.apiKey).toBe("cloud-api-key");
  });
});
