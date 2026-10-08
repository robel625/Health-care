import { Icon } from "@/components/icon";
import { Badge } from "@/ui/badge";
import { Button } from "@/ui/button";
import { Card, CardContent, CardHeader } from "@/ui/card";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/ui/dialog";
import Table, { type ColumnsType } from "antd/es/table";
import { useEffect, useState, useCallback } from "react";
import { ScheduledJobApi, type ScheduledJobType } from "@/api/services/erpService";

const FREQUENCY_BADGES: Record<string, "default" | "info" | "warning" | "success"> = {
  All: "default",
  Hourly: "info",
  Daily: "info",
  Weekly: "warning",
  Monthly: "success",
  "Cron": "warning",
};

export default function ScheduledJobsPage() {
  const [jobs, setJobs] = useState<ScheduledJobType[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [freqFilter, setFreqFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editJob, setEditJob] = useState<ScheduledJobType | null>(null);

  const [form, setForm] = useState({
    method: "",
    frequency: "Daily",
    cron_format: "",
    queue: "default",
    stopped: false,
    create_log: true,
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = { page };
      if (search) params.search = search;
      if (freqFilter) params.frequency = freqFilter;
      const res = await ScheduledJobApi.list(params);
      setJobs(res.results || []);
      setTotal(res.count || 0);
    } catch (err) {
      console.error("Failed to load jobs:", err);
    } finally {
      setLoading(false);
    }
  }, [page, search, freqFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSubmit = async () => {
    try {
      if (editJob) {
        await ScheduledJobApi.update(editJob.id, form);
      } else {
        await ScheduledJobApi.create(form);
      }
      setShowForm(false);
      setEditJob(null);
      setForm({ method: "", frequency: "Daily", cron_format: "", queue: "default", stopped: false, create_log: true });
      loadData();
    } catch (err) {
      console.error("Save failed:", err);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Delete this scheduled job?")) return;
    try {
      await ScheduledJobApi.delete(id);
      loadData();
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  const handleExecute = async (id: number) => {
    try {
      await ScheduledJobApi.execute(id);
      alert("Job queued for execution");
      loadData();
    } catch (err) {
      console.error("Execute failed:", err);
    }
  };

  const openEdit = (job: ScheduledJobType) => {
    setForm({
      method: job.method,
      frequency: job.frequency,
      cron_format: job.cron_format || "",
      queue: job.queue || "default",
      stopped: job.stopped,
      create_log: job.create_log,
    });
    setEditJob(job);
    setShowForm(true);
  };

  const columns: ColumnsType<ScheduledJobType> = [
    {
      title: "Method",
      dataIndex: "method",
      width: 300,
      render: (v) => (
        <span className="font-mono text-xs">{v}</span>
      ),
    },
    {
      title: "Frequency",
      dataIndex: "frequency",
      width: 110,
      render: (v) => (
        <Badge variant={FREQUENCY_BADGES[v] || "default"}>{v}</Badge>
      ),
    },
    {
      title: "Queue",
      dataIndex: "queue",
      width: 100,
      render: (v) => (
        <Badge variant="outline">{v || "default"}</Badge>
      ),
    },
    {
      title: "Cron",
      dataIndex: "cron_format",
      width: 140,
      render: (v) => v ? <span className="font-mono text-xs text-text-secondary">{v}</span> : "-",
    },
    {
      title: "Status",
      dataIndex: "stopped",
      width: 90,
      align: "center",
      render: (stopped) => (
        <Badge variant={stopped ? "error" : "success"}>
          {stopped ? "Stopped" : "Active"}
        </Badge>
      ),
    },
    {
      title: "Logs",
      dataIndex: "create_log",
      width: 60,
      align: "center",
      render: (v) => v ? (
        <Icon icon="mdi:check-circle" size={16} className="text-success" />
      ) : (
        <Icon icon="mdi:close-circle" size={16} className="text-text-secondary" />
      ),
    },
    {
      title: "Last Run",
      dataIndex: "last_execution",
      width: 160,
      render: (v) =>
        v
          ? new Date(v).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })
          : <span className="text-text-secondary">Never</span>,
    },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon icon="mdi:clock-outline" size={22} className="text-primary" />
            <span className="text-lg font-semibold">Scheduled Jobs</span>
            <Badge variant="outline">{total}</Badge>
          </div>
          <div className="flex items-center gap-2">
            <select
              className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
              value={freqFilter}
              onChange={(e) => { setFreqFilter(e.target.value); setPage(1); }}
            >
              <option value="">All Frequencies</option>
              <option value="All">All</option>
              <option value="Hourly">Hourly</option>
              <option value="Daily">Daily</option>
              <option value="Weekly">Weekly</option>
              <option value="Monthly">Monthly</option>
              <option value="Cron">Cron</option>
            </select>
            <Input
              placeholder="Search methods..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (setPage(1), loadData())}
              className="w-56"
            />
            <Button onClick={() => { setEditJob(null); setForm({ method: "", frequency: "Daily", cron_format: "", queue: "default", stopped: false, create_log: true }); setShowForm(true); }}>
              <Icon icon="mdi:plus" size={18} className="mr-1" /> New Job
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
              width: 130,
              render: (_, record) => (
                <div className="flex w-full justify-center gap-1">
                  <Button variant="ghost" size="icon" onClick={() => handleExecute(record.id)} title="Execute Now">
                    <Icon icon="mdi:play-circle-outline" size={18} className="text-info" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => openEdit(record)}>
                    <Icon icon="solar:pen-bold-duotone" size={18} />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(record.id)}>
                    <Icon icon="mingcute:delete-2-fill" size={18} className="text-error!" />
                  </Button>
                </div>
              ),
            },
          ]}
          dataSource={jobs}
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
            <DialogTitle>{editJob ? "Edit Scheduled Job" : "New Scheduled Job"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Method *</Label>
              <Input
                className="col-span-3"
                value={form.method}
                onChange={(e) => setForm({ ...form, method: e.target.value })}
                placeholder="e.g. erp.tasks.daily.cleanup"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Frequency</Label>
              <select
                className="col-span-3 h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                value={form.frequency}
                onChange={(e) => setForm({ ...form, frequency: e.target.value })}
              >
                <option value="All">All</option>
                <option value="Hourly">Hourly</option>
                <option value="Daily">Daily</option>
                <option value="Weekly">Weekly</option>
                <option value="Monthly">Monthly</option>
                <option value="Cron">Cron</option>
              </select>
            </div>
            {form.frequency === "Cron" && (
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Cron Format</Label>
                <Input
                  className="col-span-3"
                  value={form.cron_format}
                  onChange={(e) => setForm({ ...form, cron_format: e.target.value })}
                  placeholder="e.g. */5 * * * *"
                />
              </div>
            )}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Queue</Label>
              <select
                className="col-span-3 h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                value={form.queue}
                onChange={(e) => setForm({ ...form, queue: e.target.value })}
              >
                <option value="default">default</option>
                <option value="short">short</option>
                <option value="long">long</option>
              </select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Stopped</Label>
              <input
                type="checkbox"
                className="col-span-3 h-4 w-4"
                checked={form.stopped}
                onChange={(e) => setForm({ ...form, stopped: e.target.checked })}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Create Log</Label>
              <input
                type="checkbox"
                className="col-span-3 h-4 w-4"
                checked={form.create_log}
                onChange={(e) => setForm({ ...form, create_log: e.target.checked })}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={!form.method.trim()}>
              {editJob ? "Update" : "Create"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
