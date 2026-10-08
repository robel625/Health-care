import { useState } from "react";
import { Icon } from "@/components/icon";
import Avatar from "@/components/Avatar";
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

export interface EntityOption {
  value: number;
  label: string;
  sublabel?: string;
  image?: string;
  /** Name used for avatar initials; defaults to `label`. */
  avatarName?: string;
  disabled?: boolean;
}

interface EntitySelectProps {
  options: EntityOption[];
  value: number | null;
  onChange: (value: number | null) => void;
  placeholder?: string;
  emptyText?: string;
  tone?: "emerald" | "blue" | "green" | "red" | "gray" | "purple" | "orange";
  disabled?: boolean;
  triggerClassName?: string;
  /** Linked DocType name, e.g. "Patient", "Healthcare Practitioner", "Medical Department". */
  doctype?: string;
  /** Full objects backing the options for Advanced Search table display. */
  rawItems?: any[];
  /** Whether to show "+ Create a new {doctype}". Defaults to true when doctype is provided. */
  allowCreate?: boolean;
  /** Whether to show "Advanced Search". Defaults to true. */
  allowAdvancedSearch?: boolean;
  onCreateNew?: (initialText?: string) => void;
  onAdvancedSearch?: () => void;
  onOptionAdded?: (option: EntityOption, raw?: any) => void;
}

/**
 * Searchable single-select combobox with avatar thumbnails, matching Frappe Marley's
 * Link field behavior with "+ Create a new {DocType}" and "Advanced Search".
 */
export default function EntitySelect({
  options,
  value,
  onChange,
  placeholder = "Select...",
  emptyText = "No results found",
  tone = "emerald",
  disabled = false,
  triggerClassName,
  doctype,
  rawItems,
  allowCreate = true,
  allowAdvancedSearch = true,
  onCreateNew,
  onAdvancedSearch,
  onOptionAdded,
}: EntitySelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [searchModalOpen, setSearchModalOpen] = useState(false);

  const selected = options.find((o) => o.value === value);

  const term = search.trim();
  const needle = term.toLowerCase();
  const filtered = needle
    ? options.filter(
        (o) =>
          o.label.toLowerCase().includes(needle) ||
          (o.sublabel && o.sublabel.toLowerCase().includes(needle))
      )
    : options;

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
    const id = typeof primaryVal === "number" ? primaryVal : Number(createdRecord?.id);
    const label =
      createdRecord?.item_name ||
      createdRecord?.patient_name ||
      createdRecord?.practitioner_name ||
      createdRecord?.department ||
      createdRecord?.appointment_type ||
      createdRecord?.first_name ||
      createdRecord?.name ||
      String(primaryVal);
    const sublabel =
      createdRecord?.item_code ||
      createdRecord?.patient_id ||
      createdRecord?.practitioner_id ||
      createdRecord?.mobile ||
      "";

    const newOpt: EntityOption = {
      value: id,
      label,
      sublabel,
      avatarName: label,
    };

    onOptionAdded?.(newOpt, createdRecord);
    onChange(id);
  };

  const handleSearchSelect = (selectedVal: any, rawRecord?: any) => {
    const id = typeof selectedVal === "number" ? selectedVal : Number(rawRecord?.id ?? selectedVal);
    const label =
      rawRecord?.item_name ||
      rawRecord?.patient_name ||
      rawRecord?.practitioner_name ||
      rawRecord?.department ||
      rawRecord?.appointment_type ||
      rawRecord?.label ||
      rawRecord?.name ||
      String(selectedVal);
    const sublabel =
      rawRecord?.item_code ||
      rawRecord?.patient_id ||
      rawRecord?.practitioner_id ||
      rawRecord?.sublabel ||
      "";

    const opt: EntityOption = {
      value: id,
      label,
      sublabel,
      avatarName: label,
    };

    onOptionAdded?.(opt, rawRecord);
    onChange(id);
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
              triggerClassName
            )}
          >
            {selected ? (
              <span className="flex min-w-0 items-center gap-2">
                <Avatar
                  name={selected.avatarName ?? selected.label}
                  src={selected.image}
                  size="sm"
                  tone={tone}
                />
                <span className="truncate font-medium">{selected.label}</span>
                {selected.sublabel && (
                  <span className="truncate text-xs text-muted-foreground">
                    {selected.sublabel}
                  </span>
                )}
              </span>
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
            <span className="flex shrink-0 items-center gap-1">
              {value !== null && !disabled && (
                <span
                  role="button"
                  tabIndex={-1}
                  aria-label="Clear selection"
                  className="text-muted-foreground hover:text-foreground"
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange(null);
                  }}
                >
                  <Icon icon="solar:close-circle-bold" size={14} />
                </span>
              )}
              <Icon icon="solar:alt-arrow-down-bold" size={16} className="shrink-0 text-muted-foreground" />
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[--radix-popover-trigger-width] min-w-[260px] p-0 shadow-lg border"
          align="start"
        >
          <Command shouldFilter={false}>
            <CommandInput
              placeholder={`Search ${doctype || placeholder.replace("Select ", "")}...`}
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
                  {filtered.map((opt) => (
                    <CommandItem
                      key={opt.value}
                      value={`${opt.label} ${opt.sublabel || ""}`}
                      disabled={opt.disabled}
                      onSelect={() => {
                        onChange(opt.value);
                        setOpen(false);
                      }}
                      className={cn(
                        "flex cursor-pointer items-center justify-between gap-2 py-2 px-3",
                        opt.value === value && "bg-accent"
                      )}
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <Avatar
                          name={opt.avatarName ?? opt.label}
                          src={opt.image}
                          size="sm"
                          tone={tone}
                        />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">{opt.label}</span>
                          {opt.sublabel && (
                            <span className="block truncate text-xs text-muted-foreground">
                              {opt.sublabel}
                            </span>
                          )}
                        </span>
                      </div>
                      {opt.value === value && (
                        <Icon icon="solar:check-circle-bold" size={14} className="text-primary shrink-0" />
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              {/* Marley Frappe Link Footer Options */}
              {(allowCreate || allowAdvancedSearch) && (
                <div className="border-t bg-muted/20 py-1">
                  {allowCreate && (
                    <button
                      type="button"
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-left transition-colors cursor-pointer"
                      onClick={handleOpenCreate}
                    >
                      <Icon icon="solar:add-circle-bold" size={15} className="shrink-0 text-emerald-600" />
                      <span className="truncate">
                        Create a new {doctype || "record"}
                        {search.trim() ? ` "${search.trim()}"` : ""}
                      </span>
                    </button>
                  )}
                  {allowAdvancedSearch && (
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
        doctype={doctype || "Entity"}
        items={rawItems || options}
        onSelect={handleSearchSelect}
        onCreateNew={allowCreate ? handleOpenCreate : undefined}
      />
    </>
  );
}
