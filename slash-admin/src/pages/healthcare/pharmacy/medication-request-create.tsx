import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Icon } from "@/components/icon";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { Textarea } from "@/ui/textarea";
import { Badge } from "@/ui/badge";
import { toast } from "sonner";
import { cn } from "@/utils";
import {
  HealthcareApi,
  type Patient,
  type HealthcarePractitioner,
  type Medication,
  type PatientEncounter,
  type PrescriptionDosage,
  type PrescriptionDuration,
  type DosageForm,
  type Company,
} from "@/api/services/healthcareService";
import EntitySelect, { type EntityOption } from "@/components/healthcare/EntitySelect";
import Combobox from "@/components/healthcare/Combobox";
import PrescriptionPrintModal, { type PrintableDrugItem } from "@/pages/healthcare/encounters/PrescriptionPrintModal";
import {
  ETHIOPIAN_MEDICINE_OPTIONS,
  getEthiopianMedicineDefaults,
} from "./ethiopianMedicinesData";

interface StockItemOption {
  id: number;
  item_code: string;
  item_name: string;
}

// ── Marley Medication Label Helper ──────────────────────────────────────────
// Formats Medication label as: `generic_name strength strength_uom` (e.g. "Amoxicillin 500mg")
function medicationLabel(m: Medication): string {
  if (!m) return "";
  const name = m.generic_name || (m as any).medication_name || (m as any).name || "";
  const strength = m.strength ? ` ${m.strength}${m.strength_uom || ""}` : "";
  return `${name}${strength}`.trim() || name || (m.id ? `Medication #${m.id}` : "");
}

// ── Marley Age Calculation ──────────────────────────────────────────────────
// Matches Marley's exact formula from service_request.js:
// `${years} Years(s) ${months} Month(s) ${days} Day(s)`
function calculateMarleyAge(birthDateStr?: string | null): string {
  if (!birthDateStr) return "—";
  const birth = new Date(birthDateStr);
  if (isNaN(birth.getTime())) return "—";
  const now = new Date();
  let years = now.getFullYear() - birth.getFullYear();
  let months = now.getMonth() - birth.getMonth();
  let days = now.getDate() - birth.getDate();

  if (days < 0) {
    months -= 1;
    const prevMonthLastDay = new Date(now.getFullYear(), now.getMonth(), 0).getDate();
    days += prevMonthLastDay;
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  return `${years} Year(s)`;
}

// ── Quantity Calculation ────────────────────────────────────────────────────
function calculateQuantity(dosageStr?: string, periodStr?: string): number {
  if (!dosageStr || !periodStr) return 1;
  let dailyDoses = 1;
  const d = dosageStr.trim().toLowerCase();

  if (/^\d+(-\d+)+$/.test(d)) {
    const parts = d.split("-").map((p) => Number(p) || 0);
    dailyDoses = parts.reduce((a, b) => a + b, 0);
  } else if (d.includes("bid") || d.includes("twice") || d.includes("q12h") || d === "1-0-1") {
    dailyDoses = 2;
  } else if (d.includes("tid") || d.includes("thrice") || d.includes("q8h") || d === "1-1-1") {
    dailyDoses = 3;
  } else if (d.includes("qid") || d.includes("four") || d.includes("q6h")) {
    dailyDoses = 4;
  } else if (d.includes("daily") || d.includes("qd") || d.includes("od") || d === "1-0-0" || d === "0-0-1") {
    dailyDoses = 1;
  }

  let totalDays = 7;
  const p = periodStr.trim().toLowerCase();
  const numMatch = p.match(/\d+/);
  const num = numMatch ? parseInt(numMatch[0], 10) : 7;

  if (p.includes("day")) {
    totalDays = num;
  } else if (p.includes("week")) {
    totalDays = num * 7;
  } else if (p.includes("month")) {
    totalDays = num * 30;
  } else if (p.includes("year")) {
    totalDays = num * 365;
  }

  return Math.max(1, dailyDoses * totalDays);
}

// ── Medical Coding Row (Marley Codification Table) ───────────────────────────
interface CodificationRow {
  id: string;
  code_system: string;
  code_value: string;
  description: string;
}

// ── Frappe Field Container ──────────────────────────────────────────────────
function Field({
  label,
  required,
  error,
  children,
  className,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className={cn("text-xs font-medium", error ? "text-destructive" : "text-muted-foreground")}>
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      <div>{children}</div>
      {error && <p className="text-xs text-destructive font-medium">{error}</p>}
    </div>
  );
}

// ── Frappe Read-Only Field Display ──────────────────────────────────────────
function ReadOnlyDisplay({
  value,
  placeholder = "—",
}: {
  value?: string | number | null;
  placeholder?: string;
}) {
  const displayVal = value !== undefined && value !== null && value !== "" ? String(value) : placeholder;
  return (
    <div className="h-9 px-3 border border-border bg-muted/40 rounded-md flex items-center text-sm text-foreground overflow-hidden truncate">
      <span className={!value ? "text-muted-foreground" : "font-normal"}>{displayVal}</span>
    </div>
  );
}

export default function MedicationRequestCreatePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const patientParam = searchParams.get("patient");
  const practitionerParam = searchParams.get("practitioner");
  const encounterParam = searchParams.get("encounter");

  // ── Masters Data ──────────────────────────────────────────────────────────
  const [patients, setPatients] = useState<Patient[]>([]);
  const [practitioners, setPractitioners] = useState<HealthcarePractitioner[]>([]);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [stockItems, setStockItems] = useState<StockItemOption[]>([]);
  const [dosages, setDosages] = useState<PrescriptionDosage[]>([]);
  const [durations, setDurations] = useState<PrescriptionDuration[]>([]);
  const [dosageForms, setDosageForms] = useState<DosageForm[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [codeSystemsList, setCodeSystemsList] = useState<string[]>([]);
  const [loadingMasters, setLoadingMasters] = useState(true);

  // ── Section Collapsible States (Marley collapsible: 1) ────────────────────
  const [orderSourceOpen, setOrderSourceOpen] = useState(true);
  const [medicalCodeOpen, setMedicalCodeOpen] = useState(true);

  // ── Form State (Exact Marley Medication Request DocType Schema) ───────────
  // Header / Series Details
  const [namingSeries, setNamingSeries] = useState("HMR-");
  const [medicationName, setMedicationName] = useState("");
  const [medicationItem, setMedicationItem] = useState("");
  const [itemCode, setItemCode] = useState("");
  const [orderDate, setOrderDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [orderTime, setOrderTime] = useState(() => new Date().toTimeString().slice(0, 5));
  const [expectedDate, setExpectedDate] = useState("");
  const [companyId, setCompanyId] = useState<number | null>(null);
  const [status, setStatus] = useState("Draft");

  // Section 2: Patient Details
  const [patientId, setPatientId] = useState<number | null>(
    patientParam ? Number(patientParam) : null
  );
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [patientAllergies, setPatientAllergies] = useState<string[]>([]);
  const [patientEncounters, setPatientEncounters] = useState<PatientEncounter[]>([]);

  // Section 3: Order Source
  const [practitionerId, setPractitionerId] = useState<number | null>(
    practitionerParam ? Number(practitionerParam) : null
  );
  const [selectedPractitioner, setSelectedPractitioner] = useState<HealthcarePractitioner | null>(null);
  const [referredToPractitionerId, setReferredToPractitionerId] = useState<number | null>(null);
  const [reasonReferenceDoctype, setReasonReferenceDoctype] = useState("");
  const [reasonReference, setReasonReference] = useState("");
  const [orderGroupId, setOrderGroupId] = useState<number | null>(
    encounterParam ? Number(encounterParam) : null
  );
  const [sequence, setSequence] = useState(1);

  // Section 4: Request Details
  const [staffRole, setStaffRole] = useState("Physician");
  const [intent, setIntent] = useState("Order");
  const [priority, setPriority] = useState("Routine");

  // Section 5: Order Specifications
  const [quantity, setQuantity] = useState(1);
  const [dosageForm, setDosageForm] = useState("");
  const [dosage, setDosage] = useState("");
  const [numberOfRepeatsAllowed, setNumberOfRepeatsAllowed] = useState(0);
  const [period, setPeriod] = useState("");
  const [occurrenceTime, setOccurrenceTime] = useState("");
  const [comment, setComment] = useState("");
  const [orderDescription, setOrderDescription] = useState("");

  // Section 6: Billing
  const [billingStatus, setBillingStatus] = useState("Pending");
  const qtyInvoiced = 0;

  // Section 7: Medical Coding
  const [codificationTable, setCodificationTable] = useState<CodificationRow[]>([]);

  // Real-time stock status for medication
  const [checkingStock, setCheckingStock] = useState(false);
  const [stockStatus, setStockStatus] = useState<{
    in_stock: boolean | null;
    available_qty: number;
    warehouse?: string;
  } | null>(null);

  // Print modal & Save states
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [showPrintModal, setShowPrintModal] = useState(false);

  // ── Calculated Total Dispensable Quantity ─────────────────────────────────
  const totalDispensableQuantity = useMemo(() => {
    return Math.max(1, (Number(quantity) || 1) * (1 + (Number(numberOfRepeatsAllowed) || 0)));
  }, [quantity, numberOfRepeatsAllowed]);

  // ── Load All Masters ──────────────────────────────────────────────────────
  useEffect(() => {
    setLoadingMasters(true);
    Promise.all([
      HealthcareApi.patients.list({ page_size: 200 }).catch(() => ({ results: [] })),
      HealthcareApi.practitioners.list({ page_size: 200 }).catch(() => ({ results: [] })),
      HealthcareApi.medications.list({ page_size: 500 }).catch(() => ({ results: [] })),
      HealthcareApi.stockItems.list({ page_size: 500 }).catch(() => ({ results: [] })),
      HealthcareApi.dosageForms.list({ page_size: 100 }).catch(() => ({ results: [] })),
      HealthcareApi.prescriptionDosages.list({ page_size: 100 }).catch(() => ({ results: [] })),
      HealthcareApi.prescriptionDurations.list({ page_size: 100 }).catch(() => ({ results: [] })),
      HealthcareApi.companies.list({ page_size: 50 }).catch(() => ({ results: [] })),
      HealthcareApi.codeSystems.list({ page_size: 100 }).catch(() => ({ results: [] })),
    ])
      .then(([pats, pracs, meds, stock, forms, dos, durs, comps, cs]) => {
        const patsList = (pats as any).results || (Array.isArray(pats) ? pats : []);
        const pracsList = (pracs as any).results || (Array.isArray(pracs) ? pracs : []);
        const medsList = (meds as any).results || (Array.isArray(meds) ? meds : []);
        const stockList = (stock as any).results || (Array.isArray(stock) ? stock : []);
        const formsList = (forms as any).results || (Array.isArray(forms) ? forms : []);
        const dosList = (dos as any).results || (Array.isArray(dos) ? dos : []);
        const dursList = (durs as any).results || (Array.isArray(durs) ? durs : []);

        setPatients(patsList);
        setPractitioners(pracsList);
        setMedications(medsList);
        setStockItems(stockList);
        setDosageForms(formsList);
        setDosages(dosList);
        setDurations(dursList);

        const compList = (comps as any).results || (Array.isArray(comps) ? comps : []);
        setCompanies(compList);
        if (compList.length > 0 && !companyId) {
          setCompanyId(compList[0].id);
        }

        const rawCs = (cs as any).results || (Array.isArray(cs) ? cs : []);
        const csList = rawCs.map((c: any) => c.code_system || c.name || "").filter(Boolean);
        setCodeSystemsList(csList.length > 0 ? csList : ["ICD-10", "RxNorm", "SNOMED CT"]);

        // Auto select practitioner if passed or default first
        if (practitionerParam) {
          const match = (pracs.results || []).find((p: any) => p.id === Number(practitionerParam));
          if (match) {
            setPractitionerId(match.id);
            setSelectedPractitioner(match);
          }
        } else if ((pracs.results || []).length > 0) {
          setPractitionerId(pracs.results[0].id);
          setSelectedPractitioner(pracs.results[0]);
        }
      })
      .finally(() => setLoadingMasters(false));
  }, [practitionerParam]);

  // ── Load Patient Context when patientId Changes ───────────────────────────
  useEffect(() => {
    if (!patientId) {
      setSelectedPatient(null);
      setPatientAllergies([]);
      setPatientEncounters([]);
      return;
    }

    HealthcareApi.patients
      .get(patientId)
      .then((p: any) => {
        setSelectedPatient(p);
        const fromStr = (p.allergies || "")
          .split(/[,;\n]+/)
          .map((s: string) => s.trim())
          .filter(Boolean);

        HealthcareApi.allergies
          .list({ patient: patientId })
          .then((res: any) => {
            const fromTable = (res.results || []).map(
              (a: any) => a.allergy || a.substance || a.name
            );
            const combined = Array.from(new Set([...fromStr, ...fromTable])).filter(Boolean);
            setPatientAllergies(combined as string[]);
          })
          .catch(() => setPatientAllergies(fromStr));
      })
      .catch(() => {
        setSelectedPatient(null);
        setPatientAllergies([]);
      });

    // Encounters for order_group Link
    HealthcareApi.encounters
      .list({ patient: patientId, page_size: 20 })
      .then((res: any) => {
        setPatientEncounters(res.results || []);
      })
      .catch(() => setPatientEncounters([]));
  }, [patientId]);

  // ── Load Encounter Defaults if encounterParam Present ──────────────────────
  useEffect(() => {
    if (encounterParam) {
      const encId = Number(encounterParam);
      setOrderGroupId(encId);
      setReasonReferenceDoctype("Patient Encounter");
      setReasonReference(String(encId));

      HealthcareApi.encounters
        .get(encId)
        .then((enc: any) => {
          if (enc) {
            if (enc.patient && !patientId) setPatientId(enc.patient);
            if (enc.practitioner && !practitionerId) {
              setPractitionerId(enc.practitioner);
            }
          }
        })
        .catch(() => {});
    }
  }, [encounterParam]);

  // ── Practitioner Selection Sync ───────────────────────────────────────────
  useEffect(() => {
    if (practitionerId && practitioners.length > 0) {
      const match = practitioners.find((p) => p.id === practitionerId);
      setSelectedPractitioner(match || null);
    }
  }, [practitionerId, practitioners]);

  // ── Check Real-Time Stock Status ──────────────────────────────────────────
  const checkStock = useCallback(async (drugName: string) => {
    if (!drugName.trim()) {
      setStockStatus(null);
      return;
    }
    setCheckingStock(true);
    try {
      const res = await HealthcareApi.medications.checkStockBatch([drugName]);
      const stockRes = res?.results?.[drugName];
      if (stockRes) {
        setStockStatus({
          in_stock: stockRes.in_stock,
          available_qty: stockRes.available_qty,
          warehouse: stockRes.warehouse,
        });
      } else {
        setStockStatus(null);
      }
    } catch {
      setStockStatus(null);
    } finally {
      setCheckingStock(false);
    }
  }, []);

  // ── Handle Medication Master Selection (Marley Auto Fetching) ─────────────
  const handleMedicationChange = (name: string) => {
    setMedicationName(name);
    const needle = name.trim().toLowerCase();
    const med = medications.find(
      (m) =>
        medicationLabel(m).toLowerCase() === needle ||
        (m.generic_name && m.generic_name.toLowerCase() === needle) ||
        (m.national_drug_code && m.national_drug_code.toLowerCase() === needle) ||
        ((m as any).medication_name && (m as any).medication_name.toLowerCase() === needle) ||
        ((m as any).name && (m as any).name.toLowerCase() === needle)
    );

    if (!med) {
      const ethMed = getEthiopianMedicineDefaults(name);
      if (ethMed) {
        const nextDosage = ethMed.default_dosage || dosage || "1-0-1";
        const nextPeriod = ethMed.default_period || period || "7 Days";
        setDosage(nextDosage);
        setPeriod(nextPeriod);
        setDosageForm(ethMed.primary_dosage_form || "Tablet");
        if (ethMed.dosage_form_and_strength && !comment) {
          setComment(ethMed.dosage_form_and_strength);
        }
        setOrderDescription(`${ethMed.generic_name || name} - ${nextDosage} for ${nextPeriod}`);
      }
      checkStock(name);
      return;
    }

    // Fetch defaults from medication
    const nextDosage = med.default_prescription_dosage || dosage || "1-0-1";
    const nextPeriod = med.default_prescription_duration || period || "7 Days";
    setDosage(nextDosage);
    setPeriod(nextPeriod);

    // Find Dosage Form
    let formName = dosageForm;
    if (med.dosage_form) {
      const matchForm = dosageForms.find((f) => f.id === med.dosage_form);
      if (matchForm) formName = matchForm.dosage_form;
    } else if ((med as any).dosage_form_name) {
      formName = (med as any).dosage_form_name;
    }
    setDosageForm(formName);

    // Find stock item by linked_item_code, national drug code, or generic name
    const matchItem = stockItems.find(
      (it: any) =>
        ((med as any).linked_item_code && it.item_code === (med as any).linked_item_code) ||
        (med.national_drug_code && it.item_code === med.national_drug_code) ||
        (it.item_name && it.item_name.toLowerCase() === med.generic_name?.toLowerCase()) ||
        (it.item_code && it.item_code.toLowerCase() === med.generic_name?.toLowerCase())
    );

    if (matchItem) {
      setMedicationItem(matchItem.item_name || matchItem.item_code);
      setItemCode(matchItem.item_code);
    } else {
      setMedicationItem(med.generic_name || (med as any).medication_name || name);
      setItemCode((med as any).linked_item_code || med.national_drug_code || "");
    }

    // Auto-calculate quantity
    const autoQty = calculateQuantity(nextDosage, nextPeriod);
    setQuantity(autoQty);

    // Auto-update order description
    const label = medicationLabel(med);
    const desc = `${label || name} - ${nextDosage} for ${nextPeriod}`;
    setOrderDescription(desc);

    // Check stock
    checkStock(med.generic_name || name);
  };

  // ── Handle Medication Item Change ─────────────────────────────────────────
  const handleMedicationItemChange = (val: string) => {
    setMedicationItem(val);
    const item = stockItems.find((it) => it.item_name === val || it.item_code === val);
    if (item) {
      setItemCode(item.item_code);
      if (!medicationName) {
        const matchMed = medications.find(
          (m) =>
            m.national_drug_code === item.item_code ||
            (m as any).linked_item_code === item.item_code ||
            (m.generic_name && m.generic_name.toLowerCase() === item.item_name?.toLowerCase())
        );
        if (matchMed) {
          handleMedicationChange(medicationLabel(matchMed));
        } else {
          setMedicationName(item.item_name || item.item_code);
        }
      }
    } else {
      setItemCode(val);
    }
  };

  // ── Handle Dosage / Duration Change -> Auto Recalculate Quantity ──────────
  const handleDosageChange = (newDosage: string) => {
    setDosage(newDosage);
    const newQty = calculateQuantity(newDosage, period);
    setQuantity(newQty);
    if (medicationName) {
      setOrderDescription(`${medicationName} - ${newDosage} for ${period || "7 Days"}`);
    }
  };

  const handlePeriodChange = (newPeriod: string) => {
    setPeriod(newPeriod);
    const newQty = calculateQuantity(dosage, newPeriod);
    setQuantity(newQty);
    if (medicationName) {
      setOrderDescription(`${medicationName} - ${dosage || "1-0-1"} for ${newPeriod}`);
    }
  };

  // ── Handle Order Group (Encounter) Change ─────────────────────────────────
  const handleOrderGroupChange = (encIdStr: string) => {
    const encId = Number(encIdStr) || null;
    setOrderGroupId(encId);
    if (encId) {
      setReasonReferenceDoctype("Patient Encounter");
      setReasonReference(String(encId));
    } else {
      setReasonReferenceDoctype("");
      setReasonReference("");
    }
  };

  // ── Codification Table Actions ────────────────────────────────────────────
  const handleAddCodingRow = () => {
    setCodificationTable((prev) => [
      ...prev,
      {
        id: `code-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        code_system: codeSystemsList[0] || "ICD-10",
        code_value: "",
        description: "",
      },
    ]);
  };

  const handleUpdateCodingRow = (id: string, patch: Partial<CodificationRow>) => {
    setCodificationTable((prev) =>
      prev.map((row) => (row.id === id ? { ...row, ...patch } : row))
    );
  };

  const handleRemoveCodingRow = (id: string) => {
    setCodificationTable((prev) => prev.filter((row) => row.id !== id));
  };

  // ── Check Allergy Conflict ────────────────────────────────────────────────
  const allergyConflict = useMemo(() => {
    if (!medicationName || patientAllergies.length === 0) return null;
    const lowerMed = medicationName.toLowerCase();
    for (const allergy of patientAllergies) {
      const lowerAllergy = allergy.toLowerCase();
      if (lowerMed.includes(lowerAllergy) || lowerAllergy.includes(lowerMed)) {
        return `⚠️ Conflict Alert: Patient has recorded allergy to "${allergy}"!`;
      }
    }
    return null;
  }, [medicationName, patientAllergies]);

  // ── Entity Options ────────────────────────────────────────────────────────
  const patientOptions: EntityOption[] = useMemo(() => {
    return patients.map((p) => ({
      value: p.id,
      label: p.patient_name,
      sublabel: `${p.patient_id} · ${p.sex || p.gender || "—"} · ${calculateMarleyAge(p.dob)}`,
      image: p.image,
      avatarName: p.patient_name,
    }));
  }, [patients]);

  const practitionerOptions: EntityOption[] = useMemo(() => {
    return practitioners.map((pr) => ({
      value: pr.id,
      label: pr.practitioner_name,
      sublabel: `${pr.department_name || "General"} · ${pr.mobile_phone || pr.email || ""}`,
      image: pr.image,
      avatarName: pr.practitioner_name,
    }));
  }, [practitioners]);

  const medicationOptions: string[] = useMemo(() => {
    const fromApi = medications
      .map((m) => medicationLabel(m))
      .filter((o) => typeof o === "string" && o.trim().length > 0);
    return Array.from(new Set([...fromApi, ...ETHIOPIAN_MEDICINE_OPTIONS]));
  }, [medications]);

  const stockItemOptions: string[] = useMemo(() => {
    return stockItems
      .map((it) => it.item_name || it.item_code)
      .filter((o) => typeof o === "string" && o.trim().length > 0);
  }, [stockItems]);

  // ── Save Medication Request ───────────────────────────────────────────────
  const handleSave = async () => {
    const errors: Record<string, string> = {};
    if (!namingSeries) errors.namingSeries = "Series is required.";
    if (!patientId) errors.patient = "Patient is required.";
    if (!medicationName && !medicationItem) errors.medication = "Medication or Medication Item is required.";
    if (!practitionerId) errors.practitioner = "Ordered by Practitioner is required.";
    if (!orderDate) errors.orderDate = "Order Date is required.";
    if (!orderTime) errors.orderTime = "Order Time is required.";
    if (!companyId) errors.company = "Company is required.";
    if (!dosageForm) errors.dosageForm = "Dosage Form is required.";
    if (!dosage) errors.dosage = "Dosage is required.";

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      toast.error("Please fill in all required fields marked with an asterisk (*).");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    if (allergyConflict) {
      if (!confirm(`${allergyConflict}\n\nDo you want to proceed with this medication order?`)) {
        return;
      }
    }

    setSaving(true);
    try {
      const payload: Record<string, any> = {
        naming_series: namingSeries,
        medication_name: medicationName || medicationItem,
        dosage_instruction: orderDescription || `${dosage} · ${period}`,
        dosage_form: dosageForm,
        dosage: dosage,
        period: period,
        order_date: orderDate,
        order_time: orderTime,
        expected_date: expectedDate || null,
        company: companyId,
        status: status,
        patient: patientId,
        practitioner: practitionerId,
        referred_to_practitioner: referredToPractitionerId || null,
        encounter: orderGroupId || null,
        sequence: sequence || 1,
        staff_role: staffRole,
        intent: intent,
        priority: priority,
        quantity: quantity || 1,
        number_of_repeats_allowed: numberOfRepeatsAllowed || 0,
        total_dispensable_quantity: totalDispensableQuantity,
        order_description: orderDescription,
        notes: comment,
        billing_status: billingStatus,
        qty_invoiced: qtyInvoiced || 0,
      };

      await HealthcareApi.medicationRequests.create(payload);

      toast.success("Medication Request saved successfully!");

      if (confirm("Medication Request created successfully! Would you like to print the official prescription slip now?")) {
        setShowPrintModal(true);
      } else {
        if (orderGroupId) {
          navigate(`/healthcare/encounters/${orderGroupId}`);
        } else {
          navigate(`/healthcare/pharmacy/medication-requests?patient=${patientId}`);
        }
      }
    } catch (err: any) {
      console.error("Failed to save Medication Request:", err);
      toast.error(
        err?.response?.data?.detail ||
          err?.response?.data?.message ||
          "Could not save Medication Request. Please verify all inputs."
      );
    } finally {
      setSaving(false);
    }
  };

  // ── Printable Item for Prescription Print Modal ────────────────────────────
  const printableItems: PrintableDrugItem[] = useMemo(() => {
    return [
      {
        drug_name: medicationName || medicationItem || "Medication Item",
        dosage: dosage,
        period: period,
        dosage_form: dosageForm,
        quantity: quantity,
        comment: orderDescription || comment,
      },
    ];
  }, [medicationName, medicationItem, dosage, period, dosageForm, quantity, orderDescription, comment]);

  return (
    <div className="max-w-5xl mx-auto pb-24 px-4 sm:px-6">
      {/* ── Header Bar (Standard Marley / Frappe Doc View) ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b py-4 mb-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
          <button
            type="button"
            onClick={() => navigate("/healthcare")}
            className="hover:text-foreground flex items-center gap-1"
          >
            <Icon icon="solar:home-2-bold" size={16} />
            <span>Healthcare</span>
          </button>
          <span>/</span>
          <button
            type="button"
            className="hover:text-foreground cursor-pointer"
            onClick={() => navigate("/healthcare/pharmacy/medication-requests")}
          >
            Medication Request
          </button>
          <span>/</span>
          <span className="text-foreground font-semibold">New Medication Request</span>
          <span className="ml-2 text-xs bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 px-2.5 py-0.5 rounded-full font-medium">
            Not Saved
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => navigate(-1)}
            disabled={saving}
          >
            <Icon icon="solar:arrow-left-bold" size={14} className="mr-1.5" />
            Back
          </Button>

          {selectedPatient && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowPrintModal(true)}
              className="border-slate-300 text-slate-700 hover:bg-slate-50 dark:hover:bg-slate-900"
            >
              <Icon icon="solar:printer-bold" size={14} className="mr-1.5 text-blue-600" />
              Print Prescription
            </Button>
          )}

          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={saving || loadingMasters}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium min-w-[80px]"
          >
            <Icon icon="solar:check-circle-bold" size={15} className="mr-1.5" />
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      {/* ── Main Marley DocType Form Card ── */}
      <div className="bg-card border border-border shadow-xs rounded-xl p-6 sm:p-8 space-y-8">
        {/* ── SECTION 1: Header / Series Details ──────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
          {/* Left Column */}
          <div className="space-y-4">
            <Field label="Series" required error={fieldErrors.namingSeries}>
              <select
                value={namingSeries}
                onChange={(e) => setNamingSeries(e.target.value)}
                className="w-full h-9 border border-border rounded-md px-3 text-sm bg-background"
              >
                <option value="HMR-">HMR-</option>
              </select>
            </Field>

            <Field label="Medication" error={fieldErrors.medication}>
              <div className="space-y-1">
                <Combobox
                  doctype="Medication"
                  options={medicationOptions}
                  rawItems={medications}
                  value={medicationName}
                  onChange={handleMedicationChange}
                  placeholder="Select or search Medication..."
                  className="w-full text-sm"
                />
                {/* Stock status indicator badge */}
                {checkingStock ? (
                  <span className="text-2xs text-muted-foreground animate-pulse flex items-center gap-1">
                    <Icon icon="solar:refresh-circle-bold" size={12} className="animate-spin" />
                    Checking stock availability...
                  </span>
                ) : stockStatus ? (
                  <div className="flex items-center gap-2 pt-0.5">
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-2xs font-semibold px-2 py-0.5",
                        stockStatus.in_stock
                          ? "bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300"
                          : "bg-red-50 text-red-800 border-red-300 dark:bg-red-950/40 dark:text-red-300"
                      )}
                    >
                      {stockStatus.in_stock
                        ? `✓ In Stock (${stockStatus.available_qty} units avail.)`
                        : "⚠️ Out of Stock"}
                    </Badge>
                    {stockStatus.warehouse && (
                      <span className="text-2xs text-muted-foreground">
                        Warehouse: {stockStatus.warehouse}
                      </span>
                    )}
                  </div>
                ) : null}
              </div>
            </Field>

            <Field label="Medication Item" required error={fieldErrors.medicationItem}>
              <Combobox
                doctype="Item"
                options={stockItemOptions}
                rawItems={stockItems}
                value={medicationItem}
                onChange={handleMedicationItemChange}
                placeholder="Select stock Item..."
                className="w-full text-sm"
              />
            </Field>

            <Field label="Order Date" required error={fieldErrors.orderDate}>
              <Input
                type="date"
                value={orderDate}
                onChange={(e) => setOrderDate(e.target.value)}
                className="h-9 text-sm"
              />
            </Field>

            <Field label="Order Time" required error={fieldErrors.orderTime}>
              <Input
                type="time"
                value={orderTime}
                onChange={(e) => setOrderTime(e.target.value)}
                className="h-9 text-sm"
              />
            </Field>

            <Field label="Expected By">
              <Input
                type="date"
                value={expectedDate}
                onChange={(e) => setExpectedDate(e.target.value)}
                className="h-9 text-sm"
              />
            </Field>
          </div>

          {/* Right Column (column_break_4) */}
          <div className="space-y-4">
            <Field label="Company" required error={fieldErrors.company}>
              <select
                value={companyId || ""}
                onChange={(e) => setCompanyId(Number(e.target.value) || null)}
                className="w-full h-9 border border-border rounded-md px-3 text-sm bg-background font-normal"
              >
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.company_name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Status" required>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full h-9 border border-border rounded-md px-3 text-sm bg-background font-medium"
              >
                <option value="Draft">Draft</option>
                <option value="Active">Active</option>
                <option value="On Hold">On Hold</option>
                <option value="Completed">Completed</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </Field>
          </div>
        </div>

        {/* ── SECTION 2: Patient Details (patient_detail_section) ─────────── */}
        <div className="pt-2">
          <div className="flex items-center justify-between pb-2 border-b border-border mb-4">
            <h3 className="text-sm font-semibold text-foreground tracking-tight flex items-center gap-2">
              <Icon icon="solar:user-bold" size={16} className="text-muted-foreground" />
              Patient Details
            </h3>
            {selectedPatient && (
              <Badge
                variant="outline"
                className={cn(
                  "text-xs font-semibold px-2.5 py-0.5",
                  selectedPatient.inpatient_status === "Admitted"
                    ? "bg-rose-50 text-rose-700 border-rose-300"
                    : "bg-emerald-50 text-emerald-700 border-emerald-300"
                )}
              >
                {selectedPatient.inpatient_status || "Outpatient"}
              </Badge>
            )}
          </div>

          {/* Patient Allergies Alert Banner */}
          {patientAllergies.length > 0 && (
            <div className="rounded-lg border border-amber-300 bg-amber-50/70 dark:bg-amber-950/30 p-3 mb-4 flex items-start gap-2.5">
              <Icon icon="solar:danger-triangle-bold" className="text-amber-600 shrink-0 mt-0.5" size={18} />
              <div className="flex-1 text-xs">
                <span className="font-semibold text-amber-900 dark:text-amber-200">
                  Patient Allergies Recorded:
                </span>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {patientAllergies.map((alg, i) => (
                    <Badge
                      key={i}
                      variant="outline"
                      className="bg-amber-200 text-amber-900 border-amber-300 text-2xs font-semibold"
                    >
                      {alg}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          )}

          {allergyConflict && (
            <div className="rounded-lg border border-red-400 bg-red-50 dark:bg-red-950/40 p-3 mb-4 text-xs font-semibold text-red-900 dark:text-red-200 flex items-center gap-2">
              <Icon icon="solar:shield-warning-bold" size={18} className="text-red-600 shrink-0" />
              <span>{allergyConflict}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
            {/* Left Column */}
            <div className="space-y-4">
              <Field label="Patient" required error={fieldErrors.patient}>
                <EntitySelect
                  doctype="Patient"
                  rawItems={patients}
                  options={patientOptions}
                  value={patientId}
                  onChange={(v) => setPatientId(v)}
                  placeholder="Select Patient..."
                  emptyText="No patients found"
                />
              </Field>

              <Field label="Patient Name">
                <ReadOnlyDisplay value={selectedPatient?.patient_name} />
              </Field>

              <Field label="Gender">
                <ReadOnlyDisplay value={selectedPatient?.sex || selectedPatient?.gender} />
              </Field>

              <Field label="Birth Date">
                <ReadOnlyDisplay value={selectedPatient?.dob} />
              </Field>

              <Field label="Patient Age">
                <ReadOnlyDisplay value={calculateMarleyAge(selectedPatient?.dob)} />
              </Field>

              <Field label="Blood Group">
                <ReadOnlyDisplay value={selectedPatient?.blood_group} />
              </Field>
            </div>

            {/* Right Column (column_break_16) */}
            <div className="space-y-4">
              <Field label="Email">
                <ReadOnlyDisplay value={selectedPatient?.email} />
              </Field>

              <Field label="Mobile">
                <ReadOnlyDisplay value={selectedPatient?.mobile || selectedPatient?.phone} />
              </Field>

              <Field label="Inpatient Record">
                <ReadOnlyDisplay
                  value={
                    selectedPatient?.inpatient_record ||
                    (selectedPatient as any)?.inpatient_record_id
                      ? `Record #${selectedPatient?.inpatient_record || (selectedPatient as any)?.inpatient_record_id}`
                      : ""
                  }
                />
              </Field>

              <Field label="Inpatient Status">
                <ReadOnlyDisplay value={selectedPatient?.inpatient_status || "Not Admitted"} />
              </Field>

              <Field label="Emergency Record">
                <ReadOnlyDisplay
                  value={
                    selectedPatient?.emergency_record
                      ? `ER #${selectedPatient.emergency_record}`
                      : ""
                  }
                />
              </Field>
            </div>
          </div>
        </div>

        {/* ── SECTION 3: Order Source (order_source_section, collapsible) ─── */}
        <div className="pt-2">
          <div
            className="flex items-center justify-between pb-2 border-b border-border mb-4 cursor-pointer select-none"
            onClick={() => setOrderSourceOpen((prev) => !prev)}
          >
            <h3 className="text-sm font-semibold text-foreground tracking-tight flex items-center gap-2">
              <Icon icon="solar:stethoscope-bold" size={16} className="text-muted-foreground" />
              Order Source
            </h3>
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground text-xs flex items-center gap-1 font-medium"
            >
              <span>{orderSourceOpen ? "Collapse" : "Expand"}</span>
              <Icon
                icon={orderSourceOpen ? "solar:alt-arrow-up-linear" : "solar:alt-arrow-down-linear"}
                size={14}
              />
            </button>
          </div>

          {orderSourceOpen && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
              {/* Left Column */}
              <div className="space-y-4">
                <Field label="Ordered by Practitioner" required error={fieldErrors.practitioner}>
                  <EntitySelect
                    doctype="Healthcare Practitioner"
                    rawItems={practitioners}
                    options={practitionerOptions}
                    value={practitionerId}
                    onChange={(v) => setPractitionerId(v)}
                    placeholder="Select Healthcare Practitioner..."
                    emptyText="No practitioners found"
                  />
                </Field>

                <Field label="Practitioner Name">
                  <ReadOnlyDisplay value={selectedPractitioner?.practitioner_name} />
                </Field>

                <Field label="Practitioner Email">
                  <ReadOnlyDisplay
                    value={selectedPractitioner?.email || (selectedPractitioner as any)?.user_id}
                  />
                </Field>

                <Field label="Medical Department">
                  <ReadOnlyDisplay
                    value={
                      selectedPractitioner?.department_name ||
                      (selectedPractitioner?.department ? String(selectedPractitioner.department) : "")
                    }
                  />
                </Field>

                <Field label="Referred to Practitioner">
                  <select
                    value={referredToPractitionerId || ""}
                    onChange={(e) => setReferredToPractitionerId(Number(e.target.value) || null)}
                    className="w-full h-9 border border-border rounded-md px-3 text-sm bg-background font-normal"
                  >
                    <option value="">None (Internal)</option>
                    {practitioners.map((pr) => (
                      <option key={pr.id} value={pr.id}>
                        {pr.practitioner_name} ({pr.department_name || "General"})
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              {/* Right Column (column_break_10) */}
              <div className="space-y-4">
                <Field label="Reason Reference DocType">
                  <ReadOnlyDisplay value={reasonReferenceDoctype} />
                </Field>

                <Field label="Reason Reference">
                  <ReadOnlyDisplay value={reasonReference} />
                </Field>

                <Field label="Order Group (Encounter)">
                  <select
                    value={orderGroupId || ""}
                    onChange={(e) => handleOrderGroupChange(e.target.value)}
                    className="w-full h-9 border border-border rounded-md px-3 text-sm bg-background font-normal"
                  >
                    <option value="">No linked encounter (Direct Order)</option>
                    {patientEncounters.map((enc) => (
                      <option key={enc.id} value={enc.id}>
                        Encounter #{enc.id} · {enc.encounter_date || "Date N/A"}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Sequence in Order Group">
                  <Input
                    type="number"
                    min={1}
                    value={sequence}
                    onChange={(e) => setSequence(parseInt(e.target.value, 10) || 1)}
                    className="h-9 text-sm"
                  />
                </Field>
              </div>
            </div>
          )}
        </div>

        {/* ── SECTION 4: Request Details (request_details_section) ────────── */}
        <div className="pt-2">
          <div className="pb-2 border-b border-border mb-4">
            <h3 className="text-sm font-semibold text-foreground tracking-tight flex items-center gap-2">
              <Icon icon="solar:clipboard-list-bold" size={16} className="text-muted-foreground" />
              Request Details
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
            {/* Left Column */}
            <div className="space-y-4">
              <Field label="Staff Role">
                <select
                  value={staffRole}
                  onChange={(e) => setStaffRole(e.target.value)}
                  className="w-full h-9 border border-border rounded-md px-3 text-sm bg-background font-normal"
                >
                  <option value="Physician">Physician</option>
                  <option value="Nursing User">Nursing User</option>
                  <option value="Pharmacist">Pharmacist</option>
                  <option value="Healthcare Administrator">Healthcare Administrator</option>
                </select>
              </Field>

              <Field label="Order Item Code">
                <ReadOnlyDisplay value={itemCode} />
              </Field>
            </div>

            {/* Right Column (column_break_14) */}
            <div className="space-y-4">
              <Field label="Intent">
                <select
                  value={intent}
                  onChange={(e) => setIntent(e.target.value)}
                  className="w-full h-9 border border-border rounded-md px-3 text-sm bg-background font-normal"
                >
                  <option value="Order">Order</option>
                  <option value="Plan">Plan</option>
                  <option value="Proposal">Proposal</option>
                  <option value="Directive">Directive</option>
                </select>
              </Field>

              <Field label="Priority">
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="w-full h-9 border border-border rounded-md px-3 text-sm bg-background font-normal"
                >
                  <option value="Routine">Routine</option>
                  <option value="Urgent">Urgent</option>
                  <option value="ASAP">ASAP</option>
                  <option value="STAT">STAT</option>
                </select>
              </Field>
            </div>
          </div>
        </div>

        {/* ── SECTION 5: Order Specifications (order_specs_section) ────────── */}
        <div className="pt-2">
          <div className="pb-2 border-b border-border mb-4">
            <h3 className="text-sm font-semibold text-foreground tracking-tight flex items-center gap-2">
              <Icon icon="solar:pills-bold" size={16} className="text-muted-foreground" />
              Order Specifications
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
            {/* Left Column */}
            <div className="space-y-4">
              <Field label="Quantity" required>
                <Input
                  type="number"
                  min={1}
                  value={quantity}
                  onChange={(e) => setQuantity(parseInt(e.target.value, 10) || 1)}
                  className="h-9 text-sm font-medium"
                />
              </Field>

              <Field label="Dosage Form" required error={fieldErrors.dosageForm}>
                <Combobox
                  doctype="Dosage Form"
                  options={dosageForms.map((df) => df.dosage_form)}
                  rawItems={dosageForms}
                  value={dosageForm}
                  onChange={setDosageForm}
                  placeholder="Select Dosage Form..."
                  className="w-full text-sm"
                />
              </Field>

              <Field label="Dosage" required error={fieldErrors.dosage}>
                <Combobox
                  doctype="Prescription Dosage"
                  options={dosages.map((d) => d.dosage)}
                  rawItems={dosages}
                  value={dosage}
                  onChange={handleDosageChange}
                  placeholder="Select Dosage (e.g. 1-0-1)..."
                  className="w-full text-sm"
                />
              </Field>

              <Field label="Number Of Repeats Allowed">
                <Input
                  type="number"
                  min={0}
                  value={numberOfRepeatsAllowed}
                  onChange={(e) => setNumberOfRepeatsAllowed(parseFloat(e.target.value) || 0)}
                  className="h-9 text-sm"
                />
              </Field>
            </div>

            {/* Right Column (column_break_91) */}
            <div className="space-y-4">
              <Field label="Period">
                <Combobox
                  doctype="Prescription Duration"
                  options={durations.map((dur) => `${dur.number} ${dur.period}`)}
                  rawItems={durations}
                  value={period}
                  onChange={handlePeriodChange}
                  placeholder="Select Duration (e.g. 7 Days)..."
                  className="w-full text-sm"
                />
              </Field>

              <Field label="Occurrence Time">
                <Input
                  type="time"
                  value={occurrenceTime}
                  onChange={(e) => setOccurrenceTime(e.target.value)}
                  className="h-9 text-sm"
                />
              </Field>

              <Field label="Total Dispensable Quantity">
                <ReadOnlyDisplay value={`${totalDispensableQuantity} units`} />
              </Field>

              <Field label="Order Description">
                <Textarea
                  value={orderDescription}
                  onChange={(e) => setOrderDescription(e.target.value)}
                  placeholder="Clinical description of the medication order..."
                  rows={2}
                  className="text-sm resize-none"
                />
              </Field>

              <Field label="Comment">
                <Textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Administration notes or pharmacist instructions..."
                  rows={2}
                  className="text-sm resize-none"
                />
              </Field>
            </div>
          </div>
        </div>

        {/* ── SECTION 6: Billing (billing_section) ─────────────────────────── */}
        <div className="pt-2">
          <div className="pb-2 border-b border-border mb-4">
            <h3 className="text-sm font-semibold text-foreground tracking-tight flex items-center gap-2">
              <Icon icon="solar:bill-list-bold" size={16} className="text-muted-foreground" />
              Billing
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
            {/* Left Column */}
            <div className="space-y-4">
              <Field label="Billing Status">
                <select
                  value={billingStatus}
                  onChange={(e) => setBillingStatus(e.target.value)}
                  className="w-full h-9 border border-border rounded-md px-3 text-sm bg-background font-normal"
                >
                  <option value="Pending">Pending</option>
                  <option value="Partly Invoiced">Partly Invoiced</option>
                  <option value="Invoiced">Invoiced</option>
                </select>
              </Field>

              <Field label="Quantity Invoiced">
                <ReadOnlyDisplay value={qtyInvoiced.toFixed(2)} />
              </Field>
            </div>

            {/* Right Column (column_break_26: empty) */}
            <div />
          </div>
        </div>

        {/* ── SECTION 7: Medical Coding (medical_code_section, collapsible) ── */}
        <div className="pt-2">
          <div
            className="flex items-center justify-between pb-2 border-b border-border mb-4 cursor-pointer select-none"
            onClick={() => setMedicalCodeOpen((prev) => !prev)}
          >
            <h3 className="text-sm font-semibold text-foreground tracking-tight flex items-center gap-2">
              <Icon icon="solar:tag-bold" size={16} className="text-muted-foreground" />
              Medical Coding
            </h3>
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground text-xs flex items-center gap-1 font-medium"
            >
              <span>{medicalCodeOpen ? "Collapse" : "Expand"}</span>
              <Icon
                icon={medicalCodeOpen ? "solar:alt-arrow-up-linear" : "solar:alt-arrow-down-linear"}
                size={14}
              />
            </button>
          </div>

          {medicalCodeOpen && (
            <div className="space-y-3">
              <div className="border border-border rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 border-b border-border text-muted-foreground font-medium">
                    <tr>
                      <th className="py-2 px-3 text-left w-12">No.</th>
                      <th className="py-2 px-3 text-left w-1/3">Code System</th>
                      <th className="py-2 px-3 text-left w-1/3">Code Value</th>
                      <th className="py-2 px-3 text-left">Description</th>
                      <th className="py-2 px-3 text-center w-12"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {codificationTable.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-muted-foreground">
                          No medical codes added yet. Click &quot;Add Row&quot; below to add diagnosis or drug codes.
                        </td>
                      </tr>
                    ) : (
                      codificationTable.map((row, idx) => (
                        <tr key={row.id} className="hover:bg-muted/20">
                          <td className="py-2 px-3 text-muted-foreground text-center">{idx + 1}</td>
                          <td className="py-2 px-3">
                            <select
                              value={row.code_system}
                              onChange={(e) =>
                                handleUpdateCodingRow(row.id, { code_system: e.target.value })
                              }
                              className="w-full h-8 border border-border rounded px-2 text-xs bg-background"
                            >
                              {codeSystemsList.map((cs) => (
                                <option key={cs} value={cs}>
                                  {cs}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="py-2 px-3">
                            <Input
                              value={row.code_value}
                              onChange={(e) =>
                                handleUpdateCodingRow(row.id, { code_value: e.target.value })
                              }
                              placeholder="e.g. J02.9 or 860215"
                              className="h-8 text-xs"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <Input
                              value={row.description}
                              onChange={(e) =>
                                handleUpdateCodingRow(row.id, { description: e.target.value })
                              }
                              placeholder="Code Description..."
                              className="h-8 text-xs"
                            />
                          </td>
                          <td className="py-2 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveCodingRow(row.id)}
                              className="text-red-500 hover:text-red-700 p-1"
                              title="Delete row"
                            >
                              <Icon icon="solar:trash-bin-trash-bold" size={14} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddCodingRow}
                className="text-xs h-8"
              >
                <Icon icon="solar:add-circle-bold" size={14} className="mr-1 text-slate-500" />
                Add Row
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* ── Official Prescription Slip Print Modal ───────────────────────── */}
      {selectedPatient && (
        <PrescriptionPrintModal
          open={showPrintModal}
          onOpenChange={(op) => {
            setShowPrintModal(op);
            if (!op) {
              if (orderGroupId) {
                navigate(`/healthcare/encounters/${orderGroupId}`);
              } else {
                navigate(`/healthcare/pharmacy/medication-requests?patient=${patientId}`);
              }
            }
          }}
          patientId={selectedPatient.patient_id || selectedPatient.id}
          cardNo={selectedPatient.eeu_staff_id || selectedPatient.patient_id || selectedPatient.uid || String(selectedPatient.id)}
          patientName={selectedPatient.patient_name}
          patientAge={calculateMarleyAge(selectedPatient.dob)}
          patientSex={selectedPatient.sex || selectedPatient.gender}
          patientWeight={(selectedPatient as any).weight || ""}
          region={selectedPatient.eeu_region || selectedPatient.state || "Addis Ababa"}
          town={selectedPatient.city || "Addis Ababa"}
          woreda={selectedPatient.territory || ""}
          kebele={selectedPatient.pincode || ""}
          houseNo={selectedPatient.address || ""}
          telNo={selectedPatient.mobile || selectedPatient.phone || ""}
          isInpatient={Boolean(selectedPatient.inpatient_record)}
          isOutpatient={!Boolean(selectedPatient.inpatient_record)}
          isEmergency={Boolean(selectedPatient.emergency_record)}
          practitionerName={selectedPractitioner?.practitioner_name}
          practitionerQualification={selectedPractitioner?.designation || "Medical Officer / Physician"}
          practitionerRegistration={selectedPractitioner?.practitioner_id || ""}
          departmentName={
            selectedPractitioner?.department_name ||
            (selectedPractitioner?.department ? String(selectedPractitioner.department) : "")
          }
          encounterDate={orderDate}
          drugRows={printableItems}
          companyName={
            companies.find((c) => c.id === companyId)?.company_name || "Healthcare Medical Center"
          }
        />
      )}
    </div>
  );
}
