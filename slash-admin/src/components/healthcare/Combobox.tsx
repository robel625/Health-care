import { useState, useMemo } from "react";
import { Icon } from "@/components/icon";
import { cn } from "@/utils";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/ui/popover";
import AdvancedSearchModal from "./AdvancedSearchModal";
import QuickCreateModal from "./QuickCreateModal";

export interface ComboboxProps {
  /** Choices to offer. Frappe calls these the Link/Select options. */
  options: string[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  emptyText?: string;
  /** Whether to show the "+ Create a new {doctype}" action. Defaults to true. */
  allowCreate?: boolean;
  /** Whether to show the "Advanced Search" action. Defaults to true when doctype is provided. */
  allowAdvancedSearch?: boolean;
  disabled?: boolean;
  className?: string;
  /** Linked DocType name, e.g. "Lab Test UOM", "Item", "Medical Department". */
  doctype?: string;
  /** Full objects backing the options for Advanced Search table display. */
  rawItems?: any[];
  /** Optional custom fetcher for Advanced Search. */
  fetchItems?: (query: string) => Promise<any[]>;
  /** Optional override for creating new record. */
  onCreateNew?: (initialValue?: string) => void;
  /** Optional override for advanced search. */
  onAdvancedSearch?: () => void;
  /** Callback fired when a new record is created via the QuickCreateModal. */
  onItemCreated?: (createdRecord: any, primaryValue: string | number) => void;
  /** Optional badge map for showing pills (e.g. stock status) next to options */
  badgeMap?: Record<string, { label: string; variant?: "success" | "danger" | "warning" | "neutral" }>;
}

/**
 * Typeable single-select — matching Frappe's Link/Select field with
 * "+ Create a new {DocType}" and "Advanced Search" options.
 */
export default function Combobox({
  options,
  value,
  onChange,
  placeholder = "Select...",
  emptyText = "No results found",
  allowCreate = true,
  allowAdvancedSearch,
  disabled = false,
  className,
  doctype,
  rawItems,
  fetchItems,
  onCreateNew,
  onAdvancedSearch,
  onItemCreated,
  badgeMap,
}: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [searchModalOpen, setSearchModalOpen] = useState(false);

  const term = search.trim();
  const needle = term.toLowerCase();

  // Filter out any empty/whitespace options to avoid blank rows
  const validOptions = useMemo(() => {
    return (options || []).filter((o: string) => typeof o === "string" && o.trim().length > 0);
  }, [options]);

  const filtered = needle
    ? validOptions.filter((o: string) => o.toLowerCase().includes(needle))
    : validOptions;

  const showAdvanced =
    allowAdvancedSearch !== undefined ? allowAdvancedSearch : Boolean(doctype || rawItems);

  const commit = (next: string) => {
    onChange(next);
    setSearch("");
    setOpen(false);
  };

  const handleOpenCreate = () => {
    const initialText = search.trim();
    setOpen(false);
    if (onCreateNew) {
      onCreateNew(initialText);
    } else {
      setCreateModalOpen(true);
    }
  };

  const handleOpenAdvancedSearch = () => {
    setOpen(false);
    if (onAdvancedSearch) {
      onAdvancedSearch();
    } else {
      setSearchModalOpen(true);
    }
  };

  const handleCreated = (createdRecord: any, primaryVal: string | number) => {
    const valStr = String(primaryVal);
    onChange(valStr);
    onItemCreated?.(createdRecord, primaryVal);
  };

  const handleSearchSelect = (selectedVal: any, rawRecord?: any) => {
    const valStr = String(selectedVal);
    onChange(valStr);
    onItemCreated?.(rawRecord, valStr);
  };

  return (
    <>
      <Popover
        open={open && !disabled}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setSearch("");
        }}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            className={cn(
              "flex w-full items-center justify-between gap-2 border rounded-md px-3 py-2 text-sm bg-background text-left",
              "focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-60",
              className
            )}
          >
            {value ? (
              <span className="truncate">{value}</span>
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
            <span className="flex shrink-0 items-center gap-1">
              {value && !disabled && (
                <span
                  role="button"
                  tabIndex={-1}
                  aria-label={`Clear ${value}`}
                  className="text-muted-foreground hover:text-foreground"
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange("");
                  }}
                >
                  <Icon icon="solar:close-circle-bold" size={14} />
                </span>
              )}
              <Icon icon="solar:alt-arrow-down-bold" size={16} className="text-muted-foreground" />
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[--radix-popover-trigger-width] min-w-[240px] p-0 shadow-lg border"
          align="start"
        >
          <Command shouldFilter={false}>
            <CommandInput
              placeholder={`Search ${doctype ? doctype : "or add"}...`}
              className="h-10"
              value={search}
              onValueChange={setSearch}
            />
            <CommandList className="max-h-60 overflow-y-auto">
              {filtered.length === 0 && (
                <CommandEmpty>{emptyText}</CommandEmpty>
              )}
              {filtered.length > 0 && (
                <CommandGroup>
                  {filtered.map((opt: string, idx: number) => {
                    const badge = badgeMap?.[opt] || badgeMap?.[opt.toLowerCase()] || badgeMap?.[opt.trim()];
                    return (
                      <CommandItem
                        key={`${opt}-${idx}`}
                        value={opt}
                        onSelect={() => commit(opt)}
                        className={cn(
                          "flex cursor-pointer items-center justify-between gap-2 py-2 px-3",
                          opt === value && "bg-accent"
                        )}
                      >
                        <span className="truncate font-medium">{opt}</span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {badge && (
                            <span
                              className={cn(
                                "text-[10px] px-1.5 py-0.5 rounded font-medium",
                                badge.variant === "success" &&
                                  "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300",
                                badge.variant === "danger" &&
                                  "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300",
                                badge.variant === "warning" &&
                                  "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
                                (!badge.variant || badge.variant === "neutral") && "bg-muted text-muted-foreground"
                              )}
                            >
                              {badge.label}
                            </span>
                          )}
                          {opt === value && Boolean(value) && (
                            <Icon icon="solar:check-circle-bold" size={14} className="text-primary shrink-0" />
                          )}
                        </div>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              )}

              {/* Marley Frappe Link Footer Options */}
              {(allowCreate || showAdvanced) && (
                <div className="border-t bg-muted/20 py-1">
                  {allowCreate && (
                    <button
                      type="button"
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-left transition-colors cursor-pointer"
                      onClick={handleOpenCreate}
                    >
                      <Icon icon="solar:add-circle-bold" size={15} className="shrink-0 text-emerald-600" />
                      <span className="truncate">
                        Create a new {doctype || "item"}
                        {search.trim() ? ` "${search.trim()}"` : ""}
                      </span>
                    </button>
                  )}
                  {showAdvanced && (
                    <button
                      type="button"
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 text-left transition-colors cursor-pointer"
                      onClick={handleOpenAdvancedSearch}
                    >
                      <Icon icon="solar:magnifer-linear" size={15} className="shrink-0" />
                      <span>Advanced Search</span>
                    </button>
                  )}
                </div>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Quick Create Dialog */}
      {doctype && (
        <QuickCreateModal
          open={createModalOpen}
          onOpenChange={setCreateModalOpen}
          doctype={doctype}
          initialValue={search.trim()}
          onCreated={handleCreated}
        />
      )}

      {/* Advanced Search Modal */}
      <AdvancedSearchModal
        open={searchModalOpen}
        onOpenChange={setSearchModalOpen}
        doctype={doctype || "Item"}
        items={rawItems || options}
        fetchItems={fetchItems}
        onSelect={handleSearchSelect}
        onCreateNew={allowCreate ? handleOpenCreate : undefined}
      />
    </>
  );
}
