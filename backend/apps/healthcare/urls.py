"""
Healthcare Module URL Patterns

Organized by domain:
- Core: Departments, Service Units, Patients, Practitioners
- Schedules: Practitioner Schedules, Availability
- Appointments: Patient Appointments, Types
- Clinical: Encounters, Vital Signs, Prescriptions
- Diagnostics: Lab Tests, Observations, Procedures
- Therapy: Therapy Plans, Sessions, Exercises
- Insurance: Payors, Claims, Policies
- Inpatient: Records, Discharge, Emergency
- Medications: Medications, Drug Interactions
- Reference: Dosage Forms, Body Parts, etc.
- Document Management: Assignments, Attachments, Tags
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()

# ════════════════════════════════════════════════════════════════════════════
# CORE / SETUP
# ════════════════════════════════════════════════════════════════════════════
router.register(r"departments", views.MedicalDepartmentViewSet)
router.register(r"service-unit-types", views.HealthcareServiceUnitTypeViewSet)
router.register(r"service-units", views.HealthcareServiceUnitViewSet)
router.register(r"patients", views.PatientViewSet)
router.register(r"practitioners", views.HealthcarePractitionerViewSet)
router.register(r"healthcare-settings", views.HealthcareSettingsViewSet)

# ════════════════════════════════════════════════════════════════════════════
# SCHEDULES
# ════════════════════════════════════════════════════════════════════════════
router.register(r"practitioner-schedules", views.PractitionerScheduleViewSet)
router.register(r"practitioner-availability", views.PractitionerAvailabilityViewSet)
router.register(r"schedule-time-slots", views.HealthcareScheduleTimeSlotViewSet)
router.register(r"practitioner-service-unit-schedules", views.PractitionerServiceUnitScheduleViewSet)

# ════════════════════════════════════════════════════════════════════════════
# APPOINTMENTS
# ════════════════════════════════════════════════════════════════════════════
router.register(r"appointments", views.PatientAppointmentViewSet)
router.register(r"appointment-types", views.AppointmentTypeConfigViewSet)
router.register(r"appointment-type-service-items", views.AppointmentTypeServiceItemViewSet)
router.register(r"fee-validity", views.FeeValidityViewSet)
router.register(r"fee-validity-references", views.FeeValidityReferenceViewSet)

# ════════════════════════════════════════════════════════════════════════════
# CLINICAL
# ════════════════════════════════════════════════════════════════════════════
router.register(r"vital-signs", views.VitalSignsViewSet)
router.register(r"encounters", views.PatientEncounterViewSet)
router.register(r"diagnoses", views.DiagnosisViewSet)
router.register(r"diagnosis-catalog", views.DiagnosisCatalogViewSet)
router.register(r"symptoms", views.SymptomViewSet)
router.register(r"codification-table", views.CodificationTableViewSet)
router.register(r"clinical-notes", views.ClinicalNoteViewSet)
router.register(r"clinical-note-types", views.ClinicalNoteTypeViewSet)
router.register(r"patient-relations", views.PatientRelationViewSet)

# ════════════════════════════════════════════════════════════════════════════
# PRESCRIPTIONS
# ════════════════════════════════════════════════════════════════════════════
router.register(r"prescriptions", views.DrugPrescriptionViewSet)
router.register(r"lab-prescriptions", views.LabPrescriptionViewSet)
router.register(r"procedure-prescriptions", views.ProcedurePrescriptionViewSet)
router.register(r"medication-requests", views.MedicationRequestViewSet)

# ════════════════════════════════════════════════════════════════════════════
# DIAGNOSTICS
# ════════════════════════════════════════════════════════════════════════════
router.register(r"lab-test-templates", views.LabTestTemplateViewSet)
router.register(r"lab-tests", views.LabTestViewSet)
router.register(r"lab-test-samples", views.LabTestSampleViewSet)
router.register(r"lab-test-uoms", views.LabTestUOMViewSet)
router.register(r"procedure-templates", views.ClinicalProcedureTemplateViewSet)
router.register(r"procedures", views.ClinicalProcedureViewSet)
router.register(r"observations", views.ObservationViewSet)
router.register(r"observation-templates", views.ObservationTemplateViewSet)
router.register(r"observation-reference-ranges", views.ObservationReferenceRangeViewSet)
router.register(r"diagnostic-reports", views.DiagnosticReportViewSet)
router.register(r"sample-collections", views.SampleCollectionViewSet)
router.register(r"patient-medical-records", views.PatientMedicalRecordViewSet)

# ════════════════════════════════════════════════════════════════════════════
# THERAPY
# ════════════════════════════════════════════════════════════════════════════
router.register(r"therapy-types", views.TherapyTypeViewSet)
router.register(r"therapy-plans", views.TherapyPlanViewSet)
router.register(r"therapy-sessions", views.TherapySessionViewSet)
router.register(r"exercises", views.ExerciseViewSet)
router.register(r"exercise-types", views.ExerciseTypeViewSet)
router.register(r"exercise-difficulty-levels", views.ExerciseDifficultyLevelViewSet)
router.register(r"treatment-plan-templates", views.TreatmentPlanTemplateViewSet)
router.register(r"treatment-plan-template-items", views.TreatmentPlanTemplateItemViewSet)
router.register(r"treatment-plan-template-practitioners", views.TreatmentPlanTemplatePractitionerViewSet)
router.register(r"therapy-plan-templates", views.TherapyPlanTemplateViewSet)
router.register(r"therapy-plan-details", views.TherapyPlanDetailViewSet)
router.register(r"treatment-counselling", views.TreatmentCounsellingViewSet)

# ════════════════════════════════════════════════════════════════════════════
# INSURANCE
# ════════════════════════════════════════════════════════════════════════════
router.register(r"insurance-payors", views.InsurancePayorViewSet)
router.register(r"insurance-payor-contracts", views.InsurancePayorContractViewSet)
router.register(r"patient-insurance-policies", views.PatientInsurancePolicyViewSet)
router.register(r"insurance-claims", views.InsuranceClaimViewSet)
router.register(r"insurance-claim-coverages", views.InsuranceClaimCoverageViewSet)
router.register(r"patient-insurance-coverages", views.PatientInsuranceCoverageViewSet)
router.register(r"insurance-eligibility-plans", views.InsurancePayorEligibilityPlanViewSet)
router.register(r"item-insurance-eligibility", views.ItemInsuranceEligibilityViewSet)

# ════════════════════════════════════════════════════════════════════════════
# INPATIENT / EMERGENCY / NURSING
# ════════════════════════════════════════════════════════════════════════════
router.register(r"inpatient-records", views.InpatientRecordViewSet)
router.register(r"inpatient-medication-entries", views.InpatientMedicationEntryViewSet)
router.register(r"inpatient-occupancies", views.InpatientOccupancyViewSet)
router.register(r"inpatient-medication-orders", views.InpatientMedicationOrderViewSet)
router.register(r"inpatient-medication-order-entries", views.InpatientMedicationOrderEntryViewSet)
router.register(r"inpatient-record-items", views.InpatientRecordItemViewSet)
router.register(r"emergency-records", views.EmergencyRecordViewSet)
router.register(r"emergency-occupancies", views.EmergencyOccupancyViewSet)
router.register(r"discharge-summaries", views.DischargeSummaryViewSet)
router.register(r"nursing-tasks", views.NursingTaskViewSet)
router.register(r"nursing-checklist-templates", views.NursingChecklistTemplateViewSet)

# ════════════════════════════════════════════════════════════════════════════
# MEDICATIONS
# ════════════════════════════════════════════════════════════════════════════
router.register(r"medications", views.MedicationViewSet)
router.register(r"medication-ingredients", views.MedicationIngredientViewSet)
router.register(r"medication-linked-items", views.MedicationLinkedItemViewSet)
router.register(r"drug-interactions", views.DrugInteractionViewSet)
router.register(r"medication-classes", views.MedicationClassViewSet)
router.register(r"medication-class-interactions", views.MedicationClassInteractionViewSet)
router.register(r"medication-override-reason-codes", views.MedicationOverrideReasonCodeViewSet)
router.register(r"antibiotics", views.AntibioticViewSet)
router.register(r"body-part-links", views.BodyPartLinkViewSet)
router.register(r"pharmacy", views.PharmacyViewSet, basename="pharmacy")
router.register(r"pharmacy-warehouses", views.PharmacyWarehouseViewSet)
router.register(r"pharmacy-stocks", views.PharmacyStockViewSet)
router.register(r"pharmacy-stock-entries", views.PharmacyStockEntryViewSet)

# ════════════════════════════════════════════════════════════════════════════
# ALLERGIES
# ════════════════════════════════════════════════════════════════════════════
router.register(r"allergies", views.AllergyViewSet)
router.register(r"allergy-interactions", views.AllergyInteractionViewSet)

# ════════════════════════════════════════════════════════════════════════════
# ASSESSMENTS & SERVICE REQUESTS
# ════════════════════════════════════════════════════════════════════════════
router.register(r"assessments", views.PatientAssessmentViewSet)
router.register(r"assessment-templates", views.PatientAssessmentTemplateViewSet)
router.register(r"service-request-categories", views.ServiceRequestCategoryViewSet)
router.register(r"service-requests", views.ServiceRequestViewSet)
router.register(r"service-request-reasons", views.ServiceRequestReasonViewSet)

# ════════════════════════════════════════════════════════════════════════════
# REFERENCE DATA
# ════════════════════════════════════════════════════════════════════════════
router.register(r"dosage-forms", views.DosageFormViewSet)
router.register(r"dosage-strengths", views.DosageStrengthViewSet)
router.register(r"prescription-dosages", views.PrescriptionDosageViewSet)
router.register(r"prescription-durations", views.PrescriptionDurationViewSet)
router.register(r"body-parts", views.BodyPartViewSet)
router.register(r"sample-types", views.SampleTypeViewSet)
router.register(r"patient-care-types", views.PatientCareTypeViewSet)
router.register(r"complaints", views.ComplaintViewSet)
router.register(r"triage-levels", views.TriageLevelViewSet)
router.register(r"healthcare-activities", views.HealthcareActivityViewSet)
router.register(r"organisms", views.OrganismViewSet)
router.register(r"sensitivities", views.SensitivityViewSet)
router.register(r"sensitivity-test-results", views.SensitivityTestResultViewSet)
router.register(r"descriptive-test-results", views.DescriptiveTestResultViewSet)
router.register(r"organism-test-results", views.OrganismTestResultViewSet)
router.register(r"specimens", views.SpecimenViewSet)
router.register(r"code-systems", views.CodeSystemViewSet)
router.register(r"code-values", views.CodeValueViewSet)
router.register(r"normal-test-templates", views.NormalTestTemplateViewSet)
router.register(r"descriptive-test-templates", views.DescriptiveTestTemplateViewSet)
router.register(r"lab-test-groups", views.LabTestGroupTemplateViewSet)
router.register(r"normal-test-results", views.NormalTestResultViewSet)
router.register(r"patient-history-settings", views.PatientHistorySettingsViewSet)
router.register(r"patient-medical-record-templates", views.PatientMedicalRecordTemplateViewSet)
router.register(r"service-unit-type-items", views.ServiceUnitTypeItemViewSet)

# ════════════════════════════════════════════════════════════════════════════
# DOCUMENT MANAGEMENT & CLINICAL DOCUMENTS
# ════════════════════════════════════════════════════════════════════════════
router.register(r"doc-assignments", views.DocumentAssignmentViewSet)
router.register(r"doc-attachments", views.DocumentAttachmentViewSet)
router.register(r"doc-tags", views.DocumentTagViewSet)
router.register(r"external-referrals", views.ExternalReferralViewSet)
router.register(r"medical-leave-slips", views.MedicalLeaveSlipViewSet)

# ════════════════════════════════════════════════════════════════════════════
# EEU OCCUPATIONAL HEALTH & ELECTRICAL SAFETY
# ════════════════════════════════════════════════════════════════════════════
router.register(r"eeu-incidents", views.EEUWorkplaceIncidentViewSet)
router.register(r"eeu-fitness-evaluations", views.EEUFitnessEvaluationViewSet)
router.register(r"eeu-first-aid-kits", views.EEUFirstAidKitViewSet)
router.register(r"eeu-emergency-sos", views.EEUEmergencySOSViewSet)
router.register(r"eeu-pme-campaigns", views.EEUPMECampaignViewSet)
router.register(r"eeu-toxic-surveillance", views.EEUToxicSurveillanceViewSet)

# ════════════════════════════════════════════════════════════════════════════
# PAYMENTS
# ════════════════════════════════════════════════════════════════════════════
router.register(r"payments", views.HealthcarePaymentRecordViewSet)
router.register(r"dashboard", views.HealthcareDashboardViewSet, basename="healthcare-dashboard")
router.register(r"lab-dashboard", views.LabDashboardViewSet, basename="lab-dashboard")


from .realtime import realtime_event_stream, broadcast_test_notification

urlpatterns = [
    path("", include(router.urls)),
    path("realtime/stream/", realtime_event_stream, name="healthcare-realtime-stream"),
    path("realtime/broadcast/", broadcast_test_notification, name="healthcare-realtime-broadcast"),
]
