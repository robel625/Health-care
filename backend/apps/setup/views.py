from rest_framework import viewsets

from .models import Company, Currency, FiscalYear, UnitOfMeasure
from .serializers import (
    CompanySerializer,
    CurrencySerializer,
    FiscalYearSerializer,
    UnitOfMeasureSerializer,
)


class CompanyViewSet(viewsets.ModelViewSet):
    queryset = Company.objects.all()
    serializer_class = CompanySerializer
    search_fields = ["company_name", "abbr", "email"]
    filterset_fields = ["is_active", "is_default", "domain"]


class FiscalYearViewSet(viewsets.ModelViewSet):
    queryset = FiscalYear.objects.select_related("company").all()
    serializer_class = FiscalYearSerializer
    filterset_fields = ["company", "year", "is_closed"]


class CurrencyViewSet(viewsets.ModelViewSet):
    queryset = Currency.objects.all()
    serializer_class = CurrencySerializer
    search_fields = ["currency_name", "currency_code"]


class UnitOfMeasureViewSet(viewsets.ModelViewSet):
    queryset = UnitOfMeasure.objects.all()
    serializer_class = UnitOfMeasureSerializer
    search_fields = ["uom_name"]
    filterset_fields = ["uom_type"]
