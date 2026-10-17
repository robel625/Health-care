/**
 * The encounter form's child-table rows, shared by the create and detail pages.
 *
 * Field sets come straight from Marley's child doctypes:
 *   Drug Prescription, Lab Prescription, Procedure Prescription,
 *   Therapy Plan Detail and Codification Table.
 *
 * Rows hold the *display strings* the pickers work in. A row that already
 * exists on the server carries its `id`; a row added in the UI does not, which
 * is how the detail page tells an update from an insert.
 */

import * as React from "react";
import { Icon } from "@/components/icon";
import { Input } from "@/ui/input";
import { Textarea } from "@/ui/textarea";
import Combobox from "@/components/healthcare/Combobox";
import {
  GridCell,
  GridDetailField,
  GridDetailRow,
  GridRowActions,
} from "@/components/healthcare/EncounterGrid";
import type { CodeValue, Medication } from "@/api/services/healthcareService";
import {
  CLINICAL_DOSAGES,
  CLINICAL_DURATIONS,
  CLINICAL_DOSAGE_FORMS,
  CLINICAL_INTERVAL_UOMS,
  CLINICAL_INTENTS,
  CLINICAL_PRIORITIES,
} from "./medicationCatalogData";

/**
 * Code systems whose values back the Intent and Priority pickers. Marley
 * filters each child table's Intent/Priority to the matching code system with
 * `apply_code_sm_filter_to_child()`.
 */
export const INTENT_SYSTEM = "Intent";
export const PRIORITY_SYSTEM = "Priority";

// ── Row shapes ──────────────────────────────────────────────────────────────

export interface CodingRow {
  id?: number;
  code_system: string;
  code_value: string;
}

export interface DrugRow {
  id?: number;
  medication: string;
  drug_code: string;
  drug_name: string;
  dosage: string;
  period: string;
  dosage_form: string;
  comment: string;
  interval: string;
  interval_uom: string;
  number_of_repeats_allowed: string;
  intent: string;
  priority: string;
  in_stock?: boolean;
  available_qty?: number;
  checking_stock?: boolean;
  warehouse?: string;
  quantity?: number | string;
}

export interface LabRow {
  id?: number;
  lab_test_code: string;
  lab_test_name: string;
  lab_test_comment: string;
  observation_template: string;
  patient_care_type: string;
  intent: string;
  priority: string;
}

export interface ProcedureRow {
  id?: number;
  procedure: string;
  procedure_name: string;
  department: string;
  practitioner: string;
  date: string;
  comments: string;
  no_of_sessions: string;
  interval: string;
  patient_care_type: string;
  intent: string;
  priority: string;
}

export interface TherapyRow {
  id?: number;
  therapy_type: string;
  no_of_sessions: string;
  interval: string;
  patient_care_type: string;
  intent: string;
  priority: string;
}

export const emptyDrug = (): DrugRow => ({
  medication: "",
  drug_code: "",
  drug_name: "",
  dosage: "",
  period: "",
  dosage_form: "Tablet",
  comment: "",
  interval: "",
  interval_uom: "",
  number_of_repeats_allowed: "",
  intent: "Order",
  priority: "Routine",
});

export const emptyLab = (): LabRow => ({
  lab_test_code: "",
  lab_test_name: "",
  lab_test_comment: "",
  observation_template: "",
  patient_care_type: "",
  intent: "",
  priority: "",
});

export const emptyProcedure = (): ProcedureRow => ({
  procedure: "",
  procedure_name: "",
  department: "",
  practitioner: "",
  date: new Date().toISOString().split("T")[0],
  comments: "",
  no_of_sessions: "1",
  interval: "",
  patient_care_type: "",
  intent: "",
  priority: "",
});

export const emptyTherapy = (): TherapyRow => ({
  therapy_type: "",
  no_of_sessions: "1",
  interval: "",
  patient_care_type: "",
  intent: "",
  priority: "",
});

export const emptyCoding = (): CodingRow => ({ code_system: "", code_value: "" });

// ── Display helpers ─────────────────────────────────────────────────────────

/** A Medication's Link label — Marley shows `generic_name strength uom`. */
export function medicationLabel(m: Medication): string {
  const strength = m.strength ? ` ${m.strength}${m.strength_uom || ""}` : "";
  return `${m.generic_name}${strength}`.trim();
}

/**
 * A Code Value's picker label. Marley's Code Value is a `hash`-named doctype
 * whose Link shows the record name, so we show the code; when a display exists
 * and differs we append it so the picker is searchable by either.
 */
export function codeValueLabel(v: CodeValue): string {
  if (!v.display || v.display === v.code) return v.code;
  return `${v.code} — ${v.display}`;
}

// ── Row views ───────────────────────────────────────────────────────────────

export interface RowViewProps<T> {
  row: T;
  index: number;
  options: Record<string, string[]>;
  intentOptions: string[];
  priorityOptions: string[];
  expanded: boolean;
  disabled?: boolean;
  onToggleDetails: () => void;
  onChange: (i: number, key: keyof T, value: any) => void;
  onRemove: (i: number) => void;
}

export function DrugRowView({
  row,
  index,
  options,
  intentOptions,
  priorityOptions,
  expanded,
  disabled,
  stockMap,
  onToggleDetails,
  onChange,
  onMedicationChange,
  onDrugCodeChange,
  onRemove,
}: RowViewProps<DrugRow> & {
  stockMap?: Record<string, { in_stock: boolean; available_qty: number; warehouse?: string }>;
  /** Picking a Medication also pre-fills the row from its defaults. */
  onMedicationChange: (i: number, v: string) => void;
  onDrugCodeChange: (i: number, v: string) => void;
}) {
  const box = "h-8 text-xs py-1";

  // Resolve stock from row state first, or fallback to stockMap
  const lookupStock =
    (stockMap && (
      (row.drug_code && (stockMap[row.drug_code] || stockMap[row.drug_code.toLowerCase()])) ||
      (row.medication && (stockMap[row.medication] || stockMap[row.medication.toLowerCase()])) ||
      (row.drug_name && (stockMap[row.drug_name] || stockMap[row.drug_name.toLowerCase()]))
    )) || null;

  const inStock = row.in_stock !== undefined ? row.in_stock : lookupStock?.in_stock;
  const availableQty = row.available_qty !== undefined ? row.available_qty : lookupStock?.available_qty;
  const isChecking = row.checking_stock === true;
  const hasSelectedDrug = Boolean(row.medication || row.drug_code);

  // Stock badges for Medication and Item Comboboxes
  const medicationBadges = React.useMemo(() => {
    if (!stockMap) return undefined;
    const b: Record<string, { label: string; variant?: "success" | "danger" | "warning" | "neutral" }> = {};
    (options.medications ?? []).forEach((m) => {
      const s = stockMap[m] || stockMap[m.toLowerCase()] || stockMap[m.trim()];
      if (s) {
        b[m] = s.in_stock
          ? { label: `${s.available_qty} in stock`, variant: "success" }
          : { label: "Out of Stock", variant: "danger" };
      }
    });
    return b;
  }, [options.medications, stockMap]);

  const stockItemBadges = React.useMemo(() => {
    if (!stockMap) return undefined;
    const b: Record<string, { label: string; variant?: "success" | "danger" | "warning" | "neutral" }> = {};
    (options.stockItems ?? []).forEach((it) => {
      const s = stockMap[it] || stockMap[it.toLowerCase()] || stockMap[it.trim()];
      if (s) {
        b[it] = s.in_stock
          ? { label: `${s.available_qty} in stock`, variant: "success" }
          : { label: "Out of Stock", variant: "danger" };
      }
    });
    return b;
  }, [options.stockItems, stockMap]);

  // Derived rich option catalogs merged with internet clinical datasets
  const dosageOptions = React.useMemo(() => {
    return Array.from(new Set([...(options.prescriptionDosages ?? []), ...CLINICAL_DOSAGES]));
  }, [options.prescriptionDosages]);

  const durationOptions = React.useMemo(() => {
    return Array.from(new Set([...(options.prescriptionDurations ?? []), ...CLINICAL_DURATIONS]));
  }, [options.prescriptionDurations]);

  const dosageFormOptions = React.useMemo(() => {
    return Array.from(new Set([...(options.dosageForms ?? []), ...CLINICAL_DOSAGE_FORMS]));
  }, [options.dosageForms]);

  const intervalUomOptions = React.useMemo(() => {
    return Array.from(new Set([...(options.intervalUom ?? []), ...CLINICAL_INTERVAL_UOMS]));
  }, [options.intervalUom]);

  const effectiveIntentOptions = React.useMemo(() => {
    return Array.from(new Set([...(intentOptions ?? []), ...CLINICAL_INTENTS]));
  }, [intentOptions]);

  const effectivePriorityOptions = React.useMemo(() => {
    return Array.from(new Set([...(priorityOptions ?? []), ...CLINICAL_PRIORITIES]));
  }, [priorityOptions]);

  return (
    <>
      <tr className="border-t hover:bg-muted/40 transition-colors">
        <GridCell className="w-10 text-center text-xs font-medium text-muted-foreground">
          {index + 1}
        </GridCell>
        <GridCell>
          <Combobox
            options={options.medications}
            value={row.medication}
            onChange={(v) => onMedicationChange(index, v)}
            placeholder="Select Medication"
            disabled={disabled}
            doctype="Medication"
            className={box}
            badgeMap={medicationBadges}
          />
          {isChecking && (
            <span className="text-[10px] text-muted-foreground font-medium flex items-center gap-1 mt-1">
              <Icon icon="solar:spinner-line-duotone" size={11} className="animate-spin text-primary shrink-0" />
              Checking stock...
            </span>
          )}
          {!isChecking && inStock === true && hasSelectedDrug && (
            <span className="text-[10px] text-emerald-700 dark:text-emerald-300 font-semibold flex items-center gap-1 mt-1 bg-emerald-50 dark:bg-emerald-950/50 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800 w-fit">
              <Icon icon="solar:check-circle-bold" size={12} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
              In Stock ({availableQty ?? 0} available)
            </span>
          )}
          {!isChecking && inStock === false && hasSelectedDrug && (
            <span className="text-[10px] text-rose-700 dark:text-rose-300 font-semibold flex items-center gap-1 mt-1 bg-rose-50 dark:bg-rose-950/50 px-1.5 py-0.5 rounded border border-rose-200 dark:border-rose-800 w-fit">
              <Icon icon="solar:danger-triangle-bold" size={12} className="text-rose-600 dark:text-rose-400 shrink-0" />
              Out of Stock (External Slip)
            </span>
          )}
        </GridCell>
        <GridCell>
          <Combobox
            options={options.stockItems}
            value={row.drug_code}
            onChange={(v) => onDrugCodeChange(index, v)}
            placeholder="Select Item"
            disabled={disabled}
            doctype="Item"
            className={box}
            badgeMap={stockItemBadges}
          />
          {!row.medication && row.drug_code && (
            <>
              {isChecking && (
                <span className="text-[10px] text-muted-foreground font-medium flex items-center gap-1 mt-1">
                  <Icon icon="solar:spinner-line-duotone" size={11} className="animate-spin text-primary shrink-0" />
                  Checking stock...
                </span>
              )}
              {!isChecking && inStock === true && (
                <span className="text-[10px] text-emerald-700 dark:text-emerald-300 font-semibold flex items-center gap-1 mt-1 bg-emerald-50 dark:bg-emerald-950/50 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800 w-fit">
                  <Icon icon="solar:check-circle-bold" size={12} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                  In Stock ({availableQty ?? 0} available)
                </span>
              )}
              {!isChecking && inStock === false && (
                <span className="text-[10px] text-rose-700 dark:text-rose-300 font-semibold flex items-center gap-1 mt-1 bg-rose-50 dark:bg-rose-950/50 px-1.5 py-0.5 rounded border border-rose-200 dark:border-rose-800 w-fit">
                  <Icon icon="solar:danger-triangle-bold" size={12} className="text-rose-600 dark:text-rose-400 shrink-0" />
                  Out of Stock (External Slip)
                </span>
              )}
            </>
          )}
        </GridCell>
        <GridCell>
          <Combobox
            options={dosageOptions}
            value={row.dosage}
            onChange={(v) => onChange(index, "dosage", v)}
            placeholder="1-0-1"
            disabled={disabled}
            doctype="Prescription Dosage"
            allowCreate={true}
            className={box}
          />
        </GridCell>
        <GridCell>
          <Combobox
            options={durationOptions}
            value={row.period}
            onChange={(v) => onChange(index, "period", v)}
            placeholder="Select"
            disabled={disabled}
            doctype="Prescription Duration"
            className={box}
          />
        </GridCell>
        <GridCell>
          <Combobox
            options={dosageFormOptions}
            value={row.dosage_form}
            onChange={(v) => onChange(index, "dosage_form", v)}
            placeholder="Select"
            disabled={disabled}
            doctype="Dosage Form"
            className={box}
          />
        </GridCell>
        <GridRowActions
          index={index}
          onRemove={onRemove}
          onToggleDetails={onToggleDetails}
          detailsOpen={expanded}
        />
      </tr>
      {expanded && (
        <GridDetailRow colSpan={7}>
          <GridDetailField label="Drug Name">
            <Input value={row.drug_name} readOnly className="h-8 text-xs bg-muted" />
          </GridDetailField>
          <GridDetailField label="Interval">
            <Input
              type="number"
              value={row.interval}
              onChange={(e) => onChange(index, "interval", e.target.value)}
              disabled={disabled}
              className="h-8 text-xs"
            />
          </GridDetailField>
          <GridDetailField label="Interval UOM">
            <Combobox
              options={intervalUomOptions}
              value={row.interval_uom}
              onChange={(v) => onChange(index, "interval_uom", v)}
              allowCreate={false}
              disabled={disabled}
              className={box}
            />
          </GridDetailField>
          <GridDetailField label="Number of Repeats Allowed">
            <Input
              type="number"
              value={row.number_of_repeats_allowed}
              onChange={(e) => onChange(index, "number_of_repeats_allowed", e.target.value)}
              disabled={disabled}
              className="h-8 text-xs"
            />
          </GridDetailField>
          <GridDetailField label="Intent">
            <Combobox
              options={effectiveIntentOptions}
              value={row.intent}
              onChange={(v) => onChange(index, "intent", v)}
              disabled={disabled}
              className={box}
            />
          </GridDetailField>
          <GridDetailField label="Priority">
            <Combobox
              options={effectivePriorityOptions}
              value={row.priority}
              onChange={(v) => onChange(index, "priority", v)}
              disabled={disabled}
              className={box}
            />
          </GridDetailField>
          <GridDetailField label="Comment (Dosage Form & Strength)" className="col-span-2 md:col-span-4">
            <Textarea
              value={row.comment}
              onChange={(e) => onChange(index, "comment", e.target.value)}
              disabled={disabled}
              placeholder="Dosage form and strength instructions"
              rows={Math.max(2, Math.min(8, (row.comment || "").split("\n").length))}
              className="text-xs min-h-[58px] leading-relaxed resize-y bg-background font-normal whitespace-pre-wrap"
            />
          </GridDetailField>
        </GridDetailRow>
      )}
    </>
  );
}

export function LabRowView({
  row,
  index,
  options,
  intentOptions,
  priorityOptions,
  expanded,
  disabled,
  onToggleDetails,
  onChange,
  onLabCodeChange,
  onRemove,
}: RowViewProps<LabRow> & { onLabCodeChange: (i: number, v: string) => void }) {
  const box = "h-8 text-xs py-1";
  return (
    <>
      <tr className="border-t hover:bg-muted/40 transition-colors">
        <GridCell className="w-10 text-center text-xs font-medium text-muted-foreground">
          {index + 1}
        </GridCell>
        <GridCell>
          <Combobox
            options={options.labTestTemplates}
            value={row.lab_test_code || row.observation_template}
            onChange={(v) => onLabCodeChange(index, v)}
            placeholder="Select Observation / Lab Test"
            disabled={disabled}
            doctype="Lab Test Template"
            className={box}
          />
        </GridCell>
        <GridCell>
          <Input
            value={row.lab_test_comment}
            onChange={(e) => onChange(index, "lab_test_comment", e.target.value)}
            placeholder="Comments..."
            disabled={disabled}
            className="h-8 text-xs"
          />
        </GridCell>
        <GridRowActions
          index={index}
          onRemove={onRemove}
          onToggleDetails={onToggleDetails}
          detailsOpen={expanded}
        />
      </tr>
      {expanded && (
        <GridDetailRow colSpan={4}>
          <GridDetailField label="Lab Test Name">
            <Input value={row.lab_test_name} readOnly className="h-8 text-xs bg-muted" />
          </GridDetailField>
          <GridDetailField label="Patient Care Type">
            <Combobox
              options={options.patientCareTypes}
              value={row.patient_care_type}
              onChange={(v) => onChange(index, "patient_care_type", v)}
              disabled={disabled}
              doctype="Patient Care Type"
              className={box}
            />
          </GridDetailField>
          <GridDetailField label="Intent">
            <Combobox
              options={intentOptions}
              value={row.intent}
              onChange={(v) => onChange(index, "intent", v)}
              disabled={disabled}
              className={box}
            />
          </GridDetailField>
          <GridDetailField label="Priority">
            <Combobox
              options={priorityOptions}
              value={row.priority}
              onChange={(v) => onChange(index, "priority", v)}
              disabled={disabled}
              className={box}
            />
          </GridDetailField>
        </GridDetailRow>
      )}
    </>
  );
}

export function ProcedureRowView({
  row,
  index,
  options,
  practitionerOptions,
  intentOptions,
  priorityOptions,
  expanded,
  disabled,
  onToggleDetails,
  onChange,
  onProcedureChange,
  onRemove,
}: RowViewProps<ProcedureRow> & {
  practitionerOptions: string[];
  onProcedureChange: (i: number, v: string) => void;
}) {
  const box = "h-8 text-xs py-1";
  return (
    <>
      <tr className="border-t hover:bg-muted/40 transition-colors">
        <GridCell className="w-10 text-center text-xs font-medium text-muted-foreground">
          {index + 1}
        </GridCell>
        <GridCell>
          <Combobox
            options={options.procedureTemplates}
            value={row.procedure}
            onChange={(v) => onProcedureChange(index, v)}
            placeholder="Select Procedure"
            disabled={disabled}
            doctype="Clinical Procedure Template"
            className={box}
          />
        </GridCell>
        <GridCell>
          <Input
            value={row.procedure_name}
            onChange={(e) => onChange(index, "procedure_name", e.target.value)}
            placeholder="Procedure"
            disabled={disabled}
            className="h-8 text-xs"
          />
        </GridCell>
        <GridCell>
          <Combobox
            options={practitionerOptions}
            value={row.practitioner}
            onChange={(v) => onChange(index, "practitioner", v)}
            placeholder="Select Referring"
            disabled={disabled}
            doctype="Healthcare Practitioner"
            className={box}
          />
        </GridCell>
        <GridCell>
          <Input
            type="date"
            value={row.date || new Date().toISOString().split("T")[0]}
            onChange={(e) => onChange(index, "date", e.target.value)}
            disabled={disabled}
            className="h-8 text-xs"
          />
        </GridCell>
        <GridRowActions
          index={index}
          onRemove={onRemove}
          onToggleDetails={onToggleDetails}
          detailsOpen={expanded}
        />
      </tr>
      {expanded && (
        <GridDetailRow colSpan={6}>
          <GridDetailField label="Department">
            <select
              className="h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              value={row.department || ""}
              onChange={(e) => onChange(index, "department", e.target.value)}
              disabled={disabled}
            >
              <option value="">Select Medical Department...</option>
              {(options.departments || []).map((dept: string) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </GridDetailField>
          <GridDetailField label="Comments">
            <Input
              value={row.comments}
              onChange={(e) => onChange(index, "comments", e.target.value)}
              placeholder="Comments"
              disabled={disabled}
              className="h-8 text-xs"
            />
          </GridDetailField>
          <GridDetailField label="No of Sessions">
            <Input
              type="number"
              value={row.no_of_sessions}
              onChange={(e) => onChange(index, "no_of_sessions", e.target.value)}
              disabled={disabled}
              className="h-8 text-xs"
            />
          </GridDetailField>
          <GridDetailField label="Interval">
            <Input
              value={row.interval}
              onChange={(e) => onChange(index, "interval", e.target.value)}
              disabled={disabled}
              className="h-8 text-xs"
            />
          </GridDetailField>
          <GridDetailField label="Patient Care Type">
            <Combobox
              options={options.patientCareTypes}
              value={row.patient_care_type}
              onChange={(v) => onChange(index, "patient_care_type", v)}
              disabled={disabled}
              doctype="Patient Care Type"
              className={box}
            />
          </GridDetailField>
          <GridDetailField label="Intent">
            <Combobox
              options={intentOptions}
              value={row.intent}
              onChange={(v) => onChange(index, "intent", v)}
              disabled={disabled}
              className={box}
            />
          </GridDetailField>
          <GridDetailField label="Priority">
            <Combobox
              options={priorityOptions}
              value={row.priority}
              onChange={(v) => onChange(index, "priority", v)}
              disabled={disabled}
              className={box}
            />
          </GridDetailField>
        </GridDetailRow>
      )}
    </>
  );
}

export function TherapyRowView({
  row,
  index,
  options,
  intentOptions,
  priorityOptions,
  expanded,
  disabled,
  onToggleDetails,
  onChange,
  onRemove,
}: RowViewProps<TherapyRow>) {
  const box = "h-8 text-xs py-1";
  return (
    <>
      <tr className="border-t hover:bg-muted/40 transition-colors">
        <GridCell className="w-10 text-center text-xs font-medium text-muted-foreground">
          {index + 1}
        </GridCell>
        <GridCell>
          <Combobox
            options={options.therapyTypes}
            value={row.therapy_type}
            onChange={(v) => onChange(index, "therapy_type", v)}
            placeholder="Select Therapy Type"
            disabled={disabled}
            doctype="Therapy Type"
            className={box}
          />
        </GridCell>
        <GridCell>
          <Input
            type="number"
            min={1}
            step={1}
            value={row.no_of_sessions}
            onChange={(e) => {
              const val = e.target.value;
              if (val === "" || parseInt(val, 10) >= 1) {
                onChange(index, "no_of_sessions", val);
              }
            }}
            disabled={disabled}
            className="h-8 text-xs"
          />
        </GridCell>
        <GridRowActions
          index={index}
          onRemove={onRemove}
          onToggleDetails={onToggleDetails}
          detailsOpen={expanded}
        />
      </tr>
      {expanded && (
        <GridDetailRow colSpan={4}>
          <GridDetailField label="Interval">
            <Input
              value={row.interval}
              onChange={(e) => onChange(index, "interval", e.target.value)}
              placeholder="e.g. Daily / Weekly"
              disabled={disabled}
              className="h-8 text-xs"
            />
          </GridDetailField>
          <GridDetailField label="Patient Care Type">
            <Combobox
              options={options.patientCareTypes}
              value={row.patient_care_type}
              onChange={(v) => onChange(index, "patient_care_type", v)}
              disabled={disabled}
              doctype="Patient Care Type"
              className={box}
            />
          </GridDetailField>
          <GridDetailField label="Intent">
            <Combobox
              options={intentOptions}
              value={row.intent}
              onChange={(v) => onChange(index, "intent", v)}
              disabled={disabled}
              className={box}
            />
          </GridDetailField>
          <GridDetailField label="Priority">
            <Combobox
              options={priorityOptions}
              value={row.priority}
              onChange={(v) => onChange(index, "priority", v)}
              disabled={disabled}
              className={box}
            />
          </GridDetailField>
        </GridDetailRow>
      )}
    </>
  );
}

/**
 * A Medical Coding row. `code`, `display` and `definition` are resolved by the
 * page from the chosen masters — Marley's `fetch_from` fills them on link.
 */
export function CodingRowView({
  row,
  index,
  codeSystemOptions,
  codeValueOptions,
  code,
  display,
  definition,
  disabled,
  onChange,
  onRemove,
}: {
  row: CodingRow;
  index: number;
  codeSystemOptions: string[];
  codeValueOptions: string[];
  code: string;
  display: string;
  definition: string;
  disabled?: boolean;
  onChange: (i: number, key: keyof CodingRow, value: any) => void;
  onRemove: (i: number) => void;
}) {
  const box = "h-8 text-xs py-1";
  return (
    <tr className="border-t hover:bg-muted/40 transition-colors">
      <GridCell className="w-10 text-center text-xs font-medium text-muted-foreground">
        {index + 1}
      </GridCell>
      <GridCell>
        <Combobox
          options={codeSystemOptions}
          value={row.code_system}
          onChange={(v) => {
            onChange(index, "code_system", v);
            // Code Values are scoped to the system, so one picked under the
            // old system no longer applies.
            onChange(index, "code_value", "");
          }}
          placeholder="Select Code System"
          disabled={disabled}
          doctype="Code System"
          className={box}
        />
      </GridCell>
      <GridCell>
        <Combobox
          options={codeValueOptions}
          value={row.code_value}
          onChange={(v) => onChange(index, "code_value", v)}
          placeholder={row.code_system ? "Select Code Value" : "Pick a system first"}
          disabled={disabled || !row.code_system}
          doctype="Code Value"
          className={box}
        />
      </GridCell>
      <GridCell>
        <Input value={code} readOnly className="h-8 text-xs bg-muted" />
      </GridCell>
      <GridCell>
        <Input value={display} readOnly className="h-8 text-xs bg-muted" />
      </GridCell>
      <GridCell>
        <Input value={definition} readOnly className="h-8 text-xs bg-muted" />
      </GridCell>
      <GridRowActions index={index} onRemove={onRemove} />
    </tr>
  );
}
