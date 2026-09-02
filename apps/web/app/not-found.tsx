import Link from "next/link";
import { MarketingShell } from "@/components/marketing/MarketingShell";

export default function NotFound() {
  return (
    <MarketingShell>
      <section className="mkt-hero">
        <div className="eyebrow">404</div>
        <h1>Route not found.</h1>
        <p>This URL is not part of the frozen PRAEST product surface.</p>
        <div className="mkt-hero-actions">
          <Link className="btn primary" href="/">Back home</Link>
          <Link className="btn" href="/app/dashboard">Go to console</Link>
        </div>
      </section>
    </MarketingShell>
  );
}
