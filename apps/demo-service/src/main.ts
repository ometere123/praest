/**
 * The monitored provider for PRAEST's end-to-end proof.
 *
 * This is the *counterparty*, not part of PRAEST. It exists so an outage can be real: real DNS,
 * real TLS, real timeouts, observed from several regions by independent probes. If PRAEST's
 * evidence came from a flag set inside PRAEST, the whole claim would be self-reported and the
 * proof would be worthless.
 *
 * It also publishes a status page, because that is what makes the case worth sending to GenLayer.
 * A hard outage is deterministic - software can count failures and needs no judgement. The
 * interesting case is a provider claiming a maintenance exclusion whose notice may or may not have
 * met the agreement's notice period. That question is about language and evidence, not arithmetic.
 */
import {createServer} from "node:http";

type Mode = "ok" | "error" | "slow" | "down";

const PORT = Number(process.env.PORT || 8080);
const ADMIN_TOKEN = process.env.DEMO_ADMIN_TOKEN || "";
const SLOW_MS = Number(process.env.DEMO_SLOW_MS || 9000);

let mode: Mode = "ok";
let modeSince = new Date();

/** Maintenance notice the provider claims. Set via /admin/maintenance; deliberately separate from
 *  the actual outage so the announced time and the real downtime can disagree. */
let maintenance: {announcedAt: string; startsAt: string; endsAt: string; reason: string} | null = null;

const json = (res: any, status: number, body: unknown) => {
  const payload = JSON.stringify(body, null, 2);
  res.writeHead(status, {"content-type": "application/json", "cache-control": "no-store"});
  res.end(payload);
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const server = createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  const path = url.pathname;

  // --- operator controls (not part of the monitored surface) ---
  if (path === "/admin/mode" && req.method === "POST") {
    if (!ADMIN_TOKEN || url.searchParams.get("token") !== ADMIN_TOKEN) return json(res, 403, {error: "forbidden"});
    const next = url.searchParams.get("mode") as Mode;
    if (!["ok", "error", "slow", "down"].includes(next)) return json(res, 400, {error: "mode must be ok|error|slow|down"});
    mode = next;
    modeSince = new Date();
    console.log(`mode -> ${mode} at ${modeSince.toISOString()}`);
    return json(res, 200, {mode, modeSince: modeSince.toISOString()});
  }

  if (path === "/admin/maintenance" && req.method === "POST") {
    if (!ADMIN_TOKEN || url.searchParams.get("token") !== ADMIN_TOKEN) return json(res, 403, {error: "forbidden"});
    const announcedAt = url.searchParams.get("announcedAt") || new Date().toISOString();
    const startsAt = url.searchParams.get("startsAt") || new Date().toISOString();
    const endsAt = url.searchParams.get("endsAt") || new Date(Date.now() + 3_600_000).toISOString();
    const reason = url.searchParams.get("reason") || "Scheduled maintenance";
    maintenance = {announcedAt, startsAt, endsAt, reason};
    console.log("maintenance notice published:", JSON.stringify(maintenance));
    return json(res, 200, maintenance);
  }

  // --- the provider's public status page, independently readable ---
  // PRAEST reads this rather than taking the provider's word in a support ticket. GenLayer
  // validators can fetch it too, which is the point: the notice timestamp is public evidence.
  if (path === "/status") {
    return json(res, 200, {
      service: "praest-demo-provider",
      currentMode: mode,
      modeSince: modeSince.toISOString(),
      maintenance,
      note: "Maintenance windows are excluded from availability only when announced at least 48 hours in advance.",
    });
  }

  // --- the monitored surface ---
  if (mode === "down") {
    // Abort without a response: a real connection failure, not a polite error body.
    req.socket.destroy();
    return;
  }
  if (mode === "error") {
    return json(res, 500, {error: "internal error", mode, since: modeSince.toISOString()});
  }
  if (mode === "slow") {
    await sleep(SLOW_MS);
    return json(res, 200, {ok: true, degraded: true, waitedMs: SLOW_MS});
  }

  return json(res, 200, {ok: true, service: "praest-demo-provider", path, time: new Date().toISOString()});
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`praest-demo-provider listening on ${PORT} (mode=${mode})`);
  if (!ADMIN_TOKEN) console.warn("DEMO_ADMIN_TOKEN unset - admin routes are disabled");
});
