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
  DialogDescription,
  DialogFooter,
} from "@/ui/dialog";
import { HealthcareApi } from "@/api/services/healthcareService";
import { registerCustomSymptom } from "./symptomsData";

interface CreateSymptomModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialName?: string;
  onCreated: (symptomName: string, url?: string) => void;
}

export default function CreateSymptomModal({
  open,
  onOpenChange,
  initialName = "",
  onCreated,
}: CreateSymptomModalProps) {
  const [name, setName] = useState(initialName);
  const [url, setUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setName(initialName);
      setUrl("");
      setError("");
      setSaving(false);
    }
  }, [open, initialName]);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Please enter a symptom name.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      // 1. Persist to backend complaints master (Frappe/Django)
      await HealthcareApi.complaints
        .create({ complaint: trimmed } as any)
        .catch((err) => {
          // If already exists or minor network issue, continue gracefully
          console.warn("Could not create complaint master in backend:", err);
        });

      // 2. Register into catalog and local storage with clinical guide URL
      registerCustomSymptom(trimmed, url.trim() || undefined);

      // 3. Notify parent to select it and update options
      onCreated(trimmed, url.trim() || undefined);
      onOpenChange(false);
    } catch (err: any) {
      setError(err?.message || "Failed to create symptom.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
              <Icon icon="solar:pulse-bold-duotone" size={20} />
            </div>
            <div>
              <DialogTitle className="text-base font-bold">Create New Symptom</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Add a presenting symptom not currently in the catalog.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {error && (
            <div className="p-2.5 rounded-lg bg-rose-500/10 text-rose-600 text-xs font-medium border border-rose-500/20">
              {error}
            </div>
          )}

          <div>
            <Label className="text-xs font-semibold">
              Symptom Name <span className="text-rose-500">*</span>
            </Label>
            <Input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError("");
              }}
              placeholder="e.g. Tremors, Peripheral Numbness, Cold Feet..."
              className="mt-1.5 text-sm"
              autoFocus
            />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold">Clinical Information Link (URL)</Label>
              <span className="text-[10px] text-muted-foreground font-normal">Optional</span>
            </div>
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.carehospitals.com/symptoms/..."
              className="mt-1.5 text-xs font-mono"
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              Practitioners will be able to click the detail link directly from the encounter select box.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-muted/40 border text-xs text-muted-foreground flex items-start gap-2">
            <Icon icon="solar:info-circle-bold" size={16} className="text-primary shrink-0 mt-0.5" />
            <span>
              This symptom will be added to the presenting complaints library and selected for this encounter.
            </span>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={saving || !name.trim()}
              className="bg-emerald-600 hover:bg-emerald-700 text-xs font-semibold gap-1.5"
            >
              {saving ? (
                <>
                  <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Saving...
                </>
              ) : (
                <>
                  <Icon icon="solar:check-circle-bold" size={14} />
                  Add & Select Symptom
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
