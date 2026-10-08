import { Icon } from "@/components/icon";
import { Button } from "@/ui/button";
import { Card, CardContent, CardHeader } from "@/ui/card";
import { Input } from "@/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/ui/dialog";
import Table, { type ColumnsType } from "antd/es/table";
import { useState, useEffect, useCallback } from "react";

export interface ErpPageProps<T extends { id: number }> {
  title: string;
  columns: ColumnsType<T>;
  fetchData: (params?: Record<string, any>) => Promise<{ results: T[]; count: number }>;
  createItem?: (data: any) => Promise<any>;
  updateItem?: (id: number, data: any) => Promise<any>;
  deleteItem?: (id: number) => Promise<any>;
  searchPlaceholder?: string;
  createForm?: React.ReactNode;
  filterOptions?: React.ReactNode;
}

export default function ErpPage<T extends { id: number }>({
  title,
  columns,
  fetchData,
  createItem,
  updateItem,
  deleteItem,
  searchPlaceholder = "Search...",
  createForm,
  filterOptions,
}: ErpPageProps<T>) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editItem, setEditItem] = useState<T | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = { page };
      if (search) params.search = search;
      const res = await fetchData(params);
      setData(res.results || []);
      setTotal(res.count || 0);
    } catch (err) {
      console.error("Failed to load data:", err);
    } finally {
      setLoading(false);
    }
  }, [page, search, fetchData]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSearch = () => {
    setPage(1);
    loadData();
  };

  const handleDelete = async (id: number) => {
    if (!deleteItem) return;
    if (!window.confirm("Are you sure you want to delete this item?")) return;
    try {
      await deleteItem(id);
      loadData();
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  const actionColumn: ColumnsType<T> = deleteItem
    ? [
        {
          title: "Action",
          key: "action",
          align: "center",
          width: 100,
          render: (_, record) => (
            <div className="flex w-full justify-center gap-1">
              {updateItem && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setEditItem(record);
                    setShowEdit(true);
                  }}
                >
                  <Icon icon="solar:pen-bold-duotone" size={18} />
                </Button>
              )}
              <Button variant="ghost" size="icon" onClick={() => handleDelete(record.id)}>
                <Icon icon="mingcute:delete-2-fill" size={18} className="text-error!" />
              </Button>
            </div>
          ),
        },
      ]
    : [];

  const allColumns = [...columns, ...actionColumn];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="text-lg font-semibold">{title}</div>
          <div className="flex items-center gap-2">
            {filterOptions}
            <Input
              placeholder={searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="w-64"
            />
            {createItem && createForm && (
              <Button onClick={() => setShowCreate(true)}>
                <Icon icon="mdi:plus" size={18} className="mr-1" /> New
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Table
          rowKey="id"
          size="small"
          scroll={{ x: "max-content" }}
          columns={allColumns}
          dataSource={data}
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
      {createItem && createForm && (
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create {title}</DialogTitle>
            </DialogHeader>
            {createForm}
          </DialogContent>
        </Dialog>
      )}

      {/* Edit Dialog */}
      {updateItem && editItem && (
        <Dialog open={showEdit} onOpenChange={setShowEdit}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit {title}</DialogTitle>
            </DialogHeader>
            {createForm && (
              <div>
                {/* Reuse create form with edit data */}
                {createForm}
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}
    </Card>
  );
}
