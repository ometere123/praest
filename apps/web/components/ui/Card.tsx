import type { PropsWithChildren, ReactNode } from "react";

export function Card({ children, title, action, className = "" }: PropsWithChildren<{ title?: string; action?: ReactNode; className?: string }>) {
  return (
    <div className={`card ${className}`}>
      {(title || action) && (
        <div className="card-head">
          {title && <div className="card-title">{title}</div>}
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

export function StatCard({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="card stat-card">
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

export function StatGrid({ children }: PropsWithChildren) {
  return <div className="stat-grid">{children}</div>;
}
