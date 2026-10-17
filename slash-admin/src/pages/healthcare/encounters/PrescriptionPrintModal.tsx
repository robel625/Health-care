import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/ui/dialog";
import { Button } from "@/ui/button";
import { Icon } from "@/components/icon";
import eeuLogo from "@/assets/images/eeu-logo.png";
import { printElementIsolated } from "@/utils/printElement";
import { cleanAgeOnlyYears } from "@/utils/age";

export interface PrintableDrugItem {
  id?: number;
  medication?: string;
  drug_code?: string;
  drug_name?: string;
  dosage?: string;
  period?: string;
  dosage_form?: string;
  comment?: string;
  quantity?: number | string;
  in_stock?: boolean;
  is_out_of_stock?: boolean;
  [key: string]: any;
}

export interface PrescriptionPrintModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientName: string;
  patientAge?: string | number;
  patientSex?: string;
  patientId?: string | number;
  patientWeight?: string | number;
  cardNo?: string;
  region?: string;
  town?: string;
  woreda?: string;
  kebele?: string;
  houseNo?: string;
  telNo?: string;
  isInpatient?: boolean;
  isOutpatient?: boolean;
  isEmergency?: boolean;
  diagnosisNotIcd?: string;
  practitionerName?: string;
  practitionerQualification?: string;
  practitionerRegistration?: string;
  departmentName?: string;
  encounterDate?: string;
  diagnoses?: string[];
  symptoms?: string[];
  drugRows: PrintableDrugItem[];
  companyName?: string;
  clinicName?: string;
  clinicPhone?: string;
  isExternalPurchaseSlip?: boolean;
}

export default function PrescriptionPrintModal({
  open,
  onOpenChange,
  patientName: initialPatientName = "",
  patientAge: initialPatientAge = "",
  patientSex: initialPatientSex = "",
  patientId = "",
  patientWeight: initialPatientWeight = "",
  cardNo: initialCardNo = "",
  region: initialRegion = "Addis Ababa",
  town: initialTown = "Addis Ababa",
  woreda: initialWoreda = "",
  kebele: initialKebele = "",
  houseNo: initialHouseNo = "",
  telNo: initialTelNo = "",
  isInpatient: initialIsInpatient = false,
  isOutpatient: initialIsOutpatient = true,
  isEmergency: initialIsEmergency = false,
  diagnosisNotIcd: initialDiagnosisNotIcd = "",
  practitionerName: initialPractitionerName = "Attending Physician",
  practitionerQualification: initialPractitionerQualification = "Medical Officer / Physician",
  practitionerRegistration: initialPractitionerRegistration = "",
  encounterDate = new Date().toISOString().split("T")[0],
  diagnoses = [],
  symptoms = [],
  drugRows = [],
  clinicName = "Ethiopian Electric Utility Medium Clinic",
  clinicPhone = "+251115157103",
  isExternalPurchaseSlip = false,
}: PrescriptionPrintModalProps) {
  // State for editable demographic fields
  const [patientName, setPatientName] = useState(initialPatientName);
  const [patientAge, setPatientAge] = useState(cleanAgeOnlyYears(initialPatientAge));
  const [patientSex, setPatientSex] = useState(initialPatientSex);
  const [patientWeight, setPatientWeight] = useState(initialPatientWeight);
  const [cardNo, setCardNo] = useState(initialCardNo || (patientId ? String(patientId) : ""));
  const [region, setRegion] = useState(initialRegion);
  const [town, setTown] = useState(initialTown);
  const [woreda, setWoreda] = useState(initialWoreda);
  const [kebele, setKebele] = useState(initialKebele);
  const [houseNo, setHouseNo] = useState(initialHouseNo);
  const [telNo, setTelNo] = useState(initialTelNo);
  const [isInpatient, setIsInpatient] = useState(initialIsInpatient);
  const [isOutpatient, setIsOutpatient] = useState(initialIsOutpatient);
  const [isEmergency, setIsEmergency] = useState(initialIsEmergency);

  // Diagnosis
  const initialDiag =
    diagnoses.length > 0
      ? diagnoses.join(", ")
      : initialDiagnosisNotIcd || symptoms.join(", ") || "";
  const [diagnosisText, setDiagnosisText] = useState(initialDiag);

  // Practitioner
  const [practitionerName, setPractitionerName] = useState(initialPractitionerName);
  const [practitionerQualification, setPractitionerQualification] = useState(initialPractitionerQualification);
  const [practitionerRegistration, setPractitionerRegistration] = useState(initialPractitionerRegistration);

  // Advanced Print Controls
  const [paperFormat, setPaperFormat] = useState<"A5" | "A4">("A5");
  const [showLogo, setShowLogo] = useState(true);
  const [showOfficialSeal, setShowOfficialSeal] = useState(false);
  const [isCompact, setIsCompact] = useState(false);
  const [isBlankForm, setIsBlankForm] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);

  // Synchronize when initial props change
  useEffect(() => {
    setPatientName(initialPatientName);
    setPatientAge(cleanAgeOnlyYears(initialPatientAge));
    setPatientSex(initialPatientSex);
    setPatientWeight(initialPatientWeight);
    setCardNo(initialCardNo || (patientId ? String(patientId) : ""));
    setRegion(initialRegion);
    setTown(initialTown);
    setWoreda(initialWoreda);
    setKebele(initialKebele);
    setHouseNo(initialHouseNo);
    setTelNo(initialTelNo);
    setIsInpatient(initialIsInpatient);
    setIsOutpatient(initialIsOutpatient);
    setIsEmergency(initialIsEmergency);
    setDiagnosisText(
      diagnoses.length > 0
        ? diagnoses.join(", ")
        : initialDiagnosisNotIcd || symptoms.join(", ") || ""
    );
    setPractitionerName(initialPractitionerName);
    setPractitionerQualification(initialPractitionerQualification);
    setPractitionerRegistration(initialPractitionerRegistration);
  }, [
    initialPatientName,
    initialPatientAge,
    initialPatientSex,
    initialPatientWeight,
    initialCardNo,
    patientId,
    initialRegion,
    initialTown,
    initialWoreda,
    initialKebele,
    initialHouseNo,
    initialTelNo,
    initialIsInpatient,
    initialIsOutpatient,
    initialIsEmergency,
    diagnoses,
    initialDiagnosisNotIcd,
    symptoms,
    initialPractitionerName,
    initialPractitionerQualification,
    initialPractitionerRegistration,
  ]);

  const handlePrint = () => {
    printElementIsolated("prescription-print-area", {
      title: `EEU_Prescription_${cardNo || patientName || "Sheet"}`,
      paperFormat,
    });
  };

  // Keyboard shortcut Ctrl+P / Cmd+P listener
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "p") {
        e.preventDefault();
        handlePrint();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, paperFormat, cardNo, patientName]);

  // Determine if any item is out of stock in hospital dispensary
  const hasOutOfStock =
    isExternalPurchaseSlip ||
    drugRows.some((rx) => rx.in_stock === false || rx.is_out_of_stock === true);

  // Formatted date (DD/MM/YYYY or original)
  const formattedDate = encounterDate
    ? encounterDate.includes("-")
      ? encounterDate.split("-").reverse().join("/")
      : encounterDate
    : new Date().toLocaleDateString("en-GB");

  // Calculate ruled lines needed to fill the authentic pad (in print, avoid spilling onto page 2)
  const emptyLinesCount = isBlankForm
    ? (paperFormat === "A4" ? 8 : 5)
    : Math.max(0, 3 - drugRows.length);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[96vh] overflow-y-auto p-0 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl rounded-xl">
        {/* Dynamic Print Stylesheet scoped to this print session (resets Radix modal positioning traps) */}
        <style dangerouslySetInnerHTML={{
          __html: `
          @media print {
            @page {
              size: ${paperFormat === "A4" ? "A4 portrait" : "A5 portrait"};
              margin: 3mm 5mm;
            }

            html, body {
              width: 100% !important;
              height: 100% !important;
              max-height: 100% !important;
              margin: 0 !important;
              padding: 0 !important;
              overflow: hidden !important;
              background: #FFFFFF !important;
              color: #000000 !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }

            /* Neutralize Radix Dialog Portal and Overlays */
            [data-radix-portal],
            [data-slot="dialog-portal"] {
              position: static !important;
              display: block !important;
              width: 100% !important;
              height: auto !important;
              overflow: visible !important;
              margin: 0 !important;
              padding: 0 !important;
            }

            [data-slot="dialog-overlay"],
            [data-radix-dialog-overlay] {
              display: none !important;
            }

            /* CRITICAL: Eliminate modal's fixed top: 50% and translate-y: -50% which pushes print to bottom half */
            [data-slot="dialog-content"],
            [data-radix-dialog-content],
            [role="dialog"] {
              position: static !important;
              display: block !important;
              top: auto !important;
              left: auto !important;
              right: auto !important;
              bottom: auto !important;
              transform: none !important;
              translate: none !important;
              width: 100% !important;
              max-width: 100% !important;
              height: auto !important;
              max-height: none !important;
              overflow: visible !important;
              margin: 0 !important;
              padding: 0 !important;
              border: none !important;
              box-shadow: none !important;
              background: #FFFFFF !important;
            }

            body * {
              visibility: hidden;
            }

            #prescription-print-area,
            #prescription-print-area * {
              visibility: visible !important;
            }

            #prescription-print-area {
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
              width: 100% !important;
              max-width: 100% !important;
              height: auto !important;
              max-height: 100% !important;
              margin: 0 !important;
              padding: 2mm 3mm !important;
              border: none !important;
              box-shadow: none !important;
              background: #FFFFFF !important;
              color: #000000 !important;
              min-height: auto !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              page-break-inside: avoid !important;
              page-break-after: avoid !important;
              break-inside: avoid !important;
              break-after: avoid !important;
            }
          }
        `}} />

        {/* ── Advanced Print Controls Toolbar (Screen only) ── */}
        <DialogHeader className="print:hidden p-4 sm:p-5 border-b bg-white/95 dark:bg-slate-900/95 backdrop-blur-md sticky top-0 z-20 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <DialogTitle className="flex items-center gap-2.5 text-base font-bold text-slate-800 dark:text-slate-100">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                <Icon icon="solar:printer-bold" size={18} />
              </div>
              <div className="flex flex-col">
                <span className="leading-tight">EEU Medium Clinic Prescription Paper</span>
                <span className="text-[11px] font-normal text-muted-foreground">Standardized authentic Pad & Letterhead Print</span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 ml-1">
                {paperFormat}
              </span>
            </DialogTitle>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditMode(!isEditMode)}
                className="text-xs h-8 gap-1.5"
              >
                <Icon icon={isEditMode ? "solar:eye-bold" : "solar:pen-bold"} size={14} />
                {isEditMode ? "Lock Sheet" : "Edit Details"}
              </Button>
              <Button
                size="sm"
                onClick={handlePrint}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs h-8 gap-1.5 shadow-sm"
              >
                <Icon icon="solar:printer-bold" size={15} />
                Print Prescription Paper
              </Button>
            </div>
          </div>

          {/* Secondary Advanced Options Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-slate-200 dark:border-slate-800 text-xs">
            {/* Format & Mode Toggles */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex rounded-md border border-slate-300 dark:border-slate-700 p-0.5 bg-slate-50 dark:bg-slate-800">
                <button
                  type="button"
                  onClick={() => setPaperFormat("A5")}
                  className={`px-2.5 py-1 text-xs font-semibold rounded transition-colors ${paperFormat === "A5"
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "text-slate-600 dark:text-slate-300 hover:text-slate-900"
                    }`}
                >
                  A5 Pad (Standard)
                </button>
                <button
                  type="button"
                  onClick={() => setPaperFormat("A4")}
                  className={`px-2.5 py-1 text-xs font-semibold rounded transition-colors ${paperFormat === "A4"
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "text-slate-600 dark:text-slate-300 hover:text-slate-900"
                    }`}
                >
                  A4 Full Sheet
                </button>
              </div>

              <Button
                variant={isBlankForm ? "default" : "outline"}
                size="sm"
                onClick={() => setIsBlankForm(!isBlankForm)}
                className="text-xs h-7 gap-1"
              >
                <Icon icon="solar:document-bold" size={13} />
                {isBlankForm ? "Show Filled Drugs" : "Blank Pad Mode"}
              </Button>

              <Button
                variant={showLogo ? "outline" : "secondary"}
                size="sm"
                onClick={() => setShowLogo(!showLogo)}
                className="text-xs h-7 gap-1"
                title="Toggle logo and heading for clinics with pre-printed stationery"
              >
                <Icon icon="solar:gallery-bold" size={13} />
                {showLogo ? "Hide Header Logo" : "Show Header Logo"}
              </Button>

              <Button
                variant={showOfficialSeal ? "default" : "outline"}
                size="sm"
                onClick={() => setShowOfficialSeal(!showOfficialSeal)}
                className={`text-xs h-7 gap-1 ${showOfficialSeal ? "bg-indigo-700 hover:bg-indigo-800 text-white" : ""
                  }`}
              >
                <Icon icon="solar:verified-check-bold" size={13} />
                {showOfficialSeal ? "Official Stamp: ON" : "+ Clinic Stamp"}
              </Button>

              <Button
                variant={isCompact ? "secondary" : "outline"}
                size="sm"
                onClick={() => setIsCompact(!isCompact)}
                className="text-xs h-7 gap-1"
              >
                <Icon icon="solar:minimize-square-bold" size={13} />
                {isCompact ? "Compact Fit" : "Normal Spacing"}
              </Button>
            </div>

            <div className="text-[11px] text-muted-foreground hidden lg:flex items-center gap-1.5">
              <span>Shortcuts:</span>
              <kbd className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-mono font-bold text-[10px]">Ctrl+P</kbd>
            </div>
          </div>
        </DialogHeader>

        {/* ── Preview Desk Environment & Exact Prescription Paper Replica ── */}
        <div className="p-3 sm:p-6 bg-slate-200/50 dark:bg-slate-950 flex justify-center">
          <div
            id="prescription-print-area"
            className={`relative mx-auto w-full ${paperFormat === "A4" ? "max-w-[820px]" : "max-w-[720px]"
              } bg-white text-slate-950 ${isCompact ? "p-4 sm:p-6" : "p-6 sm:p-8"
              } shadow-2xl shadow-slate-400/20 dark:shadow-black/60 border border-slate-300 rounded-lg print:rounded-none font-sans leading-tight print:shadow-none print:border-none print:p-0 print:m-0 print:max-w-full print:min-h-0 print:max-h-full print:overflow-hidden`}
            style={{
              minHeight: paperFormat === "A4" ? "1120px" : "960px",
              color: "#111827",
              WebkitPrintColorAdjust: "exact",
              printColorAdjust: "exact",
            }}
          >
            {/* Header Block: Centered Official Logo + Clinic Info, Right Date */}
            <div className="relative pb-2">
              {/* Top Right Date Line matching photo */}
              <div className="absolute right-0 top-10 sm:top-12 text-[12px] font-normal text-slate-900 flex items-baseline z-10">
                <span className="mr-1">Date</span>
                <span className="inline-block border-b border-slate-900 font-semibold px-2 min-w-[130px] text-center pb-0.5">
                  {formattedDate}
                </span>
              </div>

              {/* Top Center: Official EEU Logo Image - Modern Compact Print Size */}
              <div className="flex flex-col items-center justify-center text-center">
                {showLogo && (
                  <div className="mb-1 flex items-center justify-center">
                    <img
                      src={eeuLogo}
                      alt="Ethiopian Electric Utility Logo"
                      className="w-8 h-8 sm:w-9 sm:h-9 object-contain mx-auto shrink-0 print:w-6 print:h-6 print:max-h-6"
                      style={{
                        printColorAdjust: "exact",
                        WebkitPrintColorAdjust: "exact",
                        maxHeight: "26px",
                      }}
                      onError={(e) => {
                        // Fallback to public root path if module import fails
                        (e.currentTarget as HTMLImageElement).src = "/eeu-logo.png";
                      }}
                    />
                  </div>
                )}

                {/* Institution Identity */}
                <div className="space-y-0.5">
                  <div className="text-[13px] font-bold text-[#D84315] tracking-wide leading-tight">
                    የኢትዮጵያ ኤሌክትሪክ አገልግሎት
                  </div>
                  <div className="text-[13px] font-bold text-[#2E7D32] tracking-wide leading-tight">
                    Ethiopian Electric Utility Medium Clinic
                  </div>
                  <div className="text-[11px] font-medium text-slate-800">
                    Addis Ababa • Tel {clinicPhone}
                  </div>
                </div>

                {/* Main Heading */}
                <h1 className="text-center font-black text-[16.5px] tracking-wider text-slate-950 uppercase mt-2.5 mb-2">
                  PRESCRIPTION PAPER
                </h1>
              </div>
            </div>

            {/* Out of Stock Warning Banner (Screen Preview or Authorized External Slip) */}
            {hasOutOfStock && !isBlankForm && (
              <div className="mb-2.5 p-1.5 bg-amber-50 border border-amber-400 rounded text-[10.5px] text-amber-950 font-medium print:border-slate-800 print:bg-transparent">
                <strong className="font-bold text-amber-900 print:text-black uppercase">External Pharmacy Authorization:</strong> Unstocked medication item(s) are authorized for purchase at licensed community pharmacies.
              </div>
            )}

            {/* ── Patient Demographic Information Grid (Exact replica of photo) ── */}
            <div className="space-y-1.5 text-[11.5px] text-slate-950 font-medium pb-2 border-b border-slate-900">
              {/* Line 1: Patient's full Name */}
              <div className="flex items-baseline">
                <span className="whitespace-nowrap font-normal mr-1.5 text-slate-900">Patient's full Name:</span>
                {isEditMode ? (
                  <input
                    type="text"
                    value={patientName}
                    onChange={(e) => setPatientName(e.target.value)}
                    className="flex-1 border-b border-slate-900 font-bold px-1.5 outline-hidden text-xs py-0.5 bg-yellow-50/50"
                    placeholder="Enter patient full name..."
                  />
                ) : (
                  <span className="flex-1 border-b border-slate-900 font-bold px-2 min-h-[20px] truncate text-[12px]">
                    {!isBlankForm && patientName}
                  </span>
                )}
              </div>

              {/* Line 2: Sex. Age. Weight: Card NO./ID No. */}
              <div className="flex items-baseline gap-2">
                <div className="flex items-baseline w-28">
                  <span className="whitespace-nowrap font-normal mr-1 text-slate-900">Sex.</span>
                  {isEditMode ? (
                    <input
                      type="text"
                      value={patientSex}
                      onChange={(e) => setPatientSex(e.target.value)}
                      className="flex-1 border-b border-slate-900 font-semibold px-1 text-center outline-hidden text-xs py-0.5 bg-yellow-50/50"
                    />
                  ) : (
                    <span className="flex-1 border-b border-slate-900 font-semibold px-1 text-center min-h-[20px]">
                      {!isBlankForm && patientSex}
                    </span>
                  )}
                </div>
                <div className="flex items-baseline w-28">
                  <span className="whitespace-nowrap font-normal mr-1 text-slate-900">Age.</span>
                  {isEditMode ? (
                    <input
                      type="text"
                      value={patientAge}
                      onChange={(e) => setPatientAge(e.target.value)}
                      className="flex-1 border-b border-slate-900 font-semibold px-1 text-center outline-hidden text-xs py-0.5 bg-yellow-50/50"
                    />
                  ) : (
                    <span className="flex-1 border-b border-slate-900 font-semibold px-1 text-center min-h-[20px]">
                      {!isBlankForm && patientAge}
                    </span>
                  )}
                </div>
                <div className="flex items-baseline w-32">
                  <span className="whitespace-nowrap font-normal mr-1 text-slate-900">Weight:</span>
                  {isEditMode ? (
                    <input
                      type="text"
                      value={patientWeight}
                      onChange={(e) => setPatientWeight(e.target.value)}
                      className="flex-1 border-b border-slate-900 font-semibold px-1 text-center outline-hidden text-xs py-0.5 bg-yellow-50/50"
                    />
                  ) : (
                    <span className="flex-1 border-b border-slate-900 font-semibold px-1 text-center min-h-[20px]">
                      {!isBlankForm && patientWeight ? `${patientWeight} kg` : ""}
                    </span>
                  )}
                </div>
                <div className="flex items-baseline flex-1">
                  <span className="whitespace-nowrap font-normal mr-1 text-slate-900">Card NO./ID No.</span>
                  {isEditMode ? (
                    <input
                      type="text"
                      value={cardNo}
                      onChange={(e) => setCardNo(e.target.value)}
                      className="flex-1 border-b border-slate-900 font-semibold px-2 outline-hidden text-xs py-0.5 bg-yellow-50/50"
                    />
                  ) : (
                    <span className="flex-1 border-b border-slate-900 font-semibold px-2 min-h-[20px] truncate">
                      {!isBlankForm && cardNo}
                    </span>
                  )}
                </div>
              </div>

              {/* Line 3: Region: Town Woreda Kebele */}
              <div className="flex items-baseline gap-2">
                <div className="flex items-baseline w-40">
                  <span className="whitespace-nowrap font-normal mr-1 text-slate-900">Region:</span>
                  {isEditMode ? (
                    <input
                      type="text"
                      value={region}
                      onChange={(e) => setRegion(e.target.value)}
                      className="flex-1 border-b border-slate-900 font-semibold px-1 outline-hidden text-xs py-0.5 bg-yellow-50/50"
                    />
                  ) : (
                    <span className="flex-1 border-b border-slate-900 font-semibold px-1 min-h-[20px] truncate">
                      {!isBlankForm && region}
                    </span>
                  )}
                </div>
                <div className="flex items-baseline w-40">
                  <span className="whitespace-nowrap font-normal mr-1 text-slate-900">Town</span>
                  {isEditMode ? (
                    <input
                      type="text"
                      value={town}
                      onChange={(e) => setTown(e.target.value)}
                      className="flex-1 border-b border-slate-900 font-semibold px-1 outline-hidden text-xs py-0.5 bg-yellow-50/50"
                    />
                  ) : (
                    <span className="flex-1 border-b border-slate-900 font-semibold px-1 min-h-[20px] truncate">
                      {!isBlankForm && town}
                    </span>
                  )}
                </div>
                <div className="flex items-baseline w-32">
                  <span className="whitespace-nowrap font-normal mr-1 text-slate-900">Woreda</span>
                  {isEditMode ? (
                    <input
                      type="text"
                      value={woreda}
                      onChange={(e) => setWoreda(e.target.value)}
                      className="flex-1 border-b border-slate-900 font-semibold px-1 outline-hidden text-xs py-0.5 bg-yellow-50/50"
                    />
                  ) : (
                    <span className="flex-1 border-b border-slate-900 font-semibold px-1 min-h-[20px]">
                      {!isBlankForm && woreda}
                    </span>
                  )}
                </div>
                <div className="flex items-baseline flex-1">
                  <span className="whitespace-nowrap font-normal mr-1 text-slate-900">Kebele</span>
                  {isEditMode ? (
                    <input
                      type="text"
                      value={kebele}
                      onChange={(e) => setKebele(e.target.value)}
                      className="flex-1 border-b border-slate-900 font-semibold px-1 outline-hidden text-xs py-0.5 bg-yellow-50/50"
                    />
                  ) : (
                    <span className="flex-1 border-b border-slate-900 font-semibold px-1 min-h-[20px]">
                      {!isBlankForm && kebele}
                    </span>
                  )}
                </div>
              </div>

              {/* Line 4: House No. Tel.No Inpatient [ ] Outpatient [ ] */}
              <div className="flex items-baseline gap-2">
                <div className="flex items-baseline w-40">
                  <span className="whitespace-nowrap font-normal mr-1 text-slate-900">House No.</span>
                  {isEditMode ? (
                    <input
                      type="text"
                      value={houseNo}
                      onChange={(e) => setHouseNo(e.target.value)}
                      className="flex-1 border-b border-slate-900 font-semibold px-1 outline-hidden text-xs py-0.5 bg-yellow-50/50"
                    />
                  ) : (
                    <span className="flex-1 border-b border-slate-900 font-semibold px-1 min-h-[20px]">
                      {!isBlankForm && houseNo}
                    </span>
                  )}
                </div>
                <div className="flex items-baseline flex-1">
                  <span className="whitespace-nowrap font-normal mr-1 text-slate-900">Tel.No</span>
                  {isEditMode ? (
                    <input
                      type="text"
                      value={telNo}
                      onChange={(e) => setTelNo(e.target.value)}
                      className="flex-1 border-b border-slate-900 font-semibold px-1 outline-hidden text-xs py-0.5 bg-yellow-50/50"
                    />
                  ) : (
                    <span className="flex-1 border-b border-slate-900 font-semibold px-1 min-h-[20px]">
                      {!isBlankForm && telNo}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-4 shrink-0 pl-3">
                  <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
                    <span className="font-normal text-slate-900">Inpatient</span>
                    <span
                      onClick={() => {
                        setIsInpatient(!isInpatient);
                        if (!isInpatient) setIsOutpatient(false);
                      }}
                      className="inline-flex items-center justify-center w-4 h-4 border border-slate-900 rounded-xs font-bold text-[11px] leading-none text-slate-950"
                    >
                      {!isBlankForm && isInpatient ? "✓" : ""}
                    </span>
                  </label>
                  <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
                    <span className="font-normal text-slate-900">Outpatient</span>
                    <span
                      onClick={() => {
                        setIsOutpatient(!isOutpatient);
                        if (!isOutpatient) setIsInpatient(false);
                      }}
                      className="inline-flex items-center justify-center w-4 h-4 border border-slate-900 rounded-xs font-bold text-[11px] leading-none text-slate-950"
                    >
                      {!isBlankForm && isOutpatient ? "✓" : ""}
                    </span>
                  </label>
                </div>
              </div>

              {/* Line 5: [ ] Emergency (Box first, then Emergency) */}
              <div className="flex items-center">
                <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
                  <span
                    onClick={() => setIsEmergency(!isEmergency)}
                    className="inline-flex items-center justify-center w-4 h-4 border border-slate-900 rounded-xs font-bold text-[11px] leading-none text-slate-950"
                  >
                    {!isBlankForm && isEmergency ? "✓" : ""}
                  </span>
                  <span className="font-normal text-slate-900">Emergency</span>
                </label>
              </div>

              {/* Line 6: Diagnosis, if not ICD */}
              <div className="flex items-baseline">
                <span className="whitespace-nowrap font-normal mr-1.5 text-slate-900">Diagnosis, if not ICD</span>
                {isEditMode ? (
                  <input
                    type="text"
                    value={diagnosisText}
                    onChange={(e) => setDiagnosisText(e.target.value)}
                    className="flex-1 border-b border-slate-900 font-bold px-2 outline-hidden text-xs py-0.5 bg-yellow-50/50"
                    placeholder="Clinical diagnosis..."
                  />
                ) : (
                  <span className="flex-1 border-b border-slate-900 font-bold px-2 min-h-[20px]">
                    {!isBlankForm && diagnosisText}
                  </span>
                )}
              </div>
            </div>

            {/* ── Prescription Header Instructions & Rx Symbol ── */}
            <div className="pt-2">
              <div className="text-[10px] text-slate-800 font-normal leading-tight tracking-tight">
                <div>Drug Name, strength, Dosage Form, Dose, Frequency, Duration, Quantity,</div>
                <div>Howto use &amp; other information</div>
              </div>
              <div className="text-[34px] font-serif font-black text-slate-950 tracking-wider my-0.5 select-none leading-none">
                Rx
              </div>
            </div>

            {/* ── Prescription Items / Ruled Pad Body ── */}
            <div className={`space-y-3 ${isCompact ? "min-h-[360px]" : "min-h-[440px]"} print:min-h-0 print:space-y-1.5 text-xs pt-1`}>
              {!isBlankForm && drugRows.length > 0 ? (
                drugRows.map((rx, idx) => {
                  const isOutOfStock = rx.in_stock === false || rx.is_out_of_stock === true;
                  return (
                    <div key={idx} className="border-b border-slate-300 pb-2.5 print:pb-1.5">
                      {/* Item Headline */}
                      <div className="flex items-baseline justify-between font-bold text-slate-950">
                        <div className="text-[13px] print:text-[12px] flex items-baseline gap-1.5">
                          <span className="font-mono text-slate-900">{idx + 1}.</span>
                          <span className="uppercase">{rx.drug_name || rx.medication}</span>
                          {rx.dosage_form && (
                            <span className="font-medium text-slate-700 lowercase">
                              ({rx.dosage_form})
                            </span>
                          )}
                        </div>
                        <div className="font-mono font-bold text-slate-950 text-[12.5px] print:text-[11.5px]">
                          {rx.quantity ? `#${rx.quantity}` : ""}
                        </div>
                      </div>

                      {/* Dosage, Duration, Frequency, Drug Code */}
                      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-0.5 text-[11.5px] print:text-[10.5px] text-slate-900 mt-1 print:mt-0.5">
                        {rx.dosage && (
                          <span>
                            <strong className="font-bold text-slate-950">Sig:</strong> {rx.dosage}
                          </span>
                        )}
                        {rx.period && (
                          <span>
                            <strong className="font-bold text-slate-950">Duration:</strong> {rx.period}
                          </span>
                        )}
                        {rx.drug_code && (
                          <span className="text-slate-600 font-mono text-[10.5px] print:text-[9.5px]">
                            [{rx.drug_code}]
                          </span>
                        )}
                        {isOutOfStock && (
                          <span className="font-bold text-red-700 bg-red-50 border border-red-300 px-1 rounded text-[10px] uppercase print:border-black print:text-black">
                            OUT OF STOCK (External Slip)
                          </span>
                        )}
                      </div>

                      {/* Comment / Dosage Form and Strength (Full Multi-line) */}
                      {rx.comment && (
                        <div className="text-[11px] print:text-[10px] text-slate-800 mt-1 print:mt-0.5 pl-2.5 border-l-2 border-slate-500 whitespace-pre-wrap leading-relaxed print:leading-snug font-normal">
                          {rx.comment}
                        </div>
                      )}
                    </div>
                  );
                })
              ) : null}

              {/* Ruled lines filling the authentic prescription pad */}
              {Array.from({ length: emptyLinesCount }).map((_, i) => (
                <div
                  key={`empty-line-${i}`}
                  className={`border-b border-slate-200 h-10 w-full print:h-7 ${!isBlankForm ? "print:hidden" : ""
                    }`}
                ></div>
              ))}
            </div>

            {/* ── Optional Official Verification Stamp ── */}
            {showOfficialSeal && (
              <div className="absolute right-8 bottom-36 opacity-85 rotate-[-12deg] pointer-events-none select-none print:opacity-90">
                <div className="w-28 h-28 border-2 border-dashed border-indigo-700/80 rounded-full flex flex-col items-center justify-center text-center p-2 text-indigo-800 bg-white/40">
                  <span className="text-[7.5px] font-black uppercase tracking-wider">ETHIOPIAN ELECTRIC UTILITY</span>
                  <span className="text-[9.5px] font-black uppercase tracking-widest my-0.5">MEDIUM CLINIC</span>
                  <span className="text-[7px] font-bold text-emerald-700">CLINICALLY VERIFIED</span>
                  <span className="text-[6.5px] font-mono mt-0.5">{formattedDate}</span>
                </div>
              </div>
            )}

            {/* ── Footer: 3 Columns (Prescriber's, Evaluator's, Dispenser's) ── */}
            <div className="pt-4 mt-4 print:pt-2 print:mt-2 border-t-2 border-slate-950 text-[11.5px] print:text-[11px] text-slate-950">
              <div className="grid grid-cols-3 gap-5 items-start">
                {/* Column 1: Prescriber's */}
                <div className="space-y-2 print:space-y-1.5">
                  <div className="font-bold text-slate-950 text-[12px] mb-1">Prescriber's</div>
                  <div className="flex items-baseline">
                    <span className="w-24 shrink-0 font-normal text-slate-900">Full name</span>
                    {isEditMode ? (
                      <input
                        type="text"
                        value={practitionerName}
                        onChange={(e) => setPractitionerName(e.target.value)}
                        className="flex-1 border-b border-slate-900 font-semibold px-1 outline-hidden text-xs py-0.5 bg-yellow-50/50"
                      />
                    ) : (
                      <span className="flex-1 border-b border-slate-900 font-semibold px-1 truncate min-h-[19px]">
                        {!isBlankForm && practitionerName}
                      </span>
                    )}
                  </div>
                  <div className="flex items-baseline">
                    <span className="w-24 shrink-0 font-normal text-slate-900">Qualification</span>
                    {isEditMode ? (
                      <input
                        type="text"
                        value={practitionerQualification}
                        onChange={(e) => setPractitionerQualification(e.target.value)}
                        className="flex-1 border-b border-slate-900 font-medium px-1 outline-hidden text-xs py-0.5 bg-yellow-50/50"
                      />
                    ) : (
                      <span className="flex-1 border-b border-slate-900 font-medium px-1 truncate min-h-[19px]">
                        {!isBlankForm && practitionerQualification}
                      </span>
                    )}
                  </div>
                  <div className="flex items-baseline">
                    <span className="w-24 shrink-0 font-normal text-slate-900">Registration#</span>
                    {isEditMode ? (
                      <input
                        type="text"
                        value={practitionerRegistration}
                        onChange={(e) => setPractitionerRegistration(e.target.value)}
                        className="flex-1 border-b border-slate-900 font-mono px-1 outline-hidden text-xs py-0.5 bg-yellow-50/50"
                      />
                    ) : (
                      <span className="flex-1 border-b border-slate-900 font-mono px-1 truncate min-h-[19px]">
                        {!isBlankForm && practitionerRegistration}
                      </span>
                    )}
                  </div>
                  <div className="flex items-baseline">
                    <span className="w-24 shrink-0 font-normal text-slate-900">Signature</span>
                    <span className="flex-1 border-b border-slate-900 min-h-[19px]"></span>
                  </div>
                </div>

                {/* Column 2: Evaluator's (Header + 4 Clean Underlines) */}
                <div className="space-y-2 print:space-y-1.5">
                  <div className="font-bold text-slate-950 text-[12px] mb-1">Evaluator's</div>
                  <div className="flex items-baseline">
                    <span className="flex-1 border-b border-slate-900 min-h-[19px]"></span>
                  </div>
                  <div className="flex items-baseline">
                    <span className="flex-1 border-b border-slate-900 min-h-[19px]"></span>
                  </div>
                  <div className="flex items-baseline">
                    <span className="flex-1 border-b border-slate-900 min-h-[19px]"></span>
                  </div>
                  <div className="flex items-baseline">
                    <span className="flex-1 border-b border-slate-900 min-h-[19px]"></span>
                  </div>
                </div>

                {/* Column 3: Dispenser's (Header + 4 Clean Underlines) */}
                <div className="space-y-2 print:space-y-1.5">
                  <div className="font-bold text-slate-950 text-[12px] mb-1">Dispenser's</div>
                  <div className="flex items-baseline">
                    <span className="flex-1 border-b border-slate-900 min-h-[19px]"></span>
                  </div>
                  <div className="flex items-baseline">
                    <span className="flex-1 border-b border-slate-900 min-h-[19px]"></span>
                  </div>
                  <div className="flex items-baseline">
                    <span className="flex-1 border-b border-slate-900 min-h-[19px]"></span>
                  </div>
                  <div className="flex items-baseline">
                    <span className="flex-1 border-b border-slate-900 min-h-[19px]"></span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Action Buttons (Hidden when printing) */}
        <div className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 border-t print:hidden sticky bottom-0 z-10">
          <div className="text-xs text-muted-foreground flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            {isBlankForm
              ? "Previewing empty prescription pad sheet."
              : `Previewing prescription with ${drugRows.length} item(s).`}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <Button
              size="sm"
              onClick={handlePrint}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs gap-1.5 shadow-sm"
            >
              <Icon icon="solar:printer-bold" size={16} />
              Print Prescription Paper
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
