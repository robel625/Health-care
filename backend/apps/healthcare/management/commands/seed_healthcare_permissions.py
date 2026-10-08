"""
Seed Healthcare DocTypes, Roles, and DocPerms into the Frappe-style authorization system.

Based on Marley Healthcare (frappe/healthcare) role & permission definitions:
  Roles:     Healthcare Administrator, Physician, Laboratory User,
             Nursing User, LabTest Approver, Patient
  DocPerms:  per-doctype permission profiles matching Marley's doctype JSON files.

Run: python manage.py seed_healthcare_permissions
"""

from django.core.management.base import BaseCommand
from django.db import transaction

from apps.roles.models import DocPerm, DocType, Role


# ── Healthcare roles (Marley restricted roles) ─────────────────────
HEALTHCARE_ROLES = [
    # name, desk_access, is_system_role, description
    ("Healthcare Administrator", True, True,
     "Full administrative access to the Healthcare module"),
    ("Physician", True, True,
     "Doctors and physicians - clinical care, encounters, prescriptions"),
    ("Laboratory User", True, True,
     "Laboratory staff - lab tests, samples, results"),
    ("Nursing User", True, True,
     "Nursing staff - vitals, appointments, nursing tasks"),
    ("LabTest Approver", True, True,
     "Can approve lab test results and observations"),
    ("Patient", True, False,
     "Portal role for patients - self-service access to own records"),
    ("Pharmacy User", True, True,
     "Pharmacy staff and pharmacists - medications, dispensing, stock entries"),
    ("Pharmacist", True, True,
     "Licensed pharmacist - medication orders, dispensing, formulary management"),
]

# ── Healthcare DocTypes (name, is_submittable) ─────────────────────
HEALTHCARE_DOCTYPES = [
    # Core / Setup
    ("Patient", False),
    ("Healthcare Practitioner", False),
    ("Medical Department", False),
    ("Healthcare Service Unit Type", False),
    ("Healthcare Service Unit", False),
    ("Healthcare Settings", False),
    ("Fee Validity", False),
    ("Fee Validity Reference", False),
    # Schedules
    ("Practitioner Schedule", False),
    ("Practitioner Availability", False),
    ("Healthcare Schedule Time Slot", False),
    ("Practitioner Service Unit Schedule", False),
    # Appointments
    ("Patient Appointment", False),
    ("Appointment Type", False),
    ("Appointment Type Service Item", False),
    # Vital Signs
    ("Vital Signs", True),
    # Encounters
    ("Patient Encounter", True),
    ("Diagnosis", False),
    ("Symptom", False),
    ("Clinical Note", False),
    ("Clinical Note Type", False),
    ("Patient Relation", False),
    # Prescriptions
    ("Drug Prescription", False),
    ("Medication Request", True),
    ("Prescription Dosage", False),
    ("Prescription Duration", False),
    ("Lab Prescription", False),
    ("Procedure Prescription", False),
    # Lab & Diagnostics
    ("Lab Test", True),
    ("Lab Test Template", False),
    ("Lab Test UOM", False),
    ("Lab Test Sample", False),
    ("Clinical Procedure Template", False),
    ("Clinical Procedure", True),
    ("Observation", True),
    ("Observation Template", False),
    ("Observation Reference Range", False),
    ("Observation Sample Collection", False),
    ("Diagnostic Report", False),
    ("Sample Collection", True),
    ("Patient Medical Record", False),
    ("Normal Test Template", False),
    ("Normal Test Result", False),
    ("Sensitivity Test Result", False),
    # Therapy
    ("Therapy Type", False),
    ("Therapy Plan", True),
    ("Therapy Session", True),
    ("Exercise", False),
    ("Exercise Type", False),
    ("Exercise Difficulty Level", False),
    ("Treatment Plan Template", False),
    ("Therapy Plan Template", False),
    ("Therapy Plan Detail", False),
    ("Treatment Counselling", False),
    # Insurance
    ("Insurance Payor", False),
    ("Insurance Payor Contract", False),
    ("Patient Insurance Policy", False),
    ("Patient Insurance Coverage", False),
    ("Insurance Claim", True),
    ("Insurance Claim Coverage", False),
    ("Insurance Payor Eligibility Plan", False),
    ("Item Insurance Eligibility", False),
    # Inpatient / Emergency / Nursing
    ("Inpatient Record", True),
    ("Inpatient Medication Entry", False),
    ("Inpatient Medication Order", True),
    ("Inpatient Medication Order Entry", False),
    ("Inpatient Occupancy", False),
    ("Inpatient Record Item", False),
    ("Emergency Record", True),
    ("Emergency Occupancy", False),
    ("Discharge Summary", False),
    ("Nursing Task", False),
    ("Nursing Checklist Template", False),
    # Medications
    ("Medication", False),
    ("Medication Class", False),
    ("Medication Class Interaction", False),
    ("Medication Ingredient", False),
    ("Medication Linked Item", False),
    ("Drug Interaction", False),
    ("Medication Override Reason Code", False),
    ("Antibiotic", False),
    ("Body Part", False),
    ("Body Part Link", False),
    # Allergies
    ("Allergy", False),
    ("Allergy Interaction", False),
    # Assessments & Service Requests
    ("Patient Assessment", False),
    ("Patient Assessment Template", False),
    ("Service Request", True),
    ("Service Request Category", False),
    ("Service Request Reason", False),
    # Reference Data
    ("Dosage Form", False),
    ("Dosage Strength", False),
    ("Sample Type", False),
    ("Patient Care Type", False),
    ("Complaint", False),
    ("Triage Level", False),
    ("Healthcare Activity", False),
    ("Organism", False),
    ("Sensitivity", False),
    ("Specimen", False),
    ("Code System", False),
    ("Code Value", False),
    ("Patient History Settings", False),
    ("Patient Medical Record Template", False),
    ("Service Unit Type Item", False),
    # Payments
    ("Healthcare Payment Record", False),
    # Document-level features (Assign / Attachments / Tags)
    ("Document Assignment", False),
    ("Document Attachment", False),
    ("Document Tag", False),
    # Treatment plan building blocks
    ("Treatment Plan Template Item", False),
    ("Treatment Plan Template Practitioner", False),
    ("Codification Table", False),
    ("Descriptive Test Result", False),
    ("Descriptive Test Template", False),
    ("Diagnosis Catalog", False),
    ("Lab Test Group Template", False),
    ("Organism Test Result", False),
    ("Inpatient Medication Entry Detail", False),
    # EEU Occupational Health & Medical Directorate
    ("EEU Workplace Incident", False),
    ("EEU Fitness Evaluation", False),
    ("EEU First Aid Kit", False),
    ("Medical Leave Slip", False),
]

# ── Permission profiles ─────────────────────────────────────────────
FULL = {"read", "write", "create", "delete", "report", "export", "print", "email", "share", "select"}
SUBMITTABLE = FULL | {"submit", "cancel", "amend"}
READ_WRITE = {"read", "write", "select"}
READ = {"read", "select"}

# Role -> {doctype: flags} — mirrors Marley's doctype permission JSONs
DOC_PERM_DEFS = {
    "Healthcare Administrator": {
        # Full administrative control over the whole healthcare module
        **{name: (SUBMITTABLE if sub else FULL) for name, sub in HEALTHCARE_DOCTYPES},
        "User": FULL,
        "Role": FULL,
        "User Role": FULL,
        "DocType": FULL,
        "DocPerm": FULL,
        "Item": FULL,
        "Warehouse": FULL,
        "Stock Entry": SUBMITTABLE,
        "Stock Ledger": FULL,
    },
    "Physician": {
        "Patient": FULL,
        "EEU Workplace Incident": FULL,
        "EEU Fitness Evaluation": FULL,
        "EEU First Aid Kit": FULL,
        "Medical Leave Slip": FULL,
        "Healthcare Practitioner": FULL,
        "Medical Department": READ_WRITE,
        "Healthcare Service Unit": READ_WRITE,
        "Healthcare Service Unit Type": READ,
        "Patient Appointment": FULL,
        "Appointment Type": READ_WRITE,
        "Appointment Type Service Item": READ,
        "Practitioner Schedule": READ_WRITE,
        "Practitioner Availability": READ_WRITE,
        "Healthcare Schedule Time Slot": READ,
        "Practitioner Service Unit Schedule": READ_WRITE,
        "Vital Signs": SUBMITTABLE,
        "Patient Encounter": SUBMITTABLE,
        "Diagnosis": FULL,
        "Diagnosis Catalog": READ_WRITE,
        "Symptom": FULL,
        "Clinical Note": FULL,
        "Clinical Note Type": READ_WRITE,
        "Patient Relation": FULL,
        "Drug Prescription": FULL,
        "Lab Prescription": FULL,
        "Procedure Prescription": FULL,
        "Medication Request": {"read", "write", "create", "report", "export", "print", "email", "share", "select"},
        "Prescription Dosage": READ_WRITE,
        "Prescription Duration": READ_WRITE,
        "Dosage Form": READ,
        "Dosage Strength": READ,
        "Medication": READ,
        "Medication Class": READ,
        "Medication Class Interaction": READ,
        "Medication Ingredient": READ,
        "Medication Linked Item": READ,
        "Drug Interaction": READ,
        "Medication Override Reason Code": READ,
        "Antibiotic": READ,
        "Lab Test": {"read", "write", "report", "export", "print", "email", "share", "select"},
        "Lab Test Template": READ_WRITE,
        "Lab Test UOM": READ,
        "Lab Test Sample": READ,
        "Lab Test Group Template": READ_WRITE,
        "Clinical Procedure Template": READ_WRITE,
        "Clinical Procedure": SUBMITTABLE,
        "Observation": SUBMITTABLE,
        "Observation Template": READ_WRITE,
        "Observation Reference Range": READ,
        "Observation Sample Collection": READ,
        "Diagnostic Report": READ,
        "Sample Collection": READ,
        "Normal Test Template": READ,
        "Normal Test Result": READ,
        "Sensitivity Test Result": READ,
        "Descriptive Test Template": READ_WRITE,
        "Descriptive Test Result": READ_WRITE,
        "Organism Test Result": READ_WRITE,
        "Organism": READ,
        "Sensitivity": READ,
        "Specimen": READ,
        "Sample Type": READ,
        "Service Request": {"read", "write", "create", "report", "export", "print", "email", "share", "select"},
        "Service Request Category": READ,
        "Service Request Reason": READ,
        "Therapy Type": READ_WRITE,
        "Therapy Plan": {"read", "write", "report", "export", "print", "email", "share", "select"},
        "Therapy Plan Detail": FULL,
        "Therapy Plan Template": READ_WRITE,
        "Therapy Session": {"read", "write", "report", "export", "print", "email", "share", "select"},
        "Treatment Plan Template": READ_WRITE,
        "Treatment Plan Template Item": READ_WRITE,
        "Treatment Plan Template Practitioner": READ_WRITE,
        "Treatment Counselling": READ_WRITE,
        "Exercise": READ,
        "Exercise Type": READ,
        "Exercise Difficulty Level": READ,
        "Inpatient Record": {"read", "write", "create", "report", "export", "print", "email", "share", "select"},
        "Inpatient Record Item": READ_WRITE,
        "Inpatient Medication Order": {"read", "write", "create", "report", "export", "print", "email", "share", "select"},
        "Inpatient Medication Order Entry": READ_WRITE,
        "Inpatient Medication Entry": READ_WRITE,
        "Inpatient Medication Entry Detail": READ_WRITE,
        "Inpatient Occupancy": READ,
        "Nursing Task": FULL,
        "Nursing Checklist Template": READ,
        "Emergency Record": SUBMITTABLE,
        "Emergency Occupancy": READ,
        "Discharge Summary": FULL,
        "Patient Assessment": FULL,
        "Patient Assessment Template": READ_WRITE,
        "Complaint": READ_WRITE,
        "Triage Level": READ_WRITE,
        "Allergy": FULL,
        "Allergy Interaction": READ,
        "Body Part": READ,
        "Body Part Link": READ,
        "Patient Care Type": READ,
        "Code System": READ_WRITE,
        "Code Value": READ_WRITE,
        "Codification Table": READ_WRITE,
        "Item": READ,
        "Warehouse": READ,
        "Healthcare Settings": READ,
        "Healthcare Activity": READ,
        "Fee Validity": READ_WRITE,
        "Fee Validity Reference": READ,
        "Patient Medical Record": FULL,
        "Patient History Settings": READ,
        "Patient Medical Record Template": READ,
        "Service Unit Type Item": READ,
        "Healthcare Payment Record": {"read", "write", "create", "report", "export", "print", "email", "share", "select"},
        "Insurance Claim": READ,
        "Insurance Claim Coverage": READ,
        "Patient Insurance Policy": READ,
        "Patient Insurance Coverage": READ,
        "Insurance Payor": READ,
        "Insurance Payor Contract": READ,
        "Insurance Payor Eligibility Plan": READ,
        "Item Insurance Eligibility": READ,
        "Document Assignment": FULL,
        "Document Attachment": FULL,
        "Document Tag": FULL,
    },
    "Laboratory User": {
        "Patient": FULL,
        "Healthcare Practitioner": {"read", "write", "create", "select", "report", "print", "email", "share"},
        "Medical Department": READ_WRITE,
        "Healthcare Service Unit": READ,
        "Healthcare Service Unit Type": READ,
        "Patient Encounter": READ,
        "Patient Care Type": READ,
        "Patient Appointment": READ,
        "Appointment Type": READ,
        "Item": READ,
        "Service Request": READ_WRITE,
        "Lab Test": SUBMITTABLE,
        "Lab Test Template": {"read", "write", "create", "report", "export", "print", "email", "share", "select"},
        "Lab Test UOM": {"read", "write", "create", "select", "print", "share"},
        "Lab Test Sample": {"read", "write", "create", "select", "print", "share"},
        "Sample Collection": SUBMITTABLE,
        "Observation": SUBMITTABLE,
        "Observation Template": READ_WRITE,
        "Observation Reference Range": READ_WRITE,
        "Diagnostic Report": FULL,
        "Normal Test Template": FULL,
        "Normal Test Result": FULL,
        "Sensitivity Test Result": FULL,
        "Descriptive Test Template": FULL,
        "Descriptive Test Result": FULL,
        "Lab Test Group Template": FULL,
        "Organism Test Result": FULL,
        "Antibiotic": {"read", "write", "create", "select", "print", "share"},
        "Sensitivity": {"read", "write", "create", "select", "print", "share"},
        "Organism": {"read", "write", "create", "select", "print", "share"},
        "Specimen": READ_WRITE,
        "Sample Type": READ_WRITE,
        "Code System": READ,
        "Code Value": READ,
        "Codification Table": READ,
        "Diagnosis Catalog": READ,
        "Drug Prescription": READ,
        "Medication Request": READ,
        "Medication": READ,
        "Medication Class": READ,
        "Healthcare Settings": READ,
        "Healthcare Payment Record": READ,
        "Document Attachment": {"read", "write", "create", "select"},
        "Document Tag": {"read", "write", "create", "select"},
        "Document Assignment": {"read", "select"},
    },
    "Nursing User": {
        "Patient": FULL,
        "Patient Appointment": FULL,
        "Appointment Type": READ,
        "Appointment Type Service Item": READ,
        "Vital Signs": SUBMITTABLE,
        "Nursing Task": FULL,
        "Nursing Checklist Template": FULL,
        "Healthcare Practitioner": READ_WRITE,
        "Medical Department": READ,
        "Healthcare Service Unit": READ,
        "Healthcare Service Unit Type": READ,
        "Healthcare Schedule Time Slot": READ,
        "Emergency Record": READ_WRITE,
        "Discharge Summary": READ,
        "Patient Encounter": READ,
        "Diagnosis": READ,
        "Diagnosis Catalog": READ,
        "Complaint": READ,
        "Drug Prescription": READ,
        "Lab Prescription": READ,
        "Procedure Prescription": READ,
        "Medication Request": {"read", "share", "select"},
        "Medication": READ,
        "Dosage Form": READ,
        "Dosage Strength": READ,
        "Item": READ,
        "Warehouse": READ,
        "Code System": READ,
        "Code Value": READ,
        "Codification Table": READ,
        "Patient Care Type": READ,
        "Lab Test": READ,
        "Observation": READ,
        "Inpatient Record": READ,
        "Inpatient Medication Entry": READ_WRITE,
        "Inpatient Medication Entry Detail": READ_WRITE,
        "Healthcare Settings": READ,
        "Patient Relation": READ_WRITE,
        "Clinical Note": {"read", "write", "create", "select"},
        "Healthcare Payment Record": READ,
        "Document Attachment": {"read", "write", "create", "select"},
        "Document Tag": {"read", "write", "create", "select"},
    },
    "LabTest Approver": {
        "Lab Test": {"read", "write", "submit", "cancel", "report", "export", "print", "email", "share", "select"},
        "Observation": {"read", "write", "submit", "cancel", "report", "export", "print", "email", "share", "select"},
        "Sample Collection": {"read", "write", "submit", "cancel", "report", "export", "print", "email", "share", "select"},
        "Diagnostic Report": {"read", "write", "report", "export", "print", "email", "share", "select"},
        "Lab Test Template": READ,
        "Lab Test UOM": READ,
        "Lab Test Sample": READ,
        "Patient": READ,
        "Patient Encounter": READ,
        "Medical Department": READ,
        "Healthcare Service Unit": READ,
        "Healthcare Service Unit Type": READ,
        "Appointment Type": READ,
        "Item": READ,
        "Healthcare Practitioner": READ,
        "Normal Test Template": READ,
        "Normal Test Result": READ,
        "Sensitivity Test Result": READ_WRITE,
        "Descriptive Test Template": READ,
        "Descriptive Test Result": READ_WRITE,
        "Lab Test Group Template": READ,
        "Organism Test Result": READ_WRITE,
        "Antibiotic": READ,
        "Sensitivity": READ,
        "Organism": READ,
        "Specimen": READ,
        "Healthcare Settings": READ,
        "Document Attachment": {"read", "select"},
    },
    "Patient": {
        # Self-service portal access to own records
        "Patient": READ,
        "Healthcare Practitioner": READ,
        "Medical Department": READ,
        "Healthcare Service Unit": READ,
        "Healthcare Settings": READ,
        "Patient Appointment": READ,
        "Lab Test": READ,
        "Medication Request": READ,
        "Drug Prescription": READ,
        "Observation": READ,
        "Vital Signs": READ,
        "Patient Encounter": READ,
        "Diagnosis": READ,
        "Clinical Note": READ,
        "Therapy Plan": READ,
        "Therapy Session": READ,
        "Inpatient Record": READ,
        "Discharge Summary": READ,
        "Insurance Claim": READ,
        "Patient Insurance Policy": READ,
        "Patient Insurance Coverage": READ,
    },
    "Pharmacy User": {
        "Medication": FULL,
        "Medication Class": FULL,
        "Dosage Form": FULL,
        "Dosage Strength": FULL,
        "Drug Interaction": FULL,
        "Medication Request": FULL,
        "Inpatient Medication Entry": FULL,
        "Inpatient Medication Entry Detail": FULL,
        "Inpatient Medication Order": READ_WRITE,
        "Inpatient Medication Order Entry": READ_WRITE,
        "Drug Prescription": READ,
        "Patient": READ,
        "Healthcare Practitioner": READ,
        "Healthcare Service Unit": READ,
        "Medical Department": READ,
        "Item": READ_WRITE,
        "Warehouse": READ_WRITE,
        "Stock Entry": FULL,
        "Stock Ledger": READ,
        "Healthcare Settings": READ,
        "Healthcare Payment Record": READ_WRITE,
        "Document Attachment": {"read", "write", "create", "select"},
        "Document Tag": {"read", "write", "create", "select"},
        "Document Assignment": {"read", "select"},
    },
    "Pharmacist": {
        "Medication": FULL,
        "Medication Class": FULL,
        "Dosage Form": FULL,
        "Dosage Strength": FULL,
        "Drug Interaction": FULL,
        "Medication Request": FULL,
        "Inpatient Medication Entry": FULL,
        "Inpatient Medication Entry Detail": FULL,
        "Inpatient Medication Order": READ_WRITE,
        "Inpatient Medication Order Entry": READ_WRITE,
        "Drug Prescription": READ,
        "Patient": READ,
        "Healthcare Practitioner": READ,
        "Healthcare Service Unit": READ,
        "Medical Department": READ,
        "Item": READ_WRITE,
        "Warehouse": READ_WRITE,
        "Stock Entry": FULL,
        "Stock Ledger": READ,
        "Healthcare Settings": READ,
        "Healthcare Payment Record": READ_WRITE,
        "Document Attachment": {"read", "write", "create", "select"},
        "Document Tag": {"read", "write", "create", "select"},
        "Document Assignment": {"read", "select"},
    },
}


class Command(BaseCommand):
    help = "Seed healthcare DocTypes, roles, and DocPerms into the authorization system"

    def handle(self, *args, **options):
        self.stdout.write("Seeding healthcare authorization system...")

        with transaction.atomic():
            self._seed_roles()
            self._seed_doctypes()
            self._seed_doc_perms()

        self.stdout.write(self.style.SUCCESS("Done! Healthcare authorization system seeded."))

    def _seed_roles(self):
        self.stdout.write("  Creating healthcare roles...")
        for name, desk_access, is_system, desc in HEALTHCARE_ROLES:
            role, created = Role.objects.update_or_create(
                name=name,
                defaults={
                    "role_name": name,
                    "desk_access": desk_access,
                    "is_system_role": is_system,
                    "is_custom": False,
                    "disabled": False,
                    "is_active": True,
                    "description": desc,
                    "restrict_to_domain": "Healthcare",
                },
            )
            self.stdout.write(f"    {'+' if created else '='} {name}")

    def _seed_doctypes(self):
        self.stdout.write("  Creating healthcare DocTypes...")
        for core_dt in ("User", "Role", "User Role", "DocType", "DocPerm", "CustomDocPerm",
                        "Item", "Warehouse", "Stock Entry", "Stock Ledger"):
            DocType.objects.get_or_create(
                name=core_dt,
                defaults={
                    "module": "Stock" if core_dt in ("Item", "Warehouse", "Stock Entry", "Stock Ledger") else "Core",
                    "is_submittable": core_dt == "Stock Entry",
                    "is_active": True,
                    "description": f"Doctype: {core_dt}",
                },
            )
        for name, is_submittable in HEALTHCARE_DOCTYPES:
            dt, created = DocType.objects.update_or_create(
                name=name,
                defaults={
                    "module": "Healthcare",
                    "is_submittable": is_submittable,
                    "is_active": True,
                    "description": f"Healthcare doctype: {name}",
                },
            )
            if created:
                self.stdout.write(f"    + {name}")

    def _seed_doc_perms(self):
        self.stdout.write("  Creating healthcare DocPerms...")
        count = 0
        for role_name, doctype_perms in DOC_PERM_DEFS.items():
            try:
                role = Role.objects.get(name=role_name)
            except Role.DoesNotExist:
                self.stdout.write(self.style.WARNING(
                    f"    ! Role '{role_name}' not found, skipping"
                ))
                continue

            for doctype_name, flags in doctype_perms.items():
                try:
                    doctype = DocType.objects.get(name=doctype_name)
                except DocType.DoesNotExist:
                    self.stdout.write(self.style.WARNING(
                        f"    ! DocType '{doctype_name}' not found, skipping"
                    ))
                    continue

                defaults = {
                    "select": "select" in flags,
                    "read": "read" in flags,
                    "write": "write" in flags,
                    "create": "create" in flags,
                    "delete": "delete" in flags,
                    "submit": "submit" in flags,
                    "cancel": "cancel" in flags,
                    "amend": "amend" in flags,
                    "report": "report" in flags,
                    "export": "export" in flags,
                    "perm_import": "import" in flags,
                    "print": "print" in flags,
                    "email": "email" in flags,
                    "share": "share" in flags,
                    "mask": "mask" in flags,
                }

                dp, created = DocPerm.objects.update_or_create(
                    doctype_ref=doctype,
                    role=role,
                    permlevel=0,
                    defaults=defaults,
                )
                if created:
                    count += 1

        self.stdout.write(f"    Created {count} new DocPerm entries")