import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router";
import { Icon } from "@/components/icon";
import { Button } from "@/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/ui/card";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { Badge } from "@/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/ui/dialog";
import DocumentSidebar from "@/components/healthcare/DocumentSidebar";
import Combobox from "@/components/healthcare/Combobox";
import EntitySelect from "@/components/healthcare/EntitySelect";
import MultiSelect from "@/components/healthcare/MultiSelect";
import EncounterGrid, {
  useExpandedRows,
} from "@/components/healthcare/EncounterGrid";
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
import { HealthcareApi } from "@/api/services/healthcareService";
import Avatar from "@/components/Avatar";
import { getInitials, cn } from "@/utils";
import { formatAge } from "@/utils/age";
import { createLinkSource, type LinkSource } from "@/utils/linkSource";
import ApplyTreatmentPlanDialog from "./ApplyTreatmentPlanDialog";
import PrescriptionPrintModal from "./PrescriptionPrintModal";
import type {
  Patient,
  HealthcarePractitioner,
  MedicalDepartment,
  PatientAppointment,
  Company,
  EncounterFormMeta,
  DrugPrescription,
  LabTest,
  LabTestTemplate,
  CodeValue,
  Medication,
} from "@/api/services/healthcareService";

/** How the Appointment picker labels a Patient Appointment. */
const appointmentLabel = (a: PatientAppointment) =>
  `${a.patient_name || a.patient} — ${a.appointment_date}`;
/** How the Patient picker labels a Patient. */
const patientLabel = (p: Patient) => p.patient_name || `${p.first_name} ${p.last_name}`.trim();

type Tab = "details" | "encounter_details" | "notes";

interface ClinicalNoteRow { id?: number; note_type: string; note_content: string; note_date: string; author_name: string; }

/** A saved child row, kept so a save can tell an insert from an update or delete. */
interface SavedRow { id: number;[key: string]: any; }

export default function EncounterDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { canCreate, canWrite } = useDoctypePermissions("Patient Encounter");
  const canSave = id ? canWrite : canCreate;
  const { canCreate: canPrescription } = useDoctypePermissions("Drug Prescription");
  const { canCreate: canLabTest } = useDoctypePermissions("Lab Test");
  const { canCreate: canInpatient } = useDoctypePermissions("Inpatient Record");
  const { canCreate: canVitals } = useDoctypePermissions("Vital Signs");
  const { canCreate: canNursing } = useDoctypePermissions("Nursing Task");
  const navigate = useNavigate();
  const isNew = !id || id === "new";

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" } | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("details");

  const [patients, setPatients] = useState<Patient[]>([]);
  const [practitioners, setPractitioners] = useState<HealthcarePractitioner[]>([]);
  const [departments, setDepartments] = useState<MedicalDepartment[]>([]);
  const [appointments, setAppointments] = useState<PatientAppointment[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  /** The form's field definitions — every Select's options come from here. */
  const [meta, setMeta] = useState<EncounterFormMeta | null>(null);
  const [linkedPrescriptions, setLinkedPrescriptions] = useState<DrugPrescription[]>([]);
  const [linkedLabTests, setLinkedLabTests] = useState<LabTest[]>([]);
  const [clinicalNotes, setClinicalNotes] = useState<ClinicalNoteRow[]>([]);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [inpatientRecordId, setInpatientRecordId] = useState<number | null>(null);
  const [encounterMeta, setEncounterMeta] = useState<{
    creation?: string;
    modified?: string;
    owner?: string;
    modified_by?: string;
  }>({});

  // Clinical Note Modal & Composer State
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [noteForm, setNoteForm] = useState({
    note_type: "SOAP Note",
    composer_mode: "soap" as "soap" | "freeform",
    author_name: "",
    note_date: new Date().toISOString().split("T")[0],
    subjective: "",
    objective: "",
    assessment: "",
    plan: "",
    freeform_content: "",
    is_confidential: false,
  });
  const [savingNote, setSavingNote] = useState(false);
  const [noteSearchQuery, setNoteSearchQuery] = useState("");
  const [noteTypeFilter, setNoteTypeFilter] = useState("All");

  // Orders / Encounter Details Tab Filters
  const [ordersSearchQuery, setOrdersSearchQuery] = useState("");
  const [ordersFilter, setOrdersFilter] = useState<"all" | "labs" | "meds" | "procs">("all");

  const [form, setForm] = useState({
    naming_series: "HLC-ENC-.YYYY.-",
    patient: null as number | null,
    practitioner: null as number | null,
    department: null as number | null,
    encounter_date: new Date().toISOString().split("T")[0],
    encounter_time: new Date().toTimeString().slice(0, 8),
    source: "Direct",
    // Links Marley carries on the encounter and denormalises onto the form.
    company: "",
    appointment: "",
    // `fetch_from practitioner.department` — read-only in Marley, so the page
    // only ever displays it. Kept in state so the picker can refill it.
    department_name: "",
    // Marley's `encounter_comment`. It is labelled "Review Details" and sits
    // inside the Procedures section — a plain Small Text, no picker.
    encounter_comment: "",
    symptoms_in_print: true,
    diagnosis_in_print: true,
    status: "Draft",
  });

  // ── Link sources (Frappe Link semantics: pick or create) ──────────────────
  const sources = useRef<Record<string, LinkSource<any>>>({});
  /** Code system the next ad-hoc Code Value should be created under. */
  const pendingCodeSystem = useRef("");
  const [reload, setReload] = useState(0);

  // Encounter Impression — Marley child tables, so these are lists of names
  // rather than free text. Existing rows are tracked by id so edits can be
  // diffed against the saved set.
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [diagnoses, setDiagnoses] = useState<string[]>([]);
  const [savedSymptomRows, setSavedSymptomRows] = useState<SavedRow[]>([]);
  const [savedDiagnosisRows, setSavedDiagnosisRows] = useState<SavedRow[]>([]);

  // ── Child grids ────────────────────────────────────────────────────
  const [codingRows, setCodingRows] = useState<CodingRow[]>([]);
  const [drugRows, setDrugRows] = useState<DrugRow[]>([]);
  const [labRows, setLabRows] = useState<LabRow[]>([]);
  const [procedureRows, setProcedureRows] = useState<ProcedureRow[]>([]);
  const [therapyRows, setTherapyRows] = useState<TherapyRow[]>([]);
  const [savedCoding, setSavedCoding] = useState<SavedRow[]>([]);
  const [savedDrugs, setSavedDrugs] = useState<SavedRow[]>([]);
  const [savedLabs, setSavedLabs] = useState<SavedRow[]>([]);
  const [savedProcedures, setSavedProcedures] = useState<SavedRow[]>([]);
  const [savedTherapies, setSavedTherapies] = useState<SavedRow[]>([]);

  const drugDetails = useExpandedRows();
  const labDetails = useExpandedRows();
  const procedureDetails = useExpandedRows();
  const therapyDetails = useExpandedRows();

  const [patientName, setPatientName] = useState("");
  const [patientAge, setPatientAge] = useState("");
  const [patientSex, setPatientSex] = useState("");
  const [practitionerName, setPractitionerName] = useState("");

  // ── Load data ──────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [pats, pracs, depts, ...rest] = await Promise.all([
        HealthcareApi.patients.list({ page_size: 200 }),
        HealthcareApi.practitioners.list({ page_size: 200 }),
        HealthcareApi.departments.list({ page_size: 200 }),
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
      ]);
      setPatients(pats.results || []);
      setPractitioners(pracs.results || []);
      setDepartments(depts.results || []);

      // The meta is not a list response, so it comes off the tail of the
      // tuple before the rest are unwrapped.
      const formMeta = rest[rest.length - 1] as unknown as EncounterFormMeta | null;
      setMeta(formMeta);

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

      // One source per Link field on the form, exactly as on the create page —
      // `ensure` resolves a typed-in name to an id (creating the master if the
      // name is new), the way a Frappe Link does.
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
        patientCareTypes: createLinkSource(careTypes, (c: any) => c.patient_care_type, async () => { throw new Error("read-only"); }, () => null),
        procedureTemplates: createLinkSource(procTemplates, (t: any) => t.template_name, HealthcareApi.procedureTemplates.create as any, (n) => ({ template_name: n })),
        therapyTypes: createLinkSource(therapyTypes, (t: any) => t.therapy_type, HealthcareApi.therapyTypes.create as any, (n) => ({ therapy_type: n })),
      };
      setReload((n) => n + 1);

      if (id && id !== "new") {
        const res = (await HealthcareApi.encounters.get(Number(id))) as any;
        setForm({
          naming_series: res.naming_series || "HLC-ENC-.YYYY.-",
          patient: res.patient,
          practitioner: res.practitioner,
          department: res.department,
          encounter_date: res.encounter_date,
          encounter_time: res.encounter_time || "",
          source: res.source || "Direct",
          company:
            (comps as Company[]).find((c) => c.id === res.company)?.company_name || "",
          appointment: res.appointment
            ? (() => {
              const a = (appts as PatientAppointment[]).find(
                (x) => x.id === res.appointment
              );
              return a ? appointmentLabel(a) : "";
            })()
            : "",
          department_name: res.department_name || "",
          encounter_comment: res.encounter_comment || "",
          symptoms_in_print: res.symptoms_in_print ?? true,
          diagnosis_in_print: res.diagnosis_in_print ?? true,
          status: res.status || "Draft",
        });
        // Taken straight off the encounter rather than looked up in the
        // paginated patient/practitioner lists, which only hold page one.
        setPatientName(res.patient_name || "");
        setPatientAge(res.patient_age || "");
        setPatientSex(res.patient_sex || "");
        setPractitionerName(res.practitioner_name || "");
        setInpatientRecordId(res.inpatient_record || null);
        setEncounterMeta({
          creation: res.creation || res.created_at,
          modified: res.modified || res.updated_at,
          owner: res.owner,
          modified_by: res.modified_by,
        });

        // Encounter Impression child rows.
        const symptomRows = (res.symptoms_list_items || []).map(
          (s: any) => ({ id: s.id, symptom: s.symptom })
        );
        const diagnosisRows = (res.diagnoses_list || []).map(
          (d: any) => ({ id: d.id, diagnosis: d.diagnosis })
        );
        setSavedSymptomRows(symptomRows);
        setSavedDiagnosisRows(diagnosisRows);
        setSymptoms(symptomRows.map((r: any) => r.symptom));
        setDiagnoses(diagnosisRows.map((r: any) => r.diagnosis));

        // ── Child grids ────────────────────────────────────────────────
        // Each row's Link fields hydrate back to the *display string* the
        // picker works in; the saved ids are kept so the next save can diff.
        const coding = res.codification_table || [];
        setSavedCoding(coding);
        setCodingRows(
          coding.map((r: any) => ({
            id: r.id,
            code_system: r.code_system_name || "",
            code_value:
              codeValueLabel(
                (values as CodeValue[]).find((v: CodeValue) => v.id === r.code_value) ??
                ({ code: r.code || "", display: r.code_value_display || "" } as CodeValue)
              ),
          }))
        );

        const drugs = res.drug_prescription_items || [];
        setSavedDrugs(drugs);
        setDrugRows(
          drugs.map((r: any) => ({
            id: r.id,
            medication: r.medication
              ? medicationLabel(
                (meds as Medication[]).find((m: Medication) => m.id === r.medication) ??
                ({ generic_name: r.medication_name || "", strength: "", strength_uom: "" } as Medication)
              )
              : "",
            drug_code: r.drug_code || "",
            drug_name: r.medication_name || "",
            dosage: r.dosage || "",
            period: r.period || "",
            dosage_form: r.dosage_form || "",
            comment: r.comment || "",
            interval: r.interval || "",
            interval_uom: r.interval_uom || "",
            number_of_repeats_allowed: r.number_of_repeats_allowed
              ? String(r.number_of_repeats_allowed)
              : "",
            intent: r.intent || "",
            priority: r.priority || "",
          }))
        );

        const labs = res.lab_prescription_items || [];
        setSavedLabs(labs);
        setLabRows(
          labs.map((r: any) => ({
            id: r.id,
            lab_test_code: r.lab_test_name || "",
            lab_test_name: r.lab_test_name || "",
            lab_test_comment: r.lab_test_comment || "",
            observation_template: r.observation_template_name || "",
            patient_care_type: r.patient_care_type_name || "",
            intent: r.intent || "",
            priority: r.priority || "",
          }))
        );

        const procs = res.procedure_prescription_items || [];
        setSavedProcedures(procs);
        setProcedureRows(
          procs.map((r: any) => ({
            id: r.id,
            procedure: r.procedure_name || "",
            procedure_name: r.procedure_name || "",
            department: r.department_name || "",
            practitioner: r.practitioner_name || "",
            date: r.date || "",
            comments: r.comments || "",
            no_of_sessions: r.no_of_sessions ? String(r.no_of_sessions) : "1",
            interval: r.interval || "",
            patient_care_type: r.patient_care_type_name || "",
            intent: r.intent || "",
            priority: r.priority || "",
          }))
        );

        const therapies = res.therapies || [];
        setSavedTherapies(therapies);
        setTherapyRows(
          therapies.map((r: any) => ({
            id: r.id,
            therapy_type: r.therapy_type_name || "",
            no_of_sessions: r.no_of_sessions ? String(r.no_of_sessions) : "1",
            interval: r.interval || "",
            patient_care_type: r.patient_care_type_name || "",
            intent: r.intent || "",
            priority: r.priority || "",
          }))
        );

        // Load linked data
        const [rxRes, labRes] = await Promise.all([
          HealthcareApi.prescriptions.list({ encounter: Number(id), page_size: 50 }).catch(() => ({ results: [] })),
          HealthcareApi.labTests.list({ encounter: Number(id), page_size: 50 }).catch(() => ({ results: [] })),
        ]);
        setLinkedPrescriptions(rxRes.results || []);
        setLinkedLabTests(labRes.results || []);

        // Load clinical notes
        try {
          const notesRes = (await HealthcareApi.clinicalNotes.list({ encounter: Number(id) })) as any;
          setClinicalNotes(notesRes.results || []);
        } catch { setClinicalNotes([]); }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Link-source helpers ────────────────────────────────────────────
  const src = (name: string) => sources.current[name];
  const opts = (name: string): string[] => src(name)?.options ?? [];

  const optionSets = useMemo(
    () => ({
      complaints: opts("complaints"),
      diagnosisCatalog: opts("diagnosisCatalog"),
      codeSystems: opts("codeSystems"),
      codeValues: opts("codeValues"),
      medications: opts("medications"),
      stockItems: opts("stockItems"),
      prescriptionDosages: opts("prescriptionDosages"),
      prescriptionDurations: opts("prescriptionDurations"),
      dosageForms: opts("dosageForms"),
      labTestTemplates: opts("labTestTemplates"),
      observationTemplates: opts("observationTemplates"),
      patientCareTypes: opts("patientCareTypes"),
      procedureTemplates: opts("procedureTemplates"),
      therapyTypes: opts("therapyTypes"),
      departments: departments.map((d) => d.department),
      // Marley's `interval_uom` is a Select on Drug Prescription — its options
      // come from the doctype meta, not from this file.
      intervalUom: fieldOptions(meta, "interval_uom", "drug_prescription"),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [reload, departments, meta]
  );

  /** Marley's Select options for a Patient Encounter field. */
  const encounterOptions = (fieldname: string) => fieldOptions(meta, fieldname);

  // Intent / Priority are Code Values scoped to their own code systems.
  const codeValuesOfSystem = (systemName: string): string[] => {
    const systemId = src("codeSystems")?.idFor(systemName);
    if (systemId == null) return [];
    return (src("codeValues")?.items ?? [])
      .filter((v: CodeValue) => v.code_system === systemId)
      .map(codeValueLabel);
  };
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

  /** Code Values are scoped to the row's chosen code system (Marley's
   *  `set_query("code_value", "codification_table", …)`). */
  const codeValuesFor = (systemName: string): string[] => {
    const systemId = src("codeSystems")?.idFor(systemName);
    if (systemId == null) return [];
    return (src("codeValues")?.items ?? [])
      .filter((v: CodeValue) => v.code_system === systemId)
      .map(codeValueLabel);
  };

  const practitionerOptions = useMemo(
    () => practitioners.map((p) => p.practitioner_name || `${p.first_name} ${p.last_name}`.trim()),
    [practitioners]
  );

  // ── Row helpers ────────────────────────────────────────────────────
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
      .catch(() => {});
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
   * A field the user already set is left alone, matching Frappe, which only
   * fetches into an empty field.
   */
  const onMedicationChange = (i: number, name: string) => {
    const med = (src("medications")?.items ?? []).find(
      (m: Medication) => medicationLabel(m) === name
    ) as Medication | undefined;
    if (!med) {
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
    setProcedureRows((prev) =>
      prev.map((r, idx) =>
        idx === i
          ? {
            ...r,
            procedure: name,
            procedure_name: tpl?.template_name || name,
            // Marley only auto-fills the department when the row has none.
            department: r.department || tpl?.department_name || "",
          }
          : r
      )
    );
  };

  // ── Denormalised fields, refilled when their Link changes ──────────
  /**
   * Marley copies the patient's name, sex and age onto the encounter
   * (`fetch_from patient.*`). Age is derived from the date of birth when the
   * patient has one, otherwise the stored age is used.
   */
  const handlePatientChange = (pid: number | null) => {
    const p = patients.find((pt) => pt.id === pid);
    setForm((prev) => ({ ...prev, patient: pid, appointment: "" }));
    setPatientName(p ? p.patient_name : "");
    setPatientSex(p ? p.sex : "");
    setPatientAge(p ? formatAge(p.dob, p.age) : "");
  };

  /**
   * Marley fetches the encounter's department from the practitioner
   * (`fetch_from: practitioner.department`). Changing the practitioner
   * re-fetches it; a cleared practitioner clears it.
   */
  const handlePractitionerChange = (pid: number | null) => {
    const p = practitioners.find((x) => x.id === pid);
    setForm((prev) => ({
      ...prev,
      practitioner: pid,
      department_name: p?.department_name || "",
      department: p?.department ?? null,
    }));
    setPractitionerName(p?.practitioner_name || "");
  };

  /**
   * Reconcile the Encounter Impression child rows with the picker values:
   * remove rows whose name was taken off, add rows for names newly picked.
   * Names not in their catalogue are created there first, as a Frappe Link does.
   */
  const syncImpression = async (encounterId: number) => {
    // Symptoms → Patient Encounter Symptom rows (linked to Complaint).
    for (const row of savedSymptomRows) {
      if (!symptoms.some((s) => s.toLowerCase() === row.symptom.toLowerCase())) {
        await HealthcareApi.encounterSymptoms.delete(row.id).catch(() => { });
      }
    }
    for (const name of symptoms) {
      if (savedSymptomRows.some((r) => r.symptom.toLowerCase() === name.toLowerCase())) continue;
      const complaintMaster = await src("complaints")?.ensure(name).catch(() => null);
      await HealthcareApi.encounterSymptoms
        .create({ encounter: encounterId, symptom: name, complaint_master: complaintMaster } as any)
        .catch(() => { });
    }

    // Diagnosis → Patient Encounter Diagnosis rows (linked to the catalogue).
    for (const row of savedDiagnosisRows) {
      if (!diagnoses.some((d) => d.toLowerCase() === row.diagnosis.toLowerCase())) {
        await HealthcareApi.encounterDiagnoses.delete(row.id).catch(() => { });
      }
    }
    for (const name of diagnoses) {
      if (savedDiagnosisRows.some((r) => r.diagnosis.toLowerCase() === name.toLowerCase())) continue;
      const diagnosisMaster = await src("diagnosisCatalog")?.ensure(name).catch(() => null);
      await HealthcareApi.encounterDiagnoses
        .create({ encounter: encounterId, diagnosis: name, diagnosis_master: diagnosisMaster } as any)
        .catch(() => { });
    }
  };

  // ── Child-grid sync ────────────────────────────────────────────────
  /**
   * Diff a grid against what is saved: drop the rows whose id disappeared,
   * then create or update the rest. Rows still missing their key Link are
   * skipped, matching the create page's "don't save half-filled rows".
   */
  const reconcile = async <T extends { id?: number }>(
    rows: T[],
    saved: SavedRow[],
    isComplete: (row: T) => boolean,
    create: (row: T) => Promise<any>,
    update: (rowId: number, row: T) => Promise<any>,
    remove: (rowId: number) => Promise<any>
  ) => {
    const kept = new Set(rows.map((r) => r.id).filter((v): v is number => v != null));
    for (const row of saved) {
      if (!kept.has(row.id)) await remove(row.id).catch(() => { });
    }
    for (const row of rows) {
      if (!isComplete(row)) continue;
      if (row.id != null) await update(row.id, row).catch(() => { });
      else await create(row).catch(() => { });
    }
  };

  const syncChildren = async (encounterId: number) => {
    const careTypeId = async (name: string) =>
      name ? await src("patientCareTypes")?.ensure(name).catch(() => null) : null;
    const departmentId = (name: string) =>
      departments.find((d) => d.department === name)?.id ?? null;
    const practitionerId = (name: string) =>
      practitioners.find(
        (p) => (p.practitioner_name || `${p.first_name} ${p.last_name}`.trim()) === name
      )?.id ?? null;

    // Medical Coding
    await reconcile<CodingRow>(
      codingRows,
      savedCoding,
      (r) => !!r.code_system,
      async (r) => {
        const code_system = await src("codeSystems")?.ensure(r.code_system);
        pendingCodeSystem.current = r.code_system;
        const code_value = r.code_value ? await src("codeValues")?.ensure(r.code_value) : null;
        const system = (src("codeSystems")?.items ?? []).find(
          (s: any) => s.code_system === r.code_system
        );
        await HealthcareApi.codificationTable.create({
          encounter: encounterId,
          code_system,
          is_fhir_defined: system?.is_fhir_defined ?? false,
          code_value,
        } as any);
      },
      async (rowId, r) => {
        const code_value = r.code_value ? await src("codeValues")?.ensure(r.code_value) : null;
        await HealthcareApi.codificationTable.update(rowId, {
          code_system: await src("codeSystems")?.ensure(r.code_system),
          code_value,
        } as any);
      },
      (rowId) => HealthcareApi.codificationTable.delete(rowId)
    );

    // Medications
    await reconcile<DrugRow>(
      drugRows,
      savedDrugs,
      (r) => !!(r.drug_code || r.medication),
      async (r) =>
        HealthcareApi.prescriptions.create({
          patient: form.patient,
          practitioner: form.practitioner,
          encounter: encounterId,
          medication_name: r.drug_name || r.medication,
          medication: r.medication ? await src("medications")?.ensure(r.medication).catch(() => null) : null,
          drug_code: r.drug_code,
          dosage: r.dosage || "",
          period: r.period || "",
          dosage_form: r.dosage_form || "Tablet",
          comment: r.comment || "",
          interval: r.interval || "",
          interval_uom: r.interval_uom || "",
          number_of_repeats_allowed: Number(r.number_of_repeats_allowed) || 0,
          intent: r.intent || "Order",
          priority: r.priority || "Routine",
        } as any),
      async (rowId, r) =>
        HealthcareApi.prescriptions.update(rowId, {
          patient: form.patient,
          practitioner: form.practitioner,
          encounter: encounterId,
          medication_name: r.drug_name || r.medication,
          medication: r.medication ? await src("medications")?.ensure(r.medication).catch(() => null) : null,
          drug_code: r.drug_code,
          dosage: r.dosage || "",
          period: r.period || "",
          dosage_form: r.dosage_form || "Tablet",
          comment: r.comment || "",
          interval: r.interval || "",
          interval_uom: r.interval_uom || "",
          number_of_repeats_allowed: Number(r.number_of_repeats_allowed) || 0,
          intent: r.intent || "Order",
          priority: r.priority || "Routine",
        } as any),
      (rowId) => HealthcareApi.prescriptions.delete(rowId)
    );

    // Investigations
    await reconcile<LabRow>(
      labRows,
      savedLabs,
      (r) => !!r.lab_test_code,
      async (r) =>
        HealthcareApi.labPrescriptions.create({
          patient: form.patient,
          encounter: encounterId,
          lab_test_code: await src("labTestTemplates")?.ensure(r.lab_test_code),
          lab_test_name: r.lab_test_name || r.lab_test_code,
          lab_test_comment: r.lab_test_comment || "",
          observation_template: r.observation_template
            ? await src("observationTemplates")?.ensure(r.observation_template)
            : null,
          patient_care_type: await careTypeId(r.patient_care_type),
          intent: r.intent,
          priority: r.priority,
        } as any),
      async (rowId, r) =>
        HealthcareApi.labPrescriptions.update(rowId, {
          patient: form.patient,
          encounter: encounterId,
          lab_test_code: await src("labTestTemplates")?.ensure(r.lab_test_code),
          lab_test_name: r.lab_test_name || r.lab_test_code,
          lab_test_comment: r.lab_test_comment || "",
          observation_template: r.observation_template
            ? await src("observationTemplates")?.ensure(r.observation_template)
            : null,
          patient_care_type: await careTypeId(r.patient_care_type),
          intent: r.intent,
          priority: r.priority,
        } as any),
      (rowId) => HealthcareApi.labPrescriptions.delete(rowId)
    );

    // Procedures
    await reconcile<ProcedureRow>(
      procedureRows,
      savedProcedures,
      (r) => !!r.procedure,
      async (r) =>
        HealthcareApi.procedurePrescriptions.create({
          patient: form.patient,
          encounter: encounterId,
          procedure: await src("procedureTemplates")?.ensure(r.procedure),
          procedure_name: r.procedure_name || r.procedure,
          department: departmentId(r.department),
          practitioner: practitionerId(r.practitioner),
          date: r.date || null,
          comments: r.comments || "",
          no_of_sessions: Number(r.no_of_sessions) || 1,
          interval: r.interval,
          patient_care_type: await careTypeId(r.patient_care_type),
          intent: r.intent,
          priority: r.priority,
        } as any),
      async (rowId, r) =>
        HealthcareApi.procedurePrescriptions.update(rowId, {
          patient: form.patient,
          encounter: encounterId,
          procedure: await src("procedureTemplates")?.ensure(r.procedure),
          procedure_name: r.procedure_name || r.procedure,
          department: departmentId(r.department),
          practitioner: practitionerId(r.practitioner),
          date: r.date || null,
          comments: r.comments || "",
          no_of_sessions: Number(r.no_of_sessions) || 1,
          interval: r.interval,
          patient_care_type: await careTypeId(r.patient_care_type),
          intent: r.intent,
          priority: r.priority,
        } as any),
      (rowId) => HealthcareApi.procedurePrescriptions.delete(rowId)
    );

    // Rehabilitation — the encounter's Therapy Plan Detail rows. The Therapy
    // Plan itself is created on submit.
    await reconcile<TherapyRow>(
      therapyRows,
      savedTherapies,
      (r) => !!r.therapy_type,
      async (r) =>
        HealthcareApi.therapyPlanDetails.create({
          patient: form.patient,
          encounter: encounterId,
          therapy_type: await src("therapyTypes")?.ensure(r.therapy_type),
          no_of_sessions: Number(r.no_of_sessions) || 1,
          interval: r.interval,
          patient_care_type: await careTypeId(r.patient_care_type),
          intent: r.intent,
          priority: r.priority,
        } as any),
      async (rowId, r) =>
        HealthcareApi.therapyPlanDetails.update(rowId, {
          patient: form.patient,
          encounter: encounterId,
          therapy_type: await src("therapyTypes")?.ensure(r.therapy_type),
          no_of_sessions: Number(r.no_of_sessions) || 1,
          interval: r.interval,
          patient_care_type: await careTypeId(r.patient_care_type),
          intent: r.intent,
          priority: r.priority,
        } as any),
      (rowId) => HealthcareApi.therapyPlanDetails.delete(rowId)
    );
  };

  // ── Save ───────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!form.patient || !form.practitioner) {
      setToast({ msg: "Patient and Practitioner are required", type: "err" });
      return;
    }
    setSaving(true);
    try {
      const encounter = isNew
        ? ((await HealthcareApi.encounters.create(form as any)) as any)
        : null;
      const encounterId = isNew ? encounter.id : Number(id);
      if (!isNew) await HealthcareApi.encounters.update(encounterId, form as any);

      await syncImpression(encounterId);
      await syncChildren(encounterId);

      if (isNew) {
        setToast({ msg: "Encounter created", type: "ok" });
        navigate(`/healthcare/encounters/${encounterId}`);
      } else {
        setToast({ msg: "Encounter saved", type: "ok" });
        loadData();
      }
    } catch (err) {
      console.error(err);
      setToast({ msg: "Failed to save", type: "err" });
    } finally {
      setSaving(false);
    }
  };

  // ── Workflow ───────────────────────────────────────────────────────
  const [submitResult, setSubmitResult] = useState<{ service_requests: number; medication_requests: number; therapy_plans: number } | null>(null);

  const handleWorkflow = async (action: "submit" | "complete") => {
    try {
      let res: any;
      if (action === "submit") {
        res = await HealthcareApi.encounters.submit(Number(id));
      } else {
        res = await HealthcareApi.encounters.complete(Number(id));
      }
      const data = res || {};
      if (data.service_requests_created || data.medication_requests_created) {
        setSubmitResult({
          service_requests: data.service_requests_created || 0,
          medication_requests: data.medication_requests_created || 0,
          therapy_plans: data.therapy_plans_created || 0,
        });
        setToast({
          msg: `${action === "submit" ? "Submitted" : "Completed"} — ${data.service_requests_created || 0} Service Requests, ${data.medication_requests_created || 0} Medication Requests auto-created`,
          type: "ok",
        });
      } else {
        setToast({ msg: `Encounter ${action}`, type: "ok" });
      }
      loadData();
    } catch {
      setToast({ msg: "Workflow action failed", type: "err" });
    }
  };

  const handleApplyTemplate = (data: {
    drugs: DrugRow[];
    labs: LabRow[];
    procedures: ProcedureRow[];
    therapies: TherapyRow[];
    symptoms: string[];
    diagnoses: string[];
  }) => {
    if (data.drugs.length > 0) setDrugRows((prev) => [...prev, ...data.drugs]);
    if (data.labs.length > 0) setLabRows((prev) => [...prev, ...data.labs]);
    if (data.procedures.length > 0) setProcedureRows((prev) => [...prev, ...data.procedures]);
    if (data.therapies.length > 0) setTherapyRows((prev) => [...prev, ...data.therapies]);
    if (data.symptoms.length > 0) {
      setSymptoms((prev) => Array.from(new Set([...prev, ...data.symptoms])));
    }
    if (data.diagnoses.length > 0) {
      setDiagnoses((prev) => Array.from(new Set([...prev, ...data.diagnoses])));
    }
    setToast({ msg: "Treatment Plan Template applied successfully", type: "ok" });
  };

  const handleMakeInpatientMedicationOrder = async () => {
    if (!inpatientRecordId) {
      setToast({ msg: "No active Inpatient Record associated with this encounter.", type: "err" });
      return;
    }
    if (drugRows.length === 0) {
      setToast({ msg: "No medications prescribed in this encounter.", type: "err" });
      return;
    }
    try {
      setSaving(true);
      const orders = await Promise.all(
        drugRows.map((d) =>
          HealthcareApi.inpatientMedicationOrders.create({
            inpatient_record: inpatientRecordId,
            patient: form.patient!,
            practitioner: form.practitioner,
            medication_name: d.medication || d.drug_name || d.drug_code,
            dosage: d.dosage,
            frequency: d.period || d.interval,
            start_date: form.encounter_date,
            notes: d.comment,
            status: "Active",
          })
        )
      );
      setToast({ msg: `Successfully created ${orders.length} Inpatient Medication Order(s)`, type: "ok" });
    } catch (err: any) {
      console.error(err);
      setToast({ msg: err?.message || "Failed to create Inpatient Medication Order", type: "err" });
    } finally {
      setSaving(false);
    }
  };

  const handleOpenReferral = () => {
    if (!form.patient) {
      setToast({ msg: "Please select a patient before creating an external referral.", type: "err" });
      return;
    }
    const params = new URLSearchParams();
    params.set("patient", String(form.patient));
    if (id && id !== "new") params.set("encounter", String(id));
    if (form.practitioner) params.set("practitioner", String(form.practitioner));
    navigate(`/healthcare/external-referrals/new?${params.toString()}`);
  };

  const handleOpenLeaveSlip = () => {
    if (!form.patient) {
      setToast({ msg: "Please select a patient before creating a medical leave slip.", type: "err" });
      return;
    }
    const params = new URLSearchParams();
    params.set("patient", String(form.patient));
    if (id && id !== "new") params.set("encounter", String(id));
    if (form.practitioner) params.set("practitioner", String(form.practitioner));
    navigate(`/healthcare/medical-leave-slips/new?${params.toString()}`);
  };

  const handleOpenMedReq = () => {
    if (!form.patient) {
      setToast({ msg: "Please select a patient before creating a medication request.", type: "err" });
      return;
    }
    const params = new URLSearchParams();
    params.set("patient", String(form.patient));
    if (id && id !== "new") params.set("encounter", String(id));
    if (form.practitioner) params.set("practitioner", String(form.practitioner));
    navigate(`/healthcare/pharmacy/medication-requests/new?${params.toString()}`);
  };

  const handleOpenLabOrder = () => {
    if (!form.patient) {
      setToast({ msg: "Please select a patient before creating a diagnostic order.", type: "err" });
      return;
    }
    const params = new URLSearchParams();
    params.set("patient", String(form.patient));
    if (id && id !== "new") params.set("encounter", String(id));
    if (form.practitioner) params.set("practitioner", String(form.practitioner));
    navigate(`/healthcare/lab-tests/new?${params.toString()}`);
  };

  const handleOpenInpatient = () => {
    if (!form.patient) {
      setToast({ msg: "Please select a patient first.", type: "err" });
      return;
    }
    navigate(`/healthcare/inpatient?patient=${form.patient}`);
  };

  const handleOpenPrintModal = () => {
    setShowPrintModal(true);
  };

  const selectedPatient = useMemo(() => {
    if (!form.patient) return null;
    return patients.find((p) => p.id === form.patient) || null;
  }, [form.patient, patients]);

  const handleSaveClinicalNote = async () => {
    if (!id || id === "new") {
      setToast({ msg: "Please save the encounter before recording clinical notes.", type: "err" });
      return;
    }

    let finalContent = "";
    if (noteForm.composer_mode === "soap") {
      if (!noteForm.subjective && !noteForm.objective && !noteForm.assessment && !noteForm.plan) {
        setToast({ msg: "Please enter at least one section of the SOAP note.", type: "err" });
        return;
      }
      finalContent = `[SOAP NOTE]\n\nS (Subjective):\n${noteForm.subjective || "None recorded."}\n\nO (Objective):\n${noteForm.objective || "None recorded."}\n\nA (Assessment):\n${noteForm.assessment || "None recorded."}\n\nP (Plan):\n${noteForm.plan || "None recorded."}`;
    } else {
      if (!noteForm.freeform_content.trim()) {
        setToast({ msg: "Please enter note content.", type: "err" });
        return;
      }
      finalContent = noteForm.freeform_content.trim();
    }

    if (noteForm.is_confidential) {
      finalContent = `[CONFIDENTIAL]\n${finalContent}`;
    }

    try {
      setSavingNote(true);
      await HealthcareApi.clinicalNotes.create({
        encounter: Number(id),
        note_type: noteForm.note_type,
        note_content: finalContent,
        note_date: noteForm.note_date || new Date().toISOString().split("T")[0],
        author_name: noteForm.author_name || practitionerName || "Attending Physician",
      } as any);

      const notesRes = (await HealthcareApi.clinicalNotes.list({ encounter: Number(id) })) as any;
      setClinicalNotes(notesRes.results || []);
      setShowNoteModal(false);
      setNoteForm({
        note_type: "SOAP Note",
        composer_mode: "soap",
        author_name: practitionerName || "",
        note_date: new Date().toISOString().split("T")[0],
        subjective: "",
        objective: "",
        assessment: "",
        plan: "",
        freeform_content: "",
        is_confidential: false,
      });
      setToast({ msg: "Clinical note recorded successfully.", type: "ok" });
    } catch (err: any) {
      setToast({ msg: err?.message || "Failed to save clinical note", type: "err" });
    } finally {
      setSavingNote(false);
    }
  };

  const applyNoteTemplate = (templateKey: "routine" | "acute" | "cardio" | "postop") => {
    if (templateKey === "routine") {
      setNoteForm((prev) => ({
        ...prev,
        composer_mode: "soap",
        note_type: "SOAP Note",
        subjective: "Patient presents for routine scheduled follow-up. Reports overall well-being with no acute concerns or adverse drug reactions. Reports good medication compliance.",
        objective: "Patient is alert, oriented x 3, in no acute distress. Vital signs reviewed and within normal target ranges. Physical examination unremarkable.",
        assessment: "Chronic condition stable and well-managed under current therapy.",
        plan: "Continue current medications. Routine laboratory panel in 3 months. Return to clinic as needed.",
      }));
    } else if (templateKey === "acute") {
      setNoteForm((prev) => ({
        ...prev,
        composer_mode: "soap",
        note_type: "Progress Note",
        subjective: "Patient reports 3-day history of rhinorrhea, nasal congestion, mild sore throat, and low-grade subjective fever. No dyspnea, wheezing, or chest tightness.",
        objective: "T: 37.3°C, HR: 76 bpm, SpO2: 99% RA. Posterior pharyngeal erythema without tonsillar exudates. Lungs clear to auscultation bilaterally.",
        assessment: "Acute upper respiratory tract infection, viral etiology presumed.",
        plan: "Supportive care with adequate oral hydration, rest, and saline nasal spray. Acetaminophen 500mg PO PRN for fever. Advised to return if high fever or dyspnea develops.",
      }));
    } else if (templateKey === "cardio") {
      setNoteForm((prev) => ({
        ...prev,
        composer_mode: "soap",
        note_type: "Consultation Note",
        subjective: "Follow-up for essential hypertension and cardiovascular risk review. Denies chest pain, palpitation, orthopnea, or lower extremity swelling.",
        objective: "BP: 126/80 mmHg, Pulse: 70 bpm regular. S1/S2 distinct, no murmurs or gallops. Peripheral pulses intact. No peripheral pitting edema.",
        assessment: "Essential hypertension, well-controlled on current ACE-inhibitor therapy.",
        plan: "Maintain current pharmacotherapy. Recheck basic metabolic panel and lipid panel annually. Emphasize low-sodium DASH dietary adherence.",
      }));
    } else if (templateKey === "postop") {
      setNoteForm((prev) => ({
        ...prev,
        composer_mode: "soap",
        note_type: "Procedure Note",
        subjective: "Post-procedural assessment. Reports mild expected discomfort well-managed with prescribed analgesics. Denies fever, chills, or active bleeding.",
        objective: "Procedure site evaluated: clean, dry, well-approximated edges. No active oozing, erythema, or purulent drainage. Good distal perfusion.",
        assessment: "Post-procedural recovery progressing as expected without complications.",
        plan: "Keep wound dry and clean. Continue oral analgesics PRN. Suture removal / routine re-evaluation in 7-10 days.",
      }));
    }
  };

  const copyNoteToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setToast({ msg: "Note copied to clipboard", type: "ok" });
  };

  const parseSoapNote = (content: string) => {
    if (!content) return null;
    if (!content.includes("[SOAP NOTE]") && !content.includes("S (Subjective):")) {
      return null;
    }
    const clean = content.replace("[CONFIDENTIAL]\n", "").replace("[SOAP NOTE]\n\n", "").replace("[SOAP NOTE]", "");
    const sMatch = clean.match(/S \(Subjective\):\s*([\s\S]*?)(?=\n\nO \(Objective\):|$)/i);
    const oMatch = clean.match(/O \(Objective\):\s*([\s\S]*?)(?=\n\nA \(Assessment\):|$)/i);
    const aMatch = clean.match(/A \(Assessment\):\s*([\s\S]*?)(?=\n\nP \(Plan\):|$)/i);
    const pMatch = clean.match(/P \(Plan\):\s*([\s\S]*?)$/i);

    return {
      subjective: sMatch ? sMatch[1].trim() : "",
      objective: oMatch ? oMatch[1].trim() : "",
      assessment: aMatch ? aMatch[1].trim() : "",
      plan: pMatch ? pMatch[1].trim() : "",
    };
  };

  // ── Patient initials ───────────────────────────────────────────────
  const initials = getInitials(patientName, "EN");

  // ── Tabs ───────────────────────────────────────────────────────────
  const tabs: { key: Tab; label: string; icon: string; count?: number }[] = [
    { key: "details", label: "Details", icon: "solar:stethoscope-bold-duotone" },
    {
      key: "encounter_details",
      label: "Encounter Details",
      icon: "solar:checklist-minimalistic-bold-duotone",
      count: linkedLabTests.length + linkedPrescriptions.length + (submitResult ? 1 : 0),
    },
    {
      key: "notes",
      label: "Notes",
      icon: "solar:notes-bold-duotone",
      count: clinicalNotes.length,
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-2 rounded-md text-sm text-white shadow-lg cursor-pointer ${toast.type === "ok" ? "bg-green-600" : "bg-red-600"}`} onClick={() => setToast(null)}>
          {toast.msg}
        </div>
      )}

      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-10 bg-white border-b px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground cursor-pointer hover:text-foreground" onClick={() => navigate("/")}>Home</span>
            <span className="text-muted-foreground">/</span>
            <span className="text-sm text-muted-foreground cursor-pointer hover:text-foreground" onClick={() => navigate("/healthcare")}>Healthcare</span>
            <span className="text-muted-foreground">/</span>
            <span className="text-sm text-muted-foreground cursor-pointer hover:text-foreground" onClick={() => navigate("/healthcare/encounters")}>Patient Encounter</span>
            <span className="text-muted-foreground">/</span>
            <span className="text-sm font-semibold">
              {isNew ? "New Patient Encounter" : patientName || `Encounter #${id}`}
            </span>
            {!isNew && form.status && (
              <span className={`text-xs px-2 py-0.5 rounded font-medium ${form.status === "Draft" ? "bg-orange-100 text-orange-700" :
                form.status === "Submitted" ? "bg-blue-100 text-blue-700" :
                  form.status === "Completed" ? "bg-green-100 text-green-700" :
                    "bg-red-100 text-red-700"
                }`}>{form.status}</span>
            )}
            {isNew && <span className="text-xs px-2 py-0.5 rounded font-medium bg-orange-100 text-orange-700">Not Saved</span>}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowTemplateDialog(true)}>
              <Icon icon="solar:document-add-bold" size={14} className="mr-1" /> Apply Template
            </Button>
            <Button variant="outline" size="sm" onClick={handleOpenPrintModal}>
              <Icon icon="solar:printer-bold" size={14} className="mr-1" /> Print Prescription
            </Button>
            <Button variant="outline" size="sm" onClick={handleOpenReferral} className="text-blue-700 hover:text-blue-800">
              <Icon icon="solar:share-circle-bold" size={14} className="mr-1" /> Referral Out
            </Button>
            <Button variant="outline" size="sm" onClick={handleOpenLeaveSlip} className="text-teal-700 hover:text-teal-800">
              <Icon icon="solar:diploma-verified-bold" size={14} className="mr-1" /> Medical Leave
            </Button>
            <Button variant="outline" size="sm" onClick={handleOpenMedReq} className="text-rose-700 hover:text-rose-800">
              <Icon icon="solar:pills-bold" size={14} className="mr-1" /> Medication Request
            </Button>
            {!isNew && inpatientRecordId && (
              <Button variant="outline" size="sm" onClick={handleMakeInpatientMedicationOrder} className="text-purple-600">
                <Icon icon="solar:bed-bold" size={14} className="mr-1" /> Inpatient Order
              </Button>
            )}
            {!isNew && form.status === "Draft" && (
              <Button variant="outline" size="sm" onClick={() => handleWorkflow("submit")} className="text-blue-600">
                <Icon icon="solar:check-read-bold" size={14} className="mr-1" /> Submit
              </Button>
            )}
            {!isNew && (
              <>
                <Button variant="outline" size="sm" onClick={() => navigate(`/healthcare/encounters/${Math.max(1, Number(id) - 1)}`)}>
                  <Icon icon="solar:alt-arrow-left-bold" size={16} />
                </Button>
                <Button variant="outline" size="sm" onClick={() => navigate(`/healthcare/encounters/${Number(id) + 1}`)}>
                  <Icon icon="solar:alt-arrow-right-bold" size={16} />
                </Button>
              </>
            )}
            <Button onClick={handleSave} disabled={saving || !canSave} className="bg-blue-600 hover:bg-blue-700">
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </div>

      <div className="flex">
        {/* ── Main Content ──────────────────────────────────────────── */}
        <div className="flex-1 p-6 max-w-5xl">
          {/* ── Executive Tabs Navigation ─────────────────────────────────── */}
          <div className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-muted/40 border mb-6 backdrop-blur-sm shadow-2xs">
            {tabs.map((t) => {
              const isActive = activeTab === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setActiveTab(t.key)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer",
                    isActive
                      ? "bg-card text-foreground shadow-xs border font-bold"
                      : "text-muted-foreground hover:text-foreground hover:bg-card/40"
                  )}
                >
                  <Icon icon={t.icon} size={16} className={isActive ? "text-primary" : "text-muted-foreground"} />
                  <span>{t.label}</span>
                  {t.count !== undefined && t.count > 0 && (
                    <span
                      className={cn(
                        "px-1.5 py-0.2 rounded-full text-[10px] font-bold",
                        isActive
                          ? "bg-primary/10 text-primary"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      {t.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : (
            <>
              {/* ══════════════════════════════════════════════════════════ */}
              {/* TAB: Details */}
              {/* ══════════════════════════════════════════════════════════ */}
              {activeTab === "details" && (
                <div className="space-y-6">

                  {/* ── Executive Clinical Action Launcher ── */}
                  {(!isNew || !!form.patient) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
                      {/* 1. Orders & Prescriptions */}
                      <div className="p-3.5 rounded-2xl border bg-card/60 backdrop-blur-xs shadow-2xs space-y-2 hover:border-rose-500/30 transition-all">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-rose-600 flex items-center gap-1.5">
                            <Icon icon="solar:pills-bold" size={14} /> Orders & Rx
                          </span>
                          <span className="text-[10px] text-muted-foreground font-medium">Direct</span>
                        </div>
                        <div className="space-y-1.5">
                          {canPrescription && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full justify-start text-xs h-8 border-rose-500/20 text-rose-700 dark:text-rose-400 hover:bg-rose-500/10 font-semibold"
                              onClick={handleOpenMedReq}
                            >
                              <Icon icon="solar:pills-bold" size={14} className="mr-2 text-rose-500" />
                              + Medication Request
                            </Button>
                          )}
                          {canLabTest && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full justify-start text-xs h-8 border-cyan-500/20 text-cyan-700 dark:text-cyan-400 hover:bg-cyan-500/10 font-semibold"
                              onClick={handleOpenLabOrder}
                            >
                              <Icon icon="solar:test-tube-bold" size={14} className="mr-2 text-cyan-500" />
                              + Diagnostic Order (Lab)
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* 2. Inpatient Care */}
                      <div className="p-3.5 rounded-2xl border bg-card/60 backdrop-blur-xs shadow-2xs space-y-2 hover:border-indigo-500/30 transition-all">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 flex items-center gap-1.5">
                            <Icon icon="solar:hospital-bold" size={14} /> Inpatient Care
                          </span>
                          <span className="text-[10px] text-muted-foreground font-medium">Ward</span>
                        </div>
                        <div className="space-y-1.5">
                          {canInpatient && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full justify-start text-xs h-8 border-indigo-500/20 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-500/10 font-semibold"
                              onClick={handleOpenInpatient}
                            >
                              <Icon icon="solar:bed-bold" size={14} className="mr-2 text-indigo-500" />
                              Inpatient File / Ward Bed
                            </Button>
                          )}
                          {!isNew && inpatientRecordId && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full justify-start text-xs h-8 border-purple-500/20 text-purple-700 dark:text-purple-400 hover:bg-purple-500/10 font-semibold"
                              onClick={handleMakeInpatientMedicationOrder}
                            >
                              <Icon icon="solar:clipboard-check-bold" size={14} className="mr-2 text-purple-500" />
                              Inpatient Med Order
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* 3. Triage & Nursing Assessments */}
                      <div className="p-3.5 rounded-2xl border bg-card/60 backdrop-blur-xs shadow-2xs space-y-2 hover:border-emerald-500/30 transition-all">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 flex items-center gap-1.5">
                            <Icon icon="solar:heart-pulse-bold" size={14} /> Clinical Vitals
                          </span>
                          <span className="text-[10px] text-muted-foreground font-medium">Triage</span>
                        </div>
                        <div className="space-y-1.5">
                          {canVitals && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full justify-start text-xs h-8 border-emerald-500/20 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10 font-semibold"
                              onClick={() => navigate(`/healthcare/vital-signs?patient=${form.patient}`)}
                            >
                              <Icon icon="solar:heart-pulse-bold" size={14} className="mr-2 text-emerald-500" />
                              Vital Signs Record
                            </Button>
                          )}
                          {canNursing && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full justify-start text-xs h-8 border-teal-500/20 text-teal-700 dark:text-teal-400 hover:bg-teal-500/10 font-semibold"
                              onClick={() => navigate(`/healthcare/nursing?patient=${form.patient}`)}
                            >
                              <Icon icon="solar:checklist-bold" size={14} className="mr-2 text-teal-500" />
                              Nursing Tasks & Care
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* 4. Official Clinical Documents */}
                      <div className="p-3.5 rounded-2xl border bg-card/60 backdrop-blur-xs shadow-2xs space-y-2 hover:border-blue-500/30 transition-all">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600 flex items-center gap-1.5">
                            <Icon icon="solar:printer-bold" size={14} /> Clinical Slips
                          </span>
                          <span className="text-[10px] text-muted-foreground font-medium">Print</span>
                        </div>
                        <div className="space-y-1.5">
                          <div className="grid grid-cols-2 gap-1.5">
                            <Button
                              variant="outline"
                              size="sm"
                              className="justify-start text-xs h-8 border-blue-500/20 text-blue-700 dark:text-blue-400 hover:bg-blue-500/10 font-medium px-2"
                              onClick={handleOpenReferral}
                            >
                              <Icon icon="solar:share-circle-bold" size={13} className="mr-1 text-blue-500" />
                              Referral (A4)
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="justify-start text-xs h-8 border-teal-500/20 text-teal-700 dark:text-teal-400 hover:bg-teal-500/10 font-medium px-2"
                              onClick={handleOpenLeaveSlip}
                            >
                              <Icon icon="solar:diploma-verified-bold" size={13} className="mr-1 text-teal-500" />
                              Leave (A5)
                            </Button>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full justify-start text-xs h-8 border-emerald-500/20 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10 font-semibold"
                            onClick={handleOpenPrintModal}
                          >
                            <Icon icon="solar:printer-bold" size={14} className="mr-2 text-emerald-500" />
                            Print Prescription Slip
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ── Patient Demographics Hero Banner ── */}
                  {selectedPatient && (
                    <div className="p-4 rounded-2xl border bg-gradient-to-r from-card via-card to-primary/5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-3.5">
                        <Avatar
                          name={patientName || selectedPatient.patient_name}
                          fallback={initials}
                          tone="blue"
                        />
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-base font-bold text-foreground">
                              {patientName || selectedPatient.patient_name}
                            </h3>
                            <Badge variant="outline" className="font-mono text-[10px] bg-muted/40">
                              {selectedPatient.patient_id || `ID #${selectedPatient.id}`}
                            </Badge>
                            {patientSex && (
                              <Badge variant="secondary" className="text-[10px] font-semibold">
                                {patientSex}
                              </Badge>
                            )}
                            {patientAge && (
                              <Badge variant="secondary" className="text-[10px] font-semibold">
                                {patientAge}
                              </Badge>
                            )}
                            {selectedPatient.blood_group && (
                              <Badge variant="outline" className="text-[10px] font-bold text-rose-600 border-rose-500/30 bg-rose-500/5">
                                Blood: {selectedPatient.blood_group}
                              </Badge>
                            )}
                            {inpatientRecordId && (
                              <Badge className="text-[10px] font-bold bg-indigo-600 text-white">
                                Admitted Inpatient
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1 flex-wrap">
                            {practitionerName && (
                              <span className="flex items-center gap-1 font-medium text-foreground">
                                <Icon icon="solar:user-speak-bold" size={13} className="text-primary" />
                                Dr. {practitionerName}
                              </span>
                            )}
                            {form.department_name && (
                              <span>• Dept: <strong className="text-foreground">{form.department_name}</strong></span>
                            )}
                            {form.encounter_date && (
                              <span>• Date: <strong className="text-foreground">{form.encounter_date} {form.encounter_time}</strong></span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs gap-1.5 text-primary border-primary/20 hover:bg-primary/5"
                          onClick={() => navigate(`/healthcare/patients/${selectedPatient.id}`)}
                        >
                          <Icon icon="solar:user-id-bold" size={14} />
                          Full Patient File
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* ── Series, Company, Appointment ─────────────────────────── */}
                  <Card>
                    <CardContent className="p-6">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-xs text-muted-foreground">Series</Label>
                          <div className="mt-1">
                            {/* Marley's `naming_series` is a Select — its
                                options come from the doctype meta. */}
                            <Combobox
                              options={encounterOptions("naming_series")}
                              value={form.naming_series}
                              onChange={(v) => setForm({ ...form, naming_series: v })}
                              allowCreate={false}
                              disabled={!canSave}
                            />
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Company</Label>
                          <div className="mt-1">
                            {/* Marley's `company` is a Link to Company. */}
                            <Combobox
                              doctype="Company"
                              options={companies.map((c) => c.company_name)}
                              value={form.company}
                              onChange={(v) => setForm({ ...form, company: v })}
                              placeholder="Select Company"
                              disabled={!canSave}
                            />
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Appointment</Label>
                          <div className="mt-1">
                            {/* Marley's `appointment` is a Link to Patient
                                Appointment. */}
                            <Combobox
                              doctype="Patient Appointment"
                              rawItems={appointments}
                              options={appointments
                                .filter((a) => !form.patient || a.patient === form.patient)
                                .map(appointmentLabel)}
                              value={form.appointment}
                              onChange={(v) => setForm({ ...form, appointment: v })}
                              placeholder="Select Appointment"
                              disabled={!canSave || !form.patient}
                              emptyText={form.patient ? "No appointments" : "Pick a patient first"}
                            />
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Patient *</Label>
                          <div className="mt-1">
                            <EntitySelect
                              doctype="Patient"
                              rawItems={patients}
                              options={patients.map((p) => ({
                                value: p.id,
                                label: patientLabel(p),
                                sublabel: p.patient_id,
                                image: p.image,
                              }))}
                              value={form.patient}
                              onChange={handlePatientChange}
                              onOptionAdded={(_opt, raw) => {
                                if (raw) setPatients((prev) => [...prev, raw]);
                              }}
                              placeholder="Select Patient"
                              emptyText="No patients found"
                              disabled={!canSave}
                            />
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Patient Name</Label>
                          <Input value={patientName} readOnly className="mt-1 bg-gray-50" />
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Gender</Label>
                          {/* Marley's `patient_sex`, fetched from the patient. */}
                          <Input value={patientSex} readOnly className="mt-1 bg-gray-50" />
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Age</Label>
                          <Input value={patientAge} readOnly placeholder="—" className="mt-1 bg-gray-50" />
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Healthcare Practitioner *</Label>
                          <div className="mt-1">
                            <EntitySelect
                              doctype="Healthcare Practitioner"
                              rawItems={practitioners}
                              options={practitioners.map((p) => ({
                                value: p.id,
                                label:
                                  p.practitioner_name ||
                                  (p.first_name + " " + (p.last_name || "")).trim(),
                                avatarName: (p.first_name || "") + " " + (p.last_name || ""),
                                sublabel: p.designation || p.department_name,
                                image: p.image,
                              }))}
                              value={form.practitioner}
                              onChange={handlePractitionerChange}
                              onOptionAdded={(_opt, raw) => {
                                if (raw) setPractitioners((prev) => [...prev, raw]);
                              }}
                              placeholder="Select Practitioner"
                              emptyText="No practitioners found"
                              tone="blue"
                              disabled={!canSave}
                            />
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Medical Department</Label>
                          <div className="mt-1">
                            <select
                              className="w-full h-9 rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                              value={form.department_name || ""}
                              disabled={!canSave}
                              onChange={(e) => {
                                const v = e.target.value;
                                const dept = departments.find((d) => d.department === v);
                                setForm({ ...form, department: dept?.id ?? null, department_name: v });
                              }}
                            >
                              <option value="">Select Medical Department...</option>
                              {departments.map((d) => (
                                <option key={d.id} value={d.department}>
                                  {d.department}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Practitioner Name</Label>
                          <Input value={practitionerName} readOnly className="mt-1 bg-gray-50" />
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Encounter Date *</Label>
                          <Input type="date" value={form.encounter_date} onChange={(e) => setForm({ ...form, encounter_date: e.target.value })} className="mt-1" />
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Encounter Time *</Label>
                          <Input type="time" step="1" value={form.encounter_time} onChange={(e) => setForm({ ...form, encounter_time: e.target.value })} className="mt-1" />
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Source</Label>
                          <div className="mt-1">
                            <Combobox
                              options={encounterOptions("source")}
                              value={form.source}
                              onChange={(v) => setForm({ ...form, source: v })}
                              allowCreate={false}
                              disabled={!canSave}
                            />
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* ── Encounter Impression ──────────────────────────────────── */}
                  <Card>
                    <CardHeader className="pb-3">
                      <h3 className="font-semibold text-base">Encounter Impression</h3>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-xs text-muted-foreground">Symptoms</Label>
                          <div className="mt-1">
                            <MultiSelect
                              size="large"
                              options={optionSets.complaints}
                              value={symptoms}
                              onChange={setSymptoms}
                              placeholder="Select or add symptoms"
                              emptyText="No matching complaints"
                              disabled={!canSave}
                            />
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Diagnosis</Label>
                          <div className="mt-1">
                            <MultiSelect
                              size="large"
                              options={optionSets.diagnosisCatalog}
                              value={diagnoses}
                              onChange={setDiagnoses}
                              placeholder="Select or add diagnoses"
                              emptyText="No matching diagnoses"
                              disabled={!canSave}
                            />
                          </div>
                        </div>
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            className="rounded"
                            checked={form.symptoms_in_print}
                            onChange={(e) => setForm({ ...form, symptoms_in_print: e.target.checked })}
                            disabled={!canSave}
                          />
                          Symptoms In Print
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            className="rounded"
                            checked={form.diagnosis_in_print}
                            onChange={(e) => setForm({ ...form, diagnosis_in_print: e.target.checked })}
                            disabled={!canSave}
                          />
                          Diagnosis In Print
                        </label>
                      </div>
                    </CardContent>
                  </Card>

                  {/* ── Medical Coding ────────────────────────────────────────── */}
                  <Card>
                    <CardHeader className="pb-3">
                      <h3 className="font-semibold text-base">Medical Coding</h3>
                    </CardHeader>
                    <CardContent>
                      <EncounterGrid
                        columns={[
                          { label: "Code System", required: true, width: "w-52" },
                          { label: "Code Value", required: true, width: "w-64" },
                          { label: "Code", width: "w-28" },
                          { label: "Display", width: "w-56" },
                          { label: "Definition", width: "w-64" },
                        ]}
                        count={codingRows.length}
                        emptyText="No medical codings added"
                        addLabel="+ Add"
                        onAdd={() => setCodingRows((p) => [...p, emptyCoding()])}
                      >
                        {codingRows.map((row, i) => {
                          const value = (src("codeValues")?.items ?? []).find(
                            (v: CodeValue) => codeValueLabel(v) === row.code_value
                          );
                          return (
                            <CodingRowView
                              key={row.id ?? `new-${i}`}
                              row={row}
                              index={i}
                              codeSystemOptions={optionSets.codeSystems}
                              codeValueOptions={codeValuesFor(row.code_system)}
                              code={value?.code || ""}
                              display={value?.display || ""}
                              definition={value?.definition || ""}
                              disabled={!canSave}
                              onChange={updateCoding}
                              onRemove={canSave ? removeCoding : () => { }}
                            />
                          );
                        })}
                      </EncounterGrid>
                    </CardContent>
                  </Card>

                  {/* ── Medications ──────────────────────────────────────────── */}
                  <Card>
                    <CardHeader className="pb-3">
                      <h3 className="font-semibold text-base">Medications</h3>
                    </CardHeader>
                    <CardContent>
                      <EncounterGrid
                        columns={[
                          { label: "Medication", width: "w-64" },
                          { label: "Drug Code", width: "w-52" },
                          { label: "Dosage", width: "w-36" },
                          { label: "Period", required: true, width: "w-36" },
                          { label: "Dosage Form", required: true, width: "w-40" },
                        ]}
                        count={drugRows.length}
                        emptyText="No drugs prescribed"
                        addLabel="+ Add"
                        onAdd={() => setDrugRows((p) => [...p, emptyDrug()])}
                      >
                        {drugRows.map((row, i) => (
                          <DrugRowView
                            key={row.id ?? `new-${i}`}
                            row={row}
                            index={i}
                            options={optionSets}
                            stockMap={stockMap}
                            intentOptions={intentOptions}
                            priorityOptions={priorityOptions}
                            expanded={!!drugDetails.expanded[i]}
                            disabled={!canSave}
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

                  {/* ── Investigations ───────────────────────────────────────── */}
                  <Card>
                    <CardHeader className="pb-3">
                      <h3 className="font-semibold text-base">Investigations</h3>
                    </CardHeader>
                    <CardContent>
                      <EncounterGrid
                        columns={[
                          { label: "Observation", required: true, width: "w-80" },
                          { label: "Comments" },
                        ]}
                        count={labRows.length}
                        emptyText="No lab tests ordered"
                        addLabel="+ Add"
                        onAdd={() => setLabRows((p) => [...p, emptyLab()])}
                      >
                        {labRows.map((row, i) => (
                          <LabRowView
                            key={row.id ?? `new-${i}`}
                            row={row}
                            index={i}
                            options={optionSets}
                            intentOptions={intentOptions}
                            priorityOptions={priorityOptions}
                            expanded={!!labDetails.expanded[i]}
                            disabled={!canSave}
                            onToggleDetails={() => labDetails.toggle(i)}
                            onChange={updateLab}
                            onLabCodeChange={onLabCodeChange}
                            onRemove={removeLab}
                          />
                        ))}
                      </EncounterGrid>
                    </CardContent>
                  </Card>

                  {/* ── Procedures (with Marley's Review Details) ────────────── */}
                  <Card>
                    <CardHeader className="pb-3">
                      <h3 className="font-semibold text-base">Procedures</h3>
                    </CardHeader>
                    <CardContent>
                      <EncounterGrid
                        columns={[
                          { label: "Clinical Procedure", required: true, width: "w-60" },
                          { label: "Procedure", width: "w-56" },
                          { label: "Referring", width: "w-56" },
                          { label: "Date", width: "w-40" },
                        ]}
                        count={procedureRows.length}
                        emptyText="No procedures added"
                        addLabel="+ Add"
                        onAdd={() => setProcedureRows((p) => [...p, emptyProcedure()])}
                      >
                        {procedureRows.map((row, i) => (
                          <ProcedureRowView
                            key={row.id ?? `new-${i}`}
                            row={row}
                            index={i}
                            options={optionSets}
                            practitionerOptions={practitionerOptions}
                            intentOptions={intentOptions}
                            priorityOptions={priorityOptions}
                            expanded={!!procedureDetails.expanded[i]}
                            disabled={!canSave}
                            onToggleDetails={() => procedureDetails.toggle(i)}
                            onChange={updateProcedure}
                            onProcedureChange={onProcedureChange}
                            onRemove={removeProcedure}
                          />
                        ))}
                      </EncounterGrid>

                      {/* Marley places `encounter_comment` — labelled "Review
                          Details" — inside the Procedures section, right after
                          the grid. It is a plain Small Text with no picker, so
                          it stays a textarea. */}
                      <div className="mt-4">
                        <Label className="text-sm font-medium text-muted-foreground">Review Details</Label>
                        <textarea
                          className="w-full border rounded-md px-3 py-2 text-sm bg-background mt-1.5 min-h-[120px]"
                          placeholder="Free-text review notes for this encounter"
                          value={form.encounter_comment}
                          onChange={(e) => setForm({ ...form, encounter_comment: e.target.value })}
                          disabled={!canSave}
                        />
                      </div>
                    </CardContent>
                  </Card>

                  {/* ── Rehabilitation ──────────────────────────────────────── */}
                  <Card>
                    <CardHeader className="pb-3">
                      <h3 className="font-semibold text-base">Rehabilitation</h3>
                    </CardHeader>
                    <CardContent>
                      <EncounterGrid
                        columns={[
                          { label: "Therapy Type", required: true, width: "w-80" },
                          { label: "No of Sessions", width: "w-36" },
                        ]}
                        count={therapyRows.length}
                        emptyText="No therapies added"
                        addLabel="+ Add"
                        onAdd={() => setTherapyRows((p) => [...p, emptyTherapy()])}
                      >
                        {therapyRows.map((row, i) => (
                          <TherapyRowView
                            key={row.id ?? `new-${i}`}
                            row={row}
                            index={i}
                            options={optionSets}
                            intentOptions={intentOptions}
                            priorityOptions={priorityOptions}
                            expanded={!!therapyDetails.expanded[i]}
                            disabled={!canSave}
                            onToggleDetails={() => therapyDetails.toggle(i)}
                            onChange={updateTherapy}
                            onRemove={removeTherapy}
                          />
                        ))}
                      </EncounterGrid>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* ══════════════════════════════════════════════════════════ */}
              {/* TAB: Encounter Details & Orders Console                   */}
              {/* ══════════════════════════════════════════════════════════ */}
              {activeTab === "encounter_details" && (
                <div className="space-y-6">
                  {/* Auto-created requests notification (after submit) */}
                  {submitResult && (
                    <div className="bg-gradient-to-r from-blue-500/10 via-cyan-500/10 to-transparent border border-blue-500/30 rounded-2xl p-4 shadow-2xs">
                      <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400 font-bold text-sm mb-3">
                        <Icon icon="solar:check-circle-bold" size={18} />
                        Downstream Orders Successfully Dispatched On Submission
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                        <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-card border">
                          <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-600">
                            <Icon icon="solar:test-tube-bold" size={16} />
                          </div>
                          <div>
                            <span className="font-bold text-foreground">{submitResult.service_requests}</span> Service Requests
                            <p className="text-[10px] text-muted-foreground">Diagnostics / Lab queue</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-card border">
                          <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-600">
                            <Icon icon="solar:pills-bold" size={16} />
                          </div>
                          <div>
                            <span className="font-bold text-foreground">{submitResult.medication_requests}</span> Medication Requests
                            <p className="text-[10px] text-muted-foreground">Pharmacy intake console</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-card border">
                          <div className="p-1.5 rounded-lg bg-teal-500/10 text-teal-600">
                            <Icon icon="solar:meditation-bold" size={16} />
                          </div>
                          <div>
                            <span className="font-bold text-foreground">{submitResult.therapy_plans}</span> Therapy Plans
                            <p className="text-[10px] text-muted-foreground">Rehabilitation department</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ── Executive Orders KPI Summary Bar ── */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3.5 rounded-2xl border bg-card/60 shadow-2xs">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Total Directives</span>
                        <Icon icon="solar:clipboard-list-bold-duotone" size={18} className="text-primary" />
                      </div>
                      <p className="text-xl font-bold mt-1 text-foreground">
                        {linkedLabTests.length + linkedPrescriptions.length + procedureRows.length + therapyRows.length}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Encounter items</p>
                    </div>

                    <div className="p-3.5 rounded-2xl border bg-card/60 shadow-2xs">
                      <div className="flex items-center justify-between text-xs text-cyan-600">
                        <span>Service Requests</span>
                        <Icon icon="solar:test-tube-bold-duotone" size={18} />
                      </div>
                      <p className="text-xl font-bold mt-1 text-cyan-700 dark:text-cyan-400">
                        {linkedLabTests.length || labRows.length}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {linkedLabTests.filter((t) => t.status === "Approved" || t.status === "Completed").length} completed
                      </p>
                    </div>

                    <div className="p-3.5 rounded-2xl border bg-card/60 shadow-2xs">
                      <div className="flex items-center justify-between text-xs text-rose-600">
                        <span>Medication Requests</span>
                        <Icon icon="solar:pills-bold-duotone" size={18} />
                      </div>
                      <p className="text-xl font-bold mt-1 text-rose-700 dark:text-rose-400">
                        {linkedPrescriptions.length || drugRows.length}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {linkedPrescriptions.filter((p) => p.status === "Active").length} active prescriptions
                      </p>
                    </div>

                    <div className="p-3.5 rounded-2xl border bg-card/60 shadow-2xs">
                      <div className="flex items-center justify-between text-xs text-emerald-600">
                        <span>Procedures / Rehab</span>
                        <Icon icon="solar:shield-check-bold-duotone" size={18} />
                      </div>
                      <p className="text-xl font-bold mt-1 text-emerald-700 dark:text-emerald-400">
                        {procedureRows.length + therapyRows.length}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Care plans recorded</p>
                    </div>
                  </div>

                  {/* ── Order Search & Filter Action Bar ── */}
                  <div className="p-3 rounded-2xl border bg-card shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <div className="relative w-full sm:w-64">
                        <Icon icon="solar:magnifer-bold" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          value={ordersSearchQuery}
                          onChange={(e) => setOrdersSearchQuery(e.target.value)}
                          placeholder="Search orders, tests, drugs..."
                          className="h-8 pl-8 text-xs bg-muted/20"
                        />
                      </div>

                      <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-xl border text-xs">
                        <button
                          type="button"
                          onClick={() => setOrdersFilter("all")}
                          className={cn(
                            "px-2.5 py-1 rounded-lg font-medium transition-all",
                            ordersFilter === "all" ? "bg-card text-foreground shadow-2xs font-semibold" : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          All
                        </button>
                        <button
                          type="button"
                          onClick={() => setOrdersFilter("labs")}
                          className={cn(
                            "px-2.5 py-1 rounded-lg font-medium transition-all",
                            ordersFilter === "labs" ? "bg-card text-foreground shadow-2xs font-semibold" : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          Labs ({linkedLabTests.length || labRows.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setOrdersFilter("meds")}
                          className={cn(
                            "px-2.5 py-1 rounded-lg font-medium transition-all",
                            ordersFilter === "meds" ? "bg-card text-foreground shadow-2xs font-semibold" : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          Rx ({linkedPrescriptions.length || drugRows.length})
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleOpenLabOrder}
                        className="h-8 text-xs border-cyan-500/30 text-cyan-700 dark:text-cyan-400 hover:bg-cyan-500/10 font-semibold gap-1.5"
                      >
                        <Icon icon="solar:test-tube-bold" size={14} />
                        + Order Service Request
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleOpenMedReq}
                        className="h-8 text-xs border-rose-500/30 text-rose-700 dark:text-rose-400 hover:bg-rose-500/10 font-semibold gap-1.5"
                      >
                        <Icon icon="solar:pills-bold" size={14} />
                        + Prescribe Medication
                      </Button>
                    </div>
                  </div>

                  {/* ── Section: Service Requests (Diagnostic & Lab Tests) ── */}
                  {(ordersFilter === "all" || ordersFilter === "labs") && (
                    <Card className="shadow-2xs">
                      <CardHeader className="pb-3 border-b bg-muted/15 flex flex-row items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-600">
                            <Icon icon="solar:test-tube-bold-duotone" size={18} />
                          </div>
                          <div>
                            <CardTitle className="text-sm font-bold">Service Requests & Laboratory Tests</CardTitle>
                            <CardDescription className="text-xs">
                              Diagnostic investigations requested during or linked to this clinical encounter.
                            </CardDescription>
                          </div>
                        </div>
                        <Badge variant="outline" className="font-mono text-[10px]">
                          {linkedLabTests.length} Linked
                        </Badge>
                      </CardHeader>
                      <CardContent className="p-4 space-y-3">
                        {linkedLabTests.length > 0 ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {linkedLabTests
                              .filter((lt) => {
                                if (!ordersSearchQuery) return true;
                                const q = ordersSearchQuery.toLowerCase();
                                return (
                                  (lt.lab_test_name || "").toLowerCase().includes(q) ||
                                  (lt.test_id || "").toLowerCase().includes(q) ||
                                  (lt.status || "").toLowerCase().includes(q)
                                );
                              })
                              .map((lt) => (
                                <div
                                  key={lt.id}
                                  className="p-3.5 rounded-xl border bg-card hover:border-cyan-500/40 transition-all flex flex-col justify-between gap-3 shadow-2xs"
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="flex items-start gap-2.5">
                                      <div className="h-9 w-9 rounded-xl bg-cyan-500/10 text-cyan-600 flex items-center justify-center shrink-0 mt-0.5">
                                        <Icon icon="solar:test-tube-bold" size={18} />
                                      </div>
                                      <div>
                                        <h4 className="text-xs font-bold text-foreground hover:text-cyan-600 transition-colors">
                                          {lt.lab_test_name}
                                        </h4>
                                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5 font-mono">
                                          <span>{lt.test_id || `LAB #${lt.id}`}</span>
                                          {lt.date && <span>• Date: {lt.date}</span>}
                                        </div>
                                      </div>
                                    </div>
                                    <span
                                      className={cn(
                                        "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                                        lt.status === "Approved" && "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20",
                                        lt.status === "Completed" && "bg-blue-500/10 text-blue-600 border border-blue-500/20",
                                        lt.status === "Draft" && "bg-amber-500/10 text-amber-600 border border-amber-500/20",
                                        lt.status === "Rejected" && "bg-rose-500/10 text-rose-600 border border-rose-500/20"
                                      )}
                                    >
                                      {lt.status}
                                    </span>
                                  </div>

                                  <div className="flex items-center justify-between pt-2 border-t text-xs">
                                    <span className="text-[11px] text-muted-foreground">
                                      {lt.practitioner_name ? `Dr. ${lt.practitioner_name}` : "Clinical Pathology"}
                                    </span>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 text-xs text-cyan-600 hover:text-cyan-700 hover:bg-cyan-50 dark:hover:bg-cyan-950/20 gap-1 font-semibold"
                                      onClick={() => navigate(`/healthcare/lab-tests/${lt.id}`)}
                                    >
                                      <span>Enter Findings / Report</span>
                                      <Icon icon="solar:alt-arrow-right-bold" size={13} />
                                    </Button>
                                  </div>
                                </div>
                              ))}
                          </div>
                        ) : labRows.length > 0 ? (
                          <div className="space-y-3">
                            <div className="p-3 rounded-xl bg-cyan-500/5 border border-cyan-500/20 text-xs flex items-center justify-between">
                              <span className="text-cyan-800 dark:text-cyan-300 font-medium">
                                <strong>{labRows.length}</strong> lab investigation(s) prescribed in consultation file — ready to generate testing order.
                              </span>
                              <Button
                                size="sm"
                                className="h-7 text-xs bg-cyan-600 hover:bg-cyan-700 text-white font-semibold gap-1"
                                onClick={handleOpenLabOrder}
                              >
                                <Icon icon="solar:add-circle-bold" size={13} />
                                Create Lab Order
                              </Button>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {labRows.map((lr, idx) => (
                                <div key={idx} className="p-2.5 rounded-lg border bg-muted/20 text-xs flex items-center justify-between">
                                  <span className="font-semibold">{lr.lab_test_name || lr.observation_template || "Lab Test"}</span>
                                  <span className="text-2xs text-muted-foreground font-mono">{lr.intent || "Routine"}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="text-center py-8 text-xs text-muted-foreground">
                            <Icon icon="solar:test-tube-bold-duotone" size={28} className="mx-auto mb-2 opacity-30 text-cyan-600" />
                            <p className="font-medium text-foreground">No Laboratory Investigations Requested</p>
                            <p className="mt-0.5">Order routine panels, biochemistry, microbiology, or pathology tests.</p>
                            <Button
                              variant="outline"
                              size="sm"
                              className="mt-3 text-xs h-8 border-cyan-500/30 text-cyan-600 font-semibold"
                              onClick={handleOpenLabOrder}
                            >
                              + Order Lab Test
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {/* ── Section: Medication Requests (Pharmacy Fulfillment) ── */}
                  {(ordersFilter === "all" || ordersFilter === "meds") && (
                    <Card className="shadow-2xs">
                      <CardHeader className="pb-3 border-b bg-muted/15 flex flex-row items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-600">
                            <Icon icon="solar:pills-bold-duotone" size={18} />
                          </div>
                          <div>
                            <CardTitle className="text-sm font-bold">Medication Requests & Pharmacy Fulfillment</CardTitle>
                            <CardDescription className="text-xs">
                              Outpatient prescriptions and pharmacy dispensary directives for this encounter.
                            </CardDescription>
                          </div>
                        </div>
                        <Badge variant="outline" className="font-mono text-[10px]">
                          {linkedPrescriptions.length} Linked
                        </Badge>
                      </CardHeader>
                      <CardContent className="p-4 space-y-3">
                        {linkedPrescriptions.length > 0 ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {linkedPrescriptions
                              .filter((rx) => {
                                if (!ordersSearchQuery) return true;
                                const q = ordersSearchQuery.toLowerCase();
                                return (
                                  (rx.medication_name || "").toLowerCase().includes(q) ||
                                  (rx.drug_name || "").toLowerCase().includes(q) ||
                                  (rx.status || "").toLowerCase().includes(q)
                                );
                              })
                              .map((rx) => (
                                <div
                                  key={rx.id}
                                  className="p-3.5 rounded-xl border bg-card hover:border-rose-500/40 transition-all flex flex-col justify-between gap-3 shadow-2xs"
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="flex items-start gap-2.5">
                                      <div className="h-9 w-9 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center shrink-0 mt-0.5">
                                        <Icon icon="solar:pills-bold" size={18} />
                                      </div>
                                      <div>
                                        <h4 className="text-xs font-bold text-foreground">
                                          {rx.medication_name}
                                        </h4>
                                        <p className="text-[11px] text-muted-foreground mt-0.5">
                                          {rx.dosage_form || "Oral"} • {rx.dosage || "Standard Dose"}
                                        </p>
                                        {rx.period && (
                                          <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                                            Duration: {rx.period} ({rx.interval || "Daily"})
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                    <span
                                      className={cn(
                                        "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                                        rx.status === "Active" && "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20",
                                        rx.status === "Completed" && "bg-blue-500/10 text-blue-600 border border-blue-500/20",
                                        rx.status === "Cancelled" && "bg-rose-500/10 text-rose-600 border border-rose-500/20"
                                      )}
                                    >
                                      {rx.status || "Active"}
                                    </span>
                                  </div>

                                  <div className="flex items-center justify-between pt-2 border-t text-xs">
                                    <span className="text-[11px] text-muted-foreground font-mono">
                                      Rx Ref: #{rx.id}
                                    </span>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/20 gap-1 font-semibold"
                                      onClick={() => navigate(`/healthcare/pharmacy/medication-requests/${rx.id}`)}
                                    >
                                      <span>Pharmacy Console</span>
                                      <Icon icon="solar:alt-arrow-right-bold" size={13} />
                                    </Button>
                                  </div>
                                </div>
                              ))}
                          </div>
                        ) : drugRows.length > 0 ? (
                          <div className="space-y-3">
                            <div className="p-3 rounded-xl bg-rose-500/5 border border-rose-500/20 text-xs flex items-center justify-between">
                              <span className="text-rose-800 dark:text-rose-300 font-medium">
                                <strong>{drugRows.length}</strong> drug item(s) prescribed in consultation file — ready for pharmacy dispensing.
                              </span>
                              <Button
                                size="sm"
                                className="h-7 text-xs bg-rose-600 hover:bg-rose-700 text-white font-semibold gap-1"
                                onClick={handleOpenMedReq}
                              >
                                <Icon icon="solar:add-circle-bold" size={13} />
                                Open Medication Request
                              </Button>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {drugRows.map((dr, idx) => (
                                <div key={idx} className="p-2.5 rounded-lg border bg-muted/20 text-xs flex items-center justify-between">
                                  <div>
                                    <p className="font-semibold">{dr.medication || dr.drug_name || "Drug Item"}</p>
                                    <p className="text-[10px] text-muted-foreground">{dr.dosage} • {dr.period}</p>
                                  </div>
                                  <span className="text-2xs font-mono text-muted-foreground">{dr.dosage_form}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="text-center py-8 text-xs text-muted-foreground">
                            <Icon icon="solar:pills-bold-duotone" size={28} className="mx-auto mb-2 opacity-30 text-rose-600" />
                            <p className="font-medium text-foreground">No Medications Prescribed</p>
                            <p className="mt-0.5">Add pharmaceutical items, dosing instructions, and duration in consultation details.</p>
                            <Button
                              variant="outline"
                              size="sm"
                              className="mt-3 text-xs h-8 border-rose-500/30 text-rose-600 font-semibold"
                              onClick={handleOpenMedReq}
                            >
                              + Prescribe Medication
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {/* ── Section: Clinical Encounter Lifecycle Tracker ── */}
                  <Card className="shadow-2xs">
                    <CardHeader className="pb-3 border-b bg-muted/15">
                      <div className="flex items-center gap-2">
                        <Icon icon="solar:history-bold-duotone" size={18} className="text-primary" />
                        <CardTitle className="text-sm font-bold">Encounter Lifecycle & Clinical Trail</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-4">
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                        <div className="p-3 rounded-xl border bg-emerald-500/5 border-emerald-500/20">
                          <div className="flex items-center gap-1.5 font-bold text-emerald-700 dark:text-emerald-400 mb-1">
                            <Icon icon="solar:check-circle-bold" size={14} />
                            1. Consultation Booked
                          </div>
                          <p className="text-muted-foreground text-[11px]">
                            {form.encounter_date ? `${form.encounter_date} ${form.encounter_time}` : "Scheduled"}
                          </p>
                        </div>

                        <div className={cn(
                          "p-3 rounded-xl border",
                          (symptoms.length > 0 || diagnoses.length > 0)
                            ? "bg-emerald-500/5 border-emerald-500/20"
                            : "bg-muted/30 border-muted"
                        )}>
                          <div className="flex items-center gap-1.5 font-bold text-foreground mb-1">
                            <Icon icon="solar:stethoscope-bold" size={14} className="text-primary" />
                            2. Exam & Diagnoses
                          </div>
                          <p className="text-muted-foreground text-[11px]">
                            {diagnoses.length > 0 ? `${diagnoses.length} diagnosis(es) formulated` : "In progress"}
                          </p>
                        </div>

                        <div className={cn(
                          "p-3 rounded-xl border",
                          (linkedLabTests.length > 0 || linkedPrescriptions.length > 0 || drugRows.length > 0)
                            ? "bg-emerald-500/5 border-emerald-500/20"
                            : "bg-muted/30 border-muted"
                        )}>
                          <div className="flex items-center gap-1.5 font-bold text-foreground mb-1">
                            <Icon icon="solar:delivery-bold" size={14} className="text-primary" />
                            3. Orders Dispatched
                          </div>
                          <p className="text-muted-foreground text-[11px]">
                            {linkedLabTests.length + linkedPrescriptions.length} items linked
                          </p>
                        </div>

                        <div className={cn(
                          "p-3 rounded-xl border",
                          form.status === "Submitted" || form.status === "Completed"
                            ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-700 dark:text-emerald-400 font-bold"
                            : "bg-muted/30 border-muted text-muted-foreground"
                        )}>
                          <div className="flex items-center gap-1.5 font-bold mb-1">
                            <Icon icon="solar:verified-check-bold" size={14} />
                            4. Final Verification
                          </div>
                          <p className="text-[11px]">
                            Status: <strong className="text-foreground">{form.status}</strong>
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* ══════════════════════════════════════════════════════════ */}
              {/* TAB: Notes & SOAP Clinical Documentation                  */}
              {/* ══════════════════════════════════════════════════════════ */}
              {activeTab === "notes" && (
                <div className="space-y-6">
                  {/* ── Notes Command & Filter Bar ── */}
                  <div className="p-3 rounded-2xl border bg-card shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <div className="relative w-full sm:w-64">
                        <Icon icon="solar:magnifer-bold" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          value={noteSearchQuery}
                          onChange={(e) => setNoteSearchQuery(e.target.value)}
                          placeholder="Search clinical notes & SOAP..."
                          className="h-8 pl-8 text-xs bg-muted/20"
                        />
                      </div>

                      <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-xl border text-xs">
                        {["All", "SOAP Note", "Progress Note", "Consultation Note", "Nursing Note"].map((type) => (
                          <button
                            key={type}
                            type="button"
                            onClick={() => setNoteTypeFilter(type)}
                            className={cn(
                              "px-2.5 py-1 rounded-lg font-medium transition-all text-xs",
                              noteTypeFilter === type
                                ? "bg-card text-foreground shadow-2xs font-semibold"
                                : "text-muted-foreground hover:text-foreground"
                            )}
                          >
                            {type === "SOAP Note" ? "SOAP" : type === "Progress Note" ? "Progress" : type === "Consultation Note" ? "Consult" : type === "Nursing Note" ? "Nursing" : "All"}
                          </button>
                        ))}
                      </div>
                    </div>

                    <Button
                      onClick={() => setShowNoteModal(true)}
                      size="sm"
                      className="gap-1.5 bg-primary text-primary-foreground font-semibold h-8 text-xs shadow-xs"
                    >
                      <Icon icon="solar:document-add-bold" size={14} />
                      + Write Clinical Note
                    </Button>
                  </div>

                  {/* ── Clinical Notes Feed ── */}
                  {clinicalNotes.length > 0 ? (
                    <div className="space-y-4">
                      {clinicalNotes
                        .filter((n) => {
                          const matchesType = noteTypeFilter === "All" || n.note_type === noteTypeFilter;
                          if (!matchesType) return false;
                          if (!noteSearchQuery) return true;
                          const q = noteSearchQuery.toLowerCase();
                          return (
                            (n.note_content || "").toLowerCase().includes(q) ||
                            (n.author_name || "").toLowerCase().includes(q) ||
                            (n.note_type || "").toLowerCase().includes(q)
                          );
                        })
                        .map((note, i) => {
                          const soap = parseSoapNote(note.note_content || "");
                          const isConfidential = (note.note_content || "").includes("[CONFIDENTIAL]");
                          return (
                            <Card key={note.id || i} className="shadow-2xs overflow-hidden border-border/80 hover:border-primary/40 transition-all">
                              <CardHeader className="p-3.5 bg-muted/20 border-b flex flex-row items-center justify-between gap-3">
                                <div className="flex items-center gap-3">
                                  <Avatar name={note.author_name || "Doctor"} fallback="MD" tone="blue" />
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <h4 className="text-xs font-bold text-foreground">
                                        {note.author_name || practitionerName || "Clinician"}
                                      </h4>
                                      <Badge
                                        variant="outline"
                                        className={cn(
                                          "text-[10px] font-bold uppercase",
                                          note.note_type === "SOAP Note" && "bg-cyan-500/10 text-cyan-600 border-cyan-500/30",
                                          note.note_type === "Progress Note" && "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
                                          note.note_type === "Consultation Note" && "bg-purple-500/10 text-purple-600 border-purple-500/30",
                                          note.note_type === "Nursing Note" && "bg-amber-500/10 text-amber-600 border-amber-500/30"
                                        )}
                                      >
                                        {note.note_type || "Clinical Note"}
                                      </Badge>
                                      {isConfidential && (
                                        <Badge variant="outline" className="text-[10px] font-bold text-rose-600 border-rose-500/30 bg-rose-500/5 flex items-center gap-1">
                                          <Icon icon="solar:lock-bold" size={10} />
                                          Confidential
                                        </Badge>
                                      )}
                                    </div>
                                    <p className="text-[10px] text-muted-foreground mt-0.5">
                                      Documented on {note.note_date || form.encounter_date}
                                    </p>
                                  </div>
                                </div>

                                <div className="flex items-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
                                    onClick={() => copyNoteToClipboard(note.note_content || "")}
                                    title="Copy note text"
                                  >
                                    <Icon icon="solar:copy-bold" size={13} />
                                    <span>Copy</span>
                                  </Button>
                                </div>
                              </CardHeader>

                              <CardContent className="p-4">
                                {soap ? (
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {/* S */}
                                    <div className="p-3 rounded-xl border border-blue-500/20 bg-blue-500/5 space-y-1">
                                      <div className="flex items-center gap-1.5 text-xs font-bold text-blue-700 dark:text-blue-400">
                                        <span className="h-5 w-5 rounded-full bg-blue-500 text-white flex items-center justify-center text-[10px] font-extrabold">S</span>
                                        <span>Subjective (HPI & Complaints)</span>
                                      </div>
                                      <p className="text-xs text-foreground/90 leading-relaxed pl-6.5 whitespace-pre-wrap">
                                        {soap.subjective || "No complaints recorded."}
                                      </p>
                                    </div>

                                    {/* O */}
                                    <div className="p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 space-y-1">
                                      <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                                        <span className="h-5 w-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] font-extrabold">O</span>
                                        <span>Objective (Exam & Vitals)</span>
                                      </div>
                                      <p className="text-xs text-foreground/90 leading-relaxed pl-6.5 whitespace-pre-wrap">
                                        {soap.objective || "No examination recorded."}
                                      </p>
                                    </div>

                                    {/* A */}
                                    <div className="p-3 rounded-xl border border-purple-500/20 bg-purple-500/5 space-y-1">
                                      <div className="flex items-center gap-1.5 text-xs font-bold text-purple-700 dark:text-purple-400">
                                        <span className="h-5 w-5 rounded-full bg-purple-500 text-white flex items-center justify-center text-[10px] font-extrabold">A</span>
                                        <span>Assessment (Impression)</span>
                                      </div>
                                      <p className="text-xs text-foreground/90 leading-relaxed pl-6.5 whitespace-pre-wrap">
                                        {soap.assessment || "No assessment recorded."}
                                      </p>
                                    </div>

                                    {/* P */}
                                    <div className="p-3 rounded-xl border border-amber-500/20 bg-amber-500/5 space-y-1">
                                      <div className="flex items-center gap-1.5 text-xs font-bold text-amber-700 dark:text-amber-400">
                                        <span className="h-5 w-5 rounded-full bg-amber-500 text-white flex items-center justify-center text-[10px] font-extrabold">P</span>
                                        <span>Plan (Orders & Follow-Up)</span>
                                      </div>
                                      <p className="text-xs text-foreground/90 leading-relaxed pl-6.5 whitespace-pre-wrap">
                                        {soap.plan || "No plan recorded."}
                                      </p>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="text-xs text-foreground whitespace-pre-wrap leading-relaxed font-sans p-2 rounded-lg bg-muted/10">
                                    {note.note_content}
                                  </div>
                                )}
                              </CardContent>
                            </Card>
                          );
                        })}
                    </div>
                  ) : (
                    <Card className="shadow-2xs">
                      <CardContent className="text-center py-12 space-y-3">
                        <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto">
                          <Icon icon="solar:notes-bold-duotone" size={28} />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-foreground">No Clinical Notes Documented</h4>
                          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                            Document comprehensive SOAP notes, progress entries, clinical impressions, or nursing care assessments.
                          </p>
                        </div>
                        <Button
                          onClick={() => setShowNoteModal(true)}
                          className="gap-2 bg-primary text-primary-foreground font-bold text-xs"
                        >
                          <Icon icon="solar:document-add-bold" size={15} />
                          Write First Clinical Note
                        </Button>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Right Sidebar ──────────────────────────────────────────── */}
        <DocumentSidebar
          doctype="PatientEncounter"
          docname={id || "new"}
          displayName={patientName || "New Encounter"}
          initials={initials}
          subtitle={practitionerName ? `with ${practitionerName}` : `HLC-ENC-${id || "NEW"}`}
          avatarColor="bg-red-100 text-red-700"
          createdAt={encounterMeta.creation}
          modifiedAt={encounterMeta.modified}
          createdBy={encounterMeta.owner}
          modifiedBy={encounterMeta.modified_by}
        />
      </div>

      {/* ── Dialog: Advanced Clinical Note / SOAP Composer ──────────────── */}
      <Dialog open={showNoteModal} onOpenChange={setShowNoteModal}>
        <DialogContent className="max-w-2xl max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden">
          <DialogHeader className="p-4 sm:p-5 pb-3 border-b bg-muted/20 shrink-0">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-primary/10 text-primary">
                  <Icon icon="solar:document-add-bold" size={20} />
                </div>
                <div>
                  <DialogTitle className="text-base font-bold">New Clinical Note & SOAP Entry</DialogTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Document comprehensive clinical assessments, SOAP impressions, or multidisciplinary care entries.
                  </p>
                </div>
              </div>
              {patientName && (
                <Badge variant="outline" className="text-[11px] font-medium shrink-0">
                  {patientName}
                </Badge>
              )}
            </div>
          </DialogHeader>

          <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs">
            {/* Mode Switcher */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-2 rounded-xl bg-muted/30 border">
              <div className="flex items-center gap-1.5 p-0.5 bg-background rounded-lg border">
                <button
                  type="button"
                  onClick={() => setNoteForm((p) => ({ ...p, composer_mode: "soap", note_type: "SOAP Note" }))}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5",
                    noteForm.composer_mode === "soap"
                      ? "bg-primary text-primary-foreground shadow-2xs"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon icon="solar:notes-bold-duotone" size={14} />
                  Structured SOAP Note
                </button>
                <button
                  type="button"
                  onClick={() => setNoteForm((p) => ({ ...p, composer_mode: "freeform", note_type: "Progress Note" }))}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5",
                    noteForm.composer_mode === "freeform"
                      ? "bg-primary text-primary-foreground shadow-2xs"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon icon="solar:document-text-bold-duotone" size={14} />
                  Freeform / Narrative
                </button>
              </div>

              {/* 1-Click Templates */}
              {noteForm.composer_mode === "soap" && (
                <div className="flex items-center gap-1 overflow-x-auto text-[11px]">
                  <span className="text-muted-foreground font-medium shrink-0 mr-1 text-[10px] uppercase tracking-wider">
                    Templates:
                  </span>
                  <button
                    type="button"
                    onClick={() => applyNoteTemplate("routine")}
                    className="px-2 py-1 rounded bg-muted hover:bg-primary/10 hover:text-primary transition-colors text-[11px] font-medium shrink-0"
                  >
                    Routine Follow-Up
                  </button>
                  <button
                    type="button"
                    onClick={() => applyNoteTemplate("acute")}
                    className="px-2 py-1 rounded bg-muted hover:bg-primary/10 hover:text-primary transition-colors text-[11px] font-medium shrink-0"
                  >
                    Acute URI
                  </button>
                  <button
                    type="button"
                    onClick={() => applyNoteTemplate("cardio")}
                    className="px-2 py-1 rounded bg-muted hover:bg-primary/10 hover:text-primary transition-colors text-[11px] font-medium shrink-0"
                  >
                    Cardio / HTN
                  </button>
                  <button
                    type="button"
                    onClick={() => applyNoteTemplate("postop")}
                    className="px-2 py-1 rounded bg-muted hover:bg-primary/10 hover:text-primary transition-colors text-[11px] font-medium shrink-0"
                  >
                    Post-Procedure
                  </button>
                </div>
              )}
            </div>

            {/* Note Metadata Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label className="text-[11px] font-semibold text-foreground/80 mb-1 block">Note Category</Label>
                <select
                  value={noteForm.note_type}
                  onChange={(e) => setNoteForm((p) => ({ ...p, note_type: e.target.value }))}
                  className="w-full h-8 px-2.5 rounded-lg border bg-background text-xs text-foreground focus:ring-1 focus:ring-primary focus:outline-none"
                >
                  <option value="SOAP Note">SOAP Note</option>
                  <option value="Progress Note">Progress Note</option>
                  <option value="Consultation Note">Consultation Note</option>
                  <option value="Nursing Note">Nursing Note</option>
                  <option value="Discharge Summary">Discharge Summary</option>
                  <option value="Procedure Note">Procedure Note</option>
                  <option value="Clinical Observation">Clinical Observation</option>
                  <option value="General Note">General Note</option>
                </select>
              </div>

              <div>
                <Label className="text-[11px] font-semibold text-foreground/80 mb-1 block">Author / Clinician</Label>
                <Input
                  value={noteForm.author_name}
                  placeholder={practitionerName || "Attending Physician"}
                  onChange={(e) => setNoteForm((p) => ({ ...p, author_name: e.target.value }))}
                  className="h-8 text-xs"
                />
              </div>

              <div>
                <Label className="text-[11px] font-semibold text-foreground/80 mb-1 block">Encounter Date</Label>
                <Input
                  type="date"
                  value={noteForm.note_date}
                  onChange={(e) => setNoteForm((p) => ({ ...p, note_date: e.target.value }))}
                  className="h-8 text-xs"
                />
              </div>
            </div>

            {/* Structured SOAP Form */}
            {noteForm.composer_mode === "soap" ? (
              <div className="space-y-3">
                {/* S - Subjective */}
                <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-sky-800 dark:text-sky-300 flex items-center gap-1.5">
                      <span className="h-5 w-5 rounded-full bg-sky-500 text-white flex items-center justify-center text-[10px] font-extrabold">
                        S
                      </span>
                      Subjective (Chief Complaint & History of Present Illness)
                    </Label>
                  </div>
                  <textarea
                    rows={2}
                    value={noteForm.subjective}
                    onChange={(e) => setNoteForm((p) => ({ ...p, subjective: e.target.value }))}
                    placeholder="Patient's symptoms, onset, duration, character, aggravating/relieving factors in their own words..."
                    className="w-full p-2.5 rounded-lg border bg-background text-xs text-foreground placeholder:text-muted-foreground/60 focus:ring-1 focus:ring-sky-500 focus:outline-none resize-y min-h-[56px]"
                  />
                </div>

                {/* O - Objective */}
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                      <span className="h-5 w-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] font-extrabold">
                        O
                      </span>
                      Objective (Physical Examination & Vital Signs)
                    </Label>
                  </div>
                  <textarea
                    rows={2}
                    value={noteForm.objective}
                    onChange={(e) => setNoteForm((p) => ({ ...p, objective: e.target.value }))}
                    placeholder="Vitals (BP, HR, RR, Temp, SpO2), physical examination findings, inspection, auscultation, palpation..."
                    className="w-full p-2.5 rounded-lg border bg-background text-xs text-foreground placeholder:text-muted-foreground/60 focus:ring-1 focus:ring-emerald-500 focus:outline-none resize-y min-h-[56px]"
                  />
                </div>

                {/* A - Assessment */}
                <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-purple-800 dark:text-purple-300 flex items-center gap-1.5">
                      <span className="h-5 w-5 rounded-full bg-purple-500 text-white flex items-center justify-center text-[10px] font-extrabold">
                        A
                      </span>
                      Assessment (Clinical Impression & Diagnoses)
                    </Label>
                  </div>
                  <textarea
                    rows={2}
                    value={noteForm.assessment}
                    onChange={(e) => setNoteForm((p) => ({ ...p, assessment: e.target.value }))}
                    placeholder="Primary diagnostic impression, differential diagnoses, progression, stability of existing conditions..."
                    className="w-full p-2.5 rounded-lg border bg-background text-xs text-foreground placeholder:text-muted-foreground/60 focus:ring-1 focus:ring-purple-500 focus:outline-none resize-y min-h-[56px]"
                  />
                </div>

                {/* P - Plan */}
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                      <span className="h-5 w-5 rounded-full bg-amber-500 text-white flex items-center justify-center text-[10px] font-extrabold">
                        P
                      </span>
                      Plan (Therapy, Medications, Diagnostics & Follow-Up)
                    </Label>
                  </div>
                  <textarea
                    rows={2}
                    value={noteForm.plan}
                    onChange={(e) => setNoteForm((p) => ({ ...p, plan: e.target.value }))}
                    placeholder="Prescriptions prescribed, diagnostic tests ordered, referrals, counseling, return precautions, follow-up timeline..."
                    className="w-full p-2.5 rounded-lg border bg-background text-xs text-foreground placeholder:text-muted-foreground/60 focus:ring-1 focus:ring-amber-500 focus:outline-none resize-y min-h-[56px]"
                  />
                </div>
              </div>
            ) : (
              /* Narrative / Freeform Note */
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Icon icon="solar:document-text-bold" className="text-primary" size={15} />
                  Clinical Narrative / Note Content
                </Label>
                <textarea
                  rows={8}
                  value={noteForm.freeform_content}
                  onChange={(e) => setNoteForm((p) => ({ ...p, freeform_content: e.target.value }))}
                  placeholder="Enter detailed clinical narrative, procedure note, multidisciplinary consultation notes, or progress entries..."
                  className="w-full p-3 rounded-lg border bg-background text-xs text-foreground placeholder:text-muted-foreground/60 focus:ring-1 focus:ring-primary focus:outline-none resize-y min-h-[140px]"
                />
              </div>
            )}

            {/* Confidentiality Toggle */}
            <div className="flex items-center justify-between p-2.5 rounded-lg border bg-muted/20">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="confidentialCheck"
                  checked={noteForm.is_confidential}
                  onChange={(e) => setNoteForm((p) => ({ ...p, is_confidential: e.target.checked }))}
                  className="rounded border-muted text-primary focus:ring-primary h-3.5 w-3.5"
                />
                <label htmlFor="confidentialCheck" className="text-xs font-semibold cursor-pointer select-none">
                  Mark as Confidential / Sensitive Clinical Note
                </label>
              </div>
              <span className="text-[10px] text-muted-foreground">
                Flags this note with a security indicator in the clinical chart
              </span>
            </div>
          </div>

          <DialogFooter className="p-3.5 sm:p-4 border-t bg-muted/15 flex items-center justify-between shrink-0">
            <div className="text-[11px] text-muted-foreground hidden sm:block">
              {noteForm.composer_mode === "soap" ? "Structured S-O-A-P format" : "Freeform narrative format"}
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowNoteModal(false)}
                className="h-8 text-xs font-medium"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSaveClinicalNote}
                disabled={savingNote}
                className="h-8 text-xs font-bold gap-1.5 bg-primary text-primary-foreground"
              >
                {savingNote ? (
                  <Icon icon="solar:refresh-bold" className="animate-spin" size={14} />
                ) : (
                  <Icon icon="solar:check-read-bold" size={14} />
                )}
                Save Clinical Note
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ApplyTreatmentPlanDialog
        open={showTemplateDialog}
        onOpenChange={setShowTemplateDialog}
        onApply={handleApplyTemplate}
      />

      <PrescriptionPrintModal
        open={showPrintModal}
        onOpenChange={setShowPrintModal}
        patientName={patientName}
        patientAge={patientAge}
        patientSex={patientSex}
        practitionerName={practitionerName}
        departmentName={form.department_name}
        encounterDate={form.encounter_date}
        diagnoses={diagnoses}
        symptoms={symptoms}
        drugRows={drugRows}
        companyName={form.company || "Healthcare Center"}
      />
    </div>
  );
}
