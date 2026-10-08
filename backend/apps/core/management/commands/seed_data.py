from django.contrib.auth.models import User
from django.core.management.base import BaseCommand
from django.core.management import call_command


class Command(BaseCommand):
    help = "Seed foundational setup data and invoke healthcare seeders"

    def handle(self, *args, **kwargs):
        self.stdout.write("Seeding healthcare system foundation...")

        # 1. Superuser
        admin_user, created = User.objects.get_or_create(
            username="admin",
            defaults={"email": "admin@healthcare.local", "is_staff": True, "is_superuser": True}
        )
        if created:
            admin_user.set_password("admin123")
            admin_user.save()
            self.stdout.write(self.style.SUCCESS("Created admin user (admin / admin123)"))
        else:
            self.stdout.write("Admin user already exists")

        from apps.setup.models import Company, Currency, UnitOfMeasure

        # 2. Currency
        Currency.objects.get_or_create(
            currency_code="ETB",
            defaults={
                "currency_name": "Ethiopian Birr",
                "symbol": "ETB",
                "fraction": "Santim",
                "fraction_units": 100,
            },
        )
        Currency.objects.get_or_create(
            currency_code="USD",
            defaults={
                "currency_name": "US Dollar",
                "symbol": "$",
                "fraction": "Cent",
                "fraction_units": 100,
            },
        )
        Currency.objects.get_or_create(
            currency_code="EUR",
            defaults={"currency_name": "Euro", "symbol": "€"},
        )

        # 3. UOMs
        for name in ["Nos", "Unit", "Tablet", "Capsule", "Box", "Vial", "Ampoule", "Bottle", "Strip", "Dose"]:
            UnitOfMeasure.objects.get_or_create(uom_name=name)

        # 4. Hospital Company (Ethiopian Electric Utility - Health Department)
        Company.objects.get_or_create(
            company_name="Ethiopian Electric Utility (EEU)",
            defaults={
                "abbr": "EEU",
                "default_currency": "ETB",
                "country": "Ethiopia",
                "domain": "Occupational Healthcare & Staff Medical Services",
                "email": "health@eeu.gov.et",
                "phone": "+251-11-156-0041",
                "address": "EEU Head Office, De Gaulle Square / Piassa, P.O. Box 1233, Addis Ababa, Ethiopia",
                "is_default": True,
            },
        )

        # 5. Email Accounts
        self._seed_email_accounts()

        # 6. Seed Roles
        try:
            self.stdout.write("Seeding standard roles and permissions...")
            call_command("seed_roles")
        except Exception as e:
            self.stdout.write(self.style.WARNING(f"Role seeding skipped: {e}"))

        # 7. Seed Healthcare Data
        try:
            self.stdout.write("Seeding clinical healthcare data...")
            call_command("seed_healthcare")
            call_command("seed_clinical_masters")
            call_command("seed_pharmacy_catalog")
        except Exception as e:
            self.stdout.write(self.style.WARNING(f"Healthcare seeding note: {e}"))

        self.stdout.write(self.style.SUCCESS("Successfully seeded healthcare system!"))

    def _seed_email_accounts(self):
        from apps.roles.core_models import EmailAccount

        EmailAccount.objects.get_or_create(
            email_account_name="EEU Health Directorate Notifications",
            defaults={
                "email_id": "health-notifications@eeu.gov.et",
                "email_sender_name": "EEU Health Services Directorate",
                "smtp_server": "",
                "smtp_port": 587,
                "use_tls": True,
                "default_outgoing": True,
                "enable_outgoing": True,
                "footer": "<p>Automated clinical notice from Ethiopian Electric Utility (EEU) Health Services Directorate.</p>",
                "footer_included": True,
            },
        )
