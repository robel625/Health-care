import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/ui/dialog";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { Textarea } from "@/ui/textarea";
import { Icon } from "@/components/icon";
import { HealthcareApi, type MedicalLeaveSlip } from "@/api/services/healthcareService";
import eeuLogo from "@/assets/images/eeu-logo.png";

interface MedicalLeaveSlipModalProps {
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
  practitionerDesignation?: string;
  departmentName?: string;
  companyName?: string;
  defaultDiagnoses?: string[];
  onSlipSaved?: (slip: MedicalLeaveSlip) => void;
}

export default function MedicalLeaveSlipModal({
  open,
  onOpenChange,
  encounterId,
  patientId,
  patientName = "Patient",
  patientAge,
  patientSex,
  practitionerId,
  practitionerName = "Attending Physician",
  practitionerDesignation = "Licensed Medical Practitioner",
  departmentName = "Outpatient Department",
  companyName = "Ethiopian Electric Utility Medium Clinic",
  defaultDiagnoses = [],
  onSlipSaved,
}: MedicalLeaveSlipModalProps) {
  const [activeView, setActiveView] = useState<"form" | "preview">("form");
  const [saving, setSaving] = useState(false);
  const [slipId, setSlipId] = useState<string>("");
  const [savedId, setSavedId] = useState<number | null>(null);

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

  // Pre-populate diagnosis whenever opened
  useEffect(() => {
    if (open) {
      let sessionCtx: any = null;
      try {
        const raw = sessionStorage.getItem("active_encounter_context");
        if (raw) sessionCtx = JSON.parse(raw);
      } catch (e) {
        console.warn("Could not read active_encounter_context", e);
      }

      const diags = Array.from(new Set([...defaultDiagnoses, ...(sessionCtx?.diagnoses || [])]));
      const comment = sessionCtx?.comment || "";

      if (!form.diagnosis && diags.length > 0) {
        setForm((prev) => ({
          ...prev,
          diagnosis: diags.join("; "),
          doctor_remarks: comment ? `${comment}. Strict bed rest recommended.` : prev.doctor_remarks,
        }));
      }
    }
  }, [open, defaultDiagnoses]);

  // Recalculate total_days and fit_to_work_date when from_date or to_date changes
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

  const handleSave = async (andPrint = false) => {
    if (!patientId) {
      alert("Please select a patient before saving a medical leave slip.");
      return;
    }
    if (!form.diagnosis.trim()) {
      alert("Please provide a clinical diagnosis justifying the medical leave.");
      return;
    }
    setSaving(true);
    try {
      const payload: Partial<MedicalLeaveSlip> = {
        encounter: encounterId || null,
        patient: patientId,
        practitioner: practitionerId || null,
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
      if (onSlipSaved) {
        onSlipSaved(res);
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
      console.error("Failed to save medical leave slip", err);
      alert("Failed to save medical leave slip record.");
    } finally {
      setSaving(false);
    }
  };

  const handleDirectPrint = () => {
    window.print();
  };

  const handleOpenServerTemplate = () => {
    if (savedId) {
      window.open(`/api/healthcare/medical-leave-slips/${savedId}/print-html/?format=html`, "_blank");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto p-0">
        {/* Modal Header */}
        <DialogHeader className="p-5 border-b sticky top-0 bg-white z-20 print:hidden flex flex-row items-center justify-between">
          <div>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold text-slate-800">
              <Icon icon="solar:diploma-verified-bold" size={22} className="text-teal-600" />
              Medical Leave / Sick Leave Slip
              <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-teal-100 text-teal-800 ml-2">
                A5 Standard
              </span>
            </DialogTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Official medical certificate for employer or educational institution submission
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
                Edit Slip
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
                A5 Print Preview
              </button>
            </div>

            {activeView === "form" ? (
              <Button
                size="sm"
                onClick={() => handleSave(true)}
                disabled={saving}
                className="bg-teal-600 hover:bg-teal-700 text-white"
              >
                <Icon icon="solar:printer-bold" size={15} className="mr-1" />
                Save & Print A5
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={handleDirectPrint}
                className="bg-teal-600 hover:bg-teal-700 text-white"
              >
                <Icon icon="solar:printer-bold" size={15} className="mr-1" />
                Print Certificate
              </Button>
            )}
          </div>
        </DialogHeader>

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* VIEW 1: Form Inputs                                           */}
        {/* ══════════════════════════════════════════════════════════════ */}
        {activeView === "form" && (
          <div className="p-6 space-y-5 print:hidden">
            {/* Patient & Practitioner Banner */}
            <div className="grid grid-cols-2 gap-4 p-3.5 bg-slate-50 border border-slate-200 rounded-lg text-xs">
              <div>
                <span className="text-slate-500 uppercase font-semibold text-[10px] block">Patient</span>
                <span className="font-bold text-slate-800 text-sm">{patientName}</span>
                <div className="text-slate-600">
                  MRN: #{patientId} • {patientAge || "Age N/A"} • {patientSex || "N/A"}
                </div>
              </div>
              <div>
                <span className="text-slate-500 uppercase font-semibold text-[10px] block">Attending Practitioner</span>
                <span className="font-bold text-slate-800 text-sm">Dr. {practitionerName}</span>
                <div className="text-slate-600">{departmentName}</div>
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
                placeholder="e.g. Acute upper respiratory tract infection with high grade fever..."
                value={form.diagnosis}
                onChange={(e) => setForm({ ...form, diagnosis: e.target.value })}
                className="text-sm font-medium"
              />
            </div>

            {/* Date Range: From -> To -> Total Days */}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="from_date" className="text-xs font-semibold text-slate-700">
                  Rest From Date <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="from_date"
                  type="date"
                  value={form.from_date}
                  onChange={(e) => handleDateChange(e.target.value, form.to_date)}
                  className="text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="to_date" className="text-xs font-semibold text-slate-700">
                  Rest To Date <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="to_date"
                  type="date"
                  value={form.to_date}
                  onChange={(e) => handleDateChange(form.from_date, e.target.value)}
                  className="text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="total_days" className="text-xs font-semibold text-slate-700">
                  Total Rest Duration
                </Label>
                <div className="flex items-center gap-1.5">
                  <Input
                    id="total_days"
                    type="number"
                    min={1}
                    value={form.total_days}
                    onChange={(e) => setForm({ ...form, total_days: Math.max(1, Number(e.target.value)) })}
                    className="text-sm font-bold text-center"
                  />
                  <span className="text-xs text-slate-500 font-medium">Days</span>
                </div>
              </div>
            </div>

            {/* Duty Fitness State & Fit to Resume Date */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="fitness_state" className="text-xs font-semibold text-slate-700">
                  Fitness to Resume Duties
                </Label>
                <select
                  id="fitness_state"
                  className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus:ring-1 focus:ring-ring outline-none font-medium"
                  value={form.fitness_state}
                  onChange={(e) => setForm({ ...form, fitness_state: e.target.value as any })}
                >
                  <option value="Unfit for Work / School">Unfit for Work / School</option>
                  <option value="Fit for Light Duty Only">Fit for Light Duty Only</option>
                  <option value="Fit for Normal Duties">Fit for Normal Duties</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="fit_to_work_date" className="text-xs font-semibold text-slate-700">
                  Expected Date to Resume Duties
                </Label>
                <Input
                  id="fit_to_work_date"
                  type="date"
                  value={form.fit_to_work_date}
                  onChange={(e) => setForm({ ...form, fit_to_work_date: e.target.value })}
                  className="text-sm"
                />
              </div>
            </div>

            {/* Doctor's Remarks / Instructions */}
            <div className="space-y-1.5">
              <Label htmlFor="doctor_remarks" className="text-xs font-semibold text-slate-700">
                Doctor's Remarks & Clinical Advice
              </Label>
              <Textarea
                id="doctor_remarks"
                rows={2}
                placeholder="Special precautions, bed rest instructions, avoidance of physical exertion..."
                value={form.doctor_remarks}
                onChange={(e) => setForm({ ...form, doctor_remarks: e.target.value })}
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
                Preview A5 Slip
              </Button>
              <Button
                onClick={() => handleSave(false)}
                disabled={saving}
                className="bg-teal-600 hover:bg-teal-700 text-white"
              >
                {saving ? "Saving..." : "Save Certificate"}
              </Button>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* VIEW 2: Standardized A5 Printable Slip Format                 */}
        {/* ══════════════════════════════════════════════════════════════ */}
        <div
          id="medical-leave-print-area"
          className={`${
            activeView === "preview" ? "block" : "hidden print:block"
          } p-6 bg-white text-slate-900 print:p-0 print:m-0`}
          style={{ minHeight: "210mm", maxWidth: "148mm", margin: "0 auto" }}
        >
          {/* Certificate Frame */}
          <div className="border-2 border-slate-900 outline outline-1 outline-slate-400 outline-offset-2 rounded-sm p-4 bg-white">
            {/* Header */}
            <div className="text-center border-b-2 border-slate-900 pb-2 mb-3">
              <div className="flex items-center justify-center gap-2 mb-1">
                <img
                  src={eeuLogo}
                  alt="EEU Emblem"
                  className="w-8 h-8 object-contain shrink-0 print:w-6 print:h-6 print:max-h-6"
                  style={{ printColorAdjust: "exact", WebkitPrintColorAdjust: "exact", maxHeight: "26px" }}
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src = "/eeu-logo.png";
                  }}
                />
                <div className="text-left">
                  <div className="text-[11px] font-bold text-[#D84315] leading-tight">
                    የኢትዮጵያ ኤሌክትሪክ አገልግሎት
                  </div>
                  <h2 className="text-sm font-extrabold uppercase tracking-tight text-slate-900 leading-tight">
                    Ethiopian Electric Utility Medium Clinic
                  </h2>
                </div>
              </div>
              <p className="text-[9px] text-slate-500">
                Addis Ababa, Ethiopia • Tel: +251 11 515 7103
              </p>

              <div className="mt-2">
                <span className="inline-block bg-slate-900 text-white font-extrabold text-[11px] px-4 py-0.5 rounded tracking-widest uppercase">
                  Medical Leave / Sick Leave Certificate
                </span>
              </div>

              <div className="flex justify-between items-center text-[10px] text-slate-600 mt-2 px-1">
                <span><strong>Cert No:</strong> {slipId || `MLS-${new Date().getFullYear()}-0001`}</span>
                <span><strong>Issue Date:</strong> {form.issue_date}</span>
              </div>
            </div>

            {/* Certification Statement */}
            <p className="text-xs leading-relaxed text-slate-800 text-justify mb-3">
              This is to certify that{" "}
              <strong className="text-slate-950 underline decoration-slate-400 font-bold">
                {patientName}
              </strong>
              , MRN / ID: <strong>#{patientId}</strong>, Age: <strong>{patientAge || "N/A"}</strong>, Gender:{" "}
              <strong>{patientSex || "N/A"}</strong>, was clinically examined and treated at this facility and is
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
                  {form.doctor_remarks || "Bed rest recommended."}
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
                  className="text-teal-700"
                >
                  <Icon icon="solar:link-circle-bold" size={15} className="mr-1" />
                  Open Pure HTML
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              <Button size="sm" onClick={handleDirectPrint} className="bg-teal-600 hover:bg-teal-700 text-white">
                <Icon icon="solar:printer-bold" size={16} className="mr-1" />
                Print A5 Certificate
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
