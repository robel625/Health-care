import { useState, useEffect, useCallback } from "react";
import { Icon } from "@/components/icon";
import { Button } from "@/ui/button";
import { Card, CardContent } from "@/ui/card";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/ui/dialog";
import Table, { type ColumnsType } from "antd/es/table";
import { HealthcareApi } from "@/api/services/healthcareService";
import type { LabTestUOM } from "@/api/services/healthcareService";
import { useDoctypePermissions } from "@/utils/permissions";

export default function LabTestUOMsPage() {
  const { canCreate } = useDoctypePermissions("Lab Test UOM");
  const [data, setData] = useState<LabTestUOM[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  // Marley's Lab Test UOM: `lab_test_uom` is the record's identity and
  // `uom_description` is the Small Text under it.
  const [form, setForm] = useState({ lab_test_uom: "", uom_description: "" });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = { page, page_size: 20 };
      if (search) params.search = search;
      const res = await HealthcareApi.labTestUOMs.list(params);
      setData(res.results || []);
      setTotal(res.count || 0);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [page, search]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSave = async () => {
    await HealthcareApi.labTestUOMs.create(form);
    setShowForm(false); setForm({ lab_test_uom: "", uom_description: "" }); loadData();
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete?")) return;
    await HealthcareApi.labTestUOMs.delete(id);
    loadData();
  };

  const columns: ColumnsType<LabTestUOM> = [
    { title: "UOM", dataIndex: "lab_test_uom", width: 200, render: (v: string) => <span className="font-medium">{v}</span> },
    { title: "Description", dataIndex: "uom_description", width: 300 },
    {
      title: "Actions", width: 80,
      render: (_, r) => <Button variant="ghost" size="sm" onClick={() => handleDelete(r.id)}><Icon icon="solar:trash-bin-trash-bold" size={16} className="text-red-500" /></Button>,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Lab Test UOM</h1><p className="text-muted-foreground">{total} units</p></div>
        {canCreate && (
          <Button onClick={() => setShowForm(true)} className="bg-emerald-600 hover:bg-emerald-700">
            <Icon icon="solar:add-circle-bold" size={18} className="mr-2" /> New UOM
          </Button>
        )}
      </div>
      <Card><CardContent className="pt-4">
        <Input placeholder="Search..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="max-w-sm mb-4" />
        <Table columns={columns} dataSource={data} rowKey="id" loading={loading} pagination={{ current: page, total, pageSize: 20, onChange: setPage }} />
      </CardContent></Card>
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>New Lab Test UOM</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div><Label>UOM *</Label><Input value={form.lab_test_uom} onChange={(e) => setForm({ ...form, lab_test_uom: e.target.value })} className="mt-1" /></div>
            <div><Label>Description</Label><Input value={form.uom_description} onChange={(e) => setForm({ ...form, uom_description: e.target.value })} className="mt-1" /></div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={handleSave} className="bg-emerald-600 hover:bg-emerald-700">Create</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
