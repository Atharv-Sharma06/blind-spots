import * as React from "react";
import { cn } from "@/lib/cn";

type DotNumberTag = "span" | "div" | "p" | "strong" | "dd" | "data";

export interface DotNumberProps {
  children?: React.ReactNode;
  className?: string;
  as?: DotNumberTag;
}

/** Big display number: 40 px medium Inter Tight with tight tracking and tabular figures (BizLink style). The text stays
 *  plain text, so screen readers and copy/paste read the number itself. Callers resize it with their own text-[..]
 *  class; small numbers keep the `num` utility. */
export function DotNumber({ children, className, as = "span" }: DotNumberProps) {
  const Comp = as;
  return <Comp className={cn("dotnum text-[40px] leading-none font-medium tabular-nums", className)}>{children}</Comp>;
}
