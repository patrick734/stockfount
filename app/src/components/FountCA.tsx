"use client";

import { useState } from "react";
import { FOUNT_CA, tradeUrl } from "@/lib/links";

/** The $FOUNT contract address with copy and buy buttons. */
export function FountCA() {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(FOUNT_CA);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  }
  return (
    <div className="ca">
      <span className="ca-label">$FOUNT CA</span>
      <code className="ca-addr">{FOUNT_CA}</code>
      <span className="ca-actions">
        <button type="button" className="btn btn-sm" onClick={copy}>
          {copied ? "Copied ✓" : "Copy"}
        </button>
        <a className="btn btn-sm btn-primary" href={tradeUrl(FOUNT_CA)} target="_blank" rel="noreferrer">
          Buy on Pons ↗
        </a>
      </span>
    </div>
  );
}
