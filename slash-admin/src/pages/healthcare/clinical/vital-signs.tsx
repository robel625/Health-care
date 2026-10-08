import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Icon } from "@/components/icon";
import { Button } from "@/ui/button";
import { Card, CardContent } from "@/ui/card";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { Badge } from "@/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/ui/dialog";
import Table, { type ColumnsType } from "antd/es/table";
import { HealthcareApi } from "@/api/services/healthcareService";
import EntitySelect from "@/components/healthcare/EntitySelect";
import Avatar from "@/components/Avatar";
import { getInitials } from "@/utils";
import type { VitalSigns as VitalSignsType, Patient } from "@/api/services/healthcareService";
import { useDoctypePermissions } from "@/utils/permissions";

// ── Clinical Helper Functions ─────────────────────────────────────────
function getBpCategory(sysInput: number | string | null, diaInput: number | string | null) {
  const sys = sysInput ? Number(sysInput) : null;
  const dia = diaInput ? Number(diaInput) : null;
  if (!sys || !dia || isNaN(sys) || isNaN(dia)) return { label: "Not Recorded", color: "bg-gray-100 text-gray-600 border-gray-200", isUrgent: false };
  if (sys >= 180 || dia >= 120) return { label: "Crisis", color: "bg-rose-100 text-rose-800 border-rose-300 font-bold", isUrgent: true };
  if (sys >= 140 || dia >= 90) return { label: "Stage 2 HTN", color: "bg-red-100 text-red-800 border-red-300 font-semibold", isUrgent: false };
  if (sys >= 130 || dia >= 80) return { label: "Stage 1 HTN", color: "bg-amber-100 text-amber-800 border-amber-300", isUrgent: false };
  if (sys >= 120 && dia < 80) return { label: "Elevated", color: "bg-yellow-100 text-yellow-800 border-yellow-300", isUrgent: false };
  return { label: "Normal", color: "bg-emerald-100 text-emerald-800 border-emerald-300 font-medium", isUrgent: false };
}

function getTempEvaluation(tempInput: number | string | null) {
  if (tempInput === null || tempInput === undefined || tempInput === "") {
    return { fStr: "—", cStr: "", label: "Normal", color: "text-muted-foreground", isFever: false };
  }
  const tempF = Number(tempInput);
  if (isNaN(tempF) || tempF <= 0) {
    return { fStr: "—", cStr: "", label: "Normal", color: "text-muted-foreground", isFever: false };
  }
  const tempC = ((tempF - 32) * 5) / 9;
  const fStr = `${tempF.toFixed(1)}°F`;
  const cStr = `(${tempC.toFixed(1)}°C)`;
  if (tempF >= 102.2) return { fStr, cStr, label: "High Pyrexia", color: "text-red-700 font-bold", isFever: true };
  if (tempF >= 100.4) return { fStr, cStr, label: "Fever", color: "text-amber-700 font-semibold", isFever: true };
  if (tempF < 96.8) return { fStr, cStr, label: "Hypothermia", color: "text-blue-700 font-semibold", isFever: false };
  return { fStr, cStr, label: "Normal", color: "text-foreground", isFever: false };
}

function getPulseEvaluation(pulseInput: number | string | null) {
  if (pulseInput === null || pulseInput === undefined || pulseInput === "") {
    return { text: "—", tag: "", color: "text-muted-foreground" };
  }
  const pulse = Number(pulseInput);
  if (isNaN(pulse) || pulse <= 0) return { text: "—", tag: "", color: "text-muted-foreground" };
  if (pulse > 100) return { text: `${pulse} bpm`, tag: "Tachycardia", color: "text-rose-700 font-semibold" };
  if (pulse < 60) return { text: `${pulse} bpm`, tag: "Bradycardia", color: "text-blue-700 font-semibold" };
  return { text: `${pulse} bpm`, tag: "Normal", color: "text-foreground" };
}

function getBmiEvaluation(bmiInput: number | string | null) {
  if (bmiInput === null || bmiInput === undefined || bmiInput === "") {
    return { label: "—", color: "text-muted-foreground bg-gray-100 border-gray-200" };
  }
  const b = Number(bmiInput);
  if (isNaN(b) || b <= 0) return { label: "—", color: "text-muted-foreground bg-gray-100 border-gray-200" };
  if (b < 18.5) return { label: `${b.toFixed(1)} (Underweight)`, color: "text-blue-800 bg-blue-50 border-blue-200" };
  if (b < 25) return { label: `${b.toFixed(1)} (Normal)`, color: "text-emerald-800 bg-emerald-50 border-emerald-200 font-semibold" };
  if (b < 30) return { label: `${b.toFixed(1)} (Overweight)`, color: "text-amber-800 bg-amber-50 border-amber-200" };
  return { label: `${b.toFixed(1)} (Obese)`, color: "text-rose-800 bg-rose-50 border-rose-200 font-bold" };
}

function getTriageLevel(r: VitalSignsType) {
  const bpSys = r.bp_systolic ? Number(r.bp_systolic) : 0;
  const bpDia = r.bp_diastolic ? Number(r.bp_diastolic) : 0;
  const temp = r.temperature ? Number(r.temperature) : 0;
  const pulse = r.pulse ? Number(r.pulse) : 0;

  if (bpSys >= 180 || bpDia >= 120 || temp >= 102.2 || pulse > 125 || (pulse > 0 && pulse < 45)) {
    return { level: "Red (Urgent)", badgeColor: "bg-red-600 text-white animate-pulse" };
  }
  if (bpSys >= 140 || bpDia >= 90 || temp >= 100.4 || pulse > 100 || (pulse > 0 && pulse < 55)) {
    return { level: "Yellow (Review)", badgeColor: "bg-amber-100 text-amber-900 border-amber-300 font-medium" };
  }
  return { level: "Green (Stable)", badgeColor: "bg-emerald-100 text-emerald-800 border-emerald-300" };
}

export default function VitalSignsPage() {
  const { canCreate } = useDoctypePermissions("Vital Signs");
  const navigate = useNavigate();
  const [data, setData] = useState<VitalSignsType[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [activeFilterTab, setActiveFilterTab] = useState<"all" | "alerts" | "hypertensive" | "febrile" | "abnormal_bmi">("all");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" } | null>(null);

  // Form State
  const [form, setForm] = useState({
    patient: null as number | null,
    signs_date: new Date().toISOString().split("T")[0],
    signs_time: new Date().toTimeString().slice(0, 5),
    temperature: "",
    pulse: "",
    respiratory_rate: "",
    bp_systolic: "",
    bp_diastolic: "",
    height: "",
    weight: "",
    tongue: "Normal",
    abdomen: "Normal",
    reflexes: "Normal",
    vital_signs_note: "",
  });

  const [searchParams] = useSearchParams();
  const patientFilter = searchParams.get("patient");

  // Load Data
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const filterParams: Record<string, any> = { page, search: search || undefined, page_size: 100 };
      if (patientFilter) filterParams.patient = patientFilter;
      const [res, pats] = await Promise.all([
        HealthcareApi.vitalSigns.list(filterParams),
        HealthcareApi.patients.list({ page_size: 200 }),
      ]);
      setData(res.results || []);
      setTotal(res.count || 0);
      setPatients(pats.results || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, search, patientFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Real-time BMI calculation in modal
  const modalComputedBmi = useMemo(() => {
    const h = parseFloat(form.height);
    const w = parseFloat(form.weight);
    if (h > 0 && w > 0) {
      const hm = h / 100;
      return (w / (hm * hm)).toFixed(2);
    }
    return "";
  }, [form.height, form.weight]);

  // Real-time BP category in modal
  const modalBpCat = useMemo(() => {
    const sys = form.bp_systolic ? Number(form.bp_systolic) : null;
    const dia = form.bp_diastolic ? Number(form.bp_diastolic) : null;
    return getBpCategory(sys, dia);
  }, [form.bp_systolic, form.bp_diastolic]);

  // KPI Statistics
  const stats = useMemo(() => {
    let criticalCount = 0;
    let htnCount = 0;
    let febrileCount = 0;
    let stableCount = 0;

    data.forEach((r) => {
      const bpSys = r.bp_systolic ? Number(r.bp_systolic) : 0;
      const bpDia = r.bp_diastolic ? Number(r.bp_diastolic) : 0;
      const temp = r.temperature ? Number(r.temperature) : 0;
      const pulse = r.pulse ? Number(r.pulse) : 0;

      if (bpSys >= 180 || bpDia >= 120 || temp >= 102.2 || pulse > 125 || (pulse > 0 && pulse < 45)) {
        criticalCount++;
      } else if (bpSys >= 140 || bpDia >= 90) {
        htnCount++;
      } else if (temp >= 100.4) {
        febrileCount++;
      } else {
        stableCount++;
      }
    });

    const stablePct = data.length > 0 ? Math.round((stableCount / data.length) * 100) : 100;
    return { criticalCount, htnCount, febrileCount, stableCount, stablePct };
  }, [data]);

  // Filtered dataset according to active tab
  const filteredData = useMemo(() => {
    if (activeFilterTab === "all") return data;
    if (activeFilterTab === "alerts") {
      return data.filter((r) => {
        const bpSys = r.bp_systolic ? Number(r.bp_systolic) : 0;
        const bpDia = r.bp_diastolic ? Number(r.bp_diastolic) : 0;
        const temp = r.temperature ? Number(r.temperature) : 0;
        const pulse = r.pulse ? Number(r.pulse) : 0;
        return bpSys >= 160 || bpDia >= 100 || temp >= 101.3 || pulse > 110 || (pulse > 0 && pulse < 50);
      });
    }
    if (activeFilterTab === "hypertensive") {
      return data.filter((r) => (r.bp_systolic ? Number(r.bp_systolic) : 0) >= 140 || (r.bp_diastolic ? Number(r.bp_diastolic) : 0) >= 90);
    }
    if (activeFilterTab === "febrile") {
      return data.filter((r) => (r.temperature ? Number(r.temperature) : 0) >= 100.4);
    }
    if (activeFilterTab === "abnormal_bmi") {
      return data.filter((r) => {
        const b = r.bmi ? Number(r.bmi) : 0;
        return b > 0 && (b < 18.5 || b >= 30);
      });
    }
    return data;
  }, [data, activeFilterTab]);

  // Handle Save
  const handleSaveVitals = async (andStartEncounter = false) => {
    if (!form.patient) {
      setToast({ msg: "Please select a patient", type: "err" });
      return;
    }
    try {
      const payload: any = { ...form };
      ["temperature", "pulse", "respiratory_rate", "bp_systolic", "bp_diastolic", "height", "weight"].forEach((k) => {
        payload[k] = payload[k] ? Number(payload[k]) : null;
      });
      const created = await HealthcareApi.vitalSigns.create(payload);
      setToast({ msg: "Vital Signs recorded successfully", type: "ok" });
      setShowCreateModal(false);
      setForm({
        patient: null,
        signs_date: new Date().toISOString().split("T")[0],
        signs_time: new Date().toTimeString().slice(0, 5),
        temperature: "",
        pulse: "",
        respiratory_rate: "",
        bp_systolic: "",
        bp_diastolic: "",
        height: "",
        weight: "",
        tongue: "Normal",
        abdomen: "Normal",
        reflexes: "Normal",
        vital_signs_note: "",
      });
      loadData();
      if (andStartEncounter && form.patient) {
        navigate(`/healthcare/encounters/new?patient=${form.patient}&vital_signs=${(created as any)?.id}`);
      }
    } catch (err: any) {
      const msg = err?.response?.data
        ? typeof err.response.data === "object"
          ? Object.entries(err.response.data).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`).join("; ")
          : String(err.response.data)
        : err?.message || "Failed to record vitals";
      setToast({ msg, type: "err" });
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this Vital Signs record?")) return;
    try {
      await HealthcareApi.vitalSigns.delete(id);
      setToast({ msg: "Record deleted", type: "ok" });
      loadData();
    } catch {
      setToast({ msg: "Failed to delete record", type: "err" });
    }
  };

  // Columns Definition
  const columns: ColumnsType<VitalSignsType> = [
    {
      title: "Patient & Identification",
      dataIndex: "patient_name",
      width: 220,
      render: (name: string, r) => {
        const initials = getInitials(name || "VS", "VS");
        return (
          <div
            className="flex items-center gap-3 cursor-pointer group"
            onClick={() => navigate(`/healthcare/vital-signs/${r.id}`)}
          >
            <Avatar initials={initials} size="md" tone="red" className="group-hover:ring-2 group-hover:ring-rose-400 transition-all shrink-0" />
            <div>
              <p className="font-bold text-xs text-foreground group-hover:text-rose-600 transition-colors">
                {name || "Unknown Patient"}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[10px] text-muted-foreground font-mono">
                  {r.naming_series ? r.naming_series.replace(".YYYY.", `.${new Date().getFullYear()}.`) : `#${r.id}`}
                </span>
              </div>
            </div>
          </div>
        );
      },
    },
    {
      title: "Blood Pressure (BP)",
      width: 170,
      render: (_, r) => {
        const sys = r.bp_systolic;
        const dia = r.bp_diastolic;
        if (!sys || !dia) return <span className="text-muted-foreground text-xs">—</span>;
        const cat = getBpCategory(sys, dia);
        const map = Math.round((2 * dia + sys) / 3);
        return (
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold font-mono tracking-tight text-foreground">
                {sys}/{dia} <span className="text-[10px] font-normal text-muted-foreground">mmHg</span>
              </span>
            </div>
            <div className="flex items-center gap-1.5 mt-1">
              <span className={`text-[10px] px-2 py-0.5 rounded-full border ${cat.color}`}>
                {cat.label}
              </span>
              <span className="text-[10px] text-muted-foreground font-mono" title="Mean Arterial Pressure">
                MAP {map}
              </span>
            </div>
          </div>
        );
      },
    },
    {
      title: "Pulse / Heart Rate",
      dataIndex: "pulse",
      width: 140,
      render: (v: number | null) => {
        const p = getPulseEvaluation(v);
        return (
          <div>
            <span className={`text-xs ${p.color}`}>{p.text}</span>
            {p.tag && (
              <span className="block text-[10px] text-muted-foreground mt-0.5">
                {p.tag}
              </span>
            )}
          </div>
        );
      },
    },
    {
      title: "Body Temperature",
      dataIndex: "temperature",
      width: 150,
      render: (v: number | null) => {
        const t = getTempEvaluation(v);
        return (
          <div>
            <span className={`text-xs ${t.color}`}>
              {t.fStr} <span className="text-[10px] font-normal opacity-80">{t.cStr}</span>
            </span>
            {t.isFever && (
              <Badge className="ml-1 bg-amber-100 text-amber-800 border-amber-300 text-[9px] px-1 py-0 h-4">
                {t.label}
              </Badge>
            )}
          </div>
        );
      },
    },
    {
      title: "Resp Rate",
      dataIndex: "respiratory_rate",
      width: 100,
      render: (v: number | null) => (
        <span className={`text-xs ${v && (v > 22 || v < 12) ? "text-amber-700 font-semibold" : "text-foreground"}`}>
          {v ? `${v} /min` : "—"}
        </span>
      ),
    },
    {
      title: "BMI & Nutrition",
      dataIndex: "bmi",
      width: 150,
      render: (v: number | null) => {
        const evalBmi = getBmiEvaluation(v);
        return (
          <span className={`text-[10px] px-2 py-0.5 rounded-full border ${evalBmi.color}`}>
            {evalBmi.label}
          </span>
        );
      },
    },
    {
      title: "Clinical Triage",
      width: 130,
      render: (_, r) => {
        const triage = getTriageLevel(r);
        return (
          <span className={`text-[10px] px-2.5 py-1 rounded-full font-semibold border ${triage.badgeColor}`}>
            {triage.level}
          </span>
        );
      },
    },
    {
      title: "Recorded",
      dataIndex: "signs_date",
      width: 140,
      sorter: (a, b) => a.signs_date.localeCompare(b.signs_date),
      render: (d: string, r) => (
        <div className="text-xs">
          <span className="font-medium text-foreground">{d}</span>
          <span className="block text-[10px] text-muted-foreground">{r.signs_time || "—"}</span>
        </div>
      ),
    },
    {
      title: "Actions",
      width: 120,
      fixed: "right",
      render: (_, r) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/healthcare/vital-signs/${r.id}`)}
            title="Inspect Vital Signs Details"
            className="h-8 w-8 p-0 text-slate-700 hover:text-rose-600 hover:bg-rose-50"
          >
            <Icon icon="solar:eye-bold" size={16} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/healthcare/encounters/new?patient=${r.patient}&vital_signs=${r.id}`)}
            title="Initiate Clinical Consultation (SOAP)"
            className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
          >
            <Icon icon="solar:stethoscope-bold" size={16} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleDelete(r.id)}
            title="Delete Record"
            className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
          >
            <Icon icon="solar:trash-bin-trash-bold" size={16} />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-2.5 rounded-xl text-sm font-medium text-white shadow-xl cursor-pointer transition-all ${
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

      {/* Patient Filter Active Banner */}
      {patientFilter && (
        <div className="flex items-center justify-between p-3 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-800">
          <div className="flex items-center gap-2">
            <Icon icon="solar:filter-bold" size={18} className="text-rose-600" />
            <span>Filtering vital signs for Patient <strong>#{patientFilter}</strong></span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/healthcare/vital-signs")}
            className="text-xs text-rose-700 hover:bg-rose-100"
          >
            Clear Patient Filter
          </Button>
        </div>
      )}

      {/* ── Top Header Banner ────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-rose-900 via-red-950 to-slate-900 p-6 text-white shadow-xl border border-rose-700/40">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="h-14 w-14 rounded-2xl bg-white/10 border border-white/20 p-2.5 flex items-center justify-center shrink-0 shadow-inner">
              <Icon icon="solar:heart-pulse-bold" size={32} className="text-rose-400 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Badge className="bg-rose-500/20 text-rose-300 border-rose-400/30 text-xs font-semibold">
                  Outpatient Nursing Triage
                </Badge>
                <span className="text-xs text-rose-200/80">Hemodynamic Telemetry</span>
              </div>
              <h1 className="text-2xl font-extrabold tracking-tight text-white">
                Vital Signs & Clinical Triage Register
              </h1>
              <p className="mt-0.5 text-xs text-rose-100/85 max-w-2xl leading-relaxed">
                Continuous physiological monitoring, automatic blood pressure classification (AHA/WHO), and clinical triage escalation for EEU clinic outpatients.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {canCreate && (
              <Button
                onClick={() => setShowCreateModal(true)}
                className="bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md transition-all h-9 px-4"
              >
                <Icon icon="solar:add-circle-bold" size={16} className="mr-1.5" />
                Quick Record Vitals
              </Button>
            )}
            <Button
              onClick={() => navigate("/healthcare/vital-signs/new")}
              variant="outline"
              className="bg-white/10 hover:bg-white/20 text-white border-white/20 text-xs h-9"
            >
              <Icon icon="solar:pen-new-square-bold" size={16} className="mr-1.5" />
              Full Vitals Form
            </Button>
          </div>
        </div>
      </div>

      {/* ── KPI Stat Cards ───────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-border/80 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                Total Logs
              </span>
              <span className="text-2xl font-extrabold text-foreground">{total}</span>
              <span className="text-[10px] text-muted-foreground block mt-0.5">Recorded outpatients</span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-100 text-slate-700">
              <Icon icon="solar:document-text-bold" size={22} />
            </div>
          </CardContent>
        </Card>

        <Card className="border-rose-200/70 bg-rose-50/20 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-semibold text-rose-700 uppercase tracking-wider block">
                Critical Alerts
              </span>
              <span className="text-2xl font-extrabold text-rose-700">{stats.criticalCount}</span>
              <span className="text-[10px] text-rose-600 block mt-0.5">Crisis / High Pyrexia</span>
            </div>
            <div className="p-2.5 rounded-xl bg-rose-100 text-rose-700">
              <Icon icon="solar:danger-triangle-bold" size={22} />
            </div>
          </CardContent>
        </Card>

        <Card className="border-amber-200/70 bg-amber-50/20 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider block">
                Hypertension Watch
              </span>
              <span className="text-2xl font-extrabold text-amber-700">{stats.htnCount}</span>
              <span className="text-[10px] text-amber-600 block mt-0.5">BP ≥ 140/90 mmHg</span>
            </div>
            <div className="p-2.5 rounded-xl bg-amber-100 text-amber-700">
              <Icon icon="solar:heart-bold" size={22} />
            </div>
          </CardContent>
        </Card>

        <Card className="border-emerald-200/70 bg-emerald-50/20 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider block">
                Stable Readings
              </span>
              <span className="text-2xl font-extrabold text-emerald-700">{stats.stablePct}%</span>
              <span className="text-[10px] text-emerald-600 block mt-0.5">Within normal limits</span>
            </div>
            <div className="p-2.5 rounded-xl bg-emerald-100 text-emerald-700">
              <Icon icon="solar:shield-check-bold" size={22} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Filter Tabs & Search Bar ─────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          <Button
            variant={activeFilterTab === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveFilterTab("all")}
            className={`text-xs h-8 ${activeFilterTab === "all" ? "bg-slate-800" : ""}`}
          >
            All Logs ({data.length})
          </Button>
          <Button
            variant={activeFilterTab === "alerts" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveFilterTab("alerts")}
            className={`text-xs h-8 ${activeFilterTab === "alerts" ? "bg-rose-700 text-white" : "text-rose-700 border-rose-200 hover:bg-rose-50"}`}
          >
            <Icon icon="solar:bell-bing-bold" size={14} className="mr-1" />
            Critical Alerts ({stats.criticalCount})
          </Button>
          <Button
            variant={activeFilterTab === "hypertensive" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveFilterTab("hypertensive")}
            className={`text-xs h-8 ${activeFilterTab === "hypertensive" ? "bg-amber-700 text-white" : "text-amber-800 border-amber-200 hover:bg-amber-50"}`}
          >
            Hypertension ({stats.htnCount})
          </Button>
          <Button
            variant={activeFilterTab === "febrile" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveFilterTab("febrile")}
            className={`text-xs h-8 ${activeFilterTab === "febrile" ? "bg-yellow-700 text-white" : "text-yellow-800 border-yellow-200 hover:bg-yellow-50"}`}
          >
            Fever Watch
          </Button>
          <Button
            variant={activeFilterTab === "abnormal_bmi" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveFilterTab("abnormal_bmi")}
            className={`text-xs h-8 ${activeFilterTab === "abnormal_bmi" ? "bg-blue-700 text-white" : "text-blue-800 border-blue-200 hover:bg-blue-50"}`}
          >
            BMI Outliers
          </Button>
        </div>

        <div className="relative w-full sm:w-72">
          <Icon icon="solar:magnifer-linear" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search patient, badge, record..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-9 h-8 text-xs"
          />
        </div>
      </div>

      {/* ── Main Table ───────────────────────────────────────────────── */}
      <Card className="shadow-sm border-border/80 overflow-hidden">
        <CardContent className="p-0">
          <Table
            columns={columns}
            dataSource={filteredData}
            rowKey="id"
            loading={loading}
            scroll={{ x: 1100 }}
            pagination={{
              current: page,
              total,
              pageSize: 20,
              onChange: setPage,
              showSizeChanger: false,
              showTotal: (t) => `Showing ${t} vital sign logs`,
            }}
          />
        </CardContent>
      </Card>

      {/* ── Quick Create Vitals Dialog Modal ──────────────────────────── */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="border-b pb-3">
            <DialogTitle className="flex items-center gap-2 text-lg font-bold text-foreground">
              <Icon icon="solar:heart-pulse-bold" size={20} className="text-rose-600" />
              Quick Record Outpatient Vitals
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {/* Patient & Date / Time */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
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
                    placeholder="Search patient name or ID..."
                    emptyText="No patients found"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs font-semibold text-foreground">Date *</Label>
                  <Input
                    type="date"
                    value={form.signs_date}
                    onChange={(e) => setForm({ ...form, signs_date: e.target.value })}
                    className="mt-1 h-9 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-foreground">Time *</Label>
                  <Input
                    type="time"
                    value={form.signs_time}
                    onChange={(e) => setForm({ ...form, signs_time: e.target.value })}
                    className="mt-1 h-9 text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Blood Pressure & Heart Rate */}
            <div className="p-3.5 rounded-xl border border-rose-200/80 bg-rose-50/20 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-rose-900 flex items-center gap-1.5">
                  <Icon icon="solar:heart-bold" size={16} className="text-rose-600" />
                  Hemodynamic Parameters
                </span>
                {form.bp_systolic && form.bp_diastolic && (
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border ${modalBpCat.color}`}>
                    {modalBpCat.label}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-[11px] font-medium text-foreground">Systolic BP (mmHg)</Label>
                  <Input
                    type="number"
                    placeholder="e.g. 120"
                    value={form.bp_systolic}
                    onChange={(e) => setForm({ ...form, bp_systolic: e.target.value })}
                    className="mt-1 h-9 text-xs font-mono font-semibold"
                  />
                </div>
                <div>
                  <Label className="text-[11px] font-medium text-foreground">Diastolic BP (mmHg)</Label>
                  <Input
                    type="number"
                    placeholder="e.g. 80"
                    value={form.bp_diastolic}
                    onChange={(e) => setForm({ ...form, bp_diastolic: e.target.value })}
                    className="mt-1 h-9 text-xs font-mono font-semibold"
                  />
                </div>
                <div>
                  <Label className="text-[11px] font-medium text-foreground">Heart Rate (bpm)</Label>
                  <Input
                    type="number"
                    placeholder="e.g. 72"
                    value={form.pulse}
                    onChange={(e) => setForm({ ...form, pulse: e.target.value })}
                    className="mt-1 h-9 text-xs font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Temperature & Respiratory Rate */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-foreground">Temperature (°F)</Label>
                <div className="relative mt-1">
                  <Input
                    type="number"
                    step="0.1"
                    placeholder="e.g. 98.6"
                    value={form.temperature}
                    onChange={(e) => setForm({ ...form, temperature: e.target.value })}
                    className="h-9 text-xs font-mono"
                  />
                  {form.temperature && (
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground font-mono">
                      {(((Number(form.temperature) - 32) * 5) / 9).toFixed(1)}°C
                    </span>
                  )}
                </div>
              </div>

              <div>
                <Label className="text-xs font-semibold text-foreground">Respiratory Rate (breaths/min)</Label>
                <Input
                  type="number"
                  placeholder="e.g. 16"
                  value={form.respiratory_rate}
                  onChange={(e) => setForm({ ...form, respiratory_rate: e.target.value })}
                  className="mt-1 h-9 text-xs font-mono"
                />
              </div>
            </div>

            {/* Anthropometry (Height, Weight, Live BMI) */}
            <div className="p-3.5 rounded-xl border border-border/80 bg-muted/20 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Body Composition
                </span>
                {modalComputedBmi && (
                  <span className="text-xs font-bold text-emerald-800">
                    BMI: {modalComputedBmi} kg/m²
                  </span>
                )}
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-[11px] font-medium text-foreground">Height (cm)</Label>
                  <Input
                    type="number"
                    step="0.5"
                    placeholder="e.g. 175"
                    value={form.height}
                    onChange={(e) => setForm({ ...form, height: e.target.value })}
                    className="mt-1 h-9 text-xs font-mono"
                  />
                </div>
                <div>
                  <Label className="text-[11px] font-medium text-foreground">Weight (kg)</Label>
                  <Input
                    type="number"
                    step="0.5"
                    placeholder="e.g. 74"
                    value={form.weight}
                    onChange={(e) => setForm({ ...form, weight: e.target.value })}
                    className="mt-1 h-9 text-xs font-mono"
                  />
                </div>
                <div>
                  <Label className="text-[11px] font-medium text-foreground">Auto BMI</Label>
                  <Input
                    value={modalComputedBmi || "—"}
                    readOnly
                    className="mt-1 h-9 text-xs font-mono bg-card font-bold text-foreground"
                  />
                </div>
              </div>
            </div>

            {/* Clinical Observations */}
            <div>
              <Label className="text-xs font-semibold text-foreground">Triage Clinical Notes</Label>
              <textarea
                value={form.vital_signs_note}
                onChange={(e) => setForm({ ...form, vital_signs_note: e.target.value })}
                placeholder="Clinical notes: symptoms at intake, patient distress, rest duration before measurement..."
                className="w-full mt-1 p-2.5 rounded-xl border border-border text-xs min-h-[60px] focus:outline-none focus:ring-1 focus:ring-rose-500"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t">
              <Button variant="outline" size="sm" onClick={() => setShowCreateModal(false)} className="text-xs">
                Cancel
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleSaveVitals(true)}
                className="text-xs text-blue-700 border-blue-300 hover:bg-blue-50"
              >
                <Icon icon="solar:stethoscope-bold" size={14} className="mr-1" />
                Save & Start Encounter
              </Button>
              <Button
                size="sm"
                onClick={() => handleSaveVitals(false)}
                className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold"
              >
                <Icon icon="solar:check-circle-bold" size={14} className="mr-1" />
                Record Vitals
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
