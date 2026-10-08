import { useState, useEffect, useMemo, useCallback } from "react";
import { Icon } from "@/components/icon";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/ui/dialog";
import Table, { type ColumnsType } from "antd/es/table";
import { HealthcareApi } from "@/api/services/healthcareService";

export interface AdvancedSearchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  doctype?: string;
  items?: any[];
  fetchItems?: (query: string) => Promise<any[]>;
  onSelect: (value: any, rawRecord?: any) => void;
  onCreateNew?: () => void;
  title?: string;
}

/**
 * Marley-style Link Selector / Advanced Search Modal.
 * Offers live multi-column searching, pagination, double-click select,
 * and integrated "+ Create a new {DocType}" action.
 */
export default function AdvancedSearchModal({
  open,
  onOpenChange,
  doctype = "Item",
  items,
  fetchItems,
  onSelect,
  onCreateNew,
  title,
}: AdvancedSearchModalProps) {
  const [search, setSearch] = useState("");
  const [data, setData] = useState<any[]>(items || []);
  const [loading, setLoading] = useState(false);
  const [selectedRow, setSelectedRow] = useState<any | null>(null);

  const normalizedDoctype = (doctype || "").trim().toLowerCase();

  // Load or fetch items when modal opens
  const loadData = useCallback(
    async (query = "") => {
      // If external fetcher provided, use it
      if (fetchItems) {
        setLoading(true);
        try {
          const res = await fetchItems(query);
          setData(res || []);
        } catch (err) {
          console.error("Advanced search fetch error:", err);
        } finally {
          setLoading(false);
        }
        return;
      }

      // If items passed as static array and no query or client-side filtering wanted
      if (items && items.length > 0) {
        if (!query.trim()) {
          setData(items);
        } else {
          const q = query.toLowerCase();
          const filtered = items.filter((item) => {
            if (typeof item === "string") return item.toLowerCase().includes(q);
            return Object.values(item).some(
              (v) => typeof v === "string" && v.toLowerCase().includes(q)
            );
          });
          setData(filtered);
        }
        return;
      }

      // Fallback: Fetch directly from HealthcareApi or ItemApi based on doctype
      setLoading(true);
      try {
        const params: Record<string, any> = { page_size: 100 };
        if (query) params.search = query;

        let results: any[] = [];
        if (normalizedDoctype === "lab test uom" || normalizedDoctype === "uom") {
          const res = await HealthcareApi.labTestUOMs.list(params);
          results = res.results || [];
        } else if (normalizedDoctype === "item" || normalizedDoctype === "stock item" || normalizedDoctype === "drug code" || normalizedDoctype === "medication") {
          const res = await HealthcareApi.medications.list(params);
          results = (res.results || []).map((m: any) => ({
            ...m,
            item_code: m.medication_name || m.drug_code,
            item_name: m.medication_name,
          }));
        } else if (normalizedDoctype === "patient") {
          const res = await HealthcareApi.patients.list(params);
          results = res.results || [];
        } else if (
          normalizedDoctype === "healthcare practitioner" ||
          normalizedDoctype === "practitioner"
        ) {
          const res = await HealthcareApi.practitioners.list(params);
          results = res.results || [];
        } else if (
          normalizedDoctype === "medical department" ||
          normalizedDoctype === "department"
        ) {
          const res = await HealthcareApi.departments.list(params);
          results = res.results || [];
        } else if (normalizedDoctype === "lab test template") {
          const res = await HealthcareApi.labTestTemplates.list(params);
          results = res.results || [];
        } else if (normalizedDoctype === "dosage form") {
          const res = await HealthcareApi.dosageForms.list(params);
          results = res.results || [];
        } else if (
          normalizedDoctype === "prescription dosage" ||
          normalizedDoctype === "dosage"
        ) {
          const res = (HealthcareApi as any).prescriptionDosages?.list
            ? await (HealthcareApi as any).prescriptionDosages.list(params)
            : { results: [] };
          results = res.results || [];
        } else if (
          normalizedDoctype === "prescription duration" ||
          normalizedDoctype === "duration" ||
          normalizedDoctype === "period"
        ) {
          const res = await HealthcareApi.prescriptionDurations.list(params);
          results = res.results || [];
        } else if (normalizedDoctype === "lab test sample") {
          const res = await HealthcareApi.labTestSamples.list(params);
          results = res.results || [];
        } else if (normalizedDoctype === "sample type") {
          const res = await HealthcareApi.sampleTypes.list();
          results = (res as any)?.results || res || [];
        } else if (normalizedDoctype === "appointment type") {
          const res = await HealthcareApi.appointmentTypes.list(params);
          results = res.results || [];
        } else if (normalizedDoctype === "therapy type") {
          const res = await HealthcareApi.therapyTypes.list(params);
          results = res.results || [];
        } else if (normalizedDoctype === "medication") {
          const res = await HealthcareApi.medications.list(params);
          results = res.results || [];
        } else if (normalizedDoctype === "observation") {
          const res = await HealthcareApi.observations.list(params);
          results = res.results || [];
        } else if (normalizedDoctype === "clinical procedure template") {
          const res = await HealthcareApi.procedureTemplates.list(params);
          results = res.results || [];
        } else if (normalizedDoctype === "antibiotic") {
          const res = await HealthcareApi.antibiotics.list(params);
          results = res.results || [];
        } else if (normalizedDoctype === "sensitivity") {
          const res = await HealthcareApi.sensitivities.list(params);
          results = res.results || [];
        } else if (normalizedDoctype === "organism") {
          const res = await HealthcareApi.organisms.list(params);
          results = res.results || [];
        } else if (
          normalizedDoctype === "healthcare service unit" ||
          normalizedDoctype === "service unit"
        ) {
          const res = await HealthcareApi.serviceUnits.list(params);
          results = res.results || [];
        } else {
          // If we have items prop, fall back to it
          results = items || [];
        }

        setData(results);
      } catch (err) {
        console.error("Advanced search api error:", err);
      } finally {
        setLoading(false);
      }
    },
    [fetchItems, items, normalizedDoctype]
  );

  useEffect(() => {
    if (open) {
      setSearch("");
      setSelectedRow(null);
      loadData("");
    }
  }, [open, loadData]);

  // Client-side instant filter on existing data if query typed
  const filteredData = useMemo(() => {
    if (!search.trim()) return data;
    const q = search.toLowerCase();
    return data.filter((item) => {
      if (typeof item === "string") return item.toLowerCase().includes(q);
      return Object.values(item).some(
        (v) =>
          (typeof v === "string" || typeof v === "number") &&
          String(v).toLowerCase().includes(q)
      );
    });
  }, [data, search]);

  const handleSelect = (record: any) => {
    if (!record) return;
    // Extract the primary value for the form field
    let value: any = record;
    if (typeof record === "object") {
      if (normalizedDoctype === "lab test uom" || normalizedDoctype === "uom") {
        value = record.lab_test_uom || record.name;
      } else if (
        normalizedDoctype === "item" ||
        normalizedDoctype === "stock item" ||
        normalizedDoctype === "drug code"
      ) {
        value = record.item_code || record.name;
      } else if (
        normalizedDoctype === "medical department" ||
        normalizedDoctype === "department"
      ) {
        value = record.department || record.name;
      } else if (normalizedDoctype === "dosage form") {
        value = record.dosage_form || record.name;
      } else if (
        normalizedDoctype === "prescription dosage" ||
        normalizedDoctype === "dosage"
      ) {
        value = record.dosage || record.name;
      } else if (
        normalizedDoctype === "prescription duration" ||
        normalizedDoctype === "duration" ||
        normalizedDoctype === "period"
      ) {
        value = record.number ? `${record.number} ${record.period}(s)` : record.duration || record.name;
      } else if (normalizedDoctype === "lab test sample") {
        value = record.sample_name || record.name;
      } else if (normalizedDoctype === "sample type") {
        value = record.sample_type || record.name;
      } else if (normalizedDoctype === "appointment type") {
        value = record.id ?? record.appointment_type ?? record.name;
      } else if (normalizedDoctype === "therapy type") {
        value = record.therapy_type || record.name;
      } else if (normalizedDoctype === "lab test template") {
        value = record.lab_test_name || record.name;
      } else if (normalizedDoctype === "medication") {
        value = record.generic_name || record.name;
      } else if (
        normalizedDoctype === "patient" ||
        normalizedDoctype === "healthcare practitioner" ||
        normalizedDoctype === "practitioner"
      ) {
        value = record.id ?? record.patient_id ?? record.practitioner_id;
      } else if (record.value !== undefined) {
        value = record.value;
      } else if (record.label !== undefined) {
        value = record.label;
      } else {
        value = record.name || record.id || record;
      }
    }

    onSelect(value, record);
    onOpenChange(false);
  };

  // Define column layout per doctype
  const columns: ColumnsType<any> = useMemo(() => {
    // Strings array
    if (data.length > 0 && typeof data[0] === "string") {
      return [
        {
          title: doctype,
          dataIndex: "",
          key: "value",
          render: (val: string) => <span className="font-medium text-foreground">{val}</span>,
        },
      ];
    }

    // EntityOption format { value, label, sublabel }
    if (data.length > 0 && data[0]?.label !== undefined && data[0]?.value !== undefined && data[0]?.first_name === undefined) {
      return [
        {
          title: "Name / Label",
          dataIndex: "label",
          key: "label",
          render: (v: string) => <span className="font-medium text-foreground">{v}</span>,
        },
        {
          title: "Details",
          dataIndex: "sublabel",
          key: "sublabel",
          render: (v: string) => <span className="text-muted-foreground text-xs">{v || "—"}</span>,
        },
      ];
    }

    if (normalizedDoctype === "lab test uom" || normalizedDoctype === "uom") {
      return [
        {
          title: "UOM",
          dataIndex: "lab_test_uom",
          key: "lab_test_uom",
          width: 220,
          render: (v: string) => <span className="font-semibold text-primary">{v}</span>,
        },
        {
          title: "Description",
          dataIndex: "uom_description",
          key: "uom_description",
          render: (v: string) => <span className="text-muted-foreground">{v || "—"}</span>,
        },
      ];
    }

    if (
      normalizedDoctype === "item" ||
      normalizedDoctype === "stock item" ||
      normalizedDoctype === "drug code"
    ) {
      return [
        {
          title: "Item Code",
          dataIndex: "item_code",
          key: "item_code",
          width: 180,
          render: (v: string) => <span className="font-semibold text-primary">{v}</span>,
        },
        {
          title: "Item Name",
          dataIndex: "item_name",
          key: "item_name",
          render: (v: string) => <span className="font-medium text-foreground">{v}</span>,
        },
        {
          title: "Item Group",
          dataIndex: "item_group",
          key: "item_group",
          width: 160,
          render: (v: string) => <span className="text-muted-foreground text-xs">{v || "—"}</span>,
        },
      ];
    }

    if (normalizedDoctype === "patient") {
      return [
        {
          title: "Patient ID",
          dataIndex: "patient_id",
          key: "patient_id",
          width: 140,
          render: (v: string) => <span className="font-mono text-xs font-semibold text-primary">{v}</span>,
        },
        {
          title: "Patient Name",
          dataIndex: "patient_name",
          key: "patient_name",
          render: (v: string, r: any) => (
            <span className="font-medium text-foreground">
              {v || `${r.first_name || ""} ${r.last_name || ""}`.trim() || "—"}
            </span>
          ),
        },
        {
          title: "Gender",
          dataIndex: "sex",
          key: "sex",
          width: 90,
          render: (v: string) => <span className="text-muted-foreground text-xs">{v || "—"}</span>,
        },
        {
          title: "Mobile",
          dataIndex: "mobile",
          key: "mobile",
          width: 140,
          render: (v: string) => <span className="text-muted-foreground text-xs">{v || "—"}</span>,
        },
        {
          title: "Age",
          dataIndex: "age",
          key: "age",
          width: 80,
          render: (v: any) => <span className="text-muted-foreground text-xs">{v ? `${v}y` : "—"}</span>,
        },
      ];
    }

    if (
      normalizedDoctype === "healthcare practitioner" ||
      normalizedDoctype === "practitioner"
    ) {
      return [
        {
          title: "Practitioner ID",
          dataIndex: "practitioner_id",
          key: "practitioner_id",
          width: 150,
          render: (v: string) => <span className="font-mono text-xs font-semibold text-primary">{v}</span>,
        },
        {
          title: "Practitioner Name",
          dataIndex: "practitioner_name",
          key: "practitioner_name",
          render: (v: string, r: any) => (
            <span className="font-medium text-foreground">
              {v || `${r.first_name || ""} ${r.last_name || ""}`.trim() || "—"}
            </span>
          ),
        },
        {
          title: "Department",
          dataIndex: "department_name",
          key: "department_name",
          render: (v: string) => <span className="text-muted-foreground text-xs">{v || "—"}</span>,
        },
        {
          title: "Mobile",
          dataIndex: "mobile_phone",
          key: "mobile_phone",
          width: 140,
          render: (v: string) => <span className="text-muted-foreground text-xs">{v || "—"}</span>,
        },
      ];
    }

    if (
      normalizedDoctype === "medical department" ||
      normalizedDoctype === "department"
    ) {
      return [
        {
          title: "Department",
          dataIndex: "department",
          key: "department",
          render: (v: string) => <span className="font-semibold text-primary">{v}</span>,
        },
        {
          title: "Patient Care Type",
          dataIndex: "patient_care_type",
          key: "patient_care_type",
          width: 180,
          render: (v: string) => <span className="text-muted-foreground text-xs">{v || "Both"}</span>,
        },
      ];
    }

    if (normalizedDoctype === "lab test template") {
      return [
        {
          title: "Template Name",
          dataIndex: "lab_test_name",
          key: "lab_test_name",
          render: (v: string) => <span className="font-semibold text-primary">{v}</span>,
        },
        {
          title: "Code",
          dataIndex: "lab_test_code",
          key: "lab_test_code",
          width: 140,
          render: (v: string) => <span className="font-mono text-xs text-muted-foreground">{v || "—"}</span>,
        },
        {
          title: "Department",
          dataIndex: "department_name",
          key: "department_name",
          render: (v: string) => <span className="text-muted-foreground text-xs">{v || "—"}</span>,
        },
      ];
    }

    if (normalizedDoctype === "dosage form") {
      return [
        {
          title: "Dosage Form",
          dataIndex: "dosage_form",
          key: "dosage_form",
          render: (v: string) => <span className="font-semibold text-primary">{v}</span>,
        },
        {
          title: "Description",
          dataIndex: "description",
          key: "description",
          render: (v: string) => <span className="text-muted-foreground">{v || "—"}</span>,
        },
      ];
    }

    if (
      normalizedDoctype === "prescription dosage" ||
      normalizedDoctype === "dosage"
    ) {
      return [
        {
          title: "Dosage",
          dataIndex: "dosage",
          key: "dosage",
          width: 180,
          render: (v: string) => <span className="font-semibold text-primary">{v}</span>,
        },
        {
          title: "Description",
          dataIndex: "description",
          key: "description",
          render: (v: string) => <span className="text-muted-foreground">{v || "—"}</span>,
        },
      ];
    }

    if (
      normalizedDoctype === "prescription duration" ||
      normalizedDoctype === "duration" ||
      normalizedDoctype === "period"
    ) {
      return [
        {
          title: "Duration",
          dataIndex: "number",
          key: "number",
          render: (_: any, r: any) => (
            <span className="font-semibold text-primary">
              {r.number ? `${r.number} ${r.period}(s)` : r.duration || r.period || "—"}
            </span>
          ),
        },
      ];
    }

    if (normalizedDoctype === "appointment type") {
      return [
        {
          title: "Appointment Type",
          dataIndex: "appointment_type",
          key: "appointment_type",
          render: (v: string) => <span className="font-semibold text-primary">{v}</span>,
        },
        {
          title: "Default Duration",
          dataIndex: "default_duration",
          key: "default_duration",
          width: 160,
          render: (v: number) => <span className="text-muted-foreground text-xs">{v ? `${v} min` : "30 min"}</span>,
        },
      ];
    }

    if (normalizedDoctype === "antibiotic") {
      return [
        {
          title: "Antibiotic Name",
          dataIndex: "antibiotic_name",
          key: "antibiotic_name",
          render: (v: string) => <span className="font-semibold text-primary">{v}</span>,
        },
      ];
    }

    if (normalizedDoctype === "sensitivity") {
      return [
        {
          title: "Sensitivity",
          dataIndex: "sensitivity",
          key: "sensitivity",
          render: (v: string) => <span className="font-semibold text-primary">{v}</span>,
        },
      ];
    }

    if (normalizedDoctype === "organism") {
      return [
        {
          title: "Organism",
          dataIndex: "organism",
          key: "organism",
          render: (v: string) => <span className="font-semibold text-primary">{v}</span>,
        },
      ];
    }

    if (
      normalizedDoctype === "healthcare service unit" ||
      normalizedDoctype === "service unit"
    ) {
      return [
        {
          title: "Service Unit Name",
          dataIndex: "service_unit_name",
          key: "service_unit_name",
          render: (v: string) => <span className="font-semibold text-primary">{v}</span>,
        },
        {
          title: "Service Unit Type",
          dataIndex: "service_unit_type_name",
          key: "service_unit_type_name",
          render: (v: string) => <span className="text-muted-foreground text-xs">{v || "—"}</span>,
        },
      ];
    }

    // Generic fallback: render first 2-3 fields
    const first = data[0] || {};
    const keys = Object.keys(first).filter((k) => !k.startsWith("_") && k !== "created_at" && k !== "updated_at");
    const nameKey = keys.find((k) => k.includes("name") || k.includes("type") || k.includes("code") || k === "title") || keys[0] || "name";
    const descKey = keys.find((k) => k.includes("desc") || k.includes("details") || k.includes("comment") || k.includes("status")) || keys[1];

    return [
      {
        title: nameKey.replace(/_/g, " ").toUpperCase(),
        dataIndex: nameKey,
        key: nameKey,
        render: (v: any) => <span className="font-semibold text-primary">{String(v ?? "—")}</span>,
      },
      ...(descKey
        ? [
            {
              title: descKey.replace(/_/g, " ").toUpperCase(),
              dataIndex: descKey,
              key: descKey,
              render: (v: any) => <span className="text-muted-foreground text-xs">{String(v ?? "—")}</span>,
            },
          ]
        : []),
    ];
  }, [data, doctype, normalizedDoctype]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-6">
        <DialogHeader className="flex flex-row items-center justify-between pb-2 border-b">
          <div>
            <DialogTitle className="text-lg font-semibold flex items-center gap-2">
              <Icon icon="solar:magnifer-linear" size={20} className="text-primary" />
              {title || `Select ${doctype}`}
            </DialogTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Click a row to select or double-click to confirm immediately.
            </p>
          </div>
          {onCreateNew && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                onOpenChange(false);
                onCreateNew();
              }}
              className="text-emerald-600 border-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 gap-1.5"
            >
              <Icon icon="solar:add-circle-bold" size={16} />
              Create a new {doctype}
            </Button>
          )}
        </DialogHeader>

        {/* Search Input bar */}
        <div className="relative my-3">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                loadData(search);
              }
            }}
            placeholder={`Search ${doctype}...`}
            className="pl-9 pr-8 h-9 text-sm"
            autoFocus
          />
          <Icon
            icon="solar:magnifer-linear"
            size={16}
            className="absolute left-3 top-2.5 text-muted-foreground"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
            >
              <Icon icon="solar:close-circle-bold" size={16} />
            </button>
          )}
        </div>

        {/* Results Table */}
        <div className="flex-1 overflow-auto border rounded-md">
          <Table
            columns={columns}
            dataSource={filteredData}
            rowKey={(record, idx) => (record?.id ?? record?.value ?? record?.lab_test_uom ?? record?.item_code ?? record?.department ?? idx)}
            loading={loading}
            pagination={{
              pageSize: 8,
              size: "small",
              showTotal: (total) => `${total} results`,
            }}
            size="small"
            onRow={(record) => ({
              onClick: () => setSelectedRow(record),
              onDoubleClick: () => handleSelect(record),
              className: `cursor-pointer transition-colors ${
                selectedRow === record ? "bg-accent/60" : "hover:bg-muted/40"
              }`,
            })}
          />
        </div>

        <DialogFooter className="flex items-center justify-between pt-3 border-t mt-3">
          <div className="text-xs text-muted-foreground">
            {filteredData.length} {filteredData.length === 1 ? "result" : "results"} found
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={!selectedRow}
              onClick={() => handleSelect(selectedRow)}
              className="gap-1.5"
            >
              <Icon icon="solar:check-circle-bold" size={16} />
              Select
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
