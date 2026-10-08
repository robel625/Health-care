import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router";
import { Icon } from "@/components/icon";
import { Button } from "@/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { Switch } from "@/ui/switch";
import Table, { type ColumnsType } from "antd/es/table";
import Tag from "antd/es/tag";
import PharmacyNavHeader from "./components/PharmacyNavHeader";
import ShortageModal from "./components/ShortageModal";
import EntitySelect, { type EntityOption } from "@/components/healthcare/EntitySelect";
import {
  HealthcareApi,
  type InpatientMedicationEntry,
  type InpatientMedicationEntryDetail,
  type ShortageItem,
  type Patient,
  type MedicalDepartment,
} from "@/api/services/healthcareService";
import { WarehouseApi, type Warehouse } from "@/api/services/erpService";

export default function InpatientMedicationEntryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = !id || id === "new";

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [gettingOrders, setGettingOrders] = useState(false);
  const [checkingStock, setCheckingStock] = useState(false);

  // Shortage modal state
  const [shortageModalOpen, setShortageModalOpen] = useState(false);
  const [shortageItems, setShortageItems] = useState<ShortageItem[]>([]);
  const [stockStatusAlert, setStockStatusAlert] = useState<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(null);

  // Dropdown options
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [serviceUnits, setServiceUnits] = useState<any[]>([]);
  const [departments, setDepartments] = useState<MedicalDepartment[]>([]);

  // Main Form State
  const [formData, setFormData] = useState<Partial<InpatientMedicationEntry>>({
    posting_date: new Date().toISOString().split("T")[0],
    status: "Draft",
    update_stock: true,
    warehouse: null,
    patient: null,
    department: null as number | null,
    service_unit: null,
    item_code: "",
    from_date: null,
    to_date: null,
    from_time: null,
    to_time: null,
    remarks: "",
    medication_orders: [],
  });

  // Load Dropdowns
  useEffect(() => {
    Promise.all([
      WarehouseApi.list().catch(() => ({ results: [] })),
      HealthcareApi.patients.list({ page_size: 200, inpatient_status: "Admitted" }).catch(() => ({ results: [] })),
      HealthcareApi.serviceUnits.list().catch(() => ({ results: [] })),
      HealthcareApi.departments.list({ page_size: 100 }).catch(() => ({ results: [] })),
    ]).then(([whRes, patRes, suRes, deptRes]: any) => {
      const whList = (whRes.results || whRes || []) as Warehouse[];
      setWarehouses(whList);
      setPatients(patRes.results || []);
      setServiceUnits(suRes.results || []);
      setDepartments(deptRes.results || []);

      if (isNew && whList.length > 0 && !formData.warehouse) {
        const pharmWh = whList.find((w) =>
          (w.warehouse_name || "").toLowerCase().includes("pharmacy")
        );
        setFormData((prev) => ({ ...prev, warehouse: pharmWh ? pharmWh.id : whList[0].id }));
      }
    });
  }, [isNew]);

  // Load Entry if editing
  const loadEntry = useCallback(async () => {
    if (isNew) return;
    setLoading(true);
    try {
      const data = await HealthcareApi.inpatientMedicationEntries.get(Number(id));
      setFormData(data);
    } catch (err: any) {
      console.error(err);
      alert(err?.response?.data?.error || "Failed to load medication entry");
    } finally {
      setLoading(false);
    }
  }, [id, isNew]);

  useEffect(() => {
    loadEntry();
  }, [loadEntry]);

  // Save Draft
  const handleSaveDraft = async () => {
    setSaving(true);
    setStockStatusAlert(null);
    try {
      let savedEntry: InpatientMedicationEntry;
      if (isNew) {
        savedEntry = await HealthcareApi.inpatientMedicationEntries.create(formData);
        navigate(`/healthcare/pharmacy/medication-entry/${savedEntry.id}`, { replace: true });
      } else {
        savedEntry = await HealthcareApi.inpatientMedicationEntries.update(Number(id), formData);
        setFormData(savedEntry);
      }
      setStockStatusAlert({ type: "success", message: "Draft saved successfully." });
      return savedEntry;
    } catch (err: any) {
      console.error(err);
      setStockStatusAlert({
        type: "error",
        message: err?.response?.data?.error || err.message || "Failed to save draft.",
      });
      return null;
    } finally {
      setSaving(false);
    }
  };

  // Get Medication Orders (Marley action)
  const handleGetMedicationOrders = async () => {
    let currentId = Number(id);
    if (isNew) {
      const saved = await handleSaveDraft();
      if (!saved) return;
      currentId = saved.id;
    }
    setGettingOrders(true);
    setStockStatusAlert(null);
    try {
      const res = await HealthcareApi.inpatientMedicationEntries.getMedicationOrders(currentId);
      setFormData((prev) => ({
        ...prev,
        medication_orders: res.orders || [],
      }));
      setStockStatusAlert({
        type: "info",
        message: res.message || `Loaded ${res.orders?.length || 0} pending medication orders.`,
      });
    } catch (err: any) {
      console.error(err);
      setStockStatusAlert({
        type: "error",
        message: err?.response?.data?.error || "Failed to fetch medication orders.",
      });
    } finally {
      setGettingOrders(false);
    }
  };

  // Check Stock Shortage (Marley action)
  const handleCheckStockAvailability = async () => {
    if (isNew) {
      alert("Please save draft before checking stock availability.");
      return;
    }
    setCheckingStock(true);
    setStockStatusAlert(null);
    try {
      const res = await HealthcareApi.inpatientMedicationEntries.checkStockShortage(Number(id));
      if (res.has_shortage) {
        setShortageItems(res.shortages || []);
        setShortageModalOpen(true);
      } else {
        setStockStatusAlert({
          type: "success",
          message: res.message || "All medications are in stock and available in sufficient quantity!",
        });
      }
    } catch (err: any) {
      console.error(err);
      setStockStatusAlert({
        type: "error",
        message: err?.response?.data?.error || "Error checking stock availability.",
      });
    } finally {
      setCheckingStock(false);
    }
  };

  // Submit Entry (Marley action)
  const handleSubmitEntry = async () => {
    if (isNew) {
      alert("Please save draft before submitting.");
      return;
    }
    if (!formData.medication_orders || formData.medication_orders.length === 0) {
      alert("Cannot submit entry with no medication orders. Click 'Get Medication Orders' first.");
      return;
    }
    if (!confirm("Confirm submission? This will mark orders completed and issue stock from the warehouse.")) {
      return;
    }
    setSubmitting(true);
    setStockStatusAlert(null);
    try {
      const res = await HealthcareApi.inpatientMedicationEntries.submitEntry(Number(id));
      setStockStatusAlert({
        type: "success",
        message: res.message || `Entry submitted successfully. Stock Entry: ${res.stock_entry_number || ""}`,
      });
      loadEntry();
    } catch (err: any) {
      console.error(err);
      const shortageData = err?.response?.data?.shortages;
      if (shortageData && shortageData.length > 0) {
        setShortageItems(shortageData);
        setShortageModalOpen(true);
      } else {
        setStockStatusAlert({
          type: "error",
          message: err?.response?.data?.error || "Failed to submit entry.",
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Cancel Entry
  const handleCancelEntry = async () => {
    if (!confirm("Are you sure you want to cancel this entry? The associated stock entry will be cancelled.")) {
      return;
    }
    setLoading(true);
    try {
      await HealthcareApi.inpatientMedicationEntries.cancelEntry(Number(id));
      setStockStatusAlert({
        type: "info",
        message: "Medication entry and associated stock entries cancelled.",
      });
      loadEntry();
    } catch (err: any) {
      console.error(err);
      setStockStatusAlert({
        type: "error",
        message: err?.response?.data?.error || "Failed to cancel entry.",
      });
    } finally {
      setLoading(false);
    }
  };

  const patientOptions: EntityOption[] = patients.map((p) => ({
    value: p.id,
    label: p.patient_name || `${p.first_name} ${p.last_name}`,
    sublabel: `ID: ${p.patient_id} • Age: ${p.age || "?"} • ${p.sex || ""}`,
    avatarName: p.patient_name || p.first_name,
  }));

  const orderColumns: ColumnsType<InpatientMedicationEntryDetail> = [
    {
      title: "Drug Code",
      dataIndex: "drug_code",
      width: 130,
      render: (v: string) => <span className="font-mono text-xs font-semibold">{v}</span>,
    },
    {
      title: "Medication Name",
      dataIndex: "drug_name",
      render: (v: string) => <span className="font-medium text-foreground">{v}</span>,
    },
    {
      title: "Dosage",
      dataIndex: "dosage",
      width: 100,
    },
    {
      title: "Dosage Form",
      dataIndex: "dosage_form",
      width: 120,
    },
    {
      title: "Patient",
      dataIndex: "patient_name",
      render: (v: string) => v || "Patient",
    },
    {
      title: "Scheduled Date & Time",
      width: 170,
      render: (_, r) => (
        <span className="text-xs">
          {r.date} {r.time && `at ${r.time}`}
        </span>
      ),
    },
    {
      title: "Quantity",
      dataIndex: "quantity",
      width: 90,
      align: "right",
      render: (v: number) => <span className="font-semibold">{v}</span>,
    },
    {
      title: "Status",
      dataIndex: "is_completed",
      width: 110,
      render: (v: boolean) =>
        v ? (
          <Tag color="green">Completed</Tag>
        ) : (
          <Tag color="orange">Pending</Tag>
        ),
    },
  ];

  const isSubmitted = formData.status === "Submitted";
  const isDraft = formData.status === "Draft";

  return (
    <div className="space-y-6">
      <PharmacyNavHeader
        title={isNew ? "New Inpatient Medication Entry" : `Inpatient Medication Entry: ${formData.entry_id || `IME-${id}`}`}
        subtitle="Dispense inpatient ward medication, validate stock availability, and automatically post stock issue vouchers."
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate("/healthcare/pharmacy/medication-entry")}>
              Back to List
            </Button>
            {isDraft && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSaveDraft}
                  disabled={saving || submitting}
                  className="gap-1.5"
                >
                  <Icon icon="solar:diskette-bold" size={16} />
                  {saving ? "Saving..." : "Save Draft"}
                </Button>
                <Button
                  size="sm"
                  className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={handleSubmitEntry}
                  disabled={submitting || saving}
                >
                  <Icon icon="solar:check-circle-bold" size={16} />
                  {submitting ? "Submitting..." : "Submit Entry"}
                </Button>
              </>
            )}
            {isSubmitted && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-red-600 border-red-200 hover:bg-red-50"
                onClick={handleCancelEntry}
              >
                <Icon icon="solar:close-circle-bold" size={16} />
                Cancel Entry
              </Button>
            )}
          </div>
        }
      />

      {/* Status & Feedback Alert */}
      {stockStatusAlert && (
        <div
          className={`p-4 rounded-lg flex items-center gap-2.5 text-sm ${
            stockStatusAlert.type === "success"
              ? "bg-green-500/10 border border-green-500/20 text-green-700 dark:text-green-300"
              : stockStatusAlert.type === "error"
              ? "bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-300"
              : "bg-blue-500/10 border border-blue-500/20 text-blue-700 dark:text-blue-300"
          }`}
        >
          <Icon
            icon={
              stockStatusAlert.type === "success"
                ? "solar:check-circle-bold"
                : stockStatusAlert.type === "error"
                ? "solar:danger-triangle-bold"
                : "solar:info-circle-bold"
            }
            size={20}
          />
          <span className="font-medium">{stockStatusAlert.message}</span>
        </div>
      )}

      {/* Main Parameters Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3 border-b">
          <div className="flex items-center gap-3">
            <CardTitle className="text-base font-bold">Medication Entry Parameters</CardTitle>
            <Tag color={isSubmitted ? "green" : isDraft ? "orange" : "red"}>
              {formData.status || "Draft"}
            </Tag>
          </div>
          {formData.stock_entry_number && (
            <div className="flex items-center gap-2 text-xs bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 px-3 py-1 rounded-md font-mono">
              <Icon icon="solar:box-minimalistic-bold" size={16} />
              <span>Stock Voucher: <strong>{formData.stock_entry_number}</strong></span>
            </div>
          )}
        </CardHeader>
        <CardContent className="pt-6 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {/* Posting Date */}
            <div>
              <Label className="text-xs font-medium">Posting Date *</Label>
              <Input
                type="date"
                value={formData.posting_date || ""}
                onChange={(e) => setFormData({ ...formData, posting_date: e.target.value })}
                disabled={!isDraft}
                className="mt-1"
              />
            </div>

            {/* Warehouse */}
            <div>
              <Label className="text-xs font-medium">Pharmacy Warehouse *</Label>
              <select
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                value={formData.warehouse || ""}
                onChange={(e) => setFormData({ ...formData, warehouse: Number(e.target.value) || null })}
                disabled={!isDraft}
              >
                <option value="">Select Warehouse...</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.warehouse_name}
                  </option>
                ))}
              </select>
            </div>

            {/* Update Stock Switch */}
            <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
              <div>
                <Label className="text-xs font-semibold cursor-pointer">Update Stock</Label>
                <p className="text-[11px] text-muted-foreground">
                  Post Material Issue Stock Entry on submission
                </p>
              </div>
              <Switch
                checked={formData.update_stock ?? true}
                onCheckedChange={(val) => setFormData({ ...formData, update_stock: val })}
                disabled={!isDraft}
              />
            </div>

            {/* Patient Filter */}
            <div>
              <Label className="text-xs font-medium">Admitted Patient (Optional Filter)</Label>
              <div className="mt-1">
                <EntitySelect
                  doctype="Patient"
                  options={patientOptions}
                  value={formData.patient || null}
                  onChange={(val) => setFormData({ ...formData, patient: val })}
                  placeholder="All Admitted Patients..."
                  disabled={!isDraft}
                />
              </div>
            </div>

            {/* Medical Department Filter */}
            <div>
              <Label className="text-xs font-medium">Medical Department (Optional Filter)</Label>
              <select
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                value={formData.department || ""}
                onChange={(e) => setFormData({ ...formData, department: Number(e.target.value) || null })}
                disabled={!isDraft}
              >
                <option value="">All Medical Departments...</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.department}
                  </option>
                ))}
              </select>
            </div>

            {/* Service Unit / Ward */}
            <div>
              <Label className="text-xs font-medium">Service Unit / Ward (Optional Filter)</Label>
              <select
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                value={formData.service_unit || ""}
                onChange={(e) => setFormData({ ...formData, service_unit: Number(e.target.value) || null })}
                disabled={!isDraft}
              >
                <option value="">All Service Units...</option>
                {serviceUnits.map((su) => (
                  <option key={su.id} value={su.id}>
                    {su.service_unit_name}
                  </option>
                ))}
              </select>
            </div>

            {/* Drug / Item Code Filter */}
            <div>
              <Label className="text-xs font-medium">Drug / Item Code (Optional Filter)</Label>
              <Input
                placeholder="Filter by drug code..."
                value={formData.item_code || ""}
                onChange={(e) => setFormData({ ...formData, item_code: e.target.value })}
                disabled={!isDraft}
                className="mt-1"
              />
            </div>

            {/* From Date & To Date */}
            <div>
              <Label className="text-xs font-medium">From Date (Scheduled)</Label>
              <Input
                type="date"
                value={formData.from_date || ""}
                onChange={(e) => setFormData({ ...formData, from_date: e.target.value || null })}
                disabled={!isDraft}
                className="mt-1"
              />
            </div>

            <div>
              <Label className="text-xs font-medium">To Date (Scheduled)</Label>
              <Input
                type="date"
                value={formData.to_date || ""}
                onChange={(e) => setFormData({ ...formData, to_date: e.target.value || null })}
                disabled={!isDraft}
                className="mt-1"
              />
            </div>

            {/* Remarks */}
            <div>
              <Label className="text-xs font-medium">Remarks / Dispensing Notes</Label>
              <Input
                placeholder="Ward notes, nurse instructions..."
                value={formData.remarks || ""}
                onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                disabled={!isDraft}
                className="mt-1"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Medication Orders Child Table (Marley Parity) */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b">
          <div>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Icon icon="solar:pill-bold-duotone" size={20} className="text-emerald-600" />
              Medication Orders ({formData.medication_orders?.length || 0})
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Inpatient orders scheduled for administration from active inpatient records.
            </p>
          </div>

          {isDraft && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={handleGetMedicationOrders}
                disabled={gettingOrders}
              >
                <Icon icon="solar:refresh-circle-bold" size={16} />
                {gettingOrders ? "Fetching..." : "Get Medication Orders"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-blue-600 border-blue-200 hover:bg-blue-50"
                onClick={handleCheckStockAvailability}
                disabled={checkingStock || !formData.medication_orders?.length}
              >
                <Icon icon="solar:box-minimalistic-bold" size={16} />
                {checkingStock ? "Checking..." : "Check Stock Shortage"}
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent className="pt-4">
          <Table
            columns={orderColumns}
            dataSource={formData.medication_orders || []}
            rowKey={(r, idx) => r.id || idx || 0}
            pagination={false}
            loading={loading || gettingOrders}
            locale={{
              emptyText: (
                <div className="py-8 text-center">
                  <Icon icon="solar:clipboard-list-bold-duotone" size={32} className="mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm font-medium">No medication orders loaded yet.</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Click &ldquo;Get Medication Orders&rdquo; above to query scheduled doses for admitted patients.
                  </p>
                </div>
              ),
            }}
          />
        </CardContent>
      </Card>

      {/* Shortage Modal */}
      <ShortageModal
        open={shortageModalOpen}
        onOpenChange={setShortageModalOpen}
        shortages={shortageItems}
        entryId={Number(id)}
        onStockEntryCreated={() => {
          handleCheckStockAvailability();
        }}
      />
    </div>
  );
}
