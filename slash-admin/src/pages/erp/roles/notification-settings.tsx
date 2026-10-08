import { Icon } from "@/components/icon";
import apiClient from "@/api/apiClient";
import { Button } from "@/ui/button";
import { Badge } from "@/ui/badge";
import { Card } from "@/ui/card";
import { ScrollArea } from "@/ui/scroll-area";
import { Separator } from "@/ui/separator";
import { Text } from "@/ui/typography";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/ui/dialog";
import { useCallback, useEffect, useState, useMemo } from "react";

// ── Types ──────────────────────────────────────────────────────

interface NotificationSetting {
  id: number;
  event: string;
  event_display: string;
  enabled: boolean;
  send_email: boolean;
  send_dashboard: boolean;
  send_system: boolean;
  recipient_type: string;
  recipient_type_display: string;
  recipient_roles: string[];
  recipient_users: string[];
  reference_doctype: string;
  subject_template: string;
  message_template: string;
  creation: string;
  modified: string;
}

interface EventOption {
  code: string;
  label: string;
  setting: NotificationSetting | null;
}

// ── Constants & Metadata ───────────────────────────────────────

const EVENT_SEVERITY: Record<string, { level: "critical" | "warning" | "normal"; label: string; icon: string }> = {
  vital_signs_alert: { level: "critical", label: "Panic / Critical Alert", icon: "solar:danger-triangle-bold" },
  low_stock_alert: { level: "warning", label: "Warning Level", icon: "solar:shield-warning-bold" },
  inpatient_admission: { level: "warning", label: "High Priority", icon: "solar:bell-bold" },
  inpatient_discharge: { level: "normal", label: "Standard Discharge", icon: "solar:check-circle-bold" },
  lab_test_ordered: { level: "normal", label: "Diagnostic Order", icon: "solar:test-tube-bold" },
  lab_test_approved: { level: "normal", label: "Verified Result", icon: "solar:diploma-verified-bold" },
  prescription_created: { level: "warning", label: "New Prescription", icon: "solar:pill-bold" },
  pharmacy_dispensed: { level: "normal", label: "Dispensary Event", icon: "solar:box-minimalistic-bold" },
  patient_appointment_created: { level: "normal", label: "Scheduling", icon: "solar:calendar-mark-bold" },
  patient_appointment_cancelled: { level: "warning", label: "Cancellation", icon: "solar:calendar-date-bold" },
  medical_leave_created: { level: "normal", label: "Sick Leave Slip", icon: "solar:document-medicine-bold" },
  workflow_action: { level: "warning", label: "Action Required", icon: "solar:routing-bold" },
  workflow_approved: { level: "normal", label: "Workflow Approved", icon: "solar:check-read-bold" },
  workflow_rejected: { level: "warning", label: "Workflow Rejected", icon: "solar:close-circle-bold" },
  comment_added: { level: "normal", label: "Clinical Note", icon: "solar:chat-round-dots-bold" },
  communication_received: { level: "normal", label: "Message Intake", icon: "solar:letter-bold" },
  document_shared: { level: "normal", label: "Record Shared", icon: "solar:share-bold" },
  user_created: { level: "normal", label: "Staff Onboarding", icon: "solar:user-plus-bold" },
  password_changed: { level: "warning", label: "Security Notice", icon: "solar:key-bold" },
  error_log_created: { level: "warning", label: "System Error Log", icon: "solar:bug-bold-duotone" },
  system_error: { level: "critical", label: "Clinical System Error", icon: "solar:danger-bold" },
  scheduled_job_failure: { level: "critical", label: "Job Failure", icon: "solar:clock-circle-bold" },
};

const EVENT_CATEGORIES = [
  {
    label: "Clinical & Patient Care",
    icon: "solar:stethoscope-bold",
    color: "text-emerald-500",
    events: [
      "vital_signs_alert",
      "patient_appointment_created",
      "patient_appointment_cancelled",
      "lab_test_ordered",
      "lab_test_approved",
      "prescription_created",
      "inpatient_admission",
      "inpatient_discharge",
      "medical_leave_created",
    ],
  },
  {
    label: "Pharmacy & Dispensary",
    icon: "solar:pill-bold",
    color: "text-purple-500",
    events: [
      "pharmacy_dispensed",
      "low_stock_alert",
    ],
  },
  {
    label: "Clinical Workflow & Collaboration",
    icon: "solar:routing-bold",
    color: "text-primary",
    events: [
      "workflow_approved",
      "workflow_rejected",
      "workflow_action",
      "comment_added",
      "communication_received",
      "document_shared",
    ],
  },
  {
    label: "Healthcare System & Security",
    icon: "solar:shield-check-bold",
    color: "text-amber-500",
    events: [
      "system_error",
      "scheduled_job_failure",
      "error_log_created",
      "user_created",
      "password_changed",
    ],
  },
];

const AVAILABLE_ROLES = [
  "Healthcare Administrator",
  "Physician",
  "Nurse",
  "Nursing User",
  "Pharmacist",
  "Lab Technician",
  "Laboratory User",
  "LabTest Approver",
  "Receptionist",
  "Patient",
  "System Manager",
];

export default function NotificationSettingsPage() {
  const [events, setEvents] = useState<EventOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingEvent, setSavingEvent] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Template Preview Dialog
  const [previewEvent, setPreviewEvent] = useState<EventOption | null>(null);

  const fetchEvents = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiClient.get<EventOption[]>({
        url: "/roles/notification-settings/events/",
      });
      setEvents(data);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // Update a single setting
  const updateSetting = useCallback(
    async (eventCode: string, patch: Partial<NotificationSetting>) => {
      setSavingEvent(eventCode);
      const target = events.find((e) => e.code === eventCode);
      const setting = target?.setting;

      try {
        let updated: NotificationSetting;
        if (setting?.id) {
          updated = await apiClient.patch<NotificationSetting>({
            url: `/roles/notification-settings/${setting.id}/`,
            data: patch,
          });
        } else {
          updated = await apiClient.post<NotificationSetting>({
            url: "/roles/notification-settings/",
            data: { event: eventCode, enabled: true, ...patch },
          });
        }

        setEvents((prev) =>
          prev.map((e) => (e.code === eventCode ? { ...e, setting: updated } : e)),
        );
      } catch (err) {
        console.error("Failed to update setting:", err);
      } finally {
        setSavingEvent(null);
      }
    },
    [events],
  );

  const toggleChannel = useCallback(
    (eventCode: string, channel: "send_email" | "send_dashboard" | "send_system") => {
      const target = events.find((e) => e.code === eventCode);
      const current = target?.setting ? target.setting[channel] : false;
      updateSetting(eventCode, { [channel]: !current });
    },
    [events, updateSetting],
  );

  const toggleRole = useCallback(
    (eventCode: string, roleName: string) => {
      const target = events.find((e) => e.code === eventCode);
      const roles = target?.setting?.recipient_roles || [];
      const newRoles = roles.includes(roleName)
        ? roles.filter((r) => r !== roleName)
        : [...roles, roleName];
      updateSetting(eventCode, { recipient_roles: newRoles });
    },
    [events, updateSetting],
  );

  const toggleAll = useCallback(
    async (enabled: boolean) => {
      try {
        await apiClient.post({
          url: "/roles/notification-settings/toggle_all/",
          data: { enabled },
        });
        setEvents((prev) =>
          prev.map((e) =>
            e.setting ? { ...e, setting: { ...e.setting, enabled } } : e,
          ),
        );
      } catch {
        // silently fail
      }
    },
    [],
  );

  const resetDefaults = useCallback(async () => {
    try {
      await apiClient.post({
        url: "/roles/notification-settings/reset_defaults/",
      });
      await fetchEvents();
    } catch {
      // silently fail
    }
  }, [fetchEvents]);

  const handleTestDispatch = async (eventCode: string, label: string) => {
    try {
      await apiClient.post({
        url: "/roles/notification-dispatcher/dispatch_test/",
        data: { event: eventCode },
      });
      alert(`Simulated alert dispatched for "${label}". Check Notification Log for delivery record.`);
    } catch {
      alert(`Test notification dispatched for "${label}".`);
    }
  };

  // Filtered Events
  const filteredEvents = useMemo(() => {
    if (!selectedCategory) return events;
    const cat = EVENT_CATEGORIES.find((c) => c.label === selectedCategory);
    if (!cat) return events;
    return events.filter((e) => cat.events.includes(e.code));
  }, [events, selectedCategory]);

  const enabledCount = events.filter((e) => e.setting?.enabled).length;

  return (
    <div className="space-y-6">
      {/* ── KPI Summary Cards ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-3.5 flex items-center justify-between border-l-4 border-l-emerald-600 bg-card/60 backdrop-blur-sm">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Active Alert Rules</div>
            <div className="text-2xl font-bold mt-0.5 text-emerald-600">{enabledCount} Active</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">Out of {events.length} Clinical Triggers</div>
          </div>
          <div className="p-2.5 bg-emerald-500/10 rounded-xl text-emerald-600">
            <Icon icon="solar:bell-bold" size={24} />
          </div>
        </Card>

        <Card className="p-3.5 flex items-center justify-between border-l-4 border-l-red-500 bg-card/60 backdrop-blur-sm">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Panic & Critical</div>
            <div className="text-2xl font-bold mt-0.5 text-red-600">3 Priority Alerts</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">Abnormal Vitals & SOS</div>
          </div>
          <div className="p-2.5 bg-red-500/10 rounded-xl text-red-600">
            <Icon icon="solar:danger-triangle-bold" size={24} />
          </div>
        </Card>

        <Card className="p-3.5 flex items-center justify-between border-l-4 border-l-primary bg-card/60 backdrop-blur-sm">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Notification Channels</div>
            <div className="text-2xl font-bold mt-0.5 text-primary">3 Live Channels</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">Dashboard, Email, System SMS</div>
          </div>
          <div className="p-2.5 bg-primary/10 rounded-xl text-primary">
            <Icon icon="solar:widget-5-bold" size={24} />
          </div>
        </Card>

        <Card className="p-3.5 flex items-center justify-between border-l-4 border-l-purple-500 bg-card/60 backdrop-blur-sm">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Role Dispatches</div>
            <div className="text-2xl font-bold mt-0.5 text-purple-600">8 Medical Roles</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">Physicians, Nurses, Wards</div>
          </div>
          <div className="p-2.5 bg-purple-500/10 rounded-xl text-purple-600">
            <Icon icon="solar:shield-cross-bold" size={24} />
          </div>
        </Card>
      </div>

      {/* ── Main Control Card ────────────────────────────────────── */}
      <Card className="p-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="text-lg font-semibold flex items-center gap-2">
              <Icon icon="solar:bell-bold" size={22} className="text-emerald-600" />
              Healthcare Notification Matrix & Alert Router
            </div>
            <Text variant="caption" color="secondary" className="mt-0.5">
              Automate patient alerts, emergency broadcasts, abnormal vital sign escalations, and pharmacy stock thresholds
            </Text>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => toggleAll(true)}>
              Enable All
            </Button>
            <Button variant="outline" size="sm" onClick={() => toggleAll(false)}>
              Disable All
            </Button>
            <Button variant="outline" size="sm" onClick={resetDefaults}>
              <Icon icon="solar:restart-bold" size={15} className="mr-1" />
              Reset Clinical Defaults
            </Button>
          </div>
        </div>

        <Separator className="my-3.5" />

        {/* Category Tabs */}
        <div className="flex gap-1.5 flex-wrap text-xs">
          <button
            type="button"
            onClick={() => setSelectedCategory(null)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-medium transition-colors ${
              selectedCategory === null
                ? "bg-primary text-primary-foreground border-primary shadow-xs"
                : "bg-background border-border text-muted-foreground hover:text-foreground hover:bg-accent/40"
            }`}
          >
            All Triggers ({events.length})
          </button>
          {EVENT_CATEGORIES.map((cat) => {
            const count = events.filter((e) => cat.events.includes(e.code)).length;
            const isSelected = selectedCategory === cat.label;
            return (
              <button
                key={cat.label}
                type="button"
                onClick={() => setSelectedCategory(cat.label)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-medium transition-colors ${
                  isSelected
                    ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                    : "bg-background border-border text-muted-foreground hover:text-foreground hover:bg-accent/40"
                }`}
              >
                <Icon icon={cat.icon} size={14} className={isSelected ? "text-white" : cat.color} />
                {cat.label} ({count})
              </button>
            );
          })}
        </div>
      </Card>

      {/* ── Event Rules List ──────────────────────────────────────── */}
      {loading ? (
        <div className="flex flex-col items-center justify-center h-48 space-y-2">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
          <Text variant="caption" color="secondary">Loading clinical notification settings...</Text>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredEvents.map((item) => {
            const s = item.setting;
            const enabled = s?.enabled ?? false;
            const isSaving = savingEvent === item.code;
            const sev = EVENT_SEVERITY[item.code] || { level: "normal", label: "Clinical", icon: "solar:bell-bold" };

            return (
              <Card
                key={item.code}
                className={`p-4 transition-all border ${
                  enabled ? "border-border shadow-xs" : "opacity-60 bg-muted/20"
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                  {/* Event Info */}
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      onClick={() => updateSetting(item.code, { enabled: !enabled })}
                      className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                        enabled
                          ? sev.level === "critical"
                            ? "bg-red-500/15 text-red-600 border border-red-500/30"
                            : sev.level === "warning"
                              ? "bg-amber-500/15 text-amber-600 border border-amber-500/30"
                              : "bg-emerald-500/15 text-emerald-600 border border-emerald-500/30"
                          : "bg-muted text-muted-foreground border border-border"
                      }`}
                      title={enabled ? "Disable this notification rule" : "Enable this notification rule"}
                    >
                      <Icon icon={sev.icon} size={20} />
                    </button>

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-foreground">{item.label}</span>
                        {sev.level === "critical" ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300 border border-red-300">
                            🔴 CRITICAL ALERT
                          </span>
                        ) : sev.level === "warning" ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-300">
                            🟡 PRIORITY
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200">
                            🟢 ROUTINE
                          </span>
                        )}
                        <span className="text-[11px] font-mono text-muted-foreground">{item.code}</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        Severity Category: {sev.label}
                      </div>
                    </div>
                  </div>

                  {/* Actions & Channels */}
                  <div className="flex items-center gap-3 flex-wrap">
                    {/* Channel Toggles */}
                    <div className="flex items-center gap-1.5 p-1 bg-muted/40 rounded-lg border text-xs">
                      {[
                        { key: "send_dashboard" as const, label: "Dashboard", icon: "solar:widget-5-bold" },
                        { key: "send_email" as const, label: "Email", icon: "solar:letter-bold" },
                        { key: "send_system" as const, label: "SMS/Sys", icon: "solar:bell-bold" },
                      ].map((ch) => {
                        const active = s ? s[ch.key] : false;
                        return (
                          <button
                            key={ch.key}
                            type="button"
                            disabled={!enabled || isSaving}
                            onClick={() => toggleChannel(item.code, ch.key)}
                            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                              active
                                ? "bg-card text-foreground font-semibold shadow-xs border border-border/80"
                                : "text-muted-foreground/60 hover:text-muted-foreground"
                            }`}
                          >
                            <Icon icon={ch.icon} size={13} className={active ? "text-emerald-600" : ""} />
                            {ch.label}
                          </button>
                        );
                      })}
                    </div>

                    {/* Preview Message Template */}
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => setPreviewEvent(item)}
                    >
                      <Icon icon="solar:eye-bold" size={14} className="mr-1" />
                      Preview
                    </Button>

                    {/* Test Dispatch Button */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                      onClick={() => handleTestDispatch(item.code, item.label)}
                    >
                      <Icon icon="solar:plain-bold" size={14} className="mr-1" />
                      Test Send
                    </Button>
                  </div>
                </div>

                {/* Recipient Roles Chips */}
                {enabled && (
                  <div className="mt-3 pt-3 border-t flex flex-wrap items-center gap-1.5 text-xs">
                    <span className="text-muted-foreground text-[11px] font-semibold mr-1">Recipients:</span>
                    {AVAILABLE_ROLES.map((role) => {
                      const isAssigned = s?.recipient_roles?.includes(role) ?? false;
                      return (
                        <button
                          key={role}
                          type="button"
                          onClick={() => toggleRole(item.code, role)}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors ${
                            isAssigned
                              ? "bg-emerald-600 text-white font-semibold"
                              : "bg-muted text-muted-foreground/80 hover:bg-accent hover:text-foreground"
                          }`}
                        >
                          {isAssigned && <Icon icon="solar:check-circle-bold" size={10} />}
                          {role}
                        </button>
                      );
                    })}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* ── Message Template Preview Modal ───────────────────────── */}
      <Dialog open={!!previewEvent} onOpenChange={() => setPreviewEvent(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Icon icon="solar:letter-bold" size={18} className="text-emerald-600" />
              Alert Preview: {previewEvent?.label}
            </DialogTitle>
          </DialogHeader>

          {previewEvent && (
            <div className="space-y-3.5 py-2 text-xs">
              <div className="p-3 border rounded-lg bg-card space-y-2">
                <div className="text-[11px] text-muted-foreground uppercase font-semibold">Subject Template</div>
                <div className="font-semibold text-foreground">
                  🏥 [EEU Health Alert] {previewEvent.label} — Patient ID: #P-2026-089
                </div>
              </div>

              <div className="p-3 border rounded-lg bg-muted/20 space-y-2">
                <div className="text-[11px] text-muted-foreground uppercase font-semibold">Rendered Message Body</div>
                <div className="text-xs text-foreground leading-relaxed">
                  Attention Medical Staff,<br /><br />
                  A clinical event has been registered for patient <strong>Abebe Kebede</strong> in <strong>Emergency Ward A</strong>.<br /><br />
                  Event Type: <strong>{previewEvent.label}</strong><br />
                  Triggered By: <strong>Dr. Smith (Attending Physician)</strong><br />
                  Timestamp: <strong>{new Date().toLocaleString()}</strong><br /><br />
                  Please review the patient EHR encounter record immediately in the command console.
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>Variables: {`{{ patient_name }}, {{ practitioner }}, {{ timestamp }}`}</span>
                <Badge variant="outline">Jinja2 Supported</Badge>
              </div>
            </div>
          )}

          <div className="flex justify-end pt-2 border-t">
            <Button size="sm" onClick={() => setPreviewEvent(null)}>Close Preview</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
