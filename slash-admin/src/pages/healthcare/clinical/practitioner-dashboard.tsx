import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router";
import { Icon } from "@/components/icon";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card";
import { Button } from "@/ui/button";
import { Badge } from "@/ui/badge";
import { Input } from "@/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/ui/tabs";
import Table, { type ColumnsType } from "antd/es/table";
import {
  HealthcareApi,
  type PatientAppointment,
  type PatientEncounter,
  type LabTest,
  type DrugPrescription,
} from "@/api/services/healthcareService";
import { useUserInfo } from "@/store/userStore";
import { formatTime12 } from "@/utils/timeFormat";
import { toast } from "sonner";

export default function PractitionerDashboard() {
  const navigate = useNavigate();
  const user = useUserInfo();

  // Data states
  const [loading, setLoading] = useState(true);
  const [appointments, setAppointments] = useState<PatientAppointment[]>([]);
  const [encounters, setEncounters] = useState<PatientEncounter[]>([]);
  const [labTests, setLabTests] = useState<LabTest[]>([]);
  const [prescriptions, setPrescriptions] = useState<DrugPrescription[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"appointments" | "encounters" | "labs" | "rx">("appointments");

  // Load clinical practitioner data
  const loadPractitionerData = useCallback(async () => {
    setLoading(true);
    try {
      const [todayApptsRes, encsRes, labsRes, rxRes] = await Promise.all([
        HealthcareApi.appointments.today().catch((err) => {
          console.warn("Appointments error:", err);
          return [] as PatientAppointment[];
        }),
        HealthcareApi.encounters.list({ page_size: 15, ordering: "-id" }).catch((err) => {
          console.warn("Encounters error:", err);
          return { results: [] as PatientEncounter[] };
        }),
        HealthcareApi.labTests.list({ page_size: 10, ordering: "-id" }).catch((err: any) => {
          console.warn("Lab tests error:", err);
          return { results: [] as LabTest[] };
        }),
        HealthcareApi.prescriptions.list({ page_size: 10, ordering: "-id" }).catch((err: any) => {
          console.warn("Prescriptions error:", err);
          return { results: [] as DrugPrescription[] };
        }),
      ]);

      const apptList = Array.isArray(todayApptsRes) ? todayApptsRes : (todayApptsRes as any)?.results || [];
      setAppointments(apptList);
      setEncounters(encsRes?.results || []);
      setLabTests(labsRes?.results || []);
      setPrescriptions(rxRes?.results || []);
    } catch (err: any) {
      console.error("Failed loading practitioner dashboard data:", err);
      toast.error(err?.message || "Failed to load clinical data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPractitionerData();
  }, [loadPractitionerData]);

  // Computed KPI Metrics
  const metrics = useMemo(() => {
    const todayAssigned = appointments.length;
    const inProgressDrafts = encounters.filter((e) => e.status === "Draft").length;
    const pendingLabs = labTests.filter((l) => l.status === "Pending" || l.status === "In Progress").length;
    const completedEncounters = encounters.filter((e) => e.status === "Submitted").length;
    const prescriptionsTotal = prescriptions.length;

    return {
      todayAssigned,
      inProgressDrafts,
      pendingLabs,
      completedEncounters,
      prescriptionsTotal,
    };
  }, [appointments, encounters, labTests, prescriptions]);

  // Filtered Appointments
  const filteredAppointments = useMemo(() => {
    if (!searchQuery.trim()) return appointments;
    const q = searchQuery.toLowerCase().trim();
    return appointments.filter(
      (a) =>
        (a.patient_name || "").toLowerCase().includes(q) ||
        (a.appointment_id || String(a.patient)).toLowerCase().includes(q) ||
        (a.department_name || "").toLowerCase().includes(q)
    );
  }, [appointments, searchQuery]);

  // Appointment Table Columns
  const appointmentColumns: ColumnsType<PatientAppointment> = [
    {
      title: "Time / Slot",
      key: "time",
      width: 130,
      render: (_, record) => (
        <div className="flex flex-col">
          <span className="font-semibold text-sm text-foreground">
            {record.appointment_time ? formatTime12(record.appointment_time) : "Anytime Today"}
          </span>
          {record.status === "Checked In" ? (
            <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400">
              Arrived (Queue #{record.position_in_queue || 1})
            </span>
          ) : (
            <span className="text-[11px] text-muted-foreground">{record.status}</span>
          )}
        </div>
      ),
    },
    {
      title: "Patient Details",
      key: "patient",
      render: (_, record) => (
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300 flex items-center justify-center font-bold text-sm shrink-0">
            {(record.patient_name?.[0] || "P").toUpperCase()}
          </div>
          <div className="flex flex-col min-w-0">
            <span
              className="font-medium text-sm text-foreground hover:text-purple-600 cursor-pointer truncate"
              onClick={() => navigate(`/healthcare/patients/${record.patient}`)}
            >
              {record.patient_name || "Unknown Patient"}
            </span>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="font-mono">{record.appointment_id || `ID #${record.patient}`}</span>
              {record.patient_sex && <span>• {record.patient_sex}</span>}
              {record.patient_age && <span>• {record.patient_age} yrs</span>}
            </div>
          </div>
        </div>
      ),
    },
    {
      title: "Visit Type & Department",
      key: "visit",
      render: (_, record) => (
        <div className="flex flex-col">
          <span className="text-sm font-medium text-foreground">
            {record.appointment_type_name || "Consultation"}
          </span>
          <span className="text-xs text-muted-foreground">
            {record.department_name || "General Medicine"}
          </span>
        </div>
      ),
    },
    {
      title: "Status",
      key: "status",
      width: 130,
      render: (_, record) => {
        const status = record.status;
        let badgeColor = "bg-slate-100 text-slate-700 border-slate-300";
        if (status === "Checked In") {
          badgeColor = "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/50 dark:text-amber-300";
        } else if (status === "Confirmed" || status === "Open") {
          badgeColor = "bg-sky-100 text-sky-800 border-sky-300 dark:bg-sky-950/50 dark:text-sky-300";
        } else if (status === "Checked Out" || status === "Closed") {
          badgeColor = "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300";
        }
        return (
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${badgeColor}`}>
            {status}
          </span>
        );
      },
    },
    {
      title: "Clinical Action",
      key: "action",
      width: 170,
      align: "right",
      render: (_, record) => {
        return (
          <div className="flex items-center justify-end gap-1.5">
            <Button
              size="sm"
              className="bg-purple-600 hover:bg-purple-700 text-white font-medium text-xs shadow-sm"
              onClick={() => {
                navigate(
                  `/healthcare/encounters/new?patient=${record.patient}&appointment=${record.id}&practitioner=${record.practitioner || ""}`
                );
              }}
            >
              <Icon icon="solar:stethoscope-bold" className="mr-1.5" size={15} />
              Consult Now
            </Button>
          </div>
        );
      },
    },
  ];

  // Encounter Table Columns
  const encounterColumns: ColumnsType<PatientEncounter> = [
    {
      title: "Encounter ID / Date",
      key: "date",
      width: 160,
      render: (_, record) => (
        <div className="flex flex-col">
          <span
            className="font-bold text-xs text-purple-600 dark:text-purple-400 hover:underline cursor-pointer font-mono"
            onClick={() => navigate(`/healthcare/encounters/${record.id}`)}
          >
            {record.encounter_id || `ENC-${record.id}`}
          </span>
          <span className="text-xs text-muted-foreground">
            {record.encounter_date || "Today"}
          </span>
        </div>
      ),
    },
    {
      title: "Patient",
      key: "patient",
      render: (_, record) => (
        <div className="flex flex-col">
          <span
            className="font-medium text-sm text-foreground hover:underline cursor-pointer"
            onClick={() => navigate(`/healthcare/patients/${record.patient}`)}
          >
            {record.patient_name || "Patient"}
          </span>
          <span className="text-xs text-muted-foreground">
            Type: {record.appointment_type_name || "Outpatient Consultation"}
          </span>
        </div>
      ),
    },
    {
      title: "Chief Complaint / Diagnosis",
      key: "complaint",
      render: (_, record) => (
        <div className="max-w-xs truncate text-xs text-foreground">
          {record.symptoms || record.clinical_notes || "Routine consultation assessment"}
        </div>
      ),
    },
    {
      title: "Status",
      key: "status",
      width: 120,
      render: (_, record) => {
        const isDraft = record.status === "Draft";
        return (
          <Badge
            variant={isDraft ? "secondary" : "default"}
            className={
              isDraft
                ? "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300"
                : "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300"
            }
          >
            {record.status}
          </Badge>
        );
      },
    },
    {
      title: "Action",
      key: "action",
      width: 110,
      align: "right",
      render: (_, record) => (
        <Button
          size="sm"
          variant="outline"
          className="text-xs"
          onClick={() => navigate(`/healthcare/encounters/${record.id}`)}
        >
          {record.status === "Draft" ? "Resume" : "Review"}
        </Button>
      ),
    },
  ];

  // Lab Test Columns
  const labColumns: ColumnsType<LabTest> = [
    {
      title: "Test / Code",
      key: "test",
      render: (_, record) => (
        <div className="flex flex-col">
          <span
            className="font-semibold text-sm text-foreground hover:underline cursor-pointer"
            onClick={() => navigate(`/healthcare/lab-tests/${record.id}`)}
          >
            {record.lab_test_name || "Diagnostic Test"}
          </span>
          <span className="text-xs font-mono text-muted-foreground">{record.test_id || `LAB-${record.id}`}</span>
        </div>
      ),
    },
    {
      title: "Patient",
      dataIndex: "patient_name",
      key: "patient",
      render: (val, record) => (
        <span
          className="font-medium text-xs hover:underline cursor-pointer"
          onClick={() => navigate(`/healthcare/patients/${record.patient}`)}
        >
          {val || "Patient"}
        </span>
      ),
    },
    {
      title: "Department",
      dataIndex: "department_name",
      key: "dept",
      render: (val) => <span className="text-xs text-muted-foreground">{val || "Laboratory"}</span>,
    },
    {
      title: "Status",
      key: "status",
      render: (_, record) => {
        const s = record.status;
        let color = "bg-slate-100 text-slate-700";
        if (s === "Completed") color = "bg-emerald-100 text-emerald-800 border-emerald-300";
        if (s === "In Progress") color = "bg-blue-100 text-blue-800 border-blue-300";
        if (s === "Pending") color = "bg-amber-100 text-amber-800 border-amber-300";
        return (
          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border ${color}`}>
            {s}
          </span>
        );
      },
    },
    {
      title: "Report",
      key: "report",
      align: "right",
      render: (_, record) => (
        <Button
          size="sm"
          variant="ghost"
          className="text-xs text-sky-600"
          onClick={() => navigate(`/healthcare/lab-tests/${record.id}`)}
        >
          View Result
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner & Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-purple-700 via-indigo-700 to-blue-800 p-6 md:p-8 text-white shadow-lg">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md text-xs font-semibold text-purple-100 border border-white/20">
              <Icon icon="solar:stethoscope-bold-duotone" size={16} />
              EEU Health Services • Clinical Practitioner & Physician Suite
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
              Practitioner Clinical Hub
            </h1>
            <p className="text-purple-100/90 text-sm md:text-base leading-relaxed">
              Conduct patient consultations, record vital signs, formulate clinical diagnoses, prescribe medications, and order laboratory diagnostics.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              className="bg-white text-purple-900 hover:bg-purple-50 font-bold shadow-md"
              onClick={() => navigate("/healthcare/encounters/new")}
            >
              <Icon icon="solar:notes-bold" className="mr-2" size={18} />
              New Encounter
            </Button>
            <Button
              variant="outline"
              className="bg-white/10 hover:bg-white/20 text-white border-white/30 backdrop-blur-sm"
              onClick={() => navigate("/healthcare/prescriptions")}
            >
              <Icon icon="solar:document-medicine-bold" className="mr-2" size={18} />
              E-Prescriptions
            </Button>
            <Button
              variant="outline"
              className="bg-white/10 hover:bg-white/20 text-white border-white/30 backdrop-blur-sm"
              onClick={loadPractitionerData}
            >
              <Icon icon="solar:refresh-bold" className={loading ? "animate-spin" : ""} size={18} />
            </Button>
          </div>
        </div>

        {/* Decorative background glow */}
        <div className="absolute right-0 top-0 -mt-10 -mr-10 h-64 w-64 rounded-full bg-white/10 blur-3xl pointer-events-none" />
      </div>

      {/* KPI Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-purple-500 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                Assigned Consultations
              </p>
              <h3 className="text-2xl font-bold text-foreground mt-1">
                {metrics.todayAssigned}
              </h3>
            </div>
            <div className="h-10 w-10 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 flex items-center justify-center">
              <Icon icon="solar:calendar-date-bold-duotone" size={24} />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                Active Draft Encounters
              </p>
              <h3 className="text-2xl font-bold text-foreground mt-1">
                {metrics.inProgressDrafts}
              </h3>
            </div>
            <div className="h-10 w-10 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center">
              <Icon icon="solar:pen-bold-duotone" size={24} />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-sky-500 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                Pending Lab Tests
              </p>
              <h3 className="text-2xl font-bold text-foreground mt-1">
                {metrics.pendingLabs}
              </h3>
            </div>
            <div className="h-10 w-10 rounded-xl bg-sky-50 dark:bg-sky-950/40 text-sky-600 flex items-center justify-center">
              <Icon icon="solar:test-tube-bold-duotone" size={24} />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-500 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                Prescriptions Issued
              </p>
              <h3 className="text-2xl font-bold text-foreground mt-1">
                {metrics.prescriptionsTotal}
              </h3>
            </div>
            <div className="h-10 w-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center">
              <Icon icon="solar:pill-bold-duotone" size={24} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Clinical Tool Actions */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <Button
          variant="outline"
          className="h-auto py-3 px-2 flex flex-col items-center gap-1.5 hover:border-purple-500 hover:bg-purple-50/50 dark:hover:bg-purple-950/20"
          onClick={() => navigate("/healthcare/vital-signs")}
        >
          <Icon icon="solar:heart-pulse-bold-duotone" className="text-rose-500" size={22} />
          <span className="text-xs font-semibold">Record Vitals</span>
        </Button>

        <Button
          variant="outline"
          className="h-auto py-3 px-2 flex flex-col items-center gap-1.5 hover:border-purple-500 hover:bg-purple-50/50 dark:hover:bg-purple-950/20"
          onClick={() => navigate("/healthcare/lab-tests/new")}
        >
          <Icon icon="solar:test-tube-bold-duotone" className="text-sky-500" size={22} />
          <span className="text-xs font-semibold">Order Lab Test</span>
        </Button>

        <Button
          variant="outline"
          className="h-auto py-3 px-2 flex flex-col items-center gap-1.5 hover:border-purple-500 hover:bg-purple-50/50 dark:hover:bg-purple-950/20"
          onClick={() => navigate("/healthcare/pharmacy/medication-requests/new")}
        >
          <Icon icon="solar:pill-bold-duotone" className="text-emerald-500" size={22} />
          <span className="text-xs font-semibold">E-Prescribe</span>
        </Button>

        <Button
          variant="outline"
          className="h-auto py-3 px-2 flex flex-col items-center gap-1.5 hover:border-purple-500 hover:bg-purple-50/50 dark:hover:bg-purple-950/20"
          onClick={() => navigate("/healthcare/medical-leave-slips/new")}
        >
          <Icon icon="solar:document-medicine-bold-duotone" className="text-amber-500" size={22} />
          <span className="text-xs font-semibold">Sick Leave Slip</span>
        </Button>

        <Button
          variant="outline"
          className="h-auto py-3 px-2 flex flex-col items-center gap-1.5 hover:border-purple-500 hover:bg-purple-50/50 dark:hover:bg-purple-950/20"
          onClick={() => navigate("/healthcare/external-referrals/new")}
        >
          <Icon icon="solar:square-share-line-bold-duotone" className="text-purple-500" size={22} />
          <span className="text-xs font-semibold">Refer Specialist</span>
        </Button>

        <Button
          variant="outline"
          className="h-auto py-3 px-2 flex flex-col items-center gap-1.5 hover:border-purple-500 hover:bg-purple-50/50 dark:hover:bg-purple-950/20"
          onClick={() => navigate("/healthcare/patient-history")}
        >
          <Icon icon="solar:history-bold-duotone" className="text-indigo-500" size={22} />
          <span className="text-xs font-semibold">Patient History</span>
        </Button>
      </div>

      {/* Main Operational Tables Area */}
      <Card className="shadow-sm border">
        <CardHeader className="p-4 md:p-6 pb-2 border-b">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <Tabs
              value={activeTab}
              onValueChange={(v) => setActiveTab(v as any)}
              className="w-full"
            >
              <TabsList className="bg-muted">
                <TabsTrigger value="appointments" className="text-xs md:text-sm font-medium">
                  <Icon icon="solar:calendar-mark-bold" className="mr-1.5" size={16} />
                  Today's Consultation Queue ({appointments.length})
                </TabsTrigger>
                <TabsTrigger value="encounters" className="text-xs md:text-sm font-medium">
                  <Icon icon="solar:notes-bold" className="mr-1.5" size={16} />
                  My Clinical Encounters ({encounters.length})
                </TabsTrigger>
                <TabsTrigger value="labs" className="text-xs md:text-sm font-medium">
                  <Icon icon="solar:test-tube-bold" className="mr-1.5" size={16} />
                  Diagnostic Lab Results ({labTests.length})
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="relative w-full md:w-64">
              <Icon
                icon="solar:magnifer-linear"
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                size={16}
              />
              <Input
                placeholder="Search patient, complaint, ID..."
                className="pl-8 text-xs h-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {activeTab === "appointments" && (
            <Table
              columns={appointmentColumns}
              dataSource={filteredAppointments}
              rowKey="id"
              loading={loading}
              pagination={{ pageSize: 10 }}
              className="border-0"
              locale={{
                emptyText: (
                  <div className="py-12 text-center text-muted-foreground">
                    <Icon icon="solar:calendar-minimalistic-linear" size={48} className="mx-auto mb-2 opacity-40" />
                    <p className="font-medium">No scheduled consultations for today.</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Start a direct consultation anytime using "New Encounter".
                    </p>
                  </div>
                ),
              }}
            />
          )}

          {activeTab === "encounters" && (
            <Table
              columns={encounterColumns}
              dataSource={encounters}
              rowKey="id"
              loading={loading}
              pagination={{ pageSize: 10 }}
              className="border-0"
              locale={{
                emptyText: (
                  <div className="py-12 text-center text-muted-foreground">
                    <Icon icon="solar:notes-linear" size={48} className="mx-auto mb-2 opacity-40" />
                    <p className="font-medium">No clinical encounters recorded yet.</p>
                  </div>
                ),
              }}
            />
          )}

          {activeTab === "labs" && (
            <Table
              columns={labColumns}
              dataSource={labTests}
              rowKey="id"
              loading={loading}
              pagination={{ pageSize: 10 }}
              className="border-0"
              locale={{
                emptyText: (
                  <div className="py-12 text-center text-muted-foreground">
                    <Icon icon="solar:test-tube-linear" size={48} className="mx-auto mb-2 opacity-40" />
                    <p className="font-medium">No lab tests ordered recently.</p>
                  </div>
                ),
              }}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
