import { useState, useEffect } from "react";
import { Icon } from "@/components/icon";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/ui/dialog";
import { HealthcareApi } from "@/api/services/healthcareService";
import { extractErrorMessage } from "@/utils";
import { toast } from "sonner";

export interface QuickCreateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  doctype: string;
  initialValue?: string;
  onCreated: (createdRecord: any, primaryValue: string | number) => void;
}

/**
 * Marley-style Quick Entry Dialog for creating linked DocTypes on the fly.
 * Automatically adapts its fields and API target based on the doctype name.
 */
export default function QuickCreateModal({
  open,
  onOpenChange,
  doctype,
  initialValue = "",
  onCreated,
}: QuickCreateModalProps) {
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalizedDoctype = (doctype || "").trim().toLowerCase();

  // Reset and pre-fill form whenever opened
  useEffect(() => {
    if (open) {
      setError(null);
      const prefill = initialValue?.trim() || "";

      if (normalizedDoctype === "lab test uom" || normalizedDoctype === "uom") {
        setFormData({ lab_test_uom: prefill, uom_description: "" });
      } else if (
        normalizedDoctype === "medical department" ||
        normalizedDoctype === "department"
      ) {
        setFormData({ department: prefill, patient_care_type: "Both" });
      } else if (
        normalizedDoctype === "item" ||
        normalizedDoctype === "stock item" ||
        normalizedDoctype === "drug code"
      ) {
        setFormData({
          item_code: prefill,
          item_name: prefill,
          item_group: "Products",
        });
      } else if (normalizedDoctype === "dosage form") {
        setFormData({ dosage_form: prefill, description: "" });
      } else if (
        normalizedDoctype === "prescription dosage" ||
        normalizedDoctype === "dosage"
      ) {
        setFormData({ dosage: prefill, description: "" });
      } else if (
        normalizedDoctype === "prescription duration" ||
        normalizedDoctype === "duration" ||
        normalizedDoctype === "period"
      ) {
        // Try parsing e.g. "7 Day(s)" or "5"
        const numMatch = prefill.match(/\d+/);
        const num = numMatch ? Number(numMatch[0]) : 7;
        const period = prefill.toLowerCase().includes("week")
          ? "Week"
          : prefill.toLowerCase().includes("month")
          ? "Month"
          : "Day";
        setFormData({ number: num, period });
      } else if (normalizedDoctype === "lab test sample") {
        setFormData({ sample: prefill, sample_name: prefill });
      } else if (normalizedDoctype === "sample type") {
        setFormData({ sample_type: prefill });
      } else if (normalizedDoctype === "therapy type") {
        setFormData({ therapy_type: prefill });
      } else if (normalizedDoctype === "complaint") {
        setFormData({ complaint: prefill });
      } else if (normalizedDoctype === "appointment type") {
        setFormData({ appointment_type: prefill, default_duration: 30 });
      } else if (normalizedDoctype === "antibiotic") {
        setFormData({ antibiotic_name: prefill });
      } else if (normalizedDoctype === "sensitivity") {
        setFormData({ sensitivity: prefill });
      } else if (normalizedDoctype === "organism") {
        setFormData({ organism: prefill });
      } else if (
        normalizedDoctype === "healthcare service unit" ||
        normalizedDoctype === "service unit"
      ) {
        setFormData({ service_unit_name: prefill });
      } else if (normalizedDoctype === "patient") {
        setFormData({
          first_name: prefill,
          last_name: "",
          sex: "Male",
          mobile: "",
        });
      } else if (
        normalizedDoctype === "healthcare practitioner" ||
        normalizedDoctype === "practitioner"
      ) {
        setFormData({
          first_name: prefill,
          last_name: "",
          gender: "Male",
          mobile_phone: "",
        });
      } else if (normalizedDoctype === "lab test template") {
        setFormData({ lab_test_name: prefill, lab_test_code: "" });
      } else {
        setFormData({ name: prefill, description: "" });
      }
    }
  }, [open, initialValue, normalizedDoctype]);

  const handleChange = (key: string, value: any) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      let res: any = null;
      let primaryVal: string | number = "";

      if (normalizedDoctype === "lab test uom" || normalizedDoctype === "uom") {
        if (!formData.lab_test_uom?.trim()) {
          throw new Error("UOM Name is required.");
        }
        res = await HealthcareApi.labTestUOMs.create({
          lab_test_uom: formData.lab_test_uom.trim(),
          uom_description: formData.uom_description || "",
        });
        primaryVal = res.lab_test_uom;
      } else if (
        normalizedDoctype === "medical department" ||
        normalizedDoctype === "department"
      ) {
        if (!formData.department?.trim()) {
          throw new Error("Department name is required.");
        }
        res = await HealthcareApi.departments.create({
          department: formData.department.trim(),
          patient_care_type: formData.patient_care_type || "Both",
          show_in_portal: true,
        });
        primaryVal = res.department;
      } else if (
        normalizedDoctype === "item" ||
        normalizedDoctype === "stock item" ||
        normalizedDoctype === "drug code" ||
        normalizedDoctype === "medication"
      ) {
        const name = formData.item_name?.trim() || formData.item_code?.trim() || formData.medication_name?.trim();
        if (!name) {
          throw new Error("Medication name is required.");
        }
        res = await HealthcareApi.medications.create({
          medication_name: name,
        });
        primaryVal = res.medication_name;
      } else if (normalizedDoctype === "dosage form") {
        if (!formData.dosage_form?.trim()) {
          throw new Error("Dosage Form is required.");
        }
        res = await HealthcareApi.dosageForms.create({
          dosage_form: formData.dosage_form.trim(),
        });
        primaryVal = res.dosage_form;
      } else if (
        normalizedDoctype === "prescription dosage" ||
        normalizedDoctype === "dosage"
      ) {
        if (!formData.dosage?.trim()) {
          throw new Error("Dosage is required (e.g. 1-0-1).");
        }
        res = (HealthcareApi as any).prescriptionDosages?.create
          ? await (HealthcareApi as any).prescriptionDosages.create({
              dosage: formData.dosage.trim(),
              description: formData.description || "",
            })
          : { dosage: formData.dosage.trim() };
        primaryVal = res.dosage;
      } else if (
        normalizedDoctype === "prescription duration" ||
        normalizedDoctype === "duration" ||
        normalizedDoctype === "period"
      ) {
        const num = Number(formData.number) || 1;
        const period = formData.period || "Day";
        res = await HealthcareApi.prescriptionDurations.create({
          number: num,
          period,
        });
        primaryVal = `${num} ${period}(s)`;
      } else if (normalizedDoctype === "lab test sample") {
        const sampleVal = (formData.sample || formData.sample_name || "").trim();
        if (!sampleVal) {
          throw new Error("Sample Name is required.");
        }
        res = await HealthcareApi.labTestSamples.create({
          sample: sampleVal,
        });
        primaryVal = res.sample;
      } else if (normalizedDoctype === "sample type") {
        if (!formData.sample_type?.trim()) {
          throw new Error("Sample Type is required.");
        }
        res = await HealthcareApi.sampleTypes.create({
          sample_type: formData.sample_type.trim(),
        });
        primaryVal = res.sample_type;
      } else if (normalizedDoctype === "therapy type") {
        if (!formData.therapy_type?.trim()) {
          throw new Error("Therapy Type is required.");
        }
        res = await HealthcareApi.therapyTypes.create({
          therapy_type: formData.therapy_type.trim(),
        });
        primaryVal = res.therapy_type;
      } else if (
        normalizedDoctype === "medical department" ||
        normalizedDoctype === "department"
      ) {
        if (!formData.department?.trim()) {
          throw new Error("Department Name is required.");
        }
        res = await HealthcareApi.departments.create({
          department: formData.department.trim(),
          patient_care_type: formData.patient_care_type || "Both",
        });
        primaryVal = res.department;
      } else if (normalizedDoctype === "complaint") {
        if (!formData.complaint?.trim()) {
          throw new Error("Complaint is required.");
        }
        res = await HealthcareApi.complaints.create({
          complaint: formData.complaint.trim(),
        });
        primaryVal = res.complaint;
      } else if (normalizedDoctype === "appointment type") {
        if (!formData.appointment_type?.trim()) {
          throw new Error("Appointment Type name is required.");
        }
        res = await HealthcareApi.appointmentTypes.create({
          appointment_type: formData.appointment_type.trim(),
          default_duration: Number(formData.default_duration) || 30,
        });
        primaryVal = res.id ?? res.appointment_type;
      } else if (normalizedDoctype === "patient") {
        if (!formData.first_name?.trim()) {
          throw new Error("First Name is required.");
        }
        res = await HealthcareApi.patients.create({
          first_name: formData.first_name.trim(),
          last_name: formData.last_name?.trim() || "",
          sex: formData.sex || "Male",
          mobile: formData.mobile?.trim() || "",
          status: "Active",
        });
        primaryVal = res.id;
      } else if (
        normalizedDoctype === "healthcare practitioner" ||
        normalizedDoctype === "practitioner"
      ) {
        if (!formData.first_name?.trim()) {
          throw new Error("First Name is required.");
        }
        res = await HealthcareApi.practitioners.create({
          first_name: formData.first_name.trim(),
          last_name: formData.last_name?.trim() || "",
          gender: formData.gender || "Male",
          mobile_phone: formData.mobile_phone?.trim() || "",
          status: "Active",
        });
        primaryVal = res.id;
      } else if (normalizedDoctype === "lab test template") {
        if (!formData.lab_test_name?.trim()) {
          throw new Error("Lab Test Name is required.");
        }
        res = await HealthcareApi.labTestTemplates.create({
          lab_test_name: formData.lab_test_name.trim(),
          lab_test_code: formData.lab_test_code?.trim() || "",
          lab_test_group: null,
        });
        primaryVal = res.lab_test_name;
      } else if (normalizedDoctype === "antibiotic") {
        if (!formData.antibiotic_name?.trim()) {
          throw new Error("Antibiotic Name is required.");
        }
        res = await HealthcareApi.antibiotics.create({
          antibiotic_name: formData.antibiotic_name.trim(),
        });
        primaryVal = res.antibiotic_name;
      } else if (normalizedDoctype === "sensitivity") {
        if (!formData.sensitivity?.trim()) {
          throw new Error("Sensitivity is required.");
        }
        res = await HealthcareApi.sensitivities.create({
          sensitivity: formData.sensitivity.trim(),
        });
        primaryVal = res.sensitivity;
      } else if (normalizedDoctype === "organism") {
        if (!formData.organism?.trim()) {
          throw new Error("Organism is required.");
        }
        res = await HealthcareApi.organisms.create({
          organism: formData.organism.trim(),
        });
        primaryVal = res.organism;
      } else if (
        normalizedDoctype === "healthcare service unit" ||
        normalizedDoctype === "service unit"
      ) {
        if (!formData.service_unit_name?.trim()) {
          throw new Error("Service Unit Name is required.");
        }
        res = await HealthcareApi.serviceUnits.create({
          service_unit_name: formData.service_unit_name.trim(),
        });
        primaryVal = res.service_unit_name;
      } else {
        // Fallback generic
        primaryVal = formData.name?.trim() || initialValue;
        res = { name: primaryVal, ...formData };
      }

      toast.success(`Created ${doctype}: ${primaryVal}`);
      onCreated(res, primaryVal);
      onOpenChange(false);
    } catch (err: any) {
      console.error(`Error creating ${doctype}:`, err);
      const msg = extractErrorMessage(err, `Failed to create ${doctype}`);
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-6">
        <form onSubmit={handleSave}>
          <DialogHeader className="pb-3 border-b">
            <DialogTitle className="text-base font-semibold flex items-center gap-2">
              <Icon
                icon="solar:add-circle-bold"
                size={20}
                className="text-emerald-600"
              />
              New {doctype}
            </DialogTitle>
          </DialogHeader>

          {error && (
            <div className="mt-3 p-2.5 rounded-md bg-destructive/10 text-destructive text-xs">
              {error}
            </div>
          )}

          <div className="py-4 space-y-4">
            {/* Lab Test UOM */}
            {(normalizedDoctype === "lab test uom" || normalizedDoctype === "uom") && (
              <>
                <div>
                  <Label className="text-xs text-muted-foreground">UOM Name *</Label>
                  <Input
                    value={formData.lab_test_uom || ""}
                    onChange={(e) => handleChange("lab_test_uom", e.target.value)}
                    placeholder="e.g. mg/dL, mmol/L, %"
                    className="mt-1"
                    required
                    autoFocus
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Description</Label>
                  <Input
                    value={formData.uom_description || ""}
                    onChange={(e) => handleChange("uom_description", e.target.value)}
                    placeholder="Unit description or symbol"
                    className="mt-1"
                  />
                </div>
              </>
            )}

            {/* Medical Department */}
            {(normalizedDoctype === "medical department" ||
              normalizedDoctype === "department") && (
              <>
                <div>
                  <Label className="text-xs text-muted-foreground">Department Name *</Label>
                  <Input
                    value={formData.department || ""}
                    onChange={(e) => handleChange("department", e.target.value)}
                    placeholder="e.g. Cardiology, Pathology, Pediatrics"
                    className="mt-1"
                    required
                    autoFocus
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Patient Care Type</Label>
                  <select
                    className="w-full border rounded-md px-3 py-2 text-sm mt-1 bg-background"
                    value={formData.patient_care_type || "Both"}
                    onChange={(e) => handleChange("patient_care_type", e.target.value)}
                  >
                    <option value="Both">Both Inpatient & Outpatient</option>
                    <option value="Inpatient">Inpatient</option>
                    <option value="Outpatient">Outpatient</option>
                  </select>
                </div>
              </>
            )}

            {/* Item */}
            {(normalizedDoctype === "item" ||
              normalizedDoctype === "stock item" ||
              normalizedDoctype === "drug code") && (
              <>
                <div>
                  <Label className="text-xs text-muted-foreground">Item Code / ID *</Label>
                  <Input
                    value={formData.item_code || ""}
                    onChange={(e) => handleChange("item_code", e.target.value)}
                    placeholder="e.g. MED-AMOX-500, ITEM-001"
                    className="mt-1"
                    required
                    autoFocus
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Item Name *</Label>
                  <Input
                    value={formData.item_name || ""}
                    onChange={(e) => handleChange("item_name", e.target.value)}
                    placeholder="Item display name"
                    className="mt-1"
                    required
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Item Group</Label>
                  <Input
                    value={formData.item_group || "Products"}
                    onChange={(e) => handleChange("item_group", e.target.value)}
                    className="mt-1"
                  />
                </div>
              </>
            )}

            {/* Dosage Form */}
            {normalizedDoctype === "dosage form" && (
              <div>
                <Label className="text-xs text-muted-foreground">Dosage Form *</Label>
                <Input
                  value={formData.dosage_form || ""}
                  onChange={(e) => handleChange("dosage_form", e.target.value)}
                  placeholder="e.g. Tablet, Capsule, Syrup, Injection, Ointment"
                  className="mt-1"
                  required
                  autoFocus
                />
              </div>
            )}

            {/* Prescription Dosage */}
            {(normalizedDoctype === "prescription dosage" ||
              normalizedDoctype === "dosage") && (
              <>
                <div>
                  <Label className="text-xs text-muted-foreground">Dosage Pattern *</Label>
                  <Input
                    value={formData.dosage || ""}
                    onChange={(e) => handleChange("dosage", e.target.value)}
                    placeholder="e.g. 1-0-1, 0-0-1, 1-1-1, Once daily"
                    className="mt-1"
                    required
                    autoFocus
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Description</Label>
                  <Input
                    value={formData.description || ""}
                    onChange={(e) => handleChange("description", e.target.value)}
                    placeholder="e.g. Twice a day after meals"
                    className="mt-1"
                  />
                </div>
              </>
            )}

            {/* Prescription Duration */}
            {(normalizedDoctype === "prescription duration" ||
              normalizedDoctype === "duration" ||
              normalizedDoctype === "period") && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Number *</Label>
                  <Input
                    type="number"
                    min={1}
                    value={formData.number || 7}
                    onChange={(e) => handleChange("number", e.target.value)}
                    className="mt-1"
                    required
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Period *</Label>
                  <select
                    className="w-full border rounded-md px-3 py-2 text-sm mt-1 bg-background"
                    value={formData.period || "Day"}
                    onChange={(e) => handleChange("period", e.target.value)}
                  >
                    <option value="Day">Day(s)</option>
                    <option value="Week">Week(s)</option>
                    <option value="Month">Month(s)</option>
                    <option value="Year">Year(s)</option>
                    <option value="Hour">Hour(s)</option>
                  </select>
                </div>
              </div>
            )}

            {/* Sample Type / Lab Test Sample / Therapy Type / Complaint */}
            {(normalizedDoctype === "sample type" ||
              normalizedDoctype === "lab test sample" ||
              normalizedDoctype === "therapy type" ||
              normalizedDoctype === "complaint") && (
              <div>
                <Label className="text-xs text-muted-foreground">
                  {doctype} Name *
                </Label>
                <Input
                  value={
                    formData.sample_type ??
                    formData.sample ??
                    formData.sample_name ??
                    formData.therapy_type ??
                    formData.complaint ??
                    ""
                  }
                  onChange={(e) => {
                    const val = e.target.value;
                    if (normalizedDoctype === "sample type") handleChange("sample_type", val);
                    else if (normalizedDoctype === "lab test sample") {
                      handleChange("sample", val);
                      handleChange("sample_name", val);
                    }
                    else if (normalizedDoctype === "therapy type") handleChange("therapy_type", val);
                    else if (normalizedDoctype === "complaint") handleChange("complaint", val);
                  }}
                  className="mt-1"
                  required
                  autoFocus
                />
              </div>
            )}

            {/* Appointment Type Quick Entry */}
            {normalizedDoctype === "appointment type" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Label className="text-xs text-muted-foreground">Appointment Type Name *</Label>
                  <Input
                    value={formData.appointment_type || ""}
                    onChange={(e) => handleChange("appointment_type", e.target.value)}
                    className="mt-1"
                    required
                    autoFocus
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Default Duration (mins)</Label>
                  <Input
                    type="number"
                    value={formData.default_duration || 30}
                    onChange={(e) => handleChange("default_duration", Number(e.target.value))}
                    className="mt-1"
                  />
                </div>
              </div>
            )}

            {/* Patient Quick Entry */}
            {normalizedDoctype === "patient" && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">First Name *</Label>
                    <Input
                      value={formData.first_name || ""}
                      onChange={(e) => handleChange("first_name", e.target.value)}
                      className="mt-1"
                      required
                      autoFocus
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Last Name</Label>
                    <Input
                      value={formData.last_name || ""}
                      onChange={(e) => handleChange("last_name", e.target.value)}
                      className="mt-1"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">Gender *</Label>
                    <select
                      className="w-full border rounded-md px-3 py-2 text-sm mt-1 bg-background"
                      value={formData.sex || "Male"}
                      onChange={(e) => handleChange("sex", e.target.value)}
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Mobile</Label>
                    <Input
                      value={formData.mobile || ""}
                      onChange={(e) => handleChange("mobile", e.target.value)}
                      className="mt-1"
                      placeholder="e.g. +1 555-0199"
                    />
                  </div>
                </div>
              </>
            )}

            {/* Healthcare Practitioner Quick Entry */}
            {(normalizedDoctype === "healthcare practitioner" ||
              normalizedDoctype === "practitioner") && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">First Name *</Label>
                    <Input
                      value={formData.first_name || ""}
                      onChange={(e) => handleChange("first_name", e.target.value)}
                      className="mt-1"
                      required
                      autoFocus
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Last Name</Label>
                    <Input
                      value={formData.last_name || ""}
                      onChange={(e) => handleChange("last_name", e.target.value)}
                      className="mt-1"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">Gender *</Label>
                    <select
                      className="w-full border rounded-md px-3 py-2 text-sm mt-1 bg-background"
                      value={formData.gender || "Male"}
                      onChange={(e) => handleChange("gender", e.target.value)}
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Mobile Phone</Label>
                    <Input
                      value={formData.mobile_phone || ""}
                      onChange={(e) => handleChange("mobile_phone", e.target.value)}
                      className="mt-1"
                    />
                  </div>
                </div>
              </>
            )}

            {/* Lab Test Template */}
            {normalizedDoctype === "lab test template" && (
              <>
                <div>
                  <Label className="text-xs text-muted-foreground">Lab Test Name *</Label>
                  <Input
                    value={formData.lab_test_name || ""}
                    onChange={(e) => handleChange("lab_test_name", e.target.value)}
                    className="mt-1"
                    required
                    autoFocus
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Lab Test Code</Label>
                  <Input
                    value={formData.lab_test_code || ""}
                    onChange={(e) => handleChange("lab_test_code", e.target.value)}
                    className="mt-1"
                  />
                </div>
              </>
            )}

            {/* Antibiotic */}
            {normalizedDoctype === "antibiotic" && (
              <div>
                <Label className="text-xs text-muted-foreground">Antibiotic Name *</Label>
                <Input
                  value={formData.antibiotic_name || ""}
                  onChange={(e) => handleChange("antibiotic_name", e.target.value)}
                  className="mt-1"
                  required
                  autoFocus
                />
              </div>
            )}

            {/* Sensitivity */}
            {normalizedDoctype === "sensitivity" && (
              <div>
                <Label className="text-xs text-muted-foreground">Sensitivity *</Label>
                <Input
                  value={formData.sensitivity || ""}
                  onChange={(e) => handleChange("sensitivity", e.target.value)}
                  className="mt-1"
                  required
                  autoFocus
                />
              </div>
            )}

            {/* Organism */}
            {normalizedDoctype === "organism" && (
              <div>
                <Label className="text-xs text-muted-foreground">Organism *</Label>
                <Input
                  value={formData.organism || ""}
                  onChange={(e) => handleChange("organism", e.target.value)}
                  className="mt-1"
                  required
                  autoFocus
                />
              </div>
            )}

            {/* Healthcare Service Unit */}
            {(normalizedDoctype === "healthcare service unit" ||
              normalizedDoctype === "service unit") && (
              <div>
                <Label className="text-xs text-muted-foreground">Service Unit Name *</Label>
                <Input
                  value={formData.service_unit_name || ""}
                  onChange={(e) => handleChange("service_unit_name", e.target.value)}
                  className="mt-1"
                  required
                  autoFocus
                />
              </div>
            )}

            {/* Generic fallback */}
            {![
              "lab test uom",
              "uom",
              "medical department",
              "department",
              "item",
              "stock item",
              "drug code",
              "dosage form",
              "prescription dosage",
              "dosage",
              "prescription duration",
              "duration",
              "period",
              "lab test sample",
              "sample type",
              "therapy type",
              "complaint",
              "patient",
              "healthcare practitioner",
              "practitioner",
              "lab test template",
              "antibiotic",
              "sensitivity",
              "organism",
              "healthcare service unit",
              "service unit",
            ].includes(normalizedDoctype) && (
              <>
                <div>
                  <Label className="text-xs text-muted-foreground">{doctype} Name *</Label>
                  <Input
                    value={formData.name || ""}
                    onChange={(e) => handleChange("name", e.target.value)}
                    className="mt-1"
                    required
                    autoFocus
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Description</Label>
                  <Input
                    value={formData.description || ""}
                    onChange={(e) => handleChange("description", e.target.value)}
                    className="mt-1"
                  />
                </div>
              </>
            )}
          </div>

          <DialogFooter className="pt-3 border-t">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={saving}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
            >
              {saving ? (
                <>
                  <Icon icon="solar:spinner-linear" className="animate-spin" size={16} />
                  Saving...
                </>
              ) : (
                <>
                  <Icon icon="solar:check-circle-bold" size={16} />
                  Create
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
