import { useState, useEffect, useCallback, useMemo } from "react";
import { Icon } from "@/components/icon";
import { Button } from "@/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { Badge } from "@/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/ui/dialog";
import Table, { type ColumnsType } from "antd/es/table";
import { toast } from "sonner";
import PharmacyNavHeader from "./components/PharmacyNavHeader";
import EditMedicationModal from "./components/EditMedicationModal";
import { HealthcareApi } from "@/api/services/healthcareService";
import type { DosageForm, MedicationClass } from "@/api/services/healthcareService";

export default function PharmacyMedicationsPage() {
  const [activeTab, setActiveTab] = useState<"catalog" | "interactions" | "checker">("catalog");

  // Catalog State
  const [medications, setMedications] = useState<any[]>([]);
  const [dosageForms, setDosageForms] = useState<DosageForm[]>([]);
  const [medClasses, setMedClasses] = useState<MedicationClass[]>([]);
  const [loadingMeds, setLoadingMeds] = useState(false);
  const [totalMeds, setTotalMeds] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [selectedClass, setSelectedClass] = useState<string>("All");

  // Edit Medication State
  const [editingMedication, setEditingMedication] = useState<any | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);

  // Interaction State
  const [interactions, setInteractions] = useState<any[]>([]);
  const [loadingInteractions, setLoadingInteractions] = useState(false);
  const [interactionSearch, setInteractionSearch] = useState("");

  // Interaction Dialog State
  const [showInteractionModal, setShowInteractionModal] = useState(false);
  const [editingInteraction, setEditingInteraction] = useState<any | null>(null);
  const [savingInteraction, setSavingInteraction] = useState(false);
  const [interactionForm, setInteractionForm] = useState({
    drug1: "" as any,
    drug2: "" as any,
    severity: "Moderate",
    description: "",
    recommendation: "",
  });

  // Quick Checker State
  const [checkDrug1, setCheckDrug1] = useState<string>("");
  const [checkDrug2, setCheckDrug2] = useState<string>("");
  const [checkResult, setCheckResult] = useState<{
    found: boolean;
    interaction?: any;
    message?: string;
  } | null>(null);

  // New Medication Dialog State
  const [showMedModal, setShowMedModal] = useState(false);
  const [savingMed, setSavingMed] = useState(false);
  const [medForm, setMedForm] = useState({
    generic_name: "",
    strength: "",
    strength_uom: "mg",
    dosage_form: null as number | null,
    medication_class: null as number | null,
    national_drug_code: "",
    standard_rate: 1.0,
    reorder_level: 25,
    default_prescription_dosage: "",
    default_prescription_duration: "",
    is_combination: false,
    disabled: false,
  });

  // Load Medications
  const loadMedications = useCallback(async () => {
    setLoadingMeds(true);
    try {
      const params: Record<string, any> = { page, page_size: 20 };
      if (search.trim()) params.search = search.trim();
      if (selectedClass !== "All") params.medication_class = selectedClass;

      const [res, dfRes, mcRes] = await Promise.all([
        HealthcareApi.medications.list(params) as any,
        HealthcareApi.dosageForms.list({ page_size: 100 }),
        HealthcareApi.medicationClasses.list({ page_size: 100 }),
      ]);
      setMedications(res.results || []);
      setTotalMeds(res.count || 0);
      setDosageForms(dfRes.results || []);
      setMedClasses(mcRes.results || []);
    } catch (err) {
      console.error("Failed to load medications:", err);
      toast.error("Failed to load medication formulary.");
    } finally {
      setLoadingMeds(false);
    }
  }, [page, search, selectedClass]);

  // Load Interactions
  const loadInteractions = useCallback(async () => {
    setLoadingInteractions(true);
    try {
      const res: any = await HealthcareApi.drugInteractions.list({ page_size: 100 });
      setInteractions(res.results || res || []);
    } catch (err) {
      console.error("Failed to load drug interactions:", err);
    } finally {
      setLoadingInteractions(false);
    }
  }, []);

  useEffect(() => {
    loadMedications();
  }, [loadMedications]);

  useEffect(() => {
    if (activeTab === "interactions" || activeTab === "checker") {
      loadInteractions();
    }
  }, [activeTab, loadInteractions]);

  // Open Edit Medication Modal
  const handleEditMedication = (record: any) => {
    setEditingMedication(record);
    setShowEditModal(true);
  };

  // Save new medication
  const handleSaveMedication = async () => {
    if (!medForm.generic_name.trim()) {
      toast.error("Generic medication name is required.");
      return;
    }
    setSavingMed(true);
    try {
      await HealthcareApi.medications.create(medForm);
      toast.success("Medication added to formulary successfully.");
      setShowMedModal(false);
      setMedForm({
        generic_name: "",
        strength: "",
        strength_uom: "mg",
        dosage_form: null,
        medication_class: null,
        national_drug_code: "",
        standard_rate: 1.0,
        reorder_level: 25,
        default_prescription_dosage: "",
        default_prescription_duration: "",
        is_combination: false,
        disabled: false,
      });
      loadMedications();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.response?.data?.error || "Failed to create medication");
    } finally {
      setSavingMed(false);
    }
  };

  // Open Add/Edit Interaction Rule Modal
  const handleOpenInteractionModal = (rule?: any) => {
    if (rule) {
      setEditingInteraction(rule);
      setInteractionForm({
        drug1: rule.drug1,
        drug2: rule.drug2,
        severity: rule.severity || "Moderate",
        description: rule.description || "",
        recommendation: rule.recommendation || "",
      });
    } else {
      setEditingInteraction(null);
      setInteractionForm({
        drug1: medications.length > 0 ? medications[0].id : "",
        drug2: medications.length > 1 ? medications[1].id : "",
        severity: "Moderate",
        description: "",
        recommendation: "",
      });
    }
    setShowInteractionModal(true);
  };

  // Save Interaction Rule
  const handleSaveInteraction = async () => {
    if (!interactionForm.drug1 || !interactionForm.drug2) {
      toast.error("Both interacting medications must be selected.");
      return;
    }
    if (interactionForm.drug1 === interactionForm.drug2) {
      toast.error("Please select two distinct medications.");
      return;
    }

    setSavingInteraction(true);
    try {
      if (editingInteraction) {
        await HealthcareApi.drugInteractions.update(editingInteraction.id, interactionForm);
        toast.success("Drug interaction rule updated.");
      } else {
        await HealthcareApi.drugInteractions.create(interactionForm);
        toast.success("Drug interaction warning rule created.");
      }
      setShowInteractionModal(false);
      loadInteractions();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.response?.data?.error || "Failed to save drug interaction rule.");
    } finally {
      setSavingInteraction(false);
    }
  };

  // Delete Interaction Rule
  const handleDeleteInteraction = async (id: number) => {
    if (!confirm("Are you sure you want to remove this drug interaction rule?")) return;
    try {
      await HealthcareApi.drugInteractions.delete(id);
      toast.success("Interaction rule removed.");
      loadInteractions();
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to delete interaction rule.");
    }
  };

  // Run Quick Interaction Check
  const handleRunCheck = () => {
    if (!checkDrug1.trim() || !checkDrug2.trim()) {
      toast.warning("Please specify both medications to verify safety.");
      return;
    }
    const match = interactions.find((rule) => {
      const d1 = (rule.drug1_name || rule.drug1 || "").toString().toLowerCase();
      const d2 = (rule.drug2_name || rule.drug2 || "").toString().toLowerCase();
      const q1 = checkDrug1.toLowerCase().trim();
      const q2 = checkDrug2.toLowerCase().trim();
      return (d1.includes(q1) && d2.includes(q2)) || (d1.includes(q2) && d2.includes(q1));
    });

    if (match) {
      setCheckResult({
        found: true,
        interaction: match,
      });
      toast.error(`Warning: ${match.severity} interaction detected!`);
    } else {
      setCheckResult({
        found: false,
        message: `No adverse interactions currently recorded between "${checkDrug1}" and "${checkDrug2}".`,
      });
      toast.success("No adverse drug-drug interactions detected.");
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.info(`Copied ${label}: ${text}`);
  };

  // Formulary columns
  const medColumns: ColumnsType<any> = [
    {
      title: "Medication & Generic Name",
      dataIndex: "generic_name",
      render: (v: string, r) => (
        <div className="space-y-0.5">
          <span className="font-bold text-xs text-foreground block">{v}</span>
          {r.national_drug_code && (
            <div className="flex items-center gap-1 group">
              <span className="font-mono text-[10px] text-muted-foreground">NDC: {r.national_drug_code}</span>
              <button
                type="button"
                onClick={() => copyToClipboard(r.national_drug_code, "NDC")}
                className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                title="Copy NDC"
              >
                <Icon icon="solar:copy-bold" size={11} />
              </button>
            </div>
          )}
        </div>
      ),
    },
    {
      title: "Strength",
      width: 120,
      render: (_, r) =>
        r.strength ? (
          <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-md bg-muted/60 text-foreground border border-border/50">
            {r.strength} {r.strength_uom || "mg"}
          </span>
        ) : (
          <span className="text-muted-foreground text-xs">-</span>
        ),
    },
    {
      title: "Dosage Form",
      dataIndex: "dosage_form_name",
      width: 130,
      render: (v: string, r) => {
        const name = v || r.dosage_form?.dosage_form || "Tablet";
        return (
          <Badge variant="outline" className="bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/20 text-[10px] font-semibold">
            {name}
          </Badge>
        );
      },
    },
    {
      title: "Class / Category",
      dataIndex: "medication_class_name",
      width: 180,
      render: (v: string, r) => {
        const name = v || r.medication_class?.medication_class || "General";
        return (
          <span className="text-xs font-medium text-foreground bg-muted/40 px-2 py-0.5 rounded-md border border-border/40">
            {name}
          </span>
        );
      },
    },
    {
      title: "Standard Rate",
      dataIndex: "standard_rate",
      width: 110,
      align: "right",
      render: (v: number) => (
        <span className="font-mono font-bold text-xs text-foreground">
          ${Number(v || 0).toFixed(2)}
        </span>
      ),
    },
    {
      title: "Reorder",
      dataIndex: "reorder_level",
      width: 90,
      align: "right",
      render: (v: number) => (
        <span className="font-mono text-xs text-muted-foreground">{v || 25}</span>
      ),
    },
    {
      title: "Status",
      dataIndex: "disabled",
      width: 110,
      render: (v: boolean) =>
        v ? (
          <Badge className="bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20 text-[10px] font-bold">
            Disabled
          </Badge>
        ) : (
          <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20 text-[10px] font-semibold">
            Active
          </Badge>
        ),
    },
    {
      title: "Actions",
      width: 100,
      align: "center",
      render: (_, r) => (
        <Button
          variant="outline"
          size="sm"
          className="h-7 px-2.5 text-xs gap-1 border-emerald-500/30 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-lg"
          onClick={() => handleEditMedication(r)}
        >
          <Icon icon="solar:pen-bold" size={13} />
          Edit
        </Button>
      ),
    },
  ];

  // Interaction columns
  const interactionColumns: ColumnsType<any> = [
    {
      title: "Primary Drug",
      dataIndex: "drug1_name",
      width: 180,
      render: (v: string, r) => (
        <span className="font-bold text-xs text-foreground">{v || r.drug1}</span>
      ),
    },
    {
      title: "Interacting Drug",
      dataIndex: "drug2_name",
      width: 180,
      render: (v: string, r) => (
        <span className="font-bold text-xs text-foreground">{v || r.drug2}</span>
      ),
    },
    {
      title: "Severity Level",
      dataIndex: "severity",
      width: 140,
      render: (v: string) => {
        const isContra = v === "Contraindicated";
        const isSevere = v === "Severe";
        const isMod = v === "Moderate";
        return (
          <Badge
            className={`text-[10px] font-bold uppercase tracking-wider gap-1 ${
              isContra || isSevere
                ? "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30"
                : isMod
                ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30"
                : "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30"
            }`}
          >
            <Icon
              icon={isContra || isSevere ? "solar:shield-warning-bold" : "solar:danger-triangle-bold"}
              size={12}
            />
            {v}
          </Badge>
        );
      },
    },
    {
      title: "Mechanism & Clinical Action",
      dataIndex: "description",
      render: (v: string, r) => (
        <div className="space-y-1">
          <p className="text-xs text-foreground font-medium">{v || "-"}</p>
          {r.recommendation && (
            <p className="text-[11px] text-amber-700 dark:text-amber-400 bg-amber-500/10 p-1.5 rounded border border-amber-500/20 font-medium">
              <span className="font-bold">Recommendation: </span>
              {r.recommendation}
            </p>
          )}
        </div>
      ),
    },
    {
      title: "Actions",
      width: 100,
      align: "center",
      render: (_, r) => (
        <div className="flex items-center justify-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
            onClick={() => handleOpenInteractionModal(r)}
            title="Edit Rule"
          >
            <Icon icon="solar:pen-bold" size={14} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
            onClick={() => handleDeleteInteraction(r.id)}
            title="Delete Rule"
          >
            <Icon icon="solar:trash-bin-trash-bold" size={14} />
          </Button>
        </div>
      ),
    },
  ];

  const filteredInteractions = useMemo(() => {
    if (!interactionSearch.trim()) return interactions;
    const q = interactionSearch.toLowerCase();
    return interactions.filter((it) => {
      const d1 = (it.drug1_name || it.drug1 || "").toLowerCase();
      const d2 = (it.drug2_name || it.drug2 || "").toLowerCase();
      const desc = (it.description || "").toLowerCase();
      return d1.includes(q) || d2.includes(q) || desc.includes(q);
    });
  }, [interactions, interactionSearch]);

  return (
    <div className="space-y-6">
      <PharmacyNavHeader
        title="Medication Formulary & Drug Safety"
        subtitle="Hospital approved drug masters, dosage formulations, therapeutic classifications, and clinical drug-drug interaction warning engine."
        badge="Formulary & Safety"
        action={
          <Button
            size="sm"
            className="gap-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-xs"
            onClick={() => setShowMedModal(true)}
          >
            <Icon icon="solar:add-circle-bold" size={16} />
            <span>Add Medication</span>
          </Button>
        }
      />

      {/* Formulary KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-border/70 bg-card shadow-2xs space-y-1">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Approved Medications
          </p>
          <p className="text-2xl font-extrabold text-foreground">{totalMeds}</p>
          <p className="text-[11px] text-muted-foreground flex items-center gap-1">
            <Icon icon="solar:pills-bold" size={12} className="text-emerald-500" />
            Active formulary catalog
          </p>
        </div>

        <div className="p-4 rounded-xl border border-border/70 bg-card shadow-2xs space-y-1">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Dosage Formulations
          </p>
          <p className="text-2xl font-extrabold text-blue-600 dark:text-blue-400">{dosageForms.length}</p>
          <p className="text-[11px] text-muted-foreground flex items-center gap-1">
            <Icon icon="solar:box-minimalistic-bold" size={12} className="text-blue-500" />
            Tablets, vials, syrups, ampoules
          </p>
        </div>

        <div className="p-4 rounded-xl border border-border/70 bg-card shadow-2xs space-y-1">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Therapeutic Classes
          </p>
          <p className="text-2xl font-extrabold text-purple-600 dark:text-purple-400">{medClasses.length}</p>
          <p className="text-[11px] text-muted-foreground flex items-center gap-1">
            <Icon icon="solar:clipboard-bold" size={12} className="text-purple-500" />
            Classifications & ATC groups
          </p>
        </div>

        <div className="p-4 rounded-xl border border-border/70 bg-card shadow-2xs space-y-1">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Safety Interaction Rules
          </p>
          <p className="text-2xl font-extrabold text-amber-600 dark:text-amber-400">{interactions.length}</p>
          <p className="text-[11px] text-muted-foreground flex items-center gap-1">
            <Icon icon="solar:shield-check-bold" size={12} className="text-amber-500" />
            Active clinical safety rules
          </p>
        </div>
      </div>

      {/* Main Container Card */}
      <Card className="border-border/70 shadow-xs">
        <CardContent className="pt-6 space-y-4">
          {/* Sub Navigation Tabs */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/60">
            <div className="flex items-center gap-1 bg-muted/70 p-1 rounded-xl border border-border/50">
              <button
                type="button"
                onClick={() => setActiveTab("catalog")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === "catalog"
                    ? "bg-background text-foreground shadow-xs font-bold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon icon="solar:pills-bold-duotone" size={15} />
                Hospital Formulary ({totalMeds})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("interactions")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === "interactions"
                    ? "bg-background text-amber-600 dark:text-amber-400 shadow-xs font-bold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon icon="solar:shield-warning-bold-duotone" size={15} />
                Safety Interactions ({interactions.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("checker")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === "checker"
                    ? "bg-background text-emerald-600 dark:text-emerald-400 shadow-xs font-bold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon icon="solar:stethoscope-bold-duotone" size={15} />
                Clinical Interaction Checker
              </button>
            </div>

            {activeTab === "interactions" && (
              <Button
                size="sm"
                onClick={() => handleOpenInteractionModal()}
                className="h-8 text-xs gap-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg shadow-xs"
              >
                <Icon icon="solar:add-circle-bold" size={14} />
                Add Interaction Rule
              </Button>
            )}
          </div>

          {/* Tab 1: Formulary Catalog */}
          {activeTab === "catalog" && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3 justify-between items-center">
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <div className="relative w-full sm:w-72">
                    <Input
                      placeholder="Search medication name or NDC..."
                      value={search}
                      onChange={(e) => {
                        setSearch(e.target.value);
                        setPage(1);
                      }}
                      className="h-9 text-xs pr-8 rounded-lg"
                    />
                    {search ? (
                      <button
                        type="button"
                        onClick={() => setSearch("")}
                        className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                      >
                        <Icon icon="solar:close-circle-bold" size={15} />
                      </button>
                    ) : (
                      <Icon
                        icon="solar:magnifer-linear"
                        size={15}
                        className="absolute right-2.5 top-2.5 text-muted-foreground pointer-events-none"
                      />
                    )}
                  </div>

                  <select
                    className="rounded-lg border border-input bg-background px-3 py-2 text-xs ring-offset-background focus:outline-none focus:ring-2 focus:ring-emerald-500/20 shadow-xs h-9"
                    value={selectedClass}
                    onChange={(e) => {
                      setSelectedClass(e.target.value);
                      setPage(1);
                    }}
                  >
                    <option value="All">All Therapeutic Classes</option>
                    {medClasses.map((mc) => (
                      <option key={mc.id} value={mc.id}>
                        {mc.medication_class}
                      </option>
                    ))}
                  </select>
                </div>

                <span className="text-xs text-muted-foreground self-start sm:self-center font-medium">
                  Showing {medications.length} of {totalMeds} formulary medications
                </span>
              </div>

              <Table
                columns={medColumns}
                dataSource={medications}
                rowKey="id"
                loading={loadingMeds}
                pagination={{
                  current: page,
                  total: totalMeds,
                  pageSize: 20,
                  onChange: setPage,
                  showTotal: (total) => `${total} medications in formulary`,
                }}
                size="middle"
                className="[&_.ant-table-thead>tr>th]:bg-transparent"
              />
            </div>
          )}

          {/* Tab 2: Drug Interaction Rules */}
          {activeTab === "interactions" && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3 justify-between items-center">
                <div className="relative w-full sm:w-80">
                  <Input
                    placeholder="Search interacting drugs or mechanisms..."
                    value={interactionSearch}
                    onChange={(e) => setInteractionSearch(e.target.value)}
                    className="h-9 text-xs pr-8 rounded-lg"
                  />
                  {interactionSearch ? (
                    <button
                      type="button"
                      onClick={() => setInteractionSearch("")}
                      className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                    >
                      <Icon icon="solar:close-circle-bold" size={15} />
                    </button>
                  ) : (
                    <Icon
                      icon="solar:magnifer-linear"
                      size={15}
                      className="absolute right-2.5 top-2.5 text-muted-foreground pointer-events-none"
                    />
                  )}
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground mr-1">Severity Levels:</span>
                  <Badge className="bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30 text-[10px]">
                    Contraindicated
                  </Badge>
                  <Badge className="bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20 text-[10px]">
                    Severe
                  </Badge>
                  <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 text-[10px]">
                    Moderate
                  </Badge>
                  <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30 text-[10px]">
                    Mild
                  </Badge>
                </div>
              </div>

              <Table
                columns={interactionColumns}
                dataSource={filteredInteractions}
                rowKey="id"
                loading={loadingInteractions}
                pagination={{ pageSize: 15 }}
                size="middle"
                className="[&_.ant-table-thead>tr>th]:bg-transparent"
              />
            </div>
          )}

          {/* Tab 3: Interactive Clinical Interaction Checker */}
          {activeTab === "checker" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              {/* Input Card */}
              <Card className="border-border/70 shadow-xs">
                <CardHeader className="pb-3 border-b border-border/60">
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <Icon icon="solar:shield-warning-bold" size={20} className="text-amber-500" />
                    Verify Drug Pair for Adverse Interactions
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Cross-references active hospital formulary rules to check for pharmacodynamic & pharmacokinetic contraindications
                  </p>
                </CardHeader>
                <CardContent className="space-y-4 pt-4">
                  <div>
                    <Label className="text-xs font-semibold text-foreground">First Medication *</Label>
                    <Input
                      placeholder="e.g. Warfarin, Ciprofloxacin, Tramadol, Digoxin..."
                      value={checkDrug1}
                      onChange={(e) => setCheckDrug1(e.target.value)}
                      className="mt-1.5 text-xs rounded-lg"
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-semibold text-foreground">Second Medication *</Label>
                    <Input
                      placeholder="e.g. Ibuprofen, Ondansetron, Aspirin, Clopidogrel..."
                      value={checkDrug2}
                      onChange={(e) => setCheckDrug2(e.target.value)}
                      className="mt-1.5 text-xs rounded-lg"
                    />
                  </div>

                  {/* Quick Preset Pairs */}
                  <div>
                    <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block mb-1.5">
                      Common Clinical Test Pairs:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        ["Warfarin", "Ibuprofen"],
                        ["Ciprofloxacin", "Theophylline"],
                        ["Tramadol", "Ondansetron"],
                        ["Aspirin", "Clopidogrel"],
                      ].map(([d1, d2], idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            setCheckDrug1(d1);
                            setCheckDrug2(d2);
                          }}
                          className="px-2.5 py-1 rounded-md bg-muted/60 hover:bg-muted text-[11px] font-medium text-foreground transition-colors border border-border/40"
                        >
                          {d1} + {d2}
                        </button>
                      ))}
                    </div>
                  </div>

                  <Button
                    onClick={handleRunCheck}
                    className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white gap-2 h-11 rounded-xl font-bold shadow-xs mt-2"
                  >
                    <Icon icon="solar:magnifer-bold" size={16} />
                    Run Safety Verification
                  </Button>
                </CardContent>
              </Card>

              {/* Assessment Result Card */}
              <Card
                className={`border shadow-xs ${
                  checkResult?.found
                    ? "border-rose-500/50 bg-rose-50/20 dark:bg-rose-950/20"
                    : checkResult
                    ? "border-emerald-500/50 bg-emerald-50/20 dark:bg-emerald-950/20"
                    : "border-border/70"
                }`}
              >
                <CardHeader className="pb-3 border-b border-border/60">
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <Icon
                      icon={
                        checkResult?.found
                          ? "solar:danger-triangle-bold"
                          : checkResult
                          ? "solar:check-circle-bold"
                          : "solar:stethoscope-bold"
                      }
                      size={20}
                      className={
                        checkResult?.found
                          ? "text-rose-600"
                          : checkResult
                          ? "text-emerald-600"
                          : "text-muted-foreground"
                      }
                    />
                    Clinical Safety Verification Assessment
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  {!checkResult && (
                    <div className="text-center py-12 text-muted-foreground text-xs space-y-2">
                      <div className="w-12 h-12 rounded-2xl bg-muted/60 text-muted-foreground/60 flex items-center justify-center mx-auto mb-2">
                        <Icon icon="solar:shield-check-bold-duotone" size={28} />
                      </div>
                      <p className="font-semibold text-foreground text-sm">Interaction Engine Ready</p>
                      <p className="max-w-xs mx-auto text-muted-foreground">
                        Select two medications on the left and run verification to analyze clinical safety and contraindications.
                      </p>
                    </div>
                  )}

                  {checkResult && checkResult.found && (
                    <div className="space-y-4">
                      <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-800 dark:text-rose-200">
                        <div className="flex items-center gap-2">
                          <Icon icon="solar:danger-triangle-bold" size={20} className="text-rose-600 shrink-0" />
                          <div>
                            <p className="font-bold text-xs uppercase tracking-wider">
                              {checkResult.interaction.severity} INTERACTION DETECTED
                            </p>
                            <p className="text-sm font-extrabold text-foreground mt-0.5">
                              {checkResult.interaction.drug1_name || checkResult.interaction.drug1} +{" "}
                              {checkResult.interaction.drug2_name || checkResult.interaction.drug2}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="p-4 rounded-xl bg-card border border-border/80 space-y-2.5 shadow-2xs">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-0.5">
                            Pharmacological Mechanism
                          </span>
                          <p className="text-xs text-foreground leading-relaxed">
                            {checkResult.interaction.description}
                          </p>
                        </div>

                        {checkResult.interaction.recommendation && (
                          <div className="pt-2 border-t border-border/60">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 block mb-0.5">
                              Management Strategy & Alternatives
                            </span>
                            <p className="text-xs text-amber-800 dark:text-amber-200 font-medium bg-amber-500/10 p-2.5 rounded-lg border border-amber-500/20">
                              {checkResult.interaction.recommendation}
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="p-3 rounded-lg bg-muted/40 border border-border/50 text-[11px] text-muted-foreground flex items-center gap-2">
                        <Icon icon="solar:info-circle-bold" size={15} className="text-blue-500 shrink-0" />
                        Clinical protocol: Co-prescribing requires attending physician sign-off or alternative drug selection.
                      </div>
                    </div>
                  )}

                  {checkResult && !checkResult.found && (
                    <div className="space-y-3 text-center py-8">
                      <div className="inline-flex p-3 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mb-1">
                        <Icon icon="solar:check-circle-bold" size={36} />
                      </div>
                      <h4 className="font-bold text-foreground text-base">No Adverse Interactions Found</h4>
                      <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
                        {checkResult.message}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </CardContent>
      </Card>

      {/* New Medication Dialog */}
      <Dialog open={showMedModal} onOpenChange={setShowMedModal}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <div className="flex items-center gap-2 text-emerald-600">
              <Icon icon="solar:pill-bold-duotone" size={24} />
              <DialogTitle className="text-lg font-bold">Add Medication to Formulary</DialogTitle>
            </div>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4 py-2 text-sm">
            <div className="col-span-2">
              <Label className="text-xs font-semibold text-foreground">Generic / Medication Name *</Label>
              <Input
                placeholder="e.g. Ciprofloxacin HCl"
                value={medForm.generic_name}
                onChange={(e) => setMedForm({ ...medForm, generic_name: e.target.value })}
                className="mt-1"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold text-foreground">Strength</Label>
              <Input
                placeholder="e.g. 500"
                value={medForm.strength}
                onChange={(e) => setMedForm({ ...medForm, strength: e.target.value })}
                className="mt-1"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold text-foreground">Strength UOM</Label>
              <Input
                placeholder="mg, mcg, IU, g"
                value={medForm.strength_uom}
                onChange={(e) => setMedForm({ ...medForm, strength_uom: e.target.value })}
                className="mt-1"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold text-foreground">Dosage Form</Label>
              <select
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                value={medForm.dosage_form || ""}
                onChange={(e) => setMedForm({ ...medForm, dosage_form: Number(e.target.value) || null })}
              >
                <option value="">Select Dosage Form...</option>
                {dosageForms.map((df) => (
                  <option key={df.id} value={df.id}>
                    {df.dosage_form}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label className="text-xs font-semibold text-foreground">Therapeutic Drug Class</Label>
              <select
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                value={medForm.medication_class || ""}
                onChange={(e) => setMedForm({ ...medForm, medication_class: Number(e.target.value) || null })}
              >
                <option value="">Select Drug Class...</option>
                {medClasses.map((mc) => (
                  <option key={mc.id} value={mc.id}>
                    {mc.medication_class}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label className="text-xs font-semibold text-foreground">Standard Rate / Price ($)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={medForm.standard_rate}
                onChange={(e) => setMedForm({ ...medForm, standard_rate: Number(e.target.value) })}
                className="mt-1 font-mono"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold text-foreground">Reorder Threshold</Label>
              <Input
                type="number"
                min="0"
                value={medForm.reorder_level}
                onChange={(e) => setMedForm({ ...medForm, reorder_level: Number(e.target.value) })}
                className="mt-1 font-mono"
              />
            </div>

            <div className="col-span-2">
              <Label className="text-xs font-semibold text-foreground">National Drug Code (NDC)</Label>
              <Input
                placeholder="e.g. 00000-0000-00"
                value={medForm.national_drug_code}
                onChange={(e) => setMedForm({ ...medForm, national_drug_code: e.target.value })}
                className="mt-1 font-mono"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMedModal(false)} disabled={savingMed}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveMedication}
              disabled={savingMed}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {savingMed ? "Saving..." : "Save Medication"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Operation 3: Edit Medication Modal */}
      <EditMedicationModal
        open={showEditModal}
        onOpenChange={setShowEditModal}
        medication={editingMedication}
        dosageForms={dosageForms}
        medClasses={medClasses}
        onSuccess={loadMedications}
      />

      {/* Add / Edit Drug Interaction Rule Modal */}
      <Dialog open={showInteractionModal} onOpenChange={setShowInteractionModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-2 text-primary">
              <Icon icon="solar:shield-warning-bold-duotone" size={24} />
              <DialogTitle className="text-lg font-bold">
                {editingInteraction ? "Edit Drug Interaction Rule" : "Add Drug Interaction Warning"}
              </DialogTitle>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-2 text-sm">
            <div>
              <Label className="text-xs font-semibold mb-1 block text-foreground">Primary Drug (Drug 1) *</Label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs"
                value={interactionForm.drug1}
                onChange={(e) => setInteractionForm({ ...interactionForm, drug1: Number(e.target.value) })}
              >
                <option value="">Select Drug 1...</option>
                {medications.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.generic_name} {m.strength ? `(${m.strength}${m.strength_uom})` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label className="text-xs font-semibold mb-1 block text-foreground">Interacting Drug (Drug 2) *</Label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs"
                value={interactionForm.drug2}
                onChange={(e) => setInteractionForm({ ...interactionForm, drug2: Number(e.target.value) })}
              >
                <option value="">Select Drug 2...</option>
                {medications.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.generic_name} {m.strength ? `(${m.strength}${m.strength_uom})` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label className="text-xs font-semibold mb-1 block text-foreground">Severity Level</Label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs"
                value={interactionForm.severity}
                onChange={(e) => setInteractionForm({ ...interactionForm, severity: e.target.value })}
              >
                <option value="Mild">Mild (Minor clinical significance)</option>
                <option value="Moderate">Moderate (Monitor patient closely)</option>
                <option value="Severe">Severe (Avoid combination where possible)</option>
                <option value="Contraindicated">Contraindicated (Absolute co-prescribing prohibition)</option>
              </select>
            </div>

            <div>
              <Label className="text-xs font-semibold mb-1 block text-foreground">Interaction Mechanism / Effect</Label>
              <textarea
                rows={3}
                className="w-full rounded-md border border-input bg-background p-2.5 text-xs"
                placeholder="e.g. Concomitant use increases risk of gastrointestinal bleeding and ulceration."
                value={interactionForm.description}
                onChange={(e) => setInteractionForm({ ...interactionForm, description: e.target.value })}
              />
            </div>

            <div>
              <Label className="text-xs font-semibold mb-1 block text-foreground">Clinical Recommendation</Label>
              <Input
                placeholder="e.g. Co-prescribe PPI (Omeprazole) or use Paracetamol as safer alternative."
                value={interactionForm.recommendation}
                onChange={(e) => setInteractionForm({ ...interactionForm, recommendation: e.target.value })}
                className="h-9 text-xs"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInteractionModal(false)} disabled={savingInteraction}>
              Cancel
            </Button>
            <Button onClick={handleSaveInteraction} disabled={savingInteraction} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
              {savingInteraction ? "Saving..." : "Save Interaction Rule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
