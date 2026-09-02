import Link from "next/link";

const LIFECYCLE = [
  ["Obligation", "Service, agent or event promise is defined as an agreement."],
  ["Monitoring", "DNS/TCP/TLS/TTFB probes and execution evidence are collected."],
  ["Evidence", "Provenance-labelled evidence is hashed and stored; nothing is auto-trusted."],
  ["Adjudication", "GenLayer StudioNet resolves ambiguous fulfilment, liability or disputes."],
  ["Finality", "ACCEPTED is provisional and appealable — settlement waits for FINALIZED."],
  ["Instruction", "A deterministic settlement instruction is written to DecisionOutbox."],
  ["Transport", "The Studio relay dispatches through the zkSync Sepolia gateway and Hyperlane."],
  ["Settlement", "The destination-local escrow — not Hyperlane — executes value transfer."],
  ["Receipt", "Independent reconciliation produces a verifiable receipt and reputation update."],
];

export function PublicPage({ slug }: { slug: string }) {
  switch (slug) {
    case "about":
      return <About />;
    case "how-it-works":
      return <HowItWorks />;
    case "pricing":
      return <Pricing />;
    case "developers":
      return <Developers />;
    case "docs":
      return <Docs />;
    case "security":
      return <Security />;
    case "status":
      return <Status />;
    default:
      return <Generic slug={slug} />;
  }
}

function About() {
  return (
    <>
      <section className="mkt-hero">
        <div className="eyebrow">About PRAEST</div>
        <h1>Accountability infrastructure for a world of unattended commerce.</h1>
        <p>
          Digital services, paid APIs and autonomous agents make promises constantly and mostly unsupervised. PRAEST exists to make those promises
          measurable, evidenced, adjudicable, and enforceable — the same accountability layer whether the counterparty is a human provider, a SaaS
          endpoint, or an autonomous agent acting on x402 rails.
        </p>
      </section>
      <section className="mkt-section tight">
        <div className="mkt-grid">
          <div className="mkt-card">
            <h3>Deterministic first</h3>
            <p>Uptime math, thresholds, allocation math and idempotency stay in ordinary deterministic code — never left to a model.</p>
          </div>
          <div className="mkt-card">
            <h3>GenLayer for ambiguity</h3>
            <p>Conflicting evidence, agreement interpretation and liability are resolved by GenLayer StudioNet, not by PRAEST's own judgment.</p>
          </div>
          <div className="mkt-card">
            <h3>Settlement stays local</h3>
            <p>Hyperlane carries a finalized decision instruction; the destination-local escrow — never a bridge — executes the transfer.</p>
          </div>
        </div>
      </section>
    </>
  );
}

function HowItWorks() {
  return (
    <>
      <section className="mkt-hero">
        <div className="eyebrow">How it works</div>
        <h1>One lifecycle from promise to receipt.</h1>
        <p>Every PRAEST agreement — service, agent task, or predicted event — moves through the same accountability lifecycle.</p>
        <div className="mkt-lifecycle">
          {LIFECYCLE.map(([t, d]) => (
            <div className="mkt-lifecycle-step" key={t}>
              <b>{t}</b>
              {d}
            </div>
          ))}
        </div>
      </section>
      <section className="mkt-section">
        <h2>Finality is not optional</h2>
        <p className="section-sub">
          GenLayer <code className="mono">ACCEPTED</code> is provisional and appealable. PRAEST never authorizes cross-chain settlement until the
          appeal window closes and the decision reaches <code className="mono">FINALIZED</code>. Destination contracts independently re-check
          Mailbox origin, sender, target, expiry and instruction replay before any escrow moves.
        </p>
      </section>
    </>
  );
}

function Pricing() {
  const tiers = [
    { name: "Developer", price: "$0", note: "per month", features: ["Testnet routes only", "Community support", "Resolution API sandbox", "1 organisation"] },
    { name: "Growth", price: "Usage-based", note: "meter events + platform fee", featured: true, features: ["Production settlement routes", "Priority evidence storage", "Webhooks + audit export", "Team roles"] },
    { name: "Enterprise", price: "Custom", note: "contracted", features: ["Dedicated Control Plane review", "Custom ISM/route onboarding", "SLA-backed support", "Security review artifacts"] },
  ];
  return (
    <section className="mkt-section" style={{ paddingTop: 88 }}>
      <div className="eyebrow">Pricing</div>
      <h1 style={{ fontSize: 40, letterSpacing: "-0.03em", margin: "12px 0" }}>Pay for verified outcomes, not dashboards.</h1>
      <p className="section-sub">Billing meters on usage events (monitoring checks, evidence bundles, resolution cases, settlement instructions) via Stripe.</p>
      <div className="mkt-pricing-grid">
        {tiers.map((t) => (
          <div className="mkt-price-card" data-featured={t.featured} key={t.name}>
            <div>
              <h3>{t.name}</h3>
              <div className="price">{t.price}</div>
              <div className="muted" style={{ fontSize: 12.5 }}>{t.note}</div>
            </div>
            <ul>
              {t.features.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
            <Link className={`btn ${t.featured ? "primary" : ""}`} href="/signup" style={{ marginTop: "auto" }}>
              Get started
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}

function Developers() {
  const items = [
    ["REST / OpenAPI", "The canonical API surface every SDK and the CLI call through."],
    ["TypeScript SDK", "@praest/sdk-typescript — typed client for agreements, evidence and settlement."],
    ["Python SDK", "praest — for agent frameworks and backend integrations."],
    ["CLI", "Scriptable access for CI/CD and operational tooling."],
    ["MCP server", "Give an LLM agent direct, scoped access to PRAEST resolution and evidence."],
    ["Resolution API", "Consume PRAEST adjudication without implementing GenLayer/finality yourself."],
  ];
  return (
    <>
      <section className="mkt-hero">
        <div className="eyebrow">Developer platform</div>
        <h1>Build on the same API PRAEST's own console uses.</h1>
        <p>Every client — web console, SDKs, CLI, MCP — is a caller of one canonical API. Nothing is a special case.</p>
        <div className="mkt-hero-actions">
          <Link className="btn primary" href="/developer/overview">Open developer console</Link>
          <Link className="btn" href="/developer/openapi">View OpenAPI</Link>
        </div>
      </section>
      <section className="mkt-section tight">
        <div className="mkt-grid">
          {items.map(([t, d]) => (
            <div className="mkt-card" key={t}>
              <h3>{t}</h3>
              <p>{d}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

function Docs() {
  const sections = [
    ["Getting started", "Authenticate, provision a wallet, and create your first agreement."],
    ["Agreements & evidence", "Model service, agent and event obligations; attach provenance-labelled evidence."],
    ["Adjudication & finality", "How cases reach GenLayer StudioNet and why ACCEPTED is never final."],
    ["Settlement & routes", "Escrow funding, route configuration, and destination-local execution."],
    ["Webhooks & receipts", "Subscribe to lifecycle events and verify signed receipts."],
  ];
  return (
    <section className="mkt-section" style={{ paddingTop: 88 }}>
      <div className="eyebrow">Documentation</div>
      <h1 style={{ fontSize: 38, letterSpacing: "-0.03em", margin: "12px 0" }}>Guides for every surface of PRAEST.</h1>
      <div className="mkt-grid">
        {sections.map(([t, d]) => (
          <div className="mkt-card" key={t}>
            <h3>{t}</h3>
            <p>{d}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Security() {
  const items = [
    ["No fake ISMs", "Production destination contracts never accept an always-verifying or unused ISM."],
    ["Replay protection", "instructionId idempotency plus Hyperlane transport protection plus escrow state-machine checks."],
    ["Non-custodial funding", "Escrow funding is signed by the user's own wallet; PRAEST independently verifies chain state after."],
    ["Encrypted credentials", "Service, integration and webhook secrets are encrypted at rest before storage."],
    ["SSRF-hardened probes", "Monitoring pins vetted IPs while preserving TLS hostname validation against DNS rebinding."],
    ["Provenance-labelled evidence", "Party-submitted evidence is never automatically trusted as truth."],
  ];
  return (
    <section className="mkt-section" style={{ paddingTop: 88 }}>
      <div className="eyebrow">Security</div>
      <h1 style={{ fontSize: 38, letterSpacing: "-0.03em", margin: "12px 0" }}>Trust boundaries are explicit, not assumed.</h1>
      <p className="section-sub">
        PRAEST is built as a set of explicit trust boundaries rather than one implicit trust surface. Report vulnerabilities to{" "}
        <a href="mailto:security@praest.dev" style={{ textDecoration: "underline" }}>security@praest.dev</a>.
      </p>
      <div className="mkt-grid" style={{ marginTop: 32 }}>
        {items.map(([t, d]) => (
          <div className="mkt-card" key={t}>
            <h3>{t}</h3>
            <p>{d}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Status() {
  const rows = [
    ["Product / Control / Developer / Explorer", "Operational"],
    ["StudioNet adjudication", "Operational"],
    ["zkSync Sepolia → Hyperlane bridge", "Operational"],
    ["Regional monitoring probes", "Operational"],
  ];
  return (
    <section className="mkt-section" style={{ paddingTop: 88 }}>
      <div className="eyebrow">Status</div>
      <h1 style={{ fontSize: 38, letterSpacing: "-0.03em", margin: "12px 0" }}>Current testnet operational status.</h1>
      <div className="table-wrap" style={{ marginTop: 24 }}>
        <table className="table">
          <thead>
            <tr>
              <th>Surface</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([s, v]) => (
              <tr key={s}>
                <td>{s}</td>
                <td>
                  <span className="pill status-final">
                    <span className="dot" />
                    {v}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Generic({ slug }: { slug: string }) {
  return (
    <section className="mkt-hero">
      <div className="eyebrow">PRAEST</div>
      <h1 style={{ textTransform: "capitalize" }}>{slug.replace(/-/g, " ")}</h1>
      <p>Accountability infrastructure for digital services and autonomous commerce.</p>
    </section>
  );
}
