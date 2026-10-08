import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router";
import { Icon } from "@/components/icon";
import { Button } from "@/ui/button";
import { Card, CardContent } from "@/ui/card";
import { Input } from "@/ui/input";
import Table, { type ColumnsType } from "antd/es/table";
import { HealthcareApi } from "@/api/services/healthcareService";
import type { LabTestTemplate } from "@/api/services/healthcareService";
import { useDoctypePermissions } from "@/utils/permissions";

const typeColor: Record<string, string> = {
  Single: "bg-blue-100 text-blue-700", Compound: "bg-purple-100 text-purple-700",
  Descriptive: "bg-green-100 text-green-700", Grouped: "bg-orange-100 text-orange-700",
  "No Result": "bg-gray-100 text-gray-700", Imaging: "bg-cyan-100 text-cyan-700",
};

export default function LabTestTemplatesPage() {
  const { canCreate } = useDoctypePermissions("Lab Test Template");
  const navigate = useNavigate();
  const [data, setData] = useState<LabTestTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  // Marley's `lab_test_template_list.js` hides disabled templates by default
  // (`filters: { disabled: "No" }`); the checkbox below is Marley's "Show
  // disabled" escape hatch.
  const [showDisabled, setShowDisabled] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = { page, page_size: 20 };
      if (search) params.search = search;
      if (!showDisabled) params.disabled = false;
      const res = await HealthcareApi.labTestTemplates.list(params);
      setData(res.results || []);
      setTotal(res.count || 0);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [page, search, showDisabled]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this template?")) return;
    await HealthcareApi.labTestTemplates.delete(id);
    loadData();
  };

  const columns: ColumnsType<LabTestTemplate> = [
    { title: "Test Name", dataIndex: "lab_test_name", width: 250, render: (v: string) => <span className="font-medium">{v}</span> },
    { title: "Department", dataIndex: "department_name", width: 150 },
    { title: "Type", dataIndex: "lab_test_template_type", width: 120, render: (v: string) => <span className={`text-xs px-2 py-1 rounded-full ${typeColor[v] || ""}`}>{v}</span> },
    { title: "Sample", dataIndex: "sample_name", width: 120 },
    { title: "UOM", dataIndex: "uom_name", width: 80 },
    { title: "Rate", dataIndex: "lab_test_rate", width: 100, render: (v: number) => `$${v}` },
    { title: "Status", dataIndex: "disabled", width: 100, render: (v: boolean) => <span className={`text-xs px-2 py-1 rounded-full ${v ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>{v ? "Disabled" : "Active"}</span> },
    {
      title: "Actions", width: 100,
      render: (_, r) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={() => navigate(`/healthcare/lab-test-templates/${r.id}`)}><Icon icon="solar:pen-bold" size={16} /></Button>
          <Button variant="ghost" size="sm" onClick={() => handleDelete(r.id)}><Icon icon="solar:trash-bin-trash-bold" size={16} className="text-red-500" /></Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Lab Test Templates</h1>
          <p className="text-muted-foreground">{total} templates</p>
        </div>
        {canCreate && (
          <Button onClick={() => navigate("/healthcare/lab-test-templates/new")} className="bg-emerald-600 hover:bg-emerald-700">
            <Icon icon="solar:add-circle-bold" size={18} className="mr-2" /> New Template
          </Button>
        )}
      </div>
      <Card>
        <CardContent className="pt-4">
          <Input placeholder="Search templates..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="max-w-sm mb-4" />
          <label className="flex items-center gap-2 mb-4 text-sm text-muted-foreground">
            <input
              type="checkbox"
              className="rounded"
              checked={showDisabled}
              onChange={(e) => { setShowDisabled(e.target.checked); setPage(1); }}
            />
            Show disabled templates
          </label>
          <Table columns={columns} dataSource={data} rowKey="id" loading={loading}
            pagination={{ current: page, total, pageSize: 20, onChange: setPage }} />
        </CardContent>
      </Card>
    </div>
  );
}
