from django.contrib import admin
from .models import (
    MedicalDepartment, HealthcareServiceUnitType, HealthcareServiceUnit,
    Patient, HealthcarePractitioner, PractitionerSchedule, PractitionerAvailability,
    PatientAppointment, VitalSigns, PatientEncounter, Diagnosis, Symptom,
    DrugPrescription, MedicationRequest, LabTestTemplate, LabTest, LabTestSample,
    ClinicalProcedureTemplate, ClinicalProcedure,
    TherapyType, TherapyPlan, TherapySession, Exercise, TreatmentPlanTemplate,
    InsurancePayor, InsurancePayorContract, PatientInsurancePolicy, InsuranceClaim,
    InpatientRecord, InpatientMedicationEntry, InpatientOccupancy,
    Observation, ClinicalNote, HealthcareSettings, FeeValidity,
)

admin.site.register(MedicalDepartment)
admin.site.register(HealthcareServiceUnitType)
admin.site.register(HealthcareServiceUnit)
admin.site.register(Patient)
admin.site.register(HealthcarePractitioner)
admin.site.register(PractitionerSchedule)
admin.site.register(PractitionerAvailability)
admin.site.register(PatientAppointment)
admin.site.register(VitalSigns)
admin.site.register(PatientEncounter)
admin.site.register(Diagnosis)
admin.site.register(Symptom)
admin.site.register(DrugPrescription)
admin.site.register(MedicationRequest)
admin.site.register(LabTestTemplate)
admin.site.register(LabTest)
admin.site.register(LabTestSample)
admin.site.register(ClinicalProcedureTemplate)
admin.site.register(ClinicalProcedure)
admin.site.register(TherapyType)
admin.site.register(TherapyPlan)
admin.site.register(TherapySession)
admin.site.register(Exercise)
admin.site.register(TreatmentPlanTemplate)
admin.site.register(InsurancePayor)
admin.site.register(InsurancePayorContract)
admin.site.register(PatientInsurancePolicy)
admin.site.register(InsuranceClaim)
admin.site.register(InpatientRecord)
admin.site.register(InpatientMedicationEntry)
admin.site.register(InpatientOccupancy)
admin.site.register(Observation)
admin.site.register(ClinicalNote)
admin.site.register(HealthcareSettings)
admin.site.register(FeeValidity)
