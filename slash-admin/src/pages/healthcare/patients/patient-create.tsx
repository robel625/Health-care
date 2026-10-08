import { useState } from "react";
import { useNavigate } from "react-router";
import { Icon } from "@/components/icon";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/ui/card";
import { Badge } from "@/ui/badge";
import Avatar from "@/components/Avatar";
import { HealthcareApi } from "@/api/services/healthcareService";
import { useDoctypePermissions } from "@/utils/permissions";
import { formatAge } from "@/utils/age";
import { cn, extractErrorMessage } from "@/utils";
import { toast } from "sonner";

type RegistrationTab = "demographics" | "medical" | "eeu" | "account";

export default function PatientCreatePage() {
  const { canCreate } = useDoctypePermissions("Patient");
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<RegistrationTab>("demographics");
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    // Patient Demographics
    first_name: "",
    middle_name: "",
    last_name: "",
    sex: "",
    blood_group: "",
    dob: "",
    status: "Active",
    uid: "",
    mobile: "",
    phone: "",
    email: "",
    invite_user: true,
    report_preference: "Email",
    // EEU / EEP Employment & Occupational Details
    company_affiliation: "Ethiopian Electric Utility (EEU)",
    eeu_staff_id: "",
    eeu_department: "Distribution Directorate",
    eeu_region: "Addis Ababa",
    eeu_work_station: "",
    eeu_cadre: "Senior High-Voltage Lineman",
    eeu_beneficiary_type: "Staff",
    eeu_primary_staff_id: "",
    eeu_medical_coverage_status: "Active Coverage",
    eeu_climbing_fitness_status: "Fit to Climb",
    // Address
    address: "",
    address_line_2: "",
    city: "",
    state: "",
    pincode: "",
    country: "Ethiopia",
    // Customer Details
    customer_group: "All Customers",
    territory: "All Territories",
    default_price_list: "Standard Selling",
    // More Information
    patient_details: "",
    // Medical History
    occupation: "",
    marital_status: "",
    allergies: "",
    medical_history: "",
    medication: "",
    surgical_history: "",
    // Risk Factors
    tobacco_past_use: "",
    tobacco_current_use: "",
    alcohol_past_use: "",
    alcohol_current_use: "",
    surrounding_factors: "",
    other_risk_factors: "",
  });

  const update = (key: string, value: any) => setForm((prev) => ({ ...prev, [key]: value }));

  const getCompanyPrefix = (affiliation?: string) => {
    if (affiliation?.includes("EEP")) return "EEP-";
    if (affiliation?.includes("Contractor") || affiliation?.includes("Other")) return "others-";
    return "EEU-";
  };

  const extractStaffNumber = (fullId?: string) => {
    if (!fullId) return "";
    return fullId
      .replace(/^(EEU|EEP|others)-EMP-?/i, "")
      .replace(/^(EEU|EEP|others)-/i, "")
      .replace(/^EMP-?/i, "");
  };

  const handleCompanyChange = (newAffiliation: string) => {
    const num = extractStaffNumber(form.eeu_staff_id);
    const primNum = extractStaffNumber(form.eeu_primary_staff_id);
    const newPrefix = getCompanyPrefix(newAffiliation);
    const newStaffId = num ? `${newPrefix}${num}` : "";
    const newPrimId = primNum ? `${newPrefix}${primNum}` : "";

    let newDept = form.eeu_department;
    if (newAffiliation.includes("EEP")) {
      newDept = "Generation & Hydro Plants (GERD, Gibe, Tekeze, Fincha)";
    } else if (newAffiliation.includes("Contractor") || newAffiliation.includes("Other")) {
      newDept = "External Construction & Infrastructure Subcontractor";
    } else {
      newDept = "Distribution Directorate";
    }

    setForm((prev) => ({
      ...prev,
      company_affiliation: newAffiliation,
      eeu_staff_id: newStaffId,
      eeu_primary_staff_id: newPrimId,
      eeu_department: newDept,
    }));
  };

  const appendToField = (fieldName: string, text: string) => {
    setForm((prev) => {
      const current = ((prev as any)[fieldName] || "").trim();
      if (!current) return { ...prev, [fieldName]: text };
      if (current.includes(text)) return prev;
      return { ...prev, [fieldName]: `${current}, ${text}` };
    });
  };

  const applyIntakeTemplate = (templateType: "routine" | "emergency" | "pediatric") => {
    let text = "";
    if (templateType === "routine") {
      text = "Chief Complaint: General outpatient consultation and wellness intake.\nHistory: Patient presents for routine baseline evaluation with no acute distress reported.";
    } else if (templateType === "emergency") {
      text = "Chief Complaint: Acute emergency presentation.\nHistory: Emergency triage intake. Hemodynamically monitored and urgent evaluation requested.";
    } else if (templateType === "pediatric") {
      text = "Chief Complaint: Pediatric developmental milestone check and immunization review.\nHistory: Well-child examination, immunization schedule verification, and growth chart monitoring.";
    }
    setForm((prev) => ({ ...prev, patient_details: text }));
    toast.success("Intake template applied");
  };

  const handleSave = async () => {
    if (!form.first_name.trim()) {
      toast.error("First Name is required to register a patient");
      setActiveTab("demographics");
      return;
    }
    if (!form.sex) {
      toast.error("Please specify patient gender");
      setActiveTab("demographics");
      return;
    }

    setSaving(true);
    try {
      const payload: any = {
        ...form,
        first_name: form.first_name.trim(),
        middle_name: form.middle_name.trim(),
        last_name: form.last_name.trim(),
        dob: form.dob ? form.dob : null,
      };
      const patient = await HealthcareApi.patients.create(payload);
      toast.success(`Patient ${patient.patient_name || patient.first_name} successfully registered!`);
      navigate(`/healthcare/patients/${patient.id}`);
    } catch (err: any) {
      console.error(err);
      toast.error(extractErrorMessage(err, "Failed to register patient"));
    } finally {
      setSaving(false);
    }
  };

  const fullNamePreview = `${form.first_name} ${form.middle_name} ${form.last_name}`.trim();
  const calculatedAge = formatAge(form.dob);

  const tabs: { key: RegistrationTab; label: string; icon: string; step: string }[] = [
    { key: "demographics", label: "Demographics & Contact", icon: "solar:user-id-bold-duotone", step: "01" },
    { key: "medical", label: "Medical Baseline & Allergies", icon: "solar:medical-kit-bold-duotone", step: "02" },
    { key: "eeu", label: "EEU / EEP Affiliation", icon: "solar:buildings-bold-duotone", step: "03" },
    { key: "account", label: "Risk & Account Setup", icon: "solar:shield-warning-bold-duotone", step: "04" },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* ─── Breadcrumb & Navigation Line ─── */}
      <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate("/healthcare")}
            className="hover:text-foreground transition-colors flex items-center gap-1"
          >
            <Icon icon="solar:home-bold-duotone" size={14} />
            Healthcare
          </button>
          <span>/</span>
          <button
            type="button"
            onClick={() => navigate("/healthcare/patients")}
            className="hover:text-foreground transition-colors"
          >
            Patients
          </button>
          <span>/</span>
          <span className="font-semibold text-foreground">New Patient Registration</span>
        </div>

        <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30">
          Draft Registration
        </Badge>
      </div>

      {/* ─── Live Patient Identity & Hero Banner ─── */}
      <div className="rounded-2xl border bg-card p-5 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Avatar
                name={fullNamePreview || "New Patient"}
                size="xl"
                className="ring-4 ring-primary/20 shadow-md"
              />
              <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-background" />
            </div>

            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl font-bold text-foreground">
                  {fullNamePreview || "New Patient Registration"}
                </h1>
                <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary border-primary/30">
                  {form.status || "Active"}
                </Badge>
              </div>

              <div className="flex items-center gap-3 mt-1.5 flex-wrap text-xs text-muted-foreground">
                <span className="flex items-center gap-1 font-medium text-foreground">
                  <Icon icon="solar:calendar-bold-duotone" size={13} className="text-muted-foreground" />
                  {calculatedAge}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1 font-medium text-foreground">
                  <Icon icon="solar:user-bold-duotone" size={13} className="text-muted-foreground" />
                  {form.sex || "Gender pending"}
                </span>
                <span>•</span>
                {form.blood_group ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/10 text-rose-600 border border-rose-500/30">
                    <Icon icon="solar:drop-bold" size={10} />
                    {form.blood_group}
                  </span>
                ) : (
                  <span className="text-muted-foreground">Blood group pending</span>
                )}
                {form.mobile && (
                  <>
                    <span>•</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-mono font-medium">
                      {form.mobile}
                    </span>
                  </>
                )}
                <span>•</span>
                <span
                  className={cn(
                    "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border",
                    form.company_affiliation?.includes("EEP")
                      ? "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30"
                      : (form.company_affiliation?.includes("Contractor") || form.company_affiliation?.includes("Other"))
                      ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30"
                      : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                  )}
                >
                  <Icon
                    icon={
                      form.company_affiliation?.includes("EEP")
                        ? "solar:bolt-bold"
                        : (form.company_affiliation?.includes("Contractor") || form.company_affiliation?.includes("Other"))
                        ? "solar:shield-warning-bold"
                        : "solar:buildings-bold"
                    }
                    size={10}
                  />
                  {form.company_affiliation?.includes("EEP")
                    ? "EEP Affiliated"
                    : (form.company_affiliation?.includes("Contractor") || form.company_affiliation?.includes("Other"))
                    ? "Contractor / Other"
                    : "EEU Affiliated"}
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 self-end sm:self-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/healthcare/patients")}
              className="h-9 text-xs"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !canCreate}
              className="h-9 text-xs font-semibold gap-1.5 bg-primary text-primary-foreground shadow-2xs px-5"
            >
              {saving ? (
                <>
                  <Icon icon="solar:restart-bold" size={14} className="animate-spin" />
                  Registering Patient...
                </>
              ) : (
                <>
                  <Icon icon="solar:check-circle-bold" size={14} />
                  Complete Registration
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* ─── Segmented Step Navigation Tabs ─── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-1.5 rounded-2xl border bg-muted/30">
        {tabs.map((tab) => {
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "flex items-center justify-between px-4 py-3 rounded-xl text-xs font-semibold transition-all cursor-pointer text-left",
                active
                  ? "bg-background text-foreground shadow-2xs font-bold border border-border"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
              )}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className={cn(
                    "p-1.5 rounded-lg transition-colors",
                    active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                  )}
                >
                  <Icon icon={tab.icon} size={18} />
                </div>
                <span>{tab.label}</span>
              </div>
              <span className={cn("text-[10px] font-mono", active ? "text-primary font-bold" : "opacity-40")}>
                {tab.step}
              </span>
            </button>
          );
        })}
      </div>

      {/* ─── TAB 1: Demographics & Contact ─── */}
      {activeTab === "demographics" && (
        <div className="space-y-6">
          {/* Card 1: Legal Identity & Demographics */}
          <Card className="shadow-2xs overflow-hidden">
            <CardHeader className="pb-3 border-b bg-muted/15 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600">
                  <Icon icon="solar:user-id-bold-duotone" size={20} />
                </div>
                <div>
                  <CardTitle className="text-xs font-bold">Legal Demographics & Identification</CardTitle>
                  <CardDescription className="text-xs">
                    Primary bio-data, civil registry, biological gender, and blood grouping
                  </CardDescription>
                </div>
              </div>
              <Badge variant="outline" className="text-[10px] font-bold uppercase">
                Required Section
              </Badge>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <Label className="text-xs font-semibold text-foreground">
                    First / Given Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    className="mt-1.5 h-9 text-xs"
                    value={form.first_name}
                    onChange={(e) => update("first_name", e.target.value)}
                    placeholder="e.g., Abebe"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-muted-foreground">Middle / Father Name</Label>
                  <Input
                    className="mt-1.5 h-9 text-xs"
                    value={form.middle_name}
                    onChange={(e) => update("middle_name", e.target.value)}
                    placeholder="e.g., Bikila"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-foreground">Last Name / Surname</Label>
                  <Input
                    className="mt-1.5 h-9 text-xs"
                    value={form.last_name}
                    onChange={(e) => update("last_name", e.target.value)}
                    placeholder="e.g., Demissie"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                <div>
                  <Label className="text-xs font-semibold text-foreground">
                    Biological Gender <span className="text-destructive">*</span>
                  </Label>
                  <select
                    className="w-full border rounded-lg px-3 py-2 text-xs mt-1.5 bg-background h-9 focus:ring-2 focus:ring-primary/20 focus:outline-hidden"
                    value={form.sex}
                    onChange={(e) => update("sex", e.target.value)}
                  >
                    <option value="">Select Gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-foreground">Date of Birth</Label>
                    {form.dob && (
                      <span className="text-[10px] text-primary font-semibold">
                        {calculatedAge}
                      </span>
                    )}
                  </div>
                  <Input
                    type="date"
                    className="mt-1.5 h-9 text-xs"
                    value={form.dob}
                    onChange={(e) => update("dob", e.target.value)}
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold text-foreground">Blood Group</Label>
                  <select
                    className="w-full border rounded-lg px-3 py-2 text-xs mt-1.5 bg-background h-9 focus:ring-2 focus:ring-primary/20 focus:outline-hidden"
                    value={form.blood_group}
                    onChange={(e) => update("blood_group", e.target.value)}
                  >
                    <option value="">Select Blood Group</option>
                    {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((bg) => (
                      <option key={bg} value={bg}>
                        {bg}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <Label className="text-xs font-semibold text-foreground">
                    National ID / UID / Passport Number
                  </Label>
                  <Input
                    className="mt-1.5 h-9 text-xs"
                    value={form.uid}
                    onChange={(e) => update("uid", e.target.value)}
                    placeholder="Civil Identification Number"
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold text-foreground">Patient Registry Status</Label>
                  <select
                    className="w-full border rounded-lg px-3 py-2 text-xs mt-1.5 bg-background h-9 focus:ring-2 focus:ring-primary/20 focus:outline-hidden"
                    value={form.status}
                    onChange={(e) => update("status", e.target.value)}
                  >
                    <option value="Active">Active (Eligible for services)</option>
                    <option value="Disabled">Disabled (Suspended registry)</option>
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Contact & Omnichannel Communication */}
          <Card className="shadow-2xs overflow-hidden">
            <CardHeader className="pb-3 border-b bg-muted/15 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600">
                  <Icon icon="solar:phone-calling-bold-duotone" size={20} />
                </div>
                <div>
                  <CardTitle className="text-xs font-bold">Contact & Omnichannel Communications</CardTitle>
                  <CardDescription className="text-xs">
                    Telephony, electronic notifications, and report delivery preferences
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <Label className="text-xs font-semibold text-foreground">Mobile Phone</Label>
                  <Input
                    type="tel"
                    className="mt-1.5 h-9 text-xs"
                    value={form.mobile}
                    onChange={(e) => update("mobile", e.target.value)}
                    placeholder="+251 91 123 4567"
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold text-muted-foreground">Alternate / Landline Phone</Label>
                  <Input
                    type="tel"
                    className="mt-1.5 h-9 text-xs"
                    value={form.phone}
                    onChange={(e) => update("phone", e.target.value)}
                    placeholder="+251 11 ..."
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold text-foreground">Email Address</Label>
                  <Input
                    type="email"
                    className="mt-1.5 h-9 text-xs"
                    value={form.email}
                    onChange={(e) => update("email", e.target.value)}
                    placeholder="patient@domain.com"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <Label className="text-xs font-semibold text-foreground">Lab & Clinical Report Preference</Label>
                  <select
                    className="w-full border rounded-lg px-3 py-2 text-xs mt-1.5 bg-background h-9 focus:ring-2 focus:ring-primary/20 focus:outline-hidden"
                    value={form.report_preference}
                    onChange={(e) => update("report_preference", e.target.value)}
                  >
                    <option value="Email">Electronic Mail (PDF report)</option>
                    <option value="Patient Portal">Patient Portal Online View</option>
                    <option value="Print">Physical Counter Print</option>
                  </select>
                </div>

                <div className="flex items-center gap-2.5 pt-6">
                  <input
                    type="checkbox"
                    id="inviteUserCreate"
                    checked={form.invite_user}
                    onChange={(e) => update("invite_user", e.target.checked)}
                    className="rounded border-border text-primary focus:ring-primary h-4 w-4"
                  />
                  <label htmlFor="inviteUserCreate" className="text-xs font-medium text-foreground cursor-pointer select-none">
                    Send portal invitation link to patient's registered email
                  </label>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card 3: Primary Residence Address */}
          <Card className="shadow-2xs overflow-hidden">
            <CardHeader className="pb-3 border-b bg-muted/15 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600">
                  <Icon icon="solar:map-point-bold-duotone" size={20} />
                </div>
                <div>
                  <CardTitle className="text-xs font-bold">Primary Residential Address</CardTitle>
                  <CardDescription className="text-xs">
                    Physical location for home care, postal correspondence, and regional health jurisdiction
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-semibold text-foreground">Address Line 1</Label>
                  <Input
                    className="mt-1.5 h-9 text-xs"
                    value={form.address}
                    onChange={(e) => update("address", e.target.value)}
                    placeholder="Street, Woreda, Kebele, House #"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-muted-foreground">Address Line 2 (Optional)</Label>
                  <Input
                    className="mt-1.5 h-9 text-xs"
                    value={form.address_line_2}
                    onChange={(e) => update("address_line_2", e.target.value)}
                    placeholder="Apartment, Suite, Landmark"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
                <div>
                  <Label className="text-xs font-semibold text-foreground">City / Town</Label>
                  <Input
                    className="mt-1.5 h-9 text-xs"
                    value={form.city}
                    onChange={(e) => update("city", e.target.value)}
                    placeholder="e.g., Addis Ababa"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-foreground">State / Region</Label>
                  <Input
                    className="mt-1.5 h-9 text-xs"
                    value={form.state}
                    onChange={(e) => update("state", e.target.value)}
                    placeholder="e.g., Oromia"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-foreground">PIN / Postal Code</Label>
                  <Input
                    className="mt-1.5 h-9 text-xs"
                    value={form.pincode}
                    onChange={(e) => update("pincode", e.target.value)}
                    placeholder="e.g., 1000"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-foreground">Country</Label>
                  <Input
                    className="mt-1.5 h-9 text-xs"
                    value={form.country}
                    onChange={(e) => update("country", e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ─── TAB 2: Medical Baseline & Allergies ─── */}
      {activeTab === "medical" && (
        <div className="space-y-6">
          {/* Allergies & Sensitivities Card */}
          <Card className="shadow-2xs border-l-4 border-l-rose-500 overflow-hidden">
            <CardHeader className="pb-3 border-b bg-muted/15 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-rose-500/10 text-rose-600">
                  <Icon icon="solar:shield-warning-bold-duotone" size={20} />
                </div>
                <div>
                  <CardTitle className="text-xs font-bold text-rose-900 dark:text-rose-100">
                    Allergies & Adverse Drug Reactions (ADR)
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Substances, foods, and pharmacological agents triggering hypersensitivity or anaphylaxis
                  </CardDescription>
                </div>
              </div>
              <Badge variant="outline" className="text-[10px] bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30 font-bold">
                Clinical Priority
              </Badge>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              <div>
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
                  Quick Add Common Allergens:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {["Penicillin", "Sulfa Drugs", "Aspirin/NSAIDs", "Latex", "Iodine / Contrast", "Peanuts"].map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => appendToField("allergies", item)}
                      className="text-[11px] px-2.5 py-0.5 rounded-full border border-rose-500/20 bg-rose-500/5 hover:bg-rose-500/15 text-rose-700 dark:text-rose-300 font-medium transition cursor-pointer flex items-center gap-1"
                    >
                      <span>+</span>
                      <span>{item}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-xs font-semibold text-foreground">Detailed Reaction Notes & Manifestations</Label>
                <textarea
                  className="w-full border rounded-lg p-2.5 text-xs mt-1.5 min-h-[90px] bg-background focus:ring-2 focus:ring-primary/20 focus:outline-hidden"
                  value={form.allergies}
                  onChange={(e) => update("allergies", e.target.value)}
                  placeholder="e.g., Penicillin (severe urticaria and bronchospasm), Sulfa drugs (rash)..."
                />
              </div>
            </CardContent>
          </Card>

          {/* 3 Clinical History Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* 1. Past Medical History */}
            <Card className="shadow-2xs border-l-4 border-l-blue-500">
              <CardHeader className="pb-3 border-b bg-muted/15">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-600">
                    <Icon icon="solar:heart-pulse-bold-duotone" size={16} />
                  </div>
                  <CardTitle className="text-xs font-bold">Past Medical History</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-3.5 space-y-3">
                <div className="flex flex-wrap gap-1">
                  {["Hypertension", "Type 2 Diabetes", "Asthma", "Dyslipidemia", "GERD"].map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => appendToField("medical_history", item)}
                      className="text-[10px] px-2 py-0.5 rounded-full border border-blue-500/20 bg-blue-500/5 hover:bg-blue-500/15 text-blue-700 dark:text-blue-300 font-medium transition cursor-pointer"
                    >
                      +{item}
                    </button>
                  ))}
                </div>
                <textarea
                  className="w-full border rounded-lg p-2 text-xs min-h-[110px] bg-background focus:ring-2 focus:ring-primary/20 focus:outline-hidden"
                  value={form.medical_history}
                  onChange={(e) => update("medical_history", e.target.value)}
                  placeholder="Chronic conditions, diagnoses, previous major illnesses..."
                />
              </CardContent>
            </Card>

            {/* 2. Current Medications */}
            <Card className="shadow-2xs border-l-4 border-l-purple-500">
              <CardHeader className="pb-3 border-b bg-muted/15">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-600">
                    <Icon icon="solar:pill-bold-duotone" size={16} />
                  </div>
                  <CardTitle className="text-xs font-bold">Current Medications</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-3.5 space-y-3">
                <div className="flex flex-wrap gap-1">
                  {["Metformin 500mg", "Amlodipine 5mg", "Atorvastatin 20mg", "Omeprazole"].map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => appendToField("medication", item)}
                      className="text-[10px] px-2 py-0.5 rounded-full border border-purple-500/20 bg-purple-500/5 hover:bg-purple-500/15 text-purple-700 dark:text-purple-300 font-medium transition cursor-pointer"
                    >
                      +{item}
                    </button>
                  ))}
                </div>
                <textarea
                  className="w-full border rounded-lg p-2 text-xs min-h-[110px] bg-background focus:ring-2 focus:ring-primary/20 focus:outline-hidden"
                  value={form.medication}
                  onChange={(e) => update("medication", e.target.value)}
                  placeholder="Home regimens, active prescriptions, vitamins, OTC..."
                />
              </CardContent>
            </Card>

            {/* 3. Surgical History */}
            <Card className="shadow-2xs border-l-4 border-l-amber-500">
              <CardHeader className="pb-3 border-b bg-muted/15">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600">
                    <Icon icon="solar:scissors-bold-duotone" size={16} />
                  </div>
                  <CardTitle className="text-xs font-bold">Surgical History</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-3.5 space-y-3">
                <div className="flex flex-wrap gap-1">
                  {["Appendectomy", "Cholecystectomy", "C-Section", "Hernia Repair"].map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => appendToField("surgical_history", item)}
                      className="text-[10px] px-2 py-0.5 rounded-full border border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/15 text-amber-700 dark:text-amber-300 font-medium transition cursor-pointer"
                    >
                      +{item}
                    </button>
                  ))}
                </div>
                <textarea
                  className="w-full border rounded-lg p-2 text-xs min-h-[110px] bg-background focus:ring-2 focus:ring-primary/20 focus:outline-hidden"
                  value={form.surgical_history}
                  onChange={(e) => update("surgical_history", e.target.value)}
                  placeholder="Prior operative procedures, dates, hospital, anesthesia events..."
                />
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ─── TAB 3: EEU / EEP Employment & Medical Scheme ─── */}
      {activeTab === "eeu" && (
        <div className="space-y-6">
          {/* Card 1: Corporate Employer Selection */}
          <Card className="shadow-2xs overflow-hidden border-primary/20">
            <CardHeader className="pb-3 border-b bg-muted/15 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-primary/10 text-primary">
                  <Icon icon="solar:buildings-2-bold-duotone" size={20} />
                </div>
                <div>
                  <CardTitle className="text-xs font-bold">Corporate Employer Affiliation</CardTitle>
                  <CardDescription className="text-xs">
                    Designate whether the patient is an employee/dependent of EEU or EEP for health scheme allocation
                  </CardDescription>
                </div>
              </div>
              <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider text-primary border-primary/30">
                Scheme Sponsor
              </Badge>
            </CardHeader>
            <CardContent className="p-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Option 1: EEU */}
                <div
                  onClick={() => handleCompanyChange("Ethiopian Electric Utility (EEU)")}
                  className={cn(
                    "relative p-4 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between gap-3",
                    !form.company_affiliation?.includes("EEP") && !form.company_affiliation?.includes("Contractor") && !form.company_affiliation?.includes("Other")
                      ? "border-emerald-500 bg-emerald-500/5 shadow-xs"
                      : "border-border/60 hover:border-emerald-500/40 hover:bg-muted/30"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 shrink-0">
                      <Icon icon="solar:transmission-bold-duotone" size={24} />
                    </div>
                    {!form.company_affiliation?.includes("EEP") && !form.company_affiliation?.includes("Contractor") && !form.company_affiliation?.includes("Other") && (
                      <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-500/20" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-foreground">Ethiopian Electric Utility (EEU)</div>
                    <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                      Power retail, national distribution network, regional metering & local substation operations.
                    </p>
                  </div>
                  <div className="pt-2 border-t border-border/40 flex items-center justify-between text-[10px]">
                    <span className="text-muted-foreground">ID Prefix:</span>
                    <Badge variant="outline" className="font-mono font-bold text-emerald-700 dark:text-emerald-300 border-emerald-500/30">
                      EEU-657854
                    </Badge>
                  </div>
                </div>

                {/* Option 2: EEP */}
                <div
                  onClick={() => handleCompanyChange("Ethiopian Electric Power (EEP)")}
                  className={cn(
                    "relative p-4 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between gap-3",
                    form.company_affiliation?.includes("EEP")
                      ? "border-sky-500 bg-sky-500/5 shadow-xs"
                      : "border-border/60 hover:border-sky-500/40 hover:bg-muted/30"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="p-2.5 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 shrink-0">
                      <Icon icon="solar:water-bold-duotone" size={24} />
                    </div>
                    {form.company_affiliation?.includes("EEP") && (
                      <span className="flex h-2.5 w-2.5 rounded-full bg-sky-500 ring-4 ring-sky-500/20" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-foreground">Ethiopian Electric Power (EEP)</div>
                    <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                      Power generation dams (GERD, Gilgel Gibe, Tekeze), high-voltage grids (400kV/500kV) & major transmission.
                    </p>
                  </div>
                  <div className="pt-2 border-t border-border/40 flex items-center justify-between text-[10px]">
                    <span className="text-muted-foreground">ID Prefix:</span>
                    <Badge variant="outline" className="font-mono font-bold text-sky-700 dark:text-sky-300 border-sky-500/30">
                      EEP-765767
                    </Badge>
                  </div>
                </div>

                {/* Option 3: Construction / Contractor / Other */}
                <div
                  onClick={() => handleCompanyChange("Contractor / Other")}
                  className={cn(
                    "relative p-4 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between gap-3",
                    (form.company_affiliation?.includes("Contractor") || form.company_affiliation?.includes("Other"))
                      ? "border-amber-500 bg-amber-500/5 shadow-xs"
                      : "border-border/60 hover:border-amber-500/40 hover:bg-muted/30"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 shrink-0">
                      <Icon icon="solar:hammer-and-wrench-bold-duotone" size={24} />
                    </div>
                    {(form.company_affiliation?.includes("Contractor") || form.company_affiliation?.includes("Other")) && (
                      <span className="flex h-2.5 w-2.5 rounded-full bg-amber-500 ring-4 ring-amber-500/20" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-foreground">Construction / Contractor / Other</div>
                    <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                      External construction civil works, transmission line contractors & infrastructure subcontractors.
                    </p>
                  </div>
                  <div className="pt-2 border-t border-border/40 flex items-center justify-between text-[10px]">
                    <span className="text-muted-foreground">ID Prefix:</span>
                    <Badge variant="outline" className="font-mono font-bold text-amber-700 dark:text-amber-300 border-amber-500/30">
                      others-578879
                    </Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Staff Details, Directorate & Cadre */}
          <Card className={cn(
            "shadow-2xs overflow-hidden border",
            form.company_affiliation?.includes("EEP") ? "border-sky-500/30" : "border-emerald-500/30"
          )}>
            <CardHeader className="pb-3 border-b bg-muted/15 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className={cn(
                  "p-2 rounded-xl",
                  form.company_affiliation?.includes("EEP") ? "bg-sky-500/10 text-sky-600" : "bg-emerald-500/10 text-emerald-600"
                )}>
                  <Icon icon={form.company_affiliation?.includes("EEP") ? "solar:bolt-bold-duotone" : "solar:buildings-bold-duotone"} size={20} />
                </div>
                <div>
                  <CardTitle className="text-xs font-bold">
                    {form.company_affiliation?.includes("EEP")
                      ? "Ethiopian Electric Power (EEP) Occupational Profile"
                      : "Ethiopian Electric Utility (EEU) Occupational Profile"}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {form.company_affiliation?.includes("EEP")
                      ? "Power generation station, dam project, 400kV transmission hub, and payroll links"
                      : "Staff payroll identification, directorate, regional workstation, and medical scheme tiers"}
                  </CardDescription>
                </div>
              </div>
              <Badge
                variant="outline"
                className={cn(
                  "text-[10px] font-bold uppercase",
                  form.company_affiliation?.includes("EEP")
                    ? "text-sky-600 dark:text-sky-400 border-sky-500/30"
                    : "text-emerald-600 border-emerald-500/30"
                )}
              >
                {form.company_affiliation?.includes("EEP") ? "EEP Health Beneficiary" : "EEU Health Directorate"}
              </Badge>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <Label className="text-xs font-semibold text-foreground">
                    {form.company_affiliation?.includes("EEP")
                      ? "EEP Staff / Payroll ID"
                      : (form.company_affiliation?.includes("Contractor") || form.company_affiliation?.includes("Other"))
                      ? "Contractor / Construction ID"
                      : "EEU Staff / Payroll ID"}
                  </Label>
                  <div className="flex items-center mt-1.5">
                    <span
                      className={cn(
                        "inline-flex items-center px-3 h-9 rounded-l-lg border border-r-0 text-xs font-mono font-bold tracking-wider select-none shrink-0",
                        form.company_affiliation?.includes("EEP")
                          ? "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30"
                          : (form.company_affiliation?.includes("Contractor") || form.company_affiliation?.includes("Other"))
                          ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30"
                          : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                      )}
                    >
                      {getCompanyPrefix(form.company_affiliation)}
                    </span>
                    <Input
                      className="h-9 text-xs font-mono rounded-l-none"
                      value={extractStaffNumber(form.eeu_staff_id)}
                      onChange={(e) => {
                        const clean = extractStaffNumber(e.target.value).replace(/[^0-9A-Za-z-]/g, "").trim();
                        update("eeu_staff_id", clean ? `${getCompanyPrefix(form.company_affiliation)}${clean}` : "");
                      }}
                      placeholder={
                        form.company_affiliation?.includes("EEP")
                          ? "e.g. 765767"
                          : (form.company_affiliation?.includes("Contractor") || form.company_affiliation?.includes("Other"))
                          ? "e.g. 578879"
                          : "e.g. 657854"
                      }
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground mt-1 block">
                    System identifier:{" "}
                    <strong className="font-mono text-foreground font-semibold">
                      {form.eeu_staff_id || `${getCompanyPrefix(form.company_affiliation)}[number]`}
                    </strong>
                  </span>
                </div>
                <div>
                  <Label className="text-xs font-semibold text-foreground">Directorate / Department</Label>
                  <select
                    className="w-full border rounded-lg px-3 py-2 text-xs mt-1.5 bg-background h-9 focus:ring-2 focus:ring-primary/20 focus:outline-hidden"
                    value={form.eeu_department}
                    onChange={(e) => update("eeu_department", e.target.value)}
                  >
                    {form.company_affiliation?.includes("EEP") ? (
                      <>
                        <option value="Generation & Hydro Plants (GERD, Gibe, Tekeze, Fincha)">Generation & Hydro Plants (GERD, Gibe, Tekeze, Fincha)</option>
                        <option value="High-Voltage Transmission Grid Directorate (400kV / 500kV)">High-Voltage Transmission Grid Directorate (400kV / 500kV)</option>
                        <option value="Substation Automation, SCADA & Protection Directorate">Substation Automation, SCADA & Protection Directorate</option>
                        <option value="Dam & Project Operations (GERD / Gibe III / Tekeze)">Dam & Project Operations (GERD / Gibe III / Tekeze)</option>
                        <option value="Electro-Mechanical Engineering & Maintenance">Electro-Mechanical Engineering & Maintenance</option>
                        <option value="Wind & Geothermal Projects Directorate">Wind & Geothermal Projects Directorate</option>
                        <option value="Fleet, Heavy Machinery & Regional Logistics">Fleet, Heavy Machinery & Regional Logistics</option>
                        <option value="Corporate Human Resources & Administration">Corporate Human Resources & Administration</option>
                      </>
                    ) : (
                      <>
                        <option value="Distribution Directorate">Distribution Directorate</option>
                        <option value="Transmission Grid Directorate">Transmission Grid Directorate</option>
                        <option value="Generation & Hydro Plants">Generation & Hydro Plants</option>
                        <option value="Customer Services & Metering">Customer Services & Metering</option>
                        <option value="Inspection & Energy Loss Directorate">Inspection & Energy Loss Directorate</option>
                        <option value="Fleet, Logistics & Stores">Fleet, Logistics & Stores</option>
                        <option value="Human Resources & Administration">Human Resources & Administration</option>
                      </>
                    )}
                  </select>
                </div>
                <div>
                  <Label className="text-xs font-semibold text-foreground">Cadre / Job Role</Label>
                  <Input
                    className="mt-1.5 h-9 text-xs"
                    value={form.eeu_cadre}
                    onChange={(e) => update("eeu_cadre", e.target.value)}
                    placeholder={
                      form.company_affiliation?.includes("EEP")
                        ? "e.g., Hydro Turbine Engineer, 400kV Substation Operator"
                        : "e.g., Senior Lineman, Substation Electrician"
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <Label className="text-xs font-semibold text-foreground">Operational Region / Basin</Label>
                  <select
                    className="w-full border rounded-lg px-3 py-2 text-xs mt-1.5 bg-background h-9 focus:ring-2 focus:ring-primary/20 focus:outline-hidden"
                    value={form.eeu_region}
                    onChange={(e) => update("eeu_region", e.target.value)}
                  >
                    <option value="Addis Ababa">Addis Ababa (Head Office / Central Hub)</option>
                    <option value="Oromia">Oromia (Gibe / Melka Wakena)</option>
                    <option value="Amhara">Amhara (Fincha / Tis Abay)</option>
                    <option value="Benishangul-Gumuz">Benishangul-Gumuz (GERD Site)</option>
                    <option value="Sidama">Sidama</option>
                    <option value="Somali">Somali</option>
                    <option value="Tigray">Tigray (Tekeze)</option>
                    <option value="Dire Dawa">Dire Dawa</option>
                    <option value="South West Ethiopia">South West Ethiopia (Gibe III / Koysha)</option>
                    <option value="Central Ethiopia">Central Ethiopia</option>
                    <option value="Afar">Afar (Tendaho / Geothermal)</option>
                  </select>
                </div>
                <div>
                  <Label className="text-xs font-semibold text-foreground">Workstation / Dam Site / Substation</Label>
                  <Input
                    className="mt-1.5 h-9 text-xs"
                    value={form.eeu_work_station}
                    onChange={(e) => update("eeu_work_station", e.target.value)}
                    placeholder={
                      form.company_affiliation?.includes("EEP")
                        ? "e.g., GERD Dam Site Powerhouse / Sululta 400kV Bay"
                        : "e.g., Kality 230kV Substation Bay 4 / AA North CSC"
                    }
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-foreground">Beneficiary Type</Label>
                  <select
                    className="w-full border rounded-lg px-3 py-2 text-xs mt-1.5 bg-background h-9 focus:ring-2 focus:ring-primary/20 focus:outline-hidden"
                    value={form.eeu_beneficiary_type}
                    onChange={(e) => update("eeu_beneficiary_type", e.target.value)}
                  >
                    <option value="Staff">
                      {form.company_affiliation?.includes("EEP") ? "EEP Primary Staff" : "EEU Primary Staff"}
                    </option>
                    <option value="Spouse">Dependent Spouse</option>
                    <option value="Child">Dependent Child</option>
                    <option value="Dependent Parent">Dependent Parent</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {form.eeu_beneficiary_type !== "Staff" && (
                  <div>
                    <Label className="text-xs font-semibold text-foreground">
                      {form.company_affiliation?.includes("EEP")
                        ? "EEP Sponsor Staff ID"
                        : (form.company_affiliation?.includes("Contractor") || form.company_affiliation?.includes("Other"))
                        ? "Sponsor Contractor ID"
                        : "EEU Sponsor Staff ID"}
                    </Label>
                    <div className="flex items-center mt-1.5">
                      <span
                        className={cn(
                          "inline-flex items-center px-3 h-9 rounded-l-lg border border-r-0 text-xs font-mono font-bold tracking-wider select-none shrink-0",
                          form.company_affiliation?.includes("EEP")
                            ? "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30"
                            : (form.company_affiliation?.includes("Contractor") || form.company_affiliation?.includes("Other"))
                            ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30"
                            : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                        )}
                      >
                        {getCompanyPrefix(form.company_affiliation)}
                      </span>
                      <Input
                        className="h-9 text-xs font-mono rounded-l-none"
                        value={extractStaffNumber(form.eeu_primary_staff_id)}
                        onChange={(e) => {
                          const clean = extractStaffNumber(e.target.value).replace(/[^0-9A-Za-z-]/g, "").trim();
                          update("eeu_primary_staff_id", clean ? `${getCompanyPrefix(form.company_affiliation)}${clean}` : "");
                        }}
                        placeholder={
                          form.company_affiliation?.includes("EEP")
                            ? "e.g. 765767"
                            : (form.company_affiliation?.includes("Contractor") || form.company_affiliation?.includes("Other"))
                            ? "e.g. 578879"
                            : "e.g. 657854"
                        }
                      />
                    </div>
                    <span className="text-[10px] text-muted-foreground mt-1 block">
                      Sponsor identifier:{" "}
                      <strong className="font-mono text-foreground font-semibold">
                        {form.eeu_primary_staff_id || `${getCompanyPrefix(form.company_affiliation)}[number]`}
                      </strong>
                    </span>
                  </div>
                )}
                <div>
                  <Label className="text-xs font-semibold text-foreground">Medical Scheme Coverage</Label>
                  <select
                    className="w-full border rounded-lg px-3 py-2 text-xs mt-1.5 bg-background h-9 focus:ring-2 focus:ring-primary/20 focus:outline-hidden"
                    value={form.eeu_medical_coverage_status}
                    onChange={(e) => update("eeu_medical_coverage_status", e.target.value)}
                  >
                    <option value="Active Coverage">Active Coverage</option>
                    <option value="Special Approval">Special Approval</option>
                    <option value="Exceeded Ceiling">Exceeded Ceiling</option>
                    <option value="Suspended">Suspended</option>
                  </select>
                </div>
                <div>
                  <Label className="text-xs font-semibold text-foreground">Occupational Climbing / Safety Fitness</Label>
                  <select
                    className="w-full border rounded-lg px-3 py-2 text-xs mt-1.5 bg-background h-9 focus:ring-2 focus:ring-primary/20 focus:outline-hidden"
                    value={form.eeu_climbing_fitness_status}
                    onChange={(e) => update("eeu_climbing_fitness_status", e.target.value)}
                  >
                    <option value="Fit to Climb">Fit to Climb / High-Elevation Certified</option>
                    <option value="Restricted Ground Duty">Restricted Ground Duty</option>
                    <option value="Temporarily Unfit">Temporarily Unfit</option>
                    <option value="Pending Annual Assessment">Pending Annual Assessment</option>
                    <option value="Not Applicable">Not Applicable (Office / Administrative)</option>
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ─── TAB 4: Risk Factors & Account Setup ─── */}
      {activeTab === "account" && (
        <div className="space-y-6">
          {/* Card 1: Personal, Social & Lifestyle Risk Factors */}
          <Card className="shadow-2xs overflow-hidden">
            <CardHeader className="pb-3 border-b bg-muted/15">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-teal-500/10 text-teal-600">
                  <Icon icon="solar:user-hand-up-bold-duotone" size={20} />
                </div>
                <div>
                  <CardTitle className="text-xs font-bold">Personal, Social & Lifestyle Risk Factors</CardTitle>
                  <CardDescription className="text-xs">
                    Occupation, marital status, and substance exposures
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-5 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-semibold text-foreground">Occupation & Profession</Label>
                  <Input
                    className="mt-1.5 h-9 text-xs"
                    value={form.occupation}
                    onChange={(e) => update("occupation", e.target.value)}
                    placeholder="e.g., Accountant, Builder, Driver..."
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-foreground">Marital Status</Label>
                  <select
                    className="w-full border rounded-lg px-3 py-2 text-xs mt-1.5 bg-background h-9 focus:ring-2 focus:ring-primary/20 focus:outline-hidden"
                    value={form.marital_status}
                    onChange={(e) => update("marital_status", e.target.value)}
                  >
                    <option value="">Select Marital Status</option>
                    <option value="Single">Single</option>
                    <option value="Married">Married</option>
                    <option value="Divorced">Divorced</option>
                    <option value="Widowed">Widowed</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              {/* Substance exposure */}
              <div className="p-4 rounded-xl border bg-muted/10 space-y-4">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
                  Substance Exposures
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-3 rounded-lg border bg-background space-y-2">
                    <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <Icon icon="solar:fire-bold" size={13} className="text-amber-500" />
                      Tobacco Consumption
                    </span>
                    <div>
                      <Label className="text-[10px] text-muted-foreground">Past Use</Label>
                      <Input
                        className="mt-1 h-8 text-xs"
                        value={form.tobacco_past_use}
                        onChange={(e) => update("tobacco_past_use", e.target.value)}
                        placeholder="e.g., Former smoker (quit 2019)"
                      />
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground">Present Use</Label>
                      <Input
                        className="mt-1 h-8 text-xs"
                        value={form.tobacco_current_use}
                        onChange={(e) => update("tobacco_current_use", e.target.value)}
                        placeholder="e.g., None, or 10/day"
                      />
                    </div>
                  </div>

                  <div className="p-3 rounded-lg border bg-background space-y-2">
                    <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <Icon icon="solar:cup-bold" size={13} className="text-purple-500" />
                      Alcohol Consumption
                    </span>
                    <div>
                      <Label className="text-[10px] text-muted-foreground">Past Use</Label>
                      <Input
                        className="mt-1 h-8 text-xs"
                        value={form.alcohol_past_use}
                        onChange={(e) => update("alcohol_past_use", e.target.value)}
                        placeholder="e.g., Occasional"
                      />
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground">Present Use</Label>
                      <Input
                        className="mt-1 h-8 text-xs"
                        value={form.alcohol_current_use}
                        onChange={(e) => update("alcohol_current_use", e.target.value)}
                        placeholder="e.g., Social, or Abstinent"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-semibold text-foreground">
                    Occupational & Environmental Hazards
                  </Label>
                  <textarea
                    className="w-full border rounded-lg p-2.5 text-xs mt-1.5 min-h-[75px] bg-background focus:ring-2 focus:ring-primary/20 focus:outline-hidden"
                    value={form.surrounding_factors}
                    onChange={(e) => update("surrounding_factors", e.target.value)}
                    placeholder="Chemical solvents, excessive heat/noise, dust, high-voltage..."
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-foreground">
                    Other Risk Factors & Family History
                  </Label>
                  <textarea
                    className="w-full border rounded-lg p-2.5 text-xs mt-1.5 min-h-[75px] bg-background focus:ring-2 focus:ring-primary/20 focus:outline-hidden"
                    value={form.other_risk_factors}
                    onChange={(e) => update("other_risk_factors", e.target.value)}
                    placeholder="Family history of CAD, genetic conditions, sedentary habits..."
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Commercial & Billing Configuration */}
          <Card className="shadow-2xs overflow-hidden">
            <CardHeader className="pb-3 border-b bg-muted/15 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600">
                  <Icon icon="solar:wallet-money-bold-duotone" size={20} />
                </div>
                <div>
                  <CardTitle className="text-xs font-bold">Commercial & Billing Classification</CardTitle>
                  <CardDescription className="text-xs">
                    Customer ledger grouping, regional territory, and standard sales price lists
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <Label className="text-xs font-semibold text-foreground">Customer Group</Label>
                  <Input
                    className="mt-1.5 h-9 text-xs"
                    value={form.customer_group}
                    onChange={(e) => update("customer_group", e.target.value)}
                    placeholder="All Customers"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-foreground">Territory</Label>
                  <Input
                    className="mt-1.5 h-9 text-xs"
                    value={form.territory}
                    onChange={(e) => update("territory", e.target.value)}
                    placeholder="All Territories"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-foreground">Default Price List</Label>
                  <Input
                    className="mt-1.5 h-9 text-xs"
                    value={form.default_price_list}
                    onChange={(e) => update("default_price_list", e.target.value)}
                    placeholder="Standard Selling"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card 3: Clinical Intake Notes */}
          <Card className="shadow-2xs overflow-hidden">
            <CardHeader className="pb-3 border-b bg-muted/15 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600">
                  <Icon icon="solar:notes-bold-duotone" size={20} />
                </div>
                <div>
                  <CardTitle className="text-xs font-bold">Initial Intake & Clinical Notes</CardTitle>
                  <CardDescription className="text-xs">
                    Preliminary reception assessment notes or clinical context
                  </CardDescription>
                </div>
              </div>

              {/* Template chips */}
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-muted-foreground font-semibold">Templates:</span>
                <button
                  type="button"
                  onClick={() => applyIntakeTemplate("routine")}
                  className="text-[10px] px-2 py-0.5 rounded-full border bg-background hover:bg-muted text-foreground transition cursor-pointer font-medium"
                >
                  Routine
                </button>
                <button
                  type="button"
                  onClick={() => applyIntakeTemplate("emergency")}
                  className="text-[10px] px-2 py-0.5 rounded-full border border-rose-500/30 bg-rose-500/10 text-rose-700 hover:bg-rose-500/20 transition cursor-pointer font-medium"
                >
                  Emergency
                </button>
                <button
                  type="button"
                  onClick={() => applyIntakeTemplate("pediatric")}
                  className="text-[10px] px-2 py-0.5 rounded-full border bg-background hover:bg-muted text-foreground transition cursor-pointer font-medium"
                >
                  Pediatric
                </button>
              </div>
            </CardHeader>
            <CardContent className="p-5">
              <textarea
                className="w-full border rounded-lg p-3 text-xs min-h-[100px] bg-background focus:ring-2 focus:ring-primary/20 focus:outline-hidden"
                value={form.patient_details}
                onChange={(e) => update("patient_details", e.target.value)}
                placeholder="Document any special clinical instructions, dietary notes, or triage notes..."
              />
            </CardContent>
          </Card>
        </div>
      )}

      {/* ─── Bottom Step Navigation & Confirmation Bar ─── */}
      <div className="sticky bottom-4 z-10 rounded-2xl border bg-card/95 backdrop-blur-md p-4 shadow-lg flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs">
          {activeTab === "medical" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setActiveTab("demographics")}
              className="text-xs h-8 gap-1"
            >
              ← Back: Demographics
            </Button>
          )}
          {activeTab === "eeu" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setActiveTab("medical")}
              className="text-xs h-8 gap-1"
            >
              ← Back: Medical Baseline
            </Button>
          )}
          {activeTab === "account" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setActiveTab("eeu")}
              className="text-xs h-8 gap-1"
            >
              ← Back: EEU Profile
            </Button>
          )}

          <span className="text-muted-foreground text-[11px] hidden sm:inline">
            Drafting: <strong className="text-foreground">{fullNamePreview || "New Patient"}</strong>
          </span>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === "demographics" && (
            <Button
              size="sm"
              onClick={() => setActiveTab("medical")}
              className="h-8 text-xs font-semibold gap-1 bg-muted hover:bg-muted/80 text-foreground"
            >
              Next: Medical Baseline →
            </Button>
          )}
          {activeTab === "medical" && (
            <Button
              size="sm"
              onClick={() => setActiveTab("eeu")}
              className="h-8 text-xs font-semibold gap-1 bg-muted hover:bg-muted/80 text-foreground"
            >
              Next: EEU Profile →
            </Button>
          )}
          {activeTab === "eeu" && (
            <Button
              size="sm"
              onClick={() => setActiveTab("account")}
              className="h-8 text-xs font-semibold gap-1 bg-muted hover:bg-muted/80 text-foreground"
            >
              Next: Risk & Account →
            </Button>
          )}

          <Button
            onClick={handleSave}
            disabled={saving || !canCreate}
            className="h-8 text-xs font-semibold gap-1.5 bg-primary text-primary-foreground shadow-2xs px-5"
          >
            {saving ? (
              <>
                <Icon icon="solar:restart-bold" size={13} className="animate-spin" />
                Registering...
              </>
            ) : (
              <>
                <Icon icon="solar:check-circle-bold" size={13} />
                Register Patient
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
