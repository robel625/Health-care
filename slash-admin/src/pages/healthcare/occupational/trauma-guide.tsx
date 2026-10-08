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
interface WorkflowStep {
  step: number;
  phase: string;
  title: string;
  actor: string;
  actorRole: string;
  protocol: string[];
  systemAction: string;
  systemPath: string;
  documentGenerated: string;
  keyMetric?: string;
}

interface OccupationalWorkflow {
  id: string;
  title: string;
  category: "Substation Trauma" | "Electrical Safety" | "Toxic Exposure" | "Lineman Fitness";
  badgeColor: string;
  icon: string;
  duration: string;
  summary: string;
  trigger: string;
  outcome: string;
  steps: WorkflowStep[];
}

const OCCUPATIONAL_WORKFLOWS: OccupationalWorkflow[] = [
  {
    id: "substation-trauma",
    title: "Substation High-Voltage Flashover & Emergency Trauma Dispatch",
    category: "Substation Trauma",
    badgeColor: "bg-red-100 text-red-700 border-red-200",
    icon: "solar:danger-triangle-bold-duotone",
    duration: "15 – 45 Minutes (Critical Response)",
    summary:
      "Rapid cascade workflow triggered when high-voltage electrical flashover, arc blast, or transmission tower fall occurs at any EEU substation or power corridor.",
    trigger: "Electrical arc flash, severe shock (>1kV – 400kV), or high-altitude fall at substation.",
    outcome: "Casualty stabilization, real-time central clinic prep, and urgent tertiary transfer to ALERT Burn Unit.",
    steps: [
      {
        step: 1,
        phase: "Field Alert & Isolation",
        title: "Substation SOS Emergency Trigger",
        actor: "Substation Shift Lead / First-Aider",
        actorRole: "Field First-Aider",
        protocol: [
          "Ensure scene safety and isolate power source via lockout/tagout (LOTO) breaker if accessible.",
          "Assess casualty responsiveness and airway; never apply cold water or ice to severe high-voltage burns.",
          "Open Substation Emergency SOS console and broadcast incident with voltage level, hazard type, and casualty count.",
        ],
        systemAction: "Create urgent SOS dispatch entry on central triage board.",
        systemPath: "/healthcare/occupational/emergency-sos",
        documentGenerated: "Substation Emergency SOS Record (Unique SOS ID)",
        keyMetric: "Response Target: < 3 minutes from incident",
      },
      {
        step: 2,
        phase: "Central Telemetry & Pre-Arrival",
        title: "Central Clinic Trauma Preparation",
        actor: "Emergency Triage Officer / Paramedic Dispatch",
        actorRole: "Central Health Directorate",
        protocol: [
          "Pulsating Pre-Arrival Alert flashes on Central Health Dashboard with ETA countdown.",
          "Prepare Trauma Bay: high-flow oxygen, 16G large-bore IV lines, Ringer's Lactate, sterile burn sheets, and 12-lead ECG monitor.",
          "Dispatch dedicated EEU ambulance with trauma paramedic and AED defibrillator to substation site.",
        ],
        systemAction: "Acknowledge SOS; transition status to 'Active / En Route' with live ETA tracker.",
        systemPath: "/healthcare/occupational/emergency-sos",
        documentGenerated: "Trauma Bay Pre-Arrival Checklist",
        keyMetric: "Ambulance Rollout: < 5 minutes",
      },
      {
        step: 3,
        phase: "Mobile Stabilization",
        title: "En-Route Paramedic Resuscitation",
        actor: "Ambulance Paramedic / Emergency Nurse",
        actorRole: "Mobile Trauma Crew",
        protocol: [
          "Maintain inline cervical spine stabilization; administer 100% humidified oxygen via non-rebreather mask.",
          "Calculate initial Parkland fluid resuscitation rate (4 mL × kg × %TBSA burn) for electrical thermal injury.",
          "Monitor cardiac rhythm continuously: high-voltage AC current carries extreme risk of delayed ventricular fibrillation.",
        ],
        systemAction: "Update casualty vitals and transit status via mobile telemetry log.",
        systemPath: "/healthcare/vital-signs",
        documentGenerated: "Paramedic Pre-Hospital Transit Chart",
        keyMetric: "Target SpO2 > 95%, MAP > 65 mmHg",
      },
      {
        step: 4,
        phase: "Clinical Resuscitation",
        title: "Clinic Trauma Bay Intake & Stabilization",
        actor: "Chief Medical Officer / Emergency Physician",
        actorRole: "Attending Physician",
        protocol: [
          "Perform primary & secondary trauma survey; inspect entrance and exit electrical contact wounds.",
          "Insert Foley catheter with temperature sensor; titrate IV fluids to achieve high urine output (>1.0 mL/kg/h) to prevent myoglobinuric acute renal failure.",
          "Administer Tetanus Toxoid booster and IV analgesia; order urgent CBC, serum electrolytes, CPK, and arterial blood gases.",
        ],
        systemAction: "Register Emergency Encounter and order emergency laboratory diagnostic tests.",
        systemPath: "/healthcare/emergency",
        documentGenerated: "Emergency Clinical Encounter & Resuscitation Log",
        keyMetric: "Target Urine Output: > 75-100 mL/hr",
      },
      {
        step: 5,
        phase: "Tertiary Referral",
        title: "Referral Hospital Guarantee of Payment (GOP) Issuance",
        actor: "EEU Health Services Director",
        actorRole: "Medical Director",
        protocol: [
          "If %TBSA > 20%, deep 3rd-degree burns, or compartment syndrome is suspected, arrange immediate tertiary transfer to ALERT Hospital Burn Unit or Tikur Anbessa Hospital.",
          "Generate official EEU Guarantee of Payment Letter with unique authorization code, specifying full corporate financial coverage.",
          "Hand over patient with clinical summary, ECG strips, and initial Parkland fluid volume record.",
        ],
        systemAction: "Generate legal A4 Guarantee of Payment Letter with corporate emblem and seal.",
        systemPath: "/healthcare/occupational/guarantee-of-payment",
        documentGenerated: "EEU Guarantee of Payment (GOP) Letter (A4 Format)",
        keyMetric: "Zero financial friction for urgent tertiary admission",
      },
      {
        step: 6,
        phase: "EHS Root-Cause Investigation",
        title: "Post-Incident Workplace & Electrical Investigation",
        actor: "Occupational Health & Safety (EHS) Officer",
        actorRole: "EHS Directorate",
        protocol: [
          "Conduct root cause analysis at substation: inspect arc flash PPE compliance, tool defects, and switching procedures.",
          "Calculate Lost Time Injury (LTI) severity and OSHA incident classification.",
          "Archive safety recommendations and issue corrective maintenance bulletin across national transmission grid.",
        ],
        systemAction: "Log official electrical incident report and update Executive LTI safety matrix.",
        systemPath: "/healthcare/occupational/incidents",
        documentGenerated: "EEU Workplace & Electrical Incident Report",
        keyMetric: "Investigation completed within 48 hours",
      },
    ],
  },
  {
    id: "sf6-exposure",
    title: "Transformer Chemical (PCB) & SF6 Gas Exposure Protocol",
    category: "Toxic Exposure",
    badgeColor: "bg-amber-100 text-amber-700 border-amber-200",
    icon: "solar:test-tube-bold-duotone",
    duration: "24 – 72 Hours (Monitoring Cycle)",
    summary:
      "Clinical protocol for technical personnel exposed to Sulfur Hexafluoride (SF6) gas decomposition products, transformer mineral oils, or dielectric fluid contaminants during high-voltage switchgear maintenance.",
    trigger: "Routine circuit-breaker overhaul, dielectric fluid leak, or suspected inhalation/dermal chemical exposure.",
    outcome: "Toxic surveillance registry entry, spirometric FEV1 monitoring, treatment plan, and duty restriction advisory.",
    steps: [
      {
        step: 1,
        phase: "Decontamination",
        title: "Zone Evacuation & Primary Decontamination",
        actor: "Substation Safety Officer & Affected Worker",
        actorRole: "Field Safety Lead",
        protocol: [
          "Immediately evacuate personnel upwind from switchgear room or trench (SF6 is 5x heavier than air and displaces oxygen).",
          "Remove contaminated work coveralls; irrigate eyes and exposed skin with copious sterile saline for min 15 minutes.",
          "Check for toxic arc decomposition products: Disulfur Decafluoride (S2F10) and Thionyl Fluoride (SOF2), which hydrolyze into corrosive HF acid.",
        ],
        systemAction: "Log hazardous chemical incident alert in Workplace Incidents registry.",
        systemPath: "/healthcare/occupational/incidents",
        documentGenerated: "Substation Hazardous Exposure Field Log",
        keyMetric: "Evacuation & copius irrigation within 5 minutes",
      },
      {
        step: 2,
        phase: "Clinical Assessment",
        title: "Clinical Intake & Spirometric Lung Function Assessment",
        actor: "Occupational Health Physician / Nurse",
        actorRole: "Occupational Physician",
        protocol: [
          "Conduct forced spirometry: measure Forced Expiratory Volume in 1 second (FEV1 actual) and compare to predicted % for age/height.",
          "Examine skin for contact dermatitis, chemical burns, or chloracne (PCB exposure indicator).",
          "Auscultate lungs for crackles or wheezes indicating toxic chemical pneumonitis or delayed pulmonary edema.",
        ],
        systemAction: "Record detailed surveillance entry in Chemical & SF6 Surveillance Register.",
        systemPath: "/healthcare/occupational/toxic-surveillance",
        documentGenerated: "EEU Chemical & Toxic Exposure Surveillance Record",
        keyMetric: "Spirometry baseline within 4 hours of exposure",
      },
      {
        step: 3,
        phase: "Clinical Management",
        title: "Respiratory Support & Medical Management",
        actor: "Attending Physician",
        actorRole: "Medical Doctor",
        protocol: [
          "Administer humidified oxygen if SpO2 < 95%; nebulize with bronchodilators (Salbutamol) for acute bronchospasm.",
          "If Hydrofluoric acid (HF) byproduct is suspected, apply topical 2.5% Calcium Gluconate gel to skin to bind fluoride ions.",
          "Admit to Inpatient Observation for minimum 24 hours: fatal pulmonary edema from S2F10 may have an asymptomatic latent period of up to 48 hours.",
        ],
        systemAction: "Create Inpatient Emergency Observation Record and Medication Requests.",
        systemPath: "/healthcare/emergency",
        documentGenerated: "Inpatient Clinical Monitoring & Poisoning Treatment Order",
        keyMetric: "Mandatory 24h asymptomatic observation for SF6 decomposition",
      },
      {
        step: 4,
        phase: "Duty Modification",
        title: "Occupational Duty Restriction & Clearance Follow-Up",
        actor: "Occupational Health Directorate",
        actorRole: "Occupational Health Specialist",
        protocol: [
          "Issue formal temporary restriction: exclude worker from indoor switchgear rooms and transformer maintenance for 14-30 days.",
          "Schedule repeat spirometry at Day 7 and Day 30; evaluate return of FEV1 to > 85% of predicted baseline.",
          "Inspect substation switchgear ventilation systems and certify environmental air safety before crew re-entry.",
        ],
        systemAction: "Update worker duty recommendation and schedule follow-up re-evaluation.",
        systemPath: "/healthcare/occupational/fitness-evaluations",
        documentGenerated: "Occupational Duty Modification & Medical Restriction Notice",
        keyMetric: "FEV1 > 85% predicted required before duty resumption",
      },
    ],
  },
  {
    id: "lineman-clearance",
    title: "Lineman Periodic Medical Examination (PME) & Climbing Clearance",
    category: "Lineman Fitness",
    badgeColor: "bg-emerald-100 text-emerald-700 border-emerald-200",
    icon: "solar:medal-ribbons-star-bold-duotone",
    duration: "1 – 2 Days (Annual Campaign)",
    summary:
      "Systematic multi-station health screening and fitness-for-duty certification for power distribution linemen, transmission tower climbers, and high-voltage substation switchgear operators.",
    trigger: "Scheduled annual PME campaign or mandatory post-incident / post-illness return-to-work evaluation.",
    outcome: "Official 1-Year Working-at-Heights Clearance Badge, updated Digital Medical ID, and crew deployment safety.",
    steps: [
      {
        step: 1,
        phase: "Campaign Enrollment",
        title: "Annual PME Campaign Batch Scheduling",
        actor: "Occupational Health Coordinator",
        actorRole: "Occupational Health Directorate",
        protocol: [
          "Define target annual campaign and select regional directorate.",
          "Enroll technical crew rosters from Transmission, Distribution, and Substation maintenance departments.",
          "Notify department managers and issue staggered examination appointments to prevent field crew shortages.",
        ],
        systemAction: "Create PME Campaign and link participating employee rosters.",
        systemPath: "/healthcare/occupational/pme-campaigns",
        documentGenerated: "EEU PME Campaign Roster & Examination Schedule",
        keyMetric: "100% technical lineman coverage target",
      },
      {
        step: 2,
        phase: "Multi-Station Screening",
        title: "Multi-Station Occupational Clinical Workup",
        actor: "Occupational Clinical Screening Team",
        actorRole: "Nurses & Technicians",
        protocol: [
          "Station 1 - Visual Acuity: Snellen chart (min 6/9 binocular) and Ishihara 24-plate color test for 3-phase wiring identification.",
          "Station 2 - Pure-Tone Audiometry: Baseline and high-frequency hearing check (500Hz - 8kHz) for transformer noise exposure.",
          "Station 3 - Cardiovascular: Resting 12-lead ECG, blood pressure assessment, and Framingham cardiovascular risk score.",
          "Station 4 - Pulmonary Spirometry: FEV1 and FVC spirometric measurements for workers exposed to insulation dust and SF6 gases.",
        ],
        systemAction: "Record multi-station test values and diagnostic observations.",
        systemPath: "/healthcare/observations",
        documentGenerated: "Occupational Health Examination Protocol Sheet",
        keyMetric: "Four-point occupational fitness assessment",
      },
      {
        step: 3,
        phase: "Medical Evaluation",
        title: "Occupational Medical Officer Clearance Determination",
        actor: "Occupational Health Physician",
        actorRole: "Medical Director",
        protocol: [
          "Evaluate complete multi-station results against national working-at-heights and high-voltage electrical safety standards.",
          "Determine clearance category: Fit for Climbing / High Voltage, Fit with Ground Restrictions, Temporarily Unfit, or Permanently Unfit.",
          "Specify validity period (standard 12 months for active linemen).",
        ],
        systemAction: "Issue formal Fitness-for-Duty Certificate and record restrictions.",
        systemPath: "/healthcare/occupational/fitness-evaluations",
        documentGenerated: "Official Lineman Fitness-for-Duty Certificate",
        keyMetric: "Zero climbing clearance for vertigo or epilepsy",
      },
      {
        step: 4,
        phase: "Badge Synchronization",
        title: "Digital Medical ID Clearance Synchronization",
        actor: "Occupational Registry Clerk",
        actorRole: "Registry Administrator",
        protocol: [
          "System automatically synchronizes clearance status with employee's Digital Medical ID profile.",
          "The 'Climbing Clearance' badge on the worker's ID turns green with expiry date and corporate verification watermark.",
          "Field safety supervisors scan QR code before issuing daily climbing permits for transmission towers.",
        ],
        systemAction: "Update employee record in EEU Staff Registry; update campaign completion counters.",
        systemPath: "/healthcare/occupational/staff-registry",
        documentGenerated: "Digital EEU Medical ID Card with Verified Climbing Badge",
        keyMetric: "Real-time field verification via mobile QR scanner",
      },
    ],
  },
];

const EMERGENCY_TRIAGE_LEVELS = [
  {
    level: "Red (Immediate / Resuscitation)",
    color: "bg-red-500 text-white",
    criteria: [
      "High-voltage electrical shock (>1kV) with cardiac arrest or loss of consciousness",
      "Electrical arc flash burns with %TBSA > 20% or facial airway involvement",
      "Severe SF6 gas decomposition product inhalation with acute stridor or pulmonary edema",
      "Traumatic fall from transmission tower with open fractures or blunt thoracic/head trauma",
      "Uncontrolled arterial hemorrhage or signs of profound hypovolemic shock (MAP < 60 mmHg)",
    ],
    action: "Immediate trauma bay resuscitation, dual 16G IV access, Parkland fluids, continuous ECG telemetry, and urgent GOP referral to ALERT Burn Unit.",
  },
  {
    level: "Yellow (Urgent / Emergent)",
    color: "bg-amber-500 text-white",
    criteria: [
      "Low-voltage electrical shock (220V - 380V) with normal baseline ECG and no loss of consciousness",
      "Partial-thickness electrical contact burns with %TBSA < 10% on non-flexor surfaces",
      "Mild chemical skin exposure without blistering or mucosal ulceration",
      "Isolated closed extremity fracture or deep laceration without arterial compromise",
      "High fever (>39°C) or severe acute abdominal pain in stable patient",
    ],
    action: "Triage within 15 minutes; baseline 12-lead ECG, analgesia, wound debridement, and minimum 6-hour clinic observation.",
  },
  {
    level: "Green (Non-Urgent / Routine)",
    color: "bg-emerald-500 text-white",
    criteria: [
      "Superficial minor cuts, abrasions, or localized minor contusions",
      "Mild musculoskeletal lumbar strain from manual handling of cable reels",
      "Mild viral upper respiratory symptoms, headache, or routine prescription refill",
      "Routine annual lineman clearance screening or administrative follow-up",
    ],
    action: "Standard outpatient queue; consultation within 60 minutes.",
  },
];

const EMERGENCY_HOTLINES = [
  {
    facility: "EEU Central Head Office Emergency Trauma Desk",
    location: "Addis Ababa (Mexico Square / Head Office Clinic)",
    phone: "+251 11 156 0041 / +251 91 123 4567",
    service: "24/7 Central Emergency Dispatch, CMO Tele-Triage & Ambulance",
    type: "EEU Internal",
  },
  {
    facility: "Kality Central Logistics & Technical Depot Clinic",
    location: "Kality Heavy Industrial Zone, Addis Ababa",
    phone: "+251 11 434 1122",
    service: "Emergency Trauma Bay, Paramedic Response Van, Substation Support",
    type: "EEU Internal",
  },
  {
    facility: "Sebeta 400kV High-Voltage Substation Clinic",
    location: "Sebeta Grid Hub, Oromia Special Zone",
    phone: "+251 11 338 2901",
    service: "Substation Trauma Unit, SF6 Decontamination, Primary Stabilization",
    type: "EEU Internal",
  },
  {
    facility: "ALERT Specialized Hospital (Burn & Trauma Unit)",
    location: "Zenebework, Addis Ababa",
    phone: "+251 11 321 1345 / +251 11 321 1346",
    service: "National Referral Center for Severe Electrical Arc Burns & ICU Care",
    type: "Accredited GOP Partner",
  },
  {
    facility: "Tikur Anbessa (Black Lion) Specialized Hospital",
    location: "Churchill Avenue, Addis Ababa",
    phone: "+251 11 551 1211",
    service: "Tertiary Teaching Hospital: Emergency Neurosurgery & Cardiothoracic",
    type: "Accredited GOP Partner",
  },
];

export default function OccupationalTraumaGuidePage() {
  const navigate = useNavigate();
  const [selectedWfId, setSelectedWfId] = useState<string>("substation-trauma");
  const [selectedStepNum, setSelectedStepNum] = useState<number>(1);

  const activeWf = useMemo(() => {
    return OCCUPATIONAL_WORKFLOWS.find((w) => w.id === selectedWfId) || OCCUPATIONAL_WORKFLOWS[0];
  }, [selectedWfId]);

  const activeStep = useMemo(() => {
    return activeWf.steps.find((s) => s.step === selectedStepNum) || activeWf.steps[0];
  }, [activeWf, selectedStepNum]);

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-red-900 via-amber-950 to-slate-900 p-6 sm:p-8 text-white shadow-xl border border-red-700/40">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="flex items-start gap-4">
            <img
              src={eeuLogoImg}
              alt="EEU Logo"
              className="h-16 w-16 sm:h-20 sm:w-20 rounded-2xl bg-white p-2 shadow-md shrink-0 border border-white/20"
            />
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                <Badge className="bg-red-500/20 text-red-300 border-red-400/30 text-xs font-semibold">
                  EHS & Occupational Safety Directorate
                </Badge>
                <Badge className="bg-amber-500/20 text-amber-300 border-amber-400/30 text-xs font-semibold">
                  High-Voltage Electrical Trauma Manual
                </Badge>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                Substation Trauma & Electrical Safety Guide
              </h1>
              <p className="mt-1 text-sm text-red-100/90 max-w-3xl leading-relaxed">
                Emergency escalation protocols, high-voltage electrical flashover triage, Parkland fluid resuscitation, Sulfur Hexafluoride (SF6) gas exposure surveillance, and lineman working-at-heights clearance standards for EEU power infrastructure.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <Button
              onClick={() => navigate("/healthcare/occupational/emergency-sos")}
              className="bg-red-600 hover:bg-red-500 text-white font-semibold shadow-sm transition-all animate-pulse"
            >
              <Icon icon="solar:ambulance-bold-duotone" size={18} className="mr-1.5" />
              Substation SOS Board
            </Button>
            <Button
              onClick={() => navigate("/healthcare/occupational/dashboard")}
              className="bg-white/10 hover:bg-white/20 text-white font-semibold border border-white/20"
            >
              <Icon icon="solar:shield-warning-bold-duotone" size={18} className="mr-1.5" />
              Occupational Center
            </Button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="workflows" className="space-y-6">
        <TabsList className="bg-muted/60 p-1 rounded-xl border flex flex-wrap h-auto gap-1">
          <TabsTrigger value="workflows" className="py-2 px-4 text-xs sm:text-sm font-semibold">
            <Icon icon="solar:round-transfer-vertical-bold-duotone" size={18} className="mr-1.5" />
            Trauma & Field Pipelines
          </TabsTrigger>
          <TabsTrigger value="triage" className="py-2 px-4 text-xs sm:text-sm font-semibold">
            <Icon icon="solar:danger-triangle-bold" size={18} className="mr-1.5 text-red-600" />
            Electrical Triage Matrix
          </TabsTrigger>
          <TabsTrigger value="hotlines" className="py-2 px-4 text-xs sm:text-sm font-semibold">
            <Icon icon="solar:phone-calling-bold" size={18} className="mr-1.5 text-emerald-600" />
            Regional Emergency Hotlines
          </TabsTrigger>
        </TabsList>

        {/* WORKFLOWS TAB */}
        <TabsContent value="workflows" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {OCCUPATIONAL_WORKFLOWS.map((wf) => {
              const isSelected = wf.id === activeWf.id;
              return (
                <button
                  key={wf.id}
                  onClick={() => {
                    setSelectedWfId(wf.id);
                    setSelectedStepNum(1);
                  }}
                  className={`text-left p-4 rounded-xl border transition-all ${
                    isSelected
                      ? "border-red-600 bg-red-50/60 shadow-md ring-2 ring-red-500/20"
                      : "border-border/80 bg-card hover:border-red-300 hover:bg-muted/30"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${wf.badgeColor}`}>
                      {wf.category}
                    </span>
                    <span className="text-[11px] text-muted-foreground">{wf.steps.length} Steps</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <div className={`p-2 rounded-lg shrink-0 ${isSelected ? "bg-red-600 text-white" : "bg-muted text-muted-foreground"}`}>
                      <Icon icon={wf.icon} size={20} />
                    </div>
                    <div>
                      <h3 className={`text-sm font-bold ${isSelected ? "text-red-950" : "text-foreground"}`}>
                        {wf.title}
                      </h3>
                      <p className="mt-1 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                        {wf.summary}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Active Workflow Viewer */}
          <Card className="border-red-200/70 shadow-lg overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-red-50 via-amber-50 to-white border-b pb-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="p-3 rounded-xl bg-red-600 text-white shadow-sm shrink-0">
                    <Icon icon={activeWf.icon} size={28} />
                  </div>
                  <div>
                    <Badge className="bg-red-700 text-white text-xs mb-1">{activeWf.category}</Badge>
                    <h3 className="text-xl font-extrabold text-foreground">{activeWf.title}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5 max-w-3xl leading-relaxed">
                      {activeWf.summary}
                    </p>
                  </div>
                </div>
                <div className="text-xs shrink-0">
                  <span className="font-semibold text-muted-foreground block text-[11px] uppercase">Duration:</span>
                  <span className="text-foreground font-medium">{activeWf.duration}</span>
                </div>
              </div>

              {/* Stepper */}
              <div className="mt-6 pt-4 border-t border-red-200/50 flex items-center gap-2 overflow-x-auto pb-2">
                {activeWf.steps.map((s) => {
                  const isStepActive = s.step === activeStep.step;
                  const isPast = s.step < activeStep.step;
                  return (
                    <button
                      key={s.step}
                      onClick={() => setSelectedStepNum(s.step)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-all shrink-0 border ${
                        isStepActive
                          ? "bg-red-700 text-white border-red-700 shadow-md ring-2 ring-red-500/20"
                          : isPast
                          ? "bg-red-50 text-red-900 border-red-200 hover:bg-red-100"
                          : "bg-muted/40 text-muted-foreground border-border hover:bg-muted"
                      }`}
                    >
                      <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                        isStepActive ? "bg-white text-red-800" : isPast ? "bg-red-600 text-white" : "bg-muted text-muted-foreground"
                      }`}>
                        {isPast ? <Icon icon="solar:check-read-linear" size={14} /> : s.step}
                      </span>
                      <div>
                        <p className="text-[10px] uppercase font-semibold opacity-75 leading-none">{s.phase}</p>
                        <p className="text-xs font-bold mt-0.5 whitespace-nowrap">{s.title}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </CardHeader>

            <CardContent className="pt-6 space-y-4">
              <div className="rounded-xl border border-border/80 bg-card p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-border/60">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-600 text-white font-extrabold text-sm">
                      {activeStep.step}
                    </span>
                    <div>
                      <span className="text-[11px] font-bold text-red-700 uppercase tracking-wider">Phase: {activeStep.phase}</span>
                      <h4 className="text-lg font-bold text-foreground">{activeStep.title}</h4>
                    </div>
                  </div>
                  <Badge variant="outline" className="font-semibold text-xs">
                    <Icon icon="solar:user-bold" size={12} className="mr-1 text-red-600" />
                    {activeStep.actor}
                  </Badge>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2 space-y-3">
                    <h5 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Standard Protocol Actions</h5>
                    <ul className="space-y-2">
                      {activeStep.protocol.map((p, i) => (
                        <li key={i} className="flex items-start gap-2.5 text-xs text-foreground/90 p-2.5 rounded-lg bg-muted/30 border border-border/40">
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-100 text-red-800 text-[10px] font-bold shrink-0 mt-0.5">
                            {i + 1}
                          </span>
                          <span>{p}</span>
                        </li>
                      ))}
                    </ul>
                    {activeStep.keyMetric && (
                      <div className="flex items-center gap-2 p-2.5 rounded-lg bg-amber-50 border border-amber-200/70 text-amber-800 text-xs font-medium">
                        <Icon icon="solar:alarm-bold" size={16} className="text-amber-600 shrink-0" />
                        <span><strong>Standard Target:</strong> {activeStep.keyMetric}</span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-4 p-4 rounded-xl bg-muted/20 border border-border/60">
                    <div>
                      <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block mb-1">System Action</span>
                      <p className="text-xs font-medium text-foreground">{activeStep.systemAction}</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block mb-1">Generated Record</span>
                      <div className="flex items-center gap-2 p-2 rounded-lg bg-card border text-xs font-semibold">
                        <Icon icon="solar:document-bold" size={16} className="text-red-600 shrink-0" />
                        <span>{activeStep.documentGenerated}</span>
                      </div>
                    </div>
                    <Button
                      onClick={() => navigate(activeStep.systemPath)}
                      className="w-full bg-red-700 hover:bg-red-600 text-white font-semibold text-xs shadow-sm"
                    >
                      <Icon icon="solar:link-circle-bold" size={16} className="mr-1.5" />
                      Open in System
                    </Button>
                  </div>
                </div>

                <div className="pt-4 border-t border-border/60 flex items-center justify-between">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={activeStep.step === 1}
                    onClick={() => setSelectedStepNum((prev) => Math.max(1, prev - 1))}
                    className="text-xs"
                  >
                    Previous Step
                  </Button>
                  <span className="text-xs text-muted-foreground font-medium">
                    Step {activeStep.step} of {activeWf.steps.length}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={activeStep.step === activeWf.steps.length}
                    onClick={() => setSelectedStepNum((prev) => Math.min(activeWf.steps.length, prev + 1))}
                    className="text-xs text-red-700 border-red-300 hover:bg-red-50"
                  >
                    Next Step
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TRIAGE TAB */}
        <TabsContent value="triage" className="space-y-4">
          <div className="space-y-3">
            {EMERGENCY_TRIAGE_LEVELS.map((tri, i) => (
              <div key={i} className="rounded-xl border border-border/80 bg-card p-4 shadow-sm space-y-2">
                <span className={`text-xs font-bold px-3 py-1 rounded-full ${tri.color}`}>{tri.level}</span>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div>
                    <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                      Clinical Presentation & Criteria:
                    </span>
                    <ul className="space-y-1">
                      {tri.criteria.map((c, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-xs text-foreground/80">
                          <span className="h-1.5 w-1.5 rounded-full bg-red-500 shrink-0 mt-1.5" />
                          <span>{c}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/30 border border-border/50 text-xs">
                    <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                      Immediate Clinical Protocol:
                    </span>
                    <p className="text-foreground/90 leading-relaxed">{tri.action}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* HOTLINES TAB */}
        <TabsContent value="hotlines" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {EMERGENCY_HOTLINES.map((hl, i) => (
              <div key={i} className="p-4 rounded-xl border border-border/80 bg-card shadow-sm space-y-2">
                <Badge className={`text-[10px] ${hl.type === "EEU Internal" ? "bg-red-100 text-red-800" : "bg-blue-100 text-blue-800"}`}>
                  {hl.type}
                </Badge>
                <h3 className="text-sm font-bold text-foreground">{hl.facility}</h3>
                <p className="text-[11px] text-muted-foreground">{hl.location}</p>
                <div className="p-2 rounded-lg bg-muted/40 font-mono text-xs font-bold text-red-800">
                  <Icon icon="solar:phone-calling-bold" size={14} className="inline mr-1 text-red-600" />
                  {hl.phone}
                </div>
                <p className="text-[11px] text-muted-foreground">{hl.service}</p>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
