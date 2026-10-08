import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/ui/card";
import { Button } from "@/ui/button";
import { Badge } from "@/ui/badge";
import { Icon } from "@/components/icon";
import eeuLogoImg from "@/assets/images/eeu-logo.png";
import { HealthcareApi } from "@/api/services/healthcareService";
import type { EEUWorkplaceIncident } from "@/api/services/healthcareService";
import { toast } from "sonner";

interface RegionalBreakdownItem {
  region: string;
  incidents: number;
  lti_count: number;
  days_lost: number;
  top_type: string;
}

interface ExecutiveReportData {
  metrics: {
    total_incidents: number;
    lti_count: number;
    total_lost_days: number;
    ltifr: number;
    ppe_compliance_rate: number;
    high_voltage_count: number;
    medium_voltage_count: number;
    low_voltage_count: number;
  };
  lineman_safety_compliance: {
    total_linemen_screened: number;
    fit_certified: number;
    expiring_soon_30d: number;
    expired: number;
    unfit_restricted: number;
    compliance_pct: number;
  };
  regional_breakdown: RegionalBreakdownItem[];
  recent_cases: EEUWorkplaceIncident[];
}

export default function EEUExecutiveSafetyReportPage() {
  const navigate = useNavigate();
  const [period, setPeriod] = useState<string>("365d");
  const [regionFilter, setRegionFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState<ExecutiveReportData | null>(null);

  useEffect(() => {
    loadReport();
  }, [period, regionFilter]);

  const loadReport = async () => {
    setLoading(true);
    try {
      const res = await HealthcareApi.eeuIncidents.executiveSafetyReport({
        period,
        region: regionFilter,
      });
      setReportData(res);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load Executive Safety Report");
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const metrics = reportData?.metrics || {
    total_incidents: 0,
    lti_count: 0,
    total_lost_days: 0,
    ltifr: 0,
    ppe_compliance_rate: 100,
    high_voltage_count: 0,
    medium_voltage_count: 0,
    low_voltage_count: 0,
  };

  const lineman = reportData?.lineman_safety_compliance || {
    total_linemen_screened: 0,
    fit_certified: 0,
    expiring_soon_30d: 0,
    expired: 0,
    unfit_restricted: 0,
    compliance_pct: 0,
  };

  const regional = reportData?.regional_breakdown || [];
  const cases = reportData?.recent_cases || [];

  return (
    <div className="space-y-6 p-2 md:p-4 print:p-0 print:space-y-4">
      {/* ── Screen-only Navigation & Action Toolbar ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/healthcare/occupational/dashboard")}
            className="h-8 gap-1.5 text-xs"
          >
            <Icon icon="solar:arrow-left-bold" size={14} />
            Command Center
          </Button>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              EEU Executive Safety & LTI Report
            </h1>
            <p className="text-xs text-muted-foreground">
              Official Directorate performance review on workplace injuries, lost time, and safety compliance
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Period selector */}
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 py-1 text-xs font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="30d">Last 30 Days (Monthly)</option>
            <option value="90d">Last 90 Days (Quarterly)</option>
            <option value="180d">Past 6 Months (Semi-Annual)</option>
            <option value="365d">Annual Review (Past 365 Days)</option>
          </select>

          {/* Region selector */}
          <select
            value={regionFilter}
            onChange={(e) => setRegionFilter(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 py-1 text-xs font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="all">All EEU Regions</option>
            <option value="Addis Ababa">Addis Ababa</option>
            <option value="Oromia">Oromia</option>
            <option value="Amhara">Amhara</option>
            <option value="Sidama">Sidama</option>
            <option value="Tigray">Tigray</option>
            <option value="Dire Dawa">Dire Dawa</option>
            <option value="Somali">Somali</option>
            <option value="Central Ethiopia">Central Ethiopia</option>
          </select>

          <Button
            onClick={handlePrint}
            className="h-9 gap-1.5 bg-primary text-primary-foreground font-semibold shadow-sm hover:opacity-90"
          >
            <Icon icon="solar:printer-bold" size={16} />
            Print / Export Official PDF
          </Button>
        </div>
      </div>

      {/* ── Official Letterhead Banner (Visible both on screen and in print) ── */}
      <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-r from-emerald-950/80 via-slate-900 to-amber-950/60 p-6 text-white shadow-lg print:border print:border-black print:bg-white print:text-black print:shadow-none print:rounded-none">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-5 border-b border-white/10 pb-5 print:border-black/30">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-white/10 p-2 ring-1 ring-emerald-500/40 print:ring-0 print:bg-transparent">
              <img src={eeuLogoImg} alt="EEU Emblem" className="h-full w-full object-contain" />
            </div>
            <div>
              <div className="text-xs font-bold tracking-widest uppercase text-emerald-400 print:text-gray-700">
                Ethiopian Electric Utility (EEU)
              </div>
              <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight print:text-black">
                Health Services Directorate & Occupational Safety Board
              </h2>
              <p className="text-xs text-slate-300 print:text-gray-600">
                Monthly & Quarterly Lost-Time Injury (LTI) and Operational Electrical Safety Executive Brief
              </p>
            </div>
          </div>

          <div className="text-right text-xs space-y-1">
            <div className="font-mono font-bold text-amber-300 print:text-black">
              CLASSIFICATION: OFFICIAL EEU INTERNAL
            </div>
            <div className="text-slate-300 print:text-gray-600">
              Report Scope: <span className="font-semibold text-white print:text-black">{period.toUpperCase()}</span> • Region:{" "}
              <span className="font-semibold text-white print:text-black">{regionFilter === "all" ? "Nationwide Grid" : regionFilter}</span>
            </div>
            <div className="text-[11px] text-slate-400 print:text-gray-500 font-mono">
              Generated: {new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
            </div>
          </div>
        </div>

        {/* Executive Summary statement */}
        <div className="pt-4 text-xs leading-relaxed text-slate-200 print:text-gray-800">
          <p>
            <strong>Executive Executive Summary:</strong> During this reporting window, the EEU Occupational Health & Medical Safety network tracked{" "}
            <span className="font-bold text-white print:text-black">{metrics.total_incidents} workplace electrical incidents</span>, resulting in{" "}
            <span className="font-bold text-rose-300 print:text-black">{metrics.lti_count} Lost-Time Injuries (LTI)</span> and{" "}
            <span className="font-bold text-amber-300 print:text-black">{metrics.total_lost_days} aggregate lost work-days</span>. The corporate Lost-Time Injury Frequency Rate (LTIFR) stands at{" "}
            <span className="font-bold text-white print:text-black">{metrics.ltifr}</span> per million exposure hours with a field PPE compliance rate of{" "}
            <span className="font-bold text-emerald-300 print:text-black">{metrics.ppe_compliance_rate}%</span>.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : (
        <>
          {/* ── 1. Top Executive KPI Cards Grid ── */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {/* Total Incidents */}
            <Card className="border-border/60 bg-card shadow-2xs print:border print:border-gray-300">
              <CardContent className="p-4 space-y-1">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="text-[11px] font-semibold">Total Incidents</span>
                  <Icon icon="solar:danger-triangle-bold" className="text-amber-500" size={16} />
                </div>
                <div className="text-2xl font-extrabold text-foreground font-mono">
                  {metrics.total_incidents}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {metrics.high_voltage_count} High-Voltage cases
                </div>
              </CardContent>
            </Card>

            {/* LTI Count */}
            <Card className="border-border/60 bg-card shadow-2xs print:border print:border-gray-300">
              <CardContent className="p-4 space-y-1">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="text-[11px] font-semibold">Lost-Time Injuries</span>
                  <Icon icon="solar:shield-cross-bold" className="text-rose-500" size={16} />
                </div>
                <div className="text-2xl font-extrabold text-rose-600 dark:text-rose-400 font-mono">
                  {metrics.lti_count}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  Required medical leave / duty shift
                </div>
              </CardContent>
            </Card>

            {/* Total Lost Days */}
            <Card className="border-border/60 bg-card shadow-2xs print:border print:border-gray-300">
              <CardContent className="p-4 space-y-1">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="text-[11px] font-semibold">Work-Days Lost</span>
                  <Icon icon="solar:calendar-date-bold" className="text-primary" size={16} />
                </div>
                <div className="text-2xl font-extrabold text-amber-600 dark:text-amber-400 font-mono">
                  {metrics.total_lost_days}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  Certified sick leave days
                </div>
              </CardContent>
            </Card>

            {/* LTIFR */}
            <Card className="border-border/60 bg-card shadow-2xs print:border print:border-gray-300">
              <CardContent className="p-4 space-y-1">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="text-[11px] font-semibold">LTIFR Metric</span>
                  <Icon icon="solar:chart-2-bold" className="text-cyan-500" size={16} />
                </div>
                <div className="text-2xl font-extrabold text-cyan-600 dark:text-cyan-400 font-mono">
                  {metrics.ltifr}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  Per 1,000,000 man-hours
                </div>
              </CardContent>
            </Card>

            {/* PPE Compliance */}
            <Card className="border-border/60 bg-card shadow-2xs print:border print:border-gray-300">
              <CardContent className="p-4 space-y-1">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="text-[11px] font-semibold">PPE Compliance</span>
                  <Icon icon="solar:shield-check-bold" className="text-emerald-500" size={16} />
                </div>
                <div className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
                  {metrics.ppe_compliance_rate}%
                </div>
                <div className="text-[10px] text-muted-foreground">
                  Field gear adherence rate
                </div>
              </CardContent>
            </Card>

            {/* Voltage Breakdown */}
            <Card className="border-border/60 bg-card shadow-2xs print:border print:border-gray-300">
              <CardContent className="p-4 space-y-1">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="text-[11px] font-semibold">Grid Voltage Tiers</span>
                  <Icon icon="solar:bolt-bold" className="text-amber-500" size={16} />
                </div>
                <div className="text-sm font-bold text-foreground font-mono">
                  HV: {metrics.high_voltage_count} • MV: {metrics.medium_voltage_count}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  LV / Distribution: {metrics.low_voltage_count}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ── 2. Lineman Height Safety & Climbing Clearance Radar ── */}
          <Card className="border-border/60 shadow-2xs print:border print:border-gray-300">
            <CardHeader className="pb-3 border-b bg-muted/15 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600">
                  <Icon icon="solar:medal-ribbons-star-bold" size={20} />
                </div>
                <div>
                  <CardTitle className="text-sm font-bold">
                    Lineman High-Altitude Climbing Safety & Medical Clearance Radar
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Annual audiometry, Ishihara color vision, and cardiovascular altitude screening
                  </CardDescription>
                </div>
              </div>
              <Badge variant="outline" className="border-emerald-500/30 text-emerald-600 font-mono text-xs">
                {lineman.compliance_pct}% Height Certified
              </Badge>
            </CardHeader>
            <CardContent className="p-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                <div className="rounded-xl border bg-muted/20 p-3">
                  <div className="text-[11px] text-muted-foreground">Total Linemen Screened</div>
                  <div className="mt-1 font-mono text-xl font-bold text-foreground">
                    {lineman.total_linemen_screened}
                  </div>
                  <div className="text-[10px] text-muted-foreground">Certified workforce registry</div>
                </div>

                <div className="rounded-xl border bg-muted/20 p-3">
                  <div className="text-[11px] text-muted-foreground">Fit to Climb (Active)</div>
                  <div className="mt-1 font-mono text-xl font-bold text-emerald-600 dark:text-emerald-400">
                    {lineman.fit_certified}
                  </div>
                  <div className="text-[10px] text-emerald-600 dark:text-emerald-400">Clear for pylon ascents</div>
                </div>

                <div className="rounded-xl border bg-muted/20 p-3">
                  <div className="text-[11px] text-muted-foreground">Expiring in &lt; 30 Days</div>
                  <div className="mt-1 font-mono text-xl font-bold text-amber-600 dark:text-amber-400">
                    {lineman.expiring_soon_30d}
                  </div>
                  <div className="text-[10px] text-amber-600 dark:text-amber-400">Scheduled for recertification</div>
                </div>

                <div className="rounded-xl border bg-muted/20 p-3">
                  <div className="text-[11px] text-muted-foreground">Expired Past Due</div>
                  <div className="mt-1 font-mono text-xl font-bold text-rose-600 dark:text-rose-400">
                    {lineman.expired}
                  </div>
                  <div className="text-[10px] text-rose-600 dark:text-rose-400">Climbing strictly prohibited</div>
                </div>

                <div className="rounded-xl border bg-muted/20 p-3">
                  <div className="text-[11px] text-muted-foreground">Ground Duty Only</div>
                  <div className="mt-1 font-mono text-xl font-bold text-foreground">
                    {lineman.unfit_restricted}
                  </div>
                  <div className="text-[10px] text-muted-foreground">Medical reassignment</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ── 3. Regional Breakdown Table ── */}
          <Card className="border-border/60 shadow-2xs print:border print:border-gray-300">
            <CardHeader className="pb-3 border-b bg-muted/15 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold">Regional Distribution Grid Safety Breakdown</CardTitle>
                <CardDescription className="text-xs">
                  Incident density, LTI frequency, and top hazard classification by EEU operating region
                </CardDescription>
              </div>
              <Badge variant="outline" className="font-mono text-xs">
                {regional.length} Reporting Regions
              </Badge>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-border/50 bg-muted/30 text-muted-foreground">
                      <th className="py-2.5 px-3">EEU Region</th>
                      <th className="py-2.5 px-3 text-center">Incidents</th>
                      <th className="py-2.5 px-3 text-center">LTI Count</th>
                      <th className="py-2.5 px-3 text-center">Lost Work Days</th>
                      <th className="py-2.5 px-3">Primary Hazard Type</th>
                      <th className="py-2.5 px-3 text-right">Risk Tier</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {regional.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-muted-foreground">
                          No regional incident records logged for this period.
                        </td>
                      </tr>
                    ) : (
                      regional.map((r) => {
                        const isHighRisk = r.lti_count >= 2 || r.days_lost >= 14;
                        return (
                          <tr key={r.region} className="hover:bg-muted/20">
                            <td className="py-2.5 px-3 font-semibold text-foreground">{r.region}</td>
                            <td className="py-2.5 px-3 text-center font-mono font-bold">{r.incidents}</td>
                            <td className="py-2.5 px-3 text-center font-mono font-bold text-rose-600 dark:text-rose-400">
                              {r.lti_count}
                            </td>
                            <td className="py-2.5 px-3 text-center font-mono font-bold text-amber-600 dark:text-amber-400">
                              {r.days_lost}
                            </td>
                            <td className="py-2.5 px-3 text-muted-foreground">{r.top_type}</td>
                            <td className="py-2.5 px-3 text-right">
                              <Badge
                                className={
                                  isHighRisk
                                    ? "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                                    : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                                }
                              >
                                {isHighRisk ? "Tier 1 High Priority" : "Standard Operations"}
                              </Badge>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* ── 4. Critical Incident Case Log ── */}
          <Card className="border-border/60 shadow-2xs print:border print:border-gray-300">
            <CardHeader className="pb-3 border-b bg-muted/15 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold">Recent Workplace & Electrical Incident Logs</CardTitle>
                <CardDescription className="text-xs">
                  Clinical encounter linkage, sick leave slips, and occupational medical outcomes
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/healthcare/occupational/incidents")}
                className="h-7 text-xs text-primary print:hidden"
              >
                View All Incidents
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-border/50 bg-muted/30 text-muted-foreground">
                      <th className="py-2.5 px-3">Case ID</th>
                      <th className="py-2.5 px-3">Employee & Staff ID</th>
                      <th className="py-2.5 px-3">Workstation & Region</th>
                      <th className="py-2.5 px-3">Voltage / Hazard</th>
                      <th className="py-2.5 px-3">Clinical Encounter</th>
                      <th className="py-2.5 px-3">Certified Sick Leave</th>
                      <th className="py-2.5 px-3">Duty Restriction</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {cases.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-6 text-center text-muted-foreground">
                          No recent incidents found.
                        </td>
                      </tr>
                    ) : (
                      cases.map((c) => (
                        <tr key={c.id} className="hover:bg-muted/20">
                          <td className="py-2.5 px-3 font-mono font-bold text-primary">
                            {c.incident_id}
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="font-medium text-foreground">{c.patient_name}</div>
                            <div className="text-[10px] font-mono text-muted-foreground">
                              {c.staff_id || c.patient_code || "Staff"}
                            </div>
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="text-foreground">{c.work_location}</div>
                            <div className="text-[10px] text-muted-foreground">{c.region}</div>
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="font-semibold text-foreground">{c.incident_type}</div>
                            <div className="text-[10px] text-amber-600 dark:text-amber-400 font-mono">
                              {c.voltage_level}
                            </div>
                          </td>
                          <td className="py-2.5 px-3">
                            {c.clinical_encounter ? (
                              <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                                <Icon icon="solar:check-circle-bold" size={12} className="mr-1" />
                                {c.clinical_encounter_display || "Encounter Linked"}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-muted-foreground">
                                Pending Encounter
                              </Badge>
                            )}
                          </td>
                          <td className="py-2.5 px-3">
                            {c.sick_leave_slip ? (
                              <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 font-mono">
                                <Icon icon="solar:document-medicine-bold" size={12} className="mr-1" />
                                {c.sick_leave_slip_code || "Leave Issued"} ({c.sick_leave_total_days || c.lost_work_days || 0}d)
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">No leave issued</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3">
                            <Badge
                              variant="outline"
                              className={
                                c.duty_recommendation?.includes("Normal")
                                  ? "border-emerald-500/40 text-emerald-600"
                                  : "border-amber-500/40 text-amber-600"
                              }
                            >
                              {c.duty_recommendation || "Pending Medical Assessment"}
                            </Badge>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* ── 5. Executive Endorsement & Sign-Off Section ── */}
          <div className="rounded-2xl border border-border/80 bg-card p-6 shadow-2xs print:border print:border-black print:rounded-none">
            <h3 className="text-sm font-bold text-foreground uppercase tracking-wider mb-3">
              Official Directorate Endorsement & Recommendations
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs text-muted-foreground pt-2">
              <div className="space-y-1">
                <span className="font-semibold text-foreground">Occupational Health Action Plan:</span>
                <p className="leading-relaxed">
                  1. Mandate high-voltage arc-flash face shield inspection across all 15kV / 33kV distribution substations.
                  <br />
                  2. Prioritize immediate recertification for the {lineman.expiring_soon_30d} linemen with expiring clearance.
                </p>
              </div>

              <div className="space-y-1">
                <span className="font-semibold text-foreground">Central Pharmacy Replenishment:</span>
                <p className="leading-relaxed">
                  Automatic burn pack and trauma dressing dispatch authorized for all sub-stations with pending restock requests.
                </p>
              </div>

              <div className="border-t sm:border-t-0 sm:border-l border-border/60 sm:pl-6 space-y-3">
                <div>
                  <div className="font-bold text-foreground">Dr. Hailu Berhe, MD</div>
                  <div className="text-[11px] text-muted-foreground">Director, EEU Health Services & Medical Safety</div>
                  <div className="mt-4 border-b border-foreground/40 w-48" />
                  <div className="text-[10px] text-muted-foreground pt-1">Signature & Official Directorate Stamp</div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
