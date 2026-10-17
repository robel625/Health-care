import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/ui/dialog";
import { Button } from "@/ui/button";
import { Icon } from "@/components/icon";
import { Badge } from "@/ui/badge";
import { toast } from "sonner";
import { useNavigate } from "react-router";
import { HealthcareApi, type ServiceRequest } from "@/api/services/healthcareService";
import NewServiceRequestModal, { MARLEY_TEMPLATE_TYPES } from "./NewServiceRequestModal";

export interface PatientServiceRequestsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId?: number;
  patientName?: string;
  requests?: ServiceRequest[];
  onNewRequest?: () => void;
  onRefresh: () => void;
}

const statusBadge: Record<string, { bg: string; text: string; border: string; icon: string }> = {
  Draft: { bg: "bg-slate-50 dark:bg-slate-900", text: "text-slate-700 dark:text-slate-300", border: "border-slate-300 dark:border-slate-700", icon: "solar:pen-bold" },
  Active: { bg: "bg-blue-50 dark:bg-blue-950/60", text: "text-blue-700 dark:text-blue-300", border: "border-blue-300 dark:border-blue-800", icon: "solar:play-circle-bold" },
  Completed: { bg: "bg-emerald-50 dark:bg-emerald-950/60", text: "text-emerald-700 dark:text-emerald-300", border: "border-emerald-300 dark:border-emerald-800", icon: "solar:check-circle-bold" },
  Cancelled: { bg: "bg-rose-50 dark:bg-rose-950/60", text: "text-rose-700 dark:text-rose-300", border: "border-rose-300 dark:border-rose-800", icon: "solar:close-circle-bold" },
  "On Hold": { bg: "bg-amber-50 dark:bg-amber-950/60", text: "text-amber-700 dark:text-amber-300", border: "border-amber-300 dark:border-amber-800", icon: "solar:pause-circle-bold" },
};

const priorityBadge: Record<string, { bg: string; text: string; border: string; icon: string }> = {
  STAT: { bg: "bg-rose-50 dark:bg-rose-950/70", text: "text-rose-700 dark:text-rose-300", border: "border-rose-300 dark:border-rose-800", icon: "solar:danger-triangle-bold" },
  Urgent: { bg: "bg-amber-50 dark:bg-amber-950/70", text: "text-amber-700 dark:text-amber-300", border: "border-amber-300 dark:border-amber-800", icon: "solar:bell-bold" },
  ASAP: { bg: "bg-purple-50 dark:bg-purple-950/70", text: "text-purple-700 dark:text-purple-300", border: "border-purple-300 dark:border-purple-800", icon: "solar:clock-circle-bold" },
  Routine: { bg: "bg-blue-50 dark:bg-blue-950/70", text: "text-blue-700 dark:text-blue-300", border: "border-blue-200 dark:border-blue-800", icon: "solar:calendar-bold" },
};

export default function PatientServiceRequestsModal({
  open,
  onOpenChange,
  patientId = 0,
  patientName = "Patient",
  requests = [],
  onNewRequest,
  onRefresh,
}: PatientServiceRequestsModalProps) {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [categoryFilter, setCategoryFilter] = useState<string>("All");
  const [search, setSearch] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);

  // Filter requests
  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      if (statusFilter !== "All" && r.status !== statusFilter) return false;
      if (categoryFilter !== "All") {
        const cat = (r.category_name || r.template_dt || "").toLowerCase();
        if (!cat.includes(categoryFilter.toLowerCase())) return false;
      }
      if (search) {
        const s = search.toLowerCase();
        const matchesTitle = (r.title || "").toLowerCase().includes(s);
        const matchesId = (r.request_id || "").toLowerCase().includes(s);
        const matchesCat = (r.category_name || "").toLowerCase().includes(s);
        const matchesDoctor = (r.practitioner_name || "").toLowerCase().includes(s);
        const matchesNotes = (r.notes || "").toLowerCase().includes(s);
        if (!matchesTitle && !matchesId && !matchesCat && !matchesDoctor && !matchesNotes) return false;
      }
      return true;
    });
  }, [requests, statusFilter, categoryFilter, search]);

  const totalCount = requests.length;
  const activeCount = requests.filter((r) => r.status === "Active").length;
  const completedCount = requests.filter((r) => r.status === "Completed").length;
  const statCount = requests.filter((r) => r.priority === "STAT" || r.priority === "Urgent").length;
  const onHoldCount = requests.filter((r) => r.status === "On Hold").length;

  const handleComplete = async (sr: ServiceRequest) => {
    setActionLoadingId(sr.id);
    try {
      await HealthcareApi.serviceRequests.complete(sr.id);
      toast.success(`Service request "${sr.title || sr.request_id}" marked as completed.`);
      onRefresh();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to complete service request.");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleToggleHold = async (sr: ServiceRequest) => {
    setActionLoadingId(sr.id);
    const newStatus = sr.status === "On Hold" ? "Active" : "On Hold";
    try {
      if (newStatus === "Active") {
        await HealthcareApi.serviceRequests.activate(sr.id);
      } else {
        await HealthcareApi.serviceRequests.update(sr.id, { status: "On Hold" });
      }
      toast.success(`Service request set to ${newStatus}.`);
      onRefresh();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to update service request status.");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleCancel = async (sr: ServiceRequest) => {
    if (!confirm(`Cancel service request "${sr.title || sr.request_id}"?`)) return;
    setActionLoadingId(sr.id);
    try {
      await HealthcareApi.serviceRequests.cancel(sr.id);
      toast.success(`Service request cancelled.`);
      onRefresh();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to cancel service request.");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this service request?")) return;
    setActionLoadingId(id);
    try {
      await HealthcareApi.serviceRequests.delete(id);
      toast.success("Service request deleted.");
      onRefresh();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to delete service request.");
    } finally {
      setActionLoadingId(null);
    }
  };

  // Launch downstream document workflow (Marley Parity)
  const handleLaunchDownstream = (sr: ServiceRequest, actionType: "lab" | "procedure" | "sample" | "appointment") => {
    onOpenChange(false);
    if (actionType === "lab") {
      navigate(`/healthcare/lab-tests/new?patient=${patientId}&service_request=${sr.id}&template=${encodeURIComponent(sr.reference_name || sr.title || "")}`);
    } else if (actionType === "procedure") {
      navigate(`/healthcare/clinical-procedures/new?patient=${patientId}&service_request=${sr.id}&procedure=${encodeURIComponent(sr.reference_name || sr.title || "")}`);
    } else if (actionType === "sample") {
      navigate(`/healthcare/sample-collections/new?patient=${patientId}&service_request=${sr.id}`);
    } else if (actionType === "appointment") {
      navigate(`/healthcare/appointments/new?patient=${patientId}&service_request=${sr.id}`);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col p-0 overflow-hidden">
          {/* Header */}
          <DialogHeader className="p-6 pb-4 border-b shrink-0 bg-muted/20">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0 shadow-2xs">
                  <Icon icon="solar:clipboard-check-bold-duotone" size={22} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <DialogTitle className="text-lg font-bold">Clinical Service Requests</DialogTitle>
                    <Badge variant="outline" className="text-xs font-semibold border-indigo-300 text-indigo-700 dark:text-indigo-300">
                      {patientName}
                    </Badge>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-muted text-muted-foreground">
                      Marley Parity
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Manage physician diagnostic orders, laboratory investigations, radiology imaging, clinical procedures, and therapy requisitions.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => (onNewRequest ? onNewRequest() : setShowCreateModal(true))}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-2xs text-xs font-semibold"
                >
                  <Icon icon="solar:add-circle-bold" size={15} className="mr-1.5" />
                  New Service Request
                </Button>
              </div>
            </div>

            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 mt-4">
              <div className="p-2.5 rounded-xl border bg-card text-center shadow-2xs">
                <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Total Orders</p>
                <p className="text-lg font-bold text-foreground mt-0.5">{totalCount}</p>
              </div>
              <div className="p-2.5 rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/30 text-center shadow-2xs">
                <p className="text-[10px] text-blue-700 dark:text-blue-300 font-semibold uppercase tracking-wider">Active / Pending</p>
                <p className="text-lg font-bold text-blue-800 dark:text-blue-200 mt-0.5">{activeCount}</p>
              </div>
              <div className="p-2.5 rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50/50 dark:bg-rose-950/30 text-center shadow-2xs">
                <p className="text-[10px] text-rose-700 dark:text-rose-300 font-semibold uppercase tracking-wider">STAT / Urgent</p>
                <p className="text-lg font-bold text-rose-800 dark:text-rose-200 mt-0.5 flex items-center justify-center gap-1">
                  {statCount > 0 && <span className="w-2 h-2 rounded-full bg-rose-600 animate-ping inline-block" />}
                  {statCount}
                </p>
              </div>
              <div className="p-2.5 rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/30 text-center shadow-2xs">
                <p className="text-[10px] text-amber-700 dark:text-amber-300 font-semibold uppercase tracking-wider">On Hold</p>
                <p className="text-lg font-bold text-amber-800 dark:text-amber-200 mt-0.5">{onHoldCount}</p>
              </div>
              <div className="p-2.5 rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50/50 dark:bg-emerald-950/30 text-center shadow-2xs col-span-2 sm:col-span-1">
                <p className="text-[10px] text-emerald-700 dark:text-emerald-300 font-semibold uppercase tracking-wider">Completed</p>
                <p className="text-lg font-bold text-emerald-800 dark:text-emerald-200 mt-0.5">{completedCount}</p>
              </div>
            </div>
          </DialogHeader>

          {/* Filters & Search Toolbar */}
          <div className="p-4 border-b bg-background flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
            {/* Status Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
              {["All", "Active", "Draft", "On Hold", "Completed", "Cancelled"].map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`text-xs px-3 py-1 rounded-lg font-semibold transition-all ${
                    statusFilter === st
                      ? "bg-indigo-600 text-white shadow-2xs"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>

            {/* Category Pills & Search */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                className="text-xs h-8 px-2 rounded-md border border-input bg-background shadow-xs font-medium"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                <option value="All">All Categories</option>
                <option value="Laboratory">Laboratory</option>
                <option value="Radiology">Radiology & Scans</option>
                <option value="Procedure">Procedures</option>
                <option value="Consultation">Consultations</option>
              </select>

              <div className="w-full sm:w-56">
                <input
                  type="text"
                  placeholder="Search orders, doctor, reason..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full text-xs h-8 px-2.5 rounded-md border border-input bg-background shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
            </div>
          </div>

          {/* Service Requests List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {filteredRequests.length > 0 ? (
              filteredRequests.map((sr) => {
                const sMeta = statusBadge[sr.status] || statusBadge.Draft;
                const pMeta = priorityBadge[sr.priority] || priorityBadge.Routine;
                const isLoading = actionLoadingId === sr.id;

                const templateConfig = MARLEY_TEMPLATE_TYPES.find(
                  (m) => m.dt === (sr.reference_doctype || sr.template_dt)
                );

                const isLab = (sr.reference_doctype === "Lab Test Template" || sr.template_dt === "Lab Test Template" || (sr.category_name || "").toLowerCase().includes("lab"));
                const isProcedure = (sr.reference_doctype === "Clinical Procedure Template" || sr.template_dt === "Clinical Procedure Template" || (sr.category_name || "").toLowerCase().includes("procedure"));
                const hasSampleReq = sr.notes?.includes("[Sample Required]") || isLab;

                const isStat = sr.priority === "STAT";

                return (
                  <div
                    key={sr.id}
                    className={`rounded-xl border p-4 bg-card hover:border-indigo-300/80 transition-all shadow-2xs space-y-3 ${
                      isStat ? "ring-1 ring-rose-500/30 border-rose-300/60" : ""
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2.5">
                      <div className="flex items-start gap-3">
                        <div
                          className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 mt-0.5 ${
                            templateConfig ? templateConfig.accent : "bg-indigo-50 border-indigo-200 text-indigo-600"
                          }`}
                        >
                          <Icon icon={templateConfig ? templateConfig.icon : "solar:clipboard-check-bold"} size={18} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm text-foreground">
                              {sr.title || `Service Request #${sr.id}`}
                            </span>

                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(sr.request_id || String(sr.id));
                                toast.success(`Copied ID: ${sr.request_id || sr.id}`);
                              }}
                              className="font-mono text-[10px] text-muted-foreground hover:text-foreground font-semibold px-1.5 py-0.5 rounded bg-muted/60 flex items-center gap-1"
                              title="Click to copy ID"
                            >
                              <span>{sr.request_id || `HLC-SR-${sr.id}`}</span>
                              <Icon icon="solar:copy-linear" size={10} />
                            </button>

                            {sr.reference_doctype && (
                              <Badge variant="outline" className="text-[10px] font-mono py-0 text-muted-foreground">
                                {sr.reference_doctype}
                              </Badge>
                            )}

                            {hasSampleReq && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                                <Icon icon="solar:test-tube-bold" size={10} />
                                Sample Required
                              </span>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mt-1.5">
                            {sr.category_name && (
                              <span className="px-2 py-0.5 rounded-md bg-muted text-foreground font-medium text-[11px]">
                                {sr.category_name}
                              </span>
                            )}
                            {sr.department_name && (
                              <span>• Dept: <span className="font-medium text-foreground">{sr.department_name}</span></span>
                            )}
                            {sr.practitioner_name && (
                              <span>• Dr. <span className="font-medium text-foreground">{sr.practitioner_name}</span></span>
                            )}
                            <span>• Ordered: {sr.order_date || sr.creation?.slice(0, 10)}</span>
                            {sr.expected_date && (
                              <span className="text-indigo-600 dark:text-indigo-400 font-semibold">
                                • Due: {sr.expected_date}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Status, Priority & Quick Workflow Actions */}
                      <div className="flex items-center gap-2 self-end sm:self-start shrink-0 flex-wrap">
                        {/* Priority Pill */}
                        <span
                          className={`text-[11px] px-2.5 py-0.5 rounded-full font-bold border flex items-center gap-1 ${pMeta.bg} ${pMeta.text} ${pMeta.border}`}
                        >
                          <Icon icon={pMeta.icon} size={12} className={isStat ? "animate-pulse" : ""} />
                          {sr.priority}
                        </span>

                        {/* Status Pill */}
                        <span
                          className={`text-[11px] px-2.5 py-0.5 rounded-full font-semibold border flex items-center gap-1 ${sMeta.bg} ${sMeta.text} ${sMeta.border}`}
                        >
                          <Icon icon={sMeta.icon} size={11} />
                          {sr.status}
                        </span>
                      </div>
                    </div>

                    {/* Clinical Indication / Notes */}
                    {sr.notes && (
                      <div className="p-2.5 rounded-lg bg-muted/30 border border-border/70 text-xs text-muted-foreground space-y-1">
                        <div className="font-semibold text-foreground flex items-center gap-1.5">
                          <Icon icon="solar:notes-bold" size={13} className="text-indigo-500" />
                          <span>Clinical Indication & Instructions:</span>
                        </div>
                        <p className="whitespace-pre-line leading-relaxed text-foreground/90 pl-5">
                          {sr.notes}
                        </p>
                      </div>
                    )}

                    {/* Bottom Action Bar (Marley Parity) */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 border-t border-border/50 text-xs">
                      {/* Downstream Document Generator Buttons */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[11px] text-muted-foreground font-semibold mr-1">
                          Downstream Actions:
                        </span>

                        {isLab && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleLaunchDownstream(sr, "lab")}
                            className="h-7 text-xs border-purple-200 text-purple-700 hover:bg-purple-50 dark:border-purple-800 dark:text-purple-300 font-semibold"
                          >
                            <Icon icon="solar:flask-bold" size={12} className="mr-1" />
                            Create Lab Test
                          </Button>
                        )}

                        {isProcedure && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleLaunchDownstream(sr, "procedure")}
                            className="h-7 text-xs border-blue-200 text-blue-700 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-300 font-semibold"
                          >
                            <Icon icon="solar:scalpel-bold" size={12} className="mr-1" />
                            Create Procedure
                          </Button>
                        )}



                        {hasSampleReq && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleLaunchDownstream(sr, "sample")}
                            className="h-7 text-xs border-amber-200 text-amber-700 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-300 font-semibold"
                          >
                            <Icon icon="solar:test-tube-bold" size={12} className="mr-1" />
                            Collect Specimen
                          </Button>
                        )}

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleLaunchDownstream(sr, "appointment")}
                          className="h-7 text-xs text-muted-foreground hover:text-foreground"
                        >
                          Book Visit
                        </Button>
                      </div>

                      {/* State Workflow Transition Buttons */}
                      <div className="flex items-center gap-1.5 self-end sm:self-auto">
                        {(sr.status === "Active" || sr.status === "Draft") && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={isLoading}
                              className="h-7 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300 font-semibold"
                              onClick={() => handleComplete(sr)}
                              title="Mark order as completed"
                            >
                              <Icon icon="solar:check-circle-bold" size={13} className="mr-1" />
                              Fulfill Order
                            </Button>

                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={isLoading}
                              className="h-7 text-xs text-amber-700 hover:bg-amber-50"
                              onClick={() => handleToggleHold(sr)}
                              title="Place order on hold"
                            >
                              <Icon icon="solar:pause-circle-bold" size={13} className="mr-1" />
                              Hold
                            </Button>

                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={isLoading}
                              className="h-7 text-xs text-rose-600 hover:bg-rose-50"
                              onClick={() => handleCancel(sr)}
                              title="Cancel request"
                            >
                              Cancel
                            </Button>
                          </>
                        )}

                        {sr.status === "On Hold" && (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={isLoading}
                            className="h-7 text-xs border-blue-300 text-blue-700 hover:bg-blue-50 font-semibold"
                            onClick={() => handleToggleHold(sr)}
                            title="Resume active order"
                          >
                            <Icon icon="solar:play-circle-bold" size={13} className="mr-1" />
                            Resume
                          </Button>
                        )}

                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={isLoading}
                          className="h-7 w-7 text-muted-foreground hover:text-red-600"
                          onClick={() => handleDelete(sr.id)}
                          title="Delete request"
                        >
                          <Icon icon="solar:trash-bin-trash-bold" size={14} />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="py-14 text-center text-muted-foreground">
                <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-500 flex items-center justify-center mx-auto mb-3 border border-indigo-200 dark:border-indigo-800">
                  <Icon icon="solar:clipboard-check-bold-duotone" size={32} />
                </div>
                <p className="text-sm font-bold text-foreground">No service requests found</p>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1">
                  {statusFilter !== "All" || categoryFilter !== "All" || search
                    ? "No clinical orders match the current filter or search criteria. Try resetting filters."
                    : "No service requisitions recorded yet. Click below to place a diagnostic, lab, procedure, or therapy order."}
                </p>
                <Button
                  size="sm"
                  onClick={() => setShowCreateModal(true)}
                  className="mt-4 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  <Icon icon="solar:add-circle-bold" size={14} className="mr-1.5" />
                  Order Service Request
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Embedded New Service Request Modal */}
      <NewServiceRequestModal
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
        defaultPatientId={patientId}
        defaultPatientName={patientName}
        onSuccess={() => {
          onRefresh();
        }}
      />
    </>
  );
}
