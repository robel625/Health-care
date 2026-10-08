import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/ui/card";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { Badge } from "@/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/ui/dialog";
import { Icon } from "@/components/icon";
import { HealthcareApi } from "@/api/services/healthcareService";
import type { EEUPMECampaign } from "@/api/services/healthcareService";
import { useClinicStore } from "@/store/clinicStore";
import { toast } from "sonner";

export default function EEUPMECampaignsPage() {
  const activeClinic = useClinicStore((s) => s.activeClinic);
  const setActiveClinicId = useClinicStore((s) => s.setActiveClinicId);

  const [campaigns, setCampaigns] = useState<EEUPMECampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total_campaigns: 0,
    active_campaigns: 0,
    total_target_linemen: 0,
    total_completed_screenings: 0,
    total_fit_certified: 0,
    overall_completion_pct: 0,
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [regionFilter, setRegionFilter] = useState("all");

  // Create Campaign Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    campaign_name: "",
    target_year: new Date().getFullYear(),
    target_directorate: "Distribution Directorate",
    target_region: activeClinic.region !== "National Directorate" ? activeClinic.region : "Addis Ababa",
    substation_focus: "All Regional Substations",
    target_count: 50,
    start_date: new Date().toISOString().split("T")[0],
    end_date: "",
    status: "Active Campaign",
    notes: "Mandatory annual high-altitude climbing fitness examination: Ishihara color vision, pure tone audiometry, resting ECG, and blood pressure screening.",
  });

  // Quick Record Screening Modal
  const [screeningModalOpen, setScreeningModalOpen] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<EEUPMECampaign | null>(null);
  const [isFitOutcome, setIsFitOutcome] = useState<boolean>(true);
  const [savingScreening, setSavingScreening] = useState(false);

  useEffect(() => {
    loadCampaigns();
  }, []);

  const loadCampaigns = async () => {
    setLoading(true);
    try {
      const [res, statsRes] = await Promise.all([
        HealthcareApi.eeuPMECampaigns.list({ page_size: 50 }),
        HealthcareApi.eeuPMECampaigns.stats().catch(() => ({
          total_campaigns: 0,
          active_campaigns: 0,
          total_target_linemen: 0,
          total_completed_screenings: 0,
          total_fit_certified: 0,
          overall_completion_pct: 0,
        })),
      ]);
      setCampaigns(res.results || []);
      if (statsRes) setStats(statsRes);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load PME campaigns");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.campaign_name.trim()) {
      toast.error("Please enter campaign name");
      return;
    }

    setCreating(true);
    try {
      await HealthcareApi.eeuPMECampaigns.create({
        ...form,
        target_count: Number(form.target_count),
      });
      toast.success("Scheduled new PME Campaign successfully");
      setModalOpen(false);
      setForm({
        campaign_name: "",
        target_year: new Date().getFullYear(),
        target_directorate: "Distribution Directorate",
        target_region: activeClinic.region !== "National Directorate" ? activeClinic.region : "Addis Ababa",
        substation_focus: "",
        target_count: 50,
        start_date: new Date().toISOString().split("T")[0],
        end_date: "",
        status: "Active Campaign",
        notes: "",
      });
      await loadCampaigns();
    } catch (err) {
      console.error(err);
      toast.error("Failed to create campaign");
    } finally {
      setCreating(false);
    }
  };

  const openScreeningModal = (c: EEUPMECampaign) => {
    setSelectedCampaign(c);
    setIsFitOutcome(true);
    setScreeningModalOpen(true);
  };

  const handleRecordScreening = async () => {
    if (!selectedCampaign) return;
    setSavingScreening(true);
    try {
      await HealthcareApi.eeuPMECampaigns.recordScreening(selectedCampaign.id, isFitOutcome);
      toast.success(`Screening recorded for "${selectedCampaign.campaign_name}" (${isFitOutcome ? "FIT TO CLIMB" : "GROUND DUTY RESTRICTION"})`);
      setScreeningModalOpen(false);
      setSelectedCampaign(null);
      await loadCampaigns();
    } catch (err) {
      console.error(err);
      toast.error("Failed to log screening result");
    } finally {
      setSavingScreening(false);
    }
  };

  const filteredCampaigns = campaigns.filter((c) => {
    const matchesSearch =
      (c.campaign_name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.campaign_id || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.target_directorate || "").toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === "all" || c.status === statusFilter;
    const matchesRegion = regionFilter === "all" || c.target_region === regionFilter;

    let matchesClinic = true;
    if (activeClinic.id !== "all" && activeClinic.region !== "National Directorate") {
      matchesClinic = (c.target_region || "").toLowerCase() === activeClinic.region.toLowerCase();
    }

    return matchesSearch && matchesStatus && matchesRegion && matchesClinic;
  });

  return (
    <div className="space-y-6 p-2 md:p-4">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge className="bg-sky-600 text-white font-bold text-[10px]">
              EEU Occupational Health & Preventive Medicine
            </Badge>
            <span className="text-xs text-muted-foreground font-mono">
              Annual Safety Protocol
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            Periodic Medical Examination (PME) Batch Scheduler
          </h1>
          <p className="text-sm text-muted-foreground">
            Schedule and track batch occupational fitness screenings for electrical linemen, substation operators, and high-altitude emergency crews.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="outline"
            onClick={loadCampaigns}
            className="gap-2 text-xs h-9"
          >
            <Icon icon="solar:refresh-bold" size={15} />
            Refresh
          </Button>
          <Button
            onClick={() => setModalOpen(true)}
            className="gap-2 bg-sky-600 hover:bg-sky-700 text-white font-bold shadow-lg shadow-sky-600/25 h-9"
          >
            <Icon icon="solar:calendar-date-bold" size={18} />
            Schedule New Campaign
          </Button>
        </div>
      </div>

      {/* Active Clinic Context Banner */}
      {activeClinic.id !== "all" && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-sky-500/10 border border-sky-500/20 text-xs text-sky-950 dark:text-sky-200">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-sky-500/20 text-sky-600 dark:text-sky-400">
              <Icon icon="solar:hospital-bold-duotone" size={20} />
            </div>
            <div>
              <span className="font-bold text-foreground">Regional Screening Center: </span>
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
            className="h-8 text-xs text-sky-700 hover:text-sky-900 dark:text-sky-300 dark:hover:text-white gap-1.5 self-start sm:self-auto"
          >
            <Icon icon="solar:global-bold" size={14} />
            Show National Directorate Campaigns
          </Button>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-sky-500/30 bg-sky-500/5">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-sky-700 dark:text-sky-400">Total PME Campaigns</p>
              <h3 className="text-2xl font-bold font-mono text-sky-700 dark:text-sky-400 mt-1">
                {stats.total_campaigns}
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">Active & completed batches</p>
            </div>
            <div className="p-2.5 rounded-2xl bg-sky-500/15 text-sky-600">
              <Icon icon="solar:calendar-bold-duotone" size={26} />
            </div>
          </CardContent>
        </Card>

        <Card className="border-blue-500/30 bg-blue-500/5">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-blue-700 dark:text-blue-400">Target Linemen</p>
              <h3 className="text-2xl font-bold font-mono text-blue-700 dark:text-blue-400 mt-1">
                {stats.total_target_linemen}
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">Scheduled for evaluation</p>
            </div>
            <div className="p-2.5 rounded-2xl bg-blue-500/15 text-blue-600">
              <Icon icon="solar:users-group-two-rounded-bold-duotone" size={26} />
            </div>
          </CardContent>
        </Card>

        <Card className="border-emerald-500/30 bg-emerald-500/5">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">Screenings Completed</p>
              <h3 className="text-2xl font-bold font-mono text-emerald-700 dark:text-emerald-400 mt-1">
                {stats.total_completed_screenings}
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">Medical tests evaluated</p>
            </div>
            <div className="p-2.5 rounded-2xl bg-emerald-500/15 text-emerald-600">
              <Icon icon="solar:check-circle-bold-duotone" size={26} />
            </div>
          </CardContent>
        </Card>

        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">Fit Certified to Climb</p>
              <h3 className="text-2xl font-bold font-mono text-amber-700 dark:text-amber-400 mt-1">
                {stats.total_fit_certified}
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">Cleared for live towers</p>
            </div>
            <div className="p-2.5 rounded-2xl bg-amber-500/15 text-amber-600">
              <Icon icon="solar:medal-ribbons-star-bold-duotone" size={26} />
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
              placeholder="Search by campaign code (e.g. EEU-PME-2026-001), title, or directorate..."
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
              <option value="all">All Campaign Statuses</option>
              <option value="Active Campaign">Active Campaign</option>
              <option value="Scheduled / Upcoming">Scheduled / Upcoming</option>
              <option value="Completed & Certified">Completed & Certified</option>
            </select>

            <select
              value={regionFilter}
              onChange={(e) => setRegionFilter(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 py-1 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="all">All Regions</option>
              <option value="Addis Ababa">Addis Ababa</option>
              <option value="Oromia">Oromia</option>
              <option value="Amhara">Amhara</option>
              <option value="Sidama">Sidama</option>
              <option value="Tigray">Tigray</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Campaigns Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {loading ? (
          <div className="col-span-full p-8 text-center text-sm text-muted-foreground">
            <Icon icon="solar:refresh-bold" className="animate-spin inline-block mr-2" size={18} />
            Loading PME campaign batches...
          </div>
        ) : filteredCampaigns.length === 0 ? (
          <div className="col-span-full p-8 text-center text-sm text-muted-foreground">
            No PME campaigns match the filter criteria.
          </div>
        ) : (
          filteredCampaigns.map((c) => {
            const pct = c.completion_rate_pct ?? (c.target_count > 0 ? Math.round((c.completed_count / c.target_count) * 100) : 0);
            const isCompleted = c.status === "Completed & Certified" || pct >= 100;

            return (
              <Card key={c.id} className="border-border hover:border-sky-500/40 transition-all flex flex-col justify-between">
                <CardHeader className="pb-3 border-b bg-muted/10">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-sky-600 dark:text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/20">
                          {c.campaign_id}
                        </span>
                        <Badge
                          variant="secondary"
                          className={
                            isCompleted
                              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-bold"
                              : "bg-amber-500/15 text-amber-700 dark:text-amber-300 font-bold"
                          }
                        >
                          {c.status}
                        </Badge>
                      </div>
                      <CardTitle className="text-base font-bold text-foreground">
                        {c.campaign_name}
                      </CardTitle>
                      <CardDescription className="text-xs">
                        {c.target_directorate} • {c.target_region} (Target Year {c.target_year})
                      </CardDescription>
                    </div>

                    <div className="text-right">
                      <span className="font-mono text-lg font-bold text-sky-600 dark:text-sky-400">
                        {pct}%
                      </span>
                      <span className="text-[10px] text-muted-foreground block">
                        Completion
                      </span>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="p-4 space-y-4 flex-1 flex flex-col justify-between">
                  <div className="space-y-3">
                    {/* Progress Bar */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>
                          <strong>{c.completed_count}</strong> of {c.target_count} Linemen Evaluated
                        </span>
                        <span>{Math.max(0, c.target_count - c.completed_count)} Remaining</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full bg-sky-500 transition-all duration-300"
                          style={{ width: `${Math.min(100, pct)}%` }}
                        />
                      </div>
                    </div>

                    {/* Breakdown metrics */}
                    <div className="grid grid-cols-2 gap-2 text-center text-xs">
                      <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                        <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 block">
                          Fit to Climb Certified
                        </span>
                        <span className="font-mono font-bold text-emerald-700 dark:text-emerald-300 text-sm">
                          {c.fit_certified_count}
                        </span>
                      </div>
                      <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
                        <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-300 block">
                          Target Linemen Roster
                        </span>
                        <span className="font-mono font-bold text-amber-700 dark:text-amber-300 text-sm">
                          {c.target_count}
                        </span>
                      </div>
                    </div>

                    {c.notes && (
                      <p className="text-[11px] text-muted-foreground line-clamp-2 italic">
                        "{c.notes}"
                      </p>
                    )}
                  </div>

                  <div className="pt-3 border-t flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground font-mono">
                      Started: {c.start_date}
                    </span>
                    <Button
                      size="sm"
                      onClick={() => openScreeningModal(c)}
                      className="h-8 text-xs gap-1.5 bg-sky-600 hover:bg-sky-700 text-white font-semibold"
                    >
                      <Icon icon="solar:check-read-bold" size={14} />
                      Log Screening Result
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Schedule Campaign Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-xl">
          <form onSubmit={handleCreateCampaign}>
            <DialogHeader>
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-sky-500/10 text-sky-600">
                  <Icon icon="solar:calendar-date-bold-duotone" size={22} />
                </div>
                <div>
                  <DialogTitle className="text-base font-bold text-foreground">
                    Schedule Lineman PME Campaign
                  </DialogTitle>
                  <DialogDescription className="text-xs">
                    Create batch occupational medical examination roster for high-voltage grid personnel.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-4 py-3 text-xs">
              <div>
                <Label className="text-[11px] font-semibold text-foreground/80 mb-1 block">
                  Campaign Name *
                </Label>
                <Input
                  required
                  placeholder="e.g. 2026 Annual Lineman High-Altitude Fitness Screening"
                  value={form.campaign_name}
                  onChange={(e) => setForm({ ...form, campaign_name: e.target.value })}
                  className="h-9"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <Label className="text-[11px] font-semibold text-foreground/80 mb-1 block">
                    Target Year
                  </Label>
                  <Input
                    type="number"
                    value={form.target_year}
                    onChange={(e) => setForm({ ...form, target_year: Number(e.target.value) })}
                    className="h-9 font-mono"
                  />
                </div>
                <div>
                  <Label className="text-[11px] font-semibold text-foreground/80 mb-1 block">
                    Directorate
                  </Label>
                  <select
                    value={form.target_directorate}
                    onChange={(e) => setForm({ ...form, target_directorate: e.target.value })}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs"
                  >
                    <option value="Distribution Directorate">Distribution Directorate</option>
                    <option value="Transmission Grid Directorate">Transmission Grid Directorate</option>
                    <option value="Generation & Hydro Plants">Generation & Hydro Plants</option>
                    <option value="Fleet & Logistics">Fleet & Logistics</option>
                  </select>
                </div>
                <div>
                  <Label className="text-[11px] font-semibold text-foreground/80 mb-1 block">
                    Target Region
                  </Label>
                  <select
                    value={form.target_region}
                    onChange={(e) => setForm({ ...form, target_region: e.target.value })}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs"
                  >
                    <option value="Addis Ababa">Addis Ababa</option>
                    <option value="Oromia">Oromia</option>
                    <option value="Amhara">Amhara</option>
                    <option value="Sidama">Sidama</option>
                    <option value="Tigray">Tigray</option>
                    <option value="Dire Dawa">Dire Dawa</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <Label className="text-[11px] font-semibold text-foreground/80 mb-1 block">
                    Target Linemen Count
                  </Label>
                  <Input
                    type="number"
                    min="1"
                    value={form.target_count}
                    onChange={(e) => setForm({ ...form, target_count: Number(e.target.value) })}
                    className="h-9 font-mono"
                  />
                </div>
                <div>
                  <Label className="text-[11px] font-semibold text-foreground/80 mb-1 block">
                    Campaign Start Date
                  </Label>
                  <Input
                    type="date"
                    value={form.start_date}
                    onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                    className="h-9 font-mono"
                  />
                </div>
                <div>
                  <Label className="text-[11px] font-semibold text-foreground/80 mb-1 block">
                    Target End Date
                  </Label>
                  <Input
                    type="date"
                    value={form.end_date}
                    onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                    className="h-9 font-mono"
                  />
                </div>
              </div>

              <div>
                <Label className="text-[11px] font-semibold text-foreground/80 mb-1 block">
                  Campaign Medical Directives & Testing Scope
                </Label>
                <textarea
                  rows={3}
                  className="w-full rounded-md border border-input bg-background p-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="Required screening tests: Audiometry, ECG, Vision, Acrophobia assessment..."
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setModalOpen(false)}
                disabled={creating}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={creating}
                className="gap-1.5 bg-sky-600 hover:bg-sky-700 text-white font-bold"
              >
                {creating ? "Scheduling..." : "Schedule Campaign"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Quick Record Screening Result Modal */}
      {selectedCampaign && (
        <Dialog open={screeningModalOpen} onOpenChange={setScreeningModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-sky-500/10 text-sky-600">
                  <Icon icon="solar:user-check-bold" size={20} />
                </div>
                <div>
                  <DialogTitle className="text-base font-bold text-foreground">
                    Record Lineman Screening
                  </DialogTitle>
                  <DialogDescription className="text-xs">
                    {selectedCampaign.campaign_name} ({selectedCampaign.campaign_id})
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-4 py-2 text-xs">
              <div>
                <Label className="text-[11px] font-semibold text-foreground/80 mb-1 block">
                  Occupational Fitness Outcome *
                </Label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setIsFitOutcome(true)}
                    className={`p-3 rounded-xl border text-center transition-all ${
                      isFitOutcome
                        ? "border-emerald-500 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-bold"
                        : "border-border hover:bg-muted"
                    }`}
                  >
                    <Icon icon="solar:check-circle-bold" className="mx-auto mb-1 text-emerald-600" size={20} />
                    Certified Fit to Climb
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsFitOutcome(false)}
                    className={`p-3 rounded-xl border text-center transition-all ${
                      !isFitOutcome
                        ? "border-amber-500 bg-amber-500/15 text-amber-700 dark:text-amber-300 font-bold"
                        : "border-border hover:bg-muted"
                    }`}
                  >
                    <Icon icon="solar:shield-warning-bold" className="mx-auto mb-1 text-amber-600" size={20} />
                    Ground Duty / Restricted
                  </button>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setScreeningModalOpen(false)}
                disabled={savingScreening}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleRecordScreening}
                disabled={savingScreening}
                className="gap-1.5 bg-sky-600 hover:bg-sky-700 text-white font-semibold"
              >
                {savingScreening ? "Logging..." : "Confirm Screening"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
