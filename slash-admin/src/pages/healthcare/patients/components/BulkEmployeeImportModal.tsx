import { useState, useRef } from "react";
import { toast } from "sonner";
import { Icon } from "@/components/icon";
import { Button } from "@/ui/button";
import { Badge } from "@/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/ui/dialog";
import { HealthcareApi } from "@/api/services/healthcareService";
import { cn } from "@/utils";

interface BulkEmployeeImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface PreviewRow {
  row_number: number;
  first_name: string;
  middle_name?: string;
  last_name?: string;
  patient_name: string;
  sex?: string;
  dob?: string;
  mobile?: string;
  email?: string;
  company_affiliation: string;
  eeu_staff_id?: string;
  eeu_department?: string;
  eeu_cadre?: string;
  eeu_region?: string;
  eeu_work_station?: string;
  blood_group?: string;
  eeu_beneficiary_type?: string;
  is_duplicate?: boolean;
}

interface PreviewData {
  total_rows: number;
  valid_count: number;
  duplicate_count: number;
  error_count: number;
  errors: string[];
  preview: PreviewRow[];
}

export default function BulkEmployeeImportModal({
  open,
  onOpenChange,
  onSuccess,
}: BulkEmployeeImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"upload" | "preview" | "done">("upload");
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [importResult, setImportResult] = useState<any | null>(null);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDownloadTemplate = async (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    if (downloadingTemplate) return;
    setDownloadingTemplate(true);
    try {
      const blob = await HealthcareApi.patients.downloadTemplate();
      const blobUrl = window.URL.createObjectURL(
        new Blob([blob as any], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        })
      );
      const link = document.createElement("a");
      link.href = blobUrl;
      link.setAttribute("download", "eeu_employee_import_template.xlsx");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
      toast.success("Excel template downloaded successfully!");
    } catch (err: any) {
      console.error("Template download failed via API client, trying fallback URL:", err);
      try {
        const directUrl = HealthcareApi.patients.downloadTemplateUrl();
        const a = document.createElement("a");
        a.href = directUrl;
        a.setAttribute("download", "eeu_employee_import_template.xlsx");
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } catch (fallbackErr) {
        toast.error("Failed to download Excel template. Please try again.");
      }
    } finally {
      setDownloadingTemplate(false);
    }
  };

  const resetState = () => {
    setFile(null);
    setLoading(false);
    setStep("upload");
    setPreviewData(null);
    setImportResult(null);
  };

  const handleFileSelect = async (selectedFile: File) => {
    const name = selectedFile.name.toLowerCase();
    if (!name.endsWith(".xlsx") && !name.endsWith(".xls") && !name.endsWith(".csv")) {
      toast.error("Please upload an Excel (.xlsx/.xls) or CSV (.csv) file.");
      return;
    }

    setFile(selectedFile);
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      const res = await HealthcareApi.patients.bulkImport(formData, true);
      setPreviewData(res as any);
      setStep("preview");
      toast.success(`Validated ${res.total_rows || 0} rows from ${selectedFile.name}`);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.response?.data?.error || "Failed to parse file for preview.");
      setFile(null);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!file) return;
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await HealthcareApi.patients.bulkImport(formData, false);
      setImportResult(res);
      setStep("done");
      toast.success(`Successfully imported ${res.created_count || 0} employee records!`);
      onSuccess();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.response?.data?.error || "Bulk import failed. Please verify the spreadsheet.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(val) => {
        if (!loading) {
          if (!val) resetState();
          onOpenChange(val);
        }
      }}
    >
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden rounded-2xl">
        <DialogHeader className="p-6 pb-4 border-b bg-muted/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
                <Icon icon="solar:file-smile-bold-duotone" size={24} />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-foreground">
                  Bulk Employee & Staff Registry Import
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Import entire workforces at once from Excel spreadsheets into the Master Patient Index
                </DialogDescription>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDownloadTemplate}
              disabled={downloadingTemplate}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 h-8 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/20 transition-all cursor-pointer shadow-none"
            >
              <Icon
                icon={downloadingTemplate ? "solar:restart-bold" : "solar:download-minimalistic-bold"}
                size={14}
                className={cn(downloadingTemplate && "animate-spin")}
              />
              {downloadingTemplate ? "Downloading..." : "Download Excel Template"}
            </Button>
          </div>
        </DialogHeader>

        {/* ── Modal Body Content ── */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* STEP 1: Upload Dropzone */}
          {step === "upload" && (
            <div className="space-y-5">
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  if (e.dataTransfer.files?.[0]) {
                    handleFileSelect(e.dataTransfer.files[0]);
                  }
                }}
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  "border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3.5",
                  isDragging
                    ? "border-primary bg-primary/5 scale-[0.99]"
                    : "border-border hover:border-primary/50 hover:bg-muted/30"
                )}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.[0]) {
                      handleFileSelect(e.target.files[0]);
                    }
                  }}
                />

                <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shadow-xs">
                  <Icon icon={loading ? "solar:restart-bold" : "solar:cloud-upload-bold-duotone"} size={28} className={cn(loading && "animate-spin")} />
                </div>

                <div>
                  <h3 className="text-sm font-bold text-foreground">
                    {loading ? "Analyzing Spreadsheet..." : "Click or Drag & Drop Excel Spreadsheet"}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                    Supports Microsoft Excel (.xlsx, .xls) and CSV (.csv) files. Headers will be matched automatically.
                  </p>
                </div>

                <Badge variant="outline" className="text-[11px] font-mono py-0.5 px-2.5">
                  .xlsx • .xls • .csv
                </Badge>
              </div>

              {/* Template Download Action Banner */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl border border-emerald-500/20 bg-emerald-500/5">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
                    <Icon icon="solar:file-spreadsheet-bold-duotone" size={22} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-foreground">Standardized EEU Employee Import Template (.xlsx)</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Pre-formatted with validated columns for Staff ID, Demographics, Affiliation Scheme, and Station.
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleDownloadTemplate}
                  disabled={downloadingTemplate}
                  className="gap-1.5 text-xs font-semibold border-emerald-500/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/15 shrink-0 shadow-none cursor-pointer"
                >
                  <Icon
                    icon={downloadingTemplate ? "solar:restart-bold" : "solar:download-minimalistic-bold"}
                    size={14}
                    className={cn(downloadingTemplate && "animate-spin")}
                  />
                  {downloadingTemplate ? "Downloading..." : "Download Sample Excel"}
                </Button>
              </div>

              {/* Supported Schemes Guidance Cards */}
              <div className="border rounded-2xl p-4 bg-muted/15 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                  <Icon icon="solar:shield-check-bold" size={16} className="text-primary" />
                  Supported Employer Schemes & Automatic Prefixes
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs">
                  <div className="p-3 rounded-xl border bg-card/60">
                    <span className="font-bold text-foreground block">1. EEU Main Staff</span>
                    <span className="text-[11px] text-muted-foreground block mt-0.5">Distribution, Retail & Metering</span>
                    <Badge variant="outline" className="mt-2 text-[10px] font-mono font-bold text-emerald-700 dark:text-emerald-300 border-emerald-500/30">
                      EEU-657854
                    </Badge>
                  </div>

                  <div className="p-3 rounded-xl border bg-card/60">
                    <span className="font-bold text-foreground block">2. EEFC Football Club</span>
                    <span className="text-[11px] text-muted-foreground block mt-0.5">Players, Trainers & Staff</span>
                    <Badge variant="outline" className="mt-2 text-[10px] font-mono font-bold text-blue-700 dark:text-blue-300 border-blue-500/30">
                      EEFC-10023
                    </Badge>
                  </div>

                  <div className="p-3 rounded-xl border bg-card/60">
                    <span className="font-bold text-foreground block">3. Retired Employee</span>
                    <span className="text-[11px] text-muted-foreground block mt-0.5">EEU Pension Beneficiaries</span>
                    <Badge variant="outline" className="mt-2 text-[10px] font-mono font-bold text-purple-700 dark:text-purple-300 border-purple-500/30">
                      RET-20412
                    </Badge>
                  </div>

                  <div className="p-3 rounded-xl border bg-card/60">
                    <span className="font-bold text-foreground block">4. Others</span>
                    <span className="text-[11px] text-muted-foreground block mt-0.5">Contractors & Associates</span>
                    <Badge variant="outline" className="mt-2 text-[10px] font-mono font-bold text-amber-700 dark:text-amber-300 border-amber-500/30">
                      others-578879
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Preview & Validation */}
          {step === "preview" && previewData && (
            <div className="space-y-5">
              {/* Scorecard */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl border bg-card/60">
                  <span className="text-[10px] text-muted-foreground uppercase font-bold block">Total Rows</span>
                  <span className="text-lg font-bold text-foreground">{previewData.total_rows}</span>
                </div>
                <div className="p-3 rounded-xl border bg-emerald-500/5 border-emerald-500/20">
                  <span className="text-[10px] text-emerald-700 dark:text-emerald-300 uppercase font-bold block">Valid & Ready</span>
                  <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{previewData.valid_count}</span>
                </div>
                <div className="p-3 rounded-xl border bg-amber-500/5 border-amber-500/20">
                  <span className="text-[10px] text-amber-700 dark:text-amber-300 uppercase font-bold block">Existing (Will Update)</span>
                  <span className="text-lg font-bold text-amber-600 dark:text-amber-400">{previewData.duplicate_count}</span>
                </div>
                <div className="p-3 rounded-xl border bg-rose-500/5 border-rose-500/20">
                  <span className="text-[10px] text-rose-700 dark:text-rose-300 uppercase font-bold block">Errors / Skipped</span>
                  <span className="text-lg font-bold text-rose-600 dark:text-rose-400">{previewData.error_count}</span>
                </div>
              </div>

              {/* Validation Warnings / Errors (if any) */}
              {previewData.errors?.length > 0 && (
                <div className="p-3.5 rounded-xl border border-rose-500/30 bg-rose-500/5 text-xs text-rose-700 dark:text-rose-300 space-y-1">
                  <span className="font-bold block">Spreadsheet Validation Warnings:</span>
                  <ul className="list-disc list-inside space-y-0.5 text-[11px]">
                    {previewData.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Preview Table */}
              <div className="border rounded-xl overflow-hidden shadow-2xs">
                <div className="px-4 py-2.5 bg-muted/30 border-b flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground">
                    First {Math.min(previewData.preview?.length || 0, 50)} Records Preview
                  </span>
                  <span className="text-[11px] text-muted-foreground font-mono">
                    File: {file?.name}
                  </span>
                </div>
                <div className="overflow-x-auto max-h-[340px]">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="sticky top-0 bg-muted/60 backdrop-blur-xs text-[11px] text-muted-foreground font-bold border-b">
                      <tr>
                        <th className="py-2 px-3">#</th>
                        <th className="py-2 px-3">Staff ID</th>
                        <th className="py-2 px-3">Full Name</th>
                        <th className="py-2 px-3">Scheme</th>
                        <th className="py-2 px-3">Department</th>
                        <th className="py-2 px-3">Job Role</th>
                        <th className="py-2 px-3">Gender</th>
                        <th className="py-2 px-3">Mobile</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {previewData.preview?.map((r, i) => (
                        <tr key={i} className="hover:bg-muted/20">
                          <td className="py-2 px-3 font-mono text-[10px] text-muted-foreground">
                            {r.row_number}
                          </td>
                          <td className="py-2 px-3 font-mono font-bold text-primary">
                            {r.eeu_staff_id || "—"}
                          </td>
                          <td className="py-2 px-3 font-medium text-foreground">
                            {r.patient_name}
                          </td>
                          <td className="py-2 px-3">
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px] font-semibold py-0",
                                r.company_affiliation?.includes("EEFC")
                                  ? "border-blue-500/30 text-blue-600 dark:text-blue-400 bg-blue-500/5"
                                  : r.company_affiliation?.includes("Retired")
                                  ? "border-purple-500/30 text-purple-600 dark:text-purple-400 bg-purple-500/5"
                                  : r.company_affiliation?.includes("Other")
                                  ? "border-amber-500/30 text-amber-600 dark:text-amber-400 bg-amber-500/5"
                                  : "border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/5"
                              )}
                            >
                              {r.company_affiliation?.includes("EEFC")
                                ? "EEFC"
                                : r.company_affiliation?.includes("Retired")
                                ? "Retired"
                                : r.company_affiliation?.includes("Other")
                                ? "Others"
                                : "EEU"}
                            </Badge>
                          </td>
                          <td className="py-2 px-3 text-muted-foreground text-[11px] truncate max-w-[150px]">
                            {r.eeu_department || "—"}
                          </td>
                          <td className="py-2 px-3 text-muted-foreground text-[11px] truncate max-w-[120px]">
                            {r.eeu_cadre || "—"}
                          </td>
                          <td className="py-2 px-3 text-muted-foreground text-[11px]">
                            {r.sex || "—"}
                          </td>
                          <td className="py-2 px-3 font-mono text-[11px] text-muted-foreground">
                            {r.mobile || "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Done / Success */}
          {step === "done" && importResult && (
            <div className="py-8 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-600 mx-auto flex items-center justify-center">
                <Icon icon="solar:check-circle-bold" size={36} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground">Import Completed Successfully!</h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
                  {importResult.created_count || 0} employees and beneficiaries have been processed and enrolled into the clinic's Master Patient Index.
                </p>
              </div>

              <div className="inline-flex items-center gap-4 p-4 rounded-xl border bg-muted/20 text-xs">
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase font-bold">Processed</span>
                  <span className="text-base font-extrabold text-foreground">{importResult.total_rows}</span>
                </div>
                <div className="w-px h-8 bg-border" />
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase font-bold">Enrolled</span>
                  <span className="text-base font-extrabold text-emerald-600">{importResult.created_count}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Modal Footer ── */}
        <div className="p-4 px-6 border-t bg-muted/10 flex items-center justify-between">
          {step === "upload" && (
            <>
              <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="text-xs">
                Cancel
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
                className="text-xs gap-1.5"
              >
                <Icon icon="solar:folder-open-bold" size={14} />
                Browse File
              </Button>
            </>
          )}

          {step === "preview" && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setStep("upload");
                  setFile(null);
                  setPreviewData(null);
                }}
                disabled={loading}
                className="text-xs"
              >
                Choose Another File
              </Button>
              <Button
                size="sm"
                onClick={handleConfirmImport}
                disabled={loading || (previewData?.valid_count === 0)}
                className="text-xs gap-1.5 bg-primary text-primary-foreground font-semibold"
              >
                <Icon icon={loading ? "solar:restart-bold" : "solar:cloud-upload-bold"} size={14} className={cn(loading && "animate-spin")} />
                {loading ? "Importing Workforce..." : `Import ${previewData?.valid_count || 0} Employees Now`}
              </Button>
            </>
          )}

          {step === "done" && (
            <div className="w-full flex justify-end">
              <Button
                size="sm"
                onClick={() => {
                  resetState();
                  onOpenChange(false);
                }}
                className="text-xs bg-primary text-primary-foreground"
              >
                Done & View Registry
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
