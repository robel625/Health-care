import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/ui/dialog";
import { Button } from "@/ui/button";
import { Label } from "@/ui/label";
import { Input } from "@/ui/input";
import { Icon } from "@/components/icon";
import { Badge } from "@/ui/badge";
import { toast } from "sonner";
import {
  HealthcareApi,
  type Patient,
  type HealthcarePractitioner,
  type TherapyType,
} from "@/api/services/healthcareService";

interface NewTherapyPlanModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultPatientId?: number;
  defaultPatientName?: string;
  onSuccess?: () => void;
}

export default function NewTherapyPlanModal({
  open,
  onOpenChange,
  defaultPatientId,
  defaultPatientName,
  onSuccess,
}: NewTherapyPlanModalProps) {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [practitioners, setPractitioners] = useState<HealthcarePractitioner[]>([]);
  const [therapyTypes, setTherapyTypes] = useState<TherapyType[]>([]);

  const [patientId, setPatientId] = useState<number | undefined>(defaultPatientId);
  const [practitionerId, setPractitionerId] = useState<number | undefined>();
  const [therapyTypeId, setTherapyTypeId] = useState<number | undefined>();
  const [title, setTitle] = useState("");
  const [totalSessions, setTotalSessions] = useState<number>(10);
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState(
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
  );
  const [goals, setGoals] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      if (defaultPatientId) {
        setPatientId(defaultPatientId);
      }

      HealthcareApi.patients.list({ page_size: 50 })
        .then((res: any) => setPatients(res.results || []))
        .catch(console.error);

      HealthcareApi.practitioners.list({ page_size: 50 })
        .then((res: any) => {
          const list = res.results || [];
          setPractitioners(list);
          if (list.length > 0 && !practitionerId) {
            setPractitionerId(list[0].id);
          }
        })
        .catch(console.error);

      HealthcareApi.therapyTypes.list({ page_size: 50 })
        .then((res: any) => {
          const list = res.results || [];
          setTherapyTypes(list);
          if (list.length > 0 && !therapyTypeId) {
            setTherapyTypeId(list[0].id);
            if (!title) {
              setTitle(`${list[0].therapy_type} Rehabilitation Plan`);
            }
          }
        })
        .catch(console.error);
    }
  }, [open, defaultPatientId]);

  const handleTherapyTypeChange = (id: number) => {
    setTherapyTypeId(id);
    const selected = therapyTypes.find((t) => t.id === id);
    if (selected && (!title || title.includes("Rehabilitation Plan"))) {
      setTitle(`${selected.therapy_type} Rehabilitation Plan`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientId) {
      toast.error("Please select a patient.");
      return;
    }
    if (!title.trim()) {
      toast.error("Please enter a plan title.");
      return;
    }

    setSaving(true);
    try {
      await HealthcareApi.therapyPlans.create({
        patient: patientId,
        practitioner: practitionerId || null,
        therapy_type: therapyTypeId || null,
        title: title.trim(),
        total_sessions: totalSessions || 1,
        start_date: startDate,
        end_date: endDate,
        goals: goals.trim(),
        notes: notes.trim(),
        status: "Active",
      } as any);

      toast.success("Therapy Plan created successfully.");
      onOpenChange(false);
      onSuccess?.();
    } catch (err: any) {
      console.error(err);
      toast.error(
        err?.response?.data?.detail ||
          err?.response?.data?.error ||
          "Failed to create therapy plan."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2 text-teal-600 dark:text-teal-400">
            <Icon icon="solar:meditation-bold-duotone" size={24} />
            <DialogTitle className="text-lg font-bold">New Therapy Plan</DialogTitle>
          </div>
          <p className="text-xs text-muted-foreground">
            Prescribe a structured rehab or physiotherapy program, set clinical goals, and track treatment progress.
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2 text-xs">
          {/* Patient Selection */}
          <div>
            <Label className="text-xs font-semibold">Patient</Label>
            {defaultPatientId && defaultPatientName ? (
              <div className="mt-1 flex items-center justify-between p-2 rounded-md bg-muted/60 border border-border">
                <div className="flex items-center gap-2">
                  <Icon icon="solar:user-bold" size={16} className="text-muted-foreground" />
                  <span className="font-semibold text-foreground">{defaultPatientName}</span>
                  <span className="text-[10px] text-muted-foreground font-mono">#{defaultPatientId}</span>
                </div>
                <Badge variant="outline" className="text-[10px]">Pre-selected</Badge>
              </div>
            ) : (
              <select
                className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={patientId || ""}
                onChange={(e) => setPatientId(Number(e.target.value))}
                required
              >
                <option value="">Select Patient...</option>
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.patient_name || `${p.first_name || ""} ${p.last_name || ""}`.trim()} (#{p.id})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Therapy Type & Practitioner */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-semibold">Therapy Type *</Label>
              <select
                className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={therapyTypeId || ""}
                onChange={(e) => handleTherapyTypeChange(Number(e.target.value))}
                required
              >
                <option value="">Select Therapy Type...</option>
                {therapyTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.therapy_type}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs font-semibold">Attending Therapist / Doctor</Label>
              <select
                className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={practitionerId || ""}
                onChange={(e) => setPractitionerId(Number(e.target.value))}
              >
                <option value="">Select Practitioner...</option>
                {practitioners.map((pr) => (
                  <option key={pr.id} value={pr.id}>
                    {pr.practitioner_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Title */}
          <div>
            <Label className="text-xs font-semibold">Plan Title *</Label>
            <Input
              className="mt-1 h-9 text-xs"
              placeholder="e.g. Post-Op Knee Strengthening & Gait Training"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          {/* Total Sessions, Start Date, End Date */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs font-semibold">Total Sessions</Label>
              <Input
                type="number"
                min="1"
                className="mt-1 h-9 text-xs"
                value={totalSessions}
                onChange={(e) => setTotalSessions(Number(e.target.value) || 1)}
                required
              />
            </div>
            <div>
              <Label className="text-xs font-semibold">Start Date</Label>
              <Input
                type="date"
                className="mt-1 h-9 text-xs"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>
            <div>
              <Label className="text-xs font-semibold">Target End Date</Label>
              <Input
                type="date"
                className="mt-1 h-9 text-xs"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          {/* Rehabilitation Goals */}
          <div>
            <Label className="text-xs font-semibold">Rehabilitation Goals</Label>
            <textarea
              className="mt-1 flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-xs shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              placeholder="e.g. Restore full active ROM in left knee, normalize gait pattern, pain score < 2."
              value={goals}
              onChange={(e) => setGoals(e.target.value)}
            />
          </div>

          {/* Notes */}
          <div>
            <Label className="text-xs font-semibold">Clinical Notes / Instructions</Label>
            <textarea
              className="mt-1 flex min-h-[50px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-xs shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              placeholder="e.g. Monitor vitals before and after treadmill session. Cryotherapy post-exercise."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-teal-600 hover:bg-teal-700 text-white"
              disabled={saving}
            >
              {saving ? "Creating..." : "Create Therapy Plan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
