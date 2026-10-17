import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/ui/card";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { Badge } from "@/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/ui/dialog";
import { Icon } from "@/components/icon";
import eeuLogoImg from "@/assets/images/eeu-logo.png";
import { HealthcareApi } from "@/api/services/healthcareService";
import type { MedicalLeaveSlip, Patient, HealthcarePractitioner } from "@/api/services/healthcareService";
import { toast } from "sonner";

export default function EEUSickLeaveCertificatesPage() {
  const [certificates, setCertificates] = useState<MedicalLeaveSlip[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [practitioners, setPractitioners] = useState<HealthcarePractitioner[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [branchFilter, setBranchFilter] = useState("all");

  const [modalOpen, setModalOpen] = useState(false);
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [selectedCert, setSelectedCert] = useState<MedicalLeaveSlip | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    patient: "",
    practitioner: "",
    issue_date: new Date().toISOString().split("T")[0],
    from_date: new Date().toISOString().split("T")[0],
    to_date: new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0],
    total_days: 7,
    diagnosis: "",
    doctor_remarks: "",
    fitness_state: "Fit for Light Duty Only",
    fit_to_work_date: new Date(Date.now() + 8 * 86400000).toISOString().split("T")[0],
    eeu_clinic_branch: "Ethiopian Electric Utility Medium Clinic",
    eeu_leave_category: "Work-Related Electrical/Mechanical Injury",
    eeu_duty_restriction: "Restricted to Light Ground Duty (No Climbing / No Field Patrol)",
    status: "Issued",
  });

  useEffect(() => {
    loadCertificates();
    loadPatients();
    loadPractitioners();
  }, []);

  const loadCertificates = async () => {
    setLoading(true);
    try {
      const res = await HealthcareApi.medicalLeaveSlips.list();
      setCertificates(res.results || []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load medical leave certificates");
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

  const handleFromDateChange = (from: string) => {
    setForm((prev) => {
      const start = new Date(from).getTime();
      const end = new Date(prev.to_date).getTime();
      const days = Math.max(1, Math.round((end - start) / (1000 * 3600 * 24)) + 1);
      return { ...prev, from_date: from, total_days: isNaN(days) ? 1 : days };
    });
  };

  const handleToDateChange = (to: string) => {
    setForm((prev) => {
      const start = new Date(prev.from_date).getTime();
      const end = new Date(to).getTime();
      const days = Math.max(1, Math.round((end - start) / (1000 * 3600 * 24)) + 1);
      return { ...prev, to_date: to, total_days: isNaN(days) ? 1 : days };
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.patient) {
      toast.error("Please select a patient");
      return;
    }
    if (!form.diagnosis.trim()) {
      toast.error("Please enter a clinical diagnosis");
      return;
    }

    setSaving(true);
    try {
      const created = await HealthcareApi.medicalLeaveSlips.create({
        ...form,
        patient: Number(form.patient),
        practitioner: form.practitioner ? Number(form.practitioner) : null,
      } as any);
      toast.success("EEU Medical Leave Certificate issued");
      setModalOpen(false);
      loadCertificates();
      if (created) {
        setSelectedCert(created);
        setPrintModalOpen(true);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to issue medical leave certificate");
    } finally {
      setSaving(false);
    }
  };

  const openPrintModal = (cert: MedicalLeaveSlip) => {
    setSelectedCert(cert);
    setPrintModalOpen(true);
  };

  const filteredCertificates = certificates.filter((cert) => {
    const matchesSearch =
      (cert.slip_id || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (cert.patient_name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (cert.diagnosis || "").toLowerCase().includes(searchQuery.toLowerCase());

    const matchesBranch =
      branchFilter === "all" || (cert as any).eeu_clinic_branch === branchFilter;

    return matchesSearch && matchesBranch;
  });

  return (
    <div className="space-y-6 p-2 md:p-4">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            EEU Medical Leave & Sick Leave Certificates
          </h1>
          <p className="text-sm text-muted-foreground">
            Official rest certificates, duty fitness exemptions, and Ethiopian labor law medical board compliance
          </p>
        </div>
        <Button
          onClick={() => setModalOpen(true)}
          className="gap-2 bg-amber-600 font-semibold text-white shadow-md hover:bg-amber-500"
        >
          <Icon icon="solar:document-add-bold" size={18} />
          Issue Official Sick Leave
        </Button>
      </div>

      {/* Filter Bar */}
      <Card className="border-border/60">
        <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Icon icon="solar:magnifer-linear" className="absolute left-3 top-3 text-muted-foreground" size={16} />
            <Input
              placeholder="Search by certificate #, staff name, or diagnosis..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="h-10 rounded-md border border-input bg-background px-3 py-2 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="all">All Records</option>
              <option value="Ethiopian Electric Utility Medium Clinic">Ethiopian Electric Utility Medium Clinic</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Certificate Table */}
      <Card className="border-border/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">
            Issued Medical Certificates ({filteredCertificates.length})
          </CardTitle>
          <CardDescription>
            Valid duty restriction vouchers and clinical rest clearances for EEU personnel
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex h-32 items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : filteredCertificates.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No medical certificates found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border/50 text-xs text-muted-foreground">
                    <th className="py-3 px-2">Certificate #</th>
                    <th className="py-3 px-2">EEU Staff</th>
                    <th className="py-3 px-2">Clinic Branch</th>
                    <th className="py-3 px-2">Leave Duration</th>
                    <th className="py-3 px-2">Diagnosis & Remarks</th>
                    <th className="py-3 px-2">Duty Restriction</th>
                    <th className="py-3 px-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {filteredCertificates.map((cert) => (
                    <tr key={cert.id} className="transition-colors hover:bg-muted/30">
                      <td className="py-3 px-2 font-mono text-xs font-bold text-primary">
                        {cert.slip_id}
                      </td>
                      <td className="py-3 px-2">
                        <div className="font-medium text-foreground">{cert.patient_name}</div>
                        <div className="text-xs text-muted-foreground">Issued: {cert.issue_date}</div>
                      </td>
                      <td className="py-3 px-2 text-xs text-foreground">
                        {(cert as any).eeu_clinic_branch || "Ethiopian Electric Utility Medium Clinic"}
                      </td>
                      <td className="py-3 px-2">
                        <Badge variant="outline" className="font-semibold text-amber-600 dark:text-amber-400">
                          {cert.total_days} Days
                        </Badge>
                        <div className="mt-0.5 text-[11px] text-muted-foreground">
                          {cert.from_date} to {cert.to_date}
                        </div>
                      </td>
                      <td className="py-3 px-2 max-w-[240px]">
                        <div className="truncate text-xs font-medium text-foreground" title={cert.diagnosis}>
                          {cert.diagnosis}
                        </div>
                        {cert.doctor_remarks && (
                          <div className="truncate text-[11px] text-muted-foreground" title={cert.doctor_remarks}>
                            {cert.doctor_remarks}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-2">
                        <span className="rounded bg-muted px-2 py-0.5 text-xs text-foreground">
                          {(cert as any).eeu_duty_restriction || cert.fitness_state}
                        </span>
                      </td>
                      <td className="py-3 px-2 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openPrintModal(cert)}
                          className="gap-1.5 text-xs"
                        >
                          <Icon icon="solar:printer-bold" size={14} />
                          Print Slip
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

      {/* Modal: Issue Certificate */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold text-amber-600">
              <Icon icon="solar:document-add-bold" size={22} />
              Issue EEU Medical Sick Leave Certificate
            </DialogTitle>
            <DialogDescription>
              Certify a recommended rest period and duty limitations for an Ethiopian Electric Utility employee.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4 pt-2">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="patient">Employee / Patient *</Label>
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
                      {p.patient_name} {p.eeu_staff_id ? `(${p.eeu_staff_id})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="practitioner">Attending Physician</Label>
                <select
                  id="practitioner"
                  value={form.practitioner}
                  onChange={(e) => setForm({ ...form, practitioner: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">Select Doctor...</option>
                  {practitioners.map((doc) => (
                    <option key={doc.id} value={doc.id}>
                      {doc.practitioner_name} ({doc.designation || "Medical Officer"})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="eeu_clinic_branch">EEU Clinic Branch *</Label>
                <select
                  id="eeu_clinic_branch"
                  value={form.eeu_clinic_branch}
                  onChange={(e) => setForm({ ...form, eeu_clinic_branch: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="Ethiopian Electric Utility Medium Clinic">Ethiopian Electric Utility Medium Clinic</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="eeu_leave_category">Leave Category *</Label>
                <select
                  id="eeu_leave_category"
                  value={form.eeu_leave_category}
                  onChange={(e) => setForm({ ...form, eeu_leave_category: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="Work-Related Electrical/Mechanical Injury">
                    Work-Related Electrical/Mechanical Injury
                  </option>
                  <option value="Occupational High-Voltage/Arc Flash Recovery">
                    Occupational High-Voltage/Arc Flash Recovery
                  </option>
                  <option value="General Medical Illness">General Medical Illness</option>
                  <option value="Post-Surgical / Inpatient Convalescence">
                    Post-Surgical / Inpatient Convalescence
                  </option>
                  <option value="Maternity / Family Health Leave">Maternity / Family Health Leave</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="from_date">Leave Start Date *</Label>
                <Input
                  id="from_date"
                  type="date"
                  value={form.from_date}
                  onChange={(e) => handleFromDateChange(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="to_date">Leave End Date *</Label>
                <Input
                  id="to_date"
                  type="date"
                  value={form.to_date}
                  onChange={(e) => handleToDateChange(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Total Calculated Rest Period:</span>
                  <span className="font-bold text-amber-600 dark:text-amber-400">{form.total_days} Consecutive Days</span>
                </div>
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="eeu_duty_restriction">Duty Restrictions & Limitations *</Label>
                <select
                  id="eeu_duty_restriction"
                  value={form.eeu_duty_restriction}
                  onChange={(e) => setForm({ ...form, eeu_duty_restriction: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="Complete Bed Rest / Total Absence">Complete Bed Rest / Total Absence</option>
                  <option value="Restricted to Light Ground Duty (No Climbing / No Field Patrol)">
                    Restricted to Light Ground Duty (No Climbing / No Field Patrol)
                  </option>
                  <option value="Administrative Desk Duty Only">Administrative Desk Duty Only</option>
                  <option value="No Night Shifts / No 24hr Emergency Standby">
                    No Night Shifts / No 24hr Emergency Standby
                  </option>
                </select>
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="diagnosis">Clinical Diagnosis *</Label>
                <textarea
                  id="diagnosis"
                  rows={2}
                  placeholder="Medical diagnosis justifying absence (e.g. 2nd-degree electrical arc burn right arm, lumbar contusion, etc.)..."
                  value={form.diagnosis}
                  onChange={(e) => setForm({ ...form, diagnosis: e.target.value })}
                  className="w-full rounded-md border border-input bg-background p-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  required
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="doctor_remarks">Doctor's Clinical Instructions</Label>
                <textarea
                  id="doctor_remarks"
                  rows={2}
                  placeholder="Daily dressing changes, bed rest, medication schedule, follow-up re-evaluation date..."
                  value={form.doctor_remarks}
                  onChange={(e) => setForm({ ...form, doctor_remarks: e.target.value })}
                  className="w-full rounded-md border border-input bg-background p-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-border/50 pt-4">
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving} className="bg-amber-600 text-white hover:bg-amber-500">
                {saving ? "Issuing..." : "Issue & Preview Certificate"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Official Printable Certificate Modal */}
      {selectedCert && (
        <Dialog open={printModalOpen} onOpenChange={setPrintModalOpen}>
          <DialogContent className="max-w-3xl">
            <DialogHeader className="no-print">
              <div className="flex items-center justify-between">
                <DialogTitle className="text-base font-bold">Official Sick Leave Certificate Preview</DialogTitle>
                <Button
                  onClick={() => window.print()}
                  className="gap-2 bg-primary text-primary-foreground shadow"
                >
                  <Icon icon="solar:printer-bold" size={16} />
                  Print Official Certificate
                </Button>
              </div>
            </DialogHeader>

            {/* Certificate Sheet (Printable) */}
            <div className="rounded-xl border-2 border-slate-700 bg-white p-8 text-slate-900 shadow-2xl print:border-none print:p-0">
              {/* Header with EEU Logo */}
              <div className="flex items-center justify-between border-b-2 border-slate-900 pb-4">
                <div className="flex items-center gap-4">
                  <img
                    src={eeuLogoImg}
                    alt="EEU Emblem"
                    className="h-8 w-8 sm:h-9 sm:w-9 print:h-6 print:w-6 print:max-h-6 object-contain shrink-0"
                    style={{ printColorAdjust: "exact", WebkitPrintColorAdjust: "exact", maxHeight: "26px" }}
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = "/eeu-logo.png";
                    }}
                  />
                  <div>
                    <h2 className="text-lg font-black tracking-wide text-slate-950 uppercase">
                      Ethiopian Electric Utility (EEU)
                    </h2>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                      Ethiopian Electric Utility Medium Clinic
                    </h3>
                    <p className="text-[11px] text-slate-600">
                      Addis Ababa, Ethiopia • Tel: +251 11 515 7103
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <div className="rounded border border-slate-300 bg-slate-50 px-3 py-1 font-mono text-xs font-bold text-slate-800">
                    {selectedCert.slip_id}
                  </div>
                  <div className="mt-1 text-[11px] text-slate-500">
                    Date: {selectedCert.issue_date}
                  </div>
                </div>
              </div>

              {/* Title */}
              <div className="my-6 text-center">
                <h1 className="text-xl font-extrabold uppercase tracking-wider text-slate-900 underline decoration-emerald-600 decoration-2 underline-offset-4">
                  Medical Sick Leave & Fitness Clearance Certificate
                </h1>
                <p className="text-xs text-slate-500 mt-1">
                  Issued in accordance with the Ethiopian Labor Proclamation & EEU Occupational Health Directives
                </p>
              </div>

              {/* Employee Particulars */}
              <div className="rounded-lg bg-slate-50 p-4 border border-slate-200 text-xs">
                <div className="grid grid-cols-2 gap-y-2">
                  <div>
                    <span className="text-slate-500">Employee Name: </span>
                    <strong className="text-slate-900 text-sm">{selectedCert.patient_name}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500">EEU Staff / Payroll ID: </span>
                    <strong className="font-mono text-slate-900">{(selectedCert as any).staff_id || "EEU-STAFF"}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500">Leave Category: </span>
                    <span className="font-semibold text-slate-800">
                      {(selectedCert as any).eeu_leave_category || "Occupational Health Exemption"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">Gender / Age: </span>
                    <span className="text-slate-800">{selectedCert.patient_sex || "Staff"} ({selectedCert.patient_age || "Adult"})</span>
                  </div>
                </div>
              </div>

              {/* Clinical Certification */}
              <div className="mt-6 space-y-4 text-xs">
                <p className="text-justify text-slate-800 leading-relaxed">
                  This is to certify that the above-named employee was clinically examined at our clinic on{" "}
                  <strong>{selectedCert.issue_date}</strong> and is diagnosed with:
                </p>

                <div className="rounded border-l-4 border-amber-600 bg-amber-50/60 p-3 font-semibold text-slate-900">
                  {selectedCert.diagnosis}
                </div>

                <div className="grid grid-cols-3 gap-2 rounded-lg border border-slate-200 p-3 text-center">
                  <div>
                    <div className="text-[11px] text-slate-500">Rest Effective From</div>
                    <div className="text-xs font-bold text-slate-900">{selectedCert.from_date}</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-500">Convalescence Until</div>
                    <div className="text-xs font-bold text-slate-900">{selectedCert.to_date}</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-500">Total Duration</div>
                    <div className="text-sm font-extrabold text-amber-700">{selectedCert.total_days} Days</div>
                  </div>
                </div>

                <div>
                  <h4 className="font-bold text-slate-900 uppercase text-[11px]">Duty Restriction & Limitations:</h4>
                  <div className="mt-1 rounded bg-slate-100 p-2 font-semibold text-slate-800">
                    {(selectedCert as any).eeu_duty_restriction || selectedCert.fitness_state}
                  </div>
                </div>

                {selectedCert.doctor_remarks && (
                  <div>
                    <h4 className="font-bold text-slate-900 uppercase text-[11px]">Attending Physician Instructions:</h4>
                    <p className="mt-0.5 text-slate-700 italic">{selectedCert.doctor_remarks}</p>
                  </div>
                )}
              </div>

              {/* Signatures & QR Code */}
              <div className="mt-10 flex items-end justify-between border-t border-slate-300 pt-6 text-xs">
                <div className="space-y-1">
                  <div className="font-bold text-slate-900">Attending Medical Practitioner:</div>
                  <div className="text-slate-700 font-semibold">{selectedCert.practitioner_name || "Medical Officer"}</div>
                  <div className="text-slate-500 text-[11px]">Signature & Date: ________________________</div>
                </div>

                {/* QR Verification Badge */}
                <div className="flex flex-col items-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded border border-slate-400 bg-slate-100 font-mono text-[9px] text-center text-slate-600 p-1">
                    [EEU QR VERIFY: {((selectedCert as any).qr_verification_code || "EEU-9821").slice(0, 10)}]
                  </div>
                  <span className="mt-1 text-[9px] text-slate-500 uppercase tracking-widest">Digital Auth</span>
                </div>

                <div className="space-y-1 text-right">
                  <div className="font-bold text-slate-900">Official Directorate Seal:</div>
                  <div className="h-10 w-32 border border-dashed border-slate-400 rounded flex items-center justify-center text-[10px] text-slate-400">
                    [EEU CLINIC STAMP]
                  </div>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
