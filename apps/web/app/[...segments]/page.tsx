import { notFound } from "next/navigation";
import { routes } from "@praest/config";
import { withAuth } from "@workos-inc/authkit-nextjs";
import ConsoleRouter from "@/components/console/ConsoleRouter";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { PublicPage } from "@/components/marketing/PublicPage";

const publicPaths = new Set(["/about", "/how-it-works", "/pricing", "/developers", "/docs", "/security", "/status"]);
const known = new Set(Object.values(routes as any).flat());
// routes.json is a frozen, developer-controlled config (not user input), and each
// pattern is bounded (no nested quantifiers), so this is not attacker-reachable ReDoS.
// nosemgrep: javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp
const routeMatchers = [...known].map((r: any) => new RegExp("^" + String(r).replace(/\[[^\]]+\]/g, "[^/]+") + "$"));

export default async function Page({ params }: { params: Promise<{ segments?: string[] }> }) {
  const { segments = [] } = await params;
  const path = "/" + segments.join("/");

  if (publicPaths.has(path)) {
    return (
      <MarketingShell>
        <PublicPage slug={path.slice(1)} />
      </MarketingShell>
    );
  }

  await withAuth({ ensureSignedIn: true });

  const match = routeMatchers.some((re) => re.test(path));
  if (!match && !path.startsWith("/app") && !path.startsWith("/control") && !path.startsWith("/developer") && !path.startsWith("/explorer")) notFound();

  return <ConsoleRouter path={path} />;
}
