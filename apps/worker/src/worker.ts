// PRAEST scheduler. Replaces the Temporal worker: the three workflows PRAEST actually used
// (monitorLoop, webhookSweep, caseLifecycle's timer tail) were all "call the API, sleep, repeat",
// so they are plain interval loops here. Durable state still lives in Postgres and each sweep
// endpoint is idempotent, so a restart re-picks-up work rather than losing it.
//
// A sweep failure is logged and the loop continues - a collector failing is not the service
// failing (AGENTS.md). Each loop is independent: one wedged sweep cannot stall the others.
import { activities } from "./activities.js";

type Sweep = { name: string; intervalMs: number; run: () => Promise<unknown> };

const num = (v: string | undefined, d: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : d;
};

const sweeps: Sweep[] = [
  {
    name: "monitors",
    intervalMs: num(process.env.WORKER_MONITOR_SWEEP_MS, 60_000),
    run: activities.sweepMonitors,
  },
  {
    name: "webhooks",
    intervalMs: num(process.env.WORKER_WEBHOOK_SWEEP_MS, 15_000),
    run: activities.sweepWebhooks,
  },
  {
    name: "adjudications",
    intervalMs: num(process.env.WORKER_FINALIZE_SWEEP_MS, 30_000),
    run: activities.sweepAdjudications,
  },
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let running = true;

async function loop(s: Sweep) {
  while (running) {
    const started = Date.now();
    try {
      const result = await s.run();
      console.log(`[${s.name}] ok ${Date.now() - started}ms`, JSON.stringify(result ?? null));
    } catch (e: any) {
      console.error(`[${s.name}] failed after ${Date.now() - started}ms:`, e?.message || e);
    }
    if (!running) break;
    await sleep(s.intervalMs);
  }
}

async function main() {
  if (!process.env.PRAEST_INTERNAL_TOKEN) throw new Error("PRAEST_INTERNAL_TOKEN required");
  console.log(
    "praest-worker starting:",
    sweeps.map((s) => `${s.name}@${s.intervalMs}ms`).join(" "),
  );
  for (const sig of ["SIGTERM", "SIGINT"] as const) {
    process.on(sig, () => {
      console.log(`${sig} received, draining`);
      running = false;
    });
  }
  await Promise.all(sweeps.map(loop));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
