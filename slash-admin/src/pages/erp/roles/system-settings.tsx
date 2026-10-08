import { Icon } from "@/components/icon";
import { Button } from "@/ui/button";
import { Card, CardContent, CardHeader } from "@/ui/card";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { Switch } from "@/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/ui/tabs";
import { useEffect, useState, useCallback } from "react";
import apiClient from "@/api/apiClient";

// ── API ──────────────────────────────────────────────────────────
const SystemSettingsApi = {
  get: () => apiClient.get({ url: "/roles/system-settings/" }),
  update: (data: Record<string, any>) =>
    apiClient.put({ url: "/roles/system-settings/", data }),
};

// ── Constants ────────────────────────────────────────────────────
const COUNTRIES = [
  "United States", "United Kingdom", "Canada", "Australia", "Germany",
  "France", "India", "Japan", "China", "Brazil", "Nigeria", "South Africa",
  "UAE", "Saudi Arabia", "Netherlands", "Italy", "Spain", "Mexico",
  "Indonesia", "Turkey", "Egypt", "Kenya", "Ethiopia", "Ghana", "Pakistan",
  "Bangladesh", "Sri Lanka", "Philippines", "Vietnam", "Thailand",
];

const CURRENCIES = [
  { code: "USD", name: "US Dollar", symbol: "$" },
  { code: "EUR", name: "Euro", symbol: "€" },
  { code: "GBP", name: "British Pound", symbol: "£" },
  { code: "JPY", name: "Japanese Yen", symbol: "¥" },
  { code: "CNY", name: "Chinese Yuan", symbol: "¥" },
  { code: "INR", name: "Indian Rupee", symbol: "₹" },
  { code: "AUD", name: "Australian Dollar", symbol: "A$" },
  { code: "CAD", name: "Canadian Dollar", symbol: "C$" },
  { code: "CHF", name: "Swiss Franc", symbol: "Fr" },
  { code: "BRL", name: "Brazilian Real", symbol: "R$" },
  { code: "NGN", name: "Nigerian Naira", symbol: "₦" },
  { code: "ZAR", name: "South African Rand", symbol: "R" },
  { code: "AED", name: "UAE Dirham", symbol: "د.إ" },
  { code: "SAR", name: "Saudi Riyal", symbol: "﷼" },
  { code: "EGP", name: "Egyptian Pound", symbol: "E£" },
  { code: "KES", name: "Kenyan Shilling", symbol: "KSh" },
  { code: "ETB", name: "Ethiopian Birr", symbol: "Br" },
  { code: "GHS", name: "Ghanaian Cedi", symbol: "GH₵" },
  { code: "PKR", name: "Pakistani Rupee", symbol: "₨" },
  { code: "BDT", name: "Bangladeshi Taka", symbol: "৳" },
];

const LANGUAGES = [
  { code: "en", name: "English" },
  { code: "es", name: "Spanish" },
  { code: "fr", name: "French" },
  { code: "de", name: "German" },
  { code: "zh", name: "Chinese" },
  { code: "ja", name: "Japanese" },
  { code: "pt", name: "Portuguese" },
  { code: "ar", name: "Arabic" },
  { code: "hi", name: "Hindi" },
  { code: "sw", name: "Swahili" },
];

const TIMEZONES = [
  "UTC", "US/Eastern", "US/Central", "US/Pacific", "Europe/London",
  "Europe/Paris", "Europe/Berlin", "Asia/Dubai", "Asia/Kolkata",
  "Asia/Shanghai", "Asia/Tokyo", "Australia/Sydney", "Africa/Lagos",
  "Africa/Nairobi", "Africa/Addis_ABaba", "Africa/Accra",
  "Africa/Johannesburg", "America/Sao_Paulo", "America/Mexico_City",
];

const DATE_FORMATS = [
  { value: "yyyy-MM-dd", label: "2026-09-02 (ISO)" },
  { value: "dd/MM/yyyy", label: "02/09/2026 (UK)" },
  { value: "MM/dd/yyyy", label: "09/02/2026 (US)" },
  { value: "dd.MM.yyyy", label: "02.09.2026 (DE)" },
  { value: "dd-MMM-yyyy", label: "02-Sep-2026" },
];

const TIME_FORMATS = [
  { value: "HH:mm:ss", label: "24h (14:30:00)" },
  { value: "hh:mm A", label: "12h (02:30 PM)" },
  { value: "HH:mm", label: "24h short (14:30)" },
];

const NUMBER_FORMATS = [
  { value: "#,###.##", label: "1,234.56" },
  { value: "#.###,##", label: "1.234,56 (EU)" },
  { value: "#,###", label: "1,234" },
  { value: "# ##", label: "1 234 (space)" },
];

const WEEKDAYS = ["Monday", "Sunday", "Saturday"];

// ── Main Component ───────────────────────────────────────────────
export default function SystemSettingsPage() {
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res: any = await SystemSettingsApi.get();
      setSettings(res.data || res || {});
    } catch (err) {
      console.error("Failed to load settings:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const updateSetting = (key: string, value: any) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await SystemSettingsApi.update(settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error("Failed to save settings:", err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </CardContent>
      </Card>
    );
  }

  const selectedCurrency = CURRENCIES.find((c) => c.code === settings.currency);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon icon="mdi:cog-outline" size={22} className="text-primary" />
            <span className="text-lg font-semibold">System Settings</span>
          </div>
          <div className="flex items-center gap-2">
            {saved && (
              <span className="text-sm text-success flex items-center gap-1">
                <Icon icon="mdi:check-circle" size={16} /> Saved
              </span>
            )}
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent mr-2" />
              ) : (
                <Icon icon="mdi:content-save" size={16} className="mr-1" />
              )}
              Save Settings
            </Button>
          </div>
        </div>
        <p className="text-sm text-text-secondary">
          Configure system-wide defaults, regional settings, security policies,
          and application behavior.
        </p>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="general">
          <TabsList className="mb-6">
            <TabsTrigger value="general" className="gap-1">
              <Icon icon="mdi:home-outline" size={14} /> General
            </TabsTrigger>
            <TabsTrigger value="regional" className="gap-1">
              <Icon icon="mdi:earth" size={14} /> Regional
            </TabsTrigger>
            <TabsTrigger value="security" className="gap-1">
              <Icon icon="mdi:shield-lock-outline" size={14} /> Security
            </TabsTrigger>
            <TabsTrigger value="system" className="gap-1">
              <Icon icon="mdi:cog-outline" size={14} /> System
            </TabsTrigger>
          </TabsList>

          {/* ═══ GENERAL TAB ═══════════════════════════════════════ */}
          <TabsContent value="general" className="space-y-6">
            {/* Company Info */}
            <Section title="Company Information" icon="mdi:office-building-outline">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Application Name">
                  <Input
                    value={settings.app_name || ""}
                    onChange={(e) => updateSetting("app_name", e.target.value)}
                    placeholder="Healthcare System"
                  />
                </Field>
                <Field label="Country">
                  <Select
                    value={settings.country || ""}
                    onValueChange={(v) => updateSetting("country", v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select country" />
                    </SelectTrigger>
                    <SelectContent>
                      {COUNTRIES.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <Field label="Default Language">
                <Select
                  value={settings.language || "en"}
                  onValueChange={(v) => updateSetting("language", v)}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.map((l) => (
                      <SelectItem key={l.code} value={l.code}>{l.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </Section>

            {/* Currency */}
            <Section title="Currency" icon="mdi:currency-usd">
              <div className="grid grid-cols-3 gap-4">
                <Field label="Default Currency">
                  <Select
                    value={settings.currency || "USD"}
                    onValueChange={(v) => updateSetting("currency", v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((c) => (
                        <SelectItem key={c.code} value={c.code}>
                          {c.symbol} {c.code} — {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Currency Precision">
                  <Select
                    value={String(settings.currency_precision || "2")}
                    onValueChange={(v) => updateSetting("currency_precision", v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[0, 1, 2, 3, 4, 5].map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n} decimal{n !== 1 ? "s" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Float Precision">
                  <Select
                    value={String(settings.float_precision || "3")}
                    onValueChange={(v) => updateSetting("float_precision", v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n} decimal{n !== 1 ? "s" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              {selectedCurrency && (
                <div className="rounded-lg bg-muted/30 p-3 text-xs text-text-secondary">
                  Preview: <span className="font-semibold text-foreground">{selectedCurrency.symbol}1,234.{settings.currency_precision === "0" ? "00" : "56"}</span>
                  {" "}({selectedCurrency.name}, {settings.currency_precision || 2} decimal places)
                </div>
              )}
            </Section>
          </TabsContent>

          {/* ═══ REGIONAL TAB ══════════════════════════════════════ */}
          <TabsContent value="regional" className="space-y-6">
            {/* Date & Time */}
            <Section title="Date & Time" icon="mdi:calendar-clock">
              <div className="grid grid-cols-3 gap-4">
                <Field label="Time Zone">
                  <Select
                    value={settings.time_zone || "UTC"}
                    onValueChange={(v) => updateSetting("time_zone", v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIMEZONES.map((tz) => (
                        <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Date Format">
                  <Select
                    value={settings.date_format || "yyyy-MM-dd"}
                    onValueChange={(v) => updateSetting("date_format", v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DATE_FORMATS.map((d) => (
                        <SelectItem key={d.value} value={d.value}>
                          {d.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Time Format">
                  <Select
                    value={settings.time_format || "HH:mm:ss"}
                    onValueChange={(v) => updateSetting("time_format", v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIME_FORMATS.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            </Section>

            {/* Number Format */}
            <Section title="Number Format" icon="mdi:format-list-numbered">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Number Format">
                  <Select
                    value={settings.number_format || "#,###.##"}
                    onValueChange={(v) => updateSetting("number_format", v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {NUMBER_FORMATS.map((n) => (
                        <SelectItem key={n.value} value={n.value}>
                          {n.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="First Day of Week">
                  <Select
                    value={settings.first_day_of_the_week || "Monday"}
                    onValueChange={(v) => updateSetting("first_day_of_the_week", v)}
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {WEEKDAYS.map((d) => (
                        <SelectItem key={d} value={d}>{d}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            </Section>
          </TabsContent>

          {/* ═══ SECURITY TAB ══════════════════════════════════════ */}
          <TabsContent value="security" className="space-y-6">
            {/* Login Options */}
            <Section title="Login Options" icon="mdi:login">
              <div className="grid grid-cols-2 gap-4">
                <Toggle
                  label="Allow Login Using Mobile Number"
                  checked={settings.allow_login_using_mobile_number}
                  onChange={(v) => updateSetting("allow_login_using_mobile_number", v)}
                />
                <Toggle
                  label="Allow Login Using Username"
                  checked={settings.allow_login_using_user_name}
                  onChange={(v) => updateSetting("allow_login_using_user_name", v)}
                />
                <Toggle
                  label="Disable Username/Password Login"
                  checked={settings.disable_user_pass_login}
                  onChange={(v) => updateSetting("disable_user_pass_login", v)}
                />
                <Toggle
                  label="Deny Multiple Sessions"
                  checked={settings.deny_multiple_sessions}
                  onChange={(v) => updateSetting("deny_multiple_sessions", v)}
                />
              </div>
            </Section>

            {/* Password Policy */}
            <Section title="Password Policy" icon="mdi:key-variant">
              <div className="grid grid-cols-2 gap-4">
                <Toggle
                  label="Enable Password Policy"
                  checked={settings.enable_password_policy}
                  onChange={(v) => updateSetting("enable_password_policy", v)}
                />
                <Field label="Minimum Password Score (0-4)">
                  <Select
                    value={String(settings.minimum_password_score || "2")}
                    onValueChange={(v) => updateSetting("minimum_password_score", v)}
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["0", "1", "2", "3", "4"].map((s) => (
                        <SelectItem key={s} value={s}>
                          {s} — {["Very Weak", "Weak", "Fair", "Strong", "Very Strong"][parseInt(s)]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Max Signups Per Hour (0=unlimited)">
                  <Input
                    type="number"
                    value={settings.max_signups_allowed_per_hour || 0}
                    onChange={(e) => updateSetting("max_signups_allowed_per_hour", parseInt(e.target.value) || 0)}
                  />
                </Field>
                <Field label="Force Password Reset (days, 0=never)">
                  <Input
                    type="number"
                    value={settings.force_user_to_reset_password || 0}
                    onChange={(e) => updateSetting("force_user_to_reset_password", parseInt(e.target.value) || 0)}
                  />
                </Field>
              </div>
            </Section>

            {/* Session */}
            <Section title="Session Management" icon="mdi:clock-outline">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Session Expiry (HH:MM)">
                  <Input
                    value={settings.session_expiry || "06:00"}
                    onChange={(e) => updateSetting("session_expiry", e.target.value)}
                    placeholder="06:00"
                    className="w-32"
                  />
                </Field>
                <Field label="Password Reset Link Limit">
                  <Input
                    type="number"
                    value={settings.password_reset_limit || 5}
                    onChange={(e) => updateSetting("password_reset_limit", parseInt(e.target.value) || 5)}
                    className="w-32"
                  />
                </Field>
              </div>
            </Section>

            {/* Two-Factor Auth */}
            <Section title="Two-Factor Authentication" icon="mdi:two-factor-authentication">
              <div className="grid grid-cols-2 gap-4">
                <Toggle
                  label="Enable Two-Factor Authentication"
                  checked={settings.enable_two_factor_auth}
                  onChange={(v) => updateSetting("enable_two_factor_auth", v)}
                />
                {settings.enable_two_factor_auth && (
                  <Field label="2FA Method">
                    <Select
                      value={settings.two_factor_method || "OTP App"}
                      onValueChange={(v) => updateSetting("two_factor_method", v)}
                    >
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="OTP App">OTP App</SelectItem>
                        <SelectItem value="Email">Email</SelectItem>
                        <SelectItem value="SMS">SMS</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                )}
              </div>
            </Section>
          </TabsContent>

          {/* ═══ SYSTEM TAB ════════════════════════════════════════ */}
          <TabsContent value="system" className="space-y-6">
            {/* Files & Uploads */}
            <Section title="Files & Uploads" icon="mdi:file-upload-outline">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Max File Size (bytes)">
                  <Input
                    type="number"
                    value={settings.max_file_size || 10485760}
                    onChange={(e) => updateSetting("max_file_size", parseInt(e.target.value) || 10485760)}
                  />
                  <p className="text-[10px] text-text-secondary mt-1">
                    Current: {((settings.max_file_size || 10485760) / 1048576).toFixed(1)} MB
                  </p>
                </Field>
                <Toggle
                  label="Allow Guests to Upload Files"
                  checked={settings.allow_guests_to_upload_files}
                  onChange={(v) => updateSetting("allow_guests_to_upload_files", v)}
                />
                <Toggle
                  label="Strip EXIF Metadata from Images"
                  checked={settings.strip_exif_metadata_from_uploaded_images}
                  onChange={(v) => updateSetting("strip_exif_metadata_from_uploaded_images", v)}
                />
              </div>
            </Section>

            {/* Scheduler & Reports */}
            <Section title="Scheduler & Reports" icon="mdi:timer-cog-outline">
              <div className="grid grid-cols-2 gap-4">
                <Toggle
                  label="Enable Scheduler"
                  checked={settings.enable_scheduler}
                  onChange={(v) => updateSetting("enable_scheduler", v)}
                />
                <Field label="Max Report Rows">
                  <Input
                    type="number"
                    value={settings.max_report_rows || 10000}
                    onChange={(e) => updateSetting("max_report_rows", parseInt(e.target.value) || 10000)}
                  />
                </Field>
              </div>
            </Section>

            {/* Backups */}
            <Section title="Backups" icon="mdi:backup-restore">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Backup Limit">
                  <Input
                    type="number"
                    value={settings.backup_limit || 3}
                    onChange={(e) => updateSetting("backup_limit", parseInt(e.target.value) || 3)}
                    className="w-24"
                  />
                </Field>
                <Toggle
                  label="Encrypt Backups"
                  checked={settings.encrypt_backup}
                  onChange={(v) => updateSetting("encrypt_backup", v)}
                />
              </div>
            </Section>

            {/* Debugging */}
            <Section title="Debugging & Logging" icon="mdi:bug-outline">
              <div className="grid grid-cols-2 gap-4">
                <Toggle
                  label="Allow Error Traceback"
                  checked={settings.allow_error_traceback}
                  onChange={(v) => updateSetting("allow_error_traceback", v)}
                />
                <Toggle
                  label="Log API Requests"
                  checked={settings.log_api_requests}
                  onChange={(v) => updateSetting("log_api_requests", v)}
                />
                <Toggle
                  label="Enable Telemetry"
                  checked={settings.enable_telemetry}
                  onChange={(v) => updateSetting("enable_telemetry", v)}
                />
              </div>
            </Section>

            {/* Setup Status */}
            <Section title="Setup" icon="mdi:check-decagram">
              <div className="grid grid-cols-2 gap-4">
                <Toggle
                  label="Setup Complete"
                  checked={settings.setup_complete}
                  onChange={(v) => updateSetting("setup_complete", v)}
                />
              </div>
            </Section>
          </TabsContent>
        </Tabs>

        {/* Save Bar (bottom) */}
        <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t">
          {saved && (
            <span className="text-sm text-success flex items-center gap-1">
              <Icon icon="mdi:check-circle" size={16} /> Settings saved successfully
            </span>
          )}
          <Button onClick={handleSave} disabled={saving} size="lg">
            {saving ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent mr-2" />
            ) : (
              <Icon icon="mdi:content-save" size={16} className="mr-1" />
            )}
            Save All Settings
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Helper Components ────────────────────────────────────────────
function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border">
      <div className="flex items-center gap-2 px-4 py-3 bg-muted/30 border-b">
        <Icon icon={icon as any} size={16} className="text-primary" />
        <span className="text-sm font-semibold">{title}</span>
      </div>
      <div className="p-4 space-y-4">{children}</div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border px-4 py-3">
      <span className="text-sm">{label}</span>
      <Switch checked={!!checked} onCheckedChange={onChange} />
    </div>
  );
}
