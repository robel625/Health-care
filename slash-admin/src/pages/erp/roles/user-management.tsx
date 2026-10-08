import { Icon } from "@/components/icon";
import Avatar from "@/components/Avatar";
import apiClient from "@/api/apiClient";
import { Button } from "@/ui/button";
import { Badge } from "@/ui/badge";
import { Separator } from "@/ui/separator";
import { Text } from "@/ui/typography";
import { ScrollArea } from "@/ui/scroll-area";
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";

// ── Types ──────────────────────────────────────────────────────

interface UserData {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  is_staff: boolean;
  is_superuser: boolean;
  date_joined: string;
  last_login: string;
  roles: string[];
  all_roles: Array<{ id: number; name: string; desk_access: boolean }>;
  full_name: string;
  user_type: string;
}

// ── Main Component ─────────────────────────────────────────────

export default function UserManagementPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = !id || id === "new";

  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("basic");
  const [form, setForm] = useState({
    username: "",
    email: "",
    first_name: "",
    last_name: "",
    password: "",
    is_active: true,
    is_staff: false,
    is_superuser: false,
  });
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [allRoles, setAllRoles] = useState<Array<{ id: number; name: string; desk_access: boolean }>>([]);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchUser = useCallback(async () => {
    if (isNew || !id) return;
    try {
      setLoading(true);
      const data = await apiClient.get<UserData>({ url: `/roles/users/${id}/` });
      setUser(data);
      setForm({
        username: data.username,
        email: data.email,
        first_name: data.first_name || "",
        last_name: data.last_name || "",
        password: "",
        is_active: data.is_active,
        is_staff: data.is_staff,
        is_superuser: data.is_superuser,
      });
      setSelectedRoles(data.roles || []);
      setAllRoles(data.all_roles || []);
    } catch {
      setMessage({ type: "error", text: "Failed to load user" });
    } finally {
      setLoading(false);
    }
  }, [id, isNew]);

  useEffect(() => {
    fetchUser();
    if (isNew) {
      // Fetch all roles for new users
      apiClient.get<{ results: Array<{ id: number; name: string; desk_access: boolean }> }>({
        url: "/roles/roles/",
        params: { page_size: 100 },
      }).then((res) => setAllRoles(res.results || []));
    }
  }, [fetchUser, isNew]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setMessage(null);
    try {
      let userId = id;
      if (isNew) {
        const created = await apiClient.post<{ id: number }>({
          url: "/roles/users/",
          data: form,
        });
        userId = String(created.id);
      } else {
        const updateData: any = { ...form };
        if (!updateData.password) delete updateData.password;
        await apiClient.put({ url: `/roles/users/${userId}/`, data: updateData });
      }

      // Save roles
      if (userId) {
        await apiClient.post({
          url: `/roles/users/${userId}/roles/`,
          data: { roles: selectedRoles },
        });
      }

      setMessage({ type: "success", text: isNew ? "User created successfully" : "User updated successfully" });
      if (isNew && userId) {
        navigate(`/erp/users/${userId}`, { replace: true });
      } else {
        await fetchUser();
      }
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.response?.data?.username?.[0] || "Save failed";
      setMessage({ type: "error", text: msg });
    } finally {
      setSaving(false);
    }
  }, [id, isNew, form, selectedRoles, navigate, fetchUser]);

  const handleResetPassword = useCallback(async () => {
    if (!id) return;
    const newPass = prompt("Enter new password:", "admin123");
    if (!newPass) return;
    try {
      await apiClient.post({
        url: `/roles/users/${id}/reset_password/`,
        data: { new_password: newPass },
      });
      setMessage({ type: "success", text: "Password reset successfully" });
    } catch {
      setMessage({ type: "error", text: "Failed to reset password" });
    }
  }, [id]);

  const handleToggleActive = useCallback(async () => {
    if (!id) return;
    try {
      const res = await apiClient.post<{ is_active: boolean }>({
        url: `/roles/users/${id}/toggle_active/`,
      });
      setForm((prev) => ({ ...prev, is_active: res.is_active }));
      setMessage({ type: "success", text: `User ${res.is_active ? "enabled" : "disabled"}` });
    } catch {
      setMessage({ type: "error", text: "Failed to toggle user status" });
    }
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Icon icon="solar:refresh-bold" size={24} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  const TABS = [
    { key: "basic", label: "Basic Info", icon: "solar:user-circle-bold" },
    { key: "roles", label: "Roles", icon: "solar:shield-user-bold", badge: selectedRoles.length },
    { key: "auth", label: "Auth & Security", icon: "solar:lock-bold" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/erp/users")}>
            <Icon icon="solar:arrow-left-bold" size={20} />
          </Button>
          <div>
            <Text variant="subTitle1" className="flex items-center gap-2 text-lg font-semibold">
              <Icon icon="solar:user-circle-bold" size={24} className="text-primary" />
              {isNew ? "New User" : user?.full_name || form.username}
            </Text>
            {!isNew && user && (
              <Text variant="caption" color="secondary">
                {user.email} • {user.user_type} • Joined {new Date(user.date_joined).toLocaleDateString()}
              </Text>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {message && (
            <Badge variant={message.type === "success" ? "success" : "destructive"}>
              {message.text}
            </Badge>
          )}
          {!isNew && (
            <>
              <Button variant="outline" size="sm" onClick={handleResetPassword}>
                <Icon icon="solar:key-bold" size={16} className="mr-1" />
                Reset Password
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleToggleActive}
              >
                {form.is_active ? "Disable" : "Enable"}
              </Button>
            </>
          )}
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <Icon icon="solar:refresh-bold" size={16} className="mr-1 animate-spin" />
            ) : (
              <Icon icon="solar:check-read-bold" size={16} className="mr-1" />
            )}
            {isNew ? "Create User" : "Save Changes"}
          </Button>
        </div>
      </div>

      <Separator />

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setActiveTab(tab.key)}
          >
            <Icon icon={tab.icon} size={16} />
            {tab.label}
            {tab.badge !== undefined && tab.badge > 0 && (
              <Badge variant="secondary" className="text-[10px] px-1.5 ml-1">{tab.badge}</Badge>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <ScrollArea className="h-[calc(100vh-280px)]">
        {activeTab === "basic" && (
          <BasicInfoTab form={form} setForm={setForm} isNew={isNew} user={user} />
        )}
        {activeTab === "roles" && (
          <RolesTab
            selectedRoles={selectedRoles}
            setSelectedRoles={setSelectedRoles}
            allRoles={allRoles}
          />
        )}
        {activeTab === "auth" && (
          <AuthTab user={user} form={form} onResetPassword={handleResetPassword} onToggleActive={handleToggleActive} />
        )}
      </ScrollArea>
    </div>
  );
}

// ── Basic Info Tab ─────────────────────────────────────────────

function BasicInfoTab({
  form,
  setForm,
  isNew,
  user,
}: {
  form: any;
  setForm: (f: any) => void;
  isNew: boolean;
  user: UserData | null;
}) {
  const update = (field: string, value: any) => setForm((prev: any) => ({ ...prev, [field]: value }));

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Avatar & Name */}
      <div className="flex items-start gap-6">
        <Avatar
          initials={(form.first_name?.[0] || form.username?.[0] || "?").toUpperCase()}
          size="xl"
          className="w-20 h-20 text-xl bg-primary/10 text-primary"
        />
        <div className="flex-1 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <InputField label="First Name" value={form.first_name} onChange={(v) => update("first_name", v)} />
            <InputField label="Last Name" value={form.last_name} onChange={(v) => update("last_name", v)} />
          </div>
          <InputField label="Full Name" value={`${form.first_name} ${form.last_name}`.trim()} onChange={() => {}} disabled />
        </div>
      </div>

      <Separator />

      {/* Account Info */}
      <Text variant="subTitle2" className="flex items-center gap-2">
        <Icon icon="solar:user-id-bold" size={16} />
        Account Information
      </Text>

      <div className="space-y-3">
        <InputField
          label="Username"
          value={form.username}
          onChange={(v) => update("username", v)}
          placeholder="e.g. john_doe"
          required
        />
        <InputField
          label="Email"
          type="email"
          value={form.email}
          onChange={(v) => update("email", v)}
          placeholder="e.g. john@example.com"
          required
        />
        {isNew && (
          <InputField
            label="Password"
            type="password"
            value={form.password}
            onChange={(v) => update("password", v)}
            placeholder="Set initial password"
            required
          />
        )}
      </div>

      <Separator />

      {/* User Type */}
      <Text variant="subTitle2" className="flex items-center gap-2">
        <Icon icon="solar:shield-check-bold" size={16} />
        User Type
      </Text>

      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={form.is_staff}
            onChange={(e) => update("is_staff", e.target.checked)}
            className="rounded"
          />
          <Text variant="caption">Staff User (can access admin panel)</Text>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={form.is_superuser}
            onChange={(e) => update("is_superuser", e.target.checked)}
            className="rounded"
          />
          <Text variant="caption">Superuser (full access)</Text>
        </label>
      </div>

      {/* Meta info */}
      {user && (
        <>
          <Separator />
          <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
            <div>
              <Text variant="caption" color="secondary">Date Joined</Text>
              <Text variant="caption">{new Date(user.date_joined).toLocaleString()}</Text>
            </div>
            <div>
              <Text variant="caption" color="secondary">Last Login</Text>
              <Text variant="caption">{user.last_login ? new Date(user.last_login).toLocaleString() : "Never"}</Text>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Roles Tab ──────────────────────────────────────────────────

function RolesTab({
  selectedRoles,
  setSelectedRoles,
  allRoles,
}: {
  selectedRoles: string[];
  setSelectedRoles: (roles: string[]) => void;
  allRoles: Array<{ id: number; name: string; desk_access: boolean }>;
}) {
  const toggleRole = (roleName: string) => {
    if (selectedRoles.includes(roleName)) {
      setSelectedRoles(selectedRoles.filter((r) => r !== roleName));
    } else {
      setSelectedRoles([...selectedRoles, roleName]);
    }
  };

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center justify-between">
        <Text variant="subTitle2" className="flex items-center gap-2">
          <Icon icon="solar:shield-user-bold" size={16} />
          Assigned Roles ({selectedRoles.length})
        </Text>
      </div>

      {/* Selected roles */}
      {selectedRoles.length > 0 && (
        <div className="flex flex-wrap gap-2 p-3 border rounded-lg bg-muted/30">
          {selectedRoles.map((role) => (
            <button
              key={role}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/80 transition-colors"
              onClick={() => toggleRole(role)}
            >
              {role}
              <Icon icon="solar:close-circle-bold" size={14} />
            </button>
          ))}
        </div>
      )}

      <Separator />

      {/* Available roles */}
      <div className="space-y-4">
        {/* Healthcare Roles */}
        <div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 mb-2">
            <Icon icon="solar:shield-cross-bold" size={16} />
            Healthcare & Clinical Roles
          </div>
          <div className="grid grid-cols-2 gap-2">
            {allRoles
              .filter((r) => [
                "Healthcare Administrator", "Physician", "Nurse", "Nursing User",
                "Pharmacist", "Lab Technician", "Laboratory User", "LabTest Approver",
                "Receptionist", "Patient"
              ].includes(r.name))
              .map((role) => {
                const isSelected = selectedRoles.includes(role.name);
                return (
                  <button
                    key={role.id}
                    className={`flex items-center justify-between p-3 rounded-lg border text-left transition-colors ${
                      isSelected
                        ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30"
                        : "border-border hover:bg-accent/50"
                    }`}
                    onClick={() => toggleRole(role.name)}
                  >
                    <div className="flex items-center gap-2">
                      <Icon
                        icon={isSelected ? "solar:check-circle-bold" : "solar:add-circle-bold"}
                        size={18}
                        className={isSelected ? "text-emerald-600" : "text-muted-foreground"}
                      />
                      <div>
                        <Text variant="caption" className="font-semibold text-emerald-800 dark:text-emerald-200">{role.name}</Text>
                      </div>
                    </div>
                  </button>
                );
              })}
          </div>
        </div>

        {/* Other Roles */}
        <div>
          <div className="text-xs font-semibold text-muted-foreground mb-2">
            System & Other Roles
          </div>
          <div className="grid grid-cols-2 gap-2">
            {allRoles
              .filter((r) => ![
                "Healthcare Administrator", "Physician", "Nurse", "Nursing User",
                "Pharmacist", "Lab Technician", "Laboratory User", "LabTest Approver",
                "Receptionist", "Patient"
              ].includes(r.name))
              .map((role) => {
                const isSelected = selectedRoles.includes(role.name);
                return (
                  <button
                    key={role.id}
                    className={`flex items-center justify-between p-3 rounded-lg border text-left transition-colors ${
                      isSelected
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-accent/50"
                    }`}
                    onClick={() => toggleRole(role.name)}
                  >
                    <div className="flex items-center gap-2">
                      <Icon
                        icon={isSelected ? "solar:check-circle-bold" : "solar:add-circle-bold"}
                        size={18}
                        className={isSelected ? "text-primary" : "text-muted-foreground"}
                      />
                      <div>
                        <Text variant="caption" className="font-medium">{role.name}</Text>
                      </div>
                    </div>
                  </button>
                );
              })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Auth Tab ───────────────────────────────────────────────────

function AuthTab({
  user,
  form,
  onResetPassword,
  onToggleActive,
}: {
  user: UserData | null;
  form: any;
  onResetPassword: () => void;
  onToggleActive: () => void;
}) {
  return (
    <div className="space-y-6 max-w-2xl">
      <Text variant="subTitle2" className="flex items-center gap-2">
        <Icon icon="solar:lock-bold" size={16} />
        Authentication
      </Text>

      {/* Status */}
      <div className="flex items-center gap-4 p-4 border rounded-lg">
        <div className={`w-3 h-3 rounded-full ${form.is_active ? "bg-success" : "bg-destructive"}`} />
        <div className="flex-1">
          <Text variant="subTitle2">Account Status</Text>
          <Text variant="caption" color="secondary">
            {form.is_active ? "Account is active and can log in" : "Account is disabled"}
          </Text>
        </div>
        <Button variant="outline" size="sm" onClick={onToggleActive}>
          {form.is_active ? "Disable Account" : "Enable Account"}
        </Button>
      </div>

      {/* Password */}
      <div className="flex items-center gap-4 p-4 border rounded-lg">
        <Icon icon="solar:key-bold" size={20} className="text-muted-foreground" />
        <div className="flex-1">
          <Text variant="subTitle2">Password</Text>
          <Text variant="caption" color="secondary">
            Reset the user's password. They will need to use the new password to log in.
          </Text>
        </div>
        <Button variant="outline" size="sm" onClick={onResetPassword}>
          <Icon icon="solar:restart-bold" size={14} className="mr-1" />
          Reset Password
        </Button>
      </div>

      {/* Permissions summary */}
      {user && (
        <div className="p-4 border rounded-lg">
          <Text variant="subTitle2" className="flex items-center gap-2 mb-3">
            <Icon icon="solar:shield-check-bold" size={16} />
            Role Summary
          </Text>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">User Type</span>
              <Badge variant={user.user_type === "System User" ? "default" : "secondary"}>
                {user.user_type}
              </Badge>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Staff Access</span>
              <Badge variant={user.is_staff ? "success" : "secondary"}>
                {user.is_staff ? "Yes" : "No"}
              </Badge>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Superuser</span>
              <Badge variant={user.is_superuser ? "destructive" : "secondary"}>
                {user.is_superuser ? "Yes" : "No"}
              </Badge>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Assigned Roles</span>
              <span className="font-medium">{user.roles.length}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Shared Input ───────────────────────────────────────────────

function InputField({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  required,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1">
        {label} {required && <span className="text-destructive">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full px-3 py-2 rounded-md border bg-background text-sm disabled:opacity-50"
      />
    </div>
  );
}
