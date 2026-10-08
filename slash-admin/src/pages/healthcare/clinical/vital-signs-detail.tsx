import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router";
import { Icon } from "@/components/icon";
import { Button } from "@/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { Badge } from "@/ui/badge";
import { Separator } from "@/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/ui/dialog";
import { HealthcareApi } from "@/api/services/healthcareService";
import EntitySelect from "@/components/healthcare/EntitySelect";
import Avatar from "@/components/Avatar";
import { getInitials } from "@/utils";
import type { Patient, MedicalDepartment, VitalSigns as VitalSignsType } from "@/api/services/healthcareService";
import { useDoctypePermissions } from "@/utils/permissions";
import eeuLogoImg from "@/assets/images/eeu-logo.png";

// ── AHA Blood Pressure Category Evaluator ─────────────────────────────
function evaluateBp(sys: number | null, dia: number | null) {
  if (!sys || !dia) return { label: "Not Recorded", stage: 0, color: "bg-gray-100 text-gray-700", badge: "secondary" as const, desc: "Awaiting measurement" };
  if (sys >= 180 || dia >= 120) {
    return {
      label: "Hypertensive Crisis",
      stage: 5,
      color: "bg-red-600 text-white animate-pulse",
      badge: "destructive" as const,
      desc: "Emergency medical intervention required. Notify attending doctor immediately.",
    };
  }
  if (sys >= 140 || dia >= 90) {
    return {
      label: "Stage 2 Hypertension",
      stage: 4,
      color: "bg-red-100 text-red-800 border-red-300 font-semibold",
      badge: "destructive" as const,
      desc: "Elevated vascular resistance. Requires medical evaluation and pharmacotherapy review.",
    };
  }
  if (sys >= 130 || dia >= 80) {
    return {
      label: "Stage 1 Hypertension",
      stage: 3,
      color: "bg-amber-100 text-amber-900 border-amber-300",
      badge: "outline" as const,
      desc: "Mild vascular elevation. Advise DASH dietary lifestyle counseling and periodic BP checks.",
    };
  }
  if (sys >= 120 && dia < 80) {
    return {
      label: "Elevated Blood Pressure",
      stage: 2,
      color: "bg-yellow-100 text-yellow-900 border-yellow-300",
      badge: "outline" as const,
      desc: "Pre-hypertensive state. Recommend sodium restriction and exercise.",
    };
  }
  return {
    label: "Normal Blood Pressure",
    stage: 1,
    color: "bg-emerald-100 text-emerald-800 border-emerald-300 font-medium",
    badge: "secondary" as const,
    desc: "Optimal resting cardiovascular pressure.",
  };
}

export default function VitalSignsDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { canCreate, canWrite } = useDoctypePermissions("Vital Signs");
  const canSave = id ? canWrite : canCreate;
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const patientParam = searchParams.get("patient");
  const isNew = !id || id === "new";

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [departments, setDepartments] = useState<MedicalDepartment[]>([]);
  const [patientHistory, setPatientHistory] = useState<VitalSignsType[]>([]);
  const [showPrintSlip, setShowPrintSlip] = useState(false);
  const [tempUnit, setTempUnit] = useState<"F" | "C">("F");
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" } | null>(null);

  const [form, setForm] = useState({
    naming_series: "HLC-VTS-.YYYY.-",
    patient: null as number | null,
    department: null as number | null,
    appointment: null as number | null,
    encounter: null as number | null,
    company: null as number | null,
    signs_date: new Date().toISOString().split("T")[0],
    signs_time: new Date().toTimeString().slice(0, 5),
    temperature: "",
    pulse: "",
    respiratory_rate: "",
    tongue: "Normal",
    abdomen: "Normal",
    reflexes: "Normal",
    bp_systolic: "",
    bp_diastolic: "",
    vital_signs_note: "",
    height: "",
    weight: "",
    nutrition_note: "",
  });

  const [patientName, setPatientName] = useState("");

  // ── Biometric & Hemodynamic Computations ───────────────────────────
  const sysNum = form.bp_systolic ? parseFloat(form.bp_systolic) : null;
  const diaNum = form.bp_diastolic ? parseFloat(form.bp_diastolic) : null;

  const bpCat = useMemo(() => evaluateBp(sysNum, diaNum), [sysNum, diaNum]);

  // Mean Arterial Pressure (MAP) = (2 * DBP + SBP) / 3
  const meanArterialPressure = useMemo(() => {
    if (sysNum && diaNum) {
      return Math.round((2 * diaNum + sysNum) / 3);
    }
    return null;
  }, [sysNum, diaNum]);

  // Pulse Pressure = SBP - DBP
  const pulsePressure = useMemo(() => {
    if (sysNum && diaNum) {
      return Math.round(sysNum - diaNum);
    }
    return null;
  }, [sysNum, diaNum]);

  // BMI Calculation
  const computedBmi = useMemo(() => {
    const h = parseFloat(form.height);
    const w = parseFloat(form.weight);
    if (h > 0 && w > 0) {
      const hm = h / 100;
      return (w / (hm * hm)).toFixed(2);
    }
    return "";
  }, [form.height, form.weight]);

  const computedNutrition = useMemo(() => {
    if (!computedBmi) return "";
    const bmi = parseFloat(computedBmi);
    if (bmi < 18.5) return "Underweight";
    if (bmi < 25) return "Normal Weight";
    if (bmi < 30) return "Overweight";
    return "Obese (Class I+)";
  }, [computedBmi]);

  // Temperature Conversions
  const tempF = form.temperature ? parseFloat(form.temperature) : null;
  const tempC = tempF ? ((tempF - 32) * 5) / 9 : null;

  // Ideal Body Weight (Devine formula approximation)
  const idealBodyWeight = useMemo(() => {
    const h = parseFloat(form.height);
    if (h > 152.4) {
      const inchesOver5Ft = (h - 152.4) / 2.54;
      return (50 + 2.3 * inchesOver5Ft).toFixed(1);
    }
    return null;
  }, [form.height]);

  // Overall Triage Urgency Level
  const triageUrgency = useMemo(() => {
    if (bpCat.stage === 5 || (tempF && tempF >= 102.2) || (form.pulse && (Number(form.pulse) > 125 || Number(form.pulse) < 45))) {
      return {
        level: "Red (Immediate / Crisis)",
        color: "bg-red-600 text-white border-red-700",
        message: "Hemodynamic parameters require immediate clinical evaluation. Notify doctor prior to patient leaving triage.",
      };
    }
    if (bpCat.stage >= 3 || (tempF && tempF >= 100.4) || (form.pulse && (Number(form.pulse) > 100 || Number(form.pulse) < 55))) {
      return {
        level: "Yellow (Urgent / Review)",
        color: "bg-amber-100 text-amber-900 border-amber-300",
        message: "Elevated vital signs detected. Patient should be reviewed by consulting physician before discharge.",
      };
    }
    return {
      level: "Green (Stable / Routine)",
      color: "bg-emerald-100 text-emerald-800 border-emerald-300",
      message: "All vital signs fall within standard physiological reference ranges.",
    };
  }, [bpCat, tempF, form.pulse]);

  // Load Data
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [patsRes, deptsRes] = await Promise.all([
          HealthcareApi.patients.list({ page_size: 200 }),
          HealthcareApi.departments.list({ page_size: 200 }),
        ]);
        setPatients(patsRes.results || []);
        setDepartments(deptsRes.results || []);

        if (id && id !== "new") {
          const res = await HealthcareApi.vitalSigns.get(Number(id));
          setForm({
            naming_series: res.naming_series || "HLC-VTS-.YYYY.-",
            patient: res.patient,
            department: (res as any).department ?? null,
            appointment: res.appointment,
            encounter: res.encounter,
            company: res.company,
            signs_date: res.signs_date,
            signs_time: res.signs_time || "",
            temperature: res.temperature?.toString() || "",
            pulse: res.pulse?.toString() || "",
            respiratory_rate: res.respiratory_rate?.toString() || "",
            tongue: res.tongue || "Normal",
            abdomen: res.abdomen || "Normal",
            reflexes: res.reflexes || "Normal",
            bp_systolic: res.bp_systolic?.toString() || "",
            bp_diastolic: res.bp_diastolic?.toString() || "",
            vital_signs_note: res.vital_signs_note || "",
            height: res.height?.toString() || "",
            weight: res.weight?.toString() || "",
            nutrition_note: res.nutrition_note || "",
          });
          setPatientName(res.patient_name || "");

          // Load patient historical trends
          if (res.patient) {
            HealthcareApi.vitalSigns.list({ patient: res.patient, page_size: 5 })
              .then((historyRes) => setPatientHistory(historyRes.results || []))
              .catch(() => {});
          }
        }
      } catch (err) {
        console.error(err);
        setToast({ msg: "Failed to load vital signs record", type: "err" });
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [id]);

  // Auto-populate patient from URL params
  useEffect(() => {
    if (isNew && patientParam) {
      const pid = Number(patientParam);
      setForm((prev) => ({ ...prev, patient: pid }));
      HealthcareApi.patients.get(pid)
        .then((p: any) => {
          setPatientName(p.patient_name || `${p.first_name} ${p.last_name}`.trim());
          HealthcareApi.vitalSigns.list({ patient: pid, page_size: 5 })
            .then((historyRes) => setPatientHistory(historyRes.results || []))
            .catch(() => {});
        })
        .catch(() => {});
    }
  }, [isNew, patientParam]);

  // Update patient name when selecting patient
  useEffect(() => {
    if (form.patient && patients.length > 0) {
      const p = patients.find((pt) => pt.id === form.patient);
      if (p) {
        setPatientName(p.patient_name);
        HealthcareApi.vitalSigns.list({ patient: form.patient, page_size: 5 })
          .then((historyRes) => setPatientHistory(historyRes.results || []))
          .catch(() => {});
      }
    }
  }, [form.patient, patients]);

  // Save Record
  const handleSave = async (andStartEncounter = false) => {
    if (!form.patient) {
      setToast({ msg: "Patient selection is required", type: "err" });
      return;
    }
    setSaving(true);
    try {
      const payload: any = { ...form };
      ["temperature", "pulse", "respiratory_rate", "bp_systolic", "bp_diastolic", "height", "weight"].forEach((k) => {
        payload[k] = payload[k] ? Number(payload[k]) : null;
      });

      let savedRecord: any = null;
      if (isNew) {
        savedRecord = await HealthcareApi.vitalSigns.create(payload);
        setToast({ msg: "Vital Signs recorded successfully", type: "ok" });
      } else {
        savedRecord = await HealthcareApi.vitalSigns.update(Number(id), payload);
        setToast({ msg: "Vital Signs updated successfully", type: "ok" });
      }

      if (andStartEncounter && form.patient) {
        navigate(`/healthcare/encounters/new?patient=${form.patient}&vital_signs=${savedRecord?.id || id}`);
      } else if (isNew) {
        navigate(`/healthcare/vital-signs/${savedRecord?.id}`);
      }
    } catch (err: any) {
      const errDetail = err?.response?.data
        ? typeof err.response.data === "object"
          ? Object.entries(err.response.data)
              .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`)
              .join("; ")
          : String(err.response.data)
        : err?.message || "Failed to save vital signs";
      setToast({ msg: errDetail, type: "err" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!id || !confirm("Are you sure you want to permanently delete this Vital Signs record?")) return;
    try {
      await HealthcareApi.vitalSigns.delete(Number(id));
      navigate("/healthcare/vital-signs");
    } catch {
      setToast({ msg: "Failed to delete record", type: "err" });
    }
  };

  const initials = getInitials(patientName || "VS", "VS");
  const selectedPatientObj = patients.find((p) => p.id === form.patient);

  return (
    <div className="space-y-6 pb-12">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-2.5 rounded-xl text-sm font-medium text-white shadow-xl cursor-pointer ${
            toast.type === "ok" ? "bg-emerald-600" : "bg-red-600"
          }`}
          onClick={() => setToast(null)}
        >
          <div className="flex items-center gap-2">
            <Icon icon={toast.type === "ok" ? "solar:check-circle-bold" : "solar:danger-triangle-bold"} size={18} />
            <span>{toast.msg}</span>
          </div>
        </div>
      )}

      {/* ── Top Breadcrumb & Action Bar ────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b pb-3">
        <div className="flex items-center gap-3">
          <nav className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span onClick={() => navigate("/")} className="cursor-pointer hover:underline">Home</span>
            <span>/</span>
            <span onClick={() => navigate("/healthcare")} className="cursor-pointer hover:underline">Healthcare</span>
            <span>/</span>
            <span onClick={() => navigate("/healthcare/vital-signs")} className="cursor-pointer hover:underline">Vital Signs</span>
            <span>/</span>
            <span className="text-foreground font-semibold">
              {isNew ? "Record New Vitals" : patientName || `Record #${id}`}
            </span>
          </nav>
          {!isNew && (
            <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px]">
              Saved Record #{id}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate("/healthcare/vital-signs")} className="text-xs">
            <Icon icon="solar:arrow-left-linear" size={14} className="mr-1" />
            Back to Register
          </Button>

          {!isNew && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowPrintSlip(true)}
                className="text-xs text-slate-700 border-slate-300"
              >
                <Icon icon="solar:printer-bold" size={14} className="mr-1 text-slate-600" />
                Print Vitals Slip
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/healthcare/encounters/new?patient=${form.patient}&vital_signs=${id}`)}
                className="text-xs text-blue-700 border-blue-300 hover:bg-blue-50"
              >
                <Icon icon="solar:stethoscope-bold" size={14} className="mr-1 text-blue-600" />
                Start Consultation (SOAP)
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDelete}
                className="text-red-600 hover:text-red-700 hover:bg-red-50 p-2"
                title="Delete Record"
              >
                <Icon icon="solar:trash-bin-trash-bold" size={16} />
              </Button>
            </>
          )}

          <Button
            onClick={() => handleSave(false)}
            disabled={saving || !canSave}
            className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold"
          >
            <Icon icon="solar:diskette-bold" size={14} className="mr-1" />
            {saving ? "Saving..." : isNew ? "Save Vitals" : "Update Vitals"}
          </Button>
        </div>
      </div>

      {/* ── Clinical Triage Status Banner ──────────────────────────── */}
      <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-xs ${triageUrgency.color}`}>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-white/20 shrink-0">
            <Icon icon="solar:heart-pulse-bold" size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="font-extrabold text-sm uppercase tracking-wider">
                Clinical Triage Evaluation: {triageUrgency.level}
              </span>
            </div>
            <p className="text-xs opacity-90 leading-relaxed max-w-3xl">
              {triageUrgency.message}
            </p>
          </div>
        </div>

        {form.patient && (
          <div className="shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/healthcare/encounters/new?patient=${form.patient}`)}
              className="bg-white/90 text-slate-900 hover:bg-white text-xs font-semibold shadow-xs"
            >
              <Icon icon="solar:notes-bold" size={14} className="mr-1" />
              Transfer to Doctor Consultation
            </Button>
          </div>
        )}
      </div>

      {/* ── Main Two-Column Layout ──────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        {/* Left Column: Form & Clinical Gauges */}
        <div className="space-y-6">
          {/* Patient Header Card */}
          <Card className="border-border/80 shadow-xs">
            <CardContent className="p-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <Label className="text-xs font-semibold text-foreground">Select Patient *</Label>
                  <div className="mt-1">
                    <EntitySelect
                      doctype="Patient"
                      rawItems={patients}
                      options={patients.map((p) => ({
                        value: p.id,
                        label: p.patient_name || `${p.first_name || ""} ${p.last_name || ""}`.trim(),
                        sublabel: p.patient_id,
                        image: p.image,
                      }))}
                      value={form.patient}
                      onChange={(v) => setForm({ ...form, patient: v })}
                      placeholder="Search patient name, badge, or phone..."
                      emptyText="No registered patients found"
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-semibold text-foreground">Medical Department</Label>
                  <select
                    className="w-full border rounded-lg px-3 py-2 text-xs mt-1 bg-background"
                    value={form.department || ""}
                    onChange={(e) => setForm({ ...form, department: e.target.value ? Number(e.target.value) : null })}
                  >
                    <option value="">General Outpatient (OPD)</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.department}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-3 border-t border-border/60">
                <div>
                  <Label className="text-[11px] font-medium text-muted-foreground">Examination Date *</Label>
                  <Input
                    type="date"
                    value={form.signs_date}
                    onChange={(e) => setForm({ ...form, signs_date: e.target.value })}
                    className="mt-1 h-8 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-[11px] font-medium text-muted-foreground">Examination Time *</Label>
                  <Input
                    type="time"
                    value={form.signs_time}
                    onChange={(e) => setForm({ ...form, signs_time: e.target.value })}
                    className="mt-1 h-8 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-[11px] font-medium text-muted-foreground">Series Code</Label>
                  <Input value={form.naming_series} readOnly className="mt-1 h-8 text-xs bg-muted/30 font-mono" />
                </div>
                <div>
                  <Label className="text-[11px] font-medium text-muted-foreground">Clinic ID</Label>
                  <Input value={patientName ? `#${form.patient}` : "—"} readOnly className="mt-1 h-8 text-xs bg-muted/30 font-mono" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ── CARDIOVASCULAR & HEMODYNAMIC GAUGE CARD ───────────────── */}
          <Card className="border-rose-200/80 shadow-xs overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-rose-50 via-slate-50 to-white pb-3 border-b">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-bold flex items-center gap-2 text-rose-950">
                  <Icon icon="solar:heart-pulse-bold" size={18} className="text-rose-600" />
                  Cardiovascular & Hemodynamic Parameters
                </CardTitle>
                {sysNum && diaNum && (
                  <span className={`text-[10px] px-2.5 py-0.5 rounded-full border ${bpCat.color}`}>
                    {bpCat.label}
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              {/* Inputs Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Systolic BP */}
                <div className="p-3.5 rounded-xl border bg-card space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-foreground">Systolic BP</Label>
                    <span className="text-[10px] text-muted-foreground">Target: 90–120</span>
                  </div>
                  <div className="relative">
                    <Input
                      type="number"
                      placeholder="e.g. 120"
                      value={form.bp_systolic}
                      onChange={(e) => setForm({ ...form, bp_systolic: e.target.value })}
                      className="text-lg font-mono font-bold pr-14 h-11"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                      mmHg
                    </span>
                  </div>
                </div>

                {/* Diastolic BP */}
                <div className="p-3.5 rounded-xl border bg-card space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-foreground">Diastolic BP</Label>
                    <span className="text-[10px] text-muted-foreground">Target: 60–80</span>
                  </div>
                  <div className="relative">
                    <Input
                      type="number"
                      placeholder="e.g. 80"
                      value={form.bp_diastolic}
                      onChange={(e) => setForm({ ...form, bp_diastolic: e.target.value })}
                      className="text-lg font-mono font-bold pr-14 h-11"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                      mmHg
                    </span>
                  </div>
                </div>

                {/* Heart Rate / Pulse */}
                <div className="p-3.5 rounded-xl border bg-card space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-foreground">Heart Rate / Pulse</Label>
                    <span className="text-[10px] text-muted-foreground">60–100 bpm</span>
                  </div>
                  <div className="relative">
                    <Input
                      type="number"
                      placeholder="e.g. 72"
                      value={form.pulse}
                      onChange={(e) => setForm({ ...form, pulse: e.target.value })}
                      className="text-lg font-mono font-bold pr-14 h-11"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                      bpm
                    </span>
                  </div>
                </div>
              </div>

              {/* Advanced Hemodynamic Indicators (MAP & Pulse Pressure) */}
              {sysNum && diaNum && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-xl bg-muted/30 border border-border/50 text-xs">
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase font-bold block">
                      Mean Arterial Pressure (MAP)
                    </span>
                    <span className="text-base font-extrabold text-foreground font-mono">
                      {meanArterialPressure} <span className="text-xs font-normal text-muted-foreground">mmHg</span>
                    </span>
                    <span className="text-[10px] text-muted-foreground block mt-0.5">Norm: 70–105 mmHg</span>
                  </div>

                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase font-bold block">
                      Pulse Pressure
                    </span>
                    <span className="text-base font-extrabold text-foreground font-mono">
                      {pulsePressure} <span className="text-xs font-normal text-muted-foreground">mmHg</span>
                    </span>
                    <span className="text-[10px] text-muted-foreground block mt-0.5">Norm: 30–50 mmHg</span>
                  </div>

                  <div className="sm:col-span-2">
                    <span className="text-[10px] text-muted-foreground uppercase font-bold block">
                      Clinical AHA Assessment
                    </span>
                    <p className="text-xs text-foreground font-medium mt-0.5 leading-snug">
                      {bpCat.desc}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── THERMOREGULATION & RESPIRATORY CARD ───────────────────── */}
          <Card className="border-border/80 shadow-xs">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-sm font-bold flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon icon="solar:temperature-bold" size={18} className="text-amber-500" />
                  <span>Thermoregulation & Respiratory Mechanics</span>
                </div>
                <div className="flex items-center gap-1 text-xs">
                  <span className="text-muted-foreground mr-1 text-[11px]">Display Unit:</span>
                  <button
                    type="button"
                    onClick={() => setTempUnit("F")}
                    className={`px-2 py-0.5 rounded text-xs font-bold transition-all ${
                      tempUnit === "F" ? "bg-amber-600 text-white" : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    °F
                  </button>
                  <button
                    type="button"
                    onClick={() => setTempUnit("C")}
                    className={`px-2 py-0.5 rounded text-xs font-bold transition-all ${
                      tempUnit === "C" ? "bg-amber-600 text-white" : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    °C
                  </button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Body Temp */}
                <div className="p-3.5 rounded-xl border bg-card space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-foreground">Body Temperature</Label>
                    <span className="text-[10px] text-muted-foreground">
                      Normal: 97.8°F–99.1°F (36.5°C–37.3°C)
                    </span>
                  </div>
                  <div className="relative">
                    <Input
                      type="number"
                      step="0.1"
                      placeholder="e.g. 98.6"
                      value={form.temperature}
                      onChange={(e) => setForm({ ...form, temperature: e.target.value })}
                      className="text-lg font-mono font-bold pr-20 h-11"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground flex items-center gap-1">
                      <span>°F</span>
                      {tempC && (
                        <span className="text-[11px] font-mono text-amber-800 bg-amber-50 px-1 py-0.5 rounded border border-amber-200">
                          {tempC.toFixed(1)}°C
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Respiratory Rate */}
                <div className="p-3.5 rounded-xl border bg-card space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-foreground">Respiratory Rate</Label>
                    <span className="text-[10px] text-muted-foreground">Normal: 12–20 breaths/min</span>
                  </div>
                  <div className="relative">
                    <Input
                      type="number"
                      placeholder="e.g. 16"
                      value={form.respiratory_rate}
                      onChange={(e) => setForm({ ...form, respiratory_rate: e.target.value })}
                      className="text-lg font-mono font-bold pr-20 h-11"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                      /min
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ── ANTHROPOMETRY & NUTRITION (BMI) ───────────────────────── */}
          <Card className="border-border/80 shadow-xs">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Icon icon="solar:ruler-pencil-bold" size={18} className="text-blue-600" />
                Anthropometry & Nutritional Index
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <Label className="text-xs font-semibold text-foreground">Height (cm)</Label>
                  <Input
                    type="number"
                    step="0.5"
                    placeholder="e.g. 175"
                    value={form.height}
                    onChange={(e) => setForm({ ...form, height: e.target.value })}
                    className="mt-1 h-9 text-xs font-mono"
                  />
                  {form.height && (
                    <span className="text-[10px] text-muted-foreground block mt-0.5">
                      {Math.floor(Number(form.height) / 30.48)} ft {Math.round((Number(form.height) % 30.48) / 2.54)} in
                    </span>
                  )}
                </div>

                <div>
                  <Label className="text-xs font-semibold text-foreground">Weight (kg)</Label>
                  <Input
                    type="number"
                    step="0.5"
                    placeholder="e.g. 74"
                    value={form.weight}
                    onChange={(e) => setForm({ ...form, weight: e.target.value })}
                    className="mt-1 h-9 text-xs font-mono"
                  />
                  {form.weight && (
                    <span className="text-[10px] text-muted-foreground block mt-0.5">
                      {(Number(form.weight) * 2.20462).toFixed(1)} lbs
                    </span>
                  )}
                </div>

                <div>
                  <Label className="text-xs font-semibold text-foreground">Calculated BMI</Label>
                  <Input
                    value={computedBmi ? `${computedBmi} kg/m²` : "—"}
                    readOnly
                    className="mt-1 h-9 text-xs font-mono bg-muted/30 font-bold"
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold text-foreground">Nutritional Status</Label>
                  <Input
                    value={computedNutrition || form.nutrition_note || "—"}
                    readOnly
                    className={`mt-1 h-9 text-xs font-bold bg-muted/30 ${
                      computedNutrition === "Normal Weight" ? "text-emerald-700" :
                      computedNutrition === "Overweight" ? "text-amber-700" :
                      computedNutrition ? "text-rose-700" : ""
                    }`}
                  />
                </div>
              </div>

              {idealBodyWeight && (
                <div className="flex items-center justify-between p-3 rounded-xl bg-blue-50/50 border border-blue-200/60 text-xs">
                  <div className="flex items-center gap-2">
                    <Icon icon="solar:info-circle-bold" size={16} className="text-blue-600" />
                    <span>Estimated Ideal Body Weight (IBW): <strong>{idealBodyWeight} kg</strong></span>
                  </div>
                  <span className="text-[11px] text-muted-foreground">Devine Clinical Formula</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── PHYSICAL EXAMINATION & CLINICAL NOTES ─────────────────── */}
          <Card className="border-border/80 shadow-xs">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Icon icon="solar:clipboard-check-bold" size={18} className="text-emerald-600" />
                Physical Inspection & Triage Observations
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs font-semibold text-foreground">Tongue Inspection</Label>
                  <select
                    className="w-full border rounded-lg px-3 py-2 text-xs mt-1 bg-background"
                    value={form.tongue}
                    onChange={(e) => setForm({ ...form, tongue: e.target.value })}
                  >
                    <option value="Normal">Normal (Pink & Moist)</option>
                    <option value="Coated">Coated (White / Yellow)</option>
                    <option value="Very Coated">Very Coated</option>
                    <option value="Furry">Furry Tongue</option>
                    <option value="Cuts">Aphthous / Cuts / Ulcers</option>
                  </select>
                </div>

                <div>
                  <Label className="text-xs font-semibold text-foreground">Abdomen Examination</Label>
                  <select
                    className="w-full border rounded-lg px-3 py-2 text-xs mt-1 bg-background"
                    value={form.abdomen}
                    onChange={(e) => setForm({ ...form, abdomen: e.target.value })}
                  >
                    <option value="Normal">Normal (Soft & Non-tender)</option>
                    <option value="Bloated">Bloated / Distended</option>
                    <option value="Full">Full</option>
                    <option value="Fluid">Fluid Shifting / Ascites</option>
                    <option value="Constipated">Constipated / Firm</option>
                  </select>
                </div>

                <div>
                  <Label className="text-xs font-semibold text-foreground">Deep Tendon Reflexes</Label>
                  <select
                    className="w-full border rounded-lg px-3 py-2 text-xs mt-1 bg-background"
                    value={form.reflexes}
                    onChange={(e) => setForm({ ...form, reflexes: e.target.value })}
                  >
                    <option value="Normal">Normal (2+ Symmetrical)</option>
                    <option value="Hyper">Hyperreflexic (3+)</option>
                    <option value="Very Hyper">Very Hyperreflexic (4+ Clonus)</option>
                    <option value="One Sided">Asymmetrical / One-Sided</option>
                  </select>
                </div>
              </div>

              <div>
                <Label className="text-xs font-semibold text-foreground">Triage Nurse Clinical Notes</Label>
                <textarea
                  value={form.vital_signs_note}
                  onChange={(e) => setForm({ ...form, vital_signs_note: e.target.value })}
                  placeholder="Document clinical state: pallor, distress, posture, respiratory effort, or patient comments..."
                  className="w-full mt-1 p-3 rounded-xl border border-border text-xs min-h-[70px] focus:outline-none focus:ring-1 focus:ring-rose-500"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Right Sidebar: Patient Profile & Trends ───────────────── */}
        <div className="space-y-4">
          {/* Patient Card */}
          <Card className="border-border/80 shadow-xs text-center">
            <CardContent className="pt-6">
              <Avatar initials={initials} size="xl" tone="red" className="mx-auto shadow-sm" />
              <h3 className="mt-3 font-bold text-sm text-foreground">{patientName || "No Patient Selected"}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {selectedPatientObj?.patient_id ? `EEU ID: ${selectedPatientObj.patient_id}` : "Outpatient Record"}
              </p>

              {form.patient && (
                <div className="mt-4 pt-3 border-t border-border/60 flex flex-col gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/healthcare/patients/${form.patient}`)}
                    className="w-full text-xs justify-start"
                  >
                    <Icon icon="solar:user-circle-bold" size={14} className="mr-1.5 text-rose-600" />
                    Patient 360° Profile
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/healthcare/appointments?patient=${form.patient}`)}
                    className="w-full text-xs justify-start"
                  >
                    <Icon icon="solar:calendar-mark-bold" size={14} className="mr-1.5 text-blue-600" />
                    Appointment History
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Summary Pill Box */}
          <Card className="border-border/80 shadow-xs">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Telemetry Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-2.5 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Date / Time</span>
                <span className="font-semibold text-foreground">{form.signs_date} {form.signs_time}</span>
              </div>
              <Separator />
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Blood Pressure</span>
                <span className="font-mono font-bold text-foreground">
                  {sysNum && diaNum ? `${sysNum}/${diaNum} mmHg` : "—"}
                </span>
              </div>
              <Separator />
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Heart Rate</span>
                <span className="font-mono font-bold text-foreground">
                  {form.pulse ? `${form.pulse} bpm` : "—"}
                </span>
              </div>
              <Separator />
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Temperature</span>
                <span className="font-mono font-bold text-foreground">
                  {tempF ? `${tempF}°F` : "—"}
                </span>
              </div>
              <Separator />
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">BMI</span>
                <span className="font-mono font-bold text-foreground">
                  {computedBmi ? `${computedBmi}` : "—"}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Historical Trend Card */}
          {patientHistory.length > 0 && (
            <Card className="border-border/80 shadow-xs">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                  <span>Recent Vitals History</span>
                  <Badge variant="outline" className="text-[10px]">{patientHistory.length} logs</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-2">
                {patientHistory.slice(0, 4).map((h) => (
                  <div
                    key={h.id}
                    onClick={() => navigate(`/healthcare/vital-signs/${h.id}`)}
                    className="p-2.5 rounded-lg border bg-muted/20 hover:bg-muted/50 cursor-pointer transition-colors text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between text-[11px] font-semibold text-foreground">
                      <span>{h.signs_date}</span>
                      <span className="font-mono">{h.bp || `${h.bp_systolic || "—"}/${h.bp_diastolic || "—"}`}</span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <span>Pulse: {h.pulse || "—"} bpm</span>
                      <span>BMI: {h.bmi || "—"}</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* ── Official Printable Vitals Slip Modal ─────────────────────── */}
      <Dialog open={showPrintSlip} onOpenChange={setShowPrintSlip}>
        <DialogContent className="max-w-xl">
          <DialogHeader className="border-b pb-3">
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-foreground">
              <Icon icon="solar:printer-bold" size={18} className="text-slate-700" />
              Official Outpatient Triage & Vitals Slip
            </DialogTitle>
          </DialogHeader>

          {/* Printable Slip Container */}
          <div className="p-6 border rounded-xl bg-white text-slate-900 space-y-5 font-sans" id="printable-vitals-slip">
            {/* Header */}
            <div className="flex items-center justify-between border-b pb-4">
              <div className="flex items-center gap-3">
                <img src={eeuLogoImg} alt="EEU" className="h-12 w-12" />
                <div>
                  <h3 className="font-extrabold text-sm uppercase tracking-wide text-slate-900">
                    Ethiopian Electric Utility (EEU)
                  </h3>
                  <p className="text-[11px] text-slate-600 font-medium">
                    Health Services Directorate — Outpatient Triage Station
                  </p>
                </div>
              </div>
              <div className="text-right text-[11px] text-slate-500 font-mono">
                <p>Record ID: #{id}</p>
                <p>{form.signs_date} {form.signs_time}</p>
              </div>
            </div>

            {/* Patient Header */}
            <div className="grid grid-cols-2 gap-4 p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs">
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-semibold block">Patient Name</span>
                <span className="font-bold text-sm text-slate-900">{patientName}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-semibold block">Triage Classification</span>
                <span className="font-bold text-xs text-rose-700">{triageUrgency.level}</span>
              </div>
            </div>

            {/* Vitals Grid */}
            <div className="grid grid-cols-3 gap-3 text-xs">
              <div className="p-3 border rounded-lg text-center">
                <span className="text-[10px] text-slate-500 uppercase block">Blood Pressure</span>
                <span className="font-bold text-base font-mono text-slate-900">
                  {sysNum && diaNum ? `${sysNum}/${diaNum}` : "—"}
                </span>
                <span className="text-[10px] text-slate-500 block">mmHg</span>
              </div>

              <div className="p-3 border rounded-lg text-center">
                <span className="text-[10px] text-slate-500 uppercase block">Pulse / Heart Rate</span>
                <span className="font-bold text-base font-mono text-slate-900">
                  {form.pulse || "—"}
                </span>
                <span className="text-[10px] text-slate-500 block">bpm</span>
              </div>

              <div className="p-3 border rounded-lg text-center">
                <span className="text-[10px] text-slate-500 uppercase block">Temperature</span>
                <span className="font-bold text-base font-mono text-slate-900">
                  {tempF ? `${tempF}°F` : "—"}
                </span>
                <span className="text-[10px] text-slate-500 block">
                  {tempC ? `(${tempC.toFixed(1)}°C)` : ""}
                </span>
              </div>

              <div className="p-3 border rounded-lg text-center">
                <span className="text-[10px] text-slate-500 uppercase block">Respiratory Rate</span>
                <span className="font-bold text-base font-mono text-slate-900">
                  {form.respiratory_rate || "—"}
                </span>
                <span className="text-[10px] text-slate-500 block">breaths/min</span>
              </div>

              <div className="p-3 border rounded-lg text-center">
                <span className="text-[10px] text-slate-500 uppercase block">Height & Weight</span>
                <span className="font-bold text-xs font-mono text-slate-900">
                  {form.height || "—"}cm / {form.weight || "—"}kg
                </span>
                <span className="text-[10px] text-slate-500 block">Metric</span>
              </div>

              <div className="p-3 border rounded-lg text-center">
                <span className="text-[10px] text-slate-500 uppercase block">Body Mass Index</span>
                <span className="font-bold text-base font-mono text-slate-900">
                  {computedBmi || "—"}
                </span>
                <span className="text-[10px] text-slate-500 block">{computedNutrition || ""}</span>
              </div>
            </div>

            {/* Notes */}
            {form.vital_signs_note && (
              <div className="text-xs p-3 rounded-lg bg-slate-50 border border-slate-200">
                <span className="text-[10px] text-slate-500 uppercase font-semibold block mb-0.5">Triage Notes:</span>
                <p className="text-slate-800 italic">{form.vital_signs_note}</p>
              </div>
            )}

            {/* Footer Signature */}
            <div className="pt-6 border-t flex items-end justify-between text-xs text-slate-600">
              <div>
                <p className="text-[10px] text-slate-400">Authenticated Clinical Document</p>
                <p className="font-mono text-[11px]">EEU-TRIAGE-{form.signs_date.replace(/-/g, "")}</p>
              </div>
              <div className="text-right">
                <div className="h-8 border-b border-dashed border-slate-400 w-36 mb-1" />
                <p className="text-[11px] font-semibold text-slate-800">Triage Officer Signature</p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setShowPrintSlip(false)} className="text-xs">
              Close
            </Button>
            <Button
              size="sm"
              onClick={() => window.print()}
              className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold"
            >
              <Icon icon="solar:printer-bold" size={14} className="mr-1.5" />
              Print Triage Slip
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
