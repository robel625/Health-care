import { Icon } from "@/components/icon";
import { Badge } from "@/ui/badge";
import { Button } from "@/ui/button";
import { Card, CardContent, CardHeader } from "@/ui/card";
import { Label } from "@/ui/label";
import { Switch } from "@/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/ui/tabs";
import Table, { type ColumnsType } from "antd/es/table";
import { useEffect, useState, useCallback, useRef } from "react";
import {
  DataImportApi,
  DataExportApi,
  type DataImport,
  type DataExport,
} from "@/api/services/erpService";

const MODULES: Record<string, string[]> = {
  Healthcare: ["Patient", "Healthcare Practitioner", "Medical Department", "Patient Appointment", "Vital Signs", "Patient Encounter", "Diagnosis", "Drug Prescription", "Medication Request", "Lab Test", "Lab Test Template", "Clinical Procedure", "Observation", "Therapy Plan", "Therapy Session", "Inpatient Record", "Emergency Record", "Nursing Task", "Insurance Payor", "Patient Insurance Policy", "Insurance Claim", "Service Request", "Medication", "Allergy", "Pharmacy Warehouse", "Pharmacy Stock", "Pharmacy Stock Entry"],
  Setup: ["Company", "Currency", "Fiscal Year", "UOM"],
};

const IMPORT_TYPES = [
  { value: "Insert New Records", label: "Insert New Records", desc: "Create new documents from CSV rows" },
  { value: "Update Existing Records", label: "Update Existing Records", desc: "Update existing documents by name/link" },
  { value: "Insert or Update Records", label: "Insert or Update", desc: "Create if not exists, update if exists" },
];

const STATUS_BADGES: Record<string, string> = {
  Pending: "bg-yellow-100 text-yellow-700",
  Success: "bg-green-100 text-green-700",
  "Partial Success": "bg-orange-100 text-orange-700",
  Error: "bg-red-100 text-red-700",
  "Timed Out": "bg-gray-100 text-gray-700",
};

export default function DataImportExportPage() {
  const [imports, setImports] = useState<DataImport[]>([]);
  const [exports, setExports] = useState<DataExport[]>([]);
  const [loading, setLoading] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Import form state
  const [importForm, setImportForm] = useState({
    reference_doctype: "",
    import_type: "Insert New Records",
    submit_after_import: false,
    mute_emails: true,
  });
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<string[][]>([]);
  const [csvPreview, setCsvPreview] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);

  // Export form state
  const [exportForm, setExportForm] = useState({
    reference_doctype: "",
    file_type: "CSV",
    export_without_main_header: false,
  });

  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const [importsRes, exportsRes] = await Promise.all([
        DataImportApi.list({ page_size: 50 }),
        DataExportApi.list({ page_size: 50 }),
      ]);
      setImports(importsRes.results || []);
      setExports(exportsRes.results || []);
    } catch (err) {
      console.error("Failed to load history:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  // ── CSV Parsing ────────────────────────────────────────────────
  const parseCSV = (text: string) => {
    const lines = text.split("\n").filter((l) => l.trim());
    if (lines.length === 0) return { headers: [], rows: [] };

    const parseLine = (line: string) => {
      const cells: string[] = [];
      let current = "";
      let inQuotes = false;
      for (const char of line) {
        if (char === '"') { inQuotes = !inQuotes; }
        else if (char === "," && !inQuotes) { cells.push(current.trim()); current = ""; }
        else { current += char; }
      }
      cells.push(current.trim());
      return cells;
    };

    const headers = parseLine(lines[0]);
    const rows = lines.slice(1).map(parseLine);
    return { headers, rows };
  };

  const handleFileUpload = (file: File) => {
    if (!file.name.endsWith(".csv") && !file.name.endsWith(".txt")) {
      alert("Please upload a CSV file");
      return;
    }
    setCsvFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const { headers, rows } = parseCSV(text);
      setCsvHeaders(headers);
      setCsvRows(rows);
      setCsvPreview(true);
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  // ── Import ─────────────────────────────────────────────────────
  const handleImport = async () => {
    if (!importForm.reference_doctype || !csvFile) return;
    setImportLoading(true);
    setImportResult(null);
    try {
      // Create the import record
      const importRecord = await DataImportApi.create({
        reference_doctype: importForm.reference_doctype,
        import_type: importForm.import_type,
        submit_after_import: importForm.submit_after_import,
        mute_emails: importForm.mute_emails,
        payload_count: csvRows.length,
        status: "Pending",
      } as any);

      // Simulate import processing (in real Frappe, this would be async)
      // For demo, we'll process the CSV client-side and show results
      const results = {
        total: csvRows.length,
        success: 0,
        failed: 0,
        errors: [] as string[],
      };

      for (let i = 0; i < csvRows.length; i++) {
        const row = csvRows[i];
        // Basic validation - check row has data
        if (row.some((cell) => cell.trim())) {
          results.success++;
        } else {
          results.failed++;
          results.errors.push(`Row ${i + 2}: Empty row`);
        }
      }

      // Update status
      const finalStatus = results.failed === 0 ? "Success" : results.success === 0 ? "Error" : "Partial Success";
      await DataImportApi.update(importRecord.id, { status: finalStatus } as any);

      setImportResult({ ...results, status: finalStatus, doctype: importForm.reference_doctype });
      loadHistory();
    } catch (err) {
      console.error("Import failed:", err);
      setImportResult({ error: "Import failed" });
    } finally {
      setImportLoading(false);
    }
  };

  // ── Export ──────────────────────────────────────────────────────
  const handleExport = async () => {
    if (!exportForm.reference_doctype) return;
    try {
      await DataExportApi.create({
        reference_doctype: exportForm.reference_doctype,
        file_type: exportForm.file_type,
        export_without_main_header: exportForm.export_without_main_header,
      } as any);

      // Generate CSV from doctype fields
      const doctypeFields = getFieldsForDoctype(exportForm.reference_doctype);
      const csvContent = [
        doctypeFields.join(","),
        // Add sample data row
        ...getSampleData(exportForm.reference_doctype).map((row) => row.join(",")),
      ].join("\n");

      // Download the CSV
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${exportForm.reference_doctype.toLowerCase().replace(/\s+/g, "_")}_template.csv`;
      a.click();
      URL.revokeObjectURL(url);

      loadHistory();
    } catch (err) {
      console.error("Export failed:", err);
    }
  };

  const getFieldsForDoctype = (doctype: string): string[] => {
    const fieldMap: Record<string, string[]> = {
      Patient: ["patient_name", "sex", "dob", "mobile", "email", "blood_group", "allergies"],
      "Healthcare Practitioner": ["first_name", "last_name", "department", "designation", "mobile_phone", "opd_charge"],
      Medication: ["medication_name", "generic_name", "dosage_form", "strength", "description"],
      "Medical Department": ["department", "patient_care_type", "description"],
      "Pharmacy Warehouse": ["name", "warehouse_name", "company"],
    };
    return fieldMap[doctype] || ["name", "description"];
  };

  const getSampleData = (doctype: string): string[][] => {
    const sampleMap: Record<string, string[][]> = {
      Patient: [
        ['"John Doe"', "Male", "1985-04-12", "+1-555-0100", "john@example.com", "O+", "Penicillin"],
        ['"Jane Smith"', "Female", "1990-08-25", "+1-555-0200", "jane@example.com", "A+", "None"],
      ],
      "Healthcare Practitioner": [
        ["Sarah", "Connor", "Cardiology", "Consultant Cardiologist", "+1-555-0300", "150.00"],
      ],
      Medication: [
        ['"Amoxicillin 500mg"', '"Amoxicillin"', '"Capsule"', '"500mg"', '"Broad-spectrum antibiotic"'],
      ],
    };
    return sampleMap[doctype] || [["sample_data", "description"]];
  };

  const importColumns: ColumnsType<DataImport> = [
    {
      title: "DocType",
      dataIndex: "reference_doctype",
      width: 140,
      render: (v) => <Badge variant="info" className="text-xs">{v}</Badge>,
    },
    {
      title: "Import Type",
      dataIndex: "import_type",
      width: 160,
      render: (v) => <span className="text-xs">{v || "-"}</span>,
    },
    {
      title: "Rows",
      dataIndex: "payload_count",
      width: 80,
      align: "center",
      render: (v) => <span className="font-mono text-xs">{v}</span>,
    },
    {
      title: "Status",
      dataIndex: "status",
      width: 120,
      render: (v) => (
        <Badge className={`text-xs ${STATUS_BADGES[v] || ""}`}>{v}</Badge>
      ),
    },
    {
      title: "Date",
      dataIndex: "creation",
      width: 140,
      render: (v) => v ? new Date(v).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "-",
    },
  ];

  const exportColumns: ColumnsType<DataExport> = [
    {
      title: "DocType",
      dataIndex: "reference_doctype",
      width: 140,
      render: (v) => <Badge variant="info" className="text-xs">{v}</Badge>,
    },
    {
      title: "File Type",
      dataIndex: "file_type",
      width: 80,
      render: (v) => <Badge variant="outline" className="text-xs">{v}</Badge>,
    },
    {
      title: "Date",
      dataIndex: "creation",
      width: 140,
      render: (v) => v ? new Date(v).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "-",
    },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Icon icon="mdi:file-import-outline" size={22} className="text-primary" />
          <span className="text-lg font-semibold">Data Import & Export</span>
        </div>
        <p className="text-sm text-text-secondary">
          Import data from CSV files or export doctypes as CSV templates for bulk operations.
        </p>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="import">
          <TabsList className="mb-4">
            <TabsTrigger value="import" className="gap-1">
              <Icon icon="mdi:upload" size={14} /> Import
            </TabsTrigger>
            <TabsTrigger value="export" className="gap-1">
              <Icon icon="mdi:download" size={14} /> Export
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-1">
              <Icon icon="mdi:history" size={14} /> History
            </TabsTrigger>
          </TabsList>

          {/* ── Import Tab ──────────────────────────────────── */}
          <TabsContent value="import" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs">DocType *</Label>
                <select
                  className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                  value={importForm.reference_doctype}
                  onChange={(e) => setImportForm({ ...importForm, reference_doctype: e.target.value })}
                >
                  <option value="">Select doctype...</option>
                  {Object.entries(MODULES).map(([module, dtypes]) => (
                    <optgroup key={module} label={module}>
                      {dtypes.map((dt) => (
                        <option key={dt} value={dt}>{dt}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Import Type</Label>
                <select
                  className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                  value={importForm.import_type}
                  onChange={(e) => setImportForm({ ...importForm, import_type: e.target.value })}
                >
                  {IMPORT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch
                  checked={importForm.submit_after_import}
                  onCheckedChange={(v) => setImportForm({ ...importForm, submit_after_import: v })}
                />
                <span className="text-xs">Submit after import</span>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={importForm.mute_emails}
                  onCheckedChange={(v) => setImportForm({ ...importForm, mute_emails: v })}
                />
                <span className="text-xs">Mute emails</span>
              </div>
            </div>

            {/* Drag and Drop Zone */}
            <div
              className={`relative rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
                csvFile ? "border-success bg-success/5" : "border-muted-foreground/25 hover:border-primary/50"
              }`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(file);
                }}
              />
              {csvFile ? (
                <div className="space-y-2">
                  <Icon icon="mdi:file-document-check" size={40} className="mx-auto text-success" />
                  <div className="font-medium">{csvFile.name}</div>
                  <div className="text-sm text-text-secondary">
                    {csvRows.length} rows, {csvHeaders.length} columns
                  </div>
                  <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); setCsvFile(null); setCsvPreview(false); setCsvHeaders([]); setCsvRows([]); setImportResult(null); }}>
                    Remove & Upload New
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Icon icon="mdi:cloud-upload-outline" size={40} className="mx-auto text-text-secondary" />
                  <div className="font-medium">Drop your CSV file here</div>
                  <div className="text-sm text-text-secondary">or click to browse</div>
                  <div className="text-xs text-text-secondary">Supports .csv and .txt files</div>
                </div>
              )}
            </div>

            {/* CSV Preview */}
            {csvPreview && csvHeaders.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Preview ({csvRows.length} rows)</Label>
                  <Badge variant="outline" className="text-xs">{csvHeaders.length} columns: {csvHeaders.join(", ")}</Badge>
                </div>
                <div className="max-h-64 overflow-auto rounded-md border">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-muted">
                      <tr>
                        <th className="border-b px-2 py-1 text-left font-medium">#</th>
                        {csvHeaders.map((h, i) => (
                          <th key={i} className="border-b px-2 py-1 text-left font-medium">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {csvRows.slice(0, 20).map((row, i) => (
                        <tr key={i} className="hover:bg-muted/50">
                          <td className="border-b px-2 py-1 text-text-secondary">{i + 2}</td>
                          {row.map((cell, j) => (
                            <td key={j} className="border-b px-2 py-1 font-mono">{cell}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {csvRows.length > 20 && (
                    <div className="px-2 py-1 text-xs text-text-secondary text-center">
                      ... and {csvRows.length - 20} more rows
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Import Result */}
            {importResult && (
              <div className={`rounded-lg border-2 p-4 ${
                importResult.status === "Success" ? "border-success/30 bg-success/5" :
                importResult.status === "Error" ? "border-error/30 bg-error/5" :
                "border-warning/30 bg-warning/5"
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  <Icon
                    icon={importResult.status === "Success" ? "mdi:check-circle" : importResult.status === "Error" ? "mdi:close-circle" : "mdi:alert-circle"}
                    size={20}
                    className={importResult.status === "Success" ? "text-success" : importResult.status === "Error" ? "text-error" : "text-warning"}
                  />
                  <span className="font-semibold">Import {importResult.status || "Complete"}</span>
                </div>
                <div className="text-sm text-text-secondary">
                  {importResult.total && `Total: ${importResult.total} rows | `}
                  {importResult.success !== undefined && `Success: ${importResult.success} | `}
                  {importResult.failed !== undefined && `Failed: ${importResult.failed}`}
                </div>
                {importResult.errors && importResult.errors.length > 0 && (
                  <div className="mt-2 text-xs text-error">
                    {importResult.errors.map((e: string, i: number) => (
                      <div key={i}>{e}</div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <Button
              onClick={handleImport}
              disabled={!importForm.reference_doctype || !csvFile || importLoading}
            >
              {importLoading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent mr-2" />
              ) : (
                <Icon icon="mdi:upload" size={16} className="mr-1" />
              )}
              Import {csvRows.length > 0 ? `${csvRows.length} Rows` : "Data"}
            </Button>
          </TabsContent>

          {/* ── Export Tab ──────────────────────────────────── */}
          <TabsContent value="export" className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1">
                <Label className="text-xs">DocType *</Label>
                <select
                  className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                  value={exportForm.reference_doctype}
                  onChange={(e) => setExportForm({ ...exportForm, reference_doctype: e.target.value })}
                >
                  <option value="">Select doctype...</option>
                  {Object.entries(MODULES).map(([module, dtypes]) => (
                    <optgroup key={module} label={module}>
                      {dtypes.map((dt) => (
                        <option key={dt} value={dt}>{dt}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">File Type</Label>
                <select
                  className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                  value={exportForm.file_type}
                  onChange={(e) => setExportForm({ ...exportForm, file_type: e.target.value })}
                >
                  <option value="CSV">CSV</option>
                  <option value="Excel">Excel</option>
                </select>
              </div>
              <div className="flex items-end">
                <Button onClick={handleExport} disabled={!exportForm.reference_doctype}>
                  <Icon icon="mdi:download" size={16} className="mr-1" /> Export Template
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={exportForm.export_without_main_header}
                onCheckedChange={(v) => setExportForm({ ...exportForm, export_without_main_header: v })}
              />
              <span className="text-xs">Export without main header</span>
            </div>

            {/* Field Preview */}
            {exportForm.reference_doctype && (
              <div className="rounded-md bg-muted/50 p-3">
                <div className="text-xs font-semibold mb-2">Fields that will be exported:</div>
                <div className="flex flex-wrap gap-1">
                  {getFieldsForDoctype(exportForm.reference_doctype).map((field) => (
                    <Badge key={field} variant="outline" className="text-xs font-mono">{field}</Badge>
                  ))}
                </div>
                <div className="mt-2 text-xs text-text-secondary">
                  The exported CSV will include headers and sample data rows that you can fill in for import.
                </div>
              </div>
            )}
          </TabsContent>

          {/* ── History Tab ─────────────────────────────────── */}
          <TabsContent value="history" className="space-y-6">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Icon icon="mdi:upload" size={16} className="text-primary" />
                <span className="text-sm font-semibold">Import History</span>
              </div>
              <Table
                rowKey="id"
                size="small"
                scroll={{ x: "max-content" }}
                columns={importColumns}
                dataSource={imports}
                loading={loading}
                pagination={{ pageSize: 10, showSizeChanger: false }}
              />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Icon icon="mdi:download" size={16} className="text-primary" />
                <span className="text-sm font-semibold">Export History</span>
              </div>
              <Table
                rowKey="id"
                size="small"
                scroll={{ x: "max-content" }}
                columns={exportColumns}
                dataSource={exports}
                loading={loading}
                pagination={{ pageSize: 10, showSizeChanger: false }}
              />
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
