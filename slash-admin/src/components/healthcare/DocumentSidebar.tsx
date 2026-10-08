import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Icon } from "@/components/icon";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { Separator } from "@/ui/separator";
import { Textarea } from "@/ui/textarea";
import { Checkbox } from "@/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/ui/dialog";
import { HealthcareApi } from "@/api/services/healthcareService";
import Avatar from "@/components/Avatar";
import { useUserInfo } from "@/store/userStore";
import { toast } from "sonner";
import { cn } from "@/utils";
import { Select } from "antd";

// ── Types ──────────────────────────────────────────────────────────
export interface DocumentSidebarProps {
  /** e.g. "Patient", "PatientAppointment", "PatientEncounter", etc. */
  doctype: string;
  /** The document ID or name */
  docname: string;
  /** Display name for the sidebar header */
  displayName: string;
  /** Avatar initials */
  initials: string;
  /** Subtitle (e.g. practitioner name) */
  subtitle?: string;
  /** Creation timestamp */
  createdAt?: string;
  /** Last modified timestamp */
  modifiedAt?: string;
  /** Created by username or display name */
  createdBy?: string;
  /** Last modified by username or display name */
  modifiedBy?: string;
  /** Avatar background color class */
  avatarColor?: string;
  /** Callback when any document attribute changes */
  onUpdate?: () => void;
}

interface UserItem {
  id: number;
  username: string;
  email: string;
  first_name?: string;
  last_name?: string;
}

interface AssignmentItem {
  id: number;
  doctype: string;
  docname: string;
  assigned_to: number;
  assigned_to_name?: string;
  assigned_to_full_name?: string;
  assigned_to_email?: string;
  assigned_by?: number;
  assigned_by_name?: string;
  status: "Pending" | "Completed" | "Accepted" | "Rejected";
  priority?: "Low" | "Medium" | "High";
  due_date?: string;
  note?: string;
  creation?: string;
  modified?: string;
}

interface AttachmentItem {
  id: number;
  doctype: string;
  docname: string;
  file_name: string;
  file_url: string;
  file_size: number;
  file_type: string;
  attached_by?: number;
  attached_by_name?: string;
  is_private: boolean;
  creation?: string;
}

interface TagItem {
  id: number;
  doctype: string;
  docname: string;
  tag: string;
  creation?: string;
}

interface DocShareItem {
  id: number;
  user: number | null;
  user_username?: string;
  user_full_name?: string;
  user_email?: string;
  share_doctype: string;
  share_name: string;
  everyone: boolean;
  read: boolean;
  write: boolean;
  submit: boolean;
  share: boolean;
  notify_by_email?: boolean;
}

// ── Helpers ────────────────────────────────────────────────────────
function formatFileSize(bytes: number): string {
  if (!bytes || bytes <= 0) return "";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function resolveAttachmentUrl(url?: string): string {
  if (!url) return "";
  if (
    url.startsWith("http://") ||
    url.startsWith("https://") ||
    url.startsWith("blob:") ||
    url.startsWith("data:")
  ) {
    return url;
  }
  let cleanPath = url.startsWith("/") ? url : `/${url}`;
  if (
    !cleanPath.startsWith("/media/") &&
    !cleanPath.startsWith("/static/") &&
    !cleanPath.startsWith("/api/")
  ) {
    cleanPath = `/media${cleanPath}`;
  }
  return cleanPath;
}

function getFileExtension(fileName?: string, fileType?: string): string {
  if (fileType && fileType.includes("/")) {
    const sub = fileType.split("/")[1]?.toLowerCase().trim() || "";
    if (sub.includes("pdf")) return "pdf";
    if (sub.includes("png")) return "png";
    if (sub.includes("jpeg") || sub.includes("jpg")) return "jpg";
    if (sub.includes("gif")) return "gif";
    if (sub.includes("svg")) return "svg";
    if (sub.includes("webp")) return "webp";
    if (sub.includes("mp4")) return "mp4";
    if (sub.includes("mp3") || sub.includes("mpeg")) return "mp3";
    if (sub.includes("csv")) return "csv";
    if (sub.includes("json")) return "json";
    if (sub.includes("plain")) return "txt";
    return sub;
  }
  if (fileType && fileType.trim().length > 0) {
    return fileType.trim().toLowerCase().replace(/^\./, "");
  }
  if (fileName && fileName.includes(".")) {
    return fileName.split(".").pop()?.toLowerCase() || "";
  }
  return "";
}

function getFileIcon(fileName: string, fileType?: string): { icon: string; color: string } {
  const ext = getFileExtension(fileName, fileType);
  if (["png", "jpg", "jpeg", "gif", "svg", "webp", "bmp", "avif"].includes(ext)) {
    return { icon: "solar:gallery-bold", color: "text-emerald-500" };
  }
  if (["pdf"].includes(ext)) {
    return { icon: "solar:document-text-bold", color: "text-red-500" };
  }
  if (["xls", "xlsx", "csv"].includes(ext)) {
    return { icon: "solar:file-spreadsheet-bold", color: "text-emerald-600" };
  }
  if (["doc", "docx", "txt", "md", "rtf"].includes(ext)) {
    return { icon: "solar:document-bold", color: "text-blue-500" };
  }
  if (["mp4", "webm", "mov", "mkv"].includes(ext)) {
    return { icon: "solar:videocamera-record-bold", color: "text-purple-500" };
  }
  if (["mp3", "wav", "ogg", "m4a"].includes(ext)) {
    return { icon: "solar:music-note-bold", color: "text-amber-500" };
  }
  if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) {
    return { icon: "solar:archive-bold", color: "text-orange-500" };
  }
  return { icon: "solar:file-bold", color: "text-muted-foreground" };
}

function getPriorityBadge(priority?: string) {
  switch (priority) {
    case "High":
      return { label: "High", className: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900" };
    case "Low":
      return { label: "Low", className: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900" };
    default:
      return { label: "Medium", className: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900" };
  }
}

function formatDocTimestamp(dateStr?: string): string {
  if (!dateStr) return "Not recorded";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const formatted = d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHours = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHours / 24);

    let relative = "";
    if (diffDays > 30) {
      relative = "";
    } else if (diffDays > 0) {
      relative = ` (${diffDays}d ago)`;
    } else if (diffHours > 0) {
      relative = ` (${diffHours}h ago)`;
    } else if (diffMin > 0) {
      relative = ` (${diffMin}m ago)`;
    } else {
      relative = " (just now)";
    }

    return `${formatted}${relative}`;
  } catch {
    return dateStr;
  }
}

export default function DocumentSidebar({
  doctype,
  docname,
  displayName,
  initials,
  subtitle,
  createdAt,
  modifiedAt,
  createdBy,
  modifiedBy,
  avatarColor = "bg-red-100 text-red-700",
  onUpdate,
}: DocumentSidebarProps) {
  const currentUser = useUserInfo();
  const isNewDoc = !docname || docname === "new";

  const isCreatedByMe = Boolean(
    createdBy &&
      currentUser?.username &&
      createdBy.toLowerCase() === currentUser.username.toLowerCase()
  );
  const createdByDisplay = isCreatedByMe
    ? "Created By You"
    : createdBy
    ? `Created By @${createdBy}`
    : "Created";

  const isModifiedByMe = Boolean(
    modifiedBy &&
      currentUser?.username &&
      modifiedBy.toLowerCase() === currentUser.username.toLowerCase()
  );
  const modifiedByDisplay = isModifiedByMe
    ? "Last Edited By You"
    : modifiedBy
    ? `Last Edited By @${modifiedBy}`
    : "Last Edited";

  // ── States ───────────────────────────────────────────────────────
  const [assignments, setAssignments] = useState<AssignmentItem[]>([]);
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const [tags, setTags] = useState<TagItem[]>([]);
  const [shares, setShares] = useState<DocShareItem[]>([]);
  const [allSystemTags, setAllSystemTags] = useState<string[]>([]);
  const [systemUsers, setSystemUsers] = useState<UserItem[]>([]);

  // Dialog Controls
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [showAllAssignmentsDialog, setShowAllAssignmentsDialog] = useState(false);
  const [showAttachDialog, setShowAttachDialog] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [previewAttachment, setPreviewAttachment] = useState<AttachmentItem | null>(null);
  const [previewTextContent, setPreviewTextContent] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState(false);
  const [zoomScale, setZoomScale] = useState(1);
  const [rotation, setRotation] = useState(0);

  // Assign Form
  const [assignUser, setAssignUser] = useState("");
  const [assignToMe, setAssignToMe] = useState(false);
  const [assignPriority, setAssignPriority] = useState<"Low" | "Medium" | "High">("Medium");
  const [assignDueDate, setAssignDueDate] = useState("");
  const [assignNote, setAssignNote] = useState("");
  const [assignNotifyByEmail, setAssignNotifyByEmail] = useState(true);
  const [isSubmittingAssign, setIsSubmittingAssign] = useState(false);

  // Attachment Form
  const [attachTab, setAttachTab] = useState<"upload" | "link">("upload");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [attachFileName, setAttachFileName] = useState("");
  const [attachFileUrl, setAttachFileUrl] = useState("");
  const [isPrivateAttach, setIsPrivateAttach] = useState(false);
  const [isSubmittingAttach, setIsSubmittingAttach] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Tag Form
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [tagInput, setTagInput] = useState("");

  const selectableTags = useMemo(() => {
    const currentTagSet = new Set(tags.map((t) => t.tag.toLowerCase().trim()));
    return allSystemTags
      .filter((t) => !currentTagSet.has(t.toLowerCase().trim()))
      .map((t) => ({ value: t, label: `#${t}` }));
  }, [allSystemTags, tags]);

  // Share Form
  const [shareUser, setShareUser] = useState("");
  const [shareRead, setShareRead] = useState(true);
  const [shareWrite, setShareWrite] = useState(false);
  const [sharePerm, setSharePerm] = useState(false);
  const [isSubmittingShare, setIsSubmittingShare] = useState(false);

  // ── Load System Users & All Tags ─────────────────────────────────
  useEffect(() => {
    HealthcareApi.users
      .list()
      .then((res: any) => {
        const usersList = res.results || (Array.isArray(res) ? res : []);
        setSystemUsers(usersList);
      })
      .catch(() => {});

    HealthcareApi.docTags
      .allTags({ doctype })
      .then((tagsList: any) => {
        if (Array.isArray(tagsList)) setAllSystemTags(tagsList);
      })
      .catch(() => {});
  }, [doctype]);

  // ── Load Document Data ───────────────────────────────────────────
  const loadData = useCallback(async () => {
    if (isNewDoc) {
      setAssignments([]);
      setAttachments([]);
      setTags([]);
      setShares([]);
      return;
    }
    try {
      const [assignRes, attachRes, tagsRes, sharesRes] = await Promise.all([
        HealthcareApi.docAssignments.list({ doctype, docname }).catch(() => ({ results: [] })),
        HealthcareApi.docAttachments.list({ doctype, docname }).catch(() => ({ results: [] })),
        HealthcareApi.docTags.list({ doctype, docname }).catch(() => ({ results: [] })),
        HealthcareApi.docShares.list({ share_doctype: doctype, share_name: docname }).catch(() => ({ results: [] })),
      ]);

      setAssignments((assignRes as any).results || []);
      setAttachments((attachRes as any).results || []);
      setTags((tagsRes as any).results || []);
      setShares((sharesRes as any).results || []);
    } catch (err) {
      console.error("Error loading DocumentSidebar data:", err);
    }
  }, [doctype, docname, isNewDoc]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Helper to get formatted user label
  const getUserLabel = useCallback(
    (userId: number | string) => {
      const u = systemUsers.find((x) => String(x.id) === String(userId));
      if (!u) return `User #${userId}`;
      const fullName = `${u.first_name || ""} ${u.last_name || ""}`.trim();
      return fullName ? `${fullName} (@${u.username})` : `@${u.username}`;
    },
    [systemUsers]
  );

  // Helper to get user initials
  const getUserInitials = useCallback(
    (nameOrUser?: string | number) => {
      if (!nameOrUser) return "U";
      const str = String(nameOrUser);
      const parts = str.split(" ").filter(Boolean);
      if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
      return str.slice(0, 2).toUpperCase();
    },
    []
  );

  // Load text file content if previewing txt/csv/json/log
  useEffect(() => {
    if (!previewAttachment) {
      setPreviewTextContent(null);
      setPreviewError(false);
      return;
    }

    setPreviewError(false);
    const rawUrl = previewAttachment.file_url || (previewAttachment as any).file || "";
    const ext = getFileExtension(previewAttachment.file_name, previewAttachment.file_type);
    const mime = (previewAttachment.file_type || "").toLowerCase();
    const isTextFile =
      ["txt", "csv", "json", "log", "md", "xml", "html", "htm", "tsv"].includes(ext) ||
      mime.startsWith("text/") ||
      mime.includes("json") ||
      mime.includes("csv");

    if (isTextFile && rawUrl) {
      const fullUrl = resolveAttachmentUrl(rawUrl);
      fetch(fullUrl)
        .then((res) => {
          if (!res.ok) throw new Error("Failed to load text preview");
          return res.text();
        })
        .then((text) => setPreviewTextContent(text))
        .catch(() => {
          setPreviewTextContent(null);
        });
    } else {
      setPreviewTextContent(null);
    }
  }, [previewAttachment]);

  // ══════════════════════════════════════════════════════════════════
  // ASSIGN HANDLERS
  // ══════════════════════════════════════════════════════════════════
  const handleAssignToMeChange = (checked: boolean) => {
    setAssignToMe(checked);
    if (checked && currentUser?.id) {
      setAssignUser(String(currentUser.id));
    } else if (!checked && String(assignUser) === String(currentUser?.id)) {
      setAssignUser("");
    }
  };

  const handleCreateAssignment = async () => {
    if (!assignUser) {
      toast.error("Please select a user to assign.");
      return;
    }
    if (isNewDoc) {
      toast.error("Please save the document before assigning.");
      return;
    }

    setIsSubmittingAssign(true);
    try {
      await HealthcareApi.docAssignments.create({
        doctype,
        docname,
        assigned_to: Number(assignUser),
        priority: assignPriority,
        due_date: assignDueDate || null,
        note: assignNote.trim(),
        status: "Pending",
        notify_by_email: assignNotifyByEmail,
      });
      toast.success("Document assigned. Assigned user has been notified.");
      setAssignUser("");
      setAssignToMe(false);
      setAssignNote("");
      setAssignDueDate("");
      setAssignPriority("Medium");
      setAssignNotifyByEmail(true);
      setShowAssignDialog(false);
      loadData();
      onUpdate?.();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to assign document.");
    } finally {
      setIsSubmittingAssign(false);
    }
  };

  const handleToggleAssignmentStatus = async (assignment: AssignmentItem) => {
    const isCompleted = assignment.status === "Completed";
    try {
      if (isCompleted) {
        await HealthcareApi.docAssignments.reopen(assignment.id);
        toast.success("Assignment reopened.");
      } else {
        await HealthcareApi.docAssignments.complete(assignment.id);
        toast.success("Assignment marked as completed.");
      }
      loadData();
      onUpdate?.();
    } catch (err) {
      toast.error("Failed to update assignment status.");
    }
  };

  const handleRemoveAssignment = async (id: number) => {
    try {
      await HealthcareApi.docAssignments.delete(id);
      toast.success("Assignment removed.");
      loadData();
      onUpdate?.();
    } catch (err) {
      toast.error("Failed to remove assignment.");
    }
  };

  // ══════════════════════════════════════════════════════════════════
  // ATTACHMENT HANDLERS
  // ══════════════════════════════════════════════════════════════════
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setAttachFileName(file.name);
    }
  };

  const handleCreateAttachment = async () => {
    if (isNewDoc) {
      toast.error("Please save the document before adding attachments.");
      return;
    }

    setIsSubmittingAttach(true);
    try {
      if (attachTab === "upload") {
        if (!selectedFile) {
          toast.error("Please choose a file to upload.");
          setIsSubmittingAttach(false);
          return;
        }
        const formData = new FormData();
        formData.append("file", selectedFile);
        formData.append("doctype", doctype);
        formData.append("docname", docname);
        formData.append("file_name", attachFileName || selectedFile.name);
        formData.append("is_private", isPrivateAttach ? "true" : "false");

        await HealthcareApi.docAttachments.upload(formData);
        toast.success(`Attached "${attachFileName || selectedFile.name}"`);
      } else {
        if (!attachFileUrl.trim()) {
          toast.error("Please provide a valid file URL.");
          setIsSubmittingAttach(false);
          return;
        }
        const cleanName = attachFileName.trim() || attachFileUrl.split("/").pop() || "web-link";
        await HealthcareApi.docAttachments.create({
          doctype,
          docname,
          file_name: cleanName,
          file_url: attachFileUrl.trim(),
          file_size: 0,
          file_type: cleanName.split(".").pop() || "",
          is_private: isPrivateAttach,
        });
        toast.success(`Attached link "${cleanName}"`);
      }

      setSelectedFile(null);
      setAttachFileName("");
      setAttachFileUrl("");
      setIsPrivateAttach(false);
      setShowAttachDialog(false);
      loadData();
      onUpdate?.();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to attach file.");
    } finally {
      setIsSubmittingAttach(false);
    }
  };

  const handleRemoveAttachment = async (attachment: AttachmentItem) => {
    if (!window.confirm(`Are you sure you want to delete "${attachment.file_name}"?`)) return;
    try {
      await HealthcareApi.docAttachments.delete(attachment.id);
      toast.success("Attachment deleted.");
      if (previewAttachment?.id === attachment.id) setPreviewAttachment(null);
      loadData();
      onUpdate?.();
    } catch (err) {
      toast.error("Failed to delete attachment.");
    }
  };

  // ══════════════════════════════════════════════════════════════════
  // TAG HANDLERS
  // ══════════════════════════════════════════════════════════════════
  const handleAddTag = async (tagNameToAdd?: string) => {
    const finalTag = (tagNameToAdd || tagInput).trim();
    if (!finalTag) return;
    if (isNewDoc) {
      toast.error("Please save the document before adding tags.");
      return;
    }
    if (tags.some((t) => t.tag.toLowerCase() === finalTag.toLowerCase())) {
      toast.info(`Tag "${finalTag}" is already added.`);
      setTagInput("");
      return;
    }

    try {
      await HealthcareApi.docTags.create({ doctype, docname, tag: finalTag });
      toast.success(`Tag "${finalTag}" added.`);
      setTagInput("");
      if (!allSystemTags.includes(finalTag)) {
        setAllSystemTags((prev) => [...prev, finalTag]);
      }
      loadData();
      onUpdate?.();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to add tag.");
    }
  };

  const handleRemoveTag = async (tagItem: TagItem) => {
    try {
      await HealthcareApi.docTags.delete(tagItem.id);
      toast.success(`Tag "${tagItem.tag}" removed.`);
      loadData();
      onUpdate?.();
    } catch (err) {
      toast.error("Failed to remove tag.");
    }
  };

  // ══════════════════════════════════════════════════════════════════
  // SHARE HANDLERS
  // ══════════════════════════════════════════════════════════════════
  const handleAddShare = async () => {
    if (!shareUser) {
      toast.error("Please choose a user to share with.");
      return;
    }
    if (isNewDoc) {
      toast.error("Please save the document before sharing.");
      return;
    }

    setIsSubmittingShare(true);
    try {
      await HealthcareApi.docShares.create({
        user: Number(shareUser),
        share_doctype: doctype,
        share_name: docname,
        read: shareRead,
        write: shareWrite,
        share: sharePerm,
        everyone: false,
        notify_by_email: true,
      });
      toast.success("Document shared successfully.");
      setShareUser("");
      setShareRead(true);
      setShareWrite(false);
      setSharePerm(false);
      loadData();
      onUpdate?.();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to share document.");
    } finally {
      setIsSubmittingShare(false);
    }
  };

  const handleUpdateSharePermission = async (shareId: number, field: "read" | "write" | "share", value: boolean) => {
    try {
      await HealthcareApi.docShares.update(shareId, { [field]: value });
      setShares((prev) => prev.map((s) => (s.id === shareId ? { ...s, [field]: value } : s)));
      toast.success("Share permissions updated.");
      onUpdate?.();
    } catch (err) {
      toast.error("Failed to update share permissions.");
      loadData();
    }
  };

  const handleRemoveShare = async (shareId: number) => {
    try {
      await HealthcareApi.docShares.delete(shareId);
      toast.success("Share removed.");
      setShares((prev) => prev.filter((s) => s.id !== shareId));
      onUpdate?.();
    } catch (err) {
      toast.error("Failed to remove share.");
    }
  };

  const availableUsersForShare = useMemo(() => {
    const sharedUserIds = new Set(shares.map((s) => String(s.user)));
    return systemUsers.filter((u) => !sharedUserIds.has(String(u.id)));
  }, [systemUsers, shares]);

  return (
    <div className="w-[300px] border-l bg-card/40 p-4 space-y-5 text-sm shrink-0 hidden lg:block overflow-y-auto max-h-[calc(100vh-110px)] select-none">
      {/* ── Document Avatar & Header ────────────────────────────── */}
      <div className="text-center pb-3 border-b border-border/60">
        <Avatar
          initials={initials}
          size="doc"
          tone="red"
          className={cn("mx-auto ring-4 ring-red-50 dark:ring-red-950/30 shadow-sm", avatarColor)}
        />
        <h3 className="mt-2.5 font-semibold text-sm truncate text-foreground" title={displayName}>
          {displayName}
        </h3>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5 truncate">{subtitle}</p>}
        <div className="flex items-center justify-center gap-1.5 mt-2">
          <span className="text-[11px] font-mono uppercase bg-muted/60 text-muted-foreground px-2 py-0.5 rounded">
            {doctype}
          </span>
          <span className="text-[11px] font-mono text-muted-foreground/80 px-1 truncate max-w-[120px]" title={docname}>
            #{docname}
          </span>
        </div>
      </div>

      {/* ── 1. ASSIGN ───────────────────────────────────────────── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-foreground/80 font-medium text-xs tracking-wide uppercase">
            <Icon icon="solar:users-group-two-rounded-bold" size={15} className="text-blue-500" />
            Assign {assignments.length > 0 && <span className="text-[11px] text-muted-foreground font-normal">({assignments.length})</span>}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 hover:bg-muted rounded-full"
            onClick={() => {
              if (isNewDoc) {
                toast.info("Please save document before assigning.");
                return;
              }
              setShowAssignDialog(true);
            }}
            title="Assign To"
          >
            <Icon icon="solar:add-circle-bold" size={16} className="text-primary hover:opacity-80" />
          </Button>
        </div>

        {assignments.length > 0 ? (
          <div className="space-y-1.5">
            {assignments.slice(0, 3).map((a) => {
              const priority = getPriorityBadge(a.priority);
              const isCompleted = a.status === "Completed";
              const assigneeName = a.assigned_to_full_name || a.assigned_to_name || getUserLabel(a.assigned_to);

              return (
                <div
                  key={a.id}
                  className={cn(
                    "flex flex-col gap-1 p-2 rounded-lg border text-xs transition-all",
                    isCompleted
                      ? "bg-muted/30 border-dashed border-border/50 text-muted-foreground"
                      : "bg-background border-border/70 shadow-xs hover:border-blue-200 dark:hover:border-blue-900"
                  )}
                >
                  <div className="flex items-center justify-between gap-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <Avatar
                        initials={getUserInitials(assigneeName)}
                        size="xs"
                        tone={isCompleted ? "gray" : "blue"}
                        className="shrink-0"
                      />
                      <span className={cn("font-medium truncate", isCompleted && "line-through")} title={assigneeName}>
                        {assigneeName}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        className={cn("h-5 w-5 p-0", isCompleted ? "text-emerald-600 hover:text-emerald-700" : "text-muted-foreground hover:text-emerald-600")}
                        onClick={() => handleToggleAssignmentStatus(a)}
                        title={isCompleted ? "Reopen assignment" : "Mark as completed"}
                      >
                        <Icon icon={isCompleted ? "solar:check-circle-bold" : "solar:check-circle-linear"} size={14} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 w-5 p-0 text-muted-foreground hover:text-red-500"
                        onClick={() => handleRemoveAssignment(a.id)}
                        title="Remove assignment"
                      >
                        <Icon icon="solar:close-circle-bold" size={13} />
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap pl-7">
                    <span className={cn("text-[10px] px-1.5 py-0.2 rounded border font-medium", priority.className)}>
                      {priority.label}
                    </span>
                    {a.due_date && (
                      <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                        <Icon icon="solar:calendar-linear" size={11} /> {a.due_date}
                      </span>
                    )}
                  </div>
                  {a.note && (
                    <p className="text-[11px] text-muted-foreground italic pl-7 truncate" title={a.note}>
                      "{a.note}"
                    </p>
                  )}
                </div>
              );
            })}

            {assignments.length > 3 && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs text-primary h-7 p-0 hover:underline font-normal justify-start pl-1"
                onClick={() => setShowAllAssignmentsDialog(true)}
              >
                View all {assignments.length} assignments →
              </Button>
            )}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground italic pl-1">Not assigned</p>
        )}
      </div>

      <Separator />

      {/* ── 2. ATTACHMENTS ──────────────────────────────────────── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-foreground/80 font-medium text-xs tracking-wide uppercase">
            <Icon icon="solar:paperclip-bold" size={15} className="text-emerald-500" />
            Attachments {attachments.length > 0 && <span className="text-[11px] text-muted-foreground font-normal">({attachments.length})</span>}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 hover:bg-muted rounded-full"
            onClick={() => {
              if (isNewDoc) {
                toast.info("Please save document before attaching files.");
                return;
              }
              setShowAttachDialog(true);
            }}
            title="Add attachment"
          >
            <Icon icon="solar:add-circle-bold" size={16} className="text-primary hover:opacity-80" />
          </Button>
        </div>

        {attachments.length > 0 ? (
          <div className="space-y-1.5">
            {attachments.map((att) => {
              const fileMeta = getFileIcon(att.file_name, att.file_type);
              const sizeLabel = formatFileSize(att.file_size);
              const rawUrl = att.file_url || (att as any).file || "";
              const fullUrl = resolveAttachmentUrl(rawUrl);
              const ext = getFileExtension(att.file_name, att.file_type);
              const isImage =
                ["png", "jpg", "jpeg", "gif", "svg", "webp", "bmp", "avif"].includes(ext) ||
                (att.file_type || "").toLowerCase().startsWith("image/");

              return (
                <div
                  key={att.id}
                  className="group flex items-center justify-between gap-1.5 p-1.5 rounded-lg border border-border/70 bg-background hover:bg-muted/40 transition-colors text-xs"
                >
                  <button
                    type="button"
                    className="flex items-center gap-2 min-w-0 text-left cursor-pointer flex-1"
                    onClick={() => {
                      setPreviewError(false);
                      setZoomScale(1);
                      setRotation(0);
                      setPreviewAttachment(att);
                    }}
                    title={`Click to preview ${att.file_name}`}
                  >
                    {isImage && fullUrl ? (
                      <div className="w-6 h-6 rounded border bg-muted/40 overflow-hidden shrink-0 flex items-center justify-center">
                        <img
                          src={fullUrl}
                          alt=""
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = "none";
                          }}
                        />
                      </div>
                    ) : (
                      <Icon icon={fileMeta.icon} size={15} className={cn("shrink-0", fileMeta.color)} />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-foreground group-hover:text-primary transition-colors">
                        {att.file_name}
                      </p>
                      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                        {sizeLabel && <span>{sizeLabel}</span>}
                        {att.is_private ? (
                          <span className="flex items-center gap-0.5 text-amber-600 dark:text-amber-400">
                            <Icon icon="solar:lock-bold" size={10} /> Private
                          </span>
                        ) : (
                          <span className="flex items-center gap-0.5 text-muted-foreground">
                            <Icon icon="solar:lock-unlocked-linear" size={10} /> Public
                          </span>
                        )}
                      </div>
                    </div>
                  </button>

                  <div className="flex items-center gap-0.5 shrink-0 opacity-80 group-hover:opacity-100">
                    {fullUrl && (
                      <a
                        href={fullUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="h-5 w-5 inline-flex items-center justify-center text-muted-foreground hover:text-primary rounded"
                        title="Open in new tab"
                      >
                        <Icon icon="solar:arrow-right-up-linear" size={13} />
                      </a>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 w-5 p-0 text-muted-foreground hover:text-primary"
                      onClick={() => {
                        setPreviewError(false);
                        setZoomScale(1);
                        setRotation(0);
                        setPreviewAttachment(att);
                      }}
                      title="Preview file"
                    >
                      <Icon icon="solar:eye-linear" size={13} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 w-5 p-0 text-muted-foreground hover:text-red-500"
                      onClick={() => handleRemoveAttachment(att)}
                      title="Delete attachment"
                    >
                      <Icon icon="solar:trash-bin-trash-linear" size={13} />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground italic pl-1">No attachments</p>
        )}
      </div>

      <Separator />

      {/* ── 3. TAGS ─────────────────────────────────────────────── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-foreground/80 font-medium text-xs tracking-wide uppercase">
            <Icon icon="solar:tag-bold" size={15} className="text-amber-500" />
            Tags {tags.length > 0 && <span className="text-[11px] text-muted-foreground font-normal">({tags.length})</span>}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 hover:bg-muted rounded-full"
            onClick={() => {
              if (isNewDoc) {
                toast.info("Please save document before adding tags.");
                return;
              }
              setIsAddingTag((prev) => !prev);
            }}
            title="Add Tag"
          >
            <Icon icon="solar:add-circle-bold" size={16} className="text-primary hover:opacity-80" />
          </Button>
        </div>

        <div className="flex flex-wrap gap-1.5 items-center">
          {tags.map((t) => (
            <span
              key={t.id}
              className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-900 rounded-full px-2.5 py-0.5 shadow-2xs group"
            >
              <Icon icon="solar:tag-linear" size={10} className="text-blue-400" />
              <span>{t.tag}</span>
              <button
                type="button"
                onClick={() => handleRemoveTag(t)}
                className="hover:bg-blue-200 dark:hover:bg-blue-900 text-blue-600 dark:text-blue-400 rounded-full p-0.5 transition-colors ml-0.5"
                title={`Remove tag "${t.tag}"`}
              >
                <Icon icon="solar:close-circle-bold" size={11} />
              </button>
            </span>
          ))}

          {tags.length === 0 && !isAddingTag && (
            <button
              type="button"
              onClick={() => {
                if (isNewDoc) {
                  toast.info("Please save document before adding tags.");
                  return;
                }
                setIsAddingTag(true);
              }}
              className="text-xs text-muted-foreground hover:text-primary italic pl-1 flex items-center gap-1 cursor-pointer transition-colors"
            >
              <span>No tags</span>
              <span className="text-primary not-italic underline text-[11px]">+ Add tag</span>
            </button>
          )}
        </div>

        {isAddingTag && (
          <div className="pt-1.5 space-y-1">
            <div className="flex items-center gap-1.5">
              <div className="flex-1 min-w-0">
                <Select
                  showSearch
                  autoFocus
                  defaultOpen
                  value={null}
                  placeholder="Select tag or type new..."
                  size="small"
                  className="w-full text-xs"
                  searchValue={tagInput}
                  onSearch={(val) => setTagInput(val)}
                  onChange={(val) => {
                    if (val) handleAddTag(val);
                  }}
                  onInputKeyDown={(e) => {
                    if (e.key === "Enter" && tagInput.trim()) {
                      e.preventDefault();
                      handleAddTag(tagInput.trim());
                    } else if (e.key === "Escape") {
                      setIsAddingTag(false);
                      setTagInput("");
                    }
                  }}
                  options={selectableTags}
                  dropdownRender={(menu) => (
                    <div>
                      {menu}
                      {tagInput.trim() &&
                        !allSystemTags.some(
                          (t) => t.toLowerCase() === tagInput.trim().toLowerCase()
                        ) && (
                          <div className="p-1 border-t border-border">
                            <button
                              type="button"
                              className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-accent font-medium text-primary flex items-center gap-1.5 cursor-pointer transition-colors"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                handleAddTag(tagInput.trim());
                              }}
                            >
                              <Icon icon="solar:add-circle-bold" size={14} />
                              <span>
                                Add new tag: <strong>#{tagInput.trim()}</strong>
                              </span>
                            </button>
                          </div>
                        )}
                    </div>
                  )}
                  notFoundContent={
                    tagInput.trim() ? (
                      <div className="p-2 text-center">
                        <button
                          type="button"
                          className="w-full text-left px-2 py-1 text-xs text-primary hover:bg-accent rounded flex items-center gap-1.5 font-medium cursor-pointer"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            handleAddTag(tagInput.trim());
                          }}
                        >
                          <Icon icon="solar:add-circle-bold" size={14} />
                          <span>Create &ldquo;#{tagInput.trim()}&rdquo;</span>
                        </button>
                      </div>
                    ) : (
                      <div className="p-2 text-xs text-muted-foreground text-center">
                        No tags found. Type to create one.
                      </div>
                    )
                  }
                />
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 shrink-0 text-muted-foreground hover:text-foreground"
                onClick={() => {
                  setIsAddingTag(false);
                  setTagInput("");
                }}
                title="Close"
              >
                ✕
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground pl-0.5">
              Select an existing tag or type to create and press Enter.
            </p>
          </div>
        )}
      </div>

      <Separator />

      {/* ── 4. SHARE (DocShare) ─────────────────────────────────── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-foreground/80 font-medium text-xs tracking-wide uppercase">
            <Icon icon="solar:share-bold" size={15} className="text-purple-500" />
            Share {shares.length > 0 && <span className="text-[11px] text-muted-foreground font-normal">({shares.length})</span>}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 hover:bg-muted rounded-full"
            onClick={() => {
              if (isNewDoc) {
                toast.info("Please save document before sharing.");
                return;
              }
              setShowShareDialog(true);
            }}
            title="Share Document"
          >
            <Icon icon="solar:add-circle-bold" size={16} className="text-primary hover:opacity-80" />
          </Button>
        </div>

        {shares.length > 0 ? (
          <div
            className="flex items-center gap-2 p-2 rounded-lg border border-border/70 bg-background hover:bg-muted/40 cursor-pointer transition-colors"
            onClick={() => setShowShareDialog(true)}
            title="Manage sharing permissions"
          >
            <div className="flex -space-x-2 overflow-hidden shrink-0">
              {shares.slice(0, 4).map((s) => {
                const label = s.everyone ? "Everyone" : s.user_full_name || s.user_username || getUserLabel(s.user || "");
                return (
                  <Avatar
                    key={s.id}
                    initials={s.everyone ? "EV" : getUserInitials(label)}
                    size="xs"
                    tone={s.everyone ? "green" : "purple"}
                    className="ring-2 ring-background shrink-0"
                  />
                );
              })}
              {shares.length > 4 && (
                <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[9px] font-bold ring-2 ring-background text-muted-foreground">
                  +{shares.length - 4}
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1 text-xs">
              <p className="font-medium truncate text-foreground">
                Shared with {shares.length} {shares.length === 1 ? "user" : "users"}
              </p>
              <p className="text-[10px] text-muted-foreground truncate">Click to manage permissions</p>
            </div>

            <Icon icon="solar:alt-arrow-right-linear" size={14} className="text-muted-foreground shrink-0" />
          </div>
        ) : (
          <p className="text-xs text-muted-foreground italic pl-1">Not shared with anyone</p>
        )}
      </div>

      <Separator />

      {/* ── Timestamps ──────────────────────────────────────────── */}
      <div className="space-y-2.5 text-xs text-muted-foreground pt-1">
        <div className="space-y-0.5">
          <p className="text-[11px] font-medium text-foreground/70 flex items-center gap-1">
            <Icon icon="solar:pen-linear" size={12} /> {modifiedByDisplay}
          </p>
          <p className="font-mono text-[11px] text-muted-foreground/90">
            {isNewDoc ? "Draft (Unsaved)" : formatDocTimestamp(modifiedAt)}
          </p>
        </div>
        <div className="space-y-0.5">
          <p className="text-[11px] font-medium text-foreground/70 flex items-center gap-1">
            <Icon icon="solar:clock-circle-linear" size={12} /> {createdByDisplay}
          </p>
          <p className="font-mono text-[11px] text-muted-foreground/90">
            {isNewDoc ? "Draft (Unsaved)" : formatDocTimestamp(createdAt)}
          </p>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* 1. ASSIGN DIALOG ("Add to ToDo" - Marley/Frappe Parity)        */}
      {/* ════════════════════════════════════════════════════════════════ */}
      <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Icon icon="solar:users-group-two-rounded-bold" className="text-blue-600" />
              Add to ToDo
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2 text-sm">
            <label className="flex items-center gap-2 cursor-pointer p-2 rounded-md bg-muted/40 hover:bg-muted transition-colors border">
              <Checkbox checked={assignToMe} onCheckedChange={handleAssignToMeChange} />
              <span className="font-medium text-xs">Assign to me</span>
              {currentUser?.username && (
                <span className="text-[11px] text-muted-foreground ml-auto">(@{currentUser.username})</span>
              )}
            </label>

            <div>
              <Label className="text-xs font-medium">Assign To <span className="text-red-500">*</span></Label>
              <select
                value={assignUser}
                onChange={(e) => {
                  setAssignUser(e.target.value);
                  setAssignToMe(String(e.target.value) === String(currentUser?.id));
                }}
                className="mt-1 w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs focus:ring-1 focus:ring-primary outline-none"
              >
                <option value="">-- Select a User --</option>
                {systemUsers.map((u) => {
                  const fullName = `${u.first_name || ""} ${u.last_name || ""}`.trim();
                  return (
                    <option key={u.id} value={u.id}>
                      {fullName ? `${fullName} (@${u.username})` : `@${u.username}`} {u.email ? `• ${u.email}` : ""}
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-medium">Priority</Label>
                <select
                  value={assignPriority}
                  onChange={(e) => setAssignPriority(e.target.value as any)}
                  className="mt-1 w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs focus:ring-1 focus:ring-primary outline-none"
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                </select>
              </div>

              <div>
                <Label className="text-xs font-medium">Complete By (Optional)</Label>
                <Input
                  type="date"
                  value={assignDueDate}
                  onChange={(e) => setAssignDueDate(e.target.value)}
                  className="mt-1 h-9 text-xs"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs font-medium">Comment / Instructions</Label>
              <Textarea
                value={assignNote}
                onChange={(e) => setAssignNote(e.target.value)}
                placeholder="Why is this assigned? What needs to be done?"
                rows={3}
                className="mt-1 text-xs resize-none"
              />
            </div>

            <div className="rounded-md border p-2.5 bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/50 space-y-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={assignNotifyByEmail}
                  onCheckedChange={(checked) => setAssignNotifyByEmail(Boolean(checked))}
                />
                <span className="text-xs font-medium text-foreground flex items-center gap-1.5">
                  <Icon icon="solar:bell-bing-bold" size={14} className="text-blue-600" />
                  Notify assigned user via system notification & email
                </span>
              </label>
              <p className="text-[11px] text-muted-foreground pl-6">
                The assignee will receive an instant dashboard alert badge with a direct link to this document.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowAssignDialog(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleCreateAssignment}
              disabled={isSubmittingAssign || !assignUser}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isSubmittingAssign ? "Assigning..." : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* 1b. ALL ASSIGNMENTS MODAL                                      */}
      {/* ════════════════════════════════════════════════════════════════ */}
      <Dialog open={showAllAssignmentsDialog} onOpenChange={setShowAllAssignmentsDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Icon icon="solar:users-group-two-rounded-bold" className="text-blue-600" />
              All Assignments ({assignments.length})
            </DialogTitle>
          </DialogHeader>

          <div className="max-h-[60vh] overflow-y-auto space-y-2 py-2 pr-1">
            {assignments.map((a) => {
              const priority = getPriorityBadge(a.priority);
              const isCompleted = a.status === "Completed";
              const assigneeName = a.assigned_to_full_name || a.assigned_to_name || getUserLabel(a.assigned_to);

              return (
                <div
                  key={a.id}
                  className={cn(
                    "p-3 rounded-lg border flex items-start justify-between gap-3 text-xs transition-colors",
                    isCompleted ? "bg-muted/40 border-dashed" : "bg-card shadow-2xs"
                  )}
                >
                  <div className="flex items-start gap-2.5 min-w-0 flex-1">
                    <Avatar
                      initials={getUserInitials(assigneeName)}
                      size="sm"
                      tone={isCompleted ? "gray" : "blue"}
                      className="mt-0.5 shrink-0"
                    />
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={cn("font-medium text-sm text-foreground", isCompleted && "line-through text-muted-foreground")}>
                          {assigneeName}
                        </span>
                        <span className={cn("text-[10px] px-1.5 py-0.2 rounded border font-medium", priority.className)}>
                          {priority.label}
                        </span>
                        <span
                          className={cn(
                            "text-[10px] px-1.5 py-0.2 rounded font-medium",
                            isCompleted ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                          )}
                        >
                          {a.status}
                        </span>
                      </div>

                      {a.note && <p className="text-xs text-muted-foreground mt-1">"{a.note}"</p>}

                      {a.due_date && (
                        <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                          <Icon icon="solar:calendar-linear" size={12} /> Due by: {a.due_date}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant={isCompleted ? "outline" : "default"}
                      size="sm"
                      className={cn("h-7 text-xs px-2.5 gap-1", !isCompleted && "bg-emerald-600 hover:bg-emerald-700 text-white")}
                      onClick={() => handleToggleAssignmentStatus(a)}
                    >
                      <Icon icon={isCompleted ? "solar:restart-linear" : "solar:check-circle-bold"} size={13} />
                      {isCompleted ? "Reopen" : "Done"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-red-500"
                      onClick={() => handleRemoveAssignment(a.id)}
                    >
                      <Icon icon="solar:trash-bin-trash-linear" size={14} />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowAllAssignmentsDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* 2. ATTACHMENT DIALOG (Frappe FileUploader Parity)               */}
      {/* ════════════════════════════════════════════════════════════════ */}
      <Dialog open={showAttachDialog} onOpenChange={setShowAttachDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Icon icon="solar:paperclip-bold" className="text-emerald-600" />
              Add Attachment
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2 text-sm">
            <div className="flex rounded-lg bg-muted p-1 border">
              <button
                type="button"
                className={cn(
                  "flex-1 text-xs py-1.5 rounded-md font-medium transition-colors flex items-center justify-center gap-1.5",
                  attachTab === "upload" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                )}
                onClick={() => setAttachTab("upload")}
              >
                <Icon icon="solar:upload-linear" size={14} /> Upload File
              </button>
              <button
                type="button"
                className={cn(
                  "flex-1 text-xs py-1.5 rounded-md font-medium transition-colors flex items-center justify-center gap-1.5",
                  attachTab === "link" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                )}
                onClick={() => setAttachTab("link")}
              >
                <Icon icon="solar:link-linear" size={14} /> Web Link
              </button>
            </div>

            {attachTab === "upload" ? (
              <div className="space-y-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileSelect}
                  className="hidden"
                />

                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-border rounded-xl p-6 text-center cursor-pointer hover:border-primary/60 hover:bg-muted/30 transition-all flex flex-col items-center justify-center gap-2"
                >
                  <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                    <Icon icon="solar:upload-track-2-bold" size={20} />
                  </div>
                  <div>
                    <p className="font-medium text-xs text-foreground">Click to browse or drag file here</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Supports PDF, Images, Excel, Word, Text & more</p>
                  </div>
                </div>

                {selectedFile && (
                  <div className="flex items-center justify-between p-2.5 rounded-lg border bg-muted/20 text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <Icon icon="solar:document-bold" size={18} className="text-primary shrink-0" />
                      <div className="min-w-0">
                        <p className="font-medium truncate">{selectedFile.name}</p>
                        <p className="text-[10px] text-muted-foreground">{formatFileSize(selectedFile.size)}</p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-red-500"
                      onClick={() => {
                        setSelectedFile(null);
                        setAttachFileName("");
                      }}
                    >
                      ✕
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <Label className="text-xs font-medium">File Name</Label>
                  <Input
                    value={attachFileName}
                    onChange={(e) => setAttachFileName(e.target.value)}
                    placeholder="e.g. lab_report.pdf"
                    className="mt-1 h-9 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-xs font-medium">File URL <span className="text-red-500">*</span></Label>
                  <Input
                    value={attachFileUrl}
                    onChange={(e) => setAttachFileUrl(e.target.value)}
                    placeholder="https://example.com/file.pdf"
                    className="mt-1 h-9 text-xs"
                  />
                </div>
              </div>
            )}

            <label className="flex items-center gap-2 cursor-pointer pt-1">
              <Checkbox checked={isPrivateAttach} onCheckedChange={(c) => setIsPrivateAttach(Boolean(c))} />
              <div className="text-xs">
                <span className="font-medium text-foreground">Make Private</span>
                <p className="text-[11px] text-muted-foreground">Only authorized users can view this attachment</p>
              </div>
            </label>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowAttachDialog(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleCreateAttachment}
              disabled={isSubmittingAttach || (attachTab === "upload" ? !selectedFile : !attachFileUrl)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {isSubmittingAttach ? "Attaching..." : "Attach"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* 2b. ATTACHMENT PREVIEW MODAL (Full Multi-Format Support)       */}
      {/* ════════════════════════════════════════════════════════════════ */}
      <Dialog
        open={Boolean(previewAttachment)}
        onOpenChange={(open) => {
          if (!open) {
            setPreviewAttachment(null);
            setPreviewTextContent(null);
            setPreviewError(false);
            setZoomScale(1);
            setRotation(0);
          }
        }}
      >
        <DialogContent className="sm:max-w-5xl md:max-w-6xl w-[94vw] h-[88vh] max-h-[92vh] flex flex-col p-0 overflow-hidden gap-0 bg-background border shadow-2xl rounded-xl">
          {/* Header */}
          <DialogHeader className="px-5 py-3.5 border-b bg-card shrink-0">
            <div className="flex items-center justify-between gap-3 pr-12">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  <Icon
                    icon={getFileIcon(previewAttachment?.file_name || "", previewAttachment?.file_type).icon}
                    size={20}
                    className={getFileIcon(previewAttachment?.file_name || "", previewAttachment?.file_type).color}
                  />
                </div>
                <div className="min-w-0">
                  <DialogTitle className="truncate text-sm font-semibold text-foreground" title={previewAttachment?.file_name}>
                    {previewAttachment?.file_name}
                  </DialogTitle>
                  <p className="text-[11px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
                    {formatFileSize(previewAttachment?.file_size || 0) && (
                      <>
                        <span>{formatFileSize(previewAttachment?.file_size || 0)}</span>
                        <span>•</span>
                      </>
                    )}
                    <span className="uppercase font-medium">
                      {getFileExtension(previewAttachment?.file_name, previewAttachment?.file_type) || previewAttachment?.file_type || "File"}
                    </span>
                    {previewAttachment?.attached_by_name && (
                      <>
                        <span>•</span>
                        <span>Attached by {previewAttachment.attached_by_name}</span>
                      </>
                    )}
                  </p>
                </div>
              </div>

              {/* Action Buttons Toolbar */}
              <div className="flex items-center gap-1.5 shrink-0">
                {previewAttachment && (() => {
                  const ext = getFileExtension(previewAttachment.file_name, previewAttachment.file_type);
                  const mime = (previewAttachment.file_type || "").toLowerCase();
                  const isImg =
                    ["png", "jpg", "jpeg", "gif", "svg", "webp", "bmp", "avif", "ico"].includes(ext) ||
                    mime.startsWith("image/");

                  if (!isImg) return null;

                  return (
                    <div className="hidden sm:flex items-center gap-1 bg-muted/60 rounded-lg p-1 mr-2 border">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                        onClick={() => setZoomScale((prev) => Math.max(0.25, prev - 0.25))}
                        title="Zoom Out"
                      >
                        <Icon icon="solar:magnifer-zoom-out-linear" size={15} />
                      </Button>
                      <span className="text-[11px] font-mono px-1.5 min-w-[42px] text-center select-none text-muted-foreground">
                        {Math.round(zoomScale * 100)}%
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                        onClick={() => setZoomScale((prev) => Math.min(4, prev + 0.25))}
                        title="Zoom In"
                      >
                        <Icon icon="solar:magnifer-zoom-in-linear" size={15} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                        onClick={() => {
                          setZoomScale(1);
                          setRotation(0);
                        }}
                        title="Reset Zoom & Rotation"
                      >
                        <Icon icon="solar:restart-linear" size={14} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                        onClick={() => setRotation((prev) => (prev + 90) % 360)}
                        title="Rotate 90°"
                      >
                        <Icon icon="solar:refresh-circle-linear" size={15} />
                      </Button>
                    </div>
                  );
                })()}

                {previewAttachment && (() => {
                  const rawUrl = previewAttachment.file_url || (previewAttachment as any).file || "";
                  const fullUrl = resolveAttachmentUrl(rawUrl);
                  if (!fullUrl) return null;

                  return (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1.5 text-xs font-normal"
                        onClick={() => {
                          const copyTarget = fullUrl.startsWith("http")
                            ? fullUrl
                            : `${window.location.origin}${fullUrl}`;
                          navigator.clipboard.writeText(copyTarget);
                          toast.success("File URL copied to clipboard.");
                        }}
                        title="Copy file link"
                      >
                        <Icon icon="solar:copy-linear" size={14} />
                        <span className="hidden md:inline">Copy Link</span>
                      </Button>

                      <a
                        href={fullUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-muted hover:bg-muted/80 text-foreground text-xs font-medium border"
                        title="Open in new browser tab"
                      >
                        <Icon icon="solar:arrow-right-up-linear" size={14} />
                        <span className="hidden md:inline">Open in Tab</span>
                      </a>

                      <a
                        href={fullUrl}
                        download={previewAttachment.file_name}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-medium shadow-xs"
                        title="Download file"
                      >
                        <Icon icon="solar:download-linear" size={14} />
                        <span className="hidden sm:inline">Download</span>
                      </a>
                    </>
                  );
                })()}
              </div>
            </div>
          </DialogHeader>

          {/* Body Viewer */}
          <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-muted/20 relative select-none">
            {previewAttachment && (() => {
              const rawUrl = previewAttachment.file_url || (previewAttachment as any).file || "";
              const fullUrl = resolveAttachmentUrl(rawUrl);
              const ext = getFileExtension(previewAttachment.file_name, previewAttachment.file_type);
              const mime = (previewAttachment.file_type || "").toLowerCase();

              const isImage =
                ["png", "jpg", "jpeg", "gif", "svg", "webp", "bmp", "avif", "ico"].includes(ext) ||
                mime.startsWith("image/");
              const isPdf = ext === "pdf" || mime.includes("pdf");
              const isVideo =
                ["mp4", "webm", "mov", "mkv", "avi"].includes(ext) || mime.startsWith("video/");
              const isAudio =
                ["mp3", "wav", "ogg", "m4a", "flac"].includes(ext) || mime.startsWith("audio/");
              const isText =
                ["txt", "csv", "json", "log", "md", "xml", "html", "htm", "tsv"].includes(ext) ||
                mime.startsWith("text/") ||
                mime.includes("json") ||
                mime.includes("csv");

              if (previewError || !fullUrl) {
                return (
                  <div className="text-center space-y-4 p-8 bg-card rounded-xl border max-w-md shadow-xs m-auto">
                    <div className="w-14 h-14 rounded-full bg-red-50 text-red-500 flex items-center justify-center mx-auto">
                      <Icon icon="solar:danger-triangle-bold" size={28} />
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm text-foreground">Preview Unavailable</h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        The file could not be displayed directly in the browser viewer. You can open or download it below.
                      </p>
                    </div>
                    {fullUrl && (
                      <div className="flex items-center justify-center gap-2 pt-2">
                        <a
                          href={fullUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium"
                        >
                          <Icon icon="solar:arrow-right-up-linear" size={14} /> Open in New Tab
                        </a>
                        <a
                          href={fullUrl}
                          download={previewAttachment.file_name}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-medium hover:bg-muted"
                        >
                          <Icon icon="solar:download-linear" size={14} /> Download
                        </a>
                      </div>
                    )}
                  </div>
                );
              }

              // Image Preview
              if (isImage) {
                return (
                  <div className="w-full h-full flex items-center justify-center overflow-auto p-4">
                    <div
                      className="transition-transform duration-150 ease-out flex items-center justify-center"
                      style={{
                        transform: `scale(${zoomScale}) rotate(${rotation}deg)`,
                        transformOrigin: "center center",
                      }}
                    >
                      <img
                        src={fullUrl}
                        alt={previewAttachment.file_name}
                        onError={(e) => {
                          console.error("Image preview load failed for:", fullUrl);
                          // If loaded from relative /media/... and failed, try backend direct
                          if (fullUrl.startsWith("/media/") && typeof window !== "undefined") {
                            const fallback = `http://localhost:8000${fullUrl}`;
                            (e.target as HTMLImageElement).src = fallback;
                          } else {
                            setPreviewError(true);
                          }
                        }}
                        className="max-h-[76vh] max-w-[85vw] object-contain rounded-lg shadow-sm border bg-background"
                      />
                    </div>
                  </div>
                );
              }

              // PDF Preview
              if (isPdf) {
                return (
                  <div className="w-full h-full flex flex-col">
                    <object
                      data={fullUrl}
                      type="application/pdf"
                      className="w-full h-[78vh] rounded-lg border bg-white shadow-xs"
                    >
                      <iframe
                        src={`${fullUrl}#toolbar=1&navpanes=0`}
                        title={previewAttachment.file_name}
                        className="w-full h-[78vh] rounded-lg border bg-white shadow-xs"
                        onError={() => setPreviewError(true)}
                      >
                        <p className="p-4 text-xs text-center text-muted-foreground">
                          PDF plugin not detected.{" "}
                          <a href={fullUrl} target="_blank" rel="noreferrer" className="text-primary underline">
                            Click here to open PDF directly
                          </a>
                        </p>
                      </iframe>
                    </object>
                  </div>
                );
              }

              // Text / CSV Preview
              if (isText) {
                if (previewTextContent === null) {
                  return (
                    <div className="flex items-center gap-2 text-muted-foreground text-xs">
                      <Icon icon="solar:spinner-linear" className="animate-spin" size={18} />
                      <span>Loading file contents...</span>
                    </div>
                  );
                }
                return (
                  <div className="w-full h-full max-h-[78vh] overflow-auto bg-card rounded-lg border p-4 font-mono text-xs text-foreground shadow-2xs leading-relaxed whitespace-pre-wrap select-text">
                    {previewTextContent}
                  </div>
                );
              }

              // Video Preview
              if (isVideo) {
                return (
                  <div className="w-full h-full flex items-center justify-center p-4">
                    <video
                      controls
                      autoPlay={false}
                      src={fullUrl}
                      className="max-h-[78vh] max-w-full rounded-lg shadow-md border bg-black"
                    />
                  </div>
                );
              }

              // Audio Preview
              if (isAudio) {
                return (
                  <div className="p-8 bg-card rounded-2xl border shadow-md max-w-md w-full text-center space-y-5 m-auto">
                    <div className="w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto">
                      <Icon icon="solar:music-note-bold" size={36} />
                    </div>
                    <div>
                      <p className="font-semibold text-sm text-foreground truncate" title={previewAttachment.file_name}>
                        {previewAttachment.file_name}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatFileSize(previewAttachment.file_size)} • {ext.toUpperCase()}
                      </p>
                    </div>
                    <audio controls src={fullUrl} className="w-full" />
                  </div>
                );
              }

              // Generic fallback card
              return (
                <div className="text-center space-y-4 p-8 bg-card rounded-xl border max-w-sm w-full shadow-2xs m-auto">
                  <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto text-primary">
                    <Icon icon={getFileIcon(previewAttachment.file_name, previewAttachment.file_type).icon} size={36} />
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-foreground truncate" title={previewAttachment.file_name}>
                      {previewAttachment.file_name}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatFileSize(previewAttachment.file_size)} • {ext.toUpperCase() || "File"}
                    </p>
                    <p className="text-[11px] text-muted-foreground/80 mt-1.5">
                      Direct in-browser preview is not supported for this file type.
                    </p>
                  </div>
                  <div className="flex items-center justify-center gap-2 pt-1">
                    <a
                      href={fullUrl}
                      download={previewAttachment.file_name}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 text-xs font-medium shadow-xs"
                    >
                      <Icon icon="solar:download-linear" size={15} /> Download File
                    </a>
                  </div>
                </div>
              );
            })()}
          </div>
        </DialogContent>
      </Dialog>

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* 4. SHARE DIALOG (Frappe set_sharing Parity)                    */}
      {/* ════════════════════════════════════════════════════════════════ */}
      <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Icon icon="solar:share-bold" className="text-purple-600" />
              Share "{displayName}" with
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2 text-sm">
            <div className="border rounded-lg overflow-hidden">
              <div className="grid grid-cols-12 bg-muted/60 p-2.5 text-xs font-semibold text-muted-foreground border-b">
                <div className="col-span-6">User</div>
                <div className="col-span-2 text-center">Read</div>
                <div className="col-span-2 text-center">Write</div>
                <div className="col-span-1 text-center">Share</div>
                <div className="col-span-1 text-center">✕</div>
              </div>

              <div className="divide-y divide-border/60 max-h-[220px] overflow-y-auto">
                {shares.length > 0 ? (
                  shares.map((s) => {
                    const label = s.everyone ? "Everyone" : s.user_full_name || s.user_username || getUserLabel(s.user || "");
                    const email = s.user_email || "";

                    return (
                      <div key={s.id} className="grid grid-cols-12 p-2.5 items-center text-xs hover:bg-muted/20">
                        <div className="col-span-6 flex items-center gap-2 min-w-0 pr-2">
                          <Avatar
                            initials={s.everyone ? "EV" : getUserInitials(label)}
                            size="xs"
                            tone={s.everyone ? "green" : "purple"}
                            className="shrink-0"
                          />
                          <div className="min-w-0">
                            <p className="font-medium truncate text-foreground">{label}</p>
                            {email && <p className="text-[10px] text-muted-foreground truncate">{email}</p>}
                          </div>
                        </div>

                        <div className="col-span-2 flex justify-center">
                          <Checkbox
                            checked={s.read}
                            onCheckedChange={(val) => handleUpdateSharePermission(s.id, "read", Boolean(val))}
                          />
                        </div>

                        <div className="col-span-2 flex justify-center">
                          <Checkbox
                            checked={s.write}
                            onCheckedChange={(val) => handleUpdateSharePermission(s.id, "write", Boolean(val))}
                          />
                        </div>

                        <div className="col-span-1 flex justify-center">
                          <Checkbox
                            checked={s.share}
                            onCheckedChange={(val) => handleUpdateSharePermission(s.id, "share", Boolean(val))}
                          />
                        </div>

                        <div className="col-span-1 flex justify-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-muted-foreground hover:text-red-500"
                            onClick={() => handleRemoveShare(s.id)}
                            title="Unshare"
                          >
                            <Icon icon="solar:trash-bin-trash-linear" size={13} />
                          </Button>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="p-4 text-center text-xs text-muted-foreground italic">
                    Not shared with anyone yet. Use the form below to share.
                  </div>
                )}
              </div>
            </div>

            <div className="p-3 rounded-lg border bg-muted/20 space-y-3">
              <p className="text-xs font-semibold text-foreground">Share this document with:</p>

              <div>
                <Label className="text-xs font-medium">Select User</Label>
                <select
                  value={shareUser}
                  onChange={(e) => setShareUser(e.target.value)}
                  className="mt-1 w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs focus:ring-1 focus:ring-primary outline-none"
                >
                  <option value="">-- Choose a user to share with --</option>
                  {availableUsersForShare.map((u) => {
                    const fullName = `${u.first_name || ""} ${u.last_name || ""}`.trim();
                    return (
                      <option key={u.id} value={u.id}>
                        {fullName ? `${fullName} (@${u.username})` : `@${u.username}`} {u.email ? `• ${u.email}` : ""}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="flex items-center gap-6 pt-1">
                <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                  <Checkbox checked={shareRead} onCheckedChange={(val) => setShareRead(Boolean(val))} />
                  <span>Can Read</span>
                </label>
                <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                  <Checkbox checked={shareWrite} onCheckedChange={(val) => setShareWrite(Boolean(val))} />
                  <span>Can Write / Edit</span>
                </label>
                <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                  <Checkbox checked={sharePerm} onCheckedChange={(val) => setSharePerm(Boolean(val))} />
                  <span>Can Re-share</span>
                </label>
              </div>

              <Button
                size="sm"
                onClick={handleAddShare}
                disabled={isSubmittingShare || !shareUser}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white mt-2"
              >
                {isSubmittingShare ? "Sharing..." : "Add Share"}
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowShareDialog(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
