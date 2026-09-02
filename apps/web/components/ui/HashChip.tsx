"use client";
import { Check, Copy } from "lucide-react";
import { useState } from "react";

export function HashChip({ value, truncate = 14 }: { value: string; truncate?: number }) {
  const [copied, setCopied] = useState(false);
  const display = value.length > truncate * 2 + 3 ? `${value.slice(0, truncate)}…${value.slice(-6)}` : value;
  return (
    <span className="hash-chip">
      {display}
      <button
        type="button"
        aria-label="Copy full value"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
          } catch {}
        }}
      >
        {copied ? <Check size={12} /> : <Copy size={12} />}
      </button>
    </span>
  );
}
