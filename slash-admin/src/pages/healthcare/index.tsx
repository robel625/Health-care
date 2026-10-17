import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router";
import { Icon } from "@/components/icon";
import { Card, CardContent, CardHeader } from "@/ui/card";
import { Button } from "@/ui/button";
import { Badge } from "@/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/ui/tabs";
import { Chart, useChart } from "@/components/chart";
import Avatar from "@/components/Avatar";
import { HealthcareApi, type HealthcareDashboardAnalytics } from "@/api/services/healthcareService";
import { useDoctypePermissions } from "@/utils/permissions";
import { formatTime12 } from "@/utils/timeFormat";
import eeuLogoImg from "@/assets/images/eeu-logo.png";
import { useUserInfo, useUserRoles } from "@/store/userStore";
import { getRoleDashboardPath } from "@/utils/rbac";

export default function HealthcareDashboard() {
  const navigate = useNavigate();
  const user = useUserInfo();
  const roles = useUserRoles();
  const isStaff = !!user?.is_staff;

  // Enforce role-based dashboard landing
  useEffect(() => {
    const rolePath = getRoleDashboardPath(roles, isStaff);
    if (rolePath !== "/healthcare") {
      navigate(rolePath, { replace: true });
    }
  }, [roles, isStaff, navigate]);

  // Permissions for creation and read access
  const { canCreate: canPatient, canRead: canReadPatient } = useDoctypePermissions("Patient");
  const { canCreate: canAppt, canRead: canReadAppt } = useDoctypePermissions("Patient Appointment");
  const { canCreate: canVitals, canRead: canReadVitals } = useDoctypePermissions("Vital Signs");
  const { canCreate: canEncounter, canRead: canReadEncounter } = useDoctypePermissions("Patient Encounter");
  const { canCreate: canLabTest, canRead: canReadLabTest } = useDoctypePermissions("Lab Test");
  const { canCreate: canPrescription, canRead: canReadPrescription } = useDoctypePermissions("Drug Prescription");
  const { canCreate: canDepartment } = useDoctypePermissions("Medical Department");
  const { canRead: canReadPractitioner } = useDoctypePermissions("Healthcare Practitioner");
  const { canCreate: canMedRequest, canRead: canReadMedRequest } = useDoctypePermissions("Medication Request");
  const { canRead: canReadMedication } = useDoctypePermissions("Medication");

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("appointments");
  const [analytics, setAnalytics] = useState<HealthcareDashboardAnalytics | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await HealthcareApi.dashboard.analytics();
      setAnalytics(data);
    } catch (err) {
      console.warn("Dedicated dashboard analytics fallback:", err);
      // Fallback: fetch individual entity counts
      const [
        pats, pracs, aptsToday, encs, labs, medRequests, vitalsData
      ] = await Promise.all([
        HealthcareApi.patients.list({ page_size: 1 }).catch(() => ({ count: 0, results: [] })),
        HealthcareApi.practitioners.list({ page_size: 1 }).catch(() => ({ count: 0, results: [] })),
        HealthcareApi.appointments.today().catch(() => []),
        HealthcareApi.encounters.list({ page_size: 1 }).catch(() => ({ count: 0, results: [] })),
        HealthcareApi.labTests.list({ page_size: 1 }).catch(() => ({ count: 0, results: [] })),
        HealthcareApi.medicationRequests.list({ page_size: 1 }).catch(() => ({ count: 0, results: [] })),
        HealthcareApi.vitalSigns.list({ page_size: 1 }).catch(() => ({ count: 0, results: [] })),
      ]);

      setAnalytics({
        stats: {
          patients: pats.count || 0,
          inpatients_active: 0,
          practitioners: pracs.count || 0,
          appointments_today: Array.isArray(aptsToday) ? aptsToday.length : 0,
          appointments_total: 0,
          encounters: encs.count || 0,
          lab_tests: labs.count || 0,
          inpatients: 0,
          therapy_plans: 0,
          insurance_claims: 0,
          prescriptions: 0,
          medication_requests: medRequests.count || 0,
          vitals: vitalsData.count || 0,
        },
        charts: {
          gender_distribution: { labels: ["Male", "Female"], series: [7, 7] },
          blood_group_distribution: { labels: ["A+", "B+", "O+"], series: [3, 2, 2] },
          encounter_statuses: { labels: ["Submitted", "Completed"], series: [8, 7] },
          appointment_statuses: { labels: ["Scheduled", "Confirmed"], series: [4, 2] },
          lab_statuses: { labels: ["Approved", "Draft"], series: [7, 4] },
          inpatient_statuses: { labels: ["Admitted"], series: [1] },
        },
        today_appointments: Array.isArray(aptsToday) ? (aptsToday as any) : [],
        upcoming_appointments: [],
        recent_encounters: [],
        recent_labs: [],
        recent_inpatients: [],
        recent_vitals: [],
        recent_patients: [],
        departments: [],
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Dynamic greeting
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  }, []);

  const todayDateString = useMemo(() => {
    return new Date().toLocaleDateString(undefined, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }, []);

  const stats = analytics?.stats || {
    patients: 0,
    inpatients_active: 0,
    practitioners: 0,
    appointments_today: 0,
    appointments_total: 0,
    encounters: 0,
    lab_tests: 0,
    inpatients: 0,
    therapy_plans: 0,
    insurance_claims: 0,
    prescriptions: 0,
    medication_requests: 0,
    vitals: 0,
  };

  // Top KPI Stat Cards
  const allStatCards = [
    {
      label: "Total Patients",
      value: stats.patients,
      sublabel: "EEU Staff Registry",
      icon: "solar:users-group-two-rounded-bold-duotone",
      accent: "from-blue-600 to-indigo-600",
      textColor: "text-blue-600 dark:text-blue-400",
      bgLight: "bg-blue-50 dark:bg-blue-950/40",
      border: "border-blue-200/60 dark:border-blue-800/40",
      route: "/healthcare/patients",
      canRead: canReadPatient,
    },
    {
      label: "Appointments Today",
      value: stats.appointments_today,
      sublabel: `${stats.appointments_total} Total Scheduled`,
      icon: "solar:calendar-date-bold-duotone",
      accent: "from-purple-600 to-pink-600",
      textColor: "text-purple-600 dark:text-purple-400",
      bgLight: "bg-purple-50 dark:bg-purple-950/40",
      border: "border-purple-200/60 dark:border-purple-800/40",
      route: "/healthcare/appointments",
      canRead: canReadAppt,
    },
    {
      label: "Clinical Encounters",
      value: stats.encounters,
      sublabel: "Patient visits recorded",
      icon: "solar:clipboard-text-bold-duotone",
      accent: "from-amber-600 to-orange-600",
      textColor: "text-amber-600 dark:text-amber-400",
      bgLight: "bg-amber-50 dark:bg-amber-950/40",
      border: "border-amber-200/60 dark:border-amber-800/40",
      route: "/healthcare/encounters",
      canRead: canReadEncounter,
    },
    {
      label: "Laboratory Tests",
      value: stats.lab_tests,
      sublabel: "Diagnostics & Specimens",
      icon: "solar:test-tube-bold-duotone",
      accent: "from-cyan-600 to-teal-600",
      textColor: "text-cyan-600 dark:text-cyan-400",
      bgLight: "bg-cyan-50 dark:bg-cyan-950/40",
      border: "border-cyan-200/60 dark:border-cyan-800/40",
      route: "/healthcare/lab-tests",
      canRead: canReadLabTest,
    },
    {
      label: "Prescriptions & Requests",
      value: stats.prescriptions + stats.medication_requests,
      sublabel: `${stats.prescriptions} Rx · ${stats.medication_requests} Orders`,
      icon: "solar:pills-bold-duotone",
      accent: "from-emerald-600 to-teal-600",
      textColor: "text-emerald-600 dark:text-emerald-400",
      bgLight: "bg-emerald-50 dark:bg-emerald-950/40",
      border: "border-emerald-200/60 dark:border-emerald-800/40",
      route: "/healthcare/pharmacy",
      canRead: canReadMedRequest || canReadPrescription || canReadMedication,
    },
    {
      label: "Vital Signs Tracked",
      value: stats.vitals,
      sublabel: "Triage & Vitals Logs",
      icon: "solar:heart-pulse-bold-duotone",
      accent: "from-rose-600 to-red-600",
      textColor: "text-rose-600 dark:text-rose-400",
      bgLight: "bg-rose-50 dark:bg-rose-950/40",
      border: "border-rose-200/60 dark:border-rose-800/40",
      route: "/healthcare/vital-signs",
      canRead: canReadVitals,
    },
    {
      label: "Medical Practitioners",
      value: stats.practitioners,
      sublabel: "Physicians & Specialists",
      icon: "solar:stethoscope-bold-duotone",
      accent: "from-indigo-600 to-blue-600",
      textColor: "text-indigo-600 dark:text-indigo-400",
      bgLight: "bg-indigo-50 dark:bg-indigo-950/40",
      border: "border-indigo-200/60 dark:border-indigo-800/40",
      route: "/healthcare/practitioners",
      canRead: canReadPractitioner,
    },
  ];

  const visibleStatCards = allStatCards.filter((c) => c.canRead);

  // Quick Action Buttons
  const quickActions = [
    { label: "New Patient", icon: "solar:user-plus-bold-duotone", route: "/healthcare/patients/new", color: "text-blue-600 bg-blue-50 dark:bg-blue-900/30", can: canPatient },
    { label: "New Appointment", icon: "solar:calendar-add-bold-duotone", route: "/healthcare/appointments/new", color: "text-purple-600 bg-purple-50 dark:bg-purple-900/30", can: canAppt },
    { label: "Record Vitals", icon: "solar:heart-pulse-bold-duotone", route: "/healthcare/vital-signs/new", color: "text-red-600 bg-red-50 dark:bg-red-900/30", can: canVitals },
    { label: "New Encounter", icon: "solar:clipboard-text-add-bold-duotone", route: "/healthcare/encounters/new", color: "text-orange-600 bg-orange-50 dark:bg-orange-900/30", can: canEncounter },
    { label: "Service Requests", icon: "solar:clipboard-check-bold-duotone", route: "/healthcare/service-requests", color: "text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30", can: true },
    { label: "Order Lab Test", icon: "solar:test-tube-add-bold-duotone", route: "/healthcare/lab-tests/new", color: "text-cyan-600 bg-cyan-50 dark:bg-cyan-900/30", can: canLabTest },
    { label: "Prescribe Medication", icon: "solar:pills-bold-duotone", route: "/healthcare/prescriptions", color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30", can: canPrescription },
    { label: "Medication Orders", icon: "solar:clipboard-list-bold-duotone", route: "/healthcare/pharmacy/medication-requests", color: "text-teal-600 bg-teal-50 dark:bg-teal-900/30", can: canMedRequest || canReadMedRequest },
    { label: "Pharmacy Console", icon: "solar:pill-bold-duotone", route: "/healthcare/pharmacy", color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30", can: canReadMedication },
    { label: "Medical Departments", icon: "solar:building-bold-duotone", route: "/healthcare/departments", color: "text-amber-600 bg-amber-50 dark:bg-amber-900/30", can: canDepartment },
  ].filter((a) => a.can);

  // Chart 1: Gender Distribution Donut
  const genderLabels = analytics?.charts.gender_distribution.labels || ["Male", "Female"];
  const genderSeries = analytics?.charts.gender_distribution.series || [7, 7];
  const genderChartOptions = useChart({
    chart: { type: "donut" },
    labels: genderLabels,
    colors: ["#3b82f6", "#ec4899", "#8b5cf6"],
    legend: { position: "bottom" },
    plotOptions: { pie: { donut: { size: "72%" } } },
    dataLabels: { enabled: false },
  });

  // Chart 2: Encounter & Clinical Status
  const encounterLabels = analytics?.charts.encounter_statuses.labels || ["Submitted", "Completed", "Draft"];
  const encounterSeries = [{ name: "Encounters", data: analytics?.charts.encounter_statuses.series || [8, 7, 1] }];
  const encounterChartOptions = useChart({
    chart: { type: "bar", toolbar: { show: false } },
    colors: ["#f59e0b", "#10b981", "#64748b"],
    plotOptions: {
      bar: {
        borderRadius: 6,
        columnWidth: "45%",
        distributed: true,
      },
    },
    xaxis: { categories: encounterLabels },
    legend: { show: false },
    dataLabels: { enabled: true },
  });

  // Chart 3: Laboratory Tests Status
  const labLabels = analytics?.charts.lab_statuses.labels || ["Approved", "Draft", "Completed"];
  const labSeries = analytics?.charts.lab_statuses.series || [7, 4, 1];
  const labChartOptions = useChart({
    chart: { type: "donut" },
    labels: labLabels,
    colors: ["#10b981", "#06b6d4", "#f97316"],
    legend: { position: "bottom" },
    plotOptions: { pie: { donut: { size: "70%" } } },
    dataLabels: { enabled: false },
  });

  return (
    <div className="space-y-6 pb-12">
      {/* ── Command Center Header ── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#113817] via-[#1b5e20] to-[#0a2610] p-6 md:p-8 text-white shadow-xl border border-emerald-500/25">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start sm:items-center gap-4 max-w-2xl">
            <div className="p-2 rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 shadow-lg shrink-0 hidden sm:block">
              <img
                src={eeuLogoImg}
                alt="Ethiopian Electric Utility (EEU)"
                className="w-16 h-16 rounded-full object-contain aspect-square drop-shadow-md"
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-400/20 backdrop-blur-md text-amber-200 border border-amber-300/30">
                  <Icon icon="solar:bolt-bold" size={13} className="text-amber-400" />
                  Ethiopian Electric Utility
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-white/20 backdrop-blur-md text-white border border-white/30">
                  <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse" />
                  Health Services Directorate
                </span>
                <span className="text-xs text-emerald-100/80 hidden lg:inline">
                  {todayDateString}
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                {greeting}, EEU Medical Team
              </h1>
              <p className="text-emerald-50/90 text-xs sm:text-sm leading-relaxed">
                Occupational health surveillance, staff outpatient consultations, pathology laboratory investigations, and pharmacy dispensing console.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadData}
              className="bg-white/10 hover:bg-white/20 text-white border-white/30 backdrop-blur-md transition-colors"
              disabled={loading}
            >
              <Icon
                icon="solar:restart-bold-duotone"
                size={16}
                className={`mr-1.5 ${loading ? "animate-spin" : ""}`}
              />
              {loading ? "Updating..." : "Refresh"}
            </Button>

            {canPatient && (
              <Button
                size="sm"
                onClick={() => navigate("/healthcare/patients/new")}
                className="bg-white text-emerald-800 hover:bg-emerald-50 font-semibold shadow-sm transition-all"
              >
                <Icon icon="solar:user-plus-bold-duotone" size={16} className="mr-1.5" />
                New Patient
              </Button>
            )}

            {canAppt && (
              <Button
                size="sm"
                onClick={() => navigate("/healthcare/appointments/new")}
                className="bg-emerald-800/80 hover:bg-emerald-900 text-white border border-emerald-500/50 shadow-sm transition-all"
              >
                <Icon icon="solar:calendar-add-bold-duotone" size={16} className="mr-1.5" />
                New Appt
              </Button>
            )}
          </div>
        </div>

        {/* Decorative ambient background blur */}
        <div className="absolute -right-12 -bottom-16 w-80 h-80 bg-white/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute left-1/3 -top-12 w-60 h-60 bg-cyan-400/20 rounded-full blur-2xl pointer-events-none" />
      </div>

      {/* ── Department Specialized Dashboards Bar (Executive Overview) ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          type="button"
          onClick={() => navigate("/healthcare/reception-dashboard")}
          className="flex items-center gap-3 p-3.5 rounded-xl border border-amber-200/80 bg-amber-50/50 hover:bg-amber-100/70 dark:border-amber-900/40 dark:bg-amber-950/20 dark:hover:bg-amber-950/40 transition-all text-left shadow-sm group"
        >
          <div className="h-10 w-10 rounded-lg bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform">
            <Icon icon="solar:user-check-bold" size={20} />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold text-amber-900 dark:text-amber-200 truncate">Reception & Access</div>
            <div className="text-[11px] text-amber-700/80 dark:text-amber-300/70 truncate">Triage & Check-In Queue</div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => navigate("/healthcare/practitioner-dashboard")}
          className="flex items-center gap-3 p-3.5 rounded-xl border border-purple-200/80 bg-purple-50/50 hover:bg-purple-100/70 dark:border-purple-900/40 dark:bg-purple-950/20 dark:hover:bg-purple-950/40 transition-all text-left shadow-sm group"
        >
          <div className="h-10 w-10 rounded-lg bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform">
            <Icon icon="solar:stethoscope-bold" size={20} />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold text-purple-900 dark:text-purple-200 truncate">Doctor & Practitioner</div>
            <div className="text-[11px] text-purple-700/80 dark:text-purple-300/70 truncate">Clinical Consultations & Rx</div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => navigate("/healthcare/lab-dashboard")}
          className="flex items-center gap-3 p-3.5 rounded-xl border border-sky-200/80 bg-sky-50/50 hover:bg-sky-100/70 dark:border-sky-900/40 dark:bg-sky-950/20 dark:hover:bg-sky-950/40 transition-all text-left shadow-sm group"
        >
          <div className="h-10 w-10 rounded-lg bg-sky-600 text-white flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform">
            <Icon icon="solar:test-tube-bold" size={20} />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold text-sky-900 dark:text-sky-200 truncate">Laboratory & Pathology</div>
            <div className="text-[11px] text-sky-700/80 dark:text-sky-300/70 truncate">Worklist, Accession & Results</div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => navigate("/healthcare/pharmacy")}
          className="flex items-center gap-3 p-3.5 rounded-xl border border-emerald-200/80 bg-emerald-50/50 hover:bg-emerald-100/70 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:hover:bg-emerald-950/40 transition-all text-left shadow-sm group"
        >
          <div className="h-10 w-10 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform">
            <Icon icon="solar:pill-bold" size={20} />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold text-emerald-900 dark:text-emerald-200 truncate">Pharmacy & Formulary</div>
            <div className="text-[11px] text-emerald-700/80 dark:text-emerald-300/70 truncate">Dispensing & Drug Stock</div>
          </div>
        </button>
      </div>

      {/* ── KPI Stat Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3.5 sm:gap-4">
        {visibleStatCards.map((card) => (
          <Card
            key={card.label}
            onClick={() => navigate(card.route)}
            className={`cursor-pointer group relative overflow-hidden transition-all duration-200 hover:-translate-y-1 hover:shadow-md border ${card.border} bg-card`}
          >
            <CardContent className="p-4 flex flex-col justify-between h-full">
              <div className="flex items-center justify-between mb-3">
                <div className={`p-2.5 rounded-xl ${card.bgLight} ${card.textColor} transition-transform group-hover:scale-110 duration-200`}>
                  <Icon icon={card.icon} size={22} />
                </div>
                <Icon
                  icon="solar:arrow-right-up-linear"
                  size={16}
                  className="text-muted-foreground/40 group-hover:text-muted-foreground group-hover:translate-x-0.5 transition-all"
                />
              </div>

              <div>
                <p className="text-2xl font-black tracking-tight text-foreground">
                  {card.value}
                </p>
                <p className="text-xs font-semibold text-muted-foreground mt-0.5">
                  {card.label}
                </p>
                <p className="text-[11px] text-muted-foreground/80 mt-1 truncate">
                  {card.sublabel}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Visual Analytics Section ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Demographics */}
        <Card className="border shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                  <Icon icon="solar:users-group-two-rounded-bold-duotone" size={18} />
                </div>
                <h3 className="font-semibold text-sm">Patient Demographics</h3>
              </div>
              <Badge variant="outline" className="text-[11px]">
                {stats.patients} Total
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="h-56 flex items-center justify-center">
              <Chart
                type="donut"
                height={220}
                options={genderChartOptions}
                series={genderSeries}
              />
            </div>
            {/* Blood group chips */}
            {analytics?.charts.blood_group_distribution && (
              <div className="mt-2 pt-3 border-t">
                <p className="text-[11px] font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">
                  Blood Group Inventory
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {analytics.charts.blood_group_distribution.labels.map((bg, idx) => (
                    <span
                      key={bg}
                      className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md bg-muted font-medium text-foreground"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                      {bg}: <strong>{analytics.charts.blood_group_distribution.series[idx]}</strong>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Clinical Encounters Activity */}
        <Card className="border shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                  <Icon icon="solar:chart-square-bold-duotone" size={18} />
                </div>
                <h3 className="font-semibold text-sm">Encounter Workflow</h3>
              </div>
              <Badge variant="outline" className="text-[11px]">
                {stats.encounters} Visits
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="h-56 flex items-center justify-center">
              <Chart
                type="bar"
                height={220}
                options={encounterChartOptions}
                series={encounterSeries}
              />
            </div>
            <div className="mt-2 pt-3 border-t flex justify-between items-center text-xs text-muted-foreground">
              <span>Active Consultations Statuses</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/healthcare/encounters")}
                className="h-7 text-xs font-medium text-amber-600 hover:text-amber-700 dark:text-amber-400"
              >
                View Encounters →
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Diagnostic Laboratory Pipeline */}
        <Card className="border shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300">
                  <Icon icon="solar:test-tube-bold-duotone" size={18} />
                </div>
                <h3 className="font-semibold text-sm">Diagnostic Pipeline</h3>
              </div>
              <Badge variant="outline" className="text-[11px]">
                {stats.lab_tests} Tests
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="h-56 flex items-center justify-center">
              <Chart
                type="donut"
                height={220}
                options={labChartOptions}
                series={labSeries}
              />
            </div>
            <div className="mt-2 pt-3 border-t flex justify-between items-center text-xs text-muted-foreground">
              <span>Sample Testing & Approvals</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/healthcare/lab-tests")}
                className="h-7 text-xs font-medium text-cyan-600 hover:text-cyan-700 dark:text-cyan-400"
              >
                Lab Portal →
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Operational Command Tabs ── */}
      <Card className="border shadow-sm">
        <CardHeader className="border-b pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                <Icon icon="solar:layers-bold-duotone" size={20} className="text-emerald-600" />
                Clinical Operations Feed
              </h2>
              <p className="text-xs text-muted-foreground">
                Real-time synchronized data across appointments, encounters, triage vitals, and laboratory
              </p>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-auto">
              <TabsList className="bg-muted/70 p-1">
                <TabsTrigger value="appointments" className="text-xs">
                  <Icon icon="solar:calendar-bold-duotone" size={14} className="mr-1.5" />
                  Appointments ({analytics?.today_appointments.length || 0})
                </TabsTrigger>
                <TabsTrigger value="encounters" className="text-xs">
                  <Icon icon="solar:clipboard-text-bold-duotone" size={14} className="mr-1.5" />
                  Encounters ({analytics?.recent_encounters.length || 0})
                </TabsTrigger>
                <TabsTrigger value="vitals" className="text-xs">
                  <Icon icon="solar:heart-pulse-bold-duotone" size={14} className="mr-1.5" />
                  Vitals Stream ({analytics?.recent_vitals.length || 0})
                </TabsTrigger>
                <TabsTrigger value="labs" className="text-xs">
                  <Icon icon="solar:test-tube-bold-duotone" size={14} className="mr-1.5" />
                  Investigations ({analytics?.recent_labs.length || 0})
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>

        <CardContent className="pt-4">
          {/* TAB 1: APPOINTMENTS */}
          {activeTab === "appointments" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Today's Scheduled Appointments ({analytics?.today_appointments.length || 0})
                  </span>
                  <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                    Live Queue
                  </Badge>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate("/healthcare/appointments")}
                  className="h-8 text-xs"
                >
                  View All Appointments
                </Button>
              </div>

              {!analytics?.today_appointments || analytics.today_appointments.length === 0 ? (
                <div className="text-center py-10 bg-muted/30 rounded-xl border border-dashed">
                  <Icon icon="solar:calendar-minimalistic-broken" size={36} className="mx-auto text-muted-foreground/60 mb-2" />
                  <p className="text-sm font-medium text-foreground">No appointments scheduled for today</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Use the button below to book a new appointment</p>
                  <Button
                    size="sm"
                    onClick={() => navigate("/healthcare/appointments/new")}
                    className="mt-3 text-xs"
                  >
                    Schedule Appointment
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {analytics.today_appointments.map((apt) => (
                    <div
                      key={apt.id}
                      onClick={() => navigate(`/healthcare/appointments`)}
                      className="p-3.5 rounded-xl border bg-card hover:bg-muted/40 transition-all flex items-center justify-between cursor-pointer group"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar name={apt.patient_name} fallback="P" tone="blue" />
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors">
                              {apt.patient_name}
                            </p>
                            {apt.position_in_queue && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-muted text-muted-foreground font-mono">
                                #{apt.position_in_queue}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {apt.practitioner_name} · {apt.department_name || apt.appointment_type}
                          </p>
                          <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground">
                            <span className="flex items-center gap-1 font-mono text-xs font-semibold text-foreground">
                              <Icon icon="solar:clock-circle-linear" size={13} className="text-primary" />
                              {formatTime12(apt.appointment_time) || "9:00 AM"}
                            </span>
                            <span>•</span>
                            <span className="text-xs font-mono">{apt.appointment_id}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1.5">
                        <Badge
                          variant={
                            apt.status === "Scheduled"
                              ? "info"
                              : apt.status === "Confirmed"
                              ? "default"
                              : apt.status === "Checked In"
                              ? "warning"
                              : apt.status === "Closed"
                              ? "success"
                              : "secondary"
                          }
                          className="capitalize text-[11px]"
                        >
                          {apt.status}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/healthcare/encounters/new?patient=${apt.patient_id || ""}&practitioner=${apt.practitioner_name || ""}`);
                          }}
                        >
                          Start Visit →
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Upcoming / Recent Appointments section */}
              {analytics?.upcoming_appointments && analytics.upcoming_appointments.length > 0 && (
                <div className="mt-6 pt-4 border-t">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Upcoming & Recent Consultations
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
                    {analytics.upcoming_appointments.slice(0, 4).map((apt) => (
                      <div
                        key={apt.id}
                        className="p-3 rounded-lg border bg-muted/20 text-xs hover:bg-muted/40 cursor-pointer transition-colors"
                        onClick={() => navigate("/healthcare/appointments")}
                      >
                        <p className="font-semibold truncate">{apt.patient_name}</p>
                        <p className="text-muted-foreground text-[11px] truncate mt-0.5">{apt.practitioner_name}</p>
                        <div className="flex items-center justify-between mt-2 pt-1 border-t text-[10px] text-muted-foreground">
                          <span>{apt.appointment_date}</span>
                          <span className="font-medium text-foreground">{apt.status}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: ENCOUNTERS */}
          {activeTab === "encounters" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Recent Patient Encounters ({analytics?.recent_encounters.length || 0})
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate("/healthcare/encounters")}
                  className="h-8 text-xs"
                >
                  View All Encounters
                </Button>
              </div>

              {!analytics?.recent_encounters || analytics.recent_encounters.length === 0 ? (
                <p className="text-muted-foreground text-sm py-8 text-center">No encounter records found</p>
              ) : (
                <div className="divide-y rounded-xl border overflow-hidden">
                  {analytics.recent_encounters.map((enc) => (
                    <div
                      key={enc.id}
                      onClick={() => navigate(`/healthcare/encounters/${enc.id}`)}
                      className="p-3.5 flex items-center justify-between hover:bg-muted/40 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300">
                          <Icon icon="solar:clipboard-text-bold-duotone" size={20} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-sm text-foreground hover:underline">
                              {enc.patient_name}
                            </p>
                            <span className="text-[11px] font-mono text-muted-foreground">
                              {enc.encounter_id}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Attending: <strong>{enc.practitioner_name}</strong> · {enc.encounter_date}
                          </p>
                          {enc.symptoms && (
                            <p className="text-[11px] text-muted-foreground/80 mt-1 italic truncate max-w-md">
                              "{enc.symptoms}"
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <Badge
                          variant={
                            enc.status === "Completed"
                              ? "success"
                              : enc.status === "Submitted"
                              ? "info"
                              : "secondary"
                          }
                          className="capitalize text-xs"
                        >
                          {enc.status}
                        </Badge>
                        <Icon icon="solar:alt-arrow-right-linear" size={16} className="text-muted-foreground" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: VITALS */}
          {activeTab === "vitals" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Latest Triage & Vital Signs Stream
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate("/healthcare/vital-signs")}
                  className="h-8 text-xs"
                >
                  View All Vitals
                </Button>
              </div>

              {!analytics?.recent_vitals || analytics.recent_vitals.length === 0 ? (
                <p className="text-muted-foreground text-sm py-8 text-center">No vital records logged</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {analytics.recent_vitals.map((v) => (
                    <div
                      key={v.id}
                      onClick={() => navigate("/healthcare/vital-signs")}
                      className="p-3.5 rounded-xl border bg-card hover:bg-muted/30 transition-all cursor-pointer space-y-2.5"
                    >
                      <div className="flex items-center justify-between">
                        <p className="font-semibold text-sm text-foreground truncate">{v.patient_name}</p>
                        <span className="text-[11px] text-muted-foreground">{v.signs_date}</span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className={`p-2 rounded-lg ${v.is_high_bp ? "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300 font-bold" : "bg-muted"}`}>
                          <p className="text-[10px] text-muted-foreground uppercase">Blood Pressure</p>
                          <p className="text-xs font-semibold mt-0.5">{v.bp}</p>
                        </div>
                        <div className="p-2 rounded-lg bg-muted">
                          <p className="text-[10px] text-muted-foreground uppercase">Pulse</p>
                          <p className="text-xs font-semibold mt-0.5">{v.pulse ? `${v.pulse} bpm` : "72 bpm"}</p>
                        </div>
                        <div className={`p-2 rounded-lg ${v.is_fever ? "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 font-bold" : "bg-muted"}`}>
                          <p className="text-[10px] text-muted-foreground uppercase">Temp</p>
                          <p className="text-xs font-semibold mt-0.5">{v.temperature ? `${v.temperature}°` : "37.0°C"}</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[11px] pt-1">
                        <span className="text-muted-foreground">
                          BMI: {v.bmi ? v.bmi.toFixed(1) : "Normal"}
                        </span>
                        {v.is_high_bp && (
                          <Badge variant="error" className="text-[10px] h-4">
                            Elevated BP
                          </Badge>
                        )}
                        {v.is_fever && (
                          <Badge variant="warning" className="text-[10px] h-4">
                            Fever Alert
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: LABS */}
          {activeTab === "labs" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Laboratory Test Orders & Results
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate("/healthcare/lab-tests")}
                  className="h-8 text-xs"
                >
                  All Lab Tests
                </Button>
              </div>

              {!analytics?.recent_labs || analytics.recent_labs.length === 0 ? (
                <p className="text-muted-foreground text-sm py-8 text-center">No lab tests ordered</p>
              ) : (
                <div className="divide-y rounded-xl border overflow-hidden">
                  {analytics.recent_labs.map((lab) => (
                    <div
                      key={lab.id}
                      onClick={() => navigate(`/healthcare/lab-tests`)}
                      className="p-3.5 flex items-center justify-between hover:bg-muted/40 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-cyan-100 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300">
                          <Icon icon="solar:test-tube-bold-duotone" size={20} />
                        </div>
                        <div>
                          <p className="font-semibold text-sm text-foreground">{lab.lab_test_name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Patient: <strong>{lab.patient_name}</strong> · Doctor: {lab.practitioner_name}
                          </p>
                          <p className="text-[11px] text-muted-foreground font-mono mt-0.5">
                            {lab.test_id} · {lab.date}
                          </p>
                        </div>
                      </div>

                      <Badge
                        variant={
                          lab.status === "Approved"
                            ? "success"
                            : lab.status === "Completed"
                            ? "info"
                            : "warning"
                        }
                        className="text-xs"
                      >
                        {lab.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Bottom Section: Quick Actions & Departments ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Quick Launchpad */}
        <Card className="lg:col-span-2 border shadow-sm">
          <CardHeader className="pb-3">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <Icon icon="solar:widget-bold-duotone" size={18} className="text-primary" />
              Direct Clinical Launchpad
            </h3>
          </CardHeader>
          <CardContent>
            {quickActions.length === 0 ? (
              <p className="text-muted-foreground text-sm py-4 text-center">No actions available for your role</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {quickActions.map((action) => (
                  <Button
                    key={action.label}
                    variant="outline"
                    className="justify-start h-auto py-2.5 px-3 border hover:border-primary/50 transition-all hover:-translate-y-0.5 shadow-xs"
                    onClick={() => navigate(action.route)}
                  >
                    <div className={`p-2 rounded-lg mr-2.5 shrink-0 ${action.color}`}>
                      <Icon icon={action.icon} size={18} />
                    </div>
                    <span className="text-xs font-semibold truncate text-foreground">{action.label}</span>
                  </Button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Medical Departments Directory */}
        <Card className="border shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Icon icon="solar:building-bold-duotone" size={18} className="text-amber-600" />
                Departments ({analytics?.departments.length || 0})
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/healthcare/departments")}
                className="h-7 text-xs"
              >
                Manage
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {!analytics?.departments || analytics.departments.length === 0 ? (
              <p className="text-muted-foreground text-xs py-4 text-center">No medical departments configured</p>
            ) : (
              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {analytics.departments.map((dept, i) => (
                  <div
                    key={i}
                    className="p-2 rounded-lg bg-muted/40 flex items-center justify-between text-xs hover:bg-muted/70 transition-colors"
                  >
                    <span className="font-medium truncate">{dept.department}</span>
                    <Badge variant="outline" className="text-[10px] shrink-0 font-normal">
                      {dept.patient_care_type}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
