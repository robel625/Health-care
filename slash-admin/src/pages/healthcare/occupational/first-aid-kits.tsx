import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/ui/card";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { Badge } from "@/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/ui/dialog";
import { Icon } from "@/components/icon";
import { HealthcareApi } from "@/api/services/healthcareService";
import type { EEUFirstAidKit } from "@/api/services/healthcareService";
import { toast } from "sonner";

export default function EEUFirstAidKitsPage() {
  const [kits, setKits] = useState<EEUFirstAidKit[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    kit_code: "",
    kit_type: "Line Truck Emergency First-Aid Kit",
    assigned_unit: "",
    region: "Addis Ababa",
    custodian_name: "",
    last_inspected: new Date().toISOString().split("T")[0],
    status: "Fully Stocked & Sealed",
    burn_dressings_stocked: true,
    trauma_bandages_stocked: true,
    splints_tourniquet_stocked: true,
    eye_wash_stocked: true,
    notes: "",
  });

  useEffect(() => {
    loadKits();
  }, []);

  const loadKits = async () => {
    setLoading(true);
    try {
      const res = await HealthcareApi.eeuFirstAidKits.list();
      setKits(res.results || []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load first-aid kits");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.kit_code.trim()) {
      toast.error("Please enter a kit identifier code");
      return;
    }
    if (!form.assigned_unit.trim()) {
      toast.error("Please enter the vehicle plate or substation location");
      return;
    }

    setSaving(true);
    try {
      await HealthcareApi.eeuFirstAidKits.create(form);
      toast.success("Emergency First-Aid Station registered");
      setModalOpen(false);
      loadKits();
    } catch (err) {
      console.error(err);
      toast.error("Failed to save first-aid station");
    } finally {
      setSaving(false);
    }
  };

  const [restockModalOpen, setRestockModalOpen] = useState(false);
  const [targetKit, setTargetKit] = useState<EEUFirstAidKit | null>(null);
  const [selectedSupplies, setSelectedSupplies] = useState<string[]>([
    "Water-Jel Sterile Burn Dressings (10x10cm, 20x20cm)",
    "Silver Sulfadiazine Burn Cream 1%",
    "CAT Arterial Tourniquets",
  ]);
  const [restockPriority, setRestockPriority] = useState("Urgent / High-Voltage Priority");
  const [restockNotes, setRestockNotes] = useState("");
  const [restockSubmitting, setRestockSubmitting] = useState(false);

  const handleOpenRestockModal = (kit: EEUFirstAidKit) => {
    setTargetKit(kit);
    const defaults: string[] = [];
    if (!kit.burn_dressings_stocked) {
      defaults.push("Water-Jel Sterile Burn Dressings (10x10cm, 20x20cm)");
      defaults.push("Silver Sulfadiazine Burn Cream 1%");
    }
    if (!kit.trauma_bandages_stocked) {
      defaults.push("Sterile Elastic Compression Gauze");
    }
    if (!kit.splints_tourniquet_stocked) {
      defaults.push("CAT Arterial Tourniquets");
      defaults.push("Rigid Aluminum Cervical & Limb Splints");
    }
    if (!kit.eye_wash_stocked) {
      defaults.push("Emergency Eye Flush Saline (500ml Bottled)");
    }
    if (defaults.length === 0) {
      defaults.push("Water-Jel Sterile Burn Dressings (10x10cm, 20x20cm)");
    }
    setSelectedSupplies(defaults);
    setRestockNotes(`Emergency stock replenishment for ${kit.assigned_unit} (${kit.region}).`);
    setRestockModalOpen(true);
  };

  const handleRestockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetKit) return;
    setRestockSubmitting(true);
    try {
      const summaryNotes = `[${restockPriority}] Supplies: ${selectedSupplies.join(", ")}. Note: ${restockNotes}`;
      await HealthcareApi.eeuFirstAidKits.requestRestock(targetKit.id, { notes: summaryNotes });
      toast.success(`Pharmacy Restock Requisition submitted for ${targetKit.kit_code}`, {
        description: "Dispatched to EEU Central Medical Store & Pharmacy queue.",
      });
      setRestockModalOpen(false);
      loadKits();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to submit restock request");
    } finally {
      setRestockSubmitting(false);
    }
  };

  const handleMarkRestocked = async (kit: EEUFirstAidKit) => {
    try {
      await HealthcareApi.eeuFirstAidKits.markRestocked(kit.id);
      toast.success(`Kit ${kit.kit_code} marked as fully replenished & verified`);
      loadKits();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to update kit status");
    }
  };

  const filteredKits = kits.filter((k) => {
    const matchesSearch =
      (k.kit_code || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (k.assigned_unit || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (k.custodian_name || "").toLowerCase().includes(searchQuery.toLowerCase());

    const matchesType = typeFilter === "all" || k.kit_type === typeFilter;
    const matchesStatus = statusFilter === "all" || k.status === statusFilter;

    return matchesSearch && matchesType && matchesStatus;
  });

  return (
    <div className="space-y-6 p-2 md:p-4">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            EEU Substation & Line Truck Emergency First-Aid Stations
          </h1>
          <p className="text-sm text-muted-foreground">
            Fleet tracking, high-voltage substation burn response kits, and battery room eye wash inspection logistics
          </p>
        </div>
        <Button
          onClick={() => setModalOpen(true)}
          className="gap-2 bg-primary font-semibold text-primary-foreground shadow-md"
        >
          <Icon icon="solar:box-add-bold" size={18} />
          Register New First-Aid Station
        </Button>
      </div>

      {/* Filter Bar */}
      <Card className="border-border/60">
        <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Icon icon="solar:magnifer-linear" className="absolute left-3 top-3 text-muted-foreground" size={16} />
            <Input
              placeholder="Search by kit code, line truck plate, or assigned substation..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="h-10 rounded-md border border-input bg-background px-3 py-2 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="all">All Station Types</option>
              <option value="Line Truck Emergency First-Aid Kit">Line Truck Emergency Kits</option>
              <option value="High-Voltage Substation First-Aid Station">Substation First-Aid Stations</option>
              <option value="Transmission Grid Mobile Rescue Kit">Transmission Grid Rescue Kits</option>
              <option value="Regional Depot First-Aid Box">Regional Depot First-Aid Boxes</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-10 rounded-md border border-input bg-background px-3 py-2 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="all">All Readiness Statuses</option>
              <option value="Fully Stocked & Sealed">Fully Stocked & Sealed</option>
              <option value="Needs Replenishment">Needs Replenishment</option>
              <option value="Critical - Missing Burn / Trauma Kit">Critical Shortage</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Grid of First Aid Stations */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          <div className="col-span-full flex h-32 items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : filteredKits.length === 0 ? (
          <div className="col-span-full py-12 text-center text-sm text-muted-foreground">
            No emergency kits found matching your query.
          </div>
        ) : (
          filteredKits.map((kit) => (
            <Card key={kit.id} className="border-border/60 transition-all hover:border-primary/40 hover:shadow-md">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-primary">{kit.kit_code}</span>
                  <Badge
                    className={
                      kit.status === "Fully Stocked & Sealed"
                        ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                        : kit.status === "Needs Replenishment"
                        ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                        : "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                    }
                  >
                    {kit.status}
                  </Badge>
                </div>
                <CardTitle className="text-base font-bold mt-1 text-foreground">{kit.assigned_unit}</CardTitle>
                <CardDescription className="text-xs">
                  {kit.kit_type} • {kit.region}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Supplies Checklist */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-1.5">
                    <Icon
                      icon={kit.burn_dressings_stocked ? "solar:check-circle-bold" : "solar:close-circle-bold"}
                      className={kit.burn_dressings_stocked ? "text-emerald-500" : "text-rose-500"}
                      size={15}
                    />
                    <span className={kit.burn_dressings_stocked ? "text-foreground" : "text-rose-500 font-semibold"}>
                      Burn Packs
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Icon
                      icon={kit.trauma_bandages_stocked ? "solar:check-circle-bold" : "solar:close-circle-bold"}
                      className={kit.trauma_bandages_stocked ? "text-emerald-500" : "text-rose-500"}
                      size={15}
                    />
                    <span className={kit.trauma_bandages_stocked ? "text-foreground" : "text-rose-500 font-semibold"}>
                      Trauma Gauze
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Icon
                      icon={kit.splints_tourniquet_stocked ? "solar:check-circle-bold" : "solar:close-circle-bold"}
                      className={kit.splints_tourniquet_stocked ? "text-emerald-500" : "text-rose-500"}
                      size={15}
                    />
                    <span className={kit.splints_tourniquet_stocked ? "text-foreground" : "text-rose-500 font-semibold"}>
                      Tourniquet / Splint
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Icon
                      icon={kit.eye_wash_stocked ? "solar:check-circle-bold" : "solar:close-circle-bold"}
                      className={kit.eye_wash_stocked ? "text-emerald-500" : "text-rose-500"}
                      size={15}
                    />
                    <span className={kit.eye_wash_stocked ? "text-foreground" : "text-rose-500 font-semibold"}>
                      Saline Eye Wash
                    </span>
                  </div>
                </div>

                {kit.notes && (
                  <p className="rounded bg-muted/40 p-2 text-xs text-muted-foreground italic">
                    "{kit.notes}"
                  </p>
                )}

                <div className="border-t border-border/40 pt-2 text-[11px] text-muted-foreground flex items-center justify-between">
                  <span>Custodian: <strong className="text-foreground">{kit.custodian_name || "Unassigned"}</strong></span>
                  <span>Inspected: {kit.last_inspected}</span>
                </div>

                {kit.restock_requisition_status && kit.restock_requisition_status !== "None" && (
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded p-1.5">
                    <Icon icon="solar:box-minimalistic-bold-duotone" size={14} />
                    <span>{kit.restock_requisition_status}</span>
                  </div>
                )}

                <div className="flex flex-col gap-1.5 pt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleOpenRestockModal(kit)}
                    className="w-full gap-1.5 text-xs border-amber-500/40 text-amber-600 hover:bg-amber-500/10"
                  >
                    <Icon icon="solar:cart-large-minimalistic-bold" size={14} />
                    Request Pharmacy Restock
                  </Button>

                  {kit.status !== "Fully Stocked & Sealed" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleMarkRestocked(kit)}
                      className="w-full gap-1.5 text-xs border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10"
                    >
                      <Icon icon="solar:check-read-bold" size={14} />
                      Log Full Replenishment & Seal
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Modal: Pharmacy Restock Requisition */}
      {restockModalOpen && targetKit && (
        <Dialog open={restockModalOpen} onOpenChange={setRestockModalOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base font-bold text-amber-600 dark:text-amber-400">
                <Icon icon="solar:cart-large-minimalistic-bold" size={20} />
                <span>Central Pharmacy Restock Requisition</span>
              </DialogTitle>
              <DialogDescription>
                Dispatch medical supplies from EEU Central Medical Store to{" "}
                <strong>{targetKit.assigned_unit}</strong> ({targetKit.kit_code}).
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleRestockSubmit} className="space-y-3.5 text-xs">
              <div className="space-y-1.5">
                <Label>Required Emergency Medical Supplies</Label>
                <div className="grid grid-cols-1 gap-1.5 rounded-lg border border-border/60 bg-muted/30 p-2.5">
                  {[
                    "Water-Jel Sterile Burn Dressings (10x10cm, 20x20cm)",
                    "Silver Sulfadiazine Burn Cream 1%",
                    "CAT Arterial Tourniquets",
                    "Emergency Eye Flush Saline (500ml Bottled)",
                    "Sterile Elastic Compression Gauze",
                    "Rigid Aluminum Cervical & Limb Splints",
                    "High-Dielectric Safety Shears",
                  ].map((supply) => (
                    <label key={supply} className="flex items-center gap-2 cursor-pointer text-xs">
                      <input
                        type="checkbox"
                        checked={selectedSupplies.includes(supply)}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedSupplies([...selectedSupplies, supply]);
                          else setSelectedSupplies(selectedSupplies.filter((s) => s !== supply));
                        }}
                        className="rounded border-input text-amber-600 focus:ring-amber-500 h-3.5 w-3.5"
                      />
                      <span>{supply}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="restock_prio">Requisition Priority</Label>
                  <select
                    id="restock_prio"
                    value={restockPriority}
                    onChange={(e) => setRestockPriority(e.target.value)}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="Urgent / High-Voltage Priority">Urgent / High-Voltage Priority</option>
                    <option value="Routine Monthly Replenishment">Routine Monthly Replenishment</option>
                    <option value="Emergency Restock after Workplace Incident">
                      Emergency Restock after Workplace Incident
                    </option>
                  </select>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="restock_dispatch">Issuing Store</Label>
                  <Input id="restock_dispatch" value="EEU Central Medical Store (Kality)" disabled className="h-9" />
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="restock_notes">Requisition Notes & Dispatch Instructions</Label>
                <textarea
                  id="restock_notes"
                  rows={3}
                  value={restockNotes}
                  onChange={(e) => setRestockNotes(e.target.value)}
                  className="w-full rounded-md border border-input bg-background p-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="Delivery truck route, custodian contact, or substation gate instructions..."
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-border/50">
                <Button type="button" variant="outline" size="sm" onClick={() => setRestockModalOpen(false)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={restockSubmitting || selectedSupplies.length === 0}
                  className="bg-amber-600 text-slate-950 font-bold hover:bg-amber-500"
                >
                  {restockSubmitting ? "Submitting..." : "Send Requisition Order"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Modal: Register Station */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <Icon icon="solar:box-add-bold" size={20} />
              Register Emergency First-Aid Station
            </DialogTitle>
            <DialogDescription>
              Assign a certified high-voltage or line vehicle first aid kit to an EEU operational unit.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="kit_code">Kit Code / Serial *</Label>
                <Input
                  id="kit_code"
                  placeholder="e.g. EEU-KIT-TRK-09"
                  value={form.kit_code}
                  onChange={(e) => setForm({ ...form, kit_code: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="kit_type">Station Type</Label>
                <select
                  id="kit_type"
                  value={form.kit_type}
                  onChange={(e) => setForm({ ...form, kit_type: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="Line Truck Emergency First-Aid Kit">Line Truck Emergency Kit</option>
                  <option value="High-Voltage Substation First-Aid Station">Substation First-Aid Station</option>
                  <option value="Transmission Grid Mobile Rescue Kit">Transmission Grid Rescue Kit</option>
                  <option value="Regional Depot First-Aid Box">Regional Depot First-Aid Box</option>
                </select>
              </div>

              <div className="space-y-1.5 col-span-2">
                <Label htmlFor="assigned_unit">Assigned Vehicle or Substation Location *</Label>
                <Input
                  id="assigned_unit"
                  placeholder="e.g. Line Patrol Truck ET-03-49281 or Kality 230kV Control Room"
                  value={form.assigned_unit}
                  onChange={(e) => setForm({ ...form, assigned_unit: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="region">Region</Label>
                <select
                  id="region"
                  value={form.region}
                  onChange={(e) => setForm({ ...form, region: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="Addis Ababa">Addis Ababa</option>
                  <option value="Oromia">Oromia</option>
                  <option value="Amhara">Amhara</option>
                  <option value="Sidama">Sidama</option>
                  <option value="Somali">Somali</option>
                  <option value="Tigray">Tigray</option>
                  <option value="Dire Dawa">Dire Dawa</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="custodian_name">Custodian / Lead Officer</Label>
                <Input
                  id="custodian_name"
                  placeholder="e.g. Ato Moges Assefa"
                  value={form.custodian_name}
                  onChange={(e) => setForm({ ...form, custodian_name: e.target.value })}
                />
              </div>

              <div className="space-y-1.5 col-span-2">
                <Label htmlFor="notes">Kit Notes</Label>
                <textarea
                  id="notes"
                  rows={2}
                  placeholder="Special contents, burn gel packs, expiration notes..."
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full rounded-md border border-input bg-background p-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-border/50 pt-4">
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Registering..." : "Register Station"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
