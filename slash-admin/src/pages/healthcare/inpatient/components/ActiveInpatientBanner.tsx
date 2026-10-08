import { useState } from "react";
import { Icon } from "@/components/icon";
import { Button } from "@/ui/button";
import { type InpatientRecord } from "@/api/services/healthcareService";
import InpatientWorkflowModal, { type InpatientActionType } from "./InpatientWorkflowModal";
import InpatientAdmissionModal from "./InpatientAdmissionModal";

interface ActiveInpatientBannerProps {
  record: InpatientRecord;
  patientId: number;
  patientName: string;
  onRefresh: () => void;
  onViewAll?: () => void;
}

const statusBadge: Record<string, { bg: string; text: string; border: string; icon: string }> = {
  "Admission Scheduled": { bg: "bg-amber-50", text: "text-amber-800", border: "border-amber-300", icon: "solar:calendar-date-bold" },
  Admitted: { bg: "bg-red-50", text: "text-red-800", border: "border-red-300", icon: "solar:hospital-bold" },
  "Discharge Scheduled": { bg: "bg-blue-50", text: "text-blue-800", border: "border-blue-300", icon: "solar:logout-bold" },
};

export default function ActiveInpatientBanner({
  record,
  patientId,
  patientName,
  onRefresh,
  onViewAll,
}: ActiveInpatientBannerProps) {
  const [workflowAction, setWorkflowAction] = useState<InpatientActionType | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);

  const meta = statusBadge[record.status] || {
    bg: "bg-slate-50",
    text: "text-slate-800",
    border: "border-slate-300",
    icon: "solar:hospital-bold",
  };

  return (
    <>
      <div className={`rounded-xl border p-4 shadow-xs transition-all ${meta.bg} ${meta.border}`}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Left info */}
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-white/80 border flex items-center justify-center text-indigo-600 shadow-2xs shrink-0">
              <Icon icon={meta.icon} size={24} />
            </div>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold text-sm text-foreground">
                  {record.service_unit_name || "Unassigned Bed / Ward"}
                </span>
                <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${meta.text} ${meta.border} bg-white/90`}>
                  {record.status}
                </span>
                <span className="font-mono text-xs text-muted-foreground bg-white/60 px-2 py-0.5 rounded border">
                  {record.record_id || `#${record.id}`}
                </span>
              </div>

              <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 pt-0.5">
                {record.practitioner_name && (
                  <span className="flex items-center gap-1">
                    <Icon icon="solar:stethoscope-bold" size={13} className="text-indigo-500" />
                    Doctor: <strong className="text-foreground">{record.practitioner_name}</strong>
                  </span>
                )}
                {record.department_name && (
                  <span className="flex items-center gap-1">
                    <Icon icon="solar:buildings-bold" size={13} className="text-blue-500" />
                    Dept: <strong className="text-foreground">{record.department_name}</strong>
                  </span>
                )}
                {record.admission_date && (
                  <span className="flex items-center gap-1">
                    <Icon icon="solar:calendar-bold" size={13} className="text-emerald-500" />
                    Admitted: <strong className="text-foreground">{record.admission_date} {record.admission_time || ""}</strong>
                  </span>
                )}
                {record.expected_discharge_date && (
                  <span className="flex items-center gap-1">
                    <Icon icon="solar:clock-circle-bold" size={13} className="text-amber-500" />
                    Exp. Discharge: <strong className="text-foreground">{record.expected_discharge_date}</strong>
                  </span>
                )}
              </div>

              {record.chief_complaint && (
                <p className="text-xs text-foreground/80 italic pt-1">
                  "{record.chief_complaint}"
                </p>
              )}
            </div>
          </div>

          {/* Right Workflow Actions (Marley Parity) */}
          <div className="flex flex-wrap items-center gap-2 self-end lg:self-center">
            {record.status === "Admission Scheduled" && (
              <>
                <Button
                  size="sm"
                  onClick={() => setWorkflowAction("admit")}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8 px-3 shadow-xs"
                >
                  <Icon icon="solar:login-bold" size={14} className="mr-1.5" />
                  Admit Patient
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setWorkflowAction("cancel")}
                  className="border-red-200 text-red-700 hover:bg-red-50 text-xs h-8"
                >
                  Cancel
                </Button>
              </>
            )}

            {record.status === "Admitted" && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setWorkflowAction("transfer")}
                  className="border-blue-200 text-blue-700 hover:bg-blue-50 text-xs h-8 bg-white/80"
                >
                  <Icon icon="solar:transfer-horizontal-bold" size={14} className="mr-1.5" />
                  Transfer Bed
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setWorkflowAction("schedule_discharge")}
                  className="border-indigo-200 text-indigo-700 hover:bg-indigo-50 text-xs h-8 bg-white/80"
                >
                  <Icon icon="solar:calendar-bold" size={14} className="mr-1.5" />
                  Schedule Discharge
                </Button>
                <Button
                  size="sm"
                  onClick={() => setWorkflowAction("discharge")}
                  className="bg-amber-600 hover:bg-amber-700 text-white text-xs h-8 px-3 shadow-xs"
                >
                  <Icon icon="solar:logout-bold" size={14} className="mr-1.5" />
                  Discharge
                </Button>
              </>
            )}

            {record.status === "Discharge Scheduled" && (
              <Button
                size="sm"
                onClick={() => setWorkflowAction("discharge")}
                className="bg-amber-600 hover:bg-amber-700 text-white text-xs h-8 px-3 shadow-xs"
              >
                <Icon icon="solar:logout-bold" size={14} className="mr-1.5" />
                Complete Discharge
              </Button>
            )}

            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowEditModal(true)}
              className="text-xs h-8 bg-white/80"
              title="Edit Admission Details"
            >
              <Icon icon="solar:pen-bold" size={13} className="mr-1" />
              Edit
            </Button>

            {onViewAll && (
              <Button
                size="sm"
                variant="ghost"
                onClick={onViewAll}
                className="text-xs h-8"
              >
                View History
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Workflow Modal */}
      <InpatientWorkflowModal
        open={!!workflowAction}
        onOpenChange={(v) => !v && setWorkflowAction(null)}
        record={record}
        actionType={workflowAction}
        onSuccess={onRefresh}
      />

      {/* Edit Admission Modal */}
      <InpatientAdmissionModal
        open={showEditModal}
        onOpenChange={setShowEditModal}
        patientId={patientId}
        patientName={patientName}
        initialRecord={record}
        onSuccess={onRefresh}
      />
    </>
  );
}
