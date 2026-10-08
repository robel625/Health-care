import { Icon } from "@/components/icon";
import { Badge } from "@/ui/badge";
import { Button } from "@/ui/button";
import { Card, CardContent, CardHeader } from "@/ui/card";
import { Input } from "@/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/ui/dialog";
import Table, { type ColumnsType } from "antd/es/table";
import { useEffect, useState, useCallback } from "react";
import { ErrorLogApi, type ErrorLog } from "@/api/services/erpService";

export default function ErrorLogsPage() {
  const [logs, setLogs] = useState<ErrorLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [detailLog, setDetailLog] = useState<ErrorLog | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = { page };
      if (search) params.search = search;
      const res = await ErrorLogApi.list(params);
      setLogs(res.results || []);
      setTotal(res.count || 0);
    } catch (err) {
      console.error("Failed to load error logs:", err);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleClearAll = async () => {
    if (!window.confirm("Clear ALL error logs? This cannot be undone.")) return;
    try {
      await ErrorLogApi.clearAll();
      loadData();
    } catch (err) {
      console.error("Clear all failed:", err);
    }
  };

  const columns: ColumnsType<ErrorLog> = [
    {
      title: "Method",
      dataIndex: "method",
      width: 160,
      render: (v) => (
        <Badge variant="outline" className="font-mono text-xs">
          {v || "-"}
        </Badge>
      ),
    },
    {
      title: "Error",
      dataIndex: "error",
      width: 400,
      render: (v) => (
        <div className="text-xs text-error line-clamp-2 font-mono">
          {v || "-"}
        </div>
      ),
    },
    {
      title: "Reference",
      dataIndex: "reference_doctype",
      width: 160,
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
      title: "Seen",
      dataIndex: "seen",
      width: 70,
      align: "center",
      render: (v) => (
        <Badge variant={v ? "default" : "warning"}>
          {v ? "Yes" : "No"}
        </Badge>
      ),
    },
    {
      title: "Fingerprint",
      dataIndex: "fingerprint",
      width: 120,
      render: (v) => v ? (
        <span className="text-xs font-mono text-text-secondary">{v.substring(0, 12)}...</span>
      ) : "-",
    },
    {
      title: "Created",
      dataIndex: "creation",
      width: 160,
      render: (v) =>
        v
          ? new Date(v).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })
          : "-",
    },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon icon="mdi:bug-outline" size={22} className="text-error" />
            <span className="text-lg font-semibold">Error Logs</span>
            <Badge variant="outline">{total}</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Input
              placeholder="Search errors..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (setPage(1), loadData())}
              className="w-56"
            />
            <Button variant="destructive" onClick={handleClearAll}>
              <Icon icon="mdi:delete-sweep-outline" size={18} className="mr-1" /> Clear All
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
                <Button variant="ghost" size="icon" onClick={() => setDetailLog(record)}>
                  <Icon icon="mdi:eye-outline" size={18} />
                </Button>
              ),
            },
          ]}
          dataSource={logs}
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

      <Dialog open={!!detailLog} onOpenChange={() => setDetailLog(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Error Log Detail</DialogTitle>
          </DialogHeader>
          {detailLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-text-secondary">ID:</span> {detailLog.id}
                </div>
                <div>
                  <span className="text-text-secondary">Method:</span>{" "}
                  <Badge variant="outline" className="font-mono">{detailLog.method || "-"}</Badge>
                </div>
                <div>
                  <span className="text-text-secondary">Seen:</span>{" "}
                  <Badge variant={detailLog.seen ? "default" : "warning"}>
                    {detailLog.seen ? "Yes" : "No"}
                  </Badge>
                </div>
                <div>
                  <span className="text-text-secondary">Created:</span>{" "}
                  {detailLog.creation ? new Date(detailLog.creation).toLocaleString() : "-"}
                </div>
                {detailLog.reference_doctype && (
                  <div className="col-span-2">
                    <span className="text-text-secondary">Reference:</span>{" "}
                    <span className="font-mono text-xs">
                      {detailLog.reference_doctype}: {detailLog.reference_name}
                    </span>
                  </div>
                )}
                {detailLog.fingerprint && (
                  <div className="col-span-2">
                    <span className="text-text-secondary">Fingerprint:</span>{" "}
                    <span className="font-mono text-xs">{detailLog.fingerprint}</span>
                  </div>
                )}
                {detailLog.trace_id && (
                  <div className="col-span-2">
                    <span className="text-text-secondary">Trace ID:</span>{" "}
                    <span className="font-mono text-xs">{detailLog.trace_id}</span>
                  </div>
                )}
              </div>
              <div className="border-t pt-4">
                <div className="text-xs font-semibold text-text-secondary mb-2">Error Message</div>
                <pre className="rounded-md bg-destructive/5 border border-destructive/20 p-4 text-xs text-error overflow-x-auto whitespace-pre-wrap">
                  {detailLog.error}
                </pre>
              </div>
              {detailLog.metadata && Object.keys(detailLog.metadata).length > 0 && (
                <div className="border-t pt-4">
                  <div className="text-xs font-semibold text-text-secondary mb-2">Metadata</div>
                  <pre className="rounded-md bg-muted p-4 text-xs overflow-x-auto">
                    {JSON.stringify(detailLog.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
