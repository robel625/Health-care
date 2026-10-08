import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/ui/dialog";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { Textarea } from "@/ui/textarea";
import { Icon } from "@/components/icon";
import { HealthcareApi, type ExternalReferral } from "@/api/services/healthcareService";

interface ExternalReferralModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  encounterId?: number;
  patientId?: number | null;
  patientName?: string;
  patientAge?: string | number;
  patientSex?: string;
  patientMobile?: string;
  practitionerId?: number | null;
  practitionerName?: string;
  departmentName?: string;
  companyName?: string;
  defaultDiagnoses?: string[];
  defaultSymptoms?: string[];
  defaultMedications?: string[];
  defaultLabResults?: string[];
  onReferralSaved?: (referral: ExternalReferral) => void;
}

export default function ExternalReferralModal({
  open,
  onOpenChange,
  encounterId,
  patientId,
  patientName = "Patient",
  patientAge,
  patientSex,
  patientMobile,
  practitionerId,
  practitionerName = "Attending Physician",
  departmentName = "General Outpatient",
  companyName = "Healthcare Center & Hospital",
  defaultDiagnoses = [],
  defaultSymptoms = [],
  defaultMedications = [],
  defaultLabResults = [],
  onReferralSaved,
}: ExternalReferralModalProps) {
  const [activeView, setActiveView] = useState<"form" | "preview">("form");
  const [saving, setSaving] = useState(false);
  const [referralId, setReferralId] = useState<string>("");

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

  // Pre-populate with current encounter's clinical context whenever modal opens
  useEffect(() => {
    if (open) {
      setForm((prev) => ({
        ...prev,
        clinical_indication:
          prev.clinical_indication ||
          (defaultSymptoms.length > 0
            ? `Patient presents with: ${defaultSymptoms.join(", ")}. Requires advanced diagnostic evaluation and specialized care.`
            : "Requires specialized medical evaluation and ongoing management."),
        provisional_diagnosis:
          prev.provisional_diagnosis ||
          (defaultDiagnoses.length > 0
            ? defaultDiagnoses.join("; ")
            : "Clinical diagnosis pending comprehensive review."),
        treatment_summary:
          prev.treatment_summary ||
          (defaultMedications.length > 0
            ? `Currently prescribed medications:\n${defaultMedications.map((m) => `• ${m}`).join("\n")}`
            : "No active treatments initiated prior to referral."),
        relevant_test_results:
          prev.relevant_test_results ||
          (defaultLabResults.length > 0
            ? `Recent Diagnostic/Lab Investigations:\n${defaultLabResults.map((t) => `• ${t}`).join("\n")}`
            : "Routine bedside parameters recorded. Further diagnostic tests recommended upon admission."),
      }));
    }
  }, [open, defaultDiagnoses, defaultSymptoms, defaultMedications, defaultLabResults]);

  const [savedId, setSavedId] = useState<number | null>(null);

  const handleSave = async (andPrint = false) => {
    if (!patientId) {
      alert("Please select a patient before saving an external referral.");
      return;
    }
    if (!form.target_facility.trim()) {
      alert("Please specify the target hospital or clinic name.");
      return;
    }
    setSaving(true);
    try {
      const payload: Partial<ExternalReferral> = {
        encounter: encounterId || null,
        patient: patientId,
        referring_practitioner: practitionerId || null,
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
      if (onReferralSaved) {
        onReferralSaved(res);
      }
      if (andPrint) {
        setActiveView("preview");
        setTimeout(() => {
          handleDirectPrint();
        }, 300);
      } else {
        setActiveView("preview");
      }
    } catch (err) {
      console.error("Failed to save external referral", err);
      alert("Failed to save external referral record.");
    } finally {
      setSaving(false);
    }
  };

  const handleDirectPrint = () => {
    window.print();
  };

  const handleOpenServerTemplate = () => {
    if (savedId) {
      window.open(`/api/healthcare/external-referrals/${savedId}/print-html/?format=html`, "_blank");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto p-0">
        {/* Modal Header */}
        <DialogHeader className="p-5 border-b sticky top-0 bg-white z-20 print:hidden flex flex-row items-center justify-between">
          <div>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold text-slate-800">
              <Icon icon="solar:share-circle-bold" size={22} className="text-blue-600" />
              External Referral Out
              <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-blue-100 text-blue-700 ml-2">
                A4 Printable
              </span>
            </DialogTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Standardized physical clinical referral document for external hospitals & receiving specialists
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex rounded-md bg-slate-100 p-0.5 text-xs font-medium mr-2">
              <button
                type="button"
                className={`px-3 py-1 rounded transition-colors ${
                  activeView === "form"
                    ? "bg-white text-slate-900 shadow-sm font-semibold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
                onClick={() => setActiveView("form")}
              >
                <Icon icon="solar:pen-new-square-bold" size={13} className="inline mr-1" />
                Edit Form
              </button>
              <button
                type="button"
                className={`px-3 py-1 rounded transition-colors ${
                  activeView === "preview"
                    ? "bg-white text-slate-900 shadow-sm font-semibold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
                onClick={() => setActiveView("preview")}
              >
                <Icon icon="solar:document-bold" size={13} className="inline mr-1" />
                A4 Print Preview
              </button>
            </div>

            {activeView === "form" ? (
              <Button
                size="sm"
                onClick={() => handleSave(true)}
                disabled={saving}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Icon icon="solar:printer-bold" size={15} className="mr-1" />
                Save & Print A4
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={handleDirectPrint}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Icon icon="solar:printer-bold" size={15} className="mr-1" />
                Print Referral
              </Button>
            )}
          </div>
        </DialogHeader>

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* VIEW 1: Interactive Data Capture Form                         */}
        {/* ══════════════════════════════════════════════════════════════ */}
        {activeView === "form" && (
          <div className="p-6 space-y-5 print:hidden">
            {/* Top metadata info card */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-3.5 bg-slate-50 border border-slate-200 rounded-lg text-xs">
              <div>
                <span className="text-slate-500 block uppercase font-semibold text-[10px]">Patient</span>
                <span className="font-bold text-slate-800 text-sm">{patientName}</span>
                <div className="text-slate-600 mt-0.5">
                  ID: #{patientId} • {patientAge || "Age N/A"} • {patientSex || "N/A"}
                </div>
              </div>
              <div>
                <span className="text-slate-500 block uppercase font-semibold text-[10px]">Referring Doctor</span>
                <span className="font-bold text-slate-800 text-sm">Dr. {practitionerName}</span>
                <div className="text-slate-600 mt-0.5">Department: {departmentName}</div>
              </div>
              <div>
                <span className="text-slate-500 block uppercase font-semibold text-[10px]">Origin Facility</span>
                <span className="font-bold text-slate-800 text-sm">{companyName}</span>
                <div className="text-slate-600 mt-0.5">Contact: {patientMobile || "+251-11-000-0000"}</div>
              </div>
            </div>

            {/* Target Facility & Specialist */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2 space-y-1.5">
                <Label htmlFor="target_facility" className="text-xs font-semibold text-slate-700">
                  Target Hospital / Clinic Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="target_facility"
                  placeholder="e.g. Tikur Anbessa Specialized Hospital, St. Paul's Hospital, Korean Hospital"
                  value={form.target_facility}
                  onChange={(e) => setForm({ ...form, target_facility: e.target.value })}
                  className="text-sm font-medium"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="priority" className="text-xs font-semibold text-slate-700">
                  Referral Priority
                </Label>
                <select
                  id="priority"
                  className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus:ring-1 focus:ring-ring outline-none"
                  value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: e.target.value as any })}
                >
                  <option value="Routine">Routine</option>
                  <option value="Urgent">Urgent</option>
                  <option value="Emergency">Emergency</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="receiving_specialist" className="text-xs font-semibold text-slate-700">
                  Receiving Specialist / Department
                </Label>
                <Input
                  id="receiving_specialist"
                  placeholder="e.g. Cardiology OPD, Dr. Abebe (Endocrinology)"
                  value={form.receiving_specialist}
                  onChange={(e) => setForm({ ...form, receiving_specialist: e.target.value })}
                  className="text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="referral_date" className="text-xs font-semibold text-slate-700">
                  Referral Date
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

            {/* Clinical Indication / Reason */}
            <div className="space-y-1.5">
              <Label htmlFor="clinical_indication" className="text-xs font-semibold text-slate-700">
                Clinical Indication & Reason for Referral <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="clinical_indication"
                rows={2}
                placeholder="State primary clinical indication, persistent symptoms, or need for advanced tertiary care..."
                value={form.clinical_indication}
                onChange={(e) => setForm({ ...form, clinical_indication: e.target.value })}
                className="text-sm"
              />
            </div>

            {/* Provisional Diagnosis */}
            <div className="space-y-1.5">
              <Label htmlFor="provisional_diagnosis" className="text-xs font-semibold text-slate-700">
                Provisional Diagnosis / Working Clinical Assessment
              </Label>
              <Textarea
                id="provisional_diagnosis"
                rows={2}
                placeholder="Provisional diagnosis or working clinical assessment..."
                value={form.provisional_diagnosis}
                onChange={(e) => setForm({ ...form, provisional_diagnosis: e.target.value })}
                className="text-sm font-medium"
              />
            </div>

            {/* Treatment Summary */}
            <div className="space-y-1.5">
              <Label htmlFor="treatment_summary" className="text-xs font-semibold text-slate-700">
                Current Treatment & Medication Summary
              </Label>
              <Textarea
                id="treatment_summary"
                rows={2}
                placeholder="Medications administered, procedures done, supportive care provided..."
                value={form.treatment_summary}
                onChange={(e) => setForm({ ...form, treatment_summary: e.target.value })}
                className="text-sm"
              />
            </div>

            {/* Relevant Test Results */}
            <div className="space-y-1.5">
              <Label htmlFor="relevant_test_results" className="text-xs font-semibold text-slate-700">
                Relevant Test & Investigation Results
              </Label>
              <Textarea
                id="relevant_test_results"
                rows={2}
                placeholder="Key lab test values, vitals, radiology, or ECG findings..."
                value={form.relevant_test_results}
                onChange={(e) => setForm({ ...form, relevant_test_results: e.target.value })}
                className="text-sm"
              />
            </div>

            {/* Special Instructions / Notes */}
            <div className="space-y-1.5">
              <Label htmlFor="referral_notes" className="text-xs font-semibold text-slate-700">
                Special Instructions, Precautions & Transport Notes
              </Label>
              <Textarea
                id="referral_notes"
                rows={2}
                placeholder="e.g. Oxygen support required during transport, patient requires stretcher, contact doctor if deteriorated..."
                value={form.referral_notes}
                onChange={(e) => setForm({ ...form, referral_notes: e.target.value })}
                className="text-sm"
              />
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                variant="outline"
                onClick={() => setActiveView("preview")}
                className="text-slate-700"
              >
                <Icon icon="solar:eye-bold" size={15} className="mr-1" />
                Preview A4 Letter
              </Button>
              <Button
                onClick={() => handleSave(false)}
                disabled={saving}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {saving ? "Saving..." : "Save Referral"}
              </Button>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* VIEW 2: Standardized A4 Printable Format                      */}
        {/* ══════════════════════════════════════════════════════════════ */}
        <div
          id="external-referral-print-area"
          className={`${
            activeView === "preview" ? "block" : "hidden print:block"
          } p-8 bg-white text-slate-900 print:p-0 print:m-0`}
          style={{ minHeight: "297mm" }}
        >
          {/* Header */}
          <div className="border-b-2 border-blue-900 pb-3 mb-4 flex justify-between items-start">
            <div>
              <h1 className="text-xl font-extrabold uppercase tracking-tight text-blue-950">
                {companyName}
              </h1>
              <p className="text-xs text-slate-600 font-medium">
                Clinical Services & Continuity of Care • Referral Management Unit
              </p>
              <p className="text-[11px] text-slate-500">
                Medical District Way • Tel: +251-11-000-0000 • Email: referrals@clinic.org
              </p>
            </div>

            <div className="text-right space-y-1">
              <span className="inline-block bg-blue-900 text-white font-bold text-xs px-3 py-1 rounded uppercase tracking-wider">
                External Referral Letter
              </span>
              <div className="text-xs text-slate-700 pt-1">
                <div><strong>Ref ID:</strong> {referralId || `REF-${new Date().getFullYear()}-0001`}</div>
                <div><strong>Date:</strong> {form.referral_date}</div>
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
            <div className="p-3 bg-slate-50 border-r border-slate-300">
              <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">
                Referring Practitioner & Center (From)
              </span>
              <div className="font-bold text-sm text-slate-900">Dr. {practitionerName}</div>
              <div className="text-slate-700">Department: {departmentName}</div>
              <div className="text-slate-700">Facility: {companyName}</div>
              <div className="text-slate-600 text-[11px] mt-0.5">Licensed Medical Staff</div>
            </div>

            <div className="p-3 bg-blue-50/50">
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
          <div className="bg-slate-100 border border-slate-200 rounded p-2.5 mb-4 text-xs">
            <div className="grid grid-cols-4 gap-2">
              <div>
                <span className="text-[10px] uppercase text-slate-500 block font-semibold">Patient Name</span>
                <span className="font-bold text-slate-900 text-sm">{patientName}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase text-slate-500 block font-semibold">MRN / ID</span>
                <span className="font-semibold text-slate-800">#{patientId}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase text-slate-500 block font-semibold">Age / Gender</span>
                <span className="font-semibold text-slate-800">
                  {patientAge || "N/A"} / {patientSex || "N/A"}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase text-slate-500 block font-semibold">Contact</span>
                <span className="font-semibold text-slate-800">{patientMobile || "Recorded on file"}</span>
              </div>
            </div>
          </div>

          {/* 1. Clinical Indication & Reason for Referral */}
          <div className="mb-3.5">
            <div className="text-xs font-bold text-blue-950 uppercase tracking-wide border-b border-slate-300 pb-0.5 mb-1.5">
              1. Clinical Indication & Reason for Referral
            </div>
            <div className="text-xs text-slate-800 bg-slate-50 border border-slate-200 rounded p-2.5 whitespace-pre-wrap leading-relaxed">
              {form.clinical_indication || "Patient referred for further diagnostic evaluation and management."}
            </div>
          </div>

          {/* 2. Provisional Diagnosis */}
          <div className="mb-3.5">
            <div className="text-xs font-bold text-blue-950 uppercase tracking-wide border-b border-slate-300 pb-0.5 mb-1.5">
              2. Provisional Diagnosis / Working Clinical Assessment
            </div>
            <div className="text-xs font-bold text-slate-900 bg-white border border-slate-200 rounded p-2.5 whitespace-pre-wrap leading-relaxed">
              {form.provisional_diagnosis || "Clinical assessment pending diagnostic confirmation."}
            </div>
          </div>

          {/* 3. Treatment Summary */}
          <div className="mb-3.5">
            <div className="text-xs font-bold text-blue-950 uppercase tracking-wide border-b border-slate-300 pb-0.5 mb-1.5">
              3. Current Treatment & Medications Administered
            </div>
            <div className="text-xs text-slate-800 bg-white border border-slate-200 rounded p-2.5 whitespace-pre-wrap leading-relaxed">
              {form.treatment_summary || "No prior medications administered during this encounter."}
            </div>
          </div>

          {/* 4. Relevant Test Results */}
          <div className="mb-3.5">
            <div className="text-xs font-bold text-blue-950 uppercase tracking-wide border-b border-slate-300 pb-0.5 mb-1.5">
              4. Relevant Diagnostic & Laboratory Test Results
            </div>
            <div className="text-xs text-slate-800 bg-white border border-slate-200 rounded p-2.5 whitespace-pre-wrap leading-relaxed">
              {form.relevant_test_results || "All relevant clinical investigations and reports provided."}
            </div>
          </div>

          {/* 5. Special Notes & Transport Instructions */}
          {form.referral_notes && (
            <div className="mb-3.5">
              <div className="text-xs font-bold text-blue-950 uppercase tracking-wide border-b border-slate-300 pb-0.5 mb-1.5">
                5. Special Instructions & Precautions
              </div>
              <div className="text-xs text-slate-800 bg-amber-50/60 border border-amber-200 rounded p-2.5 whitespace-pre-wrap leading-relaxed">
                {form.referral_notes}
              </div>
            </div>
          )}

          {/* Physician Endorsement & Destination Facility Receipt */}
          <div className="grid grid-cols-2 gap-6 mt-6 pt-4 border-t border-dashed border-slate-300 text-xs">
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
                <div className="text-[10px] text-slate-500 mt-0.5">Date & Time Received: _____ / _____ / 202___</div>
              </div>
              <div className="border border-dashed border-slate-400 rounded h-14 mt-2 flex items-center justify-center text-[10px] text-slate-400 font-semibold uppercase">
                [ Destination Receiving Stamp ]
              </div>
            </div>
          </div>

          {/* Legal Footer */}
          <div className="mt-6 pt-3 border-t border-slate-200 text-[10px] text-slate-400 text-center leading-normal">
            CONFIDENTIAL MEDICAL RECORD: This referral communication contains sensitive protected health information.
            It is intended exclusively for the medical team at {form.target_facility || "the receiving facility"}.
          </div>
        </div>

        {/* Print Action Bar for Preview view */}
        {activeView === "preview" && (
          <div className="p-4 bg-slate-50 border-t flex justify-between items-center print:hidden">
            <Button variant="outline" size="sm" onClick={() => setActiveView("form")}>
              <Icon icon="solar:pen-bold" size={14} className="mr-1" /> Back to Edit
            </Button>
            <div className="flex gap-2">
              {savedId && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleOpenServerTemplate}
                  className="text-blue-700"
                >
                  <Icon icon="solar:link-circle-bold" size={15} className="mr-1" />
                  Open Pure HTML
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              <Button size="sm" onClick={handleDirectPrint} className="bg-blue-600 hover:bg-blue-700 text-white">
                <Icon icon="solar:printer-bold" size={16} className="mr-1" />
                Print A4 Sheet
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
