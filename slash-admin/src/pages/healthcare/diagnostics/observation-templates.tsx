import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router";
import { Icon } from "@/components/icon";
import { Button } from "@/ui/button";
import { Card, CardContent } from "@/ui/card";
import { Input } from "@/ui/input";
import Table, { type ColumnsType } from "antd/es/table";
import { HealthcareApi } from "@/api/services/healthcareService";
import type { ObservationTemplate } from "@/api/services/healthcareService";
import { useDoctypePermissions } from "@/utils/permissions";
import { toast } from "sonner";

const dataTypeBadgeColor: Record<string, string> = {
  Quantity: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  Select: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
  Boolean: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  Text: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  Grouping: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300",
};

const categoryBadgeColor: Record<string, string> = {
  "Vital Signs": "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  Hematology: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
  Biochemistry: "bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300",
  Immunology: "bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300",
  Urinalysis: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  Cardiac: "bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-300",
  Microbiology: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  Endocrinology: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
};

export default function ObservationTemplatesPage() {
  const { canCreate, canDelete } = useDoctypePermissions("Observation");
  const navigate = useNavigate();
  const [data, setData] = useState<ObservationTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [dataTypeFilter, setDataTypeFilter] = useState("");
  const [showInactive, setShowInactive] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = { page, page_size: 20 };
      if (search) params.search = search;
      if (categoryFilter) params.observation_category = categoryFilter;
      if (dataTypeFilter) params.permitted_data_type = dataTypeFilter;
      if (!showInactive) params.is_active = true;

      const res = await HealthcareApi.observationTemplates.list(params);
      setData(res.results || []);
      setTotal(res.count || 0);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load observation templates");
    } finally {
      setLoading(false);
    }
  }, [page, search, categoryFilter, dataTypeFilter, showInactive]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this observation template?")) return;
    try {
      await HealthcareApi.observationTemplates.delete(id);
      toast.success("Template deleted successfully");
      loadData();
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete template");
    }
  };

  const columns: ColumnsType<ObservationTemplate> = [
    {
      title: "Observation",
      dataIndex: "observation",
      width: 240,
      render: (v: string, r) => (
        <div>
          <button
            type="button"
            onClick={() => navigate(`/healthcare/observation-templates/${r.id}`)}
            className="font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 hover:underline text-left"
          >
            {v}
          </button>
          {r.abbr && <span className="ml-2 text-xs text-muted-foreground font-mono">({r.abbr})</span>}
        </div>
      ),
    },
    {
      title: "Category",
      dataIndex: "observation_category",
      width: 160,
      render: (v: string) =>
        v ? (
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${categoryBadgeColor[v] || "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"}`}>
            {v}
          </span>
        ) : (
          "—"
        ),
    },
    {
      title: "Display Name",
      dataIndex: "preferred_display_name",
      width: 200,
      render: (v: string) => v || "—",
    },
    {
      title: "Data Type",
      dataIndex: "permitted_data_type",
      width: 140,
      render: (v: string) =>
        v ? (
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${dataTypeBadgeColor[v] || "bg-gray-100 text-gray-700"}`}>
            {v}
          </span>
        ) : (
          "—"
        ),
    },
    {
      title: "Permitted Unit",
      dataIndex: "permitted_unit",
      width: 120,
      render: (v: string) => (v ? <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{v}</code> : "—"),
    },
    {
      title: "Sample Req.",
      dataIndex: "sample_collection_required",
      width: 110,
      render: (v: boolean) =>
        v ? (
          <span className="text-xs px-2 py-0.5 rounded bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 font-medium">
            Required
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">No</span>
        ),
    },
    {
      title: "Status",
      dataIndex: "is_active",
      width: 100,
      render: (v: boolean) => (
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${v ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300" : "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"}`}>
          {v ? "Active" : "Inactive"}
        </span>
      ),
    },
    {
      title: "Actions",
      width: 100,
      render: (_, r) => (
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/healthcare/observation-templates/${r.id}`)}
            title="Edit"
          >
            <Icon icon="solar:pen-bold" size={16} />
          </Button>
          {canDelete && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleDelete(r.id)}
              className="text-red-500 hover:text-red-700"
              title="Delete"
            >
              <Icon icon="solar:trash-bin-trash-bold" size={16} />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Icon icon="solar:notes-minimalistic-bold" className="text-emerald-600" size={26} />
            Observation Templates
          </h1>
          <p className="text-sm text-muted-foreground">
            Standard clinical observation templates, permitted measurement types, and reference ranges matching Marley
          </p>
        </div>
        {canCreate && (
          <Button
            onClick={() => navigate("/healthcare/observation-templates/new")}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <Icon icon="solar:add-circle-bold" size={18} className="mr-2" /> New Observation Template
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="pt-4 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Input
              placeholder="Search observations or abbreviations..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="max-w-xs"
            />
            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setPage(1);
              }}
              className="h-9 px-3 rounded-md border text-sm bg-background"
            >
              <option value="">All Categories</option>
              <option value="Vital Signs">Vital Signs</option>
              <option value="Hematology">Hematology</option>
              <option value="Biochemistry">Biochemistry</option>
              <option value="Immunology">Immunology</option>
              <option value="Urinalysis">Urinalysis</option>
              <option value="Cardiac">Cardiac</option>
              <option value="Microbiology">Microbiology</option>
              <option value="Endocrinology">Endocrinology</option>
            </select>
            <select
              value={dataTypeFilter}
              onChange={(e) => {
                setDataTypeFilter(e.target.value);
                setPage(1);
              }}
              className="h-9 px-3 rounded-md border text-sm bg-background"
            >
              <option value="">All Data Types</option>
              <option value="Quantity">Quantity (Numeric)</option>
              <option value="Select">Select (Options)</option>
              <option value="Boolean">Boolean (Yes/No)</option>
              <option value="Text">Text (Freeform)</option>
            </select>
            <label className="flex items-center gap-2 text-sm text-muted-foreground ml-auto cursor-pointer">
              <input
                type="checkbox"
                className="rounded"
                checked={showInactive}
                onChange={(e) => {
                  setShowInactive(e.target.checked);
                  setPage(1);
                }}
              />
              Show inactive
            </label>
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
              showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} templates`,
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
