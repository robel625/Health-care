import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Icon } from "@/components/icon";
import { Button } from "@/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/ui/card";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { Badge } from "@/ui/badge";
import { Separator } from "@/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/ui/dialog";
import Avatar from "@/components/Avatar";
import { HealthcareApi } from "@/api/services/healthcareService";
import type {
  PatientAppointment,
  Patient,
  HealthcarePractitioner,
} from "@/api/services/healthcareService";
import { useDoctypePermissions } from "@/utils/permissions";
import EntitySelect from "@/components/healthcare/EntitySelect";
import { formatTime12 } from "@/utils/timeFormat";
import { cn, getInitials } from "@/utils";
import { toast } from "sonner";

// Status configuration with distinct clinical themes and badges
const STATUS_CONFIG: Record<
  string,
  { bg: string; dot: string; icon: string; label: string }
> = {
  Scheduled: {
    bg: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30",
    dot: "bg-blue-500",
    icon: "solar:clock-circle-bold",
    label: "Scheduled",
  },
  Open: {
    bg: "bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-500/30",
    dot: "bg-teal-500",
    icon: "solar:calendar-date-bold",
    label: "Open Slot",
  },
  Confirmed: {
    bg: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/30",
    dot: "bg-indigo-500",
    icon: "solar:check-circle-bold",
    label: "Confirmed",
  },
  "Checked In": {
    bg: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40 font-bold",
    dot: "bg-emerald-500 animate-pulse",
    icon: "solar:login-bold",
    label: "Checked In (Waiting)",
  },
  "Checked Out": {
    bg: "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30",
    dot: "bg-purple-500",
    icon: "solar:logout-bold",
    label: "Checked Out",
  },
  Closed: {
    bg: "bg-muted text-muted-foreground border-border",
    dot: "bg-muted-foreground",
    icon: "solar:check-read-bold",
    label: "Closed & Billed",
  },
  Cancelled: {
    bg: "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30",
    dot: "bg-rose-500",
    icon: "solar:close-circle-bold",
    label: "Cancelled",
  },
  "No Show": {
    bg: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30",
    dot: "bg-amber-500",
    icon: "solar:user-cross-bold",
    label: "No Show",
  },
};

// Appointment Type Badges
function getAppointmentTypeBadge(type?: string) {
  const t = (type || "").toLowerCase();
  if (t.includes("follow")) {
    return "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/30";
  }
  if (t.includes("urgent") || t.includes("emergency")) {
    return "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30 font-bold";
  }
  if (t.includes("procedure") || t.includes("surg")) {
    return "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30";
  }
  if (t.includes("routine") || t.includes("check")) {
    return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30";
  }
  return "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30";
}

// Common time slots for 1-click booking
const TIME_SLOT_PRESETS = [
  "08:30",
  "09:00",
  "09:30",
  "10:00",
  "10:30",
  "11:00",
  "11:30",
  "13:00",
  "13:30",
  "14:00",
  "14:30",
  "15:00",
  "15:30",
  "16:00",
  "16:30",
];

export default function AppointmentsPage() {
  const { canCreate } = useDoctypePermissions("Patient Appointment");
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const patientFilter = searchParams.get("patient");
  const practitionerFilter = searchParams.get("practitioner");

  // State
  const [appointments, setAppointments] = useState<PatientAppointment[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [practitioners, setPractitioners] = useState<HealthcarePractitioner[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("All");
  const [filterType, setFilterType] = useState<string>("All");
  const [datePreset, setDatePreset] = useState<"today" | "upcoming" | "waiting" | "all">("today");
  const [specificDate, setSpecificDate] = useState<string>("");

  // View Mode: "table" (default list) | "kanban" (flow queue) | "blocks" (hourly breakdown)
  const [viewMode, setViewMode] = useState<"table" | "kanban" | "blocks">("table");

  // Quick Fast-Book Dialog
  const [showQuickBook, setShowQuickBook] = useState(false);
  const [booking, setBooking] = useState(false);
  const [quickForm, setQuickForm] = useState({
    patient: null as number | null,
    practitioner: null as number | null,
    appointment_date: new Date().toISOString().split("T")[0],
    appointment_time: "09:00",
    appointment_type: "Consultation",
    duration: 30,
    notes: "",
  });

  // Action Confirmation State
  const [actionConfirm, setActionConfirm] = useState<{
    id: number;
    action: string;
    label: string;
    patientName?: string;
  } | null>(null);

  // Printable Appointment Pass & Daily Queue State
  const [selectedSlipAppt, setSelectedSlipAppt] = useState<PatientAppointment | null>(null);
  const [showPrintQueue, setShowPrintQueue] = useState(false);

  // Step Date by Days (+1 or -1)
  const handleStepDate = (direction: -1 | 1) => {
    const base = specificDate ? new Date(specificDate) : new Date();
    base.setDate(base.getDate() + direction);
    const nextDate = base.toISOString().split("T")[0];
    setSpecificDate(nextDate);
    setDatePreset("all");
  };

  // Load Reference Data
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const filterParams: Record<string, any> = { page_size: 200 };
      if (patientFilter) filterParams.patient = patientFilter;
      if (practitionerFilter) filterParams.practitioner = practitionerFilter;

      const [res, pats, pracs] = await Promise.all([
        HealthcareApi.appointments.list(filterParams),
        HealthcareApi.patients.list({ page_size: 200 }),
        HealthcareApi.practitioners.list({ page_size: 200 }),
      ]);

      setAppointments(res.results || []);
      setTotal(res.count || (res.results ? res.results.length : 0));
      setPatients(pats.results || []);
      setPractitioners(pracs.results || []);
    } catch (err) {
      console.error("Failed to load appointments:", err);
      toast.error("Failed to load appointments");
    } finally {
      setLoading(false);
    }
  }, [patientFilter, practitionerFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Patients & Practitioner lookup maps
  const patientMap = useMemo(() => {
    return Object.fromEntries(patients.map((p) => [p.id, p]));
  }, [patients]);

  const practitionerMap = useMemo(() => {
    return Object.fromEntries(practitioners.map((p) => [p.id, p]));
  }, [practitioners]);

  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);

  // Filtered Appointments
  const filteredAppointments = useMemo(() => {
    return appointments.filter((appt) => {
      // Date preset filter
      if (datePreset === "today" && appt.appointment_date !== todayStr) {
        return false;
      }
      if (datePreset === "upcoming" && appt.appointment_date < todayStr) {
        return false;
      }
      if (datePreset === "waiting" && appt.status !== "Checked In") {
        return false;
      }

      // Specific calendar date override
      if (specificDate && appt.appointment_date !== specificDate) {
        return false;
      }

      // Status filter
      if (filterStatus !== "All" && appt.status !== filterStatus) {
        return false;
      }

      // Type filter
      if (filterType !== "All") {
        const typeName = (appt.appointment_type_name || "").toLowerCase();
        if (!typeName.includes(filterType.toLowerCase())) {
          return false;
        }
      }

      // Search Query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchId = (appt.appointment_id || "").toLowerCase().includes(q);
        const matchPat = (appt.patient_name || "").toLowerCase().includes(q);
        const matchPrac = (appt.practitioner_name || "").toLowerCase().includes(q);
        const matchType = (appt.appointment_type_name || "").toLowerCase().includes(q);
        if (!matchId && !matchPat && !matchPrac && !matchType) {
          return false;
        }
      }

      return true;
    });
  }, [
    appointments,
    datePreset,
    specificDate,
    filterStatus,
    filterType,
    searchQuery,
    todayStr,
  ]);

  // Paginated Appointments for Table view
  const paginatedAppointments = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredAppointments.slice(start, start + pageSize);
  }, [filteredAppointments, page]);

  // Real-Time Analytics Scorecards
  const stats = useMemo(() => {
    const todayAppointments = appointments.filter((a) => a.appointment_date === todayStr);
    const waitingPatients = todayAppointments.filter((a) => a.status === "Checked In").length;
    const confirmedCount = todayAppointments.filter((a) => a.status === "Confirmed").length;
    const completedCount = todayAppointments.filter(
      (a) => a.status === "Checked Out" || a.status === "Closed"
    ).length;
    const cancelledCount = todayAppointments.filter(
      (a) => a.status === "Cancelled" || a.status === "No Show"
    ).length;

    return {
      todayTotal: todayAppointments.length,
      waitingPatients,
      confirmedCount,
      completedCount,
      cancelledCount,
      allTotal: appointments.length,
    };
  }, [appointments, todayStr]);

  // Workflow Action Handler
  const executeStatusAction = async () => {
    if (!actionConfirm) return;
    const { id, action } = actionConfirm;

    try {
      const apiMap: Record<string, () => Promise<any>> = {
        confirm: () => HealthcareApi.appointments.confirm(id),
        cancel: () => HealthcareApi.appointments.cancel(id),
        check_in: () => HealthcareApi.appointments.checkIn(id),
        check_out: () => HealthcareApi.appointments.checkOut(id),
        close: () => HealthcareApi.appointments.close(id),
        no_show: () => (HealthcareApi.appointments as any).noShow(id),
      };

      const handler = apiMap[action];
      if (handler) {
        await handler();
        toast.success(`Appointment status updated: ${actionConfirm.label}`);
      }
      setActionConfirm(null);
      loadData();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.response?.data?.error || "Failed to update appointment");
    }
  };

  // Quick Book Submit Handler
  const handleQuickBook = async () => {
    if (!quickForm.patient) {
      toast.error("Please select a patient");
      return;
    }
    if (!quickForm.practitioner) {
      toast.error("Please select a healthcare practitioner");
      return;
    }
    if (!quickForm.appointment_date) {
      toast.error("Please pick an appointment date");
      return;
    }

    setBooking(true);
    try {
      const payload: any = {
        patient: quickForm.patient,
        practitioner: quickForm.practitioner,
        appointment_date: quickForm.appointment_date,
        appointment_time: quickForm.appointment_time
          ? `${quickForm.appointment_time}:00`
          : null,
        duration: quickForm.duration,
        notes: quickForm.notes.trim(),
        status: "Scheduled",
      };

      const res: any = await HealthcareApi.appointments.create(payload);
      toast.success(
        `Appointment ${res?.appointment_id || "booked"} created successfully`
      );
      setShowQuickBook(false);
      setQuickForm({
        patient: null,
        practitioner: null,
        appointment_date: todayStr,
        appointment_time: "09:00",
        appointment_type: "Consultation",
        duration: 30,
        notes: "",
      });
      loadData();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Failed to book appointment");
    } finally {
      setBooking(false);
    }
  };

  // Available status actions
  const getAvailableActions = (status: string) => {
    switch (status) {
      case "Scheduled":
        return [
          { action: "confirm", label: "Confirm", icon: "solar:check-circle-bold", color: "text-indigo-600" },
          { action: "check_in", label: "Check In", icon: "solar:login-bold", color: "text-emerald-600" },
          { action: "cancel", label: "Cancel", icon: "solar:close-circle-bold", color: "text-rose-600" },
        ];
      case "Open":
        return [
          { action: "confirm", label: "Confirm", icon: "solar:check-circle-bold", color: "text-indigo-600" },
          { action: "cancel", label: "Cancel", icon: "solar:close-circle-bold", color: "text-rose-600" },
        ];
      case "Confirmed":
        return [
          { action: "check_in", label: "Check In", icon: "solar:login-bold", color: "text-emerald-600" },
          { action: "cancel", label: "Cancel", icon: "solar:close-circle-bold", color: "text-rose-600" },
        ];
      case "Checked In":
        return [
          { action: "check_out", label: "Check Out", icon: "solar:logout-bold", color: "text-purple-600" },
          { action: "cancel", label: "Cancel", icon: "solar:close-circle-bold", color: "text-rose-600" },
        ];
      case "Checked Out":
        return [
          { action: "close", label: "Close & Bill", icon: "solar:check-read-bold", color: "text-emerald-700" },
        ];
      default:
        return [];
    }
  };

  return (
    <div className="max-w-7xl mx-auto pb-24 space-y-6">
      {/* ─── Filter Banner if Patient or Practitioner Pre-selected ─── */}
      {(patientFilter || practitionerFilter) && (
        <div className="flex items-center justify-between px-4 py-2.5 bg-blue-500/10 border border-blue-500/20 rounded-xl text-xs text-blue-700 dark:text-blue-300">
          <div className="flex items-center gap-2">
            <Icon icon="solar:filter-bold" size={15} />
            <span>
              Active Filter:{" "}
              <strong>
                {patientFilter
                  ? `Patient: ${patientMap[Number(patientFilter)]?.patient_name || `#${patientFilter}`}`
                  : `Doctor: ${practitionerMap[Number(practitionerFilter)]?.practitioner_name || `#${practitionerFilter}`}`}
              </strong>
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-blue-700 dark:text-blue-300 hover:bg-blue-500/20"
            onClick={() => {
              searchParams.delete("patient");
              searchParams.delete("practitioner");
              setSearchParams(searchParams);
            }}
          >
            Clear Filter
          </Button>
        </div>
      )}

      {/* ─── Executive Top Command Bar ─── */}
      <div className="rounded-2xl border bg-card/95 backdrop-blur-sm p-5 shadow-xs transition-all">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-500/20">
              <Icon icon="solar:calendar-bold-duotone" size={26} />
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
                <span className="text-foreground font-semibold">Patient Appointments</span>
              </div>

              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl font-extrabold tracking-tight text-foreground">
                  Appointments & Clinical Queue
                </h1>
                <Badge
                  variant="outline"
                  className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-[10px] font-bold px-2 py-0.5"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse mr-1" />
                  Live Queue Active
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
              onClick={() => setShowPrintQueue(true)}
              className="h-9 text-xs font-semibold gap-1.5"
              title="Print Daily Patient Queue Roster"
            >
              <Icon icon="solar:printer-bold" size={14} />
              Print Queue
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowQuickBook(true)}
              className="h-9 text-xs font-semibold gap-1.5 border-dashed border-indigo-500/40 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/5"
            >
              <Icon icon="solar:magic-stick-3-bold" size={14} />
              Quick Book
            </Button>

            {canCreate && (
              <Button
                onClick={() => {
                  const params = new URLSearchParams();
                  if (patientFilter) params.set("patient", patientFilter);
                  if (practitionerFilter) params.set("practitioner", practitionerFilter);
                  const qs = params.toString();
                  navigate(`/healthcare/appointments/new${qs ? `?${qs}` : ""}`);
                }}
                className="h-9 text-xs font-semibold gap-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-md shadow-indigo-500/20 px-4"
              >
                <Icon icon="solar:calendar-add-bold" size={16} />
                New Appointment Form
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* ─── 4 Clinical KPI Analytics Scorecards ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Today's Appointments */}
        <div
          onClick={() => setDatePreset("today")}
          className={cn(
            "rounded-2xl border p-4 shadow-xs relative overflow-hidden cursor-pointer transition-all",
            datePreset === "today"
              ? "bg-primary/5 border-primary ring-1 ring-primary/20"
              : "bg-card hover:bg-muted/40"
          )}
        >
          <div className="flex items-center justify-between text-muted-foreground mb-1.5">
            <span className="text-xs font-bold uppercase tracking-wider">Today's Visits</span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600">
              <Icon icon="solar:calendar-date-bold" size={18} />
            </div>
          </div>
          <div className="text-2xl font-black text-foreground">{stats.todayTotal}</div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
            <span className="text-emerald-600 font-bold">{stats.completedCount} done</span>
            <span>• {stats.todayTotal - stats.completedCount} pending</span>
          </div>
        </div>

        {/* KPI 2: Waiting Room / Checked In */}
        <div
          onClick={() => setDatePreset("waiting")}
          className={cn(
            "rounded-2xl border p-4 shadow-xs relative overflow-hidden cursor-pointer transition-all",
            datePreset === "waiting"
              ? "bg-emerald-500/10 border-emerald-500 ring-1 ring-emerald-500/20"
              : "bg-card hover:bg-muted/40"
          )}
        >
          <div className="flex items-center justify-between text-muted-foreground mb-1.5">
            <span className="text-xs font-bold uppercase tracking-wider">Waiting Room</span>
            <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-600">
              <Icon icon="solar:login-bold" size={18} />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
            {stats.waitingPatients}
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping inline-block mr-1" />
            <span>Patients arrived & awaiting consult</span>
          </div>
        </div>

        {/* KPI 3: Confirmed In-Queue */}
        <div className="rounded-2xl border bg-card p-4 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between text-muted-foreground mb-1.5">
            <span className="text-xs font-bold uppercase tracking-wider">Confirmed</span>
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600">
              <Icon icon="solar:check-circle-bold" size={18} />
            </div>
          </div>
          <div className="text-2xl font-black text-foreground">{stats.confirmedCount}</div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
            <span>Ready for physical check-in</span>
          </div>
        </div>

        {/* KPI 4: Total Roster Volume */}
        <div
          onClick={() => setDatePreset("all")}
          className={cn(
            "rounded-2xl border p-4 shadow-xs relative overflow-hidden cursor-pointer transition-all",
            datePreset === "all"
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
            <span>All historical & future bookings</span>
          </div>
        </div>
      </div>

      {/* ─── Search, Date Preset Tabs & View Switcher ─── */}
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
              placeholder="Search by Patient name, MRN ID, Doctor, or Type..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
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
              value={practitionerFilter || ""}
              onChange={(e) => {
                if (e.target.value) {
                  searchParams.set("practitioner", e.target.value);
                } else {
                  searchParams.delete("practitioner");
                }
                setSearchParams(searchParams);
              }}
            >
              <option value="">All Practitioners</option>
              {practitioners.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.practitioner_name} ({p.department_name || "General"})
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="w-full md:w-40">
            <select
              className="w-full h-9 border border-input rounded-md px-2.5 text-xs bg-background font-medium"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
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

          {/* View Mode Switcher: Table vs Flow Queue vs Blocks */}
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
              List Table
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
              title="Queue Workflow Board"
            >
              <Icon icon="solar:kanban-bold" size={13} />
              Queue Board
            </button>
            <button
              type="button"
              onClick={() => setViewMode("blocks")}
              className={cn(
                "px-2.5 py-1 text-xs font-semibold rounded-md transition-all flex items-center gap-1",
                viewMode === "blocks"
                  ? "bg-background text-foreground shadow-2xs font-bold"
                  : "text-muted-foreground hover:text-foreground"
              )}
              title="Time-Block Matrix"
            >
              <Icon icon="solar:clock-circle-bold" size={13} />
              Time Blocks
            </button>
          </div>
        </div>

        {/* Preset Tabs: Today vs Upcoming vs Waiting Room vs All */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-1">
          <span className="text-[10px] uppercase font-bold text-muted-foreground mr-1 shrink-0">
            Preset:
          </span>
          {[
            { id: "today" as const, label: `Today's Queue (${stats.todayTotal})`, icon: "solar:calendar-bold" },
            { id: "waiting" as const, label: `Waiting Room (${stats.waitingPatients})`, icon: "solar:login-bold" },
            { id: "upcoming" as const, label: "Upcoming Visits", icon: "solar:arrow-right-bold" },
            { id: "all" as const, label: `All Appointments (${stats.allTotal})`, icon: "solar:archive-bold" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setDatePreset(tab.id);
                setSpecificDate("");
              }}
              className={cn(
                "px-3 py-1 rounded-full text-xs font-semibold border transition-all shrink-0 flex items-center gap-1",
                datePreset === tab.id && !specificDate
                  ? "bg-indigo-600 text-white border-indigo-600 font-bold shadow-2xs"
                  : "bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground border-border"
              )}
            >
              <Icon icon={tab.icon} size={12} />
              {tab.label}
            </button>
          ))}

          {specificDate && (
            <Badge
              variant="outline"
              className="bg-primary/10 text-primary border-primary/30 text-xs gap-1 ml-2"
            >
              <span>Date: {specificDate}</span>
              <button
                type="button"
                onClick={() => setSpecificDate("")}
                className="hover:text-destructive ml-1"
              >
                ✕
              </button>
            </Badge>
          )}
        </div>
      </div>

      {/* ─── Main Content Views ─── */}
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
            <span className="text-xs font-semibold text-muted-foreground">
              Loading patient queue & appointments...
            </span>
          </div>
        </div>
      ) : filteredAppointments.length === 0 ? (
        <Card className="shadow-xs">
          <CardContent className="py-16 text-center space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center mx-auto">
              <Icon icon="solar:calendar-cross-bold" size={28} />
            </div>
            <h3 className="text-base font-bold text-foreground">No Appointments Found</h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              No appointments match your active queue filters or search term.
            </p>
            <div className="flex items-center justify-center gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchQuery("");
                  setFilterStatus("All");
                  setFilterType("All");
                  setDatePreset("all");
                  setSpecificDate("");
                }}
                className="text-xs"
              >
                Clear Filters
              </Button>
              <Button
                size="sm"
                onClick={() => setShowQuickBook(true)}
                className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                <Icon icon="solar:calendar-add-bold" size={14} className="mr-1" />
                Book First Appointment
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* ════════ VIEW 1: ADVANCED CLINICAL TABLE (DEFAULT) ════════ */}
          {viewMode === "table" && (
            <Card className="shadow-xs border-border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-muted/40 border-b text-muted-foreground uppercase text-[10px] tracking-wider font-semibold">
                    <tr>
                      <th className="py-3 px-4">Patient Profile</th>
                      <th className="py-3 px-4">Healthcare Practitioner</th>
                      <th className="py-3 px-4">Schedule Date & Time</th>
                      <th className="py-3 px-4">Type</th>
                      <th className="py-3 px-4 text-center">Queue Status</th>
                      <th className="py-3 px-4 text-right">Workflow Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {paginatedAppointments.map((appt) => {
                      const st = STATUS_CONFIG[appt.status] || STATUS_CONFIG.Scheduled;
                      const actions = getAvailableActions(appt.status);

                      return (
                        <tr
                          key={appt.id}
                          className="hover:bg-muted/30 transition-colors group cursor-pointer"
                          onClick={() => navigate(`/healthcare/appointments/${appt.id}`)}
                        >
                          {/* Patient Profile */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3">
                              <Avatar
                                name={appt.patient_name}
                                initials={getInitials(appt.patient_name || "", "PT")}
                                size="md"
                                tone="emerald"
                                className="rounded-xl shrink-0"
                              />
                              <div>
                                <span className="font-extrabold text-foreground block hover:text-primary transition-colors">
                                  {appt.patient_name || `Patient #${appt.patient}`}
                                </span>
                                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-mono mt-0.5">
                                  <span>{appt.appointment_id}</span>
                                  {appt.patient_sex && <span>• {appt.patient_sex}</span>}
                                  {appt.patient_age && <span>• {appt.patient_age}</span>}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Practitioner */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2">
                              <Avatar
                                name={appt.practitioner_name}
                                initials={getInitials(appt.practitioner_name || "", "DR")}
                                size="sm"
                                tone="blue"
                                className="rounded-lg shrink-0"
                              />
                              <div>
                                <span className="font-bold text-foreground block">
                                  {appt.practitioner_name || "Unassigned Doctor"}
                                </span>
                                <span className="text-[10px] text-muted-foreground">
                                  {appt.department_name || "General Medicine"}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Date & Time */}
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-foreground flex items-center gap-1.5">
                              <Icon
                                icon="solar:clock-circle-bold"
                                size={13}
                                className="text-indigo-600"
                              />
                              <span className="font-mono text-xs">
                                {formatTime12(appt.appointment_time) || "No time set"}
                              </span>
                            </div>
                            <div className="text-[10px] text-muted-foreground font-mono mt-0.5">
                              {appt.appointment_date}{" "}
                              {appt.duration && `• ${appt.duration} min slot`}
                            </div>
                          </td>

                          {/* Appointment Type */}
                          <td className="py-3.5 px-4">
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px] font-semibold border",
                                getAppointmentTypeBadge(appt.appointment_type_name)
                              )}
                            >
                              {appt.appointment_type_name || "Consultation"}
                            </Badge>
                          </td>

                          {/* Queue Status Badge */}
                          <td className="py-3.5 px-4 text-center">
                            <Badge
                              variant="outline"
                              className={cn("text-[10px] font-bold px-2 py-0.5 gap-1", st.bg)}
                            >
                              <span className={cn("w-1.5 h-1.5 rounded-full", st.dot)} />
                              {appt.status}
                            </Badge>
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 px-4 text-right">
                            <div
                              className="flex items-center justify-end gap-1"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {/* Direct Start Clinical Encounter Action */}
                              {(appt.status === "Checked In" || appt.status === "Confirmed") && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    navigate(
                                      `/healthcare/encounters/new?appointment=${appt.id}&patient=${appt.patient}&practitioner=${appt.practitioner || ""}`
                                    )
                                  }
                                  className="h-7 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/10 gap-1 px-2"
                                  title="Start Clinical Consultation Encounter"
                                >
                                  <Icon icon="solar:stethoscope-bold" size={13} />
                                  Consult
                                </Button>
                              )}

                              {/* Status Action Buttons */}
                              {actions.map((act) => (
                                <Button
                                  key={act.action}
                                  size="sm"
                                  variant="ghost"
                                  onClick={() =>
                                    setActionConfirm({
                                      id: appt.id,
                                      action: act.action,
                                      label: act.label,
                                      patientName: appt.patient_name,
                                    })
                                  }
                                  className={cn("h-7 px-2 text-[11px] font-semibold gap-1", act.color)}
                                  title={act.label}
                                >
                                  <Icon icon={act.icon} size={13} />
                                  <span className="hidden sm:inline">{act.label}</span>
                                </Button>
                              ))}

                              {/* Print Slip Modal Trigger */}
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => setSelectedSlipAppt(appt)}
                                className="h-7 w-7 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-500/10"
                                title="Print Appointment Slip"
                              >
                                <Icon icon="solar:printer-bold" size={14} />
                              </Button>

                              {/* View Details */}
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => navigate(`/healthcare/appointments/${appt.id}`)}
                                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                title="View Appointment Details"
                              >
                                <Icon icon="solar:eye-bold" size={14} />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination Bar */}
              {filteredAppointments.length > pageSize && (
                <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/20 text-xs">
                  <span className="text-muted-foreground">
                    Showing {(page - 1) * pageSize + 1} to{" "}
                    {Math.min(page * pageSize, filteredAppointments.length)} of{" "}
                    {filteredAppointments.length} appointments
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page === 1}
                      onClick={() => setPage(page - 1)}
                      className="h-8 text-xs"
                    >
                      Previous
                    </Button>
                    <span className="px-2 font-mono font-bold text-foreground">
                      Page {page} of {Math.ceil(filteredAppointments.length / pageSize)}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= Math.ceil(filteredAppointments.length / pageSize)}
                      onClick={() => setPage(page + 1)}
                      className="h-8 text-xs"
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          )}

          {/* ════════ VIEW 2: CLINICAL FLOW / KANBAN QUEUE BOARD ════════ */}
          {viewMode === "kanban" && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
              {[
                { stage: "Scheduled", title: "Scheduled & Open", icon: "solar:clock-circle-bold", headerColor: "text-blue-600 bg-blue-500/10" },
                { stage: "Confirmed", title: "Confirmed for Today", icon: "solar:check-circle-bold", headerColor: "text-indigo-600 bg-indigo-500/10" },
                { stage: "Checked In", title: "Waiting Room (Arrived)", icon: "solar:login-bold", headerColor: "text-emerald-600 bg-emerald-500/15" },
                { stage: "Checked Out", title: "Completed / Consulted", icon: "solar:check-read-bold", headerColor: "text-purple-600 bg-purple-500/10" },
              ].map((col) => {
                const stageAppts = filteredAppointments.filter((a) => {
                  if (col.stage === "Scheduled") return a.status === "Scheduled" || a.status === "Open";
                  if (col.stage === "Checked Out") return a.status === "Checked Out" || a.status === "Closed";
                  return a.status === col.stage;
                });

                return (
                  <div key={col.stage} className="space-y-3">
                    <div className="p-3 rounded-xl border bg-card shadow-xs flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={cn("p-1.5 rounded-lg", col.headerColor)}>
                          <Icon icon={col.icon} size={15} />
                        </div>
                        <span className="font-extrabold text-xs text-foreground">{col.title}</span>
                      </div>
                      <Badge variant="outline" className="font-mono text-xs font-bold">
                        {stageAppts.length}
                      </Badge>
                    </div>

                    <div className="space-y-2.5">
                      {stageAppts.length === 0 ? (
                        <div className="p-6 rounded-xl border border-dashed text-center text-xs text-muted-foreground">
                          No patients in this stage
                        </div>
                      ) : (
                        stageAppts.map((appt) => (
                          <Card
                            key={appt.id}
                            onClick={() => navigate(`/healthcare/appointments/${appt.id}`)}
                            className="shadow-xs border-border hover:shadow-md hover:border-primary/50 transition-all cursor-pointer space-y-2.5 p-3.5"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-mono text-[10px] text-muted-foreground">
                                {appt.appointment_id}
                              </span>
                              <div className="flex items-center gap-1">
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "text-[9px] px-1.5 py-0",
                                    getAppointmentTypeBadge(appt.appointment_type_name)
                                  )}
                                >
                                  {appt.appointment_type_name || "Consult"}
                                </Badge>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedSlipAppt(appt);
                                  }}
                                  className="text-muted-foreground hover:text-indigo-600 p-0.5 rounded transition-colors"
                                  title="Print Slip"
                                >
                                  <Icon icon="solar:printer-bold" size={13} />
                                </button>
                              </div>
                            </div>

                            {/* Patient info */}
                            <div className="flex items-center gap-2.5">
                              <Avatar
                                name={appt.patient_name}
                                initials={getInitials(appt.patient_name || "", "PT")}
                                size="sm"
                                tone="emerald"
                                className="rounded-lg shrink-0"
                              />
                              <div className="min-w-0 flex-1">
                                <h4 className="font-extrabold text-xs text-foreground truncate">
                                  {appt.patient_name}
                                </h4>
                                <p className="text-[10px] text-muted-foreground truncate">
                                  {appt.patient_sex} {appt.patient_age && `• ${appt.patient_age}`}
                                </p>
                              </div>
                            </div>

                            {/* Doctor info */}
                            <div className="p-2 rounded-lg bg-muted/40 border border-border/50 text-[11px] flex items-center justify-between">
                              <span className="font-medium text-foreground truncate">
                                {appt.practitioner_name || "Doctor"}
                              </span>
                              <span className="font-mono font-bold text-primary shrink-0 ml-1">
                                {formatTime12(appt.appointment_time)}
                              </span>
                            </div>

                            {/* Workflow Trigger Buttons */}
                            <div
                              className="flex items-center justify-between pt-1 border-t border-border/50"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {appt.status === "Scheduled" && (
                                <Button
                                  size="sm"
                                  onClick={() =>
                                    setActionConfirm({
                                      id: appt.id,
                                      action: "confirm",
                                      label: "Confirm Appointment",
                                      patientName: appt.patient_name,
                                    })
                                  }
                                  className="w-full h-7 text-[10px] font-bold bg-indigo-600 hover:bg-indigo-700 text-white"
                                >
                                  Confirm Attendance
                                </Button>
                              )}

                              {appt.status === "Confirmed" && (
                                <Button
                                  size="sm"
                                  onClick={() =>
                                    setActionConfirm({
                                      id: appt.id,
                                      action: "check_in",
                                      label: "Check In Patient",
                                      patientName: appt.patient_name,
                                    })
                                  }
                                  className="w-full h-7 text-[10px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
                                >
                                  Check In Patient
                                </Button>
                              )}

                              {appt.status === "Checked In" && (
                                <div className="grid grid-cols-2 gap-1.5 w-full">
                                  <Button
                                    size="sm"
                                    onClick={() =>
                                      navigate(
                                        `/healthcare/encounters/new?appointment=${appt.id}&patient=${appt.patient}&practitioner=${appt.practitioner || ""}`
                                      )
                                    }
                                    className="h-7 text-[10px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
                                  >
                                    Start Consult
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                      setActionConfirm({
                                        id: appt.id,
                                        action: "check_out",
                                        label: "Check Out Patient",
                                        patientName: appt.patient_name,
                                      })
                                    }
                                    className="h-7 text-[10px] font-semibold"
                                  >
                                    Check Out
                                  </Button>
                                </div>
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

          {/* ════════ VIEW 3: TIME BLOCKS (HOURLY MATRIX) ════════ */}
          {viewMode === "blocks" && (
            <div className="space-y-6">
              {[
                { label: "Morning Session (08:00 - 12:00)", filter: (t: string) => t >= "08:00" && t < "12:00", icon: "solar:sun-2-bold" },
                { label: "Afternoon Session (12:00 - 16:00)", filter: (t: string) => t >= "12:00" && t < "16:00", icon: "solar:sun-fog-bold" },
                { label: "Evening Clinic (16:00 - 21:00)", filter: (t: string) => t >= "16:00" && t <= "21:00", icon: "solar:moon-bold" },
              ].map((session) => {
                const sessionAppts = filteredAppointments.filter((a) =>
                  session.filter(a.appointment_time || "00:00")
                );

                return (
                  <Card key={session.label} className="shadow-xs border-border">
                    <CardHeader className="p-4 border-b bg-muted/20">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Icon icon={session.icon} size={18} className="text-amber-500" />
                          <CardTitle className="text-sm font-bold text-foreground">
                            {session.label}
                          </CardTitle>
                        </div>
                        <Badge variant="outline" className="font-mono text-xs">
                          {sessionAppts.length} appointments
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="p-4">
                      {sessionAppts.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-4">
                          No appointments scheduled in this time window
                        </p>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {sessionAppts.map((appt) => (
                            <div
                              key={appt.id}
                              onClick={() => navigate(`/healthcare/appointments/${appt.id}`)}
                              className="p-3 rounded-xl border bg-card hover:border-primary/50 transition-all cursor-pointer space-y-1.5"
                            >
                              <div className="flex items-center justify-between text-xs">
                                <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                                  {formatTime12(appt.appointment_time)}
                                </span>
                                <div className="flex items-center gap-1">
                                  <Badge
                                    variant="outline"
                                    className={cn("text-[9px] px-1.5 py-0", STATUS_CONFIG[appt.status]?.bg)}
                                  >
                                    {appt.status}
                                  </Badge>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedSlipAppt(appt);
                                    }}
                                    className="text-muted-foreground hover:text-indigo-600 p-0.5 rounded transition-colors"
                                    title="Print Slip"
                                  >
                                    <Icon icon="solar:printer-bold" size={12} />
                                  </button>
                                </div>
                              </div>
                              <div className="font-bold text-xs text-foreground truncate">
                                {appt.patient_name}
                              </div>
                              <div className="text-[11px] text-muted-foreground truncate">
                                with {appt.practitioner_name}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ─── Fast-Book Quick Appointment Modal ─── */}
      <Dialog open={showQuickBook} onOpenChange={setShowQuickBook}>
        <DialogContent className="max-w-lg p-6 rounded-2xl">
          <DialogHeader className="border-b pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600">
                <Icon icon="solar:calendar-add-bold" size={20} />
              </div>
              <div>
                <DialogTitle className="text-base font-extrabold text-foreground">
                  Quick Book Appointment
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Fast patient appointment scheduling with live slot allocation
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            {/* Patient Selector */}
            <div>
              <Label className="text-xs font-semibold text-foreground">
                Patient <span className="text-destructive">*</span>
              </Label>
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
                  value={quickForm.patient}
                  onChange={(v) => setQuickForm({ ...quickForm, patient: v })}
                  placeholder="Search and select patient..."
                  emptyText="No patients found"
                  tone="emerald"
                />
              </div>
            </div>

            {/* Practitioner Selector */}
            <div>
              <Label className="text-xs font-semibold text-foreground">
                Healthcare Practitioner <span className="text-destructive">*</span>
              </Label>
              <div className="mt-1">
                <EntitySelect
                  doctype="Healthcare Practitioner"
                  rawItems={practitioners}
                  options={practitioners.map((p) => ({
                    value: p.id,
                    label: p.practitioner_name,
                    sublabel: p.designation || p.department_name,
                    image: p.image,
                  }))}
                  value={quickForm.practitioner}
                  onChange={(v) => setQuickForm({ ...quickForm, practitioner: v })}
                  placeholder="Search and select doctor..."
                  emptyText="No doctors found"
                  tone="blue"
                />
              </div>
            </div>

            {/* Date & Time */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-foreground">Appointment Date</Label>
                <Input
                  type="date"
                  value={quickForm.appointment_date}
                  onChange={(e) => setQuickForm({ ...quickForm, appointment_date: e.target.value })}
                  className="mt-1 h-9 text-xs"
                />
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-foreground">Time Slot</Label>
                  <span className="text-[10px] font-mono font-bold text-indigo-600">
                    {formatTime12(quickForm.appointment_time)}
                  </span>
                </div>
                <Input
                  type="time"
                  value={quickForm.appointment_time}
                  onChange={(e) => setQuickForm({ ...quickForm, appointment_time: e.target.value })}
                  className="mt-1 h-9 text-xs font-mono font-bold"
                />
              </div>
            </div>

            {/* 1-Click Time Presets */}
            <div>
              <span className="text-[10px] font-bold text-muted-foreground block mb-1">
                Fast Pick Slot:
              </span>
              <div className="flex items-center gap-1.5 flex-wrap">
                {TIME_SLOT_PRESETS.slice(0, 8).map((slot) => (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => setQuickForm({ ...quickForm, appointment_time: slot })}
                    className={cn(
                      "px-2 py-0.5 rounded text-[10px] font-mono border transition-all",
                      quickForm.appointment_time === slot
                        ? "bg-indigo-600 text-white border-indigo-600 font-bold"
                        : "bg-muted/40 text-muted-foreground hover:bg-muted"
                    )}
                  >
                    {slot}
                  </button>
                ))}
              </div>
            </div>

            {/* Type & Duration */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-muted-foreground">Encounter Type</Label>
                <select
                  className="mt-1 w-full h-9 border border-input rounded-md px-2.5 text-xs bg-background font-semibold"
                  value={quickForm.appointment_type}
                  onChange={(e) => setQuickForm({ ...quickForm, appointment_type: e.target.value })}
                >
                  <option value="Consultation">Consultation</option>
                  <option value="Follow Up">Follow Up</option>
                  <option value="Routine Checkup">Routine Checkup</option>
                  <option value="Procedure">Procedure</option>
                  <option value="Lab Review">Lab Review</option>
                </select>
              </div>

              <div>
                <Label className="text-xs font-semibold text-muted-foreground">Duration (Minutes)</Label>
                <select
                  className="mt-1 w-full h-9 border border-input rounded-md px-2.5 text-xs bg-background font-semibold"
                  value={quickForm.duration}
                  onChange={(e) => setQuickForm({ ...quickForm, duration: parseInt(e.target.value) || 30 })}
                >
                  <option value={15}>15 Minutes</option>
                  <option value={20}>20 Minutes</option>
                  <option value={30}>30 Minutes</option>
                  <option value={45}>45 Minutes</option>
                  <option value={60}>60 Minutes</option>
                </select>
              </div>
            </div>

            {/* Notes / Reason for Visit */}
            <div>
              <Label className="text-xs font-semibold text-muted-foreground">
                Chief Complaint / Reason for Visit
              </Label>
              <Input
                placeholder="Brief symptoms or consultation goal..."
                value={quickForm.notes}
                onChange={(e) => setQuickForm({ ...quickForm, notes: e.target.value })}
                className="mt-1 h-9 text-xs"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowQuickBook(false)}
              className="text-xs h-9"
            >
              Cancel
            </Button>
            <Button
              onClick={handleQuickBook}
              disabled={booking || !quickForm.patient || !quickForm.practitioner}
              className="text-xs h-9 font-semibold gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs px-5"
            >
              {booking ? "Booking..." : "Confirm & Book Visit"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── In-App Workflow Status Confirmation Dialog ─── */}
      {actionConfirm && (
        <Dialog open={Boolean(actionConfirm)} onOpenChange={() => setActionConfirm(null)}>
          <DialogContent className="max-w-sm p-5 rounded-2xl">
            <DialogHeader>
              <DialogTitle className="text-base font-bold">
                {actionConfirm.label} Appointment?
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground pt-1">
                Are you sure you want to {actionConfirm.label.toLowerCase()} the appointment for{" "}
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
                onClick={executeStatusAction}
                className="h-8 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                Yes, {actionConfirm.label}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* ─── Printable Hospital Appointment Slip Modal ─── */}
      <Dialog open={Boolean(selectedSlipAppt)} onOpenChange={() => setSelectedSlipAppt(null)}>
        <DialogContent className="sm:max-w-md p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Icon icon="solar:ticket-bold" className="text-indigo-600" size={18} />
              Hospital Appointment Ticket
            </DialogTitle>
            <DialogDescription className="text-xs">
              Printable patient consultation admission slip
            </DialogDescription>
          </DialogHeader>

          {selectedSlipAppt && (
            <div id="printable-slip" className="border-2 border-dashed rounded-xl p-5 bg-card space-y-4 my-2">
              <div className="text-center pb-3 border-b space-y-1">
                <div className="font-black text-sm uppercase tracking-wider text-foreground">
                  Healthcare Center & Clinical Suites
                </div>
                <div className="text-[11px] text-muted-foreground">
                  Outpatient Department Consultation Ticket
                </div>
              </div>

              <div className="text-center py-1">
                <div className="text-3xl font-black text-indigo-600 font-mono tracking-tight">
                  {selectedSlipAppt.appointment_id || "APP-TOKEN"}
                </div>
                <Badge variant="outline" className="mt-1 font-bold text-xs bg-emerald-500/10 text-emerald-700 border-emerald-500/30">
                  {selectedSlipAppt.status || "Scheduled"}
                </Badge>
              </div>

              <div className="space-y-2 text-xs border-t border-b py-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Patient:</span>
                  <span className="font-bold text-foreground">{selectedSlipAppt.patient_name || "N/A"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Doctor:</span>
                  <span className="font-bold text-foreground">{selectedSlipAppt.practitioner_name || "General Practitioner"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Department:</span>
                  <span className="font-medium text-foreground">{selectedSlipAppt.department_name || "General Clinic"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Date & Time:</span>
                  <span className="font-bold text-indigo-600 font-mono">
                    {selectedSlipAppt.appointment_date} at {formatTime12(selectedSlipAppt.appointment_time)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Duration:</span>
                  <span className="font-medium text-foreground">{selectedSlipAppt.duration || 30} minutes</span>
                </div>
              </div>

              <div className="text-center pt-1">
                <div className="h-8 bg-muted/60 rounded flex items-center justify-center font-mono tracking-widest text-xs text-muted-foreground select-none">
                  |||| | |||||| | ||||| |||| | ||||
                </div>
                <div className="text-[10px] text-muted-foreground mt-1">
                  Please present this ticket at reception & nursing triage.
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setSelectedSlipAppt(null)}>
              Close
            </Button>
            <Button
              size="sm"
              onClick={() => window.print()}
              className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 font-bold"
            >
              <Icon icon="solar:printer-bold" size={14} />
              <span>Print Slip</span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Printable Daily Patient Queue Sheet Modal ─── */}
      <Dialog open={showPrintQueue} onOpenChange={setShowPrintQueue}>
        <DialogContent className="sm:max-w-2xl p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Icon icon="solar:printer-bold" className="text-indigo-600" size={18} />
              Daily Patient Queue Roster Sheet
            </DialogTitle>
            <DialogDescription className="text-xs">
              Printable active appointments list for clinic reception & nursing station
            </DialogDescription>
          </DialogHeader>

          <div className="border rounded-xl p-4 bg-card space-y-3 my-2 max-h-[60vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b">
              <div>
                <h4 className="font-black text-sm text-foreground">Outpatient Queue Schedule</h4>
                <p className="text-xs text-muted-foreground">
                  Date: <strong>{specificDate || (datePreset === "today" ? todayStr : "All Dates")}</strong> • Total Patients: {filteredAppointments.length}
                </p>
              </div>
              <Badge variant="outline" className="font-mono text-xs">
                {new Date().toLocaleDateString()}
              </Badge>
            </div>

            <table className="w-full text-xs text-left">
              <thead className="bg-muted/40 border-b text-muted-foreground uppercase text-[10px] font-bold">
                <tr>
                  <th className="py-2 px-2">Time</th>
                  <th className="py-2 px-2">Patient</th>
                  <th className="py-2 px-2">Doctor</th>
                  <th className="py-2 px-2">Type</th>
                  <th className="py-2 px-2 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredAppointments.map((a, idx) => (
                  <tr key={a.id || idx}>
                    <td className="py-2 px-2 font-mono font-bold text-indigo-600">
                      {formatTime12(a.appointment_time)}
                    </td>
                    <td className="py-2 px-2 font-bold text-foreground">
                      {a.patient_name}
                      {a.patient_sex && <span className="text-[10px] text-muted-foreground ml-1 font-normal">({a.patient_sex})</span>}
                    </td>
                    <td className="py-2 px-2 text-muted-foreground">{a.practitioner_name}</td>
                    <td className="py-2 px-2 text-muted-foreground">{a.appointment_type_name || "Consult"}</td>
                    <td className="py-2 px-2 text-right">
                      <span className="font-bold text-[11px]">{a.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setShowPrintQueue(false)}>
              Close
            </Button>
            <Button
              size="sm"
              onClick={() => window.print()}
              className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 font-bold"
            >
              <Icon icon="solar:printer-bold" size={14} />
              <span>Print Queue Sheet</span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
