import { useState, useEffect } from "react";
import { Icon } from "@/components/icon";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/ui/dialog";
import {
  HealthcareApi,
  type AddStockPayload,
  type AddStockResponse,
  type PharmacyStockBalance,
} from "@/api/services/healthcareService";
import type { Warehouse } from "@/api/services/erpService";

interface AddStockModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  warehouses: Warehouse[];
  currentWarehouseId: number | null;
  onSuccess: () => void;
  stockCatalog?: PharmacyStockBalance[];
}

interface ItemRow {
  item_code: string;
  item_name: string;
  quantity: number;
  rate: number;
  batch_no: string;
  expiry_date: string;
  uom: string;
}

export default function AddStockModal({
  open,
  onOpenChange,
  warehouses,
  currentWarehouseId,
  onSuccess,
  stockCatalog = [],
}: AddStockModalProps) {
  const [targetWarehouseId, setTargetWarehouseId] = useState<number>(0);
  const [entryType, setEntryType] = useState<"Material Receipt" | "Material Transfer">("Material Receipt");
  const [sourceWarehouseId, setSourceWarehouseId] = useState<number>(0);
  const [supplierName, setSupplierName] = useState("");
  const [purchaseInvoiceNo, setPurchaseInvoiceNo] = useState("");
  const [notes, setNotes] = useState("");
  const [updateItemRate, setUpdateItemRate] = useState(true);

  const [items, setItems] = useState<ItemRow[]>([
    {
      item_code: "",
      item_name: "",
      quantity: 100,
      rate: 1.0,
      batch_no: "",
      expiry_date: "",
      uom: "Nos",
    },
  ]);

  const [saving, setSaving] = useState(false);
  const [receiptResult, setReceiptResult] = useState<AddStockResponse | null>(null);

  // Initialize target warehouse
  useEffect(() => {
    if (open) {
      setReceiptResult(null);
      if (currentWarehouseId) {
        setTargetWarehouseId(currentWarehouseId);
      } else if (warehouses.length > 0) {
        const pharm = warehouses.find((w) => w.warehouse_name.toLowerCase().includes("pharmacy"));
        setTargetWarehouseId(pharm ? pharm.id : warehouses[0].id);
      }
      // Pick source warehouse if transfer
      if (warehouses.length > 1) {
        const other = warehouses.find((w) => w.id !== currentWarehouseId);
        if (other) setSourceWarehouseId(other.id);
      }
    }
  }, [open, currentWarehouseId, warehouses]);

  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      {
        item_code: "",
        item_name: "",
        quantity: 50,
        rate: 1.0,
        batch_no: "",
        expiry_date: "",
        uom: "Nos",
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: keyof ItemRow, value: any) => {
    setItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleSelectPredefinedDrug = (index: number, code: string) => {
    const found = stockCatalog.find((s) => s.item_code === code);
    if (found) {
      setItems((prev) => {
        const copy = [...prev];
        copy[index] = {
          ...copy[index],
          item_code: found.item_code,
          item_name: found.item_name,
          rate: Number(found.valuation_rate || 1.0),
          uom: found.stock_uom || "Nos",
        };
        return copy;
      });
    } else {
      handleItemChange(index, "item_code", code);
      handleItemChange(index, "item_name", code);
    }
  };

  const totalQty = items.reduce((sum, it) => sum + (Number(it.quantity) || 0), 0);
  const totalValue = items.reduce(
    (sum, it) => sum + (Number(it.quantity) || 0) * (Number(it.rate) || 0),
    0
  );

  const handleSubmit = async () => {
    if (!targetWarehouseId) {
      alert("Please select a target warehouse.");
      return;
    }
    if (entryType === "Material Transfer" && !sourceWarehouseId) {
      alert("Please select a source warehouse for transfer.");
      return;
    }
    if (entryType === "Material Transfer" && sourceWarehouseId === targetWarehouseId) {
      alert("Source and Target warehouse cannot be the same.");
      return;
    }

    const invalidRow = items.find((it) => !it.item_code.trim() || it.quantity <= 0);
    if (invalidRow) {
      alert("Please fill in medication name and positive quantity for all items.");
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
        notes: notes.trim(),
        update_item_rate: updateItemRate,
        items: items.map((it) => ({
          item_code: it.item_code,
          item_name: it.item_name || it.item_code,
          quantity: Number(it.quantity),
          rate: Number(it.rate),
          batch_no: it.batch_no,
          expiry_date: it.expiry_date,
          uom: it.uom,
        })),
      };

      const res = await HealthcareApi.pharmacy.addStock(payload);
      setReceiptResult(res);
      onSuccess();
    } catch (err: any) {
      console.error(err);
      alert(err?.response?.data?.error || "Failed to receive stock into pharmacy ledger.");
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setReceiptResult(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Icon icon="solar:box-bold-duotone" size={24} />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">
                Add Pharmacy Stock (Inward Receipt / Purchase / Transfer)
              </DialogTitle>
              <p className="text-xs text-muted-foreground">
                Incorporate new medication batches into the hospital stock ledger according to Marley's inventory rules.
              </p>
            </div>
          </div>
        </DialogHeader>

        {receiptResult ? (
          <div className="space-y-4 py-4">
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-200">
              <div className="flex items-center gap-3 mb-2">
                <Icon icon="solar:check-circle-bold" size={24} className="text-emerald-600" />
                <h4 className="font-bold text-base">Inward Stock Voucher Created Successfully</h4>
              </div>
              <p className="text-xs">{receiptResult.message}</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 text-xs">
                <div className="bg-background/80 p-2.5 rounded-lg border">
                  <span className="text-muted-foreground block text-[10px] uppercase font-bold">Voucher No</span>
                  <span className="font-mono font-bold text-sm text-foreground">{receiptResult.stock_entry_number}</span>
                </div>
                <div className="bg-background/80 p-2.5 rounded-lg border">
                  <span className="text-muted-foreground block text-[10px] uppercase font-bold">Warehouse</span>
                  <span className="font-semibold text-foreground">{receiptResult.warehouse_name}</span>
                </div>
                <div className="bg-background/80 p-2.5 rounded-lg border">
                  <span className="text-muted-foreground block text-[10px] uppercase font-bold">Total Qty</span>
                  <span className="font-mono font-bold text-foreground">{receiptResult.total_qty} units</span>
                </div>
                <div className="bg-background/80 p-2.5 rounded-lg border">
                  <span className="text-muted-foreground block text-[10px] uppercase font-bold">Total Value</span>
                  <span className="font-mono font-bold text-foreground">${receiptResult.total_value.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <div className="bg-muted/40 px-3 py-2 text-xs font-semibold">Received Medication Line Details</div>
              <table className="w-full text-xs">
                <thead className="bg-muted/20 border-b">
                  <tr className="text-left text-muted-foreground">
                    <th className="p-2">Medication</th>
                    <th className="p-2">Batch No</th>
                    <th className="p-2 text-right">Qty</th>
                    <th className="p-2 text-right">Unit Rate</th>
                    <th className="p-2 text-right">Line Total</th>
                    <th className="p-2 text-right">New Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {receiptResult.items.map((it, idx) => (
                    <tr key={idx}>
                      <td className="p-2 font-medium">{it.item_name}</td>
                      <td className="p-2 font-mono text-[11px] text-muted-foreground">{it.batch_no || "N/A"}</td>
                      <td className="p-2 text-right font-mono font-bold text-emerald-600">{it.quantity}</td>
                      <td className="p-2 text-right font-mono">${it.rate.toFixed(2)}</td>
                      <td className="p-2 text-right font-mono font-semibold">${it.amount.toFixed(2)}</td>
                      <td className="p-2 text-right font-mono font-bold">{it.new_warehouse_balance}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <DialogFooter>
              <Button onClick={handleClose} className="w-full sm:w-auto">
                Close & Return to Stock Balances
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-5 py-2">
            {/* Header controls: Target warehouse & Entry type */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-xl bg-muted/30 border">
              <div>
                <Label className="text-xs font-semibold mb-1 block">Inward Operation Type</Label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs"
                  value={entryType}
                  onChange={(e) => setEntryType(e.target.value as any)}
                >
                  <option value="Material Receipt">Material Receipt (Supplier Purchase / Direct)</option>
                  <option value="Material Transfer">Material Transfer (Transfer from Central Store)</option>
                </select>
              </div>

              {entryType === "Material Transfer" ? (
                <div>
                  <Label className="text-xs font-semibold mb-1 block">Source Warehouse (Transfer From)</Label>
                  <select
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs"
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
                  <Label className="text-xs font-semibold mb-1 block">Supplier / Vendor</Label>
                  <Input
                    placeholder="e.g. Pfizer Pharmaceuticals Ltd"
                    value={supplierName}
                    onChange={(e) => setSupplierName(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
              )}

              <div>
                <Label className="text-xs font-semibold mb-1 block">Target Pharmacy Warehouse</Label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs"
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
            </div>

            {/* Reference info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-semibold mb-1 block">Purchase Order / Invoice Reference</Label>
                <Input
                  placeholder="e.g. PINV-2026-8819 / PO-4902"
                  value={purchaseInvoiceNo}
                  onChange={(e) => setPurchaseInvoiceNo(e.target.value)}
                  className="h-9 text-xs font-mono"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold mb-1 block">Inward Receipt Notes</Label>
                <Input
                  placeholder="e.g. Scheduled emergency ward replenishment"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
            </div>

            {/* Items Table */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Medications & Quantities to Receive
                </Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddItem}
                  className="h-7 text-xs gap-1 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/10"
                >
                  <Icon icon="solar:add-circle-bold" size={14} />
                  Add Medication Row
                </Button>
              </div>

              <div className="border rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 border-b text-muted-foreground font-semibold">
                    <tr>
                      <th className="p-2.5 text-left w-64">Drug / Formulation</th>
                      <th className="p-2.5 text-left w-36">Batch / Lot No</th>
                      <th className="p-2.5 text-left w-32">Expiry Date</th>
                      <th className="p-2.5 text-right w-24">Quantity</th>
                      <th className="p-2.5 text-right w-24">Unit Rate ($)</th>
                      <th className="p-2.5 text-right w-24">Total ($)</th>
                      <th className="p-2.5 text-center w-12">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {items.map((row, idx) => {
                      const lineTotal = (Number(row.quantity) || 0) * (Number(row.rate) || 0);
                      return (
                        <tr key={idx} className="hover:bg-muted/20">
                          <td className="p-2">
                            {stockCatalog.length > 0 ? (
                              <div className="space-y-1">
                                <input
                                  list={`drug-list-${idx}`}
                                  placeholder="Select or type medication..."
                                  value={row.item_code}
                                  onChange={(e) => handleSelectPredefinedDrug(idx, e.target.value)}
                                  className="w-full rounded border px-2 py-1.5 text-xs bg-background"
                                />
                                <datalist id={`drug-list-${idx}`}>
                                  {stockCatalog.map((s) => (
                                    <option key={s.item_id} value={s.item_code}>
                                      {s.item_name}
                                    </option>
                                  ))}
                                </datalist>
                              </div>
                            ) : (
                              <Input
                                placeholder="Medication code or generic name"
                                value={row.item_code}
                                onChange={(e) => {
                                  handleItemChange(idx, "item_code", e.target.value);
                                  handleItemChange(idx, "item_name", e.target.value);
                                }}
                                className="h-8 text-xs"
                              />
                            )}
                          </td>
                          <td className="p-2">
                            <Input
                              placeholder="e.g. BATCH-2026A"
                              value={row.batch_no}
                              onChange={(e) => handleItemChange(idx, "batch_no", e.target.value)}
                              className="h-8 text-xs font-mono"
                            />
                          </td>
                          <td className="p-2">
                            <Input
                              type="date"
                              value={row.expiry_date}
                              onChange={(e) => handleItemChange(idx, "expiry_date", e.target.value)}
                              className="h-8 text-xs"
                            />
                          </td>
                          <td className="p-2">
                            <Input
                              type="number"
                              min="1"
                              value={row.quantity}
                              onChange={(e) => handleItemChange(idx, "quantity", Number(e.target.value))}
                              className="h-8 text-xs text-right font-mono font-bold"
                            />
                          </td>
                          <td className="p-2">
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              value={row.rate}
                              onChange={(e) => handleItemChange(idx, "rate", Number(e.target.value))}
                              className="h-8 text-xs text-right font-mono"
                            />
                          </td>
                          <td className="p-2 text-right font-mono font-semibold text-foreground">
                            ${lineTotal.toFixed(2)}
                          </td>
                          <td className="p-2 text-center">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              disabled={items.length <= 1}
                              onClick={() => handleRemoveItem(idx)}
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-red-500"
                            >
                              <Icon icon="solar:trash-bin-minimalistic-bold" size={14} />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Bottom summary and options */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl bg-muted/20 border">
              <label className="flex items-center gap-2 cursor-pointer text-xs">
                <input
                  type="checkbox"
                  checked={updateItemRate}
                  onChange={(e) => setUpdateItemRate(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span>Update master standard valuation rate for items if cost changed</span>
              </label>

              <div className="flex items-center gap-6 font-mono text-xs">
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase">Total Units</span>
                  <span className="text-sm font-bold text-foreground">{totalQty}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase">Total Value</span>
                  <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                    ${totalValue.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={handleClose} disabled={saving}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={saving}
                className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {saving ? (
                  <>
                    <Icon icon="solar:refresh-circle-bold" className="animate-spin" size={16} />
                    Posting to Stock Ledger...
                  </>
                ) : (
                  <>
                    <Icon icon="solar:check-circle-bold" size={16} />
                    Post Inward Stock ({totalQty} units)
                  </>
                )}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
