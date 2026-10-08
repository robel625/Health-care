import { useState, useEffect, useCallback } from "react";
import { Icon } from "@/components/icon";
import { Button } from "@/ui/button";
import { Card, CardContent } from "@/ui/card";
import { Label } from "@/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/ui/dialog";
import Table, { type ColumnsType } from "antd/es/table";
import { HealthcareApi } from "@/api/services/healthcareService";
import EntitySelect from "@/components/healthcare/EntitySelect";
import { useDoctypePermissions } from "@/utils/permissions";
import type {
  LabTest,
  Patient,
  PatientEncounter,
  LabPrescription,
} from "@/api/services/healthcareService";
import { useNavigate, useSearchParams } from "react-router";
import LabNavHeader from "./components/LabNavHeader";

/**
 * Lab Tests — Marley's `Lab Test` list view.
 *
 * `lab_test_list.js` in Marley: the `get_indicator` colours (Approved/
 * Completed green, Rejected orange, Cancelled red), the default
 * `docstatus = 1` filter — here `status` over the four submitted statuses,
 * since this stack carries docstatus in `status` — and the "Create Multiple"
 * menu action with its dialog. Row click opens the form, as a list row does
 * in Frappe.
 *
 * Deviations: "Create Multiple" offers a Patient Encounter only, because this
 * stack's Sales Invoice has no Patient link; and the status select is added
 * so Drafts stay reachable the way `docstatus = 0` is in Marley.
 */
const statusBadge: Record<string, string> = {
  Draft: "bg-gray-100 text-gray-600",
  Completed: "bg-green-100 text-green-700",
  Approved: "bg-green-100 text-green-700",
  Rejected: "bg-orange-100 text-orange-700",
  Cancelled: "bg-red-100 text-red-700",
};

const specimenStatusBadge: Record<string, { bg: string; text: string }> = {
  "Pending Collection": { bg: "bg-amber-100 text-amber-800 border border-amber-300", text: "Pending Collection" },
  Collected: { bg: "bg-sky-100 text-sky-800 border border-sky-300", text: "Sample Collected" },
  Received: { bg: "bg-emerald-100 text-emerald-800 border border-emerald-300", text: "Specimen Received" },
  Rejected: { bg: "bg-rose-100 text-rose-800 border border-rose-300", text: "Specimen Rejected" },
  "Not Required": { bg: "bg-gray-100 text-gray-600 border border-gray-200", text: "Not Required" },
};

/** Marley's list filters `docstatus = 1` — everything but Draft. */
const SUBMITTED_STATUSES = "Completed,Approved,Rejected,Cancelled";

export default function LabTestsPage() {
  const { canCreate, canDelete } = useDoctypePermissions("Lab Test");
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const patientFilter = searchParams.get("patient");
  const practitionerFilter = searchParams.get("practitioner");
  const [data, setData] = useState<LabTest[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("all");
  const [banner, setBanner] = useState<{ type: "ok" | "err"; msg: string } | null>(null);

  // Create Multiple dialog
  const [showCreateMultiple, setShowCreateMultiple] = useState(false);
  const [cmPatient, setCmPatient] = useState<number | null>(null);
  const [cmEncounter, setCmEncounter] = useState<number | null>(null);
  const [cmEncounters, setCmEncounters] = useState<PatientEncounter[]>([]);
  const [cmCreating, setCmCreating] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const filterParams: Record<string, any> = { page };
      if (statusFilter === "submitted") {
        filterParams.status__in = SUBMITTED_STATUSES;
      } else if (statusFilter !== "all") {
        filterParams.status = statusFilter;
      }
      if (patientFilter) filterParams.patient = patientFilter;
      if (practitionerFilter) filterParams.practitioner = practitionerFilter;
      const res = await HealthcareApi.labTests.list(filterParams);
      setData(res.results || []);
      setTotal(res.count || 0);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, patientFilter, practitionerFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    HealthcareApi.patients
      .list({ page_size: 200 })
      .then((pats) => setPatients(pats.results || []))
      .catch(() => {});
  }, []);

  const showBanner = (type: "ok" | "err", msg: string) => {
    setBanner({ type, msg });
    window.setTimeout(() => setBanner(null), 6000);
  };

  const handleDelete = async (id: number) => {
    if (confirm("Delete?")) {
      try {
        await HealthcareApi.labTests.delete(id);
        loadData();
      } catch (err: any) {
        showBanner(
          "err",
          err?.response?.data?.detail || "Failed to delete the Lab Test"
        );
      }
    }
  };

  // Encounters of the chosen patient that still prescribe Lab Tests.
  const changeCmPatient = async (pid: number | null) => {
    setCmPatient(pid);
    setCmEncounter(null);
    setCmEncounters([]);
    if (!pid) return;
    try {
      const encs: any = await HealthcareApi.encounters.list({
        patient: pid,
        page_size: 100,
      });
      setCmEncounters(
        (encs.results || []).filter((e: PatientEncounter) =>
          (e.lab_prescription_items || []).some(
            (rx: LabPrescription) => !rx.lab_test_created && rx.lab_test_code
          )
        )
      );
    } catch {
      setCmEncounters([]);
    }
  };

  const handleCreateMultiple = async () => {
    if (!cmPatient || !cmEncounter) return;
    setCmCreating(true);
    try {
      const res: any = await HealthcareApi.labTests.createMultiple({
        patient: cmPatient,
        doctype: "Patient Encounter",
        docname: cmEncounter,
      });
      if (res?.created?.length) {
        showBanner("ok", `Lab Test(s) ${res.created.join(", ")} created successfully`);
      } else {
        showBanner("err", "No Lab Tests created");
      }
      setShowCreateMultiple(false);
      setCmPatient(null);
      setCmEncounter(null);
      loadData();
    } catch (err: any) {
      const d = err?.response?.data;
      showBanner(
        "err",
        typeof d === "string" ? d : d?.detail || "Failed to create Lab Tests"
      );
    } finally {
      setCmCreating(false);
    }
  };

  const columns: ColumnsType<LabTest> = [
    {
      title: "Lab Test",
      dataIndex: "test_id",
      width: 170,
      render: (v: string, r) => (
        <div>
          <div className="font-medium">{v}</div>
          <div className="text-xs text-muted-foreground">{r.patient_name}</div>
        </div>
      ),
    },
    { title: "Test Name", dataIndex: "lab_test_name", width: 200, ellipsis: true },
    {
      title: "Requesting Practitioner",
      dataIndex: "practitioner_name",
      width: 180,
      ellipsis: true,
    },
    { title: "Date", dataIndex: "date", width: 110 },
    {
      title: "Time",
      dataIndex: "time",
      width: 100,
      render: (v: string, r: LabTest) => {
        if (v) return v.slice(0, 5);
        if ((r as any).creation) {
          try {
            return new Date((r as any).creation).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            });
          } catch {
            return "—";
          }
        }
        return "—";
      },
    },
    {
      title: "Invoiced",
      dataIndex: "invoiced",
      width: 90,
      render: (v: boolean) => (v ? "Yes" : "No"),
    },
    {
      title: "Status",
      dataIndex: "status",
      width: 110,
      render: (v: string) => (
        <span className={`text-xs px-2 py-1 rounded-full ${statusBadge[v] || ""}`}>
          {v}
        </span>
      ),
    },
    {
      title: "Specimen Chain",
      dataIndex: "specimen_status",
      width: 160,
      render: (v: string, r: LabTest) => {
        const specStatus = v || "Pending Collection";
        const meta = specimenStatusBadge[specStatus] || { bg: "bg-gray-100 text-gray-700", text: specStatus };
        return (
          <div className="space-y-0.5">
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full inline-block ${meta.bg}`}>
              {meta.text}
            </span>
            {r.specimen_barcode && (
              <p className="text-[10px] font-mono text-muted-foreground">
                {r.specimen_barcode}
              </p>
            )}
          </div>
        );
      },
    },
    {
      title: "",
      width: 80,
      render: (_, r) => (
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/healthcare/lab-tests/${r.id}`);
            }}
          >
            <Icon icon="solar:pen-bold" size={16} />
          </Button>
          {canDelete && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(r.id);
              }}
            >
              <Icon icon="solar:trash-bin-trash-bold" size={16} className="text-red-500" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <LabNavHeader
        title="Lab Tests & Clinical Worklist"
        subtitle="Review clinical orders, physical sample collections, enter patient observations, and submit results for supervisory approval."
      />
      {banner && (
        <div
          className={`px-4 py-2 rounded-md text-sm text-white cursor-pointer ${
            banner.type === "ok" ? "bg-green-600" : "bg-red-600"
          }`}
          onClick={() => setBanner(null)}
        >
          {banner.msg}
        </div>
      )}
      {(patientFilter || practitionerFilter) && (
        <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-700">
          <Icon icon="solar:filter-bold" size={16} />
          <span>
            Filtered by:{" "}
            {patientFilter ? `Patient #${patientFilter}` : `Practitioner #${practitionerFilter}`}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto text-blue-700"
            onClick={() => navigate("/healthcare/lab-tests")}
          >
            Clear Filter
          </Button>
        </div>
      )}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Lab Tests</h1>
          <p className="text-muted-foreground">{total} lab tests</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="border rounded-md px-3 py-2 text-sm bg-background"
            value={statusFilter}
            onChange={(e) => {
              setPage(1);
              setStatusFilter(e.target.value);
            }}
            title="Status"
          >
            <option value="all">All</option>
            <option value="submitted">Submitted</option>
            <option value="Draft">Draft</option>
            <option value="Completed">Completed</option>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
            <option value="Cancelled">Cancelled</option>
          </select>
          <Button
            variant="outline"
            onClick={() => {
              setCmPatient(patientFilter ? Number(patientFilter) : null);
              setCmEncounter(null);
              setCmEncounters([]);
              setShowCreateMultiple(true);
              if (patientFilter) changeCmPatient(Number(patientFilter));
            }}
          >
            <Icon icon="solar:widget-add-bold" size={16} className="mr-2" />
            Create Multiple
          </Button>
          {canCreate && (
            <Button
              onClick={() => {
                const params = new URLSearchParams();
                if (patientFilter) params.set("patient", patientFilter);
                if (practitionerFilter) params.set("practitioner", practitionerFilter);
                const qs = params.toString();
                navigate(`/healthcare/lab-tests/new${qs ? `?${qs}` : ""}`);
              }}
              className="bg-cyan-600 hover:bg-cyan-700"
            >
              <Icon icon="solar:test-tube-add-bold-duotone" size={18} className="mr-2" />
              New Lab Test
            </Button>
          )}
        </div>
      </div>
      <Card>
        <CardContent className="pt-6">
          <Table
            columns={columns}
            dataSource={data}
            rowKey="id"
            loading={loading}
            onRow={(record) => ({
              onClick: () => navigate(`/healthcare/lab-tests/${record.id}`),
              style: { cursor: "pointer" },
            })}
            pagination={{
              current: page,
              total,
              pageSize: 20,
              onChange: setPage,
            }}
          />
        </CardContent>
      </Card>

      {/* Create Multiple — Marley's list menu action and dialog */}
      <Dialog open={showCreateMultiple} onOpenChange={setShowCreateMultiple}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Multiple Lab Tests</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-4 py-4">
            <div>
              <Label>Patient *</Label>
              <div className="mt-1.5">
                <EntitySelect
                  doctype="Patient"
                  rawItems={patients}
                  options={patients.map((p) => ({
                    value: p.id,
                    label:
                      p.patient_name ||
                      `${p.first_name || ""} ${p.last_name || ""}`.trim(),
                    sublabel: p.patient_id,
                    image: p.image,
                  }))}
                  value={cmPatient}
                  onChange={(v) => changeCmPatient(v)}
                  onOptionAdded={(_opt, raw) => {
                    if (raw) setPatients((prev) => [...prev, raw]);
                  }}
                  placeholder="Select Patient"
                  emptyText="No patients found"
                />
              </div>
            </div>
            <div>
              <Label>Patient Encounter *</Label>
              <select
                className="mt-1.5 w-full border rounded-md px-3 py-2 text-sm bg-background"
                value={cmEncounter ?? ""}
                disabled={!cmPatient}
                onChange={(e) =>
                  setCmEncounter(e.target.value ? Number(e.target.value) : null)
                }
              >
                <option value="">
                  {cmPatient ? "Select Encounter" : "Select Patient first"}
                </option>
                {cmEncounters.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.encounter_id} · {e.encounter_date} · {e.practitioner_name}
                  </option>
                ))}
              </select>
              {cmPatient && cmEncounters.length === 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  No encounter with pending Lab Test prescriptions.
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-2">
                Marley also offers a Sales Invoice as the source; this app's
                Sales Invoice carries no Patient, so only an Encounter can be
                used here.
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowCreateMultiple(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateMultiple}
              disabled={!cmPatient || !cmEncounter || cmCreating}
              className="bg-cyan-600 hover:bg-cyan-700"
            >
              {cmCreating ? "Creating Lab Tests..." : "Create"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
