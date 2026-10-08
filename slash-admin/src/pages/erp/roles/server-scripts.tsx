import { Icon } from "@/components/icon";
import { Badge } from "@/ui/badge";
import { Button } from "@/ui/button";
import { Card, CardContent, CardHeader } from "@/ui/card";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { Switch } from "@/ui/switch";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/ui/dialog";
import Table, { type ColumnsType } from "antd/es/table";
import { useEffect, useState, useCallback, useRef } from "react";
import {
  ServerScriptApi,
  DocTypeListApi,
  type ServerScript,
  type DocTypeListItem,
} from "@/api/services/erpService";

const SCRIPT_TYPES = [
  { value: "DocType Event", label: "DocType Event", desc: "Runs on document save/validate/submit" },
  { value: "Scheduler Event", label: "Scheduler Event", desc: "Runs on a schedule (hourly, daily, etc.)" },
  { value: "API", label: "API", desc: "Exposed as a REST API endpoint" },
  { value: "Permission Query", label: "Permission Query", desc: "Custom permission logic" },
  { value: "Workflow Task", label: "Workflow Task", desc: "Runs as part of a workflow" },
];

const FREQUENCIES = [
  "All", "Hourly", "Daily", "Weekly", "Monthly", "Yearly",
  "Hourly Long", "Daily Long", "Weekly Long", "Monthly Long", "Cron",
];

const TEMPLATE_SCRIPTS: Record<string, string> = {
  "DocType Event": `# DocType Event Script
# Available variables: doc, doc.before_save, doc.flags
# doc is the current document being saved

def validate(doc):
    """Runs before saving the document."""
    if doc.amount and doc.amount < 0:
        frappe.throw("Amount cannot be negative")

def before_save(doc):
    """Runs before the document is saved."""
    if not doc.status:
        doc.status = "Draft"

def on_update(doc):
    """Runs after the document is updated."""
    frappe.msgprint(f"Document {doc.name} updated successfully")
`,
  "Scheduler Event": `# Scheduler Event Script
# Runs on the configured schedule

def execute():
    """Main function called by the scheduler."""
    # Get all overdue tasks
    overdue = frappe.get_all(
        "Sales Order",
        filters={"status": "Draft", "order_date": ["<", frappe.utils.today()]},
        fields=["name", "customer"]
    )

    for order in overdue:
        frappe.msgprint(f"Order {order.name} for {order.customer} is overdue")
`,
  "API": `# API Script
# Exposed as: /api/method/{script_name}
# Use frappe.get_arg() to get request parameters

def execute(**kwargs):
    """Handle API request."""
    customer_name = kwargs.get("customer_name")

    if not customer_name:
        frappe.throw("customer_name is required")

    customer = frappe.get_doc("Customer", customer_name)
    return {
        "name": customer.name,
        "email": customer.email,
        "phone": customer.phone
    }
`,
  "Permission Query": `# Permission Query Script
# Custom permission logic for a doctype

def get_permission_query_conditions(user):
    """Return SQL conditions for list view."""
    if "Administrator" in frappe.get_roles(user):
        return ""  # Admin sees everything

    return f"(\`owner\` = {frappe.db.escape(user)})"
`,
  "Workflow Task": `# Workflow Task Script
# Runs when a workflow transition occurs

def execute(doc, method):
    """Handle workflow transition."""
    if doc.workflow_state == "Approved":
        # Send notification
        frappe.sendmail(
            recipients=[doc.owner],
            subject=f"Document {doc.name} has been approved",
            message="Your document has been approved and is now active."
        )
`,
};

export default function ServerScriptsPage() {
  const [scripts, setScripts] = useState<ServerScript[]>([]);
  const [doctypes, setDoctypes] = useState<DocTypeListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [showEditor, setShowEditor] = useState(false);
  const [editItem, setEditItem] = useState<ServerScript | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const editorRef = useRef<HTMLTextAreaElement>(null);

  const [form, setForm] = useState({
    name_display: "",
    script_type: "DocType Event",
    reference_doctype: "",
    module: "",
    script: "",
    disabled: false,
    allow_guest: false,
    event_frequency: "Daily",
    cron_format: "",
    api_method: "",
    enable_rate_limit: false,
    rate_limit_count: 5,
    rate_limit_seconds: 86400,
  });

  const loadDropdowns = useCallback(async () => {
    try {
      const doctypesRes = await DocTypeListApi.list({ page_size: 100 });
      setDoctypes(doctypesRes.results || []);
    } catch (err) {
      console.error("Failed to load doctypes:", err);
    }
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = { page };
      if (search) params.search = search;
      if (typeFilter) params.script_type = typeFilter;
      const res = await ServerScriptApi.list(params);
      setScripts(res.results || []);
      setTotal(res.count || 0);
    } catch (err) {
      console.error("Failed to load scripts:", err);
    } finally {
      setLoading(false);
    }
  }, [page, search, typeFilter]);

  useEffect(() => { loadDropdowns(); }, [loadDropdowns]);
  useEffect(() => { loadData(); }, [loadData]);

  const resetForm = () => setForm({
    name_display: "",
    script_type: "DocType Event",
    reference_doctype: "",
    module: "",
    script: TEMPLATE_SCRIPTS["DocType Event"],
    disabled: false,
    allow_guest: false,
    event_frequency: "Daily",
    cron_format: "",
    api_method: "",
    enable_rate_limit: false,
    rate_limit_count: 5,
    rate_limit_seconds: 86400,
  });

  const handleSubmit = async () => {
    if (!form.name_display || !form.script) return;
    try {
      if (editItem) {
        await ServerScriptApi.update(editItem.id, form);
      } else {
        await ServerScriptApi.create(form);
      }
      setShowEditor(false);
      setEditItem(null);
      resetForm();
      loadData();
    } catch (err) {
      console.error("Save failed:", err);
    }
  };

  const handleDelete = async (id: string | number) => {
    if (!window.confirm("Delete this server script?")) return;
    try {
      await ServerScriptApi.delete(id);
      loadData();
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  const openEditor = (item?: ServerScript) => {
    if (item) {
      setForm({
        name_display: item.name_display,
        script_type: item.script_type,
        reference_doctype: item.reference_doctype,
        module: item.module,
        script: item.script,
        disabled: item.disabled,
        allow_guest: item.allow_guest,
        event_frequency: item.event_frequency,
        cron_format: item.cron_format,
        api_method: item.api_method,
        enable_rate_limit: item.enable_rate_limit,
        rate_limit_count: item.rate_limit_count,
        rate_limit_seconds: item.rate_limit_seconds,
      });
      setEditItem(item);
    } else {
      resetForm();
      setEditItem(null);
    }
    setShowEditor(true);
  };

  const applyTemplate = (type: string) => {
    setForm({ ...form, script: TEMPLATE_SCRIPTS[type] || "", script_type: type });
  };

  const handleTab = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const ta = e.currentTarget;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const val = ta.value;
      setForm({ ...form, script: val.substring(0, start) + "    " + val.substring(end) });
      setTimeout(() => {
        ta.selectionStart = ta.selectionEnd = start + 4;
      }, 0);
    }
  };

  const scriptTypeColor = (t: string) => {
    const m: Record<string, string> = {
      "DocType Event": "info",
      "Scheduler Event": "success",
      API: "warning",
      "Permission Query": "outline",
      "Workflow Task": "error",
    };
    return (m[t] || "default") as any;
  };

  const columns: ColumnsType<ServerScript> = [
    {
      title: "Name",
      dataIndex: "name_display",
      width: 220,
      render: (v) => <span className="font-mono text-sm font-medium">{v}</span>,
    },
    {
      title: "Type",
      dataIndex: "script_type",
      width: 140,
      render: (v) => <Badge variant={scriptTypeColor(v)} className="text-xs">{v}</Badge>,
    },
    {
      title: "DocType",
      dataIndex: "reference_doctype",
      width: 140,
      render: (v) => v ? <Badge variant="outline" className="text-xs">{v}</Badge> : <span className="text-text-secondary">-</span>,
    },
    {
      title: "Frequency",
      dataIndex: "event_frequency",
      width: 100,
      render: (v) => v || <span className="text-text-secondary">-</span>,
    },
    {
      title: "API Method",
      dataIndex: "api_method",
      width: 140,
      render: (v) => v ? <span className="font-mono text-xs">{v}</span> : <span className="text-text-secondary">-</span>,
    },
    {
      title: "Status",
      key: "status",
      width: 120,
      render: (_, record) => (
        <div className="flex gap-1">                  {record.disabled ? (
                    <Badge variant="error" className="text-xs">Disabled</Badge>
                  ) : (
                    <Badge variant="info" className="text-xs">Active</Badge>
                  )}
          {record.allow_guest && (
            <Badge variant="warning" className="text-xs">Guest</Badge>
          )}
        </div>
      ),
    },
  ];

  const lineCount = form.script.split("\n").length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon icon="mdi:code-braces" size={22} className="text-primary" />
            <span className="text-lg font-semibold">Server Scripts</span>
            <Badge variant="outline">{total}</Badge>
          </div>
          <div className="flex items-center gap-2">
            <select
              className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
              value={typeFilter}
              onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
            >
              <option value="">All Types</option>
              {SCRIPT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <Input
              placeholder="Search scripts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (setPage(1), loadData())}
              className="w-48"
            />
            <Button onClick={() => openEditor()}>
              <Icon icon="mdi:plus" size={18} className="mr-1" /> New Script
            </Button>
          </div>
        </div>
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
              width: 120,
              render: (_, record) => (
                <div className="flex w-full justify-center gap-1">
                  <Button variant="ghost" size="icon" onClick={() => openEditor(record)} title="Edit">
                    <Icon icon="solar:pen-bold-duotone" size={18} />
                  </Button>
                  <Button variant="ghost" size="icon" title="Execute">
                    <Icon icon="mdi:play-circle-outline" size={18} className="text-info" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(record.id)}>
                    <Icon icon="mingcute:delete-2-fill" size={18} className="text-error!" />
                  </Button>
                </div>
              ),
            },
          ]}
          dataSource={scripts}
          loading={loading}
          pagination={{ current: page, total, pageSize: 20, showSizeChanger: false, onChange: (p) => setPage(p) }}
        />
      </CardContent>

      {/* Script Editor Dialog */}
      <Dialog open={showEditor} onOpenChange={setShowEditor}>
        <DialogContent className="max-w-5xl max-h-[95vh] overflow-y-auto p-0">
          <DialogHeader className="px-6 pt-6 pb-2">
            <div className="flex items-center justify-between">
              <DialogTitle>{editItem ? "Edit Server Script" : "New Server Script"}</DialogTitle>
              <Button variant="ghost" size="sm" onClick={() => setShowHelp(!showHelp)}>
                <Icon icon="mdi:help-circle-outline" size={16} className="mr-1" /> Help
              </Button>
            </div>
          </DialogHeader>

          {/* Help Panel */}
          {showHelp && (
            <div className="mx-6 rounded-md bg-muted/50 p-4 text-xs text-text-secondary space-y-2">
              <div className="font-semibold text-sm">Frappe Server Script Reference</div>
              <div><strong>Available objects:</strong> <code>frappe</code>, <code>doc</code>, <code>user</code></div>
              <div><strong>frappe.get_doc(doctype, name)</strong> - Get a document</div>
              <div><strong>frappe.get_list(doctype, filters, fields)</strong> - List documents</div>
              <div><strong>frappe.throw(msg)</strong> - Throw an error</div>
              <div><strong>frappe.msgprint(msg)</strong> - Show a message</div>
              <div><strong>frappe.sendmail(recipients, subject, message)</strong> - Send email</div>
              <div><strong>frappe.db.get_value(doctype, name, field)</strong> - Get field value</div>
              <div><strong>frappe.utils.today()</strong> - Current date</div>
              <div><strong>frappe.utils.now()</strong> - Current datetime</div>
            </div>
          )}

          <div className="px-6 pb-6 space-y-4">
            {/* Script Settings */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs">Script Name *</Label>
                <Input
                  value={form.name_display}
                  onChange={(e) => setForm({ ...form, name_display: e.target.value })}
                  placeholder="e.g. validate_sales_order"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Script Type *</Label>
                <select
                  className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                  value={form.script_type}
                  onChange={(e) => {
                    const t = e.target.value;
                    setForm({ ...form, script_type: t, script: form.script || TEMPLATE_SCRIPTS[t] || "" });
                  }}
                >
                  {SCRIPT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              {form.script_type === "DocType Event" && (
                <div className="space-y-1">
                  <Label className="text-xs">Reference DocType</Label>
                  <select
                    className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                    value={form.reference_doctype}
                    onChange={(e) => setForm({ ...form, reference_doctype: e.target.value })}
                  >
                    <option value="">Select doctype...</option>
                    {doctypes.map((dt) => (
                      <option key={dt.id} value={dt.name}>{dt.name}</option>
                    ))}
                  </select>
                </div>
              )}
              {form.script_type === "Scheduler Event" && (
                <div className="space-y-1">
                  <Label className="text-xs">Frequency</Label>
                  <select
                    className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                    value={form.event_frequency}
                    onChange={(e) => setForm({ ...form, event_frequency: e.target.value })}
                  >
                    {FREQUENCIES.map((f) => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                </div>
              )}
              {form.script_type === "API" && (
                <div className="space-y-1">
                  <Label className="text-xs">API Method Name</Label>
                  <Input
                    value={form.api_method}
                    onChange={(e) => setForm({ ...form, api_method: e.target.value })}
                    placeholder="e.g. get_customer_data"
                  />
                </div>
              )}
              <div className="space-y-1">
                <Label className="text-xs">Module</Label>
                <Input
                  value={form.module}
                  onChange={(e) => setForm({ ...form, module: e.target.value })}
                  placeholder="e.g. Healthcare"
                />
              </div>
              <div className="flex items-center gap-4 pt-5">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={!form.disabled}
                    onCheckedChange={(v) => setForm({ ...form, disabled: !v })}
                  />
                  <span className="text-xs">{form.disabled ? "Disabled" : "Enabled"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={form.allow_guest}
                    onCheckedChange={(v) => setForm({ ...form, allow_guest: v })}
                  />
                  <span className="text-xs">Guest Access</span>
                </div>
              </div>
            </div>

            {/* Template Buttons */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-text-secondary">Templates:</span>
              {SCRIPT_TYPES.map((t) => (
                <Button
                  key={t.value}
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => applyTemplate(t.value)}
                >
                  {t.label}
                </Button>
              ))}
            </div>

            {/* Code Editor */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Script Code *</Label>
                <div className="flex items-center gap-3 text-xs text-text-secondary">
                  <span>Lines: {lineCount}</span>
                  <span>Chars: {form.script.length}</span>
                </div>
              </div>
              <div className="relative rounded-md border bg-[#1e1e1e] overflow-hidden">
                <div className="flex items-center gap-2 border-b border-gray-700 bg-[#2d2d2d] px-3 py-1.5">
                  <Icon icon="mdi:language-python" size={14} className="text-yellow-400" />
                  <span className="text-xs text-gray-400">Python</span>
                  <div className="ml-auto flex items-center gap-1">
                    <div className="h-2 w-2 rounded-full bg-red-500" />
                    <div className="h-2 w-2 rounded-full bg-yellow-500" />
                    <div className="h-2 w-2 rounded-full bg-green-500" />
                  </div>
                </div>
                <div className="flex max-h-[400px] overflow-auto">
                  {/* Line Numbers */}
                  <div className="select-none bg-[#252526] py-3 pl-3 pr-2 text-right">
                    {Array.from({ length: Math.max(lineCount, 20) }, (_, i) => (
                      <div key={i} className="font-mono text-xs leading-5 text-gray-500">
                        {i + 1}
                      </div>
                    ))}
                  </div>
                  {/* Code Area */}
                  <textarea
                    ref={editorRef}
                    value={form.script}
                    onChange={(e) => setForm({ ...form, script: e.target.value })}
                    onKeyDown={handleTab}
                    className="w-full resize-none bg-[#1e1e1e] p-3 font-mono text-sm leading-5 text-gray-200 outline-none"
                    style={{ tabSize: 4 }}
                    spellCheck={false}
                    placeholder="# Write your Python script here..."
                  />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between border-t pt-4">
              <div className="text-xs text-text-secondary">
                {editItem ? `Last modified: ${new Date(editItem.modified).toLocaleString()}` : "New script"}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowEditor(false)}>Cancel</Button>
                <Button onClick={handleSubmit} disabled={!form.name_display || !form.script}>
                  {editItem ? "Update" : "Create"}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
