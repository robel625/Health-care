import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams, Link } from "react-router";
import { Icon } from "@/components/icon";
import { Button } from "@/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/ui/card";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { Badge } from "@/ui/badge";
import { Textarea } from "@/ui/textarea";
import { toast } from "sonner";
import {
  HealthcareApi,
  type Patient,
  type HealthcarePractitioner,
  type MedicalDepartment,
  type ServiceRequestCategory,
  type LabTestTemplate,
  type ClinicalProcedureTemplate,
  type ObservationTemplate,
} from "@/api/services/healthcareService";
import EntitySelect, { type EntityOption } from "@/components/healthcare/EntitySelect";
import { formatAge } from "@/utils/age";
import { getInitials } from "@/utils";

export const MARLEY_TEMPLATE_TYPES = [
  {
    dt: "Lab Test Template",
    label: "Laboratory & Pathology",
    description: "Blood tests, microbiology, urinalysis, biopsy",
    icon: "solar:flask-bold-duotone",
    accent: "text-purple-600 bg-purple-50 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300",
    borderActive: "border-purple-500 ring-2 ring-purple-500/20",
    categoryHint: "Laboratory",
  },
  {
    dt: "Clinical Procedure Template",
    label: "Clinical Procedure / Surgery",
    description: "Radiology, ECG, wound care, surgical operations",
    icon: "solar:scalpel-bold-duotone",
    accent: "text-blue-600 bg-blue-50 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300",
    borderActive: "border-blue-500 ring-2 ring-blue-500/20",
    categoryHint: "Procedure",
  },

  {
    dt: "Observation Template",
    label: "Clinical Observation",
    description: "Standardized patient assessment and vital monitoring",
    icon: "solar:eye-bold-duotone",
    accent: "text-amber-600 bg-amber-50 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300",
    borderActive: "border-amber-500 ring-2 ring-amber-500/20",
    categoryHint: "Observation",
  },
  {
    dt: "Appointment Type",
    label: "Consultation / OPD Booking",
    description: "Specialist consultation, follow-up, second opinion",
    icon: "solar:calendar-bold-duotone",
    accent: "text-indigo-600 bg-indigo-50 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300",
    borderActive: "border-indigo-500 ring-2 ring-indigo-500/20",
    categoryHint: "Consultation",
  },
  {
    dt: "Healthcare Activity",
    label: "General Clinical Order",
    description: "Custom clinical orders and nursing interventions",
    icon: "solar:notes-bold-duotone",
    accent: "text-slate-600 bg-slate-50 border-slate-200 dark:bg-slate-900 dark:text-slate-300",
    borderActive: "border-slate-500 ring-2 ring-slate-500/20",
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
  { title: "Specialist Surgery Consultation", dt: "Appointment Type", category: "Consultation", department: "Surgery", sampleReq: false },
];

export default function ServiceRequestCreatePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const urlPatientId = searchParams.get("patient");
  const urlPractitionerId = searchParams.get("practitioner");
  const urlDepartmentId = searchParams.get("department");
  const urlTemplateDt = searchParams.get("template_dt");
  const urlTemplateDn = searchParams.get("template_dn");

  // Form State
  const [patientId, setPatientId] = useState<number | null>(urlPatientId ? Number(urlPatientId) : null);
  const [practitionerId, setPractitionerId] = useState<number | null>(urlPractitionerId ? Number(urlPractitionerId) : null);
  const [departmentId, setDepartmentId] = useState<number | null>(urlDepartmentId ? Number(urlDepartmentId) : null);
  const [templateDt, setTemplateDt] = useState<string>(urlTemplateDt || "Lab Test Template");
  const [templateDn, setTemplateDn] = useState<string>(urlTemplateDn || "");
  const [title, setTitle] = useState<string>("");
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [priority, setPriority] = useState<string>("Routine");
  const [intent, setIntent] = useState<string>("Order");
  const [orderDate, setOrderDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [expectedDate, setExpectedDate] = useState<string>("");
  const [sampleCollectionRequired, setSampleCollectionRequired] = useState<boolean>(true);
  const [asNeeded, setAsNeeded] = useState<boolean>(false);
  const [clinicalHistory, setClinicalHistory] = useState<string>("");
  const [patientInstruction, setPatientInstruction] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  // Options & Entity Lookups
  const [patients, setPatients] = useState<Patient[]>([]);
  const [practitioners, setPractitioners] = useState<HealthcarePractitioner[]>([]);
  const [departments, setDepartments] = useState<MedicalDepartment[]>([]);
  const [categories, setCategories] = useState<ServiceRequestCategory[]>([]);
  const [labTemplates, setLabTemplates] = useState<LabTestTemplate[]>([]);
  const [procedureTemplates, setProcedureTemplates] = useState<ClinicalProcedureTemplate[]>([]);
  const [observationTemplates, setObservationTemplates] = useState<ObservationTemplate[]>([]);

  const [loadingLookups, setLoadingLookups] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [templateSearch, setTemplateSearch] = useState("");

  // Selected Patient Details
  const selectedPatient = useMemo(() => {
    return patients.find((p) => p.id === patientId) || null;
  }, [patients, patientId]);

  // Load Reference Data
  useEffect(() => {
    let isMounted = true;
    const loadLookups = async () => {
      setLoadingLookups(true);
      try {
        const [pRes, docRes, deptRes, catRes, labRes, procRes, obsRes] = await Promise.all([
          HealthcareApi.patients.list({ page_size: 150 }).catch(() => ({ results: [] })),
          HealthcareApi.practitioners.list({ page_size: 100 }).catch(() => ({ results: [] })),
          HealthcareApi.departments.list({ page_size: 100 }).catch(() => ({ results: [] })),
          HealthcareApi.serviceRequestCategories.list({ page_size: 100 }).catch(() => ({ results: [] })),
          HealthcareApi.labTestTemplates.list({ page_size: 150 }).catch(() => ({ results: [] })),
          HealthcareApi.procedureTemplates.list({ page_size: 150 }).catch(() => ({ results: [] })),
          HealthcareApi.observationTemplates.list({ page_size: 100 }).catch(() => ({ results: [] })),
        ]);

        if (!isMounted) return;

        setPatients((pRes as any).results || []);
        setPractitioners((docRes as any).results || []);
        setDepartments((deptRes as any).results || []);
        setCategories((catRes as any).results || []);
        setLabTemplates((labRes as any).results || []);
        setProcedureTemplates((procRes as any).results || []);
        setObservationTemplates((obsRes as any).results || []);
      } catch (err) {
        console.error("Failed to load reference lookups", err);
      } finally {
        if (isMounted) setLoadingLookups(false);
      }
    };

    loadLookups();
    return () => {
      isMounted = false;
    };
  }, []);

  // Update Sample Collection requirement default when template type changes
  const handleSelectTemplateDt = (dt: string) => {
    setTemplateDt(dt);
    setTemplateDn("");
    setTemplateSearch("");

    const matchingMeta = MARLEY_TEMPLATE_TYPES.find((m) => m.dt === dt);
    if (matchingMeta && categories.length > 0) {
      const matchedCat = categories.find((c) =>
        c.category.toLowerCase().includes(matchingMeta.categoryHint.toLowerCase())
      );
      if (matchedCat) setCategoryId(matchedCat.id);
    }

    if (dt === "Lab Test Template") {
      setSampleCollectionRequired(true);
    } else {
      setSampleCollectionRequired(false);
    }
  };

  // Select dynamic template
  const handleSelectTemplateDn = (name: string, deptHint?: string | null, sampleReq?: boolean) => {
    setTemplateDn(name);
    if (!title || title.trim() === "") {
      setTitle(name);
    }
    if (deptHint && departments.length > 0) {
      const matchDept = departments.find((d) =>
        d.department.toLowerCase().includes(deptHint.toLowerCase())
      );
      if (matchDept) setDepartmentId(matchDept.id);
    }
    if (typeof sampleReq === "boolean") {
      setSampleCollectionRequired(sampleReq);
    }
  };

  // Apply Common Clinical Preset
  const handleApplyPreset = (preset: typeof COMMON_SERVICE_PRESETS[0]) => {
    handleSelectTemplateDt(preset.dt);
    setTitle(preset.title);
    setTemplateDn(preset.title);
    setSampleCollectionRequired(preset.sampleReq);

    const matchCat = categories.find((c) =>
      c.category.toLowerCase().includes(preset.category.toLowerCase())
    );
    if (matchCat) setCategoryId(matchCat.id);

    const matchDept = departments.find((d) =>
      d.department.toLowerCase().includes(preset.department.toLowerCase())
    );
    if (matchDept) setDepartmentId(matchDept.id);

    toast.info(`Applied preset: ${preset.title}`);
  };

  // Submit Order Requisition
  const handleSubmit = async (targetStatus: "Active" | "Draft" = "Active") => {
    if (!patientId) {
      toast.error("Please select a patient for this clinical service request.");
      return;
    }
    const finalTitle = title.trim() || templateDn.trim();
    if (!finalTitle) {
      toast.error("Please specify a service title or select an order template.");
      return;
    }

    setSubmitting(true);
    try {
      const combinedNotes = [
        clinicalHistory ? `Clinical Indication: ${clinicalHistory}` : "",
        patientInstruction ? `Patient Instructions: ${patientInstruction}` : "",
        notes ? `Internal Notes: ${notes}` : "",
      ]
        .filter(Boolean)
        .join("\n\n");

      const payload: any = {
        patient: patientId,
        title: finalTitle,
        practitioner: practitionerId || null,
        department: departmentId || null,
        category: categoryId || null,
        status: targetStatus,
        intent,
        priority,
        order_date: orderDate || new Date().toISOString().slice(0, 10),
        expected_date: expectedDate || null,
        notes: combinedNotes,
        reference_doctype: templateDt,
        reference_name: templateDn || finalTitle,
      };

      const res = await HealthcareApi.serviceRequests.create(payload);
      toast.success(
        targetStatus === "Active"
          ? `Clinical Service Request ${res.request_id || ""} ordered successfully!`
          : `Service Request saved as draft.`
      );

      // Navigate to detail page of the created request or back to patient dashboard
      if (res && res.id) {
        navigate(`/healthcare/service-requests/${res.id}`);
      } else if (patientId) {
        navigate(`/healthcare/patients/${patientId}`);
      } else {
        navigate("/healthcare/service-requests");
      }
    } catch (err: any) {
      console.error(err);
      toast.error(
        err?.response?.data?.detail ||
          err?.response?.data?.title?.[0] ||
          "Failed to submit clinical service request."
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Filter templates list based on active templateDt
  const currentTemplates = useMemo(() => {
    const q = templateSearch.toLowerCase().trim();
    if (templateDt === "Lab Test Template") {
      return labTemplates
        .filter((t) => !q || t.lab_test_name.toLowerCase().includes(q))
        .map((t) => ({
          name: t.lab_test_name,
          desc: t.department_name ? `Dept: ${t.department_name}` : "Pathology / Lab",
          sampleReq: !!(t.sample || t.sample_name || true),
        }));
    }
    if (templateDt === "Clinical Procedure Template") {
      return procedureTemplates
        .filter((t) => !q || t.template_name.toLowerCase().includes(q))
        .map((t) => ({
          name: t.template_name,
          desc: t.description || "Clinical Procedure",
          sampleReq: false,
        }));
    }
    if (templateDt === "Observation Template") {
      return observationTemplates
        .filter((t) => !q || (t.observation || t.preferred_display_name).toLowerCase().includes(q))
        .map((t) => ({
          name: t.observation || t.preferred_display_name,
          desc: t.observation_category || "Clinical Observation",
          sampleReq: t.sample_collection_required,
        }));
    }
    return [];
  }, [templateDt, templateSearch, labTemplates, procedureTemplates, observationTemplates]);

  const patientOptions: EntityOption[] = useMemo(() => {
    return patients.map((p) => ({
      value: p.id,
      label: p.patient_name,
      sublabel: `ID: #${p.id} · ${p.sex || "Unknown"} · ${formatAge(p.dob, p.age)}`,
      avatarName: p.patient_name,
    }));
  }, [patients]);

  const practitionerOptions: EntityOption[] = useMemo(() => {
    return practitioners.map((d) => ({
      value: d.id,
      label: d.practitioner_name,
      sublabel: d.department_name ? `Dept: ${d.department_name}` : "Physician",
      avatarName: d.practitioner_name,
    }));
  }, [practitioners]);

  const departmentOptions: EntityOption[] = useMemo(() => {
    return departments.map((d) => ({
      value: d.id,
      label: d.department,
      avatarName: d.department,
    }));
  }, [departments]);

  return (
    <div className="space-y-6 pb-24 max-w-7xl mx-auto">
      {/* ── Breadcrumb & Action Header ────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <Link to="/healthcare" className="hover:text-foreground transition-colors">
              Healthcare
            </Link>
            <Icon icon="solar:alt-arrow-right-linear" size={12} />
            <Link to="/healthcare/service-requests" className="hover:text-foreground transition-colors">
              Service Requests
            </Link>
            <Icon icon="solar:alt-arrow-right-linear" size={12} />
            <span className="text-foreground font-medium">New Clinical Requisition</span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              New Clinical Service Request
            </h1>
            <Badge variant="outline" className="border-indigo-300 text-indigo-700 bg-indigo-50 dark:bg-indigo-950/40">
              Marley Requisition Engine
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Order laboratory diagnostics, clinical surgical procedures, or consultations.
          </p>
        </div>

        {/* Top Actions */}
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              if (patientId) navigate(`/healthcare/patients/${patientId}`);
              else navigate("/healthcare/service-requests");
            }}
            className="text-xs"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={submitting}
            onClick={() => handleSubmit("Draft")}
            className="text-xs border-slate-300 hover:bg-slate-50"
          >
            <Icon icon="solar:disk-bold" size={14} className="mr-1.5" />
            Save as Draft
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={submitting}
            onClick={() => handleSubmit("Active")}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-sm"
          >
            {submitting ? (
              <>
                <Icon icon="solar:spinner-line-duotone" size={14} className="mr-1.5 animate-spin" />
                Ordering...
              </>
            ) : (
              <>
                <Icon icon="solar:check-circle-bold" size={14} className="mr-1.5" />
                Submit & Order Requisition
              </>
            )}
          </Button>
        </div>
      </div>

      {/* ── Patient Banner & Context Card ─────────────────────────────────── */}
      <Card className="border-indigo-100 dark:border-indigo-900/50 shadow-xs bg-linear-to-r from-indigo-50/50 via-background to-background">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
            {/* Patient Select / Display */}
            <div className="md:col-span-2 space-y-1.5">
              <Label className="text-xs font-semibold text-foreground flex items-center justify-between">
                <span>Target Patient *</span>
                {selectedPatient && (
                  <Link
                    to={`/healthcare/patients/${selectedPatient.id}`}
                    className="text-[11px] text-indigo-600 hover:underline flex items-center gap-1 font-normal"
                  >
                    View Chart <Icon icon="solar:arrow-right-up-linear" size={10} />
                  </Link>
                )}
              </Label>
              <EntitySelect
                options={patientOptions}
                value={patientId}
                onChange={(val) => setPatientId(val)}
                placeholder={loadingLookups ? "Loading patients..." : "Search patient by name or ID..."}
                tone="purple"
                doctype="Patient"
              />
            </div>

            {/* Ordering Practitioner */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">
                Ordering Clinician / Doctor
              </Label>
              <EntitySelect
                options={practitionerOptions}
                value={practitionerId}
                onChange={(val) => setPractitionerId(val)}
                placeholder="Select ordering clinician..."
                tone="blue"
                doctype="Healthcare Practitioner"
              />
            </div>
          </div>

          {/* Quick Demographics Strip if patient selected */}
          {selectedPatient && (
            <div className="mt-3 pt-3 border-t border-indigo-100 dark:border-indigo-900/40 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5 font-medium text-foreground">
                <div className="h-6 w-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-bold">
                  {getInitials(selectedPatient.patient_name)}
                </div>
                <span>{selectedPatient.patient_name}</span>
              </div>
              <span>•</span>
              <span>MRN: <strong className="text-foreground">#{selectedPatient.id}</strong></span>
              <span>•</span>
              <span>Gender: <strong className="text-foreground">{selectedPatient.sex || "Unspecified"}</strong></span>
              <span>•</span>
              <span>Age: <strong className="text-foreground">{formatAge(selectedPatient.dob, selectedPatient.age)}</strong></span>
              {selectedPatient.blood_group && (
                <>
                  <span>•</span>
                  <span>Blood: <Badge variant="outline" className="text-[10px] py-0 px-1.5 border-rose-300 text-rose-700 bg-rose-50">{selectedPatient.blood_group}</Badge></span>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Quick Presets Carousel ────────────────────────────────────────── */}
      <div>
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <Icon icon="solar:bolt-bold" size={13} className="text-amber-500" />
          <span>Quick Clinical Presets</span>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          {COMMON_SERVICE_PRESETS.map((preset, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleApplyPreset(preset)}
              className="px-2.5 py-1.5 rounded-lg border bg-background hover:bg-muted/80 hover:border-indigo-300 transition-all text-left shrink-0 text-xs flex items-center gap-2 group cursor-pointer shadow-2xs"
            >
              <div className="h-2 w-2 rounded-full bg-indigo-500 group-hover:scale-125 transition-transform" />
              <span className="font-medium text-foreground">{preset.title}</span>
              <span className="text-[10px] text-muted-foreground px-1 py-0.2 rounded bg-muted">
                {preset.category}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Left 2 Columns: Requisition Type & Specifications ────────────── */}
        <div className="lg:col-span-2 space-y-6">
          {/* Step 1: Marley Template Type (template_dt) */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <span className="h-5 w-5 rounded-full bg-indigo-600 text-white text-[10px] font-bold flex items-center justify-center">1</span>
                <span>Select Order Template Type (Marley Template DocType)</span>
              </CardTitle>
              <CardDescription className="text-xs">
                Classifies the clinical requisition and specifies downstream fulfillment automation.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {MARLEY_TEMPLATE_TYPES.map((type) => {
                  const isSelected = templateDt === type.dt;
                  return (
                    <div
                      key={type.dt}
                      onClick={() => handleSelectTemplateDt(type.dt)}
                      className={`p-3 rounded-xl border text-left cursor-pointer transition-all flex flex-col justify-between ${
                        isSelected
                          ? `${type.borderActive} bg-card shadow-xs`
                          : "border-border hover:border-muted-foreground/30 bg-background hover:bg-muted/30"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className={`p-2 rounded-lg ${type.accent}`}>
                          <Icon icon={type.icon} size={20} />
                        </div>
                        {isSelected && (
                          <Icon icon="solar:check-circle-bold" size={18} className="text-indigo-600 shrink-0" />
                        )}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-foreground">{type.label}</div>
                        <div className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                          {type.description}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Step 2: Specific Template Loader (template_dn) */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-5 w-5 rounded-full bg-indigo-600 text-white text-[10px] font-bold flex items-center justify-center">2</span>
                  <span>Choose Template or Custom Service Name</span>
                </div>
                {templateDn && (
                  <Badge variant="outline" className="text-[11px] text-indigo-700 bg-indigo-50 border-indigo-200">
                    Selected: {templateDn}
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="text-xs">
                Select from configured catalog templates to auto-populate reference ranges and clinical parameters.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Service Title Input */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground">
                  Requisition Title / Service Name *
                </Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Complete Blood Count (CBC) with Differential"
                  className="font-medium text-sm"
                />
              </div>

              {/* Template Catalog Grid */}
              {currentTemplates.length > 0 && (
                <div className="space-y-2 pt-2 border-t">
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Available {templateDt} Catalog ({currentTemplates.length})
                    </Label>
                    <div className="relative w-48">
                      <Icon
                        icon="solar:magnifer-linear"
                        size={13}
                        className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                      />
                      <Input
                        value={templateSearch}
                        onChange={(e) => setTemplateSearch(e.target.value)}
                        placeholder="Search templates..."
                        className="h-7 text-xs pl-7"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                    {currentTemplates.map((t, idx) => {
                      const isPicked = templateDn === t.name;
                      return (
                        <div
                          key={idx}
                          onClick={() => handleSelectTemplateDn(t.name, t.desc, t.sampleReq)}
                          className={`p-2.5 rounded-lg border text-left cursor-pointer transition-all flex items-center justify-between gap-2 ${
                            isPicked
                              ? "border-indigo-500 bg-indigo-50/60 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200"
                              : "border-border hover:border-indigo-300 hover:bg-muted/40"
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="text-xs font-semibold truncate">{t.name}</div>
                            <div className="text-[10px] text-muted-foreground truncate">{t.desc}</div>
                          </div>
                          {t.sampleReq && (
                            <Badge variant="outline" className="text-[9px] px-1 py-0 border-purple-300 text-purple-700 bg-purple-50 shrink-0">
                              Sample
                            </Badge>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Step 3: Clinical Indications & Patient Instructions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <span className="h-5 w-5 rounded-full bg-indigo-600 text-white text-[10px] font-bold flex items-center justify-center">3</span>
                <span>Clinical Indication & Preparation Instructions</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground">
                  Clinical Indication / Reason for Requisition
                </Label>
                <Textarea
                  value={clinicalHistory}
                  onChange={(e) => setClinicalHistory(e.target.value)}
                  placeholder="e.g. Acute lower right quadrant abdominal pain, rule out appendicitis..."
                  rows={2}
                  className="text-xs"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground">
                    Patient Preparation Instructions
                  </Label>
                  <Textarea
                    value={patientInstruction}
                    onChange={(e) => setPatientInstruction(e.target.value)}
                    placeholder="e.g. Fast 10 hours prior to blood draw. Full urinary bladder required for pelvis ultrasound."
                    rows={2}
                    className="text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground">
                    Internal Clinical Notes
                  </Label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Internal physician guidance, nursing warnings, billing notes..."
                    rows={2}
                    className="text-xs"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Right Column: Execution Parameters & Preview ─────────────────── */}
        <div className="space-y-6">
          {/* Priority & Scheduling Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold">Execution Parameters</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Clinical Priority */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground flex items-center justify-between">
                  <span>Clinical Priority *</span>
                  {priority === "STAT" && (
                    <span className="flex items-center gap-1 text-[11px] font-bold text-rose-600 animate-pulse">
                      <span className="h-2 w-2 rounded-full bg-rose-600" /> STAT Emergency
                    </span>
                  )}
                </Label>
                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { id: "Routine", label: "Routine", color: "hover:border-blue-300 text-blue-700 active:bg-blue-50" },
                    { id: "ASAP", label: "ASAP", color: "hover:border-purple-300 text-purple-700 active:bg-purple-50" },
                    { id: "Urgent", label: "Urgent", color: "hover:border-amber-300 text-amber-700 active:bg-amber-50" },
                    { id: "STAT", label: "STAT", color: "hover:border-rose-400 text-rose-700 font-bold active:bg-rose-50" },
                  ].map((p) => {
                    const isPicked = priority === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setPriority(p.id)}
                        className={`py-1.5 px-2 rounded-lg border text-xs font-medium text-center transition-all cursor-pointer ${
                          isPicked
                            ? p.id === "STAT"
                              ? "bg-rose-600 text-white border-rose-600 shadow-xs"
                              : "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                            : `bg-background border-border ${p.color}`
                        }`}
                      >
                        {p.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Order Intent */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground">Order Intent</Label>
                <div className="grid grid-cols-3 gap-1.5">
                  {["Order", "Plan", "Proposal"].map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setIntent(item)}
                      className={`py-1.5 px-2 rounded-lg border text-xs font-medium text-center transition-all cursor-pointer ${
                        intent === item
                          ? "bg-indigo-50 border-indigo-400 text-indigo-700 font-semibold"
                          : "bg-background border-border hover:bg-muted text-muted-foreground"
                      }`}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>

              {/* Department */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground">Medical Department</Label>
                <EntitySelect
                  options={departmentOptions}
                  value={departmentId}
                  onChange={(val) => setDepartmentId(val)}
                  placeholder="Select department..."
                  tone="blue"
                  doctype="Medical Department"
                />
              </div>

              {/* Category */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground">Category</Label>
                <select
                  value={categoryId ?? ""}
                  onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : null)}
                  className="w-full text-xs rounded-md border border-input bg-background px-3 py-2 shadow-xs outline-none focus:border-indigo-500"
                >
                  <option value="">(Select Category)</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.category}
                    </option>
                  ))}
                </select>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground">Order Date *</Label>
                  <Input
                    type="date"
                    value={orderDate}
                    onChange={(e) => setOrderDate(e.target.value)}
                    className="text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground">Due Date</Label>
                  <Input
                    type="date"
                    value={expectedDate}
                    onChange={(e) => setExpectedDate(e.target.value)}
                    className="text-xs"
                  />
                </div>
              </div>

              {/* Marley Toggles */}
              <div className="space-y-2 pt-2 border-t">
                {/* Specimen Required */}
                <label className="flex items-center justify-between p-2.5 rounded-lg border bg-background hover:bg-muted/30 cursor-pointer">
                  <div className="flex items-center gap-2">
                    <Icon icon="solar:test-tube-bold" size={16} className="text-purple-600" />
                    <div>
                      <div className="text-xs font-semibold text-foreground">Specimen Collection Required</div>
                      <div className="text-[10px] text-muted-foreground">Creates automated Sample Collection order</div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={sampleCollectionRequired}
                    onChange={(e) => setSampleCollectionRequired(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                </label>

                {/* PRN / As Needed */}
                <label className="flex items-center justify-between p-2.5 rounded-lg border bg-background hover:bg-muted/30 cursor-pointer">
                  <div className="flex items-center gap-2">
                    <Icon icon="solar:clock-circle-bold" size={16} className="text-amber-600" />
                    <div>
                      <div className="text-xs font-semibold text-foreground">As Needed (PRN)</div>
                      <div className="text-[10px] text-muted-foreground">Execute only when clinically indicated</div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={asNeeded}
                    onChange={(e) => setAsNeeded(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                </label>
              </div>
            </CardContent>
          </Card>

          {/* Requisition Summary Card */}
          <Card className="border-indigo-200 bg-indigo-50/30 dark:bg-indigo-950/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-indigo-800 dark:text-indigo-300">
                Requisition Slip Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Order Title:</span>
                <span className="font-semibold text-foreground text-right">{title || templateDn || "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">DocType:</span>
                <span className="font-medium text-foreground">{templateDt}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Priority:</span>
                <span className="font-bold text-foreground">{priority}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Patient:</span>
                <span className="font-medium text-foreground">{selectedPatient?.patient_name || "Unselected"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Sample Collection:</span>
                <span className="font-medium text-foreground">{sampleCollectionRequired ? "Required" : "Not Required"}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Sticky Bottom Floating Action Bar ─────────────────────────────── */}
      <div className="fixed bottom-4 inset-x-0 z-30 pointer-events-none">
        <div className="max-w-7xl mx-auto px-4 pointer-events-auto">
          <div className="rounded-2xl border bg-background/95 backdrop-blur-md shadow-xl px-5 py-3 flex items-center justify-between gap-4 transition-all">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-indigo-600/10 text-indigo-600 flex items-center justify-center font-bold text-xs shrink-0">
                <Icon icon="solar:clipboard-check-bold" size={20} />
              </div>
              <div>
                <div className="text-xs font-semibold text-foreground flex items-center gap-2">
                  <span>{title || templateDn || "New Clinical Requisition"}</span>
                  {priority === "STAT" && (
                    <Badge variant="destructive" className="text-[10px] py-0 px-1.5">
                      STAT
                    </Badge>
                  )}
                </div>
                <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                  <span>Patient: {selectedPatient?.patient_name || "Select patient"}</span>
                  <span>•</span>
                  <span>{templateDt}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (patientId) navigate(`/healthcare/patients/${patientId}`);
                  else navigate("/healthcare/service-requests");
                }}
                className="text-xs text-muted-foreground hover:text-foreground h-8"
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={submitting}
                onClick={() => handleSubmit("Draft")}
                className="text-xs h-8"
              >
                <Icon icon="solar:disk-bold" size={13} className="mr-1.5" />
                Save Draft
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={submitting}
                onClick={() => handleSubmit("Active")}
                className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm font-semibold text-xs px-4 h-8"
              >
                {submitting ? (
                  <>
                    <Icon icon="solar:spinner-line-duotone" size={14} className="mr-1.5 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Icon icon="solar:check-circle-bold" size={14} className="mr-1.5" />
                    Submit & Order
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
