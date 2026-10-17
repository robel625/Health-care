import { Icon } from "@/components/icon";
import { NotificationBadge } from "@/components/notification-badge";
import { useNotificationStore } from "@/store/notificationStore";
import { useUserInfo } from "@/store/userStore";
import { Button } from "@/ui/button";
import { ScrollArea } from "@/ui/scroll-area";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/ui/tabs";
import { Text } from "@/ui/typography";
import apiClient from "@/api/apiClient";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";

// ── Types ──────────────────────────────────────────────────────

interface ErrorLogItem {
  id: number;
  method: string;
  error: string;
  reference_doctype: string;
  reference_name: string;
  seen: boolean;
  creation: string;
}

interface CommunicationItem {
  id: number;
  subject: string;
  content: string;
  communication_medium: string;
  communication_type: string;
  status: string;
  sender_full_name: string;
  sender: string;
  creation: string;
  reference_doctype: string;
  reference_name: string;
}

interface CommentItem {
  id: number;
  comment_type: string;
  content: string;
  comment_by: string;
  subject: string;
  reference_doctype: string;
  reference_name: string;
  creation: string;
}

interface NotificationDeliveryItem {
  id: number;
  event: string;
  subject: string;
  message: string;
  channel: string;
  status: string;
  recipient_name: string;
  reference_doctype: string;
  reference_name: string;
  category?: string;
  action_url?: string;
  creation: string;
}

// ── Time helper ────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

// ── Icon helpers ───────────────────────────────────────────────

function getErrorMethodIcon(method: string): string {
  switch (method?.toUpperCase()) {
    case "GET":
      return "solar:import-linear";
    case "POST":
      return "solar:export-linear";
    case "PUT":
    case "PATCH":
      return "solar:pen-bold";
    case "DELETE":
      return "solar:trash-bin-minimalistic-bold";
    default:
      return "solar:bug-bold-duotone";
  }
}

function getMediumIcon(medium: string): string {
  switch (medium?.toLowerCase()) {
    case "email":
      return "solar:letter-bold";
    case "phone":
      return "solar:phone-bold";
    case "chat":
      return "solar:chat-round-bold";
    case "meeting":
      return "solar:calendar-bold";
    default:
      return "solar:chat-dots-bold";
  }
}

function getMediumColor(medium: string): string {
  switch (medium?.toLowerCase()) {
    case "email":
      return "text-info";
    case "phone":
      return "text-success";
    case "chat":
      return "text-warning";
    case "meeting":
      return "text-primary";
    default:
      return "text-muted-foreground";
  }
}

function getCommentTypeColor(type: string): string {
  switch (type?.toLowerCase()) {
    case "comment":
      return "bg-info/20 text-info-dark";
    case "edit":
      return "bg-warning/20 text-warning-dark";
    case "info":
      return "bg-success/20 text-success-dark";
    default:
      return "bg-secondary text-secondary-foreground";
  }
}

// ── Route mapping ──────────────────────────────────────────────

function getRouteForDoc(doctype: string, reference_name?: string): string {
  const norm = (doctype || "").replace(/[\s_-]+/g, "").toLowerCase();

  if (norm === "patient") {
    return reference_name ? `/healthcare/patients/${reference_name}` : "/healthcare/patients";
  }
  if (norm === "patientencounter" || norm === "encounter") {
    return reference_name ? `/healthcare/encounters/${reference_name}` : "/healthcare/encounters";
  }
  if (norm === "vitalsigns" || norm === "vitalsign") {
    return reference_name ? `/healthcare/vital-signs/${reference_name}` : "/healthcare/vital-signs";
  }
  if (norm === "patientappointment" || norm === "appointment") {
    return reference_name ? `/healthcare/appointments/${reference_name}` : "/healthcare/appointments";
  }
  if (norm === "drugprescription" || norm === "prescription") {
    return "/healthcare/prescriptions";
  }
  if (norm === "labtest" || norm === "labresult") {
    return reference_name ? `/healthcare/lab-tests/${reference_name}` : "/healthcare/lab-tests";
  }
  if (norm === "inpatientrecord" || norm === "inpatient") {
    return "/healthcare/inpatient";
  }
  if (norm === "medicationrequest" || norm === "pharmacystock" || norm === "pharmacy") {
    return "/healthcare/pharmacy";
  }
  if (norm === "medicalleaveslip" || norm === "medicalleave" || norm === "sickleave") {
    return "/healthcare/occupational/sick-leave-certificates";
  }
  if (norm === "observation") {
    return reference_name ? `/healthcare/diagnostics/observations/${reference_name}` : "/healthcare/diagnostics/observations";
  }
  if (norm === "healthcarepractitioner" || norm === "practitioner") {
    return reference_name ? `/healthcare/practitioners/${reference_name}` : "/healthcare/practitioners";
  }
  if (norm === "servicerequest") {
    return reference_name ? `/healthcare/service-requests/${reference_name}` : "/healthcare/service-requests";
  }

  const map: Record<string, string> = {
    "Error Log": "/erp/error-logs",
    "Communication": "/erp/communications",
    "Comment": "/erp/comments",
    "Workflow": "/erp/workflows",
    "Workflow Action": "/erp/workflows",
  };
  return map[doctype] || "/healthcare";
}

// ── Main Component ─────────────────────────────────────────────

export default function NoticeButton() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const navigate = useNavigate();

  const userInfo = useUserInfo();
  const isHealthcareAdmin = (() => {
    if (userInfo?.is_staff || (userInfo as any)?.is_superuser) return true;
    const adminRoleNames = ["Healthcare Administrator", "System Manager", "Administrator"];
    const roles = userInfo?.roles || [];
    return roles.some((r: any) => {
      const roleName = typeof r === "string" ? r : r?.name || "";
      return adminRoleNames.includes(roleName);
    });
  })();

  const [activeTab, setActiveTab] = useState(() => (isHealthcareAdmin ? "all" : "clinical"));

  useEffect(() => {
    if (!isHealthcareAdmin && (activeTab === "all" || activeTab === "errors")) {
      setActiveTab("clinical");
    } else if (isHealthcareAdmin && (activeTab === "clinical" || activeTab === "comms" || activeTab === "comments")) {
      setActiveTab("all");
    }
  }, [isHealthcareAdmin, activeTab]);

  const counts = useNotificationStore((s) => s.counts);
  const fetchCounts = useNotificationStore((s) => s.actions.fetchCounts);

  const totalCount = isHealthcareAdmin
    ? counts.error_logs + (counts.job_failures || 0) + (counts.failed_deliveries || 0) + (counts.unread_notifications || 0)
    : (counts.unread_notifications || 0) + counts.communications + counts.comments;

  // Fetch counts when drawer opens
  useEffect(() => {
    if (drawerOpen) {
      fetchCounts();
    }
  }, [drawerOpen, fetchCounts]);

  const handleNavigate = useCallback(
    (path: string) => {
      setDrawerOpen(false);
      navigate(path);
    },
    [navigate],
  );

  return (
    <>
      {/* Bell Button with live badge */}
      <div className="relative">
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full"
          onClick={() => setDrawerOpen(true)}
        >
          <Icon icon="solar:bell-bing-bold-duotone" size={24} />
        </Button>
        {totalCount > 0 && (
          <div className="absolute -right-1 -top-1">
            <NotificationBadge count={totalCount} pulse />
          </div>
        )}
      </div>

      {/* Drawer */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="right" className="sm:max-w-md p-0 [&>button]:hidden flex flex-col">
          <SheetHeader className="flex flex-row items-center justify-between p-4 h-16 shrink-0 border-b">
            <div className="flex items-center gap-2">
              <SheetTitle>Notifications</SheetTitle>
              {totalCount > 0 && (
                <NotificationBadge count={totalCount} className="ml-1" />
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full text-muted-foreground"
              onClick={() => setDrawerOpen(false)}
            >
              <Icon icon="solar:close-bold" size={20} />
            </Button>
          </SheetHeader>

          <div className="px-4 flex-1 overflow-hidden">
            <NoticeTabs
              activeTab={activeTab}
              onTabChange={setActiveTab}
              onNavigate={handleNavigate}
              isHealthcareAdmin={isHealthcareAdmin}
            />
          </div>

          <SheetFooter className="flex flex-row h-14 w-full items-center justify-between p-4 shrink-0 border-t">
            <Button
              variant="outline"
              className="flex-1 mr-2"
              onClick={() => handleNavigate(isHealthcareAdmin ? "/erp/error-logs" : "/healthcare/appointments")}
            >
              View All
            </Button>
            <Button
              className="flex-1 ml-2"
              onClick={() => {
                fetchCounts();
              }}
            >
              Refresh
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}

// ── Tabs Component ─────────────────────────────────────────────

interface NoticeTabsProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onNavigate: (path: string) => void;
  isHealthcareAdmin: boolean;
}

function NoticeTabs({ activeTab, onTabChange, onNavigate, isHealthcareAdmin }: NoticeTabsProps) {
  const counts = useNotificationStore((s) => s.counts);

  if (isHealthcareAdmin) {
    const errorCount = counts.error_logs + (counts.failed_deliveries || 0);
    const totalAdmin = errorCount + (counts.unread_notifications || 0);

    return (
      <Tabs value={activeTab} onValueChange={onTabChange} className="w-full h-full flex flex-col">
        <TabsList className="gap-2 w-full flex justify-between items-center shrink-0">
          <TabsTrigger value="all" className="flex items-center justify-center gap-1 flex-1">
            <span>All</span>
            {totalAdmin > 0 && <Badge variant="default">{totalAdmin}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="errors" className="flex items-center justify-center gap-1 flex-1">
            <span>Errors</span>
            {errorCount > 0 && <Badge variant="destructive">{errorCount}</Badge>}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <AllNotifications onNavigate={onNavigate} />
          </ScrollArea>
        </TabsContent>
        <TabsContent value="errors" className="flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <ErrorLogsList onNavigate={onNavigate} />
          </ScrollArea>
        </TabsContent>
      </Tabs>
    );
  }

  return (
    <Tabs value={activeTab} onValueChange={onTabChange} className="w-full h-full flex flex-col">
      <TabsList className="gap-2 w-full flex justify-between items-center shrink-0">
        <TabsTrigger value="clinical" className="flex items-center justify-center gap-1 flex-1">
          <span>Clinical</span>
          {(counts.unread_notifications || 0) > 0 && (
            <Badge variant="default" className="bg-emerald-600 text-white">
              {counts.unread_notifications}
            </Badge>
          )}
        </TabsTrigger>
        <TabsTrigger value="comms" className="flex items-center justify-center gap-1 flex-1">
          <span>Messages</span>
          {counts.communications > 0 && <Badge variant="info">{counts.communications}</Badge>}
        </TabsTrigger>
        <TabsTrigger value="comments" className="flex items-center justify-center gap-1 flex-1">
          <span>Comments</span>
          {counts.comments > 0 && <Badge variant="success">{counts.comments}</Badge>}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="clinical" className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <ClinicalNotificationsList onNavigate={onNavigate} />
        </ScrollArea>
      </TabsContent>
      <TabsContent value="comms" className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <CommunicationsList onNavigate={onNavigate} />
        </ScrollArea>
      </TabsContent>
      <TabsContent value="comments" className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <CommentsList onNavigate={onNavigate} />
        </ScrollArea>
      </TabsContent>
    </Tabs>
  );
}

// ── Badge re-export (local) ────────────────────────────────────

import { Badge } from "@/ui/badge";

// ── All Notifications (combined) ───────────────────────────────

function AllNotifications({ onNavigate }: { onNavigate: (path: string) => void }) {
  const [errorLogs, setErrorLogs] = useState<ErrorLogItem[]>([]);
  const [failedDeliveries, setFailedDeliveries] = useState<NotificationDeliveryItem[]>([]);
  const [communications, setCommunications] = useState<CommunicationItem[]>([]);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [clinical, setClinical] = useState<NotificationDeliveryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        const [errors, failedDels, comms, commentsData, clinicalData] = await Promise.allSettled([
          apiClient.get<{ results: ErrorLogItem[] }>({
            url: "/roles/error-logs/",
            params: { page_size: 5, ordering: "-creation" },
          }),
          apiClient.get<{ results: NotificationDeliveryItem[] }>({
            url: "/roles/notification-deliveries/",
            params: { category: "errors", page_size: 5, ordering: "-creation" },
          }),
          apiClient.get<{ results: CommunicationItem[] }>({
            url: "/roles/communications/",
            params: { page_size: 5, ordering: "-creation" },
          }),
          apiClient.get<{ results: CommentItem[] }>({
            url: "/roles/comments/",
            params: { page_size: 5, ordering: "-creation" },
          }),
          apiClient.get<{ results: NotificationDeliveryItem[] }>({
            url: "/roles/notification-deliveries/",
            params: { page_size: 5, ordering: "-creation" },
          }),
        ]);
        if (errors.status === "fulfilled") setErrorLogs(errors.value.results || []);
        if (failedDels.status === "fulfilled") setFailedDeliveries(failedDels.value.results || []);
        if (comms.status === "fulfilled") setCommunications(comms.value.results || []);
        if (commentsData.status === "fulfilled") setComments(commentsData.value.results || []);
        if (clinicalData.status === "fulfilled") setClinical(clinicalData.value.results || []);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  const fetchCounts = useNotificationStore((s) => s.actions.fetchCounts);

  const handleClinicalMarkRead = async (id: number) => {
    try {
      await apiClient.post({ url: `/roles/notification-deliveries/${id}/mark_read/` });
      setClinical((prev) =>
        prev.map((i) => (i.id === id ? { ...i, status: "read" } : i))
      );
      fetchCounts();
    } catch {
      // ignore
    }
  };

  if (loading) return <LoadingState />;

  const allItems = [
    ...clinical.map((cl) => ({ type: "clinical" as const, data: cl, date: cl.creation })),
    ...failedDeliveries.map((f) => ({ type: "failed_delivery" as const, data: f, date: f.creation })),
    ...errorLogs.map((e) => ({ type: "error" as const, data: e, date: e.creation })),
    ...communications.map((c) => ({ type: "communication" as const, data: c, date: c.creation })),
    ...comments.map((c) => ({ type: "comment" as const, data: c, date: c.creation })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  if (allItems.length === 0) return <EmptyState />;

  return (
    <div className="space-y-0">
      {allItems.map((item, idx) => {
        if (item.type === "clinical")
          return (
            <ClinicalNotificationRow
              key={`cl-${idx}`}
              item={item.data}
              onNavigate={onNavigate}
              onMarkRead={handleClinicalMarkRead}
            />
          );
        if (item.type === "failed_delivery")
          return <FailedDeliveryRow key={`fd-${idx}`} item={item.data} onNavigate={onNavigate} />;
        if (item.type === "error") return <ErrorLogRow key={`e-${idx}`} item={item.data} onNavigate={onNavigate} />;
        if (item.type === "communication") return <CommunicationRow key={`c-${idx}`} item={item.data} onNavigate={onNavigate} />;
        return <CommentRow key={`co-${idx}`} item={item.data} onNavigate={onNavigate} />;
      })}
    </div>
  );
}

// ── Error Logs List ────────────────────────────────────────────

function ErrorLogsList({ onNavigate }: { onNavigate: (path: string) => void }) {
  const [items, setItems] = useState<ErrorLogItem[]>([]);
  const [failedDeliveries, setFailedDeliveries] = useState<NotificationDeliveryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.allSettled([
      apiClient.get<{ results: ErrorLogItem[] }>({
        url: "/roles/error-logs/",
        params: { page_size: 20, ordering: "-creation" },
      }),
      apiClient.get<{ results: NotificationDeliveryItem[] }>({
        url: "/roles/notification-deliveries/",
        params: { category: "errors", page_size: 20, ordering: "-creation" },
      }),
    ])
      .then(([errRes, delRes]) => {
        if (errRes.status === "fulfilled") setItems(errRes.value.results || []);
        if (delRes.status === "fulfilled") setFailedDeliveries(delRes.value.results || []);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState />;

  const combined = [
    ...items.map((e) => ({ type: "error" as const, data: e, date: e.creation })),
    ...failedDeliveries.map((f) => ({ type: "failed_delivery" as const, data: f, date: f.creation })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  if (combined.length === 0) return <EmptyState message="No error logs or delivery failures" />;

  return (
    <div className="space-y-0">
      {combined.map((item, idx) =>
        item.type === "error" ? (
          <ErrorLogRow key={`e-${item.data.id || idx}`} item={item.data} onNavigate={onNavigate} />
        ) : (
          <FailedDeliveryRow key={`fd-${item.data.id || idx}`} item={item.data} onNavigate={onNavigate} />
        )
      )}
    </div>
  );
}

function FailedDeliveryRow({
  item,
  onNavigate,
}: {
  item: NotificationDeliveryItem;
  onNavigate: (path: string) => void;
}) {
  return (
    <div
      className="flex items-start gap-3 py-3 border-b border-border last:border-b-0 cursor-pointer hover:bg-accent/50 transition-colors -mx-1 px-1 rounded"
      onClick={() => onNavigate(item.action_url || "/healthcare")}
    >
      <div className="w-9 h-9 rounded-full bg-rose-500/10 flex items-center justify-center shrink-0 mt-0.5">
        <Icon icon="solar:danger-triangle-bold" size={18} className="text-rose-600" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Badge variant="destructive" className="text-[10px] px-1.5 font-medium">
            Delivery Failure
          </Badge>
          <Badge variant="outline" className="text-[9px] px-1 py-0 uppercase tracking-wider text-muted-foreground">
            {item.channel}
          </Badge>
          {item.reference_doctype && (
            <Text variant="caption" color="secondary">
              {item.reference_doctype}
            </Text>
          )}
        </div>
        <Text variant="subTitle2" className="mt-1 line-clamp-2">
          {item.subject}
        </Text>
        <Text variant="caption" className="mt-1 line-clamp-2 text-muted-foreground">
          {item.message}
        </Text>
        <div className="flex items-center gap-2 mt-1">
          <Text variant="caption" color="secondary">
            {timeAgo(item.creation)}
            {item.recipient_name && ` • Recipient: ${item.recipient_name}`}
          </Text>
        </div>
      </div>
    </div>
  );
}

function ErrorLogRow({ item, onNavigate }: { item: ErrorLogItem; onNavigate: (path: string) => void }) {
  return (
    <div
      className="flex items-start gap-3 py-3 border-b border-border last:border-b-0 cursor-pointer hover:bg-accent/50 transition-colors -mx-1 px-1 rounded"
      onClick={() => onNavigate("/erp/error-logs")}
    >
      <div className="w-9 h-9 rounded-full bg-destructive/10 flex items-center justify-center shrink-0 mt-0.5">
        <Icon icon={getErrorMethodIcon(item.method)} size={18} className="text-destructive" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Badge variant="destructive" className="text-[10px] px-1.5">
            {item.method || "ERROR"}
          </Badge>
          {item.reference_doctype && (
            <Text variant="caption" color="secondary">
              {item.reference_doctype}
            </Text>
          )}
        </div>
        <Text variant="subTitle2" className="mt-1 line-clamp-2">
          {item.error?.substring(0, 120)}
          {(item.error?.length || 0) > 120 && "..."}
        </Text>
        <Text variant="caption" color="secondary" className="mt-1">
          {timeAgo(item.creation)}
          {item.reference_name && ` • ${item.reference_name}`}
        </Text>
      </div>
      {!item.seen && (
        <div className="w-2 h-2 rounded-full bg-destructive shrink-0 mt-2" />
      )}
    </div>
  );
}

// ── Communications List ────────────────────────────────────────

function CommunicationsList({ onNavigate }: { onNavigate: (path: string) => void }) {
  const [items, setItems] = useState<CommunicationItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient
      .get<{ results: CommunicationItem[] }>({
        url: "/roles/communications/",
        params: { page_size: 20, ordering: "-creation" },
      })
      .then((res) => setItems(res.results || []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState />;
  if (items.length === 0) return <EmptyState message="No messages" />;

  return (
    <div className="space-y-0">
      {items.map((item) => (
        <CommunicationRow key={item.id} item={item} onNavigate={onNavigate} />
      ))}
    </div>
  );
}

function CommunicationRow({ item, onNavigate }: { item: CommunicationItem; onNavigate: (path: string) => void }) {
  const route = getRouteForDoc(item.reference_doctype);
  return (
    <div
      className="flex items-start gap-3 py-3 border-b border-border last:border-b-0 cursor-pointer hover:bg-accent/50 transition-colors -mx-1 px-1 rounded"
      onClick={() => onNavigate(route)}
    >
      <div className="w-9 h-9 rounded-full bg-info/10 flex items-center justify-center shrink-0 mt-0.5">
        <Icon icon={getMediumIcon(item.communication_medium)} size={18} className={getMediumColor(item.communication_medium)} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Text variant="subTitle2" className="truncate">
            {item.subject || "(no subject)"}
          </Text>
        </div>
        <Text variant="caption" color="secondary" className="mt-0.5 line-clamp-1">
          {item.sender_full_name || item.sender || "System"}
        </Text>
        <div className="flex items-center gap-2 mt-1">
          <Badge variant="outline" className="text-[10px] px-1.5 capitalize">
            {item.communication_medium || "System"}
          </Badge>
          {item.status && (
            <Text variant="caption" color="secondary">
              {item.status}
            </Text>
          )}
          <Text variant="caption" color="secondary">
            {timeAgo(item.creation)}
          </Text>
        </div>
      </div>
    </div>
  );
}

// ── Comments List ──────────────────────────────────────────────

function CommentsList({ onNavigate }: { onNavigate: (path: string) => void }) {
  const [items, setItems] = useState<CommentItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient
      .get<{ results: CommentItem[] }>({
        url: "/roles/comments/",
        params: { page_size: 20, ordering: "-creation" },
      })
      .then((res) => setItems(res.results || []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState />;
  if (items.length === 0) return <EmptyState message="No comments" />;

  return (
    <div className="space-y-0">
      {items.map((item) => (
        <CommentRow key={item.id} item={item} onNavigate={onNavigate} />
      ))}
    </div>
  );
}

function CommentRow({ item, onNavigate }: { item: CommentItem; onNavigate: (path: string) => void }) {
  const route = getRouteForDoc(item.reference_doctype);
  return (
    <div
      className="flex items-start gap-3 py-3 border-b border-border last:border-b-0 cursor-pointer hover:bg-accent/50 transition-colors -mx-1 px-1 rounded"
      onClick={() => onNavigate(route)}
    >
      <div className="w-9 h-9 rounded-full bg-success/10 flex items-center justify-center shrink-0 mt-0.5">
        <Icon icon="solar:chat-round-dots-bold" size={18} className="text-success" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Text variant="subTitle2">
            {item.comment_by || item.subject || "Comment"}
          </Text>
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${getCommentTypeColor(item.comment_type)}`}>
            {item.comment_type || "Comment"}
          </span>
        </div>
        <Text variant="caption" className="mt-1 line-clamp-2 text-muted-foreground">
          {item.content?.substring(0, 150)}
          {(item.content?.length || 0) > 150 && "..."}
        </Text>
        <div className="flex items-center gap-2 mt-1">
          {item.reference_doctype && (
            <Badge variant="outline" className="text-[10px] px-1.5">
              {item.reference_doctype}
            </Badge>
          )}
          <Text variant="caption" color="secondary">
            {timeAgo(item.creation)}
          </Text>
        </div>
      </div>
    </div>
  );
}

// ── Clinical Notifications List ───────────────────────────────

interface ClinicalEventMeta {
  badge: string;
  badgeClass: string;
  icon: string;
  iconColor: string;
  bgColor: string;
}

function getClinicalEventMeta(event: string): ClinicalEventMeta {
  switch (event) {
    case "vital_signs_alert":
      return {
        badge: "VITAL ALERT",
        badgeClass: "bg-rose-600 text-white animate-pulse",
        icon: "solar:heart-pulse-bold",
        iconColor: "text-rose-600",
        bgColor: "bg-rose-500/10",
      };
    case "patient_assigned":
      return {
        badge: "Patient Assigned",
        badgeClass: "bg-blue-600 text-white font-medium",
        icon: "solar:user-check-bold",
        iconColor: "text-blue-600",
        bgColor: "bg-blue-500/10",
      };
    case "patient_reassigned":
      return {
        badge: "Patient Reassigned",
        badgeClass: "bg-amber-600 text-white font-medium",
        icon: "solar:user-cross-bold",
        iconColor: "text-amber-600",
        bgColor: "bg-amber-500/10",
      };
    case "patient_appointment_created":
      return {
        badge: "Appointment",
        badgeClass: "bg-blue-600 text-white",
        icon: "solar:calendar-date-bold",
        iconColor: "text-blue-600",
        bgColor: "bg-blue-500/10",
      };
    case "patient_appointment_cancelled":
      return {
        badge: "Cancelled",
        badgeClass: "bg-amber-600 text-white",
        icon: "solar:calendar-minimalistic-bold",
        iconColor: "text-amber-600",
        bgColor: "bg-amber-500/10",
      };
    case "prescription_created":
      return {
        badge: "Prescription (Rx)",
        badgeClass: "bg-purple-600 text-white",
        icon: "solar:pills-bold",
        iconColor: "text-purple-600",
        bgColor: "bg-purple-500/10",
      };
    case "lab_test_ordered":
      return {
        badge: "Lab Order",
        badgeClass: "bg-sky-600 text-white",
        icon: "solar:test-tube-bold",
        iconColor: "text-sky-600",
        bgColor: "bg-sky-500/10",
      };
    case "lab_test_approved":
    case "lab_result_approved":
      return {
        badge: "Result Ready",
        badgeClass: "bg-emerald-600 text-white",
        icon: "solar:test-tube-minimalistic-bold",
        iconColor: "text-emerald-600",
        bgColor: "bg-emerald-500/10",
      };
    case "inpatient_admission":
      return {
        badge: "Inpatient Admit",
        badgeClass: "bg-indigo-600 text-white",
        icon: "solar:bed-bold",
        iconColor: "text-indigo-600",
        bgColor: "bg-indigo-500/10",
      };
    case "inpatient_discharge":
      return {
        badge: "Discharged",
        badgeClass: "bg-teal-600 text-white",
        icon: "solar:square-share-line-bold",
        iconColor: "text-teal-600",
        bgColor: "bg-teal-500/10",
      };
    case "pharmacy_dispensed":
      return {
        badge: "Dispensed",
        badgeClass: "bg-cyan-600 text-white",
        icon: "solar:box-minimalistic-bold",
        iconColor: "text-cyan-600",
        bgColor: "bg-cyan-500/10",
      };
    case "low_stock_alert":
      return {
        badge: "Low Stock",
        badgeClass: "bg-amber-600 text-white",
        icon: "solar:danger-triangle-bold",
        iconColor: "text-amber-600",
        bgColor: "bg-amber-500/10",
      };
    case "medical_leave_created":
      return {
        badge: "Medical Leave",
        badgeClass: "bg-slate-700 text-white",
        icon: "solar:document-text-bold",
        iconColor: "text-slate-700",
        bgColor: "bg-slate-500/10",
      };
    default:
      return {
        badge: "Clinical Alert",
        badgeClass: "bg-primary text-white",
        icon: "solar:bell-bing-bold-duotone",
        iconColor: "text-primary",
        bgColor: "bg-primary/10",
      };
  }
}

function ClinicalNotificationsList({ onNavigate }: { onNavigate: (path: string) => void }) {
  const [items, setItems] = useState<NotificationDeliveryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const fetchCounts = useNotificationStore((s) => s.actions.fetchCounts);

  const fetchItems = useCallback(() => {
    setLoading(true);
    apiClient
      .get<{ results: NotificationDeliveryItem[] }>({
        url: "/roles/notification-deliveries/",
        params: { page_size: 30, ordering: "-creation" },
      })
      .then((res) => setItems(res.results || []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const handleMarkRead = async (id: number) => {
    try {
      await apiClient.post({ url: `/roles/notification-deliveries/${id}/mark_read/` });
      setItems((prev) =>
        prev.map((i) => (i.id === id ? { ...i, status: "read" } : i))
      );
      fetchCounts();
    } catch {
      // ignore
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await apiClient.post({ url: "/roles/notification-deliveries/mark_all_read/" });
      setItems((prev) => prev.map((i) => ({ ...i, status: "read" })));
      fetchCounts();
    } catch {
      // ignore
    }
  };

  if (loading) return <LoadingState />;
  if (items.length === 0) return <EmptyState message="No clinical notifications" />;

  const unreadCount = items.filter((i) => i.status !== "read").length;

  return (
    <div className="space-y-0">
      {unreadCount > 0 && (
        <div className="flex items-center justify-between pb-2 mb-2 border-b">
          <Text variant="caption" color="secondary">
            {unreadCount} unread clinical alert{unreadCount > 1 ? "s" : ""}
          </Text>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-primary px-2"
            onClick={handleMarkAllRead}
          >
            Mark all read
          </Button>
        </div>
      )}
      {items.map((item) => (
        <ClinicalNotificationRow
          key={item.id}
          item={item}
          onNavigate={onNavigate}
          onMarkRead={handleMarkRead}
        />
      ))}
    </div>
  );
}

function ClinicalNotificationRow({
  item,
  onNavigate,
  onMarkRead,
}: {
  item: NotificationDeliveryItem;
  onNavigate: (path: string) => void;
  onMarkRead?: (id: number) => void;
}) {
  const meta = getClinicalEventMeta(item.event);
  const route = item.action_url || getRouteForDoc(item.reference_doctype, item.reference_name);

  const handleClick = () => {
    if (item.status !== "read" && onMarkRead) {
      onMarkRead(item.id);
    }
    onNavigate(route);
  };

  return (
    <div
      className="flex items-start gap-3 py-3 border-b border-border last:border-b-0 cursor-pointer hover:bg-accent/50 transition-colors -mx-1 px-1 rounded"
      onClick={handleClick}
    >
      <div className={`w-9 h-9 rounded-full ${meta.bgColor} flex items-center justify-center shrink-0 mt-0.5`}>
        <Icon icon={meta.icon} size={18} className={meta.iconColor} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Badge
            variant="default"
            className={`text-[10px] px-1.5 font-medium ${meta.badgeClass}`}
          >
            {meta.badge}
          </Badge>
          {item.reference_doctype && (
            <Text variant="caption" color="secondary">
              {item.reference_doctype}
            </Text>
          )}
        </div>
        <Text variant="subTitle2" className="mt-1 line-clamp-2">
          {item.subject}
        </Text>
        <Text variant="caption" className="mt-1 line-clamp-2 text-muted-foreground">
          {item.message?.substring(0, 150)}
        </Text>
        <div className="flex items-center gap-2 mt-1">
          <Badge variant="outline" className="text-[9px] px-1 py-0 uppercase tracking-wider text-muted-foreground">
            {item.channel}
          </Badge>
          <Text variant="caption" color="secondary">
            {timeAgo(item.creation)}
            {item.reference_name && ` • #${item.reference_name}`}
          </Text>
        </div>
      </div>
      {item.status !== "read" && (
        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0 mt-2 ring-2 ring-emerald-500/20" title="Unread" />
      )}
    </div>
  );
}

// ── Shared Components ──────────────────────────────────────────

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
      <Icon icon="solar:refresh-bold" size={24} className="animate-spin mb-2" />
      <Text variant="caption">Loading notifications...</Text>
    </div>
  );
}

function EmptyState({ message = "No notifications" }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
      <Icon icon="solar:bell-off-bold" size={32} className="mb-2 opacity-50" />
      <Text variant="subTitle2" color="secondary">{message}</Text>
      <Text variant="caption" color="secondary">You're all caught up!</Text>
    </div>
  );
}
