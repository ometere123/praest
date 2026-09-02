import { StatusBadge } from "./StatusBadge";
import { HashChip } from "./HashChip";

const HIDDEN_KEYS = new Set(["payload", "metadata", "terms", "manifest", "rawDecision", "ciphertext", "configCiphertext"]);
const STATUS_KEYS = new Set(["status", "state", "outcome", "lifecycleStatus", "settlementStatus", "finality"]);
const HASH_LIKE = /(hash|id|signature|txHash|instructionId|messageId)$/i;

const human = (s: string) => s.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

function renderCell(key: string, value: any) {
  if (value === null || value === undefined) return <span className="muted">—</span>;
  if (STATUS_KEYS.has(key) && typeof value === "string") return <StatusBadge value={value} />;
  if (typeof value === "string" && HASH_LIKE.test(key) && value.length > 18) return <HashChip value={value} />;
  if (typeof value === "object") return <span className="mono muted">{JSON.stringify(value).slice(0, 90)}</span>;
  return String(value);
}

export function DataTable({ rows, onRowClick }: { rows: any[]; onRowClick?: (row: any) => void }) {
  if (!rows.length) return null;
  const cols = Object.keys(rows[0] || {})
    .filter((k) => !HIDDEN_KEYS.has(k))
    .slice(0, 7);
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            {cols.map((c) => (
              <th key={c}>{human(c)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id || i} className={onRowClick ? "table-row-link" : undefined} onClick={() => onRowClick?.(r)}>
              {cols.map((c) => (
                <td key={c}>{renderCell(c, r[c])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
