"use client";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { endpointFor, human, isLifecyclePath, resourceKey, section, shouldFetch } from "@/lib/route-meta";
import { AppShell, PageHead } from "@/components/ui/Shell";
import { StatCard, StatGrid } from "@/components/ui/Card";
import { StatusBadge, toneForStatus } from "@/components/ui/StatusBadge";
import { DataTable } from "@/components/ui/DataTable";
import { EmptyState, ErrorBanner, LoadingRows } from "@/components/ui/StateViews";
import { ActionPanel } from "./ActionForms";
import { ContextPanel } from "./ContextPanel";
import EscrowFundingAction from "@/components/EscrowFundingAction";

type Props = { path: string };

export default function ConsoleRouter({ path }: Props) {
  const sec = section(path);
  const bits = path.split("/").filter(Boolean);
  const title = human(bits.at(-1)?.startsWith("[") ? bits.at(-2) || "PRAEST" : bits.at(-1) || "PRAEST");
  const endpoint = endpointFor(path);
  const [rows, setRows] = useState<any[]>([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const id = bits.find((x) => /^[0-9a-f]{8}-/.test(x));

  useEffect(() => {
    if (!shouldFetch(endpoint)) return;
    setLoading(true);
    setErr("");
    api<any>(`${endpoint === "routes" || endpoint === "api-keys" ? endpoint : `resources/${resourceKey(endpoint as string)}`}${id ? `/${id}` : ""}`)
      .then((v) => setRows(Array.isArray(v) ? v : [v]))
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [endpoint, id]);

  const metrics: [string, string][] = useMemo(
    () => [
      ["Surface", human(sec)],
      ["Resource", human(endpoint || title)],
      ["State", loading ? "Loading" : err ? "Attention" : "Ready"],
      ["Mode", path.startsWith("/explorer") ? "Verification" : "Operational"],
    ],
    [sec, endpoint, title, loading, err, path],
  );

  const lifecycle = isLifecyclePath(path);
  const primaryStatus = rows[0]?.status || rows[0]?.state || rows[0]?.outcome || rows[0]?.finality;
  const tone = lifecycle ? toneForStatus(primaryStatus) : undefined;

  return (
    <AppShell path={path} plane={sec}>
      <PageHead
        eyebrow={path.startsWith("/explorer") ? `${path} · public record` : path}
        title={title}
        sub="This surface is part of PRAEST's unified accountability lifecycle. Data is organisation-scoped and actions flow through the same API, evidence, adjudication and settlement state machines used by agents and SDK clients."
        actions={primaryStatus ? <StatusBadge value={primaryStatus} /> : undefined}
      />

      <StatGrid>
        {metrics.map(([l, v]) => (
          <StatCard key={l} label={l} value={v} />
        ))}
      </StatGrid>

      {lifecycle && tone === "provisional" && (
        <div className="provisional-notice">
          <div>
            <strong>Provisional, not final.</strong> {primaryStatus ? human(String(primaryStatus)) : "This state"} is appealable. Cross-chain settlement is authorized only after StudioNet FINALIZED.
          </div>
        </div>
      )}
      {lifecycle && tone === "final" && (
        <div className="finality-notice">
          <div>
            <strong>Finalized.</strong> This record has passed the appeal window and is settlement-authoritative.
          </div>
        </div>
      )}

      {err && <ErrorBanner message={err} />}
      <ActionPanel path={path} endpoint={endpoint} />
      {path.startsWith("/app/escrows/") && id && <EscrowFundingAction escrowId={id} />}

      {loading && !rows.length && <LoadingRows />}
      {!loading && !err && shouldFetch(endpoint) && !rows.length && <EmptyState sub="No records yet for this resource in your organisation." />}
      {rows.length > 0 && <DataTable rows={rows} />}

      <ContextPanel path={path} />
    </AppShell>
  );
}
