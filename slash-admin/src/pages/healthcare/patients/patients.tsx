import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router";
import { Icon } from "@/components/icon";
import { Button } from "@/ui/button";
import { Card, CardContent } from "@/ui/card";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/ui/sheet";
import { Separator } from "@/ui/separator";
import Table, { type ColumnsType } from "antd/es/table";
import { HealthcareApi } from "@/api/services/healthcareService";
import Avatar from "@/components/Avatar";
import type { Patient } from "@/api/services/healthcareService";
import { useDoctypePermissions } from "@/utils/permissions";
import { Badge } from "@/ui/badge";
import { formatAge } from "@/utils/age";
import { cn, extractErrorMessage } from "@/utils";
import { toast } from "sonner";

interface Filters {
  search: string;
  name: string;
  staff_id: string;
  uid: string;
  status: string;
  sex: string;
  blood_group: string;
  mobile: string;
  email: string;
  dob_from: string;
  dob_to: string;
  created_from: string;
  created_to: string;
  modified_from: string;
  modified_to: string;
  tag: string;
  company_affiliation: string;
}

const EMPTY_FILTERS: Filters = {
  search: "",
  name: "",
  staff_id: "",
  uid: "",
  status: "",
  sex: "",
  blood_group: "",
  mobile: "",
  email: "",
  dob_from: "",
  dob_to: "",
  created_from: "",
  created_to: "",
  modified_from: "",
  modified_to: "",
  tag: "",
  company_affiliation: "",
};

export default function PatientsPage() {
  const { canCreate } = useDoctypePermissions("Patient");
  const navigate = useNavigate();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [showQuickEntry, setShowQuickEntry] = useState(false);
  const [saving, setSaving] = useState(false);
  const [availableTags, setAvailableTags] = useState<string[]>([]);

  // High-level KPI counts
  const [kpiCounts, setKpiCounts] = useState({
    active: 0,
    admitted: 0,
  });

  const [quickForm, setQuickForm] = useState({
    first_name: "",
    middle_name: "",
    last_name: "",
    sex: "",
    dob: "",
    blood_group: "",
    uid: "",
    email: "",
    mobile: "",
    invite_user: true,
    address: "",
    address_line_2: "",
    city: "",
    state: "",
    zip_code: "",
    country: "Ethiopia",
    company_affiliation: "Ethiopian Electric Utility (EEU)",
    eeu_staff_id: "",
  });
  const [primaryContactOpen, setPrimaryContactOpen] = useState(true);
  const [primaryAddressOpen, setPrimaryAddressOpen] = useState(false);

  const updateFilter = (key: keyof Filters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const activeFilterCount = Object.entries(filters).filter(
    ([k, v]) => v && k !== "search"
  ).length;

  const removeFilter = (key: keyof Filters) => {
    setFilters((prev) => ({ ...prev, [key]: "" }));
    setPage(1);
  };

  const clearAllFilters = () => {
    setFilters(EMPTY_FILTERS);
    setPage(1);
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = { page, page_size: pageSize };
      if (filters.search) params.search = filters.search;
      if (filters.name) params.name = filters.name;
      if (filters.staff_id) params.staff_id = filters.staff_id;
      if (filters.uid) params.uid = filters.uid;
      if (filters.status) params.status = filters.status;
      if (filters.sex) params.sex = filters.sex;
      if (filters.blood_group) params.blood_group = filters.blood_group;
      if (filters.mobile) params.mobile = filters.mobile;
      if (filters.email) params.email = filters.email;
      if (filters.dob_from) params.dob__gte = filters.dob_from;
      if (filters.dob_to) params.dob__lte = filters.dob_to;
      if (filters.created_from) params.creation__gte = filters.created_from;
      if (filters.created_to) params.creation__lte = filters.created_to;
      if (filters.modified_from) params.modified__gte = filters.modified_from;
      if (filters.modified_to) params.modified__lte = filters.modified_to;
      if (filters.tag) params.tag = filters.tag;
      if (filters.company_affiliation) params.company_affiliation = filters.company_affiliation;
      const res = await HealthcareApi.patients.list(params);
      setPatients(res.results || []);
      setTotal(res.count || 0);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load patient records");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, filters]);

  // Load ancillary metadata & KPI metrics
  const loadKpis = useCallback(async () => {
    try {
      const [tagsRes, activeRes, inptRes] = await Promise.all([
        HealthcareApi.docTags.allTags({ doctype: "Patient" }).catch(() => []),
        HealthcareApi.patients.list({ status: "Active", page_size: 1 }).catch(() => ({ count: 0 })),
        HealthcareApi.inpatientRecords.list({ status: "Admitted", page_size: 1 }).catch(() => ({ count: 0 })),
      ]);
      setAvailableTags(Array.isArray(tagsRes) ? tagsRes : []);
      setKpiCounts({
        active: (activeRes as any).count ?? 0,
        admitted: (inptRes as any).count ?? 0,
      });
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    loadKpis();
  }, [loadKpis]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const resetQuickForm = () =>
    setQuickForm({
      first_name: "",
      middle_name: "",
      last_name: "",
      sex: "",
      dob: "",
      blood_group: "",
      uid: "",
      email: "",
      mobile: "",
      invite_user: true,
      address: "",
      address_line_2: "",
      city: "",
      state: "",
      zip_code: "",
      country: "Ethiopia",
      company_affiliation: "Ethiopian Electric Utility (EEU)",
      eeu_staff_id: "",
    });

  const handleQuickSave = async () => {
    if (!quickForm.first_name.trim()) {
      toast.error("First name is required");
      return;
    }
    setSaving(true);
    try {
      const payload: any = {
        ...quickForm,
        first_name: quickForm.first_name.trim(),
        middle_name: quickForm.middle_name.trim(),
        last_name: quickForm.last_name.trim(),
        dob: quickForm.dob ? quickForm.dob : null,
      };
      const created = await HealthcareApi.patients.create(payload);
      toast.success(`Patient ${created.patient_name || created.first_name} created`);
      setShowQuickEntry(false);
      resetQuickForm();
      loadData();
      loadKpis();
    } catch (err: any) {
      console.error(err);
      toast.error(extractErrorMessage(err, "Failed to create patient"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Are you sure you want to permanently delete patient "${name}"? This action cannot be undone.`)) return;
    try {
      await HealthcareApi.patients.delete(id);
      toast.success("Patient removed successfully");
      loadData();
      loadKpis();
    } catch (err) {
      toast.error("Failed to delete patient");
    }
  };

  // Preset helpers for age ranges
  const applyAgePreset = (preset: "pediatric" | "adult" | "geriatric") => {
    const today = new Date();
    const formatDate = (d: Date) => d.toISOString().split("T")[0];

    if (preset === "pediatric") {
      const eighteenYearsAgo = new Date();
      eighteenYearsAgo.setFullYear(today.getFullYear() - 18);
      setFilters((prev) => ({
        ...prev,
        dob_from: formatDate(eighteenYearsAgo),
        dob_to: formatDate(today),
      }));
    } else if (preset === "adult") {
      const sixtyFiveYearsAgo = new Date();
      sixtyFiveYearsAgo.setFullYear(today.getFullYear() - 65);
      const eighteenYearsAgo = new Date();
      eighteenYearsAgo.setFullYear(today.getFullYear() - 18);
      setFilters((prev) => ({
        ...prev,
        dob_from: formatDate(sixtyFiveYearsAgo),
        dob_to: formatDate(eighteenYearsAgo),
      }));
    } else if (preset === "geriatric") {
      const sixtyFiveYearsAgo = new Date();
      sixtyFiveYearsAgo.setFullYear(today.getFullYear() - 65);
      setFilters((prev) => ({
        ...prev,
        dob_from: "",
        dob_to: formatDate(sixtyFiveYearsAgo),
      }));
    }
    setPage(1);
  };

  const applyCreatedPreset = (preset: "today" | "month") => {
    const today = new Date();
    const formatDate = (d: Date) => d.toISOString().split("T")[0];

    if (preset === "today") {
      setFilters((prev) => ({
        ...prev,
        created_from: formatDate(today),
        created_to: formatDate(today),
      }));
    } else if (preset === "month") {
      const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      setFilters((prev) => ({
        ...prev,
        created_from: formatDate(firstOfMonth),
        created_to: formatDate(today),
      }));
    }
    setPage(1);
  };

  const columns: ColumnsType<Patient> = [
    {
      title: "Patient / Demographics",
      key: "patient",
      width: 260,
      render: (_, r) => {
        const fullName = r.patient_name || `${r.first_name || ""} ${r.last_name || ""}`.trim() || "Unnamed Patient";
        const isMale = r.sex?.toLowerCase() === "male";
        const isFemale = r.sex?.toLowerCase() === "female";

        return (
          <div
            className="flex items-center gap-3 cursor-pointer group py-1"
            onClick={() => navigate(`/healthcare/patients/${r.id}`)}
          >
            <div className="relative">
              <Avatar
                name={fullName}
                src={r.image}
                size="lg"
                className={cn(
                  "ring-2 transition-all",
                  isMale ? "ring-blue-500/30" : isFemale ? "ring-rose-500/30" : "ring-border"
                )}
              />
              <span
                className={cn(
                  "absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-background",
                  r.status === "Active" ? "bg-emerald-500" : "bg-muted-foreground"
                )}
                title={`Status: ${r.status || "Active"}`}
              />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-foreground group-hover:text-primary transition-colors truncate">
                {fullName}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                <span className="text-[10px] font-mono font-semibold text-muted-foreground bg-muted px-1.5 py-0.2 rounded">
                  {r.patient_id || `PAT-${r.id}`}
                </span>
                {(r.company_affiliation?.includes("EEP") || r.eeu_staff_id?.startsWith("EEP")) ? (
                  <span className="text-[10px] font-mono font-bold bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/30 px-1.5 py-0.2 rounded" title="Ethiopian Electric Power (EEP)">
                    EEP {r.eeu_staff_id ? `• ${r.eeu_staff_id}` : ""}
                  </span>
                ) : (r.company_affiliation?.includes("Contractor") || r.company_affiliation?.includes("Other") || r.eeu_staff_id?.startsWith("others")) ? (
                  <span className="text-[10px] font-mono font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 px-1.5 py-0.2 rounded" title="Contractor / Construction / Other">
                    others {r.eeu_staff_id ? `• ${r.eeu_staff_id}` : ""}
                  </span>
                ) : (r.eeu_staff_id || r.company_affiliation?.includes("EEU")) ? (
                  <span className="text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 px-1.5 py-0.2 rounded" title="Ethiopian Electric Utility (EEU)">
                    EEU {r.eeu_staff_id ? `• ${r.eeu_staff_id}` : ""}
                  </span>
                ) : null}
                {r.uid && (
                  <span className="text-[10px] text-muted-foreground font-mono" title="Identification / UID">
                    • UID: {r.uid}
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      },
    },
    {
      title: "Gender & Age",
      key: "demographics",
      width: 140,
      render: (_, r) => {
        const ageStr = formatAge(r.dob, r.age);
        const isMale = r.sex?.toLowerCase() === "male";
        const isFemale = r.sex?.toLowerCase() === "female";

        return (
          <div className="space-y-1">
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] font-semibold px-2 py-0.5 uppercase tracking-wider",
                isMale && "bg-blue-500/10 text-blue-600 border-blue-500/20",
                isFemale && "bg-rose-500/10 text-rose-600 border-rose-500/20",
                !isMale && !isFemale && "bg-muted text-muted-foreground"
              )}
            >
              {r.sex || "Unspecified"}
            </Badge>
            <p className="text-xs text-foreground font-medium flex items-center gap-1">
              <Icon icon="solar:calendar-linear" size={12} className="text-muted-foreground" />
              <span>{ageStr}</span>
            </p>
          </div>
        );
      },
    },
    {
      title: "Blood Group",
      dataIndex: "blood_group",
      width: 110,
      render: (bg: string) => {
        if (!bg) return <span className="text-muted-foreground/40 text-xs">—</span>;
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-600 border border-rose-500/30 shadow-2xs">
            <Icon icon="solar:drop-bold" size={11} className="text-rose-500" />
            {bg}
          </span>
        );
      },
    },
    {
      title: "Contact Communications",
      key: "contact",
      width: 190,
      render: (_, r) => (
        <div className="space-y-1 text-xs">
          {r.mobile ? (
            <a
              href={`tel:${r.mobile}`}
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1.5 text-foreground hover:text-emerald-600 font-medium transition-colors"
            >
              <Icon icon="solar:phone-bold" size={12} className="text-emerald-500" />
              <span>{r.mobile}</span>
            </a>
          ) : (
            <span className="text-muted-foreground/40 block text-xs">—</span>
          )}
          {r.email && (
            <a
              href={`mailto:${r.email}`}
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-blue-600 text-[11px] truncate max-w-[170px] transition-colors"
            >
              <Icon icon="solar:letter-bold" size={11} className="text-blue-500 shrink-0" />
              <span className="truncate">{r.email}</span>
            </a>
          )}
        </div>
      ),
    },
    {
      title: "Residence",
      key: "address",
      width: 150,
      render: (_, r) => {
        const parts = [r.city, r.state, r.country].filter(Boolean);
        if (parts.length === 0) return <span className="text-muted-foreground/40 text-xs">—</span>;
        return (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Icon icon="solar:map-point-bold" size={13} className="text-primary/70 shrink-0" />
            <span className="truncate" title={parts.join(", ")}>
              {parts.join(", ")}
            </span>
          </div>
        );
      },
    },
    {
      title: "Clinical Tags",
      dataIndex: "tags",
      width: 160,
      render: (tags: string[] = []) => (
        <div className="flex flex-wrap gap-1">
          {tags && tags.length > 0 ? (
            tags.map((t) => (
              <button
                key={t}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  updateFilter("tag", t);
                }}
                className={cn(
                  "text-[10px] px-2 py-0.5 rounded-full border transition-colors cursor-pointer flex items-center gap-1 font-medium",
                  filters.tag === t
                    ? "bg-amber-500/20 text-amber-800 dark:text-amber-200 border-amber-500/40 font-bold shadow-2xs"
                    : "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20 hover:bg-blue-500/20"
                )}
                title={`Filter by tag "${t}"`}
              >
                <span>#</span>
                <span>{t}</span>
              </button>
            ))
          ) : (
            <span className="text-muted-foreground/30 text-xs">—</span>
          )}
        </div>
      ),
    },
    {
      title: "Status",
      dataIndex: "status",
      width: 100,
      render: (v: string) => {
        const isActive = v === "Active" || !v;
        return (
          <Badge
            variant="outline"
            className={cn(
              "text-[10px] font-bold uppercase tracking-wider gap-1.5",
              isActive
                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                : "bg-muted text-muted-foreground border-border"
            )}
          >
            <span
              className={cn("w-1.5 h-1.5 rounded-full", isActive ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground")}
            />
            {isActive ? "Active" : "Disabled"}
          </Badge>
        );
      },
    },
    {
      title: "Actions",
      key: "actions",
      width: 110,
      align: "right",
      render: (_, r) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/healthcare/patients/${r.id}`);
            }}
            title="View Patient Workspace"
          >
            <Icon icon="solar:eye-bold-duotone" size={15} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-primary"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/healthcare/patients/${r.id}`);
            }}
            title="Edit Patient"
          >
            <Icon icon="solar:pen-bold-duotone" size={15} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:bg-destructive/10"
            onClick={(e) => {
              e.stopPropagation();
              handleDelete(r.id, r.patient_name || r.first_name);
            }}
            title="Delete Patient Record"
          >
            <Icon icon="solar:trash-bin-trash-bold" size={15} />
          </Button>
        </div>
      ),
    },
  ];

  // Build active filter chips
  const filterChips: { key: keyof Filters; label: string; value: string }[] = [];
  if (filters.name) filterChips.push({ key: "name", label: "Name", value: filters.name });
  if (filters.staff_id) filterChips.push({ key: "staff_id", label: "Staff ID", value: filters.staff_id });
  if (filters.uid) filterChips.push({ key: "uid", label: "UID", value: filters.uid });
  if (filters.status) filterChips.push({ key: "status", label: "Status", value: filters.status });
  if (filters.sex) filterChips.push({ key: "sex", label: "Gender", value: filters.sex });
  if (filters.blood_group) filterChips.push({ key: "blood_group", label: "Blood Group", value: filters.blood_group });
  if (filters.tag) filterChips.push({ key: "tag", label: "Tag", value: `#${filters.tag}` });
  if (filters.company_affiliation) {
    const isEEP = filters.company_affiliation.includes("EEP");
    const isOther = filters.company_affiliation.includes("Contractor") || filters.company_affiliation.includes("Other");
    filterChips.push({ key: "company_affiliation", label: "Company", value: isEEP ? "EEP" : isOther ? "Others" : "EEU" });
  }
  if (filters.mobile) filterChips.push({ key: "mobile", label: "Mobile", value: filters.mobile });
  if (filters.email) filterChips.push({ key: "email", label: "Email", value: filters.email });
  if (filters.dob_from || filters.dob_to) {
    const label = `${filters.dob_from || "Min"} → ${filters.dob_to || "Max"}`;
    filterChips.push({ key: "dob_from", label: "DOB", value: label });
  }
  if (filters.created_from || filters.created_to) {
    const label = `${filters.created_from || "Min"} → ${filters.created_to || "Today"}`;
    filterChips.push({ key: "created_from", label: "Registered", value: label });
  }

  const qf = quickForm;
  const quickFullName = `${qf.first_name} ${qf.middle_name} ${qf.last_name}`.trim();
  const quickCalculatedAge = formatAge(qf.dob);

  return (
    <div className="space-y-5">
      {/* ─── Executive Header & Actions ─── */}
      <div className="rounded-2xl border bg-card p-5 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-primary/10 text-primary">
              <Icon icon="solar:users-group-two-rounded-bold-duotone" size={28} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-foreground">Patients Registry</h1>
                <Badge variant="outline" className="text-xs font-semibold">
                  {total} Registered
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Unified clinical directory, demographic records, and master patient index
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                loadData();
                loadKpis();
                toast.success("Registry refreshed");
              }}
              className="h-9 text-xs gap-1.5"
            >
              <Icon icon="solar:restart-bold" size={14} className={cn(loading && "animate-spin")} />
              Refresh
            </Button>

            {canCreate && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    resetQuickForm();
                    setShowQuickEntry(true);
                  }}
                  className="h-9 text-xs gap-1.5 border-primary/30 text-primary hover:bg-primary/5"
                >
                  <Icon icon="solar:user-plus-bold" size={14} />
                  + Quick Intake
                </Button>

                <Button
                  size="sm"
                  onClick={() => navigate("/healthcare/patients/new")}
                  className="h-9 text-xs font-semibold gap-1.5 bg-primary text-primary-foreground shadow-2xs"
                >
                  <Icon icon="solar:user-id-bold" size={14} />
                  Full Registration
                </Button>
              </>
            )}
          </div>
        </div>

        {/* ─── 4-Card Executive KPI Scorecard ─── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-5 pt-5 border-t border-border/70">
          {/* Card 1: Total Registered */}
          <div className="p-3.5 rounded-xl border bg-muted/20 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                Total Patients
              </span>
              <span className="text-xl font-extrabold text-foreground mt-0.5 block">{total}</span>
              <span className="text-[10px] text-muted-foreground">Master Patient Index</span>
            </div>
            <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600">
              <Icon icon="solar:users-group-two-rounded-bold-duotone" size={20} />
            </div>
          </div>

          {/* Card 2: Active Registry */}
          <div className="p-3.5 rounded-xl border bg-muted/20 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                Active Registry
              </span>
              <span className="text-xl font-extrabold text-foreground mt-0.5 block">{kpiCounts.active}</span>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">Eligible for care</span>
            </div>
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600">
              <Icon icon="solar:user-check-bold-duotone" size={20} />
            </div>
          </div>

          {/* Card 3: Admitted Inpatients */}
          <div className="p-3.5 rounded-xl border bg-muted/20 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                Admitted Inpatients
              </span>
              <span className="text-xl font-extrabold text-foreground mt-0.5 block">{kpiCounts.admitted}</span>
              <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                Active Bed Stays
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-600">
              <Icon icon="solar:bed-bold-duotone" size={20} />
            </div>
          </div>

          {/* Card 4: Cohort Tags */}
          <div className="p-3.5 rounded-xl border bg-muted/20 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                Clinical Tags & Cohorts
              </span>
              <span className="text-xl font-extrabold text-foreground mt-0.5 block">{availableTags.length}</span>
              <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">Categories tracked</span>
            </div>
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600">
              <Icon icon="solar:tag-bold-duotone" size={20} />
            </div>
          </div>
        </div>
      </div>

      {/* ─── Search & Multi-Dimensional Command Bar ─── */}
      <div className="rounded-2xl border bg-card p-4 shadow-2xs space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Hero Search */}
          <div className="relative flex-1 min-w-[220px]">
            <Icon icon="solar:magnifer-linear" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by Patient Name, MRN ID, Mobile, or UID..."
              value={filters.search}
              onChange={(e) => updateFilter("search", e.target.value)}
              className="pl-9 h-9 text-xs bg-background"
            />
            {filters.search && (
              <button
                onClick={() => updateFilter("search", "")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {/* Status Quick Select */}
          <select
            className="h-9 border rounded-xl px-3 text-xs bg-background cursor-pointer focus:ring-2 focus:ring-primary/20 focus:outline-hidden"
            value={filters.status}
            onChange={(e) => updateFilter("status", e.target.value)}
          >
            <option value="">Status: All</option>
            <option value="Active">Active Only</option>
            <option value="Disabled">Disabled Only</option>
          </select>

          {/* Company Affiliation Quick Select */}
          <select
            className="h-9 border rounded-xl px-3 text-xs bg-background cursor-pointer focus:ring-2 focus:ring-primary/20 focus:outline-hidden"
            value={filters.company_affiliation}
            onChange={(e) => updateFilter("company_affiliation", e.target.value)}
          >
            <option value="">Company: All (EEU, EEP & Contractors)</option>
            <option value="Ethiopian Electric Utility (EEU)">EEU Only (EEU-)</option>
            <option value="Ethiopian Electric Power (EEP)">EEP Only (EEP-)</option>
            <option value="Contractor / Other">Construction / Others (others-)</option>
          </select>

          {/* Gender Quick Select */}
          <select
            className="h-9 border rounded-xl px-3 text-xs bg-background cursor-pointer focus:ring-2 focus:ring-primary/20 focus:outline-hidden"
            value={filters.sex}
            onChange={(e) => updateFilter("sex", e.target.value)}
          >
            <option value="">Gender: All</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
          </select>

          {/* Blood Group Quick Select */}
          <select
            className="h-9 border rounded-xl px-3 text-xs bg-background cursor-pointer focus:ring-2 focus:ring-primary/20 focus:outline-hidden"
            value={filters.blood_group}
            onChange={(e) => updateFilter("blood_group", e.target.value)}
          >
            <option value="">Blood: All</option>
            {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((bg) => (
              <option key={bg} value={bg}>
                {bg}
              </option>
            ))}
          </select>

          {/* Tags Quick Select */}
          {availableTags.length > 0 && (
            <select
              className="h-9 border rounded-xl px-3 text-xs bg-background cursor-pointer focus:ring-2 focus:ring-primary/20 focus:outline-hidden"
              value={filters.tag}
              onChange={(e) => updateFilter("tag", e.target.value)}
            >
              <option value="">Tag: All</option>
              {availableTags.map((t) => (
                <option key={t} value={t}>
                  #{t}
                </option>
              ))}
            </select>
          )}

          {/* More Filters Trigger */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              "h-9 text-xs gap-1.5 rounded-xl transition-colors",
              showFilters && "bg-muted font-bold"
            )}
          >
            <Icon icon="solar:filter-bold-duotone" size={14} />
            Advanced Filters
            {activeFilterCount > 0 && (
              <span className="ml-1 bg-primary text-primary-foreground text-[10px] rounded-full px-1.5 py-0.2 font-bold">
                {activeFilterCount}
              </span>
            )}
          </Button>

          {activeFilterCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAllFilters}
              className="h-9 text-xs text-muted-foreground hover:text-foreground"
            >
              Clear All
            </Button>
          )}
        </div>

        {/* ─── Expandable Advanced Filters Drawer ─── */}
        {showFilters && (
          <div className="pt-4 border-t border-border/60 space-y-4 animate-in fade-in-50 slide-in-from-top-2 duration-200">
            {/* Identity & Contact Attributes */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                <Icon icon="solar:user-id-bold-duotone" size={14} className="text-primary" />
                <span>Identity, Staffing & Contact Filters</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                {/* 1. Direct Name Filter */}
                <div className="p-3 rounded-xl border bg-muted/20 hover:border-primary/30 transition-colors space-y-1.5">
                  <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                    <span>Patient Name</span>
                    <Icon icon="solar:user-bold-duotone" size={13} className="text-primary/70" />
                  </Label>
                  <div className="relative">
                    <Icon icon="solar:user-linear" size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Given or family name..."
                      value={filters.name}
                      onChange={(e) => updateFilter("name", e.target.value)}
                      className="pl-8 h-8 text-xs bg-background"
                    />
                    {filters.name && (
                      <button
                        type="button"
                        onClick={() => updateFilter("name", "")}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-[10px]"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>

                {/* 2. Direct Staff / Payroll ID Filter */}
                <div className="p-3 rounded-xl border bg-muted/20 hover:border-primary/30 transition-colors space-y-1.5">
                  <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                    <span>Staff / Payroll ID</span>
                    <Icon icon="solar:card-2-bold-duotone" size={13} className="text-primary/70" />
                  </Label>
                  <div className="relative">
                    <Icon icon="solar:card-2-linear" size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="e.g. 657854, EEU-, EEP-..."
                      value={filters.staff_id}
                      onChange={(e) => updateFilter("staff_id", e.target.value)}
                      className="pl-8 h-8 text-xs font-mono bg-background"
                    />
                    {filters.staff_id && (
                      <button
                        type="button"
                        onClick={() => updateFilter("staff_id", "")}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-[10px]"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>

                {/* 3. Direct Identification / UID Filter */}
                <div className="p-3 rounded-xl border bg-muted/20 hover:border-primary/30 transition-colors space-y-1.5">
                  <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                    <span>Identification / UID</span>
                    <Icon icon="solar:shield-user-bold-duotone" size={13} className="text-primary/70" />
                  </Label>
                  <div className="relative">
                    <Icon icon="solar:shield-check-linear" size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="National ID, Civil UID..."
                      value={filters.uid}
                      onChange={(e) => updateFilter("uid", e.target.value)}
                      className="pl-8 h-8 text-xs font-mono bg-background"
                    />
                    {filters.uid && (
                      <button
                        type="button"
                        onClick={() => updateFilter("uid", "")}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-[10px]"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>

                {/* 4. Direct Mobile Filter */}
                <div className="p-3 rounded-xl border bg-muted/20 hover:border-emerald-500/30 transition-colors space-y-1.5">
                  <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                    <span>Phone / Mobile</span>
                    <Icon icon="solar:phone-bold-duotone" size={13} className="text-emerald-500/70" />
                  </Label>
                  <div className="relative">
                    <Icon icon="solar:phone-linear" size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search phone digits..."
                      value={filters.mobile}
                      onChange={(e) => updateFilter("mobile", e.target.value)}
                      className="pl-8 h-8 text-xs bg-background"
                    />
                    {filters.mobile && (
                      <button
                        type="button"
                        onClick={() => updateFilter("mobile", "")}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-[10px]"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>

                {/* 5. Direct Email Filter */}
                <div className="p-3 rounded-xl border bg-muted/20 hover:border-blue-500/30 transition-colors space-y-1.5">
                  <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                    <span>Email Address</span>
                    <Icon icon="solar:letter-bold-duotone" size={13} className="text-blue-500/70" />
                  </Label>
                  <div className="relative">
                    <Icon icon="solar:letter-linear" size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search email domain..."
                      value={filters.email}
                      onChange={(e) => updateFilter("email", e.target.value)}
                      className="pl-8 h-8 text-xs bg-background"
                    />
                    {filters.email && (
                      <button
                        type="button"
                        onClick={() => updateFilter("email", "")}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-[10px]"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Date Ranges & Windows */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                <Icon icon="solar:calendar-bold-duotone" size={14} className="text-primary" />
                <span>Date Range Windows & Clinical Presets</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {/* Date of Birth Range */}
                <div className="p-3.5 rounded-xl border bg-muted/20 hover:border-primary/30 transition-colors space-y-2.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Icon icon="solar:calendar-linear" size={13} className="text-primary" />
                      <span>Date of Birth Range (Age Cohort)</span>
                    </Label>
                    {(filters.dob_from || filters.dob_to) && (
                      <button
                        type="button"
                        onClick={() => setFilters((prev) => ({ ...prev, dob_from: "", dob_to: "" }))}
                        className="text-[10px] text-muted-foreground hover:text-foreground underline cursor-pointer"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <span className="text-[10px] text-muted-foreground font-medium block mb-1">From (Born after)</span>
                      <Input
                        type="date"
                        value={filters.dob_from}
                        onChange={(e) => updateFilter("dob_from", e.target.value)}
                        className="h-8 text-xs bg-background"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground font-medium block mb-1">To (Born before)</span>
                      <Input
                        type="date"
                        value={filters.dob_to}
                        onChange={(e) => updateFilter("dob_to", e.target.value)}
                        className="h-8 text-xs bg-background"
                      />
                    </div>
                  </div>
                  {/* Age Presets */}
                  <div className="flex items-center gap-1.5 pt-1 border-t border-border/40 flex-wrap">
                    <span className="text-[10px] font-semibold text-muted-foreground">Age Presets:</span>
                    <button
                      type="button"
                      onClick={() => applyAgePreset("pediatric")}
                      className="text-[10px] font-medium px-2 py-0.5 rounded-md border bg-background hover:bg-primary/10 hover:text-primary hover:border-primary/30 text-muted-foreground transition cursor-pointer shadow-2xs"
                    >
                      Pediatric (&lt;18)
                    </button>
                    <button
                      type="button"
                      onClick={() => applyAgePreset("adult")}
                      className="text-[10px] font-medium px-2 py-0.5 rounded-md border bg-background hover:bg-primary/10 hover:text-primary hover:border-primary/30 text-muted-foreground transition cursor-pointer shadow-2xs"
                    >
                      Adult (18-65)
                    </button>
                    <button
                      type="button"
                      onClick={() => applyAgePreset("geriatric")}
                      className="text-[10px] font-medium px-2 py-0.5 rounded-md border bg-background hover:bg-primary/10 hover:text-primary hover:border-primary/30 text-muted-foreground transition cursor-pointer shadow-2xs"
                    >
                      Geriatric (&gt;65)
                    </button>
                  </div>
                </div>

                {/* Registration Date Range */}
                <div className="p-3.5 rounded-xl border bg-muted/20 hover:border-primary/30 transition-colors space-y-2.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Icon icon="solar:clock-circle-linear" size={13} className="text-primary" />
                      <span>Registration / Enrollment Window</span>
                    </Label>
                    {(filters.created_from || filters.created_to) && (
                      <button
                        type="button"
                        onClick={() => setFilters((prev) => ({ ...prev, created_from: "", created_to: "" }))}
                        className="text-[10px] text-muted-foreground hover:text-foreground underline cursor-pointer"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <span className="text-[10px] text-muted-foreground font-medium block mb-1">Enrolled From</span>
                      <Input
                        type="date"
                        value={filters.created_from}
                        onChange={(e) => updateFilter("created_from", e.target.value)}
                        className="h-8 text-xs bg-background"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground font-medium block mb-1">Enrolled To</span>
                      <Input
                        type="date"
                        value={filters.created_to}
                        onChange={(e) => updateFilter("created_to", e.target.value)}
                        className="h-8 text-xs bg-background"
                      />
                    </div>
                  </div>
                  {/* Registration Presets */}
                  <div className="flex items-center gap-1.5 pt-1 border-t border-border/40 flex-wrap">
                    <span className="text-[10px] font-semibold text-muted-foreground">Quick Windows:</span>
                    <button
                      type="button"
                      onClick={() => applyCreatedPreset("today")}
                      className="text-[10px] font-medium px-2 py-0.5 rounded-md border bg-background hover:bg-primary/10 hover:text-primary hover:border-primary/30 text-muted-foreground transition cursor-pointer shadow-2xs"
                    >
                      Registered Today
                    </button>
                    <button
                      type="button"
                      onClick={() => applyCreatedPreset("month")}
                      className="text-[10px] font-medium px-2 py-0.5 rounded-md border bg-background hover:bg-primary/10 hover:text-primary hover:border-primary/30 text-muted-foreground transition cursor-pointer shadow-2xs"
                    >
                      Registered This Month
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── Active Filter Dismissible Badges ─── */}
        {filterChips.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-border/40">
            <span className="text-[11px] font-semibold text-muted-foreground mr-1">Active Filters:</span>
            {filterChips.map((chip) => (
              <span
                key={chip.key}
                className="inline-flex items-center gap-1.5 bg-primary/10 text-primary border border-primary/20 text-[11px] rounded-full px-2.5 py-0.5 font-medium shadow-2xs"
              >
                <span className="opacity-75">{chip.label}:</span>
                <span className="font-bold">{chip.value}</span>
                <button
                  type="button"
                  onClick={() => {
                    if (chip.key === "dob_from") {
                      setFilters((prev) => ({ ...prev, dob_from: "", dob_to: "" }));
                    } else if (chip.key === "created_from") {
                      setFilters((prev) => ({ ...prev, created_from: "", created_to: "" }));
                    } else {
                      removeFilter(chip.key);
                    }
                    setPage(1);
                  }}
                  className="hover:bg-primary/20 rounded-full p-0.5 text-primary transition-colors cursor-pointer"
                >
                  <Icon icon="solar:close-circle-bold" size={12} />
                </button>
              </span>
            ))}
            <button
              type="button"
              onClick={clearAllFilters}
              className="text-[11px] text-muted-foreground hover:text-foreground underline ml-2 cursor-pointer"
            >
              Reset all
            </button>
          </div>
        )}
      </div>

      {/* ─── Interactive Patients Table ─── */}
      <Card className="shadow-2xs overflow-hidden">
        <CardContent className="p-0">
          <Table
            columns={columns}
            dataSource={patients}
            rowKey="id"
            loading={loading}
            onRow={(r) => ({
              onClick: () => navigate(`/healthcare/patients/${r.id}`),
              className: "cursor-pointer hover:bg-muted/30 transition-colors",
            })}
            pagination={{
              current: page,
              total,
              pageSize,
              onChange: (p, ps) => {
                setPage(p);
                if (ps && ps !== pageSize) setPageSize(ps);
              },
              showSizeChanger: true,
              pageSizeOptions: ["10", "20", "50", "100"],
              showTotal: (tot, range) => `${range[0]}-${range[1]} of ${tot} patients`,
            }}
          />
        </CardContent>
      </Card>

      {/* ─── Quick Entry Slide-Over Panel ─── */}
      <Sheet open={showQuickEntry} onOpenChange={setShowQuickEntry}>
        <SheetContent side="right" className="w-full sm:max-w-[520px] p-0 flex flex-col">
          <SheetHeader className="border-b px-6 py-4 bg-muted/20">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-primary/10 text-primary">
                <Icon icon="solar:user-plus-bold-duotone" size={20} />
              </div>
              <div>
                <SheetTitle className="text-base font-bold">Quick Patient Intake</SheetTitle>
                <p className="text-xs text-muted-foreground">Rapid intake registration for outpatient walk-ins</p>
              </div>
            </div>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            {/* Live Patient Profile Preview */}
            <div className="p-3.5 rounded-2xl border border-primary/20 bg-primary/5 flex items-center gap-3">
              <Avatar
                name={quickFullName || "New Patient"}
                size="lg"
                className="ring-2 ring-primary/30 shrink-0"
              />
              <div className="min-w-0 flex-1">
                <span className="text-xs font-bold text-foreground block truncate">
                  {quickFullName || "New Patient Intake"}
                </span>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <Badge variant="outline" className="text-[10px] font-semibold">
                    {qf.sex || "Gender Pending"}
                  </Badge>
                  {qf.blood_group && (
                    <Badge variant="outline" className="text-[10px] font-bold text-rose-600 border-rose-500/30 bg-rose-500/10">
                      {qf.blood_group}
                    </Badge>
                  )}
                  <span className="text-[10px] text-muted-foreground">
                    {quickCalculatedAge}
                  </span>
                </div>
              </div>
            </div>

            {/* Legal Demographics */}
            <div className="space-y-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
                1. Legal Demographics
              </span>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 sm:col-span-1">
                  <Label className="text-xs font-semibold">
                    First Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    className="mt-1 h-8 text-xs"
                    value={qf.first_name}
                    onChange={(e) => setQuickForm({ ...quickForm, first_name: e.target.value })}
                    placeholder="Given name"
                  />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <Label className="text-xs font-semibold text-muted-foreground">Middle Name</Label>
                  <Input
                    className="mt-1 h-8 text-xs"
                    value={qf.middle_name}
                    onChange={(e) => setQuickForm({ ...quickForm, middle_name: e.target.value })}
                    placeholder="Father's / middle name"
                  />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs font-semibold">Last Name</Label>
                  <Input
                    className="mt-1 h-8 text-xs"
                    value={qf.last_name}
                    onChange={(e) => setQuickForm({ ...quickForm, last_name: e.target.value })}
                    placeholder="Family surname"
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Biological Baseline */}
            <div className="space-y-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
                2. Biological Baseline
              </span>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold">
                    Gender <span className="text-destructive">*</span>
                  </Label>
                  <select
                    className="mt-1 w-full border rounded-lg px-2.5 py-1.5 text-xs bg-background h-8 focus:ring-2 focus:ring-primary/20 focus:outline-hidden"
                    value={qf.sex}
                    onChange={(e) => setQuickForm({ ...quickForm, sex: e.target.value })}
                  >
                    <option value="">Select Gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>
                <div>
                  <Label className="text-xs font-semibold">Date of Birth</Label>
                  <Input
                    type="date"
                    className="mt-1 h-8 text-xs"
                    value={qf.dob}
                    onChange={(e) => setQuickForm({ ...quickForm, dob: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold">Blood Group</Label>
                  <select
                    className="mt-1 w-full border rounded-lg px-2.5 py-1.5 text-xs bg-background h-8 focus:ring-2 focus:ring-primary/20 focus:outline-hidden"
                    value={qf.blood_group}
                    onChange={(e) => setQuickForm({ ...quickForm, blood_group: e.target.value })}
                  >
                    <option value="">Select Blood Group</option>
                    {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((bg) => (
                      <option key={bg} value={bg}>
                        {bg}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label className="text-xs font-semibold">Identification / UID</Label>
                  <Input
                    className="mt-1 h-8 text-xs"
                    placeholder="Civil ID / SSN"
                    value={qf.uid}
                    onChange={(e) => setQuickForm({ ...quickForm, uid: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Corporate Affiliation (EEU / EEP / Contractor) */}
            <div className="space-y-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
                3. Corporate Employer Affiliation
              </span>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold">Employer Scheme</Label>
                  <select
                    className="mt-1 w-full border rounded-lg px-2.5 py-1.5 text-xs bg-background h-8 focus:ring-2 focus:ring-primary/20 focus:outline-hidden"
                    value={qf.company_affiliation}
                    onChange={(e) => {
                      const newAffil = e.target.value;
                      const rawNum = (qf.eeu_staff_id || "")
                        .replace(/^(EEU|EEP|others)-EMP-?/i, "")
                        .replace(/^(EEU|EEP|others)-/i, "")
                        .replace(/^EMP-?/i, "");
                      const prefix = newAffil.includes("EEP")
                        ? "EEP-"
                        : (newAffil.includes("Contractor") || newAffil.includes("Other"))
                        ? "others-"
                        : "EEU-";
                      setQuickForm({
                        ...quickForm,
                        company_affiliation: newAffil,
                        eeu_staff_id: rawNum ? `${prefix}${rawNum}` : "",
                      });
                    }}
                  >
                    <option value="Ethiopian Electric Utility (EEU)">Ethiopian Electric Utility (EEU)</option>
                    <option value="Ethiopian Electric Power (EEP)">Ethiopian Electric Power (EEP)</option>
                    <option value="Contractor / Other">Construction / Contractor / Other</option>
                  </select>
                </div>
                <div>
                  <Label className="text-xs font-semibold flex items-center justify-between">
                    <span>Staff / Payroll ID</span>
                    <span className="text-[10px] text-muted-foreground font-normal">Digits only</span>
                  </Label>
                  <div className="relative mt-1 flex rounded-lg shadow-2xs">
                    <span className={cn(
                      "inline-flex items-center px-2.5 rounded-l-lg border border-r-0 text-xs font-mono font-bold select-none",
                      qf.company_affiliation?.includes("EEP")
                        ? "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30"
                        : (qf.company_affiliation?.includes("Contractor") || qf.company_affiliation?.includes("Other"))
                        ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30"
                        : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                    )}>
                      {qf.company_affiliation?.includes("EEP")
                        ? "EEP-"
                        : (qf.company_affiliation?.includes("Contractor") || qf.company_affiliation?.includes("Other"))
                        ? "others-"
                        : "EEU-"}
                    </span>
                    <Input
                      className="rounded-l-none h-8 text-xs font-mono font-bold tracking-wider"
                      placeholder={
                        qf.company_affiliation?.includes("EEP")
                          ? "765767"
                          : (qf.company_affiliation?.includes("Contractor") || qf.company_affiliation?.includes("Other"))
                          ? "578879"
                          : "657854"
                      }
                      value={
                        (qf.eeu_staff_id || "")
                          .replace(/^(EEU|EEP|others)-EMP-?/i, "")
                          .replace(/^(EEU|EEP|others)-/i, "")
                          .replace(/^EMP-?/i, "")
                      }
                      onChange={(e) => {
                        const rawDigits = e.target.value.replace(/[^0-9]/g, "");
                        const prefix = qf.company_affiliation?.includes("EEP")
                          ? "EEP-"
                          : (qf.company_affiliation?.includes("Contractor") || qf.company_affiliation?.includes("Other"))
                          ? "others-"
                          : "EEU-";
                        setQuickForm({
                          ...quickForm,
                          eeu_staff_id: rawDigits ? `${prefix}${rawDigits}` : "",
                        });
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            {/* Primary Contact Details */}
            <div className="space-y-3">
              <button
                type="button"
                className="flex items-center justify-between text-xs font-bold text-foreground w-full cursor-pointer"
                onClick={() => setPrimaryContactOpen(!primaryContactOpen)}
              >
                <span className="uppercase tracking-wider text-muted-foreground">4. Primary Contact</span>
                <Icon
                  icon={primaryContactOpen ? "solar:alt-arrow-down-bold" : "solar:alt-arrow-right-bold"}
                  size={14}
                  className="text-muted-foreground"
                />
              </button>
              {primaryContactOpen && (
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <Label className="text-xs font-semibold">Mobile Phone</Label>
                    <Input
                      type="tel"
                      className="mt-1 h-8 text-xs"
                      placeholder="+251 ..."
                      value={qf.mobile}
                      onChange={(e) => setQuickForm({ ...quickForm, mobile: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold">Email Address</Label>
                    <Input
                      type="email"
                      className="mt-1 h-8 text-xs"
                      placeholder="patient@domain.com"
                      value={qf.email}
                      onChange={(e) => setQuickForm({ ...quickForm, email: e.target.value })}
                    />
                  </div>
                  <div className="col-span-2 pt-1">
                    <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                      <input
                        type="checkbox"
                        checked={qf.invite_user}
                        onChange={(e) => setQuickForm({ ...quickForm, invite_user: e.target.checked })}
                        className="rounded border-border text-primary focus:ring-primary h-3.5 w-3.5"
                      />
                      <span>Invite patient to access the self-service online portal</span>
                    </label>
                  </div>
                </div>
              )}
            </div>

            <Separator />

            {/* Primary Address */}
            <div className="space-y-3">
              <button
                type="button"
                className="flex items-center justify-between text-xs font-bold text-foreground w-full cursor-pointer"
                onClick={() => setPrimaryAddressOpen(!primaryAddressOpen)}
              >
                <span className="uppercase tracking-wider text-muted-foreground">4. Residential Address</span>
                <Icon
                  icon={primaryAddressOpen ? "solar:alt-arrow-down-bold" : "solar:alt-arrow-right-bold"}
                  size={14}
                  className="text-muted-foreground"
                />
              </button>
              {primaryAddressOpen && (
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="col-span-2">
                    <Label className="text-xs font-semibold">Address Line</Label>
                    <Input
                      className="mt-1 h-8 text-xs"
                      placeholder="Street address, house number"
                      value={qf.address}
                      onChange={(e) => setQuickForm({ ...quickForm, address: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold">City / Town</Label>
                    <Input
                      className="mt-1 h-8 text-xs"
                      value={qf.city}
                      onChange={(e) => setQuickForm({ ...quickForm, city: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold">State / Region</Label>
                    <Input
                      className="mt-1 h-8 text-xs"
                      value={qf.state}
                      onChange={(e) => setQuickForm({ ...quickForm, state: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold">Country</Label>
                    <Input
                      className="mt-1 h-8 text-xs"
                      value={qf.country}
                      onChange={(e) => setQuickForm({ ...quickForm, country: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold">Postal / ZIP Code</Label>
                    <Input
                      className="mt-1 h-8 text-xs"
                      value={qf.zip_code}
                      onChange={(e) => setQuickForm({ ...quickForm, zip_code: e.target.value })}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          <SheetFooter className="border-t px-6 py-4 flex flex-row items-center justify-between bg-muted/20">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setShowQuickEntry(false);
                navigate("/healthcare/patients/new");
              }}
              className="text-xs"
            >
              Open Full Form
            </Button>
            <Button
              onClick={handleQuickSave}
              disabled={saving || !qf.first_name}
              className="bg-primary text-primary-foreground text-xs font-semibold px-6 gap-1.5"
            >
              {saving ? (
                <>
                  <Icon icon="solar:restart-bold" size={14} className="animate-spin" />
                  Registering...
                </>
              ) : (
                <>
                  <Icon icon="solar:check-circle-bold" size={14} />
                  Register Patient
                </>
              )}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
