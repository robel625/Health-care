import { useState, useEffect, useCallback, useMemo } from "react";
import { Icon } from "@/components/icon";
import { Button } from "@/ui/button";
import { Card, CardContent } from "@/ui/card";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/ui/dialog";
import Table, { type ColumnsType } from "antd/es/table";
import { HealthcareApi } from "@/api/services/healthcareService";
import type { MedicalDepartment } from "@/api/services/healthcareService";
import Combobox from "@/components/healthcare/Combobox";

export default function DepartmentsPage() {
  const [data, setData] = useState<MedicalDepartment[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({
    department: "",
    patient_care_type: "Both",
    show_in_portal: false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await HealthcareApi.departments.list({
        page,
        page_size: 50,
        search: searchTerm || undefined,
      });
      setData(res.results || []);
      setTotal(res.count || 0);
    } catch (err) {
      console.error("Failed to load departments:", err);
    } finally {
      setLoading(false);
    }
  }, [page, searchTerm]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleOpenCreate = () => {
    setEditingId(null);
    setForm({ department: "", patient_care_type: "Both", show_in_portal: false });
    setError("");
    setShowForm(true);
  };

  const handleOpenEdit = (dept: MedicalDepartment) => {
    setEditingId(dept.id);
    setForm({
      department: dept.department,
      patient_care_type: dept.patient_care_type || "Both",
      show_in_portal: !!dept.show_in_portal,
    });
    setError("");
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.department.trim()) {
      setError("Department name is required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      if (editingId) {
        await HealthcareApi.departments.update(editingId, {
          department: form.department.trim(),
          patient_care_type: form.patient_care_type,
          show_in_portal: form.show_in_portal,
        });
      } else {
        await HealthcareApi.departments.create({
          department: form.department.trim(),
          patient_care_type: form.patient_care_type,
          show_in_portal: form.show_in_portal,
        });
      }
      setShowForm(false);
      setEditingId(null);
      setForm({ department: "", patient_care_type: "Both", show_in_portal: false });
      loadData();
    } catch (err: any) {
      const detail = err?.response?.data;
      setError(
        detail
          ? typeof detail === "object"
            ? Object.values(detail).flat().join(" ")
            : String(detail)
          : "Could not save department. Please try again."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (confirm(`Are you sure you want to delete "${name}"?`)) {
      try {
        await HealthcareApi.departments.delete(id);
        loadData();
      } catch (err: any) {
        alert(err?.response?.data?.detail || "Could not delete department.");
      }
    }
  };

  const filteredData = useMemo(() => {
    if (!searchTerm) return data;
    const q = searchTerm.toLowerCase();
    return data.filter(
      (d) =>
        d.department.toLowerCase().includes(q) ||
        (d.patient_care_type && d.patient_care_type.toLowerCase().includes(q))
    );
  }, [data, searchTerm]);

  const columns: ColumnsType<MedicalDepartment> = [
    {
      title: "Medical Department",
      dataIndex: "department",
      width: 280,
      render: (text: string, r) => (
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-md bg-amber-50 text-amber-600 dark:bg-amber-950/30">
            <Icon icon="solar:hospital-bold-duotone" size={16} />
          </div>
          <div>
            <span className="font-medium text-sm text-foreground">{text}</span>
            <div className="text-xs text-muted-foreground">ID: #{r.id}</div>
          </div>
        </div>
      ),
    },
    {
      title: "Patient Care Type",
      dataIndex: "patient_care_type",
      width: 200,
      render: (careType: string) => (
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            careType === "Inpatient"
              ? "bg-purple-100 text-purple-700 dark:bg-purple-950/30 dark:text-purple-300"
              : careType === "Outpatient"
              ? "bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300"
              : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
          }`}
        >
          {careType || "Both"}
        </span>
      ),
    },
    {
      title: "Show in Portal",
      dataIndex: "show_in_portal",
      width: 140,
      render: (v: boolean) =>
        v ? (
          <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-medium">
            <Icon icon="solar:check-circle-bold" size={14} /> Yes
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Icon icon="solar:close-circle-bold" size={14} /> No
          </span>
        ),
    },
    {
      title: "Actions",
      width: 100,
      align: "right",
      render: (_, r) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleOpenEdit(r)}
            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
            title="Edit"
          >
            <Icon icon="solar:pen-new-square-bold" size={16} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleDelete(r.id, r.department)}
            className="h-8 w-8 p-0 text-muted-foreground hover:text-red-600"
            title="Delete"
          >
            <Icon icon="solar:trash-bin-trash-bold" size={16} />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Medical Departments</h1>
          <p className="text-muted-foreground text-sm">
            Manage clinical and hospital departments ({total} total)
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-64">
            <Input
              placeholder="Search departments..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-9"
            />
          </div>
          <Button onClick={handleOpenCreate} className="bg-amber-600 hover:bg-amber-700">
            <Icon icon="solar:add-circle-bold-duotone" size={18} className="mr-2" /> New Department
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Table
            columns={columns}
            dataSource={filteredData}
            rowKey="id"
            loading={loading}
            pagination={{
              current: page,
              total,
              pageSize: 50,
              onChange: setPage,
              showTotal: (total) => `${total} departments`,
            }}
          />
        </CardContent>
      </Card>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Edit Medical Department" : "New Medical Department"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Department Name *</Label>
              <Input
                value={form.department}
                onChange={(e) => setForm({ ...form, department: e.target.value })}
                placeholder="e.g. Cardiology, Radiology, Pediatrics"
                className="mt-1"
                autoFocus
              />
            </div>
            <div>
              <Label>Patient Care Type</Label>
              <div className="mt-1">
                <Combobox
                  doctype="Patient Care Type"
                  options={["Inpatient", "Outpatient", "Both"]}
                  value={form.patient_care_type}
                  onChange={(val) => setForm({ ...form, patient_care_type: val })}
                />
              </div>
            </div>
            <div className="pt-2">
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input
                  type="checkbox"
                  checked={form.show_in_portal}
                  onChange={(e) => setForm({ ...form, show_in_portal: e.target.checked })}
                  className="rounded border-input text-amber-600 focus:ring-amber-500"
                />
                <span className="font-medium text-foreground">Show in Patient Portal</span>
              </label>
              <p className="text-xs text-muted-foreground ml-5 mt-0.5">
                Allow patients to view this department and its practitioners online.
              </p>
            </div>
            {error && <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</p>}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowForm(false)} disabled={saving}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {saving ? "Saving..." : editingId ? "Save Changes" : "Create Department"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
