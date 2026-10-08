import { useState, useEffect } from "react";
import { Icon } from "@/components/icon";
import { Button } from "@/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/ui/dialog";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { HealthcareApi, type InpatientRecord, type HealthcareServiceUnit, type HealthcarePractitioner } from "@/api/services/healthcareService";

export type InpatientActionType = "admit" | "transfer" | "schedule_discharge" | "discharge" | "cancel";

interface InpatientWorkflowModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record: InpatientRecord | null;
  actionType: InpatientActionType | null;
  onSuccess?: () => void;
}

export default function InpatientWorkflowModal({
  open,
  onOpenChange,
  record,
  actionType,
  onSuccess,
}: InpatientWorkflowModalProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [serviceUnits, setServiceUnits] = useState<HealthcareServiceUnit[]>([]);
  const [practitioners, setPractitioners] = useState<HealthcarePractitioner[]>([]);

  const today = new Date().toISOString().split("T")[0];

  const [serviceUnitId, setServiceUnitId] = useState<number | null>(null);
  const [practitionerId, setPractitionerId] = useState<number | null>(null);
  const [expectedDischargeDate, setExpectedDischargeDate] = useState("");
  const [dischargeSummary, setDischargeSummary] = useState("");

  useEffect(() => {
    if (!open || !record) return;
    setError(null);
    setServiceUnitId(record.service_unit || null);
    setPractitionerId(record.practitioner || null);
    setExpectedDischargeDate(record.expected_discharge_date || "");
    setDischargeSummary(record.discharge_summary || "");

    if (actionType === "admit" || actionType === "transfer") {
      setLoading(true);
      Promise.all([
        HealthcareApi.serviceUnits.list({ page_size: 200 }).catch(() => ({ results: [] })),
        HealthcareApi.practitioners.list({ page_size: 200 }).catch(() => ({ results: [] })),
      ])
        .then(([suRes, pracRes]) => {
          if (suRes.results) setServiceUnits(suRes.results);
          if (pracRes.results) setPractitioners(pracRes.results);
        })
        .finally(() => setLoading(false));
    }
  }, [open, record, actionType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!record) return;

    setSaving(true);
    setError(null);
    try {
      if (actionType === "admit") {
        if (!serviceUnitId) {
          setError("Service Unit (bed/ward) is required to admit the patient");
          setSaving(false);
          return;
        }
        await HealthcareApi.inpatientRecords.admit(record.id, {
          service_unit: serviceUnitId,
          practitioner: practitionerId,
          expected_discharge_date: expectedDischargeDate || null,
        });
      } else if (actionType === "transfer") {
        if (!serviceUnitId) {
          setError("Please select the target Service Unit for transfer");
          setSaving(false);
          return;
        }
        await HealthcareApi.inpatientRecords.transfer(record.id, {
          service_unit: serviceUnitId,
        });
      } else if (actionType === "schedule_discharge") {
        await HealthcareApi.inpatientRecords.scheduleDischarge(record.id, {
          expected_discharge_date: expectedDischargeDate || today,
          discharge_summary: dischargeSummary,
        });
      } else if (actionType === "discharge") {
        await HealthcareApi.inpatientRecords.discharge(record.id, {
          discharge_summary: dischargeSummary,
        });
      } else if (actionType === "cancel") {
        await HealthcareApi.inpatientRecords.cancelAdmission(record.id);
      }

      onOpenChange(false);
      onSuccess?.();
    } catch (err: any) {
      const msg = err?.response?.data
        ? typeof err.response.data === "object"
          ? Object.entries(err.response.data)
              .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`)
              .join("; ")
          : String(err.response.data)
        : err?.message || "Action failed";
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const getTitle = () => {
    switch (actionType) {
      case "admit": return "Admit Patient to Bed / Ward";
      case "transfer": return "Transfer Patient (Change Service Unit)";
      case "schedule_discharge": return "Schedule Inpatient Discharge";
      case "discharge": return "Complete Inpatient Discharge";
      case "cancel": return "Cancel Inpatient Admission";
      default: return "Inpatient Action";
    }
  };

  const getButtonLabel = () => {
    switch (actionType) {
      case "admit": return "Confirm Admission";
      case "transfer": return "Transfer Patient";
      case "schedule_discharge": return "Schedule Discharge";
      case "discharge": return "Discharge Patient";
      case "cancel": return "Cancel Admission";
      default: return "Confirm";
    }
  };

  const getButtonClass = () => {
    switch (actionType) {
      case "admit": return "bg-emerald-600 hover:bg-emerald-700 text-white";
      case "transfer": return "bg-blue-600 hover:bg-blue-700 text-white";
      case "schedule_discharge": return "bg-indigo-600 hover:bg-indigo-700 text-white";
      case "discharge": return "bg-amber-600 hover:bg-amber-700 text-white";
      case "cancel": return "bg-red-600 hover:bg-red-700 text-white";
      default: return "bg-primary text-primary-foreground";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Icon icon="solar:hospital-bold" size={18} className="text-indigo-600" />
            {getTitle()}
          </DialogTitle>
        </DialogHeader>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded-md">
            {error}
          </div>
        )}

        {record && (
          <form onSubmit={handleSubmit} className="space-y-4 pt-1">
            {/* Context Box */}
            <div className="bg-slate-50 border rounded-lg p-3 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Patient:</span>
                <span className="font-semibold text-foreground">{record.patient_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Record ID:</span>
                <span className="font-mono text-muted-foreground">{record.record_id || `#${record.id}`}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Current Status:</span>
                <span className="font-medium text-foreground">{record.status}</span>
              </div>
              {record.service_unit_name && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Current Service Unit:</span>
                  <span className="font-medium text-foreground">{record.service_unit_name}</span>
                </div>
              )}
            </div>

            {/* ADMIT FORM */}
            {actionType === "admit" && (
              <>
                <div>
                  <Label className="text-xs font-semibold uppercase text-muted-foreground">Assign Service Unit / Bed *</Label>
                  <select
                    className="w-full border rounded-md px-3 py-2 text-sm mt-1 bg-background"
                    value={serviceUnitId || ""}
                    onChange={(e) => setServiceUnitId(e.target.value ? Number(e.target.value) : null)}
                    required
                  >
                    <option value="">Select Bed / Ward...</option>
                    {serviceUnits.map((su) => (
                      <option key={su.id} value={su.id}>
                        {su.service_unit_name} ({su.occupancy_status || "Vacant"})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <Label className="text-xs font-semibold uppercase text-muted-foreground">Attending Practitioner</Label>
                  <select
                    className="w-full border rounded-md px-3 py-2 text-sm mt-1 bg-background"
                    value={practitionerId || ""}
                    onChange={(e) => setPractitionerId(e.target.value ? Number(e.target.value) : null)}
                  >
                    <option value="">Select Practitioner...</option>
                    {practitioners.map((p) => (
                      <option key={p.id} value={p.id}>{p.practitioner_name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <Label className="text-xs font-semibold uppercase text-muted-foreground">Expected Discharge Date</Label>
                  <Input
                    type="date"
                    className="mt-1"
                    value={expectedDischargeDate}
                    onChange={(e) => setExpectedDischargeDate(e.target.value)}
                  />
                </div>
              </>
            )}

            {/* TRANSFER FORM */}
            {actionType === "transfer" && (
              <div>
                <Label className="text-xs font-semibold uppercase text-muted-foreground">Transfer to New Service Unit / Bed *</Label>
                <select
                  className="w-full border rounded-md px-3 py-2 text-sm mt-1 bg-background"
                  value={serviceUnitId || ""}
                  onChange={(e) => setServiceUnitId(e.target.value ? Number(e.target.value) : null)}
                  required
                >
                  <option value="">Select New Ward / Room / Bed...</option>
                  {serviceUnits
                    .filter((su) => su.id !== record.service_unit)
                    .map((su) => (
                      <option key={su.id} value={su.id}>
                        {su.service_unit_name} ({su.occupancy_status || "Vacant"})
                      </option>
                    ))}
                </select>
                <p className="text-[11px] text-muted-foreground mt-1">
                  The previous bed ({record.service_unit_name || "current"}) will be marked 'Vacant', and the new bed will become 'Occupied'.
                </p>
              </div>
            )}

            {/* SCHEDULE DISCHARGE FORM */}
            {actionType === "schedule_discharge" && (
              <>
                <div>
                  <Label className="text-xs font-semibold uppercase text-muted-foreground">Expected Discharge Date</Label>
                  <Input
                    type="date"
                    className="mt-1"
                    value={expectedDischargeDate}
                    onChange={(e) => setExpectedDischargeDate(e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold uppercase text-muted-foreground">Discharge Summary / Clinical Notes</Label>
                  <textarea
                    className="w-full border rounded-md px-3 py-2 text-sm mt-1 min-h-[80px]"
                    placeholder="Clinical condition at discharge, medications, follow-up instructions..."
                    value={dischargeSummary}
                    onChange={(e) => setDischargeSummary(e.target.value)}
                  />
                </div>
              </>
            )}

            {/* DISCHARGE FORM */}
            {actionType === "discharge" && (
              <>
                <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs p-3 rounded-md">
                  <strong>Discharge Confirmation:</strong> This will complete the inpatient record, free the assigned service unit ({record.service_unit_name || "bed"}), and clear the patient's active inpatient status.
                </div>
                <div>
                  <Label className="text-xs font-semibold uppercase text-muted-foreground">Discharge Summary</Label>
                  <textarea
                    className="w-full border rounded-md px-3 py-2 text-sm mt-1 min-h-[90px]"
                    placeholder="Final discharge summary, condition on discharge, advice on discharge..."
                    value={dischargeSummary}
                    onChange={(e) => setDischargeSummary(e.target.value)}
                  />
                </div>
              </>
            )}

            {/* CANCEL ADMISSION FORM */}
            {actionType === "cancel" && (
              <div className="bg-red-50 border border-red-200 text-red-800 text-xs p-3 rounded-md">
                <strong>Warning:</strong> This will cancel the scheduled admission order and clear the patient's inpatient status.
              </div>
            )}

            <DialogFooter className="pt-3 border-t">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving || loading} className={getButtonClass()}>
                {saving ? (
                  <>
                    <Icon icon="solar:refresh-circle-broken-bold" size={16} className="animate-spin mr-1.5" />
                    Processing...
                  </>
                ) : (
                  getButtonLabel()
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
