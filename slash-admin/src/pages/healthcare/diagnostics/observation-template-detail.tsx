import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router";
import { Icon } from "@/components/icon";
import { Button } from "@/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/ui/card";
import { Input } from "@/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/ui/dialog";
import Table, { type ColumnsType } from "antd/es/table";
import {
  HealthcareApi,
  type ObservationTemplate,
  type ObservationReferenceRange,
  type LabTestUOM,
  type MedicalDepartment,
} from "@/api/services/healthcareService";
import { toast } from "sonner";

const CATEGORIES = [
  "Vital Signs",
  "Hematology",
  "Biochemistry",
  "Immunology",
  "Urinalysis",
  "Cardiac",
  "Microbiology",
  "Endocrinology",
  "Serology",
  "Toxicology",
  "General",
];

const DATA_TYPES = ["Quantity", "Select", "Boolean", "Text", "Grouping"];
const APPLIES_TO_OPTIONS = ["All", "Male", "Female", "Pediatric", "Geriatric", "Infant"];

export default function ObservationTemplateDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isNew = id === "new";

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uoms, setUoms] = useState<LabTestUOM[]>([]);
  const [departments, setDepartments] = useState<MedicalDepartment[]>([]);

  // Form State
  const [formData, setFormData] = useState<Partial<ObservationTemplate>>({
    observation: "",
    observation_category: "Biochemistry",
    preferred_display_name: "",
    abbr: "",
    permitted_data_type: "Quantity",
    permitted_unit: "",
    sample_collection_required: false,
    is_active: true,
    description: "",
    department: null,
  });

  // Reference Ranges State
  const [ranges, setRanges] = useState<ObservationReferenceRange[]>([]);
  const [rangeModalOpen, setRangeModalOpen] = useState(false);
  const [editingRange, setEditingRange] = useState<Partial<ObservationReferenceRange> | null>(null);
  const [savingRange, setSavingRange] = useState(false);

  // Load masters
  useEffect(() => {
    HealthcareApi.uoms.list({ page_size: 200 }).then((res) => setUoms(res.results || [])).catch(() => {});
    HealthcareApi.departments.list({ page_size: 100 }).then((res) => setDepartments(res.results || [])).catch(() => {});
  }, []);

  // Load template details
  const loadTemplate = useCallback(async () => {
    if (isNew || !id) return;
    setLoading(true);
    try {
      const templateRes = await HealthcareApi.observationTemplates.get(Number(id));
      setFormData(templateRes);

      // Load reference ranges
      const rangesRes = await HealthcareApi.observationReferenceRanges.list({
        observation_template: Number(id),
      });
      setRanges(rangesRes.results || []);
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to load observation template details");
    } finally {
      setLoading(false);
    }
  }, [id, isNew]);

  useEffect(() => {
    loadTemplate();
  }, [loadTemplate]);

  const handleSave = async () => {
    if (!formData.observation?.trim()) {
      toast.error("Observation Name is required");
      return;
    }

    setSaving(true);
    try {
      if (isNew) {
        const created = await HealthcareApi.observationTemplates.create(formData);
        toast.success("Observation Template created successfully");
        navigate(`/healthcare/observation-templates/${created.id}`);
      } else {
        await HealthcareApi.observationTemplates.update(Number(id), formData);
        toast.success("Observation Template updated successfully");
        loadTemplate();
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err?.response?.data?.observation?.[0] || err?.message || "Failed to save template");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this template and all its reference ranges?")) return;
    try {
      await HealthcareApi.observationTemplates.delete(Number(id));
      toast.success("Observation Template deleted");
      navigate("/healthcare/observation-templates");
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete template");
    }
  };

  // Open range modal
  const openRangeModal = (range?: ObservationReferenceRange) => {
    if (range) {
      setEditingRange({ ...range });
    } else {
      setEditingRange({
        observation_template: Number(id),
        applies_to: "All",
        age_from: 0,
        age_to: 120,
        normal_from: "",
        normal_to: "",
        abnormal_from: "",
        abnormal_to: "",
        short_interpretation: "Normal",
        long_interpretation: "",
      });
    }
    setRangeModalOpen(true);
  };

  const handleSaveRange = async () => {
    if (!editingRange) return;
    if (isNew) {
      toast.error("Please save the Observation Template first before adding reference ranges");
      return;
    }

    setSavingRange(true);
    try {
      const payload = {
        ...editingRange,
        observation_template: Number(id),
      };

      if (editingRange.id) {
        await HealthcareApi.observationReferenceRanges.update(editingRange.id, payload);
        toast.success("Reference range updated");
      } else {
        await HealthcareApi.observationReferenceRanges.create(payload);
        toast.success("Reference range added");
      }
      setRangeModalOpen(false);
      setEditingRange(null);
      // Reload ranges
      const rangesRes = await HealthcareApi.observationReferenceRanges.list({
        observation_template: Number(id),
      });
      setRanges(rangesRes.results || []);
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to save reference range");
    } finally {
      setSavingRange(false);
    }
  };

  const handleDeleteRange = async (rangeId: number) => {
    if (!confirm("Remove this reference range?")) return;
    try {
      await HealthcareApi.observationReferenceRanges.delete(rangeId);
      toast.success("Reference range removed");
      setRanges((prev) => prev.filter((r) => r.id !== rangeId));
    } catch (err: any) {
      toast.error("Failed to remove reference range");
    }
  };

  const rangeColumns: ColumnsType<ObservationReferenceRange> = [
    {
      title: "Applies To",
      dataIndex: "applies_to",
      width: 120,
      render: (v: string) => (
        <span className="font-medium text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
          {v || "All"}
        </span>
      ),
    },
    {
      title: "Age Range",
      width: 140,
      render: (_, r) => (
        <span className="text-xs">
          {r.age_from != null ? r.age_from : 0} - {r.age_to != null ? r.age_to : 120} yrs
        </span>
      ),
    },
    {
      title: "Normal Range",
      width: 160,
      render: (_, r) => (
        <span className="font-semibold text-emerald-600 dark:text-emerald-400">
          {r.normal_from || "—"} {r.normal_to ? `to ${r.normal_to}` : ""} {formData.permitted_unit}
        </span>
      ),
    },
    {
      title: "Abnormal Range",
      width: 160,
      render: (_, r) => (
        <span className="text-xs text-rose-600 dark:text-rose-400 font-mono">
          {r.abnormal_from ? `< ${r.abnormal_from}` : ""}
          {r.abnormal_from && r.abnormal_to ? " or " : ""}
          {r.abnormal_to ? `> ${r.abnormal_to}` : ""}
        </span>
      ),
    },
    {
      title: "Interpretation",
      dataIndex: "short_interpretation",
      render: (v: string) => <span className="text-xs text-muted-foreground">{v || "—"}</span>,
    },
    {
      title: "Actions",
      width: 90,
      render: (_, r) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={() => openRangeModal(r)} title="Edit">
            <Icon icon="solar:pen-bold" size={14} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleDeleteRange(r.id)}
            className="text-red-500 hover:text-red-700"
            title="Delete"
          >
            <Icon icon="solar:trash-bin-trash-bold" size={14} />
          </Button>
        </div>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Icon icon="solar:spinner-line-duotone" className="animate-spin text-emerald-600" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/healthcare/observation-templates")}
          >
            <Icon icon="solar:arrow-left-linear" size={18} className="mr-1" /> Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold">
              {isNew ? "New Observation Template" : formData.observation}
            </h1>
            <p className="text-xs text-muted-foreground">
              {isNew
                ? "Define a new clinical measurement template matching Marley specifications"
                : `Observation Template #${id} • Category: ${formData.observation_category || "Unassigned"}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isNew && (
            <Button variant="destructive" size="sm" onClick={handleDelete}>
              <Icon icon="solar:trash-bin-trash-bold" size={16} className="mr-1" /> Delete
            </Button>
          )}
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {saving ? (
              <Icon icon="solar:spinner-line-duotone" className="animate-spin mr-2" size={16} />
            ) : (
              <Icon icon="solar:disk-bold" className="mr-2" size={16} />
            )}
            {isNew ? "Create Template" : "Save Changes"}
          </Button>
        </div>
      </div>

      {/* Main Details Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Icon icon="solar:notes-minimalistic-bold" className="text-emerald-600" size={20} />
            Template Master Details
          </CardTitle>
          <CardDescription>
            Core clinical parameters, data types, units, and departmental associations
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">
                Observation Name <span className="text-red-500">*</span>
              </label>
              <Input
                placeholder="e.g. Blood Urea Nitrogen, Pulse Rate"
                value={formData.observation || ""}
                onChange={(e) => setFormData({ ...formData, observation: e.target.value })}
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">
                Observation Category
              </label>
              <select
                value={formData.observation_category || ""}
                onChange={(e) => setFormData({ ...formData, observation_category: e.target.value })}
                className="w-full h-9 px-3 rounded-md border text-sm bg-background"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">
                Preferred Display Name
              </label>
              <Input
                placeholder="e.g. BUN, Resting Heart Rate"
                value={formData.preferred_display_name || ""}
                onChange={(e) => setFormData({ ...formData, preferred_display_name: e.target.value })}
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">
                Abbreviation (abbr)
              </label>
              <Input
                placeholder="e.g. BUN, PR, WBC"
                value={formData.abbr || ""}
                onChange={(e) => setFormData({ ...formData, abbr: e.target.value })}
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">
                Permitted Data Type
              </label>
              <select
                value={formData.permitted_data_type || "Quantity"}
                onChange={(e) => setFormData({ ...formData, permitted_data_type: e.target.value })}
                className="w-full h-9 px-3 rounded-md border text-sm bg-background"
              >
                {DATA_TYPES.map((dt) => (
                  <option key={dt} value={dt}>
                    {dt}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">
                Permitted Unit (UOM)
              </label>
              <div className="flex gap-2">
                <select
                  value={formData.permitted_unit || ""}
                  onChange={(e) => setFormData({ ...formData, permitted_unit: e.target.value })}
                  className="w-full h-9 px-3 rounded-md border text-sm bg-background font-mono"
                >
                  <option value="">(None / Text / Ratio)</option>
                  {uoms.map((u) => (
                    <option key={u.id} value={u.lab_test_uom}>
                      {u.lab_test_uom} {u.uom_description ? `— ${u.uom_description}` : ""}
                    </option>
                  ))}
                </select>
                <Input
                  placeholder="or custom unit"
                  value={formData.permitted_unit || ""}
                  onChange={(e) => setFormData({ ...formData, permitted_unit: e.target.value })}
                  className="max-w-[140px]"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">
                Medical Department
              </label>
              <select
                value={formData.department || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    department: e.target.value ? Number(e.target.value) : null,
                  })
                }
                className="w-full h-9 px-3 rounded-md border text-sm bg-background"
              >
                <option value="">All Departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.department}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-6 pt-5">
              <label className="flex items-center gap-2 cursor-pointer text-sm font-medium">
                <input
                  type="checkbox"
                  className="rounded w-4 h-4 text-emerald-600"
                  checked={Boolean(formData.sample_collection_required)}
                  onChange={(e) =>
                    setFormData({ ...formData, sample_collection_required: e.target.checked })
                  }
                />
                Sample Collection Required
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-sm font-medium">
                <input
                  type="checkbox"
                  className="rounded w-4 h-4 text-emerald-600"
                  checked={Boolean(formData.is_active)}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                />
                Active Template
              </label>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-1">
              Clinical Description & Notes
            </label>
            <textarea
              rows={3}
              placeholder="Clinical significance, methodology, or specimen handling instructions..."
              value={formData.description || ""}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full p-2.5 rounded-md border text-sm bg-background"
            />
          </div>
        </CardContent>
      </Card>

      {/* Reference Ranges (Marley Child Table) */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Icon icon="solar:chart-square-bold" className="text-blue-600" size={20} />
              Observation Reference Ranges
            </CardTitle>
            <CardDescription>
              Marley clinical evaluation criteria based on demographic group and normal boundaries
            </CardDescription>
          </div>
          <Button
            size="sm"
            onClick={() => openRangeModal()}
            disabled={isNew}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Icon icon="solar:add-circle-bold" size={16} className="mr-1.5" /> Add Reference Range
          </Button>
        </CardHeader>
        <CardContent>
          {isNew ? (
            <div className="p-8 text-center border-2 border-dashed rounded-lg bg-muted/20">
              <Icon icon="solar:info-circle-line-duotone" size={32} className="mx-auto text-muted-foreground mb-2" />
              <p className="text-sm font-medium text-muted-foreground">
                Please save this Observation Template first before defining demographic reference ranges.
              </p>
            </div>
          ) : (
            <Table
              columns={rangeColumns}
              dataSource={ranges}
              rowKey="id"
              pagination={false}
              locale={{ emptyText: "No reference ranges defined for this template yet." }}
            />
          )}
        </CardContent>
      </Card>

      {/* Add / Edit Reference Range Dialog */}
      <Dialog open={rangeModalOpen} onOpenChange={setRangeModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingRange?.id ? "Edit Reference Range" : "Add Reference Range"}
            </DialogTitle>
          </DialogHeader>

          {editingRange && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">
                    Applies To
                  </label>
                  <select
                    value={editingRange.applies_to || "All"}
                    onChange={(e) =>
                      setEditingRange({ ...editingRange, applies_to: e.target.value })
                    }
                    className="w-full h-9 px-3 rounded-md border text-sm bg-background"
                  >
                    {APPLIES_TO_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">
                    Short Interpretation
                  </label>
                  <Input
                    placeholder="e.g. Normal, Optimal"
                    value={editingRange.short_interpretation || ""}
                    onChange={(e) =>
                      setEditingRange({
                        ...editingRange,
                        short_interpretation: e.target.value,
                      })
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">
                    Age From (Years)
                  </label>
                  <Input
                    type="number"
                    value={editingRange.age_from != null ? editingRange.age_from : 0}
                    onChange={(e) =>
                      setEditingRange({
                        ...editingRange,
                        age_from: Number(e.target.value),
                      })
                    }
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">
                    Age To (Years)
                  </label>
                  <Input
                    type="number"
                    value={editingRange.age_to != null ? editingRange.age_to : 120}
                    onChange={(e) =>
                      setEditingRange({
                        ...editingRange,
                        age_to: Number(e.target.value),
                      })
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-emerald-600 block mb-1">
                    Normal From ({formData.permitted_unit || "value"})
                  </label>
                  <Input
                    placeholder="e.g. 70"
                    value={editingRange.normal_from || ""}
                    onChange={(e) =>
                      setEditingRange({ ...editingRange, normal_from: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-emerald-600 block mb-1">
                    Normal To ({formData.permitted_unit || "value"})
                  </label>
                  <Input
                    placeholder="e.g. 99"
                    value={editingRange.normal_to || ""}
                    onChange={(e) =>
                      setEditingRange({ ...editingRange, normal_to: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-rose-600 block mb-1">
                    Abnormal From (&lt; threshold)
                  </label>
                  <Input
                    placeholder="e.g. 60"
                    value={editingRange.abnormal_from || ""}
                    onChange={(e) =>
                      setEditingRange({ ...editingRange, abnormal_from: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-rose-600 block mb-1">
                    Abnormal To (&gt; threshold)
                  </label>
                  <Input
                    placeholder="e.g. 126"
                    value={editingRange.abnormal_to || ""}
                    onChange={(e) =>
                      setEditingRange({ ...editingRange, abnormal_to: e.target.value })
                    }
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">
                  Long Interpretation / Clinical Advisory
                </label>
                <textarea
                  rows={2}
                  placeholder="Optional detailed clinical note regarding critical or panic values..."
                  value={editingRange.long_interpretation || ""}
                  onChange={(e) =>
                    setEditingRange({
                      ...editingRange,
                      long_interpretation: e.target.value,
                    })
                  }
                  className="w-full p-2 rounded-md border text-sm bg-background"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setRangeModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveRange}
              disabled={savingRange}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {savingRange && (
                <Icon icon="solar:spinner-line-duotone" className="animate-spin mr-1.5" size={16} />
              )}
              Save Range
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
