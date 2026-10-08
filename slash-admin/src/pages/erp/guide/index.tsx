import { useState, useMemo } from "react";
import { useNavigate } from "react-router";
import { Icon } from "@/components/icon";
import { Badge } from "@/ui/badge";
import { Button } from "@/ui/button";
import { Card, CardContent, CardHeader } from "@/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/ui/tabs";
import { Input } from "@/ui/input";
import eeuLogoImg from "@/assets/images/eeu-logo.png";

// ── Types ─────────────────────────────────────────────────────────────
interface OutpatientStage {
  stage: number;
  phase: string;
  title: string;
  actor: string;
  actorRole: string;
  duration: string;
  objective: string;
  protocol: string[];
  systemAction: string;
  systemPath: string;
  documentGenerated: string;
  qualityMetric: string;
}

interface SoapTemplate {
  id: string;
  diagnosis: string;
  icdCode: string;
  category: string;
  patientDemographics: string;
  chiefComplaint: string;
  subjective: {
    hpi: string;
    pmhx: string;
    medications: string;
    allergies: string;
    social: string;
  };
  objective: {
    vitals: string;
    general: string;
    heent: string;
    cardiovascular: string;
    respiratory: string;
    abdomen: string;
    musculoskeletal: string;
    neuro: string;
  };
  assessment: {
    primary: string;
    secondary: string[];
    differential: string[];
  };
  plan: {
    diagnostics: string[];
    medications: string[];
    education: string[];
    followUp: string;
    disposition: string;
  };
}

interface OutpatientLabTest {
  testName: string;
  category: "Hematology" | "Chemistry & Metabolic" | "Infectious & Serology" | "Urinalysis" | "Microbiology";
  tubeColor: string;
  sampleType: string;
  referenceRange: string;
  fastingRequired: boolean;
  clinicalIndications: string;
  turnaroundTime: string;
}

interface ClinicalProtocol {
  id: string;
  code: string;
  title: string;
  condition: string;
  icon: string;
  diagnosticCriteria: string[];
  therapeuticSteps: string[];
  prescribingRules: string[];
  redFlagAlerts: string;
  lifestyleAdvice: string[];
}

interface ClinicRole {
  role: string;
  title: string;
  icon: string;
  color: string;
  bgColor: string;
  badge: string;
  coreResponsibilities: string[];
  dailyChecklist: string[];
  keyModules: { name: string; path: string }[];
}

// ── OUTPATIENT JOURNEY DATA (7 STAGES) ─────────────────────────────────
const OUTPATIENT_STAGES: OutpatientStage[] = [
  {
    stage: 1,
    phase: "Reception & Eligibility",
    title: "Patient Arrival, Digital ID Verification & Benefit Quota Check",
    actor: "Clinic Receptionist / Registration Officer",
    actorRole: "Front Desk Registration Clerk",
    duration: "2 – 4 Minutes",
    objective:
      "Authenticate employee or registered dependent identity, verify annual medical coverage quota balance (25,000 ETB ceiling), and queue into OPD consultation schedule.",
    protocol: [
      "Scan employee Digital Medical ID Card QR code or search by EEU Staff Badge number in Patients Registry.",
      "Confirm active employment status, technical grade, department, and assigned regional health center.",
      "If patient is a dependent (spouse or child), confirm registered family relationship on the employee profile.",
      "Check live remaining medical benefit balance: inform staff if quota utilization exceeds 80% (20,000 ETB consumed).",
      "Assign patient to appropriate practitioner OPD queue (General Practice, Internal Medicine, Pediatrics, or Dental).",
      "Print or generate electronic Outpatient Visit Slip with sequential token number.",
    ],
    systemAction: "Queue patient in daily appointment schedule or walk-in consultation list.",
    systemPath: "/healthcare/patients",
    documentGenerated: "Electronic Outpatient Consultation Token & Queue Record",
    qualityMetric: "Patient check-in completed in under 3 minutes; zero unregistered walk-ins.",
  },
  {
    stage: 2,
    phase: "Nursing Triage",
    title: "Nursing Vitals Measurement & Automated Anomaly Detection",
    actor: "Outpatient Triage Nurse",
    actorRole: "Clinical Nursing Officer",
    duration: "5 – 8 Minutes",
    objective:
      "Accurately record baseline physiologic parameters, screen for acute medical red flags, and prioritize urgent consultations.",
    protocol: [
      "Blood Pressure: Measure seated resting BP in both arms using calibrated sphygmomanometer with appropriate cuff size.",
      "Pulse & Heart Rate: Palpate radial pulse for 60 seconds; note rate, rhythm, and volume (normal: 60-100 bpm).",
      "Body Temperature: Measure tympanic or axillary temperature (normal: 36.5°C – 37.5°C; fever threshold > 38.0°C).",
      "Respiratory Rate & SpO2: Count respiratory rate unobtrusively for 60 seconds; measure room-air pulse oximetry (normal: 95% - 100%).",
      "Random Blood Glucose: Perform glucometer fingerstick for known diabetic patients or symptomatic dizziness/sweating.",
      "Anthropometry: Measure height and weight to calculate Body Mass Index (BMI kg/m²).",
      "Pain Score: Record subjective pain level on standardized 1-10 visual analog scale.",
      "Immediate Escalation: If BP > 180/110, SpO2 < 92%, or chest pain present, immediately notify attending physician.",
    ],
    systemAction: "Record vital signs in Vital Signs module; automated anomaly alerts highlight abnormal values.",
    systemPath: "/healthcare/vital-signs",
    documentGenerated: "Electronic Vital Signs Observation Chart",
    qualityMetric: "100% of adult outpatients receive comprehensive 5-point vitals prior to physician exam.",
  },
  {
    stage: 3,
    phase: "Physician Consultation",
    title: "Clinical Encounter & Structured SOAP Documentation",
    actor: "Attending Physician / General Practitioner",
    actorRole: "Medical Doctor / Health Officer",
    duration: "15 – 25 Minutes",
    objective:
      "Conduct thorough diagnostic interview, perform system-focused physical examination, formulate differential diagnoses, and document structured SOAP clinical notes.",
    protocol: [
      "Subjective (S): Elicit Chief Complaint (CC) in patient's words; detail History of Present Illness (HPI) using OPQRST framework (Onset, Provocation, Quality, Radiation, Severity, Timing).",
      "Review Past Medical History (PMHx), known drug allergies (Penicillin, Sulfa, NSAIDs), family history, and occupational hazards.",
      "Objective (O): Conduct systematic physical examination focused on affected body systems (HEENT, Chest/Lungs, CVS, Abdomen, Musculoskeletal, Neurological).",
      "Assessment (A): Formulate primary clinical diagnosis and assign standard ICD-10 code; record secondary comorbidities.",
      "Plan (P): Formulate comprehensive 4-part plan covering diagnostic laboratory investigations, pharmacological prescriptions, patient counseling, and follow-up disposition.",
    ],
    systemAction: "Create Patient Encounter record linked to practitioner schedule and patient history.",
    systemPath: "/healthcare/encounters",
    documentGenerated: "Completed Clinical Encounter Record (SOAP Format)",
    qualityMetric: "Standardized ICD-10 diagnostic coding on 100% of outpatient encounters.",
  },
  {
    stage: 4,
    phase: "Diagnostic Investigation",
    title: "Electronic Laboratory Diagnostic Order & Specimen Accessioning",
    actor: "Attending Physician & Lab Technologist",
    actorRole: "Medical Doctor & Laboratory Technologist",
    duration: "15 – 45 Minutes (Stat Tests)",
    objective:
      "Order targeted diagnostic panels, collect biological specimens with strict aseptic technique, analyze specimens, and validate electronic results against reference ranges.",
    protocol: [
      "Physician selects required diagnostic tests in electronic lab requisition (e.g. CBC, Fasting Glucose, Lipid Profile, Urinalysis, Stool Exam, Malaria Blood Film).",
      "Patient arrives at outpatient phlebotomy station; lab technician verifies patient identity and order barcode.",
      "Collect venous blood sample into appropriate vacuum tube (Purple EDTA for CBC, Yellow/Gold Gel Separator for Chemistry, Grey Sodium Fluoride for Glucose).",
      "Centrifuge serum tubes; load onto automated hematology or clinical chemistry analyzer.",
      "Enter numeric results; system automatically flags abnormal values outside standard biological reference ranges.",
      "Technologist validates and approves diagnostic report; critical panic values are immediately telephoned to the prescribing doctor.",
    ],
    systemAction: "Order tests in Lab Tests module, collect specimens in Sample Collections, and review in Lab Dashboard.",
    systemPath: "/healthcare/lab-dashboard",
    documentGenerated: "Validated Diagnostic Pathology Report with Reference Ranges",
    qualityMetric: "Routine outpatient lab test turnaround time < 45 minutes; 100% specimen labeling accuracy.",
  },
  {
    stage: 5,
    phase: "Pharmacy & E-Prescribing",
    title: "Electronic Prescription Review & Outpatient Pharmacy Dispensing",
    actor: "Licensed Hospital Pharmacist",
    actorRole: "Clinical Pharmacist",
    duration: "5 – 10 Minutes",
    objective:
      "Audit physician prescription orders, verify drug safety and dosage, dispense medications using FEFO batch rules, provide counseling, and deduct allowance.",
    protocol: [
      "Access incoming electronic prescription queue; review drug name, strength, dosage form, route, and frequency.",
      "Perform clinical safety audit: check for drug-drug interactions, contraindications, and patient allergy alerts.",
      "Select medication batch from pharmacy stock with earliest expiration date (First-Expiry-First-Out principle).",
      "Affix printed prescription label detailing: Patient Name, Drug Generic Name, Dosage, Frequency (e.g. 'Take 1 tablet every 12 hours with meals'), and Expiry Date.",
      "Conduct verbal patient counseling: explain purpose of medication, expected side effects, and importance of completing antibiotic courses.",
      "System tallies total medication cost and automatically deducts from employee's annual 25,000 ETB allowance, printing itemized dispensing receipt.",
    ],
    systemAction: "Process dispensing in Outpatient Dispensing screen; update pharmacy batch inventory balances.",
    systemPath: "/healthcare/pharmacy/outpatient",
    documentGenerated: "Electronic Pharmacy Dispensing Slip & Medical Benefit Deduction Receipt",
    qualityMetric: "Zero medication dispensing errors; 100% patient counseling on prescribed antibiotics.",
  },
  {
    stage: 6,
    phase: "Medical Certification",
    title: "Outpatient Sick Leave Slip & Duty Restriction Issuance",
    actor: "Attending Physician",
    actorRole: "Licensed Medical Practitioner",
    duration: "3 – 5 Minutes",
    objective:
      "Provide formal, tamper-evident medical certification for temporary work incapacity or recommend light-duty occupational restrictions.",
    protocol: [
      "Evaluate clinical necessity of medical rest based on diagnostic severity (standard outpatient rest: 1 to 5 calendar days).",
      "Generate Official Certificate of Medical Illness in the system.",
      "System generates unique sequential certificate code (e.g. EEU-MC-2026-XXXX) and scannable QR verification code.",
      "Specify exact start date, resumption date, clinical rationale, and duty recommendations upon return (e.g. avoid manual heavy lifting).",
      "Print official A4 certificate with EEU Health Services Directorate header and authorized physician signature.",
      "Provide patient copy for line supervisor and electronic archival copy for HR Payroll Directorate.",
    ],
    systemAction: "Generate and save Sick Leave Certificate; render printable A4 slip with corporate seal.",
    systemPath: "/healthcare/occupational/sick-leave-certificates",
    documentGenerated: "Official EEU Certificate of Medical Illness (A4 Format)",
    qualityMetric: "100% compliance with Ethiopian Labour Law and EEU Collective Bargaining guidelines.",
  },
  {
    stage: 7,
    phase: "Disposition & Follow-Up",
    title: "Appointment Booking, Specialist Referral & Outpatient Disposition",
    actor: "Attending Physician & Clinic Receptionist",
    actorRole: "Clinical Team",
    duration: "2 – 4 Minutes",
    objective:
      "Schedule scheduled review appointments for chronic condition monitoring, order ancillary service requests, or initiate specialist referral if required.",
    protocol: [
      "Chronic Disease Follow-up: Schedule return appointment in 2 to 4 weeks for hypertensive, diabetic, or asthmatic patients to review therapy response.",
      "Ancillary Service Requests: Order outpatient physiotherapy sessions or dietary consultations via Service Requests module.",
      "Specialist Escalation: If patient presents with complex, surgical, or refractory illness exceeding primary clinic scope, initiate external specialist referral.",
      "Close outpatient encounter; update electronic patient medical record with encounter status 'Completed'.",
    ],
    systemAction: "Book follow-up in Appointments module; generate Service Request or External Referral record.",
    systemPath: "/healthcare/appointments",
    documentGenerated: "Follow-up Appointment Confirmation Slip & Referral Record",
    qualityMetric: "Chronic disease follow-up retention rate > 90%; clear documented disposition for every patient.",
  },
];

// ── REALISTIC OUTPATIENT SOAP TEMPLATES ───────────────────────────────
const SOAP_TEMPLATES: SoapTemplate[] = [
  {
    id: "hypertension-opd",
    diagnosis: "Essential (Primary) Hypertension, Uncontrolled",
    icdCode: "I10",
    category: "Cardiovascular / Chronic Care",
    patientDemographics: "Male, 48 years, EEU Senior Distribution Technician (Kality Hub)",
    chiefComplaint: "Occipital morning headaches and mild exertion dizziness for 3 weeks.",
    subjective: {
      hpi: "Patient reports persistent dull occipital headaches, worse upon waking in the morning, gradually improving during the day. Associated with mild lightheadedness when climbing stairs at work. Denies blurred vision, chest pain, palpitations, shortness of breath, orthopnea, or ankle edema. No history of syncope.",
      pmhx: "Diagnosed with hypertension 2 years ago; was prescribed Amlodipine 5mg OD but admits to irregular compliance ('I only take pills when I feel dizzy'). No prior cardiac events. Non-diabetic.",
      medications: "Amlodipine 5mg PO OD (intermittent compliance). No OTC supplements.",
      allergies: "No known drug allergies (NKDA).",
      social: "EEU employee for 14 years. Non-smoker. Consumes alcohol socially (1-2 beers/week). High dietary sodium intake (eats cafeteria food regularly). Sedentary outside of work.",
    },
    objective: {
      vitals: "BP: 168/102 mmHg (right arm, seated) | 164/100 mmHg (left arm) | Pulse: 78 bpm regular | Temp: 36.7°C | RR: 16/min | SpO2: 98% room air | BMI: 28.4 kg/m² (Overweight).",
      general: "Middle-aged man, alert, oriented ×3, in no acute distress. Well hydrated.",
      heent: "Fundoscopy: Arteriolar narrowing present, no cotton wool spots, hemorrhages, or papilledema. Sclera anicteric, conjunctivae pink.",
      cardiovascular: "S1, S2 audible, regular rate and rhythm. No murmurs, rubs, or gallops. Carotid pulses intact bilaterally without bruits. Peripheral pulses present; no peripheral edema.",
      respiratory: "Clear to auscultation bilaterally. Normal vesicular breath sounds. No wheezes or crackles.",
      abdomen: "Soft, non-tender, non-distended. Normal active bowel sounds. No renal artery bruits auscultated.",
      musculoskeletal: "Normal muscle tone and bulk. No joint deformities.",
      neuro: "Grossly intact. Cranial nerves II-XII grossly normal. Motor power 5/5 all extremities. Gait normal.",
    },
    assessment: {
      primary: "Essential (Primary) Hypertension, Stage 2 Uncontrolled (ICD-10: I10)",
      secondary: ["Overweight / Class I Pre-obesity (BMI 28.4 kg/m²)", "Medication Non-Adherence"],
      differential: ["White coat hypertension", "Renal artery stenosis", "Primary hyperaldosteronism"],
    },
    plan: {
      diagnostics: [
        "Resting 12-lead ECG (evaluate for left ventricular hypertrophy / voltage criteria)",
        "Serum Creatinine, BUN, eGFR, and Serum Electrolytes (Na+, K+)",
        "Fasting Blood Glucose (FBG) and Lipid Profile (Total Cholesterol, HDL, LDL, Triglycerides)",
        "Urinalysis (dipstick for proteinuria/microalbuminuria)",
      ],
      medications: [
        "Intensify Antihypertensive Therapy: Combine Amlodipine 10mg PO OD with Enalapril 10mg PO OD (morning administration).",
        "Advise to take medications daily with morning meal; explain that hypertension is a 'silent disease'.",
      ],
      education: [
        "DASH Diet counseling: reduce table salt intake (< 5g/day), increase vegetables and fresh fruits.",
        "Weight management: target 5% weight loss over 3 months.",
        "Home BP monitoring: record blood pressure in logbook twice daily for 2 weeks.",
        "Warning signs: return immediately to clinic if severe headache, chest tightness, or visual disturbances occur.",
      ],
      followUp: "Return to Outpatient Clinic in 2 weeks with home BP logbook and completed lab test results.",
      disposition: "Outpatient management; medically cleared for light ground duties, deferred pole climbing for 14 days.",
    },
  },
  {
    id: "bronchitis-opd",
    diagnosis: "Acute Bronchitis & Viral Upper Respiratory Infection",
    icdCode: "J20.9",
    category: "Pulmonology / Acute Illness",
    patientDemographics: "Female, 34 years, EEU Customer Care Desk Officer (Addis Ababa North)",
    chiefComplaint: "Dry cough, sore throat, and low-grade fever for 4 days.",
    subjective: {
      hpi: "Onset 4 days ago with scratchy throat, nasal congestion, and clear rhinorrhea. Progressed to frequent hacking cough, now with minimal whitish-yellow mucoid sputum. Mild retrosternal burning discomfort during coughing fits. Low-grade fever with mild chills. Denies hemoptysis, shortness of breath, wheezing, orthopnea, or pleuritic chest pain.",
      pmhx: "No asthma, COPD, or chronic sinusitis. Previous episode of viral pharyngitis 1 year ago.",
      medications: "OTC Paracetamol 500mg prn (provided partial relief of fever).",
      allergies: "NKDA.",
      social: "Works in air-conditioned office with frequent public customer contact. Multiple colleagues recently off sick with similar symptoms. Non-smoker.",
    },
    objective: {
      vitals: "BP: 118/76 mmHg | Pulse: 84 bpm | Temp: 37.9°C | RR: 18/min | SpO2: 97% room air | BMI: 23.1 kg/m².",
      general: "Young adult female, conscious, coughing during interview, looks mildly fatigued.",
      heent: "Mild erythema of posterior pharyngeal wall; tonsils symmetrical, not enlarged, no purulent exudates. Uvula midline. Nasal turbinates mildly congested with clear discharge. No cervical lymphadenopathy.",
      cardiovascular: "S1, S2 audible, regular, no murmurs.",
      respiratory: "Scattered coarse rhonchi bilaterally, clearing significantly after coughing. No fine inspiratory crackles. No wheezing. Normal percussion note. Good bilateral air entry.",
      abdomen: "Soft, non-tender throughout. Bowel sounds active.",
      musculoskeletal: "Mild generalized myalgias; no joint effusions.",
      neuro: "Alert and fully oriented.",
    },
    assessment: {
      primary: "Acute Bronchitis, Unspecified (ICD-10: J20.9)",
      secondary: ["Acute Viral Nasopharyngitis (Common Cold) (ICD-10: J00)"],
      differential: ["Community-Acquired Pneumonia (ruled out by clear auscultation and normal SpO2)", "COVID-19 / Influenza", "Allergic Rhinosinusitis"],
    },
    plan: {
      diagnostics: [
        "Complete Blood Count (CBC) with differential (rule out significant leukocytosis)",
        "Rapid Influenza / Viral swab (optional if high community transmission)",
        "Chest X-Ray deferred unless fever > 38.5°C persists or focal crackles develop",
      ],
      medications: [
        "Symptomatic Relief: Paracetamol 1000mg PO TID prn for fever and throat discomfort × 5 days.",
        "Cough Suppressant / Expectorant: Dextromethorphan + Guaifenesin syrup 10 mL PO TID × 5 days.",
        "Saline Nasal Spray: 2 sprays per nostril QID as needed for nasal decongestion.",
        "Antibiotic Stewardship: Reassure patient that antibiotics are INEFFECTIVE for viral bronchitis and will not speed recovery.",
      ],
      education: [
        "Hydration: drink minimum 2.5 - 3 liters of warm water, lemon tea, and broths daily to thin mucus.",
        "Steam inhalation twice daily to soothe airway mucosa.",
        "Infection control: wear surgical mask at home/work, frequent hand hygiene with soap and water.",
      ],
      followUp: "Return immediately if high fever (>38.5°C), shortness of breath, blood in sputum, or symptoms persist beyond 10 days.",
      disposition: "Issued 3 days official Medical Sick Leave Slip for home rest and viral recovery.",
    },
  },
  {
    id: "lumbar-strain-opd",
    diagnosis: "Acute Work-Related Lumbar Musculoskeletal Strain",
    icdCode: "M54.5",
    category: "Musculoskeletal / Occupational Ergonomics",
    patientDemographics: "Male, 39 years, EEU Substation Heavy Cable Maintenance Crew (Sebeta)",
    chiefComplaint: "Acute low back pain radiating to gluteal region after pulling 33kV cable reel 2 days ago.",
    subjective: {
      hpi: "Patient experienced sudden 'twinge' and severe stiffness in lower back while manually maneuvering a heavy electrical cable reel at Sebeta 400kV substation. Pain is described as a severe deep aching tightness (VAS score 7/10), aggravated by bending, twisting, or prolonged standing. Improved with lying supine with knees bent. Denies true radicular electric pain radiating below the knee. Denies saddle anesthesia, urinary incontinence, bowel dysfunction, or progressive leg weakness.",
      pmhx: "Occasional mild back stiffness in the past; no history of spinal surgery, osteoporosis, or malignancy.",
      medications: "Took Diclofenac 50mg tab yesterday with partial relief.",
      allergies: "NKDA.",
      social: "Heavy manual labor lineman for 11 years. Regular lifting of tools, crossarms, and cables up to 35 kg. Does not regularly practice warm-up stretches before field shifts.",
    },
    objective: {
      vitals: "BP: 126/82 mmHg | Pulse: 76 bpm | Temp: 36.6°C | RR: 16/min | SpO2: 99% | BMI: 26.2 kg/m².",
      general: "Athletic male, walks with cautious guarded gait, shifts weight off left lumbar side.",
      heent: "Normal conjunctivae and sclera; pupils equal, round, and reactive to light.",
      cardiovascular: "S1, S2 audible, regular rate and rhythm, no murmurs.",
      respiratory: "Lungs clear to auscultation bilaterally; normal vesicular breath sounds.",
      musculoskeletal: "Marked paravertebral muscle spasm and tenderness palpated across L3-L5 region bilaterally. Normal lumbar lordosis preserved. Range of Motion: Lumbar flexion limited to 45° due to pain; extension and lateral rotation guarded. No step-off deformities or bony midline spinous process tenderness.",
      neuro: "Straight Leg Raise (SLR) test negative bilaterally up to 75° (no radiating shock-like pain below knee). Lower extremity motor power 5/5 bilaterally (knee extension L3/L4, ankle dorsiflexion L4/L5, great toe extension L5, plantar flexion S1). Patellar and Achilles deep tendon reflexes 2+ symmetrical. Sensory examination intact to light touch in L1-S2 dermatomes. Normal anal sphincter tone.",
      abdomen: "Normal, no aortic pulsatile mass.",
    },
    assessment: {
      primary: "Acute Lumbar Musculoskeletal Strain / Sprain (ICD-10: M54.5)",
      secondary: ["Occupational Heavy Lifting Ergonomic Injury"],
      differential: ["Lumbar Disc Herniation with Radiculopathy (ruled out by negative SLR and normal reflexes)", "Vertebral compression fracture", "Facet joint arthropathy"],
    },
    plan: {
      diagnostics: [
        "Plain Lumbar Spine X-Ray (AP & Lateral views) to rule out spondylolisthesis or degenerative disc disease.",
        "Routine urinalysis (rule out nephrolithiasis / urinary tract etiology).",
      ],
      medications: [
        "NSAID Analgesia: Ibuprofen 600mg PO TID with meals × 5 days (caution: take with food).",
        "Muscle Relaxant: Chlorzoxazone 500mg PO BID × 5 days (warn patient of mild drowsiness).",
        "Gastroprotection: Omeprazole 20mg PO OD morning × 7 days.",
      ],
      education: [
        "Avoid prolonged bed rest: explain that gentle walking speeds recovery compared to complete immobilization.",
        "Apply local heat packs for 15-20 minutes TID to relieve muscle spasm.",
        "Ergonomic training: demonstrate safe lifting techniques (bend at knees, keep load close to body, avoid twisting).",
        "Red Flag Warning: seek emergency care immediately if urinary retention, bowel incontinence, or foot drop develops.",
      ],
      followUp: "Review in clinic in 7 days; if pain unresolved, order physiotherapy rehabilitation plan.",
      disposition: "Issued 3 days official Sick Leave Slip followed by 10 days mandatory Light Duty (ground duties only; no climbing or lifting > 10 kg).",
    },
  },
];

// ── OUTPATIENT DIAGNOSTIC DIRECTORY ───────────────────────────────────
const OUTPATIENT_LABS: OutpatientLabTest[] = [
  {
    testName: "Complete Blood Count (CBC) with 5-Part Differential",
    category: "Hematology",
    tubeColor: "Purple (K2/K3 EDTA)",
    sampleType: "Whole Venous Blood (3 mL)",
    referenceRange: "WBC: 4.0-10.0 ×10³/µL | Hb: 13.5-17.5 g/dL (M), 12.0-15.5 g/dL (F) | Plt: 150-450 ×10³/µL",
    fastingRequired: false,
    clinicalIndications: "Anemia, acute bacterial/viral infection, leukocytosis, thrombocytopenia, pre-op evaluation.",
    turnaroundTime: "25 – 35 Minutes",
  },
  {
    testName: "Fasting Blood Glucose (FBG)",
    category: "Chemistry & Metabolic",
    tubeColor: "Grey (Sodium Fluoride / Potassium Oxalate)",
    sampleType: "Fluoride Plasma (2 mL)",
    referenceRange: "Normal: 70 – 99 mg/dL | Pre-diabetes: 100 – 125 mg/dL | Diabetes: ≥ 126 mg/dL",
    fastingRequired: true,
    clinicalIndications: "Diabetes screening, monitoring glycemic control, metabolic syndrome, dizziness/sweating workup.",
    turnaroundTime: "30 Minutes",
  },
  {
    testName: "Hemoglobin A1c (Glycated Hb)",
    category: "Chemistry & Metabolic",
    tubeColor: "Purple (K2 EDTA)",
    sampleType: "Whole Blood (2 mL)",
    referenceRange: "Normal: < 5.7% | Pre-diabetes: 5.7% – 6.4% | Diabetes Target: < 7.0%",
    fastingRequired: false,
    clinicalIndications: "Long-term (3-month) glycemic control evaluation in diabetic patients.",
    turnaroundTime: "45 Minutes",
  },
  {
    testName: "Lipid Profile Panel (TC, HDL, LDL, Triglycerides)",
    category: "Chemistry & Metabolic",
    tubeColor: "Yellow / Gold (Serum Gel Separator)",
    sampleType: "Serum (3 mL)",
    referenceRange: "Total Chol: < 200 mg/dL | HDL: > 40 mg/dL (M), > 50 mg/dL (F) | LDL: < 100 mg/dL | TG: < 150 mg/dL",
    fastingRequired: true,
    clinicalIndications: "Cardiovascular risk assessment, hypertension workup, dyslipidemia monitoring.",
    turnaroundTime: "40 – 60 Minutes",
  },
  {
    testName: "Renal Function Panel (Serum Creatinine, BUN, eGFR)",
    category: "Chemistry & Metabolic",
    tubeColor: "Yellow / Gold (Serum Gel Separator)",
    sampleType: "Serum (3 mL)",
    referenceRange: "Creatinine: 0.7 – 1.3 mg/dL (M), 0.6 – 1.1 mg/dL (F) | BUN: 7 – 20 mg/dL | eGFR: > 90 mL/min/1.73m²",
    fastingRequired: false,
    clinicalIndications: "Hypertension baseline, nephropathy screening, monitoring ACE-inhibitor safety.",
    turnaroundTime: "35 Minutes",
  },
  {
    testName: "Liver Function Tests (ALT, AST, ALP, Total Bilirubin)",
    category: "Chemistry & Metabolic",
    tubeColor: "Yellow / Gold (Serum Gel Separator)",
    sampleType: "Serum (3 mL)",
    referenceRange: "ALT: 7 – 56 U/L | AST: 10 – 40 U/L | ALP: 44 – 147 U/L | Total Bilirubin: 0.2 – 1.2 mg/dL",
    fastingRequired: false,
    clinicalIndications: "Hepatotoxicity screening, chemical exposure baseline, abdominal pain, jaundice.",
    turnaroundTime: "45 Minutes",
  },
  {
    testName: "Urinalysis (10-Parameter Dipstick & Microscopic)",
    category: "Urinalysis",
    tubeColor: "Sterile Urine Cup (No additive)",
    sampleType: "Clean-Catch Midstream Urine (20 mL)",
    referenceRange: "Protein: Negative | Glucose: Negative | Leukocytes: Negative | Nitrites: Negative | RBC: 0-2/hpf",
    fastingRequired: false,
    clinicalIndications: "Urinary tract infections, nephrolithiasis, proteinuria in hypertension/diabetes.",
    turnaroundTime: "15 – 25 Minutes",
  },
  {
    testName: "Blood Film for Malaria (Thick & Thin Smear)",
    category: "Infectious & Serology",
    tubeColor: "Purple (EDTA) or Capillary Blood",
    sampleType: "Giemsa-Stained Peripheral Blood Smears",
    referenceRange: "No Plasmodium trophozoites, schizonts, or gametocytes observed.",
    fastingRequired: false,
    clinicalIndications: "Acute fever, chills, rigors, headache, travel to endemic power corridors (Afar, Somali, Benishangul).",
    turnaroundTime: "30 Minutes",
  },
  {
    testName: "Stool Routine & Wet Mount Microscopic Examination",
    category: "Microbiology",
    tubeColor: "Clean Stool Specimen Container",
    sampleType: "Fresh Stool (5 – 10 grams)",
    referenceRange: "No ova, cysts, trophozoites, parasites, pus cells, or red blood cells seen.",
    fastingRequired: false,
    clinicalIndications: "Acute/chronic diarrhea, abdominal cramps, suspected amoebiasis, giardiasis, helminthic infections.",
    turnaroundTime: "25 Minutes",
  },
];

// ── COMMON OUTPATIENT CLINICAL PROTOCOLS ──────────────────────────────
const CLINICAL_PROTOCOLS: ClinicalProtocol[] = [
  {
    id: "proto-htn",
    code: "EEU-OPD-PROT-01",
    title: "Adult Essential Hypertension Clinical Management Protocol",
    condition: "Primary Hypertension (BP ≥ 140/90 mmHg on two separate clinic visits)",
    icon: "solar:heart-pulse-bold",
    diagnosticCriteria: [
      "Normal BP: < 120/80 mmHg | Pre-Hypertension: 120-139 / 80-89 mmHg",
      "Stage 1 Hypertension: 140-159 / 90-99 mmHg (confirm on 2 separate visits)",
      "Stage 2 Hypertension: ≥ 160 / ≥ 100 mmHg (initiate immediate therapy)",
      "Hypertensive Urgency / Emergency: BP > 180/120 mmHg (screen for acute end-organ damage)",
    ],
    therapeuticSteps: [
      "Stage 1 HTN (Low Risk): 3 months lifestyle modification (DASH diet, salt < 5g/day, 150 min aerobic exercise/week).",
      "Stage 1 HTN (High Risk / Failed Lifestyle): Initiate first-line monotherapy: Calcium Channel Blocker (Amlodipine 5mg OD) or ACE-Inhibitor (Enalapril 5-10mg OD).",
      "Stage 2 HTN: Initiate upfront two-drug combination therapy: Amlodipine 5-10mg OD + Enalapril 10mg OD or Hydrochlorothiazide 12.5-25mg OD.",
      "Target BP: < 130/80 mmHg for all adult EEU personnel; < 140/90 mmHg for elderly (>65 years).",
    ],
    prescribingRules: [
      "Check baseline Serum Creatinine and Potassium before starting ACE-Inhibitors or ARBs.",
      "Warn patients starting Amlodipine about potential bilateral ankle edema (explain it is benign).",
      "Warn patients on Enalapril about dry cough; switch to Losartan 50mg OD if cough develops.",
    ],
    redFlagAlerts: "RED FLAG: If severe headache, visual blurring, chest pain, or dyspnea occurs with BP > 180/120, admit immediately to Emergency Room for IV hydralazine/labetalol.",
    lifestyleAdvice: [
      "Limit dietary sodium to < 2,000 mg/day (avoid adding extra salt to cooked meals).",
      "Engage in brisk walking or cycling minimum 30 minutes, 5 days per week.",
      "Limit caffeine and energy drinks; practice stress reduction techniques.",
    ],
  },
  {
    id: "proto-t2dm",
    code: "EEU-OPD-PROT-02",
    title: "Type 2 Diabetes Mellitus Outpatient Clinical Protocol",
    condition: "Type 2 Diabetes Mellitus (Fasting Glucose ≥ 126 mg/dL or HbA1c ≥ 6.5%)",
    icon: "solar:test-tube-bold",
    diagnosticCriteria: [
      "Fasting Blood Sugar (FBS) ≥ 126 mg/dL (after minimum 8 hours fast, confirmed on repeat test).",
      "Random Blood Sugar (RBS) ≥ 200 mg/dL in presence of classical symptoms (polyuria, polydipsia, weight loss).",
      "Hemoglobin A1c (HbA1c) ≥ 6.5% using standardized assay.",
    ],
    therapeuticSteps: [
      "First-Line Pharmacotherapy: Metformin 500mg PO BID with meals; titrate every 2 weeks to target 1000mg BID as tolerated.",
      "Dual Therapy (if HbA1c remains > 7.0% after 3 months): Add Sulfonylurea (Glibenclamide 5mg OD morning or Gliclazide 30-60mg OD).",
      "Triple Therapy / Insulin: If uncontrolled on dual oral agents, refer for basal insulin initiation.",
      "Outpatient Glycemic Targets: Pre-prandial Glucose 80-130 mg/dL | Peak Post-prandial < 180 mg/dL | HbA1c < 7.0%.",
    ],
    prescribingRules: [
      "Always instruct patient to take Metformin WITH meals to minimize gastrointestinal discomfort.",
      "Contraindication: Discontinue Metformin if eGFR < 30 mL/min/1.73m² due to lactic acidosis risk.",
      "Educate patient on symptoms of hypoglycemia (tremors, sweating, hunger, confusion) and rule of 15 (15g fast sugars).",
    ],
    redFlagAlerts: "RED FLAG: Random glucose > 300 mg/dL with ketones in urine or vomiting indicates Diabetic Ketoacidosis (DKA) or Hyperosmolar Hyperglycemic State (HHS); transfer to Inpatient ER immediately.",
    lifestyleAdvice: [
      "Medical Nutrition Therapy: replace refined white carbohydrates with teff injera, whole grains, and legumes.",
      "Annual preventive screenings: Dilated retinal exam, comprehensive foot exam with monofilament, urine microalbumin.",
    ],
  },
  {
    id: "proto-urti",
    code: "EEU-OPD-PROT-03",
    title: "Acute Respiratory Infection & Antibiotic Stewardship Protocol",
    condition: "Acute Rhinopharyngitis, Laryngitis & Viral Bronchitis",
    icon: "solar:shield-check-bold",
    diagnosticCriteria: [
      "Acute onset of cough (< 2 weeks), sore throat, clear/mucoid rhinorrhea, sneezing, and low-grade fever.",
      "Absence of tachypnea (RR < 20/min), absence of tachycardia (HR < 100 bpm), and clear lung auscultation.",
      "Use modified Centor criteria for sore throat: Fever (+1), Absence of cough (+1), Tender anterior cervical adenopathy (+1), Tonsillar exudates (+1). Score 0-1: no antibiotic needed.",
    ],
    therapeuticSteps: [
      "Overwhelming majority (> 90%) of acute bronchitis and pharyngitis cases are VIRAL in etiology.",
      "STRICT ANTIBIOTIC AVOIDANCE: Routine antibiotics (e.g. Amoxicillin, Azithromycin) are NOT indicated for uncomplicated viral colds.",
      "Symptomatic Therapy: Paracetamol 500-1000mg PO TID prn (antipyretic/analgesic) + Saline nasal drops + Warm fluids.",
      "For severe hacking dry cough: Dextromethorphan syrup 10 mL PO TID or warm honey-lemon mixtures.",
    ],
    prescribingRules: [
      "Reserve antibiotics ONLY for: Confirmed Streptococcal pharyngitis (Centor score ≥ 3), clinically diagnosed pneumonia, or high-risk COPD exacerbations.",
      "When indicated for Strep pharyngitis: Amoxicillin 500mg PO TID × 10 days.",
    ],
    redFlagAlerts: "RED FLAG: Shortness of breath, stridor, SpO2 < 94%, persistent fever > 38.5°C for > 3 days, or hemoptysis requires immediate chest imaging to rule out bacterial pneumonia.",
    lifestyleAdvice: [
      "Stay well hydrated (2.5 – 3 liters of warm liquids daily).",
      "Frequent hand washing and home isolation for 48 hours to prevent spreading across utility office departments.",
    ],
  },
  {
    id: "proto-lumbago",
    code: "EEU-OPD-PROT-04",
    title: "Acute Musculoskeletal Lumbar Strain & Ergonomics Protocol",
    condition: "Acute Low Back Pain & Mechanical Muscle Strain in Utility Workers",
    icon: "solar:body-bold",
    diagnosticCriteria: [
      "Localized pain, stiffness, and paravertebral muscle spasm across lumbar spine following physical exertion.",
      "Aggravated by bending, lifting, or prolonged sitting; relieved by recumbency with knees flexed.",
      "Absence of 'Red Flags': No bowel/bladder incontinence, no saddle anesthesia, no progressive bilateral motor weakness, no fever, no history of malignancy.",
    ],
    therapeuticSteps: [
      "First-Line Pharmacotherapy: Ibuprofen 400-600mg PO TID with food × 5 days or Paracetamol 1000mg PO TID.",
      "Severe Muscle Spasm: Add Chlorzoxazone 500mg PO BID or Methocarbamol for max 5 days.",
      "Avoid Bed Rest: Strongly advise active recovery; bed rest beyond 48 hours delays healing and weakens lumbar musculature.",
      "Physical Modalities: Apply heat pack for 20 minutes TID; commence gentle hamstring and core stretches on Day 3.",
    ],
    prescribingRules: [
      "Always co-prescribe Omeprazole 20mg OD if patient has history of dyspepsia or is taking NSAIDs > 5 days.",
      "Never prescribe opioids or benzodiazepines for uncomplicated mechanical back strain.",
    ],
    redFlagAlerts: "EMERGENCY: Sudden loss of bowel or bladder control, numbness in the saddle/groin area, or bilateral foot drop indicates Cauda Equina Syndrome; transfer for immediate neurosurgical MRI decompression.",
    lifestyleAdvice: [
      "Correct lifting mechanics: bend at knees, keep spine neutral, keep heavy loads close to chest.",
      "Recommend maximum lifting limits: 20 kg for solo manual handling.",
    ],
  },
];

// ── OUTPATIENT CLINIC ROLES ───────────────────────────────────────────
const CLINIC_ROLES: ClinicRole[] = [
  {
    role: "Receptionist",
    title: "Outpatient Clinic Receptionist & Registrar",
    icon: "solar:user-id-bold",
    color: "text-violet-600",
    bgColor: "bg-violet-50",
    badge: "Front Desk Operations",
    coreResponsibilities: [
      "Scan employee Digital Medical ID cards and verify employment status",
      "Verify registered family dependent eligibility and legal relations",
      "Check employee annual 25,000 ETB medical allowance balance",
      "Manage daily doctor consultation appointments and walk-in queue tokens",
    ],
    dailyChecklist: [
      "Ensure barcode scanner and ID card printers are operational at 08:00",
      "Authenticate arriving patients against database; zero manual unregistered slips",
      "Issue sequential token numbers to maintain orderly triage queue",
      "Direct urgent/distressed patients directly to the triage nurse immediately",
    ],
    keyModules: [
      { name: "Patients Registry", path: "/healthcare/patients" },
      { name: "Appointments Queue", path: "/healthcare/appointments" },
      { name: "Staff Medical ID Search", path: "/healthcare/occupational/staff-registry" },
    ],
  },
  {
    role: "TriageNurse",
    title: "Outpatient Triage & Staff Nurse",
    icon: "solar:heart-pulse-bold",
    color: "text-rose-600",
    bgColor: "bg-rose-50",
    badge: "Clinical Nursing Officer",
    coreResponsibilities: [
      "Accurately measure comprehensive 5-point vital signs for all OPD attendees",
      "Calculate BMI and random blood glucose for diabetic/hypertensive patients",
      "Screen for clinical red flags (hypoxemia, hypertensive crisis, high fever)",
      "Administer physician-ordered STAT outpatient injections (e.g. analgesics, tetanus toxoid)",
    ],
    dailyChecklist: [
      "Calibrate digital and manual sphygmomanometers and pulse oximeters daily",
      "Document vitals immediately into electronic Vital Signs module",
      "Escalate critical vitals (BP > 180/110 or SpO2 < 92%) verbally to attending doctor",
      "Maintain clean, sterile dressing station for minor outpatient wound care",
    ],
    keyModules: [
      { name: "Vital Signs Registry", path: "/healthcare/vital-signs" },
      { name: "Emergency Records", path: "/healthcare/emergency" },
      { name: "Prescriptions Queue", path: "/healthcare/prescriptions" },
    ],
  },
  {
    role: "Physician",
    title: "Consulting Physician / General Practitioner",
    icon: "solar:stethoscope-bold",
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    badge: "Attending Medical Doctor",
    coreResponsibilities: [
      "Conduct comprehensive diagnostic interviews and system-focused physical exams",
      "Document structured SOAP clinical notes with standardized ICD-10 diagnostic coding",
      "Order targeted outpatient laboratory diagnostic investigations",
      "Issue rational, safe electronic prescriptions adhering to national formulary guidelines",
      "Issue official Medical Sick Leave Slips and duty modifications",
    ],
    dailyChecklist: [
      "Review patient's complete medical history, previous encounters, and known drug allergies",
      "Complete SOAP clinical documentation prior to calling the next patient",
      "Review and electronically sign off on incoming diagnostic laboratory reports",
      "Counsel patients thoroughly on treatment plans and warning red flags",
    ],
    keyModules: [
      { name: "Patient Encounters (SOAP)", path: "/healthcare/encounters" },
      { name: "Diagnostic Lab Orders", path: "/healthcare/lab-tests" },
      { name: "Sick Leave Certificates", path: "/healthcare/occupational/sick-leave-certificates" },
      { name: "Hospital GOP Referrals", path: "/healthcare/occupational/guarantee-of-payment" },
    ],
  },
  {
    role: "Pharmacist",
    title: "Outpatient Dispensing Pharmacist",
    icon: "solar:pill-bold",
    color: "text-emerald-600",
    bgColor: "bg-emerald-50",
    badge: "Pharmacy Directorate",
    coreResponsibilities: [
      "Audit electronic prescriptions for safe dosing, route, and drug-drug interactions",
      "Dispense pharmaceuticals using First-Expiry-First-Out (FEFO) batch rules",
      "Provide comprehensive patient medication counseling in enterprise English",
      "Deduct medication costs from employee annual 25,000 ETB quota and print receipts",
    ],
    dailyChecklist: [
      "Inspect refrigerator temperature logs (2°C - 8°C) for vaccines and biologicals",
      "Ensure all dispensed containers are clearly labeled with dosage, frequency, and expiry",
      "Reconcile daily prescription dispensing register with stock deductions",
      "Flag low-stock inventory balances before essential formulary medications run out",
    ],
    keyModules: [
      { name: "Outpatient Dispensing", path: "/healthcare/pharmacy/outpatient" },
      { name: "Prescription Queue", path: "/healthcare/pharmacy/medication-requests" },
      { name: "Medication Formulary", path: "/healthcare/pharmacy/medications" },
      { name: "Pharmacy Stock Balances", path: "/healthcare/pharmacy/stock" },
    ],
  },
];

// ── COMPONENT ─────────────────────────────────────────────────────────
export default function ErpGuidePage() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("journey");

  // Journey state
  const [selectedStageNumber, setSelectedStageNumber] = useState<number>(1);
  const currentStage = useMemo(() => {
    return OUTPATIENT_STAGES.find((s) => s.stage === selectedStageNumber) || OUTPATIENT_STAGES[0];
  }, [selectedStageNumber]);

  // SOAP Template state
  const [selectedSoapId, setSelectedSoapId] = useState<string>("hypertension-opd");
  const currentSoap = useMemo(() => {
    return SOAP_TEMPLATES.find((t) => t.id === selectedSoapId) || SOAP_TEMPLATES[0];
  }, [selectedSoapId]);

  // Protocol state
  const [selectedProtocolId, setSelectedProtocolId] = useState<string>("proto-htn");
  const currentProtocol = useMemo(() => {
    return CLINICAL_PROTOCOLS.find((p) => p.id === selectedProtocolId) || CLINICAL_PROTOCOLS[0];
  }, [selectedProtocolId]);

  // Filtered lists
  const filteredStages = useMemo(() => {
    if (!searchTerm.trim()) return OUTPATIENT_STAGES;
    const term = searchTerm.toLowerCase();
    return OUTPATIENT_STAGES.filter(
      (s) =>
        s.title.toLowerCase().includes(term) ||
        s.phase.toLowerCase().includes(term) ||
        s.objective.toLowerCase().includes(term) ||
        s.protocol.some((p) => p.toLowerCase().includes(term))
    );
  }, [searchTerm]);

  const filteredLabs = useMemo(() => {
    if (!searchTerm.trim()) return OUTPATIENT_LABS;
    const term = searchTerm.toLowerCase();
    return OUTPATIENT_LABS.filter(
      (l) =>
        l.testName.toLowerCase().includes(term) ||
        l.category.toLowerCase().includes(term) ||
        l.clinicalIndications.toLowerCase().includes(term)
    );
  }, [searchTerm]);

  const filteredProtocols = useMemo(() => {
    if (!searchTerm.trim()) return CLINICAL_PROTOCOLS;
    const term = searchTerm.toLowerCase();
    return CLINICAL_PROTOCOLS.filter(
      (p) =>
        p.title.toLowerCase().includes(term) ||
        p.condition.toLowerCase().includes(term) ||
        p.code.toLowerCase().includes(term)
    );
  }, [searchTerm]);

  return (
    <div className="space-y-6 pb-12">
      {/* ── Header Banner ─────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-800 via-teal-900 to-slate-900 p-6 sm:p-8 text-white shadow-xl border border-emerald-700/40">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="flex items-start gap-4">
            <img
              src={eeuLogoImg}
              alt="EEU Logo"
              className="h-16 w-16 sm:h-20 sm:w-20 rounded-2xl bg-white p-2 shadow-md shrink-0 border border-white/20"
            />
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-400/30 text-xs font-semibold">
                  Health Services Directorate
                </Badge>
                <Badge className="bg-blue-500/20 text-blue-300 border-blue-400/30 text-xs font-semibold">
                  Outpatient Department (OPD) Manual
                </Badge>
                <span className="text-xs text-emerald-200/80">Primary Care Standard</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                EEU Outpatient Clinical Practice Guide
              </h1>
              <p className="mt-1 text-sm text-emerald-100/90 max-w-3xl leading-relaxed">
                Comprehensive clinical standards, step-by-step outpatient consultation journeys, SOAP encounter documentation guidelines, diagnostic laboratory ordering directories, and pharmacy e-prescribing rules for Ethiopian Electric Utility medical clinics.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <Button
              onClick={() => navigate("/healthcare/encounters")}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-sm transition-all"
            >
              <Icon icon="solar:notes-bold-duotone" size={18} className="mr-1.5" />
              Conduct Consultation
            </Button>
            <Button
              onClick={() => navigate("/healthcare/vital-signs")}
              className="bg-white/10 hover:bg-white/20 text-white font-semibold border border-white/20"
            >
              <Icon icon="solar:heart-pulse-bold-duotone" size={18} className="mr-1.5" />
              Triage Vitals
            </Button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="mt-6 pt-5 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative w-full sm:max-w-md">
            <Icon
              icon="solar:magnifer-linear"
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-white/50"
            />
            <Input
              type="text"
              placeholder="Search outpatient stages, SOAP notes, lab tests, prescriptions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 bg-white/10 border-white/20 text-white placeholder:text-white/50 focus-visible:bg-white/15 focus-visible:border-emerald-400"
            />
          </div>
          {searchTerm && (
            <div className="flex items-center gap-2 text-xs text-emerald-200">
              <span>Filtering for "{searchTerm}"</span>
              <button onClick={() => setSearchTerm("")} className="underline hover:text-white">
                Clear
              </button>
            </div>
          )}
          <div className="hidden lg:flex items-center gap-4 text-xs text-emerald-200/80">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-400" /> 7 Outpatient Stages
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-blue-400" /> 3 SOAP Clinical Templates
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-cyan-400" /> 9 Diagnostic Panels
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-purple-400" /> 4 Outpatient Protocols
            </span>
          </div>
        </div>
      </div>

      {/* ── Main Navigation Tabs ─────────────────────────────────── */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-muted/60 p-1 rounded-xl border flex flex-wrap h-auto gap-1">
          <TabsTrigger
            value="journey"
            className="flex items-center gap-2 py-2 px-4 rounded-lg data-[state=active]:bg-white data-[state=active]:text-emerald-800 data-[state=active]:shadow-sm font-semibold text-xs sm:text-sm"
          >
            <Icon icon="solar:round-transfer-vertical-bold-duotone" size={18} />
            <span>Outpatient Journey</span>
            <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0 h-4">7 Stages</Badge>
          </TabsTrigger>
          <TabsTrigger
            value="soap"
            className="flex items-center gap-2 py-2 px-4 rounded-lg data-[state=active]:bg-white data-[state=active]:text-emerald-800 data-[state=active]:shadow-sm font-semibold text-xs sm:text-sm"
          >
            <Icon icon="solar:document-text-bold-duotone" size={18} />
            <span>SOAP Documentation</span>
            <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0 h-4">Templates</Badge>
          </TabsTrigger>
          <TabsTrigger
            value="diagnostics"
            className="flex items-center gap-2 py-2 px-4 rounded-lg data-[state=active]:bg-white data-[state=active]:text-emerald-800 data-[state=active]:shadow-sm font-semibold text-xs sm:text-sm"
          >
            <Icon icon="solar:test-tube-bold-duotone" size={18} />
            <span>Diagnostic Lab Directory</span>
            <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0 h-4">9 Panels</Badge>
          </TabsTrigger>
          <TabsTrigger
            value="pharmacy"
            className="flex items-center gap-2 py-2 px-4 rounded-lg data-[state=active]:bg-white data-[state=active]:text-emerald-800 data-[state=active]:shadow-sm font-semibold text-xs sm:text-sm"
          >
            <Icon icon="solar:pill-bold-duotone" size={18} />
            <span>E-Prescribing & Formulary</span>
          </TabsTrigger>
          <TabsTrigger
            value="protocols"
            className="flex items-center gap-2 py-2 px-4 rounded-lg data-[state=active]:bg-white data-[state=active]:text-emerald-800 data-[state=active]:shadow-sm font-semibold text-xs sm:text-sm"
          >
            <Icon icon="solar:stethoscope-bold" size={18} />
            <span>Clinical Algorithms</span>
            <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0 h-4">4</Badge>
          </TabsTrigger>
          <TabsTrigger
            value="roles"
            className="flex items-center gap-2 py-2 px-4 rounded-lg data-[state=active]:bg-white data-[state=active]:text-emerald-800 data-[state=active]:shadow-sm font-semibold text-xs sm:text-sm"
          >
            <Icon icon="solar:users-group-rounded-bold-duotone" size={18} />
            <span>Clinic Roles & Duties</span>
          </TabsTrigger>
        </TabsList>

        {/* ══════════════════════════════════════════════════════════
            TAB 1: END-TO-END OUTPATIENT PATIENT JOURNEY
        ══════════════════════════════════════════════════════════ */}
        <TabsContent value="journey" className="space-y-6">
          <div>
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-foreground">Outpatient Clinical Patient Journey</h2>
                <p className="text-xs text-muted-foreground">
                  The standard 7-stage pathway for every patient attending an Ethiopian Electric Utility healthcare clinic.
                </p>
              </div>
              <Badge variant="outline" className="text-xs font-medium">
                Stage {currentStage.stage} of {OUTPATIENT_STAGES.length}
              </Badge>
            </div>

            {/* Stepper Navigation */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 mb-4">
              {filteredStages.map((s) => {
                const isSelected = s.stage === currentStage.stage;
                const isCompleted = s.stage < currentStage.stage;
                return (
                  <button
                    key={s.stage}
                    onClick={() => setSelectedStageNumber(s.stage)}
                    className={`flex flex-col text-left p-3 rounded-xl border transition-all ${
                      isSelected
                        ? "border-emerald-600 bg-emerald-50/70 shadow-md ring-2 ring-emerald-500/20"
                        : isCompleted
                        ? "border-emerald-200 bg-emerald-50/20 hover:bg-emerald-50/40"
                        : "border-border/80 bg-card hover:bg-muted/40"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span
                        className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                          isSelected
                            ? "bg-emerald-600 text-white"
                            : isCompleted
                            ? "bg-emerald-200 text-emerald-800"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {isCompleted ? <Icon icon="solar:check-read-linear" size={12} /> : s.stage}
                      </span>
                      <span className="text-[10px] text-muted-foreground">{s.duration}</span>
                    </div>
                    <span className="text-[10px] font-bold uppercase text-emerald-700 tracking-wider">
                      {s.phase}
                    </span>
                    <span className={`text-xs font-bold mt-0.5 line-clamp-2 ${isSelected ? "text-emerald-950" : "text-foreground"}`}>
                      {s.title}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Selected Stage Detail Card */}
            <Card className="border-emerald-200/70 shadow-lg overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-emerald-50 via-teal-50 to-white border-b pb-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-600 text-white font-extrabold text-base shadow-sm shrink-0">
                      {currentStage.stage}
                    </span>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className="bg-emerald-700 text-white text-xs">{currentStage.phase}</Badge>
                        <Badge variant="outline" className="text-xs">{currentStage.duration}</Badge>
                      </div>
                      <h3 className="text-xl font-bold text-foreground">{currentStage.title}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5 max-w-3xl leading-relaxed">
                        {currentStage.objective}
                      </p>
                    </div>
                  </div>

                  <div className="shrink-0 text-left sm:text-right">
                    <span className="text-[10px] text-muted-foreground uppercase font-semibold block">Responsible Actor</span>
                    <Badge variant="secondary" className="font-semibold text-xs text-foreground bg-white border shadow-xs">
                      <Icon icon="solar:user-bold" size={12} className="mr-1 text-emerald-600" />
                      {currentStage.actor}
                    </Badge>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="pt-6 space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Left 2 Cols: Clinical & Administrative Protocol */}
                  <div className="lg:col-span-2 space-y-4">
                    <div className="flex items-center gap-2">
                      <Icon icon="solar:clipboard-check-bold" size={18} className="text-emerald-600" />
                      <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Standard Operational & Clinical Protocol Steps
                      </h4>
                    </div>

                    <ul className="space-y-2.5">
                      {currentStage.protocol.map((step, i) => (
                        <li
                          key={i}
                          className="flex items-start gap-3 text-xs text-foreground/90 p-3 rounded-xl bg-muted/30 border border-border/40 leading-relaxed"
                        >
                          <span className="flex h-5 w-5 items-center justify-center rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-bold shrink-0 mt-0.5">
                            {i + 1}
                          </span>
                          <span>{step}</span>
                        </li>
                      ))}
                    </ul>

                    <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-200/70 text-emerald-900 text-xs font-medium">
                      <Icon icon="solar:shield-check-bold" size={16} className="text-emerald-700 shrink-0" />
                      <span><strong>Quality Benchmark:</strong> {currentStage.qualityMetric}</span>
                    </div>
                  </div>

                  {/* Right 1 Col: System Module & Artifacts */}
                  <div className="space-y-4 p-5 rounded-2xl bg-muted/20 border border-border/60">
                    <div>
                      <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block mb-1">
                        System Module Action
                      </span>
                      <p className="text-xs font-medium text-foreground leading-relaxed">
                        {currentStage.systemAction}
                      </p>
                    </div>

                    <div>
                      <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block mb-1">
                        Generated Clinical Record
                      </span>
                      <div className="flex items-center gap-2 p-2.5 rounded-lg bg-card border text-xs font-semibold text-foreground">
                        <Icon icon="solar:document-bold" size={16} className="text-emerald-600 shrink-0" />
                        <span>{currentStage.documentGenerated}</span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-border/50">
                      <Button
                        onClick={() => navigate(currentStage.systemPath)}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-sm"
                      >
                        <Icon icon="solar:link-circle-bold" size={16} className="mr-1.5" />
                        Open {currentStage.phase} in System
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Stepper Previous / Next Controls */}
                <div className="pt-4 border-t border-border/60 flex items-center justify-between">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentStage.stage === 1}
                    onClick={() => setSelectedStageNumber((prev) => Math.max(1, prev - 1))}
                    className="text-xs"
                  >
                    <Icon icon="solar:arrow-left-linear" size={14} className="mr-1" />
                    Previous Stage
                  </Button>

                  <span className="text-xs text-muted-foreground font-medium">
                    Stage {currentStage.stage} of {OUTPATIENT_STAGES.length}
                  </span>

                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentStage.stage === OUTPATIENT_STAGES.length}
                    onClick={() =>
                      setSelectedStageNumber((prev) =>
                        Math.min(OUTPATIENT_STAGES.length, prev + 1)
                      )
                    }
                    className="text-xs text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                  >
                    Next Stage
                    <Icon icon="solar:arrow-right-linear" size={14} className="ml-1" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ══════════════════════════════════════════════════════════
            TAB 2: SOAP ENCOUNTER DOCUMENTATION MANUAL & TEMPLATES
        ══════════════════════════════════════════════════════════ */}
        <TabsContent value="soap" className="space-y-6">
          <div>
            <div className="mb-4">
              <h2 className="text-lg font-bold text-foreground">SOAP Encounter Clinical Documentation Standards</h2>
              <p className="text-xs text-muted-foreground">
                The authoritative SOAP framework for outpatient clinical consultations, including real-world clinical case encounters from EEU staff clinics.
              </p>
            </div>

            {/* Template Selector Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
              {SOAP_TEMPLATES.map((tmpl) => {
                const isSelected = tmpl.id === currentSoap.id;
                return (
                  <button
                    key={tmpl.id}
                    onClick={() => setSelectedSoapId(tmpl.id)}
                    className={`text-left p-4 rounded-xl border transition-all ${
                      isSelected
                        ? "border-blue-600 bg-blue-50/70 shadow-md ring-2 ring-blue-500/20"
                        : "border-border/80 bg-card hover:bg-muted/40"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-[10px]">
                        ICD-10: {tmpl.icdCode}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground font-medium">{tmpl.category}</span>
                    </div>
                    <h3 className={`text-sm font-bold ${isSelected ? "text-blue-950" : "text-foreground"}`}>
                      {tmpl.diagnosis}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {tmpl.chiefComplaint}
                    </p>
                  </button>
                );
              })}
            </div>

            {/* Selected SOAP Template Detailed Inspector */}
            <Card className="border-blue-200/80 shadow-md overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-blue-50 via-slate-50 to-white border-b pb-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className="bg-blue-700 text-white text-xs">Primary Care Case Study</Badge>
                      <Badge variant="outline" className="text-xs">ICD-10: {currentSoap.icdCode}</Badge>
                      <span className="text-xs text-muted-foreground">{currentSoap.category}</span>
                    </div>
                    <h3 className="text-xl font-extrabold text-foreground">{currentSoap.diagnosis}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      <strong>Patient:</strong> {currentSoap.patientDemographics}
                    </p>
                  </div>

                  <Button
                    onClick={() => navigate("/healthcare/encounters")}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shrink-0"
                  >
                    <Icon icon="solar:notes-bold" size={16} className="mr-1.5" />
                    Open Encounters Screen
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="pt-6 space-y-6">
                {/* 4 SOAP Quadrants */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* S - SUBJECTIVE */}
                  <div className="rounded-xl border border-blue-200/80 bg-blue-50/20 p-5 space-y-3">
                    <div className="flex items-center gap-2 pb-2 border-b border-blue-200/60">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-white font-extrabold text-xs">
                        S
                      </span>
                      <div>
                        <h4 className="text-sm font-bold text-blue-950">Subjective (S)</h4>
                        <span className="text-[10px] text-muted-foreground">Patient narrative & OPQRST history</span>
                      </div>
                    </div>
                    <div className="space-y-2 text-xs">
                      <div>
                        <strong className="text-foreground block text-[11px] mb-0.5">Chief Complaint:</strong>
                        <p className="text-muted-foreground italic">"{currentSoap.chiefComplaint}"</p>
                      </div>
                      <div>
                        <strong className="text-foreground block text-[11px] mb-0.5">History of Present Illness (HPI):</strong>
                        <p className="text-muted-foreground leading-relaxed">{currentSoap.subjective.hpi}</p>
                      </div>
                      <div>
                        <strong className="text-foreground block text-[11px] mb-0.5">Past Medical History (PMHx):</strong>
                        <p className="text-muted-foreground">{currentSoap.subjective.pmhx}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <div>
                          <strong className="text-foreground block text-[10px]">Current Meds:</strong>
                          <span className="text-muted-foreground">{currentSoap.subjective.medications}</span>
                        </div>
                        <div>
                          <strong className="text-foreground block text-[10px]">Allergies:</strong>
                          <span className="text-rose-600 font-semibold">{currentSoap.subjective.allergies}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* O - OBJECTIVE */}
                  <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/20 p-5 space-y-3">
                    <div className="flex items-center gap-2 pb-2 border-b border-emerald-200/60">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-600 text-white font-extrabold text-xs">
                        O
                      </span>
                      <div>
                        <h4 className="text-sm font-bold text-emerald-950">Objective (O)</h4>
                        <span className="text-[10px] text-muted-foreground">Physical exam & recorded vitals</span>
                      </div>
                    </div>
                    <div className="space-y-2 text-xs">
                      <div className="p-2 rounded-lg bg-card border text-[11px] font-mono text-emerald-900">
                        <strong>Vitals:</strong> {currentSoap.objective.vitals}
                      </div>
                      <div>
                        <strong className="text-foreground block text-[11px] mb-0.5">General & HEENT:</strong>
                        <p className="text-muted-foreground">{currentSoap.objective.general} {currentSoap.objective.heent}</p>
                      </div>
                      <div>
                        <strong className="text-foreground block text-[11px] mb-0.5">Cardiovascular & Respiratory:</strong>
                        <p className="text-muted-foreground">{currentSoap.objective.cardiovascular} {currentSoap.objective.respiratory}</p>
                      </div>
                      <div>
                        <strong className="text-foreground block text-[11px] mb-0.5">Abdomen & Musculoskeletal:</strong>
                        <p className="text-muted-foreground">{currentSoap.objective.abdomen} {currentSoap.objective.musculoskeletal}</p>
                      </div>
                    </div>
                  </div>

                  {/* A - ASSESSMENT */}
                  <div className="rounded-xl border border-amber-200/80 bg-amber-50/20 p-5 space-y-3">
                    <div className="flex items-center gap-2 pb-2 border-b border-amber-200/60">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-600 text-white font-extrabold text-xs">
                        A
                      </span>
                      <div>
                        <h4 className="text-sm font-bold text-amber-950">Assessment (A)</h4>
                        <span className="text-[10px] text-muted-foreground">Diagnostic coding & differentials</span>
                      </div>
                    </div>
                    <div className="space-y-2 text-xs">
                      <div className="p-2 rounded-lg bg-card border">
                        <span className="text-[10px] font-bold text-amber-800 uppercase block">Primary Clinical Diagnosis</span>
                        <p className="text-sm font-bold text-foreground mt-0.5">{currentSoap.assessment.primary}</p>
                      </div>
                      <div>
                        <strong className="text-foreground block text-[11px] mb-1">Comorbidities:</strong>
                        <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
                          {currentSoap.assessment.secondary.map((sec, i) => (
                            <li key={i}>{sec}</li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <strong className="text-foreground block text-[11px] mb-1">Differential Diagnoses Considered:</strong>
                        <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
                          {currentSoap.assessment.differential.map((diff, i) => (
                            <li key={i}>{diff}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>

                  {/* P - PLAN */}
                  <div className="rounded-xl border border-purple-200/80 bg-purple-50/20 p-5 space-y-3">
                    <div className="flex items-center gap-2 pb-2 border-b border-purple-200/60">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-600 text-white font-extrabold text-xs">
                        P
                      </span>
                      <div>
                        <h4 className="text-sm font-bold text-purple-950">Plan (P)</h4>
                        <span className="text-[10px] text-muted-foreground">Diagnostics, Rx & follow-up</span>
                      </div>
                    </div>
                    <div className="space-y-2.5 text-xs">
                      <div>
                        <strong className="text-foreground block text-[11px] mb-1">Diagnostic Investigations:</strong>
                        <ul className="space-y-1">
                          {currentSoap.plan.diagnostics.map((diag, i) => (
                            <li key={i} className="flex items-center gap-1.5 text-muted-foreground">
                              <Icon icon="solar:test-tube-bold" size={13} className="text-purple-600 shrink-0" />
                              <span>{diag}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <strong className="text-foreground block text-[11px] mb-1">Therapeutic Prescriptions:</strong>
                        <ul className="space-y-1">
                          {currentSoap.plan.medications.map((med, i) => (
                            <li key={i} className="flex items-center gap-1.5 text-muted-foreground">
                              <Icon icon="solar:pill-bold" size={13} className="text-emerald-600 shrink-0" />
                              <span>{med}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="p-2 rounded-lg bg-card border text-[11px]">
                        <strong>Disposition & Follow-Up:</strong> {currentSoap.plan.followUp} — <em>{currentSoap.plan.disposition}</em>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ══════════════════════════════════════════════════════════
            TAB 3: OUTPATIENT DIAGNOSTIC & LAB DIRECTORY
        ══════════════════════════════════════════════════════════ */}
        <TabsContent value="diagnostics" className="space-y-6">
          <div>
            <div className="mb-4">
              <h2 className="text-lg font-bold text-foreground">Outpatient Diagnostic Pathology Directory</h2>
              <p className="text-xs text-muted-foreground">
                Specimen collection tubes, normal biological reference intervals, patient fasting requirements, and clinical indications for routine OPD investigations.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredLabs.map((lab, i) => (
                <Card key={i} className="border-border/80 hover:border-cyan-300 transition-all flex flex-col justify-between shadow-sm">
                  <CardHeader className="pb-3 border-b bg-muted/20">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <Badge className="bg-cyan-100 text-cyan-800 border-cyan-200 text-[10px] mb-1">
                          {lab.category}
                        </Badge>
                        <h3 className="text-sm font-bold text-foreground leading-snug">{lab.testName}</h3>
                      </div>
                      {lab.fastingRequired && (
                        <Badge variant="outline" className="text-[10px] border-amber-300 bg-amber-50 text-amber-800 shrink-0">
                          Fasting Required
                        </Badge>
                      )}
                    </div>
                  </CardHeader>

                  <CardContent className="pt-4 space-y-3 flex-1 flex flex-col justify-between text-xs">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between p-2 rounded-lg bg-muted/30 border border-border/40">
                        <span className="text-muted-foreground text-[11px]">Sample Tube:</span>
                        <span className="font-semibold text-foreground text-[11px]">{lab.tubeColor}</span>
                      </div>

                      <div>
                        <strong className="text-muted-foreground block text-[10px] uppercase">Normal Reference Range:</strong>
                        <p className="font-mono text-[11px] text-emerald-800 font-semibold mt-0.5 leading-relaxed">
                          {lab.referenceRange}
                        </p>
                      </div>

                      <div>
                        <strong className="text-muted-foreground block text-[10px] uppercase">Clinical Indications:</strong>
                        <p className="text-muted-foreground mt-0.5 leading-relaxed">{lab.clinicalIndications}</p>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-border/50 flex items-center justify-between text-[11px]">
                      <span className="text-muted-foreground">Turnaround: <strong>{lab.turnaroundTime}</strong></span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate("/healthcare/lab-tests")}
                        className="h-6 text-[11px] text-cyan-700 hover:text-cyan-800 hover:bg-cyan-50 px-2"
                      >
                        Order Test
                        <Icon icon="solar:arrow-right-linear" size={12} className="ml-1" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* ══════════════════════════════════════════════════════════
            TAB 4: PHARMACY & E-PRESCRIBING STANDARDS
        ══════════════════════════════════════════════════════════ */}
        <TabsContent value="pharmacy" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2 Cols: Prescribing Guidelines */}
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader className="pb-3 border-b">
                  <div className="flex items-center gap-2">
                    <Icon icon="solar:document-medicine-bold" size={20} className="text-emerald-600" />
                    <div>
                      <h3 className="text-base font-bold text-foreground">Standard Prescription Frequency Latin Abbreviations</h3>
                      <p className="text-xs text-muted-foreground">Universal clinical notation used in EEU outpatient e-prescribing.</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="p-3 rounded-lg border bg-muted/20">
                      <span className="font-mono font-bold text-emerald-800 text-sm block">OD / QD</span>
                      <span className="text-muted-foreground text-[11px]">Once daily (every 24 hours)</span>
                    </div>
                    <div className="p-3 rounded-lg border bg-muted/20">
                      <span className="font-mono font-bold text-emerald-800 text-sm block">BID</span>
                      <span className="text-muted-foreground text-[11px]">Twice daily (every 12 hours)</span>
                    </div>
                    <div className="p-3 rounded-lg border bg-muted/20">
                      <span className="font-mono font-bold text-emerald-800 text-sm block">TID</span>
                      <span className="text-muted-foreground text-[11px]">Three times daily (every 8h)</span>
                    </div>
                    <div className="p-3 rounded-lg border bg-muted/20">
                      <span className="font-mono font-bold text-emerald-800 text-sm block">QID</span>
                      <span className="text-muted-foreground text-[11px]">Four times daily (every 6h)</span>
                    </div>
                    <div className="p-3 rounded-lg border bg-muted/20">
                      <span className="font-mono font-bold text-blue-800 text-sm block">PRN</span>
                      <span className="text-muted-foreground text-[11px]">As needed for specific symptom</span>
                    </div>
                    <div className="p-3 rounded-lg border bg-muted/20">
                      <span className="font-mono font-bold text-blue-800 text-sm block">STAT</span>
                      <span className="text-muted-foreground text-[11px]">Immediately / single dose</span>
                    </div>
                    <div className="p-3 rounded-lg border bg-muted/20">
                      <span className="font-mono font-bold text-purple-800 text-sm block">AC / PC</span>
                      <span className="text-muted-foreground text-[11px]">Before meals / After meals</span>
                    </div>
                    <div className="p-3 rounded-lg border bg-muted/20">
                      <span className="font-mono font-bold text-purple-800 text-sm block">HS</span>
                      <span className="text-muted-foreground text-[11px]">At bedtime (hora somni)</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Safety Rules Card */}
              <Card>
                <CardHeader className="pb-3 border-b">
                  <h3 className="text-base font-bold text-foreground">Safe E-Prescribing Clinical Rules</h3>
                </CardHeader>
                <CardContent className="pt-4 space-y-3 text-xs leading-relaxed text-foreground/85">
                  <div className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-50 border border-amber-200/70 text-amber-900">
                    <Icon icon="solar:danger-triangle-bold" size={16} className="text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <strong>Avoid Dangerous Abbreviations:</strong> Never use 'U' for units (write 'units'), never use trailing zeros (write '5 mg', never '5.0 mg'), and never omit leading zeros (write '0.5 mg', never '.5 mg').
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5 p-3 rounded-lg bg-blue-50 border border-blue-200/70 text-blue-900">
                    <Icon icon="solar:info-circle-bold" size={16} className="text-blue-600 shrink-0 mt-0.5" />
                    <div>
                      <strong>Clear Duration of Therapy:</strong> Every prescription order must explicitly declare duration in days (e.g. 'Amoxicillin-Clavulanate 625mg PO TID × 7 days').
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5 p-3 rounded-lg bg-emerald-50 border border-emerald-200/70 text-emerald-900">
                    <Icon icon="solar:shield-check-bold" size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <strong>Allergy Cross-Check:</strong> The system automatically cross-references active drug ingredients against recorded allergies (e.g. Penicillin anaphylaxis). Never override an allergy alert without clinical re-verification.
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right 1 Col: Benefit Quota Deduction */}
            <div className="space-y-4">
              <Card className="border-emerald-200/80 bg-gradient-to-br from-emerald-50/50 to-white">
                <CardHeader className="pb-3 border-b">
                  <h3 className="text-base font-bold text-emerald-950">Employee Medical Benefit Quota</h3>
                  <p className="text-xs text-muted-foreground">Annual allowance rules & dispensing deduction</p>
                </CardHeader>
                <CardContent className="pt-4 space-y-3 text-xs">
                  <div className="p-3 rounded-xl bg-card border space-y-1">
                    <span className="text-[10px] text-muted-foreground uppercase font-bold block">Annual Ceiling</span>
                    <span className="text-xl font-extrabold text-emerald-700">25,000 ETB</span>
                    <span className="text-[11px] text-muted-foreground block">per permanent staff member / year</span>
                  </div>

                  <ul className="space-y-2 text-muted-foreground leading-relaxed">
                    <li className="flex items-start gap-2">
                      <Icon icon="solar:check-circle-bold" size={14} className="text-emerald-600 shrink-0 mt-0.5" />
                      <span>Formulary generic medications are cost-tallied at institutional wholesale rates.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Icon icon="solar:check-circle-bold" size={14} className="text-emerald-600 shrink-0 mt-0.5" />
                      <span>Amount is deducted automatically upon outpatient dispensing sign-off.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Icon icon="solar:check-circle-bold" size={14} className="text-emerald-600 shrink-0 mt-0.5" />
                      <span>Family ceiling extends up to 50,000 ETB for registered dependents.</span>
                    </li>
                  </ul>

                  <Button
                    onClick={() => navigate("/healthcare/pharmacy/outpatient")}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs mt-2"
                  >
                    <Icon icon="solar:pill-bold" size={16} className="mr-1.5" />
                    Open Outpatient Dispensing
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* ══════════════════════════════════════════════════════════
            TAB 5: COMMON CLINICAL PROTOCOLS
        ══════════════════════════════════════════════════════════ */}
        <TabsContent value="protocols" className="space-y-6">
          <div>
            <div className="mb-4">
              <h2 className="text-lg font-bold text-foreground">Common Outpatient Clinical Algorithms</h2>
              <p className="text-xs text-muted-foreground">
                Evidence-based management pathways for the most prevalent conditions seen at EEU primary care clinics.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6">
              {filteredProtocols.map((proto) => {
                const isSelected = proto.id === currentProtocol.id;
                return (
                  <button
                    key={proto.id}
                    onClick={() => setSelectedProtocolId(proto.id)}
                    className={`text-left p-4 rounded-xl border transition-all ${
                      isSelected
                        ? "border-emerald-600 bg-emerald-50/70 shadow-md ring-2 ring-emerald-500/20"
                        : "border-border/80 bg-card hover:bg-muted/40"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-mono text-[10px] font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded">
                        {proto.code}
                      </span>
                    </div>
                    <h3 className={`text-sm font-bold ${isSelected ? "text-emerald-950" : "text-foreground"}`}>
                      {proto.title}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{proto.condition}</p>
                  </button>
                );
              })}
            </div>

            {/* Protocol Detail Inspector */}
            <Card className="border-emerald-200/80 shadow-md">
              <CardHeader className="bg-gradient-to-r from-emerald-50 via-teal-50 to-white border-b pb-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <span className="font-mono text-xs font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded mb-1 inline-block">
                      {currentProtocol.code}
                    </span>
                    <h3 className="text-xl font-bold text-foreground">{currentProtocol.title}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{currentProtocol.condition}</p>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="pt-6 space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Diagnostic Criteria */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Icon icon="solar:check-circle-bold" size={16} className="text-emerald-600" />
                      Diagnostic & Classification Criteria
                    </h4>
                    <ul className="space-y-2 text-xs">
                      {currentProtocol.diagnosticCriteria.map((crit, i) => (
                        <li key={i} className="p-2.5 rounded-lg bg-muted/30 border border-border/40 text-foreground/90 leading-relaxed">
                          {crit}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Therapeutic Steps */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Icon icon="solar:pill-bold" size={16} className="text-blue-600" />
                      Standard Stepwise Pharmacotherapy
                    </h4>
                    <ul className="space-y-2 text-xs">
                      {currentProtocol.therapeuticSteps.map((step, i) => (
                        <li key={i} className="p-2.5 rounded-lg bg-muted/30 border border-border/40 text-foreground/90 leading-relaxed">
                          {step}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Red Flag Alert Banner */}
                <div className="p-4 rounded-xl bg-red-50 border border-red-200/80 text-red-950 text-xs leading-relaxed flex items-start gap-3">
                  <Icon icon="solar:danger-triangle-bold" size={20} className="text-red-600 shrink-0 mt-0.5" />
                  <div>{currentProtocol.redFlagAlerts}</div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ══════════════════════════════════════════════════════════
            TAB 6: OUTPATIENT CLINIC ROLES & DUTIES
        ══════════════════════════════════════════════════════════ */}
        <TabsContent value="roles" className="space-y-6">
          <div>
            <div className="mb-4">
              <h2 className="text-lg font-bold text-foreground">Outpatient Clinical Team Responsibilities</h2>
              <p className="text-xs text-muted-foreground">
                Daily operational task checklists, core responsibilities, and system module shortcuts by health role.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {CLINIC_ROLES.map((cr) => (
                <Card key={cr.role} className="border-border/80 flex flex-col justify-between shadow-sm">
                  <CardHeader className="pb-3 border-b bg-muted/20">
                    <div className="flex items-start gap-3">
                      <div className={`p-2.5 rounded-xl ${cr.bgColor} shrink-0`}>
                        <Icon icon={cr.icon} size={22} className={cr.color} />
                      </div>
                      <div>
                        <Badge variant="outline" className="text-[10px] mb-1 font-semibold">
                          {cr.badge}
                        </Badge>
                        <h3 className="text-sm font-bold text-foreground leading-snug">{cr.title}</h3>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="pt-4 space-y-4 flex-1 flex flex-col justify-between text-xs">
                    <div className="space-y-3">
                      <div>
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                          Core Responsibilities:
                        </span>
                        <ul className="space-y-1 text-muted-foreground">
                          {cr.coreResponsibilities.slice(0, 3).map((r, i) => (
                            <li key={i} className="flex items-start gap-1.5 leading-relaxed">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0 mt-1.5" />
                              <span>{r}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div>
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                          Daily Checklist:
                        </span>
                        <ul className="space-y-1 text-muted-foreground">
                          {cr.dailyChecklist.slice(0, 2).map((d, i) => (
                            <li key={i} className="flex items-start gap-1.5 leading-relaxed italic text-[11px]">
                              <Icon icon="solar:check-read-linear" size={13} className="text-emerald-600 shrink-0 mt-0.5" />
                              <span>{d}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-border/50">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
                        Key Modules:
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {cr.keyModules.map((km, i) => (
                          <Button
                            key={i}
                            variant="secondary"
                            size="sm"
                            onClick={() => navigate(km.path)}
                            className="h-6 text-[10px] font-medium px-2 bg-muted hover:bg-emerald-50 hover:text-emerald-800"
                          >
                            {km.name}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
