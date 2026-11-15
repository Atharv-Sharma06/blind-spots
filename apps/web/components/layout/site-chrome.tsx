"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { SiteHeader } from "./site-header";
import { SiteFooter } from "./site-footer";

/**
 * Root-layout chrome. Only the landing page "/" gets the Reference A header, a <main> and the footer here, on the
 * cream landing canvas. Every other route supplies its own chrome: the app pages wrap themselves in <AppShell>
 * (sidebar + top bar), 404 and the error boundary render the header/shell themselves.
 */
export function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname !== "/") return <>{children}</>;
  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-[linear-gradient(#EDE7DC,#F2EFE8_240px,#F2EFE8_calc(100%-240px),#EDE7DC)] text-fg">
      <SiteHeader />
      <main id="main" tabIndex={-1} className="flex flex-1 flex-col outline-none">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
