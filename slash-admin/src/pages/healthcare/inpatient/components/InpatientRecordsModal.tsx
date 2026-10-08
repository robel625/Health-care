import { useState } from "react";
import { Icon } from "@/components/icon";
import { Button } from "@/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/ui/dialog";
import { type InpatientRecord, HealthcareApi } from "@/api/services/healthcareService";
import InpatientWorkflowModal, { type InpatientActionType } from "./InpatientWorkflowModal";
import InpatientAdmissionModal from "./InpatientAdmissionModal";

interface InpatientRecordsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: number;
  patientName: string;
  records: InpatientRecord[];
  onRefresh: () => void;
}

const statusBadge: Record<string, string> = {
  "Admission Scheduled": "bg-amber-100 text-amber-800 border-amber-300",
  Admitted: "bg-red-100 text-red-800 border-red-300",
  "Discharge Scheduled": "bg-blue-100 text-blue-800 border-blue-300",
  Discharged: "bg-emerald-100 text-emerald-800 border-emerald-300",
  Cancelled: "bg-gray-100 text-gray-700 border-gray-300",
};

export default function InpatientRecordsModal({
  open,
  onOpenChange,
  patientId,
  patientName,
  records,
  onRefresh,
}: InpatientRecordsModalProps) {
  const [showAdmissionModal, setShowAdmissionModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState<InpatientRecord | null>(null);

  const [workflowRecord, setWorkflowRecord] = useState<InpatientRecord | null>(null);
  const [workflowAction, setWorkflowAction] = useState<InpatientActionType | null>(null);

  const activeRecord = records.find((r) =>
    ["Admission Scheduled", "Admitted", "Discharge Scheduled"].includes(r.status)
  );

  const handleOpenWorkflow = (record: InpatientRecord, action: InpatientActionType) => {
    setWorkflowRecord(record);
    setWorkflowAction(action);
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Delete this inpatient record?")) return;
    try {
      await HealthcareApi.inpatientRecords.delete(id);
      onRefresh();
    } catch (err: any) {
      alert("Failed to delete record");
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader className="flex flex-row items-center justify-between border-b pb-3">
            <div>
              <DialogTitle className="flex items-center gap-2 text-lg">
                <Icon icon="solar:hospital-bold" size={22} className="text-indigo-600" />
                Inpatient Records — {patientName}
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Total {records.length} admission record(s) on file (Marley Parity)
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => {
                setEditingRecord(null);
                setShowAdmissionModal(true);
              }}
              className="bg-indigo-600 hover:bg-indigo-700 text-white mr-6"
            >
              <Icon icon="solar:add-circle-bold" size={16} className="mr-1.5" />
              Schedule / Admit
            </Button>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {/* Active Inpatient Banner */}
            {activeRecord && (
              <div className="bg-gradient-to-r from-indigo-50 via-blue-50 to-indigo-50 border border-indigo-200 rounded-xl p-4 shadow-xs">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700">
                      <Icon icon="solar:bed-bold" size={22} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-foreground">
                          {activeRecord.service_unit_name || "Unassigned Bed"}
                        </span>
                        <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium border ${statusBadge[activeRecord.status] || "bg-gray-100"}`}>
                          {activeRecord.status}
                        </span>
                        <span className="text-xs text-muted-foreground font-mono">
                          {activeRecord.record_id || `#${activeRecord.id}`}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap gap-x-4 gap-y-1">
                        {activeRecord.practitioner_name && (
                          <span>Dr: <strong>{activeRecord.practitioner_name}</strong></span>
                        )}
                        {activeRecord.department_name && (
                          <span>Dept: <strong>{activeRecord.department_name}</strong></span>
                        )}
                        {activeRecord.admission_date && (
                          <span>Admitted: <strong>{activeRecord.admission_date}</strong></span>
                        )}
                        {activeRecord.expected_discharge_date && (
                          <span>Exp. Discharge: <strong>{activeRecord.expected_discharge_date}</strong></span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5">
                    {activeRecord.status === "Admission Scheduled" && (
                      <>
                        <Button
                          size="sm"
                          onClick={() => handleOpenWorkflow(activeRecord, "admit")}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8"
                        >
                          <Icon icon="solar:login-bold" size={14} className="mr-1" />
                          Admit Patient
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenWorkflow(activeRecord, "cancel")}
                          className="text-red-600 border-red-200 hover:bg-red-50 text-xs h-8"
                        >
                          Cancel
                        </Button>
                      </>
                    )}

                    {activeRecord.status === "Admitted" && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenWorkflow(activeRecord, "transfer")}
                          className="text-blue-700 border-blue-200 hover:bg-blue-50 text-xs h-8"
                        >
                          <Icon icon="solar:transfer-horizontal-bold" size={14} className="mr-1" />
                          Transfer Bed
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenWorkflow(activeRecord, "schedule_discharge")}
                          className="text-indigo-700 border-indigo-200 hover:bg-indigo-50 text-xs h-8"
                        >
                          <Icon icon="solar:calendar-bold" size={14} className="mr-1" />
                          Schedule Discharge
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleOpenWorkflow(activeRecord, "discharge")}
                          className="bg-amber-600 hover:bg-amber-700 text-white text-xs h-8"
                        >
                          <Icon icon="solar:logout-bold" size={14} className="mr-1" />
                          Discharge
                        </Button>
                      </>
                    )}

                    {activeRecord.status === "Discharge Scheduled" && (
                      <Button
                        size="sm"
                        onClick={() => handleOpenWorkflow(activeRecord, "discharge")}
                        className="bg-amber-600 hover:bg-amber-700 text-white text-xs h-8"
                      >
                        <Icon icon="solar:logout-bold" size={14} className="mr-1" />
                        Complete Discharge
                      </Button>
                    )}

                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setEditingRecord(activeRecord);
                        setShowAdmissionModal(true);
                      }}
                      className="text-xs h-8"
                      title="Edit Details"
                    >
                      <Icon icon="solar:pen-bold" size={14} />
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Inpatient Records List */}
            {records.length === 0 ? (
              <div className="text-center py-10 border border-dashed rounded-lg">
                <Icon icon="solar:hospital-broken" size={36} className="mx-auto text-muted-foreground mb-2" />
                <p className="text-sm font-medium text-foreground">No Inpatient Records</p>
                <p className="text-xs text-muted-foreground mt-1 mb-4">
                  This patient currently has no past or active hospital admissions.
                </p>
                <Button
                  size="sm"
                  onClick={() => setShowAdmissionModal(true)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  <Icon icon="solar:add-circle-bold" size={16} className="mr-1.5" />
                  Schedule Inpatient Admission
                </Button>
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b text-muted-foreground font-semibold">
                    <tr>
                      <th className="py-2.5 px-3">Record ID</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Service Unit / Bed</th>
                      <th className="py-2.5 px-3">Doctor</th>
                      <th className="py-2.5 px-3">Admission</th>
                      <th className="py-2.5 px-3">Discharge</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {records.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50/50">
                        <td className="py-2.5 px-3 font-mono font-medium text-foreground">
                          {r.record_id || `#${r.id}`}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${statusBadge[r.status] || "bg-gray-100"}`}>
                            {r.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-medium">
                          {r.service_unit_name || "—"}
                        </td>
                        <td className="py-2.5 px-3 text-muted-foreground">
                          {r.practitioner_name || "—"}
                        </td>
                        <td className="py-2.5 px-3 text-muted-foreground">
                          {r.admission_date || "—"}
                        </td>
                        <td className="py-2.5 px-3 text-muted-foreground">
                          {r.discharge_date || r.expected_discharge_date ? `Exp: ${r.expected_discharge_date}` : "—"}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {r.status === "Admission Scheduled" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleOpenWorkflow(r, "admit")}
                                title="Admit"
                                className="h-7 px-2 text-emerald-600 hover:text-emerald-700"
                              >
                                <Icon icon="solar:login-bold" size={14} />
                              </Button>
                            )}
                            {r.status === "Admitted" && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleOpenWorkflow(r, "transfer")}
                                  title="Transfer Bed"
                                  className="h-7 px-2 text-blue-600 hover:text-blue-700"
                                >
                                  <Icon icon="solar:transfer-horizontal-bold" size={14} />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleOpenWorkflow(r, "discharge")}
                                  title="Discharge"
                                  className="h-7 px-2 text-amber-600 hover:text-amber-700"
                                >
                                  <Icon icon="solar:logout-bold" size={14} />
                                </Button>
                              </>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditingRecord(r);
                                setShowAdmissionModal(true);
                              }}
                              title="Edit Record"
                              className="h-7 px-2 text-muted-foreground hover:text-foreground"
                            >
                              <Icon icon="solar:pen-bold" size={14} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(r.id)}
                              title="Delete"
                              className="h-7 px-2 text-red-500 hover:text-red-700"
                            >
                              <Icon icon="solar:trash-bin-trash-bold" size={14} />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Admission Modal */}
      <InpatientAdmissionModal
        open={showAdmissionModal}
        onOpenChange={setShowAdmissionModal}
        patientId={patientId}
        patientName={patientName}
        initialRecord={editingRecord}
        onSuccess={() => {
          onRefresh();
        }}
      />

      {/* Workflow Modal */}
      <InpatientWorkflowModal
        open={!!workflowAction}
        onOpenChange={(v) => {
          if (!v) {
            setWorkflowAction(null);
            setWorkflowRecord(null);
          }
        }}
        record={workflowRecord}
        actionType={workflowAction}
        onSuccess={() => {
          onRefresh();
        }}
      />
    </>
  );
}
