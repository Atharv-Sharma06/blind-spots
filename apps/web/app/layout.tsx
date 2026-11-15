import type { Metadata, Viewport } from "next";
import { preload } from "react-dom";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "@/styles/globals.css";
import { Providers } from "./providers";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { SITE_DESCRIPTION, SITE_TITLE } from "@/lib/copy";

// Site title and description (plain-language redesign, see lib/copy.ts).
const TITLE = SITE_TITLE;
const DESCRIPTION = SITE_DESCRIPTION;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL;

// The diamond mark as an inline SVG favicon (no extra file, no logo of any agency).
const ICON =
  "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" rx="3" fill="#fafaf7"/><path d="M8 1.6 14.4 8 8 14.4 1.6 8Z" fill="none" stroke="#17171a" stroke-width="1.4"/><path d="M8 5.4 10.6 8 8 10.6 5.4 8Z" fill="#0e7c66"/></svg>',
  );

export const metadata: Metadata = {
  ...(SITE_URL ? { metadataBase: new URL(SITE_URL) } : {}),
  title: { default: TITLE, template: "%s — Blind Spots" },
  description: DESCRIPTION,
  applicationName: "Blind Spots",
  icons: { icon: ICON },
  openGraph: { title: TITLE, description: DESCRIPTION, siteName: "Blind Spots", type: "website" },
  twitter: { card: "summary", title: TITLE, description: DESCRIPTION },
};

export const viewport: Viewport = {
  themeColor: "#fafaf7",
  colorScheme: "light",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // a04-06: snapshot builds start the manifest fetch with the HTML (<link rel="preload" as="fetch">, emitted once by
  // React); lib/api.ts reuses it because the manifest request is a plain GET without custom headers.
  if (process.env.NEXT_PUBLIC_DATA_MODE === "snapshot") preload("/snapshot/manifest.json", { as: "fetch", crossOrigin: "anonymous" });
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="flex min-h-dvh flex-col">
        <a
          href="#main"
          className="sr-only z-50 rounded-md bg-fg text-ui font-medium text-surface focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:px-3 focus:py-2"
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
