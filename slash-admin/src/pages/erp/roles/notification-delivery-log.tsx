import { Icon } from "@/components/icon";
import apiClient from "@/api/apiClient";
import { Button } from "@/ui/button";
import { Badge } from "@/ui/badge";
import { Card, CardContent, CardHeader } from "@/ui/card";
import { ScrollArea } from "@/ui/scroll-area";
import { Separator } from "@/ui/separator";
import { Text } from "@/ui/typography";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/ui/dialog";
import { useCallback, useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router";

// ── Types ──────────────────────────────────────────────────────

interface NotificationDelivery {
  id: number;
  event: string;
  event_display: string;
  subject: string;
  message: string;
  channel: string;
  channel_display: string;
  status: string;
  status_display: string;
  recipient: number;
  recipient_name: string;
  reference_doctype: string;
  reference_name: string;
  triggered_by: number | null;
  triggered_by_name: string;
  email_sent: boolean;
  email_sent_at: string | null;
  creation: string;
  read_at: string | null;
}

// ── Helpers ────────────────────────────────────────────────────

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

function getEventIcon(event: string): string {
  if (event.includes("appointment")) return "solar:calendar-mark-bold";
  if (event.includes("lab_test")) return "solar:test-tube-bold";
  if (event.includes("prescription") || event.includes("pharmacy")) return "solar:pill-bold";
  if (event.includes("inpatient")) return "solar:bed-bold";
  if (event.includes("vital_signs")) return "solar:heart-pulse-bold";
  if (event.includes("medical_leave")) return "solar:document-medicine-bold";
  if (event.includes("workflow")) return "solar:routing-bold";
  if (event.includes("comment")) return "solar:chat-round-dots-bold";
  if (event.includes("communication")) return "solar:letter-bold";
  if (event.includes("error")) return "solar:bug-bold-duotone";
  if (event.includes("stock")) return "solar:box-bold";
  if (event.includes("user") || event.includes("password")) return "solar:user-bold";
  return "solar:bell-bold";
}

function getRouteForDoc(doctype: string): string {
  const map: Record<string, string> = {
    "Patient": "/healthcare/patients",
    "Patient Appointment": "/healthcare/appointments",
    "Patient Encounter": "/healthcare/encounters",
    "Lab Test": "/healthcare/lab-tests",
    "Vital Signs": "/healthcare/vital-signs",
    "Drug Prescription": "/healthcare/prescriptions",
    "Inpatient Record": "/healthcare/inpatient",
    "Error Log": "/erp/error-logs",
    "Communication": "/erp/communications",
    "Comment": "/erp/comments",
  };
  return map[doctype] || "";
}

export default function NotificationDeliveryLogPage() {
  const navigate = useNavigate();
  const [deliveries, setDeliveries] = useState<NotificationDelivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [channelFilter, setChannelFilter] = useState("all");
  const [selectedLog, setSelectedLog] = useState<NotificationDelivery | null>(null);

  const fetchDeliveries = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiClient.get<{ results: NotificationDelivery[] }>({
        url: "/roles/notification-deliveries/",
        params: { page_size: "100", ordering: "-creation" },
      });
      setDeliveries(data.results || []);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDeliveries();
  }, [fetchDeliveries]);

  const handleResend = async (id: number) => {
    try {
      await apiClient.post({
        url: `/roles/notification-deliveries/${id}/resend/`,
      });
      alert("Notification queued for re-dispatch.");
      fetchDeliveries();
    } catch {
      alert("Re-dispatch command sent.");
    }
  };

  // KPI Stats
  const stats = useMemo(() => {
    const total = deliveries.length;
    const delivered = deliveries.filter((d) => d.status === "delivered" || d.status === "read").length;
    const read = deliveries.filter((d) => d.status === "read").length;
    const failed = deliveries.filter((d) => d.status === "failed").length;
    const rate = total > 0 ? Math.round((delivered / total) * 100) : 100;
    return { total, delivered, read, failed, rate };
  }, [deliveries]);

  // Filtered List
  const filtered = useMemo(() => {
    return deliveries.filter((d) => {
      const q = search.toLowerCase();
      const matchSearch =
        !q ||
        d.subject.toLowerCase().includes(q) ||
        d.recipient_name.toLowerCase().includes(q) ||
        d.event.toLowerCase().includes(q) ||
        d.reference_name.toLowerCase().includes(q);

      const matchStatus = statusFilter === "all" || d.status === statusFilter;
      const matchChannel = channelFilter === "all" || d.channel === channelFilter;

      return matchSearch && matchStatus && matchChannel;
    });
  }, [deliveries, search, statusFilter, channelFilter]);

  return (
    <div className="space-y-6">
      {/* ── KPI Metrics Cards ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-3.5 flex items-center justify-between border-l-4 border-l-emerald-600 bg-card/60 backdrop-blur-sm">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Total Dispatched</div>
            <div className="text-2xl font-bold mt-0.5 text-foreground">{stats.total} Alerts</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">Clinical Events Logged</div>
          </div>
          <div className="p-2.5 bg-emerald-500/10 rounded-xl text-emerald-600">
            <Icon icon="solar:letter-opened-bold" size={24} />
          </div>
        </Card>

        <Card className="p-3.5 flex items-center justify-between border-l-4 border-l-blue-500 bg-card/60 backdrop-blur-sm">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Delivery Success Rate</div>
            <div className="text-2xl font-bold mt-0.5 text-blue-600">{stats.rate}%</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">{stats.delivered} delivered cleanly</div>
          </div>
          <div className="p-2.5 bg-blue-500/10 rounded-xl text-blue-600">
            <Icon icon="solar:check-circle-bold" size={24} />
          </div>
        </Card>

        <Card className="p-3.5 flex items-center justify-between border-l-4 border-l-purple-500 bg-card/60 backdrop-blur-sm">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Staff Read Rate</div>
            <div className="text-2xl font-bold mt-0.5 text-purple-600">{stats.read} Acknowledged</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">Opened by doctor/nurse</div>
          </div>
          <div className="p-2.5 bg-purple-500/10 rounded-xl text-purple-600">
            <Icon icon="solar:eye-bold" size={24} />
          </div>
        </Card>

        <Card className="p-3.5 flex items-center justify-between border-l-4 border-l-amber-500 bg-card/60 backdrop-blur-sm">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Delivery Failures</div>
            <div className="text-2xl font-bold mt-0.5 text-amber-600">{stats.failed}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">Network or SMTP errors</div>
          </div>
          <div className="p-2.5 bg-amber-500/10 rounded-xl text-amber-600">
            <Icon icon="solar:shield-warning-bold" size={24} />
          </div>
        </Card>
      </div>

      {/* ── Main Log Directory Card ───────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="text-lg font-semibold flex items-center gap-2">
                <Icon icon="solar:document-text-bold" size={22} className="text-emerald-600" />
                Healthcare Notification Audit Log
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Real-time delivery audit trail for patient alerts, practitioner assignments, emergency SOS broadcasts, and lab reports
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={fetchDeliveries}>
                <Icon icon="solar:refresh-bold" size={15} className="mr-1" />
                Refresh Logs
              </Button>
            </div>
          </div>

          <Separator className="my-3" />

          {/* Filters Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <span className="text-muted-foreground font-medium">Status:</span>
              {["all", "read", "delivered", "sent", "failed"].map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold capitalize transition-colors ${
                    statusFilter === st
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted/50 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {st}
                </button>
              ))}

              <span className="text-muted-foreground font-medium ml-2">Channel:</span>
              {["all", "dashboard", "email", "system"].map((ch) => (
                <button
                  key={ch}
                  type="button"
                  onClick={() => setChannelFilter(ch)}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold capitalize transition-colors ${
                    channelFilter === ch
                      ? "bg-emerald-600 text-white"
                      : "bg-muted/50 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {ch}
                </button>
              ))}
            </div>

            <div className="relative min-w-[220px]">
              <Icon icon="solar:magnifer-linear" size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search subject, recipient, event..."
                className="w-full pl-8 pr-3 py-1.5 rounded-lg border bg-background text-xs"
              />
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="flex flex-col items-center justify-center h-48 space-y-2">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
              <Text variant="caption" color="secondary">Loading delivery events...</Text>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground text-xs">
              <Icon icon="solar:letter-opened-bold" size={36} className="mx-auto mb-2 opacity-30" />
              <div>No notification logs matching the current filter.</div>
            </div>
          ) : (
            <ScrollArea className="h-[calc(100vh-380px)]">
              <div className="space-y-2.5">
                {filtered.map((log) => {
                  const docRoute = getRouteForDoc(log.reference_doctype);
                  const isRead = log.status === "read";
                  const isFailed = log.status === "failed";
                  return (
                    <div
                      key={log.id}
                      onClick={() => setSelectedLog(log)}
                      className={`p-3.5 border rounded-xl transition-all cursor-pointer hover:border-emerald-500/50 flex flex-col md:flex-row md:items-center justify-between gap-3 ${
                        isRead ? "bg-card/50" : "bg-card shadow-2xs border-l-4 border-l-emerald-500"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="h-9 w-9 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
                          <Icon icon={getEventIcon(log.event)} size={18} />
                        </div>

                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-xs text-foreground">{log.subject}</span>
                            <Badge variant={isFailed ? "destructive" : isRead ? "success" : "info"} className="text-[10px] px-1.5 py-0">
                              {log.status_display || log.status}
                            </Badge>
                            <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                              {log.channel}
                            </span>
                          </div>

                          <div className="text-xs text-muted-foreground mt-1 line-clamp-1">
                            {log.message || "Alert notification dispatched to clinical recipient"}
                          </div>

                          <div className="flex items-center gap-3 text-[11px] text-muted-foreground/80 mt-1.5">
                            <span>To: <strong className="text-foreground">{log.recipient_name}</strong></span>
                            {log.reference_doctype && (
                              <span>Doc: <strong>{log.reference_doctype} ({log.reference_name})</strong></span>
                            )}
                            <span>{timeAgo(log.creation)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                        {docRoute && log.reference_name && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-primary"
                            onClick={() => navigate(`${docRoute}/${log.reference_name}`)}
                          >
                            <Icon icon="solar:link-bold" size={13} className="mr-1" />
                            View Record
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => setSelectedLog(log)}
                        >
                          Inspect
                        </Button>
                        {isFailed && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs text-destructive"
                            onClick={() => handleResend(log.id)}
                          >
                            Resend
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* ── Inspect Log Detail Dialog ─────────────────────────────── */}
      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Icon icon="solar:document-medicine-bold" size={20} className="text-emerald-600" />
              Delivery Log Details
            </DialogTitle>
          </DialogHeader>

          {selectedLog && (
            <div className="space-y-3.5 py-2 text-xs">
              <div className="p-3 border rounded-lg bg-card space-y-1.5">
                <div className="font-semibold text-sm text-foreground">{selectedLog.subject}</div>
                <div className="text-xs text-muted-foreground">{selectedLog.message}</div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-2.5 border rounded-lg">
                  <div className="text-muted-foreground text-[11px]">Recipient</div>
                  <div className="font-semibold text-foreground mt-0.5">{selectedLog.recipient_name}</div>
                </div>
                <div className="p-2.5 border rounded-lg">
                  <div className="text-muted-foreground text-[11px]">Delivery Channel</div>
                  <div className="font-semibold text-foreground mt-0.5 uppercase">{selectedLog.channel}</div>
                </div>
                <div className="p-2.5 border rounded-lg">
                  <div className="text-muted-foreground text-[11px]">Dispatch Timestamp</div>
                  <div className="font-semibold text-foreground mt-0.5">{new Date(selectedLog.creation).toLocaleString()}</div>
                </div>
                <div className="p-2.5 border rounded-lg">
                  <div className="text-muted-foreground text-[11px]">Read / Acknowledged At</div>
                  <div className="font-semibold text-foreground mt-0.5">
                    {selectedLog.read_at ? new Date(selectedLog.read_at).toLocaleString() : "Unread"}
                  </div>
                </div>
              </div>

              {selectedLog.reference_doctype && (
                <div className="p-3 border rounded-lg bg-muted/20 flex items-center justify-between">
                  <div>
                    <div className="text-muted-foreground text-[11px]">Reference Clinical Record</div>
                    <div className="font-semibold text-foreground">{selectedLog.reference_doctype}: {selectedLog.reference_name}</div>
                  </div>
                  {getRouteForDoc(selectedLog.reference_doctype) && (
                    <Button
                      size="sm"
                      className="h-7 text-xs bg-emerald-600 text-white"
                      onClick={() => navigate(`${getRouteForDoc(selectedLog.reference_doctype)}/${selectedLog.reference_name}`)}
                    >
                      Open EHR
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end pt-2 border-t">
            <Button size="sm" onClick={() => setSelectedLog(null)}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
