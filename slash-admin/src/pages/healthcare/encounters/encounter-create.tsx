import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Icon } from "@/components/icon";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { Badge } from "@/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/ui/card";
import { HealthcareApi } from "@/api/services/healthcareService";
import EntitySelect from "@/components/healthcare/EntitySelect";
import Combobox from "@/components/healthcare/Combobox";
import MultiSelect from "@/components/healthcare/MultiSelect";
import EncounterGrid, {
  useExpandedRows,
} from "@/components/healthcare/EncounterGrid";
import { cn } from "@/utils";
import {
  INTENT_SYSTEM,
  PRIORITY_SYSTEM,
  emptyCoding,
  emptyDrug,
  emptyLab,
  emptyProcedure,
  emptyTherapy,
  codeValueLabel,
  medicationLabel,
  CodingRowView,
  DrugRowView,
  LabRowView,
  ProcedureRowView,
  TherapyRowView,
  type CodingRow,
  type DrugRow,
  type LabRow,
  type ProcedureRow,
  type TherapyRow,
} from "./encounterRows";
import { fieldOptions } from "./encounterMeta";
import { useDoctypePermissions } from "@/utils/permissions";
import { formatAge } from "@/utils/age";
import { createLinkSource, splitCodeDisplay, type LinkSource } from "@/utils/linkSource";
import ApplyTreatmentPlanDialog from "./ApplyTreatmentPlanDialog";
import PrescriptionPrintModal from "./PrescriptionPrintModal";
import CreateSymptomModal from "./CreateSymptomModal";
import { SYMPTOM_NAMES, getSymptomUrl } from "./symptomsData";
import CreateDiagnosisModal from "./CreateDiagnosisModal";
import { DIAGNOSIS_NAMES, getDiagnosisCode } from "./diagnosesData";
import {
  ETHIOPIAN_MEDICINE_OPTIONS,
  getEthiopianMedicineDefaults,
} from "../pharmacy/ethiopianMedicinesData";
import type {
  Patient,
  HealthcarePractitioner,
  AppointmentTypeConfig,
  MedicalDepartment,
  PatientAppointment,
  Company,
  EncounterFormMeta,
  CodeValue,
  LabTestTemplate,
  Medication,
} from "@/api/services/healthcareService";


const COMMON_SYMPTOMS = [
  "Fever",
  "Cough",
  "Headache",
  "Sore Throat",
  "Fatigue",
  "Nausea",
  "Chest Pain",
  "Abdominal Pain",
  "Shortness of Breath",
];

const COMMON_DIAGNOSES = [
  "Acute Pharyngitis",
  "Upper Respiratory Infection",
  "Essential Hypertension",
  "Type 2 Diabetes Mellitus",
  "Acute Bronchitis",
  "Gastroenteritis",
];

/** Hoisted so it isn't a fresh component type on every render */
function Field({
  label,
  required,
  error,
  hint,
  icon,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  icon?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className={cn("text-xs font-semibold flex items-center gap-1.5", error ? "text-destructive" : "text-muted-foreground")}>
          {icon && <Icon icon={icon} size={14} className="text-muted-foreground/70" />}
          <span>{label}</span>
          {required && <span className="text-destructive font-bold">*</span>}
        </Label>
        {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
      </div>
      <div>{children}</div>
      {error && (
        <p className="text-xs text-destructive font-medium flex items-center gap-1">
          <Icon icon="solar:danger-circle-bold" size={13} />
          {error}
        </p>
      )}
    </div>
  );
}

export default function EncounterCreatePage() {
  const { canCreate } = useDoctypePermissions("Patient Encounter");
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const patientParam = searchParams.get("patient");
  const practitionerParam = searchParams.get("practitioner");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{
    patient?: string;
    practitioner?: string;
    department?: string;
    impression?: string;
  }>({});
  const [patients, setPatients] = useState<Patient[]>([]);
  const [practitioners, setPractitioners] = useState<HealthcarePractitioner[]>([]);
  const [appointmentTypes, setAppointmentTypes] = useState<AppointmentTypeConfig[]>([]);
  const [departments, setDepartments] = useState<MedicalDepartment[]>([]);
  const [appointments, setAppointments] = useState<PatientAppointment[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  /** The form's field definitions — every Select's options come from here. */
  const [meta, setMeta] = useState<EncounterFormMeta | null>(null);

  // ── Link sources (Frappe Link semantics: pick or create) ──────────────────
  const sources = useRef<Record<string, LinkSource<any>>>({});
  /** Code system the next ad-hoc Code Value should be created under. */
  const pendingCodeSystem = useRef("");
  const [sourcesReady, setSourcesReady] = useState(0);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showCreateSymptomModal, setShowCreateSymptomModal] = useState(false);
  const [createSymptomInitial, setCreateSymptomInitial] = useState("");
  const [showCreateDiagnosisModal, setShowCreateDiagnosisModal] = useState(false);
  const [createDiagnosisInitial, setCreateDiagnosisInitial] = useState("");

  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [diagnoses, setDiagnoses] = useState<string[]>([]);

  const [codingRows, setCodingRows] = useState<CodingRow[]>([]);
  const [drugRows, setDrugRows] = useState<DrugRow[]>([]);
  const [labRows, setLabRows] = useState<LabRow[]>([]);
  const [procedureRows, setProcedureRows] = useState<ProcedureRow[]>([]);
  const [therapyRows, setTherapyRows] = useState<TherapyRow[]>([]);

  const drugDetails = useExpandedRows();
  const labDetails = useExpandedRows();
  const procedureDetails = useExpandedRows();
  const therapyDetails = useExpandedRows();

  const [activeSection, setActiveSection] = useState<string>("all");

  const [form, setForm] = useState({
    naming_series: "HLC-ENC-.YYYY.-",
    company: "EEU (Demo)",
    appointment: "",
    encounter_date: new Date().toISOString().split("T")[0],
    appointment_type: "",
    department: "",
    encounter_time: new Date().toTimeString().split(" ")[0],
    patient: patientParam ? Number(patientParam) : (null as number | null),
    practitioner: practitionerParam ? Number(practitionerParam) : (null as number | null),
    patient_name: "",
    gender: "",
    age: "",
    invoiced: false,
    source: "Direct",
    review_details: "",
    symptoms_in_print: true,
    diagnosis_in_print: true,
  });

  const selectedPatient = useMemo(() => {
    if (!form.patient) return null;
    return patients.find((p) => p.id === form.patient) || null;
  }, [form.patient, patients]);

  const selectedPractitioner = useMemo(() => {
    if (!form.practitioner) return null;
    return practitioners.find((p) => p.id === form.practitioner) || null;
  }, [form.practitioner, practitioners]);

  const toggleSymptom = (sym: string) => {
    if (symptoms.includes(sym)) {
      setSymptoms((prev) => prev.filter((s) => s !== sym));
    } else {
      setSymptoms((prev) => [...prev, sym]);
      if (fieldErrors.impression) {
        setFieldErrors((prev) => ({ ...prev, impression: undefined }));
      }
    }
  };

  const toggleDiagnosis = (diag: string) => {
    if (diagnoses.includes(diag)) {
      setDiagnoses((prev) => prev.filter((d) => d !== diag));
    } else {
      setDiagnoses((prev) => [...prev, diag]);
      if (fieldErrors.impression) {
        setFieldErrors((prev) => ({ ...prev, impression: undefined }));
      }
    }
  };

  useEffect(() => {
    Promise.all([
      HealthcareApi.patients.list({ page_size: 200 }).catch(() => ({ results: [] })),
      HealthcareApi.practitioners.list({ page_size: 200 }).catch(() => ({ results: [] })),
      HealthcareApi.appointmentTypes.list({ page_size: 200 }).catch(() => ({ results: [] })),
      HealthcareApi.departments.list({ page_size: 200 }).catch(() => ({ results: [] })),
      HealthcareApi.complaints.list({ page_size: 500 }).catch(() => ({ results: [] })),
      HealthcareApi.diagnosisCatalog.list({ page_size: 500 }).catch(() => ({ results: [] })),
      HealthcareApi.codeSystems.list({ page_size: 200 }).catch(() => ({ results: [] })),
      HealthcareApi.codeValues.list({ page_size: 1000 }).catch(() => ({ results: [] })),
      HealthcareApi.medications.list({ page_size: 500 }).catch(() => ({ results: [] })),
      HealthcareApi.stockItems.list({ page_size: 500 }).catch(() => ({ results: [] })),
      HealthcareApi.prescriptionDosages.list({ page_size: 200 }).catch(() => ({ results: [] })),
      HealthcareApi.prescriptionDurations.list({ page_size: 200 }).catch(() => ({ results: [] })),
      HealthcareApi.dosageForms.list({ page_size: 200 }).catch(() => ({ results: [] })),
      HealthcareApi.labTestTemplates.list({ page_size: 500 }).catch(() => ({ results: [] })),
      HealthcareApi.observationTemplates.list({ page_size: 500 }).catch(() => ({ results: [] })),
      HealthcareApi.patientCareTypes.list({ page_size: 200 }).catch(() => ({ results: [] })),
      HealthcareApi.procedureTemplates.list({ page_size: 500 }).catch(() => ({ results: [] })),
      HealthcareApi.therapyTypes.list({ page_size: 200 }).catch(() => ({ results: [] })),
      HealthcareApi.appointments.list({ page_size: 200 }).catch(() => ({ results: [] })),
      HealthcareApi.companies.list({ page_size: 200 }).catch(() => ({ results: [] })),
      HealthcareApi.encounters.meta().catch(() => null),
    ])
      .then(([pats, pracs, apptTypes, depts, ...rest]) => {
        setPatients(pats.results || []);
        setPractitioners(pracs.results || []);
        setAppointmentTypes(apptTypes.results || []);
        setDepartments(depts.results || []);

        // The meta is not a list response, so it comes off the tail of the
        // tuple before the rest are unwrapped.
        const formMetaTyped = (rest[rest.length - 1] || null) as unknown as EncounterFormMeta | null;
        const asItems = (r: any) => r?.results || [];
        const [
          complaints,
          catalog,
          systems,
          values,
          meds,
          items,
          dosages,
          durations,
          forms,
          labTemplates,
          obsTemplates,
          careTypes,
          procTemplates,
          therapyTypes,
          appts,
          comps,
        ] = rest.slice(0, -1).map(asItems);
        setAppointments(appts as PatientAppointment[]);
        setCompanies(comps as Company[]);
        if (formMetaTyped) setMeta(formMetaTyped);
        // Marley's `company` is a Link with no default of its own; fall back to
        // whichever company the setup app marks as the default one.
        const defaultCompany =
          (comps as Company[]).find((c) => c.is_default) ?? (comps as Company[])[0];
        if (defaultCompany) setForm((prev) => ({ ...prev, company: defaultCompany.company_name }));

        // One source per Link field on the form. `buildPayload` names the
        // field Marley's Link would create the new record with.
        sources.current = {
          complaints: createLinkSource(complaints, (c: any) => c.complaint, HealthcareApi.complaints.create as any, (n) => ({ complaint: n })),
          diagnosisCatalog: createLinkSource(catalog, (d: any) => d.diagnosis, HealthcareApi.diagnosisCatalog.create as any, (n) => ({ diagnosis: n })),
          codeSystems: createLinkSource(systems, (s: any) => s.code_system, HealthcareApi.codeSystems.create as any, (n) => ({ code_system: n })),
          medications: createLinkSource(meds, (m: Medication) => medicationLabel(m), HealthcareApi.medications.create as any, (n) => ({ generic_name: n })),
          stockItems: createLinkSource(items, (i: any) => i.item_code, async () => { throw new Error("read-only"); }, () => null),
          prescriptionDosages: createLinkSource(dosages, (d: any) => d.dosage, async () => { throw new Error("read-only"); }, () => null),
          prescriptionDurations: createLinkSource(durations, (d: any) => `${d.number} ${d.period}(s)`, async () => { throw new Error("read-only"); }, () => null),
          dosageForms: createLinkSource(forms, (d: any) => d.dosage_form, HealthcareApi.dosageForms.create as any, (n) => ({ dosage_form: n })),
          labTestTemplates: createLinkSource(labTemplates, (t: LabTestTemplate) => t.lab_test_name, async () => { throw new Error("read-only"); }, () => null),
          observationTemplates: createLinkSource(obsTemplates, (o: any) => o.observation, async () => { throw new Error("read-only"); }, () => null),
          patientCareTypes: createLinkSource(careTypes, (p: any) => p.patient_care_type, async () => { throw new Error("read-only"); }, () => null),
          procedureTemplates: createLinkSource(procTemplates, (p: any) => p.template_name, HealthcareApi.procedureTemplates.create as any, (n) => ({ template_name: n })),
          therapyTypes: createLinkSource(therapyTypes, (t: any) => t.therapy_type, HealthcareApi.therapyTypes.create as any, (n) => ({ therapy_type: n })),
        };

        // Code Values are a Frappe `hash`-named doctype reached only through a
        // Link, so the picker searches `code` and `display` and stores the
        // record — exactly what the Codification Table's `fetch_from` expects.
        const codeValues = values as CodeValue[];
        sources.current.codeValues = createLinkSource(
          codeValues,
          (v: CodeValue) => codeValueLabel(v),
          HealthcareApi.codeValues.create as any,
          (name) => {
            const { code, label } = splitCodeDisplay(name);
            const systemId = sources.current.codeSystems?.idFor(
              pendingCodeSystem.current
            );
            if (systemId == null) return null;
            return { code_system: systemId, code, display: label || code };
          }
        );

        setSourcesReady((n) => n + 1);
      })
      .catch((err) => {
        console.error("Failed to load encounter form options", err);
        setError("Could not load the form's option lists. Reload to try again.");
      });
  }, []);

  // ── Derived option lists ──────────────────────────────────────────────────
  const src = (name: string): LinkSource<any> | undefined => sources.current[name];
  const opts = (name: string): string[] => src(name)?.options ?? [];
  const reload = sourcesReady; // re-derive option arrays once sources land
  const appointmentTypeOptions = useMemo(
    () => appointmentTypes.map((a) => a.appointment_type),
    [appointmentTypes]
  );
  const departmentOptions = useMemo(() => departments.map((d) => d.department), [departments]);
  const practitionerOptions = useMemo(
    () => practitioners.map((p) => p.practitioner_name || `${p.first_name} ${p.last_name}`.trim()),
    [practitioners]
  );

  const optionSets = useMemo(
    () => ({
      complaints: Array.from(new Set([...(opts("complaints") || []), ...SYMPTOM_NAMES])),
      diagnosisCatalog: Array.from(new Set([...(opts("diagnosisCatalog") || []), ...DIAGNOSIS_NAMES])),
      codeSystems: opts("codeSystems"),
      codeValues: opts("codeValues"),
      medications: Array.from(new Set([...(opts("medications") || []), ...ETHIOPIAN_MEDICINE_OPTIONS])),
      stockItems: opts("stockItems"),
      prescriptionDosages: opts("prescriptionDosages"),
      prescriptionDurations: opts("prescriptionDurations"),
      dosageForms: opts("dosageForms"),
      labTestTemplates: opts("labTestTemplates"),
      observationTemplates: opts("observationTemplates"),
      patientCareTypes: opts("patientCareTypes"),
      procedureTemplates: opts("procedureTemplates"),
      therapyTypes: opts("therapyTypes"),
      departments: departmentOptions,
      // Marley's `interval_uom` is a Select on Drug Prescription — its options
      // come from the doctype meta, not from this file.
      intervalUom: fieldOptions(meta, "interval_uom", "drug_prescription"),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [reload, meta]
  );

  /** Marley's Select options for a Patient Encounter field. */
  const encounterOptions = (fieldname: string) => fieldOptions(meta, fieldname);

  // Intent / Priority are Code Values scoped to their own code systems.
  const intentOptions = useMemo(
    () => codeValuesOfSystem(INTENT_SYSTEM),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [reload]
  );
  const priorityOptions = useMemo(
    () => codeValuesOfSystem(PRIORITY_SYSTEM),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [reload]
  );

  function codeValuesOfSystem(systemName: string): string[] {
    const systemId = sources.current.codeSystems?.idFor(systemName);
    if (systemId == null) return [];
    return (sources.current.codeValues?.items ?? [])
      .filter((v: CodeValue) => v.code_system === systemId)
      .map(codeValueLabel);
  }


  /** Code Values are scoped to the row's chosen code system (Marley's
   *  `set_query("code_value", "codification_table", …)`). */
  const codeValuesFor = (systemName: string): string[] => {
    const systemId = src("codeSystems")?.idFor(systemName);
    if (systemId == null) return [];
    return (src("codeValues")?.items ?? [])
      .filter((v: CodeValue) => v.code_system === systemId)
      .map(codeValueLabel);
  };

  // ── Patient handling ──────────────────────────────────────────────────────
  const applyPatient = (p: Partial<Patient>, pid: number) => {
    setForm((prev) => ({
      ...prev,
      patient: pid,
      patient_name: p.patient_name || `${p.first_name || ""} ${p.last_name || ""}`.trim(),
      gender: p.sex || "",
      age: formatAge(p.dob, p.age),
    }));
  };

  useEffect(() => {
    if (!patientParam) return;
    const pid = Number(patientParam);
    setForm((prev) => ({ ...prev, patient: pid }));
    HealthcareApi.patients
      .get(pid)
      .then((p: any) => applyPatient(p, pid))
      .catch(() => { });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientParam]);

  const handlePatientChange = (pid: number) => {
    const p = patients.find((x) => x.id === pid);
    if (p) applyPatient(p, pid);
    else setForm((prev) => ({ ...prev, patient: pid, patient_name: "", gender: "", age: "" }));
    if (fieldErrors.patient) {
      setFieldErrors((prev) => ({ ...prev, patient: undefined }));
    }
  };

  /**
   * Marley fetches the encounter's department from the practitioner
   * (`fetch_from: practitioner.department`). Changing the practitioner
   * pre-fills it if empty; the user can freely change or clear it.
   */
  const handlePractitionerChange = (pid: number | null) => {
    const p = practitioners.find((x) => x.id === pid);
    setForm((prev) => ({
      ...prev,
      practitioner: pid,
      department: prev.department || p?.department_name || "",
    }));
    if (fieldErrors.practitioner) {
      setFieldErrors((prev) => ({ ...prev, practitioner: undefined }));
    }
    if ((p?.department_name || form.department) && fieldErrors.department) {
      setFieldErrors((prev) => ({ ...prev, department: undefined }));
    }
  };

  const update = (key: string, value: any) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (fieldErrors[key as keyof typeof fieldErrors]) {
      setFieldErrors((prev) => ({ ...prev, [key]: undefined }));
    }
  };

  const saveEncounterContextToStorage = () => {
    try {
      const practitionerMatch = practitioners.find((p) => p.id === form.practitioner);
      const payload = {
        encounterId: null,
        patientId: form.patient,
        patientName: form.patient_name,
        patientAge: form.age,
        patientSex: form.gender,
        practitionerId: form.practitioner,
        practitionerName: practitionerMatch?.practitioner_name || "",
        departmentName: form.department || "",
        companyName: form.company,
        encounterDate: form.encounter_date,
        appointmentType: form.appointment_type,
        comment: form.review_details || "",
        diagnoses: diagnoses.filter(Boolean),
        symptoms: symptoms.filter(Boolean),
        medications: drugRows
          .map((d) => `${d.medication || d.drug_name || d.drug_code || ""} ${d.dosage || ""} ${d.period || ""}`.trim())
          .filter(Boolean),
        labs: labRows
          .map((l) => `${l.lab_test_name || l.lab_test_code || ""}${l.lab_test_comment ? ` (${l.lab_test_comment})` : ""}`.trim())
          .filter(Boolean),
        procedures: procedureRows
          .map((p) => `${p.procedure_name || p.procedure || ""}${p.comments ? ` (${p.comments})` : ""}`.trim())
          .filter(Boolean),
      };
      sessionStorage.setItem("active_encounter_context", JSON.stringify(payload));
    } catch (e) {
      console.warn("Could not save encounter context", e);
    }
  };

  const handleOpenReferral = () => {
    if (!form.patient) {
      setError("Please select a patient before creating an external referral.");
      return;
    }
    setError("");
    saveEncounterContextToStorage();
    const params = new URLSearchParams();
    params.set("patient", String(form.patient));
    if (form.practitioner) params.set("practitioner", String(form.practitioner));
    navigate(`/healthcare/external-referrals/new?${params.toString()}`);
  };

  const handleOpenLeaveSlip = () => {
    if (!form.patient) {
      setError("Please select a patient before creating a medical leave slip.");
      return;
    }
    setError("");
    saveEncounterContextToStorage();
    const params = new URLSearchParams();
    params.set("patient", String(form.patient));
    if (form.practitioner) params.set("practitioner", String(form.practitioner));
    navigate(`/healthcare/medical-leave-slips/new?${params.toString()}`);
  };

  const handleOpenMedReq = () => {
    if (!form.patient) {
      setError("Please select a patient before creating a medication request.");
      return;
    }
    setError("");
    const params = new URLSearchParams();
    params.set("patient", String(form.patient));
    if (form.practitioner) params.set("practitioner", String(form.practitioner));
    navigate(`/healthcare/pharmacy/medication-requests/new?${params.toString()}`);
  };

  const handleOpenPrintModal = () => {
    setShowPrintModal(true);
  };

  // ── Row helpers ───────────────────────────────────────────────────────────
  const upd =
    <T,>(setter: React.Dispatch<React.SetStateAction<T[]>>) =>
      (i: number, key: keyof T, value: any) =>
        setter((prev) => prev.map((r, idx) => (idx === i ? { ...r, [key]: value } : r)));
  const rm =
    <T,>(setter: React.Dispatch<React.SetStateAction<T[]>>) =>
      (i: number) =>
        setter((prev) => prev.filter((_, idx) => idx !== i));

  const updateCoding = upd(setCodingRows);
  const updateDrug = upd(setDrugRows);
  const updateLab = upd(setLabRows);
  const updateProcedure = upd(setProcedureRows);
  const updateTherapy = upd(setTherapyRows);

  const removeCoding = rm(setCodingRows);
  const removeDrug = rm(setDrugRows);
  const removeLab = rm(setLabRows);
  const removeProcedure = rm(setProcedureRows);
  const removeTherapy = rm(setTherapyRows);

  /** Real-time stock status cache */
  const [stockMap, setStockMap] = useState<
    Record<string, { in_stock: boolean; available_qty: number; warehouse?: string }>
  >({});

  const checkDrugStock = useCallback(async (nameOrCode: string, rowIndex?: number) => {
    if (!nameOrCode.trim()) return;
    if (rowIndex !== undefined) {
      setDrugRows((prev) =>
        prev.map((r, idx) => (idx === rowIndex ? { ...r, checking_stock: true } : r))
      );
    }
    try {
      const res = await HealthcareApi.medications.checkStockBatch([nameOrCode]);
      const data =
        res?.results?.[nameOrCode] ||
        res?.results?.[nameOrCode.toLowerCase()] ||
        res?.results?.[nameOrCode.trim()];
      if (data) {
        setStockMap((prev) => ({
          ...prev,
          [nameOrCode]: data,
          [nameOrCode.toLowerCase()]: data,
          ...(data.item_code ? { [data.item_code]: data, [data.item_code.toLowerCase()]: data } : {}),
        }));
        if (rowIndex !== undefined) {
          setDrugRows((prev) =>
            prev.map((r, idx) =>
              idx === rowIndex
                ? {
                  ...r,
                  in_stock: data.in_stock,
                  available_qty: data.available_qty,
                  warehouse: data.warehouse,
                  checking_stock: false,
                }
                : r
            )
          );
        }
      } else if (rowIndex !== undefined) {
        setDrugRows((prev) =>
          prev.map((r, idx) =>
            idx === rowIndex
              ? {
                ...r,
                in_stock: false,
                available_qty: 0,
                checking_stock: false,
              }
              : r
          )
        );
      }
    } catch {
      if (rowIndex !== undefined) {
        setDrugRows((prev) =>
          prev.map((r, idx) => (idx === rowIndex ? { ...r, checking_stock: false } : r))
        );
      }
    }
  }, []);

  // Pre-fetch stock status for all loaded medications
  useEffect(() => {
    const meds = src("medications")?.items ?? [];
    if (meds.length === 0) return;
    const names = meds.map((m: Medication) => medicationLabel(m)).filter(Boolean);
    if (names.length === 0) return;
    HealthcareApi.medications
      .checkStockBatch(names)
      .then((res) => {
        if (res?.results) {
          setStockMap((prev) => ({ ...prev, ...res.results }));
        }
      })
      .catch(() => { });
  }, [src("medications")?.items?.length]);

  // Real-time stock status sync for rows
  useEffect(() => {
    const targets = drugRows
      .map((r, idx) => ({
        idx,
        query: r.drug_code || r.medication || r.drug_name,
      }))
      .filter((t) => Boolean(t.query));

    if (targets.length === 0) return;

    targets.forEach(({ idx, query }) => {
      const cached = stockMap[query] || stockMap[query.toLowerCase()];
      if (cached) {
        setDrugRows((prev) =>
          prev.map((r, i) =>
            i === idx && (r.in_stock !== cached.in_stock || r.available_qty !== cached.available_qty)
              ? { ...r, in_stock: cached.in_stock, available_qty: cached.available_qty, checking_stock: false }
              : r
          )
        );
      } else {
        checkDrugStock(query, idx);
      }
    });
  }, [drugRows.map((r) => `${r.medication}|${r.drug_code}`).join(",")]);

  /** Marley fetches `drug_name` from the chosen stock Item. */
  const onDrugCodeChange = (i: number, code: string) => {
    const item = (src("stockItems")?.items ?? []).find((it: any) => it.item_code === code);
    const cached = stockMap[code] || stockMap[code.toLowerCase()];
    setDrugRows((prev) =>
      prev.map((r, idx) =>
        idx === i
          ? {
            ...r,
            drug_code: code,
            drug_name: item?.item_name || "",
            in_stock: cached ? cached.in_stock : undefined,
            available_qty: cached ? cached.available_qty : undefined,
            checking_stock: !cached,
          }
          : r
      )
    );
    checkDrugStock(code, i);
  };

  /**
   * Picking a Medication fills the row from the medication's own defaults —
   * Marley's `fetch_from` on Drug Prescription:
   *   dosage/period/dosage_form/interval/interval_uom <- medication.default_*
   * Also automatically populates the `drug_code` from the item code or national drug code.
   */
  const onMedicationChange = (i: number, name: string) => {
    const med = (src("medications")?.items ?? []).find(
      (m: Medication) => medicationLabel(m) === name
    ) as Medication | undefined;
    if (!med) {
      const ethMed = getEthiopianMedicineDefaults(name);
      if (ethMed) {
        const drugCode = ethMed.sub_code || ethMed.major_code || "";
        const drugName = ethMed.generic_name || name;
        const cached = stockMap[drugCode] || stockMap[name] || stockMap[drugName] || stockMap[name.toLowerCase()];

        setDrugRows((prev) =>
          prev.map((r, idx) =>
            idx === i
              ? {
                ...r,
                medication: name,
                drug_code: drugCode || r.drug_code || "",
                drug_name: drugName || r.drug_name || "",
                dosage: r.dosage || ethMed.default_dosage || "1-0-1",
                period: r.period || ethMed.default_period || "7 Days",
                dosage_form: r.dosage_form || ethMed.primary_dosage_form || "Tablet",
                comment: r.comment || ethMed.dosage_form_and_strength || "",
                in_stock: cached ? cached.in_stock : undefined,
                available_qty: cached ? cached.available_qty : undefined,
                checking_stock: !cached,
              }
              : r
          )
        );
        checkDrugStock(drugCode || name, i);
        return;
      }

      setDrugRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, medication: name } : r)));
      checkDrugStock(name, i);
      return;
    }
    const formName = (src("dosageForms")?.items ?? []).find(
      (f: any) => f.id === med.dosage_form
    )?.dosage_form;
    const stockItems = src("stockItems")?.items ?? [];
    const stockItem = stockItems.find(
      (it: any) =>
        ((med as any).linked_item_code && it.item_code === (med as any).linked_item_code) ||
        (med.national_drug_code && it.item_code === med.national_drug_code) ||
        (it.item_name && it.item_name.toLowerCase() === med.generic_name?.toLowerCase()) ||
        (it.item_code && it.item_code.toLowerCase() === med.generic_name?.toLowerCase()) ||
        (it.item_name && med.generic_name && it.item_name.toLowerCase().includes(med.generic_name.toLowerCase())) ||
        (it.item_code && med.generic_name && it.item_code.toLowerCase().includes(med.generic_name.toLowerCase()))
    );

    const drugCode = stockItem?.item_code || med.national_drug_code || "";
    const drugName = stockItem?.item_name || med.generic_name || "";
    const cached = stockMap[drugCode] || stockMap[name] || stockMap[drugName] || stockMap[name.toLowerCase()];

    setDrugRows((prev) =>
      prev.map((r, idx) =>
        idx === i
          ? {
            ...r,
            medication: name,
            drug_code: drugCode || r.drug_code || "",
            drug_name: drugName || r.drug_name || "",
            dosage: r.dosage || med.default_prescription_dosage || "",
            period: r.period || med.default_prescription_duration || "",
            dosage_form: r.dosage_form || formName || "",
            interval: r.interval || med.default_interval || "",
            interval_uom: r.interval_uom || med.default_interval_uom || "",
            in_stock: cached ? cached.in_stock : undefined,
            available_qty: cached ? cached.available_qty : undefined,
            checking_stock: !cached,
          }
          : r
      )
    );

    checkDrugStock(drugCode || name, i);
  };

  /** Marley fetches `lab_test_name` from the chosen Lab Test Template. */
  const onLabCodeChange = (i: number, code: string) => {
    const tpl = (src("labTestTemplates")?.items ?? []).find(
      (t: LabTestTemplate) => t.lab_test_name === code
    );
    setLabRows((prev) =>
      prev.map((r, idx) =>
        idx === i
          ? {
            ...r,
            lab_test_code: code,
            lab_test_name: tpl?.lab_test_name || code,
            observation_template: code,
          }
          : r
      )
    );
  };

  /** Marley fetches `procedure_name` and `department` from the template. */
  const onProcedureChange = (i: number, name: string) => {
    const tpl = (src("procedureTemplates")?.items ?? []).find(
      (t: any) => t.template_name === name
    );
    const dept = departments.find((d) => d.id === tpl?.department);
    setProcedureRows((prev) =>
      prev.map((r, idx) =>
        idx === i
          ? {
            ...r,
            procedure: name,
            procedure_name: tpl?.template_name || name,
            department: dept?.department || r.department,
          }
          : r
      )
    );
  };

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setError("");
    const errors: typeof fieldErrors = {};
    if (!form.patient) errors.patient = "Patient is required.";
    if (!form.practitioner) errors.practitioner = "Healthcare Practitioner is required.";
    if (!form.department) errors.department = "Department is required.";
    if (symptoms.length === 0 && diagnoses.length === 0) {
      errors.impression = "At least one Symptom or Diagnosis is required.";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setError("Please fill in all required fields marked below.");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setFieldErrors({});
    setSaving(true);
    try {
      const payload: any = {
        patient: form.patient,
        practitioner: form.practitioner || null,
        encounter_date: form.encounter_date,
        encounter_time: form.encounter_time || null,
        department: departments.find((d) => d.department === form.department)?.id ?? null,
        appointment_type:
          appointmentTypes.find((a) => a.appointment_type === form.appointment_type)?.id ?? null,
        source: form.source,
        // Marley's "Review Details" is the encounter_comment Small Text.
        encounter_comment: form.review_details,
        symptoms_in_print: form.symptoms_in_print,
        diagnosis_in_print: form.diagnosis_in_print,
        invoiced: form.invoiced,
      };
      const encounter: any = await HealthcareApi.encounters.create(payload);

      // Encounter Impression — child rows, created after the encounter exists.
      for (const name of symptoms) {
        const complaint_master = await src("complaints")?.ensure(name);
        await HealthcareApi.encounterSymptoms
          .create({ encounter: encounter.id, symptom: name, complaint_master } as any)
          .catch(() => { });
      }
      for (const [i, name] of diagnoses.entries()) {
        const diagnosis_master = await src("diagnosisCatalog")?.ensure(name);
        await HealthcareApi.encounterDiagnoses
          .create({
            encounter: encounter.id,
            diagnosis: name,
            diagnosis_master,
            is_primary: i === 0,
          } as any)
          .catch(() => { });
      }

      // Medical Coding — code, display and definition are denormalised off the
      // chosen Code Value by the model's save(), as Marley's fetch_from does.
      for (const row of codingRows) {
        if (!row.code_system) continue;
        const code_system = await src("codeSystems")?.ensure(row.code_system);
        pendingCodeSystem.current = row.code_system;
        const code_value = row.code_value
          ? await src("codeValues")?.ensure(row.code_value)
          : null;
        const system = src("codeSystems")?.items.find(
          (s: any) => s.code_system === row.code_system
        );
        await HealthcareApi.codificationTable
          .create({
            encounter: encounter.id,
            code_system,
            is_fhir_defined: system?.is_fhir_defined ?? false,
            code_value,
          } as any)
          .catch(() => { });
      }

      const careTypeId = async (name: string) =>
        name ? await src("patientCareTypes")?.ensure(name) : null;

      // Medications
      for (const rx of drugRows) {
        if (!rx.drug_code && !rx.medication) continue;
        await HealthcareApi.prescriptions
          .create({
            patient: form.patient,
            practitioner: form.practitioner,
            encounter: encounter.id,
            medication_name: rx.drug_name || rx.medication,
            medication: rx.medication ? await src("medications")?.ensure(rx.medication).catch(() => null) : null,
            drug_code: rx.drug_code,
            dosage: rx.dosage || "",
            period: rx.period || "",
            dosage_form: rx.dosage_form || "Tablet",
            comment: rx.comment || "",
            interval: rx.interval || "",
            interval_uom: rx.interval_uom || "",
            number_of_repeats_allowed: Number(rx.number_of_repeats_allowed) || 0,
            intent: rx.intent || "Order",
            priority: rx.priority || "Routine",
          } as any)
          .catch(() => { });
      }

      // Investigations
      for (const lt of labRows) {
        if (!lt.lab_test_code) continue;
        await HealthcareApi.labPrescriptions
          .create({
            patient: form.patient,
            encounter: encounter.id,
            lab_test_code: await src("labTestTemplates")?.ensure(lt.lab_test_code),
            lab_test_name: lt.lab_test_name || lt.lab_test_code,
            lab_test_comment: lt.lab_test_comment || "",
            observation_template: lt.observation_template
              ? await src("observationTemplates")?.ensure(lt.observation_template)
              : null,
            patient_care_type: await careTypeId(lt.patient_care_type),
            intent: lt.intent,
            priority: lt.priority,
          } as any)
          .catch(() => { });
      }

      // Procedures
      for (const pr of procedureRows) {
        if (!pr.procedure) continue;
        await HealthcareApi.procedurePrescriptions
          .create({
            patient: form.patient,
            encounter: encounter.id,
            procedure: await src("procedureTemplates")?.ensure(pr.procedure),
            procedure_name: pr.procedure_name,
            department: departments.find((d) => d.department === pr.department)?.id ?? null,
            practitioner:
              practitioners.find(
                (p) => (p.practitioner_name || `${p.first_name} ${p.last_name}`.trim()) === pr.practitioner
              )?.id ?? null,
            date: pr.date || null,
            comments: pr.comments,
            no_of_sessions: Number(pr.no_of_sessions) || 1,
            interval: pr.interval,
            patient_care_type: await careTypeId(pr.patient_care_type),
            intent: pr.intent,
            priority: pr.priority,
          } as any)
          .catch(() => { });
      }

      // Rehabilitation — the encounter's Therapy Plan Detail rows. The Therapy
      // Plan itself is created on submit.
      for (const th of therapyRows) {
        if (!th.therapy_type) continue;
        await HealthcareApi.therapyPlanDetails
          .create({
            patient: form.patient,
            encounter: encounter.id,
            therapy_type: await src("therapyTypes")?.ensure(th.therapy_type),
            no_of_sessions: Number(th.no_of_sessions) || 1,
            interval: th.interval,
            patient_care_type: await careTypeId(th.patient_care_type),
            intent: th.intent,
            priority: th.priority,
          } as any)
          .catch(() => { });
      }

      navigate(`/healthcare/encounters/${encounter.id}`);
    } catch (err: any) {
      console.error(err);
      setError(
        err?.response?.data
          ? Object.entries(err.response.data)
            .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`)
            .join(" · ")
          : "Could not save the encounter. Please try again."
      );
    } finally {
      setSaving(false);
    }
  };

  // Global Ctrl+S / Cmd+S shortcut to save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSave]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen pb-32">
      {/* ── Sticky Top Command Bar ───────────────────────────────────────── */}
      <div className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur-md transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <button
              type="button"
              onClick={() => navigate("/healthcare")}
              className="hover:text-foreground transition-colors p-1 rounded-md hover:bg-muted"
              title="Healthcare Home"
            >
              <Icon icon="solar:home-2-bold" size={16} />
            </button>
            <span className="text-muted-foreground/40">/</span>
            <span
              className="hover:text-foreground cursor-pointer transition-colors"
              onClick={() => navigate("/healthcare/encounters")}
            >
              Outpatient
            </span>
            <span className="text-muted-foreground/40">/</span>
            <span
              className="hover:text-foreground cursor-pointer transition-colors"
              onClick={() => navigate("/healthcare/encounters")}
            >
              Patient Encounters
            </span>
            <span className="text-muted-foreground/40">/</span>
            <span className="text-foreground font-semibold">New Encounter</span>

            <Badge
              variant="outline"
              className="ml-2 bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30 text-2xs font-semibold gap-1.5 py-0.5"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
              Draft Consultation
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowTemplateDialog(true)}
              className="border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-xs h-8"
            >
              <Icon icon="solar:notes-bold-duotone" size={15} className="mr-1.5 text-emerald-600 dark:text-emerald-400" />
              Apply Template
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleOpenPrintModal}
              className="text-xs h-8"
            >
              <Icon icon="solar:printer-bold" size={14} className="mr-1.5" />
              Prescription Slip
            </Button>

            {/* Clinical Documents Actions */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleOpenReferral}
              className="text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 border-blue-200 dark:border-blue-900 text-xs h-8"
              title="Referral Out Document"
            >
              <Icon icon="solar:share-circle-bold" size={14} className="mr-1.5" />
              Referral Out
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleOpenLeaveSlip}
              className="text-teal-700 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-950/40 border-teal-200 dark:border-teal-900 text-xs h-8"
              title="Medical Leave Slip"
            >
              <Icon icon="solar:diploma-verified-bold" size={14} className="mr-1.5" />
              Medical Leave
            </Button>

            <Button
              type="button"
              onClick={handleSave}
              disabled={saving || !canCreate}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs h-8 px-3.5 shadow-sm"
            >
              {saving ? (
                <>
                  <Icon icon="solar:spinner-line-duotone" size={14} className="mr-1.5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Icon icon="solar:disk-bold" size={14} className="mr-1.5" />
                  Save
                  <kbd className="ml-1.5 hidden sm:inline-block px-1 py-0.2 text-[9px] bg-emerald-800/60 rounded text-emerald-100 font-mono">
                    ⌘S
                  </kbd>
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Error Banner */}
        {error && (
          <div className="rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 p-4 text-sm text-rose-800 dark:text-rose-300 flex items-start gap-3 shadow-xs">
            <Icon icon="solar:danger-triangle-bold" size={18} className="text-rose-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Unable to Save Encounter</p>
              <p className="text-xs mt-0.5 opacity-90">{error}</p>
            </div>
          </div>
        )}

        {/* ── Patient Context Hero Banner ─────────────────────────────────── */}
        {selectedPatient ? (
          <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-card via-card to-primary/5 p-5 shadow-xs transition-all">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 text-primary font-bold text-lg shadow-inner">
                  {selectedPatient.image ? (
                    <img
                      src={selectedPatient.image}
                      alt={form.patient_name}
                      className="h-full w-full rounded-2xl object-cover"
                    />
                  ) : (
                    <span>{form.patient_name ? form.patient_name.slice(0, 2).toUpperCase() : "PT"}</span>
                  )}
                  <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-background">
                    <Icon icon="solar:check-circle-bold" size={10} className="text-white" />
                  </span>
                </div>

                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-bold tracking-tight text-foreground">{form.patient_name}</h2>
                    <Badge variant="outline" className="font-mono text-2xs font-semibold bg-muted/60 text-muted-foreground border-border/80">
                      {selectedPatient.patient_id || `#PAT-${selectedPatient.id}`}
                    </Badge>
                    <Badge variant="outline" className="text-2xs bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20">
                      Outpatient
                    </Badge>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
                    {form.age && (
                      <span className="flex items-center gap-1 font-medium">
                        <Icon icon="solar:user-id-bold" size={13} className="text-primary/70" />
                        {form.age} {form.gender ? `• ${form.gender}` : ""}
                      </span>
                    )}
                    {selectedPatient.blood_group && (
                      <span className="flex items-center gap-1 font-medium text-rose-600 dark:text-rose-400">
                        <Icon icon="solar:drop-bold" size={13} />
                        Blood Group: {selectedPatient.blood_group}
                      </span>
                    )}
                    {selectedPatient.mobile && (
                      <span className="flex items-center gap-1">
                        <Icon icon="solar:phone-bold" size={13} className="text-muted-foreground/70" />
                        {selectedPatient.mobile}
                      </span>
                    )}
                  </div>

                  {/* Allergy Alert */}
                  <div className="mt-2.5 flex items-center gap-2">
                    {selectedPatient.allergies ? (
                      <span className="inline-flex items-center gap-1.5 text-2xs font-semibold px-2.5 py-0.5 rounded-full bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30">
                        <Icon icon="solar:danger-triangle-bold" size={12} className="text-rose-600" />
                        Allergies: {selectedPatient.allergies}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-2xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                        <Icon icon="solar:shield-check-bold" size={12} className="text-emerald-600" />
                        No Known Drug Allergies (NKDA)
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end md:self-center">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/healthcare/vital-signs?patient=${form.patient}`)}
                  className="text-xs h-8 border-primary/20 text-primary hover:bg-primary/5"
                >
                  <Icon icon="solar:heart-pulse-bold" size={14} className="mr-1.5 text-rose-500" />
                  Vital Signs
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-primary/30 bg-primary/5 p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                <Icon icon="solar:user-bold-duotone" size={22} />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-foreground">Clinical Consultation File</h4>
                <p className="text-xs text-muted-foreground">Select a patient below to display demographic details, allergy alerts, and medical history.</p>
              </div>
            </div>
            <Badge variant="outline" className="bg-background text-muted-foreground text-2xs">
              Awaiting Patient
            </Badge>
          </div>
        )}

        {/* ── Segmented Section Navigation Strip ───────────────────────────── */}
        <div className="sticky top-[57px] z-20 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-2.5 bg-background/95 backdrop-blur-md border-b flex items-center justify-between gap-2 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-1.5">
            {[
              { id: "all", label: "All Sections", icon: "solar:widget-2-bold" },
              { id: "sec-visit", label: "Visit Details", icon: "solar:stethoscope-bold" },
              { id: "sec-impression", label: "Impression", icon: "solar:notes-bold", count: symptoms.length + diagnoses.length },
              { id: "sec-medications", label: "Medications", icon: "solar:pills-bold", count: drugRows.length },
              { id: "sec-investigations", label: "Investigations", icon: "solar:test-tube-bold", count: labRows.length },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveSection(tab.id);
                  if (tab.id !== "all") {
                    document.getElementById(tab.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }
                }}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer shrink-0",
                  activeSection === tab.id
                    ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                )}
              >
                <Icon icon={tab.icon} size={14} />
                <span>{tab.label}</span>
                {tab.count !== undefined && tab.count > 0 && (
                  <span
                    className={cn(
                      "text-[10px] px-1.5 py-0.2 rounded-full font-bold",
                      activeSection === tab.id ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"
                    )}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="hidden lg:flex items-center gap-3 text-xs text-muted-foreground font-medium shrink-0">
            <span className="flex items-center gap-1 text-emerald-600 font-semibold">
              <Icon icon="solar:check-circle-bold" size={13} />
              {drugRows.length} Prescribed Drugs
            </span>
            <span>•</span>
            <span>{labRows.length} Lab Orders</span>
          </div>
        </div>

        {/* ── CARD 1: Visit & Administrative Details ───────────────────────── */}
        <Card id="sec-visit" className="border shadow-xs scroll-mt-28">
          <CardHeader className="pb-4 border-b">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
                  <Icon icon="solar:stethoscope-bold-duotone" size={20} />
                </div>
                <div>
                  <CardTitle className="text-base font-semibold">Visit & Administrative Details</CardTitle>
                  <CardDescription className="text-xs">
                    Patient scheduling, attending healthcare practitioner, and encounter timing.
                  </CardDescription>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
              <Field label="Patient" required error={fieldErrors.patient} icon="solar:user-bold">
                <EntitySelect
                  doctype="Patient"
                  rawItems={patients}
                  options={patients.map((p) => ({
                    value: p.id,
                    label: p.patient_name || `${p.first_name} ${p.last_name}`,
                    sublabel: p.patient_id,
                    image: p.image,
                  }))}
                  value={form.patient}
                  onChange={(v) => v && handlePatientChange(v)}
                  onOptionAdded={(_opt, raw) => {
                    if (raw) setPatients((prev) => [...prev, raw]);
                  }}
                  placeholder="Select Patient..."
                  emptyText="No patients found"
                />
              </Field>

              <Field label="Healthcare Practitioner" required error={fieldErrors.practitioner} icon="solar:user-speak-bold">
                <EntitySelect
                  doctype="Healthcare Practitioner"
                  rawItems={practitioners}
                  options={practitioners.map((p) => ({
                    value: p.id,
                    label: p.practitioner_name || `${p.first_name} ${p.last_name}`,
                    avatarName: `${p.first_name || ""} ${p.last_name || ""}`,
                    sublabel: p.designation || p.department_name,
                    image: p.image,
                  }))}
                  value={form.practitioner}
                  onChange={(v) => handlePractitionerChange(v)}
                  onOptionAdded={(_opt, raw) => {
                    if (raw) setPractitioners((prev) => [...prev, raw]);
                  }}
                  placeholder="Select Practitioner..."
                  emptyText="No practitioners found"
                  tone="blue"
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-5">
              <Field label="Medical Department" required error={fieldErrors.department} icon="solar:buildings-bold">
                <select
                  className="w-full h-9 rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-2xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={form.department || ""}
                  onChange={(e) => {
                    update("department", e.target.value);
                    if (fieldErrors.department) {
                      setFieldErrors((prev) => ({ ...prev, department: undefined }));
                    }
                  }}
                >
                  <option value="">
                    {departments.length === 0 ? "Loading departments..." : "Select Department..."}
                  </option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.department}>
                      {d.department}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Appointment Type" required icon="solar:calendar-date-bold">
                <Combobox
                  doctype="Appointment Type"
                  options={appointmentTypeOptions}
                  value={form.appointment_type}
                  onChange={(v) => update("appointment_type", v)}
                  placeholder="Select Type..."
                />
              </Field>

              <Field label="Linked Appointment" icon="solar:link-bold">
                <Combobox
                  doctype="Patient Appointment"
                  rawItems={appointments}
                  options={appointments.map(
                    (a) => `${a.patient_name || a.patient} — ${a.appointment_date}`
                  )}
                  value={form.appointment}
                  onChange={(v) => update("appointment", v)}
                  placeholder="Link Appointment..."
                  disabled={!form.patient}
                  emptyText={form.patient ? "No appointments" : "Pick a patient first"}
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-5">
              <Field label="Encounter Date" required icon="solar:calendar-bold">
                <Input
                  type="date"
                  value={form.encounter_date}
                  onChange={(e) => update("encounter_date", e.target.value)}
                  className="h-9 text-xs"
                />
              </Field>
              <Field label="Encounter Time" required icon="solar:clock-circle-bold">
                <Input
                  type="time"
                  value={form.encounter_time}
                  onChange={(e) => update("encounter_time", e.target.value)}
                  className="h-9 text-xs"
                />
              </Field>
              <Field label="Encounter Source" icon="solar:route-bold">
                <Combobox
                  options={encounterOptions("source")}
                  value={form.source}
                  onChange={(v) => update("source", v)}
                  allowCreate={false}
                  className="h-9 text-xs"
                />
              </Field>
              <Field label="Series" icon="solar:hashtag-bold">
                <Combobox
                  options={encounterOptions("naming_series")}
                  value={form.naming_series}
                  onChange={(v) => update("naming_series", v)}
                  allowCreate={false}
                  className="h-9 text-xs"
                />
              </Field>
              <Field label="Company" icon="solar:shield-bold">
                <Combobox
                  doctype="Company"
                  options={companies.map((c) => c.company_name)}
                  value={form.company}
                  onChange={(v) => update("company", v)}
                  placeholder="Select Company..."
                  className="h-9 text-xs"
                />
              </Field>
            </div>

            {/* Invoiced Toggle */}
            <div className="pt-2 flex items-center justify-between border-t">
              <div className="flex items-center gap-2.5">
                <input
                  type="checkbox"
                  id="invoiced-toggle"
                  checked={form.invoiced}
                  onChange={(e) => update("invoiced", e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary/20"
                />
                <label htmlFor="invoiced-toggle" className="text-xs font-medium cursor-pointer">
                  Invoiced Encounter
                </label>
              </div>
              <span className="text-2xs text-muted-foreground">Mark whether consultation fee has already been billed.</span>
            </div>
          </CardContent>
        </Card>

        {/* ── CARD 2: Clinical Impression & Symptoms ──────────────────────── */}
        <Card id="sec-impression" className="border shadow-xs scroll-mt-28">
          <CardHeader className="pb-4 border-b">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
                  <Icon icon="solar:notes-bold-duotone" size={20} />
                </div>
                <div>
                  <CardTitle className="text-base font-semibold">Clinical Impression & Symptoms</CardTitle>
                  <CardDescription className="text-xs">
                    Chief complaints, presenting symptoms, and preliminary or definitive clinical diagnoses.
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-2xs font-semibold">
                <Badge variant="outline" className="bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/20">
                  {symptoms.length} Symptoms
                </Badge>
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                  {diagnoses.length} Diagnoses
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 pt-2">
              <Field label="Presenting Symptoms (Chief Complaints)" error={fieldErrors.impression} icon="solar:pulse-bold">
                <MultiSelect
                  size="large"
                  options={optionSets.complaints}
                  value={symptoms}
                  onChange={(val) => {
                    setSymptoms(val);
                    if (fieldErrors.impression && (val.length > 0 || diagnoses.length > 0)) {
                      setFieldErrors((prev) => ({ ...prev, impression: undefined }));
                    }
                  }}
                  getOptionUrl={getSymptomUrl}
                  doctype="Symptom"
                  onCreateNew={(text) => {
                    setCreateSymptomInitial(text || "");
                    setShowCreateSymptomModal(true);
                  }}
                  placeholder="Search presenting symptoms (e.g. Chest pain, Cough, Fever)..."
                  emptyText="No matching symptoms found"
                />
                <label className="mt-2.5 flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.symptoms_in_print}
                    onChange={(e) => update("symptoms_in_print", e.target.checked)}
                    className="rounded border-gray-300 text-primary"
                  />
                  <span>Include Symptoms on Prescription Slip</span>
                </label>
              </Field>

              <Field label="Clinical Diagnoses" error={fieldErrors.impression} icon="solar:document-medicine-bold">
                <MultiSelect
                  size="large"
                  options={optionSets.diagnosisCatalog}
                  value={diagnoses}
                  onChange={(val) => {
                    setDiagnoses(val);
                    if (fieldErrors.impression && (symptoms.length > 0 || val.length > 0)) {
                      setFieldErrors((prev) => ({ ...prev, impression: undefined }));
                    }
                  }}
                  doctype="Diagnosis"
                  onCreateNew={(text) => {
                    setCreateDiagnosisInitial(text || "");
                    setShowCreateDiagnosisModal(true);
                  }}
                  placeholder="Search ICD-11 diagnoses or code (e.g. Cholera, 1A00, Diabetes, BA00)..."
                  emptyText="No matching ICD-11 diagnoses found"
                />
                <label className="mt-2.5 flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.diagnosis_in_print}
                    onChange={(e) => update("diagnosis_in_print", e.target.checked)}
                    className="rounded border-gray-300 text-primary"
                  />
                  <span>Include Diagnosis on Prescription Slip</span>
                </label>
              </Field>
            </div>
          </CardContent>
        </Card>

        {/* ── CARD 3: Prescribed Medications ──────────────────────────────── */}
        <Card id="sec-medications" className="border shadow-xs scroll-mt-28">
          <CardHeader className="pb-4 border-b">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                  <Icon icon="solar:pills-bold-duotone" size={20} />
                </div>
                <div>
                  <CardTitle className="text-base font-semibold">Prescribed Medications</CardTitle>
                  <CardDescription className="text-xs">
                    In-encounter pharmacotherapy prescribing with real-time pharmacy inventory checking.
                  </CardDescription>
                </div>
              </div>

              {/* Live Inventory Counter Summary */}
              <div className="flex items-center gap-2">
                <span className="text-2xs font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground border">
                  Total: {drugRows.length}
                </span>
                <span className="text-2xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  ● In Stock: {drugRows.filter((r) => r.in_stock === true).length}
                </span>
                {drugRows.some((r) => r.in_stock === false) && (
                  <span className="text-2xs font-semibold px-2 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                    ▲ Out of Stock: {drugRows.filter((r) => r.in_stock === false).length}
                  </span>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setDrugRows((p) => [...p, emptyDrug()])}
                  className="text-xs h-7 ml-1 bg-emerald-50/50 hover:bg-emerald-100/80 text-emerald-700 border-emerald-300 dark:bg-emerald-950/30 dark:border-emerald-800"
                >
                  <Icon icon="solar:add-circle-bold" size={13} className="mr-1 text-emerald-600" />
                  Add Drug
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <EncounterGrid
              columns={[
                { label: "Medication", width: "w-64" },
                { label: "Drug Code", width: "w-52" },
                { label: "Dosage", width: "w-36" },
                { label: "Period", required: true, width: "w-36" },
                { label: "Dosage Form", required: true, width: "w-40" },
              ]}
              count={drugRows.length}
              emptyText="No medications prescribed for this visit"
              addLabel="+ Add Drug"
              onAdd={() => setDrugRows((p) => [...p, emptyDrug()])}
            >
              {drugRows.map((row, i) => (
                <DrugRowView
                  key={i}
                  row={row}
                  index={i}
                  options={optionSets}
                  stockMap={stockMap}
                  intentOptions={intentOptions}
                  priorityOptions={priorityOptions}
                  expanded={!!drugDetails.expanded[i]}
                  onToggleDetails={() => drugDetails.toggle(i)}
                  onChange={updateDrug}
                  onMedicationChange={onMedicationChange}
                  onDrugCodeChange={onDrugCodeChange}
                  onRemove={removeDrug}
                />
              ))}
            </EncounterGrid>
          </CardContent>
        </Card>

        {/* ── CARD 4: Diagnostic Orders & Procedures ───────────────────────── */}
        <Card id="sec-investigations" className="border shadow-xs scroll-mt-28">
          <CardHeader className="pb-4 border-b">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold">
                  <Icon icon="solar:test-tube-bold-duotone" size={20} />
                </div>
                <div>
                  <CardTitle className="text-base font-semibold">Diagnostic Orders & Investigations</CardTitle>
                  <CardDescription className="text-xs">
                    Laboratory investigations and clinical notes.
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-2xs font-semibold">
                <Badge variant="outline" className="bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20">
                  {labRows.length} Lab Tests
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-8">
            {/* Laboratory Investigations */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Icon icon="solar:test-tube-bold" size={14} className="text-purple-600" />
                  Laboratory Investigations
                </h4>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setLabRows((p) => [...p, emptyLab()])}
                  className="text-xs h-7 text-purple-700 dark:text-purple-400 hover:bg-purple-50"
                >
                  <Icon icon="solar:add-circle-bold" size={13} className="mr-1" /> Add Lab
                </Button>
              </div>
              <EncounterGrid
                columns={[
                  { label: "Observation / Lab Template", required: true, width: "w-80" },
                  { label: "Comments" },
                ]}
                count={labRows.length}
                emptyText="No laboratory tests requested"
                addLabel="+ Add Lab"
                onAdd={() => setLabRows((p) => [...p, emptyLab()])}
              >
                {labRows.map((row, i) => (
                  <LabRowView
                    key={i}
                    row={row}
                    index={i}
                    options={optionSets}
                    intentOptions={intentOptions}
                    priorityOptions={priorityOptions}
                    expanded={!!labDetails.expanded[i]}
                    onToggleDetails={() => labDetails.toggle(i)}
                    onChange={updateLab}
                    onLabCodeChange={onLabCodeChange}
                    onRemove={removeLab}
                  />
                ))}
              </EncounterGrid>
            </div>

            {/* Clinical Review Notes */}
            <div className="border-t pt-6">
              <Field
                label="Clinical Review Details & Consultation Notes"
                hint="Free-text clinical findings, instructions, or follow-up notes"
                icon="solar:document-text-bold"
              >
                <textarea
                  className="w-full border rounded-xl p-3.5 text-xs bg-background min-h-[110px] focus:ring-2 focus:ring-primary/20 transition-all font-mono leading-relaxed"
                  value={form.review_details}
                  onChange={(e) => update("review_details", e.target.value)}
                  placeholder="Record comprehensive clinical observations, differential diagnoses, or patient counseling instructions..."
                />
              </Field>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Floating Sticky Bottom Action Bar ─────────────────────────────── */}
      <div className="fixed bottom-4 inset-x-0 z-30 pointer-events-none">
        <div className="max-w-5xl mx-auto px-4 pointer-events-auto">
          <div className="rounded-2xl border bg-background/90 backdrop-blur-md shadow-xl px-5 py-3 flex items-center justify-between gap-4 transition-all">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                <Icon icon="solar:stethoscope-bold" size={18} />
              </div>
              <div>
                <div className="text-xs font-semibold text-foreground flex items-center gap-2">
                  <span>{form.patient_name || "New Patient Encounter"}</span>
                  {selectedPractitioner && (
                    <span className="text-muted-foreground font-normal">
                      • Dr. {selectedPractitioner.practitioner_name}
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-muted-foreground flex items-center gap-2 mt-0.5">
                  <span className="text-emerald-600 font-semibold">{drugRows.length} Prescribed Drugs</span>
                  <span>•</span>
                  <span>{labRows.length} Labs</span>
                  <span>•</span>
                  <span className="text-amber-600 font-medium">Unsaved</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => navigate("/healthcare/encounters")}
                className="text-xs text-muted-foreground hover:text-foreground h-8"
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleOpenPrintModal}
                className="text-xs h-8"
              >
                <Icon icon="solar:printer-bold" size={14} className="mr-1.5" />
                Print Slip
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleSave}
                disabled={saving || !canCreate}
                className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm font-semibold text-xs px-4 h-8"
              >
                {saving ? (
                  <>
                    <Icon icon="solar:spinner-line-duotone" size={14} className="mr-1.5 animate-spin" />
                    Saving Encounter...
                  </>
                ) : (
                  <>
                    <Icon icon="solar:disk-bold" size={14} className="mr-1.5" />
                    Save Encounter
                    <kbd className="ml-2 hidden sm:inline-block px-1.5 py-0.5 text-[10px] bg-emerald-700/60 rounded text-emerald-100 font-mono">
                      ⌘S
                    </kbd>
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Dialogs & Modals ──────────────────────────────────────────────── */}
      <ApplyTreatmentPlanDialog
        open={showTemplateDialog}
        onOpenChange={setShowTemplateDialog}
        onApply={(data) => {
          if (data.drugs.length > 0) setDrugRows((prev) => [...prev, ...data.drugs]);
          if (data.labs.length > 0) setLabRows((prev) => [...prev, ...data.labs]);
          if (data.procedures.length > 0) setProcedureRows((prev) => [...prev, ...data.procedures]);
          const thList = data.therapies || [];
          if (thList.length > 0) setTherapyRows((prev) => [...prev, ...thList]);
          if (data.symptoms.length > 0) {
            setSymptoms((prev) => Array.from(new Set([...prev, ...data.symptoms])));
          }
          if (data.diagnoses.length > 0) {
            setDiagnoses((prev) => Array.from(new Set([...prev, ...data.diagnoses])));
          }
        }}
      />

      <PrescriptionPrintModal
        open={showPrintModal}
        onOpenChange={setShowPrintModal}
        patientName={form.patient_name}
        patientAge={form.age}
        patientSex={form.gender}
        practitionerName={practitioners.find((p) => p.id === form.practitioner)?.practitioner_name || ""}
        departmentName={form.department || ""}
        encounterDate={form.encounter_date}
        diagnoses={diagnoses}
        symptoms={symptoms}
        drugRows={drugRows}
        companyName={form.company || "Healthcare Center"}
      />

      <CreateSymptomModal
        open={showCreateSymptomModal}
        onOpenChange={setShowCreateSymptomModal}
        initialName={createSymptomInitial}
        onCreated={(name) => {
          setSymptoms((prev) => Array.from(new Set([...prev, name])));
          if (fieldErrors.impression) {
            setFieldErrors((prev) => ({ ...prev, impression: undefined }));
          }
        }}
      />

      <CreateDiagnosisModal
        open={showCreateDiagnosisModal}
        onOpenChange={setShowCreateDiagnosisModal}
        initialName={createDiagnosisInitial}
        onCreated={(name) => {
          setDiagnoses((prev) => Array.from(new Set([...prev, name])));
          if (fieldErrors.impression) {
            setFieldErrors((prev) => ({ ...prev, impression: undefined }));
          }
        }}
      />
    </div>
  );
}
