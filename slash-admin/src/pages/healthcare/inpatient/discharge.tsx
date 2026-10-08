import { useState, useEffect, useCallback } from "react";
import { Icon } from "@/components/icon";
import { Button } from "@/ui/button";
import { Card, CardContent } from "@/ui/card";
import Table, { type ColumnsType } from "antd/es/table";
import { HealthcareApi } from "@/api/services/healthcareService";

export default function DischargePage() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  const loadData = useCallback(async () => {
    setLoading(true);
    try { const res = await HealthcareApi.dischargeSummaries.list({ page }) as any; setData(res.results || []); setTotal(res.count || 0); }
    catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [page]);

  useEffect(() => { loadData(); }, [loadData]);
  const handleDelete = async (id: number) => { if (confirm("Delete?")) { await HealthcareApi.dischargeSummaries.delete(id); loadData(); } };

  const columns: ColumnsType<any> = [
    { title: "ID", dataIndex: "summary_id", width: 140 },
    { title: "Patient", dataIndex: "patient_name", width: 180 },
    { title: "Practitioner", dataIndex: "discharge_practitioner_name", width: 180 },
    { title: "Date", dataIndex: "posting_date", width: 120 },
    { title: "Chief Complaint", dataIndex: "chief_complaint", width: 200, ellipsis: true },
    { title: "Diagnosis", dataIndex: "diagnosis", width: 200, ellipsis: true },
    { title: "Follow-up", dataIndex: "followup_date", width: 120 },
    { title: "Status", dataIndex: "status", width: 100, render: (v: string) => <span className={`text-xs px-2 py-1 rounded-full ${v === "Completed" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"}`}>{v}</span> },
    { title: "Actions", width: 80, render: (_, r) => <Button variant="ghost" size="sm" onClick={() => handleDelete(r.id)}><Icon icon="solar:trash-bin-trash-bold" size={16} className="text-red-500" /></Button> },
  ];

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">Discharge Summaries</h1><p className="text-muted-foreground">{total} summaries</p></div>
      <Card><CardContent className="pt-6">
        <Table columns={columns} dataSource={data} rowKey="id" loading={loading}
          pagination={{ current: page, total, pageSize: 20, onChange: setPage }} />
      </CardContent></Card>
    </div>
  );
}
