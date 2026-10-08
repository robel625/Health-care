import { useState, useEffect } from "react";
import { Icon } from "@/components/icon";
import { Button } from "@/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/ui/dialog";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { HealthcareApi, type InpatientRecord, type HealthcareServiceUnit, type HealthcarePractitioner, type MedicalDepartment, type Patient } from "@/api/services/healthcareService";
import EntitySelect from "@/components/healthcare/EntitySelect";

interface InpatientAdmissionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId?: number;
  patientName?: string;
  initialRecord?: InpatientRecord | null;
  onSuccess?: (record?: InpatientRecord) => void;
}

export default function InpatientAdmissionModal({
  open,
  onOpenChange,
  patientId,
  patientName,
  initialRecord,
  onSuccess,
}: InpatientAdmissionModalProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [patients, setPatients] = useState<Patient[]>([]);
  const [practitioners, setPractitioners] = useState<HealthcarePractitioner[]>([]);
  const [departments, setDepartments] = useState<MedicalDepartment[]>([]);
  const [serviceUnits, setServiceUnits] = useState<HealthcareServiceUnit[]>([]);

  const today = new Date().toISOString().split("T")[0];
  const nowTime = new Date().toTimeString().slice(0, 5);

  const [form, setForm] = useState({
    patient: patientId || null as number | null,
    practitioner: null as number | null,
    department: null as number | null,
    service_unit: null as number | null,
    status: "Admission Scheduled" as "Admission Scheduled" | "Admitted",
    admission_date: today,
    admission_time: nowTime,
    expected_discharge_date: "",
    chief_complaint: "",
    notes: "",
    height: "",
    weight: "",
  });

  // Load masters when modal opens
  useEffect(() => {
    if (!open) return;
    setError(null);

    const loadMasters = async () => {
      setLoading(true);
      try {
        const [patRes, pracRes, deptRes, suRes] = await Promise.all([
          !patientId ? HealthcareApi.patients.list({ page_size: 200 }).catch(() => ({ results: [] })) : Promise.resolve({ results: [] }),
          HealthcareApi.practitioners.list({ page_size: 200 }).catch(() => ({ results: [] })),
          HealthcareApi.departments.list({ page_size: 200 }).catch(() => ({ results: [] })),
          HealthcareApi.serviceUnits.list({ page_size: 200 }).catch(() => ({ results: [] })),
        ]);
        if (patRes.results) setPatients(patRes.results);
        if (pracRes.results) setPractitioners(pracRes.results);
        if (deptRes.results) setDepartments(deptRes.results);
        if (suRes.results) setServiceUnits(suRes.results);

        if (initialRecord) {
          setForm({
            patient: initialRecord.patient,
            practitioner: initialRecord.practitioner ?? null,
            department: initialRecord.department ?? null,
            service_unit: initialRecord.service_unit ?? null,
            status: (initialRecord.status as any) || "Admission Scheduled",
            admission_date: initialRecord.admission_date || today,
            admission_time: initialRecord.admission_time || nowTime,
            expected_discharge_date: initialRecord.expected_discharge_date || "",
            chief_complaint: initialRecord.chief_complaint || "",
            notes: initialRecord.notes || "",
            height: initialRecord.height ? String(initialRecord.height) : "",
            weight: initialRecord.weight ? String(initialRecord.weight) : "",
          });
        } else {
          setForm({
            patient: patientId || null,
            practitioner: null,
            department: null,
            service_unit: null,
            status: "Admission Scheduled",
            admission_date: today,
            admission_time: nowTime,
            expected_discharge_date: "",
            chief_complaint: "",
            notes: "",
            height: "",
            weight: "",
          });
        }
      } catch (err) {
        console.error("Failed to load admission masters", err);
      } finally {
        setLoading(false);
      }
    };

    loadMasters();
  }, [open, patientId, initialRecord]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const pid = form.patient || patientId;
    if (!pid) {
      setError("Patient is required");
      return;
    }

    if (form.status === "Admitted" && !form.service_unit) {
      setError("A Service Unit (bed/ward) is required when admitting a patient immediately");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const payload: any = {
        patient: pid,
        practitioner: form.practitioner || null,
        department: form.department || null,
        service_unit: form.service_unit || null,
        status: form.status,
        admission_date: form.admission_date || today,
        admission_time: form.admission_time || null,
        expected_discharge_date: form.expected_discharge_date || null,
        chief_complaint: form.chief_complaint,
        notes: form.notes,
        height: form.height ? parseFloat(form.height) : null,
        weight: form.weight ? parseFloat(form.weight) : null,
      };

      let resultRecord: InpatientRecord;
      if (initialRecord?.id) {
        resultRecord = await HealthcareApi.inpatientRecords.update(initialRecord.id, payload);
      } else {
        resultRecord = await HealthcareApi.inpatientRecords.create(payload);
      }

      onOpenChange(false);
      onSuccess?.(resultRecord);
    } catch (err: any) {
      const msg = err?.response?.data
        ? typeof err.response.data === "object"
          ? Object.entries(err.response.data)
              .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`)
              .join("; ")
          : String(err.response.data)
        : err?.message || "Failed to save inpatient record";
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Icon icon="solar:hospital-bold" size={20} className="text-indigo-600" />
            {initialRecord ? `Edit Inpatient Record #${initialRecord.record_id || initialRecord.id}` : "Inpatient Admission (Marley Parity)"}
          </DialogTitle>
        </DialogHeader>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3.5 py-2.5 rounded-md flex items-center gap-2">
            <Icon icon="solar:danger-triangle-bold" size={16} className="text-red-500 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Icon icon="solar:refresh-circle-broken-bold" size={28} className="animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">Loading details...</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Patient Info */}
            <div className="bg-slate-50 border rounded-lg p-3">
              <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1.5">Patient Details</div>
              {patientId ? (
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-base text-foreground">{patientName || `Patient #${patientId}`}</div>
                    <div className="text-xs text-muted-foreground">ID: #{patientId}</div>
                  </div>
                  <span className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-full font-medium">
                    Inpatient Admission
                  </span>
                </div>
              ) : (
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
                  placeholder="Select Patient..."
                  emptyText="No patients found"
                />
              )}
            </div>

            {/* Status & Priority Choice */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-semibold uppercase text-muted-foreground">Admission Stage *</Label>
                <div className="grid grid-cols-2 gap-2 mt-1.5">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, status: "Admission Scheduled" })}
                    className={`py-2 px-3 rounded-md text-xs font-medium border text-center transition-all ${
                      form.status === "Admission Scheduled"
                        ? "bg-amber-50 border-amber-400 text-amber-900 shadow-sm"
                        : "bg-background border-border text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    📅 Admission Scheduled
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, status: "Admitted" })}
                    className={`py-2 px-3 rounded-md text-xs font-medium border text-center transition-all ${
                      form.status === "Admitted"
                        ? "bg-emerald-50 border-emerald-500 text-emerald-900 shadow-sm"
                        : "bg-background border-border text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    🏥 Admit Immediately
                  </button>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  {form.status === "Admission Scheduled"
                    ? "Patient will be marked 'Admission Scheduled' awaiting bed check-in."
                    : "Patient will be marked 'Admitted' and bed occupancy set to 'Occupied'."}
                </p>
              </div>

              {/* Service Unit (Bed / Ward) */}
              <div>
                <Label className="text-xs font-semibold uppercase text-muted-foreground">
                  Service Unit / Bed {form.status === "Admitted" && <span className="text-red-500">*</span>}
                </Label>
                <select
                  className="w-full border rounded-md px-3 py-2 text-sm mt-1.5 bg-background"
                  value={form.service_unit || ""}
                  onChange={(e) => setForm({ ...form, service_unit: e.target.value ? Number(e.target.value) : null })}
                  required={form.status === "Admitted"}
                >
                  <option value="">Select Service Unit / Room / Bed...</option>
                  {serviceUnits.map((su) => (
                    <option key={su.id} value={su.id}>
                      {su.service_unit_name} — {su.occupancy_status || "Vacant"}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Assign patient to a specific ward, room, or bed.
                </p>
              </div>
            </div>

            {/* Practitioner & Department */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-semibold uppercase text-muted-foreground">Primary Attending Practitioner</Label>
                <select
                  className="w-full border rounded-md px-3 py-2 text-sm mt-1.5 bg-background"
                  value={form.practitioner || ""}
                  onChange={(e) => {
                    const pracId = e.target.value ? Number(e.target.value) : null;
                    const prac = practitioners.find((p) => p.id === pracId);
                    setForm({
                      ...form,
                      practitioner: pracId,
                      department: prac?.department || form.department,
                    });
                  }}
                >
                  <option value="">Select Doctor / Practitioner...</option>
                  {practitioners.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.practitioner_name} {p.designation ? `(${p.designation})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label className="text-xs font-semibold uppercase text-muted-foreground">Medical Department</Label>
                <select
                  className="w-full border rounded-md px-3 py-2 text-sm mt-1.5 bg-background"
                  value={form.department || ""}
                  onChange={(e) => setForm({ ...form, department: e.target.value ? Number(e.target.value) : null })}
                >
                  <option value="">Select Medical Department...</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.department}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label className="text-xs font-semibold uppercase text-muted-foreground">Admission Date *</Label>
                <Input
                  type="date"
                  className="mt-1.5"
                  value={form.admission_date}
                  onChange={(e) => setForm({ ...form, admission_date: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label className="text-xs font-semibold uppercase text-muted-foreground">Admission Time</Label>
                <Input
                  type="time"
                  className="mt-1.5"
                  value={form.admission_time}
                  onChange={(e) => setForm({ ...form, admission_time: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs font-semibold uppercase text-muted-foreground">Expected Discharge</Label>
                <Input
                  type="date"
                  className="mt-1.5"
                  value={form.expected_discharge_date}
                  onChange={(e) => setForm({ ...form, expected_discharge_date: e.target.value })}
                  placeholder="Optional"
                />
              </div>
            </div>

            {/* Vitals summary (Height & Weight) */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-semibold uppercase text-muted-foreground">Height (cm)</Label>
                <Input
                  type="number"
                  step="0.1"
                  placeholder="e.g. 175"
                  className="mt-1.5"
                  value={form.height}
                  onChange={(e) => setForm({ ...form, height: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs font-semibold uppercase text-muted-foreground">Weight (kg)</Label>
                <Input
                  type="number"
                  step="0.1"
                  placeholder="e.g. 70"
                  className="mt-1.5"
                  value={form.weight}
                  onChange={(e) => setForm({ ...form, weight: e.target.value })}
                />
              </div>
            </div>

            {/* Chief Complaint */}
            <div>
              <Label className="text-xs font-semibold uppercase text-muted-foreground">Chief Complaint / Admitting Diagnosis</Label>
              <textarea
                className="w-full border rounded-md px-3 py-2 text-sm mt-1.5 min-h-[60px]"
                placeholder="Primary complaint, symptoms, or reason for inpatient admission..."
                value={form.chief_complaint}
                onChange={(e) => setForm({ ...form, chief_complaint: e.target.value })}
              />
            </div>

            {/* Notes */}
            <div>
              <Label className="text-xs font-semibold uppercase text-muted-foreground">Admission Notes & Instructions</Label>
              <textarea
                className="w-full border rounded-md px-3 py-2 text-sm mt-1.5 min-h-[60px]"
                placeholder="Special nursing care instructions, dietary requirements, or clinical notes..."
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>

            <DialogFooter className="pt-3 border-t">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                {saving ? (
                  <>
                    <Icon icon="solar:refresh-circle-broken-bold" size={16} className="animate-spin mr-1.5" />
                    Saving Admission...
                  </>
                ) : (
                  <>
                    <Icon icon="solar:check-circle-bold" size={16} className="mr-1.5" />
                    {initialRecord ? "Update Record" : form.status === "Admitted" ? "Admit Patient Now" : "Schedule Admission"}
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
