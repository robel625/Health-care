import { Icon } from "@/components/icon";
import { Badge } from "@/ui/badge";
import { Button } from "@/ui/button";
import { Card, CardContent, CardHeader } from "@/ui/card";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { Switch } from "@/ui/switch";
import { Textarea } from "@/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/ui/dialog";
import Table, { type ColumnsType } from "antd/es/table";
import { useEffect, useState, useCallback } from "react";
import apiClient from "@/api/apiClient";

// ── Types ────────────────────────────────────────────────────────
interface EmailTemplate {
  id: string;
  name_template: string;
  subject: string;
  reference_doctype: string;
  use_html: boolean;
  response_html: string;
  response: string;
  response_: string;
  category: string;
  enabled: boolean;
  description: string;
  owner: string;
  creation: string;
  modified: string;
}

// ── API ──────────────────────────────────────────────────────────
const EmailTemplateApi = {
  list: (params?: Record<string, any>) =>
    apiClient.get({ url: "/roles/email-templates/", params }),
  get: (id: string) =>
    apiClient.get({ url: `/roles/email-templates/${id}/` }),
  create: (data: Record<string, any>) =>
    apiClient.post({ url: "/roles/email-templates/", data }),
  update: (id: string, data: Record<string, any>) =>
    apiClient.put({ url: `/roles/email-templates/${id}/`, data }),
  delete: (id: string) =>
    apiClient.delete({ url: `/roles/email-templates/${id}/` }),
  preview: (id: string) =>
    apiClient.post({ url: `/roles/email-templates/${id}/preview/` }),
};

// ── Constants ────────────────────────────────────────────────────
const CATEGORIES = [
  { value: "Workflow", label: "Workflow", icon: "mdi:git-branch", color: "text-purple-600" },
  { value: "Notification", label: "Notification", icon: "mdi:bell-outline", color: "text-blue-600" },
  { value: "System", label: "System", icon: "mdi:cog-outline", color: "text-amber-600" },
  { value: "Onboarding", label: "Onboarding", icon: "mdi:account-plus-outline", color: "text-green-600" },
  { value: "Custom", label: "Custom", icon: "mdi:code-braces", color: "text-gray-600" },
];

const CATEGORY_BADGE: Record<string, string> = {
  Workflow: "info",
  Notification: "warning",
  System: "error",
  Onboarding: "success",
  Custom: "default",
};

const DOC_TYPES = [
  "Customer", "Supplier", "Quotation", "Sales Order", "Sales Invoice",
  "Purchase Order", "Purchase Invoice", "Item", "Warehouse",
  "Journal Entry", "Payment Entry", "Error Log", "Employee",
];

const SAMPLE_VARIABLES = [
  { var: "{{ doc.name }}", desc: "Document name/ID" },
  { var: "{{ doc.customer }}", desc: "Customer name" },
  { var: "{{ doc.supplier }}", desc: "Supplier name" },
  { var: "{{ doc.grand_total }}", desc: "Grand total amount" },
  { var: "{{ doc.status }}", desc: "Document status" },
  { var: "{{ doc.due_date }}", desc: "Due date" },
  { var: "{{ user.full_name }}", desc: "User's full name" },
  { var: "{{ user.email }}", desc: "User's email" },
  { var: "{{ doc.owner }}", desc: "Document owner" },
  { var: "{{ doc.creation }}", desc: "Document creation date" },
];

const DEFAULT_FORM = {
  name_template: "",
  subject: "",
  reference_doctype: "",
  use_html: true,
  response_html: "",
  response: "",
  category: "Custom" as string,
  enabled: true,
  description: "",
};

// ── Main Component ───────────────────────────────────────────────
export default function EmailTemplatesPage() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState<EmailTemplate | null>(null);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [preview, setPreview] = useState<{ subject: string; message: string } | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [showVarHelp, setShowVarHelp] = useState(false);

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = { page, page_size: 15 };
      if (search) params.search = search;
      if (filterCategory !== "all") params.category = filterCategory;
      const res: any = await EmailTemplateApi.list(params);
      setTemplates(res.data?.results || res.data || res.results || res || []);
      setTotal(res.data?.count || res.count || 0);
    } catch (err) {
      console.error("Failed to load templates:", err);
    } finally {
      setLoading(false);
    }
  }, [page, search, filterCategory]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const openCreate = () => {
    setEditing(null);
    setForm(DEFAULT_FORM);
    setShowDialog(true);
  };

  const openEdit = (tpl: EmailTemplate) => {
    setEditing(tpl);
    setForm({
      name_template: tpl.name_template,
      subject: tpl.subject,
      reference_doctype: tpl.reference_doctype || "",
      use_html: tpl.use_html,
      response_html: tpl.response_html || "",
      response: tpl.response || "",
      category: tpl.category,
      enabled: tpl.enabled,
      description: tpl.description || "",
    });
    setShowDialog(true);
  };

  const handleSave = async () => {
    try {
      const payload: Record<string, any> = {
        name_template: form.name_template,
        subject: form.subject,
        reference_doctype: form.reference_doctype,
        use_html: form.use_html,
        response_html: form.response_html,
        response: form.response,
        category: form.category,
        enabled: form.enabled,
        description: form.description,
      };

      if (editing) {
        await EmailTemplateApi.update(editing.id, payload);
      } else {
        await EmailTemplateApi.create(payload);
      }
      setShowDialog(false);
      loadTemplates();
    } catch (err) {
      console.error("Failed to save template:", err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this email template?")) return;
    try {
      await EmailTemplateApi.delete(id);
      loadTemplates();
    } catch (err) {
      console.error("Failed to delete:", err);
    }
  };

  const handlePreview = async (tpl: EmailTemplate) => {
    setPreviewLoading(true);
    setShowPreview(true);
    try {
      const res: any = await EmailTemplateApi.preview(tpl.id);
      setPreview(res.data || res);
    } catch {
      setPreview({ subject: tpl.subject, message: tpl.response_ || tpl.response_html || tpl.response });
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleToggleEnabled = async (tpl: EmailTemplate) => {
    try {
      await EmailTemplateApi.update(tpl.id, { enabled: !tpl.enabled });
      loadTemplates();
    } catch (err) {
      console.error("Failed to toggle:", err);
    }
  };

  // Category stats
  const categoryStats = CATEGORIES.map((c) => ({
    ...c,
    count: templates.filter((t) => t.category === c.value).length,
  }));

  const columns: ColumnsType<EmailTemplate> = [
    {
      title: "Template",
      dataIndex: "name_template",
      width: 260,
      render: (v, r) => (
        <div>
          <button
            className="text-sm font-medium text-primary hover:underline text-left"
            onClick={() => openEdit(r)}
          >
            {v}
          </button>
          {r.description && (
            <div className="text-xs text-text-secondary line-clamp-1 mt-0.5">
              {r.description}
            </div>
          )}
        </div>
      ),
    },
    {
      title: "Subject",
      dataIndex: "subject",
      width: 280,
      render: (v) => (
        <span className="text-xs text-text-secondary line-clamp-1 font-mono">
          {v}
        </span>
      ),
    },
    {
      title: "Category",
      dataIndex: "category",
      width: 110,
      render: (v) => (
        <Badge
          variant={(CATEGORY_BADGE[v] as any) || "default"}
          className="text-xs"
        >
          {v}
        </Badge>
      ),
    },
    {
      title: "DocType",
      dataIndex: "reference_doctype",
      width: 120,
      render: (v) =>
        v ? (
          <Badge variant="info" className="text-xs">
            {v}
          </Badge>
        ) : (
          <span className="text-xs text-text-secondary">-</span>
        ),
    },
    {
      title: "Format",
      dataIndex: "use_html",
      width: 80,
      render: (v) => (
        <Badge variant={v ? "success" : "default"} className="text-xs">
          {v ? "HTML" : "Text"}
        </Badge>
      ),
    },
    {
      title: "Enabled",
      dataIndex: "enabled",
      width: 80,
      render: (v, r) => (
        <button onClick={() => handleToggleEnabled(r)}>
          <Badge
            variant={v ? "success" : "default"}
            className="text-xs cursor-pointer hover:opacity-80"
          >
            {v ? "Active" : "Off"}
          </Badge>
        </button>
      ),
    },
    {
      title: "Actions",
      width: 120,
      render: (_, r) => (
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => handlePreview(r)}
          >
            <Icon icon="mdi:eye-outline" size={14} />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => openEdit(r)}
          >
            <Icon icon="mdi:pencil-outline" size={14} />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs text-destructive"
            onClick={() => handleDelete(r.id)}
          >
            <Icon icon="mdi:delete-outline" size={14} />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon
              icon="mdi:email-edit-outline"
              size={22}
              className="text-primary"
            />
            <span className="text-lg font-semibold">Email Templates</span>
          </div>
          <Button onClick={openCreate}>
            <Icon icon="mdi:plus" size={16} className="mr-1" /> New Template
          </Button>
        </div>
        <p className="text-sm text-text-secondary">
          Manage email templates for workflow notifications, system alerts, and
          communications.
        </p>
      </CardHeader>
      <CardContent>
        {/* Category Stats */}
        <div className="grid grid-cols-5 gap-3 mb-4">
          {categoryStats.map((c) => (
            <button
              key={c.value}
              onClick={() =>
                setFilterCategory(
                  filterCategory === c.value ? "all" : c.value
                )
              }
              className={`rounded-lg border p-3 text-left transition-colors ${
                filterCategory === c.value
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50"
              }`}
            >
              <div className="flex items-center gap-2">
                <Icon icon={c.icon as any} size={16} className={c.color} />
                <span className="text-xs font-medium">{c.label}</span>
              </div>
              <div className="text-lg font-bold mt-1">{c.count}</div>
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="flex items-center gap-2 mb-4">
          <div className="relative flex-1">
            <Icon
              icon="mdi:magnify"
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary"
            />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search templates..."
              className="pl-9"
            />
          </div>
          {filterCategory !== "all" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFilterCategory("all")}
            >
              Clear Filter
            </Button>
          )}
        </div>

        {/* Table */}
        <Table
          rowKey="id"
          size="small"
          scroll={{ x: "max-content" }}
          columns={columns}
          dataSource={templates}
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

      {/* ── Create/Edit Dialog ────────────────────── */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit Email Template" : "New Email Template"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Name */}
            <div className="space-y-1">
              <Label className="text-xs">
                Template Name *{" "}
                <button
                  type="button"
                  className="text-primary hover:underline ml-1"
                  onClick={() => setShowVarHelp(!showVarHelp)}
                >
                  (Variables Help)
                </button>
              </Label>
              <Input
                value={form.name_template}
                onChange={(e) =>
                  setForm({ ...form, name_template: e.target.value })
                }
                placeholder="e.g. Workflow - Order Approved"
              />
            </div>

            {/* Variable Help */}
            {showVarHelp && (
              <div className="rounded-lg border bg-muted/30 p-3">
                <div className="text-xs font-semibold text-text-secondary mb-2">
                  Available Jinja2 Variables
                </div>
                <div className="grid grid-cols-2 gap-1">
                  {SAMPLE_VARIABLES.map((v) => (
                    <div key={v.var} className="flex items-center gap-2 text-xs">
                      <code className="bg-muted px-1 rounded font-mono text-primary">
                        {v.var}
                      </code>
                      <span className="text-text-secondary">{v.desc}</span>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-text-secondary mt-2">
                  Templates use Django/Jinja2 syntax. Use {"{{ variable }}"} for
                  interpolation and {"{% if %}"} / {"{% endif %}"} for
                  conditionals.
                </p>
              </div>
            )}

            {/* Category + DocType */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs">Category *</Label>
                <Select
                  value={form.category}
                  onValueChange={(v) => setForm({ ...form, category: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Reference DocType</Label>
                <Select
                  value={form.reference_doctype}
                  onValueChange={(v) =>
                    setForm({ ...form, reference_doctype: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {DOC_TYPES.map((dt) => (
                      <SelectItem key={dt} value={dt}>
                        {dt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Subject */}
            <div className="space-y-1">
              <Label className="text-xs">Subject *</Label>
              <Input
                value={form.subject}
                onChange={(e) =>
                  setForm({ ...form, subject: e.target.value })
                }
                placeholder="e.g. Order {{ doc.name }} has been approved"
                className="font-mono text-sm"
              />
            </div>

            {/* Description */}
            <div className="space-y-1">
              <Label className="text-xs">Description</Label>
              <Input
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                placeholder="Brief description of when this template is used"
              />
            </div>

            {/* Use HTML Toggle */}
            <div className="flex items-center gap-2">
              <Switch
                checked={form.use_html}
                onCheckedChange={(v) => setForm({ ...form, use_html: v })}
              />
              <Label className="text-xs">Use HTML</Label>
            </div>

            {/* Response Body */}
            <div className="space-y-1">
              <Label className="text-xs">
                {form.use_html ? "HTML Response *" : "Plain Text Response *"}
              </Label>
              {form.use_html ? (
                <Textarea
                  value={form.response_html}
                  onChange={(e) =>
                    setForm({ ...form, response_html: e.target.value })
                  }
                  rows={10}
                  placeholder="<h2>Hello {{ user.full_name }}</h2><p>Your order {{ doc.name }} has been processed.</p>"
                  className="font-mono text-sm resize-y"
                />
              ) : (
                <Textarea
                  value={form.response}
                  onChange={(e) =>
                    setForm({ ...form, response: e.target.value })
                  }
                  rows={8}
                  placeholder="Hello {{ user.full_name }}, Your order {{ doc.name }} has been processed."
                  className="font-mono text-sm resize-y"
                />
              )}
            </div>

            {/* Enabled Toggle */}
            <div className="flex items-center gap-2">
              <Switch
                checked={form.enabled}
                onCheckedChange={(v) => setForm({ ...form, enabled: v })}
              />
              <Label className="text-xs">Enabled</Label>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button variant="outline" onClick={() => setShowDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={!form.name_template || !form.subject}
              >
                {editing ? "Save Changes" : "Create Template"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Preview Dialog ────────────────────────── */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Icon icon="mdi:eye-outline" size={18} />
              Email Preview
            </DialogTitle>
          </DialogHeader>
          {previewLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : preview ? (
            <div className="space-y-4">
              {/* Subject */}
              <div className="rounded-lg border bg-muted/30 p-3">
                <div className="text-xs font-semibold text-text-secondary mb-1">
                  SUBJECT
                </div>
                <div className="text-sm font-medium">{preview.subject}</div>
              </div>
              {/* Body */}
              <div className="rounded-lg border bg-white p-4">
                <div className="text-xs font-semibold text-text-secondary mb-2">
                  BODY
                </div>
                {preview.message?.includes("<") ? (
                  <div
                    className="text-sm prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: preview.message }}
                  />
                ) : (
                  <pre className="text-sm whitespace-pre-wrap font-sans">
                    {preview.message}
                  </pre>
                )}
              </div>
              <p className="text-[10px] text-text-secondary text-center">
                This is a preview using sample data. Actual emails will use real
                document values.
              </p>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
