CREATE DATABASE IF NOT EXISTS praest;
CREATE TABLE IF NOT EXISTS praest.measurements (
  measurementId UUID,
  organizationId UUID,
  monitorId UUID,
  serviceId UUID,
  region LowCardinality(String),
  scheduledAt Nullable(DateTime64(3,'UTC')),
  startedAt DateTime64(3,'UTC'),
  finishedAt DateTime64(3,'UTC'),
  collectorStatus LowCardinality(String),
  serviceStatus LowCardinality(String),
  statusCode Nullable(UInt16),
  dnsMs Nullable(Float64),
  tcpMs Nullable(Float64),
  tlsMs Nullable(Float64),
  ttfbMs Nullable(Float64),
  totalMs Nullable(Float64),
  responseDigest Nullable(String),
  assertions JSON,
  error Nullable(String),
  workerVersion LowCardinality(Nullable(String))
) ENGINE=MergeTree
PARTITION BY toYYYYMM(startedAt)
ORDER BY (organizationId, monitorId, startedAt)
TTL startedAt + INTERVAL 365 DAY DELETE;
