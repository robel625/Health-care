import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/ui/card";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { Badge } from "@/ui/badge";
import { Icon } from "@/components/icon";
import Avatar from "@/components/Avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/ui/dialog";
import { Label } from "@/ui/label";
import { HealthcareApi } from "@/api/services/healthcareService";
import type { Patient } from "@/api/services/healthcareService";
import { toast } from "sonner";
import { useClinicStore } from "@/store/clinicStore";
import EEUMedicalIdCardModal from "./components/EEUMedicalIdCardModal";
import { cn } from "@/utils";

export default function EEUStaffRegistryPage() {
  const navigate = useNavigate();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [beneficiaryFilter, setBeneficiaryFilter] = useState("all");
  const [deptFilter, setDeptFilter] = useState("all");
  const [quotaFilter, setQuotaFilter] = useState("all");
  const [companyFilter, setCompanyFilter] = useState<"all" | "EEU" | "EEFC" | "RET" | "others">("all");

  // Clinic switcher integration
  const activeClinic = useClinicStore((s) => s.activeClinic);
  const setActiveClinicId = useClinicStore((s) => s.setActiveClinicId);

  // Digital Medical ID Card Modal
  const [idCardPatient, setIdCardPatient] = useState<Patient | null>(null);

  // Adjust Quota Modal State
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [ceilingInput, setCeilingInput] = useState<number>(25000);
  const [usedInput, setUsedInput] = useState<number>(0);
  const [expenseToAdd, setExpenseToAdd] = useState<number | "">("");
  const [statusInput, setStatusInput] = useState<string>("Active Coverage");
  const [savingQuota, setSavingQuota] = useState(false);

  useEffect(() => {
    loadStaff();
  }, []);

  const loadStaff = async () => {
    setLoading(true);
    try {
      const res = await HealthcareApi.patients.list({ page_size: 150 });
      setPatients(res.results || []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load staff records");
    } finally {
      setLoading(false);
    }
  };

  const openQuotaModal = (p: Patient) => {
    setSelectedPatient(p);
    setCeilingInput(p.eeu_annual_benefit_ceiling_etb || 25000);
    setUsedInput(p.eeu_benefit_used_etb || 0);
    setExpenseToAdd("");
    setStatusInput(p.eeu_medical_coverage_status || "Active Coverage");
  };

  const handleSaveQuota = async () => {
    if (!selectedPatient) return;
    setSavingQuota(true);

    const expense = typeof expenseToAdd === "number" ? expenseToAdd : 0;
    const finalUsed = Number(usedInput) + expense;
    const finalCeiling = Number(ceilingInput) || 25000;

    let computedStatus = statusInput;
    if (finalUsed >= finalCeiling && statusInput === "Active Coverage") {
      computedStatus = "Exceeded Ceiling";
    }

    try {
      await HealthcareApi.patients.patch(selectedPatient.id, {
        eeu_annual_benefit_ceiling_etb: finalCeiling,
        eeu_benefit_used_etb: finalUsed,
        eeu_medical_coverage_status: computedStatus,
      });

      toast.success(
        `Updated EEU medical quota for ${selectedPatient.patient_name}: ETB ${finalUsed.toLocaleString()} used of ${finalCeiling.toLocaleString()} ETB ceiling`
      );

      // Update in local state
      setPatients((prev) =>
        prev.map((item) =>
          item.id === selectedPatient.id
            ? {
                ...item,
                eeu_annual_benefit_ceiling_etb: finalCeiling,
                eeu_benefit_used_etb: finalUsed,
                eeu_medical_coverage_status: computedStatus,
              }
            : item
        )
      );

      setSelectedPatient(null);
    } catch (err) {
      console.error(err);
      toast.error("Failed to update medical quota");
    } finally {
      setSavingQuota(false);
    }
  };

  const filteredStaff = patients.filter((p) => {
    const matchesSearch =
      (p.patient_name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.eeu_staff_id || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.eeu_cadre || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.eeu_work_station || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.mobile || "").toLowerCase().includes(searchQuery.toLowerCase());

    const matchesBen =
      beneficiaryFilter === "all" || p.eeu_beneficiary_type === beneficiaryFilter;
    const matchesDept =
      deptFilter === "all" || p.eeu_department === deptFilter;

    const ceiling = p.eeu_annual_benefit_ceiling_etb || 25000;
    const used = p.eeu_benefit_used_etb || 0;
    const pct = Math.round((used / ceiling) * 100);

    let matchesQuota = true;
    if (quotaFilter === "safe") matchesQuota = pct < 60;
    else if (quotaFilter === "moderate") matchesQuota = pct >= 60 && pct < 85;
    else if (quotaFilter === "critical") matchesQuota = pct >= 85;

    // Clinic-level filtering: single clinic for all staff
    const matchesClinic = true;

    // Company affiliation filtering
    const isEEFC = Boolean(
      (p.company_affiliation || "").includes("EEFC") ||
      (p.company_affiliation || "").includes("Football") ||
      (p.eeu_staff_id || "").startsWith("EEFC")
    );
    const isRetired = Boolean(
      (p.company_affiliation || "").includes("Retired") ||
      (p.eeu_staff_id || "").startsWith("RET")
    );
    const isOthers = Boolean(
      (p.company_affiliation || "").includes("Other") ||
      (p.company_affiliation || "").includes("Contractor") ||
      (p.eeu_staff_id || "").startsWith("others")
    );
    const isEEU = !isEEFC && !isRetired && !isOthers;

    let matchesCompany = true;
    if (companyFilter === "EEU") matchesCompany = isEEU;
    if (companyFilter === "EEFC") matchesCompany = isEEFC;
    if (companyFilter === "RET") matchesCompany = isRetired;
    if (companyFilter === "others") matchesCompany = isOthers;

    return matchesSearch && matchesBen && matchesDept && matchesQuota && matchesClinic && matchesCompany;
  });

  return (
    <div className="space-y-6 p-2 md:p-4">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            EEU Corporate Health Directory
          </h1>
          <p className="text-sm text-muted-foreground">
            Employee payroll links, ETB medical quota trackers, and occupational cadre records across Ethiopian Electric Utility (EEU), EEFC, Retired Employees, and Others
          </p>
        </div>
        <Button
          onClick={() => navigate("/healthcare/patients/new")}
          className="gap-2 bg-primary font-semibold text-primary-foreground shadow-md"
        >
          <Icon icon="solar:user-plus-bold" size={18} />
          Register Corporate Staff / Dependent
        </Button>
      </div>

      {/* Active Clinic Context Banner */}
      {activeClinic.id !== "all" && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-900 dark:text-emerald-200">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
              <Icon icon="solar:hospital-bold-duotone" size={20} />
            </div>
            <div>
              <span className="font-bold text-foreground">Active Clinic Filter: </span>
              <span>{activeClinic.name}</span>
              <span className="text-muted-foreground ml-1.5 font-mono text-[11px]">
                ({activeClinic.region} • {activeClinic.substationTag})
              </span>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setActiveClinicId("all")}
            className="h-8 text-xs text-emerald-700 hover:text-emerald-900 dark:text-emerald-300 dark:hover:text-white gap-1.5 self-start sm:self-auto"
          >
            <Icon icon="solar:global-bold" size={14} />
            Show National Roster
          </Button>
        </div>
      )}

      {/* Filter Bar */}
      <Card className="border-border/60">
        <CardContent className="p-4 space-y-3">
          {/* Company Affiliation Selector Pills */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-border/40">
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-muted/50 border">
              <button
                type="button"
                onClick={() => setCompanyFilter("all")}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer",
                  companyFilter === "all"
                    ? "bg-background text-foreground shadow-xs font-bold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                All Personnel ({patients.length})
              </button>
              <button
                type="button"
                onClick={() => setCompanyFilter("EEU")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer",
                  companyFilter === "EEU"
                    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 font-bold shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon icon="solar:buildings-bold" size={13} className="text-emerald-500" />
                EEU ({patients.filter((p) => !(p.company_affiliation?.includes("EEFC") || p.eeu_staff_id?.startsWith("EEFC") || p.company_affiliation?.includes("Retired") || p.eeu_staff_id?.startsWith("RET") || p.company_affiliation?.includes("Other") || p.eeu_staff_id?.startsWith("others"))).length})
              </button>
              <button
                type="button"
                onClick={() => setCompanyFilter("EEFC")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer",
                  companyFilter === "EEFC"
                    ? "bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/30 font-bold shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon icon="solar:football-bold" size={13} className="text-blue-500" />
                EEFC ({patients.filter((p) => (p.company_affiliation?.includes("EEFC") || p.eeu_staff_id?.startsWith("EEFC"))).length})
              </button>
              <button
                type="button"
                onClick={() => setCompanyFilter("RET")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer",
                  companyFilter === "RET"
                    ? "bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/30 font-bold shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon icon="solar:user-heart-bold" size={13} className="text-purple-500" />
                Retired ({patients.filter((p) => (p.company_affiliation?.includes("Retired") || p.eeu_staff_id?.startsWith("RET"))).length})
              </button>
              <button
                type="button"
                onClick={() => setCompanyFilter("others")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer",
                  companyFilter === "others"
                    ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30 font-bold shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon icon="solar:users-group-two-rounded-bold" size={13} className="text-amber-500" />
                Others ({patients.filter((p) => (p.company_affiliation?.includes("Other") || p.company_affiliation?.includes("Contractor") || p.eeu_staff_id?.startsWith("others"))).length})
              </button>
            </div>

            <div className="text-[11px] text-muted-foreground font-medium">
              Showing <span className="font-bold text-foreground font-mono">{filteredStaff.length}</span> verified personnel
            </div>
          </div>

          <div className="flex flex-col gap-3 md:flex-row">
            <div className="relative flex-1">
              <Icon icon="solar:magnifer-linear" className="absolute left-3 top-3 text-muted-foreground" size={16} />
              <Input
                placeholder="Search by staff ID (e.g. EEU-657854, EEP-765767, or others-578879), name, cadre, or workstation..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex flex-wrap gap-2">
            <select
              value={beneficiaryFilter}
              onChange={(e) => setBeneficiaryFilter(e.target.value)}
              className="h-10 rounded-md border border-input bg-background px-3 py-2 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="all">All Beneficiaries</option>
              <option value="Staff">EEU Primary Staff</option>
              <option value="Spouse">Dependent Spouse</option>
              <option value="Child">Dependent Child</option>
              <option value="Dependent Parent">Dependent Parent</option>
            </select>

            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="h-10 rounded-md border border-input bg-background px-3 py-2 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="all">All Directorates</option>
              <option value="Distribution Directorate">Distribution Directorate</option>
              <option value="Transmission Grid Directorate">Transmission Grid Directorate</option>
              <option value="Generation & Hydro Plants">Generation & Hydro Plants</option>
              <option value="Customer Services & Metering">Customer Services & Metering</option>
            </select>

            <select
              value={quotaFilter}
              onChange={(e) => setQuotaFilter(e.target.value)}
              className="h-10 rounded-md border border-input bg-background px-3 py-2 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="all">All ETB Quotas</option>
              <option value="safe">Safe Usage (&lt; 60%)</option>
              <option value="moderate">Moderate Usage (60% - 85%)</option>
              <option value="critical">Near / Exceeded Ceiling (&gt; 85%)</option>
            </select>
          </div>
        </div>
      </CardContent>
    </Card>

      {/* Staff Table */}
      <Card className="border-border/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">
            Registered Personnel & Dependents ({filteredStaff.length})
          </CardTitle>
          <CardDescription>
            Comprehensive directory with climbing fitness clearance and ETB annual benefit quota tracking
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex h-32 items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : filteredStaff.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No staff or dependent records found matching your query.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border/50 text-xs text-muted-foreground">
                    <th className="py-3 px-2">Staff / Payroll ID</th>
                    <th className="py-3 px-2">Employee / Dependent</th>
                    <th className="py-3 px-2">Beneficiary Type</th>
                    <th className="py-3 px-2">Directorate & Workstation</th>
                    <th className="py-3 px-2">Cadre / Designation</th>
                    <th className="py-3 px-2">Climbing Fitness</th>
                    <th className="py-3 px-2">Annual ETB Benefit Quota</th>
                    <th className="py-3 px-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {filteredStaff.map((p) => {
                    const ceiling = p.eeu_annual_benefit_ceiling_etb || 25000;
                    const used = p.eeu_benefit_used_etb || 0;
                    const remaining = Math.max(0, ceiling - used);
                    const pct = Math.min(100, Math.round((used / ceiling) * 100));

                    const barColor =
                      pct >= 85
                        ? "bg-rose-500"
                        : pct >= 60
                        ? "bg-amber-500"
                        : "bg-emerald-500";

                    const isEEFC = Boolean(
                      (p.company_affiliation || "").includes("EEFC") ||
                      (p.company_affiliation || "").includes("Football") ||
                      (p.eeu_staff_id || "").startsWith("EEFC")
                    );
                    const isRetired = Boolean(
                      (p.company_affiliation || "").includes("Retired") ||
                      (p.eeu_staff_id || "").startsWith("RET")
                    );
                    const isOthers = Boolean(
                      (p.company_affiliation || "").includes("Other") ||
                      (p.company_affiliation || "").includes("Contractor") ||
                      (p.eeu_staff_id || "").startsWith("others")
                    );

                    return (
                      <tr key={p.id} className="transition-colors hover:bg-muted/30">
                        <td className="py-3 px-2 font-mono text-xs font-bold">
                          <div className="flex items-center gap-1.5">
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[9px] px-1.5 py-0 font-bold uppercase",
                                isEEFC
                                  ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30"
                                  : isRetired
                                  ? "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30"
                                  : isOthers
                                  ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30"
                                  : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                              )}
                            >
                              {isEEFC ? "EEFC" : isRetired ? "RET" : isOthers ? "Others" : "EEU"}
                            </Badge>
                            <span className="text-primary">{p.eeu_staff_id || p.patient_id}</span>
                          </div>
                        </td>
                        <td className="py-3 px-2">
                          <div className="flex items-center gap-2">
                            <Avatar name={p.patient_name} className="h-7 w-7 text-xs" />
                            <div>
                              <div className="font-medium text-foreground">{p.patient_name}</div>
                              <div className="text-[11px] text-muted-foreground">
                                {p.sex || "Staff"} • {p.age || "Adult"} yrs • {p.mobile || "No phone"}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-2">
                          <Badge
                            variant="outline"
                            className={
                              p.eeu_beneficiary_type === "Staff"
                                ? "border-primary/40 text-primary"
                                : "border-muted-foreground/30 text-muted-foreground"
                            }
                          >
                            {p.eeu_beneficiary_type || "Staff"}
                          </Badge>
                          {p.eeu_primary_staff_id && (
                            <div className="mt-0.5 text-[10px] font-mono text-muted-foreground">
                              Ref: {p.eeu_primary_staff_id}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-2">
                          <div className="text-xs font-medium text-foreground">
                            {p.eeu_department || "EEU Operations"}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            {p.eeu_work_station || p.eeu_region || "Ethiopia"}
                          </div>
                        </td>
                        <td className="py-3 px-2 text-xs text-foreground">
                          {p.eeu_cadre || p.occupation || "EEU Employee"}
                        </td>
                        <td className="py-3 px-2">
                          {p.eeu_climbing_fitness_status && p.eeu_climbing_fitness_status !== "Not Applicable" ? (
                            <Badge
                              className={
                                p.eeu_climbing_fitness_status.includes("Fit to Climb")
                                  ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                                  : p.eeu_climbing_fitness_status.includes("Restricted")
                                  ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                                  : "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                              }
                            >
                              {p.eeu_climbing_fitness_status}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">N/A</span>
                          )}
                        </td>
                        <td className="py-3 px-2 min-w-[190px]">
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-mono font-semibold text-foreground">
                                ETB {used.toLocaleString()}
                              </span>
                              <span className="font-mono text-[11px] text-muted-foreground">
                                / {ceiling.toLocaleString()} ETB
                              </span>
                            </div>

                            {/* Progress Track */}
                            <div className="h-2 w-full overflow-hidden rounded-full bg-muted/60">
                              <div
                                className={`h-full transition-all duration-300 ${barColor}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>

                            <div className="flex items-center justify-between text-[11px]">
                              <span className="text-muted-foreground">
                                {remaining > 0 ? (
                                  `${remaining.toLocaleString()} ETB left`
                                ) : (
                                  <span className="font-bold text-rose-600 dark:text-rose-400">Ceiling Exceeded</span>
                                )}
                              </span>
                              <button
                                type="button"
                                onClick={() => openQuotaModal(p)}
                                className="font-medium text-primary hover:underline cursor-pointer"
                                title="Adjust Quota or Log Medical Expense"
                              >
                                {pct}% • Adjust
                              </button>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-2 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setIdCardPatient(p)}
                              className="h-8 px-2 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10 gap-1 font-medium"
                              title="Generate EEU Digital Medical ID Card"
                            >
                              <Icon icon="solar:user-id-bold-duotone" size={15} />
                              <span className="hidden sm:inline">Medical ID</span>
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openQuotaModal(p)}
                              className="h-8 px-2 text-xs text-muted-foreground hover:text-primary gap-1"
                              title="Update Quota & Log Bill"
                            >
                              <Icon icon="solar:calculator-linear" size={15} />
                              <span className="hidden sm:inline">Quota</span>
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => navigate(`/healthcare/patients/${p.id}`)}
                              className="h-8 w-8 p-0"
                              title="View Full Health Record"
                            >
                              <Icon icon="solar:arrow-right-bold" size={16} />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Adjust Quota & Log Medical Expense Modal */}
      {selectedPatient && (
        <Dialog open={!!selectedPatient} onOpenChange={(open) => !open && setSelectedPatient(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-primary/10 text-primary">
                  <Icon icon="solar:wallet-money-bold-duotone" size={22} />
                </div>
                <div>
                  <DialogTitle className="text-base font-bold">EEU Medical Quota & Expense Tracker</DialogTitle>
                  <DialogDescription className="text-xs">
                    {selectedPatient.patient_name} • {selectedPatient.eeu_staff_id || selectedPatient.patient_id} ({selectedPatient.eeu_beneficiary_type || "Staff"})
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-4 py-2 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-[11px] font-semibold text-foreground/80 mb-1 block">
                    Annual Quota Ceiling (ETB)
                  </Label>
                  <Input
                    type="number"
                    value={ceilingInput}
                    onChange={(e) => setCeilingInput(Number(e.target.value))}
                    className="h-9 font-mono"
                  />
                  <span className="text-[10px] text-muted-foreground">Standard EEU allowance: 25,000 ETB</span>
                </div>
                <div>
                  <Label className="text-[11px] font-semibold text-foreground/80 mb-1 block">
                    Accumulated Used (ETB)
                  </Label>
                  <Input
                    type="number"
                    value={usedInput}
                    onChange={(e) => setUsedInput(Number(e.target.value))}
                    className="h-9 font-mono"
                  />
                  <span className="text-[10px] text-muted-foreground">Existing logged claims</span>
                </div>
              </div>

              <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 space-y-2">
                <Label className="text-[11px] font-bold text-primary flex items-center gap-1.5">
                  <Icon icon="solar:bag-plus-bold" size={14} />
                  Log New Medical Expense / Prescription Bill (ETB)
                </Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder="Enter bill amount (e.g. 750 ETB)..."
                    value={expenseToAdd}
                    onChange={(e) => setExpenseToAdd(e.target.value === "" ? "" : Number(e.target.value))}
                    className="h-9 font-mono bg-background"
                  />
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {[250, 500, 1000, 2500, 5000].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setExpenseToAdd(amt)}
                      className="px-2 py-0.5 rounded text-[10px] font-mono border bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                    >
                      +ETB {amt.toLocaleString()}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label className="text-[11px] font-semibold text-foreground/80 mb-1 block">
                  Medical Coverage Status
                </Label>
                <select
                  value={statusInput}
                  onChange={(e) => setStatusInput(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="Active Coverage">Active Coverage (Good Standing)</option>
                  <option value="Special Approval">Special Approval (Executive Exception)</option>
                  <option value="Exceeded Ceiling">Exceeded Ceiling (Further claims blocked)</option>
                  <option value="Suspended">Suspended</option>
                </select>
              </div>

              {/* Real-time Summary preview */}
              {(() => {
                const add = typeof expenseToAdd === "number" ? expenseToAdd : 0;
                const newUsed = Number(usedInput) + add;
                const newCeiling = Number(ceilingInput) || 25000;
                const newRemaining = Math.max(0, newCeiling - newUsed);
                const newPct = Math.min(100, Math.round((newUsed / newCeiling) * 100));

                return (
                  <div className="rounded-lg bg-muted/40 p-3 space-y-1.5 border border-border/50">
                    <div className="flex justify-between items-center text-xs font-medium">
                      <span className="text-muted-foreground">New Calculated Used:</span>
                      <span className="font-mono font-bold text-foreground">ETB {newUsed.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs font-medium">
                      <span className="text-muted-foreground">Remaining Allowance:</span>
                      <span className={`font-mono font-bold ${newRemaining <= 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                        ETB {newRemaining.toLocaleString()} ({newPct}% used)
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-background border">
                      <div
                        className={`h-full transition-all duration-200 ${
                          newPct >= 85 ? "bg-rose-500" : newPct >= 60 ? "bg-amber-500" : "bg-emerald-500"
                        }`}
                        style={{ width: `${newPct}%` }}
                      />
                    </div>
                  </div>
                );
              })()}
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedPatient(null)}
                disabled={savingQuota}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSaveQuota}
                disabled={savingQuota}
                className="gap-1.5 bg-primary text-primary-foreground font-semibold"
              >
                {savingQuota ? (
                  <>
                    <Icon icon="solar:refresh-bold" className="animate-spin" size={14} />
                    Saving...
                  </>
                ) : (
                  <>
                    <Icon icon="solar:check-read-bold" size={14} />
                    Update Quota
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Digital EEU Medical ID Card Modal */}
      <EEUMedicalIdCardModal
        patient={idCardPatient}
        open={!!idCardPatient}
        onClose={() => setIdCardPatient(null)}
      />
    </div>
  );
}

