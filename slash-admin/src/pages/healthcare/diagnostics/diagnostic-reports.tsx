import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Icon } from "@/components/icon";
import { Button } from "@/ui/button";
import { Card, CardContent } from "@/ui/card";
import { Input } from "@/ui/input";
import Table, { type ColumnsType } from "antd/es/table";
import { HealthcareApi } from "@/api/services/healthcareService";
import type { DiagnosticReport } from "@/api/services/healthcareService";

const statusColor: Record<string, string> = {
  Draft: "bg-gray-100 text-gray-700",
  Active: "bg-blue-100 text-blue-700",
  Completed: "bg-green-100 text-green-700",
  Cancelled: "bg-red-100 text-red-700",
};

export default function DiagnosticReportsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const patientFilter = searchParams.get("patient");
  const [data, setData] = useState<DiagnosticReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" } | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const filterParams: Record<string, any> = { page, search: search || undefined };
      if (patientFilter) filterParams.patient = patientFilter;
      if (statusFilter) filterParams.status = statusFilter;
      const res = await HealthcareApi.diagnosticReports.list(filterParams);
      setData(res.results || []);
      setTotal(res.count || 0);
    } catch (err) {
      console.error(err);
      setToast({ msg: "Failed to load diagnostic reports", type: "err" });
    } finally {
      setLoading(false);
    }
  }, [page, search, patientFilter, statusFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this diagnostic report?")) return;
    try {
      await HealthcareApi.diagnosticReports.delete(id);
      setToast({ msg: "Report deleted successfully", type: "ok" });
      loadData();
    } catch (err: any) {
      setToast({ msg: err?.message || "Failed to delete report", type: "err" });
    }
  };

  const columns: ColumnsType<DiagnosticReport> = [
    {
      title: "Report ID",
      dataIndex: "report_id",
      width: 160,
      render: (v: string, r: DiagnosticReport) => (
        <span
          className="font-medium cursor-pointer text-blue-600 hover:underline"
          onClick={() => navigate(`/healthcare/diagnostics/reports/${r.id}`)}
        >
          {v || `HLC-DR-${String(r.id).padStart(4, "0")}`}
        </span>
      ),
    },
    {
      title: "Title",
      dataIndex: "title",
      width: 220,
      render: (v: string) => v || "—",
    },
    {
      title: "Patient",
      dataIndex: "patient_name",
      width: 180,
      render: (v: string) => v || "—",
    },
    {
      title: "Practitioner",
      dataIndex: "practitioner_name",
      width: 180,
      render: (v: string) => v || "—",
    },
    {
      title: "Status",
      dataIndex: "status",
      width: 120,
      render: (s: string) => (
        <span
          className={`text-xs px-2 py-0.5 rounded font-medium ${
            statusColor[s] || "bg-gray-100 text-gray-700"
          }`}
        >
          {s}
        </span>
      ),
    },
    {
      title: "Reference Doc",
      dataIndex: "ref_doctype",
      width: 160,
      render: (ref: string, r: DiagnosticReport) =>
        ref ? `${ref} ${r.docname || ""}` : "—",
    },
    {
      title: "Date",
      dataIndex: "creation",
      width: 140,
      render: (d: string) => (d ? new Date(d).toLocaleDateString() : "—"),
    },
    {
      title: "Actions",
      width: 100,
      render: (_, r: DiagnosticReport) => (
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/healthcare/diagnostics/reports/${r.id}`)}
            title="View Details"
          >
            <Icon icon="solar:eye-bold" size={16} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleDelete(r.id)}
            title="Delete"
            className="text-red-500 hover:text-red-700"
          >
            <Icon icon="solar:trash-bin-trash-bold" size={16} />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-2 rounded-md text-sm text-white shadow-lg cursor-pointer ${
            toast.type === "ok" ? "bg-green-600" : "bg-red-600"
          }`}
          onClick={() => setToast(null)}
        >
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Diagnostic Reports</h1>
          <p className="text-muted-foreground">{total} total reports</p>
        </div>
        <Button
          onClick={() => navigate("/healthcare/diagnostics/reports/new")}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Icon icon="solar:add-circle-bold" size={18} className="mr-2" /> New Report
        </Button>
      </div>

      {/* Search & Filter */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Icon
            icon="solar:magnifer-linear"
            className="absolute left-3 top-2.5 text-muted-foreground"
            size={16}
          />
          <Input
            placeholder="Search reports by title, patient, or doctor..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-9 h-9"
          />
        </div>
        <div className="relative">
          <select
            className="h-9 border rounded-md px-3 text-sm bg-background appearance-none pr-8 cursor-pointer"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All Statuses</option>
            <option value="Draft">Draft</option>
            <option value="Active">Active</option>
            <option value="Completed">Completed</option>
            <option value="Cancelled">Cancelled</option>
          </select>
        </div>
        {(search || statusFilter) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearch("");
              setStatusFilter("");
              setPage(1);
            }}
            className="h-9 text-muted-foreground"
          >
            Clear
          </Button>
        )}
      </div>

      {/* Table */}
      <Card>
        <CardContent className="pt-6">
          <Table
            columns={columns}
            dataSource={data}
            rowKey="id"
            loading={loading}
            pagination={{
              current: page,
              total,
              pageSize: 20,
              onChange: setPage,
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
