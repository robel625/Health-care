import { Icon } from "@/components/icon";
import { Badge } from "@/ui/badge";
import { Button } from "@/ui/button";
import { Card, CardContent, CardHeader } from "@/ui/card";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { Switch } from "@/ui/switch";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/ui/dialog";
import Table, { type ColumnsType } from "antd/es/table";
import { useEffect, useState, useCallback } from "react";
import apiClient from "@/api/apiClient";

// ── Types ────────────────────────────────────────────────────────
interface NamingRule {
  id: string;
  document_type: string;
  prefix: string;
  prefix_digits: number;
  counter: number;
  disabled: boolean;
  priority: number;
  conditions: Array<{ field: string; operator: string; value: string }>;
  owner: string;
  creation: string;
  modified: string;
}

// ── API ──────────────────────────────────────────────────────────
const NamingRuleApi = {
  list: (params?: Record<string, any>) =>
    apiClient.get<{ results: NamingRule[]; count: number }>({ url: "/roles/naming-rules/", params }),
  get: (id: string) => apiClient.get<NamingRule>({ url: `/roles/naming-rules/${id}/` }),
  create: (data: Partial<NamingRule>) =>
    apiClient.post<NamingRule>({ url: "/roles/naming-rules/", data }),
  update: (id: string, data: Partial<NamingRule>) =>
    apiClient.put<NamingRule>({ url: `/roles/naming-rules/${id}/`, data }),
  delete: (id: string) => apiClient.delete({ url: `/roles/naming-rules/${id}/` }),
};

const MODULES: Record<string, string[]> = {
  Healthcare: ["Patient", "Healthcare Practitioner", "Patient Appointment", "Vital Signs", "Patient Encounter", "Drug Prescription", "Medication Request", "Lab Test", "Clinical Procedure", "Observation", "Therapy Plan", "Therapy Session", "Inpatient Record", "Emergency Record", "Insurance Claim", "Service Request", "Medication", "Pharmacy Warehouse", "Pharmacy Stock Entry"],
  Setup: ["Company"],
};

const OPERATORS = ["=", "!=", "is set", "not set"];

export default function NamingRulesPage() {
  const [rules, setRules] = useState<NamingRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<NamingRule | null>(null);

  const [form, setForm] = useState({
    document_type: "",
    prefix: "",
    prefix_digits: 6,
    disabled: false,
    priority: 0,
    conditions: [] as Array<{ field: string; operator: string; value: string }>,
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = { page };
      if (search) params.search = search;
      const res = await NamingRuleApi.list(params);
      setRules(res.results || []);
      setTotal(res.count || 0);
    } catch (err) {
      console.error("Failed to load naming rules:", err);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { loadData(); }, [loadData]);

  const resetForm = () => setForm({
    document_type: "",
    prefix: "",
    prefix_digits: 6,
    disabled: false,
    priority: 0,
    conditions: [],
  });

  const handleSubmit = async () => {
    if (!form.document_type) return;
    try {
      if (editItem) {
        await NamingRuleApi.update(editItem.id, form);
      } else {
        await NamingRuleApi.create(form);
      }
      setShowForm(false);
      setEditItem(null);
      resetForm();
      loadData();
    } catch (err) {
      console.error("Save failed:", err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this naming rule?")) return;
    try {
      await NamingRuleApi.delete(id);
      loadData();
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  const openEdit = (item: NamingRule) => {
    setForm({
      document_type: item.document_type,
      prefix: item.prefix,
      prefix_digits: item.prefix_digits,
      disabled: item.disabled,
      priority: item.priority,
      conditions: item.conditions || [],
    });
    setEditItem(item);
    setShowForm(true);
  };

  const addCondition = () => {
    setForm({
      ...form,
      conditions: [...form.conditions, { field: "", operator: "=", value: "" }],
    });
  };

  const removeCondition = (idx: number) => {
    setForm({
      ...form,
      conditions: form.conditions.filter((_, i) => i !== idx),
    });
  };

  const updateCondition = (idx: number, key: string, value: string) => {
    const updated = [...form.conditions];
    updated[idx] = { ...updated[idx], [key]: value };
    setForm({ ...form, conditions: updated });
  };

  // Generate preview of what the next number would look like
  const generatePreview = (rule: NamingRule) => {
    const next = rule.counter + 1;
    const padded = String(next).padStart(rule.prefix_digits, "0");
    return `${rule.prefix}${padded}`;
  };

  const columns: ColumnsType<NamingRule> = [
    {
      title: "DocType",
      dataIndex: "document_type",
      width: 160,
      render: (v) => <Badge variant="info" className="text-xs">{v}</Badge>,
    },
    {
      title: "Prefix",
      dataIndex: "prefix",
      width: 120,
      render: (v) => v ? <span className="font-mono text-sm">{v}</span> : <span className="text-text-secondary">(none)</span>,
    },
    {
      title: "Digits",
      dataIndex: "prefix_digits",
      width: 70,
      align: "center",
      render: (v) => <span className="font-mono text-xs">{v}</span>,
    },
    {
      title: "Counter",
      dataIndex: "counter",
      width: 80,
      align: "center",
      render: (v) => <span className="font-mono text-xs font-semibold">{v}</span>,
    },
    {
      title: "Next Value",
      key: "next",
      width: 140,
      render: (_, record) => (
        <span className="font-mono text-xs font-bold text-primary">{generatePreview(record)}</span>
      ),
    },
    {
      title: "Priority",
      dataIndex: "priority",
      width: 80,
      align: "center",
      render: (v) => <Badge variant="outline" className="text-xs">{v}</Badge>,
    },
    {
      title: "Conditions",
      dataIndex: "conditions",
      width: 100,
      align: "center",
      render: (v) => v && v.length > 0 ? (
        <Badge variant="warning" className="text-xs">{v.length} rules</Badge>
      ) : (
        <span className="text-text-secondary text-xs">-</span>
      ),
    },
    {
      title: "Status",
      dataIndex: "disabled",
      width: 80,
      align: "center",
      render: (disabled) => disabled ? (
        <Badge variant="error" className="text-xs">Disabled</Badge>
      ) : (
        <Badge variant="success" className="text-xs">Active</Badge>
      ),
    },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon icon="mdi:format-list-numbered" size={22} className="text-primary" />
            <span className="text-lg font-semibold">Document Naming Rules</span>
            <Badge variant="outline">{total}</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Input
              placeholder="Search rules..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (setPage(1), loadData())}
              className="w-48"
            />
            <Button onClick={() => { resetForm(); setEditItem(null); setShowForm(true); }}>
              <Icon icon="mdi:plus" size={18} className="mr-1" /> New Rule
            </Button>
          </div>
        </div>
        <p className="text-sm text-text-secondary">
          Configure auto-numbering sequences for documents. Each rule defines a prefix, digit count, and optional conditions.
        </p>
      </CardHeader>
      <CardContent>
        <Table
          rowKey="id"
          size="small"
          scroll={{ x: "max-content" }}
          columns={[
            ...columns,
            {
              title: "Action",
              key: "action",
              align: "center",
              width: 100,
              render: (_, record) => (
                <div className="flex w-full justify-center gap-1">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(record)}>
                    <Icon icon="solar:pen-bold-duotone" size={18} />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(record.id)}>
                    <Icon icon="mingcute:delete-2-fill" size={18} className="text-error!" />
                  </Button>
                </div>
              ),
            },
          ]}
          dataSource={rules}
          loading={loading}
          pagination={{ current: page, total, pageSize: 20, showSizeChanger: false, onChange: (p) => setPage(p) }}
        />
      </CardContent>

      {/* Create/Edit Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editItem ? "Edit Naming Rule" : "New Naming Rule"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {/* DocType */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">DocType *</Label>
              <select
                className="col-span-3 h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                value={form.document_type}
                onChange={(e) => setForm({ ...form, document_type: e.target.value })}
              >
                <option value="">Select doctype...</option>
                {Object.entries(MODULES).map(([module, dtypes]) => (
                  <optgroup key={module} label={module}>
                    {dtypes.map((dt) => (
                      <option key={dt} value={dt}>{dt}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            {/* Prefix */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Prefix</Label>
              <Input
                className="col-span-3"
                value={form.prefix}
                onChange={(e) => setForm({ ...form, prefix: e.target.value })}
                placeholder="e.g. CUST-, SO-, INV-"
              />
            </div>

            {/* Digits & Priority */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Zero-Padded Digits</Label>
              <div className="col-span-3 flex items-center gap-4">
                <Input
                  type="number"
                  className="w-24"
                  value={form.prefix_digits}
                  onChange={(e) => setForm({ ...form, prefix_digits: Number(e.target.value) })}
                  min={1}
                  max={10}
                />
                <Label className="text-right w-16">Priority</Label>
                <Input
                  type="number"
                  className="w-24"
                  value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })}
                />
              </div>
            </div>

            {/* Disabled */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Disabled</Label>
              <div className="col-span-3 flex items-center gap-2">
                <Switch
                  checked={form.disabled}
                  onCheckedChange={(v) => setForm({ ...form, disabled: v })}
                />
                <span className="text-xs text-text-secondary">Disable this naming rule</span>
              </div>
            </div>

            {/* Preview */}
            {form.document_type && (
              <div className="rounded-md bg-muted/50 p-3">
                <div className="text-xs font-semibold mb-1">Preview</div>
                <div className="font-mono text-sm text-primary font-bold">
                  {form.prefix || ""}{"0".repeat(Math.max(0, form.prefix_digits - 1))}1
                </div>
                <div className="text-xs text-text-secondary mt-1">
                  Next generated name will be: <strong className="text-primary">{form.prefix || ""}{String((editItem?.counter || 0) + 1).padStart(form.prefix_digits, "0")}</strong>
                </div>
              </div>
            )}

            {/* Conditions */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Conditions (optional)</Label>
                <Button variant="outline" size="sm" onClick={addCondition}>
                  <Icon icon="mdi:plus" size={14} className="mr-1" /> Add Condition
                </Button>
              </div>
              {form.conditions.length === 0 && (
                <div className="text-xs text-text-secondary italic">No conditions - this rule applies to all documents</div>
              )}
              {form.conditions.map((cond, idx) => (
                <div key={idx} className="flex items-center gap-2 rounded-md border p-2">
                  <Input
                    className="flex-1"
                    value={cond.field}
                    onChange={(e) => updateCondition(idx, "field", e.target.value)}
                    placeholder="Field name"
                  />
                  <select
                    className="h-8 rounded-md border border-input bg-transparent px-2 text-xs"
                    value={cond.operator}
                    onChange={(e) => updateCondition(idx, "operator", e.target.value)}
                  >
                    {OPERATORS.map((op) => (
                      <option key={op} value={op}>{op}</option>
                    ))}
                  </select>
                  <Input
                    className="flex-1"
                    value={cond.value}
                    onChange={(e) => updateCondition(idx, "value", e.target.value)}
                    placeholder="Value"
                  />
                  <Button variant="ghost" size="icon" onClick={() => removeCondition(idx)}>
                    <Icon icon="mdi:close" size={14} className="text-error" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {/* Info Box */}
          <div className="mx-6 rounded-md bg-muted/50 p-3 text-xs text-text-secondary space-y-1">
            <div className="font-semibold text-sm mb-1">How Document Naming Works</div>
            <div><strong>Prefix</strong> = Text before the number (e.g., "SO-" for Sales Orders)</div>
            <div><strong>Digits</strong> = Minimum number of digits, zero-padded (e.g., 6 → 000001)</div>
            <div><strong>Counter</strong> = Auto-increments each time a document is created</div>
            <div><strong>Priority</strong> = Higher priority rules are checked first</div>
            <div><strong>Conditions</strong> = Only apply this rule when field values match</div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 px-6 pb-6">
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={!form.document_type}>
              {editItem ? "Update" : "Create"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
