import { Icon } from "@/components/icon";
import { Badge } from "@/ui/badge";
import { Button } from "@/ui/button";
import { Card, CardContent, CardHeader } from "@/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/ui/dialog";
import { Input } from "@/ui/input";
import { Separator } from "@/ui/separator";
import { Text } from "@/ui/typography";
import Table, { type ColumnsType } from "antd/es/table";
import { useEffect, useState, useCallback, useMemo } from "react";
import apiClient from "@/api/apiClient";

interface UserRole {
  id: number;
  user: number;
  user_username: string;
  user_email: string;
  role: number;
  role_name: string;
  creation: string;
}

interface Role {
  id: number;
  name: string;
  description?: string;
  restrict_to_domain?: string;
}

interface User {
  id: number;
  username: string;
  email: string;
  first_name?: string;
  last_name?: string;
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
  "System Manager",
  "Administrator",
];

export default function UserRolesPage() {
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState<"all" | "physicians" | "nursing" | "pharmacy_lab">("all");
  const [viewGrouping, setViewGrouping] = useState<"flat" | "user">("user");

  // Modal State
  const [showForm, setShowForm] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<number>(0);
  const [selectedRoleNames, setSelectedRoleNames] = useState<string[]>([]);
  const [roleSearch, setRoleSearch] = useState("");
  const [modalRoleCategory, setModalRoleCategory] = useState<"all" | "healthcare" | "other">("healthcare");
  const [modalLoading, setModalLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [urRes, rolesRes, usersRes] = await Promise.all([
        apiClient.get<{ results: UserRole[]; count: number }>({ url: "/roles/user-roles/", params: { page_size: 200 } }),
        apiClient.get<{ results: Role[] }>({ url: "/roles/roles/", params: { page_size: 200 } }),
        apiClient.get<{ results: User[] }>({ url: "/auth/users/", params: { page_size: 200 } }),
      ]);
      setUserRoles(urRes.results || []);
      setRoles(rolesRes.results || []);
      setUsers(usersRes.results || []);
    } catch (err) {
      console.error("Failed to load user-roles data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // When a user is selected in the modal, load their assigned roles
  const handleUserSelect = async (userId: number) => {
    setSelectedUserId(userId);
    if (!userId) {
      setSelectedRoleNames([]);
      return;
    }
    setModalLoading(true);
    try {
      const assigned = await apiClient.get<string[]>({ url: `/roles/users/${userId}/roles/` });
      if (Array.isArray(assigned)) {
        setSelectedRoleNames(assigned);
      }
    } catch {
      const userAssigned = userRoles
        .filter((ur) => ur.user === userId)
        .map((ur) => ur.role_name);
      setSelectedRoleNames(userAssigned);
    } finally {
      setModalLoading(false);
    }
  };

  const handleOpenAssignModal = (userId?: number) => {
    setRoleSearch("");
    setModalRoleCategory("healthcare");
    setShowForm(true);
    if (userId) {
      handleUserSelect(userId);
    } else if (users.length > 0) {
      handleUserSelect(users[0].id);
    }
  };

  const handleToggleRole = (roleName: string) => {
    setSelectedRoleNames((prev) =>
      prev.includes(roleName)
        ? prev.filter((r) => r !== roleName)
        : [...prev, roleName],
    );
  };

  const handleSaveRoles = async () => {
    if (!selectedUserId) return;
    setSaving(true);
    try {
      await apiClient.post({
        url: `/roles/users/${selectedUserId}/assign_roles/`,
        data: { roles: selectedRoleNames },
      });
      setShowForm(false);
      loadData();
    } catch (err) {
      console.error("Failed to save roles:", err);
      alert("Failed to save roles");
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveAssignment = async (id: number) => {
    if (!window.confirm("Remove this clinical role assignment?")) return;
    try {
      await apiClient.delete({ url: `/roles/user-roles/${id}/` });
      loadData();
    } catch (err) {
      console.error("Failed to delete user role:", err);
      alert("Failed to remove assignment");
    }
  };

  // Grouped by User
  const usersWithRoles = useMemo(() => {
    const map = new Map<number, { user: User; roles: string[]; userRoles: UserRole[] }>();
    users.forEach((u) => {
      map.set(u.id, { user: u, roles: [], userRoles: [] });
    });
    userRoles.forEach((ur) => {
      const existing = map.get(ur.user);
      if (existing) {
        if (!existing.roles.includes(ur.role_name)) {
          existing.roles.push(ur.role_name);
        }
        existing.userRoles.push(ur);
      }
    });

    let list = Array.from(map.values())
      .map((item) => ({
        ...item,
        roles: item.roles.filter((r) => HEALTHCARE_ROLES.includes(r)),
        userRoles: item.userRoles.filter((ur) => HEALTHCARE_ROLES.includes(ur.role_name)),
      }))
      .filter((item) => item.roles.length > 0);

    if (filterCategory === "physicians") {
      list = list.filter((item) => item.roles.some((r) => r.toLowerCase().includes("physician")));
    } else if (filterCategory === "nursing") {
      list = list.filter((item) => item.roles.some((r) => r.toLowerCase().includes("nurse")));
    } else if (filterCategory === "pharmacy_lab") {
      list = list.filter((item) => item.roles.some((r) => r.toLowerCase().includes("pharm") || r.toLowerCase().includes("lab")));
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((item) =>
        item.user.username.toLowerCase().includes(q) ||
        item.user.email.toLowerCase().includes(q) ||
        item.roles.some((r) => r.toLowerCase().includes(q))
      );
    }
    return list;
  }, [users, userRoles, filterCategory, search]);

  // Filtered flat list
  const filteredFlatRoles = useMemo(() => {
    let list = userRoles.filter((ur) => HEALTHCARE_ROLES.includes(ur.role_name));
    if (filterCategory === "physicians") {
      list = list.filter((ur) => ur.role_name.toLowerCase().includes("physician"));
    } else if (filterCategory === "nursing") {
      list = list.filter((ur) => ur.role_name.toLowerCase().includes("nurse"));
    } else if (filterCategory === "pharmacy_lab") {
      list = list.filter((ur) => ur.role_name.toLowerCase().includes("pharm") || ur.role_name.toLowerCase().includes("lab"));
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((ur) =>
        ur.user_username.toLowerCase().includes(q) ||
        ur.role_name.toLowerCase().includes(q) ||
        ur.user_email.toLowerCase().includes(q)
      );
    }
    return list;
  }, [userRoles, filterCategory, search]);

  // Statistics
  const stats = useMemo(() => {
    const totalAssignments = userRoles.filter((ur) => HEALTHCARE_ROLES.includes(ur.role_name)).length;
    const healthcareAssignments = totalAssignments;
    const doctorsAssigned = new Set(userRoles.filter((ur) => ur.role_name.toLowerCase().includes("physician")).map((ur) => ur.user)).size;
    const nursesAssigned = new Set(userRoles.filter((ur) => ur.role_name.toLowerCase().includes("nurse")).map((ur) => ur.user)).size;
    const pharmacyLabAssigned = new Set(userRoles.filter((ur) => ur.role_name.toLowerCase().includes("pharm") || ur.role_name.toLowerCase().includes("lab")).map((ur) => ur.user)).size;
    return { totalAssignments, healthcareAssignments, doctorsAssigned, nursesAssigned, pharmacyLabAssigned };
  }, [userRoles]);

  // Modal filtered roles
  const filteredModalRoles = useMemo(() => {
    return roles.filter((role) => {
      const matchSearch = !roleSearch || role.name.toLowerCase().includes(roleSearch.toLowerCase());
      const isHealthcare = HEALTHCARE_ROLES.includes(role.name);
      return matchSearch && isHealthcare;
    });
  }, [roles, roleSearch]);

  const flatColumns: ColumnsType<UserRole> = [
    {
      title: "Practitioner / Staff",
      dataIndex: "user_username",
      width: 240,
      render: (name, record) => (
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/10 text-xs font-bold text-emerald-600">
            {name ? name.slice(0, 2).toUpperCase() : "??"}
          </div>
          <div>
            <div className="font-semibold text-sm">{name}</div>
            <div className="text-xs text-muted-foreground">{record.user_email}</div>
          </div>
        </div>
      ),
    },
    {
      title: "Clinical Role Assigned",
      dataIndex: "role_name",
      width: 250,
      render: (name) => {
        const isHc = HEALTHCARE_ROLES.includes(name);
        return isHc ? (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300">
            <Icon icon="solar:shield-cross-bold" size={13} className="text-emerald-600" />
            {name}
          </span>
        ) : (
          <Badge variant="outline">{name}</Badge>
        );
      },
    },
    {
      title: "Domain Scope",
      key: "domain",
      width: 140,
      render: (_, record) => {
        const isHc = HEALTHCARE_ROLES.includes(record.role_name);
        return isHc ? (
          <span className="text-xs font-semibold text-emerald-600">🏥 Clinical Domain</span>
        ) : (
          <span className="text-xs text-muted-foreground">General System</span>
        );
      },
    },
    {
      title: "Assigned Date",
      dataIndex: "creation",
      width: 130,
      render: (v) => (v ? new Date(v).toLocaleDateString() : "—"),
    },
    {
      title: "Actions",
      key: "action",
      align: "center",
      width: 110,
      render: (_, record) => (
        <div className="flex items-center justify-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-primary"
            onClick={() => handleOpenAssignModal(record.user)}
          >
            Edit Roles
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={() => handleRemoveAssignment(record.id)}
            title="Revoke Assignment"
          >
            <Icon icon="mingcute:delete-2-fill" size={15} />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* ── KPI Metrics Cards ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
        <Card className="p-3.5 flex items-center justify-between border-l-4 border-l-emerald-600 bg-card/60 backdrop-blur-sm">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Clinical Assignments</div>
            <div className="text-2xl font-bold mt-0.5 text-emerald-600">{stats.healthcareAssignments}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">Medical Privileges Granted</div>
          </div>
          <div className="p-2.5 bg-emerald-500/10 rounded-xl text-emerald-600">
            <Icon icon="solar:shield-cross-bold" size={24} />
          </div>
        </Card>

        <Card className="p-3.5 flex items-center justify-between border-l-4 border-l-primary bg-card/60 backdrop-blur-sm">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Doctors Assigned</div>
            <div className="text-2xl font-bold mt-0.5 text-primary">{stats.doctorsAssigned}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">Physicians & Surgeons</div>
          </div>
          <div className="p-2.5 bg-primary/10 rounded-xl text-primary">
            <Icon icon="solar:stethoscope-bold" size={24} />
          </div>
        </Card>

        <Card className="p-3.5 flex items-center justify-between border-l-4 border-l-blue-500 bg-card/60 backdrop-blur-sm">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Nursing Roster</div>
            <div className="text-2xl font-bold mt-0.5 text-blue-600">{stats.nursesAssigned}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">Active Ward Nurses</div>
          </div>
          <div className="p-2.5 bg-blue-500/10 rounded-xl text-blue-600">
            <Icon icon="solar:heart-pulse-bold" size={24} />
          </div>
        </Card>

        <Card className="p-3.5 flex items-center justify-between border-l-4 border-l-purple-500 bg-card/60 backdrop-blur-sm">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Pharmacy & Lab</div>
            <div className="text-2xl font-bold mt-0.5 text-purple-600">{stats.pharmacyLabAssigned}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">Dispensing & Diagnostics</div>
          </div>
          <div className="p-2.5 bg-purple-500/10 rounded-xl text-purple-600">
            <Icon icon="solar:pill-bold" size={24} />
          </div>
        </Card>

        <Card className="p-3.5 flex items-center justify-between border-l-4 border-l-amber-500 bg-card/60 backdrop-blur-sm col-span-2 md:col-span-1">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Total Assignments</div>
            <div className="text-2xl font-bold mt-0.5 text-foreground">{stats.totalAssignments}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">Across All Users</div>
          </div>
          <div className="p-2.5 bg-amber-500/10 rounded-xl text-amber-600">
            <Icon icon="solar:shield-user-bold" size={24} />
          </div>
        </Card>
      </div>

      {/* ── Main Control Card ────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="text-lg font-semibold flex items-center gap-2">
                <Icon icon="solar:shield-check-bold" size={22} className="text-emerald-600" />
                Hospital Staff Role Allocations
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Assign and synchronize clinical credentials, ward responsibilities, and doctor privileges
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Grouping View Toggle */}
              <div className="flex rounded-lg border border-border p-0.5 bg-muted/40 text-xs">
                <button
                  type="button"
                  onClick={() => setViewGrouping("user")}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-colors ${
                    viewGrouping === "user" ? "bg-card text-foreground font-semibold shadow-xs" : "text-muted-foreground hover:text-foreground"
                  }`}
                  title="Grouped by Practitioner"
                >
                  <Icon icon="solar:users-group-rounded-bold" size={14} />
                  By Practitioner
                </button>
                <button
                  type="button"
                  onClick={() => setViewGrouping("flat")}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-colors ${
                    viewGrouping === "flat" ? "bg-card text-foreground font-semibold shadow-xs" : "text-muted-foreground hover:text-foreground"
                  }`}
                  title="Individual Role Grants"
                >
                  <Icon icon="solar:list-bold" size={14} />
                  All Grants
                </button>
              </div>

              {/* Domain Filter */}
              <div className="flex rounded-lg border border-border p-0.5 bg-muted/40 text-xs flex-wrap">
                <button
                  type="button"
                  onClick={() => setFilterCategory("all")}
                  className={`px-2.5 py-1 rounded-md transition-colors ${
                    filterCategory === "all" ? "bg-card text-foreground font-semibold shadow-xs" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  All Clinical ({stats.healthcareAssignments})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterCategory("physicians")}
                  className={`px-2.5 py-1 rounded-md transition-colors ${
                    filterCategory === "physicians" ? "bg-card text-foreground font-semibold shadow-xs" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  🩺 Physicians ({stats.doctorsAssigned})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterCategory("nursing")}
                  className={`px-2.5 py-1 rounded-md transition-colors ${
                    filterCategory === "nursing" ? "bg-card text-foreground font-semibold shadow-xs" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  💉 Nursing ({stats.nursesAssigned})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterCategory("pharmacy_lab")}
                  className={`px-2.5 py-1 rounded-md transition-colors ${
                    filterCategory === "pharmacy_lab" ? "bg-card text-foreground font-semibold shadow-xs" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  🔬 Pharmacy & Lab ({stats.pharmacyLabAssigned})
                </button>
              </div>

              <Input
                placeholder="Search staff / role..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-40 text-xs h-8"
              />

              <Button size="sm" onClick={() => handleOpenAssignModal()} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                <Icon icon="solar:user-plus-bold" size={16} className="mr-1" />
                Assign Role
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="flex flex-col items-center justify-center h-48 space-y-2">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
              <Text variant="caption" color="secondary">Loading role assignments...</Text>
            </div>
          ) : viewGrouping === "user" ? (
            /* ── Grouped By Practitioner Cards View ── */
            <div className="space-y-3">
              {usersWithRoles.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-xs">No practitioners matching filter.</div>
              ) : (
                usersWithRoles.map((item) => {
                  const initials = (item.user.first_name?.[0] || item.user.username?.[0] || "?").toUpperCase();
                  const fullName = `${item.user.first_name || ""} ${item.user.last_name || ""}`.trim() || item.user.username;
                  return (
                    <div
                      key={item.user.id}
                      className="p-3.5 border rounded-xl bg-card hover:border-emerald-500/50 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-bold text-sm border border-emerald-500/20">
                          {initials}
                        </div>
                        <div>
                          <div className="font-semibold text-sm flex items-center gap-2">
                            <span>{fullName}</span>
                            <span className="text-xs text-muted-foreground font-normal">@{item.user.username}</span>
                          </div>
                          <div className="text-xs text-muted-foreground">{item.user.email}</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-muted-foreground mr-1">Active Roles:</span>
                        {item.roles.map((r) => {
                          const isHc = HEALTHCARE_ROLES.includes(r);
                          return (
                            <span
                              key={r}
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${
                                isHc
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                                  : "bg-muted text-muted-foreground border-border"
                              }`}
                            >
                              {isHc && <Icon icon="solar:shield-cross-bold" size={12} className="text-emerald-600" />}
                              {r}
                            </span>
                          );
                        })}
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs text-primary"
                          onClick={() => handleOpenAssignModal(item.user.id)}
                        >
                          <Icon icon="solar:pen-bold-duotone" size={14} className="mr-1" />
                          Manage Privileges
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          ) : (
            /* ── Flat Grants Table View ── */
            <Table
              rowKey="id"
              size="small"
              scroll={{ x: "max-content" }}
              columns={flatColumns}
              dataSource={filteredFlatRoles}
              pagination={{
                current: page,
                total: filteredFlatRoles.length,
                pageSize: 15,
                showSizeChanger: false,
                onChange: (p) => setPage(p),
              }}
            />
          )}
        </CardContent>
      </Card>

      {/* ── Assign / Edit Roles Modal ────────────────────────────── */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Icon icon="solar:shield-user-bold" size={20} className="text-emerald-600" />
              Assign Clinical Roles & Authorizations
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            {/* User Selector */}
            <div>
              <label className="block font-semibold mb-1">Select Staff Member *</label>
              <select
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs"
                value={selectedUserId}
                onChange={(e) => handleUserSelect(Number(e.target.value))}
                disabled={modalLoading}
              >
                <option value={0}>Choose a healthcare user...</option>
                {users.map((u) => {
                  const name = `${u.first_name || ""} ${u.last_name || ""}`.trim();
                  return (
                    <option key={u.id} value={u.id}>
                      {name ? `${name} (@${u.username})` : u.username} — {u.email}
                    </option>
                  );
                })}
              </select>
            </div>

            {selectedUserId > 0 && (
              <>
                <Separator />

                {/* Selected Roles Chips */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-foreground">
                      Granted Privileges ({selectedRoleNames.length})
                    </span>
                    <span className="text-muted-foreground text-[11px]">Click tag to revoke</span>
                  </div>

                  {selectedRoleNames.length === 0 ? (
                    <div className="p-3 border rounded-lg bg-muted/20 text-muted-foreground text-center italic">
                      No roles granted yet. Select from list below.
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-1.5 p-2.5 border rounded-lg bg-card">
                      {selectedRoleNames.map((r) => {
                        const isHc = HEALTHCARE_ROLES.includes(r);
                        return (
                          <button
                            key={r}
                            type="button"
                            onClick={() => handleToggleRole(r)}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${
                              isHc
                                ? "bg-emerald-600 text-white hover:bg-emerald-700"
                                : "bg-primary text-primary-foreground hover:bg-primary/80"
                            }`}
                          >
                            {isHc && <Icon icon="solar:shield-cross-bold" size={11} />}
                            {r}
                            <Icon icon="solar:close-circle-bold" size={14} className="opacity-80 hover:opacity-100" />
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Available Roles to Add */}
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="font-semibold text-foreground text-[11px] flex items-center gap-1">
                      <Icon icon="solar:shield-cross-bold" size={13} className="text-emerald-600" />
                      Available Healthcare Roles
                    </span>

                    <Input
                      placeholder="Filter clinical roles..."
                      value={roleSearch}
                      onChange={(e) => setRoleSearch(e.target.value)}
                      className="w-40 text-xs h-7"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2 max-h-52 overflow-y-auto p-1">
                    {filteredModalRoles.map((role) => {
                      const isSelected = selectedRoleNames.includes(role.name);
                      const isHc = HEALTHCARE_ROLES.includes(role.name);
                      return (
                        <button
                          key={role.id}
                          type="button"
                          onClick={() => handleToggleRole(role.name)}
                          className={`flex items-center justify-between p-2.5 rounded-lg border text-left text-xs transition-colors ${
                            isSelected
                              ? isHc
                                ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-200"
                                : "border-primary bg-primary/10 text-primary font-medium"
                              : "border-border hover:bg-accent/40 text-foreground"
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <Icon
                              icon={isSelected ? "solar:check-circle-bold" : "solar:add-circle-bold"}
                              size={16}
                              className={isSelected ? (isHc ? "text-emerald-600" : "text-primary") : "text-muted-foreground"}
                            />
                            <span className="truncate font-medium">{role.name}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t">
            <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={saving || !selectedUserId}
              onClick={handleSaveRoles}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {saving ? <Icon icon="solar:refresh-bold" size={14} className="mr-1 animate-spin" /> : null}
              Confirm & Save Roles
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
