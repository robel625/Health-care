from django.db import models

from apps.core.models import BaseModel


class Company(BaseModel):
    company_name = models.CharField(max_length=200)
    abbr = models.CharField(max_length=10, blank=True, default="")
    default_currency = models.CharField(max_length=3, default="USD")
    country = models.CharField(max_length=100, blank=True, default="")
    domain = models.CharField(max_length=100, blank=True, default="")  # e.g. Manufacturing, Services
    phone = models.CharField(max_length=20, blank=True, default="")
    email = models.EmailField(blank=True, default="")
    website = models.URLField(blank=True, default="")
    address = models.TextField(blank=True, default="")
    tax_id = models.CharField(max_length=50, blank=True, default="")
    is_default = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "setup_company"
        ordering = ["company_name"]

    def __str__(self):
        return self.company_name


class FiscalYear(BaseModel):
    year = models.CharField(max_length=4)  # e.g. "2024"
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name="fiscal_years")
    year_start_date = models.DateField()
    year_end_date = models.DateField()
    is_closed = models.BooleanField(default=False)

    class Meta:
        db_table = "setup_fiscal_year"
        unique_together = ["year", "company"]
        ordering = ["-year"]

    def __str__(self):
        return f"{self.year} - {self.company.company_name}"


class Currency(BaseModel):
    currency_name = models.CharField(max_length=100)
    currency_code = models.CharField(max_length=3, unique=True)
    symbol = models.CharField(max_length=5, blank=True, default="")
    fraction = models.CharField(max_length=20, default="Cent")
    fraction_units = models.IntegerField(default=100)
    smallest_currency_fraction_value = models.DecimalField(
        max_digits=18, decimal_places=6, default=0.01
    )

    class Meta:
        db_table = "setup_currency"
        ordering = ["currency_code"]

    def __str__(self):
        return f"{self.currency_code} - {self.currency_name}"


class UnitOfMeasure(BaseModel):
    uom_name = models.CharField(max_length=50, unique=True)
    uom_type = models.CharField(
        max_length=20,
        choices=[
            ("Text", "Text"),
            ("Numeric", "Numeric"),
        ],
        default="Numeric",
    )

    class Meta:
        db_table = "setup_uom"
        ordering = ["uom_name"]

    def __str__(self):
        return self.uom_name
