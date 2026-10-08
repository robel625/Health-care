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
import { CommentApi, type Comment } from "@/api/services/erpService";

const COMMENT_TYPE_VARIANTS: Record<string, "default" | "info" | "warning" | "success" | "error"> = {
  Comment: "info",
  Info: "default",
  Edit: "warning",
  Submitted: "info",
  Cancelled: "error",
  Closed: "success",
  Reopened: "warning",
};

export default function CommentsPage() {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [doctypeFilter, setDoctypeFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    comment_type: "Comment",
    subject: "",
    content: "",
    reference_doctype: "",
    reference_name: "",
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = { page };
      if (search) params.search = search;
      if (typeFilter) params.comment_type = typeFilter;
      if (doctypeFilter) params.reference_doctype = doctypeFilter;
      const res = await CommentApi.list(params);
      setComments(res.results || []);
      setTotal(res.count || 0);
    } catch (err) {
      console.error("Failed to load comments:", err);
    } finally {
      setLoading(false);
    }
  }, [page, search, typeFilter, doctypeFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleDelete = async (id: number | string) => {
    if (!window.confirm("Delete this comment?")) return;
    try {
      await CommentApi.delete(id);
      loadData();
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  const handleCreate = async () => {
    try {
      await CommentApi.create(form as any);
      setShowForm(false);
      setForm({ comment_type: "Comment", subject: "", content: "", reference_doctype: "", reference_name: "" });
      loadData();
    } catch (err) {
      console.error("Create failed:", err);
    }
  };

  const columns: ColumnsType<Comment> = [
    {
      title: "Type",
      dataIndex: "comment_type",
      width: 120,
      render: (type) => (
        <Badge variant={COMMENT_TYPE_VARIANTS[type] || "default"}>{type}</Badge>
      ),
    },
    {
      title: "Content",
      dataIndex: "content",
      width: 350,
      render: (_, record) => (
        <div>
          {record.subject && <div className="font-medium text-sm">{record.subject}</div>}
          <div
            className="text-xs text-text-secondary line-clamp-2"
            dangerouslySetInnerHTML={{ __html: record.content || "" }}
          />
        </div>
      ),
    },
    {
      title: "Author",
      dataIndex: "comment_user_name",
      width: 160,
      render: (_, record) => record.comment_user_name || record.comment_by || record.owner || "-",
    },
    {
      title: "Reference",
      dataIndex: "reference_doctype",
      width: 180,
      render: (_, record) =>
        record.reference_doctype ? (
          <span className="text-xs font-mono">
            {record.reference_doctype}: {record.reference_name}
          </span>
        ) : (
          "-"
        ),
    },
    {
      title: "Created",
      dataIndex: "creation",
      width: 160,
      render: (v) => (v ? new Date(v).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "-"),
    },
  ];

  // Get unique doctypes from comments for filter
  const uniqueDocTypes = [...new Set(comments.map((c) => c.reference_doctype).filter(Boolean))];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon icon="mdi:comment-multiple-outline" size={22} className="text-primary" />
            <span className="text-lg font-semibold">Comments</span>
            <Badge variant="outline">{total}</Badge>
          </div>
          <div className="flex items-center gap-2">
            <select
              className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
              value={typeFilter}
              onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
            >
              <option value="">All Types</option>
              <option value="Comment">Comment</option>
              <option value="Info">Info</option>
              <option value="Edit">Edit</option>
              <option value="Submitted">Submitted</option>
              <option value="Cancelled">Cancelled</option>
              <option value="Closed">Closed</option>
              <option value="Reopened">Reopened</option>
            </select>
            <select
              className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
              value={doctypeFilter}
              onChange={(e) => { setDoctypeFilter(e.target.value); setPage(1); }}
            >
              <option value="">All References</option>
              {uniqueDocTypes.map((dt) => (
                <option key={dt} value={dt}>{dt}</option>
              ))}
            </select>
            <Input
              placeholder="Search comments..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (setPage(1), loadData())}
              className="w-56"
            />
            <Button onClick={() => setShowForm(true)}>
              <Icon icon="mdi:plus" size={18} className="mr-1" /> New Comment
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
              width: 80,
              render: (_, record) => (
                <Button variant="ghost" size="icon" onClick={() => handleDelete(record.id)}>
                  <Icon icon="mingcute:delete-2-fill" size={18} className="text-error!" />
                </Button>
              ),
            },
          ]}
          dataSource={comments}
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

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New Comment</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Type</Label>
              <select
                className="col-span-3 h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                value={form.comment_type}
                onChange={(e) => setForm({ ...form, comment_type: e.target.value })}
              >
                <option value="Comment">Comment</option>
                <option value="Info">Info</option>
                <option value="Edit">Edit</option>
                <option value="Closed">Closed</option>
                <option value="Reopened">Reopened</option>
              </select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Subject</Label>
              <Input
                className="col-span-3"
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                placeholder="Optional subject"
              />
            </div>
            <div className="grid grid-cols-4 items-start gap-4">
              <Label className="text-right pt-2">Content *</Label>
              <Textarea
                className="col-span-3"
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                rows={4}
                placeholder="Comment content..."
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
            <Button onClick={handleCreate} disabled={!form.content.trim()}>Create</Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
