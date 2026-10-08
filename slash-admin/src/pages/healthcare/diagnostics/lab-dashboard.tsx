import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router";
import { Icon } from "@/components/icon";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card";
import { Button } from "@/ui/button";
import { Badge } from "@/ui/badge";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/ui/dialog";
import Table, { type ColumnsType } from "antd/es/table";
import { Chart, useChart } from "@/components/chart";
import LabNavHeader from "./components/LabNavHeader";
import {
  HealthcareApi,
  type LabDashboardStats,
  type LabWorklistItem,
} from "@/api/services/healthcareService";
import { toast } from "sonner";

export default function LabDashboardPage() {
  const navigate = useNavigate();

  // Data states
  const [stats, setStats] = useState<LabDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState<"all" | "today" | "7d" | "30d">("all");
  const [department, setDepartment] = useState<string>("all");
  const [activeBenchTab, setActiveBenchTab] = useState<
    "urgent" | "accession" | "approval" | "recent" | "rejected"
  >("urgent");
  const [searchQuery, setSearchQuery] = useState("");

  // Action Modals State
  const [receiveModalOpen, setReceiveModalOpen] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [collectModalOpen, setCollectModalOpen] = useState(false);
  const [activeTest, setActiveTest] = useState<LabWorklistItem | null>(null);

  // Form states inside modals
  const [condition, setCondition] = useState("Acceptable");
  const [temperature, setTemperature] = useState("Ambient");
  const [rejectionReason, setRejectionReason] = useState("");
  const [collectorName, setCollectorName] = useState("");
  const [collectionSite, setCollectionSite] = useState("Venipuncture (Left Arm)");
  const [barcode, setBarcode] = useState("");
  const [processingAction, setProcessingAction] = useState(false);

  // Fetch Dashboard Stats from Backend
  const loadStats = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await HealthcareApi.labDashboard.stats({
        period,
        department: department === "all" ? undefined : department,
      });
      setStats(res);
    } catch (err: any) {
      console.error("Failed to load lab dashboard stats:", err);
      toast.error(err?.message || "Failed to load laboratory analytics");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [period, department]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  // One-click Approve Lab Test
  const handleApproveTest = async (testId: number) => {
    setProcessingAction(true);
    try {
      await HealthcareApi.labTests.approve(testId);
      toast.success("Lab result verified and approved! Doctor & patient notified.");
      await loadStats(true);
    } catch (err: any) {
      toast.error(err?.message || "Failed to approve lab test");
    } finally {
      setProcessingAction(false);
    }
  };

  // Open Receive Specimen Modal
  const openReceiveModal = (test: LabWorklistItem) => {
    setActiveTest(test);
    setCondition(test.specimen_condition || "Acceptable");
    setTemperature("Ambient");
    setReceiveModalOpen(true);
  };

  // Submit Receive Specimen
  const handleReceiveSpecimenSubmit = async () => {
    if (!activeTest) return;
    setProcessingAction(true);
    try {
      await HealthcareApi.labTests.receiveSpecimen(activeTest.id, {
        condition,
        temperature,
      });
      toast.success(`Specimen for ${activeTest.test_id} received at accessioning bench.`);
      setReceiveModalOpen(false);
      await loadStats(true);
    } catch (err: any) {
      toast.error(err?.message || "Failed to accept specimen");
    } finally {
      setProcessingAction(false);
    }
  };

  // Open Reject Specimen Modal
  const openRejectModal = (test: LabWorklistItem) => {
    setActiveTest(test);
    setRejectionReason("");
    setCondition("Hemolyzed");
    setRejectModalOpen(true);
  };

  // Submit Reject Specimen
  const handleRejectSpecimenSubmit = async () => {
    if (!activeTest) return;
    if (!rejectionReason.trim()) {
      toast.error("Please provide a clinical reason for rejecting this specimen.");
      return;
    }
    setProcessingAction(true);
    try {
      await HealthcareApi.labTests.rejectSpecimen(activeTest.id, {
        rejection_reason: rejectionReason,
        condition,
      });
      toast.error(`Specimen rejected for ${activeTest.test_id}. Recollection flagged.`);
      setRejectModalOpen(false);
      await loadStats(true);
    } catch (err: any) {
      toast.error(err?.message || "Failed to reject specimen");
    } finally {
      setProcessingAction(false);
    }
  };

  // Open Collect Sample Modal
  const openCollectModal = (test: LabWorklistItem) => {
    setActiveTest(test);
    setCollectorName(test.collected_by || "Phlebotomist");
    setCollectionSite("Venipuncture (Left Arm)");
    setBarcode(test.specimen_barcode || `SMP-${Date.now().toString().slice(-6)}`);
    setCollectModalOpen(true);
  };

  // Submit Collect Sample
  const handleCollectSampleSubmit = async () => {
    if (!activeTest) return;
    setProcessingAction(true);
    try {
      await HealthcareApi.labTests.collectSample(activeTest.id, {
        collected_by: collectorName,
        collection_site: collectionSite,
        barcode,
      });
      toast.success(`Sample collected & accessioned for ${activeTest.test_id}`);
      setCollectModalOpen(false);
      await loadStats(true);
    } catch (err: any) {
      toast.error(err?.message || "Failed to record sample collection");
    } finally {
      setProcessingAction(false);
    }
  };

  // Daily Trends Chart Options
  const dailyTrendsOptions = useChart({
    chart: {
      type: "area",
      toolbar: { show: false },
      zoom: { enabled: false },
    },
    colors: ["#3b82f6", "#8b5cf6", "#10b981"],
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
      categories: stats?.charts?.daily_trends?.categories || [
        "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"
      ],
      labels: { style: { colors: "#9ca3af", fontSize: "11px" } },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: {
      labels: { style: { colors: "#9ca3af", fontSize: "11px" } },
      min: 0,
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

  const dailyTrendsSeries = useMemo(() => {
    if (!stats?.charts?.daily_trends?.series) {
      return [
        { name: "Ordered", data: [4, 6, 8, 5, 9, 7, 6] },
        { name: "Completed", data: [3, 4, 6, 4, 8, 6, 5] },
        { name: "Approved", data: [3, 4, 5, 4, 7, 5, 5] },
      ];
    }
    return stats.charts.daily_trends.series;
  }, [stats]);

  // Department Donut Chart Options
  const departmentChartOptions = useChart({
    chart: { type: "donut" },
    labels: stats?.charts?.department_distribution?.labels?.length
      ? stats.charts.department_distribution.labels
      : ["Biochemistry", "Haematology", "Microbiology", "Serology", "Clinical Pathology"],
    colors: ["#06b6d4", "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899"],
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
              label: "Total Tests",
              fontSize: "12px",
              color: "#6b7280",
              formatter: () => `${stats?.kpis?.total_tests || 0}`,
            },
          },
        },
      },
    },
    dataLabels: { enabled: false },
    stroke: { width: 0 },
  });

  const departmentSeries = useMemo(() => {
    if (!stats?.charts?.department_distribution?.series?.length) {
      return [10, 8, 4, 2, 1];
    }
    return stats.charts.department_distribution.series;
  }, [stats]);

  // Current active worklist filtered by search query
  const currentWorklist = useMemo(() => {
    if (!stats?.worklists) return [];
    let list: LabWorklistItem[] = [];
    if (activeBenchTab === "urgent") list = stats.worklists.urgent_queue || [];
    else if (activeBenchTab === "accession") list = stats.worklists.accessioning_bench || [];
    else if (activeBenchTab === "approval") list = stats.worklists.pending_approval || [];
    else if (activeBenchTab === "recent") list = stats.worklists.recent_tests || [];
    else if (activeBenchTab === "rejected") list = stats.worklists.critical_rejected || [];

    if (!searchQuery.trim()) return list;

    const q = searchQuery.toLowerCase();
    return list.filter(
      (item) =>
        item.test_id.toLowerCase().includes(q) ||
        item.lab_test_name.toLowerCase().includes(q) ||
        item.patient.name.toLowerCase().includes(q) ||
        item.patient.patient_id.toLowerCase().includes(q) ||
        item.specimen_barcode.toLowerCase().includes(q) ||
        item.department_name.toLowerCase().includes(q)
    );
  }, [stats, activeBenchTab, searchQuery]);

  // Status badge styling helper
  const renderStatusBadge = (status: string) => {
    switch (status) {
      case "Approved":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Approved
          </span>
        );
      case "Completed":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30">
            <span className="h-1.5 w-1.5 rounded-full bg-purple-500 animate-pulse" />
            Completed
          </span>
        );
      case "Rejected":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
            Rejected
          </span>
        );
      case "Draft":
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-500/15 text-slate-700 dark:text-slate-300 border border-slate-500/30">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
            Draft / In Queue
          </span>
        );
    }
  };

  // Specimen status badge styling helper
  const renderSpecimenStatusBadge = (status: string) => {
    switch (status) {
      case "Received":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
            <Icon icon="solar:check-circle-bold" size={13} className="text-emerald-600" />
            Received at Bench
          </span>
        );
      case "Collected":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/20">
            <Icon icon="solar:pipette-bold" size={13} className="text-sky-600" />
            Sample Collected
          </span>
        );
      case "Pending Collection":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
            <Icon icon="solar:clock-circle-bold" size={13} className="text-amber-600" />
            Pending Phlebotomy
          </span>
        );
      case "Rejected":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20">
            <Icon icon="solar:close-circle-bold" size={13} className="text-rose-600" />
            Specimen Rejected
          </span>
        );
      default:
        return <span className="text-xs text-muted-foreground">{status}</span>;
    }
  };

  // Table Columns
  const worklistColumns: ColumnsType<LabWorklistItem> = [
    {
      title: "Test ID & Priority",
      dataIndex: "test_id",
      width: 170,
      render: (v: string, r) => (
        <div className="space-y-1">
          <div
            className="font-mono text-xs font-bold text-cyan-600 dark:text-cyan-400 hover:underline cursor-pointer flex items-center gap-1.5"
            onClick={() => navigate(`/healthcare/lab-tests/${r.id}`)}
          >
            <Icon icon="solar:test-tube-bold-duotone" size={14} />
            <span>{v}</span>
          </div>
          <div>
            {r.priority === "Urgent" || r.priority === "STAT" ? (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-extrabold uppercase bg-rose-500 text-white shadow-xs">
                <span className="h-1.5 w-1.5 rounded-full bg-white animate-ping" />
                {r.priority}
              </span>
            ) : (
              <span className="text-[10px] font-semibold text-muted-foreground px-1.5 py-0.2 bg-muted rounded">
                Routine
              </span>
            )}
          </div>
        </div>
      ),
    },
    {
      title: "Test Panel & Section",
      dataIndex: "lab_test_name",
      width: 220,
      render: (v: string, r) => (
        <div>
          <div className="font-semibold text-sm text-foreground line-clamp-1">{v}</div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
            <Icon icon="solar:hospital-line-duotone" size={13} />
            <span>{r.department_name}</span>
          </div>
        </div>
      ),
    },
    {
      title: "Patient Details",
      dataIndex: "patient",
      width: 200,
      render: (_, r) => (
        <div>
          <div
            className="font-semibold text-xs text-foreground hover:text-cyan-600 cursor-pointer flex items-center gap-1"
            onClick={() => navigate(`/healthcare/patients/${r.patient.id}`)}
          >
            <span>{r.patient.name}</span>
          </div>
          <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
            <span className="font-mono">{r.patient.patient_id}</span>
            <span>•</span>
            <span>
              {r.patient.age || "Adult"}, {r.patient.sex || "Patient"}
            </span>
          </div>
        </div>
      ),
    },
    {
      title: "Specimen & Barcode",
      dataIndex: "specimen_status",
      width: 210,
      render: (v: string, r) => (
        <div className="space-y-1">
          <div>{renderSpecimenStatusBadge(v)}</div>
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-mono">
            <Icon icon="solar:barcode-bold" size={13} className="text-cyan-600" />
            <span>{r.specimen_barcode || "No Barcode"}</span>
            <span className="text-muted-foreground/60">• {r.sample_name}</span>
          </div>
        </div>
      ),
    },
    {
      title: "Status",
      dataIndex: "status",
      width: 130,
      render: (v: string) => renderStatusBadge(v),
    },
    {
      title: "Clinician & Findings",
      dataIndex: "results_preview",
      render: (v: string, r) => (
        <div className="text-xs">
          <div className="text-muted-foreground flex items-center gap-1">
            <Icon icon="solar:stethoscope-bold" size={13} className="text-muted-foreground/70" />
            <span className="font-medium text-foreground/80">{r.practitioner_name}</span>
          </div>
          {v ? (
            <div className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1 bg-muted/40 px-1.5 py-0.5 rounded font-mono">
              {v}
            </div>
          ) : r.rejection_reason ? (
            <div className="text-[11px] text-rose-600 dark:text-rose-400 mt-0.5 line-clamp-1 font-medium">
              Reason: {r.rejection_reason}
            </div>
          ) : (
            <div className="text-[11px] text-muted-foreground/60 italic mt-0.5">
              Awaiting specimen processing
            </div>
          )}
        </div>
      ),
    },
    {
      title: "Actions",
      key: "actions",
      width: 170,
      align: "right",
      render: (_, r) => (
        <div className="flex items-center justify-end gap-1.5">
          {r.status === "Completed" && (
            <Button
              size="sm"
              variant="default"
              onClick={() => handleApproveTest(r.id)}
              disabled={processingAction}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] h-7 gap-1 shadow-xs"
            >
              <Icon icon="solar:check-circle-bold" size={13} />
              Approve
            </Button>
          )}

          {r.specimen_status === "Pending Collection" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => openCollectModal(r)}
              className="text-[11px] h-7 gap-1 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/40"
            >
              <Icon icon="solar:pipette-bold" size={13} />
              Collect
            </Button>
          )}

          {r.specimen_status === "Collected" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => openReceiveModal(r)}
              className="text-[11px] h-7 gap-1 border-sky-300 dark:border-sky-700 text-sky-700 dark:text-sky-300 hover:bg-sky-50 dark:hover:bg-sky-950/40"
            >
              <Icon icon="solar:import-bold" size={13} />
              Receive
            </Button>
          )}

          {(r.specimen_status === "Collected" || r.specimen_status === "Received") && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => openRejectModal(r)}
              className="text-[11px] h-7 gap-1 border-rose-300 dark:border-rose-800 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
              title="Reject Specimen"
            >
              <Icon icon="solar:close-circle-bold" size={13} />
              Reject
            </Button>
          )}

          <Button
            size="sm"
            variant="ghost"
            onClick={() => navigate(`/healthcare/lab-tests/${r.id}`)}
            className="text-[11px] h-7 px-2 hover:bg-muted"
            title="Open Lab Test Record"
          >
            <Icon icon="solar:pen-new-square-bold" size={14} className="text-muted-foreground" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* Laboratory Command Center Navigation & Sub-Tabs */}
      <LabNavHeader
        title="Clinical Laboratory Dashboard & Operations"
        subtitle="Real-time specimen accessioning, turnaround time tracking, STAT priority queues, and supervisor result verification benches."
        onRefresh={() => loadStats(true)}
        isRefreshing={refreshing}
      />

      {/* Filter and Period Selection Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm shadow-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground mr-1 flex items-center gap-1">
            <Icon icon="solar:calendar-bold-duotone" size={14} />
            Period:
          </span>
          {(["all", "today", "7d", "30d"] as const).map((p) => {
            const labelMap = { all: "All Time", today: "Today", "7d": "Last 7 Days", "30d": "Last 30 Days" };
            return (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                  period === p
                    ? "bg-cyan-600 text-white font-semibold shadow-xs"
                    : "bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {labelMap[p]}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Icon icon="solar:filter-bold-duotone" size={14} />
            <span>Section:</span>
          </div>
          <select
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            className="text-xs bg-background border border-border rounded-lg px-2.5 py-1.5 focus:outline-hidden focus:ring-1 focus:ring-cyan-500 font-medium text-foreground cursor-pointer"
          >
            <option value="all">All Laboratory Sections</option>
            {stats?.departments?.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Hero Operational KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        {/* Card 1: Total Orders */}
        <div className="col-span-2 rounded-2xl border border-border/70 bg-gradient-to-br from-cyan-500/10 via-card to-card p-4.5 shadow-xs hover:border-cyan-500/40 transition-all">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-semibold text-cyan-600 dark:text-cyan-400 uppercase tracking-wider">
              Total Lab Orders
            </span>
            <div className="p-2 rounded-xl bg-cyan-500/15 text-cyan-600 dark:text-cyan-400">
              <Icon icon="solar:test-tube-bold-duotone" size={20} />
            </div>
          </div>
          <div className="text-3xl font-extrabold tracking-tight text-foreground">
            {stats?.kpis?.total_tests || 0}
          </div>
          <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground">
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
              +{stats?.kpis?.today_orders || 0} today
            </span>
            <span>•</span>
            <span>{stats?.kpis?.test_templates_count || 71} panels</span>
          </div>
        </div>

        {/* Card 2: Awaiting Approval (Action Required) */}
        <div className="col-span-2 rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-card to-card p-4.5 shadow-xs hover:border-amber-500/50 transition-all">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-amber-500 animate-ping" />
              Awaiting Approval
            </span>
            <div className="p-2 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
              <Icon icon="solar:shield-check-bold-duotone" size={20} />
            </div>
          </div>
          <div className="text-3xl font-extrabold tracking-tight text-amber-600 dark:text-amber-400">
            {stats?.kpis?.awaiting_approval || 0}
          </div>
          <div className="mt-2 text-xs text-muted-foreground flex items-center justify-between">
            <span>Tests completed, pending sign-off</span>
            <span
              onClick={() => setActiveBenchTab("approval")}
              className="text-xs font-semibold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
            >
              Review Queue &rarr;
            </span>
          </div>
        </div>

        {/* Card 3: Specimen Accession Queue */}
        <div className="col-span-2 rounded-2xl border border-border/70 bg-gradient-to-br from-blue-500/10 via-card to-card p-4.5 shadow-xs hover:border-blue-500/40 transition-all">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
              Accession Queue
            </span>
            <div className="p-2 rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400">
              <Icon icon="solar:pipette-bold-duotone" size={20} />
            </div>
          </div>
          <div className="text-3xl font-extrabold tracking-tight text-foreground">
            {stats?.kpis?.pending_collection || 0}
          </div>
          <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground">
            <span className="text-sky-600 font-semibold">{stats?.kpis?.specimens_received || 0} at bench</span>
            <span>•</span>
            <span
              onClick={() => setActiveBenchTab("accession")}
              className="text-blue-600 hover:underline cursor-pointer font-medium"
            >
              Accession &rarr;
            </span>
          </div>
        </div>

        {/* Card 4: STAT / Urgent Triage */}
        <div className="col-span-2 rounded-2xl border border-rose-500/30 bg-gradient-to-br from-rose-500/10 via-card to-card p-4.5 shadow-xs hover:border-rose-500/50 transition-all">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-semibold text-rose-600 dark:text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
              <Icon icon="solar:danger-triangle-bold" size={14} className="text-rose-500" />
              STAT / Urgent Orders
            </span>
            <div className="p-2 rounded-xl bg-rose-500/15 text-rose-600 dark:text-rose-400">
              <Icon icon="solar:alarm-bold-duotone" size={20} />
            </div>
          </div>
          <div className="text-3xl font-extrabold tracking-tight text-rose-600 dark:text-rose-400">
            {stats?.kpis?.stat_urgent_count || 0}
          </div>
          <div className="mt-2 text-xs text-muted-foreground flex items-center justify-between">
            <span>High clinical priority</span>
            <span
              onClick={() => setActiveBenchTab("urgent")}
              className="text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
            >
              Triage &rarr;
            </span>
          </div>
        </div>
      </div>

      {/* Secondary Metrics Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="flex items-center justify-between p-3.5 rounded-xl border border-border/60 bg-card/60">
          <div>
            <div className="text-xs text-muted-foreground">Analyzing & In-Progress</div>
            <div className="text-xl font-bold text-foreground mt-0.5">{stats?.kpis?.in_progress || 0}</div>
          </div>
          <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-500">
            <Icon icon="solar:tuning-square-bold-duotone" size={18} />
          </div>
        </div>

        <div className="flex items-center justify-between p-3.5 rounded-xl border border-border/60 bg-card/60">
          <div>
            <div className="text-xs text-muted-foreground">Results Released & Approved</div>
            <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
              {stats?.kpis?.approved_count || 0}
            </div>
          </div>
          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
            <Icon icon="solar:check-circle-bold-duotone" size={18} />
          </div>
        </div>

        <div className="flex items-center justify-between p-3.5 rounded-xl border border-border/60 bg-card/60">
          <div>
            <div className="text-xs text-muted-foreground">Average Turnaround (TAT)</div>
            <div className="text-xl font-bold text-foreground mt-0.5">
              {stats?.kpis?.avg_tat_hours || 3.2} <span className="text-xs font-normal text-muted-foreground">hrs</span>
            </div>
          </div>
          <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-500">
            <Icon icon="solar:stopwatch-bold-duotone" size={18} />
          </div>
        </div>

        <div className="flex items-center justify-between p-3.5 rounded-xl border border-border/60 bg-card/60">
          <div>
            <div className="text-xs text-muted-foreground">Rejected Specimens</div>
            <div className="text-xl font-bold text-rose-600 dark:text-rose-400 mt-0.5">
              {stats?.kpis?.rejected_specimens || 0}
            </div>
          </div>
          <div className="p-2 rounded-lg bg-rose-500/10 text-rose-500">
            <Icon icon="solar:close-circle-bold-duotone" size={18} />
          </div>
        </div>
      </div>

      {/* Interactive Charts & Specimen Pipeline Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Daily Testing Volume Trend (Area Chart) */}
        <Card className="lg:col-span-2 border-border/70 shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Icon icon="solar:chart-2-bold-duotone" size={20} className="text-cyan-600" />
                Laboratory Testing Volume & Approvals Trend
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Comparison of daily orders created, tests completed by technicians, and final supervisor approvals
              </p>
            </div>
            <Badge variant="outline" className="text-xs font-normal">
              7-Day Rolling
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <Chart
                type="area"
                series={dailyTrendsSeries}
                options={dailyTrendsOptions}
                height="100%"
              />
            </div>
          </CardContent>
        </Card>

        {/* Department / Discipline Breakdown (Donut Chart) */}
        <Card className="border-border/70 shadow-xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Icon icon="solar:pie-chart-2-bold-duotone" size={20} className="text-blue-600" />
              Testing Sections Breakdown
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Test workload distributed across hospital lab disciplines
            </p>
          </CardHeader>
          <CardContent>
            <div className="h-72 flex items-center justify-center">
              <Chart
                type="donut"
                series={departmentSeries}
                options={departmentChartOptions}
                height="100%"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Specimen Custody Pipeline Step Chart & Top Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pipeline Funnel */}
        <Card className="lg:col-span-2 border-border/70 shadow-xs">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Icon icon="solar:route-bold-duotone" size={20} className="text-indigo-600" />
              Specimen Custody & Processing Pipeline
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              End-to-end clinical laboratory workflow progression from physician order to released diagnostic report
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {(stats?.charts?.specimen_pipeline || [
                { stage: "Order Placed", count: stats?.kpis?.total_tests || 0, color: "#6366f1" },
                { stage: "Pending Collection", count: stats?.kpis?.pending_collection || 0, color: "#f59e0b" },
                { stage: "Specimen Collected", count: stats?.kpis?.samples_collected || 0, color: "#0ea5e9" },
                { stage: "Received at Bench", count: stats?.kpis?.specimens_received || 0, color: "#10b981" },
                { stage: "Awaiting Sign-off", count: stats?.kpis?.awaiting_approval || 0, color: "#8b5cf6" },
                { stage: "Results Released", count: stats?.kpis?.approved_count || 0, color: "#059669" },
              ]).map((stage, idx) => (
                <div
                  key={stage.stage}
                  className="relative p-3.5 rounded-xl border border-border/60 bg-muted/30 flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                      Step 0{idx + 1}
                    </span>
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: stage.color }}
                    />
                  </div>
                  <div className="text-xl font-extrabold text-foreground">{stage.count}</div>
                  <div className="text-xs font-semibold text-foreground/80 mt-1 line-clamp-1">
                    {stage.stage}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Most Ordered Panels */}
        <Card className="border-border/70 shadow-xs">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Icon icon="solar:star-fall-bold-duotone" size={20} className="text-amber-500" />
              High-Frequency Diagnostic Panels
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Top requested tests across all clinical departments
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {(stats?.charts?.top_tests?.length
              ? stats.charts.top_tests
              : [
                  { name: "Complete Blood Count (CBC)", count: 7 },
                  { name: "Blood Glucose Fasting", count: 5 },
                  { name: "Lipid Profile Panel", count: 4 },
                  { name: "Liver Function Test (LFT)", count: 3 },
                  { name: "Renal Function Panel", count: 2 },
                  { name: "Thyroid Profile", count: 2 },
                ]
            ).map((test) => {
              const maxCount = Math.max(...(stats?.charts?.top_tests?.map((t) => t.count) || [7]), 1);
              const percentage = Math.round((test.count / maxCount) * 100);
              return (
                <div key={test.name} className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-medium">
                    <span className="text-foreground line-clamp-1">{test.name}</span>
                    <span className="font-mono text-muted-foreground">{test.count} orders</span>
                  </div>
                  <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-cyan-500 to-blue-600 rounded-full"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* Clinical Operations Workbenches & Queue Section */}
      <Card className="border-border/70 shadow-xs">
        <CardHeader className="pb-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Icon icon="solar:clipboard-list-bold-duotone" size={22} className="text-cyan-600" />
                Laboratory Operations Workbenches
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Manage phlebotomy accessions, STAT triage queues, and supervisor approval sign-offs
              </p>
            </div>

            {/* Workbench Search Bar */}
            <div className="w-full md:w-72">
              <Input
                placeholder="Search patient, test, barcode, ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 text-xs"
              />
            </div>
          </div>

          {/* Workbench Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pt-3 border-b border-border/40 scrollbar-none">
            {[
              {
                id: "urgent" as const,
                label: "🚨 STAT & Urgent Priority",
                count: stats?.worklists?.urgent_queue?.length || 0,
                alert: (stats?.worklists?.urgent_queue?.length || 0) > 0,
              },
              {
                id: "accession" as const,
                label: "📥 Specimen Accessioning Bench",
                count: stats?.worklists?.accessioning_bench?.length || 0,
                alert: false,
              },
              {
                id: "approval" as const,
                label: "🔬 Supervisor Approval Queue",
                count: stats?.worklists?.pending_approval?.length || 0,
                alert: (stats?.worklists?.pending_approval?.length || 0) > 0,
              },
              {
                id: "recent" as const,
                label: "📋 All Recent Lab Tests",
                count: stats?.worklists?.recent_tests?.length || 0,
                alert: false,
              },
              {
                id: "rejected" as const,
                label: "⚠️ Critical & Rejected Samples",
                count: stats?.worklists?.critical_rejected?.length || 0,
                alert: false,
              },
            ].map((tab) => {
              const active = activeBenchTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveBenchTab(tab.id)}
                  className={`flex items-center gap-2 px-3.5 py-2 border-b-2 text-xs font-semibold whitespace-nowrap cursor-pointer transition-all ${
                    active
                      ? "border-cyan-600 text-cyan-600 dark:text-cyan-400 font-bold"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                      active
                        ? "bg-cyan-600 text-white"
                        : tab.alert
                        ? "bg-rose-500 text-white animate-pulse"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>
        </CardHeader>

        <CardContent>
          <Table<LabWorklistItem>
            rowKey="id"
            columns={worklistColumns}
            dataSource={currentWorklist}
            loading={loading}
            pagination={{ pageSize: 8, showSizeChanger: false }}
            locale={{
              emptyText: (
                <div className="py-8 text-center text-muted-foreground space-y-2">
                  <Icon icon="solar:inbox-line-bold-duotone" size={36} className="mx-auto text-muted-foreground/40" />
                  <p className="text-xs font-medium">No tests currently in this workbench queue.</p>
                </div>
              ),
            }}
            className="border border-border/40 rounded-xl overflow-hidden"
          />
        </CardContent>
      </Card>

      {/* MODAL 1: Receive Physical Specimen at Accessioning Bench */}
      <Dialog open={receiveModalOpen} onOpenChange={setReceiveModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Icon icon="solar:import-bold-duotone" size={20} className="text-sky-600" />
              Receive Specimen at Accessioning Bench
            </DialogTitle>
            <DialogDescription className="text-xs">
              Verify specimen integrity, temperature, and labeling for physical intake into the laboratory.
            </DialogDescription>
          </DialogHeader>

          {activeTest && (
            <div className="space-y-4 py-2">
              <div className="p-3 rounded-lg bg-muted/40 border border-border/60 space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Order ID:</span>
                  <span className="font-mono font-bold text-foreground">{activeTest.test_id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Test Panel:</span>
                  <span className="font-semibold text-foreground">{activeTest.lab_test_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Patient:</span>
                  <span className="font-medium text-foreground">{activeTest.patient.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sample Type:</span>
                  <span className="font-medium text-foreground">{activeTest.sample_name}</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Specimen Condition</Label>
                <select
                  value={condition}
                  onChange={(e) => setCondition(e.target.value)}
                  className="w-full text-xs bg-background border border-border rounded-lg p-2 font-medium"
                >
                  <option value="Acceptable">Acceptable / Normal</option>
                  <option value="Hemolyzed">Hemolyzed</option>
                  <option value="Lipemic">Lipemic</option>
                  <option value="Icteric">Icteric</option>
                  <option value="Clotted">Clotted</option>
                  <option value="QNS">Quantity Not Sufficient (QNS)</option>
                  <option value="Leaked">Container Leaked / Damaged</option>
                  <option value="Unlabeled">Mislabeled / Unlabeled Tube</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Temperature on Receipt</Label>
                <select
                  value={temperature}
                  onChange={(e) => setTemperature(e.target.value)}
                  className="w-full text-xs bg-background border border-border rounded-lg p-2 font-medium"
                >
                  <option value="Ambient">Ambient (15-25°C)</option>
                  <option value="Refrigerated">Refrigerated (2-8°C)</option>
                  <option value="Frozen">Frozen (&lt;-20°C)</option>
                </select>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setReceiveModalOpen(false)}
              disabled={processingAction}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleReceiveSpecimenSubmit}
              disabled={processingAction}
              className="bg-sky-600 hover:bg-sky-700 text-white"
            >
              <Icon icon="solar:check-circle-bold" size={16} />
              Confirm Receipt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 2: Reject Physical Specimen */}
      <Dialog open={rejectModalOpen} onOpenChange={setRejectModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-600">
              <Icon icon="solar:danger-triangle-bold" size={20} />
              Reject Physical Specimen
            </DialogTitle>
            <DialogDescription className="text-xs">
              Specimen will be marked rejected and ordering clinician will be notified for immediate recollection.
            </DialogDescription>
          </DialogHeader>

          {activeTest && (
            <div className="space-y-4 py-2">
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs space-y-1">
                <div className="flex justify-between font-semibold text-rose-700 dark:text-rose-300">
                  <span>{activeTest.test_id}</span>
                  <span>{activeTest.lab_test_name}</span>
                </div>
                <div className="text-muted-foreground">Patient: {activeTest.patient.name}</div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Defect Condition</Label>
                <select
                  value={condition}
                  onChange={(e) => setCondition(e.target.value)}
                  className="w-full text-xs bg-background border border-border rounded-lg p-2 font-medium"
                >
                  <option value="Hemolyzed">Hemolyzed</option>
                  <option value="Clotted">Clotted (Micro-clots)</option>
                  <option value="QNS">Quantity Not Sufficient (QNS)</option>
                  <option value="Leaked">Container Leaked / Damaged</option>
                  <option value="Unlabeled">Mislabeled / Unlabeled Tube</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Clinical Justification & Notes *</Label>
                <Input
                  placeholder="e.g. Gross hemolysis observed; redraw required."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="text-xs"
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRejectModalOpen(false)}
              disabled={processingAction}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleRejectSpecimenSubmit}
              disabled={processingAction}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              <Icon icon="solar:close-circle-bold" size={16} />
              Confirm Rejection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 3: Collect Sample Dialog */}
      <Dialog open={collectModalOpen} onOpenChange={setCollectModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Icon icon="solar:pipette-bold-duotone" size={20} className="text-cyan-600" />
              Collect & Accession Sample
            </DialogTitle>
            <DialogDescription className="text-xs">
              Log phlebotomy collection time, collector name, site, and sample barcode.
            </DialogDescription>
          </DialogHeader>

          {activeTest && (
            <div className="space-y-4 py-2">
              <div className="p-3 rounded-lg bg-muted/40 border border-border/60 space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Test:</span>
                  <span className="font-semibold text-foreground">{activeTest.lab_test_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Patient:</span>
                  <span className="font-medium text-foreground">{activeTest.patient.name}</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Phlebotomist / Collector</Label>
                <Input
                  value={collectorName}
                  onChange={(e) => setCollectorName(e.target.value)}
                  placeholder="Collector Full Name"
                  className="text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Anatomical Collection Site</Label>
                <select
                  value={collectionSite}
                  onChange={(e) => setCollectionSite(e.target.value)}
                  className="w-full text-xs bg-background border border-border rounded-lg p-2 font-medium"
                >
                  <option value="Venipuncture (Left Arm)">Venipuncture (Left Arm)</option>
                  <option value="Venipuncture (Right Arm)">Venipuncture (Right Arm)</option>
                  <option value="Capillary (Fingerstick)">Capillary (Fingerstick)</option>
                  <option value="Midstream Clean Catch">Midstream Clean Catch</option>
                  <option value="Nasopharyngeal Swab">Nasopharyngeal Swab</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Tube Barcode / Specimen ID</Label>
                <Input
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  placeholder="e.g. SMP-2610-0012"
                  className="text-xs font-mono"
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCollectModalOpen(false)}
              disabled={processingAction}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleCollectSampleSubmit}
              disabled={processingAction}
              className="bg-cyan-600 hover:bg-cyan-700 text-white"
            >
              <Icon icon="solar:check-circle-bold" size={16} />
              Save Sample Collection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
