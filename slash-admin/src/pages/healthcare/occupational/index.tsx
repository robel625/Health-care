import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/ui/card";
import { Button } from "@/ui/button";
import { Badge } from "@/ui/badge";
import { Icon } from "@/components/icon";
import eeuLogoImg from "@/assets/images/eeu-logo.png";
import { HealthcareApi } from "@/api/services/healthcareService";
import type { EEUWorkplaceIncident, EEUFitnessEvaluation, EEUFirstAidKit, EEUEmergencySOS } from "@/api/services/healthcareService";
import { useClinicStore } from "@/store/clinicStore";
import { toast } from "sonner";

export default function EEUOccupationalDashboard() {
  const navigate = useNavigate();
  const activeClinic = useClinicStore((s) => s.activeClinic);
  const setActiveClinicId = useClinicStore((s) => s.setActiveClinicId);

  const [loading, setLoading] = useState(true);
  const [incidentStats, setIncidentStats] = useState<any>({
    total_incidents: 0,
    arc_flash_burns: 0,
    electrical_shocks: 0,
    falls_from_height: 0,
    high_voltage_cases: 0,
    severe_critical: 0,
    active_medical_review: 0,
  });
  const [fitnessStats, setFitnessStats] = useState<any>({
    total_evaluations: 0,
    fit_to_climb: 0,
    ground_duty_only: 0,
    color_vision_deficiency: 0,
    hearing_threshold_shifts: 0,
  });
  const [kitStats, setKitStats] = useState<any>({
    total_kits: 0,
    fully_stocked: 0,
    needs_replenishment: 0,
    critical_shortage: 0,
  });

  const [recentIncidents, setRecentIncidents] = useState<EEUWorkplaceIncident[]>([]);
  const [recentEvaluations, setRecentEvaluations] = useState<EEUFitnessEvaluation[]>([]);
  const [criticalKits, setCriticalKits] = useState<EEUFirstAidKit[]>([]);
  const [activeEmergency, setActiveEmergency] = useState<EEUEmergencySOS | null>(null);

  useEffect(() => {
    loadData();
    const sosInterval = setInterval(loadActiveSOS, 20000);
    return () => clearInterval(sosInterval);
  }, []);

  const loadActiveSOS = async () => {
    try {
      const sosRes = await HealthcareApi.eeuEmergencySOS.list({ page_size: 5 });
      const active = (sosRes.results || []).find(
        (s) => s.status === "In-Transit" || s.status === "Dispatched" || s.status === "Arrived at Clinic"
      );
      setActiveEmergency(active || null);
    } catch {
      // ignore
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [iStats, fStats, kStats, incRes, fitRes, kitRes, sosRes] = await Promise.all([
        HealthcareApi.eeuIncidents.stats().catch(() => ({})),
        HealthcareApi.eeuFitnessEvaluations.stats().catch(() => ({})),
        HealthcareApi.eeuFirstAidKits.stats().catch(() => ({})),
        HealthcareApi.eeuIncidents.list({ page_size: 5 }).catch(() => ({ results: [] })),
        HealthcareApi.eeuFitnessEvaluations.list({ page_size: 5 }).catch(() => ({ results: [] })),
        HealthcareApi.eeuFirstAidKits.list({ page_size: 5 }).catch(() => ({ results: [] })),
        HealthcareApi.eeuEmergencySOS.list({ page_size: 5 }).catch(() => ({ results: [] })),
      ]);

      if (iStats) setIncidentStats(iStats);
      if (fStats) setFitnessStats(fStats);
      if (kStats) setKitStats(kStats);
      if (incRes?.results) setRecentIncidents(incRes.results);
      if (fitRes?.results) setRecentEvaluations(fitRes.results);
      if (kitRes?.results) setCriticalKits(kitRes.results);

      const activeSos = (sosRes?.results || []).find(
        (s: EEUEmergencySOS) => s.status === "In-Transit" || s.status === "Dispatched" || s.status === "Arrived at Clinic"
      );
      setActiveEmergency(activeSos || null);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load EEU occupational health data");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 p-2 md:p-4">
      {/* ── Substation Pre-Arrival Trauma Alert Banner ── */}
      {activeEmergency && (
        <div className="relative overflow-hidden rounded-2xl border-2 border-rose-500 bg-rose-950/90 p-4 sm:p-5 shadow-2xl backdrop-blur-md animate-pulse">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="p-3 rounded-2xl bg-rose-600 text-white shadow-lg animate-bounce">
                <Icon icon="solar:ambulance-bold" size={28} />
              </div>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-rose-600 text-white">
                    LIVE SOS: {activeEmergency.sos_id}
                  </span>
                  <Badge className="bg-amber-400 text-black font-bold text-[10px]">
                    ETA ~{activeEmergency.eta_minutes ?? 15} MINS
                  </Badge>
                  <span className="text-xs font-bold text-rose-300 flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-rose-400 animate-ping inline-block" />
                    Trauma Bay Pre-Arrival Protocol Active
                  </span>
                </div>
                <h4 className="text-base font-bold text-white">
                  {activeEmergency.substation_name} • {activeEmergency.hazard_type} ({activeEmergency.voltage_level})
                </h4>
                <p className="text-xs text-rose-200">
                  Casualties: <strong>{activeEmergency.casualty_count} Lineman</strong> {activeEmergency.caller_name ? `(Reported by ${activeEmergency.caller_name})` : ""} • Destination: {activeEmergency.destination_clinic || "EEU Central Trauma Clinic"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 self-start sm:self-center">
              <Button
                onClick={() => navigate("/healthcare/occupational/emergency-sos")}
                className="bg-white hover:bg-rose-100 text-rose-900 font-bold text-xs h-9 shadow-lg gap-2"
              >
                <Icon icon="solar:shield-warning-bold" size={16} />
                Open Trauma Bay Pre-Arrival Board
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Hero Command Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-emerald-500/20 bg-gradient-to-r from-emerald-950/80 via-slate-900 to-amber-950/60 p-6 shadow-xl backdrop-blur-md">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-5">
            <div className="relative flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-white/10 p-2 shadow-inner ring-2 ring-emerald-500/30">
              <img src={eeuLogoImg} alt="EEU Emblem" className="h-full w-full object-contain drop-shadow" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-emerald-500/20 px-3 py-0.5 text-xs font-semibold uppercase tracking-wider text-emerald-300 ring-1 ring-emerald-500/30">
                  Occupational Health & Safety Directorate
                </span>
                <span className="rounded-full bg-amber-500/20 px-3 py-0.5 text-xs font-medium text-amber-300 ring-1 ring-amber-500/30">
                  EEU Power Distribution Grid
                </span>
              </div>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-white md:text-3xl">
                EEU Occupational Health & Medical Safety
              </h1>
              <p className="mt-1 text-sm text-slate-300">
                Central command for Electrical Hazard Management, Lineman High-Altitude Fitness, and Workplace Incident Response.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2.5">
            <Button
              onClick={() => navigate("/healthcare/occupational/emergency-sos")}
              className="gap-2 bg-rose-600 font-semibold text-white shadow-lg hover:bg-rose-500"
            >
              <Icon icon="solar:ambulance-bold" size={18} />
              Emergency SOS Board
            </Button>
            <Button
              onClick={() => navigate("/healthcare/occupational/guarantee-of-payment")}
              variant="outline"
              className="gap-2 border-emerald-500/30 bg-emerald-950/40 text-emerald-300 hover:bg-emerald-900/50"
            >
              <Icon icon="solar:diploma-verified-bold" size={18} />
              Hospital GOP Letters
            </Button>
            <Button
              onClick={() => navigate("/healthcare/occupational/pme-campaigns")}
              variant="outline"
              className="gap-2 border-sky-500/30 bg-sky-950/40 text-sky-300 hover:bg-sky-900/50"
            >
              <Icon icon="solar:calendar-date-bold" size={18} />
              PME Batch Campaigns
            </Button>
            <Button
              onClick={() => navigate("/healthcare/occupational/toxic-surveillance")}
              variant="outline"
              className="gap-2 border-amber-500/30 bg-amber-950/40 text-amber-300 hover:bg-amber-900/50"
            >
              <Icon icon="solar:shield-warning-bold" size={18} />
              SF6 & Chemical Logs
            </Button>
          </div>
        </div>
      </div>

      {/* Active Clinic Context Notification */}
      {activeClinic.id !== "all" && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-950 dark:text-emerald-200">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
              <Icon icon="solar:hospital-bold-duotone" size={20} />
            </div>
            <div>
              <span className="font-bold text-foreground">Occupational Health Center: </span>
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
            Switch to National Directorate Overview
          </Button>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Workplace Incidents */}
        <Card className="border-border/60 bg-card/80 shadow transition-all hover:shadow-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Workplace & Electrical Incidents
            </CardTitle>
            <div className="rounded-lg bg-rose-500/10 p-2 text-rose-500">
              <Icon icon="solar:danger-bold-duotone" size={20} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold text-foreground">
              {loading ? "..." : incidentStats.total_incidents || 0}
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5 text-xs text-muted-foreground">
              <Badge variant="outline" className="border-amber-500/30 text-amber-600 dark:text-amber-400">
                {incidentStats.arc_flash_burns || 0} Arc Flash
              </Badge>
              <Badge variant="outline" className="border-rose-500/30 text-rose-600 dark:text-rose-400">
                {incidentStats.electrical_shocks || 0} Shocks
              </Badge>
              <Badge variant="outline" className="border-blue-500/30 text-blue-600 dark:text-blue-400">
                {incidentStats.falls_from_height || 0} Pole Falls
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Lineman Climbing Fitness */}
        <Card className="border-border/60 bg-card/80 shadow transition-all hover:shadow-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Lineman "Fit-to-Climb" Status
            </CardTitle>
            <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-500">
              <Icon icon="solar:shield-check-bold-duotone" size={20} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">
              {loading ? "..." : fitnessStats.fit_to_climb || 0}
              <span className="text-sm font-normal text-muted-foreground"> Certified</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5 text-xs text-muted-foreground">
              <Badge variant="outline" className="border-amber-500/30 text-amber-600 dark:text-amber-400">
                {fitnessStats.ground_duty_only || 0} Ground Duty
              </Badge>
              {Boolean(fitnessStats.expiring_soon_count) && (
                <Badge
                  onClick={() => navigate("/healthcare/occupational/fitness-evaluations")}
                  className="bg-amber-500 text-slate-950 font-bold cursor-pointer hover:bg-amber-400"
                >
                  ⚡ {fitnessStats.expiring_soon_count} Expiring Soon
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Active Medical Reviews */}
        <Card className="border-border/60 bg-card/80 shadow transition-all hover:shadow-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Under Active Medical Review
            </CardTitle>
            <div className="rounded-lg bg-amber-500/10 p-2 text-amber-500">
              <Icon icon="solar:clock-circle-bold-duotone" size={20} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold text-amber-600 dark:text-amber-400">
              {loading ? "..." : incidentStats.active_medical_review || 0}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Staff currently undergoing injury convalescence or temporary work restrictions.
            </p>
          </CardContent>
        </Card>

        {/* Card 4: Substation & Truck Kits */}
        <Card className="border-border/60 bg-card/80 shadow transition-all hover:shadow-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Emergency First-Aid Stations
            </CardTitle>
            <div className="rounded-lg bg-cyan-500/10 p-2 text-cyan-500">
              <Icon icon="solar:box-minimalistic-bold-duotone" size={20} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold text-foreground">
              {loading ? "..." : kitStats.fully_stocked || 0} / {kitStats.total_kits || 0}
            </div>
            <div className="mt-2 flex items-center gap-2 text-xs">
              {kitStats.needs_replenishment > 0 && (
                <span className="font-semibold text-amber-500">
                  {kitStats.needs_replenishment} Needs Restock
                </span>
              )}
              {kitStats.critical_shortage > 0 && (
                <span className="font-semibold text-rose-500">
                  • {kitStats.critical_shortage} Critical
                </span>
              )}
              {kitStats.needs_replenishment === 0 && kitStats.critical_shortage === 0 && (
                <span className="text-emerald-500">All regional stations stocked</span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Split: Recent Incidents & Lineman Clearances */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left: Workplace & Electrical Incidents */}
        <Card className="border-border/60">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base font-bold">Recent Workplace & Electrical Incidents</CardTitle>
              <CardDescription>On-duty electrical flashes, line injuries, and triage reviews</CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/healthcare/occupational/incidents")}
              className="text-xs text-primary"
            >
              View All ({incidentStats.total_incidents || 0})
            </Button>
          </CardHeader>
          <CardContent className="divide-y divide-border/40">
            {recentIncidents.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                No recent incidents reported.
              </div>
            ) : (
              recentIncidents.map((inc) => (
                <div key={inc.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-primary">{inc.incident_id}</span>
                      <span className="font-medium text-foreground">{inc.patient_name || "EEU Staff"}</span>
                      {inc.staff_id && (
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-mono text-muted-foreground">
                          {inc.staff_id}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      <span className="font-semibold text-foreground/80">{inc.incident_type}</span> • {inc.work_location}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                      <Badge
                        variant="secondary"
                        className={
                          inc.voltage_level.includes("High")
                            ? "bg-rose-500/10 text-rose-500"
                            : inc.voltage_level.includes("Medium")
                            ? "bg-amber-500/10 text-amber-500"
                            : "bg-blue-500/10 text-blue-500"
                        }
                      >
                        {inc.voltage_level}
                      </Badge>
                      <span className="text-muted-foreground">{inc.duty_recommendation}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
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
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Right: Lineman Fitness Clearances */}
        <Card className="border-border/60">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base font-bold">Lineman Climbing Fitness & Certifications</CardTitle>
              <CardDescription>High-altitude pole climbing clearances & Ishihara vision exams</CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/healthcare/occupational/fitness-evaluations")}
              className="text-xs text-primary"
            >
              View All ({fitnessStats.total_evaluations || 0})
            </Button>
          </CardHeader>
          <CardContent className="divide-y divide-border/40">
            {recentEvaluations.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                No recent evaluations recorded.
              </div>
            ) : (
              recentEvaluations.map((fit) => (
                <div key={fit.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-primary">{fit.evaluation_id}</span>
                      <span className="font-medium text-foreground">{fit.patient_name || "Lineman"}</span>
                      {fit.staff_id && (
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-mono text-muted-foreground">
                          {fit.staff_id}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {fit.evaluation_type} • Exam Date: {fit.evaluation_date}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                      <span className="rounded bg-muted/60 px-1.5 py-0.5 text-muted-foreground">
                        Color: {fit.color_vision.split("(")[0]}
                      </span>
                      <span className="rounded bg-muted/60 px-1.5 py-0.5 text-muted-foreground">
                        Hearing: {fit.audiometry_hearing.split("(")[0]}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge
                      className={
                        fit.climbing_fitness.includes("Fit to Climb")
                          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                          : fit.climbing_fitness.includes("Restricted")
                          ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                          : "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                      }
                    >
                      {fit.climbing_fitness}
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Substation & Emergency Line Truck Kits Section */}
      <Card className="border-border/60">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base font-bold">
              Substation & Line Truck Emergency First-Aid Stations
            </CardTitle>
            <CardDescription>
              Burn packs (Water-Jel / Silver Sulfadiazine), trauma dressings, and battery room eye wash stations
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/healthcare/occupational/first-aid-kits")}
            className="text-xs text-primary"
          >
            Manage Stations ({kitStats.total_kits || 0})
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {criticalKits.map((kit) => (
              <div
                key={kit.id}
                className="flex flex-col justify-between rounded-xl border border-border/60 bg-muted/20 p-4 transition-all hover:border-primary/40"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-primary">{kit.kit_code}</span>
                    <Badge
                      className={
                        kit.status === "Fully Stocked & Sealed"
                          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                          : kit.status === "Needs Replenishment"
                          ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                          : "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                      }
                    >
                      {kit.status}
                    </Badge>
                  </div>
                  <h4 className="mt-2 text-sm font-semibold text-foreground">{kit.assigned_unit}</h4>
                  <p className="text-xs text-muted-foreground">{kit.kit_type} • {kit.region}</p>
                </div>

                <div className="mt-4 border-t border-border/40 pt-3 text-xs">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>Burn Packs: {kit.burn_dressings_stocked ? "Available" : "Missing"}</span>
                    <span>Eye Wash: {kit.eye_wash_stocked ? "Ready" : "Empty"}</span>
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    Custodian: <span className="font-medium text-foreground">{kit.custodian_name || "Unassigned"}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
