import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/ui/dialog";
import { Button } from "@/ui/button";
import { Icon } from "@/components/icon";

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
}

interface PrescriptionPrintModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientName: string;
  patientAge?: string | number;
  patientSex?: string;
  patientId?: string | number;
  practitionerName?: string;
  departmentName?: string;
  encounterDate?: string;
  diagnoses?: string[];
  symptoms?: string[];
  drugRows: PrintableDrugItem[];
  companyName?: string;
  isExternalPurchaseSlip?: boolean;
}

export default function PrescriptionPrintModal({
  open,
  onOpenChange,
  patientName,
  patientAge,
  patientSex,
  patientId,
  practitionerName = "Attending Physician",
  departmentName,
  encounterDate = new Date().toISOString().split("T")[0],
  diagnoses = [],
  symptoms = [],
  drugRows = [],
  companyName = "Healthcare Center & Hospital",
  isExternalPurchaseSlip = false,
}: PrescriptionPrintModalProps) {
  const handlePrint = () => {
    window.print();
  };

  // Determine if any item is out of stock in the hospital pharmacy
  const hasOutOfStock =
    isExternalPurchaseSlip ||
    drugRows.some((rx) => rx.in_stock === false || rx.is_out_of_stock === true);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="print:hidden">
          <DialogTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Icon icon="solar:printer-bold" size={20} className="text-blue-600" />
              {hasOutOfStock ? "Out-of-Stock Prescription Slip" : "Prescription Preview"}
            </span>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={handlePrint} className="bg-blue-600 hover:bg-blue-700">
                <Icon icon="solar:printer-bold" size={16} className="mr-1" />
                Print {hasOutOfStock ? "Rx Slip" : "Prescription"}
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>

        {/* Printable Prescription Body */}
        <div
          id="prescription-print-area"
          className="p-8 bg-white text-slate-900 space-y-6 border rounded-lg shadow-sm print:shadow-none print:border-none print:p-0"
        >
          {/* Header */}
          <div className="border-b-2 border-slate-900 pb-4 flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900 uppercase">
                {companyName}
              </h1>
              <p className="text-xs text-slate-600 font-medium">
                Clinical Services & Hospital Pharmacy Department
              </p>
              {departmentName && (
                <p className="text-xs font-semibold text-slate-700 mt-0.5">
                  Department: {departmentName}
                </p>
              )}
            </div>
            <div className="text-right text-xs text-slate-700 space-y-1">
              <div>
                <span className="font-bold">Prescriber:</span> {practitionerName}
              </div>
              <div>
                <span className="font-bold">Date:</span> {encounterDate}
              </div>
              {patientId && (
                <div>
                  <span className="font-bold">Patient ID:</span> #{patientId}
                </div>
              )}
            </div>
          </div>

          {/* Out of stock official notice banner */}
          {hasOutOfStock && (
            <div className="bg-amber-50 border-2 border-amber-500/80 rounded-md p-3.5 text-slate-900">
              <div className="flex items-center gap-2 font-bold text-amber-900 text-xs uppercase tracking-wide">
                <Icon icon="solar:danger-triangle-bold" size={18} className="text-amber-600 shrink-0" />
                <span>External Pharmacy Purchase Authorization / Out-of-Stock Slip</span>
              </div>
              <p className="mt-1 text-[11px] text-amber-950 leading-relaxed">
                The medication(s) flagged as <strong>OUT OF STOCK</strong> below are currently unavailable in our
                central hospital pharmacy dispensary. This document serves as an authorized prescription allowing
                the patient to purchase and dispense the required medication(s) from any accredited external or
                community pharmacy.
              </p>
            </div>
          )}

          {/* Patient Details */}
          <div className="grid grid-cols-3 gap-3 bg-slate-50 p-3.5 rounded border border-slate-200 text-xs">
            <div>
              <span className="text-slate-500 font-medium block text-[11px]">Patient Full Name</span>
              <span className="font-bold text-slate-900 text-sm">{patientName || "-"}</span>
            </div>
            <div>
              <span className="text-slate-500 font-medium block text-[11px]">Age / Sex</span>
              <span className="font-semibold text-slate-800">
                {patientAge ? `${patientAge} yrs` : "-"} / {patientSex || "-"}
              </span>
            </div>
            <div>
              <span className="text-slate-500 font-medium block text-[11px]">Prescription Date</span>
              <span className="font-semibold text-slate-800">{encounterDate}</span>
            </div>
          </div>

          {/* Clinical Impression */}
          {(diagnoses.length > 0 || symptoms.length > 0) && (
            <div className="text-xs space-y-1 bg-slate-50/60 p-2.5 rounded border border-slate-200">
              {diagnoses.length > 0 && (
                <div>
                  <span className="font-bold text-slate-700">Diagnosis: </span>
                  <span className="text-slate-900 font-medium">{diagnoses.join(", ")}</span>
                </div>
              )}
              {symptoms.length > 0 && (
                <div>
                  <span className="font-bold text-slate-700">Presenting Symptoms: </span>
                  <span className="text-slate-800">{symptoms.join(", ")}</span>
                </div>
              )}
            </div>
          )}

          {/* Rx Symbol & Medication List */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-3xl font-serif font-black text-blue-700 italic">℞</span>
                <h2 className="text-sm font-bold tracking-wider uppercase text-slate-900">
                  Prescription Orders
                </h2>
              </div>
              <span className="text-[11px] text-slate-500">
                Total Items: {drugRows.length}
              </span>
            </div>

            {drugRows.length === 0 ? (
              <p className="text-xs text-slate-500 italic py-4 border border-dashed rounded text-center">
                No medications prescribed.
              </p>
            ) : (
              <table className="w-full text-xs border border-slate-300 divide-y divide-slate-300">
                <thead className="bg-slate-100 text-slate-800 font-semibold text-left">
                  <tr>
                    <th className="py-2 px-3 w-8">#</th>
                    <th className="py-2 px-3">Medication Name & Strength</th>
                    <th className="py-2 px-3">Dosage / Form</th>
                    <th className="py-2 px-3 w-16 text-center">Qty</th>
                    <th className="py-2 px-3">Pharmacy Stock Status</th>
                    <th className="py-2 px-3">Directions / Instructions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {drugRows.map((rx, idx) => {
                    const isOOS = rx.in_stock === false || rx.is_out_of_stock === true;
                    return (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="py-2.5 px-3 text-slate-500 font-mono">{idx + 1}</td>
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-slate-900">
                            {rx.drug_name || rx.medication || "-"}
                          </div>
                          {rx.drug_code && (
                            <div className="text-[10px] text-slate-500 font-mono">
                              Code: {rx.drug_code}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="font-medium">{rx.dosage || "As directed"}</div>
                          {rx.dosage_form && (
                            <div className="text-[10px] text-slate-500">{rx.dosage_form}</div>
                          )}
                          {rx.period && (
                            <div className="text-[10px] text-slate-500">Duration: {rx.period}</div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold text-slate-800">
                          {rx.quantity || 1}
                        </td>
                        <td className="py-2.5 px-3">
                          {isOOS ? (
                            <span className="inline-flex items-center gap-1 font-bold text-rose-700 bg-rose-50 border border-rose-300 px-2 py-0.5 rounded text-[10px] uppercase">
                              <Icon icon="solar:danger-triangle-bold" size={11} />
                              Out of Stock · Buy Outside
                            </span>
                          ) : rx.in_stock === true ? (
                            <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 bg-emerald-50 border border-emerald-300 px-2 py-0.5 rounded text-[10px]">
                              <Icon icon="solar:check-circle-bold" size={11} />
                              In Stock (Dispensary)
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-500">
                              Hospital Dispensary
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-slate-700 font-medium">
                          {rx.comment || "Take as directed by practitioner"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* External Pharmacy Dispensing Endorsement Block */}
          {hasOutOfStock && (
            <div className="border border-slate-300 rounded p-3 bg-slate-50 text-[11px] space-y-2 mt-4">
              <div className="font-bold text-slate-800 uppercase tracking-wide border-b pb-1">
                Community / External Pharmacy Dispensing Endorsement
              </div>
              <div className="grid grid-cols-2 gap-4 pt-1">
                <div>
                  <span className="text-slate-600 block">External Pharmacy Name: ________________________________</span>
                  <span className="text-slate-600 block mt-2">Dispensing Pharmacist: ________________________________</span>
                  <span className="text-slate-600 block mt-2">License / Registration #: ________________________________</span>
                </div>
                <div className="flex flex-col justify-between">
                  <div>
                    <span className="text-slate-600 block">Date Dispensed: _____ / _____ / 202___</span>
                    <span className="text-slate-600 block mt-2">Batch / Lot Number: ________________________________</span>
                  </div>
                  <div className="border border-dashed border-slate-400 p-3 text-center text-slate-400 text-[10px] rounded mt-2">
                    [ Community Pharmacy Official Stamp & Signature ]
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Doctor Signature Block */}
          <div className="pt-8 flex justify-between items-end text-xs">
            <div className="text-[10px] text-slate-400 max-w-sm space-y-1">
              <div>* Valid only when signed by an authorized, licensed practitioner.</div>
              <div>* Valid for 14 days from consultation date unless otherwise specified.</div>
            </div>
            <div className="text-center w-56 border-t-2 border-slate-800 pt-2">
              <div className="font-bold text-slate-900">{practitionerName}</div>
              <div className="text-slate-500 text-[11px]">Authorized Medical Signature & Seal</div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 print:hidden">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button onClick={handlePrint} className="bg-blue-600 hover:bg-blue-700">
            <Icon icon="solar:printer-bold" size={16} className="mr-1" />
            Print
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
