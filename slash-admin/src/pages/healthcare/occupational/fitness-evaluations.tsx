import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/ui/card";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { Badge } from "@/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/ui/dialog";
import { Icon } from "@/components/icon";
import { HealthcareApi } from "@/api/services/healthcareService";
import type { EEUFitnessEvaluation, Patient, HealthcarePractitioner } from "@/api/services/healthcareService";
import { toast } from "sonner";

export default function EEUFitnessEvaluationsPage() {
  const [evaluations, setEvaluations] = useState<EEUFitnessEvaluation[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [practitioners, setPractitioners] = useState<HealthcarePractitioner[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [climbingFilter, setClimbingFilter] = useState("all");

  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    patient: "",
    practitioner: "",
    evaluation_type: "Annual High-Voltage Climbing Exam",
    climbing_fitness: "Fit to Climb (Certified)",
    color_vision: "Normal Color Vision (Ishihara 15/15)",
    audiometry_hearing: "Normal Bilateral Hearing",
    cardiovascular_status: "Normal / Cleared for Heavy Exertion",
    vertigo_vestibular_check: "Negative (No Vertigo / Cleared for Heights)",
    physician_remarks: "",
    status: "Certified & Valid",
  });

  const [selectedEval, setSelectedEval] = useState<EEUFitnessEvaluation | null>(null);
  const [activeTab, setActiveTab] = useState<"all" | "expiring_soon" | "expired" | "fit" | "restricted">("all");

  useEffect(() => {
    loadEvaluations();
    loadPatients();
    loadPractitioners();
  }, []);

  const loadEvaluations = async () => {
    setLoading(true);
    try {
      const res = await HealthcareApi.eeuFitnessEvaluations.list();
      setEvaluations(res.results || []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load fitness evaluations");
    } finally {
      setLoading(false);
    }
  };

  const loadPatients = async () => {
    try {
      const res = await HealthcareApi.patients.list({ page_size: 100 });
      setPatients(res.results || []);
    } catch (err) {
      console.error(err);
    }
  };

  const loadPractitioners = async () => {
    try {
      const res = await HealthcareApi.practitioners.list({ page_size: 50 });
      setPractitioners(res.results || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.patient) {
      toast.error("Please select a technician / lineman");
      return;
    }

    setSaving(true);
    try {
      await HealthcareApi.eeuFitnessEvaluations.create({
        ...form,
        patient: Number(form.patient),
        practitioner: form.practitioner ? Number(form.practitioner) : null,
      });
      toast.success("Lineman Climbing Fitness Examination recorded");
      setModalOpen(false);
      loadEvaluations();
    } catch (err) {
      console.error(err);
      toast.error("Failed to save evaluation");
    } finally {
      setSaving(false);
    }
  };

  const getExpiryInfo = (validUntilStr?: string) => {
    if (!validUntilStr) return { status: "ACTIVE" as const, label: "Valid", days: 365, color: "emerald" };
    const validDate = new Date(validUntilStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffTime = validDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return { status: "EXPIRED" as const, label: `Expired (${Math.abs(diffDays)}d ago)`, days: diffDays, color: "rose" };
    }
    if (diffDays <= 30) {
      return { status: "EXPIRING_SOON" as const, label: `Expiring Soon (${diffDays}d left)`, days: diffDays, color: "amber" };
    }
    return { status: "ACTIVE" as const, label: `Valid (${diffDays}d left)`, days: diffDays, color: "emerald" };
  };

  const expiringSoonCount = evaluations.filter((ev) => getExpiryInfo(ev.valid_until).status === "EXPIRING_SOON").length;
  const expiredCount = evaluations.filter((ev) => getExpiryInfo(ev.valid_until).status === "EXPIRED").length;

  const handleQuickRecertify = (ev: EEUFitnessEvaluation) => {
    setForm({
      patient: String(ev.patient),
      practitioner: ev.practitioner ? String(ev.practitioner) : "",
      evaluation_type: "Annual High-Voltage Climbing Exam",
      climbing_fitness: "Fit to Climb (Certified)",
      color_vision: "Normal Color Vision (Ishihara 15/15)",
      audiometry_hearing: "Normal Bilateral Hearing",
      cardiovascular_status: "Normal / Cleared for Heavy Exertion",
      vertigo_vestibular_check: "Negative (No Vertigo / Cleared for Heights)",
      physician_remarks: `Annual renewal following previous Certification #${ev.evaluation_id}.`,
      status: "Certified & Valid",
    });
    setModalOpen(true);
  };

  const filteredEvaluations = evaluations.filter((ev) => {
    const matchesSearch =
      (ev.evaluation_id || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (ev.patient_name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (ev.staff_id || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (ev.department || "").toLowerCase().includes(searchQuery.toLowerCase());

    const matchesClimbing = climbingFilter === "all" || ev.climbing_fitness === climbingFilter;

    const expiry = getExpiryInfo(ev.valid_until);
    let matchesTab = true;
    if (activeTab === "expiring_soon") matchesTab = expiry.status === "EXPIRING_SOON";
    else if (activeTab === "expired") matchesTab = expiry.status === "EXPIRED";
    else if (activeTab === "fit") matchesTab = ev.climbing_fitness.includes("Fit to Climb");
    else if (activeTab === "restricted") matchesTab = !ev.climbing_fitness.includes("Fit to Climb");

    return matchesSearch && matchesClimbing && matchesTab;
  });

  return (
    <div className="space-y-6 p-2 md:p-4">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            EEU Lineman Fitness & Climbing Clearance
          </h1>
          <p className="text-sm text-muted-foreground">
            Mandatory annual certifications for pole climbers, high-altitude tower technicians, and live wiring teams
          </p>
        </div>
        <Button
          onClick={() => setModalOpen(true)}
          className="gap-2 bg-emerald-600 font-semibold text-white shadow-md hover:bg-emerald-500"
        >
          <Icon icon="solar:medal-ribbons-star-bold" size={18} />
          Record Fitness-to-Climb Exam
        </Button>
      </div>

      {/* Safety Compliance Radar Alert */}
      {(expiringSoonCount > 0 || expiredCount > 0) && (
        <Card className="border-amber-500/40 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent">
          <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-amber-500">
                <Icon icon="solar:shield-warning-bold-duotone" size={24} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <span>LINEMAN HEIGHT SAFETY RADAR: Compliance Action Required</span>
                  <Badge className="bg-amber-500 text-slate-950 font-bold text-[10px]">
                    {expiringSoonCount + expiredCount} Action(s)
                  </Badge>
                </h4>
                <p className="text-xs text-muted-foreground mt-0.5 max-w-2xl">
                  {expiringSoonCount > 0 && `${expiringSoonCount} lineman climbing certification(s) expire within 30 days. `}
                  {expiredCount > 0 && `${expiredCount} technician certification(s) are past due. `}
                  EEU Occupational Safety Regulations prohibit dispatching uncertified technicians to live high-voltage poles or transmission towers.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                size="sm"
                variant={activeTab === "expiring_soon" ? "default" : "outline"}
                onClick={() => setActiveTab(activeTab === "expiring_soon" ? "all" : "expiring_soon")}
                className="text-xs h-8 gap-1.5 border-amber-500/40 text-amber-600 hover:bg-amber-500/15"
              >
                <Icon icon="solar:clock-circle-bold" size={14} />
                View Expiring ({expiringSoonCount})
              </Button>
              {expiredCount > 0 && (
                <Button
                  size="sm"
                  variant={activeTab === "expired" ? "destructive" : "outline"}
                  onClick={() => setActiveTab(activeTab === "expired" ? "all" : "expired")}
                  className="text-xs h-8 gap-1.5 border-rose-500/40 text-rose-600 hover:bg-rose-500/15"
                >
                  <Icon icon="solar:danger-triangle-bold" size={14} />
                  View Expired ({expiredCount})
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs & Filter Bar */}
      <Card className="border-border/60">
        <CardContent className="p-4 space-y-3">
          {/* Safety Filter Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 border-b border-border/50 pb-3">
            <button
              onClick={() => setActiveTab("all")}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                activeTab === "all" ? "bg-primary text-primary-foreground shadow-xs" : "text-muted-foreground hover:bg-muted"
              }`}
            >
              All Evaluations ({evaluations.length})
            </button>
            <button
              onClick={() => setActiveTab("expiring_soon")}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all ${
                activeTab === "expiring_soon"
                  ? "bg-amber-500 text-slate-950 shadow-xs"
                  : "text-amber-600 hover:bg-amber-500/10"
              }`}
            >
              <Icon icon="solar:clock-circle-bold" size={14} />
              Expiring Soon (&lt; 30d)
              <span className="rounded-full bg-amber-500/20 px-1.5 py-0.2 text-[10px] font-bold">
                {expiringSoonCount}
              </span>
            </button>
            <button
              onClick={() => setActiveTab("expired")}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all ${
                activeTab === "expired"
                  ? "bg-rose-600 text-white shadow-xs"
                  : "text-rose-600 hover:bg-rose-500/10"
              }`}
            >
              <Icon icon="solar:danger-triangle-bold" size={14} />
              Expired Past Due
              <span className="rounded-full bg-rose-500/20 px-1.5 py-0.2 text-[10px] font-bold">
                {expiredCount}
              </span>
            </button>
            <button
              onClick={() => setActiveTab("fit")}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                activeTab === "fit" ? "bg-emerald-600 text-white shadow-xs" : "text-emerald-600 hover:bg-emerald-500/10"
              }`}
            >
              Fit to Climb (Active)
            </button>
            <button
              onClick={() => setActiveTab("restricted")}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                activeTab === "restricted" ? "bg-muted-foreground text-background shadow-xs" : "text-muted-foreground hover:bg-muted"
              }`}
            >
              Restricted / Unfit
            </button>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Icon icon="solar:magnifer-linear" className="absolute left-3 top-3 text-muted-foreground" size={16} />
              <Input
                placeholder="Search by evaluation ID, technician name, EEU payroll ID, or directorate..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <select
                value={climbingFilter}
                onChange={(e) => setClimbingFilter(e.target.value)}
                className="h-10 rounded-md border border-input bg-background px-3 py-2 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="all">All Clearance Outcomes</option>
                <option value="Fit to Climb (Certified)">Fit to Climb (Certified)</option>
                <option value="Restricted to Ground Duty Only">Restricted to Ground Duty</option>
                <option value="Temporarily Unfit (Re-eval in 30 Days)">Temporarily Unfit</option>
                <option value="Permanently Unfit for High Altitudes">Permanently Unfit</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Evaluations Table */}
      <Card className="border-border/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">
            Lineman Fitness Certifications ({filteredEvaluations.length})
          </CardTitle>
          <CardDescription>
            Ishihara color plate results, vestibular vertigo checks, and annual height clearances
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex h-32 items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : filteredEvaluations.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No fitness evaluations found matching your criteria.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border/50 text-xs text-muted-foreground">
                    <th className="py-3 px-2">Cert #</th>
                    <th className="py-3 px-2">Technician / Cadre</th>
                    <th className="py-3 px-2">Examination Type</th>
                    <th className="py-3 px-2">Climbing Status</th>
                    <th className="py-3 px-2">Color Vision (Wiring)</th>
                    <th className="py-3 px-2">Audiometry / Vertigo</th>
                    <th className="py-3 px-2">Validity & Expiry Radar</th>
                    <th className="py-3 px-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {filteredEvaluations.map((ev) => {
                    const expiry = getExpiryInfo(ev.valid_until);
                    return (
                      <tr key={ev.id} className="transition-colors hover:bg-muted/30">
                        <td className="py-3 px-2 font-mono text-xs font-bold text-primary">
                          {ev.evaluation_id}
                        </td>
                        <td className="py-3 px-2">
                          <div className="font-medium text-foreground">{ev.patient_name || "Lineman"}</div>
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            {ev.staff_id && <span className="font-mono">{ev.staff_id}</span>}
                            {ev.cadre && <span>• {ev.cadre}</span>}
                          </div>
                        </td>
                        <td className="py-3 px-2">
                          <div className="font-medium text-foreground">{ev.evaluation_type}</div>
                          <div className="text-xs text-muted-foreground">Exam Date: {ev.evaluation_date}</div>
                        </td>
                        <td className="py-3 px-2">
                          <Badge
                            className={
                              ev.climbing_fitness.includes("Fit to Climb")
                                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                                : ev.climbing_fitness.includes("Restricted")
                                ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                                : "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                            }
                          >
                            {ev.climbing_fitness}
                          </Badge>
                        </td>
                        <td className="py-3 px-2">
                          <div className="text-xs font-medium text-foreground">
                            {ev.color_vision.split("(")[0]}
                          </div>
                          {ev.color_vision.includes("Deficiency") && (
                            <span className="text-[11px] font-semibold text-rose-500">
                              Live Wire Restricted
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-2">
                          <div className="text-xs text-foreground">
                            {ev.audiometry_hearing.split("(")[0]}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            Vertigo: {ev.vertigo_vestibular_check.split("(")[0]}
                          </div>
                        </td>
                        <td className="py-3 px-2">
                          <div className="space-y-1">
                            <Badge
                              variant="outline"
                              className={
                                expiry.status === "EXPIRED"
                                  ? "border-rose-500/50 bg-rose-500/10 text-rose-600 dark:text-rose-400 font-semibold"
                                  : expiry.status === "EXPIRING_SOON"
                                  ? "border-amber-500/50 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold"
                                  : "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono text-[11px]"
                              }
                            >
                              <Icon
                                icon={
                                  expiry.status === "EXPIRED"
                                    ? "solar:danger-triangle-bold"
                                    : expiry.status === "EXPIRING_SOON"
                                    ? "solar:clock-circle-bold"
                                    : "solar:check-circle-bold"
                                }
                                size={12}
                                className="mr-1"
                              />
                              {expiry.label}
                            </Badge>
                            <div className="font-mono text-[10px] text-muted-foreground">
                              Due: {ev.valid_until || "N/A"}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-2 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {(expiry.status === "EXPIRING_SOON" || expiry.status === "EXPIRED") && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleQuickRecertify(ev)}
                                className="h-7 text-xs border-amber-500/40 text-amber-600 hover:bg-amber-500/10 gap-1 px-2 font-medium"
                                title="Start Annual Re-Certification Exam"
                              >
                                <Icon icon="solar:restart-bold" size={13} />
                                Re-Certify
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedEval(ev)}
                              className="h-8 w-8 p-0"
                              title="View Exam File"
                            >
                              <Icon icon="solar:eye-bold" size={16} />
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

      {/* Modal: New Fitness Exam */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold text-emerald-600">
              <Icon icon="solar:medal-ribbons-star-bold" size={22} />
              Lineman Occupational Fitness & Climbing Exam
            </DialogTitle>
            <DialogDescription>
              Certify physical ability to climb utility poles, evaluate Ishihara color discrimination for wiring, and verify cardiovascular/vestibular stability.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4 pt-2">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="patient">Lineman / Field Technician *</Label>
                <select
                  id="patient"
                  value={form.patient}
                  onChange={(e) => setForm({ ...form, patient: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  required
                >
                  <option value="">Select Technician...</option>
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.patient_name} {p.eeu_staff_id ? `(${p.eeu_staff_id})` : ""} - {p.eeu_cadre || "Staff"}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="practitioner">Certifying Physician</Label>
                <select
                  id="practitioner"
                  value={form.practitioner}
                  onChange={(e) => setForm({ ...form, practitioner: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">Select Practitioner...</option>
                  {practitioners.map((doc) => (
                    <option key={doc.id} value={doc.id}>
                      {doc.practitioner_name} ({doc.designation || "Medical Officer"})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="evaluation_type">Examination Category *</Label>
                <select
                  id="evaluation_type"
                  value={form.evaluation_type}
                  onChange={(e) => setForm({ ...form, evaluation_type: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="Annual High-Voltage Climbing Exam">Annual High-Voltage Climbing Exam</option>
                  <option value="Pre-Employment Lineman Clearance">Pre-Employment Lineman Clearance</option>
                  <option value="Post-Injury Return to Duty Clearance">Post-Injury Return to Duty Clearance</option>
                  <option value="Substation Noise & Audiometry Screening">Substation Noise & Audiometry Screening</option>
                  <option value="Periodic General Health Checkup">Periodic General Health Checkup</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="climbing_fitness">Climbing Fitness Determination *</Label>
                <select
                  id="climbing_fitness"
                  value={form.climbing_fitness}
                  onChange={(e) => setForm({ ...form, climbing_fitness: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="Fit to Climb (Certified)">Fit to Climb (Certified for Utility Poles & Towers)</option>
                  <option value="Restricted to Ground Duty Only">Restricted to Ground Duty Only</option>
                  <option value="Temporarily Unfit (Re-eval in 30 Days)">Temporarily Unfit (Re-eval in 30 Days)</option>
                  <option value="Permanently Unfit for High Altitudes">Permanently Unfit for High Altitudes</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="color_vision">Color Vision (Ishihara Wiring Test) *</Label>
                <select
                  id="color_vision"
                  value={form.color_vision}
                  onChange={(e) => setForm({ ...form, color_vision: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="Normal Color Vision (Ishihara 15/15)">Normal Color Vision (Ishihara 15/15)</option>
                  <option value="Mild Red-Green Anomaly (Requires Supervised Cable Identification)">
                    Mild Red-Green Anomaly (Supervised Only)
                  </option>
                  <option value="Red-Green Deficiency (Disqualified from Live Wiring)">
                    Red-Green Deficiency (Disqualified from Wiring)
                  </option>
                  <option value="Not Tested">Not Tested</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="vertigo_vestibular_check">Vertigo & Vestibular Balance *</Label>
                <select
                  id="vertigo_vestibular_check"
                  value={form.vertigo_vestibular_check}
                  onChange={(e) => setForm({ ...form, vertigo_vestibular_check: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="Negative (No Vertigo / Cleared for Heights)">
                    Negative (No Vertigo / Cleared for Heights)
                  </option>
                  <option value="Positive / Vertigo Detected (Climbing Prohibited)">
                    Positive / Vertigo Present (Climbing Prohibited)
                  </option>
                  <option value="Borderline / Requires Specialist Review">
                    Borderline / Specialist Review
                  </option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="audiometry_hearing">Audiometry Hearing Screening</Label>
                <select
                  id="audiometry_hearing"
                  value={form.audiometry_hearing}
                  onChange={(e) => setForm({ ...form, audiometry_hearing: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="Normal Bilateral Hearing">Normal Bilateral Hearing</option>
                  <option value="Mild Occupational Noise Shift (<25 dB)">Mild Noise Shift (&lt;25 dB)</option>
                  <option value="Moderate Hearing Loss (Mandatory Hearing Protection)">
                    Moderate Loss (Ear Defenders Mandatory)
                  </option>
                  <option value="Severe Hearing Impairment (Substation Duty Restricted)">
                    Severe Hearing Impairment (Yard Restricted)
                  </option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="cardiovascular_status">Cardiovascular & Blood Pressure</Label>
                <select
                  id="cardiovascular_status"
                  value={form.cardiovascular_status}
                  onChange={(e) => setForm({ ...form, cardiovascular_status: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="Normal / Cleared for Heavy Exertion">Normal / Cleared for Heavy Exertion</option>
                  <option value="Elevated BP - Monitored">Elevated BP - Monitored</option>
                  <option value="Stage 2 Hypertension (Ground Duty Only)">Stage 2 Hypertension (Ground Duty Only)</option>
                  <option value="Abnormal ECG - Referred to Cardiology">Abnormal ECG - Referred to Cardiology</option>
                </select>
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="physician_remarks">Physician's Remarks & Work Limitations</Label>
                <textarea
                  id="physician_remarks"
                  rows={2}
                  placeholder="Clinical notes, orthopedic spine integrity, harness fit remarks, medication precautions..."
                  value={form.physician_remarks}
                  onChange={(e) => setForm({ ...form, physician_remarks: e.target.value })}
                  className="w-full rounded-md border border-input bg-background p-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-border/50 pt-4">
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving} className="bg-emerald-600 text-white hover:bg-emerald-500">
                {saving ? "Saving..." : "Issue Climbing Certification"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      {selectedEval && (
        <Dialog open={!!selectedEval} onOpenChange={() => setSelectedEval(null)}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between text-base font-bold">
                <span>Certification #{selectedEval.evaluation_id}</span>
                <Badge variant="outline">{selectedEval.status}</Badge>
              </DialogTitle>
              <DialogDescription>
                {selectedEval.patient_name} ({selectedEval.staff_id || "Staff"}) • {selectedEval.cadre}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 text-sm">
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-center">
                <span className="text-xs uppercase font-semibold text-emerald-600 dark:text-emerald-400">Climbing Determination</span>
                <div className="mt-1 text-lg font-bold text-foreground">{selectedEval.climbing_fitness}</div>
                <div className="mt-1 text-xs text-muted-foreground">Certified by {selectedEval.practitioner_name || "Medical Officer"}</div>
              </div>

              <div className="grid grid-cols-2 gap-3 rounded-lg bg-muted/40 p-3 text-xs">
                <div>
                  <span className="text-muted-foreground">Color Vision:</span>
                  <div className="font-semibold text-foreground">{selectedEval.color_vision}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Hearing Screening:</span>
                  <div className="font-semibold text-foreground">{selectedEval.audiometry_hearing}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Vertigo / Vestibular:</span>
                  <div className="font-semibold text-foreground">{selectedEval.vertigo_vestibular_check}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Cardiovascular:</span>
                  <div className="font-semibold text-foreground">{selectedEval.cardiovascular_status}</div>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Physician Remarks</h4>
                <p className="mt-1 rounded border border-border/40 p-2.5 text-xs text-foreground bg-background">
                  {selectedEval.physician_remarks || "Technician cleared for high-altitude electrical transmission utility work."}
                </p>
              </div>

              <div className="flex items-center justify-between border-t border-border/50 pt-3 text-xs text-muted-foreground">
                <span>Exam Date: {selectedEval.evaluation_date}</span>
                <span>Valid Until: {selectedEval.valid_until || "1 Year from Exam"}</span>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
