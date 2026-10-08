import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/icon";
import { cn } from "@/utils";

interface MultiSelectProps {
  /** Choices to offer. Frappe calls these the Link options. */
  options: string[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  emptyText?: string;
  /** Offer a "Create «typed»" row for values not already in `options`. */
  allowCreate?: boolean;
  disabled?: boolean;
  className?: string;
  /** When "large", renders 2 lines tall (~72px) with bold larger text and chips. */
  size?: "default" | "large";
}

/**
 * Multi-value picker with removable chips — the React equivalent of a Frappe
 * **Table MultiSelect** (e.g. the encounter's Symptoms and Diagnosis fields).
 *
 * Values are picked from `options`, and anything not already listed can be
 * typed and created inline, mirroring how Frappe creates a linked record when
 * you type a name it doesn't recognise.
 */
export default function MultiSelect({
  options,
  value,
  onChange,
  placeholder = "Select...",
  emptyText = "No results found",
  allowCreate = true,
  disabled = false,
  className,
  size = "default",
}: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [highlight, setHighlight] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close when focus/click moves outside the control.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  const term = search.trim();
  const needle = term.toLowerCase();
  const available = useMemo(() => {
    const chosen = new Set(value.map((v) => v.toLowerCase()));
    return options.filter(
      (o) => !chosen.has(o.toLowerCase()) && (!needle || o.toLowerCase().includes(needle))
    );
  }, [options, value, needle]);

  const exactMatch =
    options.some((o) => o.toLowerCase() === needle) ||
    value.some((v) => v.toLowerCase() === needle);
  const showCreate = allowCreate && term.length > 0 && !exactMatch;

  // Row list = matches, then the optional "Create" row.
  const rows = useMemo(
    () => [
      ...available.map((o) => ({ kind: "option" as const, label: o })),
      ...(showCreate ? [{ kind: "create" as const, label: term }] : []),
    ],
    [available, showCreate, term]
  );

  useEffect(() => setHighlight(0), [search]);

  const add = (next: string) => {
    const trimmed = next.trim();
    if (!trimmed) return;
    if (!value.some((v) => v.toLowerCase() === trimmed.toLowerCase())) {
      onChange([...value, trimmed]);
    }
    setSearch("");
    setHighlight(0);
    inputRef.current?.focus();
  };

  const remove = (target: string) => onChange(value.filter((v) => v !== target));

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !search && value.length) {
      e.preventDefault();
      remove(value[value.length - 1]);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setHighlight((h) => Math.min(h + 1, rows.length - 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const row = rows[highlight];
      if (row) add(row.label);
      else if (term) add(term);
      return;
    }
    if (e.key === "Escape") {
      setOpen(false);
      setSearch("");
    }
  };

  return (
    <div ref={boxRef} className={cn("relative", className)}>
      <div
        className={cn(
          "flex w-full flex-wrap items-center rounded-md border bg-background transition-colors",
          size === "large"
            ? "min-h-[72px] items-start content-start gap-2 p-2.5"
            : "min-h-[38px] gap-1.5 px-2 py-1.5 text-sm",
          "focus-within:ring-2 focus-within:ring-primary/40 focus-within:border-primary",
          disabled && "cursor-not-allowed opacity-60"
        )}
        onClick={() => {
          if (disabled) return;
          setOpen(true);
          inputRef.current?.focus();
        }}
      >
        {value.map((item) => (
          <span
            key={item}
            className={cn(
              "inline-flex max-w-full items-center gap-1.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200/70 shadow-xs",
              size === "large"
                ? "px-2.5 py-1 text-sm font-bold"
                : "px-2 py-0.5 text-xs font-medium"
            )}
          >
            <span className="truncate">{item}</span>
            {!disabled && (
              <button
                type="button"
                aria-label={`Remove ${item}`}
                className="text-emerald-600 hover:text-emerald-950 focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-emerald-700 rounded-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  remove(item);
                }}
              >
                <Icon icon="solar:close-circle-bold" size={size === "large" ? 15 : 13} />
              </button>
            )}
          </span>
        ))}
        <input
          ref={inputRef}
          disabled={disabled}
          value={search}
          placeholder={value.length === 0 ? placeholder : ""}
          className={cn(
            "min-w-[120px] flex-1 border-0 bg-transparent outline-hidden disabled:cursor-not-allowed",
            size === "large"
              ? "px-1.5 py-1 text-base font-bold placeholder:text-base placeholder:font-bold placeholder:text-muted-foreground/70"
              : "px-1 py-0.5 text-sm placeholder:text-sm placeholder:text-muted-foreground"
          )}
          onChange={(e) => {
            setSearch(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
        />
      </div>

      {open && !disabled && (rows.length > 0 || available.length === 0) && (
        <div className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border bg-popover py-1 shadow-md">
          {rows.length === 0 ? (
            <div className="px-3 py-2 text-sm text-muted-foreground">{emptyText}</div>
          ) : (
            rows.map((row, i) => (
              <button
                key={`${row.kind}-${row.label}`}
                type="button"
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-1.5 text-left",
                  size === "large" ? "text-sm font-semibold" : "text-sm",
                  i === highlight && "bg-accent"
                )}
                onMouseEnter={() => setHighlight(i)}
                onClick={(e) => {
                  e.stopPropagation();
                  add(row.label);
                }}
              >
                {row.kind === "create" ? (
                  <>
                    <Icon icon="solar:add-circle-bold" size={14} className="text-emerald-600" />
                    <span className="truncate">
                      Create <span className="font-medium">“{row.label}”</span>
                    </span>
                  </>
                ) : (
                  <span className="truncate">{row.label}</span>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
