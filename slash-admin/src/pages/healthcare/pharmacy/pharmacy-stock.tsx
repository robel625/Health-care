import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router";
import { Icon } from "@/components/icon";
import { Button } from "@/ui/button";
import { Card, CardContent } from "@/ui/card";
import { Input } from "@/ui/input";
import { Switch } from "@/ui/switch";
import { Label } from "@/ui/label";
import { Badge } from "@/ui/badge";
import { Progress } from "@/ui/progress";
import Table, { type ColumnsType } from "antd/es/table";
import { toast } from "sonner";
import PharmacyNavHeader from "./components/PharmacyNavHeader";
import AddStockModal from "./components/AddStockModal";
import DisposeStockModal from "./components/DisposeStockModal";
import {
  HealthcareApi,
  type PharmacyStockBalance,
  type StockVoucherHistoryItem,
} from "@/api/services/healthcareService";
import { WarehouseApi, type Warehouse } from "@/api/services/erpService";

export default function PharmacyStockPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"balances" | "inward" | "disposal">("balances");
  const [data, setData] = useState<PharmacyStockBalance[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState<number | null>(null);
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [search, setSearch] = useState("");

  // Modals state
  const [addStockOpen, setAddStockOpen] = useState(false);
  const [disposeStockOpen, setDisposeStockOpen] = useState(false);
  const [preselectedItem, setPreselectedItem] = useState<PharmacyStockBalance | null>(null);

  // History states
  const [inwardHistory, setInwardHistory] = useState<StockVoucherHistoryItem[]>([]);
  const [loadingInward, setLoadingInward] = useState(false);
  const [disposalHistory, setDisposalHistory] = useState<StockVoucherHistoryItem[]>([]);
  const [loadingDisposal, setLoadingDisposal] = useState(false);

  // Load warehouses
  useEffect(() => {
    WarehouseApi.list()
      .then((res: any) => {
        const list = (res.results || res || []) as Warehouse[];
        setWarehouses(list);
      })
      .catch((err) => console.error("Failed to load warehouses:", err));
  }, []);

  const loadStock = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = {};
      if (selectedWarehouse) params.warehouse = selectedWarehouse;
      if (lowStockOnly) params.low_stock = true;
      if (search.trim()) params.search = search.trim();

      const res = await HealthcareApi.pharmacy.stockBalances(params);
      setData(res.results || []);
      setTotal(res.count || 0);
    } catch (err) {
      console.error("Failed to load stock balances:", err);
      toast.error("Failed to load stock balances.");
    } finally {
      setLoading(false);
    }
  }, [selectedWarehouse, lowStockOnly, search]);

  const loadInwardHistory = useCallback(async () => {
    setLoadingInward(true);
    try {
      const res = await HealthcareApi.pharmacy.getInwardHistory();
      setInwardHistory(res.results || []);
    } catch (err) {
      console.error("Failed to load inward history:", err);
    } finally {
      setLoadingInward(false);
    }
  }, []);

  const loadDisposalHistory = useCallback(async () => {
    setLoadingDisposal(true);
    try {
      const res = await HealthcareApi.pharmacy.getDisposalHistory();
      setDisposalHistory(res.results || []);
    } catch (err) {
      console.error("Failed to load disposal history:", err);
    } finally {
      setLoadingDisposal(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "balances") {
      loadStock();
    } else if (activeTab === "inward") {
      loadInwardHistory();
    } else if (activeTab === "disposal") {
      loadDisposalHistory();
    }
  }, [activeTab, loadStock, loadInwardHistory, loadDisposalHistory]);

  const handleOpenAddStock = () => {
    navigate("/healthcare/pharmacy/stock/intake");
  };

  const handleOpenDisposeStock = (item?: PharmacyStockBalance) => {
    setPreselectedItem(item || null);
    setDisposeStockOpen(true);
  };

  const handleModalSuccess = () => {
    loadStock();
    if (activeTab === "inward") loadInwardHistory();
    if (activeTab === "disposal") loadDisposalHistory();
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.info(`Copied ${label}: ${text}`);
  };

  // Stock Intelligence Metrics
  const stockMetrics = useMemo(() => {
    const outOfStock = data.filter((d) => d.actual_qty <= 0).length;
    const lowStock = data.filter((d) => d.actual_qty > 0 && d.is_low_stock).length;
    const totalValuation = data.reduce(
      (sum, item) => sum + (Number(item.actual_qty) || 0) * (Number(item.valuation_rate) || 0),
      0
    );
    return {
      outOfStock,
      lowStock,
      totalValuation,
      totalSKUs: total,
    };
  }, [data, total]);

  // Stock Balance Columns
  const balanceColumns: ColumnsType<PharmacyStockBalance> = [
    {
      title: "Drug Code",
      dataIndex: "item_code",
      width: 140,
      render: (v: string) => (
        <div className="flex items-center gap-1 group">
          <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
            {v}
          </span>
          <button
            type="button"
            onClick={() => copyToClipboard(v, "Drug Code")}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
            title="Copy Code"
          >
            <Icon icon="solar:copy-bold" size={12} />
          </button>
        </div>
      ),
    },
    {
      title: "Medication Name",
      dataIndex: "item_name",
      render: (v: string, r) => (
        <div>
          <span className="font-semibold text-xs text-foreground block">{v}</span>
          <span className="text-[10px] text-muted-foreground">{r.item_group || "Pharmaceutical"}</span>
        </div>
      ),
    },
    {
      title: "Warehouse",
      dataIndex: "warehouse_name",
      width: 150,
      render: (v: string) => (
        <span className="text-xs text-muted-foreground flex items-center gap-1">
          <Icon icon="solar:box-minimalistic-bold" size={13} className="text-emerald-500 shrink-0" />
          {v}
        </span>
      ),
    },
    {
      title: "Stock Availability & Health",
      dataIndex: "actual_qty",
      width: 180,
      render: (v: number, r) => {
        const reorder = r.reorder_level || 10;
        const percent = Math.min(100, Math.round((v / (reorder * 1.5)) * 100));
        const isOut = v <= 0;
        const isLow = r.is_low_stock || v < reorder;

        return (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span
                className={`font-mono font-bold ${
                  isOut ? "text-rose-600" : isLow ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"
                }`}
              >
                {v} {r.stock_uom || "units"}
              </span>
              <span className="text-[10px] text-muted-foreground">Min {reorder}</span>
            </div>
            <Progress
              value={percent}
              className={`h-1.5 ${
                isOut ? "[&>div]:bg-rose-500" : isLow ? "[&>div]:bg-amber-500" : "[&>div]:bg-emerald-500"
              }`}
            />
          </div>
        );
      },
    },
    {
      title: "Valuation Rate",
      dataIndex: "valuation_rate",
      width: 110,
      align: "right",
      render: (v: number) => (
        <span className="font-mono text-xs">${Number(v || 0).toFixed(2)}</span>
      ),
    },
    {
      title: "Total Value",
      width: 110,
      align: "right",
      render: (_, r) => {
        const totalVal = (Number(r.actual_qty) || 0) * (Number(r.valuation_rate) || 0);
        return (
          <span className="font-mono font-semibold text-xs text-foreground">
            ${totalVal.toFixed(2)}
          </span>
        );
      },
    },
    {
      title: "Status",
      width: 120,
      render: (_, r) => {
        if (r.actual_qty <= 0) {
          return (
            <Badge className="bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20 text-[10px] font-bold gap-1">
              <Icon icon="solar:danger-triangle-bold" size={12} />
              Out of Stock
            </Badge>
          );
        }
        if (r.is_low_stock) {
          return (
            <Badge className="bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20 text-[10px] font-bold gap-1">
              <Icon icon="solar:danger-triangle-bold" size={12} />
              Low Stock
            </Badge>
          );
        }
        return (
          <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20 text-[10px] font-medium gap-1">
            <Icon icon="solar:check-circle-bold" size={12} />
            Adequate
          </Badge>
        );
      },
    },
    {
      title: "Actions",
      width: 150,
      align: "center",
      render: (_, r) => (
        <div className="flex items-center justify-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2 text-[11px] border-emerald-500/30 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
            title="Receive Stock for this item"
            onClick={handleOpenAddStock}
          >
            <Icon icon="solar:box-bold" size={13} className="mr-1" />
            Receive
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={r.actual_qty <= 0}
            className="h-7 px-2 text-[11px] text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40"
            title="Write-off / Dispose expired stock"
            onClick={() => handleOpenDisposeStock(r)}
          >
            <Icon icon="solar:trash-bin-trash-bold" size={13} className="mr-1" />
            Scrap
          </Button>
        </div>
      ),
    },
  ];

  // Inward History Columns
  const inwardColumns: ColumnsType<StockVoucherHistoryItem> = [
    {
      title: "Voucher Number",
      dataIndex: "stock_entry_number",
      width: 160,
      render: (v: string) => (
        <div className="flex items-center gap-1 group">
          <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
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
      ),
    },
    {
      title: "Entry Type",
      dataIndex: "entry_type",
      width: 140,
      render: (v: string) => (
        <Badge
          variant="outline"
          className={
            v === "Material Transfer"
              ? "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border-blue-300"
              : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300"
          }
        >
          {v}
        </Badge>
      ),
    },
    {
      title: "Posting Date",
      dataIndex: "posting_date",
      width: 120,
      render: (v: string) => <span className="text-xs text-muted-foreground">{v}</span>,
    },
    {
      title: "Target Warehouse",
      dataIndex: "to_warehouse_name",
      width: 150,
      render: (v: string) => <span className="font-medium text-xs text-foreground">{v || "Main Pharmacy"}</span>,
    },
    {
      title: "Source / Supplier",
      dataIndex: "from_warehouse_name",
      width: 150,
      render: (v: string) => (
        <span className="text-xs text-muted-foreground">{v || "Direct Vendor Intake"}</span>
      ),
    },
    {
      title: "Items",
      dataIndex: "items_count",
      width: 90,
      align: "center",
      render: (v: number) => <span className="font-mono text-xs">{v} lines</span>,
    },
    {
      title: "Total Units",
      dataIndex: "total_qty",
      width: 110,
      align: "right",
      render: (v: number) => (
        <span className="font-mono font-bold text-xs text-emerald-600 dark:text-emerald-400">
          +{v}
        </span>
      ),
    },
    {
      title: "Total Value",
      dataIndex: "total_value",
      width: 110,
      align: "right",
      render: (v: number) => (
        <span className="font-mono text-xs font-semibold">${Number(v || 0).toFixed(2)}</span>
      ),
    },
    {
      title: "Purpose / Notes",
      dataIndex: "purpose",
      render: (v: string, r) => (
        <div>
          <span className="text-xs font-medium text-foreground block">{v}</span>
          {r.notes && <span className="text-[11px] text-muted-foreground">{r.notes}</span>}
        </div>
      ),
    },
  ];

  // Disposal History Columns
  const disposalColumns: ColumnsType<StockVoucherHistoryItem> = [
    {
      title: "Voucher Number",
      dataIndex: "stock_entry_number",
      width: 160,
      render: (v: string) => (
        <div className="flex items-center gap-1 group">
          <span className="font-mono text-xs font-bold text-rose-600 dark:text-rose-400">
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
      ),
    },
    {
      title: "Posting Date",
      dataIndex: "posting_date",
      width: 120,
      render: (v: string) => <span className="text-xs text-muted-foreground">{v}</span>,
    },
    {
      title: "Warehouse",
      dataIndex: "warehouse_name",
      width: 150,
      render: (v: string) => <span className="font-medium text-xs text-foreground">{v}</span>,
    },
    {
      title: "Reason / Purpose",
      dataIndex: "purpose",
      render: (v: string, r) => (
        <div>
          <span className="text-xs font-semibold text-rose-600 block">{v}</span>
          {r.notes && <span className="text-[11px] text-muted-foreground">{r.notes}</span>}
        </div>
      ),
    },
    {
      title: "Lines",
      dataIndex: "items_count",
      width: 90,
      align: "center",
      render: (v: number) => <span className="font-mono text-xs">{v} items</span>,
    },
    {
      title: "Units Scrapped",
      dataIndex: "total_qty",
      width: 110,
      align: "right",
      render: (v: number) => (
        <span className="font-mono font-bold text-xs text-rose-600 dark:text-rose-400">
          -{v}
        </span>
      ),
    },
    {
      title: "Loss Amount",
      dataIndex: "total_value",
      width: 110,
      align: "right",
      render: (v: number) => (
        <span className="font-mono font-bold text-xs text-rose-600 dark:text-rose-400">
          ${Number(v || 0).toFixed(2)}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PharmacyNavHeader
        title="Pharmacy Warehouse Stock & Inventory Balances"
        subtitle="Live multi-warehouse inventory ledgers, batch tracking, shipment intakes, and compliant scrap write-offs."
        badge="Stock Ledger"
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleOpenDisposeStock()}
              className="gap-1.5 border-rose-500/40 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs shadow-xs"
            >
              <Icon icon="solar:trash-bin-trash-bold" size={15} />
              <span>Scrap / Dispose</span>
            </Button>
            <Button
              size="sm"
              onClick={handleOpenAddStock}
              className="gap-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs shadow-xs"
            >
              <Icon icon="solar:box-bold" size={15} />
              <span>Receive Stock Intake</span>
            </Button>
          </div>
        }
      />

      {/* Inventory Intelligence Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-border/70 bg-card shadow-2xs space-y-1">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Total Tracked SKUs
          </p>
          <p className="text-2xl font-extrabold text-foreground">{stockMetrics.totalSKUs}</p>
          <p className="text-[11px] text-muted-foreground flex items-center gap-1">
            <Icon icon="solar:box-minimalistic-bold" size={12} className="text-blue-500" />
            Across all warehouses
          </p>
        </div>

        <div className="p-4 rounded-xl border border-border/70 bg-card shadow-2xs space-y-1">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Estimated Inventory Value
          </p>
          <p className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
            ${stockMetrics.totalValuation.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-[11px] text-muted-foreground flex items-center gap-1">
            <Icon icon="solar:dollar-bold" size={12} className="text-emerald-500" />
            Standard valuation
          </p>
        </div>

        <div className="p-4 rounded-xl border border-border/70 bg-card shadow-2xs space-y-1">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Low Stock Alerts
          </p>
          <p className="text-2xl font-extrabold text-amber-600 dark:text-amber-400">
            {stockMetrics.lowStock}
          </p>
          <p className="text-[11px] text-muted-foreground flex items-center gap-1">
            <Icon icon="solar:danger-triangle-bold" size={12} className="text-amber-500" />
            Below reorder threshold
          </p>
        </div>

        <div className="p-4 rounded-xl border border-border/70 bg-card shadow-2xs space-y-1">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Out-of-Stock Items
          </p>
          <p className="text-2xl font-extrabold text-rose-600 dark:text-rose-400">
            {stockMetrics.outOfStock}
          </p>
          <p className="text-[11px] text-muted-foreground flex items-center gap-1">
            <Icon icon="solar:close-circle-bold" size={12} className="text-rose-500" />
            Zero inventory count
          </p>
        </div>
      </div>

      {/* Main Stock Container Card */}
      <Card className="border-border/70 shadow-xs">
        <CardContent className="pt-6 space-y-4">
          {/* Tab Switcher */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/60">
            <div className="flex items-center gap-1 bg-muted/70 p-1 rounded-xl border border-border/50">
              <button
                type="button"
                onClick={() => setActiveTab("balances")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === "balances"
                    ? "bg-background text-foreground shadow-xs font-bold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon icon="solar:database-bold" size={15} />
                Stock Balances ({total})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("inward")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === "inward"
                    ? "bg-background text-emerald-600 dark:text-emerald-400 shadow-xs font-bold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon icon="solar:box-bold" size={15} />
                Inward Receipts ({inwardHistory.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("disposal")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === "disposal"
                    ? "bg-background text-rose-600 dark:text-rose-400 shadow-xs font-bold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon icon="solar:trash-bin-trash-bold" size={15} />
                Disposal / Scrap ({disposalHistory.length})
              </button>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (activeTab === "balances") loadStock();
                else if (activeTab === "inward") loadInwardHistory();
                else loadDisposalHistory();
              }}
              className="h-8 text-xs gap-1 self-start sm:self-center"
            >
              <Icon icon="solar:refresh-circle-bold" size={14} /> Refresh
            </Button>
          </div>

          {/* Tab 1: Current Stock Balances */}
          {activeTab === "balances" && (
            <div className="space-y-4">
              <div className="flex flex-col lg:flex-row gap-3 justify-between items-start lg:items-center">
                <div className="flex flex-wrap items-center gap-3">
                  {/* Warehouse Selector */}
                  <div className="w-56">
                    <select
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs ring-offset-background focus:outline-none focus:ring-2 focus:ring-emerald-500/20 shadow-xs"
                      value={selectedWarehouse || ""}
                      onChange={(e) => setSelectedWarehouse(Number(e.target.value) || null)}
                    >
                      <option value="">All Pharmacy Warehouses</option>
                      {warehouses.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.warehouse_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Low Stock Toggle Switch */}
                  <div className="flex items-center gap-2 border border-border/70 px-3 py-1.5 rounded-lg bg-muted/20 shadow-2xs">
                    <Switch
                      id="low-stock"
                      checked={lowStockOnly}
                      onCheckedChange={setLowStockOnly}
                    />
                    <Label htmlFor="low-stock" className="text-xs cursor-pointer font-medium">
                      Low Stock Only
                    </Label>
                  </div>
                </div>

                {/* Search Input */}
                <div className="relative w-full lg:w-72">
                  <Input
                    placeholder="Search medication name, code..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
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
                columns={balanceColumns}
                dataSource={data}
                rowKey={(r) => `${r.item_id}-${r.warehouse_id}`}
                loading={loading}
                pagination={{
                  pageSize: 20,
                  total,
                  showTotal: (t) => `${t} stock balances recorded`,
                }}
                size="middle"
                className="[&_.ant-table-thead>tr>th]:bg-transparent"
              />
            </div>
          )}

          {/* Tab 2: Inward Receipt History */}
          {activeTab === "inward" && (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Showing verified Material Receipts and transfer stock vouchers posted into hospital pharmacy warehouses.
              </p>
              <Table
                columns={inwardColumns}
                dataSource={inwardHistory}
                rowKey={(r) => r.id}
                loading={loadingInward}
                pagination={{ pageSize: 15 }}
                size="middle"
                className="[&_.ant-table-thead>tr>th]:bg-transparent"
              />
            </div>
          )}

          {/* Tab 3: Disposal & Scrap History */}
          {activeTab === "disposal" && (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Showing decommissioned inventory records, expired medications, and hospital pharmacy scrap certificates.
              </p>
              <Table
                columns={disposalColumns}
                dataSource={disposalHistory}
                rowKey={(r) => r.id}
                loading={loadingDisposal}
                pagination={{ pageSize: 15 }}
                size="middle"
                className="[&_.ant-table-thead>tr>th]:bg-transparent"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Operation 1: Add Stock Modal */}
      <AddStockModal
        open={addStockOpen}
        onOpenChange={setAddStockOpen}
        warehouses={warehouses}
        currentWarehouseId={selectedWarehouse}
        stockCatalog={data}
        onSuccess={handleModalSuccess}
      />

      {/* Operation 2: Dispose Stock Modal */}
      <DisposeStockModal
        open={disposeStockOpen}
        onOpenChange={setDisposeStockOpen}
        warehouses={warehouses}
        currentWarehouseId={selectedWarehouse}
        stockCatalog={data}
        preselectedItem={preselectedItem}
        onSuccess={handleModalSuccess}
      />
    </div>
  );
}
