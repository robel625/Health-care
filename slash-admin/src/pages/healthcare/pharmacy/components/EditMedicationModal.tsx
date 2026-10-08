import { useState, useEffect } from "react";
import { Icon } from "@/components/icon";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { Switch } from "@/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/ui/dialog";
import {
  HealthcareApi,
  type DosageForm,
  type MedicationClass,
} from "@/api/services/healthcareService";

interface EditMedicationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  medication: any | null;
  dosageForms: DosageForm[];
  medClasses: MedicationClass[];
  onSuccess: () => void;
}

export default function EditMedicationModal({
  open,
  onOpenChange,
  medication,
  dosageForms,
  medClasses,
  onSuccess,
}: EditMedicationModalProps) {
  const [genericName, setGenericName] = useState("");
  const [strength, setStrength] = useState("");
  const [strengthUom, setStrengthUom] = useState("mg");
  const [dosageFormId, setDosageFormId] = useState<number | null>(null);
  const [medClassId, setMedClassId] = useState<number | null>(null);
  const [ndc, setNdc] = useState("");
  const [standardRate, setStandardRate] = useState<number>(0);
  const [reorderLevel, setReorderLevel] = useState<number>(25);
  const [defaultDosage, setDefaultDosage] = useState("");
  const [defaultDuration, setDefaultDuration] = useState("");
  const [referenceUrl, setReferenceUrl] = useState("");
  const [isCombination, setIsCombination] = useState(false);
  const [disabled, setDisabled] = useState(false);

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && medication) {
      setGenericName(medication.generic_name || "");
      setStrength(medication.strength || "");
      setStrengthUom(medication.strength_uom || "mg");
      setDosageFormId(
        typeof medication.dosage_form === "object"
          ? medication.dosage_form?.id
          : medication.dosage_form || null
      );
      setMedClassId(
        typeof medication.medication_class === "object"
          ? medication.medication_class?.id
          : medication.medication_class || null
      );
      setNdc(medication.national_drug_code || "");
      setStandardRate(Number(medication.standard_rate || 0));
      setReorderLevel(Number(medication.reorder_level || 25));
      setDefaultDosage(medication.default_prescription_dosage || "");
      setDefaultDuration(medication.default_prescription_duration || "");
      setReferenceUrl(medication.reference_url || "");
      setIsCombination(Boolean(medication.is_combination));
      setDisabled(Boolean(medication.disabled));
    }
  }, [open, medication]);

  const handleSubmit = async () => {
    if (!genericName.trim()) {
      alert("Generic Name is required.");
      return;
    }
    if (!medication?.id) return;

    setSaving(true);
    try {
      const payload: any = {
        generic_name: genericName.trim(),
        strength: strength.trim(),
        strength_uom: strengthUom.trim(),
        dosage_form: dosageFormId,
        medication_class: medClassId,
        national_drug_code: ndc.trim(),
        standard_rate: Number(standardRate) || 0,
        reorder_level: Number(reorderLevel) || 0,
        default_prescription_dosage: defaultDosage.trim(),
        default_prescription_duration: defaultDuration.trim(),
        reference_url: referenceUrl.trim(),
        is_combination: isCombination,
        disabled: disabled,
      };

      await HealthcareApi.medications.update(medication.id, payload);
      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      console.error(err);
      alert(err?.response?.data?.error || "Failed to update medication formulary entry.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon icon="solar:pen-new-square-bold-duotone" size={24} />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">
                Edit Medication / Drug Formulary Entry
              </DialogTitle>
              <p className="text-xs text-muted-foreground">
                Synchronizes clinical formulary rules, standard stock item price, and reorder levels.
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Generic Name & NDC */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <Label className="text-xs font-semibold mb-1 block">Generic Name *</Label>
              <Input
                value={genericName}
                onChange={(e) => setGenericName(e.target.value)}
                placeholder="e.g. Amoxicillin Trihydrate"
                className="h-9 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold mb-1 block">National Drug Code (NDC)</Label>
              <Input
                value={ndc}
                onChange={(e) => setNdc(e.target.value)}
                placeholder="e.g. 00093-3109-05"
                className="h-9 text-xs font-mono"
              />
            </div>
          </div>

          {/* Strength, UOM, Dosage Form */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <Label className="text-xs font-semibold mb-1 block">Strength</Label>
              <Input
                value={strength}
                onChange={(e) => setStrength(e.target.value)}
                placeholder="e.g. 500"
                className="h-9 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold mb-1 block">Strength Unit (UOM)</Label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs"
                value={strengthUom}
                onChange={(e) => setStrengthUom(e.target.value)}
              >
                <option value="mg">mg</option>
                <option value="g">g</option>
                <option value="mcg">mcg</option>
                <option value="mL">mL</option>
                <option value="IU/mL">IU/mL</option>
                <option value="%">% w/v</option>
                <option value="mcg/dose">mcg/dose</option>
                <option value="mg/2mL">mg/2mL</option>
              </select>
            </div>
            <div>
              <Label className="text-xs font-semibold mb-1 block">Dosage Form</Label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs"
                value={dosageFormId || ""}
                onChange={(e) => setDosageFormId(Number(e.target.value) || null)}
              >
                <option value="">Select form...</option>
                {dosageForms.map((df) => (
                  <option key={df.id} value={df.id}>
                    {df.dosage_form}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Medication Class */}
          <div>
            <Label className="text-xs font-semibold mb-1 block">Therapeutic Class / Category</Label>
            <select
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs"
              value={medClassId || ""}
              onChange={(e) => setMedClassId(Number(e.target.value) || null)}
            >
              <option value="">Select class...</option>
              {medClasses.map((mc) => (
                <option key={mc.id} value={mc.id}>
                  {mc.medication_class}
                </option>
              ))}
            </select>
          </div>

          {/* Marley Item Sync: Standard Rate & Reorder Level */}
          <div className="p-3.5 rounded-xl bg-muted/40 border space-y-3">
            <div className="flex items-center gap-2">
              <Icon icon="solar:database-bold" size={16} className="text-primary" />
              <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                Stock Item & Pricing Synchronization
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-semibold mb-1 block">Standard Rate / Price ($)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={standardRate}
                  onChange={(e) => setStandardRate(Number(e.target.value))}
                  className="h-9 text-xs font-mono"
                />
                <span className="text-[10px] text-muted-foreground block mt-0.5">
                  Synchronizes with linked Item standard_rate
                </span>
              </div>
              <div>
                <Label className="text-xs font-semibold mb-1 block">Inventory Reorder Level</Label>
                <Input
                  type="number"
                  min="0"
                  value={reorderLevel}
                  onChange={(e) => setReorderLevel(Number(e.target.value))}
                  className="h-9 text-xs font-mono"
                />
                <span className="text-[10px] text-muted-foreground block mt-0.5">
                  Triggers low stock warnings below this quantity
                </span>
              </div>
            </div>
          </div>

          {/* Clinical Prescribing Defaults */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs font-semibold mb-1 block">Default Prescription Dosage</Label>
              <Input
                value={defaultDosage}
                onChange={(e) => setDefaultDosage(e.target.value)}
                placeholder="e.g. 1 Tablet every 8 hours"
                className="h-9 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold mb-1 block">Default Duration</Label>
              <Input
                value={defaultDuration}
                onChange={(e) => setDefaultDuration(e.target.value)}
                placeholder="e.g. 7 Days"
                className="h-9 text-xs"
              />
            </div>
          </div>

          {/* Toggles: Status & Combination */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
              <div>
                <Label className="text-xs font-semibold block">Formulary Status</Label>
                <span className="text-[11px] text-muted-foreground">
                  {disabled ? "Disabled (cannot be prescribed)" : "Active in Formulary"}
                </span>
              </div>
              <Switch
                checked={!disabled}
                onCheckedChange={(active) => setDisabled(!active)}
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
              <div>
                <Label className="text-xs font-semibold block">Combination Drug</Label>
                <span className="text-[11px] text-muted-foreground">
                  Contains multiple active API ingredients
                </span>
              </div>
              <Switch
                checked={isCombination}
                onCheckedChange={setIsCombination}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving} className="gap-2">
            {saving ? (
              <>
                <Icon icon="solar:refresh-circle-bold" className="animate-spin" size={16} />
                Saving Changes...
              </>
            ) : (
              <>
                <Icon icon="solar:check-circle-bold" size={16} />
                Save Medication
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
