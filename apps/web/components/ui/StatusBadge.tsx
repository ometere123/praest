const PROVISIONAL = new Set([
  "accepted",
  "appealed",
  "appealing",
  "pending_appeal",
  "submitted",
  "processing",
  "dispatched",
  "in_progress",
  "reviewing",
]);
const FINAL = new Set([
  "finalized",
  "final",
  "settled",
  "active",
  "completed",
  "confirmed",
  "delivered",
  "verified",
  "paid",
  "resolved",
  "ready",
]);
const FAILED = new Set(["failed", "rejected", "expired", "reverted", "denied", "cancelled", "canceled", "error"]);
const PENDING = new Set(["pending", "queued", "waiting", "created", "draft", "new"]);
const UNCONFIGURED = new Set(["unconfigured", "unknown", "collector_error", "not_configured"]);

export function toneForStatus(raw?: string | null): "final" | "provisional" | "failed" | "pending" | "unconfigured" | "draft" {
  const s = String(raw ?? "").toLowerCase();
  if (FINAL.has(s)) return "final";
  if (FAILED.has(s)) return "failed";
  if (PROVISIONAL.has(s)) return "provisional";
  if (UNCONFIGURED.has(s)) return "unconfigured";
  if (PENDING.has(s)) return "pending";
  return "draft";
}

export function StatusBadge({ value }: { value?: string | null }) {
  if (!value) return null;
  const tone = toneForStatus(value);
  const label = String(value).replace(/_/g, " ");
  return (
    <span className={`pill status-${tone}`}>
      <span className="dot" />
      {label}
    </span>
  );
}
