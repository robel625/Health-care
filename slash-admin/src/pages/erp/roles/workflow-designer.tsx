import { Icon } from "@/components/icon";
import { Badge } from "@/ui/badge";
import { Button } from "@/ui/button";
import { Card, CardContent, CardHeader } from "@/ui/card";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { Switch } from "@/ui/switch";
import { Textarea } from "@/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/select";
import Table, { type ColumnsType } from "antd/es/table";
import { useEffect, useState, useCallback, useMemo } from "react";
import apiClient from "@/api/apiClient";

// ── Types ────────────────────────────────────────────────────────
interface WorkflowStateItem {
  id: string;
  workflow_state_name: string;
  style: string;
  icon: string;
}

interface WorkflowDocumentState {
  id: string;
  state: string;
  state_name: string;
  doc_status: string;
  allow_edit: string;
  is_optional_state: boolean;
  send_email: boolean;
  message: string;
}

interface WorkflowTransitionItem {
  id: string;
  state: string;
  state_name: string;
  action: string;
  next_state: string;
  next_state_name: string;
  allowed: string;
  allow_self_approval: boolean;
  send_email_to_creator: boolean;
  condition: string;
}

interface WorkflowItem {
  id: string;
  workflow_name: string;
  document_type: string;
  workflow_state_field: string;
  is_active: boolean;
  override_status: boolean;
  send_email_alert: boolean;
  states: WorkflowDocumentState[];
  transitions: WorkflowTransitionItem[];
  owner: string;
  creation: string;
  modified: string;
}

// ── API ──────────────────────────────────────────────────────────
const WorkflowApi = {
  list: () => apiClient.get({ url: "/roles/workflows/" }),
  get: (id: string) => apiClient.get({ url: `/roles/workflows/${id}/` }),
  create: (data: Record<string, any>) => apiClient.post({ url: "/roles/workflows/", data }),
  update: (id: string, data: Record<string, any>) => apiClient.put({ url: `/roles/workflows/${id}/`, data }),
  delete: (id: string) => apiClient.delete({ url: `/roles/workflows/${id}/` }),
  toggleActive: (id: string) => apiClient.post({ url: `/roles/workflows/${id}/toggle_active/` }),
};

const WorkflowStateApi = {
  list: () => apiClient.get({ url: "/roles/workflow-states/" }),
  create: (data: Record<string, any>) => apiClient.post({ url: "/roles/workflow-states/", data }),
  delete: (id: string) => apiClient.delete({ url: `/roles/workflow-states/${id}/` }),
};

const DOC_TYPES = [
  { group: "Clinical", items: ["Patient", "Patient Appointment", "Patient Encounter", "Vital Signs", "Drug Prescription", "Service Request"] },
  { group: "Diagnostics", items: ["Lab Test", "Lab Test Template", "Observation", "Sample Collection", "Diagnostic Report"] },
  { group: "Inpatient", items: ["Inpatient Record", "Emergency Record", "Nursing Task", "Discharge Summary"] },
  { group: "Pharmacy", items: ["Medication Request", "Inpatient Medication Entry", "Pharmacy Stock Entry"] },
];

// State style configurations are in STYLE_TEXT and STYLE_BORDER constants below

// STYLE_COLORS is available for custom color coding

const STYLE_TEXT: Record<string, string> = {
  Primary: "text-blue-600",
  Info: "text-cyan-600",
  Success: "text-green-600",
  Warning: "text-amber-600",
  Danger: "text-red-600",
  Inverse: "text-gray-600",
};

const STYLE_BORDER: Record<string, string> = {
  Primary: "border-blue-400",
  Info: "border-cyan-400",
  Success: "border-green-400",
  Warning: "border-amber-400",
  Danger: "border-red-400",
  Inverse: "border-gray-500",
};

const DOC_STATUS_LABELS: Record<string, string> = {
  "0": "Draft",
  "1": "Submitted",
  "2": "Cancelled",
};

// ── Main Component ───────────────────────────────────────────────
export default function WorkflowDesignerPage() {
  const [workflows, setWorkflows] = useState<WorkflowItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedWorkflow, setSelectedWorkflow] = useState<WorkflowItem | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showStateDialog, setShowStateDialog] = useState(false);
  const [showTransitionDialog, setShowTransitionDialog] = useState(false);
  const [showVisualBuilder, setShowVisualBuilder] = useState(false);

  // Create/Edit form
  const [form, setForm] = useState({
    workflow_name: "",
    document_type: "",
    workflow_state_field: "workflow_state",
    is_active: true,
    override_status: false,
    send_email_alert: true,
  });

  // New state form
  const [stateForm, setStateForm] = useState({
    state: "",
    doc_status: "0",
    allow_edit: "",
    is_optional_state: false,
    send_email: false,
    message: "",
  });

  // New transition form
  const [transitionForm, setTransitionForm] = useState({
    state: "",
    action: "",
    next_state: "",
    allowed: "",
    allow_self_approval: false,
    send_email_to_creator: false,
    condition: "",
  });

  const [allStates, setAllStates] = useState<WorkflowStateItem[]>([]);

  const loadWorkflows = useCallback(async () => {
    setLoading(true);
    try {
      const res: any = await WorkflowApi.list();
      setWorkflows(res.data || res.results || res as any);
    } catch (err) {
      console.error("Failed to load workflows:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadStates = useCallback(async () => {
    try {
      const res: any = await WorkflowStateApi.list();
      setAllStates(res.data || res.results || res as any);
    } catch (err) {
      console.error("Failed to load states:", err);
    }
  }, []);

  useEffect(() => {
    loadWorkflows();
    loadStates();
  }, [loadWorkflows, loadStates]);

  const handleCreate = async () => {
    try {
      await WorkflowApi.create(form);
      setShowCreateDialog(false);
      setForm({ workflow_name: "", document_type: "", workflow_state_field: "workflow_state", is_active: true, override_status: false, send_email_alert: true });
      loadWorkflows();
    } catch (err) {
      console.error("Failed to create workflow:", err);
    }
  };

  const handleUpdate = async () => {
    if (!selectedWorkflow) return;
    try {
      await WorkflowApi.update(selectedWorkflow.id, form);
      setShowEditDialog(false);
      loadWorkflows();
    } catch (err) {
      console.error("Failed to update workflow:", err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this workflow?")) return;
    try {
      await WorkflowApi.delete(id);
      loadWorkflows();
    } catch (err) {
      console.error("Failed to delete:", err);
    }
  };


  const handleAddState = async () => {
    if (!selectedWorkflow || !stateForm.state) return;
    try {
      // Create or get the workflow state
      let stateId = "";
      const existing = allStates.find((s) => s.workflow_state_name === stateForm.state);
      if (existing) {
        stateId = existing.id;
      } else {
        const res: any = await WorkflowStateApi.create({
          workflow_state_name: stateForm.state,
          style: "Info",
        });
        stateId = (res.data || res).id;
        loadStates();
      }

      // Add document state to workflow
      await apiClient.post({ url: "/roles/workflow-doc-states/", data: {
        workflow: selectedWorkflow.id,
        state: stateId,
        doc_status: stateForm.doc_status,
        allow_edit: stateForm.allow_edit,
        is_optional_state: stateForm.is_optional_state,
        send_email: stateForm.send_email,
        message: stateForm.message,
      } });

      setShowStateDialog(false);
      setStateForm({ state: "", doc_status: "0", allow_edit: "", is_optional_state: false, send_email: false, message: "" });

      // Refresh the selected workflow
      const res: any = await WorkflowApi.get(selectedWorkflow.id);
      setSelectedWorkflow((res.data || res) as any);
      loadWorkflows();
    } catch (err) {
      console.error("Failed to add state:", err);
    }
  };

  const handleAddTransition = async () => {
    if (!selectedWorkflow || !transitionForm.state || !transitionForm.action || !transitionForm.next_state) return;
    try {
      await apiClient.post({ url: "/roles/workflow-transitions/", data: {
        workflow: selectedWorkflow.id,
        state: transitionForm.state,
        action: transitionForm.action,
        next_state: transitionForm.next_state,
        allowed: transitionForm.allowed,
        allow_self_approval: transitionForm.allow_self_approval,
        send_email_to_creator: transitionForm.send_email_to_creator,
        condition: transitionForm.condition,
      } });

      setShowTransitionDialog(false);
      setTransitionForm({ state: "", action: "", next_state: "", allowed: "", allow_self_approval: false, send_email_to_creator: false, condition: "" });

      const res: any = await WorkflowApi.get(selectedWorkflow.id);
      setSelectedWorkflow((res.data || res) as any);
      loadWorkflows();
    } catch (err) {
      console.error("Failed to add transition:", err);
    }
  };

  const handleDeleteState = async (stateId: string) => {
    if (!selectedWorkflow) return;
    try {
      await apiClient.delete({ url: `/roles/workflow-doc-states/${stateId}/` });
      const res: any = await WorkflowApi.get(selectedWorkflow.id);
      setSelectedWorkflow((res.data || res) as any);
      loadWorkflows();
    } catch (err) {
      console.error("Failed to delete state:", err);
    }
  };

  const handleDeleteTransition = async (transId: string) => {
    if (!selectedWorkflow) return;
    try {
      await apiClient.delete({ url: `/roles/workflow-transitions/${transId}/` });
      const res: any = await WorkflowApi.get(selectedWorkflow.id);
      setSelectedWorkflow((res.data || res) as any);
      loadWorkflows();
    } catch (err) {
      console.error("Failed to delete transition:", err);
    }
  };

  // Get available states for the selected workflow
  const availableStateNames = useMemo(() => {
    if (!selectedWorkflow) return [];
    return selectedWorkflow.states.map((s) => s.state_name);
  }, [selectedWorkflow]);

  // Build visual diagram data
  const diagramNodes = useMemo(() => {
    if (!selectedWorkflow) return [];
    return selectedWorkflow.states.map((s) => ({
      id: s.id,
      label: s.state_name,
      docStatus: s.doc_status,
      allowEdit: s.allow_edit,
      style: allStates.find((ws) => ws.workflow_state_name === s.state_name)?.style || "Info",
    }));
  }, [selectedWorkflow, allStates]);

  const diagramEdges = useMemo(() => {
    if (!selectedWorkflow) return [];
    return selectedWorkflow.transitions.map((t) => ({
      id: t.id,
      from: t.state_name,
      to: t.next_state_name,
      action: t.action,
      allowed: t.allowed,
    }));
  }, [selectedWorkflow]);

  // Table columns
  const columns: ColumnsType<WorkflowItem> = [
    {
      title: "Workflow",
      dataIndex: "workflow_name",
      width: 250,
      render: (v, r) => (
        <div>
          <button className="text-sm font-medium text-primary hover:underline" onClick={() => { setSelectedWorkflow(r); setShowVisualBuilder(true); }}>{v}</button>
          <div className="text-xs text-text-secondary">{r.workflow_state_field}</div>
        </div>
      ),
    },
    {
      title: "DocType",
      dataIndex: "document_type",
      width: 150,
      render: (v) => <Badge variant="info" className="text-xs">{v}</Badge>,
    },
    {
      title: "States",
      width: 100,
      render: (_, r) => <span className="text-sm">{r.states?.length || 0}</span>,
    },
    {
      title: "Transitions",
      width: 100,
      render: (_, r) => <span className="text-sm">{r.transitions?.length || 0}</span>,
    },
    {
      title: "Email Alerts",
      dataIndex: "send_email_alert",
      width: 100,
      render: (v) => v ? <Icon icon="mdi:check-circle" size={16} className="text-success" /> : <Icon icon="mdi:close-circle" size={16} className="text-text-secondary" />,
    },
    {
      title: "Status",
      dataIndex: "is_active",
      width: 90,
      render: (v, r) => (
        <button onClick={async () => { try { await WorkflowApi.toggleActive(r.id); loadWorkflows(); } catch {} }}>
          <Badge variant={v ? "success" : "default"} className="text-xs cursor-pointer hover:opacity-80">{v ? "Active" : "Inactive"}</Badge>
        </button>
      ),
    },
    {
      title: "Actions",
      width: 140,
      render: (_, r) => (
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => { setSelectedWorkflow(r); setShowVisualBuilder(true); }}>
            <Icon icon="mdi:graph-outline" size={14} />
          </Button>
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => { setForm({ workflow_name: r.workflow_name, document_type: r.document_type, workflow_state_field: r.workflow_state_field, is_active: r.is_active, override_status: r.override_status, send_email_alert: r.send_email_alert }); setSelectedWorkflow(r); setShowEditDialog(true); }}>
            <Icon icon="mdi:pencil-outline" size={14} />
          </Button>
          <Button variant="outline" size="sm" className="h-7 text-xs text-destructive" onClick={() => handleDelete(r.id)}>
            <Icon icon="mdi:delete-outline" size={14} />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon icon="mdi:git-branch" size={22} className="text-primary" />
            <span className="text-lg font-semibold">Workflow Designer</span>
          </div>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Icon icon="mdi:plus" size={16} className="mr-1" /> New Workflow
          </Button>
        </div>
        <p className="text-sm text-text-secondary">
          Design approval workflows with multi-step states and role-based transitions.
        </p>
      </CardHeader>
      <CardContent>
        <Table
          rowKey="id"
          size="small"
          scroll={{ x: "max-content" }}
          columns={columns}
          dataSource={workflows}
          loading={loading}
          pagination={{ pageSize: 10, showSizeChanger: false }}
        />
      </CardContent>

      {/* ── Create Workflow Dialog ────────────────────── */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Workflow</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Workflow Name *</Label>
              <Input value={form.workflow_name} onChange={(e) => setForm({ ...form, workflow_name: e.target.value })} placeholder="e.g. Sales Order Approval" />
            </div>
            <div className="space-y-1">
              <Label>Document Type *</Label>
              <Select value={form.document_type} onValueChange={(v) => setForm({ ...form, document_type: v })}>
                <SelectTrigger><SelectValue placeholder="Select DocType" /></SelectTrigger>
                <SelectContent>
                  {DOC_TYPES.map((g) => (
                    <div key={g.group}>
                      <div className="px-2 py-1 text-xs font-semibold text-text-secondary">{g.group}</div>
                      {g.items.map((dt) => (
                        <SelectItem key={dt} value={dt}>{dt}</SelectItem>
                      ))}
                    </div>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Workflow State Field</Label>
              <Input value={form.workflow_state_field} onChange={(e) => setForm({ ...form, workflow_state_field: e.target.value })} />
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
                <Label className="text-xs">Active</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.send_email_alert} onCheckedChange={(v) => setForm({ ...form, send_email_alert: v })} />
                <Label className="text-xs">Email Alerts</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.override_status} onCheckedChange={(v) => setForm({ ...form, override_status: v })} />
                <Label className="text-xs">Override Status</Label>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={!form.workflow_name || !form.document_type}>Create</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Edit Workflow Dialog ──────────────────────── */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Workflow</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Workflow Name</Label>
              <Input value={form.workflow_name} onChange={(e) => setForm({ ...form, workflow_name: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Document Type</Label>
              <Select value={form.document_type} onValueChange={(v) => setForm({ ...form, document_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DOC_TYPES.map((g) => (
                    <div key={g.group}>
                      <div className="px-2 py-1 text-xs font-semibold text-text-secondary">{g.group}</div>
                      {g.items.map((dt) => (
                        <SelectItem key={dt} value={dt}>{dt}</SelectItem>
                      ))}
                    </div>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
                <Label className="text-xs">Active</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.send_email_alert} onCheckedChange={(v) => setForm({ ...form, send_email_alert: v })} />
                <Label className="text-xs">Email Alerts</Label>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowEditDialog(false)}>Cancel</Button>
              <Button onClick={handleUpdate}>Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Visual Builder / Workflow Detail Dialog ───── */}
      <Dialog open={showVisualBuilder} onOpenChange={setShowVisualBuilder}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Icon icon="mdi:git-branch" size={20} />
              {selectedWorkflow?.workflow_name}
              <Badge variant={selectedWorkflow?.is_active ? "success" : "default"} className="text-xs ml-2">
                {selectedWorkflow?.is_active ? "Active" : "Inactive"}
              </Badge>
            </DialogTitle>
          </DialogHeader>

          {selectedWorkflow && (
            <div className="space-y-6">
              {/* Workflow Info */}
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div><span className="text-text-secondary">DocType:</span> <Badge variant="info">{selectedWorkflow.document_type}</Badge></div>
                <div><span className="text-text-secondary">State Field:</span> {selectedWorkflow.workflow_state_field}</div>
                <div><span className="text-text-secondary">Email Alerts:</span> {selectedWorkflow.send_email_alert ? "Yes" : "No"}</div>
              </div>

              {/* Visual Diagram */}
              <div className="rounded-lg border bg-muted/20 p-6">
                <div className="text-xs font-semibold text-text-secondary mb-4">WORKFLOW DIAGRAM</div>
                <div className="flex flex-wrap items-center justify-center gap-3">
                  {diagramNodes.map((node, i) => (
                    <div key={node.id} className="flex items-center gap-2">
                      {/* State Node */}
                      <div className={`rounded-lg border-2 ${STYLE_BORDER[node.style] || "border-gray-300"} bg-white px-4 py-3 text-center min-w-[120px] shadow-sm`}>
                        <div className={`text-xs font-semibold ${STYLE_TEXT[node.style] || "text-gray-600"}`}>{node.label}</div>
                        <div className="text-[10px] text-text-secondary mt-1">DocStatus: {DOC_STATUS_LABELS[node.docStatus] || node.docStatus}</div>
                        {node.allowEdit && (
                          <div className="text-[10px] text-text-secondary">Edit: {node.allowEdit}</div>
                        )}
                      </div>
                      {/* Arrow + Transition Label */}
                      {i < diagramNodes.length - 1 && (
                        <div className="flex flex-col items-center">
                          {(() => {
                            const edge = diagramEdges.find((e) => e.from === node.label && e.to === diagramNodes[i + 1]?.label);
                            if (edge) {
                              return (
                                <>
                                  <div className="text-[10px] font-medium text-primary whitespace-nowrap">{edge.action}</div>
                                  <div className="text-[9px] text-text-secondary whitespace-nowrap">({edge.allowed})</div>
                                  <Icon icon="mdi:arrow-right-bold" size={18} className="text-primary" />
                                </>
                              );
                            }
                            return <Icon icon="mdi:arrow-right-bold" size={18} className="text-text-secondary" />;
                          })()}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* States Table */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs font-semibold text-text-secondary">WORKFLOW STATES ({selectedWorkflow.states?.length || 0})</div>
                  <Button size="sm" variant="outline" onClick={() => setShowStateDialog(true)}>
                    <Icon icon="mdi:plus" size={14} className="mr-1" /> Add State
                  </Button>
                </div>
                <div className="overflow-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-xs text-text-secondary">
                        <th className="py-2 text-left">State</th>
                        <th className="py-2 text-left">Doc Status</th>
                        <th className="py-2 text-left">Allow Edit</th>
                        <th className="py-2 text-center">Email</th>
                        <th className="py-2 text-center">Optional</th>
                        <th className="py-2 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedWorkflow.states?.map((s) => (
                        <tr key={s.id} className="border-b hover:bg-muted/30">
                          <td className="py-2">
                            <Badge variant={allStates.find((ws) => ws.workflow_state_name === s.state_name)?.style === "Danger" ? "error" : allStates.find((ws) => ws.workflow_state_name === s.state_name)?.style === "Success" ? "success" : "info"} className="text-xs">
                              {s.state_name}
                            </Badge>
                          </td>
                          <td className="py-2 text-xs">{DOC_STATUS_LABELS[s.doc_status] || s.doc_status}</td>
                          <td className="py-2 text-xs">{s.allow_edit || "-"}</td>
                          <td className="py-2 text-center">{s.send_email ? <Icon icon="mdi:check" size={14} className="text-success" /> : "-"}</td>
                          <td className="py-2 text-center">{s.is_optional_state ? <Icon icon="mdi:check" size={14} className="text-warning" /> : "-"}</td>
                          <td className="py-2 text-right">
                            <Button variant="ghost" size="sm" className="h-6 text-xs text-destructive" onClick={() => handleDeleteState(s.id)}>
                              <Icon icon="mdi:delete-outline" size={12} />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Transitions Table */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs font-semibold text-text-secondary">TRANSITIONS ({selectedWorkflow.transitions?.length || 0})</div>
                  <Button size="sm" variant="outline" onClick={() => setShowTransitionDialog(true)}>
                    <Icon icon="mdi:plus" size={14} className="mr-1" /> Add Transition
                  </Button>
                </div>
                <div className="overflow-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-xs text-text-secondary">
                        <th className="py-2 text-left">From</th>
                        <th className="py-2 text-center">Action</th>
                        <th className="py-2 text-left">To</th>
                        <th className="py-2 text-left">Allowed Role</th>
                        <th className="py-2 text-center">Self Approve</th>
                        <th className="py-2 text-center">Email Creator</th>
                        <th className="py-2 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedWorkflow.transitions?.map((t) => (
                        <tr key={t.id} className="border-b hover:bg-muted/30">
                          <td className="py-2 text-xs">{t.state_name}</td>
                          <td className="py-2 text-center">
                            <Badge variant="info" className="text-xs">{t.action}</Badge>
                          </td>
                          <td className="py-2 text-xs">{t.next_state_name}</td>
                          <td className="py-2 text-xs">{t.allowed}</td>
                          <td className="py-2 text-center">{t.allow_self_approval ? <Icon icon="mdi:check" size={14} className="text-success" /> : "-"}</td>
                          <td className="py-2 text-center">{t.send_email_to_creator ? <Icon icon="mdi:check" size={14} className="text-primary" /> : "-"}</td>
                          <td className="py-2 text-right">
                            <Button variant="ghost" size="sm" className="h-6 text-xs text-destructive" onClick={() => handleDeleteTransition(t.id)}>
                              <Icon icon="mdi:delete-outline" size={12} />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Condition Info */}
              {selectedWorkflow.transitions?.some((t) => t.condition) && (
                <div className="rounded-lg border bg-muted/20 p-4">
                  <div className="text-xs font-semibold text-text-secondary mb-2">CONDITIONS</div>
                  {selectedWorkflow.transitions?.filter((t) => t.condition).map((t) => (
                    <div key={t.id} className="text-xs">
                      <span className="font-medium">{t.action}</span>: <code className="bg-muted px-1 rounded">{t.condition}</code>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Add State Dialog ─────────────────────────── */}
      <Dialog open={showStateDialog} onOpenChange={setShowStateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Workflow State</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>State *</Label>
              <Input
                value={stateForm.state}
                onChange={(e) => setStateForm({ ...stateForm, state: e.target.value })}
                placeholder="e.g. Draft, Approved, Rejected"
                list="state-names"
              />
              <datalist id="state-names">
                {allStates.map((s) => (
                  <option key={s.id} value={s.workflow_state_name} />
                ))}
              </datalist>
              <p className="text-[10px] text-text-secondary">Type an existing state name or create a new one</p>
            </div>
            <div className="space-y-1">
              <Label>Document Status</Label>
              <Select value={stateForm.doc_status} onValueChange={(v) => setStateForm({ ...stateForm, doc_status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Draft (0)</SelectItem>
                  <SelectItem value="1">Submitted (1)</SelectItem>
                  <SelectItem value="2">Cancelled (2)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Allow Edit (Role)</Label>
              <Input value={stateForm.allow_edit} onChange={(e) => setStateForm({ ...stateForm, allow_edit: e.target.value })} placeholder="e.g. Sales Manager" />
            </div>
            <div className="space-y-1">
              <Label>Message</Label>
              <Textarea value={stateForm.message} onChange={(e) => setStateForm({ ...stateForm, message: e.target.value })} rows={2} placeholder="Optional message shown in this state" />
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch checked={stateForm.send_email} onCheckedChange={(v) => setStateForm({ ...stateForm, send_email: v })} />
                <Label className="text-xs">Send Email</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={stateForm.is_optional_state} onCheckedChange={(v) => setStateForm({ ...stateForm, is_optional_state: v })} />
                <Label className="text-xs">Optional</Label>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowStateDialog(false)}>Cancel</Button>
              <Button onClick={handleAddState} disabled={!stateForm.state}>Add State</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Add Transition Dialog ─────────────────────── */}
      <Dialog open={showTransitionDialog} onOpenChange={setShowTransitionDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Transition</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>From State *</Label>
              <Select value={transitionForm.state} onValueChange={(v) => setTransitionForm({ ...transitionForm, state: v })}>
                <SelectTrigger><SelectValue placeholder="Select source state" /></SelectTrigger>
                <SelectContent>
                  {availableStateNames.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Action *</Label>
              <Input value={transitionForm.action} onChange={(e) => setTransitionForm({ ...transitionForm, action: e.target.value })} placeholder="e.g. Approve, Reject, Submit" />
            </div>
            <div className="space-y-1">
              <Label>To State *</Label>
              <Select value={transitionForm.next_state} onValueChange={(v) => setTransitionForm({ ...transitionForm, next_state: v })}>
                <SelectTrigger><SelectValue placeholder="Select target state" /></SelectTrigger>
                <SelectContent>
                  {availableStateNames.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Allowed Role *</Label>
              <Input value={transitionForm.allowed} onChange={(e) => setTransitionForm({ ...transitionForm, allowed: e.target.value })} placeholder="e.g. Sales Manager" />
            </div>
            <div className="space-y-1">
              <Label>Condition (optional)</Label>
              <Textarea
                value={transitionForm.condition}
                onChange={(e) => setTransitionForm({ ...transitionForm, condition: e.target.value })}
                rows={2}
                placeholder="Python expression, e.g. doc.total > 1000"
                className="font-mono text-xs"
              />
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch checked={transitionForm.allow_self_approval} onCheckedChange={(v) => setTransitionForm({ ...transitionForm, allow_self_approval: v })} />
                <Label className="text-xs">Allow Self Approval</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={transitionForm.send_email_to_creator} onCheckedChange={(v) => setTransitionForm({ ...transitionForm, send_email_to_creator: v })} />
                <Label className="text-xs">Email Creator</Label>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowTransitionDialog(false)}>Cancel</Button>
              <Button onClick={handleAddTransition} disabled={!transitionForm.state || !transitionForm.action || !transitionForm.next_state || !transitionForm.allowed}>
                Add Transition
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
