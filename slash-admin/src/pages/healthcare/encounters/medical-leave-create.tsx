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
  type MedicalLeaveSlip,
  type Patient,
  type HealthcarePractitioner,
} from "@/api/services/healthcareService";
import { formatAge } from "@/utils/age";

const QUICK_DURATIONS = [
  { label: "1 Day", days: 1 },
  { label: "2 Days", days: 2 },
  { label: "3 Days", days: 3 },
  { label: "5 Days", days: 5 },
  { label: "7 Days (1 Wk)", days: 7 },
  { label: "10 Days", days: 10 },
  { label: "14 Days (2 Wks)", days: 14 },
];

export default function MedicalLeaveCreatePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const patientParam = searchParams.get("patient");
  const encounterParam = searchParams.get("encounter");
  const practitionerParam = searchParams.get("practitioner");

  const [activeView, setActiveView] = useState<"form" | "preview">("form");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [slipId, setSlipId] = useState<string>("");
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
  const [companyName, setCompanyName] = useState("Healthcare Center & Hospital");
  const [departmentName, setDepartmentName] = useState("Outpatient Department");

  const todayStr = new Date().toISOString().split("T")[0];
  const tomorrowStr = new Date(Date.now() + 86400000).toISOString().split("T")[0];
  const dayAfterTomorrowStr = new Date(Date.now() + 86400000 * 2).toISOString().split("T")[0];

  const [form, setForm] = useState({
    issue_date: todayStr,
    diagnosis: "",
    from_date: todayStr,
    to_date: tomorrowStr,
    total_days: 2,
    doctor_remarks: "Strict bed rest and symptomatic medication compliance recommended.",
    fitness_state: "Unfit for Work / School" as
      | "Unfit for Work / School"
      | "Fit for Light Duty Only"
      | "Fit for Normal Duties",
    fit_to_work_date: dayAfterTomorrowStr,
    status: "Issued" as "Draft" | "Issued" | "Cancelled",
  });

  // Calculate dates when duration presets are clicked
  const applyPresetDuration = (days: number) => {
    const from = new Date(form.from_date || todayStr);
    const to = new Date(from.getTime() + (days - 1) * 86400000);
    const nextFit = new Date(to.getTime() + 86400000);

    const toStr = to.toISOString().split("T")[0];
    const fitStr = nextFit.toISOString().split("T")[0];

    setForm((prev) => ({
      ...prev,
      to_date: toStr,
      total_days: days,
      fit_to_work_date: fitStr,
    }));
  };

  // Recalculate days when from_date or to_date changes
  const handleDateChange = (from: string, to: string) => {
    let days = 1;
    let nextFitDate = to;
    if (from && to) {
      const d1 = new Date(from);
      const d2 = new Date(to);
      const diffTime = d2.getTime() - d1.getTime();
      const diffDays = Math.round(diffTime / (1000 * 3600 * 24)) + 1;
      days = Math.max(1, diffDays);

      const fitDateObj = new Date(d2.getTime() + 86400000);
      nextFitDate = fitDateObj.toISOString().split("T")[0];
    }
    setForm((prev) => ({
      ...prev,
      from_date: from,
      to_date: to,
      total_days: days,
      fit_to_work_date: nextFitDate,
    }));
  };

  // Load masters & encounter data
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

      // If encounterParam is present, pre-fill patient and diagnosis from the encounter
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

            const diagnoses = (enc.diagnoses_list || []).map((d: any) => d.diagnosis).filter(Boolean);
            if (diagnoses.length > 0) {
              setForm((prev) => ({
                ...prev,
                diagnosis: prev.diagnosis || diagnoses.join("; "),
              }));
            }
          }
        } catch (encErr) {
          console.error("Failed to load encounter context for leave slip", encErr);
        }
      }
    } catch (err) {
      console.error("Failed to load leave slip masters", err);
    } finally {
      setLoading(false);
    }
  }, [encounterParam, patientParam, practitionerParam]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Sync patient details
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

  // Sync practitioner details
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
  const practitionerName = practitionerDetails?.practitioner_name || "Attending Physician";
  const practitionerDesignation = practitionerDetails?.designation || "Licensed Medical Practitioner";

  const handleSave = async (andPrint = false) => {
    if (!selectedPatientId) {
      toast.error("Please select a Patient before saving the medical leave slip.");
      return;
    }
    if (!form.diagnosis.trim()) {
      toast.error("Please provide a clinical diagnosis justifying the medical leave.");
      return;
    }
    setSaving(true);
    try {
      const payload: Partial<MedicalLeaveSlip> = {
        encounter: selectedEncounterId || null,
        patient: selectedPatientId,
        practitioner: selectedPractitionerId || null,
        issue_date: form.issue_date,
        diagnosis: form.diagnosis,
        from_date: form.from_date,
        to_date: form.to_date,
        total_days: form.total_days,
        doctor_remarks: form.doctor_remarks,
        fitness_state: form.fitness_state,
        fit_to_work_date: form.fit_to_work_date || null,
        status: form.status,
      };

      const res = await HealthcareApi.medicalLeaveSlips.create(payload);
      if (res?.slip_id) {
        setSlipId(res.slip_id);
      }
      if (res?.id) {
        setSavedId(res.id);
      }

      toast.success(
        `Medical Leave Certificate ${res?.slip_id || ""} successfully generated!`
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
      console.error("Failed to save medical leave slip", err);
      toast.error(
        err?.response?.data?.detail ||
          err?.response?.data?.message ||
          "Failed to save medical leave slip record."
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
      window.open(`/api/healthcare/medical-leave-slips/${savedId}/print-html/?format=html`, "_blank");
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
                  className="hover:text-foreground text-teal-700 font-medium"
                >
                  Encounter #{selectedEncounterId}
                </button>
              </>
            )}
            <span>/</span>
            <span className="text-foreground font-semibold flex items-center gap-1.5">
              <Icon icon="solar:diploma-verified-bold" size={17} className="text-teal-600" />
              Medical Leave Certificate
            </span>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-teal-100 text-teal-800 ml-1">
              A5 Certificate
            </span>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            {/* View Switcher: Form vs A5 Preview */}
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
                A5 Certificate Preview
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
                  className="bg-teal-600 hover:bg-teal-700 text-white text-xs h-8 shadow-xs"
                >
                  <Icon icon="solar:printer-bold" size={14} className="mr-1.5" />
                  Save & Print A5
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                onClick={() => window.print()}
                className="bg-teal-600 hover:bg-teal-700 text-white text-xs h-8 shadow-xs"
              >
                <Icon icon="solar:printer-bold" size={14} className="mr-1.5" />
                Print A5 Certificate
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-6">
        {/* ══════════════════════════════════════════════════════════════ */}
        {/* VIEW 1: Interactive Data Entry Form                           */}
        {/* ══════════════════════════════════════════════════════════════ */}
        {activeView === "form" && (
          <div className="space-y-6 print:hidden">
            {/* Patient & Attending Doctor Context Banner */}
            <Card className="border-teal-100 bg-linear-to-r from-teal-50/50 via-slate-50/30 to-white shadow-xs">
              <CardContent className="p-5">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Patient Info */}
                  <div>
                    <span className="text-[11px] uppercase tracking-wider font-bold text-teal-700 block mb-1">
                      Patient Details
                    </span>
                    {selectedPatientId ? (
                      <div>
                        <div className="text-base font-bold text-slate-900">{patientName}</div>
                        <div className="text-xs text-slate-600 mt-0.5">
                          ID: <strong>#{selectedPatientId}</strong> • Age: {patientAge} • Sex: {patientSex}
                        </div>
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

                  {/* Attending Doctor */}
                  <div>
                    <span className="text-[11px] uppercase tracking-wider font-bold text-slate-500 block mb-1">
                      Attending Physician
                    </span>
                    {selectedPractitionerId ? (
                      <div>
                        <div className="text-base font-bold text-slate-900">Dr. {practitionerName}</div>
                        <div className="text-xs text-slate-600 mt-0.5">{practitionerDesignation}</div>
                        <div className="text-xs text-slate-500 mt-0.5">Dept: {departmentName}</div>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">Select Attending Doctor</Label>
                        <select
                          className="w-full h-9 rounded-md border border-input bg-white px-3 text-xs"
                          value={selectedPractitionerId || ""}
                          onChange={(e) =>
                            setSelectedPractitionerId(e.target.value ? Number(e.target.value) : null)
                          }
                        >
                          <option value="">-- Choose Doctor --</option>
                          {practitioners.map((pr) => (
                            <option key={pr.id} value={pr.id}>
                              {pr.practitioner_name} ({pr.department_name || "General"})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  {/* Issuing Facility */}
                  <div>
                    <span className="text-[11px] uppercase tracking-wider font-bold text-slate-500 block mb-1">
                      Issuing Facility
                    </span>
                    <div className="text-sm font-bold text-slate-900">{companyName}</div>
                    <div className="text-xs text-slate-600 mt-0.5">Occupational Health & Medical Services</div>
                    {selectedEncounterId && (
                      <div className="mt-1">
                        <span className="inline-block text-[10px] font-semibold bg-teal-100 text-teal-800 px-2 py-0.5 rounded">
                          Encounter #{selectedEncounterId}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Medical Leave Details Card */}
            <Card className="shadow-xs">
              <CardContent className="p-6 space-y-6">
                <div className="border-b pb-3">
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Icon icon="solar:calendar-date-bold" size={18} className="text-teal-600" />
                    Sick Leave Duration & Assessment
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Select recommended rest period, diagnosis, and duty fitness classification
                  </p>
                </div>

                {/* Duration Presets */}
                <div>
                  <Label className="text-xs font-semibold text-slate-700 block mb-2">
                    Quick Preset Duration:
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    {QUICK_DURATIONS.map((preset) => (
                      <Button
                        key={preset.label}
                        type="button"
                        variant={form.total_days === preset.days ? "default" : "outline"}
                        size="sm"
                        className={`text-xs h-8 ${
                          form.total_days === preset.days
                            ? "bg-teal-700 hover:bg-teal-800 text-white"
                            : "text-slate-700"
                        }`}
                        onClick={() => applyPresetDuration(preset.days)}
                      >
                        {preset.label}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Date Selection Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-teal-50/40 border border-teal-100 rounded-lg">
                  <div className="space-y-1.5">
                    <Label htmlFor="from_date" className="text-xs font-semibold text-slate-700">
                      Leave Commencing (From) <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="from_date"
                      type="date"
                      value={form.from_date}
                      onChange={(e) => handleDateChange(e.target.value, form.to_date)}
                      className="text-sm bg-white"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="to_date" className="text-xs font-semibold text-slate-700">
                      Leave Concluding (To) <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="to_date"
                      type="date"
                      value={form.to_date}
                      onChange={(e) => handleDateChange(form.from_date, e.target.value)}
                      className="text-sm bg-white"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-700">Total Duration</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={1}
                        max={365}
                        value={form.total_days}
                        onChange={(e) => {
                          const val = Number(e.target.value) || 1;
                          applyPresetDuration(val);
                        }}
                        className="text-sm font-bold bg-white w-24"
                      />
                      <span className="text-sm font-semibold text-teal-900">
                        Day{form.total_days > 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Diagnosis */}
                <div className="space-y-1.5">
                  <Label htmlFor="diagnosis" className="text-xs font-semibold text-slate-700">
                    Clinical Diagnosis / Medical Reason <span className="text-red-500">*</span>
                  </Label>
                  <Textarea
                    id="diagnosis"
                    rows={2}
                    placeholder="Clinical diagnosis justifying leave (e.g. Acute upper respiratory infection, Gastroenteritis, Post-operative recovery)..."
                    value={form.diagnosis}
                    onChange={(e) => setForm({ ...form, diagnosis: e.target.value })}
                    className="text-sm font-medium"
                  />
                </div>

                {/* Fitness State & Expected Return Date */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="fitness_state" className="text-xs font-semibold text-slate-700">
                      Fitness State During Leave
                    </Label>
                    <select
                      id="fitness_state"
                      className="w-full h-9 rounded-md border border-input bg-white px-3 text-sm shadow-xs focus:ring-1 focus:ring-ring outline-none"
                      value={form.fitness_state}
                      onChange={(e) => setForm({ ...form, fitness_state: e.target.value as any })}
                    >
                      <option value="Unfit for Work / School">Unfit for Work / School (Total Rest)</option>
                      <option value="Fit for Light Duty Only">Fit for Light Duty Only</option>
                      <option value="Fit for Normal Duties">Fit for Normal Duties</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="fit_to_work_date" className="text-xs font-semibold text-slate-700">
                      Expected Fit to Resume Work / School
                    </Label>
                    <Input
                      id="fit_to_work_date"
                      type="date"
                      value={form.fit_to_work_date}
                      onChange={(e) => setForm({ ...form, fit_to_work_date: e.target.value })}
                      className="text-sm bg-white"
                    />
                  </div>
                </div>

                {/* Doctor's Remarks / Instructions */}
                <div className="space-y-1.5">
                  <Label htmlFor="doctor_remarks" className="text-xs font-semibold text-slate-700">
                    Physician Advice & Patient Instructions
                  </Label>
                  <Textarea
                    id="doctor_remarks"
                    rows={2}
                    placeholder="e.g. Strict bed rest, adequate hydration, avoid strenuous physical exertion..."
                    value={form.doctor_remarks}
                    onChange={(e) => setForm({ ...form, doctor_remarks: e.target.value })}
                    className="text-sm"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="issue_date" className="text-xs font-semibold text-slate-700">
                      Certificate Issue Date
                    </Label>
                    <Input
                      id="issue_date"
                      type="date"
                      value={form.issue_date}
                      onChange={(e) => setForm({ ...form, issue_date: e.target.value })}
                      className="text-sm bg-white"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="status" className="text-xs font-semibold text-slate-700">
                      Document Status
                    </Label>
                    <select
                      id="status"
                      className="w-full h-9 rounded-md border border-input bg-white px-3 text-sm shadow-xs focus:ring-1 focus:ring-ring outline-none"
                      value={form.status}
                      onChange={(e) => setForm({ ...form, status: e.target.value as any })}
                    >
                      <option value="Issued">Issued (Active Official Certificate)</option>
                      <option value="Draft">Draft</option>
                      <option value="Cancelled">Cancelled</option>
                    </select>
                  </div>
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
                  Preview A5 Certificate
                </Button>
                <Button
                  onClick={() => handleSave(false)}
                  disabled={saving}
                  className="bg-teal-700 hover:bg-teal-800 text-white shadow-xs"
                >
                  {saving ? "Saving..." : "Save Certificate"}
                </Button>
                <Button
                  onClick={() => handleSave(true)}
                  disabled={saving}
                  className="bg-slate-900 hover:bg-slate-800 text-white shadow-xs"
                >
                  <Icon icon="solar:printer-bold" size={15} className="mr-1.5" />
                  Save & Print A5
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* VIEW 2: Standardized A5 Printable Certificate Format          */}
        {/* ══════════════════════════════════════════════════════════════ */}
        <div
          id="medical-leave-print-area"
          className={`${
            activeView === "preview" ? "block" : "hidden print:block"
          } bg-white text-slate-900 p-8 border rounded-xl shadow-xs print:border-none print:shadow-none print:p-0 print:m-0`}
          style={{ maxWidth: "148mm", margin: "0 auto" }}
        >
          {/* Certificate Header */}
          <div className="border-b-2 border-slate-900 pb-3 mb-4 text-center">
            <h2 className="text-base font-extrabold uppercase tracking-tight text-slate-900">
              {companyName}
            </h2>
            <p className="text-[10px] text-slate-600">
              Medical Services & Occupational Health Department
            </p>
            <p className="text-[9px] text-slate-500">
              General Hospital Way • Tel: +251-11-000-0000 • Addis Ababa
            </p>

            <div className="mt-2.5">
              <span className="inline-block bg-slate-900 text-white font-extrabold text-[11px] px-4 py-0.5 rounded tracking-widest uppercase">
                Medical Leave / Sick Leave Certificate
              </span>
            </div>

            <div className="flex justify-between items-center text-[10px] text-slate-600 mt-2 px-1">
              <span>
                <strong>Cert No:</strong> {slipId || `MLS-${new Date().getFullYear()}-0001`}
              </span>
              <span>
                <strong>Issue Date:</strong> {form.issue_date}
              </span>
            </div>
          </div>

          {/* Certification Statement */}
          <p className="text-xs leading-relaxed text-slate-800 text-justify mb-3">
            This is to certify that{" "}
            <strong className="text-slate-950 underline decoration-slate-400 font-bold">
              {patientName}
            </strong>
            , MRN / ID: <strong>#{selectedPatientId || "N/A"}</strong>, Age: <strong>{patientAge}</strong>,
            Gender: <strong>{patientSex}</strong>, was clinically examined and treated at this facility and is
            medically advised to observe the following prescribed rest period:
          </p>

          {/* Clinical Diagnosis Box */}
          <div className="bg-slate-50 border border-slate-300 rounded p-2.5 mb-3 text-xs">
            <span className="text-[9px] font-extrabold text-slate-500 uppercase tracking-wider block mb-0.5">
              Clinical Diagnosis / Medical Condition
            </span>
            <div className="font-bold text-slate-900 text-[12px] leading-snug">
              {form.diagnosis || "Medical condition requiring rest and clinical follow-up."}
            </div>
          </div>

          {/* Recommended Rest Period (High Prominence) */}
          <div className="bg-teal-50/70 border-2 border-teal-600 rounded p-3 mb-3 text-center">
            <div className="text-[10px] font-extrabold text-teal-900 uppercase tracking-wider mb-1">
              Recommended Medical Leave Period
            </div>
            <div className="flex items-center justify-around py-1">
              <div>
                <span className="text-[9px] text-teal-800 uppercase block font-semibold">Commencing</span>
                <span className="text-xs font-extrabold text-slate-900">{form.from_date}</span>
              </div>
              <div className="text-teal-600 font-bold text-base">➔</div>
              <div>
                <span className="text-[9px] text-teal-800 uppercase block font-semibold">Concluding</span>
                <span className="text-xs font-extrabold text-slate-900">{form.to_date}</span>
              </div>
              <div>
                <span className="text-[9px] text-teal-800 uppercase block font-semibold">Total Duration</span>
                <span className="inline-block bg-teal-700 text-white font-extrabold text-xs px-2.5 py-0.5 rounded">
                  {form.total_days} Day{form.total_days > 1 ? "s" : ""}
                </span>
              </div>
            </div>
          </div>

          {/* Fitness & Remarks */}
          <div className="grid grid-cols-2 gap-2 text-xs mb-3">
            <div className="border border-slate-200 rounded p-2 bg-slate-50">
              <span className="text-[9px] font-bold text-slate-500 uppercase block">Fitness Status</span>
              <span
                className={`font-bold text-xs ${
                  form.fitness_state === "Fit for Normal Duties" ? "text-green-700" : "text-red-700"
                }`}
              >
                {form.fitness_state}
              </span>
              <div className="text-[10px] text-slate-600 mt-1">
                Expected Fit Date: <strong>{form.fit_to_work_date || "Upon rest end"}</strong>
              </div>
            </div>

            <div className="border border-slate-200 rounded p-2 bg-slate-50">
              <span className="text-[9px] font-bold text-slate-500 uppercase block">Doctor's Remarks</span>
              <div className="text-[11px] text-slate-700 leading-snug">
                {form.doctor_remarks || "Strict bed rest and compliance recommended."}
              </div>
            </div>
          </div>

          {/* Signature & Stamp Section */}
          <div className="grid grid-cols-2 gap-4 pt-3 border-t border-slate-300 text-xs mt-3">
            <div className="text-center">
              <div className="mt-7 border-t border-slate-800 pt-1">
                <div className="font-bold text-slate-900">Dr. {practitionerName}</div>
                <div className="text-[10px] text-slate-600">{practitionerDesignation}</div>
                <div className="text-[9px] text-slate-500">Medical Council Reg. Verified</div>
              </div>
            </div>

            <div>
              <div className="border border-dashed border-slate-400 rounded h-14 flex items-center justify-center text-[9px] font-semibold text-slate-400 uppercase text-center px-2">
                [ Official Clinic / Hospital Seal ]
              </div>
            </div>
          </div>

          {/* Disclaimer */}
          <div className="mt-3 pt-2 border-t border-dotted border-slate-300 text-[8px] text-slate-400 text-center leading-tight">
            NOTICE TO EMPLOYER / SCHOOL: Issued for official sick leave certification. Alterations, erasures, or
            corrections render this document invalid.
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
                  className="text-teal-700"
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
                className="bg-teal-600 hover:bg-teal-700 text-white"
              >
                <Icon icon="solar:printer-bold" size={16} className="mr-1.5" />
                Print A5 Certificate
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
