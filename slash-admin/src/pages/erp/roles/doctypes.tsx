import { Icon } from "@/components/icon";
import { Badge } from "@/ui/badge";
import { Button } from "@/ui/button";
import { Card, CardContent, CardHeader } from "@/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/ui/dialog";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import Table, { type ColumnsType } from "antd/es/table";
import { useEffect, useState, useCallback } from "react";
import apiClient from "@/api/apiClient";

interface DocType {
  id: number;
  name: string;
  module: string;
  description: string;
  is_active: boolean;
}

const MODULE_OPTIONS = ["Healthcare", "Core", "Setup"];

export default function DocTypesPage() {
  const [doctypes, setDocTypes] = useState<DocType[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<DocType | null>(null);

  const [form, setForm] = useState({ name: "", module: "Healthcare", description: "", is_active: true });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = { page };
      if (search) params.search = search;
      const res = await apiClient.get<{ results: DocType[]; count: number }>({
        url: "/roles/doctypes/", params,
      });
      setDocTypes(res.results || []);
      setTotal(res.count || 0);
    } catch (err) {
      console.error("Failed to load doctypes:", err);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSubmit = async () => {
    try {
      if (editItem) {
        await apiClient.put({ url: `/roles/doctypes/${editItem.id}/`, data: form });
      } else {
        await apiClient.post({ url: "/roles/doctypes/", data: form });
      }
      setShowForm(false);
      setEditItem(null);
      setForm({ name: "", module: "Healthcare", description: "", is_active: true });
      loadData();
    } catch (err: any) {
      const msg = err?.response?.data?.name?.[0] || err?.response?.data?.detail || "Save failed";
      alert(msg);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Delete this doctype? Permissions for this doctype will also be removed.")) return;
    try {
      await apiClient.delete({ url: `/roles/doctypes/${id}/` });
      loadData();
    } catch (err: any) {
      const msg = err?.response?.data?.detail || "Delete failed";
      alert(msg);
    }
  };

  const columns: ColumnsType<DocType> = [
    {
      title: "DocType Name",
      dataIndex: "name",
      width: 220,
      render: (name) => <span className="font-semibold">{name}</span>,
    },
    {
      title: "Module",
      dataIndex: "module",
      width: 140,
      render: (mod) => <Badge variant="info">{mod}</Badge>,
    },
    {
      title: "Description",
      dataIndex: "description",
      width: 300,
      render: (v) => v || "-",
    },
    {
      title: "Active",
      dataIndex: "is_active",
      width: 80,
      align: "center",
      render: (v) => <Badge variant={v ? "success" : "error"}>{v ? "Yes" : "No"}</Badge>,
    },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="text-lg font-semibold">Doc Types</div>
          <div className="flex items-center gap-2">
            <Input
              placeholder="Search doctypes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (setPage(1), loadData())}
              className="w-64"
            />
            <Button onClick={() => { setForm({ name: "", module: "Healthcare", description: "", is_active: true }); setEditItem(null); setShowForm(true); }}>
              <Icon icon="mdi:plus" size={18} className="mr-1" /> New DocType
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
                  <Button variant="ghost" size="icon" onClick={() => {
                    setForm({ name: record.name, module: record.module, description: record.description, is_active: record.is_active });
                    setEditItem(record);
                    setShowForm(true);
                  }}>
                    <Icon icon="solar:pen-bold-duotone" size={18} />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(record.id)}>
                    <Icon icon="mingcute:delete-2-fill" size={18} className="text-error!" />
                  </Button>
                </div>
              ),
            },
          ]}
          dataSource={doctypes}
          loading={loading}
          pagination={{ current: page, total, pageSize: 20, showSizeChanger: false, onChange: (p) => setPage(p) }}
        />
      </CardContent>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editItem ? "Edit DocType" : "New DocType"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Name *</Label>
              <Input className="col-span-3" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Sales Invoice" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Module</Label>
              <select className="col-span-3 h-9 rounded-md border border-input bg-transparent px-3 text-sm" value={form.module} onChange={(e) => setForm({ ...form, module: e.target.value })}>
                {MODULE_OPTIONS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Description</Label>
              <Input className="col-span-3" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={handleSubmit}>{editItem ? "Update" : "Create"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
