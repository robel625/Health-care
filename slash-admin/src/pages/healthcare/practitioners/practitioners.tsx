import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router";
import { Icon } from "@/components/icon";
import { Button } from "@/ui/button";
import { Card, CardContent } from "@/ui/card";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { Badge } from "@/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/ui/dialog";
import { Separator } from "@/ui/separator";
import Table, { type ColumnsType } from "antd/es/table";
import { HealthcareApi } from "@/api/services/healthcareService";
import Avatar from "@/components/Avatar";
import type { HealthcarePractitioner, MedicalDepartment } from "@/api/services/healthcareService";
import { useDoctypePermissions } from "@/utils/permissions";
import { cn } from "@/utils";
import { toast } from "sonner";

interface Filters {
  search: string;
  status: string;
  department: string;
  gender: string;
  practitioner_type: string;
  mobile_phone: string;
  email: string;
  eeu_staff_id: string;
  created_from: string;
  created_to: string;
  modified_from: string;
  modified_to: string;
}

const EMPTY_FILTERS: Filters = {
  search: "",
  status: "",
  department: "",
  gender: "",
  practitioner_type: "",
  mobile_phone: "",
  email: "",
  eeu_staff_id: "",
  created_from: "",
  created_to: "",
  modified_from: "",
  modified_to: "",
};

// Curated medical department palette for high visual clarity
function getDepartmentStyle(deptName?: string) {
  const name = (deptName || "").toLowerCase();
  if (name.includes("cardio")) {
    return {
      bg: "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/25",
      badge: "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30",
      icon: "solar:heart-pulse-bold",
    };
  }
  if (name.includes("pediatr") || name.includes("child")) {
    return {
      bg: "bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/25",
      badge: "bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-500/30",
      icon: "solar:user-bold",
    };
  }
  if (name.includes("surg") || name.includes("operat")) {
    return {
      bg: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/25",
      badge: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
      icon: "solar:medical-kit-bold",
    };
  }
  if (name.includes("physio") || name.includes("rehab")) {
    return {
      bg: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/25",
      badge: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
      icon: "solar:accessibility-bold",
    };
  }
  if (name.includes("neuro") || name.includes("psych")) {
    return {
      bg: "bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-500/25",
      badge: "bg-violet-500/15 text-violet-700 dark:text-violet-400 border-violet-500/30",
      icon: "solar:atom-bold",
    };
  }
  if (name.includes("patho") || name.includes("lab") || name.includes("radio")) {
    return {
      bg: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border-cyan-500/25",
      badge: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-400 border-cyan-500/30",
      icon: "solar:test-tube-bold",
    };
  }
  if (name.includes("emerg") || name.includes("casualty")) {
    return {
      bg: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/25",
      badge: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30",
      icon: "solar:danger-bold",
    };
  }
  return {
    bg: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/25",
    badge: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30",
    icon: "solar:stethoscope-bold",
  };
}

export default function PractitionersPage() {
  const { canCreate, canWrite, canDelete } = useDoctypePermissions("Healthcare Practitioner");
  const navigate = useNavigate();

  // State
  const [data, setData] = useState<HealthcarePractitioner[]>([]);
  const [departments, setDepartments] = useState<MedicalDepartment[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [viewMode, setViewMode] = useState<"cards" | "table">("table");
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [showQuickEntry, setShowQuickEntry] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Quick entry form state
  const [quickForm, setQuickForm] = useState({
    first_name: "",
    middle_name: "",
    last_name: "",
    gender: "Male",
    status: "Active",
    practitioner_type: "Internal",
    department: "",
    designation: "Consultant Physician",
    mobile_phone: "",
    email: "",
    eeu_staff_id: "",
    enable_free_follow_ups: false,
    max_visits: 1,
    valid_days: 7,
  });

  // Load Departments on mount
  useEffect(() => {
    HealthcareApi.departments
      .list({ page_size: 100 })
      .then((res) => {
        setDepartments(res.results || []);
      })
      .catch(() => {});
  }, []);

  const updateFilter = (key: keyof Filters, value: any) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const removeFilter = (key: keyof Filters) => {
    setFilters((prev) => ({ ...prev, [key]: "" }));
    setPage(1);
  };

  const clearAllFilters = () => {
    setFilters(EMPTY_FILTERS);
    setPage(1);
  };

  const activeFilterCount = Object.entries(filters).filter(
    ([k, v]) => v && k !== "search"
  ).length;

  // Data loader
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = { page, page_size: pageSize };
      if (filters.search) params.search = filters.search;
      if (filters.status) params.status = filters.status;
      if (filters.department) params.department = filters.department;
      if (filters.gender) params.gender = filters.gender;
      if (filters.practitioner_type) params.practitioner_type = filters.practitioner_type;
      if (filters.eeu_staff_id) params.eeu_staff_id = filters.eeu_staff_id;
      if (filters.mobile_phone) params.mobile_phone = filters.mobile_phone;
      if (filters.email) params.email = filters.email;
      if (filters.created_from) params.creation__gte = filters.created_from;
      if (filters.created_to) params.creation__lte = filters.created_to;
      if (filters.modified_from) params.modified__gte = filters.modified_from;
      if (filters.modified_to) params.modified__lte = filters.modified_to;

      const res = await HealthcareApi.practitioners.list(params);
      let results = res.results || [];

      setData(results);
      setTotal(res.count || 0);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load practitioners");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, filters]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Aggregate KPI metrics
  const kpis = useMemo(() => {
    const active = data.filter((p) => p.status === "Active").length;
    const internal = data.filter((p) => p.practitioner_type === "Internal").length;
    const external = data.filter((p) => p.practitioner_type === "External").length;
    const uniqueDepts = new Set(data.map((p) => p.department_name).filter(Boolean)).size;

    return {
      active,
      activePct: data.length > 0 ? Math.round((active / data.length) * 100) : 100,
      internal,
      external,
      uniqueDepts,
    };
  }, [data]);

  const handleCopyId = (practitionerId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(practitionerId);
    toast.success(`Copied ID ${practitionerId} to clipboard`);
  };

  const resetQuickForm = () => {
    setQuickForm({
      first_name: "",
      middle_name: "",
      last_name: "",
      gender: "Male",
      status: "Active",
      practitioner_type: "Internal",
      department: departments[0]?.id ? String(departments[0].id) : "",
      designation: "Consultant Physician",
      mobile_phone: "",
      email: "",
      eeu_staff_id: "",
      enable_free_follow_ups: false,
      max_visits: 1,
      valid_days: 7,
    });
  };

  const handleQuickSave = async () => {
    if (!quickForm.first_name.trim()) {
      toast.error("Please enter practitioner's first name");
      return;
    }
    setSaving(true);
    try {
      const payload: any = {
        first_name: quickForm.first_name.trim(),
        middle_name: quickForm.middle_name.trim(),
        last_name: quickForm.last_name.trim(),
        gender: quickForm.gender,
        status: quickForm.status,
        practitioner_type: quickForm.practitioner_type,
        designation: quickForm.designation.trim(),
        mobile_phone: quickForm.mobile_phone.trim(),
        email: quickForm.email.trim(),
        eeu_staff_id: quickForm.eeu_staff_id.trim(),
        op_consulting_charge: 0,
        inpatient_visit_charge: 0,
        enable_free_follow_ups: quickForm.enable_free_follow_ups,
        max_visits: quickForm.max_visits,
        valid_days: quickForm.valid_days,
      };
      if (quickForm.department) {
        payload.department = Number(quickForm.department);
      }

      await HealthcareApi.practitioners.create(payload);
      toast.success(`Dr. ${quickForm.first_name} ${quickForm.last_name} registered successfully`);
      setShowQuickEntry(false);
      resetQuickForm();
      loadData();
    } catch (err: any) {
      toast.error(err?.message || "Failed to create practitioner");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await HealthcareApi.practitioners.delete(deleteId);
      toast.success("Practitioner record deleted");
      setDeleteId(null);
      loadData();
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete practitioner");
    } finally {
      setDeleting(false);
    }
  };

  // Build filter chips for active filters
  const filterChips: { key: keyof Filters; label: string; value: string }[] = [];
  if (filters.status) filterChips.push({ key: "status", label: "Status", value: filters.status });
  if (filters.department) {
    const deptObj = departments.find((d) => String(d.id) === String(filters.department));
    filterChips.push({
      key: "department",
      label: "Department",
      value: deptObj?.department || `Dept #${filters.department}`,
    });
  }
  if (filters.practitioner_type)
    filterChips.push({ key: "practitioner_type", label: "Type", value: filters.practitioner_type });
  if (filters.gender) filterChips.push({ key: "gender", label: "Gender", value: filters.gender });
  if (filters.mobile_phone) filterChips.push({ key: "mobile_phone", label: "Phone", value: filters.mobile_phone });
  if (filters.email) filterChips.push({ key: "email", label: "Email", value: filters.email });
  if (filters.eeu_staff_id) {
    filterChips.push({ key: "eeu_staff_id", label: "EEU ID", value: filters.eeu_staff_id });
  }
  if (filters.created_from || filters.created_to) {
    filterChips.push({
      key: "created_from",
      label: "Created",
      value: `${filters.created_from || "Min"} → ${filters.created_to || "Today"}`,
    });
  }

  // Ant Design Table Columns for Table View
  const columns: ColumnsType<HealthcarePractitioner> = [
    {
      title: "Practitioner",
      key: "practitioner",
      width: 260,
      render: (_, r) => {
        const initials = `${r.first_name?.[0] || ""}${r.last_name?.[0] || ""}`;
        return (
          <div
            className="flex items-center gap-3 cursor-pointer group"
            onClick={() => navigate(`/healthcare/practitioners/${r.id}`)}
          >
            <div className="relative shrink-0">
              <Avatar
                name={r.practitioner_name || `${r.first_name} ${r.last_name}`}
                initials={initials}
                src={r.image}
                size="lg"
                tone="blue"
              />
              <span
                className={cn(
                  "absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-background",
                  r.status === "Active" ? "bg-emerald-500" : "bg-muted-foreground/60"
                )}
                title={`Status: ${r.status}`}
              />
            </div>
            <div className="min-w-0">
              <p className="font-bold text-xs text-foreground group-hover:text-primary transition-colors truncate">
                {r.practitioner_name || `Dr. ${r.first_name} ${r.last_name}`}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span
                  onClick={(e) => handleCopyId(r.practitioner_id || `PRA-${r.id}`, e)}
                  className="font-mono text-[10px] text-muted-foreground bg-muted hover:bg-muted/80 px-1.5 py-0.5 rounded cursor-copy flex items-center gap-1"
                  title="Click to copy ID"
                >
                  {r.practitioner_id || `PRA-${r.id}`}
                  <Icon icon="solar:copy-bold" size={10} className="opacity-60" />
                </span>
                {r.eeu_staff_id && (
                  <span className="font-mono text-[10px] text-primary bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded flex items-center gap-1 font-semibold">
                    <Icon icon="solar:badge-check-bold" size={10} className="text-primary" />
                    {r.eeu_staff_id}
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      },
    },
    {
      title: "Department & Specialty",
      key: "department",
      width: 200,
      render: (_, r) => {
        const style = getDepartmentStyle(r.department_name);
        return (
          <div className="space-y-1">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border",
                style.badge
              )}
            >
              <Icon icon={style.icon} size={13} />
              {r.department_name || "General Medicine"}
            </span>
            <p className="text-[11px] text-muted-foreground truncate pl-0.5">
              {r.designation || "Physician"}
            </p>
          </div>
        );
      },
    },
    {
      title: "Affiliation",
      dataIndex: "practitioner_type",
      width: 120,
      render: (v: string) => (
        <Badge
          variant="outline"
          className={cn(
            "text-[10px] font-bold px-2 py-0.5",
            v === "Internal"
              ? "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/30"
              : "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30"
          )}
        >
          {v === "Internal" ? "Internal Staff" : "Visiting Specialist"}
        </Badge>
      ),
    },
    {
      title: "EEU ID",
      dataIndex: "eeu_staff_id",
      width: 140,
      render: (v: string, r) => (
        <div>
          {v || r.eeu_staff_id ? (
            <span className="inline-flex items-center gap-1 font-mono font-bold text-xs text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded">
              <Icon icon="solar:badge-check-bold" size={12} className="text-primary shrink-0" />
              {v || r.eeu_staff_id}
            </span>
          ) : (
            <span className="text-[11px] text-muted-foreground/60 italic font-mono">EEU-PENDING</span>
          )}
          <span className="text-[10px] text-muted-foreground block mt-0.5">
            EEU Salaried Staff
          </span>
        </div>
      ),
    },
    {
      title: "Contact",
      key: "contact",
      width: 180,
      render: (_, r) => (
        <div className="space-y-1 text-xs">
          {r.mobile_phone ? (
            <a
              href={`tel:${r.mobile_phone}`}
              className="flex items-center gap-1.5 text-foreground hover:text-emerald-600 transition-colors"
            >
              <Icon icon="solar:phone-bold" size={12} className="text-emerald-500 shrink-0" />
              <span className="font-mono text-[11px]">{r.mobile_phone}</span>
            </a>
          ) : (
            <span className="text-muted-foreground/40 text-[11px]">No phone</span>
          )}
          {r.email && (
            <a
              href={`mailto:${r.email}`}
              className="flex items-center gap-1.5 text-muted-foreground hover:text-blue-600 transition-colors truncate max-w-[170px]"
            >
              <Icon icon="solar:letter-bold" size={12} className="text-blue-500 shrink-0" />
              <span className="truncate text-[11px]">{r.email}</span>
            </a>
          )}
        </div>
      ),
    },
    {
      title: "Status",
      dataIndex: "status",
      width: 110,
      render: (v: string) => (
        <span
          className={cn(
            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold",
            v === "Active"
              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30"
              : "bg-muted text-muted-foreground border border-border"
          )}
        >
          <span
            className={cn(
              "w-1.5 h-1.5 rounded-full",
              v === "Active" ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground/60"
            )}
          />
          {v || "Active"}
        </span>
      ),
    },
    {
      title: "Actions",
      key: "actions",
      width: 140,
      render: (_, r) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/healthcare/practitioners/${r.id}`)}
            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
            title="View Practitioner Profile"
          >
            <Icon icon="solar:eye-bold" size={16} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/healthcare/appointments/new?practitioner=${r.id}`);
            }}
            className="h-8 w-8 p-0 text-muted-foreground hover:text-emerald-600"
            title="Book Patient Appointment"
          >
            <Icon icon="solar:calendar-add-bold" size={16} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              navigate(
                `/healthcare/practitioners/practitioner-schedule?practitioner=${r.id}`
              );
            }}
            className="h-8 w-8 p-0 text-muted-foreground hover:text-blue-600"
            title="View Working Schedule"
          >
            <Icon icon="solar:calendar-bold-duotone" size={16} />
          </Button>
          {canWrite && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(`/healthcare/practitioners/${r.id}`)}
              className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
              title="Edit Profile"
            >
              <Icon icon="solar:pen-bold-duotone" size={16} />
            </Button>
          )}
          {canDelete && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDeleteId(r.id)}
              className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
              title="Delete Practitioner"
            >
              <Icon icon="solar:trash-bin-trash-bold" size={16} />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      {/* ─── Executive Header & Command Bar ─── */}
      <div className="rounded-2xl border bg-card p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-blue-500/15 to-indigo-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/20 shadow-xs">
              <Icon icon="solar:stethoscope-bold-duotone" size={30} />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl font-extrabold tracking-tight text-foreground">
                  Practitioners & Specialists
                </h1>
                <Badge variant="outline" className="text-xs font-bold px-2 py-0.5 bg-muted/60">
                  {total} Clinicians
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Clinical staff directory, departmental privileges, consulting fee schedules, and duty rosters
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                loadData();
                toast.success("Roster refreshed");
              }}
              className="h-9 text-xs gap-1.5"
            >
              <Icon icon="solar:restart-bold" size={14} className={cn(loading && "animate-spin")} />
              Refresh
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/healthcare/practitioners/practitioner-schedule")}
              className="h-9 text-xs gap-1.5 border-blue-500/30 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/20"
            >
              <Icon icon="solar:calendar-bold-duotone" size={14} />
              Schedules Master
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
                  className="h-9 text-xs gap-1.5 border-emerald-500/30 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
                >
                  <Icon icon="solar:user-plus-bold-duotone" size={14} />
                  + Quick Onboard
                </Button>

                <Button
                  size="sm"
                  onClick={() => navigate("/healthcare/practitioners/new")}
                  className="h-9 text-xs font-semibold gap-1.5 bg-blue-600 hover:bg-blue-700 text-white shadow-xs"
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
          {/* Card 1: Total Practitioners */}
          <div className="p-3.5 rounded-xl border bg-muted/20 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                Total Roster
              </span>
              <span className="text-xl font-extrabold text-foreground mt-0.5 block">{total}</span>
              <span className="text-[10px] text-muted-foreground">Credentialed Providers</span>
            </div>
            <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600">
              <Icon icon="solar:users-group-two-rounded-bold-duotone" size={20} />
            </div>
          </div>

          {/* Card 2: Active on Duty */}
          <div className="p-3.5 rounded-xl border bg-muted/20 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                Active Physicians
              </span>
              <span className="text-xl font-extrabold text-foreground mt-0.5 block">{kpis.active}</span>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                {kpis.activePct}% Available for care
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600">
              <Icon icon="solar:verified-check-bold" size={20} />
            </div>
          </div>

          {/* Card 3: Internal vs External */}
          <div className="p-3.5 rounded-xl border bg-muted/20 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                Staff vs Visiting
              </span>
              <span className="text-xl font-extrabold text-foreground mt-0.5 block">
                {kpis.internal} <span className="text-xs text-muted-foreground font-normal">/ {kpis.external}</span>
              </span>
              <span className="text-[10px] text-purple-600 dark:text-purple-400 font-medium">
                {kpis.internal} Internal • {kpis.external} External
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-600">
              <Icon icon="solar:buildings-bold-duotone" size={20} />
            </div>
          </div>

          {/* Card 4: Covered Departments */}
          <div className="p-3.5 rounded-xl border bg-muted/20 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                Departments
              </span>
              <span className="text-xl font-extrabold text-foreground mt-0.5 block">
                {kpis.uniqueDepts || departments.length}
              </span>
              <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                Specialized Disciplines
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600">
              <Icon icon="solar:medical-kit-bold-duotone" size={20} />
            </div>
          </div>
        </div>
      </div>

      {/* ─── Search, Quick Filter Pills, and View Switcher ─── */}
      <div className="space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Main Search and Dropdowns */}
          <div className="flex items-center gap-2 flex-1 flex-wrap">
            <div className="relative min-w-[240px] max-w-sm flex-1">
              <Icon
                icon="solar:magnifer-linear"
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                placeholder="Search by name, ID, designation, phone..."
                value={filters.search}
                onChange={(e) => updateFilter("search", e.target.value)}
                className="pl-9 h-9 text-xs"
              />
              {filters.search && (
                <button
                  type="button"
                  onClick={() => updateFilter("search", "")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs"
                >
                  <Icon icon="solar:close-circle-bold" size={14} />
                </button>
              )}
            </div>

            {/* Department Dropdown */}
            <select
              className="h-9 border border-input rounded-md px-3 text-xs bg-background text-foreground font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={filters.department}
              onChange={(e) => updateFilter("department", e.target.value)}
            >
              <option value="">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.department}
                </option>
              ))}
            </select>

            {/* Status Dropdown */}
            <select
              className="h-9 border border-input rounded-md px-3 text-xs bg-background text-foreground font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={filters.status}
              onChange={(e) => updateFilter("status", e.target.value)}
            >
              <option value="">All Statuses</option>
              <option value="Active">Active Only</option>
              <option value="Disabled">Disabled</option>
            </select>

            {/* Type Dropdown */}
            <select
              className="h-9 border border-input rounded-md px-3 text-xs bg-background text-foreground font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={filters.practitioner_type}
              onChange={(e) => updateFilter("practitioner_type", e.target.value)}
            >
              <option value="">All Types</option>
              <option value="Internal">Internal Staff</option>
              <option value="External">Visiting Specialist</option>
            </select>


            {/* More Filters button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className="h-9 text-xs gap-1.5"
            >
              <Icon icon="solar:filter-bold" size={13} />
              More Filters
              {activeFilterCount > 0 && (
                <span className="ml-1 bg-primary/20 text-primary text-[10px] rounded-full px-1.5 py-0.2 font-bold">
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
                Clear all
              </Button>
            )}
          </div>

          {/* Right Controls: View Switcher */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="p-0.5 rounded-lg border bg-muted/40 flex items-center">
              <button
                type="button"
                onClick={() => {
                  setViewMode("table");
                  setPageSize(20);
                }}
                className={cn(
                  "px-2.5 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all",
                  viewMode === "table"
                    ? "bg-background text-foreground shadow-2xs font-bold"
                    : "text-muted-foreground hover:text-foreground"
                )}
                title="Tabular Clinical View"
              >
                <Icon icon="solar:list-bold" size={15} />
                <span>Table View</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setViewMode("cards");
                  setPageSize(24);
                }}
                className={cn(
                  "px-2.5 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all",
                  viewMode === "cards"
                    ? "bg-background text-foreground shadow-2xs font-bold"
                    : "text-muted-foreground hover:text-foreground"
                )}
                title="Profile Cards Grid View"
              >
                <Icon icon="solar:card-2-bold-duotone" size={15} />
                <span>Cards View</span>
              </button>
            </div>
          </div>
        </div>

        {/* ─── Fast Preset Category Pills ─── */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          <button
            type="button"
            onClick={() => {
              updateFilter("status", "");
              updateFilter("practitioner_type", "");
              updateFilter("department", "");
            }}
            className={cn(
              "px-3 py-1 rounded-full text-xs font-semibold border shrink-0 transition-colors",
              !filters.status && !filters.practitioner_type && !filters.department
                ? "bg-foreground text-background border-foreground font-bold"
                : "bg-background text-muted-foreground border-border hover:bg-muted/50"
            )}
          >
            All Clinicians ({total})
          </button>

          <button
            type="button"
            onClick={() => updateFilter("status", filters.status === "Active" ? "" : "Active")}
            className={cn(
              "px-3 py-1 rounded-full text-xs font-semibold border shrink-0 transition-colors flex items-center gap-1.5",
              filters.status === "Active"
                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40 font-bold"
                : "bg-background text-muted-foreground border-border hover:bg-muted/50"
            )}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Active Only
          </button>
        </div>

        {/* ─── Expandable Extended Filters Card ─── */}
        {showFilters && (
          <Card className="border-dashed bg-muted/10 shadow-2xs">
            <CardContent className="pt-4 pb-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
                <div>
                  <Label className="text-xs font-semibold text-muted-foreground">EEU Staff ID</Label>
                  <Input
                    placeholder="Filter by EEU ID..."
                    value={filters.eeu_staff_id}
                    onChange={(e) => updateFilter("eeu_staff_id", e.target.value)}
                    className="mt-1 h-8 text-xs font-mono font-bold"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-muted-foreground">Mobile Phone</Label>
                  <Input
                    placeholder="Filter by phone..."
                    value={filters.mobile_phone}
                    onChange={(e) => updateFilter("mobile_phone", e.target.value)}
                    className="mt-1 h-8 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-muted-foreground">Email Address</Label>
                  <Input
                    placeholder="Filter by email..."
                    value={filters.email}
                    onChange={(e) => updateFilter("email", e.target.value)}
                    className="mt-1 h-8 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-muted-foreground">Gender</Label>
                  <select
                    className="mt-1 w-full h-8 border border-input rounded-md px-2.5 text-xs bg-background"
                    value={filters.gender}
                    onChange={(e) => updateFilter("gender", e.target.value)}
                  >
                    <option value="">Any Gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>
                <div>
                  <Label className="text-xs font-semibold text-muted-foreground">Registered Range</Label>
                  <div className="grid grid-cols-2 gap-1.5 mt-1">
                    <Input
                      type="date"
                      value={filters.created_from}
                      onChange={(e) => updateFilter("created_from", e.target.value)}
                      className="h-8 text-[11px] px-1.5"
                    />
                    <Input
                      type="date"
                      value={filters.created_to}
                      onChange={(e) => updateFilter("created_to", e.target.value)}
                      className="h-8 text-[11px] px-1.5"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ─── Active Filter Chips ─── */}
        {filterChips.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
            <span className="text-[11px] font-semibold text-muted-foreground">Filters active:</span>
            {filterChips.map((chip) => (
              <span
                key={chip.key}
                className="inline-flex items-center gap-1 bg-primary/10 text-primary border border-primary/25 text-xs rounded-full px-2.5 py-0.5 font-medium"
              >
                <span>{chip.label}:</span>
                <span className="font-bold">{chip.value}</span>
                <button
                  type="button"
                  onClick={() => removeFilter(chip.key)}
                  className="ml-0.5 hover:text-primary/70"
                >
                  <Icon icon="solar:close-circle-bold" size={13} />
                </button>
              </span>
            ))}
            <button
              type="button"
              onClick={clearAllFilters}
              className="text-xs text-muted-foreground hover:text-foreground underline ml-1"
            >
              Reset all
            </button>
          </div>
        )}
      </div>

      {/* ─── Content View: Modern Grid of Profile Cards OR Tabular View ─── */}
      {viewMode === "cards" ? (
        <div>
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {[...Array(8)].map((_, i) => (
                <div
                  key={i}
                  className="rounded-2xl border p-5 bg-card/50 space-y-4 animate-pulse"
                >
                  <div className="flex justify-between items-center">
                    <div className="h-5 w-24 bg-muted rounded-full" />
                    <div className="h-5 w-16 bg-muted rounded-full" />
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="h-14 w-14 rounded-full bg-muted shrink-0" />
                    <div className="space-y-2 flex-1">
                      <div className="h-4 w-3/4 bg-muted rounded" />
                      <div className="h-3 w-1/2 bg-muted rounded" />
                    </div>
                  </div>
                  <div className="h-14 bg-muted/60 rounded-xl" />
                  <div className="h-8 bg-muted rounded-xl" />
                </div>
              ))}
            </div>
          ) : data.length === 0 ? (
            <div className="rounded-2xl border border-dashed p-12 text-center bg-card/50 space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-muted/60 text-muted-foreground flex items-center justify-center mx-auto">
                <Icon icon="solar:user-cross-bold" size={28} />
              </div>
              <h3 className="font-bold text-base text-foreground">No Practitioners Found</h3>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                No healthcare practitioners match your search criteria. Try modifying your search query or clearing active filters.
              </p>
              <Button variant="outline" size="sm" onClick={clearAllFilters} className="text-xs mt-2">
                Clear Filters
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {data.map((r) => {
                const initials = `${r.first_name?.[0] || ""}${r.last_name?.[0] || ""}`;
                const style = getDepartmentStyle(r.department_name);
                const fullName = r.practitioner_name || `Dr. ${r.first_name} ${r.last_name}`;

                return (
                  <div
                    key={r.id}
                    onClick={() => navigate(`/healthcare/practitioners/${r.id}`)}
                    className="rounded-2xl border bg-card hover:bg-card/90 hover:border-primary/40 hover:shadow-md transition-all duration-200 p-5 flex flex-col justify-between group cursor-pointer relative"
                  >
                    <div>
                      {/* Top Header Ribbon */}
                      <div className="flex items-center justify-between gap-2 mb-3.5">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border truncate max-w-[170px]",
                            style.badge
                          )}
                          title={r.department_name || "General Medicine"}
                        >
                          <Icon icon={style.icon} size={12} className="shrink-0" />
                          <span className="truncate">{r.department_name || "General Medicine"}</span>
                        </span>

                        <div className="flex items-center gap-1.5">
                          <span
                            className={cn(
                              "text-[10px] font-bold px-2 py-0.5 rounded-full border",
                              r.status === "Active"
                                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                                : "bg-muted text-muted-foreground border-border"
                            )}
                          >
                            {r.status === "Active" ? "Active" : "Disabled"}
                          </span>
                        </div>
                      </div>

                      {/* Doctor Profile Center Block */}
                      <div className="flex items-start gap-3.5 mb-3.5">
                        <div className="relative shrink-0">
                          <Avatar
                            name={fullName}
                            initials={initials}
                            src={r.image}
                            size="doc"
                            tone="blue"
                            className="border-2 border-background shadow-xs group-hover:scale-105 transition-transform"
                          />
                          <span
                            className={cn(
                              "absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-background",
                              r.status === "Active" ? "bg-emerald-500" : "bg-muted-foreground/60"
                            )}
                            title={`Status: ${r.status}`}
                          />
                        </div>

                        <div className="min-w-0 flex-1">
                          <h3 className="font-extrabold text-sm text-foreground group-hover:text-primary transition-colors leading-tight line-clamp-1">
                            {fullName}
                          </h3>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                            {r.designation || "Healthcare Practitioner"}
                          </p>

                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            <span
                              onClick={(e) => handleCopyId(r.practitioner_id || `PRA-${r.id}`, e)}
                              className="font-mono text-[10px] text-muted-foreground bg-muted hover:bg-muted/80 px-1.5 py-0.5 rounded cursor-copy flex items-center gap-1"
                              title="Copy Practitioner ID"
                            >
                              {r.practitioner_id || `PRA-${r.id}`}
                              <Icon icon="solar:copy-bold" size={10} className="opacity-60" />
                            </span>

                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[9px] font-bold px-1.5 py-0.2",
                                r.practitioner_type === "Internal"
                                  ? "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/25"
                                  : "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/25"
                              )}
                            >
                              {r.practitioner_type === "Internal" ? "Internal" : "Visiting"}
                            </Badge>
                          </div>
                        </div>
                      </div>

                      {/* EEU Enterprise Staff Profile */}
                      <div className="p-3 rounded-xl bg-muted/30 border border-border/50 space-y-1.5 text-xs mb-3.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-muted-foreground block font-medium">
                            EEU Staff ID
                          </span>
                          <span className="font-mono font-bold text-xs text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded">
                            {r.eeu_staff_id || "EEU-PENDING"}
                          </span>
                        </div>
                        <div className="pt-1.5 border-t border-border/40 text-[10px] text-muted-foreground flex items-center justify-between">
                          <span>Enterprise Affiliation:</span>
                          <span className="font-semibold text-foreground">EEU Salaried Staff</span>
                        </div>
                      </div>

                      {/* Contact Details */}
                      <div className="space-y-1 text-xs mb-3">
                        {r.mobile_phone ? (
                          <a
                            href={`tel:${r.mobile_phone}`}
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-1.5 text-muted-foreground hover:text-emerald-600 transition-colors"
                          >
                            <Icon icon="solar:phone-bold" size={12} className="text-emerald-500 shrink-0" />
                            <span className="font-mono text-[11px] truncate">{r.mobile_phone}</span>
                          </a>
                        ) : (
                          <span className="text-muted-foreground/40 text-[11px] flex items-center gap-1.5">
                            <Icon icon="solar:phone-broken" size={12} />
                            No phone recorded
                          </span>
                        )}

                        {r.email && (
                          <a
                            href={`mailto:${r.email}`}
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-1.5 text-muted-foreground hover:text-blue-600 transition-colors truncate"
                          >
                            <Icon icon="solar:letter-bold" size={12} className="text-blue-500 shrink-0" />
                            <span className="text-[11px] truncate">{r.email}</span>
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Card Actions Footer */}
                    <div
                      className="pt-3 border-t border-border/60 flex items-center justify-between gap-1.5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/healthcare/practitioners/${r.id}`)}
                        className="h-8 text-xs flex-1 font-semibold"
                      >
                        Profile
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          navigate(
                            `/healthcare/practitioners/practitioner-schedule?practitioner=${r.id}`
                          )
                        }
                        className="h-8 text-xs px-2.5 text-muted-foreground hover:text-foreground"
                        title="View Schedule"
                      >
                        <Icon icon="solar:calendar-bold-duotone" size={14} />
                      </Button>

                      <Button
                        size="sm"
                        onClick={() =>
                          navigate(`/healthcare/appointments/new?practitioner=${r.id}`)
                        }
                        className="h-8 text-xs px-3 font-semibold bg-primary text-primary-foreground shadow-2xs gap-1"
                        title="Book Patient Appointment"
                      >
                        <Icon icon="solar:calendar-add-bold" size={13} />
                        Book
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Grid View Pagination */}
          {total > pageSize && (
            <div className="flex items-center justify-between pt-6 border-t">
              <span className="text-xs text-muted-foreground">
                Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, total)} of {total} clinicians
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="h-8 text-xs"
                >
                  Previous
                </Button>
                <span className="text-xs font-semibold px-2">
                  Page {page} of {Math.ceil(total / pageSize)}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page * pageSize >= total}
                  onClick={() => setPage((p) => p + 1)}
                  className="h-8 text-xs"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ─── Table View ─── */
        <Card className="shadow-xs border-border">
          <CardContent className="p-0">
            <Table
              columns={columns}
              dataSource={data}
              rowKey="id"
              loading={loading}
              pagination={{
                current: page,
                total,
                pageSize,
                onChange: (p, ps) => {
                  setPage(p);
                  setPageSize(ps);
                },
                showSizeChanger: true,
                pageSizeOptions: ["10", "20", "50", "100"],
              }}
              rowClassName="hover:bg-muted/20 cursor-pointer"
              onRow={(record) => ({
                onClick: () => navigate(`/healthcare/practitioners/${record.id}`),
              })}
            />
          </CardContent>
        </Card>
      )}

      {/* ─── Advanced Quick Onboarding Slide-Over (Sheet) ─── */}
      <Sheet open={showQuickEntry} onOpenChange={setShowQuickEntry}>
        <SheetContent side="right" className="w-[480px] sm:max-w-[480px] p-0 flex flex-col">
          <SheetHeader className="border-b px-6 py-4 bg-muted/20">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600">
                <Icon icon="solar:user-plus-bold-duotone" size={20} />
              </div>
              <div>
                <SheetTitle className="text-base font-bold">Quick Practitioner Intake</SheetTitle>
                <p className="text-xs text-muted-foreground">
                  Quickly onboard a clinician with departmental credentials
                </p>
              </div>
            </div>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
            {/* Identity */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                1. Provider Identity
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold">
                    First Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    className="mt-1 h-8 text-xs font-medium"
                    placeholder="e.g. Susan"
                    value={quickForm.first_name}
                    onChange={(e) => setQuickForm({ ...quickForm, first_name: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold">Last Name</Label>
                  <Input
                    className="mt-1 h-8 text-xs font-medium"
                    placeholder="e.g. Anderson"
                    value={quickForm.last_name}
                    onChange={(e) => setQuickForm({ ...quickForm, last_name: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold">Gender</Label>
                  <select
                    className="mt-1 w-full h-8 border border-input rounded-md px-2.5 text-xs bg-background"
                    value={quickForm.gender}
                    onChange={(e) => setQuickForm({ ...quickForm, gender: e.target.value })}
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>
                <div>
                  <Label className="text-xs font-semibold">Status</Label>
                  <select
                    className="mt-1 w-full h-8 border border-input rounded-md px-2.5 text-xs bg-background"
                    value={quickForm.status}
                    onChange={(e) => setQuickForm({ ...quickForm, status: e.target.value })}
                  >
                    <option value="Active">Active</option>
                    <option value="Disabled">Disabled</option>
                  </select>
                </div>
              </div>
            </div>

            <Separator />

            {/* Specialty & Department */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                2. Department & Privilege
              </h4>
              <div>
                <Label className="text-xs font-semibold">Medical Department</Label>
                <select
                  className="mt-1 w-full h-8 border border-input rounded-md px-2.5 text-xs bg-background"
                  value={quickForm.department}
                  onChange={(e) => setQuickForm({ ...quickForm, department: e.target.value })}
                >
                  <option value="">Select Medical Department</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.department}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold">Designation</Label>
                  <Input
                    className="mt-1 h-8 text-xs font-medium"
                    placeholder="e.g. Senior Consultant"
                    value={quickForm.designation}
                    onChange={(e) => setQuickForm({ ...quickForm, designation: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold">Affiliation Type</Label>
                  <select
                    className="mt-1 w-full h-8 border border-input rounded-md px-2.5 text-xs bg-background"
                    value={quickForm.practitioner_type}
                    onChange={(e) => setQuickForm({ ...quickForm, practitioner_type: e.target.value })}
                  >
                    <option value="Internal">Internal Staff</option>
                    <option value="External">Visiting Specialist</option>
                  </select>
                </div>
              </div>
            </div>

            <Separator />

            {/* EEU Employee Identification */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Icon icon="solar:shield-check-bold" size={14} className="text-primary" />
                3. EEU Employee Identification
              </h4>
              <div>
                <Label className="text-xs font-semibold">EEU Staff ID *</Label>
                <Input
                  placeholder="e.g. EEU-MD-0421"
                  className="mt-1 h-8 text-xs font-mono font-bold"
                  value={quickForm.eeu_staff_id || ""}
                  onChange={(e) =>
                    setQuickForm({
                      ...quickForm,
                      eeu_staff_id: e.target.value,
                    })
                  }
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  Practitioners & Specialists are salaried EEU personnel. No consultation tariffs or billing charges apply.
                </p>
              </div>
            </div>

            <Separator />

            {/* Contact Information */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                4. Contact Information
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold">Mobile Phone</Label>
                  <Input
                    className="mt-1 h-8 text-xs font-mono"
                    placeholder="+251 9..."
                    value={quickForm.mobile_phone}
                    onChange={(e) => setQuickForm({ ...quickForm, mobile_phone: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold">Work Email</Label>
                  <Input
                    className="mt-1 h-8 text-xs font-mono"
                    placeholder="doctor@hospital.org"
                    value={quickForm.email}
                    onChange={(e) => setQuickForm({ ...quickForm, email: e.target.value })}
                  />
                </div>
              </div>
            </div>
          </div>

          <SheetFooter className="border-t px-6 py-4 flex flex-row items-center justify-between bg-muted/10">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setShowQuickEntry(false);
                navigate("/healthcare/practitioners/new");
              }}
              className="text-xs"
            >
              Open Full Registration
            </Button>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowQuickEntry(false)}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                onClick={handleQuickSave}
                disabled={saving || !quickForm.first_name}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-5"
              >
                {saving ? "Registering..." : "Register Provider"}
              </Button>
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* ─── Delete Confirmation Dialog ─── */}
      <Dialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-destructive/10 text-destructive shrink-0">
                <Icon icon="solar:danger-triangle-bold" size={24} />
              </div>
              <div>
                <DialogTitle className="text-base font-bold">Delete Practitioner Record</DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Are you sure you want to remove this practitioner? This will delete the doctor's roster privileges.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0 mt-2">
            <Button variant="outline" size="sm" onClick={() => setDeleteId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={confirmDelete}
              disabled={deleting}
              className="gap-1 font-semibold"
            >
              {deleting ? "Deleting..." : "Confirm Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
