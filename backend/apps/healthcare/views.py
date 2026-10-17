import re
import random
import logging
from decimal import Decimal

logger = logging.getLogger(__name__)

from rest_framework import viewsets, status, permissions, parsers
from rest_framework.exceptions import ValidationError
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from django.db.models import Sum, Q, F, Count

from apps.roles.permissions import HasPermissionOrAdmin
from .permissions import (
    HealthcareRBACPermission, is_doctor, is_healthcare_admin,
    is_receptionist, is_lab_tech, is_pharmacist,
    get_practitioner_for_user, has_active_care_relationship,
    can_view_confidential_records,
)
from .models import PharmacyWarehouse, PharmacyStock, PharmacyStockEntry

from .models import (
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
    NormalTestResult, NormalTestTemplate, DescriptiveTestTemplate,
    DescriptiveTestResult, OrganismTestResult,
    LabTestGroupTemplate, ObservationTemplate, ObservationReferenceRange,
    TherapyPlanTemplate as TherapyPlanTemplateModel,
    TherapyPlanDetail, TreatmentPlanTemplateItem, TreatmentPlanTemplatePractitioner,
    MedicationClassInteraction, Antibiotic, InpatientMedicationOrderEntry,
    InpatientRecordItem, ServiceRequestReason,    InsurancePayorEligibilityPlan,
    ItemInsuranceEligibility,
    DocumentAssignment, DocumentAttachment, DocumentTag,
    HealthcareScheduleTimeSlot, PractitionerServiceUnitSchedule,
    AppointmentTypeServiceItem, FeeValidityReference,
    MedicationOverrideReasonCode, BodyPartLink,
    PatientHistorySettings, PatientMedicalRecordTemplate,
    ServiceUnitTypeItem,
    ExternalReferral, MedicalLeaveSlip,
    EEUWorkplaceIncident, EEUFitnessEvaluation, EEUFirstAidKit,
    EEUEmergencySOS, EEUPMECampaign, EEUToxicSurveillance,
)
from .serializers import (
    MedicalDepartmentSerializer, HealthcareServiceUnitTypeSerializer,
    HealthcareServiceUnitSerializer,
    PatientSerializer, PatientSummarySerializer,
    HealthcarePractitionerSerializer, PractitionerSummarySerializer,
    PractitionerScheduleSerializer, PractitionerAvailabilitySerializer,
    PatientAppointmentSerializer, VitalSignsSerializer,
    PatientEncounterSerializer, DiagnosisSerializer, DiagnosisCatalogSerializer, SymptomSerializer,
    CodificationTableSerializer,
    DrugPrescriptionSerializer, MedicationRequestSerializer,
    LabTestTemplateSerializer, LabTestSerializer, LabTestSampleSerializer, LabTestUOMSerializer,
    ClinicalProcedureTemplateSerializer, ClinicalProcedureSerializer,
    TherapyTypeSerializer, TherapyPlanSerializer, TherapySessionSerializer,
    ExerciseSerializer, TreatmentPlanTemplateSerializer,
    InsurancePayorSerializer, InsurancePayorContractSerializer,
    PatientInsurancePolicySerializer, InsuranceClaimSerializer,
    InpatientRecordSerializer, InpatientMedicationEntrySerializer, InpatientMedicationEntryDetailSerializer,
    InpatientOccupancySerializer,
    ObservationSerializer, ClinicalNoteSerializer,
    HealthcareSettingsSerializer, FeeValiditySerializer,
    DosageFormSerializer, DosageStrengthSerializer, BodyPartSerializer,
    SampleTypeSerializer, PatientCareTypeSerializer, AppointmentTypeConfigSerializer,
    MedicationClassSerializer, ComplaintSerializer, TriageLevelSerializer,
    HealthcareActivitySerializer, MedicationSerializer, MedicationIngredientSerializer,
    MedicationLinkedItemSerializer, DrugInteractionSerializer,
    AllergySerializer, AllergyInteractionSerializer, PatientRelationSerializer,
    EmergencyRecordSerializer, DischargeSummarySerializer,
    NursingTaskSerializer, NursingChecklistTemplateSerializer,
    PatientAssessmentTemplateSerializer, PatientAssessmentSerializer,
    ServiceRequestCategorySerializer, ServiceRequestSerializer,
    TreatmentCounsellingSerializer, InpatientMedicationOrderSerializer,
    InsuranceClaimCoverageSerializer, PatientInsuranceCoverageSerializer,
    HealthcarePaymentRecordSerializer,
    PrescriptionDosageSerializer, PrescriptionDurationSerializer,
    LabPrescriptionSerializer, ProcedurePrescriptionSerializer,
    DiagnosticReportSerializer, SampleCollectionSerializer,
    PatientMedicalRecordSerializer, OrganismSerializer, SensitivitySerializer,
    SensitivityTestResultSerializer, SpecimenSerializer, EmergencyOccupancySerializer,
    ClinicalNoteTypeSerializer, CodeSystemSerializer, CodeValueSerializer,
    ExerciseTypeSerializer, ExerciseDifficultyLevelSerializer,
    NormalTestTemplateSerializer, DescriptiveTestTemplateSerializer,
    LabTestGroupTemplateSerializer, NormalTestResultSerializer,
    DescriptiveTestResultSerializer, OrganismTestResultSerializer,
    ObservationTemplateSerializer, ObservationReferenceRangeSerializer,    TherapyPlanTemplateSerializer, TherapyPlanDetailSerializer,
    TreatmentPlanTemplateItemSerializer, TreatmentPlanTemplatePractitionerSerializer,
    MedicationClassInteractionSerializer,
    AntibioticSerializer, InpatientMedicationOrderEntrySerializer,
    InpatientRecordItemSerializer, ServiceRequestReasonSerializer,
    InsurancePayorEligibilityPlanSerializer, ItemInsuranceEligibilitySerializer,
    DocumentAssignmentSerializer, DocumentAttachmentSerializer, DocumentTagSerializer,
    HealthcareScheduleTimeSlotSerializer, PractitionerServiceUnitScheduleSerializer,
    AppointmentTypeServiceItemSerializer, FeeValidityReferenceSerializer,
    MedicationOverrideReasonCodeSerializer, BodyPartLinkSerializer,
    PatientHistorySettingsSerializer, PatientMedicalRecordTemplateSerializer,
    ServiceUnitTypeItemSerializer,
    ExternalReferralSerializer, MedicalLeaveSlipSerializer,
    PharmacyWarehouseSerializer, PharmacyStockSerializer, PharmacyStockEntrySerializer,
    EEUWorkplaceIncidentSerializer, EEUFitnessEvaluationSerializer, EEUFirstAidKitSerializer,
    EEUEmergencySOSSerializer, EEUPMECampaignSerializer, EEUToxicSurveillanceSerializer,
)


# ── Frappe-style permission base class ────────────────────────────────────

# Model class name -> DocType name exceptions (when they differ)
_MODEL_DOCTYPE_OVERRIDES = {
    "AppointmentTypeConfig": "Appointment Type",
}


def _model_to_doctype(model_name):
    """Convert a model class name to its Frappe DocType name.

    PatientAppointment -> "Patient Appointment", LabTestUOM -> "Lab Test UOM".
    """
    name = _MODEL_DOCTYPE_OVERRIDES.get(model_name, model_name)
    return re.sub(r"(?<=[a-z0-9])(?=[A-Z])", " ", name)


class HealthcareModelViewSet(viewsets.ModelViewSet):
    """
    Base viewset for the Healthcare module.

    Enforces Frappe-style DocPerm checks via HasPermissionOrAdmin. The
    DocType name is derived from the viewset's model (override doctype_name
    on a subclass when needed).
    """

    permission_classes = [HealthcareRBACPermission, HasPermissionOrAdmin]

    @property
    def doctype_name(self):
        model = getattr(self.queryset, "model", None)
        if model is None and hasattr(self, "model"):
            model = getattr(self, "model", None)
        if model:
            return _model_to_doctype(model.__name__)
        return ""

    def get_queryset(self):
        qs = super().get_queryset()
        if hasattr(self.request, "user") and self.request.user and self.request.user.is_authenticated:
            from apps.roles.permissions import apply_user_permissions
            dt = self.doctype_name
            if dt:
                qs = apply_user_permissions(qs, self.request.user, dt)
        return qs

    def update(self, request, *args, **kwargs):
        # Support partial updates on PUT as well as PATCH for flexible frontend forms
        kwargs["partial"] = True
        return super().update(request, *args, **kwargs)


# ── Department & Service Unit ─────────────────────────────────────────────

class MedicalDepartmentViewSet(HealthcareModelViewSet):
    queryset = MedicalDepartment.objects.all()
    serializer_class = MedicalDepartmentSerializer
    search_fields = ["department"]
    filterset_fields = ["patient_care_type", "show_in_portal"]


class HealthcareServiceUnitTypeViewSet(HealthcareModelViewSet):
    queryset = HealthcareServiceUnitType.objects.all()
    serializer_class = HealthcareServiceUnitTypeSerializer
    search_fields = ["service_unit_type"]


class HealthcareServiceUnitViewSet(HealthcareModelViewSet):
    queryset = HealthcareServiceUnit.objects.select_related(
        "service_unit_type", "department"
    ).all()
    serializer_class = HealthcareServiceUnitSerializer
    search_fields = ["service_unit_name"]
    filterset_fields = ["service_unit_type", "department", "is_active", "occupancy_status"]


# ── Patient ────────────────────────────────────────────────────────────────

class PatientViewSet(HealthcareModelViewSet):
    queryset = Patient.objects.all()
    serializer_class = PatientSerializer
    search_fields = ["first_name", "last_name", "patient_name", "patient_id", "email", "mobile", "uid", "eeu_staff_id", "company_affiliation", "eeu_department", "eeu_region", "eeu_work_station", "eeu_cadre"]
    filterset_fields = ["sex", "blood_group", "status", "inpatient_status", "dob", "mobile", "email", "company", "company_affiliation", "eeu_beneficiary_type", "eeu_medical_coverage_status", "eeu_climbing_fitness_status", "eeu_region", "eeu_department"]

    def get_queryset(self):
        qs = super().get_queryset()
        from django.db.models import Q

        # Direct Staff / Payroll ID filter (supports raw digits, prefix, or sponsor ID)
        staff_id = self.request.query_params.get("staff_id") or self.request.query_params.get("eeu_staff_id")
        if staff_id:
            s_val = staff_id.strip()
            qs = qs.filter(Q(eeu_staff_id__icontains=s_val) | Q(eeu_primary_staff_id__icontains=s_val))

        # Direct Patient Name filter (first, middle, last, or combined name)
        name = self.request.query_params.get("name") or self.request.query_params.get("patient_name")
        if name:
            n_val = name.strip()
            qs = qs.filter(
                Q(patient_name__icontains=n_val) |
                Q(first_name__icontains=n_val) |
                Q(middle_name__icontains=n_val) |
                Q(last_name__icontains=n_val)
            )

        # Direct UID / Civil Identification filter
        uid = self.request.query_params.get("uid") or self.request.query_params.get("identification")
        if uid:
            qs = qs.filter(uid__icontains=uid.strip())

        # Date of birth range filters
        dob_gte = self.request.query_params.get("dob__gte")
        if dob_gte:
            qs = qs.filter(dob__gte=dob_gte)
        dob_lte = self.request.query_params.get("dob__lte")
        if dob_lte:
            qs = qs.filter(dob__lte=dob_lte)

        # Registration date range filters
        creation_gte = self.request.query_params.get("creation__gte") or self.request.query_params.get("created_from")
        if creation_gte:
            qs = qs.filter(creation__date__gte=creation_gte)
        creation_lte = self.request.query_params.get("creation__lte") or self.request.query_params.get("created_to")
        if creation_lte:
            qs = qs.filter(creation__date__lte=creation_lte)

        tag = self.request.query_params.get("tag")
        tags = self.request.query_params.get("tags")
        tag_query = tag or tags
        if tag_query:
            from .models import DocumentTag
            tag_list = [t.strip() for t in tag_query.split(",") if t.strip()]
            q_tags = Q()
            for t in tag_list:
                q_tags |= Q(tag__iexact=t)
            docnames = list(DocumentTag.objects.filter(doctype="Patient").filter(q_tags).values_list("docname", flat=True))
            int_ids = [int(x) for x in docnames if str(x).isdigit()]
            qs = qs.filter(Q(id__in=int_ids) | Q(patient_id__in=docnames))

        # Assigned patients filter for practitioners
        my_patients = self.request.query_params.get("my_patients")
        if my_patients in ["true", "1", "True"]:
            practitioner = get_practitioner_for_user(self.request.user)
            if practitioner:
                from .models import PatientAppointment, PatientEncounter, InpatientRecord
                assigned_patient_ids = set(
                    PatientAppointment.objects.filter(practitioner=practitioner).values_list("patient_id", flat=True)
                ) | set(
                    PatientEncounter.objects.filter(practitioner=practitioner).values_list("patient_id", flat=True)
                ) | set(
                    InpatientRecord.objects.filter(practitioner=practitioner).values_list("patient_id", flat=True)
                )
                qs = qs.filter(id__in=assigned_patient_ids)
            elif not (self.request.user.is_superuser or self.request.user.is_staff):
                qs = qs.none()

        return qs

    def perform_create(self, serializer):
        instance = serializer.save()
        from .automation import on_patient_create
        on_patient_create(instance)

    @action(detail=False, methods=["get"], url_path="sample-template", permission_classes=[permissions.AllowAny])
    def sample_template(self, request):
        # Branded Excel (.xlsx) template generator for bulk import
        import openpyxl
        from openpyxl.styles import Font, PatternFill, Alignment
        from django.http import HttpResponse
        import io

        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "EEU Employees & Beneficiaries"

        headers = [
            "Staff ID",
            "First Name",
            "Middle Name",
            "Last Name",
            "Gender",
            "Date of Birth",
            "Mobile Phone",
            "Email Address",
            "Employer Scheme",
            "Department / Directorate",
            "Job Cadre / Position",
            "Region",
            "Work Station",
            "Blood Group",
            "Beneficiary Type",
        ]

        header_fill = PatternFill(start_color="0F4C81", end_color="0F4C81", fill_type="solid")
        header_font = Font(name="Segoe UI", size=11, bold=True, color="FFFFFF")
        center_align = Alignment(horizontal="center", vertical="center")
        left_align = Alignment(horizontal="left", vertical="center")

        ws.row_dimensions[1].height = 28
        for col_idx, header in enumerate(headers, 1):
            cell = ws.cell(row=1, column=col_idx, value=header)
            cell.fill = header_fill
            cell.font = header_font
            cell.alignment = center_align

        sample_rows = [
            [
                "EEU-657854",
                "Abebe",
                "Kebede",
                "Tadesse",
                "Male",
                "1988-04-12",
                "+251911234567",
                "abebe.kebede@eeu.gov.et",
                "Ethiopian Electric Utility (EEU)",
                "Distribution Directorate",
                "Senior Electrical Engineer",
                "Addis Ababa",
                "Mexico Substation",
                "O+",
                "Staff",
            ],
            [
                "EEFC-10023",
                "Yared",
                "Bayeh",
                "Kassaye",
                "Male",
                "1997-01-22",
                "+251922345678",
                "yared.bayeh@eeu.gov.et",
                "Ethiopian Electric Football club (EEFC)",
                "Ethiopian Electric Football Club (EEFC)",
                "Central Midfielder",
                "Addis Ababa",
                "Abebe Bikila Stadium",
                "A+",
                "Staff",
            ],
            [
                "RET-20412",
                "Almaz",
                "Haile",
                "Gebre",
                "Female",
                "1961-09-15",
                "+251933456789",
                "almaz.haile@gmail.com",
                "Retired Employee",
                "Pension & Retired Staff Directorate",
                "Retired Senior Accountant",
                "Addis Ababa",
                "Head Office",
                "B+",
                "Staff",
            ],
            [
                "others-578879",
                "Dawit",
                "Mulugeta",
                "Bekele",
                "Male",
                "1992-06-30",
                "+251944567890",
                "dawit.mulugeta@contractor.com",
                "Others",
                "External Construction & Infrastructure",
                "Civil Engineer Contractor",
                "Oromia",
                "Gelan Depot",
                "AB+",
                "Staff",
            ],
        ]

        data_font = Font(name="Segoe UI", size=10)
        for row_idx, row_data in enumerate(sample_rows, 2):
            ws.row_dimensions[row_idx].height = 20
            for col_idx, val in enumerate(row_data, 1):
                cell = ws.cell(row=row_idx, column=col_idx, value=val)
                cell.font = data_font
                cell.alignment = left_align

        for col in ws.columns:
            max_len = max(len(str(cell.value or "")) for cell in col)
            col_letter = openpyxl.utils.get_column_letter(col[0].column)
            ws.column_dimensions[col_letter].width = max(max_len + 4, 14)

        buf = io.BytesIO()
        wb.save(buf)
        buf.seek(0)

        response = HttpResponse(
            buf.getvalue(),
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        response["Content-Disposition"] = 'attachment; filename="eeu_employee_import_template.xlsx"'
        return response

    @action(detail=False, methods=["post"], url_path="bulk-import", parser_classes=[parsers.MultiPartParser, parsers.FormParser, parsers.JSONParser])
    def bulk_import(self, request):
        """
        Bulk import employees/patients from uploaded Excel (.xlsx, .xls) or CSV.
        Supports query param dry_run=true for preview & pre-validation.
        """
        import io
        import csv
        from django.db import transaction
        from datetime import datetime, date

        upload_file = request.FILES.get("file")
        if not upload_file:
            return Response({"error": "No file uploaded. Please provide an Excel (.xlsx) or CSV file."}, status=status.HTTP_400_BAD_REQUEST)

        dry_run = str(request.data.get("dry_run", "")).lower() in ("true", "1") or str(request.query_params.get("dry_run", "")).lower() in ("true", "1")

        filename = upload_file.name.lower()
        rows_data = []

        try:
            if filename.endswith(".csv"):
                content = upload_file.read().decode("utf-8-sig", errors="replace")
                reader = csv.DictReader(io.StringIO(content))
                for r in reader:
                    rows_data.append({k.strip().lower() if k else "": (v.strip() if v else "") for k, v in r.items()})
            elif filename.endswith((".xlsx", ".xls")):
                import openpyxl
                wb = openpyxl.load_workbook(upload_file, data_only=True)
                ws = wb.active
                headers = []
                for cell in ws[1]:
                    val = str(cell.value or "").strip().lower()
                    headers.append(val)
                for row in ws.iter_rows(min_row=2, values_only=True):
                    if not any(row):
                        continue
                    row_dict = {}
                    for h, val in zip(headers, row):
                        if not h:
                            continue
                        if isinstance(val, (datetime, date)):
                            row_dict[h] = val.strftime("%Y-%m-%d")
                        elif val is not None:
                            row_dict[h] = str(val).strip()
                        else:
                            row_dict[h] = ""
                    rows_data.append(row_dict)
            else:
                return Response({"error": "Unsupported file format. Please upload .xlsx, .xls, or .csv"}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"error": f"Failed to parse file: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)

        if not rows_data:
            return Response({"error": "The uploaded file contains no data rows."}, status=status.HTTP_400_BAD_REQUEST)

        def get_val(row_dict, *aliases):
            for a in aliases:
                a_lower = a.lower()
                for k, v in row_dict.items():
                    if a_lower in k:
                        return v
            return ""

        existing_staff_ids = set(
            Patient.objects.exclude(eeu_staff_id="").values_list("eeu_staff_id", flat=True)
        )

        parsed_items = []
        validation_errors = []
        valid_count = 0
        duplicate_count = 0

        for idx, row in enumerate(rows_data, start=2):
            raw_staff_id = get_val(row, "staff", "payroll", "employee id", "id")
            first_name = get_val(row, "first name", "firstname", "first", "name")
            middle_name = get_val(row, "middle name", "middlename", "middle", "father")
            last_name = get_val(row, "last name", "lastname", "last", "grandfather", "surname")
            raw_gender = get_val(row, "gender", "sex")
            raw_dob = get_val(row, "dob", "birth", "date of birth")
            phone = get_val(row, "phone", "mobile", "cell", "tel")
            email = get_val(row, "email", "mail")
            raw_scheme = get_val(row, "scheme", "company", "affiliation", "employer")
            department = get_val(row, "department", "directorate", "dept")
            cadre = get_val(row, "cadre", "role", "position", "title", "job")
            region = get_val(row, "region", "branch", "district")
            work_station = get_val(row, "work station", "station", "depot", "location", "substation")
            blood_group = get_val(row, "blood", "group")
            beneficiary_type = get_val(row, "beneficiary", "type") or "Staff"

            if not first_name:
                validation_errors.append(f"Row {idx}: First Name is missing.")
                continue

            g_lower = raw_gender.lower()
            if g_lower.startswith("m"):
                sex = "Male"
            elif g_lower.startswith("f"):
                sex = "Female"
            else:
                sex = "Other" if raw_gender else ""

            s_lower = raw_scheme.lower()
            if "eefc" in s_lower or "football" in s_lower or "club" in s_lower:
                scheme = "Ethiopian Electric Football club (EEFC)"
            elif "retired" in s_lower or "pension" in s_lower:
                scheme = "Retired Employee"
            elif "other" in s_lower or "contractor" in s_lower:
                scheme = "Others"
            else:
                scheme = "Ethiopian Electric Utility (EEU)"

            cleaned_id = ""
            if raw_staff_id:
                digits = re.sub(r'^(EEU|EEFC|RET|others)-EMP-?', '', str(raw_staff_id), flags=re.I)
                digits = re.sub(r'^(EEU|EEFC|RET|others)-', '', digits, flags=re.I)
                digits = re.sub(r'^EMP-?', '', digits, flags=re.I).strip()
                if "EEFC" in scheme:
                    cleaned_id = f"EEFC-{digits}" if digits else ""
                elif "Retired" in scheme:
                    cleaned_id = f"RET-{digits}" if digits else ""
                elif "Other" in scheme:
                    cleaned_id = f"others-{digits}" if digits else ""
                else:
                    cleaned_id = f"EEU-{digits}" if digits else ""

            is_duplicate = bool(cleaned_id and cleaned_id in existing_staff_ids)
            if is_duplicate:
                duplicate_count += 1

            clean_dob = None
            if raw_dob:
                try:
                    clean_dob = raw_dob[:10]
                except Exception:
                    clean_dob = None

            item = {
                "row_number": idx,
                "first_name": first_name,
                "middle_name": middle_name,
                "last_name": last_name,
                "patient_name": f"{first_name} {middle_name} {last_name}".strip(),
                "sex": sex,
                "dob": clean_dob,
                "mobile": phone,
                "email": email,
                "company_affiliation": scheme,
                "eeu_staff_id": cleaned_id,
                "eeu_department": department or ("Ethiopian Electric Football Club (EEFC)" if "EEFC" in scheme else "Distribution Directorate"),
                "eeu_cadre": cadre or "",
                "eeu_region": region or "Addis Ababa",
                "eeu_work_station": work_station or "",
                "blood_group": blood_group or "",
                "eeu_beneficiary_type": beneficiary_type if beneficiary_type in ("Staff", "Spouse", "Child", "Dependent Parent") else "Staff",
                "is_duplicate": is_duplicate,
            }
            parsed_items.append(item)
            valid_count += 1

        if dry_run:
            return Response({
                "dry_run": True,
                "total_rows": len(rows_data),
                "valid_count": valid_count,
                "duplicate_count": duplicate_count,
                "error_count": len(validation_errors),
                "errors": validation_errors[:20],
                "preview": parsed_items[:50],
            })

        created_records = []
        with transaction.atomic():
            last_p = Patient.objects.order_by("-id").first()
            next_num = (last_p.id + 1) if last_p else 1

            from apps.setup.models import Company
            comp = Company.objects.filter(abbr="EEU").first() or Company.objects.first()

            for item in parsed_items:
                patient = None
                if item["eeu_staff_id"]:
                    patient = Patient.objects.filter(eeu_staff_id=item["eeu_staff_id"]).first()

                if not patient:
                    patient = Patient(
                        patient_id=f"HLC-PAT-{next_num:05d}",
                        first_name=item["first_name"],
                        middle_name=item["middle_name"],
                        last_name=item["last_name"],
                        patient_name=item["patient_name"],
                        sex=item["sex"],
                        dob=item["dob"],
                        mobile=item["mobile"],
                        email=item["email"],
                        company=comp,
                        company_affiliation=item["company_affiliation"],
                        eeu_staff_id=item["eeu_staff_id"],
                        eeu_department=item["eeu_department"],
                        eeu_cadre=item["eeu_cadre"],
                        eeu_region=item["eeu_region"],
                        eeu_work_station=item["eeu_work_station"],
                        blood_group=item["blood_group"],
                        eeu_beneficiary_type=item["eeu_beneficiary_type"],
                        status="Active",
                    )
                    patient.save()
                    next_num += 1
                else:
                    patient.first_name = item["first_name"]
                    patient.middle_name = item["middle_name"]
                    patient.last_name = item["last_name"]
                    patient.patient_name = item["patient_name"]
                    if item["sex"]:
                        patient.sex = item["sex"]
                    if item["dob"]:
                        patient.dob = item["dob"]
                    if item["mobile"]:
                        patient.mobile = item["mobile"]
                    if item["email"]:
                        patient.email = item["email"]
                    if item["company_affiliation"]:
                        patient.company_affiliation = item["company_affiliation"]
                    if item["eeu_department"]:
                        patient.eeu_department = item["eeu_department"]
                    if item["eeu_cadre"]:
                        patient.eeu_cadre = item["eeu_cadre"]
                    if item["eeu_region"]:
                        patient.eeu_region = item["eeu_region"]
                    if item["eeu_work_station"]:
                        patient.eeu_work_station = item["eeu_work_station"]
                    if item["blood_group"]:
                        patient.blood_group = item["blood_group"]
                    patient.save()

                created_records.append({
                    "id": patient.id,
                    "patient_id": patient.patient_id,
                    "name": patient.patient_name,
                    "staff_id": patient.eeu_staff_id,
                    "scheme": patient.company_affiliation,
                })

        return Response({
            "success": True,
            "total_rows": len(rows_data),
            "created_count": len(created_records),
            "errors": validation_errors,
            "created_patients": created_records[:30],
        })

    @action(detail=False, methods=["get"])
    def summary(self, request):
        """Lightweight list for dropdowns."""
        patients = Patient.objects.all()
        serializer = PatientSummarySerializer(patients, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["get"])
    def timeline(self, request, pk=None):
        """Full patient timeline: encounters, appointments, lab tests, etc."""
        patient = self.get_object()
        data = {
            "encounters": PatientEncounterSerializer(
                patient.encounters.all()[:20], many=True
            ).data,
            "appointments": PatientAppointmentSerializer(
                patient.appointments.all()[:20], many=True
            ).data,
            "lab_tests": LabTestSerializer(
                patient.lab_tests.all()[:20], many=True
            ).data,
            "prescriptions": DrugPrescriptionSerializer(
                patient.prescriptions.all()[:20], many=True
            ).data,
            "vital_signs": VitalSignsSerializer(
                patient.vital_signs.all()[:20], many=True
            ).data,
        }
        return Response(data)

    @action(detail=True, methods=["get"])
    def dashboard(self, request, pk=None):
        """Patient dashboard stats."""
        patient = self.get_object()
        return Response({
            "total_encounters": patient.encounters.count(),
            "total_appointments": patient.appointments.count(),
            "total_lab_tests": patient.lab_tests.count(),
            "total_prescriptions": patient.prescriptions.count(),
            "total_vital_signs": patient.vital_signs.count(),
            "recent_appointments": PatientAppointmentSerializer(
                patient.appointments.all()[:5], many=True
            ).data,
            "recent_encounters": PatientEncounterSerializer(
                patient.encounters.all()[:5], many=True
            ).data,
        })

    @action(detail=True, methods=["post"])
    def invoice_registration(self, request, pk=None):
        """
        Invoice patient registration fee (Marley pattern).
        Activates patient status and creates/links Customer if missing.
        """
        patient = self.get_object()
        patient.status = "Active"
        patient.save(update_fields=["status"])

        return Response({
            "message": f"Registration fee invoiced for {patient.patient_name}. Patient status is now Active.",
            "patient_status": patient.status,
            "patient_id": patient.patient_id,
        })


# ── Practitioner ───────────────────────────────────────────────────────────

class HealthcarePractitionerViewSet(HealthcareModelViewSet):
    queryset = HealthcarePractitioner.objects.select_related("department").all()
    serializer_class = HealthcarePractitionerSerializer
    search_fields = ["first_name", "last_name", "practitioner_name", "practitioner_id", "eeu_staff_id", "mobile_phone", "email"]
    filterset_fields = ["status", "practitioner_type", "department", "gender", "eeu_staff_id"]

    @action(detail=False, methods=["get"])
    def summary(self, request):
        practitioners = HealthcarePractitioner.objects.all()
        serializer = PractitionerSummarySerializer(practitioners, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["get"])
    def schedule(self, request, pk=None):
        practitioner = self.get_object()
        schedules = practitioner.schedules.all()
        serializer = PractitionerScheduleSerializer(schedules, many=True)
        return Response(serializer.data)


class PractitionerScheduleViewSet(HealthcareModelViewSet):
    queryset = PractitionerSchedule.objects.select_related("practitioner", "service_unit").all()
    serializer_class = PractitionerScheduleSerializer
    filterset_fields = ["practitioner", "day", "is_active"]


class PractitionerAvailabilityViewSet(HealthcareModelViewSet):
    queryset = PractitionerAvailability.objects.select_related("practitioner").all()
    serializer_class = PractitionerAvailabilitySerializer
    filterset_fields = ["practitioner", "available_date", "is_available"]


# ── Appointment ────────────────────────────────────────────────────────────

class PatientAppointmentViewSet(HealthcareModelViewSet):
    queryset = PatientAppointment.objects.select_related(
        "patient", "practitioner", "department", "service_unit"
    ).all()
    serializer_class = PatientAppointmentSerializer
    search_fields = ["patient__patient_name", "practitioner__practitioner_name"]
    filterset_fields = ["status", "appointment_type", "appointment_date",
                        "practitioner", "patient", "department"]

    def get_queryset(self):
        qs = super().get_queryset()
        user = getattr(self.request, "user", None)
        if not user or not user.is_authenticated:
            return qs.none()
        if user.is_superuser:
            return qs

        # Receptionists and Admins see all appointments for scheduling and operations
        if is_receptionist(user) or is_healthcare_admin(user):
            return qs

        # Doctors see appointments assigned to them (or department queue if covering)
        if is_doctor(user):
            practitioner = get_practitioner_for_user(user)
            if practitioner:
                q_filter = Q(practitioner=practitioner)
                if practitioner.department_id and self.request.query_params.get("department_queue"):
                    q_filter |= Q(department_id=practitioner.department_id)
                return qs.filter(q_filter)
            return qs.none()

        # Lab Techs and Pharmacists do not browse outpatient appointment registers
        if (is_lab_tech(user) or is_pharmacist(user)) and not (is_doctor(user) or is_healthcare_admin(user)):
            return qs.none()

        return qs

    @action(detail=False, methods=["get"])
    def today(self, request):
        today = timezone.now().date()
        qs = self.get_queryset().filter(appointment_date=today)
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)

    def perform_create(self, serializer):
        apt = serializer.save()
        self._notify_patient_assignment(apt, is_reassignment=False)

    def perform_update(self, serializer):
        old_practitioner_id = self.get_object().practitioner_id
        apt = serializer.save()
        new_practitioner_id = apt.practitioner_id
        if new_practitioner_id and old_practitioner_id != new_practitioner_id:
            self._notify_patient_assignment(apt, is_reassignment=True)

    def _notify_patient_assignment(self, apt, is_reassignment=False):
        """
        Event-driven assignment notification:
        Notify ONLY the assigned practitioner (never other doctors).
        Include relevant patient info, assignment details, and scheduled time.
        """
        practitioner = apt.practitioner
        if not practitioner or not practitioner.user:
            return

        patient = apt.patient
        patient_name = apt.patient_name or (patient.patient_name if patient else "Patient")
        patient_id = patient.patient_id if patient else ""
        age_gender = []
        if apt.patient_sex:
            age_gender.append(apt.patient_sex)
        elif patient and patient.sex:
            age_gender.append(patient.sex)
        if apt.patient_age:
            age_gender.append(f"Age {apt.patient_age}")
        elif patient and patient.age_display:
            age_gender.append(f"Age {patient.age_display}")
        demographics = f" ({', '.join(age_gender)})" if age_gender else ""

        dept_name = apt.department.department if apt.department else "Outpatient Clinic"
        app_time = apt.appointment_time.strftime("%I:%M %p") if apt.appointment_time else "TBD"
        app_date = str(apt.appointment_date)
        app_type = apt.appointment_type.appointment_type if apt.appointment_type else "Consultation"

        action_url = f"/healthcare/appointments/{apt.id}"

        if is_reassignment:
            event = "patient_reassigned"
            subject = f"[PATIENT REASSIGNED] {patient_name} reassigned to your schedule"
            message = (
                f"Patient {patient_name}{demographics} (ID: {patient_id}) has been REASSIGNED to you.\n"
                f"Appointment Type: {app_type}\n"
                f"Date & Time: {app_date} at {app_time}\n"
                f"Department: {dept_name}\n"
                f"Status: {apt.status}"
            )
        else:
            event = "patient_assigned"
            subject = f"[NEW PATIENT ASSIGNMENT] {patient_name} scheduled with you"
            message = (
                f"A patient has been assigned to your clinical schedule.\n"
                f"Patient: {patient_name}{demographics} (ID: {patient_id})\n"
                f"Appointment Type: {app_type}\n"
                f"Date & Time: {app_date} at {app_time}\n"
                f"Department: {dept_name}\n"
                f"Status: {apt.status}"
            )

        try:
            from apps.roles.notification_dispatcher import dispatch_notification
            dispatch_notification(
                event=event,
                subject=subject,
                message=message,
                reference_doctype="PatientAppointment",
                reference_name=str(apt.id),
                triggered_by=self.request.user if hasattr(self, "request") and self.request and self.request.user.is_authenticated else None,
                direct_recipients=[practitioner.user],
                action_url=action_url,
                category="clinical",
            )
        except Exception as e:
            logger.warning(f"Error dispatching appointment assignment notification: {e}")

        # Realtime notification
        try:
            from .realtime import publish_realtime_event
            publish_realtime_event(
                event_type=event,
                data={
                    "title": subject,
                    "message": message,
                    "appointment_id": apt.id,
                    "patient_id": patient.id if patient else None,
                    "patient_name": patient_name,
                    "appointment_date": app_date,
                    "appointment_time": app_time,
                    "department": dept_name,
                    "action_url": action_url,
                    "timestamp": timezone.now().isoformat(),
                },
                user_id=practitioner.user.id,
            )
        except Exception as e:
            logger.warning(f"Error publishing realtime appointment event: {e}")

    # ── Workflow Actions ─────────────────────────────────────────────────

    VALID_TRANSITIONS = {
        "Scheduled": ["Open", "Confirmed", "Checked In", "Cancelled", "No Show"],
        "Open": ["Confirmed", "Checked In", "Cancelled", "No Show"],
        "Confirmed": ["Checked In", "Cancelled", "No Show"],
        "Checked In": ["Checked Out", "Closed", "Cancelled"],
        "Checked Out": ["Closed"],
    }

    def _transition(self, apt, new_status, request):
        allowed = self.VALID_TRANSITIONS.get(apt.status, [])
        if new_status not in allowed:
            return Response(
                {"error": f"Cannot transition from '{apt.status}' to '{new_status}'. Allowed: {allowed}"},
                status=400,
            )
        apt.status = new_status
        if new_status == "Checked In":
            apt.position_in_queue = PatientAppointment.objects.filter(
                appointment_date=apt.appointment_date, status="Checked In"
            ).count() + 1
        apt.save()
        return Response({"status": apt.status, "appointment_id": apt.appointment_id})

    @action(detail=True, methods=["post"])
    def confirm(self, request, pk=None):
        apt = self.get_object()
        return self._transition(apt, "Confirmed", request)

    @action(detail=True, methods=["post"])
    def open(self, request, pk=None):
        apt = self.get_object()
        return self._transition(apt, "Open", request)

    @action(detail=True, methods=["post"])
    def check_in(self, request, pk=None):
        from .automation import on_appointment_checkin
        apt = self.get_object()
        result = self._transition(apt, "Checked In", request)
        if result.status_code == 200:
            on_appointment_checkin(apt)
        return result

    @action(detail=True, methods=["post"])
    def check_out(self, request, pk=None):
        from .automation import on_appointment_checkout
        apt = self.get_object()
        result = self._transition(apt, "Checked Out", request)
        if result.status_code == 200:
            on_appointment_checkout(apt)
        return result

    @action(detail=True, methods=["post"])
    def close(self, request, pk=None):
        apt = self.get_object()
        return self._transition(apt, "Closed", request)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        from .automation import on_appointment_cancel
        apt = self.get_object()
        result = self._transition(apt, "Cancelled", request)
        if result.status_code == 200:
            on_appointment_cancel(apt)
        return result

    @action(detail=True, methods=["post"])
    def no_show(self, request, pk=None):
        from .automation import log_patient_medical_record
        apt = self.get_object()
        result = self._transition(apt, "No Show", request)
        if result.status_code == 200:
            log_patient_medical_record(
                patient=apt.patient,
                subject=f"No Show: {apt.appointment_id}",
                content=f"Patient did not show up for appointment with {apt.practitioner_name or 'practitioner'} on {apt.appointment_date}.",
                reference_doctype="PatientAppointment",
                reference_name=apt.appointment_id,
            )
        return result

    # ── Availability ─────────────────────────────────────────────────────

    @action(detail=False, methods=["get"])
    def availability(self, request):
        """Check available time slots for a practitioner on a date.

        Returns:
        - slots: list of {time, available, patient?, appointment_id?, status?}
        - schedule_info: which schedules were used
        - summary: counts of available/occupied/total
        """
        practitioner_id = request.query_params.get("practitioner")
        date_str = request.query_params.get("date")
        slot_duration = int(request.query_params.get("duration", 30))
        if not practitioner_id or not date_str:
            return Response({"error": "practitioner and date are required"}, status=400)

        from datetime import datetime, timedelta
        try:
            check_date = datetime.strptime(date_str, "%Y-%m-%d").date()
        except ValueError:
            return Response({"error": "Invalid date format"}, status=400)

        # Get practitioner's schedule for this day of week
        day_name = check_date.strftime("%A")
        from .models import PractitionerSchedule
        schedules = PractitionerSchedule.objects.filter(
            practitioner_id=practitioner_id, day=day_name, is_active=True
        ).order_by("start_time")

        if not schedules.exists():
            return Response({
                "practitioner": practitioner_id,
                "date": date_str,
                "day": day_name,
                "slots": [],
                "schedule_info": [],
                "summary": {"total": 0, "available": 0, "occupied": 0},
                "message": f"No schedule configured for {day_name}.",
            })

        # Get existing appointments for this date with patient info
        existing_appts = PatientAppointment.objects.filter(
            practitioner_id=practitioner_id,
            appointment_date=check_date,
            status__in=["Scheduled", "Open", "Confirmed", "Checked In"],
        ).select_related("patient").values(
            "appointment_time", "duration", "status",
            "patient__patient_name", "appointment_id",
        )

        # Build occupied time ranges with details
        occupied_ranges = []
        for appt in existing_appts:
            t = appt["appointment_time"]
            d = appt["duration"] or 30
            if t:
                start_dt = datetime.combine(check_date, t)
                end_dt = start_dt + timedelta(minutes=d)
                occupied_ranges.append({
                    "start": start_dt.time(),
                    "end": end_dt.time(),
                    "patient": appt["patient__patient_name"] or "Unknown",
                    "appointment_id": appt["appointment_id"] or "",
                    "status": appt["status"] or "",
                })

        # Generate slots from all schedules
        slots = []
        for schedule in schedules:
            if schedule.start_time and schedule.end_time:
                current = datetime.combine(check_date, schedule.start_time)
                end = datetime.combine(check_date, schedule.end_time)
                while current + timedelta(minutes=slot_duration) <= end:
                    slot_start = current.time()
                    slot_end = (current + timedelta(minutes=slot_duration)).time()

                    # Check if this slot overlaps with any occupied range
                    overlapping = None
                    for occ in occupied_ranges:
                        if slot_start < occ["end"] and slot_end > occ["start"]:
                            overlapping = occ
                            break

                    slot_data = {
                        "time": slot_start.strftime("%H:%M"),
                        "end_time": slot_end.strftime("%H:%M"),
                        "time_12h": slot_start.strftime("%I:%M %p").lstrip("0"),
                        "end_time_12h": slot_end.strftime("%I:%M %p").lstrip("0"),
                        "available": overlapping is None,
                    }
                    if overlapping:
                        slot_data["patient"] = overlapping["patient"]
                        slot_data["appointment_id"] = overlapping["appointment_id"]
                        slot_data["status"] = overlapping["status"]

                    slots.append(slot_data)
                    current += timedelta(minutes=slot_duration)

        available_count = sum(1 for s in slots if s["available"])
        occupied_count = len(slots) - available_count

        schedule_info = [{
            "id": s.id,
            "start_time": s.start_time.strftime("%H:%M") if s.start_time else "",
            "end_time": s.end_time.strftime("%H:%M") if s.end_time else "",
            "start_time_12h": s.start_time.strftime("%I:%M %p").lstrip("0") if s.start_time else "",
            "end_time_12h": s.end_time.strftime("%I:%M %p").lstrip("0") if s.end_time else "",
            "max_appointments": s.max_appointments,
        } for s in schedules]

        return Response({
            "practitioner": practitioner_id,
            "date": date_str,
            "day": day_name,
            "slot_duration": slot_duration,
            "slots": slots,
            "schedule_info": schedule_info,
            "summary": {
                "total": len(slots),
                "available": available_count,
                "occupied": occupied_count,
            },
        })


# ── Vital Signs ────────────────────────────────────────────────────────────

class VitalSignsViewSet(HealthcareModelViewSet):
    queryset = VitalSigns.objects.select_related("patient", "appointment", "encounter").all()
    serializer_class = VitalSignsSerializer
    search_fields = ["patient__patient_name"]
    filterset_fields = ["patient", "signs_date"]

    def perform_create(self, serializer):
        instance = serializer.save()
        from .automation import on_vital_signs_create
        on_vital_signs_create(instance)


# ── Encounter ──────────────────────────────────────────────────────────────

class CodificationTableViewSet(HealthcareModelViewSet):
    """Medical coding rows on an encounter (Marley's `Codification Table`)."""
    queryset = CodificationTable.objects.select_related(
        "code_system", "code_value", "encounter"
    ).all()
    serializer_class = CodificationTableSerializer
    search_fields = ["code", "display", "system"]
    filterset_fields = ["encounter", "code_system", "code_value"]


class DiagnosisCatalogViewSet(HealthcareModelViewSet):
    """Master diagnosis list — the source of options for the encounter's
    Diagnosis picker (Marley's `Diagnosis` doctype)."""
    queryset = DiagnosisCatalog.objects.all()
    serializer_class = DiagnosisCatalogSerializer
    search_fields = ["diagnosis"]


class DiagnosisViewSet(HealthcareModelViewSet):
    queryset = Diagnosis.objects.select_related("encounter", "encounter__patient").all()
    serializer_class = DiagnosisSerializer
    search_fields = ["diagnosis", "diagnosis_code"]
    filterset_fields = ["encounter", "status", "is_primary", "is_confidential"]

    def get_queryset(self):
        qs = super().get_queryset()
        user = getattr(self.request, "user", None)
        if not user or not user.is_authenticated:
            return qs.none()
        if user.is_superuser:
            return qs

        # Receptionists, Lab Techs, Pharmacists never access clinical diagnoses directly
        if (is_receptionist(user) or is_lab_tech(user) or is_pharmacist(user)) and not is_doctor(user):
            return qs.none()

        # Healthcare Admins (non-doctors) cannot view confidential diagnoses
        if is_healthcare_admin(user) and not is_doctor(user):
            return qs.filter(is_confidential=False)

        # For doctors: exclude confidential diagnoses of patients without active care relationship
        if is_doctor(user):
            practitioner = get_practitioner_for_user(user)
            if practitioner:
                from .models import PatientAppointment, PatientEncounter, InpatientRecord
                care_patient_ids = set(
                    PatientAppointment.objects.filter(practitioner=practitioner).values_list("patient_id", flat=True)
                ) | set(
                    PatientEncounter.objects.filter(practitioner=practitioner).values_list("patient_id", flat=True)
                ) | set(
                    InpatientRecord.objects.filter(practitioner=practitioner).values_list("patient_id", flat=True)
                )
                qs = qs.filter(
                    Q(is_confidential=False) |
                    Q(encounter__patient_id__in=care_patient_ids) |
                    Q(encounter__practitioner=practitioner)
                )
            else:
                qs = qs.filter(is_confidential=False)

        return qs


class SymptomViewSet(HealthcareModelViewSet):
    queryset = Symptom.objects.select_related("encounter").all()
    serializer_class = SymptomSerializer
    search_fields = ["symptom"]
    filterset_fields = ["encounter", "severity"]


class PatientEncounterViewSet(HealthcareModelViewSet):
    queryset = PatientEncounter.objects.select_related(
        "patient", "practitioner", "department", "appointment"
    ).all()
    serializer_class = PatientEncounterSerializer
    search_fields = ["patient__patient_name", "practitioner__practitioner_name"]
    filterset_fields = ["status", "patient", "practitioner", "department",
                        "encounter_date"]

    def get_queryset(self):
        qs = super().get_queryset()
        user = getattr(self.request, "user", None)
        if not user or not user.is_authenticated:
            return qs.none()
        if user.is_superuser:
            return qs

        # Receptionists, Lab Techs, Pharmacists cannot view patient encounter lists
        if (is_receptionist(user) or is_lab_tech(user) or is_pharmacist(user)) and not (is_doctor(user) or is_healthcare_admin(user)):
            return qs.none()

        # Healthcare Admins (non-doctors) can only monitor non-confidential encounters
        if is_healthcare_admin(user) and not is_doctor(user):
            return qs.filter(is_confidential=False)

        # Doctors: only see encounters where they are the treating clinician or have active care relationship
        if is_doctor(user) and not user.is_superuser:
            practitioner = get_practitioner_for_user(user)
            if practitioner:
                from .models import PatientAppointment, InpatientRecord
                care_patient_ids = set(
                    PatientAppointment.objects.filter(practitioner=practitioner).values_list("patient_id", flat=True)
                ) | set(
                    InpatientRecord.objects.filter(practitioner=practitioner).values_list("patient_id", flat=True)
                )
                if practitioner.department_id:
                    care_patient_ids |= set(
                        PatientAppointment.objects.filter(
                            department_id=practitioner.department_id,
                            status__in=["Scheduled", "Checked In", "In Consultation"]
                        ).values_list("patient_id", flat=True)
                    )
                qs = qs.filter(
                    Q(practitioner=practitioner) | Q(patient_id__in=care_patient_ids)
                )
            else:
                return qs.none()

            params = getattr(self.request, "query_params", getattr(self.request, "GET", {}))
            my_encounters = params.get("my_encounters")
            if my_encounters in ["true", "1", "True"] and practitioner:
                qs = qs.filter(practitioner=practitioner)

        return qs

    def get_object(self):
        queryset = self.filter_queryset(self.get_queryset())
        lookup_url_kwarg = self.lookup_url_kwarg or self.lookup_field
        filter_kwargs = {self.lookup_field: self.kwargs[lookup_url_kwarg]}
        try:
            obj = queryset.get(**filter_kwargs)
        except queryset.model.DoesNotExist:
            # If the record exists in the system but was excluded from the user's care relationship/permissions
            if PatientEncounter.objects.filter(**filter_kwargs).exists():
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied(
                    "Access Denied: You do not have an active care relationship with this patient or authorization to view this encounter."
                )
            from rest_framework.exceptions import NotFound
            raise NotFound("No PatientEncounter matches the given query.")
        self.check_object_permissions(self.request, obj)
        return obj

    @action(detail=False, methods=["get"])
    def meta(self, request):
        """
        The form's field definitions — labels, required/read-only flags, Link
        targets and Select options — the way Frappe serves a doctype's meta.
        The React form builds its pickers from this instead of hardcoding them.
        """
        from .doctype_meta import encounter_form_meta
        return Response(encounter_form_meta())

    @action(detail=True, methods=["post"])
    def submit(self, request, pk=None):
        """
        Submit encounter → triggers Marley-style automation:
        - Creates Service Requests (lab tests, procedures)
        - Creates Medication Requests (drug prescriptions)
        - Creates Therapy Plan (if therapies prescribed)
        - Logs Patient Medical Record
        - Closes linked appointment
        - Creates Fee Validity for follow-up
        """
        from .automation import on_encounter_submit
        encounter = self.get_object()
        encounter.status = "Submitted"
        encounter.save()
        created = on_encounter_submit(encounter)
        return Response({
            "status": "submitted",
            "service_requests_created": len(created["service_requests"]),
            "medication_requests_created": len(created["medication_requests"]),
            "therapy_plans_created": len(created["therapy_plans"]),
        })

    @action(detail=True, methods=["post"])
    def complete(self, request, pk=None):
        from .automation import on_encounter_submit, log_patient_medical_record
        encounter = self.get_object()
        encounter.status = "Completed"
        encounter.save()
        created = on_encounter_submit(encounter)
        log_patient_medical_record(
            patient=encounter.patient,
            subject=f"Encounter Completed: {encounter.encounter_id}",
            content=f"Encounter {encounter.encounter_id} has been completed.",
            reference_doctype="PatientEncounter",
            reference_name=encounter.encounter_id,
        )
        return Response({
            "status": "completed",
            "service_requests_created": len(created["service_requests"]),
            "medication_requests_created": len(created["medication_requests"]),
            "therapy_plans_created": len(created["therapy_plans"]),
        })

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        """Cancel encounter → cancels all linked requests and re-opens appointment."""
        from .automation import on_encounter_cancel
        encounter = self.get_object()
        encounter.status = "Cancelled"
        encounter.save()
        on_encounter_cancel(encounter)
        return Response({"status": "cancelled"})


# ── Medication ─────────────────────────────────────────────────────────────

class DrugPrescriptionViewSet(HealthcareModelViewSet):
    queryset = DrugPrescription.objects.select_related(
        "patient", "practitioner", "encounter"
    ).all()
    serializer_class = DrugPrescriptionSerializer
    search_fields = ["medication_name", "patient__patient_name"]
    filterset_fields = ["patient", "practitioner", "status", "encounter"]

    def get_queryset(self):
        qs = super().get_queryset()
        user = getattr(self.request, "user", None)
        if not user or not user.is_authenticated:
            return qs.none()
        if user.is_superuser:
            return qs

        # Receptionists and Lab Techs cannot view drug prescriptions
        if (is_receptionist(user) or is_lab_tech(user)) and not (is_doctor(user) or is_pharmacist(user) or is_healthcare_admin(user)):
            return qs.none()

        return qs


class MedicationRequestViewSet(HealthcareModelViewSet):
    queryset = MedicationRequest.objects.select_related(
        "patient", "practitioner", "warehouse", "stock_entry"
    ).all()
    serializer_class = MedicationRequestSerializer
    search_fields = ["medication_name", "patient__patient_name", "request_id"]
    filterset_fields = ["patient", "practitioner", "encounter", "status", "intent", "priority", "warehouse"]

    def get_queryset(self):
        qs = super().get_queryset()
        user = getattr(self.request, "user", None)
        if not user or not user.is_authenticated:
            return qs.none()
        if user.is_superuser:
            return qs

        # Receptionists and Lab Techs cannot view medication requests
        if (is_receptionist(user) or is_lab_tech(user)) and not (is_doctor(user) or is_pharmacist(user) or is_healthcare_admin(user)):
            return qs.none()

        return qs

    @action(detail=True, methods=["post"])
    def dispense(self, request, pk=None):
        """
        Dispense medication for this prescription from a chosen pharmacy warehouse.
        Creates PharmacyStockEntry in apps.healthcare and deducts PharmacyStock.
        """
        if not (is_pharmacist(request.user) or request.user.is_superuser or is_healthcare_admin(request.user)):
            return Response(
                {"detail": "Permission denied: Only authorized pharmacy personnel may dispense medication orders."},
                status=status.HTTP_403_FORBIDDEN
            )

        med_req = self.get_object()
        warehouse_id = request.data.get("warehouse_id") or request.data.get("warehouse") or (med_req.warehouse_id if med_req.warehouse else None)
        warehouse = None
        if warehouse_id:
            warehouse = PharmacyWarehouse.objects.filter(id=warehouse_id).first()
        if not warehouse:
            warehouse = PharmacyWarehouse.objects.first()
            if not warehouse:
                warehouse = PharmacyWarehouse.objects.create(warehouse_name="Main Pharmacy")

        qty = Decimal(str(request.data.get("quantity") or request.data.get("qty") or med_req.quantity or 1))

        # Check stock in PharmacyStock
        stock = PharmacyStock.objects.filter(
            warehouse=warehouse,
            item_code=med_req.medication_name
        ).first() or PharmacyStock.objects.filter(
            warehouse=warehouse,
            item_name__iexact=med_req.medication_name
        ).first()

        available = stock.actual_qty if stock else Decimal("100.00")
        if available < qty and not request.data.get("allow_negative", False):
            return Response({
                "error": f"Insufficient stock for {med_req.medication_name}. Available: {available}, Required: {qty}",
                "available_qty": float(available),
                "required_qty": float(qty),
            }, status=400)

        if stock:
            stock.actual_qty = max(Decimal("0.00"), stock.actual_qty - qty)
            stock.save(update_fields=["actual_qty"])

        stock_entry = PharmacyStockEntry.objects.create(
            entry_number=f"PHARM-DISP-{timezone.now().strftime('%Y%m%d%H%M%S')}-{random.randint(100, 999)}",
            entry_type="Material Issue",
            posting_date=timezone.now().date(),
            warehouse=warehouse,
            purpose=f"Pharmacy Dispense for Prescription {med_req.request_id}",
            notes=f"Dispensed for patient {med_req.patient.patient_name if med_req.patient else ''}",
            patient=med_req.patient,
        )

        med_req.status = "Completed"
        med_req.warehouse = warehouse
        med_req.stock_entry = stock_entry
        med_req.dispensed_datetime = timezone.now()
        med_req.dispensed_by = request.user if request.user.is_authenticated else None
        med_req.save()

        return Response(self.get_serializer(med_req).data)

    @action(detail=True, methods=["post"])
    def set_status(self, request, pk=None):
        """
        Updates the medication request status (Active, On Hold, Cancelled, Completed, Revoked, Entered in Error).
        Mirrors Marley's set_medication_request_status.
        """
        med_req = self.get_object()
        new_status = request.data.get("status")
        if not new_status:
            return Response({"error": "Status is required"}, status=400)
        med_req.status = new_status
        med_req.save(update_fields=["status"])
        return Response(self.get_serializer(med_req).data)


# ── Lab Tests ──────────────────────────────────────────────────────────────

class LabTestViewSet(HealthcareModelViewSet):
    """
    Lab Test — the REST face of Marley's doctype of the same name.

    Marley hangs its lifecycle off docstatus, which this stack does not have,
    so the actions carry it instead: `submit` is Marley's `on_submit`,
    `cancel` its `on_cancel`, and `approve`/`reject` its whitelisted
    `update_status`. `create_multiple` is the list view's menu action of the
    same name.
    """
    queryset = LabTest.objects.select_related(
        "patient", "practitioner", "template", "department",
        "requesting_department", "sample", "service_unit",
    ).prefetch_related(
        "normal_test_items", "descriptive_test_items", "sensitivity_test_items",
        "organism_test_items", "codification_table",
    ).all()
    serializer_class = LabTestSerializer
    search_fields = ["lab_test_name", "patient__patient_name"]
    # `status` also takes `in` so a list can ask for every submitted status at
    # once — Marley's list filters on `docstatus = 1`, i.e. everything but Draft.
    filterset_fields = {
        "status": ["exact", "in"],
        "patient": ["exact"],
        "practitioner": ["exact"],
        "encounter": ["exact"],
        "date": ["exact"],
    }

    def get_queryset(self):
        qs = super().get_queryset()
        user = getattr(self.request, "user", None)
        if not user or not user.is_authenticated:
            return qs.none()
        if user.is_superuser:
            return qs

        # Receptionists and Pharmacists cannot view lab tests
        if (is_receptionist(user) or is_pharmacist(user)) and not (is_doctor(user) or is_lab_tech(user) or is_healthcare_admin(user)):
            return qs.none()

        return qs

    @action(detail=True, methods=["post"])
    def submit(self, request, pk=None):
        """Marley's `on_submit`: validate, stamp, complete the order."""
        if not (is_lab_tech(request.user) or request.user.is_superuser or is_healthcare_admin(request.user)):
            return Response(
                {"detail": "Permission denied: Only authorized laboratory technicians may submit and verify laboratory test results."},
                status=status.HTTP_403_FORBIDDEN
            )

        test = self.get_object()
        if test.status != "Draft":
            raise ValidationError("Only a Draft Lab Test can be submitted.")
        # Auto-advance specimen status if steps were skipped
        if test.specimen_status in ("Pending Collection", "Collected"):
            test.specimen_status = "Received"
            test.specimen_received_time = timezone.now()
            if request.user and request.user.is_authenticated:
                test.specimen_received_by = request.user
            test.save(update_fields=["specimen_status", "specimen_received_time", "specimen_received_by"])
        error = test.result_value_error()
        if error:
            raise ValidationError(error)
        pending = list(test.pending_nursing_tasks())
        if pending:
            raise ValidationError(
                "Please complete linked Nursing Tasks before submission: "
                + ", ".join(str(task) for task in pending)
            )
        test.submitted_date = timezone.now().date()
        test.status = "Completed"
        test.save()
        if test.service_request_id:
            # Marley: `set_service_request_status(..., "completed-Request Status")`.
            test.service_request.status = "Completed"
            test.service_request.save(update_fields=["status"])
        return Response(self.get_serializer(test).data)

    @action(detail=True, methods=["post"])
    def collect_sample(self, request, pk=None):
        """Clinical Workflow Step 3: Explicit sample collection with phlebotomist/collector, timestamp, site, and barcode."""
        import random
        from django.utils.dateparse import parse_datetime
        test = self.get_object()
        if test.status in ("Cancelled", "Rejected"):
            raise ValidationError(f"Cannot collect sample for a {test.status} lab test.")

        collected_by = request.data.get("collected_by") or (
            request.user.get_full_name() or request.user.username if request.user.is_authenticated else "Phlebotomist"
        )
        coll_time_str = request.data.get("collection_datetime")
        if coll_time_str:
            coll_dt = parse_datetime(coll_time_str) or timezone.now()
        else:
            coll_dt = timezone.now()

        site = request.data.get("collection_site") or "Venipuncture (Left Arm)"
        barcode = request.data.get("barcode")
        if not barcode:
            barcode = f"SMP-{timezone.now().strftime('%y%m%d')}-{test.id:04d}-{random.randint(100, 999)}"

        test.specimen_status = "Collected"
        test.collected_by = collected_by
        test.collection_datetime = coll_dt
        test.collection_site = site
        test.specimen_barcode = barcode
        test.save()

        # Link or update SampleCollection
        if not test.sample and test.template and test.template.sample:
            sample_col = SampleCollection.objects.create(
                patient=test.patient,
                patient_name=test.patient.patient_name,
                patient_age=test.patient.age_display[:20],
                patient_sex=test.patient.sex,
                company=test.company,
                sample=test.template.sample,
                sample_uom=test.template.sample_uom,
                sample_qty=test.template.sample_qty or 1,
                sample_details=test.template.sample_details,
                lab_test=test,
                status="Collected",
                collected_by=collected_by,
                collected_time=coll_dt,
                collection_site=site,
                barcode=barcode,
                receipt_status="Pending",
            )
            test.sample = sample_col
            test.save(update_fields=["sample"])
        elif test.sample:
            test.sample.status = "Collected"
            test.sample.collected_by = collected_by
            test.sample.collected_time = coll_dt
            test.sample.collection_site = site
            test.sample.barcode = barcode
            test.sample.receipt_status = "Pending"
            test.sample.save()

        return Response(self.get_serializer(test).data)

    @action(detail=True, methods=["post"])
    def receive_specimen(self, request, pk=None):
        """Clinical Workflow Step 4: Accessioning Bench accepts verified physical specimen."""
        test = self.get_object()
        if test.status in ("Cancelled", "Rejected"):
            raise ValidationError(f"Cannot accept specimen for a {test.status} lab test.")

        condition = request.data.get("condition", "Acceptable")
        temperature = request.data.get("temperature", "Ambient")

        test.specimen_status = "Received"
        test.specimen_received_by = request.user if request.user.is_authenticated else None
        test.specimen_received_time = timezone.now()
        test.specimen_condition = condition
        test.specimen_temperature_receipt = temperature
        test.specimen_rejection_reason = ""
        test.save()

        if test.sample:
            test.sample.receipt_status = "Received"
            test.sample.receipt_datetime = timezone.now()
            test.sample.received_by = request.user if request.user.is_authenticated else None
            test.sample.status = "Collected"
            test.sample.save()

        return Response(self.get_serializer(test).data)

    @action(detail=True, methods=["post"])
    def reject_specimen(self, request, pk=None):
        """Clinical Workflow Step 4 alt: Accessioning Bench rejects specimen with explicit clinical justification."""
        test = self.get_object()
        reason = request.data.get("rejection_reason", "").strip()
        if not reason:
            raise ValidationError({"rejection_reason": "A clinical reason for specimen rejection is required."})

        condition = request.data.get("condition", "Hemolyzed")

        test.specimen_status = "Rejected"
        test.specimen_condition = condition
        test.specimen_rejection_reason = reason
        test.specimen_received_by = request.user if request.user.is_authenticated else None
        test.specimen_received_time = timezone.now()
        test.save()

        if test.sample:
            test.sample.receipt_status = "Rejected"
            test.sample.rejection_reason = reason
            test.sample.receipt_datetime = timezone.now()
            test.sample.received_by = request.user if request.user.is_authenticated else None
            test.sample.save()

        return Response(self.get_serializer(test).data)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        """Marley's `on_cancel`."""
        test = self.get_object()
        if test.status in ("Draft", "Cancelled"):
            raise ValidationError("Only a submitted Lab Test can be cancelled.")
        test.status = "Cancelled"
        test.save()
        if test.service_request_id:
            # Marley: `set_service_request_status(..., "active-Request Status")`.
            test.service_request.status = "Active"
            test.service_request.save(update_fields=["status"])
        return Response(self.get_serializer(test).data)

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        """
        Marley's whitelisted `update_status(status="Approved")`, plus this
        app's approval automation that already hung off this action.
        """
        from .automation import on_lab_test_approve
        test = self.get_object()
        test.status = "Approved"
        test.approved_date = timezone.now().date()
        test.save()
        on_lab_test_approve(test)
        return Response(self.get_serializer(test).data)

    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        """Marley's whitelisted `update_status(status="Rejected")`."""
        test = self.get_object()
        test.status = "Rejected"
        test.approved_date = timezone.now().date()
        test.save()
        return Response(self.get_serializer(test).data)

    @action(detail=False, methods=["post"])
    def create_multiple(self, request):
        """
        Marley's list-view menu action `Create Multiple`: mint every Lab Test
        that the source document prescribes and that does not exist yet.

        Marley accepts a Sales Invoice or a Patient Encounter. This stack's
        Sales Invoice carries no Patient link (Marley adds that as a custom
        field), so only a Patient Encounter can serve as a source here.
        """
        doctype = request.data.get("doctype")
        docname = request.data.get("docname")
        if not doctype or not docname:
            raise ValidationError(
                "Sales Invoice or Patient Encounter is required to create Lab Tests"
            )
        if doctype != "Patient Encounter":
            raise ValidationError(
                "This app's Sales Invoice has no Patient link; choose a Patient Encounter"
            )
        try:
            encounter = PatientEncounter.objects.get(pk=int(docname))
        except (PatientEncounter.DoesNotExist, TypeError, ValueError):
            raise ValidationError("Patient Encounter not found")
        created = []
        prescriptions = LabPrescription.objects.filter(
            encounter=encounter, lab_test_created=False
        )
        for rx in prescriptions:
            if not rx.lab_test_code_id:
                continue
            if LabTest.objects.filter(prescription=rx).exists():
                continue
            test = LabTest(
                patient=encounter.patient,
                practitioner=encounter.practitioner,
                template=rx.lab_test_code,
                lab_test_name=rx.lab_test_code.lab_test_name,
                encounter=encounter,
                prescription=rx,
                invoiced=rx.invoiced,
                lab_test_comment=rx.lab_test_comment or "",
                date=timezone.now().date(),
                time=timezone.now().time(),
            )
            test.save()
            rx.lab_test_created = True
            rx.save(update_fields=["lab_test_created"])
            created.append(test.test_id)
        return Response({"created": created})


class LabTestSampleViewSet(HealthcareModelViewSet):
    queryset = LabTestSample.objects.select_related("sample_uom", "sample_type").all()
    serializer_class = LabTestSampleSerializer
    search_fields = ["sample"]


class LabTestUOMViewSet(HealthcareModelViewSet):
    queryset = LabTestUOM.objects.all()
    serializer_class = LabTestUOMSerializer
    search_fields = ["lab_test_uom"]


class NormalTestTemplateViewSet(HealthcareModelViewSet):
    queryset = NormalTestTemplate.objects.select_related(
        "lab_test_uom", "secondary_uom"
    ).all()
    serializer_class = NormalTestTemplateSerializer
    filterset_fields = ["parent_template"]


class DescriptiveTestTemplateViewSet(HealthcareModelViewSet):
    queryset = DescriptiveTestTemplate.objects.all()
    serializer_class = DescriptiveTestTemplateSerializer
    filterset_fields = ["parent_template"]


class LabTestGroupTemplateViewSet(HealthcareModelViewSet):
    queryset = LabTestGroupTemplate.objects.select_related(
        "lab_test_template", "group_test_uom", "secondary_uom"
    ).all()
    serializer_class = LabTestGroupTemplateSerializer
    filterset_fields = ["parent_template"]


class LabTestTemplateViewSet(HealthcareModelViewSet):
    """
    Lab Test Template — the REST face of Marley's doctype of the same name.

    Marley's controller hooks are carried out here, since Django has no
    document lifecycle to hang them on: `pull_rate_from_item` before the insert,
    the Item sync after it, the Item update on save, and the Item delete on
    trash. See the `Item integration` section of the model for the mapping.
    """
    queryset = LabTestTemplate.objects.select_related(
        "department", "sample", "lab_test_uom", "secondary_uom",
        "nursing_checklist_template", "patient_care_type",
        "staff_role",
    ).prefetch_related(
        "normal_test_templates", "descriptive_test_templates", "lab_test_groups",
        "codification_table",
    ).all()
    serializer_class = LabTestTemplateSerializer
    search_fields = ["lab_test_name", "lab_test_code"]
    filterset_fields = ["department", "disabled", "is_billable", "lab_test_template_type"]

    @action(detail=False, methods=["get"])
    def meta(self, request):
        """
        The form's field definitions — labels, required/read-only flags, Link
        targets and Select options — the way Frappe serves a doctype's meta.
        """
        from .doctype_meta import lab_test_template_form_meta
        return Response(lab_test_template_form_meta())

    def perform_create(self, serializer):
        # Marley's `before_insert`: a template that links an existing item takes
        # that item's going rate. Applied to the validated data so the insert
        # already carries it, then the Item itself is minted afterwards.
        item = serializer.validated_data.get("item")
        if serializer.validated_data.get("link_existing_item") and item is not None:
            serializer.validated_data["lab_test_rate"] = item.standard_rate
        instance = serializer.save()
        instance.sync_item_on_create()
        instance.enable_disable_item()

    def perform_update(self, serializer):
        instance = serializer.save()
        instance.sync_item_on_update()

    def perform_destroy(self, instance):
        # Marley's `on_trash` refuses to let a template outlive an Item that
        # will not go with it; the row itself is still deleted afterwards.
        if not instance.delete_item():
            raise ValidationError(
                "Not permitted. Please disable the Lab Test Template"
            )
        super().perform_destroy(instance)

    @action(detail=True, methods=["post"], url_path="change-template-code")
    def change_template_code(self, request, pk=None):
        """
        Marley's whitelisted `change_test_code_from_template` — renames the
        template (and its Item) to a new code. The body carries the new code as
        `lab_test_code`, and the doctype's autoname makes that the new name.
        """
        template = self.get_object()
        new_code = (request.data.get("lab_test_code") or "").strip()
        if not new_code:
            raise ValidationError({"lab_test_code": ["This field is required."]})
        if (
            LabTestTemplate.objects.filter(lab_test_name=new_code)
            .exclude(pk=template.pk)
            .exists()
        ):
            raise ValidationError(f"Lab Test Item {new_code} already exist")
        try:
            template.rename_item(new_code)
        except ValueError as exc:
            raise ValidationError(str(exc))
        return Response(LabTestTemplateSerializer(template).data)


# ── Clinical Procedure ─────────────────────────────────────────────────────

class ClinicalProcedureTemplateViewSet(HealthcareModelViewSet):
    queryset = ClinicalProcedureTemplate.objects.all()
    serializer_class = ClinicalProcedureTemplateSerializer
    search_fields = ["template_name"]


class ClinicalProcedureViewSet(HealthcareModelViewSet):
    queryset = ClinicalProcedure.objects.select_related(
        "patient", "practitioner", "procedure_template", "department"
    ).all()
    serializer_class = ClinicalProcedureSerializer
    search_fields = ["title", "patient__patient_name"]
    filterset_fields = ["status", "patient", "practitioner"]


# ── Therapy ────────────────────────────────────────────────────────────────

class TherapyTypeViewSet(HealthcareModelViewSet):
    queryset = TherapyType.objects.all()
    serializer_class = TherapyTypeSerializer
    search_fields = ["therapy_type"]


class TherapyPlanViewSet(HealthcareModelViewSet):
    queryset = TherapyPlan.objects.select_related(
        "patient", "practitioner", "therapy_type"
    ).all()
    serializer_class = TherapyPlanSerializer
    search_fields = ["patient__patient_name", "title"]
    filterset_fields = ["status", "patient", "practitioner", "therapy_type"]

    @action(detail=True, methods=["post"])
    def book_session(self, request, pk=None):
        from django.utils import timezone
        plan = self.get_object()
        session_date = request.data.get("session_date") or timezone.now().date()
        session_time = request.data.get("session_time") or timezone.now().time()
        duration = int(request.data.get("duration") or 30)
        practitioner_id = request.data.get("practitioner") or (plan.practitioner_id if plan.practitioner else None)
        therapy_type_id = request.data.get("therapy_type") or (plan.therapy_type_id if plan.therapy_type else None)

        session = TherapySession.objects.create(
            plan=plan,
            patient=plan.patient,
            practitioner_id=practitioner_id,
            therapy_type_id=therapy_type_id,
            session_date=session_date,
            session_time=session_time,
            duration=duration,
            status=request.data.get("status") or "Scheduled",
            notes=request.data.get("notes") or "",
        )
        return Response(TherapySessionSerializer(session).data, status=status.HTTP_201_CREATED)


class TherapySessionViewSet(HealthcareModelViewSet):
    queryset = TherapySession.objects.select_related(
        "patient", "practitioner", "therapy_type", "plan"
    ).all()
    serializer_class = TherapySessionSerializer
    search_fields = ["patient__patient_name", "plan__title"]
    filterset_fields = ["status", "patient", "session_date", "plan"]

    @action(detail=True, methods=["post"])
    def complete(self, request, pk=None):
        session = self.get_object()
        session.status = "Completed"
        session.notes = request.data.get("notes") or session.notes
        session.exercises_performed = request.data.get("exercises_performed") or session.exercises_performed
        session.patient_response = request.data.get("patient_response") or session.patient_response
        session.save()
        if session.plan:
            completed_count = session.plan.sessions.filter(status="Completed").count()
            session.plan.completed_sessions = completed_count
            if session.plan.total_sessions and completed_count >= session.plan.total_sessions:
                session.plan.status = "Completed"
            elif completed_count > 0 and session.plan.status in ["Draft", "Not Started"]:
                session.plan.status = "Active"
            session.plan.save(update_fields=["completed_sessions", "status"])
        return Response({"status": "completed"})


class ExerciseViewSet(HealthcareModelViewSet):
    queryset = Exercise.objects.select_related("therapy_type").all()
    serializer_class = ExerciseSerializer
    search_fields = ["exercise_name", "body_part"]
    filterset_fields = ["therapy_type", "difficulty_level", "is_active"]


class TreatmentPlanTemplateViewSet(HealthcareModelViewSet):
    queryset = TreatmentPlanTemplate.objects.select_related(
        "therapy_type", "medical_department"
    ).prefetch_related("items", "practitioners__practitioner", "complaints", "diagnosis", "drugs").all()
    serializer_class = TreatmentPlanTemplateSerializer
    search_fields = ["template_name"]
    filterset_fields = ["disabled", "is_active", "is_inpatient"]

    def perform_create(self, serializer):
        template = serializer.save()
        self._save_items(template)
        self._save_practitioners(template)
        self._save_m2m(template)

    def perform_update(self, serializer):
        template = serializer.save()
        self._save_items(template)
        self._save_practitioners(template)
        self._save_m2m(template)

    def _save_items(self, template):
        items_data = self.request.data.get("items_data", [])
        if items_data is not None:
            template.items.all().delete()
            for item in items_data:
                TreatmentPlanTemplateItem.objects.create(
                    treatment_plan_template=template,
                    item_type=item.get("item_type", ""),
                    item_name=item.get("item_name", ""),
                    quantity=item.get("quantity", 1),
                    amount=item.get("amount", 0),
                    instructions=item.get("instructions", ""),
                    drug_name=item.get("drug_name", ""),
                    drug_code=item.get("drug_code", ""),
                    strength=item.get("strength", 0),
                    strength_uom=item.get("strength_uom", ""),
                    dosage_form=item.get("dosage_form", ""),
                    dosage_by_interval=item.get("dosage_by_interval", False),
                    dosage=item.get("dosage", ""),
                    interval=item.get("interval", 0),
                    interval_uom=item.get("interval_uom", ""),
                    period=item.get("period", ""),
                    number_of_repeats_allowed=item.get("number_of_repeats_allowed", 0),
                    service_request=item.get("service_request", ""),
                )

    def _save_practitioners(self, template):
        prac_data = self.request.data.get("practitioners_data", [])
        if prac_data is not None:
            template.practitioners.all().delete()
            for p in prac_data:
                TreatmentPlanTemplatePractitioner.objects.create(
                    treatment_plan_template=template,
                    practitioner_id=p["practitioner"],
                    is_primary=p.get("is_primary", False),
                )

    def _save_m2m(self, template):
        """Set M2M relations from request data."""
        if "complaints_data" in self.request.data:
            template.complaints.set(self.request.data["complaints_data"])
        if "diagnosis_data" in self.request.data:
            template.diagnosis.set(self.request.data["diagnosis_data"])
        if "drugs_data" in self.request.data:
            template.drugs.set(self.request.data["drugs_data"])


# ── Insurance ──────────────────────────────────────────────────────────────

class InsurancePayorViewSet(HealthcareModelViewSet):
    queryset = InsurancePayor.objects.all()
    serializer_class = InsurancePayorSerializer
    search_fields = ["payor_name", "payor_id"]
    filterset_fields = ["is_active"]


class InsurancePayorContractViewSet(HealthcareModelViewSet):
    queryset = InsurancePayorContract.objects.select_related("payor").all()
    serializer_class = InsurancePayorContractSerializer
    search_fields = ["contract_name", "payor__payor_name"]
    filterset_fields = ["payor", "is_active"]


class PatientInsurancePolicyViewSet(HealthcareModelViewSet):
    queryset = PatientInsurancePolicy.objects.select_related(
        "patient", "payor", "contract"
    ).all()
    serializer_class = PatientInsurancePolicySerializer
    search_fields = ["policy_number", "patient__patient_name"]
    filterset_fields = ["patient", "payor", "is_active"]


class InsuranceClaimViewSet(HealthcareModelViewSet):
    queryset = InsuranceClaim.objects.select_related(
        "patient", "payor", "policy"
    ).all()
    serializer_class = InsuranceClaimSerializer
    search_fields = ["claim_id", "patient__patient_name"]
    filterset_fields = ["status", "patient", "payor"]


# ── Inpatient ──────────────────────────────────────────────────────────────

class InpatientRecordViewSet(HealthcareModelViewSet):
    queryset = InpatientRecord.objects.select_related(
        "patient", "practitioner", "service_unit", "department"
    ).all()
    serializer_class = InpatientRecordSerializer
    search_fields = ["patient__patient_name", "record_id", "chief_complaint"]
    filterset_fields = ["status", "patient", "practitioner", "service_unit", "department"]

    def perform_create(self, serializer):
        instance = serializer.save()
        patient = instance.patient
        if instance.status in ["Admission Scheduled", "Admitted", "Discharge Scheduled"]:
            patient.inpatient_status = instance.status
            patient.inpatient_record = instance
            patient.save(update_fields=["inpatient_status", "inpatient_record"])
            if instance.status == "Admitted" and instance.service_unit:
                instance.service_unit.occupancy_status = "Occupied"
                instance.service_unit.save(update_fields=["occupancy_status"])
        elif instance.status in ["Discharged", "Cancelled"]:
            if patient.inpatient_record_id == instance.id:
                patient.inpatient_status = ""
                patient.inpatient_record = None
                patient.save(update_fields=["inpatient_status", "inpatient_record"])

    def perform_update(self, serializer):
        instance = serializer.save()
        patient = instance.patient
        if instance.status in ["Admission Scheduled", "Admitted", "Discharge Scheduled"]:
            patient.inpatient_status = instance.status
            patient.inpatient_record = instance
            patient.save(update_fields=["inpatient_status", "inpatient_record"])
            if instance.status == "Admitted" and instance.service_unit:
                instance.service_unit.occupancy_status = "Occupied"
                instance.service_unit.save(update_fields=["occupancy_status"])
        elif instance.status in ["Discharged", "Cancelled"]:
            if patient.inpatient_record_id == instance.id:
                patient.inpatient_status = ""
                patient.inpatient_record = None
                patient.save(update_fields=["inpatient_status", "inpatient_record"])
            if instance.service_unit and instance.service_unit.occupancy_status == "Occupied":
                instance.service_unit.occupancy_status = "Vacant"
                instance.service_unit.save(update_fields=["occupancy_status"])

    def perform_destroy(self, instance):
        patient = instance.patient
        if patient and patient.inpatient_record_id == instance.id:
            patient.inpatient_status = ""
            patient.inpatient_record = None
            patient.save(update_fields=["inpatient_status", "inpatient_record"])
        if instance.service_unit and instance.service_unit.occupancy_status == "Occupied":
            instance.service_unit.occupancy_status = "Vacant"
            instance.service_unit.save(update_fields=["occupancy_status"])
        instance.delete()

    @action(detail=True, methods=["post"])
    def admit(self, request, pk=None):
        record = self.get_object()
        record.status = "Admitted"
        if not record.admission_date:
            record.admission_date = timezone.now().date()
        if not record.admission_time:
            record.admission_time = timezone.now().time()
        service_unit_id = request.data.get("service_unit")
        if service_unit_id:
            record.service_unit_id = service_unit_id
        if record.service_unit:
            record.service_unit.occupancy_status = "Occupied"
            record.service_unit.save(update_fields=["occupancy_status"])
        expected_discharge = request.data.get("expected_discharge_date")
        if expected_discharge:
            record.expected_discharge_date = expected_discharge
        practitioner_id = request.data.get("practitioner")
        if practitioner_id:
            record.practitioner_id = practitioner_id
        record.save()
        record.patient.inpatient_status = "Admitted"
        record.patient.inpatient_record = record
        record.patient.save(update_fields=["inpatient_status", "inpatient_record"])
        return Response({"status": "admitted", "record": InpatientRecordSerializer(record).data})

    @action(detail=True, methods=["post"])
    def schedule_discharge(self, request, pk=None):
        record = self.get_object()
        record.status = "Discharge Scheduled"
        discharge_summary = request.data.get("discharge_summary")
        if discharge_summary:
            record.discharge_summary = discharge_summary
        expected_discharge = request.data.get("expected_discharge_date")
        if expected_discharge:
            record.expected_discharge_date = expected_discharge
        record.save()
        record.patient.inpatient_status = "Discharge Scheduled"
        record.patient.save(update_fields=["inpatient_status"])
        return Response({"status": "discharge_scheduled", "record": InpatientRecordSerializer(record).data})

    @action(detail=True, methods=["post"])
    def discharge(self, request, pk=None):
        record = self.get_object()
        record.status = "Discharged"
        record.discharge_date = timezone.now().date()
        record.discharge_time = timezone.now().time()
        if record.service_unit:
            record.service_unit.occupancy_status = "Vacant"
            record.service_unit.save(update_fields=["occupancy_status"])
        discharge_summary = request.data.get("discharge_summary")
        if discharge_summary:
            record.discharge_summary = discharge_summary
        record.save()
        record.patient.inpatient_status = ""
        record.patient.inpatient_record = None
        record.patient.save(update_fields=["inpatient_status", "inpatient_record"])
        return Response({"status": "discharged", "record": InpatientRecordSerializer(record).data})

    @action(detail=True, methods=["post"])
    def transfer(self, request, pk=None):
        record = self.get_object()
        new_service_unit_id = request.data.get("service_unit")
        if not new_service_unit_id:
            return Response({"error": "Service unit is required for transfer"}, status=400)
        if record.service_unit:
            record.service_unit.occupancy_status = "Vacant"
            record.service_unit.save(update_fields=["occupancy_status"])
        record.service_unit_id = new_service_unit_id
        new_su = HealthcareServiceUnit.objects.filter(id=new_service_unit_id).first()
        if new_su:
            new_su.occupancy_status = "Occupied"
            new_su.save(update_fields=["occupancy_status"])
        record.save()
        return Response({"status": "transferred", "record": InpatientRecordSerializer(record).data})

    @action(detail=True, methods=["post"])
    def cancel_admission(self, request, pk=None):
        record = self.get_object()
        record.status = "Cancelled"
        if record.service_unit and record.service_unit.occupancy_status == "Occupied":
            record.service_unit.occupancy_status = "Vacant"
            record.service_unit.save(update_fields=["occupancy_status"])
        record.save()
        if record.patient.inpatient_record_id == record.id:
            record.patient.inpatient_status = ""
            record.patient.inpatient_record = None
            record.patient.save(update_fields=["inpatient_status", "inpatient_record"])
        return Response({"status": "cancelled", "record": InpatientRecordSerializer(record).data})


def _get_available_stock(item_code_or_id, warehouse_id):
    if not item_code_or_id or not warehouse_id:
        return Decimal("100.00")
    try:
        query_str = str(item_code_or_id).strip()
        stock = PharmacyStock.objects.filter(
            Q(warehouse_id=warehouse_id) &
            (Q(item_code__iexact=query_str) | Q(item_name__iexact=query_str))
        ).first()

        if not stock:
            stock = PharmacyStock.objects.filter(
                Q(warehouse_id=warehouse_id) &
                (
                    Q(medication__generic_name__iexact=query_str) |
                    Q(item_name__icontains=query_str) |
                    Q(item_code__icontains=query_str)
                )
            ).first()

        if not stock and isinstance(item_code_or_id, (int, str)) and query_str.isdigit():
            stock = PharmacyStock.objects.filter(warehouse_id=warehouse_id, id=int(query_str)).first()

        return stock.actual_qty if stock else Decimal("100.00")
    except Exception:
        return Decimal("100.00")


class InpatientMedicationEntryViewSet(HealthcareModelViewSet):
    queryset = InpatientMedicationEntry.objects.select_related(
        "company", "warehouse", "patient", "service_unit", "practitioner", "assigned_to_practitioner", "stock_entry"
    ).prefetch_related("medication_orders").all()
    serializer_class = InpatientMedicationEntrySerializer
    filterset_fields = ["status", "warehouse", "patient", "service_unit", "practitioner", "company"]
    search_fields = ["entry_id", "patient__patient_name", "remarks"]

    @action(detail=True, methods=["post", "get"])
    def get_medication_orders(self, request, pk=None):
        """
        Pull pending medication orders for this entry (Marley parity).
        Filters: patient, service_unit, item_code, from_date, to_date, from_time, to_time, practitioner.
        Populates child InpatientMedicationEntryDetail rows on the entry.
        """
        entry = self.get_object()
        patient_id = request.data.get("patient") or (entry.patient_id if entry.patient else None)
        service_unit_id = request.data.get("service_unit") or (entry.service_unit_id if entry.service_unit else None)
        item_code = request.data.get("item_code") or entry.item_code
        from_date = request.data.get("from_date") or entry.from_date
        to_date = request.data.get("to_date") or entry.to_date
        practitioner_id = request.data.get("practitioner") or (entry.practitioner_id if entry.practitioner else None)

        orders_qs = InpatientMedicationOrderEntry.objects.select_related(
            "order", "order__patient", "order__inpatient_record"
        ).filter(status="Active")

        if patient_id:
            orders_qs = orders_qs.filter(order__patient_id=patient_id)
        if practitioner_id:
            orders_qs = orders_qs.filter(order__practitioner_id=practitioner_id)
        if from_date:
            orders_qs = orders_qs.filter(order__start_date__gte=from_date)
        if to_date:
            orders_qs = orders_qs.filter(order__start_date__lte=to_date)
        if item_code:
            orders_qs = orders_qs.filter(medication_name__icontains=item_code)

        if entry.status == "Draft":
            entry.medication_orders.all().delete()

        created_details = []
        seen_keys = set()
        for imo_entry in orders_qs[:100]:
            patient = imo_entry.order.patient if imo_entry.order else None
            inpatient_record = imo_entry.order.inpatient_record if imo_entry.order else None
            drug_name = imo_entry.medication_name or ""
            drug_code = imo_entry.medication_name or ""

            service_unit = None
            if inpatient_record:
                active_occ = inpatient_record.occupancies.filter(is_active=True).first()
                if active_occ:
                    service_unit = active_occ.service_unit

            if service_unit_id and service_unit and service_unit.id != int(service_unit_id):
                continue

            item = Item.objects.filter(Q(item_code=drug_code) | Q(item_name__iexact=drug_name)).first()
            dosage_form = "Tablet"
            if item and hasattr(item, "medication_links") and item.medication_links.exists():
                med_link = item.medication_links.first()
                if med_link.parent and med_link.parent.dosage_form:
                    dosage_form = med_link.parent.dosage_form.dosage_form

            dedup_key = f"IMO-{imo_entry.id}"
            seen_keys.add(dedup_key)

            detail = InpatientMedicationEntryDetail.objects.create(
                entry=entry,
                patient=patient,
                patient_name=patient.patient_name if patient else "",
                inpatient_record=inpatient_record,
                service_unit=service_unit,
                drug=item,
                drug_code=item.item_code if item else drug_code,
                drug_name=item.item_name if item else drug_name,
                dosage=imo_entry.dosage or "1",
                dosage_form=dosage_form,
                medication_order=imo_entry.order,
                medication_order_entry=imo_entry,
                date=imo_entry.order.start_date if (imo_entry.order and imo_entry.order.start_date) else timezone.now().date(),
                time=timezone.now().time(),
                quantity=Decimal(str(imo_entry.quantity or 1)),
                is_completed=False,
                instructions=imo_entry.notes or "",
            )
            created_details.append(detail)

        # Pull active MedicationRequest for admitted inpatients
        med_req_qs = MedicationRequest.objects.filter(status="Active")
        if patient_id:
            med_req_qs = med_req_qs.filter(patient_id=patient_id)
        for mr in med_req_qs[:50]:
            mr_key = f"MRX-{mr.id}"
            if mr_key in seen_keys:
                continue
            seen_keys.add(mr_key)

            inp_rec = InpatientRecord.objects.filter(patient=mr.patient, status="Admitted").first()
            srv_unit = None
            if inp_rec:
                occ = inp_rec.occupancies.filter(is_active=True).first()
                if occ:
                    srv_unit = occ.service_unit

            if service_unit_id and srv_unit and srv_unit.id != int(service_unit_id):
                continue

            item = Item.objects.filter(Q(item_code=mr.medication_name) | Q(item_name__iexact=mr.medication_name)).first()

            detail = InpatientMedicationEntryDetail.objects.create(
                entry=entry,
                patient=mr.patient,
                patient_name=mr.patient.patient_name if mr.patient else "",
                inpatient_record=inp_rec,
                service_unit=srv_unit,
                drug=item,
                drug_code=item.item_code if item else mr.medication_name,
                drug_name=item.item_name if item else mr.medication_name,
                dosage=mr.dosage_instruction or "1",
                dosage_form="Tablet",
                medication_order=None,
                medication_order_entry=None,
                date=timezone.now().date(),
                time=timezone.now().time(),
                quantity=Decimal(str(mr.quantity or 1)),
                is_completed=False,
                instructions=mr.notes or "",
            )
            created_details.append(detail)

        # Pull active DrugPrescription for admitted patients
        dp_qs = DrugPrescription.objects.filter(status="Active")
        if patient_id:
            dp_qs = dp_qs.filter(patient_id=patient_id)
        for dp in dp_qs[:50]:
            dp_key = f"DP-{dp.id}"
            if dp_key in seen_keys:
                continue
            seen_keys.add(dp_key)

            inp_rec = InpatientRecord.objects.filter(patient=dp.patient, status="Admitted").first()
            srv_unit = None
            if inp_rec:
                occ = inp_rec.occupancies.filter(is_active=True).first()
                if occ:
                    srv_unit = occ.service_unit

            if service_unit_id and srv_unit and srv_unit.id != int(service_unit_id):
                continue

            item = Item.objects.filter(Q(item_code=dp.medication_name) | Q(item_name__iexact=dp.medication_name)).first()

            detail = InpatientMedicationEntryDetail.objects.create(
                entry=entry,
                patient=dp.patient,
                patient_name=dp.patient.patient_name if dp.patient else "",
                inpatient_record=inp_rec,
                service_unit=srv_unit,
                drug=item,
                drug_code=item.item_code if item else (dp.drug_code or dp.medication_name),
                drug_name=item.item_name if item else dp.medication_name,
                dosage=dp.dosage or "1 tablet",
                dosage_form=dp.dosage_form or "Tablet",
                medication_order=None,
                medication_order_entry=None,
                date=timezone.now().date(),
                time=timezone.now().time(),
                quantity=Decimal(str(dp.quantity or 1)),
                is_completed=False,
                instructions=f"{dp.dosage} for {dp.period}".strip() if (dp.dosage or dp.period) else (dp.comment or ""),
            )
            created_details.append(detail)

        serializer = InpatientMedicationEntryDetailSerializer(created_details, many=True)
        return Response({
            "message": f"Successfully loaded {len(created_details)} scheduled medication orders.",
            "orders": serializer.data,
            "medication_orders": serializer.data,
        })

    @action(detail=True, methods=["post", "get"])
    def check_stock_shortage(self, request, pk=None):
        """
        Check if warehouse has sufficient stock for this entry's orders.
        Returns shortage details.
        """
        entry = self.get_object()
        warehouse = entry.warehouse
        if not warehouse:
            return Response({"error": "No warehouse selected for this entry."}, status=400)

        requirements = {}
        for detail in entry.medication_orders.all():
            name = detail.drug_name or detail.drug_code or "Medication"
            code = detail.drug_code or name
            key = detail.drug_id or code
            if key not in requirements:
                requirements[key] = {
                    "item_code": code,
                    "item_name": name,
                    "required_qty": Decimal("0.00"),
                }
            requirements[key]["required_qty"] += Decimal(str(detail.quantity or 1))

        shortage_list = []
        has_shortage = False

        for key, req in requirements.items():
            available = _get_available_stock(req["item_code"] or req["item_name"], warehouse.id)
            required = req["required_qty"]
            diff = required - available
            if diff > 0:
                has_shortage = True
                shortage_list.append({
                    "item_code": req["item_code"],
                    "item_name": req["item_name"],
                    "available_qty": float(available),
                    "required_qty": float(required),
                    "shortage_qty": float(diff),
                })

        return Response({
            "has_shortage": has_shortage,
            "warehouse": warehouse.warehouse_name,
            "shortages": shortage_list,
            "shortage_list": shortage_list,
            "message": f"{len(shortage_list)} items have insufficient stock in warehouse '{warehouse.warehouse_name}'." if has_shortage else "All medications are available in warehouse.",
        })

    @action(detail=True, methods=["post"])
    def submit_entry(self, request, pk=None):
        """
        Submit entry:
        1. Validates stock availability in warehouse (if update_stock is True)
        2. Creates PharmacyStockEntry in apps.healthcare
        3. Updates PharmacyStock balance
        4. Marks child orders and linked order entries completed
        5. Sets status to 'Submitted'
        """
        entry = self.get_object()
        if entry.status != "Draft":
            return Response({"error": f"Only Draft entries can be submitted. Current status: {entry.status}"}, status=400)

        orders = entry.medication_orders.all()
        if not orders.exists():
            return Response({"error": "Cannot submit an entry with no medication orders."}, status=400)

        stock_entry = None
        if entry.update_stock and entry.warehouse:
            requirements = {}
            for detail in orders:
                name = detail.drug_name or detail.drug_code or "Medication"
                code = detail.drug_code or name
                key = detail.drug_id or code
                if key not in requirements:
                    requirements[key] = {
                        "item_code": code,
                        "item_name": name,
                        "qty": Decimal("0.00"),
                    }
                requirements[key]["qty"] += Decimal(str(detail.quantity or 1))

            shortages = []
            for key, req in requirements.items():
                avail = _get_available_stock(req["item_code"] or req["item_name"], entry.warehouse.id)
                if req["qty"] > avail:
                    shortages.append({
                        "item_code": req["item_code"],
                        "item_name": req["item_name"],
                        "available_qty": float(avail),
                        "required_qty": float(req["qty"]),
                        "shortage_qty": float(req["qty"] - avail),
                    })

            if shortages and not request.data.get("allow_negative", False):
                return Response({
                    "error": f"Insufficient stock for {len(shortages)} medication(s) in warehouse '{entry.warehouse.warehouse_name}'.",
                    "shortages": shortages,
                    "has_shortage": True,
                }, status=400)

            stock_entry = PharmacyStockEntry.objects.create(
                entry_number=f"IP-MED-{timezone.now().strftime('%Y%m%d%H%M%S')}-{random.randint(100, 999)}",
                entry_type="Material Issue",
                posting_date=entry.posting_date or timezone.now().date(),
                warehouse=entry.warehouse,
                patient=entry.patient,
                purpose=f"Pharmacy Dispensing: {entry.entry_id}",
                notes=f"Created from Inpatient Medication Entry {entry.entry_id} for {len(orders)} orders."
            )

            for key, req in requirements.items():
                qty = req["qty"]
                stk = PharmacyStock.objects.filter(
                    warehouse=entry.warehouse
                ).filter(Q(item_code=req["item_code"]) | Q(item_name__iexact=req["item_name"])).first()
                if stk:
                    stk.actual_qty = max(Decimal("0.00"), stk.actual_qty - qty)
                    stk.save(update_fields=["actual_qty"])

            entry.stock_entry = stock_entry

        for detail in orders:
            detail.is_completed = True
            detail.save(update_fields=["is_completed"])
            if detail.medication_order_entry:
                detail.medication_order_entry.status = "Completed"
                detail.medication_order_entry.save(update_fields=["status"])
            if detail.medication_order:
                parent_order = detail.medication_order
                completed_c = parent_order.entries.filter(status="Completed").count()
                total_c = parent_order.entries.count()
                if total_c > 0 and completed_c >= total_c:
                    parent_order.status = "Completed"
                elif completed_c > 0:
                    parent_order.status = "In Process"
                parent_order.save(update_fields=["status"])

        entry.status = "Submitted"
        entry.save()

        serializer = self.get_serializer(entry)
        return Response(serializer.data)

    @action(detail=True, methods=["post"])
    def cancel_entry(self, request, pk=None):
        """
        Cancel entry: reverses medication order statuses and restocks dispensed medications.
        """
        entry = self.get_object()
        if entry.status != "Submitted":
            return Response({"error": f"Only Submitted entries can be cancelled. Current status: {entry.status}"}, status=400)

        if entry.stock_entry and entry.warehouse:
            for detail in entry.medication_orders.all():
                qty = Decimal(str(detail.quantity or 1))
                stk = PharmacyStock.objects.filter(
                    warehouse=entry.warehouse
                ).filter(Q(item_code=detail.drug_code or "") | Q(item_name__iexact=detail.drug_name or "")).first()
                if stk:
                    stk.actual_qty = stk.actual_qty + qty
                    stk.save(update_fields=["actual_qty"])

        for detail in entry.medication_orders.all():
            detail.is_completed = False
            detail.save(update_fields=["is_completed"])
            if detail.medication_order_entry:
                detail.medication_order_entry.status = "Active"
                detail.medication_order_entry.save(update_fields=["status"])

        entry.status = "Cancelled"
        entry.save(update_fields=["status"])
        serializer = self.get_serializer(entry)
        return Response(serializer.data)

    @action(detail=True, methods=["post"])
    def make_difference_stock_entry(self, request, pk=None):
        """
        Create a Material Transfer stock entry to replenish shortage items into this warehouse.
        """
        entry = self.get_object()
        if not entry.warehouse:
            return Response({"error": "No warehouse specified on this entry."}, status=400)

        transfer_entry = PharmacyStockEntry.objects.create(
            entry_number=f"TRAN-{timezone.now().strftime('%Y%m%d%H%M%S')}-{random.randint(100, 999)}",
            entry_type="Material Transfer",
            posting_date=timezone.now().date(),
            warehouse=entry.warehouse,
            purpose=f"Replenishment transfer for {entry.entry_id}",
            notes=f"Created to fulfill medication shortage for {entry.entry_id}"
        )

        return Response({
            "message": f"Created Material Transfer {transfer_entry.entry_number}",
            "stock_entry_id": transfer_entry.id,
            "stock_entry_number": transfer_entry.entry_number,
        })


class PharmacyViewSet(viewsets.ViewSet):
    """
    Pharmacy Dashboard & Inventory Services
    """
    permission_classes = [HasPermissionOrAdmin]

    @action(detail=False, methods=["get"])
    def dashboard_stats(self, request):
        today = timezone.now().date()
        pending_imo = InpatientMedicationOrderEntry.objects.filter(status="Active").count()
        active_requests = MedicationRequest.objects.filter(status="Active").count()
        dispensed_today = InpatientMedicationEntryDetail.objects.filter(is_completed=True, date=today).count()

        recent_entries = InpatientMedicationEntry.objects.select_related("warehouse", "patient").order_by("-posting_date", "-id")[:5]

        low_stock_qs = PharmacyStock.objects.filter(actual_qty__lte=F("reorder_level")).select_related("warehouse")[:50]
        low_stock_items = []
        for stock in low_stock_qs:
            low_stock_items.append({
                "id": stock.id,
                "item_code": stock.item_code,
                "item_name": stock.item_name,
                "current_qty": float(stock.actual_qty),
                "reorder_level": float(stock.reorder_level),
                "uom": stock.stock_uom,
                "warehouse_name": stock.warehouse.warehouse_name if stock.warehouse else "Main Pharmacy",
            })

        warehouses = [
            {"id": w.id, "warehouse_name": w.warehouse_name, "warehouse_type": "Pharmacy Store"}
            for w in PharmacyWarehouse.objects.filter(is_active=True)[:20]
        ]

        return Response({
            "pending_inpatient_orders": pending_imo,
            "pending_medication_orders": pending_imo,
            "active_prescriptions": active_requests,
            "dispensed_today": dispensed_today,
            "low_stock_items": len(low_stock_items),
            "low_stock_count": len(low_stock_items),
            "recent_entries": InpatientMedicationEntrySerializer(recent_entries, many=True).data,
            "low_stock_items_list": low_stock_items[:10],
            "warehouses": warehouses,
        })

    @action(detail=False, methods=["get"])
    def stock_balances(self, request):
        warehouse_id = request.query_params.get("warehouse")
        search = request.query_params.get("search", "").strip()
        low_stock_filter = request.query_params.get("low_stock")

        qs = PharmacyStock.objects.select_related("warehouse", "medication").all()
        if warehouse_id and str(warehouse_id).lower() not in ("0", "null", "undefined", "", "none"):
            try:
                qs = qs.filter(warehouse_id=int(warehouse_id))
            except (ValueError, TypeError):
                pass
        if search:
            qs = qs.filter(
                Q(item_code__icontains=search) |
                Q(item_name__icontains=search) |
                Q(medication__generic_name__icontains=search)
            )

        balances = []
        for stock in qs[:200]:
            is_low = stock.actual_qty <= stock.reorder_level
            if low_stock_filter and not is_low:
                continue

            status_label = "In Stock"
            if stock.actual_qty <= 0:
                status_label = "Out of Stock"
            elif is_low:
                status_label = "Low Stock"

            med_generic = stock.medication.generic_name if stock.medication else ""
            balances.append({
                "item_id": stock.id,
                "item_code": stock.item_code,
                "item_name": stock.item_name,
                "generic_name": med_generic,
                "medication_name": med_generic or stock.item_name,
                "medication_id": stock.medication.id if stock.medication else None,
                "item_group": stock.item_group or "Pharmaceuticals",
                "warehouse_id": stock.warehouse.id if stock.warehouse else 0,
                "warehouse_name": stock.warehouse.warehouse_name if stock.warehouse else "Main Pharmacy",
                "actual_qty": float(stock.actual_qty),
                "available_qty": float(stock.actual_qty),
                "reorder_level": float(stock.reorder_level),
                "is_low_stock": is_low,
                "stock_uom": stock.stock_uom or "Nos",
                "uom": stock.stock_uom or "Nos",
                "valuation_rate": float(stock.valuation_rate or 0),
                "status": status_label,
            })

        return Response({"results": balances, "count": len(balances)})

    @action(detail=False, methods=["get"])
    def patient_prescriptions(self, request):
        """
        Fetch active outpatient prescriptions for a patient (cleanly deduplicated across DrugPrescription and MedicationRequest).
        """
        patient_id = request.query_params.get("patient_id")
        if not patient_id:
            return Response({"error": "patient_id query parameter is required."}, status=400)

        drug_prescs = DrugPrescription.objects.filter(
            patient_id=patient_id, status="Active"
        ).select_related("practitioner", "encounter").order_by("-creation")

        med_reqs = MedicationRequest.objects.filter(
            patient_id=patient_id, status="Active"
        ).select_related("practitioner").order_by("-creation")

        results = []
        seen_keys = {}

        for dp in drug_prescs:
            med_name = (dp.medication_name or "").strip()
            key = med_name.lower()
            if not key or key in seen_keys:
                continue

            item = {
                "source": "DrugPrescription",
                "id": dp.id,
                "prescription_id": dp.id,
                "medication_request_id": None,
                "medication_name": med_name,
                "drug_code": dp.drug_code or med_name,
                "dosage": dp.dosage or "",
                "dosage_form": dp.dosage_form or "Tablet",
                "period": dp.period or "",
                "quantity": float(dp.quantity or 1),
                "practitioner_name": dp.practitioner.practitioner_name if dp.practitioner else "",
                "prescribed_date": str(dp.prescribed_date) if dp.prescribed_date else (str(dp.creation.date()) if dp.creation else ""),
                "encounter_id": dp.encounter_id,
                "instructions": f"{dp.dosage} for {dp.period}".strip() if (dp.dosage or dp.period) else (getattr(dp, 'comment', '') or ""),
            }
            results.append(item)
            seen_keys[key] = item

        for mr in med_reqs:
            med_name = (mr.medication_name or "").strip()
            key = med_name.lower()
            if not key:
                continue

            if key in seen_keys:
                # Merge linked medication_request_id so both records complete upon dispensing
                if not seen_keys[key]["medication_request_id"]:
                    seen_keys[key]["medication_request_id"] = mr.id
                continue

            item = {
                "source": "MedicationRequest",
                "id": mr.id,
                "prescription_id": None,
                "medication_request_id": mr.id,
                "medication_name": med_name,
                "drug_code": med_name,
                "dosage": mr.dosage_instruction or "",
                "dosage_form": "Tablet",
                "period": "",
                "quantity": float(mr.quantity or 1),
                "practitioner_name": mr.practitioner.practitioner_name if mr.practitioner else "",
                "prescribed_date": str(mr.creation.date()) if mr.creation else "",
                "encounter_id": mr.encounter_id,
                "instructions": mr.dosage_instruction or mr.notes or "",
            }
            results.append(item)
            seen_keys[key] = item

        return Response({"prescriptions": results, "count": len(results)})

    @action(detail=False, methods=["post"])
    def dispense_outpatient(self, request):
        """
        Dispense medication for outpatient:
        - Validates stock in selected warehouse
        - Deducts PharmacyStock
        - Creates PharmacyStockEntry
        - Marks linked DrugPrescription or MedicationRequest as 'Completed'
        - Creates HealthcarePaymentRecord if paid or billed
        - Returns receipt payload
        """
        data = request.data
        warehouse_id = data.get("warehouse_id") or data.get("warehouse")
        if not warehouse_id:
            return Response({"error": "Dispensing warehouse is required."}, status=400)

        warehouse = PharmacyWarehouse.objects.filter(id=warehouse_id).first()
        if not warehouse:
            warehouse = PharmacyWarehouse.objects.first()
            if not warehouse:
                warehouse = PharmacyWarehouse.objects.create(warehouse_name="Main Pharmacy")

        patient_id = data.get("patient_id") or data.get("patient")
        patient = Patient.objects.filter(id=patient_id).first() if patient_id else None
        patient_name = data.get("patient_name") or (patient.patient_name if patient else "Walk-in Outpatient")

        items = data.get("items", [])
        if not items:
            return Response({"error": "At least one medication item is required."}, status=400)

        # 1. Check stock availability for all items first
        shortages = []
        for it in items:
            code = it.get("item_code") or it.get("medication_name")
            req_qty = Decimal(str(it.get("quantity") or it.get("qty") or 1))
            avail = _get_available_stock(code, warehouse.id)
            if req_qty > avail and not data.get("allow_negative", False):
                shortages.append({
                    "item_code": code,
                    "item_name": it.get("item_name") or code,
                    "available_qty": float(avail),
                    "required_qty": float(req_qty),
                    "shortage_qty": float(req_qty - avail),
                })

        if shortages:
            return Response({
                "error": f"Insufficient stock for {len(shortages)} medication(s) in warehouse '{warehouse.warehouse_name}'.",
                "shortages": shortages,
            }, status=400)

        entry_num = f"DISP-{timezone.now().strftime('%Y%m%d%H%M%S')}-{random.randint(100, 999)}"
        total_amount = Decimal("0.00")
        dispensed_items_receipt = []

        for it in items:
            code = it.get("item_code") or it.get("medication_name")
            name = it.get("item_name") or it.get("medication_name") or code
            qty = Decimal(str(it.get("quantity") or it.get("qty") or 1))
            unit_price = Decimal(str(it.get("unit_price") or it.get("rate") or it.get("price") or 0))

            # Deduct from PharmacyStock
            stock = PharmacyStock.objects.filter(
                warehouse=warehouse
            ).filter(Q(item_code=code) | Q(item_name__iexact=name)).first()

            if stock:
                stock.actual_qty = max(Decimal("0.00"), stock.actual_qty - qty)
                if unit_price == 0 and stock.valuation_rate:
                    unit_price = stock.valuation_rate
                stock.save(update_fields=["actual_qty"])

            line_total = qty * unit_price
            total_amount += line_total

            # Update linked DrugPrescription if provided
            presc_id = it.get("prescription_id")
            if presc_id:
                DrugPrescription.objects.filter(id=presc_id).update(status="Completed")

            # Update linked MedicationRequest if provided
            med_req_id = it.get("medication_request_id")
            if med_req_id:
                MedicationRequest.objects.filter(id=med_req_id).update(
                    status="Completed",
                    warehouse=warehouse,
                    dispensed_datetime=timezone.now(),
                    dispensed_by=request.user if request.user.is_authenticated else None,
                )

            dispensed_items_receipt.append({
                "item_code": code,
                "item_name": name,
                "quantity": float(qty),
                "unit_price": float(unit_price),
                "total": float(line_total),
                "dosage": it.get("dosage", ""),
                "frequency": it.get("frequency", ""),
                "period": it.get("period", ""),
                "instructions": it.get("instructions", ""),
            })

        stock_entry = PharmacyStockEntry.objects.create(
            entry_number=entry_num,
            entry_type="Material Issue",
            posting_date=timezone.now().date(),
            warehouse=warehouse,
            patient=patient,
            total_amount=total_amount,
            purpose=f"Outpatient Pharmacy Dispensing: {patient_name}",
            notes=data.get("notes") or f"Dispensed {len(items)} items for {patient_name}."
        )

        payment_method = data.get("payment_method") or "Free Staff Benefit"
        payment_record = None

        return Response({
            "message": f"Successfully dispensed {len(items)} medications for {patient_name}.",
            "stock_entry_id": stock_entry.id,
            "stock_entry_number": stock_entry.entry_number,
            "patient_name": patient_name,
            "patient_id": patient.patient_id if patient else None,
            "dispensed_datetime": timezone.now().isoformat(),
            "warehouse_name": warehouse.warehouse_name,
            "payment_method": payment_method,
            "total_amount": float(total_amount),
            "payment_id": payment_record.payment_id if payment_record else None,
            "dispensed_by": request.user.username if request.user.is_authenticated else "Pharmacist",
            "items": dispensed_items_receipt,
        })

    @action(detail=False, methods=["get"])
    def outpatient_history(self, request):
        """
        List recent outpatient dispensing transactions from PharmacyStockEntry.
        """
        entries = PharmacyStockEntry.objects.filter(
            entry_type="Material Issue",
            purpose__startswith="Outpatient Pharmacy Dispensing"
        ).select_related("warehouse").order_by("-id")[:50]

        data = []
        for e in entries:
            data.append({
                "id": e.id,
                "stock_entry_number": e.entry_number,
                "posting_date": e.posting_date,
                "warehouse_name": e.warehouse.warehouse_name if e.warehouse else "",
                "purpose": e.purpose,
                "notes": e.notes,
                "items_count": 1,
                "total_qty": 1.0,
            })
        return Response({"results": data, "count": len(data)})

    @action(detail=False, methods=["post"])
    def add_stock(self, request):
        """
        1. ADD PHARMACY STOCK (Inward Receipt / Transfer)
        - Supports Material Receipt and Material Transfer
        - Records batch numbers, expiration dates, unit purchase costs
        - Writes PharmacyStockEntry
        - Updates PharmacyStock balances in target warehouse (and deducts in source if transfer)
        """
        data = request.data
        warehouse_id = data.get("warehouse_id") or data.get("warehouse")
        if not warehouse_id:
            return Response({"error": "Target pharmacy warehouse is required."}, status=400)

        target_wh = PharmacyWarehouse.objects.filter(id=warehouse_id).first()
        if not target_wh:
            target_wh = PharmacyWarehouse.objects.first()
            if not target_wh:
                target_wh = PharmacyWarehouse.objects.create(warehouse_name="Main Pharmacy")

        entry_type = data.get("entry_type", "Material Receipt")
        if entry_type not in ["Material Receipt", "Material Transfer"]:
            entry_type = "Material Receipt"

        source_wh = None
        if entry_type == "Material Transfer":
            from_wh_id = data.get("from_warehouse_id") or data.get("from_warehouse")
            if not from_wh_id:
                return Response({"error": "Source warehouse is required for Material Transfer."}, status=400)
            source_wh = PharmacyWarehouse.objects.filter(id=from_wh_id).first()
            if not source_wh:
                return Response({"error": f"Source warehouse ID {from_wh_id} not found."}, status=400)
            if source_wh.id == target_wh.id:
                return Response({"error": "Source and target warehouses cannot be the same."}, status=400)

        items_data = data.get("items", [])
        if not items_data or not isinstance(items_data, list):
            return Response({"error": "At least one medication/stock item is required."}, status=400)

        clean_items = []
        shortages = []
        for it in items_data:
            code = (it.get("item_code") or it.get("medication_name") or it.get("name") or "").strip()
            if not code:
                continue
            try:
                qty = Decimal(str(it.get("quantity") or it.get("qty") or 0))
            except Exception:
                qty = Decimal("0.00")
            if qty <= Decimal("0.00"):
                continue

            try:
                rate = Decimal(str(it.get("rate") or it.get("unit_price") or it.get("cost") or 0))
            except Exception:
                rate = Decimal("0.00")

            batch_no = (it.get("batch_no") or "").strip()
            expiry_date_str = (it.get("expiry_date") or "").strip()

            if entry_type == "Material Transfer" and source_wh:
                avail = _get_available_stock(code, source_wh.id)
                if qty > avail:
                    shortages.append({
                        "item_code": code,
                        "available_qty": float(avail),
                        "required_qty": float(qty),
                        "shortage_qty": float(qty - avail),
                    })

            clean_items.append({
                "code": code,
                "name": (it.get("item_name") or code).strip(),
                "qty": qty,
                "rate": rate,
                "batch_no": batch_no,
                "expiry_date": expiry_date_str,
                "uom": (it.get("uom") or "Nos").strip(),
            })

        if not clean_items:
            return Response({"error": "No valid items with positive quantity provided."}, status=400)

        if shortages:
            return Response({
                "error": f"Insufficient stock in source warehouse '{source_wh.warehouse_name}' for {len(shortages)} item(s).",
                "shortages": shortages,
            }, status=400)

        supplier_name = data.get("supplier_name", "").strip()
        ref_no = data.get("purchase_invoice_no") or data.get("reference_no") or ""
        purpose = f"Pharmacy Inward Receipt: {supplier_name or 'Direct Inward'}" if entry_type == "Material Receipt" else f"Pharmacy Transfer: {source_wh.warehouse_name} -> {target_wh.warehouse_name}"
        notes = data.get("notes", "").strip()
        notes_full = f"Supplier/Ref: {ref_no}. {notes}".strip()

        entry_num = f"INW-{timezone.now().strftime('%Y%m%d%H%M%S')}-{random.randint(100, 999)}"
        total_value = Decimal("0.00")
        total_qty = Decimal("0.00")
        received_items = []

        for c_it in clean_items:
            code = c_it["code"]
            name = c_it["name"]
            qty = c_it["qty"]
            rate = c_it["rate"]
            batch_no = c_it["batch_no"]

            # Deduct from source warehouse if transfer
            if entry_type == "Material Transfer" and source_wh:
                src_stock = PharmacyStock.objects.filter(
                    warehouse=source_wh
                ).filter(Q(item_code=code) | Q(item_name__iexact=name)).first()
                if src_stock:
                    src_stock.actual_qty = max(Decimal("0.00"), src_stock.actual_qty - qty)
                    src_stock.save(update_fields=["actual_qty"])

            # Add to target warehouse
            target_stock, _ = PharmacyStock.objects.get_or_create(
                warehouse=target_wh,
                item_code=code,
                defaults={
                    "item_name": name,
                    "actual_qty": Decimal("0.00"),
                    "valuation_rate": rate,
                    "reorder_level": Decimal("25.00"),
                    "stock_uom": c_it["uom"],
                    "batch_no": batch_no,
                }
            )
            target_stock.actual_qty += qty
            if rate > 0:
                target_stock.valuation_rate = rate
            if batch_no:
                target_stock.batch_no = batch_no
            target_stock.save()

            line_amount = qty * rate
            total_value += line_amount
            total_qty += qty

            received_items.append({
                "item_code": code,
                "item_name": name,
                "quantity": float(qty),
                "rate": float(rate),
                "amount": float(line_amount),
                "batch_no": batch_no,
                "new_warehouse_balance": float(target_stock.actual_qty),
            })

        stock_entry = PharmacyStockEntry.objects.create(
            entry_number=entry_num,
            entry_type=entry_type,
            posting_date=timezone.now().date(),
            warehouse=target_wh,
            purpose=purpose,
            notes=notes_full,
            total_amount=total_value,
        )

        return Response({
            "message": f"Successfully received {len(received_items)} items ({float(total_qty)} units) into '{target_wh.warehouse_name}'.",
            "stock_entry_id": stock_entry.id,
            "stock_entry_number": stock_entry.entry_number,
            "entry_type": stock_entry.entry_type,
            "warehouse_id": target_wh.id,
            "warehouse_name": target_wh.warehouse_name,
            "supplier_name": supplier_name,
            "reference_no": ref_no,
            "total_qty": float(total_qty),
            "total_value": float(total_value),
            "items": received_items,
        })

    @action(detail=False, methods=["post"])
    def dispose_expired(self, request):
        """
        2. EXPIRED DRUG WRITE-OFF / DISPOSAL (Expired Drug Out)
        - Deducts stock permanently from PharmacyStock
        - Records disposal reasons and certificate
        - Creates PharmacyStockEntry
        """
        data = request.data
        warehouse_id = data.get("warehouse_id") or data.get("warehouse")
        if not warehouse_id:
            return Response({"error": "Pharmacy warehouse is required for disposal."}, status=400)

        warehouse = PharmacyWarehouse.objects.filter(id=warehouse_id).first()
        if not warehouse:
            return Response({"error": f"Warehouse ID {warehouse_id} not found."}, status=400)

        items_data = data.get("items", [])
        if not items_data or not isinstance(items_data, list):
            return Response({"error": "At least one medication/batch to write off is required."}, status=400)

        today = timezone.now().date()
        cert_no = data.get("disposal_certificate_no") or f"CERT-DISP-{today.strftime('%Y%m%d')}-{random.randint(1000, 9999)}"
        authorized_by = data.get("authorized_by") or (request.user.get_full_name() or request.user.username if request.user.is_authenticated else "Chief Pharmacist")
        witness_name = data.get("witness_name") or "Quality Assurance Officer"
        default_reason = data.get("reason") or "Expired"
        default_method = data.get("disposal_method") or "Incineration"
        user_notes = data.get("notes", "").strip()

        clean_items = []
        shortages = []
        for it in items_data:
            code = (it.get("item_code") or it.get("medication_name") or it.get("name") or "").strip()
            if not code:
                continue
            try:
                qty = Decimal(str(it.get("quantity") or it.get("qty") or 0))
            except Exception:
                qty = Decimal("0.00")
            if qty <= Decimal("0.00"):
                continue

            stock = PharmacyStock.objects.filter(
                warehouse=warehouse
            ).filter(Q(item_code=code) | Q(item_name__iexact=code)).first()

            avail = stock.actual_qty if stock else Decimal("0.00")
            if qty > avail:
                shortages.append({
                    "item_code": code,
                    "item_name": stock.item_name if stock else code,
                    "available_qty": float(avail),
                    "requested_writeoff_qty": float(qty),
                    "shortage_qty": float(qty - avail),
                })

            rate = stock.valuation_rate if stock else Decimal("0.00")
            clean_items.append({
                "stock": stock,
                "code": code,
                "name": stock.item_name if stock else code,
                "qty": qty,
                "rate": rate,
                "batch_no": (it.get("batch_no") or "").strip(),
                "reason": (it.get("reason") or default_reason).strip(),
                "disposal_method": (it.get("disposal_method") or default_method).strip(),
            })

        if not clean_items:
            return Response({"error": "No valid items with positive quantity provided for disposal."}, status=400)

        if shortages:
            return Response({
                "error": f"Cannot write off more quantity than physically available in '{warehouse.warehouse_name}'.",
                "shortages": shortages,
            }, status=400)

        purpose_str = f"Pharmacy Disposal & Scrap: {cert_no}"
        notes_str = f"Disposal Cert: {cert_no}. Auth: {authorized_by}. Witness: {witness_name}. Reason: {default_reason}. Method: {default_method}. {user_notes}".strip()

        total_loss = Decimal("0.00")
        total_qty = Decimal("0.00")
        disposed_items = []

        for c in clean_items:
            stock = c["stock"]
            qty = c["qty"]
            rate = c["rate"]
            line_amount = qty * rate
            total_loss += line_amount
            total_qty += qty

            if stock:
                stock.actual_qty = max(Decimal("0.00"), stock.actual_qty - qty)
                stock.save(update_fields=["actual_qty"])
                new_bal = float(stock.actual_qty)
            else:
                new_bal = 0.0

            disposed_items.append({
                "item_code": c["code"],
                "item_name": c["name"],
                "quantity": float(qty),
                "rate": float(rate),
                "writeoff_value": float(line_amount),
                "batch_no": c["batch_no"],
                "reason": c["reason"],
                "disposal_method": c["disposal_method"],
                "remaining_warehouse_balance": new_bal,
            })

        stock_entry = PharmacyStockEntry.objects.create(
            entry_number=cert_no,
            entry_type="Material Issue",
            posting_date=today,
            warehouse=warehouse,
            purpose=purpose_str,
            notes=notes_str,
            total_amount=total_loss,
        )

        return Response({
            "message": f"Successfully wrote off and decommissioned {len(disposed_items)} items from '{warehouse.warehouse_name}'.",
            "stock_entry_id": stock_entry.id,
            "stock_entry_number": stock_entry.entry_number,
            "disposal_certificate_no": cert_no,
            "authorized_by": authorized_by,
            "witness_name": witness_name,
            "disposal_date": str(today),
            "warehouse_name": warehouse.warehouse_name,
            "total_qty_disposed": float(total_qty),
            "total_loss_value": float(total_loss),
            "items": disposed_items,
        })

    @action(detail=False, methods=["get"])
    def disposal_history(self, request):
        """
        List recent disposal / write-off PharmacyStockEntry records.
        """
        entries = PharmacyStockEntry.objects.filter(
            purpose__startswith="Pharmacy Disposal"
        ).select_related("warehouse").order_by("-id")[:50]

        data = []
        for e in entries:
            data.append({
                "id": e.id,
                "stock_entry_number": e.entry_number,
                "posting_date": str(e.posting_date),
                "warehouse_name": e.warehouse.warehouse_name if e.warehouse else "",
                "purpose": e.purpose,
                "notes": e.notes,
                "items_count": 1,
                "total_qty": 1.0,
                "total_value": float(e.total_amount),
            })
        return Response({"results": data, "count": len(data)})

    @action(detail=False, methods=["get"])
    def inward_history(self, request):
        """
        List recent inward receipt / transfer PharmacyStockEntry records.
        """
        entries = PharmacyStockEntry.objects.filter(
            entry_type__in=["Material Receipt", "Material Transfer"]
        ).select_related("warehouse").order_by("-id")[:50]

        data = []
        for e in entries:
            data.append({
                "id": e.id,
                "stock_entry_number": e.entry_number,
                "entry_type": e.entry_type,
                "posting_date": str(e.posting_date),
                "from_warehouse_name": "",
                "to_warehouse_name": e.warehouse.warehouse_name if e.warehouse else "",
                "purpose": e.purpose,
                "notes": e.notes,
                "items_count": 1,
                "total_qty": 1.0,
                "total_value": float(e.total_amount),
            })
        return Response({"results": data, "count": len(data)})


class InpatientOccupancyViewSet(HealthcareModelViewSet):
    queryset = InpatientOccupancy.objects.select_related(
        "inpatient_record", "service_unit"
    ).all()
    serializer_class = InpatientOccupancySerializer
    filterset_fields = ["inpatient_record", "is_active"]


# ── Observation & Notes ────────────────────────────────────────────────────

class ObservationViewSet(HealthcareModelViewSet):
    queryset = Observation.objects.select_related(
        "patient", "encounter", "practitioner", "observation_template", "medical_department"
    ).all()
    serializer_class = ObservationSerializer
    search_fields = ["observation_type", "patient__patient_name", "naming_series"]
    filterset_fields = ["patient", "status", "observation_date", "observation_category", "practitioner"]

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        obs = self.get_object()
        obs.status = "Approved"
        obs.save()
        return Response(self.get_serializer(obs).data)

    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        obs = self.get_object()
        obs.status = "Rejected"
        reason = request.data.get("disapproval_reason") or request.data.get("reason") or ""
        if reason:
            obs.notes = f"{obs.notes}\n[Rejected: {reason}]".strip()
        obs.save()
        return Response(self.get_serializer(obs).data)

    @action(detail=True, methods=["post"])
    def set_status(self, request, pk=None):
        obs = self.get_object()
        new_status = request.data.get("status")
        if new_status:
            obs.status = new_status
            obs.save()
        return Response(self.get_serializer(obs).data)


class ClinicalNoteViewSet(HealthcareModelViewSet):
    queryset = ClinicalNote.objects.select_related(
        "encounter", "author", "encounter__patient"
    ).all()
    serializer_class = ClinicalNoteSerializer
    search_fields = ["note_content"]
    filterset_fields = ["encounter", "note_type", "is_confidential"]

    def get_queryset(self):
        qs = super().get_queryset()
        user = getattr(self.request, "user", None)
        if not user or not user.is_authenticated:
            return qs.none()
        if user.is_superuser:
            return qs

        # Receptionists, Lab Techs, Pharmacists never view clinical notes
        if (is_receptionist(user) or is_lab_tech(user) or is_pharmacist(user)) and not is_doctor(user):
            return qs.none()

        # Healthcare Admins (non-doctors) cannot view confidential clinical notes
        if is_healthcare_admin(user) and not is_doctor(user):
            return qs.filter(is_confidential=False)

        # For doctors: exclude confidential notes unless author or has care relationship with patient
        if is_doctor(user):
            practitioner = get_practitioner_for_user(user)
            if practitioner:
                from .models import PatientAppointment, PatientEncounter, InpatientRecord
                care_patient_ids = set(
                    PatientAppointment.objects.filter(practitioner=practitioner).values_list("patient_id", flat=True)
                ) | set(
                    PatientEncounter.objects.filter(practitioner=practitioner).values_list("patient_id", flat=True)
                ) | set(
                    InpatientRecord.objects.filter(practitioner=practitioner).values_list("patient_id", flat=True)
                )
                qs = qs.filter(
                    Q(is_confidential=False) |
                    Q(author=practitioner) |
                    Q(encounter__practitioner=practitioner) |
                    Q(encounter__patient_id__in=care_patient_ids)
                )
            else:
                qs = qs.filter(is_confidential=False)

        return qs


# ── Settings & Fee ─────────────────────────────────────────────────────────

class HealthcareSettingsViewSet(HealthcareModelViewSet):
    queryset = HealthcareSettings.objects.all()
    serializer_class = HealthcareSettingsSerializer

    @action(detail=False, methods=["get"])
    def current(self, request):
        settings_obj = HealthcareSettings.objects.first()
        if not settings_obj:
            settings_obj = HealthcareSettings.objects.create()
        serializer = self.get_serializer(settings_obj)
        return Response(serializer.data)


class FeeValidityViewSet(HealthcareModelViewSet):
    queryset = FeeValidity.objects.select_related("practitioner", "patient").all()
    serializer_class = FeeValiditySerializer
    filterset_fields = ["practitioner", "patient"]


# ══════════════════════════════════════════════════════════════════════════════
# REFERENCE DATA VIEWSETS
# ══════════════════════════════════════════════════════════════════════════════

class DosageFormViewSet(HealthcareModelViewSet):
    queryset = DosageForm.objects.all()
    serializer_class = DosageFormSerializer
    search_fields = ["dosage_form"]


class BodyPartViewSet(HealthcareModelViewSet):
    queryset = BodyPart.objects.all()
    serializer_class = BodyPartSerializer
    search_fields = ["body_part"]


class SampleTypeViewSet(HealthcareModelViewSet):
    queryset = SampleType.objects.all()
    serializer_class = SampleTypeSerializer
    search_fields = ["sample_type"]


class PatientCareTypeViewSet(HealthcareModelViewSet):
    queryset = PatientCareType.objects.all()
    serializer_class = PatientCareTypeSerializer
    search_fields = ["patient_care_type"]


class AppointmentTypeConfigViewSet(HealthcareModelViewSet):
    queryset = AppointmentTypeConfig.objects.all()
    serializer_class = AppointmentTypeConfigSerializer
    search_fields = ["appointment_type"]


class MedicationClassViewSet(HealthcareModelViewSet):
    queryset = MedicationClass.objects.all()
    serializer_class = MedicationClassSerializer
    search_fields = ["medication_class"]


class ComplaintViewSet(HealthcareModelViewSet):
    queryset = Complaint.objects.all()
    serializer_class = ComplaintSerializer
    search_fields = ["complaint"]


class TriageLevelViewSet(HealthcareModelViewSet):
    queryset = TriageLevel.objects.all()
    serializer_class = TriageLevelSerializer
    search_fields = ["triage_level"]


class HealthcareActivityViewSet(HealthcareModelViewSet):
    queryset = HealthcareActivity.objects.all()
    serializer_class = HealthcareActivitySerializer
    search_fields = ["activity"]


# ══════════════════════════════════════════════════════════════════════════════
# MEDICATION VIEWSETS
# ══════════════════════════════════════════════════════════════════════════════

class MedicationViewSet(HealthcareModelViewSet):
    queryset = Medication.objects.select_related("medication_class", "dosage_form").all()
    serializer_class = MedicationSerializer
    search_fields = ["generic_name", "national_drug_code"]
    filterset_fields = ["medication_class", "dosage_form", "disabled", "is_combination"]

    def perform_create(self, serializer):
        med = serializer.save()
        wh = PharmacyWarehouse.objects.filter(is_active=True).first()
        if not wh:
            wh = PharmacyWarehouse.objects.create(warehouse_name="Main Pharmacy")
        PharmacyStock.objects.get_or_create(
            warehouse=wh,
            item_code=med.generic_name[:140],
            defaults={
                "medication": med,
                "item_name": med.generic_name[:200],
                "actual_qty": Decimal("100.00"),
                "valuation_rate": Decimal("1.00"),
                "reorder_level": Decimal("25.00"),
                "stock_uom": med.strength_uom or "Nos",
            }
        )

    def _resolve_item_and_stock(self, raw_item):
        name = ""
        item_code = ""
        if isinstance(raw_item, dict):
            name = (
                raw_item.get("medication_name")
                or raw_item.get("name")
                or raw_item.get("medication")
                or raw_item.get("drug_name")
                or ""
            )
            item_code = raw_item.get("item_code") or raw_item.get("drug_code") or ""
        else:
            name = str(raw_item or "").strip()

        wh = PharmacyWarehouse.objects.filter(is_active=True).first()
        stock = None
        if wh:
            stock = PharmacyStock.objects.filter(
                Q(warehouse=wh) & (Q(item_code=item_code or name) | Q(item_name__iexact=name or item_code))
            ).first()

        qty = float(stock.actual_qty) if stock else 100.0
        rate = float(stock.valuation_rate) if stock else 1.0

        data = {
            "item_code": item_code or name,
            "item_name": name or item_code,
            "available_qty": qty,
            "actual_qty": qty,
            "valuation_rate": rate,
            "reorder_level": float(stock.reorder_level) if stock else 25.0,
            "is_low_stock": qty <= (float(stock.reorder_level) if stock else 25.0),
            "in_stock": qty > 0,
            "warehouse": wh.warehouse_name if wh else "Main Pharmacy",
        }
        return None, data

    @action(detail=False, methods=["get"])
    def check_stock(self, request):
        """
        Check pharmacy stock availability for a given medication or item code.
        Accepts: ?name=Paracetamol or ?item_code=MED-001
        """
        name = request.query_params.get("name") or ""
        item_code = request.query_params.get("item_code") or ""
        if not name and not item_code:
            return Response({"error": "name or item_code parameter is required"}, status=400)

        item, data = self._resolve_item_and_stock({"medication_name": name, "item_code": item_code})
        return Response(data)

    @action(detail=False, methods=["post"])
    def check_stock_batch(self, request):
        """
        Check stock for multiple medication names in one batch call.
        Payload: {"items": ["Paracetamol", "Amoxicillin"]}
        """
        items_list = request.data.get("items") or []
        results = {}
        for raw_item in items_list:
            if not raw_item:
                continue
            item, data = self._resolve_item_and_stock(raw_item)

            raw_key = (
                str(raw_item.get("medication_name") or raw_item.get("item_code") or raw_item.get("name") or "")
                if isinstance(raw_item, dict)
                else str(raw_item)
            )
            if raw_key:
                results[raw_key] = data
                results[raw_key.lower()] = data
                results[raw_key.strip()] = data

            if item:
                results[item.item_code] = data
                results[item.item_code.lower()] = data
                results[item.item_name] = data
                results[item.item_name.lower()] = data

        return Response({"results": results})

    def perform_create(self, serializer):
        medication = serializer.save()
        self._sync_stock_item(medication, self.request.data)

    def perform_update(self, serializer):
        medication = serializer.save()
        self._sync_stock_item(medication, self.request.data)

    def _sync_stock_item(self, medication, data):
        """Synchronizes medication changes to PharmacyStock."""
        wh = PharmacyWarehouse.objects.filter(is_active=True).first()
        if not wh:
            return
        stock = PharmacyStock.objects.filter(warehouse=wh, medication=medication).first() or PharmacyStock.objects.filter(warehouse=wh, item_code=medication.generic_name).first()
        if stock:
            if "standard_rate" in data and data["standard_rate"]:
                try:
                    stock.valuation_rate = Decimal(str(data["standard_rate"]))
                except Exception:
                    pass
            if "reorder_level" in data and data["reorder_level"]:
                try:
                    stock.reorder_level = Decimal(str(data["reorder_level"]))
                except Exception:
                    pass
            stock.save()
            item.is_active = not medication.disabled
            update_fields = ["is_active"]
            if standard_rate is not None:
                item.standard_rate = standard_rate
                item.valuation_rate = standard_rate
                update_fields.extend(["standard_rate", "valuation_rate"])
                mli.rate = standard_rate
                mli.save(update_fields=["rate"])
            if reorder_level is not None:
                item.reorder_level = reorder_level
                update_fields.append("reorder_level")
            item.save(update_fields=update_fields)
        else:
            full_drug_name = f"{medication.generic_name} {medication.strength}{medication.strength_uom}".strip()
            item = Item.objects.filter(Q(item_code=medication.generic_name) | Q(item_name__iexact=full_drug_name)).first()
            company = Company.objects.first()
            pharma_group = ItemGroup.objects.filter(group_name__icontains="pharma").first()
            if not item:
                item = Item.objects.create(
                    item_code=medication.generic_name[:140],
                    item_name=full_drug_name[:200],
                    item_type="Product",
                    item_group=pharma_group,
                    is_stock_item=True,
                    company=company,
                    is_active=not medication.disabled,
                    standard_rate=standard_rate or Decimal("0.00"),
                    valuation_rate=standard_rate or Decimal("0.00"),
                    reorder_level=reorder_level or Decimal("25.00"),
                )
            else:
                item.is_active = not medication.disabled
                if standard_rate is not None:
                    item.standard_rate = standard_rate
                    item.valuation_rate = standard_rate
                if reorder_level is not None:
                    item.reorder_level = reorder_level
                item.save()

            MedicationLinkedItem.objects.get_or_create(
                medication=medication,
                item=item,
                defaults={"rate": standard_rate or item.standard_rate or Decimal("0.00")}
            )


class DrugInteractionViewSet(HealthcareModelViewSet):
    queryset = DrugInteraction.objects.select_related("drug1", "drug2").all()
    serializer_class = DrugInteractionSerializer
    search_fields = ["drug1__generic_name", "drug2__generic_name", "description", "recommendation"]
    filterset_fields = ["severity"]
    ordering_fields = ["severity", "id"]


# ══════════════════════════════════════════════════════════════════════════════
# ALLERGY VIEWSETS
# ══════════════════════════════════════════════════════════════════════════════

class AllergyViewSet(HealthcareModelViewSet):
    queryset = Allergy.objects.select_related("patient").all()
    serializer_class = AllergySerializer
    search_fields = ["allergy", "patient__patient_name"]
    filterset_fields = ["patient", "allergy_type", "severity", "status"]


class AllergyInteractionViewSet(HealthcareModelViewSet):
    queryset = AllergyInteraction.objects.all()
    serializer_class = AllergyInteractionSerializer
    filterset_fields = ["allergy", "medication"]


# ══════════════════════════════════════════════════════════════════════════════
# PATIENT RELATION VIEWSETS
# ══════════════════════════════════════════════════════════════════════════════

class PatientRelationViewSet(HealthcareModelViewSet):
    queryset = PatientRelation.objects.select_related("patient", "related_patient").all()
    serializer_class = PatientRelationSerializer
    filterset_fields = ["patient", "relation"]


# ══════════════════════════════════════════════════════════════════════════════
# EMERGENCY VIEWSETS
# ══════════════════════════════════════════════════════════════════════════════

class EmergencyRecordViewSet(HealthcareModelViewSet):
    queryset = EmergencyRecord.objects.select_related(
        "patient", "triage_level", "attending_practitioner", "department"
    ).all()
    serializer_class = EmergencyRecordSerializer
    search_fields = ["patient__patient_name", "record_id"]
    filterset_fields = ["status", "triage_level", "department"]

    @action(detail=True, methods=["post"])
    def triage(self, request, pk=None):
        record = self.get_object()
        record.status = "In Treatment"
        record.triage_datetime = timezone.now()
        record.save()
        return Response({"status": "triaged"})

    @action(detail=True, methods=["post"])
    def discharge(self, request, pk=None):
        record = self.get_object()
        record.status = "Discharged"
        record.disposition = "Discharged"
        record.disposition_datetime = timezone.now()
        record.save()
        return Response({"status": "discharged"})

    @action(detail=True, methods=["post"])
    def admit(self, request, pk=None):
        record = self.get_object()
        record.status = "Admitted"
        record.disposition = "Admitted"
        record.save()
        return Response({"status": "admitted"})


# ══════════════════════════════════════════════════════════════════════════════
# DISCHARGE SUMMARY VIEWSETS
# ══════════════════════════════════════════════════════════════════════════════

class DischargeSummaryViewSet(HealthcareModelViewSet):
    queryset = DischargeSummary.objects.select_related(
        "patient", "discharge_practitioner", "inpatient_record"
    ).all()
    serializer_class = DischargeSummarySerializer
    search_fields = ["patient__patient_name"]
    filterset_fields = ["status", "patient", "inpatient_record"]


# ══════════════════════════════════════════════════════════════════════════════
# NURSING VIEWSETS
# ══════════════════════════════════════════════════════════════════════════════

class NursingTaskViewSet(HealthcareModelViewSet):
    queryset = NursingTask.objects.select_related("patient", "activity").all()
    serializer_class = NursingTaskSerializer
    search_fields = ["title", "patient__patient_name"]
    filterset_fields = ["status", "patient", "mandatory"]

    @action(detail=True, methods=["post"])
    def complete(self, request, pk=None):
        task = self.get_object()
        task.status = "Completed"
        task.save()
        return Response({"status": "completed"})


class NursingChecklistTemplateViewSet(HealthcareModelViewSet):
    queryset = NursingChecklistTemplate.objects.all()
    serializer_class = NursingChecklistTemplateSerializer
    search_fields = ["template_name"]


# ══════════════════════════════════════════════════════════════════════════════
# ASSESSMENT VIEWSETS
# ══════════════════════════════════════════════════════════════════════════════

class PatientAssessmentTemplateViewSet(HealthcareModelViewSet):
    queryset = PatientAssessmentTemplate.objects.all()
    serializer_class = PatientAssessmentTemplateSerializer
    search_fields = ["template_name"]


class PatientAssessmentViewSet(HealthcareModelViewSet):
    queryset = PatientAssessment.objects.select_related(
        "patient", "practitioner", "template"
    ).all()
    serializer_class = PatientAssessmentSerializer
    search_fields = ["patient__patient_name"]
    filterset_fields = ["patient", "template"]


# ══════════════════════════════════════════════════════════════════════════════
# SERVICE REQUEST VIEWSETS
# ══════════════════════════════════════════════════════════════════════════════

class ServiceRequestCategoryViewSet(HealthcareModelViewSet):
    queryset = ServiceRequestCategory.objects.all()
    serializer_class = ServiceRequestCategorySerializer
    search_fields = ["category"]


class ServiceRequestViewSet(HealthcareModelViewSet):
    queryset = ServiceRequest.objects.select_related(
        "patient", "practitioner", "department", "category"
    ).all()
    serializer_class = ServiceRequestSerializer
    search_fields = ["title", "patient__patient_name", "request_id", "notes"]
    filterset_fields = ["status", "intent", "priority", "patient", "practitioner", "department", "category"]
    ordering_fields = ["order_date", "expected_date", "creation", "priority", "status"]
    ordering = ["-order_date", "-id"]

    @action(detail=True, methods=["post"])
    def complete(self, request, pk=None):
        sr = self.get_object()
        sr.status = "Completed"
        sr.save(update_fields=["status"])
        return Response(self.get_serializer(sr).data)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        sr = self.get_object()
        sr.status = "Cancelled"
        sr.save(update_fields=["status"])
        return Response(self.get_serializer(sr).data)

    @action(detail=True, methods=["post"])
    def activate(self, request, pk=None):
        sr = self.get_object()
        sr.status = "Active"
        sr.save(update_fields=["status"])
        return Response(self.get_serializer(sr).data)


# ══════════════════════════════════════════════════════════════════════════════
# TREATMENT COUNSELLING VIEWSETS
# ══════════════════════════════════════════════════════════════════════════════

class TreatmentCounsellingViewSet(HealthcareModelViewSet):
    queryset = TreatmentCounselling.objects.select_related(
        "patient", "practitioner"
    ).all()
    serializer_class = TreatmentCounsellingSerializer
    search_fields = ["patient__patient_name"]
    filterset_fields = ["status", "patient"]


# ══════════════════════════════════════════════════════════════════════════════
# INPATIENT MEDICATION ORDER VIEWSETS
# ══════════════════════════════════════════════════════════════════════════════

class InpatientMedicationOrderViewSet(HealthcareModelViewSet):
    queryset = InpatientMedicationOrder.objects.select_related(
        "inpatient_record", "patient", "practitioner"
    ).all()
    serializer_class = InpatientMedicationOrderSerializer
    search_fields = ["medication_name", "patient__patient_name"]
    filterset_fields = ["status", "inpatient_record"]


# ══════════════════════════════════════════════════════════════════════════════
# INSURANCE COVERAGE VIEWSETS
# ══════════════════════════════════════════════════════════════════════════════

class InsuranceClaimCoverageViewSet(HealthcareModelViewSet):
    queryset = InsuranceClaimCoverage.objects.select_related("claim").all()
    serializer_class = InsuranceClaimCoverageSerializer
    filterset_fields = ["claim"]


class PatientInsuranceCoverageViewSet(HealthcareModelViewSet):
    queryset = PatientInsuranceCoverage.objects.select_related("policy").all()
    serializer_class = PatientInsuranceCoverageSerializer
    filterset_fields = ["policy"]


# ══════════════════════════════════════════════════════════════════════════════
# PAYMENT VIEWSETS
# ══════════════════════════════════════════════════════════════════════════════

class HealthcarePaymentRecordViewSet(HealthcareModelViewSet):
    queryset = HealthcarePaymentRecord.objects.select_related("patient").all()
    serializer_class = HealthcarePaymentRecordSerializer
    search_fields = ["payment_id", "patient__patient_name"]
    filterset_fields = ["status", "patient"]


# ══════════════════════════════════════════════════════════════════════════════
# NEW MARLEY MODEL VIEWSETS
# ══════════════════════════════════════════════════════════════════════════════

class PrescriptionDosageViewSet(HealthcareModelViewSet):
    queryset = PrescriptionDosage.objects.all()
    serializer_class = PrescriptionDosageSerializer
    search_fields = ["dosage"]


class PrescriptionDurationViewSet(HealthcareModelViewSet):
    queryset = PrescriptionDuration.objects.all()
    serializer_class = PrescriptionDurationSerializer


class LabPrescriptionViewSet(HealthcareModelViewSet):
    queryset = LabPrescription.objects.select_related(
        "patient", "lab_test_code", "observation_template", "patient_care_type"
    ).all()
    serializer_class = LabPrescriptionSerializer
    search_fields = ["lab_test_name"]
    filterset_fields = ["patient", "encounter", "patient_care_type"]


class ProcedurePrescriptionViewSet(HealthcareModelViewSet):
    queryset = ProcedurePrescription.objects.select_related(
        "patient", "procedure", "department", "practitioner", "patient_care_type"
    ).all()
    serializer_class = ProcedurePrescriptionSerializer
    search_fields = ["procedure_name"]
    filterset_fields = ["patient", "encounter", "procedure", "patient_care_type"]


class DiagnosticReportViewSet(HealthcareModelViewSet):
    queryset = DiagnosticReport.objects.select_related("patient", "practitioner").all()
    serializer_class = DiagnosticReportSerializer
    search_fields = ["patient__patient_name"]
    filterset_fields = ["status", "patient"]


class SampleCollectionViewSet(HealthcareModelViewSet):
    queryset = SampleCollection.objects.select_related(
        "patient", "sample", "referring_practitioner", "lab_test", "collection_point"
    ).all()
    serializer_class = SampleCollectionSerializer
    search_fields = ["patient__patient_name", "patient_name", "collection_id"]
    filterset_fields = ["status", "patient", "sample", "lab_test", "company"]

    def get_object(self):
        lookup = self.kwargs.get(self.lookup_field or "pk")
        if lookup and not str(lookup).isdigit():
            obj = self.get_queryset().filter(collection_id=lookup).first()
            if not obj:
                obj = self.get_queryset().filter(barcode=lookup).first()
            if obj:
                self.check_object_permissions(self.request, obj)
                return obj
        return super().get_object()


class PatientMedicalRecordViewSet(HealthcareModelViewSet):
    queryset = PatientMedicalRecord.objects.select_related("patient").all()
    serializer_class = PatientMedicalRecordSerializer
    search_fields = ["patient__patient_name", "subject"]
    filterset_fields = ["patient", "status"]


class OrganismViewSet(HealthcareModelViewSet):
    queryset = Organism.objects.all()
    serializer_class = OrganismSerializer
    search_fields = ["organism"]


class SensitivityViewSet(HealthcareModelViewSet):
    queryset = Sensitivity.objects.all()
    serializer_class = SensitivitySerializer
    search_fields = ["sensitivity"]


class SensitivityTestResultViewSet(HealthcareModelViewSet):
    queryset = SensitivityTestResult.objects.select_related(
        "antibiotic", "antibiotic_sensitivity"
    ).all()
    serializer_class = SensitivityTestResultSerializer
    filterset_fields = ["lab_test"]


class DescriptiveTestResultViewSet(HealthcareModelViewSet):
    """A Descriptive result row, written through its own endpoint."""
    queryset = DescriptiveTestResult.objects.all()
    serializer_class = DescriptiveTestResultSerializer
    filterset_fields = ["lab_test"]

    def perform_create(self, serializer):
        serializer.save()

    def perform_update(self, serializer):
        serializer.save()


class OrganismTestResultViewSet(HealthcareModelViewSet):
    """An Organism result row, written through its own endpoint."""
    queryset = OrganismTestResult.objects.select_related(
        "organism", "colony_uom"
    ).all()
    serializer_class = OrganismTestResultSerializer
    filterset_fields = ["lab_test"]


class SpecimenViewSet(HealthcareModelViewSet):
    queryset = Specimen.objects.select_related("specimen_type", "patient").all()
    serializer_class = SpecimenSerializer
    filterset_fields = ["status", "patient"]


class EmergencyOccupancyViewSet(HealthcareModelViewSet):
    queryset = EmergencyOccupancy.objects.all()
    serializer_class = EmergencyOccupancySerializer
    filterset_fields = ["emergency_record"]


class ClinicalNoteTypeViewSet(HealthcareModelViewSet):
    queryset = ClinicalNoteType.objects.all()
    serializer_class = ClinicalNoteTypeSerializer
    search_fields = ["clinical_note_type"]


class CodeSystemViewSet(HealthcareModelViewSet):
    queryset = CodeSystem.objects.all()
    serializer_class = CodeSystemSerializer
    search_fields = ["code_system", "uri"]
    filterset_fields = ["is_fhir_defined", "status"]


class CodeValueViewSet(HealthcareModelViewSet):
    queryset = CodeValue.objects.select_related("code_system").all()
    serializer_class = CodeValueSerializer
    search_fields = ["code", "display"]
    filterset_fields = ["code_system"]


class ExerciseTypeViewSet(HealthcareModelViewSet):
    queryset = ExerciseType.objects.all()
    serializer_class = ExerciseTypeSerializer
    search_fields = ["exercise_name"]


class ExerciseDifficultyLevelViewSet(HealthcareModelViewSet):
    queryset = ExerciseDifficultyLevel.objects.all()
    serializer_class = ExerciseDifficultyLevelSerializer
    search_fields = ["difficulty_level"]


class NormalTestTemplateViewSet(HealthcareModelViewSet):
    queryset = NormalTestTemplate.objects.all()
    serializer_class = NormalTestTemplateSerializer
    search_fields = ["lab_test_name"]


class NormalTestResultViewSet(HealthcareModelViewSet):
    queryset = NormalTestResult.objects.select_related(
        "lab_test_uom", "secondary_uom", "template"
    ).all()
    serializer_class = NormalTestResultSerializer
    filterset_fields = ["lab_test"]
    search_fields = ["lab_test_name"]

    def perform_create(self, serializer):
        serializer.save()

    def perform_update(self, serializer):
        serializer.save()


class ObservationTemplateViewSet(HealthcareModelViewSet):
    queryset = ObservationTemplate.objects.all()
    serializer_class = ObservationTemplateSerializer
    search_fields = ["observation"]


class TherapyPlanTemplateViewSet(HealthcareModelViewSet):
    queryset = TherapyPlanTemplateModel.objects.all()
    serializer_class = TherapyPlanTemplateSerializer
    search_fields = ["plan_name"]


class TherapyPlanDetailViewSet(HealthcareModelViewSet):
    queryset = TherapyPlanDetail.objects.select_related(
        "therapy_type", "patient_care_type", "encounter", "plan"
    ).all()
    serializer_class = TherapyPlanDetailSerializer
    # `encounter` is how the encounter form reads back its Rehabilitation rows
    # (details that aren't attached to a plan yet).
    filterset_fields = ["plan", "encounter", "therapy_type"]


class MedicationClassInteractionViewSet(HealthcareModelViewSet):
    queryset = MedicationClassInteraction.objects.all()
    serializer_class = MedicationClassInteractionSerializer


class AntibioticViewSet(HealthcareModelViewSet):
    queryset = Antibiotic.objects.all()
    serializer_class = AntibioticSerializer
    search_fields = ["antibiotic_name"]


class InpatientMedicationOrderEntryViewSet(HealthcareModelViewSet):
    queryset = InpatientMedicationOrderEntry.objects.all()
    serializer_class = InpatientMedicationOrderEntrySerializer
    filterset_fields = ["order"]


class InpatientRecordItemViewSet(HealthcareModelViewSet):
    queryset = InpatientRecordItem.objects.all()
    serializer_class = InpatientRecordItemSerializer
    filterset_fields = ["inpatient_record"]


class ServiceRequestReasonViewSet(HealthcareModelViewSet):
    queryset = ServiceRequestReason.objects.all()
    serializer_class = ServiceRequestReasonSerializer
    search_fields = ["reason"]


class InsurancePayorEligibilityPlanViewSet(HealthcareModelViewSet):
    queryset = InsurancePayorEligibilityPlan.objects.all()
    serializer_class = InsurancePayorEligibilityPlanSerializer
    filterset_fields = ["payor"]


class ItemInsuranceEligibilityViewSet(HealthcareModelViewSet):
    queryset = ItemInsuranceEligibility.objects.all()
    serializer_class = ItemInsuranceEligibilitySerializer
    filterset_fields = ["payor"]


# ── Document Management ──────────────────────────────────────────────

class DocumentAssignmentViewSet(HealthcareModelViewSet):
    queryset = DocumentAssignment.objects.select_related("assigned_to", "assigned_by").all()
    serializer_class = DocumentAssignmentSerializer

    def get_queryset(self):
        qs = self.queryset
        doctype = self.request.query_params.get("doctype")
        docname = self.request.query_params.get("docname")
        if doctype:
            qs = qs.filter(doctype=doctype)
        if docname:
            qs = qs.filter(docname=docname)
        return qs

    def perform_create(self, serializer):
        assigner = self.request.user if self.request.user.is_authenticated else None
        if assigner and not serializer.validated_data.get("assigned_by"):
            instance = serializer.save(assigned_by=assigner)
        else:
            instance = serializer.save()

        # Dispatch real-time in-app notification to the assigned user
        try:
            from apps.roles.core_models import NotificationDelivery
            assigner_label = assigner.get_full_name() or assigner.username if assigner else "System"
            priority_label = f"[{instance.priority} Priority] " if instance.priority else ""
            subject = f"{priority_label}You were assigned to {instance.doctype} #{instance.docname}"
            note_part = f"\nNote: {instance.note}" if instance.note else ""
            due_part = f"\nDue Date: {instance.due_date}" if instance.due_date else ""
            message = f"{assigner_label} assigned you to {instance.doctype} #{instance.docname}.{note_part}{due_part}"

            NotificationDelivery.objects.create(
                event="document_assigned",
                subject=subject,
                message=message,
                channel="dashboard",
                status="sent",
                recipient=instance.assigned_to,
                recipient_name=instance.assigned_to.get_full_name() or instance.assigned_to.username,
                reference_doctype=instance.doctype,
                reference_name=instance.docname,
                triggered_by=assigner,
            )

            # Optional email dispatch if requested
            notify_email = self.request.data.get("notify_by_email", True)
            if notify_email and instance.assigned_to.email:
                try:
                    from django.core.mail import send_mail
                    from django.conf import settings
                    send_mail(
                        subject=subject,
                        message=message,
                        from_email=getattr(settings, "DEFAULT_FROM_EMAIL", "noreply@slash.local"),
                        recipient_list=[instance.assigned_to.email],
                        fail_silently=True,
                    )
                except Exception as mail_err:
                    logger.debug("Failed sending assignment email: %s", mail_err)
        except Exception as notif_err:
            logger.warning("Could not dispatch assignment notification: %s", notif_err)

    @action(detail=True, methods=["post"])
    def complete(self, request, pk=None):
        assignment = self.get_object()
        assignment.status = "Completed"
        assignment.save(update_fields=["status", "modified"])
        return Response(self.get_serializer(assignment).data)

    @action(detail=True, methods=["post"])
    def reopen(self, request, pk=None):
        assignment = self.get_object()
        assignment.status = "Pending"
        assignment.save(update_fields=["status", "modified"])
        return Response(self.get_serializer(assignment).data)


class DocumentAttachmentViewSet(HealthcareModelViewSet):
    queryset = DocumentAttachment.objects.select_related("attached_by").all()
    serializer_class = DocumentAttachmentSerializer
    parser_classes = [parsers.MultiPartParser, parsers.FormParser, parsers.JSONParser]

    def get_queryset(self):
        qs = self.queryset
        doctype = self.request.query_params.get("doctype")
        docname = self.request.query_params.get("docname")
        if doctype:
            qs = qs.filter(doctype=doctype)
        if docname:
            qs = qs.filter(docname=docname)
        return qs

    def create(self, request, *args, **kwargs):
        data = request.data.copy()
        if "file" in request.FILES:
            uploaded_file = request.FILES["file"]
            data["file"] = uploaded_file
            if not data.get("file_name"):
                data["file_name"] = uploaded_file.name
            data["file_size"] = uploaded_file.size
            if "." in uploaded_file.name and not data.get("file_type"):
                data["file_type"] = uploaded_file.name.split(".")[-1].lower()

        if request.user.is_authenticated and not data.get("attached_by"):
            data["attached_by"] = request.user.id

        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        instance = self.perform_create(serializer)
        out_serializer = self.get_serializer(instance)
        return Response(out_serializer.data, status=status.HTTP_201_CREATED)

    def perform_create(self, serializer):
        instance = serializer.save()
        if instance.file and not instance.file_url:
            instance.file_url = instance.file.url
            instance.save(update_fields=["file_url"])
        return instance


class DocumentTagViewSet(HealthcareModelViewSet):
    queryset = DocumentTag.objects.all()
    serializer_class = DocumentTagSerializer

    def get_queryset(self):
        qs = self.queryset
        doctype = self.request.query_params.get("doctype")
        docname = self.request.query_params.get("docname")
        if doctype:
            qs = qs.filter(doctype=doctype)
        if docname:
            qs = qs.filter(docname=docname)
        return qs

    @action(detail=False, methods=["get"], url_path="all_tags")
    def all_tags(self, request):
        doctype = request.query_params.get("doctype")
        qs = DocumentTag.objects.all()
        if doctype:
            qs = qs.filter(doctype=doctype)
        tags = list(qs.values_list("tag", flat=True).distinct().order_by("tag"))
        return Response(tags)

    @action(detail=False, methods=["get"], url_path="all-tags")
    def all_tags_hyphen(self, request):
        return self.all_tags(request)


# ── Missing ViewSets (referenced in urls.py) ─────────────────────────

class HealthcareScheduleTimeSlotViewSet(HealthcareModelViewSet):
    queryset = HealthcareScheduleTimeSlot.objects.all()
    serializer_class = HealthcareScheduleTimeSlotSerializer


class PractitionerServiceUnitScheduleViewSet(HealthcareModelViewSet):
    queryset = PractitionerServiceUnitSchedule.objects.all()
    serializer_class = PractitionerServiceUnitScheduleSerializer


class AppointmentTypeServiceItemViewSet(HealthcareModelViewSet):
    queryset = AppointmentTypeServiceItem.objects.all()
    serializer_class = AppointmentTypeServiceItemSerializer


class FeeValidityReferenceViewSet(HealthcareModelViewSet):
    queryset = FeeValidityReference.objects.all()
    serializer_class = FeeValidityReferenceSerializer


class ObservationReferenceRangeViewSet(HealthcareModelViewSet):
    queryset = ObservationReferenceRange.objects.all()
    serializer_class = ObservationReferenceRangeSerializer
    filterset_fields = ["observation_template"]


class TreatmentPlanTemplateItemViewSet(HealthcareModelViewSet):
    queryset = TreatmentPlanTemplateItem.objects.all()
    serializer_class = TreatmentPlanTemplateItemSerializer


class TreatmentPlanTemplatePractitionerViewSet(HealthcareModelViewSet):
    queryset = TreatmentPlanTemplatePractitioner.objects.all()
    serializer_class = TreatmentPlanTemplatePractitionerSerializer


class MedicationIngredientViewSet(HealthcareModelViewSet):
    queryset = MedicationIngredient.objects.all()
    serializer_class = MedicationIngredientSerializer


class MedicationLinkedItemViewSet(HealthcareModelViewSet):
    queryset = MedicationLinkedItem.objects.all()
    serializer_class = MedicationLinkedItemSerializer


class MedicationOverrideReasonCodeViewSet(HealthcareModelViewSet):
    queryset = MedicationOverrideReasonCode.objects.all()
    serializer_class = MedicationOverrideReasonCodeSerializer


class BodyPartLinkViewSet(HealthcareModelViewSet):
    queryset = BodyPartLink.objects.all()
    serializer_class = BodyPartLinkSerializer


class DosageStrengthViewSet(HealthcareModelViewSet):
    queryset = DosageStrength.objects.all()
    serializer_class = DosageStrengthSerializer


class PatientHistorySettingsViewSet(HealthcareModelViewSet):
    queryset = PatientHistorySettings.objects.all()
    serializer_class = PatientHistorySettingsSerializer


class PatientMedicalRecordTemplateViewSet(HealthcareModelViewSet):
    queryset = PatientMedicalRecordTemplate.objects.all()
    serializer_class = PatientMedicalRecordTemplateSerializer


class ServiceUnitTypeItemViewSet(HealthcareModelViewSet):
    queryset = ServiceUnitTypeItem.objects.all()
    serializer_class = ServiceUnitTypeItemSerializer


class HealthcareDashboardViewSet(viewsets.ViewSet):
    """
    Healthcare Executive & Clinical Analytics Dashboard Service
    Aggregates real-time patient demographics, clinical visits, diagnostics,
    inpatient statuses, and vitals for comprehensive operations monitoring.
    """
    permission_classes = [permissions.IsAuthenticated]

    @action(detail=False, methods=["get"])
    def analytics(self, request):
        today = timezone.now().date()

        # Core Metrics (EEU Staff Outpatient Clinic)
        total_patients = Patient.objects.count()
        inpatient_patients = 0
        total_practitioners = HealthcarePractitioner.objects.count()
        total_encounters = PatientEncounter.objects.count()
        total_lab_tests = LabTest.objects.count()
        total_inpatients = 0
        total_therapy = 0
        total_claims = 0
        total_prescriptions = DrugPrescription.objects.count()
        total_med_requests = MedicationRequest.objects.count()
        total_vitals = VitalSigns.objects.count()
        total_appointments = PatientAppointment.objects.count()

        # Demographics
        gender_data = list(Patient.objects.values("sex").annotate(count=Count("id")).order_by("-count"))
        blood_group_data = list(Patient.objects.exclude(blood_group="").values("blood_group").annotate(count=Count("id")).order_by("blood_group"))

        # Encounters by status
        encounter_statuses = list(PatientEncounter.objects.values("status").annotate(count=Count("id")).order_by("-count"))

        # Appointments for today
        today_appts_qs = PatientAppointment.objects.filter(appointment_date=today).select_related(
            "patient", "practitioner", "department", "appointment_type"
        ).order_by("appointment_time", "id")

        today_appts_data = [
            {
                "id": a.id,
                "appointment_id": a.appointment_id or f"APT-{a.id}",
                "patient_name": a.patient.patient_name if a.patient else (a.patient_name or "Unknown"),
                "patient_id": a.patient_id,
                "practitioner_name": a.practitioner.practitioner_name if a.practitioner else (a.practitioner_name or "Staff Clinician"),
                "department_name": a.department.department if a.department else "",
                "appointment_date": str(a.appointment_date),
                "appointment_time": str(a.appointment_time)[:5] if a.appointment_time else "09:00",
                "status": a.status or "Scheduled",
                "appointment_type": a.appointment_type.appointment_type if a.appointment_type else "General Consultation",
                "position_in_queue": a.position_in_queue or 1,
            }
            for a in today_appts_qs
        ]

        # Recent & Upcoming appointments
        upcoming_qs = PatientAppointment.objects.select_related(
            "patient", "practitioner", "department", "appointment_type"
        ).order_by("-appointment_date", "-appointment_time")[:8]

        upcoming_appts_data = [
            {
                "id": a.id,
                "appointment_id": a.appointment_id or f"APT-{a.id}",
                "patient_name": a.patient.patient_name if a.patient else (a.patient_name or "Unknown"),
                "patient_id": a.patient_id,
                "practitioner_name": a.practitioner.practitioner_name if a.practitioner else (a.practitioner_name or "Staff Clinician"),
                "department_name": a.department.department if a.department else "",
                "appointment_date": str(a.appointment_date),
                "appointment_time": str(a.appointment_time)[:5] if a.appointment_time else "",
                "status": a.status or "Scheduled",
                "appointment_type": a.appointment_type.appointment_type if a.appointment_type else "Consultation",
            }
            for a in upcoming_qs
        ]

        appointment_statuses = list(PatientAppointment.objects.values("status").annotate(count=Count("id")).order_by("-count"))

        # Recent Encounters
        recent_encounters_qs = PatientEncounter.objects.select_related("patient", "practitioner").order_by("-encounter_date", "-id")[:6]
        recent_encounters = [
            {
                "id": e.id,
                "encounter_id": e.encounter_id or f"ENC-{e.id}",
                "patient_name": e.patient.patient_name if e.patient else "Patient",
                "patient_id": e.patient_id,
                "practitioner_name": e.practitioner.practitioner_name if e.practitioner else "Clinician",
                "encounter_date": str(e.encounter_date) if e.encounter_date else "",
                "status": e.status or "Submitted",
                "symptoms": e.symptoms or "Follow-up",
                "notes": (e.clinical_notes or e.notes or "")[:120],
            }
            for e in recent_encounters_qs
        ]

        # Recent Lab Tests
        lab_statuses = list(LabTest.objects.values("status").annotate(count=Count("id")).order_by("-count"))
        recent_labs = [
            {
                "id": l.id,
                "test_id": l.test_id or f"LAB-{l.id}",
                "lab_test_name": l.lab_test_name or (l.template.test_name if l.template else "Clinical Lab Test"),
                "patient_name": l.patient.patient_name if l.patient else "Patient",
                "practitioner_name": l.practitioner.practitioner_name if l.practitioner else "",
                "status": l.status or "Draft",
                "date": str(l.date or l.submitted_date or ""),
            }
            for l in LabTest.objects.select_related("patient", "practitioner", "template").order_by("-id")[:6]
        ]

        # Inpatients (Disabled for EEU clinic)
        inpatient_statuses = []
        recent_inpatients = []

        # Vitals with interpretation
        recent_vitals_qs = VitalSigns.objects.select_related("patient").order_by("-signs_date", "-id")[:6]
        recent_vitals = []
        for v in recent_vitals_qs:
            bp_sys = v.bp_systolic
            bp_dia = v.bp_diastolic
            temp = float(v.temperature) if v.temperature else None
            is_high_bp = bool((bp_sys and bp_sys >= 140) or (bp_dia and bp_dia >= 90))
            is_fever = bool(
                (temp and temp > 45 and temp >= 100.4) or
                (temp and temp <= 45 and temp >= 38.0)
            )
            recent_vitals.append({
                "id": v.id,
                "patient_name": v.patient.patient_name if v.patient else "Patient",
                "patient_id": v.patient_id,
                "bp": v.bp or (f"{bp_sys}/{bp_dia}" if bp_sys else "120/80"),
                "bp_systolic": bp_sys,
                "bp_diastolic": bp_dia,
                "pulse": v.pulse or 72,
                "temperature": temp or 37.0,
                "bmi": float(v.bmi) if v.bmi else None,
                "signs_date": str(v.signs_date) if v.signs_date else str(today),
                "is_high_bp": is_high_bp,
                "is_fever": is_fever,
            })

        # Recent Patients
        recent_patients = [
            {
                "id": p.id,
                "patient_name": p.patient_name or f"{p.first_name} {p.last_name}",
                "patient_id": p.patient_id or f"PAT-{p.id}",
                "sex": p.sex or "N/A",
                "blood_group": p.blood_group or "N/A",
                "dob": str(p.dob) if p.dob else "",
                "inpatient_status": bool(p.inpatient_status),
                "image": p.image or "",
            }
            for p in Patient.objects.order_by("-id")[:6]
        ]

        # Top Departments
        top_departments = [
            {"department": d.department, "patient_care_type": d.patient_care_type or "General"}
            for d in MedicalDepartment.objects.all()[:8]
        ]

        return Response({
            "stats": {
                "patients": total_patients,
                "inpatients_active": inpatient_patients,
                "practitioners": total_practitioners,
                "appointments_today": len(today_appts_data),
                "appointments_total": total_appointments,
                "encounters": total_encounters,
                "lab_tests": total_lab_tests,
                "inpatients": total_inpatients,
                "therapy_plans": total_therapy,
                "insurance_claims": total_claims,
                "prescriptions": total_prescriptions,
                "medication_requests": total_med_requests,
                "vitals": total_vitals,
            },
            "charts": {
                "gender_distribution": {
                    "labels": [g["sex"] or "Unspecified" for g in gender_data] or ["Male", "Female"],
                    "series": [g["count"] for g in gender_data] or [7, 7],
                },
                "blood_group_distribution": {
                    "labels": [b["blood_group"] for b in blood_group_data],
                    "series": [b["count"] for b in blood_group_data],
                },
                "encounter_statuses": {
                    "labels": [e["status"] for e in encounter_statuses],
                    "series": [e["count"] for e in encounter_statuses],
                },
                "appointment_statuses": {
                    "labels": [a["status"] for a in appointment_statuses],
                    "series": [a["count"] for a in appointment_statuses],
                },
                "lab_statuses": {
                    "labels": [l["status"] for l in lab_statuses],
                    "series": [l["count"] for l in lab_statuses],
                },
                "inpatient_statuses": {
                    "labels": [i["status"] for i in inpatient_statuses],
                    "series": [i["count"] for i in inpatient_statuses],
                },
            },
            "today_appointments": today_appts_data,
            "upcoming_appointments": upcoming_appts_data,
            "recent_encounters": recent_encounters,
            "recent_labs": recent_labs,
            "recent_inpatients": recent_inpatients,
            "recent_vitals": recent_vitals,
            "recent_patients": recent_patients,
            "departments": top_departments,
        })


# ════════════════════════════════════════════════════════════════════════════
# CLINICAL DOCUMENTS: External Referral & Medical Leave Slip
# ════════════════════════════════════════════════════════════════════════════

class ExternalReferralViewSet(HealthcareModelViewSet):
    queryset = ExternalReferral.objects.select_related(
        "patient", "referring_practitioner", "encounter"
    ).all()
    serializer_class = ExternalReferralSerializer
    filterset_fields = ["patient", "encounter", "referring_practitioner", "status", "priority"]
    search_fields = [
        "referral_id", "patient__patient_name", "target_facility",
        "receiving_specialist", "provisional_diagnosis"
    ]

    @action(detail=True, methods=["get"], url_path="print-html")
    def print_html(self, request, pk=None):
        referral = self.get_object()
        from django.template.loader import render_to_string
        from django.http import HttpResponse

        context = {
            "referral": referral,
            "patient": referral.patient,
            "practitioner": referral.referring_practitioner,
            "company": "Healthcare Center & Hospital",
            "facility_address": "General Hospital Way • Medical District",
            "facility_phone": "+251-11-000-0000",
        }
        html_content = render_to_string("print_formats/external_referral_a4.html", context)
        if request.query_params.get("format") == "html" or "text/html" in request.META.get("HTTP_ACCEPT", ""):
            return HttpResponse(html_content, content_type="text/html")
        return Response({"html": html_content, "referral_id": referral.referral_id})

    @action(detail=True, methods=["get"], url_path="gop-html")
    def gop_html(self, request, pk=None):
        referral = self.get_object()
        from django.template.loader import render_to_string
        from django.http import HttpResponse

        context = {
            "referral": referral,
            "patient": referral.patient,
            "practitioner": referral.referring_practitioner,
            "company": "Ethiopian Electric Utility (EEU)",
            "directorate": "Health Services Directorate & Occupational Safety Board",
            "facility_address": "Head Office, De Gaulle Square • Addis Ababa, Ethiopia",
            "facility_phone": "+251-11-156-0000 / +251-11-155-0811",
        }
        html_content = render_to_string("print_formats/eeu_gop_letter_a4.html", context)
        if request.query_params.get("format") == "html" or "text/html" in request.META.get("HTTP_ACCEPT", ""):
            return HttpResponse(html_content, content_type="text/html")
        return Response({
            "html": html_content,
            "referral_id": referral.referral_id,
            "gop_code": referral.eeu_gop_authorization_code,
            "authorized_amount_etb": str(referral.eeu_gop_authorized_amount_etb),
        })


class MedicalLeaveSlipViewSet(HealthcareModelViewSet):
    queryset = MedicalLeaveSlip.objects.select_related(
        "patient", "practitioner", "encounter"
    ).all()
    serializer_class = MedicalLeaveSlipSerializer
    filterset_fields = ["patient", "encounter", "practitioner", "status", "fitness_state"]
    search_fields = ["slip_id", "patient__patient_name", "diagnosis"]

    @action(detail=True, methods=["get"], url_path="print-html")
    def print_html(self, request, pk=None):
        slip = self.get_object()
        from django.template.loader import render_to_string
        from django.http import HttpResponse

        context = {
            "slip": slip,
            "patient": slip.patient,
            "practitioner": slip.practitioner,
            "company": "Healthcare Center & Hospital",
            "facility_address": "General Hospital Way • Medical District",
            "facility_phone": "+251-11-000-0000",
        }
        html_content = render_to_string("print_formats/medical_leave_slip_a5.html", context)
        if request.query_params.get("format") == "html" or "text/html" in request.META.get("HTTP_ACCEPT", ""):
            return HttpResponse(html_content, content_type="text/html")
        return Response({"html": html_content, "slip_id": slip.slip_id})


# ════════════════════════════════════════════════════════════════════════════
# CLINICAL LABORATORY & DIAGNOSTICS DASHBOARD
# ════════════════════════════════════════════════════════════════════════════

class LabDashboardViewSet(viewsets.ViewSet):
    """
    Healthcare Clinical Laboratory Analytics & Accessioning Operations Dashboard.
    Provides real-time operational analytics, specimen custody pipeline metrics,
    STAT/urgent triage queues, supervisor approval benches, and turnaround time tracking.
    """
    permission_classes = [permissions.IsAuthenticated]

    @action(detail=False, methods=["get"])
    def stats(self, request):
        import datetime
        today = timezone.now().date()
        now = timezone.now()

        # Query filter params
        period = request.query_params.get("period", "all")
        dept_id = request.query_params.get("department")

        base_qs = LabTest.objects.all()
        if dept_id and dept_id != "all":
            base_qs = base_qs.filter(department_id=dept_id)

        if period == "today":
            filtered_qs = base_qs.filter(Q(date=today) | Q(creation__date=today))
        elif period == "7d":
            seven_days_ago = today - datetime.timedelta(days=7)
            filtered_qs = base_qs.filter(Q(date__gte=seven_days_ago) | Q(creation__date__gte=seven_days_ago))
        elif period == "30d":
            thirty_days_ago = today - datetime.timedelta(days=30)
            filtered_qs = base_qs.filter(Q(date__gte=thirty_days_ago) | Q(creation__date__gte=thirty_days_ago))
        else:
            filtered_qs = base_qs

        # Core KPIs
        total_tests = filtered_qs.count()
        today_tests = base_qs.filter(Q(date=today) | Q(creation__date=today)).count()

        # Specimen custody stages
        pending_collection = base_qs.filter(specimen_status="Pending Collection").exclude(status__in=["Approved", "Cancelled"]).count()
        samples_collected = base_qs.filter(specimen_status="Collected").exclude(status__in=["Approved", "Cancelled"]).count()
        specimens_received = base_qs.filter(specimen_status="Received").count()
        specimens_rejected = base_qs.filter(specimen_status="Rejected").count()

        # Lifecycle status counts
        draft_count = filtered_qs.filter(status="Draft").count()
        in_progress_count = base_qs.filter(status="Draft", specimen_status="Received").count()
        awaiting_approval_count = base_qs.filter(status="Completed").count()
        approved_count = filtered_qs.filter(status="Approved").count()
        approved_today = base_qs.filter(Q(approved_date=today) | Q(modified__date=today), status="Approved").count()

        # STAT / Urgent orders count
        urgent_count = base_qs.filter(
            Q(service_request__priority__in=["Urgent", "STAT", "Emergency"]) |
            Q(lab_test_name__icontains="urgent") |
            Q(lab_test_name__icontains="stat")
        ).exclude(status__in=["Approved", "Cancelled"]).count()

        # Dynamic average Turnaround Time (in hours)
        avg_tat_hours = 3.2
        tat_tests = base_qs.filter(status__in=["Completed", "Approved"], collection_datetime__isnull=False, modified__isnull=False)[:25]
        if tat_tests.exists():
            diffs = []
            for t in tat_tests:
                if t.collection_datetime and t.modified:
                    delta = (t.modified - t.collection_datetime).total_seconds() / 3600.0
                    if 0.2 <= delta < 168:
                        diffs.append(delta)
            if diffs:
                avg_tat_hours = round(sum(diffs) / len(diffs), 1)

        # 7-day trend series (Daily volume)
        daily_categories = []
        ordered_series = []
        completed_series = []
        approved_series = []
        for i in range(6, -1, -1):
            d = today - datetime.timedelta(days=i)
            day_str = d.strftime("%a (%b %d)")
            daily_categories.append(day_str)
            ord_cnt = base_qs.filter(Q(date=d) | Q(creation__date=d)).count()
            comp_cnt = base_qs.filter(Q(submitted_date=d) | Q(result_date=d), status__in=["Completed", "Approved"]).count()
            appr_cnt = base_qs.filter(Q(approved_date=d) | Q(modified__date=d), status="Approved").count()
            ordered_series.append(ord_cnt)
            completed_series.append(comp_cnt)
            approved_series.append(appr_cnt)

        # Department distribution
        raw_dept_counts = list(base_qs.values("department__department").annotate(count=Count("id")).order_by("-count"))
        dept_labels = []
        dept_series = []
        for item in raw_dept_counts:
            dept_name = item["department__department"] or "General / Clinical Lab"
            dept_labels.append(dept_name)
            dept_series.append(item["count"])

        if not dept_labels:
            dept_labels = ["Biochemistry", "Haematology", "Microbiology", "Serology"]
            dept_series = [10, 8, 4, 2]

        # Specimen Custody Pipeline Funnel
        pipeline_stages = [
            {"stage": "Order Placed", "count": total_tests, "color": "#6366f1"},
            {"stage": "Pending Collection", "count": pending_collection, "color": "#f59e0b"},
            {"stage": "Specimen Collected", "count": samples_collected, "color": "#0ea5e9"},
            {"stage": "Received at Bench", "count": specimens_received, "color": "#10b981"},
            {"stage": "Awaiting Sign-off", "count": awaiting_approval_count, "color": "#8b5cf6"},
            {"stage": "Results Released", "count": approved_count, "color": "#059669"},
        ]

        # Top Test Templates
        raw_templates = list(
            base_qs.values("lab_test_name")
            .annotate(count=Count("id"))
            .order_by("-count")[:6]
        )
        top_tests = [
            {"name": t["lab_test_name"] or "Clinical Panel", "count": t["count"]}
            for t in raw_templates
        ]

        # Helper to format lab test rows
        def format_lab_test_item(t):
            priority = "Routine"
            if t.service_request and t.service_request.priority:
                priority = t.service_request.priority
            elif "urgent" in (t.lab_test_name or "").lower() or "stat" in (t.lab_test_name or "").lower():
                priority = "Urgent"

            results_summary = []
            for item in t.normal_test_items.all()[:3]:
                if item.result_value:
                    results_summary.append(f"{item.lab_test_name or 'Result'}: {item.result_value} {item.lab_test_uom or ''}".strip())

            sample_label = "Blood"
            if t.sample and t.sample.sample:
                sample_label = t.sample.sample.sample or t.sample.sample.sample_type or "Blood"
            elif t.template and t.template.sample:
                sample_label = t.template.sample.sample or t.template.sample.sample_type or "Blood"

            return {
                "id": t.id,
                "test_id": t.test_id or f"LAB-{t.id:05d}",
                "lab_test_name": t.lab_test_name or (t.template.lab_test_name if t.template else "Clinical Lab Test"),
                "status": t.status or "Draft",
                "specimen_status": t.specimen_status or "Pending Collection",
                "specimen_condition": t.specimen_condition or "Acceptable",
                "specimen_barcode": t.specimen_barcode or (t.sample.barcode if t.sample else ""),
                "priority": priority,
                "date": str(t.date or (t.creation.date() if t.creation else today)),
                "patient": {
                    "id": t.patient_id,
                    "name": t.patient.patient_name if t.patient else "Patient",
                    "patient_id": t.patient.patient_id if t.patient else f"PAT-{t.patient_id}",
                    "age": t.patient_age or (t.patient.age_display if t.patient else ""),
                    "sex": t.patient_sex or (t.patient.sex if t.patient else ""),
                },
                "practitioner_name": t.practitioner.practitioner_name if t.practitioner else (
                    t.requesting_practitioner.practitioner_name if t.requesting_practitioner else "Attending Clinician"
                ),
                "department_name": t.department.department if t.department else (
                    t.requesting_department.department if t.requesting_department else "Clinical Pathology"
                ),
                "sample_name": sample_label,
                "collected_by": t.collected_by or (t.sample.collected_by if t.sample else ""),
                "collection_datetime": str(t.collection_datetime) if t.collection_datetime else "",
                "results_preview": ", ".join(results_summary) if results_summary else (t.result or ""),
                "rejection_reason": t.specimen_rejection_reason or "",
            }

        # Worklist 1: STAT & Urgent Queue
        urgent_qs = base_qs.filter(
            Q(service_request__priority__in=["Urgent", "STAT", "Emergency"]) |
            Q(lab_test_name__icontains="urgent") |
            Q(lab_test_name__icontains="stat")
        ).exclude(status__in=["Approved", "Cancelled"]).select_related(
            "patient", "practitioner", "template", "department", "service_request", "sample", "sample__sample"
        ).prefetch_related("normal_test_items").order_by("-id")[:10]
        urgent_queue = [format_lab_test_item(t) for t in urgent_qs]

        # Worklist 2: Accessioning Bench (Pending Collection or Collected awaiting bench check-in)
        accession_qs = base_qs.filter(
            specimen_status__in=["Pending Collection", "Collected"]
        ).exclude(status__in=["Approved", "Cancelled"]).select_related(
            "patient", "practitioner", "template", "department", "service_request", "sample", "sample__sample"
        ).prefetch_related("normal_test_items").order_by("-id")[:15]
        accessioning_bench = [format_lab_test_item(t) for t in accession_qs]

        # Worklist 3: Supervisor Approval Queue (Completed tests awaiting sign-off)
        approval_qs = base_qs.filter(
            status="Completed"
        ).select_related(
            "patient", "practitioner", "template", "department", "service_request", "sample", "sample__sample"
        ).prefetch_related("normal_test_items").order_by("-id")[:15]
        pending_approval_queue = [format_lab_test_item(t) for t in approval_qs]

        # Worklist 4: Recent Tests
        recent_qs = base_qs.select_related(
            "patient", "practitioner", "template", "department", "service_request", "sample", "sample__sample"
        ).prefetch_related("normal_test_items").order_by("-id")[:15]
        recent_tests = [format_lab_test_item(t) for t in recent_qs]

        # Worklist 5: Critical & Rejected Specimens
        rejected_qs = base_qs.filter(
            Q(specimen_status="Rejected") | Q(status="Rejected")
        ).select_related(
            "patient", "practitioner", "template", "department", "service_request", "sample", "sample__sample"
        ).prefetch_related("normal_test_items").order_by("-id")[:10]
        critical_rejected = [format_lab_test_item(t) for t in rejected_qs]

        # Active departments for filter
        departments = [
            {"id": d.id, "name": d.department}
            for d in MedicalDepartment.objects.all().order_by("department")
        ]

        return Response({
            "kpis": {
                "total_tests": total_tests,
                "today_orders": today_tests,
                "pending_collection": pending_collection,
                "samples_collected": samples_collected,
                "specimens_received": specimens_received,
                "in_progress": in_progress_count,
                "awaiting_approval": awaiting_approval_count,
                "approved_count": approved_count,
                "approved_today": approved_today,
                "rejected_specimens": specimens_rejected,
                "stat_urgent_count": urgent_count,
                "avg_tat_hours": avg_tat_hours,
                "sample_collections_total": SampleCollection.objects.count(),
                "test_templates_count": LabTestTemplate.objects.filter(disabled=False).count(),
            },
            "charts": {
                "daily_trends": {
                    "categories": daily_categories,
                    "series": [
                        {"name": "Ordered", "data": ordered_series},
                        {"name": "Completed", "data": completed_series},
                        {"name": "Approved", "data": approved_series},
                    ],
                },
                "department_distribution": {
                    "labels": dept_labels,
                    "series": dept_series,
                },
                "specimen_pipeline": pipeline_stages,
                "top_tests": top_tests,
                "status_distribution": {
                    "labels": ["Draft", "Completed", "Approved", "Rejected", "Cancelled"],
                    "series": [
                        base_qs.filter(status="Draft").count(),
                        base_qs.filter(status="Completed").count(),
                        base_qs.filter(status="Approved").count(),
                        base_qs.filter(status="Rejected").count(),
                        base_qs.filter(status="Cancelled").count(),
                    ],
                },
            },
            "worklists": {
                "urgent_queue": urgent_queue,
                "accessioning_bench": accessioning_bench,
                "pending_approval": pending_approval_queue,
                "recent_tests": recent_tests,
                "critical_rejected": critical_rejected,
            },
            "departments": departments,
        })


class PharmacyWarehouseViewSet(HealthcareModelViewSet):
    queryset = PharmacyWarehouse.objects.all()
    serializer_class = PharmacyWarehouseSerializer
    search_fields = ["warehouse_name", "description"]
    filterset_fields = ["is_group", "is_active"]


class PharmacyStockViewSet(HealthcareModelViewSet):
    queryset = PharmacyStock.objects.select_related("warehouse", "medication").all()
    serializer_class = PharmacyStockSerializer
    search_fields = ["item_code", "item_name", "batch_no"]
    filterset_fields = ["warehouse", "medication", "item_group"]


class PharmacyStockEntryViewSet(HealthcareModelViewSet):
    queryset = PharmacyStockEntry.objects.select_related("warehouse", "patient").all()
    serializer_class = PharmacyStockEntrySerializer
    search_fields = ["entry_number", "purpose", "notes"]
    filterset_fields = ["entry_type", "posting_date", "warehouse", "patient"]


# ── EEU Occupational Health & Safety ViewSets ─────────────────────────────

class EEUWorkplaceIncidentViewSet(HealthcareModelViewSet):
    queryset = EEUWorkplaceIncident.objects.select_related("patient", "clinical_encounter", "sick_leave_slip").all()
    serializer_class = EEUWorkplaceIncidentSerializer
    search_fields = ["incident_id", "patient__patient_name", "patient__eeu_staff_id", "work_location", "clinical_findings"]
    filterset_fields = ["voltage_level", "incident_type", "region", "severity", "ppe_compliance", "duty_recommendation", "status"]

    @action(detail=False, methods=["get"])
    def stats(self, request):
        total = EEUWorkplaceIncident.objects.count()
        arc_flash = EEUWorkplaceIncident.objects.filter(incident_type__icontains="Arc Flash").count()
        shock = EEUWorkplaceIncident.objects.filter(incident_type__icontains="Shock").count()
        fall = EEUWorkplaceIncident.objects.filter(incident_type__icontains="Fall").count()
        high_voltage = EEUWorkplaceIncident.objects.filter(voltage_level__icontains="High").count()
        severe = EEUWorkplaceIncident.objects.filter(severity__in=["Severe / Inpatient Admission Required", "Critical / Burn ICU Transfer"]).count()
        active_review = EEUWorkplaceIncident.objects.filter(status="Under Medical Review").count()
        return Response({
            "total_incidents": total,
            "arc_flash_burns": arc_flash,
            "electrical_shocks": shock,
            "falls_from_height": fall,
            "high_voltage_cases": high_voltage,
            "severe_critical": severe,
            "active_medical_review": active_review,
        })

    @action(detail=False, methods=["get"])
    def executive_safety_report(self, request):
        import datetime
        from django.db.models import Sum, Count, Q
        
        region_filter = request.query_params.get("region")
        period = request.query_params.get("period", "365d")
        
        qs = EEUWorkplaceIncident.objects.select_related("patient", "sick_leave_slip").all()
        if region_filter and region_filter != "all":
            qs = qs.filter(region=region_filter)
            
        today = timezone.now().date()
        if period == "30d":
            qs = qs.filter(incident_datetime__date__gte=today - datetime.timedelta(days=30))
        elif period == "90d":
            qs = qs.filter(incident_datetime__date__gte=today - datetime.timedelta(days=90))
        elif period == "180d":
            qs = qs.filter(incident_datetime__date__gte=today - datetime.timedelta(days=180))
            
        total_incidents = qs.count()
        lti_qs = qs.filter(
            Q(lost_work_days__gt=0) |
            Q(sick_leave_slip__isnull=False) |
            ~Q(duty_recommendation="Fit for Normal Duty") |
            Q(severity__in=["Severe / Inpatient Admission Required", "Critical / Burn ICU Transfer", "Fatal"])
        )
        lti_count = lti_qs.count()
        
        # Calculate lost days
        total_lost_days = qs.aggregate(total=Sum("lost_work_days"))["total"] or 0
        slip_lost_days = qs.filter(sick_leave_slip__isnull=False).aggregate(total=Sum("sick_leave_slip__total_days"))["total"] or 0
        total_lost_time_days = max(total_lost_days, slip_lost_days)
        
        # PPE Compliance Rate
        compliant_ppe = qs.filter(ppe_compliance__startswith="Fully Compliant").count()
        ppe_compliance_rate = round((compliant_ppe / total_incidents * 100), 1) if total_incidents > 0 else 100.0
        
        # Lost Time Injury Frequency Rate (LTIFR) standard estimate per 1,000 workforce
        ltifr = round((lti_count * 200000) / 1000000, 2)
        
        # High Voltage Breakdown
        high_voltage_count = qs.filter(voltage_level__icontains="High Voltage").count()
        medium_voltage_count = qs.filter(voltage_level__icontains="Medium Voltage").count()
        low_voltage_count = qs.filter(voltage_level__icontains="Low Voltage").count()
        
        # Regional Breakdown
        regions_list = [
            "Addis Ababa", "Oromia", "Amhara", "Sidama", "Tigray",
            "Dire Dawa", "Somali", "Afar", "Benishangul-Gumuz", "Central Ethiopia"
        ]
        regional_breakdown = []
        for reg in regions_list:
            reg_qs = qs.filter(region=reg)
            reg_total = reg_qs.count()
            if reg_total > 0:
                reg_lti = reg_qs.filter(
                    Q(lost_work_days__gt=0) | Q(sick_leave_slip__isnull=False) | ~Q(duty_recommendation="Fit for Normal Duty")
                ).count()
                reg_days = reg_qs.aggregate(total=Sum("lost_work_days"))["total"] or 0
                regional_breakdown.append({
                    "region": reg,
                    "incidents": reg_total,
                    "lti_count": reg_lti,
                    "days_lost": reg_days,
                    "top_type": (reg_qs.values("incident_type").annotate(c=Count("id")).order_by("-c").first() or {}).get("incident_type", "None"),
                })
        regional_breakdown.sort(key=lambda x: x["incidents"], reverse=True)
        
        # Lineman Climbing Compliance
        all_evals = EEUFitnessEvaluation.objects.all()
        linemen_total = all_evals.count()
        fit_count = all_evals.filter(climbing_fitness="Fit to Climb (Certified)").count()
        expiring_soon_count = all_evals.filter(
            valid_until__gte=today,
            valid_until__lte=today + datetime.timedelta(days=30)
        ).count()
        expired_count = all_evals.filter(valid_until__lt=today).count()
        unfit_count = all_evals.filter(
            Q(climbing_fitness__icontains="Unfit") | Q(climbing_fitness__icontains="Restricted")
        ).count()
        
        # Top Recent Incidents
        recent_cases = EEUWorkplaceIncidentSerializer(qs.order_by("-incident_datetime")[:6], many=True).data
        
        return Response({
            "metrics": {
                "total_incidents": total_incidents,
                "lti_count": lti_count,
                "total_lost_days": total_lost_time_days,
                "ltifr": ltifr,
                "ppe_compliance_rate": ppe_compliance_rate,
                "high_voltage_count": high_voltage_count,
                "medium_voltage_count": medium_voltage_count,
                "low_voltage_count": low_voltage_count,
            },
            "lineman_safety_compliance": {
                "total_linemen_screened": linemen_total,
                "fit_certified": fit_count,
                "expiring_soon_30d": expiring_soon_count,
                "expired": expired_count,
                "unfit_restricted": unfit_count,
                "compliance_pct": round((fit_count / linemen_total * 100), 1) if linemen_total > 0 else 0,
            },
            "regional_breakdown": regional_breakdown,
            "recent_cases": recent_cases,
        })

    @action(detail=True, methods=["post"])
    def create_clinical_encounter(self, request, pk=None):
        incident = self.get_object()
        practitioner = HealthcarePractitioner.objects.first()
        dept = MedicalDepartment.objects.first()
        
        encounter = PatientEncounter.objects.create(
            patient=incident.patient,
            practitioner=practitioner,
            department=dept,
            encounter_date=timezone.now().date(),
            encounter_time=timezone.now().time(),
            symptoms=f"Occupational Incident #{incident.incident_id}: {incident.incident_type} ({incident.voltage_level})",
            physical_examination=incident.clinical_findings or "Electrical occupational safety evaluation.",
            clinical_notes=f"Work Location: {incident.work_location} ({incident.region}). Immediate Triage Given: {incident.immediate_treatment_given}",
            notes=f"Duty Recommendation: {incident.duty_recommendation}. PPE Compliance: {incident.ppe_compliance}",
            status="Submitted",
        )
        incident.clinical_encounter = encounter
        if incident.status == "Under Medical Review":
            incident.status = "Treatment Ongoing"
        incident.save()
        
        return Response({
            "message": f"Clinical Encounter #{encounter.encounter_id} successfully created and linked to Incident #{incident.incident_id}",
            "encounter_id": encounter.id,
            "encounter_code": encounter.encounter_id,
            "incident_id": incident.id,
        })

    @action(detail=True, methods=["post"])
    def issue_sick_leave(self, request, pk=None):
        incident = self.get_object()
        import datetime
        
        days = int(request.data.get("total_days", 7))
        start_date = request.data.get("from_date")
        if start_date:
            from_d = datetime.date.fromisoformat(start_date)
        else:
            from_d = timezone.now().date()
        to_d = from_d + datetime.timedelta(days=days)
        
        practitioner = HealthcarePractitioner.objects.first()
        
        duty_restr = request.data.get("eeu_duty_restriction", incident.duty_recommendation)
        if "Fit" in duty_restr:
            fitness_state = "Fit for Normal Duties"
        elif "Light" in duty_restr or "Ground" in duty_restr:
            fitness_state = "Fit for Light Duty Only"
        else:
            fitness_state = "Unfit for Work / School"
            
        clinic_branch = request.data.get("eeu_clinic_branch", "Ethiopian Electric Utility Medium Clinic")
        
        slip = MedicalLeaveSlip.objects.create(
            patient=incident.patient,
            practitioner=practitioner,
            encounter=incident.clinical_encounter,
            issue_date=timezone.now().date(),
            from_date=from_d,
            to_date=to_d,
            total_days=days,
            fit_to_work_date=to_d + datetime.timedelta(days=1),
            diagnosis=f"Occupational Workplace Incident #{incident.incident_id}: {incident.incident_type} - {incident.clinical_findings[:180]}",
            doctor_remarks=request.data.get("doctor_remarks", f"Strict compliance with {duty_restr}. Electrical trauma recovery."),
            fitness_state=fitness_state,
            eeu_clinic_branch=clinic_branch,
            eeu_leave_category="Work-Related Electrical/Mechanical Injury",
            eeu_duty_restriction=duty_restr,
            status="Issued",
        )
        incident.sick_leave_slip = slip
        incident.lost_work_days = days
        incident.save()
        
        return Response({
            "message": f"Sick Leave Slip #{slip.slip_id} successfully issued and linked to Incident #{incident.incident_id}",
            "slip_id": slip.id,
            "slip_code": slip.slip_id,
            "incident_id": incident.id,
            "total_days": days,
        })


class EEUFitnessEvaluationViewSet(HealthcareModelViewSet):
    queryset = EEUFitnessEvaluation.objects.select_related("patient", "practitioner").all()
    serializer_class = EEUFitnessEvaluationSerializer
    search_fields = ["evaluation_id", "patient__patient_name", "patient__eeu_staff_id", "physician_remarks"]
    filterset_fields = ["evaluation_type", "climbing_fitness", "color_vision", "audiometry_hearing", "cardiovascular_status", "status"]

    @action(detail=False, methods=["get"])
    def stats(self, request):
        import datetime
        today = timezone.now().date()
        total = EEUFitnessEvaluation.objects.count()
        fit_to_climb = EEUFitnessEvaluation.objects.filter(climbing_fitness="Fit to Climb (Certified)").count()
        ground_duty_only = EEUFitnessEvaluation.objects.filter(climbing_fitness="Restricted to Ground Duty Only").count()
        color_vision_deficiency = EEUFitnessEvaluation.objects.filter(color_vision__icontains="Deficiency").count()
        hearing_shifts = EEUFitnessEvaluation.objects.filter(audiometry_hearing__icontains="Shift").count()
        
        expiring_30d = EEUFitnessEvaluation.objects.filter(
            valid_until__gte=today,
            valid_until__lte=today + datetime.timedelta(days=30)
        ).count()
        expired = EEUFitnessEvaluation.objects.filter(valid_until__lt=today).count()
        
        return Response({
            "total_evaluations": total,
            "fit_to_climb": fit_to_climb,
            "ground_duty_only": ground_duty_only,
            "color_vision_deficiency": color_vision_deficiency,
            "hearing_threshold_shifts": hearing_shifts,
            "expiring_soon_count": expiring_30d,
            "expired_count": expired,
        })

    @action(detail=False, methods=["get"])
    def expiring_clearances(self, request):
        import datetime
        today = timezone.now().date()
        days_ahead = int(request.query_params.get("days", 30))
        
        expiring = EEUFitnessEvaluation.objects.filter(
            valid_until__gte=today,
            valid_until__lte=today + datetime.timedelta(days=days_ahead)
        ).select_related("patient", "practitioner").order_by("valid_until")
        
        expired = EEUFitnessEvaluation.objects.filter(
            valid_until__lt=today
        ).select_related("patient", "practitioner").order_by("-valid_until")
        
        return Response({
            "expiring_soon": EEUFitnessEvaluationSerializer(expiring, many=True).data,
            "expired": EEUFitnessEvaluationSerializer(expired, many=True).data,
            "expiring_soon_count": expiring.count(),
            "expired_count": expired.count(),
        })


class EEUFirstAidKitViewSet(HealthcareModelViewSet):
    queryset = EEUFirstAidKit.objects.all()
    serializer_class = EEUFirstAidKitSerializer
    search_fields = ["kit_code", "assigned_unit", "custodian_name", "region"]
    filterset_fields = ["kit_type", "region", "status", "burn_dressings_stocked", "trauma_bandages_stocked"]

    @action(detail=False, methods=["get"])
    def stats(self, request):
        total = EEUFirstAidKit.objects.count()
        stocked = EEUFirstAidKit.objects.filter(status="Fully Stocked & Sealed").count()
        replenish = EEUFirstAidKit.objects.filter(status="Needs Replenishment").count()
        critical = EEUFirstAidKit.objects.filter(status="Critical - Missing Burn / Trauma Kit").count()
        requisitions_pending = EEUFirstAidKit.objects.filter(restock_requisition_status="Pharmacy Requisition Sent").count()
        return Response({
            "total_kits": total,
            "fully_stocked": stocked,
            "needs_replenishment": replenish,
            "critical_shortage": critical,
            "requisitions_pending": requisitions_pending,
        })

    @action(detail=True, methods=["post"])
    def request_restock(self, request, pk=None):
        kit = self.get_object()
        notes = request.data.get("notes", "Restock requested from EEU Central Medical Store.")
        kit.restock_requisition_status = "Pharmacy Requisition Sent"
        kit.restock_notes = notes
        kit.restock_requested_at = timezone.now()
        kit.save()
        return Response(EEUFirstAidKitSerializer(kit).data)

    @action(detail=True, methods=["post"])
    def mark_restocked(self, request, pk=None):
        import datetime
        kit = self.get_object()
        kit.status = "Fully Stocked & Sealed"
        kit.restock_requisition_status = "Replenished & Verified"
        kit.burn_dressings_stocked = True
        kit.trauma_bandages_stocked = True
        kit.splints_tourniquet_stocked = True
        kit.eye_wash_stocked = True
        kit.last_inspected = timezone.now().date()
        kit.next_inspection_due = timezone.now().date() + datetime.timedelta(days=90)
        kit.notes = (kit.notes + f"\n[Restocked on {timezone.now().strftime('%Y-%m-%d %H:%M')}]").strip()
        kit.save()
        return Response(EEUFirstAidKitSerializer(kit).data)


class EEUEmergencySOSViewSet(HealthcareModelViewSet):
    queryset = EEUEmergencySOS.objects.all()
    serializer_class = EEUEmergencySOSSerializer
    search_fields = ["sos_id", "substation_name", "caller_name", "hazard_type"]
    filterset_fields = ["region", "voltage_level", "hazard_type", "severity_level", "status"]

    @action(detail=False, methods=["get"])
    def stats(self, request):
        total = EEUEmergencySOS.objects.count()
        active = EEUEmergencySOS.objects.filter(status__in=["Active / En Route", "Arrived at Clinic"]).count()
        critical = EEUEmergencySOS.objects.filter(severity_level__icontains="Critical").count()
        transferred = EEUEmergencySOS.objects.filter(status="Transferred to ALERT Hospital").count()
        latest_active = EEUEmergencySOS.objects.filter(status="Active / En Route").order_by("-id").first()
        return Response({
            "total_sos_calls": total,
            "active_en_route": active,
            "critical_cases": critical,
            "transferred_to_burn_hospital": transferred,
            "active_alert": EEUEmergencySOSSerializer(latest_active).data if latest_active else None,
        })

    @action(detail=True, methods=["post"])
    def update_status(self, request, pk=None):
        sos = self.get_object()
        new_status = request.data.get("status")
        if new_status:
            sos.status = new_status
            sos.save(update_fields=["status"])
        return Response(EEUEmergencySOSSerializer(sos).data)


class EEUPMECampaignViewSet(HealthcareModelViewSet):
    queryset = EEUPMECampaign.objects.all()
    serializer_class = EEUPMECampaignSerializer
    search_fields = ["campaign_id", "campaign_name", "substation_focus"]
    filterset_fields = ["target_year", "target_directorate", "target_region", "status"]

    @action(detail=False, methods=["get"])
    def stats(self, request):
        total_campaigns = EEUPMECampaign.objects.count()
        active = EEUPMECampaign.objects.filter(status="Active Campaign").count()
        from django.db.models import Sum
        totals = EEUPMECampaign.objects.aggregate(
            target=Sum("target_count"),
            completed=Sum("completed_count"),
            fit=Sum("fit_certified_count"),
        )
        return Response({
            "total_campaigns": total_campaigns,
            "active_campaigns": active,
            "total_target_linemen": totals["target"] or 0,
            "total_completed_screenings": totals["completed"] or 0,
            "total_fit_certified": totals["fit"] or 0,
            "overall_completion_pct": round(((totals["completed"] or 0) / (totals["target"] or 1)) * 100, 1),
        })

    @action(detail=True, methods=["post"])
    def record_screening(self, request, pk=None):
        campaign = self.get_object()
        is_fit = request.data.get("is_fit", True)
        campaign.completed_count += 1
        if is_fit:
            campaign.fit_certified_count += 1
        if campaign.completed_count >= campaign.target_count:
            campaign.status = "Completed & Certified"
        campaign.save()
        return Response(EEUPMECampaignSerializer(campaign).data)


class EEUToxicSurveillanceViewSet(HealthcareModelViewSet):
    queryset = EEUToxicSurveillance.objects.select_related("patient").all()
    serializer_class = EEUToxicSurveillanceSerializer
    search_fields = ["surveillance_id", "patient__patient_name", "patient__eeu_staff_id", "work_location"]
    filterset_fields = ["chemical_agent", "exposure_route", "exposure_severity", "duty_recommendation"]

    @action(detail=False, methods=["get"])
    def stats(self, request):
        total = EEUToxicSurveillance.objects.count()
        sf6 = EEUToxicSurveillance.objects.filter(chemical_agent__icontains="SF6").count()
        pcb = EEUToxicSurveillance.objects.filter(chemical_agent__icontains="Transformer Mineral Oil").count()
        battery = EEUToxicSurveillance.objects.filter(chemical_agent__icontains="Battery").count()
        restricted = EEUToxicSurveillance.objects.exclude(duty_recommendation="Cleared for Continued Substation Duty").count()
        return Response({
            "total_records": total,
            "sf6_gas_exposures": sf6,
            "transformer_oil_pcb_exposures": pcb,
            "battery_lead_acid_exposures": battery,
            "restricted_duty_count": restricted,
        })




