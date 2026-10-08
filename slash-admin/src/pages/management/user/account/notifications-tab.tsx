import { Icon } from "@/components/icon";
import apiClient from "@/api/apiClient";
import { Button } from "@/ui/button";
import { Badge } from "@/ui/badge";
import { Text } from "@/ui/typography";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

// ── Types ──────────────────────────────────────────────────────

interface UserPreference {
  event: string;
  event_display: string;
  user_override: {
    enabled: boolean | null;
    send_email: boolean | null;
    send_dashboard: boolean | null;
    send_system: boolean | null;
    mute_until: string | null;
  } | null;
  global_setting: {
    enabled: boolean;
    send_email: boolean;
    send_dashboard: boolean;
    send_system: boolean;
  } | null;
  effective: {
    enabled: boolean;
    send_email: boolean;
    send_dashboard: boolean;
    send_system: boolean;
    muted: boolean;
    mute_until?: string;
  };
}

// ── Event categories ───────────────────────────────────────────

const CATEGORIES = [
  {
    label: "Workflow",
    icon: "solar:routing-bold",
    color: "text-primary",
    events: ["workflow_approved", "workflow_rejected", "workflow_action"],
  },
  {
    label: "Documents",
    icon: "solar:document-text-bold",
    color: "text-info",
    events: ["sales_order_submitted", "purchase_order_submitted", "quotation_submitted", "document_shared"],
  },
  {
    label: "Communication",
    icon: "solar:chat-round-dots-bold",
    color: "text-success",
    events: ["comment_added", "communication_received"],
  },
  {
    label: "System",
    icon: "solar:settings-bold",
    color: "text-warning",
    events: ["error_log_created", "low_stock_alert", "system_error", "scheduled_job_failure", "user_created", "password_changed"],
  },
];

const MUTE_OPTIONS = [
  { label: "30 min", minutes: 30 },
  { label: "1 hour", minutes: 60 },
  { label: "4 hours", minutes: 240 },
  { label: "24 hours", minutes: 1440 },
];

// ── Main Component ─────────────────────────────────────────────

export default function NotificationsTab() {
  const [preferences, setPreferences] = useState<UserPreference[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [muteUntil, setMuteUntil] = useState<string | null>(null);

  const fetchPreferences = useCallback(async () => {
    try {
      const data = await apiClient.get<UserPreference[]>({
        url: "/roles/user-notification-settings/my_preferences/",
      });
      setPreferences(data);
      const muted = data.find((p) => p.effective.muted);
      setIsMuted(!!muted);
      setMuteUntil(muted?.effective.mute_until || null);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPreferences();
  }, [fetchPreferences]);

  const togglePref = useCallback(async (event: string, field: string) => {
    setSaving(event);
    try {
      const pref = preferences.find((p) => p.event === event);
      const currentVal = pref?.user_override?.[field as keyof typeof pref.user_override];
      const newVal = currentVal === true ? null : true;

      if (pref?.user_override) {
        // Find existing user setting ID
        const data = await apiClient.get<{ results: Array<{ id: number }> }>({
          url: "/roles/user-notification-settings/",
          params: { event },
        });
        const id = data.results?.[0]?.id;
        if (id) {
          await apiClient.put({ url: `/roles/user-notification-settings/${id}/`, data: { [field]: newVal } });
        }
      } else {
        await apiClient.post({ url: "/roles/user-notification-settings/", data: { event, [field]: newVal } });
      }
      await fetchPreferences();
    } catch {
      toast.error("Failed to update preference");
    } finally {
      setSaving(null);
    }
  }, [preferences, fetchPreferences]);

  const muteAll = useCallback(async (minutes: number) => {
    try {
      await apiClient.post({ url: "/roles/user-notification-settings/mute_all/", data: { minutes } });
      await fetchPreferences();
      toast.success(`Notifications muted for ${minutes} minutes`);
    } catch {
      toast.error("Failed to mute notifications");
    }
  }, [fetchPreferences]);

  const unmuteAll = useCallback(async () => {
    try {
      await apiClient.post({ url: "/roles/user-notification-settings/unmute_all/" });
      await fetchPreferences();
      toast.success("Notifications unmuted");
    } catch {
      toast.error("Failed to unmute");
    }
  }, [fetchPreferences]);

  const resetToGlobal = useCallback(async () => {
    try {
      await apiClient.post({ url: "/roles/user-notification-settings/reset_to_global/" });
      await fetchPreferences();
      toast.success("Reset to global defaults");
    } catch {
      toast.error("Failed to reset");
    }
  }, [fetchPreferences]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Icon icon="solar:refresh-bold" size={20} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  const overriddenCount = preferences.filter((p) => p.user_override !== null).length;

  return (
    <div className="space-y-6 max-w-3xl mx-auto p-4">
      {/* Mute bar */}
      <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted/30">
        <Icon icon="solar:volume-mute-bold" size={20} className={isMuted ? "text-warning" : "text-muted-foreground"} />
        <div className="flex-1">
          <Text variant="subTitle2">
            {isMuted
              ? `Muted until ${muteUntil ? new Date(muteUntil).toLocaleString() : "..."}`
              : "Temporarily mute all notifications"}
          </Text>
        </div>
        {isMuted ? (
          <Button variant="outline" size="sm" onClick={unmuteAll}>
            <Icon icon="solar:volume-bold" size={14} className="mr-1" />
            Unmute
          </Button>
        ) : (
          <div className="flex gap-1">
            {MUTE_OPTIONS.map((opt) => (
              <Button key={opt.minutes} variant="outline" size="sm" onClick={() => muteAll(opt.minutes)}>
                {opt.label}
              </Button>
            ))}
          </div>
        )}
      </div>

      {/* Overrides summary */}
      <div className="flex items-center justify-between">
        <Text variant="subTitle2">Notification Preferences</Text>
        <div className="flex items-center gap-2">
          {overriddenCount > 0 && <Badge variant="info">{overriddenCount} custom</Badge>}
          <Button variant="outline" size="sm" onClick={resetToGlobal}>Reset to Global</Button>
        </div>
      </div>

      {/* Categories */}
      {CATEGORIES.map((cat) => (
        <div key={cat.label} className="border rounded-lg overflow-hidden">
          <div className="bg-muted/30 px-4 py-2 flex items-center gap-2">
            <Icon icon={cat.icon} size={16} className={cat.color} />
            <Text variant="subTitle2" className="text-sm">{cat.label}</Text>
          </div>
          <div className="divide-y">
            {cat.events.map((eventCode) => {
              const pref = preferences.find((p) => p.event === eventCode);
              if (!pref) return null;
              const eff = pref.effective;
              const isOverridden = pref.user_override !== null;
              return (
                <div key={eventCode} className="px-4 py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${
                      eff.muted ? "bg-warning" : eff.enabled ? "bg-success" : "bg-muted-foreground"
                    }`} />
                    <Text variant="caption" className="font-medium">{pref.event_display}</Text>
                    {isOverridden && <Badge variant="info" className="text-[9px] px-1">Custom</Badge>}
                  </div>
                  <div className="flex items-center gap-3">
                    {(["send_email", "send_dashboard", "send_system"] as const).map((ch) => {
                      const label = ch === "send_email" ? "Email" : ch === "send_dashboard" ? "Dashboard" : "System";
                      const icon = ch === "send_email" ? "solar:letter-bold" : ch === "send_dashboard" ? "solar:widget-5-bold" : "solar:bell-bold";
                      const isActive = eff[ch];
                      return (
                        <button
                          key={ch}
                          className={`flex items-center gap-1 text-[11px] px-2 py-1 rounded transition-colors ${
                            isActive ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                          } ${saving === eventCode ? "opacity-50" : ""}`}
                          onClick={() => togglePref(eventCode, ch)}
                          disabled={saving === eventCode}
                        >
                          <Icon icon={icon} size={12} />
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
