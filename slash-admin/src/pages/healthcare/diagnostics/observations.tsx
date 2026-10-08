import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Icon } from "@/components/icon";
import { Button } from "@/ui/button";
import { Card, CardContent } from "@/ui/card";
import { Input } from "@/ui/input";
import Table, { type ColumnsType } from "antd/es/table";
import { HealthcareApi } from "@/api/services/healthcareService";
import type { Observation } from "@/api/services/healthcareService";

const statusColor: Record<string, string> = {
  Registered: "bg-gray-100 text-gray-700",
  Preliminary: "bg-yellow-100 text-yellow-700",
  Final: "bg-green-100 text-green-700",
  Amended: "bg-orange-100 text-orange-700",
  Submitted: "bg-blue-100 text-blue-700",
  Draft: "bg-gray-100 text-gray-700",
  Cancelled: "bg-red-100 text-red-700",
};

export default function ObservationsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const patientFilter = searchParams.get("patient");
  const [data, setData] = useState<Observation[]>([]);
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
      const res = await HealthcareApi.observations.list(filterParams);
      setData(res.results || []);
      setTotal(res.count || 0);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, search, patientFilter, statusFilter]);

  useEffect(() => { loadData(); }, [loadData]);

  const columns: ColumnsType<Observation> = [
    {
      title: "",
      width: 40,
      render: () => <input type="checkbox" className="rounded" />,
    },
    {
      title: "ID",
      dataIndex: "naming_series",
      width: 200,
      render: (v: string, r: any) => (
        <span className="font-medium cursor-pointer text-blue-600 hover:underline" onClick={() => navigate(`/healthcare/observations/${r.id}`)}>
          {v || `HLC-OBS-${String(r.id).padStart(4, "0")}`}
        </span>
      ),
    },
    {
      title: "Status",
      dataIndex: "status",
      width: 120,
      render: (s: string) => (
        <span className={`text-xs px-2 py-0.5 rounded font-medium ${statusColor[s] || "bg-gray-100 text-gray-700"}`}>{s}</span>
      ),
    },
    {
      title: "Observation Template",
      dataIndex: "observation_template_name",
      width: 180,
      render: (v: string) => v || "—",
    },
    {
      title: "Patient",
      dataIndex: "patient_name",
      width: 180,
    },
    {
      title: "Permitted Data Type",
      dataIndex: "permitted_data_type",
      width: 160,
      render: (v: string) => v ? (
        <span className="inline-flex items-center gap-1 text-xs">
          <span className="w-2 h-2 rounded-full bg-blue-500" />
          {v}
        </span>
      ) : "—",
    },
    {
      title: "",
      width: 120,
      render: () => (
        <div className="flex items-center gap-2 text-muted-foreground">
          <span className="text-xs">now</span>
          <button className="hover:text-foreground">
            <Icon icon="solar:chat-round-bold" size={14} />
          </button>
          <span className="text-xs">0 -</span>
          <button className="hover:text-red-500">
            <Icon icon="solar:heart-bold" size={14} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-2 rounded-md text-sm text-white shadow-lg cursor-pointer ${toast.type === "ok" ? "bg-green-600" : "bg-red-600"}`} onClick={() => setToast(null)}>
          {toast.msg}
        </div>
      )}

      {/* ── Header ────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground cursor-pointer hover:text-foreground" onClick={() => navigate("/")}>🏠</span>
          <span className="text-muted-foreground">/</span>
          <span className="text-muted-foreground cursor-pointer hover:text-foreground" onClick={() => navigate("/healthcare")}>Diagnostics</span>
          <span className="text-muted-foreground">/</span>
          <span className="font-semibold">Observation</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="text-xs">
            <Icon icon="solar:list-check-bold" size={14} className="mr-1" /> List View
          </Button>
          <Button variant="outline" size="sm" className="text-xs">
            <Icon icon="solar:filter-bold" size={14} className="mr-1" /> Saved Filters
          </Button>
          <Button variant="ghost" size="sm">
            <Icon icon="solar:refresh-bold" size={16} />
          </Button>
          <Button onClick={() => navigate("/healthcare/observations/new")} className="bg-blue-600 hover:bg-blue-700 text-sm">
            <Icon icon="solar:add-circle-bold" size={16} className="mr-1" /> Add Observation
          </Button>
        </div>
      </div>

      {/* ── Filter Chips ─────────────────────────────────────────── */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 border rounded-md px-3 py-1.5 text-sm bg-white">
          <span className="text-muted-foreground text-xs">ID</span>
          <span className="text-muted-foreground">≈</span>
          <Input
            placeholder=""
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="border-0 p-0 h-auto w-32 text-sm focus:ring-0 shadow-none"
          />
        </div>
        <div className="flex items-center gap-2 border rounded-md px-3 py-1.5 text-sm bg-white">
          <select className="border-0 text-sm bg-transparent focus:outline-none" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
            <option value="">Status</option>
            {["Registered", "Preliminary", "Final", "Amended", "Submitted", "Draft", "Cancelled"].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        {patientFilter && (
          <div className="flex items-center gap-1 border border-blue-200 bg-blue-50 rounded-md px-3 py-1.5 text-sm text-blue-700">
            <span>patient 1 test</span>
            <button className="hover:text-blue-900" onClick={() => navigate("/healthcare/observations")}>×</button>
          </div>
        )}
        <div className="flex items-center gap-2 border rounded-md px-3 py-1.5 text-sm bg-white">
          <span className="text-muted-foreground text-xs">Permitted Da...</span>
        </div>
        <Button variant="ghost" size="sm" className="text-xs text-muted-foreground">
          <Icon icon="solar:filter-bold" size={14} className="mr-1" /> Filter ×
        </Button>
        <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          <span>Created On</span>
          <Icon icon="solar:alt-arrow-down-bold" size={12} />
        </div>
      </div>

      {/* ── Table ─────────────────────────────────────────────────── */}
      <Card>
        <CardContent className="pt-0">
          <div className="flex items-center justify-between px-4 py-2 border-b text-sm text-muted-foreground">
            <span>{total} of {total}</span>
            <button className="hover:text-foreground">
              <Icon icon="solar:heart-bold" size={14} />
            </button>
          </div>
          <Table columns={columns} dataSource={data} rowKey="id" loading={loading} pagination={false} />
        </CardContent>
      </Card>
    </div>
  );
}
