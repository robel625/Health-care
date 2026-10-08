from django.apps import AppConfig


class HealthcareConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.healthcare'

    def ready(self):
        import apps.healthcare.signals  # noqa
