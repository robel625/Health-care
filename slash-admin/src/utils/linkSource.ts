/**
 * Frappe Link-field behaviour for React pickers.
 *
 * A Frappe `Link` stores the linked record's name, not a free-text value, and
 * lets you create the record on the spot when what you typed isn't there yet.
 * Our pickers work in display strings (that's what `Combobox` consumes), so a
 * `LinkSource` keeps the fetched records alongside a display-string → id map
 * and can create a missing record on demand.
 */

export interface LinkSource<T> {
  /** The records currently known, including ones created during this session. */
  items: T[];
  /** Display strings for the picker, in list order. */
  options: string[];
  /** Replace the backing list (after a fetch or a reload). */
  setItems(next: T[]): void;
  /** Resolve a display string to a record id, or null when it isn't known. */
  idFor(display: string): number | null;
  /** Resolve, creating the record when it doesn't exist yet. */
  ensure(display: string): Promise<number | null>;
}

const norm = (s: string) => s.trim().toLowerCase();

/**
 * Build a source over records shaped `{ id, [field]: string }`, where the
 * picker shows `toDisplay(item)` and a brand-new record is created by posting
 * `buildPayload(name)`.
 *
 * `buildPayload` returning null means "this name can't be created" (for example
 * a code value with no code system chosen yet) — `ensure` then resolves to null
 * instead of posting something invalid.
 */
export function createLinkSource<T extends { id: number }>(
  initial: T[],
  toDisplay: (item: T) => string,
  create: (name: string) => Promise<T>,
  buildPayload: (name: string) => Record<string, any> | null = (name) => ({ name })
): LinkSource<T> {
  let items = [...initial];

  const idFor = (display: string): number | null => {
    const needle = norm(display);
    if (!needle) return null;
    const hit = items.find((i) => norm(toDisplay(i)) === needle);
    return hit ? hit.id : null;
  };

  const source: LinkSource<T> = {
    get items() {
      return items;
    },
    get options() {
      return items.map(toDisplay);
    },
    setItems(next: T[]) {
      items = [...next];
    },
    idFor,
    async ensure(display: string): Promise<number | null> {
      const name = display.trim();
      if (!name) return null;
      const existing = idFor(name);
      if (existing != null) return existing;

      const payload = buildPayload(name);
      if (!payload) return null;
      try {
        const created = await create(payload as any);
        if (created?.id != null) {
          items = [...items, created];
          return created.id;
        }
        return null;
      } catch {
        // Most likely a race: something else created the same record between
        // the lookup and the POST. Re-resolve rather than surfacing an error.
        return null;
      }
    },
  };

  return source;
}

/** Split a `"code: display"` picker string back into its parts. */
export function splitCodeDisplay(display: string): { code: string; label: string } {
  const idx = display.indexOf(":");
  if (idx === -1) return { code: display.trim(), label: "" };
  return { code: display.slice(0, idx).trim(), label: display.slice(idx + 1).trim() };
}
