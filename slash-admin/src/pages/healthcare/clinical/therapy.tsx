import { useState, useEffect, useCallback } from "react";
import { Icon } from "@/components/icon";
import { Button } from "@/ui/button";
import { Card, CardContent } from "@/ui/card";
import { Input } from "@/ui/input";
import { Badge } from "@/ui/badge";
import Table, { type ColumnsType } from "antd/es/table";
import Tag from "antd/es/tag";
import Progress from "antd/es/progress";
import { HealthcareApi, type TherapyPlan, type TherapySession, type Patient } from "@/api/services/healthcareService";
import { useDoctypePermissions } from "@/utils/permissions";
import { useNavigate, useSearchParams } from "react-router";
import NewTherapyPlanModal from "./components/NewTherapyPlanModal";
import NewTherapySessionModal from "./components/NewTherapySessionModal";
import { toast } from "sonner";

export default function TherapyPage() {
  const { canCreate } = useDoctypePermissions("Therapy Plan");
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const patientParam = searchParams.get("patient");
  const tabParam = searchParams.get("tab") || "plans";

  const [activeTab, setActiveTab] = useState<"plans" | "sessions">(
    tabParam === "sessions" ? "sessions" : "plans"
  );

  // Plans state
  const [plans, setPlans] = useState<TherapyPlan[]>([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [plansTotal, setPlansTotal] = useState(0);
  const [plansPage, setPlansPage] = useState(1);
  const [planSearch, setPlanSearch] = useState("");
  const [planStatusFilter, setPlanStatusFilter] = useState("All");

  // Sessions state
  const [sessions, setSessions] = useState<TherapySession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionsTotal, setSessionsTotal] = useState(0);
  const [sessionsPage, setSessionsPage] = useState(1);
  const [sessionSearch, setSessionSearch] = useState("");
  const [sessionStatusFilter, setSessionStatusFilter] = useState("All");

  // Filter Patient details
  const [filterPatient, setFilterPatient] = useState<Patient | null>(null);

  // Modals
  const [newPlanModalOpen, setNewPlanModalOpen] = useState(false);
  const [newSessionModalOpen, setNewSessionModalOpen] = useState(false);
  const [selectedPlanForSession, setSelectedPlanForSession] = useState<number | undefined>();

  // Load patient details if filtered
  useEffect(() => {
    if (patientParam) {
      HealthcareApi.patients
        .get(Number(patientParam))
        .then((p: any) => setFilterPatient(p))
        .catch(() => setFilterPatient(null));
    } else {
      setFilterPatient(null);
    }
  }, [patientParam]);

  // Load plans
  const loadPlans = useCallback(async () => {
    setPlansLoading(true);
    try {
      const params: Record<string, any> = { page: plansPage };
      if (patientParam) params.patient = patientParam;
      if (planStatusFilter !== "All") params.status = planStatusFilter;
      if (planSearch) params.search = planSearch;

      const res = await HealthcareApi.therapyPlans.list(params);
      setPlans(res.results || []);
      setPlansTotal(res.count || 0);
    } catch (err) {
      console.error(err);
    } finally {
      setPlansLoading(false);
    }
  }, [plansPage, patientParam, planStatusFilter, planSearch]);

  // Load sessions
  const loadSessions = useCallback(async () => {
    setSessionsLoading(true);
    try {
      const params: Record<string, any> = { page: sessionsPage };
      if (patientParam) params.patient = patientParam;
      if (sessionStatusFilter !== "All") params.status = sessionStatusFilter;
      if (sessionSearch) params.search = sessionSearch;

      const res = await HealthcareApi.therapySessions.list(params);
      setSessions(res.results || []);
      setSessionsTotal(res.count || 0);
    } catch (err) {
      console.error(err);
    } finally {
      setSessionsLoading(false);
    }
  }, [sessionsPage, patientParam, sessionStatusFilter, sessionSearch]);

  useEffect(() => {
    loadPlans();
  }, [loadPlans]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const clearPatientFilter = () => {
    searchParams.delete("patient");
    setSearchParams(searchParams);
  };

  const handleCompleteSession = async (sessionId: number) => {
    try {
      await HealthcareApi.therapySessions.complete(sessionId);
      toast.success("Therapy Session completed successfully.");
      loadSessions();
      loadPlans();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Failed to complete session.");
    }
  };

  const handleBookSessionForPlan = (plan: TherapyPlan) => {
    setSelectedPlanForSession(plan.id);
    setNewSessionModalOpen(true);
  };

  const planColumns: ColumnsType<TherapyPlan> = [
    {
      title: "Plan ID",
      dataIndex: "plan_id",
      width: 140,
      render: (v: string, r) => (
        <span className="font-mono text-xs font-semibold text-teal-600 dark:text-teal-400">
          {v || `#${r.id}`}
        </span>
      ),
    },
    {
      title: "Patient",
      dataIndex: "patient_name",
      width: 180,
      render: (v: string, r) => (
        <div>
          <button
            type="button"
            className="font-medium text-foreground hover:underline text-left"
            onClick={() => navigate(`/healthcare/patients/${r.patient}`)}
          >
            {v || `Patient #${r.patient}`}
          </button>
          <span className="text-[10px] text-muted-foreground block font-mono">ID: #{r.patient}</span>
        </div>
      ),
    },
    {
      title: "Therapy Type",
      dataIndex: "therapy_type_name",
      width: 180,
      render: (v: string) =>
        v ? (
          <Badge variant="outline" className="bg-teal-50/60 text-teal-800 border-teal-200 text-xs">
            {v}
          </Badge>
        ) : (
          <span className="text-muted-foreground text-xs">-</span>
        ),
    },
    {
      title: "Title & Clinical Goals",
      dataIndex: "title",
      render: (v: string, r) => (
        <div>
          <p className="font-semibold text-foreground text-xs">{v}</p>
          {r.goals && <p className="text-[11px] text-muted-foreground line-clamp-1">{r.goals}</p>}
        </div>
      ),
    },
    {
      title: "Rehabilitation Progress",
      width: 220,
      render: (_, r) => {
        const total = r.total_sessions || 1;
        const completed = r.completed_sessions || 0;
        const pct = Math.min(100, Math.round((completed / total) * 100));
        return (
          <div className="space-y-1">
            <div className="flex justify-between text-[11px] font-medium text-slate-700 dark:text-slate-300">
              <span>{completed} of {total} sessions</span>
              <span className="font-bold">{pct}%</span>
            </div>
            <Progress
              percent={pct}
              size="small"
              strokeColor={pct === 100 ? "#10b981" : "#0d9488"}
              showInfo={false}
            />
          </div>
        );
      },
    },
    {
      title: "Dates",
      width: 160,
      render: (_, r) => (
        <div className="text-[11px] text-muted-foreground">
          <div>Start: {r.start_date || "-"}</div>
          {r.end_date && <div>Target: {r.end_date}</div>}
        </div>
      ),
    },
    {
      title: "Status",
      dataIndex: "status",
      width: 110,
      render: (v: string) => {
        const isComplete = v === "Completed";
        const isActive = v === "Active" || v === "In Progress";
        return (
          <Tag color={isComplete ? "green" : isActive ? "cyan" : "default"}>
            {v || "Active"}
          </Tag>
        );
      },
    },
    {
      title: "Actions",
      width: 140,
      render: (_, r) => (
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            className="bg-teal-600 hover:bg-teal-700 text-white text-xs h-8 gap-1"
            title="Book Session against this plan"
            onClick={() => handleBookSessionForPlan(r)}
          >
            <Icon icon="solar:stopwatch-bold" size={14} />
            + Session
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-rose-500 hover:text-rose-700"
            title="Delete Plan"
            onClick={async () => {
              if (confirm("Are you sure you want to delete this Therapy Plan?")) {
                await HealthcareApi.therapyPlans.delete(r.id);
                loadPlans();
              }
            }}
          >
            <Icon icon="solar:trash-bin-trash-bold" size={15} />
          </Button>
        </div>
      ),
    },
  ];

  const sessionColumns: ColumnsType<TherapySession> = [
    {
      title: "Session ID",
      dataIndex: "session_id",
      width: 140,
      render: (v: string, r) => (
        <span className="font-mono text-xs font-semibold text-teal-600 dark:text-teal-400">
          {v || `#${r.id}`}
        </span>
      ),
    },
    {
      title: "Patient",
      dataIndex: "patient_name",
      width: 180,
      render: (v: string, r) => (
        <div>
          <button
            type="button"
            className="font-medium text-foreground hover:underline text-left text-xs"
            onClick={() => navigate(`/healthcare/patients/${r.patient}`)}
          >
            {v || `Patient #${r.patient}`}
          </button>
        </div>
      ),
    },
    {
      title: "Therapy Type",
      dataIndex: "therapy_type_name",
      width: 180,
      render: (v: string) =>
        v ? (
          <Badge variant="outline" className="bg-teal-50/60 text-teal-800 border-teal-200 text-xs">
            {v}
          </Badge>
        ) : (
          <span className="text-muted-foreground text-xs">-</span>
        ),
    },
    {
      title: "Therapy Plan",
      render: (_, r: any) =>
        r.plan_title ? (
          <div className="text-xs">
            <span className="font-semibold text-slate-800 dark:text-slate-200">{r.plan_title}</span>
            {r.plan_id_str && (
              <span className="text-[10px] text-muted-foreground block font-mono">
                {r.plan_id_str}
              </span>
            )}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">-</span>
        ),
    },
    {
      title: "Date & Time",
      width: 150,
      render: (_, r: any) => (
        <div className="text-xs">
          <div className="font-medium">{r.session_date}</div>
          {r.session_time && (
            <div className="text-[10px] text-muted-foreground">{r.session_time}</div>
          )}
        </div>
      ),
    },
    {
      title: "Duration",
      dataIndex: "duration",
      width: 90,
      render: (v: number) => <span className="text-xs">{v || 45} mins</span>,
    },
    {
      title: "Therapist",
      dataIndex: "practitioner_name",
      render: (v: string) => <span className="text-xs text-muted-foreground">{v || "-"}</span>,
    },
    {
      title: "Status",
      dataIndex: "status",
      width: 110,
      render: (v: string) => {
        const isDone = v === "Completed";
        return (
          <Tag color={isDone ? "green" : "blue"}>
            {v || "Scheduled"}
          </Tag>
        );
      },
    },
    {
      title: "Actions",
      width: 130,
      render: (_, r) => {
        const isScheduled = r.status === "Scheduled";
        return (
          <div className="flex items-center gap-1.5">
            {isScheduled ? (
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8 gap-1"
                onClick={() => handleCompleteSession(r.id)}
              >
                <Icon icon="solar:check-circle-bold" size={14} />
                Complete
              </Button>
            ) : (
              <span className="text-xs text-emerald-600 flex items-center gap-1">
                <Icon icon="solar:check-circle-bold" size={14} />
                Completed
              </span>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Icon icon="solar:meditation-bold-duotone" size={26} className="text-teal-600" />
            Rehabilitation & Physiotherapy
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage comprehensive rehabilitation programs, therapy types, multi-session plans, and session outcomes.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {canCreate && (
            <>
              <Button
                variant="outline"
                size="sm"
                className="h-9 text-xs gap-1.5 border-teal-200 text-teal-700 hover:bg-teal-50"
                onClick={() => {
                  setSelectedPlanForSession(undefined);
                  setNewSessionModalOpen(true);
                }}
              >
                <Icon icon="solar:stopwatch-bold" size={16} />
                + Log Session
              </Button>
              <Button
                size="sm"
                className="bg-teal-600 hover:bg-teal-700 text-white h-9 text-xs gap-1.5"
                onClick={() => setNewPlanModalOpen(true)}
              >
                <Icon icon="lucide:plus" size={16} />
                + New Therapy Plan
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Patient Filter Banner (Marley Parity) */}
      {patientParam && (
        <div className="flex items-center justify-between p-3.5 rounded-lg bg-teal-50/80 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-900 text-teal-900 dark:text-teal-200 text-xs">
          <div className="flex items-center gap-2">
            <Icon icon="solar:user-bold" size={18} className="text-teal-600 shrink-0" />
            <div>
              <span className="font-semibold">
                Viewing Rehab & Physiotherapy for Patient:{" "}
                <span className="underline font-bold">
                  {filterPatient?.patient_name || `Patient #${patientParam}`}
                </span>
              </span>
              <span className="text-muted-foreground ml-2 font-mono">(ID: #{patientParam})</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs bg-white dark:bg-slate-900"
              onClick={() => navigate(`/healthcare/patients/${patientParam}`)}
            >
              <Icon icon="solar:arrow-left-bold" size={12} className="mr-1" />
              Patient Dashboard
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs text-teal-700 hover:text-teal-900 hover:bg-teal-100"
              onClick={clearPatientFilter}
            >
              ✕ Clear Filter
            </Button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-border">
        <button
          type="button"
          onClick={() => setActiveTab("plans")}
          className={`pb-2.5 px-4 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === "plans"
              ? "border-teal-600 text-teal-600"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Icon icon="solar:meditation-bold-duotone" size={16} />
          Therapy Plans ({plansTotal})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("sessions")}
          className={`pb-2.5 px-4 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === "sessions"
              ? "border-teal-600 text-teal-600"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Icon icon="solar:stopwatch-bold-duotone" size={16} />
          Therapy Sessions ({sessionsTotal})
        </button>
      </div>

      {/* Plans Tab */}
      {activeTab === "plans" && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-center mb-4">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                {[
                  { key: "All", label: "All Plans" },
                  { key: "Active", label: "In Progress / Active" },
                  { key: "Completed", label: "Completed" },
                ].map((st) => (
                  <button
                    key={st.key}
                    type="button"
                    onClick={() => setPlanStatusFilter(st.key)}
                    className={`text-xs px-3 py-1.5 rounded-md font-medium transition-colors ${
                      planStatusFilter === st.key
                        ? "bg-foreground text-background"
                        : "bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>

              <div className="w-full sm:w-72">
                <Input
                  placeholder="Search plan title, patient..."
                  value={planSearch}
                  onChange={(e) => setPlanSearch(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <Table
              columns={planColumns}
              dataSource={plans}
              rowKey="id"
              loading={plansLoading}
              pagination={{
                current: plansPage,
                total: plansTotal,
                pageSize: 20,
                onChange: setPlansPage,
                showTotal: (total) => `${total} therapy plans`,
              }}
            />
          </CardContent>
        </Card>
      )}

      {/* Sessions Tab */}
      {activeTab === "sessions" && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-center mb-4">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                {[
                  { key: "All", label: "All Sessions" },
                  { key: "Scheduled", label: "Scheduled (Upcoming)" },
                  { key: "Completed", label: "Completed" },
                ].map((st) => (
                  <button
                    key={st.key}
                    type="button"
                    onClick={() => setSessionStatusFilter(st.key)}
                    className={`text-xs px-3 py-1.5 rounded-md font-medium transition-colors ${
                      sessionStatusFilter === st.key
                        ? "bg-foreground text-background"
                        : "bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>

              <div className="w-full sm:w-72">
                <Input
                  placeholder="Search patient, plan..."
                  value={sessionSearch}
                  onChange={(e) => setSessionSearch(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <Table
              columns={sessionColumns}
              dataSource={sessions}
              rowKey="id"
              loading={sessionsLoading}
              pagination={{
                current: sessionsPage,
                total: sessionsTotal,
                pageSize: 20,
                onChange: setSessionsPage,
                showTotal: (total) => `${total} therapy sessions`,
              }}
            />
          </CardContent>
        </Card>
      )}

      {/* Modals */}
      <NewTherapyPlanModal
        open={newPlanModalOpen}
        onOpenChange={setNewPlanModalOpen}
        defaultPatientId={patientParam ? Number(patientParam) : undefined}
        defaultPatientName={filterPatient?.patient_name}
        onSuccess={() => {
          loadPlans();
          loadSessions();
        }}
      />

      <NewTherapySessionModal
        open={newSessionModalOpen}
        onOpenChange={setNewSessionModalOpen}
        defaultPatientId={patientParam ? Number(patientParam) : undefined}
        defaultPatientName={filterPatient?.patient_name}
        defaultPlanId={selectedPlanForSession}
        onSuccess={() => {
          loadSessions();
          loadPlans();
        }}
      />
    </div>
  );
}
