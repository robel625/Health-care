/**
 * The Lab Test Template form — Enterprise Diagnostic Template Designer.
 *
 * One component serves both new and existing templates. Features 1-click clinical
 * presets (CBC, Lipid Panel, LFT, BMP, Urinalysis, TFT), interactive template type
 * selectors, visual tube guide, and child tables for analytes, groups, and LOINC codes.
 */
import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router";
import { Icon } from "@/components/icon";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { Badge } from "@/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/ui/card";
import Tag from "antd/es/tag";
import { toast } from "sonner";
import Combobox from "@/components/healthcare/Combobox";
import EncounterGrid, {
  GridCell,
  GridDetailField,
  GridDetailRow,
  GridRowActions,
  useExpandedRows,
} from "@/components/healthcare/EncounterGrid";
import { HealthcareApi } from "@/api/services/healthcareService";
import type {
  CodificationRow,
  DescriptiveTestTemplateRow,
  DoctypeFormMeta,
  LabTestGroupTemplateRow,
  LabTestSample,
  LabTestTemplate,
  LabTestUOM,
  MedicalDepartment,
  NormalTestTemplateRow,
} from "@/api/services/healthcareService";
import { fieldOptions } from "@/utils/doctypeMeta";
import { useDoctypePermissions } from "@/utils/permissions";
import { cn } from "@/utils";

type Tab = "details" | "result" | "sample" | "coding" | "worksheet";

function Field({
  label,
  required,
  hint,
  icon,
  children,
  className,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  icon?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
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

function CheckboxField({
  label,
  checked,
  onChange,
  hint,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  hint?: string;
}) {
  return (
    <div>
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          className="rounded text-emerald-600 focus:ring-emerald-500"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="text-xs font-semibold text-foreground">{label}</span>
      </label>
      {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Section({
  title,
  hint,
  icon,
  children,
  collapsible,
  defaultOpen = true,
}: {
  title?: string;
  hint?: string;
  icon?: string;
  children: React.ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  if (!title) return <section className="space-y-4">{children}</section>;
  return (
    <div className="border border-border/70 rounded-xl bg-card overflow-hidden shadow-xs">
      <div className="bg-muted/20 px-4 py-3 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon && <Icon icon={icon} size={18} className="text-primary" />}
          <div>
            <h3 className="text-sm font-bold text-foreground">{title}</h3>
            {hint && <p className="text-[11px] text-muted-foreground mt-0.5">{hint}</p>}
          </div>
        </div>
        {collapsible && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="text-muted-foreground hover:text-foreground"
          >
            <Icon icon={open ? "solar:alt-arrow-up-bold" : "solar:alt-arrow-down-bold"} size={16} />
          </button>
        )}
      </div>
      {open && <div className="p-5">{children}</div>}
    </div>
  );
}

const emptyNormalRow = (): NormalTestTemplateRow => ({
  lab_test_event: "",
  lab_test_uom: null,
  normal_range: "",
  secondary_uom: null,
  conversion_factor: null,
  allow_blank: false,
});

const emptyDescriptiveRow = (): DescriptiveTestTemplateRow => ({
  particulars: "",
  allow_blank: false,
});

const emptyGroupRow = (): LabTestGroupTemplateRow => ({
  template_or_new_line: "Add Test",
  lab_test_template: null,
  lab_test_rate: 0,
  lab_test_description: "",
  group_event: "",
  group_test_uom: null,
  group_test_normal_range: "",
  secondary_uom: null,
  conversion_factor: null,
  allow_blank: false,
});

const emptyCodificationRow = (): CodificationRow => ({
  id: 0,
  encounter: null,
  lab_test_template: null,
  code_system: null,
  code_system_name: "",
  system: "",
  is_fhir_defined: false,
  oid: "",
  code_value: null,
  code_value_display: "",
  code: "",
  display: "",
  definition: "",
});

const DERIVED_KEYS = [
  "id", "idx", "parent_template",
  "lab_test_uom_name", "secondary_uom_name", "group_test_uom_name",
  "lab_test_template_name", "code_system_name", "code_value_display",
];

const rowSignature = (row: Record<string, any>) =>
  JSON.stringify(
    Object.fromEntries(Object.entries(row).filter(([k]) => !DERIVED_KEYS.includes(k)))
  );

type ChildApi = {
  create: (data: any) => Promise<any>;
  update: (id: number, data: any) => Promise<any>;
  delete: (id: number) => Promise<any>;
};

async function syncChildren<T extends { id?: number }>(
  api: ChildApi,
  parentId: number,
  rows: T[],
  savedSignatures: Map<number, string>,
  toPayload: (row: T, idx: number) => Record<string, any>
) {
  const kept = new Set(rows.map((r) => r.id).filter((id): id is number => !!id));
  for (const id of savedSignatures.keys()) {
    if (!kept.has(id)) await api.delete(id).catch(() => {});
  }
  for (let i = 0; i < rows.length; i++) {
    const payload = { ...toPayload(rows[i], i), parent_template: parentId };
    const id = rows[i].id;
    if (id) {
      if (savedSignatures.get(id) !== rowSignature(payload)) await api.update(id, payload);
    } else {
      await api.create(payload);
    }
  }
}

const signaturesOf = (rows: Record<string, any>[] | undefined) =>
  new Map<number, string>(
    (rows || [])
      .filter((r) => !!r.id)
      .map((r) => [r.id as number, rowSignature(r)])
  );

// ─────────────────────────────────────────────────────────────────────────────
// CLINICAL TEMPLATE PRESETS DEFINITION
// ─────────────────────────────────────────────────────────────────────────────
interface TemplatePreset {
  name: string;
  code: string;
  type: "Compound" | "Single" | "Descriptive" | "Imaging";
  deptKeyword: string;
  sampleKeyword: string;
  rate: number;
  sampleDetails: string;
  description: string;
  normals?: { event: string; uomName: string; range: string }[];
  descriptives?: { particulars: string }[];
}

const CLINICAL_PRESETS: TemplatePreset[] = [
  {
    name: "Complete Blood Count (CBC)",
    code: "CBC-PANEL",
    type: "Compound",
    deptKeyword: "Hematology",
    sampleKeyword: "Blood",
    rate: 25.0,
    sampleDetails: "Lavender top tube (K2-EDTA). Invert 8-10 times gently to mix.",
    description: "Comprehensive automated full blood count with differential and erythrocyte indices.",
    normals: [
      { event: "White Blood Cells (WBC)", uomName: "10^3/uL", range: "4.5 - 11.0" },
      { event: "Red Blood Cells (RBC)", uomName: "10^6/uL", range: "4.3 - 5.9" },
      { event: "Hemoglobin (Hb)", uomName: "g/dL", range: "13.5 - 17.5" },
      { event: "Hematocrit (Hct)", uomName: "%", range: "41.0 - 50.0" },
      { event: "Mean Corpuscular Volume (MCV)", uomName: "fL", range: "80.0 - 100.0" },
      { event: "Mean Corpuscular Hemoglobin (MCH)", uomName: "pg", range: "27.0 - 33.0" },
      { event: "MCHC", uomName: "g/dL", range: "32.0 - 36.0" },
      { event: "Platelets (PLT)", uomName: "10^3/uL", range: "150 - 450" },
      { event: "Neutrophils (%)", uomName: "%", range: "40.0 - 70.0" },
      { event: "Lymphocytes (%)", uomName: "%", range: "20.0 - 40.0" },
      { event: "Monocytes (%)", uomName: "%", range: "2.0 - 8.0" },
      { event: "Eosinophils (%)", uomName: "%", range: "1.0 - 4.0" },
    ],
  },
  {
    name: "Lipid Profile Panel",
    code: "LIPID-PROF",
    type: "Compound",
    deptKeyword: "Biochemistry",
    sampleKeyword: "Serum",
    rate: 30.0,
    sampleDetails: "10-12 hours fasting required. Gold top SST or red top tube.",
    description: "Evaluation of cardiovascular risk profile including cholesterol fractions and triglycerides.",
    normals: [
      { event: "Total Cholesterol", uomName: "mg/dL", range: "< 200" },
      { event: "Triglycerides", uomName: "mg/dL", range: "< 150" },
      { event: "HDL Cholesterol", uomName: "mg/dL", range: "> 40" },
      { event: "LDL Cholesterol (Calculated)", uomName: "mg/dL", range: "< 100" },
      { event: "VLDL Cholesterol", uomName: "mg/dL", range: "5 - 30" },
      { event: "Total / HDL Ratio", uomName: "ratio", range: "< 4.5" },
    ],
  },
  {
    name: "Liver Function Tests (LFT)",
    code: "LFT-PANEL",
    type: "Compound",
    deptKeyword: "Biochemistry",
    sampleKeyword: "Serum",
    rate: 35.0,
    sampleDetails: "Centrifuged serum. Protect from light for bilirubin testing.",
    description: "Hepatic integrity and synthesis markers including transaminases and protein fractions.",
    normals: [
      { event: "Total Bilirubin", uomName: "mg/dL", range: "0.2 - 1.2" },
      { event: "Direct (Conjugated) Bilirubin", uomName: "mg/dL", range: "0.0 - 0.3" },
      { event: "Alanine Aminotransferase (ALT/SGPT)", uomName: "U/L", range: "7 - 56" },
      { event: "Aspartate Aminotransferase (AST/SGOT)", uomName: "U/L", range: "10 - 40" },
      { event: "Alkaline Phosphatase (ALP)", uomName: "U/L", range: "44 - 147" },
      { event: "Total Protein", uomName: "g/dL", range: "6.0 - 8.3" },
      { event: "Albumin", uomName: "g/dL", range: "3.5 - 5.5" },
      { event: "Globulin", uomName: "g/dL", range: "2.0 - 3.5" },
    ],
  },
  {
    name: "Basic Metabolic Panel (BMP / RFT)",
    code: "BMP-PANEL",
    type: "Compound",
    deptKeyword: "Biochemistry",
    sampleKeyword: "Serum",
    rate: 30.0,
    sampleDetails: "Serum separator tube (SST). Fasting preferred for glucose.",
    description: "Renal clearance, glycemic status, and electrolyte homeostasis analysis.",
    normals: [
      { event: "Fasting Blood Glucose", uomName: "mg/dL", range: "70 - 99" },
      { event: "Blood Urea Nitrogen (BUN)", uomName: "mg/dL", range: "7 - 20" },
      { event: "Serum Creatinine", uomName: "mg/dL", range: "0.6 - 1.3" },
      { event: "Estimated GFR (eGFR)", uomName: "mL/min/1.73m2", range: "> 60" },
      { event: "Sodium (Na+)", uomName: "mmol/L", range: "135 - 145" },
      { event: "Potassium (K+)", uomName: "mmol/L", range: "3.5 - 5.0" },
      { event: "Chloride (Cl-)", uomName: "mmol/L", range: "96 - 106" },
      { event: "Calcium (Total)", uomName: "mg/dL", range: "8.5 - 10.5" },
    ],
  },
  {
    name: "Urinalysis Routine (U/A)",
    code: "UA-ROUTINE",
    type: "Compound",
    deptKeyword: "Pathology",
    sampleKeyword: "Urine",
    rate: 15.0,
    sampleDetails: "Clean catch midstream urine sample in sterile container.",
    description: "Physical, chemical strip, and microscopic sediment analysis of urine.",
    normals: [
      { event: "Color", uomName: "", range: "Pale Yellow to Amber" },
      { event: "Clarity / Appearance", uomName: "", range: "Clear" },
      { event: "Specific Gravity", uomName: "", range: "1.005 - 1.030" },
      { event: "pH", uomName: "", range: "4.5 - 8.0" },
      { event: "Protein (Dipstick)", uomName: "", range: "Negative" },
      { event: "Glucose (Dipstick)", uomName: "", range: "Negative" },
      { event: "Ketones", uomName: "", range: "Negative" },
      { event: "Bilirubin", uomName: "", range: "Negative" },
      { event: "Blood / Hemoglobin", uomName: "", range: "Negative" },
      { event: "Leukocyte Esterase", uomName: "", range: "Negative" },
      { event: "Nitrite", uomName: "", range: "Negative" },
      { event: "Microscopic WBC", uomName: "/HPF", range: "0 - 5" },
      { event: "Microscopic RBC", uomName: "/HPF", range: "0 - 3" },
    ],
  },
  {
    name: "Thyroid Function Profile (TFT)",
    code: "TFT-PROFILE",
    type: "Compound",
    deptKeyword: "Endocrinology",
    sampleKeyword: "Serum",
    rate: 40.0,
    sampleDetails: "Red top or SST tube. No recent biotin supplements.",
    description: "Pituitary-thyroid axis assessment measuring TSH and free thyroid hormones.",
    normals: [
      { event: "Thyroid Stimulating Hormone (TSH)", uomName: "uIU/mL", range: "0.45 - 4.50" },
      { event: "Free Triiodothyronine (FT3)", uomName: "pg/mL", range: "2.3 - 4.2" },
      { event: "Free Thyroxine (FT4)", uomName: "ng/dL", range: "0.8 - 1.8" },
    ],
  },
];

export default function LabTestTemplateForm({ templateId }: { templateId?: number }) {
  const isNew = templateId === undefined;
  const { canCreate, canWrite } = useDoctypePermissions("Lab Test Template");
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<Tab>("details");
  const [saving, setSaving] = useState(false);
  const [meta, setMeta] = useState<DoctypeFormMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(isNew);

  // Lookups
  const [departments, setDepartments] = useState<MedicalDepartment[]>([]);
  const [samples, setSamples] = useState<LabTestSample[]>([]);
  const [uoms, setUoms] = useState<LabTestUOM[]>([]);
  const [codeSystems, setCodeSystems] = useState<any[]>([]);
  const [codeValues, setCodeValues] = useState<any[]>([]);
  const [groupableTemplates, setGroupableTemplates] = useState<LabTestTemplate[]>([]);

  const [form, setForm] = useState<Partial<LabTestTemplate>>({
    lab_test_name: "",
    department: null,
    disabled: false,
    nursing_checklist_template: null,
    link_existing_item: false,
    item: null,
    lab_test_code: "",
    lab_test_group: null,
    is_billable: true,
    lab_test_rate: 0,
    lab_test_template_type: "Compound",
    lab_test_uom: null,
    secondary_uom: null,
    conversion_factor: null,
    lab_test_normal_range: "",
    sensitivity: false,
    sample: null,
    sample_qty: 3,
    sample_details: "",
    change_in_item: false,
    worksheet_instructions: "",
    legend_print_position: "Bottom",
    result_legend: "",
    patient_care_type: null,
    staff_role: null,
    lab_test_description: "",
    descriptive_result: "",
  });

  const [normalRows, setNormalRows] = useState<NormalTestTemplateRow[]>([]);
  const [descriptiveRows, setDescriptiveRows] = useState<DescriptiveTestTemplateRow[]>([]);
  const [groupRows, setGroupRows] = useState<LabTestGroupTemplateRow[]>([]);
  const [codingRows, setCodingRows] = useState<CodificationRow[]>([]);
  const [savedSignatures, setSavedSignatures] = useState<{
    normal: Map<number, string>;
    descriptive: Map<number, string>;
    group: Map<number, string>;
    coding: Map<number, string>;
  }>({ normal: new Map(), descriptive: new Map(), group: new Map(), coding: new Map() });

  const normalExpanded = useExpandedRows();
  const descriptiveExpanded = useExpandedRows();
  const groupExpanded = useExpandedRows();
  const codingExpanded = useExpandedRows();

  const hydrate = useCallback((template: LabTestTemplate) => {
    setForm({
      ...template,
      lab_test_rate: Number(template.lab_test_rate ?? 0),
      sample_qty: Number(template.sample_qty ?? 0),
      conversion_factor:
        template.conversion_factor === null || template.conversion_factor === undefined
          ? null
          : Number(template.conversion_factor),
    });
    setNormalRows(template.normal_test_templates || []);
    setDescriptiveRows(template.descriptive_test_templates || []);
    setGroupRows(template.lab_test_groups || []);
    setCodingRows(template.codification_table || []);
    setSavedSignatures({
      normal: signaturesOf(template.normal_test_templates),
      descriptive: signaturesOf(template.descriptive_test_templates),
      group: signaturesOf(template.lab_test_groups),
      coding: signaturesOf(template.codification_table),
    });
  }, []);

  const loadData = useCallback(async () => {
    try {
      const [
        metaRes,
        deptsRes,
        samplesRes,
        uomsRes,
        codeSystemsRes,
        codeValuesRes,
        allTemplatesRes,
      ] = await Promise.all([
        HealthcareApi.labTestTemplates.meta().catch(() => null),
        HealthcareApi.departments.list({ page_size: 200 }),
        HealthcareApi.labTestSamples.list({ page_size: 200 }),
        HealthcareApi.labTestUOMs.list({ page_size: 200 }),
        HealthcareApi.codeSystems.list({ page_size: 200 }).catch(() => ({ results: [] })),
        HealthcareApi.codeValues.list({ page_size: 1000 }).catch(() => ({ results: [] })),
        HealthcareApi.labTestTemplates.list({ page_size: 500 }).catch(() => ({ results: [] })),
      ]);

      setMeta(metaRes);
      setDepartments(deptsRes.results || []);
      setSamples(samplesRes.results || []);
      setUoms(uomsRes.results || []);
      setCodeSystems(codeSystemsRes.results || []);
      setCodeValues(codeValuesRes.results || []);
      setGroupableTemplates(
        (allTemplatesRes.results || []).filter(
          (t: LabTestTemplate) =>
            t.lab_test_template_type === "Single" || t.lab_test_template_type === "Compound"
        )
      );

      if (!isNew && templateId) {
        const full = await HealthcareApi.labTestTemplates.get(templateId);
        hydrate(full);
      }
    } catch (err: any) {
      setError(messageOf(err));
    } finally {
      setLoaded(true);
    }
  }, [isNew, templateId, hydrate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const update = (key: string, value: any) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const setRow = <T,>(
    setter: React.Dispatch<React.SetStateAction<T[]>>,
    index: number,
    patch: Partial<T>
  ) => {
    setter((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], ...patch };
      return copy;
    });
  };

  // 1-Click Clinical Preset Loader
  const handleApplyPreset = (preset: TemplatePreset) => {
    // Find matching department
    const dept = departments.find(
      (d) => d.department.toLowerCase().includes(preset.deptKeyword.toLowerCase())
    );
    // Find matching sample
    const samp = samples.find(
      (s) => s.sample.toLowerCase().includes(preset.sampleKeyword.toLowerCase())
    );

    setForm((prev) => ({
      ...prev,
      lab_test_name: preset.name,
      lab_test_code: preset.code,
      lab_test_template_type: preset.type,
      department: dept ? dept.id : prev.department || (departments[0]?.id ?? null),
      sample: samp ? samp.id : prev.sample,
      sample_uom: samp?.sample_uom_name || "mL",
      sample_qty: 3,
      sample_details: preset.sampleDetails,
      is_billable: true,
      lab_test_rate: preset.rate,
      lab_test_description: preset.description,
    }));

    if (preset.normals && preset.normals.length > 0) {
      const rows: NormalTestTemplateRow[] = preset.normals.map((n) => {
        const uomObj = uoms.find((u) => u.lab_test_uom.toLowerCase() === n.uomName.toLowerCase());
        return {
          lab_test_event: n.event,
          lab_test_uom: uomObj ? uomObj.id : null,
          normal_range: n.range,
          secondary_uom: null,
          conversion_factor: null,
          allow_blank: false,
        };
      });
      setNormalRows(rows);
    }

    setActiveTab("result");
    toast.success(`Loaded "${preset.name}" template preset with ${preset.normals?.length || 0} analytes!`);
  };

  const handleSave = async () => {
    if (!form.lab_test_name?.trim()) {
      toast.error("Please enter a Lab Test Name");
      setActiveTab("details");
      return;
    }

    setError(null);
    setSaving(true);
    try {
      const payload: Partial<LabTestTemplate> = { ...form };
      for (const key of [
        "id",
        "sample_name", "uom_name", "secondary_uom_name", "department_name",
        "lab_test_group_name", "item_name", "nursing_checklist_template_name",
        "patient_care_type_name", "staff_role_name",
        "normal_test_templates", "descriptive_test_templates",
        "lab_test_groups", "codification_table",
      ]) {
        delete (payload as any)[key];
      }

      const saved = isNew
        ? await HealthcareApi.labTestTemplates.create(payload)
        : await HealthcareApi.labTestTemplates.update(templateId as number, payload);
      const id = (saved as any)?.id ?? templateId;
      if (!id) throw new Error("The server did not return the saved template.");

      await syncChildren(
        HealthcareApi.normalTestTemplates,
        id, normalRows, savedSignatures.normal,
        (row, idx) => ({ ...stripRow(row), idx })
      );
      await syncChildren(
        HealthcareApi.descriptiveTestTemplates,
        id, descriptiveRows, savedSignatures.descriptive,
        (row, idx) => ({ ...stripRow(row), idx })
      );
      await syncChildren(
        HealthcareApi.labTestGroups,
        id, groupRows, savedSignatures.group,
        (row, idx) => ({ ...stripRow(row), idx })
      );
      await syncChildren(
        HealthcareApi.codificationTable,
        id,
        codingRows.map((r) => ({ ...r, id: r.id || undefined })),
        savedSignatures.coding,
        (row, idx) => {
          const { encounter, ...rest } = stripRow(row) as any;
          return { ...rest, lab_test_template: id, idx };
        }
      );

      const fresh = await HealthcareApi.labTestTemplates.get(id);
      hydrate(fresh);
      toast.success("Lab Test Template successfully saved!");
      if (isNew) navigate(`/healthcare/lab-test-templates/${id}`, { replace: true });
    } catch (err: any) {
      const msg = messageOf(err);
      setError(msg);
      toast.error(msg || "Failed to save Lab Test Template");
    } finally {
      setSaving(false);
    }
  };

  const handleChangeCode = async () => {
    const next = window.prompt("Enter new Template Code / Barcode:", form.lab_test_code || "");
    if (!next || !next.trim() || !templateId) return;
    setError(null);
    try {
      const fresh = await HealthcareApi.labTestTemplates.changeTemplateCode(templateId, next.trim());
      hydrate(fresh);
      toast.success(`Template Code updated to ${next.trim()}`);
    } catch (err: any) {
      toast.error(messageOf(err));
    }
  };

  if (!loaded) {
    return (
      <div className="p-12 text-center text-sm text-muted-foreground">
        <Icon icon="solar:refresh-circle-bold" className="animate-spin mx-auto mb-2 text-primary" size={24} />
        Loading Lab Test Template configuration...
      </div>
    );
  }

  const canSave = isNew ? canCreate : canWrite;

  return (
    <div className="max-w-6xl mx-auto pb-24 space-y-6">
      {/* ── Top Header Bar ─────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-card border shadow-xs">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
            <Icon icon="solar:test-tube-bold-duotone" size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <button onClick={() => navigate("/healthcare")} className="hover:text-foreground">
                Healthcare
              </button>
              <span>/</span>
              <button onClick={() => navigate("/healthcare/lab-test-templates")} className="hover:text-foreground">
                Templates
              </button>
              <span>/</span>
              <span className="font-semibold text-foreground">
                {isNew ? "New Template" : form.lab_test_name}
              </span>
            </div>
            <div className="flex items-center gap-2.5 mt-0.5">
              <h1 className="text-xl font-bold tracking-tight text-foreground">
                {form.lab_test_name || "New Lab Test Template"}
              </h1>
              {isNew ? (
                <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30">
                  New Draft
                </Badge>
              ) : (
                <Badge variant="outline" className="text-xs font-mono bg-muted">
                  {form.lab_test_code || "CODE"}
                </Badge>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {!isNew && (
            <Button variant="outline" size="sm" onClick={handleChangeCode} className="gap-1.5 text-xs">
              <Icon icon="solar:qr-code-bold" size={14} />
              Change Code
            </Button>
          )}

          <Button
            onClick={handleSave}
            disabled={saving || !canSave}
            className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-xs"
          >
            {saving ? (
              <>
                <Icon icon="solar:refresh-circle-bold" className="animate-spin" size={15} />
                Saving Template...
              </>
            ) : (
              <>
                <Icon icon="solar:disk-bold" size={15} />
                Save Template
              </>
            )}
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl border border-destructive/30 bg-destructive/5 text-xs text-destructive flex items-center gap-2">
          <Icon icon="solar:danger-triangle-bold" size={16} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ── 1-Click Diagnostic Presets Strip ─────────────────────────────────── */}
      {isNew && (
        <Card className="border-emerald-500/30 bg-gradient-to-r from-emerald-500/5 via-card to-card shadow-xs">
          <CardContent className="p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Icon icon="solar:magic-stick-3-bold-duotone" size={18} className="text-emerald-600" />
                <span className="text-xs font-bold text-foreground uppercase tracking-wider">
                  Fast-Track Diagnostic Presets (1-Click Setup)
                </span>
              </div>
              <span className="text-[11px] text-muted-foreground">Click any preset to prefill full panel parameters & ranges:</span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {CLINICAL_PRESETS.map((p) => (
                <button
                  key={p.code}
                  type="button"
                  onClick={() => handleApplyPreset(p)}
                  className="px-3 py-1.5 rounded-lg border bg-background hover:bg-emerald-500/10 hover:border-emerald-500/40 text-xs font-semibold text-foreground transition-all flex items-center gap-1.5 shadow-2xs group"
                >
                  <Icon icon="solar:test-tube-bold" size={13} className="text-emerald-600 group-hover:scale-110 transition-transform" />
                  <span>{p.name}</span>
                  <Tag color="cyan" className="text-[9px] m-0 px-1 py-0 scale-90">
                    {p.normals?.length || 0} Analytes
                  </Tag>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Navigation Tabs ─────────────────────────────────────────────────── */}
      <div className="border-b flex items-center gap-1 overflow-x-auto pb-px">
        {[
          { tab: "details" as Tab, label: "Template Details", icon: "solar:document-bold-duotone" },
          {
            tab: "result" as Tab,
            label: "Result Format",
            icon: "solar:checklist-minimalistic-bold-duotone",
            badge: form.lab_test_template_type === "Compound" ? normalRows.length : undefined,
          },
          { tab: "sample" as Tab, label: "Sample & Specimen", icon: "solar:drop-bold-duotone" },
          { tab: "coding" as Tab, label: "Medical Coding (LOINC)", icon: "solar:tag-bold-duotone", badge: codingRows.length || undefined },
          { tab: "worksheet" as Tab, label: "Worksheet & Legend", icon: "solar:notes-bold-duotone" },
        ].map((t) => {
          const active = activeTab === t.tab;
          return (
            <button
              key={t.tab}
              type="button"
              onClick={() => setActiveTab(t.tab)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 text-xs font-bold transition-colors border-b-2 whitespace-nowrap",
                active
                  ? "border-emerald-600 text-emerald-600 dark:border-emerald-400 dark:text-emerald-400"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon icon={t.icon} size={16} />
              <span>{t.label}</span>
              {t.badge !== undefined && (
                <span className={cn(
                  "px-1.5 py-0.2 rounded-full text-[10px] font-mono",
                  active ? "bg-emerald-600 text-white" : "bg-muted text-muted-foreground"
                )}>
                  {t.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ─── TAB 1: Template Details ────────────────────────────────────────── */}
      {activeTab === "details" && (
        <div className="space-y-6">
          <Section title="1. General Test Identification" icon="solar:document-text-bold-duotone">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <Field label="Test Name" required icon="solar:pen-bold">
                <Input
                  value={form.lab_test_name || ""}
                  onChange={(e) => update("lab_test_name", e.target.value)}
                  placeholder="e.g. Complete Blood Count (CBC) / Lipid Profile"
                  className="h-9 text-xs font-semibold"
                />
              </Field>

              <Field label="Medical Department" icon="solar:hospital-bold">
                <select
                  className="w-full h-9 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium shadow-xs"
                  value={form.department || ""}
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

              <Field label="Template Code / Barcode ID" icon="solar:qr-code-bold">
                <Input
                  value={form.lab_test_code || ""}
                  onChange={(e) => update("lab_test_code", e.target.value)}
                  placeholder="e.g. CBC-AUTO / LIPID-01"
                  className="h-9 text-xs font-mono"
                />
              </Field>
            </div>

            <div className="pt-2">
              <CheckboxField
                label="Disabled (Temporarily suspend ordering for this test)"
                checked={!!form.disabled}
                onChange={(v) => update("disabled", v)}
              />
            </div>
          </Section>

          {/* Template Format Visual Cards */}
          <Section title="2. Result Layout Archetype" icon="solar:widget-2-bold-duotone" hint="Dictates the UI structure of the clinical result entry screen.">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { type: "Compound", title: "Compound Panel", icon: "solar:checklist-minimalistic-bold-duotone", desc: "Multi-analyte panel with parameters table (CBC, BMP, LFT, Lipid Profile)." },
                { type: "Single", title: "Single Analyte", icon: "solar:test-tube-bold-duotone", desc: "Single discrete test result (Fasting Glucose, Troponin I, Hemoglobin A1c)." },
                { type: "Descriptive", title: "Descriptive / Culture", icon: "solar:document-text-bold-duotone", desc: "Microscopic findings, cytology, or culture & antibiotic sensitivity." },
                { type: "Imaging", title: "Imaging & Radiology", icon: "solar:gallery-bold-duotone", desc: "Radiological impression, X-ray, Ultrasound, CT, or MRI report." },
              ].map((fmt) => {
                const selected = form.lab_test_template_type === fmt.type;
                return (
                  <button
                    key={fmt.type}
                    type="button"
                    onClick={() => update("lab_test_template_type", fmt.type)}
                    className={cn(
                      "p-3.5 rounded-xl border text-left transition-all space-y-1.5 relative",
                      selected
                        ? "border-emerald-500 bg-emerald-500/10 shadow-xs"
                        : "border-border hover:border-border/80 hover:bg-muted/30"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className={cn("p-1.5 rounded-lg", selected ? "bg-emerald-600 text-white" : "bg-muted text-muted-foreground")}>
                        <Icon icon={fmt.icon} size={18} />
                      </div>
                      {selected && (
                        <Icon icon="solar:check-circle-bold" size={16} className="text-emerald-600" />
                      )}
                    </div>
                    <span className="font-bold text-xs text-foreground block mt-1">{fmt.title}</span>
                    <p className="text-[11px] text-muted-foreground leading-snug">{fmt.desc}</p>
                  </button>
                );
              })}
            </div>
          </Section>

          {/* Billing & Rate Configuration */}
          <Section title="3. Financial & Billing Settings" icon="solar:tag-price-bold-duotone">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="space-y-3">
                <CheckboxField
                  label="Is Billable Service"
                  checked={!!form.is_billable}
                  onChange={(v) => update("is_billable", v)}
                  hint="Enables billing in cashier point-of-sale, encounters, and invoices."
                />
              </div>

              <Field label="Standard Test Charge / Fee ($)" required icon="solar:dollar-bold">
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.lab_test_rate ?? 0}
                  onChange={(e) => update("lab_test_rate", Number(e.target.value))}
                  className="h-9 text-xs font-mono font-bold text-emerald-600"
                />
              </Field>

              <Field label="Service / Item Category" icon="solar:box-bold">
                <Combobox
                  options={["Diagnostic Services", "Laboratory Tests", "Clinical Pathology", "Microbiology"]}
                  value="Diagnostic Services"
                  onChange={() => {}}
                  doctype="Item Group"
                  className="h-9 text-xs"
                />
              </Field>
            </div>
          </Section>

          {/* Description */}
          <Section title="4. Clinical Description & Indications" icon="solar:notes-bold-duotone" collapsible>
            <textarea
              className="w-full border border-input rounded-xl p-3 text-xs bg-background shadow-xs min-h-[90px] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={form.lab_test_description || ""}
              onChange={(e) => update("lab_test_description", e.target.value)}
              placeholder="Enter clinical indications, methodology (e.g. Immunoassay, Spectrophotometry), or patient preparation..."
            />
          </Section>
        </div>
      )}

      {/* ─── TAB 2: Result Format ───────────────────────────────────────────── */}
      {activeTab === "result" && (
        <div className="space-y-6">
          {/* Compound Result Panel Grid */}
          {form.lab_test_template_type === "Compound" && (
            <Card className="shadow-xs border-border">
              <CardHeader className="pb-3 border-b bg-muted/20">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Icon icon="solar:checklist-minimalistic-bold-duotone" size={20} className="text-emerald-600" />
                    <div>
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-base font-bold">Compound Test Analytes Table</CardTitle>
                        <Tag color="green" className="text-xs font-bold m-0">
                          {normalRows.length} Parameters
                        </Tag>
                      </div>
                      <CardDescription className="text-xs text-muted-foreground mt-0.5">
                        Define each measurable component, default UOM, and biological reference intervals.
                      </CardDescription>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setNormalRows((prev) => [...prev, emptyNormalRow()])}
                      className="h-8 text-xs gap-1 border-emerald-500/30 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
                    >
                      <Icon icon="solar:add-circle-bold" size={14} />
                      + Add Analyte
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setNormalRows((prev) => [
                          ...prev,
                          emptyNormalRow(),
                          emptyNormalRow(),
                          emptyNormalRow(),
                        ])
                      }
                      className="h-8 text-xs gap-1 text-muted-foreground"
                    >
                      +3 Rows
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-0">
                <EncounterGrid
                  columns={[
                    { label: "Analyte / Event Name", width: "w-64" },
                    { label: "Measurement Unit (UOM)", width: "w-44" },
                    { label: "Biological Reference Range", width: "w-64" },
                  ]}
                  count={normalRows.length}
                  onAdd={() => setNormalRows((prev) => [...prev, emptyNormalRow()])}
                >
                  {normalRows.map((row, i) => (
                    <NormalRowView
                      key={i}
                      row={row}
                      index={i}
                      uoms={uoms}
                      expanded={!!normalExpanded.expanded[i]}
                      onToggle={() => normalExpanded.toggle(i)}
                      onChange={(patch) => setRow(setNormalRows, i, patch)}
                      onRemove={(idx) => setNormalRows((prev) => prev.filter((_, j) => j !== idx))}
                    />
                  ))}
                </EncounterGrid>
              </CardContent>
            </Card>
          )}

          {/* Single Analyte Format */}
          {form.lab_test_template_type === "Single" && (
            <Section title="Single Analyte Specification" icon="solar:test-tube-bold-duotone">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <Field label="Unit of Measure (UOM)" icon="solar:ruler-bold">
                  <Combobox
                    options={uoms.map((u) => u.lab_test_uom)}
                    value={uoms.find((u) => u.id === form.lab_test_uom)?.lab_test_uom || ""}
                    onChange={(name) =>
                      update("lab_test_uom", uoms.find((u) => u.lab_test_uom === name)?.id ?? null)
                    }
                    doctype="Lab Test UOM"
                    rawItems={uoms}
                  />
                </Field>

                <Field label="Normal Reference Range" icon="solar:chart-square-bold">
                  <Input
                    value={form.lab_test_normal_range || ""}
                    onChange={(e) => update("lab_test_normal_range", e.target.value)}
                    placeholder="e.g. 70 - 110 mg/dL or < 200"
                    className="h-9 text-xs font-mono"
                  />
                </Field>

                <Field label="Secondary UOM (Optional)" icon="solar:ruler-angular-bold">
                  <Combobox
                    options={uoms.map((u) => u.lab_test_uom)}
                    value={uoms.find((u) => u.id === form.secondary_uom)?.lab_test_uom || ""}
                    onChange={(name) =>
                      update("secondary_uom", uoms.find((u) => u.lab_test_uom === name)?.id ?? null)
                    }
                    doctype="Lab Test UOM"
                    rawItems={uoms}
                  />
                </Field>
              </div>
            </Section>
          )}

          {/* Descriptive / Special Format */}
          {form.lab_test_template_type === "Descriptive" && (
            <Section title="Descriptive Result Components" icon="solar:document-text-bold-duotone">
              <div className="space-y-4">
                <CheckboxField
                  label="Enable Antibiotic Sensitivity & Organisms Table"
                  checked={!!form.sensitivity}
                  onChange={(v) => update("sensitivity", v)}
                  hint="Enables culture plate isolation and antibiotic susceptibility testing (AST)."
                />

                <EncounterGrid
                  columns={[{ label: "Observation / Particulars Component", width: "w-96" }]}
                  count={descriptiveRows.length}
                  onAdd={() => setDescriptiveRows((prev) => [...prev, emptyDescriptiveRow()])}
                >
                  {descriptiveRows.map((row, i) => (
                    <DescriptiveRowView
                      key={i}
                      row={row}
                      index={i}
                      expanded={!!descriptiveExpanded.expanded[i]}
                      onToggle={() => descriptiveExpanded.toggle(i)}
                      onChange={(patch) => setRow(setDescriptiveRows, i, patch)}
                      onRemove={(idx) => setDescriptiveRows((prev) => prev.filter((_, j) => j !== idx))}
                    />
                  ))}
                </EncounterGrid>
              </div>
            </Section>
          )}

          {/* Imaging Result Format */}
          {form.lab_test_template_type === "Imaging" && (
            <Section title="Radiology / Imaging Report Template" icon="solar:gallery-bold-duotone">
              <Field label="Default Findings & Template Skeleton">
                <textarea
                  className="w-full border border-input rounded-xl p-3 text-xs bg-background shadow-xs min-h-[140px] font-mono focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={form.descriptive_result || ""}
                  onChange={(e) => update("descriptive_result", e.target.value)}
                  placeholder="EXAMINATION:&#10;TECHNIQUE:&#10;FINDINGS:&#10;IMPRESSION:&#10;1. No acute cardiopulmonary abnormality."
                />
              </Field>
            </Section>
          )}

          {/* Grouped Format */}
          {form.lab_test_template_type === "Grouped" && (
            <Section title="Bundled Test Templates Group" icon="solar:layers-bold-duotone">
              <EncounterGrid
                columns={[
                  { label: "Type", width: "w-36" },
                  { label: "Test / Sub-Panel Template", width: "w-72" },
                  { label: "Rate ($)", width: "w-28" },
                  { label: "Description", width: "w-64" },
                ]}
                count={groupRows.length}
                onAdd={() => setGroupRows((prev) => [...prev, emptyGroupRow()])}
              >
                {groupRows.map((row, i) => (
                  <GroupRowView
                    key={i}
                    row={row}
                    index={i}
                    templates={groupableTemplates}
                    uoms={uoms}
                    expanded={!!groupExpanded.expanded[i]}
                    onToggle={() => groupExpanded.toggle(i)}
                    onModeChange={(mode) =>
                      setRow(setGroupRows, i, {
                        template_or_new_line: mode,
                        ...(mode === "Add New Line"
                          ? { lab_test_template: null, lab_test_rate: 0, lab_test_description: "" }
                          : {}),
                      })
                    }
                    onTemplateChange={(id) => {
                      const tpl = groupableTemplates.find((t) => t.id === id);
                      setRow(setGroupRows, i, {
                        lab_test_template: id,
                        lab_test_rate: tpl ? Number(tpl.lab_test_rate ?? 0) : 0,
                        lab_test_description: tpl?.lab_test_description ?? "",
                      });
                    }}
                    onChange={(patch) => setRow(setGroupRows, i, patch)}
                    onRemove={(idx) => setGroupRows((prev) => prev.filter((_, j) => j !== idx))}
                  />
                ))}
              </EncounterGrid>
            </Section>
          )}
        </div>
      )}

      {/* ─── TAB 3: Sample & Specimen ───────────────────────────────────────── */}
      {activeTab === "sample" && (
        <div className="space-y-6">
          <Section title="Specimen Collection Protocol" icon="solar:drop-bold-duotone">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <Field label="Specimen / Sample Type" icon="solar:test-tube-bold">
                <Combobox
                  options={samples.map((s) => s.sample)}
                  value={samples.find((s) => s.id === form.sample)?.sample || ""}
                  onChange={(name) => {
                    const samp = samples.find((s) => s.sample === name);
                    setForm((prev) => ({
                      ...prev,
                      sample: samp?.id ?? null,
                      sample_uom: samp?.sample_uom_name || "mL",
                    }));
                  }}
                  doctype="Lab Test Sample"
                  rawItems={samples}
                />
              </Field>

              <Field label="Minimum Volume / Quantity" icon="solar:ruler-bold">
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    value={form.sample_qty ?? 3}
                    onChange={(e) => update("sample_qty", Number(e.target.value))}
                    className="h-9 text-xs font-mono"
                  />
                  <span className="text-xs font-semibold text-muted-foreground">{form.sample_uom || "mL"}</span>
                </div>
              </Field>

              <Field label="Collection Tube & Bench Notes" icon="solar:notes-bold">
                <Input
                  value={form.sample_details || ""}
                  onChange={(e) => update("sample_details", e.target.value)}
                  placeholder="e.g. Lavender (EDTA) or SST Gold top"
                  className="h-9 text-xs"
                />
              </Field>
            </div>
          </Section>

          {/* Phlebotomy Tube Guide Visual Card */}
          <Card className="border-border shadow-xs">
            <CardHeader className="pb-3 border-b bg-muted/20">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Clinical Phlebotomy Tube Standards Guide
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
              {[
                { name: "EDTA / Lavender", tag: "K2-EDTA", desc: "Whole Blood • Hematology (CBC, ESR, Blood Film)", color: "bg-purple-500/10 text-purple-700 border-purple-500/30" },
                { name: "SST / Gold / Red", tag: "Clot / Gel", desc: "Serum • Biochemistry, LFT, Lipid, Serology", color: "bg-amber-500/10 text-amber-700 border-amber-500/30" },
                { name: "Citrate / Light Blue", tag: "Na Citrate", desc: "Plasma • Coagulation, PT/INR, PTT, D-Dimer", color: "bg-blue-500/10 text-blue-700 border-blue-500/30" },
                { name: "Fluoride / Grey", tag: "Na Fluoride", desc: "Plasma • Glucose, Lactic Acid inhibition", color: "bg-slate-500/10 text-slate-700 border-slate-500/30" },
                { name: "Sterile Cup", tag: "Preservative-free", desc: "Midstream Urine, Sputum, Body Fluids", color: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30" },
              ].map((t) => (
                <div key={t.name} className={cn("p-2.5 rounded-xl border text-xs space-y-1", t.color)}>
                  <div className="flex items-center justify-between">
                    <span className="font-bold">{t.name}</span>
                    <Badge variant="outline" className="text-[9px] px-1 py-0">{t.tag}</Badge>
                  </div>
                  <p className="text-[10px] opacity-80 leading-snug">{t.desc}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ─── TAB 4: Medical Coding (LOINC) ─────────────────────────────────── */}
      {activeTab === "coding" && (
        <Section title="Standard Medical Terminologies (LOINC / CPT / ICD)" icon="solar:tag-bold-duotone" hint="Maps investigation parameters to international interoperability coding systems.">
          <EncounterGrid
            columns={[
              { label: "Code System", required: true, width: "w-56" },
              { label: "Code Value / Identifier", required: true, width: "w-64" },
              { label: "Code", width: "w-28" },
              { label: "Standard Display Name", width: "w-56" },
            ]}
            count={codingRows.length}
            onAdd={() => setCodingRows((prev) => [...prev, emptyCodificationRow()])}
          >
            {codingRows.map((row, i) => (
              <CodificationRowView
                key={i}
                row={row}
                index={i}
                codeSystems={codeSystems}
                codeValues={codeValues.filter((v) => v.code_system === row.code_system)}
                expanded={!!codingExpanded.expanded[i]}
                onToggle={() => codingExpanded.toggle(i)}
                onChange={(patch) => setRow(setCodingRows, i, patch)}
                onRemove={(idx) => setCodingRows((prev) => prev.filter((_, j) => j !== idx))}
              />
            ))}
          </EncounterGrid>
        </Section>
      )}

      {/* ─── TAB 5: Worksheet & Legend ──────────────────────────────────────── */}
      {activeTab === "worksheet" && (
        <div className="space-y-6">
          <Section title="Laboratory Worksheet Bench Instructions" icon="solar:notes-bold-duotone">
            <Field label="Bench Instructions (Printed on bench worksheets)">
              <textarea
                className="w-full border border-input rounded-xl p-3 text-xs bg-background shadow-xs min-h-[100px] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={form.worksheet_instructions || ""}
                onChange={(e) => update("worksheet_instructions", e.target.value)}
                placeholder="Specific lab technician bench instructions, dilution factors, or instrument calibrator notes..."
              />
            </Field>
          </Section>

          <Section title="Report Legend & Interpretation Notes" icon="solar:document-text-bold-duotone">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <Field label="Legend Print Position">
                <Combobox
                  options={fieldOptions(meta, "legend_print_position")}
                  value={form.legend_print_position || "Bottom"}
                  onChange={(v) => update("legend_print_position", v)}
                  allowCreate={false}
                />
              </Field>
            </div>
            <div className="mt-4">
              <Field label="Result Legend Text">
                <textarea
                  className="w-full border border-input rounded-xl p-3 text-xs bg-background shadow-xs min-h-[90px] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={form.result_legend || ""}
                  onChange={(e) => update("result_legend", e.target.value)}
                  placeholder="Interpretation guidelines printed at the bottom of patient results report..."
                />
              </Field>
            </div>
          </Section>
        </div>
      )}

      {/* ── Sticky Bottom Floating Action Bar ──────────────────────────────── */}
      <div className="sticky bottom-4 z-40 flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-card/95 backdrop-blur-md border shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600">
            <Icon icon="solar:test-tube-bold-duotone" size={24} />
          </div>
          <div>
            <h4 className="text-sm font-bold text-foreground">
              {form.lab_test_name || "New Template Designer"}
            </h4>
            <p className="text-xs text-muted-foreground">
              Type: <span className="font-semibold text-foreground">{form.lab_test_template_type}</span> • {normalRows.length} Analytes • Rate: ${Number(form.lab_test_rate || 0).toFixed(2)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <Button
            variant="outline"
            onClick={() => navigate("/healthcare/lab-test-templates")}
            disabled={saving}
          >
            Cancel & Exit
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !canSave}
            className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 shadow-md"
          >
            {saving ? (
              <>
                <Icon icon="solar:refresh-circle-bold" className="animate-spin" size={16} />
                Saving Template...
              </>
            ) : (
              <>
                <Icon icon="solar:disk-bold" size={16} />
                {isNew ? "Create Lab Test Template" : "Save Template Changes"}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

function stripRow(row: Record<string, any>): Record<string, any> {
  return Object.fromEntries(Object.entries(row).filter(([k]) => !DERIVED_KEYS.includes(k)));
}

function messageOf(err: any): string {
  const data = err?.response?.data ?? err?.data;
  if (!data) return String(err?.message || err);
  if (typeof data === "string") return data;
  if (Array.isArray(data)) return data.join(", ");
  return Object.entries(data)
    .map(([k, v]) => `${k === "non_field_errors" ? "" : `${k}: `}${Array.isArray(v) ? v.join(", ") : v}`)
    .join("; ");
}

// ── Child Row Views ──────────────────────────────────────────────────────────

function NormalRowView({
  row,
  index,
  uoms,
  expanded,
  onToggle,
  onChange,
  onRemove,
}: {
  row: NormalTestTemplateRow;
  index: number;
  uoms: LabTestUOM[];
  expanded: boolean;
  onToggle: () => void;
  onChange: (patch: Partial<NormalTestTemplateRow>) => void;
  onRemove: (index: number) => void;
}) {
  return (
    <>
      <tr className="border-t hover:bg-muted/15 transition-colors">
        <GridCell />
        <GridCell className="text-muted-foreground font-mono text-xs">{index + 1}</GridCell>
        <GridCell>
          <Input
            value={row.lab_test_event}
            onChange={(e) => onChange({ lab_test_event: e.target.value })}
            placeholder="e.g. Hemoglobin / Fasting Glucose"
            className="h-8 text-xs font-semibold"
          />
        </GridCell>
        <GridCell>
          <Combobox
            options={uoms.map((u) => u.lab_test_uom)}
            value={uoms.find((u) => u.id === row.lab_test_uom)?.lab_test_uom || ""}
            onChange={(name) => onChange({ lab_test_uom: uoms.find((u) => u.lab_test_uom === name)?.id ?? null })}
            doctype="Lab Test UOM"
            rawItems={uoms}
            className="h-8 py-1 text-xs"
          />
        </GridCell>
        <GridCell>
          <Input
            value={row.normal_range}
            onChange={(e) => onChange({ normal_range: e.target.value })}
            placeholder="e.g. 13.5 - 17.5"
            className="h-8 text-xs font-mono"
          />
        </GridCell>
        <GridRowActions index={index} onRemove={onRemove} onToggleDetails={onToggle} detailsOpen={expanded} />
      </tr>
      {expanded && (
        <GridDetailRow colSpan={6}>
          <div className="grid grid-cols-3 gap-4">
            <GridDetailField label="Secondary UOM">
              <Combobox
                options={uoms.map((u) => u.lab_test_uom)}
                value={uoms.find((u) => u.id === row.secondary_uom)?.lab_test_uom || ""}
                onChange={(name) =>
                  onChange({ secondary_uom: uoms.find((u) => u.lab_test_uom === name)?.id ?? null })
                }
                doctype="Lab Test UOM"
                rawItems={uoms}
              />
            </GridDetailField>
            <GridDetailField label="Conversion Factor">
              <Input
                type="number"
                step="0.000001"
                value={row.conversion_factor ?? ""}
                onChange={(e) =>
                  onChange({ conversion_factor: e.target.value === "" ? null : Number(e.target.value) })
                }
                className="h-8 text-xs font-mono"
              />
            </GridDetailField>
            <GridDetailField label="Allow Blank Result">
              <label className="flex items-center gap-2 cursor-pointer mt-2">
                <input
                  type="checkbox"
                  checked={!!row.allow_blank}
                  onChange={(e) => onChange({ allow_blank: e.target.checked })}
                />
                <span className="text-xs text-muted-foreground">Optional parameter</span>
              </label>
            </GridDetailField>
          </div>
        </GridDetailRow>
      )}
    </>
  );
}

function DescriptiveRowView({
  row,
  index,
  expanded,
  onToggle,
  onChange,
  onRemove,
}: {
  row: DescriptiveTestTemplateRow;
  index: number;
  expanded: boolean;
  onToggle: () => void;
  onChange: (patch: Partial<DescriptiveTestTemplateRow>) => void;
  onRemove: (index: number) => void;
}) {
  return (
    <>
      <tr className="border-t hover:bg-muted/15 transition-colors">
        <GridCell />
        <GridCell className="text-muted-foreground font-mono text-xs">{index + 1}</GridCell>
        <GridCell>
          <Input
            value={row.particulars}
            onChange={(e) => onChange({ particulars: e.target.value })}
            placeholder="e.g. Colony Morphology / Microscopic Description"
            className="h-8 text-xs"
          />
        </GridCell>
        <GridRowActions index={index} onRemove={onRemove} onToggleDetails={onToggle} detailsOpen={expanded} />
      </tr>
      {expanded && (
        <GridDetailRow colSpan={4}>
          <GridDetailField label="Allow Blank">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={!!row.allow_blank}
                onChange={(e) => onChange({ allow_blank: e.target.checked })}
              />
              <span className="text-xs text-muted-foreground">Optional observation</span>
            </label>
          </GridDetailField>
        </GridDetailRow>
      )}
    </>
  );
}

function GroupRowView({
  row,
  index,
  templates,
  uoms,
  expanded,
  onToggle,
  onModeChange,
  onTemplateChange,
  onChange,
  onRemove,
}: {
  row: LabTestGroupTemplateRow;
  index: number;
  templates: LabTestTemplate[];
  uoms: LabTestUOM[];
  expanded: boolean;
  onToggle: () => void;
  onModeChange: (mode: "Add Test" | "Add New Line") => void;
  onTemplateChange: (templateId: number | null) => void;
  onChange: (patch: Partial<LabTestGroupTemplateRow>) => void;
  onRemove: (index: number) => void;
}) {
  const isTemplate = row.template_or_new_line !== "Add New Line";
  return (
    <>
      <tr className="border-t hover:bg-muted/15 transition-colors">
        <GridCell />
        <GridCell className="text-muted-foreground font-mono text-xs">{index + 1}</GridCell>
        <GridCell>
          <select
            className="w-full h-8 rounded border border-input bg-background px-2 text-xs"
            value={row.template_or_new_line || "Add Test"}
            onChange={(e) => onModeChange(e.target.value as any)}
          >
            <option value="Add Test">Add Test</option>
            <option value="Add New Line">Add New Line</option>
          </select>
        </GridCell>
        <GridCell>
          {isTemplate ? (
            <Combobox
              options={templates.map((t) => t.lab_test_name)}
              value={templates.find((t) => t.id === row.lab_test_template)?.lab_test_name || ""}
              onChange={(name) =>
                onTemplateChange(templates.find((t) => t.lab_test_name === name)?.id ?? null)
              }
              placeholder="Select template..."
              className="h-8 text-xs"
            />
          ) : (
            <Input
              value={row.group_event || ""}
              onChange={(e) => onChange({ group_event: e.target.value })}
              placeholder="Sub-test event..."
              className="h-8 text-xs"
            />
          )}
        </GridCell>
        <GridCell>
          <Input
            type="number"
            value={row.lab_test_rate ?? 0}
            onChange={(e) => onChange({ lab_test_rate: Number(e.target.value) })}
            className="h-8 text-xs font-mono"
          />
        </GridCell>
        <GridCell>
          <Input
            value={row.lab_test_description || ""}
            onChange={(e) => onChange({ lab_test_description: e.target.value })}
            className="h-8 text-xs"
          />
        </GridCell>
        <GridRowActions index={index} onRemove={onRemove} onToggleDetails={onToggle} detailsOpen={expanded} />
      </tr>
      {expanded && !isTemplate && (
        <GridDetailRow colSpan={7}>
          <div className="grid grid-cols-3 gap-4">
            <GridDetailField label="UOM">
              <Combobox
                options={uoms.map((u) => u.lab_test_uom)}
                value={uoms.find((u) => u.id === row.group_test_uom)?.lab_test_uom || ""}
                onChange={(name) =>
                  onChange({ group_test_uom: uoms.find((u) => u.lab_test_uom === name)?.id ?? null })
                }
                doctype="Lab Test UOM"
                rawItems={uoms}
              />
            </GridDetailField>
            <GridDetailField label="Normal Range">
              <Input
                value={row.group_test_normal_range || ""}
                onChange={(e) => onChange({ group_test_normal_range: e.target.value })}
                className="h-8 text-xs font-mono"
              />
            </GridDetailField>
          </div>
        </GridDetailRow>
      )}
    </>
  );
}

function CodificationRowView({
  row,
  index,
  codeSystems,
  codeValues,
  expanded,
  onToggle,
  onChange,
  onRemove,
}: {
  row: CodificationRow;
  index: number;
  codeSystems: any[];
  codeValues: any[];
  expanded: boolean;
  onToggle: () => void;
  onChange: (patch: Partial<CodificationRow>) => void;
  onRemove: (index: number) => void;
}) {
  return (
    <>
      <tr className="border-t hover:bg-muted/15 transition-colors">
        <GridCell />
        <GridCell className="text-muted-foreground font-mono text-xs">{index + 1}</GridCell>
        <GridCell>
          <Combobox
            options={codeSystems.map((s) => s.name || s.system_name || s.code_system)}
            value={row.code_system_name || ""}
            onChange={(name) => {
              const cs = codeSystems.find((s) => (s.name || s.system_name || s.code_system) === name);
              onChange({
                code_system: cs?.id ?? null,
                code_system_name: name,
                system: cs?.url || "",
                code_value: null,
                code: "",
                display: "",
              });
            }}
            placeholder="Select Coding System..."
            className="h-8 text-xs"
          />
        </GridCell>
        <GridCell>
          <Combobox
            options={codeValues.map((v) => `${v.code} - ${v.display}`)}
            value={row.code ? `${row.code} - ${row.display}` : ""}
            onChange={(val) => {
              const cv = codeValues.find((v) => `${v.code} - ${v.display}` === val);
              if (cv) {
                onChange({
                  code_value: cv.id,
                  code: cv.code,
                  display: cv.display,
                  definition: cv.definition,
                });
              }
            }}
            placeholder="Search LOINC / CPT code..."
            className="h-8 text-xs font-mono"
          />
        </GridCell>
        <GridCell className="font-mono text-xs font-bold text-foreground">
          {row.code || "—"}
        </GridCell>
        <GridCell className="text-xs truncate text-muted-foreground">
          {row.display || "—"}
        </GridCell>
        <GridRowActions index={index} onRemove={onRemove} onToggleDetails={onToggle} detailsOpen={expanded} />
      </tr>
      {expanded && (
        <GridDetailRow colSpan={7}>
          <GridDetailField label="Definition / Clinical Description">
            <p className="text-xs text-muted-foreground">{row.definition || "No extended LOINC definition available."}</p>
          </GridDetailField>
        </GridDetailRow>
      )}
    </>
  );
}
