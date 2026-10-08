import { useState } from "react";
import { Icon } from "@/components/icon";
import { Button } from "@/ui/button";
import { cn } from "@/utils";

export interface GridColumn {
  label: string;
  /** Renders the header with Marley's red asterisk. */
  required?: boolean;
  /** Tailwind width class, e.g. `w-64`. Omit to let the column flex. */
  width?: string;
}

interface EncounterGridProps {
  columns: GridColumn[];
  /** Number of data rows currently in the table. */
  count: number;
  onAdd: () => void;
  addLabel?: string;
  /** One `<tr>` per row, in row order (row views render their own detail rows). */
  children: React.ReactNode;
  /** Hide the leading checkbox gutter (Marley's row-select column). */
  selectable?: boolean;
  emptyText?: string;
}

/**
 * The Frappe child-table shell: a checkbox gutter, an auto "No." column, the
 * caller's columns, a delete/expand action column, a "No rows" placeholder and
 * the "Add row" button underneath.
 *
 * Used for every grid on the encounter form (Medical Coding, Medications,
 * Investigations, Procedures, Rehabilitation) so they read as one family.
 */
export default function EncounterGrid({
  columns,
  count,
  onAdd,
  addLabel = "+ Add",
  children,
  selectable = false,
  emptyText = "No rows",
}: EncounterGridProps) {
  // checkbox gutter (optional) + "No." + the caller's columns + the actions column
  const totalCols = (selectable ? 1 : 0) + 2 + columns.length;

  return (
    <div>
      <div className="border rounded-md overflow-x-auto bg-card shadow-xs">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-muted/90 backdrop-blur-xs border-b">
            <tr>
              {selectable && (
                <th className="px-2 py-2 text-left w-8">
                  <input type="checkbox" className="rounded" />
                </th>
              )}
              <th className="px-2 py-2.5 text-center w-10 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                No.
              </th>
              {columns.map((c) => (
                <th
                  key={c.label}
                  className={cn(
                    "px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap",
                    c.width
                  )}
                >
                  {c.label} {c.required && <span className="text-destructive">*</span>}
                </th>
              ))}
              <th className="px-3 py-2.5 w-16 text-right" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {count === 0 ? (
              <tr>
                <td colSpan={totalCols} className="px-3 py-8 text-center text-sm text-muted-foreground">
                  <div className="flex flex-col items-center justify-center gap-1.5">
                    <Icon icon="solar:notes-minimalistic-linear" size={24} className="text-muted-foreground/40" />
                    <span>{emptyText}</span>
                  </div>
                </td>
              </tr>
            ) : (
              children
            )}
          </tbody>
        </table>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="mt-2.5 text-xs font-medium inline-flex items-center gap-1.5 border-dashed hover:border-solid hover:bg-muted/60 transition-colors focus-visible:ring-2 focus-visible:ring-ring"
        onClick={onAdd}
      >
        <Icon icon="solar:add-circle-linear" size={14} />
        {addLabel}
      </Button>
    </div>
  );
}

export function GridCell({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return <td className={cn("px-2.5 py-1.5 align-middle", className)}>{children}</td>;
}

/**
 * The per-row action column: a ghost delete button with ARIA label, plus a chevron
 * when the row has extra fields to reveal (the fields Marley keeps off the inline grid).
 */
export function GridRowActions({
  index,
  onRemove,
  onToggleDetails,
  detailsOpen,
}: {
  index: number;
  onRemove: (index: number) => void;
  onToggleDetails?: () => void;
  detailsOpen?: boolean;
}) {
  return (
    <GridCell className="w-16 whitespace-nowrap text-right pr-2">
      <div className="flex items-center justify-end gap-1">
        {onToggleDetails && (
          <button
            type="button"
            onClick={onToggleDetails}
            aria-label={detailsOpen ? "Hide extra fields" : "Show extra fields"}
            className="inline-flex items-center justify-center h-7 w-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Icon
              icon={detailsOpen ? "solar:alt-arrow-up-bold" : "solar:alt-arrow-down-bold"}
              size={14}
            />
          </button>
        )}
        <button
          type="button"
          onClick={() => onRemove(index)}
          aria-label={`Delete row ${index + 1}`}
          className="inline-flex items-center justify-center h-7 w-7 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Icon icon="solar:trash-bin-trash-bold" size={15} />
        </button>
      </div>
    </GridCell>
  );
}

/**
 * The full-width panel a row's extra fields render into. `colSpan` must cover
 * the whole table so the panel lines up under the row it belongs to.
 */
export function GridDetailRow({
  colSpan,
  children,
}: {
  colSpan: number;
  children: React.ReactNode;
}) {
  return (
    <tr className="border-t bg-muted/20">
      <td colSpan={colSpan} className="px-3 py-3">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-3">{children}</div>
      </td>
    </tr>
  );
}

/** A labelled field inside a detail panel. */
export function GridDetailField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-xs font-medium text-muted-foreground mb-1">{label}</div>
      {children}
    </div>
  );
}

/** Tracks which rows have their detail panel open. */
export function useExpandedRows() {
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const toggle = (i: number) => setExpanded((prev) => ({ ...prev, [i]: !prev[i] }));
  return { expanded, toggle };
}
