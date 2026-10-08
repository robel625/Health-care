import { useState, useEffect, useCallback, useMemo } from "react";
import { Icon } from "@/components/icon";
import { Button } from "@/ui/button";
import { Card, CardContent, CardHeader } from "@/ui/card";
import { Textarea } from "@/ui/textarea";
import { Badge } from "@/ui/badge";
import Avatar from "@/components/Avatar";
import { useUserInfo } from "@/store/userStore";
import { CommentApi, type Comment } from "@/api/services/erpService";
import { toast } from "sonner";
import { cn } from "@/utils";

export interface ActivityItem {
  id?: any;
  text: string;
  time?: string;
  reference_doctype?: string;
  reference_name?: string;
  user?: string;
}

interface DocumentTimelineProps {
  /** The Frappe DocType, e.g. "Patient", "Healthcare Practitioner", "Observation" */
  doctype: string;
  /** Primary record identifier (e.g. id "1") */
  docname: string;
  /** Optional secondary identifier (e.g. naming series "HLC-PAT-2026-00001") */
  altDocname?: string;
  /** Activity stream passed from parent (e.g. medical records, encounters, appointments) */
  activity?: ActivityItem[];
  /** Callback to refresh parent activity */
  onActivityRefresh?: () => void;
  className?: string;
}

const DOCTYPE_THEMES: Record<string, { icon: string; bullet: string; badge: string }> = {
  "Patient Appointment": {
    icon: "solar:calendar-bold-duotone",
    bullet: "bg-blue-500",
    badge: "bg-blue-50 text-blue-700 border-blue-200",
  },
  "Patient Encounter": {
    icon: "solar:clipboard-text-bold-duotone",
    bullet: "bg-emerald-500",
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  "Vital Signs": {
    icon: "solar:heart-pulse-bold-duotone",
    bullet: "bg-red-500",
    badge: "bg-red-50 text-red-700 border-red-200",
  },
  "Lab Test": {
    icon: "solar:flask-bold-duotone",
    bullet: "bg-purple-500",
    badge: "bg-purple-50 text-purple-700 border-purple-200",
  },
  "Drug Prescription": {
    icon: "solar:pill-bold-duotone",
    bullet: "bg-amber-500",
    badge: "bg-amber-50 text-amber-700 border-amber-200",
  },
  "Therapy Plan": {
    icon: "solar:dumbbell-small-bold-duotone",
    bullet: "bg-teal-500",
    badge: "bg-teal-50 text-teal-700 border-teal-200",
  },
  "Therapy Session": {
    icon: "solar:dumbbell-bold-duotone",
    bullet: "bg-teal-600",
    badge: "bg-teal-50 text-teal-800 border-teal-200",
  },
  "Inpatient Record": {
    icon: "solar:hospital-bold-duotone",
    bullet: "bg-indigo-500",
    badge: "bg-indigo-50 text-indigo-700 border-indigo-200",
  },
  "Observation": {
    icon: "solar:eye-bold-duotone",
    bullet: "bg-violet-500",
    badge: "bg-violet-50 text-violet-700 border-violet-200",
  },
  "Patient": {
    icon: "solar:user-bold-duotone",
    bullet: "bg-cyan-500",
    badge: "bg-cyan-50 text-cyan-700 border-cyan-200",
  },
  "Patient Medical Record": {
    icon: "solar:document-text-bold-duotone",
    bullet: "bg-slate-500",
    badge: "bg-slate-50 text-slate-700 border-slate-200",
  },
};

/** Robust date parser handling full ISO, UTC Z, local SQL dates, and date-only strings without timezone drift */
export function parseTimelineDate(val?: string | Date | null): Date {
  if (!val) return new Date(0);
  if (val instanceof Date) return val;
  const s = String(val).trim();
  if (!s) return new Date(0);

  // If bare date like "2026-09-28"
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split("-").map(Number);
    // Parse as local date at noon so it doesn't shift backward into the previous day
    return new Date(y, m - 1, d, 12, 0, 0);
  }

  // If "2026-09-28 14:30:00" (SQL datetime without T/Z)
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(s)) {
    return new Date(s.replace(" ", "T"));
  }

  const d = new Date(s);
  return isNaN(d.getTime()) ? new Date(0) : d;
}

/** Formats ISO date to human relative string like "just now", "5m ago", "Yesterday", etc. */
function formatTime(isoString?: string): string {
  if (!isoString) return "";
  const s = String(isoString).trim();

  // If it's a date-only string or midnight-defaulted string without time:
  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(s) || /^\d{4}-\d{2}-\d{2}[T ]00:00:00(\.0+)?(Z|[+-]00:?00)?$/.test(s);
  if (isDateOnly) {
    const rawDatePart = s.slice(0, 10);
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const localToday = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

    // Check yesterday
    const yDate = new Date(now);
    yDate.setDate(now.getDate() - 1);
    const localYesterday = `${yDate.getFullYear()}-${pad(yDate.getMonth() + 1)}-${pad(yDate.getDate())}`;

    if (rawDatePart === localToday) return "Today";
    if (rawDatePart === localYesterday) return "Yesterday";
    const [y, m, d] = rawDatePart.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
  }

  const date = parseTimelineDate(s);
  if (isNaN(date.getTime()) || date.getTime() === 0) return isoString;

  const now = Date.now();
  const diffSec = Math.floor((now - date.getTime()) / 1000);

  // Within 60 seconds (also accounts for small client-server clock skews up to 2 mins into future)
  if (diffSec < 60 && diffSec >= -120) return "just now";
  if (diffSec < 3600 && diffSec >= 60) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400 && diffSec >= 3600) return `${Math.floor(diffSec / 3600)}h ago`;
  if (diffSec < 172800 && diffSec >= 86400) return "Yesterday";
  if (diffSec < 604800 && diffSec >= 172800) return `${Math.floor(diffSec / 86400)}d ago`;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/**
 * Marley-style Document Timeline for Healthcare forms.
 * Provides Comments management (create, view, edit, delete via CommentApi)
 * and an Activity stream (medical records, encounters, audit trail).
 */
export default function DocumentTimeline({
  doctype,
  docname,
  altDocname,
  activity = [],
  onActivityRefresh,
  className,
}: DocumentTimelineProps) {
  const userInfo = useUserInfo();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "comments" | "activity">("all");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");

  // In-place comment editing
  const [editingId, setEditingId] = useState<number | string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  // Load comments from backend
  const loadComments = useCallback(async () => {
    if (!docname || docname === "new") return;
    setLoading(true);
    try {
      const res = await CommentApi.list({
        reference_doctype: doctype,
        reference_name: String(docname),
        page_size: 100,
      });
      let list = res.results || [];

      // If altDocname is provided and different, fetch comments saved under it too
      if (altDocname && altDocname !== docname) {
        const altRes = await CommentApi.list({
          reference_doctype: doctype,
          reference_name: String(altDocname),
          page_size: 100,
        });
        const existingIds = new Set(list.map((c) => String(c.id)));
        for (const item of altRes.results || []) {
          if (!existingIds.has(String(item.id))) {
            list.push(item);
          }
        }
      }

      list.sort(
        (a, b) => new Date(b.creation).getTime() - new Date(a.creation).getTime()
      );
      setComments(list);
    } catch (err) {
      console.error("Failed to load comments:", err);
    } finally {
      setLoading(false);
    }
  }, [doctype, docname, altDocname]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  // Submit a new comment
  const handleSubmitComment = async () => {
    const text = commentText.trim();
    if (!text || !docname || docname === "new" || submitting) return;

    setSubmitting(true);
    try {
      const authorName =
        userInfo?.username ||
        (userInfo as any)?.first_name ||
        "Administrator";
      const authorEmail = userInfo?.email || "";

      await CommentApi.create({
        comment_type: "Comment",
        reference_doctype: doctype,
        reference_name: String(docname),
        content: text,
        comment_by: authorName,
        comment_email: authorEmail,
      });

      setCommentText("");
      toast.success("Comment posted");
      await loadComments();
      onActivityRefresh?.();
    } catch (err: any) {
      console.error("Failed to post comment:", err);
      toast.error(err?.message || "Failed to post comment");
    } finally {
      setSubmitting(false);
    }
  };

  // Delete a comment
  const handleDeleteComment = async (commentId: number | string) => {
    if (!window.confirm("Are you sure you want to delete this comment?")) return;
    try {
      await CommentApi.delete(commentId);
      toast.success("Comment deleted");
      await loadComments();
    } catch (err: any) {
      console.error("Failed to delete comment:", err);
      toast.error("Failed to delete comment");
    }
  };

  // Start editing a comment
  const handleStartEdit = (comment: Comment) => {
    setEditingId(comment.id);
    setEditingText(comment.content || "");
  };

  // Save edited comment
  const handleSaveEdit = async (commentId: number | string) => {
    const text = editingText.trim();
    if (!text || savingEdit) return;

    setSavingEdit(true);
    try {
      await CommentApi.update(commentId, { content: text });
      toast.success("Comment updated");
      setEditingId(null);
      await loadComments();
    } catch (err: any) {
      console.error("Failed to update comment:", err);
      toast.error("Failed to update comment");
    } finally {
      setSavingEdit(false);
    }
  };

  // Combine & sort all timeline items strictly by timestamp
  const timelineItems = useMemo(() => {
    const combined: Array<{
      type: "comment" | "activity";
      id: string;
      date: Date;
      timestamp: number;
      comment?: Comment;
      activity?: ActivityItem;
    }> = [];

    if (activeFilter !== "activity") {
      for (const c of comments) {
        const d = parseTimelineDate(c.creation);
        combined.push({
          type: "comment",
          id: `comment-${c.id}`,
          date: d,
          timestamp: d.getTime(),
          comment: c,
        });
      }
    }

    if (activeFilter !== "comments") {
      for (let i = 0; i < activity.length; i++) {
        const act = activity[i];
        const d = parseTimelineDate(act.time);
        combined.push({
          type: "activity",
          id: `activity-${act.id || i}`,
          date: d,
          timestamp: d.getTime(),
          activity: act,
        });
      }
    }

    combined.sort((a, b) => {
      if (sortOrder === "desc") {
        return b.timestamp - a.timestamp;
      }
      return a.timestamp - b.timestamp;
    });

    return combined;
  }, [comments, activity, activeFilter, sortOrder]);

  const authorInitials = (userInfo?.username || "A").slice(0, 2).toUpperCase();

  return (
    <Card className={cn("mt-6", className)}>
      <CardHeader className="pb-3 border-b">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Icon icon="solar:chat-round-dots-bold" size={20} className="text-blue-600" />
            <h3 className="font-semibold text-base">Comments & Activity</h3>
            {comments.length > 0 && (
              <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                {comments.length} {comments.length === 1 ? "comment" : "comments"}
              </Badge>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Sort Toggle Button */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSortOrder((prev) => (prev === "desc" ? "asc" : "desc"))}
              className="h-8 text-xs px-2.5 gap-1.5 font-medium border bg-background hover:bg-muted"
              title={`Sort by time: currently ${sortOrder === "desc" ? "Newest First" : "Oldest First"}. Click to toggle.`}
            >
              <Icon
                icon={sortOrder === "desc" ? "solar:sort-from-top-to-bottom-bold" : "solar:sort-from-bottom-to-top-bold"}
                size={14}
                className="text-primary"
              />
              <span>{sortOrder === "desc" ? "Newest First" : "Oldest First"}</span>
            </Button>

            {/* Filter Pills */}
            <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg">
              <button
                type="button"
                onClick={() => setActiveFilter("all")}
                className={cn(
                  "px-2.5 py-1 text-xs font-medium rounded-md transition-colors",
                  activeFilter === "all"
                    ? "bg-background shadow-xs text-foreground font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                All ({comments.length + activity.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveFilter("comments")}
                className={cn(
                  "px-2.5 py-1 text-xs font-medium rounded-md transition-colors",
                  activeFilter === "comments"
                    ? "bg-background shadow-xs text-blue-700 font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Comments ({comments.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveFilter("activity")}
                className={cn(
                  "px-2.5 py-1 text-xs font-medium rounded-md transition-colors",
                  activeFilter === "activity"
                    ? "bg-background shadow-xs text-emerald-700 font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Activity ({activity.length})
              </button>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-4 space-y-6">
        {/* Comment Box (Marley-style) */}
        <div className="rounded-lg border bg-card p-3 shadow-xs">
          <div className="flex gap-3 items-start">
            <Avatar
              name={userInfo?.username || "Admin"}
              fallback={authorInitials}
              tone="blue"
              size="md"
              className="mt-0.5 shrink-0"
            />
            <div className="flex-1 min-w-0">
              <Textarea
                placeholder="Type a reply / comment... (Press Ctrl+Enter to post)"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    handleSubmitComment();
                  }
                }}
                rows={2}
                className="resize-none text-sm min-h-[64px] border-muted focus-visible:ring-blue-500"
              />
              <div className="flex items-center justify-between mt-2 pt-1">
                <span className="text-xs text-muted-foreground hidden sm:inline">
                  Press <kbd className="px-1.5 py-0.5 text-[10px] bg-muted border rounded font-mono">Ctrl+Enter</kbd> to submit
                </span>
                <Button
                  size="sm"
                  onClick={handleSubmitComment}
                  disabled={!commentText.trim() || submitting}
                  className="bg-blue-600 hover:bg-blue-700 text-white ml-auto flex items-center gap-1.5 h-8 px-3"
                >
                  <Icon icon="solar:chat-round-dots-bold" size={15} />
                  <span>{submitting ? "Posting..." : "Comment"}</span>
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Timeline Stream */}
        {loading && comments.length === 0 ? (
          <div className="py-8 flex justify-center items-center gap-2 text-sm text-muted-foreground">
            <Icon icon="solar:refresh-circle-bold" size={20} className="animate-spin text-blue-600" />
            <span>Loading timeline...</span>
          </div>
        ) : timelineItems.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground border rounded-lg border-dashed">
            <Icon icon="solar:chat-line-broken" size={36} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm font-medium">No {activeFilter === "comments" ? "comments" : activeFilter === "activity" ? "activity" : "comments or activity"} yet</p>
            <p className="text-xs text-muted-foreground mt-0.5">Use the box above to post the first comment.</p>
          </div>
        ) : (
          <div className="relative pl-6 space-y-4">
            {/* Timeline vertical connector line */}
            <div className="absolute left-[13px] top-2 bottom-2 w-px bg-border" />

            {timelineItems.map((item) => {
              if (item.type === "comment" && item.comment) {
                const c = item.comment;
                const author = c.comment_user_name || c.comment_by || c.owner || "User";
                const isEditing = editingId === c.id;

                return (
                  <div key={item.id} className="relative group">
                    {/* Bullet marker */}
                    <div className="absolute -left-6 top-2 w-3.5 h-3.5 rounded-full bg-blue-500 border-2 border-background z-10" />

                    <div className="ml-2 rounded-lg border bg-card p-3.5 shadow-xs transition-colors hover:border-blue-200 dark:hover:border-blue-900">
                      {/* Comment Header */}
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <Avatar name={author} size="sm" tone="blue" />
                          <span className="font-semibold text-sm truncate">{author}</span>
                          <span className="text-xs text-muted-foreground">·</span>
                          <span
                            className="text-xs text-muted-foreground shrink-0 cursor-default"
                            title={item.date && item.date.getTime() > 0 ? item.date.toLocaleString("en-US", { hour12: true }) : c.creation}
                          >
                            {formatTime(c.creation)}
                          </span>
                          {c.comment_type && c.comment_type !== "Comment" && (
                            <Badge variant="outline" className="text-[10px] py-0 px-1.5 bg-muted text-muted-foreground">
                              {c.comment_type}
                            </Badge>
                          )}
                        </div>

                        {/* Actions: Edit & Delete */}
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            title="Edit comment"
                            onClick={() => handleStartEdit(c)}
                            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                          >
                            <Icon icon="solar:pen-linear" size={14} />
                          </button>
                          <button
                            type="button"
                            title="Delete comment"
                            onClick={() => handleDeleteComment(c.id)}
                            className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-950/30 text-muted-foreground hover:text-red-600"
                          >
                            <Icon icon="solar:trash-bin-trash-bold" size={14} />
                          </button>
                        </div>
                      </div>

                      {/* Comment Content / Editor */}
                      {isEditing ? (
                        <div className="mt-2 space-y-2">
                          <Textarea
                            value={editingText}
                            onChange={(e) => setEditingText(e.target.value)}
                            rows={3}
                            className="text-sm resize-none"
                          />
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setEditingId(null)}
                              disabled={savingEdit}
                            >
                              Cancel
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleSaveEdit(c.id)}
                              disabled={!editingText.trim() || savingEdit}
                              className="bg-blue-600 hover:bg-blue-700 text-white"
                            >
                              {savingEdit ? "Saving..." : "Save"}
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                          {c.content}
                        </p>
                      )}
                    </div>
                  </div>
                );
              }

              if (item.type === "activity" && item.activity) {
                const act = item.activity;
                const theme = (act.reference_doctype && DOCTYPE_THEMES[act.reference_doctype]) || {
                  icon: "solar:history-bold",
                  bullet: "bg-emerald-500",
                  badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
                };

                return (
                  <div key={item.id} className="relative">
                    {/* Bullet marker */}
                    <div className={cn("absolute -left-6 top-2 w-3.5 h-3.5 rounded-full border-2 border-background z-10", theme.bullet)} />

                    <div className="ml-2 rounded-lg border bg-card p-3 shadow-xs hover:border-muted-foreground/30 transition-colors">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <Icon icon={theme.icon} size={16} className="shrink-0 text-muted-foreground" />
                          {act.reference_doctype && (
                            <Badge variant="outline" className={cn("text-[10px] py-0 px-1.5 font-medium", theme.badge)}>
                              {act.reference_doctype} {act.reference_name && `#${act.reference_name}`}
                            </Badge>
                          )}
                          {act.user && (
                            <>
                              <span className="text-xs text-muted-foreground">·</span>
                              <span className="text-xs font-medium text-foreground truncate">{act.user}</span>
                            </>
                          )}
                        </div>
                        <span
                          className="text-xs text-muted-foreground shrink-0 cursor-default"
                          title={item.date && item.date.getTime() > 0 ? item.date.toLocaleString("en-US", { hour12: true }) : act.time}
                        >
                          {formatTime(act.time)}
                        </span>
                      </div>
                      <p className="text-sm text-foreground/90 pl-6 leading-relaxed">{act.text}</p>
                    </div>
                  </div>
                );
              }

              return null;
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
