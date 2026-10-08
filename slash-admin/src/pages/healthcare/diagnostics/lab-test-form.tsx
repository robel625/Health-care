/**
 * Lab Test form — Enterprise Clinical Diagnostic Form.
 *
 * Supports both creating a New Lab Test and managing an existing Lab Test.
 * Automatically loads template result definitions into the interactive grid
 * upon template selection so technicians can view reference ranges and input
 * values immediately with real-time abnormal value evaluation.
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router";
import { Icon } from "@/components/icon";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { Badge } from "@/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/ui/dialog";
import { toast } from "sonner";
import { HealthcareApi } from "@/api/services/healthcareService";
import EntitySelect from "@/components/healthcare/EntitySelect";
import Combobox from "@/components/healthcare/Combobox";
import { useDoctypePermissions, useHasRole } from "@/utils/permissions";
import { formatAge } from "@/utils/age";
import { cn } from "@/utils";
import type {
  LabTest,
  Patient,
  HealthcarePractitioner,
  MedicalDepartment,
  LabTestTemplate,
  LabPrescription,
  PatientEncounter,
  LabTestUOM,
  CodificationRow,
  NormalTestResultRow,
  DescriptiveTestResultRow,
  SensitivityTestResultRow,
  OrganismTestResultRow,
} from "@/api/services/healthcareService";

export type FormNormalRow = Partial<NormalTestResultRow> & {
  id?: any;
  _idx?: number;
  lab_test_name: string;
  lab_test_event: string;
  result_value: string;
  normal_range?: string;
  lab_test_uom?: number | null;
  lab_test_uom_name?: string;
};

export type FormDescriptiveRow = Partial<DescriptiveTestResultRow> & {
  id?: any;
  _idx?: number;
  lab_test_particulars: string;
  result_value: string;
};

/** Status badge styling */
const statusBadge: Record<string, { bg: string; text: string; icon: string }> = {
  Draft: { bg: "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400", text: "Draft (Testing)", icon: "solar:clock-circle-bold" },
  Completed: { bg: "bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-400", text: "Completed (Awaiting Approval)", icon: "solar:check-circle-bold" },
  Approved: { bg: "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400", text: "Approved (Verified)", icon: "solar:verified-check-bold" },
  Rejected: { bg: "bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-400", text: "Rejected", icon: "solar:close-circle-bold" },
  Cancelled: { bg: "bg-gray-500/10 border-gray-500/30 text-gray-700 dark:text-gray-400", text: "Cancelled", icon: "solar:trash-bin-bold" },
};

/** Specimen custody status badge styling */
export const specimenBadge: Record<string, { bg: string; text: string; icon: string }> = {
  "Pending Collection": { bg: "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400", text: "Pending Collection", icon: "solar:test-tube-broken" },
  "Collected": { bg: "bg-sky-500/10 border-sky-500/30 text-sky-700 dark:text-sky-400", text: "Collected (In Transit)", icon: "solar:box-minimalistic-bold" },
  "Received": { bg: "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400", text: "Received & Accessioned", icon: "solar:shield-check-bold" },
  "Rejected": { bg: "bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-400", text: "Specimen Rejected", icon: "solar:close-circle-bold" },
  "Not Required": { bg: "bg-gray-500/10 border-gray-500/30 text-gray-700 dark:text-gray-400", text: "Sample Not Required", icon: "solar:check-circle-bold" },
};

/** Tube colors mapping with clinical additives and visual styling */
export const TUBE_COLOR_MAP: Record<string, { bg: string; border: string; desc: string; capClass: string }> = {
  lavender: { bg: "#9370DB", border: "#7B68EE", desc: "K2-EDTA (Hematology / CBC)", capClass: "bg-purple-600 text-white" },
  purple: { bg: "#8A2BE2", border: "#7B68EE", desc: "K2-EDTA (Hematology / CBC)", capClass: "bg-purple-700 text-white" },
  gold: { bg: "#FFD700", border: "#DAA520", desc: "SST / Gel Separator (Biochemistry & Serology)", capClass: "bg-amber-400 text-amber-950" },
  yellow: { bg: "#FFEE58", border: "#FDD835", desc: "SST / ACD (Biochemistry & Immunology)", capClass: "bg-yellow-400 text-yellow-950" },
  "light blue": { bg: "#38BDF8", border: "#0284C7", desc: "Sodium Citrate (Coagulation / PT/INR)", capClass: "bg-sky-400 text-sky-950" },
  blue: { bg: "#0284C7", border: "#0369A1", desc: "Sodium Citrate (Coagulation)", capClass: "bg-blue-600 text-white" },
  red: { bg: "#EF4444", border: "#DC2626", desc: "Plain Clot Activator (Serology & Blood Bank)", capClass: "bg-red-600 text-white" },
  green: { bg: "#10B981", border: "#059669", desc: "Sodium / Lithium Heparin (Clinical Chemistry)", capClass: "bg-emerald-500 text-white" },
  gray: { bg: "#9CA3AF", border: "#6B7280", desc: "Sodium Fluoride / Potassium Oxalate (Glucose)", capClass: "bg-gray-500 text-white" },
  grey: { bg: "#9CA3AF", border: "#6B7280", desc: "Sodium Fluoride / Potassium Oxalate (Glucose)", capClass: "bg-gray-500 text-white" },
  pink: { bg: "#F472B6", border: "#DB2777", desc: "K2-EDTA (Blood Bank & Crossmatch)", capClass: "bg-pink-400 text-pink-950" },
  "royal blue": { bg: "#2563EB", border: "#1D4ED8", desc: "K2-EDTA (Trace Elements / Toxicology)", capClass: "bg-blue-700 text-white" },
};

export function getTubeStyle(colorName?: string) {
  if (!colorName) return { bg: "#94A3B8", border: "#64748B", desc: "Standard Collection Tube", capClass: "bg-slate-500 text-white" };
  const key = colorName.trim().toLowerCase();
  return TUBE_COLOR_MAP[key] || { bg: colorName, border: "#64748B", desc: `${colorName} Top Tube`, capClass: "bg-slate-600 text-white" };
}

export function generateSampleBarcode(testIdNum?: number | string) {
  const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, "");
  const rand = Math.floor(100 + Math.random() * 900);
  const idPart = String(testIdNum || "0000").padStart(4, "0");
  return `SMP-${dateStr}-${idPart}-${rand}`;
}

const today = () => new Date().toISOString().split("T")[0];

/** Real-time clinical evaluation of numerical/textual values against normal reference range */
export function evaluateResultRange(value: string | number, rangeStr: string): "normal" | "high" | "low" | "abnormal" | "neutral" {
  if (value === "" || value === null || value === undefined || !rangeStr) return "neutral";
  const strVal = String(value).trim().toLowerCase();
  const strRange = rangeStr.trim().toLowerCase();

  // Qualitative checks
  if (strRange.includes("negative") || strRange.includes("non-reactive") || strRange.includes("normal")) {
    if (strVal.includes("positive") || strVal.includes("reactive") || strVal.includes("abnormal") || strVal === "+") {
      return "abnormal";
    }
    if (strVal.includes("negative") || strVal.includes("non-reactive") || strVal.includes("normal") || strVal === "-") {
      return "normal";
    }
  }

  const num = parseFloat(strVal);
  if (isNaN(num)) return "neutral";

  // Format: "min - max" e.g. "70 - 110" or "4.0 - 10.0"
  const dashMatch = rangeStr.match(/([\d.]+)\s*-\s*([\d.]+)/);
  if (dashMatch) {
    const min = parseFloat(dashMatch[1]);
    const max = parseFloat(dashMatch[2]);
    if (!isNaN(min) && num < min) return "low";
    if (!isNaN(max) && num > max) return "high";
    return "normal";
  }

  // Format: "< max" or "<= max"
  const lessMatch = rangeStr.match(/<=\s*([\d.]+)|<\s*([\d.]+)/);
  if (lessMatch) {
    const max = parseFloat(lessMatch[1] || lessMatch[2]);
    if (!isNaN(max) && num > max) return "high";
    return "normal";
  }

  // Format: "> min" or ">= min"
  const greaterMatch = rangeStr.match(/>=\s*([\d.]+)|>\s*([\d.]+)/);
  if (greaterMatch) {
    const min = parseFloat(greaterMatch[1] || greaterMatch[2]);
    if (!isNaN(min) && num < min) return "low";
    return "normal";
  }

  return "neutral";
}

function Field({
  label,
  required,
  hint,
  icon,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  icon?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold flex items-center gap-1.5 text-muted-foreground">
          {icon && <Icon icon={icon} size={14} className="text-muted-foreground/70" />}
          <span>{label}</span>
          {required && <span className="text-destructive font-bold">*</span>}
        </Label>
        {hint && <span className="text-[10px] text-muted-foreground">{hint}</span>}
      </div>
      <div>{children}</div>
    </div>
  );
}

function CollapsibleSection({
  title,
  icon,
  badge,
  open,
  onToggle,
  children,
}: {
  title: string;
  icon?: string;
  badge?: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-border/80 rounded-xl bg-card overflow-hidden shadow-xs">
      <button
        type="button"
        className="flex items-center justify-between p-4 w-full text-left bg-muted/20 hover:bg-muted/40 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center gap-2.5">
          {icon && <Icon icon={icon} size={18} className="text-primary" />}
          <span className="text-sm font-bold text-foreground">{title}</span>
          {badge}
        </div>
        <Icon
          icon={open ? "solar:alt-arrow-up-bold" : "solar:alt-arrow-down-bold"}
          size={16}
          className="text-muted-foreground"
        />
      </button>
      {open && <div className="p-4 pt-3 border-t border-border/60">{children}</div>}
    </div>
  );
}

function errMessage(e: any, fallback: string): string {
  const d = e?.response?.data ?? e?.data ?? e;
  if (typeof d === "string" && d) return d;
  if (d?.detail) return String(d.detail);
  if (d && typeof d === "object") {
    const first = Object.entries(d)[0];
    if (first) {
      return Array.isArray(first[1])
        ? `${first[0]}: ${first[1][0]}`
        : `${first[0]}: ${String(first[1])}`;
    }
  }
  return fallback;
}

export default function LabTestForm({ testId }: { testId?: number }) {
  const navigate = useNavigate();
  const { canCreate, canWrite, canSubmit, canCancel } = useDoctypePermissions("Lab Test");
  const isApprover = useHasRole("LabTest Approver");

  const isSaved = !!testId;
  const [saving, setSaving] = useState(false);
  const [labTest, setLabTest] = useState<LabTest | null>(null);

  const [patients, setPatients] = useState<Patient[]>([]);
  const [practitioners, setPractitioners] = useState<HealthcarePractitioner[]>([]);
  const [departments, setDepartments] = useState<MedicalDepartment[]>([]);
  const [templates, setTemplates] = useState<LabTestTemplate[]>([]);
  const [uoms, setUoms] = useState<LabTestUOM[]>([]);
  const [approvalRequired, setApprovalRequired] = useState(false);

  // Child rows
  const [normalRows, setNormalRows] = useState<FormNormalRow[]>([]);
  const [descriptiveRows, setDescriptiveRows] = useState<FormDescriptiveRow[]>([]);
  const [sensitivityRows, setSensitivityRows] = useState<(SensitivityTestResultRow & { _idx?: number })[]>([]);
  const [organismRows, setOrganismRows] = useState<(OrganismTestResultRow & { _idx?: number })[]>([]);
  const [codes, setCodes] = useState<CodificationRow[]>([]);
  const [codePreview, setCodePreview] = useState<CodificationRow[]>([]);

  // Collapsible sections
  const [sections, setSections] = useState<Record<string, boolean>>({
    results: true,
    patient: true,
    details: true,
    coding: false,
    remarks: true,
  });
  const toggle = (k: string) => setSections((s) => ({ ...s, [k]: !s[k] }));

  const [form, setForm] = useState<Record<string, any>>({
    naming_series: "HLC-LAB-.YYYY.-",
    company: "EEU (Demo)",
    template: null,
    lab_test_name: "",
    date: today(),
    time: new Date().toTimeString().slice(0, 5),
    patient: null,
    patient_name: "",
    patient_age: "",
    patient_sex: "",
    report_preference: "Print",
    email: "",
    mobile: "",
    practitioner: null,
    department: null as number | null,
    requesting_department: null as number | null,
    service_unit: null,
    employee: "",
    lab_test_comment: "",
    custom_result: "",
    descriptive_result: "",
    worksheet_instructions: "",
    legend_print_position: "Bottom",
    result_legend: "",
    result: "",
    normal_range: "",
    encounter: null,
    prescription: null,
    service_request: null,
    invoiced: false,
    lockedPicks: false,
    normal_toggle: false,
    descriptive_toggle: false,
    imaging_toggle: false,
    sensitivity_toggle: false,
  });

  const [templateSearch, setTemplateSearch] = useState("");
  const [selectedTemplateFull, setSelectedTemplateFull] = useState<LabTestTemplate | null>(null);

  // Dialogs
  const [showEncounterDialog, setShowEncounterDialog] = useState(false);
  const [showPrintReportModal, setShowPrintReportModal] = useState(false);
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const [receiveForm, setReceiveForm] = useState({
    condition: "Acceptable",
    temperature: "Ambient",
    notes: "",
  });

  const [rejectForm, setRejectForm] = useState({
    condition: "Hemolyzed",
    rejection_reason: "",
  });

  const [rxList, setRxList] = useState<LabPrescription[]>([]);
  const [encounterMap, setEncounterMap] = useState<Record<number, PatientEncounter>>({});
  const [dialogLoading, setDialogLoading] = useState(false);

  const update = (key: string, value: any) => setForm((prev) => ({ ...prev, [key]: value }));

  const selectedPatient = useMemo(() => {
    if (!form.patient) return null;
    return patients.find((p) => p.id === form.patient) || null;
  }, [form.patient, patients]);

  const selectedPractitioner = useMemo(() => {
    if (!form.practitioner) return null;
    return practitioners.find((p) => p.id === form.practitioner) || null;
  }, [form.practitioner, practitioners]);

  const load = useCallback(async () => {
    if (!testId) {
      setLabTest(null);
      setNormalRows([]);
      setDescriptiveRows([]);
      setSensitivityRows([]);
      setOrganismRows([]);
      setCodes([]);
      return;
    }
    try {
      const t: LabTest = await HealthcareApi.labTests.get(testId);
      setLabTest(t);
      setForm({
        naming_series: t.naming_series,
        company: t.company,
        template: t.template,
        lab_test_name: t.lab_test_name,
        date: t.date,
        time: t.time ?? "",
        patient: t.patient,
        patient_name: t.patient_name,
        patient_age: t.patient_age,
        patient_sex: t.patient_sex,
        report_preference: t.report_preference,
        email: t.email,
        mobile: t.mobile,
        practitioner: t.practitioner,
        department: t.department ?? null,
        requesting_department: t.requesting_department ?? null,
        service_unit: t.service_unit,
        employee: t.employee,
        lab_test_comment: t.lab_test_comment,
        custom_result: t.custom_result,
        descriptive_result: t.descriptive_result,
        worksheet_instructions: t.worksheet_instructions,
        legend_print_position: t.legend_print_position,
        result_legend: t.result_legend,
        result: t.result,
        normal_range: t.normal_range,
        encounter: t.encounter,
        prescription: t.prescription,
        service_request: t.service_request,
        invoiced: t.invoiced,
        lockedPicks: true,
        normal_toggle: t.normal_toggle,
        descriptive_toggle: t.descriptive_toggle,
        imaging_toggle: t.imaging_toggle,
        sensitivity_toggle: t.sensitivity_toggle,
      });
      setTemplateSearch(t.template_name || "");
      setNormalRows(t.normal_test_items ?? []);
      setDescriptiveRows(t.descriptive_test_items ?? []);
      setSensitivityRows(t.sensitivity_test_items ?? []);
      setOrganismRows(t.organism_test_items ?? []);
      setCodes(t.codification_table ?? []);
    } catch (err) {
      toast.error(errMessage(err, "Failed to load the Lab Test"));
    }
  }, [testId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    Promise.all([
      HealthcareApi.patients.list({ page_size: 500 }),
      HealthcareApi.practitioners.list({ page_size: 200 }),
      HealthcareApi.departments.list({ page_size: 200 }),
      HealthcareApi.labTestTemplates.list({ page_size: 500 }),
      HealthcareApi.labTestUOMs.list({ page_size: 200 }),
      HealthcareApi.healthcareSettings.list().catch(() => ({ results: [] })),
    ])
      .then(
        ([
          pats,
          pracs,
          depts,
          tmpls,
          uomsRes,
          settings,
        ]: any[]) => {
          setPatients(pats.results || []);
          setPractitioners(pracs.results || []);
          setDepartments(depts.results || []);
          setTemplates(tmpls.results || []);
          setUoms(uomsRes.results || []);
          setApprovalRequired(!!(settings.results || [])[0]?.lab_test_approval_required);
        }
      )
      .catch(() => { });
  }, []);

  const status: string = labTest?.status ?? "Draft";
  const editable = status === "Draft";
  const lockPicks = isSaved || form.lockedPicks;
  const showActions = !!labTest && status === "Completed" && (isApprover || !approvalRequired);
  const showEncounterButton = !isSaved;

  const specimenStatus = (labTest?.specimen_status || "Pending Collection") as
    | "Pending Collection"
    | "Collected"
    | "Received"
    | "Rejected"
    | "Not Required";

  const isSpecimenRequired = specimenStatus !== "Not Required";
  const isCollected = specimenStatus === "Collected" || specimenStatus === "Received";
  const isReceived = specimenStatus === "Received";
  const isRejected = specimenStatus === "Rejected";

  const canEnterResults = editable;

  const handleGoToSampleCollection = () => {
    if (!testId) {
      toast.error("Please save the Lab Test order first before collecting a sample");
      return;
    }
    const sampleId = labTest?.sample;
    if (sampleId && !isNaN(Number(sampleId)) && Number(sampleId) > 0) {
      navigate(`/healthcare/sample-collections/${sampleId}?from=lab-test&lab_test=${testId}`);
    } else {
      const testName = form.lab_test_name || labTest?.lab_test_name || "";
      const isUrine = testName.toLowerCase().includes("urine");
      const defaultSampleName = labTest?.template_sample_name || labTest?.sample_name || (isUrine ? "Urine" : "Blood");
      const defaultColor = labTest?.container_closure_color || (isUrine ? "Yellow" : "Lavender");
      const defaultSite = labTest?.collection_site || (isUrine ? "Midstream Clean-Catch Urine" : "Venipuncture (Left Antecubital)");

      const params = new URLSearchParams({
        from: "lab-test",
        lab_test: String(testId),
        patient: form.patient ? String(form.patient) : "",
        patient_name: form.patient_name || "",
        patient_age: form.patient_age || "",
        patient_sex: form.patient_sex || "",
        practitioner: form.practitioner ? String(form.practitioner) : "",
        service_unit: form.service_unit ? String(form.service_unit) : "",
        lab_test_name: testName,
        sample_name: defaultSampleName,
        sample_uom: labTest?.sample_uom || "ml",
        sample_qty: String(labTest?.sample_qty && Number(labTest.sample_qty) > 0 ? labTest.sample_qty : 1),
        color: defaultColor,
        site: defaultSite,
        barcode: labTest?.specimen_barcode || "",
        details: labTest?.sample_details || `Specimen collection for ${testName || "diagnostic testing"}`,
      });
      navigate(`/healthcare/sample-collections/new?${params.toString()}`);
    }
  };

  const handleReceiveSpecimen = async () => {
    if (!testId) return;
    setActionLoading(true);
    try {
      await HealthcareApi.labTests.receiveSpecimen(testId, {
        condition: receiveForm.condition,
        temperature: receiveForm.temperature,
      });
      toast.success("Specimen verified & received! Results entry unlocked.");
      setShowReceiveModal(false);
      load();
    } catch (err) {
      toast.error(errMessage(err, "Failed to receive specimen"));
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectSpecimen = async () => {
    if (!testId) return;
    if (!rejectForm.rejection_reason.trim()) {
      toast.error("Please enter a clinical reason for specimen rejection");
      return;
    }
    setActionLoading(true);
    try {
      await HealthcareApi.labTests.rejectSpecimen(testId, {
        rejection_reason: rejectForm.rejection_reason,
        condition: rejectForm.condition,
      });
      toast.warning("Specimen marked as rejected");
      setShowRejectModal(false);
      load();
    } catch (err) {
      toast.error(errMessage(err, "Failed to reject specimen"));
    } finally {
      setActionLoading(false);
    }
  };

  const pickPatient = async (pid: number | null) => {
    update("patient", pid);
    if (!pid) {
      setForm((prev) => ({
        ...prev,
        patient: null,
        patient_name: "",
        patient_age: "",
        patient_sex: "",
        report_preference: "Print",
        email: "",
        mobile: "",
      }));
      return;
    }
    try {
      const p: any = await HealthcareApi.patients.get(pid);
      setForm((prev) => ({
        ...prev,
        patient: pid,
        patient_name: p.patient_name || `${p.first_name || ""} ${p.last_name || ""}`.trim(),
        patient_age: formatAge(p.dob, p.age) || (p.age ? `${p.age} Year(s)` : ""),
        patient_sex: p.sex || "",
        report_preference: p.report_preference || "Print",
        email: p.email || "",
        mobile: p.mobile || "",
      }));
    } catch {
      /* the backend fetches these on insert anyway */
    }
  };

  const pickTemplate = async (t: LabTestTemplate | null) => {
    if (!t) return;
    update("template", t.id);
    update("lab_test_name", t.lab_test_name);
    if ((t as any).department) {
      update("department", (t as any).department);
    }
    setTemplateSearch(t.lab_test_name);

    try {
      const full: LabTestTemplate = await HealthcareApi.labTestTemplates.get(t.id);
      setSelectedTemplateFull(full);
      setCodes([]);
      setCodePreview((full as any).codification_table ?? []);

      const type = full.lab_test_template_type || "Compound";
      const isNormal = type === "Single" || type === "Compound" || type === "Grouped";
      const isDescriptive = type === "Descriptive";
      const isImaging = type === "Imaging";

      update("normal_toggle", isNormal);
      update("descriptive_toggle", isDescriptive);
      update("imaging_toggle", isImaging);
      update("sensitivity_toggle", !!full.sensitivity);

      // On a new (unsaved) test, populate the parameter rows directly so the lab tech can see normal ranges and enter values!
      if (!isSaved) {
        if (full.normal_test_templates && full.normal_test_templates.length > 0) {
          setNormalRows(
            full.normal_test_templates.map((nt, idx) => ({
              id: undefined as any,
              _idx: idx,
              lab_test_name: nt.lab_test_event,
              lab_test_event: nt.lab_test_event,
              lab_test_uom: nt.lab_test_uom,
              lab_test_uom_name: nt.lab_test_uom_name,
              normal_range: nt.normal_range,
              result_value: "",
            }))
          );
        } else if (isNormal) {
          setNormalRows([
            {
              id: undefined as any,
              _idx: 0,
              lab_test_name: full.lab_test_name,
              lab_test_event: full.lab_test_name,
              lab_test_uom: full.lab_test_uom,
              lab_test_uom_name: full.uom_name,
              normal_range: full.lab_test_normal_range,
              result_value: "",
            },
          ]);
        }

        if (full.descriptive_test_templates && full.descriptive_test_templates.length > 0) {
          setDescriptiveRows(
            full.descriptive_test_templates.map((dt, idx) => ({
              id: undefined as any,
              _idx: idx,
              lab_test_particulars: dt.particulars,
              result_value: "",
            }))
          );
        }
      }
    } catch {
      setCodePreview([]);
    }
  };

  const payload = () => ({
    naming_series: form.naming_series,
    company: form.company,
    template: form.template,
    lab_test_name: form.lab_test_name,
    date: form.date,
    time: form.time ? (form.time.length === 5 ? `${form.time}:00` : form.time) : null,
    patient: form.patient,
    patient_age: form.patient_age,
    patient_sex: form.patient_sex,
    report_preference: form.report_preference,
    email: form.email,
    mobile: form.mobile,
    practitioner: form.practitioner,
    department: form.department ?? null,
    requesting_department: form.requesting_department ?? null,
    requesting_practitioner: form.practitioner,
    service_unit: form.service_unit,
    employee: form.employee,
    lab_test_comment: form.lab_test_comment,
    custom_result: form.custom_result,
    descriptive_result: form.descriptive_result ?? "",
    worksheet_instructions: form.worksheet_instructions,
    legend_print_position: form.legend_print_position,
    result_legend: form.result_legend,
    result: form.result,
    normal_range: form.normal_range,
    encounter: form.encounter ?? null,
    prescription: form.prescription ?? null,
    service_request: form.service_request ?? null,
    invoiced: !!form.invoiced,
  });

  const handleSave = async () => {
    if (!form.patient) {
      toast.error("Please select a Patient");
      return;
    }
    if (!form.template) {
      toast.error("Please select a Lab Test Template");
      return;
    }
    setSaving(true);
    try {
      if (isSaved) {
        await HealthcareApi.labTests.update(testId!, payload());

        // Persist all analyte rows that have result values
        if (normalRows.length > 0) {
          const rowUpdates = normalRows
            .filter((r) => r.id)
            .map((r) =>
              HealthcareApi.normalTestResults.update(r.id, {
                result_value: r.result_value ?? "",
                lab_test_comment: r.lab_test_comment ?? "",
              })
            );
          await Promise.allSettled(rowUpdates);
        }

        if (descriptiveRows.length > 0) {
          const descUpdates = descriptiveRows
            .filter((r) => r.id)
            .map((r) =>
              HealthcareApi.descriptiveTestResults.update(r.id, {
                result_value: r.result_value ?? "",
              })
            );
          await Promise.allSettled(descUpdates);
        }

        toast.success("Lab Test and results saved successfully");
        load();
      } else {
        const created: any = await HealthcareApi.labTests.create(payload() as any);
        toast.success(`Lab Test ${created.test_id || ""} created successfully`);

        // If user entered result values before save, sync them to the created test's child rows
        if (created.id && normalRows.some((r) => r.result_value)) {
          try {
            const fresh: LabTest = await HealthcareApi.labTests.get(created.id);
            const freshNormals = fresh.normal_test_items || [];
            for (let i = 0; i < freshNormals.length; i++) {
              const matchingPre =
                normalRows.find(
                  (p) =>
                    p.lab_test_name &&
                    freshNormals[i].lab_test_name &&
                    p.lab_test_name === freshNormals[i].lab_test_name
                ) || normalRows[i];

              if (matchingPre && matchingPre.result_value) {
                await HealthcareApi.normalTestResults.update(freshNormals[i].id, {
                  result_value: matchingPre.result_value,
                });
              }
            }
          } catch {
            /* ignore background sync */
          }
        }

        navigate(`/healthcare/lab-tests/${created.id}`, { replace: true });
      }
    } catch (err) {
      toast.error(errMessage(err, "Failed to save the Lab Test"));
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    if (!testId || !isSaved) {
      toast.error("Please save the Lab Test draft first before submitting");
      return;
    }
    try {
      if (canWrite && isSaved) {
        await HealthcareApi.labTests.update(testId!, payload());

        // Ensure all normalRows are persisted before submitting
        if (normalRows.length > 0) {
          const rowUpdates = normalRows
            .filter((r) => r.id)
            .map((r) =>
              HealthcareApi.normalTestResults.update(r.id, {
                result_value: r.result_value ?? "",
                lab_test_comment: r.lab_test_comment ?? "",
              })
            );
          await Promise.allSettled(rowUpdates);
        }
      }
      await HealthcareApi.labTests.submit(testId!);
      toast.success("Lab Test submitted for Pathologist verification");
      load();
    } catch (err) {
      toast.error(errMessage(err, "Failed to submit Lab Test"));
    }
  };

  const handleCancel = async () => {
    if (!confirm("Are you sure you want to cancel this Lab Test?")) return;
    try {
      await HealthcareApi.labTests.cancel(testId!);
      toast.success("Lab Test cancelled");
      load();
    } catch (err) {
      toast.error(errMessage(err, "Failed to cancel"));
    }
  };

  const handleApprove = async () => {
    try {
      await HealthcareApi.labTests.approve(testId!);
      toast.success("Lab Test verified and approved!");
      load();
    } catch (err) {
      toast.error(errMessage(err, "Failed to approve"));
    }
  };

  const handleReject = async () => {
    try {
      await HealthcareApi.labTests.reject(testId!);
      toast.warning("Lab Test marked as rejected");
      load();
    } catch (err) {
      toast.error(errMessage(err, "Failed to reject"));
    }
  };

  // "Get from Patient Encounter" Dialog
  const openEncounterDialog = async () => {
    if (!form.patient) {
      toast.error("Please select a Patient first to look up lab orders");
      return;
    }
    setDialogLoading(true);
    setShowEncounterDialog(true);
    try {
      const [rxs, encs]: any[] = await Promise.all([
        HealthcareApi.labPrescriptions.list({ patient: form.patient, page_size: 200 }),
        HealthcareApi.encounters.list({ patient: form.patient, page_size: 200 }),
      ]);
      const map: Record<number, PatientEncounter> = {};
      for (const e of encs.results || []) map[e.id] = e;
      setEncounterMap(map);
      setRxList(
        (rxs.results || []).filter((rx: LabPrescription) => !rx.lab_test_created && rx.lab_test_code)
      );
    } catch (err) {
      toast.error(errMessage(err, "Failed to load prescribed Lab Tests"));
    } finally {
      setDialogLoading(false);
    }
  };

  const takePrescription = (rx: LabPrescription) => {
    const enc = rx.encounter ? encounterMap[rx.encounter] : undefined;
    setForm((prev) => ({
      ...prev,
      template: rx.lab_test_code,
      lab_test_name: rx.lab_test_name,
      practitioner: enc?.practitioner ?? prev.practitioner,
      encounter: rx.encounter,
      prescription: rx.id,
      service_request: rx.service_request ?? null,
      invoiced: rx.invoiced,
      lockedPicks: true,
    }));
    setTemplateSearch(rx.lab_test_name);

    const matchingTpl = templates.find((t) => t.id === rx.lab_test_code);
    if (matchingTpl) {
      pickTemplate(matchingTpl);
    } else if (rx.lab_test_code) {
      HealthcareApi.labTestTemplates
        .get(rx.lab_test_code)
        .then((t: any) => pickTemplate(t))
        .catch(() => { });
    }

    setShowEncounterDialog(false);
    toast.success(`Linked lab order: ${rx.lab_test_name}`);
  };

  // Row Manipulation
  const editRow = async (
    kind: "normal" | "descriptive" | "sensitivity" | "organism",
    row: any,
    key: string,
    value: any
  ) => {
    const set =
      kind === "normal"
        ? setNormalRows
        : kind === "descriptive"
          ? setDescriptiveRows
          : kind === "sensitivity"
            ? setSensitivityRows
            : setOrganismRows;

    set((rows: any[]) =>
      rows.map((r, i) => {
        const isMatch = r.id ? r.id === row.id : (r._idx !== undefined && r._idx === row._idx) || i === row._idx;
        return isMatch ? { ...r, [key]: value } : r;
      })
    );

    // If unsaved test, just keep in component state
    if (!isSaved || !row.id) {
      return;
    }

    try {
      const api =
        kind === "normal"
          ? HealthcareApi.normalTestResults
          : kind === "descriptive"
            ? HealthcareApi.descriptiveTestResults
            : kind === "sensitivity"
              ? HealthcareApi.sensitivityTestResults
              : HealthcareApi.organismTestResults;
      await api.update(row.id, { [key]: value } as any);
    } catch (err) {
      toast.error(errMessage(err, "Failed to save the row"));
      load();
    }
  };

  const addRow = async (kind: "normal" | "descriptive" | "sensitivity" | "organism") => {
    if (!isSaved) {
      if (kind === "normal") {
        setNormalRows((prev) => [
          ...prev,
          {
            id: undefined as any,
            _idx: prev.length,
            lab_test_name: "New Analyte",
            lab_test_event: "Parameter",
            result_value: "",
            normal_range: "",
          },
        ]);
      }
      return;
    }

    const base: any = {
      lab_test: testId,
      idx:
        kind === "normal"
          ? normalRows.length
          : kind === "descriptive"
            ? descriptiveRows.length
            : kind === "sensitivity"
              ? sensitivityRows.length
              : organismRows.length,
    };
    try {
      const api =
        kind === "normal"
          ? HealthcareApi.normalTestResults
          : kind === "descriptive"
            ? HealthcareApi.descriptiveTestResults
            : kind === "sensitivity"
              ? HealthcareApi.sensitivityTestResults
              : HealthcareApi.organismTestResults;
      await api.create(base);
      load();
    } catch (err) {
      toast.error(errMessage(err, "Failed to add a row"));
    }
  };

  const handlePreFillNormals = async () => {
    let changed = 0;
    const updated = normalRows.map((r) => {
      if (r.result_value) return r;
      const range = r.normal_range || "";
      const match = range.match(/([\d.]+)\s*-\s*([\d.]+)/);
      if (match) {
        const mid = ((parseFloat(match[1]) + parseFloat(match[2])) / 2).toFixed(1);
        changed++;
        return { ...r, result_value: mid };
      }
      if (range.toLowerCase().includes("negative")) {
        changed++;
        return { ...r, result_value: "Negative" };
      }
      return r;
    });

    setNormalRows(updated);

    if (isSaved && changed > 0) {
      try {
        const promises = updated
          .filter((r) => r.id && r.result_value)
          .map((r) =>
            HealthcareApi.normalTestResults.update(r.id, {
              result_value: r.result_value,
            })
          );
        await Promise.allSettled(promises);
        toast.success(`Pre-filled and saved ${changed} normal reference values`);
      } catch (err) {
        toast.info("Pre-filled typical normal reference values");
      }
    } else {
      toast.info("Pre-filled typical normal reference values");
    }
  };

  const displayedCodes = isSaved ? codes : codePreview;
  const uomsById = useMemo(() => {
    const m: Record<number, string> = {};
    for (const u of uoms) m[u.id] = u.lab_test_uom ?? "";
    return m;
  }, [uoms]);

  const hasNormalToggle = Boolean(form.normal_toggle || labTest?.normal_toggle);
  const hasDescriptiveToggle = Boolean(form.descriptive_toggle || labTest?.descriptive_toggle);
  const hasImagingToggle = Boolean(form.imaging_toggle || labTest?.imaging_toggle);
  const hasSensitivityToggle = Boolean(form.sensitivity_toggle || labTest?.sensitivity_toggle);

  const completedParametersCount = normalRows.filter((r) => r.result_value && String(r.result_value).trim().length > 0).length;

  return (
    <div className="max-w-6xl mx-auto pb-24 space-y-6">
      {/* ── Top Clinical Command Bar ────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-card border shadow-xs">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-cyan-500/10 text-cyan-600 flex items-center justify-center shrink-0">
            <Icon icon="solar:test-tube-bold-duotone" size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <button onClick={() => navigate("/healthcare")} className="hover:text-foreground">
                Healthcare
              </button>
              <span>/</span>
              <button onClick={() => navigate("/healthcare/lab-tests")} className="hover:text-foreground">
                Lab Tests
              </button>
              <span>/</span>
              <span className="font-semibold text-foreground">
                {isSaved ? (labTest?.test_id || `LAB-${testId}`) : "New Order"}
              </span>
            </div>
            <div className="flex items-center gap-2.5 mt-0.5">
              <h1 className="text-xl font-bold tracking-tight text-foreground">
                {form.lab_test_name || (isSaved ? "Lab Test Investigation" : "New Lab Test Order")}
              </h1>
              <Badge
                variant="outline"
                className={cn("text-xs font-semibold px-2.5 py-0.5", statusBadge[status]?.bg)}
              >
                <Icon icon={statusBadge[status]?.icon || "solar:clock-circle-bold"} size={13} className="mr-1" />
                {statusBadge[status]?.text || status}
              </Badge>
              {isSaved && (
                <Badge
                  variant="outline"
                  className={cn("text-xs font-semibold px-2.5 py-0.5", specimenBadge[specimenStatus]?.bg)}
                >
                  <Icon icon={specimenBadge[specimenStatus]?.icon || "solar:test-tube-broken"} size={13} className="mr-1" />
                  {specimenBadge[specimenStatus]?.text || specimenStatus}
                </Badge>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {showEncounterButton && (
            <Button
              variant="outline"
              size="sm"
              onClick={openEncounterDialog}
              className="gap-1.5 border-cyan-500/30 text-cyan-700 dark:text-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-950/20"
            >
              <Icon icon="solar:clipboard-list-bold" size={15} />
              Get from Encounter
            </Button>
          )}

          {isSaved && !isCollected && !isReceived && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleGoToSampleCollection}
              className="gap-1.5 border-amber-500/40 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/20 font-semibold"
            >
              <Icon icon="solar:test-tube-bold" size={15} />
              Collect Sample
            </Button>
          )}

          {isSaved && labTest?.sample && !isNaN(Number(labTest.sample)) && Number(labTest.sample) > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleGoToSampleCollection}
              className="gap-1.5 border-cyan-500/40 text-cyan-700 dark:text-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-950/20 text-xs"
            >
              <Icon icon="solar:test-tube-minimalistic-bold" size={14} />
              Sample #{labTest.sample}
            </Button>
          )}

          {isSaved && isCollected && !isReceived && (
            <Button
              size="sm"
              onClick={() => setShowReceiveModal(true)}
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-xs"
            >
              <Icon icon="solar:check-circle-bold" size={15} />
              Receive Specimen
            </Button>
          )}

          {isSaved && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPrintReportModal(true)}
              className="gap-1.5"
            >
              <Icon icon="solar:printer-bold" size={15} />
              Print Report
            </Button>
          )}

          {editable && (
            <Button
              onClick={handleSave}
              disabled={saving || (!isSaved ? !canCreate : !canWrite)}
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-xs"
            >
              {saving ? (
                <>
                  <Icon icon="solar:refresh-circle-bold" className="animate-spin" size={15} />
                  Saving...
                </>
              ) : (
                <>
                  <Icon icon="solar:disk-bold" size={15} />
                  Save Draft
                </>
              )}
            </Button>
          )}

          {status === "Draft" && isSaved && (
            <Button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-xs"
            >
              <Icon icon="solar:check-circle-bold" size={15} />
              Submit Results
            </Button>
          )}

          {showActions && (
            <>
              <Button
                variant="outline"
                onClick={handleApprove}
                className="gap-1.5 text-emerald-700 border-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
              >
                <Icon icon="solar:verified-check-bold" size={15} />
                Approve Test
              </Button>
              <Button
                variant="outline"
                onClick={handleReject}
                className="gap-1.5 text-rose-700 border-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/20"
              >
                <Icon icon="solar:close-circle-bold" size={15} />
                Reject
              </Button>
            </>
          )}

          {["Completed", "Approved", "Rejected"].includes(status) && (
            <Button variant="ghost" size="sm" onClick={handleCancel} disabled={!canCancel} className="text-muted-foreground hover:text-destructive">
              Cancel Test
            </Button>
          )}
        </div>
      </div>

      {/* ── Stepper: Clinical Laboratory Workflow ──────────────────────────── */}
      <div className="p-3.5 rounded-xl bg-card border shadow-xs overflow-x-auto">
        <div className="flex items-center justify-between min-w-[700px] gap-2">
          {[
            { step: 1, title: "1. Order Created", active: true, done: isSaved },
            { step: 2, title: "2. Findings & Results", active: isSaved && status === "Draft", done: isSaved && (completedParametersCount > 0 || status !== "Draft") },
            { step: 3, title: "3. Submitted", active: isSaved && status === "Draft", done: status === "Completed" || status === "Approved" },
            { step: 4, title: "4. Approved & Released", active: status === "Completed", done: status === "Approved" },
          ].map((s, idx) => (
            <div key={idx} className="flex items-center gap-2 flex-1">
              <div
                className={cn(
                  "h-7 w-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 transition-colors",
                  s.done
                    ? "bg-emerald-600 text-white"
                    : s.active
                      ? "bg-cyan-500/20 text-cyan-600 border border-cyan-500/40"
                      : "bg-muted text-muted-foreground"
                )}
              >
                {s.done ? <Icon icon="solar:check-circle-bold" size={14} /> : s.step}
              </div>
              <div className="min-w-0">
                <span className={cn("text-xs font-semibold block truncate", s.active ? "text-foreground" : "text-muted-foreground")}>
                  {s.title}
                </span>
              </div>
              {idx < 4 && <div className={cn("h-0.5 flex-1 rounded", s.done ? "bg-emerald-500/50" : "bg-muted")} />}
            </div>
          ))}
        </div>
      </div>

      {/* ── Patient Identity Card Banner ──────────────────────────────────── */}
      {selectedPatient && (
        <Card className="border-cyan-500/30 bg-gradient-to-r from-cyan-500/5 via-card to-card shadow-xs">
          <CardContent className="p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="h-12 w-12 rounded-2xl bg-cyan-500/10 text-cyan-600 border border-cyan-500/20 flex items-center justify-center font-bold text-base shadow-xs">
                {selectedPatient.patient_name ? selectedPatient.patient_name.slice(0, 2).toUpperCase() : "PT"}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base font-bold text-foreground">
                    {form.patient_name || selectedPatient.patient_name}
                  </h3>
                  <Badge variant="outline" className="font-mono text-[10px] bg-muted/50">
                    {selectedPatient.patient_id || `ID #${selectedPatient.id}`}
                  </Badge>
                  {form.patient_sex && (
                    <Badge variant="secondary" className="text-[10px]">
                      {form.patient_sex}
                    </Badge>
                  )}
                  {form.patient_age && (
                    <Badge variant="secondary" className="text-[10px]">
                      {form.patient_age}
                    </Badge>
                  )}
                  {selectedPractitioner && (
                    <Badge variant="outline" className="text-[10px] text-cyan-700 dark:text-cyan-400 border-cyan-500/30 bg-cyan-500/5">
                      Doctor: {selectedPractitioner.practitioner_name}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1 flex-wrap">
                  {selectedPatient.mobile && (
                    <span className="flex items-center gap-1">
                      <Icon icon="solar:phone-bold" size={12} />
                      {selectedPatient.mobile}
                    </span>
                  )}
                  {selectedPatient.email && (
                    <span className="flex items-center gap-1">
                      <Icon icon="solar:letter-bold" size={12} />
                      {selectedPatient.email}
                    </span>
                  )}
                  {selectedPatient.blood_group && (
                    <span className="font-bold text-destructive">
                      Blood: {selectedPatient.blood_group}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1"
                onClick={() => navigate(`/healthcare/patients/${selectedPatient.id}`)}
              >
                <Icon icon="solar:user-id-bold" size={14} />
                Patient Chart
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Section 1: Order Details & Template Picker ────────────────────── */}
      <Card className="shadow-xs">
        <CardHeader className="pb-3 border-b bg-muted/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Icon icon="solar:document-text-bold-duotone" size={20} className="text-primary" />
              <CardTitle className="text-base font-bold">1. Diagnostic Order & Specimen Configuration</CardTitle>
            </div>
            <span className="text-xs text-muted-foreground">Formulary Standards</span>
          </div>
        </CardHeader>

        <CardContent className="pt-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label="Patient" required icon="solar:user-bold">
              <EntitySelect
                options={patients.map((p) => ({
                  value: p.id,
                  label: p.patient_name || `${p.first_name || ""} ${p.last_name || ""}`.trim(),
                  sublabel: p.patient_id,
                  image: p.image,
                }))}
                value={form.patient}
                onChange={(v) => {
                  if (!editable || lockPicks) return;
                  pickPatient(v);
                }}
                placeholder="Select Patient..."
                emptyText="No patients found"
                doctype="Patient"
                rawItems={patients}
                onOptionAdded={(opt, p) => {
                  if (p) setPatients((prev) => [...prev, p]);
                  pickPatient(opt.value);
                }}
                triggerClassName="h-9"
              />
            </Field>

            <Field label="Lab Test Template" required icon="solar:test-tube-bold">
              <Combobox
                options={templates.map((t) => t.lab_test_name)}
                value={templateSearch}
                disabled={!editable || lockPicks}
                onChange={(name) => {
                  setTemplateSearch(name);
                  const t = templates.find((tpl) => tpl.lab_test_name === name);
                  pickTemplate(t || null);
                }}
                placeholder="Choose Lab Test Template..."
                doctype="Lab Test Template"
                rawItems={templates}
                onItemCreated={(t) => {
                  setTemplates((prev) => [...prev, t]);
                  pickTemplate(t);
                }}
                className="h-9"
              />
            </Field>

            <Field label="Medical Department" icon="solar:hospital-bold">
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                value={form.department ?? labTest?.department ?? ""}
                disabled={!editable}
                onChange={(e) => update("department", e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">Select Medical Department...</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.department}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          {/* Diagnostic Context Bar */}
          {selectedTemplateFull && (
            <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-cyan-500/10 text-cyan-600 border border-cyan-500/20">
                  {selectedTemplateFull.lab_test_template_type || "Compound"} Test
                </span>
                {hasSensitivityToggle && (
                  <Badge variant="outline" className="text-[10px] text-purple-600 border-purple-500/30 bg-purple-500/5">
                    Sensitivity Required
                  </Badge>
                )}
                <span className="font-semibold text-foreground">
                  {selectedTemplateFull.lab_test_name}
                </span>
                {selectedTemplateFull.sample_name && (
                  <span className="text-muted-foreground">
                    • Specimen: <strong className="text-foreground">{selectedTemplateFull.sample_name}</strong>
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 font-mono text-[11px] text-muted-foreground">
                {selectedTemplateFull.lab_test_rate > 0 && (
                  <span className="font-bold text-emerald-600">
                    Fee: ${Number(selectedTemplateFull.lab_test_rate).toFixed(2)}
                  </span>
                )}
                <span>Code: {selectedTemplateFull.lab_test_code || "AUTO"}</span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-1">
            <Field label="Ordering Practitioner" icon="solar:user-speak-bold">
              <EntitySelect
                options={practitioners.map((p) => ({
                  value: p.id,
                  label: p.practitioner_name,
                  avatarName: `${p.first_name || ""} ${p.last_name || ""}`,
                  sublabel: p.designation || p.department_name,
                  image: p.image,
                }))}
                value={form.practitioner}
                onChange={(v) => editable && update("practitioner", v)}
                placeholder="Select Practitioner..."
                emptyText="No practitioners found"
                tone="blue"
                doctype="Healthcare Practitioner"
                rawItems={practitioners}
                triggerClassName="h-9"
              />
            </Field>

            <Field label="Order Date" icon="solar:calendar-bold">
              <Input
                type="date"
                value={form.date || ""}
                disabled={!editable}
                onChange={(e) => update("date", e.target.value)}
                className="h-9 text-xs"
              />
            </Field>

            <Field label="Sample ID / Barcode" icon="solar:scanner-bold">
              <Input
                value={labTest?.sample_name || (isSaved ? "COLLECTED" : "To Be Collected")}
                readOnly
                className="h-9 text-xs font-mono bg-muted/40"
              />
            </Field>

            <Field label="Report Preference" icon="solar:printer-bold">
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium shadow-xs"
                value={form.report_preference || "Print"}
                disabled={!editable}
                onChange={(e) => update("report_preference", e.target.value)}
              >
                <option value="Print">Print Hardcopy Report</option>
                <option value="Email">Email Secure PDF</option>
                <option value="SMS">SMS Notification</option>
                <option value="In Person">Collect In Person</option>
              </select>
            </Field>
          </div>
        </CardContent>
      </Card>

      {/* ── Section 2: Clinical Results Entry Table ────────────────────────── */}
      <Card className="shadow-xs border-border">
        <CardHeader className="pb-3 border-b bg-muted/20">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold text-sm">
                2
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <Icon icon="solar:checklist-minimalistic-bold-duotone" size={20} className="text-emerald-600" />
                    2. Investigation Findings & Results Entry
                  </CardTitle>
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                    {completedParametersCount} of {normalRows.length} Entered
                  </span>
                </div>
                <CardDescription className="text-xs text-muted-foreground mt-0.5">
                  Input analyte findings. Values are automatically checked against reference ranges.
                </CardDescription>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {editable && normalRows.length > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handlePreFillNormals}
                  className="h-8 text-xs gap-1 text-muted-foreground hover:text-foreground"
                >
                  <Icon icon="solar:magic-stick-bold" size={14} />
                  Fill Normals
                </Button>
              )}
              {editable && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addRow("normal")}
                  className="h-8 text-xs gap-1 border-emerald-500/30 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
                >
                  <Icon icon="solar:add-circle-bold" size={14} />
                  Add Analyte
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">

          {/* Compound / Normal Analyte Result Grid */}
          {(hasNormalToggle || normalRows.length > 0 || !form.template) && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/40 border-b text-muted-foreground font-semibold">
                  <tr className="text-left">
                    <th className="p-3 w-8 text-center">#</th>
                    <th className="p-3 w-56">Test Component / Analyte</th>
                    <th className="p-3 w-40">Sub-Event</th>
                    <th className="p-3 w-48">Result Value</th>
                    <th className="p-3 w-28">Status Flag</th>
                    <th className="p-3 w-32">Unit (UOM)</th>
                    <th className="p-3 w-44">Reference Normal Range</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {normalRows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-xs text-muted-foreground">
                        <Icon icon="solar:test-tube-broken" size={28} className="mx-auto mb-2 text-muted-foreground/60" />
                        {form.template
                          ? "No predefined analytes on this template. Click '+ Add Analyte' to enter custom parameters."
                          : "Please select a Lab Test Template above to load investigation parameters."}
                      </td>
                    </tr>
                  ) : (
                    normalRows.map((row, idx) => {
                      const flag = evaluateResultRange(row.result_value ?? "", row.normal_range ?? "");

                      return (
                        <tr key={row.id ?? `pre-${idx}`} className="hover:bg-muted/15 transition-colors">
                          <td className="p-3 text-center font-mono text-muted-foreground">
                            {idx + 1}
                          </td>
                          <td className="p-3 font-semibold text-foreground">
                            {row.lab_test_name || row.lab_test_event || "Analyte"}
                          </td>
                          <td className="p-3 text-muted-foreground">
                            {row.lab_test_event || "—"}
                          </td>

                          {/* Editable Result Value with Live Alert */}
                          <td className="p-3">
                            <Input
                              value={row.result_value ?? ""}
                              disabled={!editable}
                              onChange={(e) => editRow("normal", row, "result_value", e.target.value)}
                              placeholder="Enter value..."
                              className={cn(
                                "h-8 text-xs font-bold font-mono transition-colors",
                                flag === "high" && "border-destructive/60 bg-destructive/5 text-destructive font-extrabold",
                                flag === "low" && "border-blue-500/60 bg-blue-500/5 text-blue-600 font-extrabold",
                                flag === "normal" && "border-emerald-500/60 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400"
                              )}
                            />
                          </td>

                          {/* Status Flag Badge */}
                          <td className="p-3">
                            {flag === "high" && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-600 border border-rose-500/20">
                                HIGH ▲
                              </span>
                            )}
                            {flag === "low" && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-600 border border-blue-500/20">
                                LOW ▼
                              </span>
                            )}
                            {flag === "normal" && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                                NORMAL ✓
                              </span>
                            )}
                            {flag === "abnormal" && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20">
                                ABNORMAL ⚠️
                              </span>
                            )}
                            {flag === "neutral" && (
                              <span className="text-muted-foreground font-mono">—</span>
                            )}
                          </td>

                          {/* UOM */}
                          <td className="p-3 text-muted-foreground font-medium">
                            {(row.lab_test_uom ? uomsById[row.lab_test_uom] : undefined) || row.lab_test_uom_name || "—"}
                          </td>

                          {/* Normal Reference Range */}
                          <td className="p-3 font-mono text-[11px] text-muted-foreground">
                            {row.normal_range || "—"}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Descriptive / Imaging Findings */}
          {(hasImagingToggle || hasDescriptiveToggle) && (
            <div className="p-4 border-t space-y-3 bg-muted/10">
              <Label className="text-xs font-semibold block">
                Clinical Impression & Descriptive Findings
              </Label>
              <textarea
                className="w-full border border-input rounded-xl p-3 text-xs bg-background shadow-xs min-h-[120px] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono transition-colors"
                value={form.descriptive_result ?? ""}
                disabled={!editable}
                onChange={(e) => update("descriptive_result", e.target.value)}
                placeholder="Enter radiological or microscopic diagnostic findings, organ descriptions, and impression..."
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Section: Standard Medical Codification (LOINC / SNOMED) ─────────── */}
      {displayedCodes.length > 0 && (
        <Card className="shadow-xs">
          <CardHeader className="pb-3 border-b bg-muted/20">
            <div className="flex items-center gap-2">
              <Icon icon="solar:code-square-bold-duotone" size={20} className="text-primary" />
              <CardTitle className="text-base font-bold">Standard Medical Codification (LOINC / SNOMED)</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="flex flex-wrap gap-2.5">
              {displayedCodes.map((c, i) => (
                <div key={i} className="px-3 py-1.5 rounded-xl border bg-muted/40 text-xs flex items-center gap-2 font-mono">
                  <span className="font-bold text-primary">{c.code_system_name || "Code"}:</span>
                  <span className="font-semibold text-foreground">{c.code_value}</span>
                  {(c.display || c.definition) && (
                    <span className="text-muted-foreground text-[11px]">({c.display || c.definition})</span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Section 3: Pathology Notes & Remarks ────────────────────────────── */}
      <CollapsibleSection
        title="Pathology Comments & Clinical Review Notes"
        icon="solar:notes-bold-duotone"
        open={sections.remarks}
        onToggle={() => toggle("remarks")}
      >
        <div className="space-y-4">
          <div>
            <Label className="text-xs font-semibold mb-1.5 block">
              Pathologist / Laboratory Remarks (Printed on final report)
            </Label>
            <textarea
              className="w-full border border-input rounded-xl p-3 text-xs bg-background shadow-xs min-h-[90px] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={form.lab_test_comment || ""}
              disabled={!editable}
              onChange={(e) => update("lab_test_comment", e.target.value)}
              placeholder="e.g. Mild microcytic hypochromic anemia observed. Recommend serum ferritin and iron studies correlation."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Analyzing Technician / Employee" icon="solar:user-id-bold">
              <Combobox
                doctype="Employee"
                options={practitioners.map((p) => p.practitioner_name)}
                value={form.employee}
                disabled={!editable}
                onChange={(val) => update("employee", val)}
                placeholder="Select Lab Technician..."
                className="h-9"
              />
            </Field>

            <Field label="Worksheet Instructions" icon="solar:clipboard-check-bold">
              <Input
                value={form.worksheet_instructions || ""}
                disabled={!editable}
                onChange={(e) => update("worksheet_instructions", e.target.value)}
                placeholder="Special bench instructions..."
                className="h-9 text-xs"
              />
            </Field>
          </div>
        </div>
      </CollapsibleSection>

      {/* ── Sticky Bottom Floating Action Bar ──────────────────────────────── */}
      <div className="sticky bottom-4 z-40 flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-card/95 backdrop-blur-md border shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-600">
            <Icon icon="solar:test-tube-bold-duotone" size={24} />
          </div>
          <div>
            <h4 className="text-sm font-bold text-foreground">
              {form.patient_name ? `${form.patient_name} • ${form.lab_test_name || "Lab Test"}` : "Diagnostic Order"}
            </h4>
            <p className="text-xs text-muted-foreground">
              Status: <span className="font-semibold text-foreground">{status}</span> • {completedParametersCount} of {normalRows.length} parameters completed
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <Button
            variant="outline"
            onClick={() => navigate("/healthcare/lab-tests")}
            disabled={saving}
          >
            Cancel & Exit
          </Button>
          {editable && (
            <Button
              onClick={handleSave}
              disabled={saving || (!isSaved ? !canCreate : !canWrite)}
              className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 shadow-md"
            >
              {saving ? (
                <>
                  <Icon icon="solar:refresh-circle-bold" className="animate-spin" size={16} />
                  Saving...
                </>
              ) : (
                <>
                  <Icon icon="solar:disk-bold" size={16} />
                  {isSaved ? "Update Results" : "Create Lab Test Order"}
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* ── Dialog: Get from Patient Encounter ─────────────────────────────── */}
      <Dialog open={showEncounterDialog} onOpenChange={setShowEncounterDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <div className="flex items-center gap-2 text-cyan-600">
              <Icon icon="solar:clipboard-list-bold-duotone" size={24} />
              <DialogTitle className="text-base font-bold">
                Prescribed Lab Tests for {form.patient_name || "Patient"}
              </DialogTitle>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {dialogLoading ? (
              <div className="p-8 text-center text-xs text-muted-foreground">
                <Icon icon="solar:refresh-circle-bold" className="animate-spin mx-auto mb-2 text-primary" size={22} />
                Loading prescribed lab investigations...
              </div>
            ) : rxList.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground space-y-2">
                <Icon icon="solar:notes-minimalistic-broken" size={32} className="mx-auto text-muted-foreground/60" />
                <p className="font-semibold text-foreground">No Pending Lab Prescriptions</p>
                <p>This patient has no unfulfilled laboratory orders from recent clinical encounters.</p>
              </div>
            ) : (
              <div className="divide-y border rounded-xl overflow-hidden">
                {rxList.map((rx) => {
                  const enc = rx.encounter ? encounterMap[rx.encounter] : undefined;
                  return (
                    <div
                      key={rx.id}
                      className="p-3.5 flex items-center justify-between hover:bg-muted/20 transition-colors"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-foreground">{rx.lab_test_name}</span>
                          {rx.invoiced && (
                            <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-500/30">
                              Invoiced
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Doctor: {enc?.practitioner_name || "Attending Physician"} • Date: {enc?.encounter_date || "Recent"}
                        </p>
                        {rx.lab_test_comment && (
                          <p className="text-[11px] text-slate-500 mt-1 italic">"{rx.lab_test_comment}"</p>
                        )}
                      </div>
                      <Button
                        size="sm"
                        onClick={() => takePrescription(rx)}
                        className="bg-cyan-600 hover:bg-cyan-700 text-white text-xs gap-1.5 font-semibold"
                      >
                        <Icon icon="solar:add-circle-bold" size={14} />
                        Select Order
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Clinical Diagnostic Report Preview ───────────────────────── */}
      <Dialog open={showPrintReportModal} onOpenChange={setShowPrintReportModal}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="border-b pb-3">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <Icon icon="solar:printer-bold-duotone" size={20} className="text-primary" />
                Laboratory Diagnostic Report Preview
              </DialogTitle>
              <Button
                size="sm"
                onClick={() => window.print()}
                className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
              >
                <Icon icon="solar:printer-bold" size={14} />
                Print Official Slip
              </Button>
            </div>
          </DialogHeader>

          <div id="lab-test-print-area" className="p-6 bg-white text-slate-900 space-y-6 border rounded-xl">
            {/* Header */}
            <div className="border-b pb-4 flex justify-between items-start">
              <div>
                <h1 className="text-xl font-bold tracking-tight text-slate-900">
                  {form.company || "MEDICAL LABORATORY DIAGNOSTICS"}
                </h1>
                <p className="text-xs text-slate-500">Department of Clinical Pathology & Laboratory Medicine</p>
              </div>
              <div className="text-right">
                <p className="font-mono text-xs font-semibold text-slate-700">
                  {labTest?.test_id || `LAB-${testId}`}
                </p>
                <p className="text-xs text-slate-500">
                  Status: <strong className="text-slate-800">{status}</strong>
                </p>
                <p className="text-xs text-slate-500">
                  Date: {form.date || today()} {form.time || ""}
                </p>
              </div>
            </div>

            {/* Patient & Request Details */}
            <div className="grid grid-cols-2 gap-4 p-3 bg-slate-50 rounded-lg text-xs border border-slate-200">
              <div>
                <p><span className="text-slate-500 font-medium">Patient:</span> <strong className="text-slate-900">{form.patient_name || "—"}</strong></p>
                <p><span className="text-slate-500">Age / Sex:</span> {form.patient_age || "—"} / {form.patient_sex || "—"}</p>
                <p><span className="text-slate-500">Contact:</span> {form.mobile || form.email || "—"}</p>
              </div>
              <div>
                <p><span className="text-slate-500 font-medium">Investigation:</span> <strong className="text-slate-900">{form.lab_test_name || "—"}</strong></p>
                <p><span className="text-slate-500">Practitioner:</span> {form.practitioner_name || "—"}</p>
                <p><span className="text-slate-500">Department:</span> {form.department_name || "—"}</p>
              </div>
            </div>

            {/* Results Table */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 border-b pb-1">
                Investigation Results & Reference Standards
              </h3>

              {normalRows.length > 0 && (
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="border-b text-slate-600">
                      <th className="text-left py-2">Test Component</th>
                      <th className="text-left py-2">Result Value</th>
                      <th className="text-left py-2">Status Flag</th>
                      <th className="text-left py-2">Normal Range</th>
                      <th className="text-left py-2">Units</th>
                    </tr>
                  </thead>
                  <tbody>
                    {normalRows.map((r, i) => {
                      const flag = evaluateResultRange(r.result_value ?? "", r.normal_range ?? "");
                      return (
                        <tr key={i} className="border-b border-slate-100">
                          <td className="py-2 font-medium">{r.lab_test_name}</td>
                          <td className={cn(
                            "py-2 font-bold font-mono",
                            flag === "high" && "text-red-600 font-extrabold",
                            flag === "low" && "text-blue-600 font-extrabold",
                            flag === "normal" && "text-emerald-700"
                          )}>
                            {r.result_value || "—"}
                          </td>
                          <td className="py-2">
                            {flag === "high" && <span className="text-[10px] font-bold text-red-600">HIGH ▲</span>}
                            {flag === "low" && <span className="text-[10px] font-bold text-blue-600">LOW ▼</span>}
                            {flag === "normal" && <span className="text-[10px] font-bold text-emerald-600">NORMAL</span>}
                            {flag === "neutral" && <span className="text-slate-400">—</span>}
                          </td>
                          <td className="py-2 text-slate-600">{r.normal_range || "—"}</td>
                          <td className="py-2 text-slate-600">{(r.lab_test_uom ? uomsById[r.lab_test_uom] : undefined) || r.lab_test_uom_name || "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}

              {descriptiveRows.length > 0 && (
                <table className="w-full text-xs border-collapse mt-3">
                  <thead>
                    <tr className="border-b text-slate-600">
                      <th className="text-left py-2">Particulars</th>
                      <th className="text-left py-2">Findings</th>
                    </tr>
                  </thead>
                  <tbody>
                    {descriptiveRows.map((r, i) => (
                      <tr key={i} className="border-b border-slate-100">
                        <td className="py-2 font-medium">{r.lab_test_particulars}</td>
                        <td className="py-2 text-slate-900">{r.result_value || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {form.descriptive_result && (
                <div className="p-3 bg-slate-50 rounded-lg text-xs mt-3">
                  <p className="font-semibold text-slate-700 mb-1">Diagnostic Impression:</p>
                  <p className="text-slate-800 whitespace-pre-wrap">{form.descriptive_result}</p>
                </div>
              )}

              {form.lab_test_comment && (
                <div className="p-3 bg-amber-50/50 border border-amber-200/50 rounded-lg text-xs mt-3">
                  <p className="font-semibold text-slate-700">Lab Remarks:</p>
                  <p className="text-slate-600 mt-1 whitespace-pre-wrap">{form.lab_test_comment}</p>
                </div>
              )}
            </div>

            {/* Signature Block */}
            <div className="pt-8 border-t flex justify-between items-end text-xs text-slate-500">
              <div>
                <p className="font-medium text-slate-700">Report End</p>
                <p className="text-[10px] text-slate-400">Printed on {new Date().toLocaleString()}</p>
              </div>
              <div className="text-right">
                <div className="w-48 border-b border-slate-400 mb-1" />
                <p className="font-medium text-slate-800">Verified Medical Technologist / Pathologist</p>
                <p className="text-[10px] text-slate-400">Clinical Laboratory Accreditation</p>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>



      {/* ── Dialog 2: Specimen Receipt & Accessioning Acceptance ──────────── */}
      <Dialog open={showReceiveModal} onOpenChange={setShowReceiveModal}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <div className="flex items-center gap-2.5 text-emerald-600">
              <div className="p-2 rounded-xl bg-emerald-500/10">
                <Icon icon="solar:verified-check-bold" size={24} />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-foreground">
                  Accessioning Bench: Verify & Receive Specimen
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Inspect physical specimen integrity upon arrival at laboratory bench, verify barcode identity, and unlock result entry.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            {/* Custody Snapshot */}
            <div className="p-3 rounded-xl bg-muted/40 border grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <span className="text-[10px] font-semibold text-muted-foreground uppercase">Barcode</span>
                <p className="font-mono font-bold text-xs text-foreground mt-0.5">{labTest?.specimen_barcode || "—"}</p>
              </div>
              <div>
                <span className="text-[10px] font-semibold text-muted-foreground uppercase">Patient</span>
                <p className="font-bold text-xs text-foreground mt-0.5 truncate">{form.patient_name || "—"}</p>
              </div>
              <div>
                <span className="text-[10px] font-semibold text-muted-foreground uppercase">Phlebotomist</span>
                <p className="font-medium text-xs text-foreground mt-0.5">{labTest?.collected_by || "Phlebotomist"}</p>
              </div>
              <div>
                <span className="text-[10px] font-semibold text-muted-foreground uppercase">Collected</span>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {labTest?.collection_datetime ? new Date(labTest.collection_datetime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Recent"}
                </p>
              </div>
            </div>

            {/* Verification Inputs */}
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold flex items-center gap-1">
                  <Icon icon="solar:shield-check-bold" size={13} className="text-emerald-600" />
                  Specimen Physical Integrity / Visual Inspection <span className="text-rose-500">*</span>
                </Label>
                <select
                  value={receiveForm.condition}
                  onChange={(e) => setReceiveForm((prev) => ({ ...prev, condition: e.target.value }))}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="Acceptable">Acceptable / Intact (Optimal specimen quality)</option>
                  <option value="Hemolyzed (Mild)">Hemolyzed — Mild / Trace (Spectrophotometric caution)</option>
                  <option value="Hemolyzed (Gross)">Hemolyzed — Gross (Recollection may be needed)</option>
                  <option value="Clotted">Clotted (Interferes with cell counts)</option>
                  <option value="Lipemic">Lipemic / Turbid (Interferes with optical readings)</option>
                  <option value="QNS">QNS (Quantity Not Sufficient)</option>
                  <option value="Leaked / Damaged">Leaked / Compromised Container</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold flex items-center gap-1">
                  <Icon icon="solar:snowflake-bold" size={13} className="text-sky-600" />
                  Transport & Arrival Temperature <span className="text-rose-500">*</span>
                </Label>
                <select
                  value={receiveForm.temperature}
                  onChange={(e) => setReceiveForm((prev) => ({ ...prev, temperature: e.target.value }))}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="Ambient">Ambient (15°C – 25°C)</option>
                  <option value="Refrigerated">Refrigerated / Wet Ice (2°C – 8°C)</option>
                  <option value="Frozen">Frozen / Dry Ice (-20°C)</option>
                  <option value="Deep Frozen">Deep Frozen (-80°C)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Accessioning Notes / Observations (Optional)</Label>
                <Input
                  value={receiveForm.notes}
                  onChange={(e) => setReceiveForm((prev) => ({ ...prev, notes: e.target.value }))}
                  placeholder="e.g. Centrifuged at 3000 RPM for 10 min. Clear serum separated."
                  className="h-9 text-xs"
                />
              </div>
            </div>

            {/* Clinical Gate Unlock Announcement */}
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-2.5 text-emerald-800 dark:text-emerald-300">
              <Icon icon="solar:lock-unlocked-bold" size={18} className="shrink-0 mt-0.5 text-emerald-600" />
              <div className="space-y-0.5 text-[11px]">
                <p className="font-bold">Result Entry Gate Activation:</p>
                <p className="text-emerald-700 dark:text-emerald-400">
                  Accepting this specimen formally registers it as <strong>Received</strong> in the laboratory management module. The investigation findings table and analyte input fields will unlock immediately for testing and result entry.
                </p>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              type="button"
              onClick={() => setShowReceiveModal(false)}
              disabled={actionLoading}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowReceiveModal(false);
                setShowRejectModal(true);
              }}
              className="text-rose-600 border-rose-300 hover:bg-rose-50"
              disabled={actionLoading}
            >
              <Icon icon="solar:close-circle-bold" size={14} className="mr-1" />
              Defective / Reject Specimen
            </Button>
            <Button
              type="button"
              onClick={handleReceiveSpecimen}
              disabled={actionLoading}
              className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
            >
              {actionLoading ? (
                <>
                  <Icon icon="solar:refresh-circle-bold" className="animate-spin" size={15} />
                  Accepting Specimen...
                </>
              ) : (
                <>
                  <Icon icon="solar:check-circle-bold" size={15} />
                  Accept Specimen & Unlock Results
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog 3: Reject Non-Conforming Specimen ────────────────────────── */}
      <Dialog open={showRejectModal} onOpenChange={setShowRejectModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-2.5 text-rose-600">
              <div className="p-2 rounded-xl bg-rose-500/10">
                <Icon icon="solar:danger-triangle-bold" size={24} />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-foreground">
                  Reject Specimen (Non-Conforming Sample)
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Formally reject a non-conforming specimen, enforce result entry locking, and flag order for recollection.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            {/* Warning Alert */}
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-2.5 text-rose-800 dark:text-rose-300">
              <Icon icon="solar:shield-warning-bold" size={18} className="shrink-0 mt-0.5 text-rose-600" />
              <div className="space-y-0.5 text-[11px]">
                <p className="font-bold">Laboratory Safety Enforcement:</p>
                <p className="text-rose-700 dark:text-rose-400">
                  Rejecting this specimen flags the sample as defective. Results cannot be entered or submitted for this test until a new physical specimen is recollected and accepted.
                </p>
              </div>
            </div>

            {/* Specimen Info */}
            <div className="p-3 rounded-lg bg-muted/40 border flex items-center justify-between text-xs">
              <div>
                <p className="font-bold text-foreground">{form.lab_test_name || "Lab Investigation"}</p>
                <p className="text-muted-foreground text-[11px]">Patient: {form.patient_name || "—"}</p>
              </div>
              <div className="text-right">
                <span className="font-mono font-bold text-rose-600 text-xs">{labTest?.specimen_barcode || "Specimen"}</span>
                <p className="text-[10px] text-muted-foreground">Status: Non-Conforming</p>
              </div>
            </div>

            {/* Rejection Form Fields */}
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold flex items-center gap-1">
                  <Icon icon="solar:close-circle-bold" size={13} className="text-rose-600" />
                  Rejection Classification / Defect Type <span className="text-rose-500">*</span>
                </Label>
                <select
                  value={rejectForm.condition}
                  onChange={(e) => setRejectForm((prev) => ({ ...prev, condition: e.target.value }))}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="Hemolyzed">Hemolyzed (Gross hemolysis invalidates potassium/LDH/enzymes)</option>
                  <option value="Clotted">Clotted (Invalidates CBC and coagulation assays)</option>
                  <option value="QNS">QNS — Quantity Not Sufficient (Minimum volume not met)</option>
                  <option value="Mislabeled / Unlabeled">Mislabeled / Unlabeled / Discrepant patient identifier</option>
                  <option value="Wrong Tube / Additive">Specimen in Wrong Tube / Incompatible additive</option>
                  <option value="Leaked Container">Leaked / Damaged Container (Biohazard integrity compromised)</option>
                  <option value="Temperature Excursion">Temperature Excursion during transit</option>
                  <option value="Stability Exceeded">Stability Exceeded / Transport time limit expired</option>
                  <option value="Other Deficiency">Other Laboratory Deficiency</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  Clinical Rejection Justification Note <span className="text-rose-500">*</span>
                </Label>
                <textarea
                  value={rejectForm.rejection_reason}
                  onChange={(e) => setRejectForm((prev) => ({ ...prev, rejection_reason: e.target.value }))}
                  placeholder="Document specific findings (e.g., tube received broken, severe hemolysis in serum, notified Ward 3 nurse for urgent recollection)..."
                  className="w-full min-h-[90px] rounded-md border border-input bg-background p-2.5 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              type="button"
              onClick={() => setShowRejectModal(false)}
              disabled={actionLoading}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleRejectSpecimen}
              disabled={actionLoading || !rejectForm.rejection_reason.trim()}
              className="gap-2 bg-rose-600 hover:bg-rose-700 text-white font-bold"
            >
              {actionLoading ? (
                <>
                  <Icon icon="solar:refresh-circle-bold" className="animate-spin" size={15} />
                  Rejecting Specimen...
                </>
              ) : (
                <>
                  <Icon icon="solar:close-circle-bold" size={15} />
                  Confirm Specimen Rejection
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
