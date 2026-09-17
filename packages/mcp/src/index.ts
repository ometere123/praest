import {McpServer} from "@modelcontextprotocol/server";
import {serveStdio} from "@modelcontextprotocol/server/stdio";
import * as z from "zod/v4";
import {STUDIO_DEV} from "@praest/sdk";

const result = (x: unknown) => ({content: [{type: "text" as const, text: JSON.stringify(x, null, 2)}], structuredContent: x});
serveStdio(() => {
  const s = new McpServer({name: "praest-direct", version: "0.2.0"}, {instructions: "PRAEST is direct-contract on Studio-dev (61997). ACCEPTED is provisional; require FINALIZED plus FINISHED_WITH_RETURN before claiming success."});
  s.registerTool("praest_network", {description: "Return the canonical PRAEST network configuration", inputSchema: z.object({})}, async () => result(STUDIO_DEV));
  s.registerTool("praest_prepare_agreement", {description: "Prepare bounded AgreementVault fields for a user wallet to sign", inputSchema: z.object({agreementId: z.string().min(1).max(128), termsCommitment: z.string().min(8), evidenceCommitment: z.string().min(8), outcomes: z.array(z.string()).min(1).max(8)})}, async (x) => result({network: STUDIO_DEV, contract: "PRAESTAgreementVault", ...x, signer: "injected-wallet-required", status: "READY_FOR_SIGNATURE"}));
  return s;
}, {legacy: "reject", onerror: (e: Error) => { console.error(e); process.exit(1); }});
