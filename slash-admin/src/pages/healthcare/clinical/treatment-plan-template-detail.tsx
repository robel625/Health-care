import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router";
import { Icon } from "@/components/icon";
import { Button } from "@/ui/button";
import { Card, CardContent, CardHeader } from "@/ui/card";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { Badge } from "@/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/select";
import { HealthcareApi } from "@/api/services/healthcareService";
import EntitySelect from "@/components/healthcare/EntitySelect";
import { useDoctypePermissions } from "@/utils/permissions";
import type {
  TreatmentPlanTemplate,
  TreatmentPlanTemplateItem,
  MedicalDepartment,
  TherapyType,
  HealthcarePractitioner,
} from "@/api/services/healthcareService";

const genderOptions = ["", "Male", "Female", "Other"];

const itemTypeOptions = [
  { value: "Lab Test Template", label: "Lab Test" },
  { value: "Clinical Procedure Template", label: "Clinical Procedure" },
  { value: "Therapy Type", label: "Therapy" },
  { value: "Observation Template", label: "Observation" },
  { value: "Medication", label: "Medication" },
];

export default function TreatmentPlanTemplateDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { canWrite } = useDoctypePermissions("Treatment Plan Template");

  const [template, setTemplate] =
    useState<TreatmentPlanTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [departments, setDepartments] = useState<MedicalDepartment[]>([]);
  const [therapyTypes, setTherapyTypes] = useState<TherapyType[]>([]);
  const [practitioners, setPractitioners] = useState<HealthcarePractitioner[]>(
    []
  );

  // Editable form state
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
  const [items, setItems] = useState<TreatmentPlanTemplateItem[]>([]);
  const [practitionersData, setPractitionersData] = useState<
    { practitioner: number | null; practitioner_name: string; is_primary: boolean }[]
  >([]);

  const loadTemplate = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await HealthcareApi.treatmentPlanTemplates.get(Number(id));
      const t = res as any;
      setTemplate(t);
      setForm({
        template_name: t.template_name || "",
        description: t.description || "",
        goal: t.goal || "",
        medical_department: t.medical_department,
        therapy_type: t.therapy_type,
        disabled: t.disabled,
        is_active: t.is_active,
        is_inpatient: t.is_inpatient,
        patient_age_from: t.patient_age_from || 0,
        patient_age_to: t.patient_age_to || 0,
        gender: t.gender || "",
        expected_length_of_stay: t.expected_length_of_stay || 0,
        treatment_counselling_required: t.treatment_counselling_required,
      });
      setItems(t.items || []);
      setPractitionersData(
        (t.practitioners || []).map(
          (p: any) => ({
            practitioner: p.practitioner,
            practitioner_name: p.practitioner_name || "",
            is_primary: p.is_primary,
          })
        )
      );
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadTemplate();
  }, [loadTemplate]);

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

  const handleSave = async () => {
    if (!id) return;
    setSaving(true);
    try {
      await HealthcareApi.treatmentPlanTemplates.update(Number(id), {
        ...form,
        items_data: items.map((i) => ({
          item_type: i.item_type,
          item_name: i.item_name,
          quantity: i.quantity,
          amount: i.amount,
          instructions: i.instructions,
          drug_name: i.drug_name,
          drug_code: i.drug_code,
          strength: i.strength,
          strength_uom: i.strength_uom,
          dosage_form: i.dosage_form,
          dosage_by_interval: i.dosage_by_interval,
          dosage: i.dosage,
          interval: i.interval,
          interval_uom: i.interval_uom,
          period: i.period,
          number_of_repeats_allowed: i.number_of_repeats_allowed,
          service_request: i.service_request,
        })),
        practitioners_data: practitionersData.map((p) => ({
          practitioner: p.practitioner,
          is_primary: p.is_primary,
        })),
      });
      loadTemplate();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!id || !confirm("Delete this template?")) return;
    await HealthcareApi.treatmentPlanTemplates.delete(Number(id));
    navigate("/healthcare/treatment-plan-templates");
  };

  const addItem = () => {
    setItems([
      ...items,
      {
        id: Date.now(),
        item_type: "",
        item_name: "",
        quantity: 1,
        amount: 0,
        instructions: "",
        drug_name: "",
        drug_code: "",
        strength: 0,
        strength_uom: "",
        dosage_form: "",
        dosage_by_interval: false,
        dosage: "",
        interval: 0,
        interval_uom: "",
        period: "",
        number_of_repeats_allowed: 0,
        service_request: "",
      },
    ]);
  };

  const updateItem = (
    idx: number,
    field: keyof TreatmentPlanTemplateItem,
    value: any
  ) => {
    setItems(items.map((item, i) => (i === idx ? { ...item, [field]: value } : item)));
  };

  const removeItem = (idx: number) => {
    setItems(items.filter((_, i) => i !== idx));
  };

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!template) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Template not found</p>
        <Button variant="ghost" onClick={() => navigate(-1)} className="mt-4">
          Go Back
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/healthcare/treatment-plan-templates")}
          >
            <Icon icon="solar:arrow-left-linear" size={20} />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{template.template_name}</h1>
              <Badge
                variant={
                  template.disabled
                    ? "destructive"
                    : template.is_active
                    ? "default"
                    : "secondary"
                }
              >
                {template.disabled
                  ? "Disabled"
                  : template.is_active
                  ? "Active"
                  : "Inactive"}
              </Badge>
              {template.is_inpatient && (
                <Badge variant="outline" className="bg-purple-50 text-purple-700">
                  Inpatient
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground text-sm">
              {template.medical_department_name || "No department"} •{" "}
              {template.therapy_type_name || "No therapy type"} •{" "}
              {items.length} item{items.length !== 1 ? "s" : ""} •{" "}
              {practitionersData.length} practitioner
              {practitionersData.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canWrite && (
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-teal-600 hover:bg-teal-700"
            >
              {saving ? "Saving..." : "Save"}
            </Button>
          )}
          <Button variant="destructive" onClick={handleDelete}>
            <Icon icon="solar:trash-bin-trash-bold" size={16} />
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">Template Details</TabsTrigger>
          <TabsTrigger value="items">Plan Items ({items.length})</TabsTrigger>
          <TabsTrigger value="practitioners">
            Practitioners ({practitionersData.length})
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Template Details */}
        <TabsContent value="details" className="space-y-6">
          <Card>
            <CardHeader>
              <h3 className="text-lg font-semibold">Template Information</h3>
            </CardHeader>
            <CardContent>
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
                    disabled={!canWrite}
                  />
                </div>
                <div className="col-span-2">
                  <Label>Description</Label>
                  <textarea
                    className="w-full border rounded-md px-3 py-2 text-sm"
                    rows={3}
                    value={form.description}
                    onChange={(e) =>
                      setForm({ ...form, description: e.target.value })
                    }
                    disabled={!canWrite}
                  />
                </div>
                <div className="col-span-2">
                  <Label>Goal</Label>
                  <textarea
                    className="w-full border rounded-md px-3 py-2 text-sm"
                    rows={3}
                    value={form.goal}
                    onChange={(e) =>
                      setForm({ ...form, goal: e.target.value })
                    }
                    disabled={!canWrite}
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
                    onChange={(v) => setForm({ ...form, medical_department: v })}
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
                    onChange={(v) => setForm({ ...form, therapy_type: v })}
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
            </CardContent>
          </Card>

          {/* Plan Conditions */}
          <Card>
            <CardHeader>
              <h3 className="text-lg font-semibold">Plan Conditions</h3>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Gender</Label>
                  <Select
                    value={form.gender || "__all__"}
                    onValueChange={(v) =>
                      setForm({ ...form, gender: v === "__all__" ? "" : v })
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
                      setForm({ ...form, patient_age_from: Number(e.target.value) })
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
                      setForm({ ...form, patient_age_to: Number(e.target.value) })
                    }
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Inpatient */}
          <Card>
            <CardHeader>
              <h3 className="text-lg font-semibold">Inpatient</h3>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.is_inpatient}
                    onChange={(e) =>
                      setForm({ ...form, is_inpatient: e.target.checked })
                    }
                    className="h-4 w-4"
                    disabled={!canWrite}
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
                        disabled={!canWrite}
                      />
                      <Label>Treatment Counselling Required</Label>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Plan Items */}
        <TabsContent value="items" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <h3 className="text-lg font-semibold">
                Investigations, Therapy & Procedures
              </h3>
              {canWrite && (
                <Button variant="outline" size="sm" onClick={addItem}>
                  <Icon icon="solar:add-circle-bold" size={16} className="mr-1" />
                  Add Item
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {items.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No items added yet. Click "Add Item" to start.
                </div>
              ) : (
                <div className="space-y-3">
                  {items.map((item, idx) => (
                    <div
                      key={item.id || idx}
                      className="border rounded-lg p-4 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">
                            {item.item_type || "Unknown Type"}
                          </Badge>
                          <span className="font-medium">
                            {item.item_name || item.drug_name || "Unnamed"}
                          </span>
                        </div>
                        {canWrite && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeItem(idx)}
                          >
                            <Icon
                              icon="solar:trash-bin-trash-bold"
                              size={16}
                              className="text-red-500"
                            />
                          </Button>
                        )}
                      </div>

                      <div className="grid grid-cols-4 gap-3">
                        <div>
                          <Label className="text-xs">Type</Label>
                          <Select
                            value={item.item_type}
                            onValueChange={(v) => updateItem(idx, "item_type", v)}
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue placeholder="Type" />
                            </SelectTrigger>
                            <SelectContent>
                              {itemTypeOptions.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs">Name</Label>
                          <Input
                            className="h-8"
                            value={item.item_name}
                            onChange={(e) =>
                              updateItem(idx, "item_name", e.target.value)
                            }
                            placeholder="Template name"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Quantity</Label>
                          <Input
                            className="h-8"
                            type="number"
                            min={1}
                            value={item.quantity}
                            onChange={(e) =>
                              updateItem(idx, "quantity", Number(e.target.value))
                            }
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Amount</Label>
                          <Input
                            className="h-8"
                            type="number"
                            min={0}
                            value={item.amount}
                            onChange={(e) =>
                              updateItem(idx, "amount", Number(e.target.value))
                            }
                          />
                        </div>
                      </div>

                      {/* Medication-specific fields */}
                      {item.item_type === "Medication" && (
                        <div className="grid grid-cols-4 gap-3 mt-2 pt-2 border-t">
                          <div>
                            <Label className="text-xs">Drug Name</Label>
                            <Input
                              className="h-8"
                              value={item.drug_name}
                              onChange={(e) =>
                                updateItem(idx, "drug_name", e.target.value)
                              }
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Strength</Label>
                            <Input
                              className="h-8"
                              value={item.strength}
                              onChange={(e) =>
                                updateItem(idx, "strength", Number(e.target.value))
                              }
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Dosage Form</Label>
                            <Input
                              className="h-8"
                              value={item.dosage_form}
                              onChange={(e) =>
                                updateItem(idx, "dosage_form", e.target.value)
                              }
                              placeholder="Tablet, Syrup..."
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Dosage</Label>
                            <Input
                              className="h-8"
                              value={item.dosage}
                              onChange={(e) =>
                                updateItem(idx, "dosage", e.target.value)
                              }
                              placeholder="1 tablet twice daily"
                            />
                          </div>
                        </div>
                      )}

                      <div>
                        <Label className="text-xs">Instructions</Label>
                        <Input
                          className="h-8"
                          value={item.instructions}
                          onChange={(e) =>
                            updateItem(idx, "instructions", e.target.value)
                          }
                          placeholder="Special instructions..."
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Practitioners */}
        <TabsContent value="practitioners" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <h3 className="text-lg font-semibold">Assigned Practitioners</h3>
              {canWrite && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const primary = practitionersData.length === 0;
                    setPractitionersData([
                      ...practitionersData,
                      {
                        practitioner: practitioners[0]?.id || 0,
                        practitioner_name:
                          practitioners[0]?.practitioner_name || "",
                        is_primary: primary,
                      },
                    ]);
                  }}
                >
                  <Icon icon="solar:add-circle-bold" size={16} className="mr-1" />
                  Add Practitioner
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {practitionersData.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No practitioners assigned.
                </div>
              ) : (
                <div className="space-y-2">
                  {practitionersData.map((p, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg"
                    >
                      <div className="flex-1">
                        <EntitySelect
                          doctype="Healthcare Practitioner"
                          rawItems={practitioners}
                          options={practitioners.map((pr) => ({
                            value: pr.id,
                            label: pr.practitioner_name,
                            sublabel: pr.practitioner_id,
                          }))}
                          value={p.practitioner}
                          onChange={(v) => {
                            const prac = practitioners.find((pr) => pr.id === v);
                            setPractitionersData(
                              practitionersData.map((item, i) =>
                                i === idx
                                  ? {
                                      ...item,
                                      practitioner: v,
                                      practitioner_name:
                                        prac?.practitioner_name || "",
                                    }
                                  : item
                              )
                            );
                          }}
                          onOptionAdded={(_opt, raw) => {
                            if (raw) setPractitioners((prev) => [...prev, raw]);
                          }}
                          placeholder="Select practitioner"
                          emptyText="No practitioners"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          <input
                            type="checkbox"
                            checked={p.is_primary}
                            onChange={(e) =>
                              setPractitionersData(
                                practitionersData.map((item, i) =>
                                  i === idx
                                    ? { ...item, is_primary: e.target.checked }
                                    : item
                                )
                              )
                            }
                            className="h-4 w-4"
                          />
                          <Label className="text-xs">Primary</Label>
                        </div>
                        {p.is_primary && (
                          <Badge variant="default">Primary</Badge>
                        )}
                        {canWrite && (
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
                              icon="solar:trash-bin-trash-bold"
                              size={16}
                              className="text-red-500"
                            />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
