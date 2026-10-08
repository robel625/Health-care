import { useState, useEffect } from "react";
import { Link } from "react-router";
import { Icon } from "@/components/icon";
import { Button } from "@/ui/button";
import { Card, CardContent, CardHeader } from "@/ui/card";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/ui/dialog";
import { HealthcareApi } from "@/api/services/healthcareService";
import type { HealthcareSettingsInfo } from "@/api/services/healthcareService";

/**
 * The Healthcare Settings switches the Lab Test flow reads, with Marley's own
 * labels and descriptions from `healthcare_settings.json`. They live here
 * because this page is where the rest of the healthcare lookups are managed.
 */
const LAB_TEST_SETTINGS: { key: string; label: string; description: string }[] = [
  {
    key: "lab_test_approval_required",
    label: "Do not print or email Lab Tests without Approval",
    description:
      "Restricts Lab Test documents unless their status is Approved. While on, the LabTest Approver role sees the Approve / Reject actions on the Lab Test form.",
  },
  {
    key: "create_sample_collection_for_lab_test",
    label: "Create Sample Collection document for Lab Test",
    description: "A Sample Collection document is created every time you create a Lab Test.",
  },
  {
    key: "validate_nursing_checklists",
    label: "Validate Nursing Checklists",
    description:
      "Mandatory nursing checklist tasks must be Completed before a Lab Test can be submitted.",
  },
];

interface RefSection {
  title: string;
  icon: string;
  color: string;
  data: any[];
  loading: boolean;
  field: string;
  fetcher: () => Promise<any>;
  creator: (data: any) => Promise<any>;
  /** Where the fuller management page lives, when there is one. */
  href?: string;
}

export default function ReferenceDataPage() {
  const [sections, setSections] = useState<RefSection[]>([
    { title: "Dosage Forms", icon: "solar:pill-bold-duotone", color: "text-blue-600 bg-blue-50", data: [], loading: false, field: "dosage_form", fetcher: () => HealthcareApi.dosageForms.list(), creator: (d) => HealthcareApi.dosageForms.create(d) },
    { title: "Prescription Dosages", icon: "solar:clock-circle-bold-duotone", color: "text-emerald-600 bg-emerald-50", data: [], loading: false, field: "dosage", fetcher: () => HealthcareApi.prescriptionDosages.list(), creator: (d) => HealthcareApi.prescriptionDosages.create(d) },
    { title: "Prescription Durations", icon: "solar:calendar-bold-duotone", color: "text-sky-600 bg-sky-50", data: [], loading: false, field: "period", fetcher: () => HealthcareApi.prescriptionDurations.list(), creator: (d) => HealthcareApi.prescriptionDurations.create({ period: d.period, number: 1 }) },
    { title: "Clinical Note Types", icon: "solar:notes-bold-duotone", color: "text-amber-600 bg-amber-50", data: [], loading: false, field: "clinical_note_type", fetcher: () => HealthcareApi.clinicalNoteTypes.list(), creator: (d) => HealthcareApi.clinicalNoteTypes.create(d) },
    { title: "Appointment Types", icon: "solar:calendar-mark-bold-duotone", color: "text-purple-600 bg-purple-50", data: [], loading: false, field: "appointment_type", fetcher: () => HealthcareApi.appointmentTypes.list(), creator: (d) => HealthcareApi.appointmentTypes.create(d), href: "/healthcare/reference/appointment-types" },
    { title: "Body Parts", icon: "solar:user-circle-bold-duotone", color: "text-emerald-600 bg-emerald-50", data: [], loading: false, field: "body_part", fetcher: () => HealthcareApi.bodyParts.list(), creator: (d) => HealthcareApi.bodyParts.create(d) },
    { title: "Sample Types", icon: "solar:test-tube-bold-duotone", color: "text-cyan-600 bg-cyan-50", data: [], loading: false, field: "sample_type", fetcher: () => HealthcareApi.sampleTypes.list(), creator: (d) => HealthcareApi.sampleTypes.create(d) },
    { title: "Complaints", icon: "solar:chat-round-warning-bold-duotone", color: "text-orange-600 bg-orange-50", data: [], loading: false, field: "complaint", fetcher: () => HealthcareApi.complaints.list(), creator: (d) => HealthcareApi.complaints.create(d) },
    { title: "Triage Levels", icon: "solar:danger-bold-duotone", color: "text-red-600 bg-red-50", data: [], loading: false, field: "triage_level", fetcher: () => HealthcareApi.triageLevels.list(), creator: (d) => HealthcareApi.triageLevels.create(d) },
    { title: "Medication Classes", icon: "solar:layers-bold-duotone", color: "text-purple-600 bg-purple-50", data: [], loading: false, field: "medication_class", fetcher: () => HealthcareApi.medicationClasses.list(), creator: (d) => HealthcareApi.medicationClasses.create(d) },
    { title: "Healthcare Activities", icon: "solar:play-circle-bold-duotone", color: "text-amber-600 bg-amber-50", data: [], loading: false, field: "activity", fetcher: () => HealthcareApi.healthcareActivities.list(), creator: (d) => HealthcareApi.healthcareActivities.create(d) },
    { title: "Antibiotics", icon: "solar:shield-warning-bold-duotone", color: "text-lime-600 bg-lime-50", data: [], loading: false, field: "antibiotic_name", fetcher: () => HealthcareApi.antibiotics.list(), creator: (d) => HealthcareApi.antibiotics.create(d) },
    { title: "Sensitivities", icon: "solar:radial-blur-bold-duotone", color: "text-rose-600 bg-rose-50", data: [], loading: false, field: "sensitivity", fetcher: () => HealthcareApi.sensitivities.list(), creator: (d) => HealthcareApi.sensitivities.create(d) },
    { title: "Organisms", icon: "solar:bacteria-bold-duotone", color: "text-fuchsia-600 bg-fuchsia-50", data: [], loading: false, field: "organism", fetcher: () => HealthcareApi.organisms.list(), creator: (d) => HealthcareApi.organisms.create(d) },
    { title: "Service Request Categories", icon: "solar:clipboard-list-bold-duotone", color: "text-indigo-600 bg-indigo-50", data: [], loading: false, field: "category", fetcher: () => HealthcareApi.serviceRequestCategories.list(), creator: (d) => HealthcareApi.serviceRequestCategories.create(d) },
    // Pharmacy Warehouses
    { title: "Pharmacy Warehouses", icon: "solar:box-bold-duotone", color: "text-teal-600 bg-teal-50", data: [], loading: false, field: "warehouse_name", fetcher: () => HealthcareApi.pharmacyWarehouses.list(), creator: (d) => HealthcareApi.pharmacyWarehouses.create({ name: d.warehouse_name, warehouse_name: d.warehouse_name }), href: "/healthcare/pharmacy/stock" },
  ]);
  const [activeSection, setActiveSection] = useState<number | null>(null);
  const [newItem, setNewItem] = useState("");
  const [error, setError] = useState("");

  // The singleton Healthcare Settings row the toggles write to.
  const [settings, setSettings] = useState<HealthcareSettingsInfo | null>(null);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [settingsError, setSettingsError] = useState("");

  useEffect(() => {
    HealthcareApi.healthcareSettings
      .list()
      .then((res: any) => setSettings((res.results || [])[0] ?? null))
      .catch(() => {})
      .finally(() => setSettingsLoaded(true));
  }, []);

  const toggleSetting = async (key: string, value: boolean) => {
    setSettingsError("");
    // Optimistic flip so the checkbox tracks the click immediately.
    setSettings((prev) => ({ ...(prev ?? { id: 0 }), [key]: value }) as HealthcareSettingsInfo);
    try {
      const saved: HealthcareSettingsInfo = settings?.id
        ? await HealthcareApi.healthcareSettings.update(settings.id, { [key]: value })
        : await HealthcareApi.healthcareSettings.create({ [key]: value });
      setSettings(saved);
    } catch (err: any) {
      const detail = err?.response?.data;
      setSettingsError(
        detail ? Object.values(detail).flat().join(" ") : "Could not save the setting."
      );
      // Roll the checkbox back to the server's truth.
      HealthcareApi.healthcareSettings
        .list()
        .then((res: any) => setSettings((res.results || [])[0] ?? null))
        .catch(() => {});
    }
  };

  useEffect(() => {
    sections.forEach((_, i) => loadSection(i));
  }, []);

  const loadSection = async (idx: number) => {
    setSections(prev => prev.map((s, i) => i === idx ? { ...s, loading: true } : s));
    try {
      const res = await sections[idx].fetcher() as any;
      const items = res.results || res || [];
      setSections(prev => prev.map((s, i) => i === idx ? { ...s, data: items, loading: false } : s));
    } catch (err) {
      setSections(prev => prev.map((s, i) => i === idx ? { ...s, loading: false } : s));
    }
  };

  const handleAdd = async (idx: number) => {
    if (!newItem.trim()) return;
    const field = sections[idx].field;
    try {
      await sections[idx].creator({ [field]: newItem.trim() });
      setNewItem("");
      setActiveSection(null);
      loadSection(idx);
    } catch (err: any) {
      // A duplicate is refused by the server (Department names are unique), so
      // show what it said rather than closing as if it had worked.
      const detail = err?.response?.data;
      setError(
        detail
          ? Object.values(detail).flat().join(" ")
          : "Could not save. Please try again."
      );
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Reference Data</h1>
        <p className="text-muted-foreground">Manage healthcare lookup tables and reference data</p>
      </div>

      {/* Healthcare Settings — the switches the Lab Test flow reads */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg text-cyan-600 bg-cyan-50">
              <Icon icon="solar:settings-bold-duotone" size={18} />
            </div>
            <div>
              <h3 className="font-semibold">Lab Test Settings</h3>
              <p className="text-xs text-muted-foreground">
                Healthcare Settings — Marley's Laboratory switches
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!settingsLoaded ? (
            <div className="py-2 text-sm text-muted-foreground">Loading...</div>
          ) : (
            LAB_TEST_SETTINGS.map((s) => (
              <label key={s.key} className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={!!(settings as any)?.[s.key]}
                  onChange={(e) => toggleSetting(s.key, e.target.checked)}
                />
                <span>
                  <span className="text-sm font-medium">{s.label}</span>
                  <span className="block text-xs text-muted-foreground">
                    {s.description}
                  </span>
                </span>
              </label>
            ))
          )}
          {settingsError && <p className="text-sm text-red-600">{settingsError}</p>}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sections.map((section, idx) => (
          <Card key={section.title}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`p-1.5 rounded-lg ${section.color}`}>
                    <Icon icon={section.icon} size={18} />
                  </div>
                  {section.href ? (
                    <Link to={section.href} className="font-semibold hover:underline">
                      {section.title}
                    </Link>
                  ) : (
                    <h3 className="font-semibold">{section.title}</h3>
                  )}
                </div>
                <span className="text-sm text-muted-foreground">{section.data.length} items</span>
              </div>
            </CardHeader>
            <CardContent>
              {section.loading ? (
                <div className="py-4 text-center text-sm text-muted-foreground">Loading...</div>
              ) : section.data.length === 0 ? (
                <div className="py-4 text-center text-sm text-muted-foreground">No items</div>
              ) : (
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {section.data.map((item: any) => (
                    <div key={item.id} className="flex items-center justify-between py-1 px-2 rounded bg-muted/50 text-sm">
                      <span>{item[section.field] || item.name || JSON.stringify(item).slice(0, 50)}</span>
                    </div>
                  ))}
                </div>
              )}
              <Button variant="outline" size="sm" className="w-full mt-3" onClick={() => { setActiveSection(idx); setNewItem(""); setError(""); }}>
                <Icon icon="solar:add-circle-bold" size={16} className="mr-1" /> Add
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={activeSection !== null} onOpenChange={() => setActiveSection(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add {activeSection !== null ? sections[activeSection].title : ""}</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Label>Value *</Label>
            <Input value={newItem} onChange={(e) => setNewItem(e.target.value)} placeholder="Enter value..."
              onKeyDown={(e) => { if (e.key === "Enter" && activeSection !== null) handleAdd(activeSection); }} autoFocus />
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setActiveSection(null)}>Cancel</Button>
            <Button onClick={() => activeSection !== null && handleAdd(activeSection)} className="bg-blue-600 hover:bg-blue-700">Add</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
