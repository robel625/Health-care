from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.db.models import Sum

from apps.roles.permissions import get_user_permissions, get_user_row_permissions
from apps.healthcare.models import (
    Patient, HealthcarePractitioner, PatientAppointment,
    PatientEncounter, InpatientRecord, HealthcarePaymentRecord,
    PharmacyStock, PharmacyWarehouse,
)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def dashboard_stats(request):
    """Return aggregated Healthcare dashboard statistics."""
    user = request.user
    user_perms = get_user_permissions(user) if not user.is_staff else {}

    total_patients = Patient.objects.count()
    total_practitioners = HealthcarePractitioner.objects.count()
    total_appointments = PatientAppointment.objects.count()
    total_encounters = PatientEncounter.objects.count()
    admitted_patients = InpatientRecord.objects.filter(status="Admitted").count()
    total_pharmacy_items = PharmacyStock.objects.count()
    total_pharmacy_warehouses = PharmacyWarehouse.objects.count()

    total_payments = HealthcarePaymentRecord.objects.filter(
        status="Completed"
    ).aggregate(total=Sum("amount"))["total"] or 0

    return Response({
        "total_patients": total_patients,
        "total_practitioners": total_practitioners,
        "total_appointments": total_appointments,
        "total_encounters": total_encounters,
        "admitted_patients": admitted_patients,
        "total_pharmacy_items": total_pharmacy_items,
        "total_pharmacy_warehouses": total_pharmacy_warehouses,
        "total_revenue": float(total_payments),
        # Legacy ERP keys maintained for frontend compatibility
        "total_customers": total_patients,
        "total_suppliers": 0,
        "total_items": total_pharmacy_items,
        "total_warehouses": total_pharmacy_warehouses,
        "open_sales_orders": total_appointments,
        "open_purchase_orders": 0,
        "total_expenses": 0.0,
        "net_profit": float(total_payments),
        "user_permissions": user_perms,
    })
