import { Icon } from "@/components/icon";
import { Badge } from "@/ui/badge";
import { Button } from "@/ui/button";
import { Card, CardContent, CardHeader } from "@/ui/card";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { Separator } from "@/ui/separator";
import {
  PermissionInspectorApi,
  UserListApi,
  DocTypeListApi,
  type PermissionInspectorResult,
  type UserListItem,
  type DocTypeListItem,
} from "@/api/services/erpService";
import { useEffect, useState, useCallback } from "react";

const PERM_COLORS: Record<string, string> = {
  select: "bg-slate-100 text-slate-700 border-slate-200",
  read: "bg-blue-100 text-blue-700 border-blue-200",
  write: "bg-green-100 text-green-700 border-green-200",
  create: "bg-emerald-100 text-emerald-700 border-emerald-200",
  delete: "bg-red-100 text-red-700 border-red-200",
  submit: "bg-purple-100 text-purple-700 border-purple-200",
  cancel: "bg-orange-100 text-orange-700 border-orange-200",
  amend: "bg-yellow-100 text-yellow-700 border-yellow-200",
  report: "bg-cyan-100 text-cyan-700 border-cyan-200",
  export: "bg-teal-100 text-teal-700 border-teal-200",
  import: "bg-indigo-100 text-indigo-700 border-indigo-200",
  print: "bg-pink-100 text-pink-700 border-pink-200",
  email: "bg-violet-100 text-violet-700 border-violet-200",
  share: "bg-amber-100 text-amber-700 border-amber-200",
};

const ALL_PERM_FLAGS = [
  "select", "read", "write", "create", "delete",
  "submit", "cancel", "amend", "report", "export",
  "import", "print", "email", "share",
];

export default function PermissionInspectorPage() {
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [doctypes, setDoctypes] = useState<DocTypeListItem[]>([]);
  const [selectedUser, setSelectedUser] = useState("");
  const [selectedDoctype, setSelectedDoctype] = useState("");
  const [selectedPerm, setSelectedPerm] = useState("read");
  const [docname, setDocname] = useState("");
  const [result, setResult] = useState<PermissionInspectorResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Load users and doctypes for dropdowns
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

  useEffect(() => {
    loadDropdowns();
  }, [loadDropdowns]);

  const handleInspect = async () => {
    if (!selectedUser || !selectedDoctype) {
      setError("Please select a user and a doctype.");
      return;
    }
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await PermissionInspectorApi.inspect({
        user: selectedUser,
        ref_doctype: selectedDoctype,
        permission_type: selectedPerm,
        docname: docname || undefined,
      });
      setResult(res);
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.message || "Inspection failed";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // Group doctype_permissions by role
  const permsByRole: Record<string, PermissionInspectorResult["doctype_permissions"]> = {};
  if (result?.doctype_permissions) {
    for (const dp of result.doctype_permissions) {
      if (!permsByRole[dp.role]) permsByRole[dp.role] = [];
      permsByRole[dp.role].push(dp);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Icon icon="mdi:magnify-scan" size={22} className="text-primary" />
          <span className="text-lg font-semibold">Permission Inspector</span>
        </div>
        <p className="text-sm text-text-secondary">
          Debug why a user can or cannot access a specific doctype. Select a user, doctype, and permission type to inspect.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Inspector Form */}
        <div className="rounded-lg border bg-muted/30 p-4">
          <div className="grid grid-cols-2 gap-4">
            {/* User Selector */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">User *</Label>
              <select
                className="h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                value={selectedUser}
                onChange={(e) => setSelectedUser(e.target.value)}
              >
                <option value="">Select a user...</option>
                {users.map((u) => (
                  <option key={u.id} value={u.username}>
                    {u.username} ({u.first_name} {u.last_name}){u.is_staff ? " [Admin]" : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Doctype Selector */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">DocType *</Label>
              <select
                className="h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                value={selectedDoctype}
                onChange={(e) => setSelectedDoctype(e.target.value)}
              >
                <option value="">Select a doctype...</option>
                {doctypes.map((dt) => (
                  <option key={dt.id} value={dt.name}>
                    {dt.name} {dt.module ? `(${dt.module})` : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Permission Type */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Permission Type</Label>
              <select
                className="h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                value={selectedPerm}
                onChange={(e) => setSelectedPerm(e.target.value)}
              >
                {ALL_PERM_FLAGS.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>

            {/* Document Name (optional) */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Document Name (optional)</Label>
              <Input
                value={docname}
                onChange={(e) => setDocname(e.target.value)}
                placeholder="e.g. CUST-00001 (for if_owner checks)"
              />
            </div>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <Button onClick={handleInspect} disabled={loading || !selectedUser || !selectedDoctype}>
              {loading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent mr-2" />
              ) : (
                <Icon icon="mdi:magnify-scan" size={18} className="mr-1" />
              )}
              Inspect Permissions
            </Button>
            {error && <span className="text-sm text-error">{error}</span>}
          </div>
        </div>

        {/* Results */}
        {result && (
          <div className="space-y-4">
            {/* Permission Result Banner */}
            <div
              className={`flex items-center gap-3 rounded-lg border-2 p-4 ${
                result.result
                  ? "border-success/30 bg-success/5"
                  : "border-error/30 bg-error/5"
              }`}
            >
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-full ${
                  result.result ? "bg-success/10" : "bg-error/10"
                }`}
              >
                <Icon
                  icon={result.result ? "mdi:check-circle" : "mdi:close-circle"}
                  size={28}
                  className={result.result ? "text-success" : "text-error"}
                />
              </div>
              <div>
                <div className="text-lg font-semibold">
                  {result.user} → {result.ref_doctype}:{result.permission_type} ={" "}
                  <span className={result.result ? "text-success" : "text-error"}>
                    {result.result ? "GRANTED" : "DENIED"}
                  </span>
                </div>
                <div className="text-sm text-text-secondary">
                  {result.docname ? `Document: ${result.docname}` : "List-level check (no specific document)"}
                </div>
              </div>
            </div>

            <Separator />

            {/* User Roles */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Icon icon="mdi:shield-account-outline" size={18} className="text-primary" />
                <span className="text-sm font-semibold">User Roles ({result.user_roles.length})</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {result.user_roles.length === 0 ? (
                  <span className="text-sm text-text-secondary italic">No roles assigned</span>
                ) : (
                  result.user_roles.map((role) => (
                    <Badge key={role} variant="outline" className="text-xs">
                      {role}
                    </Badge>
                  ))
                )}
              </div>
            </div>

            <Separator />

            {/* DocType Permission Matrix */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Icon icon="mdi:table-large" size={18} className="text-primary" />
                <span className="text-sm font-semibold">
                  {result.ref_doctype} Permissions ({result.doctype_permissions.length} role entries)
                </span>
              </div>

              {result.doctype_permissions.length === 0 ? (
                <div className="rounded-md bg-muted/50 p-4 text-center text-sm text-text-secondary">
                  No DocPerm entries found for this doctype. Permissions may need to be seeded.
                </div>
              ) : (
                <div className="space-y-3">
                  {Object.entries(permsByRole).map(([role, perms]) => (
                    <div key={role} className="rounded-md border p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline" className="text-xs font-semibold">
                          {role}
                        </Badge>
                        {perms.some((p) => p.if_owner) && (
                          <Badge variant="warning" className="text-xs">
                            <Icon icon="mdi:account-outline" size={10} className="mr-0.5" />
                            if_owner
                          </Badge>
                        )}
                        <span className="text-xs text-text-secondary">
                          permlevel: {perms[0]?.permlevel}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {ALL_PERM_FLAGS.map((flag) => {
                          const hasFlag = perms.some((p) =>
                            p.active_permissions.includes(flag)
                          );
                          return (
                            <span
                              key={flag}
                              className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-medium ${
                                hasFlag
                                  ? PERM_COLORS[flag] || "bg-gray-100 text-gray-700 border-gray-200"
                                  : "bg-gray-50 text-gray-300 border-gray-100 line-through"
                              }`}
                            >
                              {hasFlag && <Icon icon="mdi:check" size={10} className="mr-0.5" />}
                              {flag}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Debug Info */}
            <div className="rounded-md bg-muted/30 p-3">
              <div className="text-xs font-semibold text-text-secondary mb-1">Debug Info</div>
              <pre className="text-xs text-text-secondary overflow-x-auto">
                {JSON.stringify(
                  {
                    user: result.user,
                    doctype: result.ref_doctype,
                    permission_checked: result.permission_type,
                    has_permission: result.result,
                    roles_count: result.user_roles.length,
                    doctype_perms_count: result.doctype_permissions.length,
                  },
                  null,
                  2
                )}
              </pre>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
