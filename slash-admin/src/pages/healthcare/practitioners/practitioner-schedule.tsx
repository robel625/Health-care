import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router";
import { Icon } from "@/components/icon";
import { Button } from "@/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/ui/card";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { Badge } from "@/ui/badge";
import { Separator } from "@/ui/separator";
import Avatar from "@/components/Avatar";
import { HealthcareApi } from "@/api/services/healthcareService";
import type {
  PractitionerSchedule,
  HealthcarePractitioner,
} from "@/api/services/healthcareService";
import { formatTime12, formatTimeRange12 } from "@/utils/timeFormat";
import { cn, getInitials } from "@/utils";
import { toast } from "sonner";

const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const DAY_ABBR: Record<string, string> = {
  Monday: "Mon",
  Tuesday: "Tue",
  Wednesday: "Wed",
  Thursday: "Thu",
  Friday: "Fri",
  Saturday: "Sat",
  Sunday: "Sun",
};

// Department styling utility matching directory page
function getDepartmentStyle(deptName?: string) {
  const name = (deptName || "").toLowerCase();
  if (name.includes("cardio")) {
    return {
      bg: "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30",
      icon: "solar:heart-pulse-bold",
    };
  }
  if (name.includes("pediatr") || name.includes("child")) {
    return {
      bg: "bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/30",
      icon: "solar:user-bold",
    };
  }
  if (name.includes("surg") || name.includes("operat")) {
    return {
      bg: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30",
      icon: "solar:medical-kit-bold",
    };
  }
  if (name.includes("physio") || name.includes("rehab")) {
    return {
      bg: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
      icon: "solar:accessibility-bold",
    };
  }
  if (name.includes("neuro") || name.includes("psych")) {
    return {
      bg: "bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-500/30",
      icon: "solar:atom-bold",
    };
  }
  return {
    bg: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30",
    icon: "solar:stethoscope-bold",
  };
}

// Quick shift time presets for 1-click slot creation
const SHIFT_PRESETS = [
  { label: "Morning Clinic", start: "08:00", end: "12:00", icon: "solar:sun-2-bold" },
  { label: "Afternoon Shift", start: "13:00", end: "17:00", icon: "solar:sun-fog-bold" },
  { label: "Standard Full Day", start: "09:00", end: "17:00", icon: "solar:clock-circle-bold" },
  { label: "Evening Clinic", start: "17:00", end: "21:00", icon: "solar:moon-bold" },
];

function calculateDurationHours(start?: string, end?: string): number {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const sMin = sh * 60 + (sm || 0);
  const eMin = eh * 60 + (em || 0);
  if (eMin <= sMin) return 0;
  return Number(((eMin - sMin) / 60).toFixed(1));
}

interface SlotForm {
  practitioner: number | null;
  day: string;
  selectedDays?: string[]; // For multi-day quick apply
  start_time: string;
  end_time: string;
  max_appointments: number;
  is_active: boolean;
}

const emptyForm: SlotForm = {
  practitioner: null,
  day: "Monday",
  selectedDays: ["Monday"],
  start_time: "09:00",
  end_time: "17:00",
  max_appointments: 20,
  is_active: true,
};

export default function PractitionerSchedulePage() {
  const navigate = useNavigate();

  // Primary State
  const [schedules, setSchedules] = useState<PractitionerSchedule[]>([]);
  const [practitioners, setPractitioners] = useState<HealthcarePractitioner[]>([]);
  const [loading, setLoading] = useState(false);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [filterPractitioner, setFilterPractitioner] = useState<number | "">("");
  const [filterDay, setFilterDay] = useState<string>("All");
  const [filterStatus, setFilterStatus] = useState<"All" | "Active" | "Paused">("All");

  // View Mode: "roster" (grouped by doctor) | "daily" (grouped by day) | "table" (compact master list)
  const [viewMode, setViewMode] = useState<"roster" | "daily" | "table">("roster");

  // Modals
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<PractitionerSchedule | null>(null);
  const [form, setForm] = useState<SlotForm>({ ...emptyForm });
  const [savingSlot, setSavingSlot] = useState(false);

  // Bulk Generator Wizard Dialog
  const [showRosterWizard, setShowRosterWizard] = useState(false);
  const [wizardForm, setWizardForm] = useState({
    practitioner: null as number | null,
    days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
    start_time: "09:00",
    end_time: "17:00",
    max_appointments: 20,
  });
  const [generatingWizard, setGeneratingWizard] = useState(false);

  // Bulk Copy Dialog
  const [showCopy, setShowCopy] = useState(false);
  const [copyFrom, setCopyFrom] = useState("Monday");
  const [copyTo, setCopyTo] = useState("Tuesday");
  const [copyPractitioner, setCopyPractitioner] = useState<number | "">("");
  const [copyingSlots, setCopyingSlots] = useState(false);

  // Delete Confirmation State
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Load Data
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [schedRes, pracRes] = await Promise.all([
        HealthcareApi.practitionerSchedules.list({ page_size: 500 }),
        HealthcareApi.practitioners.list({ page_size: 200 }),
      ]);
      setSchedules((schedRes as any).results || []);
      setPractitioners((pracRes as any).results || []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load practitioner schedules");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Practitioner Lookup Map
  const pracMap = useMemo(() => {
    return Object.fromEntries(practitioners.map((p) => [p.id, p]));
  }, [practitioners]);

  // Filtered Schedules
  const filteredSchedules = useMemo(() => {
    return schedules.filter((s) => {
      // Practitioner filter
      if (filterPractitioner && s.practitioner !== filterPractitioner) {
        return false;
      }

      // Day filter
      if (filterDay !== "All") {
        if (filterDay === "Weekdays" && (s.day === "Saturday" || s.day === "Sunday")) {
          return false;
        }
        if (filterDay === "Weekends" && s.day !== "Saturday" && s.day !== "Sunday") {
          return false;
        }
        if (filterDay !== "Weekdays" && filterDay !== "Weekends" && s.day !== filterDay) {
          return false;
        }
      }

      // Status filter
      if (filterStatus === "Active" && !s.is_active) return false;
      if (filterStatus === "Paused" && s.is_active) return false;

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const prac = pracMap[s.practitioner];
        const matchName = (prac?.practitioner_name || "").toLowerCase().includes(q);
        const matchDept = (prac?.department_name || "").toLowerCase().includes(q);
        const matchDesig = (prac?.designation || "").toLowerCase().includes(q);
        const matchDay = s.day.toLowerCase().includes(q);
        if (!matchName && !matchDept && !matchDesig && !matchDay) {
          return false;
        }
      }

      return true;
    });
  }, [schedules, filterPractitioner, filterDay, filterStatus, searchQuery, pracMap]);

  // Executive KPI Analytics
  const stats = useMemo(() => {
    const totalSlots = schedules.length;
    const activeSlots = schedules.filter((s) => s.is_active).length;
    const totalCapacity = schedules
      .filter((s) => s.is_active)
      .reduce((sum, s) => sum + (s.max_appointments || 0), 0);

    const scheduledPracIds = new Set(schedules.map((s) => s.practitioner));
    const totalDoctors = practitioners.length;
    const scheduledDoctors = scheduledPracIds.size;

    // Calculate total hours
    const totalHours = schedules
      .filter((s) => s.is_active)
      .reduce((sum, s) => sum + calculateDurationHours(s.start_time, s.end_time), 0);

    // Find peak day
    const dayCounts: Record<string, number> = {};
    for (const s of schedules) {
      if (s.is_active) {
        dayCounts[s.day] = (dayCounts[s.day] || 0) + 1;
      }
    }
    let peakDay = "None";
    let peakCount = 0;
    for (const [day, count] of Object.entries(dayCounts)) {
      if (count > peakCount) {
        peakCount = count;
        peakDay = day;
      }
    }

    return {
      totalSlots,
      activeSlots,
      activePercent: totalSlots > 0 ? Math.round((activeSlots / totalSlots) * 100) : 0,
      totalCapacity,
      scheduledDoctors,
      totalDoctors,
      doctorCoveragePercent:
        totalDoctors > 0 ? Math.round((scheduledDoctors / totalDoctors) * 100) : 0,
      totalHours: Math.round(totalHours),
      peakDay,
      peakCount,
    };
  }, [schedules, practitioners]);

  // Grouped by practitioner
  const groupedByPractitioner = useMemo(() => {
    const grouped: Record<number, Record<string, PractitionerSchedule[]>> = {};

    for (const s of filteredSchedules) {
      if (!grouped[s.practitioner]) grouped[s.practitioner] = {};
      if (!grouped[s.practitioner][s.day]) grouped[s.practitioner][s.day] = [];
      grouped[s.practitioner][s.day].push(s);
    }

    return grouped;
  }, [filteredSchedules]);

  // Grouped by day
  const groupedByDay = useMemo(() => {
    const grouped: Record<string, PractitionerSchedule[]> = {};
    for (const d of DAYS) grouped[d] = [];
    for (const s of filteredSchedules) {
      if (grouped[s.day]) {
        grouped[s.day].push(s);
      }
    }
    return grouped;
  }, [filteredSchedules]);

  // Add / Edit Slot Save Handler
  const handleSaveSlot = async () => {
    if (!form.practitioner) {
      toast.error("Please select a healthcare practitioner");
      return;
    }
    if (!form.start_time || !form.end_time) {
      toast.error("Please specify both shift start and end times");
      return;
    }
    if (form.end_time <= form.start_time) {
      toast.error("End time must be after start time");
      return;
    }

    setSavingSlot(true);
    try {
      if (editItem) {
        // Updating existing single slot
        await HealthcareApi.practitionerSchedules.update(editItem.id, {
          practitioner: form.practitioner,
          day: form.day,
          start_time: form.start_time.length === 5 ? `${form.start_time}:00` : form.start_time,
          end_time: form.end_time.length === 5 ? `${form.end_time}:00` : form.end_time,
          max_appointments: form.max_appointments,
          is_active: form.is_active,
        });
        toast.success("Schedule slot updated successfully");
      } else {
        // Creating new slot(s) for all selected days
        const daysToCreate =
          form.selectedDays && form.selectedDays.length > 0
            ? form.selectedDays
            : [form.day];

        const promises = daysToCreate.map((d) =>
          HealthcareApi.practitionerSchedules.create({
            practitioner: form.practitioner!,
            day: d,
            start_time: form.start_time.length === 5 ? `${form.start_time}:00` : form.start_time,
            end_time: form.end_time.length === 5 ? `${form.end_time}:00` : form.end_time,
            max_appointments: form.max_appointments,
            is_active: form.is_active,
          })
        );

        await Promise.all(promises);
        toast.success(
          `Created ${daysToCreate.length} schedule slot(s) for ${
            pracMap[form.practitioner!]?.practitioner_name || "Practitioner"
          }`
        );
      }

      setShowForm(false);
      setEditItem(null);
      setForm({ ...emptyForm });
      loadData();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Failed to save schedule slot");
    } finally {
      setSavingSlot(false);
    }
  };

  // Toggle Active State
  const handleToggle = async (item: PractitionerSchedule) => {
    try {
      await HealthcareApi.practitionerSchedules.update(item.id, {
        is_active: !item.is_active,
      } as any);
      toast.success(
        `${item.day} ${formatTime12(item.start_time)} slot ${
          !item.is_active ? "activated" : "paused"
        }`
      );
      loadData();
    } catch (err) {
      console.error(err);
      toast.error("Failed to update status");
    }
  };

  // Delete Handler
  const handleDeleteSlot = async (id: number) => {
    try {
      await HealthcareApi.practitionerSchedules.delete(id);
      toast.success("Schedule slot deleted");
      setDeletingId(null);
      loadData();
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete time slot");
    }
  };

  // Open Edit Modal
  const openEdit = (item: PractitionerSchedule) => {
    setEditItem(item);
    setForm({
      practitioner: item.practitioner,
      day: item.day,
      selectedDays: [item.day],
      start_time: item.start_time?.slice(0, 5) || "09:00",
      end_time: item.end_time?.slice(0, 5) || "17:00",
      max_appointments: item.max_appointments,
      is_active: item.is_active,
    });
    setShowForm(true);
  };

  // Open New Modal
  const openNew = (day?: string, practitionerId?: number) => {
    setEditItem(null);
    setForm({
      ...emptyForm,
      day: day || "Monday",
      selectedDays: day ? [day] : ["Monday"],
      practitioner: practitionerId || (filterPractitioner ? Number(filterPractitioner) : null),
    });
    setShowForm(true);
  };

  // Fast Full-Week Roster Generator
  const handleGenerateRoster = async () => {
    if (!wizardForm.practitioner) {
      toast.error("Please select a practitioner");
      return;
    }
    if (wizardForm.days.length === 0) {
      toast.error("Please select at least one day");
      return;
    }

    setGeneratingWizard(true);
    try {
      let created = 0;
      for (const d of wizardForm.days) {
        await HealthcareApi.practitionerSchedules.create({
          practitioner: wizardForm.practitioner,
          day: d,
          start_time: `${wizardForm.start_time}:00`,
          end_time: `${wizardForm.end_time}:00`,
          max_appointments: wizardForm.max_appointments,
          is_active: true,
        });
        created++;
      }

      toast.success(
        `Generated ${created} weekly shift slots for ${
          pracMap[wizardForm.practitioner]?.practitioner_name || "Doctor"
        }!`
      );
      setShowRosterWizard(false);
      loadData();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Failed to generate weekly roster");
    } finally {
      setGeneratingWizard(false);
    }
  };

  // Copy Day Schedule Handler
  const handleCopyDay = async () => {
    setCopyingSlots(true);
    try {
      const slotsToCopy = schedules.filter(
        (s) =>
          s.day === copyFrom &&
          s.is_active &&
          (!copyPractitioner || s.practitioner === Number(copyPractitioner))
      );

      if (slotsToCopy.length === 0) {
        toast.error(`No active slots found on ${copyFrom} to copy`);
        setCopyingSlots(false);
        return;
      }

      let created = 0;
      for (const slot of slotsToCopy) {
        const exists = schedules.some(
          (s) =>
            s.practitioner === slot.practitioner &&
            s.day === copyTo &&
            s.start_time === slot.start_time &&
            s.end_time === slot.end_time
        );

        if (!exists) {
          await HealthcareApi.practitionerSchedules.create({
            practitioner: slot.practitioner,
            day: copyTo,
            start_time: slot.start_time,
            end_time: slot.end_time,
            max_appointments: slot.max_appointments,
            is_active: true,
          });
          created++;
        }
      }

      toast.success(`Copied ${created} slot(s) from ${copyFrom} to ${copyTo}`);
      setShowCopy(false);
      loadData();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Failed to copy schedule");
    } finally {
      setCopyingSlots(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto pb-24 space-y-6">
      {/* ─── Executive Top Command Bar ─── */}
      <div className="rounded-2xl border bg-card/95 backdrop-blur-sm p-5 shadow-xs transition-all">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-500/20">
              <Icon icon="solar:calendar-date-bold" size={26} />
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
                <button
                  type="button"
                  onClick={() => navigate("/healthcare/practitioners")}
                  className="hover:text-foreground transition-colors"
                >
                  Practitioners
                </button>
                <span>/</span>
                <span className="text-foreground font-semibold">Schedules Master</span>
              </div>

              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl font-extrabold tracking-tight text-foreground">
                  Practitioner Schedules & Clinical Roster
                </h1>
                <Badge
                  variant="outline"
                  className="bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30 text-[10px] font-bold px-2 py-0.5"
                >
                  {stats.activeSlots} Active Shifts
                </Badge>
              </div>
            </div>
          </div>

          {/* Quick Command Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowRosterWizard(true)}
              className="h-9 text-xs font-semibold gap-1.5 border-dashed border-purple-500/40 text-purple-600 dark:text-purple-400 hover:bg-purple-500/5"
            >
              <Icon icon="solar:magic-stick-3-bold" size={14} />
              Full-Week Wizard
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCopy(true)}
              className="h-9 text-xs font-semibold gap-1.5"
            >
              <Icon icon="solar:copy-bold" size={14} className="text-muted-foreground" />
              Copy Day Slots
            </Button>

            <Button
              onClick={() => openNew()}
              className="h-9 text-xs font-semibold gap-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-md shadow-purple-500/20 px-4"
            >
              <Icon icon="solar:add-circle-bold" size={16} />
              Add Time Slot
            </Button>
          </div>
        </div>
      </div>

      {/* ─── 4 Executive KPI Scorecards ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Active Slots */}
        <div className="rounded-2xl border bg-card p-4 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between text-muted-foreground mb-1.5">
            <span className="text-xs font-bold uppercase tracking-wider">Weekly Shifts</span>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600">
              <Icon icon="solar:calendar-mark-bold" size={18} />
            </div>
          </div>
          <div className="text-2xl font-black text-foreground">{stats.totalSlots}</div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
            <span className="text-emerald-600 dark:text-emerald-400 font-bold">
              {stats.activeSlots} active
            </span>
            <span>• {stats.activePercent}% operational</span>
          </div>
        </div>

        {/* KPI 2: Total Appointment Capacity */}
        <div className="rounded-2xl border bg-card p-4 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between text-muted-foreground mb-1.5">
            <span className="text-xs font-bold uppercase tracking-wider">Weekly Capacity</span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600">
              <Icon icon="solar:users-group-rounded-bold" size={18} />
            </div>
          </div>
          <div className="text-2xl font-black text-foreground">
            {stats.totalCapacity.toLocaleString()}
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
            <span>Max patient visits per week</span>
          </div>
        </div>

        {/* KPI 3: Clinicians Covered */}
        <div className="rounded-2xl border bg-card p-4 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between text-muted-foreground mb-1.5">
            <span className="text-xs font-bold uppercase tracking-wider">Doctors Roster</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600">
              <Icon icon="solar:user-check-bold" size={18} />
            </div>
          </div>
          <div className="text-2xl font-black text-foreground">
            {stats.scheduledDoctors}{" "}
            <span className="text-xs text-muted-foreground font-normal">
              / {stats.totalDoctors}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
            <span className="text-emerald-600 font-bold">{stats.doctorCoveragePercent}%</span>
            <span>of physician roster scheduled</span>
          </div>
        </div>

        {/* KPI 4: Peak Clinic Day & Hours */}
        <div className="rounded-2xl border bg-card p-4 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between text-muted-foreground mb-1.5">
            <span className="text-xs font-bold uppercase tracking-wider">Peak Clinic Day</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600">
              <Icon icon="solar:fire-bold" size={18} />
            </div>
          </div>
          <div className="text-2xl font-black text-foreground truncate">
            {stats.peakDay}
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
            <span>{stats.totalHours} total clinical clinic hours</span>
          </div>
        </div>
      </div>

      {/* ─── Search, Day Pills & View Mode Bar ─── */}
      <div className="rounded-2xl border bg-card p-4 shadow-xs space-y-3.5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Icon
              icon="solar:magnifer-bold"
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              placeholder="Search by physician, specialty, or day..."
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
          <div className="w-full md:w-64">
            <select
              className="w-full h-9 border border-input rounded-md px-2.5 text-xs bg-background font-medium"
              value={filterPractitioner}
              onChange={(e) =>
                setFilterPractitioner(e.target.value ? Number(e.target.value) : "")
              }
            >
              <option value="">All Healthcare Practitioners</option>
              {practitioners.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.practitioner_name}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="w-full md:w-36">
            <select
              className="w-full h-9 border border-input rounded-md px-2.5 text-xs bg-background font-medium"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
            >
              <option value="All">All Statuses</option>
              <option value="Active">Active Only</option>
              <option value="Paused">Paused Only</option>
            </select>
          </div>

          {/* View Switcher: Roster vs Daily vs Table */}
          <div className="inline-flex rounded-lg border bg-muted/40 p-0.5 shrink-0">
            <button
              type="button"
              onClick={() => setViewMode("roster")}
              className={cn(
                "px-2.5 py-1 text-xs font-semibold rounded-md transition-all flex items-center gap-1",
                viewMode === "roster"
                  ? "bg-background text-foreground shadow-2xs font-bold"
                  : "text-muted-foreground hover:text-foreground"
              )}
              title="Grouped by Physician Roster"
            >
              <Icon icon="solar:users-group-rounded-bold" size={13} />
              By Doctor
            </button>
            <button
              type="button"
              onClick={() => setViewMode("daily")}
              className={cn(
                "px-2.5 py-1 text-xs font-semibold rounded-md transition-all flex items-center gap-1",
                viewMode === "daily"
                  ? "bg-background text-foreground shadow-2xs font-bold"
                  : "text-muted-foreground hover:text-foreground"
              )}
              title="Grouped by Day of Week"
            >
              <Icon icon="solar:calendar-minimalistic-bold" size={13} />
              By Day
            </button>
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={cn(
                "px-2.5 py-1 text-xs font-semibold rounded-md transition-all flex items-center gap-1",
                viewMode === "table"
                  ? "bg-background text-foreground shadow-2xs font-bold"
                  : "text-muted-foreground hover:text-foreground"
              )}
              title="Compact Master Table"
            >
              <Icon icon="solar:list-bold" size={13} />
              Master List
            </button>
          </div>
        </div>

        {/* Day-of-Week Quick Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-1">
          <span className="text-[10px] uppercase font-bold text-muted-foreground mr-1 shrink-0">
            Day Filter:
          </span>
          {["All", "Weekdays", "Weekends", ...DAYS].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setFilterDay(d)}
              className={cn(
                "px-2.5 py-1 rounded-full text-xs font-medium border transition-all shrink-0",
                filterDay === d
                  ? "bg-primary text-primary-foreground border-primary font-bold shadow-2xs"
                  : "bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground border-border"
              )}
            >
              {d === "Weekdays" ? "Mon - Fri" : d === "Weekends" ? "Sat - Sun" : d}
            </button>
          ))}
        </div>
      </div>

      {/* ─── Main Content Views ─── */}
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-purple-600 border-t-transparent" />
            <span className="text-xs font-semibold text-muted-foreground">
              Loading schedules & rosters...
            </span>
          </div>
        </div>
      ) : filteredSchedules.length === 0 ? (
        <Card className="shadow-xs">
          <CardContent className="py-16 text-center space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-purple-500/10 text-purple-600 flex items-center justify-center mx-auto">
              <Icon icon="solar:calendar-cross-bold" size={28} />
            </div>
            <h3 className="text-base font-bold text-foreground">No Schedule Slots Found</h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              No matching clinical schedule records match your search or filter criteria.
            </p>
            <div className="flex items-center justify-center gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchQuery("");
                  setFilterPractitioner("");
                  setFilterDay("All");
                  setFilterStatus("All");
                }}
                className="text-xs"
              >
                Clear Filters
              </Button>
              <Button
                size="sm"
                onClick={() => openNew()}
                className="text-xs bg-purple-600 hover:bg-purple-700 text-white"
              >
                <Icon icon="solar:add-circle-bold" size={14} className="mr-1" />
                Add First Time Slot
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* ════════ VIEW 1: BY DOCTOR (ROSTER GRID) ════════ */}
          {viewMode === "roster" && (
            <div className="space-y-5">
              {Object.entries(groupedByPractitioner).map(([pracId, dayMap]) => {
                const prac = pracMap[Number(pracId)];
                const deptStyle = getDepartmentStyle(prac?.department_name);

                // Count total slots for this doctor
                const doctorTotalSlots = Object.values(dayMap).flat().length;
                const doctorTotalHours = Object.values(dayMap)
                  .flat()
                  .reduce((sum, s) => sum + calculateDurationHours(s.start_time, s.end_time), 0);

                return (
                  <Card key={pracId} className="shadow-xs border-border overflow-hidden">
                    <CardHeader className="pb-3 border-b bg-muted/20">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <Avatar
                            name={prac?.practitioner_name}
                            initials={getInitials(prac?.practitioner_name || "", "DR")}
                            src={prac?.image}
                            size="lg"
                            tone="blue"
                            className="rounded-xl shrink-0"
                          />
                          <div>
                            <div className="flex items-center gap-2">
                              <h3
                                onClick={() => navigate(`/healthcare/practitioners/${pracId}`)}
                                className="font-extrabold text-sm text-foreground hover:text-primary transition-colors cursor-pointer"
                              >
                                {prac?.practitioner_name || `Practitioner #${pracId}`}
                              </h3>
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-[10px] font-bold px-2 py-0 border",
                                  deptStyle.bg
                                )}
                              >
                                <Icon icon={deptStyle.icon} size={11} className="mr-1 inline" />
                                {prac?.department_name || "General Medicine"}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {prac?.designation || "Healthcare Provider"} •{" "}
                              <span className="font-semibold text-foreground">
                                {doctorTotalSlots} shift slots
                              </span>{" "}
                              ({doctorTotalHours.toFixed(1)} hrs/wk)
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 flex-wrap">
                          {DAYS.map((day) => {
                            const daySlots = dayMap[day] || [];
                            const activeCount = daySlots.filter((s) => s.is_active).length;
                            return (
                              <button
                                key={day}
                                type="button"
                                onClick={() => openNew(day, Number(pracId))}
                                className={cn(
                                  "px-2 py-1 rounded-md text-[11px] font-semibold border transition-all text-center",
                                  activeCount > 0
                                    ? "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30 font-bold"
                                    : "bg-muted/40 text-muted-foreground border-border/70 hover:bg-muted"
                                )}
                                title={`Click to add slot for ${day}`}
                              >
                                <span>{DAY_ABBR[day]}</span>
                                {activeCount > 0 && (
                                  <span className="ml-1 text-[10px] font-mono">
                                    {activeCount}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="pt-4 pb-4">
                      <div className="grid grid-cols-1 sm:grid-cols-7 gap-2.5">
                        {DAYS.map((day) => {
                          const daySlots = dayMap[day] || [];
                          return (
                            <div key={day} className="space-y-1.5 min-h-[90px]">
                              <div className="flex items-center justify-between text-xs font-bold text-muted-foreground px-1 mb-1">
                                <span>{day.slice(0, 3)}</span>
                                <span className="text-[10px] font-mono">
                                  {daySlots.length > 0 ? `${daySlots.length}` : ""}
                                </span>
                              </div>

                              {daySlots.length === 0 ? (
                                <button
                                  type="button"
                                  onClick={() => openNew(day, Number(pracId))}
                                  className="w-full h-16 rounded-xl border border-dashed border-border hover:border-primary/60 hover:bg-primary/5 flex flex-col items-center justify-center text-muted-foreground hover:text-primary transition-all group"
                                  title={`Add time slot for ${day}`}
                                >
                                  <Icon
                                    icon="solar:add-circle-bold"
                                    size={15}
                                    className="opacity-40 group-hover:opacity-100 transition-opacity"
                                  />
                                  <span className="text-[9px] mt-0.5 opacity-60">Off</span>
                                </button>
                              ) : (
                                daySlots.map((slot) => {
                                  return (
                                    <div
                                      key={slot.id}
                                      onClick={() => openEdit(slot)}
                                      className={cn(
                                        "group relative p-2 rounded-xl border text-xs cursor-pointer transition-all hover:shadow-xs",
                                        slot.is_active
                                          ? "bg-purple-500/10 border-purple-500/30 text-foreground hover:border-purple-500/60"
                                          : "bg-muted/30 border-border text-muted-foreground opacity-60 hover:opacity-100"
                                      )}
                                    >
                                      {/* Slot Time Range */}
                                      <div className="font-extrabold text-[11px] leading-tight truncate">
                                        {formatTime12(slot.start_time)}
                                      </div>
                                      <div className="text-[10px] text-muted-foreground truncate font-mono">
                                        to {formatTime12(slot.end_time)}
                                      </div>

                                      {/* Max Appointments Quota */}
                                      <div className="flex items-center justify-between mt-1.5 pt-1 border-t border-border/50 text-[10px]">
                                        <span className="font-mono font-bold text-purple-700 dark:text-purple-300">
                                          {slot.max_appointments} pts
                                        </span>
                                        <Badge
                                          variant="outline"
                                          className={cn(
                                            "text-[8px] px-1 py-0 font-mono",
                                            slot.is_active
                                              ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                                              : "bg-muted text-muted-foreground"
                                          )}
                                        >
                                          {slot.is_active ? "ON" : "OFF"}
                                        </Badge>
                                      </div>

                                      {/* Hover Action Buttons */}
                                      <div className="absolute top-1 right-1 hidden group-hover:flex items-center gap-0.5 bg-background/95 rounded-md border shadow-xs p-0.5 z-10">
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleToggle(slot);
                                          }}
                                          className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                                          title={slot.is_active ? "Pause Slot" : "Activate Slot"}
                                        >
                                          <Icon
                                            icon={slot.is_active ? "solar:pause-bold" : "solar:play-bold"}
                                            size={10}
                                          />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setDeletingId(slot.id);
                                          }}
                                          className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                                          title="Delete Slot"
                                        >
                                          <Icon icon="solar:trash-bin-trash-bold" size={10} />
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* ════════ VIEW 2: BY DAY (DAILY MASTER ROSTER) ════════ */}
          {viewMode === "daily" && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-3">
              {DAYS.map((day) => {
                const daySlots = groupedByDay[day] || [];
                const dayCapacity = daySlots
                  .filter((s) => s.is_active)
                  .reduce((sum, s) => sum + (s.max_appointments || 0), 0);

                return (
                  <Card key={day} className="shadow-xs border-border flex flex-col">
                    <CardHeader className="p-3 border-b bg-muted/20">
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-xs text-foreground">{day}</span>
                        <Badge variant="outline" className="text-[10px] font-mono">
                          {daySlots.length} shifts
                        </Badge>
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        Capacity: <strong className="text-foreground">{dayCapacity}</strong> patients
                      </div>
                    </CardHeader>

                    <CardContent className="p-2.5 flex-1 space-y-2">
                      {daySlots.length === 0 ? (
                        <div className="text-center py-8 text-xs text-muted-foreground">
                          <p>No shifts</p>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openNew(day)}
                            className="mt-1 h-7 text-[11px] text-primary"
                          >
                            + Add Shift
                          </Button>
                        </div>
                      ) : (
                        daySlots.map((slot) => {
                          const prac = pracMap[slot.practitioner];
                          return (
                            <div
                              key={slot.id}
                              onClick={() => openEdit(slot)}
                              className={cn(
                                "group p-2.5 rounded-xl border text-xs cursor-pointer transition-all hover:shadow-xs space-y-1 relative",
                                slot.is_active
                                  ? "bg-card border-border hover:border-purple-500/60"
                                  : "bg-muted/30 border-border text-muted-foreground opacity-60 hover:opacity-100"
                              )}
                            >
                              <div className="flex items-center gap-1.5">
                                <Avatar
                                  name={prac?.practitioner_name}
                                  initials={getInitials(prac?.practitioner_name || "", "DR")}
                                  src={prac?.image}
                                  size="xs"
                                  tone="blue"
                                  className="rounded-md shrink-0"
                                />
                                <span className="font-bold text-foreground truncate text-[11px]">
                                  {prac?.practitioner_name || `Doctor #${slot.practitioner}`}
                                </span>
                              </div>

                              <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground pt-1">
                                <span>{formatTimeRange12(slot.start_time, slot.end_time)}</span>
                                <span className="font-bold text-foreground">
                                  {slot.max_appointments} pts
                                </span>
                              </div>
                            </div>
                          );
                        })
                      )}

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openNew(day)}
                        className="w-full h-8 text-[11px] text-muted-foreground hover:text-foreground border border-dashed border-border"
                      >
                        + Add Slot
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* ════════ VIEW 3: COMPACT MASTER LIST (TABLE) ════════ */}
          {viewMode === "table" && (
            <Card className="shadow-xs border-border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-muted/40 border-b text-muted-foreground uppercase text-[10px] tracking-wider font-semibold">
                    <tr>
                      <th className="py-3 px-4">Healthcare Practitioner</th>
                      <th className="py-3 px-4">Department</th>
                      <th className="py-3 px-4">Day</th>
                      <th className="py-3 px-4">Time Window</th>
                      <th className="py-3 px-4">Duration</th>
                      <th className="py-3 px-4 text-center">Max Capacity</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {filteredSchedules.map((slot) => {
                      const prac = pracMap[slot.practitioner];
                      const deptStyle = getDepartmentStyle(prac?.department_name);
                      const duration = calculateDurationHours(slot.start_time, slot.end_time);

                      return (
                        <tr
                          key={slot.id}
                          className="hover:bg-muted/30 transition-colors group cursor-pointer"
                          onClick={() => openEdit(slot)}
                        >
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2.5">
                              <Avatar
                                name={prac?.practitioner_name}
                                initials={getInitials(prac?.practitioner_name || "", "DR")}
                                src={prac?.image}
                                size="sm"
                                tone="blue"
                                className="rounded-lg shrink-0"
                              />
                              <div>
                                <span className="font-extrabold text-foreground block">
                                  {prac?.practitioner_name || `Practitioner #${slot.practitioner}`}
                                </span>
                                <span className="text-[10px] text-muted-foreground">
                                  {prac?.designation || "Physician"}
                                </span>
                              </div>
                            </div>
                          </td>

                          <td className="py-3 px-4">
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px] font-semibold border",
                                deptStyle.bg
                              )}
                            >
                              {prac?.department_name || "General"}
                            </Badge>
                          </td>

                          <td className="py-3 px-4 font-bold text-foreground">
                            {slot.day}
                          </td>

                          <td className="py-3 px-4 font-mono font-medium text-foreground">
                            {formatTimeRange12(slot.start_time, slot.end_time)}
                          </td>

                          <td className="py-3 px-4 font-mono text-muted-foreground">
                            {duration.toFixed(1)} hrs
                          </td>

                          <td className="py-3 px-4 text-center font-mono font-bold text-foreground">
                            {slot.max_appointments} patients
                          </td>

                          <td className="py-3 px-4 text-center">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggle(slot);
                              }}
                              className={cn(
                                "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border transition-all",
                                slot.is_active
                                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                                  : "bg-muted text-muted-foreground border-border"
                              )}
                            >
                              <span
                                className={cn(
                                  "w-1.5 h-1.5 rounded-full",
                                  slot.is_active ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground"
                                )}
                              />
                              {slot.is_active ? "Active" : "Paused"}
                            </button>
                          </td>

                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openEdit(slot);
                                }}
                                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                title="Edit"
                              >
                                <Icon icon="solar:pen-bold" size={13} />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeletingId(slot.id);
                                }}
                                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                title="Delete"
                              >
                                <Icon icon="solar:trash-bin-trash-bold" size={13} />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}

      {/* ─── Add / Edit Slot Modal Dialog ─── */}
      {showForm && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => {
            setShowForm(false);
            setEditItem(null);
          }}
        >
          <div
            className="w-full max-w-lg rounded-2xl border bg-card p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600">
                  <Icon icon={editItem ? "solar:pen-bold" : "solar:calendar-add-bold"} size={20} />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-foreground">
                    {editItem ? "Edit Schedule Time Slot" : "Add Practitioner Schedule Slot"}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Define clinic operating hours and patient appointment quotas
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setShowForm(false);
                  setEditItem(null);
                }}
                className="h-8 w-8 text-muted-foreground"
              >
                <Icon icon="solar:close-bold" size={16} />
              </Button>
            </div>

            <div className="space-y-4">
              {/* Doctor Selector */}
              <div>
                <Label className="text-xs font-semibold text-foreground">
                  Healthcare Practitioner <span className="text-destructive">*</span>
                </Label>
                <select
                  className="mt-1 w-full h-9 border border-input rounded-md px-2.5 text-xs bg-background font-semibold"
                  value={form.practitioner || ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      practitioner: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                  disabled={Boolean(editItem)}
                >
                  <option value="">Select Practitioner</option>
                  {practitioners.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.practitioner_name} ({p.department_name || "General"})
                    </option>
                  ))}
                </select>
              </div>

              {/* Day Selector (Single day on Edit, Multi-day toggle on New) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label className="text-xs font-semibold text-foreground">
                    {editItem ? "Day of Week" : "Apply to Day(s)"} <span className="text-destructive">*</span>
                  </Label>
                  {!editItem && (
                    <button
                      type="button"
                      onClick={() =>
                        setForm((prev) => ({
                          ...prev,
                          selectedDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
                        }))
                      }
                      className="text-[10px] text-primary hover:underline font-semibold"
                    >
                      Select Weekdays
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-7 gap-1">
                  {DAYS.map((d) => {
                    const isSelected = editItem
                      ? form.day === d
                      : form.selectedDays?.includes(d);
                    return (
                      <button
                        key={d}
                        type="button"
                        onClick={() => {
                          if (editItem) {
                            setForm({ ...form, day: d });
                          } else {
                            const cur = form.selectedDays || [];
                            if (cur.includes(d)) {
                              setForm({
                                ...form,
                                selectedDays: cur.filter((item) => item !== d),
                              });
                            } else {
                              setForm({
                                ...form,
                                selectedDays: [...cur, d],
                              });
                            }
                          }
                        }}
                        className={cn(
                          "py-2 rounded-lg text-xs font-semibold border transition-all text-center",
                          isSelected
                            ? "bg-purple-600 text-white border-purple-600 shadow-2xs font-bold"
                            : "bg-muted/40 text-muted-foreground border-border hover:bg-muted"
                        )}
                      >
                        {DAY_ABBR[d]}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 1-Click Fast Shift Presets */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-bold text-muted-foreground">
                    Quick Shift Presets:
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {SHIFT_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() =>
                        setForm({
                          ...form,
                          start_time: preset.start,
                          end_time: preset.end,
                        })
                      }
                      className="p-1.5 rounded-lg border text-left text-[11px] bg-muted/20 hover:bg-muted transition-colors flex items-center gap-1.5"
                    >
                      <Icon icon={preset.icon} size={13} className="text-purple-600 shrink-0" />
                      <div className="min-w-0 flex-1 truncate">
                        <span className="font-semibold block truncate leading-none">
                          {preset.label}
                        </span>
                        <span className="text-[9px] font-mono text-muted-foreground">
                          {preset.start}-{preset.end}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Shift Timing */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-foreground">
                      Start Time <span className="text-destructive">*</span>
                    </Label>
                    <span className="text-[10px] font-mono text-purple-600 font-bold">
                      {formatTime12(form.start_time)}
                    </span>
                  </div>
                  <Input
                    type="time"
                    value={form.start_time}
                    onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                    className="mt-1 h-9 text-xs font-mono font-bold"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-foreground">
                      End Time <span className="text-destructive">*</span>
                    </Label>
                    <span className="text-[10px] font-mono text-purple-600 font-bold">
                      {formatTime12(form.end_time)}
                    </span>
                  </div>
                  <Input
                    type="time"
                    value={form.end_time}
                    onChange={(e) => setForm({ ...form, end_time: e.target.value })}
                    className="mt-1 h-9 text-xs font-mono font-bold"
                  />
                </div>
              </div>

              {/* Max Appointments & Status */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-semibold text-foreground">
                    Max Appointments Capacity
                  </Label>
                  <Input
                    type="number"
                    min="1"
                    max="100"
                    value={form.max_appointments}
                    onChange={(e) =>
                      setForm({ ...form, max_appointments: parseInt(e.target.value) || 20 })
                    }
                    className="mt-1 h-9 text-xs font-mono font-bold"
                  />
                </div>

                <div className="flex items-center gap-2 pt-6">
                  <input
                    type="checkbox"
                    id="slot_active"
                    checked={form.is_active}
                    onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                    className="h-4 w-4 rounded border-input text-primary focus:ring-primary cursor-pointer"
                  />
                  <label htmlFor="slot_active" className="text-xs font-bold text-foreground cursor-pointer">
                    Slot Active on Booking Roster
                  </label>
                </div>
              </div>

              {/* Slot Duration & Pace Preview */}
              <div className="p-3 rounded-xl bg-muted/30 border border-border/60 flex items-center justify-between text-xs">
                <div>
                  <span className="text-[10px] text-muted-foreground block font-medium">
                    Shift Duration
                  </span>
                  <span className="font-mono font-bold text-foreground">
                    {calculateDurationHours(form.start_time, form.end_time)} Hours
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-muted-foreground block font-medium">
                    Target Appointment Pacing
                  </span>
                  <span className="font-mono font-bold text-purple-700 dark:text-purple-300">
                    ~
                    {Math.round(
                      (calculateDurationHours(form.start_time, form.end_time) * 60) /
                        (form.max_appointments || 1)
                    )}{" "}
                    min / patient
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowForm(false);
                  setEditItem(null);
                }}
                className="text-xs h-9"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveSlot}
                disabled={savingSlot}
                className="text-xs h-9 font-semibold gap-1.5 bg-purple-600 hover:bg-purple-700 text-white shadow-xs px-5"
              >
                {savingSlot ? "Saving..." : editItem ? "Update Slot" : "Create Schedule Slot"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Fast Full-Week Roster Generator Wizard Modal ─── */}
      {showRosterWizard && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setShowRosterWizard(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600">
                  <Icon icon="solar:magic-stick-3-bold" size={20} />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-foreground">
                    Full-Week Roster Generator
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    1-Click generate recurrent weekly shifts for a clinician
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowRosterWizard(false)}
                className="h-8 w-8 text-muted-foreground"
              >
                <Icon icon="solar:close-bold" size={16} />
              </Button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <Label className="text-xs font-semibold text-foreground">
                  Practitioner <span className="text-destructive">*</span>
                </Label>
                <select
                  className="mt-1 w-full h-9 border border-input rounded-md px-2.5 text-xs bg-background font-semibold"
                  value={wizardForm.practitioner || ""}
                  onChange={(e) =>
                    setWizardForm({
                      ...wizardForm,
                      practitioner: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                >
                  <option value="">Select Practitioner</option>
                  {practitioners.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.practitioner_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label className="text-xs font-semibold text-foreground">
                  Select Days of Week
                </Label>
                <div className="grid grid-cols-7 gap-1 mt-1">
                  {DAYS.map((d) => {
                    const isSelected = wizardForm.days.includes(d);
                    return (
                      <button
                        key={d}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            setWizardForm({
                              ...wizardForm,
                              days: wizardForm.days.filter((item) => item !== d),
                            });
                          } else {
                            setWizardForm({
                              ...wizardForm,
                              days: [...wizardForm.days, d],
                            });
                          }
                        }}
                        className={cn(
                          "py-2 rounded-lg text-xs font-semibold border transition-all text-center",
                          isSelected
                            ? "bg-purple-600 text-white border-purple-600 font-bold"
                            : "bg-muted/40 text-muted-foreground border-border hover:bg-muted"
                        )}
                      >
                        {DAY_ABBR[d]}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold text-muted-foreground">Start Time</Label>
                  <Input
                    type="time"
                    value={wizardForm.start_time}
                    onChange={(e) => setWizardForm({ ...wizardForm, start_time: e.target.value })}
                    className="mt-1 h-9 text-xs font-mono font-bold"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-muted-foreground">End Time</Label>
                  <Input
                    type="time"
                    value={wizardForm.end_time}
                    onChange={(e) => setWizardForm({ ...wizardForm, end_time: e.target.value })}
                    className="mt-1 h-9 text-xs font-mono font-bold"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs font-semibold text-muted-foreground">
                  Max Appointments per Day
                </Label>
                <Input
                  type="number"
                  value={wizardForm.max_appointments}
                  onChange={(e) =>
                    setWizardForm({
                      ...wizardForm,
                      max_appointments: parseInt(e.target.value) || 20,
                    })
                  }
                  className="mt-1 h-9 text-xs font-mono font-bold"
                />
              </div>

              <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-700 dark:text-purple-300">
                Will create <strong>{wizardForm.days.length}</strong> active schedule slots totaling{" "}
                <strong>
                  {wizardForm.days.length *
                    calculateDurationHours(wizardForm.start_time, wizardForm.end_time)}
                </strong>{" "}
                hours and{" "}
                <strong>{wizardForm.days.length * wizardForm.max_appointments}</strong> weekly
                patient capacity.
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowRosterWizard(false)}
                className="text-xs h-9"
              >
                Cancel
              </Button>
              <Button
                onClick={handleGenerateRoster}
                disabled={generatingWizard || !wizardForm.practitioner}
                className="text-xs h-9 font-semibold bg-purple-600 hover:bg-purple-700 text-white shadow-xs"
              >
                {generatingWizard ? "Generating..." : "Generate Roster Slots"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Copy Day Slots Modal ─── */}
      {showCopy && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setShowCopy(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border bg-card p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <Icon icon="solar:copy-bold" size={18} className="text-purple-600" />
                <h3 className="font-extrabold text-sm text-foreground">
                  Duplicate Day Schedule
                </h3>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowCopy(false)}
                className="h-7 w-7 text-muted-foreground"
              >
                <Icon icon="solar:close-bold" size={15} />
              </Button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <Label className="text-xs font-semibold text-muted-foreground">Source Day</Label>
                <select
                  className="mt-1 w-full h-9 border border-input rounded-md px-2.5 text-xs bg-background font-semibold"
                  value={copyFrom}
                  onChange={(e) => setCopyFrom(e.target.value)}
                >
                  {DAYS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label className="text-xs font-semibold text-muted-foreground">Target Day</Label>
                <select
                  className="mt-1 w-full h-9 border border-input rounded-md px-2.5 text-xs bg-background font-semibold"
                  value={copyTo}
                  onChange={(e) => setCopyTo(e.target.value)}
                >
                  {DAYS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label className="text-xs font-semibold text-muted-foreground">
                  Practitioner Scope (Optional)
                </Label>
                <select
                  className="mt-1 w-full h-9 border border-input rounded-md px-2.5 text-xs bg-background font-medium"
                  value={copyPractitioner}
                  onChange={(e) =>
                    setCopyPractitioner(e.target.value ? Number(e.target.value) : "")
                  }
                >
                  <option value="">All active practitioners</option>
                  {practitioners.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.practitioner_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCopy(false)}
                className="text-xs h-8"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCopyDay}
                disabled={copyingSlots}
                className="text-xs h-8 font-semibold bg-purple-600 hover:bg-purple-700 text-white shadow-xs"
              >
                {copyingSlots ? "Copying..." : "Duplicate Slots"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Delete Confirmation Modal ─── */}
      {deletingId !== null && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setDeletingId(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border bg-card p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 text-destructive">
              <div className="p-2 rounded-xl bg-destructive/10">
                <Icon icon="solar:trash-bin-trash-bold" size={22} />
              </div>
              <div>
                <h4 className="font-extrabold text-sm text-foreground">Delete Schedule Slot?</h4>
                <p className="text-xs text-muted-foreground">
                  This will remove this appointment time window from the clinical booking roster.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDeletingId(null)}
                className="text-xs h-8"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => handleDeleteSlot(deletingId)}
                className="text-xs h-8 bg-destructive hover:bg-destructive/90 text-white font-semibold"
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
