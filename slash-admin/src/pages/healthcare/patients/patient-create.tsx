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
import BulkEmployeeImportModal from "./components/BulkEmployeeImportModal";

type RegistrationTab = "demographics" | "medical" | "lifestyle";

export default function PatientCreatePage() {
  const { canCreate } = useDoctypePermissions("Patient");
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<RegistrationTab>("demographics");
  const [saving, setSaving] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);

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
    if (affiliation?.includes("EEFC") || affiliation?.includes("Football")) return "EEFC-";
    if (affiliation?.includes("Retired")) return "RET-";
    if (affiliation?.includes("Other")) return "others-";
    return "EEU-";
  };

  const extractStaffNumber = (fullId?: string) => {
    if (!fullId) return "";
    return fullId
      .replace(/^(EEU|EEFC|RET|others)-EMP-?/i, "")
      .replace(/^(EEU|EEFC|RET|others)-/i, "")
      .replace(/^EMP-?/i, "");
  };

  const handleCompanyChange = (newAffiliation: string) => {
    const num = extractStaffNumber(form.eeu_staff_id);
    const primNum = extractStaffNumber(form.eeu_primary_staff_id);
    const newPrefix = getCompanyPrefix(newAffiliation);
    const newStaffId = num ? `${newPrefix}${num}` : "";
    const newPrimId = primNum ? `${newPrefix}${primNum}` : "";

    let newDept = form.eeu_department;
    if (newAffiliation.includes("EEFC") || newAffiliation.includes("Football")) {
      newDept = "Ethiopian Electric Football Club (EEFC)";
    } else if (newAffiliation.includes("Retired")) {
      newDept = "Pension & Retired Staff Directorate";
    } else if (newAffiliation.includes("Other")) {
      newDept = "Other Partner / External Entity";
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
        occupation: form.occupation || form.eeu_cadre || "",
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
    { key: "lifestyle", label: "Lifestyle & Clinical Notes", icon: "solar:shield-bold-duotone", step: "03" },
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
                    form.company_affiliation?.includes("EEFC")
                      ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30"
                      : form.company_affiliation?.includes("Retired")
                      ? "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30"
                      : form.company_affiliation?.includes("Other")
                      ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30"
                      : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                  )}
                >
                  <Icon
                    icon={
                      form.company_affiliation?.includes("EEFC")
                        ? "solar:football-bold"
                        : form.company_affiliation?.includes("Retired")
                        ? "solar:user-heart-bold"
                        : form.company_affiliation?.includes("Other")
                        ? "solar:users-group-two-rounded-bold"
                        : "solar:buildings-bold"
                    }
                    size={10}
                  />
                  {form.company_affiliation?.includes("EEFC")
                    ? "EEFC Football Club"
                    : form.company_affiliation?.includes("Retired")
                    ? "Retired Employee"
                    : form.company_affiliation?.includes("Other")
                    ? "Others"
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
              type="button"
              onClick={() => setShowBulkImport(true)}
              className="h-9 text-xs gap-1.5 border-emerald-500/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10"
            >
              <Icon icon="solar:file-smile-bold" size={14} />
              + Bulk Import Excel
            </Button>
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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-1.5 rounded-2xl border bg-muted/30">
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
          {/* Card 1: Patient Demographics & Scheme Affiliation */}
          <Card className="shadow-2xs overflow-hidden">
            <CardHeader className="pb-3 border-b bg-muted/15 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600">
                  <Icon icon="solar:user-id-bold-duotone" size={20} />
                </div>
                <div>
                  <CardTitle className="text-xs font-bold">Patient Demographics & Scheme Affiliation</CardTitle>
                  <CardDescription className="text-xs">
                    Legal identification, biological data, and corporate health scheme allocation
                  </CardDescription>
                </div>
              </div>
              <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider text-primary border-primary/30">
                Primary Identity
              </Badge>
            </CardHeader>
            <CardContent className="p-5 space-y-5">
              {/* Name Row */}
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

              {/* Bio-data Row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-1">
                <div>
                  <Label className="text-xs font-semibold text-foreground">
                    Gender <span className="text-destructive">*</span>
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

                <div>
                  <Label className="text-xs font-semibold text-foreground">Marital Status</Label>
                  <select
                    className="w-full border rounded-lg px-3 py-2 text-xs mt-1.5 bg-background h-9 focus:ring-2 focus:ring-primary/20 focus:outline-hidden"
                    value={form.marital_status}
                    onChange={(e) => update("marital_status", e.target.value)}
                  >
                    <option value="">Select Status</option>
                    <option value="Single">Single</option>
                    <option value="Married">Married</option>
                    <option value="Divorced">Divorced</option>
                    <option value="Widowed">Widowed</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              {/* Employer Scheme Selection Buttons */}
              <div className="pt-2">
                <Label className="text-xs font-semibold text-foreground mb-1.5 block">
                  Employer Scheme Sponsorship
                </Label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { label: "Ethiopian Electric Utility (EEU)", prefix: "EEU-", icon: "solar:transmission-bold-duotone", activeClass: "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
                    { label: "Ethiopian Electric Football club (EEFC)", prefix: "EEFC-", icon: "solar:football-bold-duotone", activeClass: "border-blue-500 bg-blue-500/10 text-blue-700 dark:text-blue-300" },
                    { label: "Retired Employee", prefix: "RET-", icon: "solar:user-heart-bold-duotone", activeClass: "border-purple-500 bg-purple-500/10 text-purple-700 dark:text-purple-300" },
                    { label: "Others", prefix: "others-", icon: "solar:users-group-two-rounded-bold-duotone", activeClass: "border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-300" },
                  ].map((scheme) => {
                    const isSelected =
                      (scheme.prefix === "EEFC-" && (form.company_affiliation?.includes("EEFC") || form.company_affiliation?.includes("Football"))) ||
                      (scheme.prefix === "RET-" && form.company_affiliation?.includes("Retired")) ||
                      (scheme.prefix === "others-" && form.company_affiliation?.includes("Other")) ||
                      (scheme.prefix === "EEU-" && !form.company_affiliation?.includes("EEFC") && !form.company_affiliation?.includes("Retired") && !form.company_affiliation?.includes("Other"));
                    return (
                      <button
                        key={scheme.prefix}
                        type="button"
                        onClick={() => handleCompanyChange(scheme.label)}
                        className={cn(
                          "p-2.5 rounded-xl border text-left transition-all flex items-center gap-2 cursor-pointer",
                          isSelected
                            ? `${scheme.activeClass} font-semibold shadow-xs ring-1 ring-primary/20`
                            : "border-border/60 hover:bg-muted/40 text-muted-foreground hover:text-foreground"
                        )}
                      >
                        <Icon icon={scheme.icon} size={18} className="shrink-0" />
                        <div className="min-w-0">
                          <div className="text-xs truncate">{scheme.label}</div>
                          <div className="text-[10px] opacity-70 font-mono font-bold">{scheme.prefix}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Staff ID & Employment Row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
                <div>
                  <Label className="text-xs font-semibold text-foreground">
                    Staff / Member ID
                  </Label>
                  <div className="flex items-center mt-1.5">
                    <span className="inline-flex items-center px-2.5 h-9 rounded-l-lg border border-r-0 text-xs font-mono font-bold tracking-wider bg-muted/60 text-foreground select-none shrink-0">
                      {getCompanyPrefix(form.company_affiliation)}
                    </span>
                    <Input
                      className="h-9 text-xs font-mono rounded-l-none"
                      value={extractStaffNumber(form.eeu_staff_id)}
                      onChange={(e) => {
                        const clean = extractStaffNumber(e.target.value).replace(/[^0-9A-Za-z-]/g, "").trim();
                        update("eeu_staff_id", clean ? `${getCompanyPrefix(form.company_affiliation)}${clean}` : "");
                      }}
                      placeholder="e.g. 657854"
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-semibold text-foreground">Directorate / Department</Label>
                  <Input
                    className="mt-1.5 h-9 text-xs"
                    value={form.eeu_department}
                    onChange={(e) => update("eeu_department", e.target.value)}
                    placeholder="e.g., Distribution Directorate"
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold text-foreground">Job Role / Cadre</Label>
                  <Input
                    className="mt-1.5 h-9 text-xs"
                    value={form.eeu_cadre}
                    onChange={(e) => update("eeu_cadre", e.target.value)}
                    placeholder="e.g., Senior Lineman, Substation Electrician"
                  />
                </div>
              </div>

              {/* Beneficiary Tier & Sponsor Row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
                <div>
                  <Label className="text-xs font-semibold text-foreground">Beneficiary Category</Label>
                  <select
                    className="w-full border rounded-lg px-3 py-2 text-xs mt-1.5 bg-background h-9 focus:ring-2 focus:ring-primary/20 focus:outline-hidden"
                    value={form.eeu_beneficiary_type}
                    onChange={(e) => update("eeu_beneficiary_type", e.target.value)}
                  >
                    <option value="Staff">Primary Staff / Member</option>
                    <option value="Spouse">Dependent Spouse</option>
                    <option value="Child">Dependent Child</option>
                    <option value="Dependent Parent">Dependent Parent</option>
                  </select>
                </div>

                {form.eeu_beneficiary_type !== "Staff" ? (
                  <div>
                    <Label className="text-xs font-semibold text-foreground">Sponsor Staff ID</Label>
                    <div className="flex items-center mt-1.5">
                      <span className="inline-flex items-center px-2.5 h-9 rounded-l-lg border border-r-0 text-xs font-mono font-bold tracking-wider bg-muted/60 text-foreground select-none shrink-0">
                        {getCompanyPrefix(form.company_affiliation)}
                      </span>
                      <Input
                        className="h-9 text-xs font-mono rounded-l-none"
                        value={extractStaffNumber(form.eeu_primary_staff_id)}
                        onChange={(e) => {
                          const clean = extractStaffNumber(e.target.value).replace(/[^0-9A-Za-z-]/g, "").trim();
                          update("eeu_primary_staff_id", clean ? `${getCompanyPrefix(form.company_affiliation)}${clean}` : "");
                        }}
                        placeholder="e.g. 657854"
                      />
                    </div>
                  </div>
                ) : (
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
                )}

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
                    <option value="Not Applicable">Not Applicable (Office / Dependent)</option>
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Contact Information & Residence Address */}
          <Card className="shadow-2xs overflow-hidden">
            <CardHeader className="pb-3 border-b bg-muted/15 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600">
                  <Icon icon="solar:phone-calling-bold-duotone" size={20} />
                </div>
                <div>
                  <CardTitle className="text-xs font-bold">Contact & Residential Address</CardTitle>
                  <CardDescription className="text-xs">
                    Telephony, electronic notifications, and physical residence location
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              {/* Telephony & Digital */}
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
                  <Label className="text-xs font-semibold text-muted-foreground">Alternate / Landline</Label>
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

              {/* Residence & Region */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
                <div>
                  <Label className="text-xs font-semibold text-foreground">Operational Region / State</Label>
                  <select
                    className="w-full border rounded-lg px-3 py-2 text-xs mt-1.5 bg-background h-9 focus:ring-2 focus:ring-primary/20 focus:outline-hidden"
                    value={form.eeu_region}
                    onChange={(e) => {
                      update("eeu_region", e.target.value);
                      update("state", e.target.value);
                    }}
                  >
                    <option value="Addis Ababa">Addis Ababa (Head Office / Central Hub)</option>
                    <option value="Oromia">Oromia Regional Directorate</option>
                    <option value="Amhara">Amhara Regional Directorate</option>
                    <option value="Sidama">Sidama Regional Directorate</option>
                    <option value="Somali">Somali Regional Directorate</option>
                    <option value="Tigray">Tigray Regional Directorate</option>
                    <option value="Dire Dawa">Dire Dawa Center</option>
                    <option value="South West Ethiopia">South West Ethiopia Directorate</option>
                    <option value="Central Ethiopia">Central Ethiopia Directorate</option>
                  </select>
                </div>

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
                  <Label className="text-xs font-semibold text-foreground">Workstation / Depot Station</Label>
                  <Input
                    className="mt-1.5 h-9 text-xs"
                    value={form.eeu_work_station}
                    onChange={(e) => update("eeu_work_station", e.target.value)}
                    placeholder="e.g., Kality 230kV Substation Bay 4"
                  />
                </div>
              </div>

              {/* Physical Street Address & Communication Prefs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div>
                  <Label className="text-xs font-semibold text-foreground">Street Address / Kebele / House #</Label>
                  <Input
                    className="mt-1.5 h-9 text-xs"
                    value={form.address}
                    onChange={(e) => update("address", e.target.value)}
                    placeholder="Street, Woreda, Kebele, House #"
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold text-foreground">Report Preference & Portal</Label>
                  <div className="flex items-center gap-3 mt-1.5">
                    <select
                      className="flex-1 border rounded-lg px-3 py-2 text-xs bg-background h-9 focus:ring-2 focus:ring-primary/20 focus:outline-hidden"
                      value={form.report_preference}
                      onChange={(e) => update("report_preference", e.target.value)}
                    >
                      <option value="Email">Email (PDF Report)</option>
                      <option value="Patient Portal">Patient Portal</option>
                      <option value="Print">Counter Print</option>
                    </select>

                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground whitespace-nowrap cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={form.invite_user}
                        onChange={(e) => update("invite_user", e.target.checked)}
                        className="rounded border-border text-primary focus:ring-primary h-4 w-4"
                      />
                      <span>Invite Portal</span>
                    </label>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Bulk Import Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent border border-emerald-500/25">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 shrink-0">
                <Icon icon="solar:file-smile-bold-duotone" size={20} />
              </div>
              <div>
                <div className="text-xs font-bold text-foreground">Need to add employees in bulk from a spreadsheet?</div>
                <p className="text-[11px] text-muted-foreground">
                  Upload an Excel (.xlsx or .csv) file to auto-enroll multiple staff members with validation.
                </p>
              </div>
            </div>
            <Button
              type="button"
              size="sm"
              onClick={() => setShowBulkImport(true)}
              className="h-8 text-xs font-semibold gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white shrink-0 shadow-xs"
            >
              <Icon icon="solar:upload-track-2-bold" size={14} />
              Bulk Import Spreadsheet
            </Button>
          </div>
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

      {/* ─── TAB 3: Lifestyle & Clinical Notes ─── */}
      {activeTab === "lifestyle" && (
        <div className="space-y-6">
          {/* Card 1: Personal, Social & Lifestyle Risk Factors */}
          <Card className="shadow-2xs overflow-hidden">
            <CardHeader className="pb-3 border-b bg-muted/15">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-teal-500/10 text-teal-600">
                  <Icon icon="solar:user-hand-up-bold-duotone" size={20} />
                </div>
                <div>
                  <CardTitle className="text-xs font-bold">Lifestyle Exposures & Environmental Risk Factors</CardTitle>
                  <CardDescription className="text-xs">
                    Substance consumption history and environmental occupational risks
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-5 space-y-5">

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
              ← Back: Demographics & Scheme
            </Button>
          )}
          {activeTab === "lifestyle" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setActiveTab("medical")}
              className="text-xs h-8 gap-1"
            >
              ← Back: Medical Baseline
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
              onClick={() => setActiveTab("lifestyle")}
              className="h-8 text-xs font-semibold gap-1 bg-muted hover:bg-muted/80 text-foreground"
            >
              Next: Lifestyle & Clinical Notes →
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

      <BulkEmployeeImportModal
        open={showBulkImport}
        onOpenChange={setShowBulkImport}
        onSuccess={() => navigate("/healthcare/patients")}
      />
    </div>
  );
}
