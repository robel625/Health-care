import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/ui/card";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { Badge } from "@/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/ui/dialog";
import { Icon } from "@/components/icon";
import { HealthcareApi } from "@/api/services/healthcareService";
import type { EEUToxicSurveillance, Patient } from "@/api/services/healthcareService";
import { useClinicStore } from "@/store/clinicStore";
import { toast } from "sonner";

export default function EEUToxicSurveillancePage() {
  const activeClinic = useClinicStore((s) => s.activeClinic);
  const setActiveClinicId = useClinicStore((s) => s.setActiveClinicId);

  const [records, setRecords] = useState<EEUToxicSurveillance[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total_records: 0,
    sf6_gas_exposures: 0,
    transformer_oil_pcb_exposures: 0,
    battery_lead_acid_exposures: 0,
    restricted_duty_count: 0,
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [agentFilter, setAgentFilter] = useState("all");
  const [dutyFilter, setDutyFilter] = useState("all");

  // Create Log Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    patient: "",
    chemical_agent: "SF6 Breakdown Gas (SOF2 / HF byproducts)",
    examination_date: new Date().toISOString().split("T")[0],
    work_location: activeClinic.name !== "All EEU Healthcare Facilities" ? activeClinic.name : "Kality 230kV Transformer Yard",
    exposure_route: "Inhalation / Respiratory",
    exposure_severity: "Mild Irritation / Monitored",
    spirometry_fev1_actual: 3.8,
    spirometry_fev1_predicted_pct: 88,
    dermatological_findings: "No active chemical dermatitis",
    clinical_management: "Eye flush 15 mins with saline, protective coverall stripped and bagged. Administered nebulized salbutamol at EEU clinic.",
    duty_recommendation: "Temporary Reassignment to Clean Area",
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [recRes, patRes, statsRes] = await Promise.all([
        HealthcareApi.eeuToxicSurveillance.list({ page_size: 100 }),
        HealthcareApi.patients.list({ page_size: 100 }),
        HealthcareApi.eeuToxicSurveillance.stats().catch(() => ({
          total_records: 0,
          sf6_gas_exposures: 0,
          transformer_oil_pcb_exposures: 0,
          battery_lead_acid_exposures: 0,
          restricted_duty_count: 0,
        })),
      ]);
      setRecords(recRes.results || []);
      setPatients(patRes.results || []);
      if (statsRes) setStats(statsRes);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load toxic surveillance records");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.patient) {
      toast.error("Please select an exposed technician / worker");
      return;
    }

    setSaving(true);
    try {
      await HealthcareApi.eeuToxicSurveillance.create({
        ...form,
        patient: Number(form.patient),
        spirometry_fev1_actual: form.spirometry_fev1_actual ? Number(form.spirometry_fev1_actual) : null,
        spirometry_fev1_predicted_pct: form.spirometry_fev1_predicted_pct ? Number(form.spirometry_fev1_predicted_pct) : null,
      });
      toast.success("Logged chemical / SF6 exposure surveillance report");
      setModalOpen(false);
      setForm({
        patient: "",
        chemical_agent: "SF6 Breakdown Gas (SOF2 / HF byproducts)",
        examination_date: new Date().toISOString().split("T")[0],
        work_location: activeClinic.name,
        exposure_route: "Inhalation / Respiratory",
        exposure_severity: "Mild Irritation / Monitored",
        spirometry_fev1_actual: 3.8,
        spirometry_fev1_predicted_pct: 88,
        dermatological_findings: "No active chemical dermatitis",
        clinical_management: "",
        duty_recommendation: "Temporary Reassignment to Clean Area",
      });
      await loadData();
    } catch (err) {
      console.error(err);
      toast.error("Failed to save surveillance report");
    } finally {
      setSaving(false);
    }
  };

  const filteredRecords = records.filter((r) => {
    const matchesSearch =
      (r.patient_name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.surveillance_id || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.work_location || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.chemical_agent || "").toLowerCase().includes(searchQuery.toLowerCase());

    const matchesAgent = agentFilter === "all" || r.chemical_agent.toLowerCase().includes(agentFilter.toLowerCase());
    const matchesDuty = dutyFilter === "all" || r.duty_recommendation.toLowerCase().includes(dutyFilter.toLowerCase());

    return matchesSearch && matchesAgent && matchesDuty;
  });

  return (
    <div className="space-y-6 p-2 md:p-4">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge className="bg-amber-600 text-white font-bold text-[10px]">
              EEU Toxicology & Occupational Hygiene
            </Badge>
            <span className="text-xs text-muted-foreground font-mono">
              Hazardous Chemicals Surveillance
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            Transformer Chemical & SF6 Gas Exposure Register
          </h1>
          <p className="text-sm text-muted-foreground">
            Longitudinal clinical surveillance for technicians exposed to Sulfur Hexafluoride (SF6) breakdown products, transformer dielectric oil, and battery acid electrolytes.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="outline"
            onClick={loadData}
            className="gap-2 text-xs h-9"
          >
            <Icon icon="solar:refresh-bold" size={15} />
            Refresh
          </Button>
          <Button
            onClick={() => setModalOpen(true)}
            className="gap-2 bg-amber-600 hover:bg-amber-700 text-white font-bold shadow-lg shadow-amber-600/25 h-9"
          >
            <Icon icon="solar:shield-warning-bold" size={18} />
            Log Chemical / SF6 Exposure
          </Button>
        </div>
      </div>

      {/* Active Clinic Context Banner */}
      {activeClinic.id !== "all" && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-950 dark:text-amber-200">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400">
              <Icon icon="solar:hospital-bold-duotone" size={20} />
            </div>
            <div>
              <span className="font-bold text-foreground">Surveillance Post: </span>
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
            className="h-8 text-xs text-amber-700 hover:text-amber-900 dark:text-amber-300 dark:hover:text-white gap-1.5 self-start sm:self-auto"
          >
            <Icon icon="solar:global-bold" size={14} />
            Show National Directorate Register
          </Button>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">Total Exposure Logs</p>
              <h3 className="text-2xl font-bold font-mono text-amber-700 dark:text-amber-400 mt-1">
                {stats.total_records}
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">Under surveillance</p>
            </div>
            <div className="p-2.5 rounded-2xl bg-amber-500/15 text-amber-600">
              <Icon icon="solar:shield-warning-bold-duotone" size={24} />
            </div>
          </CardContent>
        </Card>

        <Card className="border-rose-500/30 bg-rose-500/5">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-rose-700 dark:text-rose-400">SF6 Breakdown Gas</p>
              <h3 className="text-2xl font-bold font-mono text-rose-700 dark:text-rose-400 mt-1">
                {stats.sf6_gas_exposures}
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">Circuit breaker toxic arc gas</p>
            </div>
            <div className="p-2.5 rounded-2xl bg-rose-500/15 text-rose-600">
              <Icon icon="solar:danger-triangle-bold-duotone" size={24} />
            </div>
          </CardContent>
        </Card>

        <Card className="border-purple-500/30 bg-purple-500/5">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-purple-700 dark:text-purple-400">PCB / Transformer Oil</p>
              <h3 className="text-2xl font-bold font-mono text-purple-700 dark:text-purple-400 mt-1">
                {stats.transformer_oil_pcb_exposures}
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">Dermal & fluid contact</p>
            </div>
            <div className="p-2.5 rounded-2xl bg-purple-500/15 text-purple-600">
              <Icon icon="solar:test-tube-bold-duotone" size={24} />
            </div>
          </CardContent>
        </Card>

        <Card className="border-sky-500/30 bg-sky-500/5">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-sky-700 dark:text-sky-400">Battery Acid Fumes</p>
              <h3 className="text-2xl font-bold font-mono text-sky-700 dark:text-sky-400 mt-1">
                {stats.battery_lead_acid_exposures}
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">DC bank room acid fumes</p>
            </div>
            <div className="p-2.5 rounded-2xl bg-sky-500/15 text-sky-600">
              <Icon icon="solar:box-minimalistic-bold-duotone" size={24} />
            </div>
          </CardContent>
        </Card>

        <Card className="border-emerald-500/30 bg-emerald-500/5">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">Restricted Ground Duty</p>
              <h3 className="text-2xl font-bold font-mono text-emerald-700 dark:text-emerald-400 mt-1">
                {stats.restricted_duty_count}
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">Respiratory protection hold</p>
            </div>
            <div className="p-2.5 rounded-2xl bg-emerald-500/15 text-emerald-600">
              <Icon icon="solar:medal-ribbons-star-bold-duotone" size={24} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <Card className="border-border/60">
        <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Icon icon="solar:magnifer-linear" className="absolute left-3 top-3 text-muted-foreground" size={16} />
            <Input
              placeholder="Search by code (e.g. EEU-TOX-2026-0001), technician name, substation, or substance..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 text-xs"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              value={agentFilter}
              onChange={(e) => setAgentFilter(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 py-1 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="all">All Chemical Substances</option>
              <option value="SF6">SF6 Gas / Breakdown Products</option>
              <option value="Mineral Oil">Transformer Dielectric & PCB Oil</option>
              <option value="Battery">Lead-Acid Battery Electrolytes</option>
            </select>

            <select
              value={dutyFilter}
              onChange={(e) => setDutyFilter(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 py-1 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="all">All Duty Dispositions</option>
              <option value="Cleared">Cleared for Continued Substation Duty</option>
              <option value="Mandatory">Mandatory Respirator / PPE</option>
              <option value="Restricted">Restricted from SF6 Handling</option>
              <option value="Temporary">Temporary Reassignment</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Records Table */}
      <Card className="border-border/60 overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              <Icon icon="solar:refresh-bold" className="animate-spin inline-block mr-2" size={18} />
              Loading toxicology surveillance records...
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No chemical exposure records found matching your filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/40 border-b border-border/60 text-muted-foreground uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3 px-4 font-semibold">Surveillance Code</th>
                    <th className="py-3 px-4 font-semibold">Technician / Employee</th>
                    <th className="py-3 px-4 font-semibold">Substance & Exposure Route</th>
                    <th className="py-3 px-4 font-semibold">Location & Examination Date</th>
                    <th className="py-3 px-4 font-semibold">Spirometry / Pulmonary</th>
                    <th className="py-3 px-4 font-semibold">Occupational Disposition</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {filteredRecords.map((r) => {
                    const isSF6 = r.chemical_agent.toLowerCase().includes("sf6");
                    const isRestricted = !r.duty_recommendation.toLowerCase().includes("cleared");

                    return (
                      <tr key={r.id} className="hover:bg-muted/20 transition-colors">
                        <td className="py-3 px-4">
                          <span className="font-mono font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 block w-fit">
                            {r.surveillance_id}
                          </span>
                        </td>

                        <td className="py-3 px-4">
                          <span className="font-semibold text-foreground block">
                            {r.patient_name || `Staff #${r.patient}`}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            {r.staff_id || r.patient_code || "EEU Personnel"}
                          </span>
                        </td>

                        <td className="py-3 px-4 max-w-[220px]">
                          <Badge
                            className={
                              isSF6
                                ? "bg-rose-500/15 text-rose-700 dark:text-rose-300 font-semibold mb-1"
                                : "bg-purple-500/15 text-purple-700 dark:text-purple-300 font-semibold mb-1"
                            }
                          >
                            {r.chemical_agent.split("(")[0]}
                          </Badge>
                          <span className="text-[11px] text-muted-foreground block">
                            Route: <strong>{r.exposure_route}</strong>
                          </span>
                        </td>

                        <td className="py-3 px-4">
                          <span className="font-medium text-foreground block">
                            {r.work_location}
                          </span>
                          <span className="text-[11px] text-muted-foreground font-mono">
                            Exam Date: {r.examination_date}
                          </span>
                        </td>

                        <td className="py-3 px-4">
                          {r.spirometry_fev1_predicted_pct ? (
                            <div className="space-y-0.5">
                              <span className="font-mono font-bold text-xs text-foreground">
                                FEV1: {r.spirometry_fev1_predicted_pct}% Predicted
                              </span>
                              <span className="text-[10px] text-muted-foreground block line-clamp-1">
                                {r.spirometry_fev1_actual ? `${r.spirometry_fev1_actual} L actual` : "Normal spirometry"}
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-[11px]">Spirometry pending</span>
                          )}
                        </td>

                        <td className="py-3 px-4">
                          <Badge
                            variant="secondary"
                            className={
                              isRestricted
                                ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 font-bold"
                                : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-medium"
                            }
                          >
                            {r.duty_recommendation}
                          </Badge>
                          {r.dermatological_findings && (
                            <span className="text-[10px] text-muted-foreground block mt-0.5">
                              {r.dermatological_findings}
                            </span>
                          )}
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

      {/* Log Exposure Incident Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-xl">
          <form onSubmit={handleCreateRecord}>
            <DialogHeader>
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600">
                  <Icon icon="solar:shield-warning-bold-duotone" size={22} />
                </div>
                <div>
                  <DialogTitle className="text-base font-bold text-foreground">
                    Log Chemical / SF6 Toxic Exposure Surveillance
                  </DialogTitle>
                  <DialogDescription className="text-xs">
                    Document workplace chemical exposure, clinical spirometry, and occupational duty disposition.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-4 py-3 text-xs">
              <div>
                <Label className="text-[11px] font-semibold text-foreground/80 mb-1 block">
                  Select Exposed Worker *
                </Label>
                <select
                  required
                  value={form.patient}
                  onChange={(e) => setForm({ ...form, patient: e.target.value })}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs"
                >
                  <option value="">Select Technician / Staff Member...</option>
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.patient_name} — {p.eeu_staff_id || `PAT-${p.id}`} ({p.eeu_cadre || "Technician"})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-[11px] font-semibold text-foreground/80 mb-1 block">
                    Chemical Hazard Agent *
                  </Label>
                  <select
                    value={form.chemical_agent}
                    onChange={(e) => setForm({ ...form, chemical_agent: e.target.value })}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs"
                  >
                    <option value="SF6 Breakdown Gas (SOF2 / HF byproducts)">SF6 Breakdown Gas (SOF2 / HF byproducts)</option>
                    <option value="Transformer Mineral Oil / PCB Splashing">Transformer Mineral Oil / PCB Splashing</option>
                    <option value="Substation Battery Room Lead & Acid Mist">Substation Battery Room Lead & Acid Mist</option>
                    <option value="Silica Dust & Underground Cable Compounds">Silica Dust & Underground Cable Compounds</option>
                    <option value="Degreasing Solvents & Chlorinated Cleaners">Degreasing Solvents & Chlorinated Cleaners</option>
                  </select>
                </div>

                <div>
                  <Label className="text-[11px] font-semibold text-foreground/80 mb-1 block">
                    Exposure Route
                  </Label>
                  <select
                    value={form.exposure_route}
                    onChange={(e) => setForm({ ...form, exposure_route: e.target.value })}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs"
                  >
                    <option value="Inhalation / Respiratory">Inhalation / Respiratory</option>
                    <option value="Dermal / Skin Contact">Dermal / Skin Contact</option>
                    <option value="Ocular / Chemical Splash to Eyes">Ocular / Chemical Splash to Eyes</option>
                    <option value="Chronic Low-Dose Accumulation">Chronic Low-Dose Accumulation</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <Label className="text-[11px] font-semibold text-foreground/80 mb-1 block">
                    Examination Date
                  </Label>
                  <Input
                    type="date"
                    value={form.examination_date}
                    onChange={(e) => setForm({ ...form, examination_date: e.target.value })}
                    className="h-9 font-mono"
                  />
                </div>
                <div>
                  <Label className="text-[11px] font-semibold text-foreground/80 mb-1 block">
                    Actual FEV1 (Liters)
                  </Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={form.spirometry_fev1_actual}
                    onChange={(e) => setForm({ ...form, spirometry_fev1_actual: Number(e.target.value) })}
                    className="h-9 font-mono"
                  />
                </div>
                <div>
                  <Label className="text-[11px] font-semibold text-foreground/80 mb-1 block">
                    Spirometry FEV1 (% Pred)
                  </Label>
                  <Input
                    type="number"
                    min="20"
                    max="140"
                    value={form.spirometry_fev1_predicted_pct}
                    onChange={(e) => setForm({ ...form, spirometry_fev1_predicted_pct: Number(e.target.value) })}
                    className="h-9 font-mono"
                  />
                </div>
              </div>

              <div>
                <Label className="text-[11px] font-semibold text-foreground/80 mb-1 block">
                  Substation / Yard Location
                </Label>
                <Input
                  value={form.work_location}
                  onChange={(e) => setForm({ ...form, work_location: e.target.value })}
                  placeholder="e.g. Kality 230kV Transformer Yard #3"
                  className="h-9"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-[11px] font-semibold text-foreground/80 mb-1 block">
                    Clinical Decontamination & Management
                  </Label>
                  <textarea
                    rows={2}
                    value={form.clinical_management}
                    onChange={(e) => setForm({ ...form, clinical_management: e.target.value })}
                    className="w-full rounded-md border border-input bg-background p-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder="Eye flushes, bronchodilators, barrier creams..."
                  />
                </div>
                <div>
                  <Label className="text-[11px] font-semibold text-foreground/80 mb-1 block">
                    Dermatological / Skin Findings
                  </Label>
                  <textarea
                    rows={2}
                    value={form.dermatological_findings}
                    onChange={(e) => setForm({ ...form, dermatological_findings: e.target.value })}
                    className="w-full rounded-md border border-input bg-background p-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder="Chemical erythema, contact dermatitis, intact skin..."
                  />
                </div>
              </div>

              <div>
                <Label className="text-[11px] font-semibold text-foreground/80 mb-1 block">
                  Occupational Duty Recommendation *
                </Label>
                <select
                  value={form.duty_recommendation}
                  onChange={(e) => setForm({ ...form, duty_recommendation: e.target.value })}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs font-semibold"
                >
                  <option value="Cleared for Continued Substation Duty">Cleared for Continued Substation Duty</option>
                  <option value="Mandatory Respirator / Full Chemical PPE">Mandatory Respirator / Full Chemical PPE</option>
                  <option value="Restricted from SF6 Switchgear Handling">Restricted from SF6 Switchgear Handling</option>
                  <option value="Temporary Reassignment to Clean Area">Temporary Reassignment to Clean Area</option>
                </select>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setModalOpen(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={saving}
                className="gap-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold"
              >
                {saving ? "Saving Log..." : "Save Surveillance Log"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
