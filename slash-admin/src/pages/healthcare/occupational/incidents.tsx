import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/ui/card";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { Badge } from "@/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/ui/dialog";
import { Icon } from "@/components/icon";
import { HealthcareApi } from "@/api/services/healthcareService";
import type { EEUWorkplaceIncident, Patient } from "@/api/services/healthcareService";
import { useClinicStore } from "@/store/clinicStore";
import { toast } from "sonner";

export default function EEUWorkplaceIncidentsPage() {
  const [incidents, setIncidents] = useState<EEUWorkplaceIncident[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [voltageFilter, setVoltageFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");

  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    patient: "",
    voltage_level: "Medium Voltage (15kV / 33kV)",
    incident_type: "Electrical Arc Flash / Thermal Burn",
    work_location: "",
    region: "Addis Ababa",
    severity: "Moderate / Outpatient Care",
    ppe_compliance: "Fully Compliant (Harness, Insulating Gloves, Boots, Helmet)",
    clinical_findings: "",
    immediate_treatment_given: "",
    duty_recommendation: "Medical Sick Leave",
    reported_by: "",
    supervisor_notified: true,
    status: "Under Medical Review",
  });

  const [selectedIncident, setSelectedIncident] = useState<EEUWorkplaceIncident | null>(null);

  // Pipeline states
  const [pipelineLoadingId, setPipelineLoadingId] = useState<number | null>(null);
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const [leaveIncident, setLeaveIncident] = useState<EEUWorkplaceIncident | null>(null);
  const [leaveDays, setLeaveDays] = useState(7);
  const [leaveRestriction, setLeaveRestriction] = useState("Restricted to Light Ground Duty (No Climbing / No Field Patrol)");
  const [leaveBranch, setLeaveBranch] = useState("Ethiopian Electric Utility Medium Clinic");
  const [leaveRemarks, setLeaveRemarks] = useState("");
  const [leaveSaving, setLeaveSaving] = useState(false);

  const handleCreateEncounter = async (inc: EEUWorkplaceIncident) => {
    setPipelineLoadingId(inc.id);
    try {
      const res = await HealthcareApi.eeuIncidents.createClinicalEncounter(inc.id);
      toast.success(res.message || "Clinical encounter created and linked successfully!");
      await loadIncidents();
      if (selectedIncident && selectedIncident.id === inc.id) {
        setSelectedIncident((prev) =>
          prev ? { ...prev, clinical_encounter: res.encounter_id, clinical_encounter_display: res.encounter_code } : null
        );
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to create clinical encounter");
    } finally {
      setPipelineLoadingId(null);
    }
  };

  const handleOpenLeaveModal = (inc: EEUWorkplaceIncident) => {
    setLeaveIncident(inc);
    setLeaveDays(inc.severity.includes("Severe") || inc.severity.includes("Critical") ? 14 : 7);
    setLeaveRestriction(
      inc.duty_recommendation.includes("Ground")
        ? "Restricted to Light Ground Duty (No Climbing / No Field Patrol)"
        : inc.duty_recommendation.includes("Bed Rest") || inc.duty_recommendation.includes("Sick Leave")
        ? "Complete Bed Rest / Total Absence"
        : "Complete Absence from High-Voltage & Substation Yard"
    );
    setLeaveRemarks(
      `Mandatory recovery protocol following ${inc.incident_type} (${inc.voltage_level}) at ${inc.work_location}.`
    );
    setLeaveModalOpen(true);
  };

  const handleIssueLeaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leaveIncident) return;
    setLeaveSaving(true);
    try {
      const res = await HealthcareApi.eeuIncidents.issueSickLeave(leaveIncident.id, {
        total_days: leaveDays,
        eeu_duty_restriction: leaveRestriction,
        eeu_clinic_branch: leaveBranch,
        doctor_remarks: leaveRemarks,
      });
      toast.success(res.message || "Certified Sick Leave Slip issued successfully!");
      setLeaveModalOpen(false);
      await loadIncidents();
      if (selectedIncident && selectedIncident.id === leaveIncident.id) {
        setSelectedIncident((prev) =>
          prev
            ? {
                ...prev,
                sick_leave_slip: res.slip_id,
                sick_leave_slip_code: res.slip_code,
                lost_work_days: res.total_days,
                sick_leave_total_days: res.total_days,
              }
            : null
        );
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to issue sick leave slip");
    } finally {
      setLeaveSaving(false);
    }
  };

  useEffect(() => {
    loadIncidents();
    loadPatients();
  }, []);

  const loadIncidents = async () => {
    setLoading(true);
    try {
      const res = await HealthcareApi.eeuIncidents.list();
      setIncidents(res.results || []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load workplace incidents");
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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.patient) {
      toast.error("Please select an injured employee");
      return;
    }
    if (!form.work_location.trim()) {
      toast.error("Please provide the work/substation location");
      return;
    }

    setSaving(true);
    try {
      await HealthcareApi.eeuIncidents.create({
        ...form,
        patient: Number(form.patient),
      });
      toast.success("Workplace incident recorded successfully");
      setModalOpen(false);
      loadIncidents();
    } catch (err) {
      console.error(err);
      toast.error("Failed to record incident");
    } finally {
      setSaving(false);
    }
  };

  const activeClinic = useClinicStore((s) => s.activeClinic);
  const setActiveClinicId = useClinicStore((s) => s.setActiveClinicId);

  const filteredIncidents = incidents.filter((inc) => {
    const matchesSearch =
      (inc.incident_id || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (inc.patient_name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (inc.staff_id || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (inc.work_location || "").toLowerCase().includes(searchQuery.toLowerCase());

    const matchesVoltage = voltageFilter === "all" || inc.voltage_level === voltageFilter;
    const matchesSeverity = severityFilter === "all" || inc.severity === severityFilter;

    let matchesClinic = true;
    if (activeClinic.id !== "all" && activeClinic.region !== "National Directorate") {
      const reg = activeClinic.region.toLowerCase();
      matchesClinic =
        (inc.region || "").toLowerCase() === reg ||
        (inc.work_location || "").toLowerCase().includes(reg);
    }

    return matchesSearch && matchesVoltage && matchesSeverity && matchesClinic;
  });

  return (
    <div className="space-y-6 p-2 md:p-4">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            EEU Workplace & Electrical Incident Registry
          </h1>
          <p className="text-sm text-muted-foreground">
            Occupational injury triage, arc flash management, and high-voltage transmission safety documentation
          </p>
        </div>
        <Button
          onClick={() => setModalOpen(true)}
          className="gap-2 bg-rose-600 font-semibold text-white shadow-md hover:bg-rose-500"
        >
          <Icon icon="solar:danger-triangle-bold" size={18} />
          Report Electrical / Workplace Incident
        </Button>
      </div>

      {/* Active Clinic Context Banner */}
      {activeClinic.id !== "all" && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-950 dark:text-rose-200">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-rose-500/20 text-rose-600 dark:text-rose-400">
              <Icon icon="solar:hospital-bold-duotone" size={20} />
            </div>
            <div>
              <span className="font-bold text-foreground">Active Clinic Facility: </span>
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
            className="h-8 text-xs text-rose-700 hover:text-rose-900 dark:text-rose-300 dark:hover:text-white gap-1.5 self-start sm:self-auto"
          >
            <Icon icon="solar:global-bold" size={14} />
            Show National Incident Log
          </Button>
        </div>
      )}

      {/* Filter Bar */}
      <Card className="border-border/60">
        <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Icon icon="solar:magnifer-linear" className="absolute left-3 top-3 text-muted-foreground" size={16} />
            <Input
              placeholder="Search by incident ID, staff name, payroll ID, or substation location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              value={voltageFilter}
              onChange={(e) => setVoltageFilter(e.target.value)}
              className="h-10 rounded-md border border-input bg-background px-3 py-2 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="all">All Voltage Levels</option>
              <option value="Low Voltage (220V/380V)">Low Voltage (220V/380V)</option>
              <option value="Medium Voltage (15kV / 33kV)">Medium Voltage (15kV / 33kV)</option>
              <option value="High Voltage (66kV / 132kV / 230kV / 400kV)">High Voltage (66kV - 400kV)</option>
              <option value="Non-Electrical / Mechanical Hazard">Non-Electrical / Mechanical</option>
            </select>

            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="h-10 rounded-md border border-input bg-background px-3 py-2 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="all">All Severities</option>
              <option value="Minor / First Aid Only">Minor / First Aid Only</option>
              <option value="Moderate / Outpatient Care">Moderate / Outpatient Care</option>
              <option value="Severe / Inpatient Admission Required">Severe / Inpatient Required</option>
              <option value="Critical / Burn ICU Transfer">Critical / Burn ICU Transfer</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Incident List */}
      <Card className="border-border/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">
            Registered Workplace Incidents ({filteredIncidents.length})
          </CardTitle>
          <CardDescription>
            High-voltage shocks, thermal flash burns, falls from poles, and occupational trauma
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex h-32 items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : filteredIncidents.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No workplace incidents found matching your query.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border/50 text-xs text-muted-foreground">
                    <th className="py-3 px-2">Incident ID</th>
                    <th className="py-3 px-2">Injured Employee</th>
                    <th className="py-3 px-2">Hazard Type</th>
                    <th className="py-3 px-2">Voltage & Location</th>
                    <th className="py-3 px-2">Severity & PPE</th>
                    <th className="py-3 px-2">Duty Recommendation</th>
                    <th className="py-3 px-2">Clinical Pipeline</th>
                    <th className="py-3 px-2">Status</th>
                    <th className="py-3 px-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {filteredIncidents.map((inc) => (
                    <tr key={inc.id} className="transition-colors hover:bg-muted/30">
                      <td className="py-3 px-2 font-mono text-xs font-bold text-primary">
                        {inc.incident_id}
                      </td>
                      <td className="py-3 px-2">
                        <div className="font-medium text-foreground">{inc.patient_name || "EEU Staff"}</div>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          {inc.staff_id && <span className="font-mono">{inc.staff_id}</span>}
                          {inc.cadre && <span>• {inc.cadre}</span>}
                        </div>
                      </td>
                      <td className="py-3 px-2">
                        <div className="font-medium text-foreground">{inc.incident_type}</div>
                        <div className="text-xs text-muted-foreground">{inc.region}</div>
                      </td>
                      <td className="py-3 px-2">
                        <Badge
                          variant="outline"
                          className={
                            inc.voltage_level.includes("High")
                              ? "border-rose-500/40 text-rose-500"
                              : inc.voltage_level.includes("Medium")
                              ? "border-amber-500/40 text-amber-500"
                              : "border-blue-500/40 text-blue-500"
                          }
                        >
                          {inc.voltage_level}
                        </Badge>
                        <div className="mt-1 max-w-[200px] truncate text-xs text-muted-foreground" title={inc.work_location}>
                          {inc.work_location}
                        </div>
                      </td>
                      <td className="py-3 px-2">
                        <div className="text-xs font-semibold text-foreground">{inc.severity}</div>
                        <div className="max-w-[180px] truncate text-[11px] text-muted-foreground" title={inc.ppe_compliance}>
                          PPE: {inc.ppe_compliance}
                        </div>
                      </td>
                      <td className="py-3 px-2">
                        <span className="rounded bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
                          {inc.duty_recommendation}
                        </span>
                      </td>
                      <td className="py-3 px-2">
                        <div className="flex flex-col gap-1">
                          {inc.clinical_encounter_display ? (
                            <span className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold text-cyan-600 dark:text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded border border-cyan-500/30">
                              <Icon icon="solar:notes-bold-duotone" size={13} />
                              {inc.clinical_encounter_display}
                            </span>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={pipelineLoadingId === inc.id}
                              onClick={() => handleCreateEncounter(inc)}
                              className="h-6 text-[11px] px-2 border-cyan-500/40 text-cyan-600 hover:bg-cyan-500/10 gap-1"
                              title="Create Clinical Encounter"
                            >
                              <Icon icon="solar:add-circle-bold" size={12} />
                              {pipelineLoadingId === inc.id ? "Creating..." : "+ Encounter"}
                            </Button>
                          )}

                          {inc.sick_leave_slip_code ? (
                            <span className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/30">
                              <Icon icon="solar:document-medicine-bold-duotone" size={13} />
                              {inc.sick_leave_slip_code} ({inc.sick_leave_total_days || inc.lost_work_days}d)
                            </span>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenLeaveModal(inc)}
                              className="h-6 text-[11px] px-2 border-indigo-500/40 text-indigo-600 hover:bg-indigo-500/10 gap-1"
                              title="Issue Certified Sick Leave Slip"
                            >
                              <Icon icon="solar:document-add-bold" size={12} />
                              + Sick Leave
                            </Button>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-2">
                        <Badge
                          className={
                            inc.status === "Cleared / Returned to Duty"
                              ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                              : inc.status === "Treatment Ongoing"
                              ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                              : "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                          }
                        >
                          {inc.status}
                        </Badge>
                      </td>
                      <td className="py-3 px-2 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedIncident(inc)}
                          className="h-8 w-8 p-0"
                          title="View Incident Clinical File"
                        >
                          <Icon icon="solar:eye-bold" size={16} />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal: Report Workplace Incident */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold text-rose-600">
              <Icon icon="solar:danger-triangle-bold" size={22} />
              Report Workplace / Electrical Incident
            </DialogTitle>
            <DialogDescription>
              Record an on-duty occupational incident, voltage rating, injury severity, and initial treatment.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4 pt-2">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="patient">Injured EEU Staff *</Label>
                <select
                  id="patient"
                  value={form.patient}
                  onChange={(e) => setForm({ ...form, patient: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  required
                >
                  <option value="">Select Employee...</option>
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.patient_name} {p.eeu_staff_id ? `(${p.eeu_staff_id})` : ""} - {p.eeu_cadre || "Staff"}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="voltage_level">Voltage Level *</Label>
                <select
                  id="voltage_level"
                  value={form.voltage_level}
                  onChange={(e) => setForm({ ...form, voltage_level: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="Low Voltage (220V/380V)">Low Voltage (220V/380V)</option>
                  <option value="Medium Voltage (15kV / 33kV)">Medium Voltage (15kV / 33kV)</option>
                  <option value="High Voltage (66kV / 132kV / 230kV / 400kV)">High Voltage (66kV - 400kV)</option>
                  <option value="Non-Electrical / Mechanical Hazard">Non-Electrical / Mechanical Hazard</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="incident_type">Incident / Hazard Type *</Label>
                <select
                  id="incident_type"
                  value={form.incident_type}
                  onChange={(e) => setForm({ ...form, incident_type: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="Electrical Arc Flash / Thermal Burn">Electrical Arc Flash / Thermal Burn</option>
                  <option value="Electrical Contact / Shock">Electrical Contact / Shock</option>
                  <option value="Fall from Height / Utility Pole / Tower">Fall from Height / Utility Pole / Tower</option>
                  <option value="Substation Transformer Oil / Chemical Splash">Substation Transformer Oil / Chemical Splash</option>
                  <option value="Acoustic Blast / Transformer Explosion">Acoustic Blast / Transformer Explosion</option>
                  <option value="Musculoskeletal / Heavy Cable Pulling Strain">Musculoskeletal / Heavy Cable Strain</option>
                  <option value="Motor Vehicle Accident (Line Patrol Truck)">Motor Vehicle Accident (Line Patrol Truck)</option>
                  <option value="Other Occupational Injury">Other Occupational Injury</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="region">EEU Region *</Label>
                <select
                  id="region"
                  value={form.region}
                  onChange={(e) => setForm({ ...form, region: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="Addis Ababa">Addis Ababa</option>
                  <option value="Oromia">Oromia</option>
                  <option value="Amhara">Amhara</option>
                  <option value="Sidama">Sidama</option>
                  <option value="Somali">Somali</option>
                  <option value="Tigray">Tigray</option>
                  <option value="Afar">Afar</option>
                  <option value="Dire Dawa">Dire Dawa</option>
                  <option value="Benishangul-Gumuz">Benishangul-Gumuz</option>
                  <option value="Gambella">Gambella</option>
                  <option value="South West Ethiopia">South West Ethiopia</option>
                  <option value="Central Ethiopia">Central Ethiopia</option>
                </select>
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="work_location">Exact Location (Substation / Feeder / Pole #) *</Label>
                <Input
                  id="work_location"
                  placeholder="e.g. Kality 230kV Substation Bay 4, Legehar Feeder 08, Pole #42"
                  value={form.work_location}
                  onChange={(e) => setForm({ ...form, work_location: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="severity">Severity Assessment</Label>
                <select
                  id="severity"
                  value={form.severity}
                  onChange={(e) => setForm({ ...form, severity: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="Minor / First Aid Only">Minor / First Aid Only</option>
                  <option value="Moderate / Outpatient Care">Moderate / Outpatient Care</option>
                  <option value="Severe / Inpatient Admission Required">Severe / Inpatient Admission Required</option>
                  <option value="Critical / Burn ICU Transfer">Critical / Burn ICU Transfer</option>
                  <option value="Fatal">Fatal</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="ppe_compliance">PPE Compliance at Time of Accident</Label>
                <select
                  id="ppe_compliance"
                  value={form.ppe_compliance}
                  onChange={(e) => setForm({ ...form, ppe_compliance: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="Fully Compliant (Harness, Insulating Gloves, Boots, Helmet)">
                    Fully Compliant (Gloves, Boots, Helmet, Harness)
                  </option>
                  <option value="Partial PPE Worn (Missing Gloves / Harness)">
                    Partial PPE Worn (Missing Gloves / Harness)
                  </option>
                  <option value="No Protective Gear Worn">No Protective Gear Worn</option>
                  <option value="Equipment Breakdown / Insulation Failure">
                    Equipment Breakdown / Insulation Failure
                  </option>
                </select>
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="clinical_findings">Clinical Triage & Findings</Label>
                <textarea
                  id="clinical_findings"
                  rows={2}
                  placeholder="Degree of burns, percentage BSA, presence of entrance/exit marks, ECG rhythm status, neurological orientation..."
                  value={form.clinical_findings}
                  onChange={(e) => setForm({ ...form, clinical_findings: e.target.value })}
                  className="w-full rounded-md border border-input bg-background p-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="immediate_treatment_given">Immediate Treatment Given</Label>
                <textarea
                  id="immediate_treatment_given"
                  rows={2}
                  placeholder="Cooling, silver sulfadiazine burn dressing, IV fluids, cervical collar, analgesics administered..."
                  value={form.immediate_treatment_given}
                  onChange={(e) => setForm({ ...form, immediate_treatment_given: e.target.value })}
                  className="w-full rounded-md border border-input bg-background p-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="duty_recommendation">Duty Recommendation</Label>
                <select
                  id="duty_recommendation"
                  value={form.duty_recommendation}
                  onChange={(e) => setForm({ ...form, duty_recommendation: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="Medical Sick Leave">Medical Sick Leave</option>
                  <option value="Restricted Ground Duty Only">Restricted Ground Duty Only</option>
                  <option value="Fit for Normal Duty">Fit for Normal Duty</option>
                  <option value="Referred to Burn / Trauma Center">Referred to Burn / Trauma Center</option>
                  <option value="Medical Board Disability Evaluation">Medical Board Disability Evaluation</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="reported_by">Reported By (Safety Officer / Lead)</Label>
                <Input
                  id="reported_by"
                  placeholder="e.g. Eng. Girma Wolde"
                  value={form.reported_by}
                  onChange={(e) => setForm({ ...form, reported_by: e.target.value })}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-border/50 pt-4">
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving} className="bg-rose-600 text-white hover:bg-rose-500">
                {saving ? "Saving..." : "Record Incident"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      {selectedIncident && (
        <Dialog open={!!selectedIncident} onOpenChange={() => setSelectedIncident(null)}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between text-base font-bold">
                <span>Incident #{selectedIncident.incident_id}</span>
                <Badge variant="outline">{selectedIncident.status}</Badge>
              </DialogTitle>
              <DialogDescription>
                {selectedIncident.patient_name} ({selectedIncident.staff_id || "Staff"}) • {selectedIncident.cadre}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3 rounded-lg bg-muted/40 p-3">
                <div>
                  <span className="text-xs text-muted-foreground">Hazard Type:</span>
                  <div className="font-semibold text-foreground">{selectedIncident.incident_type}</div>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Voltage Level:</span>
                  <div className="font-semibold text-foreground">{selectedIncident.voltage_level}</div>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Location:</span>
                  <div className="font-semibold text-foreground">{selectedIncident.work_location}</div>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Region:</span>
                  <div className="font-semibold text-foreground">{selectedIncident.region}</div>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Clinical Observations</h4>
                <p className="mt-1 rounded border border-border/40 p-2.5 text-xs text-foreground bg-background">
                  {selectedIncident.clinical_findings || "No detailed clinical triage remarks recorded."}
                </p>
              </div>

              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Immediate Treatment Given</h4>
                <p className="mt-1 rounded border border-border/40 p-2.5 text-xs text-foreground bg-background">
                  {selectedIncident.immediate_treatment_given || "No immediate treatment logged."}
                </p>
              </div>

              {/* Connected Clinical Pipeline Section */}
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                    <Icon icon="solar:shield-check-bold" size={15} />
                    Connected Occupational Clinical Pipeline
                  </h4>
                  <span className="text-[10px] text-muted-foreground">EEU Health Directorate</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {/* Clinical Encounter */}
                  <div className="rounded border border-border/60 bg-background p-2.5 flex flex-col justify-between">
                    <div>
                      <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                        <Icon icon="solar:notes-bold-duotone" size={13} className="text-cyan-500" />
                        Clinical Examination
                      </span>
                      {selectedIncident.clinical_encounter_display ? (
                        <div className="mt-1 font-mono font-bold text-cyan-600 dark:text-cyan-400">
                          {selectedIncident.clinical_encounter_display}
                          <span className="block text-[10px] font-normal text-muted-foreground">Encounter recorded</span>
                        </div>
                      ) : (
                        <p className="mt-1 text-[11px] text-muted-foreground">No clinic consultation linked yet.</p>
                      )}
                    </div>
                    {!selectedIncident.clinical_encounter_display && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={pipelineLoadingId === selectedIncident.id}
                        onClick={() => handleCreateEncounter(selectedIncident)}
                        className="mt-2 h-7 text-xs border-cyan-500/40 text-cyan-600 hover:bg-cyan-500/10 gap-1 w-full"
                      >
                        <Icon icon="solar:add-circle-bold" size={13} />
                        {pipelineLoadingId === selectedIncident.id ? "Creating..." : "Create Encounter"}
                      </Button>
                    )}
                  </div>

                  {/* Sick Leave Certificate */}
                  <div className="rounded border border-border/60 bg-background p-2.5 flex flex-col justify-between">
                    <div>
                      <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                        <Icon icon="solar:document-medicine-bold-duotone" size={13} className="text-emerald-500" />
                        Medical Sick Leave Slip
                      </span>
                      {selectedIncident.sick_leave_slip_code ? (
                        <div className="mt-1 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          {selectedIncident.sick_leave_slip_code}
                          <span className="block text-[10px] font-normal text-muted-foreground">
                            {selectedIncident.sick_leave_total_days || selectedIncident.lost_work_days} Lost Days Certified
                          </span>
                        </div>
                      ) : (
                        <p className="mt-1 text-[11px] text-muted-foreground">No sick leave issued yet.</p>
                      )}
                    </div>
                    {!selectedIncident.sick_leave_slip_code && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleOpenLeaveModal(selectedIncident)}
                        className="mt-2 h-7 text-xs border-indigo-500/40 text-indigo-600 hover:bg-indigo-500/10 gap-1 w-full"
                      >
                        <Icon icon="solar:document-add-bold" size={13} />
                        Issue Sick Leave
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-border/50 pt-3 text-xs text-muted-foreground">
                <span>PPE: {selectedIncident.ppe_compliance}</span>
                <span>Reported By: {selectedIncident.reported_by || "Safety Lead"}</span>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Quick Sick Leave Modal */}
      {leaveModalOpen && leaveIncident && (
        <Dialog open={leaveModalOpen} onOpenChange={setLeaveModalOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base font-bold text-indigo-600 dark:text-indigo-400">
                <Icon icon="solar:document-medicine-bold-duotone" size={20} />
                <span>Issue Certified EEU Medical Leave Slip</span>
              </DialogTitle>
              <DialogDescription>
                Generating rest certificate for <strong>{leaveIncident.patient_name}</strong> ({leaveIncident.staff_id || "Staff"}) following Incident #{leaveIncident.incident_id}.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleIssueLeaveSubmit} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="leave_days">Recommended Days of Rest</Label>
                  <Input
                    id="leave_days"
                    type="number"
                    min={1}
                    max={120}
                    value={leaveDays}
                    onChange={(e) => setLeaveDays(Number(e.target.value))}
                    required
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="leave_branch">Issuing Clinic Branch</Label>
                  <select
                    id="leave_branch"
                    value={leaveBranch}
                    onChange={(e) => setLeaveBranch(e.target.value)}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="Ethiopian Electric Utility Medium Clinic">Ethiopian Electric Utility Medium Clinic</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="duty_restr">Certified Duty Restriction</Label>
                <select
                  id="duty_restr"
                  value={leaveRestriction}
                  onChange={(e) => setLeaveRestriction(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="Complete Bed Rest / Total Absence">Complete Bed Rest / Total Absence</option>
                  <option value="Restricted to Light Ground Duty (No Climbing / No Field Patrol)">
                    Restricted to Light Ground Duty (No Climbing / No Field Patrol)
                  </option>
                  <option value="Complete Absence from High-Voltage & Substation Yard">
                    Complete Absence from High-Voltage & Substation Yard
                  </option>
                  <option value="Desk / Administrative Duty Only (No Manual Handling)">
                    Desk / Administrative Duty Only (No Manual Handling)
                  </option>
                  <option value="Fit for Normal Duties with Gradual Load Increase">
                    Fit for Normal Duties with Gradual Load Increase
                  </option>
                </select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="doctor_rem">Physician Remarks & Recovery Instructions</Label>
                <textarea
                  id="doctor_rem"
                  rows={3}
                  value={leaveRemarks}
                  onChange={(e) => setLeaveRemarks(e.target.value)}
                  className="w-full rounded-md border border-input bg-background p-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="Clinical recovery orders, wound dressing intervals, or follow-up dates..."
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-border/50">
                <Button type="button" variant="outline" size="sm" onClick={() => setLeaveModalOpen(false)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={leaveSaving}
                  className="bg-indigo-600 text-white hover:bg-indigo-500"
                >
                  {leaveSaving ? "Issuing..." : "Confirm & Issue Slip"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
