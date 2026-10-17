import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router";
import { Icon } from "@/components/icon";
import { Button } from "@/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/ui/card";
import { Badge } from "@/ui/badge";
import { toast } from "sonner";
import {
  HealthcareApi,
  type ServiceRequest,
  type Patient,
} from "@/api/services/healthcareService";
import { formatAge } from "@/utils/age";
import { getInitials } from "@/utils";

const statusColor: Record<string, { bg: string; text: string; border: string; icon: string }> = {
  Draft: { bg: "bg-slate-50 dark:bg-slate-900", text: "text-slate-700 dark:text-slate-300", border: "border-slate-300 dark:border-slate-700", icon: "solar:pen-new-square-bold" },
  Active: { bg: "bg-blue-50 dark:bg-blue-950/60", text: "text-blue-800 dark:text-blue-200", border: "border-blue-300 dark:border-blue-800", icon: "solar:play-circle-bold" },
  Completed: { bg: "bg-emerald-50 dark:bg-emerald-950/60", text: "text-emerald-800 dark:text-emerald-200", border: "border-emerald-300 dark:border-emerald-800", icon: "solar:check-circle-bold" },
  Cancelled: { bg: "bg-rose-50 dark:bg-rose-950/60", text: "text-rose-700 dark:text-rose-300", border: "border-rose-300 dark:border-rose-800", icon: "solar:close-circle-bold" },
  "On Hold": { bg: "bg-amber-50 dark:bg-amber-950/60", text: "text-amber-800 dark:text-amber-200", border: "border-amber-300 dark:border-amber-800", icon: "solar:pause-circle-bold" },
};

const priorityColor: Record<string, { bg: string; text: string; border: string; icon: string }> = {
  STAT: { bg: "bg-red-50 dark:bg-red-950/60", text: "text-red-800 dark:text-red-200", border: "border-red-300 dark:border-red-800", icon: "solar:danger-triangle-bold" },
  Urgent: { bg: "bg-amber-50 dark:bg-amber-950/60", text: "text-amber-800 dark:text-amber-200", border: "border-amber-300 dark:border-amber-800", icon: "solar:bell-bold" },
  ASAP: { bg: "bg-purple-50 dark:bg-purple-950/60", text: "text-purple-800 dark:text-purple-200", border: "border-purple-300 dark:border-purple-800", icon: "solar:clock-circle-bold" },
  Routine: { bg: "bg-blue-50 dark:bg-blue-950/60", text: "text-blue-700 dark:text-blue-300", border: "border-blue-200 dark:border-blue-800", icon: "solar:calendar-bold" },
};

export default function ServiceRequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [request, setRequest] = useState<ServiceRequest | null>(null);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const loadData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const sr = await HealthcareApi.serviceRequests.get(Number(id));
      setRequest(sr);

      if (sr.patient) {
        try {
          const pat = await HealthcareApi.patients.get(sr.patient);
          setPatient(pat);
        } catch {
          // Non-fatal if patient details cannot be loaded
        }
      }
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to load service request details.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Complete / Fulfill Action
  const handleComplete = async () => {
    if (!request) return;
    setActionLoading(true);
    try {
      await HealthcareApi.serviceRequests.complete(request.id);
      toast.success(`Service request ${request.request_id || ""} completed.`);
      loadData();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to complete service request.");
    } finally {
      setActionLoading(false);
    }
  };

  // Toggle Hold / Resume
  const handleToggleHold = async () => {
    if (!request) return;
    setActionLoading(true);
    try {
      if (request.status === "On Hold") {
        await HealthcareApi.serviceRequests.activate(request.id);
        toast.success(`Service request resumed to Active.`);
      } else {
        await HealthcareApi.serviceRequests.update(request.id, { status: "On Hold" });
        toast.info(`Service request put On Hold.`);
      }
      loadData();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to update status.");
    } finally {
      setActionLoading(false);
    }
  };

  // Cancel Request
  const handleCancel = async () => {
    if (!request) return;
    if (!confirm(`Are you sure you want to cancel service request "${request.title || request.request_id}"?`)) return;
    setActionLoading(true);
    try {
      await HealthcareApi.serviceRequests.cancel(request.id);
      toast.success(`Service request cancelled.`);
      loadData();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to cancel service request.");
    } finally {
      setActionLoading(false);
    }
  };

  // Downstream Action Launcher
  const handleDownstreamAction = (actionType: string) => {
    if (!request) return;
    const pid = request.patient;
    const srid = request.id;
    const templateName = request.reference_name || request.template_dn || request.title || "";

    switch (actionType) {
      case "lab_test":
        navigate(`/healthcare/lab-tests/new?patient=${pid}&service_request=${srid}&template=${encodeURIComponent(templateName)}`);
        break;
      case "procedure":
        navigate(`/healthcare/clinical-procedures/new?patient=${pid}&service_request=${srid}&procedure=${encodeURIComponent(templateName)}`);
        break;
      case "sample":
        navigate(`/healthcare/sample-collections/new?patient=${pid}&service_request=${srid}`);
        break;
      case "appointment":
        navigate(`/healthcare/appointments?patient=${pid}&service_request=${srid}`);
        break;
      default:
        toast.info(`Downstream workflow initiated for ${templateName}`);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[450px] space-y-3">
        <Icon icon="solar:spinner-line-duotone" size={36} className="animate-spin text-indigo-600" />
        <div className="text-sm font-medium text-muted-foreground">Loading Clinical Requisition...</div>
      </div>
    );
  }

  if (!request) {
    return (
      <div className="text-center py-16 space-y-4">
        <Icon icon="solar:danger-circle-bold" size={48} className="text-rose-500 mx-auto" />
        <h2 className="text-xl font-bold">Service Request Not Found</h2>
        <p className="text-sm text-muted-foreground">The requested requisition does not exist or was deleted.</p>
        <Button onClick={() => navigate("/healthcare/service-requests")} variant="outline">
          Return to Service Requests
        </Button>
      </div>
    );
  }

  const sMeta = statusColor[request.status] || {
    bg: "bg-slate-50",
    text: "text-slate-700",
    border: "border-slate-300",
    icon: "solar:notes-bold",
  };

  const pMeta = priorityColor[request.priority] || priorityColor.Routine;
  const isOverdue =
    request.expected_date &&
    request.status === "Active" &&
    new Date(request.expected_date) < new Date(new Date().toISOString().slice(0, 10));

  const isLab =
    request.reference_doctype === "Lab Test Template" ||
    request.template_dt === "Lab Test Template" ||
    request.category_name?.toLowerCase().includes("lab");

  const isProcedure =
    request.reference_doctype === "Clinical Procedure Template" ||
    request.template_dt === "Clinical Procedure Template" ||
    request.category_name?.toLowerCase().includes("proc") ||
    request.category_name?.toLowerCase().includes("radio");

  const isConsult =
    request.reference_doctype === "Appointment Type" ||
    request.template_dt === "Appointment Type" ||
    request.category_name?.toLowerCase().includes("consult");

  return (
    <div className="space-y-6 pb-20 max-w-7xl mx-auto">
      {/* ── Breadcrumb & Top Bar ──────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <Link to="/healthcare" className="hover:text-foreground transition-colors">
              Healthcare
            </Link>
            <Icon icon="solar:alt-arrow-right-linear" size={12} />
            <Link to="/healthcare/service-requests" className="hover:text-foreground transition-colors">
              Service Requests
            </Link>
            <Icon icon="solar:alt-arrow-right-linear" size={12} />
            <span className="text-foreground font-mono font-medium">
              {request.request_id || `HLC-SR-${request.id}`}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {request.title || request.reference_name || "Clinical Service Request"}
            </h1>
            <span className="font-mono text-xs px-2.5 py-0.5 rounded-md bg-muted text-muted-foreground font-semibold">
              {request.request_id || `HLC-SR-${request.id}`}
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
            <span>Ordered on {request.order_date || request.creation?.slice(0, 10)}</span>
            {request.practitioner_name && (
              <>
                <span>•</span>
                <span>Dr. {request.practitioner_name}</span>
              </>
            )}
            {request.department_name && (
              <>
                <span>•</span>
                <span>Dept: {request.department_name}</span>
              </>
            )}
          </div>
        </div>

        {/* Status Badges & Quick Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Priority Badge */}
          <span
            className={`text-xs px-2.5 py-1 rounded-full font-semibold border flex items-center gap-1.5 ${pMeta.bg} ${pMeta.text} ${pMeta.border}`}
          >
            <Icon icon={pMeta.icon} size={13} />
            {request.priority}
            {request.priority === "STAT" && (
              <span className="h-1.5 w-1.5 rounded-full bg-rose-600 animate-ping" />
            )}
          </span>

          {/* Status Badge */}
          <span
            className={`text-xs px-3 py-1 rounded-full font-semibold border flex items-center gap-1.5 ${sMeta.bg} ${sMeta.text} ${sMeta.border}`}
          >
            <Icon icon={sMeta.icon} size={13} />
            {request.status}
          </span>

          {/* Print Slip Button */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => window.print()}
            className="text-xs h-8 ml-2 print:hidden"
          >
            <Icon icon="solar:printer-bold" size={14} className="mr-1.5" />
            Print Slip
          </Button>

          {/* New Requisition Button */}
          <Button
            type="button"
            size="sm"
            onClick={() =>
              navigate(
                request.patient
                  ? `/healthcare/service-requests/new?patient=${request.patient}`
                  : "/healthcare/service-requests/new"
              )
            }
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-8 shadow-xs print:hidden"
          >
            <Icon icon="solar:add-circle-bold" size={14} className="mr-1.5" />
            New Request
          </Button>
        </div>
      </div>

      {/* ── Downstream Action Banner (Marley Parity) ──────────────────────── */}
      {request.status !== "Cancelled" && (
        <Card className="border-indigo-200 bg-linear-to-r from-indigo-50/70 via-background to-background dark:border-indigo-900/50 shadow-xs">
          <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-indigo-600 text-white shadow-xs shrink-0">
                <Icon icon="solar:bolt-bold-duotone" size={22} />
              </div>
              <div>
                <div className="text-xs font-bold text-foreground flex items-center gap-2">
                  <span>Downstream Fulfillment Automation</span>
                  <Badge variant="outline" className="text-[10px] text-indigo-700 border-indigo-300">
                    Marley Engine
                  </Badge>
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  Launch connected clinical transactions with pre-populated patient and requisition data.
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {isLab && (
                <Button
                  size="sm"
                  onClick={() => handleDownstreamAction("lab_test")}
                  className="bg-purple-600 hover:bg-purple-700 text-white text-xs h-8 gap-1.5 shadow-xs"
                >
                  <Icon icon="solar:flask-bold" size={14} />
                  Create Lab Test
                </Button>
              )}

              {isProcedure && (
                <Button
                  size="sm"
                  onClick={() => handleDownstreamAction("procedure")}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-8 gap-1.5 shadow-xs"
                >
                  <Icon icon="solar:scalpel-bold" size={14} />
                  Create Procedure
                </Button>
              )}



              {isConsult && (
                <Button
                  size="sm"
                  onClick={() => handleDownstreamAction("appointment")}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-8 gap-1.5 shadow-xs"
                >
                  <Icon icon="solar:calendar-bold" size={14} />
                  Book Appointment
                </Button>
              )}

              {request.sample_collection_required ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleDownstreamAction("sample")}
                  className="border-purple-300 text-purple-700 hover:bg-purple-50 text-xs h-8 gap-1.5"
                >
                  <Icon icon="solar:test-tube-bold" size={14} />
                  Collect Specimen
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Main Layout: 2 Columns ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Columns: Order Details & Instructions */}
        <div className="lg:col-span-2 space-y-6">
          {/* Order Details Specification */}
          <Card>
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-sm font-bold flex items-center justify-between">
                <span>Order Specification</span>
                <span className="text-xs font-normal text-muted-foreground">
                  Intent: <strong className="text-foreground">{request.intent}</strong>
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="text-[11px] text-muted-foreground uppercase font-semibold">Service Name</div>
                  <div className="text-sm font-bold text-foreground mt-0.5">
                    {request.title || request.reference_name || "—"}
                  </div>
                </div>

                <div>
                  <div className="text-[11px] text-muted-foreground uppercase font-semibold">Marley DocType (template_dt)</div>
                  <div className="text-sm font-medium text-foreground mt-0.5 flex items-center gap-1.5">
                    <Icon icon="solar:document-text-bold" size={14} className="text-indigo-600" />
                    <span>{request.reference_doctype || request.template_dt || "General Requisition"}</span>
                  </div>
                </div>

                <div>
                  <div className="text-[11px] text-muted-foreground uppercase font-semibold">Template Name (template_dn)</div>
                  <div className="text-sm font-medium text-foreground mt-0.5">
                    {request.reference_name || request.template_dn || "—"}
                  </div>
                </div>

                <div>
                  <div className="text-[11px] text-muted-foreground uppercase font-semibold">Category</div>
                  <div className="text-sm font-medium text-foreground mt-0.5">
                    {request.category_name || "General Clinical"}
                  </div>
                </div>

                <div>
                  <div className="text-[11px] text-muted-foreground uppercase font-semibold">Medical Department</div>
                  <div className="text-sm font-medium text-foreground mt-0.5">
                    {request.department_name || "—"}
                  </div>
                </div>

                <div>
                  <div className="text-[11px] text-muted-foreground uppercase font-semibold">Ordering Practitioner</div>
                  <div className="text-sm font-medium text-foreground mt-0.5">
                    {request.practitioner_name ? `Dr. ${request.practitioner_name}` : "—"}
                  </div>
                </div>

                <div>
                  <div className="text-[11px] text-muted-foreground uppercase font-semibold">Order Date</div>
                  <div className="text-sm font-medium text-foreground mt-0.5">
                    {request.order_date || request.creation?.slice(0, 10)}
                  </div>
                </div>

                <div>
                  <div className="text-[11px] text-muted-foreground uppercase font-semibold">Expected Fulfillment Date</div>
                  <div className="text-sm font-medium text-foreground mt-0.5 flex items-center gap-1.5">
                    <span>{request.expected_date || "Immediate / Routine"}</span>
                    {isOverdue && (
                      <Badge variant="destructive" className="text-[10px] py-0 px-1">
                        OVERDUE
                      </Badge>
                    )}
                  </div>
                </div>

                <div>
                  <div className="text-[11px] text-muted-foreground uppercase font-semibold">Specimen Requirement</div>
                  <div className="text-sm font-medium text-foreground mt-0.5">
                    {request.sample_collection_required ? (
                      <span className="text-purple-600 font-semibold flex items-center gap-1">
                        <Icon icon="solar:test-tube-bold" size={14} /> Specimen Collection Required
                      </span>
                    ) : (
                      <span className="text-muted-foreground">No specimen required</span>
                    )}
                  </div>
                </div>

                <div>
                  <div className="text-[11px] text-muted-foreground uppercase font-semibold">As Needed (PRN)</div>
                  <div className="text-sm font-medium text-foreground mt-0.5">
                    {request.as_needed ? (
                      <Badge variant="outline" className="border-amber-300 text-amber-700 bg-amber-50">
                        PRN (As Needed)
                      </Badge>
                    ) : (
                      "Scheduled / Direct Execution"
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Clinical Indications & Instructions */}
          <Card>
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-sm font-bold">Clinical Indications & Patient Instructions</CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              {request.notes ? (
                <div className="p-3.5 rounded-lg bg-muted/40 border text-xs whitespace-pre-wrap leading-relaxed font-sans">
                  {request.notes}
                </div>
              ) : (
                <div className="text-xs text-muted-foreground italic">
                  No clinical indication notes recorded for this requisition.
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Patient Summary & Workflow Actions */}
        <div className="space-y-6">
          {/* Patient Card */}
          <Card className="border-indigo-100 dark:border-indigo-900/40">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-sm font-bold flex items-center justify-between">
                <span>Patient Chart</span>
                {request.patient && (
                  <Link
                    to={`/healthcare/patients/${request.patient}`}
                    className="text-xs text-indigo-600 hover:underline flex items-center gap-1 font-normal"
                  >
                    Open Dashboard <Icon icon="solar:arrow-right-up-linear" size={12} />
                  </Link>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-indigo-600 text-white font-bold text-sm flex items-center justify-center shrink-0">
                  {getInitials(request.patient_name || patient?.patient_name || "P")}
                </div>
                <div>
                  <div className="text-sm font-bold text-foreground">
                    {request.patient_name || patient?.patient_name || `Patient #${request.patient}`}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    MRN: #{request.patient} · {patient?.sex || "Unspecified"} · {formatAge(patient?.dob, patient?.age)}
                  </div>
                </div>
              </div>

              {patient && (
                <div className="pt-3 border-t space-y-1.5 text-xs text-muted-foreground">
                  {patient.mobile && (
                    <div className="flex items-center justify-between">
                      <span>Phone:</span>
                      <strong className="text-foreground">{patient.mobile}</strong>
                    </div>
                  )}
                  {patient.blood_group && (
                    <div className="flex items-center justify-between">
                      <span>Blood Group:</span>
                      <strong className="text-rose-600">{patient.blood_group}</strong>
                    </div>
                  )}
                  {patient.email && (
                    <div className="flex items-center justify-between">
                      <span>Email:</span>
                      <span className="text-foreground">{patient.email}</span>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Workflow Status Actions */}
          <Card>
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-sm font-bold">Lifecycle & Workflow</CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-3">
              <div className="text-xs text-muted-foreground">
                Current State: <strong className="text-foreground">{request.status}</strong>
              </div>

              <div className="flex flex-col gap-2 pt-1">
                {(request.status === "Active" || request.status === "Draft") && (
                  <Button
                    onClick={handleComplete}
                    disabled={actionLoading}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-9 justify-start gap-2 shadow-xs"
                  >
                    <Icon icon="solar:check-circle-bold" size={16} />
                    Fulfill / Complete Order
                  </Button>
                )}

                {request.status === "Active" && (
                  <Button
                    variant="outline"
                    onClick={handleToggleHold}
                    disabled={actionLoading}
                    className="border-amber-300 text-amber-700 hover:bg-amber-50 text-xs h-9 justify-start gap-2"
                  >
                    <Icon icon="solar:pause-circle-bold" size={16} />
                    Put On Hold
                  </Button>
                )}

                {request.status === "On Hold" && (
                  <Button
                    variant="outline"
                    onClick={handleToggleHold}
                    disabled={actionLoading}
                    className="border-blue-300 text-blue-700 hover:bg-blue-50 text-xs h-9 justify-start gap-2"
                  >
                    <Icon icon="solar:play-circle-bold" size={16} />
                    Resume Requisition
                  </Button>
                )}

                {request.status !== "Cancelled" && request.status !== "Completed" && (
                  <Button
                    variant="outline"
                    onClick={handleCancel}
                    disabled={actionLoading}
                    className="border-rose-200 text-rose-700 hover:bg-rose-50 text-xs h-9 justify-start gap-2"
                  >
                    <Icon icon="solar:close-circle-bold" size={16} />
                    Cancel Requisition
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
