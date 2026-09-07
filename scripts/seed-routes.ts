import {createDatabase, chainRoutes} from "@praest/database";
import {chains} from "@praest/config";
import {existsSync, readFileSync} from "node:fs";

// No top-level await: the repo root has no "type": "module", so tsx transforms this file as CJS
// and top-level await is a hard error there. Wrapping in main() keeps the script runnable under
// both module systems.
async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL required");

  const deployments = existsSync("deployments/evm.json")
    ? JSON.parse(readFileSync("deployments/evm.json", "utf8"))
    : {routes: {}};

  const {db, pool} = createDatabase(process.env.DATABASE_URL);
  try {
    for (const c of chains as any[]) {
      const d = deployments.routes?.[c.key] || {};
      const row = {
        key: c.key,
        displayName: c.displayName,
        protocol: c.protocol,
        chainId: String(c.chainId),
        domainId: Number(c.domainId),
        mailbox: c.mailbox,
        ism: c.ism || d.ism || null,
        receiver: d.receiver || null,
        escrowContract: d.escrow || null,
        rpcEnv: c.rpcEnv,
        explorer: c.explorer || null,
        metadata: {
          role: d.role || c.role,
          gateway: d.gateway || null,
          settlementToken: d.settlementToken || null,
          // "direct" settles straight to the receiver with no Hyperlane message; "hyperlane"
          // routes through the Mailbox and its ISM. The bridge reads this rather than inferring a
          // transport, so a misconfigured route fails loudly instead of silently picking one.
          settlementMode: d.settlementMode || null,
          source: "hyperlane-registry",
          seededAt: new Date().toISOString(),
        },
      };
      await db
        .insert(chainRoutes)
        .values(row)
        .onConflictDoUpdate({
          target: chainRoutes.key,
          set: {...row, updatedAt: new Date()},
        });
      const wired = d.escrow ? `escrow=${d.escrow}` : d.gateway ? `gateway=${d.gateway}` : "no contracts";
      console.log(`seeded ${c.key.padEnd(17)} ${wired}`);
    }
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
