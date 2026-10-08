import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router";
import { Icon } from "@/components/icon";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { Separator } from "@/ui/separator";
import { HealthcareApi } from "@/api/services/healthcareService";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/ui/dialog";
import Avatar from "@/components/Avatar";
import { getInitials } from "@/utils";
import type {
  Patient,
  HealthcarePractitioner,
  ObservationTemplate,
  ObservationReferenceRange,
  MedicalDepartment,
} from "@/api/services/healthcareService";
import { useDoctypePermissions } from "@/utils/permissions";
import DocumentSidebar from "@/components/healthcare/DocumentSidebar";

type Tab = "details" | "medical_coding" | "more_information";
interface MedicalCodeRow { code_system: string; code_value: string; code: string; display: string; definition: string; }

/**
 * Declared at module scope on purpose. A component defined inside the page
 * body is a new type on every render, which makes React remount its subtree —
 * and remounting an `<Input>` drops the caret on every keystroke.
 */
function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-xs text-muted-foreground">
        {label} {required && <span className="text-red-500">*</span>}
      </Label>
      {children}
    </div>
  );
}

export default function ObservationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { canCreate, canWrite } = useDoctypePermissions("Observation");
  const canSave = id ? canWrite : canCreate;
  const navigate = useNavigate();
  const isNew = !id || id === "new";

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" } | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("details");

  const [patients, setPatients] = useState<Patient[]>([]);
  const [practitioners, setPractitioners] = useState<HealthcarePractitioner[]>([]);
  const [templates, setTemplates] = useState<ObservationTemplate[]>([]);
  const [departments, setDepartments] = useState<MedicalDepartment[]>([]);
  const [medicalCodes, setMedicalCodes] = useState<MedicalCodeRow[]>([]);

  // Template details expanded state
  const [templateDetailsOpen, setTemplateDetailsOpen] = useState(false);
  const [descriptionOpen, setDescriptionOpen] = useState(false);

  // Comments
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState("");

  // Activity
  const [activity, setActivity] = useState<{ action: string; time: string }[]>([]);

  const [form, setForm] = useState({
    naming_series: "HLC-OBS-.YYYY.-",
    observation_template: null as number | null,
    posting_date: new Date().toISOString().split("T")[0],
    observation_category: "",
    status: "Registered",
    patient: null as number | null,
    appointment: null as number | null,
    practitioner: null as number | null,
    medical_department: null as number | null,
    has_component: false,
    sample_collection_required: false,
    sample: "",
    permitted_data_type: "",
    sample_collection_time: "",
    sample_status: "",
    result: "",
    notes: "",
    description: "",
  });

  const [patientName, setPatientName] = useState("");
  const [patientGender, setPatientGender] = useState("");
  const [, setPractitionerName] = useState("");
  const [templateName, setTemplateName] = useState("");

  const [referenceRanges, setReferenceRanges] = useState<ObservationReferenceRange[]>([]);
  const [selectedTemplateObj, setSelectedTemplateObj] = useState<ObservationTemplate | null>(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [observationMeta, setObservationMeta] = useState<{
    creation?: string;
    modified?: string;
    owner?: string;
    modified_by?: string;
  }>({});

  // ── Load data ──────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [pats, pracs, temps, depts] = await Promise.all([
        HealthcareApi.patients.list({ page_size: 200 }),
        HealthcareApi.practitioners.list({ page_size: 200 }),
        HealthcareApi.observationTemplates.list({ page_size: 200 }).catch(() => ({ results: [] })),
        HealthcareApi.departments.list({ page_size: 200 }),
      ]);
      setPatients(pats.results || []);
      setPractitioners(pracs.results || []);
      const loadedTemplates = (temps as any).results || [];
      setTemplates(loadedTemplates);
      setDepartments(depts.results || []);

      if (id && id !== "new") {
        const res = await HealthcareApi.observations.get(Number(id)) as any;
        setForm({
          naming_series: res.naming_series || "HLC-OBS-.YYYY.-",
          observation_template: res.observation_template,
          posting_date: res.posting_date || new Date().toISOString().split("T")[0],
          observation_category: res.observation_category || "",
          status: res.status || "Registered",
          patient: res.patient,
          appointment: res.appointment,
          practitioner: res.practitioner,
          medical_department: res.medical_department,
          has_component: res.has_component || false,
          sample_collection_required: res.sample_collection_required || false,
          sample: res.sample || "",
          permitted_data_type: res.permitted_data_type || "",
          sample_collection_time: res.sample_collection_time || "",
          sample_status: res.sample_status || "",
          result: res.result || "",
          notes: res.notes || "",
          description: res.description || "",
        });
        setPatientName(res.patient_name || "");
        setPatientGender(res.gender || res.patient_sex || "");
        setPractitionerName(res.practitioner_name || "");
        setTemplateName(res.observation_template_name || "");
        setObservationMeta({
          creation: res.creation || res.created_at,
          modified: res.modified || res.updated_at,
          owner: res.owner,
          modified_by: res.modified_by,
        });

        if (res.observation_template) {
          const matched = loadedTemplates.find((t: any) => t.id === res.observation_template);
          if (matched) setSelectedTemplateObj(matched);
          HealthcareApi.observationReferenceRanges
            .list({ observation_template: res.observation_template })
            .then((r) => setReferenceRanges(r.results || []))
            .catch(() => setReferenceRanges([]));
        }

        setActivity([
          { action: "You created this", time: "just now" },
          { action: "You last edited this", time: "just now" },
        ]);
      } else {
        setActivity([
          { action: "You created this", time: "just now" },
        ]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  const handleTemplateSelect = (templateId: number | null) => {
    setForm((prev) => ({ ...prev, observation_template: templateId }));
    if (templateId) {
      const tpl = templates.find((t) => t.id === templateId);
      if (tpl) {
        setSelectedTemplateObj(tpl);
        setTemplateName(tpl.observation);
        setForm((prev) => ({
          ...prev,
          observation_template: templateId,
          observation_category: tpl.observation_category || prev.observation_category,
          permitted_data_type: tpl.permitted_data_type || prev.permitted_data_type,
          sample_collection_required: tpl.sample_collection_required ?? prev.sample_collection_required,
          medical_department: tpl.department || prev.medical_department,
        }));
      }
      HealthcareApi.observationReferenceRanges
        .list({ observation_template: templateId })
        .then((r) => setReferenceRanges(r.results || []))
        .catch(() => setReferenceRanges([]));
    } else {
      setSelectedTemplateObj(null);
      setReferenceRanges([]);
    }
  };

  const computeInterpretation = () => {
    if (!form.result || (form.permitted_data_type && form.permitted_data_type !== "Quantity")) {
      return null;
    }
    const val = Number(form.result);
    if (isNaN(val)) return null;

    const range =
      referenceRanges.find((r) => r.applies_to?.toLowerCase() === patientGender?.toLowerCase()) ||
      referenceRanges.find((r) => r.applies_to === "All") ||
      referenceRanges[0];
    if (!range) return null;

    const normalFrom = range.normal_from ? Number(range.normal_from) : null;
    const normalTo = range.normal_to ? Number(range.normal_to) : null;

    if (normalFrom != null && val < normalFrom) {
      return {
        status: "LOW",
        badgeClass: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-200",
        icon: "solar:arrow-down-bold",
        text: `Low (Normal: ${normalFrom} - ${normalTo ?? "∞"} ${selectedTemplateObj?.permitted_unit || ""})`,
      };
    }
    if (normalTo != null && val > normalTo) {
      return {
        status: "HIGH",
        badgeClass: "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950 dark:text-rose-200",
        icon: "solar:arrow-up-bold",
        text: `High (Normal: ${normalFrom ?? "0"} - ${normalTo} ${selectedTemplateObj?.permitted_unit || ""})`,
      };
    }
    if (normalFrom != null || normalTo != null) {
      return {
        status: "NORMAL",
        badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-200",
        icon: "solar:check-circle-bold",
        text: `Normal (${normalFrom ?? 0} - ${normalTo ?? "∞"} ${selectedTemplateObj?.permitted_unit || ""})`,
      };
    }
    return null;
  };

  const handleApprove = async () => {
    if (!id || isNew) return;
    try {
      await HealthcareApi.observations.approve(Number(id));
      setToast({ msg: "Observation approved successfully", type: "ok" });
      setForm((prev) => ({ ...prev, status: "Final" }));
      loadData();
    } catch (err: any) {
      setToast({ msg: err?.message || "Failed to approve observation", type: "err" });
    }
  };

  const handleReject = async () => {
    if (!id || isNew) return;
    try {
      await HealthcareApi.observations.reject(Number(id), rejectReason);
      setToast({ msg: "Observation rejected", type: "ok" });
      setRejectDialogOpen(false);
      setForm((prev) => ({ ...prev, status: "Cancelled" }));
      loadData();
    } catch (err: any) {
      setToast({ msg: err?.message || "Failed to reject observation", type: "err" });
    }
  };

  const handleSetStatus = async (newStatus: string) => {
    if (!id || isNew) return;
    try {
      await HealthcareApi.observations.setStatus(Number(id), newStatus);
      setToast({ msg: `Status updated to ${newStatus}`, type: "ok" });
      setForm((prev) => ({ ...prev, status: newStatus }));
      loadData();
    } catch (err: any) {
      setToast({ msg: err?.message || "Failed to update status", type: "err" });
    }
  };

  useEffect(() => { loadData(); }, [loadData]);

  // ── Update names on selection ──────────────────────────────────────
  useEffect(() => {
    if (form.patient) {
      const p = patients.find((pt) => pt.id === form.patient);
      if (p) { setPatientName(p.patient_name); setPatientGender(p.sex); }
    }
  }, [form.patient, patients]);

  useEffect(() => {
    if (form.practitioner) {
      const p = practitioners.find((pr) => pr.id === form.practitioner);
      if (p) setPractitionerName(p.practitioner_name);
    }
  }, [form.practitioner, practitioners]);

  useEffect(() => {
    if (form.observation_template) {
      const t = templates.find((tmp) => tmp.id === form.observation_template);
      if (t) {
        setTemplateName(t.observation);
        setForm((prev) => ({
          ...prev,
          observation_category: prev.observation_category || t.observation_category,
          permitted_data_type: prev.permitted_data_type || t.permitted_data_type,
          has_component: prev.has_component || t.has_component,
          sample_collection_required: prev.sample_collection_required || t.sample_collection_required,
          sample: prev.sample || t.preferred_display_name || "",
        }));
      }
    }
  }, [form.observation_template, templates]);

  // ── Save ───────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!form.patient) {
      setToast({ msg: "Patient is required", type: "err" });
      return;
    }
    setSaving(true);
    try {
      const payload: any = { ...form };
      if (isNew) {
        const res = await HealthcareApi.observations.create(payload) as any;
        setToast({ msg: "Observation created", type: "ok" });
        navigate(`/healthcare/observations/${res.id}`);
      } else {
        await HealthcareApi.observations.update(Number(id), payload);
        setToast({ msg: "Observation saved", type: "ok" });
        setActivity((prev) => [...prev, { action: "You last edited this", time: "just now" }]);
      }
    } catch (err) {
      setToast({ msg: "Failed to save", type: "err" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!id || !confirm("Delete this observation?")) return;
    await HealthcareApi.observations.delete(Number(id));
    navigate("/healthcare/observations");
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    setComments((prev) => [...prev, { id: Date.now(), author: "RG", content: newComment, time: "just now" }]);
    setNewComment("");
  };

  const initials = getInitials(patientName, "OB");

  const tabs: { key: Tab; label: string }[] = [
    { key: "details", label: "Details" },
    { key: "medical_coding", label: "Medical Coding" },
    { key: "more_information", label: "More Information" },
  ];

  return (
    <div className="min-h-screen bg-background">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-2 rounded-md text-sm text-white shadow-lg cursor-pointer ${toast.type === "ok" ? "bg-green-600" : "bg-red-600"}`} onClick={() => setToast(null)}>
          {toast.msg}
        </div>
      )}

      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-10 bg-white border-b px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground cursor-pointer hover:text-foreground" onClick={() => navigate("/")}>🏠</span>
            <span className="text-muted-foreground">/</span>
            <span className="text-muted-foreground cursor-pointer hover:text-foreground" onClick={() => navigate("/healthcare")}>Diagnostics</span>
            <span className="text-muted-foreground">/</span>
            <span className="text-muted-foreground cursor-pointer hover:text-foreground" onClick={() => navigate("/healthcare/observations")}>Observation</span>
            <span className="text-muted-foreground">/</span>
            <span className="font-semibold">{isNew ? "New Observation" : (templateName || `Observation #${id}`)}</span>
            {!isNew && <span className="text-xs px-2 py-0.5 rounded font-medium bg-green-100 text-green-700">Saved</span>}
            {isNew && <span className="text-xs px-2 py-0.5 rounded font-medium bg-orange-100 text-orange-700">Not Saved</span>}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {!isNew && (
              <>
                {form.status !== "Final" && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSetStatus("Preliminary")}
                      className="text-blue-600 border-blue-200 hover:bg-blue-50"
                    >
                      Preliminary
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSetStatus("Final")}
                      className="text-purple-600 border-purple-200 hover:bg-purple-50"
                    >
                      Final
                    </Button>
                  </>
                )}
                {form.status !== "Final" && form.status !== "Cancelled" && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleApprove}
                      className="bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100"
                    >
                      <Icon icon="solar:check-circle-bold" size={14} className="mr-1" /> Approve
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setRejectDialogOpen(true)}
                      className="text-rose-600 hover:bg-rose-50"
                    >
                      Reject
                    </Button>
                  </>
                )}
                <Button variant="outline" size="sm" onClick={() => navigate(`/healthcare/observations/${Math.max(1, Number(id) - 1)}`)}>
                  <Icon icon="solar:alt-arrow-left-bold" size={16} />
                </Button>
                <Button variant="outline" size="sm" onClick={() => navigate(`/healthcare/observations/${Number(id) + 1}`)}>
                  <Icon icon="solar:alt-arrow-right-bold" size={16} />
                </Button>
                <Button variant="ghost" size="sm" onClick={handleDelete} className="text-red-600">
                  <Icon icon="solar:trash-bin-trash-bold" size={16} />
                </Button>
              </>
            )}
            <Button onClick={handleSave} disabled={saving || !canSave} className="bg-blue-600 hover:bg-blue-700">
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </div>

      <div className="flex">
        {/* ── Main Content ──────────────────────────────────────────── */}
        <div className="flex-1 p-6 max-w-5xl">
          {/* Tabs */}
          <div className="flex gap-0 border-b mb-6">
            {tabs.map((t) => (
              <button key={t.key} className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${activeTab === t.key ? "border-blue-600 text-blue-600" : "border-transparent text-muted-foreground hover:text-foreground"}`} onClick={() => setActiveTab(t.key)}>
                {t.label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : (
            <>
              {/* ════════════════════════════════════════════════════════ */}
              {/* TAB: Details */}
              {/* ════════════════════════════════════════════════════════ */}
              {activeTab === "details" && (
                <div className="space-y-0">
                  {/* Row 1: Naming, Company */}
                  <div className="grid grid-cols-2 gap-x-8 gap-y-4 py-4 border-b">
                    <Field label="Naming Series">
                      <select className="w-full border rounded-md px-3 py-2 text-sm mt-1 bg-gray-50" value={form.naming_series} onChange={(e) => setForm({ ...form, naming_series: e.target.value })}>
                        <option value="HLC-OBS-.YYYY.-">HLC-OBS-.YYYY.-</option>
                      </select>
                    </Field>
                    <Field label="Company" required>
                      <Input value="EEU (Demo)" readOnly className="mt-1 bg-gray-50" />
                    </Field>
                  </div>

                  {/* Row 2: Template, Posting Date */}
                  <div className="grid grid-cols-2 gap-x-8 gap-y-4 py-4 border-b">
                    <Field label="Observation Template" required>
                      <select
                        className="w-full border rounded-md px-3 py-2 text-sm mt-1 font-medium"
                        value={form.observation_template || ""}
                        onChange={(e) => handleTemplateSelect(e.target.value ? Number(e.target.value) : null)}
                      >
                        <option value="">Select Template</option>
                        {templates.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.observation} {t.permitted_unit ? `(${t.permitted_unit})` : ""}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Posting Date">
                      <Input type="date" value={form.posting_date} onChange={(e) => setForm({ ...form, posting_date: e.target.value })} className="mt-1" />
                    </Field>
                  </div>

                  {/* Row 3: Category, Status */}
                  <div className="grid grid-cols-2 gap-x-8 gap-y-4 py-4 border-b">
                    <Field label="Observation Category" required>
                      <select className="w-full border rounded-md px-3 py-2 text-sm mt-1" value={form.observation_category} onChange={(e) => setForm({ ...form, observation_category: e.target.value })}>
                        <option value="">Select Category</option>
                        {["Vital Signs", "Lab", "Imaging", "Survey", "Exam", "Procedure", "Device", "Laboratory", "Activity", "Assessment", "Social History"].map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </Field>
                    <Field label="Status">
                      <select className="w-full border rounded-md px-3 py-2 text-sm mt-1" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                        {["Registered", "Preliminary", "Final", "Amended", "Submitted", "Draft", "Cancelled"].map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </Field>
                  </div>

                  {/* Row 4: Appointment, Medical Department */}
                  <div className="grid grid-cols-2 gap-x-8 gap-y-4 py-4 border-b">
                    <Field label="Appointment">
                      <Input readOnly className="mt-1 bg-gray-50" placeholder="Link appointment" />
                    </Field>
                    <Field label="Medical Department">
                      <select className="w-full border rounded-md px-3 py-2 text-sm mt-1" value={form.medical_department || ""} onChange={(e) => setForm({ ...form, medical_department: e.target.value ? Number(e.target.value) : null })}>
                        <option value="">Select</option>
                        {departments.map((d) => <option key={d.id} value={d.id}>{d.department}</option>)}
                      </select>
                    </Field>
                  </div>

                  {/* ── Patient Section ──────────────────────────────── */}
                  <div className="grid grid-cols-2 gap-x-8 gap-y-4 py-4 border-b">
                    <Field label="Patient" required>
                      <select className="w-full border rounded-md px-3 py-2 text-sm mt-1" value={form.patient || ""} onChange={(e) => setForm({ ...form, patient: e.target.value ? Number(e.target.value) : null })}>
                        <option value="">Select Patient</option>
                        {patients.map((p) => <option key={p.id} value={p.id}>{p.patient_name}</option>)}
                      </select>
                    </Field>
                    <Field label="Gender">
                      <Input value={patientGender} readOnly className="mt-1 bg-gray-50" />
                    </Field>
                  </div>

                  <div className="grid grid-cols-2 gap-x-8 gap-y-4 py-4 border-b">
                    <Field label="Patient Name">
                      <Input value={patientName} readOnly className="mt-1 bg-gray-50" />
                    </Field>
                    <div />
                  </div>

                  {/* ── Practitioner ────────────────────────────────── */}
                  <div className="grid grid-cols-2 gap-x-8 gap-y-4 py-4 border-b">
                    <Field label="Healthcare Practitioner">
                      <select className="w-full border rounded-md px-3 py-2 text-sm mt-1" value={form.practitioner || ""} onChange={(e) => setForm({ ...form, practitioner: e.target.value ? Number(e.target.value) : null })}>
                        <option value="">Select Practitioner</option>
                        {practitioners.map((p) => <option key={p.id} value={p.id}>{p.practitioner_name}</option>)}
                      </select>
                    </Field>
                    <div />
                  </div>

                  {/* ── Template Details (Collapsible) ──────────────── */}
                  <div className="py-4 border-b">
                    <button className="flex items-center gap-2 text-sm font-semibold" onClick={() => setTemplateDetailsOpen(!templateDetailsOpen)}>
                      Template Details
                      <Icon icon={templateDetailsOpen ? "solar:arrow-down-bold" : "solar:alt-arrow-right-bold"} size={14} />
                    </button>
                    {templateDetailsOpen && (
                      <div className="grid grid-cols-2 gap-x-8 gap-y-4 mt-4">
                        <div className="flex items-center gap-2">
                          <input type="checkbox" checked={form.has_component} onChange={(e) => setForm({ ...form, has_component: e.target.checked })} className="rounded" />
                          <Label className="text-sm">Has Component</Label>
                        </div>
                        <Field label="Sample">
                          <Input value={form.sample} onChange={(e) => setForm({ ...form, sample: e.target.value })} className="mt-1" />
                        </Field>
                        <div className="flex items-center gap-2">
                          <input type="checkbox" checked={form.sample_collection_required} onChange={(e) => setForm({ ...form, sample_collection_required: e.target.checked })} className="rounded" />
                          <Label className="text-sm">Sample Collection Required</Label>
                        </div>
                        <Field label="Permitted Data Type">
                          <Input value={form.permitted_data_type} onChange={(e) => setForm({ ...form, permitted_data_type: e.target.value })} className="mt-1" />
                        </Field>
                      </div>
                    )}
                  </div>

                  {/* ── Sample Details ──────────────────────────────── */}
                  <div className="py-4 border-b">
                    <h3 className="text-sm font-semibold mb-4">Sample Details</h3>
                    <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                      <div>
                        <Field label="Sample Collection Time">
                          <Input type="datetime-local" value={form.sample_collection_time} onChange={(e) => setForm({ ...form, sample_collection_time: e.target.value })} className="mt-1" />
                        </Field>
                        <p className="text-xs text-muted-foreground mt-1">Africa/Addis_Ababa</p>
                      </div>
                      <Field label="Sample Status">
                        <select className="w-full border rounded-md px-3 py-2 text-sm mt-1" value={form.sample_status} onChange={(e) => setForm({ ...form, sample_status: e.target.value })}>
                          <option value="">Select</option>
                          {["Collected", "In Lab", "Received", "Discarded", "Under Process", "Completed"].map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </Field>
                    </div>
                  </div>

                  {/* ── Dynamic Result Input & Reference Ranges ──────────────────────── */}
                  <div className="py-4 border-b space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold">Observation Result</h3>
                      {form.permitted_data_type && (
                        <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground font-mono">
                          Type: {form.permitted_data_type} {selectedTemplateObj?.permitted_unit ? `(${selectedTemplateObj.permitted_unit})` : ""}
                        </span>
                      )}
                    </div>

                    <div className="max-w-xl space-y-3">
                      {/* Quantity (Numeric) */}
                      {(!form.permitted_data_type || form.permitted_data_type === "Quantity") && (
                        <div>
                          <Label className="text-xs text-muted-foreground">
                            Numerical Value {selectedTemplateObj?.permitted_unit ? `in ${selectedTemplateObj.permitted_unit}` : ""}
                          </Label>
                          <div className="flex items-center gap-3 mt-1">
                            <Input
                              type="number"
                              step="any"
                              placeholder="e.g. 120"
                              value={form.result}
                              onChange={(e) => setForm({ ...form, result: e.target.value })}
                              className="font-mono text-base"
                            />
                            {selectedTemplateObj?.permitted_unit && (
                              <span className="text-sm font-semibold text-muted-foreground bg-muted px-3 py-1.5 rounded-md border whitespace-nowrap">
                                {selectedTemplateObj.permitted_unit}
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Select (Options) */}
                      {form.permitted_data_type === "Select" && (
                        <div>
                          <Label className="text-xs text-muted-foreground">Select Finding / Grade</Label>
                          <select
                            value={form.result}
                            onChange={(e) => setForm({ ...form, result: e.target.value })}
                            className="w-full h-10 px-3 rounded-md border text-sm bg-background mt-1 font-medium"
                          >
                            <option value="">Select Result Value...</option>
                            <option value="Normal">Normal</option>
                            <option value="Negative">Negative</option>
                            <option value="Positive">Positive</option>
                            <option value="Trace">Trace</option>
                            <option value="1+">1+ (Mild)</option>
                            <option value="2+">2+ (Moderate)</option>
                            <option value="3+">3+ (Marked)</option>
                            <option value="4+">4+ (Severe)</option>
                            <option value="Equivocal">Equivocal</option>
                            <option value="Reactive">Reactive</option>
                            <option value="Non-Reactive">Non-Reactive</option>
                          </select>
                        </div>
                      )}

                      {/* Boolean */}
                      {form.permitted_data_type === "Boolean" && (
                        <div>
                          <Label className="text-xs text-muted-foreground block mb-2">Binary Observation</Label>
                          <div className="flex items-center gap-6">
                            <label className="flex items-center gap-2 cursor-pointer font-medium text-sm">
                              <input
                                type="radio"
                                name="boolResult"
                                checked={form.result === "Positive" || form.result === "true" || form.result === "Yes"}
                                onChange={() => setForm({ ...form, result: "Positive" })}
                                className="w-4 h-4 text-emerald-600"
                              />
                              Positive / Present
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer font-medium text-sm">
                              <input
                                type="radio"
                                name="boolResult"
                                checked={form.result === "Negative" || form.result === "false" || form.result === "No"}
                                onChange={() => setForm({ ...form, result: "Negative" })}
                                className="w-4 h-4 text-emerald-600"
                              />
                              Negative / Absent
                            </label>
                          </div>
                        </div>
                      )}

                      {/* Text */}
                      {form.permitted_data_type === "Text" && (
                        <div>
                          <Label className="text-xs text-muted-foreground">Descriptive Findings</Label>
                          <textarea
                            rows={3}
                            placeholder="Enter detailed laboratory or clinical observation findings..."
                            value={form.result}
                            onChange={(e) => setForm({ ...form, result: e.target.value })}
                            className="w-full p-2.5 rounded-md border text-sm bg-background mt-1"
                          />
                        </div>
                      )}

                      {/* Clinical Evaluation Badge */}
                      {computeInterpretation() && (
                        <div className={`flex items-center gap-2 px-3 py-2 rounded-md border text-sm font-semibold ${computeInterpretation()?.badgeClass}`}>
                          <Icon icon={computeInterpretation()?.icon as any} size={18} />
                          <span>Evaluation: {computeInterpretation()?.text}</span>
                        </div>
                      )}
                    </div>

                    {/* Reference Ranges Summary Table */}
                    {referenceRanges.length > 0 && (
                      <div className="mt-4 pt-3 border-t">
                        <Label className="text-xs font-semibold text-muted-foreground block mb-2">
                          Standard Clinical Reference Ranges ({selectedTemplateObj?.observation || templateName})
                        </Label>
                        <div className="overflow-x-auto border rounded-md">
                          <table className="w-full text-xs text-left">
                            <thead className="bg-muted/50 border-b text-muted-foreground">
                              <tr>
                                <th className="p-2">Applies To</th>
                                <th className="p-2">Age</th>
                                <th className="p-2">Normal Range</th>
                                <th className="p-2">Abnormal Range</th>
                                <th className="p-2">Interpretation</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y">
                              {referenceRanges.map((r) => (
                                <tr key={r.id} className="hover:bg-muted/20">
                                  <td className="p-2 font-medium">{r.applies_to || "All"}</td>
                                  <td className="p-2">{r.age_from ?? 0} - {r.age_to ?? 120} yrs</td>
                                  <td className="p-2 font-semibold text-emerald-600 dark:text-emerald-400">
                                    {r.normal_from || "—"} {r.normal_to ? `to ${r.normal_to}` : ""} {selectedTemplateObj?.permitted_unit}
                                  </td>
                                  <td className="p-2 text-rose-600 dark:text-rose-400 font-mono">
                                    {r.abnormal_from ? `< ${r.abnormal_from}` : ""}
                                    {r.abnormal_from && r.abnormal_to ? " or " : ""}
                                    {r.abnormal_to ? `> ${r.abnormal_to}` : ""}
                                  </td>
                                  <td className="p-2 text-muted-foreground">{r.short_interpretation || "—"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* ── Note (Rich Text) ────────────────────────────── */}
                  <div className="py-4 border-b">
                    <h3 className="text-sm font-semibold mb-2">Note</h3>
                    <div className="border rounded-md overflow-hidden">
                      <div className="flex items-center gap-1 px-3 py-1.5 border-b bg-muted/30 text-xs flex-wrap">
                        <select className="border rounded px-1 py-0.5 text-xs"><option>Normal</option></select>
                        <Separator orientation="vertical" className="h-4 mx-1" />
                        <button className="px-1.5 py-0.5 hover:bg-muted rounded font-bold">B</button>
                        <button className="px-1.5 py-0.5 hover:bg-muted rounded italic">I</button>
                        <button className="px-1.5 py-0.5 hover:bg-muted rounded underline">U</button>
                        <Separator orientation="vertical" className="h-4 mx-1" />
                        <button className="px-1.5 py-0.5 hover:bg-muted rounded text-purple-600 font-bold">A</button>
                        <button className="px-1.5 py-0.5 hover:bg-muted rounded">🔗</button>
                        <button className="px-1.5 py-0.5 hover:bg-muted rounded">📷</button>
                        <Separator orientation="vertical" className="h-4 mx-1" />
                        <button className="px-1.5 py-0.5 hover:bg-muted rounded">"</button>
                        <button className="px-1.5 py-0.5 hover:bg-muted rounded font-mono">&lt;/&gt;</button>
                        <button className="px-1.5 py-0.5 hover:bg-muted rounded">🎧</button>
                        <Separator orientation="vertical" className="h-4 mx-1" />
                        <button className="px-1.5 py-0.5 hover:bg-muted rounded">🔗</button>
                        <button className="px-1.5 py-0.5 hover:bg-muted rounded">📷</button>
                        <Separator orientation="vertical" className="h-4 mx-1" />
                        <button className="px-1.5 py-0.5 hover:bg-muted rounded">≡</button>
                        <button className="px-1.5 py-0.5 hover:bg-muted rounded">☰</button>
                        <button className="px-1.5 py-0.5 hover:bg-muted rounded">⊞</button>
                        <Separator orientation="vertical" className="h-4 mx-1" />
                        <button className="px-1.5 py-0.5 hover:bg-muted rounded">⊞</button>
                        <button className="px-1.5 py-0.5 hover:bg-muted rounded">⊞</button>
                        <Separator orientation="vertical" className="h-4 mx-1" />
                        <button className="px-1.5 py-0.5 hover:bg-muted rounded">⊞</button>
                        <button className="px-1.5 py-0.5 hover:bg-muted rounded">⊞</button>
                      </div>
                      <div className="flex items-center gap-1 px-3 py-1 border-b bg-muted/20">
                        <select className="border rounded px-1 py-0.5 text-xs"><option>Table</option></select>
                      </div>
                      <textarea
                        className="w-full px-3 py-2 text-sm min-h-[200px] border-0 focus:outline-none resize-none"
                        placeholder="Type your notes here..."
                        value={form.notes}
                        onChange={(e) => setForm({ ...form, notes: e.target.value })}
                      />
                    </div>
                  </div>

                  {/* ── Description (Collapsible) ──────────────────── */}
                  <div className="py-4 border-b">
                    <button className="flex items-center gap-2 text-sm font-semibold" onClick={() => setDescriptionOpen(!descriptionOpen)}>
                      Description
                      <Icon icon={descriptionOpen ? "solar:arrow-down-bold" : "solar:alt-arrow-right-bold"} size={14} />
                    </button>
                    {descriptionOpen && (
                      <textarea className="w-full border rounded-md px-3 py-2 text-sm min-h-[120px] mt-4" placeholder="Additional description..." value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                    )}
                  </div>

                  {/* ── Comments ────────────────────────────────────── */}
                  <div className="py-4 border-b">
                    <h3 className="text-sm font-semibold mb-3">Comments</h3>
                    <div className="flex items-start gap-3">
                      <Avatar initials="RG" tone="green" />
                      <input
                        className="flex-1 border rounded-md px-3 py-2 text-sm"
                        placeholder="Type a reply / comment"
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") handleAddComment(); }}
                      />
                    </div>
                    {comments.length > 0 && (
                      <div className="mt-4 space-y-3 ml-11">
                        {comments.map((c) => (
                          <div key={c.id} className="bg-muted/30 rounded-md p-3">
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                              <span className="font-medium text-foreground">{c.author}</span>
                              <span>·</span>
                              <span>{c.time}</span>
                            </div>
                            <p className="text-sm">{c.content}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* ── Activity ────────────────────────────────────── */}
                  <div className="py-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold">Activity</h3>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="text-xs">
                          <Icon icon="solar:letter-bold" size={14} className="mr-1" /> New Email
                        </Button>
                        <Button variant="outline" size="sm" className="text-xs">
                          <Icon icon="solar:calendar-bold" size={14} className="mr-1" /> New Event
                        </Button>
                      </div>
                    </div>
                    <div className="relative ml-4">
                      <div className="absolute left-0 top-0 bottom-0 w-px bg-border" />
                      <div className="space-y-4">
                        {activity.map((a, i) => (
                          <div key={i} className="relative pl-6">
                            <div className="absolute left-0 top-1.5 w-2 h-2 rounded-full bg-blue-500 -translate-x-[3.5px]" />
                            <p className="text-sm">{a.action} · {a.time}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ════════════════════════════════════════════════════════ */}
              {/* TAB: Medical Coding */}
              {/* ════════════════════════════════════════════════════════ */}
              {activeTab === "medical_coding" && (
                <div className="space-y-6">
                  <h3 className="text-sm font-semibold">Medical Codes</h3>
                  <div className="border rounded-md overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="text-left px-3 py-2 font-medium text-muted-foreground w-8">
                            <input type="checkbox" className="rounded" />
                          </th>
                          <th className="text-left px-3 py-2 font-medium text-muted-foreground w-10">No.</th>
                          <th className="text-left px-3 py-2 font-medium text-muted-foreground">Code System <span className="text-red-500">*</span></th>
                          <th className="text-left px-3 py-2 font-medium text-muted-foreground">Code Value <span className="text-red-500">*</span></th>
                          <th className="text-left px-3 py-2 font-medium text-muted-foreground">Code <span className="text-red-500">*</span></th>
                          <th className="text-left px-3 py-2 font-medium text-muted-foreground">Display</th>
                          <th className="text-left px-3 py-2 font-medium text-muted-foreground">Definition</th>
                          <th className="w-8 px-3 py-2" />
                        </tr>
                      </thead>
                      <tbody>
                        {medicalCodes.length === 0 ? (
                          <tr><td colSpan={8} className="text-center py-6 text-muted-foreground">No rows</td></tr>
                        ) : medicalCodes.map((c, i) => (
                          <tr key={i} className="border-t">
                            <td className="px-3 py-1.5"><input type="checkbox" className="rounded" /></td>
                            <td className="px-3 py-1.5 text-muted-foreground">{i + 1}</td>
                            <td className="px-3 py-1.5"><Input value={c.code_system} onChange={(e) => { const n = [...medicalCodes]; n[i].code_system = e.target.value; setMedicalCodes(n); }} className="h-8 text-xs" /></td>
                            <td className="px-3 py-1.5"><Input value={c.code_value} onChange={(e) => { const n = [...medicalCodes]; n[i].code_value = e.target.value; setMedicalCodes(n); }} className="h-8 text-xs" /></td>
                            <td className="px-3 py-1.5"><Input value={c.code} onChange={(e) => { const n = [...medicalCodes]; n[i].code = e.target.value; setMedicalCodes(n); }} className="h-8 text-xs" /></td>
                            <td className="px-3 py-1.5"><Input value={c.display} onChange={(e) => { const n = [...medicalCodes]; n[i].display = e.target.value; setMedicalCodes(n); }} className="h-8 text-xs" /></td>
                            <td className="px-3 py-1.5"><Input value={c.definition} onChange={(e) => { const n = [...medicalCodes]; n[i].definition = e.target.value; setMedicalCodes(n); }} className="h-8 text-xs" /></td>
                            <td className="px-3 py-1.5"><Button variant="ghost" size="sm" onClick={() => setMedicalCodes(medicalCodes.filter((_, j) => j !== i))}><Icon icon="solar:close-circle-bold" size={14} className="text-red-500" /></Button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <Button variant="outline" size="sm" className="text-xs" onClick={() => setMedicalCodes([...medicalCodes, { code_system: "", code_value: "", code: "", display: "", definition: "" }])}>
                    <Icon icon="solar:add-circle-bold" size={14} className="mr-1" /> Add row
                  </Button>
                </div>
              )}

              {/* ════════════════════════════════════════════════════════ */}
              {/* TAB: More Information */}
              {/* ════════════════════════════════════════════════════════ */}
              {activeTab === "more_information" && (
                <div className="space-y-6">
                  <Field label="Reference DocType">
                    <Input readOnly className="mt-1 bg-gray-50" placeholder="e.g. Patient Encounter" />
                  </Field>
                  <Field label="Reference DocName">
                    <Input readOnly className="mt-1 bg-gray-50" placeholder="Document name" />
                  </Field>
                  <Separator />
                  <Field label="Description">
                    <textarea className="w-full border rounded-md px-3 py-2 text-sm min-h-[120px]" placeholder="Additional description..." value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                  </Field>
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Right Sidebar ──────────────────────────────────────────── */}
        <DocumentSidebar
          doctype="Observation"
          docname={id || "new"}
          displayName={patientName || "New Observation"}
          initials={initials}
          subtitle={templateName || ""}
          avatarColor="bg-purple-100 text-purple-700"
          createdAt={observationMeta.creation}
          modifiedAt={observationMeta.modified}
          createdBy={observationMeta.owner}
          modifiedBy={observationMeta.modified_by}
        />
      </div>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reject Observation Result</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Provide the clinical or laboratory reason for rejecting this observation result.
            </p>
            <textarea
              rows={3}
              placeholder="e.g. Specimen hemolyzed, result outside plausible bounds, please recollect..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="w-full p-2.5 rounded-md border text-sm bg-background"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleReject} className="bg-rose-600 hover:bg-rose-700 text-white">
              Confirm Rejection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
