"""
Healthcare Module Models - Based on Marley Healthcare Management System.

Module Structure:
═════════════════
1.  CORE / SETUP         - Patient, Practitioner, Department, ServiceUnit
2.  SCHEDULES            - PractitionerSchedule, PractitionerAvailability
3.  APPOINTMENTS         - PatientAppointment, AppointmentTypeConfig
4.  VITAL SIGNS          - VitalSigns (BP, Temp, Pulse, BMI)
5.  ENCOUNTERS           - PatientEncounter, Diagnosis, Symptom
6.  PRESCRIPTIONS        - DrugPrescription, MedicationRequest
7.  LAB & DIAGNOSTICS    - LabTest, Observation, ClinicalProcedure
8.  THERAPY              - TherapyPlan, TherapySession, Exercise
9.  INSURANCE            - InsurancePayor, Claims, Policies
10. INPATIENT            - InpatientRecord, Discharge, Emergency
11. NURSING              - NursingTask, NursingChecklistTemplate
12. MEDICATIONS          - Medication, DrugInteraction, Antibiotic
13. REFERENCE DATA       - DosageForm, BodyPart, SampleType, etc.
14. ASSESSMENTS          - PatientAssessment, ServiceRequest
15. DOCUMENT MANAGEMENT  - DocumentAssignment, Attachment, Tag
16. SETTINGS             - HealthcareSettings, FeeValidity
"""
from calendar import monthrange
from datetime import date

from decimal import Decimal
from django.conf import settings
from django.db import models
from django.utils import timezone
from apps.core.models import BaseModel


# ══════════════════════════════════════════════════════════════════════════════
# CORE / SETUP
# ══════════════════════════════════════════════════════════════════════════════

class MedicalDepartment(BaseModel):
    """Hospital departments: Cardiology, Neurology, etc."""
    department = models.CharField(max_length=140, unique=True)
    patient_care_type = models.CharField(max_length=50, blank=True, default="")
    show_in_portal = models.BooleanField(default=False)

    class Meta:
        db_table = "healthcare_department"
        ordering = ["department"]

    def __str__(self):
        return self.department


class HealthcareServiceUnitType(BaseModel):
    """Types of service units: Operation Theatre, Consultation Room, Ward, ICU."""
    service_unit_type = models.CharField(max_length=140, unique=True)
    description = models.TextField(blank=True, default="")
    parent_service_unit_type = models.ForeignKey(
        "self", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="children",
    )
    is_group = models.BooleanField(default=False)

    class Meta:
        db_table = "healthcare_service_unit_type"
        ordering = ["service_unit_type"]

    def __str__(self):
        return self.service_unit_type


class HealthcareServiceUnit(BaseModel):
    """Service units: rooms, beds, OTs, labs."""
    service_unit_name = models.CharField(max_length=140)
    service_unit_type = models.ForeignKey(
        HealthcareServiceUnitType, on_delete=models.SET_NULL, null=True, blank=True
    )
    department = models.ForeignKey(
        MedicalDepartment, on_delete=models.SET_NULL, null=True, blank=True
    )
    company = models.ForeignKey(
        "setup.Company", on_delete=models.SET_NULL, null=True, blank=True
    )
    parent_service_unit = models.ForeignKey(
        "self", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="child_units",
    )
    is_group = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    occupancy_status = models.CharField(
        max_length=30, default="Vacant",
        choices=[("Vacant", "Vacant"), ("Occupied", "Occupied"),
                 ("Partially Occupied", "Partially Occupied"), ("Housekeeping", "Housekeeping")],
    )
    max_capacity = models.IntegerField(default=1)
    current_occupancy = models.IntegerField(default=0)

    class Meta:
        db_table = "healthcare_service_unit"
        ordering = ["service_unit_name"]

    def __str__(self):
        return self.service_unit_name


# ══════════════════════════════════════════════════════════════════════════════
# PATIENT
# ══════════════════════════════════════════════════════════════════════════════

class Patient(BaseModel):
    """Patient record with demographics, medical history, and contact info."""
    patient_id = models.CharField(max_length=50, unique=True, blank=True)
    first_name = models.CharField(max_length=140)
    middle_name = models.CharField(max_length=140, blank=True, default="")
    last_name = models.CharField(max_length=140, blank=True, default="")
    patient_name = models.CharField(max_length=280, blank=True, default="")
    sex = models.CharField(
        max_length=20,
        choices=[("Male", "Male"), ("Female", "Female"), ("Other", "Other")],
    )
    blood_group = models.CharField(
        max_length=5, blank=True, default="",
        choices=[("A+", "A+"), ("A-", "A-"), ("B+", "B+"), ("B-", "B-"),
                 ("AB+", "AB+"), ("AB-", "AB-"), ("O+", "O+"), ("O-", "O-")],
    )
    dob = models.DateField(null=True, blank=True)
    age = models.IntegerField(null=True, blank=True)
    image = models.URLField(blank=True, default="")
    status = models.CharField(
        max_length=30, default="Active",
        choices=[("Active", "Active"), ("Disabled", "Disabled"), ("Archived", "Archived")],
    )
    uid = models.CharField(max_length=50, blank=True, default="")
    report_preference = models.CharField(
        max_length=20, blank=True, default="",
        choices=[("Email", "Email"), ("Print", "Print"), ("Pdf", "Pdf")],
    )
    mobile = models.CharField(max_length=20, blank=True, default="")
    phone = models.CharField(max_length=20, blank=True, default="")
    email = models.EmailField(blank=True, default="")
    address = models.TextField(blank=True, default="")
    city = models.CharField(max_length=100, blank=True, default="")
    state = models.CharField(max_length=100, blank=True, default="")
    country = models.CharField(max_length=100, blank=True, default="")
    pincode = models.CharField(max_length=20, blank=True, default="")

    # Customer/territory links
    customer = models.CharField(max_length=200, blank=True, default="")
    customer_group = models.CharField(max_length=140, blank=True, default="")
    territory = models.CharField(max_length=140, blank=True, default="")
    default_price_list = models.CharField(max_length=140, blank=True, default="")
    default_currency = models.ForeignKey(
        "setup.Currency", on_delete=models.SET_NULL, null=True, blank=True
    )
    language = models.CharField(max_length=20, blank=True, default="en")

    # Medical history
    occupation = models.CharField(max_length=140, blank=True, default="")
    marital_status = models.CharField(
        max_length=30, blank=True, default="",
        choices=[("Single", "Single"), ("Married", "Married"),
                 ("Divorced", "Divorced"), ("Widowed", "Widowed")],
    )
    allergies = models.TextField(blank=True, default="")
    medical_history = models.TextField(blank=True, default="")
    surgical_history = models.TextField(blank=True, default="")
    medication = models.TextField(blank=True, default="")
    risk_factors = models.TextField(blank=True, default="")
    patient_details = models.TextField(blank=True, default="")

    # Lifestyle
    tobacco_past_use = models.CharField(max_length=30, blank=True, default="")
    tobacco_current_use = models.CharField(max_length=30, blank=True, default="")
    alcohol_past_use = models.CharField(max_length=30, blank=True, default="")
    alcohol_current_use = models.CharField(max_length=30, blank=True, default="")
    surrounding_factors = models.TextField(blank=True, default="")
    # Enterprise & Occupational Details (EEU & EEP)
    company = models.ForeignKey(
        "setup.Company", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="patients",
        help_text="Employer Enterprise: Ethiopian Electric Utility (EEU) or Ethiopian Electric Power (EEP)"
    )
    COMPANY_AFFILIATION_CHOICES = [
        ("Ethiopian Electric Utility (EEU)", "Ethiopian Electric Utility (EEU)"),
        ("Ethiopian Electric Football club (EEFC)", "Ethiopian Electric Football club (EEFC)"),
        ("Retired Employee", "Retired Employee"),
        ("Others", "Others"),
    ]
    company_affiliation = models.CharField(
        max_length=120, default="Ethiopian Electric Utility (EEU)", blank=True,
        choices=COMPANY_AFFILIATION_CHOICES,
        help_text="Employer scheme: EEU, EEFC, Retired Employee, or Others"
    )
    # EEU / EEP Staff & Occupational Details
    eeu_staff_id = models.CharField(max_length=60, blank=True, default="", help_text="Staff/Payroll ID e.g. EEU-657854, EEP-765767, others-578879")
    eeu_department = models.CharField(max_length=140, blank=True, default="", help_text="Directorate / Department")
    eeu_region = models.CharField(max_length=100, blank=True, default="", help_text="Region / District / Branch / Project Site")
    eeu_work_station = models.CharField(max_length=140, blank=True, default="", help_text="Specific Substation / Line Depot / Dam / Office")
    eeu_cadre = models.CharField(max_length=100, blank=True, default="", help_text="Role / Cadre e.g. Lineman, Substation Electrician, Engineer, Dam Operator, Admin")
    eeu_beneficiary_type = models.CharField(
        max_length=30, blank=True, default="Staff",
        choices=[("Staff", "Staff"), ("Spouse", "Spouse"), ("Child", "Child"), ("Dependent Parent", "Dependent Parent")]
    )
    eeu_primary_staff_id = models.CharField(max_length=60, blank=True, default="", help_text="If dependent, Staff ID of primary employee")
    eeu_medical_coverage_status = models.CharField(
        max_length=30, blank=True, default="Active Coverage",
        choices=[("Active Coverage", "Active Coverage"), ("Exceeded Ceiling", "Exceeded Ceiling"), ("Suspended", "Suspended"), ("Special Approval", "Special Approval")]
    )
    eeu_climbing_fitness_status = models.CharField(
        max_length=40, blank=True, default="Not Applicable",
        choices=[("Fit to Climb", "Fit to Climb"), ("Restricted Ground Duty", "Restricted Ground Duty"), ("Temporarily Unfit", "Temporarily Unfit"), ("Pending Annual Assessment", "Pending Annual Assessment"), ("Not Applicable", "Not Applicable")]
    )
    eeu_annual_benefit_ceiling_etb = models.DecimalField(
        max_digits=12, decimal_places=2, default=25000.00,
        help_text="Annual medical scheme coverage ceiling per beneficiary in ETB"
    )
    eeu_benefit_used_etb = models.DecimalField(
        max_digits=12, decimal_places=2, default=0.00,
        help_text="Accumulated medical scheme benefits utilized in current fiscal year in ETB"
    )

    # Inpatient status
    inpatient_status = models.CharField(
        max_length=30, blank=True, default="",
        choices=[("Admission Scheduled", "Admission Scheduled"), ("Admitted", "Admitted"),
                 ("Discharge Scheduled", "Discharge Scheduled"), ("", "Not Inpatient")],
    )
    inpatient_record = models.ForeignKey(
        "InpatientRecord", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="current_patients",
    )
    emergency_record = models.ForeignKey(
        "EmergencyRecord", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="patients",
    )

    # User link
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True
    )

    class Meta:
        db_table = "healthcare_patient"
        ordering = ["last_name", "first_name"]

    def __str__(self):
        return self.patient_name or f"{self.first_name} {self.last_name}"

    @property
    def age_display(self):
        """
        Age in years: "35 Year(s)".

        Derived from `dob` when present (so it never goes stale), otherwise
        falls back to the stored `age` integer.
        """
        if not self.dob:
            return f"{self.age} Year(s)" if self.age else ""
        today = date.today()
        years = today.year - self.dob.year
        months = today.month - self.dob.month
        days = today.day - self.dob.day
        if days < 0:
            months -= 1
            # Days in the month preceding `today`.
            prev_month = today.month - 1 or 12
            prev_year = today.year if today.month > 1 else today.year - 1
            days += monthrange(prev_year, prev_month)[1]
        if months < 0:
            years -= 1
            months += 12
        return f"{years} Year(s)"

    @property
    def employer_code(self):
        affil = self.company_affiliation or ""
        if "EEFC" in affil or "Football" in affil:
            return "EEFC"
        if "Retired" in affil:
            return "RET"
        if "Other" in affil or "Contractor" in affil:
            return "others"
        return "EEU"

    def format_staff_id(self, raw_id):
        if not raw_id:
            return ""
        import re
        val = str(raw_id).strip()
        # Strip EMP or EMP-
        val = re.sub(r'^(EEU|EEFC|RET|others)-EMP-?', r'\1-', val, flags=re.I)
        val = re.sub(r'^EMP-?', '', val, flags=re.I)

        # If already starts with proper prefix, format prefix case correctly
        if re.match(r'^eeu-?', val, re.I):
            num = re.sub(r'^eeu-?', '', val, flags=re.I).strip()
            return f"EEU-{num}" if num else ""
        if re.match(r'^eefc-?', val, re.I):
            num = re.sub(r'^eefc-?', '', val, flags=re.I).strip()
            return f"EEFC-{num}" if num else ""
        if re.match(r'^(ret|retired)-?', val, re.I):
            num = re.sub(r'^(ret|retired)-?', '', val, flags=re.I).strip()
            return f"RET-{num}" if num else ""
        if re.match(r'^others?-?', val, re.I):
            num = re.sub(r'^others?-?', '', val, flags=re.I).strip()
            return f"others-{num}" if num else ""

        # Raw number without prefix - prepend according to company affiliation
        affil = self.company_affiliation or ""
        if "EEFC" in affil or "Football" in affil:
            return f"EEFC-{val}"
        elif "Retired" in affil:
            return f"RET-{val}"
        elif "Other" in affil or "Contractor" in affil:
            return f"others-{val}"
        else:
            return f"EEU-{val}"

    def save(self, *args, **kwargs):
        names = [self.first_name, self.middle_name, self.last_name]
        self.patient_name = " ".join(n.strip() for n in names if n and n.strip())
        if not self.patient_id:
            last = Patient.objects.order_by("-id").first()
            num = (last.id + 1) if last else 1
            self.patient_id = f"HLC-PAT-{num:05d}"
        if not self.company_affiliation or self.company_affiliation in ("Joint EEU / EEP Entity", "Ethiopian Electric Power (EEP)"):
            self.company_affiliation = "Ethiopian Electric Utility (EEU)"
        elif self.company_affiliation in ("Contractor / Other", "Construction / Contractor / Other"):
            self.company_affiliation = "Others"
        if self.eeu_staff_id:
            self.eeu_staff_id = self.format_staff_id(self.eeu_staff_id)
        if self.eeu_primary_staff_id:
            self.eeu_primary_staff_id = self.format_staff_id(self.eeu_primary_staff_id)
        if not self.company_id:
            try:
                from apps.setup.models import Company
                comp = Company.objects.filter(abbr="EEU").first() or Company.objects.first()
                if comp:
                    self.company = comp
            except Exception:
                pass
        super().save(*args, **kwargs)


# ══════════════════════════════════════════════════════════════════════════════
# PRACTITIONER
# ══════════════════════════════════════════════════════════════════════════════

class HealthcarePractitioner(BaseModel):
    """Doctors, nurses, specialists — the healthcare providers."""
    practitioner_id = models.CharField(max_length=50, unique=True, blank=True)
    first_name = models.CharField(max_length=140)
    middle_name = models.CharField(max_length=140, blank=True, default="")
    last_name = models.CharField(max_length=140)
    practitioner_name = models.CharField(max_length=280, blank=True, default="")
    gender = models.CharField(
        max_length=10, blank=True, default="",
        choices=[("Male", "Male"), ("Female", "Female"), ("Other", "Other")],
    )
    image = models.URLField(blank=True, default="")
    status = models.CharField(
        max_length=30, default="Active",
        choices=[("Active", "Active"), ("Disabled", "Disabled")],
    )
    practitioner_type = models.CharField(
        max_length=30, default="Internal",
        choices=[("Internal", "Internal"), ("External", "External")],
    )
    department = models.ForeignKey(
        MedicalDepartment, on_delete=models.SET_NULL, null=True, blank=True
    )
    designation = models.CharField(max_length=140, blank=True, default="")
    eeu_staff_id = models.CharField(max_length=60, blank=True, default="", help_text="EEU Staff Employee ID")
    mobile_phone = models.CharField(max_length=20, blank=True, default="")
    residence_phone = models.CharField(max_length=20, blank=True, default="")
    office_phone = models.CharField(max_length=20, blank=True, default="")
    email = models.EmailField(blank=True, default="")
    address = models.TextField(blank=True, default="")

    # User link
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True
    )

    # Billing
    op_consulting_charge_item = models.CharField(max_length=140, blank=True, default="")
    op_consulting_charge = models.DecimalField(
        max_digits=12, decimal_places=2, default=0
    )
    inpatient_visit_charge_item = models.CharField(max_length=140, blank=True, default="")
    inpatient_visit_charge = models.DecimalField(
        max_digits=12, decimal_places=2, default=0
    )
    default_currency = models.ForeignKey(
        "setup.Currency", on_delete=models.SET_NULL, null=True, blank=True
    )

    # Free followups
    enable_free_follow_ups = models.BooleanField(default=False)
    max_visits = models.IntegerField(default=0)
    valid_days = models.IntegerField(default=0)

    class Meta:
        db_table = "healthcare_practitioner"
        ordering = ["last_name", "first_name"]

    def __str__(self):
        return self.practitioner_name or f"Dr. {self.first_name} {self.last_name}"

    def save(self, *args, **kwargs):
        self.practitioner_name = f"Dr. {self.first_name} {' ' + self.middle_name if self.middle_name else ''} {self.last_name}".strip()
        if not self.practitioner_id:
            last = HealthcarePractitioner.objects.order_by("-id").first()
            num = (last.id + 1) if last else 1
            self.practitioner_id = f"HLC-PRA-{num:05d}"
        super().save(*args, **kwargs)


class PractitionerSchedule(BaseModel):
    """Weekly schedule for practitioners."""
    practitioner = models.ForeignKey(
        HealthcarePractitioner, on_delete=models.CASCADE, related_name="schedules"
    )
    day = models.CharField(
        max_length=10,
        choices=[("Monday", "Monday"), ("Tuesday", "Tuesday"), ("Wednesday", "Wednesday"),
                 ("Thursday", "Thursday"), ("Friday", "Friday"), ("Saturday", "Saturday"),
                 ("Sunday", "Sunday")],
    )
    start_time = models.TimeField()
    end_time = models.TimeField()
    service_unit = models.ForeignKey(
        HealthcareServiceUnit, on_delete=models.SET_NULL, null=True, blank=True
    )
    max_appointments = models.IntegerField(default=20)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "healthcare_practitioner_schedule"
        ordering = ["practitioner", "day", "start_time"]

    def __str__(self):
        return f"{self.practitioner} - {self.day} {self.start_time}-{self.end_time}"


class PractitionerAvailability(BaseModel):
    """One-off availability overrides."""
    practitioner = models.ForeignKey(
        HealthcarePractitioner, on_delete=models.CASCADE
    )
    available_date = models.DateField()
    start_time = models.TimeField()
    end_time = models.TimeField()
    is_available = models.BooleanField(default=True)
    reason = models.CharField(max_length=200, blank=True, default="")
    service_unit = models.ForeignKey(
        HealthcareServiceUnit, on_delete=models.SET_NULL, null=True, blank=True
    )

    class Meta:
        db_table = "healthcare_practitioner_availability"
        ordering = ["available_date", "start_time"]

    def __str__(self):
        return f"{self.practitioner} - {self.available_date}"


# ══════════════════════════════════════════════════════════════════════════════
# APPOINTMENTS
# ══════════════════════════════════════════════════════════════════════════════

class PatientAppointment(BaseModel):
    """Patient appointments with practitioners — matches Marley PatientAppointment."""
    # Naming
    naming_series = models.CharField(max_length=50, default="HLC-APP-.YYYY.-", blank=True)
    appointment_id = models.CharField(max_length=50, unique=True, blank=True)
    title = models.CharField(max_length=280, blank=True, default="")

    # Status
    status = models.CharField(
        max_length=30, default="Scheduled",
        choices=[
            ("Scheduled", "Scheduled"), ("Open", "Open"), ("Confirmed", "Confirmed"),
            ("Checked In", "Checked In"), ("Checked Out", "Checked Out"),
            ("Closed", "Closed"), ("Cancelled", "Cancelled"), ("No Show", "No Show"),
        ],
    )

    # Type & Booking
    appointment_type = models.ForeignKey(
        "AppointmentTypeConfig", on_delete=models.SET_NULL, null=True, blank=True
    )
    appointment_for = models.CharField(
        max_length=30, default="Practitioner",
        choices=[("Practitioner", "Practitioner"), ("Department", "Department"), ("Service Unit", "Service Unit")],
    )
    company = models.ForeignKey(
        "setup.Company", on_delete=models.SET_NULL, null=True, blank=True
    )

    # Links
    patient = models.ForeignKey(
        Patient, on_delete=models.CASCADE, related_name="appointments"
    )
    patient_name = models.CharField(max_length=180, blank=True, default="")
    patient_sex = models.CharField(max_length=20, blank=True, default="")
    patient_age = models.CharField(max_length=30, blank=True, default="")
    practitioner = models.ForeignKey(
        HealthcarePractitioner, on_delete=models.SET_NULL, null=True, blank=True
    )
    practitioner_name = models.CharField(max_length=180, blank=True, default="")
    department = models.ForeignKey(
        MedicalDepartment, on_delete=models.SET_NULL, null=True, blank=True
    )
    service_unit = models.ForeignKey(
        HealthcareServiceUnit, on_delete=models.SET_NULL, null=True, blank=True
    )

    # Schedule
    appointment_date = models.DateField()
    appointment_time = models.TimeField(null=True, blank=True)
    appointment_datetime = models.DateTimeField(null=True, blank=True)
    appointment_end_datetime = models.DateTimeField(null=True, blank=True)
    duration = models.IntegerField(default=30, help_text="Duration in minutes")

    # Insurance
    insurance_policy = models.ForeignKey(
        "PatientInsurancePolicy", on_delete=models.SET_NULL, null=True, blank=True
    )
    insurance_payor = models.ForeignKey(
        "InsurancePayor", on_delete=models.SET_NULL, null=True, blank=True
    )
    insurance_coverage = models.ForeignKey(
        "PatientInsuranceCoverage", on_delete=models.SET_NULL, null=True, blank=True
    )
    coverage_status = models.CharField(max_length=50, blank=True, default="")

    # Source
    source = models.CharField(max_length=100, blank=True, default="")
    referring_practitioner = models.ForeignKey(
        HealthcarePractitioner, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="referring_appointments"
    )
    service_request = models.ForeignKey(
        "ServiceRequest", on_delete=models.SET_NULL, null=True, blank=True
    )

    # Procedure / Therapy references
    procedure_template = models.ForeignKey(
        "ClinicalProcedureTemplate", on_delete=models.SET_NULL, null=True, blank=True
    )
    procedure_prescription = models.ForeignKey(
        "ProcedurePrescription", on_delete=models.SET_NULL, null=True, blank=True
    )
    therapy_plan = models.ForeignKey(
        "TherapyPlan", on_delete=models.SET_NULL, null=True, blank=True
    )
    therapy_type = models.ForeignKey(
        "TherapyType", on_delete=models.SET_NULL, null=True, blank=True
    )
    template_dt = models.CharField(max_length=100, blank=True, default="")
    template_dn = models.CharField(max_length=180, blank=True, default="")

    # Video conferencing
    add_video_conferencing = models.BooleanField(default=False)
    google_meet_link = models.URLField(blank=True, default="")
    event = models.CharField(max_length=180, blank=True, default="")

    # Check-in
    appointment_based_on_check_in = models.BooleanField(default=False)
    position_in_queue = models.PositiveIntegerField(default=0)
    reminded = models.BooleanField(default=False)

    # Billing
    mode_of_payment = models.CharField(max_length=100, blank=True, default="")
    billing_item = models.CharField(max_length=140, blank=True, default="")
    paid_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    invoiced = models.BooleanField(default=False)
    ref_sales_invoice = models.CharField(max_length=100, blank=True, default="")

    # Notes
    notes = models.TextField(blank=True, default="")

    # Inpatient / Emergency links
    inpatient_record = models.ForeignKey(
        "InpatientRecord", on_delete=models.SET_NULL, null=True, blank=True
    )
    emergency_record = models.ForeignKey(
        "EmergencyRecord", on_delete=models.SET_NULL, null=True, blank=True
    )

    class Meta:
        db_table = "healthcare_patient_appointment"
        ordering = ["-appointment_date", "-appointment_time"]

    def __str__(self):
        return f"{self.patient} with {self.practitioner} on {self.appointment_date}"

    def save(self, *args, **kwargs):
        if not self.appointment_id:
            last = PatientAppointment.objects.order_by("-id").first()
            num = (last.id + 1) if last else 1
            self.appointment_id = f"HLC-APT-{num:05d}"
        if not self.title:
            self.title = f"{self.patient} - {self.appointment_date}"
        super().save(*args, **kwargs)


# ══════════════════════════════════════════════════════════════════════════════
# VITAL SIGNS
# ══════════════════════════════════════════════════════════════════════════════

class VitalSigns(BaseModel):
    """Patient vital signs: BP, temperature, pulse, etc. (Marley parity)."""
    naming_series = models.CharField(
        max_length=50, default="HLC-VTS-.YYYY.-", blank=True
    )
    title = models.CharField(max_length=200, blank=True, default="", db_index=True)
    patient = models.ForeignKey(
        Patient, on_delete=models.CASCADE, related_name="vital_signs"
    )
    inpatient_record = models.ForeignKey(
        "InpatientRecord", on_delete=models.SET_NULL, null=True, blank=True
    )
    appointment = models.ForeignKey(
        PatientAppointment, on_delete=models.SET_NULL, null=True, blank=True
    )
    encounter = models.ForeignKey(
        "PatientEncounter", on_delete=models.SET_NULL, null=True, blank=True
    )
    company = models.ForeignKey(
        "setup.Company", on_delete=models.SET_NULL, null=True, blank=True
    )
    signs_date = models.DateField()
    signs_time = models.TimeField(null=True, blank=True)

    # ── Vital Signs ─────────────────────────────────────────────────────
    temperature = models.DecimalField(
        max_digits=5, decimal_places=1, null=True, blank=True,
        help_text="Temperature in °F"
    )
    pulse = models.IntegerField(null=True, blank=True, help_text="Heart rate (bpm)")
    respiratory_rate = models.IntegerField(null=True, blank=True)
    tongue = models.CharField(
        max_length=50, blank=True, default="",
        choices=[("", ""), ("Coated", "Coated"), ("Very Coated", "Very Coated"),
                 ("Normal", "Normal"), ("Furry", "Furry"), ("Cuts", "Cuts")],
    )
    abdomen = models.CharField(
        max_length=50, blank=True, default="",
        choices=[("", ""), ("Normal", "Normal"), ("Bloated", "Bloated"),
                 ("Full", "Full"), ("Fluid", "Fluid"), ("Constipated", "Constipated")],
    )
    reflexes = models.CharField(
        max_length=50, blank=True, default="",
        choices=[("", ""), ("Normal", "Normal"), ("Hyper", "Hyper"),
                 ("Very Hyper", "Very Hyper"), ("One Sided", "One Sided")],
    )
    bp_systolic = models.IntegerField(null=True, blank=True, help_text="Systolic (mmHg)")
    bp_diastolic = models.IntegerField(null=True, blank=True, help_text="Diastolic (mmHg)")
    bp = models.CharField(
        max_length=30, blank=True, default="", help_text="Auto-computed"
    )
    vital_signs_note = models.TextField(blank=True, default="")

    # ── Nutrition Values ────────────────────────────────────────────────
    height = models.DecimalField(
        max_digits=5, decimal_places=1, null=True, blank=True, help_text="cm"
    )
    weight = models.DecimalField(
        max_digits=5, decimal_places=1, null=True, blank=True, help_text="kg"
    )
    bmi = models.DecimalField(
        max_digits=6, decimal_places=2, null=True, blank=True
    )
    nutrition_note = models.TextField(blank=True, default="")

    notes = models.TextField(blank=True, default="")  # legacy field kept for DB compat
    amended_from = models.ForeignKey(
        "self", on_delete=models.SET_NULL, null=True, blank=True
    )

    class Meta:
        db_table = "healthcare_vital_signs"
        ordering = ["-signs_date", "-signs_time"]

    def __str__(self):
        return f"VS: {self.patient} on {self.signs_date}"

    def save(self, *args, **kwargs):
        # Auto-compute BP
        if self.bp_systolic and self.bp_diastolic:
            self.bp = f"{self.bp_systolic}/{self.bp_diastolic} mmHg"
        # Auto-compute BMI
        if self.height and self.weight:
            h_m = float(self.height) / 100
            if h_m > 0:
                bmi_val = float(self.weight) / (h_m * h_m)
                self.bmi = round(bmi_val, 2)
                bmi_status = (
                    "Underweight" if bmi_val < 18.5
                    else "Normal" if bmi_val < 25
                    else "Overweight" if bmi_val < 30
                    else "Obese"
                )
                if not self.nutrition_note or self.nutrition_note in ["Underweight", "Normal", "Overweight", "Obese"]:
                    self.nutrition_note = bmi_status
        # Auto-set title
        if self.patient_id and not self.title:
            try:
                self.title = f"{self.patient.patient_name} - {self.signs_date}"
            except Exception:
                self.title = str(self.signs_date)
        super().save(*args, **kwargs)


# ══════════════════════════════════════════════════════════════════════════════
# ENCOUNTERS
# ══════════════════════════════════════════════════════════════════════════════

class PatientEncounter(BaseModel):
    """Patient encounter / visit record."""
    encounter_id = models.CharField(max_length=50, unique=True, blank=True)
    title = models.CharField(max_length=280, blank=True, default="")
    patient = models.ForeignKey(
        Patient, on_delete=models.CASCADE, related_name="encounters"
    )
    practitioner = models.ForeignKey(
        HealthcarePractitioner, on_delete=models.SET_NULL, null=True, blank=True
    )
    appointment = models.ForeignKey(
        PatientAppointment, on_delete=models.SET_NULL, null=True, blank=True
    )
    department = models.ForeignKey(
        MedicalDepartment, on_delete=models.SET_NULL, null=True, blank=True
    )
    appointment_type = models.ForeignKey(
        "AppointmentTypeConfig", on_delete=models.SET_NULL, null=True, blank=True
    )
    company = models.ForeignKey(
        "setup.Company", on_delete=models.SET_NULL, null=True, blank=True
    )
    source = models.CharField(
        max_length=30, blank=True, default="Direct",
        choices=[("Direct", "Direct"), ("Referral", "Referral"),
                 ("External Referral", "External Referral")],
    )
    status = models.CharField(
        max_length=30, default="Draft",
        choices=[("Draft", "Draft"), ("Submitted", "Submitted"),
                 ("Completed", "Completed"), ("Cancelled", "Cancelled")],
    )
    encounter_date = models.DateField()
    encounter_time = models.TimeField(null=True, blank=True)

    # Denormalised patient demographics, snapshotted at encounter time
    # (Marley stores patient_age on the encounter so it stays historically true).
    patient_age = models.CharField(max_length=20, blank=True, default="")

    # Clinical
    symptoms = models.TextField(blank=True, default="")
    physical_examination = models.TextField(blank=True, default="")
    clinical_notes = models.TextField(blank=True, default="")
    notes = models.TextField(blank=True, default="")
    # Marley's `encounter_comment` — the "Review Details" field.
    encounter_comment = models.TextField(blank=True, default="")
    is_confidential = models.BooleanField(
        default=False,
        help_text="True if encounter involves confidential/sensitive care (psychiatric, reproductive health, etc.)",
    )

    # Per-section "In print" flags shown against Symptoms / Diagnosis.
    symptoms_in_print = models.BooleanField(default=True)
    diagnosis_in_print = models.BooleanField(default=True)

    # Insurance
    insurance_policy = models.CharField(max_length=140, blank=True, default="")
    insurance_payor = models.CharField(max_length=140, blank=True, default="")

    # Inpatient
    inpatient_record = models.ForeignKey(
        "InpatientRecord", on_delete=models.SET_NULL, null=True, blank=True
    )
    invoiced = models.BooleanField(default=False)

    class Meta:
        db_table = "healthcare_patient_encounter"
        ordering = ["-encounter_date", "-encounter_time"]

    def __str__(self):
        return f"Encounter: {self.patient} on {self.encounter_date}"

    def save(self, *args, **kwargs):
        if not self.encounter_id:
            last = PatientEncounter.objects.order_by("-id").first()
            num = (last.id + 1) if last else 1
            self.encounter_id = f"HLC-ENC-{num:05d}"
        if not self.title:
            self.title = f"{self.patient} - {self.encounter_date}"
        # Snapshot the patient's age the way Marley's patient_age field does.
        if not self.patient_age and self.patient_id:
            self.patient_age = self.patient.age_display

        # Auto-detect sensitive/confidential keywords in clinical notes
        if not self.is_confidential:
            all_text = f"{self.symptoms} {self.physical_examination} {self.clinical_notes} {self.notes} {self.encounter_comment}".lower()
            sensitive_kw = [
                "hiv", "aids", "retrovir", "antiretroviral", "cd4 count", "viral load",
                "syphilis", "gonorrh", "chlamydia", "hepatitis b", "hepatitis c",
                "psychiatric", "depression", "bipolar", "schizophr", "suicid", "psychosis",
                "abortion", "termination of pregnancy"
            ]
            if any(kw in all_text for kw in sensitive_kw):
                self.is_confidential = True

        super().save(*args, **kwargs)


class DiagnosisCatalog(BaseModel):
    """
    Master list of diagnoses — Marley's `Diagnosis` doctype.

    In Marley the encounter's `Patient Encounter Diagnosis` child row is a Link
    to this catalog; the link stores the catalog entry's name. `Diagnosis`
    below mirrors that child row and keeps `diagnosis` as the denormalised
    catalog name so existing automations keep working.
    """
    diagnosis = models.CharField(max_length=280, unique=True)
    estimated_duration = models.CharField(max_length=50, blank=True, default="")
    description = models.TextField(blank=True, default="")

    class Meta:
        db_table = "healthcare_diagnosis_catalog"
        ordering = ["diagnosis"]

    def __str__(self):
        return self.diagnosis


class Diagnosis(BaseModel):
    """
    Diagnosis linked to an encounter — Marley's `Patient Encounter Diagnosis`.

    `diagnosis` holds the catalog name (denormalised, as Frappe does for Link
    fields) and stays the field automations read.
    """
    encounter = models.ForeignKey(
        PatientEncounter, on_delete=models.CASCADE, related_name="diagnoses"
    )
    diagnosis = models.CharField(max_length=280)
    diagnosis_master = models.ForeignKey(
        DiagnosisCatalog, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="encounter_diagnoses",
    )
    diagnosis_code = models.CharField(max_length=50, blank=True, default="")
    description = models.TextField(blank=True, default="")
    status = models.CharField(
        max_length=20, default="Active",
        choices=[("Active", "Active"), ("Resolved", "Resolved"),
                 ("Chronic", "Chronic")],
    )
    is_primary = models.BooleanField(default=False)
    is_confidential = models.BooleanField(
        default=False,
        help_text="True if diagnosis contains confidential/sensitive condition (HIV/AIDS, Mental Health, Reproductive Health, etc.)",
    )
    confidentiality_category = models.CharField(
        max_length=50, blank=True, default="Standard",
        choices=[
            ("Standard", "Standard (Non-Restricted)"),
            ("HIV/AIDS", "HIV/AIDS / Infectious Disease"),
            ("Mental Health", "Mental Health / Psychiatric"),
            ("Reproductive Health", "Reproductive Health"),
            ("Confidential", "Confidential / Highly Sensitive"),
        ],
    )

    class Meta:
        db_table = "healthcare_diagnosis"
        ordering = ["-creation"]

    def __str__(self):
        return f"{self.diagnosis} ({self.encounter})"

    def save(self, *args, **kwargs):
        # Keep the denormalised name in sync with the linked catalog entry.
        if self.diagnosis_master_id and not self.diagnosis:
            self.diagnosis = self.diagnosis_master.diagnosis

        # Auto-detect sensitive categories if not marked confidential
        if not self.is_confidential:
            diag_lower = f"{self.diagnosis} {self.description}".lower()
            sensitive_keywords = {
                "HIV/AIDS": ["hiv", "aids", "retrovir", "antiretroviral", "cd4 count", "viral load", "syphilis", "gonorrh", "chlamydia", "hepatitis b", "hepatitis c"],
                "Mental Health": ["psychiatric", "depression", "depressive", "bipolar", "schizophr", "suicid", "psychosis", "hallucination", "ptsd", "anxiety disorder", "substance abuse", "addiction"],
                "Reproductive Health": ["abortion", "termination of pregnancy", "miscarriage", "contraception", "sterilization", "tubal ligation", "vasectomy", "infertility", "ectopic pregnancy", "std", "sti"],
            }
            for cat, keywords in sensitive_keywords.items():
                if any(kw in diag_lower for kw in keywords):
                    self.is_confidential = True
                    self.confidentiality_category = cat
                    break

        super().save(*args, **kwargs)

        # Propagate confidentiality to parent encounter
        if self.is_confidential and self.encounter_id:
            try:
                PatientEncounter.objects.filter(id=self.encounter_id, is_confidential=False).update(is_confidential=True)
            except Exception:
                pass


class Symptom(BaseModel):
    """
    Symptom linked to an encounter — Marley's `Patient Encounter Symptom`.

    In Marley this child row is a Link to the `Complaint` doctype; `symptom`
    keeps the complaint name denormalised, as Frappe does for Link fields.
    """
    encounter = models.ForeignKey(
        PatientEncounter, on_delete=models.CASCADE, related_name="symptoms_list"
    )
    symptom = models.CharField(max_length=280)
    complaint_master = models.ForeignKey(
        "Complaint", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="encounter_symptoms",
    )
    severity = models.CharField(
        max_length=20, default="Moderate",
        choices=[("Mild", "Mild"), ("Moderate", "Moderate"),
                 ("Severe", "Severe")],
    )
    duration = models.CharField(max_length=100, blank=True, default="")
    description = models.TextField(blank=True, default="")

    class Meta:
        db_table = "healthcare_symptom"
        ordering = ["-creation"]

    def __str__(self):
        return f"{self.symptom} ({self.severity})"

    def save(self, *args, **kwargs):
        # Keep the denormalised name in sync with the linked complaint.
        if self.complaint_master_id and not self.symptom:
            self.symptom = self.complaint_master.complaint
        super().save(*args, **kwargs)


# ══════════════════════════════════════════════════════════════════════════════
# MEDICATION & PRESCRIPTIONS
# ══════════════════════════════════════════════════════════════════════════════

class DrugPrescription(BaseModel):
    """Drug prescriptions from an encounter."""
    encounter = models.ForeignKey(
        PatientEncounter, on_delete=models.CASCADE,
        related_name="drug_prescriptions", null=True, blank=True,
    )
    patient = models.ForeignKey(
        Patient, on_delete=models.CASCADE, related_name="prescriptions"
    )
    practitioner = models.ForeignKey(
        HealthcarePractitioner, on_delete=models.SET_NULL, null=True, blank=True
    )
    medication_name = models.CharField(max_length=280)
    drug_code = models.CharField(max_length=100, blank=True, default="")
    medication = models.ForeignKey(
        "Medication", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="prescriptions",
    )
    strength = models.CharField(max_length=50, blank=True, default="")
    dosage_form = models.CharField(
        max_length=100, default="Tablet", blank=True,
    )
    dosage = models.CharField(max_length=100, blank=True, default="")
    dosage_by_interval = models.BooleanField(default=False)
    update_schedule = models.BooleanField(default=False)
    interval = models.CharField(max_length=50, blank=True, default="")
    interval_uom = models.CharField(max_length=30, blank=True, default="")
    period = models.CharField(max_length=50, blank=True, default="")
    number_of_repeats_allowed = models.IntegerField(default=0)
    quantity = models.DecimalField(max_digits=10, decimal_places=2, default=1)
    refills = models.IntegerField(default=0)
    prescribed_date = models.DateField(auto_now_add=True)
    status = models.CharField(
        max_length=20, default="Active",
        choices=[("Active", "Active"), ("Completed", "Completed"),
                 ("Cancelled", "Cancelled")],
    )
    intent = models.CharField(
        max_length=50, default="Order", blank=True,
    )
    priority = models.CharField(
        max_length=50, default="Routine", blank=True,
    )
    comment = models.TextField(blank=True, default="")

    class Meta:
        db_table = "healthcare_drug_prescription"
        ordering = ["-prescribed_date"]

    def __str__(self):
        return f"{self.medication_name} for {self.patient}"

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        if self.patient_id and self.medication_name:
            try:
                dosage_parts = [self.dosage, self.dosage_form, f"for {self.period}" if self.period else ""]
                dosage_instruction = " ".join([p for p in dosage_parts if p]).strip()
                mr, created = MedicationRequest.objects.get_or_create(
                    patient=self.patient,
                    encounter=self.encounter,
                    medication_name=self.medication_name,
                    defaults={
                        "practitioner": self.practitioner,
                        "dosage_instruction": dosage_instruction,
                        "quantity": self.quantity or 1,
                        "intent": self.intent or "Order",
                        "priority": self.priority or "Routine",
                        "notes": self.comment or "",
                        "status": "Active" if self.status == "Active" else self.status,
                    }
                )
                if not created and mr.status == "Active":
                    mr.practitioner = self.practitioner or mr.practitioner
                    mr.quantity = self.quantity or mr.quantity
                    if dosage_instruction:
                        mr.dosage_instruction = dosage_instruction
                    mr.save(update_fields=["practitioner", "quantity", "dosage_instruction"])
            except Exception:
                pass



class PharmacyWarehouse(BaseModel):
    """Healthcare pharmacy locations / dispensing stores."""
    warehouse_name = models.CharField(max_length=200, unique=True)
    is_group = models.BooleanField(default=False)
    description = models.TextField(blank=True, default="")
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "healthcare_pharmacy_warehouse"
        ordering = ["warehouse_name"]

    def __str__(self):
        return self.warehouse_name


class PharmacyStockEntry(BaseModel):
    """Pharmacy stock movements and dispensing entries."""
    entry_number = models.CharField(max_length=100, unique=True)
    stock_entry_number = models.CharField(max_length=100, blank=True, default="")
    entry_type = models.CharField(max_length=50, default="Material Issue")
    posting_date = models.DateField(default=timezone.now)
    posting_time = models.TimeField(auto_now_add=True)
    warehouse = models.ForeignKey(
        "healthcare.PharmacyWarehouse", on_delete=models.SET_NULL, null=True, blank=True, related_name="stock_entries"
    )
    purpose = models.CharField(max_length=255, blank=True, default="")
    notes = models.TextField(blank=True, default="")
    total_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    patient = models.ForeignKey("healthcare.Patient", on_delete=models.SET_NULL, null=True, blank=True)

    class Meta:
        db_table = "healthcare_pharmacy_stock_entry"
        ordering = ["-posting_date", "-id"]

    def save(self, *args, **kwargs):
        if not self.stock_entry_number:
            self.stock_entry_number = self.entry_number
        super().save(*args, **kwargs)

    def __str__(self):
        return self.entry_number or self.stock_entry_number


class PharmacyStock(BaseModel):
    """Healthcare pharmacy inventory balance tracking."""
    warehouse = models.ForeignKey("healthcare.PharmacyWarehouse", on_delete=models.CASCADE, related_name="stocks")
    medication = models.ForeignKey("healthcare.Medication", on_delete=models.CASCADE, null=True, blank=True, related_name="stocks")
    item_code = models.CharField(max_length=140)
    item_name = models.CharField(max_length=200)
    item_group = models.CharField(max_length=100, blank=True, default="Pharmaceuticals")
    batch_no = models.CharField(max_length=100, blank=True, default="")
    expiry_date = models.DateField(null=True, blank=True)
    actual_qty = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    valuation_rate = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    reorder_level = models.DecimalField(max_digits=12, decimal_places=2, default=25)
    stock_uom = models.CharField(max_length=50, blank=True, default="Nos")

    class Meta:
        db_table = "healthcare_pharmacy_stock"
        ordering = ["item_name"]

    def __str__(self):
        return f"{self.item_name} @ {self.warehouse.warehouse_name} ({self.actual_qty})"


class MedicationRequest(BaseModel):
    """Formal medication request with full FHIR-style fields."""
    request_id = models.CharField(max_length=50, unique=True, blank=True)
    patient = models.ForeignKey(
        Patient, on_delete=models.CASCADE, related_name="medication_requests"
    )
    practitioner = models.ForeignKey(
        HealthcarePractitioner, on_delete=models.SET_NULL, null=True, blank=True
    )
    encounter = models.ForeignKey(
        PatientEncounter, on_delete=models.SET_NULL, null=True, blank=True
    )
    medication_name = models.CharField(max_length=280)
    dosage_instruction = models.TextField(blank=True, default="")
    dosage_form = models.CharField(max_length=100, blank=True, default="")
    dosage = models.CharField(max_length=100, blank=True, default="")
    period = models.CharField(max_length=100, blank=True, default="")
    order_date = models.DateField(null=True, blank=True)
    order_time = models.TimeField(null=True, blank=True)
    expected_date = models.DateField(null=True, blank=True)
    company = models.ForeignKey(
        "setup.Company", on_delete=models.SET_NULL, null=True, blank=True
    )
    status = models.CharField(
        max_length=50, default="Active",
        choices=[
            ("Draft", "Draft"),
            ("Active", "Active"),
            ("On Hold", "On Hold"),
            ("Completed", "Completed"),
            ("Cancelled", "Cancelled"),
            ("Revoked", "Revoked"),
            ("Entered in Error", "Entered in Error"),
            ("Unknown", "Unknown"),
        ],
    )
    intent = models.CharField(
        max_length=50, default="Order",
        choices=[("Order", "Order"), ("Plan", "Plan"), ("Proposal", "Proposal"), ("Directive", "Directive")],
    )
    priority = models.CharField(
        max_length=50, default="Routine",
        choices=[("Routine", "Routine"), ("Urgent", "Urgent"), ("ASAP", "ASAP"), ("STAT", "STAT")],
    )
    quantity = models.DecimalField(max_digits=10, decimal_places=2, default=1)
    refill_count = models.IntegerField(default=0)
    number_of_repeats_allowed = models.FloatField(default=0)
    total_dispensable_quantity = models.DecimalField(max_digits=10, decimal_places=2, default=1)
    staff_role = models.CharField(max_length=100, blank=True, default="")
    order_description = models.TextField(blank=True, default="")
    notes = models.TextField(blank=True, default="")
    warehouse = models.ForeignKey(
        "healthcare.PharmacyWarehouse", on_delete=models.SET_NULL, null=True, blank=True,
        help_text="Dispensing warehouse / pharmacy",
        related_name="medication_requests",
    )
    stock_entry = models.ForeignKey(
        "healthcare.PharmacyStockEntry", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="medication_requests",
    )
    billing_status = models.CharField(
        max_length=30, default="Pending",
        choices=[("Pending", "Pending"), ("Partly Invoiced", "Partly Invoiced"),
                 ("Invoiced", "Invoiced"), ("Paid", "Paid")],
    )
    qty_invoiced = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    dispensed_datetime = models.DateTimeField(null=True, blank=True)
    dispensed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="dispensed_medication_requests"
    )

    class Meta:
        db_table = "healthcare_medication_request"
        ordering = ["-creation"]

    def __str__(self):
        return f"{self.medication_name} - {self.patient}"

    def save(self, *args, **kwargs):
        if not self.request_id:
            last = MedicationRequest.objects.order_by("-id").first()
            num = (last.id + 1) if last else 1
            self.request_id = f"HLC-MRX-{num:05d}"
        super().save(*args, **kwargs)


# ══════════════════════════════════════════════════════════════════════════════
# LAB TESTS
# ══════════════════════════════════════════════════════════════════════════════

class LabTestUOM(BaseModel):
    """
    Lab Test Units of Measurement: mg/dL, mmol/L, etc. — Marley's `Lab Test UOM`.

    Named as Marley names them (`lab_test_uom`, `uom_description`); the doctype
    autoname is `field:lab_test_uom`, so that field is the record's identity.
    """
    lab_test_uom = models.CharField(max_length=50, unique=True)
    uom_description = models.CharField(max_length=200, blank=True, default="")

    class Meta:
        db_table = "healthcare_lab_test_uom"
        ordering = ["lab_test_uom"]

    def __str__(self):
        return self.lab_test_uom


class LabTestTemplate(BaseModel):
    """
    Lab test templates: CBC, Lipid Profile, etc. — Marley's `Lab Test Template`.

    `lab_test_template_type` ("Result Format") decides which of the result
    sections applies, and with it which child tables are in play:
    Compound → `normal_test_templates`, Descriptive →
    `descriptive_test_templates`, Grouped → `lab_test_groups`.

    Each template also owns a `stock.Item`, kept in step by `sync_item_on_create`
    and friends below — Marley's controller does the same from its `after_insert`
    and `on_update` hooks.
    """
    lab_test_name = models.CharField(max_length=200, unique=True)
    department = models.ForeignKey(
        MedicalDepartment, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="lab_test_templates",
    )
    disabled = models.BooleanField(default=False)
    nursing_checklist_template = models.ForeignKey(
        "healthcare.NursingChecklistTemplate", on_delete=models.SET_NULL,
        null=True, blank=True, related_name="lab_test_templates",
    )
    # ── Billing ───────────────────────────────────────────────────────────
    link_existing_item = models.BooleanField(default=False)
    item = models.CharField(max_length=140, blank=True, default="")
    lab_test_code = models.CharField(max_length=100, blank=True, default="")
    lab_test_group = models.CharField(max_length=140, blank=True, default="General")
    is_billable = models.BooleanField(default=True)
    lab_test_rate = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    # ── Result Format ─────────────────────────────────────────────────────
    lab_test_template_type = models.CharField(
        max_length=30, default="Single",
        choices=[("Single", "Single"), ("Compound", "Compound"),
                 ("Descriptive", "Descriptive"), ("Grouped", "Grouped"),
                 ("Imaging", "Imaging"), ("No Result", "No Result")],
    )
    lab_test_uom = models.ForeignKey(
        "healthcare.LabTestUOM", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="lab_test_templates",
    )
    secondary_uom = models.ForeignKey(
        "healthcare.LabTestUOM", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="lab_test_templates_secondary",
    )
    conversion_factor = models.DecimalField(
        max_digits=12, decimal_places=6, null=True, blank=True
    )
    lab_test_normal_range = models.TextField(blank=True, default="")
    sensitivity = models.BooleanField(default=False)
    # ── Sample Collection ─────────────────────────────────────────────────
    sample = models.ForeignKey(
        "healthcare.LabTestSample", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="lab_test_templates",
    )
    # Denormalised copy of `sample.sample_uom` — Marley marks the field read_only
    # with `fetch_from: sample.sample_uom`, so it is a value, not a link.
    sample_uom = models.CharField(max_length=50, blank=True, default="")
    sample_qty = models.DecimalField(max_digits=8, decimal_places=3, default=0)
    sample_details = models.TextField(blank=True, default="")
    change_in_item = models.BooleanField(default=False)
    # ── Worksheet & Legend ────────────────────────────────────────────────
    worksheet_instructions = models.TextField(blank=True, default="")
    legend_print_position = models.CharField(
        max_length=20, default="Bottom",
        choices=[("Top", "Top"), ("Bottom", "Bottom"), ("Both", "Both")],
    )
    result_legend = models.TextField(blank=True, default="")
    # ── Service Request Defaults ──────────────────────────────────────────
    patient_care_type = models.ForeignKey(
        "healthcare.PatientCareType", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="lab_test_templates",
    )
    staff_role = models.ForeignKey(
        "roles.Role", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="lab_test_templates",
    )
    # ── Description ───────────────────────────────────────────────────────
    # Marley gates both of these on Result Format == 'Imaging', which reads like
    # a bug there (an Imaging-only description); mirrored as-is.
    lab_test_description = models.TextField(blank=True, default="")
    descriptive_result = models.TextField(blank=True, default="")

    class Meta:
        db_table = "healthcare_lab_test_template"
        ordering = ["lab_test_name"]

    def __str__(self):
        return self.lab_test_name

    def save(self, *args, **kwargs):
        # Keep the read-only `sample_uom` copy in step with the linked sample.
        if self.sample_id:
            self.sample_uom = self.sample.sample_uom.lab_test_uom if self.sample.sample_uom_id else ""
        super().save(*args, **kwargs)

    # ── Item integration ──────────────────────────────────────────────────
    # Marley's `Lab Test Template` controller keeps a `stock.Item` in step with
    # every template so the test can be billed. This app has no `Item Price`
    # model, so the rate is written to `Item.standard_rate` in place of a
    # price-list row — the one behavioural deviation in this file.
    #
    # The controller's hooks map onto the viewset as:
    #   before_insert → `pull_rate_from_item`   (perform_create, before save)
    #   after_insert  → `sync_item_on_create`   (perform_create, after save)
    #   on_update     → `sync_item_on_update`   (perform_update)
    #   on_trash      → `delete_item`           (perform_destroy)

    def pull_rate_from_item(self):
        """Marley's `before_insert`: adopt the linked item's going rate."""
        if self.link_existing_item and self.item_id:
            self.lab_test_rate = self.item.standard_rate

    def pull_rate_from_item(self):
        pass

    def create_item_from_template(self):
        pass

    def sync_item_on_create(self):
        pass

    def sync_item_on_update(self):
        pass

    def update_item_and_item_price(self):
        pass

    def enable_disable_item(self):
        pass

    def delete_item(self):
        return True

    def rename_item(self, new_code):
        LabTestTemplate.objects.filter(pk=self.pk).update(
            lab_test_code=new_code, lab_test_name=new_code
        )
        self.lab_test_code = new_code
        self.lab_test_name = new_code


class LabTest(BaseModel):
    """
    Lab test orders and results — Marley's `Lab Test` doctype.

    The field set follows `lab_test.json`'s `field_order`: identity and
    ordering first, the patient block (denormalised from the Patient the way
    Marley's `fetch_from` rules do), the result tables as child rows, the
    print sections, and More Information. `test_id`, `encounter`, `timezone`,
    `requesting_practitioner`, `result` and `normal_range` are this app's own
    and are kept so existing pages that read them keep working.

    Deviations forced by the stack, noted once here: Marley's `docstatus`
    lifecycle is carried by `status` (Submit → Completed, Cancel → Cancelled)
    since Django has no docstatus; `submitted_date`/`approved_date` stay
    DateFields although Marley declares Datetime, because its controller
    always writes a date into them; `employee` is a plain value because this
    stack has no Employee doctype; `patient_name`/`practitioner_name` are
    served read-only from the linked records by the serializer rather than
    stored as Marley copies; and the `lab_test_html` HTML field is skipped as
    presentation-only. Marley's `after_insert` runs from `save()` on insert
    so every creation path (API create, Create Multiple, seeding) gets the
    treatment the document lifecycle gives it in Frappe.
    """
    test_id = models.CharField(max_length=50, unique=True, blank=True)
    naming_series = models.CharField(max_length=50, default="HLC-LAB-.YYYY.-", blank=True)
    template = models.ForeignKey(
        LabTestTemplate, on_delete=models.SET_NULL, null=True, blank=True
    )
    lab_test_name = models.CharField(max_length=200)
    lab_test_group = models.CharField(max_length=140, blank=True, default="General")
    department = models.ForeignKey(
        MedicalDepartment, on_delete=models.SET_NULL, null=True, blank=True
    )
    company = models.CharField(max_length=140, blank=True, default="EEU (Demo)")
    status = models.CharField(
        max_length=30, default="Draft",
        choices=[
            ("Draft", "Draft"), ("Completed", "Completed"),
            ("Approved", "Approved"), ("Rejected", "Rejected"),
            ("Cancelled", "Cancelled"),
        ],
    )
    date = models.DateField()
    time = models.TimeField(null=True, blank=True)
    submitted_date = models.DateField(null=True, blank=True)
    result_date = models.DateField(null=True, blank=True)
    approved_date = models.DateField(null=True, blank=True)
    expected_result_date = models.DateField(null=True, blank=True)
    expected_result_time = models.TimeField(null=True, blank=True)
    printed_on = models.DateTimeField(null=True, blank=True)
    timezone = models.CharField(max_length=50, blank=True, default="Africa/Addis_Ababa")
    # ── Patient block ────────────────────────────────────────────────────
    patient = models.ForeignKey(
        Patient, on_delete=models.CASCADE, related_name="lab_tests"
    )
    patient_age = models.CharField(max_length=100, blank=True, default="")
    patient_sex = models.CharField(
        max_length=20, blank=True, default="",
        choices=[("Male", "Male"), ("Female", "Female"), ("Other", "Other")],
    )
    inpatient_record = models.ForeignKey(
        "InpatientRecord", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="lab_tests",
    )
    emergency_record = models.ForeignKey(
        "EmergencyRecord", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="lab_tests",
    )
    report_preference = models.CharField(
        max_length=20, blank=True, default="",
        choices=[("", ""), ("Email", "Email"), ("Print", "Print")],
    )
    email = models.CharField(max_length=140, blank=True, default="")
    mobile = models.CharField(max_length=20, blank=True, default="")
    service_unit = models.ForeignKey(
        HealthcareServiceUnit, on_delete=models.SET_NULL, null=True, blank=True
    )
    practitioner = models.ForeignKey(
        HealthcarePractitioner, on_delete=models.SET_NULL, null=True, blank=True
    )
    requesting_department = models.ForeignKey(
        MedicalDepartment, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="lab_test_requests",
    )
    # App extras: the form binds "Requesting Practitioner" to `practitioner`
    # (Marley's field); these keep older pages and filters working.
    requesting_practitioner = models.ForeignKey(
        HealthcarePractitioner, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="requested_lab_tests",
    )
    encounter = models.ForeignKey(
        PatientEncounter, on_delete=models.SET_NULL, null=True, blank=True
    )
    # Marley: Link `Employee` with fetched name/designation. This stack has no
    # Employee doctype, so the technician is kept as a plain value — the same
    # adaptation `LabTestSample` makes for Marley's Color link.
    employee = models.CharField(max_length=140, blank=True, default="")
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="lab_tests",
    )
    sample = models.ForeignKey(
        "SampleCollection", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="lab_tests",
    )
    # ── Specimen Custody & Accessioning Workflow ─────────────────────────
    specimen_status = models.CharField(
        max_length=30, default="Pending Collection",
        choices=[
            ("Pending Collection", "Pending Collection"),
            ("Collected", "Collected"),
            ("Received", "Received"),
            ("Rejected", "Rejected"),
            ("Not Required", "Not Required"),
        ],
    )
    specimen_barcode = models.CharField(max_length=100, blank=True, default="")
    collected_by = models.CharField(max_length=140, blank=True, default="")
    collection_datetime = models.DateTimeField(null=True, blank=True)
    collection_site = models.CharField(max_length=100, blank=True, default="")
    specimen_received_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="received_lab_tests",
    )
    specimen_received_time = models.DateTimeField(null=True, blank=True)
    specimen_condition = models.CharField(
        max_length=50, default="Acceptable", blank=True,
        choices=[
            ("Acceptable", "Acceptable / Normal"),
            ("Hemolyzed", "Hemolyzed"),
            ("Lipemic", "Lipemic"),
            ("Icteric", "Icteric"),
            ("Clotted", "Clotted"),
            ("QNS", "Quantity Not Sufficient (QNS)"),
            ("Leaked", "Container Leaked / Damaged"),
            ("Unlabeled", "Mislabeled / Unlabeled Tube"),
        ],
    )
    specimen_temperature_receipt = models.CharField(
        max_length=30, default="Ambient", blank=True,
        choices=[("Ambient", "Ambient (15-25°C)"), ("Refrigerated", "Refrigerated (2-8°C)"), ("Frozen", "Frozen (<-20°C)")],
    )
    specimen_rejection_reason = models.TextField(blank=True, default="")
    # ── Results ──────────────────────────────────────────────────────────
    result = models.TextField(blank=True, default="")  # app extra
    lab_test_comment = models.TextField(blank=True, default="")
    normal_range = models.TextField(blank=True, default="")  # app extra
    custom_result = models.TextField(blank=True, default="")
    descriptive_result = models.TextField(blank=True, default="")
    worksheet_instructions = models.TextField(blank=True, default="")
    legend_print_position = models.CharField(
        max_length=20, blank=True, default="",
        choices=[("", ""), ("Bottom", "Bottom"), ("Top", "Top"), ("Both", "Both")],
    )
    result_legend = models.TextField(blank=True, default="")
    normal_toggle = models.BooleanField(default=False)
    imaging_toggle = models.BooleanField(default=False)
    descriptive_toggle = models.BooleanField(default=False)
    sensitivity_toggle = models.BooleanField(default=False)
    # ── More Information ─────────────────────────────────────────────────
    service_request = models.ForeignKey(
        "ServiceRequest", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="lab_tests",
    )
    invoiced = models.BooleanField(default=False)
    email_sent = models.BooleanField(default=False)
    sms_sent = models.BooleanField(default=False)
    printed = models.BooleanField(default=False)
    prescription = models.ForeignKey(
        "LabPrescription", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="lab_tests",
    )
    amended_from = models.ForeignKey(
        "self", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="amended_lab_tests",
    )

    class Meta:
        db_table = "healthcare_lab_test"
        ordering = ["-date"]

    def __str__(self):
        return f"{self.lab_test_name} - {self.patient}"

    def save(self, *args, **kwargs):
        if not self.test_id:
            last = LabTest.objects.order_by("-id").first()
            num = (last.id + 1) if last else 1
            self.test_id = f"HLC-LAB-{num:05d}"
        if not self.date:
            self.date = timezone.now().date()
        if not self.time:
            self.time = timezone.now().time()
        # Marley's `fetch_from practitioner.department` runs on every save.
        if self.practitioner_id:
            self.requesting_department_id = self.practitioner.department_id
        is_insert = self._state.adding
        if not is_insert:
            # Marley's `validate` — guarded by `if not self.is_new()`.
            self.set_secondary_uom_result()
            # Marley's `before_save` — the sensitivity rows stay sorted. Both
            # walk the child tables, which needs the primary key this stack
            # only has once the row exists; a new document has no rows yet
            # anyway — they are laid out by `after_insert` right after.
            self.sort_sensitivity_rows()
        super().save(*args, **kwargs)
        if is_insert:
            # Marley's `after_insert`.
            self.load_test_from_template()

    def load_test_from_template(self):
        """
        Marley's `after_insert`: `create_test_from_template`, the patient
        fetches from `create_lab_test_doc`/the form's patient handler, and
        `load_result_format`.
        """
        patient = self.patient
        updates = {}

        def set_field(name, value):
            setattr(self, name, value)
            updates[name] = True

        set_field("patient_age", patient.age_display)
        set_field("patient_sex", patient.sex)
        set_field("email", patient.email)
        set_field("mobile", patient.mobile)
        if patient.inpatient_record_id:
            set_field("inpatient_record_id", patient.inpatient_record_id)
        if not self.emergency_record_id:
            # Marley fetches `patient.emergency_record`; this Patient has no
            # such field, so the patient's latest emergency record stands in.
            latest = EmergencyRecord.objects.filter(patient=patient).order_by("-creation").first()
            if latest:
                set_field("emergency_record_id", latest.pk)

        template = self.template
        if template:
            set_field("lab_test_name", template.lab_test_name)
            set_field("result_date", date.today())
            if template.department_id:
                set_field("department_id", template.department_id)
            set_field("legend_print_position", template.legend_print_position)
            set_field("result_legend", template.result_legend)
            set_field("worksheet_instructions", template.worksheet_instructions)

        if updates:
            self.save(update_fields=list(updates))

        if template:
            self.load_result_format()
            self.copy_medical_codes_from_template()
            self.create_sample_collection_from_template()
            self.create_nursing_tasks_from_template()

        if self.prescription_id and not self.prescription.lab_test_created:
            # The prescription now has its result — the flag the app's own
            # encounter flow keeps on LabPrescription.
            self.prescription.lab_test_created = True
            self.prescription.save(update_fields=["lab_test_created"])

    def load_result_format(self):
        """Marley's `load_result_format`: lay the rows out from the template's Result Format."""
        template = self.template
        ttype = template.lab_test_template_type

        if ttype == "Single":
            self.create_normals(template)
        elif ttype == "Compound":
            self.create_compounds(template, is_group=False)
        elif ttype == "Descriptive":
            self.create_descriptives(template)
        elif ttype == "Imaging":
            self.create_imaging(template)
        elif ttype == "Grouped":
            for group in template.lab_test_groups.all():
                if group.lab_test_template_id:
                    template_in_group = group.lab_test_template
                    inner_type = template_in_group.lab_test_template_type
                    if inner_type == "Single":
                        self.create_normals(template_in_group)
                    elif inner_type == "Compound":
                        self.append_normal(
                            lab_test_name=template_in_group.lab_test_name,
                            require_result_value=False, allow_blank=True,
                            template=template_in_group,
                        )
                        self.create_compounds(template_in_group, is_group=True)
                    elif inner_type == "Descriptive":
                        # Marley writes `lab_test_name` on this heading row — a
                        # field the child doctype does not have — so the value
                        # never persisted there; here it lands on the row's own
                        # name field, which is what the line reaches for.
                        self.append_descriptive(
                            lab_test_particulars=template_in_group.lab_test_name,
                            require_result_value=False, allow_blank=True,
                            template=template_in_group,
                        )
                        self.create_descriptives(template_in_group)
                else:
                    # "Add New Line"
                    self.append_normal(
                        lab_test_name=group.group_event,
                        lab_test_uom=group.group_test_uom,
                        secondary_uom=group.secondary_uom,
                        conversion_factor=group.conversion_factor,
                        normal_range=group.group_test_normal_range,
                        allow_blank=group.allow_blank,
                        require_result_value=True,
                        template=template,
                    )

        self.save(update_fields=[
            "normal_toggle", "imaging_toggle", "descriptive_toggle",
            "sensitivity_toggle", "descriptive_result",
        ])

    def append_normal(self, **row):
        """Add a row to the Compound Test Result table."""
        NormalTestResult.objects.create(lab_test=self, idx=self.normal_test_items.count(), **row)

    def append_descriptive(self, **row):
        """Add a row to the Descriptive Test Result table."""
        DescriptiveTestResult.objects.create(
            lab_test=self, idx=self.descriptive_test_items.count(), **row
        )

    def create_normals(self, template):
        """Marley's `create_normals`: a Single template's one result line."""
        self.normal_toggle = True
        self.append_normal(
            lab_test_name=template.lab_test_name,
            lab_test_uom=template.lab_test_uom,
            secondary_uom=template.secondary_uom,
            conversion_factor=template.conversion_factor,
            normal_range=template.lab_test_normal_range,
            require_result_value=True,
            allow_blank=False,
            template=template,
        )

    def create_compounds(self, template, is_group):
        """Marley's `create_compounds`: one line per Compound component."""
        self.normal_toggle = True
        for row in template.normal_test_templates.all():
            values = dict(
                lab_test_uom=row.lab_test_uom,
                secondary_uom=row.secondary_uom,
                conversion_factor=row.conversion_factor,
                normal_range=row.normal_range,
                allow_blank=row.allow_blank,
                require_result_value=True,
                template=template,
            )
            if is_group:
                values["lab_test_event"] = row.lab_test_event
            else:
                values["lab_test_name"] = row.lab_test_event
            self.append_normal(**values)

    def create_descriptives(self, template):
        """Marley's `create_descriptives`."""
        self.descriptive_toggle = True
        if template.sensitivity:
            self.sensitivity_toggle = True
        for row in template.descriptive_test_templates.all():
            self.append_descriptive(
                lab_test_particulars=row.particulars,
                require_result_value=True,
                allow_blank=row.allow_blank,
                template=template,
            )

    def create_imaging(self, template):
        """Marley's `create_imaging`."""
        self.imaging_toggle = True
        self.descriptive_result = template.descriptive_result

    def copy_medical_codes_from_template(self):
        """Marley's form handler on `template`: pull the template's medical codes."""
        for row in self.template.codification_table.all():
            CodificationTable.objects.create(
                lab_test=self, code_system=row.code_system, code_value=row.code_value
            )

    def create_sample_collection_from_template(self):
        """
        Marley's `create_sample_collection`, gated on Healthcare Settings'
        `create_sample_collection_for_lab_test` (default off, as in Marley).
        """
        settings_obj = HealthcareSettings.objects.first()
        if not (settings_obj and settings_obj.create_sample_collection_for_lab_test):
            return
        template = self.template
        if not template.sample_id:
            return
        patient = self.patient
        existing = SampleCollection.objects.filter(
            patient=patient, sample=template.sample_id, status="Pending"
        ).first()
        if existing:
            existing.sample_qty = existing.sample_qty + template.sample_qty
            if template.sample_details:
                details = (existing.sample_details + "\n-\n") if existing.sample_details else "Test :"
                details += (template.lab_test_name or str(template)) + "\n"
                details += "Collection Details:\n\t" + template.sample_details
                existing.sample_details = details
            existing.save()
            collection = existing
        else:
            collection = SampleCollection(
                patient=patient,
                patient_name=patient.patient_name,
                # SampleCollection.patient_age is a 20-char column here;
                # Marley's field is unbounded Data.
                patient_age=patient.age_display[:20],
                patient_sex=patient.sex,
                company=self.company,
                sample=template.sample,
                sample_uom=template.sample_uom,
                sample_qty=template.sample_qty,
                sample_details=template.sample_details,
            )
            collection.save()
        self.sample = collection
        self.save(update_fields=["sample"])

    def result_value_error(self):
        """
        Marley's `validate_result_values` (fired on submit): the first row
        that demands a value and has none, or None when results are complete.
        """
        for i, item in enumerate(self.normal_test_items.all(), start=1):
            if not item.result_value and not item.allow_blank and item.require_result_value:
                name = item.lab_test_name or item.lab_test_event or ""
                return f"Row #{i}: Please enter the result value for {name}"
        for i, item in enumerate(self.descriptive_test_items.all(), start=1):
            if not item.result_value and not item.allow_blank and item.require_result_value:
                return f"Row #{i}: Please enter the result value for {item.lab_test_particulars}"
        return None

    def sort_sensitivity_rows(self):
        """Marley's `before_save`: sensitivity rows stay sorted by sensitivity."""
        rows = list(self.sensitivity_test_items.all())
        if not rows:
            return
        rows.sort(key=lambda r: (
            r.antibiotic_sensitivity.sensitivity if r.antibiotic_sensitivity_id else ""
        ))
        for i, row in enumerate(rows, start=1):
            if row.idx != i:
                row.idx = i
                row.save(update_fields=["idx"])

    def set_secondary_uom_result(self):
        """
        Marley's `validate` → `set_secondary_uom_result`: a row with a result
        value, a secondary UOM and a conversion factor gets its converted
        value; an unparseable result clears it (Marley shows a warning here,
        which this model layer has no dialog for).
        """
        for item in self.normal_test_items.all():
            if item.result_value and item.secondary_uom_id and item.conversion_factor:
                try:
                    value = str(float(item.result_value) * float(item.conversion_factor))
                except (TypeError, ValueError):
                    value = ""
                if value != item.secondary_uom_result:
                    item.secondary_uom_result = value
                    item.save(update_fields=["secondary_uom_result"])

    def create_nursing_tasks_from_template(self):
        """
        Marley's `after_insert`: when the template carries a Nursing Checklist
        Template, one Nursing Task is minted per checklist entry against this
        Lab Test.
        """
        checklist = self.template.nursing_checklist_template if self.template else None
        if not checklist:
            return
        now_time = timezone.now().time()
        for entry in (checklist.tasks or []):
            if not isinstance(entry, dict):
                continue
            activity = str(
                entry.get("activity") or entry.get("title") or entry.get("description") or "Task"
            )
            NursingTask.objects.create(
                title=f"{self.patient} - {activity}",
                patient=self.patient,
                mandatory=bool(entry.get("mandatory")),
                department=self.department_id,
                service_unit=self.service_unit_id,
                requested_start_time=now_time,
                notes=str(entry.get("description") or ""),
                # Marley's `reference_doctype` / `reference_name`.
                reference_doctype="Lab Test",
                reference_name=self.test_id,
            )

    def pending_nursing_tasks(self):
        """
        Marley's `validate_nursing_tasks(document)`: the mandatory tasks still
        open against this document, once Healthcare Settings asks for the
        check — otherwise nothing is ever pending.
        """
        settings_obj = HealthcareSettings.objects.first()
        if not (settings_obj and settings_obj.validate_nursing_checklists):
            return NursingTask.objects.none()
        return NursingTask.objects.filter(
            reference_doctype="Lab Test",
            reference_name=self.test_id,
            mandatory=True,
        ).exclude(status__in=["Completed", "Cancelled"])


class LabTestSample(BaseModel):
    """
    Lab test samples: Blood, Urine, etc. — Marley's `Lab Test Sample`.

    The identity field is `sample` (Marley autoname `field:sample`), not
    `sample_name`. `container_closure_color` is a Link to `Color` in Marley;
    this app has no Color model, so the colour is kept as a plain value.
    """
    sample = models.CharField(max_length=140, unique=True)
    sample_uom = models.ForeignKey(
        LabTestUOM, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="samples",
    )
    sample_type = models.ForeignKey(
        "healthcare.SampleType", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="samples",
    )
    container_closure_color = models.CharField(max_length=140, blank=True, default="")

    class Meta:
        db_table = "healthcare_lab_test_sample"
        ordering = ["sample"]

    def __str__(self):
        return self.sample


# ══════════════════════════════════════════════════════════════════════════════
# CLINICAL PROCEDURES
# ══════════════════════════════════════════════════════════════════════════════

class ClinicalProcedureTemplate(BaseModel):
    """Templates for clinical procedures."""
    template_name = models.CharField(max_length=200, unique=True)
    description = models.TextField(blank=True, default="")
    department = models.ForeignKey(
        MedicalDepartment, on_delete=models.SET_NULL, null=True, blank=True
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "healthcare_clinical_procedure_template"
        ordering = ["template_name"]

    def __str__(self):
        return self.template_name


class ClinicalProcedure(BaseModel):
    """Clinical procedure record."""
    procedure_id = models.CharField(max_length=50, unique=True, blank=True)
    title = models.CharField(max_length=280, blank=True, default="")
    procedure_template = models.ForeignKey(
        ClinicalProcedureTemplate, on_delete=models.SET_NULL, null=True, blank=True
    )
    patient = models.ForeignKey(
        Patient, on_delete=models.CASCADE, related_name="clinical_procedures"
    )
    practitioner = models.ForeignKey(
        HealthcarePractitioner, on_delete=models.SET_NULL, null=True, blank=True
    )
    department = models.ForeignKey(
        MedicalDepartment, on_delete=models.SET_NULL, null=True, blank=True
    )
    service_unit = models.ForeignKey(
        HealthcareServiceUnit, on_delete=models.SET_NULL, null=True, blank=True
    )
    appointment = models.ForeignKey(
        PatientAppointment, on_delete=models.SET_NULL, null=True, blank=True
    )
    encounter = models.ForeignKey(
        PatientEncounter, on_delete=models.SET_NULL, null=True, blank=True
    )
    status = models.CharField(
        max_length=30, default="Scheduled",
        choices=[
            ("Scheduled", "Scheduled"), ("In Progress", "In Progress"),
            ("Completed", "Completed"), ("Cancelled", "Cancelled"),
        ],
    )
    start_date = models.DateField(null=True, blank=True)
    start_time = models.TimeField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    end_time = models.TimeField(null=True, blank=True)
    notes = models.TextField(blank=True, default="")
    invoiced = models.BooleanField(default=False)

    class Meta:
        db_table = "healthcare_clinical_procedure"
        ordering = ["-start_date"]

    def __str__(self):
        return f"Procedure: {self.title or self.patient}"

    def save(self, *args, **kwargs):
        if not self.procedure_id:
            last = ClinicalProcedure.objects.order_by("-id").first()
            num = (last.id + 1) if last else 1
            self.procedure_id = f"HLC-CPR-{num:05d}"
        super().save(*args, **kwargs)


# ══════════════════════════════════════════════════════════════════════════════
# THERAPY / REHABILITATION
# ══════════════════════════════════════════════════════════════════════════════

class TherapyType(BaseModel):
    """Types of therapy: Physiotherapy, Speech Therapy, etc."""
    therapy_type = models.CharField(max_length=200, unique=True)
    description = models.TextField(blank=True, default="")
    department = models.ForeignKey(
        MedicalDepartment, on_delete=models.SET_NULL, null=True, blank=True
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "healthcare_therapy_type"
        ordering = ["therapy_type"]

    def __str__(self):
        return self.therapy_type


class TherapyPlan(BaseModel):
    """Therapy plan for a patient."""
    plan_id = models.CharField(max_length=50, unique=True, blank=True)
    patient = models.ForeignKey(
        Patient, on_delete=models.CASCADE, related_name="therapy_plans"
    )
    practitioner = models.ForeignKey(
        HealthcarePractitioner, on_delete=models.SET_NULL, null=True, blank=True
    )
    therapy_type = models.ForeignKey(
        TherapyType, on_delete=models.SET_NULL, null=True, blank=True
    )
    title = models.CharField(max_length=280, blank=True, default="")
    status = models.CharField(
        max_length=20, default="Draft",
        choices=[("Draft", "Draft"), ("Active", "Active"),
                 ("Completed", "Completed"), ("Cancelled", "Cancelled")],
    )
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    goals = models.TextField(blank=True, default="")
    notes = models.TextField(blank=True, default="")
    total_sessions = models.IntegerField(default=0)
    completed_sessions = models.IntegerField(default=0)
    reference_doctype = models.CharField(max_length=140, blank=True, default="")
    reference_name = models.CharField(max_length=140, blank=True, default="")

    class Meta:
        db_table = "healthcare_therapy_plan"
        ordering = ["-creation"]

    def __str__(self):
        return f"Therapy Plan: {self.patient} - {self.title}"

    def save(self, *args, **kwargs):
        if not self.plan_id:
            last = TherapyPlan.objects.order_by("-id").first()
            num = (last.id + 1) if last else 1
            self.plan_id = f"HLC-TP-{num:05d}"
        super().save(*args, **kwargs)


class TherapySession(BaseModel):
    """Individual therapy sessions."""
    session_id = models.CharField(max_length=50, unique=True, blank=True)
    plan = models.ForeignKey(
        TherapyPlan, on_delete=models.CASCADE, related_name="sessions",
        null=True, blank=True,
    )
    patient = models.ForeignKey(
        Patient, on_delete=models.CASCADE, related_name="therapy_sessions"
    )
    practitioner = models.ForeignKey(
        HealthcarePractitioner, on_delete=models.SET_NULL, null=True, blank=True
    )
    therapy_type = models.ForeignKey(
        TherapyType, on_delete=models.SET_NULL, null=True, blank=True
    )
    session_date = models.DateField()
    session_time = models.TimeField(null=True, blank=True)
    duration = models.IntegerField(default=30, help_text="Duration in minutes")
    status = models.CharField(
        max_length=20, default="Scheduled",
        choices=[("Scheduled", "Scheduled"), ("Completed", "Completed"),
                 ("Cancelled", "Cancelled"), ("No Show", "No Show")],
    )
    notes = models.TextField(blank=True, default="")
    exercises_performed = models.TextField(blank=True, default="")
    patient_response = models.TextField(blank=True, default="")
    next_session_date = models.DateField(null=True, blank=True)

    class Meta:
        db_table = "healthcare_therapy_session"
        ordering = ["-session_date", "-session_time"]

    def __str__(self):
        return f"Session: {self.patient} on {self.session_date}"

    def save(self, *args, **kwargs):
        if not self.session_id:
            last = TherapySession.objects.order_by("-id").first()
            num = (last.id + 1) if last else 1
            self.session_id = f"HLC-TS-{num:05d}"
        super().save(*args, **kwargs)


class Exercise(BaseModel):
    """Exercise library for therapy."""
    exercise_name = models.CharField(max_length=200)
    description = models.TextField(blank=True, default="")
    therapy_type = models.ForeignKey(
        TherapyType, on_delete=models.SET_NULL, null=True, blank=True
    )
    body_part = models.CharField(max_length=100, blank=True, default="")
    difficulty_level = models.CharField(
        max_length=20, default="Beginner",
        choices=[("Beginner", "Beginner"), ("Intermediate", "Intermediate"),
                 ("Advanced", "Advanced")],
    )
    duration_minutes = models.IntegerField(default=15)
    instructions = models.TextField(blank=True, default="")
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "healthcare_exercise"
        ordering = ["exercise_name"]

    def __str__(self):
        return self.exercise_name


class TreatmentPlanTemplate(BaseModel):
    """Treatment plan templates — mirrors Marley's Treatment Plan Template."""
    template_name = models.CharField(max_length=200, unique=True)
    description = models.TextField(blank=True, default="")
    goal = models.TextField(blank=True, default="")
    medical_department = models.ForeignKey(
        MedicalDepartment, on_delete=models.SET_NULL, null=True, blank=True
    )
    disabled = models.BooleanField(default=False)
    # Plan conditions
    patient_age_from = models.IntegerField(default=0)
    patient_age_to = models.IntegerField(default=0)
    gender = models.CharField(max_length=20, blank=True, default="")
    # Marley's complaints & diagnosis (Table MultiSelect → Symptom/Diagnosis)
    complaints = models.ManyToManyField("Symptom", blank=True, related_name="treatment_plan_templates")
    diagnosis = models.ManyToManyField("Diagnosis", blank=True, related_name="treatment_plan_templates")
    # Marley's drugs (Table → Drug Prescription)
    drugs = models.ManyToManyField("DrugPrescription", blank=True, related_name="treatment_plan_templates")
    # Order group (Link → Patient Encounter)
    order_group = models.ForeignKey(
        PatientEncounter, on_delete=models.SET_NULL, null=True, blank=True
    )
    # Inpatient
    is_inpatient = models.BooleanField(default=False)
    healthcare_service_unit_type = models.ForeignKey(
        HealthcareServiceUnitType, on_delete=models.SET_NULL, null=True, blank=True
    )
    expected_length_of_stay = models.IntegerField(default=0)
    treatment_counselling_required = models.BooleanField(default=False)
    # Extra fields
    therapy_type = models.ForeignKey(
        TherapyType, on_delete=models.SET_NULL, null=True, blank=True
    )
    total_sessions = models.IntegerField(default=10)
    duration_per_session = models.IntegerField(default=30)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "healthcare_treatment_plan_template"
        ordering = ["template_name"]

    def __str__(self):
        return self.template_name


# ══════════════════════════════════════════════════════════════════════════════
# INSURANCE
# ══════════════════════════════════════════════════════════════════════════════

class InsurancePayor(BaseModel):
    """Insurance companies / payors."""
    payor_name = models.CharField(max_length=200, unique=True)
    payor_id = models.CharField(max_length=50, blank=True, default="")
    description = models.TextField(blank=True, default="")
    contact_email = models.EmailField(blank=True, default="")
    contact_phone = models.CharField(max_length=20, blank=True, default="")
    address = models.TextField(blank=True, default="")
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "healthcare_insurance_payor"
        ordering = ["payor_name"]

    def __str__(self):
        return self.payor_name


class InsurancePayorContract(BaseModel):
    """Contracts between hospital and payors."""
    contract_name = models.CharField(max_length=200)
    payor = models.ForeignKey(
        InsurancePayor, on_delete=models.CASCADE, related_name="contracts"
    )
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)
    coverage_percent = models.DecimalField(
        max_digits=5, decimal_places=2, default=100
    )
    max_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    is_active = models.BooleanField(default=True)
    terms = models.TextField(blank=True, default="")

    class Meta:
        db_table = "healthcare_insurance_payor_contract"
        ordering = ["-start_date"]

    def __str__(self):
        return f"{self.contract_name} ({self.payor})"


class PatientInsurancePolicy(BaseModel):
    """Patient's insurance policy."""
    policy_number = models.CharField(max_length=100, unique=True)
    patient = models.ForeignKey(
        Patient, on_delete=models.CASCADE, related_name="insurance_policies"
    )
    payor = models.ForeignKey(
        InsurancePayor, on_delete=models.CASCADE, related_name="policies"
    )
    contract = models.ForeignKey(
        InsurancePayorContract, on_delete=models.SET_NULL, null=True, blank=True
    )
    coverage_type = models.CharField(
        max_length=50, default="Individual",
        choices=[("Individual", "Individual"), ("Family", "Family"),
                 ("Group", "Group")],
    )
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)
    coverage_percent = models.DecimalField(
        max_digits=5, decimal_places=2, default=100
    )
    max_coverage = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    deductible = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "healthcare_patient_insurance_policy"
        ordering = ["-start_date"]

    def __str__(self):
        return f"{self.policy_number} - {self.patient}"


class InsuranceClaim(BaseModel):
    """Insurance claims."""
    claim_id = models.CharField(max_length=50, unique=True, blank=True)
    patient = models.ForeignKey(
        Patient, on_delete=models.CASCADE, related_name="insurance_claims"
    )
    policy = models.ForeignKey(
        PatientInsurancePolicy, on_delete=models.SET_NULL, null=True, blank=True
    )
    payor = models.ForeignKey(
        InsurancePayor, on_delete=models.SET_NULL, null=True, blank=True
    )
    encounter = models.ForeignKey(
        PatientEncounter, on_delete=models.SET_NULL, null=True, blank=True
    )
    claim_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    approved_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    status = models.CharField(
        max_length=30, default="Draft",
        choices=[
            ("Draft", "Draft"), ("Submitted", "Submitted"),
            ("Under Review", "Under Review"), ("Approved", "Approved"),
            ("Partially Approved", "Partially Approved"),
            ("Rejected", "Rejected"), ("Paid", "Paid"),
        ],
    )
    submitted_date = models.DateField(null=True, blank=True)
    approved_date = models.DateField(null=True, blank=True)
    paid_date = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True, default="")

    class Meta:
        db_table = "healthcare_insurance_claim"
        ordering = ["-creation"]

    def __str__(self):
        return f"Claim: {self.claim_id} - {self.patient}"

    def save(self, *args, **kwargs):
        if not self.claim_id:
            last = InsuranceClaim.objects.order_by("-id").first()
            num = (last.id + 1) if last else 1
            self.claim_id = f"HLC-CLM-{num:05d}"
        super().save(*args, **kwargs)


# ══════════════════════════════════════════════════════════════════════════════
# INPATIENT
# ══════════════════════════════════════════════════════════════════════════════

class InpatientRecord(BaseModel):
    """Inpatient admission record."""
    record_id = models.CharField(max_length=50, unique=True, blank=True)
    patient = models.ForeignKey(
        Patient, on_delete=models.CASCADE, related_name="inpatient_records"
    )
    practitioner = models.ForeignKey(
        HealthcarePractitioner, on_delete=models.SET_NULL, null=True, blank=True
    )
    service_unit = models.ForeignKey(
        HealthcareServiceUnit, on_delete=models.SET_NULL, null=True, blank=True
    )
    department = models.ForeignKey(
        MedicalDepartment, on_delete=models.SET_NULL, null=True, blank=True
    )
    status = models.CharField(
        max_length=30, default="Admission Scheduled",
        choices=[
            ("Admission Scheduled", "Admission Scheduled"),
            ("Admitted", "Admitted"),
            ("Discharge Scheduled", "Discharge Scheduled"),
            ("Discharged", "Discharged"),
            ("Cancelled", "Cancelled"),
        ],
    )
    admission_date = models.DateField(null=True, blank=True)
    admission_time = models.TimeField(null=True, blank=True)
    discharge_date = models.DateField(null=True, blank=True)
    discharge_time = models.TimeField(null=True, blank=True)
    expected_discharge_date = models.DateField(null=True, blank=True)
    chief_complaint = models.TextField(blank=True, default="")
    discharge_summary = models.TextField(blank=True, default="")
    notes = models.TextField(blank=True, default="")
    height = models.DecimalField(max_digits=5, decimal_places=1, null=True, blank=True)
    weight = models.DecimalField(max_digits=5, decimal_places=1, null=True, blank=True)

    class Meta:
        db_table = "healthcare_inpatient_record"
        ordering = ["-admission_date"]

    def __str__(self):
        return f"Inpatient: {self.patient} ({self.status})"

    def save(self, *args, **kwargs):
        if not self.record_id:
            last = InpatientRecord.objects.order_by("-id").first()
            num = (last.id + 1) if last else 1
            self.record_id = f"HLC-INP-{num:05d}"
        super().save(*args, **kwargs)


class InpatientMedicationEntry(BaseModel):
    """
    Marley Inpatient Medication Entry (Medication Dispensing & Stock Issuance)
    """
    entry_id = models.CharField(max_length=50, unique=True, null=True, blank=True)
    company = models.ForeignKey(
        "setup.Company", on_delete=models.SET_NULL, null=True, blank=True
    )
    posting_date = models.DateField(default=timezone.now)
    status = models.CharField(
        max_length=20, default="Draft",
        choices=[("Draft", "Draft"), ("Submitted", "Submitted"), ("Cancelled", "Cancelled")],
    )
    warehouse = models.ForeignKey(
        "healthcare.PharmacyWarehouse", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="inpatient_medication_entries",
        help_text="Pharmacy warehouse from which medications are issued.",
    )
    patient = models.ForeignKey(
        Patient, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="inpatient_medication_entries",
    )
    service_unit = models.ForeignKey(
        HealthcareServiceUnit, on_delete=models.SET_NULL, null=True, blank=True
    )
    practitioner = models.ForeignKey(
        HealthcarePractitioner, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="prescribed_medication_entries",
    )
    assigned_to_practitioner = models.ForeignKey(
        HealthcarePractitioner, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="assigned_medication_entries",
    )
    item_code = models.CharField(
        max_length=140, blank=True, default="",
        help_text="Filter orders by specific drug item",
    )
    from_date = models.DateField(null=True, blank=True)
    to_date = models.DateField(null=True, blank=True)
    from_time = models.TimeField(null=True, blank=True)
    to_time = models.TimeField(null=True, blank=True)
    update_stock = models.BooleanField(
        default=True,
        help_text="Automatically create Material Issue stock entry on submit.",
    )
    stock_entry = models.ForeignKey(
        "healthcare.PharmacyStockEntry", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="inpatient_medication_entries",
    )
    remarks = models.TextField(blank=True, default="")
    # Backwards-compatibility fields
    inpatient_record = models.ForeignKey(
        InpatientRecord, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="medication_entries",
    )
    medication_name = models.CharField(max_length=280, blank=True, default="")
    dosage = models.CharField(max_length=100, blank=True, default="")
    frequency = models.CharField(max_length=100, blank=True, default="")
    route = models.CharField(max_length=50, blank=True, default="")
    entry_date = models.DateField(null=True, blank=True)
    entry_time = models.TimeField(null=True, blank=True)
    notes = models.TextField(blank=True, default="")

    class Meta:
        db_table = "healthcare_inpatient_medication_entry"
        ordering = ["-posting_date", "-id"]

    def __str__(self):
        return f"{self.entry_id or 'Draft Entry'} - {self.posting_date}"

    def save(self, *args, **kwargs):
        if not self.entry_id:
            year = timezone.now().year
            last = InpatientMedicationEntry.objects.filter(
                entry_id__startswith=f"HLC-IME-{year}-"
            ).order_by("-id").first()
            num = 1
            if last and last.entry_id:
                try:
                    num = int(last.entry_id.split("-")[-1]) + 1
                except Exception:
                    num = last.id + 1
            self.entry_id = f"HLC-IME-{year}-{num:05d}"
        if not self.entry_date and self.posting_date:
            self.entry_date = self.posting_date
        super().save(*args, **kwargs)


class InpatientMedicationEntryDetail(BaseModel):
    """
    Marley Inpatient Medication Entry Detail line items
    """
    entry = models.ForeignKey(
        InpatientMedicationEntry, on_delete=models.CASCADE, related_name="medication_orders"
    )
    patient = models.ForeignKey(
        Patient, on_delete=models.CASCADE, related_name="medication_entry_details"
    )
    patient_name = models.CharField(max_length=200, blank=True, default="")
    inpatient_record = models.ForeignKey(
        InpatientRecord, on_delete=models.SET_NULL, null=True, blank=True
    )
    service_unit = models.ForeignKey(
        HealthcareServiceUnit, on_delete=models.SET_NULL, null=True, blank=True
    )
    drug = models.CharField(
        max_length=140, blank=True, default="",
        help_text="Item / drug name",
    )
    drug_code = models.CharField(max_length=140, blank=True, default="")
    drug_name = models.CharField(max_length=200, blank=True, default="")
    dosage = models.CharField(max_length=100, blank=True, default="")
    dosage_form = models.CharField(max_length=100, blank=True, default="")
    medication_order = models.ForeignKey(
        "InpatientMedicationOrder", on_delete=models.SET_NULL, null=True, blank=True
    )
    medication_order_entry = models.ForeignKey(
        "InpatientMedicationOrderEntry", on_delete=models.SET_NULL, null=True, blank=True
    )
    date = models.DateField(default=timezone.now)
    time = models.TimeField(null=True, blank=True)
    quantity = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("1.00"))
    is_completed = models.BooleanField(default=False)
    instructions = models.TextField(blank=True, default="")

    class Meta:
        db_table = "healthcare_inpatient_medication_entry_detail"
        ordering = ["date", "time"]

    def __str__(self):
        return f"{self.drug_name or self.drug_code} for {self.patient_name or self.patient_id}"


class InpatientOccupancy(BaseModel):
    """Track bed occupancy over time."""
    inpatient_record = models.ForeignKey(
        InpatientRecord, on_delete=models.CASCADE, related_name="occupancies"
    )
    service_unit = models.ForeignKey(
        HealthcareServiceUnit, on_delete=models.CASCADE
    )
    start_date = models.DateField()
    start_time = models.TimeField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    end_time = models.TimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "healthcare_inpatient_occupancy"
        ordering = ["-start_date"]

    def __str__(self):
        return f"{self.inpatient_record} in {self.service_unit}"


# ══════════════════════════════════════════════════════════════════════════════
# OBSERVATION & CLINICAL NOTES
# ══════════════════════════════════════════════════════════════════════════════

class Observation(BaseModel):
    """Clinical observation — Marley parity with all fields."""
    naming_series = models.CharField(max_length=50, default="HLC-OBS-.YYYY.-", blank=True)
    company = models.ForeignKey(
        "setup.Company", on_delete=models.SET_NULL, null=True, blank=True
    )
    observation_template = models.ForeignKey(
        "ObservationTemplate", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="observations_using_template"
    )
    posting_date = models.DateField(auto_now_add=True)
    observation_category = models.CharField(
        max_length=100, blank=True, default="",
        choices=[("", ""), ("Vital Signs", "Vital Signs"), ("Lab", "Lab"),
                 ("Imaging", "Imaging"), ("Survey", "Survey"), ("Exam", "Exam"),
                 ("Procedure", "Procedure"), ("Device", "Device"),
                 ("Laboratory", "Laboratory"), ("Activity", "Activity"),
                 ("Assessment", "Assessment"), (" Imaging", " Imaging"),
                 ("Social History", "Social History"), ("Survey", "Survey"),
                 ("Vital Signs", "Vital Signs"), ("Activity", "Activity"),
                 ("Laboratory", "Laboratory"), ("Exam", "Exam"),
                 ("Device", "Device"), ("Procedure", "Procedure"),
                 ("Assessment", "Assessment"), ("Social History", "Social History")],
    )
    status = models.CharField(
        max_length=30, default="Registered",
        choices=[("Registered", "Registered"), ("Preliminary", "Preliminary"),
                 ("Final", "Final"), ("Amended", "Amended"),
                 ("Corrected", "Corrected"), ("Cancelled", "Cancelled"),
                 ("Entered-in-error", "Entered-in-error"),
                 ("Submitted", "Submitted"), ("Draft", "Draft")],
    )
    patient = models.ForeignKey(
        Patient, on_delete=models.CASCADE, related_name="observations"
    )
    encounter = models.ForeignKey(
        PatientEncounter, on_delete=models.SET_NULL, null=True, blank=True
    )
    appointment = models.ForeignKey(
        PatientAppointment, on_delete=models.SET_NULL, null=True, blank=True
    )
    practitioner = models.ForeignKey(
        HealthcarePractitioner, on_delete=models.SET_NULL, null=True, blank=True
    )
    medical_department = models.ForeignKey(
        MedicalDepartment, on_delete=models.SET_NULL, null=True, blank=True
    )

    # Template Details
    has_component = models.BooleanField(default=False)
    sample_collection_required = models.BooleanField(default=False)
    sample = models.CharField(max_length=200, blank=True, default="")
    permitted_data_type = models.CharField(max_length=50, blank=True, default="")

    # Sample Details
    sample_collection_time = models.DateTimeField(null=True, blank=True)
    sample_status = models.CharField(
        max_length=30, blank=True, default="",
        choices=[("", ""), ("Collected", "Collected"), ("In Lab", "In Lab"),
                 ("Received", "Received"), ("Discarded", "Discarded"),
                 ("Under Process", "Under Process"), ("Completed", "Completed")],
    )

    # Result
    observation_type = models.CharField(max_length=140, blank=True, default="")
    value = models.TextField(blank=True, default="")
    unit = models.CharField(max_length=50, blank=True, default="")
    reference_range = models.CharField(max_length=100, blank=True, default="")
    result = models.CharField(max_length=255, blank=True, default="")
    observation_date = models.DateField(null=True, blank=True)  # legacy compat

    # Note
    notes = models.TextField(blank=True, default="")
    description = models.TextField(blank=True, default="")

    def __str__(self):
        return f"{self.observation_type or self.naming_series}: {self.value} {self.unit}"

    def save(self, *args, **kwargs):
        if self.observation_template and not self.observation_type:
            self.observation_type = self.observation_template.observation
        if self.observation_template and not self.observation_category:
            self.observation_category = self.observation_template.observation_category
        if self.observation_template and not self.permitted_data_type:
            self.permitted_data_type = self.observation_template.permitted_data_type
        super().save(*args, **kwargs)


class ClinicalNote(BaseModel):
    """Clinical notes linked to encounters."""
    encounter = models.ForeignKey(
        PatientEncounter, on_delete=models.CASCADE, related_name="clinical_notes_list"
    )
    note_type = models.CharField(
        max_length=50, default="Progress Note",
        choices=[("Progress Note", "Progress Note"), ("Discharge Note", "Discharge Note"),
                 ("Pre-Op Note", "Pre-Op Note"), ("Post-Op Note", "Post-Op Note"),
                 ("Consultation Note", "Consultation Note")],
    )
    author = models.ForeignKey(
        HealthcarePractitioner, on_delete=models.SET_NULL, null=True, blank=True
    )
    note_content = models.TextField()
    is_confidential = models.BooleanField(
        default=False,
        help_text="Restricted confidential note accessible only by authorized treating practitioner",
    )
    note_date = models.DateField(auto_now_add=True)
    note_time = models.TimeField(null=True, blank=True)

    class Meta:
        db_table = "healthcare_clinical_note"
        ordering = ["-note_date", "-note_time"]

    def __str__(self):
        return f"{self.note_type} - {self.encounter}"


# ══════════════════════════════════════════════════════════════════════════════
# HEALTHCARE SETTINGS & FEES
# ══════════════════════════════════════════════════════════════════════════════

class HealthcareSettings(BaseModel):
    """Global healthcare module settings."""
    default_currency = models.ForeignKey(
        "setup.Currency", on_delete=models.SET_NULL, null=True, blank=True
    )
    enable_invoice = models.BooleanField(default=True)
    enable_prescriptions = models.BooleanField(default=True)
    enable_therapy = models.BooleanField(default=True)
    enable_inpatient = models.BooleanField(default=True)
    enable_insurance = models.BooleanField(default=True)
    enable_telehealth = models.BooleanField(default=False)
    auto_create_customer = models.BooleanField(default=True)
    auto_create_invoice = models.BooleanField(default=False)
    patient_id_prefix = models.CharField(max_length=20, default="HLC-PAT-")
    practitioner_id_prefix = models.CharField(max_length=20, default="HLC-PRA-")
    follow_up_validity_days = models.IntegerField(default=7, help_text="Days for fee validity after consultation")
    collect_registration_fee = models.BooleanField(default=False)
    registration_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    # Marley's Healthcare Settings: the two switches its Lab Test flow reads.
    # "Do not print or email Lab Tests without Approval" — gates the form's
    # Approve/Reject actions; default off, as in Marley.
    lab_test_approval_required = models.BooleanField(default=False)
    # "Create Sample Collection document for Lab Test" — each new Lab Test
    # mints (or extends) a Sample Collection; default off, as in Marley.
    create_sample_collection_for_lab_test = models.BooleanField(default=False)
    # "validate_nursing_checklists" — Marley's submit gate: a document with
    # mandatory Nursing Tasks still open cannot be submitted; default off.
    validate_nursing_checklists = models.BooleanField(default=False)

    class Meta:
        db_table = "healthcare_settings"

    def __str__(self):
        return "Healthcare Settings"


class FeeValidity(BaseModel):
    """Fee validity for follow-up visits."""
    practitioner = models.ForeignKey(
        HealthcarePractitioner, on_delete=models.CASCADE, related_name="fee_validities"
    )
    patient = models.ForeignKey(
        Patient, on_delete=models.CASCADE, related_name="fee_validities",
        null=True, blank=True,
    )
    valid_from = models.DateField()
    valid_till = models.DateField()
    invoice = models.CharField(max_length=100, blank=True, default="")
    visit_count = models.IntegerField(default=0)
    max_visits = models.IntegerField(default=1)

    class Meta:
        db_table = "healthcare_fee_validity"
        ordering = ["-valid_from"]

    def __str__(self):
        return f"Fee Validity: {self.practitioner} ({self.valid_from} to {self.valid_till})"


# ══════════════════════════════════════════════════════════════════════════════
# REFERENCE DATA (MISSING FROM INITIAL BUILD)
# ══════════════════════════════════════════════════════════════════════════════

class DosageForm(BaseModel):
    """Dosage forms: Tablet, Capsule, Syrup, etc."""
    dosage_form = models.CharField(max_length=140, unique=True)

    class Meta:
        db_table = "healthcare_dosage_form"
        ordering = ["dosage_form"]

    def __str__(self):
        return self.dosage_form


class DosageStrength(BaseModel):
    """Strength values for a dosage."""
    dosage_form = models.ForeignKey(
        DosageForm, on_delete=models.CASCADE, related_name="strengths"
    )
    strength = models.CharField(max_length=140)
    strength_uom = models.CharField(max_length=50, blank=True, default="mg")

    class Meta:
        db_table = "healthcare_dosage_strength"
        ordering = ["dosage_form", "strength"]

    def __str__(self):
        return f"{self.strength} {self.strength_uom}"


class BodyPart(BaseModel):
    """Body parts for examination and therapy."""
    body_part = models.CharField(max_length=140, unique=True)

    class Meta:
        db_table = "healthcare_body_part"
        ordering = ["body_part"]

    def __str__(self):
        return self.body_part


class SampleType(BaseModel):
    """Lab sample types: Blood, Urine, CSF, etc."""
    sample_type = models.CharField(max_length=140, unique=True)

    class Meta:
        db_table = "healthcare_sample_type"
        ordering = ["sample_type"]

    def __str__(self):
        return self.sample_type


class PatientCareType(BaseModel):
    """Types of patient care: Inpatient, Outpatient, Emergency."""
    patient_care_type = models.CharField(max_length=140, unique=True)
    description = models.TextField(blank=True, default="")

    class Meta:
        db_table = "healthcare_patient_care_type"
        ordering = ["patient_care_type"]

    def __str__(self):
        return self.patient_care_type


class AppointmentTypeConfig(BaseModel):
    """Appointment type configuration with duration and color."""
    appointment_type = models.CharField(max_length=140, unique=True)
    default_duration = models.IntegerField(default=30, help_text="Minutes")
    color = models.CharField(max_length=20, blank=True, default="#4F46E5")
    allow_booking_for = models.CharField(
        max_length=30, default="All",
        choices=[("All", "All"), ("Practitioners", "Practitioners"), ("Patients", "Patients")],
    )

    class Meta:
        db_table = "healthcare_appointment_type_config"
        ordering = ["appointment_type"]

    def __str__(self):
        return self.appointment_type


class MedicationClass(BaseModel):
    """Medication classification: Antibiotic, Analgesic, etc."""
    medication_class = models.CharField(max_length=140, unique=True)

    class Meta:
        db_table = "healthcare_medication_class"
        ordering = ["medication_class"]

    def __str__(self):
        return self.medication_class


class Complaint(BaseModel):
    """Common patient complaints for quick selection."""
    complaint = models.CharField(max_length=280, unique=True)

    class Meta:
        db_table = "healthcare_complaint"
        ordering = ["complaint"]

    def __str__(self):
        return self.complaint


class TriageLevel(BaseModel):
    """ER triage levels: Immediate, Urgent, Semi-Urgent, Non-Urgent."""
    triage_level = models.CharField(max_length=140, unique=True)
    code = models.CharField(max_length=20, blank=True, default="")
    color = models.CharField(max_length=20, blank=True, default="#FF0000")
    priority = models.IntegerField(default=1, help_text="Lower = more urgent")
    target_reassessment_mins = models.IntegerField(
        default=0, help_text="Minutes before reassessment"
    )
    description = models.TextField(blank=True, default="")

    class Meta:
        db_table = "healthcare_triage_level"
        ordering = ["priority"]

    def __str__(self):
        return f"{self.triage_level} (P{self.priority})"


class HealthcareActivity(BaseModel):
    """Healthcare activities for nursing tasks."""
    activity = models.CharField(max_length=140, unique=True)
    description = models.TextField(blank=True, default="")
    activity_duration = models.IntegerField(default=0, help_text="Minutes")
    role = models.CharField(max_length=140, blank=True, default="")
    task_doctype = models.CharField(max_length=140, blank=True, default="")

    class Meta:
        db_table = "healthcare_activity"
        ordering = ["activity"]

    def __str__(self):
        return self.activity


# ══════════════════════════════════════════════════════════════════════════════
# MEDICATION MASTER DATA
# ══════════════════════════════════════════════════════════════════════════════

class Medication(BaseModel):
    """Medication master data with generic info, class, dosages."""
    generic_name = models.CharField(max_length=280)
    medication_class = models.ForeignKey(
        MedicationClass, on_delete=models.SET_NULL, null=True, blank=True
    )
    abbr = models.CharField(max_length=50, blank=True, default="")
    national_drug_code = models.CharField(max_length=50, blank=True, default="")
    is_combination = models.BooleanField(default=False)
    disabled = models.BooleanField(default=False)
    strength = models.CharField(max_length=50, blank=True, default="")
    strength_uom = models.CharField(max_length=20, blank=True, default="mg")
    dosage_form = models.ForeignKey(
        DosageForm, on_delete=models.SET_NULL, null=True, blank=True
    )
    default_prescription_dosage = models.CharField(max_length=100, blank=True, default="")
    default_prescription_duration = models.CharField(max_length=100, blank=True, default="")
    default_interval = models.CharField(max_length=50, blank=True, default="")
    default_interval_uom = models.CharField(max_length=30, blank=True, default="")
    reference_url = models.URLField(blank=True, default="")

    class Meta:
        db_table = "healthcare_medication"
        ordering = ["generic_name"]

    def __str__(self):
        return f"{self.generic_name} {self.strength}{self.strength_uom}"


class MedicationIngredient(BaseModel):
    """Ingredients for combination medications."""
    medication = models.ForeignKey(
        Medication, on_delete=models.CASCADE, related_name="ingredients"
    )
    ingredient_medication = models.ForeignKey(
        Medication, on_delete=models.CASCADE, related_name="used_in"
    )
    strength = models.DecimalField(max_digits=10, decimal_places=2)
    strength_uom = models.CharField(max_length=20, default="mg")

    class Meta:
        db_table = "healthcare_medication_ingredient"

    def __str__(self):
        return f"{self.medication} + {self.ingredient_medication}"


class MedicationLinkedItem(BaseModel):
    """Link medications to ERP stock items for billing."""
    medication = models.ForeignKey(
        Medication, on_delete=models.CASCADE, related_name="linked_items"
    )
    item = models.CharField(
        max_length=140, blank=True, default=""
    )
    is_billable = models.BooleanField(default=True)
    rate = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    class Meta:
        db_table = "healthcare_medication_linked_item"

    def __str__(self):
        return f"{self.medication} -> {self.item}"


class DrugInteraction(BaseModel):
    """Drug-drug interaction warnings."""
    drug1 = models.ForeignKey(
        Medication, on_delete=models.CASCADE, related_name="interactions_as_drug1"
    )
    drug2 = models.ForeignKey(
        Medication, on_delete=models.CASCADE, related_name="interactions_as_drug2"
    )
    severity = models.CharField(
        max_length=20, default="Moderate",
        choices=[("Mild", "Mild"), ("Moderate", "Moderate"), ("Severe", "Severe"), ("Contraindicated", "Contraindicated")],
    )
    description = models.TextField(blank=True, default="")
    recommendation = models.TextField(blank=True, default="")

    class Meta:
        db_table = "healthcare_drug_interaction"

    def __str__(self):
        return f"{self.drug1} + {self.drug2} ({self.severity})"


# ══════════════════════════════════════════════════════════════════════════════
# ALLERGY (PROPER MODEL)
# ══════════════════════════════════════════════════════════════════════════════

class Allergy(BaseModel):
    """Structured patient allergies."""
    patient = models.ForeignKey(
        Patient, on_delete=models.CASCADE, related_name="allergies_list"
    )
    allergy = models.CharField(max_length=280)
    allergy_type = models.CharField(
        max_length=30, default="Drug",
        choices=[("Drug", "Drug"), ("Food", "Food"), ("Environment", "Environment"),
                 ("Other", "Other")],
    )
    severity = models.CharField(
        max_length=20, default="Moderate",
        choices=[("Mild", "Mild"), ("Moderate", "Moderate"), ("Severe", "Severe"),
                 ("Fatal", "Fatal")],
    )
    reaction = models.TextField(blank=True, default="")
    status = models.CharField(
        max_length=20, default="Active",
        choices=[("Active", "Active"), ("Inactive", "Inactive"), ("Resolved", "Resolved")],
    )
    onset_date = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True, default="")

    class Meta:
        db_table = "healthcare_allergy"
        ordering = ["-creation"]

    def __str__(self):
        return f"{self.allergy} ({self.severity}) - {self.patient}"


class AllergyInteraction(BaseModel):
    """Interaction between allergy and medication."""
    allergy = models.ForeignKey(
        Allergy, on_delete=models.CASCADE, related_name="interactions"
    )
    medication = models.ForeignKey(
        Medication, on_delete=models.CASCADE, null=True, blank=True
    )
    reaction = models.TextField(blank=True, default="")
    severity = models.CharField(
        max_length=20, default="Severe",
        choices=[("Mild", "Mild"), ("Moderate", "Moderate"), ("Severe", "Severe")],
    )

    class Meta:
        db_table = "healthcare_allergy_interaction"


# ══════════════════════════════════════════════════════════════════════════════
# PATIENT RELATIONS
# ══════════════════════════════════════════════════════════════════════════════

class PatientRelation(BaseModel):
    """Patient family/next-of-kin relationships."""
    patient = models.ForeignKey(
        Patient, on_delete=models.CASCADE, related_name="relations"
    )
    related_patient = models.ForeignKey(
        Patient, on_delete=models.CASCADE, null=True, blank=True,
        related_name="related_to"
    )
    relation = models.CharField(
        max_length=20,
        choices=[("Father", "Father"), ("Mother", "Mother"), ("Spouse", "Spouse"),
                 ("Siblings", "Siblings"), ("Family", "Family"), ("Other", "Other")],
    )
    contact_name = models.CharField(max_length=200, blank=True, default="")
    contact_phone = models.CharField(max_length=20, blank=True, default="")
    description = models.TextField(blank=True, default="")

    class Meta:
        db_table = "healthcare_patient_relation"
        ordering = ["patient", "relation"]

    def __str__(self):
        return f"{self.patient} - {self.relation}"


# ══════════════════════════════════════════════════════════════════════════════
# EMERGENCY RECORD
# ══════════════════════════════════════════════════════════════════════════════

class EmergencyRecord(BaseModel):
    """Emergency department record."""
    record_id = models.CharField(max_length=50, unique=True, blank=True)
    patient = models.ForeignKey(
        Patient, on_delete=models.CASCADE, related_name="emergency_records"
    )
    status = models.CharField(
        max_length=30, default="Open",
        choices=[("Open", "Open"), ("In Treatment", "In Treatment"),
                 ("Discharged", "Discharged"), ("Admitted", "Admitted"),
                 ("Cancelled", "Cancelled")],
    )
    arrival_datetime = models.DateTimeField()
    arrival_mode = models.CharField(
        max_length=30, default="Walk-in",
        choices=[("Walk-in", "Walk-in"), ("Ambulance", "Ambulance"),
                 ("Helicopter", "Helicopter"), ("Police", "Police")],
    )
    chief_complaint = models.TextField(blank=True, default="")
    triage_level = models.ForeignKey(
        TriageLevel, on_delete=models.SET_NULL, null=True, blank=True
    )
    triage_datetime = models.DateTimeField(null=True, blank=True)
    triage_practitioner = models.ForeignKey(
        HealthcarePractitioner, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="triage_records",
    )
    attending_practitioner = models.ForeignKey(
        HealthcarePractitioner, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="emergency_attended",
    )
    department = models.ForeignKey(
        MedicalDepartment, on_delete=models.SET_NULL, null=True, blank=True
    )
    service_unit = models.ForeignKey(
        HealthcareServiceUnit, on_delete=models.SET_NULL, null=True, blank=True
    )
    disposition = models.CharField(
        max_length=30, blank=True, default="",
        choices=[("Discharged", "Discharged"), ("Admitted", "Admitted"),
                 ("Transferred", "Transferred"), ("AMA", "Against Medical Advice"), ("", "Pending")],
    )
    disposition_datetime = models.DateTimeField(null=True, blank=True)
    disposition_notes = models.TextField(blank=True, default="")
    inpatient_record = models.ForeignKey(
        InpatientRecord, on_delete=models.SET_NULL, null=True, blank=True
    )
    insurance_policy = models.CharField(max_length=140, blank=True, default="")
    insurance_payor = models.CharField(max_length=140, blank=True, default="")
    invoiced = models.BooleanField(default=False)
    notes = models.TextField(blank=True, default="")

    class Meta:
        db_table = "healthcare_emergency_record"
        ordering = ["-arrival_datetime"]

    def __str__(self):
        return f"ER: {self.patient} ({self.status})"

    def save(self, *args, **kwargs):
        if not self.record_id:
            last = EmergencyRecord.objects.order_by("-id").first()
            num = (last.id + 1) if last else 1
            self.record_id = f"HLC-ED-{num:05d}"
        super().save(*args, **kwargs)


# ══════════════════════════════════════════════════════════════════════════════
# DISCHARGE SUMMARY
# ══════════════════════════════════════════════════════════════════════════════

class DischargeSummary(BaseModel):
    """Discharge summary for inpatient records."""
    summary_id = models.CharField(max_length=50, unique=True, blank=True)
    inpatient_record = models.ForeignKey(
        InpatientRecord, on_delete=models.CASCADE, related_name="discharge_summaries"
    )
    patient = models.ForeignKey(
        Patient, on_delete=models.CASCADE, related_name="discharge_summaries"
    )
    discharge_practitioner = models.ForeignKey(
        HealthcarePractitioner, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="discharge_summaries",
    )
    posting_date = models.DateField(auto_now_add=True)
    status = models.CharField(
        max_length=20, default="Draft",
        choices=[("Draft", "Draft"), ("Completed", "Completed"),
                 ("Amended", "Amended")],
    )
    followup_date = models.DateField(null=True, blank=True)
    review_date = models.DateField(null=True, blank=True)
    chief_complaint = models.TextField(blank=True, default="")
    diagnosis = models.TextField(blank=True, default="")
    physical_examination = models.TextField(blank=True, default="")
    treatment_done = models.TextField(blank=True, default="")
    advice_on_discharge = models.TextField(blank=True, default="")
    diet_advised = models.TextField(blank=True, default="")
    current_issues = models.TextField(blank=True, default="")
    instructions = models.TextField(blank=True, default="")

    class Meta:
        db_table = "healthcare_discharge_summary"
        ordering = ["-posting_date"]

    def __str__(self):
        return f"Discharge: {self.patient} on {self.posting_date}"

    def save(self, *args, **kwargs):
        if not self.summary_id:
            last = DischargeSummary.objects.order_by("-id").first()
            num = (last.id + 1) if last else 1
            self.summary_id = f"HLC-DS-{num:05d}"
        super().save(*args, **kwargs)


# ══════════════════════════════════════════════════════════════════════════════
# NURSING TASKS
# ══════════════════════════════════════════════════════════════════════════════

class NursingTask(BaseModel):
    """Nursing tasks and checklists for inpatient care."""
    task_id = models.CharField(max_length=50, unique=True, blank=True)
    title = models.CharField(max_length=280)
    patient = models.ForeignKey(
        Patient, on_delete=models.CASCADE, related_name="nursing_tasks"
    )
    inpatient_record = models.ForeignKey(
        InpatientRecord, on_delete=models.SET_NULL, null=True, blank=True
    )
    activity = models.ForeignKey(
        HealthcareActivity, on_delete=models.SET_NULL, null=True, blank=True
    )
    mandatory = models.BooleanField(default=False)
    description = models.TextField(blank=True, default="")
    status = models.CharField(
        max_length=20, default="Open",
        choices=[("Open", "Open"), ("In Progress", "In Progress"),
                 ("Completed", "Completed"), ("Cancelled", "Cancelled")],
    )
    service_unit = models.ForeignKey(
        HealthcareServiceUnit, on_delete=models.SET_NULL, null=True, blank=True
    )
    department = models.ForeignKey(
        MedicalDepartment, on_delete=models.SET_NULL, null=True, blank=True
    )
    task_date = models.DateField(auto_now_add=True)
    requested_start_time = models.TimeField(null=True, blank=True)
    requested_end_time = models.TimeField(null=True, blank=True)
    task_start_time = models.TimeField(null=True, blank=True)
    task_end_time = models.TimeField(null=True, blank=True)
    notes = models.TextField(blank=True, default="")
    # Marley's Link + Dynamic Link pair (`reference_doctype` / `reference_name`)
    # that ties a task back to the document it was minted from.
    reference_doctype = models.CharField(max_length=140, blank=True, default="")
    reference_name = models.CharField(max_length=140, blank=True, default="")

    class Meta:
        db_table = "healthcare_nursing_task"
        ordering = ["-task_date", "-requested_start_time"]

    def __str__(self):
        return f"{self.title} - {self.patient}"

    def save(self, *args, **kwargs):
        if not self.task_id:
            last = NursingTask.objects.order_by("-id").first()
            num = (last.id + 1) if last else 1
            self.task_id = f"HLC-NT-{num:05d}"
        super().save(*args, **kwargs)


class NursingChecklistTemplate(BaseModel):
    """Template for nursing checklists."""
    template_name = models.CharField(max_length=200, unique=True)
    description = models.TextField(blank=True, default="")
    tasks = models.JSONField(default=list, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "healthcare_nursing_checklist_template"
        ordering = ["template_name"]

    def __str__(self):
        return self.template_name


# ══════════════════════════════════════════════════════════════════════════════
# PATIENT ASSESSMENT
# ══════════════════════════════════════════════════════════════════════════════

class PatientAssessmentTemplate(BaseModel):
    """Assessment template with parameters and scoring."""
    template_name = models.CharField(max_length=200, unique=True)
    description = models.TextField(blank=True, default="")
    parameters = models.JSONField(
        default=list, blank=True,
        help_text="List of parameters: [{name, type, options, score_values}]"
    )
    scale_min = models.IntegerField(default=0)
    scale_max = models.IntegerField(default=100)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "healthcare_patient_assessment_template"
        ordering = ["template_name"]

    def __str__(self):
        return self.template_name


class PatientAssessment(BaseModel):
    """Patient assessment with scoring."""
    assessment_id = models.CharField(max_length=50, unique=True, blank=True)
    patient = models.ForeignKey(
        Patient, on_delete=models.CASCADE, related_name="assessments"
    )
    template = models.ForeignKey(
        PatientAssessmentTemplate, on_delete=models.SET_NULL, null=True, blank=True
    )
    practitioner = models.ForeignKey(
        HealthcarePractitioner, on_delete=models.SET_NULL, null=True, blank=True
    )
    therapy_session = models.ForeignKey(
        TherapySession, on_delete=models.SET_NULL, null=True, blank=True
    )
    assessment_datetime = models.DateTimeField(auto_now_add=True)
    assessment_description = models.TextField(blank=True, default="")
    scores = models.JSONField(default=dict, blank=True)
    total_score_obtained = models.DecimalField(
        max_digits=8, decimal_places=2, default=0
    )
    total_score = models.DecimalField(max_digits=8, decimal_places=2, default=100)

    class Meta:
        db_table = "healthcare_patient_assessment"
        ordering = ["-assessment_datetime"]

    def __str__(self):
        return f"Assessment: {self.patient} ({self.total_score_obtained}/{self.total_score})"

    def save(self, *args, **kwargs):
        if not self.assessment_id:
            last = PatientAssessment.objects.order_by("-id").first()
            num = (last.id + 1) if last else 1
            self.assessment_id = f"HLC-AS-{num:05d}"
        super().save(*args, **kwargs)


# ══════════════════════════════════════════════════════════════════════════════
# SERVICE REQUEST (FHIR-style)
# ══════════════════════════════════════════════════════════════════════════════

class ServiceRequestCategory(BaseModel):
    """Service request categories."""
    category = models.CharField(max_length=140, unique=True)
    description = models.TextField(blank=True, default="")

    class Meta:
        db_table = "healthcare_service_request_category"
        ordering = ["category"]

    def __str__(self):
        return self.category


class ServiceRequest(BaseModel):
    """FHIR-style service requests: lab orders, imaging, referrals."""
    request_id = models.CharField(max_length=50, unique=True, blank=True)
    title = models.CharField(max_length=280, blank=True, default="")
    patient = models.ForeignKey(
        Patient, on_delete=models.CASCADE, related_name="service_requests"
    )
    practitioner = models.ForeignKey(
        HealthcarePractitioner, on_delete=models.SET_NULL, null=True, blank=True
    )
    department = models.ForeignKey(
        MedicalDepartment, on_delete=models.SET_NULL, null=True, blank=True
    )
    category = models.ForeignKey(
        ServiceRequestCategory, on_delete=models.SET_NULL, null=True, blank=True
    )
    status = models.CharField(
        max_length=20, default="Draft",
        choices=[("Draft", "Draft"), ("Active", "Active"), ("Completed", "Completed"),
                 ("Cancelled", "Cancelled"), ("On Hold", "On Hold")],
    )
    intent = models.CharField(
        max_length=20, default="Order",
        choices=[("Order", "Order"), ("Plan", "Plan"), ("Proposal", "Proposal")],
    )
    priority = models.CharField(
        max_length=20, default="Routine",
        choices=[("Routine", "Routine"), ("Urgent", "Urgent"),
                 ("STAT", "STAT"), ("ASAP", "ASAP")],
    )
    order_date = models.DateField(auto_now_add=True)
    expected_date = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True, default="")
    reference_doctype = models.CharField(max_length=140, blank=True, default="")
    reference_name = models.CharField(max_length=140, blank=True, default="")

    class Meta:
        db_table = "healthcare_service_request"
        ordering = ["-order_date"]

    def __str__(self):
        return f"{self.title or self.request_id} - {self.patient}"

    def save(self, *args, **kwargs):
        if not self.request_id:
            last = ServiceRequest.objects.order_by("-id").first()
            num = (last.id + 1) if last else 1
            self.request_id = f"HLC-SR-{num:05d}"
        super().save(*args, **kwargs)


# ══════════════════════════════════════════════════════════════════════════════
# TREATMENT COUNSELLING
# ══════════════════════════════════════════════════════════════════════════════

class TreatmentCounselling(BaseModel):
    """Treatment counselling records for patients."""
    counselling_id = models.CharField(max_length=50, unique=True, blank=True)
    patient = models.ForeignKey(
        Patient, on_delete=models.CASCADE, related_name="counsellings"
    )
    practitioner = models.ForeignKey(
        HealthcarePractitioner, on_delete=models.SET_NULL, null=True, blank=True
    )
    treatment_plan_template = models.ForeignKey(
        TreatmentPlanTemplate, on_delete=models.SET_NULL, null=True, blank=True
    )
    status = models.CharField(
        max_length=20, default="Draft",
        choices=[("Draft", "Draft"), ("Scheduled", "Scheduled"),
                 ("Completed", "Completed"), ("Cancelled", "Cancelled")],
    )
    encounter = models.ForeignKey(
        PatientEncounter, on_delete=models.SET_NULL, null=True, blank=True
    )
    department = models.ForeignKey(
        MedicalDepartment, on_delete=models.SET_NULL, null=True, blank=True
    )
    terms = models.TextField(blank=True, default="")
    amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    paid_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    notes = models.TextField(blank=True, default="")

    class Meta:
        db_table = "healthcare_treatment_counselling"
        ordering = ["-creation"]

    def __str__(self):
        return f"Counselling: {self.patient} ({self.status})"

    def save(self, *args, **kwargs):
        if not self.counselling_id:
            last = TreatmentCounselling.objects.order_by("-id").first()
            num = (last.id + 1) if last else 1
            self.counselling_id = f"HLC-TC-{num:05d}"
        super().save(*args, **kwargs)


# ══════════════════════════════════════════════════════════════════════════════
# INPATIENT MEDICATION ORDERS
# ══════════════════════════════════════════════════════════════════════════════

class InpatientMedicationOrder(BaseModel):
    """Formal medication orders for inpatients."""
    order_id = models.CharField(max_length=50, unique=True, blank=True)
    inpatient_record = models.ForeignKey(
        InpatientRecord, on_delete=models.CASCADE, related_name="medication_orders"
    )
    patient = models.ForeignKey(
        Patient, on_delete=models.CASCADE, related_name="inpatient_med_orders"
    )
    practitioner = models.ForeignKey(
        HealthcarePractitioner, on_delete=models.SET_NULL, null=True, blank=True
    )
    medication_name = models.CharField(max_length=280)
    dosage = models.CharField(max_length=100, blank=True, default="")
    frequency = models.CharField(max_length=100, blank=True, default="")
    route = models.CharField(max_length=50, blank=True, default="")
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)
    status = models.CharField(
        max_length=20, default="Active",
        choices=[("Active", "Active"), ("Completed", "Completed"),
                 ("Cancelled", "Cancelled"), ("On Hold", "On Hold")],
    )
    notes = models.TextField(blank=True, default="")

    class Meta:
        db_table = "healthcare_inpatient_medication_order"
        ordering = ["-start_date"]

    def __str__(self):
        return f"Order: {self.medication_name} for {self.patient}"

    def save(self, *args, **kwargs):
        if not self.order_id:
            last = InpatientMedicationOrder.objects.order_by("-id").first()
            num = (last.id + 1) if last else 1
            self.order_id = f"HLC-MO-{num:05d}"
        super().save(*args, **kwargs)


# ══════════════════════════════════════════════════════════════════════════════
# INSURANCE CLAIM COVERAGE (line items)
# ══════════════════════════════════════════════════════════════════════════════

class InsuranceClaimCoverage(BaseModel):
    """Line items on an insurance claim."""
    claim = models.ForeignKey(
        InsuranceClaim, on_delete=models.CASCADE, related_name="coverages"
    )
    service_description = models.CharField(max_length=280)
    service_code = models.CharField(max_length=50, blank=True, default="")
    quantity = models.IntegerField(default=1)
    unit_price = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    approved_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    notes = models.TextField(blank=True, default="")

    class Meta:
        db_table = "healthcare_insurance_claim_coverage"
        ordering = ["-creation"]

    def __str__(self):
        return f"{self.service_description} - ${self.amount}"


class PatientInsuranceCoverage(BaseModel):
    """Detailed coverage items for patient insurance."""
    policy = models.ForeignKey(
        PatientInsurancePolicy, on_delete=models.CASCADE, related_name="coverages"
    )
    service_type = models.CharField(max_length=140)
    coverage_percent = models.DecimalField(max_digits=5, decimal_places=2, default=100)
    max_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    copay = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    deductible = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    notes = models.TextField(blank=True, default="")

    class Meta:
        db_table = "healthcare_patient_insurance_coverage"
        ordering = ["service_type"]

    def __str__(self):
        return f"{self.service_type} ({self.coverage_percent}%)"


# ══════════════════════════════════════════════════════════════════════════════
# HEALTHCARE PAYMENT RECORD
# ══════════════════════════════════════════════════════════════════════════════

class HealthcarePaymentRecord(BaseModel):
    """Payment records for healthcare services."""
    payment_id = models.CharField(max_length=100, unique=True, blank=True)
    order_id = models.CharField(max_length=100, blank=True, default="")
    patient = models.ForeignKey(
        Patient, on_delete=models.CASCADE, related_name="payments"
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True
    )
    amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    amount_with_gst = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    status = models.CharField(
        max_length=20, default="Pending",
        choices=[("Pending", "Pending"), ("Completed", "Completed"),
                 ("Failed", "Failed"), ("Refunded", "Refunded")],
    )
    payment_for_doctype = models.CharField(max_length=140, blank=True, default="")
    payment_for_document = models.CharField(max_length=140, blank=True, default="")
    failure_reason = models.TextField(blank=True, default="")

    class Meta:
        db_table = "healthcare_payment_record"
        ordering = ["-creation"]

    def __str__(self):
        return f"Payment {self.payment_id}: ${self.amount} ({self.status})"

    def save(self, *args, **kwargs):
        if not self.payment_id:
            last = HealthcarePaymentRecord.objects.order_by("-id").first()
            num = (last.id + 1) if last else 1
            self.payment_id = f"HLC-PAY-{num:05d}"
        super().save(*args, **kwargs)


# ══════════════════════════════════════════════════════════════════════════════
# PRESCRIPTION REFERENCE DATA (Marley - Missing)
# ══════════════════════════════════════════════════════════════════════════════

class PrescriptionDosage(BaseModel):
    """Standard prescription dosages: 1-0-1, 1-1-1, etc."""
    dosage = models.CharField(max_length=140, unique=True)
    description = models.TextField(blank=True, default="")

    class Meta:
        db_table = "healthcare_prescription_dosage"
        ordering = ["dosage"]

    def __str__(self):
        return self.dosage


class PrescriptionDuration(BaseModel):
    """Standard prescription durations: 5 Days, 1 Week, etc."""
    number = models.IntegerField()
    period = models.CharField(
        max_length=20,
        choices=[("Day", "Day"), ("Week", "Week"), ("Month", "Month"),
                 ("Year", "Year"), ("Hour", "Hour")],
    )

    class Meta:
        db_table = "healthcare_prescription_duration"
        unique_together = ["number", "period"]
        ordering = ["number", "period"]

    def __str__(self):
        return f"{self.number} {self.period}(s)"


# ══════════════════════════════════════════════════════════════════════════════
# LAB & PROCEDURE PRESCRIPTIONS (Marley - Missing)
# ══════════════════════════════════════════════════════════════════════════════

class LabPrescription(BaseModel):
    """Lab test prescriptions from encounters (child table)."""
    encounter = models.ForeignKey(
        PatientEncounter, on_delete=models.CASCADE,
        related_name="lab_prescriptions", null=True, blank=True,
    )
    patient = models.ForeignKey(
        Patient, on_delete=models.CASCADE, related_name="lab_prescriptions"
    )
    # Marley's field name for this Link is `lab_test_code` (pointing at a
    # Lab Test Template); `lab_test_name` is fetched from it.
    lab_test_code = models.ForeignKey(
        LabTestTemplate, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="lab_prescriptions",
    )
    lab_test_name = models.CharField(max_length=200, blank=True, default="")
    lab_test_comment = models.TextField(blank=True, default="")
    invoiced = models.BooleanField(default=False)
    lab_test_created = models.BooleanField(default=False)
    observation_template = models.ForeignKey(
        "ObservationTemplate", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="lab_prescriptions",
    )
    patient_care_type = models.ForeignKey(
        "PatientCareType", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="lab_prescriptions",
    )
    service_request = models.ForeignKey(
        ServiceRequest, on_delete=models.SET_NULL, null=True, blank=True
    )
    intent = models.CharField(max_length=20, default="Order", blank=True)
    priority = models.CharField(max_length=20, default="Routine", blank=True)

    class Meta:
        db_table = "healthcare_lab_prescription"
        ordering = ["-creation"]

    def __str__(self):
        return f"Lab Rx: {self.lab_test_name} for {self.patient}"


class ProcedurePrescription(BaseModel):
    """Procedure prescriptions from encounters (child table)."""
    encounter = models.ForeignKey(
        PatientEncounter, on_delete=models.CASCADE,
        related_name="procedure_prescriptions", null=True, blank=True,
    )
    patient = models.ForeignKey(
        Patient, on_delete=models.CASCADE, related_name="procedure_prescriptions"
    )
    procedure = models.ForeignKey(
        ClinicalProcedureTemplate, on_delete=models.SET_NULL, null=True, blank=True
    )
    procedure_name = models.CharField(max_length=200, blank=True, default="")
    department = models.ForeignKey(
        MedicalDepartment, on_delete=models.SET_NULL, null=True, blank=True
    )
    practitioner = models.ForeignKey(
        HealthcarePractitioner, on_delete=models.SET_NULL, null=True, blank=True
    )
    no_of_sessions = models.IntegerField(default=1)
    interval = models.CharField(max_length=50, blank=True, default="")
    date = models.DateField(null=True, blank=True)
    comments = models.TextField(blank=True, default="")
    invoiced = models.BooleanField(default=False)
    appointment_booked = models.BooleanField(default=False)
    procedure_created = models.BooleanField(default=False)
    patient_care_type = models.ForeignKey(
        "PatientCareType", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="procedure_prescriptions",
    )
    service_request = models.ForeignKey(
        ServiceRequest, on_delete=models.SET_NULL, null=True, blank=True
    )
    intent = models.CharField(max_length=20, default="Order", blank=True)
    priority = models.CharField(max_length=20, default="Routine", blank=True)

    class Meta:
        db_table = "healthcare_procedure_prescription"
        ordering = ["-creation"]

    def __str__(self):
        return f"Procedure Rx: {self.procedure_name} for {self.patient}"


# ══════════════════════════════════════════════════════════════════════════════
# DIAGNOSTIC REPORT (Marley - Missing)
# ══════════════════════════════════════════════════════════════════════════════

class DiagnosticReport(BaseModel):
    """Diagnostic report linking observations and lab tests."""
    report_id = models.CharField(max_length=50, unique=True, blank=True)
    title = models.CharField(max_length=280, blank=True, default="")
    patient = models.ForeignKey(
        Patient, on_delete=models.CASCADE, related_name="diagnostic_reports"
    )
    practitioner = models.ForeignKey(
        HealthcarePractitioner, on_delete=models.SET_NULL, null=True, blank=True
    )
    status = models.CharField(
        max_length=20, default="Draft",
        choices=[("Draft", "Draft"), ("Active", "Active"),
                 ("Completed", "Completed"), ("Cancelled", "Cancelled")],
    )
    ref_doctype = models.CharField(max_length=140, blank=True, default="")
    docname = models.CharField(max_length=140, blank=True, default="")
    sample_collection = models.ForeignKey(
        "SampleCollection", on_delete=models.SET_NULL, null=True, blank=True
    )
    observation = models.ForeignKey(
        Observation, on_delete=models.SET_NULL, null=True, blank=True
    )
    notes = models.TextField(blank=True, default="")

    class Meta:
        db_table = "healthcare_diagnostic_report"
        ordering = ["-creation"]

    def __str__(self):
        return f"Diagnostic Report: {self.patient}"

    def save(self, *args, **kwargs):
        if not self.report_id:
            last = DiagnosticReport.objects.order_by("-id").first()
            num = (last.id + 1) if last else 1
            self.report_id = f"HLC-DR-{num:05d}"
        super().save(*args, **kwargs)


# ══════════════════════════════════════════════════════════════════════════════
# SAMPLE COLLECTION (Marley - Missing)
# ══════════════════════════════════════════════════════════════════════════════

class SampleCollection(BaseModel):
    """Sample collection tracking for lab tests. (Marley parity)."""
    naming_series = models.CharField(max_length=50, default="HLC-SC-.YYYY.-", blank=True)
    collection_id = models.CharField(max_length=50, unique=True, blank=True)
    patient = models.ForeignKey(
        Patient, on_delete=models.CASCADE, related_name="sample_collections"
    )
    patient_name = models.CharField(max_length=280, blank=True, default="")
    patient_age = models.CharField(max_length=20, blank=True, default="")
    patient_sex = models.CharField(max_length=20, blank=True, default="")
    company = models.CharField(max_length=140, blank=True, default="EEU (Demo)")
    status = models.CharField(
        max_length=30, default="Pending",
        choices=[("Pending", "Pending"), ("Partly Collected", "Partly Collected"),
                 ("Collected", "Collected"), ("Cancelled", "Cancelled")],
    )
    invoiced = models.BooleanField(default=False)
    # Sample details
    sample = models.ForeignKey(
        LabTestSample, on_delete=models.SET_NULL, null=True, blank=True
    )
    sample_uom = models.CharField(max_length=50, blank=True, default="")
    sample_qty = models.DecimalField(max_digits=8, decimal_places=3, default=0)
    collected_by = models.CharField(max_length=140, blank=True, default="")
    collected_time = models.DateTimeField(null=True, blank=True)
    num_print = models.IntegerField(default=1)
    sample_details = models.TextField(blank=True, default="")
    collection_point = models.ForeignKey(
        HealthcareServiceUnit, on_delete=models.SET_NULL, null=True, blank=True
    )
    # References
    appointment = models.ForeignKey(
        PatientAppointment, on_delete=models.SET_NULL, null=True, blank=True
    )
    referring_practitioner = models.ForeignKey(
        HealthcarePractitioner, on_delete=models.SET_NULL, null=True, blank=True
    )
    lab_test = models.ForeignKey(
        LabTest, on_delete=models.SET_NULL, null=True, blank=True
    )
    service_request = models.CharField(max_length=140, blank=True, default="")
    barcode = models.CharField(max_length=100, blank=True, default="")
    collection_site = models.CharField(max_length=100, blank=True, default="")
    receipt_status = models.CharField(
        max_length=20, default="Pending",
        choices=[("Pending", "Pending"), ("Received", "Received"), ("Rejected", "Rejected")],
    )
    receipt_datetime = models.DateTimeField(null=True, blank=True)
    received_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="received_sample_collections",
    )
    rejection_reason = models.TextField(blank=True, default="")

    class Meta:
        db_table = "healthcare_sample_collection"
        ordering = ["-creation"]

    def __str__(self):
        return f"Sample: {self.patient} ({self.status})"

    def save(self, *args, **kwargs):
        if not self.collection_id:
            last = SampleCollection.objects.order_by("-id").first()
            num = (last.id + 1) if last else 1
            self.collection_id = f"HLC-SC-{num:05d}"
        if not self.barcode:
            self.barcode = self.collection_id
        if self.patient:
            if not self.patient_name:
                self.patient_name = self.patient.patient_name or str(self.patient)
            if not self.patient_age:
                raw_age = getattr(self.patient, "age_display", None) or (str(self.patient.age) if self.patient.age else "")
                self.patient_age = str(raw_age)[:20] if raw_age else ""
            elif len(self.patient_age) > 20:
                self.patient_age = self.patient_age[:20]
            if not self.patient_sex and self.patient.sex:
                self.patient_sex = str(self.patient.sex)[:20]
            elif self.patient_sex and len(self.patient_sex) > 20:
                self.patient_sex = self.patient_sex[:20]
        if self.sample and not self.sample_uom:
            if self.sample.sample_uom:
                self.sample_uom = getattr(self.sample.sample_uom, "lab_test_uom", str(self.sample.sample_uom))
        super().save(*args, **kwargs)
        if self.lab_test:
            lt = self.lab_test
            updated_fields = []
            if not lt.sample or lt.sample_id != self.id:
                lt.sample = self
                updated_fields.append("sample")
            if self.status == "Collected" and lt.specimen_status != "Received":
                lt.specimen_status = "Collected"
                updated_fields.append("specimen_status")
                if self.barcode:
                    lt.specimen_barcode = self.barcode
                    updated_fields.append("specimen_barcode")
                if self.collected_by:
                    lt.collected_by = self.collected_by
                    updated_fields.append("collected_by")
                if self.collected_time:
                    lt.collection_datetime = self.collected_time
                    updated_fields.append("collection_datetime")
                if self.collection_site:
                    lt.collection_site = self.collection_site
                    updated_fields.append("collection_site")
            elif self.barcode and not lt.specimen_barcode:
                lt.specimen_barcode = self.barcode
                updated_fields.append("specimen_barcode")
            if updated_fields:
                lt.save(update_fields=list(set(updated_fields)))


# ══════════════════════════════════════════════════════════════════════════════
# PATIENT MEDICAL RECORD (Marley - Missing)
# ══════════════════════════════════════════════════════════════════════════════

class PatientMedicalRecord(BaseModel):
    """Patient medical record entries."""
    record_id = models.CharField(max_length=50, unique=True, blank=True)
    patient = models.ForeignKey(
        Patient, on_delete=models.CASCADE, related_name="medical_records"
    )
    status = models.CharField(
        max_length=20, default="Active",
        choices=[("Active", "Active"), ("Archived", "Archived")],
    )
    subject = models.TextField(blank=True, default="")
    content = models.TextField(blank=True, default="")
    communication_date = models.DateField(auto_now_add=True)
    reference_doctype = models.CharField(max_length=140, blank=True, default="")
    reference_name = models.CharField(max_length=140, blank=True, default="")
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True
    )

    class Meta:
        db_table = "healthcare_patient_medical_record"
        ordering = ["-communication_date"]

    def __str__(self):
        return f"Record: {self.patient} - {self.subject}"

    def save(self, *args, **kwargs):
        if not self.record_id:
            last = PatientMedicalRecord.objects.order_by("-id").first()
            num = (last.id + 1) if last else 1
            self.record_id = f"HLC-PMR-{num:05d}"
        super().save(*args, **kwargs)


# ══════════════════════════════════════════════════════════════════════════════
# MICROBIOLOGY (Marley - Missing)
# ══════════════════════════════════════════════════════════════════════════════

class Organism(BaseModel):
    """Microbiology organisms."""
    organism = models.CharField(max_length=200, unique=True)
    abbr = models.CharField(max_length=50, blank=True, default="")

    class Meta:
        db_table = "healthcare_organism"
        ordering = ["organism"]

    def __str__(self):
        return self.organism


class Sensitivity(BaseModel):
    """Antibiotic sensitivity levels."""
    sensitivity = models.CharField(max_length=140, unique=True)

    class Meta:
        db_table = "healthcare_sensitivity"
        ordering = ["sensitivity"]

    def __str__(self):
        return self.sensitivity


class SensitivityTestResult(BaseModel):
    """
    Sensitivity Test Result row — Marley's `Sensitivity Test Result` child
    table: an antibiotic and the sensitivity reading against it, exactly the
    two fields Marley's `field_order` carries. The parent accessor carries
    Marley's field name, `sensitivity_test_items`.
    """
    lab_test = models.ForeignKey(
        LabTest, on_delete=models.CASCADE, related_name="sensitivity_test_items"
    )
    idx = models.IntegerField(default=0)
    antibiotic = models.ForeignKey(
        "Antibiotic", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="test_results",
    )
    antibiotic_sensitivity = models.ForeignKey(
        Sensitivity, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="test_results",
    )

    class Meta:
        db_table = "healthcare_sensitivity_test_result"
        ordering = ["idx", "id"]

    def __str__(self):
        return f"{self.antibiotic} - {self.antibiotic_sensitivity}"


class DescriptiveTestResult(BaseModel):
    """
    Descriptive Test Result row — Marley's `Descriptive Test Result` child
    table: a named component and the value entered on the Lab Test.
    """
    lab_test = models.ForeignKey(
        LabTest, on_delete=models.CASCADE, related_name="descriptive_test_items"
    )
    idx = models.IntegerField(default=0)
    lab_test_particulars = models.CharField(max_length=280, blank=True, default="")
    result_value = models.TextField(blank=True, default="")
    allow_blank = models.BooleanField(default=True)
    require_result_value = models.BooleanField(default=False)
    template = models.ForeignKey(
        LabTestTemplate, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="descriptive_test_results",
    )

    class Meta:
        db_table = "healthcare_descriptive_test_result"
        ordering = ["idx", "id"]

    def __str__(self):
        return f"{self.lab_test_particulars}: {self.result_value}"


class OrganismTestResult(BaseModel):
    """
    Organism Test Result row — Marley's `Organism Test Result` child table.
    `organism` is Marley's required Link, so it PROTECTs the master from
    deletion rather than being nulled out.
    """
    lab_test = models.ForeignKey(
        LabTest, on_delete=models.CASCADE, related_name="organism_test_items"
    )
    idx = models.IntegerField(default=0)
    organism = models.ForeignKey(
        Organism, on_delete=models.PROTECT, related_name="test_results"
    )
    colony_population = models.TextField(blank=True, default="")
    colony_uom = models.ForeignKey(
        LabTestUOM, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="organism_test_results",
    )

    class Meta:
        db_table = "healthcare_organism_test_result"
        ordering = ["idx", "id"]

    def __str__(self):
        return str(self.organism)


class Specimen(BaseModel):
    """Lab specimens."""
    specimen_id = models.CharField(max_length=50, unique=True, blank=True)
    specimen_type = models.ForeignKey(
        SampleType, on_delete=models.SET_NULL, null=True, blank=True
    )
    patient = models.ForeignKey(
        Patient, on_delete=models.CASCADE, related_name="specimens"
    )
    status = models.CharField(
        max_length=20, default="Available",
        choices=[("Available", "Available"), ("Unavailable", "Unavailable"),
                 ("Unsatisfactory", "Unsatisfactory"), ("Entered In Error", "Entered In Error")],
    )
    barcode = models.CharField(max_length=100, blank=True, default="")
    received_time = models.DateTimeField(null=True, blank=True)
    note = models.TextField(blank=True, default="")

    class Meta:
        db_table = "healthcare_specimen"
        ordering = ["-creation"]

    def __str__(self):
        return f"Specimen: {self.specimen_id} ({self.status})"

    def save(self, *args, **kwargs):
        if not self.specimen_id:
            last = Specimen.objects.order_by("-id").first()
            num = (last.id + 1) if last else 1
            self.specimen_id = f"HLC-SPEC-{num:05d}"
        super().save(*args, **kwargs)


# ══════════════════════════════════════════════════════════════════════════════
# EMERGENCY OCCUPANCY (Marley - Missing)
# ══════════════════════════════════════════════════════════════════════════════

class EmergencyOccupancy(BaseModel):
    """Emergency department bed occupancy tracking."""
    emergency_record = models.ForeignKey(
        EmergencyRecord, on_delete=models.CASCADE, related_name="occupancies"
    )
    service_unit = models.ForeignKey(
        HealthcareServiceUnit, on_delete=models.CASCADE
    )
    check_in = models.DateTimeField()
    check_out = models.DateTimeField(null=True, blank=True)
    left = models.BooleanField(default=False)
    invoiced = models.BooleanField(default=False)
    insurance_coverage = models.ForeignKey(
        PatientInsuranceCoverage, on_delete=models.SET_NULL, null=True, blank=True
    )

    class Meta:
        db_table = "healthcare_emergency_occupancy"
        ordering = ["-check_in"]

    def __str__(self):
        return f"ER Occupancy: {self.service_unit} ({self.check_in})"


# ══════════════════════════════════════════════════════════════════════════════
# REFERENCE DATA (Marley - Missing)
# ══════════════════════════════════════════════════════════════════════════════

class ClinicalNoteType(BaseModel):
    """Clinical note type reference."""
    clinical_note_type = models.CharField(max_length=140, unique=True)

    class Meta:
        db_table = "healthcare_clinical_note_type"
        ordering = ["clinical_note_type"]

    def __str__(self):
        return self.clinical_note_type


class CodeSystem(BaseModel):
    """
    Medical coding systems: ICD-10, CPT, SNOMED CT, etc.

    Field set mirrors Marley's `Code System` doctype. Two deliberate
    deviations: Marley makes `status` and `version` Links to `Code Value`
    (a bootstrap problem, since those Code Values belong to this system), so
    they are plain text here; and Marley's `disabled` flag is folded into
    `status == "Retired"` instead of being a separate checkbox.
    """
    code_system = models.CharField(max_length=140, unique=True)
    uri = models.URLField(blank=True, default="")
    oid = models.CharField(max_length=140, blank=True, default="")
    description = models.TextField(blank=True, default="")
    status = models.CharField(
        max_length=20, default="Active",
        choices=[("Active", "Active"), ("Retired", "Retired"),
                 ("Draft", "Draft"), ("Unknown", "Unknown")],
    )
    version = models.CharField(max_length=50, blank=True, default="")
    is_fhir_defined = models.BooleanField(default=False)
    experimental = models.BooleanField(default=False)
    custom = models.BooleanField(default=False)
    immutable = models.BooleanField(default=False)
    complete = models.BooleanField(default=False)

    class Meta:
        db_table = "healthcare_code_system"
        ordering = ["code_system"]

    def __str__(self):
        return self.code_system


class CodeValue(BaseModel):
    """Medical code values within a code system."""
    code_system = models.ForeignKey(
        CodeSystem, on_delete=models.CASCADE, related_name="values"
    )
    code = models.CharField(max_length=50)
    display = models.CharField(max_length=280)
    definition = models.TextField(blank=True, default="")

    class Meta:
        db_table = "healthcare_code_value"
        unique_together = ["code_system", "code"]
        ordering = ["code_system", "code"]

    def __str__(self):
        return f"{self.code}: {self.display}"


class CodificationTable(BaseModel):
    """
    Medical coding row — Marley's `Codification Table`.

    Each row pairs a `Code System` with a `Code Value` from it. As with the
    other Link fields, the string names are denormalised alongside the FKs so a
    row stays readable if the master record is later removed.

    Marley shares this child doctype across several parents (Patient Encounter,
    Lab Test Template, ...), so both FKs are optional and a row belongs to
    whichever one is set. Frappe expresses that with an implicit
    `parent`/`parenttype` pair; this codebase names its parent FKs explicitly,
    so a row carries at most one of them.
    """
    encounter = models.ForeignKey(
        PatientEncounter, on_delete=models.CASCADE, related_name="codifications",
        null=True, blank=True,
    )
    lab_test_template = models.ForeignKey(
        LabTestTemplate, on_delete=models.CASCADE, related_name="codification_table",
        null=True, blank=True,
    )
    lab_test = models.ForeignKey(
        LabTest, on_delete=models.CASCADE, related_name="codification_table",
        null=True, blank=True,
    )
    code_system = models.ForeignKey(
        CodeSystem, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="codifications",
    )
    system = models.CharField(max_length=140, blank=True, default="")
    is_fhir_defined = models.BooleanField(default=False)
    oid = models.CharField(max_length=140, blank=True, default="")
    code_value = models.ForeignKey(
        CodeValue, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="codifications",
    )
    code = models.CharField(max_length=50, blank=True, default="")
    display = models.CharField(max_length=280, blank=True, default="")
    definition = models.TextField(blank=True, default="")

    class Meta:
        db_table = "healthcare_codification_table"
        ordering = ["-creation"]

    def __str__(self):
        return f"{self.code_system or '?'} {self.code or ''}".strip()

    def save(self, *args, **kwargs):
        # Denormalise the linked masters the way Marley's `fetch_from` rules do:
        # system <- code_system.uri, oid <- code_system.oid,
        # code/display/definition <- code_value.
        if self.code_system_id:
            if not self.system:
                self.system = self.code_system.uri
            if not self.oid:
                self.oid = self.code_system.oid
        if self.code_value_id:
            if not self.code:
                self.code = self.code_value.code
            if not self.display:
                self.display = self.code_value.display
            if not self.definition:
                self.definition = self.code_value.definition
        super().save(*args, **kwargs)


class ExerciseDifficultyLevel(BaseModel):
    """Exercise difficulty levels reference."""
    difficulty_level = models.CharField(max_length=140, unique=True)
    description = models.TextField(blank=True, default="")

    class Meta:
        db_table = "healthcare_exercise_difficulty_level"
        ordering = ["difficulty_level"]

    def __str__(self):
        return self.difficulty_level


class ExerciseType(BaseModel):
    """Exercise types with steps and instructions."""
    exercise_name = models.CharField(max_length=200)
    body_parts = models.TextField(blank=True, default="")
    difficulty_level = models.ForeignKey(
        ExerciseDifficultyLevel, on_delete=models.SET_NULL, null=True, blank=True
    )
    description = models.TextField(blank=True, default="")
    instructions = models.TextField(blank=True, default="")
    video_url = models.URLField(blank=True, default="")
    steps = models.JSONField(default=list, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "healthcare_exercise_type"
        ordering = ["exercise_name"]

    def __str__(self):
        return self.exercise_name


class NormalTestTemplate(BaseModel):
    """
    Compound-result row — Marley's `Normal Test Template` child table.

    This was a standalone model keyed by a `lab_test_name` string; Marley has it
    as a Table on Lab Test Template, so it now hangs off the parent instead.

    The parent pointer is `parent_template` rather than the model-named FK this
    codebase usually uses (`treatment_plan_template`, `observation_template`):
    Marley already spends the name `lab_test_template` on a *different* field of
    `Lab Test Group Template`, and that name is kept as-is.
    """
    parent_template = models.ForeignKey(
        LabTestTemplate, on_delete=models.CASCADE, related_name="normal_test_templates"
    )
    idx = models.IntegerField(default=0)
    lab_test_event = models.CharField(max_length=200, blank=True, default="")
    lab_test_uom = models.ForeignKey(
        LabTestUOM, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="normal_test_templates",
    )
    normal_range = models.TextField(blank=True, default="")
    secondary_uom = models.ForeignKey(
        LabTestUOM, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="normal_test_templates_secondary",
    )
    conversion_factor = models.DecimalField(
        max_digits=12, decimal_places=6, null=True, blank=True
    )
    allow_blank = models.BooleanField(default=False)

    class Meta:
        db_table = "healthcare_normal_test_template"
        ordering = ["idx", "id"]

    def __str__(self):
        return f"{self.parent_template}: {self.lab_test_event}"


class DescriptiveTestTemplate(BaseModel):
    """
    Descriptive-result component — Marley's `Descriptive Test Template` child.

    A row is just a named result component; the value is entered by hand on the
    Lab Test itself.
    """
    parent_template = models.ForeignKey(
        LabTestTemplate, on_delete=models.CASCADE,
        related_name="descriptive_test_templates",
    )
    idx = models.IntegerField(default=0)
    particulars = models.CharField(max_length=280, blank=True, default="")
    allow_blank = models.BooleanField(default=False)

    class Meta:
        db_table = "healthcare_descriptive_test_template"
        ordering = ["idx", "id"]

    def __str__(self):
        return self.particulars


class LabTestGroupTemplate(BaseModel):
    """
    Grouped-result row — Marley's `Lab Test Group Template` child table.

    `template_or_new_line` picks the row's shape: "Add Test" pulls in another
    Lab Test Template (`lab_test_template`, with rate and description copied
    from it), "Add New Line" declares an extra event inline. Marley enforces the
    split with `depends_on`, so the unused half of a row is simply empty here.
    """
    parent_template = models.ForeignKey(
        LabTestTemplate, on_delete=models.CASCADE, related_name="lab_test_groups"
    )
    idx = models.IntegerField(default=0)
    template_or_new_line = models.CharField(
        max_length=20, default="Add Test",
        choices=[("Add Test", "Add Test"), ("Add New Line", "Add New Line")],
    )
    # Marley's field name for the template being included; the parent is
    # `parent_template`, since Frappe names its parent pointer implicitly.
    lab_test_template = models.ForeignKey(
        LabTestTemplate, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="included_in_groups",
    )
    # Denormalised from `lab_test_template` — Marley marks both read_only with
    # `fetch_from`, so they are values rather than links.
    lab_test_rate = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    lab_test_description = models.CharField(max_length=280, blank=True, default="")
    group_event = models.CharField(max_length=200, blank=True, default="")
    group_test_uom = models.ForeignKey(
        LabTestUOM, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="group_templates",
    )
    group_test_normal_range = models.TextField(blank=True, default="")
    secondary_uom = models.ForeignKey(
        LabTestUOM, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="group_templates_secondary",
    )
    conversion_factor = models.DecimalField(
        max_digits=12, decimal_places=6, null=True, blank=True
    )
    allow_blank = models.BooleanField(default=False)

    class Meta:
        db_table = "healthcare_lab_test_group_template"
        ordering = ["idx", "id"]

    def __str__(self):
        return self.group_event or (
            self.lab_test_template.lab_test_name if self.lab_test_template_id else ""
        )

    def save(self, *args, **kwargs):
        # Denormalise the included template the way Marley's fetch_from does.
        if self.template_or_new_line == "Add Test" and self.lab_test_template_id:
            self.lab_test_rate = self.lab_test_template.lab_test_rate
            self.lab_test_description = self.lab_test_template.lab_test_description
        super().save(*args, **kwargs)


class NormalTestResult(BaseModel):
    """
    Normal Test Result row – Marley's `Normal Test Result` child table
    for Compound and Single normal test results on Lab Test.
    """
    lab_test = models.ForeignKey(
        LabTest, on_delete=models.CASCADE, null=True, blank=True,
        related_name="normal_test_items",
    )
    idx = models.IntegerField(default=0)
    lab_test_name = models.CharField(max_length=200, blank=True, default="")
    lab_test_event = models.CharField(max_length=200, blank=True, default="")
    result_value = models.CharField(max_length=100, blank=True, default="")
    lab_test_uom = models.ForeignKey(
        LabTestUOM, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="normal_results",
    )
    normal_range = models.TextField(blank=True, default="")
    lab_test_comment = models.CharField(max_length=280, blank=True, default="")
    template = models.ForeignKey(
        LabTestTemplate, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="normal_test_results",
    )
    secondary_uom = models.ForeignKey(
        LabTestUOM, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="normal_results_secondary",
    )
    conversion_factor = models.DecimalField(
        max_digits=12, decimal_places=6, null=True, blank=True
    )
    secondary_uom_result = models.CharField(max_length=100, blank=True, default="")
    bold = models.BooleanField(default=False)
    italic = models.BooleanField(default=False)
    underline = models.BooleanField(default=False)
    require_result_value = models.BooleanField(default=False)
    allow_blank = models.BooleanField(default=False)

    class Meta:
        db_table = "healthcare_normal_test_result"
        ordering = ["idx", "id"]

    def __str__(self):
        return f"{self.lab_test_name or self.lab_test_event}: {self.result_value}"



class ObservationTemplate(BaseModel):
    """Observation templates for vital signs, measurements, etc."""
    observation = models.CharField(max_length=200, unique=True)
    observation_category = models.CharField(max_length=100, blank=True, default="")
    preferred_display_name = models.CharField(max_length=200, blank=True, default="")
    abbr = models.CharField(max_length=50, blank=True, default="")
    has_component = models.BooleanField(default=False)
    department = models.ForeignKey(
        MedicalDepartment, on_delete=models.SET_NULL, null=True, blank=True
    )
    description = models.TextField(blank=True, default="")
    permitted_data_type = models.CharField(max_length=50, blank=True, default="")
    permitted_unit = models.CharField(max_length=50, blank=True, default="")
    sample_collection_required = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "healthcare_observation_template"
        ordering = ["observation"]

    def __str__(self):
        return self.observation


class ObservationReferenceRange(BaseModel):
    """Reference ranges for observations."""
    observation_template = models.ForeignKey(
        ObservationTemplate, on_delete=models.CASCADE,
        related_name="reference_ranges"
    )
    applies_to = models.CharField(max_length=100, blank=True, default="")
    age_from = models.DecimalField(max_digits=5, decimal_places=1, null=True, blank=True)
    age_to = models.DecimalField(max_digits=5, decimal_places=1, null=True, blank=True)
    reference_from = models.CharField(max_length=100, blank=True, default="")
    reference_to = models.CharField(max_length=100, blank=True, default="")
    normal_from = models.CharField(max_length=100, blank=True, default="")
    normal_to = models.CharField(max_length=100, blank=True, default="")
    abnormal_from = models.CharField(max_length=100, blank=True, default="")
    abnormal_to = models.CharField(max_length=100, blank=True, default="")
    short_interpretation = models.CharField(max_length=200, blank=True, default="")
    long_interpretation = models.TextField(blank=True, default="")

    class Meta:
        db_table = "healthcare_observation_reference_range"
        ordering = ["observation_template", "applies_to"]

    def __str__(self):
        return f"{self.observation_template}: {self.normal_from}-{self.normal_to}"


# ══════════════════════════════════════════════════════════════════════════════
# THERAPY PLAN TEMPLATES (Marley - Missing)
# ══════════════════════════════════════════════════════════════════════════════

class TherapyPlanTemplate(BaseModel):
    """Therapy plan templates for creating plans."""
    plan_name = models.CharField(max_length=200, unique=True)
    description = models.TextField(blank=True, default="")
    linked_item = models.CharField(
        max_length=140, blank=True, default=""
    )
    total_sessions = models.IntegerField(default=10)
    total_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "healthcare_therapy_plan_template"
        ordering = ["plan_name"]

    def __str__(self):
        return self.plan_name


class TreatmentPlanTemplateItem(BaseModel):
    """Investigation / therapy / procedure items within a treatment plan template.

    Mirrors Marley's TreatmentPlanTemplateItem with dynamic-link type/template
    plus medication-specific fields.
    """
    treatment_plan_template = models.ForeignKey(
        TreatmentPlanTemplate, on_delete=models.CASCADE, related_name="items"
    )
    # Dynamic link — type is one of: Lab Test Template, Clinical Procedure Template,
    # Therapy Type, Observation Template, Medication
    item_type = models.CharField(max_length=100, blank=True, default="")
    item_name = models.CharField(max_length=200, blank=True, default="")
    quantity = models.IntegerField(default=1)
    amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    instructions = models.TextField(blank=True, default="")
    # Medication-specific fields (Marley)
    drug_name = models.CharField(max_length=280, blank=True, default="")
    drug_code = models.CharField(max_length=100, blank=True, default="")
    strength = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    strength_uom = models.CharField(max_length=50, blank=True, default="")
    dosage_form = models.CharField(max_length=50, blank=True, default="")
    dosage_by_interval = models.BooleanField(default=False)
    dosage = models.CharField(max_length=100, blank=True, default="")
    interval = models.IntegerField(default=0)
    interval_uom = models.CharField(max_length=20, blank=True, default="", choices=[("", ""), ("Hour", "Hour"), ("Day", "Day")])
    period = models.CharField(max_length=50, blank=True, default="")
    number_of_repeats_allowed = models.IntegerField(default=0)
    # Service request tracking
    service_request = models.CharField(max_length=200, blank=True, default="")

    class Meta:
        db_table = "healthcare_treatment_plan_template_item"

    def __str__(self):
        return f"{self.item_type}: {self.item_name or self.drug_name}"


class TreatmentPlanTemplatePractitioner(BaseModel):
    """Practitioners linked to a treatment plan template."""
    treatment_plan_template = models.ForeignKey(
        TreatmentPlanTemplate, on_delete=models.CASCADE, related_name="practitioners"
    )
    practitioner = models.ForeignKey(
        HealthcarePractitioner, on_delete=models.CASCADE
    )
    is_primary = models.BooleanField(default=False)

    class Meta:
        db_table = "healthcare_treatment_plan_template_practitioner"

    def __str__(self):
        return f"{self.template} - {self.practitioner}"


# ══════════════════════════════════════════════════════════════════════════════
# MEDICATION CLASS INTERACTION (Marley - Missing)
# ══════════════════════════════════════════════════════════════════════════════

class MedicationClassInteraction(BaseModel):
    """Drug class-level interactions."""
    class1 = models.ForeignKey(
        MedicationClass, on_delete=models.CASCADE, related_name="interactions_as_class1"
    )
    class2 = models.ForeignKey(
        MedicationClass, on_delete=models.CASCADE, related_name="interactions_as_class2"
    )
    severity = models.CharField(
        max_length=20, default="Moderate",
        choices=[("Mild", "Mild"), ("Moderate", "Moderate"), ("Severe", "Severe")],
    )
    description = models.TextField(blank=True, default="")

    class Meta:
        db_table = "healthcare_medication_class_interaction"

    def __str__(self):
        return f"{self.class1} + {self.class2} ({self.severity})"


class MedicationOverrideReasonCode(BaseModel):
    """Reason codes for medication overrides."""
    reason_code = models.CharField(max_length=140, unique=True)
    description = models.TextField(blank=True, default="")

    class Meta:
        db_table = "healthcare_medication_override_reason"
        ordering = ["reason_code"]

    def __str__(self):
        return self.reason_code


# ══════════════════════════════════════════════════════════════════════════════
# ADDITIONAL MISSING MODELS
# ══════════════════════════════════════════════════════════════════════════════

class HealthcareScheduleTimeSlot(BaseModel):
    """Time slots for practitioner schedules."""
    schedule = models.ForeignKey(
        PractitionerSchedule, on_delete=models.CASCADE, related_name="time_slots"
    )
    start_time = models.TimeField()
    end_time = models.TimeField()
    max_appointments = models.IntegerField(default=1)
    is_available = models.BooleanField(default=True)

    class Meta:
        db_table = "healthcare_schedule_time_slot"
        ordering = ["start_time"]

    def __str__(self):
        return f"{self.start_time} - {self.end_time}"


class PractitionerServiceUnitSchedule(BaseModel):
    """Practitioner-service unit mapping with schedules."""
    practitioner = models.ForeignKey(
        HealthcarePractitioner, on_delete=models.CASCADE
    )
    service_unit = models.ForeignKey(
        HealthcareServiceUnit, on_delete=models.CASCADE
    )
    day = models.CharField(max_length=10)
    start_time = models.TimeField()
    end_time = models.TimeField()
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "healthcare_practitioner_service_unit_schedule"

    def __str__(self):
        return f"{self.practitioner} in {self.service_unit} ({self.day})"


class Antibiotic(BaseModel):
    """Antibiotic reference data."""
    antibiotic_name = models.CharField(max_length=200, unique=True)
    medication = models.ForeignKey(
        Medication, on_delete=models.SET_NULL, null=True, blank=True
    )
    spectrum = models.CharField(max_length=100, blank=True, default="")
    class Meta:
        db_table = "healthcare_antibiotic"
        ordering = ["antibiotic_name"]

    def __str__(self):
        return self.antibiotic_name


class BodyPartLink(BaseModel):
    """Body part relationships (e.g., Knee -> Lower Limb)."""
    body_part = models.ForeignKey(
        BodyPart, on_delete=models.CASCADE, related_name="parent_links"
    )
    linked_body_part = models.ForeignKey(
        BodyPart, on_delete=models.CASCADE, related_name="child_links"
    )
    relationship = models.CharField(max_length=100, blank=True, default="")

    class Meta:
        db_table = "healthcare_body_part_link"

    def __str__(self):
        return f"{self.body_part} -> {self.linked_body_part}"


class InpatientMedicationOrderEntry(BaseModel):
    """Line items for inpatient medication orders."""
    order = models.ForeignKey(
        InpatientMedicationOrder, on_delete=models.CASCADE, related_name="entries"
    )
    medication_name = models.CharField(max_length=280)
    dosage = models.CharField(max_length=100, blank=True, default="")
    frequency = models.CharField(max_length=100, blank=True, default="")
    route = models.CharField(max_length=50, blank=True, default="")
    quantity = models.DecimalField(max_digits=10, decimal_places=2, default=1)
    status = models.CharField(max_length=20, default="Active")
    notes = models.TextField(blank=True, default="")

    class Meta:
        db_table = "healthcare_inpatient_medication_order_entry"

    def __str__(self):
        return f"{self.medication_name} ({self.dosage})"


class InpatientRecordItem(BaseModel):
    """Items consumed during inpatient stay."""
    inpatient_record = models.ForeignKey(
        InpatientRecord, on_delete=models.CASCADE, related_name="items"
    )
    item = models.CharField(
        max_length=200, blank=True, default=""
    )
    quantity = models.DecimalField(max_digits=10, decimal_places=2, default=1)
    rate = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    invoiced = models.BooleanField(default=False)

    class Meta:
        db_table = "healthcare_inpatient_record_item"

    def __str__(self):
        return f"{self.item} x {self.quantity}"


class ServiceRequestReason(BaseModel):
    """Reasons for service requests."""
    reason = models.CharField(max_length=200, unique=True)
    description = models.TextField(blank=True, default="")

    class Meta:
        db_table = "healthcare_service_request_reason"
        ordering = ["reason"]

    def __str__(self):
        return self.reason


class FeeValidityReference(BaseModel):
    """Fee validity reference configurations."""
    practitioner = models.ForeignKey(
        HealthcarePractitioner, on_delete=models.CASCADE
    )
    valid_days = models.IntegerField(default=7)
    max_visits = models.IntegerField(default=2)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "healthcare_fee_validity_reference"

    def __str__(self):
        return f"{self.practitioner}: {self.valid_days}d / {self.max_visits} visits"


class PatientHistorySettings(BaseModel):
    """Patient history display settings."""
    setting_name = models.CharField(max_length=140, unique=True)
    enabled = models.BooleanField(default=True)
    display_in_timeline = models.BooleanField(default=True)
    color = models.CharField(max_length=20, blank=True, default="#4F46E5")

    class Meta:
        db_table = "healthcare_patient_history_settings"
        ordering = ["setting_name"]

    def __str__(self):
        return self.setting_name


class PatientMedicalRecordTemplate(BaseModel):
    """Templates for patient medical records."""
    template_name = models.CharField(max_length=200, unique=True)
    content = models.TextField(blank=True, default="")
    reference_doctype = models.CharField(max_length=140, blank=True, default="")
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "healthcare_patient_medical_record_template"
        ordering = ["template_name"]

    def __str__(self):
        return self.template_name


class ObservationSampleCollection(BaseModel):
    """Observation sample collection details."""
    observation_template = models.ForeignKey(
        ObservationTemplate, on_delete=models.CASCADE, related_name="sample_collections"
    )
    sample = models.CharField(max_length=100, blank=True, default="")
    sample_qty = models.DecimalField(max_digits=10, decimal_places=2, default=1)
    uom = models.CharField(max_length=50, blank=True, default="")
    sample_type = models.ForeignKey(
        SampleType, on_delete=models.SET_NULL, null=True, blank=True
    )
    container_color = models.CharField(max_length=50, blank=True, default="")
    details = models.TextField(blank=True, default="")

    class Meta:
        db_table = "healthcare_observation_sample_collection"

    def __str__(self):
        return f"Sample for {self.observation_template}"


class TherapyPlanDetail(BaseModel):
    """
    Therapy row on an encounter — Marley's `Therapy Plan Detail`.

    `plan` is nullable because Marley lets therapies be prescribed on a draft
    encounter and only creates the Therapy Plan when the encounter is submitted
    (see `automation.on_encounter_submit`).
    """
    encounter = models.ForeignKey(
        PatientEncounter, on_delete=models.CASCADE,
        related_name="therapy_details", null=True, blank=True,
    )
    plan = models.ForeignKey(
        TherapyPlan, on_delete=models.CASCADE, related_name="details",
        null=True, blank=True,
    )
    therapy_type = models.ForeignKey(
        TherapyType, on_delete=models.SET_NULL, null=True, blank=True
    )
    no_of_sessions = models.IntegerField(default=1)
    sessions_completed = models.IntegerField(default=0)
    session_number = models.IntegerField(default=1)
    interval = models.CharField(max_length=50, blank=True, default="")
    patient_care_type = models.ForeignKey(
        "PatientCareType", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="therapy_details",
    )
    service_request = models.ForeignKey(
        "ServiceRequest", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="therapy_details",
    )
    intent = models.CharField(max_length=20, default="Order", blank=True)
    priority = models.CharField(max_length=20, default="Routine", blank=True)
    description = models.TextField(blank=True, default="")
    status = models.CharField(max_length=20, default="Pending")

    class Meta:
        db_table = "healthcare_therapy_plan_detail"
        ordering = ["session_number"]

    def __str__(self):
        return f"Session {self.session_number}: {self.description}"


class AppointmentTypeServiceItem(BaseModel):
    """Links appointment types to billing items."""
    appointment_type = models.ForeignKey(
        AppointmentTypeConfig, on_delete=models.CASCADE, related_name="service_items"
    )
    item = models.CharField(
        max_length=200, blank=True, default=""
    )
    amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    class Meta:
        db_table = "healthcare_appointment_type_service_item"

    def __str__(self):
        return f"{self.appointment_type} -> {self.item}"


class ServiceUnitTypeItem(BaseModel):
    """Items linked to service unit types."""
    service_unit_type = models.ForeignKey(
        HealthcareServiceUnitType, on_delete=models.CASCADE, related_name="items"
    )
    item = models.CharField(
        max_length=200, blank=True, default=""
    )
    is_billable = models.BooleanField(default=True)
    rate = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    class Meta:
        db_table = "healthcare_service_unit_type_item"

    def __str__(self):
        return f"{self.service_unit_type} -> {self.item}"


class InsurancePayorEligibilityPlan(BaseModel):
    """Insurance payor eligibility plans."""
    payor = models.ForeignKey(
        InsurancePayor, on_delete=models.CASCADE, related_name="eligibility_plans"
    )
    plan_name = models.CharField(max_length=200)
    coverage_percent = models.DecimalField(max_digits=5, decimal_places=2, default=100)
    max_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    deductible = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "healthcare_insurance_payor_eligibility_plan"

    def __str__(self):
        return f"{self.plan_name} ({self.payor})"


class ItemInsuranceEligibility(BaseModel):
    """Item-level insurance eligibility."""
    item = models.CharField(
        max_length=200, blank=True, default=""
    )
    payor = models.ForeignKey(
        InsurancePayor, on_delete=models.CASCADE
    )
    eligible = models.BooleanField(default=True)
    coverage_percent = models.DecimalField(max_digits=5, decimal_places=2, default=100)
    max_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    class Meta:
        db_table = "healthcare_item_insurance_eligibility"

    def __str__(self):
        return f"{self.item} - {self.payor} ({'Eligible' if self.eligible else 'Not Eligible'})"


# ══════════════════════════════════════════════════════════════════════
# DOCUMENT MANAGEMENT (Assign, Attachments, Tags)
# ══════════════════════════════════════════════════════════════════════

class DocumentAssignment(models.Model):
    """Track who a document is assigned to."""
    doctype = models.CharField(max_length=140)
    docname = models.CharField(max_length=255)
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name="doc_assignments"
    )
    assigned_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name="doc_assignments_made"
    )
    status = models.CharField(
        max_length=20, default="Pending",
        choices=[("Pending", "Pending"), ("Accepted", "Accepted"),
                 ("Completed", "Completed"), ("Rejected", "Rejected")],
    )
    priority = models.CharField(
        max_length=20, default="Medium",
        choices=[("Low", "Low"), ("Medium", "Medium"), ("High", "High")],
    )
    due_date = models.DateField(null=True, blank=True)
    note = models.TextField(blank=True, default="")
    creation = models.DateTimeField(auto_now_add=True)
    modified = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "healthcare_doc_assignment"
        ordering = ["-creation"]

    def __str__(self):
        return f"Assigned to {self.assigned_to} ({self.doctype}/{self.docname})"


class DocumentAttachment(models.Model):
    """File attachments for any document."""
    doctype = models.CharField(max_length=140)
    docname = models.CharField(max_length=255)
    file_name = models.CharField(max_length=255)
    file = models.FileField(upload_to="attachments/", null=True, blank=True)
    file_url = models.CharField(max_length=500, blank=True, default="")
    file_size = models.PositiveIntegerField(default=0)
    file_type = models.CharField(max_length=50, blank=True, default="")
    attached_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name="doc_attachments"
    )
    is_private = models.BooleanField(default=False)
    creation = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "healthcare_doc_attachment"
        ordering = ["-creation"]

    def __str__(self):
        return self.file_name


class DocumentTag(models.Model):
    """Tags for any document."""
    doctype = models.CharField(max_length=140)
    docname = models.CharField(max_length=255)
    tag = models.CharField(max_length=100)
    creation = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "healthcare_doc_tag"
        unique_together = ["doctype", "docname", "tag"]
        ordering = ["tag"]

    def __str__(self):
        return self.tag


# ══════════════════════════════════════════════════════════════════════════════
# 16. CLINICAL DOCUMENTS (External Referral & Medical Leave Slip)
# ══════════════════════════════════════════════════════════════════════════════

class ExternalReferral(BaseModel):
    """
    Clinical External Referral Out:
    Allows referring a patient to an outside hospital, specialized clinic, or doctor.
    Formatted for A4 paper printout that the patient carries to the destination facility.
    """
    referral_id = models.CharField(max_length=50, unique=True, blank=True)
    encounter = models.ForeignKey(
        "PatientEncounter", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="external_referrals"
    )
    patient = models.ForeignKey(
        Patient, on_delete=models.CASCADE, related_name="external_referrals"
    )
    referring_practitioner = models.ForeignKey(
        HealthcarePractitioner, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="referrals_out"
    )
    referral_date = models.DateField(default=timezone.now)
    priority = models.CharField(
        max_length=20, default="Routine",
        choices=[("Routine", "Routine"), ("Urgent", "Urgent"), ("Emergency", "Emergency")]
    )
    target_facility = models.CharField(max_length=255, help_text="Target Hospital or Clinic Name")
    receiving_specialist = models.CharField(max_length=255, blank=True, default="", help_text="Receiving Specialist or Department")
    clinical_indication = models.TextField(help_text="Reason for referral / clinical indication")
    provisional_diagnosis = models.TextField(blank=True, default="", help_text="Provisional Diagnosis")
    treatment_summary = models.TextField(blank=True, default="", help_text="Medications given, treatments administered, current management")
    relevant_test_results = models.TextField(blank=True, default="", help_text="Relevant lab results, vitals, imaging/observations")
    referral_notes = models.TextField(blank=True, default="", help_text="Special instructions, precautions, or transport needs")
    status = models.CharField(
        max_length=20, default="Active",
        choices=[("Draft", "Draft"), ("Active", "Active"), ("Dispatched", "Dispatched"), ("Completed", "Completed"), ("Cancelled", "Cancelled")]
    )
    # EEU Guarantee of Payment (GOP) & Specialized Hospital Coverage
    is_eeu_guarantee_of_payment = models.BooleanField(default=False, help_text="Official EEU Corporate Guarantee of Billing Coverage")
    eeu_gop_authorized_amount_etb = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"), help_text="Authorized billing coverage ceiling in ETB")
    eeu_gop_coverage_scope = models.CharField(
        max_length=140, default="Emergency Inpatient, Burn ICU & Specialized Surgery", blank=True,
        choices=[
            ("Emergency Inpatient, Burn ICU & Specialized Surgery", "Emergency Inpatient, Burn ICU & Specialized Surgery"),
            ("Specialized Trauma & Orthopedic Surgery", "Specialized Trauma & Orthopedic Surgery"),
            ("Ophthalmic Electrical Arc Flash Treatment", "Ophthalmic Electrical Arc Flash Treatment"),
            ("Advanced Neuro-Spinal Rehabilitation", "Advanced Neuro-Spinal Rehabilitation"),
            ("Diagnostic MRI / CT Advanced Imaging", "Diagnostic MRI / CT Advanced Imaging"),
            ("Full Outpatient & Inpatient Medical Services", "Full Outpatient & Inpatient Medical Services"),
        ]
    )
    eeu_gop_authorization_code = models.CharField(max_length=60, blank=True, default="")
    eeu_specialist_hospital_tier = models.CharField(
        max_length=120, default="ALERT Center (Burn ICU & Trauma)", blank=True,
        choices=[
            ("ALERT Center (Burn ICU & Trauma)", "ALERT Center (Burn ICU & Trauma)"),
            ("Tikur Anbessa (Black Lion) Specialized Hospital", "Tikur Anbessa (Black Lion) Specialized Hospital"),
            ("St. Paul's Hospital Millennium Medical College", "St. Paul's Hospital Millennium Medical College"),
            ("Myungsung Christian Medical Center (Korea Hospital)", "Myungsung Christian Medical Center (Korea Hospital)"),
            ("Yekatit 12 Hospital Medical College", "Yekatit 12 Hospital Medical College"),
            ("Hawassa Comprehensive Specialized Hospital", "Hawassa Comprehensive Specialized Hospital"),
            ("Ayder Comprehensive Specialized Hospital (Mekelle)", "Ayder Comprehensive Specialized Hospital (Mekelle)"),
            ("Tibebe Ghion Specialized Hospital (Bahir Dar)", "Tibebe Ghion Specialized Hospital (Bahir Dar)"),
        ]
    )

    class Meta:
        db_table = "healthcare_external_referral"
        ordering = ["-referral_date", "-id"]

    def __str__(self):
        return f"{self.referral_id or self.id} - {self.patient} to {self.target_facility}"

    def save(self, *args, **kwargs):
        if not self.referral_id:
            last = ExternalReferral.objects.order_by("-id").first()
            seq = (last.id + 1) if last else 1
            self.referral_id = f"REF-{timezone.now().year}-{seq:04d}"
            if self.is_eeu_guarantee_of_payment and not self.eeu_gop_authorization_code:
                self.eeu_gop_authorization_code = f"EEU-GOP-{timezone.now().year}-{seq:04d}"
        super().save(*args, **kwargs)


class MedicalLeaveSlip(BaseModel):
    """
    Medical Leave / Sick Leave Certificate:
    Clinical document certifying a patient's recommended rest period, diagnosis,
    and fitness to resume duties. Formatted for A5 paper printout for employers or schools.
    """
    slip_id = models.CharField(max_length=50, unique=True, blank=True)
    encounter = models.ForeignKey(
        "PatientEncounter", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="leave_slips"
    )
    patient = models.ForeignKey(
        Patient, on_delete=models.CASCADE, related_name="leave_slips"
    )
    practitioner = models.ForeignKey(
        HealthcarePractitioner, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="leave_slips"
    )
    issue_date = models.DateField(default=timezone.now)
    diagnosis = models.TextField(help_text="Clinical diagnosis justifying medical leave")
    from_date = models.DateField(help_text="Leave start date")
    to_date = models.DateField(help_text="Leave end date")
    total_days = models.PositiveIntegerField(default=1, help_text="Total recommended days of rest")
    doctor_remarks = models.TextField(blank=True, default="", help_text="Doctor's instructions (e.g. strict bed rest, light duty)")
    fitness_state = models.CharField(
        max_length=40, default="Unfit for Work / School",
        choices=[
            ("Unfit for Work / School", "Unfit for Work / School"),
            ("Fit for Light Duty Only", "Fit for Light Duty Only"),
            ("Fit for Normal Duties", "Fit for Normal Duties"),
        ]
    )
    fit_to_work_date = models.DateField(null=True, blank=True, help_text="Date patient is expected fit to resume duties")
    status = models.CharField(
        max_length=20, default="Issued",
        choices=[("Draft", "Draft"), ("Issued", "Issued"), ("Cancelled", "Cancelled")]
    )
    # EEU Specific Certifications
    eeu_clinic_branch = models.CharField(
        max_length=100, default="Ethiopian Electric Utility Medium Clinic",
        choices=[
            ("Ethiopian Electric Utility Medium Clinic", "Ethiopian Electric Utility Medium Clinic"),
        ]
    )
    eeu_leave_category = models.CharField(
        max_length=80, default="Work-Related Electrical/Mechanical Injury",
        choices=[
            ("Work-Related Electrical/Mechanical Injury", "Work-Related Electrical/Mechanical Injury"),
            ("Occupational High-Voltage/Arc Flash Recovery", "Occupational High-Voltage/Arc Flash Recovery"),
            ("General Medical Illness", "General Medical Illness"),
            ("Post-Surgical / Inpatient Convalescence", "Post-Surgical / Inpatient Convalescence"),
            ("Maternity / Family Health Leave", "Maternity / Family Health Leave"),
        ]
    )
    eeu_duty_restriction = models.CharField(
        max_length=80, default="Complete Bed Rest / Total Absence",
        choices=[
            ("Complete Bed Rest / Total Absence", "Complete Bed Rest / Total Absence"),
            ("Restricted to Light Ground Duty (No Climbing / No Field Patrol)", "Restricted to Light Ground Duty (No Climbing / No Field Patrol)"),
            ("Administrative Desk Duty Only", "Administrative Desk Duty Only"),
            ("No Night Shifts / No 24hr Emergency Standby", "No Night Shifts / No 24hr Emergency Standby"),
        ]
    )
    qr_verification_code = models.CharField(max_length=80, blank=True, default="")

    class Meta:
        db_table = "healthcare_medical_leave_slip"
        ordering = ["-issue_date", "-id"]

    def __str__(self):
        return f"{self.slip_id or self.id} - {self.patient} ({self.total_days} days)"

    def save(self, *args, **kwargs):
        if not self.slip_id:
            last = MedicalLeaveSlip.objects.order_by("-id").first()
            seq = (last.id + 1) if last else 1
            self.slip_id = f"EEU-MLS-{timezone.now().year}-{seq:04d}"
        if not self.qr_verification_code:
            import hashlib
            raw = f"EEU-CERT-{self.slip_id}-{timezone.now().timestamp()}"
            self.qr_verification_code = hashlib.sha256(raw.encode()).hexdigest()[:16].upper()
        if self.from_date and self.to_date and (not self.total_days or self.total_days <= 0):
            delta = (self.to_date - self.from_date).days + 1
            self.total_days = max(1, delta)
        super().save(*args, **kwargs)


# ══════════════════════════════════════════════════════════════════════════════
# EEU OCCUPATIONAL HEALTH & ELECTRICAL SAFETY
# ══════════════════════════════════════════════════════════════════════════════

class EEUWorkplaceIncident(BaseModel):
    """
    Workplace & Electrical Incident Record for Ethiopian Electric Utility staff.
    Tracks high-voltage shocks, flash burns, falls from utility poles/towers,
    substation emergencies, PPE compliance, and occupational clinical triage.
    """
    incident_id = models.CharField(max_length=50, unique=True, blank=True)
    patient = models.ForeignKey(
        Patient, on_delete=models.CASCADE, related_name="eeu_incidents"
    )
    incident_datetime = models.DateTimeField(default=timezone.now)
    voltage_level = models.CharField(
        max_length=60, default="Low Voltage (220V/380V)",
        choices=[
            ("Low Voltage (220V/380V)", "Low Voltage (220V/380V)"),
            ("Medium Voltage (15kV / 33kV)", "Medium Voltage (15kV / 33kV)"),
            ("High Voltage (66kV / 132kV / 230kV / 400kV)", "High Voltage (66kV / 132kV / 230kV / 400kV)"),
            ("Non-Electrical / Mechanical Hazard", "Non-Electrical / Mechanical Hazard"),
        ]
    )
    incident_type = models.CharField(
        max_length=80, default="Electrical Contact / Shock",
        choices=[
            ("Electrical Contact / Shock", "Electrical Contact / Shock"),
            ("Electrical Arc Flash / Thermal Burn", "Electrical Arc Flash / Thermal Burn"),
            ("Fall from Height / Utility Pole / Tower", "Fall from Height / Utility Pole / Tower"),
            ("Substation Transformer Oil / Chemical Splash", "Substation Transformer Oil / Chemical Splash"),
            ("Acoustic Blast / Transformer Explosion", "Acoustic Blast / Transformer Explosion"),
            ("Musculoskeletal / Heavy Cable Pulling Strain", "Musculoskeletal / Heavy Cable Pulling Strain"),
            ("Motor Vehicle Accident (Line Patrol Truck)", "Motor Vehicle Accident (Line Patrol Truck)"),
            ("Other Occupational Injury", "Other Occupational Injury"),
        ]
    )
    work_location = models.CharField(max_length=200, help_text="e.g. Kality 230kV Substation Bay 3, Legehar Feeder 08")
    region = models.CharField(
        max_length=80, default="Addis Ababa",
        choices=[
            ("Addis Ababa", "Addis Ababa"),
            ("Oromia", "Oromia"),
            ("Amhara", "Amhara"),
            ("Sidama", "Sidama"),
            ("Somali", "Somali"),
            ("Tigray", "Tigray"),
            ("Afar", "Afar"),
            ("Dire Dawa", "Dire Dawa"),
            ("Benishangul-Gumuz", "Benishangul-Gumuz"),
            ("Gambella", "Gambella"),
            ("South West Ethiopia", "South West Ethiopia"),
            ("Central Ethiopia", "Central Ethiopia"),
        ]
    )
    severity = models.CharField(
        max_length=50, default="Moderate / Outpatient Care",
        choices=[
            ("Minor / First Aid Only", "Minor / First Aid Only"),
            ("Moderate / Outpatient Care", "Moderate / Outpatient Care"),
            ("Severe / Inpatient Admission Required", "Severe / Inpatient Admission Required"),
            ("Critical / Burn ICU Transfer", "Critical / Burn ICU Transfer"),
            ("Fatal", "Fatal"),
        ]
    )
    ppe_compliance = models.CharField(
        max_length=80, default="Fully Compliant",
        choices=[
            ("Fully Compliant (Harness, Insulating Gloves, Boots, Helmet)", "Fully Compliant (Harness, Insulating Gloves, Boots, Helmet)"),
            ("Partial PPE Worn (Missing Gloves / Harness)", "Partial PPE Worn (Missing Gloves / Harness)"),
            ("No Protective Gear Worn", "No Protective Gear Worn"),
            ("Equipment Breakdown / Insulation Failure", "Equipment Breakdown / Insulation Failure"),
        ]
    )
    clinical_findings = models.TextField(blank=True, default="", help_text="Triage assessment, burn degree/BSA, entrance/exit marks, ECG rhythm")
    immediate_treatment_given = models.TextField(blank=True, default="", help_text="Fluid resuscitation, burn dressing, splinting, tetanus toxoid")
    duty_recommendation = models.CharField(
        max_length=80, default="Medical Sick Leave",
        choices=[
            ("Fit for Normal Duty", "Fit for Normal Duty"),
            ("Restricted Ground Duty Only", "Restricted Ground Duty Only"),
            ("Medical Sick Leave", "Medical Sick Leave"),
            ("Referred to Burn / Trauma Center", "Referred to Burn / Trauma Center"),
            ("Medical Board Disability Evaluation", "Medical Board Disability Evaluation"),
        ]
    )
    reported_by = models.CharField(max_length=140, blank=True, default="", help_text="Safety Officer / Foreman")
    supervisor_notified = models.BooleanField(default=True)
    status = models.CharField(
        max_length=30, default="Under Medical Review",
        choices=[
            ("Under Medical Review", "Under Medical Review"),
            ("Treatment Ongoing", "Treatment Ongoing"),
            ("Cleared / Returned to Duty", "Cleared / Returned to Duty"),
            ("Closed", "Closed"),
        ]
    )
    clinical_encounter = models.ForeignKey(
        "PatientEncounter", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="eeu_incidents", help_text="Linked clinical examination / consultation"
    )
    sick_leave_slip = models.ForeignKey(
        "MedicalLeaveSlip", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="eeu_incidents", help_text="Linked certified medical sick leave certificate"
    )
    lost_work_days = models.IntegerField(default=0, help_text="Lost work days (LTI) certified for this workplace incident")

    class Meta:
        db_table = "healthcare_eeu_incident"
        ordering = ["-incident_datetime", "-id"]

    def __str__(self):
        return f"{self.incident_id} - {self.patient} ({self.incident_type})"

    def save(self, *args, **kwargs):
        if not self.incident_id:
            last = EEUWorkplaceIncident.objects.order_by("-id").first()
            seq = (last.id + 1) if last else 1
            self.incident_id = f"EEU-INC-{timezone.now().year}-{seq:04d}"
        super().save(*args, **kwargs)


class EEUFitnessEvaluation(BaseModel):
    """
    Lineman Fitness & Occupational Medical Examination.
    Certifies high-altitude pole/tower climbing fitness, Ishihara color vision (wiring),
    audiometric threshold shifts (substations), and cardiovascular health.
    """
    evaluation_id = models.CharField(max_length=50, unique=True, blank=True)
    patient = models.ForeignKey(
        Patient, on_delete=models.CASCADE, related_name="eeu_fitness_evaluations"
    )
    practitioner = models.ForeignKey(
        HealthcarePractitioner, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="eeu_fitness_certifications"
    )
    evaluation_date = models.DateField(default=timezone.now)
    evaluation_type = models.CharField(
        max_length=80, default="Annual High-Voltage Climbing Exam",
        choices=[
            ("Pre-Employment Lineman Clearance", "Pre-Employment Lineman Clearance"),
            ("Annual High-Voltage Climbing Exam", "Annual High-Voltage Climbing Exam"),
            ("Post-Injury Return to Duty Clearance", "Post-Injury Return to Duty Clearance"),
            ("Substation Noise & Audiometry Screening", "Substation Noise & Audiometry Screening"),
            ("Periodic General Health Checkup", "Periodic General Health Checkup"),
        ]
    )
    climbing_fitness = models.CharField(
        max_length=60, default="Fit to Climb (Certified)",
        choices=[
            ("Fit to Climb (Certified)", "Fit to Climb (Certified)"),
            ("Restricted to Ground Duty Only", "Restricted to Ground Duty Only"),
            ("Temporarily Unfit (Re-eval in 30 Days)", "Temporarily Unfit (Re-eval in 30 Days)"),
            ("Permanently Unfit for High Altitudes", "Permanently Unfit for High Altitudes"),
        ]
    )
    color_vision = models.CharField(
        max_length=80, default="Normal Color Vision (Ishihara 15/15)",
        choices=[
            ("Normal Color Vision (Ishihara 15/15)", "Normal Color Vision (Ishihara 15/15)"),
            ("Mild Red-Green Anomaly (Requires Supervised Cable Identification)", "Mild Red-Green Anomaly (Requires Supervised Cable Identification)"),
            ("Red-Green Deficiency (Disqualified from Live Wiring)", "Red-Green Deficiency (Disqualified from Live Wiring)"),
            ("Not Tested", "Not Tested"),
        ]
    )
    audiometry_hearing = models.CharField(
        max_length=80, default="Normal Bilateral Hearing",
        choices=[
            ("Normal Bilateral Hearing", "Normal Bilateral Hearing"),
            ("Mild Occupational Noise Shift (<25 dB)", "Mild Occupational Noise Shift (<25 dB)"),
            ("Moderate Hearing Loss (Mandatory Hearing Protection)", "Moderate Hearing Loss (Mandatory Hearing Protection)"),
            ("Severe Hearing Impairment (Substation Duty Restricted)", "Severe Hearing Impairment (Substation Duty Restricted)"),
        ]
    )
    cardiovascular_status = models.CharField(
        max_length=80, default="Normal / Cleared for Heavy Exertion",
        choices=[
            ("Normal / Cleared for Heavy Exertion", "Normal / Cleared for Heavy Exertion"),
            ("Elevated BP - Monitored", "Elevated BP - Monitored"),
            ("Stage 2 Hypertension (Ground Duty Only)", "Stage 2 Hypertension (Ground Duty Only)"),
            ("Abnormal ECG - Referred to Cardiology", "Abnormal ECG - Referred to Cardiology"),
        ]
    )
    vertigo_vestibular_check = models.CharField(
        max_length=60, default="Negative (No Vertigo / Cleared for Heights)",
        choices=[
            ("Negative (No Vertigo / Cleared for Heights)", "Negative (No Vertigo / Cleared for Heights)"),
            ("Positive / Vertigo Detected (Climbing Prohibited)", "Positive / Vertigo Detected (Climbing Prohibited)"),
            ("Borderline / Requires Specialist Review", "Borderline / Requires Specialist Review"),
        ]
    )
    physician_remarks = models.TextField(blank=True, default="", help_text="Clinical observations, limitations, medication precautions")
    valid_until = models.DateField(null=True, blank=True)
    status = models.CharField(
        max_length=40, default="Certified & Valid",
        choices=[
            ("Certified & Valid", "Certified & Valid"),
            ("Conditional Clearance", "Conditional Clearance"),
            ("Disqualified / Unfit", "Disqualified / Unfit"),
            ("Pending Specialist Assessment", "Pending Specialist Assessment"),
        ]
    )

    class Meta:
        db_table = "healthcare_eeu_fitness"
        ordering = ["-evaluation_date", "-id"]

    def __str__(self):
        return f"{self.evaluation_id} - {self.patient} ({self.climbing_fitness})"

    def save(self, *args, **kwargs):
        if not self.evaluation_id:
            last = EEUFitnessEvaluation.objects.order_by("-id").first()
            seq = (last.id + 1) if last else 1
            self.evaluation_id = f"EEU-FIT-{timezone.now().year}-{seq:04d}"
        if not self.valid_until and self.evaluation_date:
            import datetime
            self.valid_until = self.evaluation_date + datetime.timedelta(days=365)
        super().save(*args, **kwargs)


class EEUFirstAidKit(BaseModel):
    """
    Emergency First-Aid & Burn Response Kits stationed in
    EEU high-voltage substations, emergency line trucks, and regional depots.
    """
    kit_code = models.CharField(max_length=60, unique=True)
    kit_type = models.CharField(
        max_length=80, default="Line Truck Emergency First-Aid Kit",
        choices=[
            ("Line Truck Emergency First-Aid Kit", "Line Truck Emergency First-Aid Kit"),
            ("High-Voltage Substation First-Aid Station", "High-Voltage Substation First-Aid Station"),
            ("Transmission Grid Mobile Rescue Kit", "Transmission Grid Mobile Rescue Kit"),
            ("Regional Depot First-Aid Box", "Regional Depot First-Aid Box"),
        ]
    )
    assigned_unit = models.CharField(max_length=160, help_text="e.g. Line Patrol Truck ET-03-49281 / Kality 230kV Station")
    region = models.CharField(
        max_length=80, default="Addis Ababa",
        choices=[
            ("Addis Ababa", "Addis Ababa"),
            ("Oromia", "Oromia"),
            ("Amhara", "Amhara"),
            ("Sidama", "Sidama"),
            ("Somali", "Somali"),
            ("Tigray", "Tigray"),
            ("Afar", "Afar"),
            ("Dire Dawa", "Dire Dawa"),
            ("Benishangul-Gumuz", "Benishangul-Gumuz"),
            ("Gambella", "Gambella"),
            ("South West Ethiopia", "South West Ethiopia"),
            ("Central Ethiopia", "Central Ethiopia"),
        ]
    )
    custodian_name = models.CharField(max_length=140, blank=True, default="", help_text="Assigned Foreman / Safety Lead")
    last_inspected = models.DateField(default=timezone.now)
    next_inspection_due = models.DateField(null=True, blank=True)
    status = models.CharField(
        max_length=60, default="Fully Stocked & Sealed",
        choices=[
            ("Fully Stocked & Sealed", "Fully Stocked & Sealed"),
            ("Needs Replenishment", "Needs Replenishment"),
            ("Critical - Missing Burn / Trauma Kit", "Critical - Missing Burn / Trauma Kit"),
            ("Expired Supplies Detected", "Expired Supplies Detected"),
        ]
    )
    burn_dressings_stocked = models.BooleanField(default=True, help_text="Water-Jel / Silver Sulfadiazine burn packs")
    trauma_bandages_stocked = models.BooleanField(default=True, help_text="Sterile pressure gauze, tourniquets")
    splints_tourniquet_stocked = models.BooleanField(default=True, help_text="Rigid splinting & arterial tourniquet")
    eye_wash_stocked = models.BooleanField(default=True, help_text="Emergency saline eye flush (substation battery rooms)")
    notes = models.TextField(blank=True, default="")
    restock_requisition_status = models.CharField(
        max_length=60, default="None",
        choices=[
            ("None", "None"),
            ("Pharmacy Requisition Sent", "Pharmacy Requisition Sent"),
            ("Dispatched from Central Pharmacy", "Dispatched from Central Pharmacy"),
            ("Replenished & Verified", "Replenished & Verified"),
        ]
    )
    restock_notes = models.TextField(blank=True, default="", help_text="Pharmacy restock requisition batch & supplies list")
    restock_requested_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "healthcare_eeu_first_aid_kit"
        ordering = ["kit_code"]

    def __str__(self):
        return f"{self.kit_code} - {self.assigned_unit} ({self.status})"

    def save(self, *args, **kwargs):
        if not self.next_inspection_due and self.last_inspected:
            import datetime
            self.next_inspection_due = self.last_inspected + datetime.timedelta(days=90)
        super().save(*args, **kwargs)


class EEUEmergencySOS(BaseModel):
    """
    Substation Rapid Emergency SOS & Casualty Pre-Arrival Dispatch.
    Broadcasts real-time alerts from high-voltage substations to regional clinics.
    """
    sos_id = models.CharField(max_length=50, unique=True, blank=True)
    substation_name = models.CharField(max_length=200, help_text="Substation / Switchyard location")
    region = models.CharField(
        max_length=80, default="Addis Ababa",
        choices=[
            ("Addis Ababa", "Addis Ababa"),
            ("Oromia", "Oromia"),
            ("Amhara", "Amhara"),
            ("Sidama", "Sidama"),
            ("Somali", "Somali"),
            ("Tigray", "Tigray"),
            ("Afar", "Afar"),
            ("Dire Dawa", "Dire Dawa"),
            ("Benishangul-Gumuz", "Benishangul-Gumuz"),
            ("Central Ethiopia", "Central Ethiopia"),
        ]
    )
    voltage_level = models.CharField(
        max_length=60, default="230kV High Voltage Grid",
        choices=[
            ("400V Low Voltage", "400V Low Voltage"),
            ("15kV Distribution", "15kV Distribution"),
            ("33kV Distribution", "33kV Distribution"),
            ("66kV Sub-Transmission", "66kV Sub-Transmission"),
            ("132kV Grid Transmission", "132kV Grid Transmission"),
            ("230kV High Voltage Grid", "230kV High Voltage Grid"),
            ("400kV Extra High Voltage", "400kV Extra High Voltage"),
        ]
    )
    hazard_type = models.CharField(
        max_length=80, default="Arc Flash Explosion",
        choices=[
            ("Arc Flash Explosion", "Arc Flash Explosion"),
            ("Direct High-Voltage Electrocution", "Direct High-Voltage Electrocution"),
            ("Pylon Fall from Height", "Pylon Fall from Height"),
            ("Transformer Fire / Oil Deflagration", "Transformer Fire / Oil Deflagration"),
            ("Switchgear Flashover", "Switchgear Flashover"),
            ("Substation Trapped Casualty", "Substation Trapped Casualty"),
        ]
    )
    casualty_count = models.PositiveIntegerField(default=1)
    severity_level = models.CharField(
        max_length=60, default="Severe - Burn ICU / Resuscitation Required",
        choices=[
            ("Critical - CPR / Resuscitation En Route", "Critical - CPR / Resuscitation En Route"),
            ("Severe - Burn ICU / Resuscitation Required", "Severe - Burn ICU / Resuscitation Required"),
            ("Moderate - Conscious / Trauma Dressing", "Moderate - Conscious / Trauma Dressing"),
            ("Multiple Casualties (Mass Triage)", "Multiple Casualties (Mass Triage)"),
        ]
    )
    caller_name = models.CharField(max_length=140, help_text="Safety Officer / Shift Engineer")
    caller_phone = models.CharField(max_length=40, help_text="Emergency Contact Number")
    destination_clinic = models.CharField(max_length=140, default="Ethiopian Electric Utility Medium Clinic")
    eta_minutes = models.PositiveIntegerField(default=15, help_text="Estimated ambulance arrival time in minutes")
    pre_arrival_prep_notes = models.TextField(blank=True, default="", help_text="Triage actions: Defibrillator ready, Burn sheets, Saline line")
    status = models.CharField(
        max_length=40, default="Active / En Route",
        choices=[
            ("Active / En Route", "Active / En Route"),
            ("Arrived at Clinic", "Arrived at Clinic"),
            ("Treated & Admitted", "Treated & Admitted"),
            ("Transferred to ALERT Hospital", "Transferred to ALERT Hospital"),
            ("Resolved / Stand Down", "Resolved / Stand Down"),
        ]
    )

    class Meta:
        db_table = "healthcare_eeu_emergency_sos"
        ordering = ["-id"]

    def __str__(self):
        return f"{self.sos_id} - {self.substation_name} ({self.hazard_type})"

    def save(self, *args, **kwargs):
        if not self.sos_id:
            last = EEUEmergencySOS.objects.order_by("-id").first()
            seq = (last.id + 1) if last else 1
            self.sos_id = f"EEU-SOS-{timezone.now().year}-{seq:04d}"
        super().save(*args, **kwargs)


class EEUPMECampaign(BaseModel):
    """
    Periodic Medical Examination (PME) Batch Screening Campaign for Linemen & Substation Crews.
    """
    campaign_id = models.CharField(max_length=50, unique=True, blank=True)
    campaign_name = models.CharField(max_length=200, help_text="e.g. 2026 Transmission Grid Lineman Annual Height Screening")
    target_year = models.PositiveIntegerField(default=2026)
    target_directorate = models.CharField(
        max_length=100, default="Distribution Directorate",
        choices=[
            ("Distribution Directorate", "Distribution Directorate"),
            ("Transmission Grid Directorate", "Transmission Grid Directorate"),
            ("Generation & Hydro Plants", "Generation & Hydro Plants"),
            ("Customer Services & Metering", "Customer Services & Metering"),
            ("Fleet & Logistics", "Fleet & Logistics"),
        ]
    )
    target_region = models.CharField(max_length=80, default="Addis Ababa")
    substation_focus = models.CharField(max_length=200, blank=True, default="", help_text="Target substations or patrol divisions")
    start_date = models.DateField(default=timezone.now)
    end_date = models.DateField(null=True, blank=True)
    target_count = models.PositiveIntegerField(default=25, help_text="Total field technicians scheduled for screening")
    completed_count = models.PositiveIntegerField(default=0, help_text="Total technicians examined so far")
    fit_certified_count = models.PositiveIntegerField(default=0, help_text="Total certified fit to climb")
    status = models.CharField(
        max_length=40, default="Active Campaign",
        choices=[
            ("Scheduled / Upcoming", "Scheduled / Upcoming"),
            ("Active Campaign", "Active Campaign"),
            ("Completed & Certified", "Completed & Certified"),
            ("Archived", "Archived"),
        ]
    )
    notes = models.TextField(blank=True, default="")

    class Meta:
        db_table = "healthcare_eeu_pme_campaign"
        ordering = ["-start_date", "-id"]

    def __str__(self):
        return f"{self.campaign_id} - {self.campaign_name}"

    def save(self, *args, **kwargs):
        if not self.campaign_id:
            last = EEUPMECampaign.objects.order_by("-id").first()
            seq = (last.id + 1) if last else 1
            self.campaign_id = f"EEU-PME-{self.target_year}-{seq:03d}"
        super().save(*args, **kwargs)


class EEUToxicSurveillance(BaseModel):
    """
    Occupational Chemical, SF6 Gas & Heavy Metal Toxicology Register for EEU Substations & Maintenance Crews.
    """
    surveillance_id = models.CharField(max_length=50, unique=True, blank=True)
    patient = models.ForeignKey(
        Patient, on_delete=models.CASCADE, related_name="toxic_surveillance_records"
    )
    examination_date = models.DateField(default=timezone.now)
    work_location = models.CharField(max_length=200, help_text="Substation / Transformer Workshop")
    chemical_agent = models.CharField(
        max_length=100, default="SF6 Breakdown Gas (SOF2 / HF byproducts)",
        choices=[
            ("SF6 Breakdown Gas (SOF2 / HF byproducts)", "SF6 Breakdown Gas (SOF2 / HF byproducts)"),
            ("Transformer Mineral Oil / PCB Splashing", "Transformer Mineral Oil / PCB Splashing"),
            ("Substation Battery Room Lead & Acid Mist", "Substation Battery Room Lead & Acid Mist"),
            ("Silica Dust & Underground Cable Compounds", "Silica Dust & Underground Cable Compounds"),
            ("Degreasing Solvents & Chlorinated Cleaners", "Degreasing Solvents & Chlorinated Cleaners"),
        ]
    )
    exposure_route = models.CharField(
        max_length=60, default="Inhalation / Respiratory",
        choices=[
            ("Inhalation / Respiratory", "Inhalation / Respiratory"),
            ("Dermal / Skin Contact", "Dermal / Skin Contact"),
            ("Ocular / Chemical Splash to Eyes", "Ocular / Chemical Splash to Eyes"),
            ("Chronic Low-Dose Accumulation", "Chronic Low-Dose Accumulation"),
        ]
    )
    exposure_severity = models.CharField(
        max_length=60, default="Mild Irritation / Monitored",
        choices=[
            ("Mild Irritation / Monitored", "Mild Irritation / Monitored"),
            ("Moderate - Respiratory Bronchospasm", "Moderate - Respiratory Bronchospasm"),
            ("Acute Severe Toxicity / Oxygen Therapy Required", "Acute Severe Toxicity / Oxygen Therapy Required"),
            ("Chronic Routine Surveillance (No Acute Symptoms)", "Chronic Routine Surveillance (No Acute Symptoms)"),
        ]
    )
    spirometry_fev1_actual = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True, help_text="FEV1 in Liters")
    spirometry_fev1_predicted_pct = models.PositiveIntegerField(null=True, blank=True, help_text="FEV1 % of predicted value")
    dermatological_findings = models.CharField(max_length=200, blank=True, default="No active chemical dermatitis")
    clinical_management = models.TextField(blank=True, default="", help_text="Bronchodilators, barrier creams, eye flushes, decontamination")
    duty_recommendation = models.CharField(
        max_length=80, default="Cleared for Continued Substation Duty",
        choices=[
            ("Cleared for Continued Substation Duty", "Cleared for Continued Substation Duty"),
            ("Mandatory Respirator / Full Chemical PPE", "Mandatory Respirator / Full Chemical PPE"),
            ("Restricted from SF6 Switchgear Handling", "Restricted from SF6 Switchgear Handling"),
            ("Temporary Reassignment to Clean Area", "Temporary Reassignment to Clean Area"),
        ]
    )

    class Meta:
        db_table = "healthcare_eeu_toxic_surveillance"
        ordering = ["-examination_date", "-id"]

    def __str__(self):
        return f"{self.surveillance_id} - {self.patient} ({self.chemical_agent})"

    def save(self, *args, **kwargs):
        if not self.surveillance_id:
            last = EEUToxicSurveillance.objects.order_by("-id").first()
            seq = (last.id + 1) if last else 1
            self.surveillance_id = f"EEU-TOX-{timezone.now().year}-{seq:04d}"
        super().save(*args, **kwargs)



