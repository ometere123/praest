import type {NextConfig} from "next";

// @privy-io/react-auth's Solana bundle statically imports this optional peer
// dependency; npm places it in apps/web/node_modules rather than hoisting it
// to the workspace root, which Turbopack cannot see from node_modules/@privy-io.
const config:NextConfig={
  // Vercel does its own serverless build tracing/bundling and is incompatible with
  // output:"standalone" (a self-hosted Docker/Node mode) - Vercel's build wrapper looks for
  // .next/next-server.js.nft.json, which standalone mode doesn't produce in the expected shape.
  experimental:{optimizePackageImports:["lucide-react"]},
  turbopack:{resolveAlias:{"@solana-program/memo":"./node_modules/@solana-program/memo"}},
};
export default config;
