import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router";
import { Icon } from "@/components/icon";
import { Button } from "@/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/ui/card";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { Badge } from "@/ui/badge";
import { Separator } from "@/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/ui/dialog";
import Avatar from "@/components/Avatar";
import { toast } from "sonner";
import { HealthcareApi } from "@/api/services/healthcareService";
import EntitySelect from "@/components/healthcare/EntitySelect";
import DocumentTimeline from "@/components/healthcare/DocumentTimeline";
import type {
  Patient,
  HealthcarePractitioner,
  MedicalDepartment,
  AppointmentTypeConfig,
} from "@/api/services/healthcareService";
import { useDoctypePermissions } from "@/utils/permissions";
import { formatTime12, to24Hour } from "@/utils/timeFormat";
import { cn, getInitials } from "@/utils";

// Status Visual Theme Configuration
const STATUS_CONFIG: Record<
  string,
  { bg: string; dot: string; text: string; border: string; icon: string; label: string }
> = {
  Scheduled: {
    bg: "bg-blue-500/10",
    dot: "bg-blue-500",
    text: "text-blue-700 dark:text-blue-300",
    border: "border-blue-500/30",
    icon: "solar:clock-circle-bold",
    label: "Scheduled",
  },
  Open: {
    bg: "bg-teal-500/10",
    dot: "bg-teal-500",
    text: "text-teal-700 dark:text-teal-300",
    border: "border-teal-500/30",
    icon: "solar:calendar-date-bold",
    label: "Open Slot",
  },
  Confirmed: {
    bg: "bg-indigo-500/10",
    dot: "bg-indigo-500",
    text: "text-indigo-700 dark:text-indigo-300",
    border: "border-indigo-500/30",
    icon: "solar:check-circle-bold",
    label: "Confirmed",
  },
  "Checked In": {
    bg: "bg-emerald-500/15",
    dot: "bg-emerald-500 animate-pulse",
    text: "text-emerald-700 dark:text-emerald-300 font-bold",
    border: "border-emerald-500/40",
    icon: "solar:login-bold",
    label: "Checked In (Waiting Room)",
  },
  "Checked Out": {
    bg: "bg-purple-500/10",
    dot: "bg-purple-500",
    text: "text-purple-700 dark:text-purple-300",
    border: "border-purple-500/30",
    icon: "solar:logout-bold",
    label: "Checked Out",
  },
  Closed: {
    bg: "bg-muted",
    dot: "bg-muted-foreground",
    text: "text-muted-foreground",
    border: "border-border",
    icon: "solar:check-read-bold",
    label: "Closed & Billed",
  },
  Cancelled: {
    bg: "bg-rose-500/10",
    dot: "bg-rose-500",
    text: "text-rose-700 dark:text-rose-400",
    border: "border-rose-500/30",
    icon: "solar:close-circle-bold",
    label: "Cancelled",
  },
  "No Show": {
    bg: "bg-amber-500/10",
    dot: "bg-amber-500",
    text: "text-amber-700 dark:text-amber-400",
    border: "border-amber-500/30",
    icon: "solar:user-cross-bold",
    label: "No Show",
  },
};

// Common clinical complaint presets for fast 1-click addition
const CLINICAL_COMPLAINT_PRESETS = [
  "Routine Consultation",
  "Follow-up Review",
  "Prescription Refill",
  "Acute Fever & Flu",
  "Lab Results Review",
  "Chronic Disease Review",
  "Pre-Operative Assessment",
  "Post-Op Checkup",
  "Chest Pain / Cardiology",
  "Hypertension Follow-up",
];

export default function AppointmentDetailPage() {
  const { id } = useParams();
  const { canCreate, canWrite } = useDoctypePermissions("Patient Appointment");
  const { canCreate: canCreateType } = useDoctypePermissions("Appointment Type");
  const canSave = id ? canWrite : canCreate;
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const patientParam = searchParams.get("patient");
  const practitionerParam = searchParams.get("practitioner");
  const isNew = !id || id === "new";

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [workflowLoading, setWorkflowLoading] = useState(false);

  // Reference Data
  const [patients, setPatients] = useState<Patient[]>([]);
  const [practitioners, setPractitioners] = useState<HealthcarePractitioner[]>([]);
  const [departments, setDepartments] = useState<MedicalDepartment[]>([]);
  const [appointmentTypes, setAppointmentTypes] = useState<AppointmentTypeConfig[]>([]);
  const [serviceUnits, setServiceUnits] = useState<any[]>([]);

  // Form State
  const [form, setForm] = useState<Record<string, any>>({
    naming_series: "HLC-APP-.YYYY.-",
    appointment_id: "",
    status: "Scheduled",
    appointment_type: null,
    appointment_for: "Practitioner",
    company: null,
    patient: null,
    patient_name: "",
    patient_sex: "",
    patient_age: "",
    practitioner: null,
    practitioner_name: "",
    department: null,
    service_unit: null,
    appointment_date: new Date().toISOString().split("T")[0],
    appointment_time: "",
    duration: 30,
    insurance_policy: null,
    insurance_payor: null,
    insurance_coverage: null,
    coverage_status: "",
    source: "Walk In",
    referring_practitioner: null,
    add_video_conferencing: false,
    google_meet_link: "",
    mode_of_payment: "Cash",
    paid_amount: 0,
    invoiced: false,
    notes: "",
  });

  // UI Modals & Panels
  const [showPrintSlip, setShowPrintSlip] = useState(false);
  const [showNewType, setShowNewType] = useState(false);
  const [showMoreInfo, setShowMoreInfo] = useState(false);

  // New Appointment Type State
  const [newType, setNewType] = useState({
    appointment_type: "",
    allow_booking_for: "Practitioner",
    default_duration: 30,
    color: "#4F46E5",
  });

  // Doctor Availability Slots State
  const [availLoading, setAvailLoading] = useState(false);
  const [availSlots, setAvailSlots] = useState<{
    time: string;
    end_time?: string;
    available: boolean;
    patient?: string;
    appointment_id?: string;
    status?: string;
  }[]>([]);
  const [availSummary, setAvailSummary] = useState<{ total: number; available: number; occupied: number }>({
    total: 0,
    available: 0,
    occupied: 0,
  });
  const [availMessage, setAvailMessage] = useState("");

  // Load Reference Datasets
  const loadReferenceData = useCallback(async () => {
    try {
      const [patRes, pracRes, deptRes, typeRes, suRes] = await Promise.all([
        HealthcareApi.patients.list({ page_size: 300 }),
        HealthcareApi.practitioners.list({ page_size: 200 }),
        HealthcareApi.departments.list({ page_size: 100 }),
        HealthcareApi.appointmentTypes.list().catch(() => ({ results: [] })) as any,
        HealthcareApi.serviceUnits.list().catch(() => ({ results: [] })) as any,
      ]);
      setPatients(patRes.results || []);
      setPractitioners(pracRes.results || []);
      setDepartments(deptRes.results || []);
      setAppointmentTypes(typeRes.results || []);
      setServiceUnits(suRes.results || []);
    } catch (err) {
      console.error("Failed to load appointment reference data:", err);
    }
  }, []);

  // Load Existing Appointment Record
  const loadAppointment = useCallback(async () => {
    if (!id || isNew) return;
    setLoading(true);
    try {
      const res = await HealthcareApi.appointments.get(Number(id));
      setForm({
        naming_series: (res as any).naming_series || "HLC-APP-.YYYY.-",
        appointment_id: (res as any).appointment_id || "",
        status: res.status || "Scheduled",
        appointment_type: res.appointment_type || null,
        appointment_for: (res as any).appointment_for || "Practitioner",
        company: (res as any).company || null,
        patient: res.patient,
        patient_name: res.patient_name || "",
        patient_sex: (res as any).patient_sex || "",
        patient_age: (res as any).patient_age || "",
        practitioner: res.practitioner,
        practitioner_name: res.practitioner_name || "",
        department: res.department,
        service_unit: (res as any).service_unit || null,
        appointment_date: res.appointment_date || "",
        appointment_time: res.appointment_time || "",
        duration: res.duration || 30,
        insurance_policy: (res as any).insurance_policy || null,
        insurance_payor: (res as any).insurance_payor || null,
        insurance_coverage: (res as any).insurance_coverage || null,
        coverage_status: (res as any).coverage_status || "",
        source: (res as any).source || "Walk In",
        referring_practitioner: (res as any).referring_practitioner || null,
        add_video_conferencing: (res as any).add_video_conferencing || false,
        google_meet_link: (res as any).google_meet_link || "",
        mode_of_payment: (res as any).mode_of_payment || "Cash",
        paid_amount: (res as any).paid_amount || 0,
        invoiced: (res as any).invoiced || false,
        notes: res.notes || "",
      });
    } catch (err) {
      console.error(err);
      toast.error("Failed to load appointment details.");
    } finally {
      setLoading(false);
    }
  }, [id, isNew]);

  useEffect(() => {
    loadReferenceData();
    if (!isNew) loadAppointment();
  }, [loadReferenceData, loadAppointment, isNew]);

  // URL Query Param Pre-population (e.g. ?patient=1)
  useEffect(() => {
    if (isNew && patientParam) {
      const pid = Number(patientParam);
      setForm((prev) => ({ ...prev, patient: pid }));
      HealthcareApi.patients
        .get(pid)
        .then((p: any) => {
          setForm((prev) => ({
            ...prev,
            patient: pid,
            patient_name: p.patient_name || `${p.first_name || ""} ${p.last_name || ""}`.trim(),
            patient_sex: p.sex === "Female" ? "Female" : p.sex === "Male" ? "Male" : "",
            patient_age: p.age ? `${p.age} Y` : prev.patient_age,
          }));
        })
        .catch(() => {});
    }
  }, [isNew, patientParam]);

  // URL Query Param Pre-population (e.g. ?practitioner=4)
  useEffect(() => {
    if (isNew && practitionerParam) {
      const prid = Number(practitionerParam);
      setForm((prev) => ({ ...prev, practitioner: prid }));
      HealthcareApi.practitioners
        .get(prid)
        .then((p: any) => {
          setForm((prev) => ({
            ...prev,
            practitioner: prid,
            practitioner_name: p.practitioner_name || `${p.first_name || ""} ${p.last_name || ""}`.trim(),
            department: p.department || prev.department || null,
          }));
        })
        .catch(() => {});
    }
  }, [isNew, practitionerParam]);

  // Synchronize Patient Selection
  const selectedPatient = useMemo(() => {
    return patients.find((p) => p.id === form.patient);
  }, [patients, form.patient]);

  const handlePatientSelect = (patientId: number | null) => {
    if (!patientId) {
      setForm((prev) => ({
        ...prev,
        patient: null,
        patient_name: "",
        patient_sex: "",
        patient_age: "",
      }));
      return;
    }
    const p = patients.find((pt) => pt.id === patientId);
    if (p) {
      const rawSex = (p as any).sex;
      const cleanSex = rawSex === "Female" ? "Female" : rawSex === "Male" ? "Male" : "";
      setForm((prev) => ({
        ...prev,
        patient: patientId,
        patient_name: p.patient_name || `${p.first_name || ""} ${p.last_name || ""}`.trim(),
        patient_sex: cleanSex,
        patient_age: (p as any).age ? `${(p as any).age} Y` : prev.patient_age,
      }));
    } else {
      setForm((prev) => ({ ...prev, patient: patientId }));
    }
  };

  // Synchronize Practitioner Selection
  const selectedPractitioner = useMemo(() => {
    return practitioners.find((p) => p.id === form.practitioner);
  }, [practitioners, form.practitioner]);

  const handlePractitionerSelect = (prid: number | null) => {
    if (!prid) {
      setForm((prev) => ({ ...prev, practitioner: null, practitioner_name: "" }));
      return;
    }
    const p = practitioners.find((pr) => pr.id === prid);
    setForm((prev) => ({
      ...prev,
      practitioner: prid,
      practitioner_name: p ? p.practitioner_name || `${p.first_name || ""} ${p.last_name || ""}`.trim() : prev.practitioner_name,
      department: prev.department || p?.department || null,
    }));
  };

  // Auto-fill duration when appointment type changes
  useEffect(() => {
    if (form.appointment_type) {
      const t = appointmentTypes.find((at) => at.id === form.appointment_type);
      if (t) {
        setForm((prev) => ({
          ...prev,
          duration: t.default_duration || 30,
          appointment_for: t.allow_booking_for || "Practitioner",
        }));
      }
    }
  }, [form.appointment_type, appointmentTypes]);

  // Check Doctor Availability Slots
  const checkAvailability = async () => {
    if (!form.practitioner || !form.appointment_date) {
      toast.error("Please select a practitioner and date first");
      return;
    }
    setAvailLoading(true);
    setAvailMessage("");
    try {
      const res = (await HealthcareApi.appointments.availability(
        form.practitioner,
        form.appointment_date
      )) as any;
      setAvailSlots(res.slots || []);
      setAvailSummary(res.summary || { total: 0, available: 0, occupied: 0 });
      setAvailMessage(res.message || "");
      if (res.slots && res.slots.length > 0) {
        toast.info(`Found ${res.summary?.available || 0} available slots for ${form.appointment_date}`);
      } else {
        toast.info(res.message || "No schedule or slots configured for this date");
      }
    } catch (err) {
      console.error(err);
      setAvailMessage("Failed to check schedule availability");
      toast.error("Could not retrieve practitioner availability");
    } finally {
      setAvailLoading(false);
    }
  };

  // Split available slots into Morning and Afternoon groups
  const slotGroups = useMemo(() => {
    const morning: typeof availSlots = [];
    const afternoon: typeof availSlots = [];

    availSlots.forEach((slot) => {
      const h = parseInt(slot.time.split(":")[0], 10);
      if (h < 12) {
        morning.push(slot);
      } else {
        afternoon.push(slot);
      }
    });

    return { morning, afternoon };
  }, [availSlots]);

  // Save / Update Handler
  const handleSave = async () => {
    if (!form.patient) {
      toast.error("Please select a patient before saving.");
      return;
    }
    if (!form.appointment_date) {
      toast.error("Please choose an appointment date.");
      return;
    }

    setSaving(true);
    try {
      const payload: Record<string, any> = { ...form };

      // Format appointment_time
      if (!payload.appointment_time || !String(payload.appointment_time).trim()) {
        payload.appointment_time = null;
      } else {
        payload.appointment_time = String(payload.appointment_time).trim();
      }

      // Sanitize foreign keys
      const fkList = [
        "patient",
        "practitioner",
        "department",
        "service_unit",
        "appointment_type",
        "insurance_policy",
        "insurance_payor",
        "insurance_coverage",
        "company",
        "referring_practitioner",
        "billing_item",
        "inpatient_record",
        "emergency_record",
      ];
      for (const fk of fkList) {
        if (payload[fk] === "" || payload[fk] === undefined) {
          payload[fk] = null;
        } else if (typeof payload[fk] === "string" && !payload[fk].trim()) {
          payload[fk] = null;
        }
      }

      payload.duration = Number(payload.duration) || 30;
      payload.paid_amount = Number(payload.paid_amount) || 0;

      if (isNew) {
        const res = await HealthcareApi.appointments.create(payload);
        toast.success("Patient Appointment scheduled successfully");
        navigate(`/healthcare/appointments/${(res as any).id}`);
      } else {
        const res = (await HealthcareApi.appointments.update(Number(id), payload)) as any;
        toast.success("Appointment saved successfully");
        if (res) {
          setForm((prev) => ({
            ...prev,
            ...res,
            appointment_time: res?.appointment_time || "",
          }));
        }
      }
    } catch (err: any) {
      console.error("Failed to save appointment:", err);
      const data = err?.response?.data;
      let errMsg = "Failed to save appointment.";
      if (typeof data === "string") {
        errMsg = data;
      } else if (data && typeof data === "object") {
        const fieldErrors = Object.entries(data)
          .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`)
          .join(" | ");
        if (fieldErrors) errMsg = fieldErrors;
      }
      toast.error(errMsg);
    } finally {
      setSaving(false);
    }
  };

  // Status Lifecycle Actions
  const doWorkflow = async (action: string) => {
    if (!id || isNew) return;
    setWorkflowLoading(true);
    try {
      const apiMap: Record<string, () => Promise<any>> = {
        confirm: () => HealthcareApi.appointments.confirm(Number(id)),
        open: () => HealthcareApi.appointments.open(Number(id)),
        check_in: () => HealthcareApi.appointments.checkIn(Number(id)),
        check_out: () => HealthcareApi.appointments.checkOut(Number(id)),
        close: () => HealthcareApi.appointments.close(Number(id)),
        cancel: () => HealthcareApi.appointments.cancel(Number(id)),
        no_show: () => (HealthcareApi.appointments as any).noShow(Number(id)),
      };
      const fn = apiMap[action];
      if (fn) {
        const res = await fn();
        setForm((prev) => ({ ...prev, status: (res as any).status }));
        toast.success(`Status updated to ${(res as any).status || action}`);
      }
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.response?.data?.detail || err?.message || "Action failed";
      toast.error(msg);
    } finally {
      setWorkflowLoading(false);
    }
  };

  // Next status transition buttons
  const getNextActions = (status: string) => {
    switch (status) {
      case "Scheduled":
        return [
          { action: "confirm", label: "Confirm Visit", icon: "solar:check-circle-bold", color: "text-indigo-600 border-indigo-200 hover:bg-indigo-50" },
          { action: "check_in", label: "Check In Patient", icon: "solar:login-bold", color: "text-emerald-700 bg-emerald-50 border-emerald-300 hover:bg-emerald-100" },
          { action: "cancel", label: "Cancel", icon: "solar:close-circle-bold", color: "text-rose-600 border-rose-200 hover:bg-rose-50" },
          { action: "no_show", label: "No Show", icon: "solar:user-cross-bold", color: "text-amber-600 border-amber-200 hover:bg-amber-50" },
        ];
      case "Open":
        return [
          { action: "confirm", label: "Confirm", icon: "solar:check-circle-bold", color: "text-indigo-600 border-indigo-200 hover:bg-indigo-50" },
          { action: "check_in", label: "Check In", icon: "solar:login-bold", color: "text-emerald-700 bg-emerald-50 border-emerald-300 hover:bg-emerald-100" },
          { action: "cancel", label: "Cancel", icon: "solar:close-circle-bold", color: "text-rose-600 border-rose-200 hover:bg-rose-50" },
        ];
      case "Confirmed":
        return [
          { action: "check_in", label: "Check In Patient", icon: "solar:login-bold", color: "text-emerald-700 bg-emerald-50 border-emerald-300 hover:bg-emerald-100 font-bold" },
          { action: "cancel", label: "Cancel", icon: "solar:close-circle-bold", color: "text-rose-600 border-rose-200 hover:bg-rose-50" },
          { action: "no_show", label: "No Show", icon: "solar:user-cross-bold", color: "text-amber-600 border-amber-200 hover:bg-amber-50" },
        ];
      case "Checked In":
        return [
          { action: "check_out", label: "Check Out Patient", icon: "solar:logout-bold", color: "text-purple-700 border-purple-200 hover:bg-purple-50" },
          { action: "close", label: "Close & Bill", icon: "solar:check-read-bold", color: "text-emerald-700 border-emerald-200 hover:bg-emerald-50" },
          { action: "cancel", label: "Cancel", icon: "solar:close-circle-bold", color: "text-rose-600 border-rose-200 hover:bg-rose-50" },
        ];
      case "Checked Out":
        return [
          { action: "close", label: "Close & Bill Record", icon: "solar:check-read-bold", color: "text-emerald-700 border-emerald-200 hover:bg-emerald-50" },
        ];
      default:
        return [];
    }
  };

  // Quick Create Appointment Type
  const handleCreateType = async () => {
    try {
      const res = await HealthcareApi.appointmentTypes.create(newType);
      setAppointmentTypes([...appointmentTypes, res as AppointmentTypeConfig]);
      setForm({ ...form, appointment_type: (res as any).id });
      setShowNewType(false);
      setNewType({
        appointment_type: "",
        allow_booking_for: "Practitioner",
        default_duration: 30,
        color: "#4F46E5",
      });
      toast.success("Appointment type created successfully");
    } catch (err) {
      console.error(err);
      toast.error("Failed to create appointment type.");
    }
  };

  // Add Chief Complaint Chip to Notes
  const appendComplaintChip = (chip: string) => {
    setForm((prev) => {
      const current = prev.notes || "";
      if (current.toLowerCase().includes(chip.toLowerCase())) {
        return prev;
      }
      const updated = current ? `${current}\n• ${chip}` : `• ${chip}`;
      return { ...prev, notes: updated };
    });
    toast.success(`Added "${chip}" to clinical notes`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
          <span className="text-sm font-medium text-muted-foreground">
            Loading appointment file...
          </span>
        </div>
      </div>
    );
  }

  const currentStatusTheme = STATUS_CONFIG[form.status] || STATUS_CONFIG["Scheduled"];

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* ─── Top Sticky Command Bar ─── */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b px-6 py-3 shadow-xs">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          {/* Breadcrumbs & Status Tag */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Icon icon="solar:home-2-bold" size={13} />
              Healthcare
            </span>
            <span className="text-muted-foreground text-xs">/</span>
            <span
              className="text-xs text-muted-foreground cursor-pointer hover:text-foreground font-medium transition-colors"
              onClick={() => navigate("/healthcare/appointments")}
            >
              Patient Appointments
            </span>
            <span className="text-muted-foreground text-xs">/</span>
            <span className="text-sm font-bold text-foreground">
              {isNew ? "New Appointment Registration" : form.appointment_id || `Appointment #${id}`}
            </span>

            {/* Status Pill */}
            {!isNew && form.status && (
              <Badge
                variant="outline"
                className={cn(
                  "text-xs px-2.5 py-0.5 font-bold ml-1.5 flex items-center gap-1.5",
                  currentStatusTheme.bg,
                  currentStatusTheme.text,
                  currentStatusTheme.border
                )}
              >
                <span className={cn("w-1.5 h-1.5 rounded-full", currentStatusTheme.dot)} />
                {currentStatusTheme.label}
              </Badge>
            )}

            {isNew && (
              <Badge variant="outline" className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30 text-xs ml-1.5 font-semibold">
                Draft / Unsaved
              </Badge>
            )}
          </div>

          {/* Direct Clinical Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            {!isNew && form.patient && (
              <>
                {/* 1-Click Launch Clinical Encounter */}
                <Button
                  size="sm"
                  onClick={() =>
                    navigate(
                      `/healthcare/encounters/new?patient=${form.patient}&practitioner=${
                        form.practitioner || ""
                      }&appointment=${id}&department=${form.department || ""}`
                    )
                  }
                  className="gap-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-semibold shadow-xs text-xs h-9 px-3.5"
                  title="Open Clinical Encounter consultation for this patient"
                >
                  <Icon icon="solar:stethoscope-bold" size={15} />
                  <span>Start Encounter</span>
                </Button>

                {/* Record Vital Signs */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    navigate(`/healthcare/vital-signs/new?patient=${form.patient}&appointment=${id}`)
                  }
                  className="gap-1.5 border-blue-300 text-blue-700 dark:text-blue-300 hover:bg-blue-500/10 text-xs h-9"
                  title="Record vitals before or during consultation"
                >
                  <Icon icon="solar:pulse-2-bold" size={14} />
                  <span>Vitals</span>
                </Button>

                {/* Print Appointment Slip Modal */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowPrintSlip(true)}
                  className="gap-1.5 border-indigo-200 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-500/10 text-xs h-9"
                  title="Print Digital Appointment Slip / Gate Pass"
                >
                  <Icon icon="solar:printer-bold" size={14} />
                  <span>Print Slip</span>
                </Button>

                <Separator orientation="vertical" className="h-5 mx-0.5" />
              </>
            )}

            {/* Workflow Action Transitions */}
            {!isNew &&
              getNextActions(form.status).map((a) => (
                <Button
                  key={a.action}
                  variant="outline"
                  size="sm"
                  onClick={() => doWorkflow(a.action)}
                  disabled={workflowLoading}
                  className={cn("gap-1 text-xs h-9 font-medium", a.color)}
                >
                  <Icon icon={a.icon} size={14} />
                  {a.label}
                </Button>
              ))}

            {/* Save / Commit Record */}
            <Button
              onClick={handleSave}
              disabled={saving || !canSave}
              className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 shadow-md shadow-indigo-500/20 text-xs h-9 font-bold px-4"
            >
              {saving ? (
                <>
                  <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Icon icon="solar:diskette-bold" size={15} />
                  <span>{isNew ? "Create Appointment" : "Save Changes"}</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 lg:px-6 pt-6 space-y-6">
        {/* ─── Executive Clinical Hero Card ─── */}
        <div className="rounded-2xl border bg-gradient-to-br from-card via-card to-indigo-500/5 p-6 shadow-xs relative overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
            {/* Left: Patient Avatar & Key Details */}
            <div className="flex items-start sm:items-center gap-4">
              <Avatar
                src={selectedPatient?.image}
                name={form.patient_name || "Patient"}
                className="w-16 h-16 rounded-2xl ring-2 ring-indigo-500/30 shadow-md font-bold text-lg"
              />
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-2xl font-black tracking-tight text-foreground">
                    {form.patient_name || (isNew ? "Select Patient..." : "Unregistered Patient")}
                  </h1>
                  {selectedPatient && (
                    <Badge variant="outline" className="font-mono text-xs text-muted-foreground">
                      {selectedPatient.patient_id}
                    </Badge>
                  )}
                  {selectedPatient?.blood_group && (
                    <Badge variant="outline" className="bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30 text-xs font-bold">
                      {selectedPatient.blood_group}
                    </Badge>
                  )}
                </div>

                {/* Patient Sub-details */}
                <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                  <span>
                    Gender: <strong className="text-foreground">{form.patient_sex || "N/A"}</strong>
                  </span>
                  <span>•</span>
                  <span>
                    Age: <strong className="text-foreground">{form.patient_age || "N/A"}</strong>
                  </span>
                  {selectedPatient?.mobile && (
                    <>
                      <span>•</span>
                      <a href={`tel:${selectedPatient.mobile}`} className="hover:text-indigo-600 transition-colors flex items-center gap-1 font-mono">
                        <Icon icon="solar:phone-bold" size={12} />
                        {selectedPatient.mobile}
                      </a>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Right: Appointment Meta Highlights */}
            <div className="flex items-center gap-3 flex-wrap bg-muted/40 p-3.5 rounded-xl border border-border/80">
              {/* Scheduled Date */}
              <div className="text-left sm:text-right pr-3 border-r border-border">
                <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                  Date & Time
                </div>
                <div className="text-sm font-bold text-foreground flex items-center gap-1.5 mt-0.5">
                  <Icon icon="solar:calendar-bold" size={14} className="text-indigo-600" />
                  <span>{form.appointment_date || "Not set"}</span>
                </div>
                <div className="text-xs font-bold text-indigo-600 dark:text-indigo-400 font-mono">
                  {form.appointment_time ? formatTime12(form.appointment_time) : "Time not set"}
                </div>
              </div>

              {/* Attending Practitioner */}
              <div className="text-left sm:text-right">
                <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                  Attending Doctor
                </div>
                <div className="text-sm font-bold text-foreground flex items-center gap-1.5 mt-0.5">
                  <Icon icon="solar:user-bold" size={14} className="text-emerald-600" />
                  <span>{form.practitioner_name || "Unassigned"}</span>
                </div>
                <div className="text-xs text-muted-foreground truncate max-w-[140px]">
                  {selectedPractitioner?.department_name || "General Clinic"}
                </div>
              </div>

              {/* Telehealth Direct Link if active */}
              {form.add_video_conferencing && form.google_meet_link && (
                <a
                  href={form.google_meet_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all shrink-0 ml-1"
                >
                  <Icon icon="solar:videocamera-record-bold" size={15} />
                  <span>Join Video Call</span>
                </a>
              )}
            </div>
          </div>
        </div>

        {/* ─── Interactive Clinical Lifecycle Stepper ─── */}
        {!isNew && (
          <div className="rounded-2xl border bg-card p-4 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Icon icon="solar:route-bold" className="text-indigo-600" size={17} />
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Clinical Care Progression
                </span>
              </div>
              <span className="text-xs font-semibold text-foreground">
                Current State: <strong className={cn(currentStatusTheme.text)}>{form.status}</strong>
              </span>
            </div>

            {(() => {
              const stages = [
                { name: "Scheduled", desc: "Booked in advance" },
                { name: "Confirmed", desc: "Patient confirmed" },
                { name: "Checked In", desc: "In Waiting Room" },
                { name: "Checked Out", desc: "Consult Finished" },
                { name: "Closed", desc: "Billed & Finalized" },
              ];
              const currentIdx = stages.findIndex((s) => s.name === form.status);
              const isTerminal = form.status === "Cancelled" || form.status === "No Show";

              return (
                <div className="space-y-3">
                  <div className="flex items-center justify-between overflow-x-auto py-2">
                    {stages.map((st, i) => {
                      const isPast = !isTerminal && currentIdx >= 0 && i < currentIdx;
                      const isCurrent = !isTerminal && currentIdx >= 0 && i === currentIdx;
                      return (
                        <div key={st.name} className="flex items-center flex-1 last:flex-none">
                          <div className="flex flex-col items-center">
                            <div
                              className={cn(
                                "w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all",
                                isPast
                                  ? "bg-emerald-500 border-emerald-500 text-white shadow-xs"
                                  : isCurrent
                                  ? "bg-indigo-600 border-indigo-600 text-white shadow-md ring-4 ring-indigo-500/20 animate-pulse"
                                  : isTerminal
                                  ? "bg-muted/40 border-muted text-muted-foreground"
                                  : "bg-muted/40 border-border text-muted-foreground"
                              )}
                            >
                              {isPast ? (
                                <Icon icon="solar:check-read-bold" size={16} />
                              ) : (
                                <span>{i + 1}</span>
                              )}
                            </div>
                            <span
                              className={cn(
                                "text-[11px] font-semibold mt-1.5 whitespace-nowrap",
                                isCurrent ? "text-indigo-600 dark:text-indigo-400 font-bold" : "text-muted-foreground"
                              )}
                            >
                              {st.name}
                            </span>
                          </div>
                          {i < stages.length - 1 && (
                            <div
                              className={cn(
                                "flex-1 h-1 mx-3 rounded-full transition-all",
                                isPast ? "bg-emerald-500" : "bg-border"
                              )}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {isTerminal && (
                    <div className="mt-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-400 text-xs flex items-center gap-2 font-medium">
                      <Icon icon="solar:danger-triangle-bold" size={16} />
                      <span>This appointment is marked as <strong>{form.status}</strong> and cannot proceed through standard clinical workflow.</span>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}

        {/* ─── Main 2-Column Clinical Cockpit ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* ════════ LEFT COLUMN: Clinical Workspace (8 cols) ════════ */}
          <div className="lg:col-span-8 space-y-6">
            {/* Card 1: Patient Demographics & Profile */}
            <Card className="rounded-2xl border shadow-xs overflow-hidden">
              <CardHeader className="bg-muted/25 border-b p-4 px-6 flex flex-row items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600">
                    <Icon icon="solar:user-bold" size={18} />
                  </div>
                  <div>
                    <CardTitle className="text-base font-bold">Patient Demographics</CardTitle>
                    <CardDescription className="text-xs">Patient identity, gender and contact information</CardDescription>
                  </div>
                </div>

                {selectedPatient && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate(`/healthcare/patients/${selectedPatient.id}`)}
                    className="text-xs h-8 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-500/10 gap-1 font-semibold"
                  >
                    <span>Full Medical Chart</span>
                    <Icon icon="solar:arrow-right-up-bold" size={13} />
                  </Button>
                )}
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Select Patient Entity */}
                  <div>
                    <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                      <span>Select Patient Record</span>
                      <span className="text-rose-500">*</span>
                    </Label>
                    <div className="mt-1.5">
                      <EntitySelect
                        doctype="Patient"
                        rawItems={patients}
                        options={patients.map((p) => ({
                          value: p.id,
                          label: p.patient_name || `${p.first_name || ""} ${p.last_name || ""}`.trim(),
                          sublabel: p.patient_id,
                          image: p.image,
                        }))}
                        value={form.patient}
                        onChange={handlePatientSelect}
                        placeholder="Search patient by name or MRN ID..."
                        emptyText="No patient found"
                        tone="blue"
                      />
                    </div>
                  </div>

                  {/* Patient Name Text */}
                  <div>
                    <Label className="text-xs font-semibold text-muted-foreground">Full Name</Label>
                    <Input
                      value={form.patient_name || ""}
                      onChange={(e) => setForm({ ...form, patient_name: e.target.value })}
                      placeholder="Patient Full Name"
                      className="mt-1.5 bg-muted/20 font-medium"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Standardized Clean Gender (Male / Female Only) */}
                  <div>
                    <Label className="text-xs font-semibold text-muted-foreground">Gender</Label>
                    <select
                      className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring mt-1.5 font-medium"
                      value={form.patient_sex || ""}
                      onChange={(e) => setForm({ ...form, patient_sex: e.target.value })}
                    >
                      <option value="">Select Gender...</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                    </select>
                  </div>

                  {/* Age */}
                  <div>
                    <Label className="text-xs font-semibold text-muted-foreground">Age</Label>
                    <Input
                      value={form.patient_age || ""}
                      onChange={(e) => setForm({ ...form, patient_age: e.target.value })}
                      placeholder="e.g. 34 Y"
                      className="mt-1.5 bg-muted/20 font-medium"
                    />
                  </div>
                </div>

                {/* Patient Medical Glance Strip */}
                {selectedPatient && (
                  <div className="p-3.5 bg-indigo-500/5 rounded-xl border border-indigo-500/20 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center text-sm shadow-xs">
                        {getInitials(selectedPatient.patient_name || "Patient")}
                      </div>
                      <div>
                        <div className="font-bold text-foreground flex items-center gap-2">
                          <span>{selectedPatient.patient_name}</span>
                          {selectedPatient.blood_group && (
                            <Badge variant="outline" className="text-[10px] py-0 px-1.5 bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30">
                              Blood: {selectedPatient.blood_group}
                            </Badge>
                          )}
                        </div>
                        <div className="text-muted-foreground text-[11px] mt-0.5">
                          {selectedPatient.sex || "Sex: N/A"} • {selectedPatient.age ? `${selectedPatient.age} Y` : "Age: N/A"} • {selectedPatient.mobile || selectedPatient.phone || "No phone registered"}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Card 2: Schedule, Timing & Practitioner Slots Picker */}
            <Card className="rounded-2xl border shadow-xs overflow-hidden">
              <CardHeader className="bg-muted/25 border-b p-4 px-6 flex flex-row items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600">
                    <Icon icon="solar:calendar-bold" size={18} />
                  </div>
                  <div>
                    <CardTitle className="text-base font-bold">Schedule & Practitioner Assignment</CardTitle>
                    <CardDescription className="text-xs">Select attending doctor, date, time slot, and clinical duration</CardDescription>
                  </div>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={checkAvailability}
                  disabled={availLoading}
                  className="h-8 text-xs gap-1.5 border-blue-300 text-blue-700 dark:text-blue-300 hover:bg-blue-500/10 font-semibold"
                >
                  {availLoading ? (
                    <>
                      <div className="h-3 w-3 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                      <span>Checking...</span>
                    </>
                  ) : (
                    <>
                      <Icon icon="solar:calendar-search-bold" size={14} />
                      <span>Check Slots</span>
                    </>
                  )}
                </Button>
              </CardHeader>
              <CardContent className="p-6 space-y-5">
                {/* Appointment Type & Booking For */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold text-muted-foreground">Appointment Type</Label>
                      {canCreateType && (
                        <button
                          type="button"
                          onClick={() => setShowNewType(true)}
                          className="text-[11px] text-indigo-600 hover:underline font-semibold flex items-center gap-0.5"
                        >
                          <Icon icon="solar:add-circle-bold" size={12} />
                          New Type
                        </button>
                      )}
                    </div>
                    <div className="mt-1.5">
                      <EntitySelect
                        doctype="Appointment Type"
                        rawItems={appointmentTypes}
                        options={appointmentTypes.map((t) => ({
                          value: t.id,
                          label: t.appointment_type,
                          sublabel: t.default_duration ? `${t.default_duration} min` : undefined,
                        }))}
                        value={form.appointment_type}
                        onChange={(v) => setForm({ ...form, appointment_type: v })}
                        onOptionAdded={(_opt, raw) => {
                          if (raw) setAppointmentTypes((prev) => [...prev, raw]);
                        }}
                        placeholder="Select Appointment Type..."
                        emptyText="No appointment types found"
                        tone="blue"
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs font-semibold text-muted-foreground">Booking Target</Label>
                    <select
                      className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring mt-1.5 font-medium"
                      value={form.appointment_for}
                      onChange={(e) => setForm({ ...form, appointment_for: e.target.value })}
                    >
                      <option value="Practitioner">Healthcare Practitioner</option>
                      <option value="Department">Medical Department</option>
                      <option value="Service Unit">Service Unit / Room</option>
                    </select>
                  </div>
                </div>

                {/* Healthcare Practitioner & Medical Department */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                      <span>Attending Doctor</span>
                      <span className="text-rose-500">*</span>
                    </Label>
                    <div className="mt-1.5">
                      <EntitySelect
                        doctype="Healthcare Practitioner"
                        rawItems={practitioners}
                        options={practitioners.map((p) => ({
                          value: p.id,
                          label: p.practitioner_name || `${p.first_name || ""} ${p.last_name || ""}`.trim(),
                          avatarName: `${p.first_name || ""} ${p.last_name || ""}`,
                          sublabel: p.designation || p.department_name,
                          image: p.image,
                        }))}
                        value={form.practitioner}
                        onChange={handlePractitionerSelect}
                        placeholder="Select Practitioner..."
                        emptyText="No practitioner found"
                        tone="blue"
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs font-semibold text-muted-foreground">Medical Department</Label>
                    <select
                      className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring mt-1.5 font-medium"
                      value={form.department || ""}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          department: e.target.value ? Number(e.target.value) : null,
                        })
                      }
                    >
                      <option value="">Select Medical Department...</option>
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.department}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Date, Time & Duration Matrix */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
                  {/* Appointment Date */}
                  <div>
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                        <span>Appointment Date</span>
                        <span className="text-rose-500">*</span>
                      </Label>
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, appointment_date: new Date().toISOString().split("T")[0] })}
                        className="text-[10px] text-indigo-600 hover:underline font-semibold"
                      >
                        Today
                      </button>
                    </div>
                    <Input
                      type="date"
                      value={form.appointment_date}
                      onChange={(e) => setForm({ ...form, appointment_date: e.target.value })}
                      className="mt-1.5 font-medium"
                    />
                  </div>

                  {/* Appointment Time */}
                  <div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Label className="text-xs font-semibold text-muted-foreground">Time Slot</Label>
                        {form.appointment_time && (
                          <span className="text-[10px] font-bold text-indigo-600 bg-indigo-500/10 px-1.5 py-0.5 rounded font-mono">
                            {formatTime12(form.appointment_time)}
                          </span>
                        )}
                      </div>
                      {form.appointment_time && (
                        <button
                          type="button"
                          onClick={() => setForm({ ...form, appointment_time: "" })}
                          className="text-[11px] text-muted-foreground hover:text-rose-600 transition-colors"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                    <Input
                      type="time"
                      value={to24Hour(form.appointment_time) || ""}
                      onChange={(e) => setForm({ ...form, appointment_time: e.target.value })}
                      className="mt-1.5 font-medium"
                    />
                  </div>

                  {/* Duration Presets */}
                  <div>
                    <Label className="text-xs font-semibold text-muted-foreground">Duration (Minutes)</Label>
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <Input
                        type="number"
                        value={form.duration}
                        onChange={(e) => setForm({ ...form, duration: Number(e.target.value) || 30 })}
                        className="w-18 font-medium"
                      />
                      <div className="flex items-center gap-1">
                        {[15, 30, 45, 60].map((m) => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => setForm({ ...form, duration: m })}
                            className={cn(
                              "px-2 py-1 text-xs rounded-md border transition-all font-semibold",
                              form.duration === m
                                ? "bg-indigo-600 text-white border-indigo-600 shadow-2xs"
                                : "bg-muted/40 text-muted-foreground hover:bg-muted border-border"
                            )}
                          >
                            {m}m
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Selected Slot Highlight Box */}
                {form.appointment_time && (
                  <div className="flex items-center justify-between p-3 bg-indigo-500/10 border border-indigo-500/25 rounded-xl text-xs">
                    <div className="flex items-center gap-2">
                      <Icon icon="solar:clock-circle-bold" className="text-indigo-600" size={17} />
                      <span className="text-foreground font-semibold">
                        Scheduled for <strong>{form.appointment_date}</strong> at <strong>{formatTime12(form.appointment_time)}</strong> ({form.duration} mins)
                      </span>
                    </div>
                    <Badge variant="outline" className="bg-background text-indigo-700 dark:text-indigo-300 border-indigo-500/30 text-[11px] font-bold">
                      Slot Selected
                    </Badge>
                  </div>
                )}

                {/* Live Doctor Slots Matrix (If Checked) */}
                {(availSlots.length > 0 || availLoading || availMessage) && (
                  <div className="p-4 rounded-xl border bg-muted/20 space-y-3.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Icon icon="solar:calendar-mark-bold" className="text-indigo-600" size={16} />
                        <span className="text-xs font-bold text-foreground">
                          {form.practitioner_name || "Doctor"} - Available Time Slots
                        </span>
                        {availLoading && <div className="h-3 w-3 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />}
                      </div>

                      <div className="flex items-center gap-3 text-xs">
                        <span className="text-emerald-600 font-bold">{availSummary.available} Open</span>
                        <span className="text-rose-500 font-semibold">{availSummary.occupied} Booked</span>
                        <button
                          type="button"
                          onClick={() => {
                            setAvailSlots([]);
                            setAvailMessage("");
                          }}
                          className="text-muted-foreground hover:text-foreground text-[11px]"
                        >
                          Close
                        </button>
                      </div>
                    </div>

                    {availMessage && !availSlots.length && (
                      <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-xs flex items-center gap-2">
                        <Icon icon="solar:info-circle-bold" size={15} />
                        <span>{availMessage}</span>
                      </div>
                    )}

                    {availSlots.length > 0 && (
                      <div className="space-y-3">
                        {/* Morning Slots */}
                        {slotGroups.morning.length > 0 && (
                          <div>
                            <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1.5 flex items-center gap-1">
                              <Icon icon="solar:sun-bold" size={12} className="text-amber-500" />
                              Morning Sessions (08:00 - 12:00)
                            </div>
                            <div className="grid grid-cols-3 sm:grid-cols-6 md:grid-cols-8 gap-2">
                              {slotGroups.morning.map((slot) => {
                                const isSelected =
                                  form.appointment_time &&
                                  (to24Hour(form.appointment_time) === to24Hour(slot.time) ||
                                    formatTime12(form.appointment_time) === formatTime12(slot.time));
                                const label12 = formatTime12(slot.time);
                                return (
                                  <button
                                    key={slot.time}
                                    type="button"
                                    disabled={!slot.available}
                                    onClick={() => {
                                      setForm({ ...form, appointment_time: slot.time });
                                      toast.success(`Selected slot: ${label12}`);
                                    }}
                                    className={cn(
                                      "p-2 rounded-lg text-xs border text-center transition-all",
                                      isSelected
                                        ? "bg-indigo-600 text-white border-indigo-600 font-bold shadow-xs ring-2 ring-indigo-500/30"
                                        : slot.available
                                        ? "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20 font-semibold"
                                        : "bg-rose-500/5 text-rose-400 border-rose-500/15 cursor-not-allowed opacity-60"
                                    )}
                                  >
                                    <div className="leading-tight">{label12}</div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Afternoon Slots */}
                        {slotGroups.afternoon.length > 0 && (
                          <div>
                            <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1.5 flex items-center gap-1">
                              <Icon icon="solar:sunset-bold" size={12} className="text-orange-500" />
                              Afternoon & Evening Sessions (12:00 - 18:00)
                            </div>
                            <div className="grid grid-cols-3 sm:grid-cols-6 md:grid-cols-8 gap-2">
                              {slotGroups.afternoon.map((slot) => {
                                const isSelected =
                                  form.appointment_time &&
                                  (to24Hour(form.appointment_time) === to24Hour(slot.time) ||
                                    formatTime12(form.appointment_time) === formatTime12(slot.time));
                                const label12 = formatTime12(slot.time);
                                return (
                                  <button
                                    key={slot.time}
                                    type="button"
                                    disabled={!slot.available}
                                    onClick={() => {
                                      setForm({ ...form, appointment_time: slot.time });
                                      toast.success(`Selected slot: ${label12}`);
                                    }}
                                    className={cn(
                                      "p-2 rounded-lg text-xs border text-center transition-all",
                                      isSelected
                                        ? "bg-indigo-600 text-white border-indigo-600 font-bold shadow-xs ring-2 ring-indigo-500/30"
                                        : slot.available
                                        ? "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20 font-semibold"
                                        : "bg-rose-500/5 text-rose-400 border-rose-500/15 cursor-not-allowed opacity-60"
                                    )}
                                  >
                                    <div className="leading-tight">{label12}</div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Telehealth Suite */}
                <div className="p-3.5 bg-muted/30 rounded-xl border space-y-3">
                  <label className="flex items-center gap-2.5 text-xs font-semibold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.add_video_conferencing || false}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        const meetLink =
                          checked && !form.google_meet_link
                            ? `https://meet.google.com/med-${Math.random().toString(36).substring(2, 5)}-${Math.random()
                                .toString(36)
                                .substring(2, 6)}`
                            : form.google_meet_link;
                        setForm({
                          ...form,
                          add_video_conferencing: checked,
                          google_meet_link: meetLink,
                        });
                      }}
                      className="rounded border-input text-indigo-600 focus:ring-indigo-600 h-4 w-4"
                    />
                    <Icon icon="solar:videocamera-record-bold" size={16} className="text-indigo-600" />
                    <span>Enable Telehealth Remote Video Consultation</span>
                  </label>

                  {form.add_video_conferencing && (
                    <div className="flex items-center gap-2 pt-1">
                      <Input
                        value={form.google_meet_link || ""}
                        onChange={(e) => setForm({ ...form, google_meet_link: e.target.value })}
                        placeholder="https://meet.google.com/..."
                        className="flex-1 font-mono text-xs h-9"
                      />
                      {form.google_meet_link && (
                        <a
                          href={form.google_meet_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 h-9 transition-colors shrink-0"
                        >
                          <Icon icon="solar:link-bold" size={13} />
                          Join
                        </a>
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-9 text-xs font-semibold shrink-0"
                        onClick={() => {
                          const rand = `https://meet.google.com/med-${Math.random().toString(36).substring(2, 5)}-${Math.random().toString(36).substring(2, 6)}`;
                          setForm({ ...form, google_meet_link: rand });
                          toast.success("Generated Google Meet consultation URL");
                        }}
                      >
                        Generate Link
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Card 3: Clinical Reason for Visit & Quick Complaints */}
            <Card className="rounded-2xl border shadow-xs overflow-hidden">
              <CardHeader className="bg-muted/25 border-b p-4 px-6 flex flex-row items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600">
                    <Icon icon="solar:document-text-bold" size={18} />
                  </div>
                  <div>
                    <CardTitle className="text-base font-bold">Reason for Visit & Clinical Triage</CardTitle>
                    <CardDescription className="text-xs">Patient complaints, symptoms, and clinical admission notes</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                {/* 1-Click Fast Complaint Chips */}
                <div>
                  <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2">
                    Quick Clinical Presets (Click to append):
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {CLINICAL_COMPLAINT_PRESETS.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => appendComplaintChip(preset)}
                        className="px-2.5 py-1 text-xs font-medium rounded-lg border bg-muted/30 text-foreground hover:bg-indigo-500/10 hover:border-indigo-500/30 transition-all flex items-center gap-1"
                      >
                        <Icon icon="solar:add-circle-bold" size={12} className="text-indigo-600" />
                        <span>{preset}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Textarea */}
                <div>
                  <textarea
                    className="w-full border rounded-xl p-3.5 text-sm min-h-[110px] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring bg-background font-normal"
                    value={form.notes || ""}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    placeholder="Enter patient chief complaints, clinical notes, symptoms, or referral reasons..."
                  />
                </div>
              </CardContent>
            </Card>

            {/* Card 4: Facility Routing & Internal Details (Collapsible) */}
            <Card className="rounded-2xl border shadow-xs overflow-hidden">
              <button
                type="button"
                className="w-full flex items-center justify-between p-4 px-6 text-left hover:bg-muted/40 transition-colors"
                onClick={() => setShowMoreInfo(!showMoreInfo)}
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-muted text-muted-foreground">
                    <Icon icon="solar:settings-bold" size={17} />
                  </div>
                  <div>
                    <span className="font-bold text-sm text-foreground">Facility Room & Technical Routing</span>
                    <p className="text-xs text-muted-foreground">Examination room, queue position and series configuration</p>
                  </div>
                </div>
                <Icon
                  icon={showMoreInfo ? "solar:alt-arrow-up-bold" : "solar:alt-arrow-down-bold"}
                  size={16}
                  className="text-muted-foreground"
                />
              </button>

              {showMoreInfo && (
                <CardContent className="p-6 pt-2 border-t space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs font-semibold text-muted-foreground">Examination Room / Service Unit</Label>
                      <select
                        className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring mt-1.5 font-medium"
                        value={form.service_unit || ""}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            service_unit: e.target.value ? Number(e.target.value) : null,
                          })
                        }
                      >
                        <option value="">Select Service Unit...</option>
                        {serviceUnits.map((su) => (
                          <option key={su.id} value={su.id}>
                            {su.service_unit_name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <Label className="text-xs font-semibold text-muted-foreground">Naming Series</Label>
                      <select
                        className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring mt-1.5 font-mono text-xs"
                        value={form.naming_series}
                        onChange={(e) => setForm({ ...form, naming_series: e.target.value })}
                      >
                        <option value="HLC-APP-.YYYY.-">HLC-APP-.YYYY.-</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs font-semibold text-muted-foreground">Referral Source</Label>
                      <select
                        className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring mt-1.5 font-medium"
                        value={form.source || "Walk In"}
                        onChange={(e) => setForm({ ...form, source: e.target.value })}
                      >
                        <option value="Walk In">Walk In</option>
                        <option value="Hospital Referral">Hospital Referral</option>
                        <option value="Online Booking">Online Booking</option>
                        <option value="Emergency">Emergency</option>
                        <option value="Phone Appointment">Phone Appointment</option>
                      </select>
                    </div>

                    <div>
                      <Label className="text-xs font-semibold text-muted-foreground">Referring Practitioner</Label>
                      <div className="mt-1.5">
                        <EntitySelect
                          doctype="Healthcare Practitioner"
                          rawItems={practitioners}
                          options={practitioners.map((p) => ({
                            value: p.id,
                            label: p.practitioner_name || `${p.first_name || ""} ${p.last_name || ""}`.trim(),
                            sublabel: p.department_name,
                          }))}
                          value={form.referring_practitioner}
                          onChange={(v) => setForm({ ...form, referring_practitioner: v })}
                          placeholder="Select referring doctor..."
                          emptyText="No practitioner found"
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>
          </div>

          {/* ════════ RIGHT COLUMN: Clinical Pass & Context (4 cols) ════════ */}
          <div className="lg:col-span-4 space-y-6">
            {/* Component 1: Digital Hospital Appointment Pass / Ticket */}
            <div className="rounded-2xl border bg-gradient-to-b from-card via-card to-indigo-500/5 p-5 shadow-xs relative overflow-hidden">
              <div className="flex items-center justify-between border-b pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-indigo-600 text-white">
                    <Icon icon="solar:ticket-bold" size={15} />
                  </div>
                  <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                    Appointment Pass
                  </span>
                </div>
                <Badge variant="outline" className="font-mono text-[10px] bg-background">
                  {form.appointment_id || "REF-DRAFT"}
                </Badge>
              </div>

              {/* Pass Body */}
              <div className="space-y-3.5 text-xs">
                <div>
                  <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                    Patient Name
                  </span>
                  <div className="text-sm font-black text-foreground">
                    {form.patient_name || "Unselected Patient"}
                  </div>
                  {selectedPatient?.patient_id && (
                    <div className="text-[11px] text-muted-foreground font-mono">
                      MRN: {selectedPatient.patient_id}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-dashed">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                      Date
                    </span>
                    <div className="font-bold text-foreground mt-0.5">
                      {form.appointment_date || "N/A"}
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                      Time Slot
                    </span>
                    <div className="font-bold text-indigo-600 dark:text-indigo-400 font-mono mt-0.5">
                      {form.appointment_time ? formatTime12(form.appointment_time) : "Not Set"}
                    </div>
                  </div>
                </div>

                <div className="pt-1 border-t border-dashed">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                    Consulting Doctor
                  </span>
                  <div className="font-bold text-foreground mt-0.5">
                    {form.practitioner_name || "Any Doctor Available"}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {selectedPractitioner?.department_name || "General Clinic"}
                  </div>
                </div>

                {/* Simulated Barcode */}
                <div className="pt-2 text-center">
                  <div className="h-8 bg-muted/60 rounded flex items-center justify-center font-mono tracking-widest text-xs text-muted-foreground select-none">
                    ||||| | |||| ||| |||| | |||||
                  </div>
                  <div className="text-[10px] font-mono text-muted-foreground mt-1">
                    {form.appointment_id || "APP-DIGITAL-TOKEN"}
                  </div>
                </div>

                {/* Print Pass Button */}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowPrintSlip(true)}
                  className="w-full text-xs font-bold gap-1.5 h-9 border-indigo-200 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-500/10"
                >
                  <Icon icon="solar:printer-bold" size={14} />
                  <span>Print Ticket / Slip</span>
                </Button>
              </div>
            </div>

            {/* Component 2: Attending Doctor Profile Snapshot */}
            {selectedPractitioner && (
              <div className="rounded-2xl border bg-card p-5 shadow-xs space-y-3">
                <div className="flex items-center gap-3">
                  <Avatar
                    src={selectedPractitioner.image}
                    name={selectedPractitioner.practitioner_name}
                    className="w-12 h-12 rounded-xl ring-2 ring-emerald-500/30 font-bold"
                  />
                  <div>
                    <h3 className="font-bold text-sm text-foreground">
                      {selectedPractitioner.practitioner_name}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {selectedPractitioner.designation || selectedPractitioner.department_name || "Consultant"}
                    </p>
                  </div>
                </div>

                <Separator />

                <div className="space-y-1.5 text-xs text-muted-foreground">
                  {selectedPractitioner.mobile_phone && (
                    <div className="flex items-center gap-2">
                      <Icon icon="solar:phone-bold" size={13} className="text-indigo-600" />
                      <span>{selectedPractitioner.mobile_phone}</span>
                    </div>
                  )}
                  {selectedPractitioner.department_name && (
                    <div className="flex items-center gap-2">
                      <Icon icon="solar:buildings-bold" size={13} className="text-indigo-600" />
                      <span>{selectedPractitioner.department_name}</span>
                    </div>
                  )}
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate(`/healthcare/practitioners/${selectedPractitioner.id}`)}
                  className="w-full text-xs h-8 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-500/10 font-semibold"
                >
                  View Doctor Profile & Roster
                </Button>
              </div>
            )}

            {/* Component 3: Document Communication & Audit Timeline */}
            {!isNew && (
              <DocumentTimeline
                doctype="Patient Appointment"
                docname={String(id)}
                altDocname={form.appointment_id}
                className="pt-2"
              />
            )}
          </div>
        </div>
      </div>

      {/* ─── Printable Appointment Slip Modal ─── */}
      <Dialog open={showPrintSlip} onOpenChange={setShowPrintSlip}>
        <DialogContent className="sm:max-w-md p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Icon icon="solar:ticket-bold" className="text-indigo-600" size={18} />
              Hospital Appointment Ticket
            </DialogTitle>
            <DialogDescription className="text-xs">
              Printable registration pass for patient consultation admission
            </DialogDescription>
          </DialogHeader>

          {/* Printable Ticket Card */}
          <div id="printable-appointment-slip" className="border-2 border-dashed rounded-xl p-5 bg-card space-y-4 my-2">
            {/* Clinic Header */}
            <div className="text-center pb-3 border-b space-y-1">
              <div className="font-black text-sm uppercase tracking-wider text-foreground">
                Healthcare Center & Clinical Suites
              </div>
              <div className="text-[11px] text-muted-foreground">
                Outpatient Department Consultation Ticket
              </div>
            </div>

            {/* Main Token */}
            <div className="text-center py-1">
              <div className="text-3xl font-black text-indigo-600 font-mono tracking-tight">
                {form.appointment_id || "APP-2026-TOKEN"}
              </div>
              <Badge variant="outline" className="mt-1 font-bold text-xs bg-emerald-500/10 text-emerald-700 border-emerald-500/30">
                {form.status || "Scheduled"}
              </Badge>
            </div>

            {/* Details Grid */}
            <div className="space-y-2 text-xs border-t border-b py-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Patient Name:</span>
                <span className="font-bold text-foreground">{form.patient_name || "N/A"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Gender & Age:</span>
                <span className="font-medium text-foreground">{form.patient_sex || "N/A"} • {form.patient_age || "N/A"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Attending Doctor:</span>
                <span className="font-bold text-foreground">{form.practitioner_name || "General Practitioner"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Department:</span>
                <span className="font-medium text-foreground">{selectedPractitioner?.department_name || "General Clinic"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Appointment Date:</span>
                <span className="font-bold text-foreground">{form.appointment_date}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Time Slot:</span>
                <span className="font-bold text-indigo-600 font-mono">
                  {form.appointment_time ? formatTime12(form.appointment_time) : "N/A"} ({form.duration} mins)
                </span>
              </div>
            </div>

            {/* Barcode Graphic */}
            <div className="text-center pt-1">
              <div className="h-9 bg-muted/60 rounded flex items-center justify-center font-mono tracking-widest text-xs text-muted-foreground">
                |||| | |||||| | ||||| |||| | ||||
              </div>
              <div className="text-[10px] text-muted-foreground mt-1">
                Please present this ticket at reception & nursing triage.
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setShowPrintSlip(false)}>
              Close
            </Button>
            <Button
              size="sm"
              onClick={() => {
                window.print();
              }}
              className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 font-bold"
            >
              <Icon icon="solar:printer-bold" size={14} />
              <span>Print Slip</span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── New Appointment Type Dialog ─── */}
      {showNewType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-background rounded-2xl p-6 w-full max-w-md shadow-2xl border">
            <div className="flex items-center justify-between mb-4 border-b pb-3">
              <h3 className="font-bold text-base">New Appointment Type</h3>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full"
                onClick={() => setShowNewType(false)}
              >
                <Icon icon="solar:close-bold" size={16} />
              </Button>
            </div>
            <div className="space-y-4">
              <div>
                <Label className="text-xs font-semibold text-muted-foreground">Appointment Type Name *</Label>
                <Input
                  value={newType.appointment_type}
                  onChange={(e) => setNewType({ ...newType, appointment_type: e.target.value })}
                  className="mt-1.5"
                  placeholder="e.g. Consultation, Dental Checkup, Follow-up"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold text-muted-foreground">Allow Booking For *</Label>
                <select
                  className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring mt-1.5"
                  value={newType.allow_booking_for}
                  onChange={(e) => setNewType({ ...newType, allow_booking_for: e.target.value })}
                >
                  <option value="Practitioner">Practitioner</option>
                  <option value="Department">Department</option>
                  <option value="Service Unit">Service Unit</option>
                </select>
              </div>
              <div>
                <Label className="text-xs font-semibold text-muted-foreground">Default Duration (Minutes)</Label>
                <Input
                  type="number"
                  value={newType.default_duration}
                  onChange={(e) =>
                    setNewType({ ...newType, default_duration: Number(e.target.value) || 30 })
                  }
                  className="mt-1.5"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6 pt-3 border-t">
              <Button variant="outline" size="sm" onClick={() => setShowNewType(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleCreateType}
                disabled={!newType.appointment_type.trim()}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
              >
                Create Type
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
