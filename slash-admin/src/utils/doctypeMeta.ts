/**
 * Readers for a form's server-side field definitions.
 *
 * Frappe builds its forms from the doctype JSON — labels, required flags, Link
 * targets and, crucially, the `options` of every Select — and the client reads
 * them from the server. The healthcare forms do the same: each one fetches its
 * own meta (see `backend/apps/healthcare/doctype_meta.py`) and builds its
 * pickers from that, so a Select has exactly one definition, on the server.
 *
 * The helpers are structural, so they work on any form's meta payload.
 */

import type { DoctypeFieldMeta, DoctypeFormMeta } from "@/api/services/healthcareService";

/** Look up one field, on the document itself or on one of its child tables. */
export function fieldMeta(
  meta: DoctypeFormMeta | null,
  fieldname: string,
  childTable?: string
): DoctypeFieldMeta | null {
  if (!meta) return null;
  const fields = childTable
    ? meta.child_tables[childTable]?.fields ?? []
    : meta.fields;
  return fields.find((f) => f.fieldname === fieldname) ?? null;
}

/**
 * A Select field's choices. Link fields return `[]` — their options come from
 * the linked doctype's own endpoint, not from the meta.
 */
export function fieldOptions(
  meta: DoctypeFormMeta | null,
  fieldname: string,
  childTable?: string
): string[] {
  const field = fieldMeta(meta, fieldname, childTable);
  return Array.isArray(field?.options) ? field.options : [];
}

/** Whether Marley marks this field required (its red asterisk). */
export function isRequired(
  meta: DoctypeFormMeta | null,
  fieldname: string,
  childTable?: string
): boolean {
  return fieldMeta(meta, fieldname, childTable)?.reqd === true;
}

/** Whether Marley marks this field read-only. */
export function isReadOnly(
  meta: DoctypeFormMeta | null,
  fieldname: string,
  childTable?: string
): boolean {
  return fieldMeta(meta, fieldname, childTable)?.read_only === true;
}

/**
 * Marley's `depends_on`, as a predicate.
 *
 * The strings are JS expressions Frappe evaluates against the document, e.g.
 * `eval:doc.lab_test_template_type == 'Imaging'`. Rather than eval them, this
 * translates the handful of shapes the healthcare doctypes actually use —
 * equality, inequality, truthiness, `&&`, `||` and `__islocal` — into a test
 * against the form's current values.
 *
 * `__islocal` is Frappe's "not saved yet" flag; pass `isNew` for it.
 */
export function fieldVisible(
  meta: DoctypeFormMeta | null,
  fieldname: string,
  values: Record<string, any>,
  opts: { childTable?: string; isNew?: boolean } = {}
): boolean {
  const expr = fieldMeta(meta, fieldname, opts.childTable)?.depends_on;
  if (!expr) return true;
  return evalDependsOn(expr, values, opts.isNew === true);
}

/** Marley's `mandatory_depends_on` — the asterisk that comes and goes. */
export function fieldMandatory(
  meta: DoctypeFormMeta | null,
  fieldname: string,
  values: Record<string, any>,
  opts: { childTable?: string; isNew?: boolean } = {}
): boolean {
  const field = fieldMeta(meta, fieldname, opts.childTable);
  if (field?.reqd) return true;
  if (!field?.mandatory_depends_on) return false;
  return evalDependsOn(field.mandatory_depends_on, values, opts.isNew === true);
}

/** Marley's `read_only_depends_on`. */
export function fieldReadOnly(
  meta: DoctypeFormMeta | null,
  fieldname: string,
  values: Record<string, any>,
  opts: { childTable?: string; isNew?: boolean } = {}
): boolean {
  const field = fieldMeta(meta, fieldname, opts.childTable);
  if (field?.read_only) return true;
  if (!field?.read_only_depends_on) return false;
  return evalDependsOn(field.read_only_depends_on, values, opts.isNew === true);
}

/**
 * Evaluate one of Marley's `depends_on` expressions.
 *
 * Split on the top-level `||` then the top-level `&&` — the operators the
 * healthcare doctypes use — and resolve each leaf. The split has to respect
 * parentheses: Marley writes `doc.is_billable && (!doc.link_existing_item ||
 * !doc.__islocal)`, and splitting that on `||` blindly would tear the group in
 * half and read it as "is_billable, or ...".
 *
 * Anything unrecognised is treated as true, so a field is shown rather than
 * silently hidden if a doctype grows an expression this cannot read.
 */
function evalDependsOn(
  expr: string,
  values: Record<string, any>,
  isNew: boolean
): boolean {
  const body = expr.replace(/^\s*eval\s*:/, "").replace(/;\s*$/, "").trim();

  const orParts = splitTopLevel(body, "||");
  if (orParts.length > 1) {
    return orParts.some((part) => evalDependsOn(part, values, isNew));
  }
  const andParts = splitTopLevel(body, "&&");
  if (andParts.length > 1) {
    return andParts.every((part) => evalDependsOn(part, values, isNew));
  }

  return evalLeaf(body.trim(), values, isNew);
}

/**
 * Split on an operator, ignoring any occurrence nested inside parentheses or
 * quotes. The healthcare expressions do not nest deeper than one level, but
 * scanning depth is enough to keep a group intact.
 */
function splitTopLevel(expr: string, op: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let quote: string | null = null;
  let start = 0;

  for (let i = 0; i < expr.length; i++) {
    const ch = expr[i];
    if (quote) {
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
    } else if (ch === "(") {
      depth++;
    } else if (ch === ")") {
      depth--;
    } else if (depth === 0 && expr.startsWith(op, i)) {
      parts.push(expr.slice(start, i));
      i += op.length - 1;
      start = i + 1;
    }
  }
  parts.push(expr.slice(start));
  return parts;
}

function evalLeaf(leaf: string, values: Record<string, any>, isNew: boolean): boolean {
  const negated = leaf.startsWith("!");
  const body = (negated ? leaf.slice(1) : leaf).trim();
  const result = evalPositive(body, values, isNew);
  return negated ? !result : result;
}

function evalPositive(body: string, values: Record<string, any>, isNew: boolean): boolean {
  const paren = body.match(/^\((.*)\)$/);
  if (paren) return evalDependsOn(paren[1], values, isNew);

  if (body === "doc.__islocal") return isNew;

  // `doc.field == 'literal'`, and Marley's `field == 'literal'` in the doctypes
  // that leave the `doc.` off.
  const cmp = body.match(/^(?:doc\.)?([A-Za-z0-9_]+)\s*(==|!=)\s*'([^']*)'$/);
  if (cmp) {
    const actual = values[cmp[1]];
    const equal = String(actual ?? "") === cmp[3];
    return cmp[2] === "==" ? equal : !equal;
  }

  // A bare field reference — `secondary_uom` — means `doc.secondary_uom`.
  // `__islocal` is the one name that is not a document field.
  const ref = body.match(/^(?:doc\.)?([A-Za-z0-9_]+)$/);
  if (ref) {
    if (ref[1] === "__islocal") return isNew;
    return Boolean(values[ref[1]]);
  }

  // An expression this cannot read: show the field rather than hide it.
  return true;
}
