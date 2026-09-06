import {Pool} from "pg";
import {drizzle} from "drizzle-orm/node-postgres";
export * from "./schema.js";

/**
 * TLS policy for the Postgres connection. Verification stays ON by default - a managed provider
 * whose chain Node already trusts needs no configuration here.
 *
 * Two escape hatches, in order of preference:
 *  - DATABASE_CA_CERT: PEM of the provider's CA. Verification stays on and is actually correct.
 *    This is the right fix for Supabase/RDS/etc., whose pooler chains Node does not ship.
 *  - DATABASE_SSL_REJECT_UNAUTHORIZED=false: encrypted but unverified. Use only when the CA PEM
 *    is not available; it accepts any certificate, so it does not protect against an active MITM.
 *
 * Set exactly one. Local connections skip TLS entirely.
 */
function sslConfig(url: string) {
  if (url.includes("localhost") || url.includes("127.0.0.1")) return false as const;
  if (process.env.DATABASE_SSL === "disable") return false as const;
  const ca = process.env.DATABASE_CA_CERT;
  if (ca) return {ca, rejectUnauthorized: true};
  return {rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== "false"};
}

export function createDatabase(url = process.env.DATABASE_URL) {
  if (!url) throw new Error("DATABASE_URL is required");
  const pool = new Pool({connectionString: url, max: 10, ssl: sslConfig(url)});
  return {db: drizzle(pool), pool};
}
