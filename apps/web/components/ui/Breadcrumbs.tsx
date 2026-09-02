import Link from "next/link";
import { ChevronRight } from "lucide-react";

const human = (s: string) => s.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export function Breadcrumbs({ path }: { path: string }) {
  const bits = path.split("/").filter(Boolean);
  let acc = "";
  return (
    <div className="breadcrumbs">
      <Link href="/">PRAEST</Link>
      {bits.map((b, i) => {
        acc += `/${b}`;
        const isId = /^[0-9a-f]{8}-/i.test(b) || /^\[.*\]$/.test(b);
        const label = isId ? `${b.slice(0, 8)}…` : human(b);
        const last = i === bits.length - 1;
        return (
          <span key={acc} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <ChevronRight size={12} className="sep" />
            {last ? <span className={isId ? "mono" : undefined}>{label}</span> : <Link className={isId ? "mono" : undefined} href={acc}>{label}</Link>}
          </span>
        );
      })}
    </div>
  );
}
