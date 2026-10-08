import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router";
import { Icon } from "@/components/icon";
import { Button } from "@/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/ui/card";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/ui/popover";
import Tag from "antd/es/tag";
import { toast } from "sonner";
import PharmacyNavHeader from "./components/PharmacyNavHeader";
import QuickAddDrugModal from "./components/QuickAddDrugModal";
import {
  HealthcareApi,
  type AddStockPayload,
  type AddStockResponse,
  type PharmacyStockBalance,
  type DosageForm,
  type MedicationClass,
} from "@/api/services/healthcareService";
import { WarehouseApi, type Warehouse } from "@/api/services/erpService";
import { cn } from "@/utils";

export interface IntakeRow {
  id: string;
  item_code: string;
  item_name: string;
  dosage_form_name?: string;
  strength?: string;
  medication_class_name?: string;
  batch_no: string;
  expiry_date: string;
  quantity: number;
  rate: number;
  uom: string;
  storage_condition: string;
}

export interface UnifiedDrugItem {
  id: string | number;
  generic_name: string;
  item_name: string;
  item_code: string;
  strength: string;
  strength_uom: string;
  dosage_form_name: string;
  medication_class_name: string;
  standard_rate: number;
  stock_uom: string;
  available_qty: number;
  in_stock: boolean;
  ndc?: string;
}

const COMMON_SUPPLIERS = [
  "Pfizer Pharmaceutical Distribution",
  "Novartis Global Health",
  "AstraZeneca Logistics",
  "GlaxoSmithKline (GSK)",
  "Roche Diagnostics & Pharma",
  "Sanofi Healthcare Supply",
  "Central Medical Depot",
];

const STORAGE_OPTIONS = [
  { value: "Ambient (15-25°C)", label: "Ambient (15-25°C)", icon: "solar:sun-bold-duotone", color: "text-amber-500" },
  { value: "Cold Chain (2-8°C)", label: "Cold Chain (2-8°C)", icon: "solar:snowflake-bold-duotone", color: "text-cyan-500" },
  { value: "Deep Freeze (-20°C)", label: "Deep Freeze (-20°C)", icon: "solar:snowflake-bold", color: "text-blue-600" },
  { value: "Controlled Room Temp", label: "Controlled Room Temp (20-25°C)", icon: "solar:thermometer-bold-duotone", color: "text-emerald-500" },
  { value: "Protect from Light & Moisture", label: "Protect from Light / Moisture", icon: "solar:shield-warning-bold-duotone", color: "text-purple-500" },
];

const COMMON_UOMS = ["Nos", "Tablets", "Capsules", "Strips", "Boxes", "Vials", "Ampoules", "Bottles", "Packs"];

export default function PharmacyStockIntakePage() {
  const navigate = useNavigate();

  // Master Data
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [unifiedCatalog, setUnifiedCatalog] = useState<UnifiedDrugItem[]>([]);
  const [dosageForms, setDosageForms] = useState<DosageForm[]>([]);
  const [medClasses, setMedClasses] = useState<MedicationClass[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  // Shipment & Voucher Form Details
  const [targetWarehouseId, setTargetWarehouseId] = useState<number>(0);
  const [entryType, setEntryType] = useState<"Material Receipt" | "Material Transfer">("Material Receipt");
  const [sourceWarehouseId, setSourceWarehouseId] = useState<number>(0);
  const [supplierName, setSupplierName] = useState("Novartis Global Health");
  const [purchaseInvoiceNo, setPurchaseInvoiceNo] = useState("");
  const [arrivalDate, setArrivalDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [receivingOfficer, setReceivingOfficer] = useState("Lead Pharmacist");
  const [notes, setNotes] = useState("");
  const [updateItemRate, setUpdateItemRate] = useState(true);

  // Intake Rows
  const [rows, setRows] = useState<IntakeRow[]>([
    {
      id: "row-1",
      item_code: "",
      item_name: "",
      dosage_form_name: "",
      strength: "",
      batch_no: "",
      expiry_date: "",
      quantity: 100,
      rate: 1.0,
      uom: "Nos",
      storage_condition: "Ambient (15-25°C)",
    },
    {
      id: "row-2",
      item_code: "",
      item_name: "",
      dosage_form_name: "",
      strength: "",
      batch_no: "",
      expiry_date: "",
      quantity: 50,
      rate: 2.5,
      uom: "Nos",
      storage_condition: "Ambient (15-25°C)",
    },
  ]);

  // Inline Quick Add Drug Modal State
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddInitialName, setQuickAddInitialName] = useState("");
  const [quickAddTargetRowIndex, setQuickAddTargetRowIndex] = useState<number | null>(null);

  // Submission & Result State
  const [saving, setSaving] = useState(false);
  const [receiptResult, setReceiptResult] = useState<AddStockResponse | null>(null);

  // Load initial master data
  useEffect(() => {
    setLoadingData(true);
    Promise.all([
      WarehouseApi.list().catch(() => ({ results: [] })),
      HealthcareApi.pharmacy.stockBalances().catch(() => ({ results: [] })),
      HealthcareApi.medications.list({ page_size: 500 }).catch(() => ({ results: [] })),
      HealthcareApi.stockItems.list({ page_size: 500 }).catch(() => ({ results: [] })),
      HealthcareApi.dosageForms.list({ page_size: 100 }).catch(() => ({ results: [] })),
      HealthcareApi.medicationClasses.list({ page_size: 100 }).catch(() => ({ results: [] })),
    ])
      .then(([whRes, stockRes, medRes, itemsRes, dfRes, mcRes]: any[]) => {
        const whList = (whRes.results || whRes || []) as Warehouse[];
        setWarehouses(whList);
        if (whList.length > 0) {
          const pharm = whList.find((w) => w.warehouse_name.toLowerCase().includes("pharmacy"));
          setTargetWarehouseId(pharm ? pharm.id : whList[0].id);
          const other = whList.find((w) => w.id !== (pharm ? pharm.id : whList[0].id));
          if (other) setSourceWarehouseId(other.id);
        }

        const stocks = (stockRes.results || stockRes || []) as PharmacyStockBalance[];
        const stockMap = new Map<string, number>();
        stocks.forEach((s) => {
          const key = (s.item_code || s.item_name || "").toLowerCase().trim();
          stockMap.set(key, (stockMap.get(key) || 0) + (Number(s.actual_qty) || 0));
        });

        const meds = (medRes.results || medRes || []) as any[];
        const stockItemsList = (itemsRes.results || itemsRes || []) as any[];

        // Build comprehensive catalog
        const catalogList: UnifiedDrugItem[] = [];
        const seenCodes = new Set<string>();

        // 1. Add all clinical Medications
        meds.forEach((m) => {
          const genName = m.generic_name || m.name || "";
          if (!genName) return;
          const codeKey = (m.linked_item_code || genName).toLowerCase().trim();
          seenCodes.add(codeKey);
          seenCodes.add(genName.toLowerCase().trim());

          const available = stockMap.get(codeKey) || stockMap.get(genName.toLowerCase().trim()) || 0;
          const rate = Number(m.standard_rate || 0);

          catalogList.push({
            id: m.id || genName,
            generic_name: genName,
            item_name: m.linked_item_code || genName,
            item_code: genName,
            strength: m.strength || "",
            strength_uom: m.strength_uom || "mg",
            dosage_form_name: m.dosage_form_name || m.dosage_form?.dosage_form || "Tablet",
            medication_class_name: m.medication_class_name || m.medication_class?.medication_class || "General",
            standard_rate: rate > 0 ? rate : 1.0,
            stock_uom: "Nos",
            available_qty: available,
            in_stock: available > 0,
            ndc: m.national_drug_code || "",
          });
        });

        // 2. Add any stock items that are pharmaceuticals or not yet in catalog
        stockItemsList.forEach((it) => {
          const code = it.item_code || it.item_name || "";
          if (!code) return;
          const codeKey = code.toLowerCase().trim();
          if (seenCodes.has(codeKey)) return;
          seenCodes.add(codeKey);

          const available = stockMap.get(codeKey) || 0;
          const rate = Number(it.standard_rate || it.valuation_rate || 0);

          catalogList.push({
            id: it.id || code,
            generic_name: it.item_name || code,
            item_name: it.item_name || code,
            item_code: code,
            strength: "",
            strength_uom: "mg",
            dosage_form_name: "Pharmaceutical",
            medication_class_name: it.item_group_name || "General",
            standard_rate: rate > 0 ? rate : 1.0,
            stock_uom: it.stock_uom || "Nos",
            available_qty: available,
            in_stock: available > 0,
          });
        });

        setUnifiedCatalog(catalogList);
        setDosageForms((dfRes.results || dfRes || []) as DosageForm[]);
        setMedClasses((mcRes.results || mcRes || []) as MedicationClass[]);
      })
      .finally(() => setLoadingData(false));
  }, []);

  // Row Manipulation
  const handleAddRow = () => {
    const newId = `row-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    setRows((prev) => [
      ...prev,
      {
        id: newId,
        item_code: "",
        item_name: "",
        dosage_form_name: "",
        strength: "",
        batch_no: "",
        expiry_date: "",
        quantity: 50,
        rate: 1.0,
        uom: "Nos",
        storage_condition: "Ambient (15-25°C)",
      },
    ]);
  };

  const handleAddMultipleRows = (count: number) => {
    const newRows: IntakeRow[] = [];
    for (let i = 0; i < count; i++) {
      newRows.push({
        id: `row-${Date.now()}-${i}-${Math.floor(Math.random() * 1000)}`,
        item_code: "",
        item_name: "",
        dosage_form_name: "",
        strength: "",
        batch_no: "",
        expiry_date: "",
        quantity: 50,
        rate: 1.0,
        uom: "Nos",
        storage_condition: "Ambient (15-25°C)",
      });
    }
    setRows((prev) => [...prev, ...newRows]);
    toast.info(`Added ${count} drug intake lines`);
  };

  const handleDuplicateRow = (index: number) => {
    const source = rows[index];
    const newRow: IntakeRow = {
      ...source,
      id: `row-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      batch_no: "",
    };
    setRows((prev) => {
      const copy = [...prev];
      copy.splice(index + 1, 0, newRow);
      return copy;
    });
    toast.success("Line duplicated for additional batch intake");
  };

  const handleRemoveRow = (index: number) => {
    if (rows.length <= 1) return;
    setRows((prev) => prev.filter((_, i) => i !== index));
  };

  const handleClearRow = (index: number) => {
    setRows((prev) => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        item_code: "",
        item_name: "",
        strength: "",
        dosage_form_name: "",
        batch_no: "",
        expiry_date: "",
        quantity: 50,
        rate: 1.0,
      };
      return copy;
    });
  };

  const handleClearEmptyRows = () => {
    const populated = rows.filter((r) => r.item_code.trim() || r.item_name.trim());
    if (populated.length === 0) {
      setRows([
        {
          id: `row-${Date.now()}-1`,
          item_code: "",
          item_name: "",
          dosage_form_name: "",
          strength: "",
          batch_no: "",
          expiry_date: "",
          quantity: 50,
          rate: 1.0,
          uom: "Nos",
          storage_condition: "Ambient (15-25°C)",
        },
      ]);
    } else {
      setRows(populated);
    }
    toast.info("Cleared blank rows");
  };

  const handleRowChange = (index: number, field: keyof IntakeRow, value: any) => {
    setRows((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleAutoGenerateLot = (index: number) => {
    const ym = new Date().toISOString().slice(2, 7).replace("-", "");
    const rand = Math.floor(100 + Math.random() * 900);
    handleRowChange(index, "batch_no", `LOT-${ym}-${rand}`);
  };

  const handleAutoGenerateAllLots = () => {
    const ym = new Date().toISOString().slice(2, 7).replace("-", "");
    setRows((prev) =>
      prev.map((r, i) => {
        if (!r.batch_no.trim()) {
          const rand = Math.floor(100 + Math.random() * 900) + i;
          return { ...r, batch_no: `LOT-${ym}-${rand}` };
        }
        return r;
      })
    );
    toast.success("Auto-generated missing batch numbers");
  };

  const handleBulkSetExpiry = (yearsToAdd: number) => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + yearsToAdd);
    const dateStr = d.toISOString().slice(0, 10);
    setRows((prev) =>
      prev.map((r) => {
        if (!r.expiry_date) {
          return { ...r, expiry_date: dateStr };
        }
        return r;
      })
    );
    toast.success(`Defaulted blank expiry dates to ${dateStr} (+${yearsToAdd}Y)`);
  };

  // Drug Selection from Picker
  const handleSelectMedication = (index: number, drug: UnifiedDrugItem) => {
    const code = drug.generic_name || drug.item_code;
    const name = drug.item_name || drug.generic_name || code;
    const rate = Number(drug.standard_rate || 1.0);
    const uom = drug.stock_uom || "Nos";
    const strength = drug.strength ? `${drug.strength}${drug.strength_uom || "mg"}` : "";
    const form = drug.dosage_form_name || "Tablet";

    setRows((prev) => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        item_code: code,
        item_name: name,
        strength,
        dosage_form_name: form,
        medication_class_name: drug.medication_class_name,
        rate: rate > 0 ? rate : copy[index].rate,
        uom: uom,
      };
      return copy;
    });
  };

  // Open Quick Add Modal
  const handleTriggerQuickAdd = (targetRowIndex: number | null, initialText: string = "") => {
    setQuickAddTargetRowIndex(targetRowIndex);
    setQuickAddInitialName(initialText.trim());
    setQuickAddOpen(true);
  };

  // When new drug is created from quick add
  const handleDrugCreated = (newDrug: any) => {
    const genName = newDrug.generic_name || "";
    const strength = newDrug.strength ? `${newDrug.strength}${newDrug.strength_uom || "mg"}` : "";
    const form = newDrug.dosage_form_name || "Tablet";
    const rate = Number(newDrug.standard_rate || 1.0);

    const unified: UnifiedDrugItem = {
      id: newDrug.id || genName,
      generic_name: genName,
      item_name: genName,
      item_code: genName,
      strength: newDrug.strength || "",
      strength_uom: newDrug.strength_uom || "mg",
      dosage_form_name: form,
      medication_class_name: newDrug.medication_class_name || "General",
      standard_rate: rate,
      stock_uom: "Nos",
      available_qty: 0,
      in_stock: false,
      ndc: newDrug.national_drug_code || "",
    };

    setUnifiedCatalog((prev) => [unified, ...prev]);

    // Select into row if requested
    if (quickAddTargetRowIndex !== null && quickAddTargetRowIndex >= 0 && quickAddTargetRowIndex < rows.length) {
      handleSelectMedication(quickAddTargetRowIndex, unified);
    } else {
      // Find first empty row or create new row
      const emptyIdx = rows.findIndex((r) => !r.item_code.trim() && !r.item_name.trim());
      if (emptyIdx !== -1) {
        handleSelectMedication(emptyIdx, unified);
      } else {
        const newId = `row-${Date.now()}`;
        setRows((prev) => [
          ...prev,
          {
            id: newId,
            item_code: genName,
            item_name: genName,
            dosage_form_name: form,
            strength,
            medication_class_name: unified.medication_class_name,
            batch_no: "",
            expiry_date: "",
            quantity: 50,
            rate: rate,
            uom: "Nos",
            storage_condition: "Ambient (15-25°C)",
          },
        ]);
      }
    }
  };

  // Metrics
  const totalUnits = rows.reduce((sum, r) => sum + (Number(r.quantity) || 0), 0);
  const totalValuation = rows.reduce(
    (sum, r) => sum + (Number(r.quantity) || 0) * (Number(r.rate) || 0),
    0
  );
  const validRowsCount = rows.filter((r) => (r.item_code.trim() || r.item_name.trim()) && r.quantity > 0).length;
  const coldChainCount = rows.filter((r) => r.storage_condition.toLowerCase().includes("cold") || r.storage_condition.toLowerCase().includes("freeze")).length;

  // Submit Handler
  const handleSubmitIntake = async () => {
    if (!targetWarehouseId) {
      toast.error("Please select a target pharmacy warehouse.");
      return;
    }
    if (entryType === "Material Transfer" && !sourceWarehouseId) {
      toast.error("Please select a source warehouse for transfer.");
      return;
    }
    if (entryType === "Material Transfer" && sourceWarehouseId === targetWarehouseId) {
      toast.error("Source and Target warehouse cannot be the same.");
      return;
    }

    const invalid = rows.find((r) => (!r.item_code.trim() && !r.item_name.trim()) || r.quantity <= 0);
    if (invalid) {
      toast.error("Please fill in medication name and positive quantity for all rows, or delete incomplete rows.");
      return;
    }

    setSaving(true);
    try {
      const payload: AddStockPayload = {
        warehouse_id: targetWarehouseId,
        entry_type: entryType,
        from_warehouse_id: entryType === "Material Transfer" ? sourceWarehouseId : null,
        supplier_name: supplierName.trim(),
        purchase_invoice_no: purchaseInvoiceNo.trim(),
        notes: `Received by: ${receivingOfficer}. Date: ${arrivalDate}. ${notes}`.trim(),
        update_item_rate: updateItemRate,
        items: rows.map((r) => ({
          item_code: r.item_code || r.item_name,
          item_name: r.item_name || r.item_code,
          quantity: Number(r.quantity),
          rate: Number(r.rate),
          batch_no: r.batch_no,
          expiry_date: r.expiry_date,
          uom: r.uom,
        })),
      };

      const res = await HealthcareApi.pharmacy.addStock(payload);
      setReceiptResult(res);
      toast.success("Stock Intake successfully committed to ledger!");
    } catch (err: any) {
      console.error(err);
      toast.error(err?.response?.data?.error || "Failed to commit stock intake into ledger.");
    } finally {
      setSaving(false);
    }
  };

  const handleResetForm = () => {
    setReceiptResult(null);
    setPurchaseInvoiceNo("");
    setNotes("");
    setRows([
      {
        id: `row-${Date.now()}-1`,
        item_code: "",
        item_name: "",
        dosage_form_name: "",
        strength: "",
        batch_no: "",
        expiry_date: "",
        quantity: 100,
        rate: 1.0,
        uom: "Nos",
        storage_condition: "Ambient (15-25°C)",
      },
    ]);
    toast.info("Form reset to blank shipment");
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-20">
      {/* Top Navigation Header */}
      <PharmacyNavHeader
        title="Pharmacy Inward Stock Intake Console"
        subtitle="Pharmaceutical inventory intake console with multi-batch ledger entries, supplier traceability, cold chain monitoring, and formulary synchronization."
        badge="Intake Dock"
        action={
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => handleTriggerQuickAdd(null, "")}
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-sm"
            >
              <Icon icon="solar:add-circle-bold" size={16} />
              + Add New Drug
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => navigate("/healthcare/pharmacy/stock")}
            >
              <Icon icon="solar:database-bold" size={16} />
              Stock Balances
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-muted-foreground"
              onClick={handleResetForm}
            >
              <Icon icon="solar:restart-bold" size={15} />
              Reset
            </Button>
          </div>
        }
      />

      {/* Post-Submission Success Screen */}
      {receiptResult ? (
        <Card className="border-emerald-500/30 bg-emerald-500/5">
          <CardContent className="pt-8 pb-8 space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/30">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-lg">
                  <Icon icon="solar:check-circle-bold" size={32} />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Tag color="green" className="font-bold uppercase tracking-wider text-xs">
                      STOCK ENTRY COMMITTED
                    </Tag>
                    <span className="text-xs font-mono text-muted-foreground">
                      Voucher: {receiptResult.stock_entry_number}
                    </span>
                  </div>
                  <h2 className="text-xl font-bold text-foreground">
                    Shipment Successfully Posted to Ledger
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">{receiptResult.message}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <Button
                  variant="outline"
                  onClick={() => navigate("/healthcare/pharmacy/stock")}
                  className="gap-1.5 text-xs h-9"
                >
                  <Icon icon="solar:database-bold" size={16} />
                  View Updated Balances
                </Button>
                <Button
                  onClick={handleResetForm}
                  className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-9 shadow-sm"
                >
                  <Icon icon="solar:add-circle-bold" size={16} />
                  Receive Another Shipment
                </Button>
              </div>
            </div>

            {/* Receipt Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-card border shadow-sm">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                  Voucher Number
                </span>
                <span className="text-lg font-mono font-bold text-emerald-600">
                  {receiptResult.stock_entry_number}
                </span>
              </div>
              <div className="p-4 rounded-xl bg-card border shadow-sm">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                  Warehouse
                </span>
                <span className="text-base font-semibold text-foreground">
                  {receiptResult.warehouse_name}
                </span>
              </div>
              <div className="p-4 rounded-xl bg-card border shadow-sm">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                  Total Received Units
                </span>
                <span className="text-lg font-mono font-bold text-foreground">
                  {receiptResult.total_qty} units
                </span>
              </div>
              <div className="p-4 rounded-xl bg-card border shadow-sm">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                  Total Valuation ($)
                </span>
                <span className="text-lg font-mono font-bold text-emerald-600 dark:text-emerald-400">
                  ${receiptResult.total_value.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Line items table */}
            <div className="border rounded-xl overflow-hidden bg-card shadow-sm">
              <div className="bg-muted/40 px-4 py-3 border-b flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                  Received Drug Lines & New Stock Balances
                </span>
                <span className="text-xs text-muted-foreground">{receiptResult.items.length} Lines</span>
              </div>
              <table className="w-full text-xs">
                <thead className="bg-muted/20 border-b text-muted-foreground font-semibold">
                  <tr className="text-left">
                    <th className="p-3">Medication Name</th>
                    <th className="p-3">Batch / Lot</th>
                    <th className="p-3 text-right">Qty Received</th>
                    <th className="p-3 text-right">Unit Rate ($)</th>
                    <th className="p-3 text-right">Line Total ($)</th>
                    <th className="p-3 text-right">New Warehouse Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {receiptResult.items.map((it, idx) => (
                    <tr key={idx} className="hover:bg-muted/10">
                      <td className="p-3 font-semibold text-foreground">{it.item_name}</td>
                      <td className="p-3 font-mono text-[11px] text-muted-foreground">{it.batch_no || "N/A"}</td>
                      <td className="p-3 text-right font-mono font-bold text-emerald-600">+{it.quantity}</td>
                      <td className="p-3 text-right font-mono">${it.rate.toFixed(2)}</td>
                      <td className="p-3 text-right font-mono font-semibold">${it.amount.toFixed(2)}</td>
                      <td className="p-3 text-right font-mono font-bold text-foreground">
                        {it.new_warehouse_balance} units
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Top Live Metrics Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border-border shadow-sm">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <span className="text-xs text-muted-foreground block font-medium">Configured Lines</span>
                  <div className="flex items-baseline gap-2 mt-0.5">
                    <span className="text-2xl font-bold font-mono text-foreground">{rows.length}</span>
                    <span className="text-xs text-muted-foreground">lines</span>
                  </div>
                  <span className="text-[11px] text-emerald-600 block mt-0.5">
                    {validRowsCount} ready to commit
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-primary/10 text-primary">
                  <Icon icon="solar:pills-bold-duotone" size={24} />
                </div>
              </CardContent>
            </Card>

            <Card className="border-border shadow-sm">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <span className="text-xs text-muted-foreground block font-medium">Total Inward Units</span>
                  <div className="flex items-baseline gap-2 mt-0.5">
                    <span className="text-2xl font-bold font-mono text-foreground">{totalUnits}</span>
                    <span className="text-xs text-muted-foreground">physical units</span>
                  </div>
                  <span className="text-[11px] text-muted-foreground block mt-0.5">Batch-counted sum</span>
                </div>
                <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-600">
                  <Icon icon="solar:box-bold-duotone" size={24} />
                </div>
              </CardContent>
            </Card>

            <Card className="border-border shadow-sm">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <span className="text-xs text-muted-foreground block font-medium">Shipment Valuation</span>
                  <div className="flex items-baseline gap-2 mt-0.5">
                    <span className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
                      ${totalValuation.toFixed(2)}
                    </span>
                  </div>
                  <span className="text-[11px] text-muted-foreground block mt-0.5">Purchase cost basis</span>
                </div>
                <div className="p-3 rounded-xl bg-amber-500/10 text-amber-600">
                  <Icon icon="solar:tag-price-bold-duotone" size={24} />
                </div>
              </CardContent>
            </Card>

            <Card className="border-border shadow-sm">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <span className="text-xs text-muted-foreground block font-medium">Storage & QA Protocol</span>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm font-bold text-foreground">
                      {coldChainCount > 0 ? `${coldChainCount} Cold Chain` : "Ambient"}
                    </span>
                    {coldChainCount > 0 && (
                      <Tag color="cyan" className="text-[10px] m-0 font-bold">
                        2-8°C
                      </Tag>
                    )}
                  </div>
                  <span className="text-[11px] text-muted-foreground block mt-0.5">
                    {entryType === "Material Receipt" ? "Direct Vendor Inward" : "Warehouse Transfer"}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-purple-500/10 text-purple-600">
                  <Icon icon="solar:shield-check-bold" size={24} />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Section 1: Shipment Header & Inward Configuration */}
          <Card className="shadow-sm">
            <CardHeader className="pb-3 border-b bg-muted/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon icon="solar:delivery-bold-duotone" size={20} className="text-emerald-600" />
                  <CardTitle className="text-base font-bold">1. Inward Shipment & Supplier Details</CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  <Tag color="blue" className="font-semibold text-xs">
                    {entryType === "Material Receipt" ? "DIRECT PURCHASE INWARD" : "CENTRAL TRANSFER"}
                  </Tag>
                </div>
              </div>
            </CardHeader>

            <CardContent className="pt-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Operation Mode */}
                <div>
                  <Label className="text-xs font-semibold mb-1.5 block">Operation Mode *</Label>
                  <select
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-medium"
                    value={entryType}
                    onChange={(e) => setEntryType(e.target.value as any)}
                  >
                    <option value="Material Receipt">Material Receipt (Supplier Purchase / Direct)</option>
                    <option value="Material Transfer">Material Transfer (Transfer from Central Store)</option>
                  </select>
                </div>

                {/* Target Warehouse */}
                <div>
                  <Label className="text-xs font-semibold mb-1.5 block">Target Pharmacy Warehouse *</Label>
                  <select
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-medium"
                    value={targetWarehouseId || ""}
                    onChange={(e) => setTargetWarehouseId(Number(e.target.value))}
                  >
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.warehouse_name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Source Warehouse if Transfer, or Supplier if Receipt */}
                {entryType === "Material Transfer" ? (
                  <div>
                    <Label className="text-xs font-semibold mb-1.5 block">Source Warehouse (Transfer From) *</Label>
                    <select
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-medium"
                      value={sourceWarehouseId || ""}
                      onChange={(e) => setSourceWarehouseId(Number(e.target.value))}
                    >
                      <option value="">Select source warehouse...</option>
                      {warehouses.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.warehouse_name}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div>
                    <Label className="text-xs font-semibold mb-1.5 block">Pharmaceutical Supplier / Vendor</Label>
                    <Input
                      placeholder="e.g. Novartis Global Distribution / Pfizer"
                      value={supplierName}
                      onChange={(e) => setSupplierName(e.target.value)}
                      className="h-9 text-xs"
                    />
                  </div>
                )}

                {/* Purchase Order / Invoice No */}
                <div>
                  <Label className="text-xs font-semibold mb-1.5 block">PO / Delivery Note Reference</Label>
                  <Input
                    placeholder="e.g. PINV-2026-9041 / GRN-811"
                    value={purchaseInvoiceNo}
                    onChange={(e) => setPurchaseInvoiceNo(e.target.value)}
                    className="h-9 text-xs font-mono font-medium"
                  />
                </div>
              </div>

              {/* Quick Supplier Chips */}
              {entryType === "Material Receipt" && (
                <div className="flex items-center gap-1.5 flex-wrap pt-1">
                  <span className="text-[11px] text-muted-foreground mr-1">Frequent Vendors:</span>
                  {COMMON_SUPPLIERS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSupplierName(s)}
                      className={cn(
                        "px-2.5 py-0.5 rounded-full text-[11px] font-medium transition-colors border",
                        supplierName === s
                          ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                          : "bg-muted/40 hover:bg-muted text-muted-foreground"
                      )}
                    >
                      {s.split(" ")[0]}
                    </button>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                <div>
                  <Label className="text-xs font-semibold mb-1.5 block">Date of Physical Arrival</Label>
                  <Input
                    type="date"
                    value={arrivalDate}
                    onChange={(e) => setArrivalDate(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold mb-1.5 block">Receiving Pharmacist / Officer</Label>
                  <Input
                    placeholder="e.g. Lead Pharmacist / QA Inspector"
                    value={receivingOfficer}
                    onChange={(e) => setReceivingOfficer(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold mb-1.5 block">QA Inspection & Cold Chain Notes</Label>
                  <Input
                    placeholder="e.g. Temperature data logger verified continuous 4.2°C during transit"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section 2: Drug Line Items & Batch Manifest */}
          <Card className="shadow-sm">
            <CardHeader className="pb-3 border-b bg-muted/20">
              <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600">
                    <Icon icon="solar:pills-bold-duotone" size={22} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base font-bold">2. Drug Line Items & Batch Manifest</CardTitle>
                      <Tag color="green" className="text-xs font-bold m-0">
                        {rows.length} Lines ({validRowsCount} Configured)
                      </Tag>
                      {loadingData && (
                        <Icon icon="solar:refresh-circle-bold" className="animate-spin text-muted-foreground" size={16} />
                      )}
                    </div>
                    <CardDescription className="text-xs text-muted-foreground mt-0.5">
                      Select medications from formulary catalog ({unifiedCatalog.length} loaded) or use{" "}
                      <span className="font-bold text-emerald-600">+ Add New Drug</span> to register unlisted items.
                    </CardDescription>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {/* Primary Add New Drug Action */}
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => handleTriggerQuickAdd(null, "")}
                    className="h-8 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-sm"
                  >
                    <Icon icon="solar:add-circle-bold" size={15} />
                    + Add New Drug
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddRow}
                    className="h-8 text-xs gap-1.5"
                  >
                    <Icon icon="solar:add-circle-bold" size={15} />
                    +1 Row
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleAddMultipleRows(5)}
                    className="h-8 text-xs gap-1.5"
                  >
                    <Icon icon="solar:playlist-minimalistic-bold" size={15} />
                    +5 Rows
                  </Button>

                  {/* Batch Actions */}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleAutoGenerateAllLots}
                    className="h-8 text-[11px] gap-1 text-muted-foreground hover:text-foreground"
                    title="Generate batch numbers for rows without a batch"
                  >
                    Auto Batch #
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleBulkSetExpiry(2)}
                    className="h-8 text-[11px] gap-1 text-muted-foreground hover:text-foreground"
                    title="Default blank expiry to +2 years from today"
                  >
                    Expiry (+2Y)
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleClearEmptyRows}
                    className="h-8 text-[11px] text-muted-foreground hover:text-destructive"
                    title="Clear blank rows"
                  >
                    Clear Empty
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/40 border-b text-muted-foreground font-semibold">
                    <tr className="text-left">
                      <th className="p-3 w-10 text-center">#</th>
                      <th className="p-3 min-w-[320px]">Medication (Search / Select / Add New)</th>
                      <th className="p-3 w-44">Batch / Lot No</th>
                      <th className="p-3 w-40">Expiration Date</th>
                      <th className="p-3 w-28 text-right">Quantity</th>
                      <th className="p-3 w-24">UOM</th>
                      <th className="p-3 w-28 text-right">Unit Rate ($)</th>
                      <th className="p-3 w-28 text-right">Line Total ($)</th>
                      <th className="p-3 w-44">Storage Condition</th>
                      <th className="p-3 w-20 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {rows.map((row, idx) => {
                      const lineTotal = (Number(row.quantity) || 0) * (Number(row.rate) || 0);
                      const isRowConfigured = Boolean(row.item_code.trim() || row.item_name.trim());

                      return (
                        <tr
                          key={row.id}
                          className={cn(
                            "hover:bg-muted/20 transition-colors",
                            !isRowConfigured && "bg-muted/5"
                          )}
                        >
                          {/* Row Number & Status Indicator */}
                          <td className="p-2.5 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <span className="text-[11px] font-mono text-muted-foreground font-semibold">
                                {idx + 1}
                              </span>
                              <div
                                className={cn(
                                  "h-2 w-2 rounded-full",
                                  isRowConfigured && row.quantity > 0
                                    ? "bg-emerald-500"
                                    : "bg-amber-400"
                                )}
                                title={
                                  isRowConfigured && row.quantity > 0
                                    ? "Valid Line"
                                    : "Incomplete Line"
                                }
                              />
                            </div>
                          </td>

                          {/* Searchable Drug Field with Popover (Zero clipping, rich search) */}
                          <td className="p-2.5">
                            <DrugPickerCell
                              row={row}
                              catalog={unifiedCatalog}
                              loading={loadingData}
                              onSelect={(drug) => handleSelectMedication(idx, drug)}
                              onTriggerQuickAdd={(text) => handleTriggerQuickAdd(idx, text)}
                              onClear={() => handleClearRow(idx)}
                            />
                          </td>

                          {/* Batch / Lot No */}
                          <td className="p-2.5">
                            <div className="flex items-center gap-1">
                              <Input
                                placeholder="e.g. LOT-2026A"
                                value={row.batch_no}
                                onChange={(e) => handleRowChange(idx, "batch_no", e.target.value)}
                                className={cn(
                                  "h-8 text-xs font-mono font-medium",
                                  !row.batch_no.trim() && "border-amber-500/40 bg-amber-500/5"
                                )}
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleAutoGenerateLot(idx)}
                                title="Auto-generate lot number"
                                className="h-8 px-2 text-[10px] text-muted-foreground hover:text-foreground shrink-0 border"
                              >
                                Auto
                              </Button>
                            </div>
                          </td>

                          {/* Expiration Date with fast helper buttons */}
                          <td className="p-2.5">
                            <div className="space-y-1">
                              <Input
                                type="date"
                                value={row.expiry_date}
                                onChange={(e) => handleRowChange(idx, "expiry_date", e.target.value)}
                                className="h-8 text-xs"
                              />
                              <div className="flex items-center gap-1">
                                {[1, 2, 3].map((y) => (
                                  <button
                                    key={y}
                                    type="button"
                                    onClick={() => {
                                      const d = new Date();
                                      d.setFullYear(d.getFullYear() + y);
                                      handleRowChange(idx, "expiry_date", d.toISOString().slice(0, 10));
                                    }}
                                    className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-muted/60 hover:bg-muted text-muted-foreground"
                                  >
                                    +{y}Y
                                  </button>
                                ))}
                              </div>
                            </div>
                          </td>

                          {/* Quantity */}
                          <td className="p-2.5">
                            <Input
                              type="number"
                              min="1"
                              value={row.quantity}
                              onChange={(e) => handleRowChange(idx, "quantity", Number(e.target.value))}
                              className="h-8 text-xs text-right font-mono font-bold text-foreground"
                            />
                          </td>

                          {/* UOM */}
                          <td className="p-2.5">
                            <select
                              className="w-full rounded border border-input bg-background px-2 py-1.5 text-xs font-medium"
                              value={row.uom}
                              onChange={(e) => handleRowChange(idx, "uom", e.target.value)}
                            >
                              {COMMON_UOMS.map((u) => (
                                <option key={u} value={u}>
                                  {u}
                                </option>
                              ))}
                            </select>
                          </td>

                          {/* Unit Rate ($) */}
                          <td className="p-2.5">
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              value={row.rate}
                              onChange={(e) => handleRowChange(idx, "rate", Number(e.target.value))}
                              className="h-8 text-xs text-right font-mono font-medium"
                            />
                          </td>

                          {/* Line Total ($) */}
                          <td className="p-2.5 text-right font-mono font-bold text-xs text-emerald-600 dark:text-emerald-400">
                            ${lineTotal.toFixed(2)}
                          </td>

                          {/* Storage Condition */}
                          <td className="p-2.5">
                            <select
                              className="w-full rounded border border-input bg-background px-2 py-1.5 text-[11px]"
                              value={row.storage_condition}
                              onChange={(e) => handleRowChange(idx, "storage_condition", e.target.value)}
                            >
                              {STORAGE_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          </td>

                          {/* Row Actions */}
                          <td className="p-2.5 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDuplicateRow(idx)}
                                title="Duplicate row for another batch"
                                className="h-7 w-7 p-0 text-muted-foreground hover:text-primary"
                              >
                                <Icon icon="solar:copy-bold" size={13} />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                disabled={rows.length <= 1}
                                onClick={() => handleRemoveRow(idx)}
                                title="Remove line"
                                className="h-7 w-7 p-0 text-muted-foreground hover:text-red-500"
                              >
                                <Icon icon="solar:trash-bin-minimalistic-bold" size={14} />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Table Footer Controls */}
              <div className="p-4 bg-muted/20 border-t flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4 flex-wrap">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddRow}
                    className="gap-1.5 text-xs text-emerald-600 border-emerald-500/30 hover:bg-emerald-50 dark:hover:bg-emerald-950"
                  >
                    <Icon icon="solar:add-circle-bold" size={14} />
                    Add Another Drug Line
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleTriggerQuickAdd(null, "")}
                    className="gap-1.5 text-xs text-emerald-600 hover:text-emerald-700 font-semibold"
                  >
                    <Icon icon="solar:pill-bold-duotone" size={14} />
                    + Add New Drug to Formulary
                  </Button>

                  <label className="flex items-center gap-2 cursor-pointer text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={updateItemRate}
                      onChange={(e) => setUpdateItemRate(e.target.checked)}
                      className="rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>Synchronize standard purchase rates into item master</span>
                  </label>
                </div>

                <div className="flex items-center gap-6 font-mono text-xs">
                  <div>
                    <span className="text-muted-foreground block text-[10px] uppercase">Total Units</span>
                    <span className="text-base font-bold text-foreground">{totalUnits}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px] uppercase">Total Value</span>
                    <span className="text-base font-bold text-emerald-600 dark:text-emerald-400">
                      ${totalValuation.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Sticky Bottom Action Footer */}
          <div className="sticky bottom-4 z-40 flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-card/95 backdrop-blur-md border shadow-xl">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600">
                <Icon icon="solar:shield-check-bold" size={24} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-foreground">
                  Ledger Posting: {entryType}
                </h4>
                <p className="text-xs text-muted-foreground">
                  Target: <span className="font-semibold text-foreground">{warehouses.find(w => w.id === targetWarehouseId)?.warehouse_name || "Pharmacy"}</span> • {validRowsCount} of {rows.length} lines configured
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <Button
                variant="outline"
                onClick={() => navigate("/healthcare/pharmacy/stock")}
                disabled={saving}
              >
                Cancel & Exit
              </Button>
              <Button
                onClick={handleSubmitIntake}
                disabled={saving || validRowsCount === 0}
                className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 shadow-md"
              >
                {saving ? (
                  <>
                    <Icon icon="solar:refresh-circle-bold" className="animate-spin" size={16} />
                    Committing Inward Stock...
                  </>
                ) : (
                  <>
                    <Icon icon="solar:check-circle-bold" size={16} />
                    Commit Inward Stock ({totalUnits} Units • ${totalValuation.toFixed(2)})
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Inline Quick Add Drug to Formulary Modal */}
      <QuickAddDrugModal
        open={quickAddOpen}
        onOpenChange={setQuickAddOpen}
        initialName={quickAddInitialName}
        dosageForms={dosageForms}
        medClasses={medClasses}
        onDrugCreated={handleDrugCreated}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DRUG PICKER CELL COMPONENT (Portaled Popover, No Table Clipping)
// ─────────────────────────────────────────────────────────────────────────────
interface DrugPickerCellProps {
  row: IntakeRow;
  catalog: UnifiedDrugItem[];
  loading: boolean;
  onSelect: (drug: UnifiedDrugItem) => void;
  onTriggerQuickAdd: (query: string) => void;
  onClear: () => void;
}

function DrugPickerCell({
  row,
  catalog,
  loading,
  onSelect,
  onTriggerQuickAdd,
  onClear,
}: DrugPickerCellProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("All");

  const isSelected = Boolean(row.item_code.trim() || row.item_name.trim());

  // Filtered drug options
  const filteredDrugs = useMemo(() => {
    const q = search.toLowerCase().trim();
    let list = catalog;

    if (activeCategory !== "All") {
      if (activeCategory === "In Stock") {
        list = list.filter((d) => d.in_stock);
      } else {
        list = list.filter(
          (d) =>
            d.dosage_form_name.toLowerCase().includes(activeCategory.toLowerCase()) ||
            d.medication_class_name.toLowerCase().includes(activeCategory.toLowerCase())
        );
      }
    }

    if (!q) {
      return list.slice(0, 30);
    }

    return list.filter((d) => {
      const g = d.generic_name.toLowerCase();
      const n = d.item_name.toLowerCase();
      const c = d.item_code.toLowerCase();
      const cls = d.medication_class_name.toLowerCase();
      const f = d.dosage_form_name.toLowerCase();
      const s = d.strength.toLowerCase();
      return g.includes(q) || n.includes(q) || c.includes(q) || cls.includes(q) || f.includes(q) || s.includes(q);
    });
  }, [catalog, search, activeCategory]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {isSelected ? (
          <div className="flex items-center justify-between p-1.5 rounded-lg border bg-card hover:bg-accent/40 cursor-pointer transition-colors group">
            <div className="flex items-center gap-2 min-w-0 pr-2">
              <div className="h-6 w-6 rounded bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
                <Icon icon="solar:pill-bold-duotone" size={14} />
              </div>
              <div className="truncate">
                <span className="font-bold text-foreground text-xs block truncate">
                  {row.item_name || row.item_code}
                </span>
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  {row.strength && <span className="font-semibold text-emerald-600">{row.strength}</span>}
                  {row.dosage_form_name && (
                    <>
                      <span>•</span>
                      <span>{row.dosage_form_name}</span>
                    </>
                  )}
                  {row.medication_class_name && (
                    <>
                      <span>•</span>
                      <span className="truncate">{row.medication_class_name}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onClear();
                }}
                className="h-5 w-5 rounded hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center text-xs"
                title="Clear selection"
              >
                <Icon icon="solar:close-circle-bold" size={13} />
              </button>
            </div>
          </div>
        ) : (
          <div className="relative">
            <button
              type="button"
              className="w-full h-8 px-2.5 rounded-md border border-input bg-background hover:bg-accent/50 text-left flex items-center justify-between text-xs text-muted-foreground transition-colors group"
            >
              <div className="flex items-center gap-2 truncate">
                <Icon icon="solar:magnifer-bold" size={14} className="text-muted-foreground" />
                <span className="truncate">Search drug by generic name...</span>
              </div>
              <Tag color="cyan" className="text-[10px] m-0 shrink-0">
                Formulary
              </Tag>
            </button>
          </div>
        )}
      </PopoverTrigger>

      <PopoverContent
        align="start"
        side="bottom"
        className="w-[460px] p-0 shadow-2xl rounded-xl overflow-hidden border z-50 bg-popover text-popover-foreground"
      >
        {/* Search Input Bar */}
        <div className="p-2.5 border-b bg-muted/20">
          <div className="relative">
            <Icon
              icon="solar:magnifer-bold"
              size={15}
              className="absolute left-2.5 top-2.5 text-muted-foreground"
            />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by generic name, brand, strength, or class..."
              className="h-9 pl-8 pr-8 text-xs font-medium"
              autoFocus
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
              >
                <Icon icon="solar:close-circle-bold" size={14} />
              </button>
            )}
          </div>

          {/* Formulary Category Filter Tabs */}
          <div className="flex items-center gap-1 mt-2 overflow-x-auto pb-0.5">
            {["All", "Tablet", "Capsule", "Injection", "Syrup", "In Stock"].map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat)}
                className={cn(
                  "px-2 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap transition-colors",
                  activeCategory === cat
                    ? "bg-emerald-600 text-white"
                    : "bg-muted hover:bg-muted/80 text-muted-foreground"
                )}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* PROMINENT TOP ACTION: + Add New Drug to Formulary */}
        <div className="p-2 border-b bg-emerald-500/5 dark:bg-emerald-500/10">
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onTriggerQuickAdd(search);
            }}
            className="w-full text-left p-2 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-800 dark:text-emerald-300 font-bold text-xs flex items-center justify-between transition-colors"
          >
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded bg-emerald-600 text-white flex items-center justify-center shrink-0">
                <Icon icon="solar:add-circle-bold" size={15} />
              </div>
              <div>
                <span>+ Add New Drug to Formulary</span>
                <span className="block text-[10px] font-normal text-muted-foreground">
                  {search.trim() ? `Register "${search.trim()}" into catalog` : "Create and register unlisted pharmaceutical"}
                </span>
              </div>
            </div>
            <Tag color="green" className="text-[10px] m-0 font-bold">
              New Drug
            </Tag>
          </button>
        </div>

        {/* Catalog Items List */}
        <div className="max-h-72 overflow-y-auto p-1.5 divide-y divide-border/50">
          {loading ? (
            <div className="p-6 text-center text-xs text-muted-foreground">
              <Icon icon="solar:refresh-circle-bold" className="animate-spin mx-auto mb-2 text-emerald-600" size={20} />
              Loading formulary catalog...
            </div>
          ) : filteredDrugs.length > 0 ? (
            filteredDrugs.map((drug) => (
              <button
                key={`${drug.id}-${drug.item_code}`}
                type="button"
                onClick={() => {
                  onSelect(drug);
                  setOpen(false);
                }}
                className="w-full text-left p-2 rounded-lg hover:bg-accent text-xs flex items-center justify-between group transition-colors"
              >
                <div className="min-w-0 pr-3">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-bold text-foreground">{drug.generic_name}</span>
                    {drug.item_name && drug.item_name !== drug.generic_name && (
                      <span className="text-[11px] text-muted-foreground">({drug.item_name})</span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mt-0.5 flex-wrap">
                    {drug.strength && (
                      <Tag color="blue" className="text-[9px] m-0 px-1 py-0">
                        {drug.strength}
                        {drug.strength_uom}
                      </Tag>
                    )}
                    <Tag color="cyan" className="text-[9px] m-0 px-1 py-0">
                      {drug.dosage_form_name}
                    </Tag>
                    {drug.medication_class_name && (
                      <span className="text-muted-foreground">{drug.medication_class_name}</span>
                    )}
                    <span>•</span>
                    <span className={drug.in_stock ? "text-emerald-600 font-semibold" : "text-amber-500 font-medium"}>
                      {drug.in_stock ? `${drug.available_qty} in stock` : "0 on hand"}
                    </span>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="font-mono font-bold text-xs text-emerald-600 dark:text-emerald-400 block">
                    ${Number(drug.standard_rate || 0).toFixed(2)}
                  </span>
                  <span className="text-[10px] text-muted-foreground">/ {drug.stock_uom}</span>
                </div>
              </button>
            ))
          ) : (
            <div className="p-6 text-center text-xs space-y-3">
              <div className="p-3 rounded-2xl bg-muted/40 w-fit mx-auto text-muted-foreground">
                <Icon icon="solar:magnifer-broken" size={24} />
              </div>
              <div>
                <p className="font-semibold text-foreground">
                  No medication matching "{search}"
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Would you like to register this drug now into your formulary?
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => {
                  setOpen(false);
                  onTriggerQuickAdd(search);
                }}
                className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs"
              >
                <Icon icon="solar:add-circle-bold" size={14} />
                + Add "{search || "New Drug"}" Now
              </Button>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="p-2 border-t bg-muted/20 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>Showing {filteredDrugs.length} of {catalog.length} formulary items</span>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onTriggerQuickAdd("");
            }}
            className="text-emerald-600 hover:underline font-semibold"
          >
            + New Drug
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
