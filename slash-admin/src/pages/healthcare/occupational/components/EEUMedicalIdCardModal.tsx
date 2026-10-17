import React, { useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/ui/dialog";
import { Button } from "@/ui/button";
import { Badge } from "@/ui/badge";
import { Icon } from "@/components/icon";
import Avatar from "@/components/Avatar";
import { QRCodeSVG } from "qrcode.react";
import eeuLogoImg from "@/assets/images/eeu-logo.png";
import type { Patient } from "@/api/services/healthcareService";
import { cn } from "@/utils";

interface EEUMedicalIdCardModalProps {
  patient: Patient | null;
  open: boolean;
  onClose: () => void;
}

export default function EEUMedicalIdCardModal({
  patient,
  open,
  onClose,
}: EEUMedicalIdCardModalProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  if (!patient) return null;

  const isEEFC = Boolean(
    (patient.company_affiliation || "").includes("EEFC") ||
    (patient.company_affiliation || "").includes("Football") ||
    (patient.eeu_staff_id || "").startsWith("EEFC")
  );
  const isRetired = Boolean(
    (patient.company_affiliation || "").includes("Retired") ||
    (patient.eeu_staff_id || "").startsWith("RET")
  );
  const isOthers = Boolean(
    (patient.company_affiliation || "").includes("Other") ||
    (patient.company_affiliation || "").includes("Contractor") ||
    (patient.eeu_staff_id || "").startsWith("others")
  );

  const ceiling = patient.eeu_annual_benefit_ceiling_etb || 25000;
  const used = patient.eeu_benefit_used_etb || 0;
  const remaining = Math.max(0, ceiling - used);
  const pct = Math.min(100, Math.round((used / ceiling) * 100));

  const qrData = JSON.stringify({
    issuer: isEEFC ? "EEFC-HEALTH-SERVICES" : isRetired ? "RET-HEALTH-SERVICES" : isOthers ? "OTHERS-HEALTH-SERVICES" : "EEU-HEALTH-SERVICES",
    company: isEEFC ? "Ethiopian Electric Football club (EEFC)" : isRetired ? "Retired Employee" : isOthers ? "Others" : "Ethiopian Electric Utility (EEU)",
    pid: patient.patient_id || `PAT-${patient.id}`,
    staff_id: patient.eeu_staff_id || "N/A",
    name: patient.patient_name,
    beneficiary_type: patient.eeu_beneficiary_type || (isOthers ? "Affiliated Personnel" : "Staff"),
    coverage_status: patient.eeu_medical_coverage_status || "Active Coverage",
    benefit_remaining_etb: remaining,
    ceiling_etb: ceiling,
    verified_at: new Date().toISOString(),
  });

  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className={cn("max-w-xl p-0 overflow-hidden", isEEFC ? "border-blue-500/30" : isRetired ? "border-purple-500/30" : isOthers ? "border-amber-500/30" : "border-emerald-500/30")}>
        <DialogHeader className="p-4 bg-muted/20 border-b">
          <div className="flex items-center gap-2">
            <div className={cn("p-1.5 rounded-lg", isEEFC ? "bg-blue-500/10 text-blue-600" : isRetired ? "bg-purple-500/10 text-purple-600" : isOthers ? "bg-amber-500/10 text-amber-600" : "bg-emerald-500/10 text-emerald-600")}>
              <Icon icon={isEEFC ? "solar:football-bold-duotone" : isRetired ? "solar:user-heart-bold-duotone" : isOthers ? "solar:users-group-two-rounded-bold-duotone" : "solar:user-id-bold-duotone"} size={20} />
            </div>
            <div>
              <DialogTitle className="text-sm font-bold text-foreground">
                {isEEFC ? "Digital EEFC Medical ID Card & Verification QR" : isRetired ? "Digital Retiree Medical ID Card & Verification QR" : isOthers ? "Digital Affiliate Medical ID Card & Verification QR" : "Digital EEU Medical ID Card & Verification QR"}
              </DialogTitle>
              <DialogDescription className="text-xs">
                {isEEFC
                  ? "Official electronic healthcare identification badge for Ethiopian Electric Football Club"
                  : isRetired
                  ? "Official electronic healthcare identification badge for retired enterprise personnel"
                  : isOthers
                  ? "Official healthcare identification badge for affiliated personnel"
                  : "Official electronic healthcare identification badge for Ethiopian Electric Utility medical facilities"}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-6 space-y-4">
          {/* ── Printable Badge Container (CR80 Standard Ratio) ── */}
          <div
            ref={cardRef}
            className={cn(
              "relative mx-auto w-full max-w-md overflow-hidden rounded-2xl border-2 p-5 text-white shadow-xl ring-1 ring-white/10 print:border-2 print:border-black print:bg-white print:text-black print:shadow-none",
              isEEFC
                ? "border-blue-500/40 bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950"
                : isRetired
                ? "border-purple-500/40 bg-gradient-to-br from-slate-950 via-slate-900 to-purple-950"
                : isOthers
                ? "border-amber-500/40 bg-gradient-to-br from-slate-950 via-slate-900 to-amber-950"
                : "border-emerald-600/40 bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950"
            )}
          >
            {/* Top decorative electric grid watermark */}
            <div className={cn("absolute -top-12 -right-12 h-36 w-36 rounded-full blur-2xl pointer-events-none", isEEFC ? "bg-blue-500/15" : isRetired ? "bg-purple-500/15" : isOthers ? "bg-amber-500/15" : "bg-emerald-500/10")} />
            <div className="absolute -bottom-10 -left-10 h-32 w-32 rounded-full bg-amber-500/10 blur-xl pointer-events-none" />

            {/* Header: Company Logo + Directorate Title */}
            <div className="flex items-center justify-between border-b border-white/15 pb-3 print:border-black/30">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 p-1.5 ring-1 ring-white/20 print:bg-transparent print:ring-0">
                  <img src={eeuLogoImg} alt="Corporate Logo" className="h-full w-full object-contain" />
                </div>
                <div>
                  <div className={cn("text-[11px] font-extrabold tracking-wider uppercase print:text-black", isEEFC ? "text-blue-400" : isRetired ? "text-purple-400" : isOthers ? "text-amber-400" : "text-emerald-400")}>
                    {isEEFC ? "Ethiopian Electric Football Club" : isRetired ? "Retired Staff Scheme" : isOthers ? "Affiliated Personnel" : "Ethiopian Electric Utility"}
                  </div>
                  <div className="text-[10px] font-bold text-slate-200 print:text-gray-700 tracking-tight">
                    {isEEFC ? "Football Club Athletics & Sports Directorate" : isRetired ? "Pension & Retired Personnel Directorate" : isOthers ? "External Entity Operations" : "Health Services Directorate"}
                  </div>
                  <div className="text-[8px] text-slate-400 print:text-gray-500 tracking-wider uppercase">
                    Official Beneficiary Medical Card
                  </div>
                </div>
              </div>

              <div className="text-right">
                <span className={cn(
                  "inline-block rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ring-1",
                  isEEFC
                    ? "bg-blue-500/20 text-blue-300 ring-blue-500/40 print:text-blue-900"
                    : isRetired
                    ? "bg-purple-500/20 text-purple-300 ring-purple-500/40 print:text-purple-900"
                    : isOthers
                    ? "bg-amber-500/20 text-amber-300 ring-amber-500/40 print:text-amber-900"
                    : "bg-emerald-500/20 text-emerald-300 ring-emerald-500/40 print:text-emerald-900"
                )}>
                  {patient.eeu_medical_coverage_status || "Active"}
                </span>
                <div className="mt-1 font-mono text-[9px] text-slate-400 print:text-gray-600">
                  ID: {patient.eeu_staff_id || patient.patient_id}
                </div>
              </div>
            </div>

            {/* Card Body: Photo, Info, and Live QR Code */}
            <div className="mt-4 flex items-center justify-between gap-4">
              {/* Photo & Details */}
              <div className="flex items-start gap-3">
                <Avatar
                  name={patient.patient_name}
                  size="xl"
                  className={cn("shrink-0 ring-2 shadow-md print:ring-black", isEEFC ? "ring-blue-500/50" : isRetired ? "ring-purple-500/50" : isOthers ? "ring-amber-500/50" : "ring-emerald-500/50")}
                />
                <div className="space-y-1">
                  <div className="text-base font-extrabold tracking-tight text-white print:text-black">
                    {patient.patient_name}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                    <span className={cn("font-semibold print:text-black", isEEFC ? "text-blue-300" : isRetired ? "text-purple-300" : isOthers ? "text-amber-300" : "text-emerald-300")}>
                      {patient.eeu_beneficiary_type || (isEEFC ? "EEFC Primary Athlete" : isRetired ? "Retired Primary Member" : isOthers ? "Affiliated Personnel" : "EEU Primary Staff")}
                    </span>
                    <span className="text-slate-400 print:text-gray-500">•</span>
                    <span className="text-slate-300 print:text-gray-700 font-mono">
                      {patient.sex} • {patient.age || "Adult"} yrs
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-300 print:text-gray-700">
                    <span className="font-semibold text-white print:text-black">Role: </span>
                    {patient.eeu_cadre || patient.occupation || (isEEFC ? "EEFC Athlete" : isRetired ? "Retired Staff" : isOthers ? "Affiliate" : "EEU Personnel")}
                  </div>
                  <div className="text-[10px] text-slate-300 print:text-gray-700">
                    <span className="font-semibold text-white print:text-black">Unit: </span>
                    {patient.eeu_department || (isEEFC ? "Football Club" : isRetired ? "Pension Directorate" : isOthers ? "External Entity" : "Operations")} • {patient.eeu_work_station || patient.eeu_region}
                  </div>
                  {patient.eeu_primary_staff_id && (
                    <div className="text-[9px] font-mono text-slate-400 print:text-gray-500">
                      Sponsor Staff: {patient.eeu_primary_staff_id}
                    </div>
                  )}
                </div>
              </div>

              {/* Scannable Verification QR Code */}
              <div className="flex flex-col items-center justify-center shrink-0 rounded-xl bg-white p-2 shadow-inner ring-1 ring-white/20 print:ring-black">
                <QRCodeSVG
                  value={qrData}
                  size={84}
                  level="M"
                  includeMargin={false}
                />
                <span className="mt-1 text-[7.5px] font-mono font-bold tracking-tight text-slate-900">
                  SCAN TO VERIFY
                </span>
              </div>
            </div>

            {/* Benefit Balance & Status Footer */}
            <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-2.5 backdrop-blur-xs print:border-black/20 print:bg-gray-100">
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-slate-300 print:text-gray-700 font-medium">
                  Annual Benefit Allowance:
                </span>
                <span className="font-mono font-bold text-white print:text-black">
                  ETB {remaining.toLocaleString()} Available / {ceiling.toLocaleString()} ETB Ceiling
                </span>
              </div>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/10 print:bg-gray-300">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    pct >= 85 ? "bg-rose-500" : pct >= 60 ? "bg-amber-400" : isEEFC ? "bg-blue-400" : isRetired ? "bg-purple-400" : isOthers ? "bg-amber-400" : "bg-emerald-400"
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="mt-1 flex items-center justify-between text-[8.5px] text-slate-400 print:text-gray-600">
                <span>{isEEFC ? "EEFC Medical Coverage Fiscal Year 2026/27" : isRetired ? "Retiree Scheme Fiscal Year 2026/27" : isOthers ? "Affiliate Scheme Fiscal Year 2026/27" : "EEU Health Scheme Fiscal Year 2026/27"}</span>
                <span>{pct}% Quota Utilized</span>
              </div>
            </div>
          </div>

          <div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground space-y-1">
            <div className="font-semibold text-foreground flex items-center gap-1.5">
              <Icon icon="solar:shield-check-bold" size={15} className="text-emerald-600" />
              Medical Provider Instructions
            </div>
            <p className="text-[11px] leading-relaxed">
              Present this card at any EEU Substation Health Clinic, Central Hospital, or authorized partner provider. Scan the QR code to verify active employment and real-time remaining financial benefit balance.
            </p>
          </div>
        </div>

        <DialogFooter className="p-4 bg-muted/20 border-t gap-2 sm:gap-0">
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
          <Button
            size="sm"
            onClick={handlePrint}
            className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-500 font-semibold"
          >
            <Icon icon="solar:printer-bold" size={15} />
            Print / Save Badge
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
