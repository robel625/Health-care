import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/ui/dialog";
import { Button } from "@/ui/button";
import { Label } from "@/ui/label";
import { Input } from "@/ui/input";
import { Icon } from "@/components/icon";
import { Badge } from "@/ui/badge";
import { toast } from "sonner";
import {
  HealthcareApi,
  type Patient,
  type HealthcarePractitioner,
  type MedicalDepartment,
  type ServiceRequest,
  type ServiceRequestCategory,
  type LabTestTemplate,
  type ClinicalProcedureTemplate,
  type ObservationTemplate,
} from "@/api/services/healthcareService";
import { getInitials } from "@/utils";
import { formatAge } from "@/utils/age";

export interface NewServiceRequestModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultPatientId?: number;
  defaultPatientName?: string;
  defaultPractitionerId?: number;
  defaultDepartmentId?: number;
  defaultTemplateDt?: string;
  defaultTemplateDn?: string;
  onSuccess?: (newRecord?: ServiceRequest) => void;
}

export const MARLEY_TEMPLATE_TYPES = [
  {
    dt: "Lab Test Template",
    label: "Laboratory & Pathology",
    icon: "solar:flask-bold-duotone",
    accent: "text-purple-600 bg-purple-50 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300",
    categoryHint: "Laboratory",
  },
  {
    dt: "Clinical Procedure Template",
    label: "Clinical Procedure / Surgery",
    icon: "solar:scalpel-bold-duotone",
    accent: "text-blue-600 bg-blue-50 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300",
    categoryHint: "Procedure",
  },

  {
    dt: "Observation Template",
    label: "Clinical Observation",
    icon: "solar:eye-bold-duotone",
    accent: "text-amber-600 bg-amber-50 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300",
    categoryHint: "Observation",
  },
  {
    dt: "Appointment Type",
    label: "Consultation / OPD Booking",
    icon: "solar:calendar-bold-duotone",
    accent: "text-indigo-600 bg-indigo-50 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300",
    categoryHint: "Consultation",
  },
  {
    dt: "Healthcare Activity",
    label: "General Clinical Order",
    icon: "solar:notes-bold-duotone",
    accent: "text-slate-600 bg-slate-50 border-slate-200 dark:bg-slate-900 dark:text-slate-300",
    categoryHint: "General",
  },
];

const COMMON_SERVICE_PRESETS = [
  { title: "Complete Blood Count (CBC)", dt: "Lab Test Template", category: "Laboratory", department: "Pathology", sampleReq: true },
  { title: "Comprehensive Metabolic Panel (CMP)", dt: "Lab Test Template", category: "Laboratory", department: "Pathology", sampleReq: true },
  { title: "Lipid Profile Panel", dt: "Lab Test Template", category: "Laboratory", department: "Pathology", sampleReq: true },
  { title: "HbA1c Glycated Hemoglobin", dt: "Lab Test Template", category: "Laboratory", department: "Pathology", sampleReq: true },
  { title: "Urinalysis Routine & Microscopy", dt: "Lab Test Template", category: "Laboratory", department: "Pathology", sampleReq: true },
  { title: "Chest X-Ray PA View", dt: "Clinical Procedure Template", category: "Radiology", department: "Radiology", sampleReq: false },
  { title: "Ultrasound Abdomen & Pelvis", dt: "Clinical Procedure Template", category: "Radiology", department: "Radiology", sampleReq: false },
  { title: "12-Lead Electrocardiogram (ECG)", dt: "Clinical Procedure Template", category: "Procedure", department: "Cardiology", sampleReq: false },
  { title: "2D Echocardiogram with Doppler", dt: "Clinical Procedure Template", category: "Procedure", department: "Cardiology", sampleReq: false },
  { title: "CT Scan Head without Contrast", dt: "Clinical Procedure Template", category: "Radiology", department: "Radiology", sampleReq: false },
  { title: "MRI Lumbar Spine", dt: "Clinical Procedure Template", category: "Radiology", department: "Radiology", sampleReq: false },
  { title: "Wound Debridement & Suture", dt: "Clinical Procedure Template", category: "Procedure", department: "Surgery", sampleReq: false },
  { title: "General Surgery Consultation", dt: "Appointment Type", category: "Consultation", department: "Surgery", sampleReq: false },
];

export default function NewServiceRequestModal({
  open,
  onOpenChange,
  defaultPatientId,
  defaultPatientName,
  defaultPractitionerId,
  defaultDepartmentId,
  defaultTemplateDt,
  defaultTemplateDn,
  onSuccess,
}: NewServiceRequestModalProps) {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [practitioners, setPractitioners] = useState<HealthcarePractitioner[]>([]);
  const [departments, setDepartments] = useState<MedicalDepartment[]>([]);
  const [categories, setCategories] = useState<ServiceRequestCategory[]>([]);

  // Dynamic template collections
  const [labTemplates, setLabTemplates] = useState<LabTestTemplate[]>([]);
  const [procedureTemplates, setProcedureTemplates] = useState<ClinicalProcedureTemplate[]>([]);
  const [observationTemplates, setObservationTemplates] = useState<ObservationTemplate[]>([]);

  // Form State (Exact Marley Service Request Schema)
  const [patientId, setPatientId] = useState<number | undefined>(defaultPatientId);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [patientSearch, setPatientSearch] = useState("");

  const [templateDt, setTemplateDt] = useState<string>(defaultTemplateDt || "Lab Test Template");
  const [templateDn, setTemplateDn] = useState<string>(defaultTemplateDn || "");
  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState<number | undefined>();
  const [practitionerId, setPractitionerId] = useState<number | undefined>(defaultPractitionerId);
  const [departmentId, setDepartmentId] = useState<number | undefined>(defaultDepartmentId);

  const [priority, setPriority] = useState<string>("Routine");
  const [intent, setIntent] = useState<string>("Order");
  const [quantity, setQuantity] = useState<number>(1);
  const [asNeeded, setAsNeeded] = useState<boolean>(false);
  const [sampleRequired, setSampleRequired] = useState<boolean>(false);

  const todayStr = new Date().toISOString().split("T")[0];
  const [orderDate, setOrderDate] = useState<string>(todayStr);
  const [expectedDate, setExpectedDate] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [patientInstructions, setPatientInstructions] = useState<string>("");

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load masters and templates when modal opens
  useEffect(() => {
    if (!open) return;

    setPatientId(defaultPatientId);
    setPractitionerId(defaultPractitionerId);
    setDepartmentId(defaultDepartmentId);
    setTemplateDt(defaultTemplateDt || "Lab Test Template");
    setTemplateDn(defaultTemplateDn || "");
    setTitle(defaultTemplateDn || "");
    setNotes("");
    setPatientInstructions("");
    setOrderDate(todayStr);
    setExpectedDate("");
    setPriority("Routine");
    setIntent("Order");
    setQuantity(1);
    setAsNeeded(false);
    setSampleRequired(false);

    setLoading(true);
    Promise.all([
      HealthcareApi.patients.list({ page_size: 200 }).catch(() => ({ results: [] })),
      HealthcareApi.practitioners.list({ page_size: 100 }).catch(() => ({ results: [] })),
      HealthcareApi.departments.list({ page_size: 100 }).catch(() => ({ results: [] })),
      HealthcareApi.serviceRequestCategories.list({ page_size: 100 }).catch(() => ({ results: [] })),
      HealthcareApi.labTestTemplates.list({ page_size: 150 }).catch(() => ({ results: [] })),
      HealthcareApi.procedureTemplates.list({ page_size: 150 }).catch(() => ({ results: [] })),
      HealthcareApi.observationTemplates.list({ page_size: 100 }).catch(() => ({ results: [] })),
    ])
      .then(([pats, pracs, depts, cats, labs, procs, obss]) => {
        const pList = (pats as any).results || [];
        setPatients(pList);

        const prList = (pracs as any).results || [];
        setPractitioners(prList);
        if (prList.length > 0 && !defaultPractitionerId) {
          setPractitionerId(prList[0].id);
        }

        const dList = (depts as any).results || [];
        setDepartments(dList);

        const cList = (cats as any).results || [];
        setCategories(cList);
        if (cList.length > 0) {
          setCategoryId(cList[0].id);
        }

        setLabTemplates((labs as any).results || []);
        setProcedureTemplates((procs as any).results || []);
        setObservationTemplates((obss as any).results || []);
      })
      .finally(() => setLoading(false));
  }, [open, defaultPatientId, defaultPractitionerId, defaultDepartmentId, defaultTemplateDt, defaultTemplateDn]);

  // Load patient details if patientId changes
  useEffect(() => {
    if (!patientId) {
      setSelectedPatient(null);
      return;
    }
    HealthcareApi.patients
      .get(patientId)
      .then((p: any) => setSelectedPatient(p))
      .catch(() => setSelectedPatient(null));
  }, [patientId]);

  // When templateDt changes, reset templateDn unless matching default
  const handleTemplateDtChange = (newDt: string) => {
    setTemplateDt(newDt);
    setTemplateDn("");
    setTitle("");

    // Auto-match category
    const cfg = MARLEY_TEMPLATE_TYPES.find((m) => m.dt === newDt);
    if (cfg) {
      const matchCat = categories.find((c) =>
        c.category.toLowerCase().includes(cfg.categoryHint.toLowerCase())
      );
      if (matchCat) setCategoryId(matchCat.id);
    }
  };

  // When a specific template item is chosen
  const handleSelectTemplateDn = (dn: string) => {
    setTemplateDn(dn);
    setTitle(dn);

    if (templateDt === "Lab Test Template") {
      const lab = labTemplates.find((l) => l.lab_test_name === dn);
      if (lab?.department) setDepartmentId(lab.department);
      setSampleRequired(true);
    } else if (templateDt === "Clinical Procedure Template") {
      const proc = procedureTemplates.find((p) => p.template_name === dn);
      if (proc?.department) setDepartmentId(proc.department);
      setSampleRequired(false);
    } else if (templateDt === "Observation Template") {
      const obs = observationTemplates.find((o) => (o.observation || o.preferred_display_name) === dn);
      if (obs?.sample_collection_required) setSampleRequired(true);
    }
  };

  // Handle selecting a common preset chip
  const handleApplyPreset = (preset: typeof COMMON_SERVICE_PRESETS[0]) => {
    setTemplateDt(preset.dt);
    setTemplateDn(preset.title);
    setTitle(preset.title);
    setSampleRequired(preset.sampleReq);

    const cat = categories.find((c) =>
      c.category.toLowerCase().includes(preset.category.toLowerCase())
    );
    if (cat) setCategoryId(cat.id);

    const dept = departments.find((d) =>
      d.department.toLowerCase().includes(preset.department.toLowerCase())
    );
    if (dept) setDepartmentId(dept.id);
  };

  const filteredPatients = useMemo(() => {
    if (!patientSearch) return patients.slice(0, 50);
    const s = patientSearch.toLowerCase();
    return patients
      .filter(
        (p) =>
          (p.patient_name || "").toLowerCase().includes(s) ||
          (p.patient_id || "").toLowerCase().includes(s) ||
          (p.mobile || "").includes(s)
      )
      .slice(0, 50);
  }, [patients, patientSearch]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientId) {
      toast.error("Please select a patient.");
      return;
    }
    const orderTitle = title.trim() || templateDn.trim();
    if (!orderTitle) {
      toast.error("Please enter or select a service order title.");
      return;
    }

    setSaving(true);
    try {
      // Build clinical notes with instructions if provided
      let fullNotes = notes.trim();
      if (patientInstructions.trim()) {
        fullNotes += (fullNotes ? "\n\n" : "") + `[Patient Instructions]: ${patientInstructions.trim()}`;
      }
      if (sampleRequired) {
        fullNotes += (fullNotes ? "\n" : "") + `[Sample Required]: Yes (Specimen collection protocol)`;
      }

      const res = await HealthcareApi.serviceRequests.create({
        patient: patientId,
        title: orderTitle,
        practitioner: practitionerId || null,
        department: departmentId || null,
        category: categoryId || null,
        status: "Active",
        intent,
        priority,
        order_date: orderDate || todayStr,
        expected_date: expectedDate || null,
        notes: fullNotes,
        reference_doctype: templateDt,
        reference_name: templateDn || orderTitle,
      });

      toast.success(`Service Request "${orderTitle}" created successfully (Active).`);
      onOpenChange(false);
      onSuccess?.(res);
    } catch (err: any) {
      console.error(err);
      toast.error(
        err?.response?.data?.detail ||
          err?.response?.data?.error ||
          "Failed to create service request."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] flex flex-col p-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="p-6 pb-4 border-b shrink-0 bg-muted/20">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0 shadow-2xs">
                <Icon icon="solar:clipboard-check-bold-duotone" size={22} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <DialogTitle className="text-lg font-bold tracking-tight">
                    New Clinical Service Request
                  </DialogTitle>
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                    Marley Clinical Order
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Order diagnostic investigations, lab panels, radiology imaging, clinical procedures, or therapy plans.
                </p>
              </div>
            </div>

            {priority === "STAT" && (
              <Badge className="bg-rose-600 text-white font-bold animate-pulse text-xs px-2.5 py-0.5">
                STAT Priority
              </Badge>
            )}
          </div>
        </DialogHeader>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">
          {/* Patient Card / Picker */}
          <div>
            <Label className="text-xs font-semibold">Patient Information *</Label>
            {defaultPatientId && selectedPatient ? (
              <div className="mt-1.5 p-3.5 rounded-xl bg-indigo-50/40 dark:bg-indigo-950/20 border border-indigo-200/70 dark:border-indigo-900/60 flex items-center justify-between shadow-2xs">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white font-bold flex items-center justify-center text-sm shadow-2xs">
                    {getInitials(selectedPatient.patient_name || defaultPatientName || "PT")}
                  </div>
                  <div>
                    <div className="font-bold text-sm text-foreground flex items-center gap-2">
                      <span>{selectedPatient.patient_name || defaultPatientName}</span>
                      <span className="font-mono text-xs text-muted-foreground font-normal">
                        ({selectedPatient.patient_id || `#${selectedPatient.id}`})
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                      <span>{formatAge(selectedPatient.dob, selectedPatient.age)}</span>
                      <span>•</span>
                      <span>{selectedPatient.sex || selectedPatient.gender || "Gender N/A"}</span>
                      {selectedPatient.blood_group && (
                        <>
                          <span>•</span>
                          <span className="font-bold text-rose-600">{selectedPatient.blood_group}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <Badge variant="outline" className="text-[11px] font-mono border-indigo-300 text-indigo-700">
                  MRN: {selectedPatient.patient_id || selectedPatient.id}
                </Badge>
              </div>
            ) : (
              <div className="mt-1.5 space-y-1.5">
                <Input
                  placeholder="Search patient by name or ID..."
                  value={patientSearch}
                  onChange={(e) => setPatientSearch(e.target.value)}
                  className="text-xs h-9"
                />
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={patientId || ""}
                  onChange={(e) => setPatientId(e.target.value ? Number(e.target.value) : undefined)}
                  required
                >
                  <option value="">Select Patient...</option>
                  {filteredPatients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.patient_name} (#{p.id}) {p.mobile ? `· ${p.mobile}` : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Quick Presets Chips */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <Label className="text-xs text-muted-foreground font-semibold">
                Quick Clinical Presets
              </Label>
              <span className="text-[10px] text-muted-foreground">1-Click Auto-Fill</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {COMMON_SERVICE_PRESETS.slice(0, 9).map((preset) => (
                <button
                  key={preset.title}
                  type="button"
                  onClick={() => handleApplyPreset(preset)}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-muted/60 hover:bg-indigo-50 hover:text-indigo-700 dark:hover:bg-indigo-950/60 border border-border/80 transition-all flex items-center gap-1"
                >
                  <Icon icon="solar:star-fall-bold" size={11} className="text-amber-500" />
                  {preset.title}
                </button>
              ))}
            </div>
          </div>

          {/* Marley Order Template Type (template_dt) */}
          <div>
            <Label className="text-xs font-semibold block mb-1.5">
              Order Template Type (Marley <span className="font-mono text-[10px]">template_dt</span>) *
            </Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {MARLEY_TEMPLATE_TYPES.map((t) => {
                const isSelected = templateDt === t.dt;
                return (
                  <button
                    key={t.dt}
                    type="button"
                    onClick={() => handleTemplateDtChange(t.dt)}
                    className={`p-2.5 rounded-xl border text-left flex items-center gap-2.5 transition-all ${
                      isSelected
                        ? "border-indigo-600 ring-2 ring-indigo-500/20 bg-indigo-50/50 dark:bg-indigo-950/40"
                        : "border-border/80 hover:bg-muted/40"
                    }`}
                  >
                    <div className={`p-1.5 rounded-lg border shrink-0 ${t.accent}`}>
                      <Icon icon={t.icon} size={15} />
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-xs text-foreground truncate">{t.label}</div>
                      <div className="font-mono text-[9px] text-muted-foreground truncate">{t.dt}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Order Template Selector (template_dn) & Title */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs font-semibold">
                Order Template (Marley <span className="font-mono text-[10px]">template_dn</span>)
              </Label>
              {templateDt === "Lab Test Template" && labTemplates.length > 0 ? (
                <select
                  className="mt-1.5 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={templateDn}
                  onChange={(e) => handleSelectTemplateDn(e.target.value)}
                >
                  <option value="">Select Lab Template...</option>
                  {labTemplates.map((l) => (
                    <option key={l.id} value={l.lab_test_name}>
                      {l.lab_test_name} {l.department_name ? `(${l.department_name})` : ""}
                    </option>
                  ))}
                </select>
              ) : templateDt === "Clinical Procedure Template" && procedureTemplates.length > 0 ? (
                <select
                  className="mt-1.5 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={templateDn}
                  onChange={(e) => handleSelectTemplateDn(e.target.value)}
                >
                  <option value="">Select Procedure Template...</option>
                  {procedureTemplates.map((p) => (
                    <option key={p.id} value={p.template_name}>
                      {p.template_name}
                    </option>
                  ))}
                </select>
              ) : templateDt === "Observation Template" && observationTemplates.length > 0 ? (
                <select
                  className="mt-1.5 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={templateDn}
                  onChange={(e) => handleSelectTemplateDn(e.target.value)}
                >
                  <option value="">Select Observation Template...</option>
                  {observationTemplates.map((o) => {
                    const name = o.observation || o.preferred_display_name;
                    return (
                      <option key={o.id} value={name}>
                        {name}
                      </option>
                    );
                  })}
                </select>
              ) : (
                <Input
                  className="mt-1.5 text-xs h-9"
                  placeholder="e.g. Chest X-Ray, Head CT, Suture..."
                  value={templateDn}
                  onChange={(e) => {
                    setTemplateDn(e.target.value);
                    if (!title) setTitle(e.target.value);
                  }}
                />
              )}
            </div>

            <div>
              <Label className="text-xs font-semibold">Service / Order Title *</Label>
              <Input
                className="mt-1.5 text-xs h-9"
                placeholder="Full clinical order designation..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Clinical Priority & Intent */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs font-semibold">Clinical Priority *</Label>
              <div className="grid grid-cols-4 gap-1.5 mt-1.5">
                {[
                  { key: "Routine", label: "Routine", color: "border-blue-300 text-blue-700 bg-blue-50/50" },
                  { key: "ASAP", label: "ASAP", color: "border-purple-300 text-purple-700 bg-purple-50/50" },
                  { key: "Urgent", label: "Urgent", color: "border-amber-300 text-amber-700 bg-amber-50/50" },
                  { key: "STAT", label: "STAT", color: "border-rose-400 text-rose-700 bg-rose-50/50 font-bold" },
                ].map((p) => {
                  const isSelected = priority === p.key;
                  return (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => setPriority(p.key)}
                      className={`h-8 rounded-lg text-xs font-semibold border transition-all ${
                        isSelected
                          ? "bg-primary text-primary-foreground border-primary shadow-2xs"
                          : p.color
                      }`}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold">Order Intent (FHIR / Marley)</Label>
              <select
                className="mt-1.5 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={intent}
                onChange={(e) => setIntent(e.target.value)}
              >
                <option value="Order">Order (Formal Requisition)</option>
                <option value="Plan">Plan (Part of Care Plan)</option>
                <option value="Proposal">Proposal (Recommendation)</option>
                <option value="Directive">Directive (Standing Order)</option>
              </select>
            </div>
          </div>

          {/* Practitioner & Department */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs font-semibold">Ordered By Practitioner *</Label>
              <select
                className="mt-1.5 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={practitionerId || ""}
                onChange={(e) => setPractitionerId(e.target.value ? Number(e.target.value) : undefined)}
              >
                <option value="">Select Practitioner...</option>
                {practitioners.map((pr) => (
                  <option key={pr.id} value={pr.id}>
                    Dr. {pr.practitioner_name} {pr.department_name ? `(${pr.department_name})` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label className="text-xs font-semibold">Medical Department</Label>
              <select
                className="mt-1.5 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={departmentId || ""}
                onChange={(e) => setDepartmentId(e.target.value ? Number(e.target.value) : undefined)}
              >
                <option value="">Select Department...</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.department}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Occurrence & Schedule Details */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <Label className="text-xs font-semibold">Order Date</Label>
              <Input
                type="date"
                className="mt-1.5 text-xs h-9"
                value={orderDate}
                onChange={(e) => setOrderDate(e.target.value)}
              />
            </div>

            <div>
              <Label className="text-xs font-semibold">Expected By Date</Label>
              <Input
                type="date"
                className="mt-1.5 text-xs h-9"
                value={expectedDate}
                onChange={(e) => setExpectedDate(e.target.value)}
              />
            </div>

            <div>
              <Label className="text-xs font-semibold">Quantity / Repeats</Label>
              <Input
                type="number"
                min={1}
                max={50}
                className="mt-1.5 text-xs h-9"
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value) || 1)}
              />
            </div>
          </div>

          {/* Flags: Sample Required & As Needed */}
          <div className="p-3 rounded-xl bg-muted/30 border border-border/70 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={sampleRequired}
                onChange={(e) => setSampleRequired(e.target.checked)}
                className="rounded border-input text-indigo-600 focus:ring-indigo-500 h-4 w-4"
              />
              <div>
                <span className="font-semibold text-xs text-foreground block">
                  Sample Collection Required
                </span>
                <span className="text-[10px] text-muted-foreground block">
                  Creates specimen collection order before processing
                </span>
              </div>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={asNeeded}
                onChange={(e) => setAsNeeded(e.target.checked)}
                className="rounded border-input text-indigo-600 focus:ring-indigo-500 h-4 w-4"
              />
              <div>
                <span className="font-semibold text-xs text-foreground block">
                  Occurrence As Needed (PRN)
                </span>
                <span className="text-[10px] text-muted-foreground block">
                  Only perform upon symptom trigger
                </span>
              </div>
            </label>
          </div>

          {/* Clinical Indication & Reason */}
          <div>
            <Label className="text-xs font-semibold">Clinical Indication / Reason for Request</Label>
            <textarea
              rows={2}
              className="mt-1.5 flex w-full rounded-md border border-input bg-background p-2.5 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              placeholder="e.g. Rule out iron deficiency anemia, evaluate persistent chest discomfort, post-operative surveillance..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* Patient Instructions */}
          <div>
            <Label className="text-xs font-semibold">Patient Preparation Instructions</Label>
            <textarea
              rows={2}
              className="mt-1.5 flex w-full rounded-md border border-input bg-background p-2.5 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              placeholder="e.g. Fast for 10-12 hours before specimen collection; drink 1L of water 1 hour prior to ultrasound..."
              value={patientInstructions}
              onChange={(e) => setPatientInstructions(e.target.value)}
            />
          </div>

          {/* Footer Actions */}
          <DialogFooter className="pt-3 border-t flex flex-row items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Icon icon="solar:shield-check-bold" size={14} className="text-emerald-600" />
              <span>Marley EHR Compliant</span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={saving || loading}
                className="bg-indigo-600 hover:bg-indigo-700 text-white min-w-28 shadow-2xs"
              >
                {saving ? (
                  <span className="flex items-center gap-1.5">
                    <Icon icon="solar:restart-bold" size={14} className="animate-spin" />
                    Placing Order...
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <Icon icon="solar:check-circle-bold" size={14} />
                    Submit Order
                  </span>
                )}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
