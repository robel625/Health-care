import { useState, useEffect, useCallback, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/ui/dialog";
import { Button } from "@/ui/button";
import { Label } from "@/ui/label";
import { Input } from "@/ui/input";
import { Icon } from "@/components/icon";
import { Badge } from "@/ui/badge";
import { toast } from "sonner";
import {
  HealthcareApi,
  type Patient,
  type HealthcarePractitioner,
  type Medication,
  type PatientEncounter,
  type PrescriptionDosage,
  type PrescriptionDuration,
  type DosageForm,
} from "@/api/services/healthcareService";
import { WarehouseApi, type Warehouse } from "@/api/services/erpService";
import PrescriptionPrintModal, { type PrintableDrugItem } from "@/pages/healthcare/encounters/PrescriptionPrintModal";
import { getInitials } from "@/utils";

export interface NewMedicationRequestModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultPatientId?: number;
  defaultPatientName?: string;
  defaultEncounterId?: number;
  defaultPractitionerId?: number;
  onSuccess?: () => void;
}

export interface PrescriptionItemState {
  id: string;
  medication_name: string;
  medication_id?: number | null;
  dosage_form: string;
  dosage: string;
  period: string;
  interval?: number;
  interval_uom?: string;
  quantity: number;
  refill_count: number;
  timing: string;
  instructions: string;
  in_stock?: boolean | null;
  available_qty?: number;
  warehouse_name?: string;
  checking_stock?: boolean;
  allergy_warning?: string | null;
}

const DOSAGE_PRESETS = ["1-0-1", "1-1-1", "0-0-1", "1-0-0", "1 Tab BID", "1 Tab TID", "5ml Q8H"];
const DURATION_PRESETS = ["3 Days", "5 Days", "7 Days", "10 Days", "14 Days", "30 Days"];
const TIMING_PRESETS = ["After Meals", "Before Meals", "With Meals", "At Bedtime", "Empty Stomach", "PRN (As Needed)"];

function createDefaultItem(): PrescriptionItemState {
  return {
    id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    medication_name: "",
    medication_id: null,
    dosage_form: "Tablet",
    dosage: "1-0-1",
    period: "7 Days",
    interval: 1,
    interval_uom: "Day",
    quantity: 14,
    refill_count: 0,
    timing: "After Meals",
    instructions: "",
    in_stock: null,
    available_qty: 0,
    warehouse_name: "",
    checking_stock: false,
    allergy_warning: null,
  };
}

/**
 * Calculates total quantity based on standard Marley dosage and duration expressions.
 */
function calculatePrescriptionQuantity(dosageStr: string, periodStr: string): number {
  if (!dosageStr || !periodStr) return 1;

  // Calculate daily frequency
  let dailyDoses = 1;
  const trimmedDosage = dosageStr.trim().toLowerCase();

  // Pattern e.g. 1-0-1, 1-1-1, 2-0-2
  if (/^\d+(-\d+)+$/.test(trimmedDosage)) {
    const parts = trimmedDosage.split("-").map((p) => Number(p) || 0);
    dailyDoses = parts.reduce((a, b) => a + b, 0);
  } else if (trimmedDosage.includes("bid") || trimmedDosage.includes("twice") || trimmedDosage.includes("q12h")) {
    dailyDoses = 2;
  } else if (trimmedDosage.includes("tid") || trimmedDosage.includes("thrice") || trimmedDosage.includes("q8h")) {
    dailyDoses = 3;
  } else if (trimmedDosage.includes("qid") || trimmedDosage.includes("four") || trimmedDosage.includes("q6h")) {
    dailyDoses = 4;
  } else if (trimmedDosage.includes("daily") || trimmedDosage.includes("qd") || trimmedDosage.includes("od")) {
    dailyDoses = 1;
  } else {
    const numMatch = trimmedDosage.match(/^(\d+)/);
    if (numMatch) dailyDoses = Number(numMatch[1]) || 1;
  }

  // Calculate days from period
  let totalDays = 7;
  const trimmedPeriod = periodStr.trim().toLowerCase();
  const periodNumMatch = trimmedPeriod.match(/(\d+)/);
  const num = periodNumMatch ? Number(periodNumMatch[1]) : 1;

  if (trimmedPeriod.includes("month")) {
    totalDays = num * 30;
  } else if (trimmedPeriod.includes("week")) {
    totalDays = num * 7;
  } else if (trimmedPeriod.includes("day")) {
    totalDays = num;
  } else {
    totalDays = num || 7;
  }

  const computed = Math.ceil(dailyDoses * totalDays);
  return computed > 0 ? computed : 1;
}

export default function NewMedicationRequestModal({
  open,
  onOpenChange,
  defaultPatientId,
  defaultPatientName,
  defaultEncounterId,
  defaultPractitionerId,
  onSuccess,
}: NewMedicationRequestModalProps) {
  // Master lists
  const [patients, setPatients] = useState<Patient[]>([]);
  const [practitioners, setPractitioners] = useState<HealthcarePractitioner[]>([]);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [dosages, setDosages] = useState<PrescriptionDosage[]>([]);
  const [durations, setDurations] = useState<PrescriptionDuration[]>([]);
  const [dosageForms, setDosageForms] = useState<DosageForm[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);

  // Selected Patient Details & Context
  const [patientId, setPatientId] = useState<number | undefined>(defaultPatientId);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [patientAllergiesList, setPatientAllergiesList] = useState<string[]>([]);
  const [patientEncounters, setPatientEncounters] = useState<PatientEncounter[]>([]);
  const [patientSearch, setPatientSearch] = useState("");

  // Prescriber & Order Meta
  const [practitionerId, setPractitionerId] = useState<number | undefined>(defaultPractitionerId);
  const [encounterId, setEncounterId] = useState<number | undefined>(defaultEncounterId);
  const [warehouseId, setWarehouseId] = useState<number | undefined>();
  const [intent, setIntent] = useState<string>("Order");
  const [priority, setPriority] = useState<string>("Routine");
  const [generalNotes, setGeneralNotes] = useState<string>("");

  // Prescription Items (Multiple or Single)
  const [items, setItems] = useState<PrescriptionItemState[]>([createDefaultItem()]);

  // Loading & Saving State
  const [loadingMasters, setLoadingMasters] = useState(false);
  const [saving, setSaving] = useState(false);

  // Print Modal
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printableDrugItems, setPrintableDrugItems] = useState<PrintableDrugItem[]>([]);

  // Load masters on modal open
  useEffect(() => {
    if (!open) return;

    setLoadingMasters(true);
    setItems([createDefaultItem()]);
    setPatientId(defaultPatientId);
    setPractitionerId(defaultPractitionerId);
    setEncounterId(defaultEncounterId);

    Promise.all([
      HealthcareApi.patients.list({ page_size: 200 }).catch(() => ({ results: [] })),
      HealthcareApi.practitioners.list({ page_size: 100 }).catch(() => ({ results: [] })),
      HealthcareApi.medications.list({ page_size: 500 }).catch(() => ({ results: [] })),
      HealthcareApi.prescriptionDosages.list({ page_size: 100 }).catch(() => ({ results: [] })),
      HealthcareApi.prescriptionDurations.list({ page_size: 100 }).catch(() => ({ results: [] })),
      HealthcareApi.dosageForms.list({ page_size: 100 }).catch(() => ({ results: [] })),
      WarehouseApi.list({ is_group: false }).catch(() => ({ results: [] })),
    ])
      .then(([pats, pracs, meds, dos, durs, forms, whs]) => {
        const pList = (pats as any).results || [];
        setPatients(pList);

        const prList = (pracs as any).results || [];
        setPractitioners(prList);
        if (prList.length > 0 && !defaultPractitionerId) {
          setPractitionerId(prList[0].id);
        }

        setMedications((meds as any).results || []);
        setDosages((dos as any).results || []);
        setDurations((durs as any).results || []);
        setDosageForms((forms as any).results || []);

        const whList = (whs as any).results || [];
        setWarehouses(whList);
        if (whList.length > 0) {
          // Select default pharmacy warehouse if name matches "pharmacy" or take first
          const pharmacyWh = whList.find((w: Warehouse) =>
            w.warehouse_name.toLowerCase().includes("pharmacy")
          );
          setWarehouseId(pharmacyWh ? pharmacyWh.id : whList[0].id);
        }
      })
      .finally(() => setLoadingMasters(false));
  }, [open, defaultPatientId, defaultPractitionerId, defaultEncounterId]);

  // Load patient details & allergies when patientId changes
  useEffect(() => {
    if (!patientId) {
      setSelectedPatient(null);
      setPatientAllergiesList([]);
      setPatientEncounters([]);
      return;
    }

    HealthcareApi.patients
      .get(patientId)
      .then((p: any) => {
        setSelectedPatient(p);
        // Parse allergies from string e.g. "Penicillin, Aspirin"
        const fromStr = (p.allergies || "")
          .split(/[,;\n]+/)
          .map((s: string) => s.trim())
          .filter(Boolean);

        // Also fetch from allergies doctype table
        HealthcareApi.allergies
          .list({ patient: patientId })
          .then((res: any) => {
            const fromTable = (res.results || []).map(
              (a: any) => a.allergy || a.substance || a.name
            );
            const combined = Array.from(new Set([...fromStr, ...fromTable])).filter(Boolean);
            setPatientAllergiesList(combined as string[]);
          })
          .catch(() => {
            setPatientAllergiesList(fromStr);
          });
      })
      .catch(() => {
        setSelectedPatient(null);
        setPatientAllergiesList([]);
      });

    // Load recent patient encounters
    HealthcareApi.encounters
      .list({ patient: patientId, page_size: 10 })
      .then((res: any) => {
        setPatientEncounters(res.results || []);
      })
      .catch(() => {
        setPatientEncounters([]);
      });
  }, [patientId]);

  // Check allergy contraindications against patient's allergies
  const checkAllergyContraindication = useCallback(
    (medName: string): string | null => {
      if (!medName || patientAllergiesList.length === 0) return null;
      const lowerMed = medName.toLowerCase();

      for (const allergy of patientAllergiesList) {
        const lowerAllergy = allergy.toLowerCase();
        if (lowerMed.includes(lowerAllergy) || lowerAllergy.includes(lowerMed)) {
          return `Patient has a documented allergy to "${allergy}"`;
        }

        // Cross-sensitivity families
        if (
          lowerAllergy.includes("penicillin") &&
          (lowerMed.includes("amoxicillin") ||
            lowerMed.includes("ampicillin") ||
            lowerMed.includes("augmentin") ||
            lowerMed.includes("penicillin"))
        ) {
          return `Cross-reactive beta-lactam: Patient allergic to "${allergy}"`;
        }

        if (
          (lowerAllergy.includes("aspirin") || lowerAllergy.includes("nsaid")) &&
          (lowerMed.includes("ibuprofen") ||
            lowerMed.includes("naproxen") ||
            lowerMed.includes("diclofenac") ||
            lowerMed.includes("ketorolac") ||
            lowerMed.includes("aspirin"))
        ) {
          return `NSAID hypersensitivity: Patient allergic to "${allergy}"`;
        }

        if (
          lowerAllergy.includes("sulfa") &&
          (lowerMed.includes("sulfamethoxazole") ||
            lowerMed.includes("bactrim") ||
            lowerMed.includes("septra"))
        ) {
          return `Sulfonamide allergy: Patient allergic to "${allergy}"`;
        }
      }
      return null;
    },
    [patientAllergiesList]
  );

  // Update item field
  const updateItem = useCallback(
    (id: string, updates: Partial<PrescriptionItemState>) => {
      setItems((prev) =>
        prev.map((item) => {
          if (item.id !== id) return item;
          const merged = { ...item, ...updates };

          // Recalculate quantity if dosage or period changed without explicit quantity
          if ("dosage" in updates || "period" in updates) {
            if (!("quantity" in updates)) {
              merged.quantity = calculatePrescriptionQuantity(merged.dosage, merged.period);
            }
          }

          // Check allergy warning if medication name changed
          if ("medication_name" in updates) {
            merged.allergy_warning = checkAllergyContraindication(merged.medication_name);
          }

          return merged;
        })
      );
    },
    [checkAllergyContraindication]
  );

  // Check stock for an item
  const checkStockForItem = useCallback(
    async (itemId: string, medName: string, medId?: number | null) => {
      if (!medName) return;
      updateItem(itemId, { checking_stock: true });

      try {
        if (medId) {
          const res = await HealthcareApi.medications.checkStock(medId);
          updateItem(itemId, {
            checking_stock: false,
            in_stock: res.in_stock,
            available_qty: res.available_qty,
            warehouse_name: res.warehouse || "Hospital Pharmacy",
          });
        } else {
          const res = await HealthcareApi.medications.checkStockBatch([medName]);
          const stock =
            res.results?.[medName] ||
            res.results?.[medName.toLowerCase()] ||
            res.results?.[medName.trim()];

          if (stock) {
            updateItem(itemId, {
              checking_stock: false,
              in_stock: stock.in_stock,
              available_qty: stock.available_qty,
              warehouse_name: stock.warehouse || "Hospital Pharmacy",
            });
          } else {
            updateItem(itemId, {
              checking_stock: false,
              in_stock: false,
              available_qty: 0,
              warehouse_name: "Hospital Pharmacy",
            });
          }
        }
      } catch {
        updateItem(itemId, { checking_stock: false, in_stock: null });
      }
    },
    [updateItem]
  );

  // Handle picking a medication from formulary
  const handleSelectMedication = (itemId: string, medName: string) => {
    const found = medications.find(
      (m) =>
        (m.medication_name || m.name || m.generic_name || "").toLowerCase() ===
        medName.toLowerCase()
    );

    const initialDosage = found?.default_prescription_dosage || "1-0-1";
    const initialPeriod = found?.default_prescription_duration || "7 Days";
    const dosageFormVal =
      (found?.dosage_form ? String(found.dosage_form) : null) || "Tablet";

    const qty = calculatePrescriptionQuantity(initialDosage, initialPeriod);
    const allergyWarn = checkAllergyContraindication(medName);

    updateItem(itemId, {
      medication_name: medName,
      medication_id: found ? found.id : null,
      dosage: initialDosage,
      period: initialPeriod,
      dosage_form: dosageFormVal,
      quantity: qty,
      allergy_warning: allergyWarn,
    });

    checkStockForItem(itemId, medName, found ? found.id : null);
  };

  // Re-check stock for all items when selected warehouse changes
  useEffect(() => {
    if (!warehouseId) return;
    items.forEach((it) => {
      if (it.medication_name) {
        checkStockForItem(it.id, it.medication_name, it.medication_id);
      }
    });
  }, [warehouseId]);

  // Add new medication item row
  const handleAddItem = () => {
    setItems((prev) => [...prev, createDefaultItem()]);
  };

  // Remove medication item row
  const handleRemoveItem = (id: string) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  // Filter patients for search
  const filteredPatients = useMemo(() => {
    if (!patientSearch) return patients.slice(0, 50);
    const s = patientSearch.toLowerCase();
    return patients
      .filter(
        (p) =>
          (p.patient_name || "").toLowerCase().includes(s) ||
          (p.patient_id || "").toLowerCase().includes(s) ||
          (p.mobile || "").includes(s)
      )
      .slice(0, 50);
  }, [patients, patientSearch]);

  // Validation
  const validateForm = (): boolean => {
    if (!patientId) {
      toast.error("Please select a patient.");
      return false;
    }
    const emptyMed = items.find((i) => !i.medication_name.trim());
    if (emptyMed) {
      toast.error("Please specify a medication name for all prescribed items.");
      return false;
    }
    return true;
  };

  // Submit Handler
  const handleSaveRequests = async (andPrint = false) => {
    if (!validateForm()) return;

    setSaving(true);
    const createdDrugRows: PrintableDrugItem[] = [];

    try {
      for (const it of items) {
        const fullDosage = `${it.dosage} ${it.dosage_form || ""} (${it.period}) ${it.timing ? `· ${it.timing}` : ""}`.trim();
        const fullNotes = [it.instructions, generalNotes].filter(Boolean).join(". ");

        await HealthcareApi.medicationRequests.create({
          patient: patientId!,
          practitioner: practitionerId || null,
          encounter: encounterId || null,
          medication_name: it.medication_name.trim(),
          dosage_instruction: fullDosage || it.dosage,
          quantity: it.quantity || 1,
          intent,
          priority,
          refill_count: it.refill_count || 0,
          warehouse: warehouseId || null,
          notes: fullNotes,
          status: "Active",
        });

        createdDrugRows.push({
          medication: it.medication_name,
          drug_name: it.medication_name,
          dosage: it.dosage,
          period: it.period,
          dosage_form: it.dosage_form,
          quantity: it.quantity,
          comment: `${it.timing ? it.timing + ". " : ""}${it.instructions || ""}`.trim(),
          in_stock: it.in_stock === true,
          is_out_of_stock: it.in_stock === false,
        });
      }

      toast.success(
        items.length === 1
          ? "Medication Request created successfully."
          : `Successfully created ${items.length} Medication Requests.`
      );

      if (andPrint) {
        setPrintableDrugItems(createdDrugRows);
        setShowPrintModal(true);
      } else {
        onOpenChange(false);
      }

      onSuccess?.();
    } catch (err: any) {
      console.error(err);
      toast.error(
        err?.response?.data?.detail ||
          err?.response?.data?.error ||
          "Failed to create medication request."
      );
    } finally {
      setSaving(false);
    }
  };

  const selectedPractitioner = practitioners.find((pr) => pr.id === practitionerId);
  const selectedWarehouse = warehouses.find((w) => w.id === warehouseId);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col p-0 overflow-hidden">
          {/* Header */}
          <DialogHeader className="p-6 pb-4 border-b shrink-0 bg-muted/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950/60 border border-rose-200 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0 shadow-2xs">
                  <Icon icon="solar:pills-bold-duotone" size={22} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <DialogTitle className="text-lg font-bold tracking-tight">
                      New Medication Request
                    </DialogTitle>
                    <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold bg-rose-100 text-rose-700 border border-rose-200">
                      Marley e-Prescribe
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Prescribe medications with real-time pharmacy stock lookup, allergy cross-check, and automatic dispense routing.
                  </p>
                </div>
              </div>
            </div>
          </DialogHeader>

          {/* Scrollable Form Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Top Grid: Patient & Clinical Context */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Patient Card / Picker (Left 6 cols) */}
              <div className="lg:col-span-6 space-y-3 p-4 rounded-xl border bg-card shadow-2xs">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Icon icon="solar:user-bold" size={14} className="text-indigo-600" />
                    Patient Information
                  </Label>
                  {selectedPatient && (
                    <Badge variant="outline" className="text-[10px] font-mono border-indigo-200 text-indigo-700 bg-indigo-50/50">
                      ID: #{selectedPatient.id}
                    </Badge>
                  )}
                </div>

                {defaultPatientId && selectedPatient ? (
                  /* Verified Pre-Selected Patient Card */
                  <div className="p-3 rounded-lg bg-indigo-50/40 border border-indigo-100 flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center text-sm shadow-2xs">
                        {getInitials(selectedPatient.patient_name || defaultPatientName || "PT")}
                      </div>
                      <div>
                        <div className="font-semibold text-sm text-foreground">
                          {selectedPatient.patient_name || defaultPatientName}
                        </div>
                        <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                          <span>{selectedPatient.age ? `${selectedPatient.age} yrs` : "Age N/A"}</span>
                          <span>•</span>
                          <span>{selectedPatient.sex || selectedPatient.gender || "Gender N/A"}</span>
                          {selectedPatient.blood_group && (
                            <>
                              <span>•</span>
                              <span className="font-semibold text-rose-600">{selectedPatient.blood_group}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px]">
                      Active Patient
                    </Badge>
                  </div>
                ) : (
                  /* Patient Search / Selector */
                  <div>
                    <Input
                      placeholder="Search patient by name, ID or mobile..."
                      value={patientSearch}
                      onChange={(e) => setPatientSearch(e.target.value)}
                      className="text-xs h-9 mb-2"
                    />
                    <select
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      value={patientId || ""}
                      onChange={(e) => {
                        const val = e.target.value ? Number(e.target.value) : undefined;
                        setPatientId(val);
                      }}
                      required
                    >
                      <option value="">Select Patient...</option>
                      {filteredPatients.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.patient_name} (#{p.id}) {p.mobile ? `· ${p.mobile}` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Patient Allergies Banner (Marley Safety) */}
                {selectedPatient && (
                  <div className="pt-1">
                    {patientAllergiesList.length > 0 ? (
                      <div className="p-2.5 rounded-lg border border-amber-300 bg-amber-50/70 text-amber-900 text-xs flex items-start gap-2 shadow-2xs">
                        <Icon icon="solar:danger-triangle-bold" size={16} className="text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold">Documented Allergies: </span>
                          <span className="font-medium">
                            {patientAllergiesList.join(", ")}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="p-2 rounded-lg border border-emerald-200 bg-emerald-50/50 text-emerald-800 text-xs flex items-center gap-1.5">
                        <Icon icon="solar:check-circle-bold" size={14} className="text-emerald-600" />
                        <span>No known drug allergies (NKDA) recorded for this patient.</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Order Meta & Dispensing Configuration (Right 6 cols) */}
              <div className="lg:col-span-6 space-y-3 p-4 rounded-xl border bg-card shadow-2xs">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Icon icon="solar:stethoscope-bold" size={14} className="text-blue-600" />
                  Prescriber & Dispensing Route
                </Label>

                <div className="grid grid-cols-2 gap-3">
                  {/* Practitioner */}
                  <div>
                    <Label className="text-xs font-semibold">Prescribing Practitioner</Label>
                    <select
                      className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      value={practitionerId || ""}
                      onChange={(e) => setPractitionerId(Number(e.target.value))}
                    >
                      <option value="">Select Practitioner...</option>
                      {practitioners.map((pr) => (
                        <option key={pr.id} value={pr.id}>
                          {pr.practitioner_name} {pr.department_name ? `(${pr.department_name})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Dispensing Pharmacy */}
                  <div>
                    <Label className="text-xs font-semibold">Dispensing Pharmacy</Label>
                    <select
                      className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      value={warehouseId || ""}
                      onChange={(e) => setWarehouseId(Number(e.target.value))}
                    >
                      {warehouses.map((wh) => (
                        <option key={wh.id} value={wh.id}>
                          {wh.warehouse_name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {/* Linked Encounter */}
                  <div>
                    <Label className="text-xs font-semibold">Encounter</Label>
                    <select
                      className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      value={encounterId || ""}
                      onChange={(e) => setEncounterId(e.target.value ? Number(e.target.value) : undefined)}
                    >
                      <option value="">None (Standalone)</option>
                      {patientEncounters.map((enc) => (
                        <option key={enc.id} value={enc.id}>
                          {enc.encounter_id || `ENC-${enc.id}`} ({enc.encounter_date || (enc as any).creation?.slice(0, 10) || ""})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Intent */}
                  <div>
                    <Label className="text-xs font-semibold">Intent</Label>
                    <select
                      className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      value={intent}
                      onChange={(e) => setIntent(e.target.value)}
                    >
                      <option value="Order">Order</option>
                      <option value="Plan">Plan</option>
                      <option value="Proposal">Proposal</option>
                      <option value="Original Order">Original Order</option>
                    </select>
                  </div>

                  {/* Priority */}
                  <div>
                    <Label className="text-xs font-semibold">Priority</Label>
                    <select
                      className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      value={priority}
                      onChange={(e) => setPriority(e.target.value)}
                    >
                      <option value="Routine">Routine</option>
                      <option value="Urgent">Urgent</option>
                      <option value="ASAP">ASAP</option>
                      <option value="STAT">STAT</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Middle Section: Prescribed Medications (Marley Multi-Item Rx Table) */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                    <span>Prescribed Medications</span>
                    <Badge variant="secondary" className="font-semibold text-xs">
                      {items.length} {items.length === 1 ? "Item" : "Items"}
                    </Badge>
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Select drugs from formulary, select dosage regimens, verify live stock, and configure patient instructions.
                  </p>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddItem}
                  className="border-indigo-200 text-indigo-700 hover:bg-indigo-50 shadow-2xs"
                >
                  <Icon icon="solar:add-circle-bold" size={16} className="mr-1.5" />
                  Add Another Medication
                </Button>
              </div>

              {/* Medication Item Cards */}
              <div className="space-y-4">
                {items.map((item, index) => (
                  <div
                    key={item.id}
                    className={`rounded-xl border p-4 space-y-4 transition-all shadow-xs ${
                      item.allergy_warning
                        ? "border-red-300 bg-red-50/20"
                        : "border-border bg-card hover:border-slate-300"
                    }`}
                  >
                    {/* Item Header */}
                    <div className="flex items-center justify-between pb-2 border-b">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center">
                          {index + 1}
                        </span>
                        <span className="font-semibold text-sm">
                          {item.medication_name || `Medication #${index + 1}`}
                        </span>
                        {item.dosage_form && (
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
                            {item.dosage_form}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Live Stock Pill */}
                        {item.checking_stock ? (
                          <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                            <Icon icon="solar:spinner-line-duotone" size={12} className="animate-spin" />
                            Checking stock...
                          </span>
                        ) : item.in_stock === true ? (
                          <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full flex items-center gap-1 border border-emerald-200">
                            <Icon icon="solar:check-circle-bold" size={13} />
                            In Stock ({item.available_qty} available)
                          </span>
                        ) : item.in_stock === false ? (
                          <span className="text-[11px] font-semibold text-rose-700 bg-rose-100/80 px-2 py-0.5 rounded-full flex items-center gap-1 border border-rose-200">
                            <Icon icon="solar:danger-triangle-bold" size={13} />
                            Out of Stock (External Slip)
                          </span>
                        ) : null}

                        {/* Remove item button if > 1 */}
                        {items.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-red-600 hover:bg-red-50"
                            onClick={() => handleRemoveItem(item.id)}
                            title="Remove medication"
                          >
                            <Icon icon="solar:trash-bin-trash-bold" size={15} />
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Allergy Warning Alert Banner */}
                    {item.allergy_warning && (
                      <div className="p-3 rounded-lg border border-red-300 bg-red-100/80 text-red-900 text-xs flex items-center gap-2.5 font-medium shadow-2xs animate-pulse">
                        <Icon icon="solar:shield-warning-bold" size={18} className="text-red-600 shrink-0" />
                        <div>
                          <strong>CONTRAINDICATION WARNING:</strong> {item.allergy_warning}.
                          Verify clinical rationale before dispensing.
                        </div>
                      </div>
                    )}

                    {/* Inputs Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                      {/* Medication Input (5 cols) */}
                      <div className="md:col-span-5">
                        <Label className="text-xs font-semibold">Medication Name / Item *</Label>
                        <div className="mt-1 flex gap-1">
                          <input
                            list={`med-options-${item.id}`}
                            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            placeholder="Search medication name, strength, or generic..."
                            value={item.medication_name}
                            onChange={(e) => handleSelectMedication(item.id, e.target.value)}
                            required
                          />
                          <datalist id={`med-options-${item.id}`}>
                            {medications.map((m) => (
                              <option
                                key={m.id}
                                value={m.medication_name || m.name || m.generic_name}
                              >
                                {m.generic_name ? `(${m.generic_name})` : ""}{" "}
                                {m.strength ? `[${m.strength}]` : ""}
                              </option>
                            ))}
                          </datalist>
                        </div>
                      </div>

                      {/* Dosage Form (2 cols) */}
                      <div className="md:col-span-2">
                        <Label className="text-xs font-semibold">Dosage Form</Label>
                        <select
                          className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-2.5 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                          value={item.dosage_form}
                          onChange={(e) => updateItem(item.id, { dosage_form: e.target.value })}
                        >
                          <option value="Tablet">Tablet</option>
                          <option value="Capsule">Capsule</option>
                          <option value="Syrup">Syrup</option>
                          <option value="Injection">Injection</option>
                          <option value="Ointment">Ointment</option>
                          <option value="Cream">Cream</option>
                          <option value="Drops">Drops</option>
                          <option value="Inhaler">Inhaler</option>
                          <option value="Suppository">Suppository</option>
                          <option value="Suspension">Suspension</option>
                          {dosageForms.map((df) => (
                            <option key={df.id} value={df.dosage_form}>
                              {df.dosage_form}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Period / Duration (3 cols) */}
                      <div className="md:col-span-3">
                        <Label className="text-xs font-semibold">Duration / Period</Label>
                        <div className="mt-1 flex gap-1">
                          <input
                            list={`duration-options-${item.id}`}
                            className="flex h-9 w-full rounded-md border border-input bg-background px-2.5 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            value={item.period}
                            onChange={(e) => updateItem(item.id, { period: e.target.value })}
                            placeholder="e.g. 7 Days"
                          />
                          <datalist id={`duration-options-${item.id}`}>
                            {DURATION_PRESETS.map((d) => (
                              <option key={d} value={d} />
                            ))}
                            {durations.map((dur) => (
                              <option key={dur.id} value={dur.period} />
                            ))}
                          </datalist>
                        </div>
                      </div>

                      {/* Quantity (2 cols) */}
                      <div className="md:col-span-2">
                        <Label className="text-xs font-semibold">Quantity</Label>
                        <Input
                          type="number"
                          min="1"
                          className="mt-1 h-9 text-xs"
                          value={item.quantity}
                          onChange={(e) =>
                            updateItem(item.id, { quantity: Number(e.target.value) || 1 })
                          }
                          required
                        />
                      </div>
                    </div>

                    {/* Dosage Row with Quick Presets */}
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                      <div className="md:col-span-6">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs font-semibold">Dosage Frequency</Label>
                          <span className="text-[10px] text-muted-foreground">e.g. 1-0-1 or 1 Tab BID</span>
                        </div>
                        <input
                          list={`dosage-options-${item.id}`}
                          className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                          placeholder="e.g. 1-0-1"
                          value={item.dosage}
                          onChange={(e) => updateItem(item.id, { dosage: e.target.value })}
                        />
                        <datalist id={`dosage-options-${item.id}`}>
                          {DOSAGE_PRESETS.map((p) => (
                            <option key={p} value={p} />
                          ))}
                          {dosages.map((d) => (
                            <option key={d.id} value={d.dosage} />
                          ))}
                        </datalist>

                        {/* Quick Dosage Preset Chips */}
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {DOSAGE_PRESETS.map((preset) => (
                            <button
                              key={preset}
                              type="button"
                              onClick={() => updateItem(item.id, { dosage: preset })}
                              className={`text-[10px] px-2 py-0.5 rounded border transition-all ${
                                item.dosage === preset
                                  ? "bg-indigo-600 text-white border-indigo-600 font-semibold"
                                  : "bg-muted/60 text-muted-foreground border-border hover:bg-muted"
                              }`}
                            >
                              {preset}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Timing & Refills */}
                      <div className="md:col-span-6 space-y-1">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label className="text-xs font-semibold">Administration Timing</Label>
                            <select
                              className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-2.5 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                              value={item.timing}
                              onChange={(e) => updateItem(item.id, { timing: e.target.value })}
                            >
                              {TIMING_PRESETS.map((t) => (
                                <option key={t} value={t}>
                                  {t}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <Label className="text-xs font-semibold">Refills Allowed</Label>
                            <select
                              className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-2.5 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                              value={item.refill_count}
                              onChange={(e) =>
                                updateItem(item.id, { refill_count: Number(e.target.value) })
                              }
                            >
                              <option value="0">0 (No Refill)</option>
                              <option value="1">1 Refill</option>
                              <option value="2">2 Refills</option>
                              <option value="3">3 Refills</option>
                              <option value="5">5 Refills</option>
                            </select>
                          </div>
                        </div>

                        {/* Specific Instructions input */}
                        <div className="pt-1">
                          <Input
                            placeholder="Special instructions (e.g. Dissolve in water, take with milk)..."
                            value={item.instructions}
                            onChange={(e) => updateItem(item.id, { instructions: e.target.value })}
                            className="text-xs h-8"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* General Clinical Notes */}
            <div>
              <Label className="text-xs font-semibold">General Clinical Notes / Rx Instructions</Label>
              <textarea
                className="mt-1 flex min-h-[50px] w-full rounded-md border border-input bg-background px-3 py-2 text-xs shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                placeholder="Additional notes for pharmacist or patient (e.g. follow-up in 10 days if symptoms persist)..."
                value={generalNotes}
                onChange={(e) => setGeneralNotes(e.target.value)}
              />
            </div>
          </div>

          {/* Footer with Actions */}
          <DialogFooter className="p-4 px-6 border-t bg-muted/20 shrink-0 flex items-center justify-between sm:justify-between">
            <div className="text-xs text-muted-foreground flex items-center gap-2">
              <Icon icon="solar:info-circle-bold" size={16} className="text-indigo-600" />
              <span>
                {items.length} {items.length === 1 ? "medication" : "medications"} ·{" "}
                {selectedWarehouse?.warehouse_name || "Hospital Pharmacy"}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={saving}
              >
                Cancel
              </Button>

              <Button
                type="button"
                variant="outline"
                className="border-indigo-200 text-indigo-700 hover:bg-indigo-50 shadow-2xs"
                onClick={() => handleSaveRequests(true)}
                disabled={saving || loadingMasters}
              >
                <Icon icon="solar:printer-bold" size={16} className="mr-1.5" />
                {saving ? "Processing..." : "Create & Print Prescription"}
              </Button>

              <Button
                type="button"
                onClick={() => handleSaveRequests(false)}
                disabled={saving || loadingMasters}
                className="bg-rose-600 hover:bg-rose-700 text-white shadow-2xs"
              >
                <Icon icon="solar:check-circle-bold" size={16} className="mr-1.5" />
                {saving ? "Creating..." : "Create Medication Request"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Prescription Print Modal */}
      {selectedPatient && (
        <PrescriptionPrintModal
          open={showPrintModal}
          onOpenChange={(pOpen) => {
            setShowPrintModal(pOpen);
            if (!pOpen) {
              onOpenChange(false);
            }
          }}
          patientName={selectedPatient.patient_name || defaultPatientName || "Patient"}
          patientAge={selectedPatient.age}
          patientSex={selectedPatient.gender || selectedPatient.sex}
          patientId={selectedPatient.patient_id || selectedPatient.id}
          practitionerName={selectedPractitioner?.practitioner_name || "Attending Physician"}
          departmentName={selectedPractitioner?.department_name}
          encounterDate={new Date().toISOString().split("T")[0]}
          drugRows={printableDrugItems}
          isExternalPurchaseSlip={printableDrugItems.some((rx) => rx.is_out_of_stock)}
        />
      )}
    </>
  );
}
