import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/ui/card";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { Badge } from "@/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/ui/dialog";
import { Icon } from "@/components/icon";
import { HealthcareApi } from "@/api/services/healthcareService";
import type { EEUEmergencySOS } from "@/api/services/healthcareService";
import { useClinicStore } from "@/store/clinicStore";
import { toast } from "sonner";

export default function EEUEmergencySOSPage() {
  const navigate = useNavigate();
  const activeClinic = useClinicStore((s) => s.activeClinic);
  const setActiveClinicId = useClinicStore((s) => s.setActiveClinicId);

  const [emergencies, setEmergencies] = useState<EEUEmergencySOS[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total_sos_calls: 0,
    active_en_route: 0,
    critical_cases: 0,
    transferred_to_burn_hospital: 0,
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");

  // Create SOS Alert Modal State
  const [sosModalOpen, setSosModalOpen] = useState(false);
  const [creatingSos, setCreatingSos] = useState(false);
  const [sosForm, setSosForm] = useState({
    substation_name: "",
    voltage_level: "230kV High Voltage Grid",
    region: activeClinic.region !== "National Directorate" ? activeClinic.region : "Addis Ababa",
    hazard_type: "Arc Flash Explosion",
    severity_level: "Severe - Burn ICU / Resuscitation Required",
    casualty_count: 1,
    caller_name: "Shift Safety Engineer",
    caller_phone: "+251 91 100 2233",
    eta_minutes: 15,
    destination_clinic: activeClinic.name !== "All EEU Healthcare Facilities" ? activeClinic.name : "Head Office Central Clinic",
    pre_arrival_prep_notes: "Severe 2nd/3rd degree arc flash burns. IV line initiated in field.",
  });

  // Status Update Modal State
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [selectedSos, setSelectedSos] = useState<EEUEmergencySOS | null>(null);
  const [targetStatus, setTargetStatus] = useState("Arrived at Clinic");
  const [updatingStatus, setUpdatingStatus] = useState(false);

  useEffect(() => {
    loadSOSData();
    const interval = setInterval(loadSOSData, 15000);
    return () => clearInterval(interval);
  }, []);

  const loadSOSData = async () => {
    try {
      const [res, statsRes] = await Promise.all([
        HealthcareApi.eeuEmergencySOS.list({ page_size: 50 }),
        HealthcareApi.eeuEmergencySOS.stats().catch(() => ({
          total_sos_calls: 0,
          active_en_route: 0,
          critical_cases: 0,
          transferred_to_burn_hospital: 0,
        })),
      ]);
      setEmergencies(res.results || []);
      if (statsRes) {
        setStats(statsRes);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to refresh emergency SOS feed");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSOS = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sosForm.substation_name.trim()) {
      toast.error("Please enter the substation or transmission site location");
      return;
    }

    setCreatingSos(true);
    try {
      const newAlert = await HealthcareApi.eeuEmergencySOS.create({
        ...sosForm,
        status: "Active / En Route",
      });
      toast.success(
        `EMERGENCY SOS BROADCASTED: ${newAlert.sos_id} - Trauma Bay alerted for ${newAlert.substation_name}`
      );
      setSosModalOpen(false);
      setSosForm({
        substation_name: "",
        voltage_level: "230kV High Voltage Grid",
        region: activeClinic.region !== "National Directorate" ? activeClinic.region : "Addis Ababa",
        hazard_type: "Arc Flash Explosion",
        severity_level: "Severe - Burn ICU / Resuscitation Required",
        casualty_count: 1,
        caller_name: "Shift Safety Engineer",
        caller_phone: "+251 91 100 2233",
        eta_minutes: 15,
        destination_clinic: activeClinic.name,
        pre_arrival_prep_notes: "",
      });
      await loadSOSData();
    } catch (err) {
      console.error(err);
      toast.error("Failed to broadcast Emergency SOS");
    } finally {
      setCreatingSos(false);
    }
  };

  const openStatusModal = (sos: EEUEmergencySOS) => {
    setSelectedSos(sos);
    setTargetStatus(sos.status === "Active / En Route" ? "Arrived at Clinic" : "Transferred to ALERT Hospital");
    setStatusModalOpen(true);
  };

  const handleUpdateStatus = async () => {
    if (!selectedSos) return;
    setUpdatingStatus(true);
    try {
      await HealthcareApi.eeuEmergencySOS.updateStatus(selectedSos.id, targetStatus);
      toast.success(`Updated status for ${selectedSos.sos_id} to "${targetStatus}"`);
      setStatusModalOpen(false);
      setSelectedSos(null);
      await loadSOSData();
    } catch (err) {
      console.error(err);
      toast.error("Failed to update status");
    } finally {
      setUpdatingStatus(false);
    }
  };

  const filteredEmergencies = emergencies.filter((item) => {
    const matchesSearch =
      (item.substation_name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.sos_id || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.hazard_type || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.caller_name || "").toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === "all" || item.status === statusFilter;
    const matchesSeverity = severityFilter === "all" || item.severity_level === severityFilter;

    let matchesClinic = true;
    if (activeClinic.id !== "all" && activeClinic.region !== "National Directorate") {
      matchesClinic =
        (item.region || "").toLowerCase() === activeClinic.region.toLowerCase() ||
        (item.destination_clinic || "").toLowerCase().includes(activeClinic.name.toLowerCase());
    }

    return matchesSearch && matchesStatus && matchesSeverity && matchesClinic;
  });

  return (
    <div className="space-y-6 p-2 md:p-4">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="flex h-2.5 w-2.5 rounded-full bg-rose-500 animate-ping" />
            <span className="text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
              Live Trauma & Substation Dispatch
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            Substation Emergency SOS & Casualty Pre-Arrival Board
          </h1>
          <p className="text-sm text-muted-foreground">
            Real-time telemetry and triage pre-arrival alert system for high-voltage arc flashes, electrocutions, and transmission line casualties across EEU grids.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="outline"
            onClick={() => loadSOSData()}
            className="gap-2 text-xs h-9"
          >
            <Icon icon="solar:refresh-bold" size={15} />
            Refresh Feed
          </Button>
          <Button
            onClick={() => setSosModalOpen(true)}
            className="gap-2 bg-rose-600 hover:bg-rose-700 text-white font-bold shadow-lg shadow-rose-600/25 h-9"
          >
            <Icon icon="solar:danger-triangle-bold" size={18} />
            Trigger Substation SOS Alert
          </Button>
        </div>
      </div>

      {/* Active Clinic Context Banner */}
      {activeClinic.id !== "all" && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-950 dark:text-rose-200">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-rose-500/20 text-rose-600 dark:text-rose-400">
              <Icon icon="solar:hospital-bold-duotone" size={20} />
            </div>
            <div>
              <span className="font-bold text-foreground">Receiving Facility Focus: </span>
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
            Show All National Grids
          </Button>
        </div>
      )}

      {/* Live KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-rose-500/30 bg-rose-500/5">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-rose-700 dark:text-rose-400">Active Trauma En Route</p>
              <h3 className="text-2xl font-bold font-mono text-rose-700 dark:text-rose-400 mt-1">
                {stats.active_en_route}
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">En route or in triage</p>
            </div>
            <div className="p-2.5 rounded-2xl bg-rose-500/15 text-rose-600">
              <Icon icon="solar:ambulance-bold-duotone" size={26} />
            </div>
          </CardContent>
        </Card>

        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">Critical / Resuscitation</p>
              <h3 className="text-2xl font-bold font-mono text-amber-700 dark:text-amber-400 mt-1">
                {stats.critical_cases}
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">Requires trauma bay prep</p>
            </div>
            <div className="p-2.5 rounded-2xl bg-amber-500/15 text-amber-600">
              <Icon icon="solar:danger-triangle-bold-duotone" size={26} />
            </div>
          </CardContent>
        </Card>

        <Card className="border-sky-500/30 bg-sky-500/5">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-sky-700 dark:text-sky-400">Total SOS Broadcasts</p>
              <h3 className="text-2xl font-bold font-mono text-sky-700 dark:text-sky-400 mt-1">
                {stats.total_sos_calls}
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">Grid incidents reported</p>
            </div>
            <div className="p-2.5 rounded-2xl bg-sky-500/15 text-sky-600">
              <Icon icon="solar:alarm-bold-duotone" size={26} />
            </div>
          </CardContent>
        </Card>

        <Card className="border-emerald-500/30 bg-emerald-500/5">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">Hospital Transferred</p>
              <h3 className="text-2xl font-bold font-mono text-emerald-700 dark:text-emerald-400 mt-1">
                {stats.transferred_to_burn_hospital}
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">Tertiary burn unit care</p>
            </div>
            <div className="p-2.5 rounded-2xl bg-emerald-500/15 text-emerald-600">
              <Icon icon="solar:diploma-verified-bold-duotone" size={26} />
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
              placeholder="Search by SOS code (e.g. EEU-SOS-2026-0001), substation, or hazard..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 text-xs"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 py-1 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="all">All Statuses</option>
              <option value="Active / En Route">Active / En Route</option>
              <option value="Arrived at Clinic">Arrived at Clinic</option>
              <option value="Treated & Admitted">Treated & Admitted</option>
              <option value="Transferred to ALERT Hospital">Transferred to ALERT Hospital</option>
              <option value="Resolved / Stand Down">Resolved / Stand Down</option>
            </select>

            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 py-1 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="all">All Severities</option>
              <option value="Critical - CPR / Resuscitation En Route">Critical - CPR / Resuscitation</option>
              <option value="Severe - Burn ICU / Resuscitation Required">Severe - Burn ICU Required</option>
              <option value="Moderate - Conscious / Trauma Dressing">Moderate - Conscious</option>
              <option value="Multiple Casualties (Mass Triage)">Multiple Casualties</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Emergency Alert Feed */}
      <div className="space-y-4">
        {loading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            <Icon icon="solar:refresh-bold" className="animate-spin inline-block mr-2" size={18} />
            Connecting to EEU live dispatch stream...
          </div>
        ) : filteredEmergencies.length === 0 ? (
          <Card className="border-dashed p-10 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 mb-3">
              <Icon icon="solar:shield-check-bold" size={26} />
            </div>
            <h3 className="text-base font-bold text-foreground">No Active Substation Trauma Emergencies</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
              All electrical grids and distribution stations are reporting normal occupational status. Use the button above to broadcast an incident if an emergency occurs.
            </p>
          </Card>
        ) : (
          filteredEmergencies.map((sos) => {
            const isCritical = sos.severity_level?.includes("Critical");
            const isEnRoute = sos.status === "Active / En Route";
            const isResolved = sos.status?.includes("Resolved");

            return (
              <Card
                key={sos.id}
                className={`overflow-hidden transition-all border-2 ${
                  isCritical
                    ? "border-rose-500/60 shadow-md shadow-rose-500/10 bg-rose-500/[0.02]"
                    : isEnRoute
                    ? "border-amber-500/50 bg-amber-500/[0.02]"
                    : "border-border"
                }`}
              >
                <div className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Left Column: Substation, Hazard & Casualties */}
                  <div className="space-y-2 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-muted text-foreground border">
                        {sos.sos_id}
                      </span>
                      <Badge
                        className={
                          isCritical
                            ? "bg-rose-600 text-white font-bold animate-pulse"
                            : "bg-amber-500 text-white"
                        }
                      >
                        {sos.severity_level}
                      </Badge>
                      <Badge variant="outline" className="font-mono text-[11px]">
                        {sos.voltage_level}
                      </Badge>
                      <Badge
                        variant="secondary"
                        className={
                          isEnRoute
                            ? "bg-sky-500/15 text-sky-700 dark:text-sky-300 font-bold"
                            : isResolved
                            ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-medium"
                            : "bg-muted text-foreground"
                        }
                      >
                        {sos.status}
                      </Badge>
                      {sos.eta_minutes !== undefined && isEnRoute && (
                        <span className="flex items-center gap-1 text-xs font-mono font-bold text-rose-600 dark:text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20">
                          <Icon icon="solar:clock-circle-bold" size={13} />
                          ETA: ~{sos.eta_minutes} mins
                        </span>
                      )}
                    </div>

                    <div className="flex items-baseline gap-2">
                      <h3 className="text-base font-bold text-foreground">
                        {sos.substation_name}
                      </h3>
                      <span className="text-xs text-muted-foreground font-medium">
                        ({sos.region})
                      </span>
                    </div>

                    <div className="text-xs space-y-1">
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-muted-foreground">
                        <span>
                          <strong>Hazard: </strong>
                          <span className="text-foreground font-medium">{sos.hazard_type}</span>
                        </span>
                        <span>
                          <strong>Casualties: </strong>
                          <span className="text-foreground font-bold font-mono">
                            {sos.casualty_count} Lineman / Technician
                          </span>
                        </span>
                        {sos.caller_name && (
                          <span>
                            <strong>Reported By: </strong>
                            <span className="text-foreground">{sos.caller_name} ({sos.caller_phone})</span>
                          </span>
                        )}
                      </div>

                      {sos.pre_arrival_prep_notes && (
                        <div className="mt-2 p-2.5 rounded-xl bg-muted/40 border border-border/60 text-xs">
                          <span className="font-bold text-foreground">Paramedic Pre-Arrival Field Notes: </span>
                          <span className="text-foreground/90">{sos.pre_arrival_prep_notes}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-muted-foreground font-mono">
                      <span>Destination Clinic: {sos.destination_clinic || "Ethiopian Electric Utility Medium Clinic"}</span>
                    </div>
                  </div>

                  {/* Right Column: Actions */}
                  <div className="flex flex-row lg:flex-col gap-2 shrink-0 justify-end pt-2 lg:pt-0 border-t lg:border-t-0">
                    <Button
                      size="sm"
                      onClick={() => openStatusModal(sos)}
                      className="text-xs h-8 gap-1.5 bg-primary text-primary-foreground font-semibold"
                    >
                      <Icon icon="solar:pen-bold" size={14} />
                      Update Status
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => navigate("/healthcare/occupational/guarantee-of-payment")}
                      className="text-xs h-8 gap-1.5 border-emerald-500/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10 font-semibold"
                    >
                      <Icon icon="solar:diploma-verified-bold" size={14} />
                      Issue Hospital GOP
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>

      {/* Trigger SOS Modal */}
      <Dialog open={sosModalOpen} onOpenChange={setSosModalOpen}>
        <DialogContent className="max-w-xl">
          <form onSubmit={handleCreateSOS}>
            <DialogHeader>
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-rose-500/10 text-rose-600">
                  <Icon icon="solar:danger-triangle-bold" size={22} />
                </div>
                <div>
                  <DialogTitle className="text-base font-bold text-foreground">
                    Broadcast Substation Emergency SOS
                  </DialogTitle>
                  <DialogDescription className="text-xs">
                    Alert the nearest EEU Occupational Health Clinic & dispatch pre-arrival trauma bay protocols.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-4 py-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-[11px] font-semibold text-foreground/80 mb-1 block">
                    Substation / Tower Site *
                  </Label>
                  <Input
                    required
                    placeholder="e.g. Kality 230kV Substation Yard #4"
                    value={sosForm.substation_name}
                    onChange={(e) => setSosForm({ ...sosForm, substation_name: e.target.value })}
                    className="h-9"
                  />
                </div>
                <div>
                  <Label className="text-[11px] font-semibold text-foreground/80 mb-1 block">
                    Region
                  </Label>
                  <select
                    value={sosForm.region}
                    onChange={(e) => setSosForm({ ...sosForm, region: e.target.value })}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs"
                  >
                    <option value="Addis Ababa">Addis Ababa</option>
                    <option value="Oromia">Oromia</option>
                    <option value="Amhara">Amhara</option>
                    <option value="Sidama">Sidama</option>
                    <option value="Tigray">Tigray</option>
                    <option value="Dire Dawa">Dire Dawa</option>
                    <option value="Benishangul-Gumuz">Benishangul-Gumuz</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <Label className="text-[11px] font-semibold text-foreground/80 mb-1 block">
                    Grid Voltage Level
                  </Label>
                  <select
                    value={sosForm.voltage_level}
                    onChange={(e) => setSosForm({ ...sosForm, voltage_level: e.target.value })}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs"
                  >
                    <option value="230kV High Voltage Grid">230kV High Voltage Grid</option>
                    <option value="132kV Grid Transmission">132kV Grid Transmission</option>
                    <option value="66kV Sub-Transmission">66kV Sub-Transmission</option>
                    <option value="33kV Distribution">33kV Distribution</option>
                    <option value="15kV Distribution">15kV Distribution</option>
                    <option value="400V Low Voltage">400V Low Voltage</option>
                  </select>
                </div>
                <div>
                  <Label className="text-[11px] font-semibold text-foreground/80 mb-1 block">
                    Hazard Classification
                  </Label>
                  <select
                    value={sosForm.hazard_type}
                    onChange={(e) => setSosForm({ ...sosForm, hazard_type: e.target.value })}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs"
                  >
                    <option value="Arc Flash Explosion">Arc Flash Explosion</option>
                    <option value="Direct High-Voltage Electrocution">Direct High-Voltage Electrocution</option>
                    <option value="Pylon Fall from Height">Pylon Fall from Height</option>
                    <option value="Transformer Fire / Oil Deflagration">Transformer Fire / Oil Deflagration</option>
                    <option value="Switchgear Flashover">Switchgear Flashover</option>
                  </select>
                </div>
                <div>
                  <Label className="text-[11px] font-semibold text-foreground/80 mb-1 block">
                    Initial Severity
                  </Label>
                  <select
                    value={sosForm.severity_level}
                    onChange={(e) => setSosForm({ ...sosForm, severity_level: e.target.value })}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs"
                  >
                    <option value="Critical - CPR / Resuscitation En Route">Critical - CPR / Resuscitation</option>
                    <option value="Severe - Burn ICU / Resuscitation Required">Severe - Burn ICU Required</option>
                    <option value="Moderate - Conscious / Trauma Dressing">Moderate - Conscious</option>
                    <option value="Multiple Casualties (Mass Triage)">Multiple Casualties</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <Label className="text-[11px] font-semibold text-foreground/80 mb-1 block">
                    Casualties Count
                  </Label>
                  <Input
                    type="number"
                    min="1"
                    value={sosForm.casualty_count}
                    onChange={(e) => setSosForm({ ...sosForm, casualty_count: Number(e.target.value) })}
                    className="h-9 font-mono"
                  />
                </div>
                <div>
                  <Label className="text-[11px] font-semibold text-foreground/80 mb-1 block">
                    Ambulance ETA (Mins)
                  </Label>
                  <Input
                    type="number"
                    min="1"
                    value={sosForm.eta_minutes}
                    onChange={(e) => setSosForm({ ...sosForm, eta_minutes: Number(e.target.value) })}
                    className="h-9 font-mono"
                  />
                </div>
                <div>
                  <Label className="text-[11px] font-semibold text-foreground/80 mb-1 block">
                    Reporter Name & Phone
                  </Label>
                  <Input
                    value={sosForm.caller_name}
                    onChange={(e) => setSosForm({ ...sosForm, caller_name: e.target.value })}
                    placeholder="e.g. Safety Eng. Dawit"
                    className="h-9"
                  />
                </div>
              </div>

              <div>
                <Label className="text-[11px] font-semibold text-foreground/80 mb-1 block">
                  Pre-Arrival Medical Notes & Immediate Resuscitation Measures
                </Label>
                <textarea
                  rows={3}
                  className="w-full rounded-md border border-input bg-background p-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="Paramedic observations, IV fluid started, burn surface area estimate, airway status..."
                  value={sosForm.pre_arrival_prep_notes}
                  onChange={(e) => setSosForm({ ...sosForm, pre_arrival_prep_notes: e.target.value })}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSosModalOpen(false)}
                disabled={creatingSos}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={creatingSos}
                className="gap-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold"
              >
                {creatingSos ? (
                  <>
                    <Icon icon="solar:refresh-bold" className="animate-spin" size={14} />
                    Broadcasting...
                  </>
                ) : (
                  <>
                    <Icon icon="solar:bell-bold" size={14} />
                    Broadcast Emergency Alert
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Update Status Modal */}
      {selectedSos && (
        <Dialog open={statusModalOpen} onOpenChange={setStatusModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-foreground">
                Update Trauma Status: {selectedSos.sos_id}
              </DialogTitle>
              <DialogDescription className="text-xs">
                {selectedSos.substation_name} • {selectedSos.hazard_type}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2 text-xs">
              <div>
                <Label className="text-[11px] font-semibold text-foreground/80 mb-1 block">
                  New Patient Care Status
                </Label>
                <select
                  value={targetStatus}
                  onChange={(e) => setTargetStatus(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs font-semibold"
                >
                  <option value="Active / En Route">Active / En Route</option>
                  <option value="Arrived at Clinic">Arrived at Clinic</option>
                  <option value="Treated & Admitted">Treated & Admitted</option>
                  <option value="Transferred to ALERT Hospital">Transferred to ALERT Hospital</option>
                  <option value="Resolved / Stand Down">Resolved / Stand Down</option>
                </select>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStatusModalOpen(false)}
                disabled={updatingStatus}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleUpdateStatus}
                disabled={updatingStatus}
                className="gap-1.5 bg-primary text-primary-foreground font-semibold"
              >
                {updatingStatus ? "Saving..." : "Confirm Status Update"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
