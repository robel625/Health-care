import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Icon } from "@/components/icon";
import { Button } from "@/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card";
import { Input } from "@/ui/input";
import { Badge } from "@/ui/badge";
import { Chart, useChart } from "@/components/chart";
import { HealthcareApi, type Patient } from "@/api/services/healthcareService";
import Avatar from "@/components/Avatar";
import { formatAge } from "@/utils/age";
import { toast } from "sonner";

export interface PatientTimelineEvent {
  id: string;
  doctype: string;
  reference_name: string;
  time: string;
  timestamp: number;
  dateStr: string;
  title: string;
  subtitle?: string;
  user: string;
  status?: string;
  icon: string;
  accent: string;
  badgeClass: string;
  details?: Record<string, any>;
  raw?: any;
}

const DOCTYPE_CONFIG: Record<
  string,
  { label: string; icon: string; accent: string; badgeClass: string }
> = {
  PatientEncounter: {
    label: "Encounter",
    icon: "solar:clipboard-text-bold-duotone",
    accent: "bg-emerald-500",
    badgeClass: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800",
  },
  PatientAppointment: {
    label: "Appointment",
    icon: "solar:calendar-bold-duotone",
    accent: "bg-blue-500",
    badgeClass: "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-300 dark:border-blue-800",
  },
  VitalSigns: {
    label: "Vital Signs",
    icon: "solar:heart-pulse-bold-duotone",
    accent: "bg-rose-500",
    badgeClass: "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-300 dark:border-rose-800",
  },
  DrugPrescription: {
    label: "Prescription",
    icon: "solar:pill-bold-duotone",
    accent: "bg-amber-500",
    badgeClass: "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300 dark:border-amber-800",
  },
  MedicationRequest: {
    label: "Medication Order",
    icon: "solar:pills-bold-duotone",
    accent: "bg-purple-500",
    badgeClass: "bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border-purple-300 dark:border-purple-800",
  },
  LabTest: {
    label: "Lab Test",
    icon: "solar:flask-bold-duotone",
    accent: "bg-cyan-500",
    badgeClass: "bg-cyan-50 text-cyan-700 dark:bg-cyan-950/60 dark:text-cyan-300 border-cyan-300 dark:border-cyan-800",
  },
  InpatientRecord: {
    label: "Inpatient Admission",
    icon: "solar:hospital-bold-duotone",
    accent: "bg-indigo-500",
    badgeClass: "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-300 dark:border-indigo-800",
  },
  TherapyPlan: {
    label: "Therapy Plan",
    icon: "solar:dumbbell-small-bold-duotone",
    accent: "bg-teal-500",
    badgeClass: "bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300 border-teal-300 dark:border-teal-800",
  },
  Observation: {
    label: "Clinical Observation",
    icon: "solar:eye-bold-duotone",
    accent: "bg-violet-500",
    badgeClass: "bg-violet-50 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300 border-violet-300 dark:border-violet-800",
  },
  ServiceRequest: {
    label: "Service Order",
    icon: "solar:notes-bold-duotone",
    accent: "bg-orange-500",
    badgeClass: "bg-orange-50 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300 border-orange-300 dark:border-orange-800",
  },
  PatientMedicalRecord: {
    label: "Medical Record Note",
    icon: "solar:document-text-bold-duotone",
    accent: "bg-slate-500",
    badgeClass: "bg-slate-50 text-slate-700 dark:bg-slate-900 dark:text-slate-300 border-slate-300 dark:border-slate-800",
  },
};

export default function PatientHistoryPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const patientParam = searchParams.get("patient");

  const [patients, setPatients] = useState<Patient[]>([]);
  const [patientId, setPatientId] = useState<number | null>(patientParam ? Number(patientParam) : null);
  const [patient, setPatient] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Longitudinal Raw Data
  const [events, setEvents] = useState<PatientTimelineEvent[]>([]);
  const [vitals, setVitals] = useState<any[]>([]);
  const [inpatients, setInpatients] = useState<any[]>([]);

  // Search & Filter State
  const [patientSearch, setPatientSearch] = useState("");
  const [showPatientDropdown, setShowPatientDropdown] = useState(false);
  const [query, setQuery] = useState("");
  const [docTypeFilter, setDocTypeFilter] = useState<string>("All");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [datePreset, setDatePreset] = useState<"all" | "30d" | "6m" | "1y">("all");

  // Vitals Chart Mode
  const [activeChart, setActiveChart] = useState<"bp" | "pulse" | "temperature" | "spo2" | "bmi">("bp");

  // Expanded items state in timeline
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});

  const toggleExpand = (id: string) => {
    setExpandedItems((prev) => ({ ...prev, [id]: prev[id] === undefined ? false : !prev[id] }));
  };

  // ── Load patients list for selector ──────────────────────────────────
  useEffect(() => {
    HealthcareApi.patients.list({ page_size: 300 })
      .then((res) => setPatients(res.results || []))
      .catch((err) => console.error("Failed to load patients:", err));
  }, []);

  // Update query param when patient changes
  const selectPatient = (p: Patient) => {
    setPatientId(p.id);
    setPatientSearch(p.patient_name || `${p.first_name || ""} ${p.last_name || ""}`);
    setShowPatientDropdown(false);
    setSearchParams({ patient: String(p.id) });
  };

  const clearPatient = () => {
    setPatientId(null);
    setPatient(null);
    setPatientSearch("");
    setEvents([]);
    setVitals([]);
    setInpatients([]);
    setSearchParams({});
  };

  // ── Load complete Marley longitudinal record for patient ─────────────
  const loadPatientData = useCallback(async (pid: number) => {
    setLoading(true);
    try {
      // Parallel fetch across all Marley clinical doctypes
      const [
        pRes,
        apptRes,
        encRes,
        vsRes,
        rxRes,
        medReqRes,
        labRes,
        thRes,
        inptRes,
        obsRes,
        pmrRes,
        srRes,
      ] = await Promise.all([
        HealthcareApi.patients.get(pid).catch(() => null),
        HealthcareApi.appointments.list({ patient: pid, page_size: 150 }).catch(() => ({ results: [] })),
        HealthcareApi.encounters.list({ patient: pid, page_size: 150 }).catch(() => ({ results: [] })),
        HealthcareApi.vitalSigns.list({ patient: pid, page_size: 150 }).catch(() => ({ results: [] })),
        HealthcareApi.prescriptions.list({ patient: pid, page_size: 150 }).catch(() => ({ results: [] })),
        HealthcareApi.medicationRequests.list({ patient: pid, page_size: 150 }).catch(() => ({ results: [] })),
        HealthcareApi.labTests.list({ patient: pid, page_size: 150 }).catch(() => ({ results: [] })),
        HealthcareApi.therapyPlans.list({ patient: pid, page_size: 150 }).catch(() => ({ results: [] })),
        HealthcareApi.inpatientRecords.list({ patient: pid, page_size: 150 }).catch(() => ({ results: [] })),
        HealthcareApi.observations.list({ patient: pid, page_size: 150 }).catch(() => ({ results: [] })),
        HealthcareApi.medicalRecords.list({ patient: pid, page_size: 150 }).catch(() => ({ results: [] })),
        HealthcareApi.serviceRequests.list({ patient: pid, page_size: 150 }).catch(() => ({ results: [] })),
      ]);

      setPatient(pRes);
      const vsList = (vsRes as any).results || [];
      setVitals(vsList);
      const inptList = (inptRes as any).results || [];
      setInpatients(inptList);

      const timeline: PatientTimelineEvent[] = [];

      // Helper to compute timestamps
      const parseTimestamp = (val?: string): { ts: number; dateStr: string; timeStr: string } => {
        if (!val) return { ts: 0, dateStr: "Unknown Date", timeStr: "" };
        const d = new Date(val);
        if (Number.isNaN(d.getTime())) return { ts: 0, dateStr: val, timeStr: "" };
        return {
          ts: d.getTime(),
          dateStr: d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }),
          timeStr: d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }),
        };
      };

      // 1. Patient Encounters
      for (const e of ((encRes as any).results || [])) {
        const rawTime = e.encounter_date ? `${e.encounter_date} ${e.encounter_time || "00:00"}` : e.creation;
        const { ts, dateStr } = parseTimestamp(rawTime);
        const config = DOCTYPE_CONFIG.PatientEncounter;
        timeline.push({
          id: `enc-${e.id}`,
          doctype: "PatientEncounter",
          reference_name: e.encounter_id || `ENC-${e.id}`,
          time: rawTime || "",
          timestamp: ts,
          dateStr,
          title: `Clinical Encounter (${e.encounter_type || e.type || "Consultation"})`,
          subtitle: `Dr. ${e.practitioner_name || "Physician"} · Status: ${e.status || "Completed"}`,
          user: e.practitioner_name || "Attending Physician",
          status: e.status || "Completed",
          icon: config.icon,
          accent: config.accent,
          badgeClass: config.badgeClass,
          details: {
            "Chief Complaint": e.symptoms || e.chief_complaint || "Routine follow-up",
            Diagnosis: e.diagnosis || "No primary diagnosis recorded",
            "Clinical Notes": e.clinical_notes || e.notes || "",
            Practitioner: e.practitioner_name || "Doctor",
            "Service Unit": e.service_unit_name || "Consultation Room",
          },
          raw: e,
        });
      }

      // 2. Appointments
      for (const a of ((apptRes as any).results || [])) {
        const rawTime = a.appointment_date ? `${a.appointment_date} ${a.appointment_time || "00:00"}` : a.creation;
        const { ts, dateStr } = parseTimestamp(rawTime);
        const config = DOCTYPE_CONFIG.PatientAppointment;
        timeline.push({
          id: `appt-${a.id}`,
          doctype: "PatientAppointment",
          reference_name: a.appointment_id || `APT-${a.id}`,
          time: rawTime || "",
          timestamp: ts,
          dateStr,
          title: `Appointment (${a.appointment_type || "Outpatient"})`,
          subtitle: `With Dr. ${a.practitioner_name || "Practitioner"} · ${a.department_name || "General OPD"}`,
          user: a.practitioner_name || "Practitioner",
          status: a.status || "Scheduled",
          icon: config.icon,
          accent: config.accent,
          badgeClass: config.badgeClass,
          details: {
            "Appointment Type": a.appointment_type || "Consultation",
            Department: a.department_name || "Outpatient",
            Status: a.status || "Scheduled",
            Notes: a.notes || "Standard clinical booking",
          },
          raw: a,
        });
      }

      // 3. Vital Signs
      for (const v of vsList) {
        const rawTime = v.signs_date ? `${v.signs_date} ${v.signs_time || "00:00"}` : v.creation;
        const { ts, dateStr } = parseTimestamp(rawTime);
        const config = DOCTYPE_CONFIG.VitalSigns;
        const bpStr = v.bp || (v.bp_systolic ? `${v.bp_systolic}/${v.bp_diastolic} mmHg` : "");
        const parts = [
          bpStr && `BP: ${bpStr}`,
          v.pulse && `Pulse: ${v.pulse} bpm`,
          v.temperature && `Temp: ${v.temperature}°C`,
          (v.spo2 || v.oxygen_saturation) && `SpO2: ${v.spo2 || v.oxygen_saturation}%`,
        ].filter(Boolean).join(" · ");

        timeline.push({
          id: `vs-${v.id}`,
          doctype: "VitalSigns",
          reference_name: v.vital_signs_id || `VS-${v.id}`,
          time: rawTime || "",
          timestamp: ts,
          dateStr,
          title: `Vital Signs Panel (${parts || "Observations recorded"})`,
          subtitle: `Recorded by ${v.practitioner_name || v.owner || "Nurse / Triage"}`,
          user: v.practitioner_name || v.owner || "Triage Staff",
          icon: config.icon,
          accent: config.accent,
          badgeClass: config.badgeClass,
          details: {
            "Blood Pressure": bpStr || "Not recorded",
            "Heart Rate / Pulse": v.pulse ? `${v.pulse} bpm` : "Not recorded",
            "Body Temperature": v.temperature ? `${v.temperature} °C` : "Not recorded",
            "Oxygen Saturation (SpO2)": (v.spo2 || v.oxygen_saturation) ? `${v.spo2 || v.oxygen_saturation}%` : "Not recorded",
            "Respiratory Rate": v.respiratory_rate ? `${v.respiratory_rate} breaths/min` : "Not recorded",
            BMI: v.bmi ? `${v.bmi} kg/m²` : "Not recorded",
            "Height / Weight": `${v.height || "?"} cm / ${v.weight || "?"} kg`,
            Notes: v.vital_signs_note || "",
          },
          raw: v,
        });
      }

      // 4. Drug Prescriptions
      for (const rx of ((rxRes as any).results || [])) {
        const rawTime = rx.prescribed_date || rx.creation || rx.posting_date;
        const { ts, dateStr } = parseTimestamp(rawTime);
        const config = DOCTYPE_CONFIG.DrugPrescription;
        const medName = rx.drug_name || rx.medication_name || rx.medication || "Prescribed Medication";
        timeline.push({
          id: `rx-${rx.id}`,
          doctype: "DrugPrescription",
          reference_name: rx.prescription_id || `RX-${rx.id}`,
          time: rawTime || "",
          timestamp: ts,
          dateStr,
          title: `Prescription: ${medName} ${rx.dosage ? `(${rx.dosage})` : ""}`,
          subtitle: `Prescribed by Dr. ${rx.practitioner_name || "Physician"} · Duration: ${rx.period || "Course"}`,
          user: rx.practitioner_name || "Doctor",
          status: rx.status || "Prescribed",
          icon: config.icon,
          accent: config.accent,
          badgeClass: config.badgeClass,
          details: {
            Medication: medName,
            Dosage: rx.dosage || "1 unit",
            Duration: rx.period || "As instructed",
            Instructions: rx.instructions || rx.comment || "Take as directed",
            Prescriber: rx.practitioner_name || "Doctor",
          },
          raw: rx,
        });
      }

      // 5. Medication Requests (Pharmacy Orders)
      for (const mr of ((medReqRes as any).results || [])) {
        const rawTime = mr.creation || mr.order_date;
        const { ts, dateStr } = parseTimestamp(rawTime);
        const config = DOCTYPE_CONFIG.MedicationRequest;
        timeline.push({
          id: `mr-${mr.id}`,
          doctype: "MedicationRequest",
          reference_name: mr.order_number || mr.request_id || `MO-${mr.id}`,
          time: rawTime || "",
          timestamp: ts,
          dateStr,
          title: `Pharmacy Medication Order: ${mr.medication_name}`,
          subtitle: `Quantity: ${mr.quantity || 1} · Status: ${mr.status || "Active"} · ${mr.practitioner_name || "Doctor"}`,
          user: mr.practitioner_name || "Physician",
          status: mr.status || "Active",
          icon: config.icon,
          accent: config.accent,
          badgeClass: config.badgeClass,
          details: {
            "Drug Ordered": mr.medication_name,
            Quantity: mr.quantity || 1,
            Dosage: mr.dosage || mr.dosage_instruction || "Standard",
            Status: mr.status || "Active",
            "Stock Voucher": mr.stock_entry_number || "Pending Dispensation",
          },
          raw: mr,
        });
      }

      // 6. Lab Tests
      for (const l of ((labRes as any).results || [])) {
        const rawTime = l.submitted_date || l.result_date || l.creation;
        const { ts, dateStr } = parseTimestamp(rawTime);
        const config = DOCTYPE_CONFIG.LabTest;
        const testName = l.lab_test_name || l.template_name || "Diagnostic Laboratory Test";
        timeline.push({
          id: `lab-${l.id}`,
          doctype: "LabTest",
          reference_name: l.lab_test_id || `LAB-${l.id}`,
          time: rawTime || "",
          timestamp: ts,
          dateStr,
          title: `Laboratory Investigation: ${testName}`,
          subtitle: `Status: ${l.status || "Completed"} · Ref: Dr. ${l.practitioner_name || "Pathologist"}`,
          user: l.practitioner_name || "Pathology Dept",
          status: l.status || "Draft",
          icon: config.icon,
          accent: config.accent,
          badgeClass: config.badgeClass,
          details: {
            "Test Name": testName,
            Status: l.status || "Draft",
            "Result Summary": l.summary || l.result_summary || "Sample collected and processed",
            "Ordered By": l.practitioner_name || "Physician",
          },
          raw: l,
        });
      }

      // 7. Inpatient Records
      for (const inpt of inptList) {
        const rawTime = inpt.admission_date || inpt.creation;
        const { ts, dateStr } = parseTimestamp(rawTime);
        const config = DOCTYPE_CONFIG.InpatientRecord;
        timeline.push({
          id: `inpt-${inpt.id}`,
          doctype: "InpatientRecord",
          reference_name: inpt.inpatient_record_id || `IP-${inpt.id}`,
          time: rawTime || "",
          timestamp: ts,
          dateStr,
          title: `Hospital Inpatient Admission (${inpt.status || "Admitted"})`,
          subtitle: `Ward: ${inpt.ward_name || "Ward Unit"} · Bed: ${inpt.bed_name || "Unassigned"}`,
          user: inpt.admitting_practitioner_name || "Admissions",
          status: inpt.status || "Admitted",
          icon: config.icon,
          accent: config.accent,
          badgeClass: config.badgeClass,
          details: {
            Status: inpt.status || "Admitted",
            "Ward & Bed": `${inpt.ward_name || "General"} · Bed ${inpt.bed_name || "-"}`,
            "Admission Reason": inpt.reason_for_admission || inpt.admission_reason || "Clinical observation",
            "Admission Date": inpt.admission_date || "Recorded",
            "Discharge Date": inpt.discharge_date || "Ongoing Admission",
          },
          raw: inpt,
        });
      }

      // 8. Therapy Plans
      for (const th of ((thRes as any).results || [])) {
        const rawTime = th.start_date || th.creation;
        const { ts, dateStr } = parseTimestamp(rawTime);
        const config = DOCTYPE_CONFIG.TherapyPlan;
        timeline.push({
          id: `th-${th.id}`,
          doctype: "TherapyPlan",
          reference_name: th.therapy_plan_id || `TP-${th.id}`,
          time: rawTime || "",
          timestamp: ts,
          dateStr,
          title: `Therapy Plan: ${th.therapy_type_name || "Rehabilitation Plan"}`,
          subtitle: `Status: ${th.status || "Active"} · Sessions: ${th.total_sessions_completed || 0}/${th.total_sessions || "Course"}`,
          user: th.practitioner_name || "Therapist",
          status: th.status || "Active",
          icon: config.icon,
          accent: config.accent,
          badgeClass: config.badgeClass,
          details: {
            "Therapy Program": th.therapy_type_name || "Physical Rehab",
            Status: th.status || "Active",
            "Sessions Completed": `${th.total_sessions_completed || 0} sessions`,
          },
          raw: th,
        });
      }

      // 9. Clinical Observations
      for (const obs of ((obsRes as any).results || [])) {
        const rawTime = obs.creation || obs.observation_date;
        const { ts, dateStr } = parseTimestamp(rawTime);
        const config = DOCTYPE_CONFIG.Observation;
        timeline.push({
          id: `obs-${obs.id}`,
          doctype: "Observation",
          reference_name: obs.observation_id || `OBS-${obs.id}`,
          time: rawTime || "",
          timestamp: ts,
          dateStr,
          title: `Clinical Observation (${obs.observation_type || "Assessment"})`,
          subtitle: `Recorded by ${obs.practitioner_name || obs.owner || "Staff"}`,
          user: obs.practitioner_name || "Clinician",
          icon: config.icon,
          accent: config.accent,
          badgeClass: config.badgeClass,
          details: {
            Type: obs.observation_type || "General",
            Findings: obs.findings || obs.comment || "Observations verified",
          },
          raw: obs,
        });
      }

      // 10. Service Requests
      for (const sr of ((srRes as any).results || [])) {
        const rawTime = sr.order_date || sr.creation;
        const { ts, dateStr } = parseTimestamp(rawTime);
        const config = DOCTYPE_CONFIG.ServiceRequest;
        timeline.push({
          id: `sr-${sr.id}`,
          doctype: "ServiceRequest",
          reference_name: sr.name || `SR-${sr.id}`,
          time: rawTime || "",
          timestamp: ts,
          dateStr,
          title: `Service Order: ${sr.title || sr.template_dn || sr.order_description || sr.template_dt || "Requisition"}`,
          subtitle: `${sr.priority === "STAT" ? "🚨 STAT · " : sr.priority === "Urgent" ? "⚡ Urgent · " : ""}${sr.status || "Draft"} · Dr. ${sr.practitioner_name || "Physician"}`,
          user: sr.practitioner_name || "Ordering Doctor",
          status: sr.status || "Draft",
          icon: config.icon,
          accent: sr.priority === "STAT" ? "bg-rose-600" : config.accent,
          badgeClass: config.badgeClass,
          details: {
            Service: sr.title || sr.template_dn || sr.template_dt || sr.order_description,
            Type: sr.template_dt || "Service Request",
            Priority: sr.priority || "Routine",
            Department: sr.department_name || "General",
            Status: sr.status || "Draft",
            ...(sr.sample_collection_required ? { "Sample Collection": "Required" } : {}),
          },
          raw: sr,
        });
      }

      // 11. Patient Medical Records (PMR / Audit Communications)
      for (const pmr of ((pmrRes as any).results || [])) {
        const rawTime = pmr.communication_date || pmr.creation;
        const { ts, dateStr } = parseTimestamp(rawTime);
        const config = DOCTYPE_CONFIG.PatientMedicalRecord;
        timeline.push({
          id: `pmr-${pmr.id}`,
          doctype: "PatientMedicalRecord",
          reference_name: pmr.reference_name || `PMR-${pmr.id}`,
          time: rawTime || "",
          timestamp: ts,
          dateStr,
          title: pmr.subject || "Clinical Audit Communication",
          subtitle: `Note by ${pmr.user_name || pmr.user || "System"}`,
          user: pmr.user_name || pmr.user || "System",
          icon: config.icon,
          accent: config.accent,
          badgeClass: config.badgeClass,
          details: {
            Content: pmr.content || pmr.subject || "Recorded entry",
          },
          raw: pmr,
        });
      }

      // Sort chronological descending (latest events first)
      timeline.sort((a, b) => b.timestamp - a.timestamp);
      setEvents(timeline);
    } catch (err) {
      console.error("Failed to load patient history:", err);
      toast.error("Failed to aggregate patient longitudinal record.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (patientId) loadPatientData(patientId);
  }, [patientId, loadPatientData]);

  // ── Date Presets Handler ──────────────────────────────────────────────
  const handleDatePreset = (preset: "all" | "30d" | "6m" | "1y") => {
    setDatePreset(preset);
    const now = new Date();
    if (preset === "all") {
      setDateFrom("");
      setDateTo("");
      return;
    }
    const past = new Date();
    if (preset === "30d") past.setDate(now.getDate() - 30);
    else if (preset === "6m") past.setMonth(now.getMonth() - 6);
    else if (preset === "1y") past.setFullYear(now.getFullYear() - 1);
    setDateFrom(past.toISOString().slice(0, 10));
    setDateTo(now.toISOString().slice(0, 10));
  };

  // ── Filtered Timeline Feed ────────────────────────────────────────────
  const filteredEvents = useMemo(() => {
    let list = events;

    // Filter by Doctype
    if (docTypeFilter !== "All") {
      list = list.filter((e) => e.doctype === docTypeFilter);
    }

    // Filter by Date Range
    if (dateFrom) {
      const fromTs = new Date(dateFrom).getTime();
      list = list.filter((e) => e.timestamp >= fromTs || e.dateStr >= dateFrom);
    }
    if (dateTo) {
      const toTs = new Date(`${dateTo}T23:59:59`).getTime();
      list = list.filter((e) => e.timestamp <= toTs || e.dateStr <= dateTo);
    }

    // Filter by Text Query
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((e) => {
        const titleMatch = e.title.toLowerCase().includes(q);
        const subMatch = (e.subtitle || "").toLowerCase().includes(q);
        const refMatch = e.reference_name.toLowerCase().includes(q);
        const userMatch = e.user.toLowerCase().includes(q);
        const detailsMatch = e.details
          ? Object.values(e.details).some((v) => String(v).toLowerCase().includes(q))
          : false;
        return titleMatch || subMatch || refMatch || userMatch || detailsMatch;
      });
    }

    return list;
  }, [events, docTypeFilter, dateFrom, dateTo, query]);

  // ── Event Counts by Category ──────────────────────────────────────────
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { All: events.length };
    for (const e of events) {
      counts[e.doctype] = (counts[e.doctype] || 0) + 1;
    }
    return counts;
  }, [events]);

  // ── Vital Signs Analytics & Chart Data ────────────────────────────────
  const sortedVitals = useMemo(() => {
    return [...vitals].sort((a, b) => {
      const tA = new Date(a.signs_date || a.creation).getTime();
      const tB = new Date(b.signs_date || b.creation).getTime();
      return tA - tB;
    });
  }, [vitals]);

  const latestVital = useMemo(() => {
    if (sortedVitals.length === 0) return null;
    return sortedVitals[sortedVitals.length - 1];
  }, [sortedVitals]);

  const chartSeries = useMemo(() => {
    if (activeChart === "bp") {
      return [
        {
          name: "BP Systolic (mmHg)",
          data: sortedVitals.map((v) => Number(v.bp_systolic) || 0),
        },
        {
          name: "BP Diastolic (mmHg)",
          data: sortedVitals.map((v) => Number(v.bp_diastolic) || 0),
        },
      ];
    }
    if (activeChart === "pulse") {
      return [
        {
          name: "Heart Rate / Pulse (bpm)",
          data: sortedVitals.map((v) => Number(v.pulse) || 0),
        },
        {
          name: "Respiratory Rate (breaths/min)",
          data: sortedVitals.map((v) => Number(v.respiratory_rate) || 0),
        },
      ];
    }
    if (activeChart === "temperature") {
      return [
        {
          name: "Body Temperature (°C)",
          data: sortedVitals.map((v) => Number(v.temperature) || 0),
        },
      ];
    }
    if (activeChart === "spo2") {
      return [
        {
          name: "Oxygen Saturation SpO2 (%)",
          data: sortedVitals.map((v) => Number(v.spo2 || v.oxygen_saturation) || 0),
        },
      ];
    }
    // BMI
    return [
      {
        name: "BMI (kg/m²)",
        data: sortedVitals.map((v) => Number(v.bmi) || 0),
      },
      {
        name: "Weight (kg)",
        data: sortedVitals.map((v) => Number(v.weight) || 0),
      },
    ];
  }, [sortedVitals, activeChart]);

  const chartCategories = useMemo(() => {
    return sortedVitals.map((v) => {
      const d = (v.signs_date || v.creation || "").slice(5, 10);
      const t = v.signs_time ? String(v.signs_time).slice(0, 5) : "";
      return `${d} ${t}`.trim();
    });
  }, [sortedVitals]);

  const vitalChartOptions = useChart({
    chart: {
      type: "area",
      toolbar: { show: false },
      zoom: { enabled: false },
    },
    stroke: { curve: "smooth", width: 2.5 },
    colors:
      activeChart === "bp"
        ? ["#ef4444", "#3b82f6"]
        : activeChart === "pulse"
        ? ["#ec4899", "#8b5cf6"]
        : activeChart === "temperature"
        ? ["#f59e0b"]
        : activeChart === "spo2"
        ? ["#06b6d4"]
        : ["#10b981", "#6366f1"],
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
      categories: chartCategories,
      labels: { style: { colors: "#9ca3af", fontSize: "11px" }, rotate: -25 },
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
    tooltip: { theme: "dark" },
  });

  // Current Inpatient Active Record
  const activeInpatientRecord = useMemo(() => {
    return inpatients.find((r) =>
      ["Admission Scheduled", "Admitted", "Discharge Scheduled"].includes(r.status)
    );
  }, [inpatients]);

  // Navigate to specific document route
  const handleNavigateDetail = (doctype: string, docname: string, raw?: any) => {
    const rawId = raw?.id ? String(raw.id) : docname.replace(/[^\d]/g, "");
    if (!rawId) return;

    const routes: Record<string, string> = {
      PatientEncounter: `/healthcare/encounters/${rawId}`,
      PatientAppointment: `/healthcare/appointments/${rawId}`,
      VitalSigns: `/healthcare/vital-signs/${rawId}`,
      LabTest: `/healthcare/lab-tests/${rawId}`,
      InpatientRecord: `/healthcare/inpatient`,
      DrugPrescription: `/healthcare/pharmacy/medication-requests?patient=${patientId}`,
      MedicationRequest: `/healthcare/pharmacy/medication-requests?patient=${patientId}`,
      ServiceRequest: `/healthcare/service-requests`,
    };

    if (routes[doctype]) {
      navigate(routes[doctype]);
    } else {
      toast.info(`Opened ${doctype}: ${docname}`);
    }
  };

  const filteredPatients = useMemo(() => {
    if (!patientSearch.trim()) return patients.slice(0, 10);
    const q = patientSearch.toLowerCase();
    return patients
      .filter((p) => {
        const name = (p.patient_name || `${p.first_name} ${p.last_name}`).toLowerCase();
        const id = (p.patient_id || String(p.id)).toLowerCase();
        const phone = (p.mobile || p.phone || "").toLowerCase();
        return name.includes(q) || id.includes(q) || phone.includes(q);
      })
      .slice(0, 15);
  }, [patients, patientSearch]);

  const copyText = (val: string, label: string) => {
    navigator.clipboard.writeText(val);
    toast.info(`Copied ${label}: ${val}`);
  };

  return (
    <div className="space-y-6 max-w-[1700px] mx-auto pb-20">
      {/* ── Top Header & Patient Fast Switcher Bar ──────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent p-5 backdrop-blur-md shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="font-medium">Healthcare</span>
              <span>/</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">Patient EHR</span>
              <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                Marley Parity
              </Badge>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/20">
                <Icon icon="solar:history-bold-duotone" size={24} />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                  Patient Longitudinal Medical History
                </h1>
                <p className="text-xs text-muted-foreground">
                  Complete chronological electronic health record across consultations, vital signs, prescriptions, lab results, and inpatient stays.
                </p>
              </div>
            </div>
          </div>

          {/* Patient Search & Switcher Widget */}
          <div className="flex items-center gap-2.5 shrink-0 self-start lg:self-center">
            <div className="relative w-72 sm:w-80">
              <Icon
                icon="solar:magnifer-linear"
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
              />
              <Input
                placeholder="Search patient by name, MRN, phone..."
                value={patientSearch}
                onChange={(e) => {
                  setPatientSearch(e.target.value);
                  setShowPatientDropdown(true);
                }}
                onFocus={() => setShowPatientDropdown(true)}
                className="pl-9 pr-8 text-xs h-10 rounded-xl bg-background/90 shadow-2xs border-border/80"
              />
              {patientSearch && (
                <button
                  type="button"
                  onClick={clearPatient}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <Icon icon="solar:close-circle-bold" size={15} />
                </button>
              )}

              {/* Patient Autocomplete Dropdown */}
              {showPatientDropdown && (
                <div className="absolute z-50 left-0 right-0 mt-1.5 bg-popover border border-border/80 rounded-xl shadow-xl max-h-72 overflow-y-auto p-1 text-xs backdrop-blur-md">
                  {filteredPatients.map((p) => {
                    const fullName = p.patient_name || `${p.first_name || ""} ${p.last_name || ""}`;
                    const ageStr = formatAge(p.dob, p.age);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => selectPatient(p)}
                        className="w-full p-2.5 hover:bg-muted/80 rounded-lg text-left flex items-center gap-3 transition-colors"
                      >
                        <Avatar name={fullName} src={p.image} size="sm" />
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-foreground text-xs truncate">{fullName}</p>
                          <p className="text-[10px] text-muted-foreground truncate">
                            {p.patient_id || `ID: #${p.id}`} · {p.sex || p.gender || "—"} · {ageStr || "Age N/A"}
                          </p>
                        </div>
                        {p.blood_group && (
                          <Badge variant="outline" className="text-[10px] shrink-0 font-mono">
                            {p.blood_group}
                          </Badge>
                        )}
                      </button>
                    );
                  })}
                  {filteredPatients.length === 0 && (
                    <div className="py-4 text-center text-muted-foreground text-xs">
                      No patients found matching "{patientSearch}"
                    </div>
                  )}
                </div>
              )}
            </div>

            {patientId && (
              <Button
                variant="outline"
                size="sm"
                className="h-10 text-xs gap-1.5 rounded-xl border-border/80 bg-background/80"
                onClick={() => window.print()}
                title="Print Longitudinal Medical Summary"
              >
                <Icon icon="solar:printer-bold" size={15} className="text-blue-500" />
                <span className="hidden sm:inline">Print Record</span>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* ── Main EHR Interface ────────────────────────────────────────── */}
      {!patientId ? (
        <Card className="border-border/70 shadow-xs">
          <CardContent className="py-24 text-center space-y-4">
            <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-inner">
              <Icon icon="solar:user-id-bold-duotone" size={36} />
            </div>
            <div className="space-y-1 max-w-md mx-auto">
              <h3 className="text-lg font-bold text-foreground">Select Patient to Access Medical Record</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Search above to load the complete longitudinal clinical history, vital trends, medication orders, laboratory reports, and inpatient charts.
              </p>
            </div>
            <div className="pt-2 flex flex-wrap items-center justify-center gap-2 max-w-lg mx-auto">
              <span className="text-[11px] text-muted-foreground mr-1">Quick Select:</span>
              {patients.slice(0, 5).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => selectPatient(p)}
                  className="px-2.5 py-1 rounded-lg bg-muted/60 hover:bg-muted text-xs font-semibold text-foreground transition-all border border-border/50"
                >
                  {p.patient_name || `${p.first_name} ${p.last_name}`}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* ── Left Sidebar (4 Cols): Marley Patient Profile Card ──────── */}
          <div className="lg:col-span-4 space-y-5">
            {/* Primary Patient Demographics Card */}
            <Card className="border-border/70 shadow-xs overflow-hidden">
              <div className="h-20 bg-gradient-to-r from-emerald-600/30 via-teal-600/20 to-blue-600/30 relative" />
              <CardContent className="pt-0 -mt-10 space-y-4">
                <div className="flex items-end justify-between">
                  <div className="relative">
                    <Avatar
                      name={patient?.patient_name || "Patient"}
                      src={patient?.image}
                      size="2xl"
                      className="border-4 border-background shadow-md"
                    />
                    <div className="absolute bottom-1 right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-background" />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs gap-1 rounded-lg border-border"
                    onClick={() => navigate(`/healthcare/patients/${patientId}`)}
                  >
                    <Icon icon="solar:user-bold" size={13} className="text-emerald-600" />
                    Full Profile
                  </Button>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-extrabold text-foreground">{patient?.patient_name}</h2>
                    {patient?.blood_group && (
                      <Badge className="bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20 text-xs font-mono font-bold gap-1">
                        <Icon icon="solar:drop-bold" size={12} />
                        {patient.blood_group}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground group">
                    <span className="font-mono text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                      {patient?.patient_id || `ID: #${patient?.id}`}
                    </span>
                    <button
                      type="button"
                      onClick={() => copyText(patient?.patient_id || String(patient?.id), "MRN")}
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Icon icon="solar:copy-bold" size={12} />
                    </button>
                    <span>·</span>
                    <span>{patient?.sex || patient?.gender || "Unspecified gender"}</span>
                  </div>
                </div>

                {/* Marley Age Calculation Display */}
                <div className="p-3 rounded-xl bg-muted/30 border border-border/50 text-xs space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                    Calculated Chronological Age
                  </span>
                  <span className="font-bold text-foreground text-sm font-mono block">
                    {formatAge(patient?.dob, patient?.age) || "Age not documented"}
                  </span>
                  {patient?.dob && (
                    <span className="text-[11px] text-muted-foreground block">
                      DOB: {new Date(patient.dob).toLocaleDateString()}
                    </span>
                  )}
                </div>

                {/* Active Inpatient Banner (Marley Parity) */}
                {activeInpatientRecord && (
                  <div className="p-3.5 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-900 dark:text-indigo-200 text-xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 font-bold text-indigo-700 dark:text-indigo-300">
                        <span className="h-2 w-2 rounded-full bg-indigo-600 animate-pulse" />
                        CURRENTLY ADMITTED
                      </span>
                      <Badge variant="outline" className="text-[10px] bg-indigo-50 dark:bg-indigo-950">
                        {activeInpatientRecord.status}
                      </Badge>
                    </div>
                    <p className="text-[11px]">
                      Ward: <span className="font-bold">{activeInpatientRecord.ward_name || "General"}</span> · Bed:{" "}
                      <span className="font-bold">{activeInpatientRecord.bed_name || "Assigned"}</span>
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      Admitted: {activeInpatientRecord.admission_date}
                    </p>
                  </div>
                )}

                {/* Patient Allergies Alert (Marley Safety) */}
                {patient?.allergies && (
                  <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-900 dark:text-rose-200 text-xs space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-rose-700 dark:text-rose-300">
                      <Icon icon="solar:danger-triangle-bold" size={16} />
                      CRITICAL ALLERGY ALERT
                    </div>
                    <p className="text-[11px] leading-relaxed font-semibold">
                      {String(patient.allergies).replace(/\n/g, ", ")}
                    </p>
                  </div>
                )}

                {/* Clinical History Rows */}
                <div className="space-y-2 pt-1 border-t border-border/60 text-xs">
                  {patient?.mobile && (
                    <div className="flex justify-between py-1 border-b border-border/30">
                      <span className="text-muted-foreground">Phone / Mobile:</span>
                      <span className="font-medium text-foreground">{patient.mobile}</span>
                    </div>
                  )}
                  {patient?.occupation && (
                    <div className="flex justify-between py-1 border-b border-border/30">
                      <span className="text-muted-foreground">Occupation:</span>
                      <span className="font-medium text-foreground">{patient.occupation}</span>
                    </div>
                  )}
                  {patient?.medical_history && (
                    <div className="py-1">
                      <span className="text-muted-foreground block text-[10px] uppercase font-bold tracking-wider mb-0.5">
                        Medical History:
                      </span>
                      <p className="text-foreground text-[11px] leading-relaxed">
                        {String(patient.medical_history).replace(/\n/g, ", ")}
                      </p>
                    </div>
                  )}
                  {patient?.surgical_history && (
                    <div className="py-1">
                      <span className="text-muted-foreground block text-[10px] uppercase font-bold tracking-wider mb-0.5">
                        Surgical History:
                      </span>
                      <p className="text-foreground text-[11px] leading-relaxed">
                        {String(patient.surgical_history).replace(/\n/g, ", ")}
                      </p>
                    </div>
                  )}
                </div>

                {/* Quick Clinical Launcher Shortcuts */}
                <div className="pt-2 border-t border-border/60 space-y-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                    Clinical Action Launcher
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs justify-start gap-1.5 border-emerald-500/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                      onClick={() => navigate(`/healthcare/encounters/new?patient=${patientId}`)}
                    >
                      <Icon icon="solar:clipboard-text-bold" size={13} />
                      New Encounter
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs justify-start gap-1.5 border-rose-500/30 text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                      onClick={() => navigate(`/healthcare/vital-signs?patient=${patientId}`)}
                    >
                      <Icon icon="solar:heart-pulse-bold" size={13} />
                      Log Vitals
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs justify-start gap-1.5 border-purple-500/30 text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950/40"
                      onClick={() => navigate(`/healthcare/pharmacy/medication-requests?patient=${patientId}`)}
                    >
                      <Icon icon="solar:pill-bold" size={13} />
                      Prescribe Rx
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs justify-start gap-1.5 border-cyan-500/30 text-cyan-700 dark:text-cyan-300 hover:bg-cyan-50 dark:hover:bg-cyan-950/40"
                      onClick={() => navigate(`/healthcare/lab-tests/new?patient=${patientId}`)}
                    >
                      <Icon icon="solar:flask-bold" size={13} />
                      Order Lab
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Lifetime Interactions Metric Box */}
            <Card className="border-border/70 shadow-xs">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground">Longitudinal Health Activity</span>
                  <Badge variant="outline" className="text-[10px] text-emerald-600">
                    {events.length} records
                  </Badge>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2 rounded-lg bg-muted/40 border border-border/40">
                    <span className="text-[10px] text-muted-foreground block">Encounters</span>
                    <span className="font-extrabold text-sm text-foreground">
                      {categoryCounts["PatientEncounter"] || 0}
                    </span>
                  </div>
                  <div className="p-2 rounded-lg bg-muted/40 border border-border/40">
                    <span className="text-[10px] text-muted-foreground block">Vitals Logs</span>
                    <span className="font-extrabold text-sm text-rose-600">
                      {categoryCounts["VitalSigns"] || 0}
                    </span>
                  </div>
                  <div className="p-2 rounded-lg bg-muted/40 border border-border/40">
                    <span className="text-[10px] text-muted-foreground block">Rx Orders</span>
                    <span className="font-extrabold text-sm text-purple-600">
                      {(categoryCounts["DrugPrescription"] || 0) + (categoryCounts["MedicationRequest"] || 0)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ── Right Content Area (8 Cols): Vitals Trends & Clinical Feed ─── */}
          <div className="lg:col-span-8 space-y-6">
            {/* ── Vital Signs Clinical Analytics Card ──────────────────────── */}
            {sortedVitals.length > 0 && (
              <Card className="border-border/70 shadow-xs">
                <CardHeader className="pb-3 border-b border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-base font-bold flex items-center gap-2">
                      <Icon icon="solar:heart-pulse-bold" size={20} className="text-rose-500" />
                      Vital Signs Trend & Longitudinal Monitoring
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">
                      Continuous physiological tracking across visits and triage encounters
                    </p>
                  </div>

                  {/* Vitals Metric Tab Switcher */}
                  <div className="flex items-center gap-1 bg-muted/70 p-1 rounded-xl border border-border/50 text-xs overflow-x-auto scrollbar-none">
                    {(
                      [
                        { key: "bp", label: "Blood Pressure" },
                        { key: "pulse", label: "Pulse / RR" },
                        { key: "temperature", label: "Temp" },
                        { key: "spo2", label: "SpO2" },
                        { key: "bmi", label: "BMI / Wt" },
                      ] as const
                    ).map((m) => (
                      <button
                        key={m.key}
                        type="button"
                        onClick={() => setActiveChart(m.key)}
                        className={`px-2.5 py-1 rounded-lg font-semibold transition-all whitespace-nowrap ${
                          activeChart === m.key
                            ? "bg-background text-foreground shadow-2xs font-bold"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </CardHeader>

                <CardContent className="pt-4 space-y-4">
                  {/* Latest Vital Scorecards */}
                  {latestVital && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      <div className="p-2.5 rounded-xl border bg-muted/20">
                        <span className="text-[10px] text-muted-foreground block">Latest Blood Pressure</span>
                        <span className="text-sm font-extrabold font-mono text-foreground">
                          {latestVital.bp || `${latestVital.bp_systolic || "--"}/${latestVital.bp_diastolic || "--"} mmHg`}
                        </span>
                      </div>
                      <div className="p-2.5 rounded-xl border bg-muted/20">
                        <span className="text-[10px] text-muted-foreground block">Latest Pulse Rate</span>
                        <span className="text-sm font-extrabold font-mono text-rose-600">
                          {latestVital.pulse ? `${latestVital.pulse} bpm` : "--"}
                        </span>
                      </div>
                      <div className="p-2.5 rounded-xl border bg-muted/20">
                        <span className="text-[10px] text-muted-foreground block">Latest Temperature</span>
                        <span className="text-sm font-extrabold font-mono text-amber-600">
                          {latestVital.temperature ? `${latestVital.temperature} °C` : "--"}
                        </span>
                      </div>
                      <div className="p-2.5 rounded-xl border bg-muted/20">
                        <span className="text-[10px] text-muted-foreground block">Latest SpO2</span>
                        <span className="text-sm font-extrabold font-mono text-cyan-600">
                          {(latestVital.spo2 || latestVital.oxygen_saturation) ? `${latestVital.spo2 || latestVital.oxygen_saturation}%` : "--"}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Chart Rendering */}
                  <Chart
                    type="area"
                    height={220}
                    options={vitalChartOptions}
                    series={chartSeries}
                  />
                </CardContent>
              </Card>
            )}

            {/* ── Longitudinal Medical Record Feed ─────────────────────────── */}
            <Card className="border-border/70 shadow-xs">
              <CardHeader className="pb-3 border-b border-border/60 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-base font-bold flex items-center gap-2">
                      <Icon icon="solar:document-text-bold-duotone" size={20} className="text-emerald-600" />
                      Patient Longitudinal Health Record
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">
                      Chronological clinical narrative across all hospital interactions
                    </p>
                  </div>

                  {/* Date Range Presets */}
                  <div className="flex items-center gap-1 bg-muted/70 p-0.5 rounded-lg border border-border/50 text-xs">
                    {(
                      [
                        { key: "all", label: "All Time" },
                        { key: "30d", label: "30 Days" },
                        { key: "6m", label: "6 Months" },
                        { key: "1y", label: "1 Year" },
                      ] as const
                    ).map((p) => (
                      <button
                        key={p.key}
                        type="button"
                        onClick={() => handleDatePreset(p.key)}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                          datePreset === p.key
                            ? "bg-background text-foreground shadow-2xs font-bold"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Search & Custom Date Filter Row */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
                  <div className="relative w-full sm:w-80">
                    <Input
                      placeholder="Search clinical notes, diagnoses, medications..."
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      className="h-9 text-xs pr-8 rounded-lg"
                    />
                    {query ? (
                      <button
                        type="button"
                        onClick={() => setQuery("")}
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

                  <div className="flex items-center gap-2 w-full sm:w-auto text-xs">
                    <span className="text-muted-foreground text-[11px]">From:</span>
                    <Input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      className="h-8 w-32 text-xs rounded-lg"
                    />
                    <span className="text-muted-foreground text-[11px]">To:</span>
                    <Input
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      className="h-8 w-32 text-xs rounded-lg"
                    />
                    {(dateFrom || dateTo || docTypeFilter !== "All" || query) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setDateFrom("");
                          setDateTo("");
                          setDatePreset("all");
                          setDocTypeFilter("All");
                          setQuery("");
                        }}
                        className="h-8 text-xs text-muted-foreground hover:text-foreground"
                      >
                        Reset
                      </Button>
                    )}
                  </div>
                </div>

                {/* DocType Category Pills Bar */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none pt-1">
                  <button
                    type="button"
                    onClick={() => setDocTypeFilter("All")}
                    className={`px-3 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                      docTypeFilter === "All"
                        ? "bg-foreground text-background shadow-xs font-bold"
                        : "bg-muted/70 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <span>All Events</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-background/20">
                      {categoryCounts["All"] || 0}
                    </span>
                  </button>

                  {Object.entries(DOCTYPE_CONFIG).map(([dt, cfg]) => {
                    const count = categoryCounts[dt] || 0;
                    if (count === 0 && docTypeFilter !== dt) return null;
                    return (
                      <button
                        key={dt}
                        type="button"
                        onClick={() => setDocTypeFilter(dt)}
                        className={`px-3 py-1 rounded-xl text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5 ${
                          docTypeFilter === dt
                            ? "bg-emerald-600 text-white shadow-xs font-bold"
                            : "bg-muted/70 text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <Icon icon={cfg.icon} size={14} />
                        <span>{cfg.label}</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-muted-foreground/15 font-bold">
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </CardHeader>

              {/* Feed Content */}
              <CardContent className="pt-6">
                {loading ? (
                  <div className="py-20 text-center space-y-2">
                    <div className="w-8 h-8 rounded-full border-2 border-emerald-600 border-t-transparent animate-spin mx-auto" />
                    <p className="text-xs text-muted-foreground">Aggregating longitudinal health records...</p>
                  </div>
                ) : filteredEvents.length === 0 ? (
                  <div className="py-20 text-center space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-muted/60 text-muted-foreground/60 flex items-center justify-center mx-auto">
                      <Icon icon="solar:document-text-bold-duotone" size={28} />
                    </div>
                    <p className="text-sm font-bold text-foreground">No Medical Records Found</p>
                    <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                      No clinical transactions match the current filter criteria. Try clearing search filters or changing the date range.
                    </p>
                  </div>
                ) : (
                  <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-border/80">
                    {filteredEvents.map((item) => {
                      const isExpanded = !!expandedItems[item.id];
                      return (
                        <div key={item.id} className="relative group">
                          {/* Timeline Dot Icon */}
                          <div
                            className={`absolute -left-6 top-1 w-5 h-5 rounded-full ${item.accent} text-white flex items-center justify-center shadow-xs ring-4 ring-background z-10 transition-transform group-hover:scale-110`}
                          >
                            <Icon icon={item.icon} size={12} />
                          </div>

                          {/* Record Card */}
                          <div className="rounded-xl border border-border/70 bg-card p-4 hover:border-emerald-500/40 hover:shadow-2xs transition-all space-y-2">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge variant="outline" className={`text-[10px] font-bold ${item.badgeClass}`}>
                                  {DOCTYPE_CONFIG[item.doctype]?.label || item.doctype}
                                </Badge>
                                <button
                                  type="button"
                                  onClick={() => handleNavigateDetail(item.doctype, item.reference_name, item.raw)}
                                  className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
                                >
                                  {item.reference_name}
                                  <Icon icon="solar:arrow-right-up-bold" size={11} />
                                </button>
                                {item.status && (
                                  <span className="text-[10px] text-muted-foreground font-semibold px-2 py-0.2 rounded-full bg-muted/60">
                                    {item.status}
                                  </span>
                                )}
                              </div>

                              <span className="text-xs text-muted-foreground font-medium shrink-0">
                                {item.dateStr} {item.time && `· ${item.time.slice(11, 16)}`}
                              </span>
                            </div>

                            <div>
                              <h4 className="font-bold text-sm text-foreground">{item.title}</h4>
                              {item.subtitle && (
                                <p className="text-xs text-muted-foreground mt-0.5">{item.subtitle}</p>
                              )}
                            </div>

                            {/* Details Grid / Expandable Payload */}
                            {item.details && Object.keys(item.details).length > 0 && (
                              <div className="pt-1">
                                <div className="flex items-center justify-between pb-1">
                                  <button
                                    type="button"
                                    onClick={() => toggleExpand(item.id)}
                                    className="text-[11px] font-semibold text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                                  >
                                    <Icon
                                      icon={isExpanded ? "solar:alt-arrow-up-linear" : "solar:alt-arrow-down-linear"}
                                      size={12}
                                    />
                                    {isExpanded ? "Hide Details" : "Show Clinical Details"}
                                  </button>
                                </div>
                                {isExpanded && (
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs bg-muted/20 p-3 rounded-lg border border-border/40 animate-in fade-in duration-150">
                                    {Object.entries(item.details).map(([key, val]) => {
                                      if (!val) return null;
                                      return (
                                        <div key={key} className="space-y-0.5">
                                          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                                            {key}
                                          </span>
                                          <span className="text-foreground font-medium text-xs break-words">
                                            {String(val)}
                                          </span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Bottom Footbar */}
                            <div className="flex items-center justify-between pt-1 text-[11px] text-muted-foreground">
                              <span className="flex items-center gap-1.5">
                                <Icon icon="solar:user-bold" size={12} className="text-muted-foreground/70" />
                                {item.user}
                              </span>

                              <button
                                type="button"
                                onClick={() => handleNavigateDetail(item.doctype, item.reference_name, item.raw)}
                                className="text-emerald-600 hover:text-emerald-700 dark:hover:text-emerald-400 font-semibold hover:underline flex items-center gap-1"
                              >
                                View Document
                                <Icon icon="solar:arrow-right-linear" size={13} />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}