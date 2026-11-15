import type { Metadata, Viewport } from "next";
import { preload } from "react-dom";
import { Outfit, Doto } from "next/font/google";
import { GeistMono } from "geist/font/mono";
import "@/styles/globals.css";
import { Providers } from "./providers";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { SITE_QUESTION } from "@/lib/copy";

// Outfit (rounded geometric sans) for words, Doto (dot-matrix) for big display numbers; Geist Mono stays for small numbers.
const outfit = Outfit({ subsets: ["latin"], weight: "variable", variable: "--font-outfit", display: "swap" });
const doto = Doto({ subsets: ["latin"], weight: "variable", axes: ["ROND"], variable: "--font-doto", display: "swap" });

// Short title and description: the product question, then one line.
const TITLE = "Blind Spots";
const DESCRIPTION = `${SITE_QUESTION} Pick a cabin and see.`;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL;

// The diamond mark as an inline SVG favicon (no extra file, no logo of any agency).
const ICON =
  "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" rx="4" fill="#08080a"/><path d="M8 1.6 14.4 8 8 14.4 1.6 8Z" fill="none" stroke="#f4f4f5" stroke-width="1.4"/><path d="M8 5.4 10.6 8 8 10.6 5.4 8Z" fill="#f2d21b"/></svg>',
  );

export const metadata: Metadata = {
  ...(SITE_URL ? { metadataBase: new URL(SITE_URL) } : {}),
  title: { default: TITLE, template: "%s — Blind Spots" },
  description: DESCRIPTION,
  applicationName: "Blind Spots",
  icons: { icon: ICON },
  openGraph: { title: TITLE, description: DESCRIPTION, siteName: "Blind Spots", type: "website" },
  twitter: { card: "summary", title: TITLE, description: DESCRIPTION },
  generator: "SI-assisted: built with Claude (Anthropic)",
  other: {
    "si-disclosure":
      "SI-assisted project: code, text and data-curation tables were written with Claude (Anthropic) and reviewed by the team; every number is computed from NASA data. Demo media carry a visible SI label. No NASA branding is used.",
  },
};

export const viewport: Viewport = {
  themeColor: "#08080a",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // a04-06: snapshot builds start the manifest fetch with the HTML (<link rel="preload" as="fetch">, emitted once by
  // React); lib/api.ts reuses it because the manifest request is a plain GET without custom headers.
  if (process.env.NEXT_PUBLIC_DATA_MODE === "snapshot") preload("/snapshot/manifest.json", { as: "fetch", crossOrigin: "anonymous" });
  return (
    <html lang="en" className={`${outfit.variable} ${doto.variable} ${GeistMono.variable}`}>
      <body className="bg-dots flex min-h-dvh flex-col">
        <a
          href="#main"
          className="sr-only z-50 rounded-full bg-accent text-ui font-semibold text-on-accent focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:px-3 focus:py-2"
        >
          Skip to content
        </a>
        <Providers>
          <SiteHeader />
          <main id="main" tabIndex={-1} className="flex flex-1 flex-col outline-none">
            {children}
          </main>
          <SiteFooter />
        </Providers>
      </body>
    </html>
  );
}
