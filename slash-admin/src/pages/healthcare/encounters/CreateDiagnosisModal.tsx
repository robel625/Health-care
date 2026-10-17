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
import { registerCustomDiagnosis } from "./diagnosesData";

interface CreateDiagnosisModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialName?: string;
  onCreated: (diagnosisDisplay: string, code?: string) => void;
}

export default function CreateDiagnosisModal({
  open,
  onOpenChange,
  initialName = "",
  onCreated,
}: CreateDiagnosisModalProps) {
  const [name, setName] = useState(initialName);
  const [code, setCode] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setName(initialName);
      setCode("");
      setError("");
      setSaving(false);
    }
  }, [open, initialName]);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Please enter a clinical diagnosis name.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      // 1. Persist to backend diagnosis catalog (Frappe/Django)
      await HealthcareApi.diagnosisCatalog
        .create({ diagnosis: trimmed } as any)
        .catch((err) => {
          console.warn("Could not create diagnosis in backend:", err);
        });

      // 2. Register into catalog and local storage
      const entry = registerCustomDiagnosis(trimmed, code.trim() || undefined);

      // 3. Notify parent to select it and update options
      onCreated(entry.display, code.trim() || undefined);
      onOpenChange(false);
    } catch (err: any) {
      setError(err?.message || "Failed to create diagnosis.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
              <Icon icon="solar:stethoscope-bold" size={20} />
            </div>
            <div>
              <DialogTitle className="text-base font-bold">Create New Diagnosis</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Add a clinical diagnosis not currently in the ESV ICD-11 catalog.
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
              Diagnosis Name <span className="text-rose-500">*</span>
            </Label>
            <Input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError("");
              }}
              placeholder="e.g. Acute Sinusitis, Bell's Palsy..."
              className="mt-1.5 text-sm"
              autoFocus
            />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold">ICD-11 / Clinical Code</Label>
              <span className="text-[10px] text-muted-foreground font-normal">Optional</span>
            </div>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g. CA01, 8B88.0..."
              className="mt-1.5 text-xs font-mono uppercase"
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              Standardized classification code for statistical reporting and health records.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-muted/40 border text-xs text-muted-foreground flex items-start gap-2">
            <Icon icon="solar:info-circle-bold" size={16} className="text-blue-500 shrink-0 mt-0.5" />
            <span>
              This diagnosis will be added to the clinical diagnosis library and selected for this encounter.
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
              className="bg-blue-600 hover:bg-blue-700 text-xs font-semibold gap-1.5"
            >
              {saving ? (
                <>
                  <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Saving...
                </>
              ) : (
                <>
                  <Icon icon="solar:check-circle-bold" size={14} />
                  Add & Select Diagnosis
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
