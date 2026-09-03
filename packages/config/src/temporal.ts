export interface TemporalConnectionOptions {
  address: string;
  namespace: string;
  taskQueue: string;
  tls: true | Record<string, never> | undefined;
  apiKey: string | undefined;
}

/**
 * Builds Temporal connection settings from environment variables, shared by
 * every service that talks to Temporal (apps/worker, apps/api) so they can
 * never drift from each other.
 *
 * Supports both a self-hosted Temporal server (plain gRPC, no TLS/auth - the
 * Railway development setup) and Temporal Cloud (TLS + API key) from the
 * same env vars, without assuming Cloud:
 * - TLS is enabled only when TEMPORAL_TLS is exactly "true", or when a
 *   non-empty TEMPORAL_API_KEY is present (Temporal Cloud requires TLS).
 * - An empty-string TEMPORAL_API_KEY (e.g. a blank line copied from
 *   .env.example) is treated as absent, not as "enable TLS" - the
 *   Temporal SDK otherwise auto-enables TLS whenever `apiKey` is set to
 *   any string, including "".
 * - Nothing here is Railway- or Cloud-specific: address/namespace/task
 *   queue/TLS/API key all come from configuration.
 */
export function temporalConnectionOptions(env: Record<string, string | undefined> = process.env): TemporalConnectionOptions {
  const address = env.TEMPORAL_ADDRESS || "localhost:7233";
  const namespace = env.TEMPORAL_NAMESPACE || "default";
  const taskQueue = env.TEMPORAL_TASK_QUEUE || "praest";
  const apiKey = env.TEMPORAL_API_KEY || undefined;
  const tls = env.TEMPORAL_TLS === "true" || apiKey !== undefined ? {} : undefined;
  return { address, namespace, taskQueue, tls, apiKey };
}
