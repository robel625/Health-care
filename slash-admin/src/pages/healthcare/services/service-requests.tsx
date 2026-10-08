import { useState, useEffect, useCallback, useMemo } from "react";
import { Icon } from "@/components/icon";
import { Button } from "@/ui/button";
import { Card, CardContent } from "@/ui/card";
import { Input } from "@/ui/input";
import { Badge } from "@/ui/badge";
import { HealthcareApi } from "@/api/services/healthcareService";
import type { ServiceRequest, Patient } from "@/api/services/healthcareService";
import { useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";

const statusColor: Record<string, { bg: string; text: string; border: string }> = {
  Draft: { bg: "bg-slate-50 dark:bg-slate-900", text: "text-slate-700 dark:text-slate-300", border: "border-slate-300 dark:border-slate-700" },
  Active: { bg: "bg-blue-50 dark:bg-blue-950/60", text: "text-blue-800 dark:text-blue-200", border: "border-blue-300 dark:border-blue-800" },
  Completed: { bg: "bg-emerald-50 dark:bg-emerald-950/60", text: "text-emerald-800 dark:text-emerald-200", border: "border-emerald-300 dark:border-emerald-800" },
  Cancelled: { bg: "bg-rose-50 dark:bg-rose-950/60", text: "text-rose-700 dark:text-rose-300", border: "border-rose-300 dark:border-rose-800" },
  "On Hold": { bg: "bg-amber-50 dark:bg-amber-950/60", text: "text-amber-800 dark:text-amber-200", border: "border-amber-300 dark:border-amber-800" },
};

const priorityColor: Record<string, { bg: string; text: string; border: string; icon: string }> = {
  STAT: { bg: "bg-red-50 dark:bg-red-950/60", text: "text-red-800 dark:text-red-200", border: "border-red-300 dark:border-red-800", icon: "solar:danger-triangle-bold" },
  Urgent: { bg: "bg-amber-50 dark:bg-amber-950/60", text: "text-amber-800 dark:text-amber-200", border: "border-amber-300 dark:border-amber-800", icon: "solar:bell-bold" },
  ASAP: { bg: "bg-purple-50 dark:bg-purple-950/60", text: "text-purple-800 dark:text-purple-200", border: "border-purple-300 dark:border-purple-800", icon: "solar:clock-circle-bold" },
  Routine: { bg: "bg-blue-50 dark:bg-blue-950/60", text: "text-blue-700 dark:text-blue-300", border: "border-blue-200 dark:border-blue-800", icon: "solar:calendar-bold" },
};

export default function ServiceRequestsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const patientFilter = searchParams.get("patient");
  const practitionerFilter = searchParams.get("practitioner");

  const [data, setData] = useState<ServiceRequest[]>([]);
  const [patientObj, setPatientObj] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [categoryFilter, setCategoryFilter] = useState<string>("All");
  const [search, setSearch] = useState("");
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const filterParams: Record<string, any> = { page_size: 200 };
      if (patientFilter) filterParams.patient = patientFilter;
      if (practitionerFilter) filterParams.practitioner = practitionerFilter;

      const res = await HealthcareApi.serviceRequests.list(filterParams);
      setData(res.results || []);

      if (patientFilter) {
        try {
          const pat = await HealthcareApi.patients.get(Number(patientFilter));
          setPatientObj(pat);
        } catch {
          // ignore
        }
      }
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to load service requests");
    } finally {
      setLoading(false);
    }
  }, [patientFilter, practitionerFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleComplete = async (sr: ServiceRequest, e: React.MouseEvent) => {
    e.stopPropagation();
    setActionLoadingId(sr.id);
    try {
      await HealthcareApi.serviceRequests.complete(sr.id);
      toast.success(`Service request "${sr.title || sr.request_id}" completed.`);
      loadData();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to complete service request.");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleToggleHold = async (sr: ServiceRequest, e: React.MouseEvent) => {
    e.stopPropagation();
    setActionLoadingId(sr.id);
    try {
      if (sr.status === "On Hold") {
        await HealthcareApi.serviceRequests.activate(sr.id);
        toast.success(`Service request resumed to Active.`);
      } else {
        await HealthcareApi.serviceRequests.update(sr.id, { status: "On Hold" });
        toast.info(`Service request put On Hold.`);
      }
      loadData();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to update status.");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleCancel = async (sr: ServiceRequest, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Cancel service request "${sr.title || sr.request_id}"?`)) return;
    setActionLoadingId(sr.id);
    try {
      await HealthcareApi.serviceRequests.cancel(sr.id);
      toast.success(`Service request cancelled.`);
      loadData();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to cancel service request.");
    } finally {
      setActionLoadingId(null);
    }
  };

  // Downstream action launcher
  const handleDownstream = (sr: ServiceRequest, action: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const pid = sr.patient;
    const srid = sr.id;
    const templateName = sr.reference_name || sr.template_dn || sr.title || "";

    switch (action) {
      case "lab":
        navigate(`/healthcare/lab-tests/new?patient=${pid}&service_request=${srid}&template=${encodeURIComponent(templateName)}`);
        break;
      case "proc":
        navigate(`/healthcare/clinical-procedures/new?patient=${pid}&service_request=${srid}&procedure=${encodeURIComponent(templateName)}`);
        break;
      case "therapy":
        navigate(`/healthcare/therapy?patient=${pid}&service_request=${srid}`);
        break;
      case "sample":
        navigate(`/healthcare/sample-collections/new?patient=${pid}&service_request=${srid}`);
        break;
      case "appointment":
        navigate(`/healthcare/appointments?patient=${pid}&service_request=${srid}`);
        break;
    }
  };

  // KPI counts
  const totalCount = data.length;
  const activeCount = data.filter((r) => r.status === "Active").length;
  const completedCount = data.filter((r) => r.status === "Completed").length;
  const statCount = data.filter((r) => r.priority === "STAT" || r.priority === "Urgent").length;
  const onHoldCount = data.filter((r) => r.status === "On Hold").length;

  // Filtered rows
  const filteredData = useMemo(() => {
    return data.filter((r) => {
      // Status filter
      if (statusFilter === "Active" && r.status !== "Active") return false;
      if (statusFilter === "Completed" && r.status !== "Completed") return false;
      if (statusFilter === "On Hold" && r.status !== "On Hold") return false;
      if (statusFilter === "Draft" && r.status !== "Draft") return false;
      if (statusFilter === "Cancelled" && r.status !== "Cancelled") return false;
      if (statusFilter === "STAT" && r.priority !== "STAT" && r.priority !== "Urgent") return false;

      // Category filter
      if (categoryFilter !== "All") {
        const cat = (r.category_name || r.template_dt || "").toLowerCase();
        if (!cat.includes(categoryFilter.toLowerCase())) return false;
      }

      // Search
      if (search.trim()) {
        const q = search.toLowerCase();
        const matches =
          (r.title && r.title.toLowerCase().includes(q)) ||
          (r.request_id && r.request_id.toLowerCase().includes(q)) ||
          (r.patient_name && r.patient_name.toLowerCase().includes(q)) ||
          (r.reference_name && r.reference_name.toLowerCase().includes(q)) ||
          (r.department_name && r.department_name.toLowerCase().includes(q)) ||
          (r.practitioner_name && r.practitioner_name.toLowerCase().includes(q));
        if (!matches) return false;
      }

      return true;
    });
  }, [data, statusFilter, categoryFilter, search]);

  return (
    <div className="space-y-6 pb-20 max-w-7xl mx-auto">
      {/* ── Active Patient Filter Banner ─────────────────────────────────── */}
      {patientFilter && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 bg-indigo-50 border border-indigo-200 rounded-xl dark:bg-indigo-950/40 dark:border-indigo-900/60">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
              <Icon icon="solar:user-bold" size={18} />
            </div>
            <div>
              <div className="text-xs font-semibold text-indigo-900 dark:text-indigo-200 flex items-center gap-2">
                <span>Filter Active: {patientObj?.patient_name || `Patient #${patientFilter}`}</span>
                <Badge variant="outline" className="text-[10px] border-indigo-300">
                  MRN #{patientFilter}
                </Badge>
              </div>
              <div className="text-[11px] text-indigo-700/80 dark:text-indigo-300/80">
                Viewing all diagnostic requisitions, laboratory orders, and clinical procedures for this patient.
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/healthcare/patients/${patientFilter}`)}
              className="text-xs h-7 border-indigo-300 text-indigo-700 hover:bg-indigo-100 dark:hover:bg-indigo-900"
            >
              <Icon icon="solar:arrow-left-linear" size={12} className="mr-1" />
              Patient Dashboard
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/healthcare/service-requests")}
              className="text-xs h-7 text-indigo-700 hover:text-indigo-900"
            >
              View All Patients
            </Button>
          </div>
        </div>
      )}

      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Clinical Service Requests
            </h1>
            <Badge variant="outline" className="border-indigo-300 text-indigo-700 bg-indigo-50 dark:bg-indigo-950/40 font-semibold text-xs">
              Marley Engine
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Diagnostic requisitions, laboratory pathology tests, clinical procedures, and specialist consultations.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={() =>
              navigate(
                patientFilter
                  ? `/healthcare/service-requests/new?patient=${patientFilter}`
                  : "/healthcare/service-requests/new"
              )
            }
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs h-9 shadow-xs"
          >
            <Icon icon="solar:add-circle-bold" size={16} className="mr-1.5" />
            New Service Request
          </Button>
        </div>
      </div>

      {/* ── KPI Metric Summary Tiles ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div
          onClick={() => setStatusFilter("All")}
          className={`p-3 rounded-xl border cursor-pointer transition-all ${
            statusFilter === "All"
              ? "border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/30"
              : "border-border bg-card hover:bg-muted/40"
          }`}
        >
          <div className="text-[11px] font-semibold text-muted-foreground">Total Requisitions</div>
          <div className="text-xl font-bold text-foreground mt-0.5">{totalCount}</div>
        </div>

        <div
          onClick={() => setStatusFilter("Active")}
          className={`p-3 rounded-xl border cursor-pointer transition-all ${
            statusFilter === "Active"
              ? "border-blue-500 bg-blue-50/50 dark:bg-blue-950/30"
              : "border-border bg-card hover:bg-muted/40"
          }`}
        >
          <div className="text-[11px] font-semibold text-blue-600 dark:text-blue-400">Active / In Progress</div>
          <div className="text-xl font-bold text-blue-700 dark:text-blue-300 mt-0.5">{activeCount}</div>
        </div>

        <div
          onClick={() => setStatusFilter("STAT")}
          className={`p-3 rounded-xl border cursor-pointer transition-all ${
            statusFilter === "STAT"
              ? "border-rose-500 bg-rose-50/50 dark:bg-rose-950/30"
              : "border-border bg-card hover:bg-muted/40"
          }`}
        >
          <div className="text-[11px] font-semibold text-rose-600 flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-rose-600 animate-ping" /> STAT / Urgent
          </div>
          <div className="text-xl font-bold text-rose-700 dark:text-rose-400 mt-0.5">{statCount}</div>
        </div>

        <div
          onClick={() => setStatusFilter("On Hold")}
          className={`p-3 rounded-xl border cursor-pointer transition-all ${
            statusFilter === "On Hold"
              ? "border-amber-500 bg-amber-50/50 dark:bg-amber-950/30"
              : "border-border bg-card hover:bg-muted/40"
          }`}
        >
          <div className="text-[11px] font-semibold text-amber-600">On Hold</div>
          <div className="text-xl font-bold text-amber-700 dark:text-amber-400 mt-0.5">{onHoldCount}</div>
        </div>

        <div
          onClick={() => setStatusFilter("Completed")}
          className={`p-3 rounded-xl border cursor-pointer transition-all ${
            statusFilter === "Completed"
              ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30"
              : "border-border bg-card hover:bg-muted/40"
          }`}
        >
          <div className="text-[11px] font-semibold text-emerald-600">Completed</div>
          <div className="text-xl font-bold text-emerald-700 dark:text-emerald-400 mt-0.5">{completedCount}</div>
        </div>
      </div>

      {/* ── Sub-Filters & Search Bar ─────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Status Pills */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 no-scrollbar">
          {["All", "Active", "STAT", "On Hold", "Completed", "Draft", "Cancelled"].map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setStatusFilter(tab)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 cursor-pointer ${
                statusFilter === tab
                  ? "bg-foreground text-background font-semibold shadow-xs"
                  : "bg-muted/70 text-muted-foreground hover:bg-muted"
              }`}
            >
              {tab === "STAT" ? "🚨 STAT / Urgent" : tab}
            </button>
          ))}
        </div>

        {/* Search & Category Filter */}
        <div className="flex items-center gap-2 shrink-0">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="text-xs rounded-lg border border-input bg-background px-2.5 py-1.5 shadow-xs outline-none focus:border-indigo-500"
          >
            <option value="All">All Categories</option>
            <option value="Lab">Laboratory & Pathology</option>
            <option value="Radio">Radiology & Imaging</option>
            <option value="Proc">Clinical Procedure</option>
            <option value="Therap">Rehab & Therapy</option>
            <option value="Consult">Consultation</option>
          </select>

          <div className="relative w-48 sm:w-64">
            <Icon
              icon="solar:magnifer-linear"
              size={14}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search service, patient, ID..."
              className="h-8 text-xs pl-8"
            />
          </div>
        </div>
      </div>

      {/* ── Requisition Cards Grid ────────────────────────────────────────── */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-3">
          <Icon icon="solar:spinner-line-duotone" size={32} className="animate-spin text-indigo-600" />
          <div className="text-xs text-muted-foreground font-medium">Loading clinical service requests...</div>
        </div>
      ) : filteredData.length === 0 ? (
        <div className="text-center py-16 border rounded-2xl bg-card border-dashed">
          <Icon icon="solar:clipboard-remove-linear" size={44} className="text-muted-foreground mx-auto mb-2 opacity-50" />
          <h3 className="text-sm font-semibold text-foreground">No Service Requests Found</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            {search || statusFilter !== "All"
              ? "No requisitions match your active filters. Try clearing search or selecting a different status."
              : "No clinical requisitions have been recorded yet. Click below to create your first order."}
          </p>
          <div className="mt-4">
            <Button
              onClick={() =>
                navigate(
                  patientFilter
                    ? `/healthcare/service-requests/new?patient=${patientFilter}`
                    : "/healthcare/service-requests/new"
                )
              }
              size="sm"
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs"
            >
              <Icon icon="solar:add-circle-bold" size={14} className="mr-1.5" />
              New Service Request
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredData.map((sr) => {
            const sMeta = statusColor[sr.status] || {
              bg: "bg-slate-50",
              text: "text-slate-700",
              border: "border-slate-300",
            };
            const pMeta = priorityColor[sr.priority] || priorityColor.Routine;
            const isCardOverdue =
              sr.expected_date &&
              sr.status === "Active" &&
              new Date(sr.expected_date) < new Date(new Date().toISOString().slice(0, 10));

            const isLab =
              sr.reference_doctype === "Lab Test Template" ||
              sr.template_dt === "Lab Test Template" ||
              sr.category_name?.toLowerCase().includes("lab");

            const isProc =
              sr.reference_doctype === "Clinical Procedure Template" ||
              sr.template_dt === "Clinical Procedure Template" ||
              sr.category_name?.toLowerCase().includes("proc") ||
              sr.category_name?.toLowerCase().includes("radio");

            const isTh =
              sr.reference_doctype === "Therapy Type" ||
              sr.template_dt === "Therapy Type" ||
              sr.category_name?.toLowerCase().includes("therap");

            const isConsult =
              sr.reference_doctype === "Appointment Type" ||
              sr.template_dt === "Appointment Type" ||
              sr.category_name?.toLowerCase().includes("consult");

            return (
              <Card
                key={sr.id}
                onClick={() => navigate(`/healthcare/service-requests/${sr.id}`)}
                className={`transition-all hover:shadow-md cursor-pointer border text-left flex flex-col justify-between ${
                  sr.priority === "STAT"
                    ? "border-rose-400 dark:border-rose-800 bg-rose-50/10"
                    : "hover:border-indigo-300"
                }`}
              >
                <CardContent className="p-4 space-y-3">
                  {/* Top Bar: ID + Status + Priority */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] font-semibold text-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-800">
                      {sr.request_id || `HLC-SR-${sr.id}`}
                    </span>

                    <div className="flex items-center gap-1.5">
                      {/* Priority */}
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-bold border flex items-center gap-1 ${pMeta.bg} ${pMeta.text} ${pMeta.border}`}
                      >
                        <Icon icon={pMeta.icon} size={10} />
                        {sr.priority}
                        {sr.priority === "STAT" && (
                          <span className="h-1 w-1 rounded-full bg-rose-600 animate-ping" />
                        )}
                      </span>

                      {/* Status */}
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${sMeta.bg} ${sMeta.text} ${sMeta.border}`}
                      >
                        {sr.status}
                      </span>
                    </div>
                  </div>

                  {/* Service Title & DocType */}
                  <div>
                    <h4 className="text-sm font-bold text-foreground line-clamp-1">
                      {sr.title || sr.reference_name || "Clinical Requisition"}
                    </h4>
                    <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
                      <span className="font-medium text-foreground">
                        {sr.reference_doctype || sr.template_dt || "Service Request"}
                      </span>
                      {sr.category_name && (
                        <>
                          <span>•</span>
                          <span>{sr.category_name}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Patient Info */}
                  <div className="p-2 rounded-lg bg-muted/40 border text-xs flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-foreground">
                        {sr.patient_name || `Patient #${sr.patient}`}
                      </div>
                      <div className="text-[10px] text-muted-foreground">MRN #{sr.patient}</div>
                    </div>
                    {sr.practitioner_name && (
                      <div className="text-right text-[10px] text-muted-foreground">
                        <div>Dr. {sr.practitioner_name}</div>
                        {sr.department_name && <div>{sr.department_name}</div>}
                      </div>
                    )}
                  </div>

                  {/* Meta Indicators Strip */}
                  <div className="flex flex-wrap items-center gap-2 text-[10px]">
                    {sr.sample_collection_required && (
                      <Badge variant="outline" className="border-purple-300 text-purple-700 bg-purple-50 text-[10px] py-0 px-1.5">
                        <Icon icon="solar:test-tube-bold" size={10} className="mr-1" /> Sample Req.
                      </Badge>
                    )}
                    {isCardOverdue && (
                      <Badge variant="destructive" className="text-[10px] py-0 px-1.5">
                        OVERDUE
                      </Badge>
                    )}
                    <span className="text-muted-foreground ml-auto">
                      Date: {sr.order_date || sr.creation?.slice(0, 10)}
                    </span>
                  </div>

                  {/* Downstream Execution Shortcut */}
                  <div className="pt-2 border-t flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1">
                      {isLab && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => handleDownstream(sr, "lab", e)}
                          className="h-6 text-[10px] px-2 border-purple-300 text-purple-700 hover:bg-purple-50"
                        >
                          <Icon icon="solar:flask-bold" size={11} className="mr-1" />
                          Lab Test
                        </Button>
                      )}
                      {isProc && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => handleDownstream(sr, "proc", e)}
                          className="h-6 text-[10px] px-2 border-blue-300 text-blue-700 hover:bg-blue-50"
                        >
                          <Icon icon="solar:scalpel-bold" size={11} className="mr-1" />
                          Procedure
                        </Button>
                      )}
                      {isTh && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => handleDownstream(sr, "therapy", e)}
                          className="h-6 text-[10px] px-2 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                        >
                          <Icon icon="solar:dumbbell-small-bold" size={11} className="mr-1" />
                          Therapy
                        </Button>
                      )}
                      {isConsult && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => handleDownstream(sr, "appointment", e)}
                          className="h-6 text-[10px] px-2 border-indigo-300 text-indigo-700 hover:bg-indigo-50"
                        >
                          <Icon icon="solar:calendar-bold" size={11} className="mr-1" />
                          Book
                        </Button>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      {(sr.status === "Active" || sr.status === "Draft") && (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={actionLoadingId === sr.id}
                          onClick={(e) => handleComplete(sr, e)}
                          className="h-6 text-[10px] px-1.5 text-emerald-700 hover:bg-emerald-50"
                          title="Fulfill / Complete"
                        >
                          <Icon icon="solar:check-circle-bold" size={12} className="mr-0.5" />
                          Fulfill
                        </Button>
                      )}

                      {sr.status === "Active" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={actionLoadingId === sr.id}
                          onClick={(e) => handleToggleHold(sr, e)}
                          className="h-6 text-[10px] px-1.5 text-amber-700 hover:bg-amber-50"
                          title="Put on hold"
                        >
                          Hold
                        </Button>
                      )}

                      {sr.status === "On Hold" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={actionLoadingId === sr.id}
                          onClick={(e) => handleToggleHold(sr, e)}
                          className="h-6 text-[10px] px-1.5 text-blue-700 hover:bg-blue-50"
                          title="Resume"
                        >
                          Resume
                        </Button>
                      )}

                      {(sr.status === "Active" || sr.status === "Draft" || sr.status === "On Hold") && (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={actionLoadingId === sr.id}
                          onClick={(e) => handleCancel(sr, e)}
                          className="h-6 text-[10px] px-1.5 text-rose-600 hover:bg-rose-50"
                          title="Cancel service request"
                        >
                          <Icon icon="solar:close-circle-bold" size={12} />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
