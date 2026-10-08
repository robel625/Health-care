import apiClient from "../apiClient";

// ============================================
// Healthcare API Service
// ============================================

// ── Types ───────────────────────────────────

export interface MedicalDepartment {
  id: number;
  department: string;
  patient_care_type: string;
  show_in_portal: boolean;
}

export interface HealthcareServiceUnitType {
  id: number;
  service_unit_type: string;
  description: string;
  is_group: boolean;
}

export interface HealthcareServiceUnit {
  id: number;
  service_unit_name: string;
  service_unit_type: number | null;
  service_unit_type_name: string;
  department: number | null;
  is_active: boolean;
  occupancy_status: string;
  max_capacity: number;
  current_occupancy: number;
}

export interface Patient {
  id: number;
  patient_id: string;
  first_name: string;
  middle_name: string;
  last_name: string;
  patient_name: string;
  sex: string;
  blood_group: string;
  dob: string;
  age: number;
  status: string;
  uid?: string;
  report_preference?: string;
  mobile: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  country: string;
  pincode?: string;
  customer?: number | null;
  customer_group?: string;
  territory?: string;
  default_price_list?: string;
  default_currency?: number | null;
  language?: string;
  occupation: string;
  marital_status: string;
  allergies: string;
  medical_history: string;
  surgical_history?: string;
  medication?: string;
  risk_factors?: string;
  patient_details?: string;
  tobacco_past_use?: string;
  tobacco_current_use?: string;
  alcohol_past_use?: string;
  // Company Affiliation (EEU / EEP / Contractor)
  company?: number | null;
  company_name?: string;
  company_affiliation?: "Ethiopian Electric Utility (EEU)" | "Ethiopian Electric Power (EEP)" | "Contractor / Other" | string;
  employer_code?: "EEU" | "EEP" | "others" | string;
  // EEU / EEP Occupational & Staff Details
  eeu_staff_id?: string;
  eeu_department?: string;
  eeu_region?: string;
  eeu_work_station?: string;
  eeu_cadre?: string;
  eeu_beneficiary_type?: "Staff" | "Spouse" | "Child" | "Dependent Parent" | string;
  eeu_primary_staff_id?: string;
  eeu_medical_coverage_status?: "Active Coverage" | "Exceeded Ceiling" | "Suspended" | "Special Approval" | string;
  eeu_climbing_fitness_status?: "Fit to Climb" | "Restricted Ground Duty" | "Temporarily Unfit" | "Pending Annual Assessment" | "Not Applicable" | string;
  eeu_annual_benefit_ceiling_etb?: number;
  eeu_benefit_used_etb?: number;
  gender?: string;
  inpatient_status: string;
  inpatient_record?: number | null;
  inpatient_record_name?: string;
  inpatient_service_unit_name?: string;
  inpatient_practitioner_name?: string;
  emergency_record?: number | null;
  image?: string;
  creation?: string;
  modified?: string;
  owner?: string;
  modified_by?: string;
}

export interface PatientRelation {
  id: number;
  patient: number;
  patient_name?: string;
  related_patient?: number | null;
  related_patient_name?: string;
  relation: "Father" | "Mother" | "Spouse" | "Siblings" | "Family" | "Other" | string;
  contact_name?: string;
  contact_phone?: string;
  description?: string;
  creation?: string;
  modified?: string;
}

export interface HealthcarePractitioner {
  id: number;
  practitioner_id: string;
  first_name: string;
  middle_name: string;
  last_name: string;
  practitioner_name: string;
  gender: string;
  status: string;
  practitioner_type: string;
  department: number | null;
  department_name: string;
  designation: string;
  mobile_phone: string;
  residence_phone?: string;
  office_phone?: string;
  email: string;
  address?: string;
  user?: number | null;
  op_consulting_charge: number;
  op_consulting_charge_item?: number | null;
  op_consulting_charge_item_name?: string;
  inpatient_visit_charge?: number;
  inpatient_visit_charge_item?: number | null;
  inpatient_visit_charge_item_name?: string;
  enable_free_follow_ups?: boolean;
  max_visits?: number;
  valid_days?: number;
  image?: string;
  creation?: string;
  modified?: string;
  owner?: string;
  modified_by?: string;
}

export interface DiagnosticReport {
  id: number;
  report_id?: string;
  title: string;
  patient: number;
  patient_name?: string;
  practitioner?: number | null;
  practitioner_name?: string;
  company?: number | null;
  status: string;
  ref_doctype?: string;
  docname?: string;
  sales_invoice_status?: string;
  reference_posting_date?: string;
  observation?: number | null;
  sample_collection?: number | null;
  notes?: string;
  created_at?: string;
  updated_at?: string;
  creation?: string;
  modified?: string;
}

export interface PractitionerSchedule {
  id: number;
  practitioner: number;
  practitioner_name: string;
  day: string;
  start_time: string;
  end_time: string;
  service_unit: number | null;
  max_appointments: number;
  is_active: boolean;
}

export interface AppointmentTypeConfig {
  id: number;
  appointment_type: string;
  allow_booking_for: string;
  default_duration: number;
  color: string;
}

export interface PatientAppointment {
  id: number;
  appointment_id: string;
  title: string;
  naming_series: string;
  patient: number;
  patient_name: string;
  patient_sex: string;
  patient_age: string;
  practitioner: number;
  practitioner_name: string;
  department: number | null;
  department_name: string;
  service_unit: number | null;
  company: number | null;
  status: string;
  appointment_type: number | null;
  appointment_type_name: string;
  appointment_type_color: string;
  appointment_for: string;
  appointment_date: string;
  appointment_time: string | null;
  appointment_datetime: string | null;
  appointment_end_datetime: string | null;
  duration: number;
  notes: string;
  paid_amount: number;
  invoiced: boolean;
  mode_of_payment: string;
  add_video_conferencing: boolean;
  google_meet_link: string;
  insurance_policy: number | null;
  insurance_policy_name: string;
  insurance_payor: number | null;
  insurance_payor_name: string;
  insurance_coverage: number | null;
  coverage_status: string;
  source: string;
  referring_practitioner: number | null;
  referring_practitioner_name: string;
  procedure_template: number | null;
  therapy_plan: number | null;
  therapy_type: number | null;
  appointment_based_on_check_in: boolean;
  position_in_queue: number;
  inpatient_record: number | null;
  emergency_record: number | null;
  ref_sales_invoice: string;
}

export interface VitalSigns {
  id: number;
  naming_series: string;
  title: string;
  patient: number;
  patient_name: string;
  inpatient_record: number | null;
  appointment: number | null;
  encounter: number | null;
  company: number | null;
  signs_date: string;
  signs_time: string | null;
  temperature: number | null;
  pulse: number | null;
  respiratory_rate: number | null;
  tongue: string;
  abdomen: string;
  reflexes: string;
  bp_systolic: number | null;
  bp_diastolic: number | null;
  bp: string;
  vital_signs_note: string;
  height: number | null;
  weight: number | null;
  bmi: number | null;
  nutrition_note: string;
  amended_from: number | null;
  created_at: string;
  updated_at: string;
}

export interface PatientEncounter {
  id: number;
  encounter_id: string;
  title: string;
  patient: number;
  patient_name: string;
  /** Age snapshot, formatted as Marley's `patient_age` ("35 Year(s) 2 Month(s)..."). */
  patient_age: string;
  /** The patient's sex, read through from the Patient record (Marley's `patient_sex`). */
  patient_sex: string;
  practitioner: number;
  practitioner_name: string;
  department: number | null;
  department_name: string;
  appointment_type: number | null;
  appointment_type_name: string;
  source: string;
  status: string;
  encounter_date: string;
  encounter_time: string | null;
  symptoms: string;
  physical_examination: string;
  /** Marley's "Review Details" — a plain Small Text, not a picker. */
  encounter_comment: string;
  symptoms_in_print: boolean;
  diagnosis_in_print: boolean;
  clinical_notes: string;
  invoiced: boolean;
  diagnoses_list: Diagnosis[];
  symptoms_list_items: Symptom[];
  codification_table: CodificationRow[];
  drug_prescription_items: DrugPrescription[];
  lab_prescription_items: LabPrescription[];
  procedure_prescription_items: ProcedurePrescription[];
  therapies: TherapyPlanDetail[];
}

/**
 * One entry of a doctype's meta — Frappe's `docfield`. `options` is a list for
 * a Select and a target doctype name for a Link.
 */
export interface DoctypeFieldMeta {
  fieldname: string;
  fieldtype: string;
  label: string;
  options?: string[] | string;
  reqd?: boolean;
  read_only?: boolean;
  fetch_from?: string;
  default?: any;
  /** Set on Intent/Priority Links: the Code System their values come from. */
  code_system?: string;
  /** Marley's conditional-field expressions, kept verbatim — see
   *  `@/utils/doctypeMeta` for the reader that evaluates them. */
  depends_on?: string;
  mandatory_depends_on?: string;
  read_only_depends_on?: string;
  fetch_if_empty?: boolean;
  hidden?: boolean;
  description?: string;
  /** Set on a Section Break: Marley's collapsible section. */
  collapsible?: boolean;
}

export interface ChildTableMeta {
  doctype: string;
  label: string;
  fields: DoctypeFieldMeta[];
}

/** The payload of a form's `meta` endpoint. */
export interface DoctypeFormMeta {
  doctype: string;
  fields: DoctypeFieldMeta[];
  child_tables: Record<string, ChildTableMeta>;
}

/** The payload of `GET /healthcare/encounters/meta/`. */
export type EncounterFormMeta = DoctypeFormMeta;

/** The payload of `GET /healthcare/lab-test-templates/meta/`. */
export type LabTestTemplateFormMeta = DoctypeFormMeta;

export interface Company {
  id: number;
  company_name: string;
  abbr: string;
  default_currency: string;
  country: string;
  is_default: boolean;
  is_active: boolean;
}

export interface DiagnosisCatalog {
  id: number;
  diagnosis: string;
  estimated_duration: string;
  description: string;
}

/** A patient complaint — the option source behind the encounter Symptoms picker. */
export interface Complaint {
  id: number;
  complaint: string;
}

export interface DosageForm {
  id: number;
  dosage_form: string;
}

/** Standard prescription duration ("5 Day(s)") — the Medications Period field. */
export interface PrescriptionDuration {
  id: number;
  number?: number;
  period: string;
}

export interface ClinicalProcedureTemplate {
  id: number;
  template_name: string;
  description: string;
  department: number | null;
  is_active: boolean;
}

export interface ServiceRequest {
  id: number;
  request_id: string;
  title: string;
  name?: string;
  template_dt?: string;
  template_dn?: string;
  sample_collection_required?: boolean | number;
  quantity?: number;
  as_needed?: boolean;
  patient_instruction?: string;
  clinical_history?: string;
  order_description?: string;
  patient: number;
  patient_name?: string;
  practitioner?: number | null;
  practitioner_name?: string;
  department?: number | null;
  department_name?: string;
  category?: number | null;
  category_name?: string;
  status: "Draft" | "Active" | "Completed" | "Cancelled" | "On Hold" | string;
  intent: "Order" | "Plan" | "Proposal" | "Directive" | string;
  priority: "Routine" | "Urgent" | "STAT" | "ASAP" | string;
  order_date: string;
  expected_date?: string | null;
  notes?: string;
  reference_doctype?: string;
  reference_name?: string;
  creation?: string;
  modified?: string;
}

export interface ServiceRequestCategory {
  id: number;
  category: string;
  description?: string;
}

/**
 * A medical coding system — Marley's `Code System`. `uri` is what the
 * encounter's Codification Table stores as `system`, and `oid` is copied onto
 * each row alongside it.
 */
export interface CodeSystem {
  id: number;
  code_system: string;
  uri: string;
  oid: string;
  description: string;
  status: string;
  version: string;
  is_fhir_defined: boolean;
  experimental: boolean;
  custom: boolean;
  immutable: boolean;
  complete: boolean;
}

/** A code within a Code System — Marley's `Code Value`. */
export interface CodeValue {
  id: number;
  code_system: number;
  code: string;
  display: string;
  definition: string;
}

/** One row of the encounter's Medical Coding table (Marley `Codification Table`). */
export interface CodificationRow {
  id: number;
  /** The owning document: an encounter, or a lab test template. Marley shares
   *  this child doctype between them, so one of the two is set. */
  encounter: number | null;
  lab_test_template?: number | null;
  code_system: number | null;
  code_system_name: string;
  /** Fetched from `code_system.uri`, as Marley's `fetch_from` does. */
  system: string;
  is_fhir_defined: boolean;
  oid: string;
  code_value: number | null;
  code_value_display: string;
  code: string;
  display: string;
  definition: string;
}

/** OPD / IPD / Emergency / Day Care — Marley's `Patient Care Type`. */
export interface PatientCareType {
  id: number;
  patient_care_type: string;
  description: string;
}

/** `1-0-1` style dosage notation — Marley's `Prescription Dosage`. */
export interface PrescriptionDosage {
  id: number;
  dosage: string;
  description: string;
}

/**
 * An Investigations row — Marley's `Lab Prescription`. `lab_test_code` links a
 * Lab Test Template and `lab_test_name` is fetched from it.
 */
export interface LabPrescription {
  id: number;
  encounter: number | null;
  patient: number;
  patient_name: string;
  lab_test_code: number | null;
  lab_test_code_name: string;
  lab_test_name: string;
  lab_test_comment: string;
  observation_template: number | null;
  observation_template_name: string;
  patient_care_type: number | null;
  patient_care_type_name: string;
  intent: string;
  priority: string;
  invoiced: boolean;
  lab_test_created: boolean;
  service_request: number | null;
}

/** A Procedures row — Marley's `Procedure Prescription`. */
export interface ProcedurePrescription {
  id: number;
  encounter: number | null;
  patient: number;
  patient_name: string;
  procedure: number | null;
  procedure_name: string;
  department: number | null;
  department_name: string;
  practitioner: number | null;
  practitioner_name: string;
  date: string | null;
  comments: string;
  no_of_sessions: number;
  interval: string;
  patient_care_type: number | null;
  patient_care_type_name: string;
  intent: string;
  priority: string;
  appointment_booked: boolean;
  procedure_created: boolean;
  invoiced: boolean;
  service_request: number | null;
}

/** A Rehabilitation row — Marley's `Therapy Plan Detail` used as a child table. */
export interface TherapyPlanDetail {
  id: number;
  encounter: number | null;
  plan: number | null;
  patient: number;
  therapy_type: number | null;
  therapy_type_name: string;
  no_of_sessions: number;
  sessions_completed: number;
  interval: string;
  patient_care_type: number | null;
  patient_care_type_name: string;
  intent: string;
  priority: string;
  service_request: number | null;
}

export interface Diagnosis {
  id: number;
  encounter: number;
  diagnosis: string;
  diagnosis_master: number | null;
  diagnosis_master_name: string;
  diagnosis_code: string;
  status: string;
  is_primary: boolean;
}

export interface Symptom {
  id: number;
  encounter: number;
  symptom: string;
  complaint_master: number | null;
  complaint_master_name: string;
  severity: string;
  duration: string;
}

/**
 * A Medications row — Marley's `Drug Prescription`. `drug_code` links a stock
 * Item and `drug_name` is fetched from it; `medication` links the Medication
 * master and carries the defaults that fill dosage / period / dosage form.
 */
export interface DrugPrescription {
  id: number;
  patient: number;
  patient_name: string;
  practitioner: number;
  practitioner_name: string;
  encounter: number | null;
  /** Marley stores the prescribed drug name here. */
  medication_name: string;
  medication: number | null;
  drug_code: string;
  drug_name: string;
  strength: string;
  strength_uom: string;
  dosage_form: string;
  dosage: string;
  interval: string;
  interval_uom: string;
  dosage_by_interval: boolean;
  update_schedule: boolean;
  period: string;
  number_of_repeats_allowed: number;
  quantity: number;
  refills: number;
  comment: string;
  intent: string;
  priority: string;
  status: string;
  prescribed_date: string;
}

export interface MedicationRequest {
  id: number;
  request_id?: string;
  order_number?: string;
  patient: number;
  patient_name?: string;
  practitioner?: number | null;
  practitioner_name?: string;
  medication_item?: number | null;
  medication_name: string;
  dosage?: string;
  period?: string;
  dosage_form?: string;
  status: string;
  priority?: string;
  quantity?: number;
  billing_status?: string;
  warehouse?: number | null;
  warehouse_name?: string;
  stock_entry?: number | null;
  stock_entry_number?: string;
  dispensed_datetime?: string | null;
  dispensed_by?: number | null;
  dispensed_by_name?: string;
  created_at?: string;
  instructions?: string;
  order_date?: string;
  order_time?: string;
  expected_date?: string;
  company?: number | null;
  company_name?: string;
  encounter?: number | null;
  intent?: string;
  refill_count?: number;
  number_of_repeats_allowed?: number;
  total_dispensable_quantity?: number;
  staff_role?: string;
  order_description?: string;
  notes?: string;
  qty_invoiced?: number;
  patient_identifier?: string;
  patient_mobile?: string;
  patient_email?: string;
  patient_birth_date?: string;
  patient_age?: number;
  patient_gender?: string;
  patient_blood_group?: string;
  inpatient_record?: number | null;
  inpatient_status?: string;
  practitioner_email?: string;
  medical_department?: string;
}

export interface InpatientMedicationEntryDetail {
  id?: number;
  entry?: number;
  patient: number | null;
  patient_name?: string;
  inpatient_record: number | null;
  service_unit: number | null;
  service_unit_name?: string;
  drug: number | null;
  drug_code: string;
  drug_name: string;
  dosage: string;
  dosage_form: string;
  medication_order: number | null;
  medication_order_entry: number | null;
  date: string;
  time: string;
  quantity: number;
  is_completed: boolean;
  instructions?: string;
}

export interface InpatientMedicationEntry {
  id: number;
  entry_id: string;
  company: number | null;
  company_name?: string;
  posting_date: string;
  status: "Draft" | "Submitted" | "Cancelled";
  warehouse: number | null;
  warehouse_name?: string;
  patient: number | null;
  patient_name?: string;
  department?: number | null;
  department_name?: string;
  service_unit: number | null;
  service_unit_name?: string;
  practitioner: number | null;
  practitioner_name?: string;
  assigned_to_practitioner: number | null;
  assigned_to_practitioner_name?: string;
  item_code: string;
  from_date: string | null;
  to_date: string | null;
  from_time: string | null;
  to_time: string | null;
  update_stock: boolean;
  stock_entry: number | null;
  stock_entry_number?: string;
  remarks: string;
  medication_orders?: InpatientMedicationEntryDetail[];
  created_at?: string;
  updated_at?: string;
}

export interface ShortageItem {
  item_code: string;
  item_name: string;
  required_qty: number;
  available_qty: number;
  shortage_qty: number;
}

export interface PharmacyStockBalance {
  item_id: number;
  item_code: string;
  item_name: string;
  item_group: string;
  stock_uom: string;
  warehouse_id: number;
  warehouse_name: string;
  actual_qty: number;
  valuation_rate: number;
  reorder_level: number;
  is_low_stock: boolean;
}

export interface PharmacyWarehouse {
  id: number;
  name: string;
  warehouse_name: string;
  is_group?: boolean;
  parent_warehouse?: number | null;
  company?: string;
  disabled?: boolean;
}

export type Warehouse = PharmacyWarehouse;

export interface PharmacyDashboardStats {
  pending_inpatient_orders: number;
  active_prescriptions: number;
  dispensed_today: number;
  low_stock_items: number;
  warehouses: Array<{ id: number; warehouse_name: string; is_group: boolean }>;
}

export interface OutpatientPrescriptionItem {
  source: "DrugPrescription" | "MedicationRequest";
  id: number;
  prescription_id: number | null;
  medication_request_id: number | null;
  medication_name: string;
  drug_code: string;
  dosage: string;
  dosage_form: string;
  period: string;
  quantity: number;
  practitioner_name: string;
  prescribed_date: string;
  encounter_id: number | null;
  instructions: string;
}

export interface OutpatientDispenseItem {
  item_code: string;
  item_name: string;
  quantity: number;
  unit_price: number;
  dosage?: string;
  frequency?: string;
  period?: string;
  instructions?: string;
  prescription_id?: number | null;
  medication_request_id?: number | null;
}

export interface OutpatientDispensePayload {
  patient_id?: number | null;
  patient_name?: string;
  warehouse_id: number;
  payment_method: "Cash" | "Card" | "Insurance" | "Mobile Money" | "Bill Later";
  items: OutpatientDispenseItem[];
  notes?: string;
}

export interface OutpatientDispenseReceipt {
  message: string;
  stock_entry_id: number;
  stock_entry_number: string;
  patient_name: string;
  patient_id?: string | null;
  dispensed_datetime: string;
  warehouse_name: string;
  payment_method: string;
  total_amount: number;
  payment_id?: string | null;
  dispensed_by: string;
  items: Array<{
    item_code: string;
    item_name: string;
    quantity: number;
    unit_price: number;
    total: number;
    dosage?: string;
    frequency?: string;
    period?: string;
    instructions?: string;
  }>;
}

export interface OutpatientHistoryItem {
  id: number;
  stock_entry_number: string;
  posting_date: string;
  warehouse_name: string;
  purpose: string;
  notes: string;
  items_count: number;
  total_qty: number;
}

export interface AddStockItem {
  item_code: string;
  item_name?: string;
  quantity: number;
  rate: number;
  batch_no?: string;
  expiry_date?: string;
  uom?: string;
}

export interface AddStockPayload {
  warehouse_id: number;
  entry_type?: "Material Receipt" | "Material Transfer";
  from_warehouse_id?: number | null;
  supplier_name?: string;
  purchase_invoice_no?: string;
  notes?: string;
  update_item_rate?: boolean;
  items: AddStockItem[];
}

export interface AddStockResponse {
  message: string;
  stock_entry_id: number;
  stock_entry_number: string;
  entry_type: string;
  warehouse_id: number;
  warehouse_name: string;
  supplier_name?: string;
  reference_no?: string;
  total_qty: number;
  total_value: number;
  items: Array<{
    item_code: string;
    item_name: string;
    quantity: number;
    rate: number;
    amount: number;
    batch_no: string;
    new_warehouse_balance: number;
  }>;
}

export interface DisposeStockItem {
  item_code: string;
  item_name?: string;
  quantity: number;
  batch_no?: string;
  reason?: string;
  disposal_method?: string;
}

export interface DisposeStockPayload {
  warehouse_id: number;
  disposal_certificate_no?: string;
  authorized_by?: string;
  witness_name?: string;
  reason?: string;
  disposal_method?: string;
  notes?: string;
  items: DisposeStockItem[];
}

export interface DisposeStockResponse {
  message: string;
  stock_entry_id: number;
  stock_entry_number: string;
  disposal_certificate_no: string;
  authorized_by: string;
  witness_name: string;
  disposal_date: string;
  warehouse_name: string;
  total_qty_disposed: number;
  total_loss_value: number;
  items: Array<{
    item_code: string;
    item_name: string;
    quantity: number;
    rate: number;
    writeoff_value: number;
    batch_no: string;
    reason: string;
    disposal_method: string;
    remaining_warehouse_balance: number;
  }>;
}

export interface StockVoucherHistoryItem {
  id: number;
  stock_entry_number: string;
  entry_type?: string;
  posting_date: string;
  warehouse_name?: string;
  from_warehouse_name?: string;
  to_warehouse_name?: string;
  purpose: string;
  notes: string;
  items_count: number;
  total_qty: number;
  total_value?: number;
}



/** A Compound/Single result row — Marley's `Normal Test Result` child table. */
export interface NormalTestResultRow {
  id: number;
  lab_test: number | null;
  idx: number;
  lab_test_name: string;
  lab_test_event: string;
  result_value: string;
  lab_test_uom: number | null;
  lab_test_uom_name: string;
  normal_range: string;
  lab_test_comment: string;
  template: number | null;
  secondary_uom: number | null;
  secondary_uom_name: string;
  conversion_factor: number | null;
  secondary_uom_result: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  require_result_value: boolean;
  allow_blank: boolean;
}

/** A Descriptive result row — Marley's `Descriptive Test Result` child table. */
export interface DescriptiveTestResultRow {
  id: number;
  lab_test: number | null;
  idx: number;
  lab_test_particulars: string;
  result_value: string;
  allow_blank: boolean;
  require_result_value: boolean;
  template: number | null;
}

/** A Sensitivity result row — Marley's `Sensitivity Test Result` child table. */
export interface SensitivityTestResultRow {
  id: number;
  lab_test: number | null;
  idx: number;
  antibiotic: number | null;
  antibiotic_name: string;
  antibiotic_sensitivity: number | null;
  sensitivity_name: string;
}

/** An Organism result row — Marley's `Organism Test Result` child table. */
export interface OrganismTestResultRow {
  id: number;
  lab_test: number | null;
  idx: number;
  organism: number;
  organism_name: string;
  colony_population: string;
  colony_uom: number | null;
  colony_uom_name: string;
}

/** Antibiotic / Sensitivity / Organism reference rows used by the form's pickers. */
export interface Antibiotic {
  id: number;
  antibiotic_name: string;
  spectrum: string;
}
export interface Sensitivity {
  id: number;
  sensitivity: string;
}
export interface Organism {
  id: number;
  organism: string;
  abbr: string;
}

/** The Healthcare Settings flags the Lab Test form reads. */
export interface HealthcareSettingsInfo {
  id: number;
  lab_test_approval_required: boolean;
  create_sample_collection_for_lab_test: boolean;
  validate_nursing_checklists: boolean;
}

/**
 * Lab Test — Marley's doctype of the same name, its `field_order` split into
 * the identity/ordering row, the patient block, the result tables (served
 * read-only; rows are written through their own endpoints), the print
 * sections and More Information.
 */
export interface LabTest {
  id: number;
  test_id: string;
  naming_series: string;
  template: number | null;
  template_name: string;
  lab_test_name: string;
  lab_test_group: number | null;
  lab_test_group_name: string;
  department: number | null;
  department_name: string;
  company: string;
  /** Marley's set: Draft / Completed / Approved / Rejected / Cancelled. */
  status: string;
  date: string;
  time: string | null;
  submitted_date: string | null;
  result_date: string | null;
  approved_date: string | null;
  expected_result_date: string | null;
  expected_result_time: string | null;
  printed_on: string | null;
  timezone: string;
  // Patient block (denormalised from the Patient, as Marley's fetch_from)
  patient: number;
  patient_name: string;
  patient_age: string;
  patient_sex: string;
  inpatient_record: number | null;
  emergency_record: number | null;
  report_preference: string;
  email: string;
  mobile: string;
  service_unit: number | null;
  practitioner: number | null;
  practitioner_name: string;
  requesting_department: number | null;
  requesting_department_name: string;
  /** App extra kept for older filters — the form binds `practitioner`. */
  requesting_practitioner: number | null;
  encounter: number | null;
  employee: string;
  user: number | null;
  sample: number | null;
  sample_name: string;
  // Specimen Custody & Accessioning Workflow
  specimen_status?: "Pending Collection" | "Collected" | "Received" | "Rejected" | "Not Required" | string;
  specimen_barcode?: string;
  collected_by?: string;
  collection_datetime?: string | null;
  collection_site?: string;
  specimen_received_by?: number | null;
  specimen_received_by_name?: string;
  specimen_received_time?: string | null;
  specimen_condition?: string;
  specimen_temperature_receipt?: string;
  specimen_rejection_reason?: string;
  sample_details?: string;
  sample_qty?: number;
  sample_uom?: string;
  container_closure_color?: string;
  template_sample_name?: string;
  // Results
  /** App extra — a free result field predating the Marley rebuild. */
  result: string;
  lab_test_comment: string;
  normal_range: string;
  custom_result: string;
  descriptive_result: string;
  worksheet_instructions: string;
  legend_print_position: string;
  result_legend: string;
  normal_toggle: boolean;
  imaging_toggle: boolean;
  descriptive_toggle: boolean;
  sensitivity_toggle: boolean;
  // More Information
  service_request: number | null;
  invoiced: boolean;
  email_sent: boolean;
  sms_sent: boolean;
  printed: boolean;
  prescription: number | null;
  amended_from: number | null;
  // Child tables — read-only here, written through their own endpoints
  normal_test_items: NormalTestResultRow[];
  descriptive_test_items: DescriptiveTestResultRow[];
  sensitivity_test_items: SensitivityTestResultRow[];
  organism_test_items: OrganismTestResultRow[];
  codification_table: CodificationRow[];
}

export interface InpatientMedicationOrder {
  id: number;
  order_id?: string;
  inpatient_record: number;
  patient: number;
  patient_name?: string;
  practitioner?: number | null;
  medication_name: string;
  dosage?: string;
  frequency?: string;
  route?: string;
  start_date: string;
  end_date?: string | null;
  status?: "Active" | "Completed" | "Cancelled" | "On Hold";
  notes?: string;
}

export interface PrescriptionDosage {
  id: number;
  dosage: string;
  dosage_strength?: number;
  dosage_form?: number | null;
}

export interface Antibiotic {
  id: number;
  antibiotic_name: string;
}

export interface Sensitivity {
  id: number;
  sensitivity: string;
}

export interface Organism {
  id: number;
  organism: string;
}

export interface LabTestTemplate {
  id: number;
  lab_test_name: string;
  department: number | null;
  department_name: string;
  disabled: boolean;
  nursing_checklist_template: number | null;
  nursing_checklist_template_name: string;
  // Billing
  link_existing_item: boolean;
  item: number | null;
  item_name: string;
  lab_test_code: string;
  lab_test_group: number | null;
  lab_test_group_name: string;
  is_billable: boolean;
  lab_test_rate: number;
  // Result Format
  lab_test_template_type: string;
  lab_test_uom: number | null;
  uom_name: string;
  secondary_uom: number | null;
  secondary_uom_name: string;
  conversion_factor: number | null;
  lab_test_normal_range: string;
  sensitivity: boolean;
  // Sample Collection
  sample: number | null;
  sample_name: string;
  sample_uom: string;
  sample_qty: number;
  sample_details: string;
  change_in_item: boolean;
  // Worksheet & Legend
  worksheet_instructions: string;
  legend_print_position: string;
  result_legend: string;
  patient_care_type: number | null;
  patient_care_type_name: string;
  staff_role: number | null;
  staff_role_name: string;
  // Description
  lab_test_description: string;
  descriptive_result: string;
  // Child tables. Read-only on the template — rows are written through their
  // own endpoints, so the form can tell an insert from an update or delete.
  normal_test_templates?: NormalTestTemplateRow[];
  descriptive_test_templates?: DescriptiveTestTemplateRow[];
  lab_test_groups?: LabTestGroupTemplateRow[];
  codification_table?: CodificationRow[];
}

/** A Compound-result row — Marley's `Normal Test Template`. */
export interface NormalTestTemplateRow {
  id?: number;
  parent_template?: number;
  idx?: number;
  lab_test_event: string;
  lab_test_uom: number | null;
  lab_test_uom_name?: string;
  normal_range: string;
  secondary_uom: number | null;
  secondary_uom_name?: string;
  conversion_factor: number | null;
  allow_blank: boolean;
}

/** A Descriptive-result component row — Marley's `Descriptive Test Template`. */
export interface DescriptiveTestTemplateRow {
  id?: number;
  parent_template?: number;
  idx?: number;
  particulars: string;
  allow_blank: boolean;
}

/** A Grouped-result row — Marley's `Lab Test Group Template`. */
export interface LabTestGroupTemplateRow {
  id?: number;
  parent_template?: number;
  idx?: number;
  template_or_new_line: string;
  lab_test_template: number | null;
  lab_test_template_name?: string;
  lab_test_rate: number;
  lab_test_description: string;
  group_event: string;
  group_test_uom: number | null;
  group_test_uom_name?: string;
  group_test_normal_range: string;
  secondary_uom: number | null;
  secondary_uom_name?: string;
  conversion_factor: number | null;
  allow_blank: boolean;
}

export interface LabTestSample {
  id: number;
  sample: string;
  sample_uom: number | null;
  sample_uom_name: string;
  sample_type: number | null;
  sample_type_name: string;
  container_closure_color: string;
}

export interface LabTestUOM {
  id: number;
  lab_test_uom: string;
  uom_description: string;
}

export interface SampleCollection {
  id: number;
  naming_series: string;
  collection_id?: string;
  patient: number;
  patient_name: string;
  patient_age: string;
  patient_sex: string;
  company: string;
  status: string;
  invoiced: boolean;
  sample: number | null;
  sample_name: string;
  sample_uom: string;
  sample_qty: number;
  collected_by: string;
  collected_time: string | null;
  num_print: number;
  sample_details: string;
  collection_point: number | null;
  appointment: number | null;
  referring_practitioner: number | null;
  referring_practitioner_name: string;
  lab_test: number | null;
  service_request: string;
  container_closure_color?: string;
  collection_point_name?: string;
  barcode?: string;
  collection_site?: string;
  receipt_status?: string;
  receipt_datetime?: string | null;
  received_by?: number | null;
  rejection_reason?: string;
}

export interface TherapyType {
  id: number;
  therapy_type: string;
  description: string;
  is_active: boolean;
}

export interface TherapyPlan {
  id: number;
  plan_id: string;
  patient: number;
  patient_name: string;
  practitioner_name: string;
  title: string;
  status: string;
  start_date: string;
  end_date: string;
  goals: string;
  total_sessions: number;
  completed_sessions: number;
}

export interface TherapySession {
  id: number;
  session_id: string;
  patient: number;
  patient_name: string;
  practitioner_name: string;
  therapy_type: number | null;
  session_date: string;
  duration: number;
  status: string;
  notes: string;
}

export interface Exercise {
  id: number;
  exercise_name: string;
  description: string;
  therapy_type: number | null;
  body_part: string;
  difficulty_level: string;
  duration_minutes: number;
  instructions: string;
  is_active: boolean;
}

export interface InsurancePayor {
  id: number;
  payor_name: string;
  payor_id: string;
  is_active: boolean;
  contact_email: string;
  contact_phone: string;
}

export interface InsuranceClaim {
  id: number;
  claim_id: string;
  patient: number;
  patient_name: string;
  payor_name: string;
  claim_amount: number;
  approved_amount: number;
  status: string;
  submitted_date: string | null;
}

export interface InpatientRecord {
  id: number;
  record_id: string;
  patient: number;
  patient_name: string;
  practitioner?: number | null;
  practitioner_name?: string;
  service_unit?: number | null;
  service_unit_name?: string;
  department?: number | null;
  department_name?: string;
  status: "Admission Scheduled" | "Admitted" | "Discharge Scheduled" | "Discharged" | "Cancelled" | string;
  admission_date: string | null;
  admission_time?: string | null;
  discharge_date: string | null;
  discharge_time?: string | null;
  expected_discharge_date?: string | null;
  chief_complaint?: string;
  discharge_summary?: string;
  notes?: string;
  height?: number | null;
  weight?: number | null;
}

export interface ClinicalProcedure {
  id: number;
  procedure_id: string;
  title: string;
  patient: number;
  patient_name: string;
  practitioner_name: string;
  status: string;
  start_date: string | null;
  notes: string;
}

export interface ClinicalNote {
  id: number;
  encounter: number;
  note_type: string;
  author_name: string;
  note_content: string;
  note_date: string;
}

export interface Observation {
  id: number;
  naming_series: string;
  company: number | null;
  observation_template: number | null;
  observation_template_name: string;
  posting_date: string;
  observation_category: string;
  status: string;
  patient: number;
  patient_name: string;
  encounter: number | null;
  appointment: number | null;
  practitioner: number | null;
  practitioner_name: string;
  medical_department: number | null;
  department_name: string;
  has_component: boolean;
  sample_collection_required: boolean;
  sample: string;
  permitted_data_type: string;
  sample_collection_time: string | null;
  sample_status: string;
  observation_type: string;
  value: string;
  unit: string;
  reference_range: string;
  result: string;
  notes: string;
  description: string;
  created_at: string;
  updated_at: string;
}

/**
 * The Medication master (Marley's `Medication`) — one of the Links on a Drug
 * Prescription row, alongside the stock Item in `drug_code`.
 */
export interface Medication {
  id: number;
  name?: string;
  medication_name?: string;
  generic_name: string;
  abbr: string;
  medication_class: number | null;
  national_drug_code: string;
  is_combination: boolean;
  disabled: boolean;
  strength: string;
  strength_uom: string;
  dosage_form: number | null;
  default_prescription_dosage: string;
  default_prescription_duration: string;
  default_interval: string;
  default_interval_uom: string;
  reference_url: string;
}

export interface MedicationClass {
  id: number;
  medication_class: string;
}

export interface ObservationTemplate {
  id: number;
  observation: string;
  observation_category: string;
  preferred_display_name: string;
  abbr: string;
  has_component: boolean;
  department: number | null;
  description: string;
  permitted_data_type: string;
  permitted_unit: string;
  sample_collection_required: boolean;
  is_active: boolean;
}

export interface ObservationReferenceRange {
  id: number;
  observation_template: number;
  observation_template_name?: string;
  applies_to: string;
  age_from?: number | null;
  age_to?: number | null;
  reference_from?: string;
  reference_to?: string;
  normal_from?: string;
  normal_to?: string;
  abnormal_from?: string;
  abnormal_to?: string;
  short_interpretation?: string;
  long_interpretation?: string;
}

// ── Treatment Plan Template (Marley) ─────────

export interface TreatmentPlanTemplateItem {
  id: number;
  item_type: string;
  item_name: string;
  quantity: number;
  amount: number;
  instructions: string;
  drug_name: string;
  drug_code: string;
  strength: number;
  strength_uom: string;
  dosage_form: string;
  dosage_by_interval: boolean;
  dosage: string;
  interval: number;
  interval_uom: string;
  period: string;
  number_of_repeats_allowed: number;
  service_request: string;
}

export interface TreatmentPlanTemplatePractitioner {
  id: number;
  practitioner: number;
  practitioner_name: string;
  is_primary: boolean;
}

export interface TreatmentPlanTemplate {
  id: number;
  template_name: string;
  description: string;
  goal: string;
  medical_department: number | null;
  medical_department_name: string;
  therapy_type: number | null;
  therapy_type_name: string;
  disabled: boolean;
  is_active: boolean;
  is_inpatient: boolean;
  patient_age_from: number;
  patient_age_to: number;
  gender: string;
  expected_length_of_stay: number;
  treatment_counselling_required: boolean;
  total_sessions: number;
  duration_per_session: number;
  order_group: number | null;
  items: TreatmentPlanTemplateItem[];
  practitioners: TreatmentPlanTemplatePractitioner[];
  complaints: any[];
  diagnosis: any[];
  drugs: any[];
}

export interface ClinicalNoteType {
  id: number;
  clinical_note_type: string;
}

export interface ServiceRequestCategory {
  id: number;
  category: string;
  description?: string;
}

export interface ExternalReferral {
  id: number;
  referral_id: string;
  encounter?: number | null;
  patient: number;
  patient_name?: string;
  patient_age?: string;
  patient_sex?: string;
  patient_mobile?: string;
  referring_practitioner?: number | null;
  referring_practitioner_name?: string;
  referring_department_name?: string;
  referral_date: string;
  priority: "Routine" | "Urgent" | "Emergency";
  target_facility: string;
  receiving_specialist?: string;
  clinical_indication: string;
  provisional_diagnosis?: string;
  treatment_summary?: string;
  relevant_test_results?: string;
  referral_notes?: string;
  status: "Draft" | "Active" | "Dispatched" | "Completed" | "Cancelled";
  is_eeu_guarantee_of_payment?: boolean;
  eeu_gop_authorized_amount_etb?: number;
  eeu_gop_coverage_scope?: string;
  eeu_gop_authorization_code?: string;
  eeu_specialist_hospital_tier?: string;
  creation?: string;
  modified?: string;
}

export interface MedicalLeaveSlip {
  id: number;
  slip_id: string;
  encounter?: number | null;
  patient: number;
  patient_name?: string;
  patient_age?: string;
  patient_sex?: string;
  patient_mobile?: string;
  practitioner?: number | null;
  practitioner_name?: string;
  practitioner_designation?: string;
  practitioner_department?: string;
  issue_date: string;
  diagnosis: string;
  from_date: string;
  to_date: string;
  total_days: number;
  doctor_remarks?: string;
  fitness_state: "Unfit for Work / School" | "Fit for Light Duty Only" | "Fit for Normal Duties";
  fit_to_work_date?: string | null;
  status: "Draft" | "Issued" | "Cancelled";
  eeu_clinic_branch?: string;
  eeu_leave_category?: string;
  eeu_duty_restriction?: string;
  qr_verification_code?: string;
  creation?: string;
  modified?: string;
}

export interface EEUWorkplaceIncident {
  id: number;
  incident_id: string;
  patient: number;
  patient_name?: string;
  patient_code?: string;
  staff_id?: string;
  cadre?: string;
  department?: string;
  patient_phone?: string;
  incident_datetime: string;
  voltage_level: string;
  incident_type: string;
  work_location: string;
  region: string;
  severity: string;
  ppe_compliance: string;
  clinical_findings: string;
  immediate_treatment_given: string;
  duty_recommendation: string;
  reported_by: string;
  supervisor_notified: boolean;
  status: string;
  clinical_encounter?: number | null;
  clinical_encounter_display?: string;
  sick_leave_slip?: number | null;
  sick_leave_slip_code?: string;
  sick_leave_total_days?: number;
  lost_work_days?: number;
  created_at?: string;
  updated_at?: string;
}

export interface EEUFitnessEvaluation {
  id: number;
  evaluation_id: string;
  patient: number;
  patient_name?: string;
  patient_code?: string;
  staff_id?: string;
  cadre?: string;
  department?: string;
  practitioner?: number | null;
  practitioner_name?: string;
  evaluation_date: string;
  evaluation_type: string;
  climbing_fitness: string;
  color_vision: string;
  audiometry_hearing: string;
  cardiovascular_status: string;
  vertigo_vestibular_check: string;
  physician_remarks: string;
  valid_until?: string;
  status: string;
  created_at?: string;
  updated_at?: string;
}

export interface EEUFirstAidKit {
  id: number;
  kit_code: string;
  kit_type: string;
  assigned_unit: string;
  region: string;
  custodian_name: string;
  last_inspected: string;
  next_inspection_due?: string | null;
  status: string;
  burn_dressings_stocked: boolean;
  trauma_bandages_stocked: boolean;
  splints_tourniquet_stocked: boolean;
  eye_wash_stocked: boolean;
  notes: string;
  restock_requisition_status?: string;
  restock_notes?: string;
  restock_requested_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface EEUEmergencySOS {
  id: number;
  sos_id: string;
  substation_name: string;
  region: string;
  voltage_level: string;
  hazard_type: string;
  casualty_count: number;
  severity_level: string;
  caller_name: string;
  caller_phone: string;
  destination_clinic: string;
  eta_minutes: number;
  pre_arrival_prep_notes: string;
  status: "Active / En Route" | "Arrived at Clinic" | "Treated & Admitted" | "Transferred to ALERT Hospital" | "Resolved / Stand Down" | string;
  created_at?: string;
  updated_at?: string;
}

export interface EEUPMECampaign {
  id: number;
  campaign_id: string;
  campaign_name: string;
  target_year: number;
  target_directorate: string;
  target_region: string;
  substation_focus?: string;
  start_date: string;
  end_date?: string | null;
  target_count: number;
  completed_count: number;
  fit_certified_count: number;
  completion_rate_pct?: number;
  status: string;
  notes?: string;
  created_at?: string;
}

export interface EEUToxicSurveillance {
  id: number;
  surveillance_id: string;
  patient: number;
  patient_name?: string;
  patient_code?: string;
  staff_id?: string;
  cadre?: string;
  department?: string;
  examination_date: string;
  work_location: string;
  chemical_agent: string;
  exposure_route: string;
  exposure_severity: string;
  spirometry_fev1_actual?: number | null;
  spirometry_fev1_predicted_pct?: number | null;
  dermatological_findings?: string;
  clinical_management?: string;
  duty_recommendation: string;
  created_at?: string;
}


// ── API Methods ─────────────────────────────

export const HealthcareApi = {
  // Companies — the Link target of the encounter's Company field. Lives in the
  // setup app, hence the different URL prefix.
  companies: {
    list: (params?: Record<string, any>) =>
      apiClient.get<{ results: Company[]; count: number }>({
        url: "/setup/companies/", params,
      }),
    get: (id: number) =>
      apiClient.get<Company>({ url: `/setup/companies/${id}/` }),
  },

  // Departments
  departments: {
    list: (params?: Record<string, any>) =>
      apiClient.get<{ results: MedicalDepartment[]; count: number }>({
        url: "/healthcare/departments/", params,
      }),
    get: (id: number) =>
      apiClient.get<MedicalDepartment>({ url: `/healthcare/departments/${id}/` }),
    create: (data: Partial<MedicalDepartment>) =>
      apiClient.post<MedicalDepartment>({ url: "/healthcare/departments/", data }),
    update: (id: number, data: Partial<MedicalDepartment>) =>
      apiClient.put<MedicalDepartment>({ url: `/healthcare/departments/${id}/`, data }),
    delete: (id: number) =>
      apiClient.delete({ url: `/healthcare/departments/${id}/` }),
  },

  // Service Units
  serviceUnits: {
    list: (params?: Record<string, any>) =>
      apiClient.get<{ results: HealthcareServiceUnit[]; count: number }>({
        url: "/healthcare/service-units/", params,
      }),
    get: (id: number) =>
      apiClient.get<HealthcareServiceUnit>({ url: `/healthcare/service-units/${id}/` }),
    create: (data: Partial<HealthcareServiceUnit>) =>
      apiClient.post({ url: "/healthcare/service-units/", data }),
    update: (id: number, data: Partial<HealthcareServiceUnit>) =>
      apiClient.put({ url: `/healthcare/service-units/${id}/`, data }),
    delete: (id: number) =>
      apiClient.delete({ url: `/healthcare/service-units/${id}/` }),
  },

  // Patients
  patients: {
    list: (params?: Record<string, any>) =>
      apiClient.get<{ results: Patient[]; count: number }>({
        url: "/healthcare/patients/", params,
      }),
    get: (id: number) =>
      apiClient.get<Patient>({ url: `/healthcare/patients/${id}/` }),
    create: (data: Partial<Patient>) =>
      apiClient.post<Patient>({ url: "/healthcare/patients/", data }),
    update: (id: number, data: Partial<Patient>) =>
      apiClient.patch<Patient>({ url: `/healthcare/patients/${id}/`, data }),
    patch: (id: number, data: Partial<Patient>) =>
      apiClient.patch<Patient>({ url: `/healthcare/patients/${id}/`, data }),
    delete: (id: number) =>
      apiClient.delete({ url: `/healthcare/patients/${id}/` }),
    summary: () =>
      apiClient.get<Patient[]>({ url: "/healthcare/patients/summary/" }),
    timeline: (id: number) =>
      apiClient.get({ url: `/healthcare/patients/${id}/timeline/` }),
    dashboard: (id: number) =>
      apiClient.get({ url: `/healthcare/patients/${id}/dashboard/` }),
    invoiceRegistration: (id: number) =>
      apiClient.post<{ message: string; patient_status: string; patient_id: string }>({
        url: `/healthcare/patients/${id}/invoice_registration/`,
      }),
  },

  // Patient Relations
  patientRelations: {
    list: (params?: Record<string, any>) =>
      apiClient.get<{ results: PatientRelation[]; count: number }>({
        url: "/healthcare/patient-relations/",
        params,
      }),
    get: (id: number) =>
      apiClient.get<PatientRelation>({
        url: `/healthcare/patient-relations/${id}/`,
      }),
    create: (data: Partial<PatientRelation>) =>
      apiClient.post<PatientRelation>({
        url: "/healthcare/patient-relations/",
        data,
      }),
    update: (id: number, data: Partial<PatientRelation>) =>
      apiClient.put<PatientRelation>({
        url: `/healthcare/patient-relations/${id}/`,
        data,
      }),
    delete: (id: number) =>
      apiClient.delete({
        url: `/healthcare/patient-relations/${id}/`,
      }),
  },

  // Practitioners
  practitioners: {
    list: (params?: Record<string, any>) =>
      apiClient.get<{ results: HealthcarePractitioner[]; count: number }>({
        url: "/healthcare/practitioners/", params,
      }),
    get: (id: number) =>
      apiClient.get<HealthcarePractitioner>({ url: `/healthcare/practitioners/${id}/` }),
    create: (data: Partial<HealthcarePractitioner>) =>
      apiClient.post({ url: "/healthcare/practitioners/", data }),
    update: (id: number, data: Partial<HealthcarePractitioner>) =>
      apiClient.put({ url: `/healthcare/practitioners/${id}/`, data }),
    delete: (id: number) =>
      apiClient.delete({ url: `/healthcare/practitioners/${id}/` }),
    summary: () =>
      apiClient.get<HealthcarePractitioner[]>({ url: "/healthcare/practitioners/summary/" }),
    schedule: (id: number) =>
      apiClient.get({ url: `/healthcare/practitioners/${id}/schedule/` }),
  },

  // Practitioner Schedules
  practitionerSchedules: {
    list: (params?: Record<string, any>) =>
      apiClient.get<{ results: PractitionerSchedule[]; count: number }>({
        url: "/healthcare/practitioner-schedules/", params,
      }),
    create: (data: Partial<PractitionerSchedule>) =>
      apiClient.post({ url: "/healthcare/practitioner-schedules/", data }),
    update: (id: number, data: Partial<PractitionerSchedule>) =>
      apiClient.put({ url: `/healthcare/practitioner-schedules/${id}/`, data }),
    delete: (id: number) =>
      apiClient.delete({ url: `/healthcare/practitioner-schedules/${id}/` }),
  },

  // Appointments
  appointmentTypes: {
    list: (params?: Record<string, any>) =>
      apiClient.get<{ results: AppointmentTypeConfig[]; count: number }>({
        url: "/healthcare/appointment-types/", params,
      }),
    create: (data: Partial<AppointmentTypeConfig>) =>
      apiClient.post({ url: "/healthcare/appointment-types/", data }),
    update: (id: number, data: Partial<AppointmentTypeConfig>) =>
      apiClient.put({ url: `/healthcare/appointment-types/${id}/`, data }),
    delete: (id: number) =>
      apiClient.delete({ url: `/healthcare/appointment-types/${id}/` }),
  },
  appointments: {
    list: (params?: Record<string, any>) =>
      apiClient.get<{ results: PatientAppointment[]; count: number }>({
        url: "/healthcare/appointments/", params,
      }),
    get: (id: number) =>
      apiClient.get<PatientAppointment>({ url: `/healthcare/appointments/${id}/` }),
    create: (data: Partial<PatientAppointment>) =>
      apiClient.post({ url: "/healthcare/appointments/", data }),
    update: (id: number, data: Partial<PatientAppointment>) =>
      apiClient.put({ url: `/healthcare/appointments/${id}/`, data }),
    delete: (id: number) =>
      apiClient.delete({ url: `/healthcare/appointments/${id}/` }),
    today: () =>
      apiClient.get<PatientAppointment[]>({ url: "/healthcare/appointments/today/" }),
    confirm: (id: number) =>
      apiClient.post({ url: `/healthcare/appointments/${id}/confirm/` }),
    open: (id: number) =>
      apiClient.post({ url: `/healthcare/appointments/${id}/open/` }),
    checkIn: (id: number) =>
      apiClient.post({ url: `/healthcare/appointments/${id}/check_in/` }),
    checkOut: (id: number) =>
      apiClient.post({ url: `/healthcare/appointments/${id}/check_out/` }),
    cancel: (id: number) =>
      apiClient.post({ url: `/healthcare/appointments/${id}/cancel/` }),
    noShow: (id: number) =>
      apiClient.post({ url: `/healthcare/appointments/${id}/no_show/` }),
    close: (id: number) =>
      apiClient.post({ url: `/healthcare/appointments/${id}/close/` }),
    availability: (practitioner: number, date: string) =>
      apiClient.get({ url: "/healthcare/appointments/availability/", params: { practitioner, date } }),
  },

  // Vital Signs
  vitalSigns: {
    list: (params?: Record<string, any>) =>
      apiClient.get<{ results: VitalSigns[]; count: number }>({
        url: "/healthcare/vital-signs/", params,
      }),
    get: (id: number) =>
      apiClient.get<VitalSigns>({ url: `/healthcare/vital-signs/${id}/` }),
    create: (data: Partial<VitalSigns>) =>
      apiClient.post({ url: "/healthcare/vital-signs/", data }),
    update: (id: number, data: Partial<VitalSigns>) =>
      apiClient.put({ url: `/healthcare/vital-signs/${id}/`, data }),
    delete: (id: number) =>
      apiClient.delete({ url: `/healthcare/vital-signs/${id}/` }),
  },

  // Encounters
  encounters: {
    list: (params?: Record<string, any>) =>
      apiClient.get<{ results: PatientEncounter[]; count: number }>({
        url: "/healthcare/encounters/", params,
      }),
    get: (id: number) =>
      apiClient.get<PatientEncounter>({ url: `/healthcare/encounters/${id}/` }),
    create: (data: Partial<PatientEncounter>) =>
      apiClient.post({ url: "/healthcare/encounters/", data }),
    update: (id: number, data: Partial<PatientEncounter>) =>
      apiClient.put({ url: `/healthcare/encounters/${id}/`, data }),
    delete: (id: number) =>
      apiClient.delete({ url: `/healthcare/encounters/${id}/` }),
    submit: (id: number) =>
      apiClient.post({ url: `/healthcare/encounters/${id}/submit/` }),
    complete: (id: number) =>
      apiClient.post({ url: `/healthcare/encounters/${id}/complete/` }),
    /** The form's field definitions — labels, required flags, Select options.
     *  Frappe serves this from the doctype meta; we serve it from the same
     *  transcription of Marley's JSON, so the form never hardcodes a picker. */
    meta: () =>
      apiClient.get<EncounterFormMeta>({ url: "/healthcare/encounters/meta/" }),
  },

  // Encounter child rows — Marley's "Patient Encounter Symptom" / "... Diagnosis"
  // tables. Rows are created against a saved encounter, so a new encounter is
  // saved first and these follow.
  encounterDiagnoses: {
    list: (params?: Record<string, any>) =>
      apiClient.get<{ results: Diagnosis[]; count: number }>({
        url: "/healthcare/diagnoses/", params,
      }),
    create: (data: Partial<Diagnosis>) =>
      apiClient.post({ url: "/healthcare/diagnoses/", data }),
    update: (id: number, data: Partial<Diagnosis>) =>
      apiClient.patch({ url: `/healthcare/diagnoses/${id}/`, data }),
    delete: (id: number) =>
      apiClient.delete({ url: `/healthcare/diagnoses/${id}/` }),
  },

  encounterSymptoms: {
    list: (params?: Record<string, any>) =>
      apiClient.get<{ results: Symptom[]; count: number }>({
        url: "/healthcare/symptoms/", params,
      }),
    create: (data: Partial<Symptom>) =>
      apiClient.post({ url: "/healthcare/symptoms/", data }),
    update: (id: number, data: Partial<Symptom>) =>
      apiClient.patch({ url: `/healthcare/symptoms/${id}/`, data }),
    delete: (id: number) =>
      apiClient.delete({ url: `/healthcare/symptoms/${id}/` }),
  },

  // Prescriptions
  prescriptions: {
    list: (params?: Record<string, any>) =>
      apiClient.get<{ results: DrugPrescription[]; count: number }>({
        url: "/healthcare/prescriptions/", params,
      }),
    create: (data: Partial<DrugPrescription>) =>
      apiClient.post({ url: "/healthcare/prescriptions/", data }),
    update: (id: number, data: Partial<DrugPrescription>) =>
      apiClient.patch({ url: `/healthcare/prescriptions/${id}/`, data }),
    delete: (id: number) =>
      apiClient.delete({ url: `/healthcare/prescriptions/${id}/` }),
  },

  // Lab Tests
  labTests: {
    list: (params?: Record<string, any>) =>
      apiClient.get<{ results: LabTest[]; count: number }>({
        url: "/healthcare/lab-tests/", params,
      }),
    get: (id: number) =>
      apiClient.get<LabTest>({ url: `/healthcare/lab-tests/${id}/` }),
    create: (data: Partial<LabTest>) =>
      apiClient.post({ url: "/healthcare/lab-tests/", data }),
    update: (id: number, data: Partial<LabTest>) =>
      apiClient.put({ url: `/healthcare/lab-tests/${id}/`, data }),
    delete: (id: number) =>
      apiClient.delete({ url: `/healthcare/lab-tests/${id}/` }),
    // Marley's whitelisted `update_status` (approve) plus this app's automation.
    approve: (id: number) =>
      apiClient.post({ url: `/healthcare/lab-tests/${id}/approve/` }),
    // Marley's whitelisted `update_status` (reject).
    reject: (id: number) =>
      apiClient.post({ url: `/healthcare/lab-tests/${id}/reject/` }),
    // Marley's `on_submit` / `on_cancel`, carried by actions on this stack.
    submit: (id: number) =>
      apiClient.post<LabTest>({ url: `/healthcare/lab-tests/${id}/submit/` }),
    cancel: (id: number) =>
      apiClient.post<LabTest>({ url: `/healthcare/lab-tests/${id}/cancel/` }),
    // Clinical Specimen Workflow Actions
    collectSample: (id: number, data: { collected_by?: string; collection_datetime?: string; collection_site?: string; barcode?: string }) =>
      apiClient.post<LabTest>({ url: `/healthcare/lab-tests/${id}/collect_sample/`, data }),
    receiveSpecimen: (id: number, data?: { condition?: string; temperature?: string }) =>
      apiClient.post<LabTest>({ url: `/healthcare/lab-tests/${id}/receive_specimen/`, data }),
    rejectSpecimen: (id: number, data: { rejection_reason: string; condition?: string }) =>
      apiClient.post<LabTest>({ url: `/healthcare/lab-tests/${id}/reject_specimen/`, data }),
    // Marley's list-view menu action "Create Multiple".
    createMultiple: (data: { patient: number; doctype: string; docname: number | string }) =>
      apiClient.post<{ created: string[] }>({
        url: "/healthcare/lab-tests/create_multiple/", data,
      }),
  },

  // Lab Test child rows — Marley's child doctypes, each written through its
  // own endpoint so a save can tell an insert from an update or a delete.
  normalTestResults: {
    list: (params?: Record<string, any>) =>
      apiClient.get<{ results: NormalTestResultRow[]; count: number }>({
        url: "/healthcare/normal-test-results/", params,
      }),
    create: (data: Partial<NormalTestResultRow>) =>
      apiClient.post({ url: "/healthcare/normal-test-results/", data }),
    update: (id: number, data: Partial<NormalTestResultRow>) =>
      apiClient.put({ url: `/healthcare/normal-test-results/${id}/`, data }),
    delete: (id: number) =>
      apiClient.delete({ url: `/healthcare/normal-test-results/${id}/` }),
  },
  descriptiveTestResults: {
    list: (params?: Record<string, any>) =>
      apiClient.get<{ results: DescriptiveTestResultRow[]; count: number }>({
        url: "/healthcare/descriptive-test-results/", params,
      }),
    create: (data: Partial<DescriptiveTestResultRow>) =>
      apiClient.post({ url: "/healthcare/descriptive-test-results/", data }),
    update: (id: number, data: Partial<DescriptiveTestResultRow>) =>
      apiClient.put({ url: `/healthcare/descriptive-test-results/${id}/`, data }),
    delete: (id: number) =>
      apiClient.delete({ url: `/healthcare/descriptive-test-results/${id}/` }),
  },
  sensitivityTestResults: {
    list: (params?: Record<string, any>) =>
      apiClient.get<{ results: SensitivityTestResultRow[]; count: number }>({
        url: "/healthcare/sensitivity-test-results/", params,
      }),
    create: (data: Partial<SensitivityTestResultRow>) =>
      apiClient.post({ url: "/healthcare/sensitivity-test-results/", data }),
    update: (id: number, data: Partial<SensitivityTestResultRow>) =>
      apiClient.put({ url: `/healthcare/sensitivity-test-results/${id}/`, data }),
    delete: (id: number) =>
      apiClient.delete({ url: `/healthcare/sensitivity-test-results/${id}/` }),
  },
  organismTestResults: {
    list: (params?: Record<string, any>) =>
      apiClient.get<{ results: OrganismTestResultRow[]; count: number }>({
        url: "/healthcare/organism-test-results/", params,
      }),
    create: (data: Partial<OrganismTestResultRow>) =>
      apiClient.post({ url: "/healthcare/organism-test-results/", data }),
    update: (id: number, data: Partial<OrganismTestResultRow>) =>
      apiClient.put({ url: `/healthcare/organism-test-results/${id}/`, data }),
    delete: (id: number) =>
      apiClient.delete({ url: `/healthcare/organism-test-results/${id}/` }),
  },

  healthcareSettings: {
    list: (params?: Record<string, any>) =>
      apiClient.get<{ results: HealthcareSettingsInfo[]; count: number }>({
        url: "/healthcare/healthcare-settings/", params,
      }),
    create: (data: Record<string, any>) =>
      apiClient.post<HealthcareSettingsInfo>({
        url: "/healthcare/healthcare-settings/", data,
      }),
    update: (id: number, data: Record<string, any>) =>
      apiClient.put<HealthcareSettingsInfo>({
        url: `/healthcare/healthcare-settings/${id}/`, data,
      }),
  },
  antibiotics: {
    list: (params?: Record<string, any>) =>
      apiClient.get<{ results: Antibiotic[]; count: number }>({
        url: "/healthcare/antibiotics/", params,
      }),
    create: (data: Partial<Antibiotic>) =>
      apiClient.post<Antibiotic>({ url: "/healthcare/antibiotics/", data }),
    update: (id: number, data: Partial<Antibiotic>) =>
      apiClient.put<Antibiotic>({ url: `/healthcare/antibiotics/${id}/`, data }),
    delete: (id: number) =>
      apiClient.delete({ url: `/healthcare/antibiotics/${id}/` }),
  },
  sensitivities: {
    list: (params?: Record<string, any>) =>
      apiClient.get<{ results: Sensitivity[]; count: number }>({
        url: "/healthcare/sensitivities/", params,
      }),
    create: (data: Partial<Sensitivity>) =>
      apiClient.post<Sensitivity>({ url: "/healthcare/sensitivities/", data }),
    update: (id: number, data: Partial<Sensitivity>) =>
      apiClient.put<Sensitivity>({ url: `/healthcare/sensitivities/${id}/`, data }),
    delete: (id: number) =>
      apiClient.delete({ url: `/healthcare/sensitivities/${id}/` }),
  },
  organisms: {
    list: (params?: Record<string, any>) =>
      apiClient.get<{ results: Organism[]; count: number }>({
        url: "/healthcare/organisms/", params,
      }),
    create: (data: Partial<Organism>) =>
      apiClient.post<Organism>({ url: "/healthcare/organisms/", data }),
    update: (id: number, data: Partial<Organism>) =>
      apiClient.put<Organism>({ url: `/healthcare/organisms/${id}/`, data }),
    delete: (id: number) =>
      apiClient.delete({ url: `/healthcare/organisms/${id}/` }),
  },

  labTestTemplates: {
    list: (params?: Record<string, any>) =>
      apiClient.get<{ results: LabTestTemplate[]; count: number }>({
        url: "/healthcare/lab-test-templates/", params,
      }),
    get: (id: number) =>
      apiClient.get<LabTestTemplate>({ url: `/healthcare/lab-test-templates/${id}/` }),
    create: (data: Partial<LabTestTemplate>) =>
      apiClient.post<LabTestTemplate>({ url: "/healthcare/lab-test-templates/", data }),
    update: (id: number, data: Partial<LabTestTemplate>) =>
      apiClient.put<LabTestTemplate>({ url: `/healthcare/lab-test-templates/${id}/`, data }),
    delete: (id: number) =>
      apiClient.delete({ url: `/healthcare/lab-test-templates/${id}/` }),
    // The form's field definitions, the way Frappe serves a doctype's meta.
    meta: () =>
      apiClient.get<LabTestTemplateFormMeta>({ url: "/healthcare/lab-test-templates/meta/" }),
    // Marley's "Change Template Code" — renames the template and its Item.
    changeTemplateCode: (id: number, lab_test_code: string) =>
      apiClient.post<LabTestTemplate>({
        url: `/healthcare/lab-test-templates/${id}/change-template-code/`,
        data: { lab_test_code },
      }),
  },

  // Lab Test Template child rows — Marley's "Normal Test Template",
  // "Descriptive Test Template" and "Lab Test Group Template" tables. Rows are
  // created against a saved template, so a new template is saved first and
  // these follow.
  normalTestTemplates: {
    list: (params?: Record<string, any>) =>
      apiClient.get<{ results: NormalTestTemplateRow[]; count: number }>({
        url: "/healthcare/normal-test-templates/", params,
      }),
    create: (data: Partial<NormalTestTemplateRow>) =>
      apiClient.post<NormalTestTemplateRow>({ url: "/healthcare/normal-test-templates/", data }),
    update: (id: number, data: Partial<NormalTestTemplateRow>) =>
      apiClient.put<NormalTestTemplateRow>({ url: `/healthcare/normal-test-templates/${id}/`, data }),
    delete: (id: number) =>
      apiClient.delete({ url: `/healthcare/normal-test-templates/${id}/` }),
  },

  descriptiveTestTemplates: {
    list: (params?: Record<string, any>) =>
      apiClient.get<{ results: DescriptiveTestTemplateRow[]; count: number }>({
        url: "/healthcare/descriptive-test-templates/", params,
      }),
    create: (data: Partial<DescriptiveTestTemplateRow>) =>
      apiClient.post<DescriptiveTestTemplateRow>({
        url: "/healthcare/descriptive-test-templates/", data,
      }),
    update: (id: number, data: Partial<DescriptiveTestTemplateRow>) =>
      apiClient.put<DescriptiveTestTemplateRow>({
        url: `/healthcare/descriptive-test-templates/${id}/`, data,
      }),
    delete: (id: number) =>
      apiClient.delete({ url: `/healthcare/descriptive-test-templates/${id}/` }),
  },

  labTestGroups: {
    list: (params?: Record<string, any>) =>
      apiClient.get<{ results: LabTestGroupTemplateRow[]; count: number }>({
        url: "/healthcare/lab-test-groups/", params,
      }),
    create: (data: Partial<LabTestGroupTemplateRow>) =>
      apiClient.post<LabTestGroupTemplateRow>({ url: "/healthcare/lab-test-groups/", data }),
    update: (id: number, data: Partial<LabTestGroupTemplateRow>) =>
      apiClient.put<LabTestGroupTemplateRow>({ url: `/healthcare/lab-test-groups/${id}/`, data }),
    delete: (id: number) =>
      apiClient.delete({ url: `/healthcare/lab-test-groups/${id}/` }),
  },

  labTestSamples: {
    list: (params?: Record<string, any>) =>
      apiClient.get<{ results: LabTestSample[]; count: number }>({
        url: "/healthcare/lab-test-samples/", params,
      }),
    get: (id: number) =>
      apiClient.get<LabTestSample>({ url: `/healthcare/lab-test-samples/${id}/` }),
    create: (data: Partial<LabTestSample>) =>
      apiClient.post<LabTestSample>({ url: "/healthcare/lab-test-samples/", data }),
    update: (id: number, data: Partial<LabTestSample>) =>
      apiClient.put<LabTestSample>({ url: `/healthcare/lab-test-samples/${id}/`, data }),
    delete: (id: number) =>
      apiClient.delete({ url: `/healthcare/lab-test-samples/${id}/` }),
  },

  samples: {
    list: (params?: Record<string, any>) =>
      apiClient.get<{ results: LabTestSample[]; count: number }>({
        url: "/healthcare/lab-test-samples/", params,
      }),
    get: (id: number) =>
      apiClient.get<LabTestSample>({ url: `/healthcare/lab-test-samples/${id}/` }),
    create: (data: Partial<LabTestSample>) =>
      apiClient.post<LabTestSample>({ url: "/healthcare/lab-test-samples/", data }),
    update: (id: number, data: Partial<LabTestSample>) =>
      apiClient.put<LabTestSample>({ url: `/healthcare/lab-test-samples/${id}/`, data }),
    delete: (id: number) =>
      apiClient.delete({ url: `/healthcare/lab-test-samples/${id}/` }),
  },

  labTestUOMs: {
    list: (params?: Record<string, any>) =>
      apiClient.get<{ results: LabTestUOM[]; count: number }>({
        url: "/healthcare/lab-test-uoms/", params,
      }),
    get: (id: number) =>
      apiClient.get<LabTestUOM>({ url: `/healthcare/lab-test-uoms/${id}/` }),
    create: (data: Partial<LabTestUOM>) =>
      apiClient.post({ url: "/healthcare/lab-test-uoms/", data }),
    update: (id: number, data: Partial<LabTestUOM>) =>
      apiClient.put({ url: `/healthcare/lab-test-uoms/${id}/`, data }),
    delete: (id: number) =>
      apiClient.delete({ url: `/healthcare/lab-test-uoms/${id}/` }),
  },

  uoms: {
    list: (params?: Record<string, any>) =>
      apiClient.get<{ results: LabTestUOM[]; count: number }>({
        url: "/healthcare/lab-test-uoms/", params,
      }),
    get: (id: number) =>
      apiClient.get<LabTestUOM>({ url: `/healthcare/lab-test-uoms/${id}/` }),
    create: (data: Partial<LabTestUOM>) =>
      apiClient.post({ url: "/healthcare/lab-test-uoms/", data }),
    update: (id: number, data: Partial<LabTestUOM>) =>
      apiClient.put({ url: `/healthcare/lab-test-uoms/${id}/`, data }),
    delete: (id: number) =>
      apiClient.delete({ url: `/healthcare/lab-test-uoms/${id}/` }),
  },

  sampleCollections: {
    list: (params?: Record<string, any>) =>
      apiClient.get<{ results: SampleCollection[]; count: number }>({
        url: "/healthcare/sample-collections/", params,
      }),
    get: (id: number | string) => {
      const cleanId = String(id).trim();
      if (!cleanId || cleanId === "NaN" || cleanId === "undefined" || cleanId === "null") {
        throw new Error("Invalid sample collection ID: cannot fetch without a valid ID");
      }
      return apiClient.get<SampleCollection>({ url: `/healthcare/sample-collections/${cleanId}/` });
    },
    create: (data: Partial<SampleCollection>) =>
      apiClient.post({ url: "/healthcare/sample-collections/", data }),
    update: (id: number | string, data: Partial<SampleCollection>) => {
      const cleanId = String(id).trim();
      if (!cleanId || cleanId === "NaN" || cleanId === "undefined" || cleanId === "null") {
        throw new Error("Invalid sample collection ID: cannot update without a valid ID");
      }
      return apiClient.put({ url: `/healthcare/sample-collections/${cleanId}/`, data });
    },
    delete: (id: number | string) => {
      const cleanId = String(id).trim();
      if (!cleanId || cleanId === "NaN" || cleanId === "undefined" || cleanId === "null") {
        throw new Error("Invalid sample collection ID: cannot delete without a valid ID");
      }
      return apiClient.delete({ url: `/healthcare/sample-collections/${cleanId}/` });
    },
  },

  // Clinical Procedures
  procedures: {
    list: (params?: Record<string, any>) =>
      apiClient.get<{ results: ClinicalProcedure[]; count: number }>({
        url: "/healthcare/procedures/", params,
      }),
    create: (data: Partial<ClinicalProcedure>) =>
      apiClient.post({ url: "/healthcare/procedures/", data }),
    update: (id: number, data: Partial<ClinicalProcedure>) =>
      apiClient.put({ url: `/healthcare/procedures/${id}/`, data }),
    delete: (id: number) =>
      apiClient.delete({ url: `/healthcare/procedures/${id}/` }),
  },

  // Therapy
  therapyTypes: {
    list: (params?: Record<string, any>) =>
      apiClient.get<{ results: TherapyType[] }>({ url: "/healthcare/therapy-types/", params }),
    create: (data: Partial<TherapyType>) =>
      apiClient.post<TherapyType>({ url: "/healthcare/therapy-types/", data }),
  },
  therapyPlans: {
    list: (params?: Record<string, any>) =>
      apiClient.get<{ results: TherapyPlan[]; count: number }>({
        url: "/healthcare/therapy-plans/", params,
      }),
    get: (id: number) =>
      apiClient.get<TherapyPlan>({ url: `/healthcare/therapy-plans/${id}/` }),
    create: (data: Partial<TherapyPlan>) =>
      apiClient.post({ url: "/healthcare/therapy-plans/", data }),
    update: (id: number, data: Partial<TherapyPlan>) =>
      apiClient.put({ url: `/healthcare/therapy-plans/${id}/`, data }),
    delete: (id: number) =>
      apiClient.delete({ url: `/healthcare/therapy-plans/${id}/` }),
    bookSession: (id: number, data?: any) =>
      apiClient.post({ url: `/healthcare/therapy-plans/${id}/book_session/`, data }),
  },
  therapySessions: {
    list: (params?: Record<string, any>) =>
      apiClient.get<{ results: TherapySession[]; count: number }>({
        url: "/healthcare/therapy-sessions/", params,
      }),
    get: (id: number) =>
      apiClient.get<TherapySession>({ url: `/healthcare/therapy-sessions/${id}/` }),
    create: (data: Partial<TherapySession>) =>
      apiClient.post({ url: "/healthcare/therapy-sessions/", data }),
    update: (id: number, data: Partial<TherapySession>) =>
      apiClient.put({ url: `/healthcare/therapy-sessions/${id}/`, data }),
    delete: (id: number) =>
      apiClient.delete({ url: `/healthcare/therapy-sessions/${id}/` }),
    complete: (id: number, data?: any) =>
      apiClient.post({ url: `/healthcare/therapy-sessions/${id}/complete/`, data }),
  },
  exercises: {
    list: (params?: Record<string, any>) =>
      apiClient.get<{ results: Exercise[]; count: number }>({
        url: "/healthcare/exercises/", params,
      }),
    create: (data: Partial<Exercise>) =>
      apiClient.post({ url: "/healthcare/exercises/", data }),
    update: (id: number, data: Partial<Exercise>) =>
      apiClient.put({ url: `/healthcare/exercises/${id}/`, data }),
    delete: (id: number) =>
      apiClient.delete({ url: `/healthcare/exercises/${id}/` }),
  },

  // Insurance
  insurancePayors: {
    list: () =>
      apiClient.get<{ results: InsurancePayor[] }>({ url: "/healthcare/insurance-payors/" }),
    create: (data: Partial<InsurancePayor>) =>
      apiClient.post({ url: "/healthcare/insurance-payors/", data }),
    update: (id: number, data: Partial<InsurancePayor>) =>
      apiClient.put({ url: `/healthcare/insurance-payors/${id}/`, data }),
    delete: (id: number) =>
      apiClient.delete({ url: `/healthcare/insurance-payors/${id}/` }),
  },
  insuranceClaims: {
    list: (params?: Record<string, any>) =>
      apiClient.get<{ results: InsuranceClaim[]; count: number }>({
        url: "/healthcare/insurance-claims/", params,
      }),
    create: (data: Partial<InsuranceClaim>) =>
      apiClient.post({ url: "/healthcare/insurance-claims/", data }),
    update: (id: number, data: Partial<InsuranceClaim>) =>
      apiClient.put({ url: `/healthcare/insurance-claims/${id}/`, data }),
    delete: (id: number) =>
      apiClient.delete({ url: `/healthcare/insurance-claims/${id}/` }),
  },

  // Inpatient
  inpatientRecords: {
    list: (params?: Record<string, any>) =>
      apiClient.get<{ results: InpatientRecord[]; count: number }>({
        url: "/healthcare/inpatient-records/", params,
      }),
    get: (id: number) =>
      apiClient.get<InpatientRecord>({ url: `/healthcare/inpatient-records/${id}/` }),
    create: (data: Partial<InpatientRecord>) =>
      apiClient.post<InpatientRecord>({ url: "/healthcare/inpatient-records/", data }),
    update: (id: number, data: Partial<InpatientRecord>) =>
      apiClient.put<InpatientRecord>({ url: `/healthcare/inpatient-records/${id}/`, data }),
    delete: (id: number) =>
      apiClient.delete({ url: `/healthcare/inpatient-records/${id}/` }),
    admit: (id: number, data?: any) =>
      apiClient.post<{ status: string; record?: InpatientRecord }>({ url: `/healthcare/inpatient-records/${id}/admit/`, data }),
    scheduleDischarge: (id: number, data?: any) =>
      apiClient.post<{ status: string; record?: InpatientRecord }>({ url: `/healthcare/inpatient-records/${id}/schedule_discharge/`, data }),
    discharge: (id: number, data?: any) =>
      apiClient.post<{ status: string; record?: InpatientRecord }>({ url: `/healthcare/inpatient-records/${id}/discharge/`, data }),
    transfer: (id: number, data: { service_unit: number }) =>
      apiClient.post<{ status: string; record?: InpatientRecord }>({ url: `/healthcare/inpatient-records/${id}/transfer/`, data }),
    cancelAdmission: (id: number) =>
      apiClient.post<{ status: string; record?: InpatientRecord }>({ url: `/healthcare/inpatient-records/${id}/cancel_admission/` }),
  },

  // Observations
  observations: {
    list: (params?: Record<string, any>) =>
      apiClient.get<{ results: Observation[]; count: number }>({
        url: "/healthcare/observations/", params,
      }),
    get: (id: number) =>
      apiClient.get<Observation>({ url: `/healthcare/observations/${id}/` }),
    create: (data: Partial<Observation>) =>
      apiClient.post({ url: "/healthcare/observations/", data }),
    update: (id: number, data: Partial<Observation>) =>
      apiClient.put({ url: `/healthcare/observations/${id}/`, data }),
    delete: (id: number) =>
      apiClient.delete({ url: `/healthcare/observations/${id}/` }),
    approve: (id: number) =>
      apiClient.post({ url: `/healthcare/observations/${id}/approve/` }),
    reject: (id: number, reason?: string) =>
      apiClient.post({ url: `/healthcare/observations/${id}/reject/`, data: { rejection_reason: reason } }),
    setStatus: (id: number, status: string) =>
      apiClient.post({ url: `/healthcare/observations/${id}/set_status/`, data: { status } }),
  },
  observationTemplates: {
    list: (params?: Record<string, any>) =>
      apiClient.get<{ results: ObservationTemplate[]; count: number }>({
        url: "/healthcare/observation-templates/", params,
      }),
    get: (id: number) =>
      apiClient.get<ObservationTemplate>({ url: `/healthcare/observation-templates/${id}/` }),
    create: (data: Partial<ObservationTemplate>) =>
      apiClient.post<ObservationTemplate>({ url: "/healthcare/observation-templates/", data }),
    update: (id: number, data: Partial<ObservationTemplate>) =>
      apiClient.put<ObservationTemplate>({ url: `/healthcare/observation-templates/${id}/`, data }),
    delete: (id: number) =>
      apiClient.delete({ url: `/healthcare/observation-templates/${id}/` }),
  },
  observationReferenceRanges: {
    list: (params?: Record<string, any>) =>
      apiClient.get<{ results: ObservationReferenceRange[]; count: number }>({
        url: "/healthcare/observation-reference-ranges/", params,
      }),
    get: (id: number) =>
      apiClient.get<ObservationReferenceRange>({ url: `/healthcare/observation-reference-ranges/${id}/` }),
    create: (data: Partial<ObservationReferenceRange>) =>
      apiClient.post<ObservationReferenceRange>({ url: "/healthcare/observation-reference-ranges/", data }),
    update: (id: number, data: Partial<ObservationReferenceRange>) =>
      apiClient.put<ObservationReferenceRange>({ url: `/healthcare/observation-reference-ranges/${id}/`, data }),
    delete: (id: number) =>
      apiClient.delete({ url: `/healthcare/observation-reference-ranges/${id}/` }),
  },

  // Clinical Notes
  clinicalNotes: {
    list: (params?: Record<string, any>) =>
      apiClient.get<{ results: ClinicalNote[]; count: number }>({
        url: "/healthcare/clinical-notes/", params,
      }),
    create: (data: Partial<ClinicalNote>) =>
      apiClient.post({ url: "/healthcare/clinical-notes/", data }),
  },

  // ── Document Management (Assign, Attach, Tag, Share) ───────
  docAssignments: {
    list: (params?: Record<string, any>) =>
      apiClient.get<{ results: any[]; count: number }>({ url: "/healthcare/doc-assignments/", params }),
    create: (data: any) => apiClient.post({ url: "/healthcare/doc-assignments/", data }),
    update: (id: number, data: any) => apiClient.put({ url: `/healthcare/doc-assignments/${id}/`, data }),
    patch: (id: number, data: any) => apiClient.patch({ url: `/healthcare/doc-assignments/${id}/`, data }),
    complete: (id: number) => apiClient.post({ url: `/healthcare/doc-assignments/${id}/complete/` }),
    reopen: (id: number) => apiClient.post({ url: `/healthcare/doc-assignments/${id}/reopen/` }),
    delete: (id: number) => apiClient.delete({ url: `/healthcare/doc-assignments/${id}/` }),
  },
  docAttachments: {
    list: (params?: Record<string, any>) =>
      apiClient.get<{ results: any[]; count: number }>({ url: "/healthcare/doc-attachments/", params }),
    create: (data: any) => apiClient.post({ url: "/healthcare/doc-attachments/", data }),
    upload: (formData: FormData) =>
      apiClient.post({
        url: "/healthcare/doc-attachments/",
        data: formData,
        headers: { "Content-Type": "multipart/form-data" },
      }),
    delete: (id: number) => apiClient.delete({ url: `/healthcare/doc-attachments/${id}/` }),
  },
  docTags: {
    list: (params?: Record<string, any>) =>
      apiClient.get<{ results: any[]; count: number }>({ url: "/healthcare/doc-tags/", params }),
    allTags: (params?: { doctype?: string }) =>
      apiClient.get<string[]>({ url: "/healthcare/doc-tags/all_tags/", params }),
    create: (data: any) => apiClient.post({ url: "/healthcare/doc-tags/", data }),
    delete: (id: number) => apiClient.delete({ url: `/healthcare/doc-tags/${id}/` }),
  },
  docShares: {
    list: (params?: Record<string, any>) =>
      apiClient.get<{ results: any[]; count: number }>({ url: "/roles/doc-shares/", params }),
    create: (data: any) => apiClient.post({ url: "/roles/doc-shares/", data }),
    update: (id: number, data: any) => apiClient.patch({ url: `/roles/doc-shares/${id}/`, data }),
    delete: (id: number) => apiClient.delete({ url: `/roles/doc-shares/${id}/` }),
  },
  users: {
    list: (params?: Record<string, any>) =>
      apiClient.get<{ results: any[]; count: number }>({ url: "/auth/users/", params }),
  },

  // ── Clinical Documents (External Referral & Medical Leave Slip) ──
  externalReferrals: {
    list: (params?: Record<string, any>) =>
      apiClient.get<{ results: ExternalReferral[]; count: number }>({
        url: "/healthcare/external-referrals/",
        params,
      }),
    get: (id: number) =>
      apiClient.get<ExternalReferral>({ url: `/healthcare/external-referrals/${id}/` }),
    create: (data: Partial<ExternalReferral>) =>
      apiClient.post<ExternalReferral>({ url: "/healthcare/external-referrals/", data }),
    update: (id: number, data: Partial<ExternalReferral>) =>
      apiClient.put<ExternalReferral>({ url: `/healthcare/external-referrals/${id}/`, data }),
    patch: (id: number, data: Partial<ExternalReferral>) =>
      apiClient.patch<ExternalReferral>({ url: `/healthcare/external-referrals/${id}/`, data }),
    delete: (id: number) =>
      apiClient.delete({ url: `/healthcare/external-referrals/${id}/` }),
    getPrintHtml: (id: number) =>
      apiClient.get<{ html: string; referral_id: string }>({
        url: `/healthcare/external-referrals/${id}/print-html/`,
      }),
    getGopHtml: (id: number) =>
      apiClient.get<{ html: string; referral_id: string; gop_code: string; authorized_amount_etb: string }>({
        url: `/healthcare/external-referrals/${id}/gop-html/`,
      }),
  },
  medicalLeaveSlips: {
    list: (params?: Record<string, any>) =>
      apiClient.get<{ results: MedicalLeaveSlip[]; count: number }>({
        url: "/healthcare/medical-leave-slips/",
        params,
      }),
    get: (id: number) =>
      apiClient.get<MedicalLeaveSlip>({ url: `/healthcare/medical-leave-slips/${id}/` }),
    create: (data: Partial<MedicalLeaveSlip>) =>
      apiClient.post<MedicalLeaveSlip>({ url: "/healthcare/medical-leave-slips/", data }),
    update: (id: number, data: Partial<MedicalLeaveSlip>) =>
      apiClient.put<MedicalLeaveSlip>({ url: `/healthcare/medical-leave-slips/${id}/`, data }),
    patch: (id: number, data: Partial<MedicalLeaveSlip>) =>
      apiClient.patch<MedicalLeaveSlip>({ url: `/healthcare/medical-leave-slips/${id}/`, data }),
    delete: (id: number) =>
      apiClient.delete({ url: `/healthcare/medical-leave-slips/${id}/` }),
    getPrintHtml: (id: number) =>
      apiClient.get<{ html: string; slip_id: string }>({
        url: `/healthcare/medical-leave-slips/${id}/print-html/`,
      }),
  },

  // ── EEU Occupational Health & Safety Endpoints ───────────────
  eeuIncidents: {
    list: (params?: Record<string, any>) =>
      apiClient.get<{ results: EEUWorkplaceIncident[]; count: number }>({
        url: "/healthcare/eeu-incidents/",
        params,
      }),
    stats: () =>
      apiClient.get<{
        total_incidents: number;
        arc_flash_burns: number;
        electrical_shocks: number;
        falls_from_height: number;
        high_voltage_cases: number;
        severe_critical: number;
        active_medical_review: number;
      }>({ url: "/healthcare/eeu-incidents/stats/" }),
    get: (id: number) =>
      apiClient.get<EEUWorkplaceIncident>({ url: `/healthcare/eeu-incidents/${id}/` }),
    create: (data: Partial<EEUWorkplaceIncident>) =>
      apiClient.post<EEUWorkplaceIncident>({ url: "/healthcare/eeu-incidents/", data }),
    update: (id: number, data: Partial<EEUWorkplaceIncident>) =>
      apiClient.put<EEUWorkplaceIncident>({ url: `/healthcare/eeu-incidents/${id}/`, data }),
    patch: (id: number, data: Partial<EEUWorkplaceIncident>) =>
      apiClient.patch<EEUWorkplaceIncident>({ url: `/healthcare/eeu-incidents/${id}/`, data }),
    delete: (id: number) =>
      apiClient.delete({ url: `/healthcare/eeu-incidents/${id}/` }),
    executiveSafetyReport: (params?: { period?: string; region?: string }) =>
      apiClient.get<any>({ url: "/healthcare/eeu-incidents/executive_safety_report/", params }),
    createClinicalEncounter: (id: number, data?: any) =>
      apiClient.post<{ message: string; encounter_id: number; encounter_code: string; incident_id: number }>({
        url: `/healthcare/eeu-incidents/${id}/create_clinical_encounter/`,
        data,
      }),
    issueSickLeave: (id: number, data: { total_days: number; from_date?: string; eeu_duty_restriction?: string; eeu_clinic_branch?: string; doctor_remarks?: string }) =>
      apiClient.post<{ message: string; slip_id: number; slip_code: string; incident_id: number; total_days: number }>({
        url: `/healthcare/eeu-incidents/${id}/issue_sick_leave/`,
        data,
      }),
  },

  eeuFitnessEvaluations: {
    list: (params?: Record<string, any>) =>
      apiClient.get<{ results: EEUFitnessEvaluation[]; count: number }>({
        url: "/healthcare/eeu-fitness-evaluations/",
        params,
      }),
    stats: () =>
      apiClient.get<{
        total_evaluations: number;
        fit_to_climb: number;
        ground_duty_only: number;
        color_vision_deficiency: number;
        hearing_threshold_shifts: number;
        expiring_soon_count: number;
        expired_count: number;
      }>({ url: "/healthcare/eeu-fitness-evaluations/stats/" }),
    expiringClearances: (params?: { days?: number }) =>
      apiClient.get<{
        expiring_soon: EEUFitnessEvaluation[];
        expired: EEUFitnessEvaluation[];
        expiring_soon_count: number;
        expired_count: number;
      }>({ url: "/healthcare/eeu-fitness-evaluations/expiring_clearances/", params }),
    get: (id: number) =>
      apiClient.get<EEUFitnessEvaluation>({ url: `/healthcare/eeu-fitness-evaluations/${id}/` }),
    create: (data: Partial<EEUFitnessEvaluation>) =>
      apiClient.post<EEUFitnessEvaluation>({ url: "/healthcare/eeu-fitness-evaluations/", data }),
    update: (id: number, data: Partial<EEUFitnessEvaluation>) =>
      apiClient.put<EEUFitnessEvaluation>({ url: `/healthcare/eeu-fitness-evaluations/${id}/`, data }),
    patch: (id: number, data: Partial<EEUFitnessEvaluation>) =>
      apiClient.patch<EEUFitnessEvaluation>({ url: `/healthcare/eeu-fitness-evaluations/${id}/`, data }),
    delete: (id: number) =>
      apiClient.delete({ url: `/healthcare/eeu-fitness-evaluations/${id}/` }),
  },

  eeuFirstAidKits: {
    list: (params?: Record<string, any>) =>
      apiClient.get<{ results: EEUFirstAidKit[]; count: number }>({
        url: "/healthcare/eeu-first-aid-kits/",
        params,
      }),
    stats: () =>
      apiClient.get<{
        total_kits: number;
        fully_stocked: number;
        needs_replenishment: number;
        critical_shortage: number;
        requisitions_pending: number;
      }>({ url: "/healthcare/eeu-first-aid-kits/stats/" }),
    get: (id: number) =>
      apiClient.get<EEUFirstAidKit>({ url: `/healthcare/eeu-first-aid-kits/${id}/` }),
    create: (data: Partial<EEUFirstAidKit>) =>
      apiClient.post<EEUFirstAidKit>({ url: "/healthcare/eeu-first-aid-kits/", data }),
    update: (id: number, data: Partial<EEUFirstAidKit>) =>
      apiClient.put<EEUFirstAidKit>({ url: `/healthcare/eeu-first-aid-kits/${id}/`, data }),
    patch: (id: number, data: Partial<EEUFirstAidKit>) =>
      apiClient.patch<EEUFirstAidKit>({ url: `/healthcare/eeu-first-aid-kits/${id}/`, data }),
    delete: (id: number) =>
      apiClient.delete({ url: `/healthcare/eeu-first-aid-kits/${id}/` }),
    requestRestock: (id: number, data: { notes: string }) =>
      apiClient.post<EEUFirstAidKit>({
        url: `/healthcare/eeu-first-aid-kits/${id}/request_restock/`,
        data,
      }),
    markRestocked: (id: number) =>
      apiClient.post<EEUFirstAidKit>({
        url: `/healthcare/eeu-first-aid-kits/${id}/mark_restocked/`,
      }),
  },

  eeuEmergencySOS: {
    list: (params?: Record<string, any>) =>
      apiClient.get<{ results: EEUEmergencySOS[]; count: number }>({
        url: "/healthcare/eeu-emergency-sos/",
        params,
      }),
    stats: () =>
      apiClient.get<{
        total_sos_calls: number;
        active_en_route: number;
        critical_cases: number;
        transferred_to_burn_hospital: number;
        active_alert?: EEUEmergencySOS | null;
      }>({ url: "/healthcare/eeu-emergency-sos/stats/" }),
    get: (id: number) =>
      apiClient.get<EEUEmergencySOS>({ url: `/healthcare/eeu-emergency-sos/${id}/` }),
    create: (data: Partial<EEUEmergencySOS>) =>
      apiClient.post<EEUEmergencySOS>({ url: "/healthcare/eeu-emergency-sos/", data }),
    update: (id: number, data: Partial<EEUEmergencySOS>) =>
      apiClient.put<EEUEmergencySOS>({ url: `/healthcare/eeu-emergency-sos/${id}/`, data }),
    patch: (id: number, data: Partial<EEUEmergencySOS>) =>
      apiClient.patch<EEUEmergencySOS>({ url: `/healthcare/eeu-emergency-sos/${id}/`, data }),
    updateStatus: (id: number, status: string) =>
      apiClient.post<EEUEmergencySOS>({
        url: `/healthcare/eeu-emergency-sos/${id}/update_status/`,
        data: { status },
      }),
    delete: (id: number) =>
      apiClient.delete({ url: `/healthcare/eeu-emergency-sos/${id}/` }),
  },

  eeuPMECampaigns: {
    list: (params?: Record<string, any>) =>
      apiClient.get<{ results: EEUPMECampaign[]; count: number }>({
        url: "/healthcare/eeu-pme-campaigns/",
        params,
      }),
    stats: () =>
      apiClient.get<{
        total_campaigns: number;
        active_campaigns: number;
        total_target_linemen: number;
        total_completed_screenings: number;
        total_fit_certified: number;
        overall_completion_pct: number;
      }>({ url: "/healthcare/eeu-pme-campaigns/stats/" }),
    get: (id: number) =>
      apiClient.get<EEUPMECampaign>({ url: `/healthcare/eeu-pme-campaigns/${id}/` }),
    create: (data: Partial<EEUPMECampaign>) =>
      apiClient.post<EEUPMECampaign>({ url: "/healthcare/eeu-pme-campaigns/", data }),
    update: (id: number, data: Partial<EEUPMECampaign>) =>
      apiClient.put<EEUPMECampaign>({ url: `/healthcare/eeu-pme-campaigns/${id}/`, data }),
    patch: (id: number, data: Partial<EEUPMECampaign>) =>
      apiClient.patch<EEUPMECampaign>({ url: `/healthcare/eeu-pme-campaigns/${id}/`, data }),
    recordScreening: (id: number, is_fit: boolean) =>
      apiClient.post<EEUPMECampaign>({
        url: `/healthcare/eeu-pme-campaigns/${id}/record_screening/`,
        data: { is_fit },
      }),
    delete: (id: number) =>
      apiClient.delete({ url: `/healthcare/eeu-pme-campaigns/${id}/` }),
  },

  eeuToxicSurveillance: {
    list: (params?: Record<string, any>) =>
      apiClient.get<{ results: EEUToxicSurveillance[]; count: number }>({
        url: "/healthcare/eeu-toxic-surveillance/",
        params,
      }),
    stats: () =>
      apiClient.get<{
        total_records: number;
        sf6_gas_exposures: number;
        transformer_oil_pcb_exposures: number;
        battery_lead_acid_exposures: number;
        restricted_duty_count: number;
      }>({ url: "/healthcare/eeu-toxic-surveillance/stats/" }),
    get: (id: number) =>
      apiClient.get<EEUToxicSurveillance>({ url: `/healthcare/eeu-toxic-surveillance/${id}/` }),
    create: (data: Partial<EEUToxicSurveillance>) =>
      apiClient.post<EEUToxicSurveillance>({ url: "/healthcare/eeu-toxic-surveillance/", data }),
    update: (id: number, data: Partial<EEUToxicSurveillance>) =>
      apiClient.put<EEUToxicSurveillance>({ url: `/healthcare/eeu-toxic-surveillance/${id}/`, data }),
    patch: (id: number, data: Partial<EEUToxicSurveillance>) =>
      apiClient.patch<EEUToxicSurveillance>({ url: `/healthcare/eeu-toxic-surveillance/${id}/`, data }),
    delete: (id: number) =>
      apiClient.delete({ url: `/healthcare/eeu-toxic-surveillance/${id}/` }),
  },

  // ── New Endpoints (Marley additions) ────────────────────────

  // Medical Coding — the encounter's `Codification Table` rows.
  codificationTable: {
    list: (params?: Record<string, any>) =>
      apiClient.get<{ results: CodificationRow[]; count: number }>({
        url: "/healthcare/codification-table/", params,
      }),
    create: (data: Partial<CodificationRow>) =>
      apiClient.post<CodificationRow>({ url: "/healthcare/codification-table/", data }),
    update: (id: number, data: Partial<CodificationRow>) =>
      apiClient.patch<CodificationRow>({ url: `/healthcare/codification-table/${id}/`, data }),
    delete: (id: number) =>
      apiClient.delete({ url: `/healthcare/codification-table/${id}/` }),
  },
  // Code systems shown in the Medical Coding picker (SNOMED CT, ICD-10-CM, …).
  codeSystems: {
    list: (params?: Record<string, any>) =>
      apiClient.get<{ results: CodeSystem[]; count: number }>({
        url: "/healthcare/code-systems/", params,
      }),
    create: (data: Partial<CodeSystem>) =>
      apiClient.post<CodeSystem>({ url: "/healthcare/code-systems/", data }),
  },
  // Codes within a system; the Medical Coding Code Value picker is scoped to
  // the row's chosen code system, as Marley's `set_query` does.
  codeValues: {
    list: (params?: Record<string, any>) =>
      apiClient.get<{ results: CodeValue[]; count: number }>({
        url: "/healthcare/code-values/", params,
      }),
    create: (data: Partial<CodeValue>) =>
      apiClient.post<CodeValue>({ url: "/healthcare/code-values/", data }),
  },
  patientCareTypes: {
    list: (params?: Record<string, any>) =>
      apiClient.get<{ results: PatientCareType[]; count: number }>({
        url: "/healthcare/patient-care-types/", params,
      }),
  },
  prescriptionDosages: {
    list: (params?: Record<string, any>) =>
      apiClient.get<{ results: PrescriptionDosage[]; count: number }>({
        url: "/healthcare/prescription-dosages/", params,
      }),
    create: (data: Partial<PrescriptionDosage>) =>
      apiClient.post<PrescriptionDosage>({ url: "/healthcare/prescription-dosages/", data }),
    update: (id: number, data: Partial<PrescriptionDosage>) =>
      apiClient.put<PrescriptionDosage>({ url: `/healthcare/prescription-dosages/${id}/`, data }),
    delete: (id: number) =>
      apiClient.delete({ url: `/healthcare/prescription-dosages/${id}/` }),
  },
  // Investigations rows (Marley `Lab Prescription`).
  labPrescriptions: {
    list: (params?: Record<string, any>) =>
      apiClient.get<{ results: LabPrescription[]; count: number }>({
        url: "/healthcare/lab-prescriptions/", params,
      }),
    create: (data: Partial<LabPrescription>) =>
      apiClient.post<LabPrescription>({ url: "/healthcare/lab-prescriptions/", data }),
    update: (id: number, data: Partial<LabPrescription>) =>
      apiClient.patch<LabPrescription>({ url: `/healthcare/lab-prescriptions/${id}/`, data }),
    delete: (id: number) =>
      apiClient.delete({ url: `/healthcare/lab-prescriptions/${id}/` }),
  },
  // Procedures rows (Marley `Procedure Prescription`).
  procedurePrescriptions: {
    list: (params?: Record<string, any>) =>
      apiClient.get<{ results: ProcedurePrescription[]; count: number }>({
        url: "/healthcare/procedure-prescriptions/", params,
      }),
    create: (data: Partial<ProcedurePrescription>) =>
      apiClient.post<ProcedurePrescription>({
        url: "/healthcare/procedure-prescriptions/", data,
      }),
    update: (id: number, data: Partial<ProcedurePrescription>) =>
      apiClient.patch<ProcedurePrescription>({
        url: `/healthcare/procedure-prescriptions/${id}/`, data,
      }),
    delete: (id: number) =>
      apiClient.delete({ url: `/healthcare/procedure-prescriptions/${id}/` }),
  },
  // Rehabilitation rows (Marley `Therapy Plan Detail`).
  therapyPlanDetails: {
    list: (params?: Record<string, any>) =>
      apiClient.get<{ results: TherapyPlanDetail[]; count: number }>({
        url: "/healthcare/therapy-plan-details/", params,
      }),
    create: (data: Partial<TherapyPlanDetail>) =>
      apiClient.post<TherapyPlanDetail>({
        url: "/healthcare/therapy-plan-details/", data,
      }),
    update: (id: number, data: Partial<TherapyPlanDetail>) =>
      apiClient.patch<TherapyPlanDetail>({
        url: `/healthcare/therapy-plan-details/${id}/`, data,
      }),
    delete: (id: number) =>
      apiClient.delete({ url: `/healthcare/therapy-plan-details/${id}/` }),
  },
  // Stock items — the Drug Code picker in the Medications table.
  stockItems: {
    list: (params?: Record<string, any>) =>
      apiClient.get<{ results: any[]; count: number }>({
        url: "/stock/items/", params,
      }),
    get: (id: number) =>
      apiClient.get<any>({ url: `/stock/items/${id}/` }),
    create: (data: any) =>
      apiClient.post<any>({ url: "/stock/items/", data }),
    update: (id: number, data: any) =>
      apiClient.put<any>({ url: `/stock/items/${id}/`, data }),
    delete: (id: number) =>
      apiClient.delete({ url: `/stock/items/${id}/` }),
  },

  itemGroups: {
    list: (params?: Record<string, any>) =>
      apiClient.get<{ results: any[]; count: number }>({
        url: "/stock/item-groups/", params,
      }),
    create: (data: any) =>
      apiClient.post<any>({ url: "/stock/item-groups/", data }),
  },

  // Role doctype — the Lab Test Template's "Staff Role" Link.
  roles: {
    list: (params?: Record<string, any>) =>
      apiClient.get<{ results: any[]; count: number }>({
        url: "/roles/roles/", params,
      }),
  },

  nursingChecklistTemplates: {
    list: (params?: Record<string, any>) =>
      apiClient.get<{ results: any[]; count: number }>({
        url: "/healthcare/nursing-checklist-templates/", params,
      }),
  },

  // Reference Data
  dosageForms: {
    list: (params?: Record<string, any>) =>
      apiClient.get<{ results: DosageForm[]; count: number }>({
        url: "/healthcare/dosage-forms/", params,
      }),
    create: (data: Partial<DosageForm>) =>
      apiClient.post<DosageForm>({ url: "/healthcare/dosage-forms/", data }),
  },
  // Standard prescription durations ("5 Day(s)") behind the Medications Period field.
  prescriptionDurations: {
    list: (params?: Record<string, any>) =>
      apiClient.get<{ results: PrescriptionDuration[]; count: number }>({
        url: "/healthcare/prescription-durations/", params,
      }),
    create: (data: Partial<PrescriptionDuration>) =>
      apiClient.post<PrescriptionDuration>({
        url: "/healthcare/prescription-durations/", data,
      }),
    update: (id: number, data: Partial<PrescriptionDuration>) =>
      apiClient.put<PrescriptionDuration>({
        url: `/healthcare/prescription-durations/${id}/`, data,
      }),
    delete: (id: number) =>
      apiClient.delete({ url: `/healthcare/prescription-durations/${id}/` }),
  },
  // Clinical procedure templates behind the Procedures table.
  procedureTemplates: {
    list: (params?: Record<string, any>) =>
      apiClient.get<{ results: ClinicalProcedureTemplate[]; count: number }>({
        url: "/healthcare/procedure-templates/", params,
      }),
    create: (data: Partial<ClinicalProcedureTemplate>) =>
      apiClient.post<ClinicalProcedureTemplate>({
        url: "/healthcare/procedure-templates/", data,
      }),
  },
  bodyParts: {
    list: () => apiClient.get({ url: "/healthcare/body-parts/" }),
    create: (data: any) => apiClient.post({ url: "/healthcare/body-parts/", data }),
  },
  sampleTypes: {
    list: () => apiClient.get({ url: "/healthcare/sample-types/" }),
    create: (data: any) => apiClient.post({ url: "/healthcare/sample-types/", data }),
  },
  complaints: {
    list: (params?: Record<string, any>) =>
      apiClient.get<{ results: Complaint[]; count: number }>({
        url: "/healthcare/complaints/", params,
      }),
    create: (data: Partial<Complaint>) =>
      apiClient.post<Complaint>({ url: "/healthcare/complaints/", data }),
  },
  // Master diagnosis list — the options behind the encounter's Diagnosis picker
  // (Marley's `Diagnosis` doctype).
  diagnosisCatalog: {
    list: (params?: Record<string, any>) =>
      apiClient.get<{ results: DiagnosisCatalog[]; count: number }>({
        url: "/healthcare/diagnosis-catalog/", params,
      }),
    create: (data: Partial<DiagnosisCatalog>) =>
      apiClient.post({ url: "/healthcare/diagnosis-catalog/", data }),
  },
  triageLevels: {
    list: () => apiClient.get({ url: "/healthcare/triage-levels/" }),
    create: (data: any) => apiClient.post({ url: "/healthcare/triage-levels/", data }),
  },
  medicationClasses: {
    list: (params?: Record<string, any>) =>
      apiClient.get<{ results: MedicationClass[]; count: number }>({
        url: "/healthcare/medication-classes/",
        params,
      }),
    create: (data: any) => apiClient.post({ url: "/healthcare/medication-classes/", data }),
  },
  healthcareActivities: {
    list: () => apiClient.get({ url: "/healthcare/healthcare-activities/" }),
    create: (data: any) => apiClient.post({ url: "/healthcare/healthcare-activities/", data }),
  },

  // Medications
  medications: {
    list: (params?: Record<string, any>) =>
      apiClient.get<{ results: Medication[]; count: number }>({
        url: "/healthcare/medications/", params,
      }),
    get: (id: number) => apiClient.get<Medication>({ url: `/healthcare/medications/${id}/` }),
    create: (data: Partial<Medication>) =>
      apiClient.post<Medication>({ url: "/healthcare/medications/", data }),
    update: (id: number, data: any) => apiClient.put({ url: `/healthcare/medications/${id}/`, data }),
    delete: (id: number) => apiClient.delete({ url: `/healthcare/medications/${id}/` }),
    checkStock: (id: number) =>
      apiClient.get<{
        medication_id: number;
        medication_name: string;
        item_code: string;
        in_stock: boolean;
        available_qty: number;
        warehouse: string;
      }>({ url: `/healthcare/medications/${id}/check_stock/` }),
    checkStockBatch: (items: (string | { medication_name?: string; item_code?: string })[]) =>
      apiClient.post<{
        results: Record<string, {
          item_code?: string;
          item_name?: string;
          in_stock: boolean;
          available_qty: number;
          warehouse: string;
        }>;
      }>({ url: "/healthcare/medications/check_stock_batch/", data: { items } }),
  },
  drugInteractions: {
    list: (params?: Record<string, any>) =>
      apiClient.get({ url: "/healthcare/drug-interactions/", params }),
    create: (data: any) => apiClient.post({ url: "/healthcare/drug-interactions/", data }),
    update: (id: number, data: any) => apiClient.put({ url: `/healthcare/drug-interactions/${id}/`, data }),
    delete: (id: number) => apiClient.delete({ url: `/healthcare/drug-interactions/${id}/` }),
  },

  // Allergies
  allergies: {
    list: (params?: Record<string, any>) =>
      apiClient.get({ url: "/healthcare/allergies/", params }),
    create: (data: any) => apiClient.post({ url: "/healthcare/allergies/", data }),
    update: (id: number, data: any) => apiClient.put({ url: `/healthcare/allergies/${id}/`, data }),
    delete: (id: number) => apiClient.delete({ url: `/healthcare/allergies/${id}/` }),
  },

  // Emergency
  emergencyRecords: {
    list: (params?: Record<string, any>) =>
      apiClient.get({ url: "/healthcare/emergency-records/", params }),
    get: (id: number) => apiClient.get({ url: `/healthcare/emergency-records/${id}/` }),
    create: (data: any) => apiClient.post({ url: "/healthcare/emergency-records/", data }),
    update: (id: number, data: any) => apiClient.put({ url: `/healthcare/emergency-records/${id}/`, data }),
    delete: (id: number) => apiClient.delete({ url: `/healthcare/emergency-records/${id}/` }),
    triage: (id: number) => apiClient.post({ url: `/healthcare/emergency-records/${id}/triage/` }),
    discharge: (id: number) => apiClient.post({ url: `/healthcare/emergency-records/${id}/discharge/` }),
    admit: (id: number) => apiClient.post({ url: `/healthcare/emergency-records/${id}/admit/` }),
  },

  // Discharge Summary
  dischargeSummaries: {
    list: (params?: Record<string, any>) =>
      apiClient.get({ url: "/healthcare/discharge-summaries/", params }),
    create: (data: any) => apiClient.post({ url: "/healthcare/discharge-summaries/", data }),
    update: (id: number, data: any) => apiClient.put({ url: `/healthcare/discharge-summaries/${id}/`, data }),
    delete: (id: number) => apiClient.delete({ url: `/healthcare/discharge-summaries/${id}/` }),
  },

  // Nursing Tasks
  nursingTasks: {
    list: (params?: Record<string, any>) =>
      apiClient.get({ url: "/healthcare/nursing-tasks/", params }),
    create: (data: any) => apiClient.post({ url: "/healthcare/nursing-tasks/", data }),
    update: (id: number, data: any) => apiClient.put({ url: `/healthcare/nursing-tasks/${id}/`, data }),
    delete: (id: number) => apiClient.delete({ url: `/healthcare/nursing-tasks/${id}/` }),
    complete: (id: number) => apiClient.post({ url: `/healthcare/nursing-tasks/${id}/complete/` }),
  },

  // Assessments
  assessments: {
    list: (params?: Record<string, any>) =>
      apiClient.get({ url: "/healthcare/assessments/", params }),
    create: (data: any) => apiClient.post({ url: "/healthcare/assessments/", data }),
    update: (id: number, data: any) => apiClient.put({ url: `/healthcare/assessments/${id}/`, data }),
    delete: (id: number) => apiClient.delete({ url: `/healthcare/assessments/${id}/` }),
  },

  // Service Requests (Marley Parity)
  serviceRequests: {
    list: (params?: Record<string, any>) =>
      apiClient.get<{ results: ServiceRequest[]; count: number }>({
        url: "/healthcare/service-requests/",
        params,
      }),
    get: (id: number) =>
      apiClient.get<ServiceRequest>({ url: `/healthcare/service-requests/${id}/` }),
    create: (data: Partial<ServiceRequest>) =>
      apiClient.post<ServiceRequest>({ url: "/healthcare/service-requests/", data }),
    update: (id: number, data: Partial<ServiceRequest>) =>
      apiClient.put<ServiceRequest>({ url: `/healthcare/service-requests/${id}/`, data }),
    delete: (id: number) =>
      apiClient.delete({ url: `/healthcare/service-requests/${id}/` }),
    complete: (id: number) =>
      apiClient.post<ServiceRequest>({ url: `/healthcare/service-requests/${id}/complete/` }),
    cancel: (id: number) =>
      apiClient.post<ServiceRequest>({ url: `/healthcare/service-requests/${id}/cancel/` }),
    activate: (id: number) =>
      apiClient.post<ServiceRequest>({ url: `/healthcare/service-requests/${id}/activate/` }),
  },
  serviceRequestCategories: {
    list: (params?: Record<string, any>) =>
      apiClient.get<{ results: ServiceRequestCategory[]; count: number }>({
        url: "/healthcare/service-request-categories/",
        params,
      }),
    create: (data: Partial<ServiceRequestCategory>) =>
      apiClient.post<ServiceRequestCategory>({
        url: "/healthcare/service-request-categories/",
        data,
      }),
    update: (id: number, data: Partial<ServiceRequestCategory>) =>
      apiClient.put<ServiceRequestCategory>({ url: `/healthcare/service-request-categories/${id}/`, data }),
    delete: (id: number) =>
      apiClient.delete({ url: `/healthcare/service-request-categories/${id}/` }),
  },

  // Payments
  payments: {
    list: (params?: Record<string, any>) =>
      apiClient.get({ url: "/healthcare/payments/", params }),
    create: (data: any) => apiClient.post({ url: "/healthcare/payments/", data }),
  },

  // Patient Medical Records (auto-logged activities)
  medicalRecords: {
    list: (params?: Record<string, any>) =>
      apiClient.get<{ results: any[]; count: number }>({ url: "/healthcare/patient-medical-records/", params }),
  },

  // Fee Validity
  feeValidities: {
    list: (params?: Record<string, any>) =>
      apiClient.get<{ results: any[]; count: number }>({ url: "/healthcare/fee-validity/", params }),
  },

  // Medication Requests
  medicationRequests: {
    list: (params?: Record<string, any>) =>
      apiClient.get<{ results: MedicationRequest[]; count: number }>({ url: "/healthcare/medication-requests/", params }),
    get: (id: number) =>
      apiClient.get<MedicationRequest>({ url: `/healthcare/medication-requests/${id}/` }),
    create: (data: any) =>
      apiClient.post<MedicationRequest>({ url: "/healthcare/medication-requests/", data }),
    update: (id: number, data: any) =>
      apiClient.put<MedicationRequest>({ url: `/healthcare/medication-requests/${id}/`, data }),
    delete: (id: number) =>
      apiClient.delete({ url: `/healthcare/medication-requests/${id}/` }),
    dispense: (id: number, data: { warehouse_id: number; qty?: number }) =>
      apiClient.post<{ message: string; stock_entry_id: number; stock_entry_number: string }>({
        url: `/healthcare/medication-requests/${id}/dispense/`,
        data,
      }),
    setStatus: (id: number, status: string) =>
      apiClient.post<MedicationRequest>({
        url: `/healthcare/medication-requests/${id}/set_status/`,
        data: { status },
      }),
  },

  // Inpatient Medication Entries (Marley Parity)
  inpatientMedicationEntries: {
    list: (params?: Record<string, any>) =>
      apiClient.get<{ results: InpatientMedicationEntry[]; count: number }>({
        url: "/healthcare/inpatient-medication-entries/",
        params,
      }),
    get: (id: number) =>
      apiClient.get<InpatientMedicationEntry>({
        url: `/healthcare/inpatient-medication-entries/${id}/`,
      }),
    create: (data: Partial<InpatientMedicationEntry>) =>
      apiClient.post<InpatientMedicationEntry>({
        url: "/healthcare/inpatient-medication-entries/",
        data,
      }),
    update: (id: number, data: Partial<InpatientMedicationEntry>) =>
      apiClient.put<InpatientMedicationEntry>({
        url: `/healthcare/inpatient-medication-entries/${id}/`,
        data,
      }),
    delete: (id: number) =>
      apiClient.delete({
        url: `/healthcare/inpatient-medication-entries/${id}/`,
      }),
    getMedicationOrders: (id: number) =>
      apiClient.post<{ message: string; orders: InpatientMedicationEntryDetail[] }>({
        url: `/healthcare/inpatient-medication-entries/${id}/get_medication_orders/`,
      }),
    checkStockShortage: (id: number) =>
      apiClient.get<{ has_shortage: boolean; shortages: ShortageItem[]; message: string }>({
        url: `/healthcare/inpatient-medication-entries/${id}/check_stock_shortage/`,
      }),
    submitEntry: (id: number) =>
      apiClient.post<{ message: string; entry_id: string; stock_entry_id?: number; stock_entry_number?: string }>({
        url: `/healthcare/inpatient-medication-entries/${id}/submit_entry/`,
      }),
    cancelEntry: (id: number) =>
      apiClient.post<{ message: string }>({
        url: `/healthcare/inpatient-medication-entries/${id}/cancel_entry/`,
      }),
    makeDifferenceStockEntry: (id: number) =>
      apiClient.post<{ message: string; stock_entry_id?: number }>({
        url: `/healthcare/inpatient-medication-entries/${id}/make_difference_stock_entry/`,
      }),
  },

  // Pharmacy Analytics, Outpatient Dispensing & Stock
  pharmacy: {
    dashboardStats: () =>
      apiClient.get<PharmacyDashboardStats>({
        url: "/healthcare/pharmacy/dashboard_stats/",
      }),
    stockBalances: (params?: { warehouse?: number; low_stock?: boolean; search?: string }) =>
      apiClient.get<{ results: PharmacyStockBalance[]; count: number }>({
        url: "/healthcare/pharmacy/stock_balances/",
        params,
      }),
    getPatientPrescriptions: (patientId: number) =>
      apiClient.get<{ prescriptions: OutpatientPrescriptionItem[]; count: number }>({
        url: "/healthcare/pharmacy/patient_prescriptions/",
        params: { patient_id: patientId },
      }),
    dispenseOutpatient: (data: OutpatientDispensePayload) =>
      apiClient.post<OutpatientDispenseReceipt>({
        url: "/healthcare/pharmacy/dispense_outpatient/",
        data,
      }),
    getOutpatientHistory: () =>
      apiClient.get<{ results: OutpatientHistoryItem[]; count: number }>({
        url: "/healthcare/pharmacy/outpatient_history/",
      }),
    addStock: (data: AddStockPayload) =>
      apiClient.post<AddStockResponse>({
        url: "/healthcare/pharmacy/add_stock/",
        data,
      }),
    disposeExpired: (data: DisposeStockPayload) =>
      apiClient.post<DisposeStockResponse>({
        url: "/healthcare/pharmacy/dispose_expired/",
        data,
      }),
    getDisposalHistory: () =>
      apiClient.get<{ results: StockVoucherHistoryItem[]; count: number }>({
        url: "/healthcare/pharmacy/disposal_history/",
      }),
    getInwardHistory: () =>
      apiClient.get<{ results: StockVoucherHistoryItem[]; count: number }>({
        url: "/healthcare/pharmacy/inward_history/",
      }),
  },

  // Pharmacy Warehouses
  pharmacyWarehouses: {
    list: (params?: Record<string, any>) =>
      apiClient.get<{ results: PharmacyWarehouse[]; count: number }>({
        url: "/healthcare/pharmacy-warehouses/",
        params,
      }),
    get: (id: number) =>
      apiClient.get<PharmacyWarehouse>({ url: `/healthcare/pharmacy-warehouses/${id}/` }),
    create: (data: Partial<PharmacyWarehouse>) =>
      apiClient.post<PharmacyWarehouse>({ url: "/healthcare/pharmacy-warehouses/", data }),
    update: (id: number, data: Partial<PharmacyWarehouse>) =>
      apiClient.put<PharmacyWarehouse>({ url: `/healthcare/pharmacy-warehouses/${id}/`, data }),
    delete: (id: number) =>
      apiClient.delete({ url: `/healthcare/pharmacy-warehouses/${id}/` }),
  },

  // Treatment Plan Templates
  treatmentPlanTemplates: {
    list: (params?: Record<string, any>) =>
      apiClient.get<{ results: TreatmentPlanTemplate[]; count: number }>({
        url: "/healthcare/treatment-plan-templates/", params,
      }),
    get: (id: number) =>
      apiClient.get<TreatmentPlanTemplate>({ url: `/healthcare/treatment-plan-templates/${id}/` }),
    create: (data: any) =>
      apiClient.post<TreatmentPlanTemplate>({ url: "/healthcare/treatment-plan-templates/", data }),
    update: (id: number, data: any) =>
      apiClient.put<TreatmentPlanTemplate>({ url: `/healthcare/treatment-plan-templates/${id}/`, data }),
    delete: (id: number) =>
      apiClient.delete({ url: `/healthcare/treatment-plan-templates/${id}/` }),
  },

  // Diagnostic Reports
  diagnosticReports: {
    list: (params?: Record<string, any>) =>
      apiClient.get<{ results: DiagnosticReport[]; count: number }>({
        url: "/healthcare/diagnostic-reports/",
        params,
      }),
    get: (id: number) =>
      apiClient.get<DiagnosticReport>({ url: `/healthcare/diagnostic-reports/${id}/` }),
    create: (data: Partial<DiagnosticReport>) =>
      apiClient.post<DiagnosticReport>({ url: "/healthcare/diagnostic-reports/", data }),
    update: (id: number, data: Partial<DiagnosticReport>) =>
      apiClient.put<DiagnosticReport>({ url: `/healthcare/diagnostic-reports/${id}/`, data }),
    delete: (id: number) =>
      apiClient.delete({ url: `/healthcare/diagnostic-reports/${id}/` }),
  },

  // Clinical Note Types
  clinicalNoteTypes: {
    list: (params?: Record<string, any>) =>
      apiClient.get<{ results: ClinicalNoteType[]; count: number }>({
        url: "/healthcare/clinical-note-types/",
        params,
      }),
    create: (data: Partial<ClinicalNoteType>) =>
      apiClient.post<ClinicalNoteType>({ url: "/healthcare/clinical-note-types/", data }),
    update: (id: number, data: Partial<ClinicalNoteType>) =>
      apiClient.put<ClinicalNoteType>({ url: `/healthcare/clinical-note-types/${id}/`, data }),
    delete: (id: number) =>
      apiClient.delete({ url: `/healthcare/clinical-note-types/${id}/` }),
  },

  // Inpatient Medication Orders
  inpatientMedicationOrders: {
    list: (params?: Record<string, any>) =>
      apiClient.get<{ results: InpatientMedicationOrder[]; count: number }>({
        url: "/healthcare/inpatient-medication-orders/",
        params,
      }),
    create: (data: Partial<InpatientMedicationOrder>) =>
      apiClient.post<InpatientMedicationOrder>({
        url: "/healthcare/inpatient-medication-orders/",
        data,
      }),
    get: (id: number) =>
      apiClient.get<InpatientMedicationOrder>({
        url: `/healthcare/inpatient-medication-orders/${id}/`,
      }),
    update: (id: number, data: Partial<InpatientMedicationOrder>) =>
      apiClient.put<InpatientMedicationOrder>({
        url: `/healthcare/inpatient-medication-orders/${id}/`,
        data,
      }),
    delete: (id: number) =>
      apiClient.delete({ url: `/healthcare/inpatient-medication-orders/${id}/` }),
  },
  // Healthcare Executive & Clinical Dashboard
  dashboard: {
    analytics: () =>
      apiClient.get<HealthcareDashboardAnalytics>({
        url: "/healthcare/dashboard/analytics/",
      }),
  },
  // Clinical Laboratory Analytics & Operations Dashboard
  labDashboard: {
    stats: (params?: { period?: string; department?: number | string }) =>
      apiClient.get<LabDashboardStats>({
        url: "/healthcare/lab-dashboard/stats/",
        params,
      }),
  },
};

export interface HealthcareDashboardAnalytics {
  stats: {
    patients: number;
    inpatients_active: number;
    practitioners: number;
    appointments_today: number;
    appointments_total: number;
    encounters: number;
    lab_tests: number;
    inpatients: number;
    therapy_plans: number;
    insurance_claims: number;
    prescriptions: number;
    medication_requests: number;
    vitals: number;
  };
  charts: {
    gender_distribution: { labels: string[]; series: number[] };
    blood_group_distribution: { labels: string[]; series: number[] };
    encounter_statuses: { labels: string[]; series: number[] };
    appointment_statuses: { labels: string[]; series: number[] };
    lab_statuses: { labels: string[]; series: number[] };
    inpatient_statuses: { labels: string[]; series: number[] };
  };
  today_appointments: Array<{
    id: number;
    appointment_id: string;
    patient_name: string;
    patient_id?: number;
    practitioner_name: string;
    department_name: string;
    appointment_date: string;
    appointment_time: string;
    status: string;
    appointment_type: string;
    position_in_queue?: number;
  }>;
  upcoming_appointments: Array<{
    id: number;
    appointment_id: string;
    patient_name: string;
    patient_id?: number;
    practitioner_name: string;
    department_name: string;
    appointment_date: string;
    appointment_time: string;
    status: string;
    appointment_type: string;
  }>;
  recent_encounters: Array<{
    id: number;
    encounter_id: string;
    patient_name: string;
    patient_id?: number;
    practitioner_name: string;
    encounter_date: string;
    status: string;
    symptoms: string;
    notes: string;
  }>;
  recent_labs: Array<{
    id: number;
    test_id: string;
    lab_test_name: string;
    patient_name: string;
    practitioner_name: string;
    status: string;
    date: string;
  }>;
  recent_inpatients: Array<{
    id: number;
    record_id: string;
    patient_name: string;
    admission_date: string;
    status: string;
    chief_complaint: string;
  }>;
  recent_vitals: Array<{
    id: number;
    patient_name: string;
    patient_id?: number;
    bp: string;
    bp_systolic?: number;
    bp_diastolic?: number;
    pulse?: number;
    temperature?: number;
    bmi?: number;
    signs_date: string;
    is_high_bp: boolean;
    is_fever: boolean;
  }>;
  recent_patients: Array<{
    id: number;
    patient_name: string;
    patient_id: string;
    sex: string;
    blood_group: string;
    dob: string;
    inpatient_status: boolean;
    image?: string;
  }>;
  departments: Array<{
    department: string;
    patient_care_type: string;
  }>;
}

export interface LabWorklistItem {
  id: number;
  test_id: string;
  lab_test_name: string;
  status: string;
  specimen_status: string;
  specimen_condition: string;
  specimen_barcode: string;
  priority: string;
  date: string;
  patient: {
    id: number;
    name: string;
    patient_id: string;
    age: string;
    sex: string;
  };
  practitioner_name: string;
  department_name: string;
  sample_name: string;
  collected_by: string;
  collection_datetime: string;
  results_preview: string;
  rejection_reason?: string;
}

export interface LabDashboardStats {
  kpis: {
    total_tests: number;
    today_orders: number;
    pending_collection: number;
    samples_collected: number;
    specimens_received: number;
    in_progress: number;
    awaiting_approval: number;
    approved_count: number;
    approved_today: number;
    rejected_specimens: number;
    stat_urgent_count: number;
    avg_tat_hours: number;
    sample_collections_total: number;
    test_templates_count: number;
  };
  charts: {
    daily_trends: {
      categories: string[];
      series: Array<{ name: string; data: number[] }>;
    };
    department_distribution: {
      labels: string[];
      series: number[];
    };
    specimen_pipeline: Array<{
      stage: string;
      count: number;
      color: string;
    }>;
    top_tests: Array<{
      name: string;
      count: number;
    }>;
    status_distribution: {
      labels: string[];
      series: number[];
    };
  };
  worklists: {
    urgent_queue: LabWorklistItem[];
    accessioning_bench: LabWorklistItem[];
    pending_approval: LabWorklistItem[];
    recent_tests: LabWorklistItem[];
    critical_rejected: LabWorklistItem[];
  };
  departments: Array<{
    id: number;
    name: string;
  }>;
}

export const healthcareService = HealthcareApi;

