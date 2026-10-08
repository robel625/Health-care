import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Icon } from "@/components/icon";
import { Button } from "@/ui/button";
import { Card, CardContent } from "@/ui/card";
import { Input } from "@/ui/input";
import Table, { type ColumnsType } from "antd/es/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/ui/dialog";
import { HealthcareApi } from "@/api/services/healthcareService";
import type { SampleCollection } from "@/api/services/healthcareService";
import { useDoctypePermissions } from "@/utils/permissions";

const statusColor: Record<string, string> = {
  Pending: "bg-yellow-100 text-yellow-700",
  "Partly Collected": "bg-blue-100 text-blue-700",
  Collected: "bg-green-100 text-green-700",
  Cancelled: "bg-red-100 text-red-700",
};

export default function SampleCollectionPage() {
  const navigate = useNavigate();
  const { canWrite, canCancel, canDelete } = useDoctypePermissions("Sample Collection");
  const [searchParams] = useSearchParams();
  const patientFilter = searchParams.get("patient");
  const [data, setData] = useState<SampleCollection[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [labelTarget, setLabelTarget] = useState<SampleCollection | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = { page, page_size: 20 };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      if (patientFilter) params.patient = patientFilter;
      const res = await HealthcareApi.sampleCollections.list(params);
      setData(res.results || []);
      setTotal(res.count || 0);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, patientFilter]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleCollect = async (id: number) => {
    if (!id || isNaN(Number(id))) return;
    try {
      await HealthcareApi.sampleCollections.update(id, {
        status: "Collected",
        collected_time: new Date().toISOString(),
      } as any);
      loadData();
    } catch (err) { console.error(err); }
  };

  const handleCancel = async (id: number) => {
    if (!id || isNaN(Number(id))) return;
    if (!confirm("Cancel this sample collection?")) return;
    try {
      await HealthcareApi.sampleCollections.update(id, { status: "Cancelled" } as any);
      loadData();
    } catch (err) { console.error(err); }
  };

  const handleDelete = async (id: number) => {
    if (!id || isNaN(Number(id))) return;
    if (!confirm("Delete?")) return;
    await HealthcareApi.sampleCollections.delete(id);
    loadData();
  };

  const columns: ColumnsType<SampleCollection> = [
    {
      title: "ID",
      dataIndex: "naming_series",
      width: 150,
      render: (_: any, r: any) => <span className="font-medium text-emerald-600 cursor-pointer" onClick={() => navigate(`/healthcare/sample-collections/${r.id}`)}>{r.collection_id || `SC-${r.id}`}</span>,
    },
    {
      title: "Patient",
      width: 180,
      render: (_: any, r: any) => (
        <div>
          <p className="font-medium">{r.patient_name}</p>
          <p className="text-xs text-muted-foreground">{r.patient_age} {r.patient_sex}</p>
        </div>
      ),
    },
    { title: "Sample", width: 140, render: (_: any, r: any) => r.sample_name || "-" },
    { title: "Qty", dataIndex: "sample_qty", width: 60 },
    { title: "Collected By", dataIndex: "collected_by", width: 140 },
    { title: "Collected On", dataIndex: "collected_time", width: 140, render: (v: string) => v ? new Date(v).toLocaleDateString() : "-" },
    {
      title: "Status",
      dataIndex: "status",
      width: 130,
      render: (v: string) => <span className={`text-xs px-2 py-1 rounded-full ${statusColor[v] || ""}`}>{v}</span>,
    },
    {
      title: "Actions",
      width: 140,
      render: (_: any, r: any) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={() => navigate(`/healthcare/sample-collections/${r.id}`)} title="View">
            <Icon icon="solar:eye-bold" size={16} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLabelTarget(r)}
            title="Print Tube Label"
            className="text-blue-500 hover:text-blue-700"
          >
            <Icon icon="solar:printer-bold" size={16} />
          </Button>
          {canWrite && r.status === "Pending" && (
            <Button variant="ghost" size="sm" onClick={() => handleCollect(r.id)} title="Mark Collected">
              <Icon icon="solar:check-circle-bold" size={16} className="text-green-500" />
            </Button>
          )}
          {canCancel && r.status !== "Cancelled" && r.status !== "Collected" && (
            <Button variant="ghost" size="sm" onClick={() => handleCancel(r.id)} title="Cancel">
              <Icon icon="solar:close-circle-bold" size={16} className="text-red-500" />
            </Button>
          )}
          {canDelete && (
            <Button variant="ghost" size="sm" onClick={() => handleDelete(r.id)} title="Delete">
              <Icon icon="solar:trash-bin-trash-bold" size={16} className="text-red-500" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {patientFilter && (
        <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-700">
          <Icon icon="solar:filter-bold" size={16} />
          <span>Filtered by: Patient #{patientFilter}</span>
          <Button variant="ghost" size="sm" className="ml-auto text-blue-700" onClick={() => navigate("/healthcare/sample-collections")}>Clear Filter</Button>
        </div>
      )}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Sample Collection</h1>
          <p className="text-muted-foreground">{total} sample collections</p>
        </div>
        {canWrite && (
          <Button
            onClick={() => navigate("/healthcare/sample-collections/new")}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <Icon icon="solar:add-circle-bold" size={18} className="mr-2" /> New Sample Collection
          </Button>
        )}
      </div>

      {/* Filter Bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <Icon icon="solar:magnifer-linear" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search patient..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="pl-9 w-56" />
        </div>
        <select className="h-9 border rounded-md px-3 text-sm bg-background" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
          <option value="">Status</option>
          <option value="Pending">Pending</option>
          <option value="Partly Collected">Partly Collected</option>
          <option value="Collected">Collected</option>
          <option value="Cancelled">Cancelled</option>
        </select>
      </div>

      <Card>
        <CardContent className="pt-4">
          <Table columns={columns} dataSource={data} rowKey="id" loading={loading}
            pagination={{ current: page, total, pageSize: 20, onChange: setPage }} />
        </CardContent>
      </Card>

      {/* Specimen Tube Label Print Dialog */}
      <Dialog open={!!labelTarget} onOpenChange={(open) => !open && setLabelTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader className="print:hidden">
            <DialogTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Icon icon="solar:printer-bold" size={20} className="text-blue-600" />
                Specimen Tube Label
              </span>
              <Button size="sm" onClick={() => window.print()} className="bg-blue-600 hover:bg-blue-700">
                <Icon icon="solar:printer-bold" size={16} className="mr-1" />
                Print Label
              </Button>
            </DialogTitle>
          </DialogHeader>

          {labelTarget && (
            <div className="p-4 bg-slate-50 border rounded-lg flex flex-col items-center">
              {/* Physical label mockup (matching clinical 50x25mm label) */}
              <div
                id="tube-label-print-area"
                className="w-72 p-3 bg-white border border-slate-300 rounded shadow-sm flex flex-col justify-between text-slate-900 print:border-none print:shadow-none"
              >
                <div className="flex justify-between items-center border-b border-slate-200 pb-1 text-[11px] font-semibold text-slate-700">
                  <span>CLINICAL LAB</span>
                  <span className="uppercase text-blue-700">{labelTarget.sample_name || "Specimen"}</span>
                </div>
                <div className="my-1">
                  <p className="font-bold text-sm leading-tight text-slate-950 truncate">
                    {labelTarget.patient_name}
                  </p>
                  <p className="text-[11px] text-slate-600">
                    ID: #{labelTarget.patient} · {labelTarget.patient_age || ""} {labelTarget.patient_sex || ""}
                  </p>
                </div>
                {/* SVG Barcode */}
                <div className="my-1.5 flex flex-col items-center">
                  <svg className="w-52 h-10" viewBox="0 0 200 36">
                    {(labelTarget.collection_id || `SC-${labelTarget.id}`)
                      .split("")
                      .flatMap((char) => {
                        const code = char.charCodeAt(0);
                        const w1 = (code % 3) + 1;
                        const w2 = ((code >> 2) % 2) + 1;
                        return [w1, 1.5, w2, 1.5];
                      })
                      .map((width, idx, arr) => {
                        const isBar = idx % 2 === 0;
                        const x = arr.slice(0, idx).reduce((a, b) => a + b, 10);
                        return isBar ? (
                          <rect key={idx} x={x} y="0" width={width} height="36" fill="#000000" />
                        ) : null;
                      })}
                  </svg>
                  <span className="font-mono text-[10px] tracking-wider text-slate-800 font-semibold">
                    {labelTarget.collection_id || `SC-${labelTarget.id}`}
                  </span>
                </div>
                <div className="flex justify-between text-[10px] text-slate-500 border-t border-slate-200 pt-1">
                  <span>
                    Coll: {labelTarget.collected_time
                      ? new Date(labelTarget.collected_time).toLocaleDateString()
                      : new Date().toLocaleDateString()}
                  </span>
                  <span>{labelTarget.sample_qty ? `${labelTarget.sample_qty} ${labelTarget.sample_uom || "ml"}` : ""}</span>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
