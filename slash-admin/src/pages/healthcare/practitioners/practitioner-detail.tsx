import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router";
import { Icon } from "@/components/icon";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/ui/card";
import { Badge } from "@/ui/badge";
import { Separator } from "@/ui/separator";
import DocumentSidebar from "@/components/healthcare/DocumentSidebar";
import ActivityHeatmap from "@/components/healthcare/ActivityHeatmap";
import Avatar from "@/components/Avatar";
import { HealthcareApi } from "@/api/services/healthcareService";
import type {
  HealthcarePractitioner,
  MedicalDepartment,
  PractitionerSchedule,
} from "@/api/services/healthcareService";
import { useDoctypePermissions } from "@/utils/permissions";
import EntitySelect from "@/components/healthcare/EntitySelect";
import { cn, getInitials } from "@/utils";
import { toast } from "sonner";

interface ActivityItem {
  text: string;
  time: string;
}

interface Comment {
  text: string;
  user: string;
  time: string;
}

// Department styling utility matching directory and create pages
function getDepartmentStyle(deptName?: string) {
  const name = (deptName || "").toLowerCase();
  if (name.includes("cardio")) {
    return {
      bg: "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30",
      gradient: "from-rose-500/20 via-pink-500/10 to-transparent",
      badgeColor: "bg-rose-500 text-white",
      icon: "solar:heart-pulse-bold",
    };
  }
  if (name.includes("pediatr") || name.includes("child")) {
    return {
      bg: "bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/30",
      gradient: "from-sky-500/20 via-blue-500/10 to-transparent",
      badgeColor: "bg-sky-500 text-white",
      icon: "solar:user-bold",
    };
  }
  if (name.includes("surg") || name.includes("operat")) {
    return {
      bg: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30",
      gradient: "from-amber-500/20 via-orange-500/10 to-transparent",
      badgeColor: "bg-amber-500 text-white",
      icon: "solar:medical-kit-bold",
    };
  }
  if (name.includes("physio") || name.includes("rehab")) {
    return {
      bg: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
      gradient: "from-emerald-500/20 via-teal-500/10 to-transparent",
      badgeColor: "bg-emerald-500 text-white",
      icon: "solar:accessibility-bold",
    };
  }
  if (name.includes("neuro") || name.includes("psych")) {
    return {
      bg: "bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-500/30",
      gradient: "from-violet-500/20 via-purple-500/10 to-transparent",
      badgeColor: "bg-violet-500 text-white",
      icon: "solar:atom-bold",
    };
  }
  return {
    bg: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30",
    gradient: "from-blue-500/20 via-indigo-500/10 to-transparent",
    badgeColor: "bg-blue-500 text-white",
    icon: "solar:stethoscope-bold",
  };
}

const POPULAR_DESIGNATIONS = [
  "Consultant Physician",
  "Senior Surgeon",
  "Chief Medical Officer",
  "Pediatrician",
  "Cardiologist",
  "General Practitioner",
  "Resident Physician",
  "Anesthesiologist",
  "Radiologist",
  "Physiotherapist",
  "Clinical Neurologist",
];

const WEEK_DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

export default function PractitionerDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { canWrite } = useDoctypePermissions("Healthcare Practitioner");
  const { canCreate: canAppt } = useDoctypePermissions("Patient Appointment");
  const { canCreate: canEncounter } = useDoctypePermissions("Patient Encounter");
  const { canCreate: canPrescription } = useDoctypePermissions("Drug Prescription");
  const { canCreate: canLabTest } = useDoctypePermissions("Lab Test");
  const { canCreate: canInpatient } = useDoctypePermissions("Inpatient Record");

  // State
  const [practitioner, setPractitioner] = useState<HealthcarePractitioner | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [departments, setDepartments] = useState<MedicalDepartment[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [schedules, setSchedules] = useState<PractitionerSchedule[]>([]);
  const [activeTab, setActiveTab] = useState<"overview" | "schedule" | "billing" | "edit" | "activity">("overview");
  const [showIdBadgeModal, setShowIdBadgeModal] = useState(false);

  // Form State
  const [form, setForm] = useState<Record<string, any>>({});
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [activity, setActivity] = useState<ActivityItem[]>([]);

  // Practitioner-specific transaction counts
  const [txCounts, setTxCounts] = useState({
    appointments: 0,
    encounters: 0,
    vitals: 0,
    prescriptions: 0,
    inpatient: 0,
    labTests: 0,
  });

  const loadPractitioner = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const pid = Number(id);
      const res = await HealthcareApi.practitioners.get(pid);
      setPractitioner(res);
      setForm({
        first_name: res.first_name || "",
        middle_name: res.middle_name || "",
        last_name: res.last_name || "",
        gender: res.gender || "Male",
        designation: res.designation || "",
        mobile_phone: res.mobile_phone || "",
        residence_phone: (res as any).residence_phone || "",
        office_phone: (res as any).office_phone || "",
        email: (res as any).email || "",
        address: (res as any).address || "",
        department: res.department || null,
        practitioner_type: (res as any).practitioner_type || "Internal",
        hospital: (res as any).hospital || "Main Referral Hospital",
        employee: (res as any).employee || "",
        user: (res as any).user || null,
        op_consulting_charge_item: res.op_consulting_charge_item || null,
        op_consulting_charge: res.op_consulting_charge || 0,
        inpatient_visit_charge_item: res.inpatient_visit_charge_item || null,
        inpatient_visit_charge: (res as any).inpatient_visit_charge || 0,
        enable_free_follow_ups: (res as any).enable_free_follow_ups || false,
        max_visits: (res as any).max_visits || 0,
        valid_days: (res as any).valid_days || 0,
        status: res.status || "Active",
        image: res.image || "",
      });

      // Load practitioner-specific transaction counts & schedules in parallel
      const [apptRes, encRes, vsRes, rxRes, inptRes, labRes, schedRes] = await Promise.all([
        HealthcareApi.appointments.list({ practitioner: pid, page_size: 1 }).catch(() => ({ count: 0 })),
        HealthcareApi.encounters.list({ practitioner: pid, page_size: 1 }).catch(() => ({ count: 0 })),
        HealthcareApi.vitalSigns.list({ practitioner: pid, page_size: 1 }).catch(() => ({ count: 0 })),
        HealthcareApi.prescriptions.list({ practitioner: pid, page_size: 1 }).catch(() => ({ count: 0 })),
        HealthcareApi.inpatientRecords.list({ practitioner: pid, page_size: 1 }).catch(() => ({ count: 0 })),
        HealthcareApi.labTests.list({ practitioner: pid, page_size: 1 }).catch(() => ({ count: 0 })),
        HealthcareApi.practitionerSchedules.list({ practitioner: pid, page_size: 50 }).catch(() => ({ results: [] })),
      ]);

      setTxCounts({
        appointments: apptRes.count || 0,
        encounters: encRes.count || 0,
        vitals: vsRes.count || 0,
        prescriptions: rxRes.count || 0,
        inpatient: inptRes.count || 0,
        labTests: labRes.count || 0,
      });

      setSchedules((schedRes as any).results || []);

      // Build activity from real encounters and appointments
      try {
        const [recentEncRes, recentApptRes] = await Promise.all([
          HealthcareApi.encounters.list({ practitioner: pid, page_size: 20 }).catch(() => ({ results: [] })),
          HealthcareApi.appointments.list({ practitioner: pid, page_size: 20 }).catch(() => ({ results: [] })),
        ]);
        const items: ActivityItem[] = [];
        for (const enc of (recentEncRes as any).results || []) {
          items.push({
            text: `Clinical Encounter with ${enc.patient_name || "Patient"} — ${enc.chief_complaint || enc.status || "Completed"}`,
            time: enc.encounter_date || enc.created || "",
          });
        }
        for (const appt of (recentApptRes as any).results || []) {
          items.push({
            text: `Patient Appointment — ${appt.patient_name || "Patient"} — ${appt.status || "Scheduled"}`,
            time: appt.appointment_date || appt.created || "",
          });
        }
        items.sort((a, b) => (b.time || "").localeCompare(a.time || ""));
        setActivity(items.slice(0, 20));
      } catch {
        setActivity([]);
      }
    } catch (err) {
      console.error("Failed to load practitioner:", err);
      toast.error("Failed to load practitioner details");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadPractitioner();

    HealthcareApi.departments
      .list({ page_size: 100 })
      .then((res) => setDepartments(res.results || []))
      .catch(() => {});

    HealthcareApi.stockItems
      .list({ page_size: 100 })
      .then((res) => setItems(res.results || []))
      .catch(() => {});

    HealthcareApi.users
      .list({ page_size: 100 })
      .then((res) => setUsers(res.results || []))
      .catch(() => {});
  }, [loadPractitioner]);

  const handleSave = async () => {
    if (!practitioner) return;
    setSaving(true);
    try {
      await HealthcareApi.practitioners.update(practitioner.id, form);
      toast.success("Practitioner profile updated successfully");
      await loadPractitioner();
    } catch (err: any) {
      console.error("Failed to save:", err);
      toast.error(err?.message || "Failed to update practitioner");
    } finally {
      setSaving(false);
    }
  };

  const addComment = () => {
    if (!commentText.trim()) return;
    setComments([
      ...comments,
      { text: commentText.trim(), user: "Admin", time: "Just now" },
    ]);
    setCommentText("");
    toast.success("Comment added");
  };

  const selectedDepartment = useMemo(() => {
    if (!form.department) return null;
    return departments.find((d) => d.id === form.department);
  }, [form.department, departments]);

  const departmentStyle = useMemo(() => {
    return getDepartmentStyle(practitioner?.department_name || selectedDepartment?.department);
  }, [practitioner, selectedDepartment]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-9 w-9 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <span className="text-xs font-semibold text-muted-foreground">
            Loading practitioner profile...
          </span>
        </div>
      </div>
    );
  }

  if (!practitioner) {
    return (
      <div className="text-center py-20 max-w-md mx-auto space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto text-muted-foreground">
          <Icon icon="solar:user-cross-bold" size={30} />
        </div>
        <h2 className="text-lg font-bold text-foreground">Practitioner Not Found</h2>
        <p className="text-xs text-muted-foreground">
          The requested healthcare practitioner record does not exist or may have been archived.
        </p>
        <Button onClick={() => navigate("/healthcare/practitioners")} size="sm">
          Return to Practitioners Directory
        </Button>
      </div>
    );
  }

  const fullName =
    practitioner.practitioner_name ||
    `Dr. ${form.first_name} ${form.middle_name ? form.middle_name + " " : ""}${form.last_name}`.trim();
  const initials = getInitials(fullName, "DR");

  return (
    <div className="min-h-screen bg-background pb-20 space-y-6">
      {/* ─── Top Navigation Command Bar ─── */}
      <div className="rounded-2xl border bg-card/95 backdrop-blur-sm p-5 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <button
              type="button"
              onClick={() => navigate("/healthcare/practitioners")}
              className="p-2.5 rounded-xl border hover:bg-muted transition-colors text-muted-foreground hover:text-foreground shrink-0"
              title="Back to Practitioners"
            >
              <Icon icon="solar:arrow-left-bold" size={18} />
            </button>
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
                <span className="font-mono text-foreground font-semibold">
                  {practitioner.practitioner_id}
                </span>
              </div>

              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl font-extrabold tracking-tight text-foreground">
                  {fullName}
                </h1>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px] font-bold px-2 py-0.5 gap-1",
                    practitioner.status === "Active"
                      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                      : "bg-muted text-muted-foreground border-border"
                  )}
                >
                  <span
                    className={cn(
                      "w-1.5 h-1.5 rounded-full",
                      practitioner.status === "Active"
                        ? "bg-emerald-500 animate-pulse"
                        : "bg-muted-foreground"
                    )}
                  />
                  {practitioner.status}
                </Badge>
                <Badge variant="outline" className="text-[10px] font-mono">
                  {practitioner.practitioner_type} Staff
                </Badge>
              </div>
            </div>
          </div>

          {/* Quick Header Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowIdBadgeModal(true)}
              className="h-9 text-xs font-semibold gap-1.5"
            >
              <Icon icon="solar:card-2-bold" size={14} className="text-primary" />
              Staff Badge
            </Button>

            {canAppt && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/healthcare/appointments?practitioner=${practitioner.id}`)}
                className="h-9 text-xs font-semibold gap-1.5 text-blue-600 border-blue-500/30 hover:bg-blue-500/10"
              >
                <Icon icon="solar:calendar-bold" size={14} />
                Appointments ({txCounts.appointments})
              </Button>
            )}

            {canEncounter && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/healthcare/encounters?practitioner=${practitioner.id}`)}
                className="h-9 text-xs font-semibold gap-1.5 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/10"
              >
                <Icon icon="solar:clipboard-text-bold" size={14} />
                Encounters ({txCounts.encounters})
              </Button>
            )}

            <Button
              onClick={handleSave}
              disabled={saving || !canWrite}
              className="h-9 text-xs font-semibold gap-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md shadow-blue-500/20 px-5"
            >
              {saving ? (
                <>
                  <Icon icon="solar:refresh-circle-bold" className="animate-spin" size={15} />
                  Saving...
                </>
              ) : (
                <>
                  <Icon icon="solar:disk-bold" size={15} />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* ─── Executive Doctor Profile Hero Card ─── */}
      <div className="rounded-2xl border bg-card shadow-xs overflow-hidden">
        {/* Banner with specialty styling */}
        <div
          className={cn(
            "h-24 bg-gradient-to-r p-4 flex items-start justify-between relative",
            departmentStyle.gradient
          )}
        >
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border shadow-2xs backdrop-blur-md",
                departmentStyle.bg
              )}
            >
              <Icon icon={departmentStyle.icon} size={13} />
              <span>{practitioner.department_name || "General Medicine"}</span>
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-mono text-muted-foreground bg-background/80 px-2 py-0.5 rounded-full border">
              System ID: #{practitioner.id}
            </span>
          </div>
        </div>

        {/* Hero Identity Body */}
        <div className="p-6 pt-0 -mt-10">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div className="flex items-end gap-4">
              <div className="relative shrink-0">
                <Avatar
                  name={fullName}
                  initials={initials}
                  src={form.image || practitioner.image}
                  size="2xl"
                  tone="blue"
                  className="w-24 h-24 rounded-2xl border-4 border-background shadow-lg object-cover"
                />
                <span
                  className={cn(
                    "absolute bottom-1 right-1 w-4 h-4 rounded-full border-2 border-background",
                    practitioner.status === "Active" ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground"
                  )}
                  title={practitioner.status}
                />
              </div>

              <div className="pb-1 space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 font-bold">
                  <Icon icon="solar:verified-check-bold" size={15} />
                  <span>Credentialed Healthcare Practitioner</span>
                </div>
                <h2 className="text-xl font-extrabold text-foreground">{fullName}</h2>
                <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground font-medium">
                  <span>{practitioner.designation || "Physician"}</span>
                  <span>•</span>
                  <span>{form.hospital || "Main Referral Hospital"}</span>
                  <span>•</span>
                  <span className="font-mono text-foreground font-bold">
                    ${Number(practitioner.op_consulting_charge || 0).toFixed(2)} OP / $
                    {Number((practitioner as any).inpatient_visit_charge || 0).toFixed(2)} IP
                  </span>
                </div>
              </div>
            </div>

            {/* Direct Contact Buttons */}
            <div className="flex items-center gap-2">
              {practitioner.mobile_phone && (
                <a
                  href={`tel:${practitioner.mobile_phone}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border bg-background hover:bg-muted text-xs font-semibold transition-colors"
                >
                  <Icon icon="solar:phone-bold" size={13} className="text-emerald-500" />
                  <span className="font-mono">{practitioner.mobile_phone}</span>
                </a>
              )}
              {practitioner.email && (
                <a
                  href={`mailto:${practitioner.email}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border bg-background hover:bg-muted text-xs font-semibold transition-colors"
                >
                  <Icon icon="solar:letter-bold" size={13} className="text-blue-500" />
                  <span>Email</span>
                </a>
              )}
            </div>
          </div>

          {/* 6 Clinical Key Performance Scorecards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-6 border-t mt-6">
            <button
              type="button"
              onClick={() => navigate(`/healthcare/appointments?practitioner=${practitioner.id}`)}
              className="p-3 rounded-xl border bg-muted/20 hover:bg-blue-500/10 hover:border-blue-500/30 transition-all text-left group"
            >
              <div className="flex items-center justify-between text-muted-foreground group-hover:text-blue-600 mb-1">
                <span className="text-[11px] font-semibold">Appointments</span>
                <Icon icon="solar:calendar-date-bold" size={16} />
              </div>
              <div className="text-lg font-extrabold text-foreground group-hover:text-blue-600">
                {txCounts.appointments}
              </div>
              <span className="text-[10px] text-muted-foreground">Booked / Queue</span>
            </button>

            <button
              type="button"
              onClick={() => navigate(`/healthcare/encounters?practitioner=${practitioner.id}`)}
              className="p-3 rounded-xl border bg-muted/20 hover:bg-emerald-500/10 hover:border-emerald-500/30 transition-all text-left group"
            >
              <div className="flex items-center justify-between text-muted-foreground group-hover:text-emerald-600 mb-1">
                <span className="text-[11px] font-semibold">Encounters</span>
                <Icon icon="solar:clipboard-text-bold" size={16} />
              </div>
              <div className="text-lg font-extrabold text-foreground group-hover:text-emerald-600">
                {txCounts.encounters}
              </div>
              <span className="text-[10px] text-muted-foreground">Clinical Visits</span>
            </button>

            <button
              type="button"
              onClick={() => navigate(`/healthcare/inpatient?practitioner=${practitioner.id}`)}
              className="p-3 rounded-xl border bg-muted/20 hover:bg-indigo-500/10 hover:border-indigo-500/30 transition-all text-left group"
            >
              <div className="flex items-center justify-between text-muted-foreground group-hover:text-indigo-600 mb-1">
                <span className="text-[11px] font-semibold">Inpatients</span>
                <Icon icon="solar:hospital-bold" size={16} />
              </div>
              <div className="text-lg font-extrabold text-foreground group-hover:text-indigo-600">
                {txCounts.inpatient}
              </div>
              <span className="text-[10px] text-muted-foreground">Ward Admissions</span>
            </button>

            <button
              type="button"
              onClick={() => navigate(`/healthcare/lab-tests?practitioner=${practitioner.id}`)}
              className="p-3 rounded-xl border bg-muted/20 hover:bg-purple-500/10 hover:border-purple-500/30 transition-all text-left group"
            >
              <div className="flex items-center justify-between text-muted-foreground group-hover:text-purple-600 mb-1">
                <span className="text-[11px] font-semibold">Lab Tests</span>
                <Icon icon="solar:flask-bold" size={16} />
              </div>
              <div className="text-lg font-extrabold text-foreground group-hover:text-purple-600">
                {txCounts.labTests}
              </div>
              <span className="text-[10px] text-muted-foreground">Diagnostic Orders</span>
            </button>

            <button
              type="button"
              onClick={() => navigate(`/healthcare/prescriptions?practitioner=${practitioner.id}`)}
              className="p-3 rounded-xl border bg-muted/20 hover:bg-rose-500/10 hover:border-rose-500/30 transition-all text-left group"
            >
              <div className="flex items-center justify-between text-muted-foreground group-hover:text-rose-600 mb-1">
                <span className="text-[11px] font-semibold">Prescriptions</span>
                <Icon icon="solar:pills-bold" size={16} />
              </div>
              <div className="text-lg font-extrabold text-foreground group-hover:text-rose-600">
                {txCounts.prescriptions}
              </div>
              <span className="text-[10px] text-muted-foreground">Rx Medication</span>
            </button>

            <div className="p-3 rounded-xl border bg-muted/20 text-left">
              <div className="flex items-center justify-between text-muted-foreground mb-1">
                <span className="text-[11px] font-semibold">Weekly Slots</span>
                <Icon icon="solar:clock-circle-bold" size={16} />
              </div>
              <div className="text-lg font-extrabold text-foreground">
                {schedules.length}
              </div>
              <span className="text-[10px] text-muted-foreground">Roster Shifts</span>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Profile Navigation Tabs ─── */}
      <div className="flex items-center gap-1 border-b pb-2 overflow-x-auto">
        {[
          { id: "overview" as const, label: "Clinical Overview", icon: "solar:widget-2-bold" },
          { id: "schedule" as const, label: `Weekly Schedule (${schedules.length})`, icon: "solar:calendar-bold" },
          { id: "billing" as const, label: "Tariffs & Billing", icon: "solar:dollar-minimalistic-bold-duotone" },
          { id: "edit" as const, label: "Edit Practitioner Form", icon: "solar:pen-new-square-bold" },
          { id: "activity" as const, label: `Activity & Notes (${activity.length})`, icon: "solar:history-bold" },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActiveTab(t.id)}
            className={cn(
              "px-3.5 py-2 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 shrink-0",
              activeTab === t.id
                ? "bg-primary text-primary-foreground font-bold shadow-2xs"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Icon icon={t.icon} size={14} />
            {t.label}
          </button>
        ))}
      </div>

      {/* ─── Main Content Split: Details (Left) + DocumentSidebar (Right) ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Main Tabs Container (8 or 9 Cols) */}
        <div className="lg:col-span-8 space-y-6">
          {/* ════════ TAB 1: Clinical Overview ════════ */}
          {activeTab === "overview" && (
            <div className="space-y-6">
              {/* Practice Location & Identity Specs */}
              <Card className="shadow-xs border-border">
                <CardHeader className="pb-3 border-b bg-muted/20">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <Icon icon="solar:info-square-bold" size={16} className="text-primary" />
                    Clinical Privileges & Office Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div className="p-3 rounded-xl border bg-muted/20 space-y-1">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground">
                        Department
                      </span>
                      <p className="font-bold text-sm text-foreground">
                        {practitioner.department_name || "General Medicine"}
                      </p>
                    </div>

                    <div className="p-3 rounded-xl border bg-muted/20 space-y-1">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground">
                        Role & Designation
                      </span>
                      <p className="font-bold text-sm text-foreground">
                        {practitioner.designation || "Consultant Physician"}
                      </p>
                    </div>

                    <div className="p-3 rounded-xl border bg-muted/20 space-y-1">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground">
                        Facility & Office Location
                      </span>
                      <p className="font-medium text-foreground">
                        {form.hospital || "Main Hospital"} • {form.address || "Suite Unassigned"}
                      </p>
                    </div>

                    <div className="p-3 rounded-xl border bg-muted/20 space-y-1">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground">
                        Staff Affiliation
                      </span>
                      <p className="font-medium text-foreground">
                        {practitioner.practitioner_type} Staff {form.employee && `(HR: ${form.employee})`}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Activity Heatmap (Marley 52-week clinical workload chart) */}
              <ActivityHeatmap
                activity={activity}
                title="Clinical Activity Heatmap"
                message="Based on encounters, appointments, and care events completed by this healthcare practitioner."
              />

              {/* Direct Care Quick Actions Bar */}
              <Card className="shadow-xs border-border">
                <CardHeader className="pb-3 border-b bg-muted/20">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <Icon icon="solar:bolt-bold" size={16} className="text-amber-500" />
                    Quick Clinical Actions
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <Button
                      variant="outline"
                      onClick={() => navigate(`/healthcare/appointments/new?practitioner=${practitioner.id}`)}
                      className="h-10 text-xs font-semibold justify-start gap-2 border-border hover:bg-blue-500/10 hover:border-blue-500/30"
                    >
                      <Icon icon="solar:calendar-add-bold" size={16} className="text-blue-600" />
                      Book Patient Appointment
                    </Button>

                    <Button
                      variant="outline"
                      onClick={() => navigate(`/healthcare/encounters/new?practitioner=${practitioner.id}`)}
                      className="h-10 text-xs font-semibold justify-start gap-2 border-border hover:bg-emerald-500/10 hover:border-emerald-500/30"
                    >
                      <Icon icon="solar:stethoscope-bold" size={16} className="text-emerald-600" />
                      Start Clinical Encounter
                    </Button>

                    <Button
                      variant="outline"
                      onClick={() => navigate(`/healthcare/prescriptions/new?practitioner=${practitioner.id}`)}
                      className="h-10 text-xs font-semibold justify-start gap-2 border-border hover:bg-rose-500/10 hover:border-rose-500/30"
                    >
                      <Icon icon="solar:pills-bold" size={16} className="text-rose-600" />
                      Write Medication Order
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* ════════ TAB 2: Weekly Schedule & Availability ════════ */}
          {activeTab === "schedule" && (
            <Card className="shadow-xs border-border">
              <CardHeader className="pb-3 border-b bg-muted/20">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                      <Icon icon="solar:calendar-date-bold" size={17} className="text-purple-600" />
                      Weekly Clinic Availability & Roster
                    </CardTitle>
                    <CardDescription className="text-xs text-muted-foreground mt-0.5">
                      Weekly recurring clinic appointment slots and service units
                    </CardDescription>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => navigate("/healthcare/practitioners/schedules")}
                    className="text-xs h-8 gap-1"
                  >
                    <Icon icon="solar:settings-bold" size={13} />
                    Schedules Master
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-5 space-y-4">
                {schedules.length === 0 ? (
                  <div className="text-center py-10 space-y-3">
                    <div className="w-12 h-12 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center mx-auto">
                      <Icon icon="solar:calendar-minimalistic-bold" size={24} />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      No active recurring schedule entries configured for this provider.
                    </p>
                    <Button
                      size="sm"
                      onClick={() => navigate("/healthcare/practitioners/schedules")}
                      className="text-xs"
                    >
                      + Add Weekly Clinic Schedule
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {schedules.map((sch) => (
                      <div
                        key={sch.id}
                        className="p-3.5 rounded-xl border bg-muted/20 flex items-center justify-between"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-xs text-foreground">{sch.day}</span>
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[9px] font-mono",
                                sch.is_active
                                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                                  : "bg-muted text-muted-foreground"
                              )}
                            >
                              {sch.is_active ? "Active" : "Paused"}
                            </Badge>
                          </div>
                          <div className="text-xs font-mono text-muted-foreground flex items-center gap-1">
                            <Icon icon="solar:clock-circle-bold" size={12} className="text-purple-500" />
                            <span>
                              {sch.start_time?.slice(0, 5)} - {sch.end_time?.slice(0, 5)}
                            </span>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="text-[10px] text-muted-foreground block">Max Patients</span>
                          <span className="font-mono font-bold text-xs text-foreground">
                            {sch.max_appointments || 20} / shift
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* ════════ TAB 3: Tariffs & Billing ════════ */}
          {activeTab === "billing" && (
            <Card className="shadow-xs border-border">
              <CardHeader className="pb-3 border-b bg-muted/20">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Icon icon="solar:dollar-minimalistic-bold-duotone" size={17} className="text-amber-600" />
                  Fee Schedules & Follow-Up Policies
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground mt-0.5">
                  Consultation charges linked to billing items and follow-up validity rules
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-5 space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl border bg-muted/20 space-y-2">
                    <span className="text-xs font-bold text-foreground block">
                      Outpatient (OP) Consultation Charge
                    </span>
                    <div className="text-2xl font-black font-mono text-foreground">
                      ${Number(form.op_consulting_charge || 0).toFixed(2)}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Linked Item:{" "}
                      <span className="font-semibold text-foreground">
                        {practitioner.op_consulting_charge_item_name || "Standard Consultation"}
                      </span>
                    </p>
                  </div>

                  <div className="p-4 rounded-xl border bg-muted/20 space-y-2">
                    <span className="text-xs font-bold text-foreground block">
                      Inpatient (IP) Ward Round Charge
                    </span>
                    <div className="text-2xl font-black font-mono text-foreground">
                      ${Number(form.inpatient_visit_charge || 0).toFixed(2)}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Linked Item:{" "}
                      <span className="font-semibold text-foreground">
                        {practitioner.inpatient_visit_charge_item_name || "Inpatient Visit Charge"}
                      </span>
                    </p>
                  </div>
                </div>

                {/* Free Follow-up Policy Summary */}
                <div className="p-4 rounded-xl border bg-background space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <Icon icon="solar:shield-check-bold" size={15} className="text-emerald-600" />
                      Complimentary Follow-Up Policy
                    </span>
                    <Badge
                      className={cn(
                        "text-[10px] font-bold",
                        form.enable_free_follow_ups
                          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      {form.enable_free_follow_ups ? "Policy Active" : "No Free Follow-ups"}
                    </Badge>
                  </div>
                  {form.enable_free_follow_ups ? (
                    <p className="text-xs text-muted-foreground">
                      Patients are permitted up to{" "}
                      <strong className="text-foreground font-bold">{form.max_visits || 1}</strong>{" "}
                      free visit(s) within{" "}
                      <strong className="text-foreground font-bold">{form.valid_days || 7}</strong>{" "}
                      days of their initial paid encounter.
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Every encounter with this physician requires standard consultation fee billing.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* ════════ TAB 4: Edit Details & Credentialing Form ════════ */}
          {activeTab === "edit" && (
            <Card className="shadow-xs border-border">
              <CardHeader className="pb-3 border-b bg-muted/20">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                      <Icon icon="solar:pen-new-square-bold" size={16} className="text-primary" />
                      Edit Practitioner Record
                    </CardTitle>
                    <CardDescription className="text-xs text-muted-foreground mt-0.5">
                      Update provider profile details, clinical specialty, and tariffs
                    </CardDescription>
                  </div>
                  <Button
                    onClick={handleSave}
                    disabled={saving || !canWrite}
                    size="sm"
                    className="h-8 text-xs font-semibold gap-1 bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {saving ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-5 space-y-5">
                {/* Name Breakdown */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs font-semibold text-foreground">
                      First Name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      value={form.first_name}
                      onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                      className="mt-1 h-9 text-xs font-medium"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-muted-foreground">Middle Name</Label>
                    <Input
                      value={form.middle_name}
                      onChange={(e) => setForm({ ...form, middle_name: e.target.value })}
                      className="mt-1 h-9 text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-foreground">
                      Last Name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      value={form.last_name}
                      onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                      className="mt-1 h-9 text-xs font-medium"
                    />
                  </div>
                </div>

                {/* Gender & Status */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs font-semibold text-muted-foreground">Gender</Label>
                    <div className="grid grid-cols-2 gap-2 mt-1">
                      {["Male", "Female"].map((g) => (
                        <button
                          key={g}
                          type="button"
                          onClick={() => setForm({ ...form, gender: g })}
                          className={cn(
                            "h-9 rounded-md border text-xs font-semibold transition-all flex items-center justify-center gap-1.5",
                            form.gender === g
                              ? "bg-primary text-primary-foreground border-primary shadow-2xs font-bold"
                              : "bg-background text-muted-foreground border-input hover:bg-muted/50"
                          )}
                        >
                          <Icon
                            icon={g === "Male" ? "solar:men-bold" : "solar:women-bold"}
                            size={14}
                          />
                          {g}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs font-semibold text-muted-foreground">Status</Label>
                    <div className="grid grid-cols-2 gap-2 mt-1">
                      {["Active", "Disabled"].map((st) => (
                        <button
                          key={st}
                          type="button"
                          onClick={() => setForm({ ...form, status: st })}
                          className={cn(
                            "h-9 rounded-md border text-xs font-semibold transition-all flex items-center justify-center gap-1.5",
                            form.status === st
                              ? st === "Active"
                                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40 font-bold shadow-2xs"
                                : "bg-muted text-muted-foreground border-border font-bold"
                              : "bg-background text-muted-foreground border-input hover:bg-muted/50"
                          )}
                        >
                          <span
                            className={cn(
                              "w-1.5 h-1.5 rounded-full",
                              st === "Active" ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground/60"
                            )}
                          />
                          {st}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Contact Phone & Email */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs font-semibold text-muted-foreground">Direct Mobile Phone</Label>
                    <Input
                      value={form.mobile_phone}
                      onChange={(e) => setForm({ ...form, mobile_phone: e.target.value })}
                      className="mt-1 h-9 text-xs font-mono font-medium"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-muted-foreground">Work Email</Label>
                    <Input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      className="mt-1 h-9 text-xs font-mono font-medium"
                    />
                  </div>
                </div>

                {/* Department & Designation */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs font-semibold text-foreground">Medical Department</Label>
                    <div className="mt-1">
                      <EntitySelect
                        doctype="Medical Department"
                        rawItems={departments}
                        options={departments.map((d) => ({
                          value: d.id,
                          label: d.department,
                        }))}
                        value={form.department}
                        onChange={(v) => setForm({ ...form, department: v })}
                        onOptionAdded={(_opt, raw) => {
                          if (raw) setDepartments((prev) => [...prev, raw]);
                        }}
                        placeholder="Select Department"
                        emptyText="No departments found"
                        tone="emerald"
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs font-semibold text-foreground">Clinical Designation</Label>
                    <Input
                      value={form.designation}
                      onChange={(e) => setForm({ ...form, designation: e.target.value })}
                      className="mt-1 h-9 text-xs font-medium"
                    />
                    <div className="flex items-center gap-1.5 flex-wrap pt-1.5">
                      {POPULAR_DESIGNATIONS.slice(0, 5).map((d) => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => setForm({ ...form, designation: d })}
                          className={cn(
                            "text-[10px] px-2 py-0.5 rounded-full border transition-colors",
                            form.designation === d
                              ? "bg-primary text-primary-foreground font-bold"
                              : "bg-muted text-muted-foreground hover:bg-muted/80"
                          )}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Facility, Employee ID & User Link */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs font-semibold text-muted-foreground">Hospital Facility</Label>
                    <Input
                      value={form.hospital}
                      onChange={(e) => setForm({ ...form, hospital: e.target.value })}
                      className="mt-1 h-8 text-xs"
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-semibold text-muted-foreground">Office / Room Suite</Label>
                    <Input
                      value={form.address}
                      onChange={(e) => setForm({ ...form, address: e.target.value })}
                      className="mt-1 h-8 text-xs font-medium"
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-semibold text-muted-foreground">Employee ID (HR)</Label>
                    <Input
                      value={form.employee}
                      onChange={(e) => setForm({ ...form, employee: e.target.value })}
                      className="mt-1 h-8 text-xs font-mono"
                    />
                  </div>
                </div>

                {/* Consultation Fees */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div className="p-3 rounded-xl border bg-muted/20 space-y-2">
                    <Label className="text-xs font-bold text-foreground">Outpatient (OP) Fee ($)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={form.op_consulting_charge}
                      onChange={(e) => setForm({ ...form, op_consulting_charge: parseFloat(e.target.value) || 0 })}
                      className="h-9 text-xs font-mono font-bold bg-background"
                    />
                  </div>

                  <div className="p-3 rounded-xl border bg-muted/20 space-y-2">
                    <Label className="text-xs font-bold text-foreground">Inpatient (IP) Fee ($)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={form.inpatient_visit_charge}
                      onChange={(e) => setForm({ ...form, inpatient_visit_charge: parseFloat(e.target.value) || 0 })}
                      className="h-9 text-xs font-mono font-bold bg-background"
                    />
                  </div>
                </div>

                {/* Free Followups */}
                <div className="p-3.5 rounded-xl border bg-background space-y-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="edit_free_followup"
                      checked={form.enable_free_follow_ups}
                      onChange={(e) => setForm({ ...form, enable_free_follow_ups: e.target.checked })}
                      className="h-4 w-4 rounded border-input text-primary focus:ring-primary cursor-pointer"
                    />
                    <label htmlFor="edit_free_followup" className="text-xs font-bold text-foreground cursor-pointer">
                      Enable Free Clinical Follow-Up Encounters
                    </label>
                  </div>

                  {form.enable_free_follow_ups && (
                    <div className="grid grid-cols-2 gap-3 pt-2 border-t">
                      <div>
                        <Label className="text-xs font-semibold text-muted-foreground">Valid Days</Label>
                        <Input
                          type="number"
                          value={form.valid_days}
                          onChange={(e) => setForm({ ...form, valid_days: parseInt(e.target.value) || 0 })}
                          className="mt-1 h-8 text-xs font-mono"
                        />
                      </div>
                      <div>
                        <Label className="text-xs font-semibold text-muted-foreground">Max Free Encounters</Label>
                        <Input
                          type="number"
                          value={form.max_visits}
                          onChange={(e) => setForm({ ...form, max_visits: parseInt(e.target.value) || 0 })}
                          className="mt-1 h-8 text-xs font-mono"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <Button
                    onClick={handleSave}
                    disabled={saving || !canWrite}
                    className="h-9 text-xs font-semibold gap-1.5 bg-blue-600 hover:bg-blue-700 text-white shadow-xs px-6"
                  >
                    {saving ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ════════ TAB 5: Activity & Notes ════════ */}
          {activeTab === "activity" && (
            <div className="space-y-6">
              {/* Internal Comments / Clinical Collaboration */}
              <Card className="shadow-xs border-border">
                <CardHeader className="pb-3 border-b bg-muted/20">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <Icon icon="solar:chat-round-line-bold" size={16} className="text-primary" />
                    Internal Clinical Notes & Administrative Comments
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 space-y-4">
                  <div className="flex items-center gap-2">
                    <Avatar initials="AD" tone="blue" size="sm" />
                    <Input
                      placeholder="Add an internal note or credentialing memo... (Press Enter)"
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addComment()}
                      className="h-9 text-xs"
                    />
                    <Button onClick={addComment} size="sm" className="h-9 text-xs">
                      Post
                    </Button>
                  </div>

                  {comments.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">
                      No internal notes recorded yet.
                    </p>
                  ) : (
                    <div className="space-y-2 pt-2">
                      {comments.map((c, i) => (
                        <div key={i} className="flex gap-2.5 p-2.5 rounded-lg bg-muted/20 border">
                          <Avatar initials={c.user} tone="blue" size="xs" />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between text-[11px] mb-0.5">
                              <span className="font-bold text-foreground">{c.user}</span>
                              <span className="text-muted-foreground">{c.time}</span>
                            </div>
                            <p className="text-xs text-foreground">{c.text}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Activity Timeline */}
              <Card className="shadow-xs border-border">
                <CardHeader className="pb-3 border-b bg-muted/20">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <Icon icon="solar:history-bold" size={16} className="text-primary" />
                    Care & Encounter Timeline
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  {activity.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-6">
                      No recent care events recorded.
                    </p>
                  ) : (
                    <div className="relative pl-4 space-y-4">
                      <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border" />
                      {activity.map((a, i) => (
                        <div key={i} className="relative flex items-start gap-3 pl-2">
                          <div className="absolute -left-[14px] top-1 w-2.5 h-2.5 rounded-full bg-blue-600 border-2 border-background z-10" />
                          <div className="min-w-0 flex-1">
                            <span className="text-[10px] text-muted-foreground block">{a.time}</span>
                            <p className="text-xs text-foreground font-medium">{a.text}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        {/* Right Sidebar: DocumentSidebar Component (4 Cols) */}
        <div className="lg:col-span-4 space-y-5">
          <DocumentSidebar
            doctype="HealthcarePractitioner"
            docname={id || "new"}
            displayName={fullName}
            initials={initials}
            subtitle={practitioner.practitioner_id}
            avatarColor="bg-blue-100 text-blue-700"
            createdAt={practitioner.creation || (practitioner as any).created_at}
            modifiedAt={practitioner.modified || (practitioner as any).updated_at}
            createdBy={practitioner.owner}
            modifiedBy={practitioner.modified_by}
          />
        </div>
      </div>

      {/* ─── Digital Staff ID Badge Modal ─── */}
      {showIdBadgeModal && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setShowIdBadgeModal(false)}
        >
          <div
            className="w-full max-w-sm rounded-3xl border-2 border-border/80 bg-gradient-to-b from-card via-background to-card shadow-2xl p-6 space-y-4 relative overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Holographic Header Band */}
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-blue-600 text-white shadow-xs">
                  <Icon icon="solar:hospital-bold" size={16} />
                </div>
                <div>
                  <div className="text-[11px] font-black tracking-wider uppercase text-foreground leading-none">
                    METROPOLITAN HEALTH SYSTEM
                  </div>
                  <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5">
                    Official Staff Credential
                  </div>
                </div>
              </div>
              <div className="w-6 h-6 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center">
                <span className="text-[8px] font-black text-amber-600">RFID</span>
              </div>
            </div>

            {/* Badge Center: Portrait + Name */}
            <div className="flex flex-col items-center text-center space-y-2.5 pt-2">
              <div className="p-1 rounded-2xl border-2 border-primary/40 bg-background shadow-md">
                <Avatar
                  name={fullName}
                  initials={initials}
                  src={form.image || practitioner.image}
                  size="2xl"
                  tone="blue"
                  className="rounded-xl w-28 h-28 object-cover"
                />
              </div>

              <div>
                <h3 className="font-extrabold text-base text-foreground">{fullName}</h3>
                <p className="text-xs font-semibold text-primary">
                  {practitioner.designation || "Healthcare Practitioner"}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {practitioner.department_name || "General Medicine"}
                </p>
              </div>
            </div>

            {/* Access Clearance & Provider Code */}
            <div className="p-2.5 rounded-xl bg-muted/40 border border-border/60 text-center space-y-0.5">
              <div className="text-[9px] font-extrabold tracking-wider uppercase text-muted-foreground">
                ACCESS CLEARANCE
              </div>
              <div className="text-xs font-black text-foreground">
                LEVEL 4 • ALL WARDS & CLINICAL SUITES
              </div>
            </div>

            {/* Simulated Barcode */}
            <div className="pt-1 text-center space-y-1">
              <div className="h-8 w-full bg-foreground/10 rounded flex items-center justify-center font-mono text-[9px] tracking-widest text-muted-foreground select-none">
                ||| | |||| | ||| || ||||| | |||| | |||
              </div>
              <div className="flex items-center justify-between text-[9px] font-mono text-muted-foreground">
                <span>ID: {practitioner.practitioner_id}</span>
                <span>EXP: 2028-12-31</span>
              </div>
            </div>

            <Button
              onClick={() => setShowIdBadgeModal(false)}
              className="w-full text-xs font-semibold h-8"
              variant="outline"
            >
              Close Badge Preview
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
