"use client";
import { useState } from "react";
import { api } from "@/lib/api";
import { resourceKey } from "@/lib/route-meta";
import { Card } from "@/components/ui/Card";
import { ErrorBanner, SuccessBanner } from "@/components/ui/StateViews";

const human = (s: string) => s.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

function Result({ msg, ok }: { msg: string; ok: boolean }) {
  if (!msg) return null;
  return ok ? <SuccessBanner message={msg} /> : <ErrorBanner message={msg} />;
}

export function DirectAction({ title, endpoint, body = {} }: { title: string; endpoint: string; body?: any }) {
  const [msg, setMsg] = useState("");
  const [ok, setOk] = useState(true);
  const [busy, setBusy] = useState(false);
  return (
    <Card title={title}>
      <button
        className="btn primary"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setMsg("");
          try {
            const out = await api(endpoint, { method: "POST", body: JSON.stringify(body) });
            setOk(true);
            setMsg(`Success ${out?.id || out?.instruction?.instructionId || ""}`.trim());
          } catch (e: any) {
            setOk(false);
            setMsg(e.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Working…" : title}
      </button>
      {msg && (
        <div style={{ marginTop: 12 }}>
          <Result msg={msg} ok={ok} />
        </div>
      )}
    </Card>
  );
}

export function EndpointForm({ title, endpoint, fields }: { title: string; endpoint: string; fields: [string, string][] }) {
  const [msg, setMsg] = useState("");
  const [ok, setOk] = useState(true);
  const [busy, setBusy] = useState(false);
  return (
    <Card title={title}>
      <form
        className="form"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setMsg("");
          const raw: any = Object.fromEntries(new FormData(e.currentTarget).entries());
          for (const k of ["evidenceIds", "events", "permissions"]) if (typeof raw[k] === "string") raw[k] = raw[k].split(",").map((x: string) => x.trim()).filter(Boolean);
          for (const k of ["metadata", "terms", "paymentPayload", "paymentRequirements", "obligation"])
            if (typeof raw[k] === "string" && raw[k])
              try {
                raw[k] = JSON.parse(raw[k]);
              } catch {}
          try {
            const out = await api(endpoint, { method: "POST", body: JSON.stringify(raw) });
            setOk(true);
            setMsg(`Success ${out?.id || out?.instructionId || ""}`.trim());
          } catch (e: any) {
            setOk(false);
            setMsg(e.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {fields.map(([n, l]) => (
          <div className="field" key={n}>
            <label>{l}</label>
            {["claim", "body", "metadata", "terms", "paymentPayload", "paymentRequirements", "obligation"].includes(n) ? <textarea name={n} /> : <input name={n} />}
          </div>
        ))}
        <button className="btn primary" disabled={busy} style={{ justifySelf: "start" }}>
          {busy ? "Working…" : "Submit"}
        </button>
      </form>
      {msg && (
        <div style={{ marginTop: 12 }}>
          <Result msg={msg} ok={ok} />
        </div>
      )}
    </Card>
  );
}

export function Form({ title, onSubmit, fields }: { title: string; onSubmit: any; fields: [string, string][] }) {
  return (
    <Card title={title}>
      <form className="form" onSubmit={onSubmit}>
        {fields.map(([n, l]) => (
          <div className="field" key={n}>
            <label>{l}</label>
            {["description", "claim", "terms", "assertions"].includes(n) ? <textarea name={n} /> : <input name={n} required={!["description", "evidenceBundleId"].includes(n)} />}
          </div>
        ))}
        <button className="btn primary" style={{ justifySelf: "start" }}>
          Submit
        </button>
      </form>
    </Card>
  );
}

export function ActionPanel({ path, endpoint }: { path: string; endpoint?: string }) {
  const [msg, setMsg] = useState("");
  const [ok, setOk] = useState(true);
  const [busy, setBusy] = useState(false);
  const dynId = path.split("/").find((x) => /^[0-9a-f]{8}-/.test(x));

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    const fd = new FormData(e.currentTarget);
    const raw = Object.fromEntries(fd.entries());
    let body: any = { ...raw };
    for (const k of ["terms", "metadata", "assertions", "obligation", "capabilities", "authorityPolicy", "paymentPayload", "paymentRequirements"])
      if (typeof body[k] === "string" && body[k])
        try {
          body[k] = JSON.parse(body[k]);
        } catch {}
    try {
      let ep = endpoint || "";
      if (path.includes("/disputes/new")) ep = "resolutions";
      else if (ep === "agreements" || path === "/app/events/new") ep = "agreements";
      else if (ep === "monitors") ep = "monitors";
      else if (ep === "escrows") ep = "escrows";
      else if (ep === "api-keys") ep = "api-keys";
      else if (ep === "webhooks") ep = "webhooks";
      else ep = `resources/${resourceKey(ep)}`;
      const out = await api(ep, { method: "POST", body: JSON.stringify(body) });
      setOk(true);
      setMsg(`Created ${out.id || out.instructionId || "successfully"}`);
    } catch (e: any) {
      setOk(false);
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  }

  const resultBlock = msg && (
    <div style={{ marginTop: 12 }}>
      <Result msg={msg} ok={ok} />
    </div>
  );

  if (path.startsWith("/app/cases/") && dynId) return <DirectAction title="Submit to GenLayer" endpoint={`cases/${dynId}/adjudicate`} />;
  if (path.startsWith("/app/adjudications/") && dynId)
    return (
      <>
        <EndpointForm title="Appeal adjudication" endpoint={`adjudications/${dynId}/appeal`} fields={[["reason", "Appeal reason"], ["value", "Optional GenLayer appeal value"]]} />
        <DirectAction title="Finalize and authorize settlement" endpoint={`adjudications/${dynId}/finalize`} />
      </>
    );
  if (path.startsWith("/app/agreements/") && dynId && !path.includes("/evidence") && !path.includes("/settlement"))
    return (
      <>
        <EndpointForm
          title="Accept agreement version"
          endpoint={`agreements/${dynId}/accept`}
          fields={[["partyType", "Party type"], ["partyId", "Party ID"], ["role", "Role (customer/provider/agent)"], ["settlementAddress", "Settlement address"], ["version", "Version"], ["signature", "Optional signature"]]}
        />
        <DirectAction title="Activate agreement" endpoint={`agreements/${dynId}/activate`} />
      </>
    );
  if (path === "/app/evidence")
    return (
      <>
        <EndpointForm title="Add evidence" endpoint="evidence" fields={[["agreementId", "Agreement ID"], ["caseId", "Optional case ID"], ["kind", "Evidence kind"], ["source", "Source/provenance"], ["url", "Public HTTPS source URL"], ["body", "Evidence body"], ["metadata", "Metadata JSON"]]} />
        <EndpointForm title="Lock evidence bundle" endpoint="evidence/bundles/lock" fields={[["agreementId", "Agreement ID"], ["evidenceIds", "Evidence IDs, comma-separated"]]} />
      </>
    );
  if (path === "/app/escrows")
    return (
      <EndpointForm
        title="Create settlement escrow"
        endpoint="escrows"
        fields={[["agreementId", "Agreement ID"], ["routeKey", "Route key"], ["asset", "Token/mint address"], ["assetDecimals", "Asset decimals"], ["payerAddress", "Payer address"], ["providerAddress", "Provider address"], ["customerAddress", "Customer address"], ["amount", "Amount in atomic units"], ["maxCustomerRemedyBps", "Customer remedy cap bps"]]}
      />
    );
  if (path.startsWith("/app/services/") && dynId) return <EndpointForm title="Add private service credential" endpoint={`services/${dynId}/credentials`} fields={[["name", "Credential name"], ["kind", "Kind"], ["secret", "Secret or JSON string"]]} />;
  if (path === "/app/x402/requests")
    return (
      <EndpointForm
        title="Verify / settle x402 payment"
        endpoint="x402/verify-settle"
        fields={[["requestId", "Optional request ID"], ["serviceId", "Service ID"], ["agentId", "Agent ID"], ["paymentPayload", "Payment payload JSON"], ["paymentRequirements", "Payment requirements JSON"], ["obligation", "Obligation JSON"]]}
      />
    );
  if (path === "/app/x402/assurance") return <EndpointForm title="Open x402 assurance case" endpoint="x402/assurance" fields={[["requestId", "x402 request ID"], ["agreementId", "Agreement ID"], ["claim", "Failure claim"]]} />;
  if (path === "/developer/resolution")
    return <EndpointForm title="Create resolution case through PRAEST" endpoint="resolutions" fields={[["agreementId", "Agreement ID"], ["caseType", "Case type"], ["claim", "Claim"], ["requestedOutcome", "Requested outcome"], ["evidenceBundleId", "Evidence bundle ID"]]} />;
  if (path === "/app/services/new") return <Form title="Register service" onSubmit={submit} fields={[["name", "Service name"], ["kind", "Kind"], ["baseUrl", "Base URL"], ["description", "Description"]]} />;
  if (path === "/app/agreements/new")
    return <Form title="Create agreement" onSubmit={submit} fields={[["name", "Agreement name"], ["kind", "Kind"], ["serviceId", "Service ID"], ["settlementRouteKey", "Settlement route"], ["settlementAsset", "Asset"], ["governedValue", "Governed value (atomic units)"], ["terms", "Terms JSON"]]} />;
  if (path === "/app/monitors/new")
    return <Form title="Create monitor" onSubmit={submit} fields={[["serviceId", "Service ID"], ["name", "Monitor name"], ["url", "HTTPS endpoint"], ["method", "Method"], ["intervalSeconds", "Interval seconds"], ["timeoutMs", "Timeout ms"], ["assertions", "Assertions JSON"]]} />;
  if (path === "/app/agents/new") return <Form title="Register agent" onSubmit={submit} fields={[["name", "Agent name"], ["description", "Description"], ["capabilities", "Capabilities"]]} />;
  if (path === "/app/disputes/new") return <Form title="Open resolution case" onSubmit={submit} fields={[["agreementId", "Agreement ID"], ["caseType", "Case type"], ["claim", "Claim"], ["requestedOutcome", "Requested outcome"], ["evidenceBundleId", "Evidence bundle ID"]]} />;
  if (path === "/app/events/new") return <Form title="Create event resolution agreement" onSubmit={submit} fields={[["name", "Event"], ["kind", "Kind"], ["settlementRouteKey", "Settlement route"], ["terms", "Resolution terms JSON"]]} />;
  if (path === "/developer/api-keys") return <Form title="Create API key" onSubmit={submit} fields={[["name", "Key name"], ["permissions", "Permissions, comma-separated"]]} />;
  if (path === "/developer/webhooks") return <Form title="Create webhook" onSubmit={submit} fields={[["url", "HTTPS URL"], ["events", "Events"], ["secret", "Signing secret"]]} />;
  return null;
}

export { human };
