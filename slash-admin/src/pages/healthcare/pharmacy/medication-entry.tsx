import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router";
import { Icon } from "@/components/icon";
import { Button } from "@/ui/button";
import { Card, CardContent } from "@/ui/card";
import { Input } from "@/ui/input";
import { Badge } from "@/ui/badge";
import Table, { type ColumnsType } from "antd/es/table";
import { toast } from "sonner";
import PharmacyNavHeader from "./components/PharmacyNavHeader";
import {
  HealthcareApi,
  type InpatientMedicationEntry,
} from "@/api/services/healthcareService";

export default function InpatientMedicationEntryListPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<InpatientMedicationEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [search, setSearch] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = { page, page_size: 20 };
      if (statusFilter !== "All") params.status = statusFilter;
      if (search.trim()) params.search = search.trim();
      const res = await HealthcareApi.inpatientMedicationEntries.list(params);
      setData(res.results || []);
      setTotal(res.count || 0);
    } catch (err) {
      console.error("Failed to load medication entries:", err);
      toast.error("Failed to load medication entries.");
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, search]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCancel = async (id: number) => {
    if (confirm("Are you sure you want to cancel this Inpatient Medication Entry? Associated stock entries will be cancelled.")) {
      try {
        await HealthcareApi.inpatientMedicationEntries.cancelEntry(id);
        toast.success("Inpatient Medication Entry cancelled successfully.");
        loadData();
      } catch (err: any) {
        toast.error(err?.response?.data?.error || "Failed to cancel entry");
      }
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm("Are you sure you want to delete this draft entry?")) {
      try {
        await HealthcareApi.inpatientMedicationEntries.delete(id);
        toast.success("Draft entry deleted.");
        loadData();
      } catch (err: any) {
        toast.error(err?.response?.data?.error || "Failed to delete entry");
      }
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.info(`Copied ${label}: ${text}`);
  };

  // Calculated metrics
  const metrics = useMemo(() => {
    const drafts = data.filter((d) => d.status === "Draft").length;
    const submitted = data.filter((d) => d.status === "Submitted").length;
    const cancelled = data.filter((d) => d.status === "Cancelled").length;
    return { drafts, submitted, cancelled, total };
  }, [data, total]);

  const columns: ColumnsType<InpatientMedicationEntry> = [
    {
      title: "Entry ID",
      dataIndex: "entry_id",
      width: 170,
      render: (v: string, r) => {
        const idText = v || `IME-${r.id}`;
        return (
          <div className="flex items-center gap-1.5 group">
            <span
              className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer flex items-center gap-1"
              onClick={() => navigate(`/healthcare/pharmacy/medication-entry/${r.id}`)}
            >
              <Icon icon="solar:document-text-bold-duotone" size={15} />
              {idText}
            </span>
            <button
              type="button"
              onClick={() => copyToClipboard(idText, "Entry ID")}
              className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground p-0.5"
              title="Copy ID"
            >
              <Icon icon="solar:copy-bold" size={12} />
            </button>
          </div>
        );
      },
    },
    {
      title: "Posting Date",
      dataIndex: "posting_date",
      width: 115,
      render: (v: string) => (
        <span className="text-xs text-muted-foreground font-medium">{v}</span>
      ),
    },
    {
      title: "Patient / Target",
      dataIndex: "patient_name",
      render: (v: string) => {
        const name = v || "All Admitted Patients";
        return (
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-bold text-xs flex items-center justify-center shrink-0">
              {name.charAt(0).toUpperCase()}
            </div>
            <div>
              <span className="font-semibold text-xs text-foreground block">{name}</span>
              <span className="text-[10px] text-muted-foreground">Inpatient Ward</span>
            </div>
          </div>
        );
      },
    },
    {
      title: "Ward / Unit",
      dataIndex: "service_unit_name",
      width: 150,
      render: (v: string) => (
        <span className="inline-flex items-center gap-1 text-xs text-foreground bg-muted/50 px-2 py-0.5 rounded-md border border-border/50">
          <Icon icon="solar:hospital-bold" size={13} className="text-blue-500 shrink-0" />
          {v || "All Units"}
        </span>
      ),
    },
    {
      title: "Warehouse",
      dataIndex: "warehouse_name",
      width: 150,
      render: (v: string) => (
        <span className="text-xs text-muted-foreground flex items-center gap-1">
          <Icon icon="solar:box-minimalistic-bold" size={13} className="text-emerald-500 shrink-0" />
          {v || "Pharmacy Main"}
        </span>
      ),
    },
    {
      title: "Stock Impact",
      dataIndex: "update_stock",
      width: 120,
      render: (v: boolean) =>
        v ? (
          <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20 text-[10px] font-semibold gap-1">
            <Icon icon="solar:check-circle-bold" size={12} />
            Deducted
          </Badge>
        ) : (
          <Badge variant="outline" className="text-muted-foreground text-[10px]">
            No Impact
          </Badge>
        ),
    },
    {
      title: "Status",
      dataIndex: "status",
      width: 120,
      render: (v: string) => {
        const isSubmitted = v === "Submitted";
        const isDraft = v === "Draft";
        return (
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
              isSubmitted
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                : isDraft
                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                : "bg-rose-500/10 text-rose-600 border border-rose-500/20"
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isSubmitted ? "bg-emerald-500" : isDraft ? "bg-amber-500" : "bg-rose-500"
              }`}
            />
            {v}
          </span>
        );
      },
    },
    {
      title: "Stock Voucher",
      dataIndex: "stock_entry_number",
      width: 160,
      render: (v: string) =>
        v ? (
          <div className="flex items-center gap-1 group">
            <span className="text-[11px] font-mono font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
              {v}
            </span>
            <button
              type="button"
              onClick={() => copyToClipboard(v, "Voucher #")}
              className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
              title="Copy Voucher #"
            >
              <Icon icon="solar:copy-bold" size={12} />
            </button>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">-</span>
        ),
    },
    {
      title: "Actions",
      width: 110,
      align: "center",
      render: (_, r) => (
        <div className="flex items-center justify-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/healthcare/pharmacy/medication-entry/${r.id}`)}
            title="View / Edit Entry"
            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
          >
            <Icon icon="solar:pen-bold" size={15} />
          </Button>
          {r.status === "Submitted" && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleCancel(r.id)}
              title="Cancel Entry"
              className="h-7 w-7 p-0 text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/40"
            >
              <Icon icon="solar:close-circle-bold" size={15} />
            </Button>
          )}
          {r.status === "Draft" && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleDelete(r.id)}
              title="Delete Draft"
              className="h-7 w-7 p-0 text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
            >
              <Icon icon="solar:trash-bin-trash-bold" size={15} />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PharmacyNavHeader
        title="Inpatient Medication Entries & Ward Issues"
        subtitle="Record ward medication orders, verify shortages against warehouse stock, and issue material stock vouchers."
        badge="Inpatient Orders"
        action={
          <Button
            size="sm"
            className="gap-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-xs"
            onClick={() => navigate("/healthcare/pharmacy/medication-entry/new")}
          >
            <Icon icon="solar:add-circle-bold" size={16} />
            New Medication Entry
          </Button>
        }
      />

      {/* KPI Metric Summary Tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-border/70 bg-card shadow-2xs space-y-1">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Total Orders Tracked
          </p>
          <p className="text-2xl font-extrabold text-foreground">{metrics.total}</p>
          <p className="text-[11px] text-muted-foreground flex items-center gap-1">
            <Icon icon="solar:document-text-bold" size={12} className="text-emerald-500" />
            All inpatient entries
          </p>
        </div>

        <div className="p-4 rounded-xl border border-border/70 bg-card shadow-2xs space-y-1">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Active Stock Issues
          </p>
          <p className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">
            {metrics.submitted}
          </p>
          <p className="text-[11px] text-muted-foreground flex items-center gap-1">
            <Icon icon="solar:check-circle-bold" size={12} className="text-emerald-500" />
            Submitted & stock updated
          </p>
        </div>

        <div className="p-4 rounded-xl border border-border/70 bg-card shadow-2xs space-y-1">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Drafts Pending
          </p>
          <p className="text-2xl font-extrabold text-amber-600 dark:text-amber-400">
            {metrics.drafts}
          </p>
          <p className="text-[11px] text-muted-foreground flex items-center gap-1">
            <Icon icon="solar:clock-circle-bold" size={12} className="text-amber-500" />
            Awaiting pharmacist review
          </p>
        </div>

        <div className="p-4 rounded-xl border border-border/70 bg-card shadow-2xs space-y-1">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Cancelled Orders
          </p>
          <p className="text-2xl font-extrabold text-muted-foreground">
            {metrics.cancelled}
          </p>
          <p className="text-[11px] text-muted-foreground flex items-center gap-1">
            <Icon icon="solar:close-circle-bold" size={12} className="text-rose-500" />
            Voided or stock reversed
          </p>
        </div>
      </div>

      {/* Main Table Card */}
      <Card className="border-border/70 shadow-xs">
        <CardContent className="pt-6 space-y-4">
          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row gap-3 justify-between items-center pb-2">
            <div className="flex items-center gap-1 bg-muted/70 p-1 rounded-xl w-full sm:w-auto border border-border/50">
              {(["All", "Draft", "Submitted", "Cancelled"] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => {
                    setStatusFilter(st);
                    setPage(1);
                  }}
                  className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition-all ${
                    statusFilter === st
                      ? "bg-background text-foreground shadow-xs font-bold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-80">
              <Input
                placeholder="Search by Entry ID, patient, or ward..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="h-9 text-xs pr-8 rounded-lg"
              />
              {search ? (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                >
                  <Icon icon="solar:close-circle-bold" size={15} />
                </button>
              ) : (
                <Icon
                  icon="solar:magnifer-linear"
                  size={15}
                  className="absolute right-2.5 top-2.5 text-muted-foreground pointer-events-none"
                />
              )}
            </div>
          </div>

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
              showTotal: (total) => `${total} entries recorded`,
            }}
            size="middle"
            className="[&_.ant-table-thead>tr>th]:bg-transparent"
          />
        </CardContent>
      </Card>
    </div>
  );
}
