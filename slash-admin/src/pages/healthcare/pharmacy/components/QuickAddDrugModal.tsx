import { useState, useEffect } from "react";
import { Icon } from "@/components/icon";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/ui/dialog";
import { toast } from "sonner";
import {
  HealthcareApi,
  type DosageForm,
  type MedicationClass,
} from "@/api/services/healthcareService";
import {
  ETHIOPIAN_ESSENTIAL_MEDICINES,
  getEthiopianMedicineDefaults,
} from "../ethiopianMedicinesData";

interface QuickAddDrugModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialName?: string;
  dosageForms: DosageForm[];
  medClasses: MedicationClass[];
  onDrugCreated: (drug: any) => void;
}

const COMMON_STRENGTH_PRESETS = ["5mg", "10mg", "20mg", "50mg", "100mg", "250mg", "500mg", "625mg", "1g"];

export default function QuickAddDrugModal({
  open,
  onOpenChange,
  initialName = "",
  dosageForms,
  medClasses,
  onDrugCreated,
}: QuickAddDrugModalProps) {
  const [genericName, setGenericName] = useState("");
  const [strength, setStrength] = useState("");
  const [strengthUom, setStrengthUom] = useState("mg");
  const [dosageFormId, setDosageFormId] = useState<number | null>(null);
  const [medClassId, setMedClassId] = useState<number | null>(null);
  const [ndc, setNdc] = useState("");
  const [standardRate, setStandardRate] = useState<number>(1.0);
  const [reorderLevel, setReorderLevel] = useState<number>(25);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setGenericName(initialName);
      setStrength("");
      setStrengthUom("mg");
      setNdc("");
      setStandardRate(1.0);
      setReorderLevel(25);
      if (dosageForms.length > 0) {
        const tab = dosageForms.find((df) => df.dosage_form.toLowerCase().includes("tab"));
        setDosageFormId(tab ? tab.id : dosageForms[0].id);
      }
      if (medClasses.length > 0) {
        setMedClassId(medClasses[0].id);
      }
    }
  }, [open, initialName, dosageForms, medClasses]);

  const applyStrengthPreset = (preset: string) => {
    const match = preset.match(/^(\d+)(.*)$/);
    if (match) {
      setStrength(match[1]);
      if (match[2]) setStrengthUom(match[2]);
    }
  };

  const handleSubmit = async () => {
    if (!genericName.trim()) {
      toast.error("Generic Name is required.");
      return;
    }

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
        reorder_level: Number(reorderLevel) || 25,
        disabled: false,
        is_combination: false,
      };

      const res = await HealthcareApi.medications.create(payload);
      toast.success(`"${res.generic_name}" added to formulary & inventory!`);
      onDrugCreated(res);
      onOpenChange(false);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.response?.data?.error || "Failed to create drug formulary master.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3 text-emerald-600">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600">
              <Icon icon="solar:pill-bold-duotone" size={26} />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-foreground">
                + Add New Drug to Formulary
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Registers new medication into the clinical formulary catalog and inventory item ledger.
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2 text-xs">
          <div>
            <Label className="text-xs font-semibold mb-1.5 block">
              Generic Name <span className="text-destructive">*</span>
            </Label>
            <Input
              list="eeml-quick-add-list"
              value={genericName}
              onChange={(e) => {
                const val = e.target.value;
                setGenericName(val);
                const found = getEthiopianMedicineDefaults(val);
                if (found) {
                  if (found.strength) {
                    const match = found.strength.match(/^(\d+)(.*)$/);
                    if (match) {
                      setStrength(match[1]);
                      if (match[2]) setStrengthUom(match[2].trim());
                    } else {
                      setStrength(found.strength);
                    }
                  }
                  if (found.sub_code || found.major_code) {
                    setNdc(found.sub_code || found.major_code);
                  }
                  if (found.primary_dosage_form && dosageForms.length > 0) {
                    const df = dosageForms.find((d) =>
                      d.dosage_form.toLowerCase().includes(found.primary_dosage_form.toLowerCase())
                    );
                    if (df) setDosageFormId(df.id);
                  }
                  if (medClasses.length > 0) {
                    const mc = medClasses.find(
                      (c) =>
                        c.medication_class.toLowerCase().includes(found.major_category.toLowerCase()) ||
                        found.major_category.toLowerCase().includes(c.medication_class.toLowerCase())
                    );
                    if (mc) setMedClassId(mc.id);
                  }
                }
              }}
              placeholder="e.g. Ciprofloxacin HCl / Amoxicillin / Paracetamol"
              className="h-9 text-xs font-semibold"
              autoFocus
            />
            <datalist id="eeml-quick-add-list">
              {ETHIOPIAN_ESSENTIAL_MEDICINES.slice(0, 300).map((m) => (
                <option key={m.id} value={m.generic_name}>
                  {m.major_category} · {m.strength ? `[${m.strength}]` : ""}
                </option>
              ))}
            </datalist>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold">Strength & Concentration</Label>
              <span className="text-[11px] text-muted-foreground">Quick presets:</span>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {COMMON_STRENGTH_PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => applyStrengthPreset(p)}
                  className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-muted hover:bg-emerald-500/10 hover:text-emerald-600 border transition-colors"
                >
                  {p}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <Input
                  value={strength}
                  onChange={(e) => setStrength(e.target.value)}
                  placeholder="Value (e.g. 500)"
                  className="h-8 text-xs font-medium"
                />
              </div>
              <div>
                <select
                  className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-xs font-medium"
                  value={strengthUom}
                  onChange={(e) => setStrengthUom(e.target.value)}
                >
                  <option value="mg">mg</option>
                  <option value="g">g</option>
                  <option value="mcg">mcg</option>
                  <option value="mL">mL</option>
                  <option value="IU/mL">IU/mL</option>
                  <option value="mcg/dose">mcg/dose</option>
                  <option value="%">% (w/v)</option>
                </select>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-semibold mb-1.5 block">Dosage Form</Label>
              <select
                className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-xs font-medium"
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
            <div>
              <Label className="text-xs font-semibold mb-1.5 block">Therapeutic Class</Label>
              <select
                className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-xs font-medium"
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
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-semibold mb-1.5 block">Standard Unit Cost ($)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={standardRate}
                onChange={(e) => setStandardRate(Number(e.target.value))}
                className="h-8 text-xs font-mono font-medium"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold mb-1.5 block">Reorder Minimum Threshold</Label>
              <Input
                type="number"
                min="0"
                value={reorderLevel}
                onChange={(e) => setReorderLevel(Number(e.target.value))}
                className="h-8 text-xs font-mono font-medium"
              />
            </div>
          </div>

          <div>
            <Label className="text-xs font-semibold mb-1.5 block">NDC / Barcode / SKU (Optional)</Label>
            <Input
              value={ndc}
              onChange={(e) => setNdc(e.target.value)}
              placeholder="e.g. 00093-3109-05 / EAN-13"
              className="h-8 text-xs font-mono"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 pt-2 border-t">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={saving}
            className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-sm"
          >
            {saving ? (
              <>
                <Icon icon="solar:refresh-circle-bold" className="animate-spin" size={14} />
                Registering Drug...
              </>
            ) : (
              <>
                <Icon icon="solar:check-circle-bold" size={14} />
                Save & Select Drug
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
