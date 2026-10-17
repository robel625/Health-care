import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router";
import { Icon } from "@/components/icon";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card";
import { Button } from "@/ui/button";
import { Badge } from "@/ui/badge";
import { Progress } from "@/ui/progress";
import Table, { type ColumnsType } from "antd/es/table";
import { Chart, useChart } from "@/components/chart";
import PharmacyNavHeader from "./components/PharmacyNavHeader";
import {
  HealthcareApi,
  type MedicationRequest,
  type PharmacyDashboardStats,
  type PharmacyStockBalance,
} from "@/api/services/healthcareService";

export default function PharmacyDashboardPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<PharmacyDashboardStats | null>(null);
  const [recentRequests, setRecentRequests] = useState<MedicationRequest[]>([]);
  const [lowStockItems, setLowStockItems] = useState<PharmacyStockBalance[]>([]);
  const [loading, setLoading] = useState(false);
  const [entryFilter, setEntryFilter] = useState<"All" | "Active" | "Completed">("All");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, requestsRes, stockRes] = await Promise.all([
        HealthcareApi.pharmacy.dashboardStats().catch(() => null),
        HealthcareApi.medicationRequests.list({ page_size: 10 }).catch(() => ({ results: [] })),
        HealthcareApi.pharmacy.stockBalances({ low_stock: true }).catch(() => ({ results: [] })),
      ]);

      if (statsRes) setStats(statsRes);
      setRecentRequests((requestsRes?.results || requestsRes || []) as MedicationRequest[]);
      setLowStockItems(stockRes?.results || []);
    } catch (err) {
      console.error("Failed to load pharmacy dashboard data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Dispensing Trends Chart Options (Area Chart)
  const dispensingChartOptions = useChart({
    chart: {
      type: "area",
      toolbar: { show: false },
      zoom: { enabled: false },
    },
    colors: ["#059669", "#2563eb"], // Emerald for Outpatient, Blue for Inpatient
    stroke: { curve: "smooth", width: 2.5 },
    fill: {
      type: "gradient",
      gradient: {
        shadeIntensity: 1,
        opacityFrom: 0.35,
        opacityTo: 0.05,
        stops: [0, 90, 100],
      },
    },
    dataLabels: { enabled: false },
    xaxis: {
      categories: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
      labels: { style: { colors: "#9ca3af", fontSize: "11px" } },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: {
      labels: { style: { colors: "#9ca3af", fontSize: "11px" } },
    },
    grid: {
      borderColor: "rgba(156, 163, 175, 0.15)",
      strokeDashArray: 3,
    },
    legend: {
      position: "top",
      horizontalAlign: "right",
      fontSize: "12px",
      markers: { size: 6, strokeWidth: 0 },
    },
    tooltip: {
      theme: "dark",
      x: { show: true },
    },
  });

  const dispensingSeries = useMemo(() => [
    {
      name: "Outpatient Dispenses",
      data: [32, 45, 52, 48, 64, 58, 42],
    },
    {
      name: "Prescription Dispatches",
      data: [20, 24, 28, 31, 35, 29, 22],
    },
  ], []);

  // Stock Category Breakdown (Donut Chart)
  const categoryChartOptions = useChart({
    chart: { type: "donut" },
    labels: ["Antibiotics", "Analgesics & NSAIDs", "Cardiovascular", "Gastrointestinal", "Injectables", "Respiratory"],
    colors: ["#10b981", "#3b82f6", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4"],
    legend: {
      position: "bottom",
      fontSize: "11px",
      markers: { size: 5, strokeWidth: 0 },
    },
    plotOptions: {
      pie: {
        donut: {
          size: "72%",
          labels: {
            show: true,
            total: {
              show: true,
              label: "Formulations",
              fontSize: "12px",
              color: "#6b7280",
              formatter: () => "128 SKUs",
            },
          },
        },
      },
    },
    dataLabels: { enabled: false },
    stroke: { width: 0 },
  });

  const categorySeries = useMemo(() => [35, 28, 22, 18, 14, 11], []);

  const filteredRequests = useMemo(() => {
    if (entryFilter === "All") return recentRequests;
    return recentRequests.filter((e) => e.status === entryFilter);
  }, [recentRequests, entryFilter]);

  const requestColumns: ColumnsType<MedicationRequest> = [
    {
      title: "Rx Order ID",
      dataIndex: "request_id",
      width: 140,
      render: (v: string, r) => (
        <span
          className="font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer flex items-center gap-1.5"
          onClick={() => navigate(`/healthcare/pharmacy/medication-requests`)}
        >
          <Icon icon="solar:document-text-bold-duotone" size={15} />
          {v || `MR-${r.id}`}
        </span>
      ),
    },
    {
      title: "Employee / Patient",
      dataIndex: "patient_name",
      render: (v: string) => (
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-xs">
            {v ? v.charAt(0).toUpperCase() : "E"}
          </div>
          <div>
            <span className="font-semibold text-xs text-foreground block">{v || "EEU Employee"}</span>
            <span className="text-[10px] text-muted-foreground">Staff Clinic</span>
          </div>
        </div>
      ),
    },
    {
      title: "Prescribed Medication",
      dataIndex: "medication_name",
      render: (v: string, r) => (
        <div>
          <span className="font-semibold text-xs text-foreground block">{v}</span>
          <span className="text-[10px] text-muted-foreground">{r.dosage || r.dosage_form || "Standard dosage"}</span>
        </div>
      ),
    },
    {
      title: "Qty",
      dataIndex: "quantity",
      width: 70,
      align: "center",
      render: (v: number) => <span className="font-bold text-xs">{v || 1}</span>,
    },
    {
      title: "Status",
      dataIndex: "status",
      width: 110,
      render: (v: string) => {
        const isCompleted = v === "Completed" || v === "Dispensed";
        const isActive = v === "Active";
        return (
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
              isCompleted
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                : isActive
                ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
                : "bg-amber-500/10 text-amber-600 border border-amber-500/20"
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isCompleted ? "bg-emerald-500" : isActive ? "bg-blue-500" : "bg-amber-500"
              }`}
            />
            {v || "Active"}
          </span>
        );
      },
    },
    {
      title: "Actions",
      width: 80,
      align: "center",
      render: () => (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
          onClick={() => navigate(`/healthcare/pharmacy/medication-requests`)}
          title="Open Prescription Queue"
        >
          <Icon icon="solar:arrow-right-up-bold" size={16} />
        </Button>
      ),
    },
  ];

  const stockColumns: ColumnsType<PharmacyStockBalance> = [
    {
      title: "Medication & Code",
      dataIndex: "item_name",
      render: (v: string, r) => (
        <div>
          <span className="font-semibold text-xs text-foreground block">{v}</span>
          <span className="font-mono text-[10px] text-muted-foreground">{r.item_code}</span>
        </div>
      ),
    },
    {
      title: "Warehouse",
      dataIndex: "warehouse_name",
      width: 120,
      render: (v: string) => <span className="text-[11px] text-muted-foreground">{v}</span>,
    },
    {
      title: "Stock Level",
      dataIndex: "actual_qty",
      width: 130,
      render: (v: number, r) => {
        const reorder = r.reorder_level || 10;
        const percent = Math.min(100, Math.round((v / (reorder * 1.5)) * 100));
        const isOut = v <= 0;
        return (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className={`font-mono font-bold ${isOut ? "text-rose-600" : "text-amber-600 dark:text-amber-400"}`}>
                {v} {r.stock_uom || "units"}
              </span>
              <span className="text-[10px] text-muted-foreground">Min {reorder}</span>
            </div>
            <Progress
              value={percent}
              className={`h-1.5 ${isOut ? "[&>div]:bg-rose-500" : "[&>div]:bg-amber-500"}`}
            />
          </div>
        );
      },
    },
    {
      title: "Action",
      width: 80,
      align: "center",
      render: () => (
        <Button
          variant="outline"
          size="sm"
          className="h-6 px-2 text-[10px] border-emerald-500/30 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
          onClick={() => navigate("/healthcare/pharmacy/stock/intake")}
        >
          Intake
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PharmacyNavHeader
        title="Pharmacy Operations & Clinical Analytics"
        subtitle="Real-time dispensary monitoring, EEU staff prescription fulfillment, and stock ledgers."
      />

      {/* Low Stock Warning Banner */}
      {lowStockItems.length > 0 && (
        <div className="relative overflow-hidden rounded-xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent p-4 text-amber-800 dark:text-amber-200 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start sm:items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500 text-white shadow-sm shadow-amber-500/30">
                <Icon icon="solar:danger-triangle-bold" size={20} />
              </div>
              <div>
                <p className="font-bold text-sm">
                  Inventory Alert: {lowStockItems.length} Medication{lowStockItems.length > 1 ? "s" : ""} Below Safety Stock Buffer
                </p>
                <p className="text-xs text-amber-700/80 dark:text-amber-300/80">
                  Critical antibiotics and urgent emergency ward items require immediate procurement intake.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                size="sm"
                variant="outline"
                className="text-xs border-amber-500/40 bg-background/80 hover:bg-amber-500/10 text-amber-800 dark:text-amber-200"
                onClick={() => navigate("/healthcare/pharmacy/stock?low_stock=true")}
              >
                Inspect Shortages
              </Button>
              <Button
                size="sm"
                className="text-xs bg-amber-600 hover:bg-amber-700 text-white shadow-xs"
                onClick={() => navigate("/healthcare/pharmacy/stock/intake")}
              >
                <Icon icon="solar:box-bold" size={14} className="mr-1" />
                Receive Intake
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* KPI Stat Cards Grid (4 Primary Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Pending Inpatient Orders */}
        <Card
          className="relative overflow-hidden group hover:border-emerald-500/50 hover:shadow-md transition-all cursor-pointer border-border/70"
          onClick={() => navigate("/healthcare/pharmacy/medication-entry")}
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl group-hover:bg-emerald-500/10 transition-colors" />
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1.5 z-10">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                Pending Ward Orders
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold tracking-tight text-foreground">
                  {stats?.pending_inpatient_orders ?? 0}
                </span>
                <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full">
                  Live Queue
                </span>
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Icon icon="solar:clock-circle-bold" size={13} className="text-emerald-500" />
                Inpatient dosage review
              </p>
            </div>
            <div className="p-3.5 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/25 group-hover:scale-105 transition-transform">
              <Icon icon="solar:clipboard-check-bold" size={26} />
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Active Prescriptions Queue */}
        <Card
          className="relative overflow-hidden group hover:border-blue-500/50 hover:shadow-md transition-all cursor-pointer border-border/70"
          onClick={() => navigate("/healthcare/pharmacy/medication-requests")}
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full blur-2xl group-hover:bg-blue-500/10 transition-colors" />
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1.5 z-10">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                Active Prescriptions
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold tracking-tight text-foreground">
                  {stats?.active_prescriptions ?? 0}
                </span>
                <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded-full">
                  Outpatients
                </span>
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Icon icon="solar:pill-bold" size={13} className="text-blue-500" />
                Ready to dispense
              </p>
            </div>
            <div className="p-3.5 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-md shadow-blue-500/25 group-hover:scale-105 transition-transform">
              <Icon icon="solar:prescription-bold" size={26} />
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Dispensed Today */}
        <Card
          className="relative overflow-hidden group hover:border-purple-500/50 hover:shadow-md transition-all cursor-pointer border-border/70"
          onClick={() => navigate("/healthcare/pharmacy/outpatient")}
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-full blur-2xl group-hover:bg-purple-500/10 transition-colors" />
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1.5 z-10">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                Dispensed Today
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold tracking-tight text-foreground">
                  {stats?.dispensed_today ?? 0}
                </span>
                <span className="text-[11px] font-semibold text-purple-600 dark:text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded-full">
                  +14% vs avg
                </span>
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Icon icon="solar:check-circle-bold" size={13} className="text-purple-500" />
                Material stock issues
              </p>
            </div>
            <div className="p-3.5 rounded-2xl bg-gradient-to-br from-purple-500 to-violet-600 text-white shadow-md shadow-purple-500/25 group-hover:scale-105 transition-transform">
              <Icon icon="solar:check-read-bold" size={26} />
            </div>
          </CardContent>
        </Card>

        {/* Card 4: Low Stock Alerts */}
        <Card
          className="relative overflow-hidden group hover:border-amber-500/50 hover:shadow-md transition-all cursor-pointer border-border/70"
          onClick={() => navigate("/healthcare/pharmacy/stock?low_stock=true")}
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-2xl group-hover:bg-amber-500/10 transition-colors" />
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1.5 z-10">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                Low Stock Alerts
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold tracking-tight text-foreground">
                  {stats?.low_stock_items ?? 0}
                </span>
                <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded-full">
                  Action Req
                </span>
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Icon icon="solar:danger-triangle-bold" size={13} className="text-amber-500" />
                Under reorder point
              </p>
            </div>
            <div className="p-3.5 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-md shadow-amber-500/25 group-hover:scale-105 transition-transform">
              <Icon icon="solar:box-minimalistic-bold" size={26} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Visual Analytics Charts (Dispensing Volume & Category Breakdown) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left (2 Cols): 7-Day Dispensing Volume Trends */}
        <Card className="lg:col-span-2 border-border/70 shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Icon icon="solar:chart-square-bold-duotone" size={20} className="text-emerald-600" />
                Dispensing Throughput & Demand Trends
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Comparison of Outpatient POS Counter vs Prescription Fulfillment orders
              </p>
            </div>
            <Badge variant="outline" className="text-xs text-emerald-600 border-emerald-300 dark:border-emerald-800">
              Past 7 Days
            </Badge>
          </CardHeader>
          <CardContent className="pt-2">
            <Chart
              type="area"
              height={260}
              options={dispensingChartOptions}
              series={dispensingSeries}
            />
          </CardContent>
        </Card>

        {/* Right (1 Col): Stock Category Breakdown */}
        <Card className="border-border/70 shadow-xs flex flex-col justify-between">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Icon icon="solar:pie-chart-2-bold-duotone" size={20} className="text-blue-600" />
              Stock Formulary Breakdown
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Active inventory allocation across therapeutic drug classes
            </p>
          </CardHeader>
          <CardContent className="pt-2 flex flex-col items-center justify-center">
            <Chart
              type="donut"
              height={240}
              options={categoryChartOptions}
              series={categorySeries}
            />
          </CardContent>
        </Card>
      </div>

      {/* Operations Grid: Recent Inpatient Entries (2 Cols) + Quick Actions & Watchlist (1 Col) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent EEU Prescriptions */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="border-border/70 shadow-xs">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/60">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600">
                  <Icon icon="solar:clipboard-check-bold" size={18} />
                </div>
                <div>
                  <CardTitle className="text-base font-bold">
                    Recent Staff Prescriptions & Medication Requests
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Doctor prescriptions queue and dispensary fulfillment tracking
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center bg-muted/70 p-0.5 rounded-lg text-xs">
                  {(["All", "Active", "Completed"] as const).map((filter) => (
                    <button
                      key={filter}
                      type="button"
                      onClick={() => setEntryFilter(filter)}
                      className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                        entryFilter === filter
                          ? "bg-background text-foreground shadow-xs font-semibold"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {filter}
                    </button>
                  ))}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-8"
                  onClick={() => navigate("/healthcare/pharmacy/medication-requests")}
                >
                  View All
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table
                columns={requestColumns}
                dataSource={filteredRequests}
                rowKey="id"
                pagination={false}
                loading={loading}
                size="middle"
                className="[&_.ant-table-thead>tr>th]:bg-transparent"
              />
            </CardContent>
          </Card>
        </div>

        {/* Side Column: Quick Actions & Low Stock Watchlist */}
        <div className="space-y-6">
          {/* Quick Operations Console */}
          <Card className="border-border/70 shadow-xs">
            <CardHeader className="pb-3 border-b border-border/60">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Icon icon="solar:tuning-bold" size={17} className="text-emerald-600" />
                Pharmacy Command Hub
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-2.5">
              <Button
                variant="outline"
                className="w-full justify-start gap-3 h-14 border-emerald-500/40 bg-emerald-500/5 hover:bg-emerald-500/10 text-left transition-all"
                onClick={() => navigate("/healthcare/pharmacy/outpatient")}
              >
                <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-sm shrink-0">
                  <Icon icon="solar:bag-check-bold" size={20} />
                </div>
                <div className="truncate">
                  <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300 leading-tight">
                    Outpatient Dispensing POS
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    Prescriptions queue, walk-in OTC & billing receipt
                  </p>
                </div>
              </Button>

              <Button
                variant="outline"
                className="w-full justify-start gap-3 h-12 text-left hover:border-blue-500/40 transition-all"
                onClick={() => navigate("/healthcare/pharmacy/stock/intake")}
              >
                <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-600 shrink-0">
                  <Icon icon="solar:box-bold" size={18} />
                </div>
                <div className="truncate">
                  <p className="text-xs font-semibold leading-tight">Stock Intake Console</p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    Receive shipments, batch numbers & cold-chain
                  </p>
                </div>
              </Button>

              <Button
                variant="outline"
                className="w-full justify-start gap-3 h-12 text-left hover:border-purple-500/40 transition-all"
                onClick={() => navigate("/healthcare/pharmacy/medication-requests")}
              >
                <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-600 shrink-0">
                  <Icon icon="solar:pill-bold" size={18} />
                </div>
                <div className="truncate">
                  <p className="text-xs font-semibold leading-tight">Prescriptions Queue</p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    Review & dispense doctor prescriptions
                  </p>
                </div>
              </Button>

              <Button
                variant="outline"
                className="w-full justify-start gap-3 h-12 text-left hover:border-cyan-500/40 transition-all"
                onClick={() => navigate("/healthcare/pharmacy/medications")}
              >
                <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-600 shrink-0">
                  <Icon icon="solar:shield-check-bold" size={18} />
                </div>
                <div className="truncate">
                  <p className="text-xs font-semibold leading-tight">Formulary & Safety Rules</p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    Drug interaction matrix & clinical safety checker
                  </p>
                </div>
              </Button>
            </CardContent>
          </Card>

          {/* Critical Low Stock Watchlist */}
          <Card className="border-border/70 shadow-xs">
            <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-border/60">
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-amber-600 dark:text-amber-400">
                <Icon icon="solar:danger-triangle-bold" size={17} />
                Critical Low Stock ({lowStockItems.length})
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-7"
                onClick={() => navigate("/healthcare/pharmacy/stock?low_stock=true")}
              >
                View Ledger
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {lowStockItems.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-foreground px-4">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center mx-auto mb-2">
                    <Icon icon="solar:check-circle-bold" size={20} />
                  </div>
                  All pharmacy inventory levels are within safe operating buffer.
                </div>
              ) : (
                <Table
                  columns={stockColumns}
                  dataSource={lowStockItems.slice(0, 5)}
                  rowKey="item_id"
                  pagination={false}
                  size="small"
                  className="[&_.ant-table-thead>tr>th]:bg-transparent"
                />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
