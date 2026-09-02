import Image from "next/image";

/**
 * The icon PNGs are transparent-background glyphs; the wordmark PNGs are
 * opaque social-card lockups (own baked-in fill) and are used only as
 * metadata images (favicon/OG), never as inline UI chrome.
 */
export function BrandMark({ size = 28, tone }: { size?: number; tone?: "ink" | "paper" }) {
  if (tone) {
    return (
      <Image
        src={tone === "paper" ? "/brand/icon-paper.png" : "/brand/icon-ink.png"}
        alt=""
        width={size}
        height={size}
        className="brand-mark-fixed"
        priority
      />
    );
  }
  return (
    <>
      <Image src="/brand/icon-ink.png" alt="" width={size} height={size} className="brand-mark brand-mark-light" priority />
      <Image src="/brand/icon-paper.png" alt="" width={size} height={size} className="brand-mark brand-mark-dark" priority />
      <style>{`
        .brand-mark,.brand-mark-fixed{border-radius:5px;flex-shrink:0}
        .brand-mark-dark{display:none}
        :root[data-theme="dark"] .brand-mark-light{display:none}
        :root[data-theme="dark"] .brand-mark-dark{display:block}
        @media (prefers-color-scheme: dark){
          :root:not([data-theme="light"]) .brand-mark-light{display:none}
          :root:not([data-theme="light"]) .brand-mark-dark{display:block}
        }
      `}</style>
    </>
  );
}

export function BrandWordmark({ size = 16 }: { size?: number }) {
  return (
    <span
      className="mono"
      style={{
        fontFamily: "var(--font-sans)",
        fontWeight: 800,
        fontSize: size,
        letterSpacing: "0.01em",
        lineHeight: 1,
      }}
    >
      PRAEST
    </span>
  );
}
