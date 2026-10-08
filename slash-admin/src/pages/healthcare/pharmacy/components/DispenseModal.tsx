import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/ui/dialog";
import { Button } from "@/ui/button";
import { Label } from "@/ui/label";
import { Input } from "@/ui/input";
import { Icon } from "@/components/icon";
import { HealthcareApi, type MedicationRequest } from "@/api/services/healthcareService";
import { WarehouseApi, type Warehouse } from "@/api/services/erpService";

interface DispenseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  request: MedicationRequest | null;
  onDispenseSuccess: () => void;
}

export default function DispenseModal({
  open,
  onOpenChange,
  request,
  onDispenseSuccess,
}: DispenseModalProps) {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState<number | null>(null);
  const [quantity, setQuantity] = useState<number>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setError(null);
      if (request) {
        setQuantity(request.quantity || 1);
        if (request.warehouse) {
          setSelectedWarehouse(request.warehouse);
        }
      }
      // Load warehouses
      WarehouseApi.list()
        .then((res: any) => {
          const list = (res.results || res || []) as Warehouse[];
          setWarehouses(list);
          if (list.length > 0 && !selectedWarehouse && !request?.warehouse) {
            // Find a pharmacy warehouse or pick first
            const pharmWh = list.find((w) =>
              (w.warehouse_name || "").toLowerCase().includes("pharmacy")
            );
            setSelectedWarehouse(pharmWh ? pharmWh.id : list[0].id);
          }
        })
        .catch(console.error);
    }
  }, [open, request]);

  const handleDispense = async () => {
    if (!request || !selectedWarehouse) {
      setError("Please select a dispensing pharmacy warehouse.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await HealthcareApi.medicationRequests.dispense(request.id, {
        warehouse_id: selectedWarehouse,
        qty: quantity,
      });
      onDispenseSuccess();
      onOpenChange(false);
    } catch (err: any) {
      console.error(err);
      setError(err?.response?.data?.error || err.message || "Failed to dispense medication.");
    } finally {
      setLoading(false);
    }
  };

  if (!request) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
            <Icon icon="solar:pill-bold-duotone" size={24} />
            <DialogTitle className="text-lg font-bold">Dispense Prescription</DialogTitle>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2 text-sm">
          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
              <Icon icon="solar:danger-circle-bold" size={16} />
              <span>{error}</span>
            </div>
          )}

          {/* Details Card */}
          <div className="p-3 rounded-lg bg-muted/50 border border-border space-y-2">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs text-muted-foreground">Patient</p>
                <p className="font-semibold text-foreground">{request.patient_name || `Patient #${request.patient}`}</p>
              </div>
              <span className="text-xs font-mono bg-background border px-2 py-0.5 rounded text-muted-foreground">
                {request.order_number || request.request_id || `#${request.id}`}
              </span>
            </div>

            <div className="pt-1 border-t border-border/60">
              <p className="text-xs text-muted-foreground">Medication Prescribed</p>
              <p className="font-medium text-emerald-600 dark:text-emerald-400">{request.medication_name}</p>
              {(request.dosage || request.period) && (
                <p className="text-xs text-muted-foreground">
                  {request.dosage} {request.period && `• ${request.period}`}
                </p>
              )}
            </div>
          </div>

          {/* Form */}
          <div className="space-y-3">
            <div>
              <Label className="text-xs font-medium">Dispensing Warehouse *</Label>
              <select
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                value={selectedWarehouse || ""}
                onChange={(e) => setSelectedWarehouse(Number(e.target.value) || null)}
              >
                <option value="">Select Warehouse...</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.warehouse_name} {(w as any).is_group ? "(Group)" : ""}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Stock will be deducted from this warehouse via an automated Material Issue Stock Entry.
              </p>
            </div>

            <div>
              <Label className="text-xs font-medium">Dispense Quantity</Label>
              <Input
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value) || 1)}
                className="mt-1"
              />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button
            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
            onClick={handleDispense}
            disabled={loading || !selectedWarehouse}
          >
            <Icon icon="solar:check-circle-bold" size={16} />
            {loading ? "Dispensing..." : "Confirm & Dispense Stock"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
