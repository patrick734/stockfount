import type { Metadata } from "next";
import { Fraunces, IBM_Plex_Mono, Inter } from "next/font/google";
import type { ReactNode } from "react";
import { Header } from "@/components/Header";
import { Providers } from "@/components/Providers";
import "./globals.css";

const display = Fraunces({ subsets: ["latin"], variable: "--font-display", display: "swap" });
const body = Inter({ subsets: ["latin"], variable: "--font-body", display: "swap" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-mono", display: "swap" });

// Absolute base for link-preview images. NEXT_PUBLIC_SITE_URL overrides the production domain.
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://stockfount.fun";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "StockFount",
  openGraph: {
    title: "StockFount",
    description: "Liquidity for tokenized stocks on Robinhood Chain, with nobody holding the keys.",
    siteName: "StockFount",
    type: "website",
  },
  twitter: { card: "summary_large_image", title: "StockFount", description: "Liquidity for tokenized stocks on Robinhood Chain, with nobody holding the keys." },
  description:
    "Deposit USDG into a Fount. StockFount provides oracle-guarded liquidity for tokenized stocks on Robinhood Chain, pays 70% of trading fees to depositors, and burns $FOUNT with the rest. Every admin action waits 48 hours in a public timelock.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>
        <Providers>
          <Header />
          <main>{children}</main>
          <footer className="footer">
            <span>StockFount. Independent software, not affiliated with Robinhood, Uniswap or any issuer.</span>
            <span className="num">Robinhood Chain · Uniswap v4 · Chainlink · 48h timelock</span>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
