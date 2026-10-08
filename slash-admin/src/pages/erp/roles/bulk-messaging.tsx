import { Icon } from "@/components/icon";
import { Badge } from "@/ui/badge";
import { Button } from "@/ui/button";
import { Card, CardContent, CardHeader } from "@/ui/card";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { Separator } from "@/ui/separator";
import { Textarea } from "@/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/ui/tabs";
import Table, { type ColumnsType } from "antd/es/table";
import { useEffect, useState, useCallback } from "react";
import {
  CommunicationApi,
  UserListApi,
  type Communication,
  type UserListItem,
} from "@/api/services/erpService";
import { HealthcareApi, type Patient } from "@/api/services/healthcareService";

const MEDIUMS = [
  { value: "Email", label: "Email", icon: "mdi:email-outline", color: "text-purple-600" },
  { value: "Chat", label: "Chat", icon: "mdi:chat-outline", color: "text-green-600" },
  { value: "SMS", label: "SMS", icon: "mdi:cellphone-message", color: "text-blue-600" },
  { value: "Phone", label: "Phone", icon: "mdi:phone-outline", color: "text-amber-600" },
  { value: "Other", label: "Other", icon: "mdi:message-text-outline", color: "text-gray-600" },
];

const TEMPLATES = [
  {
    name: "Welcome Message",
    subject: "Welcome to Acme Corporation!",
    content: "<p>Dear {name},</p><p>Welcome to our team! We're excited to have you on board.</p><p>Please review the attached documentation and reach out if you have any questions.</p><p>Best regards,<br>The Acme Team</p>",
  },
  {
    name: "Invoice Reminder",
    subject: "Payment Reminder - Invoice {invoice}",
    content: "<p>Dear {name},</p><p>This is a friendly reminder that invoice <strong>{invoice}</strong> is due on <strong>{date}</strong>.</p><p>Please process the payment at your earliest convenience.</p><p>If you have already paid, please disregard this message.</p><p>Thank you,<br>Accounts Department</p>",
  },
  {
    name: "Order Confirmation",
    subject: "Order Confirmed - {order}",
    content: "<p>Dear {name},</p><p>Your order <strong>{order}</strong> has been confirmed and is being processed.</p><p>Expected delivery: <strong>{date}</strong></p><p>You will receive another notification when your order ships.</p><p>Thank you for your business!</p>",
  },
  {
    name: "Newsletter",
    subject: "Monthly Newsletter - {month}",
    content: "<p>Dear {name},</p><p>Here's your monthly update from Acme Corporation:</p><ul><li>New product launches</li><li>Upcoming events</li><li>Special offers for loyal customers</li></ul><p>Stay tuned for more exciting updates!</p><p>Best regards,<br>Marketing Team</p>",
  },
];

export default function BulkMessagingPage() {
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [communications, setCommunications] = useState<Communication[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  // Form state
  const [form, setForm] = useState({
    subject: "",
    content: "",
    communication_medium: "Email",
    recipients: [] as string[],
    cc: [] as string[],
    reference_doctype: "",
    reference_name: "",
  });
  const [recipientInput, setRecipientInput] = useState("");
  const [ccInput, setCcInput] = useState("");
  const [recipientType, setRecipientType] = useState<"email" | "users" | "patients">("email");
  const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
  const [selectedPatients, setSelectedPatients] = useState<number[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [sendResult, setSendResult] = useState<{ count: number; success: boolean } | null>(null);

  const loadDropdowns = useCallback(async () => {
    try {
      const [usersRes, patientsRes] = await Promise.all([
        UserListApi.list({ page_size: 100 }),
        HealthcareApi.patients.list({ page_size: 100 }),
      ]);
      setUsers(usersRes.results || []);
      setPatients(patientsRes.results || []);
    } catch (err) {
      console.error("Failed to load dropdowns:", err);
    }
  }, []);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const res = await CommunicationApi.list({ page, communication_medium: "Email" });
      setCommunications(res.results || []);
      setTotal(res.count || 0);
    } catch (err) {
      console.error("Failed to load communications:", err);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { loadDropdowns(); }, [loadDropdowns]);
  useEffect(() => { loadHistory(); }, [loadHistory]);

  // Resolve recipients based on type
  const resolveRecipients = (): string[] => {
    if (recipientType === "email") {
      return recipientInput.split(/[,\n]/).map((e) => e.trim()).filter(Boolean);
    }
    if (recipientType === "users") {
      return users
        .filter((u) => selectedUsers.includes(u.id))
        .map((u) => u.email)
        .filter(Boolean);
    }
    if (recipientType === "patients") {
      return patients
        .filter((p) => selectedPatients.includes(p.id))
        .map((p) => p.email)
        .filter(Boolean);
    }
    return [];
  };

  const handleSend = async () => {
    const recipients = resolveRecipients();
    if (recipients.length === 0 || (!form.subject && !form.content)) return;

    setSending(true);
    setSendResult(null);
    try {
      const res = await CommunicationApi.bulkSend({
        subject: form.subject,
        content: form.content,
        communication_medium: form.communication_medium,
        recipients,
        cc: ccInput.split(/[,\n]/).map((e) => e.trim()).filter(Boolean),
        reference_doctype: form.reference_doctype,
        reference_name: form.reference_name,
      });
      setSendResult({ count: res.count, success: true });
      loadHistory();
      // Reset form
      setForm({ subject: "", content: "", communication_medium: "Email", recipients: [], cc: [], reference_doctype: "", reference_name: "" });
      setRecipientInput("");
      setCcInput("");
      setSelectedUsers([]);
      setSelectedPatients([]);
    } catch (err) {
      console.error("Send failed:", err);
      setSendResult({ count: 0, success: false });
    } finally {
      setSending(false);
    }
  };

  const applyTemplate = (template: typeof TEMPLATES[0]) => {
    setForm({ ...form, subject: template.subject, content: template.content });
  };

  const allRecipients = resolveRecipients();

  const historyColumns: ColumnsType<Communication> = [
    {
      title: "Subject",
      dataIndex: "subject",
      width: 250,
      render: (v) => <span className="text-sm font-medium line-clamp-1">{v || "(no subject)"}</span>,
    },
    {
      title: "Medium",
      dataIndex: "communication_medium",
      width: 100,
      render: (v) => <Badge variant="info" className="text-xs">{v}</Badge>,
    },
    {
      title: "To",
      dataIndex: "recipients",
      width: 200,
      render: (v) => <span className="text-xs text-text-secondary line-clamp-1">{v}</span>,
    },
    {
      title: "Status",
      dataIndex: "status",
      width: 90,
      render: (v) => <Badge variant={v === "Linked" ? "success" : "default"} className="text-xs">{v}</Badge>,
    },
    {
      title: "Date",
      dataIndex: "creation",
      width: 140,
      render: (v) => v ? new Date(v).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "-",
    },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Icon icon="mdi:email-send-outline" size={22} className="text-primary" />
          <span className="text-lg font-semibold">Bulk Messaging</span>
        </div>
        <p className="text-sm text-text-secondary">
          Send emails, chats, or SMS notifications to users, customers, or custom recipient lists.
        </p>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="compose">
          <TabsList className="mb-4">
            <TabsTrigger value="compose" className="gap-1">
              <Icon icon="mdi:pencil-outline" size={14} /> Compose
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-1">
              <Icon icon="mdi:history" size={14} /> History
            </TabsTrigger>
          </TabsList>

          {/* ── Compose Tab ──────────────────────────────────── */}
          <TabsContent value="compose" className="space-y-4">
            {/* Templates */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-text-secondary">Templates:</span>
              {TEMPLATES.map((t) => (
                <Button key={t.name} variant="outline" size="sm" className="h-7 text-xs" onClick={() => applyTemplate(t)}>
                  {t.name}
                </Button>
              ))}
            </div>

            {/* Medium */}
            <div className="space-y-1">
              <Label className="text-xs">Channel</Label>
              <div className="flex gap-2">
                {MEDIUMS.map((m) => (
                  <Button
                    key={m.value}
                    variant={form.communication_medium === m.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => setForm({ ...form, communication_medium: m.value })}
                  >
                    <Icon icon={m.icon as any} size={14} className="mr-1" />
                    {m.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Recipients */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Recipients *</Label>
                <div className="flex gap-2">
                  {(["email", "users", "patients"] as const).map((t) => (
                    <button
                      key={t}
                      className={`rounded-md px-2 py-0.5 text-xs font-medium transition-colors ${
                        recipientType === t
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-text-secondary hover:bg-muted/80"
                      }`}
                      onClick={() => setRecipientType(t)}
                    >
                      {t === "email" ? "Email Addresses" : t === "users" ? "System Users" : "Patients"}
                    </button>
                  ))}
                </div>
              </div>

              {recipientType === "email" && (
                <Textarea
                  value={recipientInput}
                  onChange={(e) => setRecipientInput(e.target.value)}
                  rows={2}
                  placeholder="Enter email addresses separated by commas or newlines..."
                  className="resize-none"
                />
              )}

              {recipientType === "users" && (
                <div className="max-h-40 overflow-auto rounded-md border p-2 space-y-1">
                  {users.map((u) => (
                    <label key={u.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 p-1 rounded">
                      <input
                        type="checkbox"
                        checked={selectedUsers.includes(u.id)}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedUsers([...selectedUsers, u.id]);
                          else setSelectedUsers(selectedUsers.filter((id) => id !== u.id));
                        }}
                        className="h-4 w-4"
                      />
                      <span className="font-medium">{u.username}</span>
                      <span className="text-xs text-text-secondary">({u.email})</span>
                      {u.is_staff && <Badge variant="warning" className="text-xs">Admin</Badge>}
                    </label>
                  ))}
                </div>
              )}

              {recipientType === "patients" && (
                <div className="max-h-40 overflow-auto rounded-md border p-2 space-y-1">
                  {patients.map((p) => (
                    <label key={p.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 p-1 rounded">
                      <input
                        type="checkbox"
                        checked={selectedPatients.includes(p.id)}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedPatients([...selectedPatients, p.id]);
                          else setSelectedPatients(selectedPatients.filter((id) => id !== p.id));
                        }}
                        className="h-4 w-4"
                      />
                      <span className="font-medium">{p.patient_name}</span>
                      <span className="text-xs text-text-secondary">({p.email || "No email"})</span>
                    </label>
                  ))}
                </div>
              )}

              {allRecipients.length > 0 && (
                <div className="flex items-center gap-2 text-xs text-text-secondary">
                  <Icon icon="mdi:check-circle" size={14} className="text-success" />
                  {allRecipients.length} recipient(s) selected
                </div>
              )}
            </div>

            {/* CC */}
            <div className="space-y-1">
              <Label className="text-xs">CC</Label>
              <Input
                value={ccInput}
                onChange={(e) => setCcInput(e.target.value)}
                placeholder="CC email addresses (comma separated)"
              />
            </div>

            {/* Subject */}
            <div className="space-y-1">
              <Label className="text-xs">Subject *</Label>
              <Input
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                placeholder="Message subject..."
              />
            </div>

            {/* Content */}
            <div className="space-y-1">
              <Label className="text-xs">Message *</Label>
              <Textarea
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                rows={6}
                placeholder="Type your message... (HTML supported)"
                className="resize-none font-mono text-sm"
              />
            </div>

            {/* Reference */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs">Reference DocType (optional)</Label>
                <Input
                  value={form.reference_doctype}
                  onChange={(e) => setForm({ ...form, reference_doctype: e.target.value })}
                  placeholder="e.g. Patient"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Reference Name (optional)</Label>
                <Input
                  value={form.reference_name}
                  onChange={(e) => setForm({ ...form, reference_name: e.target.value })}
                  placeholder="e.g. CUST-00001"
                />
              </div>
            </div>

            {/* Preview */}
            {showPreview && (
              <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
                <div className="text-xs font-semibold text-text-secondary">Preview</div>
                <div className="text-sm"><strong>To:</strong> {allRecipients.join(", ")}</div>
                {ccInput && <div className="text-sm"><strong>CC:</strong> {ccInput}</div>}
                <div className="text-sm"><strong>Subject:</strong> {form.subject}</div>
                <div className="text-sm"><strong>Channel:</strong> {form.communication_medium}</div>
                <Separator />
                <div className="text-sm" dangerouslySetInnerHTML={{ __html: form.content }} />
              </div>
            )}

            {/* Send Result */}
            {sendResult && (
              <div className={`rounded-lg border-2 p-4 ${
                sendResult.success ? "border-success/30 bg-success/5" : "border-error/30 bg-error/5"
              }`}>
                <div className="flex items-center gap-2">
                  <Icon
                    icon={sendResult.success ? "mdi:check-circle" : "mdi:close-circle"}
                    size={20}
                    className={sendResult.success ? "text-success" : "text-error"}
                  />
                  <span className="font-semibold">
                    {sendResult.success
                      ? `${sendResult.count} message(s) sent successfully!`
                      : "Failed to send messages"}
                  </span>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2 pt-2">
              <Button
                onClick={handleSend}
                disabled={allRecipients.length === 0 || (!form.subject && !form.content) || sending}
              >
                {sending ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent mr-2" />
                ) : (
                  <Icon icon="mdi:send" size={16} className="mr-1" />
                )}
                Send to {allRecipients.length} Recipient(s)
              </Button>
              <Button variant="outline" onClick={() => setShowPreview(!showPreview)}>
                <Icon icon="mdi:eye-outline" size={16} className="mr-1" />
                {showPreview ? "Hide Preview" : "Preview"}
              </Button>
            </div>
          </TabsContent>

          {/* ── History Tab ──────────────────────────────────── */}
          <TabsContent value="history">
            <Table
              rowKey="id"
              size="small"
              scroll={{ x: "max-content" }}
              columns={historyColumns}
              dataSource={communications}
              loading={loading}
              pagination={{ current: page, total, pageSize: 20, showSizeChanger: false, onChange: (p) => setPage(p) }}
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
