import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "@/styles/globals.css";
import { Providers } from "./providers";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { SITE_DESCRIPTION, SITE_TITLE } from "@/lib/copy";

export const metadata: Metadata = {
  title: { default: SITE_TITLE, template: "%s — Blind Spots" },
  description: SITE_DESCRIPTION,
  applicationName: "Blind Spots",
};

export const viewport: Viewport = {
  themeColor: "#fafaf7",
  colorScheme: "light",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="flex min-h-dvh flex-col">
        <a
          href="#main"
          className="sr-only z-50 rounded-md bg-fg px-3 py-2 text-[13px] text-surface focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
        >
          Skip to content
        </a>
        <Providers>
          <SiteHeader />
          <main id="main" className="flex flex-1 flex-col">
            {children}
          </main>
          <SiteFooter />
        </Providers>
      </body>
    </html>
  );
}
