import * as React from "react";
import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";
import { TableHead } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { SortConfig } from "@/hooks/use-sortable-data";

interface SortableTableHeadProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  sortKey: string;
  sortConfig: SortConfig;
  onSort: (key: string) => void;
}

export const SortableTableHead = React.forwardRef<HTMLTableCellElement, SortableTableHeadProps>(
  ({ sortKey, sortConfig, onSort, className, children, ...props }, ref) => {
    const active = sortConfig.key === sortKey && sortConfig.direction !== null;
    const direction = active ? sortConfig.direction : null;

    return (
      <TableHead ref={ref} className={cn("select-none", className)} {...props}>
        <button
          type="button"
          onClick={() => onSort(sortKey)}
          className="inline-flex items-center gap-1 cursor-pointer hover:opacity-80 transition-opacity uppercase tracking-wide font-semibold text-xs text-primary"
        >
          <span>{children}</span>
          {direction === "asc" ? (
            <ChevronUp className="h-3.5 w-3.5 text-primary" strokeWidth={2.5} />
          ) : direction === "desc" ? (
            <ChevronDown className="h-3.5 w-3.5 text-primary" strokeWidth={2.5} />
          ) : (
            <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground/60" />
          )}
        </button>
      </TableHead>
    );
  },
);
SortableTableHead.displayName = "SortableTableHead";
