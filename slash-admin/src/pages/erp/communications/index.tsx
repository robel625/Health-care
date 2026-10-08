import { Icon } from "@/components/icon";
import { Badge } from "@/ui/badge";
import { Button } from "@/ui/button";
import { Card, CardContent, CardHeader } from "@/ui/card";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { Textarea } from "@/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/ui/dialog";
import Table, { type ColumnsType } from "antd/es/table";
import { useEffect, useState, useCallback } from "react";
import { CommunicationApi, type Communication } from "@/api/services/erpService";

const MEDIUM_BADGES: Record<string, string> = {
  Phone: "bg-blue-100 text-blue-700 border-blue-200",
  Email: "bg-purple-100 text-purple-700 border-purple-200",
  Chat: "bg-green-100 text-green-700 border-green-200",
  Meeting: "bg-orange-100 text-orange-700 border-orange-200",
  Other: "bg-gray-100 text-gray-700 border-gray-200",
};

const STATUS_VARIANTS: Record<string, "default" | "info" | "warning" | "success" | "error"> = {
  Open: "warning",
  Replied: "info",
  Linked: "info",
  Closed: "success",
};

export default function CommunicationsPage() {
  const [communications, setCommunications] = useState<Communication[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [mediumFilter, setMediumFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [detailComm, setDetailComm] = useState<Communication | null>(null);

  const [form, setForm] = useState({
    subject: "",
    content: "",
    communication_medium: "Email",
    communication_type: "Communication",
    recipients: "",
    cc: "",
    bcc: "",
    phone_no: "",
    reference_doctype: "",
    reference_name: "",
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = { page };
      if (search) params.search = search;
      if (mediumFilter) params.communication_medium = mediumFilter;
      if (statusFilter) params.status = statusFilter;
      const res = await CommunicationApi.list(params);
      setCommunications(res.results || []);
      setTotal(res.count || 0);
    } catch (err) {
      console.error("Failed to load communications:", err);
    } finally {
      setLoading(false);
    }
  }, [page, search, mediumFilter, statusFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleDelete = async (id: number) => {
    if (!window.confirm("Delete this communication?")) return;
    try {
      await CommunicationApi.delete(id);
      loadData();
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  const handleMarkRead = async (id: number) => {
    try {
      await CommunicationApi.markRead(id);
      loadData();
    } catch (err) {
      console.error("Mark read failed:", err);
    }
  };

  const handleCreate = async () => {
    try {
      await CommunicationApi.create(form as any);
      setShowForm(false);
      setForm({
        subject: "",
        content: "",
        communication_medium: "Email",
        communication_type: "Communication",
        recipients: "",
        cc: "",
        bcc: "",
        phone_no: "",
        reference_doctype: "",
        reference_name: "",
      });
      loadData();
    } catch (err) {
      console.error("Create failed:", err);
    }
  };

  const columns: ColumnsType<Communication> = [
    {
      title: "Medium",
      dataIndex: "communication_medium",
      width: 100,
      render: (medium) => (
        <Badge className={`text-xs border ${MEDIUM_BADGES[medium] || MEDIUM_BADGES.Other}`}>
          <Icon
            icon={
              medium === "Email"
                ? "mdi:email-outline"
                : medium === "Phone"
                ? "mdi:phone-outline"
                : medium === "Chat"
                ? "mdi:chat-outline"
                : medium === "Meeting"
                ? "mdi:account-group-outline"
                : "mdi:message-text-outline"
            }
            size={12}
            className="mr-1"
          />
          {medium}
        </Badge>
      ),
    },
    {
      title: "Subject",
      dataIndex: "subject",
      width: 250,
      render: (_, record) => (
        <div>
          <div className="font-medium text-sm line-clamp-1">{record.subject || "(no subject)"}</div>
          <div className="text-xs text-text-secondary line-clamp-1">
            {record.content ? record.content.replace(/<[^>]+>/g, "").substring(0, 80) : ""}
          </div>
        </div>
      ),
    },
    {
      title: "From",
      dataIndex: "sender_name_display",
      width: 160,
      render: (_, record) => (
        <span className="text-sm">
          {record.sender_name_display || record.sender || record.user_name || record.owner || "-"}
        </span>
      ),
    },
    {
      title: "To",
      dataIndex: "recipients",
      width: 180,
      render: (_, record) => (
        <span className="text-xs text-text-secondary line-clamp-1">
          {record.to_list && record.to_list.length > 0 ? record.to_list.join(", ") : record.recipients || "-"}
        </span>
      ),
    },
    {
      title: "Status",
      dataIndex: "status",
      width: 90,
      render: (status) => (
        <Badge variant={STATUS_VARIANTS[status] || "default"}>{status || "-"}</Badge>
      ),
    },
    {
      title: "Direction",
      dataIndex: "sent_or_received",
      width: 90,
      render: (v) => (
        <Badge variant={v === "Sent" ? "info" : v === "Received" ? "success" : "default"}>
          {v || "-"}
        </Badge>
      ),
    },
    {
      title: "Date",
      dataIndex: "communication_date",
      width: 140,
      render: (v, record) => {
        const date = v || record.creation;
        return date
          ? new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })
          : "-";
      },
    },
    {
      title: "Ref",
      dataIndex: "reference_doctype",
      width: 140,
      render: (_, record) =>
        record.reference_doctype ? (
          <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">
            {record.reference_doctype}: {record.reference_name}
          </span>
        ) : (
          "-"
        ),
    },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon icon="mdi:message-text-multiple-outline" size={22} className="text-primary" />
            <span className="text-lg font-semibold">Communications</span>
            <Badge variant="outline">{total}</Badge>
          </div>
          <div className="flex items-center gap-2">
            <select
              className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
              value={mediumFilter}
              onChange={(e) => { setMediumFilter(e.target.value); setPage(1); }}
            >
              <option value="">All Mediums</option>
              <option value="Email">Email</option>
              <option value="Phone">Phone</option>
              <option value="Chat">Chat</option>
              <option value="Meeting">Meeting</option>
              <option value="Other">Other</option>
            </select>
            <select
              className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            >
              <option value="">All Status</option>
              <option value="Open">Open</option>
              <option value="Replied">Replied</option>
              <option value="Linked">Linked</option>
              <option value="Closed">Closed</option>
            </select>
            <Input
              placeholder="Search communications..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (setPage(1), loadData())}
              className="w-56"
            />
            <Button onClick={() => setShowForm(true)}>
              <Icon icon="mdi:plus" size={18} className="mr-1" /> New Communication
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Table
          rowKey="id"
          size="small"
          scroll={{ x: "max-content" }}
          columns={[
            ...columns,
            {
              title: "Action",
              key: "action",
              align: "center",
              width: 120,
              render: (_, record) => (
                <div className="flex w-full justify-center gap-1">
                  <Button variant="ghost" size="icon" onClick={() => setDetailComm(record)}>
                    <Icon icon="mdi:eye-outline" size={18} />
                  </Button>
                  {!record.read_by_recipient && record.sent_or_received === "Received" && (
                    <Button variant="ghost" size="icon" onClick={() => handleMarkRead(record.id)}>
                      <Icon icon="mdi:email-open-outline" size={18} className="text-info" />
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(record.id)}>
                    <Icon icon="mingcute:delete-2-fill" size={18} className="text-error!" />
                  </Button>
                </div>
              ),
            },
          ]}
          dataSource={communications}
          loading={loading}
          pagination={{
            current: page,
            total,
            pageSize: 20,
            showSizeChanger: false,
            onChange: (p) => setPage(p),
          }}
        />
      </CardContent>

      {/* Create Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Communication</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Medium</Label>
              <select
                className="col-span-3 h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                value={form.communication_medium}
                onChange={(e) => setForm({ ...form, communication_medium: e.target.value })}
              >
                <option value="Email">Email</option>
                <option value="Phone">Phone</option>
                <option value="Chat">Chat</option>
                <option value="Meeting">Meeting</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Type</Label>
              <select
                className="col-span-3 h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                value={form.communication_type}
                onChange={(e) => setForm({ ...form, communication_type: e.target.value })}
              >
                <option value="Communication">Communication</option>
                <option value="Comment">Comment</option>
                <option value="Auto Reply">Auto Reply</option>
              </select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Subject</Label>
              <Input
                className="col-span-3"
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                placeholder="Subject (auto-generated if empty)"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Recipients *</Label>
              <Input
                className="col-span-3"
                value={form.recipients}
                onChange={(e) => setForm({ ...form, recipients: e.target.value })}
                placeholder="email1@example.com, email2@example.com"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">CC</Label>
              <Input
                className="col-span-3"
                value={form.cc}
                onChange={(e) => setForm({ ...form, cc: e.target.value })}
                placeholder="cc@example.com (optional)"
              />
            </div>
            {form.communication_medium === "Phone" && (
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Phone No</Label>
                <Input
                  className="col-span-3"
                  value={form.phone_no}
                  onChange={(e) => setForm({ ...form, phone_no: e.target.value })}
                  placeholder="+1-555-0100"
                />
              </div>
            )}
            <div className="grid grid-cols-4 items-start gap-4">
              <Label className="text-right pt-2">Content *</Label>
              <Textarea
                className="col-span-3"
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                rows={5}
                placeholder="Message content..."
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Reference DocType</Label>
              <Input
                className="col-span-3"
                value={form.reference_doctype}
                onChange={(e) => setForm({ ...form, reference_doctype: e.target.value })}
                placeholder="e.g. Customer, Sales Order"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Reference Name</Label>
              <Input
                className="col-span-3"
                value={form.reference_name}
                onChange={(e) => setForm({ ...form, reference_name: e.target.value })}
                placeholder="e.g. CUST-00001"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!form.content.trim() && !form.subject.trim()}>
              <Icon icon="mdi:send" size={16} className="mr-1" /> Send
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={!!detailComm} onOpenChange={() => setDetailComm(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{detailComm?.subject || "(no subject)"}</DialogTitle>
          </DialogHeader>
          {detailComm && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-text-secondary">Medium:</span>{" "}
                  <Badge className={MEDIUM_BADGES[detailComm.communication_medium] || ""}>
                    {detailComm.communication_medium}
                  </Badge>
                </div>
                <div>
                  <span className="text-text-secondary">Type:</span>{" "}
                  <Badge>{detailComm.communication_type}</Badge>
                </div>
                <div>
                  <span className="text-text-secondary">Status:</span>{" "}
                  <Badge variant={STATUS_VARIANTS[detailComm.status] || "default"}>
                    {detailComm.status}
                  </Badge>
                </div>
                <div>
                  <span className="text-text-secondary">Direction:</span>{" "}
                  <Badge variant={detailComm.sent_or_received === "Sent" ? "info" : "success"}>
                    {detailComm.sent_or_received}
                  </Badge>
                </div>
                <div>
                  <span className="text-text-secondary">From:</span>{" "}
                  {detailComm.sender_name_display || detailComm.sender || detailComm.user_name || detailComm.owner}
                </div>
                <div>
                  <span className="text-text-secondary">To:</span>{" "}
                  {detailComm.to_list?.join(", ") || detailComm.recipients || "-"}
                </div>
                {detailComm.cc_list && detailComm.cc_list.length > 0 && (
                  <div className="col-span-2">
                    <span className="text-text-secondary">CC:</span> {detailComm.cc_list.join(", ")}
                  </div>
                )}
                {detailComm.reference_doctype && (
                  <div className="col-span-2">
                    <span className="text-text-secondary">Reference:</span>{" "}
                    <span className="font-mono text-xs">
                      {detailComm.reference_doctype}: {detailComm.reference_name}
                    </span>
                  </div>
                )}
                <div>
                  <span className="text-text-secondary">Date:</span>{" "}
                  {detailComm.communication_date
                    ? new Date(detailComm.communication_date).toLocaleString()
                    : "-"}
                </div>
                <div>
                  <span className="text-text-secondary">Read:</span>{" "}
                  {detailComm.read_by_recipient ? "Yes" : "No"}
                </div>
              </div>
              <div className="border-t pt-4">
                <div
                  className="text-sm"
                  dangerouslySetInnerHTML={{ __html: detailComm.content || "" }}
                />
              </div>
              {detailComm.timeline_links && detailComm.timeline_links.length > 0 && (
                <div className="border-t pt-4">
                  <div className="text-xs font-semibold text-text-secondary mb-2">Timeline Links</div>
                  <div className="flex flex-wrap gap-1">
                    {detailComm.timeline_links.map((link, i) => (
                      <Badge key={i} variant="outline" className="text-xs">
                        <Icon icon="mdi:link" size={10} className="mr-0.5" />
                        {link.link_doctype}: {link.link_title || link.link_name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
