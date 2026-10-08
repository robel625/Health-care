import { Icon } from "@/components/icon";
import apiClient from "@/api/apiClient";
import { Button } from "@/ui/button";
import { Badge } from "@/ui/badge";
import { Separator } from "@/ui/separator";
import { Text } from "@/ui/typography";
import { ScrollArea } from "@/ui/scroll-area";
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";

// ── Types ──────────────────────────────────────────────────────

interface RoleData {
  id: number;
  name: string;
  role_name: string;
  description: string;
  desk_access: boolean;
  disabled: boolean;
  is_custom: boolean;
  is_system_role: boolean;
  is_active: boolean;
  home_page: string;
  restrict_to_domain: string;
  two_factor_auth: boolean;
  users_count: number;
  doc_perms_count: number;
  creation: string;
}

interface PermMatrix {
  roles: Array<{
    id: number;
    name: string;
    desk_access: boolean;
    disabled: boolean;
    permissions: Record<string, Record<string, boolean>>;
  }>;
  doctypes: string[];
  modules: string[];
}

const PERM_FLAGS = [
  "read", "write", "create", "delete",
  "submit", "cancel", "amend",
  "report", "export", "import",
  "print", "email", "share", "mask",
];

const PERM_COLORS: Record<string, string> = {
  read: "bg-blue-500", write: "bg-green-500", create: "bg-emerald-500",
  delete: "bg-red-500", submit: "bg-purple-500", cancel: "bg-orange-500",
  amend: "bg-yellow-500", report: "bg-cyan-500", export: "bg-teal-500",
  import: "bg-indigo-500", print: "bg-pink-500", email: "bg-violet-500",
  share: "bg-amber-500", mask: "bg-gray-500",
};

const MODULES: Record<string, string[]> = {
  Healthcare: ["Patient", "Healthcare Practitioner", "Medical Department", "Patient Appointment", "Vital Signs", "Patient Encounter", "Diagnosis", "Drug Prescription", "Medication Request", "Lab Test", "Lab Test Template", "Clinical Procedure", "Observation", "Therapy Plan", "Therapy Session", "Inpatient Record", "Emergency Record", "Nursing Task", "Insurance Payor", "Patient Insurance Policy", "Insurance Claim", "Service Request", "Medication", "Allergy", "Pharmacy Warehouse", "Pharmacy Stock", "Pharmacy Stock Entry"],
  Core: ["DocType", "Role", "User", "Comment", "Communication", "Workflow"],
};

// ── Main Component ─────────────────────────────────────────────

export default function RoleManagementPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = !id || id === "new";

  const [roles, setRoles] = useState<RoleData[]>([]);
  const [selectedRole, setSelectedRole] = useState<RoleData | null>(null);
  const [matrix, setMatrix] = useState<PermMatrix | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState("Healthcare");
  const [activeTab, setActiveTab] = useState("info");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [form, setForm] = useState({
    name: "",
    description: "",
    desk_access: true,
    disabled: false,
    is_custom: false,
    home_page: "",
    restrict_to_domain: "",
    two_factor_auth: false,
  });

  const HEALTHCARE_ROLES = [
    "Healthcare Administrator",
    "Physician",
    "Nurse",
    "Nursing User",
    "Pharmacist",
    "Pharmacy User",
    "Lab Technician",
    "Laboratory User",
    "LabTest Approver",
    "Receptionist",
    "Patient",
    "System Manager",
    "Administrator",
  ];

  const fetchRoles = useCallback(async () => {
    try {
      const params: Record<string, any> = { page_size: "100", ordering: "name" };
      if (search) params.search = search;
      const data = await apiClient.get<{ results: RoleData[] }>({
        url: "/roles/roles/",
        params,
      });
      const allRoles = data.results || [];
      setRoles(allRoles.filter((r) => HEALTHCARE_ROLES.includes(r.name)));
    } catch {
      // silently fail
    }
  }, [search]);

  const fetchMatrix = useCallback(async () => {
    try {
      const data = await apiClient.get<PermMatrix>({ url: "/roles/matrix/" });
      setMatrix(data);
    } catch {
      // silently fail
    }
  }, []);

  const fetchRole = useCallback(async (roleId: string) => {
    try {
      setLoading(true);
      const data = await apiClient.get<RoleData>({ url: `/roles/roles/${roleId}/` });
      setSelectedRole(data);
      setForm({
        name: data.name,
        description: data.description || "",
        desk_access: data.desk_access,
        disabled: data.disabled,
        is_custom: data.is_custom,
        home_page: data.home_page || "",
        restrict_to_domain: data.restrict_to_domain || "",
        two_factor_auth: data.two_factor_auth,
      });
    } catch {
      setMessage({ type: "error", text: "Failed to load role" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRoles();
    fetchMatrix();
  }, [fetchRoles, fetchMatrix]);

  useEffect(() => {
    if (id && id !== "new") {
      fetchRole(id);
    } else if (isNew) {
      setSelectedRole(null);
      setForm({
        name: "", description: "", desk_access: true, disabled: false,
        is_custom: false, home_page: "", restrict_to_domain: "", two_factor_auth: false,
      });
    }
  }, [id, isNew, fetchRole]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setMessage(null);
    try {
      if (isNew) {
        const created = await apiClient.post<{ id: number }>({
          url: "/roles/roles/",
          data: form,
        });
        setMessage({ type: "success", text: "Role created" });
        navigate(`/erp/roles/${created.id}`, { replace: true });
      } else {
        await apiClient.put({
          url: `/roles/roles/${id}/`,
          data: form,
        });
        setMessage({ type: "success", text: "Role saved" });
        await fetchRole(id!);
        await fetchRoles();
      }
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.response?.data?.name?.[0] || "Save failed";
      setMessage({ type: "error", text: msg });
    } finally {
      setSaving(false);
    }
  }, [id, isNew, form, navigate, fetchRole, fetchRoles]);

  const handleDelete = useCallback(async () => {
    if (!id || !confirm("Delete this role? This cannot be undone.")) return;
    try {
      await apiClient.delete({ url: `/roles/roles/${id}/` });
      navigate("/erp/roles", { replace: true });
    } catch (err: any) {
      setMessage({ type: "error", text: err?.response?.data?.detail || "Delete failed" });
    }
  }, [id, navigate]);

  const filteredDoctypes = matrix?.doctypes.filter((dt) => {
    if (moduleFilter === "All") return true;
    return MODULES[moduleFilter]?.includes(dt);
  }) || [];

  const filteredRoles = roles.filter((r) =>
    !search || r.name.toLowerCase().includes(search.toLowerCase())
  );

  const currentPermRole = matrix?.roles.find((r) => r.name === selectedRole?.name);

  return (
    <div className="flex h-[calc(100vh-80px)] gap-4">
      {/* Left Sidebar — Role List */}
      <div className="w-72 shrink-0 border rounded-lg flex flex-col overflow-hidden">
        <div className="p-3 border-b space-y-2">
          <div className="flex items-center justify-between">
            <Text variant="subTitle2" className="flex items-center gap-2">
              <Icon icon="solar:shield-user-bold" size={16} className="text-primary" />
              Roles ({roles.length})
            </Text>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => navigate("/erp/roles/new")}
            >
              <Icon icon="solar:add-circle-bold" size={16} />
            </Button>
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search roles..."
            className="w-full px-2 py-1.5 rounded border bg-background text-xs"
          />
        </div>
        <ScrollArea className="flex-1">
          <div className="p-1">
            {filteredRoles.map((role) => (
              <button
                key={role.id}
                className={`w-full text-left px-3 py-2 rounded text-sm flex items-center justify-between transition-colors ${
                  selectedRole?.id === role.id
                    ? "bg-primary/10 text-primary"
                    : "hover:bg-accent/50"
                }`}
                onClick={() => navigate(`/erp/roles/${role.id}`)}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${
                    role.disabled ? "bg-muted-foreground" : role.desk_access ? "bg-success" : "bg-info"
                  }`} />
                  <span className="truncate">{role.name}</span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {role.is_system_role && (
                    <Badge variant="secondary" className="text-[9px] px-1">Sys</Badge>
                  )}
                  {role.users_count > 0 && (
                    <Text variant="caption" color="secondary" className="text-[10px]">{role.users_count}</Text>
                  )}
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Right Content */}
      <div className="flex-1 flex flex-col border rounded-lg overflow-hidden">
        {loading && !selectedRole && !isNew ? (
          <div className="flex items-center justify-center h-full">
            <Icon icon="solar:refresh-bold" size={24} className="animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="px-4 py-3 border-b flex items-center justify-between bg-muted/20">
              <div className="flex items-center gap-3">
                <Text variant="subTitle1" className="font-semibold">
                  {isNew ? "New Role" : selectedRole?.name || "Select a Role"}
                </Text>
                {selectedRole && (
                  <div className="flex items-center gap-1">
                    {selectedRole.disabled && <Badge variant="destructive" className="text-[10px]">Disabled</Badge>}
                    {selectedRole.desk_access && <Badge variant="info" className="text-[10px]">Desk</Badge>}
                    {selectedRole.is_system_role && <Badge variant="secondary" className="text-[10px]">System</Badge>}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                {message && (
                  <Badge variant={message.type === "success" ? "success" : "destructive"}>
                    {message.text}
                  </Badge>
                )}
                {selectedRole && !selectedRole.is_system_role && (
                  <Button variant="outline" size="sm" onClick={handleDelete}>
                    <Icon icon="solar:trash-bin-minimalistic-bold" size={14} />
                  </Button>
                )}
                <Button onClick={handleSave} disabled={saving || !form.name} size="sm">
                  {saving ? <Icon icon="solar:refresh-bold" size={14} className="mr-1 animate-spin" /> : null}
                  {isNew ? "Create" : "Save"}
                </Button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 border-b px-4">
              {[
                { key: "info", label: "Role Info", icon: "solar:settings-bold" },
                { key: "permissions", label: "Permissions", icon: "solar:shield-check-bold" },
              ].map((tab) => (
                <button
                  key={tab.key}
                  className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.key
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                  onClick={() => setActiveTab(tab.key)}
                >
                  <Icon icon={tab.icon} size={14} />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <ScrollArea className="flex-1">
              {activeTab === "info" && (
                <RoleInfoTab form={form} setForm={setForm} role={selectedRole} isNew={isNew} />
              )}
              {activeTab === "permissions" && (
                <PermissionsTab
                  role={selectedRole}
                  matrix={currentPermRole}
                  doctypes={filteredDoctypes}
                  modules={Object.keys(MODULES)}
                  moduleFilter={moduleFilter}
                  setModuleFilter={setModuleFilter}
                  matrixLoading={!matrix}
                />
              )}
            </ScrollArea>
          </>
        )}
      </div>
    </div>
  );
}

// ── Role Info Tab ──────────────────────────────────────────────

function RoleInfoTab({
  form,
  setForm,
  role,
  isNew,
}: {
  form: any;
  setForm: (f: any) => void;
  role: RoleData | null;
  isNew: boolean;
}) {
  const update = (field: string, value: any) => setForm((prev: any) => ({ ...prev, [field]: value }));

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      {/* Basic Info */}
      <Text variant="subTitle2" className="flex items-center gap-2">
        <Icon icon="solar:settings-bold" size={16} />
        Role Information
      </Text>

      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium mb-1">Role Name *</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
            placeholder="e.g. Clinical Specialist, Pharmacist, Triage Nurse"
            disabled={!isNew && role?.is_system_role}
            className="w-full px-3 py-2 rounded-md border bg-background text-sm disabled:opacity-50"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Description</label>
          <textarea
            value={form.description}
            onChange={(e) => update("description", e.target.value)}
            rows={3}
            placeholder="Describe what this role grants access to..."
            className="w-full px-3 py-2 rounded-md border bg-background text-sm"
          />
        </div>
      </div>

      <Separator />

      {/* Access Flags */}
      <Text variant="subTitle2" className="flex items-center gap-2">
        <Icon icon="solar:shield-check-bold" size={16} />
        Access Settings
      </Text>

      <div className="grid grid-cols-2 gap-4">
        <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-accent/30">
          <input
            type="checkbox"
            checked={form.desk_access}
            onChange={(e) => update("desk_access", e.target.checked)}
            className="rounded"
          />
          <div>
            <Text variant="caption" className="font-medium">Desk Access</Text>
            <Text variant="caption" color="secondary" className="text-xs">Allow access to admin panel</Text>
          </div>
        </label>

        <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-accent/30">
          <input
            type="checkbox"
            checked={form.two_factor_auth}
            onChange={(e) => update("two_factor_auth", e.target.checked)}
            className="rounded"
          />
          <div>
            <Text variant="caption" className="font-medium">Two-Factor Auth</Text>
            <Text variant="caption" color="secondary" className="text-xs">Require 2FA for this role</Text>
          </div>
        </label>

        <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-accent/30">
          <input
            type="checkbox"
            checked={form.disabled}
            onChange={(e) => update("disabled", e.target.checked)}
            className="rounded"
          />
          <div>
            <Text variant="caption" className="font-medium">Disabled</Text>
            <Text variant="caption" color="secondary" className="text-xs">Disable this role</Text>
          </div>
        </label>

        <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-accent/30">
          <input
            type="checkbox"
            checked={form.is_custom}
            onChange={(e) => update("is_custom", e.target.checked)}
            className="rounded"
          />
          <div>
            <Text variant="caption" className="font-medium">Custom Role</Text>
            <Text variant="caption" color="secondary" className="text-xs">Created by admin, not system</Text>
          </div>
        </label>
      </div>

      <Separator />

      {/* Advanced */}
      <Text variant="subTitle2">Advanced</Text>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1">Home Page</label>
          <input
            type="text"
            value={form.home_page}
            onChange={(e) => update("home_page", e.target.value)}
            placeholder="/desk"
            className="w-full px-3 py-2 rounded-md border bg-background text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Restrict to Domain</label>
          <input
            type="text"
            value={form.restrict_to_domain}
            onChange={(e) => update("restrict_to_domain", e.target.value)}
            placeholder="(none)"
            className="w-full px-3 py-2 rounded-md border bg-background text-sm"
          />
        </div>
      </div>

      {/* Meta */}
      {role && (
        <>
          <Separator />
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <Text variant="caption" color="secondary">Users with role</Text>
              <Text variant="caption">{role.users_count}</Text>
            </div>
            <div>
              <Text variant="caption" color="secondary">Permission rules</Text>
              <Text variant="caption">{role.doc_perms_count}</Text>
            </div>
            <div>
              <Text variant="caption" color="secondary">Created</Text>
              <Text variant="caption">{new Date(role.creation).toLocaleDateString()}</Text>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Permissions Tab ────────────────────────────────────────────

function PermissionsTab({
  role,
  matrix,
  doctypes,
  modules,
  moduleFilter,
  setModuleFilter,
  matrixLoading,
}: {
  role: RoleData | null;
  matrix: { name: string; permissions: Record<string, Record<string, boolean>> } | undefined;
  doctypes: string[];
  modules: string[];
  moduleFilter: string;
  setModuleFilter: (m: string) => void;
  matrixLoading: boolean;
}) {
  if (matrixLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Icon icon="solar:refresh-bold" size={20} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!role) {
    return (
      <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
        <Icon icon="solar:shield-check-bold" size={32} className="mb-2 opacity-50" />
        <Text variant="subTitle2">Select a role to view permissions</Text>
      </div>
    );
  }

  const perms = matrix?.permissions || {};

  return (
    <div className="p-4 space-y-4">
      {/* Module filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          variant={moduleFilter === "All" ? "default" : "outline"}
          size="sm"
          onClick={() => setModuleFilter("All")}
        >
          All ({doctypes.length})
        </Button>
        {modules.map((mod) => (
          <Button
            key={mod}
            variant={moduleFilter === mod ? "default" : "outline"}
            size="sm"
            onClick={() => setModuleFilter(mod)}
          >
            {mod}
          </Button>
        ))}
      </div>

      {/* Permission matrix table */}
      <div className="border rounded-lg overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 border-b">
              <th className="text-left px-3 py-2 font-medium sticky left-0 bg-muted/50 z-10 min-w-[160px]">
                DocType
              </th>
              {PERM_FLAGS.map((flag) => (
                <th
                  key={flag}
                  className="px-2 py-2 font-medium text-center min-w-[60px]"
                  title={flag}
                >
                  <span className={`inline-block w-2 h-2 rounded-full mr-1 ${PERM_COLORS[flag]}`} />
                  <span className="text-[10px] uppercase">{flag.slice(0, 4)}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {doctypes.map((dt) => {
              const dtPerms = perms[dt] || {};
              return (
                <tr key={dt} className="border-b hover:bg-accent/20">
                  <td className="px-3 py-1.5 font-medium sticky left-0 bg-background z-10">
                    {dt}
                  </td>
                  {PERM_FLAGS.map((flag) => {
                    const hasPerm = dtPerms[flag] === true;
                    return (
                      <td key={flag} className="px-2 py-1.5 text-center">
                        <div
                          className={`w-5 h-5 rounded mx-auto cursor-pointer transition-colors ${
                            hasPerm
                              ? `${PERM_COLORS[flag]} shadow-sm`
                              : "bg-muted hover:bg-muted/80"
                          }`}
                          title={hasPerm ? `${dt}: ${flag} ✓` : `${dt}: ${flag} ✗`}
                        />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 flex-wrap">
        <Text variant="caption" color="secondary">Legend:</Text>
        {PERM_FLAGS.map((flag) => (
          <div key={flag} className="flex items-center gap-1">
            <div className={`w-3 h-3 rounded ${PERM_COLORS[flag]}`} />
            <Text variant="caption" color="secondary" className="text-[10px]">{flag}</Text>
          </div>
        ))}
      </div>

      {/* Info */}
      <div className="p-3 border rounded-lg bg-muted/20">
        <Text variant="caption" color="secondary">
          <Icon icon="solar:info-circle-bold" size={14} className="inline mr-1" />
          Permission rules are configured in the <strong>Permission Matrix</strong> page.
          This view shows the effective permissions for the <strong>{role.name}</strong> role based on DocPerm and CustomDocPerm entries.
          To edit permissions, go to the Permission Matrix page.
        </Text>
      </div>
    </div>
  );
}
