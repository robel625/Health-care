import { useState, useEffect, useCallback } from "react";
import { Icon } from "@/components/icon";
import { Button } from "@/ui/button";
import { Card, CardContent } from "@/ui/card";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/ui/dialog";
import Table, { type ColumnsType } from "antd/es/table";
import { HealthcareApi } from "@/api/services/healthcareService";
import type { Patient } from "@/api/services/healthcareService";
import { useDoctypePermissions } from "@/utils/permissions";
import EntitySelect from "@/components/healthcare/EntitySelect";

const severityColor: Record<string, string> = {
  Mild: "bg-green-100 text-green-700", Moderate: "bg-yellow-100 text-yellow-700",
  Severe: "bg-orange-100 text-orange-700", Fatal: "bg-red-100 text-red-700",
};

export default function AllergiesPage() {
  const { canCreate } = useDoctypePermissions("Allergy");
  const [data, setData] = useState<any[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ patient: null as number | null, allergy: "", allergy_type: "Drug", severity: "Moderate", reaction: "", status: "Active" });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [res, pats] = await Promise.all([HealthcareApi.allergies.list({ page }), HealthcareApi.patients.list({ page_size: 200 })]) as [any, any];
      setData(res.results || []); setTotal(res.count || 0); setPatients(pats.results || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [page]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSave = async () => { await HealthcareApi.allergies.create(form); setShowForm(false); loadData(); };
  const handleDelete = async (id: number) => { if (confirm("Delete?")) { await HealthcareApi.allergies.delete(id); loadData(); } };

  const columns: ColumnsType<any> = [
    { title: "Patient", dataIndex: "patient_name", width: 180 },
    { title: "Allergy", dataIndex: "allergy", width: 200 },
    { title: "Type", dataIndex: "allergy_type", width: 100 },
    { title: "Severity", dataIndex: "severity", width: 100, render: (v: string) => <span className={`text-xs px-2 py-1 rounded-full ${severityColor[v] || ""}`}>{v}</span> },
    { title: "Reaction", dataIndex: "reaction", width: 200, ellipsis: true },
    { title: "Status", dataIndex: "status", width: 100 },
    { title: "Actions", width: 80, render: (_, r) => <Button variant="ghost" size="sm" onClick={() => handleDelete(r.id)}><Icon icon="solar:trash-bin-trash-bold" size={16} className="text-red-500" /></Button> },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Patient Allergies</h1><p className="text-muted-foreground">{total} allergies recorded</p></div>
        <Button onClick={() => setShowForm(true)} className="bg-rose-600 hover:bg-rose-700">
          <Icon icon="solar:warning-bold-duotone" size={18} className="mr-2" /> Record Allergy
        </Button>
      </div>
      <Card><CardContent className="pt-6">
        <Table columns={columns} dataSource={data} rowKey="id" loading={loading}
          pagination={{ current: page, total, pageSize: 20, onChange: setPage }} />
      </CardContent></Card>
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Record Allergy</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="col-span-2">
              <Label>Patient *</Label>
              <div className="mt-1">
                <EntitySelect
                  doctype="Patient"
                  rawItems={patients}
                  options={patients.map((p) => ({
                    value: p.id,
                    label: p.patient_name || `${p.first_name || ""} ${p.last_name || ""}`.trim(),
                    sublabel: p.patient_id,
                    image: p.image,
                  }))}
                  value={form.patient}
                  onChange={(v) => setForm({ ...form, patient: v })}
                  onOptionAdded={(_opt, raw) => {
                    if (raw) setPatients((prev) => [...prev, raw]);
                  }}
                  placeholder="Select Patient"
                  emptyText="No patients found"
                />
              </div>
            </div>
            <div className="col-span-2"><Label>Allergy *</Label><Input value={form.allergy} onChange={(e) => setForm({ ...form, allergy: e.target.value })} placeholder="e.g., Penicillin, Peanuts" /></div>
            <div><Label>Type</Label><select className="w-full border rounded-md px-3 py-2 text-sm" value={form.allergy_type} onChange={(e) => setForm({ ...form, allergy_type: e.target.value })}>
              {["Drug", "Food", "Environment", "Other"].map(t => <option key={t}>{t}</option>)}
            </select></div>
            <div><Label>Severity</Label><select className="w-full border rounded-md px-3 py-2 text-sm" value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })}>
              {["Mild", "Moderate", "Severe", "Fatal"].map(s => <option key={s}>{s}</option>)}
            </select></div>
            <div className="col-span-2"><Label>Reaction</Label><Input value={form.reaction} onChange={(e) => setForm({ ...form, reaction: e.target.value })} placeholder="e.g., Anaphylaxis, Rash, Hives" /></div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!canCreate} className="bg-rose-600 hover:bg-rose-700">Save</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
