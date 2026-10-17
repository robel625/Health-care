import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { Icon } from "@/components/icon";
import { Button } from "@/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/ui/card";
import { Input } from "@/ui/input";
import {
  HealthcareApi,
  type SampleCollection,
  type Patient,
  type LabTestSample,
  type HealthcarePractitioner,
  type HealthcareServiceUnit,
  type LabTest,
} from "@/api/services/healthcareService";
import { toast } from "sonner";

const statusColor: Record<string, string> = {
  Pending: "bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-950 dark:text-yellow-300",
  "Partly Collected": "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950 dark:text-blue-300",
  Collected: "bg-green-100 text-green-800 border-green-300 dark:bg-green-950 dark:text-green-300",
  Cancelled: "bg-red-100 text-red-800 border-red-300 dark:bg-red-950 dark:text-red-300",
};

const TUBE_COLOR_MAP: Record<string, { bg: string; border: string; desc: string }> = {
  lavender: { bg: "#9370DB", border: "#7B68EE", desc: "EDTA (Hematology / CBC)" },
  purple: { bg: "#8A2BE2", border: "#7B68EE", desc: "EDTA (Hematology / CBC)" },
  gold: { bg: "#FFD700", border: "#DAA520", desc: "SST / Gel Separator (Biochem)" },
  yellow: { bg: "#FFEE58", border: "#FDD835", desc: "SST / ACD (HLA/Genetics)" },
  "light blue": { bg: "#38BDF8", border: "#0284C7", desc: "Sodium Citrate (Coagulation)" },
  blue: { bg: "#0284C7", border: "#0369A1", desc: "Sodium Citrate (Coagulation)" },
  red: { bg: "#EF4444", border: "#DC2626", desc: "Plain / Clot Activator (Serology)" },
  green: { bg: "#10B981", border: "#059669", desc: "Sodium / Lithium Heparin" },
  gray: { bg: "#9CA3AF", border: "#6B7280", desc: "Sodium Fluoride / Oxalate (Glucose)" },
  grey: { bg: "#9CA3AF", border: "#6B7280", desc: "Sodium Fluoride / Oxalate (Glucose)" },
  pink: { bg: "#F472B6", border: "#DB2777", desc: "K2 EDTA (Blood Bank / Crossmatch)" },
  "royal blue": { bg: "#2563EB", border: "#1D4ED8", desc: "K2 EDTA (Trace Elements)" },
};

function getCapColor(colorName?: string) {
  if (!colorName) return { bg: "#94A3B8", border: "#64748B", desc: "Standard Tube" };
  const key = colorName.trim().toLowerCase();
  return TUBE_COLOR_MAP[key] || { bg: colorName, border: "#64748B", desc: colorName };
}

function calculateMarleyAge(dobString?: string, ageNum?: number | null): string {
  if (!dobString) {
    return ageNum ? `${ageNum} Year(s)` : "";
  }
  const birth = new Date(dobString);
  if (isNaN(birth.getTime())) {
    return ageNum ? `${ageNum} Year(s)` : "";
  }
  const today = new Date();
  let years = today.getFullYear() - birth.getFullYear();
  let months = today.getMonth() - birth.getMonth();
  let days = today.getDate() - birth.getDate();

  if (days < 0) {
    months -= 1;
    const prevMonthDays = new Date(today.getFullYear(), today.getMonth(), 0).getDate();
    days += prevMonthDays;
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  return `${years} Year(s)`;
}

function errMessage(e: any, fallback: string): string {
  const d = e?.response?.data ?? e?.data ?? e;
  if (typeof d === "string" && d) return d;
  if (d?.detail) return String(d.detail);
  if (d && typeof d === "object") {
    const first = Object.entries(d)[0];
    if (first) {
      return Array.isArray(first[1])
        ? `${first[0]}: ${first[1][0]}`
        : `${first[0]}: ${String(first[1])}`;
    }
  }
  return fallback;
}

export default function SampleCollectionDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const isNew = !id || id === "new" || id === "undefined" || id === "NaN";

  const fromSource = searchParams.get("from");
  const labTestIdParam = searchParams.get("lab_test");
  const patientIdParam = searchParams.get("patient");
  const patientNameParam = searchParams.get("patient_name");
  const patientAgeParam = searchParams.get("patient_age");
  const patientSexParam = searchParams.get("patient_sex");
  const practitionerParam = searchParams.get("practitioner");
  const serviceUnitParam = searchParams.get("service_unit");
  const labTestNameParam = searchParams.get("lab_test_name");
  const sampleNameParam = searchParams.get("sample_name");
  const sampleUomParam = searchParams.get("sample_uom");
  const sampleQtyParam = searchParams.get("sample_qty");
  const colorParam = searchParams.get("color");
  const siteParam = searchParams.get("site");
  const barcodeParam = searchParams.get("barcode");
  const detailsParam = searchParams.get("details");

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [linkedLabTest, setLinkedLabTest] = useState<LabTest | null>(null);

  // Masters
  const [patients, setPatients] = useState<Patient[]>([]);
  const [samples, setSamples] = useState<LabTestSample[]>([]);
  const [practitioners, setPractitioners] = useState<HealthcarePractitioner[]>([]);
  const [serviceUnits, setServiceUnits] = useState<HealthcareServiceUnit[]>([]);

  // Form State initialized with URL search parameters immediately
  const [formData, setFormData] = useState<Partial<SampleCollection>>({
    naming_series: "HLC-SC-.YYYY.-",
    patient: patientIdParam ? Number(patientIdParam) : 0,
    patient_name: patientNameParam || "",
    patient_age: patientAgeParam || "",
    patient_sex: patientSexParam || "",
    company: "EEU (Demo)",
    status: "Pending",
    invoiced: false,
    sample: undefined,
    sample_name: sampleNameParam || "",
    sample_qty: sampleQtyParam ? Number(sampleQtyParam) : 1,
    sample_uom: sampleUomParam || "ml",
    container_closure_color: colorParam || "Lavender",
    collection_point: serviceUnitParam ? Number(serviceUnitParam) : null,
    referring_practitioner: practitionerParam ? Number(practitionerParam) : null,
    appointment: null,
    lab_test: labTestIdParam ? Number(labTestIdParam) : null,
    service_request: "",
    collected_by: "",
    collected_time: new Date().toISOString().slice(0, 16),
    num_print: 1,
    sample_details: detailsParam || "",
    barcode: barcodeParam || "",
    collection_site: siteParam || "Venipuncture (Left Antecubital)",
  });

  // Load master data safely
  useEffect(() => {
    HealthcareApi.patients.list({ page_size: 500 })
      .then((res) => setPatients(res.results || []))
      .catch((err) => console.error("Error loading patients:", err));

    const sampleFetcher = HealthcareApi.labTestSamples?.list || (HealthcareApi as any).samples?.list;
    if (sampleFetcher) {
      sampleFetcher({ page_size: 200 })
        .then((res: any) => setSamples(res.results || []))
        .catch((err: any) => console.error("Error loading samples:", err));
    }

    HealthcareApi.practitioners.list({ page_size: 200 })
      .then((res) => setPractitioners(res.results || []))
      .catch((err) => console.error("Error loading practitioners:", err));

    if (HealthcareApi.serviceUnits?.list) {
      HealthcareApi.serviceUnits.list({ page_size: 200 })
        .then((res) => setServiceUnits(res.results || []))
        .catch((err) => console.error("Error loading service units:", err));
    }
  }, []);

  // Whenever a patient ID exists, auto-populate and verify complete demographics
  useEffect(() => {
    const pid = formData.patient || (patientIdParam ? Number(patientIdParam) : 0);
    if (!pid) return;

    // Check if patient exists in loaded list
    const found = patients.find((p) => p.id === pid);
    if (found) {
      const calculatedAge = calculateMarleyAge(found.dob, found.age);
      const fullName = (
        found.patient_name || `${found.first_name || ""} ${found.last_name || ""}`
      ).trim();
      setFormData((prev) => ({
        ...prev,
        patient: pid,
        patient_name: prev.patient_name || fullName,
        patient_age: prev.patient_age || calculatedAge,
        patient_sex: prev.patient_sex || found.sex || "",
      }));
    } else {
      // If not yet in list or out of range, fetch patient directly
      HealthcareApi.patients
        .get(pid)
        .then((p) => {
          const calculatedAge = calculateMarleyAge(p.dob, p.age);
          const fullName = (
            p.patient_name || `${p.first_name || ""} ${p.last_name || ""}`
          ).trim();
          setPatients((prev) => (prev.some((x) => x.id === p.id) ? prev : [p, ...prev]));
          setFormData((prev) => ({
            ...prev,
            patient: p.id,
            patient_name: prev.patient_name || fullName,
            patient_age: prev.patient_age || calculatedAge,
            patient_sex: prev.patient_sex || p.sex || "",
          }));
        })
        .catch((err) => console.error("Could not fetch patient details:", err));
    }
  }, [formData.patient, patientIdParam, patients]);

  // Fetch linked LabTest if lab_test parameter or field is present
  useEffect(() => {
    const targetLtId = labTestIdParam || formData.lab_test;
    if (!targetLtId) return;

    HealthcareApi.labTests
      .get(Number(targetLtId))
      .then((lt) => {
        setLinkedLabTest(lt);
        if (isNew) {
          setFormData((prev) => ({
            ...prev,
            patient: prev.patient || lt.patient || 0,
            patient_name: prev.patient_name || lt.patient_name || "",
            patient_age: prev.patient_age || lt.patient_age || "",
            patient_sex: prev.patient_sex || lt.patient_sex || "",
            lab_test: lt.id,
            referring_practitioner: prev.referring_practitioner || lt.practitioner || lt.requesting_practitioner || null,
            service_request: prev.service_request || (lt.service_request ? String(lt.service_request) : ""),
            company: prev.company || lt.company || "EEU (Demo)",
            sample_name: prev.sample_name || lt.template_sample_name || lt.sample_name || "",
            sample_qty: prev.sample_qty || (lt.sample_qty && Number(lt.sample_qty) > 0 ? Number(lt.sample_qty) : 1),
            sample_uom: prev.sample_uom || lt.sample_uom || "ml",
            container_closure_color: prev.container_closure_color || lt.container_closure_color || "Lavender",
            sample_details: prev.sample_details || lt.sample_details || "",
            barcode: prev.barcode || lt.specimen_barcode || "",
            collection_site: prev.collection_site || lt.collection_site || "Venipuncture (Left Antecubital)",
          }));
        }
      })
      .catch((err) => console.error("Could not load linked Lab Test:", err));
  }, [labTestIdParam, isNew]);

  // Auto-match specimen sample type from sample_name, closure color, or lab test name
  useEffect(() => {
    if (!samples.length) return;

    setFormData((prev) => {
      if (prev.sample) return prev; // already has sample ID

      const targetName = (prev.sample_name || sampleNameParam || "").trim().toLowerCase();
      const targetColor = (prev.container_closure_color || colorParam || "").trim().toLowerCase();
      const testName = (labTestNameParam || linkedLabTest?.lab_test_name || "").toLowerCase();

      // 1. Exact match on sample name
      let matched = samples.find((s) => s.sample.toLowerCase() === targetName);

      // 2. Partial match on sample name
      if (!matched && targetName) {
        matched = samples.find(
          (s) =>
            s.sample.toLowerCase().includes(targetName) ||
            targetName.includes(s.sample.toLowerCase())
        );
      }

      // 3. Match on test name (e.g. "urinalysis" -> "Urine")
      if (!matched && testName) {
        if (testName.includes("urine")) {
          matched = samples.find((s) => s.sample.toLowerCase() === "urine" || s.sample.toLowerCase().includes("urine"));
        } else if (testName.includes("blood") || testName.includes("cbc") || testName.includes("hemoglobin")) {
          matched = samples.find((s) => s.sample.toLowerCase() === "blood" || s.sample.toLowerCase().includes("blood"));
        } else if (testName.includes("swab")) {
          matched = samples.find((s) => s.sample.toLowerCase().includes("swab"));
        } else if (testName.includes("sputum")) {
          matched = samples.find((s) => s.sample.toLowerCase().includes("sputum"));
        } else if (testName.includes("stool")) {
          matched = samples.find((s) => s.sample.toLowerCase().includes("stool"));
        }
      }

      // 4. Match on container closure color
      if (!matched && targetColor) {
        matched = samples.find(
          (s) => s.container_closure_color && s.container_closure_color.toLowerCase() === targetColor
        );
      }

      // 5. Fallback to first available sample
      if (!matched && samples.length > 0) {
        matched = samples[0];
      }

      if (matched) {
        const uomName =
          (matched as any).sample_uom_name ||
          (typeof matched.sample_uom === "string" ? matched.sample_uom : "") ||
          prev.sample_uom ||
          "ml";

        return {
          ...prev,
          sample: matched.id,
          sample_name: prev.sample_name || matched.sample,
          container_closure_color:
            prev.container_closure_color || matched.container_closure_color || "Lavender",
          sample_uom: uomName,
        };
      }

      return prev;
    });
  }, [samples, sampleNameParam, colorParam, labTestNameParam, linkedLabTest?.lab_test_name]);

  // Load existing sample collection record if not new
  const loadData = useCallback(async () => {
    if (isNew || !id) return;
    setLoading(true);
    try {
      let res: SampleCollection;
      const numId = Number(id);
      if (!isNaN(numId) && numId > 0) {
        res = await HealthcareApi.sampleCollections.get(numId);
      } else {
        const listRes = await HealthcareApi.sampleCollections.list({ search: id });
        const match =
          (listRes.results || []).find(
            (s: any) => s.collection_id === id || s.barcode === id || String(s.id) === id
          ) || (listRes.results || [])[0];
        if (!match) {
          toast.error(`Sample collection ${id} not found`);
          setLoading(false);
          return;
        }
        res = match;
      }
      setFormData({
        ...res,
        collected_time: res.collected_time
          ? new Date(res.collected_time).toISOString().slice(0, 16)
          : "",
        collection_site: res.collection_site || "Venipuncture (Left Antecubital)",
        barcode: res.barcode || res.collection_id || "",
      });

      // If patient demographics are incomplete on existing record, fill them
      if (res.patient && (!res.patient_name || !res.patient_age || !res.patient_sex)) {
        HealthcareApi.patients.get(res.patient).then((p) => {
          const calculatedAge = calculateMarleyAge(p.dob, p.age);
          const fullName = (p.patient_name || `${p.first_name || ""} ${p.last_name || ""}`).trim();
          setFormData((prev) => ({
            ...prev,
            patient_name: prev.patient_name || fullName,
            patient_age: prev.patient_age || calculatedAge,
            patient_sex: prev.patient_sex || p.sex || "",
          }));
        }).catch(() => {});
      }

      if (res.lab_test) {
        HealthcareApi.labTests
          .get(res.lab_test)
          .then((lt) => setLinkedLabTest(lt))
          .catch(() => {});
      }
    } catch (err: any) {
      console.error("Failed to load sample collection details:", err);
      toast.error("Failed to load sample collection details");
    } finally {
      setLoading(false);
    }
  }, [id, isNew]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // When patient selection changes manually
  const handlePatientChange = (patientId: number) => {
    const selected = patients.find((p) => p.id === patientId);
    if (!selected) {
      setFormData((prev) => ({
        ...prev,
        patient: 0,
        patient_name: "",
        patient_age: "",
        patient_sex: "",
      }));
      return;
    }

    const calculatedAge = calculateMarleyAge(selected.dob, selected.age);
    const fullName = (
      selected.patient_name || `${selected.first_name || ""} ${selected.last_name || ""}`
    ).trim();

    setFormData((prev) => ({
      ...prev,
      patient: patientId,
      patient_name: fullName,
      patient_age: calculatedAge || prev.patient_age,
      patient_sex: selected.sex || prev.patient_sex,
    }));
  };

  // When sample selection changes manually
  const handleSampleChange = (sampleId: number) => {
    const selected = samples.find((s) => s.id === sampleId);
    if (!selected) return;

    const uomName =
      (selected as any).sample_uom_name ||
      (typeof selected.sample_uom === "string" ? selected.sample_uom : "") ||
      "ml";

    setFormData((prev) => ({
      ...prev,
      sample: sampleId,
      sample_name: selected.sample || prev.sample_name,
      sample_uom: uomName,
      container_closure_color:
        selected.container_closure_color || prev.container_closure_color || "Lavender",
      sample_qty: prev.sample_qty && prev.sample_qty > 0 ? prev.sample_qty : 1,
    }));
  };

  const barcodeId =
    formData.barcode ||
    formData.collection_id ||
    (formData.id
      ? `HLC-SC-${String(formData.id).padStart(5, "0")}`
      : labTestIdParam
      ? `SMP-${new Date().toISOString().slice(2, 10).replace(/-/g, "")}-${String(labTestIdParam).padStart(4, "0")}-${Math.floor(100 + Math.random() * 900)}`
      : "HLC-SC-NEW");

  const handleSave = async () => {
    if (!formData.patient) {
      toast.error("Please select a Patient");
      return;
    }

    setSaving(true);
    try {
      const finalBarcode = formData.barcode?.trim() || barcodeId;
      const finalSite = formData.collection_site || "Venipuncture (Left Antecubital)";

      const payload: any = {
        patient: Number(formData.patient),
        patient_name: formData.patient_name || "",
        patient_age: (formData.patient_age || "").slice(0, 20),
        patient_sex: (formData.patient_sex || "").slice(0, 20),
        company: formData.company || "EEU (Demo)",
        status: formData.status || "Pending",
        invoiced: Boolean(formData.invoiced),
        sample: formData.sample ? Number(formData.sample) : null,
        sample_qty: Number(formData.sample_qty) || 1,
        sample_uom: formData.sample_uom || "ml",
        num_print: Number(formData.num_print) || 1,
        sample_details: formData.sample_details || "",
        collected_by: formData.collected_by || "",
        collected_time: formData.collected_time
          ? new Date(formData.collected_time).toISOString()
          : new Date().toISOString(),
        referring_practitioner: formData.referring_practitioner
          ? Number(formData.referring_practitioner)
          : null,
        collection_point: formData.collection_point
          ? Number(formData.collection_point)
          : null,
        appointment: formData.appointment ? Number(formData.appointment) : null,
        lab_test: formData.lab_test ? Number(formData.lab_test) : (labTestIdParam ? Number(labTestIdParam) : null),
        service_request: formData.service_request || "",
        barcode: finalBarcode,
        collection_site: finalSite,
      };

      const targetId = formData.id || (!isNaN(Number(id)) && Number(id) > 0 ? Number(id) : null);

      if (isNew || !targetId) {
        const created: any = await HealthcareApi.sampleCollections.create(payload);
        toast.success("Sample Collection order created successfully");

        const linkedId = payload.lab_test;
        if (linkedId && payload.status === "Collected") {
          try {
            await HealthcareApi.labTests.collectSample(linkedId, {
              collected_by: payload.collected_by || "Phlebotomist",
              collection_datetime: payload.collected_time,
              collection_site: finalSite,
              barcode: finalBarcode,
            });
          } catch (syncErr) {
            console.warn("Custody sync note:", syncErr);
          }
        }

        const newId = created?.id || created?.data?.id;
        if (fromSource === "lab-test" && linkedId) {
          navigate(`/healthcare/lab-tests/${linkedId}`);
        } else if (newId) {
          navigate(`/healthcare/sample-collections/${newId}`);
        } else {
          navigate("/healthcare/sample-collections");
        }
      } else {
        await HealthcareApi.sampleCollections.update(targetId, payload);
        toast.success("Sample Collection updated successfully");

        const linkedId = payload.lab_test || (linkedLabTest ? linkedLabTest.id : null);
        if (linkedId && payload.status === "Collected") {
          try {
            await HealthcareApi.labTests.collectSample(linkedId, {
              collected_by: payload.collected_by || "Phlebotomist",
              collection_datetime: payload.collected_time,
              collection_site: finalSite,
              barcode: finalBarcode,
            });
          } catch (syncErr) {
            console.warn("Custody sync note:", syncErr);
          }
        }

        loadData();
      }
    } catch (err: any) {
      console.error(err);
      toast.error(errMessage(err, "Failed to save sample collection"));
    } finally {
      setSaving(false);
    }
  };

  const handleCollect = async () => {
    if (!formData.patient) {
      toast.error("Please select a Patient first");
      return;
    }

    setSaving(true);
    const nowIso = new Date().toISOString();
    const finalCollector = formData.collected_by?.trim() || "Phlebotomist";
    const finalBarcode = formData.barcode?.trim() || barcodeId;
    const finalSite = formData.collection_site || "Venipuncture (Left Antecubital)";

    try {
      const targetId = formData.id || (!isNaN(Number(id)) && Number(id) > 0 ? Number(id) : null);

      if (isNew || !targetId) {
        const payload: any = {
          patient: Number(formData.patient),
          patient_name: formData.patient_name || "",
          patient_age: (formData.patient_age || "").slice(0, 20),
          patient_sex: (formData.patient_sex || "").slice(0, 20),
          company: formData.company || "EEU (Demo)",
          status: "Collected",
          invoiced: Boolean(formData.invoiced),
          sample: formData.sample ? Number(formData.sample) : null,
          sample_qty: Number(formData.sample_qty) || 1,
          sample_uom: formData.sample_uom || "ml",
          num_print: Number(formData.num_print) || 1,
          sample_details: formData.sample_details || "",
          collected_by: finalCollector,
          collected_time: nowIso,
          referring_practitioner: formData.referring_practitioner
            ? Number(formData.referring_practitioner)
            : null,
          collection_point: formData.collection_point
            ? Number(formData.collection_point)
            : null,
          appointment: formData.appointment ? Number(formData.appointment) : null,
          lab_test: formData.lab_test ? Number(formData.lab_test) : (labTestIdParam ? Number(labTestIdParam) : null),
          service_request: formData.service_request || "",
          barcode: finalBarcode,
          collection_site: finalSite,
        };

        const created: any = await HealthcareApi.sampleCollections.create(payload);

        if (payload.lab_test) {
          try {
            await HealthcareApi.labTests.collectSample(payload.lab_test, {
              collected_by: finalCollector,
              collection_datetime: nowIso,
              collection_site: finalSite,
              barcode: finalBarcode,
            });
          } catch (syncErr) {
            console.warn("Custody sync note:", syncErr);
          }
        }

        toast.success(`Specimen collected successfully! Specimen Barcode: ${finalBarcode}`);
        const newId = created?.id || created?.data?.id;
        if (fromSource === "lab-test" && payload.lab_test) {
          navigate(`/healthcare/lab-tests/${payload.lab_test}`);
        } else if (newId) {
          navigate(`/healthcare/sample-collections/${newId}`);
        } else {
          navigate("/healthcare/sample-collections");
        }
      } else {
        await HealthcareApi.sampleCollections.update(targetId, {
          status: "Collected",
          collected_time: nowIso,
          collected_by: finalCollector,
          barcode: finalBarcode,
          collection_site: finalSite,
        } as any);

        const linkedId = formData.lab_test || (linkedLabTest ? linkedLabTest.id : null);
        if (linkedId) {
          try {
            await HealthcareApi.labTests.collectSample(linkedId, {
              collected_by: finalCollector,
              collection_datetime: nowIso,
              collection_site: finalSite,
              barcode: finalBarcode,
            });
          } catch (syncErr) {
            console.warn("Custody sync note:", syncErr);
          }
        }

        toast.success(`Specimen marked as Collected! Barcode: ${finalBarcode}`);
        loadData();
      }
    } catch (err: any) {
      toast.error(errMessage(err, "Failed to mark sample as collected"));
    } finally {
      setSaving(false);
    }
  };

  const handlePartlyCollect = async () => {
    const targetId = formData.id || (!isNaN(Number(id)) && Number(id) > 0 ? Number(id) : null);
    if (!targetId || isNew) {
      toast.error("Please save the specimen order first before updating status");
      return;
    }
    try {
      await HealthcareApi.sampleCollections.update(targetId, {
        status: "Partly Collected",
      } as any);
      toast.success("Specimen status changed to Partly Collected");
      loadData();
    } catch (err: any) {
      toast.error("Failed to update status");
    }
  };

  const handleCancel = async () => {
    const targetId = formData.id || (!isNaN(Number(id)) && Number(id) > 0 ? Number(id) : null);
    if (!targetId || isNew) return;
    if (!confirm("Are you sure you want to cancel this sample collection?")) return;
    try {
      await HealthcareApi.sampleCollections.update(targetId, {
        status: "Cancelled",
      } as any);
      toast.success("Sample collection cancelled");
      loadData();
    } catch (err: any) {
      toast.error("Failed to cancel sample collection");
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[350px]">
        <Icon icon="solar:spinner-line-duotone" className="animate-spin text-emerald-600" size={36} />
      </div>
    );
  }

  const capInfo = getCapColor(formData.container_closure_color);
  const isLocked = !isNew && (formData.status === "Collected" || formData.status === "Partly Collected");
  const printCopies = Math.max(1, Math.min(10, Number(formData.num_print) || 1));

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (fromSource === "lab-test" && (formData.lab_test || labTestIdParam)) {
                navigate(`/healthcare/lab-tests/${formData.lab_test || labTestIdParam}`);
              } else {
                navigate("/healthcare/sample-collections");
              }
            }}
          >
            <Icon icon="solar:arrow-left-linear" size={18} className="mr-1" />
            {fromSource === "lab-test" ? "Back to Lab Test" : "Back"}
          </Button>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-bold tracking-tight">
                {isNew ? "Clinical Sample Collection" : barcodeId}
              </h1>
              {formData.status && (
                <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${statusColor[formData.status] || ""}`}>
                  {formData.status}
                </span>
              )}
              {formData.invoiced && (
                <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Invoiced
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isNew
                ? "Dedicated clinical phlebotomy and specimen tube intake workflow"
                : `Patient: ${formData.patient_name || "Unknown"} • Sample: ${formData.sample_name || "Specimen"}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {(isNew || formData.status === "Pending" || formData.status === "Partly Collected") && (
            <Button
              onClick={handleCollect}
              disabled={saving}
              className="bg-amber-600 hover:bg-amber-700 text-white font-semibold shadow-xs gap-1.5"
            >
              <Icon icon="solar:test-tube-bold" size={16} />
              {isNew ? "Collect Sample & Log Custody" : "Mark Collected"}
            </Button>
          )}

          {!isNew && formData.status === "Pending" && (
            <Button
              variant="outline"
              size="sm"
              onClick={handlePartlyCollect}
              className="text-blue-700 border-blue-300 hover:bg-blue-50"
            >
              <Icon icon="solar:clock-circle-bold" size={16} className="mr-1.5" /> Partly Collected
            </Button>
          )}

          <Button variant="outline" size="sm" onClick={handlePrint} className="text-blue-600 border-blue-200 hover:bg-blue-50">
            <Icon icon="solar:printer-bold" size={16} className="mr-1.5" /> Print Barcode ({printCopies})
          </Button>

          {!isNew && formData.status !== "Cancelled" && (
            <Button variant="ghost" size="sm" onClick={handleCancel} className="text-rose-600 hover:bg-rose-50">
              Cancel
            </Button>
          )}

          <Button
            onClick={handleSave}
            disabled={saving}
            variant="outline"
            className="border-slate-300 hover:bg-slate-50 font-medium"
          >
            {saving ? (
              <Icon icon="solar:spinner-line-duotone" className="animate-spin mr-2" size={16} />
            ) : (
              <Icon icon="solar:disk-bold" className="mr-2" size={16} />
            )}
            {isNew ? "Save Order Draft" : "Save Changes"}
          </Button>
        </div>
      </div>

      {/* Linked Lab Test Banner */}
      {Boolean(linkedLabTest || formData.lab_test || labTestIdParam) && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-900 dark:text-amber-200 print:hidden">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-300 shrink-0">
              <Icon icon="solar:test-tube-bold" size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-sm">
                  Linked Lab Test: {linkedLabTest?.test_id || `LAB-${formData.lab_test || labTestIdParam}`}
                </span>
                {linkedLabTest?.status && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-amber-200/60 dark:bg-amber-950 text-amber-900 dark:text-amber-300">
                    {linkedLabTest.status}
                  </span>
                )}
                {linkedLabTest?.specimen_status && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-sky-100 text-sky-800 border border-sky-200">
                    Specimen: {linkedLabTest.specimen_status}
                  </span>
                )}
              </div>
              <p className="text-xs text-amber-800/90 dark:text-amber-300/90 mt-0.5">
                Investigation: <strong className="text-foreground">{linkedLabTest?.lab_test_name || labTestNameParam || "Diagnostic Test"}</strong>
                {linkedLabTest?.template_sample_name || formData.sample_name ? ` • Target: ${linkedLabTest?.template_sample_name || formData.sample_name}` : ""}
                {formData.container_closure_color ? ` (${formData.container_closure_color} Cap)` : ""}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/healthcare/lab-tests/${formData.lab_test || labTestIdParam}`)}
            className="text-xs font-semibold border-amber-500/30 text-amber-800 dark:text-amber-200 hover:bg-amber-500/20 shrink-0"
          >
            <Icon icon="solar:arrow-left-linear" size={14} className="mr-1" />
            Return to Lab Test Workbench
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 print:hidden">
        {/* Left 2 Cols: Form Sections */}
        <div className="lg:col-span-2 space-y-6">
          {/* Section 1: Patient Details */}
          <Card>
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-base flex items-center gap-2">
                <Icon icon="solar:user-bold" className="text-emerald-600" size={18} />
                Patient & Administrative Details
              </CardTitle>
              <CardDescription>
                Patient demographics auto-fetched and locked per Marley healthcare standards
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Patient <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.patient || ""}
                    onChange={(e) => handlePatientChange(Number(e.target.value))}
                    disabled={isLocked}
                    className="w-full h-9 px-3 rounded-md border text-sm bg-background font-medium disabled:opacity-75 disabled:bg-muted"
                  >
                    <option value="">Select Patient...</option>
                    {/* Ensure currently selected patient option is rendered even before long list loads */}
                    {formData.patient && !patients.some((p) => p.id === formData.patient) && (
                      <option value={formData.patient}>
                        {formData.patient_name || `Patient #${formData.patient}`}
                      </option>
                    )}
                    {patients.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.patient_name || `${p.first_name} ${p.last_name}`} (ID: {p.patient_id || `#${p.id}`})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Patient Name
                  </label>
                  <Input
                    value={formData.patient_name || ""}
                    readOnly
                    className="bg-muted text-muted-foreground font-medium"
                    placeholder="Auto-populated from Patient"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Patient Age
                  </label>
                  <Input
                    value={formData.patient_age || ""}
                    readOnly
                    className="bg-muted text-muted-foreground font-medium"
                    placeholder="e.g. 35 Year(s) 2 Month(s) 11 Day(s)"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Gender / Sex
                  </label>
                  <Input
                    value={formData.patient_sex || ""}
                    readOnly
                    className="bg-muted text-muted-foreground font-medium"
                    placeholder="Auto-populated from Patient"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Company
                  </label>
                  <Input
                    value={formData.company || "EEU (Demo)"}
                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                    disabled={isLocked}
                    className="disabled:opacity-75 disabled:bg-muted font-medium"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Referring Practitioner
                  </label>
                  <select
                    value={formData.referring_practitioner || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        referring_practitioner: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                    className="w-full h-9 px-3 rounded-md border text-sm bg-background font-medium"
                  >
                    <option value="">None / Direct Laboratory</option>
                    {formData.referring_practitioner && !practitioners.some((doc) => doc.id === formData.referring_practitioner) && (
                      <option value={formData.referring_practitioner}>
                        Practitioner #{formData.referring_practitioner}
                      </option>
                    )}
                    {practitioners.map((doc) => (
                      <option key={doc.id} value={doc.id}>
                        {doc.practitioner_name} ({doc.department_name || "General"})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Collection Point / Service Unit
                  </label>
                  <select
                    value={formData.collection_point || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        collection_point: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                    className="w-full h-9 px-3 rounded-md border text-sm bg-background font-medium"
                  >
                    <option value="">Select Service Unit (Lab / Phlebotomy Room)...</option>
                    {formData.collection_point && !serviceUnits.some((u) => u.id === formData.collection_point) && (
                      <option value={formData.collection_point}>
                        Service Unit #{formData.collection_point}
                      </option>
                    )}
                    {serviceUnits.map((unit) => (
                      <option key={unit.id} value={unit.id}>
                        {unit.service_unit_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Status
                  </label>
                  <select
                    value={formData.status || "Pending"}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full h-9 px-3 rounded-md border text-sm bg-background font-semibold"
                  >
                    <option value="Pending">Pending</option>
                    <option value="Partly Collected">Partly Collected</option>
                    <option value="Collected">Collected</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section 2: Specimen & Collection Parameters */}
          <Card>
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-base flex items-center gap-2">
                <Icon icon="solar:test-tube-minimalistic-bold" className="text-emerald-600" size={18} />
                Specimen & Collection Parameters
              </CardTitle>
              <CardDescription>
                Tube specifications, container closure colour, barcode identity, and phlebotomy audit log
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Specimen / Sample Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.sample || ""}
                    onChange={(e) => handleSampleChange(Number(e.target.value))}
                    className="w-full h-9 px-3 rounded-md border text-sm bg-background font-medium"
                  >
                    <option value="">Select Specimen Type...</option>
                    {formData.sample && !samples.some((s) => s.id === formData.sample) && (
                      <option value={formData.sample}>
                        {formData.sample_name || `Sample #${formData.sample}`}
                      </option>
                    )}
                    {samples.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.sample} ({s.container_closure_color || "Standard Tube"})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Container Cap Color
                  </label>
                  <div className="flex items-center gap-2">
                    <span
                      className="w-5 h-5 rounded-full border shadow-sm flex-shrink-0"
                      style={{
                        backgroundColor: capInfo.bg,
                        borderColor: capInfo.border,
                      }}
                      title={capInfo.desc}
                    />
                    <Input
                      value={formData.container_closure_color || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, container_closure_color: e.target.value })
                      }
                      placeholder="e.g. Lavender, Gold, Red, Light Blue"
                      className="font-medium"
                    />
                  </div>
                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    {["Lavender", "Gold", "Light Blue", "Red", "Green", "Gray", "Yellow"].map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setFormData({ ...formData, container_closure_color: c })}
                        className="text-[11px] px-2 py-0.5 rounded border bg-slate-50 hover:bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Sample Quantity
                  </label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0.1"
                    value={formData.sample_qty ?? 1}
                    onChange={(e) => setFormData({ ...formData, sample_qty: Number(e.target.value) })}
                    className="font-medium"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Sample UOM
                  </label>
                  <Input
                    value={formData.sample_uom || "ml"}
                    onChange={(e) => setFormData({ ...formData, sample_uom: e.target.value })}
                    placeholder="e.g. ml, vial, swab, drops"
                    className="font-medium"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Phlebotomist / Collector Name
                  </label>
                  <Input
                    placeholder="Staff name or phlebotomist ID"
                    value={formData.collected_by || ""}
                    onChange={(e) => setFormData({ ...formData, collected_by: e.target.value })}
                    className="font-medium"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Collection Scheduled / Performed Time
                  </label>
                  <Input
                    type="datetime-local"
                    value={formData.collected_time || ""}
                    onChange={(e) => setFormData({ ...formData, collected_time: e.target.value })}
                    className="font-medium"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Anatomical Collection Site
                  </label>
                  <select
                    value={formData.collection_site || "Venipuncture (Left Antecubital)"}
                    onChange={(e) => setFormData({ ...formData, collection_site: e.target.value })}
                    className="w-full h-9 px-3 rounded-md border text-sm bg-background font-medium"
                  >
                    <option value="Venipuncture (Left Antecubital)">Venipuncture (Left Antecubital)</option>
                    <option value="Venipuncture (Right Antecubital)">Venipuncture (Right Antecubital)</option>
                    <option value="Venipuncture (Left Dorsal Hand)">Venipuncture (Left Dorsal Hand)</option>
                    <option value="Venipuncture (Right Dorsal Hand)">Venipuncture (Right Dorsal Hand)</option>
                    <option value="Capillary Fingerstick">Capillary Fingerstick</option>
                    <option value="Nasopharyngeal Swab">Nasopharyngeal Swab</option>
                    <option value="Oropharyngeal Swab">Oropharyngeal Swab</option>
                    <option value="Midstream Clean-Catch Urine">Midstream Clean-Catch Urine</option>
                    <option value="Catheter Urine Specimen">Catheter Urine Specimen</option>
                    <option value="Sterile Sputum Cup">Sterile Sputum Cup</option>
                    <option value="Arterial Puncture (Radial)">Arterial Puncture (Radial)</option>
                    <option value="Heelstick (Pediatric)">Heelstick (Pediatric)</option>
                    <option value="Wound / Tissue Swab">Wound / Tissue Swab</option>
                    <option value="Other Non-Standard Site">Other Non-Standard Site</option>
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                      Specimen Barcode / Accession ID
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        const rand = Math.floor(100000 + Math.random() * 900000);
                        const prefix = formData.lab_test ? `SP-LAB${formData.lab_test}` : "SP";
                        setFormData({ ...formData, barcode: `${prefix}-${rand}` });
                        toast.info("Generated new specimen barcode");
                      }}
                      className="text-[11px] text-cyan-600 hover:underline flex items-center gap-1"
                    >
                      <Icon icon="solar:refresh-circle-bold" size={12} /> Regenerate
                    </button>
                  </div>
                  <Input
                    value={formData.barcode || ""}
                    onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                    placeholder={barcodeId}
                    className="font-mono font-bold tracking-wider"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Number of Labels to Print (Marley num_print)
                  </label>
                  <Input
                    type="number"
                    min="1"
                    max="10"
                    value={formData.num_print || 1}
                    onChange={(e) => setFormData({ ...formData, num_print: Number(e.target.value) || 1 })}
                    className="font-medium"
                  />
                </div>

                <div className="flex items-center pt-5">
                  <label className="flex items-center gap-2 cursor-pointer text-sm font-medium">
                    <input
                      type="checkbox"
                      checked={Boolean(formData.invoiced)}
                      onChange={(e) => setFormData({ ...formData, invoiced: e.target.checked })}
                      className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>Mark as Invoiced</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Sample Details / Clinical Handling Instructions
                </label>
                <textarea
                  rows={3}
                  value={formData.sample_details || ""}
                  onChange={(e) => setFormData({ ...formData, sample_details: e.target.value })}
                  placeholder="e.g. Fasting sample required, maintain cold chain on ice, transport immediately to immunology lab..."
                  className="w-full px-3 py-2 text-sm rounded-md border bg-background font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right 1 Col: Standard Marley Specimen Tube Label Preview (50x25mm) */}
        <div className="space-y-4">
          <Card className="sticky top-6 border-slate-300 dark:border-slate-800 shadow-sm">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-base flex items-center justify-between">
                <span className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
                  <Icon icon="solar:printer-bold" className="text-blue-600" size={18} />
                  Specimen Tube Label
                </span>
                <span className="text-[11px] font-mono px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded font-semibold text-slate-600 dark:text-slate-300">
                  50 × 25 mm
                </span>
              </CardTitle>
              <CardDescription>
                Standard Marley vacuum specimen tube barcode label (1 label per tube drawn)
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4 flex flex-col items-center">
              {/* Physical tube label preview */}
              <div
                className="w-72 p-3 bg-white border border-slate-300 rounded shadow-md flex flex-col justify-between text-slate-900"
              >
                <div className="flex justify-between items-center border-b border-slate-200 pb-1 text-[11px] font-semibold text-slate-700">
                  <span className="tracking-wide">CLINICAL LAB</span>
                  <div className="flex items-center gap-1.5">
                    <span
                      className="w-2.5 h-2.5 rounded-full border"
                      style={{ backgroundColor: capInfo.bg, borderColor: capInfo.border }}
                    />
                    <span className="uppercase text-blue-700 font-bold">
                      {formData.sample_name || "Specimen"}
                    </span>
                  </div>
                </div>

                <div className="my-1.5">
                  <p className="font-bold text-sm leading-tight text-slate-950 truncate">
                    {formData.patient_name || "Patient Name"}
                  </p>
                  <p className="text-[11px] text-slate-600 mt-0.5 truncate">
                    ID: #{formData.patient || "000"} · {formData.patient_age || "—"} {formData.patient_sex ? `(${formData.patient_sex})` : ""}
                  </p>
                </div>

                {/* SVG Barcode Generation */}
                <div className="my-1 flex flex-col items-center">
                  <svg className="w-56 h-10" viewBox="0 0 200 36">
                    {barcodeId
                      .split("")
                      .flatMap((char) => {
                        const code = char.charCodeAt(0);
                        const w1 = (code % 3) + 1;
                        const w2 = ((code >> 2) % 2) + 1;
                        return [w1, 1.5, w2, 1.5];
                      })
                      .map((width, idx, arr) => {
                        const isBar = idx % 2 === 0;
                        const x = arr.slice(0, idx).reduce((a, b) => a + b, 10);
                        return isBar ? (
                          <rect key={idx} x={x} y="0" width={width} height="36" fill="#000000" />
                        ) : null;
                      })}
                  </svg>
                  <span className="font-mono text-[11px] tracking-wider text-slate-900 font-bold mt-0.5">
                    {barcodeId}
                  </span>
                </div>

                <div className="flex justify-between text-[10px] text-slate-500 border-t border-slate-200 pt-1 mt-1">
                  <span>
                    Coll:{" "}
                    {formData.collected_time
                      ? new Date(formData.collected_time).toLocaleDateString()
                      : new Date().toLocaleDateString()}
                  </span>
                  <span>
                    {formData.sample_qty ? `${formData.sample_qty} ${formData.sample_uom || "ml"}` : ""}
                  </span>
                </div>
              </div>

              <div className="w-full mt-4 space-y-2">
                <Button
                  onClick={handlePrint}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium"
                  size="sm"
                >
                  <Icon icon="solar:printer-bold" size={16} className="mr-2" />
                  Print Physical Tube Label ({printCopies} {printCopies === 1 ? "copy" : "copies"})
                </Button>
                <p className="text-[11px] text-center text-muted-foreground">
                  Prints formatted 50×25mm sticker label for tube vacuum tubes
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Printable Area - Only Visible During window.print() */}
      <div id="tube-label-printable-area" className="hidden print:block print:w-full">
        <style>{`
          @media print {
            body * {
              visibility: hidden;
            }
            #tube-label-printable-area, #tube-label-printable-area * {
              visibility: visible;
            }
            #tube-label-printable-area {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
              margin: 0;
              padding: 10px;
              background: white;
            }
            .tube-print-grid {
              display: flex;
              flex-wrap: wrap;
              gap: 12px;
            }
            .tube-print-label {
              width: 2in;
              height: 1.2in;
              border: 1px dashed #999;
              padding: 6px;
              box-sizing: border-box;
              font-family: monospace;
              page-break-inside: avoid;
              background: white;
              color: black;
            }
          }
        `}</style>
        <div className="tube-print-grid">
          {Array.from({ length: printCopies }).map((_, index) => (
            <div key={index} className="tube-print-label flex flex-col justify-between text-[9px] leading-tight">
              <div className="flex justify-between font-bold border-b border-black pb-0.5">
                <span>CLINICAL LAB</span>
                <span>{formData.sample_name || "SPECIMEN"}</span>
              </div>
              <div className="my-0.5">
                <div className="font-bold text-[10px] truncate">{formData.patient_name || "Patient"}</div>
                <div>ID: #{formData.patient} · {formData.patient_age} {formData.patient_sex ? `(${formData.patient_sex})` : ""}</div>
              </div>
              <div className="font-mono text-center font-bold text-[10px] my-0.5 border-y border-black py-0.5">
                * {barcodeId} *
              </div>
              <div className="flex justify-between text-[8px]">
                <span>{formData.collected_time ? new Date(formData.collected_time).toLocaleDateString() : ""}</span>
                <span>{formData.sample_qty} {formData.sample_uom}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
