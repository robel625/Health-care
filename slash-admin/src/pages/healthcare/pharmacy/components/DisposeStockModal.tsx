import { useState, useEffect } from "react";
import { Icon } from "@/components/icon";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/ui/dialog";
import {
  HealthcareApi,
  type DisposeStockPayload,
  type DisposeStockResponse,
  type PharmacyStockBalance,
} from "@/api/services/healthcareService";
import type { Warehouse } from "@/api/services/erpService";

interface DisposeStockModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  warehouses: Warehouse[];
  currentWarehouseId: number | null;
  onSuccess: () => void;
  stockCatalog?: PharmacyStockBalance[];
  preselectedItem?: PharmacyStockBalance | null;
}

interface DisposeItemRow {
  item_code: string;
  item_name: string;
  available_qty: number;
  quantity: number;
  rate: number;
  batch_no: string;
  reason: string;
  disposal_method: string;
}

export default function DisposeStockModal({
  open,
  onOpenChange,
  warehouses,
  currentWarehouseId,
  onSuccess,
  stockCatalog = [],
  preselectedItem = null,
}: DisposeStockModalProps) {
  const [warehouseId, setWarehouseId] = useState<number>(0);
  const [certNo, setCertNo] = useState("");
  const [authorizedBy, setAuthorizedBy] = useState("Chief Pharmacist");
  const [witnessName, setWitnessName] = useState("QA Compliance Officer");
  const [defaultReason, setDefaultReason] = useState("Expired");
  const [defaultMethod, setDefaultMethod] = useState("Incineration");
  const [notes, setNotes] = useState("");

  const [items, setItems] = useState<DisposeItemRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [disposalResult, setDisposalResult] = useState<DisposeStockResponse | null>(null);

  // Initialize
  useEffect(() => {
    if (open) {
      setDisposalResult(null);
      const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      const rand = Math.floor(1000 + Math.random() * 9000);
      setCertNo(`CERT-DISP-${todayStr}-${rand}`);

      const whId = currentWarehouseId || (warehouses.length > 0 ? warehouses[0].id : 0);
      setWarehouseId(whId);

      if (preselectedItem) {
        setItems([
          {
            item_code: preselectedItem.item_code,
            item_name: preselectedItem.item_name,
            available_qty: Number(preselectedItem.actual_qty || 0),
            quantity: Math.min(10, Math.max(1, Number(preselectedItem.actual_qty || 0))),
            rate: Number(preselectedItem.valuation_rate || 0),
            batch_no: "",
            reason: "Expired",
            disposal_method: "Incineration",
          },
        ]);
      } else {
        setItems([
          {
            item_code: "",
            item_name: "",
            available_qty: 0,
            quantity: 1,
            rate: 0,
            batch_no: "",
            reason: "Expired",
            disposal_method: "Incineration",
          },
        ]);
      }
    }
  }, [open, currentWarehouseId, warehouses, preselectedItem]);

  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      {
        item_code: "",
        item_name: "",
        available_qty: 0,
        quantity: 1,
        rate: 0,
        batch_no: "",
        reason: defaultReason,
        disposal_method: defaultMethod,
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: keyof DisposeItemRow, value: any) => {
    setItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleSelectDrug = (index: number, code: string) => {
    const found = stockCatalog.find((s) => s.item_code === code);
    if (found) {
      setItems((prev) => {
        const copy = [...prev];
        copy[index] = {
          ...copy[index],
          item_code: found.item_code,
          item_name: found.item_name,
          available_qty: Number(found.actual_qty || 0),
          rate: Number(found.valuation_rate || 0),
          quantity: Math.min(copy[index].quantity || 1, Math.max(1, Number(found.actual_qty || 0))),
        };
        return copy;
      });
    } else {
      handleItemChange(index, "item_code", code);
      handleItemChange(index, "item_name", code);
    }
  };

  const totalQty = items.reduce((sum, it) => sum + (Number(it.quantity) || 0), 0);
  const totalLoss = items.reduce(
    (sum, it) => sum + (Number(it.quantity) || 0) * (Number(it.rate) || 0),
    0
  );

  const handleSubmit = async () => {
    if (!warehouseId) {
      alert("Please select the pharmacy warehouse.");
      return;
    }

    const invalidRow = items.find(
      (it) => !it.item_code.trim() || it.quantity <= 0 || it.quantity > it.available_qty
    );
    if (invalidRow) {
      if (invalidRow.quantity > invalidRow.available_qty) {
        alert(
          `Cannot write off ${invalidRow.quantity} units of ${invalidRow.item_name}. Only ${invalidRow.available_qty} available in warehouse.`
        );
      } else {
        alert("Please specify a valid medication and positive quantity for all items.");
      }
      return;
    }

    setSaving(true);
    try {
      const payload: DisposeStockPayload = {
        warehouse_id: warehouseId,
        disposal_certificate_no: certNo.trim(),
        authorized_by: authorizedBy.trim(),
        witness_name: witnessName.trim(),
        reason: defaultReason,
        disposal_method: defaultMethod,
        notes: notes.trim(),
        items: items.map((it) => ({
          item_code: it.item_code,
          item_name: it.item_name,
          quantity: Number(it.quantity),
          batch_no: it.batch_no,
          reason: it.reason || defaultReason,
          disposal_method: it.disposal_method || defaultMethod,
        })),
      };

      const res = await HealthcareApi.pharmacy.disposeExpired(payload);
      setDisposalResult(res);
      onSuccess();
    } catch (err: any) {
      console.error(err);
      alert(err?.response?.data?.error || "Failed to execute expired drug disposal.");
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setDisposalResult(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400">
              <Icon icon="solar:trash-bin-trash-bold-duotone" size={24} />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">
                Expired Drug Write-off & Disposal (Material Issue)
              </DialogTitle>
              <p className="text-xs text-muted-foreground">
                Permanently decommission expired, broken, or contaminated drugs from the stock ledger with audit-compliant disposal certificates.
              </p>
            </div>
          </div>
        </DialogHeader>

        {disposalResult ? (
          <div className="space-y-4 py-4">
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-800 dark:text-rose-200">
              <div className="flex items-center gap-3 mb-2">
                <Icon icon="solar:verified-check-bold" size={24} className="text-rose-600" />
                <h4 className="font-bold text-base">Disposal Certificate & Material Issue Voucher Created</h4>
              </div>
              <p className="text-xs">{disposalResult.message}</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 text-xs">
                <div className="bg-background/80 p-2.5 rounded-lg border">
                  <span className="text-muted-foreground block text-[10px] uppercase font-bold">Certificate No</span>
                  <span className="font-mono font-bold text-xs text-rose-600">{disposalResult.disposal_certificate_no}</span>
                </div>
                <div className="bg-background/80 p-2.5 rounded-lg border">
                  <span className="text-muted-foreground block text-[10px] uppercase font-bold">Voucher No</span>
                  <span className="font-mono font-bold text-xs text-foreground">{disposalResult.stock_entry_number}</span>
                </div>
                <div className="bg-background/80 p-2.5 rounded-lg border">
                  <span className="text-muted-foreground block text-[10px] uppercase font-bold">Qty Disposed</span>
                  <span className="font-mono font-bold text-foreground">{disposalResult.total_qty_disposed} units</span>
                </div>
                <div className="bg-background/80 p-2.5 rounded-lg border">
                  <span className="text-muted-foreground block text-[10px] uppercase font-bold">Loss Written Off</span>
                  <span className="font-mono font-bold text-rose-600 dark:text-rose-400">
                    ${disposalResult.total_loss_value.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <div className="bg-muted/40 px-3 py-2 text-xs font-semibold">Decommissioned Medication Lines</div>
              <table className="w-full text-xs">
                <thead className="bg-muted/20 border-b">
                  <tr className="text-left text-muted-foreground">
                    <th className="p-2">Medication</th>
                    <th className="p-2">Reason</th>
                    <th className="p-2">Method</th>
                    <th className="p-2 text-right">Written-off Qty</th>
                    <th className="p-2 text-right">Unit Rate</th>
                    <th className="p-2 text-right">Loss Amount</th>
                    <th className="p-2 text-right">Remaining Stock</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {disposalResult.items.map((it, idx) => (
                    <tr key={idx}>
                      <td className="p-2 font-medium">{it.item_name}</td>
                      <td className="p-2 text-rose-600 font-semibold">{it.reason}</td>
                      <td className="p-2 text-muted-foreground">{it.disposal_method}</td>
                      <td className="p-2 text-right font-mono font-bold text-rose-600">-{it.quantity}</td>
                      <td className="p-2 text-right font-mono">${it.rate.toFixed(2)}</td>
                      <td className="p-2 text-right font-mono font-semibold">${it.writeoff_value.toFixed(2)}</td>
                      <td className="p-2 text-right font-mono font-bold">{it.remaining_warehouse_balance}</td>
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
            {/* Header controls: Warehouse, Certificate, Authorizer */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-xl bg-muted/30 border">
              <div>
                <Label className="text-xs font-semibold mb-1 block">Pharmacy Warehouse</Label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs"
                  value={warehouseId || ""}
                  onChange={(e) => setWarehouseId(Number(e.target.value))}
                >
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.warehouse_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label className="text-xs font-semibold mb-1 block">Disposal Certificate No.</Label>
                <Input
                  value={certNo}
                  onChange={(e) => setCertNo(e.target.value)}
                  className="h-9 text-xs font-mono font-semibold text-rose-600"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold mb-1 block">Authorized Pharmacist</Label>
                <Input
                  value={authorizedBy}
                  onChange={(e) => setAuthorizedBy(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
            </div>

            {/* Protocol options */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label className="text-xs font-semibold mb-1 block">Disposal Reason</Label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs"
                  value={defaultReason}
                  onChange={(e) => setDefaultReason(e.target.value)}
                >
                  <option value="Expired">Expired Stock</option>
                  <option value="Damaged / Broken Ampoule">Damaged / Broken Ampoule</option>
                  <option value="Recalled / Quarantine">Recalled / Quarantine</option>
                  <option value="Cold Chain Failure">Cold Chain Failure (Refrigeration Alert)</option>
                  <option value="Contaminated">Contaminated / Deteriorated</option>
                </select>
              </div>

              <div>
                <Label className="text-xs font-semibold mb-1 block">Disposal Method</Label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs"
                  value={defaultMethod}
                  onChange={(e) => setDefaultMethod(e.target.value)}
                >
                  <option value="Incineration">Incineration (High-Temp Medical Furnace)</option>
                  <option value="Chemical Inactivation">Chemical Inactivation / Neutralization</option>
                  <option value="Biohazard Waste Disposal">Biohazard Waste Autoclave & Disposal</option>
                  <option value="Deep Burial / Landfill">Deep Burial / Landfill</option>
                  <option value="Return to Supplier">Return to Manufacturer / Supplier</option>
                </select>
              </div>

              <div>
                <Label className="text-xs font-semibold mb-1 block">QA Inspector / Witness</Label>
                <Input
                  value={witnessName}
                  onChange={(e) => setWitnessName(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold mb-1 block">Audit & Quarantine Notes</Label>
              <Input
                placeholder="e.g. Expired batch pulled from cold storage during bi-weekly QA inspection"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="h-9 text-xs"
              />
            </div>

            {/* Items Table */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Drugs to Write-off & Scrap
                </Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddItem}
                  className="h-7 text-xs gap-1 text-rose-600 border-rose-500/30 hover:bg-rose-500/10"
                >
                  <Icon icon="solar:add-circle-bold" size={14} />
                  Add Drug Line
                </Button>
              </div>

              <div className="border rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 border-b text-muted-foreground font-semibold">
                    <tr>
                      <th className="p-2.5 text-left w-64">Medication</th>
                      <th className="p-2.5 text-left w-36">Batch / Lot</th>
                      <th className="p-2.5 text-right w-24">Available</th>
                      <th className="p-2.5 text-right w-28">Write-off Qty</th>
                      <th className="p-2.5 text-right w-24">Unit Rate ($)</th>
                      <th className="p-2.5 text-right w-24">Loss Value ($)</th>
                      <th className="p-2.5 text-center w-12">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {items.map((row, idx) => {
                      const lineLoss = (Number(row.quantity) || 0) * (Number(row.rate) || 0);
                      const isOver = row.quantity > row.available_qty;
                      return (
                        <tr key={idx} className="hover:bg-muted/20">
                          <td className="p-2">
                            {stockCatalog.length > 0 ? (
                              <div className="space-y-1">
                                <input
                                  list={`drug-disp-list-${idx}`}
                                  placeholder="Select drug in stock..."
                                  value={row.item_code}
                                  onChange={(e) => handleSelectDrug(idx, e.target.value)}
                                  className="w-full rounded border px-2 py-1.5 text-xs bg-background"
                                />
                                <datalist id={`drug-disp-list-${idx}`}>
                                  {stockCatalog
                                    .filter((s) => !warehouseId || s.warehouse_id === warehouseId)
                                    .map((s) => (
                                      <option key={s.item_id} value={s.item_code}>
                                        {s.item_name} ({s.actual_qty} {s.stock_uom} available)
                                      </option>
                                    ))}
                                </datalist>
                              </div>
                            ) : (
                              <Input
                                placeholder="Medication code"
                                value={row.item_code}
                                onChange={(e) => handleItemChange(idx, "item_code", e.target.value)}
                                className="h-8 text-xs"
                              />
                            )}
                          </td>
                          <td className="p-2">
                            <Input
                              placeholder="Batch no."
                              value={row.batch_no}
                              onChange={(e) => handleItemChange(idx, "batch_no", e.target.value)}
                              className="h-8 text-xs font-mono"
                            />
                          </td>
                          <td className="p-2 text-right font-mono text-muted-foreground">
                            {row.available_qty}
                          </td>
                          <td className="p-2">
                            <Input
                              type="number"
                              min="1"
                              max={row.available_qty || undefined}
                              value={row.quantity}
                              onChange={(e) => handleItemChange(idx, "quantity", Number(e.target.value))}
                              className={`h-8 text-xs text-right font-mono font-bold ${
                                isOver ? "border-red-500 text-red-500" : "text-rose-600"
                              }`}
                            />
                            {isOver && (
                              <p className="text-[10px] text-red-500 text-right mt-0.5">Exceeds available</p>
                            )}
                          </td>
                          <td className="p-2 text-right font-mono text-muted-foreground">
                            ${row.rate.toFixed(2)}
                          </td>
                          <td className="p-2 text-right font-mono font-bold text-rose-600">
                            ${lineLoss.toFixed(2)}
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

            {/* Warning Banner & Totals */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-200">
              <div className="flex items-center gap-2 text-xs">
                <Icon icon="solar:danger-triangle-bold" size={20} className="text-amber-500 shrink-0" />
                <span>
                  Material Issue entry will immediately write off these quantities from the stock ledger and close out batch numbers.
                </span>
              </div>

              <div className="flex items-center gap-6 font-mono text-xs shrink-0">
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase">Units to Scrap</span>
                  <span className="text-sm font-bold text-foreground">{totalQty}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase">Total Loss</span>
                  <span className="text-sm font-bold text-rose-600 dark:text-rose-400">
                    ${totalLoss.toFixed(2)}
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
                className="gap-2 bg-rose-600 hover:bg-rose-700 text-white"
              >
                {saving ? (
                  <>
                    <Icon icon="solar:refresh-circle-bold" className="animate-spin" size={16} />
                    Authorizing Write-off...
                  </>
                ) : (
                  <>
                    <Icon icon="solar:trash-bin-trash-bold" size={16} />
                    Authorize Disposal ({totalQty} units)
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
