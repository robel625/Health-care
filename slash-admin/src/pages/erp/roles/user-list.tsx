import { Icon } from "@/components/icon";
import Avatar from "@/components/Avatar";
import apiClient from "@/api/apiClient";
import { Button } from "@/ui/button";
import { Badge } from "@/ui/badge";
import { Card } from "@/ui/card";
import { ScrollArea } from "@/ui/scroll-area";
import { Separator } from "@/ui/separator";
import { Text } from "@/ui/typography";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/ui/dialog";
import { useCallback, useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router";

// ── Types & Constants ───────────────────────────────────────────

interface UserData {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  is_staff: boolean;
  roles: string[];
  date_joined: string;
  last_login: string;
}

const HEALTHCARE_ROLES = [
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
];

const CLINICAL_DEPARTMENTS = [
  "Cardiology & CCU",
  "Emergency & Trauma (ER)",
  "Pediatrics & Neonatal",
  "General Medicine (OPD)",
  "General Surgery & OT",
  "Radiology & Imaging",
  "Pathology & Laboratory",
  "Inpatient & Nursing Care",
  "Clinical Pharmacy",
  "Hospital Administration",
];

export default function UserListPage() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");

  // New Staff Modal
  const [showNewUser, setShowNewUser] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newUserForm, setNewUserForm] = useState({
    username: "",
    email: "",
    first_name: "",
    last_name: "",
    password: "admin123",
    department: "General Medicine (OPD)",
    role: "Physician",
  });

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiClient.get<{ results: UserData[] }>({
        url: "/roles/users/",
        params: { page_size: "100", ordering: "-date_joined" },
      });
      setUsers(data.results || []);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const toggleActive = useCallback(async (id: number) => {
    try {
      const res = await apiClient.post<{ is_active: boolean }>({
        url: `/roles/users/${id}/toggle_active/`,
      });
      setUsers((prev) =>
        prev.map((u) => (u.id === id ? { ...u, is_active: res.is_active } : u)),
      );
    } catch {
      // silently fail
    }
  }, []);

  const resetPassword = useCallback(async (id: number, username: string) => {
    const newPass = prompt(`Enter new password for ${username}:`, "HealthCare2026!");
    if (!newPass) return;
    try {
      await apiClient.post({
        url: `/roles/users/${id}/reset_password/`,
        data: { new_password: newPass },
      });
      alert(`Password for ${username} reset successfully!`);
    } catch {
      alert("Failed to reset password.");
    }
  }, []);

  const handleCreateUser = useCallback(async () => {
    setCreating(true);
    try {
      const created = await apiClient.post<{ id: number }>({
        url: "/roles/users/",
        data: {
          username: newUserForm.username,
          email: newUserForm.email,
          first_name: newUserForm.first_name,
          last_name: newUserForm.last_name,
          password: newUserForm.password,
        },
      });

      // If user selected a clinical role, assign it directly
      if (newUserForm.role) {
        try {
          await apiClient.post({
            url: `/roles/users/${created.id}/assign_roles/`,
            data: { roles: [newUserForm.role] },
          });
        } catch {
          // fallback
        }
      }

      setShowNewUser(false);
      setNewUserForm({
        username: "",
        email: "",
        first_name: "",
        last_name: "",
        password: "admin123",
        department: "General Medicine (OPD)",
        role: "Physician",
      });
      fetchUsers();
      navigate(`/erp/users/${created.id}`);
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.response?.data?.username?.[0] || "Create failed";
      alert(msg);
    } finally {
      setCreating(false);
    }
  }, [newUserForm, navigate, fetchUsers]);

  // Export Staff Roster to CSV
  const handleExportCSV = useCallback(() => {
    const headers = ["ID", "Username", "Full Name", "Email", "Roles", "Status", "Joined"];
    const rows = users.map((u) => [
      u.id,
      u.username,
      `"${u.first_name} ${u.last_name}".trim()`,
      u.email,
      `"${u.roles.join(", ")}"`,
      u.is_active ? "Active" : "Disabled",
      new Date(u.date_joined).toLocaleDateString(),
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Healthcare_Staff_Roster_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [users]);

  // Statistics
  const stats = useMemo(() => {
    const total = users.length;
    const active = users.filter((u) => u.is_active).length;
    const doctors = users.filter((u) => u.roles.some((r) => r.toLowerCase().includes("physician") || r.toLowerCase().includes("doctor"))).length;
    const nurses = users.filter((u) => u.roles.some((r) => r.toLowerCase().includes("nurse"))).length;
    const diagnosticAndPharm = users.filter((u) => u.roles.some((r) => r.toLowerCase().includes("pharm") || r.toLowerCase().includes("lab"))).length;
    const admins = users.filter((u) => u.roles.some((r) => r.toLowerCase().includes("admin"))).length;
    return { total, active, doctors, nurses, diagnosticAndPharm, admins };
  }, [users]);

  // Filtered Users
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      // Search filter
      const q = search.toLowerCase();
      const matchSearch =
        !q ||
        u.username.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        `${u.first_name} ${u.last_name}`.toLowerCase().includes(q);

      // Status filter
      const matchStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && u.is_active) ||
        (statusFilter === "disabled" && !u.is_active);

      // Role filter
      let matchRole = true;
      if (selectedRoleFilter === "doctors") {
        matchRole = u.roles.some((r) => r.toLowerCase().includes("physician") || r.toLowerCase().includes("doctor"));
      } else if (selectedRoleFilter === "nurses") {
        matchRole = u.roles.some((r) => r.toLowerCase().includes("nurse"));
      } else if (selectedRoleFilter === "pharmacy") {
        matchRole = u.roles.some((r) => r.toLowerCase().includes("pharm"));
      } else if (selectedRoleFilter === "lab") {
        matchRole = u.roles.some((r) => r.toLowerCase().includes("lab"));
      } else if (selectedRoleFilter === "admin") {
        matchRole = u.roles.some((r) => r.toLowerCase().includes("admin"));
      }

      return matchSearch && matchStatus && matchRole;
    });
  }, [users, search, statusFilter, selectedRoleFilter]);

  return (
    <div className="space-y-6">
      {/* ── KPI Metrics Cards ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
        <Card className="p-3.5 flex items-center justify-between border-l-4 border-l-primary bg-card/60 backdrop-blur-sm">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Total Hospital Staff</div>
            <div className="text-2xl font-bold mt-0.5">{stats.total}</div>
            <div className="text-[11px] text-emerald-600 font-medium flex items-center gap-1 mt-0.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {stats.active} on duty / active
            </div>
          </div>
          <div className="p-2.5 bg-primary/10 rounded-xl text-primary">
            <Icon icon="solar:users-group-rounded-bold" size={24} />
          </div>
        </Card>

        <Card className="p-3.5 flex items-center justify-between border-l-4 border-l-emerald-500 bg-card/60 backdrop-blur-sm">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Physicians & Doctors</div>
            <div className="text-2xl font-bold mt-0.5 text-emerald-600">{stats.doctors}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">Clinical Prescribers</div>
          </div>
          <div className="p-2.5 bg-emerald-500/10 rounded-xl text-emerald-600">
            <Icon icon="solar:stethoscope-bold" size={24} />
          </div>
        </Card>

        <Card className="p-3.5 flex items-center justify-between border-l-4 border-l-blue-500 bg-card/60 backdrop-blur-sm">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Nursing Care Staff</div>
            <div className="text-2xl font-bold mt-0.5 text-blue-600">{stats.nurses}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">Wards & Triage</div>
          </div>
          <div className="p-2.5 bg-blue-500/10 rounded-xl text-blue-600">
            <Icon icon="solar:heart-pulse-bold" size={24} />
          </div>
        </Card>

        <Card className="p-3.5 flex items-center justify-between border-l-4 border-l-purple-500 bg-card/60 backdrop-blur-sm">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Pharmacy & Lab</div>
            <div className="text-2xl font-bold mt-0.5 text-purple-600">{stats.diagnosticAndPharm}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">Diagnostics & Rx</div>
          </div>
          <div className="p-2.5 bg-purple-500/10 rounded-xl text-purple-600">
            <Icon icon="solar:test-tube-bold" size={24} />
          </div>
        </Card>

        <Card className="p-3.5 flex items-center justify-between border-l-4 border-l-amber-500 bg-card/60 backdrop-blur-sm col-span-2 md:col-span-1">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Administrators</div>
            <div className="text-2xl font-bold mt-0.5 text-amber-600">{stats.admins}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">Facility Governance</div>
          </div>
          <div className="p-2.5 bg-amber-500/10 rounded-xl text-amber-600">
            <Icon icon="solar:shield-check-bold" size={24} />
          </div>
        </Card>
      </div>

      {/* ── Header & Action Controls ──────────────────────────────── */}
      <Card className="p-4 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="text-lg font-semibold flex items-center gap-2">
              <Icon icon="solar:hospital-bold" size={22} className="text-emerald-600" />
              Healthcare Staff & Clinical Directory
            </div>
            <Text variant="caption" color="secondary" className="mt-0.5">
              Comprehensive registry of physicians, nurses, laboratory analysts, and hospital administrative personnel
            </Text>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* View Mode Toggle */}
            <div className="flex rounded-lg border border-border p-0.5 bg-muted/40 text-xs">
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-colors ${
                  viewMode === "grid" ? "bg-card text-foreground font-semibold shadow-xs" : "text-muted-foreground hover:text-foreground"
                }`}
                title="Card Grid View"
              >
                <Icon icon="solar:widget-4-bold" size={14} />
                Cards
              </button>
              <button
                type="button"
                onClick={() => setViewMode("table")}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-colors ${
                  viewMode === "table" ? "bg-card text-foreground font-semibold shadow-xs" : "text-muted-foreground hover:text-foreground"
                }`}
                title="Dense Table View"
              >
                <Icon icon="solar:list-bold" size={14} />
                Table
              </button>
            </div>

            <Button variant="outline" size="sm" onClick={handleExportCSV}>
              <Icon icon="solar:export-bold" size={15} className="mr-1 text-muted-foreground" />
              Export Roster
            </Button>

            <Button size="sm" onClick={() => setShowNewUser(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              <Icon icon="solar:user-plus-bold" size={16} className="mr-1" />
              Add Hospital Staff
            </Button>
          </div>
        </div>

        <Separator className="my-3.5" />

        {/* ── Search & Filter Tabs ─────────────────────────────────── */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Clinical Role Filters */}
          <div className="flex items-center gap-1.5 flex-wrap text-xs">
            <span className="text-muted-foreground font-medium mr-1">Filter Clinical:</span>
            {[
              { id: "all", label: "All Staff", icon: "solar:users-group-rounded-bold" },
              { id: "doctors", label: "Physicians", icon: "solar:stethoscope-bold" },
              { id: "nurses", label: "Nursing", icon: "solar:heart-pulse-bold" },
              { id: "pharmacy", label: "Pharmacy", icon: "solar:pill-bold" },
              { id: "lab", label: "Laboratory", icon: "solar:test-tube-bold" },
              { id: "admin", label: "Administration", icon: "solar:shield-check-bold" },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setSelectedRoleFilter(f.id)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                  selectedRoleFilter === f.id
                    ? "bg-primary text-primary-foreground border-primary shadow-xs"
                    : "bg-background border-border text-muted-foreground hover:text-foreground hover:bg-accent/40"
                }`}
              >
                <Icon icon={f.icon} size={13} />
                {f.label}
              </button>
            ))}
          </div>

          {/* Search bar & status filter */}
          <div className="flex items-center gap-2">
            <div className="relative min-w-[240px]">
              <Icon icon="solar:magnifer-linear" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search staff by name, email, role..."
                className="w-full pl-8 pr-3 py-1.5 rounded-lg border bg-background text-xs focus:ring-1 focus:ring-primary focus:outline-none"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border bg-background text-xs focus:ring-1 focus:ring-primary"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active Only</option>
              <option value="disabled">Disabled Only</option>
            </select>
          </div>
        </div>
      </Card>

      {/* ── Content View (Grid or Table) ──────────────────────────── */}
      {loading ? (
        <div className="flex flex-col items-center justify-center h-56 space-y-2">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
          <Text variant="caption" color="secondary">Loading clinical staff directory...</Text>
        </div>
      ) : filteredUsers.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <div className="p-4 bg-muted/30 rounded-full mb-3">
            <Icon icon="solar:user-block-bold" size={42} className="opacity-40" />
          </div>
          <Text variant="subTitle2" className="font-semibold">No medical staff found</Text>
          <Text variant="caption" color="secondary" className="mt-1">
            Try adjusting your search query or clinical role filter
          </Text>
        </Card>
      ) : viewMode === "grid" ? (
        /* ── Grid View ── */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filteredUsers.map((user) => (
            <StaffCard
              key={user.id}
              user={user}
              onNavigate={() => navigate(`/erp/users/${user.id}`)}
              onToggleActive={() => toggleActive(user.id)}
              onResetPassword={() => resetPassword(user.id, user.username)}
            />
          ))}
        </div>
      ) : (
        /* ── Table View ── */
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b bg-muted/40 text-muted-foreground font-semibold">
                  <th className="py-3 px-4">Staff Member</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">Clinical Roles</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Registered Date</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredUsers.map((user) => {
                  const initials = (user.first_name?.[0] || user.username?.[0] || "?").toUpperCase();
                  const fullName = `${user.first_name} ${user.last_name}`.trim() || user.username;
                  return (
                    <tr
                      key={user.id}
                      onClick={() => navigate(`/erp/users/${user.id}`)}
                      className="hover:bg-accent/40 cursor-pointer transition-colors"
                    >
                      <td className="py-2.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <Avatar
                            initials={initials}
                            size="md"
                            className={user.is_active ? "bg-emerald-500/10 text-emerald-600 font-bold" : "bg-muted text-muted-foreground"}
                          />
                          <div>
                            <div className="font-semibold text-foreground">{fullName}</div>
                            <div className="text-[11px] text-muted-foreground">@{user.username}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 px-4 text-muted-foreground">{user.email}</td>
                      <td className="py-2.5 px-4">
                        <div className="flex items-center gap-1 flex-wrap">
                          {user.roles.slice(0, 2).map((role) => {
                            const isHc = HEALTHCARE_ROLES.includes(role);
                            return (
                              <span
                                key={role}
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                                  isHc
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300"
                                    : "bg-muted text-muted-foreground border-border"
                                }`}
                              >
                                {isHc && <Icon icon="solar:shield-cross-bold" size={10} />}
                                {role}
                              </span>
                            );
                          })}
                          {user.roles.length > 2 && (
                            <Badge variant="secondary" className="text-[10px] px-1">+{user.roles.length - 2}</Badge>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-4">
                        {user.is_active ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-destructive">
                            <span className="h-1.5 w-1.5 rounded-full bg-destructive" /> Disabled
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-muted-foreground">
                        {new Date(user.date_joined).toLocaleDateString()}
                      </td>
                      <td className="py-2.5 px-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => toggleActive(user.id)}
                            title={user.is_active ? "Suspend Staff" : "Activate Staff"}
                          >
                            <Icon
                              icon={user.is_active ? "solar:pause-circle-bold" : "solar:play-circle-bold"}
                              size={16}
                              className={user.is_active ? "text-amber-500" : "text-emerald-500"}
                            />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => resetPassword(user.id, user.username)}
                            title="Reset Credentials"
                          >
                            <Icon icon="solar:key-bold" size={15} className="text-muted-foreground" />
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

      {/* ── Add New Staff Modal ───────────────────────────────────── */}
      <Dialog open={showNewUser} onOpenChange={setShowNewUser}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Icon icon="solar:user-plus-bold" size={20} className="text-emerald-600" />
              Register New Healthcare Staff Member
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3.5 py-2 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-medium mb-1">Username *</label>
                <input
                  type="text"
                  value={newUserForm.username}
                  onChange={(e) => setNewUserForm((p) => ({ ...p, username: e.target.value }))}
                  placeholder="e.g. dr_smith"
                  className="w-full px-3 py-2 rounded-md border bg-background text-xs"
                />
              </div>
              <div>
                <label className="block font-medium mb-1">Email Address *</label>
                <input
                  type="email"
                  value={newUserForm.email}
                  onChange={(e) => setNewUserForm((p) => ({ ...p, email: e.target.value }))}
                  placeholder="e.g. smith@hospital.org"
                  className="w-full px-3 py-2 rounded-md border bg-background text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-medium mb-1">First Name</label>
                <input
                  type="text"
                  value={newUserForm.first_name}
                  onChange={(e) => setNewUserForm((p) => ({ ...p, first_name: e.target.value }))}
                  placeholder="e.g. Jane"
                  className="w-full px-3 py-2 rounded-md border bg-background text-xs"
                />
              </div>
              <div>
                <label className="block font-medium mb-1">Last Name</label>
                <input
                  type="text"
                  value={newUserForm.last_name}
                  onChange={(e) => setNewUserForm((p) => ({ ...p, last_name: e.target.value }))}
                  placeholder="e.g. Doe"
                  className="w-full px-3 py-2 rounded-md border bg-background text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-medium mb-1">Primary Clinical Role *</label>
                <select
                  value={newUserForm.role}
                  onChange={(e) => setNewUserForm((p) => ({ ...p, role: e.target.value }))}
                  className="w-full px-3 py-2 rounded-md border bg-background text-xs font-medium"
                >
                  {HEALTHCARE_ROLES.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-medium mb-1">Clinical Department</label>
                <select
                  value={newUserForm.department}
                  onChange={(e) => setNewUserForm((p) => ({ ...p, department: e.target.value }))}
                  className="w-full px-3 py-2 rounded-md border bg-background text-xs"
                >
                  {CLINICAL_DEPARTMENTS.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block font-medium mb-1">Initial Password</label>
              <input
                type="password"
                value={newUserForm.password}
                onChange={(e) => setNewUserForm((p) => ({ ...p, password: e.target.value }))}
                placeholder="Password"
                className="w-full px-3 py-2 rounded-md border bg-background text-xs"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t">
            <Button variant="outline" size="sm" onClick={() => setShowNewUser(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={creating || !newUserForm.username || !newUserForm.email}
              onClick={handleCreateUser}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {creating ? <Icon icon="solar:refresh-bold" size={14} className="mr-1 animate-spin" /> : null}
              Register Staff Member
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Staff Member Profile Card ───────────────────────────────────────

function StaffCard({
  user,
  onNavigate,
  onToggleActive,
  onResetPassword,
}: {
  user: UserData;
  onNavigate: () => void;
  onToggleActive: () => void;
  onResetPassword: () => void;
}) {
  const initials = (user.first_name?.[0] || user.username?.[0] || "?").toUpperCase();
  const fullName = `${user.first_name} ${user.last_name}`.trim() || user.username;

  return (
    <Card
      onClick={onNavigate}
      className="p-4 hover:shadow-md transition-all cursor-pointer border hover:border-emerald-500/50 group bg-card/70 backdrop-blur-xs flex flex-col justify-between"
    >
      <div>
        {/* Top Info Bar */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Avatar
                initials={initials}
                size="xl"
                className={
                  user.is_active
                    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-500/30"
                    : "bg-muted text-muted-foreground"
                }
              />
              <span
                className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-background ${
                  user.is_active ? "bg-emerald-500" : "bg-destructive"
                }`}
              />
            </div>

            <div>
              <div className="font-semibold text-sm text-foreground group-hover:text-emerald-600 transition-colors">
                {fullName}
              </div>
              <div className="text-[11px] text-muted-foreground">@{user.username}</div>
            </div>
          </div>

          <Badge variant={user.is_active ? "success" : "destructive"} className="text-[10px] px-2 py-0.5">
            {user.is_active ? "Active" : "Disabled"}
          </Badge>
        </div>

        {/* Clinical Contact Details */}
        <div className="mt-3.5 space-y-1.5 text-xs text-muted-foreground">
          <div className="flex items-center gap-2 truncate">
            <Icon icon="solar:letter-bold" size={14} className="shrink-0 text-muted-foreground/70" />
            <span className="truncate">{user.email}</span>
          </div>
          <div className="flex items-center gap-2 text-[11px]">
            <Icon icon="solar:calendar-bold" size={14} className="shrink-0 text-muted-foreground/70" />
            <span>Joined: {new Date(user.date_joined).toLocaleDateString()}</span>
          </div>
        </div>

        {/* Roles Badges */}
        <div className="mt-3 pt-3 border-t flex flex-wrap gap-1.5">
          {user.roles.map((role) => {
            const isHc = HEALTHCARE_ROLES.includes(role);
            return (
              <span
                key={role}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                  isHc
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                    : "bg-muted text-muted-foreground border-border"
                }`}
              >
                {isHc && <Icon icon="solar:shield-cross-bold" size={11} className="text-emerald-600" />}
                {role}
              </span>
            );
          })}
          {user.roles.length === 0 && (
            <span className="text-[10px] text-muted-foreground italic">No roles assigned</span>
          )}
        </div>
      </div>

      {/* Card Action Footer */}
      <div className="mt-4 pt-2.5 border-t flex items-center justify-between text-xs" onClick={(e) => e.stopPropagation()}>
        <span className="text-[11px] text-muted-foreground">
          {user.last_login ? `Active: ${new Date(user.last_login).toLocaleDateString()}` : "Never logged in"}
        </span>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={onResetPassword}
            title="Reset Password"
          >
            <Icon icon="solar:key-bold" size={14} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onToggleActive}
            title={user.is_active ? "Suspend Staff" : "Activate Staff"}
          >
            <Icon
              icon={user.is_active ? "solar:pause-circle-bold" : "solar:play-circle-bold"}
              size={15}
              className={user.is_active ? "text-amber-500" : "text-emerald-500"}
            />
          </Button>
        </div>
      </div>
    </Card>
  );
}
