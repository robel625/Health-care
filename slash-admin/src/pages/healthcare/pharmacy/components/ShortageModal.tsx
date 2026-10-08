import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/ui/dialog";
import { Button } from "@/ui/button";
import { Icon } from "@/components/icon";
import Table, { type ColumnsType } from "antd/es/table";
import type { ShortageItem } from "@/api/services/healthcareService";
import { HealthcareApi } from "@/api/services/healthcareService";

interface ShortageModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shortages: ShortageItem[];
  entryId: number;
  onStockEntryCreated?: () => void;
}

export default function ShortageModal({
  open,
  onOpenChange,
  shortages,
  entryId,
  onStockEntryCreated,
}: ShortageModalProps) {
  const [creatingEntry, setCreatingEntry] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleCreateDifference = async () => {
    try {
      setCreatingEntry(true);
      const res = await HealthcareApi.inpatientMedicationEntries.makeDifferenceStockEntry(entryId);
      setSuccessMessage(res.message || "Difference Stock Entry created successfully!");
      if (onStockEntryCreated) {
        onStockEntryCreated();
      }
    } catch (err: any) {
      console.error(err);
      alert(err?.response?.data?.error || "Failed to create difference stock entry");
    } finally {
      setCreatingEntry(false);
    }
  };

  const columns: ColumnsType<ShortageItem> = [
    {
      title: "Drug Code",
      dataIndex: "item_code",
      width: 130,
      render: (v: string) => <span className="font-mono text-xs font-semibold">{v}</span>,
    },
    {
      title: "Drug Name",
      dataIndex: "item_name",
      render: (v: string) => <span className="font-medium text-foreground">{v}</span>,
    },
    {
      title: "Required",
      dataIndex: "required_qty",
      width: 100,
      align: "right",
      render: (v: number) => <span className="text-foreground">{v}</span>,
    },
    {
      title: "In Stock",
      dataIndex: "available_qty",
      width: 100,
      align: "right",
      render: (v: number) => (
        <span className={v <= 0 ? "text-red-500 font-semibold" : "text-amber-600 font-medium"}>
          {v}
        </span>
      ),
    },
    {
      title: "Shortage",
      dataIndex: "shortage_qty",
      width: 100,
      align: "right",
      render: (v: number) => (
        <span className="text-red-600 font-bold bg-red-50 dark:bg-red-950/40 px-2 py-0.5 rounded text-xs">
          -{v}
        </span>
      ),
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
            <Icon icon="solar:danger-triangle-bold" size={24} />
            <DialogTitle className="text-lg font-bold">Stock Shortage Detected</DialogTitle>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {successMessage ? (
            <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20 text-green-700 dark:text-green-300 flex items-center gap-2">
              <Icon icon="solar:check-circle-bold" size={20} />
              <p className="text-sm font-medium">{successMessage}</p>
            </div>
          ) : (
            <div className="p-3.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-800 dark:text-red-300 text-sm">
              <p className="font-semibold mb-0.5">The selected pharmacy warehouse lacks sufficient inventory for the following medications.</p>
              <p className="text-xs text-muted-foreground">
                You can create a difference stock entry voucher to replenish the required quantities from the central warehouse before dispensing.
              </p>
            </div>
          )}

          <div className="border rounded-lg overflow-hidden">
            <Table
              columns={columns}
              dataSource={shortages}
              rowKey="item_code"
              pagination={false}
              size="small"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {!successMessage && (
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
              onClick={handleCreateDifference}
              disabled={creatingEntry}
            >
              <Icon icon="solar:box-minimalistic-bold" size={16} />
              {creatingEntry ? "Generating Stock Entry..." : "Make Difference Stock Entry"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
