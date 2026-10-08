import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/ui/card";
import Table, { type ColumnsType } from "antd/es/table";
import { HealthcareApi } from "@/api/services/healthcareService";

const statusColor: Record<string, string> = {
  Pending: "bg-yellow-100 text-yellow-700", Completed: "bg-green-100 text-green-700",
  Failed: "bg-red-100 text-red-700", Refunded: "bg-gray-100 text-gray-700",
};

export default function PaymentsPage() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  const loadData = useCallback(async () => {
    setLoading(true);
    try { const res = await HealthcareApi.payments.list({ page }) as any; setData(res.results || []); setTotal(res.count || 0); }
    catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [page]);

  useEffect(() => { loadData(); }, [loadData]);

  const columns: ColumnsType<any> = [
    { title: "Payment ID", dataIndex: "payment_id", width: 150 },
    { title: "Patient", dataIndex: "patient_name", width: 180 },
    { title: "Amount", dataIndex: "amount", width: 120, render: (v: number) => `$${Number(v).toLocaleString()}` },
    { title: "Amount + GST", dataIndex: "amount_with_gst", width: 130, render: (v: number) => `$${Number(v).toLocaleString()}` },
    { title: "Status", dataIndex: "status", width: 110, render: (v: string) => <span className={`text-xs px-2 py-1 rounded-full ${statusColor[v] || ""}`}>{v}</span> },
    { title: "For", dataIndex: "payment_for_doctype", width: 150 },
  ];

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">Healthcare Payments</h1><p className="text-muted-foreground">{total} payments</p></div>
      <Card><CardContent className="pt-6">
        <Table columns={columns} dataSource={data} rowKey="id" loading={loading}
          pagination={{ current: page, total, pageSize: 20, onChange: setPage }} />
      </CardContent></Card>
    </div>
  );
}
