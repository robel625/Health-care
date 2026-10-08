import { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router";
import { Icon } from "@/components/icon";
import { Button } from "@/ui/button";
import { Card, CardContent } from "@/ui/card";
import { Input } from "@/ui/input";
import { Badge } from "@/ui/badge";
import Table, { type ColumnsType } from "antd/es/table";
import { toast } from "sonner";
import PharmacyNavHeader from "./components/PharmacyNavHeader";
import DispenseModal from "./components/DispenseModal";
import NewMedicationRequestModal from "./components/NewMedicationRequestModal";
import PrescriptionPrintModal, { type PrintableDrugItem } from "../encounters/PrescriptionPrintModal";
import {
  HealthcareApi,
  type MedicationRequest,
  type Patient,
} from "@/api/services/healthcareService";

export default function MedicationRequestsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const patientParam = searchParams.get("patient");

  const [data, setData] = useState<MedicationRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [search, setSearch] = useState("");

  // Patient filter info
  const [filterPatient, setFilterPatient] = useState<Patient | null>(null);

  // Real-time stock status map
  const [stockMap, setStockMap] = useState<
    Record<string, { in_stock: boolean; available_qty: number; warehouse_name?: string }>
  >({});

  // Modals
  const [dispenseModalOpen, setDispenseModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<MedicationRequest | null>(null);

  const [newRequestModalOpen, setNewRequestModalOpen] = useState(false);
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [printItems, setPrintItems] = useState<PrintableDrugItem[]>([]);

  // Load patient details if filtered
  useEffect(() => {
    if (patientParam) {
      HealthcareApi.patients
        .get(Number(patientParam))
        .then((p: any) => setFilterPatient(p))
        .catch(() => setFilterPatient(null));
    } else {
      setFilterPatient(null);
    }
  }, [patientParam]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = { page, page_size: 20 };
      if (patientParam) params.patient = patientParam;
      if (statusFilter === "Pending") params.status = "Active";
      else if (statusFilter === "Dispensed") params.status = "Completed";
      else if (statusFilter !== "All") params.status = statusFilter;
      if (search.trim()) params.search = search.trim();

      const res = await HealthcareApi.medicationRequests.list(params);
      const items = res.results || [];
      setData(items);
      setTotal(res.count || 0);

      // Check real-time pharmacy stock in batch
      if (items.length > 0) {
        const uniqueMedNames = Array.from(
          new Set(items.map((i) => i.medication_name).filter(Boolean))
        );
        try {
          const batchRes = await HealthcareApi.medications.checkStockBatch(uniqueMedNames);
          if (batchRes && batchRes.results) {
            setStockMap(batchRes.results);
          }
        } catch (stockErr) {
          console.error("Failed to check batch stock", stockErr);
        }
      }
    } catch (err) {
      console.error("Failed to load medication requests:", err);
      toast.error("Failed to load medication requests.");
    } finally {
      setLoading(false);
    }
  }, [page, patientParam, statusFilter, search]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleOpenDispense = (req: MedicationRequest) => {
    setSelectedRequest(req);
    setDispenseModalOpen(true);
  };

  const handleOpenPrintSlip = (req?: MedicationRequest) => {
    const listToPrint = req ? [req] : data;
    const items: PrintableDrugItem[] = listToPrint.map((r) => {
      const stock = stockMap[r.medication_name] || stockMap[r.medication_name.toLowerCase()];
      return {
        id: r.id,
        medication: r.medication_name,
        drug_name: r.medication_name,
        dosage: r.dosage || (r as any).dosage_instruction,
        period: r.period || "",
        dosage_form: r.dosage_form || "",
        comment: r.instructions || (r as any).notes || "",
        quantity: r.quantity || 1,
        in_stock: stock ? stock.in_stock : undefined,
        is_out_of_stock: stock ? !stock.in_stock : undefined,
      };
    });
    setPrintItems(items);
    setPrintModalOpen(true);
  };

  const clearPatientFilter = () => {
    searchParams.delete("patient");
    setSearchParams(searchParams);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.info(`Copied ${label}: ${text}`);
  };

  // Metrics
  const metrics = useMemo(() => {
    const pending = data.filter((d) => d.status === "Active" || d.status === "Pending").length;
    const dispensed = data.filter((d) => d.status === "Completed" || d.status === "Dispensed").length;
    const outOfStock = data.filter((d) => {
      const s = stockMap[d.medication_name] || stockMap[d.medication_name.toLowerCase()];
      return s && !s.in_stock;
    }).length;
    return { pending, dispensed, outOfStock, total };
  }, [data, stockMap, total]);

  const columns: ColumnsType<MedicationRequest> = [
    {
      title: "Order #",
      dataIndex: "order_number",
      width: 140,
      render: (v: string, r) => {
        const orderNum = v || r.request_id || `#${r.id}`;
        return (
          <div className="flex items-center gap-1.5 group">
            <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <Icon icon="solar:pill-bold-duotone" size={15} />
              {orderNum}
            </span>
            <button
              type="button"
              onClick={() => copyToClipboard(orderNum, "Order #")}
              className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
              title="Copy Order #"
            >
              <Icon icon="solar:copy-bold" size={12} />
            </button>
          </div>
        );
      },
    },
    {
      title: "Patient",
      dataIndex: "patient_name",
      render: (v: string, r) => (
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-blue-500/10 text-blue-700 dark:text-blue-300 font-bold text-xs flex items-center justify-center shrink-0">
            {v ? v.charAt(0).toUpperCase() : "P"}
          </div>
          <div>
            <button
              type="button"
              className="font-semibold text-xs text-foreground hover:underline text-left block"
              onClick={() => navigate(`/healthcare/patients/${r.patient}`)}
            >
              {v || `Patient #${r.patient}`}
            </button>
            <span className="text-[10px] text-muted-foreground font-mono">ID: #{r.patient}</span>
          </div>
        </div>
      ),
    },
    {
      title: "Medication & Dosage",
      dataIndex: "medication_name",
      render: (v: string, r) => (
        <div className="space-y-0.5">
          <p className="font-bold text-xs text-foreground">{v}</p>
          {(r.dosage || (r as any).dosage_instruction || r.period) && (
            <p className="text-[11px] text-muted-foreground">
              {r.dosage || (r as any).dosage_instruction} {r.period && `• ${r.period}`}
            </p>
          )}
        </div>
      ),
    },
    {
      title: "Stock Availability",
      width: 150,
      render: (_, r) => {
        const stock = stockMap[r.medication_name] || stockMap[r.medication_name.toLowerCase()];
        if (!stock) {
          return (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Icon icon="solar:refresh-circle-bold" size={12} className="animate-spin text-muted-foreground/60" />
              Checking...
            </span>
          );
        }
        return stock.in_stock ? (
          <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20 text-[10px] font-semibold gap-1">
            <Icon icon="solar:check-circle-bold" size={12} />
            In Stock ({stock.available_qty})
          </Badge>
        ) : (
          <Badge className="bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20 text-[10px] font-bold gap-1">
            <Icon icon="solar:danger-triangle-bold" size={12} />
            Out of Stock
          </Badge>
        );
      },
    },
    {
      title: "Qty",
      dataIndex: "quantity",
      width: 70,
      align: "right",
      render: (v: number) => <span className="font-bold text-xs font-mono">{v || 1}</span>,
    },
    {
      title: "Practitioner",
      dataIndex: "practitioner_name",
      width: 150,
      render: (v: string) => (
        <span className="text-xs text-muted-foreground flex items-center gap-1">
          <Icon icon="solar:user-bold" size={13} className="text-muted-foreground/70 shrink-0" />
          {v || "Doctor"}
        </span>
      ),
    },
    {
      title: "Status",
      dataIndex: "status",
      width: 130,
      render: (v: string) => {
        const isDispensed = v === "Completed" || v === "Dispensed";
        const isActive = v === "Active" || v === "Pending";
        return (
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
              isDispensed
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                : isActive
                ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
                : "bg-muted text-muted-foreground border border-border"
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isDispensed ? "bg-emerald-500" : isActive ? "bg-blue-500" : "bg-muted-foreground"
              }`}
            />
            {isDispensed ? "Dispensed" : isActive ? "Pending Dispense" : v}
          </span>
        );
      },
    },
    {
      title: "Stock Voucher",
      dataIndex: "stock_entry_number",
      width: 150,
      render: (v: string) =>
        v ? (
          <div className="flex items-center gap-1 group">
            <span className="text-[11px] font-mono font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
              {v}
            </span>
            <button
              type="button"
              onClick={() => copyToClipboard(v, "Voucher #")}
              className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
              title="Copy Voucher #"
            >
              <Icon icon="solar:copy-bold" size={12} />
            </button>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">-</span>
        ),
    },
    {
      title: "Actions",
      width: 180,
      align: "center",
      render: (_, r) => {
        const canDispense = r.status === "Active" || r.status === "Pending";
        const stock = stockMap[r.medication_name] || stockMap[r.medication_name.toLowerCase()];
        const isOOS = stock && !stock.in_stock;

        return (
          <div className="flex items-center justify-center gap-1.5">
            {canDispense && (
              <Button
                size="sm"
                className={`text-xs gap-1 h-7 px-2.5 rounded-lg shadow-2xs ${
                  isOOS
                    ? "bg-amber-600 hover:bg-amber-700 text-white"
                    : "bg-emerald-600 hover:bg-emerald-700 text-white"
                }`}
                onClick={() => (isOOS ? handleOpenPrintSlip(r) : handleOpenDispense(r))}
                title={isOOS ? "Print Out-of-Stock Purchase Authorization Slip" : "Dispense from Main Pharmacy"}
              >
                <Icon icon={isOOS ? "solar:printer-bold" : "solar:pill-bold"} size={13} />
                {isOOS ? "Out-of-Stock Slip" : "Dispense"}
              </Button>
            )}

            {!canDispense && (
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1 mr-1">
                <Icon icon="solar:check-circle-bold" size={14} className="text-emerald-500" />
                Fulfilled
              </span>
            )}

            <Button
              variant="outline"
              size="sm"
              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground rounded-lg"
              title="Print Prescription Slip"
              onClick={() => handleOpenPrintSlip(r)}
            >
              <Icon icon="solar:printer-bold" size={14} />
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <PharmacyNavHeader
        title="Prescription Fulfillment & Dispensing Queue"
        subtitle="Review practitioner prescriptions, verify real-time warehouse stock, issue material vouchers, or generate external purchase slips."
        badge="Rx Queue"
        action={
          <div className="flex items-center gap-2">
            {data.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 border-border shadow-xs"
                onClick={() => handleOpenPrintSlip()}
              >
                <Icon icon="solar:printer-bold" size={15} className="text-blue-500" />
                <span>Print Rx Slips</span>
              </Button>
            )}
            <Button
              size="sm"
              className="gap-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-xs"
              onClick={() =>
                navigate(
                  `/healthcare/pharmacy/medication-requests/new${
                    patientParam ? `?patient=${patientParam}` : ""
                  }`
                )
              }
            >
              <Icon icon="solar:add-circle-bold" size={16} />
              <span>New Prescription</span>
            </Button>
          </div>
        }
      />

      {/* Patient Filter Banner */}
      {patientParam && (
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-blue-500/10 via-indigo-500/5 to-transparent border border-blue-500/30 p-4 text-blue-900 dark:text-blue-200 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-sm shrink-0">
                {filterPatient?.patient_name ? filterPatient.patient_name.charAt(0).toUpperCase() : "P"}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-foreground">
                    {filterPatient?.patient_name || `Patient #${patientParam}`}
                  </span>
                  <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                    MRN #{patientParam}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Age: {filterPatient?.age || "N/A"} • Gender: {filterPatient?.gender || "N/A"} • Phone: {filterPatient?.mobile || filterPatient?.phone || "N/A"}
                  {filterPatient?.allergies && (
                    <span className="ml-2 font-bold text-amber-600 dark:text-amber-400">
                      • Allergies: {filterPatient.allergies}
                    </span>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs bg-background/80"
                onClick={() => navigate(`/healthcare/patients/${patientParam}`)}
              >
                <Icon icon="solar:user-bold" size={14} className="mr-1 text-blue-500" />
                Patient Chart
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 text-xs text-muted-foreground hover:text-foreground hover:bg-muted"
                onClick={clearPatientFilter}
              >
                ✕ Clear Filter
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Queue Performance Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-border/70 bg-card shadow-2xs space-y-1">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Total In Queue
          </p>
          <p className="text-2xl font-extrabold text-foreground">{metrics.total}</p>
          <p className="text-[11px] text-muted-foreground flex items-center gap-1">
            <Icon icon="solar:pill-bold" size={12} className="text-blue-500" />
            Prescriptions issued
          </p>
        </div>

        <div className="p-4 rounded-xl border border-border/70 bg-card shadow-2xs space-y-1">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Pending Dispensation
          </p>
          <p className="text-2xl font-extrabold text-blue-600 dark:text-blue-400">
            {metrics.pending}
          </p>
          <p className="text-[11px] text-muted-foreground flex items-center gap-1">
            <Icon icon="solar:clock-circle-bold" size={12} className="text-blue-500" />
            Ready at pharmacy
          </p>
        </div>

        <div className="p-4 rounded-xl border border-border/70 bg-card shadow-2xs space-y-1">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Dispensed & Fulfilled
          </p>
          <p className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">
            {metrics.dispensed}
          </p>
          <p className="text-[11px] text-muted-foreground flex items-center gap-1">
            <Icon icon="solar:check-circle-bold" size={12} className="text-emerald-500" />
            Completed orders
          </p>
        </div>

        <div className="p-4 rounded-xl border border-border/70 bg-card shadow-2xs space-y-1">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Shortage / Hold
          </p>
          <p className="text-2xl font-extrabold text-amber-600 dark:text-amber-400">
            {metrics.outOfStock}
          </p>
          <p className="text-[11px] text-muted-foreground flex items-center gap-1">
            <Icon icon="solar:danger-triangle-bold" size={12} className="text-amber-500" />
            Out-of-stock slips
          </p>
        </div>
      </div>

      {/* Main Prescriptions Table Card */}
      <Card className="border-border/70 shadow-xs">
        <CardContent className="pt-6 space-y-4">
          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row gap-3 justify-between items-center pb-2">
            <div className="flex items-center gap-1 bg-muted/70 p-1 rounded-xl w-full sm:w-auto border border-border/50">
              {[
                { key: "All", label: "All Orders" },
                { key: "Pending", label: "Pending Dispense" },
                { key: "Dispensed", label: "Dispensed" },
              ].map((st) => (
                <button
                  key={st.key}
                  type="button"
                  onClick={() => {
                    setStatusFilter(st.key);
                    setPage(1);
                  }}
                  className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition-all ${
                    statusFilter === st.key
                      ? "bg-background text-foreground shadow-xs font-bold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-80">
              <Input
                placeholder="Search patient, medication, or order #..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="h-9 text-xs pr-8 rounded-lg"
              />
              {search ? (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                >
                  <Icon icon="solar:close-circle-bold" size={15} />
                </button>
              ) : (
                <Icon
                  icon="solar:magnifer-linear"
                  size={15}
                  className="absolute right-2.5 top-2.5 text-muted-foreground pointer-events-none"
                />
              )}
            </div>
          </div>

          <Table
            columns={columns}
            dataSource={data}
            rowKey="id"
            loading={loading}
            pagination={{
              current: page,
              total,
              pageSize: 20,
              onChange: setPage,
              showTotal: (total) => `${total} prescriptions in queue`,
            }}
            size="middle"
            className="[&_.ant-table-thead>tr>th]:bg-transparent"
          />
        </CardContent>
      </Card>

      {/* Dispense Modal */}
      <DispenseModal
        open={dispenseModalOpen}
        onOpenChange={setDispenseModalOpen}
        request={selectedRequest}
        onDispenseSuccess={loadData}
      />

      {/* New Medication Request Modal */}
      <NewMedicationRequestModal
        open={newRequestModalOpen}
        onOpenChange={setNewRequestModalOpen}
        defaultPatientId={patientParam ? Number(patientParam) : undefined}
        defaultPatientName={filterPatient?.patient_name}
        onSuccess={loadData}
      />

      {/* Prescription Print Modal */}
      <PrescriptionPrintModal
        open={printModalOpen}
        onOpenChange={setPrintModalOpen}
        patientName={filterPatient?.patient_name || data[0]?.patient_name || "Patient"}
        patientAge={(filterPatient as any)?.age || (data[0] as any)?.patient_age || ""}
        patientSex={filterPatient?.gender || (filterPatient as any)?.sex || (data[0] as any)?.patient_gender || ""}
        patientId={patientParam || data[0]?.patient}
        practitionerName={data[0]?.practitioner_name || "Attending Physician"}
        drugRows={printItems}
      />
    </div>
  );
}
