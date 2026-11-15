import * as React from "react";
import { cn } from "@/lib/cn";

type DotNumberTag = "span" | "div" | "p" | "strong" | "dd" | "data";

export interface DotNumberProps {
  children?: React.ReactNode;
  className?: string;
  as?: DotNumberTag;
}

/** The dot-matrix face draws "%", minus signs and decimal points as unreadable dot clusters, so those characters are
 *  split out and set in the plain sans face. Digits (and spaces) stay in the dot face. */
const SIGN_OR_PERCENT = /([%−–+-])/;
const POINT = /([.,])/;

function renderSymbols(text: string, keyPrefix: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  text.split(SIGN_OR_PERCENT).forEach((part, i) => {
    if (part === "") return;
    if (i % 2 === 1) {
      out.push(
        <span key={`${keyPrefix}s${i}`} className="inline-block align-[0.12em] font-sans text-[0.72em] font-semibold">
          {part}
        </span>,
      );
      return;
    }
    part.split(POINT).forEach((piece, j) => {
      if (piece === "") return;
      if (j % 2 === 1) {
        out.push(
          <span key={`${keyPrefix}p${i}-${j}`} className="font-sans font-semibold">
            {piece}
          </span>,
        );
      } else {
        out.push(piece);
      }
    });
  });
  return out;
}

function renderChildren(children: React.ReactNode): React.ReactNode {
  return React.Children.map(children, (child, idx) => {
    if (typeof child === "string" || typeof child === "number") {
      return <React.Fragment key={idx}>{renderSymbols(String(child), `c${idx}`)}</React.Fragment>;
    }
    return child;
  });
}

/** Big display number in the dot-matrix (LED) face. The text stays plain text, so screen readers and copy/paste read the
 *  number itself. Use only at 28 px and up; small numbers keep the `num` utility. */
export function DotNumber({ children, className, as = "span" }: DotNumberProps) {
  const Comp = as;
  return <Comp className={cn("dotnum tabular-nums", className)}>{renderChildren(children)}</Comp>;
}
