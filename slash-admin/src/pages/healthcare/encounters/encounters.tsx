import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Icon } from "@/components/icon";
import { Button } from "@/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/ui/card";
import { Input } from "@/ui/input";
import { Badge } from "@/ui/badge";
import { Separator } from "@/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/ui/dialog";
import Avatar from "@/components/Avatar";
import { HealthcareApi } from "@/api/services/healthcareService";
import type { PatientEncounter, HealthcarePractitioner } from "@/api/services/healthcareService";
import { useDoctypePermissions } from "@/utils/permissions";
import PrescriptionPrintModal from "./PrescriptionPrintModal";
import { formatTime12 } from "@/utils/timeFormat";
import { cn, getInitials } from "@/utils";
import { toast } from "sonner";

// Status configuration with distinct clinical themes and badges
const STATUS_CONFIG: Record<
  string,
  { bg: string; dot: string; text: string; border: string; icon: string; label: string }
> = {
  Draft: {
    bg: "bg-amber-500/10 dark:bg-amber-500/15",
    dot: "bg-amber-500 animate-pulse",
    text: "text-amber-700 dark:text-amber-400",
    border: "border-amber-500/30",
    icon: "solar:pen-bold",
    label: "In Consultation",
  },
  Submitted: {
    bg: "bg-blue-500/10 dark:bg-blue-500/15",
    dot: "bg-blue-500",
    text: "text-blue-700 dark:text-blue-300",
    border: "border-blue-500/30",
    icon: "solar:clock-circle-bold",
    label: "Pending Review",
  },
  Completed: {
    bg: "bg-emerald-500/15 dark:bg-emerald-500/20",
    dot: "bg-emerald-500",
    text: "text-emerald-700 dark:text-emerald-300 font-bold",
    border: "border-emerald-500/40",
    icon: "solar:check-read-bold",
    label: "Finalized & Signed",
  },
  Cancelled: {
    bg: "bg-rose-500/10 dark:bg-rose-500/15",
    dot: "bg-rose-500",
    text: "text-rose-700 dark:text-rose-400",
    border: "border-rose-500/30",
    icon: "solar:close-circle-bold",
    label: "Cancelled",
  },
};

export default function EncountersPage() {
  const { canCreate } = useDoctypePermissions("Patient Encounter");
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const patientFilter = searchParams.get("patient");
  const practitionerFilter = searchParams.get("practitioner");

  // State
  const [encounters, setEncounters] = useState<PatientEncounter[]>([]);
  const [practitioners, setPractitioners] = useState<HealthcarePractitioner[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 15;

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [selectedPractitionerId, setSelectedPractitionerId] = useState<string>(practitionerFilter || "");
  const [datePreset, setDatePreset] = useState<"today" | "draft" | "completed" | "all">("today");
  const [specificDate, setSpecificDate] = useState<string>("");

  // Operating View Mode: "table" (Clinical List) | "grid" (Ward Cards) | "kanban" (Progression Flow)
  const [viewMode, setViewMode] = useState<"table" | "grid" | "kanban">("table");

  // Modals & Slide-overs
  const [selectedEncounterForPrint, setSelectedEncounterForPrint] = useState<PatientEncounter | null>(null);
  const [previewEncounter, setPreviewEncounter] = useState<PatientEncounter | null>(null);
  const [showPrintRegister, setShowPrintRegister] = useState(false);
  const [actionConfirm, setActionConfirm] = useState<{
    id: number;
    action: "submit" | "complete" | "delete";
    title: string;
    patientName?: string;
  } | null>(null);

  // Today's Date String
  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);

  // Load Data
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const filterParams: Record<string, any> = { page_size: 250 };
      if (patientFilter) filterParams.patient = patientFilter;
      if (practitionerFilter) filterParams.practitioner = practitionerFilter;

      const [res, pracRes] = await Promise.all([
        HealthcareApi.encounters.list(filterParams),
        HealthcareApi.practitioners.list({ page_size: 200 }).catch(() => ({ results: [] })),
      ]);

      setEncounters(res.results || []);
      setTotal(res.count || (res.results ? res.results.length : 0));
      setPractitioners(pracRes.results || []);
    } catch (err) {
      console.error("Failed to load encounters:", err);
      toast.error("Failed to load clinical encounters");
    } finally {
      setLoading(false);
    }
  }, [patientFilter, practitionerFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Step Date by Days (+1 or -1)
  const handleStepDate = (direction: -1 | 1) => {
    const base = specificDate ? new Date(specificDate) : new Date();
    base.setDate(base.getDate() + direction);
    const nextDate = base.toISOString().split("T")[0];
    setSpecificDate(nextDate);
    setDatePreset("all");
  };

  // Filtered Encounters
  const filteredEncounters = useMemo(() => {
    return encounters.filter((enc) => {
      // Date Preset Filter
      if (datePreset === "today" && enc.encounter_date !== todayStr) {
        return false;
      }
      if (datePreset === "draft" && enc.status !== "Draft") {
        return false;
      }
      if (datePreset === "completed" && enc.status !== "Completed") {
        return false;
      }

      // Specific Date Filter Override
      if (specificDate && enc.encounter_date !== specificDate) {
        return false;
      }

      // Status Filter
      if (statusFilter !== "All" && enc.status !== statusFilter) {
        return false;
      }

      // Practitioner Filter
      if (selectedPractitionerId && String(enc.practitioner) !== String(selectedPractitionerId)) {
        return false;
      }

      // Search Query Filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchId = (enc.encounter_id || "").toLowerCase().includes(q);
        const matchPatient = (enc.patient_name || "").toLowerCase().includes(q);
        const matchDoctor = (enc.practitioner_name || "").toLowerCase().includes(q);
        const matchDept = (enc.department_name || "").toLowerCase().includes(q);
        const matchSymptoms = (enc.symptoms_list_items || []).some((s) =>
          (s.symptom || "").toLowerCase().includes(q)
        );
        const matchDiagnoses = (enc.diagnoses_list || []).some((d) =>
          (d.diagnosis || "").toLowerCase().includes(q)
        );
        if (!matchId && !matchPatient && !matchDoctor && !matchDept && !matchSymptoms && !matchDiagnoses) {
          return false;
        }
      }

      return true;
    });
  }, [
    encounters,
    datePreset,
    specificDate,
    statusFilter,
    selectedPractitionerId,
    searchQuery,
    todayStr,
  ]);

  // Paginated Encounters for Table
  const paginatedEncounters = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredEncounters.slice(start, start + pageSize);
  }, [filteredEncounters, page]);

  // Analytics Scorecard Calculations
  const stats = useMemo(() => {
    const todayList = encounters.filter((e) => e.encounter_date === todayStr);
    const todayCompleted = todayList.filter((e) => e.status === "Completed").length;
    const draftList = encounters.filter((e) => e.status === "Draft");
    const completedList = encounters.filter((e) => e.status === "Completed");

    return {
      allTotal: encounters.length,
      todayTotal: todayList.length,
      todayCompleted,
      draftTotal: draftList.length,
      completedTotal: completedList.length,
    };
  }, [encounters, todayStr]);

  // Status Action Handlers
  const handleExecuteAction = async () => {
    if (!actionConfirm) return;
    const { id, action } = actionConfirm;

    try {
      if (action === "submit") {
        await HealthcareApi.encounters.submit(id);
        toast.success("Encounter submitted for review");
      } else if (action === "complete") {
        await HealthcareApi.encounters.complete(id);
        toast.success("Encounter finalized & completed");
      } else if (action === "delete") {
        await HealthcareApi.encounters.delete(id);
        toast.success("Encounter deleted");
      }
      setActionConfirm(null);
      loadData();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.response?.data?.error || err?.message || "Operation failed");
    }
  };

  return (
    <div className="max-w-7xl mx-auto pb-24 space-y-6">
      {/* ─── Active Filter Notification Banner ─── */}
      {(patientFilter || practitionerFilter) && (
        <div className="flex items-center justify-between px-4 py-2.5 bg-blue-500/10 border border-blue-500/20 rounded-xl text-xs text-blue-700 dark:text-blue-300">
          <div className="flex items-center gap-2">
            <Icon icon="solar:filter-bold" size={15} />
            <span>
              Active Filter:{" "}
              <strong>
                {patientFilter ? `Patient #${patientFilter}` : `Attending Doctor #${practitionerFilter}`}
              </strong>
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-blue-700 dark:text-blue-300 hover:bg-blue-500/20 font-semibold"
            onClick={() => {
              searchParams.delete("patient");
              searchParams.delete("practitioner");
              setSearchParams(searchParams);
              setSelectedPractitionerId("");
            }}
          >
            Clear Filter
          </Button>
        </div>
      )}

      {/* ─── Executive Clinical Command Bar ─── */}
      <div className="rounded-2xl border bg-card/95 backdrop-blur-sm p-5 shadow-xs transition-all">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-500/20">
              <Icon icon="solar:clipboard-text-bold-duotone" size={26} />
            </div>
            <div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <button
                  type="button"
                  onClick={() => navigate("/healthcare")}
                  className="hover:text-foreground flex items-center gap-1 transition-colors"
                >
                  <Icon icon="solar:home-2-bold" size={13} />
                  Healthcare
                </button>
                <span>/</span>
                <span className="text-foreground font-semibold">Patient Encounters</span>
              </div>

              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl font-extrabold tracking-tight text-foreground">
                  Clinical Encounters & Consultations Hub
                </h1>
                <Badge
                  variant="outline"
                  className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-[10px] font-bold px-2 py-0.5"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse mr-1" />
                  OPD Clinical Active
                </Badge>
              </div>
            </div>
          </div>

          {/* Top Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={loadData}
              disabled={loading}
              className="h-9 text-xs font-semibold gap-1.5"
            >
              <Icon
                icon="solar:refresh-circle-bold"
                size={15}
                className={cn(loading && "animate-spin")}
              />
              Refresh
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPrintRegister(true)}
              className="h-9 text-xs font-semibold gap-1.5 border-border hover:bg-muted"
              title="Print Daily Clinical Consultations Register"
            >
              <Icon icon="solar:printer-bold" size={14} />
              Print Register
            </Button>

            {canCreate && (
              <Button
                onClick={() => {
                  const params = new URLSearchParams();
                  if (patientFilter) params.set("patient", patientFilter);
                  if (practitionerFilter) params.set("practitioner", practitionerFilter);
                  const qs = params.toString();
                  navigate(`/healthcare/encounters/new${qs ? `?${qs}` : ""}`);
                }}
                className="h-9 text-xs font-bold gap-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-md shadow-emerald-500/20 px-4"
              >
                <Icon icon="solar:stethoscope-bold" size={16} />
                New Clinical Encounter
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* ─── 4 Clinical KPI Analytics Scorecards ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Total Consultations */}
        <div
          onClick={() => {
            setDatePreset("all");
            setSpecificDate("");
            setStatusFilter("All");
          }}
          className={cn(
            "rounded-2xl border p-4 shadow-xs relative overflow-hidden cursor-pointer transition-all",
            datePreset === "all" && !specificDate && statusFilter === "All"
              ? "bg-primary/5 border-primary ring-1 ring-primary/20"
              : "bg-card hover:bg-muted/40"
          )}
        >
          <div className="flex items-center justify-between text-muted-foreground mb-1.5">
            <span className="text-xs font-bold uppercase tracking-wider">Total Volume</span>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600">
              <Icon icon="solar:archive-minimalistic-bold" size={18} />
            </div>
          </div>
          <div className="text-2xl font-black text-foreground">{stats.allTotal}</div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
            <span>All outpatient consultation records</span>
          </div>
        </div>

        {/* KPI 2: Today's Consultations */}
        <div
          onClick={() => {
            setDatePreset("today");
            setSpecificDate("");
            setStatusFilter("All");
          }}
          className={cn(
            "rounded-2xl border p-4 shadow-xs relative overflow-hidden cursor-pointer transition-all",
            datePreset === "today" && !specificDate
              ? "bg-blue-500/10 border-blue-500 ring-1 ring-blue-500/20"
              : "bg-card hover:bg-muted/40"
          )}
        >
          <div className="flex items-center justify-between text-muted-foreground mb-1.5">
            <span className="text-xs font-bold uppercase tracking-wider">Today's Consults</span>
            <div className="p-2 rounded-xl bg-blue-500/15 text-blue-600">
              <Icon icon="solar:calendar-date-bold" size={18} />
            </div>
          </div>
          <div className="text-2xl font-black text-foreground">{stats.todayTotal}</div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
            <span className="text-emerald-600 font-bold">{stats.todayCompleted} done</span>
            <span>• {stats.todayTotal - stats.todayCompleted} pending</span>
          </div>
        </div>

        {/* KPI 3: In Documentation / Draft */}
        <div
          onClick={() => {
            setDatePreset("draft");
            setSpecificDate("");
          }}
          className={cn(
            "rounded-2xl border p-4 shadow-xs relative overflow-hidden cursor-pointer transition-all",
            datePreset === "draft"
              ? "bg-amber-500/10 border-amber-500 ring-1 ring-amber-500/20"
              : "bg-card hover:bg-muted/40"
          )}
        >
          <div className="flex items-center justify-between text-muted-foreground mb-1.5">
            <span className="text-xs font-bold uppercase tracking-wider">In Progress (Draft)</span>
            <div className="p-2 rounded-xl bg-amber-500/15 text-amber-600">
              <Icon icon="solar:pen-bold" size={18} />
            </div>
          </div>
          <div className="text-2xl font-black text-amber-600 dark:text-amber-400">
            {stats.draftTotal}
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping inline-block mr-1" />
            <span>Active notes pending sign-off</span>
          </div>
        </div>

        {/* KPI 4: Finalized & Completed */}
        <div
          onClick={() => {
            setDatePreset("completed");
            setSpecificDate("");
          }}
          className={cn(
            "rounded-2xl border p-4 shadow-xs relative overflow-hidden cursor-pointer transition-all",
            datePreset === "completed"
              ? "bg-emerald-500/10 border-emerald-500 ring-1 ring-emerald-500/20"
              : "bg-card hover:bg-muted/40"
          )}
        >
          <div className="flex items-center justify-between text-muted-foreground mb-1.5">
            <span className="text-xs font-bold uppercase tracking-wider">Finalized</span>
            <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-600">
              <Icon icon="solar:check-circle-bold" size={18} />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
            {stats.completedTotal}
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
            <span>Signed off, coded & billed</span>
          </div>
        </div>
      </div>

      {/* ─── Search, Filters & View Switcher ─── */}
      <div className="rounded-2xl border bg-card p-4 shadow-xs space-y-3.5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Live Search */}
          <div className="relative flex-1 max-w-md">
            <Icon
              icon="solar:magnifer-bold"
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              placeholder="Search by Patient, MRN, Doctor, Symptom, or Diagnosis..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              className="pl-9 h-9 text-xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <Icon icon="solar:close-circle-bold" size={14} />
              </button>
            )}
          </div>

          {/* Practitioner Filter Dropdown */}
          <div className="w-full md:w-56">
            <select
              className="w-full h-9 border border-input rounded-md px-2.5 text-xs bg-background font-medium"
              value={selectedPractitionerId}
              onChange={(e) => {
                setSelectedPractitionerId(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All Attending Doctors</option>
              {practitioners.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.practitioner_name} ({p.department_name || "General"})
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter Dropdown */}
          <div className="w-full md:w-40">
            <select
              className="w-full h-9 border border-input rounded-md px-2.5 text-xs bg-background font-medium"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="All">All Statuses</option>
              {Object.keys(STATUS_CONFIG).map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>

          {/* Specific Date Picker with Stepper */}
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-8 shrink-0 text-muted-foreground hover:text-foreground"
              onClick={() => handleStepDate(-1)}
              title="Previous Day"
            >
              <Icon icon="solar:alt-arrow-left-bold" size={13} />
            </Button>
            <Input
              type="date"
              value={specificDate || (datePreset === "today" ? todayStr : "")}
              onChange={(e) => {
                setSpecificDate(e.target.value);
                setDatePreset("all");
                setPage(1);
              }}
              className="h-9 text-xs w-36 font-medium"
              title="Filter by specific date"
            />
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-8 shrink-0 text-muted-foreground hover:text-foreground"
              onClick={() => handleStepDate(1)}
              title="Next Day"
            >
              <Icon icon="solar:alt-arrow-right-bold" size={13} />
            </Button>
          </div>

          {/* View Mode Switcher */}
          <div className="inline-flex rounded-lg border bg-muted/40 p-0.5 shrink-0">
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={cn(
                "px-2.5 py-1 text-xs font-semibold rounded-md transition-all flex items-center gap-1",
                viewMode === "table"
                  ? "bg-background text-foreground shadow-2xs font-bold"
                  : "text-muted-foreground hover:text-foreground"
              )}
              title="Clinical Table List"
            >
              <Icon icon="solar:list-bold" size={13} />
              Table
            </button>
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={cn(
                "px-2.5 py-1 text-xs font-semibold rounded-md transition-all flex items-center gap-1",
                viewMode === "grid"
                  ? "bg-background text-foreground shadow-2xs font-bold"
                  : "text-muted-foreground hover:text-foreground"
              )}
              title="Doctor Ward Cards"
            >
              <Icon icon="solar:widget-2-bold" size={13} />
              Cards
            </button>
            <button
              type="button"
              onClick={() => setViewMode("kanban")}
              className={cn(
                "px-2.5 py-1 text-xs font-semibold rounded-md transition-all flex items-center gap-1",
                viewMode === "kanban"
                  ? "bg-background text-foreground shadow-2xs font-bold"
                  : "text-muted-foreground hover:text-foreground"
              )}
              title="Clinical Care Flow"
            >
              <Icon icon="solar:kanban-bold" size={13} />
              Flow Board
            </button>
          </div>
        </div>

        {/* Preset Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-1">
          <span className="text-[10px] uppercase font-bold text-muted-foreground mr-1 shrink-0">
            Presets:
          </span>
          {[
            { id: "today" as const, label: `Today's Consultations (${stats.todayTotal})`, icon: "solar:calendar-bold" },
            { id: "draft" as const, label: `In Progress / Draft (${stats.draftTotal})`, icon: "solar:pen-bold" },
            { id: "completed" as const, label: `Finalized & Signed (${stats.completedTotal})`, icon: "solar:check-read-bold" },
            { id: "all" as const, label: `All Encounters (${stats.allTotal})`, icon: "solar:archive-bold" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setDatePreset(tab.id);
                setSpecificDate("");
                setPage(1);
              }}
              className={cn(
                "px-3 py-1 rounded-full text-xs font-semibold border transition-all shrink-0 flex items-center gap-1",
                datePreset === tab.id && !specificDate
                  ? "bg-emerald-600 text-white border-emerald-600 font-bold shadow-2xs"
                  : "bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground border-border"
              )}
            >
              <Icon icon={tab.icon} size={12} />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ─── Encounters Content (Table / Grid / Kanban) ─── */}
      {filteredEncounters.length === 0 ? (
        <Card className="rounded-2xl border border-dashed p-12 text-center shadow-xs">
          <CardContent className="space-y-3 pt-6">
            <div className="w-12 h-12 rounded-2xl bg-muted/60 text-muted-foreground mx-auto flex items-center justify-center">
              <Icon icon="solar:clipboard-remove-bold" size={24} />
            </div>
            <h3 className="text-base font-bold text-foreground">No Clinical Encounters Found</h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              No patient encounter matches the active search filters or date range.
            </p>
            <div className="flex items-center justify-center gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchQuery("");
                  setStatusFilter("All");
                  setSelectedPractitionerId("");
                  setDatePreset("all");
                  setSpecificDate("");
                }}
                className="text-xs"
              >
                Clear All Filters
              </Button>
              {canCreate && (
                <Button
                  size="sm"
                  onClick={() => navigate("/healthcare/encounters/new")}
                  className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                >
                  <Icon icon="solar:stethoscope-bold" size={14} className="mr-1" />
                  Start First Encounter
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* ════════ VIEW 1: CLINICAL TABLE ════════ */}
          {viewMode === "table" && (
            <Card className="shadow-xs border-border overflow-hidden rounded-2xl">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-muted/40 border-b text-muted-foreground uppercase text-[10px] tracking-wider font-semibold">
                    <tr>
                      <th className="py-3 px-4">Patient Profile</th>
                      <th className="py-3 px-4">Attending Physician</th>
                      <th className="py-3 px-4">Consultation Time</th>
                      <th className="py-3 px-4">Clinical Impression & Diagnoses</th>
                      <th className="py-3 px-4">Care Orders</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4 text-right">Clinical Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {paginatedEncounters.map((enc) => {
                      const st = STATUS_CONFIG[enc.status] || STATUS_CONFIG.Draft;
                      const symptoms = (enc.symptoms_list_items || []).map((s) => s.symptom);
                      const diagnoses = (enc.diagnoses_list || []).map((d) => d.diagnosis);
                      const rxCount = (enc.drug_prescription_items || []).length;
                      const labCount = (enc.lab_prescription_items || []).length;
                      const procCount = (enc.procedure_prescription_items || []).length;

                      return (
                        <tr
                          key={enc.id}
                          className="hover:bg-muted/30 transition-colors group cursor-pointer"
                          onClick={() => navigate(`/healthcare/encounters/${enc.id}`)}
                        >
                          {/* Patient Profile */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3">
                              <Avatar
                                name={enc.patient_name}
                                initials={getInitials(enc.patient_name || "", "PT")}
                                size="md"
                                tone="emerald"
                                className="rounded-xl shrink-0"
                              />
                              <div>
                                <span className="font-extrabold text-foreground block hover:text-emerald-600 transition-colors">
                                  {enc.patient_name || `Patient #${enc.patient}`}
                                </span>
                                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-mono mt-0.5">
                                  <span>{enc.encounter_id}</span>
                                  {enc.patient_sex && <span>• {enc.patient_sex}</span>}
                                  {enc.patient_age && <span>• {enc.patient_age}</span>}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Attending Doctor */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2">
                              <Avatar
                                name={enc.practitioner_name}
                                initials={getInitials(enc.practitioner_name || "", "DR")}
                                size="sm"
                                tone="blue"
                                className="rounded-lg shrink-0"
                              />
                              <div>
                                <span className="font-bold text-foreground block">
                                  {enc.practitioner_name || "Unassigned Doctor"}
                                </span>
                                <span className="text-[10px] text-muted-foreground">
                                  {enc.department_name || "General Clinic"}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Consultation Date & Time */}
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-foreground flex items-center gap-1.5">
                              <Icon icon="solar:calendar-bold" size={13} className="text-emerald-600" />
                              <span>{enc.encounter_date}</span>
                            </div>
                            <div className="text-[10px] text-muted-foreground font-mono mt-0.5">
                              {enc.encounter_time ? formatTime12(enc.encounter_time) : "Time not set"}
                            </div>
                          </td>

                          {/* Clinical Impression & Diagnoses */}
                          <td className="py-3.5 px-4 max-w-xs">
                            <div className="space-y-1">
                              {diagnoses.length > 0 ? (
                                <div className="flex items-center gap-1 flex-wrap">
                                  {diagnoses.slice(0, 2).map((d) => (
                                    <Badge
                                      key={d}
                                      variant="outline"
                                      className="text-[10px] font-semibold bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/20 py-0"
                                    >
                                      {d}
                                    </Badge>
                                  ))}
                                  {diagnoses.length > 2 && (
                                    <span className="text-[10px] text-muted-foreground font-semibold">
                                      +{diagnoses.length - 2} more
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-[11px] text-muted-foreground italic">
                                  No diagnosis recorded
                                </span>
                              )}

                              {symptoms.length > 0 && (
                                <div className="text-[10px] text-muted-foreground truncate" title={symptoms.join(", ")}>
                                  Symptoms: {symptoms.join(", ")}
                                </div>
                              )}
                            </div>
                          </td>

                          {/* Care Orders Summary */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {rxCount > 0 && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-700 dark:text-rose-400 font-mono text-[10px] font-bold border border-rose-500/20">
                                  <Icon icon="solar:pills-bold" size={11} />
                                  {rxCount} Rx
                                </span>
                              )}
                              {labCount > 0 && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-700 dark:text-blue-300 font-mono text-[10px] font-bold border border-blue-500/20">
                                  <Icon icon="solar:test-tube-bold" size={11} />
                                  {labCount} Lab
                                </span>
                              )}
                              {procCount > 0 && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-400 font-mono text-[10px] font-bold border border-amber-500/20">
                                  <Icon icon="solar:medical-kit-bold" size={11} />
                                  {procCount} Proc
                                </span>
                              )}
                              {rxCount === 0 && labCount === 0 && procCount === 0 && (
                                <span className="text-[10px] text-muted-foreground italic">None</span>
                              )}
                            </div>
                          </td>

                          {/* Status Badge */}
                          <td className="py-3.5 px-4 text-center">
                            <Badge
                              variant="outline"
                              className={cn("text-[10px] font-bold px-2 py-0.5 gap-1 inline-flex items-center", st.bg, st.text, st.border)}
                            >
                              <span className={cn("w-1.5 h-1.5 rounded-full", st.dot)} />
                              {st.label}
                            </Badge>
                          </td>

                          {/* Clinical Actions */}
                          <td className="py-3.5 px-4 text-right">
                            <div
                              className="flex items-center justify-end gap-1"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {/* Quick Slide-Over Glance */}
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => setPreviewEncounter(enc)}
                                className="h-7 w-7 text-muted-foreground hover:text-indigo-600 hover:bg-indigo-500/10"
                                title="Quick Clinical Glance"
                              >
                                <Icon icon="solar:eye-bold" size={14} />
                              </Button>

                              {/* Prescription Print */}
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => setSelectedEncounterForPrint(enc)}
                                className="h-7 w-7 text-slate-600 hover:text-slate-800 hover:bg-slate-500/10"
                                title="Print Prescription Slip"
                              >
                                <Icon icon="solar:printer-bold" size={14} />
                              </Button>

                              {/* Medical Leave Slip (A5) */}
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() =>
                                  navigate(
                                    `/healthcare/medical-leave-slips/new?patient=${enc.patient}&encounter=${enc.id}&practitioner=${enc.practitioner || ""}`
                                  )
                                }
                                className="h-7 w-7 text-teal-600 hover:text-teal-700 hover:bg-teal-500/10"
                                title="Issue Medical Leave Slip (A5)"
                              >
                                <Icon icon="solar:diploma-verified-bold" size={14} />
                              </Button>

                              {/* External Referral (A4) */}
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() =>
                                  navigate(
                                    `/healthcare/external-referrals/new?patient=${enc.patient}&encounter=${enc.id}&practitioner=${enc.practitioner || ""}`
                                  )
                                }
                                className="h-7 w-7 text-blue-600 hover:text-blue-700 hover:bg-blue-500/10"
                                title="External Referral Out (A4)"
                              >
                                <Icon icon="solar:share-circle-bold" size={14} />
                              </Button>

                              {/* Pharmacy Request */}
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() =>
                                  navigate(
                                    `/healthcare/pharmacy/medication-requests/new?patient=${enc.patient}&encounter=${enc.id}&practitioner=${enc.practitioner || ""}`
                                  )
                                }
                                className="h-7 w-7 text-rose-600 hover:text-rose-700 hover:bg-rose-500/10"
                                title="Medication Request (Pharmacy)"
                              >
                                <Icon icon="solar:pills-bold" size={14} />
                              </Button>

                              {/* Workflow Status Actions */}
                              {enc.status === "Draft" && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() =>
                                    setActionConfirm({
                                      id: enc.id,
                                      action: "submit",
                                      title: "Submit Consultation",
                                      patientName: enc.patient_name,
                                    })
                                  }
                                  className="h-7 px-2 text-[10px] font-bold text-blue-600 hover:bg-blue-500/10 gap-1"
                                  title="Submit Encounter for review"
                                >
                                  <Icon icon="solar:check-read-bold" size={13} />
                                  <span>Submit</span>
                                </Button>
                              )}

                              {enc.status === "Submitted" && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() =>
                                    setActionConfirm({
                                      id: enc.id,
                                      action: "complete",
                                      title: "Complete Consultation",
                                      patientName: enc.patient_name,
                                    })
                                  }
                                  className="h-7 px-2 text-[10px] font-bold text-emerald-600 hover:bg-emerald-500/10 gap-1"
                                  title="Sign off and complete encounter"
                                >
                                  <Icon icon="solar:check-circle-bold" size={13} />
                                  <span>Complete</span>
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Table Pagination */}
              {filteredEncounters.length > pageSize && (
                <div className="flex items-center justify-between p-4 border-t bg-muted/20 text-xs">
                  <span className="text-muted-foreground font-medium">
                    Showing {(page - 1) * pageSize + 1} to{" "}
                    {Math.min(page * pageSize, filteredEncounters.length)} of{" "}
                    {filteredEncounters.length} consultations
                  </span>
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page === 1}
                      onClick={() => setPage(page - 1)}
                      className="h-8 text-xs font-semibold"
                    >
                      Previous
                    </Button>
                    <span className="px-2 font-mono font-bold text-foreground">
                      Page {page} of {Math.ceil(filteredEncounters.length / pageSize)}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= Math.ceil(filteredEncounters.length / pageSize)}
                      onClick={() => setPage(page + 1)}
                      className="h-8 text-xs font-semibold"
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          )}

          {/* ════════ VIEW 2: DOCTOR WARD / CONSULTATION CARDS GRID ════════ */}
          {viewMode === "grid" && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredEncounters.map((enc) => {
                const st = STATUS_CONFIG[enc.status] || STATUS_CONFIG.Draft;
                const diagnoses = (enc.diagnoses_list || []).map((d) => d.diagnosis);
                const rxCount = (enc.drug_prescription_items || []).length;
                const labCount = (enc.lab_prescription_items || []).length;

                return (
                  <Card
                    key={enc.id}
                    onClick={() => navigate(`/healthcare/encounters/${enc.id}`)}
                    className="shadow-xs border-border hover:shadow-md hover:border-emerald-500/50 transition-all cursor-pointer rounded-2xl p-4 space-y-3"
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] text-muted-foreground font-semibold">
                        {enc.encounter_id}
                      </span>
                      <Badge
                        variant="outline"
                        className={cn("text-[9px] px-2 py-0.5 font-bold gap-1", st.bg, st.text, st.border)}
                      >
                        <span className={cn("w-1.5 h-1.5 rounded-full", st.dot)} />
                        {st.label}
                      </Badge>
                    </div>

                    {/* Patient & Doctor */}
                    <div className="flex items-start gap-3">
                      <Avatar
                        name={enc.patient_name}
                        initials={getInitials(enc.patient_name || "", "PT")}
                        size="md"
                        tone="emerald"
                        className="rounded-xl shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <h4 className="font-extrabold text-sm text-foreground truncate hover:text-emerald-600">
                          {enc.patient_name}
                        </h4>
                        <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
                          <span>{enc.patient_sex || "Gender N/A"}</span>
                          {enc.patient_age && <span>• {enc.patient_age}</span>}
                        </div>
                        <div className="text-[11px] text-muted-foreground font-medium mt-1 flex items-center gap-1">
                          <Icon icon="solar:stethoscope-bold" size={12} className="text-emerald-600" />
                          <span className="truncate">{enc.practitioner_name}</span>
                        </div>
                      </div>
                    </div>

                    {/* Diagnosis Highlight */}
                    <div className="p-2.5 rounded-xl bg-muted/40 border text-xs space-y-1">
                      <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                        Primary Diagnosis
                      </div>
                      <div className="font-bold text-foreground truncate">
                        {diagnoses[0] || "Under Clinical Investigation"}
                      </div>
                    </div>

                    {/* Care Orders & Timing */}
                    <div className="flex items-center justify-between text-xs pt-1 border-t">
                      <div className="flex items-center gap-1.5">
                        {rxCount > 0 && (
                          <span className="text-[10px] font-bold text-rose-600 flex items-center gap-0.5">
                            <Icon icon="solar:pills-bold" size={11} /> {rxCount} Rx
                          </span>
                        )}
                        {labCount > 0 && (
                          <span className="text-[10px] font-bold text-blue-600 flex items-center gap-0.5">
                            <Icon icon="solar:test-tube-bold" size={11} /> {labCount} Lab
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] font-mono text-muted-foreground">
                        {enc.encounter_date}
                      </span>
                    </div>

                    {/* Card Actions */}
                    <div
                      className="flex items-center justify-between pt-2 border-t"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setPreviewEncounter(enc)}
                        className="text-xs h-8 text-indigo-600 hover:bg-indigo-500/10 font-semibold"
                      >
                        Quick Glance
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedEncounterForPrint(enc)}
                        className="text-xs h-8 font-semibold gap-1"
                      >
                        <Icon icon="solar:printer-bold" size={13} />
                        Prescription
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}

          {/* ════════ VIEW 3: CLINICAL FLOW / KANBAN BOARD ════════ */}
          {viewMode === "kanban" && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
              {[
                { stage: "Draft", title: "In Consultation (Draft)", icon: "solar:pen-bold", color: "text-amber-600 bg-amber-500/10" },
                { stage: "Submitted", title: "Review & Billing (Submitted)", icon: "solar:clock-circle-bold", color: "text-blue-600 bg-blue-500/10" },
                { stage: "Completed", title: "Finalized & Signed", icon: "solar:check-read-bold", color: "text-emerald-600 bg-emerald-500/10" },
              ].map((col) => {
                const stageEncounters = filteredEncounters.filter((e) => e.status === col.stage);

                return (
                  <div key={col.stage} className="space-y-3">
                    <div className="p-3.5 rounded-2xl border bg-card shadow-xs flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={cn("p-1.5 rounded-xl", col.color)}>
                          <Icon icon={col.icon} size={16} />
                        </div>
                        <span className="font-extrabold text-xs text-foreground">{col.title}</span>
                      </div>
                      <Badge variant="outline" className="font-mono text-xs font-bold">
                        {stageEncounters.length}
                      </Badge>
                    </div>

                    <div className="space-y-2.5">
                      {stageEncounters.length === 0 ? (
                        <div className="p-6 rounded-2xl border border-dashed text-center text-xs text-muted-foreground">
                          No encounters in this stage
                        </div>
                      ) : (
                        stageEncounters.map((enc) => (
                          <Card
                            key={enc.id}
                            onClick={() => navigate(`/healthcare/encounters/${enc.id}`)}
                            className="shadow-xs border-border hover:shadow-md hover:border-emerald-500/50 transition-all cursor-pointer space-y-2.5 p-3.5 rounded-xl"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-mono text-[10px] text-muted-foreground">
                                {enc.encounter_id}
                              </span>
                              <span className="text-[10px] font-mono text-muted-foreground font-semibold">
                                {enc.encounter_date}
                              </span>
                            </div>

                            <div className="flex items-center gap-2.5">
                              <Avatar
                                name={enc.patient_name}
                                initials={getInitials(enc.patient_name || "", "PT")}
                                size="sm"
                                tone="emerald"
                                className="rounded-lg shrink-0"
                              />
                              <div className="min-w-0 flex-1">
                                <h4 className="font-bold text-xs text-foreground truncate">
                                  {enc.patient_name}
                                </h4>
                                <p className="text-[10px] text-muted-foreground truncate">
                                  {enc.patient_sex} {enc.patient_age && `• ${enc.patient_age}`}
                                </p>
                              </div>
                            </div>

                            <div className="p-2 rounded-lg bg-muted/40 text-[11px] flex items-center justify-between">
                              <span className="font-medium text-foreground truncate">
                                {enc.practitioner_name || "Doctor"}
                              </span>
                              <span className="text-[10px] text-muted-foreground shrink-0 ml-1">
                                {enc.department_name || "General"}
                              </span>
                            </div>

                            {/* Card Status Action */}
                            <div
                              className="pt-2 border-t flex items-center justify-between"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setPreviewEncounter(enc)}
                                className="h-7 text-[11px] text-indigo-600 hover:bg-indigo-500/10 font-semibold"
                              >
                                View Details
                              </Button>

                              {enc.status === "Draft" && (
                                <Button
                                  size="sm"
                                  onClick={() =>
                                    setActionConfirm({
                                      id: enc.id,
                                      action: "submit",
                                      title: "Submit Encounter",
                                      patientName: enc.patient_name,
                                    })
                                  }
                                  className="h-7 text-[10px] font-bold bg-blue-600 hover:bg-blue-700 text-white"
                                >
                                  Submit
                                </Button>
                              )}

                              {enc.status === "Submitted" && (
                                <Button
                                  size="sm"
                                  onClick={() =>
                                    setActionConfirm({
                                      id: enc.id,
                                      action: "complete",
                                      title: "Complete Encounter",
                                      patientName: enc.patient_name,
                                    })
                                  }
                                  className="h-7 text-[10px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
                                >
                                  Complete
                                </Button>
                              )}
                            </div>
                          </Card>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ─── Quick Clinical Slide-over Drawer / Preview Modal ─── */}
      {previewEncounter && (
        <Dialog open={Boolean(previewEncounter)} onOpenChange={() => setPreviewEncounter(null)}>
          <DialogContent className="sm:max-w-2xl p-6 rounded-2xl">
            <DialogHeader>
              <div className="flex items-center justify-between border-b pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600">
                    <Icon icon="solar:clipboard-text-bold" size={20} />
                  </div>
                  <div>
                    <DialogTitle className="text-base font-bold text-foreground">
                      Clinical Consultation Summary
                    </DialogTitle>
                    <DialogDescription className="text-xs text-muted-foreground font-mono">
                      {previewEncounter.encounter_id} • {previewEncounter.encounter_date}
                    </DialogDescription>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className={cn("text-xs font-bold px-2 py-0.5", STATUS_CONFIG[previewEncounter.status]?.bg)}
                >
                  {previewEncounter.status}
                </Badge>
              </div>
            </DialogHeader>

            <div className="space-y-4 text-xs py-2 max-h-[65vh] overflow-y-auto">
              {/* Patient & Doctor Snapshot */}
              <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-muted/30 border">
                <div>
                  <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                    Patient Profile
                  </span>
                  <div className="font-bold text-sm text-foreground mt-0.5">
                    {previewEncounter.patient_name}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {previewEncounter.patient_sex || "Gender N/A"} • {previewEncounter.patient_age || "Age N/A"}
                  </div>
                </div>

                <div>
                  <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                    Attending Physician
                  </span>
                  <div className="font-bold text-sm text-foreground mt-0.5">
                    {previewEncounter.practitioner_name || "Unassigned"}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {previewEncounter.department_name || "General Clinic"}
                  </div>
                </div>
              </div>

              {/* Diagnoses & Symptoms */}
              <div className="space-y-2">
                <span className="text-[11px] font-bold text-foreground flex items-center gap-1.5">
                  <Icon icon="solar:notes-bold" size={14} className="text-emerald-600" />
                  Clinical Diagnoses & Impression
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {(previewEncounter.diagnoses_list || []).map((d) => (
                    <Badge
                      key={d.diagnosis}
                      variant="outline"
                      className="bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/30 text-xs py-1 px-2.5 font-semibold"
                    >
                      {d.diagnosis}
                    </Badge>
                  ))}
                  {(!previewEncounter.diagnoses_list || previewEncounter.diagnoses_list.length === 0) && (
                    <span className="text-muted-foreground italic">No formal diagnosis coded</span>
                  )}
                </div>
              </div>

              {/* Symptoms */}
              {(previewEncounter.symptoms_list_items || []).length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold text-foreground flex items-center gap-1.5">
                    <Icon icon="solar:pulse-bold" size={14} className="text-amber-500" />
                    Chief Symptoms Reported
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {previewEncounter.symptoms_list_items.map((s) => (
                      <span
                        key={s.symptom}
                        className="px-2 py-0.5 rounded-md bg-muted text-foreground text-[11px] border"
                      >
                        {s.symptom}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Prescribed Medications */}
              {(previewEncounter.drug_prescription_items || []).length > 0 && (
                <div className="space-y-2 pt-2 border-t">
                  <span className="text-[11px] font-bold text-foreground flex items-center gap-1.5">
                    <Icon icon="solar:pills-bold" size={14} className="text-rose-600" />
                    Prescribed Medications ({previewEncounter.drug_prescription_items.length})
                  </span>
                  <div className="border rounded-xl overflow-hidden">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-muted/40 border-b text-[10px] text-muted-foreground uppercase font-bold">
                        <tr>
                          <th className="p-2">Medication</th>
                          <th className="p-2">Dosage</th>
                          <th className="p-2">Duration</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {previewEncounter.drug_prescription_items.map((rx, idx) => (
                          <tr key={idx}>
                            <td className="p-2 font-bold text-foreground">{rx.drug_name || rx.medication}</td>
                            <td className="p-2 text-muted-foreground">{rx.dosage || "Standard"}</td>
                            <td className="p-2 text-muted-foreground">{rx.period || "1 Course"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Clinical Notes / Doctor Remarks */}
              {previewEncounter.clinical_notes && (
                <div className="space-y-1.5 pt-2 border-t">
                  <span className="text-[11px] font-bold text-foreground">Physician Clinical Remarks</span>
                  <div className="p-3 bg-muted/30 rounded-xl border text-xs whitespace-pre-wrap font-normal text-muted-foreground">
                    {previewEncounter.clinical_notes}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-3 border-t">
              <Button variant="outline" size="sm" onClick={() => setPreviewEncounter(null)}>
                Close
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setSelectedEncounterForPrint(previewEncounter);
                    setPreviewEncounter(null);
                  }}
                  className="gap-1 font-semibold text-xs"
                >
                  <Icon icon="solar:printer-bold" size={14} />
                  Print Prescription
                </Button>
                <Button
                  size="sm"
                  onClick={() => navigate(`/healthcare/encounters/${previewEncounter.id}`)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1 font-bold text-xs"
                >
                  <Icon icon="solar:arrow-right-up-bold" size={14} />
                  Open Full Record
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* ─── Prescription Print Modal Integration ─── */}
      {selectedEncounterForPrint && (
        <PrescriptionPrintModal
          open={Boolean(selectedEncounterForPrint)}
          onOpenChange={(open) => !open && setSelectedEncounterForPrint(null)}
          patientName={selectedEncounterForPrint.patient_name}
          patientAge={selectedEncounterForPrint.patient_age}
          patientSex={selectedEncounterForPrint.patient_sex}
          patientId={selectedEncounterForPrint.patient}
          practitionerName={selectedEncounterForPrint.practitioner_name}
          departmentName={selectedEncounterForPrint.department_name}
          encounterDate={selectedEncounterForPrint.encounter_date}
          diagnoses={(selectedEncounterForPrint.diagnoses_list || []).map((d) => d.diagnosis)}
          symptoms={(selectedEncounterForPrint.symptoms_list_items || []).map((s) => s.symptom)}
          drugRows={(selectedEncounterForPrint.drug_prescription_items || []).map((d) => ({
            drug_code: String(d.medication || ""),
            drug_name: d.drug_name || "",
            dosage: d.dosage || "",
            period: d.period || "",
            dosage_form: d.dosage_form || "Tablet",
            comment: d.comment || "",
          }))}
        />
      )}

      {/* ─── Printable Daily Clinical Consultation Register Sheet ─── */}
      <Dialog open={showPrintRegister} onOpenChange={setShowPrintRegister}>
        <DialogContent className="sm:max-w-3xl p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Icon icon="solar:printer-bold" className="text-emerald-600" size={18} />
              Daily Clinical Consultations Register
            </DialogTitle>
            <DialogDescription className="text-xs">
              Official outpatient consultation roster for medical records and nursing station
            </DialogDescription>
          </DialogHeader>

          <div className="border rounded-2xl p-5 bg-card space-y-3.5 my-2 max-h-[60vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b">
              <div>
                <h4 className="font-black text-sm uppercase tracking-wide text-foreground">
                  Healthcare Center & Clinical Suites
                </h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Outpatient Department Clinical Register • Date:{" "}
                  <strong>{specificDate || (datePreset === "today" ? todayStr : "All Dates")}</strong>
                </p>
              </div>
              <Badge variant="outline" className="font-mono text-xs">
                Total: {filteredEncounters.length} Encounters
              </Badge>
            </div>

            <table className="w-full text-xs text-left">
              <thead className="bg-muted/40 border-b text-muted-foreground uppercase text-[10px] font-bold">
                <tr>
                  <th className="py-2.5 px-2">Encounter ID</th>
                  <th className="py-2.5 px-2">Patient Profile</th>
                  <th className="py-2.5 px-2">Attending Doctor</th>
                  <th className="py-2.5 px-2">Primary Diagnosis</th>
                  <th className="py-2.5 px-2">Orders</th>
                  <th className="py-2.5 px-2 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredEncounters.map((enc) => {
                  const diagnoses = (enc.diagnoses_list || []).map((d) => d.diagnosis);
                  const rxCount = (enc.drug_prescription_items || []).length;
                  return (
                    <tr key={enc.id}>
                      <td className="py-2 px-2 font-mono font-bold text-emerald-600">
                        {enc.encounter_id}
                      </td>
                      <td className="py-2 px-2">
                        <span className="font-bold text-foreground block">{enc.patient_name}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {enc.patient_sex} • {enc.patient_age}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-muted-foreground">
                        {enc.practitioner_name} ({enc.department_name || "General"})
                      </td>
                      <td className="py-2 px-2 font-medium text-foreground">
                        {diagnoses[0] || "General Consultation"}
                      </td>
                      <td className="py-2 px-2 text-muted-foreground font-mono">
                        {rxCount > 0 ? `${rxCount} Rx` : "—"}
                      </td>
                      <td className="py-2 px-2 text-right">
                        <span className="font-bold text-[11px]">{enc.status}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setShowPrintRegister(false)}>
              Close
            </Button>
            <Button
              size="sm"
              onClick={() => window.print()}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 font-bold"
            >
              <Icon icon="solar:printer-bold" size={14} />
              <span>Print Register Sheet</span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Status Workflow Confirmation Dialog ─── */}
      {actionConfirm && (
        <Dialog open={Boolean(actionConfirm)} onOpenChange={() => setActionConfirm(null)}>
          <DialogContent className="max-w-sm p-5 rounded-2xl">
            <DialogHeader>
              <DialogTitle className="text-base font-bold">
                {actionConfirm.title}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground pt-1">
                Are you sure you want to proceed for{" "}
                <strong className="text-foreground">{actionConfirm.patientName || "Patient"}</strong>?
              </DialogDescription>
            </DialogHeader>

            <div className="flex items-center justify-end gap-2 pt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setActionConfirm(null)}
                className="h-8 text-xs"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleExecuteAction}
                className={cn(
                  "h-8 text-xs font-bold text-white",
                  actionConfirm.action === "delete"
                    ? "bg-rose-600 hover:bg-rose-700"
                    : "bg-emerald-600 hover:bg-emerald-700"
                )}
              >
                Confirm
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
