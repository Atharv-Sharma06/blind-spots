import * as React from "react";
import { cn } from "@/lib/cn";

export interface TableProps extends React.TableHTMLAttributes<HTMLTableElement> {
  /** Classes for the scroll container. Give it a max height (e.g. "max-h-[60vh]") to enable the sticky header. */
  containerClassName?: string;
}

/** Compact data table. The header sticks to the top of the scroll container. */
export const Table = React.forwardRef<HTMLTableElement, TableProps>(({ className, containerClassName, ...props }, ref) => (
  <div tabIndex={0} role="region" aria-label={props["aria-label"] ? `${props["aria-label"]} (scrollable)` : "Scrollable table"} className={cn("relative w-full overflow-auto rounded-lg border border-white/[0.06] bg-[#141416] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent", containerClassName)}>
    <table ref={ref} className={cn("w-full caption-bottom border-separate border-spacing-0 text-ui", className)} {...props} />
  </div>
));
Table.displayName = "Table";

export const TableHeader = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>((props, ref) => (
  <thead ref={ref} {...props} />
));
TableHeader.displayName = "TableHeader";

export const TableBody = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>((props, ref) => (
  <tbody ref={ref} {...props} />
));
TableBody.displayName = "TableBody";

export const TableRow = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn("transition-colors hover:bg-white/[0.04] data-[state=selected]:bg-accent-tint [&:last-child>td]:border-b-0", className)}
    {...props}
  />
));
TableRow.displayName = "TableRow";

export interface TableCellProps {
  /** Right-aligned, mono, tabular figures. Use for every measured value. */
  numeric?: boolean;
}

export const TableHead = React.forwardRef<HTMLTableCellElement, React.ThHTMLAttributes<HTMLTableCellElement> & TableCellProps>(
  ({ className, numeric, scope = "col", ...props }, ref) => (
    <th
      ref={ref}
      scope={scope}
      className={cn(
        "sticky top-0 z-10 h-10 whitespace-nowrap border-b border-border bg-[#1a1a1d] px-3.5 text-left text-xs font-medium text-muted",
        numeric && "text-right",
        className,
      )}
      {...props}
    />
  ),
);
TableHead.displayName = "TableHead";

export const TableCell = React.forwardRef<HTMLTableCellElement, React.TdHTMLAttributes<HTMLTableCellElement> & TableCellProps>(
  ({ className, numeric, ...props }, ref) => (
    <td
      ref={ref}
      className={cn("h-10 border-b border-border px-3.5 align-middle", numeric && "num text-right", className)}
      {...props}
    />
  ),
);
TableCell.displayName = "TableCell";

export const TableCaption = React.forwardRef<HTMLTableCaptionElement, React.HTMLAttributes<HTMLTableCaptionElement>>(({ className, ...props }, ref) => (
  <caption ref={ref} className={cn("px-3 py-2 text-left text-xs text-muted", className)} {...props} />
));
TableCaption.displayName = "TableCaption";
