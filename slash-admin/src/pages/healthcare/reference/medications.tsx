import { useState, useEffect, useCallback } from "react";
import { Icon } from "@/components/icon";
import { Button } from "@/ui/button";
import { Card, CardContent } from "@/ui/card";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/ui/dialog";
import Table, { type ColumnsType } from "antd/es/table";
import { HealthcareApi } from "@/api/services/healthcareService";
import type { DosageForm } from "@/api/services/healthcareService";
import { useDoctypePermissions } from "@/utils/permissions";
import EntitySelect from "@/components/healthcare/EntitySelect";

export default function MedicationsPage() {
  const { canCreate } = useDoctypePermissions("Medication");
  const [data, setData] = useState<any[]>([]);
  const [dosageForms, setDosageForms] = useState<DosageForm[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ generic_name: "", strength: "", strength_uom: "mg", dosage_form: null as number | null, national_drug_code: "", is_combination: false, disabled: false });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = { page };
      if (search) params.search = search;
      const [res, dfRes] = await Promise.all([
        HealthcareApi.medications.list(params) as any,
        HealthcareApi.dosageForms.list({ page_size: 100 }),
      ]);
      setData(res.results || []); setTotal(res.count || 0);
      setDosageForms(dfRes.results || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [page, search]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSave = async () => { await HealthcareApi.medications.create(form); setShowForm(false); loadData(); };
  const handleDelete = async (id: number) => { if (confirm("Delete?")) { await HealthcareApi.medications.delete(id); loadData(); } };

  const columns: ColumnsType<any> = [
    { title: "Generic Name", dataIndex: "generic_name", width: 250 },
    { title: "Strength", width: 120, render: (_, r) => `${r.strength} ${r.strength_uom}` },
    { title: "Dosage Form", dataIndex: "dosage_form_name", width: 130 },
    { title: "Class", dataIndex: "medication_class_name", width: 150 },
    { title: "NDC", dataIndex: "national_drug_code", width: 130 },
    { title: "Combination", dataIndex: "is_combination", width: 110, render: (v: boolean) => v ? "Yes" : "No" },
    { title: "Disabled", dataIndex: "disabled", width: 90, render: (v: boolean) => v ? <span className="text-red-500">Yes</span> : "No" },
    { title: "Actions", width: 80, render: (_, r) => <Button variant="ghost" size="sm" onClick={() => handleDelete(r.id)}><Icon icon="solar:trash-bin-trash-bold" size={16} className="text-red-500" /></Button> },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Medications</h1><p className="text-muted-foreground">{total} medications in formulary</p></div>
        {canCreate && (
          <Button onClick={() => setShowForm(true)} className="bg-indigo-600 hover:bg-indigo-700">
            <Icon icon="solar:pills-bold-duotone" size={18} className="mr-2" /> New Medication
          </Button>
        )}
      </div>
      <Card>
        <div className="px-6 pt-4"><Input placeholder="Search medications..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="max-w-sm" /></div>
        <CardContent className="pt-4">
          <Table columns={columns} dataSource={data} rowKey="id" loading={loading}
            pagination={{ current: page, total, pageSize: 20, onChange: setPage }} />
        </CardContent>
      </Card>
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>New Medication</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="col-span-2"><Label>Generic Name *</Label><Input value={form.generic_name} onChange={(e) => setForm({ ...form, generic_name: e.target.value })} /></div>
            <div><Label>Strength</Label><Input value={form.strength} onChange={(e) => setForm({ ...form, strength: e.target.value })} placeholder="e.g., 500" /></div>
            <div><Label>Strength UOM</Label><Input value={form.strength_uom} onChange={(e) => setForm({ ...form, strength_uom: e.target.value })} placeholder="mg" /></div>
            <div><Label>National Drug Code</Label><Input value={form.national_drug_code} onChange={(e) => setForm({ ...form, national_drug_code: e.target.value })} /></div>
            <div>
              <Label>Dosage Form</Label>
              <div className="mt-1">
                <EntitySelect
                  doctype="Dosage Form"
                  rawItems={dosageForms}
                  options={dosageForms.map((df) => ({ value: df.id, label: df.dosage_form }))}
                  value={form.dosage_form}
                  onChange={(v) => setForm({ ...form, dosage_form: v })}
                  onOptionAdded={(_opt, raw) => {
                    if (raw) setDosageForms((prev) => [...prev, raw]);
                  }}
                  placeholder="Select Dosage Form"
                  emptyText="No dosage forms found"
                />
              </div>
            </div>
            <div className="flex items-center gap-2 pt-6">
              <input type="checkbox" checked={form.is_combination} onChange={(e) => setForm({ ...form, is_combination: e.target.checked })} />
              <Label>Is Combination</Label>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={handleSave} className="bg-indigo-600 hover:bg-indigo-700">Create</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
