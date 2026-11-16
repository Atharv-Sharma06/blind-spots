import type { Metadata, Viewport } from "next";
import { preload } from "react-dom";
import { Inter_Tight } from "next/font/google";
import { GeistMono } from "geist/font/mono";
import "@/styles/globals.css";
import { Providers } from "./providers";
import { SiteChrome } from "@/components/layout/site-chrome";
import { SITE_QUESTION } from "@/lib/copy";

// Inter Tight for everything (400-800); Geist Mono stays for small numbers.
const interTight = Inter_Tight({ subsets: ["latin"], weight: "variable", variable: "--font-inter-tight", display: "swap" });

// Short title and description: the product question, then one line.
const TITLE = "Blind Spots";
const DESCRIPTION = `${SITE_QUESTION} Pick a cabin and see.`;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL;

// The diamond mark as an inline SVG favicon (no extra file, no logo of any agency).
const ICON =
  "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" rx="8" fill="#161616"/><path d="M8 2.6 13.4 8 8 13.4 2.6 8Z" fill="none" stroke="#ffffff" stroke-width="1.3"/><path d="M8 5.6 10.4 8 8 10.4 5.6 8Z" fill="#2fd067"/></svg>',
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
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F7F6F3" },
    { media: "(prefers-color-scheme: dark)", color: "#0F0F0E" },
  ],
  colorScheme: "light dark",
};

// Runs before first paint (no flash): theme = localStorage "bs-theme" (dark | light), else the OS preference.
// localStorage can throw (private window, blocked site data), so every read is guarded.
const THEME_BOOT_SCRIPT = `(function(){var d=document.documentElement,t=null;try{t=localStorage.getItem("bs-theme")}catch(e){}if(t!=="dark"&&t!=="light"){try{t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}catch(e){t="light"}}d.setAttribute("data-theme",t);d.style.colorScheme=t})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // a04-06: snapshot builds start the manifest fetch with the HTML (<link rel="preload" as="fetch">, emitted once by
  // React); lib/api.ts reuses it because the manifest request is a plain GET without custom headers.
  if (process.env.NEXT_PUBLIC_DATA_MODE === "snapshot") preload("/snapshot/manifest.json", { as: "fetch", crossOrigin: "anonymous" });
  return (
    <html lang="en" className={`${interTight.variable} ${GeistMono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body className="flex min-h-dvh flex-col bg-bg text-fg">
        <a
          href="#main"
          className="sr-only z-[60] rounded-full bg-fg text-ui font-medium text-on-ink focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:px-4 focus:py-2.5"
        >
          Skip to content
        </a>
        <Providers>
          {/* "/" gets the landing header, <main> and footer here; app pages wrap themselves in <AppShell>; 404 and the error
              boundary bring their own chrome. */}
          <SiteChrome>{children}</SiteChrome>
        </Providers>
      </body>
    </html>
  );
}
