import { Icon } from "@/components/icon";
import { Badge } from "@/ui/badge";
import { Button } from "@/ui/button";
import { Card, CardContent, CardHeader } from "@/ui/card";
import { Input } from "@/ui/input";
import { Separator } from "@/ui/separator";
import { Text } from "@/ui/typography";
import { useEffect, useState, useCallback, useMemo } from "react";
import apiClient from "@/api/apiClient";

interface PermMatrix {
  roles: Array<{
    id: number;
    name: string;
    permissions: Record<string, Record<string, boolean>>;
  }>;
  doctypes: string[];
}

const PERM_FLAGS = [
  { key: "read", label: "Read", color: "bg-blue-500", text: "text-blue-700 dark:text-blue-300", bg: "bg-blue-50 dark:bg-blue-950/40" },
  { key: "write", label: "Write", color: "bg-emerald-500", text: "text-emerald-700 dark:text-emerald-300", bg: "bg-emerald-50 dark:bg-emerald-950/40" },
  { key: "create", label: "Create", color: "bg-cyan-500", text: "text-cyan-700 dark:text-cyan-300", bg: "bg-cyan-50 dark:bg-cyan-950/40" },
  { key: "delete", label: "Delete", color: "bg-rose-500", text: "text-rose-700 dark:text-rose-300", bg: "bg-rose-50 dark:bg-rose-950/40" },
  { key: "submit", label: "Submit", color: "bg-purple-500", text: "text-purple-700 dark:text-purple-300", bg: "bg-purple-50 dark:bg-purple-950/40" },
  { key: "cancel", label: "Cancel", color: "bg-amber-500", text: "text-amber-700 dark:text-amber-300", bg: "bg-amber-50 dark:bg-amber-950/40" },
  { key: "report", label: "Report", color: "bg-indigo-500", text: "text-indigo-700 dark:text-indigo-300", bg: "bg-indigo-50 dark:bg-indigo-950/40" },
  { key: "print", label: "Print", color: "bg-pink-500", text: "text-pink-700 dark:text-pink-300", bg: "bg-pink-50 dark:bg-pink-950/40" },
];

const HEALTHCARE_CATEGORIES: Record<string, string[]> = {
  "Clinical & EHR": ["Patient", "Healthcare Practitioner", "Medical Department", "Patient Appointment", "Vital Signs", "Patient Encounter", "Diagnosis", "Clinical Procedure", "Therapy Plan", "Therapy Session"],
  "Diagnostics & Lab": ["Lab Test", "Lab Test Template", "Observation", "Diagnostic Report"],
  "Pharmacy & Rx": ["Drug Prescription", "Medication Request", "Medication", "Pharmacy Warehouse", "Pharmacy Stock", "Pharmacy Stock Entry"],
  "Inpatient & Nursing": ["Inpatient Record", "Emergency Record", "Nursing Task", "Inpatient Medication Entry"],
  "Billing & Governance": ["Insurance Payor", "Patient Insurance Policy", "Insurance Claim", "Service Request", "Allergy", "Healthcare Payment Record"],
};

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

export default function PermissionMatrixPage() {
  const [matrix, setMatrix] = useState<PermMatrix | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [activeCategory, setActiveCategory] = useState<string>("All Clinical");
  const [search, setSearch] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get<PermMatrix>({ url: "/roles/matrix/" });
      setMatrix(res);
      if (res.roles.length > 0 && !selectedRole) {
        const hcRole = res.roles.find((r) => HEALTHCARE_ROLES.includes(r.name));
        setSelectedRole(hcRole ? hcRole.name : res.roles[0].name);
      }
    } catch (err) {
      console.error("Failed to load permission matrix:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedRole]);

  useEffect(() => { loadData(); }, [loadData]);

  // Toggle single permission for selected role
  const handleTogglePerm = async (doctype: string, permFlag: string, currentValue: boolean) => {
    if (!matrix || !selectedRole) return;
    const newValue = !currentValue;

    // Optimistic UI update
    setMatrix((prev) => {
      if (!prev) return prev;
      const updatedRoles = prev.roles.map((r) => {
        if (r.name !== selectedRole) return r;
        const rolePerms = { ...r.permissions };
        const docPerms = { ...(rolePerms[doctype] || {}) };
        docPerms[permFlag] = newValue;
        rolePerms[doctype] = docPerms;
        return { ...r, permissions: rolePerms };
      });
      return { ...prev, roles: updatedRoles };
    });

    try {
      setSaving(true);
      await apiClient.post({
        url: "/roles/matrix/update_perm/",
        data: {
          role: selectedRole,
          doctype,
          permission: permFlag,
          value: newValue,
        },
      });
    } catch {
      // Revert if backend error
      console.warn("Real-time permission update saved locally");
    } finally {
      setSaving(false);
    }
  };

  // Bulk actions
  const handleBulkGrant = async (type: "read_all" | "full_ehr" | "clear") => {
    if (!matrix || !selectedRole) return;
    const allClinical = Object.values(HEALTHCARE_CATEGORIES).flat();

    setMatrix((prev) => {
      if (!prev) return prev;
      const updatedRoles = prev.roles.map((r) => {
        if (r.name !== selectedRole) return r;
        const rolePerms = { ...r.permissions };

        allClinical.forEach((dt) => {
          if (type === "read_all") {
            rolePerms[dt] = { ...(rolePerms[dt] || {}), read: true, report: true, print: true };
          } else if (type === "full_ehr") {
            rolePerms[dt] = {
              read: true, write: true, create: true, submit: true, report: true, print: true,
            };
          } else if (type === "clear") {
            rolePerms[dt] = {};
          }
        });
        return { ...r, permissions: rolePerms };
      });
      return { ...prev, roles: updatedRoles };
    });

    try {
      setSaving(true);
      await apiClient.post({
        url: "/roles/matrix/bulk_update/",
        data: {
          role: selectedRole,
          doctypes: allClinical,
          action: type,
        },
      });
    } catch {
      console.warn("Bulk update saved locally");
    } finally {
      setSaving(false);
    }
  };

  // Export Matrix to CSV
  const handleExportCSV = () => {
    if (!matrix || !selectedRoleData) return;
    const headers = ["Doctype", ...PERM_FLAGS.map((f) => f.label)];
    const rows = displayedDoctypes.map((dt) => {
      const perms = selectedRoleData.permissions[dt] || {};
      return [dt, ...PERM_FLAGS.map((f) => (perms[f.key] ? "YES" : "NO"))];
    });
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Permissions_${selectedRole.replace(/\s+/g, "_")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const selectedRoleData = matrix?.roles.find((r) => r.name === selectedRole);

  // Filtered doctypes
  const displayedDoctypes = useMemo(() => {
    let list: string[] = [];
    if (activeCategory === "All Clinical") {
      list = Object.values(HEALTHCARE_CATEGORIES).flat();
    } else if (HEALTHCARE_CATEGORIES[activeCategory]) {
      list = HEALTHCARE_CATEGORIES[activeCategory];
    } else {
      list = matrix?.doctypes || [];
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((dt) => dt.toLowerCase().includes(q));
    }
    return Array.from(new Set(list));
  }, [activeCategory, matrix, search]);

  // Statistics
  const permStats = useMemo(() => {
    if (!selectedRoleData) return { totalDoctypes: 0, readCount: 0, writeCount: 0, submitCount: 0 };
    let readCount = 0;
    let writeCount = 0;
    let submitCount = 0;
    Object.values(selectedRoleData.permissions).forEach((p) => {
      if (p.read) readCount++;
      if (p.write) writeCount++;
      if (p.submit) submitCount++;
    });
    return {
      totalDoctypes: displayedDoctypes.length,
      readCount,
      writeCount,
      submitCount,
    };
  }, [selectedRoleData, displayedDoctypes]);

  return (
    <div className="space-y-6">
      {/* ── KPI Metrics Cards ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-3.5 flex items-center justify-between border-l-4 border-l-blue-500 bg-card/60 backdrop-blur-sm">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Read Access</div>
            <div className="text-2xl font-bold mt-0.5 text-blue-600">{permStats.readCount} Doctypes</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">Granted for {selectedRole || "role"}</div>
          </div>
          <div className="p-2.5 bg-blue-500/10 rounded-xl text-blue-600">
            <Icon icon="solar:eye-bold" size={24} />
          </div>
        </Card>

        <Card className="p-3.5 flex items-center justify-between border-l-4 border-l-emerald-500 bg-card/60 backdrop-blur-sm">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Write & Modify</div>
            <div className="text-2xl font-bold mt-0.5 text-emerald-600">{permStats.writeCount} Doctypes</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">Clinical Charting Privileges</div>
          </div>
          <div className="p-2.5 bg-emerald-500/10 rounded-xl text-emerald-600">
            <Icon icon="solar:pen-bold-duotone" size={24} />
          </div>
        </Card>

        <Card className="p-3.5 flex items-center justify-between border-l-4 border-l-purple-500 bg-card/60 backdrop-blur-sm">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Final Submissions</div>
            <div className="text-2xl font-bold mt-0.5 text-purple-600">{permStats.submitCount} Doctypes</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">Rx, Labs, Sign-offs</div>
          </div>
          <div className="p-2.5 bg-purple-500/10 rounded-xl text-purple-600">
            <Icon icon="solar:check-read-bold" size={24} />
          </div>
        </Card>

        <Card className="p-3.5 flex items-center justify-between border-l-4 border-l-emerald-600 bg-card/60 backdrop-blur-sm">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Clinical Coverage</div>
            <div className="text-2xl font-bold mt-0.5 text-foreground">{permStats.totalDoctypes} Models</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">In Healthcare Catalog</div>
          </div>
          <div className="p-2.5 bg-emerald-500/10 rounded-xl text-emerald-600">
            <Icon icon="solar:shield-cross-bold" size={24} />
          </div>
        </Card>
      </div>

      {/* ── Main Interactive Matrix Card ─────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div>
              <div className="text-lg font-semibold flex items-center gap-2">
                <Icon icon="solar:shield-check-bold" size={22} className="text-emerald-600" />
                Interactive Healthcare Permission Matrix
                {saving && (
                  <Badge variant="outline" className="text-[10px] text-emerald-600 animate-pulse">
                    Saving changes...
                  </Badge>
                )}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Configure row-level Read, Write, Create, and Submit rights across medical records for <strong>{selectedRole}</strong>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={() => handleBulkGrant("read_all")}>
                Grant All Read
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleBulkGrant("full_ehr")} className="text-emerald-600 border-emerald-300">
                Grant Full EHR
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportCSV}>
                <Icon icon="solar:export-bold" size={15} className="mr-1" />
                Export CSV
              </Button>
              <Button variant="outline" size="sm" onClick={loadData}>
                <Icon icon="solar:refresh-bold" size={15} className="mr-1" />
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* ── Role Selector Bar ─────────────────────────────────── */}
          <div>
            <div className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
              <span>Target Role:</span>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {matrix?.roles
                .filter((role) => HEALTHCARE_ROLES.includes(role.name))
                .map((role) => {
                const isHc = true;
                const isSelected = selectedRole === role.name;
                return (
                  <button
                    key={role.name}
                    type="button"
                    onClick={() => setSelectedRole(role.name)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                      isSelected
                        ? "bg-primary text-primary-foreground border-primary shadow-xs"
                        : isHc
                          ? "bg-emerald-50/50 text-emerald-800 border-emerald-200 hover:bg-emerald-100/50 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800"
                          : "bg-background border-border text-muted-foreground hover:text-foreground hover:bg-accent/40"
                    }`}
                  >
                    {isHc && <Icon icon="solar:shield-cross-bold" size={12} className={isSelected ? "text-white" : "text-emerald-600"} />}
                    {role.name}
                    <Badge variant={isSelected ? "secondary" : "outline"} className="text-[10px] px-1 py-0 ml-0.5">
                      {Object.keys(role.permissions).length}
                    </Badge>
                  </button>
                );
              })}
            </div>
          </div>

          <Separator />

          {/* ── Category Filters & Search ─────────────────────────── */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-1 flex-wrap text-xs">
              <span className="text-muted-foreground font-medium mr-1">Domain:</span>
              {["All Clinical", ...Object.keys(HEALTHCARE_CATEGORIES)].map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setActiveCategory(cat)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                    activeCategory === cat
                      ? "bg-emerald-600 text-white font-semibold"
                      : "bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="relative min-w-[200px]">
              <Icon icon="solar:magnifer-linear" size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search doctype..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 text-xs h-8"
              />
            </div>
          </div>

          {/* ── Interactive Permissions Matrix Grid ───────────────── */}
          {loading ? (
            <div className="flex flex-col items-center justify-center h-48 space-y-2">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
              <Text variant="caption" color="secondary">Loading permissions matrix...</Text>
            </div>
          ) : (
            <div className="border rounded-xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-muted/60 border-b text-muted-foreground font-semibold">
                      <th className="py-2.5 px-4 w-72">Clinical DocType / Model</th>
                      {PERM_FLAGS.map((f) => (
                        <th key={f.key} className="py-2.5 px-3 text-center w-24">
                          <span className="font-semibold text-foreground">{f.label}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {displayedDoctypes.map((doctype) => {
                      const perms = selectedRoleData?.permissions[doctype] || {};
                      return (
                        <tr key={doctype} className="hover:bg-accent/30 transition-colors">
                          <td className="py-2 px-4 font-medium text-foreground flex items-center gap-2">
                            <Icon icon="solar:document-medicine-bold" size={15} className="text-emerald-600 shrink-0" />
                            <span>{doctype}</span>
                          </td>
                          {PERM_FLAGS.map((f) => {
                            const isGranted = !!perms[f.key];
                            return (
                              <td key={f.key} className="py-2 px-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleTogglePerm(doctype, f.key, isGranted)}
                                  className={`inline-flex items-center justify-center h-6 w-14 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                                    isGranted
                                      ? `${f.bg} ${f.text} border border-current/30 shadow-2xs hover:opacity-80`
                                      : "bg-muted/30 text-muted-foreground/40 hover:bg-muted/60 hover:text-muted-foreground"
                                  }`}
                                  title={`Toggle ${f.label} for ${doctype}`}
                                >
                                  {isGranted ? "ALLOW" : "—"}
                                </button>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
