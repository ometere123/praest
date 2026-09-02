import Link from "next/link";
import type { PropsWithChildren } from "react";
import { BrandMark, BrandWordmark } from "@/components/ui/Brand";

const NAV: [string, string][] = [
  ["How it works", "/how-it-works"],
  ["Pricing", "/pricing"],
  ["Developers", "/developers"],
  ["Docs", "/docs"],
  ["Security", "/security"],
  ["Status", "/status"],
];

export function MarketingShell({ children }: PropsWithChildren) {
  return (
    <div className="mkt">
      <header className="mkt-header">
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <BrandMark size={26} />
          <BrandWordmark size={16} />
        </Link>
        <nav className="mkt-nav">
          <div className="mkt-nav-links">
            {NAV.map(([label, href]) => (
              <Link key={href} href={href}>
                {label}
              </Link>
            ))}
          </div>
          <div className="mkt-header-actions">
            <Link className="btn ghost sm" href="/login">
              Sign in
            </Link>
            <Link className="btn primary sm" href="/signup">
              Get started
            </Link>
          </div>
        </nav>
      </header>
      <main className="mkt-main">{children}</main>
      <footer className="mkt-footer">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <BrandMark size={18} />
          <span>© {new Date().getFullYear()} PRAEST. Accountability layer for autonomous services.</span>
        </div>
        <div className="mkt-footer-links">
          {NAV.map(([label, href]) => (
            <Link key={href} href={href}>
              {label}
            </Link>
          ))}
          <Link href="/about">About</Link>
        </div>
      </footer>
    </div>
  );
}
