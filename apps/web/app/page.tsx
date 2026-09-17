import {WalletStatus} from "@/components/Providers";
import {LIFECYCLE_STEPS} from "./lifecycle";

export default function Home() {
  return <main className="mkt-section" style={{maxWidth: 1080, margin: "0 auto", paddingTop: 72}}>
    <p className="eyebrow">PRAEST · Studio-dev · chain 61997</p>
    <h1>Make digital promises enforceable.</h1>
    <p className="section-sub">Freeze the agreement, lock provenance-labelled evidence, and send only the ambiguous interpretation to GenLayer. ACCEPTED remains provisional until finality.</p>
    <div className="mkt-hero-actions"><WalletStatus/><a className="btn" href="https://explorer-studio-dev.genlayer.com/" target="_blank">Open explorer</a></div>
    <div className="mkt-lifecycle" aria-label="PRAEST lifecycle">{LIFECYCLE_STEPS.map((s, i) => <div className="mkt-lifecycle-step" key={s}><b>{String(i + 1).padStart(2, "0")} · {s}</b><span>{i === 4 ? "Bounded nondeterministic judgment" : i === 5 ? "Finalized result" : ""}</span></div>)}</div>
    <section className="mkt-section"><h2>Two contracts. One trust boundary.</h2><div className="mkt-grid"><article className="mkt-card"><h3>AgreementVault</h3><p>Deterministic lifecycle, immutable counterparties, canonical commitments, bounded outcomes, evidence lock, and replay-safe verdict application.</p></article><article className="mkt-card"><h3>Adjudicator</h3><p>GenLayer evaluates the narrow disputed interpretation against frozen terms and hostile/untrusted evidence, with substantive validator agreement and UNDETERMINED.</p></article></div></section>
  </main>;
}
