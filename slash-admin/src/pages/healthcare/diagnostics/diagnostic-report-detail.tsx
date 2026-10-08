import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router";
import { Icon } from "@/components/icon";
import { Button } from "@/ui/button";
import { Card, CardContent } from "@/ui/card";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { HealthcareApi } from "@/api/services/healthcareService";
import type {
  DiagnosticReport,
  Patient,
  HealthcarePractitioner,
  Observation,
} from "@/api/services/healthcareService";

const statusColor: Record<string, string> = {
  Draft: "bg-gray-100 text-gray-700",
  Active: "bg-blue-100 text-blue-700",
  Completed: "bg-green-100 text-green-700",
  Cancelled: "bg-red-100 text-red-700",
};

export default function DiagnosticReportDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = !id || id === "new";

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" } | null>(null);

  const [patients, setPatients] = useState<Patient[]>([]);
  const [practitioners, setPractitioners] = useState<HealthcarePractitioner[]>([]);
  const [observations, setObservations] = useState<Observation[]>([]);

  const [form, setForm] = useState<Partial<DiagnosticReport>>({
    title: "",
    patient: undefined,
    practitioner: undefined,
    status: "Draft",
    ref_doctype: "Lab Test",
    docname: "",
    observation: undefined,
    sample_collection: undefined,
    notes: "",
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [ptRes, prRes, obsRes] = await Promise.all([
        HealthcareApi.patients.list({ page_size: 100 }).catch(() => ({ results: [] })),
        HealthcareApi.practitioners.list({ page_size: 100 }).catch(() => ({ results: [] })),
        HealthcareApi.observations.list({ page_size: 100 }).catch(() => ({ results: [] })),
      ]);
      setPatients(ptRes.results || []);
      setPractitioners(prRes.results || []);
      setObservations(obsRes.results || []);

      if (!isNew && id) {
        const report = await HealthcareApi.diagnosticReports.get(Number(id));
        setForm(report);
      }
    } catch (err) {
      console.error(err);
      setToast({ msg: "Failed to load report data", type: "err" });
    } finally {
      setLoading(false);
    }
  }, [id, isNew]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSave = async () => {
    if (!form.patient) {
      setToast({ msg: "Please select a patient", type: "err" });
      return;
    }
    if (!form.title) {
      setToast({ msg: "Please enter a report title", type: "err" });
      return;
    }

    setSaving(true);
    try {
      if (isNew) {
        const created = await HealthcareApi.diagnosticReports.create(form);
        setToast({ msg: "Diagnostic Report created successfully", type: "ok" });
        navigate(`/healthcare/diagnostics/reports/${created.id}`);
      } else {
        await HealthcareApi.diagnosticReports.update(Number(id), form);
        setToast({ msg: "Diagnostic Report updated successfully", type: "ok" });
      }
    } catch (err: any) {
      setToast({ msg: err?.message || "Failed to save diagnostic report", type: "err" });
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (newStatus: "Draft" | "Active" | "Completed" | "Cancelled") => {
    if (isNew) {
      setForm((prev) => ({ ...prev, status: newStatus }));
      return;
    }
    try {
      await HealthcareApi.diagnosticReports.update(Number(id), { status: newStatus });
      setForm((prev) => ({ ...prev, status: newStatus }));
      setToast({ msg: `Status updated to ${newStatus}`, type: "ok" });
    } catch (err: any) {
      setToast({ msg: err?.message || "Failed to update status", type: "err" });
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const selectedPatient = patients.find((p) => p.id === form.patient);
  const selectedPractitioner = practitioners.find((p) => p.id === form.practitioner);

  return (
    <div className="min-h-screen bg-background space-y-6">
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-2 rounded-md text-sm text-white shadow-lg cursor-pointer ${
            toast.type === "ok" ? "bg-green-600" : "bg-red-600"
          }`}
          onClick={() => setToast(null)}
        >
          {toast.msg}
        </div>
      )}

      {/* Header (hidden in print) */}
      <div className="print:hidden sticky top-0 z-10 bg-white border-b px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span
              className="text-sm text-muted-foreground cursor-pointer hover:text-foreground"
              onClick={() => navigate("/healthcare/diagnostics/reports")}
            >
              Diagnostic Reports
            </span>
            <span className="text-muted-foreground">/</span>
            <span className="text-sm font-semibold">
              {isNew ? "New Report" : form.report_id || `Report #${id}`}
            </span>
            {form.status && (
              <span
                className={`text-xs px-2 py-0.5 rounded font-medium ${
                  statusColor[form.status] || "bg-gray-100 text-gray-700"
                }`}
              >
                {form.status}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {!isNew && (
              <>
                <Button variant="outline" size="sm" onClick={handlePrint}>
                  <Icon icon="solar:printer-bold" size={16} className="mr-1.5" />
                  Print Report
                </Button>
                {form.status !== "Completed" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleStatusChange("Completed")}
                    className="text-green-600"
                  >
                    <Icon icon="solar:check-circle-bold" size={16} className="mr-1.5" />
                    Complete
                  </Button>
                )}
                {form.status !== "Cancelled" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleStatusChange("Cancelled")}
                    className="text-red-600"
                  >
                    <Icon icon="solar:close-circle-bold" size={16} className="mr-1.5" />
                    Cancel
                  </Button>
                )}
              </>
            )}
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </div>

      {/* Printable Report Document */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : (
        <div className="max-w-4xl mx-auto p-6 space-y-6">
          <Card className="print:border-none print:shadow-none">
            <CardContent className="pt-6 space-y-6">
            {/* Header info (Branding) */}
            <div className="border-b pb-4 flex justify-between items-start">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                  DIAGNOSTIC REPORT
                </h2>
                <p className="text-sm text-slate-500">
                  Healthcare Services & Diagnostics Center
                </p>
              </div>
              <div className="text-right">
                <span className="font-mono text-sm text-slate-500">
                  {form.report_id || (isNew ? "NEW DRAFT" : `HLC-DR-${id}`)}
                </span>
                <p className="text-xs text-slate-400 mt-1">
                  Generated: {new Date().toLocaleDateString()}
                </p>
              </div>
            </div>

            {/* Form Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-medium text-muted-foreground">
                  Report Title <span className="text-red-500">*</span>
                </Label>
                <Input
                  value={form.title || ""}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. Complete Blood Count (CBC) Diagnostic Report"
                  className="mt-1"
                />
              </div>

              <div>
                <Label className="text-xs font-medium text-muted-foreground">
                  Patient <span className="text-red-500">*</span>
                </Label>
                <select
                  value={form.patient || ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      patient: e.target.value ? Number(e.target.value) : undefined,
                    })
                  }
                  className="mt-1 w-full h-9 border rounded-md px-3 text-sm bg-background cursor-pointer"
                >
                  <option value="">Select Patient...</option>
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.patient_name} ({p.patient_id || `#${p.id}`})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label className="text-xs font-medium text-muted-foreground">
                  Healthcare Practitioner
                </Label>
                <select
                  value={form.practitioner || ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      practitioner: e.target.value ? Number(e.target.value) : undefined,
                    })
                  }
                  className="mt-1 w-full h-9 border rounded-md px-3 text-sm bg-background cursor-pointer"
                >
                  <option value="">Select Practitioner...</option>
                  {practitioners.map((pr) => (
                    <option key={pr.id} value={pr.id}>
                      {pr.practitioner_name || `${pr.first_name} ${pr.last_name}`}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label className="text-xs font-medium text-muted-foreground">
                  Status
                </Label>
                <select
                  value={form.status || "Draft"}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      status: e.target.value as "Draft" | "Active" | "Completed" | "Cancelled",
                    })
                  }
                  className="mt-1 w-full h-9 border rounded-md px-3 text-sm bg-background cursor-pointer"
                >
                  <option value="Draft">Draft</option>
                  <option value="Active">Active</option>
                  <option value="Completed">Completed</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </div>

              <div>
                <Label className="text-xs font-medium text-muted-foreground">
                  Linked Observation
                </Label>
                <select
                  value={form.observation || ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      observation: e.target.value ? Number(e.target.value) : undefined,
                    })
                  }
                  className="mt-1 w-full h-9 border rounded-md px-3 text-sm bg-background cursor-pointer"
                >
                  <option value="">Select Observation...</option>
                  {observations.map((obs) => (
                    <option key={obs.id} value={obs.id}>
                      {obs.observation_template_name || `Observation #${obs.id}`} - {obs.patient_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label className="text-xs font-medium text-muted-foreground">
                  Reference Document
                </Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    value={form.ref_doctype || ""}
                    onChange={(e) => setForm({ ...form, ref_doctype: e.target.value })}
                    placeholder="DocType (e.g. Lab Test)"
                    className="w-1/2"
                  />
                  <Input
                    value={form.docname || ""}
                    onChange={(e) => setForm({ ...form, docname: e.target.value })}
                    placeholder="Doc Name / ID"
                    className="w-1/2"
                  />
                </div>
              </div>
            </div>

            {/* Diagnostic Findings / Notes */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">
                Diagnostic Findings & Clinical Interpretation
              </Label>
              <textarea
                value={form.notes || ""}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={8}
                placeholder="Enter detailed laboratory findings, histological observations, diagnostic impressions, and clinical advice..."
                className="w-full border rounded-md p-3 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Sign-off section (visible for print) */}
            <div className="pt-8 border-t flex justify-between items-end">
              <div>
                <p className="text-xs text-slate-500">
                  Patient: {selectedPatient?.patient_name || form.patient_name || "—"}
                </p>
                <p className="text-xs text-slate-500">
                  Age / Gender: {selectedPatient?.age || "—"} / {selectedPatient?.sex || "—"}
                </p>
              </div>
              <div className="text-right">
                <div className="w-48 border-b border-slate-400 mb-1" />
                <p className="text-xs font-medium text-slate-700">
                  {selectedPractitioner?.practitioner_name ||
                    form.practitioner_name ||
                    "Authorized Pathologist / Radiologist"}
                </p>
                <p className="text-xs text-slate-400">Signature & Date</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      )}
    </div>
  );
}
