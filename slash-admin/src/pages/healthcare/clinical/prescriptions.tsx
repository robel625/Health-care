import { useState, useEffect, useCallback } from "react";
import { Icon } from "@/components/icon";
import { Button } from "@/ui/button";
import { Card, CardContent } from "@/ui/card";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/ui/dialog";
import Table, { type ColumnsType } from "antd/es/table";
import { HealthcareApi } from "@/api/services/healthcareService";
import EntitySelect from "@/components/healthcare/EntitySelect";
import Combobox from "@/components/healthcare/Combobox";
import { useDoctypePermissions } from "@/utils/permissions";
import type { DrugPrescription, Patient } from "@/api/services/healthcareService";
import { useNavigate, useSearchParams } from "react-router";

const statusColor: Record<string, string> = { Active: "bg-green-100 text-green-700", Completed: "bg-blue-100 text-blue-700", Cancelled: "bg-red-100 text-red-700" };

export default function PrescriptionsPage() {
  const { canCreate } = useDoctypePermissions("Drug Prescription");
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const patientFilter = searchParams.get("patient");
  const practitionerFilter = searchParams.get("practitioner");
  const [data, setData] = useState<DrugPrescription[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ patient: null as number | null, practitioner: practitionerFilter ? Number(practitionerFilter) : null as number | null, medication_name: "", dosage_form: "Tablet", dosage: "", period: "", quantity: 1, comment: "" });

  // Auto-populate practitioner from URL
  useEffect(() => {
    if (practitionerFilter && !form.practitioner) {
      setForm((prev) => ({ ...prev, practitioner: Number(practitionerFilter) }));
    }
  }, [practitionerFilter]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const filterParams: Record<string, any> = { page };
      if (patientFilter) filterParams.patient = patientFilter;
      if (practitionerFilter) filterParams.practitioner = practitionerFilter;
      const [res, pats] = await Promise.all([HealthcareApi.prescriptions.list(filterParams), HealthcareApi.patients.list({ page_size: 200 })]);
      setData(res.results || []); setTotal(res.count || 0); setPatients(pats.results || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [page, patientFilter, practitionerFilter]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSave = async () => { await HealthcareApi.prescriptions.create(form as any); setShowForm(false); loadData(); };
  const handleDelete = async (id: number) => { if (confirm("Delete?")) { await HealthcareApi.prescriptions.delete(id); loadData(); } };

  const columns: ColumnsType<DrugPrescription> = [
    { title: "Patient", dataIndex: "patient_name", width: 180 },
    { title: "Medication", dataIndex: "medication_name", width: 200 },
    { title: "Dosage Form", dataIndex: "dosage_form", width: 110 },
    { title: "Dosage", dataIndex: "dosage", width: 100 },
    { title: "Period", dataIndex: "period", width: 100 },
    { title: "Quantity", dataIndex: "quantity", width: 90 },
    { title: "Status", dataIndex: "status", width: 100, render: (v: string) => <span className={`text-xs px-2 py-1 rounded-full ${statusColor[v] || ""}`}>{v}</span> },
    { title: "Actions", width: 80, render: (_, r) => <Button variant="ghost" size="sm" onClick={() => handleDelete(r.id)}><Icon icon="solar:trash-bin-trash-bold" size={16} className="text-red-500" /></Button> },
  ];

  return (
    <div className="space-y-6">
      {(patientFilter || practitionerFilter) && (
        <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-700">
          <Icon icon="solar:filter-bold" size={16} />
          <span>Filtered by: {patientFilter ? `Patient #${patientFilter}` : `Practitioner #${practitionerFilter}`}</span>
          <Button variant="ghost" size="sm" className="ml-auto text-blue-700" onClick={() => navigate("/healthcare/prescriptions")}>Clear Filter</Button>
        </div>
      )}
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Drug Prescriptions</h1><p className="text-muted-foreground">{total} prescriptions</p></div>
        {canCreate && (
          <Button onClick={() => setShowForm(true)} className="bg-emerald-600 hover:bg-emerald-700">
            <Icon icon="solar:pills-bold-duotone" size={18} className="mr-2" /> New Prescription
          </Button>
        )}
      </div>
      <Card><CardContent className="pt-6">
        <Table columns={columns} dataSource={data} rowKey="id" loading={loading}
          pagination={{ current: page, total, pageSize: 20, onChange: setPage }} />
      </CardContent></Card>
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>New Prescription</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="col-span-2">
              <Label>Patient *</Label>
              <div className="mt-1">
                <EntitySelect
                  doctype="Patient"
                  rawItems={patients}
                  options={patients.map((p) => ({ value: p.id, label: p.patient_name || `${p.first_name || ""} ${p.last_name || ""}`.trim(), sublabel: p.patient_id, image: p.image }))}
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
            <div className="col-span-2"><Label>Medication Name *</Label><Input value={form.medication_name} onChange={(e) => setForm({ ...form, medication_name: e.target.value })} /></div>
            <div>
              <Label>Dosage Form</Label>
              <div className="mt-1">
                <Combobox
                  doctype="Dosage Form"
                  options={["Tablet", "Capsule", "Syrup", "Injection", "Drops", "Inhaler", "Cream", "Ointment"]}
                  value={form.dosage_form}
                  onChange={(val) => setForm({ ...form, dosage_form: val })}
                />
              </div>
            </div>
            <div><Label>Dosage</Label><Input value={form.dosage} onChange={(e) => setForm({ ...form, dosage: e.target.value })} placeholder="e.g., 1 tablet" /></div>
            <div><Label>Period</Label><Input value={form.period} onChange={(e) => setForm({ ...form, period: e.target.value })} placeholder="e.g., 5 days" /></div>
            <div><Label>Quantity</Label><Input type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} /></div>
            <div className="col-span-2"><Label>Comment</Label><Input value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} placeholder="e.g., Take after food" /></div>
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
