import React from "react";
import eeuLogo from "@/assets/images/eeu-logo.png";

export interface LeaveOrTransferSlipSheetProps {
  employeeName?: string;
  age?: string | number;
  sex?: string;
  cardNo?: string;
  date?: string;
  diagnosis?: string;
  treatmentGiven?: string;
  adviseToPatient?: string;
  recommendations?: string;
  physicianName?: string;
  clinicName?: string;
  clinicPhone?: string;
  paperFormat?: "A5" | "A4";
  showLogo?: boolean;
  showOfficialSeal?: boolean;
  isCompact?: boolean;
  isBlankPad?: boolean;
  isEditable?: boolean;
  onFieldChange?: (field: string, value: string) => void;
}

export default function LeaveOrTransferSlipSheet({
  employeeName = "",
  age = "",
  sex = "",
  cardNo = "",
  date = new Date().toISOString().split("T")[0],
  diagnosis = "",
  treatmentGiven = "",
  adviseToPatient = "",
  recommendations = "",
  physicianName = "",
  clinicName = "Ethiopian Electric Utility Medium Clinic",
  clinicPhone = "+251115157103",
  paperFormat = "A5",
  showLogo = true,
  showOfficialSeal = false,
  isCompact = false,
  isBlankPad = false,
  isEditable = false,
  onFieldChange,
}: LeaveOrTransferSlipSheetProps) {
  // Format date DD/MM/YYYY or original
  const formattedDate = date
    ? date.includes("-")
      ? date.split("-").reverse().join("/")
      : date
    : new Date().toLocaleDateString("en-GB");

  // Helper to split multi-line text into lines
  const splitIntoLines = (text: string, expectedLines: number) => {
    if (!text || isBlankPad) return Array(expectedLines).fill("");
    const lines = text.split("\n");
    while (lines.length < expectedLines) {
      lines.push("");
    }
    return lines.slice(0, expectedLines);
  };

  const diagnosisLines = splitIntoLines(diagnosis, 2);
  const treatmentLines = splitIntoLines(treatmentGiven, 2);
  const adviseLines = splitIntoLines(adviseToPatient, 2);
  const recommendationLines = splitIntoLines(recommendations, 4);

  return (
    <div
      id="medical-leave-print-area"
      className={`relative mx-auto w-full ${
        paperFormat === "A4" ? "max-w-[820px]" : "max-w-[720px]"
      } bg-white text-slate-950 ${
        isCompact ? "p-4 sm:p-6" : "p-6 sm:p-8"
      } shadow-md border border-slate-300 font-sans leading-tight print:shadow-none print:border-none print:p-0 print:m-0 print:max-w-full`}
      style={{
        minHeight: paperFormat === "A4" ? "1120px" : "960px",
        color: "#111827",
        WebkitPrintColorAdjust: "exact",
        printColorAdjust: "exact",
      }}
    >
      {/* Dynamic Print Stylesheet scoped to Leave or Transfer Slip print area */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page {
            size: ${paperFormat === "A4" ? "A4 portrait" : "A5 portrait"};
            margin: 4mm 6mm;
          }
          body * {
            visibility: hidden;
          }
          #medical-leave-print-area,
          #medical-leave-print-area * {
            visibility: visible;
          }
          #medical-leave-print-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            box-shadow: none !important;
            background: #FFFFFF !important;
            color: #000000 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
      `}} />

      {/* ── Top Header: Centered Official Logo + Clinic Info + Underlined Title ── */}
      <div className="flex flex-col items-center justify-center text-center pb-2">
        {/* Official EEU Logo Image from Attached File */}
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

        {/* Underlined Document Title: Leave or Transfer Slip */}
        <div className="mt-2.5">
          <span className="font-bold text-[16px] text-slate-950 underline decoration-slate-900 underline-offset-4 tracking-wide">
            Leave or Transfer Slip
          </span>
        </div>
      </div>

      {/* ── Date Line: Aligned to the right ── */}
      <div className="flex justify-end text-[12px] font-normal text-slate-900 mt-2 mb-4">
        <div className="flex items-baseline">
          <span className="mr-1">Date</span>
          {isEditable ? (
            <input
              type="text"
              value={formattedDate}
              onChange={(e) => onFieldChange?.("date", e.target.value)}
              className="border-b border-slate-900 font-semibold px-2 min-w-[140px] text-center outline-hidden text-xs py-0.5 bg-yellow-50/50"
            />
          ) : (
            <span className="inline-block border-b border-slate-900 font-semibold px-2 min-w-[140px] text-center pb-0.5 min-h-[20px]">
              {!isBlankPad && formattedDate}
            </span>
          )}
        </div>
      </div>

      {/* ── Form Fields Matching the Photo ── */}
      <div className={`space-y-${isCompact ? "3" : "4"} text-[12px] text-slate-950 font-normal`}>
        {/* Line 1: Name of Employee: */}
        <div className="flex items-baseline">
          <span className="whitespace-nowrap font-normal mr-1.5 text-slate-900 text-[12px]">
            Name of Employee:
          </span>
          {isEditable ? (
            <input
              type="text"
              value={employeeName}
              onChange={(e) => onFieldChange?.("employeeName", e.target.value)}
              className="flex-1 border-b border-slate-900 font-bold px-2 outline-hidden text-xs py-0.5 bg-yellow-50/50"
              placeholder="Enter employee name..."
            />
          ) : (
            <span className="flex-1 border-b border-slate-900 font-bold px-2 min-h-[22px] text-[12.5px] truncate">
              {!isBlankPad && employeeName}
            </span>
          )}
        </div>

        {/* Line 2: Age. Sex. Card NO. /ID No. */}
        <div className="flex items-baseline gap-2">
          <div className="flex items-baseline w-32">
            <span className="whitespace-nowrap font-normal mr-1 text-slate-900 text-[12px]">Age.</span>
            {isEditable ? (
              <input
                type="text"
                value={age}
                onChange={(e) => onFieldChange?.("age", e.target.value)}
                className="flex-1 border-b border-slate-900 font-semibold px-1 text-center outline-hidden text-xs py-0.5 bg-yellow-50/50"
              />
            ) : (
              <span className="flex-1 border-b border-slate-900 font-semibold px-1 text-center min-h-[22px] text-[12px]">
                {!isBlankPad && age}
              </span>
            )}
          </div>
          <div className="flex items-baseline w-32">
            <span className="whitespace-nowrap font-normal mr-1 text-slate-900 text-[12px]">Sex.</span>
            {isEditable ? (
              <input
                type="text"
                value={sex}
                onChange={(e) => onFieldChange?.("sex", e.target.value)}
                className="flex-1 border-b border-slate-900 font-semibold px-1 text-center outline-hidden text-xs py-0.5 bg-yellow-50/50"
              />
            ) : (
              <span className="flex-1 border-b border-slate-900 font-semibold px-1 text-center min-h-[22px] text-[12px]">
                {!isBlankPad && sex}
              </span>
            )}
          </div>
          <div className="flex items-baseline flex-1">
            <span className="whitespace-nowrap font-normal mr-1 text-slate-900 text-[12px]">
              Card NO. /ID No.
            </span>
            {isEditable ? (
              <input
                type="text"
                value={cardNo}
                onChange={(e) => onFieldChange?.("cardNo", e.target.value)}
                className="flex-1 border-b border-slate-900 font-semibold px-2 outline-hidden text-xs py-0.5 bg-yellow-50/50"
              />
            ) : (
              <span className="flex-1 border-b border-slate-900 font-semibold px-2 min-h-[22px] text-[12px] truncate">
                {!isBlankPad && cardNo}
              </span>
            )}
          </div>
        </div>

        {/* Section 3: DIAGNOSIS: (2 Underlines) */}
        <div className="space-y-1.5 pt-1">
          <div className="flex items-baseline">
            <span className="whitespace-nowrap font-bold mr-1.5 text-slate-950 text-[12px] uppercase">
              DIAGNOSIS:
            </span>
            {isEditable ? (
              <input
                type="text"
                value={diagnosisLines[0]}
                onChange={(e) => {
                  const newLines = [...diagnosisLines];
                  newLines[0] = e.target.value;
                  onFieldChange?.("diagnosis", newLines.join("\n").trim());
                }}
                className="flex-1 border-b border-slate-900 font-bold px-2 outline-hidden text-xs py-0.5 bg-yellow-50/50"
                placeholder="Clinical diagnosis..."
              />
            ) : (
              <span className="flex-1 border-b border-slate-900 font-bold px-2 min-h-[22px] text-[12px]">
                {!isBlankPad && diagnosisLines[0]}
              </span>
            )}
          </div>
          <div className="flex items-baseline">
            {isEditable ? (
              <input
                type="text"
                value={diagnosisLines[1]}
                onChange={(e) => {
                  const newLines = [...diagnosisLines];
                  newLines[1] = e.target.value;
                  onFieldChange?.("diagnosis", newLines.join("\n").trim());
                }}
                className="flex-1 border-b border-slate-900 font-bold px-2 outline-hidden text-xs py-0.5 bg-yellow-50/50"
              />
            ) : (
              <span className="flex-1 border-b border-slate-900 font-bold px-2 min-h-[22px] text-[12px]">
                {!isBlankPad && diagnosisLines[1]}
              </span>
            )}
          </div>
        </div>

        {/* Section 4: TREATMENT GIVEN (2 Underlines, no colon in photo) */}
        <div className="space-y-1.5 pt-1">
          <div className="flex items-baseline">
            <span className="whitespace-nowrap font-bold mr-1.5 text-slate-950 text-[12px] uppercase">
              TREATMENT GIVEN
            </span>
            {isEditable ? (
              <input
                type="text"
                value={treatmentLines[0]}
                onChange={(e) => {
                  const newLines = [...treatmentLines];
                  newLines[0] = e.target.value;
                  onFieldChange?.("treatmentGiven", newLines.join("\n").trim());
                }}
                className="flex-1 border-b border-slate-900 font-medium px-2 outline-hidden text-xs py-0.5 bg-yellow-50/50"
                placeholder="Medications prescribed / therapy administered..."
              />
            ) : (
              <span className="flex-1 border-b border-slate-900 font-medium px-2 min-h-[22px] text-[12px]">
                {!isBlankPad && treatmentLines[0]}
              </span>
            )}
          </div>
          <div className="flex items-baseline">
            {isEditable ? (
              <input
                type="text"
                value={treatmentLines[1]}
                onChange={(e) => {
                  const newLines = [...treatmentLines];
                  newLines[1] = e.target.value;
                  onFieldChange?.("treatmentGiven", newLines.join("\n").trim());
                }}
                className="flex-1 border-b border-slate-900 font-medium px-2 outline-hidden text-xs py-0.5 bg-yellow-50/50"
              />
            ) : (
              <span className="flex-1 border-b border-slate-900 font-medium px-2 min-h-[22px] text-[12px]">
                {!isBlankPad && treatmentLines[1]}
              </span>
            )}
          </div>
        </div>

        {/* Section 5: ADVISE TO PATIENT: (2 Underlines) */}
        <div className="space-y-1.5 pt-1">
          <div className="flex items-baseline">
            <span className="whitespace-nowrap font-bold mr-1.5 text-slate-950 text-[12px] uppercase">
              ADVISE TO PATIENT:
            </span>
            {isEditable ? (
              <input
                type="text"
                value={adviseLines[0]}
                onChange={(e) => {
                  const newLines = [...adviseLines];
                  newLines[0] = e.target.value;
                  onFieldChange?.("adviseToPatient", newLines.join("\n").trim());
                }}
                className="flex-1 border-b border-slate-900 font-medium px-2 outline-hidden text-xs py-0.5 bg-yellow-50/50"
                placeholder="Doctor's advice to patient..."
              />
            ) : (
              <span className="flex-1 border-b border-slate-900 font-medium px-2 min-h-[22px] text-[12px]">
                {!isBlankPad && adviseLines[0]}
              </span>
            )}
          </div>
          <div className="flex items-baseline">
            {isEditable ? (
              <input
                type="text"
                value={adviseLines[1]}
                onChange={(e) => {
                  const newLines = [...adviseLines];
                  newLines[1] = e.target.value;
                  onFieldChange?.("adviseToPatient", newLines.join("\n").trim());
                }}
                className="flex-1 border-b border-slate-900 font-medium px-2 outline-hidden text-xs py-0.5 bg-yellow-50/50"
              />
            ) : (
              <span className="flex-1 border-b border-slate-900 font-medium px-2 min-h-[22px] text-[12px]">
                {!isBlankPad && adviseLines[1]}
              </span>
            )}
          </div>
        </div>

        {/* Section 6: RECOMMENDATIONS: (4 Underlines) */}
        <div className="space-y-1.5 pt-1">
          <div className="flex items-baseline">
            <span className="whitespace-nowrap font-bold mr-1.5 text-slate-950 text-[12px] uppercase">
              RECOMMENDATIONS:
            </span>
            {isEditable ? (
              <input
                type="text"
                value={recommendationLines[0]}
                onChange={(e) => {
                  const newLines = [...recommendationLines];
                  newLines[0] = e.target.value;
                  onFieldChange?.("recommendations", newLines.join("\n").trim());
                }}
                className="flex-1 border-b border-slate-900 font-bold px-2 outline-hidden text-xs py-0.5 bg-yellow-50/50"
                placeholder="e.g. Granted 3 days sick leave from ... to ..."
              />
            ) : (
              <span className="flex-1 border-b border-slate-900 font-bold px-2 min-h-[22px] text-[12px]">
                {!isBlankPad && recommendationLines[0]}
              </span>
            )}
          </div>
          <div className="flex items-baseline">
            {isEditable ? (
              <input
                type="text"
                value={recommendationLines[1]}
                onChange={(e) => {
                  const newLines = [...recommendationLines];
                  newLines[1] = e.target.value;
                  onFieldChange?.("recommendations", newLines.join("\n").trim());
                }}
                className="flex-1 border-b border-slate-900 font-medium px-2 outline-hidden text-xs py-0.5 bg-yellow-50/50"
              />
            ) : (
              <span className="flex-1 border-b border-slate-900 font-medium px-2 min-h-[22px] text-[12px]">
                {!isBlankPad && recommendationLines[1]}
              </span>
            )}
          </div>
          <div className="flex items-baseline">
            {isEditable ? (
              <input
                type="text"
                value={recommendationLines[2]}
                onChange={(e) => {
                  const newLines = [...recommendationLines];
                  newLines[2] = e.target.value;
                  onFieldChange?.("recommendations", newLines.join("\n").trim());
                }}
                className="flex-1 border-b border-slate-900 font-medium px-2 outline-hidden text-xs py-0.5 bg-yellow-50/50"
              />
            ) : (
              <span className="flex-1 border-b border-slate-900 font-medium px-2 min-h-[22px] text-[12px]">
                {!isBlankPad && recommendationLines[2]}
              </span>
            )}
          </div>
          <div className="flex items-baseline">
            {isEditable ? (
              <input
                type="text"
                value={recommendationLines[3]}
                onChange={(e) => {
                  const newLines = [...recommendationLines];
                  newLines[3] = e.target.value;
                  onFieldChange?.("recommendations", newLines.join("\n").trim());
                }}
                className="flex-1 border-b border-slate-900 font-medium px-2 outline-hidden text-xs py-0.5 bg-yellow-50/50"
              />
            ) : (
              <span className="flex-1 border-b border-slate-900 font-medium px-2 min-h-[22px] text-[12px]">
                {!isBlankPad && recommendationLines[3]}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Ruled Spacer Lines to Maintain Authentic Pad Proportions ── */}
      <div className={`space-y-3.5 ${isCompact ? "my-3" : "my-5"}`}>
        <div className="border-b border-slate-200 h-5 w-full"></div>
        <div className="border-b border-slate-200 h-5 w-full"></div>
      </div>

      {/* ── Optional Official Verification Stamp ── */}
      {showOfficialSeal && (
        <div className="absolute right-8 bottom-32 opacity-85 rotate-[-12deg] pointer-events-none select-none print:opacity-90">
          <div className="w-28 h-28 border-2 border-dashed border-indigo-700/80 rounded-full flex flex-col items-center justify-center text-center p-2 text-indigo-800 bg-white/40">
            <span className="text-[7.5px] font-black uppercase tracking-wider">ETHIOPIAN ELECTRIC UTILITY</span>
            <span className="text-[9.5px] font-black uppercase tracking-widest my-0.5">MEDIUM CLINIC</span>
            <span className="text-[7px] font-bold text-emerald-700">CLINICALLY VERIFIED</span>
            <span className="text-[6.5px] font-mono mt-0.5">{formattedDate}</span>
          </div>
        </div>
      )}

      {/* ── Bottom Right: PHYSICIAN, SIGNATURE ── */}
      <div className="pt-3 mt-4">
        <div className="flex items-end justify-between">
          {/* Empty left side */}
          <div className="flex-1"></div>

          {/* Right Signature Lines */}
          <div className="space-y-4 shrink-0 w-full sm:w-[320px]">
            <div className="flex items-baseline">
              <span className="w-24 shrink-0 font-bold text-slate-950 text-[12px] uppercase">
                PHYSICIAN:
              </span>
              {isEditable ? (
                <input
                  type="text"
                  value={physicianName}
                  onChange={(e) => onFieldChange?.("physicianName", e.target.value)}
                  className="flex-1 border-b border-slate-900 font-semibold px-1 outline-hidden text-xs py-0.5 bg-yellow-50/50"
                />
              ) : (
                <span className="flex-1 border-b border-slate-900 font-semibold px-1 min-h-[20px] text-[12px] truncate">
                  {!isBlankPad && physicianName}
                </span>
              )}
            </div>
            <div className="flex items-baseline">
              <span className="w-24 shrink-0 font-bold text-slate-950 text-[12px] uppercase">
                SIGNATURE:
              </span>
              <span className="flex-1 border-b border-slate-900 min-h-[20px]"></span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
