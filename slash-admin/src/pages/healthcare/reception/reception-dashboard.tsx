import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router";
import { Icon } from "@/components/icon";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card";
import { Button } from "@/ui/button";
import { Badge } from "@/ui/badge";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/ui/dialog";
import Table, { type ColumnsType } from "antd/es/table";
import {
  HealthcareApi,
  type PatientAppointment,
  type Patient,
} from "@/api/services/healthcareService";
import { formatTime12 } from "@/utils/timeFormat";
import { toast } from "sonner";
import eeuLogoImg from "@/assets/images/eeu-logo.png";

export default function ReceptionDashboard() {
  const navigate = useNavigate();

  // Data states
  const [loading, setLoading] = useState(true);
  const [appointments, setAppointments] = useState<PatientAppointment[]>([]);
  const [recentPatients, setRecentPatients] = useState<Patient[]>([]);
  const [totalPatientsCount, setTotalPatientsCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<"appointments" | "queue" | "patients">("appointments");

  // Check-in action loading
  const [checkingInId, setCheckingInId] = useState<number | null>(null);

  // Quick Book modal state
  const [bookModalOpen, setBookModalOpen] = useState(false);

  // Load dashboard data
  const loadDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const [todayApptsRes, patientsRes] = await Promise.all([
        HealthcareApi.appointments.today().catch((err) => {
          console.warn("Failed fetching today appointments:", err);
          return [] as PatientAppointment[];
        }),
        HealthcareApi.patients.list({ page_size: 8, ordering: "-id" }).catch((err) => {
          console.warn("Failed fetching recent patients:", err);
          return { results: [], count: 0 };
        }),
      ]);

      const apptsList = Array.isArray(todayApptsRes) ? todayApptsRes : (todayApptsRes as any)?.results || [];
      setAppointments(apptsList);

      setRecentPatients(patientsRes?.results || []);
      setTotalPatientsCount(patientsRes?.count || 0);
    } catch (err: any) {
      console.error("Failed loading reception dashboard:", err);
      toast.error(err?.message || "Failed to load reception data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Handle instant Check-In
  const handleCheckIn = async (appointment: PatientAppointment) => {
    setCheckingInId(appointment.id);
    try {
      await HealthcareApi.appointments.checkIn(appointment.id);
      toast.success(
        `Patient ${appointment.patient_name || "Patient"} successfully checked in!`,
        {
          description: `Queue position assigned. Notified assigned doctor: ${
            appointment.practitioner_name || "Doctor"
          }`,
        }
      );
      // Reload appointment list
      const updated = await HealthcareApi.appointments.today();
      setAppointments(Array.isArray(updated) ? updated : (updated as any)?.results || []);
    } catch (err: any) {
      console.error("Check-in failed:", err);
      toast.error(err?.response?.data?.error || err?.message || "Failed to check in appointment");
    } finally {
      setCheckingInId(null);
    }
  };

  // Handle Check-Out
  const handleCheckOut = async (appointment: PatientAppointment) => {
    try {
      await HealthcareApi.appointments.checkOut(appointment.id);
      toast.success(`Patient ${appointment.patient_name || "Patient"} marked as Checked Out.`);
      const updated = await HealthcareApi.appointments.today();
      setAppointments(Array.isArray(updated) ? updated : (updated as any)?.results || []);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || err?.message || "Failed to check out appointment");
    }
  };

  // Computed KPI Metrics
  const metrics = useMemo(() => {
    const totalToday = appointments.length;
    const checkedIn = appointments.filter((a) => a.status === "Checked In").length;
    const scheduled = appointments.filter((a) => a.status === "Scheduled" || a.status === "Confirmed" || a.status === "Open").length;
    const completed = appointments.filter((a) => a.status === "Checked Out" || a.status === "Closed").length;
    const cancelled = appointments.filter((a) => a.status === "Cancelled" || a.status === "No Show").length;

    return {
      totalToday,
      checkedIn,
      scheduled,
      completed,
      cancelled,
    };
  }, [appointments]);

  // Filtered Appointments
  const filteredAppointments = useMemo(() => {
    return appointments.filter((apt) => {
      // Status filter
      if (statusFilter !== "all") {
        if (statusFilter === "waiting" && apt.status !== "Checked In") return false;
        if (statusFilter === "scheduled" && !["Scheduled", "Confirmed", "Open"].includes(apt.status)) return false;
        if (statusFilter === "completed" && !["Checked Out", "Closed"].includes(apt.status)) return false;
        if (statusFilter === "cancelled" && !["Cancelled", "No Show"].includes(apt.status)) return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const pName = (apt.patient_name || "").toLowerCase();
        const pId = (apt.appointment_id || String(apt.patient || "")).toLowerCase();
        const docName = (apt.practitioner_name || "").toLowerCase();
        const deptName = (apt.department_name || "").toLowerCase();
        return pName.includes(q) || pId.includes(q) || docName.includes(q) || deptName.includes(q);
      }

      return true;
    });
  }, [appointments, statusFilter, searchQuery]);

  // Waiting queue (Checked-In patients waiting for consultation)
  const waitingQueue = useMemo(() => {
    return appointments.filter((apt) => apt.status === "Checked In");
  }, [appointments]);

  // Appointment Table Columns
  const appointmentColumns: ColumnsType<PatientAppointment> = [
    {
      title: "Queue / Time",
      key: "time",
      width: 140,
      render: (_, record) => (
        <div className="flex flex-col">
          <span className="font-semibold text-sm text-foreground">
            {record.appointment_time ? formatTime12(record.appointment_time) : "TBD"}
          </span>
          {record.position_in_queue ? (
            <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400">
              Queue #{record.position_in_queue}
            </span>
          ) : (
            <span className="text-[11px] text-muted-foreground">Standard</span>
          )}
        </div>
      ),
    },
    {
      title: "Patient Details",
      key: "patient",
      render: (_, record) => (
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0">
            {(record.patient_name?.[0] || "P").toUpperCase()}
          </div>
          <div className="flex flex-col min-w-0">
            <span
              className="font-medium text-sm text-foreground hover:text-primary cursor-pointer truncate"
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
      title: "Practitioner & Department",
      key: "practitioner",
      render: (_, record) => (
        <div className="flex flex-col">
          <span className="text-sm font-medium text-foreground">
            {record.practitioner_name || "Unassigned Doctor"}
          </span>
          <span className="text-xs text-muted-foreground">
            {record.department_name || "General Clinic"}
          </span>
        </div>
      ),
    },
    {
      title: "Type",
      dataIndex: "appointment_type_name",
      key: "type",
      width: 130,
      render: (val) => (
        <Badge variant="outline" className="font-normal text-xs">
          {val || "Routine Visit"}
        </Badge>
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
        } else if (status === "Cancelled" || status === "No Show") {
          badgeColor = "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/50 dark:text-rose-300";
        }
        return (
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${badgeColor}`}>
            {status}
          </span>
        );
      },
    },
    {
      title: "Action",
      key: "action",
      width: 160,
      align: "right",
      render: (_, record) => {
        const isWaiting = record.status === "Checked In";
        const canCheckIn = ["Scheduled", "Confirmed", "Open"].includes(record.status);
        const isDone = ["Checked Out", "Closed", "Cancelled", "No Show"].includes(record.status);

        if (canCheckIn) {
          return (
            <Button
              size="sm"
              className="bg-amber-600 hover:bg-amber-700 text-white font-medium shadow-sm"
              disabled={checkingInId === record.id}
              onClick={() => handleCheckIn(record)}
            >
              <Icon icon="solar:user-check-bold" className="mr-1.5" size={16} />
              {checkingInId === record.id ? "Checking In..." : "Check In"}
            </Button>
          );
        }

        if (isWaiting) {
          return (
            <div className="flex items-center justify-end gap-1.5">
              <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-1 rounded border border-amber-200 dark:border-amber-800">
                In Waiting Area
              </span>
              <Button
                size="sm"
                variant="outline"
                className="text-xs h-7 px-2"
                onClick={() => handleCheckOut(record)}
              >
                Checkout
              </Button>
            </div>
          );
        }

        return (
          <Button
            size="sm"
            variant="ghost"
            className="text-xs"
            onClick={() => navigate(`/healthcare/appointments/${record.id}`)}
          >
            View
          </Button>
        );
      },
    },
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner & Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-600 via-amber-700 to-orange-700 p-6 md:p-8 text-white shadow-lg">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md text-xs font-semibold text-amber-100 border border-white/20">
              <Icon icon="solar:hospital-bold-duotone" size={16} />
              EEU Health Services • Outpatient Reception & Triage Access
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
              Reception Command Center
            </h1>
            <p className="text-amber-100/90 text-sm md:text-base leading-relaxed">
              Manage patient arrivals, front-desk triage check-ins, appointment scheduling, and EEU staff registrations in real time.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              className="bg-white text-amber-900 hover:bg-amber-50 font-bold shadow-md"
              onClick={() => navigate("/healthcare/patients/new")}
            >
              <Icon icon="solar:user-plus-bold" className="mr-2" size={18} />
              Register Patient
            </Button>
            <Button
              variant="outline"
              className="bg-white/10 hover:bg-white/20 text-white border-white/30 backdrop-blur-sm"
              onClick={() => navigate("/healthcare/appointments")}
            >
              <Icon icon="solar:calendar-mark-bold" className="mr-2" size={18} />
              Book Appointment
            </Button>
            <Button
              variant="outline"
              className="bg-white/10 hover:bg-white/20 text-white border-white/30 backdrop-blur-sm"
              onClick={loadDashboardData}
            >
              <Icon icon="solar:refresh-bold" className={loading ? "animate-spin" : ""} size={18} />
            </Button>
          </div>
        </div>

        {/* Decorative background glow */}
        <div className="absolute right-0 top-0 -mt-10 -mr-10 h-64 w-64 rounded-full bg-white/10 blur-3xl pointer-events-none" />
      </div>

      {/* Privacy Notice Card */}
      <div className="rounded-xl border border-amber-200/80 bg-amber-50/60 dark:border-amber-900/40 dark:bg-amber-950/20 p-4 flex items-start gap-3">
        <Icon icon="solar:shield-check-bold" className="text-amber-600 shrink-0 mt-0.5" size={20} />
        <div className="text-xs md:text-sm text-amber-900 dark:text-amber-200 space-y-0.5">
          <span className="font-semibold">Patient Privacy & Role Enforcement Active: </span>
          Reception accounts are authorized exclusively for patient demographics, appointments, and check-in workflows.
          Confidential clinical records, medical histories, and diagnostic observations remain strictly protected and redacted as mandated by Ethiopian health privacy standards.
        </div>
      </div>

      {/* KPI Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="border-l-4 border-l-blue-500 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                Today's Bookings
              </p>
              <h3 className="text-2xl font-bold text-foreground mt-1">
                {metrics.totalToday}
              </h3>
            </div>
            <div className="h-10 w-10 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 flex items-center justify-center">
              <Icon icon="solar:calendar-date-bold-duotone" size={24} />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500 shadow-sm bg-amber-50/20">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-amber-700 dark:text-amber-400 font-bold uppercase tracking-wider">
                Waiting in Queue
              </p>
              <h3 className="text-2xl font-extrabold text-amber-800 dark:text-amber-300 mt-1">
                {metrics.checkedIn}
              </h3>
            </div>
            <div className="h-10 w-10 rounded-xl bg-amber-100 dark:bg-amber-900/40 text-amber-700 flex items-center justify-center">
              <Icon icon="solar:hourglass-line-bold-duotone" size={24} />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-sky-500 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                Expected / Confirmed
              </p>
              <h3 className="text-2xl font-bold text-foreground mt-1">
                {metrics.scheduled}
              </h3>
            </div>
            <div className="h-10 w-10 rounded-xl bg-sky-50 dark:bg-sky-950/40 text-sky-600 flex items-center justify-center">
              <Icon icon="solar:user-speak-bold-duotone" size={24} />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-500 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                Completed Visits
              </p>
              <h3 className="text-2xl font-bold text-foreground mt-1">
                {metrics.completed}
              </h3>
            </div>
            <div className="h-10 w-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center">
              <Icon icon="solar:check-circle-bold-duotone" size={24} />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500 shadow-sm col-span-2 md:col-span-1">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                Total Patients
              </p>
              <h3 className="text-2xl font-bold text-foreground mt-1">
                {totalPatientsCount}
              </h3>
            </div>
            <div className="h-10 w-10 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 flex items-center justify-center">
              <Icon icon="solar:users-group-two-rounded-bold-duotone" size={24} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Operations Worklist Area */}
      <Card className="shadow-sm border">
        <CardHeader className="p-4 md:p-6 pb-2 border-b">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Tabs
                value={activeTab}
                onValueChange={(v) => setActiveTab(v as any)}
                className="w-full"
              >
                <TabsList className="bg-muted">
                  <TabsTrigger value="appointments" className="text-xs md:text-sm font-medium">
                    <Icon icon="solar:calendar-mark-bold" className="mr-1.5" size={16} />
                    Today's Schedule ({appointments.length})
                  </TabsTrigger>
                  <TabsTrigger value="queue" className="text-xs md:text-sm font-medium">
                    <Icon icon="solar:hourglass-line-bold" className="mr-1.5" size={16} />
                    Active Waiting Room ({waitingQueue.length})
                  </TabsTrigger>
                  <TabsTrigger value="patients" className="text-xs md:text-sm font-medium">
                    <Icon icon="solar:user-id-bold" className="mr-1.5" size={16} />
                    Recent Registrations
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {/* Search and filters */}
            <div className="flex items-center gap-2.5">
              <div className="relative w-full md:w-64">
                <Icon
                  icon="solar:magnifer-linear"
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                  size={16}
                />
                <Input
                  placeholder="Search patient, doctor, ID..."
                  className="pl-8 text-xs h-9"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              {activeTab === "appointments" && (
                <div className="flex items-center gap-1 bg-muted p-0.5 rounded-lg text-xs">
                  <Button
                    variant={statusFilter === "all" ? "default" : "ghost"}
                    size="sm"
                    className="h-8 text-xs px-2.5"
                    onClick={() => setStatusFilter("all")}
                  >
                    All
                  </Button>
                  <Button
                    variant={statusFilter === "scheduled" ? "default" : "ghost"}
                    size="sm"
                    className="h-8 text-xs px-2.5"
                    onClick={() => setStatusFilter("scheduled")}
                  >
                    Expected
                  </Button>
                  <Button
                    variant={statusFilter === "waiting" ? "default" : "ghost"}
                    size="sm"
                    className="h-8 text-xs px-2.5"
                    onClick={() => setStatusFilter("waiting")}
                  >
                    Waiting
                  </Button>
                  <Button
                    variant={statusFilter === "completed" ? "default" : "ghost"}
                    size="sm"
                    className="h-8 text-xs px-2.5"
                    onClick={() => setStatusFilter("completed")}
                  >
                    Done
                  </Button>
                </div>
              )}
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
              pagination={{ pageSize: 10, showSizeChanger: true }}
              className="border-0"
              locale={{
                emptyText: (
                  <div className="py-12 text-center text-muted-foreground">
                    <Icon icon="solar:calendar-minimalistic-linear" size={48} className="mx-auto mb-2 opacity-40" />
                    <p className="font-medium">No appointments found for today matching filter.</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Use "Book Appointment" to schedule an outpatient consultation.
                    </p>
                  </div>
                ),
              }}
            />
          )}

          {activeTab === "queue" && (
            <div className="p-4 md:p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b">
                <div>
                  <h3 className="font-semibold text-base text-foreground">
                    Live Waiting Room Triage Queue
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Patients who have arrived and checked in, waiting to be summoned by attending physicians.
                  </p>
                </div>
                <Badge className="bg-amber-600 text-white font-bold">
                  {waitingQueue.length} Patient{waitingQueue.length === 1 ? "" : "s"} Waiting
                </Badge>
              </div>

              {waitingQueue.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  <Icon icon="solar:check-circle-bold" size={48} className="mx-auto mb-2 text-emerald-500 opacity-80" />
                  <p className="font-semibold text-base">Waiting Room is Currently Clear</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    All checked-in patients have progressed into consultation or completed checkout.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {waitingQueue.map((apt, index) => (
                    <Card key={apt.id} className="border-amber-200 dark:border-amber-900/50 bg-amber-50/30 dark:bg-amber-950/10">
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/60 px-2.5 py-0.5 rounded-full">
                            Queue Position #{apt.position_in_queue || index + 1}
                          </span>
                          <span className="text-xs text-muted-foreground font-mono">
                            Checked in at {apt.appointment_time ? formatTime12(apt.appointment_time) : "Today"}
                          </span>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-amber-600 text-white flex items-center justify-center font-bold text-base shrink-0">
                            {(apt.patient_name?.[0] || "P").toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <h4
                              className="font-bold text-sm text-foreground truncate cursor-pointer hover:underline"
                              onClick={() => navigate(`/healthcare/patients/${apt.patient}`)}
                            >
                              {apt.patient_name || "Patient"}
                            </h4>
                            <p className="text-xs text-muted-foreground">
                              {apt.appointment_id || `ID #${apt.patient}`} • {apt.patient_sex || "N/A"}
                            </p>
                          </div>
                        </div>

                        <div className="text-xs space-y-1 bg-background/80 p-2.5 rounded-lg border">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Assigned Doctor:</span>
                            <span className="font-semibold text-foreground">{apt.practitioner_name || "Any Available"}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Department:</span>
                            <span className="font-semibold text-foreground">{apt.department_name || "General Medicine"}</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs h-8 text-rose-600 border-rose-200 hover:bg-rose-50"
                            onClick={() => handleCheckOut(apt)}
                          >
                            Cancel / Checkout
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "patients" && (
            <div className="p-4 md:p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b">
                <div>
                  <h3 className="font-semibold text-base text-foreground">
                    Recently Registered Patients & EEU Staff
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Latest registered records available for appointment booking or identification.
                  </p>
                </div>
                <Button
                  size="sm"
                  className="bg-primary text-primary-foreground text-xs"
                  onClick={() => navigate("/healthcare/patients/new")}
                >
                  <Icon icon="solar:user-plus-bold" className="mr-1.5" size={14} />
                  New Registration
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {recentPatients.map((pat) => (
                  <Card key={pat.id} className="hover:border-primary/50 transition-all cursor-pointer" onClick={() => navigate(`/healthcare/patients/${pat.id}`)}>
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0">
                          {(pat.patient_name?.[0] || "P").toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-bold text-sm text-foreground truncate">
                            {pat.patient_name}
                          </h4>
                          <span className="text-xs text-muted-foreground font-mono">
                            {pat.patient_id}
                          </span>
                        </div>
                      </div>

                      <div className="text-xs text-muted-foreground space-y-0.5 pt-1 border-t">
                        <p>{pat.mobile || pat.email || "No direct phone"}</p>
                        <p className="text-amber-600 dark:text-amber-400 font-medium truncate">
                          {pat.company_affiliation || "EEU Insured"}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Navigation Cards for Receptionist */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="hover:border-amber-400 transition-all cursor-pointer" onClick={() => navigate("/healthcare/occupational/staff-registry")}>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-amber-100 dark:bg-amber-950/40 text-amber-700 flex items-center justify-center shrink-0">
              <Icon icon="solar:user-id-bold-duotone" size={28} />
            </div>
            <div>
              <h4 className="font-bold text-sm text-foreground">EEU Staff & Dependent Registry</h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                Verify employee credentials, corporate medical ceiling balance, and dependent eligibility.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:border-amber-400 transition-all cursor-pointer" onClick={() => navigate("/healthcare/practitioners/practitioner-schedule")}>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-blue-100 dark:bg-blue-950/40 text-blue-700 flex items-center justify-center shrink-0">
              <Icon icon="solar:calendar-date-bold-duotone" size={28} />
            </div>
            <div>
              <h4 className="font-bold text-sm text-foreground">Doctor Shifts & Schedules</h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                Inspect available consultation slots across Internal Medicine, Ophthalmology, and Pediatrics.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:border-amber-400 transition-all cursor-pointer" onClick={() => navigate("/healthcare/appointments")}>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 flex items-center justify-center shrink-0">
              <Icon icon="solar:calendar-mark-bold-duotone" size={28} />
            </div>
            <div>
              <h4 className="font-bold text-sm text-foreground">Appointment Master List</h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                Browse upcoming dates, reschedule appointments, and handle cancellations or reassignments.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
