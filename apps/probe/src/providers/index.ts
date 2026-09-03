import { nativeProvider } from "./native.js";
import { globalpingProvider } from "./globalping.js";
import type { ProbeProvider } from "./types.js";

const PROVIDERS: Record<string, ProbeProvider> = {
  globalping: globalpingProvider,
  native: nativeProvider,
};

/**
 * PROBE_PROVIDER selects the transport a region's probe is executed
 * through. Defaults to "globalping" (no AWS/card-based infra required).
 * Adding another provider later means implementing ProbeProvider and
 * registering it here - the coordinator and everything downstream of it
 * (evidence normalization, ingestion, quorum, storage) never changes.
 */
export function getProvider(name: string = process.env.PROBE_PROVIDER || "globalping"): ProbeProvider {
  const provider = PROVIDERS[name];
  if (!provider) throw new Error(`Unknown PROBE_PROVIDER "${name}". Available: ${Object.keys(PROVIDERS).join(", ")}`);
  return provider;
}

export type { ProbeProvider, ProbeTarget, RegionalMeasurement } from "./types.js";
