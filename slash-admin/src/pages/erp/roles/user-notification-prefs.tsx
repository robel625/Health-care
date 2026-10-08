import { Icon } from "@/components/icon";
import apiClient from "@/api/apiClient";
import { Button } from "@/ui/button";
import { Badge } from "@/ui/badge";
import { Card } from "@/ui/card";
import { Input } from "@/ui/input";
import { Separator } from "@/ui/separator";
import { Text } from "@/ui/typography";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/ui/dialog";
import { useCallback, useEffect, useState, useMemo } from "react";

// ── Types ──────────────────────────────────────────────────────

interface UserOverride {
  id?: number | null;
  enabled: boolean | null;
  send_email: boolean | null;
  send_dashboard: boolean | null;
  send_system: boolean | null;
  mute_until: string | null;
}

interface GlobalSetting {
  enabled: boolean;
  send_email: boolean;
  send_dashboard: boolean;
  send_system: boolean;
}

interface EffectiveSetting {
  enabled: boolean;
  send_email: boolean;
  send_dashboard: boolean;
  send_system: boolean;
  muted: boolean;
  mute_until?: string;
}

interface UserPreference {
  event: string;
  event_display: string;
  user_override: UserOverride | null;
  global_setting: GlobalSetting | null;
  effective: EffectiveSetting;
}

// ── Clinical Event Metadata & Acuity ───────────────────────────

interface EventMeta {
  severity: "critical" | "warning" | "normal";
  label: string;
  description: string;
  icon: string;
  category: string;
  soundPitch?: number;
}

const CLINICAL_EVENT_META: Record<string, EventMeta> = {
  vital_signs_alert: {
    severity: "critical",
    label: "Panic / Critical Vital Signs Telemetry",
    description: "Abnormal BP, oxygen desaturation, cardiac arrhythmia, or trauma alarm.",
    icon: "solar:danger-triangle-bold",
    category: "Clinical & Patient Care",
  },
  inpatient_admission: {
    severity: "warning",
    label: "Inpatient Ward / ICU Bed Admission",
    description: "Emergency or elective patient assigned to ward, bed, or trauma bay.",
    icon: "solar:bed-bold",
    category: "Clinical & Patient Care",
  },
  inpatient_discharge: {
    severity: "normal",
    label: "Inpatient Discharge & Release",
    description: "Clinician discharge summary finalized and patient clearance issued.",
    icon: "solar:check-circle-bold",
    category: "Clinical & Patient Care",
  },
  lab_test_ordered: {
    severity: "normal",
    label: "Diagnostic Lab Order Requisition",
    description: "New clinical chemistry, pathology, or hematology panel ordered.",
    icon: "solar:test-tube-bold",
    category: "Clinical & Patient Care",
  },
  lab_test_approved: {
    severity: "normal",
    label: "Diagnostic Lab Results Verified",
    description: "Pathologist verified lab findings attached to patient health record.",
    icon: "solar:diploma-verified-bold",
    category: "Clinical & Patient Care",
  },
  prescription_created: {
    severity: "warning",
    label: "New Drug Prescription (Rx)",
    description: "Physician prescribed medication regimen, dosage, or infusion order.",
    icon: "solar:pill-bold",
    category: "Clinical & Patient Care",
  },
  pharmacy_dispensed: {
    severity: "normal",
    label: "Hospital Dispensary Fulfilled",
    description: "Pharmacist dispensed prescribed pharmaceuticals to ward or patient.",
    icon: "solar:box-minimalistic-bold",
    category: "Pharmacy & Dispensary",
  },
  low_stock_alert: {
    severity: "warning",
    label: "Critical Pharmacy Low Stock",
    description: "Hospital formulary drug or emergency medical supply depleted below threshold.",
    icon: "solar:shield-warning-bold",
    category: "Pharmacy & Dispensary",
  },
  patient_appointment_created: {
    severity: "normal",
    label: "Outpatient Consultation Scheduled",
    description: "New clinical appointment assigned to practitioner calendar.",
    icon: "solar:calendar-mark-bold",
    category: "Clinical & Patient Care",
  },
  patient_appointment_cancelled: {
    severity: "warning",
    label: "Appointment Cancellation / No-Show",
    description: "Patient cancelled consultation or slot was released by reception.",
    icon: "solar:calendar-date-bold",
    category: "Clinical & Patient Care",
  },
  medical_leave_created: {
    severity: "normal",
    label: "Medical Certificate / Sick Leave Slip",
    description: "Formal medical certificate issued by attending physician.",
    icon: "solar:document-medicine-bold",
    category: "Clinical & Patient Care",
  },
  workflow_action: {
    severity: "warning",
    label: "Clinical Review & Signature Required",
    description: "Pending clinical approval, cross-consultation, or counter-signature.",
    icon: "solar:routing-bold",
    category: "Clinical Workflow & Collaboration",
  },
  workflow_approved: {
    severity: "normal",
    label: "Clinical Request Approved",
    description: "Diagnostic procedure or special patient intervention approved.",
    icon: "solar:check-read-bold",
    category: "Clinical Workflow & Collaboration",
  },
  workflow_rejected: {
    severity: "warning",
    label: "Clinical Request Rejected / Returned",
    description: "Requisition returned for clinical clarification or dosage modification.",
    icon: "solar:close-circle-bold",
    category: "Clinical Workflow & Collaboration",
  },
  comment_added: {
    severity: "normal",
    label: "Physician Progress / Consultation Note",
    description: "Clinician added a clinical progress note to patient encounter record.",
    icon: "solar:chat-round-dots-bold",
    category: "Clinical Workflow & Collaboration",
  },
  communication_received: {
    severity: "normal",
    label: "Secure Patient / Referral Message",
    description: "Direct physician-to-physician referral or patient portal message received.",
    icon: "solar:letter-bold",
    category: "Clinical Workflow & Collaboration",
  },
  document_shared: {
    severity: "normal",
    label: "Medical Record / Imaging Shared",
    description: "Confidential radiology imaging, scan, or pathology slip shared.",
    icon: "solar:share-bold",
    category: "Clinical Workflow & Collaboration",
  },
  system_error: {
    severity: "critical",
    label: "Hospital Core EHR Error",
    description: "Hospital information system service interruption or gateway alert.",
    icon: "solar:danger-bold",
    category: "Healthcare System & Security",
  },
  scheduled_job_failure: {
    severity: "critical",
    label: "Clinical Telemetry Sync Failure",
    description: "HL7/FHIR interface daemon, automated vitals ingest, or nightly audit failure.",
    icon: "solar:clock-circle-bold",
    category: "Healthcare System & Security",
  },
  error_log_created: {
    severity: "warning",
    label: "Clinical Diagnostic Audit Warning",
    description: "Non-fatal electronic medical record telemetry warning recorded.",
    icon: "solar:bug-bold-duotone",
    category: "Healthcare System & Security",
  },
  user_created: {
    severity: "normal",
    label: "Medical Staff Account Onboarding",
    description: "New resident, physician, nurse, or dispensary tech profile created.",
    icon: "solar:user-plus-bold",
    category: "Healthcare System & Security",
  },
  password_changed: {
    severity: "warning",
    label: "HIPAA Security / Credential Update",
    description: "Security credential or biometric access updated for your EHR account.",
    icon: "solar:key-bold",
    category: "Healthcare System & Security",
  },
};

const CATEGORIES = [
  { label: "Clinical & Patient Care", icon: "solar:stethoscope-bold", color: "text-emerald-500" },
  { label: "Pharmacy & Dispensary", icon: "solar:pill-bold", color: "text-purple-500" },
  { label: "Clinical Workflow & Collaboration", icon: "solar:routing-bold", color: "text-primary" },
  { label: "Healthcare System & Security", icon: "solar:shield-check-bold", color: "text-amber-500" },
];

const SHIFT_MUTE_PRESETS = [
  { label: "30 Min (Rounds)", minutes: 30 },
  { label: "1 Hour (Consultation)", minutes: 60 },
  { label: "2 Hours (Surgery)", minutes: 120 },
  { label: "4 Hours (Rest Break)", minutes: 240 },
  { label: "8 Hours (Shift End)", minutes: 480 },
  { label: "12 Hours (Off-Duty)", minutes: 720 },
];

// Synthesize medical alert chime using HTML5 Web Audio API
function playClinicalAlertTone(severity: "critical" | "warning" | "normal" = "critical") {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    if (severity === "critical") {
      // Urgent double tone medical pager beep (880Hz -> 1174Hz)
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.setValueAtTime(1174, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.35);
    } else if (severity === "warning") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(659.25, ctx.currentTime);
      gain.gain.setValueAtTime(0.14, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.25);
    } else {
      osc.type = "sine";
      osc.frequency.setValueAtTime(523.25, ctx.currentTime);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.2);
    }
  } catch {
    // Ignore audio context autoplay restrictions
  }
}

// ── Main Component ─────────────────────────────────────────────

export default function UserNotificationPrefsPage() {
  const [preferences, setPreferences] = useState<UserPreference[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingEvent, setSavingEvent] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [isMuted, setIsMuted] = useState(false);
  const [muteUntil, setMuteUntil] = useState<string | null>(null);

  // Simulation test modal
  const [simulatedAlert, setSimulatedAlert] = useState<{
    event: string;
    title: string;
    desc: string;
    severity: "critical" | "warning" | "normal";
  } | null>(null);

  const fetchPreferences = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiClient.get<UserPreference[]>({
        url: "/roles/user-notification-settings/my_preferences/",
      });
      setPreferences(data || []);

      const muted = data?.find((p) => p.effective?.muted);
      if (muted && muted.effective.mute_until) {
        setIsMuted(true);
        setMuteUntil(muted.effective.mute_until);
      } else {
        setIsMuted(false);
        setMuteUntil(null);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPreferences();
  }, [fetchPreferences]);

  const updatePreferenceField = useCallback(
    async (event: string, field: string, value: boolean | null) => {
      setSavingEvent(event);
      try {
        await apiClient.post({
          url: "/roles/user-notification-settings/set_preference/",
          data: {
            event,
            [field]: value,
          },
        });
        await fetchPreferences();
      } catch {
        // fallback to standard API
        try {
          const existing = preferences.find((p) => p.event === event);
          if (existing?.user_override?.id) {
            await apiClient.put({
              url: `/roles/user-notification-settings/${existing.user_override.id}/`,
              data: { [field]: value },
            });
          } else {
            await apiClient.post({
              url: "/roles/user-notification-settings/",
              data: { event, [field]: value },
            });
          }
          await fetchPreferences();
        } catch {
          // silently fail
        }
      } finally {
        setSavingEvent(null);
      }
    },
    [preferences, fetchPreferences]
  );

  const resetSinglePreference = useCallback(
    async (event: string) => {
      setSavingEvent(event);
      try {
        await apiClient.post({
          url: "/roles/user-notification-settings/set_preference/",
          data: { event, reset: true },
        });
        await fetchPreferences();
      } catch {
        // silently fail
      } finally {
        setSavingEvent(null);
      }
    },
    [fetchPreferences]
  );

  const muteShift = useCallback(
    async (minutes: number) => {
      try {
        await apiClient.post({
          url: "/roles/user-notification-settings/mute_all/",
          data: { minutes },
        });
        await fetchPreferences();
      } catch {
        // silently fail
      }
    },
    [fetchPreferences]
  );

  const unmuteShift = useCallback(async () => {
    try {
      await apiClient.post({
        url: "/roles/user-notification-settings/unmute_all/",
      });
      await fetchPreferences();
    } catch {
      // silently fail
    }
  }, [fetchPreferences]);

  const resetAllToHospitalGlobal = useCallback(async () => {
    if (!window.confirm("Reset all personal notification overrides to Hospital Global Policy?")) {
      return;
    }
    try {
      await apiClient.post({
        url: "/roles/user-notification-settings/reset_to_global/",
      });
      await fetchPreferences();
    } catch {
      // silently fail
    }
  }, [fetchPreferences]);

  const applyPreset = useCallback(
    async (preset: "critical_only" | "enable_all") => {
      try {
        await apiClient.post({
          url: "/roles/user-notification-settings/bulk_preset/",
          data: { preset },
        });
        await fetchPreferences();
      } catch {
        // silently fail
      }
    },
    [fetchPreferences]
  );

  const triggerTestAlert = useCallback(
    (eventKey: string) => {
      const meta = CLINICAL_EVENT_META[eventKey] || {
        severity: "normal",
        label: eventKey.replace(/_/g, " "),
        description: "Clinical alert dispatch simulation",
      };
      playClinicalAlertTone(meta.severity);
      setSimulatedAlert({
        event: eventKey,
        title: meta.label,
        desc: meta.description,
        severity: meta.severity,
      });
    },
    []
  );

  // ── Metrics Computed ─────────────────────────────────────────

  const totalEvents = preferences.length;
  const activeAlerts = useMemo(
    () => preferences.filter((p) => p.effective.enabled).length,
    [preferences]
  );
  const overriddenCount = useMemo(
    () => preferences.filter((p) => p.user_override !== null).length,
    [preferences]
  );
  const criticalCount = useMemo(
    () =>
      preferences.filter(
        (p) =>
          CLINICAL_EVENT_META[p.event]?.severity === "critical" && p.effective.enabled
      ).length,
    [preferences]
  );

  // ── Filtered Events ──────────────────────────────────────────

  const filteredPreferences = useMemo(() => {
    return preferences.filter((pref) => {
      const meta = CLINICAL_EVENT_META[pref.event];
      const category = meta?.category || "Clinical & Patient Care";
      const severity = meta?.severity || "normal";

      // Category filter
      if (selectedCategory && category !== selectedCategory) {
        return false;
      }

      // Severity filter
      if (severityFilter !== "all" && severity !== severityFilter) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const label = (meta?.label || pref.event_display).toLowerCase();
        const desc = (meta?.description || "").toLowerCase();
        const code = pref.event.toLowerCase();
        if (!label.includes(q) && !desc.includes(q) && !code.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [preferences, selectedCategory, severityFilter, searchQuery]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-72 gap-3">
        <Icon icon="solar:stethoscope-bold" size={36} className="animate-pulse text-primary" />
        <Text variant="subTitle2" color="secondary">
          Loading Clinical Notification Preferences & Telemetry Settings...
        </Text>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* ── Top Header Banner ─────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-5 rounded-xl border bg-card/60 backdrop-blur shadow-xs">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-primary/10 text-primary">
              <Icon icon="solar:bell-bing-bold" size={26} />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <Text variant="subTitle1" className="text-xl font-bold tracking-tight">
                  My Clinical Notification Preferences
                </Text>
                <Badge variant="success" className="text-xs font-semibold px-2">
                  <Icon icon="solar:shield-check-bold" size={12} className="mr-1" />
                  EHR Connected
                </Badge>
                {isMuted ? (
                  <Badge variant="warning" className="text-xs font-semibold px-2">
                    <Icon icon="solar:volume-mute-bold" size={12} className="mr-1" />
                    Quiet Hours Active
                  </Badge>
                ) : (
                  <Badge variant="info" className="text-xs font-semibold px-2">
                    <Icon icon="solar:radar-bold" size={12} className="mr-1" />
                    Live Clinical Telemetry
                  </Badge>
                )}
              </div>
              <Text variant="body2" color="secondary" className="mt-0.5">
                Configure your personalized doctor / nurse alert channels, emergency vital signs alarms, and off-duty quiet hours.
              </Text>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => triggerTestAlert("vital_signs_alert")}
            className="text-destructive border-destructive/30 hover:bg-destructive/10"
          >
            <Icon icon="solar:volume-loud-bold" size={16} className="mr-1.5" />
            Test Emergency Chime
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={resetAllToHospitalGlobal}
            disabled={overriddenCount === 0}
            title="Remove your personal overrides and use default hospital clinical policy"
          >
            <Icon icon="solar:restart-bold" size={16} className="mr-1.5" />
            Reset to Hospital Policy ({overriddenCount})
          </Button>
        </div>
      </div>

      {/* ── KPI Metric Cards ──────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 border shadow-xs hover:border-primary/40 transition-colors">
          <div className="flex items-center justify-between">
            <Text variant="caption" color="secondary" className="font-semibold uppercase tracking-wider text-[11px]">
              Active Clinical Alerts
            </Text>
            <div className="p-2 rounded-md bg-emerald-500/10 text-emerald-500">
              <Icon icon="solar:bell-check-bold" size={18} />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold">{activeAlerts}</span>
            <span className="text-xs text-muted-foreground">/ {totalEvents} enabled</span>
          </div>
          <div className="mt-1 flex items-center text-xs text-emerald-600 font-medium">
            <Icon icon="solar:check-circle-bold" size={13} className="mr-1" />
            {Math.round((activeAlerts / (totalEvents || 1)) * 100)}% coverage
          </div>
        </Card>

        <Card className="p-4 border shadow-xs hover:border-primary/40 transition-colors">
          <div className="flex items-center justify-between">
            <Text variant="caption" color="secondary" className="font-semibold uppercase tracking-wider text-[11px]">
              Personalized Overrides
            </Text>
            <div className="p-2 rounded-md bg-primary/10 text-primary">
              <Icon icon="solar:user-hand-up-bold" size={18} />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold">{overriddenCount}</span>
            <span className="text-xs text-muted-foreground">custom rules</span>
          </div>
          <div className="mt-1 flex items-center text-xs text-muted-foreground">
            {overriddenCount === 0 ? "Using 100% hospital defaults" : "Practitioner-tailored settings"}
          </div>
        </Card>

        <Card className="p-4 border shadow-xs hover:border-primary/40 transition-colors">
          <div className="flex items-center justify-between">
            <Text variant="caption" color="secondary" className="font-semibold uppercase tracking-wider text-[11px]">
              Critical Alarms Armed
            </Text>
            <div className="p-2 rounded-md bg-destructive/10 text-destructive">
              <Icon icon="solar:danger-triangle-bold" size={18} />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold">{criticalCount}</span>
            <span className="text-xs text-destructive font-medium">Active High Acuity</span>
          </div>
          <div className="mt-1 flex items-center text-xs text-muted-foreground">
            <Icon icon="solar:shield-warning-bold" size={13} className="mr-1 text-destructive" />
            Bypasses quiet hours
          </div>
        </Card>

        <Card className="p-4 border shadow-xs hover:border-primary/40 transition-colors">
          <div className="flex items-center justify-between">
            <Text variant="caption" color="secondary" className="font-semibold uppercase tracking-wider text-[11px]">
              Practitioner Shift Mode
            </Text>
            <div className={`p-2 rounded-md ${isMuted ? "bg-amber-500/10 text-amber-500" : "bg-emerald-500/10 text-emerald-500"}`}>
              <Icon icon={isMuted ? "solar:moon-sleep-bold" : "solar:sun-2-bold"} size={18} />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-lg font-bold">{isMuted ? "Quiet Hours" : "Standard Duty"}</span>
          </div>
          <div className="mt-1 text-xs text-muted-foreground truncate">
            {isMuted && muteUntil ? `Until ${new Date(muteUntil).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "All dispatch active"}
          </div>
        </Card>
      </div>

      {/* ── Practitioner Shift & Quiet Hours Control Panel ───── */}
      <Card className="p-5 border bg-linear-to-r from-card via-card to-primary/5 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Icon
                icon={isMuted ? "solar:volume-mute-bold" : "solar:volume-loud-bold"}
                size={22}
                className={isMuted ? "text-amber-500" : "text-emerald-500"}
              />
              <Text variant="subTitle2" className="font-semibold text-base">
                {isMuted ? "Quiet Hours Activated (Clinical Routine Muted)" : "Shift Routine & Paging Quiet Hours"}
              </Text>
            </div>
            <p className="text-xs text-muted-foreground max-w-2xl">
              Temporarily mute routine scheduling and administrative notifications during clinical rounds, surgery, or off-duty hours.
              <span className="text-destructive font-medium ml-1">
                Note: Vital Signs Alarms and Critical System Failures remain prioritized and will not be missed.
              </span>
            </p>
          </div>

          <div>
            {isMuted ? (
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-xs font-medium text-amber-600 dark:text-amber-400">
                    Quiet until: {muteUntil ? new Date(muteUntil).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Active"}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {muteUntil ? new Date(muteUntil).toLocaleDateString() : ""}
                  </div>
                </div>
                <Button variant="default" size="sm" onClick={unmuteShift} className="bg-emerald-600 hover:bg-emerald-700">
                  <Icon icon="solar:bell-bold" size={16} className="mr-1.5" />
                  Resume Full Shift Paging
                </Button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-1.5">
                <Text variant="caption" color="secondary" className="mr-1 font-medium">
                  Quick Quiet:
                </Text>
                {SHIFT_MUTE_PRESETS.map((preset) => (
                  <Button
                    key={preset.minutes}
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs px-2.5"
                    onClick={() => muteShift(preset.minutes)}
                  >
                    <Icon icon="solar:clock-circle-bold" size={13} className="mr-1 text-muted-foreground" />
                    {preset.label}
                  </Button>
                ))}
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* ── Search, Severity & Category Filters ──────────────── */}
      <div className="space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search bar */}
          <div className="relative flex-1 max-w-md">
            <Icon
              icon="solar:magnifer-bold"
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              type="text"
              placeholder="Search clinical events (e.g. vital signs, lab, prescription)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {/* Quick Acuity Filters */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs text-muted-foreground mr-1">Severity:</span>
            {[
              { id: "all", label: "All Levels" },
              { id: "critical", label: "🔴 Critical / Panic" },
              { id: "warning", label: "🟡 Priority / High" },
              { id: "normal", label: "🟢 Routine" },
            ].map((btn) => (
              <Button
                key={btn.id}
                variant={severityFilter === btn.id ? "default" : "outline"}
                size="sm"
                className="h-8 text-xs px-2.5"
                onClick={() => setSeverityFilter(btn.id)}
              >
                {btn.label}
              </Button>
            ))}

            <Separator orientation="vertical" className="h-5 mx-1" />

            {/* Quick Bulk Presets */}
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs px-2.5"
              onClick={() => applyPreset("critical_only")}
              title="Mute routine events and keep only emergency clinical alarms"
            >
              <Icon icon="solar:danger-triangle-bold" size={13} className="mr-1 text-destructive" />
              Emergency Alarms Only
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs px-2.5"
              onClick={() => applyPreset("enable_all")}
              title="Enable all alerts for active clinical shift"
            >
              <Icon icon="solar:check-circle-bold" size={13} className="mr-1 text-emerald-500" />
              Full On-Duty Mode
            </Button>
          </div>
        </div>

        {/* Category Tabs */}
        <div className="flex gap-2 flex-wrap pt-1">
          <Button
            variant={selectedCategory === null ? "default" : "outline"}
            size="sm"
            className="h-8 text-xs"
            onClick={() => setSelectedCategory(null)}
          >
            All Categories ({preferences.length})
          </Button>
          {CATEGORIES.map((cat) => {
            const count = preferences.filter(
              (p) => CLINICAL_EVENT_META[p.event]?.category === cat.label
            ).length;
            return (
              <Button
                key={cat.label}
                variant={selectedCategory === cat.label ? "default" : "outline"}
                size="sm"
                className="h-8 text-xs"
                onClick={() => setSelectedCategory(cat.label)}
              >
                <Icon icon={cat.icon} size={15} className={`mr-1.5 ${cat.color}`} />
                {cat.label} ({count})
              </Button>
            );
          })}
        </div>
      </div>

      {/* ── Event Rows List ───────────────────────────────────── */}
      <div className="border rounded-xl bg-card overflow-hidden shadow-xs divide-y">
        {/* Table header bar */}
        <div className="bg-muted/40 px-5 py-3 flex items-center justify-between text-xs font-semibold text-muted-foreground">
          <div className="flex items-center gap-2">
            <span>CLINICAL EVENT & PATIENT CARE REVISION</span>
          </div>
          <div className="flex items-center gap-8 pr-2">
            <span className="w-16 text-center">MASTER ON</span>
            <span className="w-16 text-center">EMAIL</span>
            <span className="w-16 text-center">EHR BELL</span>
            <span className="w-16 text-center">URGENT</span>
            <span className="w-20 text-right">ACTIONS</span>
          </div>
        </div>

        {filteredPreferences.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground space-y-2">
            <Icon icon="solar:magnifer-outline" size={32} className="mx-auto text-muted-foreground/50" />
            <Text variant="subTitle2">No matching clinical notification events found</Text>
            <p className="text-xs">Try adjusting your search criteria or category filter.</p>
          </div>
        ) : (
          filteredPreferences.map((pref) => {
            const meta = CLINICAL_EVENT_META[pref.event] || {
              severity: "normal",
              label: pref.event_display,
              description: "Healthcare event notification",
              icon: "solar:bell-bold",
              category: "Clinical & Patient Care",
            };
            const isSaving = savingEvent === pref.event;
            const isCustom = pref.user_override !== null;
            const isMutedEvent = pref.effective.muted;

            return (
              <div
                key={pref.event}
                className={`p-4 transition-colors hover:bg-muted/30 flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                  !pref.effective.enabled ? "opacity-60 bg-muted/10" : ""
                }`}
              >
                {/* Event info */}
                <div className="flex items-start gap-3.5 flex-1 min-w-0">
                  <div
                    className={`mt-0.5 p-2 rounded-lg shrink-0 ${
                      meta.severity === "critical"
                        ? "bg-destructive/15 text-destructive"
                        : meta.severity === "warning"
                        ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                        : "bg-primary/10 text-primary"
                    }`}
                  >
                    <Icon icon={meta.icon} size={20} />
                  </div>

                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-foreground">
                        {meta.label}
                      </span>

                      {/* Severity badge */}
                      {meta.severity === "critical" && (
                        <Badge variant="destructive" className="text-[10px] uppercase font-bold tracking-wider py-0 px-1.5">
                          Critical / Panic
                        </Badge>
                      )}
                      {meta.severity === "warning" && (
                        <Badge variant="warning" className="text-[10px] uppercase font-semibold tracking-wider py-0 px-1.5">
                          Priority
                        </Badge>
                      )}
                      {meta.severity === "normal" && (
                        <Badge variant="outline" className="text-[10px] text-muted-foreground py-0 px-1.5">
                          Routine
                        </Badge>
                      )}

                      {/* Override status */}
                      {isCustom ? (
                        <Badge variant="info" className="text-[10px] py-0 px-1.5">
                          Customized
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] text-muted-foreground/70 py-0 px-1.5">
                          Hospital Policy
                        </Badge>
                      )}

                      {isMutedEvent && (
                        <Badge variant="warning" className="text-[10px] py-0 px-1.5">
                          Muted
                        </Badge>
                      )}
                    </div>

                    <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                      {meta.description}
                    </p>

                    {/* Global setting reference hint if customized */}
                    {isCustom && pref.global_setting && (
                      <div className="text-[11px] text-muted-foreground/80 flex items-center gap-2 pt-0.5">
                        <span className="font-medium">Policy Default:</span>
                        <span>{pref.global_setting.enabled ? "Active" : "Disabled"}</span>
                        <span>•</span>
                        <span>Email: {pref.global_setting.send_email ? "Yes" : "No"}</span>
                        <span>•</span>
                        <span>EHR: {pref.global_setting.send_dashboard ? "Yes" : "No"}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Interactive Channel Controls */}
                <div className="flex items-center justify-between md:justify-end gap-6 shrink-0 pt-2 md:pt-0 border-t md:border-t-0">
                  {/* Master toggle */}
                  <div className="w-16 flex flex-col items-center">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={pref.effective.enabled}
                        disabled={isSaving}
                        onChange={() =>
                          updatePreferenceField(
                            pref.event,
                            "enabled",
                            pref.user_override?.enabled === true ? false : true
                          )
                        }
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                    </label>
                    <span className="text-[10px] text-muted-foreground mt-0.5">
                      {pref.effective.enabled ? "Active" : "Off"}
                    </span>
                  </div>

                  {/* Email toggle */}
                  <div className="w-16 flex flex-col items-center">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={pref.effective.send_email}
                        disabled={isSaving || !pref.effective.enabled}
                        onChange={() =>
                          updatePreferenceField(
                            pref.event,
                            "send_email",
                            pref.user_override?.send_email === true ? false : true
                          )
                        }
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                    <span className="text-[10px] text-muted-foreground mt-0.5">
                      {pref.effective.send_email ? "Yes" : "No"}
                    </span>
                  </div>

                  {/* EHR Dashboard Bell toggle */}
                  <div className="w-16 flex flex-col items-center">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={pref.effective.send_dashboard}
                        disabled={isSaving || !pref.effective.enabled}
                        onChange={() =>
                          updatePreferenceField(
                            pref.event,
                            "send_dashboard",
                            pref.user_override?.send_dashboard === true ? false : true
                          )
                        }
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                    <span className="text-[10px] text-muted-foreground mt-0.5">
                      {pref.effective.send_dashboard ? "Yes" : "No"}
                    </span>
                  </div>

                  {/* Urgent System / Paging toggle */}
                  <div className="w-16 flex flex-col items-center">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={pref.effective.send_system}
                        disabled={isSaving || !pref.effective.enabled}
                        onChange={() =>
                          updatePreferenceField(
                            pref.event,
                            "send_system",
                            pref.user_override?.send_system === true ? false : true
                          )
                        }
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
                    </label>
                    <span className="text-[10px] text-muted-foreground mt-0.5">
                      {pref.effective.send_system ? "Yes" : "No"}
                    </span>
                  </div>

                  {/* Row Actions */}
                  <div className="w-20 flex items-center justify-end gap-1">
                    {/* Play test audio */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      onClick={() => triggerTestAlert(pref.event)}
                      title="Simulate / Test Notification"
                    >
                      <Icon icon="solar:play-circle-bold" size={17} />
                    </Button>

                    {/* Reset single override */}
                    {isCustom && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => resetSinglePreference(pref.event)}
                        disabled={isSaving}
                        title="Revert this event to hospital default"
                      >
                        <Icon icon="solar:restart-bold" size={16} />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ── Simulated Alert Preview Dialog ────────────────────── */}
      <Dialog open={!!simulatedAlert} onOpenChange={(open) => !open && setSimulatedAlert(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Icon
                icon={
                  simulatedAlert?.severity === "critical"
                    ? "solar:danger-triangle-bold"
                    : simulatedAlert?.severity === "warning"
                    ? "solar:bell-bold"
                    : "solar:check-circle-bold"
                }
                size={22}
                className={
                  simulatedAlert?.severity === "critical"
                    ? "text-destructive"
                    : simulatedAlert?.severity === "warning"
                    ? "text-amber-500"
                    : "text-emerald-500"
                }
              />
              Simulated Clinical EHR Alert
            </DialogTitle>
          </DialogHeader>

          {simulatedAlert && (
            <div className="space-y-4 py-2">
              <div
                className={`p-4 rounded-xl border ${
                  simulatedAlert.severity === "critical"
                    ? "bg-destructive/10 border-destructive/30"
                    : simulatedAlert.severity === "warning"
                    ? "bg-amber-500/10 border-amber-500/30"
                    : "bg-primary/10 border-primary/30"
                }`}
              >
                <div className="flex items-center justify-between">
                  <Badge
                    variant={
                      simulatedAlert.severity === "critical"
                        ? "destructive"
                        : simulatedAlert.severity === "warning"
                        ? "warning"
                        : "default"
                    }
                    className="text-xs uppercase"
                  >
                    {simulatedAlert.severity} PRIORITY
                  </Badge>
                  <span className="text-xs text-muted-foreground">Just now • Room 304</span>
                </div>
                <h4 className="mt-2 font-bold text-base">{simulatedAlert.title}</h4>
                <p className="mt-1 text-xs text-muted-foreground">{simulatedAlert.desc}</p>
                <div className="mt-3 text-xs bg-background/80 p-2.5 rounded-lg border font-mono">
                  <div>Patient: <strong>Jane Doe (HN-94812)</strong></div>
                  <div>Attending: <strong>Dr. Sarah Jenkins</strong></div>
                  <div>Acuity: <strong>STAT Paging Dispatched</strong></div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Audio tone synthesized via HTML5 AudioContext frequency.
              </p>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (simulatedAlert) playClinicalAlertTone(simulatedAlert.severity);
              }}
            >
              <Icon icon="solar:volume-loud-bold" size={16} className="mr-1.5" />
              Replay Tone
            </Button>
            <Button variant="default" size="sm" onClick={() => setSimulatedAlert(null)}>
              Dismiss Alert
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
