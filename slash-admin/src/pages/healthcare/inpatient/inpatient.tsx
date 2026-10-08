import { useState, useEffect, useCallback } from "react";
import { Icon } from "@/components/icon";
import { Button } from "@/ui/button";
import { Card, CardContent } from "@/ui/card";
import Table, { type ColumnsType } from "antd/es/table";
import { HealthcareApi } from "@/api/services/healthcareService";
import type { InpatientRecord } from "@/api/services/healthcareService";
import { useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";
import InpatientAdmissionModal from "./components/InpatientAdmissionModal";
import InpatientWorkflowModal, { type InpatientActionType } from "./components/InpatientWorkflowModal";

const statusColor: Record<string, { bg: string; text: string; border: string }> = {
  "Admission Scheduled": { bg: "bg-amber-50", text: "text-amber-800", border: "border-amber-300" },
  Admitted: { bg: "bg-red-50", text: "text-red-800", border: "border-red-300" },
  "Discharge Scheduled": { bg: "bg-blue-50", text: "text-blue-800", border: "border-blue-300" },
  Discharged: { bg: "bg-emerald-50", text: "text-emerald-800", border: "border-emerald-300" },
  Cancelled: { bg: "bg-gray-100", text: "text-gray-700", border: "border-gray-300" },
};

export default function InpatientPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const patientFilter = searchParams.get("patient");
  const practitionerFilter = searchParams.get("practitioner");

  const [data, setData] = useState<InpatientRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  // Modals
  const [showAdmissionModal, setShowAdmissionModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState<InpatientRecord | null>(null);

  const [workflowRecord, setWorkflowRecord] = useState<InpatientRecord | null>(null);
  const [workflowAction, setWorkflowAction] = useState<InpatientActionType | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const filterParams: Record<string, any> = { page, page_size: 20 };
      if (patientFilter) filterParams.patient = patientFilter;
      if (practitionerFilter) filterParams.practitioner = practitionerFilter;
      const res = await HealthcareApi.inpatientRecords.list(filterParams);
      setData(res.results || []);
      setTotal(res.count || 0);
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to load inpatient records");
    } finally {
      setLoading(false);
    }
  }, [page, patientFilter, practitionerFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleOpenWorkflow = (record: InpatientRecord, action: InpatientActionType) => {
    setWorkflowRecord(record);
    setWorkflowAction(action);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this Inpatient Record?")) return;
    try {
      await HealthcareApi.inpatientRecords.delete(id);
      toast.success("Inpatient record deleted");
      loadData();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to delete inpatient record");
    }
  };

  const admittedCount = data.filter((r) => r.status === "Admitted").length;
  const scheduledCount = data.filter((r) => r.status === "Admission Scheduled").length;
  const dischargeSchedCount = data.filter((r) => r.status === "Discharge Scheduled").length;

  const columns: ColumnsType<InpatientRecord> = [
    {
      title: "Record ID",
      dataIndex: "record_id",
      width: 130,
      render: (v: string, r) => (
        <span
          className="font-mono font-semibold text-indigo-600 hover:underline cursor-pointer"
          onClick={() => {
            setEditingRecord(r);
            setShowAdmissionModal(true);
          }}
        >
          {v || `INP-${r.id}`}
        </span>
      ),
    },
    {
      title: "Patient",
      dataIndex: "patient_name",
      width: 180,
      render: (v: string, r) => (
        <div>
          <span
            className="font-medium text-foreground hover:underline cursor-pointer"
            onClick={() => navigate(`/healthcare/patients/${r.patient}`)}
          >
            {v || `Patient #${r.patient}`}
          </span>
          {r.patient && (
            <div className="text-xs text-muted-foreground">ID: #{r.patient}</div>
          )}
        </div>
      ),
    },
    {
      title: "Ward / Bed",
      dataIndex: "service_unit_name",
      width: 170,
      render: (v: string) =>
        v ? (
          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-800">
            <Icon icon="solar:bed-bold" size={14} className="text-indigo-500 shrink-0" />
            <span>{v}</span>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground italic">Unassigned</span>
        ),
    },
    {
      title: "Practitioner",
      dataIndex: "practitioner_name",
      width: 170,
      render: (v: string) => v || "—",
    },
    {
      title: "Admission Date",
      dataIndex: "admission_date",
      width: 140,
      render: (v: string, r) => (
        <div className="text-xs">
          <div className="font-medium text-foreground">{v || "—"}</div>
          {r.admission_time && <div className="text-muted-foreground">{r.admission_time}</div>}
        </div>
      ),
    },
    {
      title: "Discharge Date",
      dataIndex: "discharge_date",
      width: 140,
      render: (v: string, r) => (
        <div className="text-xs">
          <div className="font-medium text-foreground">{v || (r.expected_discharge_date ? `Exp: ${r.expected_discharge_date}` : "—")}</div>
          {r.discharge_time && <div className="text-muted-foreground">{r.discharge_time}</div>}
        </div>
      ),
    },
    {
      title: "Status",
      dataIndex: "status",
      width: 160,
      render: (v: string) => {
        const meta = statusColor[v] || { bg: "bg-gray-100", text: "text-gray-700", border: "border-gray-300" };
        return (
          <span className={`text-xs px-2.5 py-1 rounded-full font-semibold border ${meta.bg} ${meta.text} ${meta.border}`}>
            {v}
          </span>
        );
      },
    },
    {
      title: "Actions",
      width: 200,
      fixed: "right",
      render: (_, r) => (
        <div className="flex items-center gap-1">
          {/* Marley Parity Workflow Actions */}
          {r.status === "Admission Scheduled" && (
            <>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                onClick={() => handleOpenWorkflow(r, "admit")}
              >
                <Icon icon="solar:hospital-bold" size={13} className="mr-1" />
                Admit
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-rose-600 hover:bg-rose-50"
                onClick={() => handleOpenWorkflow(r, "cancel")}
              >
                Cancel
              </Button>
            </>
          )}

          {r.status === "Admitted" && (
            <>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs border-blue-200 text-blue-700 hover:bg-blue-50"
                onClick={() => handleOpenWorkflow(r, "transfer")}
                title="Transfer to another Bed / Ward"
              >
                <Icon icon="solar:transfer-horizontal-bold" size={13} className="mr-1" />
                Transfer
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                onClick={() => handleOpenWorkflow(r, "discharge")}
              >
                <Icon icon="solar:logout-bold" size={13} className="mr-1" />
                Discharge
              </Button>
            </>
          )}

          {r.status === "Discharge Scheduled" && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs border-emerald-200 text-emerald-700 hover:bg-emerald-50"
              onClick={() => handleOpenWorkflow(r, "discharge")}
            >
              <Icon icon="solar:logout-bold" size={13} className="mr-1" />
              Complete Discharge
            </Button>
          )}

          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            title="Edit details"
            onClick={() => {
              setEditingRecord(r);
              setShowAdmissionModal(true);
            }}
          >
            <Icon icon="solar:pen-bold" size={14} />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-red-500 hover:bg-red-50 hover:text-red-700"
            title="Delete Record"
            onClick={() => handleDelete(r.id)}
          >
            <Icon icon="solar:trash-bin-trash-bold" size={14} />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Active Filter Bar */}
      {(patientFilter || practitionerFilter) && (
        <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-700">
          <Icon icon="solar:filter-bold" size={16} />
          <span>Filtered by: {patientFilter ? `Patient #${patientFilter}` : `Practitioner #${practitionerFilter}`}</span>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto text-blue-700"
            onClick={() => navigate("/healthcare/inpatient")}
          >
            Clear Filter
          </Button>
        </div>
      )}

      {/* Header and Quick Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">Inpatient Records</h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-semibold border border-indigo-200">
              Marley Parity
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage hospital admissions, bed occupancy, ward transfers, and patient discharges.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => {
              setEditingRecord(null);
              setShowAdmissionModal(true);
            }}
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            <Icon icon="solar:add-circle-bold" size={18} className="mr-1.5" />
            Schedule Admission / Admit
          </Button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-slate-200">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 shrink-0">
              <Icon icon="solar:hospital-bold" size={20} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Inpatient</p>
              <p className="text-xl font-bold">{total}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-red-200 bg-red-50/20">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-50 border border-red-200 flex items-center justify-center text-red-600 shrink-0">
              <Icon icon="solar:bed-bold" size={20} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Currently Admitted</p>
              <p className="text-xl font-bold text-red-700">{admittedCount}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-amber-200 bg-amber-50/20">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shrink-0">
              <Icon icon="solar:calendar-date-bold" size={20} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Admission Scheduled</p>
              <p className="text-xl font-bold text-amber-700">{scheduledCount}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-blue-200 bg-blue-50/20">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shrink-0">
              <Icon icon="solar:logout-bold" size={20} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Discharge Scheduled</p>
              <p className="text-xl font-bold text-blue-700">{dischargeSchedCount}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Table */}
      <Card>
        <CardContent className="pt-6">
          <Table
            columns={columns}
            dataSource={data}
            rowKey="id"
            loading={loading}
            scroll={{ x: 1000 }}
            pagination={{
              current: page,
              total,
              pageSize: 20,
              onChange: setPage,
              showTotal: (t) => `Total ${t} admissions`,
            }}
          />
        </CardContent>
      </Card>

      {/* Inpatient Admission / Edit Modal */}
      <InpatientAdmissionModal
        open={showAdmissionModal}
        onOpenChange={setShowAdmissionModal}
        patientId={patientFilter ? Number(patientFilter) : undefined}
        initialRecord={editingRecord}
        onSuccess={() => {
          loadData();
        }}
      />

      {/* Inpatient Workflow Modal */}
      <InpatientWorkflowModal
        open={Boolean(workflowRecord && workflowAction)}
        onOpenChange={(open) => {
          if (!open) {
            setWorkflowRecord(null);
            setWorkflowAction(null);
          }
        }}
        record={workflowRecord}
        actionType={workflowAction}
        onSuccess={() => {
          loadData();
        }}
      />
    </div>
  );
}
