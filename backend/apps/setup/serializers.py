from rest_framework import serializers

from .models import Company, Currency, FiscalYear, UnitOfMeasure


class CompanySerializer(serializers.ModelSerializer):
    class Meta:
        model = Company
        fields = "__all__"
        read_only_fields = ["creation", "modified", "modified_by", "owner"]


class FiscalYearSerializer(serializers.ModelSerializer):
    company_name = serializers.CharField(source="company.company_name", read_only=True)

    class Meta:
        model = FiscalYear
        fields = "__all__"
        read_only_fields = ["creation", "modified", "modified_by", "owner"]


class CurrencySerializer(serializers.ModelSerializer):
    class Meta:
        model = Currency
        fields = "__all__"
        read_only_fields = ["creation", "modified", "modified_by", "owner"]


class UnitOfMeasureSerializer(serializers.ModelSerializer):
    class Meta:
        model = UnitOfMeasure
        fields = "__all__"
        read_only_fields = ["creation", "modified", "modified_by", "owner"]
