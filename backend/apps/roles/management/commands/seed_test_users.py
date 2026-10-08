"""
Seed test users for healthcare roles with passwords and Frappe-style role assignments.

Roles mapped:
- Healthcare Administrator: hcadmin
- Physician: dr.smith, physician
- Nursing User: nurse.joy, nurse
- Laboratory User: lab.tech, labuser
- LabTest Approver: lab.approver
- Patient: patient.user
- Multiple roles (Physician + Nursing User): clinical.lead
- Multiple roles (Laboratory User + LabTest Approver): lab.director

Password for all test users: Password123!
"""

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction

from apps.roles.models import HasRole, Role, UserRole

User = get_user_model()

TEST_USERS = [
    {
        "username": "dr.smith",
        "email": "dr.smith@example.com",
        "first_name": "John",
        "last_name": "Smith",
        "roles": ["Physician"],
        "is_staff": False,
        "practitioner_name": "Dr. John Smith",
    },
    {
        "username": "physician",
        "email": "physician@example.com",
        "first_name": "Jane",
        "last_name": "Physician",
        "roles": ["Physician"],
        "is_staff": False,
        "practitioner_name": "Dr. Jane Physician",
    },
    {
        "username": "nurse.joy",
        "email": "nurse.joy@example.com",
        "first_name": "Joy",
        "last_name": "Nurse",
        "roles": ["Nursing User"],
        "is_staff": False,
    },
    {
        "username": "nurse",
        "email": "nurse@example.com",
        "first_name": "Florence",
        "last_name": "Nurse",
        "roles": ["Nursing User"],
        "is_staff": False,
    },
    {
        "username": "lab.tech",
        "email": "lab.tech@example.com",
        "first_name": "Dexter",
        "last_name": "Technician",
        "roles": ["Laboratory User"],
        "is_staff": False,
    },
    {
        "username": "labuser",
        "email": "labuser@example.com",
        "first_name": "Lab",
        "last_name": "User",
        "roles": ["Laboratory User"],
        "is_staff": False,
    },
    {
        "username": "lab.approver",
        "email": "lab.approver@example.com",
        "first_name": "Approver",
        "last_name": "Lab",
        "roles": ["LabTest Approver"],
        "is_staff": False,
    },
    {
        "username": "hcadmin",
        "email": "hcadmin@example.com",
        "first_name": "Healthcare",
        "last_name": "Administrator",
        "roles": ["Healthcare Administrator"],
        "is_staff": True,
    },
    {
        "username": "patient.user",
        "email": "patient@example.com",
        "first_name": "Alice",
        "last_name": "Patient",
        "roles": ["Patient"],
        "is_staff": False,
    },
    {
        "username": "clinical.lead",
        "email": "clinical.lead@example.com",
        "first_name": "Gregory",
        "last_name": "House",
        "roles": ["Physician", "Nursing User"],
        "is_staff": False,
        "practitioner_name": "Dr. Gregory House",
    },
    {
        "username": "lab.director",
        "email": "lab.director@example.com",
        "first_name": "Robert",
        "last_name": "Director",
        "roles": ["Laboratory User", "LabTest Approver"],
        "is_staff": False,
    },
    {
        "username": "pharmacist",
        "email": "pharmacist@example.com",
        "first_name": "Philip",
        "last_name": "Pharmacist",
        "roles": ["Pharmacy User"],
        "is_staff": False,
    },
    {
        "username": "pharmacy.user",
        "email": "pharmacy@example.com",
        "first_name": "Patricia",
        "last_name": "Pharmacy",
        "roles": ["Pharmacy User"],
        "is_staff": False,
    },
]

DEFAULT_PASSWORD = "Password123!"


class Command(BaseCommand):
    help = "Seed test users for healthcare roles with credentials and role assignments"

    def handle(self, *args, **options):
        self.stdout.write("Seeding test users for healthcare roles...")

        with transaction.atomic():
            for user_info in TEST_USERS:
                username = user_info["username"]
                email = user_info["email"]
                first_name = user_info["first_name"]
                last_name = user_info["last_name"]
                role_names = user_info["roles"]
                is_staff = user_info.get("is_staff", False)

                user, created = User.objects.get_or_create(
                    username=username,
                    defaults={
                        "email": email,
                        "first_name": first_name,
                        "last_name": last_name,
                        "is_active": True,
                        "is_staff": is_staff,
                    },
                )

                if not created:
                    user.email = email
                    user.first_name = first_name
                    user.last_name = last_name
                    user.is_active = True
                    user.is_staff = is_staff

                user.set_password(DEFAULT_PASSWORD)
                user.save()

                # Sync roles in both UserRole and HasRole tables
                UserRole.objects.filter(user=user).delete()
                HasRole.objects.filter(user=user).delete()

                assigned_roles = []
                for r_name in role_names:
                    try:
                        role_obj = Role.objects.get(name=r_name)
                        UserRole.objects.create(user=user, role=role_obj)
                        HasRole.objects.create(user=user, role=role_obj)
                        assigned_roles.append(r_name)
                    except Role.DoesNotExist:
                        self.stdout.write(self.style.WARNING(f"Role '{r_name}' does not exist!"))

                # Link practitioner if specified
                practitioner_name = user_info.get("practitioner_name")
                if practitioner_name:
                    try:
                        from apps.healthcare.models import HealthcarePractitioner
                        HealthcarePractitioner.objects.update_or_create(
                            user=user,
                            defaults={
                                "first_name": first_name,
                                "last_name": last_name,
                                "practitioner_name": practitioner_name,
                                "email": email,
                                "status": "Active",
                            },
                        )
                    except Exception as e:
                        self.stdout.write(self.style.WARNING(f"Could not link practitioner: {e}"))

                # Link patient if patient.user
                if username == "patient.user":
                    try:
                        from apps.healthcare.models import Patient
                        Patient.objects.update_or_create(
                            email=email,
                            defaults={
                                "first_name": first_name,
                                "last_name": last_name,
                                "patient_name": f"{first_name} {last_name}",
                                "sex": "Female",
                                "status": "Active",
                            },
                        )
                    except Exception as e:
                        self.stdout.write(self.style.WARNING(f"Could not link patient: {e}"))

                action_str = "Created" if created else "Updated"
                self.stdout.write(
                    f"  {action_str} user '{username}' (Roles: {', '.join(assigned_roles)})"
                )

        self.stdout.write(
            self.style.SUCCESS(
                f"\nAll test users seeded successfully! Password for all is '{DEFAULT_PASSWORD}'"
            )
        )
