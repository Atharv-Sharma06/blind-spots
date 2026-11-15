"use client";

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { isApiError } from "@/lib/api";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        gcTime: 10 * 60_000,
        refetchOnWindowFocus: false,
        // Do not retry answers that will not change; retry transient failures once.
        retry: (count, error) => {
          if (isApiError(error) && ["not_found", "validation_error", "artifact_missing"].includes(error.code)) return false;
          return count < 1;
        },
      },
    },
  });
}

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(makeQueryClient);
  return (
    <QueryClientProvider client={client}>
      <TooltipProvider delayDuration={250} skipDelayDuration={100}>
        {children}
      </TooltipProvider>
    </QueryClientProvider>
  );
}
