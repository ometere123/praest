import type { ReactNode } from "react";
import { toneForStatus } from "./StatusBadge";

export type TimelineEvent = { title: string; meta?: string; status?: string };

function stateFor(status?: string): "final" | "provisional" | "failed" | undefined {
  if (!status) return undefined;
  const tone = toneForStatus(status);
  if (tone === "final" || tone === "provisional" || tone === "failed") return tone;
  return undefined;
}

export function Timeline({ events, children }: { events?: TimelineEvent[]; children?: ReactNode }) {
  if (children) return <div className="timeline">{children}</div>;
  return (
    <div className="timeline">
      {events?.map((e, i) => (
        <div key={i} className="timeline-event" data-state={stateFor(e.status)}>
          <div className="timeline-event-title">{e.title}</div>
          {e.meta && <div className="timeline-event-meta">{e.meta}</div>}
        </div>
      ))}
    </div>
  );
}

export function TimelineEventRow({ title, meta, status }: TimelineEvent) {
  return (
    <div className="timeline-event" data-state={stateFor(status)}>
      <div className="timeline-event-title">{title}</div>
      {meta && <div className="timeline-event-meta">{meta}</div>}
    </div>
  );
}
