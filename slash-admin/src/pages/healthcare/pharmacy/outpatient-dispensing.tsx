import { useState, useEffect, useCallback, useMemo } from "react";
import { Icon } from "@/components/icon";
import { Button } from "@/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { Badge } from "@/ui/badge";
import Table, { type ColumnsType } from "antd/es/table";
import { toast } from "sonner";
import PharmacyNavHeader from "./components/PharmacyNavHeader";
import DispenseReceiptModal from "./components/DispenseReceiptModal";
import EntitySelect, { type EntityOption } from "@/components/healthcare/EntitySelect";
import {
  HealthcareApi,
  type Patient,
  type OutpatientPrescriptionItem,
  type OutpatientDispenseItem,
  type OutpatientDispenseReceipt,
  type OutpatientHistoryItem,
  type PharmacyStockBalance,
} from "@/api/services/healthcareService";
import { WarehouseApi, type Warehouse } from "@/api/services/erpService";

export default function OutpatientDispensingPage() {
  // Active Tab: POS Dispense Counter vs Dispensing History
  const [activeView, setActiveView] = useState<"pos" | "history">("pos");

  // Mode: registered patient or walk-in OTC
  const [isWalkIn, setIsWalkIn] = useState(false);
  const [walkInName, setWalkInName] = useState("");
  const [walkInPhone, setWalkInPhone] = useState("");

  // Patients & Warehouses
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(null);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);

  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<number | null>(null);

  // Active prescriptions for selected patient
  const [prescriptions, setPrescriptions] = useState<OutpatientPrescriptionItem[]>([]);
  const [loadingPrescriptions, setLoadingPrescriptions] = useState(false);

  // Dispensing Cart
  const [cart, setCart] = useState<OutpatientDispenseItem[]>([]);

  // Pharmacy Stock for Quick OTC adding
  const [stockItems, setStockItems] = useState<PharmacyStockBalance[]>([]);
  const [otcSearch, setOtcSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");

  // Billing & Payment
  const [paymentMethod, setPaymentMethod] = useState<"Cash" | "Card" | "Insurance" | "Mobile Money" | "Bill Later">("Cash");
  const [cashTendered, setCashTendered] = useState<string>("");
  const [dispenseNotes, setDispenseNotes] = useState("");
  const [dispensing, setDispensing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Receipt Modal
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [receiptData, setReceiptData] = useState<OutpatientDispenseReceipt | null>(null);

  // Recent Outpatient History
  const [history, setHistory] = useState<OutpatientHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historySearch, setHistorySearch] = useState("");

  // Initial Load: Patients, Warehouses, History
  useEffect(() => {
    HealthcareApi.patients.list({ page_size: 250 })
      .then((res) => setPatients(res.results || []))
      .catch((err) => console.error("Failed to load patients:", err));

    WarehouseApi.list()
      .then((res: any) => {
        const list = (res.results || res || []) as Warehouse[];
        setWarehouses(list);
        if (list.length > 0) {
          const pharmWh = list.find((w) =>
            (w.warehouse_name || "").toLowerCase().includes("pharmacy")
          );
          setSelectedWarehouseId(pharmWh ? pharmWh.id : list[0].id);
        }
      })
      .catch((err) => console.error("Failed to load warehouses:", err));

    loadHistory();
  }, []);

  // Load stock for selected warehouse
  const loadStock = useCallback(async () => {
    if (!selectedWarehouseId) return;
    try {
      const res = await HealthcareApi.pharmacy.stockBalances({ warehouse: selectedWarehouseId });
      setStockItems(res.results || []);
    } catch (err) {
      console.error("Failed to load pharmacy stock:", err);
    }
  }, [selectedWarehouseId]);

  useEffect(() => {
    loadStock();
  }, [loadStock]);

  const loadHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await HealthcareApi.pharmacy.getOutpatientHistory();
      setHistory(res.results || []);
    } catch (err) {
      console.error("Failed to load outpatient history:", err);
    } finally {
      setLoadingHistory(false);
    }
  };

  // When patient is selected, load active doctor prescriptions
  useEffect(() => {
    if (selectedPatientId) {
      const p = patients.find((pat) => pat.id === selectedPatientId) || null;
      setSelectedPatient(p);
      setLoadingPrescriptions(true);
      setErrorMessage(null);
      HealthcareApi.pharmacy.getPatientPrescriptions(selectedPatientId)
        .then((res) => {
          const prescList = res.prescriptions || [];
          setPrescriptions(prescList);
          // Auto load into cart if cart is empty
          if (prescList.length > 0) {
            const autoCartItems: OutpatientDispenseItem[] = prescList.map((pr) => {
              const stockMatch = stockItems.find(
                (s) => s.item_code.toLowerCase() === pr.drug_code.toLowerCase() ||
                       s.item_name.toLowerCase() === pr.medication_name.toLowerCase()
              );
              return {
                item_code: pr.drug_code || pr.medication_name,
                item_name: pr.medication_name,
                quantity: pr.quantity || 1,
                unit_price: stockMatch?.valuation_rate || 5.0,
                dosage: pr.dosage,
                period: pr.period,
                instructions: pr.instructions,
                prescription_id: pr.prescription_id,
                medication_request_id: pr.medication_request_id,
              };
            });
            setCart(autoCartItems);
            toast.info(`Loaded ${prescList.length} prescription(s) for ${p?.patient_name || "patient"}`);
          } else {
            setCart([]);
          }
        })
        .catch(console.error)
        .finally(() => setLoadingPrescriptions(false));
    } else {
      setSelectedPatient(null);
      setPrescriptions([]);
      if (!isWalkIn) setCart([]);
    }
  }, [selectedPatientId, patients, stockItems, isWalkIn]);

  // Add prescription to cart
  const handleAddPrescriptionToCart = (pr: OutpatientPrescriptionItem) => {
    const existing = cart.find(
      (c) => (c.prescription_id && c.prescription_id === pr.prescription_id) ||
             (c.medication_request_id && c.medication_request_id === pr.medication_request_id) ||
             c.item_code === pr.drug_code
    );
    if (existing) {
      toast.warning("This prescription is already in the dispensing cart.");
      return;
    }
    const stockMatch = stockItems.find(
      (s) => s.item_code.toLowerCase() === pr.drug_code.toLowerCase() ||
             s.item_name.toLowerCase() === pr.medication_name.toLowerCase()
    );
    setCart((prev) => [
      ...prev,
      {
        item_code: pr.drug_code || pr.medication_name,
        item_name: pr.medication_name,
        quantity: pr.quantity || 1,
        unit_price: stockMatch?.valuation_rate || 5.0,
        dosage: pr.dosage,
        period: pr.period,
        instructions: pr.instructions,
        prescription_id: pr.prescription_id,
        medication_request_id: pr.medication_request_id,
      },
    ]);
    toast.success(`Added ${pr.medication_name} to cart`);
  };

  const handleAddAllPrescriptions = () => {
    const newItems: OutpatientDispenseItem[] = [];
    prescriptions.forEach((pr) => {
      const already = cart.some(
        (c) => (c.prescription_id && c.prescription_id === pr.prescription_id) ||
               (c.medication_request_id && c.medication_request_id === pr.medication_request_id) ||
               c.item_code === pr.drug_code
      );
      if (!already) {
        const stockMatch = stockItems.find(
          (s) => s.item_code.toLowerCase() === pr.drug_code.toLowerCase() ||
                 s.item_name.toLowerCase() === pr.medication_name.toLowerCase()
        );
        newItems.push({
          item_code: pr.drug_code || pr.medication_name,
          item_name: pr.medication_name,
          quantity: pr.quantity || 1,
          unit_price: stockMatch?.valuation_rate || 5.0,
          dosage: pr.dosage,
          period: pr.period,
          instructions: pr.instructions,
          prescription_id: pr.prescription_id,
          medication_request_id: pr.medication_request_id,
        });
      }
    });

    if (newItems.length > 0) {
      setCart((prev) => [...prev, ...newItems]);
      toast.success(`Added ${newItems.length} prescription(s) to cart`);
    } else {
      toast.info("All prescriptions are already added to cart.");
    }
  };

  // Add OTC stock item to cart
  const handleAddStockItemToCart = (item: PharmacyStockBalance) => {
    const existingIdx = cart.findIndex((c) => c.item_code === item.item_code);
    if (existingIdx !== -1) {
      setCart((prev) =>
        prev.map((c, idx) => (idx === existingIdx ? { ...c, quantity: c.quantity + 1 } : c))
      );
      toast.info(`Increased ${item.item_name} quantity`);
    } else {
      setCart((prev) => [
        ...prev,
        {
          item_code: item.item_code,
          item_name: item.item_name,
          quantity: 1,
          unit_price: item.valuation_rate || 5.0,
          dosage: "1 unit",
          instructions: "As directed by physician",
        },
      ]);
      toast.success(`Added ${item.item_name} to cart`);
    }
    setOtcSearch("");
  };

  // Cart operations
  const handleUpdateQty = (index: number, delta: number) => {
    setCart((prev) =>
      prev.map((c, i) => {
        if (i !== index) return c;
        const newQty = Math.max(1, c.quantity + delta);
        return { ...c, quantity: newQty };
      })
    );
  };

  const handleSetExactQty = (index: number, qty: number) => {
    if (qty <= 0) return;
    setCart((prev) => prev.map((c, i) => (i === index ? { ...c, quantity: qty } : c)));
  };

  const handleUpdatePrice = (index: number, price: number) => {
    if (price < 0) return;
    setCart((prev) => prev.map((c, i) => (i === index ? { ...c, unit_price: price } : c)));
  };

  const handleUpdateInstructions = (index: number, instructions: string) => {
    setCart((prev) => prev.map((c, i) => (i === index ? { ...c, instructions } : c)));
  };

  const handleRemoveItem = (index: number) => {
    setCart((prev) => prev.filter((_, i) => i !== index));
    toast.info("Item removed from cart");
  };

  const handleClearCart = () => {
    if (cart.length === 0) return;
    setCart([]);
    toast.info("Cart cleared");
  };

  // Calculations
  const subtotal = cart.reduce((acc, it) => acc + (it.quantity || 0) * (it.unit_price || 0), 0);
  const totalAmount = subtotal;
  const cashNum = parseFloat(cashTendered) || 0;
  const changeDue = Math.max(0, cashNum - totalAmount);

  // Dispense Submission
  const handleDispense = async () => {
    if (!selectedWarehouseId) {
      setErrorMessage("Please select a dispensing pharmacy warehouse.");
      toast.error("Please select a dispensing warehouse.");
      return;
    }
    if (cart.length === 0) {
      setErrorMessage("Cannot dispense an empty cart. Please add at least one medication.");
      toast.error("Dispensing cart is empty.");
      return;
    }
    if (isWalkIn && !walkInName.trim()) {
      setErrorMessage("Please enter patient name for walk-in dispensing.");
      toast.error("Walk-in customer name is required.");
      return;
    }

    setDispensing(true);
    setErrorMessage(null);
    try {
      const payload = {
        patient_id: isWalkIn ? null : selectedPatientId,
        patient_name: isWalkIn ? walkInName : (selectedPatient?.patient_name || ""),
        warehouse_id: selectedWarehouseId,
        payment_method: paymentMethod,
        notes: dispenseNotes,
        items: cart,
      };

      const receipt = await HealthcareApi.pharmacy.dispenseOutpatient(payload);
      setReceiptData(receipt);
      setReceiptModalOpen(true);
      toast.success("Medications dispensed successfully! Stock deducted.");

      // Reset cart and reload history & prescriptions
      setCart([]);
      setCashTendered("");
      setDispenseNotes("");
      if (selectedPatientId) {
        HealthcareApi.pharmacy.getPatientPrescriptions(selectedPatientId).then((res) => {
          setPrescriptions(res.prescriptions || []);
        });
      }
      loadStock();
      loadHistory();
    } catch (err: any) {
      console.error(err);
      const shortageDetails = err?.response?.data?.shortages;
      if (shortageDetails && shortageDetails.length > 0) {
        const names = shortageDetails.map((s: any) => `${s.item_name} (Needs ${s.required_qty}, Available ${s.available_qty})`).join(", ");
        const msg = `Insufficient stock in selected warehouse: ${names}`;
        setErrorMessage(msg);
        toast.error(msg);
      } else {
        const msg = err?.response?.data?.error || err.message || "Failed to dispense medication.";
        setErrorMessage(msg);
        toast.error(msg);
      }
    } finally {
      setDispensing(false);
    }
  };

  const patientOptions: EntityOption[] = useMemo(() => {
    return patients.map((p) => ({
      value: p.id,
      label: p.patient_name || `${p.first_name || ""} ${p.last_name || ""}`.trim() || `Patient #${p.id}`,
      sublabel: `MRN: ${p.patient_id || p.id} • Age: ${p.age || "N/A"} • ${p.mobile || p.phone || "No phone"}`,
      avatarName: p.patient_name || p.first_name,
    }));
  }, [patients]);

  const filteredOtcStock = useMemo(() => {
    if (!otcSearch.trim() && selectedCategory === "All") return [];
    return stockItems.filter((s) => {
      const matchSearch =
        !otcSearch.trim() ||
        s.item_name.toLowerCase().includes(otcSearch.toLowerCase()) ||
        s.item_code.toLowerCase().includes(otcSearch.toLowerCase());
      const matchCategory =
        selectedCategory === "All" ||
        (s.item_group && s.item_group.toLowerCase().includes(selectedCategory.toLowerCase()));
      return matchSearch && matchCategory;
    });
  }, [stockItems, otcSearch, selectedCategory]);

  const filteredHistory = useMemo(() => {
    if (!historySearch.trim()) return history;
    const q = historySearch.toLowerCase();
    return history.filter(
      (h) =>
        (h.stock_entry_number && h.stock_entry_number.toLowerCase().includes(q)) ||
        (h.purpose && h.purpose.toLowerCase().includes(q)) ||
        (h.warehouse_name && h.warehouse_name.toLowerCase().includes(q))
    );
  }, [history, historySearch]);

  const historyColumns: ColumnsType<OutpatientHistoryItem> = [
    {
      title: "Stock Voucher",
      dataIndex: "stock_entry_number",
      width: 150,
      render: (v: string) => (
        <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
          {v}
        </span>
      ),
    },
    {
      title: "Date & Time",
      dataIndex: "posting_date",
      width: 120,
      render: (v: string) => <span className="text-xs text-muted-foreground">{v}</span>,
    },
    {
      title: "Warehouse",
      dataIndex: "warehouse_name",
      width: 160,
      render: (v: string) => (
        <span className="text-xs font-medium text-foreground">{v || "Main Pharmacy"}</span>
      ),
    },
    {
      title: "Dispensing Purpose & Patient",
      dataIndex: "purpose",
      render: (v: string) => (
        <span className="text-xs font-medium text-foreground">{v}</span>
      ),
    },
    {
      title: "Items Count",
      dataIndex: "items_count",
      width: 110,
      align: "center",
      render: (v: number) => (
        <span className="font-semibold text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
          {v} lines
        </span>
      ),
    },
    {
      title: "Total Units",
      dataIndex: "total_qty",
      width: 110,
      align: "right",
      render: (v: number) => (
        <span className="font-mono font-bold text-xs text-foreground">{v} units</span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PharmacyNavHeader
        title="Outpatient Dispensing POS Terminal"
        subtitle="Fast point-of-sale dispensing counter, doctor prescription fulfillment, real-time stock deductions, and customer billing."
        badge="POS Terminal"
        action={
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-muted/80 p-0.5 rounded-xl border border-border/60">
              <button
                type="button"
                onClick={() => setActiveView("pos")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeView === "pos"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon icon="solar:cart-bold" size={15} />
                Dispense Counter
              </button>
              <button
                type="button"
                onClick={() => setActiveView("history")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeView === "history"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon icon="solar:history-bold" size={15} />
                Transaction History ({history.length})
              </button>
            </div>
          </div>
        }
      />

      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-700 dark:text-rose-300 text-sm flex items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2.5">
            <Icon icon="solar:danger-triangle-bold" size={20} className="shrink-0 text-rose-600" />
            <span className="font-medium">{errorMessage}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setErrorMessage(null)}
            className="h-6 w-6 p-0 text-rose-600 hover:bg-rose-500/10"
          >
            <Icon icon="solar:close-circle-bold" size={16} />
          </Button>
        </div>
      )}

      {activeView === "pos" ? (
        /* Main POS Dispensing Workspace Grid */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column (2 Cols): Patient Identification, Prescriptions & Medication Cart */}
          <div className="lg:col-span-2 space-y-6">
            {/* Step 1: Patient Identification Card */}
            <Card className="border-border/70 shadow-xs">
              <CardHeader className="pb-3 border-b border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <Icon icon="solar:user-bold-duotone" size={20} />
                  </div>
                  <div>
                    <CardTitle className="text-base font-bold">1. Patient Identification</CardTitle>
                    <p className="text-xs text-muted-foreground">Select registered outpatient or walk-in customer</p>
                  </div>
                </div>

                {/* Mode Selector Toggle */}
                <div className="flex items-center gap-1 bg-muted/70 p-1 rounded-xl text-xs self-start sm:self-center border border-border/50">
                  <button
                    type="button"
                    onClick={() => setIsWalkIn(false)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all ${
                      !isWalkIn
                        ? "bg-background text-emerald-600 dark:text-emerald-400 shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Icon icon="solar:prescription-bold" size={14} />
                    Doctor Prescription
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsWalkIn(true)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all ${
                      isWalkIn
                        ? "bg-background text-emerald-600 dark:text-emerald-400 shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Icon icon="solar:user-bold" size={14} />
                    Walk-In / OTC
                  </button>
                </div>
              </CardHeader>

              <CardContent className="pt-4 space-y-4">
                {!isWalkIn ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs font-semibold text-foreground">Select Registered Outpatient *</Label>
                      <div className="mt-1.5">
                        <EntitySelect
                          doctype="Patient"
                          options={patientOptions}
                          value={selectedPatientId}
                          onChange={setSelectedPatientId}
                          placeholder="Search patient by name, MRN, phone..."
                        />
                      </div>
                    </div>

                    <div>
                      <Label className="text-xs font-semibold text-foreground">Dispensing Pharmacy Warehouse *</Label>
                      <select
                        className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-emerald-500/20 shadow-xs"
                        value={selectedWarehouseId || ""}
                        onChange={(e) => setSelectedWarehouseId(Number(e.target.value) || null)}
                      >
                        {warehouses.map((w) => (
                          <option key={w.id} value={w.id}>
                            {w.warehouse_name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <Label className="text-xs font-semibold text-foreground">Walk-in Customer Name *</Label>
                      <Input
                        placeholder="e.g. John Doe"
                        value={walkInName}
                        onChange={(e) => setWalkInName(e.target.value)}
                        className="mt-1.5 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-semibold text-foreground">Phone Number (Optional)</Label>
                      <Input
                        placeholder="e.g. +251 911 234567"
                        value={walkInPhone}
                        onChange={(e) => setWalkInPhone(e.target.value)}
                        className="mt-1.5 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-semibold text-foreground">Dispensing Warehouse *</Label>
                      <select
                        className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-emerald-500/20 shadow-xs"
                        value={selectedWarehouseId || ""}
                        onChange={(e) => setSelectedWarehouseId(Number(e.target.value) || null)}
                      >
                        {warehouses.map((w) => (
                          <option key={w.id} value={w.id}>
                            {w.warehouse_name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {/* Patient Banner: Allergies & Medical History Warning */}
                {selectedPatient && selectedPatient.allergies && (
                  <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs flex items-center gap-3">
                    <div className="w-7 h-7 rounded-lg bg-amber-500 text-white flex items-center justify-center shrink-0">
                      <Icon icon="solar:danger-triangle-bold" size={16} />
                    </div>
                    <div>
                      <span className="font-bold">CRITICAL PATIENT ALLERGIES: </span>
                      <span>{selectedPatient.allergies}</span>
                    </div>
                  </div>
                )}

                {/* Doctor Prescriptions Found Section */}
                {!isWalkIn && selectedPatientId && (
                  <div className="pt-3 border-t border-border/60 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <Icon icon="solar:document-text-bold" size={15} className="text-emerald-600" />
                        Doctor Prescriptions ({prescriptions.length})
                      </span>
                      {prescriptions.length > 0 && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleAddAllPrescriptions}
                          className="h-7 text-xs gap-1 border-emerald-500/30 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                        >
                          <Icon icon="solar:checklist-bold" size={14} />
                          Load All to Cart
                        </Button>
                      )}
                    </div>

                    {loadingPrescriptions ? (
                      <div className="py-4 text-center text-xs text-muted-foreground">
                        <Icon icon="solar:refresh-circle-bold" size={20} className="animate-spin mx-auto text-emerald-500 mb-1" />
                        Fetching patient prescriptions...
                      </div>
                    ) : prescriptions.length === 0 ? (
                      <div className="p-4 rounded-xl bg-muted/30 border border-border/40 text-xs text-muted-foreground flex items-center gap-2">
                        <Icon icon="solar:info-circle-bold" size={16} className="text-muted-foreground/60" />
                        No pending doctor prescriptions found for this patient. You can add OTC items below.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {prescriptions.map((pr) => {
                          const stockMatch = stockItems.find(
                            (s) => s.item_code.toLowerCase() === pr.drug_code.toLowerCase() ||
                                   s.item_name.toLowerCase() === pr.medication_name.toLowerCase()
                          );
                          const inStock = (stockMatch?.actual_qty ?? 0) > 0;
                          return (
                            <div
                              key={`${pr.source}-${pr.id}`}
                              className="p-3 rounded-xl border border-border/60 bg-muted/20 hover:border-emerald-500/40 transition-all flex items-start justify-between gap-3 text-xs"
                            >
                              <div className="space-y-0.5">
                                <p className="font-bold text-foreground text-sm leading-tight">{pr.medication_name}</p>
                                <p className="text-muted-foreground">
                                  {pr.dosage} {pr.period && `• ${pr.period}`}
                                </p>
                                <p className="text-[11px] text-muted-foreground">
                                  Prescribed by: <span className="font-medium text-foreground">{pr.practitioner_name || "Physician"}</span>
                                </p>
                                <div className="pt-1">
                                  <Badge
                                    variant="outline"
                                    className={`text-[10px] ${
                                      inStock
                                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800"
                                        : "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300 border-rose-300 dark:border-rose-800"
                                    }`}
                                  >
                                    {inStock ? `In Stock (${stockMatch?.actual_qty})` : "Out of Stock"}
                                  </Badge>
                                </div>
                              </div>
                              <Button
                                size="sm"
                                className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white shrink-0 shadow-xs"
                                onClick={() => handleAddPrescriptionToCart(pr)}
                              >
                                <Icon icon="solar:cart-plus-bold" size={14} className="mr-1" />
                                Add
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Step 2: Medication Dispensing Cart */}
            <Card className="border-border/70 shadow-xs">
              <CardHeader className="pb-3 border-b border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <Icon icon="solar:pill-bold-duotone" size={20} />
                  </div>
                  <div>
                    <CardTitle className="text-base font-bold flex items-center gap-2">
                      2. Dispensing Cart
                      <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 font-bold">
                        {cart.length} item{cart.length !== 1 ? "s" : ""}
                      </span>
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">Adjust quantities, instructions, and review line items</p>
                  </div>
                </div>

                {/* Quick Category Filter Pills & OTC Search */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                  <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
                    {(["All", "Antibiotics", "Analgesic", "Gastro", "Cardio"] as const).map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setSelectedCategory(cat)}
                        className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap ${
                          selectedCategory === cat
                            ? "bg-emerald-600 text-white font-semibold shadow-2xs"
                            : "bg-muted text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>

                  <div className="relative w-full sm:w-64">
                    <Input
                      placeholder="Search stock to add OTC drug..."
                      value={otcSearch}
                      onChange={(e) => setOtcSearch(e.target.value)}
                      className="h-9 text-xs pr-8 rounded-lg shadow-xs"
                    />
                    <Icon
                      icon="solar:magnifer-linear"
                      size={16}
                      className="absolute right-2.5 top-2.5 text-muted-foreground pointer-events-none"
                    />

                    {/* Autocomplete Dropdown */}
                    {filteredOtcStock.length > 0 && (
                      <div className="absolute left-0 right-0 top-10 bg-popover border border-border/80 rounded-xl shadow-xl z-50 max-h-64 overflow-y-auto p-1.5 text-xs backdrop-blur-md">
                        {filteredOtcStock.slice(0, 10).map((s) => (
                          <div
                            key={s.item_id}
                            onClick={() => handleAddStockItemToCart(s)}
                            className="p-2.5 hover:bg-muted/80 rounded-lg cursor-pointer flex items-center justify-between transition-colors"
                          >
                            <div>
                              <p className="font-semibold text-foreground text-xs">{s.item_name}</p>
                              <p className="text-[10px] text-muted-foreground font-mono">{s.item_code}</p>
                            </div>
                            <div className="text-right">
                              <span
                                className={`font-bold text-xs ${
                                  s.actual_qty <= 0 ? "text-rose-600" : "text-emerald-600 dark:text-emerald-400"
                                }`}
                              >
                                {s.actual_qty} {s.stock_uom}
                              </span>
                              <p className="text-[10px] text-muted-foreground font-mono">
                                ${s.valuation_rate ? Number(s.valuation_rate).toFixed(2) : "5.00"}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </CardHeader>

              <CardContent className="pt-4">
                {cart.length === 0 ? (
                  <div className="py-14 text-center text-muted-foreground">
                    <div className="w-14 h-14 rounded-2xl bg-muted/60 text-muted-foreground/60 flex items-center justify-center mx-auto mb-3">
                      <Icon icon="solar:cart-bold" size={32} />
                    </div>
                    <p className="text-sm font-bold text-foreground">Dispensing Cart is Empty</p>
                    <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                      Select a registered patient above to load prescriptions, or search medications in the top right to add OTC items.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between pb-1">
                      <span className="text-xs text-muted-foreground font-medium">Line items ({cart.length})</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleClearCart}
                        className="text-xs text-rose-500 hover:text-rose-600 h-6 px-2"
                      >
                        Clear Cart
                      </Button>
                    </div>

                    {cart.map((item, idx) => {
                      const stockMatch = stockItems.find(
                        (s) => s.item_code.toLowerCase() === item.item_code.toLowerCase() ||
                               s.item_name.toLowerCase() === item.item_name.toLowerCase()
                      );
                      const avail = stockMatch?.actual_qty ?? 0;
                      const isShort = item.quantity > avail;

                      return (
                        <div
                          key={idx}
                          className={`p-3.5 rounded-xl border transition-all ${
                            isShort
                              ? "border-rose-300 dark:border-rose-900 bg-rose-50/40 dark:bg-rose-950/20"
                              : "border-border/60 bg-card hover:border-emerald-500/30"
                          }`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex-1 space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-sm text-foreground">{item.item_name}</span>
                                <span className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                                  {item.item_code}
                                </span>
                                {isShort ? (
                                  <Badge className="bg-rose-500/10 text-rose-600 border-rose-300 text-[10px] font-bold">
                                    Shortage ({avail} available)
                                  </Badge>
                                ) : (
                                  <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-300 text-[10px] font-medium">
                                    In Stock ({avail})
                                  </Badge>
                                )}
                              </div>
                              <div>
                                <Input
                                  placeholder="Dosage instructions (e.g. 1 tab PO TID x 5 days after food)..."
                                  value={item.instructions || ""}
                                  onChange={(e) => handleUpdateInstructions(idx, e.target.value)}
                                  className="h-7 text-xs max-w-lg mt-1 rounded-md"
                                />
                              </div>
                            </div>

                            {/* Quantity Stepper, Price & Remove */}
                            <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                              {/* Quantity Stepper */}
                              <div className="flex flex-col items-center">
                                <Label className="text-[10px] text-muted-foreground mb-0.5">Quantity</Label>
                                <div className="flex items-center border border-border/80 rounded-lg bg-background overflow-hidden shadow-2xs">
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateQty(idx, -1)}
                                    className="px-2 py-1 text-muted-foreground hover:bg-muted text-xs font-bold"
                                  >
                                    -
                                  </button>
                                  <input
                                    type="number"
                                    min={1}
                                    value={item.quantity}
                                    onChange={(e) => handleSetExactQty(idx, Number(e.target.value))}
                                    className="w-12 text-center text-xs font-bold border-x border-border/60 focus:outline-none"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateQty(idx, 1)}
                                    className="px-2 py-1 text-muted-foreground hover:bg-muted text-xs font-bold"
                                  >
                                    +
                                  </button>
                                </div>
                              </div>

                              {/* Price */}
                              <div className="w-20">
                                <Label className="text-[10px] text-muted-foreground mb-0.5 block">Price ($)</Label>
                                <Input
                                  type="number"
                                  step="0.5"
                                  min={0}
                                  value={item.unit_price}
                                  onChange={(e) => handleUpdatePrice(idx, Number(e.target.value))}
                                  className="h-7 text-xs text-right font-medium"
                                />
                              </div>

                              {/* Line Total */}
                              <div className="w-20 text-right">
                                <Label className="text-[10px] text-muted-foreground mb-0.5 block">Total</Label>
                                <p className="text-sm font-bold text-foreground">
                                  ${(item.quantity * item.unit_price).toFixed(2)}
                                </p>
                              </div>

                              {/* Remove Button */}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveItem(idx)}
                                className="text-rose-500 hover:text-rose-600 h-8 w-8 p-0 hover:bg-rose-500/10 rounded-lg"
                                title="Remove item"
                              >
                                <Icon icon="solar:trash-bin-trash-bold" size={16} />
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column (1 Col): Billing & Dispense Confirmation */}
          <div className="space-y-6">
            <Card className="border-border/70 shadow-xs sticky top-4">
              <CardHeader className="pb-3 border-b border-border/60 flex flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600">
                    <Icon icon="solar:card-bold-duotone" size={20} />
                  </div>
                  <CardTitle className="text-base font-bold">3. Checkout & Payment</CardTitle>
                </div>
                <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                  Ready
                </Badge>
              </CardHeader>
              <CardContent className="pt-4 space-y-4 text-xs">
                {/* Financial Summary Card */}
                <div className="space-y-2.5 bg-gradient-to-br from-muted/50 to-muted/20 p-4 rounded-xl border border-border/60 shadow-2xs">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Total Medications:</span>
                    <span className="font-semibold text-foreground">{cart.length} line items</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Total Units Dispensed:</span>
                    <span className="font-semibold text-foreground">
                      {cart.reduce((a, b) => a + (b.quantity || 0), 0)} units
                    </span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Tax / Handling:</span>
                    <span className="font-semibold text-foreground">$0.00</span>
                  </div>
                  <div className="flex justify-between items-baseline text-base font-extrabold text-foreground border-t border-border/80 pt-3">
                    <span>Grand Total:</span>
                    <span className="text-2xl text-emerald-600 dark:text-emerald-400 font-mono">
                      ${totalAmount.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Payment Method Selector */}
                <div>
                  <Label className="text-xs font-semibold text-foreground">Payment Method *</Label>
                  <div className="grid grid-cols-2 gap-2 mt-1.5">
                    {(["Cash", "Card", "Insurance", "Mobile Money", "Bill Later"] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setPaymentMethod(mode)}
                        className={`p-2 rounded-xl border text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                          paymentMethod === mode
                            ? "border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 shadow-2xs"
                            : "border-border/70 hover:bg-muted text-muted-foreground"
                        }`}
                      >
                        <Icon
                          icon={
                            mode === "Cash"
                              ? "solar:dollar-bold"
                              : mode === "Card"
                              ? "solar:card-bold"
                              : mode === "Insurance"
                              ? "solar:shield-bold"
                              : mode === "Mobile Money"
                              ? "solar:smartphone-bold"
                              : "solar:clock-circle-bold"
                          }
                          size={14}
                        />
                        {mode}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Cash tender & change calculator */}
                {paymentMethod === "Cash" && (
                  <div className="p-3.5 rounded-xl border border-border/70 bg-muted/20 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-medium">Cash Tendered ($)</Label>
                      <Input
                        type="number"
                        placeholder="0.00"
                        value={cashTendered}
                        onChange={(e) => setCashTendered(e.target.value)}
                        className="w-28 h-8 text-right font-bold text-xs rounded-lg"
                      />
                    </div>
                    {/* Quick Tender Buttons */}
                    <div className="flex items-center gap-1.5 justify-end">
                      <span className="text-[10px] text-muted-foreground mr-1">Quick:</span>
                      {[totalAmount, Math.ceil(totalAmount / 10) * 10, Math.ceil(totalAmount / 50) * 50].filter(Boolean).map((val, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setCashTendered(val.toFixed(2))}
                          className="px-2 py-0.5 rounded bg-muted hover:bg-muted-foreground/15 text-[10px] font-mono font-semibold"
                        >
                          ${val.toFixed(0)}
                        </button>
                      ))}
                    </div>
                    {cashNum > 0 && (
                      <div className="flex justify-between items-baseline font-bold text-emerald-600 dark:text-emerald-400 pt-1 border-t border-border/60">
                        <span className="text-xs">Change Due:</span>
                        <span className="text-sm font-mono">${changeDue.toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Dispenser Notes */}
                <div>
                  <Label className="text-xs font-medium">Dispenser Instructions / Rx Notes</Label>
                  <Input
                    placeholder="e.g. Consulted patient on antibiotic adherence..."
                    value={dispenseNotes}
                    onChange={(e) => setDispenseNotes(e.target.value)}
                    className="mt-1 h-8 text-xs rounded-lg"
                  />
                </div>

                {/* Action Button */}
                <div className="pt-2">
                  <Button
                    className="w-full h-12 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold gap-2 text-sm shadow-md shadow-emerald-600/30 rounded-xl"
                    onClick={handleDispense}
                    disabled={dispensing || cart.length === 0}
                  >
                    <Icon icon="solar:check-circle-bold" size={20} />
                    {dispensing ? "Processing Dispense..." : "Dispense & Deduct Stock"}
                  </Button>
                  <p className="text-[11px] text-muted-foreground text-center mt-2">
                    Deducts warehouse stock balances & prints dispensing label receipt.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : (
        /* History View */
        <Card className="border-border/70 shadow-xs">
          <CardHeader className="pb-3 border-b border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600">
                <Icon icon="solar:history-bold" size={18} />
              </div>
              <div>
                <CardTitle className="text-base font-bold">Recent Outpatient Dispensing Transactions</CardTitle>
                <p className="text-xs text-muted-foreground">Audit logs of completed outpatient dispensary vouchers</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="w-64">
                <Input
                  placeholder="Search voucher or details..."
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  className="h-8 text-xs rounded-lg"
                />
              </div>
              <Button variant="outline" size="sm" onClick={loadHistory} className="text-xs h-8 gap-1">
                <Icon icon="solar:refresh-circle-bold" size={14} /> Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table
              columns={historyColumns}
              dataSource={filteredHistory}
              rowKey="id"
              loading={loadingHistory}
              pagination={{ pageSize: 10 }}
              size="middle"
              className="[&_.ant-table-thead>tr>th]:bg-transparent"
            />
          </CardContent>
        </Card>
      )}

      {/* Receipt Modal */}
      <DispenseReceiptModal
        open={receiptModalOpen}
        onOpenChange={setReceiptModalOpen}
        receipt={receiptData}
      />
    </div>
  );
}
