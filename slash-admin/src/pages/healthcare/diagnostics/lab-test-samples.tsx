import { useState, useEffect, useCallback } from "react";
import { Icon } from "@/components/icon";
import { Button } from "@/ui/button";
import { Card, CardContent } from "@/ui/card";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/ui/dialog";
import Table, { type ColumnsType } from "antd/es/table";
import Combobox from "@/components/healthcare/Combobox";
import { HealthcareApi } from "@/api/services/healthcareService";
import type { LabTestSample, LabTestUOM } from "@/api/services/healthcareService";
import { useDoctypePermissions } from "@/utils/permissions";
import { toast } from "sonner";

/** The empty row Marley's "New Lab Test Sample" starts from. */
const emptySample = () => ({
  sample: "",
  sample_uom: null as number | null,
  sample_type: null as number | null,
  container_closure_color: "",
});

const COLOR_MAP: Record<string, string> = {
  lavender: "#9370DB",
  purple: "#8A2BE2",
  gold: "#FFD700",
  yellow: "#FFEE58",
  "light blue": "#38BDF8",
  blue: "#0284C7",
  red: "#EF4444",
  green: "#10B981",
  gray: "#9CA3AF",
  grey: "#9CA3AF",
  pink: "#F472B6",
  "royal blue": "#2563EB",
  white: "#F8FAFC",
  clear: "#E2E8F0",
  brown: "#A0522D",
  orange: "#FB923C",
};

const COMMON_CAP_COLORS = [
  "Lavender",
  "Gold",
  "Light Blue",
  "Red",
  "Green",
  "Gray",
  "Yellow",
  "Royal Blue",
  "Pink",
  "White",
  "Clear",
  "Brown",
];

export default function LabTestSamplesPage() {
  const { canCreate, canWrite, canDelete } = useDoctypePermissions("Lab Test Sample");
  const [data, setData] = useState<LabTestSample[]>([]);
  const [uoms, setUoms] = useState<LabTestUOM[]>([]);
  const [sampleTypes, setSampleTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");

  // Modal State
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<LabTestSample | null>(null);
  const [form, setForm] = useState(emptySample());

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = { page, page_size: 20 };
      if (search) params.search = search;
      const res = await HealthcareApi.labTestSamples.list(params);
      setData(res.results || []);
      setTotal(res.count || 0);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Load master dropdown options
  useEffect(() => {
    HealthcareApi.labTestUOMs
      .list({ page_size: 200 })
      .then((res) => setUoms(res.results || []))
      .catch(() => {});
    HealthcareApi.sampleTypes
      .list()
      .then((res: any) => setSampleTypes(res?.results || res || []))
      .catch(() => {});
  }, []);

  const handleOpenNew = () => {
    setEditingItem(null);
    setForm(emptySample());
    setShowForm(true);
  };

  const handleOpenEdit = (sample: LabTestSample) => {
    setEditingItem(sample);
    setForm({
      sample: sample.sample,
      sample_uom: sample.sample_uom || null,
      sample_type: sample.sample_type || null,
      container_closure_color: sample.container_closure_color || "",
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.sample.trim()) {
      toast.error("Please enter a Sample name");
      return;
    }

    setSaving(true);
    try {
      if (editingItem) {
        await HealthcareApi.labTestSamples.update(editingItem.id, form);
        toast.success("Lab Test Sample updated successfully");
      } else {
        await HealthcareApi.labTestSamples.create(form);
        toast.success("Lab Test Sample created successfully");
      }
      setShowForm(false);
      setEditingItem(null);
      setForm(emptySample());
      loadData();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Failed to save sample");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Are you sure you want to delete '${name}'?`)) return;
    try {
      await HealthcareApi.labTestSamples.delete(id);
      toast.success("Lab Test Sample deleted");
      loadData();
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete sample");
    }
  };

  const activeCapBg =
    COLOR_MAP[form.container_closure_color.toLowerCase().trim()] || "#CBD5E1";

  const columns: ColumnsType<LabTestSample> = [
    {
      title: "Sample Name",
      dataIndex: "sample",
      width: 260,
      render: (v: string, r: LabTestSample) => (
        canWrite ? (
          <span
            className="font-medium text-emerald-600 hover:text-emerald-700 cursor-pointer hover:underline flex items-center gap-1.5"
            onClick={() => handleOpenEdit(r)}
            title="Click to edit sample"
          >
            {v}
            <Icon icon="solar:pen-linear" size={14} className="text-muted-foreground" />
          </span>
        ) : (
          <span className="font-medium">{v}</span>
        )
      ),
    },
    {
      title: "UOM",
      dataIndex: "sample_uom_name",
      width: 110,
      render: (v: string) => v || <span className="text-muted-foreground">-</span>,
    },
    {
      title: "Sample Type",
      dataIndex: "sample_type_name",
      width: 160,
      render: (v: string) => (
        v ? (
          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
            {v}
          </span>
        ) : (
          <span className="text-muted-foreground">-</span>
        )
      ),
    },
    {
      title: "Container Closure Color",
      dataIndex: "container_closure_color",
      width: 220,
      render: (v: string) => {
        if (!v) return <span className="text-muted-foreground">-</span>;
        const bg = COLOR_MAP[v.toLowerCase().trim()] || "#CBD5E1";
        return (
          <div className="flex items-center gap-2">
            <span
              className="w-3.5 h-3.5 rounded-full border shadow-xs flex-shrink-0"
              style={{ backgroundColor: bg }}
            />
            <span className="font-medium text-sm">{v}</span>
          </div>
        );
      },
    },
    {
      title: "Actions",
      width: 100,
      render: (_, r) => (
        <div className="flex items-center gap-1">
          {canWrite && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleOpenEdit(r)}
              title="Edit Sample"
              className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
            >
              <Icon icon="solar:pen-bold" size={16} />
            </Button>
          )}
          {canDelete && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleDelete(r.id, r.sample)}
              title="Delete Sample"
              className="text-rose-500 hover:text-rose-700 hover:bg-rose-50"
            >
              <Icon icon="solar:trash-bin-trash-bold" size={16} />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4 max-w-6xl mx-auto pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Lab Test Samples</h1>
          <p className="text-sm text-muted-foreground">
            {total} clinical specimens & specimen tube parameters
          </p>
        </div>
        {canCreate && (
          <Button
            onClick={handleOpenNew}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
          >
            <Icon icon="solar:add-circle-bold" size={18} className="mr-2" /> New Sample
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div className="relative w-72">
              <Icon
                icon="solar:magnifer-linear"
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                placeholder="Search specimen or cap color..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-9"
              />
            </div>
          </div>
          <Table
            columns={columns}
            dataSource={data}
            rowKey="id"
            loading={loading}
            pagination={{ current: page, total, pageSize: 20, onChange: setPage }}
          />
        </CardContent>
      </Card>

      {/* Edit / Create Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Icon
                icon={editingItem ? "solar:pen-bold" : "solar:test-tube-bold"}
                className="text-emerald-600"
                size={20}
              />
              {editingItem ? "Edit Lab Test Sample" : "New Lab Test Sample"}
            </DialogTitle>
            <DialogDescription>
              {editingItem
                ? `Update specimen parameters, UOM, and container closure color for '${editingItem.sample}'`
                : "Create a new clinical specimen master with tube cap color and measurement units"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs font-semibold">
                Sample Name <span className="text-red-500">*</span>
              </Label>
              <Input
                value={form.sample}
                onChange={(e) => setForm({ ...form, sample: e.target.value })}
                placeholder="e.g. Whole Blood (EDTA), Serum (SST), Synovial Fluid"
                className="mt-1 font-medium"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">Unit of Measurement (UOM)</Label>
                <Combobox
                  doctype="Lab Test UOM"
                  rawItems={uoms}
                  options={uoms.map((u) => u.lab_test_uom)}
                  value={uoms.find((u) => u.id === form.sample_uom)?.lab_test_uom || ""}
                  onChange={(name) =>
                    setForm({
                      ...form,
                      sample_uom: uoms.find((u) => u.lab_test_uom === name)?.id ?? null,
                    })
                  }
                  onItemCreated={(created) => {
                    if (created) {
                      setUoms((prev) => [...prev, created]);
                      setForm((f) => ({ ...f, sample_uom: created.id }));
                    }
                  }}
                  className="mt-1"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold">Sample Type</Label>
                <Combobox
                  doctype="Sample Type"
                  rawItems={sampleTypes}
                  options={sampleTypes.map((s) => s.sample_type)}
                  value={
                    sampleTypes.find((s) => s.id === form.sample_type)?.sample_type || ""
                  }
                  onChange={(name) =>
                    setForm({
                      ...form,
                      sample_type:
                        sampleTypes.find((s) => s.sample_type === name)?.id ?? null,
                    })
                  }
                  onItemCreated={(created) => {
                    if (created) {
                      setSampleTypes((prev) => [...prev, created]);
                      setForm((f) => ({ ...f, sample_type: created.id }));
                    }
                  }}
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold">Container Closure Color (Cap Color)</Label>
              <div className="flex items-center gap-2 mt-1">
                <span
                  className="w-5 h-5 rounded-full border shadow-xs flex-shrink-0"
                  style={{ backgroundColor: activeCapBg }}
                />
                <Input
                  value={form.container_closure_color}
                  onChange={(e) =>
                    setForm({ ...form, container_closure_color: e.target.value })
                  }
                  placeholder="e.g. Lavender, Gold, Light Blue, Green, Red"
                  className="font-medium"
                />
              </div>

              {/* Quick color preset chips */}
              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                {COMMON_CAP_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setForm({ ...form, container_closure_color: c })}
                    className="text-[11px] px-2 py-0.5 rounded border bg-slate-50 hover:bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors"
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="outline" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
            >
              {saving ? (
                <Icon icon="solar:spinner-line-duotone" className="animate-spin mr-1.5" size={16} />
              ) : (
                <Icon icon="solar:disk-bold" className="mr-1.5" size={16} />
              )}
              {editingItem ? "Save Changes" : "Create Sample"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
