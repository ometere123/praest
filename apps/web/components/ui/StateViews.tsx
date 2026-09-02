import { AlertTriangle, CheckCircle2, Inbox, Info } from "lucide-react";
import type { ReactNode } from "react";

export function EmptyState({ title = "Nothing here yet", sub, action }: { title?: string; sub?: string; action?: ReactNode }) {
  return (
    <div className="state-block">
      <Inbox size={22} className="state-icon" />
      <div className="state-block-title">{title}</div>
      {sub && <div className="state-block-sub">{sub}</div>}
      {action}
    </div>
  );
}

export function LoadingRows({ rows = 4 }: { rows?: number }) {
  return (
    <div className="table-wrap" style={{ padding: 16 }}>
      <div style={{ display: "grid", gap: 10 }}>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="skeleton" style={{ height: 16, width: `${92 - i * 6}%` }} />
        ))}
      </div>
    </div>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="banner error">
      <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
      <span>{message}</span>
    </div>
  );
}

export function SuccessBanner({ message }: { message: string }) {
  return (
    <div className="banner success">
      <CheckCircle2 size={16} style={{ flexShrink: 0, marginTop: 2 }} />
      <span>{message}</span>
    </div>
  );
}

export function InfoBanner({ message }: { message: ReactNode }) {
  return (
    <div className="banner info">
      <Info size={16} style={{ flexShrink: 0, marginTop: 2 }} />
      <span>{message}</span>
    </div>
  );
}
