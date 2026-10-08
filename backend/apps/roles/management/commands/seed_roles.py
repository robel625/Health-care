"""
Seed Frappe-standard roles, DocTypes, DocPerms, and SecuritySettings.

Based on Frappe's actual role definitions and permission model.
"""

from django.core.management.base import BaseCommand

from apps.roles.models import (
    CustomDocPerm,
    DocPerm,
    DocType,
    Role,
    SecuritySettings,
)


# ── Frappe & Healthcare standard roles ─────────────────────────────
FRAPPE_STANDARD_ROLES = [
    # name, desk_access, is_system_role, is_custom, description
    ("Administrator", True, True, False, "System administrator with full access"),
    ("Guest", False, False, False, "Unauthenticated / guest user"),
    ("All", False, False, False, "Role applied to all users"),
    ("System Manager", True, True, False, "Full system access, manages users and settings"),
    # Healthcare Roles
    ("Healthcare Administrator", True, True, False, "Healthcare clinical and facility administrator"),
    ("Physician", True, False, False, "Doctor / Medical Practitioner with full clinical access"),
    ("Nurse", True, False, False, "Nursing staff with clinical and inpatient care access"),
    ("Nursing User", True, True, False, "Nursing staff - vitals, appointments, nursing tasks"),
    ("Pharmacist", True, True, False, "Licensed pharmacist - medication orders, dispensing, formulary management"),
    ("Pharmacy User", True, True, False, "Pharmacy staff - medications, dispensing, stock entries"),
    ("Lab Technician", True, False, False, "Laboratory test analyst and report publisher"),
    ("Laboratory User", True, True, False, "Laboratory staff - lab tests, samples, results"),
    ("LabTest Approver", True, True, False, "Can approve lab test results and observations"),
    ("Receptionist", True, False, False, "Patient registration and appointment scheduling staff"),
    ("Patient", True, False, False, "Portal role for patients - self-service access to own records"),
]

# ── DocTypes (Healthcare & Setup) ──────────────────────────────────
ERP_DOCTYPES = [
    # (name, module, is_submittable)
    # Setup
    ("Company", "Setup", False),
    ("Currency", "Setup", False),
    ("Fiscal Year", "Setup", False),
    ("UOM", "Setup", False),
    ("System Settings", "Setup", False),
    ("Role", "Core", False),
    ("User", "Core", False),
    ("DocType", "Core", False),
    # Healthcare
    ("Patient", "Healthcare", False),
    ("Healthcare Practitioner", "Healthcare", False),
    ("Medical Department", "Healthcare", False),
    ("Healthcare Service Unit", "Healthcare", False),
    ("Patient Appointment", "Healthcare", False),
    ("Patient Encounter", "Healthcare", False),
    ("Vital Signs", "Healthcare", False),
    ("Diagnosis", "Healthcare", False),
    ("Drug Prescription", "Healthcare", False),
    ("Medication Request", "Healthcare", True),
    ("Lab Test", "Healthcare", True),
    ("Lab Test Template", "Healthcare", False),
    ("Clinical Procedure", "Healthcare", True),
    ("Therapy Plan", "Healthcare", False),
    ("Inpatient Record", "Healthcare", False),
    ("Inpatient Medication Entry", "Healthcare", True),
    ("Pharmacy Warehouse", "Healthcare", False),
    ("Pharmacy Stock", "Healthcare", False),
    ("Pharmacy Stock Entry", "Healthcare", True),
    ("Healthcare Payment Record", "Healthcare", False),
]

# ── DocPerm definitions per role ───────────────────────────────────
DOC_PERM_DEFS = {
    "Administrator": {},
    "System Manager": {},
    "Healthcare Administrator": {
        "Patient": {"read": True, "write": True, "create": True, "delete": True, "report": True, "export": True, "print": True, "email": True, "share": True},
        "Healthcare Practitioner": {"read": True, "write": True, "create": True, "delete": True, "report": True},
        "Patient Appointment": {"read": True, "write": True, "create": True, "delete": True, "report": True},
        "Patient Encounter": {"read": True, "write": True, "create": True, "delete": True, "report": True},
        "Medication Request": {"read": True, "write": True, "create": True, "submit": True, "cancel": True},
        "Lab Test": {"read": True, "write": True, "create": True, "submit": True, "cancel": True},
        "Pharmacy Stock": {"read": True, "write": True, "create": True, "delete": True},
        "Pharmacy Warehouse": {"read": True, "write": True, "create": True, "delete": True},
        "Pharmacy Stock Entry": {"read": True, "write": True, "create": True, "submit": True},
    },
    "Physician": {
        "Patient": {"read": True, "write": True, "report": True},
        "Patient Appointment": {"read": True, "write": True},
        "Patient Encounter": {"read": True, "write": True, "create": True},
        "Vital Signs": {"read": True, "write": True, "create": True},
        "Drug Prescription": {"read": True, "write": True, "create": True},
        "Medication Request": {"read": True, "write": True, "create": True, "submit": True},
        "Lab Test": {"read": True, "write": True, "create": True},
        "Inpatient Record": {"read": True, "write": True},
    },
    "Nurse": {
        "Patient": {"read": True},
        "Vital Signs": {"read": True, "write": True, "create": True},
        "Patient Encounter": {"read": True},
        "Inpatient Record": {"read": True, "write": True},
        "Inpatient Medication Entry": {"read": True, "write": True, "create": True, "submit": True},
    },
    "Pharmacist": {
        "Patient": {"read": True},
        "Drug Prescription": {"read": True},
        "Medication Request": {"read": True, "write": True, "submit": True},
        "Pharmacy Warehouse": {"read": True, "write": True, "create": True},
        "Pharmacy Stock": {"read": True, "write": True, "create": True, "report": True},
        "Pharmacy Stock Entry": {"read": True, "write": True, "create": True, "submit": True},
        "Healthcare Payment Record": {"read": True, "write": True, "create": True},
    },
    "Lab Technician": {
        "Patient": {"read": True},
        "Lab Test Template": {"read": True},
        "Lab Test": {"read": True, "write": True, "create": True, "submit": True, "report": True, "print": True},
    },
    "Receptionist": {
        "Patient": {"read": True, "write": True, "create": True},
        "Patient Appointment": {"read": True, "write": True, "create": True, "delete": True},
        "Healthcare Practitioner": {"read": True},
        "Healthcare Payment Record": {"read": True, "write": True, "create": True},
    },
    "Guest": {
        "Patient": {"read": True},
    },
}


class Command(BaseCommand):
    help = "Seed Frappe-standard roles, DocTypes, DocPerms, and SecuritySettings"

    def handle(self, *args, **options):
        self.stdout.write("Seeding Frappe-standard authorization system...")

        self._seed_roles()
        self._seed_doctypes()
        self._seed_doc_perms()
        self._seed_security_settings()

        self.stdout.write(self.style.SUCCESS("Done! Authorization system seeded."))

    def _seed_roles(self):
        self.stdout.write("  Creating roles...")
        for name, desk_access, is_system, is_custom, desc in FRAPPE_STANDARD_ROLES:
            role, created = Role.objects.update_or_create(
                name=name,
                defaults={
                    "role_name": name,
                    "desk_access": desk_access,
                    "is_system_role": is_system,
                    "is_custom": is_custom,
                    "disabled": False,
                    "is_active": True,
                    "description": desc,
                },
            )
            if created:
                self.stdout.write(f"    + {name}")
            else:
                self.stdout.write(f"    = {name} (exists)")

    def _seed_doctypes(self):
        self.stdout.write("  Creating DocTypes...")
        for name, module, is_submittable in ERP_DOCTYPES:
            dt, created = DocType.objects.update_or_create(
                name=name,
                defaults={
                    "module": module,
                    "is_submittable": is_submittable,
                    "is_active": True,
                },
            )
            if created:
                self.stdout.write(f"    + {name} ({module})")

    def _seed_doc_perms(self):
        self.stdout.write("  Creating DocPerms...")
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

                # Merge flags for this role+doctype
                defaults = {
                    "select": flags.get("select", False),
                    "read": flags.get("read", False),
                    "write": flags.get("write", False),
                    "create": flags.get("create", False),
                    "delete": flags.get("delete", False),
                    "submit": flags.get("submit", False),
                    "cancel": flags.get("cancel", False),
                    "amend": flags.get("amend", False),
                    "report": flags.get("report", False),
                    "export": flags.get("export", False),
                    "perm_import": flags.get("import", False),
                    "print": flags.get("print", False),
                    "email": flags.get("email", False),
                    "share": flags.get("share", False),
                }

                dp, created = DocPerm.objects.update_or_create(
                    doctype_ref=doctype,
                    role=role,
                    permlevel=0,
                    defaults=defaults,
                )
                if created:
                    count += 1

        self.stdout.write(f"    Created {count} DocPerm entries")

    def _seed_security_settings(self):
        self.stdout.write("  Creating SecuritySettings...")
        SecuritySettings.objects.get_or_create(
            pk=1,
            defaults={
                "enable_password_policy": False,
                "minimum_password_score": 2,
                "password_reset_link_expiry_duration": 20160,
                "logout_on_password_reset": True,
                "allow_login_using_mobile_number": False,
                "allow_login_using_user_name": True,
                "max_signups_per_minute": 0,
                "max_login_attempts": 5,
                "session_expiry": "06:00",
                "session_expiry_mobile": "06:00",
                "allow_all_sessions": True,
                "enable_two_factor_auth": False,
                "two_factor_method": "OTP App",
            },
        )
        self.stdout.write("    SecuritySettings created")
