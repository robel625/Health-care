import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/ui/dialog";
import { Button } from "@/ui/button";
import { Icon } from "@/components/icon";
import Table, { type ColumnsType } from "antd/es/table";
import type { OutpatientDispenseReceipt } from "@/api/services/healthcareService";

interface DispenseReceiptModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  receipt: OutpatientDispenseReceipt | null;
}

export default function DispenseReceiptModal({
  open,
  onOpenChange,
  receipt,
}: DispenseReceiptModalProps) {
  if (!receipt) return null;

  const handlePrint = () => {
    window.print();
  };

  const columns: ColumnsType<any> = [
    {
      title: "Medication & Dosage Directions",
      dataIndex: "item_name",
      render: (v: string, r) => (
        <div>
          <p className="font-semibold text-foreground text-sm">{v}</p>
          {(r.instructions || r.dosage) && (
            <p className="text-xs text-muted-foreground mt-0.5 font-medium">
              👉 {r.instructions || `${r.dosage} ${r.frequency || ""}`}
            </p>
          )}
        </div>
      ),
    },
    {
      title: "Qty",
      dataIndex: "quantity",
      width: 80,
      align: "right",
      render: (v: number) => <span className="font-bold text-sm">{v}</span>,
    },
    {
      title: "Coverage",
      width: 140,
      align: "right",
      render: () => <span className="font-semibold text-xs text-emerald-600 dark:text-emerald-400">100% Free (0.00 ETB)</span>,
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto print:p-0 print:border-none">
        <DialogHeader className="print:hidden">
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
            <Icon icon="solar:printer-bold-duotone" size={24} />
            <DialogTitle className="text-lg font-bold">Prescription Dispensing Receipt</DialogTitle>
          </div>
        </DialogHeader>

        {/* Printable Receipt Paper */}
        <div className="p-6 border rounded-xl bg-card space-y-6 text-foreground print:border-none print:p-0">
          {/* Header */}
          <div className="flex justify-between items-start border-b pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="p-1 rounded bg-emerald-600 text-white font-bold text-xs">Rx</span>
                <h2 className="text-lg font-bold tracking-tight">Outpatient Pharmacy Dispensing</h2>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">Ethiopian Electric Utility (EEU) • Staff Pharmacy & Medical Supplies</p>
            </div>
            <div className="text-right">
              <span className="text-xs font-mono font-bold bg-muted px-2.5 py-1 rounded border">
                {receipt.stock_entry_number}
              </span>
              <p className="text-xs text-muted-foreground mt-1">
                {new Date(receipt.dispensed_datetime).toLocaleString()}
              </p>
            </div>
          </div>

          {/* Patient & Dispenser Meta */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs bg-muted/30 p-3 rounded-lg border">
            <div>
              <span className="text-muted-foreground">Patient:</span>
              <p className="font-bold text-sm text-foreground">{receipt.patient_name}</p>
              {receipt.patient_id && (
                <p className="text-muted-foreground font-mono">ID: {receipt.patient_id}</p>
              )}
            </div>
            <div>
              <span className="text-muted-foreground">Dispensed From:</span>
              <p className="font-medium text-foreground">{receipt.warehouse_name}</p>
              <span className="text-muted-foreground">Pharmacist: </span>
              <span className="font-medium text-foreground">{receipt.dispensed_by}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Coverage:</span>
              <p className="font-semibold text-emerald-600 dark:text-emerald-400">
                100% Free EEU Staff Benefit
              </p>
              <span className="text-muted-foreground">Status: </span>
              <span className="font-semibold text-emerald-600">DISPENSED (NO CHARGE)</span>
            </div>
          </div>

          {/* Medication Items */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
              Dispensed Medications & Administration Directions
            </h3>
            <div className="border rounded-lg overflow-hidden">
              <Table
                columns={columns}
                dataSource={receipt.items}
                rowKey="item_code"
                pagination={false}
                size="small"
              />
            </div>
          </div>

          {/* Totals & Warning */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 border-t pt-4">
            <div className="text-[11px] text-muted-foreground space-y-1 max-w-sm">
              <p className="font-semibold text-foreground">Important Patient Instructions:</p>
              <p>• Take medications strictly according to dosage instructions specified above.</p>
              <p>• Complete the full course of antibiotics even if symptoms improve.</p>
              <p>• Keep all medicines out of reach of children. Store in a cool, dry place.</p>
            </div>

            <div className="w-full sm:w-64 text-right space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Coverage:</span>
                <span className="text-emerald-600 font-semibold">EEU Staff Benefit</span>
              </div>
              <div className="flex justify-between text-sm font-bold text-foreground border-t pt-1">
                <span>Patient Total:</span>
                <span className="text-emerald-600 dark:text-emerald-400">
                  0.00 ETB (FREE)
                </span>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="print:hidden gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button
            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
            onClick={handlePrint}
          >
            <Icon icon="solar:printer-bold" size={16} />
            Print Receipt / Labels
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
