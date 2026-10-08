import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/ui/dialog";
import { Button } from "@/ui/button";
import { Label } from "@/ui/label";
import { Icon } from "@/components/icon";
import { HealthcareApi, type TreatmentPlanTemplate } from "@/api/services/healthcareService";
import type { DrugRow, LabRow, ProcedureRow, TherapyRow } from "./encounterRows";

interface ApplyTreatmentPlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApply: (data: {
    drugs: DrugRow[];
    labs: LabRow[];
    procedures: ProcedureRow[];
    therapies: TherapyRow[];
    symptoms: string[];
    diagnoses: string[];
  }) => void;
}

export default function ApplyTreatmentPlanDialog({
  open,
  onOpenChange,
  onApply,
}: ApplyTreatmentPlanDialogProps) {
  const [templates, setTemplates] = useState<TreatmentPlanTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    HealthcareApi.treatmentPlanTemplates
      .list({ page_size: 100 })
      .then((res) => {
        setTemplates(res.results || []);
      })
      .catch((err) => {
        console.error("Failed to load treatment plan templates:", err);
      })
      .finally(() => setLoading(false));
  }, [open]);

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId) || null;

  const handleConfirm = async () => {
    if (!selectedTemplateId) return;
    setApplying(true);
    try {
      // Get full template details with child items
      const tpl = await HealthcareApi.treatmentPlanTemplates.get(selectedTemplateId);

      const drugs: DrugRow[] = [];
      const labs: LabRow[] = [];
      const procedures: ProcedureRow[] = [];
      const therapies: TherapyRow[] = [];
      const symptoms: string[] = [];
      const diagnoses: string[] = [];

      // Process complaints / symptoms
      if (Array.isArray(tpl.complaints)) {
        for (const c of tpl.complaints) {
          const name = c.symptom || c.complaint_master_name || c.complaint;
          if (name && !symptoms.includes(name)) symptoms.push(name);
        }
      }

      // Process diagnoses
      if (Array.isArray(tpl.diagnosis)) {
        for (const d of tpl.diagnosis) {
          const name = d.diagnosis || d.diagnosis_master_name;
          if (name && !diagnoses.includes(name)) diagnoses.push(name);
        }
      }

      // Process top-level therapy type if specified
      if (tpl.therapy_type_name) {
        therapies.push({
          therapy_type: tpl.therapy_type_name,
          no_of_sessions: String(tpl.total_sessions || 1),
          interval: "",
          patient_care_type: "",
          intent: "",
          priority: "",
        });
      }

      // Process template items
      if (Array.isArray(tpl.items)) {
        for (const item of tpl.items) {
          const type = (item.item_type || "").toLowerCase();
          if (type.includes("drug") || type.includes("medication")) {
            drugs.push({
              medication: item.drug_name || item.item_name || "",
              drug_code: item.drug_code || "",
              drug_name: item.drug_name || item.item_name || "",
              dosage: item.dosage || "",
              period: item.period || "",
              dosage_form: item.dosage_form || "",
              comment: item.instructions || "",
              interval: item.interval ? String(item.interval) : "",
              interval_uom: item.interval_uom || "",
              number_of_repeats_allowed: item.number_of_repeats_allowed
                ? String(item.number_of_repeats_allowed)
                : "",
              intent: "",
              priority: "",
            });
          } else if (type.includes("lab")) {
            labs.push({
              lab_test_code: item.item_name || item.drug_code || "",
              lab_test_name: item.item_name || "",
              lab_test_comment: item.instructions || "",
              observation_template: "",
              patient_care_type: "",
              intent: "",
              priority: "",
            });
          } else if (type.includes("procedure")) {
            procedures.push({
              procedure: item.item_name || item.drug_code || "",
              procedure_name: item.item_name || "",
              department: "",
              practitioner: "",
              date: "",
              comments: item.instructions || "",
              no_of_sessions: item.quantity ? String(item.quantity) : "1",
              interval: item.interval ? String(item.interval) : "",
              patient_care_type: "",
              intent: "",
              priority: "",
            });
          } else if (type.includes("therapy")) {
            therapies.push({
              therapy_type: item.item_name || "",
              no_of_sessions: item.quantity ? String(item.quantity) : "1",
              interval: item.interval ? String(item.interval) : "",
              patient_care_type: "",
              intent: "",
              priority: "",
            });
          }
        }
      }

      // Process direct drugs list if present on template
      if (Array.isArray(tpl.drugs)) {
        for (const d of tpl.drugs) {
          drugs.push({
            medication: d.medication_name || d.drug_name || "",
            drug_code: d.drug_code || "",
            drug_name: d.drug_name || d.medication_name || "",
            dosage: d.dosage || "",
            period: d.period || "",
            dosage_form: d.dosage_form || "",
            comment: d.comment || "",
            interval: d.interval || "",
            interval_uom: d.interval_uom || "",
            number_of_repeats_allowed: d.number_of_repeats_allowed
              ? String(d.number_of_repeats_allowed)
              : "",
            intent: d.intent || "",
            priority: d.priority || "",
          });
        }
      }

      onApply({ drugs, labs, procedures, therapies, symptoms, diagnoses });
      onOpenChange(false);
    } catch (err) {
      console.error("Error applying treatment plan template:", err);
    } finally {
      setApplying(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon icon="solar:notes-bold-duotone" size={20} className="text-emerald-600" />
            Apply Treatment Plan Template
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-3">
          <p className="text-xs text-muted-foreground">
            Applying a template automatically unrolls its standard medications, lab investigations,
            procedures, and therapy sessions into this patient encounter.
          </p>

          <div>
            <Label className="text-xs font-semibold">Select Template</Label>
            <select
              className="w-full border rounded-md px-3 py-2 text-sm mt-1 bg-background"
              value={selectedTemplateId || ""}
              onChange={(e) => setSelectedTemplateId(e.target.value ? Number(e.target.value) : null)}
              disabled={loading || applying}
            >
              <option value="">Choose a treatment plan template...</option>
              {templates.map((tpl) => (
                <option key={tpl.id} value={tpl.id}>
                  {tpl.template_name} {tpl.medical_department_name ? `(${tpl.medical_department_name})` : ""}
                </option>
              ))}
            </select>
          </div>

          {selectedTemplate && (
            <div className="rounded-md border bg-muted/30 p-3 text-xs space-y-1.5">
              <div className="font-semibold text-foreground">{selectedTemplate.template_name}</div>
              {selectedTemplate.description && (
                <div className="text-muted-foreground">{selectedTemplate.description}</div>
              )}
              {selectedTemplate.goal && (
                <div><span className="font-medium text-foreground">Goal:</span> {selectedTemplate.goal}</div>
              )}
              <div className="flex gap-4 text-muted-foreground pt-1">
                <span>Items: {(selectedTemplate.items || []).length}</span>
                {selectedTemplate.total_sessions ? (
                  <span>Sessions: {selectedTemplate.total_sessions}</span>
                ) : null}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={applying}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!selectedTemplateId || applying}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {applying ? "Applying..." : "Apply Template"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
