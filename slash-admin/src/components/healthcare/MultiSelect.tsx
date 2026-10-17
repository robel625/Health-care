import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/icon";
import { cn } from "@/utils";

export interface MultiSelectProps {
  /** Choices to offer. Frappe calls these the Link options. */
  options: string[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  emptyText?: string;
  /** Whether to offer creation of new values. Defaults to true. */
  allowCreate?: boolean;
  disabled?: boolean;
  className?: string;
  /** When "large", renders 2 lines tall (~72px) with bold larger text and chips. */
  size?: "default" | "large";
  /** Optional function to get an external link URL for an option. */
  getOptionUrl?: (option: string) => string | undefined;
  /** Linked DocType name, e.g. "Symptom", "Diagnosis". */
  doctype?: string;
  /** Optional callback to open a dedicated create modal (e.g. CreateSymptomModal). */
  onCreateNew?: (initialText?: string) => void;
  /** Optional callback when an ad-hoc option is added. */
  onCreateOption?: (newOption: string) => void;
}

/**
 * Multi-value picker with removable chips — the React equivalent of a Frappe
 * **Table MultiSelect** (e.g. the encounter's Symptoms and Diagnosis fields).
 *
 * Values are picked from `options`, and anything not already listed can be
 * created inline or via the bottom action, mirroring how Frappe creates a linked record.
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
  getOptionUrl,
  doctype,
  onCreateNew,
  onCreateOption,
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

  const handleOpenCreate = () => {
    const initialText = search.trim();
    setOpen(false);
    if (onCreateNew) {
      onCreateNew(initialText);
    } else if (initialText) {
      add(initialText);
      onCreateOption?.(initialText);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !search && value.length) {
      e.preventDefault();
      remove(value[value.length - 1]);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setHighlight((h) => Math.min(h + 1, available.length - 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const option = available[highlight];
      if (option) {
        add(option);
      } else if (term) {
        add(term);
        onCreateOption?.(term);
      }
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
        {value.map((item) => {
          const url = getOptionUrl ? getOptionUrl(item) : undefined;
          return (
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
              {url && (
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-emerald-700 hover:text-emerald-950 text-[11px] underline flex items-center gap-0.5 shrink-0"
                  title="Open clinical reference guide"
                >
                  <Icon icon="solar:link-linear" size={11} />
                </a>
              )}
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
          );
        })}
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

      {open && !disabled && (
        <div className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-md border bg-popover py-1 shadow-md">
          {available.length === 0 ? (
            <div className="px-3 py-2 text-sm text-muted-foreground">{emptyText}</div>
          ) : (
            available.map((opt, i) => {
              const url = getOptionUrl ? getOptionUrl(opt) : undefined;
              return (
                <div
                  key={opt}
                  className={cn(
                    "flex w-full items-center justify-between px-3 py-1.5 text-left cursor-pointer transition-colors",
                    size === "large" ? "text-sm font-semibold" : "text-sm",
                    i === highlight && "bg-accent"
                  )}
                  onMouseEnter={() => setHighlight(i)}
                  onClick={(e) => {
                    e.stopPropagation();
                    add(opt);
                  }}
                >
                  <span className="truncate">{opt}</span>
                  {url && (
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-[11px] text-primary/70 hover:text-primary flex items-center gap-0.5 ml-2 shrink-0 font-normal"
                    >
                      Detail <Icon icon="solar:link-linear" size={11} />
                    </a>
                  )}
                </div>
              );
            })
          )}

          {/* Action button at the bottom of the scrollable list (scroll down to bottom to show) */}
          {allowCreate && (
            <div className="border-t bg-muted/20 p-1 mt-1">
              <button
                type="button"
                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded transition-colors text-left cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  handleOpenCreate();
                }}
              >
                <Icon icon="solar:add-circle-bold" size={15} className="shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span className="truncate">
                  Create a new {doctype || "item"}{term ? ` "${term}"` : ""}
                </span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
