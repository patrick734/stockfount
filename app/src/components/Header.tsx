"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ConnectButton } from "./ConnectButton";
import { MarketChip } from "./MarketChip";

const NAV = [
  { href: "/founts", label: "Founts" },
  { href: "/safety", label: "Safety" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/docs", label: "Docs" },
];

export function Header() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);
  return (
    <header className="header">
      <Link href="/" className="brand">
        <svg className="brand-mark" viewBox="0 0 100 100" aria-hidden>
          <path d="M50 4 C50 4 16 44 16 64 A34 34 0 0 0 84 64 C84 44 50 4 50 4 Z" />
          <path d="M34 62 a17 17 0 0 0 12 20" className="brand-mark-shine" />
        </svg>
        StockFount
      </Link>
      <nav id="site-nav" className={open ? "nav open" : "nav"}>
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} className={pathname.startsWith(n.href) ? "active" : undefined}>
            {n.label}
          </Link>
        ))}
        {open && <MarketChip />}
      </nav>
      <MarketChip />
      <ConnectButton />
      <button
        className="menu-btn"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        aria-controls="site-nav"
        onClick={() => setOpen((o) => !o)}
      >
        {open ? "✕" : "☰"}
      </button>
    </header>
  );
}
