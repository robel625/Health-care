import { Icon } from "@/components/icon";
import { Badge } from "@/ui/badge";
import { Button } from "@/ui/button";
import { Card, CardContent, CardHeader } from "@/ui/card";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { Switch } from "@/ui/switch";
import { Separator } from "@/ui/separator";
import { Text } from "@/ui/typography";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/ui/dialog";
import Table, { type ColumnsType } from "antd/es/table";
import { useEffect, useState, useCallback, useMemo } from "react";
import {
  UserPermissionApi,
  UserListApi,
  DocTypeListApi,
  type UserPermission,
  type UserListItem,
  type DocTypeListItem,
} from "@/api/services/erpService";

const HEALTHCARE_RESTRICT_DOCTYPES = [
  { name: "Medical Department", icon: "solar:hospital-bold", hint: "Restrict staff to records belonging to specific departments" },
  { name: "Healthcare Practitioner", icon: "solar:stethoscope-bold", hint: "Restrict to appointments & encounters of a specific doctor" },
  { name: "Healthcare Service Unit", icon: "solar:bed-bold", hint: "Restrict to specific clinic wards, ICU, or substation rooms" },
  { name: "Company", icon: "solar:buildings-bold", hint: "Restrict staff to a specific hospital branch or regional health center" },
  { name: "Pharmacy Warehouse", icon: "solar:pill-bold", hint: "Restrict to a specific hospital dispensary or drug warehouse" },
];

export default function UserPermissionsPage() {
  const [permissions, setPermissions] = useState<UserPermission[]>([]);
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [doctypes, setDoctypes] = useState<DocTypeListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [userFilter, setUserFilter] = useState("");
  const [allowFilter, setAllowFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<UserPermission | null>(null);

  const [form, setForm] = useState({
    user: 0,
    allow: "Medical Department",
    for_value: "",
    is_default: true,
    apply_to_all_doctypes: true,
    applicable_for: "",
    hide_descendants: false,
  });

  const loadDropdowns = useCallback(async () => {
    try {
      const [usersRes, doctypesRes] = await Promise.all([
        UserListApi.list({ page_size: 100 }),
        DocTypeListApi.list({ page_size: 100 }),
      ]);
      setUsers(usersRes.results || []);
      setDoctypes(doctypesRes.results || []);
    } catch (err) {
      console.error("Failed to load dropdowns:", err);
    }
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = { page };
      if (search) params.search = search;
      if (userFilter) params.user = userFilter;
      if (allowFilter) params.allow = allowFilter;
      const res = await UserPermissionApi.list(params);
      setPermissions(res.results || []);
      setTotal(res.count || 0);
    } catch (err) {
      console.error("Failed to load permissions:", err);
    } finally {
      setLoading(false);
    }
  }, [page, search, userFilter, allowFilter]);

  useEffect(() => {
    loadDropdowns();
  }, [loadDropdowns]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSubmit = async () => {
    try {
      const payload: any = {
        user: form.user,
        allow: form.allow,
        for_value: form.for_value,
        is_default: form.is_default,
        apply_to_all_doctypes: form.apply_to_all_doctypes,
        hide_descendants: form.hide_descendants,
      };
      if (!form.apply_to_all_doctypes && form.applicable_for) {
        payload.applicable_for = form.applicable_for;
      }
      if (editItem) {
        await UserPermissionApi.update(editItem.id, payload);
      } else {
        await UserPermissionApi.create(payload);
      }
      setShowForm(false);
      setEditItem(null);
      resetForm();
      loadData();
    } catch (err: any) {
      alert(err?.response?.data?.detail || "Failed to save user permission rule");
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Remove this data scoping restriction?")) return;
    try {
      await UserPermissionApi.delete(id);
      loadData();
    } catch (err: any) {
      alert("Failed to delete");
    }
  };

  const resetForm = () => {
    setForm({
      user: users[0]?.id || 0,
      allow: "Medical Department",
      for_value: "",
      is_default: true,
      apply_to_all_doctypes: true,
      applicable_for: "",
      hide_descendants: false,
    });
  };

  const handleApplyPreset = (doctype: string, placeholderExample: string) => {
    setForm((p) => ({
      ...p,
      allow: doctype,
      for_value: placeholderExample,
    }));
  };

  // Stats
  const stats = useMemo(() => {
    const totalRules = permissions.length;
    const scopedUsers = new Set(permissions.map((p) => p.user)).size;
    const deptRules = permissions.filter((p) => p.allow === "Medical Department").length;
    const practitionerRules = permissions.filter((p) => p.allow === "Healthcare Practitioner").length;
    return { totalRules, scopedUsers, deptRules, practitionerRules };
  }, [permissions]);

  const columns: ColumnsType<UserPermission> = [
    {
      title: "Target Staff Member",
      dataIndex: "user_username",
      width: 220,
      render: (name) => (
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-full bg-emerald-500/10 text-emerald-600 font-bold flex items-center justify-center text-xs">
            {name ? name.slice(0, 2).toUpperCase() : "??"}
          </div>
          <span className="font-semibold text-xs text-foreground">{name}</span>
        </div>
      ),
    },
    {
      title: "Restricting Entity",
      dataIndex: "allow",
      width: 200,
      render: (v) => {
        const isDept = v === "Medical Department";
        const isDoc = v === "Healthcare Practitioner";
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300">
            <Icon icon={isDept ? "solar:hospital-bold" : isDoc ? "solar:stethoscope-bold" : "solar:shield-keyhole-bold"} size={13} />
            {v}
          </span>
        );
      },
    },
    {
      title: "Permitted Value",
      dataIndex: "for_value",
      width: 220,
      render: (v) => <span className="font-semibold text-xs text-foreground bg-muted/40 px-2 py-0.5 rounded border">{v}</span>,
    },
    {
      title: "Scope Coverage",
      dataIndex: "apply_to_all_doctypes",
      width: 140,
      align: "center",
      render: (v, r) => (
        v ? (
          <Badge variant="success" className="text-[10px]">All Medical Docs</Badge>
        ) : (
          <Badge variant="outline" className="text-[10px]">{r.applicable_for || "Specific Only"}</Badge>
        )
      ),
    },
    {
      title: "Default Rule",
      dataIndex: "is_default",
      width: 100,
      align: "center",
      render: (v) => (
        <span className={`text-[11px] font-semibold ${v ? "text-emerald-600" : "text-muted-foreground"}`}>
          {v ? "Yes" : "No"}
        </span>
      ),
    },
    {
      title: "Actions",
      key: "action",
      align: "center",
      width: 100,
      render: (_, record) => (
        <div className="flex items-center justify-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={() => {
              setEditItem(record);
              setForm({
                user: record.user,
                allow: record.allow,
                for_value: record.for_value,
                is_default: record.is_default,
                apply_to_all_doctypes: record.apply_to_all_doctypes,
                applicable_for: record.applicable_for || "",
                hide_descendants: record.hide_descendants,
              });
              setShowForm(true);
            }}
            title="Edit Scope"
          >
            <Icon icon="solar:pen-bold-duotone" size={15} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={() => handleDelete(record.id)}
            title="Revoke Scope"
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-3.5 flex items-center justify-between border-l-4 border-l-emerald-600 bg-card/60 backdrop-blur-sm">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Active Scopes</div>
            <div className="text-2xl font-bold mt-0.5 text-emerald-600">{stats.totalRules}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">Row-Level Security Constraints</div>
          </div>
          <div className="p-2.5 bg-emerald-500/10 rounded-xl text-emerald-600">
            <Icon icon="solar:shield-keyhole-bold" size={24} />
          </div>
        </Card>

        <Card className="p-3.5 flex items-center justify-between border-l-4 border-l-primary bg-card/60 backdrop-blur-sm">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Scoped Personnel</div>
            <div className="text-2xl font-bold mt-0.5 text-primary">{stats.scopedUsers} Users</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">Restricted to specific data</div>
          </div>
          <div className="p-2.5 bg-primary/10 rounded-xl text-primary">
            <Icon icon="solar:users-group-rounded-bold" size={24} />
          </div>
        </Card>

        <Card className="p-3.5 flex items-center justify-between border-l-4 border-l-blue-500 bg-card/60 backdrop-blur-sm">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Department Scopes</div>
            <div className="text-2xl font-bold mt-0.5 text-blue-600">{stats.deptRules} Rules</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">e.g. Cardiology, ER, Wards</div>
          </div>
          <div className="p-2.5 bg-blue-500/10 rounded-xl text-blue-600">
            <Icon icon="solar:hospital-bold" size={24} />
          </div>
        </Card>

        <Card className="p-3.5 flex items-center justify-between border-l-4 border-l-purple-500 bg-card/60 backdrop-blur-sm">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Doctor Rosters</div>
            <div className="text-2xl font-bold mt-0.5 text-purple-600">{stats.practitionerRules} Rules</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">Practitioner Patient Scopes</div>
          </div>
          <div className="p-2.5 bg-purple-500/10 rounded-xl text-purple-600">
            <Icon icon="solar:stethoscope-bold" size={24} />
          </div>
        </Card>
      </div>

      {/* ── Main Table Card ──────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="text-lg font-semibold flex items-center gap-2">
                <Icon icon="solar:shield-keyhole-bold" size={22} className="text-emerald-600" />
                Healthcare Data Scoping (User Permissions)
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Enforce privacy and compartmentalize hospital records: restrict staff to specific medical departments or clinic units
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <select
                className="h-8 rounded-md border border-input bg-background px-2.5 text-xs"
                value={userFilter}
                onChange={(e) => { setUserFilter(e.target.value); setPage(1); }}
              >
                <option value="">All Staff Members</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.username}</option>
                ))}
              </select>

              <select
                className="h-8 rounded-md border border-input bg-background px-2.5 text-xs font-medium"
                value={allowFilter}
                onChange={(e) => { setAllowFilter(e.target.value); setPage(1); }}
              >
                <option value="">All Restricting Entities</option>
                {HEALTHCARE_RESTRICT_DOCTYPES.map((d) => (
                  <option key={d.name} value={d.name}>{d.name}</option>
                ))}
              </select>

              <Button size="sm" onClick={() => { resetForm(); setEditItem(null); setShowForm(true); }} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                <Icon icon="solar:add-circle-bold" size={16} className="mr-1" />
                Add Data Scope Rule
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
            dataSource={permissions}
            loading={loading}
            pagination={{
              current: page,
              total,
              pageSize: 15,
              showSizeChanger: false,
              onChange: (p) => setPage(p),
            }}
          />
        </CardContent>
      </Card>

      {/* ── Add / Edit Scope Rule Modal ──────────────────────────── */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Icon icon="solar:shield-keyhole-bold" size={20} className="text-emerald-600" />
              {editItem ? "Edit Data Scoping Rule" : "Create Healthcare Data Scoping Rule"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            {/* Quick Presets */}
            <div>
              <span className="font-semibold text-muted-foreground block mb-1.5">Quick Clinical Presets:</span>
              <div className="flex gap-1.5 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-7"
                  onClick={() => handleApplyPreset("Medical Department", "Cardiology")}
                >
                  <Icon icon="solar:hospital-bold" size={13} className="mr-1 text-emerald-600" />
                  Cardiology Dept
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-7"
                  onClick={() => handleApplyPreset("Medical Department", "Emergency & Trauma")}
                >
                  <Icon icon="solar:ambulance-bold" size={13} className="mr-1 text-red-500" />
                  Emergency Ward
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-7"
                  onClick={() => handleApplyPreset("Pharmacy Warehouse", "Main Pharmacy Dispensary")}
                >
                  <Icon icon="solar:pill-bold" size={13} className="mr-1 text-purple-600" />
                  Pharmacy Only
                </Button>
              </div>
            </div>

            <Separator />

            {/* User */}
            <div>
              <Label className="block font-semibold mb-1">Target Healthcare User *</Label>
              <select
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs"
                value={form.user}
                onChange={(e) => setForm({ ...form, user: Number(e.target.value) })}
              >
                <option value={0}>Select staff member...</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.username} ({u.email})</option>
                ))}
              </select>
            </div>

            {/* Restricting Doctype */}
            <div>
              <Label className="block font-semibold mb-1">Restricting Model (Allow Entity) *</Label>
              <select
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs font-medium"
                value={form.allow}
                onChange={(e) => setForm({ ...form, allow: e.target.value })}
              >
                {HEALTHCARE_RESTRICT_DOCTYPES.map((dt) => (
                  <option key={dt.name} value={dt.name}>{dt.name} — {dt.hint}</option>
                ))}
              </select>
            </div>

            {/* Value */}
            <div>
              <Label className="block font-semibold mb-1">Permitted Value / Name *</Label>
              <Input
                value={form.for_value}
                onChange={(e) => setForm({ ...form, for_value: e.target.value })}
                placeholder="e.g. Cardiology, Dr. John Smith, or Substation Ward B"
                className="text-xs"
              />
            </div>

            {/* Rule Explainer Box */}
            {form.user > 0 && form.for_value && (
              <div className="p-3 border rounded-lg bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800 text-[11px] space-y-1">
                <div className="font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                  <Icon icon="solar:info-circle-bold" size={14} />
                  Effect of this security policy:
                </div>
                <div className="text-emerald-700 dark:text-emerald-400">
                  Staff member <strong>{users.find((u) => u.id === form.user)?.username}</strong> will only be allowed to access documents associated with <strong>{form.allow} = "{form.for_value}"</strong>. Records from other departments will be completely hidden.
                </div>
              </div>
            )}

            {/* Toggles */}
            <div className="space-y-2 p-3 border rounded-lg bg-card">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">Apply to All Healthcare DocTypes</div>
                  <div className="text-[11px] text-muted-foreground">Applies to Patients, Appointments, Vitals, Prescriptions, Encounters</div>
                </div>
                <Switch
                  checked={form.apply_to_all_doctypes}
                  onCheckedChange={(v) => setForm({ ...form, apply_to_all_doctypes: v })}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">Default Rule</div>
                  <div className="text-[11px] text-muted-foreground">Auto-fill this restriction value when creating new medical records</div>
                </div>
                <Switch
                  checked={form.is_default}
                  onCheckedChange={(v) => setForm({ ...form, is_default: v })}
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t">
            <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={!form.user || !form.for_value}
              onClick={handleSubmit}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {editItem ? "Update Scope" : "Activate Scope"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
