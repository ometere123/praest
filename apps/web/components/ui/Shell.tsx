"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Moon, Sun, X } from "lucide-react";
import { useEffect, useState, type PropsWithChildren, type ReactNode } from "react";
import { nav } from "@/lib/nav";
import { PLANE_LABEL, type Plane, human } from "@/lib/route-meta";
import { BrandMark, BrandWordmark } from "./Brand";
import { Breadcrumbs } from "./Breadcrumbs";

function useTheme() {
  const [theme, setTheme] = useState<"light" | "dark" | null>(null);
  useEffect(() => {
    const stored = (typeof window !== "undefined" && (localStorage.getItem("praest-theme") as "light" | "dark" | null)) || null;
    if (stored) {
      document.documentElement.dataset.theme = stored;
      setTheme(stored);
    }
  }, []);
  function toggle() {
    const next = (theme ?? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")) === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("praest-theme", next);
    } catch {}
    setTheme(next);
  }
  return { theme, toggle };
}

export function AppShell({ path, plane, children }: PropsWithChildren<{ path: string; plane: Plane }>) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const { theme, toggle } = useTheme();
  useEffect(() => setMobileOpen(false), [pathname]);
  useEffect(() => {
    document.documentElement.dataset.plane = plane;
    return () => {
      delete document.documentElement.dataset.plane;
    };
  }, [plane]);

  return (
    <div className="shell" data-plane={plane}>
      <div className="mobile-nav-scrim" data-open={mobileOpen} onClick={() => setMobileOpen(false)} />
      <aside className="sidebar" data-open={mobileOpen}>
        <div className="sidebar-brand">
          <BrandMark size={24} tone={plane === "control" ? "paper" : undefined} />
          <BrandWordmark size={15} />
        </div>
        <div className="sidebar-plane">{PLANE_LABEL[plane]}</div>
        {Object.entries(nav).map(([group, items]) => (
          <div className="nav-group" key={group}>
            <div className="nav-group-label">{human(group)}</div>
            {items.map(([label, hrefLiteral]) => {
              const href: string = hrefLiteral;
              return (
                <Link key={href} className="nav-link" data-active={path === href || (href !== "/" && path.startsWith(href))} href={href}>
                  {label}
                </Link>
              );
            })}
          </div>
        ))}
        <div className="sidebar-foot">
          <span>StudioNet</span>
          <span>v0.1</span>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            <button className="icon-btn mobile-nav-toggle" aria-label="Toggle navigation" onClick={() => setMobileOpen((v) => !v)}>
              {mobileOpen ? <X size={17} /> : <Menu size={17} />}
            </button>
            <div className="topbar-crumb">
              <span className="pill">{plane} plane</span>
            </div>
          </div>
          <div className="topbar-actions">
            <span className="pill">StudioNet</span>
            <button className="icon-btn" aria-label="Toggle theme" onClick={toggle}>
              {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </div>
        </header>
        <main className="content">
          <Breadcrumbs path={path} />
          {children}
        </main>
      </div>
    </div>
  );
}

export function PageHead({ eyebrow, title, sub, actions }: { eyebrow: string; title: string; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="page-head">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1 className="page-title">{title}</h1>
        {sub && <p className="page-sub">{sub}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}
