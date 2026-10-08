import { Icon } from "@/components/icon";
import { Avatar } from "@/ui/avatar";
import { Badge } from "@/ui/badge";
import { Button } from "@/ui/button";
import { Card, CardContent, CardHeader } from "@/ui/card";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { Textarea } from "@/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/ui/dialog";
import { useEffect, useState, useCallback } from "react";
import {
  CommentApi,
  CommunicationApi,
  type Comment,
  type Communication,
} from "@/api/services/erpService";

interface TimelineItem {
  type: "comment" | "communication";
  data: Comment | Communication;
  date: string;
}

interface TimelineProps {
  referenceDoctype: string;
  referenceName: string;
  /** Called after a new comment/communication is posted to refresh parent */
  onRefresh?: () => void;
}

const COMMENT_TYPES = [
  { value: "Comment", label: "Comment", icon: "mdi:comment-outline", color: "info" },
  { value: "Info", label: "Info", icon: "mdi:information-outline", color: "default" },
  { value: "Edit", label: "Edit", icon: "mdi:pencil-outline", color: "warning" },
  { value: "Closed", label: "Closed", icon: "mdi:check-circle-outline", color: "success" },
  { value: "Reopened", label: "Reopened", icon: "mdi:refresh", color: "warning" },
];

const MEDIUM_COLORS: Record<string, string> = {
  Phone: "bg-blue-100 text-blue-700",
  Email: "bg-purple-100 text-purple-700",
  Chat: "bg-green-100 text-green-700",
  Meeting: "bg-orange-100 text-orange-700",
  Other: "bg-gray-100 text-gray-700",
};

export default function Timeline({ referenceDoctype, referenceName, onRefresh }: TimelineProps) {
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [commentType, setCommentType] = useState("Comment");
  const [showCommDialog, setShowCommDialog] = useState(false);
  const [commForm, setCommForm] = useState({
    subject: "",
    content: "",
    communication_medium: "Email",
    recipients: "",
    cc: "",
  });

  const loadTimeline = useCallback(async () => {
    if (!referenceDoctype || !referenceName) return;
    setLoading(true);
    try {
      const res = await CommentApi.timeline(referenceDoctype, referenceName);
      setItems((res as any) || []);
    } catch (err) {
      console.error("Failed to load timeline:", err);
    } finally {
      setLoading(false);
    }
  }, [referenceDoctype, referenceName]);

  useEffect(() => {
    loadTimeline();
  }, [loadTimeline]);

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    try {
      await CommentApi.create({
        comment_type: commentType as any,
        content: newComment,
        reference_doctype: referenceDoctype,
        reference_name: referenceName,
      } as any);
      setNewComment("");
      loadTimeline();
      onRefresh?.();
    } catch (err) {
      console.error("Failed to add comment:", err);
    }
  };

  const handleAddCommunication = async () => {
    if (!commForm.content.trim() && !commForm.subject.trim()) return;
    try {
      await CommunicationApi.create({
        subject: commForm.subject || undefined,
        content: commForm.content,
        communication_medium: commForm.communication_medium,
        recipients: commForm.recipients,
        cc: commForm.cc || undefined,
        reference_doctype: referenceDoctype,
        reference_name: referenceName,
      } as any);
      setCommForm({ subject: "", content: "", communication_medium: "Email", recipients: "", cc: "" });
      setShowCommDialog(false);
      loadTimeline();
      onRefresh?.();
    } catch (err) {
      console.error("Failed to add communication:", err);
    }
  };

  const handleDelete = async (type: string, id: number | string) => {
    if (!window.confirm("Delete this item?")) return;
    try {
      if (type === "comment") {
        await CommentApi.delete(id);
      } else {
        await CommunicationApi.delete(id as number);
      }
      loadTimeline();
      onRefresh?.();
    } catch (err) {
      console.error("Failed to delete:", err);
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const renderCommentItem = (item: TimelineItem) => {
    const comment = item.data as Comment;
    const typeInfo = COMMENT_TYPES.find((t) => t.value === comment.comment_type) || COMMENT_TYPES[0];
    return (
      <div className="flex gap-3" key={`comment-${comment.id}`}>
        <div className="relative flex flex-col items-center">
          <Avatar className="h-8 w-8 border-2 border-background">
            <div className="flex h-full w-full items-center justify-center rounded-full bg-primary/10">
              <Icon icon={typeInfo.icon as any} size={14} className="text-primary" />
            </div>
          </Avatar>
          <div className="mt-1 h-full w-px bg-border" />
        </div>
        <div className="flex-1 pb-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">{comment.comment_user_name || comment.comment_by || comment.owner}</span>
            <Badge variant={typeInfo.color as any} className="text-xs">
              {typeInfo.label}
            </Badge>
            <span className="text-xs text-text-secondary">{formatDate(comment.creation)}</span>
            <Button
              variant="ghost"
              size="icon"
              className="ml-auto h-6 w-6"
              onClick={() => handleDelete("comment", comment.id)}
            >
              <Icon icon="mingcute:delete-2-fill" size={12} className="text-error" />
            </Button>
          </div>
          <div
            className="mt-1 text-sm text-text-secondary"
            dangerouslySetInnerHTML={{ __html: comment.content || "" }}
          />
        </div>
      </div>
    );
  };

  const renderCommunicationItem = (item: TimelineItem) => {
    const comm = item.data as Communication;
    const mediumColor = MEDIUM_COLORS[comm.communication_medium] || MEDIUM_COLORS.Other;
    return (
      <div className="flex gap-3" key={`comm-${comm.id}`}>
        <div className="relative flex flex-col items-center">
          <Avatar className="h-8 w-8 border-2 border-background">
            <div className="flex h-full w-full items-center justify-center rounded-full bg-purple-100">
              <Icon
                icon={
                  comm.communication_medium === "Email"
                    ? "mdi:email-outline"
                    : comm.communication_medium === "Phone"
                    ? "mdi:phone-outline"
                    : comm.communication_medium === "Chat"
                    ? "mdi:chat-outline"
                    : comm.communication_medium === "Meeting"
                    ? "mdi:account-group-outline"
                    : "mdi:message-text-outline"
                }
                size={14}
                className="text-purple-600"
              />
            </div>
          </Avatar>
          <div className="mt-1 h-full w-px bg-border" />
        </div>
        <div className="flex-1 pb-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">{comm.sender_name_display || comm.sender || comm.user_name || comm.owner}</span>
            <Badge className={`text-xs ${mediumColor}`}>{comm.communication_medium}</Badge>
            <Badge variant={comm.sent_or_received === "Sent" ? "info" : "success"} className="text-xs">
              {comm.sent_or_received}
            </Badge>
            {comm.status && (
              <Badge variant={comm.status === "Open" ? "warning" : comm.status === "Closed" ? "error" : "default"} className="text-xs">
                {comm.status}
              </Badge>
            )}
            <span className="text-xs text-text-secondary">{formatDate(comm.communication_date || comm.creation)}</span>
            <Button
              variant="ghost"
              size="icon"
              className="ml-auto h-6 w-6"
              onClick={() => handleDelete("communication", comm.id)}
            >
              <Icon icon="mingcute:delete-2-fill" size={12} className="text-error" />
            </Button>
          </div>
          {comm.subject && <div className="mt-0.5 text-sm font-medium">{comm.subject}</div>}
          <div
            className="mt-1 text-sm text-text-secondary"
            dangerouslySetInnerHTML={{ __html: comm.content || "" }}
          />
          {comm.to_list && comm.to_list.length > 0 && (
            <div className="mt-1 text-xs text-text-secondary">
              To: {comm.to_list.join(", ")}
            </div>
          )}
          {comm.cc_list && comm.cc_list.length > 0 && (
            <div className="mt-0.5 text-xs text-text-secondary">
              CC: {comm.cc_list.join(", ")}
            </div>
          )}
          {comm.timeline_links && comm.timeline_links.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {comm.timeline_links.map((link, i) => (
                <Badge key={i} variant="outline" className="text-xs">
                  <Icon icon="mdi:link" size={10} className="mr-0.5" />
                  {link.link_doctype}: {link.link_title || link.link_name}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon icon="mdi:timeline-clock-outline" size={20} className="text-primary" />
            <span className="text-base font-semibold">Timeline</span>
            {items.length > 0 && (
              <Badge variant="outline" className="text-xs">
                {items.length}
              </Badge>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowCommDialog(true)}>
            <Icon icon="mdi:email-plus-outline" size={16} className="mr-1" /> Communication
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Add Comment Box */}
        <div className="mb-6 rounded-lg border bg-muted/30 p-3">
          <div className="flex items-center gap-2 mb-2">
            <Label className="text-xs">Type:</Label>
            <div className="flex gap-1">
              {COMMENT_TYPES.slice(0, 3).map((ct) => (
                <button
                  key={ct.value}
                  onClick={() => setCommentType(ct.value)}
                  className={`rounded-md px-2 py-0.5 text-xs font-medium transition-colors ${
                    commentType === ct.value
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted hover:bg-muted/80 text-text-secondary"
                  }`}
                >
                  {ct.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <Textarea
              placeholder="Add a comment..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              rows={2}
              className="flex-1 resize-none"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  handleAddComment();
                }
              }}
            />
            <Button
              size="sm"
              onClick={handleAddComment}
              disabled={!newComment.trim()}
              className="self-end"
            >
              <Icon icon="mdi:send" size={16} />
            </Button>
          </div>
          <div className="mt-1 text-xs text-text-secondary">
            Press Ctrl+Enter to submit
          </div>
        </div>

        {/* Timeline Items */}
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : items.length === 0 ? (
          <div className="py-8 text-center text-text-secondary">
            <Icon icon="mdi:message-text-clock-outline" size={40} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">No activity yet</p>
            <p className="text-xs text-text-secondary">Add a comment or communication to get started</p>
          </div>
        ) : (
          <div className="space-y-0">
            {items.map((item) =>
              item.type === "comment" ? renderCommentItem(item) : renderCommunicationItem(item)
            )}
          </div>
        )}
      </CardContent>

      {/* Communication Dialog */}
      <Dialog open={showCommDialog} onOpenChange={setShowCommDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New Communication</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Medium</Label>
              <select
                className="col-span-3 h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                value={commForm.communication_medium}
                onChange={(e) => setCommForm({ ...commForm, communication_medium: e.target.value })}
              >
                <option value="Email">Email</option>
                <option value="Phone">Phone</option>
                <option value="Chat">Chat</option>
                <option value="Meeting">Meeting</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Subject</Label>
              <Input
                className="col-span-3"
                value={commForm.subject}
                onChange={(e) => setCommForm({ ...commForm, subject: e.target.value })}
                placeholder="Subject (auto-generated if empty)"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Recipients</Label>
              <Input
                className="col-span-3"
                value={commForm.recipients}
                onChange={(e) => setCommForm({ ...commForm, recipients: e.target.value })}
                placeholder="email1@example.com, email2@example.com"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">CC</Label>
              <Input
                className="col-span-3"
                value={commForm.cc}
                onChange={(e) => setCommForm({ ...commForm, cc: e.target.value })}
                placeholder="cc@example.com (optional)"
              />
            </div>
            <div className="grid grid-cols-4 items-start gap-4">
              <Label className="text-right pt-2">Content</Label>
              <Textarea
                className="col-span-3"
                value={commForm.content}
                onChange={(e) => setCommForm({ ...commForm, content: e.target.value })}
                rows={5}
                placeholder="Message content..."
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowCommDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAddCommunication}
              disabled={!commForm.content.trim() && !commForm.subject.trim()}
            >
              <Icon icon="mdi:send" size={16} className="mr-1" /> Send
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
