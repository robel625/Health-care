import { Icon } from "@/components/icon";
import { Badge } from "@/ui/badge";
import { Button } from "@/ui/button";
import { Card, CardContent, CardHeader } from "@/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/ui/dialog";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { Separator } from "@/ui/separator";
import { Text } from "@/ui/typography";
import Table, { type ColumnsType } from "antd/es/table";
import { useEffect, useState, useCallback, useMemo } from "react";
import apiClient from "@/api/apiClient";

export interface Role {
  id: number;
  name: string;
  description: string;
  is_system_role: boolean;
  is_active: boolean;
  users_count: number;
  permissions_count: number;
  creation: string;
}

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
];

const HEALTHCARE_DOMAINS: Record<string, { label: string; icon: string; roles: string[] }> = {
  all: {
    label: "All Healthcare",
    icon: "solar:health-bold",
    roles: [],
  },
  clinical: {
    label: "Medical & Attending",
    icon: "solar:stethoscope-bold",
    roles: ["Physician"],
  },
  nursing: {
    label: "Nursing & Wards",
    icon: "solar:bed-bold",
    roles: ["Nurse", "Nursing User"],
  },
  diagnostics: {
    label: "Diagnostics & Lab",
    icon: "solar:test-tube-bold",
    roles: ["Lab Technician", "Laboratory User", "LabTest Approver"],
  },
  pharmacy: {
    label: "Pharmacy & Therapeutics",
    icon: "solar:pill-bold",
    roles: ["Pharmacist", "Pharmacy User"],
  },
  access: {
    label: "Patient Access & Portal",
    icon: "solar:users-group-rounded-bold",
    roles: ["Receptionist", "Patient"],
  },
  governance: {
    label: "Facility Governance",
    icon: "solar:shield-check-bold",
    roles: ["Healthcare Administrator", "System Manager", "Administrator"],
  },
};

const ROLE_SCOPES: Record<string, { domain: string; tier: string; scopes: string[]; color: string }> = {
  "Healthcare Administrator": {
    domain: "governance",
    tier: "Tier 1: Facility Governance",
    scopes: ["Full Facility Control", "User Management", "Audit & Logs", "Billing & Insurance"],
    color: "rose",
  },
  "Physician": {
    domain: "clinical",
    tier: "Tier 2: Attending Medical",
    scopes: ["EHR Diagnoses & Encounters", "Rx Prescribing", "Lab Order & Review", "Care Plans"],
    color: "emerald",
  },
  "Nurse": {
    domain: "nursing",
    tier: "Tier 3: Clinical Care",
    scopes: ["Vital Signs Triage", "Inpatient Wards", "Nursing Tasks", "Medication Admin"],
    color: "blue",
  },
  "Nursing User": {
    domain: "nursing",
    tier: "Tier 3: Clinical Care",
    scopes: ["Vital Signs", "Ward Observation", "Nursing Tasks"],
    color: "blue",
  },
  "Pharmacist": {
    domain: "pharmacy",
    tier: "Tier 4: Pharmacy & Therapeutics",
    scopes: ["Medication Dispensing", "Pharmacy Inventory", "Prescription Review"],
    color: "purple",
  },
  "Pharmacy User": {
    domain: "pharmacy",
    tier: "Tier 4: Pharmacy & Therapeutics",
    scopes: ["Medication Dispensing", "Stock Entry", "Prescription Intake"],
    color: "purple",
  },
  "Lab Technician": {
    domain: "diagnostics",
    tier: "Tier 4: Diagnostics & Pathology",
    scopes: ["Sample Collection", "Lab Test Analysis", "Diagnostic Reports"],
    color: "amber",
  },
  "Laboratory User": {
    domain: "diagnostics",
    tier: "Tier 4: Diagnostics & Pathology",
    scopes: ["Sample Intake", "Lab Test Entry"],
    color: "amber",
  },
  "LabTest Approver": {
    domain: "diagnostics",
    tier: "Tier 4: Diagnostics & Pathology",
    scopes: ["Lab Sign-off & Verification", "Critical Value Notification"],
    color: "amber",
  },
  "Receptionist": {
    domain: "access",
    tier: "Tier 5: Patient Access",
    scopes: ["Patient Registration", "Appointment Booking", "Clinic Check-in"],
    color: "teal",
  },
  "Patient": {
    domain: "access",
    tier: "Tier 6: Patient Portal",
    scopes: ["Personal Health Record", "My Appointments", "Lab Results View"],
    color: "slate",
  },
  "System Manager": {
    domain: "governance",
    tier: "Core Administration",
    scopes: ["Security Settings", "System Integrations", "Core User Administration"],
    color: "indigo",
  },
  "Administrator": {
    domain: "governance",
    tier: "Core Superuser",
    scopes: ["System Provisioning", "Root Privileges"],
    color: "zinc",
  },
};

export default function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [selectedDomain, setSelectedDomain] = useState<string>("all");
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<Role | null>(null);
  const [selectedRoleDetail, setSelectedRoleDetail] = useState<Role | null>(null);

  const [form, setForm] = useState({
    name: "",
    description: "",
    is_active: true,
    is_system_role: false,
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get<{ results: Role[]; count: number }>({
        url: "/roles/roles/",
        params: { page_size: 100 },
      });
      setRoles(res.results || []);
    } catch (err) {
      console.error("Failed to load roles:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSubmit = async () => {
    try {
      if (editItem) {
        await apiClient.put({ url: `/roles/roles/${editItem.id}/`, data: form });
      } else {
        await apiClient.post({ url: "/roles/roles/", data: form });
      }
      setShowForm(false);
      setEditItem(null);
      resetForm();
      loadData();
    } catch (err: any) {
      const msg = err?.response?.data?.name?.[0] || err?.response?.data?.detail || "Save failed";
      alert(msg);
    }
  };

  const handleCloneRole = async (record: Role) => {
    const cloneName = prompt(`Enter name for the duplicated healthcare role:`, `${record.name} (Copy)`);
    if (!cloneName) return;
    try {
      await apiClient.post({
        url: "/roles/roles/",
        data: {
          name: cloneName,
          description: `Cloned from ${record.name}. ${record.description || ""}`,
          is_active: true,
          is_system_role: false,
        },
      });
      alert(`Healthcare role "${cloneName}" successfully created.`);
      loadData();
    } catch (err: any) {
      alert("Failed to duplicate role.");
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Are you sure you want to delete this role? Users assigned to this role will lose its privileges.")) return;
    try {
      await apiClient.delete({ url: `/roles/roles/${id}/` });
      loadData();
    } catch (err: any) {
      const msg = err?.response?.data?.detail || "Delete failed";
      alert(msg);
    }
  };

  const resetForm = () =>
    setForm({ name: "", description: "", is_active: true, is_system_role: false });

  // Strictly Healthcare Stats
  const stats = useMemo(() => {
    const hcRoles = roles.filter((r) => Object.keys(ROLE_SCOPES).includes(r.name) || HEALTHCARE_ROLES.includes(r.name));
    const healthcareCount = hcRoles.length;
    const clinicalCount = hcRoles.filter((r) =>
      ["Physician", "Nurse", "Nursing User", "Pharmacist", "Pharmacy User", "Lab Technician", "Laboratory User", "LabTest Approver"].includes(r.name)
    ).length;
    const governanceCount = hcRoles.filter((r) =>
      ["Healthcare Administrator", "System Manager", "Administrator"].includes(r.name)
    ).length;
    const totalUsers = hcRoles.reduce((sum, r) => sum + (r.users_count || 0), 0);
    return { healthcareCount, clinicalCount, governanceCount, totalUsers };
  }, [roles]);

  // Strictly Healthcare Display Filter
  const displayedRoles = useMemo(() => {
    const allowed = Object.keys(ROLE_SCOPES);
    let list = roles.filter((r) => allowed.includes(r.name) || HEALTHCARE_ROLES.includes(r.name));

    if (selectedDomain !== "all") {
      const domainDef = HEALTHCARE_DOMAINS[selectedDomain];
      if (domainDef) {
        list = list.filter((r) => domainDef.roles.includes(r.name));
      }
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((r) => r.name.toLowerCase().includes(q) || (r.description && r.description.toLowerCase().includes(q)));
    }
    return list;
  }, [roles, selectedDomain, search]);

  const columns: ColumnsType<Role> = [
    {
      title: "Clinical Role & Scope",
      dataIndex: "name",
      width: 270,
      render: (name, record) => {
        const isHc = HEALTHCARE_ROLES.includes(name);
        const scopeInfo = ROLE_SCOPES[name];
        return (
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 font-semibold text-sm">
              {isHc ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
                  <Icon icon="solar:shield-cross-bold" size={13} className="text-emerald-600" />
                  {name}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800">
                  <Icon icon="solar:shield-check-bold" size={13} className="text-blue-600" />
                  {name}
                </span>
              )}
              {record.is_system_role && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">Built-in</Badge>
              )}
            </div>
            {scopeInfo ? (
              <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                <span className="font-medium text-foreground/80">{scopeInfo.tier}</span>
              </div>
            ) : record.description ? (
              <div className="text-[11px] text-muted-foreground line-clamp-1">{record.description}</div>
            ) : null}
          </div>
        );
      },
    },
    {
      title: "Granted Clinical Privileges",
      key: "scopes",
      width: 320,
      render: (_, record) => {
        const scopeInfo = ROLE_SCOPES[record.name];
        if (scopeInfo) {
          return (
            <div className="flex flex-wrap gap-1">
              {scopeInfo.scopes.map((s) => (
                <span key={s} className="px-2 py-0.5 rounded-md text-[10px] bg-muted/60 text-foreground border border-border/60">
                  {s}
                </span>
              ))}
            </div>
          );
        }
        return <span className="text-xs text-muted-foreground">{record.description || "Clinical permissions"}</span>;
      },
    },
    {
      title: "Domain Category",
      key: "category",
      width: 140,
      align: "center",
      render: (_, r) => {
        const info = ROLE_SCOPES[r.name];
        if (!info) return <Badge variant="outline">🏥 Healthcare</Badge>;
        switch (info.domain) {
          case "clinical":
            return <Badge variant="success" className="bg-emerald-50 text-emerald-700 border-emerald-200">🩺 Medical</Badge>;
          case "nursing":
            return <Badge variant="info" className="bg-blue-50 text-blue-700 border-blue-200">💉 Nursing</Badge>;
          case "diagnostics":
            return <Badge variant="warning" className="bg-amber-50 text-amber-700 border-amber-200">🔬 Diagnostics</Badge>;
          case "pharmacy":
            return <Badge variant="secondary" className="bg-purple-50 text-purple-700 border-purple-200">💊 Pharmacy</Badge>;
          case "access":
            return <Badge variant="outline" className="bg-teal-50 text-teal-700 border-teal-200">📋 Access</Badge>;
          case "governance":
            return <Badge variant="destructive" className="bg-rose-50 text-rose-700 border-rose-200">🏛️ Governance</Badge>;
          default:
            return <Badge variant="default">🏥 Healthcare</Badge>;
        }
      },
    },
    {
      title: "Assigned Users",
      dataIndex: "users_count",
      width: 110,
      align: "center",
      render: (count) => (
        <span className="inline-flex items-center gap-1 font-semibold text-xs">
          <Icon icon="solar:user-bold" size={13} className="text-muted-foreground" />
          {count || 0}
        </span>
      ),
    },
    {
      title: "Status",
      dataIndex: "is_active",
      width: 90,
      align: "center",
      render: (v) => (
        <Badge variant={v ? "success" : "destructive"} className="text-[10px]">
          {v ? "Active" : "Inactive"}
        </Badge>
      ),
    },
    {
      title: "Actions",
      key: "action",
      align: "center",
      width: 140,
      render: (_, record) => (
        <div className="flex items-center justify-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={() => setSelectedRoleDetail(record)}
            title="Inspect Role Details"
          >
            <Icon icon="solar:eye-bold" size={16} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={() => handleCloneRole(record)}
            title="Clone Role"
          >
            <Icon icon="solar:copy-bold" size={16} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={() => {
              setForm({
                name: record.name,
                description: record.description,
                is_active: record.is_active,
                is_system_role: record.is_system_role,
              });
              setEditItem(record);
              setShowForm(true);
            }}
            title="Edit Role"
          >
            <Icon icon="solar:pen-bold-duotone" size={16} />
          </Button>
          {!record.is_system_role && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive hover:text-destructive"
              onClick={() => handleDelete(record.id)}
              title="Delete Role"
            >
              <Icon icon="mingcute:delete-2-fill" size={16} />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* ── KPI Metric Cards ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-3.5 flex items-center justify-between border-l-4 border-l-emerald-600 bg-card/60 backdrop-blur-sm">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Clinical Roles</div>
            <div className="text-2xl font-bold mt-0.5 text-emerald-600">{stats.clinicalCount}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">Medical, Wards & Diagnostic</div>
          </div>
          <div className="p-2.5 bg-emerald-500/10 rounded-xl text-emerald-600">
            <Icon icon="solar:shield-cross-bold" size={24} />
          </div>
        </Card>

        <Card className="p-3.5 flex items-center justify-between border-l-4 border-l-primary bg-card/60 backdrop-blur-sm">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Healthcare Roles</div>
            <div className="text-2xl font-bold mt-0.5">{stats.healthcareCount}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">Clinical Directory Catalog</div>
          </div>
          <div className="p-2.5 bg-primary/10 rounded-xl text-primary">
            <Icon icon="solar:shield-check-bold" size={24} />
          </div>
        </Card>

        <Card className="p-3.5 flex items-center justify-between border-l-4 border-l-blue-500 bg-card/60 backdrop-blur-sm">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Staff Assigned</div>
            <div className="text-2xl font-bold mt-0.5 text-blue-600">{stats.totalUsers}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">Hospital Staff & Clinicians</div>
          </div>
          <div className="p-2.5 bg-blue-500/10 rounded-xl text-blue-600">
            <Icon icon="solar:users-group-rounded-bold" size={24} />
          </div>
        </Card>

        <Card className="p-3.5 flex items-center justify-between border-l-4 border-l-amber-500 bg-card/60 backdrop-blur-sm">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Governance & Admin</div>
            <div className="text-2xl font-bold mt-0.5 text-amber-600">{stats.governanceCount}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">Hospital Governance & IT</div>
          </div>
          <div className="p-2.5 bg-amber-500/10 rounded-xl text-amber-600">
            <Icon icon="solar:lock-keyhole-bold" size={24} />
          </div>
        </Card>
      </div>

      {/* ── Table Card ───────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div>
              <div className="text-lg font-semibold flex items-center gap-2">
                <Icon icon="solar:shield-user-bold" size={22} className="text-emerald-600" />
                Healthcare Roles & Permissions Directory
              </div>
              <div className="text-xs text-text-secondary mt-0.5">
                Define and manage clinical privileges, prescribing rights, ward tasks, and hospital governance
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex rounded-lg border border-border p-0.5 bg-muted/40 text-xs flex-wrap">
                {Object.entries(HEALTHCARE_DOMAINS).map(([key, item]) => {
                  const isSelected = selectedDomain === key;
                  const count = key === "all"
                    ? stats.healthcareCount
                    : roles.filter((r) => item.roles.includes(r.name)).length;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setSelectedDomain(key)}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-colors text-xs ${
                        isSelected
                          ? "bg-card text-foreground font-semibold shadow-xs"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Icon icon={item.icon} size={13} />
                      <span>{item.label}</span>
                      <span className="text-[10px] opacity-75">({count})</span>
                    </button>
                  );
                })}
              </div>

              <Input
                placeholder="Search healthcare roles..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-44 text-xs h-8"
              />

              <Button size="sm" onClick={() => { resetForm(); setEditItem(null); setShowForm(true); }} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                <Icon icon="solar:add-circle-bold" size={16} className="mr-1" />
                New Role
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <Table
            rowKey="id"
            size="small"
            scroll={{ x: "max-content" }}
            columns={columns}
            dataSource={displayedRoles}
            loading={loading}
            pagination={{
              current: page,
              total: displayedRoles.length,
              pageSize: 15,
              showSizeChanger: false,
              onChange: (p) => setPage(p),
            }}
          />
        </CardContent>
      </Card>

      {/* ── Role Edit / Create Dialog ────────────────────────────── */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Icon icon="solar:shield-bold" size={18} className="text-emerald-600" />
              {editItem ? `Edit Role: ${editItem.name}` : "Create New Healthcare Role"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3.5 py-3 text-xs">
            <div>
              <Label className="block font-medium mb-1">Role Identifier Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Clinical Specialist, Pharmacist, Triage Nurse"
                className="text-xs"
              />
            </div>

            <div>
              <Label className="block font-medium mb-1">Role Description & Purpose</Label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3}
                placeholder="Describe clinical responsibilities, prescribing rights, or department access..."
                className="w-full px-3 py-2 rounded-md border bg-background text-xs"
              />
            </div>

            <div className="p-3 border rounded-lg bg-muted/20 space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                  className="rounded"
                />
                <span className="font-medium">Active (Available for user assignment)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_system_role}
                  onChange={(e) => setForm({ ...form, is_system_role: e.target.checked })}
                  className="rounded"
                />
                <span className="text-muted-foreground">Mark as System Role (Protected)</span>
              </label>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t">
            <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSubmit} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              {editItem ? "Update Role" : "Create Role"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Role Inspection Modal ─────────────────────────────────── */}
      <Dialog open={!!selectedRoleDetail} onOpenChange={() => setSelectedRoleDetail(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Icon icon="solar:shield-check-bold" size={20} className="text-emerald-600" />
              Role Details: {selectedRoleDetail?.name}
            </DialogTitle>
          </DialogHeader>

          {selectedRoleDetail && (
            <div className="space-y-4 py-2 text-xs">
              <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/20">
                <div>
                  <div className="text-[11px] text-muted-foreground uppercase font-semibold">Tier & Domain</div>
                  <div className="font-bold text-sm text-foreground mt-0.5">
                    {ROLE_SCOPES[selectedRoleDetail.name]?.tier || "Standard Healthcare Role"}
                  </div>
                </div>
                <Badge variant={selectedRoleDetail.is_active ? "success" : "destructive"}>
                  {selectedRoleDetail.is_active ? "Active" : "Disabled"}
                </Badge>
              </div>

              <div>
                <div className="font-semibold text-foreground mb-1">Clinical Scope & Responsibilities:</div>
                <div className="p-3 border rounded-lg bg-card space-y-1.5">
                  {ROLE_SCOPES[selectedRoleDetail.name]?.scopes.map((s) => (
                    <div key={s} className="flex items-center gap-2">
                      <Icon icon="solar:check-circle-bold" size={14} className="text-emerald-500" />
                      <span>{s}</span>
                    </div>
                  )) || (
                    <div className="text-muted-foreground italic">
                      {selectedRoleDetail.description || "General hospital operations and access permissions."}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 border rounded-lg">
                  <div className="text-muted-foreground">Assigned Personnel</div>
                  <div className="text-xl font-bold mt-1 text-primary">{selectedRoleDetail.users_count || 0} Staff</div>
                </div>
                <div className="p-3 border rounded-lg">
                  <div className="text-muted-foreground">System Status</div>
                  <div className="text-xl font-bold mt-1 text-foreground">
                    {selectedRoleDetail.is_system_role ? "Built-in" : "Custom"}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end pt-2 border-t">
            <Button size="sm" onClick={() => setSelectedRoleDetail(null)}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
