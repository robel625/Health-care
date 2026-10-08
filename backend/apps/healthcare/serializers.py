from rest_framework import serializers
from .models import (
    PharmacyWarehouse, PharmacyStock, PharmacyStockEntry,
    MedicalDepartment, HealthcareServiceUnitType, HealthcareServiceUnit,
    Patient, HealthcarePractitioner, PractitionerSchedule, PractitionerAvailability,
    PatientAppointment, VitalSigns, PatientEncounter, Diagnosis, DiagnosisCatalog, Symptom,
    CodificationTable,
    DrugPrescription, MedicationRequest, LabTestTemplate, LabTest, LabTestSample, LabTestUOM,
    ClinicalProcedureTemplate, ClinicalProcedure,
    TherapyType, TherapyPlan, TherapySession, Exercise, TreatmentPlanTemplate,
    InsurancePayor, InsurancePayorContract, PatientInsurancePolicy, InsuranceClaim,
    InpatientRecord, InpatientMedicationEntry, InpatientMedicationEntryDetail, InpatientOccupancy,
    Observation, ClinicalNote, HealthcareSettings, FeeValidity,
    DosageForm, DosageStrength, BodyPart, SampleType, PatientCareType,
    AppointmentTypeConfig, MedicationClass, Complaint, TriageLevel, HealthcareActivity,
    Medication, MedicationIngredient, MedicationLinkedItem, DrugInteraction,
    Allergy, AllergyInteraction, PatientRelation,
    EmergencyRecord, DischargeSummary, NursingTask, NursingChecklistTemplate,
    PatientAssessmentTemplate, PatientAssessment,
    ServiceRequestCategory, ServiceRequest, TreatmentCounselling,
    InpatientMedicationOrder, InsuranceClaimCoverage, PatientInsuranceCoverage,
    HealthcarePaymentRecord,
    PrescriptionDosage, PrescriptionDuration, LabPrescription, ProcedurePrescription,
    DiagnosticReport, SampleCollection, PatientMedicalRecord,
    Organism, Sensitivity, SensitivityTestResult, Specimen, EmergencyOccupancy,
    ClinicalNoteType, CodeSystem, CodeValue, ExerciseType, ExerciseDifficultyLevel,
    NormalTestResult, DescriptiveTestResult, OrganismTestResult,
    NormalTestTemplate, DescriptiveTestTemplate,
    LabTestGroupTemplate, ObservationTemplate, ObservationReferenceRange,
    ObservationSampleCollection, TherapyPlanTemplate as TherapyPlanTemplateModel,
    TherapyPlanDetail, TreatmentPlanTemplateItem, TreatmentPlanTemplatePractitioner,
    MedicationClassInteraction, MedicationOverrideReasonCode,
    HealthcareScheduleTimeSlot, PractitionerServiceUnitSchedule,
    Antibiotic, BodyPartLink, InpatientMedicationOrderEntry, InpatientRecordItem,
    ServiceRequestReason, FeeValidityReference, PatientHistorySettings,
    PatientMedicalRecordTemplate, AppointmentTypeServiceItem, ServiceUnitTypeItem,
    InsurancePayorEligibilityPlan, ItemInsuranceEligibility,
    DocumentAssignment, DocumentAttachment, DocumentTag,
    ExternalReferral, MedicalLeaveSlip,
    EEUWorkplaceIncident, EEUFitnessEvaluation, EEUFirstAidKit,
    EEUEmergencySOS, EEUPMECampaign, EEUToxicSurveillance,
)


# ── Department & Service Unit ─────────────────────────────────────────────

class MedicalDepartmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = MedicalDepartment
        fields = "__all__"


class HealthcareServiceUnitTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = HealthcareServiceUnitType
        fields = "__all__"


class HealthcareServiceUnitSerializer(serializers.ModelSerializer):
    service_unit_type_name = serializers.CharField(
        source="service_unit_type.service_unit_type", read_only=True, default=""
    )

    class Meta:
        model = HealthcareServiceUnit
        fields = "__all__"


# ── Patient ────────────────────────────────────────────────────────────────

class PatientSerializer(serializers.ModelSerializer):
    patient_name_display = serializers.SerializerMethodField()
    tags = serializers.SerializerMethodField()
    inpatient_record_name = serializers.CharField(source="inpatient_record.record_id", read_only=True, default="")
    inpatient_service_unit_name = serializers.CharField(source="inpatient_record.service_unit.service_unit_name", read_only=True, default="")
    inpatient_practitioner_name = serializers.CharField(source="inpatient_record.practitioner.practitioner_name", read_only=True, default="")
    company_name = serializers.CharField(source="company.company_name", read_only=True, default="")
    employer_code = serializers.CharField(read_only=True)
    last_name = serializers.CharField(required=False, allow_blank=True, default="")
    middle_name = serializers.CharField(required=False, allow_blank=True, default="")
    dob = serializers.DateField(required=False, allow_null=True)

    class Meta:
        model = Patient
        fields = "__all__"

    def to_internal_value(self, data):
        data = data.copy() if hasattr(data, "copy") else dict(data)
        nullable_fields = [
            "dob", "age", "company", "default_currency",
            "inpatient_record", "emergency_record", "user"
        ]
        for field in nullable_fields:
            if field in data and data[field] in ("", "null", "undefined"):
                data[field] = None

        numeric_defaults = {
            "eeu_annual_benefit_ceiling_etb": 25000.0,
            "eeu_benefit_used_etb": 0.0,
        }
        for field, default_val in numeric_defaults.items():
            if field in data and data[field] in ("", "null", "undefined"):
                data[field] = default_val

        if "last_name" not in data or data["last_name"] is None:
            data["last_name"] = ""
        if "middle_name" not in data or data["middle_name"] is None:
            data["middle_name"] = ""

        return super().to_internal_value(data)

    def get_patient_name_display(self, obj):
        return str(obj)

    def get_tags(self, obj):
        return list(
            DocumentTag.objects.filter(doctype="Patient", docname=str(obj.id)).values_list("tag", flat=True)
        )


class PatientSummarySerializer(serializers.ModelSerializer):
    """Lightweight patient for dropdowns."""
    employer_code = serializers.CharField(read_only=True)

    class Meta:
        model = Patient
        fields = ["id", "patient_id", "patient_name", "sex", "dob", "age",
                  "mobile", "email", "status", "image", "company_affiliation", "employer_code",
                  "eeu_staff_id", "eeu_cadre", "eeu_department", "eeu_annual_benefit_ceiling_etb", "eeu_benefit_used_etb"]


# ── Practitioner ───────────────────────────────────────────────────────────

class HealthcarePractitionerSerializer(serializers.ModelSerializer):
    practitioner_name_display = serializers.SerializerMethodField()
    department_name = serializers.CharField(
        source="department.department", read_only=True, default=""
    )
    op_consulting_charge_item_name = serializers.CharField(
        source="op_consulting_charge_item.item_name", read_only=True, default=""
    )
    inpatient_visit_charge_item_name = serializers.CharField(
        source="inpatient_visit_charge_item.item_name", read_only=True, default=""
    )

    class Meta:
        model = HealthcarePractitioner
        fields = "__all__"

    def get_practitioner_name_display(self, obj):
        return str(obj)


class PractitionerSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = HealthcarePractitioner
        fields = ["id", "practitioner_id", "practitioner_name", "designation",
                  "department", "status", "practitioner_type", "image"]


class PractitionerScheduleSerializer(serializers.ModelSerializer):
    practitioner_name = serializers.CharField(
        source="practitioner.practitioner_name", read_only=True, default=""
    )

    class Meta:
        model = PractitionerSchedule
        fields = "__all__"


class PractitionerAvailabilitySerializer(serializers.ModelSerializer):
    practitioner_name = serializers.CharField(
        source="practitioner.practitioner_name", read_only=True, default=""
    )

    class Meta:
        model = PractitionerAvailability
        fields = "__all__"


# ── Appointment ────────────────────────────────────────────────────────────

class PatientAppointmentSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source="patient.patient_name", read_only=True, default="")
    practitioner_name = serializers.CharField(
        source="practitioner.practitioner_name", read_only=True, default=""
    )
    department_name = serializers.CharField(source="department.department", read_only=True, default="")
    appointment_type_name = serializers.CharField(source="appointment_type.appointment_type", read_only=True, default="")
    appointment_type_color = serializers.CharField(source="appointment_type.color", read_only=True, default="#4F46E5")
    insurance_policy_name = serializers.CharField(source="insurance_policy.policy_number", read_only=True, default="")
    insurance_payor_name = serializers.CharField(source="insurance_payor.payor_name", read_only=True, default="")
    referring_practitioner_name = serializers.CharField(source="referring_practitioner.practitioner_name", read_only=True, default="")
    appointment_time_12h = serializers.SerializerMethodField()

    class Meta:
        model = PatientAppointment
        fields = "__all__"

    def get_appointment_time_12h(self, obj):
        if not obj.appointment_time:
            return ""
        return obj.appointment_time.strftime("%I:%M %p").lstrip("0")

    def to_internal_value(self, data):
        if hasattr(data, "copy"):
            data = data.copy()
        else:
            data = dict(data)

        # 1. Normalize appointment_time (e.g. "", "09:30", "9:30 AM", "09:30:00")
        raw_time = data.get("appointment_time")
        if raw_time is not None:
            if isinstance(raw_time, str):
                raw_time = raw_time.strip()
                if not raw_time:
                    data["appointment_time"] = None
                else:
                    from datetime import datetime
                    parsed = None
                    for fmt in ("%H:%M:%S", "%H:%M", "%I:%M %p", "%I:%M%p", "%I:%M:%S %p"):
                        try:
                            parsed = datetime.strptime(raw_time, fmt).time()
                            break
                        except ValueError:
                            pass
                    if parsed:
                        data["appointment_time"] = parsed.strftime("%H:%M:%S")
                    else:
                        data["appointment_time"] = None

        # 2. Resolve ForeignKey fields that can be passed as strings or empty strings
        # Resolve patient
        raw_pat = data.get("patient")
        if raw_pat is not None:
            if isinstance(raw_pat, str):
                raw_pat = raw_pat.strip()
                if raw_pat.isdigit():
                    data["patient"] = int(raw_pat)
                elif raw_pat:
                    pat = Patient.objects.filter(patient_id__iexact=raw_pat).first() or \
                          Patient.objects.filter(patient_name__iexact=raw_pat).first()
                    data["patient"] = pat.id if pat else None
                else:
                    data["patient"] = None

        # Resolve practitioner
        raw_prac = data.get("practitioner")
        if raw_prac is not None:
            if isinstance(raw_prac, str):
                raw_prac = raw_prac.strip()
                if raw_prac.isdigit():
                    data["practitioner"] = int(raw_prac)
                elif raw_prac:
                    prac = HealthcarePractitioner.objects.filter(practitioner_id__iexact=raw_prac).first() or \
                           HealthcarePractitioner.objects.filter(practitioner_name__iexact=raw_prac).first()
                    data["practitioner"] = prac.id if prac else None
                else:
                    data["practitioner"] = None

        # Resolve appointment_type
        raw_type = data.get("appointment_type")
        if raw_type is not None:
            if isinstance(raw_type, str):
                raw_type = raw_type.strip()
                if raw_type.isdigit():
                    data["appointment_type"] = int(raw_type)
                elif raw_type:
                    at = AppointmentTypeConfig.objects.filter(appointment_type__iexact=raw_type).first()
                    data["appointment_type"] = at.id if at else None
                else:
                    data["appointment_type"] = None

        # Resolve department
        raw_dept = data.get("department")
        if raw_dept is not None:
            if isinstance(raw_dept, str):
                raw_dept = raw_dept.strip()
                if raw_dept.isdigit():
                    data["department"] = int(raw_dept)
                elif raw_dept:
                    dept = MedicalDepartment.objects.filter(department__iexact=raw_dept).first()
                    data["department"] = dept.id if dept else None
                else:
                    data["department"] = None

        # Resolve service_unit
        raw_su = data.get("service_unit")
        if raw_su is not None:
            if isinstance(raw_su, str):
                raw_su = raw_su.strip()
                if raw_su.isdigit():
                    data["service_unit"] = int(raw_su)
                elif raw_su:
                    su = HealthcareServiceUnit.objects.filter(service_unit_name__iexact=raw_su).first()
                    data["service_unit"] = su.id if su else None
                else:
                    data["service_unit"] = None

        # Resolve insurance_policy
        raw_ip = data.get("insurance_policy")
        if raw_ip is not None:
            if isinstance(raw_ip, str):
                raw_ip = raw_ip.strip()
                if raw_ip.isdigit():
                    data["insurance_policy"] = int(raw_ip)
                elif raw_ip:
                    pol = PatientInsurancePolicy.objects.filter(policy_number__iexact=raw_ip).first()
                    data["insurance_policy"] = pol.id if pol else None
                else:
                    data["insurance_policy"] = None

        # Resolve insurance_payor
        raw_payor = data.get("insurance_payor")
        if raw_payor is not None:
            if isinstance(raw_payor, str):
                raw_payor = raw_payor.strip()
                if raw_payor.isdigit():
                    data["insurance_payor"] = int(raw_payor)
                elif raw_payor:
                    payor = InsurancePayor.objects.filter(payor_name__iexact=raw_payor).first() or \
                            InsurancePayor.objects.filter(payor_id__iexact=raw_payor).first()
                    data["insurance_payor"] = payor.id if payor else None
                else:
                    data["insurance_payor"] = None

        # Resolve company
        raw_comp = data.get("company")
        if raw_comp is not None:
            if isinstance(raw_comp, str):
                raw_comp = raw_comp.strip()
                if raw_comp.isdigit():
                    data["company"] = int(raw_comp)
                elif raw_comp:
                    from django.apps import apps
                    Company = apps.get_model("setup", "Company")
                    comp = Company.objects.filter(company_name__iexact=raw_comp).first()
                    data["company"] = comp.id if comp else None
                else:
                    data["company"] = None

        # Resolve referring_practitioner
        raw_ref = data.get("referring_practitioner")
        if raw_ref is not None:
            if isinstance(raw_ref, str):
                raw_ref = raw_ref.strip()
                if raw_ref.isdigit():
                    data["referring_practitioner"] = int(raw_ref)
                elif raw_ref:
                    ref = HealthcarePractitioner.objects.filter(practitioner_id__iexact=raw_ref).first() or \
                          HealthcarePractitioner.objects.filter(practitioner_name__iexact=raw_ref).first()
                    data["referring_practitioner"] = ref.id if ref else None
                else:
                    data["referring_practitioner"] = None

        # Handle any other nullable FK strings
        for optional_fk in (
            "insurance_coverage", "billing_item", "inpatient_record", "emergency_record",
            "service_request", "procedure_template", "procedure_prescription", "therapy_plan", "therapy_type"
        ):
            val = data.get(optional_fk)
            if val is not None and isinstance(val, str):
                val = val.strip()
                data[optional_fk] = int(val) if val.isdigit() else None

        return super().to_internal_value(data)

    def _sync_appointment_fields(self, instance, validated_data):
        from django.utils import timezone
        import datetime

        # Auto-populate patient details if empty
        if instance.patient:
            if not instance.patient_name:
                instance.patient_name = instance.patient.patient_name or f"{instance.patient.first_name} {instance.patient.last_name}".strip()
            if not instance.patient_sex:
                instance.patient_sex = instance.patient.sex or ""
            if not instance.patient_age:
                if instance.patient.dob:
                    ref_date = instance.appointment_date or timezone.now().date()
                    years = ref_date.year - instance.patient.dob.year - ((ref_date.month, ref_date.day) < (instance.patient.dob.month, instance.patient.dob.day))
                    instance.patient_age = f"{years} Y" if years > 0 else f"{(ref_date - instance.patient.dob).days} D"
                elif instance.patient.age:
                    instance.patient_age = str(instance.patient.age)

        # Auto-populate practitioner name if empty
        if instance.practitioner and not instance.practitioner_name:
            instance.practitioner_name = instance.practitioner.practitioner_name or f"{instance.practitioner.first_name} {instance.practitioner.last_name}".strip()

        # Auto-populate department from practitioner if empty
        if not instance.department and instance.practitioner and instance.practitioner.department:
            instance.department = instance.practitioner.department

        # Compute appointment_datetime and appointment_end_datetime
        if instance.appointment_date and instance.appointment_time:
            comb = datetime.datetime.combine(instance.appointment_date, instance.appointment_time)
            if timezone.is_naive(comb):
                comb = timezone.make_aware(comb, timezone.get_current_timezone())
            instance.appointment_datetime = comb
            duration_mins = instance.duration or 30
            instance.appointment_end_datetime = comb + datetime.timedelta(minutes=duration_mins)

        # Title
        if not instance.title:
            pat_disp = instance.patient_name or (str(instance.patient) if instance.patient else "Patient")
            time_disp = f" at {instance.appointment_time.strftime('%H:%M')}" if instance.appointment_time else ""
            instance.title = f"{pat_disp} - {instance.appointment_date}{time_disp}"

    def create(self, validated_data):
        instance = super().create(validated_data)
        self._sync_appointment_fields(instance, validated_data)
        instance.save()
        return instance

    def update(self, instance, validated_data):
        instance = super().update(instance, validated_data)
        self._sync_appointment_fields(instance, validated_data)
        instance.save()
        return instance


# ── Vital Signs ────────────────────────────────────────────────────────────

class VitalSignsSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source="patient.patient_name", read_only=True, default="")
    nutrition_note = serializers.CharField(required=False, allow_blank=True, default="")

    class Meta:
        model = VitalSigns
        fields = "__all__"


# ── Encounter ──────────────────────────────────────────────────────────────

class DiagnosisCatalogSerializer(serializers.ModelSerializer):
    class Meta:
        model = DiagnosisCatalog
        fields = "__all__"


class DiagnosisSerializer(serializers.ModelSerializer):
    diagnosis_master_name = serializers.CharField(
        source="diagnosis_master.diagnosis", read_only=True, default=""
    )

    class Meta:
        model = Diagnosis
        fields = "__all__"


class SymptomSerializer(serializers.ModelSerializer):
    complaint_master_name = serializers.CharField(
        source="complaint_master.complaint", read_only=True, default=""
    )

    class Meta:
        model = Symptom
        fields = "__all__"


# `PatientEncounterSerializer` is defined further down, after all the child
# serializers it nests — it references them directly, so they must exist first.


# ── Medication ─────────────────────────────────────────────────────────────

class DrugPrescriptionSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source="patient.patient_name", read_only=True, default="")
    practitioner_name = serializers.CharField(
        source="practitioner.practitioner_name", read_only=True, default=""
    )
    dosage_form = serializers.CharField(required=False, allow_blank=True, default="Tablet")
    intent = serializers.CharField(required=False, allow_blank=True, default="Order")
    priority = serializers.CharField(required=False, allow_blank=True, default="Routine")
    status = serializers.CharField(required=False, allow_blank=True, default="Active")

    class Meta:
        model = DrugPrescription
        fields = "__all__"
        extra_kwargs = {
            "patient": {"required": False},
            "practitioner": {"required": False},
            "encounter": {"required": False},
        }

    def validate_dosage_form(self, value):
        return value or "Tablet"

    def validate_intent(self, value):
        return value or "Order"

    def validate_priority(self, value):
        return value or "Routine"

    def validate_status(self, value):
        return value or "Active"


class MedicationRequestSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source="patient.patient_name", read_only=True, default="")
    practitioner_name = serializers.CharField(
        source="practitioner.practitioner_name", read_only=True, default=""
    )
    warehouse_name = serializers.CharField(
        source="warehouse.warehouse_name", read_only=True, default=""
    )
    stock_entry_number = serializers.CharField(
        source="stock_entry.stock_entry_number", read_only=True, default=""
    )
    dispensed_by_name = serializers.CharField(
        source="dispensed_by.username", read_only=True, default=""
    )
    order_number = serializers.CharField(source="request_id", read_only=True, default="")
    patient_identifier = serializers.CharField(source="patient.patient_id", read_only=True, default="")
    patient_mobile = serializers.CharField(source="patient.mobile", read_only=True, default="")
    patient_email = serializers.CharField(source="patient.email", read_only=True, default="")
    patient_birth_date = serializers.DateField(source="patient.dob", read_only=True, allow_null=True)
    patient_age = serializers.IntegerField(source="patient.age", read_only=True, default=0)
    patient_gender = serializers.CharField(source="patient.gender", read_only=True, default="")
    patient_blood_group = serializers.CharField(source="patient.blood_group", read_only=True, default="")
    inpatient_record = serializers.IntegerField(source="patient.inpatient_record_id", read_only=True, allow_null=True)
    inpatient_status = serializers.CharField(source="patient.inpatient_status", read_only=True, default="")
    practitioner_email = serializers.CharField(source="practitioner.user_id", read_only=True, default="")
    medical_department = serializers.CharField(source="practitioner.department.department_name", read_only=True, default="")
    company_name = serializers.CharField(source="company.company_name", read_only=True, default="")

    class Meta:
        model = MedicationRequest
        fields = "__all__"


class CodificationTableSerializer(serializers.ModelSerializer):
    code_system_name = serializers.CharField(
        source="code_system.code_system", read_only=True, default=""
    )
    code_value_display = serializers.CharField(
        source="code_value.display", read_only=True, default=""
    )

    class Meta:
        model = CodificationTable
        fields = "__all__"


# ── Lab Tests ──────────────────────────────────────────────────────────────
# `CodificationTableSerializer` sits above this section rather than beside the
# encounter: Marley shares that child doctype, so the Lab Test Template nests it
# too, and it has to be defined before either of them.

class NormalTestResultSerializer(serializers.ModelSerializer):
    """A Compound/Single result row on a Lab Test."""
    lab_test_uom_name = serializers.CharField(
        source="lab_test_uom.lab_test_uom", read_only=True, default=""
    )
    secondary_uom_name = serializers.CharField(
        source="secondary_uom.lab_test_uom", read_only=True, default=""
    )

    class Meta:
        model = NormalTestResult
        fields = "__all__"


class DescriptiveTestResultSerializer(serializers.ModelSerializer):
    """A Descriptive result row on a Lab Test."""
    class Meta:
        model = DescriptiveTestResult
        fields = "__all__"


class SensitivityTestResultSerializer(serializers.ModelSerializer):
    """A Sensitivity result row: an antibiotic and its reading."""
    antibiotic_name = serializers.CharField(
        source="antibiotic.antibiotic_name", read_only=True, default=""
    )
    sensitivity_name = serializers.CharField(
        source="antibiotic_sensitivity.sensitivity", read_only=True, default=""
    )

    class Meta:
        model = SensitivityTestResult
        fields = "__all__"


class OrganismTestResultSerializer(serializers.ModelSerializer):
    """An Organism result row on a Descriptive Lab Test."""
    organism_name = serializers.CharField(
        source="organism.organism", read_only=True, default=""
    )
    colony_uom_name = serializers.CharField(
        source="colony_uom.lab_test_uom", read_only=True, default=""
    )

    class Meta:
        model = OrganismTestResult
        fields = "__all__"


class LabTestSerializer(serializers.ModelSerializer):
    """
    Lab Test — Marley's doctype of the same name.

    Child tables are read-only here, exactly as they are on the Lab Test
    Template: rows are written through their own endpoints
    (`normal-test-results`, `descriptive-test-results`,
    `sensitivity-test-results`, `organism-test-results`,
    `codification-table`), so a save can tell an insert from an update or a
    delete. The `patient_name` / `practitioner_name` / `template_name` copies
    Marley stores through `fetch_from` are served from the linked records
    instead of being stored (see the model's docstring).
    """
    patient_name = serializers.CharField(source="patient.patient_name", read_only=True, default="")
    practitioner_name = serializers.CharField(
        source="practitioner.practitioner_name", read_only=True, default=""
    )
    template_name = serializers.CharField(
        source="template.lab_test_name", read_only=True, default=""
    )
    department_name = serializers.CharField(
        source="department.department", read_only=True, default=""
    )
    requesting_department_name = serializers.CharField(
        source="requesting_department.department", read_only=True, default=""
    )
    lab_test_group_name = serializers.CharField(
        source="template.lab_test_group", read_only=True, default=""
    )
    sample_name = serializers.CharField(source="sample.sample", read_only=True, default="")
    specimen_received_by_name = serializers.CharField(
        source="specimen_received_by.username", read_only=True, default=""
    )
    sample_details = serializers.CharField(source="template.sample_details", read_only=True, default="")
    sample_qty = serializers.DecimalField(source="template.sample_qty", max_digits=8, decimal_places=3, read_only=True, default=0)
    sample_uom = serializers.CharField(source="template.sample_uom", read_only=True, default="")
    container_closure_color = serializers.CharField(
        source="template.sample.container_closure_color", read_only=True, default=""
    )
    template_sample_name = serializers.CharField(
        source="template.sample.sample", read_only=True, default=""
    )

    normal_test_items = NormalTestResultSerializer(many=True, read_only=True)
    descriptive_test_items = DescriptiveTestResultSerializer(many=True, read_only=True)
    sensitivity_test_items = SensitivityTestResultSerializer(many=True, read_only=True)
    organism_test_items = OrganismTestResultSerializer(many=True, read_only=True)
    codification_table = CodificationTableSerializer(many=True, read_only=True)

    class Meta:
        model = LabTest
        fields = "__all__"


class LabTestUOMSerializer(serializers.ModelSerializer):
    class Meta:
        model = LabTestUOM
        fields = "__all__"


class LabTestSampleSerializer(serializers.ModelSerializer):
    sample_uom_name = serializers.CharField(
        source="sample_uom.lab_test_uom", read_only=True, default=""
    )
    sample_type_name = serializers.CharField(
        source="sample_type.sample_type", read_only=True, default=""
    )

    class Meta:
        model = LabTestSample
        fields = "__all__"


class NormalTestTemplateSerializer(serializers.ModelSerializer):
    """A Compound-result row of a Lab Test Template."""
    lab_test_uom_name = serializers.CharField(
        source="lab_test_uom.lab_test_uom", read_only=True, default=""
    )
    secondary_uom_name = serializers.CharField(
        source="secondary_uom.lab_test_uom", read_only=True, default=""
    )

    class Meta:
        model = NormalTestTemplate
        fields = "__all__"

    def validate(self, attrs):
        """
        Marley's `validate_conversion_factor`, Compound row by Compound row.

        The rule belongs to the parent in Marley — a child row travels with its
        document — so it fires only under a Compound template, and the parent's
        type is what decides. Rows are written through this endpoint here, so
        the check has to read the parent rather than assume it.
        """
        parent = attrs.get("parent_template") or getattr(self.instance, "parent_template", None)
        if getattr(parent, "lab_test_template_type", None) != "Compound":
            return attrs
        secondary = attrs.get("secondary_uom", getattr(self.instance, "secondary_uom", None))
        factor = attrs.get("conversion_factor", getattr(self.instance, "conversion_factor", None))
        if secondary and not factor:
            raise serializers.ValidationError("Conversion Factor is mandatory")
        return attrs


class DescriptiveTestTemplateSerializer(serializers.ModelSerializer):
    """A Descriptive-result component row of a Lab Test Template."""
    class Meta:
        model = DescriptiveTestTemplate
        fields = "__all__"


class LabTestGroupTemplateSerializer(serializers.ModelSerializer):
    """A Grouped-result row of a Lab Test Template."""
    lab_test_template_name = serializers.CharField(
        source="lab_test_template.lab_test_name", read_only=True, default=""
    )
    group_test_uom_name = serializers.CharField(
        source="group_test_uom.lab_test_uom", read_only=True, default=""
    )
    secondary_uom_name = serializers.CharField(
        source="secondary_uom.lab_test_uom", read_only=True, default=""
    )

    class Meta:
        model = LabTestGroupTemplate
        fields = "__all__"

    def validate(self, attrs):
        """
        Marley's `validate_conversion_factor` for Grouped rows.

        As with the Compound rows, the rule is the parent's and Marley fires it
        only under a Grouped template; and only for an "Add New Line" row — an
        "Add Test" row takes its factor from the template it pulls in.
        """
        parent = attrs.get("parent_template") or getattr(self.instance, "parent_template", None)
        if getattr(parent, "lab_test_template_type", None) != "Grouped":
            return attrs
        kind = attrs.get("template_or_new_line", getattr(self.instance, "template_or_new_line", None))
        secondary = attrs.get("secondary_uom", getattr(self.instance, "secondary_uom", None))
        factor = attrs.get("conversion_factor", getattr(self.instance, "conversion_factor", None))
        if kind == "Add New Line" and secondary and not factor:
            raise serializers.ValidationError("Conversion Factor is mandatory")
        return attrs


class LabTestTemplateSerializer(serializers.ModelSerializer):
    """
    Lab Test Template — Marley's doctype of the same name.

    Child tables are read-only here, exactly as they are on
    `PatientEncounterSerializer`: rows are written through their own endpoints
    (`normal-test-templates`, `descriptive-test-templates`,
    `lab-test-groups`, `codification-table`) so a save can tell an insert from
    an update or a delete.
    """
    department_name = serializers.CharField(source="department.department", read_only=True, default="")
    sample_name = serializers.CharField(source="sample.sample", read_only=True, default="")
    uom_name = serializers.CharField(source="lab_test_uom.lab_test_uom", read_only=True, default="")
    secondary_uom_name = serializers.CharField(
        source="secondary_uom.lab_test_uom", read_only=True, default=""
    )
    lab_test_group_name = serializers.CharField(
        source="lab_test_group", read_only=True, default=""
    )
    item_name = serializers.CharField(source="item", read_only=True, default="")
    nursing_checklist_template_name = serializers.CharField(
        source="nursing_checklist_template.template_name", read_only=True, default=""
    )
    patient_care_type_name = serializers.CharField(
        source="patient_care_type.patient_care_type", read_only=True, default=""
    )
    staff_role_name = serializers.CharField(
        source="staff_role.name", read_only=True, default=""
    )

    normal_test_templates = NormalTestTemplateSerializer(many=True, read_only=True)
    descriptive_test_templates = DescriptiveTestTemplateSerializer(many=True, read_only=True)
    lab_test_groups = LabTestGroupTemplateSerializer(many=True, read_only=True)
    codification_table = CodificationTableSerializer(many=True, read_only=True)

    class Meta:
        model = LabTestTemplate
        fields = "__all__"

    def validate(self, attrs):
        """
        Marley's `LabTestTemplate.validate()`.

        Runs on the merged view of the document and the incoming fields, so an
        update that only touches, say, `lab_test_rate` is still checked against
        the stored `is_billable`. Marley validates a document whose defaults are
        already filled in, so the merge starts from the model's field defaults,
        takes the instance over them on an update, and the incoming fields over
        that — without the defaults, a create that omitted `is_billable` would
        slip past the rate rule. The per-row conversion-factor rule lives on the
        child serializers, since child rows are saved separately.
        """
        merged = {field.name: field.get_default() for field in LabTestTemplate._meta.fields}
        if self.instance is not None:
            for field in LabTestTemplate._meta.fields:
                merged[field.name] = getattr(self.instance, field.attname)
        merged.update(attrs)

        def val(name):
            return merged.get(name)

        if val("is_billable") and not val("link_existing_item"):
            rate = val("lab_test_rate") or 0
            if float(rate) <= 0.0:
                raise serializers.ValidationError(
                    "Standard Selling Rate should be greater than zero."
                )

        if val("sample") and float(val("sample_qty") or 0) <= 0:
            raise serializers.ValidationError(
                {"sample_qty": ["Sample Quantity cannot be negative or 0"]}
            )

        # `validate_conversion_factor` for the Single case; the Compound and
        # Grouped cases are checked on their own rows.
        if val("lab_test_template_type") == "Single":
            if val("secondary_uom") and not val("conversion_factor"):
                raise serializers.ValidationError("Conversion Factor is mandatory")

        return attrs


# ── Clinical Procedure ─────────────────────────────────────────────────────

class ClinicalProcedureTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ClinicalProcedureTemplate
        fields = "__all__"


class ClinicalProcedureSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source="patient.patient_name", read_only=True, default="")
    practitioner_name = serializers.CharField(
        source="practitioner.practitioner_name", read_only=True, default=""
    )

    class Meta:
        model = ClinicalProcedure
        fields = "__all__"


# ── Therapy ────────────────────────────────────────────────────────────────

class TherapyTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = TherapyType
        fields = "__all__"


class TherapySessionSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source="patient.patient_name", read_only=True, default="")
    practitioner_name = serializers.CharField(
        source="practitioner.practitioner_name", read_only=True, default=""
    )
    therapy_type_name = serializers.CharField(
        source="therapy_type.therapy_type", read_only=True, default=""
    )
    plan_id_str = serializers.CharField(source="plan.plan_id", read_only=True, default="")
    plan_title = serializers.CharField(source="plan.title", read_only=True, default="")

    class Meta:
        model = TherapySession
        fields = "__all__"


class TherapyPlanSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source="patient.patient_name", read_only=True, default="")
    practitioner_name = serializers.CharField(
        source="practitioner.practitioner_name", read_only=True, default=""
    )
    therapy_type_name = serializers.CharField(
        source="therapy_type.therapy_type", read_only=True, default=""
    )
    sessions = TherapySessionSerializer(many=True, read_only=True)
    progress_pct = serializers.SerializerMethodField()

    class Meta:
        model = TherapyPlan
        fields = "__all__"

    def get_progress_pct(self, obj):
        if not obj.total_sessions or obj.total_sessions <= 0:
            return 0
        return min(100, int((obj.completed_sessions / obj.total_sessions) * 100))


class ExerciseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Exercise
        fields = "__all__"


class TreatmentPlanTemplateItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = TreatmentPlanTemplateItem
        fields = "__all__"


class TreatmentPlanTemplatePractitionerSerializer(serializers.ModelSerializer):
    practitioner_name = serializers.CharField(source="practitioner.practitioner_name", read_only=True, default="")

    class Meta:
        model = TreatmentPlanTemplatePractitioner
        fields = "__all__"


class TreatmentPlanTemplateSerializer(serializers.ModelSerializer):
    items = TreatmentPlanTemplateItemSerializer(many=True, read_only=True)
    practitioners = TreatmentPlanTemplatePractitionerSerializer(many=True, read_only=True)
    complaints = SymptomSerializer(many=True, read_only=True)
    diagnosis = DiagnosisSerializer(many=True, read_only=True)
    drugs = DrugPrescriptionSerializer(many=True, read_only=True)
    medical_department_name = serializers.CharField(source="medical_department.department", read_only=True, default="")
    therapy_type_name = serializers.CharField(source="therapy_type.therapy_type", read_only=True, default="")

    class Meta:
        model = TreatmentPlanTemplate
        fields = "__all__"


# ── Insurance ──────────────────────────────────────────────────────────────

class InsurancePayorSerializer(serializers.ModelSerializer):
    class Meta:
        model = InsurancePayor
        fields = "__all__"


class InsurancePayorContractSerializer(serializers.ModelSerializer):
    payor_name = serializers.CharField(source="payor.payor_name", read_only=True, default="")

    class Meta:
        model = InsurancePayorContract
        fields = "__all__"


class PatientInsurancePolicySerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source="patient.patient_name", read_only=True, default="")
    payor_name = serializers.CharField(source="payor.payor_name", read_only=True, default="")

    class Meta:
        model = PatientInsurancePolicy
        fields = "__all__"


class InsuranceClaimSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source="patient.patient_name", read_only=True, default="")
    payor_name = serializers.CharField(source="payor.payor_name", read_only=True, default="")

    class Meta:
        model = InsuranceClaim
        fields = "__all__"


# ── Inpatient ──────────────────────────────────────────────────────────────

class InpatientMedicationEntryDetailSerializer(serializers.ModelSerializer):
    class Meta:
        model = InpatientMedicationEntryDetail
        fields = "__all__"
        read_only_fields = ["entry"]


class InpatientMedicationEntrySerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source="patient.patient_name", read_only=True, default="")
    warehouse_name = serializers.CharField(source="warehouse.warehouse_name", read_only=True, default="")
    service_unit_name = serializers.CharField(source="service_unit.service_unit_name", read_only=True, default="")
    practitioner_name = serializers.CharField(source="practitioner.practitioner_name", read_only=True, default="")
    assigned_to_name = serializers.CharField(source="assigned_to_practitioner.practitioner_name", read_only=True, default="")
    stock_entry_number = serializers.CharField(source="stock_entry.stock_entry_number", read_only=True, default="")
    medication_orders = InpatientMedicationEntryDetailSerializer(many=True, required=False)

    class Meta:
        model = InpatientMedicationEntry
        fields = "__all__"

    def create(self, validated_data):
        orders_data = validated_data.pop("medication_orders", [])
        entry = InpatientMedicationEntry.objects.create(**validated_data)
        for order_data in orders_data:
            order_data.pop("entry", None)
            InpatientMedicationEntryDetail.objects.create(entry=entry, **order_data)
        return entry

    def update(self, instance, validated_data):
        orders_data = validated_data.pop("medication_orders", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if orders_data is not None:
            instance.medication_orders.all().delete()
            for order_data in orders_data:
                order_data.pop("entry", None)
                InpatientMedicationEntryDetail.objects.create(entry=instance, **order_data)
        return instance


class InpatientOccupancySerializer(serializers.ModelSerializer):
    unit_name = serializers.CharField(
        source="service_unit.service_unit_name", read_only=True, default=""
    )

    class Meta:
        model = InpatientOccupancy
        fields = "__all__"


class InpatientRecordSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source="patient.patient_name", read_only=True, default="")
    practitioner_name = serializers.CharField(
        source="practitioner.practitioner_name", read_only=True, default=""
    )
    department_name = serializers.CharField(source="department.department", read_only=True, default="")
    service_unit_name = serializers.CharField(source="service_unit.service_unit_name", read_only=True, default="")
    medication_entries = InpatientMedicationEntrySerializer(many=True, read_only=True)

    class Meta:
        model = InpatientRecord
        fields = "__all__"


# ── Observation & Notes ────────────────────────────────────────────────────

class ObservationSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source="patient.patient_name", read_only=True, default="")
    practitioner_name = serializers.CharField(source="practitioner.practitioner_name", read_only=True, default="")
    observation_template_name = serializers.CharField(source="observation_template.observation", read_only=True, default="")
    department_name = serializers.CharField(source="medical_department.department", read_only=True, default="")

    class Meta:
        model = Observation
        fields = "__all__"


class ClinicalNoteSerializer(serializers.ModelSerializer):
    author_name = serializers.CharField(
        source="author.practitioner_name", read_only=True, default=""
    )

    class Meta:
        model = ClinicalNote
        fields = "__all__"


# ── Settings & Fee ─────────────────────────────────────────────────────────

class HealthcareSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = HealthcareSettings
        fields = "__all__"


class FeeValiditySerializer(serializers.ModelSerializer):
    practitioner_name = serializers.CharField(
        source="practitioner.practitioner_name", read_only=True, default=""
    )

    class Meta:
        model = FeeValidity
        fields = "__all__"


# ── Reference Data ────────────────────────────────────────────────────────

class DosageFormSerializer(serializers.ModelSerializer):
    class Meta:
        model = DosageForm
        fields = "__all__"


class DosageStrengthSerializer(serializers.ModelSerializer):
    class Meta:
        model = DosageStrength
        fields = "__all__"


class BodyPartSerializer(serializers.ModelSerializer):
    class Meta:
        model = BodyPart
        fields = "__all__"


class SampleTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = SampleType
        fields = "__all__"


class PatientCareTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = PatientCareType
        fields = "__all__"


class AppointmentTypeConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = AppointmentTypeConfig
        fields = "__all__"


class MedicationClassSerializer(serializers.ModelSerializer):
    class Meta:
        model = MedicationClass
        fields = "__all__"


class ComplaintSerializer(serializers.ModelSerializer):
    class Meta:
        model = Complaint
        fields = "__all__"


class TriageLevelSerializer(serializers.ModelSerializer):
    class Meta:
        model = TriageLevel
        fields = "__all__"


class HealthcareActivitySerializer(serializers.ModelSerializer):
    class Meta:
        model = HealthcareActivity
        fields = "__all__"


# ── Medication Master Data ────────────────────────────────────────────────

class MedicationSerializer(serializers.ModelSerializer):
    medication_class_name = serializers.CharField(
        source="medication_class.medication_class", read_only=True, default=""
    )
    dosage_form_name = serializers.CharField(
        source="dosage_form.dosage_form", read_only=True, default=""
    )
    standard_rate = serializers.SerializerMethodField()
    reorder_level = serializers.SerializerMethodField()
    linked_item_code = serializers.SerializerMethodField()
    linked_item_id = serializers.SerializerMethodField()

    def get_standard_rate(self, obj):
        mli = obj.linked_items.first()
        if mli:
            return float(mli.rate or 0)
        return 0.0

    def get_reorder_level(self, obj):
        return 25.0

    def get_linked_item_code(self, obj):
        mli = obj.linked_items.first()
        if mli:
            return mli.item or ""
        return ""

    def get_linked_item_id(self, obj):
        mli = obj.linked_items.first()
        if mli:
            return mli.id
        return None

    class Meta:
        model = Medication
        fields = "__all__"


class MedicationIngredientSerializer(serializers.ModelSerializer):
    class Meta:
        model = MedicationIngredient
        fields = "__all__"


class MedicationLinkedItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = MedicationLinkedItem
        fields = "__all__"


class DrugInteractionSerializer(serializers.ModelSerializer):
    drug1_name = serializers.CharField(
        source="drug1.generic_name", read_only=True, default=""
    )
    drug2_name = serializers.CharField(
        source="drug2.generic_name", read_only=True, default=""
    )

    class Meta:
        model = DrugInteraction
        fields = "__all__"


# ── Allergy ───────────────────────────────────────────────────────────────

class AllergySerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(
        source="patient.patient_name", read_only=True, default=""
    )

    class Meta:
        model = Allergy
        fields = "__all__"


class AllergyInteractionSerializer(serializers.ModelSerializer):
    class Meta:
        model = AllergyInteraction
        fields = "__all__"


# ── Patient Relation ──────────────────────────────────────────────────────

class PatientRelationSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(
        source="patient.patient_name", read_only=True, default=""
    )
    related_patient_name = serializers.CharField(
        source="related_patient.patient_name", read_only=True, default=""
    )

    class Meta:
        model = PatientRelation
        fields = "__all__"


# ── Emergency ─────────────────────────────────────────────────────────────

class EmergencyRecordSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(
        source="patient.patient_name", read_only=True, default=""
    )
    attending_practitioner_name = serializers.CharField(
        source="attending_practitioner.practitioner_name", read_only=True, default=""
    )
    triage_level_name = serializers.CharField(
        source="triage_level.triage_level", read_only=True, default=""
    )
    department_name = serializers.CharField(
        source="department.department", read_only=True, default=""
    )

    class Meta:
        model = EmergencyRecord
        fields = "__all__"


# ── Discharge Summary ─────────────────────────────────────────────────────

class DischargeSummarySerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(
        source="patient.patient_name", read_only=True, default=""
    )
    discharge_practitioner_name = serializers.CharField(
        source="discharge_practitioner.practitioner_name", read_only=True, default=""
    )

    class Meta:
        model = DischargeSummary
        fields = "__all__"


# ── Nursing ───────────────────────────────────────────────────────────────

class NursingTaskSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(
        source="patient.patient_name", read_only=True, default=""
    )

    class Meta:
        model = NursingTask
        fields = "__all__"


class NursingChecklistTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = NursingChecklistTemplate
        fields = "__all__"


# ── Assessment ────────────────────────────────────────────────────────────

class PatientAssessmentTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = PatientAssessmentTemplate
        fields = "__all__"


class PatientAssessmentSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(
        source="patient.patient_name", read_only=True, default=""
    )
    practitioner_name = serializers.CharField(
        source="practitioner.practitioner_name", read_only=True, default=""
    )
    template_name = serializers.CharField(
        source="template.template_name", read_only=True, default=""
    )

    class Meta:
        model = PatientAssessment
        fields = "__all__"


# ── Service Request ───────────────────────────────────────────────────────

class ServiceRequestCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = ServiceRequestCategory
        fields = "__all__"


class ServiceRequestSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(
        source="patient.patient_name", read_only=True, default=""
    )
    practitioner_name = serializers.CharField(
        source="practitioner.practitioner_name", read_only=True, default=""
    )
    department_name = serializers.CharField(
        source="department.department", read_only=True, default=""
    )
    category_name = serializers.CharField(
        source="category.category", read_only=True, default=""
    )

    class Meta:
        model = ServiceRequest
        fields = "__all__"


# ── Counselling ───────────────────────────────────────────────────────────

class TreatmentCounsellingSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(
        source="patient.patient_name", read_only=True, default=""
    )

    class Meta:
        model = TreatmentCounselling
        fields = "__all__"


# ── Inpatient Medication Order ────────────────────────────────────────────

class InpatientMedicationOrderEntrySerializer(serializers.ModelSerializer):
    class Meta:
        model = InpatientMedicationOrderEntry
        fields = "__all__"
        read_only_fields = ["order"]


class InpatientMedicationOrderSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(
        source="patient.patient_name", read_only=True, default=""
    )
    entries = InpatientMedicationOrderEntrySerializer(many=True, required=False)
    medication_orders = InpatientMedicationOrderEntrySerializer(source="entries", many=True, required=False)

    class Meta:
        model = InpatientMedicationOrder
        fields = "__all__"

    def create(self, validated_data):
        entries_data = validated_data.pop("entries", [])
        order = InpatientMedicationOrder.objects.create(**validated_data)
        for entry_data in entries_data:
            entry_data.pop("order", None)
            InpatientMedicationOrderEntry.objects.create(order=order, **entry_data)
        return order

    def update(self, instance, validated_data):
        entries_data = validated_data.pop("entries", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if entries_data is not None:
            instance.entries.all().delete()
            for entry_data in entries_data:
                entry_data.pop("order", None)
                InpatientMedicationOrderEntry.objects.create(order=instance, **entry_data)
        return instance


# ── Insurance Coverage ────────────────────────────────────────────────────

class InsuranceClaimCoverageSerializer(serializers.ModelSerializer):
    class Meta:
        model = InsuranceClaimCoverage
        fields = "__all__"


class PatientInsuranceCoverageSerializer(serializers.ModelSerializer):
    class Meta:
        model = PatientInsuranceCoverage
        fields = "__all__"


# ── Payment ───────────────────────────────────────────────────────────────

class HealthcarePaymentRecordSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(
        source="patient.patient_name", read_only=True, default=""
    )

    class Meta:
        model = HealthcarePaymentRecord
        fields = "__all__"


# ══════════════════════════════════════════════════════════════════════════════
# NEW MARLEY MODELS
# ══════════════════════════════════════════════════════════════════════════════

class PrescriptionDosageSerializer(serializers.ModelSerializer):
    class Meta:
        model = PrescriptionDosage
        fields = "__all__"


class PrescriptionDurationSerializer(serializers.ModelSerializer):
    class Meta:
        model = PrescriptionDuration
        fields = "__all__"


class LabPrescriptionSerializer(serializers.ModelSerializer):
    lab_test_code_name = serializers.CharField(
        source="lab_test_code.lab_test_name", read_only=True, default=""
    )
    observation_template_name = serializers.CharField(
        source="observation_template.observation", read_only=True, default=""
    )
    patient_care_type_name = serializers.CharField(
        source="patient_care_type.patient_care_type", read_only=True, default=""
    )

    class Meta:
        model = LabPrescription
        fields = "__all__"
        extra_kwargs = {
            "patient": {"required": False},
            "encounter": {"required": False},
        }


class ProcedurePrescriptionSerializer(serializers.ModelSerializer):
    procedure_name_display = serializers.CharField(
        source="procedure.template_name", read_only=True, default=""
    )
    department_name = serializers.CharField(
        source="department.department", read_only=True, default=""
    )
    practitioner_name = serializers.CharField(
        source="practitioner.practitioner_name", read_only=True, default=""
    )

    class Meta:
        model = ProcedurePrescription
        fields = "__all__"
        extra_kwargs = {
            "patient": {"required": False},
            "encounter": {"required": False},
        }


class DiagnosticReportSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source="patient.patient_name", read_only=True, default="")
    practitioner_name = serializers.CharField(source="practitioner.practitioner_name", read_only=True, default="")

    class Meta:
        model = DiagnosticReport
        fields = "__all__"


class SampleCollectionSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source="patient.patient_name", read_only=True, default="")
    sample_name = serializers.CharField(source="sample.sample", read_only=True, default="")
    container_closure_color = serializers.CharField(source="sample.container_closure_color", read_only=True, default="")
    referring_practitioner_name = serializers.CharField(source="referring_practitioner.practitioner_name", read_only=True, default="")
    collection_point_name = serializers.CharField(source="collection_point.service_unit_name", read_only=True, default="")
    patient_age = serializers.CharField(required=False, allow_blank=True, default="")
    patient_sex = serializers.CharField(required=False, allow_blank=True, default="")

    class Meta:
        model = SampleCollection
        fields = "__all__"

    def validate_patient_age(self, value):
        if value and len(str(value)) > 20:
            return str(value)[:20]
        return value or ""

    def validate_patient_sex(self, value):
        if value and len(str(value)) > 20:
            return str(value)[:20]
        return value or ""


class PatientMedicalRecordSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source="patient.patient_name", read_only=True, default="")
    user_name = serializers.SerializerMethodField()

    class Meta:
        model = PatientMedicalRecord
        fields = "__all__"

    def get_user_name(self, obj):
        if obj.user:
            full = f"{obj.user.first_name} {obj.user.last_name}".strip()
            return full or getattr(obj.user, "username", "") or ""
        return obj.owner or obj.modified_by or ""


class OrganismSerializer(serializers.ModelSerializer):
    class Meta:
        model = Organism
        fields = "__all__"


class SensitivitySerializer(serializers.ModelSerializer):
    class Meta:
        model = Sensitivity
        fields = "__all__"


class SpecimenSerializer(serializers.ModelSerializer):
    class Meta:
        model = Specimen
        fields = "__all__"


class EmergencyOccupancySerializer(serializers.ModelSerializer):
    class Meta:
        model = EmergencyOccupancy
        fields = "__all__"


class ClinicalNoteTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = ClinicalNoteType
        fields = "__all__"


class CodeSystemSerializer(serializers.ModelSerializer):
    class Meta:
        model = CodeSystem
        fields = "__all__"


class CodeValueSerializer(serializers.ModelSerializer):
    class Meta:
        model = CodeValue
        fields = "__all__"


class ExerciseTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = ExerciseType
        fields = "__all__"


class ExerciseDifficultyLevelSerializer(serializers.ModelSerializer):
    class Meta:
        model = ExerciseDifficultyLevel
        fields = "__all__"


class ObservationTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ObservationTemplate
        fields = "__all__"


class ObservationReferenceRangeSerializer(serializers.ModelSerializer):
    class Meta:
        model = ObservationReferenceRange
        fields = "__all__"


class TherapyPlanTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = TherapyPlanTemplateModel
        fields = "__all__"


class TherapyPlanDetailSerializer(serializers.ModelSerializer):
    therapy_type_name = serializers.CharField(
        source="therapy_type.therapy_type", read_only=True, default=""
    )
    patient_care_type_name = serializers.CharField(
        source="patient_care_type.patient_care_type", read_only=True, default=""
    )

    class Meta:
        model = TherapyPlanDetail
        fields = "__all__"
        extra_kwargs = {
            "patient": {"required": False},
            "encounter": {"required": False},
        }


# ── Encounter (defined last: it nests every child serializer above) ─────────

class PatientEncounterSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source="patient.patient_name", read_only=True, default="")
    patient_age = serializers.CharField(read_only=True)
    patient_sex = serializers.CharField(source="patient.sex", read_only=True, default="")
    practitioner_name = serializers.CharField(
        source="practitioner.practitioner_name", read_only=True, default=""
    )
    appointment_type_name = serializers.CharField(
        source="appointment_type.appointment_type", read_only=True, default=""
    )
    department_name = serializers.CharField(
        source="department.department", read_only=True, default=""
    )
    diagnoses_list = DiagnosisSerializer(source="diagnoses", many=True, read_only=True)
    symptoms_list_items = SymptomSerializer(source="symptoms_list", many=True, read_only=True)
    codification_table = CodificationTableSerializer(
        source="codifications", many=True, read_only=True
    )
    therapies = TherapyPlanDetailSerializer(
        source="therapy_details", many=True, read_only=True
    )
    lab_prescription_items = LabPrescriptionSerializer(
        source="lab_prescriptions", many=True, read_only=True
    )
    procedure_prescription_items = ProcedurePrescriptionSerializer(
        source="procedure_prescriptions", many=True, read_only=True
    )
    drug_prescription_items = DrugPrescriptionSerializer(
        source="drug_prescriptions", many=True, read_only=True
    )

    class Meta:
        model = PatientEncounter
        fields = "__all__"


class MedicationClassInteractionSerializer(serializers.ModelSerializer):
    class Meta:
        model = MedicationClassInteraction
        fields = "__all__"


class AntibioticSerializer(serializers.ModelSerializer):
    class Meta:
        model = Antibiotic
        fields = "__all__"



class InpatientRecordItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = InpatientRecordItem
        fields = "__all__"


class ServiceRequestReasonSerializer(serializers.ModelSerializer):
    class Meta:
        model = ServiceRequestReason
        fields = "__all__"


class InsurancePayorEligibilityPlanSerializer(serializers.ModelSerializer):
    class Meta:
        model = InsurancePayorEligibilityPlan
        fields = "__all__"


class ItemInsuranceEligibilitySerializer(serializers.ModelSerializer):
    class Meta:
        model = ItemInsuranceEligibility
        fields = "__all__"


# ── Document Management ──────────────────────────────────────────────

class DocumentAssignmentSerializer(serializers.ModelSerializer):
    assigned_to_name = serializers.CharField(source="assigned_to.username", read_only=True, default="")
    assigned_by_name = serializers.CharField(source="assigned_by.username", read_only=True, default="")
    assigned_to_email = serializers.CharField(source="assigned_to.email", read_only=True, default="")
    assigned_to_full_name = serializers.SerializerMethodField()

    class Meta:
        model = DocumentAssignment
        fields = "__all__"

    def get_assigned_to_full_name(self, obj):
        if obj.assigned_to:
            fn = f"{obj.assigned_to.first_name} {obj.assigned_to.last_name}".strip()
            return fn if fn else obj.assigned_to.username
        return ""


class DocumentAttachmentSerializer(serializers.ModelSerializer):
    attached_by_name = serializers.CharField(source="attached_by.username", read_only=True, default="")

    class Meta:
        model = DocumentAttachment
        fields = "__all__"

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        url = ret.get("file_url") or ""
        if not url and instance.file:
            try:
                url = instance.file.url
            except Exception:
                url = ""
        if url and not url.startswith("http://") and not url.startswith("https://") and not url.startswith("/"):
            url = "/" + url
        ret["file_url"] = url

        file_val = ret.get("file")
        if file_val and not str(file_val).startswith("http") and not str(file_val).startswith("/"):
            ret["file"] = "/" + str(file_val)
        return ret


class DocumentTagSerializer(serializers.ModelSerializer):
    class Meta:
        model = DocumentTag
        fields = "__all__"


# ── Missing Serializers (referenced in urls.py) ──────────────────────

class HealthcareScheduleTimeSlotSerializer(serializers.ModelSerializer):
    class Meta:
        model = HealthcareScheduleTimeSlot
        fields = "__all__"


class PractitionerServiceUnitScheduleSerializer(serializers.ModelSerializer):
    class Meta:
        model = PractitionerServiceUnitSchedule
        fields = "__all__"


class AppointmentTypeServiceItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = AppointmentTypeServiceItem
        fields = "__all__"


class FeeValidityReferenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = FeeValidityReference
        fields = "__all__"


class MedicationOverrideReasonCodeSerializer(serializers.ModelSerializer):
    class Meta:
        model = MedicationOverrideReasonCode
        fields = "__all__"


class BodyPartLinkSerializer(serializers.ModelSerializer):
    class Meta:
        model = BodyPartLink
        fields = "__all__"


class PatientHistorySettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = PatientHistorySettings
        fields = "__all__"


class PatientMedicalRecordTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = PatientMedicalRecordTemplate
        fields = "__all__"


class ServiceUnitTypeItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = ServiceUnitTypeItem
        fields = "__all__"


# ── Clinical Documents (External Referral & Medical Leave Slip) ──────────

class ExternalReferralSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source="patient.patient_name", read_only=True, default="")
    patient_age = serializers.CharField(source="patient.age_display", read_only=True, default="")
    patient_sex = serializers.CharField(source="patient.sex", read_only=True, default="")
    patient_mobile = serializers.CharField(source="patient.mobile", read_only=True, default="")
    referring_practitioner_name = serializers.CharField(
        source="referring_practitioner.practitioner_name", read_only=True, default=""
    )
    referring_department_name = serializers.CharField(
        source="referring_practitioner.department.department", read_only=True, default=""
    )

    class Meta:
        model = ExternalReferral
        fields = "__all__"


class MedicalLeaveSlipSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source="patient.patient_name", read_only=True, default="")
    patient_age = serializers.CharField(source="patient.age_display", read_only=True, default="")
    patient_sex = serializers.CharField(source="patient.sex", read_only=True, default="")
    patient_mobile = serializers.CharField(source="patient.mobile", read_only=True, default="")
    practitioner_name = serializers.CharField(
        source="practitioner.practitioner_name", read_only=True, default=""
    )
    practitioner_designation = serializers.CharField(
        source="practitioner.designation", read_only=True, default=""
    )
    practitioner_department = serializers.CharField(
        source="practitioner.department.department", read_only=True, default=""
    )

    class Meta:
        model = MedicalLeaveSlip
        fields = "__all__"


class PharmacyWarehouseSerializer(serializers.ModelSerializer):
    class Meta:
        model = PharmacyWarehouse
        fields = "__all__"


class PharmacyStockSerializer(serializers.ModelSerializer):
    warehouse_name = serializers.CharField(source="warehouse.warehouse_name", read_only=True, default="")

    class Meta:
        model = PharmacyStock
        fields = "__all__"


class PharmacyStockEntrySerializer(serializers.ModelSerializer):
    warehouse_name = serializers.CharField(source="warehouse.warehouse_name", read_only=True, default="")
    patient_name = serializers.CharField(source="patient.patient_name", read_only=True, default="")

    class Meta:
        model = PharmacyStockEntry
        fields = "__all__"


# ── EEU Occupational Health Serializers ───────────────────────────────────

class EEUWorkplaceIncidentSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source="patient.patient_name", read_only=True, default="")
    patient_code = serializers.CharField(source="patient.patient_id", read_only=True, default="")
    staff_id = serializers.CharField(source="patient.eeu_staff_id", read_only=True, default="")
    cadre = serializers.CharField(source="patient.eeu_cadre", read_only=True, default="")
    department = serializers.CharField(source="patient.eeu_department", read_only=True, default="")
    patient_phone = serializers.CharField(source="patient.mobile", read_only=True, default="")
    clinical_encounter_display = serializers.CharField(source="clinical_encounter.encounter_id", read_only=True, default="")
    sick_leave_slip_code = serializers.CharField(source="sick_leave_slip.slip_id", read_only=True, default="")
    sick_leave_total_days = serializers.IntegerField(source="sick_leave_slip.total_days", read_only=True, default=0)

    class Meta:
        model = EEUWorkplaceIncident
        fields = "__all__"


class EEUFitnessEvaluationSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source="patient.patient_name", read_only=True, default="")
    patient_code = serializers.CharField(source="patient.patient_id", read_only=True, default="")
    staff_id = serializers.CharField(source="patient.eeu_staff_id", read_only=True, default="")
    cadre = serializers.CharField(source="patient.eeu_cadre", read_only=True, default="")
    department = serializers.CharField(source="patient.eeu_department", read_only=True, default="")
    practitioner_name = serializers.CharField(source="practitioner.practitioner_name", read_only=True, default="")

    class Meta:
        model = EEUFitnessEvaluation
        fields = "__all__"


class EEUFirstAidKitSerializer(serializers.ModelSerializer):
    class Meta:
        model = EEUFirstAidKit
        fields = "__all__"


class EEUEmergencySOSSerializer(serializers.ModelSerializer):
    class Meta:
        model = EEUEmergencySOS
        fields = "__all__"


class EEUPMECampaignSerializer(serializers.ModelSerializer):
    completion_rate_pct = serializers.SerializerMethodField()

    class Meta:
        model = EEUPMECampaign
        fields = "__all__"

    def get_completion_rate_pct(self, obj):
        if not obj.target_count:
            return 0
        return round((obj.completed_count / obj.target_count) * 100, 1)


class EEUToxicSurveillanceSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source="patient.patient_name", read_only=True, default="")
    patient_code = serializers.CharField(source="patient.patient_id", read_only=True, default="")
    staff_id = serializers.CharField(source="patient.eeu_staff_id", read_only=True, default="")
    cadre = serializers.CharField(source="patient.eeu_cadre", read_only=True, default="")
    department = serializers.CharField(source="patient.eeu_department", read_only=True, default="")

    class Meta:
        model = EEUToxicSurveillance
        fields = "__all__"


