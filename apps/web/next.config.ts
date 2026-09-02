import type {NextConfig} from "next";

// @privy-io/react-auth's Solana bundle statically imports this optional peer
// dependency; npm places it in apps/web/node_modules rather than hoisting it
// to the workspace root, which Turbopack cannot see from node_modules/@privy-io.
const config:NextConfig={
  output:"standalone",
  experimental:{optimizePackageImports:["lucide-react"]},
  turbopack:{resolveAlias:{"@solana-program/memo":"./node_modules/@solana-program/memo"}},
};
export default config;
