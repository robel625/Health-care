import { useState, useEffect, useCallback } from "react";
import { Icon } from "@/components/icon";
import { Button } from "@/ui/button";
import { Card, CardContent } from "@/ui/card";
import Table, { type ColumnsType } from "antd/es/table";
import { HealthcareApi } from "@/api/services/healthcareService";

const statusColor: Record<string, string> = {
  Open: "bg-blue-100 text-blue-700", "In Treatment": "bg-yellow-100 text-yellow-700",
  Discharged: "bg-green-100 text-green-700", Admitted: "bg-red-100 text-red-700",
};

export default function EmergencyPage() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await HealthcareApi.emergencyRecords.list({ page }) as any;
      setData(res.results || []); setTotal(res.count || 0);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [page]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleAction = async (id: number, action: "triage" | "discharge" | "admit") => {
    if (!confirm(`Perform ${action}?`)) return;
    if (action === "triage") await HealthcareApi.emergencyRecords.triage(id);
    else if (action === "discharge") await HealthcareApi.emergencyRecords.discharge(id);
    else await HealthcareApi.emergencyRecords.admit(id);
    loadData();
  };
  const handleDelete = async (id: number) => { if (confirm("Delete?")) { await HealthcareApi.emergencyRecords.delete(id); loadData(); } };

  const columns: ColumnsType<any> = [
    { title: "Record", dataIndex: "record_id", width: 140 },
    { title: "Patient", dataIndex: "patient_name", width: 180 },
    { title: "Arrival", dataIndex: "arrival_datetime", width: 160, render: (v: string) => v ? new Date(v).toLocaleString() : "-" },
    { title: "Mode", dataIndex: "arrival_mode", width: 100 },
    { title: "Triage", dataIndex: "triage_level_name", width: 100 },
    { title: "Complaint", dataIndex: "chief_complaint", width: 200, ellipsis: true },
    { title: "Attending", dataIndex: "attending_practitioner_name", width: 180 },
    { title: "Department", dataIndex: "department_name", width: 140, render: (v: string) => v || "Emergency" },
    { title: "Status", dataIndex: "status", width: 120, render: (v: string) => <span className={`text-xs px-2 py-1 rounded-full ${statusColor[v] || ""}`}>{v}</span> },
    {
      title: "Actions", width: 180,
      render: (_, r) => (
        <div className="flex gap-1">
          {r.status === "Open" && <Button variant="ghost" size="sm" onClick={() => handleAction(r.id, "triage")} title="Triage"><Icon icon="solar:stethoscope-bold" size={16} className="text-blue-500" /></Button>}
          {r.status === "In Treatment" && <>
            <Button variant="ghost" size="sm" onClick={() => handleAction(r.id, "admit")} title="Admit"><Icon icon="solar:hospital-bold" size={16} className="text-orange-500" /></Button>
            <Button variant="ghost" size="sm" onClick={() => handleAction(r.id, "discharge")} title="Discharge"><Icon icon="solar:logout-bold" size={16} className="text-green-500" /></Button>
          </>}
          <Button variant="ghost" size="sm" onClick={() => handleDelete(r.id)}><Icon icon="solar:trash-bin-trash-bold" size={16} className="text-red-500" /></Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Emergency Records</h1><p className="text-muted-foreground">{total} ER records</p></div>
      </div>
      <Card><CardContent className="pt-6">
        <Table columns={columns} dataSource={data} rowKey="id" loading={loading}
          pagination={{ current: page, total, pageSize: 20, onChange: setPage }} />
      </CardContent></Card>
    </div>
  );
}
