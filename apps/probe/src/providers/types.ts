/** A monitor target as returned by GET /v1/internal/probes/targets. */
export interface ProbeTarget {
  id: string;
  organizationId: string;
  serviceId: string;
  url: string;
  method?: string;
  timeoutMs?: number;
  intervalSeconds?: number;
  regions?: string[];
  assertions?: any;
  authHeaders?: Record<string, string>;
}

/**
 * The exact payload shape POST /v1/internal/probes/measurements has always
 * expected (unchanged from the AWS Lambda prober) plus an optional
 * `evidence` bag providers can fill in with anything extra they have
 * (probe geolocation, ASN, TLS details, resolved IP, raw provider
 * reference...). ProbeController.ingest only reads the fixed top-level
 * fields for quorum/incident logic and otherwise stores the whole object
 * verbatim, so additive fields here are safe and lossless.
 */
export interface RegionalMeasurement {
  measurementId: string;
  monitorId: string;
  organizationId: string;
  serviceId: string;
  region: string;
  workerVersion: string;
  collectorStatus: "OK" | "COLLECTOR_ERROR";
  classification: "SERVICE_OK" | "SERVICE_FAILURE" | "UNKNOWN";
  statusCode?: number;
  dnsMs?: number;
  tcpMs?: number;
  tlsMs?: number;
  ttfbMs?: number;
  totalMs?: number;
  responseDigest?: string;
  assertions?: any;
  error?: string;
  observedAt: string;
  summary?: string;
  evidence?: Record<string, any>;
}

/**
 * A probe provider knows how to run one target's check from one configured
 * region/location and return a normalized RegionalMeasurement. The
 * coordinator (index.ts) never talks to a provider's own API directly -
 * swapping PROBE_PROVIDER is the only thing that changes which
 * implementation of this interface runs.
 */
export interface ProbeProvider {
  readonly name: string;
  run(target: ProbeTarget, region: string): Promise<RegionalMeasurement>;
}
