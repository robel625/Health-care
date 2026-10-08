import { useState, useEffect, useCallback } from "react";
import { Icon } from "@/components/icon";
import { Button } from "@/ui/button";
import { Card, CardContent } from "@/ui/card";
import Table, { type ColumnsType } from "antd/es/table";
import { HealthcareApi } from "@/api/services/healthcareService";
import type { InsuranceClaim } from "@/api/services/healthcareService";

const statusColor: Record<string, string> = {
  Draft: "bg-gray-100 text-gray-700", Submitted: "bg-blue-100 text-blue-700",
  "Under Review": "bg-yellow-100 text-yellow-700", Approved: "bg-green-100 text-green-700",
  "Partially Approved": "bg-orange-100 text-orange-700", Rejected: "bg-red-100 text-red-700", Paid: "bg-emerald-100 text-emerald-700",
};

export default function InsurancePage() {
  const [data, setData] = useState<InsuranceClaim[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  const loadData = useCallback(async () => {
    setLoading(true);
    try { const res = await HealthcareApi.insuranceClaims.list({ page }); setData(res.results || []); setTotal(res.count || 0); }
    catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [page]);

  useEffect(() => { loadData(); }, [loadData]);
  const handleDelete = async (id: number) => { if (confirm("Delete?")) { await HealthcareApi.insuranceClaims.delete(id); loadData(); } };

  const columns: ColumnsType<InsuranceClaim> = [
    { title: "Claim ID", dataIndex: "claim_id", width: 140 },
    { title: "Patient", dataIndex: "patient_name", width: 180 },
    { title: "Payor", dataIndex: "payor_name", width: 180 },
    { title: "Claim Amount", dataIndex: "claim_amount", width: 120, render: (v: number) => `$${Number(v).toLocaleString()}` },
    { title: "Approved", dataIndex: "approved_amount", width: 120, render: (v: number) => `$${Number(v).toLocaleString()}` },
    { title: "Submitted", dataIndex: "submitted_date", width: 120 },
    { title: "Status", dataIndex: "status", width: 140, render: (v: string) => <span className={`text-xs px-2 py-1 rounded-full ${statusColor[v] || ""}`}>{v}</span> },
    { title: "Actions", width: 80, render: (_, r) => <Button variant="ghost" size="sm" onClick={() => handleDelete(r.id)}><Icon icon="solar:trash-bin-trash-bold" size={16} className="text-red-500" /></Button> },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Insurance Claims</h1><p className="text-muted-foreground">{total} claims</p></div>
      </div>
      <Card><CardContent className="pt-6">
        <Table columns={columns} dataSource={data} rowKey="id" loading={loading}
          pagination={{ current: page, total, pageSize: 20, onChange: setPage }} />
      </CardContent></Card>
    </div>
  );
}
