import Link from "next/link";
import { MarketingShell } from "@/components/marketing/MarketingShell";

const LIFECYCLE = ["Agreement", "Evidence", "Case", "GenLayer", "Finalized", "Instruction", "Hyperlane", "Settlement", "Receipt"];

const PLANES = [
  { title: "Product", body: "Services, agreements, monitoring, evidence, cases, escrow, settlements, agents, x402 and analytics.", href: "/app/dashboard" },
  { title: "Control Plane", body: "StudioNet, workflows, Hyperlane, ISMs, system wallets, reconciliation and audit for PRAEST operators.", href: "/control/overview" },
  { title: "Developer Platform", body: "REST/OpenAPI, TypeScript + Python SDKs, CLI, MCP, x402 and the Resolution API.", href: "/developer/overview" },
  { title: "Explorer", body: "Public-safe lineage for agreements, cases, decisions, Hyperlane messages and settlements.", href: "/explorer" },
];

export default function Home() {
  return (
    <MarketingShell>
      <section className="mkt-hero">
        <div className="eyebrow">Accountability infrastructure for digital services</div>
        <h1>Make digital promises enforceable.</h1>
        <p>
          PRAEST turns service agreements, agent obligations and paid API promises into monitored, evidence-backed, adjudicable obligations. GenLayer
          resolves ambiguous failures. Hyperlane carries finalized decisions. Settlement executes where the value already lives.
        </p>
        <div className="mkt-hero-actions">
          <Link className="btn primary" href="/signup">Get started</Link>
          <Link className="btn" href="/developers">Developer platform</Link>
        </div>
        <div className="mkt-lifecycle" aria-label="PRAEST lifecycle">
          {LIFECYCLE.map((step, i) => (
            <div className="mkt-lifecycle-step" key={step}>
              <b>
                {String(i + 1).padStart(2, "0")} · {step}
              </b>
              {step === "GenLayer" ? "Ambiguous fulfilment is adjudicated on StudioNet." : step === "Finalized" ? "ACCEPTED is provisional until this state." : " "}
            </div>
          ))}
        </div>
      </section>

      <section className="mkt-section">
        <h2>One accountability layer, four surfaces</h2>
        <p className="section-sub">The same API and lifecycle state machine backs every surface — nothing is a special case.</p>
        <div className="mkt-grid">
          {PLANES.map((p) => (
            <Link className="mkt-card" href={p.href} key={p.title} style={{ display: "block" }}>
              <h3>{p.title}</h3>
              <p>{p.body}</p>
            </Link>
          ))}
        </div>
      </section>
    </MarketingShell>
  );
}
