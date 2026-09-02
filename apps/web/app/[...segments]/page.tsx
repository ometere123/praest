import { notFound } from "next/navigation";
import { routes } from "@praest/config";
import { withAuth } from "@workos-inc/authkit-nextjs";
import ConsoleRouter from "@/components/console/ConsoleRouter";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { PublicPage } from "@/components/marketing/PublicPage";

const publicPaths = new Set(["/about", "/how-it-works", "/pricing", "/developers", "/docs", "/security", "/status"]);
const known = new Set(Object.values(routes as any).flat());

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

  const match = [...known].some((r: any) => {
    const pattern = "^" + String(r).replace(/\[[^\]]+\]/g, "[^/]+") + "$";
    return new RegExp(pattern).test(path);
  });
  if (!match && !path.startsWith("/app") && !path.startsWith("/control") && !path.startsWith("/developer") && !path.startsWith("/explorer")) notFound();

  return <ConsoleRouter path={path} />;
}
