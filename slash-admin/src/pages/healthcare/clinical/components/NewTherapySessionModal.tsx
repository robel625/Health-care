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
  type TherapyPlan,
} from "@/api/services/healthcareService";

interface NewTherapySessionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultPatientId?: number;
  defaultPatientName?: string;
  defaultPlanId?: number;
  onSuccess?: () => void;
}

export default function NewTherapySessionModal({
  open,
  onOpenChange,
  defaultPatientId,
  defaultPatientName,
  defaultPlanId,
  onSuccess,
}: NewTherapySessionModalProps) {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [practitioners, setPractitioners] = useState<HealthcarePractitioner[]>([]);
  const [therapyTypes, setTherapyTypes] = useState<TherapyType[]>([]);
  const [plans, setPlans] = useState<TherapyPlan[]>([]);

  const [patientId, setPatientId] = useState<number | undefined>(defaultPatientId);
  const [planId, setPlanId] = useState<number | undefined>(defaultPlanId);
  const [practitionerId, setPractitionerId] = useState<number | undefined>();
  const [therapyTypeId, setTherapyTypeId] = useState<number | undefined>();
  const [sessionDate, setSessionDate] = useState(new Date().toISOString().split("T")[0]);
  const [sessionTime, setSessionTime] = useState("10:00");
  const [duration, setDuration] = useState<number>(45);
  const [status, setStatus] = useState("Scheduled");
  const [notes, setNotes] = useState("");
  const [exercisesPerformed, setExercisesPerformed] = useState("");
  const [patientResponse, setPatientResponse] = useState("");
  const [nextSessionDate, setNextSessionDate] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      if (defaultPatientId) setPatientId(defaultPatientId);
      if (defaultPlanId) setPlanId(defaultPlanId);

      HealthcareApi.patients.list({ page_size: 50 })
        .then((res: any) => setPatients(res.results || []))
        .catch(console.error);

      HealthcareApi.practitioners.list({ page_size: 50 })
        .then((res: any) => setPractitioners(res.results || []))
        .catch(console.error);

      HealthcareApi.therapyTypes.list({ page_size: 50 })
        .then((res: any) => setTherapyTypes(res.results || []))
        .catch(console.error);
    }
  }, [open, defaultPatientId, defaultPlanId]);

  // Load plans for the selected patient
  useEffect(() => {
    if (open && patientId) {
      HealthcareApi.therapyPlans.list({ patient: patientId, page_size: 50 })
        .then((res) => {
          const list = res.results || [];
          setPlans(list);
          if (defaultPlanId) {
            const p = list.find((item) => item.id === defaultPlanId);
            if (p) {
              setPlanId(p.id);
              if ((p as any).therapy_type) setTherapyTypeId((p as any).therapy_type);
              if ((p as any).practitioner) setPractitionerId((p as any).practitioner);
            }
          } else if (list.length > 0 && !planId) {
            setPlanId(list[0].id);
            if ((list[0] as any).therapy_type) setTherapyTypeId((list[0] as any).therapy_type);
            if ((list[0] as any).practitioner) setPractitionerId((list[0] as any).practitioner);
          }
        })
        .catch(console.error);
    }
  }, [open, patientId, defaultPlanId]);

  const handlePlanChange = (pId: number) => {
    setPlanId(pId);
    const chosen = plans.find((p) => p.id === pId);
    if (chosen) {
      if ((chosen as any).therapy_type) setTherapyTypeId((chosen as any).therapy_type);
      if ((chosen as any).practitioner) setPractitionerId((chosen as any).practitioner);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientId) {
      toast.error("Please select a patient.");
      return;
    }

    setSaving(true);
    try {
      await HealthcareApi.therapySessions.create({
        patient: patientId,
        plan: planId || null,
        practitioner: practitionerId || null,
        therapy_type: therapyTypeId || null,
        session_date: sessionDate,
        session_time: sessionTime || null,
        duration: duration || 45,
        status,
        notes: notes.trim(),
        exercises_performed: exercisesPerformed.trim(),
        patient_response: patientResponse.trim(),
        next_session_date: nextSessionDate || null,
      } as any);

      toast.success(
        status === "Completed"
          ? "Therapy Session recorded as Completed. Plan progress updated."
          : "Therapy Session scheduled successfully."
      );
      onOpenChange(false);
      onSuccess?.();
    } catch (err: any) {
      console.error(err);
      toast.error(
        err?.response?.data?.detail ||
          err?.response?.data?.error ||
          "Failed to schedule therapy session."
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
            <Icon icon="solar:stopwatch-bold-duotone" size={24} />
            <DialogTitle className="text-lg font-bold">Schedule / Log Therapy Session</DialogTitle>
          </div>
          <p className="text-xs text-muted-foreground">
            Schedule an appointment or log a completed therapy session against a rehabilitation plan.
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

          {/* Linked Therapy Plan */}
          <div>
            <Label className="text-xs font-semibold">Linked Therapy Plan</Label>
            <select
              className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={planId || ""}
              onChange={(e) => handlePlanChange(Number(e.target.value))}
            >
              <option value="">Select Therapy Plan (Optional)...</option>
              {plans.map((pl) => (
                <option key={pl.id} value={pl.id}>
                  {pl.plan_id || `#${pl.id}`} - {pl.title} ({pl.completed_sessions || 0}/{pl.total_sessions || 0} sessions)
                </option>
              ))}
            </select>
          </div>

          {/* Therapy Type & Attending Therapist */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-semibold">Therapy Type *</Label>
              <select
                className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={therapyTypeId || ""}
                onChange={(e) => setTherapyTypeId(Number(e.target.value))}
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
              <Label className="text-xs font-semibold">Therapist / Practitioner</Label>
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

          {/* Date, Time, Duration */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs font-semibold">Session Date *</Label>
              <Input
                type="date"
                className="mt-1 h-9 text-xs"
                value={sessionDate}
                onChange={(e) => setSessionDate(e.target.value)}
                required
              />
            </div>
            <div>
              <Label className="text-xs font-semibold">Time</Label>
              <Input
                type="time"
                className="mt-1 h-9 text-xs"
                value={sessionTime}
                onChange={(e) => setSessionTime(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs font-semibold">Duration (Min)</Label>
              <Input
                type="number"
                min="10"
                step="5"
                className="mt-1 h-9 text-xs"
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value) || 45)}
                required
              />
            </div>
          </div>

          {/* Status & Next Session */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-semibold">Session Status</Label>
              <select
                className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="Scheduled">Scheduled (Upcoming)</option>
                <option value="Completed">Completed (Fulfilled)</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>
            <div>
              <Label className="text-xs font-semibold">Next Session Date</Label>
              <Input
                type="date"
                className="mt-1 h-9 text-xs"
                value={nextSessionDate}
                onChange={(e) => setNextSessionDate(e.target.value)}
              />
            </div>
          </div>

          {/* Exercises / Modalities Performed */}
          <div>
            <Label className="text-xs font-semibold">Exercises / Modalities Performed</Label>
            <textarea
              className="mt-1 flex min-h-[50px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-xs shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              placeholder="e.g. Quadriceps sets 3x10, straight leg raises, ultrasound therapy 5 mins."
              value={exercisesPerformed}
              onChange={(e) => setExercisesPerformed(e.target.value)}
            />
          </div>

          {/* Patient Response / Progress */}
          <div>
            <Label className="text-xs font-semibold">Patient Response & Functional Progress</Label>
            <textarea
              className="mt-1 flex min-h-[50px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-xs shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              placeholder="e.g. Patient tolerated exercise well with mild fatigue. ROM improved to 105 degrees."
              value={patientResponse}
              onChange={(e) => setPatientResponse(e.target.value)}
            />
          </div>

          {/* Clinical Notes */}
          <div>
            <Label className="text-xs font-semibold">Clinical Notes</Label>
            <textarea
              className="mt-1 flex min-h-[45px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-xs shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              placeholder="e.g. General observations, precautions, tolerance..."
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
              {saving ? "Saving..." : status === "Completed" ? "Complete & Log Session" : "Schedule Session"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
