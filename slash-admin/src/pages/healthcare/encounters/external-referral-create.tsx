import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Icon } from "@/components/icon";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { Textarea } from "@/ui/textarea";
import { Card, CardContent } from "@/ui/card";
import { toast } from "sonner";
import {
  HealthcareApi,
  type ExternalReferral,
  type Patient,
  type HealthcarePractitioner,
} from "@/api/services/healthcareService";
import { formatAge } from "@/utils/age";
import eeuLogo from "@/assets/images/eeu-logo.png";

const POPULAR_REFERRAL_HOSPITALS = [
  "Tikur Anbessa Specialized Hospital (Black Lion)",
  "St. Paul's Hospital Millennium Medical College",
  "Myungsung Christian Medical Center (Korean Hospital)",
  "ALERT Specialized Hospital",
  "Yekatit 12 Hospital Medical College",
  "Zewditu Memorial Hospital",
  "Armed Forces Comprehensive Specialized Hospital",
  "Landmark General Hospital",
];

export default function ExternalReferralCreatePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const patientParam = searchParams.get("patient");
  const encounterParam = searchParams.get("encounter");
  const practitionerParam = searchParams.get("practitioner");

  const [activeView, setActiveView] = useState<"form" | "preview">("form");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [referralId, setReferralId] = useState<string>("");
  const [savedId, setSavedId] = useState<number | null>(null);

  // Masters & Context
  const [patients, setPatients] = useState<Patient[]>([]);
  const [practitioners, setPractitioners] = useState<HealthcarePractitioner[]>([]);

  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(
    patientParam ? Number(patientParam) : null
  );
  const [selectedPractitionerId, setSelectedPractitionerId] = useState<number | null>(
    practitionerParam ? Number(practitionerParam) : null
  );
  const [selectedEncounterId, setSelectedEncounterId] = useState<number | null>(
    encounterParam ? Number(encounterParam) : null
  );

  const [patientDetails, setPatientDetails] = useState<Patient | null>(null);
  const [practitionerDetails, setPractitionerDetails] = useState<HealthcarePractitioner | null>(null);
  const [companyName, setCompanyName] = useState("Ethiopian Electric Utility Medium Clinic");
  const [departmentName, setDepartmentName] = useState("General Outpatient");

  // Clinical data prefill containers
  const [defaultDiagnoses, setDefaultDiagnoses] = useState<string[]>([]);
  const [defaultSymptoms, setDefaultSymptoms] = useState<string[]>([]);
  const [defaultMedications, setDefaultMedications] = useState<string[]>([]);
  const [defaultLabResults, setDefaultLabResults] = useState<string[]>([]);

  // Form State
  const [form, setForm] = useState({
    referral_date: new Date().toISOString().split("T")[0],
    priority: "Routine" as "Routine" | "Urgent" | "Emergency",
    target_facility: "",
    receiving_specialist: "",
    clinical_indication: "",
    provisional_diagnosis: "",
    treatment_summary: "",
    relevant_test_results: "",
    referral_notes: "",
    status: "Active" as "Draft" | "Active" | "Dispatched" | "Completed" | "Cancelled",
  });

  // Load masters & initial encounter data
  const loadInitialData = useCallback(async () => {
    setLoading(true);
    try {
      const [patsRes, pracsRes, compsRes] = await Promise.all([
        HealthcareApi.patients.list({ page_size: 200 }).catch(() => ({ results: [] })),
        HealthcareApi.practitioners.list({ page_size: 200 }).catch(() => ({ results: [] })),
        HealthcareApi.companies.list({ page_size: 50 }).catch(() => ({ results: [] })),
      ]);

      const patsList = patsRes.results || [];
      const pracsList = pracsRes.results || [];
      const compsList = compsRes.results || [];

      setPatients(patsList);
      setPractitioners(pracsList);

      if (compsList.length > 0 && compsList[0].company_name) {
        setCompanyName(compsList[0].company_name);
      }

      // 1. Read live active encounter context from sessionStorage
      let sessionCtx: any = null;
      try {
        const raw = sessionStorage.getItem("active_encounter_context");
        if (raw) sessionCtx = JSON.parse(raw);
      } catch (e) {
        console.warn("Failed to parse active_encounter_context", e);
      }

      let diagnoses: string[] = [];
      let symptoms: string[] = [];
      let medications: string[] = [];
      let labs: string[] = [];
      let procedures: string[] = [];
      let comment = "";
      let appointmentType = "";

      if (sessionCtx) {
        if (sessionCtx.patientId && !patientParam) {
          setSelectedPatientId(sessionCtx.patientId);
        }
        if (sessionCtx.practitionerId && !practitionerParam) {
          setSelectedPractitionerId(sessionCtx.practitionerId);
        }
        if (sessionCtx.departmentName) {
          setDepartmentName(sessionCtx.departmentName);
        }
        if (sessionCtx.diagnoses?.length) diagnoses = [...sessionCtx.diagnoses];
        if (sessionCtx.symptoms?.length) symptoms = [...sessionCtx.symptoms];
        if (sessionCtx.medications?.length) medications = [...sessionCtx.medications];
        if (sessionCtx.labs?.length) labs = [...sessionCtx.labs];
        if (sessionCtx.procedures?.length) procedures = [...sessionCtx.procedures];
        if (sessionCtx.comment) comment = sessionCtx.comment;
        if (sessionCtx.appointmentType) appointmentType = sessionCtx.appointmentType;
      }

      // 2. If encounter ID is provided, query the encounter API and merge data
      if (encounterParam) {
        try {
          const encId = Number(encounterParam);
          setSelectedEncounterId(encId);
          const enc = (await HealthcareApi.encounters.get(encId)) as any;
          if (enc) {
            if (enc.patient && !patientParam) {
              setSelectedPatientId(enc.patient);
            }
            if (enc.practitioner && !practitionerParam) {
              setSelectedPractitionerId(enc.practitioner);
            }
            if (enc.department_name) {
              setDepartmentName(enc.department_name);
            }
            if (enc.company) {
              const comp = compsList.find((c: any) => c.id === enc.company);
              if (comp) setCompanyName(comp.company_name);
            }

            const encDiags = (enc.diagnoses_list || [])
              .map((d: any) => d.diagnosis || d.diagnosis_name)
              .filter(Boolean);
            const encSyms = (enc.symptoms_list_items || [])
              .map((s: any) => s.symptom || s.symptom_name)
              .filter(Boolean);
            const encMeds = (enc.drug_prescription_items || [])
              .map((d: any) => `${d.drug_name || d.medication || ""} ${d.dosage || ""} ${d.period || ""}`.trim())
              .filter(Boolean);
            const encLabs = (enc.lab_prescription_items || [])
              .map((l: any) => `${l.lab_test_name || l.lab_test_code || ""}${l.lab_test_comment || l.comments ? ` (${l.lab_test_comment || l.comments})` : ""}`.trim())
              .filter(Boolean);
            const encProcs = (enc.procedure_prescription_items || [])
              .map((p: any) => `${p.procedure_name || p.procedure || ""}${p.comments ? ` (${p.comments})` : ""}`.trim())
              .filter(Boolean);

            diagnoses = Array.from(new Set([...diagnoses, ...encDiags]));
            symptoms = Array.from(new Set([...symptoms, ...encSyms]));
            medications = Array.from(new Set([...medications, ...encMeds]));
            labs = Array.from(new Set([...labs, ...encLabs]));
            procedures = Array.from(new Set([...procedures, ...encProcs]));
            if (!comment && enc.encounter_comment) comment = enc.encounter_comment;
            if (!appointmentType && (enc.appointment_type_name || enc.appointment_type)) {
              appointmentType = enc.appointment_type_name || enc.appointment_type;
            }
          }
        } catch (encErr) {
          console.error("Failed to load encounter context", encErr);
        }
      }

      setDefaultDiagnoses(diagnoses);
      setDefaultSymptoms(symptoms);
      setDefaultMedications(medications);
      setDefaultLabResults(labs);

      // ── Formulate Clinical Indications & Answers for all 5 questions ──
      // 1. Clinical Indication & Reason for Referral
      let indicationText = "";
      if (symptoms.length > 0 && diagnoses.length > 0) {
        indicationText = `Patient presents with acute presentation of ${symptoms.join(", ")}. Primary clinical evaluation indicates ${diagnoses.join("; ")}.${comment ? ` Attending clinician note: ${comment}.` : ""} Requires advanced specialist evaluation, diagnostic workup, and continuing tertiary care.`;
      } else if (symptoms.length > 0) {
        indicationText = `Patient presents with: ${symptoms.join(", ")}.${comment ? ` Attending clinician note: ${comment}.` : ""} Requires specialized diagnostic evaluation and specialist consultation.`;
      } else if (diagnoses.length > 0) {
        indicationText = `Patient evaluated for: ${diagnoses.join("; ")}.${comment ? ` Attending clinician note: ${comment}.` : ""} Referred for tertiary consultation and continuing clinical management.`;
      } else {
        indicationText = `Patient evaluated at EEU Medium Clinic and referred for advanced diagnostic investigation and specialist management.${comment ? ` Attending clinician note: ${comment}` : ""}`;
      }

      // 2. Provisional Diagnosis / Working Clinical Assessment
      let provisionalDiagnosisText = "";
      if (diagnoses.length > 0) {
        provisionalDiagnosisText = diagnoses.join("; ");
      } else if (symptoms.length > 0) {
        provisionalDiagnosisText = `Acute symptomatic presentation: ${symptoms.join(", ")} (Definitive diagnosis pending diagnostic confirmation)`;
      } else {
        provisionalDiagnosisText = "Clinical assessment pending diagnostic confirmation.";
      }

      // 3. Current Treatment & Medications Administered
      let treatmentSummaryText = "";
      const treatmentBlocks: string[] = [];
      if (medications.length > 0) {
        treatmentBlocks.push(`Currently Prescribed Medications:\n${medications.map((m) => `• ${m}`).join("\n")}`);
      }
      if (procedures.length > 0) {
        treatmentBlocks.push(`Procedures Performed:\n${procedures.map((p) => `• ${p}`).join("\n")}`);
      }
      if (treatmentBlocks.length > 0) {
        treatmentSummaryText = treatmentBlocks.join("\n\n");
      } else {
        treatmentSummaryText = "Symptomatic outpatient supportive care initiated. No complex or parenteral medications administered prior to transfer.";
      }

      // 4. Relevant Test & Investigation Results
      let testResultsText = "";
      if (labs.length > 0) {
        testResultsText = `Recent Diagnostic & Laboratory Investigations:\n${labs.map((t) => `• ${t}`).join("\n")}\n\nBedside vitals and physical examination recorded on file.`;
      } else {
        testResultsText = "Bedside vital signs and physical assessment recorded on file. Full diagnostic laboratory profile and imaging recommended upon admission.";
      }

      // 5. Special Instructions, Precautions & Transport Notes
      const isUrgent =
        appointmentType?.toLowerCase().includes("urgent") ||
        appointmentType?.toLowerCase().includes("emergency");
      const priorityVal: "Routine" | "Urgent" | "Emergency" = appointmentType?.toLowerCase().includes("emergency")
        ? "Emergency"
        : appointmentType?.toLowerCase().includes("urgent")
        ? "Urgent"
        : "Routine";

      let transportNotes = isUrgent
        ? "URGENT TRANSPORT: Patient requires continuous vitals monitoring during transit. Provide supportive oxygen if SpO2 fluctuates."
        : "Patient ambulatory and clinically stable for standard transport.";
      if (comment) {
        transportNotes += `\nAttending Clinician Remark: ${comment}`;
      }
      transportNotes += "\nDocumentation: Patient transferred with official referral dossier and medical encounter summary.\nContact referring Ethiopian Electric Utility Medium Clinic if condition changes during transit (+251 11 515 7103).";

      setForm((prev) => ({
        ...prev,
        priority: prev.priority !== "Routine" ? prev.priority : priorityVal,
        clinical_indication: prev.clinical_indication || indicationText,
        provisional_diagnosis: prev.provisional_diagnosis || provisionalDiagnosisText,
        treatment_summary: prev.treatment_summary || treatmentSummaryText,
        relevant_test_results: prev.relevant_test_results || testResultsText,
        referral_notes: prev.referral_notes || transportNotes,
      }));
    } catch (err) {
      console.error("Failed to load referral masters", err);
    } finally {
      setLoading(false);
    }
  }, [encounterParam, patientParam, practitionerParam]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Sync patient details when selectedPatientId changes
  useEffect(() => {
    if (selectedPatientId) {
      const match = patients.find((p) => p.id === selectedPatientId);
      if (match) {
        setPatientDetails(match);
      } else {
        HealthcareApi.patients
          .get(selectedPatientId)
          .then((p) => setPatientDetails(p))
          .catch(console.error);
      }
    } else {
      setPatientDetails(null);
    }
  }, [selectedPatientId, patients]);

  // Sync practitioner details when selectedPractitionerId changes
  useEffect(() => {
    if (selectedPractitionerId) {
      const match = practitioners.find((p) => p.id === selectedPractitionerId);
      if (match) {
        setPractitionerDetails(match);
        if (match.department_name) {
          setDepartmentName(match.department_name);
        }
      } else {
        HealthcareApi.practitioners
          .get(selectedPractitionerId)
          .then((p) => {
            setPractitionerDetails(p);
            if (p.department_name) setDepartmentName(p.department_name);
          })
          .catch(console.error);
      }
    } else {
      setPractitionerDetails(null);
    }
  }, [selectedPractitionerId, practitioners]);

  const patientName = patientDetails?.patient_name || (selectedPatientId ? `Patient #${selectedPatientId}` : "Select Patient");
  const patientAge = patientDetails ? formatAge(patientDetails.dob, patientDetails.age) : "N/A";
  const patientSex = patientDetails?.gender || patientDetails?.sex || "N/A";
  const patientMobile = patientDetails?.mobile || "Recorded on file";
  const practitionerName = practitionerDetails?.practitioner_name || "Attending Physician";

  const handleSave = async (andPrint = false) => {
    if (!selectedPatientId) {
      toast.error("Please select a Patient before saving the referral.");
      return;
    }
    if (!form.target_facility.trim()) {
      toast.error("Please specify the target hospital or clinic name.");
      return;
    }
    setSaving(true);
    try {
      const payload: Partial<ExternalReferral> = {
        encounter: selectedEncounterId || null,
        patient: selectedPatientId,
        referring_practitioner: selectedPractitionerId || null,
        referral_date: form.referral_date,
        priority: form.priority,
        target_facility: form.target_facility,
        receiving_specialist: form.receiving_specialist,
        clinical_indication: form.clinical_indication,
        provisional_diagnosis: form.provisional_diagnosis,
        treatment_summary: form.treatment_summary,
        relevant_test_results: form.relevant_test_results,
        referral_notes: form.referral_notes,
        status: form.status,
      };

      const res = await HealthcareApi.externalReferrals.create(payload);
      if (res?.referral_id) {
        setReferralId(res.referral_id);
      }
      if (res?.id) {
        setSavedId(res.id);
      }

      toast.success(
        `External Referral Letter ${res?.referral_id || ""} successfully generated!`
      );

      if (andPrint) {
        setActiveView("preview");
        setTimeout(() => {
          window.print();
        }, 350);
      } else {
        setActiveView("preview");
      }
    } catch (err: any) {
      console.error("Failed to save external referral", err);
      toast.error(
        err?.response?.data?.detail ||
          err?.response?.data?.message ||
          "Failed to save external referral record."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    if (selectedEncounterId) {
      navigate(`/healthcare/encounters/${selectedEncounterId}`);
    } else {
      navigate("/healthcare/encounters");
    }
  };

  const handleOpenServerTemplate = () => {
    if (savedId) {
      window.open(`/api/healthcare/external-referrals/${savedId}/print-html/?format=html`, "_blank");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/50 pb-20">
      {/* ── Top Header & Breadcrumbs ── */}
      <div className="sticky top-0 z-20 bg-white border-b px-6 py-3 shadow-xs print:hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 max-w-6xl mx-auto">
          <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
            <button
              onClick={() => navigate("/healthcare")}
              className="hover:text-foreground flex items-center gap-1"
            >
              <Icon icon="solar:home-2-bold" size={16} />
              <span>Healthcare</span>
            </button>
            <span>/</span>
            <button
              onClick={() => navigate("/healthcare/encounters")}
              className="hover:text-foreground"
            >
              Patient Encounters
            </button>
            {selectedEncounterId && (
              <>
                <span>/</span>
                <button
                  onClick={() => navigate(`/healthcare/encounters/${selectedEncounterId}`)}
                  className="hover:text-foreground text-blue-600 font-medium"
                >
                  Encounter #{selectedEncounterId}
                </button>
              </>
            )}
            <span>/</span>
            <span className="text-foreground font-semibold flex items-center gap-1.5">
              <Icon icon="solar:share-circle-bold" size={17} className="text-blue-600" />
              External Referral Out
            </span>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-blue-100 text-blue-800 ml-1">
              A4 Letter
            </span>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            {/* View Switcher: Form vs A4 Preview */}
            <div className="flex rounded-lg bg-slate-100 p-0.5 text-xs font-medium">
              <button
                type="button"
                className={`px-3 py-1.5 rounded-md transition-colors ${
                  activeView === "form"
                    ? "bg-white text-slate-900 shadow-xs font-semibold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
                onClick={() => setActiveView("form")}
              >
                <Icon icon="solar:pen-new-square-bold" size={14} className="inline mr-1" />
                Edit Form
              </button>
              <button
                type="button"
                className={`px-3 py-1.5 rounded-md transition-colors ${
                  activeView === "preview"
                    ? "bg-white text-slate-900 shadow-xs font-semibold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
                onClick={() => setActiveView("preview")}
              >
                <Icon icon="solar:document-bold" size={14} className="inline mr-1" />
                A4 Print Preview
              </button>
            </div>

            <Button variant="outline" size="sm" onClick={handleBack} className="text-xs h-8">
              <Icon icon="solar:arrow-left-bold" size={13} className="mr-1" />
              Back
            </Button>

            {activeView === "form" ? (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleSave(false)}
                  disabled={saving || loading}
                  className="text-xs h-8"
                >
                  {saving ? "Saving..." : "Save Draft"}
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleSave(true)}
                  disabled={saving || loading}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-8 shadow-xs"
                >
                  <Icon icon="solar:printer-bold" size={14} className="mr-1.5" />
                  Save & Print A4
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                onClick={() => window.print()}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-8 shadow-xs"
              >
                <Icon icon="solar:printer-bold" size={14} className="mr-1.5" />
                Print A4 Document
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-6">
        {/* ══════════════════════════════════════════════════════════════ */}
        {/* VIEW 1: Interactive Data Entry Form                           */}
        {/* ══════════════════════════════════════════════════════════════ */}
        {activeView === "form" && (
          <div className="space-y-6 print:hidden">
            {/* Patient & Practitioner Banner Card */}
            <Card className="border-blue-100 bg-linear-to-r from-blue-50/60 via-slate-50/40 to-white shadow-xs">
              <CardContent className="p-5">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Patient Info */}
                  <div>
                    <span className="text-[11px] uppercase tracking-wider font-bold text-blue-700 block mb-1">
                      Patient Context
                    </span>
                    {selectedPatientId ? (
                      <div>
                        <div className="text-base font-bold text-slate-900">{patientName}</div>
                        <div className="text-xs text-slate-600 mt-0.5">
                          MRN: <strong>#{selectedPatientId}</strong> • Age: {patientAge} • Sex: {patientSex}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">Phone: {patientMobile}</div>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">Select Patient</Label>
                        <select
                          className="w-full h-9 rounded-md border border-input bg-white px-3 text-xs"
                          value={selectedPatientId || ""}
                          onChange={(e) => setSelectedPatientId(e.target.value ? Number(e.target.value) : null)}
                        >
                          <option value="">-- Choose Patient --</option>
                          {patients.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.patient_name} (#{p.id})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  {/* Referring Doctor Info */}
                  <div>
                    <span className="text-[11px] uppercase tracking-wider font-bold text-slate-500 block mb-1">
                      Referring Practitioner
                    </span>
                    {selectedPractitionerId ? (
                      <div>
                        <div className="text-base font-bold text-slate-900">Dr. {practitionerName}</div>
                        <div className="text-xs text-slate-600 mt-0.5">
                          Department: {departmentName || "General OPD"}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">Authorized Attending Staff</div>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">Select Attending Practitioner</Label>
                        <select
                          className="w-full h-9 rounded-md border border-input bg-white px-3 text-xs"
                          value={selectedPractitionerId || ""}
                          onChange={(e) =>
                            setSelectedPractitionerId(e.target.value ? Number(e.target.value) : null)
                          }
                        >
                          <option value="">-- Choose Practitioner --</option>
                          {practitioners.map((pr) => (
                            <option key={pr.id} value={pr.id}>
                              {pr.practitioner_name} ({pr.department_name || "General"})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  {/* Origin Center */}
                  <div>
                    <span className="text-[11px] uppercase tracking-wider font-bold text-slate-500 block mb-1">
                      Originating Facility
                    </span>
                    <div className="text-sm font-bold text-slate-900">{companyName}</div>
                    <div className="text-xs text-slate-600 mt-0.5">Clinical Services & Continuity of Care</div>
                    {selectedEncounterId && (
                      <div className="mt-1">
                        <span className="inline-block text-[10px] font-semibold bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                          Linked to Encounter #{selectedEncounterId}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Referral Destination Card */}
            <Card className="shadow-xs">
              <CardContent className="p-6 space-y-5">
                <div className="border-b pb-3">
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Icon icon="solar:hospital-bold" size={18} className="text-blue-600" />
                    Target Healthcare Facility & Urgency
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Specify the external destination hospital, specialist physician, and referral priority
                  </p>
                </div>

                {/* Popular Ethiopian Referral Hospitals Quick Chips */}
                <div>
                  <Label className="text-xs text-slate-600 font-semibold mb-1.5 block">
                    Quick Select Common Referral Hospitals:
                  </Label>
                  <div className="flex flex-wrap gap-1.5">
                    {POPULAR_REFERRAL_HOSPITALS.map((hosp) => (
                      <button
                        key={hosp}
                        type="button"
                        onClick={() => setForm((prev) => ({ ...prev, target_facility: hosp }))}
                        className={`text-xs px-2.5 py-1 rounded-md border transition-all ${
                          form.target_facility === hosp
                            ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                            : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200"
                        }`}
                      >
                        {hosp.split(" (")[0]}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2 space-y-1.5">
                    <Label htmlFor="target_facility" className="text-xs font-semibold text-slate-700">
                      Target Hospital / Clinic Name <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="target_facility"
                      placeholder="e.g. Tikur Anbessa Specialized Hospital, St. Paul's Hospital"
                      value={form.target_facility}
                      onChange={(e) => setForm({ ...form, target_facility: e.target.value })}
                      className="text-sm font-medium"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="priority" className="text-xs font-semibold text-slate-700">
                      Referral Urgency / Priority
                    </Label>
                    <select
                      id="priority"
                      className="w-full h-9 rounded-md border border-input bg-white px-3 text-sm shadow-xs focus:ring-1 focus:ring-ring outline-none"
                      value={form.priority}
                      onChange={(e) => setForm({ ...form, priority: e.target.value as any })}
                    >
                      <option value="Routine">Routine (Elective / Non-Urgent)</option>
                      <option value="Urgent">Urgent (Within 24-48 Hours)</option>
                      <option value="Emergency">Emergency (Immediate Life-Threatening)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2 space-y-1.5">
                    <Label htmlFor="receiving_specialist" className="text-xs font-semibold text-slate-700">
                      Receiving Specialist / Department
                    </Label>
                    <Input
                      id="receiving_specialist"
                      placeholder="e.g. Cardiology OPD, Neurology Triage, Oncology Consultation"
                      value={form.receiving_specialist}
                      onChange={(e) => setForm({ ...form, receiving_specialist: e.target.value })}
                      className="text-sm"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="referral_date" className="text-xs font-semibold text-slate-700">
                      Referral Issue Date
                    </Label>
                    <Input
                      id="referral_date"
                      type="date"
                      value={form.referral_date}
                      onChange={(e) => setForm({ ...form, referral_date: e.target.value })}
                      className="text-sm"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Clinical Information Card */}
            <Card className="shadow-xs">
              <CardContent className="p-6 space-y-5">
                <div className="border-b pb-3">
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Icon icon="solar:notes-bold-duotone" size={18} className="text-blue-600" />
                    Clinical Summary & Medical Justification
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Detailed medical reasons, working assessment, treatments administered, and investigations
                  </p>
                </div>

                {/* 1. Clinical Indication / Reason */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <Label htmlFor="clinical_indication" className="text-xs font-semibold text-slate-700">
                      1. Clinical Indication & Reason for Referral <span className="text-red-500">*</span>
                    </Label>
                    {defaultSymptoms.length > 0 && (
                      <span className="text-[11px] text-blue-600">
                        Pre-populated with encounter symptoms
                      </span>
                    )}
                  </div>
                  <Textarea
                    id="clinical_indication"
                    rows={3}
                    placeholder="State primary clinical indication, persistent symptoms, or necessity for specialized tertiary care..."
                    value={form.clinical_indication}
                    onChange={(e) => setForm({ ...form, clinical_indication: e.target.value })}
                    className="text-sm leading-relaxed"
                  />
                </div>

                {/* 2. Provisional Diagnosis */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <Label htmlFor="provisional_diagnosis" className="text-xs font-semibold text-slate-700">
                      2. Provisional Diagnosis / Working Clinical Assessment
                    </Label>
                    {defaultDiagnoses.length > 0 && (
                      <span className="text-[11px] text-blue-600">
                        Pre-populated with encounter diagnoses
                      </span>
                    )}
                  </div>
                  <Textarea
                    id="provisional_diagnosis"
                    rows={2}
                    placeholder="Provisional diagnosis or working clinical assessment..."
                    value={form.provisional_diagnosis}
                    onChange={(e) => setForm({ ...form, provisional_diagnosis: e.target.value })}
                    className="text-sm font-medium"
                  />
                </div>

                {/* 3. Treatment Summary */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <Label htmlFor="treatment_summary" className="text-xs font-semibold text-slate-700">
                      3. Current Treatment & Medications Administered
                    </Label>
                    {defaultMedications.length > 0 && (
                      <span className="text-[11px] text-blue-600">
                        Pre-populated with prescribed drugs
                      </span>
                    )}
                  </div>
                  <Textarea
                    id="treatment_summary"
                    rows={3}
                    placeholder="Medications administered, procedures done, fluids or supportive care provided..."
                    value={form.treatment_summary}
                    onChange={(e) => setForm({ ...form, treatment_summary: e.target.value })}
                    className="text-sm font-mono text-xs leading-relaxed"
                  />
                </div>

                {/* 4. Relevant Test Results */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <Label htmlFor="relevant_test_results" className="text-xs font-semibold text-slate-700">
                      4. Relevant Test & Investigation Results
                    </Label>
                    {defaultLabResults.length > 0 && (
                      <span className="text-[11px] text-blue-600">
                        Pre-populated with lab test orders
                      </span>
                    )}
                  </div>
                  <Textarea
                    id="relevant_test_results"
                    rows={3}
                    placeholder="Key lab test values, vitals, radiology, or ECG findings..."
                    value={form.relevant_test_results}
                    onChange={(e) => setForm({ ...form, relevant_test_results: e.target.value })}
                    className="text-sm font-mono text-xs leading-relaxed"
                  />
                </div>

                {/* 5. Special Notes & Transport Instructions */}
                <div className="space-y-1.5">
                  <Label htmlFor="referral_notes" className="text-xs font-semibold text-slate-700">
                    5. Special Instructions, Precautions & Transport Notes
                  </Label>
                  <Textarea
                    id="referral_notes"
                    rows={2}
                    placeholder="e.g. Oxygen support required during transport, patient requires stretcher, contact referring doctor if deteriorated..."
                    value={form.referral_notes}
                    onChange={(e) => setForm({ ...form, referral_notes: e.target.value })}
                    className="text-sm"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Bottom Actions */}
            <div className="flex justify-between items-center pt-2">
              <Button variant="outline" onClick={handleBack}>
                <Icon icon="solar:arrow-left-bold" size={15} className="mr-1.5" />
                Cancel & Return
              </Button>
              <div className="flex gap-2.5">
                <Button
                  variant="outline"
                  onClick={() => setActiveView("preview")}
                  className="text-slate-700"
                >
                  <Icon icon="solar:eye-bold" size={15} className="mr-1.5" />
                  Preview A4 Letter
                </Button>
                <Button
                  onClick={() => handleSave(false)}
                  disabled={saving}
                  className="bg-blue-600 hover:bg-blue-700 text-white shadow-xs"
                >
                  {saving ? "Saving..." : "Save Referral Letter"}
                </Button>
                <Button
                  onClick={() => handleSave(true)}
                  disabled={saving}
                  className="bg-slate-900 hover:bg-slate-800 text-white shadow-xs"
                >
                  <Icon icon="solar:printer-bold" size={15} className="mr-1.5" />
                  Save & Print A4
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* VIEW 2: Standardized A4 Printable Document                    */}
        {/* ══════════════════════════════════════════════════════════════ */}
        <div
          id="external-referral-print-area"
          className={`${
            activeView === "preview" ? "block" : "hidden print:block"
          } bg-white text-slate-900 p-8 sm:p-12 border rounded-xl shadow-xs print:border-none print:shadow-none print:p-0 print:m-0`}
          style={{ minHeight: "297mm" }}
        >
          {/* Header Banner */}
          <div className="border-b-2 border-blue-900 pb-3 mb-5 flex justify-between items-start">
            <div className="flex items-start gap-3">
              <img
                src={eeuLogo}
                alt="EEU Emblem"
                className="w-8 h-8 object-contain shrink-0 print:w-6 print:h-6 print:max-h-6"
                style={{
                  printColorAdjust: "exact",
                  WebkitPrintColorAdjust: "exact",
                  maxHeight: "26px",
                }}
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = "/eeu-logo.png";
                }}
              />
              <div>
                <div className="text-[12px] font-bold text-[#D84315] leading-tight">
                  የኢትዮጵያ ኤሌክትሪክ አገልግሎት
                </div>
                <h1 className="text-base font-extrabold uppercase tracking-tight text-blue-950">
                  Ethiopian Electric Utility Medium Clinic
                </h1>
                <p className="text-xs text-slate-600 font-medium">
                  Clinical Services & Outpatient Care • Referral Management Unit
                </p>
                <p className="text-[11px] text-slate-500">
                  Addis Ababa, Ethiopia • Tel: +251 11 515 7103
                </p>
              </div>
            </div>

            <div className="text-right space-y-1">
              <span className="inline-block bg-blue-900 text-white font-bold text-xs px-3 py-1 rounded uppercase tracking-wider">
                External Referral Letter
              </span>
              <div className="text-xs text-slate-700 pt-1">
                <div>
                  <strong>Ref ID:</strong> {referralId || `REF-${new Date().getFullYear()}-0001`}
                </div>
                <div>
                  <strong>Date:</strong> {form.referral_date}
                </div>
                <div>
                  <strong>Priority: </strong>
                  <span
                    className={`font-bold px-1.5 py-0.5 rounded text-[11px] ${
                      form.priority === "Emergency"
                        ? "bg-red-100 text-red-800"
                        : form.priority === "Urgent"
                        ? "bg-amber-100 text-amber-800"
                        : "bg-blue-100 text-blue-800"
                    }`}
                  >
                    {form.priority}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Referral Routing (From / To Grid) */}
          <div className="grid grid-cols-2 gap-0 border border-slate-300 rounded mb-4 overflow-hidden text-xs">
            <div className="p-3.5 bg-slate-50 border-r border-slate-300">
              <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">
                Referring Practitioner & Center (From)
              </span>
              <div className="font-bold text-sm text-slate-900">Dr. {practitionerName}</div>
              <div className="text-slate-700">Department: {departmentName}</div>
              <div className="text-slate-700">Facility: {companyName}</div>
              <div className="text-slate-600 text-[11px] mt-0.5">Licensed Attending Medical Staff</div>
            </div>

            <div className="p-3.5 bg-blue-50/50">
              <span className="text-[10px] uppercase font-bold text-blue-700 block mb-1">
                Target Facility & Specialist (To)
              </span>
              <div className="font-bold text-sm text-blue-950">
                {form.target_facility || "[ Target Hospital / Clinic Name ]"}
              </div>
              <div className="text-slate-700">
                Specialist / Dept: {form.receiving_specialist || "Specialist on Duty"}
              </div>
              <div className="text-slate-700">Service: Specialized External Consultation & Care</div>
              <div className="text-slate-600 text-[11px] mt-0.5">Status: {form.status}</div>
            </div>
          </div>

          {/* Patient Demographics Banner */}
          <div className="bg-slate-100 border border-slate-200 rounded p-3 mb-4 text-xs">
            <div className="grid grid-cols-4 gap-2">
              <div>
                <span className="text-[10px] uppercase text-slate-500 block font-semibold">Patient Name</span>
                <span className="font-bold text-slate-900 text-sm">{patientName}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase text-slate-500 block font-semibold">MRN / ID</span>
                <span className="font-semibold text-slate-800">#{selectedPatientId || "N/A"}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase text-slate-500 block font-semibold">Age / Gender</span>
                <span className="font-semibold text-slate-800">
                  {patientAge} / {patientSex}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase text-slate-500 block font-semibold">Contact</span>
                <span className="font-semibold text-slate-800">{patientMobile}</span>
              </div>
            </div>
          </div>

          {/* 1. Clinical Indication & Reason for Referral */}
          <div className="mb-4">
            <div className="text-xs font-bold text-blue-950 uppercase tracking-wide border-b border-slate-300 pb-0.5 mb-1.5">
              1. Clinical Indication & Reason for Referral
            </div>
            <div className="text-xs text-slate-800 bg-slate-50 border border-slate-200 rounded p-3 whitespace-pre-wrap leading-relaxed">
              {form.clinical_indication || "Patient referred for further diagnostic evaluation and management."}
            </div>
          </div>

          {/* 2. Provisional Diagnosis */}
          <div className="mb-4">
            <div className="text-xs font-bold text-blue-950 uppercase tracking-wide border-b border-slate-300 pb-0.5 mb-1.5">
              2. Provisional Diagnosis / Working Clinical Assessment
            </div>
            <div className="text-xs font-bold text-slate-900 bg-white border border-slate-200 rounded p-3 whitespace-pre-wrap leading-relaxed">
              {form.provisional_diagnosis || "Clinical assessment pending diagnostic confirmation."}
            </div>
          </div>

          {/* 3. Treatment Summary */}
          <div className="mb-4">
            <div className="text-xs font-bold text-blue-950 uppercase tracking-wide border-b border-slate-300 pb-0.5 mb-1.5">
              3. Current Treatment & Medications Administered
            </div>
            <div className="text-xs text-slate-800 bg-white border border-slate-200 rounded p-3 whitespace-pre-wrap leading-relaxed font-mono">
              {form.treatment_summary || "No prior medications administered during this encounter."}
            </div>
          </div>

          {/* 4. Relevant Test Results */}
          <div className="mb-4">
            <div className="text-xs font-bold text-blue-950 uppercase tracking-wide border-b border-slate-300 pb-0.5 mb-1.5">
              4. Relevant Diagnostic & Laboratory Test Results
            </div>
            <div className="text-xs text-slate-800 bg-white border border-slate-200 rounded p-3 whitespace-pre-wrap leading-relaxed font-mono">
              {form.relevant_test_results || "All relevant clinical investigations and reports provided."}
            </div>
          </div>

          {/* 5. Special Notes & Transport Instructions */}
          <div className="mb-4">
            <div className="text-xs font-bold text-blue-950 uppercase tracking-wide border-b border-slate-300 pb-0.5 mb-1.5">
              5. Special Instructions, Precautions & Transport Notes
            </div>
            <div className="text-xs text-slate-800 bg-amber-50/70 border border-amber-200 rounded p-3 whitespace-pre-wrap leading-relaxed">
              {form.referral_notes || "Patient ambulatory and clinically stable for standard transport."}
            </div>
          </div>

          {/* Physician Endorsement & Destination Facility Receipt */}
          <div className="grid grid-cols-2 gap-8 mt-8 pt-4 border-t border-dashed border-slate-300 text-xs">
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                Referring Practitioner Endorsement
              </span>
              <div className="mt-8 border-t-2 border-slate-800 pt-1 text-center">
                <div className="font-bold text-slate-900">Dr. {practitionerName}</div>
                <div className="text-[11px] text-slate-600">Authorized Medical Signature & License</div>
                <div className="text-[10px] text-slate-500 mt-0.5">Date: {form.referral_date}</div>
              </div>
              <div className="border border-dashed border-slate-400 rounded h-14 mt-2 flex items-center justify-center text-[10px] text-slate-400 font-semibold uppercase">
                [ Official Clinic / Hospital Stamp ]
              </div>
            </div>

            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                Receiving Facility Acknowledgement
              </span>
              <div className="mt-8 border-t-2 border-slate-800 pt-1 text-center">
                <div className="font-medium text-slate-500">__________________________________________</div>
                <div className="text-[11px] text-slate-600">Receiving Physician / Triage Nurse</div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  Date & Time Received: _____ / _____ / 202___
                </div>
              </div>
              <div className="border border-dashed border-slate-400 rounded h-14 mt-2 flex items-center justify-center text-[10px] text-slate-400 font-semibold uppercase">
                [ Destination Receiving Stamp ]
              </div>
            </div>
          </div>

          {/* Confidential Notice */}
          <div className="mt-6 pt-3 border-t border-slate-200 text-[10px] text-slate-400 text-center leading-normal">
            CONFIDENTIAL MEDICAL RECORD: This referral communication contains sensitive protected health information.
            It is intended exclusively for the medical team at {form.target_facility || "the receiving facility"}.
          </div>
        </div>

        {/* Print Action Bar (when in preview view) */}
        {activeView === "preview" && (
          <div className="mt-6 p-4 bg-white border rounded-xl flex justify-between items-center print:hidden shadow-xs">
            <Button variant="outline" size="sm" onClick={() => setActiveView("form")}>
              <Icon icon="solar:pen-bold" size={14} className="mr-1.5" /> Back to Edit Form
            </Button>
            <div className="flex gap-2">
              {savedId && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleOpenServerTemplate}
                  className="text-blue-700"
                >
                  <Icon icon="solar:link-circle-bold" size={15} className="mr-1.5" />
                  Open Pure HTML
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={handleBack}>
                Done / Back
              </Button>
              <Button
                size="sm"
                onClick={() => window.print()}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Icon icon="solar:printer-bold" size={16} className="mr-1.5" />
                Print A4 Sheet
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
