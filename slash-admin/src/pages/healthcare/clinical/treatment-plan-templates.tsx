import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router";
import { Icon } from "@/components/icon";
import { Button } from "@/ui/button";
import { Card, CardContent } from "@/ui/card";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { Badge } from "@/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/select";
import Table, { type ColumnsType } from "antd/es/table";
import { HealthcareApi } from "@/api/services/healthcareService";
import EntitySelect from "@/components/healthcare/EntitySelect";
import { useDoctypePermissions } from "@/utils/permissions";
import type {
  TreatmentPlanTemplate,
  MedicalDepartment,
  TherapyType,
  HealthcarePractitioner,
} from "@/api/services/healthcareService";
import { useSearchParams } from "react-router";

const genderOptions = ["", "Male", "Female", "Other"];

export default function TreatmentPlanTemplatesPage() {
  const { canCreate } = useDoctypePermissions("Treatment Plan Template");
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const deptFilter = searchParams.get("department");

  const [data, setData] = useState<TreatmentPlanTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [departments, setDepartments] = useState<MedicalDepartment[]>([]);
  const [therapyTypes, setTherapyTypes] = useState<TherapyType[]>([]);
  const [practitioners, setPractitioners] = useState<HealthcarePractitioner[]>(
    []
  );

  // Create dialog
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    template_name: "",
    description: "",
    goal: "",
    medical_department: null as number | null,
    therapy_type: null as number | null,
    disabled: false,
    is_active: true,
    is_inpatient: false,
    patient_age_from: 0,
    patient_age_to: 0,
    gender: "",
    expected_length_of_stay: 0,
    treatment_counselling_required: false,
  });
  const [practitionersData, setPractitionersData] = useState<
    { practitioner: number | null; is_primary: boolean }[]
  >([]);
  const [itemsData, setItemsData] = useState<
    {
      item_type: string;
      item_name: string;
      quantity: number;
      instructions: string;
    }[]
  >([]);
  const [newItem, setNewItem] = useState({
    item_type: "",
    item_name: "",
    quantity: 1,
    instructions: "",
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = { page };
      if (search) params.search = search;
      if (deptFilter) params.medical_department = deptFilter;
      const res =
        await HealthcareApi.treatmentPlanTemplates.list(params);
      setData(res.results || []);
      setTotal(res.count || 0);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, search, deptFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    Promise.all([
      HealthcareApi.departments.list({ page_size: 200 }),
      HealthcareApi.therapyTypes.list({ page_size: 200 }),
      HealthcareApi.practitioners.list({ page_size: 200 }),
    ]).then(([depts, types, pracs]) => {
      setDepartments(depts.results || []);
      setTherapyTypes(types.results || []);
      setPractitioners(pracs.results || []);
    });
  }, []);

  const handleCreate = async () => {
    try {
      await HealthcareApi.treatmentPlanTemplates.create({
        ...form,
        items_data: itemsData,
        practitioners_data: practitionersData,
      });
      setShowCreate(false);
      resetForm();
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm("Delete this template?")) {
      await HealthcareApi.treatmentPlanTemplates.delete(id);
      loadData();
    }
  };

  const resetForm = () => {
    setForm({
      template_name: "",
      description: "",
      goal: "",
      medical_department: null,
      therapy_type: null,
      disabled: false,
      is_active: true,
      is_inpatient: false,
      patient_age_from: 0,
      patient_age_to: 0,
      gender: "",
      expected_length_of_stay: 0,
      treatment_counselling_required: false,
    });
    setPractitionersData([]);
    setItemsData([]);
  };

  const addItem = () => {
    if (newItem.item_type && newItem.item_name) {
      setItemsData([...itemsData, { ...newItem }]);
      setNewItem({
        item_type: "",
        item_name: "",
        quantity: 1,
        instructions: "",
      });
    }
  };

  const removeItem = (idx: number) => {
    setItemsData(itemsData.filter((_, i) => i !== idx));
  };

  const columns: ColumnsType<TreatmentPlanTemplate> = [
    {
      title: "Template Name",
      dataIndex: "template_name",
      sorter: (a, b) => a.template_name.localeCompare(b.template_name),
    },
    {
      title: "Department",
      dataIndex: "medical_department_name",
      width: 180,
    },
    {
      title: "Therapy Type",
      dataIndex: "therapy_type_name",
      width: 150,
    },
    {
      title: "Conditions",
      width: 160,
      render: (_, r) => {
        const parts: string[] = [];
        if (r.gender) parts.push(r.gender);
        if (r.patient_age_from || r.patient_age_to)
          parts.push(`Age ${r.patient_age_from}-${r.patient_age_to}`);
        return parts.length ? (
          <span className="text-sm text-muted-foreground">{parts.join(", ")}</span>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        );
      },
    },
    {
      title: "Items",
      width: 80,
      render: (_, r) => (
        <Badge variant="outline">{r.items?.length || 0}</Badge>
      ),
    },
    {
      title: "Practitioners",
      width: 100,
      render: (_, r) => (
        <Badge variant="outline">{r.practitioners?.length || 0}</Badge>
      ),
    },
    {
      title: "Status",
      width: 100,
      render: (_, r) => (
        <Badge variant={r.disabled ? "destructive" : r.is_active ? "default" : "secondary"}>
          {r.disabled ? "Disabled" : r.is_active ? "Active" : "Inactive"}
        </Badge>
      ),
    },
    {
      title: "Inpatient",
      width: 90,
      render: (_, r) =>
        r.is_inpatient ? (
          <Badge variant="outline" className="bg-purple-50 text-purple-700">
            IP
          </Badge>
        ) : null,
    },
    {
      title: "Actions",
      width: 100,
      render: (_, r) => (
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              navigate(`/healthcare/treatment-plan-templates/${r.id}`)
            }
          >
            <Icon icon="solar:eye-bold" size={16} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleDelete(r.id)}
          >
            <Icon
              icon="solar:trash-bin-trash-bold"
              size={16}
              className="text-red-500"
            />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {deptFilter && (
        <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-700">
          <Icon icon="solar:filter-bold" size={16} />
          <span>Filtered by Department</span>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto text-blue-700"
            onClick={() => navigate("/healthcare/treatment-plan-templates")}
          >
            Clear Filter
          </Button>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Treatment Plan Templates</h1>
          <p className="text-muted-foreground">
            {total} template{total !== 1 ? "s" : ""} — Standardized care
            protocols with medications, investigations, and procedures
          </p>
        </div>
        {canCreate && (
          <Button
            onClick={() => setShowCreate(true)}
            className="bg-teal-600 hover:bg-teal-700"
          >
            <Icon icon="solar:add-circle-bold" size={18} className="mr-2" />
            New Template
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Icon
                icon="solar:magnifer-linear"
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                placeholder="Search templates..."
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
            pagination={{
              current: page,
              total,
              pageSize: 20,
              onChange: setPage,
              showTotal: (t) => `${t} templates`,
            }}
          />
        </CardContent>
      </Card>

      {/* ── Create Dialog ─────────────────────────── */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Treatment Plan Template</DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Template Details */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-3">
                Template Details
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label>
                    Template Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    value={form.template_name}
                    onChange={(e) =>
                      setForm({ ...form, template_name: e.target.value })
                    }
                    placeholder="e.g. Post-Operative Recovery"
                  />
                </div>
                <div className="col-span-2">
                  <Label>Description</Label>
                  <textarea
                    className="w-full border rounded-md px-3 py-2 text-sm"
                    rows={2}
                    value={form.description}
                    onChange={(e) =>
                      setForm({ ...form, description: e.target.value })
                    }
                  />
                </div>
                <div className="col-span-2">
                  <Label>Goal</Label>
                  <textarea
                    className="w-full border rounded-md px-3 py-2 text-sm"
                    rows={2}
                    value={form.goal}
                    onChange={(e) =>
                      setForm({ ...form, goal: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label>Department</Label>
                  <EntitySelect
                    doctype="Medical Department"
                    rawItems={departments}
                    options={departments.map((d) => ({
                      value: d.id,
                      label: d.department,
                    }))}
                    value={form.medical_department}
                    onChange={(v) =>
                      setForm({ ...form, medical_department: v })
                    }
                    onOptionAdded={(_opt, raw) => {
                      if (raw) setDepartments((prev) => [...prev, raw]);
                    }}
                    placeholder="Select department"
                    emptyText="No departments"
                  />
                </div>
                <div>
                  <Label>Therapy Type</Label>
                  <EntitySelect
                    doctype="Therapy Type"
                    rawItems={therapyTypes}
                    options={therapyTypes.map((t) => ({
                      value: t.id,
                      label: t.therapy_type,
                    }))}
                    value={form.therapy_type}
                    onChange={(v) =>
                      setForm({ ...form, therapy_type: v })
                    }
                    onOptionAdded={(_opt, raw) => {
                      if (raw) setTherapyTypes((prev) => [...prev, raw]);
                    }}
                    placeholder="Select therapy type"
                    emptyText="No therapy types"
                  />
                </div>
                <div>
                  <Label>Status</Label>
                  <Select
                    value={form.disabled ? "disabled" : form.is_active ? "active" : "inactive"}
                    onValueChange={(v) =>
                      setForm({
                        ...form,
                        disabled: v === "disabled",
                        is_active: v === "active",
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      <SelectItem value="disabled">Disabled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Plan Conditions */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-3">
                Plan Conditions
              </h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Gender</Label>
                  <Select
                    value={form.gender || "__all__"}
                    onValueChange={(v) =>
                      setForm({
                        ...form,
                        gender: v === "__all__" ? "" : v,
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Any gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">Any</SelectItem>
                      {genderOptions
                        .filter(Boolean)
                        .map((g) => (
                          <SelectItem key={g} value={g}>
                            {g}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Age From</Label>
                  <Input
                    type="number"
                    min={0}
                    value={form.patient_age_from}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        patient_age_from: Number(e.target.value),
                      })
                    }
                  />
                </div>
                <div>
                  <Label>Age To</Label>
                  <Input
                    type="number"
                    min={0}
                    value={form.patient_age_to}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        patient_age_to: Number(e.target.value),
                      })
                    }
                  />
                </div>
              </div>
            </div>

            {/* Plan Items */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-3">
                Investigations, Therapy & Procedures
              </h3>
              {itemsData.length > 0 && (
                <div className="space-y-2 mb-3">
                  {itemsData.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 p-2 bg-slate-50 rounded-md"
                    >
                      <Badge variant="outline" className="shrink-0">
                        {item.item_type}
                      </Badge>
                      <span className="flex-1 text-sm">{item.item_name}</span>
                      <span className="text-xs text-muted-foreground">
                        Qty: {item.quantity}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeItem(idx)}
                      >
                        <Icon
                          icon="solar:close-circle-bold"
                          size={16}
                          className="text-red-500"
                        />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <div className="grid grid-cols-4 gap-2 items-end">
                <div>
                  <Label className="text-xs">Type</Label>
                  <Select
                    value={newItem.item_type}
                    onValueChange={(v) =>
                      setNewItem({ ...newItem, item_type: v })
                    }
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Lab Test Template">
                        Lab Test
                      </SelectItem>
                      <SelectItem value="Clinical Procedure Template">
                        Procedure
                      </SelectItem>
                      <SelectItem value="Therapy Type">Therapy</SelectItem>
                      <SelectItem value="Observation Template">
                        Observation
                      </SelectItem>
                      <SelectItem value="Medication">Medication</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Name</Label>
                  <Input
                    className="h-9"
                    value={newItem.item_name}
                    onChange={(e) =>
                      setNewItem({ ...newItem, item_name: e.target.value })
                    }
                    placeholder="Template name"
                  />
                </div>
                <div>
                  <Label className="text-xs">Qty</Label>
                  <Input
                    className="h-9"
                    type="number"
                    min={1}
                    value={newItem.quantity}
                    onChange={(e) =>
                      setNewItem({
                        ...newItem,
                        quantity: Number(e.target.value),
                      })
                    }
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addItem}
                  className="h-9"
                >
                  <Icon icon="solar:add-circle-bold" size={16} className="mr-1" />
                  Add
                </Button>
              </div>
            </div>

            {/* Inpatient */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-3">
                Inpatient
              </h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.is_inpatient}
                    onChange={(e) =>
                      setForm({ ...form, is_inpatient: e.target.checked })
                    }
                    className="h-4 w-4"
                  />
                  <Label>Is Inpatient</Label>
                </div>
                {form.is_inpatient && (
                  <>
                    <div>
                      <Label>Expected Length of Stay (days)</Label>
                      <Input
                        type="number"
                        min={0}
                        value={form.expected_length_of_stay}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            expected_length_of_stay: Number(e.target.value),
                          })
                        }
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={form.treatment_counselling_required}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            treatment_counselling_required: e.target.checked,
                          })
                        }
                        className="h-4 w-4"
                      />
                      <Label>Treatment Counselling</Label>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Practitioners */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-3">
                Practitioners
              </h3>
              <div className="space-y-2">
                {practitionersData.map((p, idx) => {
                  const prac = practitioners.find(
                    (pr) => pr.id === p.practitioner
                  );
                  return (
                    <div
                      key={idx}
                      className="flex items-center gap-2 p-2 bg-slate-50 rounded-md"
                    >
                      <span className="flex-1 text-sm">
                        {prac?.practitioner_name || `Practitioner #${p.practitioner}`}
                      </span>
                      {p.is_primary && (
                        <Badge variant="outline">Primary</Badge>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setPractitionersData(
                            practitionersData.filter((_, i) => i !== idx)
                          )
                        }
                      >
                        <Icon
                          icon="solar:close-circle-bold"
                          size={16}
                          className="text-red-500"
                        />
                      </Button>
                    </div>
                  );
                })}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const primary = practitionersData.length === 0;
                    setPractitionersData([
                      ...practitionersData,
                      { practitioner: practitioners[0]?.id || 0, is_primary: primary },
                    ]);
                  }}
                >
                  <Icon icon="solar:add-circle-bold" size={16} className="mr-1" />
                  Add Practitioner
                </Button>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t pt-4">
            <Button variant="outline" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              className="bg-teal-600 hover:bg-teal-700"
              disabled={!form.template_name}
            >
              Create Template
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
