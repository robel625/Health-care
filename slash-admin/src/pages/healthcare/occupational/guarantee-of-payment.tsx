import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/ui/card";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { Badge } from "@/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/ui/dialog";
import { Icon } from "@/components/icon";
import { HealthcareApi } from "@/api/services/healthcareService";
import type { ExternalReferral, Patient } from "@/api/services/healthcareService";
import { useClinicStore } from "@/store/clinicStore";
import { toast } from "sonner";

export default function EEUGuaranteeOfPaymentPage() {
  const navigate = useNavigate();
  const activeClinic = useClinicStore((s) => s.activeClinic);
  const setActiveClinicId = useClinicStore((s) => s.setActiveClinicId);

  const [referrals, setReferrals] = useState<ExternalReferral[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [hospitalFilter, setHospitalFilter] = useState("all");
  const [gopOnlyFilter, setGopOnlyFilter] = useState(true);

  // Issue / Edit GOP Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingRef, setEditingRef] = useState<ExternalReferral | null>(null);

  const [form, setForm] = useState({
    patient: "",
    target_facility: "Tikur Anbessa Specialized Hospital (TASH) - Burn & Plastic Surgery Unit",
    eeu_specialist_hospital_tier: "Tier-1 Specialized National Referral & Burn Center",
    clinical_indication: "Severe high-voltage arc flash thermal burns requiring specialized surgical debridement and tertiary ICU admission.",
    is_eeu_guarantee_of_payment: true,
    eeu_gop_authorized_amount_etb: 75000,
    eeu_gop_coverage_scope: "Comprehensive Inpatient, ICU Resuscitation, Surgical Debridement, and Specialist Consultations",
    treatment_summary: "Patient sustained 2nd and 3rd degree electrical burns during high-voltage maintenance. Stabilized with IV fluid resuscitation at EEU clinic.",
  });

  // GOP Letter Print Preview Modal
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewRef, setPreviewRef] = useState<ExternalReferral | null>(null);
  const [loadingHtml, setLoadingHtml] = useState(false);
  const printIframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [refRes, patRes] = await Promise.all([
        HealthcareApi.externalReferrals.list({ page_size: 100 }),
        HealthcareApi.patients.list({ page_size: 100 }),
      ]);
      setReferrals(refRes.results || []);
      setPatients(patRes.results || []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load referral guarantees");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreateModal = () => {
    setEditingRef(null);
    setForm({
      patient: patients[0]?.id ? String(patients[0].id) : "",
      target_facility: "Tikur Anbessa Specialized Hospital (TASH) - Burn & Plastic Surgery Unit",
      eeu_specialist_hospital_tier: "Tier-1 Specialized National Referral & Burn Center",
      clinical_indication: "Severe high-voltage arc flash thermal burns requiring specialized surgical debridement and tertiary ICU admission.",
      is_eeu_guarantee_of_payment: true,
      eeu_gop_authorized_amount_etb: 75000,
      eeu_gop_coverage_scope: "Comprehensive Inpatient, ICU Resuscitation, Surgical Debridement, and Specialist Consultations",
      treatment_summary: "Patient sustained 2nd and 3rd degree electrical burns during high-voltage maintenance. Stabilized with IV fluid resuscitation at EEU clinic.",
    });
    setModalOpen(true);
  };

  const handleOpenEditModal = (r: ExternalReferral) => {
    setEditingRef(r);
    setForm({
      patient: String(r.patient),
      target_facility: r.target_facility || "",
      eeu_specialist_hospital_tier: r.eeu_specialist_hospital_tier || "Tier-1 Specialized National Referral & Burn Center",
      clinical_indication: r.clinical_indication || "",
      is_eeu_guarantee_of_payment: true,
      eeu_gop_authorized_amount_etb: r.eeu_gop_authorized_amount_etb || 50000,
      eeu_gop_coverage_scope: r.eeu_gop_coverage_scope || "Comprehensive Inpatient & Surgical Care",
      treatment_summary: r.treatment_summary || "",
    });
    setModalOpen(true);
  };

  const handleSaveReferral = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.patient) {
      toast.error("Please select a patient / staff member");
      return;
    }

    setSaving(true);
    try {
      if (editingRef) {
        await HealthcareApi.externalReferrals.patch(editingRef.id, {
          target_facility: form.target_facility,
          eeu_specialist_hospital_tier: form.eeu_specialist_hospital_tier,
          clinical_indication: form.clinical_indication,
          is_eeu_guarantee_of_payment: true,
          eeu_gop_authorized_amount_etb: Number(form.eeu_gop_authorized_amount_etb),
          eeu_gop_coverage_scope: form.eeu_gop_coverage_scope,
          treatment_summary: form.treatment_summary,
        });
        toast.success("Updated Guarantee of Payment authorization");
      } else {
        await HealthcareApi.externalReferrals.create({
          patient: Number(form.patient),
          target_facility: form.target_facility,
          eeu_specialist_hospital_tier: form.eeu_specialist_hospital_tier,
          clinical_indication: form.clinical_indication,
          priority: "Urgent",
          referral_date: new Date().toISOString().split("T")[0],
          is_eeu_guarantee_of_payment: true,
          eeu_gop_authorized_amount_etb: Number(form.eeu_gop_authorized_amount_etb),
          eeu_gop_coverage_scope: form.eeu_gop_coverage_scope,
          treatment_summary: form.treatment_summary,
          status: "Active",
        });
        toast.success("Issued new EEU Guarantee of Payment Letter");
      }
      setModalOpen(false);
      await loadData();
    } catch (err) {
      console.error(err);
      toast.error("Failed to save referral guarantee");
    } finally {
      setSaving(false);
    }
  };

  const handleViewGopLetter = async (r: ExternalReferral) => {
    setPreviewRef(r);
    setLoadingHtml(true);
    setPreviewOpen(true);
    try {
      const res = await HealthcareApi.externalReferrals.getGopHtml(r.id);
      setPreviewHtml(res.html);
    } catch (err) {
      console.error(err);
      toast.error("Failed to render official GOP document");
      setPreviewHtml("<p class='p-4 text-rose-600'>Failed to load GOP document template.</p>");
    } finally {
      setLoadingHtml(false);
    }
  };

  const handlePrintGop = () => {
    if (printIframeRef.current && printIframeRef.current.contentWindow) {
      printIframeRef.current.contentWindow.focus();
      printIframeRef.current.contentWindow.print();
    } else {
      window.print();
    }
  };

  // KPIs
  const gopReferrals = referrals.filter((r) => r.is_eeu_guarantee_of_payment);
  const totalCommittedETB = gopReferrals.reduce(
    (acc, curr) => acc + (Number(curr.eeu_gop_authorized_amount_etb) || 0),
    0
  );

  const filteredReferrals = referrals.filter((r) => {
    if (gopOnlyFilter && !r.is_eeu_guarantee_of_payment) return false;

    const matchesSearch =
      (r.patient_name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.target_facility || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.eeu_gop_authorization_code || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.referral_id || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.clinical_indication || "").toLowerCase().includes(searchQuery.toLowerCase());

    const matchesHospital =
      hospitalFilter === "all" ||
      (r.target_facility || "").toLowerCase().includes(hospitalFilter.toLowerCase());

    return matchesSearch && matchesHospital;
  });

  return (
    <div className="space-y-6 p-2 md:p-4">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge className="bg-emerald-600 text-white font-bold text-[10px]">
              EEU Health Services Directorate
            </Badge>
            <span className="text-xs text-muted-foreground font-mono">
              Direct Corporate Billing
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            Referral Hospital Guarantee of Payment (GOP) Generator
          </h1>
          <p className="text-sm text-muted-foreground">
            Issue and print legally verified corporate guarantee letters authorizing tertiary care, burn unit surgery, and ICU admission for EEU technicians.
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
            onClick={handleOpenCreateModal}
            className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-lg shadow-emerald-600/25 h-9"
          >
            <Icon icon="solar:diploma-verified-bold" size={18} />
            Issue Guarantee of Payment (GOP)
          </Button>
        </div>
      </div>

      {/* Active Clinic Context Banner */}
      {activeClinic.id !== "all" && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-950 dark:text-emerald-200">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
              <Icon icon="solar:hospital-bold-duotone" size={20} />
            </div>
            <div>
              <span className="font-bold text-foreground">Referring Health Facility: </span>
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
            Show All Referring Facilities
          </Button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-emerald-500/30 bg-emerald-500/5">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">Corporate GOPs Issued</p>
              <h3 className="text-2xl font-bold font-mono text-emerald-700 dark:text-emerald-400 mt-1">
                {gopReferrals.length}
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">Authorizations granted</p>
            </div>
            <div className="p-2.5 rounded-2xl bg-emerald-500/15 text-emerald-600">
              <Icon icon="solar:diploma-verified-bold-duotone" size={26} />
            </div>
          </CardContent>
        </Card>

        <Card className="border-blue-500/30 bg-blue-500/5">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-blue-700 dark:text-blue-400">Total Authorized Amount</p>
              <h3 className="text-xl font-bold font-mono text-blue-700 dark:text-blue-400 mt-1">
                ETB {totalCommittedETB.toLocaleString()}
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">Underwritten by EEU</p>
            </div>
            <div className="p-2.5 rounded-2xl bg-blue-500/15 text-blue-600">
              <Icon icon="solar:wallet-money-bold-duotone" size={26} />
            </div>
          </CardContent>
        </Card>

        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">Burn & Trauma Centers</p>
              <h3 className="text-2xl font-bold font-mono text-amber-700 dark:text-amber-400 mt-1">
                {new Set(gopReferrals.map((r) => r.target_facility)).size}
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">Partner tertiary hospitals</p>
            </div>
            <div className="p-2.5 rounded-2xl bg-amber-500/15 text-amber-600">
              <Icon icon="solar:buildings-bold-duotone" size={26} />
            </div>
          </CardContent>
        </Card>

        <Card className="border-purple-500/30 bg-purple-500/5">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-purple-700 dark:text-purple-400">Direct Invoice Billing</p>
              <h3 className="text-2xl font-bold font-mono text-purple-700 dark:text-purple-400 mt-1">
                100%
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">Zero out-of-pocket for staff</p>
            </div>
            <div className="p-2.5 rounded-2xl bg-purple-500/15 text-purple-600">
              <Icon icon="solar:shield-check-bold" size={26} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Bar */}
      <Card className="border-border/60">
        <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Icon icon="solar:magnifer-linear" className="absolute left-3 top-3 text-muted-foreground" size={16} />
            <Input
              placeholder="Search by GOP code (e.g. EEU-GOP-2026-0041), lineman name, hospital..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 text-xs"
            />
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <label className="flex items-center gap-1.5 text-xs text-foreground cursor-pointer px-2 py-1 rounded bg-muted/50 border">
              <input
                type="checkbox"
                checked={gopOnlyFilter}
                onChange={(e) => setGopOnlyFilter(e.target.checked)}
                className="rounded border-input text-emerald-600 focus:ring-emerald-500"
              />
              <span>EEU GOP Guaranteed Only</span>
            </label>

            <select
              value={hospitalFilter}
              onChange={(e) => setHospitalFilter(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 py-1 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="all">All Referral Hospitals</option>
              <option value="Tikur Anbessa">Tikur Anbessa Hospital</option>
              <option value="ALERT">ALERT Specialized Hospital</option>
              <option value="Nordic">Nordic Medical Centre</option>
              <option value="St. Paul">St. Paul's Hospital</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Referrals & GOP Table */}
      <Card className="border-border/60 overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              <Icon icon="solar:refresh-bold" className="animate-spin inline-block mr-2" size={18} />
              Loading referrals and Guarantee of Payment registry...
            </div>
          ) : filteredReferrals.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No referral guarantees match the selected filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/40 border-b border-border/60 text-muted-foreground uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3 px-4 font-semibold">GOP Auth Code / Ref</th>
                    <th className="py-3 px-4 font-semibold">Technician / Patient</th>
                    <th className="py-3 px-4 font-semibold">Partner Referral Hospital</th>
                    <th className="py-3 px-4 font-semibold">Corporate Guarantee (ETB)</th>
                    <th className="py-3 px-4 font-semibold">Scope of Coverage</th>
                    <th className="py-3 px-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {filteredReferrals.map((r) => {
                    const hasGop = r.is_eeu_guarantee_of_payment;
                    const authCode = r.eeu_gop_authorization_code || `EEU-GOP-${r.id}`;

                    return (
                      <tr key={r.id} className="hover:bg-muted/20 transition-colors">
                        <td className="py-3 px-4">
                          <div className="space-y-0.5">
                            {hasGop ? (
                              <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 block w-fit">
                                {authCode}
                              </span>
                            ) : (
                              <span className="font-mono text-muted-foreground">
                                {r.referral_id || `REF-${r.id}`}
                              </span>
                            )}
                            <span className="text-[10px] text-muted-foreground block font-mono">
                              {r.referral_date || "Today"}
                            </span>
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <div className="space-y-0.5">
                            <span className="font-semibold text-foreground block">
                              {r.patient_name || `Patient #${r.patient}`}
                            </span>
                            <span className="text-[11px] text-muted-foreground">
                              Ref by: {r.referring_practitioner_name || "EEU Occupational Physician"}
                            </span>
                          </div>
                        </td>

                        <td className="py-3 px-4 max-w-[220px]">
                          <div className="space-y-0.5">
                            <span className="font-semibold text-foreground line-clamp-1">
                              {r.target_facility}
                            </span>
                            <span className="text-[10px] text-muted-foreground block font-mono">
                              {r.eeu_specialist_hospital_tier || "Tertiary Specialist"}
                            </span>
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          {hasGop ? (
                            <div className="space-y-0.5">
                              <span className="font-mono font-bold text-sm text-foreground">
                                ETB {(Number(r.eeu_gop_authorized_amount_etb) || 0).toLocaleString()}
                              </span>
                              <Badge className="bg-emerald-600/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-[9px] uppercase tracking-wider block w-fit">
                                Corporate Guarantee
                              </Badge>
                            </div>
                          ) : (
                            <span className="text-muted-foreground italic">Standard Referral</span>
                          )}
                        </td>

                        <td className="py-3 px-4 max-w-[240px]">
                          <p className="text-[11px] text-muted-foreground line-clamp-2">
                            {r.eeu_gop_coverage_scope || r.clinical_indication || "Inpatient / Specialist care"}
                          </p>
                        </td>

                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {hasGop && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleViewGopLetter(r)}
                                className="h-8 px-2.5 text-xs text-emerald-700 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10 gap-1.5 font-semibold"
                                title="Print Official EEU Guarantee of Payment Letter"
                              >
                                <Icon icon="solar:printer-bold" size={14} />
                                Print GOP Letter
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleOpenEditModal(r)}
                              className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
                              title="Edit Guarantee of Payment terms"
                            >
                              <Icon icon="solar:pen-bold" size={14} />
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

      {/* Issue / Edit GOP Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-xl">
          <form onSubmit={handleSaveReferral}>
            <DialogHeader>
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600">
                  <Icon icon="solar:diploma-verified-bold-duotone" size={22} />
                </div>
                <div>
                  <DialogTitle className="text-base font-bold text-foreground">
                    {editingRef ? "Amend Guarantee of Payment" : "Issue Corporate Guarantee of Payment (GOP)"}
                  </DialogTitle>
                  <DialogDescription className="text-xs">
                    Legal financial guarantee underwritten by Ethiopian Electric Utility for specialized tertiary care.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-4 py-3 text-xs">
              <div>
                <Label className="text-[11px] font-semibold text-foreground/80 mb-1 block">
                  Select EEU Staff / Technician *
                </Label>
                <select
                  required
                  value={form.patient}
                  onChange={(e) => setForm({ ...form, patient: e.target.value })}
                  disabled={!!editingRef}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs"
                >
                  <option value="">Select Technician / Dependent...</option>
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.patient_name} — {p.eeu_staff_id || `PAT-${p.id}`} ({p.eeu_cadre || "Staff"})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-[11px] font-semibold text-foreground/80 mb-1 block">
                    Receiving Referral Hospital *
                  </Label>
                  <select
                    value={form.target_facility}
                    onChange={(e) => setForm({ ...form, target_facility: e.target.value })}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs"
                  >
                    <option value="Tikur Anbessa Specialized Hospital (TASH) - Burn & Plastic Surgery Unit">
                      Tikur Anbessa Hospital (Burn & Trauma)
                    </option>
                    <option value="ALERT Specialized Hospital - Reconstructive Surgery Center">
                      ALERT Specialized Hospital
                    </option>
                    <option value="Nordic Medical Centre (Addis Ababa)">
                      Nordic Medical Centre
                    </option>
                    <option value="St. Paul's Hospital Millennium Medical College">
                      St. Paul's Hospital MMC
                    </option>
                    <option value="Silk Road General Hospital">
                      Silk Road General Hospital
                    </option>
                  </select>
                </div>

                <div>
                  <Label className="text-[11px] font-semibold text-foreground/80 mb-1 block">
                    Partner Facility Tier
                  </Label>
                  <select
                    value={form.eeu_specialist_hospital_tier}
                    onChange={(e) => setForm({ ...form, eeu_specialist_hospital_tier: e.target.value })}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs"
                  >
                    <option value="Tier-1 Specialized National Referral & Burn Center">Tier-1 Specialized National Burn Center</option>
                    <option value="Tier-2 Regional Referral Teaching Hospital">Tier-2 Regional Referral Hospital</option>
                    <option value="Private Executive Partner Hospital">Private Executive Partner</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-[11px] font-semibold text-foreground/80 mb-1 block">
                    Authorized Guarantee Ceiling (ETB) *
                  </Label>
                  <Input
                    type="number"
                    min="1000"
                    step="500"
                    required
                    value={form.eeu_gop_authorized_amount_etb}
                    onChange={(e) => setForm({ ...form, eeu_gop_authorized_amount_etb: Number(e.target.value) })}
                    className="h-9 font-mono"
                  />
                  <div className="flex gap-1.5 mt-1.5">
                    {[25000, 50000, 75000, 150000].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setForm({ ...form, eeu_gop_authorized_amount_etb: amt })}
                        className="px-2 py-0.5 rounded text-[10px] font-mono border bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground"
                      >
                        {amt.toLocaleString()} ETB
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <Label className="text-[11px] font-semibold text-foreground/80 mb-1 block">
                    Scope of Authorized Coverage
                  </Label>
                  <Input
                    value={form.eeu_gop_coverage_scope}
                    onChange={(e) => setForm({ ...form, eeu_gop_coverage_scope: e.target.value })}
                    className="h-9"
                    placeholder="e.g. ICU, Surgical debridement, dressings..."
                  />
                </div>
              </div>

              <div>
                <Label className="text-[11px] font-semibold text-foreground/80 mb-1 block">
                  Clinical Indication & Diagnosis
                </Label>
                <textarea
                  rows={2}
                  required
                  value={form.clinical_indication}
                  onChange={(e) => setForm({ ...form, clinical_indication: e.target.value })}
                  className="w-full rounded-md border border-input bg-background p-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="e.g. Electrical arc flash burn with 25% TBSA, suspicion of compartment syndrome..."
                />
              </div>

              <div>
                <Label className="text-[11px] font-semibold text-foreground/80 mb-1 block">
                  Treatment Summary & Immediate Measures Taken
                </Label>
                <textarea
                  rows={2}
                  value={form.treatment_summary}
                  onChange={(e) => setForm({ ...form, treatment_summary: e.target.value })}
                  className="w-full rounded-md border border-input bg-background p-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="Fluids given, analgesia, tetanus prophylaxis..."
                />
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
                className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
              >
                {saving ? (
                  <>
                    <Icon icon="solar:refresh-bold" className="animate-spin" size={14} />
                    Authorizing...
                  </>
                ) : (
                  <>
                    <Icon icon="solar:check-read-bold" size={14} />
                    Issue Guarantee of Payment
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Official A4 GOP Letter Preview Modal */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden max-h-[92vh] flex flex-col">
          <DialogHeader className="p-4 bg-muted/20 border-b flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600">
                <Icon icon="solar:diploma-verified-bold-duotone" size={20} />
              </div>
              <div>
                <DialogTitle className="text-sm font-bold text-foreground">
                  Official EEU Guarantee of Payment (GOP) Letter
                </DialogTitle>
                <DialogDescription className="text-xs">
                  {previewRef?.eeu_gop_authorization_code || "Authorized Document"} • {previewRef?.patient_name}
                </DialogDescription>
              </div>
            </div>

            <div className="flex items-center gap-2 mr-6">
              <Button
                size="sm"
                onClick={handlePrintGop}
                className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-8"
              >
                <Icon icon="solar:printer-bold" size={15} />
                Print Official A4 Letter
              </Button>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-auto bg-slate-100 dark:bg-slate-900 p-4">
            {loadingHtml ? (
              <div className="p-16 text-center text-sm text-muted-foreground">
                <Icon icon="solar:refresh-bold" className="animate-spin inline-block mr-2" size={20} />
                Generating official EEU seal & corporate guarantee document...
              </div>
            ) : (
              <div className="mx-auto bg-white text-black shadow-2xl rounded-sm max-w-[210mm] min-h-[297mm] p-2">
                <iframe
                  ref={printIframeRef}
                  title="Official GOP Letter"
                  srcDoc={previewHtml}
                  className="w-full h-[75vh] border-0"
                />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
