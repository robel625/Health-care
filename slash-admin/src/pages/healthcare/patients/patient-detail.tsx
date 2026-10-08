import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router";
import { Icon } from "@/components/icon";
import { Button } from "@/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/ui/card";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { HealthcareApi } from "@/api/services/healthcareService";
import DocumentSidebar from "@/components/healthcare/DocumentSidebar";
import DocumentTimeline, { parseTimelineDate } from "@/components/healthcare/DocumentTimeline";
import ActivityHeatmap from "@/components/healthcare/ActivityHeatmap";
import Avatar from "@/components/Avatar";
import { getInitials, cn } from "@/utils";
import { formatAge } from "@/utils/age";
import type { Patient, PatientRelation, InpatientRecord, ServiceRequest } from "@/api/services/healthcareService";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/ui/dialog";
import { Badge } from "@/ui/badge";
import { toast } from "sonner";
import InpatientAdmissionModal from "@/pages/healthcare/inpatient/components/InpatientAdmissionModal";
import InpatientRecordsModal from "@/pages/healthcare/inpatient/components/InpatientRecordsModal";
import ActiveInpatientBanner from "@/pages/healthcare/inpatient/components/ActiveInpatientBanner";
import NewMedicationRequestModal from "@/pages/healthcare/pharmacy/components/NewMedicationRequestModal";
import NewTherapyPlanModal from "@/pages/healthcare/clinical/components/NewTherapyPlanModal";
import NewTherapySessionModal from "@/pages/healthcare/clinical/components/NewTherapySessionModal";
import EEUMedicalIdCardModal from "@/pages/healthcare/occupational/components/EEUMedicalIdCardModal";

type Tab = "details" | "eeu" | "dashboard" | "diagnostics" | "address" | "medical";

export default function PatientDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("details");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Record<string, any>>({});
  const [relations, setRelations] = useState<PatientRelation[]>([]);
  // allergies loaded for sidebar

  const [activity, setActivity] = useState<any[]>([]);
  const [patientLabs, setPatientLabs] = useState<any[]>([]);

  // Inpatient state (Marley Parity)
  const [patientInpatients, setPatientInpatients] = useState<InpatientRecord[]>([]);
  const [showInpatientRecordsModal, setShowInpatientRecordsModal] = useState(false);
  const [showAdmissionModal, setShowAdmissionModal] = useState(false);

  // Medication Request Modal (Marley Parity)
  const [newMedReqModalOpen, setNewMedReqModalOpen] = useState(false);
  // Therapy Modals (Marley Parity)
  const [newTherapyPlanModalOpen, setNewTherapyPlanModalOpen] = useState(false);
  const [newTherapySessionModalOpen, setNewTherapySessionModalOpen] = useState(false);

  // EEU Digital Medical ID Card Modal
  const [showIdCardModal, setShowIdCardModal] = useState(false);

  // Service Requests (Marley Parity)
  const [patientServiceRequests, setPatientServiceRequests] = useState<ServiceRequest[]>([]);
  const [srCategoryFilter, setSrCategoryFilter] = useState<string>("all");
  const [srStatusFilter, setSrStatusFilter] = useState<string>("all");
  const [srSearchQuery, setSrSearchQuery] = useState<string>("");
  const [srActionLoadingId, setSrActionLoadingId] = useState<number | null>(null);

  // Patient-specific transaction counts for dashboard
  const [txCounts, setTxCounts] = useState({
    appointments: 0, encounters: 0, vitals: 0, prescriptions: 0,
    labTests: 0, sampleCollections: 0, therapyPlans: 0, therapySessions: 0,
    inpatient: 0, observations: 0, medicationRequests: 0, serviceRequests: 0,
  });
  const [medicalRecords, setMedicalRecords] = useState<any[]>([]);
  const [feeValidities, setFeeValidities] = useState<any[]>([]);

  // Diagnostics Tab Filter & Search
  const [diagnosticsSearchQuery, setDiagnosticsSearchQuery] = useState("");
  const [diagnosticsFilter, setDiagnosticsFilter] = useState<"all" | "services" | "labs" | "pending" | "completed">("all");

  // Medical History Tab Filter & Search
  const [medicalRecordSearch, setMedicalRecordSearch] = useState("");
  const [medicalRecordTypeFilter, setMedicalRecordTypeFilter] = useState("all");

  const loadPatient = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const pid = Number(id);
      const res = await HealthcareApi.patients.get(pid) as any;
      setPatient(res);
      setForm(res);

      // Load relations
      try {
        const relRes = await HealthcareApi.patientRelations.list({ patient: id }) as any;
        setRelations(relRes.results || []);
      } catch { setRelations([]); }

      // Load patient transactions in parallel (with results up to 100 for timeline & heatmap)
      const [apptRes, encRes, vsRes, rxRes, labRes, thRes, thSessRes, inptRes, obsRes, pmrRes, fvRes, medReqRes, sampleColRes, srRes] = await Promise.all([
        HealthcareApi.appointments.list({ patient: pid, page_size: 100 }).catch(() => ({ results: [], count: 0 })),
        HealthcareApi.encounters.list({ patient: pid, page_size: 100 }).catch(() => ({ results: [], count: 0 })),
        HealthcareApi.vitalSigns.list({ patient: pid, page_size: 100 }).catch(() => ({ results: [], count: 0 })),
        HealthcareApi.prescriptions.list({ patient: pid, page_size: 100 }).catch(() => ({ results: [], count: 0 })),
        HealthcareApi.labTests.list({ patient: pid, page_size: 100 }).catch(() => ({ results: [], count: 0 })),
        HealthcareApi.therapyPlans.list({ patient: pid, page_size: 100 }).catch(() => ({ results: [], count: 0 })),
        HealthcareApi.therapySessions.list({ patient: pid, page_size: 100 }).catch(() => ({ results: [], count: 0 })),
        HealthcareApi.inpatientRecords.list({ patient: pid, page_size: 100 }).catch(() => ({ results: [], count: 0 })),
        HealthcareApi.observations.list({ patient: pid, page_size: 100 }).catch(() => ({ results: [], count: 0 })),
        HealthcareApi.medicalRecords.list({ patient: pid, page_size: 100 }).catch(() => ({ results: [], count: 0 })),
        HealthcareApi.feeValidities.list({ patient: pid, page_size: 50 }).catch(() => ({ results: [], count: 0 })),
        HealthcareApi.medicationRequests.list({ patient: pid, page_size: 100 }).catch(() => ({ results: [], count: 0 })),
        HealthcareApi.sampleCollections.list({ patient: pid, page_size: 100 }).catch(() => ({ results: [], count: 0 })),
        HealthcareApi.serviceRequests.list({ patient: pid, page_size: 100 }).catch(() => ({ results: [], count: 0 })),
      ]);

      const appts = (apptRes as any).results || [];
      const encs = (encRes as any).results || [];
      const vitals = (vsRes as any).results || [];
      const rxs = (rxRes as any).results || [];
      const labs = (labRes as any).results || [];
      const thPlans = (thRes as any).results || [];
      const thSessions = (thSessRes as any).results || [];
      const inpts = (inptRes as any).results || [];
      const obss = (obsRes as any).results || [];
      const pmrs = (pmrRes as any).results || [];
      const fvs = (fvRes as any).results || [];
      const medReqs = (medReqRes as any).results || [];
      const sampleCols = (sampleColRes as any).results || [];
      const srs = (srRes as any).results || [];

      setTxCounts({
        appointments: apptRes.count ?? appts.length,
        encounters: encRes.count ?? encs.length,
        vitals: vsRes.count ?? vitals.length,
        prescriptions: rxRes.count ?? rxs.length,
        medicationRequests: medReqRes.count ?? medReqs.length,
        sampleCollections: sampleColRes.count ?? sampleCols.length,
        labTests: labRes.count ?? labs.length,
        therapyPlans: thRes.count ?? thPlans.length,
        therapySessions: thSessRes.count ?? thSessions.length,
        inpatient: inptRes.count ?? inpts.length,
        observations: obsRes.count ?? obss.length,
        serviceRequests: srRes.count ?? srs.length,
      });

      setMedicalRecords(pmrs);
      setFeeValidities(fvs);
      setPatientLabs(labs);
      setPatientInpatients(inpts);
      setPatientServiceRequests(srs);

      // Build real activity timeline from actual patient transactions
      const realActivity: any[] = [];

      for (const a of appts) {
        realActivity.push({
          id: `appt-${a.id}`,
          text: `Appointment with ${a.practitioner_name || 'Practitioner'} (${a.appointment_type || 'Consultation'}) · Status: ${a.status || 'Scheduled'}`,
          time: a.creation || (a.appointment_date ? `${a.appointment_date} ${a.appointment_time || ''}`.trim() : ""),
          reference_doctype: "Patient Appointment",
          reference_name: a.appointment_id || String(a.id),
          user: a.practitioner_name || a.owner || "",
        });
      }

      for (const e of encs) {
        realActivity.push({
          id: `enc-${e.id}`,
          text: `Encounter with ${e.practitioner_name || 'Practitioner'} (${e.encounter_type || e.type || 'Consultation'}) · Status: ${e.status || 'Completed'}`,
          time: e.creation || (e.encounter_date ? `${e.encounter_date} ${e.encounter_time || ''}`.trim() : ""),
          reference_doctype: "Patient Encounter",
          reference_name: e.encounter_id || String(e.id),
          user: e.practitioner_name || e.owner || "",
        });
      }

      for (const v of vitals) {
        const bpStr = v.bp || (v.bp_systolic ? `${v.bp_systolic}/${v.bp_diastolic} mmHg` : "");
        const parts = [
          bpStr && `BP: ${bpStr}`,
          v.pulse && `Pulse: ${v.pulse} bpm`,
          v.temperature && `Temp: ${v.temperature}°C`,
          (v.spo2 || v.oxygen_saturation) && `SpO2: ${v.spo2 || v.oxygen_saturation}%`,
        ].filter(Boolean).join(", ");
        realActivity.push({
          id: `vs-${v.id}`,
          text: `Vital Signs recorded${parts ? ` (${parts})` : ""}`,
          time: v.creation || (v.signs_date ? `${v.signs_date} ${v.signs_time || ''}`.trim() : ""),
          reference_doctype: "Vital Signs",
          reference_name: v.vital_signs_id || String(v.id),
          user: v.practitioner_name || v.owner || "",
        });
      }

      for (const l of labs) {
        realActivity.push({
          id: `lab-${l.id}`,
          text: `Lab Test: ${l.lab_test_name || 'Laboratory Test'} · Status: ${l.status || 'Draft'}`,
          time: l.creation || l.submitted_date || l.result_date || l.date,
          reference_doctype: "Lab Test",
          reference_name: l.lab_test_id || l.name || String(l.id),
          user: l.practitioner_name || l.owner || "",
        });
      }

      for (const rx of rxs) {
        realActivity.push({
          id: `rx-${rx.id}`,
          text: `Drug Prescription: ${rx.drug_name || rx.medication_name || rx.medication || 'Medication'} ${rx.dosage ? `(${rx.dosage}${rx.period ? ` · ${rx.period}` : ''})` : ''}`,
          time: rx.creation || rx.prescribed_date || rx.posting_date || rx.date,
          reference_doctype: "Drug Prescription",
          reference_name: String(rx.id),
          user: rx.practitioner_name || rx.owner || "",
        });
      }

      for (const th of thPlans) {
        realActivity.push({
          id: `th-${th.id}`,
          text: `Therapy Plan: ${th.therapy_type_name || 'Therapy'} · Status: ${th.status || 'Draft'}`,
          time: th.creation || th.start_date,
          reference_doctype: "Therapy Plan",
          reference_name: th.therapy_plan_id || String(th.id),
          user: th.owner || "",
        });
      }

      for (const ts of thSessions) {
        realActivity.push({
          id: `ts-${ts.id}`,
          text: `Therapy Session: ${ts.therapy_type_name || ts.therapy_type || 'Therapy'} · Status: ${ts.status || 'Completed'}`,
          time: ts.creation || ts.session_date || ts.date,
          reference_doctype: "Therapy Session",
          reference_name: ts.therapy_session_id || String(ts.id),
          user: ts.practitioner_name || ts.owner || "",
        });
      }

      for (const inp of inpts) {
        realActivity.push({
          id: `inp-${inp.id}`,
          text: `Inpatient Record: ${inp.service_unit_name || inp.service_unit || 'Ward'} · Status: ${inp.status || 'Admitted'}`,
          time: inp.creation || inp.admit_date,
          reference_doctype: "Inpatient Record",
          reference_name: inp.inpatient_record_id || String(inp.id),
          user: inp.owner || "",
        });
      }

      for (const ob of obss) {
        realActivity.push({
          id: `obs-${ob.id}`,
          text: `Observation: ${ob.observation_template_name || ob.observation_name || 'Clinical Observation'} · Status: ${ob.status || 'Active'}`,
          time: ob.creation || (ob.date ? `${ob.date} ${ob.time || ''}`.trim() : ""),
          reference_doctype: "Observation",
          reference_name: ob.observation_id || String(ob.id),
          user: ob.practitioner_name || ob.owner || "",
        });
      }

      for (const mr of pmrs) {
        realActivity.push({
          id: `pmr-${mr.id}`,
          text: mr.subject || mr.content || "Patient Medical Record",
          time: mr.creation || mr.communication_date,
          reference_doctype: mr.reference_doctype || "Patient Medical Record",
          reference_name: mr.reference_name || String(mr.id),
          user: mr.user_name || mr.owner || "",
        });
      }

      for (const mrq of medReqs) {
        realActivity.push({
          id: `mrq-${mrq.id}`,
          text: `Medication Request: ${mrq.medication_name} (Qty: ${mrq.quantity || 1}) · Status: ${mrq.status || 'Active'}`,
          time: mrq.creation || mrq.created_at,
          reference_doctype: "Medication Request",
          reference_name: mrq.request_id || mrq.order_number || String(mrq.id),
          user: mrq.practitioner_name || "",
        });
      }

      for (const sc of sampleCols) {
        realActivity.push({
          id: `sc-${sc.id}`,
          text: `Sample Collection: ${sc.sample_id || sc.sample_type || 'Specimen'} · Status: ${sc.status || 'Collected'}`,
          time: sc.creation || sc.collected_time || sc.date,
          reference_doctype: "Sample Collection",
          reference_name: sc.sample_collection_id || String(sc.id),
          user: sc.collected_by_name || "",
        });
      }

      for (const sr of srs) {
        realActivity.push({
          id: `sr-${sr.id}`,
          text: `Service Request: ${sr.template_dt || sr.order_description || sr.category_name || 'Service Order'} · Priority: ${sr.priority || 'Routine'} · Status: ${sr.status || 'Draft'}`,
          time: sr.creation || sr.order_date,
          reference_doctype: "Service Request",
          reference_name: sr.name || String(sr.id),
          user: sr.practitioner_name || "",
        });
      }

      // Ensure patient registration is explicitly present in activity
      const hasReg = realActivity.some(
        (a) => a.reference_doctype === "Patient" || a.text?.toLowerCase().includes("registered")
      );
      if (!hasReg && res?.creation) {
        realActivity.push({
          id: `patient-reg-${res.id}`,
          text: `Patient registered: ${res.patient_name || `${res.first_name || ''} ${res.last_name || ''}`.trim() || 'Patient'}`,
          time: res.creation,
          reference_doctype: "Patient",
          reference_name: res.patient_id || String(res.id),
          user: res.owner || "",
        });
      }

      // Sort chronological newest first
      realActivity.sort((a, b) => {
        const timeA = a.time ? parseTimelineDate(a.time).getTime() : 0;
        const timeB = b.time ? parseTimelineDate(b.time).getTime() : 0;
        return timeB - timeA;
      });
      setActivity(realActivity);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { loadPatient(); }, [loadPatient]);

  const handleSave = async () => {
    if (!id) return;
    setSaving(true);
    try {
      await HealthcareApi.patients.update(Number(id), form);
      setPatient({ ...patient!, ...form } as Patient);
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  const [invoicing, setInvoicing] = useState(false);
  const handleInvoiceRegistration = async () => {
    if (!patient) return;
    setInvoicing(true);
    try {
      const res = await HealthcareApi.patients.invoiceRegistration(patient.id);
      alert(res.message || "Registration invoice created successfully");
      loadPatient();
    } catch (err: any) {
      alert(err?.message || "Failed to create registration invoice");
    } finally {
      setInvoicing(false);
    }
  };

  // Address modal state
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [addressForm, setAddressForm] = useState({
    address: "",
    city: "",
    state: "",
    country: "",
    pincode: "",
  });
  const [addressSaving, setAddressSaving] = useState(false);

  // Contact modal state
  const [showContactModal, setShowContactModal] = useState(false);
  const [contactForm, setContactForm] = useState({
    mobile: "",
    phone: "",
    email: "",
    report_preference: "Email",
  });
  const [contactSaving, setContactSaving] = useState(false);

  // Relations modal state
  const [showRelationModal, setShowRelationModal] = useState(false);
  const [editingRelationId, setEditingRelationId] = useState<number | null>(null);
  const [relationForm, setRelationForm] = useState({
    relation: "Spouse",
    related_patient: null as number | null,
    contact_name: "",
    contact_phone: "",
    description: "",
  });
  const [relationSaving, setRelationSaving] = useState(false);
  const [availablePatients, setAvailablePatients] = useState<Patient[]>([]);

  const handleOpenAddressModal = () => {
    setAddressForm({
      address: form.address || patient?.address || "",
      city: form.city || patient?.city || "",
      state: form.state || patient?.state || "",
      country: form.country || patient?.country || "",
      pincode: form.pincode || patient?.pincode || "",
    });
    setShowAddressModal(true);
  };

  const handleSaveAddress = async () => {
    if (!id) return;
    setAddressSaving(true);
    try {
      await HealthcareApi.patients.update(Number(id), addressForm);
      setForm((prev) => ({ ...prev, ...addressForm }));
      setPatient((prev) => (prev ? { ...prev, ...addressForm } : null));
      setShowAddressModal(false);
      toast.success("Patient address updated successfully");
    } catch (err: any) {
      const msg = err?.response?.data ? Object.values(err.response.data).flat().join(", ") : err?.message;
      toast.error(msg || "Failed to update address");
    } finally {
      setAddressSaving(false);
    }
  };

  const handleOpenContactModal = () => {
    setContactForm({
      mobile: form.mobile || patient?.mobile || "",
      phone: form.phone || patient?.phone || "",
      email: form.email || patient?.email || "",
      report_preference: form.report_preference || patient?.report_preference || "Email",
    });
    setShowContactModal(true);
  };

  const handleSaveContact = async () => {
    if (!id) return;
    setContactSaving(true);
    try {
      await HealthcareApi.patients.update(Number(id), contactForm);
      setForm((prev) => ({ ...prev, ...contactForm }));
      setPatient((prev) => (prev ? { ...prev, ...contactForm } : null));
      setShowContactModal(false);
      toast.success("Contact details updated successfully");
    } catch (err: any) {
      const msg = err?.response?.data ? Object.values(err.response.data).flat().join(", ") : err?.message;
      toast.error(msg || "Failed to update contact info");
    } finally {
      setContactSaving(false);
    }
  };

  const handleOpenRelationModal = (rel?: PatientRelation) => {
    if (rel) {
      setEditingRelationId(rel.id);
      setRelationForm({
        relation: rel.relation || "Spouse",
        related_patient: rel.related_patient || null,
        contact_name: rel.contact_name || "",
        contact_phone: rel.contact_phone || "",
        description: rel.description || "",
      });
    } else {
      setEditingRelationId(null);
      setRelationForm({
        relation: "Spouse",
        related_patient: null,
        contact_name: "",
        contact_phone: "",
        description: "",
      });
    }
    if (availablePatients.length === 0) {
      HealthcareApi.patients.list({ page_size: 200 }).then((res) => {
        setAvailablePatients((res.results || []).filter((p) => p.id !== Number(id)));
      }).catch(() => {});
    }
    setShowRelationModal(true);
  };

  const handleSaveRelation = async () => {
    if (!id) return;
    setRelationSaving(true);
    try {
      const payload: any = {
        patient: Number(id),
        relation: relationForm.relation,
        description: relationForm.description,
      };
      if (relationForm.related_patient) {
        payload.related_patient = relationForm.related_patient;
      }
      if (relationForm.contact_name) {
        payload.contact_name = relationForm.contact_name;
      }
      if (relationForm.contact_phone) {
        payload.contact_phone = relationForm.contact_phone;
      }

      if (editingRelationId) {
        await HealthcareApi.patientRelations.update(editingRelationId, payload);
      } else {
        await HealthcareApi.patientRelations.create(payload);
      }

      const relRes = (await HealthcareApi.patientRelations.list({ patient: id })) as any;
      setRelations(relRes.results || []);
      setShowRelationModal(false);
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.message || "Failed to save relation";
      alert(msg);
    } finally {
      setRelationSaving(false);
    }
  };

  const handleDeleteRelation = async (relId: number) => {
    if (!window.confirm("Remove this patient relation?")) return;
    try {
      await HealthcareApi.patientRelations.delete(relId);
      setRelations((prev) => prev.filter((r) => r.id !== relId));
    } catch (err: any) {
      alert("Failed to delete relation");
    }
  };

  const appendToField = (fieldName: string, text: string) => {
    setForm((prev) => {
      const current = (prev[fieldName] || "").trim();
      if (!current) return { ...prev, [fieldName]: text };
      if (current.includes(text)) return prev;
      return { ...prev, [fieldName]: `${current}, ${text}` };
    });
  };

  const handleCompleteServiceRequest = async (sr: ServiceRequest) => {
    setSrActionLoadingId(sr.id);
    try {
      await HealthcareApi.serviceRequests.complete(sr.id);
      toast.success(`Service Request "${sr.title || sr.request_id}" marked as completed.`);
      setPatientServiceRequests((prev) =>
        prev.map((item) => (item.id === sr.id ? { ...item, status: "Completed" } : item))
      );
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to complete service request.");
    } finally {
      setSrActionLoadingId(null);
    }
  };

  const handleToggleHoldServiceRequest = async (sr: ServiceRequest) => {
    setSrActionLoadingId(sr.id);
    const nextStatus = sr.status === "On Hold" ? "Active" : "On Hold";
    try {
      if (nextStatus === "Active") {
        await HealthcareApi.serviceRequests.activate(sr.id);
      } else {
        await HealthcareApi.serviceRequests.update(sr.id, { status: "On Hold" });
      }
      toast.success(`Service Request set to ${nextStatus}.`);
      setPatientServiceRequests((prev) =>
        prev.map((item) => (item.id === sr.id ? { ...item, status: nextStatus } : item))
      );
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to change status.");
    } finally {
      setSrActionLoadingId(null);
    }
  };

  const handleCancelServiceRequest = async (sr: ServiceRequest) => {
    if (!window.confirm(`Cancel service request "${sr.title || sr.request_id}"?`)) return;
    setSrActionLoadingId(sr.id);
    try {
      await HealthcareApi.serviceRequests.cancel(sr.id);
      toast.success("Service Request cancelled.");
      setPatientServiceRequests((prev) =>
        prev.map((item) => (item.id === sr.id ? { ...item, status: "Cancelled" } : item))
      );
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to cancel service request.");
    } finally {
      setSrActionLoadingId(null);
    }
  };

  const handleLaunchDownstream = (
    sr: ServiceRequest,
    actionType: "lab" | "procedure" | "therapy" | "sample" | "appointment"
  ) => {
    if (!patient) return;
    if (actionType === "lab") {
      navigate(
        `/healthcare/lab-tests/new?patient=${patient.id}&service_request=${sr.id}&template=${encodeURIComponent(
          sr.reference_name || sr.title || ""
        )}`
      );
    } else if (actionType === "procedure") {
      navigate(
        `/healthcare/clinical-procedures/new?patient=${patient.id}&service_request=${sr.id}&procedure=${encodeURIComponent(
          sr.reference_name || sr.title || ""
        )}`
      );
    } else if (actionType === "therapy") {
      setNewTherapySessionModalOpen(true);
    } else if (actionType === "sample") {
      navigate(
        `/healthcare/sample-collections/new?patient=${patient.id}&service_request=${sr.id}`
      );
    } else if (actionType === "appointment") {
      navigate(
        `/healthcare/appointments/new?patient=${patient.id}&service_request=${sr.id}`
      );
    }
  };

  const filteredMedicalRecords = useMemo(() => {
    return medicalRecords.filter((rec) => {
      const query = medicalRecordSearch.toLowerCase().trim();
      const matchesSearch = !query || 
        (rec.subject?.toLowerCase().includes(query)) ||
        (rec.content?.toLowerCase().includes(query)) ||
        (rec.reference_doctype?.toLowerCase().includes(query));
        
      if (!matchesSearch) return false;

      if (medicalRecordTypeFilter === "all") return true;
      if (medicalRecordTypeFilter === "encounters") return rec.reference_doctype?.toLowerCase().includes("encounter");
      if (medicalRecordTypeFilter === "vitals") return rec.reference_doctype?.toLowerCase().includes("vital");
      if (medicalRecordTypeFilter === "labs") return rec.reference_doctype?.toLowerCase().includes("lab");
      if (medicalRecordTypeFilter === "prescriptions") return rec.reference_doctype?.toLowerCase().includes("prescription") || rec.reference_doctype?.toLowerCase().includes("medication");
      if (medicalRecordTypeFilter === "appointments") return rec.reference_doctype?.toLowerCase().includes("appointment");
      return true;
    });
  }, [medicalRecords, medicalRecordSearch, medicalRecordTypeFilter]);

  const getLabTestResultDisplay = (lt: any) => {
    if (lt.normal_test_items && lt.normal_test_items.length > 0) {
      const filled = lt.normal_test_items.filter(
        (item: any) => item.result_value !== undefined && item.result_value !== null && String(item.result_value).trim() !== ""
      );
      if (filled.length > 0) {
        if (filled.length === 1) {
          const item = filled[0];
          const uom = item.lab_test_uom_name ? ` ${item.lab_test_uom_name}` : "";
          const range = item.normal_range ? ` (Normal: ${item.normal_range})` : "";
          return `${item.result_value}${uom}${range}`;
        }
        return filled.map((item: any) => {
          const name = item.lab_test_name || item.lab_test_event || "Result";
          const uom = item.lab_test_uom_name ? ` ${item.lab_test_uom_name}` : "";
          return `${name}: ${item.result_value}${uom}`;
        }).join("; ");
      }
    }

    if (lt.descriptive_test_items && lt.descriptive_test_items.length > 0) {
      const filled = lt.descriptive_test_items.filter((item: any) => item.result_value);
      if (filled.length > 0) {
        return filled.map((item: any) => `${item.lab_test_particulars}: ${item.result_value}`).join("; ");
      }
    }

    if (lt.result && String(lt.result).trim()) return lt.result;
    if (lt.descriptive_result && String(lt.descriptive_result).trim()) return lt.descriptive_result;
    if (lt.custom_result && String(lt.custom_result).trim()) return lt.custom_result;

    if (lt.status === "Approved") return "Approved (Normal)";
    if (lt.status === "Completed") return "Completed (Awaiting verification)";
    if (lt.status === "Rejected") return "Rejected";
    return "Pending Result";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Patient not found</p>
        <Button variant="outline" onClick={() => navigate("/healthcare/patients")} className="mt-4">Back to Patients</Button>
      </div>
    );
  }

  const isEEP = Boolean(
    (form.company_affiliation || patient.company_affiliation || "").includes("EEP") ||
    (form.eeu_staff_id || patient.eeu_staff_id || "").startsWith("EEP")
  );

  const isContractor = Boolean(
    (form.company_affiliation || patient.company_affiliation || "").includes("Contractor") ||
    (form.company_affiliation || patient.company_affiliation || "").includes("Other") ||
    (form.eeu_staff_id || patient.eeu_staff_id || "").startsWith("others")
  );

  const tabs: { key: Tab; label: string; icon: string; count?: number }[] = [
    { key: "details", label: "Details", icon: "solar:user-id-bold-duotone" },
    {
      key: "eeu",
      label: isEEP ? "EEP Staff Profile" : isContractor ? "Contractor Profile" : "EEU Staff Profile",
      icon: isEEP ? "solar:bolt-bold-duotone" : isContractor ? "solar:user-id-bold-duotone" : "solar:buildings-bold-duotone",
    },
    {
      key: "dashboard",
      label: "Dashboard",
      icon: "solar:chart-2-bold-duotone",
      count: txCounts.encounters + txCounts.appointments + txCounts.vitals,
    },
    {
      key: "diagnostics",
      label: "Lab & Diagnostics",
      icon: "solar:test-tube-bold-duotone",
      count: patientServiceRequests.length + patientLabs.length,
    },
    {
      key: "address",
      label: "Address & Contact",
      icon: "solar:map-point-bold-duotone",
      count: relations.length,
    },
    {
      key: "medical",
      label: "Medical History",
      icon: "solar:medical-kit-bold-duotone",
      count: medicalRecords.length || (form.allergies ? 1 : undefined),
    },
  ];

  const calculatedAge = formatAge(form.dob || patient.dob, patient.age);

  return (
    <div className="space-y-5">
      {/* ── Executive Patient Identity & Hero Banner ────────────────────────── */}
      <div className="rounded-2xl border bg-card p-5 shadow-2xs transition-all">
        {/* Breadcrumb line */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3 font-medium">
          <Icon icon="solar:home-bold-duotone" size={14} />
          <span>/</span>
          <span className="cursor-pointer hover:text-foreground transition-colors" onClick={() => navigate("/healthcare/patients")}>
            Patients
          </span>
          <span>/</span>
          <span className="font-semibold text-foreground">{patient.patient_name}</span>
          <span className="text-[10px] font-mono text-muted-foreground">({patient.patient_id || `PAT-${patient.id}`})</span>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          {/* Patient Profile Snapshot */}
          <div className="flex items-start sm:items-center gap-4">
            <Avatar
              name={patient.patient_name}
              fallback={getInitials(patient.patient_name || "PT", "PT")}
              size="2xl"
              tone={form.sex === "Female" ? "purple" : "blue"}
              className="ring-4 ring-background shadow-md shrink-0"
            />
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-foreground">
                  {patient.patient_name}
                </h1>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[11px] font-bold uppercase tracking-wider",
                    patient.status === "Active"
                      ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                      : "bg-muted text-muted-foreground border-border"
                  )}
                >
                  {patient.status || "Active"}
                </Badge>
                {patient.inpatient_status && (
                  <button
                    type="button"
                    onClick={() => setShowInpatientRecordsModal(true)}
                    className={cn(
                      "text-xs px-2.5 py-0.5 rounded-full font-bold cursor-pointer transition-all inline-flex items-center gap-1.5 shadow-2xs hover:scale-102",
                      patient.inpatient_status === "Admitted"
                        ? "bg-rose-500/15 text-rose-600 border border-rose-500/30"
                        : patient.inpatient_status === "Admission Scheduled"
                        ? "bg-amber-500/15 text-amber-600 border border-amber-500/30"
                        : "bg-blue-500/15 text-blue-600 border border-blue-500/30"
                    )}
                    title="Click to view Inpatient Records & Bed details"
                  >
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                    </span>
                    <Icon icon="solar:hospital-bold" size={13} />
                    <span>Inpatient: {patient.inpatient_status}</span>
                    {patient.inpatient_service_unit_name && (
                      <span className="font-semibold ml-0.5">· {patient.inpatient_service_unit_name}</span>
                    )}
                  </button>
                )}
              </div>

                {/* Clinical Quick Tags */}
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {(form.eeu_staff_id || patient.eeu_staff_id) && (
                  <span className={cn(
                    "inline-flex items-center gap-1 font-mono font-bold border px-2 py-0.5 rounded-md",
                    isEEP
                      ? "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30"
                      : isContractor
                      ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30"
                      : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                  )}>
                    <Icon icon={isEEP ? "solar:bolt-bold" : isContractor ? "solar:hammer-bold" : "solar:buildings-bold"} size={12} />
                    {isEEP ? "EEP" : isContractor ? "others" : "EEU"}: {form.eeu_staff_id || patient.eeu_staff_id}
                  </span>
                )}
                {(form.eeu_climbing_fitness_status || patient.eeu_climbing_fitness_status) && (
                  <span className="inline-flex items-center gap-1 font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-md">
                    <Icon icon="solar:shield-check-bold" size={12} />
                    {form.eeu_climbing_fitness_status || patient.eeu_climbing_fitness_status}
                  </span>
                )}
                <span className="inline-flex items-center gap-1 font-medium bg-muted/50 px-2 py-0.5 rounded-md border text-foreground/80">
                  <Icon icon="solar:user-bold-duotone" size={14} className="text-primary" />
                  {form.sex || patient.sex || "Gender Unspecified"}
                </span>
                <span className="inline-flex items-center gap-1 font-medium bg-muted/50 px-2 py-0.5 rounded-md border text-foreground/80">
                  <Icon icon="solar:calendar-date-bold-duotone" size={14} className="text-primary" />
                  {calculatedAge || (form.dob ? `DOB: ${form.dob}` : "DOB Not Set")}
                </span>
                {form.blood_group && (
                  <span className="inline-flex items-center gap-1 font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 px-2 py-0.5 rounded-md">
                    <Icon icon="solar:dropper-bold" size={12} />
                    Blood: {form.blood_group}
                  </span>
                )}
                {form.mobile && (
                  <a
                    href={`tel:${form.mobile}`}
                    className="inline-flex items-center gap-1 font-medium text-primary hover:underline bg-primary/5 px-2 py-0.5 rounded-md border border-primary/20"
                  >
                    <Icon icon="solar:phone-bold" size={12} />
                    {form.mobile}
                  </a>
                )}
                {form.allergies && (
                  <span className="inline-flex items-center gap-1 font-bold text-rose-700 dark:text-rose-300 bg-rose-500/15 border border-rose-500/30 px-2 py-0.5 rounded-md animate-pulse">
                    <Icon icon="solar:danger-triangle-bold" size={13} />
                    Allergies: {form.allergies.length > 30 ? `${form.allergies.slice(0, 30)}...` : form.allergies}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/healthcare/patients")}
              className="text-xs h-8 gap-1.5"
            >
              <Icon icon="solar:arrow-left-bold" size={14} />
              Back
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setActiveTab("dashboard")}
              className="text-xs h-8 gap-1.5 border-emerald-500/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10 font-semibold"
            >
              <Icon icon="solar:chart-2-bold" size={14} />
              Patient Progress
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowIdCardModal(true)}
              className="text-xs h-8 gap-1.5 border-amber-500/30 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10 font-semibold"
              title="View and print official EEU Digital Medical ID card"
            >
              <Icon icon="solar:user-id-bold-duotone" size={14} />
              EEU Medical ID
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleInvoiceRegistration}
              disabled={invoicing}
              className="text-xs h-8 gap-1.5 border-blue-500/30 text-blue-700 dark:text-blue-400 hover:bg-blue-500/10 font-semibold"
            >
              {invoicing ? (
                <Icon icon="solar:refresh-bold" className="animate-spin" size={14} />
              ) : (
                <Icon icon="solar:bill-list-bold" size={14} />
              )}
              {invoicing ? "Invoicing..." : "Invoice Registration"}
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving}
              className="text-xs h-8 gap-1.5 bg-primary text-primary-foreground font-bold shadow-xs hover:opacity-90"
            >
              {saving ? (
                <Icon icon="solar:refresh-bold" className="animate-spin" size={14} />
              ) : (
                <Icon icon="solar:check-read-bold" size={14} />
              )}
              {saving ? "Saving..." : "Save Patient"}
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Main Content */}
        <div className="flex-1 min-w-0 space-y-5">
          {/* ── Segmented Pill Tabs ─────────────────────────────────────── */}
          <div className="p-1.5 rounded-2xl bg-muted/40 border flex flex-wrap gap-1.5">
            {tabs.map((tab) => {
              const active = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    "flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer",
                    active
                      ? "bg-background text-foreground shadow-xs border border-border"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                  )}
                >
                  <Icon
                    icon={tab.icon}
                    size={16}
                    className={cn(active ? "text-primary" : "text-muted-foreground")}
                  />
                  <span>{tab.label}</span>
                  {tab.count !== undefined && tab.count > 0 && (
                    <span
                      className={cn(
                        "px-1.5 py-0.2 rounded-full text-[10px] font-bold font-mono transition-colors",
                        active
                          ? "bg-primary/10 text-primary"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* ── EEU STAFF PROFILE TAB ──────────────────────────────────── */}
          {activeTab === "eeu" && (
            <div className="space-y-5">
              <Card className={cn(
                "shadow-2xs overflow-hidden border",
                isEEP ? "border-sky-500/20" : "border-emerald-500/20"
              )}>
                <CardHeader className="pb-3 border-b bg-muted/15 flex flex-row items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className={cn(
                      "p-2 rounded-xl",
                      isEEP
                        ? "bg-sky-500/10 text-sky-600"
                        : isContractor
                        ? "bg-amber-500/10 text-amber-600"
                        : "bg-emerald-500/10 text-emerald-600"
                    )}>
                      <Icon
                        icon={isEEP ? "solar:bolt-bold-duotone" : isContractor ? "solar:hammer-bold-duotone" : "solar:buildings-bold-duotone"}
                        size={20}
                      />
                    </div>
                    <div>
                      <CardTitle className="text-sm font-bold">
                        {isEEP
                          ? "Ethiopian Electric Power (EEP) Occupational Record"
                          : isContractor
                          ? "Construction / Contractor / Other Occupational Record"
                          : "Ethiopian Electric Utility (EEU) Occupational Record"}
                      </CardTitle>
                      <CardDescription className="text-xs">
                        {isEEP
                          ? "Power generation station, dam project, 400kV transmission hub, and payroll links"
                          : isContractor
                          ? "Infrastructure contractor, subcontractor personnel, and occupational health records"
                          : "Official staff payroll ID, assigned regional station, job cadre, and medical benefits status"}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      type="button"
                      onClick={() => setShowIdCardModal(true)}
                      className={cn(
                        "h-8 text-xs gap-1.5 font-semibold",
                        isEEP
                          ? "border-sky-500/30 text-sky-700 dark:text-sky-400 hover:bg-sky-500/10"
                          : isContractor
                          ? "border-amber-500/30 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10"
                          : "border-emerald-500/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10"
                      )}
                    >
                      <Icon icon="solar:user-id-bold-duotone" size={15} />
                      Digital ID Badge & QR
                    </Button>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px] font-mono",
                        isEEP
                          ? "text-sky-600 border-sky-500/30"
                          : isContractor
                          ? "text-amber-600 border-amber-500/30"
                          : "text-emerald-600 border-emerald-500/30"
                      )}
                    >
                      {isEEP ? "EEP Health Services" : isContractor ? "Contractor Services" : "EEU Health Services"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-5 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                    <div>
                      <Label className="text-xs font-semibold text-foreground/80 mb-1 block">Corporate Employer</Label>
                      <select
                        className="w-full border rounded-lg px-3 py-2 text-xs bg-background h-9 focus:ring-2 focus:ring-primary/20 focus:outline-hidden"
                        value={form.company_affiliation || (isEEP ? "Ethiopian Electric Power (EEP)" : isContractor ? "Contractor / Other" : "Ethiopian Electric Utility (EEU)")}
                        onChange={(e) => {
                          const val = e.target.value;
                          const rawNum = (form.eeu_staff_id || "")
                            .replace(/^(EEU|EEP|others)-EMP-?/i, "")
                            .replace(/^(EEU|EEP|others)-/i, "")
                            .replace(/^EMP-?/i, "");
                          const prefix = val.includes("EEP")
                            ? "EEP-"
                            : (val.includes("Contractor") || val.includes("Other"))
                            ? "others-"
                            : "EEU-";
                          setForm({
                            ...form,
                            company_affiliation: val,
                            eeu_staff_id: rawNum ? `${prefix}${rawNum}` : "",
                            eeu_department: val.includes("EEP")
                              ? "Generation & Hydro Plants (GERD, Gibe, Tekeze, Fincha)"
                              : (val.includes("Contractor") || val.includes("Other"))
                              ? "Contractor & Project Infrastructure"
                              : "Distribution Directorate",
                          });
                        }}
                      >
                        <option value="Ethiopian Electric Utility (EEU)">Ethiopian Electric Utility (EEU)</option>
                        <option value="Ethiopian Electric Power (EEP)">Ethiopian Electric Power (EEP)</option>
                        <option value="Contractor / Other">Construction / Contractor / Other</option>
                      </select>
                    </div>
                    <div>
                      <Label className="text-xs font-semibold text-foreground/80 mb-1 flex items-center justify-between">
                        <span>{isEEP ? "EEP Staff / Payroll ID" : isContractor ? "Contractor ID" : "EEU Staff / Payroll ID"}</span>
                        <span className="text-[10px] text-muted-foreground font-normal">Digits only</span>
                      </Label>
                      <div className="flex rounded-lg shadow-2xs">
                        <span className={cn(
                          "inline-flex items-center px-3 rounded-l-lg border border-r-0 text-xs font-mono font-bold select-none",
                          isEEP
                            ? "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30"
                            : isContractor
                            ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30"
                            : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                        )}>
                          {isEEP ? "EEP-" : isContractor ? "others-" : "EEU-"}
                        </span>
                        <Input
                          className="rounded-l-none h-9 text-xs font-mono font-bold tracking-wider"
                          value={
                            (form.eeu_staff_id || "")
                              .replace(/^(EEU|EEP|others)-EMP-?/i, "")
                              .replace(/^(EEU|EEP|others)-/i, "")
                              .replace(/^EMP-?/i, "")
                          }
                          onChange={(e) => {
                            const rawDigits = e.target.value.replace(/[^0-9]/g, "");
                            const prefix = isEEP ? "EEP-" : isContractor ? "others-" : "EEU-";
                            setForm({
                              ...form,
                              eeu_staff_id: rawDigits ? `${prefix}${rawDigits}` : "",
                            });
                          }}
                          placeholder={isEEP ? "765767" : isContractor ? "578879" : "657854"}
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs font-semibold text-foreground/80 mb-1 block">Directorate / Department</Label>
                      <select
                        className="w-full border rounded-lg px-3 py-2 text-xs bg-background h-9 focus:ring-2 focus:ring-primary/20 focus:outline-hidden"
                        value={form.eeu_department || (isEEP ? "Generation & Hydro Plants (GERD, Gibe, Tekeze, Fincha)" : "Distribution Directorate")}
                        onChange={(e) => setForm({ ...form, eeu_department: e.target.value })}
                      >
                        {isEEP ? (
                          <>
                            <option value="Generation & Hydro Plants (GERD, Gibe, Tekeze, Fincha)">Generation & Hydro Plants (GERD, Gibe, Tekeze, Fincha)</option>
                            <option value="High-Voltage Transmission Grid Directorate (400kV / 500kV)">High-Voltage Transmission Grid Directorate (400kV / 500kV)</option>
                            <option value="Substation Automation, SCADA & Protection Directorate">Substation Automation, SCADA & Protection Directorate</option>
                            <option value="Dam & Project Operations (GERD / Gibe III / Tekeze)">Dam & Project Operations (GERD / Gibe III / Tekeze)</option>
                            <option value="Electro-Mechanical Engineering & Maintenance">Electro-Mechanical Engineering & Maintenance</option>
                            <option value="Wind & Geothermal Projects Directorate">Wind & Geothermal Projects Directorate</option>
                            <option value="Fleet, Heavy Machinery & Regional Logistics">Fleet, Heavy Machinery & Regional Logistics</option>
                            <option value="Corporate Human Resources & Administration">Corporate Human Resources & Administration</option>
                          </>
                        ) : (
                          <>
                            <option value="Distribution Directorate">Distribution Directorate</option>
                            <option value="Transmission Grid Directorate">Transmission Grid Directorate</option>
                            <option value="Generation & Hydro Plants">Generation & Hydro Plants</option>
                            <option value="Customer Services & Metering">Customer Services & Metering</option>
                            <option value="Inspection & Energy Loss Directorate">Inspection & Energy Loss Directorate</option>
                            <option value="Fleet, Logistics & Stores">Fleet, Logistics & Stores</option>
                            <option value="Human Resources & Administration">Human Resources & Administration</option>
                          </>
                        )}
                      </select>
                    </div>
                    <div>
                      <Label className="text-xs font-semibold text-foreground/80 mb-1 block">Cadre / Job Role</Label>
                      <Input
                        className="h-9 text-xs"
                        value={form.eeu_cadre || ""}
                        onChange={(e) => setForm({ ...form, eeu_cadre: e.target.value })}
                        placeholder={isEEP ? "e.g., Hydro Turbine Engineer" : "e.g., Senior Lineman"}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <Label className="text-xs font-semibold text-foreground/80 mb-1 block">EEU Region</Label>
                      <select
                        className="w-full border rounded-lg px-3 py-2 text-xs bg-background h-9 focus:ring-2 focus:ring-primary/20 focus:outline-hidden"
                        value={form.eeu_region || "Addis Ababa"}
                        onChange={(e) => setForm({ ...form, eeu_region: e.target.value })}
                      >
                        <option value="Addis Ababa">Addis Ababa</option>
                        <option value="Oromia">Oromia</option>
                        <option value="Amhara">Amhara</option>
                        <option value="Sidama">Sidama</option>
                        <option value="Somali">Somali</option>
                        <option value="Tigray">Tigray</option>
                        <option value="Dire Dawa">Dire Dawa</option>
                        <option value="South West Ethiopia">South West Ethiopia</option>
                        <option value="Central Ethiopia">Central Ethiopia</option>
                      </select>
                    </div>
                    <div>
                      <Label className="text-xs font-semibold text-foreground/80 mb-1 block">Specific Workstation / Substation</Label>
                      <Input
                        className="h-9 text-xs"
                        value={form.eeu_work_station || ""}
                        onChange={(e) => setForm({ ...form, eeu_work_station: e.target.value })}
                        placeholder="e.g. Kality 230kV Substation Bay 4"
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-semibold text-foreground/80 mb-1 block">Beneficiary Category</Label>
                      <select
                        className="w-full border rounded-lg px-3 py-2 text-xs bg-background h-9 focus:ring-2 focus:ring-primary/20 focus:outline-hidden"
                        value={form.eeu_beneficiary_type || "Staff"}
                        onChange={(e) => setForm({ ...form, eeu_beneficiary_type: e.target.value })}
                      >
                        <option value="Staff">{isEEP ? "EEP Primary Staff" : isContractor ? "Contractor Primary Personnel" : "EEU Primary Staff"}</option>
                        <option value="Spouse">Dependent Spouse</option>
                        <option value="Child">Dependent Child</option>
                        <option value="Dependent Parent">Dependent Parent</option>
                      </select>
                    </div>
                  </div>

                  {form.eeu_beneficiary_type && form.eeu_beneficiary_type !== "Staff" && (
                    <div className="p-3.5 rounded-xl border border-dashed bg-muted/20 space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-semibold text-foreground/80 flex items-center gap-1.5">
                          <Icon icon="solar:users-group-two-rounded-bold" size={14} className="text-primary" />
                          <span>Sponsor Staff / Primary Personnel ID</span>
                        </Label>
                        <span className="text-[10px] text-muted-foreground font-normal">Digits only</span>
                      </div>
                      <div className="flex rounded-lg shadow-2xs max-w-sm">
                        <span className={cn(
                          "inline-flex items-center px-3 rounded-l-lg border border-r-0 text-xs font-mono font-bold select-none",
                          isEEP
                            ? "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30"
                            : isContractor
                            ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30"
                            : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                        )}>
                          {isEEP ? "EEP-" : isContractor ? "others-" : "EEU-"}
                        </span>
                        <Input
                          className="rounded-l-none h-9 text-xs font-mono font-bold tracking-wider"
                          value={
                            (form.eeu_primary_staff_id || "")
                              .replace(/^(EEU|EEP|others)-EMP-?/i, "")
                              .replace(/^(EEU|EEP|others)-/i, "")
                              .replace(/^EMP-?/i, "")
                          }
                          onChange={(e) => {
                            const rawDigits = e.target.value.replace(/[^0-9]/g, "");
                            const prefix = isEEP ? "EEP-" : isContractor ? "others-" : "EEU-";
                            setForm({
                              ...form,
                              eeu_primary_staff_id: rawDigits ? `${prefix}${rawDigits}` : "",
                            });
                          }}
                          placeholder={isEEP ? "765767" : isContractor ? "578879" : "657854"}
                        />
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <Label className="text-xs font-semibold text-foreground/80 mb-1 block">Medical Scheme Status</Label>
                      <select
                        className="w-full border rounded-lg px-3 py-2 text-xs bg-background h-9 focus:ring-2 focus:ring-primary/20 focus:outline-hidden"
                        value={form.eeu_medical_coverage_status || "Active Coverage"}
                        onChange={(e) => setForm({ ...form, eeu_medical_coverage_status: e.target.value })}
                      >
                        <option value="Active Coverage">Active Coverage</option>
                        <option value="Special Approval">Special Approval</option>
                        <option value="Exceeded Ceiling">Exceeded Ceiling</option>
                        <option value="Suspended">Suspended</option>
                      </select>
                    </div>
                    <div>
                      <Label className="text-xs font-semibold text-foreground/80 mb-1 block">Climbing Fitness Status</Label>
                      <select
                        className="w-full border rounded-lg px-3 py-2 text-xs bg-background h-9 focus:ring-2 focus:ring-primary/20 focus:outline-hidden"
                        value={form.eeu_climbing_fitness_status || "Not Applicable"}
                        onChange={(e) => setForm({ ...form, eeu_climbing_fitness_status: e.target.value })}
                      >
                        <option value="Fit to Climb">Fit to Climb (Certified)</option>
                        <option value="Restricted Ground Duty">Restricted Ground Duty</option>
                        <option value="Temporarily Unfit">Temporarily Unfit</option>
                        <option value="Pending Annual Assessment">Pending Annual Assessment</option>
                        <option value="Not Applicable">Not Applicable</option>
                      </select>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2 border-t border-border/40 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => navigate("/healthcare/occupational/sick-leave-certificates")}
                      className="gap-1.5 text-xs text-amber-600 border-amber-500/30 hover:bg-amber-500/10"
                    >
                      <Icon icon="solar:document-add-bold" size={14} />
                      Issue Sick Leave Certificate
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => navigate("/healthcare/occupational/fitness-evaluations")}
                      className="gap-1.5 text-xs text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/10"
                    >
                      <Icon icon="solar:medal-ribbons-star-bold" size={14} />
                      Conduct Climbing Exam
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => navigate("/healthcare/occupational/incidents")}
                      className="gap-1.5 text-xs text-rose-600 border-rose-500/30 hover:bg-rose-500/10"
                    >
                      <Icon icon="solar:danger-triangle-bold" size={14} />
                      Report Workplace Incident
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* ── EEU MEDICAL BENEFIT UTILIZATION CARD (ETB Quota Tracker) ── */}
              {(() => {
                const ceilingEtb = Number(form.eeu_annual_benefit_ceiling_etb ?? patient.eeu_annual_benefit_ceiling_etb ?? 25000);
                const usedEtb = Number(form.eeu_benefit_used_etb ?? patient.eeu_benefit_used_etb ?? 0);
                const remainingEtb = Math.max(0, ceilingEtb - usedEtb);
                const quotaPct = Math.min(100, Math.round((usedEtb / (ceilingEtb || 1)) * 100));

                const barColor =
                  quotaPct >= 85
                    ? "bg-rose-500"
                    : quotaPct >= 60
                    ? "bg-amber-500"
                    : "bg-emerald-500";

                return (
                  <Card className="shadow-2xs overflow-hidden border-primary/30">
                    <CardHeader className="pb-3 border-b bg-muted/15 flex flex-row items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-primary/10 text-primary">
                          <Icon icon="solar:wallet-money-bold-duotone" size={20} />
                        </div>
                        <div>
                          <CardTitle className="text-sm font-bold">
                            EEU Annual Medical Benefit Quota & Allowance (ETB)
                          </CardTitle>
                          <CardDescription className="text-xs">
                            Annual healthcare ceiling per employee & dependents pool with cumulative claim tracking
                          </CardDescription>
                        </div>
                      </div>
                      <Badge
                        className={
                          quotaPct >= 85
                            ? "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                            : quotaPct >= 60
                            ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                            : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                        }
                      >
                        {quotaPct}% Quota Utilized
                      </Badge>
                    </CardHeader>
                    <CardContent className="p-5 space-y-5">
                      {/* Metric highlights */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                          <div className="text-[11px] font-medium text-muted-foreground">Annual Benefit Ceiling</div>
                          <div className="mt-1 font-mono text-xl font-bold text-foreground">
                            ETB {ceilingEtb.toLocaleString()}
                          </div>
                          <div className="text-[10px] text-muted-foreground">EEU Health Directorate policy</div>
                        </div>

                        <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                          <div className="text-[11px] font-medium text-muted-foreground">Accumulated Claims Used</div>
                          <div className="mt-1 font-mono text-xl font-bold text-foreground">
                            ETB {usedEtb.toLocaleString()}
                          </div>
                          <div className="text-[10px] text-muted-foreground">Prescriptions, labs & consultations</div>
                        </div>

                        <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                          <div className="text-[11px] font-medium text-muted-foreground">Available Quota Balance</div>
                          <div className={`mt-1 font-mono text-xl font-bold ${remainingEtb <= 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                            ETB {remainingEtb.toLocaleString()}
                          </div>
                          <div className="text-[10px] text-muted-foreground">Remaining for current fiscal year</div>
                        </div>
                      </div>

                      {/* Visual Progress Bar */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs">
                          <span className="font-semibold text-foreground/80">Allowance Depletion Progress</span>
                          <span className="font-mono text-muted-foreground">
                            {usedEtb.toLocaleString()} / {ceilingEtb.toLocaleString()} ETB ({quotaPct}%)
                          </span>
                        </div>
                        <div className="h-3 w-full overflow-hidden rounded-full bg-muted/60 p-0.5">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${barColor}`}
                            style={{ width: `${quotaPct}%` }}
                          />
                        </div>
                      </div>

                      {/* Alert banner if near ceiling */}
                      {quotaPct >= 85 && (
                        <div className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-700 dark:text-rose-300">
                          <Icon icon="solar:danger-triangle-bold" size={18} className="shrink-0 mt-0.5" />
                          <div>
                            <div className="font-bold">Medical Benefit Warning</div>
                            <div>
                              This beneficiary has consumed {quotaPct}% of their annual medical ceiling. Outpatient claims exceeding ETB {ceilingEtb.toLocaleString()} require official Directorate Special Approval.
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Quick Adjust Quota & Log Expense Form */}
                      <div className="rounded-xl border border-border/70 bg-card p-4 space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-foreground">Adjust Quota / Add Expense</span>
                          <span className="text-[11px] text-muted-foreground">Click "Save Patient" above to persist changes</span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <Label className="text-xs font-semibold text-foreground/80 mb-1 block">
                              Annual Benefit Ceiling (ETB)
                            </Label>
                            <div className="flex gap-2">
                              <Input
                                type="number"
                                className="h-9 text-xs font-mono"
                                value={form.eeu_annual_benefit_ceiling_etb ?? 25000}
                                onChange={(e) =>
                                  setForm({ ...form, eeu_annual_benefit_ceiling_etb: Number(e.target.value) })
                                }
                              />
                            </div>
                            <div className="mt-1 flex flex-wrap gap-1">
                              {[25000, 35000, 50000].map((preset) => (
                                <button
                                  key={preset}
                                  type="button"
                                  onClick={() => setForm({ ...form, eeu_annual_benefit_ceiling_etb: preset })}
                                  className="text-[10px] font-mono px-1.5 py-0.5 rounded border hover:bg-muted"
                                >
                                  {preset.toLocaleString()} ETB
                                </button>
                              ))}
                            </div>
                          </div>

                          <div>
                            <Label className="text-xs font-semibold text-foreground/80 mb-1 block">
                              Accumulated Used (ETB)
                            </Label>
                            <Input
                              type="number"
                              className="h-9 text-xs font-mono"
                              value={form.eeu_benefit_used_etb ?? 0}
                              onChange={(e) =>
                                setForm({ ...form, eeu_benefit_used_etb: Number(e.target.value) })
                              }
                            />
                            <div className="mt-1 flex flex-wrap gap-1">
                              {[250, 500, 1000, 2500].map((inc) => (
                                <button
                                  key={inc}
                                  type="button"
                                  onClick={() => {
                                    const current = Number(form.eeu_benefit_used_etb ?? patient.eeu_benefit_used_etb ?? 0);
                                    setForm({ ...form, eeu_benefit_used_etb: current + inc });
                                  }}
                                  className="text-[10px] font-mono px-1.5 py-0.5 rounded border hover:bg-muted text-primary"
                                >
                                  +{inc.toLocaleString()} ETB
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })()}
            </div>
          )}

          {/* ── DETAILS TAB ───────────────────────────────────────────── */}
          {activeTab === "details" && (
            <div className="space-y-5">
              {/* Card 1: Core Bio & Identity Demographics */}
              <Card className="shadow-2xs overflow-hidden">
                <CardHeader className="pb-3 border-b bg-muted/15 flex flex-row items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-primary/10 text-primary">
                      <Icon icon="solar:user-id-bold-duotone" size={20} />
                    </div>
                    <div>
                      <CardTitle className="text-sm font-bold">Patient Identity & Legal Demographics</CardTitle>
                      <CardDescription className="text-xs">
                        Official identification, legal names, date of birth, biological metrics, and notification preferences.
                      </CardDescription>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[10px] font-mono">
                    MRN: {patient.patient_id || `PAT-${patient.id}`}
                  </Badge>
                </CardHeader>
                <CardContent className="p-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* First Name */}
                    <div>
                      <Label className="text-xs font-semibold text-foreground/80 mb-1 block">First Name *</Label>
                      <Input
                        value={form.first_name || ""}
                        onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                        placeholder="Given Name"
                        className="h-9 text-xs"
                      />
                    </div>

                    {/* Middle Name */}
                    <div>
                      <Label className="text-xs font-semibold text-foreground/80 mb-1 block">Middle Name</Label>
                      <Input
                        value={form.middle_name || ""}
                        onChange={(e) => setForm({ ...form, middle_name: e.target.value })}
                        placeholder="Middle Name (optional)"
                        className="h-9 text-xs"
                      />
                    </div>

                    {/* Last Name */}
                    <div>
                      <Label className="text-xs font-semibold text-foreground/80 mb-1 block">Last Name</Label>
                      <Input
                        value={form.last_name || ""}
                        onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                        placeholder="Family Name"
                        className="h-9 text-xs"
                      />
                    </div>

                    {/* Full Name Display */}
                    <div>
                      <Label className="text-xs font-semibold text-foreground/80 mb-1 block">Full Registered Name</Label>
                      <Input
                        value={patient.patient_name || ""}
                        disabled
                        className="h-9 text-xs bg-muted/50 font-medium"
                      />
                    </div>

                    {/* UID / National ID */}
                    <div>
                      <Label className="text-xs font-semibold text-foreground/80 mb-1 block">Identification Number (UID)</Label>
                      <Input
                        value={form.uid || ""}
                        onChange={(e) => setForm({ ...form, uid: e.target.value })}
                        placeholder="National ID / Passport No."
                        className="h-9 text-xs"
                      />
                    </div>

                    {/* Gender */}
                    <div>
                      <Label className="text-xs font-semibold text-foreground/80 mb-1 block">Gender *</Label>
                      <select
                        className="w-full h-9 px-3 rounded-lg border bg-background text-xs text-foreground focus:ring-1 focus:ring-primary focus:outline-none"
                        value={form.sex || "Male"}
                        onChange={(e) => setForm({ ...form, sex: e.target.value })}
                      >
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                      </select>
                    </div>

                    {/* DOB & Live Age */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <Label className="text-xs font-semibold text-foreground/80">Date of Birth</Label>
                        {calculatedAge && (
                          <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.2 rounded">
                            {calculatedAge}
                          </span>
                        )}
                      </div>
                      <Input
                        type="date"
                        value={form.dob || ""}
                        onChange={(e) => setForm({ ...form, dob: e.target.value })}
                        className="h-9 text-xs"
                      />
                    </div>

                    {/* Blood Group */}
                    <div>
                      <Label className="text-xs font-semibold text-foreground/80 mb-1 block">Blood Group</Label>
                      <select
                        className="w-full h-9 px-3 rounded-lg border bg-background text-xs text-foreground focus:ring-1 focus:ring-primary focus:outline-none"
                        value={form.blood_group || ""}
                        onChange={(e) => setForm({ ...form, blood_group: e.target.value })}
                      >
                        <option value="">Unknown / Not Tested</option>
                        {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((bg) => (
                          <option key={bg} value={bg}>
                            {bg}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Status */}
                    <div>
                      <Label className="text-xs font-semibold text-foreground/80 mb-1 block">Patient Status</Label>
                      <select
                        className="w-full h-9 px-3 rounded-lg border bg-background text-xs text-foreground focus:ring-1 focus:ring-primary focus:outline-none"
                        value={form.status || "Active"}
                        onChange={(e) => setForm({ ...form, status: e.target.value })}
                      >
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                        <option value="Deceased">Deceased</option>
                        <option value="Suspended">Suspended</option>
                      </select>
                    </div>

                    {/* Mobile Phone */}
                    <div>
                      <Label className="text-xs font-semibold text-foreground/80 mb-1 block">Primary Mobile Phone</Label>
                      <Input
                        value={form.mobile || ""}
                        onChange={(e) => setForm({ ...form, mobile: e.target.value })}
                        placeholder="+1 (555) 000-0000"
                        className="h-9 text-xs"
                      />
                    </div>

                    {/* Secondary Phone */}
                    <div>
                      <Label className="text-xs font-semibold text-foreground/80 mb-1 block">Landline / Alternate Phone</Label>
                      <Input
                        value={form.phone || ""}
                        onChange={(e) => setForm({ ...form, phone: e.target.value })}
                        placeholder="Home / Work Phone"
                        className="h-9 text-xs"
                      />
                    </div>

                    {/* Email */}
                    <div>
                      <Label className="text-xs font-semibold text-foreground/80 mb-1 block">Email Address</Label>
                      <Input
                        type="email"
                        value={form.email || ""}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                        placeholder="patient@example.com"
                        className="h-9 text-xs"
                      />
                    </div>

                    {/* Report Delivery Preference */}
                    <div>
                      <Label className="text-xs font-semibold text-foreground/80 mb-1 block">Report Delivery Preference</Label>
                      <select
                        className="w-full h-9 px-3 rounded-lg border bg-background text-xs text-foreground focus:ring-1 focus:ring-primary focus:outline-none"
                        value={(form as any).report_preference || "Email"}
                        onChange={(e) => setForm({ ...form, report_preference: e.target.value } as any)}
                      >
                        <option value="Email">Email</option>
                        <option value="Pdf">PDF Download</option>
                        <option value="Print">Physical Print</option>
                      </select>
                    </div>

                    {/* User Invitation */}
                    <div className="flex items-center gap-2.5 pt-6">
                      <input
                        type="checkbox"
                        id="inviteUser"
                        checked={Boolean((patient as any).user_id)}
                        disabled
                        className="rounded border-muted text-primary focus:ring-primary h-4 w-4"
                      />
                      <label htmlFor="inviteUser" className="text-xs font-medium text-foreground select-none">
                        Patient Portal User Account {(patient as any).user_id ? "(Active)" : "(Unlinked)"}
                      </label>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Card 2: Financial Account & Customer Classification */}
              <Card className="shadow-2xs overflow-hidden">
                <CardHeader className="pb-3 border-b bg-muted/15 flex flex-row items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600">
                      <Icon icon="solar:wallet-money-bold-duotone" size={20} />
                    </div>
                    <div>
                      <CardTitle className="text-sm font-bold">Customer Account & Commercial Billing</CardTitle>
                      <CardDescription className="text-xs">
                        Patient account synchronization, tariff price lists, commercial billing terms, and insurance coverage.
                      </CardDescription>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[10px] font-mono">
                    Customer Linkage
                  </Badge>
                </CardHeader>
                <CardContent className="p-5">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label className="text-xs font-semibold text-foreground/80 mb-1 block">Customer Group</Label>
                      <Input
                        value={form.customer_group || ""}
                        onChange={(e) => setForm({ ...form, customer_group: e.target.value })}
                        placeholder="All Customers / Commercial / Insurance"
                        className="h-9 text-xs"
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-semibold text-foreground/80 mb-1 block">Sales Territory</Label>
                      <Input
                        value={form.territory || ""}
                        onChange={(e) => setForm({ ...form, territory: e.target.value })}
                        placeholder="All Territories / Local Region"
                        className="h-9 text-xs"
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-semibold text-foreground/80 mb-1 block">Default Price List</Label>
                      <Input
                        value={form.default_price_list || ""}
                        onChange={(e) => setForm({ ...form, default_price_list: e.target.value })}
                        placeholder="Standard Selling / OPD Tariff"
                        className="h-9 text-xs"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Card 3: Clinical Intake Background & General Observations */}
              <Card className="shadow-2xs overflow-hidden">
                <CardHeader className="pb-3 border-b bg-muted/15 flex flex-row items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600">
                      <Icon icon="solar:document-text-bold-duotone" size={20} />
                    </div>
                    <div>
                      <CardTitle className="text-sm font-bold">Clinical Intake & Context Notes</CardTitle>
                      <CardDescription className="text-xs">
                        Baseline intake observations, clinical history summaries, and special care handling directives.
                      </CardDescription>
                    </div>
                  </div>

                  {/* 1-Click Template Chips */}
                  <div className="flex items-center gap-1.5 overflow-x-auto text-xs">
                    <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mr-1">
                      Quick Templates:
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setForm((p) => ({
                          ...p,
                          patient_details:
                            "Adult patient presents for routine health baseline assessment. Full systemic review unremarkable. No prior adverse reactions or hospitalizations noted.",
                        }))
                      }
                      className="px-2 py-1 rounded-md bg-muted hover:bg-primary/10 hover:text-primary transition-colors text-[11px] font-medium"
                    >
                      Routine Adult
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setForm((p) => ({
                          ...p,
                          patient_details:
                            "Chronic care intake. Patient tracked for ongoing outpatient maintenance. Baseline functional status independent. Regular laboratory surveillance indicated.",
                        }))
                      }
                      className="px-2 py-1 rounded-md bg-muted hover:bg-primary/10 hover:text-primary transition-colors text-[11px] font-medium"
                    >
                      Chronic Tracking
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setForm((p) => ({
                          ...p,
                          patient_details:
                            "Pediatric intake. Developmental milestones on track. Immunization card verified up to date. Accompanied by parent/legal guardian.",
                        }))
                      }
                      className="px-2 py-1 rounded-md bg-muted hover:bg-primary/10 hover:text-primary transition-colors text-[11px] font-medium"
                    >
                      Pediatric Baseline
                    </button>
                  </div>
                </CardHeader>
                <CardContent className="p-5">
                  <textarea
                    rows={4}
                    className="w-full p-3 rounded-xl border bg-background text-xs text-foreground placeholder:text-muted-foreground/60 focus:ring-1 focus:ring-primary focus:outline-none resize-y min-h-[100px]"
                    value={(form as any).patient_details || ""}
                    onChange={(e) => setForm({ ...form, patient_details: e.target.value } as any)}
                    placeholder="Enter any additional background information, clinical observations, or special care directives regarding this patient..."
                  />
                </CardContent>
              </Card>
            </div>
          )}

          {/* ── DASHBOARD TAB ─────────────────────────────────────────── */}
          {activeTab === "dashboard" && (
            <div className="space-y-6">
              {/* Active Inpatient Banner (Marley Parity) */}
              {(() => {
                const activeRecord = patientInpatients.find((r) =>
                  ["Admission Scheduled", "Admitted", "Discharge Scheduled"].includes(r.status)
                );
                if (!activeRecord) return null;
                return (
                  <ActiveInpatientBanner
                    record={activeRecord}
                    patientId={patient.id}
                    patientName={patient.patient_name}
                    onRefresh={loadPatient}
                    onViewAll={() => setShowInpatientRecordsModal(true)}
                  />
                );
              })()}

              {/* ── Executive Clinical KPI Scorecards ────────────────────────── */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {/* Encounters */}
                <div
                  onClick={() => navigate(`/healthcare/encounters?patient=${id}`)}
                  className="p-3.5 rounded-xl border bg-card hover:border-emerald-500/50 hover:shadow-2xs transition-all cursor-pointer group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                      Encounters
                    </span>
                    <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 group-hover:scale-110 transition-transform">
                      <Icon icon="solar:clipboard-text-bold-duotone" size={16} />
                    </div>
                  </div>
                  <div className="mt-2 flex items-baseline gap-1.5">
                    <span className="text-xl font-black text-foreground">{txCounts.encounters}</span>
                    <span className="text-[10px] text-muted-foreground">visits</span>
                  </div>
                </div>

                {/* Appointments */}
                <div
                  onClick={() => navigate(`/healthcare/appointments?patient=${id}`)}
                  className="p-3.5 rounded-xl border bg-card hover:border-blue-500/50 hover:shadow-2xs transition-all cursor-pointer group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                      Appts
                    </span>
                    <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-600 group-hover:scale-110 transition-transform">
                      <Icon icon="solar:calendar-bold-duotone" size={16} />
                    </div>
                  </div>
                  <div className="mt-2 flex items-baseline gap-1.5">
                    <span className="text-xl font-black text-foreground">{txCounts.appointments}</span>
                    <span className="text-[10px] text-muted-foreground">booked</span>
                  </div>
                </div>

                {/* Vitals */}
                <div
                  onClick={() => navigate(`/healthcare/vital-signs?patient=${id}`)}
                  className="p-3.5 rounded-xl border bg-card hover:border-rose-500/50 hover:shadow-2xs transition-all cursor-pointer group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                      Vitals
                    </span>
                    <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-600 group-hover:scale-110 transition-transform">
                      <Icon icon="solar:heart-pulse-bold-duotone" size={16} />
                    </div>
                  </div>
                  <div className="mt-2 flex items-baseline gap-1.5">
                    <span className="text-xl font-black text-foreground">{txCounts.vitals}</span>
                    <span className="text-[10px] text-muted-foreground">logs</span>
                  </div>
                </div>

                {/* Medications */}
                <div
                  onClick={() => navigate(`/healthcare/pharmacy/medication-requests?patient=${id}`)}
                  className="p-3.5 rounded-xl border bg-card hover:border-purple-500/50 hover:shadow-2xs transition-all cursor-pointer group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                      Med Orders
                    </span>
                    <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-600 group-hover:scale-110 transition-transform">
                      <Icon icon="solar:pills-bold-duotone" size={16} />
                    </div>
                  </div>
                  <div className="mt-2 flex items-baseline gap-1.5">
                    <span className="text-xl font-black text-foreground">
                      {txCounts.medicationRequests + txCounts.prescriptions}
                    </span>
                    <span className="text-[10px] text-muted-foreground">Rx</span>
                  </div>
                </div>

                {/* Labs & Diagnostics */}
                <div
                  onClick={() => setActiveTab("diagnostics")}
                  className="p-3.5 rounded-xl border bg-card hover:border-cyan-500/50 hover:shadow-2xs transition-all cursor-pointer group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                      Diagnostics
                    </span>
                    <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-600 group-hover:scale-110 transition-transform">
                      <Icon icon="solar:flask-bold-duotone" size={16} />
                    </div>
                  </div>
                  <div className="mt-2 flex items-baseline gap-1.5">
                    <span className="text-xl font-black text-foreground">
                      {txCounts.labTests + txCounts.serviceRequests}
                    </span>
                    <span className="text-[10px] text-muted-foreground">tests</span>
                  </div>
                </div>

                {/* Inpatient Stays */}
                <div
                  onClick={() => setShowInpatientRecordsModal(true)}
                  className="p-3.5 rounded-xl border bg-card hover:border-indigo-500/50 hover:shadow-2xs transition-all cursor-pointer group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                      Inpatient
                    </span>
                    <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-600 group-hover:scale-110 transition-transform">
                      <Icon icon="solar:hospital-bold-duotone" size={16} />
                    </div>
                  </div>
                  <div className="mt-2 flex items-baseline gap-1.5">
                    <span className="text-xl font-black text-foreground">{txCounts.inpatient}</span>
                    <span className="text-[10px] text-muted-foreground">stays</span>
                  </div>
                </div>
              </div>

              {/* Activity Heatmap (Marley 7-day vertical × 52-week horizontal calendar) */}
              <ActivityHeatmap
                activity={activity}
                title="Clinical Activity Heatmap"
                message="Visual transactional volume recorded against this patient across consultations, vitals, diagnostics, and prescriptions."
              />

              {/* ── Interactive Clinical Action Center ─────────────────────── */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. Consultations & Outpatient Visits */}
                <Card className="shadow-2xs overflow-hidden">
                  <CardHeader className="pb-3 border-b bg-muted/15 flex flex-row items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600">
                        <Icon icon="solar:stethoscope-bold-duotone" size={18} />
                      </div>
                      <CardTitle className="text-xs font-bold">Consultations & Outpatient Care</CardTitle>
                    </div>
                    <Badge variant="outline" className="text-[10px]">
                      {txCounts.encounters + txCounts.appointments} Records
                    </Badge>
                  </CardHeader>
                  <CardContent className="p-3.5 space-y-2">
                    {/* Patient Appointment */}
                    <div className="flex items-center justify-between p-2 rounded-lg border bg-background hover:border-blue-400 transition-colors">
                      <div
                        className="flex items-center gap-2 cursor-pointer flex-1"
                        onClick={() => navigate(`/healthcare/appointments?patient=${id}`)}
                      >
                        <Icon icon="solar:calendar-bold-duotone" size={16} className="text-blue-500" />
                        <div>
                          <div className="text-xs font-semibold text-foreground">Patient Appointments</div>
                          <div className="text-[10px] text-muted-foreground">{txCounts.appointments} Scheduled bookings</div>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigate(`/healthcare/appointments/new?patient=${id}`)}
                        className="h-7 text-[11px] gap-1 px-2 border-blue-500/30 text-blue-600 hover:bg-blue-500/10"
                      >
                        <Icon icon="solar:add-circle-bold" size={12} />
                        Book
                      </Button>
                    </div>

                    {/* Patient Encounter */}
                    <div className="flex items-center justify-between p-2 rounded-lg border bg-background hover:border-emerald-400 transition-colors">
                      <div
                        className="flex items-center gap-2 cursor-pointer flex-1"
                        onClick={() => navigate(`/healthcare/encounters?patient=${id}`)}
                      >
                        <Icon icon="solar:clipboard-text-bold-duotone" size={16} className="text-emerald-500" />
                        <div>
                          <div className="text-xs font-semibold text-foreground">Clinical Encounters</div>
                          <div className="text-[10px] text-muted-foreground">{txCounts.encounters} Outpatient consultations</div>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigate(`/healthcare/encounters/new?patient=${id}`)}
                        className="h-7 text-[11px] gap-1 px-2 border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10"
                      >
                        <Icon icon="solar:add-circle-bold" size={12} />
                        Start
                      </Button>
                    </div>

                    {/* Vital Signs */}
                    <div className="flex items-center justify-between p-2 rounded-lg border bg-background hover:border-rose-400 transition-colors">
                      <div
                        className="flex items-center gap-2 cursor-pointer flex-1"
                        onClick={() => navigate(`/healthcare/vital-signs?patient=${id}`)}
                      >
                        <Icon icon="solar:heart-pulse-bold-duotone" size={16} className="text-rose-500" />
                        <div>
                          <div className="text-xs font-semibold text-foreground">Vital Signs Measurements</div>
                          <div className="text-[10px] text-muted-foreground">{txCounts.vitals} Vitals captured</div>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigate(`/healthcare/vital-signs/new?patient=${id}`)}
                        className="h-7 text-[11px] gap-1 px-2 border-rose-500/30 text-rose-600 hover:bg-rose-500/10"
                      >
                        <Icon icon="solar:add-circle-bold" size={12} />
                        Log Vitals
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* 2. Diagnostics & Pathology */}
                <Card className="shadow-2xs overflow-hidden">
                  <CardHeader className="pb-3 border-b bg-muted/15 flex flex-row items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-600">
                        <Icon icon="solar:flask-bold-duotone" size={18} />
                      </div>
                      <CardTitle className="text-xs font-bold">Diagnostic Investigations & Pathology</CardTitle>
                    </div>
                    <Badge variant="outline" className="text-[10px]">
                      {txCounts.serviceRequests + txCounts.labTests} Tests
                    </Badge>
                  </CardHeader>
                  <CardContent className="p-3.5 space-y-2">
                    {/* Service Request */}
                    <div className="flex items-center justify-between p-2 rounded-lg border bg-background hover:border-indigo-400 transition-colors">
                      <div
                        className="flex items-center gap-2 cursor-pointer flex-1"
                        onClick={() => navigate(`/healthcare/service-requests?patient=${id}`)}
                      >
                        <Icon icon="solar:clipboard-check-bold-duotone" size={16} className="text-indigo-600" />
                        <div>
                          <div className="text-xs font-semibold text-foreground">Service Requests (Orders)</div>
                          <div className="text-[10px] text-muted-foreground">{txCounts.serviceRequests} Diagnostic requisitions</div>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigate(`/healthcare/service-requests/new?patient=${id}`)}
                        className="h-7 text-[11px] gap-1 px-2 border-indigo-500/30 text-indigo-600 hover:bg-indigo-500/10"
                      >
                        <Icon icon="solar:add-circle-bold" size={12} />
                        Order
                      </Button>
                    </div>

                    {/* Lab Test */}
                    <div className="flex items-center justify-between p-2 rounded-lg border bg-background hover:border-purple-400 transition-colors">
                      <div
                        className="flex items-center gap-2 cursor-pointer flex-1"
                        onClick={() => navigate(`/healthcare/lab-tests?patient=${id}`)}
                      >
                        <Icon icon="solar:flask-bold-duotone" size={16} className="text-purple-500" />
                        <div>
                          <div className="text-xs font-semibold text-foreground">Laboratory Tests</div>
                          <div className="text-[10px] text-muted-foreground">{txCounts.labTests} Prescribed assays</div>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigate(`/healthcare/lab-tests/new?patient=${id}`)}
                        className="h-7 text-[11px] gap-1 px-2 border-purple-500/30 text-purple-600 hover:bg-purple-500/10"
                      >
                        <Icon icon="solar:add-circle-bold" size={12} />
                        Create
                      </Button>
                    </div>

                    {/* Sample Collection */}
                    <div className="flex items-center justify-between p-2 rounded-lg border bg-background hover:border-cyan-400 transition-colors">
                      <div
                        className="flex items-center gap-2 cursor-pointer flex-1"
                        onClick={() => navigate(`/healthcare/sample-collections?patient=${id}`)}
                      >
                        <Icon icon="solar:test-tube-add-bold" size={16} className="text-cyan-500" />
                        <div>
                          <div className="text-xs font-semibold text-foreground">Sample Collections</div>
                          <div className="text-[10px] text-muted-foreground">{txCounts.sampleCollections} Phlebotomy specimens</div>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigate(`/healthcare/sample-collections/new?patient=${id}`)}
                        className="h-7 text-[11px] gap-1 px-2 border-cyan-500/30 text-cyan-600 hover:bg-cyan-500/10"
                      >
                        <Icon icon="solar:add-circle-bold" size={12} />
                        Collect
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* 3. Rehab & Physiotherapy */}
                <Card className="shadow-2xs overflow-hidden">
                  <CardHeader className="pb-3 border-b bg-muted/15 flex flex-row items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-teal-500/10 text-teal-600">
                        <Icon icon="solar:meditation-bold-duotone" size={18} />
                      </div>
                      <CardTitle className="text-xs font-bold">Rehabilitation & Therapy</CardTitle>
                    </div>
                    <Badge variant="outline" className="text-[10px]">
                      {txCounts.therapyPlans + txCounts.therapySessions} Sessions
                    </Badge>
                  </CardHeader>
                  <CardContent className="p-3.5 space-y-2">
                    {/* Therapy Plan */}
                    <div className="flex items-center justify-between p-2 rounded-lg border bg-background hover:border-teal-400 transition-colors">
                      <div
                        className="flex items-center gap-2 cursor-pointer flex-1"
                        onClick={() => navigate(`/healthcare/therapy?patient=${id}`)}
                      >
                        <Icon icon="solar:meditation-bold-duotone" size={16} className="text-teal-600" />
                        <div>
                          <div className="text-xs font-semibold text-foreground">Therapy Plans</div>
                          <div className="text-[10px] text-muted-foreground">{txCounts.therapyPlans} Rehabilitation protocols</div>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setNewTherapyPlanModalOpen(true)}
                        className="h-7 text-[11px] gap-1 px-2 border-teal-500/30 text-teal-600 hover:bg-teal-500/10"
                      >
                        <Icon icon="solar:add-circle-bold" size={12} />
                        New Plan
                      </Button>
                    </div>

                    {/* Therapy Session */}
                    <div className="flex items-center justify-between p-2 rounded-lg border bg-background hover:border-teal-400 transition-colors">
                      <div
                        className="flex items-center gap-2 cursor-pointer flex-1"
                        onClick={() => navigate(`/healthcare/therapy?patient=${id}&tab=sessions`)}
                      >
                        <Icon icon="solar:stopwatch-bold-duotone" size={16} className="text-teal-600" />
                        <div>
                          <div className="text-xs font-semibold text-foreground">Therapy Sessions</div>
                          <div className="text-[10px] text-muted-foreground">{txCounts.therapySessions} Logged sessions</div>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setNewTherapySessionModalOpen(true)}
                        className="h-7 text-[11px] gap-1 px-2 border-teal-500/30 text-teal-600 hover:bg-teal-500/10"
                      >
                        <Icon icon="solar:add-circle-bold" size={12} />
                        Log Session
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* 4. Pharmacy & Inpatient Wards */}
                <Card className="shadow-2xs overflow-hidden">
                  <CardHeader className="pb-3 border-b bg-muted/15 flex flex-row items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-600">
                        <Icon icon="solar:hospital-bold-duotone" size={18} />
                      </div>
                      <CardTitle className="text-xs font-bold">Pharmacy & Hospitalization</CardTitle>
                    </div>
                    <Badge variant="outline" className="text-[10px]">
                      {txCounts.medicationRequests + txCounts.inpatient} Active
                    </Badge>
                  </CardHeader>
                  <CardContent className="p-3.5 space-y-2">
                    {/* Medication Request */}
                    <div className="flex items-center justify-between p-2 rounded-lg border bg-background hover:border-rose-400 transition-colors">
                      <div
                        className="flex items-center gap-2 cursor-pointer flex-1"
                        onClick={() => navigate(`/healthcare/pharmacy/medication-requests?patient=${id}`)}
                      >
                        <Icon icon="solar:pills-bold-duotone" size={16} className="text-rose-500" />
                        <div>
                          <div className="text-xs font-semibold text-foreground">Medication Requests (Rx)</div>
                          <div className="text-[10px] text-muted-foreground">{txCounts.medicationRequests} Pharmacy orders</div>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigate(`/healthcare/pharmacy/medication-requests/new?patient=${id}`)}
                        className="h-7 text-[11px] gap-1 px-2 border-rose-500/30 text-rose-600 hover:bg-rose-500/10"
                      >
                        <Icon icon="solar:add-circle-bold" size={12} />
                        Prescribe
                      </Button>
                    </div>

                    {/* Inpatient Admission */}
                    <div className="flex items-center justify-between p-2 rounded-lg border bg-background hover:border-indigo-400 transition-colors">
                      <div
                        className="flex items-center gap-2 cursor-pointer flex-1"
                        onClick={() => setShowInpatientRecordsModal(true)}
                      >
                        <Icon icon="solar:hospital-bold-duotone" size={16} className="text-indigo-600" />
                        <div>
                          <div className="text-xs font-semibold text-foreground">Inpatient Admissions & Beds</div>
                          <div className="text-[10px] text-muted-foreground">{txCounts.inpatient} Ward records</div>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setShowAdmissionModal(true)}
                        className="h-7 text-[11px] gap-1 px-2 border-indigo-500/30 text-indigo-600 hover:bg-indigo-500/10"
                      >
                        <Icon icon="solar:add-circle-bold" size={12} />
                        Admit
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* ── LAB & DIAGNOSTICS TAB ─────────────────────────────────── */}
          {activeTab === "diagnostics" && (
            <div className="space-y-5">
              {/* ── Diagnostics KPI Summary Bar ─────────────────────────────── */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl border bg-card shadow-2xs">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="text-[10px] font-bold uppercase tracking-wider">Total Diagnostic Orders</span>
                    <Icon icon="solar:test-tube-bold-duotone" size={16} className="text-primary" />
                  </div>
                  <div className="mt-1.5 text-xl font-black text-foreground">
                    {patientServiceRequests.length + patientLabs.length}
                  </div>
                </div>

                <div className="p-3 rounded-xl border bg-card shadow-2xs">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="text-[10px] font-bold uppercase tracking-wider">Service Requests</span>
                    <Icon icon="solar:clipboard-check-bold-duotone" size={16} className="text-indigo-600" />
                  </div>
                  <div className="mt-1.5 text-xl font-black text-foreground">
                    {patientServiceRequests.length}
                  </div>
                </div>

                <div className="p-3 rounded-xl border bg-card shadow-2xs">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="text-[10px] font-bold uppercase tracking-wider">Laboratory Tests</span>
                    <Icon icon="solar:flask-bold-duotone" size={16} className="text-cyan-600" />
                  </div>
                  <div className="mt-1.5 text-xl font-black text-foreground">
                    {patientLabs.length}
                  </div>
                </div>

                <div className="p-3 rounded-xl border bg-card shadow-2xs">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="text-[10px] font-bold uppercase tracking-wider">Verified Results</span>
                    <Icon icon="solar:check-circle-bold-duotone" size={16} className="text-emerald-600" />
                  </div>
                  <div className="mt-1.5 text-xl font-black text-emerald-600">
                    {patientLabs.filter((l) => l.status === "Approved" || l.status === "Completed").length}
                  </div>
                </div>
              </div>

              {/* ── Search & Filter Command Bar ─────────────────────────────── */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-xl border bg-card shadow-2xs">
                {/* Search Input */}
                <div className="relative flex-1">
                  <Icon
                    icon="solar:magnifer-linear"
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  />
                  <Input
                    type="text"
                    value={diagnosticsSearchQuery}
                    onChange={(e) => setDiagnosticsSearchQuery(e.target.value)}
                    placeholder="Search diagnostic orders, test names, specimen IDs, or practitioners..."
                    className="h-8.5 pl-9 text-xs"
                  />
                  {diagnosticsSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setDiagnosticsSearchQuery("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Filter Chips */}
                <div className="flex items-center gap-1 overflow-x-auto text-xs shrink-0">
                  {(
                    [
                      { key: "all", label: "All Orders" },
                      { key: "services", label: "Service Requests" },
                      { key: "labs", label: "Lab Tests" },
                      { key: "pending", label: "Pending" },
                      { key: "completed", label: "Completed" },
                    ] as const
                  ).map((f) => (
                    <button
                      key={f.key}
                      type="button"
                      onClick={() => setDiagnosticsFilter(f.key)}
                      className={cn(
                        "px-2.5 py-1 rounded-lg text-xs font-semibold transition-all shrink-0 cursor-pointer",
                        diagnosticsFilter === f.key
                          ? "bg-primary text-primary-foreground shadow-2xs"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                      )}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                {/* Quick Add Buttons */}
                <div className="flex items-center gap-1.5 shrink-0 justify-end">
                  <Button
                    size="sm"
                    onClick={() => navigate(`/healthcare/service-requests/new?patient=${patient.id}`)}
                    className="h-8 text-xs font-semibold gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white"
                  >
                    <Icon icon="solar:add-circle-bold" size={14} />
                    New Request
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => navigate(`/healthcare/lab-tests/new?patient=${patient.id}`)}
                    className="h-8 text-xs font-semibold gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
                  >
                    <Icon icon="solar:flask-bold" size={14} />
                    Create Lab Test
                  </Button>
                </div>
              </div>

              {/* ── Section 1: Service Requests (Marley EHR Parity) ─────────── */}
              {(diagnosticsFilter === "all" || diagnosticsFilter === "services" || diagnosticsFilter === "pending") && (() => {
                const totalCount = patientServiceRequests.length;
                const activeCount = patientServiceRequests.filter((r) => r.status === "Active").length;
                const completedCount = patientServiceRequests.filter((r) => r.status === "Completed").length;
                const statCount = patientServiceRequests.filter((r) => r.priority === "STAT" || r.priority === "Urgent").length;
                const onHoldCount = patientServiceRequests.filter((r) => r.status === "On Hold").length;

                const filteredSRs = patientServiceRequests
                  .filter((sr) => {
                    if (srStatusFilter === "active") return sr.status === "Active";
                    if (srStatusFilter === "urgent") return sr.priority === "STAT" || sr.priority === "Urgent";
                    if (srStatusFilter === "hold") return sr.status === "On Hold";
                    if (srStatusFilter === "completed") return sr.status === "Completed";
                    if (diagnosticsFilter === "pending") return sr.status !== "Completed" && sr.status !== "Cancelled";
                    return true;
                  })
                  .filter((sr) => {
                    if (srCategoryFilter === "all") return true;
                    const cat = (sr.category_name || sr.reference_doctype || sr.template_dt || "").toLowerCase();
                    return cat.includes(srCategoryFilter.toLowerCase());
                  })
                  .filter((sr) => {
                    const q = (srSearchQuery || diagnosticsSearchQuery).toLowerCase().trim();
                    if (!q) return true;
                    return (
                      (sr.title || "").toLowerCase().includes(q) ||
                      (sr.order_description || "").toLowerCase().includes(q) ||
                      (sr.category_name || "").toLowerCase().includes(q) ||
                      (sr.practitioner_name || "").toLowerCase().includes(q) ||
                      (sr.request_id || "").toLowerCase().includes(q) ||
                      (sr.notes || "").toLowerCase().includes(q) ||
                      (sr.status || "").toLowerCase().includes(q)
                    );
                  });

                const todayISO = new Date().toISOString().slice(0, 10);

                return (
                  <Card className="shadow-2xs overflow-hidden border-border/80">
                    <CardHeader className="pb-3 border-b bg-muted/15 flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 shrink-0">
                          <Icon icon="solar:clipboard-check-bold-duotone" size={20} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <CardTitle className="text-sm font-bold text-foreground">
                              Service Requests & Clinical Orders
                            </CardTitle>
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                              Marley EHR Parity
                            </span>
                          </div>
                          <CardDescription className="text-xs text-muted-foreground mt-0.5">
                            Physician diagnostic requisitions, lab orders, radiology imaging scans, procedures & therapy orders.
                          </CardDescription>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        {/* KPI mini-tags */}
                        <div className="hidden lg:flex items-center gap-1.5 text-[11px] font-semibold">
                          <span className="px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                            {activeCount} Active
                          </span>
                          {statCount > 0 && (
                            <span className="px-2 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-ping inline-block" />
                              {statCount} STAT
                            </span>
                          )}
                          <span className="px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            {completedCount} Done
                          </span>
                        </div>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/healthcare/service-requests?patient=${id}`)}
                          className="h-8 text-xs font-semibold text-indigo-600 border-indigo-200 dark:border-indigo-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 px-2.5"
                        >
                          <Icon icon="solar:tuning-bold" size={13} className="mr-1" />
                          All Requests (Page)
                        </Button>

                        <Button
                          size="sm"
                          onClick={() => navigate(`/healthcare/service-requests/new?patient=${id}`)}
                          className="h-8 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-2xs px-3"
                        >
                          <Icon icon="solar:add-circle-bold" size={14} className="mr-1" />
                          + New Service Request
                        </Button>
                      </div>
                    </CardHeader>

                    {/* Sub-Filters & Quick Search Strip */}
                    <div className="px-4 py-2.5 border-b bg-muted/5 flex flex-col sm:flex-row items-center justify-between gap-2.5">
                      <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
                        {[
                          { key: "all", label: `All (${totalCount})` },
                          { key: "active", label: `Active (${activeCount})` },
                          { key: "urgent", label: `STAT / Urgent (${statCount})` },
                          { key: "hold", label: `On Hold (${onHoldCount})` },
                          { key: "completed", label: `Completed (${completedCount})` },
                        ].map((st) => (
                          <button
                            key={st.key}
                            type="button"
                            onClick={() => setSrStatusFilter(st.key)}
                            className={`text-xs px-2.5 py-1 rounded-lg font-semibold transition-all shrink-0 ${
                              srStatusFilter === st.key
                                ? "bg-indigo-600 text-white shadow-2xs"
                                : "text-muted-foreground hover:text-foreground hover:bg-muted/80"
                            }`}
                          >
                            {st.label}
                          </button>
                        ))}
                      </div>

                      <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                        <select
                          className="text-xs h-7 px-2 rounded-md border border-input bg-background shadow-2xs font-medium"
                          value={srCategoryFilter}
                          onChange={(e) => setSrCategoryFilter(e.target.value)}
                        >
                          <option value="all">All Categories</option>
                          <option value="lab">Laboratory</option>
                          <option value="radiology">Radiology & Scans</option>
                          <option value="procedure">Procedures</option>
                          <option value="therapy">Therapy</option>
                          <option value="consultation">Consultations</option>
                        </select>

                        <div className="w-full sm:w-48">
                          <Input
                            placeholder="Filter orders..."
                            value={srSearchQuery}
                            onChange={(e) => setSrSearchQuery(e.target.value)}
                            className="text-xs h-7"
                          />
                        </div>
                      </div>
                    </div>

                    <CardContent className="p-0">
                      {filteredSRs.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground p-6">
                          <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-500 flex items-center justify-center mx-auto mb-2 border border-indigo-200 dark:border-indigo-800">
                            <Icon icon="solar:clipboard-check-linear" size={26} />
                          </div>
                          <p className="text-xs font-bold text-foreground">No service requests match the filter</p>
                          <p className="text-[11px] text-muted-foreground max-w-sm mx-auto mt-0.5">
                            {srStatusFilter !== "all" || srCategoryFilter !== "all" || srSearchQuery
                              ? "Try resetting the sub-filters or search term to see other orders."
                              : "No clinical orders recorded for this patient yet."}
                          </p>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => navigate(`/healthcare/service-requests/new?patient=${id}`)}
                            className="mt-3 text-xs font-semibold text-indigo-600 border-indigo-200"
                          >
                            <Icon icon="solar:add-circle-bold" size={13} className="mr-1" />
                            Create First Service Request
                          </Button>
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead className="bg-muted/40 border-b text-[10px] uppercase font-bold text-muted-foreground">
                              <tr>
                                <th className="py-2.5 px-4 text-left">Service / Clinical Order</th>
                                <th className="py-2.5 px-3 text-left">Category</th>
                                <th className="py-2.5 px-3 text-left">Priority</th>
                                <th className="py-2.5 px-3 text-left">Ordered Date</th>
                                <th className="py-2.5 px-3 text-left">Expected By</th>
                                <th className="py-2.5 px-3 text-left">Practitioner</th>
                                <th className="py-2.5 px-3 text-left">Status</th>
                                <th className="py-2.5 px-4 text-right">Marley Clinical Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                              {filteredSRs.map((sr) => {
                                const isUrgent = sr.priority === "STAT" || sr.priority === "Urgent";
                                const isStat = sr.priority === "STAT";
                                const isOverdue = sr.expected_date && sr.expected_date < todayISO && sr.status === "Active";

                                const isLab = (sr.reference_doctype === "Lab Test Template" || sr.template_dt === "Lab Test Template" || (sr.category_name || "").toLowerCase().includes("lab"));
                                const isProcedure = (sr.reference_doctype === "Clinical Procedure Template" || sr.template_dt === "Clinical Procedure Template" || (sr.category_name || "").toLowerCase().includes("procedure"));
                                const isTherapy = (sr.reference_doctype === "Therapy Type" || sr.template_dt === "Therapy Type" || (sr.category_name || "").toLowerCase().includes("therapy"));
                                const hasSampleReq = sr.notes?.includes("[Sample Required]") || isLab;
                                const isActionLoading = srActionLoadingId === sr.id;

                                return (
                                  <tr key={sr.id} className={cn("hover:bg-muted/20 transition-colors", isUrgent && "bg-amber-500/5")}>
                                    {/* Service Requisition Title & Tags */}
                                    <td className="py-2.5 px-4">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span
                                          onClick={() => navigate(`/healthcare/service-requests/${sr.id}`)}
                                          className="font-bold text-foreground hover:text-indigo-600 hover:underline cursor-pointer"
                                        >
                                          {sr.title || sr.order_description || sr.template_dt || sr.request_id || `Order #${sr.id}`}
                                        </span>

                                        <button
                                          type="button"
                                          onClick={() => {
                                            navigator.clipboard.writeText(sr.request_id || String(sr.id));
                                            toast.success(`Copied ID: ${sr.request_id || sr.id}`);
                                          }}
                                          className="font-mono text-[10px] text-muted-foreground hover:text-foreground font-semibold px-1 py-0.2 rounded bg-muted/60"
                                          title="Click to copy ID"
                                        >
                                          {sr.request_id || `HLC-SR-${sr.id}`}
                                        </button>

                                        {sr.reference_doctype && (
                                          <Badge variant="outline" className="text-[9px] font-mono py-0 text-muted-foreground">
                                            {sr.reference_doctype}
                                          </Badge>
                                        )}

                                        {hasSampleReq && (
                                          <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                                            <Icon icon="solar:test-tube-bold" size={9} />
                                            Sample Req
                                          </span>
                                        )}
                                      </div>

                                      {sr.notes && (
                                        <div className="text-[11px] text-muted-foreground truncate max-w-sm mt-0.5" title={sr.notes}>
                                          {sr.notes}
                                        </div>
                                      )}
                                    </td>

                                    {/* Category */}
                                    <td className="py-2.5 px-3">
                                      <span className="text-[11px] px-2 py-0.5 rounded-md bg-muted text-foreground font-medium">
                                        {sr.category_name || "General"}
                                      </span>
                                    </td>

                                    {/* Priority */}
                                    <td className="py-2.5 px-3">
                                      <span
                                        className={cn(
                                          "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border",
                                          isStat
                                            ? "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30 animate-pulse"
                                            : sr.priority === "Urgent"
                                            ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30"
                                            : sr.priority === "ASAP"
                                            ? "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/30"
                                            : "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20"
                                        )}
                                      >
                                        <Icon
                                          icon={
                                            isStat
                                              ? "solar:danger-triangle-bold"
                                              : sr.priority === "Urgent"
                                              ? "solar:bell-bold"
                                              : sr.priority === "ASAP"
                                              ? "solar:clock-circle-bold"
                                              : "solar:calendar-bold"
                                          }
                                          size={11}
                                        />
                                        {sr.priority || "Routine"}
                                      </span>
                                    </td>

                                    {/* Ordered Date */}
                                    <td className="py-2.5 px-3 text-muted-foreground text-[11px]">
                                      {sr.order_date ? sr.order_date.slice(0, 10) : "—"}
                                    </td>

                                    {/* Expected Date & Overdue flag */}
                                    <td className="py-2.5 px-3">
                                      <div className="flex items-center gap-1.5 text-[11px]">
                                        <span className={isOverdue ? "text-rose-600 font-bold" : "text-muted-foreground"}>
                                          {sr.expected_date ? sr.expected_date.slice(0, 10) : "—"}
                                        </span>
                                        {isOverdue && (
                                          <Badge className="bg-rose-600 text-white text-[9px] px-1 py-0">
                                            Overdue
                                          </Badge>
                                        )}
                                      </div>
                                    </td>

                                    {/* Practitioner */}
                                    <td className="py-2.5 px-3 text-muted-foreground text-[11px]">
                                      {sr.practitioner_name ? `Dr. ${sr.practitioner_name}` : "—"}
                                    </td>

                                    {/* Status Badge */}
                                    <td className="py-2.5 px-3">
                                      <Badge
                                        variant="outline"
                                        className={cn(
                                          "text-[10px] font-bold",
                                          sr.status === "Completed"
                                            ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                                            : sr.status === "Cancelled"
                                            ? "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30"
                                            : sr.status === "On Hold"
                                            ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30"
                                            : "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30"
                                        )}
                                      >
                                        {sr.status}
                                      </Badge>
                                    </td>

                                    {/* Actions & Downstream Creator */}
                                    <td className="py-2.5 px-4 text-right">
                                      <div className="flex items-center justify-end gap-1.5">
                                        {/* Downstream Document Button */}
                                        {isLab && (
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleLaunchDownstream(sr, "lab")}
                                            className="h-6 text-[11px] px-2 border-purple-300 text-purple-700 dark:border-purple-800 dark:text-purple-300 hover:bg-purple-50 font-semibold"
                                            title="Create Lab Test directly linked to this Service Request"
                                          >
                                            <Icon icon="solar:flask-bold" size={11} className="mr-1" />
                                            Lab Test
                                          </Button>
                                        )}

                                        {isProcedure && (
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleLaunchDownstream(sr, "procedure")}
                                            className="h-6 text-[11px] px-2 border-blue-300 text-blue-700 dark:border-blue-800 dark:text-blue-300 hover:bg-blue-50 font-semibold"
                                            title="Create Clinical Procedure linked to this Service Request"
                                          >
                                            <Icon icon="solar:scalpel-bold" size={11} className="mr-1" />
                                            Procedure
                                          </Button>
                                        )}

                                        {isTherapy && (
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleLaunchDownstream(sr, "therapy")}
                                            className="h-6 text-[11px] px-2 border-emerald-300 text-emerald-700 dark:border-emerald-800 dark:text-emerald-300 hover:bg-emerald-50 font-semibold"
                                            title="Create Therapy Session linked to this Service Request"
                                          >
                                            <Icon icon="solar:dumbbell-small-bold" size={11} className="mr-1" />
                                            Therapy
                                          </Button>
                                        )}

                                        {hasSampleReq && (
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleLaunchDownstream(sr, "sample")}
                                            className="h-6 text-[11px] px-2 border-amber-300 text-amber-700 dark:border-amber-800 dark:text-amber-300 hover:bg-amber-50 font-semibold"
                                            title="Collect specimen for this Service Request"
                                          >
                                            <Icon icon="solar:test-tube-bold" size={11} className="mr-1" />
                                            Sample
                                          </Button>
                                        )}

                                        {/* State Transitions */}
                                        {(sr.status === "Active" || sr.status === "Draft") && (
                                          <>
                                            <Button
                                              variant="outline"
                                              size="sm"
                                              disabled={isActionLoading}
                                              onClick={() => handleCompleteServiceRequest(sr)}
                                              className="h-6 text-[11px] px-2 border-emerald-300 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 font-semibold"
                                              title="Fulfill / Complete this Service Request"
                                            >
                                              <Icon icon="solar:check-circle-bold" size={12} className="mr-0.5 text-emerald-600" />
                                              Fulfill
                                            </Button>

                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              disabled={isActionLoading}
                                              onClick={() => handleToggleHoldServiceRequest(sr)}
                                              className="h-6 text-[11px] px-1.5 text-amber-700 hover:bg-amber-50"
                                              title="Put on hold"
                                            >
                                              <Icon icon="solar:pause-circle-bold" size={12} />
                                            </Button>
                                          </>
                                        )}

                                        {sr.status === "On Hold" && (
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            disabled={isActionLoading}
                                            onClick={() => handleToggleHoldServiceRequest(sr)}
                                            className="h-6 text-[11px] px-2 border-blue-300 text-blue-700 hover:bg-blue-50 font-semibold"
                                            title="Resume active request"
                                          >
                                            <Icon icon="solar:play-circle-bold" size={12} className="mr-0.5 text-blue-600" />
                                            Resume
                                          </Button>
                                        )}

                                        {(sr.status === "Active" || sr.status === "Draft" || sr.status === "On Hold") && (
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            disabled={isActionLoading}
                                            onClick={() => handleCancelServiceRequest(sr)}
                                            className="h-6 text-[11px] px-1 text-rose-600 hover:bg-rose-50"
                                            title="Cancel request"
                                          >
                                            <Icon icon="solar:close-circle-bold" size={12} />
                                          </Button>
                                        )}

                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => navigate(`/healthcare/service-requests/${sr.id}`)}
                                          className="h-6 text-[11px] px-2 text-indigo-600 hover:bg-indigo-50"
                                          title="View complete clinical order record"
                                        >
                                          Details
                                        </Button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })()}

              {/* ── Section 2: Laboratory Tests ─────────────────────────────── */}
              {(diagnosticsFilter === "all" || diagnosticsFilter === "labs" || diagnosticsFilter === "pending" || diagnosticsFilter === "completed") && (
                <Card className="shadow-2xs overflow-hidden">
                  <CardHeader className="pb-3 border-b bg-muted/15 flex flex-row items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-600">
                        <Icon icon="solar:flask-bold-duotone" size={18} />
                      </div>
                      <div>
                        <CardTitle className="text-xs font-bold">Prescribed Laboratory Tests & Diagnostic Findings</CardTitle>
                        <CardDescription className="text-xs">
                          Clinical laboratory panels, pathology reports, verified observations, and reference ranges.
                        </CardDescription>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[10px] font-mono">
                      {patientLabs.length} Tests
                    </Badge>
                  </CardHeader>
                  <CardContent className="p-0">
                    {patientLabs.length === 0 ? (
                      <div className="text-center py-10 text-muted-foreground p-6">
                        <Icon icon="solar:test-tube-linear" size={32} className="mx-auto mb-2 opacity-40 text-cyan-500" />
                        <p className="text-xs font-medium">No laboratory tests recorded for this patient yet.</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead className="bg-muted/40 border-b text-[10px] uppercase font-bold text-muted-foreground">
                            <tr>
                              <th className="py-2.5 px-4 text-left">Test Name</th>
                              <th className="py-2.5 px-3 text-left">Order ID</th>
                              <th className="py-2.5 px-3 text-left">Date</th>
                              <th className="py-2.5 px-3 text-left">Practitioner</th>
                              <th className="py-2.5 px-3 text-left">Status</th>
                              <th className="py-2.5 px-3 text-left">Findings & Results</th>
                              <th className="py-2.5 px-4 text-right">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {patientLabs
                              .filter((lt: any) => {
                                if (!diagnosticsSearchQuery) return true;
                                const q = diagnosticsSearchQuery.toLowerCase();
                                return (
                                  (lt.lab_test_name || "").toLowerCase().includes(q) ||
                                  (lt.template_name || "").toLowerCase().includes(q) ||
                                  (lt.test_id || "").toLowerCase().includes(q) ||
                                  (lt.practitioner_name || "").toLowerCase().includes(q) ||
                                  (lt.status || "").toLowerCase().includes(q)
                                );
                              })
                              .filter((lt: any) => {
                                if (diagnosticsFilter === "pending") return lt.status !== "Approved" && lt.status !== "Completed";
                                if (diagnosticsFilter === "completed") return lt.status === "Approved" || lt.status === "Completed";
                                return true;
                              })
                              .map((lt: any) => {
                                const displayResult = getLabTestResultDisplay(lt);
                                const isApproved = lt.status === "Approved";
                                const isCompleted = lt.status === "Completed";
                                const isRejected = lt.status === "Rejected";

                                return (
                                  <tr key={lt.id} className="hover:bg-muted/20 transition-colors">
                                    <td className="py-2.5 px-4 font-semibold text-foreground">
                                      {lt.lab_test_name || lt.template_name || "Lab Test"}
                                    </td>
                                    <td className="py-2.5 px-3 font-mono text-[11px] text-muted-foreground">
                                      {lt.test_id || `LT-${lt.id}`}
                                    </td>
                                    <td className="py-2.5 px-3 text-muted-foreground">
                                      {lt.date || lt.creation?.slice(0, 10) || "—"}
                                    </td>
                                    <td className="py-2.5 px-3 text-muted-foreground">
                                      {lt.practitioner_name || "—"}
                                    </td>
                                    <td className="py-2.5 px-3">
                                      <Badge
                                        variant="outline"
                                        className={cn(
                                          "text-[10px] font-bold",
                                          isApproved && "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
                                          isCompleted && "bg-blue-500/10 text-blue-600 border-blue-500/30",
                                          isRejected && "bg-rose-500/10 text-rose-600 border-rose-500/30",
                                          !isApproved && !isCompleted && !isRejected && "bg-muted text-muted-foreground"
                                        )}
                                      >
                                        {lt.status || "Draft"}
                                      </Badge>
                                    </td>
                                    <td className="py-2.5 px-3 max-w-[260px]">
                                      <span
                                        className="text-xs text-foreground/90 font-medium block truncate"
                                        title={displayResult}
                                      >
                                        {displayResult}
                                      </span>
                                    </td>
                                    <td className="py-2.5 px-4 text-right">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => navigate(`/healthcare/lab-tests/${lt.id}`)}
                                        className="h-7 text-xs px-2.5 border-cyan-500/30 text-cyan-600 hover:bg-cyan-500/10"
                                      >
                                        Report
                                      </Button>
                                    </td>
                                  </tr>
                                );
                              })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* ── ADDRESS & CONTACT TAB ─────────────────────────────────── */}
          {activeTab === "address" && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* 1. Primary Residence & Address */}
                <Card className="shadow-2xs overflow-hidden">
                  <CardHeader className="pb-3 border-b bg-muted/15 flex flex-row items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600">
                        <Icon icon="solar:map-point-bold-duotone" size={20} />
                      </div>
                      <div>
                        <CardTitle className="text-xs font-bold">Primary Residence & Geolocation</CardTitle>
                        <CardDescription className="text-xs">
                          Residential address, geographic district, postal routing, and mapping.
                        </CardDescription>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleOpenAddressModal}
                      className="h-7 text-xs gap-1 border-blue-500/30 text-blue-600 hover:bg-blue-500/10"
                    >
                      <Icon icon="solar:pen-bold" size={13} />
                      {form.address || form.city || form.country ? "Edit Address" : "New Address"}
                    </Button>
                  </CardHeader>
                  <CardContent className="p-4 space-y-3">
                    {form.address || form.city || form.country ? (
                      <div className="p-4 rounded-xl border bg-muted/20 space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                              Street Address
                            </span>
                            <p className="text-xs font-medium text-foreground whitespace-pre-line leading-relaxed">
                              {form.address || "Street address not specified"}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-[11px] gap-1 text-muted-foreground hover:text-foreground"
                              onClick={() => {
                                const fullAddr = [form.address, form.city, form.state, form.pincode, form.country]
                                  .filter(Boolean)
                                  .join(", ");
                                navigator.clipboard.writeText(fullAddr);
                                toast.success("Address copied to clipboard");
                              }}
                              title="Copy address"
                            >
                              <Icon icon="solar:copy-bold" size={13} />
                              Copy
                            </Button>
                            {form.address && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-[11px] gap-1 border-blue-500/30 text-blue-600 hover:bg-blue-500/10"
                                onClick={() => {
                                  const query = encodeURIComponent(
                                    [form.address, form.city, form.state, form.country].filter(Boolean).join(", ")
                                  );
                                  window.open(`https://maps.google.com/?q=${query}`, "_blank");
                                }}
                              >
                                <Icon icon="solar:map-point-bold" size={12} />
                                View on Map
                              </Button>
                            )}
                          </div>
                        </div>

                        {/* Location Pills */}
                        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-border/60 text-xs">
                          {form.city && (
                            <span className="px-2 py-0.5 rounded-md bg-background border text-[11px] font-medium text-foreground">
                              City: {form.city}
                            </span>
                          )}
                          {form.state && (
                            <span className="px-2 py-0.5 rounded-md bg-background border text-[11px] font-medium text-foreground">
                              State: {form.state}
                            </span>
                          )}
                          {form.pincode && (
                            <span className="px-2 py-0.5 rounded-md bg-background border text-[11px] font-medium font-mono text-foreground">
                              Postal: {form.pincode}
                            </span>
                          )}
                          {form.country && (
                            <span className="px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20 text-[11px] font-semibold">
                              {form.country}
                            </span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground border rounded-xl border-dashed">
                        <Icon icon="solar:map-point-linear" size={32} className="mx-auto mb-2 opacity-40 text-blue-500" />
                        <p className="text-xs font-semibold text-foreground">No Address Recorded</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Add the patient's primary residential address and postal zone.
                        </p>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleOpenAddressModal}
                          className="mt-3 h-7 text-xs border-blue-500/30 text-blue-600 hover:bg-blue-500/10"
                        >
                          + Add Address
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* 2. Communications Hub */}
                <Card className="shadow-2xs overflow-hidden">
                  <CardHeader className="pb-3 border-b bg-muted/15 flex flex-row items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600">
                        <Icon icon="solar:phone-calling-bold-duotone" size={20} />
                      </div>
                      <div>
                        <CardTitle className="text-xs font-bold">Communications & Digital Channels</CardTitle>
                        <CardDescription className="text-xs">
                          Telephone lines, mobile cellular, electronic mail, and dispatch preferences.
                        </CardDescription>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleOpenContactModal}
                      className="h-7 text-xs gap-1 border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10"
                    >
                      <Icon icon="solar:pen-bold" size={13} />
                      {form.mobile || form.phone || form.email ? "Edit Contact" : "New Contact"}
                    </Button>
                  </CardHeader>
                  <CardContent className="p-4 space-y-3">
                    {form.mobile || form.phone || form.email ? (
                      <div className="space-y-2">
                        {/* Mobile Phone */}
                        <div className="flex items-center justify-between p-2.5 rounded-lg border bg-muted/20">
                          <div>
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                              Primary Mobile
                            </span>
                            <span className="text-xs font-bold text-foreground">
                              {form.mobile || "Not specified"}
                            </span>
                          </div>
                          {form.mobile && (
                            <div className="flex items-center gap-1">
                              <a
                                href={`tel:${form.mobile}`}
                                className="h-7 px-2 rounded-md border border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10 text-xs font-medium inline-flex items-center gap-1 transition-colors"
                              >
                                <Icon icon="solar:phone-bold" size={12} />
                                Call
                              </a>
                              <a
                                href={`sms:${form.mobile}`}
                                className="h-7 px-2 rounded-md border border-border hover:bg-muted text-muted-foreground text-xs font-medium inline-flex items-center gap-1 transition-colors"
                              >
                                <Icon icon="solar:chat-round-line-bold" size={12} />
                                SMS
                              </a>
                            </div>
                          )}
                        </div>

                        {/* Alternate Landline */}
                        <div className="flex items-center justify-between p-2.5 rounded-lg border bg-muted/20">
                          <div>
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                              Alternate / Landline Phone
                            </span>
                            <span className="text-xs font-medium text-foreground">
                              {form.phone || "Not specified"}
                            </span>
                          </div>
                          {form.phone && (
                            <a
                              href={`tel:${form.phone}`}
                              className="h-7 px-2 rounded-md border border-border hover:bg-muted text-muted-foreground text-xs font-medium inline-flex items-center gap-1 transition-colors"
                            >
                              <Icon icon="solar:phone-bold" size={12} />
                              Call
                            </a>
                          )}
                        </div>

                        {/* Email */}
                        <div className="flex items-center justify-between p-2.5 rounded-lg border bg-muted/20">
                          <div>
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                              Email Address
                            </span>
                            <span className="text-xs font-medium text-foreground">
                              {form.email || "Not specified"}
                            </span>
                          </div>
                          {form.email && (
                            <a
                              href={`mailto:${form.email}`}
                              className="h-7 px-2 rounded-md border border-blue-500/30 text-blue-600 hover:bg-blue-500/10 text-xs font-medium inline-flex items-center gap-1 transition-colors"
                            >
                              <Icon icon="solar:letter-bold" size={12} />
                              Email
                            </a>
                          )}
                        </div>

                        {/* Delivery Preference */}
                        <div className="flex items-center justify-between p-2.5 rounded-lg border bg-background">
                          <span className="text-xs text-muted-foreground">Report Delivery Preference</span>
                          <Badge variant="outline" className="text-[11px] font-semibold">
                            {form.report_preference || "Email"}
                          </Badge>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground border rounded-xl border-dashed">
                        <Icon icon="solar:phone-calling-linear" size={32} className="mx-auto mb-2 opacity-40 text-emerald-500" />
                        <p className="text-xs font-semibold text-foreground">No Contact Details Recorded</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Add phone numbers and electronic mail addresses.
                        </p>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleOpenContactModal}
                          className="mt-3 h-7 text-xs border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10"
                        >
                          + Add Contact
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* 3. Patient Relations & Emergency Contacts Directory */}
              <Card className="shadow-2xs overflow-hidden">
                <CardHeader className="pb-3 border-b bg-muted/15 flex flex-row items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600">
                      <Icon icon="solar:users-group-two-rounded-bold-duotone" size={20} />
                    </div>
                    <div>
                      <CardTitle className="text-xs font-bold">Family Relations & Emergency Contacts Directory</CardTitle>
                      <CardDescription className="text-xs">
                        Next-of-kin, guardians, family relations, and primary designated emergency contacts.
                      </CardDescription>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleOpenRelationModal()}
                    className="h-8 text-xs font-semibold gap-1.5 bg-primary text-primary-foreground"
                  >
                    <Icon icon="solar:user-plus-bold" size={14} />
                    Add Relation
                  </Button>
                </CardHeader>
                <CardContent className="p-0">
                  {relations.length === 0 ? (
                    <div className="text-center py-10 text-muted-foreground p-6">
                      <Icon icon="solar:users-group-rounded-linear" size={32} className="mx-auto mb-2 opacity-40 text-purple-500" />
                      <p className="text-xs font-medium">No family relations or emergency contacts recorded</p>
                      <Button
                        variant="link"
                        size="sm"
                        onClick={() => handleOpenRelationModal()}
                        className="mt-1 text-xs text-primary font-semibold"
                      >
                        + Add first relation
                      </Button>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-muted/40 border-b text-[10px] uppercase font-bold text-muted-foreground">
                          <tr>
                            <th className="py-2.5 px-4 text-left w-10">#</th>
                            <th className="py-2.5 px-3 text-left">Relation Type</th>
                            <th className="py-2.5 px-3 text-left">Contact / Patient Name</th>
                            <th className="py-2.5 px-3 text-left">Emergency Phone</th>
                            <th className="py-2.5 px-3 text-left">Instructions / Notes</th>
                            <th className="py-2.5 px-4 text-right w-24">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {relations.map((rel, i) => (
                            <tr key={rel.id || i} className="hover:bg-muted/20 transition-colors">
                              <td className="py-2.5 px-4 text-muted-foreground text-xs">{i + 1}</td>
                              <td className="py-2.5 px-3">
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "text-[10px] font-bold uppercase",
                                    rel.relation === "Spouse" && "bg-rose-500/10 text-rose-600 border-rose-500/30",
                                    (rel.relation === "Father" || rel.relation === "Mother") && "bg-blue-500/10 text-blue-600 border-blue-500/30",
                                    rel.relation === "Siblings" && "bg-purple-500/10 text-purple-600 border-purple-500/30",
                                    !["Spouse", "Father", "Mother", "Siblings"].includes(rel.relation || "") && "bg-muted text-muted-foreground"
                                  )}
                                >
                                  {rel.relation || "Relative"}
                                </Badge>
                              </td>
                              <td className="py-2.5 px-3 font-semibold text-foreground">
                                {rel.related_patient_name ? (
                                  <div className="flex items-center gap-1.5">
                                    <Icon icon="solar:user-bold" size={13} className="text-primary" />
                                    <span>{rel.related_patient_name}</span>
                                    <span className="text-[10px] text-primary bg-primary/10 px-1.5 py-0.2 rounded font-semibold">
                                      Registered Patient
                                    </span>
                                  </div>
                                ) : rel.contact_name ? (
                                  <span>{rel.contact_name}</span>
                                ) : (
                                  "—"
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-muted-foreground">
                                {rel.contact_phone ? (
                                  <a
                                    href={`tel:${rel.contact_phone}`}
                                    className="inline-flex items-center gap-1 text-emerald-600 hover:underline font-medium"
                                  >
                                    <Icon icon="solar:phone-bold" size={11} />
                                    {rel.contact_phone}
                                  </a>
                                ) : (
                                  "—"
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-muted-foreground truncate max-w-[200px]">
                                {rel.description || "—"}
                              </td>
                              <td className="py-2.5 px-4 text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                    onClick={() => handleOpenRelationModal(rel)}
                                    title="Edit relation"
                                  >
                                    <Icon icon="solar:pen-bold" size={13} />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-destructive hover:bg-destructive/10"
                                    onClick={() => handleDeleteRelation(rel.id)}
                                    title="Delete relation"
                                  >
                                    <Icon icon="solar:trash-bin-trash-bold" size={13} />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Medical History Tab */}
          {activeTab === "medical" && (
            <div className="space-y-6">
              {/* 1. Critical Clinical Allergies & Drug Adverse Reactions Hero Banner */}
              {form.allergies && form.allergies.trim() ? (
                <div className="p-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 dark:bg-rose-950/20 shadow-2xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start sm:items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-rose-500/20 text-rose-600 shrink-0">
                        <Icon icon="solar:danger-triangle-bold" size={22} className="animate-pulse" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-rose-900 dark:text-rose-100">
                            Documented Allergies & Drug Sensitivities
                          </h4>
                          <Badge variant="outline" className="bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-500/40 text-[10px] font-bold uppercase tracking-wider">
                            Critical Alert
                          </Badge>
                        </div>
                        <p className="text-xs text-rose-700 dark:text-rose-300 mt-0.5">
                          High clinical alert. Verify sensitivity profile before administering, injecting, or dispensing medications.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2 pt-3 border-t border-rose-500/20">
                    {form.allergies.split(/[,;\n]+/).map((item: string, idx: number) => {
                      const trimmed = item.trim();
                      if (!trimmed) return null;
                      return (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/20 text-rose-800 dark:text-rose-200 border border-rose-500/30 shadow-2xs"
                        >
                          <Icon icon="solar:shield-warning-bold" size={13} className="text-rose-600 shrink-0" />
                          {trimmed}
                        </span>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="p-3.5 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 dark:bg-emerald-950/10 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600">
                      <Icon icon="solar:shield-check-bold-duotone" size={20} />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-emerald-950 dark:text-emerald-200">
                        No Known Drug Allergies (NKDA) Recorded
                      </h4>
                      <p className="text-[11px] text-muted-foreground">
                        Patient has no documented drug or food hypersensitivities on record. Always verify with patient at intake.
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-[10px] font-semibold">
                    NKDA Documented
                  </Badge>
                </div>
              )}

              {/* 2. Core Clinical History Matrix (4 Structured Specialized Cards) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* A. Allergies & Hypersensitivities */}
                <Card className="shadow-2xs border-l-4 border-l-rose-500">
                  <CardHeader className="pb-3 border-b bg-muted/15 flex flex-row items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-xl bg-rose-500/10 text-rose-600">
                        <Icon icon="solar:shield-warning-bold-duotone" size={20} />
                      </div>
                      <div>
                        <CardTitle className="text-xs font-bold">Allergies & Sensitivities</CardTitle>
                        <CardDescription className="text-xs">
                          Adverse reactions, drug intolerances, and contact allergies
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 space-y-3">
                    <div>
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
                        Quick Add Common Allergens:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {["Penicillin", "Sulfa Drugs", "Aspirin/NSAIDs", "Latex", "Iodine / Contrast", "Peanuts"].map((item) => (
                          <button
                            key={item}
                            type="button"
                            onClick={() => appendToField("allergies", item)}
                            className="text-[11px] px-2.5 py-0.5 rounded-full border border-rose-500/20 bg-rose-500/5 hover:bg-rose-500/15 text-rose-700 dark:text-rose-300 font-medium transition cursor-pointer flex items-center gap-1"
                          >
                            <span>+</span>
                            <span>{item}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs font-semibold text-foreground">Detailed Reaction Notes & Manifestations</Label>
                      <textarea
                        className="w-full border rounded-lg p-2.5 text-xs mt-1.5 min-h-[90px] bg-background focus:ring-2 focus:ring-primary/20 focus:outline-hidden"
                        value={form.allergies || ""}
                        onChange={(e) => setForm({ ...form, allergies: e.target.value })}
                        placeholder="e.g., Penicillin (anaphylaxis 2018), Sulfa drugs (rash)..."
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* B. Past & Ongoing Medical History */}
                <Card className="shadow-2xs border-l-4 border-l-blue-500">
                  <CardHeader className="pb-3 border-b bg-muted/15 flex flex-row items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600">
                        <Icon icon="solar:heart-pulse-bold-duotone" size={20} />
                      </div>
                      <div>
                        <CardTitle className="text-xs font-bold">Past & Chronic Medical Conditions</CardTitle>
                        <CardDescription className="text-xs">
                          Chronic illnesses, diagnoses, and medical conditions
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 space-y-3">
                    <div>
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
                        Quick Add Chronic Conditions:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {["Hypertension", "Type 2 Diabetes", "Asthma", "Dyslipidemia", "GERD", "Ischemic Heart Disease"].map((item) => (
                          <button
                            key={item}
                            type="button"
                            onClick={() => appendToField("medical_history", item)}
                            className="text-[11px] px-2.5 py-0.5 rounded-full border border-blue-500/20 bg-blue-500/5 hover:bg-blue-500/15 text-blue-700 dark:text-blue-300 font-medium transition cursor-pointer flex items-center gap-1"
                          >
                            <span>+</span>
                            <span>{item}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs font-semibold text-foreground">Medical History & Diagnosis Notes</Label>
                      <textarea
                        className="w-full border rounded-lg p-2.5 text-xs mt-1.5 min-h-[90px] bg-background focus:ring-2 focus:ring-primary/20 focus:outline-hidden"
                        value={form.medical_history || ""}
                        onChange={(e) => setForm({ ...form, medical_history: e.target.value })}
                        placeholder="e.g., Essential Hypertension (diagnosed 2021), well controlled on monotherapy..."
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* C. Current Medications */}
                <Card className="shadow-2xs border-l-4 border-l-purple-500">
                  <CardHeader className="pb-3 border-b bg-muted/15 flex flex-row items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600">
                        <Icon icon="solar:pill-bold-duotone" size={20} />
                      </div>
                      <div>
                        <CardTitle className="text-xs font-bold">Current & Long-Term Medications</CardTitle>
                        <CardDescription className="text-xs">
                          Active home prescriptions, OTC therapies, and supplements
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 space-y-3">
                    <div>
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
                        Quick Add Common Regimens:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {["Metformin 500mg BID", "Amlodipine 5mg OD", "Atorvastatin 20mg HS", "Omeprazole 20mg OD"].map((item) => (
                          <button
                            key={item}
                            type="button"
                            onClick={() => appendToField("medication", item)}
                            className="text-[11px] px-2.5 py-0.5 rounded-full border border-purple-500/20 bg-purple-500/5 hover:bg-purple-500/15 text-purple-700 dark:text-purple-300 font-medium transition cursor-pointer flex items-center gap-1"
                          >
                            <span>+</span>
                            <span>{item}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs font-semibold text-foreground">Medications, Regimens & Dosing Schedule</Label>
                      <textarea
                        className="w-full border rounded-lg p-2.5 text-xs mt-1.5 min-h-[90px] bg-background focus:ring-2 focus:ring-primary/20 focus:outline-hidden"
                        value={form.medication || ""}
                        onChange={(e) => setForm({ ...form, medication: e.target.value })}
                        placeholder="e.g., Metformin 500mg PO BID with meals, Amlodipine 5mg OD morning..."
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* D. Surgical History */}
                <Card className="shadow-2xs border-l-4 border-l-amber-500">
                  <CardHeader className="pb-3 border-b bg-muted/15 flex flex-row items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600">
                        <Icon icon="solar:scissors-bold-duotone" size={20} />
                      </div>
                      <div>
                        <CardTitle className="text-xs font-bold">Surgical History & Interventions</CardTitle>
                        <CardDescription className="text-xs">
                          Operative procedures, hospitalizations, and anesthesia reactions
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 space-y-3">
                    <div>
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
                        Quick Add Common Surgeries:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {["Appendectomy", "Cholecystectomy", "Cesarean Section", "Inguinal Hernia Repair", "Knee Arthroscopy"].map((item) => (
                          <button
                            key={item}
                            type="button"
                            onClick={() => appendToField("surgical_history", item)}
                            className="text-[11px] px-2.5 py-0.5 rounded-full border border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/15 text-amber-700 dark:text-amber-300 font-medium transition cursor-pointer flex items-center gap-1"
                          >
                            <span>+</span>
                            <span>{item}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs font-semibold text-foreground">Surgical Log & Operative Notes</Label>
                      <textarea
                        className="w-full border rounded-lg p-2.5 text-xs mt-1.5 min-h-[90px] bg-background focus:ring-2 focus:ring-primary/20 focus:outline-hidden"
                        value={form.surgical_history || ""}
                        onChange={(e) => setForm({ ...form, surgical_history: e.target.value })}
                        placeholder="e.g., Laparoscopic Appendectomy (2020, City Hospital), no anesthesia complications..."
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* 3. Personal, Social & Environmental Risk Factors */}
              <Card className="shadow-2xs overflow-hidden">
                <CardHeader className="pb-3 border-b bg-muted/15">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-teal-500/10 text-teal-600">
                      <Icon icon="solar:user-hand-up-bold-duotone" size={20} />
                    </div>
                    <div>
                      <CardTitle className="text-xs font-bold">Personal, Social & Environmental Risk Factors</CardTitle>
                      <CardDescription className="text-xs">
                        Lifestyle habits, occupational exposures, and environmental risk determinants
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-5 space-y-6">
                  {/* Occupation & Marital Status */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <Icon icon="solar:case-bold-duotone" size={14} className="text-muted-foreground" />
                        Occupation & Profession
                      </Label>
                      <Input
                        value={form.occupation || ""}
                        onChange={(e) => setForm({ ...form, occupation: e.target.value })}
                        className="mt-1.5 h-9 text-xs"
                        placeholder="e.g., Software Engineer, Construction Worker, Teacher..."
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <Icon icon="solar:heart-bold-duotone" size={14} className="text-muted-foreground" />
                        Marital Status
                      </Label>
                      <select
                        className="w-full border rounded-lg px-3 py-2 text-xs mt-1.5 bg-background h-9 focus:ring-2 focus:ring-primary/20 focus:outline-hidden"
                        value={form.marital_status || ""}
                        onChange={(e) => setForm({ ...form, marital_status: e.target.value })}
                      >
                        <option value="">Select Status</option>
                        <option value="Single">Single</option>
                        <option value="Married">Married</option>
                        <option value="Divorced">Divorced</option>
                        <option value="Widowed">Widowed</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  </div>

                  {/* Substance & Lifestyle Consumption Matrix */}
                  <div className="rounded-xl border bg-muted/10 p-4 space-y-4">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
                      Substance & Lifestyle Exposure
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="p-3 rounded-lg border bg-background space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                            <Icon icon="solar:fire-bold" size={14} className="text-amber-500" />
                            Tobacco Consumption
                          </span>
                          <Badge variant="outline" className="text-[10px]">
                            {form.tobacco_current_use ? "Active / Documented" : "None / Unspecified"}
                          </Badge>
                        </div>
                        <div className="space-y-2">
                          <div>
                            <Label className="text-[11px] text-muted-foreground">Past Use / History</Label>
                            <Input
                              value={form.tobacco_past_use || ""}
                              onChange={(e) => setForm({ ...form, tobacco_past_use: e.target.value })}
                              className="mt-1 h-8 text-xs"
                              placeholder="e.g., 10 pack-years, quit 2018"
                            />
                          </div>
                          <div>
                            <Label className="text-[11px] text-muted-foreground">Current / Present Use</Label>
                            <Input
                              value={form.tobacco_current_use || ""}
                              onChange={(e) => setForm({ ...form, tobacco_current_use: e.target.value })}
                              className="mt-1 h-8 text-xs"
                              placeholder="e.g., None, or 5 cigarettes/day"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="p-3 rounded-lg border bg-background space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                            <Icon icon="solar:cup-bold" size={14} className="text-purple-500" />
                            Alcohol Consumption
                          </span>
                          <Badge variant="outline" className="text-[10px]">
                            {form.alcohol_current_use ? "Active / Documented" : "None / Unspecified"}
                          </Badge>
                        </div>
                        <div className="space-y-2">
                          <div>
                            <Label className="text-[11px] text-muted-foreground">Past Use / History</Label>
                            <Input
                              value={form.alcohol_past_use || ""}
                              onChange={(e) => setForm({ ...form, alcohol_past_use: e.target.value })}
                              className="mt-1 h-8 text-xs"
                              placeholder="e.g., Occasional social drinker"
                            />
                          </div>
                          <div>
                            <Label className="text-[11px] text-muted-foreground">Current / Present Use</Label>
                            <Input
                              value={form.alcohol_current_use || ""}
                              onChange={(e) => setForm({ ...form, alcohol_current_use: e.target.value })}
                              className="mt-1 h-8 text-xs"
                              placeholder="e.g., 1-2 units weekly, or Abstinent"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Environmental & Occupational Hazards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <Icon icon="solar:shield-cross-bold" size={14} className="text-orange-500" />
                        Occupational & Environmental Hazards
                      </Label>
                      <textarea
                        className="w-full border rounded-lg p-2.5 text-xs mt-1.5 min-h-[75px] bg-background focus:ring-2 focus:ring-primary/20 focus:outline-hidden"
                        value={(form as any).surrounding_factors || ""}
                        onChange={(e) => setForm({ ...form, surrounding_factors: e.target.value } as any)}
                        placeholder="e.g., High-voltage exposure, chemical solvent fumes, excessive noise, ergonomics..."
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <Icon icon="solar:danger-circle-bold" size={14} className="text-indigo-500" />
                        Other Clinical & Lifestyle Risk Factors
                      </Label>
                      <textarea
                        className="w-full border rounded-lg p-2.5 text-xs mt-1.5 min-h-[75px] bg-background focus:ring-2 focus:ring-primary/20 focus:outline-hidden"
                        value={form.other_risk_factors || ""}
                        onChange={(e) => setForm({ ...form, other_risk_factors: e.target.value })}
                        placeholder="e.g., Strong family history of early CAD, sedentary lifestyle, dietary restrictions..."
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 4. Consultation Fee Validity Tracker */}
              {feeValidities.length > 0 && (
                <Card className="shadow-2xs overflow-hidden">
                  <CardHeader className="pb-3 border-b bg-muted/15 flex flex-row items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600">
                        <Icon icon="solar:bill-check-bold-duotone" size={20} />
                      </div>
                      <div>
                        <CardTitle className="text-xs font-bold">Consultation Fee Validity & Follow-Up Coverage</CardTitle>
                        <CardDescription className="text-xs">
                          Active practitioner consultation grace periods and visit allowance quotas
                        </CardDescription>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-xs font-semibold">
                      {feeValidities.length} {feeValidities.length === 1 ? "Record" : "Records"}
                    </Badge>
                  </CardHeader>
                  <CardContent className="p-4 space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {feeValidities.map((fv, i) => {
                        const isExpired = fv.valid_till ? new Date(fv.valid_till) < new Date() : false;
                        const visitPct = fv.max_visits ? Math.min(100, Math.round(((fv.visit_count || 0) / fv.max_visits) * 100)) : 0;
                        return (
                          <div
                            key={fv.id || i}
                            className={cn(
                              "p-3.5 rounded-xl border transition-all",
                              isExpired ? "bg-muted/30 border-border" : "bg-card border-emerald-500/30 shadow-2xs"
                            )}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <span className="text-xs font-bold text-foreground block">
                                  {fv.practitioner_name || fv.practitioner || "Consultant Practitioner"}
                                </span>
                                <span className="text-[11px] text-muted-foreground mt-0.5 block">
                                  Valid: {fv.valid_from || "—"} to {fv.valid_till || "—"}
                                </span>
                              </div>
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-[10px] font-bold uppercase",
                                  isExpired
                                    ? "bg-muted text-muted-foreground"
                                    : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                                )}
                              >
                                {isExpired ? "Expired" : "Active"}
                              </Badge>
                            </div>

                            <div className="mt-3 pt-2.5 border-t border-border/60">
                              <div className="flex items-center justify-between text-[11px] mb-1">
                                <span className="text-muted-foreground">Visits Utilized</span>
                                <span className="font-semibold text-foreground">
                                  {fv.visit_count || 0} / {fv.max_visits || "Unlimited"} visits
                                </span>
                              </div>
                              {fv.max_visits && (
                                <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                                  <div
                                    className={cn(
                                      "h-full transition-all rounded-full",
                                      visitPct >= 100 ? "bg-rose-500" : "bg-emerald-500"
                                    )}
                                    style={{ width: `${visitPct}%` }}
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* 5. Auto-Logged Patient Medical Record (PMR) Audit Feed */}
              <Card className="shadow-2xs overflow-hidden">
                <CardHeader className="pb-3 border-b bg-muted/15">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600">
                        <Icon icon="solar:clipboard-list-bold-duotone" size={20} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-xs font-bold">Patient Medical Record Audit Feed</CardTitle>
                          <Badge variant="secondary" className="text-[10px] font-bold">
                            {filteredMedicalRecords.length} / {medicalRecords.length} Records
                          </Badge>
                        </div>
                        <CardDescription className="text-xs">
                          Continuous clinical ledger automatically synthesized from encounters, vitals, lab orders, and medication dispensations
                        </CardDescription>
                      </div>
                    </div>

                    {/* Filter Pills */}
                    <div className="flex flex-wrap items-center gap-1 bg-muted/40 p-1 rounded-xl border text-xs">
                      {[
                        { key: "all", label: "All" },
                        { key: "encounters", label: "Encounters" },
                        { key: "vitals", label: "Vitals" },
                        { key: "labs", label: "Labs" },
                        { key: "prescriptions", label: "Rx / Meds" },
                        { key: "appointments", label: "Appts" },
                      ].map((item) => (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => setMedicalRecordTypeFilter(item.key)}
                          className={cn(
                            "px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer",
                            medicalRecordTypeFilter === item.key
                              ? "bg-background text-foreground shadow-2xs font-bold"
                              : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Live Search Input */}
                  <div className="mt-3 relative">
                    <Icon icon="solar:magnifer-linear" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={medicalRecordSearch}
                      onChange={(e) => setMedicalRecordSearch(e.target.value)}
                      placeholder="Search medical records by subject, doctor notes, diagnosis, or doctype..."
                      className="pl-9 h-8 text-xs bg-background"
                    />
                    {medicalRecordSearch && (
                      <button
                        onClick={() => setMedicalRecordSearch("")}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="p-4">
                  {filteredMedicalRecords.length > 0 ? (
                    <div className="relative pl-6 space-y-4">
                      {/* Timeline vertical rule */}
                      <div className="absolute left-2.5 top-2 bottom-2 w-0.5 bg-border/80" />

                      {filteredMedicalRecords.map((record, i) => {
                        const docType = record.reference_doctype || "";
                        let iconName = "solar:document-bold-duotone";
                        let iconColor = "text-blue-500 bg-blue-500/10";
                        if (docType.includes("Encounter")) {
                          iconName = "solar:stethoscope-bold-duotone";
                          iconColor = "text-indigo-500 bg-indigo-500/10";
                        } else if (docType.includes("Vital")) {
                          iconName = "solar:heart-pulse-bold-duotone";
                          iconColor = "text-rose-500 bg-rose-500/10";
                        } else if (docType.includes("Lab")) {
                          iconName = "solar:test-tube-bold-duotone";
                          iconColor = "text-amber-500 bg-amber-500/10";
                        } else if (docType.includes("Prescription") || docType.includes("Medication")) {
                          iconName = "solar:pill-bold-duotone";
                          iconColor = "text-purple-500 bg-purple-500/10";
                        } else if (docType.includes("Appointment")) {
                          iconName = "solar:calendar-bold-duotone";
                          iconColor = "text-emerald-500 bg-emerald-500/10";
                        }

                        return (
                          <div key={record.id || i} className="relative group">
                            {/* Pin icon on the timeline */}
                            <div className={cn(
                              "absolute -left-6 top-1 w-5 h-5 rounded-full flex items-center justify-center border-2 border-background shadow-2xs",
                              iconColor
                            )}>
                              <Icon icon={iconName} size={11} />
                            </div>

                            {/* Card Content */}
                            <div className="p-3 rounded-xl border bg-card hover:bg-muted/10 transition-colors shadow-2xs">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1.5">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-foreground">
                                    {record.subject || "Medical Record"}
                                  </span>
                                  {record.reference_doctype && (
                                    <Badge variant="outline" className="text-[10px] font-semibold py-0">
                                      {record.reference_doctype}
                                    </Badge>
                                  )}
                                </div>
                                <span className="text-[11px] font-mono text-muted-foreground">
                                  {record.communication_date || "—"}
                                </span>
                              </div>

                              <p className="text-xs text-muted-foreground whitespace-pre-line leading-relaxed">
                                {record.content}
                              </p>

                              {record.reference_name && (
                                <div className="mt-2 pt-1.5 border-t border-border/40 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                                  <span>Reference:</span>
                                  <span className="font-mono font-medium text-foreground">{record.reference_name}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-10 text-muted-foreground">
                      <Icon icon="solar:clipboard-remove-linear" size={36} className="mx-auto mb-2 opacity-40 text-blue-500" />
                      <p className="text-xs font-semibold text-foreground">No Medical Records Found</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {medicalRecordSearch || medicalRecordTypeFilter !== "all"
                          ? "No records matched your current query or category filter."
                          : "Clinical activities and notes are automatically synthesized here from patient encounters and orders."}
                      </p>
                      {(medicalRecordSearch || medicalRecordTypeFilter !== "all") && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setMedicalRecordSearch("");
                            setMedicalRecordTypeFilter("all");
                          }}
                          className="mt-3 h-7 text-xs"
                        >
                          Clear Filters
                        </Button>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Marley Document Timeline: Comments & Activity */}
          <DocumentTimeline
            doctype="Patient"
            docname={String(id)}
            altDocname={patient?.patient_id}
            activity={activity}
            onActivityRefresh={loadPatient}
          />
        </div>

        {/* Right Sidebar */}
        <DocumentSidebar
          doctype="Patient"
          docname={id || "new"}
          displayName={patient.patient_name}
          initials={getInitials(`${patient.first_name || ""} ${patient.last_name || ""}`, "P")}
          avatarColor="bg-red-100 text-red-700"
          createdAt={patient.creation || (patient as any).created_at}
          modifiedAt={patient.modified || (patient as any).updated_at}
          createdBy={patient.owner}
          modifiedBy={patient.modified_by}
        />
      </div>

      {/* Edit Address Modal */}
      <Dialog open={showAddressModal} onOpenChange={setShowAddressModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Patient Address</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs font-medium">Street Address / Residence</Label>
              <textarea
                className="w-full border rounded-md px-3 py-2 text-sm mt-1 min-h-[80px]"
                placeholder="Street address, building, apartment..."
                value={addressForm.address}
                onChange={(e) => setAddressForm({ ...addressForm, address: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-medium">City</Label>
                <Input
                  className="mt-1"
                  placeholder="City"
                  value={addressForm.city}
                  onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs font-medium">State / Province</Label>
                <Input
                  className="mt-1"
                  placeholder="State / Province"
                  value={addressForm.state}
                  onChange={(e) => setAddressForm({ ...addressForm, state: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-medium">Postal Code / Pincode</Label>
                <Input
                  className="mt-1"
                  placeholder="Postal Code"
                  value={addressForm.pincode}
                  onChange={(e) => setAddressForm({ ...addressForm, pincode: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs font-medium">Country</Label>
                <Input
                  className="mt-1"
                  placeholder="Country"
                  value={addressForm.country}
                  onChange={(e) => setAddressForm({ ...addressForm, country: e.target.value })}
                />
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowAddressModal(false)} disabled={addressSaving}>
              Cancel
            </Button>
            <Button onClick={handleSaveAddress} disabled={addressSaving}>
              {addressSaving ? "Saving..." : "Save Address"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Contact Modal */}
      <Dialog open={showContactModal} onOpenChange={setShowContactModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Contact Details</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs font-medium">Mobile Phone</Label>
              <Input
                className="mt-1"
                placeholder="+1 (555) 000-0000"
                value={contactForm.mobile}
                onChange={(e) => setContactForm({ ...contactForm, mobile: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-xs font-medium">Landline / Alternate Phone</Label>
              <Input
                className="mt-1"
                placeholder="Alternate phone number"
                value={contactForm.phone}
                onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-xs font-medium">Email Address</Label>
              <Input
                type="email"
                className="mt-1"
                placeholder="patient@example.com"
                value={contactForm.email}
                onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-xs font-medium">Report Delivery Preference</Label>
              <select
                className="w-full border rounded-md px-3 py-2 text-sm mt-1 bg-background"
                value={contactForm.report_preference}
                onChange={(e) => setContactForm({ ...contactForm, report_preference: e.target.value })}
              >
                <option value="Email">Email</option>
                <option value="Print">Print</option>
                <option value="Pdf">PDF</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowContactModal(false)} disabled={contactSaving}>
              Cancel
            </Button>
            <Button onClick={handleSaveContact} disabled={contactSaving}>
              {contactSaving ? "Saving..." : "Save Contact"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Patient Relation Modal */}
      <Dialog open={showRelationModal} onOpenChange={setShowRelationModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingRelationId ? "Edit Patient Relation" : "Add Patient Relation"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-medium">Relation Type *</Label>
                <select
                  className="w-full border rounded-md px-3 py-2 text-sm mt-1 bg-background"
                  value={relationForm.relation}
                  onChange={(e) => setRelationForm({ ...relationForm, relation: e.target.value })}
                >
                  <option value="Father">Father</option>
                  <option value="Mother">Mother</option>
                  <option value="Spouse">Spouse</option>
                  <option value="Siblings">Siblings</option>
                  <option value="Family">Family</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <Label className="text-xs font-medium">Link Existing Patient (Optional)</Label>
                <select
                  className="w-full border rounded-md px-3 py-2 text-sm mt-1 bg-background"
                  value={relationForm.related_patient || ""}
                  onChange={(e) => {
                    const val = e.target.value ? Number(e.target.value) : null;
                    const selected = availablePatients.find((p) => p.id === val);
                    setRelationForm({
                      ...relationForm,
                      related_patient: val,
                      contact_name: selected ? selected.patient_name : relationForm.contact_name,
                      contact_phone: selected ? (selected.mobile || selected.phone || "") : relationForm.contact_phone,
                    });
                  }}
                >
                  <option value="">None (External Person)</option>
                  {availablePatients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.patient_name} ({p.patient_id})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <Label className="text-xs font-medium">Contact Person Name</Label>
              <Input
                className="mt-1"
                placeholder="Relative or Emergency Contact Full Name"
                value={relationForm.contact_name}
                onChange={(e) => setRelationForm({ ...relationForm, contact_name: e.target.value })}
              />
            </div>

            <div>
              <Label className="text-xs font-medium">Contact Phone Number</Label>
              <Input
                className="mt-1"
                placeholder="Phone number"
                value={relationForm.contact_phone}
                onChange={(e) => setRelationForm({ ...relationForm, contact_phone: e.target.value })}
              />
            </div>

            <div>
              <Label className="text-xs font-medium">Notes / Description</Label>
              <textarea
                className="w-full border rounded-md px-3 py-2 text-sm mt-1 min-h-[70px]"
                placeholder="Additional notes, emergency instructions..."
                value={relationForm.description}
                onChange={(e) => setRelationForm({ ...relationForm, description: e.target.value })}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowRelationModal(false)} disabled={relationSaving}>
              Cancel
            </Button>
            <Button onClick={handleSaveRelation} disabled={relationSaving}>
              {relationSaving ? "Saving..." : editingRelationId ? "Update Relation" : "Add Relation"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Inpatient Records Modal (Marley Parity) */}
      {patient && (
        <InpatientRecordsModal
          open={showInpatientRecordsModal}
          onOpenChange={setShowInpatientRecordsModal}
          patientId={patient.id}
          patientName={patient.patient_name}
          records={patientInpatients}
          onRefresh={loadPatient}
        />
      )}

      {/* Inpatient Admission Modal (Marley Parity) */}
      {patient && (
        <InpatientAdmissionModal
          open={showAdmissionModal}
          onOpenChange={setShowAdmissionModal}
          patientId={patient.id}
          patientName={patient.patient_name}
          onSuccess={() => {
            loadPatient();
          }}
        />
      )}

      {/* New Medication Request Modal (Marley Parity) */}
      <NewMedicationRequestModal
        open={newMedReqModalOpen}
        onOpenChange={setNewMedReqModalOpen}
        defaultPatientId={patient ? patient.id : undefined}
        defaultPatientName={patient?.patient_name}
        onSuccess={loadPatient}
      />

      {/* New Therapy Plan Modal (Marley Parity) */}
      <NewTherapyPlanModal
        open={newTherapyPlanModalOpen}
        onOpenChange={setNewTherapyPlanModalOpen}
        defaultPatientId={patient ? patient.id : undefined}
        defaultPatientName={patient?.patient_name}
        onSuccess={loadPatient}
      />

      {/* New Therapy Session Modal (Marley Parity) */}
      <NewTherapySessionModal
        open={newTherapySessionModalOpen}
        onOpenChange={setNewTherapySessionModalOpen}
        defaultPatientId={patient ? patient.id : undefined}
        defaultPatientName={patient?.patient_name}
        onSuccess={loadPatient}
      />

      {/* EEU Digital Medical ID Card Modal */}
      <EEUMedicalIdCardModal
        patient={patient}
        open={showIdCardModal}
        onClose={() => setShowIdCardModal(false)}
      />
    </div>
  );
}
