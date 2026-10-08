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
import {
  DocShareApi,
  UserListApi,
  DocTypeListApi,
  type DocShare,
  type UserListItem,
  type DocTypeListItem,
} from "@/api/services/erpService";

const MODULES: Record<string, string[]> = {
  Healthcare: ["Patient", "Healthcare Practitioner", "Medical Department", "Patient Appointment", "Vital Signs", "Patient Encounter", "Diagnosis", "Drug Prescription", "Medication Request", "Lab Test", "Lab Test Template", "Clinical Procedure", "Observation", "Therapy Plan", "Therapy Session", "Inpatient Record", "Emergency Record", "Nursing Task", "Insurance Payor", "Patient Insurance Policy", "Insurance Claim", "Service Request", "Medication", "Allergy", "Pharmacy Warehouse", "Pharmacy Stock", "Pharmacy Stock Entry"],
};

export default function DocSharesPage() {
  const [shares, setShares] = useState<DocShare[]>([]);
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [doctypes, setDoctypes] = useState<DocTypeListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [doctypeFilter, setDoctypeFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<DocShare | null>(null);

  const [form, setForm] = useState({
    user: null as number | null,
    share_doctype: "",
    share_name: "",
    everyone: false,
    read: true,
    write: false,
    submit: false,
    share: false,
    notify_by_email: true,
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
      if (doctypeFilter) params.share_doctype = doctypeFilter;
      const res = await DocShareApi.list(params);
      setShares(res.results || []);
      setTotal(res.count || 0);
    } catch (err) {
      console.error("Failed to load doc shares:", err);
    } finally {
      setLoading(false);
    }
  }, [page, search, doctypeFilter]);

  useEffect(() => {
    loadDropdowns();
  }, [loadDropdowns]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const resetForm = () =>
    setForm({
      user: null,
      share_doctype: "",
      share_name: "",
      everyone: false,
      read: true,
      write: false,
      submit: false,
      share: false,
      notify_by_email: true,
    });

  const handleSubmit = async () => {
    if (!form.share_doctype || !form.share_name) return;
    if (!form.everyone && form.user === null) return;
    try {
      if (editItem) {
        await DocShareApi.update(editItem.id, form);
      } else {
        await DocShareApi.create(form);
      }
      setShowForm(false);
      setEditItem(null);
      resetForm();
      loadData();
    } catch (err) {
      console.error("Save failed:", err);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Delete this document share?")) return;
    try {
      await DocShareApi.delete(id);
      loadData();
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  const openEdit = (item: DocShare) => {
    setForm({
      user: item.user,
      share_doctype: item.share_doctype,
      share_name: item.share_name,
      everyone: item.everyone,
      read: item.read,
      write: item.write,
      submit: item.submit,
      share: item.share,
      notify_by_email: item.notify_by_email,
    });
    setEditItem(item);
    setShowForm(true);
  };

  const allDoctypeNames = [...new Set([...doctypes.map((d) => d.name), ...Object.values(MODULES).flat()])].sort();

  const columns: ColumnsType<DocShare> = [
    {
      title: "Shared With",
      dataIndex: "user_username",
      width: 160,
      render: (_, record) =>
        record.everyone ? (
          <Badge variant="warning" className="text-xs">
            <Icon icon="mdi:earth" size={10} className="mr-0.5" /> Everyone
          </Badge>
        ) : (
          <div className="flex items-center gap-2">
            <Icon icon="mdi:account-outline" size={14} className="text-text-secondary" />
            <span className="font-medium text-sm">{record.user_username || `User #${record.user}`}</span>
          </div>
        ),
    },
    {
      title: "DocType",
      dataIndex: "share_doctype",
      width: 140,
      render: (v) => <Badge variant="info" className="text-xs">{v}</Badge>,
    },
    {
      title: "Document",
      dataIndex: "share_name",
      width: 200,
      render: (v) => <span className="font-mono text-xs">{v}</span>,
    },
    {
      title: "Permissions",
      key: "permissions",
      width: 200,
      render: (_, record) => (
        <div className="flex flex-wrap gap-1">
          {record.read && <Badge variant="success" className="text-xs">read</Badge>}
          {record.write && <Badge variant="info" className="text-xs">write</Badge>}
          {record.submit && <Badge variant="warning" className="text-xs">submit</Badge>}
          {record.share && <Badge variant="outline" className="text-xs">share</Badge>}
        </div>
      ),
    },
    {
      title: "Notify",
      dataIndex: "notify_by_email",
      width: 70,
      align: "center",
      render: (v) =>
        v ? (
          <Icon icon="mdi:email-check" size={16} className="text-success" />
        ) : (
          <Icon icon="mdi:email-off" size={16} className="text-text-secondary" />
        ),
    },
    {
      title: "Owner",
      dataIndex: "owner",
      width: 120,
      render: (v) => <span className="text-xs text-text-secondary">{v || "-"}</span>,
    },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon icon="mdi:share-variant-outline" size={22} className="text-primary" />
            <span className="text-lg font-semibold">Document Shares</span>
            <Badge variant="outline">{total}</Badge>
          </div>
          <div className="flex items-center gap-2">
            <select
              className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
              value={doctypeFilter}
              onChange={(e) => { setDoctypeFilter(e.target.value); setPage(1); }}
            >
              <option value="">All DocTypes</option>
              {allDoctypeNames.map((dt) => (
                <option key={dt} value={dt}>{dt}</option>
              ))}
            </select>
            <Input
              placeholder="Search documents..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (setPage(1), loadData())}
              className="w-48"
            />
            <Button onClick={() => { resetForm(); setEditItem(null); setShowForm(true); }}>
              <Icon icon="mdi:plus" size={18} className="mr-1" /> Share Document
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
          dataSource={shares}
          loading={loading}
          pagination={{
            current: page,
            total,
            pageSize: 20,
            showSizeChanger: false,
            onChange: (p) => setPage(p),
          }}
        />
      </CardContent>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editItem ? "Edit Document Share" : "Share a Document"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {/* Share With */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Share With *</Label>
              <div className="col-span-3 flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={form.everyone}
                    onCheckedChange={(v) => setForm({ ...form, everyone: v, user: v ? null : form.user })}
                  />
                  <span className="text-xs text-text-secondary">Everyone</span>
                </div>
                {!form.everyone && (
                  <select
                    className="h-9 flex-1 rounded-md border border-input bg-transparent px-3 text-sm"
                    value={form.user || ""}
                    onChange={(e) => setForm({ ...form, user: Number(e.target.value) || null })}
                  >
                    <option value="">Select user...</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>{u.username} ({u.first_name} {u.last_name})</option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            {/* DocType */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">DocType *</Label>
              <select
                className="col-span-3 h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                value={form.share_doctype}
                onChange={(e) => setForm({ ...form, share_doctype: e.target.value })}
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

            {/* Document Name */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Document *</Label>
              <Input
                className="col-span-3"
                value={form.share_name}
                onChange={(e) => setForm({ ...form, share_name: e.target.value })}
                placeholder="e.g. CUST-00001, TechStart Inc."
              />
            </div>

            {/* Permission Toggles */}
            <div className="grid grid-cols-4 items-start gap-4">
              <Label className="text-right pt-2">Permissions</Label>
              <div className="col-span-3 space-y-2">
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={form.read}
                      onCheckedChange={(v) => setForm({ ...form, read: v })}
                    />
                    <span className="text-sm">Read</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={form.write}
                      onCheckedChange={(v) => setForm({ ...form, write: v, read: v ? true : form.read })}
                    />
                    <span className="text-sm">Write</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={form.submit}
                      onCheckedChange={(v) => setForm({ ...form, submit: v, write: v ? true : form.write, read: v ? true : form.read })}
                    />
                    <span className="text-sm">Submit</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={form.share}
                      onCheckedChange={(v) => setForm({ ...form, share: v, read: v ? true : form.read })}
                    />
                    <span className="text-sm">Share</span>
                  </div>
                </div>
                <div className="text-xs text-text-secondary">
                  Write implies Read. Submit implies Write. Share implies Read.
                </div>
              </div>
            </div>

            {/* Notify */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Notify by Email</Label>
              <div className="col-span-3 flex items-center gap-2">
                <Switch
                  checked={form.notify_by_email}
                  onCheckedChange={(v) => setForm({ ...form, notify_by_email: v })}
                />
                <span className="text-xs text-text-secondary">Send email notification to the user</span>
              </div>
            </div>

            {/* Info box */}
            <div className="rounded-md bg-muted/50 p-3 text-xs text-text-secondary space-y-1">
              <div className="font-semibold text-sm mb-1">How Document Sharing Works</div>
              <div><strong>Read</strong> = User can view the document even if they don't have role-based read permission.</div>
              <div><strong>Write</strong> = User can edit the document (automatically grants Read).</div>
              <div><strong>Submit</strong> = User can submit the document (automatically grants Write).</div>
              <div><strong>Share</strong> = User can further share this document with others.</div>
              <div><strong>Everyone</strong> = Share with all users (ignores the user field).</div>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button
              onClick={handleSubmit}
              disabled={!form.share_doctype || !form.share_name || (!form.everyone && form.user === null)}
            >
              {editItem ? "Update" : "Share"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
