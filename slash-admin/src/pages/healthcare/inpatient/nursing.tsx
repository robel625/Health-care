import { useState, useEffect, useCallback } from "react";
import { Icon } from "@/components/icon";
import { Button } from "@/ui/button";
import { Card, CardContent } from "@/ui/card";
import Table, { type ColumnsType } from "antd/es/table";
import { HealthcareApi } from "@/api/services/healthcareService";

const statusColor: Record<string, string> = {
  Open: "bg-blue-100 text-blue-700", "In Progress": "bg-yellow-100 text-yellow-700",
  Completed: "bg-green-100 text-green-700", Cancelled: "bg-red-100 text-red-700",
};

export default function NursingPage() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  const loadData = useCallback(async () => {
    setLoading(true);
    try { const res = await HealthcareApi.nursingTasks.list({ page }) as any; setData(res.results || []); setTotal(res.count || 0); }
    catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [page]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleComplete = async (id: number) => { await HealthcareApi.nursingTasks.complete(id); loadData(); };
  const handleDelete = async (id: number) => { if (confirm("Delete?")) { await HealthcareApi.nursingTasks.delete(id); loadData(); } };

  const columns: ColumnsType<any> = [
    { title: "Task ID", dataIndex: "task_id", width: 140 },
    { title: "Title", dataIndex: "title", width: 250 },
    { title: "Patient", dataIndex: "patient_name", width: 180 },
    { title: "Date", dataIndex: "task_date", width: 110 },
    { title: "Mandatory", dataIndex: "mandatory", width: 100, render: (v: boolean) => v ? <span className="text-red-500 font-bold">Yes</span> : "No" },
    { title: "Status", dataIndex: "status", width: 110, render: (v: string) => <span className={`text-xs px-2 py-1 rounded-full ${statusColor[v] || ""}`}>{v}</span> },
    { title: "Actions", width: 120, render: (_, r) => (
      <div className="flex gap-1">
        {r.status === "Open" && <Button variant="ghost" size="sm" onClick={() => handleComplete(r.id)} title="Complete"><Icon icon="solar:check-circle-bold" size={16} className="text-green-500" /></Button>}
        <Button variant="ghost" size="sm" onClick={() => handleDelete(r.id)}><Icon icon="solar:trash-bin-trash-bold" size={16} className="text-red-500" /></Button>
      </div>
    )},
  ];

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">Nursing Tasks</h1><p className="text-muted-foreground">{total} tasks</p></div>
      <Card><CardContent className="pt-6">
        <Table columns={columns} dataSource={data} rowKey="id" loading={loading}
          pagination={{ current: page, total, pageSize: 20, onChange: setPage }} />
      </CardContent></Card>
    </div>
  );
}
