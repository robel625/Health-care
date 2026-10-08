"""
Healthcare Celery Tasks Module
==============================
Asynchronous background tasks for lab test orders, approvals, notifications,
emails, SMS alerts, and periodic scheduler jobs.
"""

import logging
from datetime import timedelta
from celery import shared_task
from django.conf import settings
from django.core.mail import send_mail
from django.utils import timezone
from django.contrib.auth import get_user_model

from .realtime import publish_realtime_event

User = get_user_model()
logger = logging.getLogger(__name__)


@shared_task(name="apps.healthcare.tasks.task_notify_lab_order_created")
def task_notify_lab_order_created(encounter_id, service_request_ids=None):
    """
    Asynchronous Celery task triggered when a Doctor submits an Encounter with Lab Orders.
    1. Generates NotificationDelivery records for lab technicians and system managers.
    2. Broadcasts realtime notification to Redis/SSE.
    """
    from .models import PatientEncounter, ServiceRequest
    from apps.roles.core_models import NotificationDelivery

    try:
        encounter = PatientEncounter.objects.select_related(
            "patient", "practitioner"
        ).get(pk=encounter_id)
    except PatientEncounter.DoesNotExist:
        logger.error(f"Encounter {encounter_id} not found for lab order notification.")
        return False

    patient_name = encounter.patient.patient_name if encounter.patient else "Unknown Patient"
    practitioner_name = (
        encounter.practitioner.practitioner_name if encounter.practitioner else "Doctor"
    )

    sr_qs = ServiceRequest.objects.filter(
        reference_doctype="PatientEncounter",
        reference_name=encounter.encounter_id,
    )
    if service_request_ids:
        sr_qs = sr_qs.filter(id__in=service_request_ids)

    sr_items = list(sr_qs.values("id", "request_id", "title", "priority", "intent"))
    test_count = len(sr_items) or 1
    test_names = ", ".join(item.get("title", "") for item in sr_items[:3]) or "Lab Tests"

    subject = f"New Lab Order: {test_names} ({patient_name})"
    message = (
        f"Dr. {practitioner_name} prescribed {test_count} lab test(s) for patient {patient_name}.\n"
        f"Encounter: {encounter.encounter_id}\n"
        f"Tests: {test_names}"
    )

    # 1. Deliver notifications to staff / superusers / lab staff
    staff_users = User.objects.filter(is_active=True, is_staff=True)[:10]
    for staff in staff_users:
        try:
            NotificationDelivery.objects.create(
                event="lab_order_created",
                subject=subject,
                message=message,
                channel="dashboard",
                status="sent",
                recipient=staff,
                recipient_name=staff.username,
                reference_doctype="PatientEncounter",
                reference_name=encounter.encounter_id,
                triggered_by=encounter.practitioner.user if encounter.practitioner and encounter.practitioner.user else None,
            )
        except Exception as e:
            logger.warning(f"Could not create NotificationDelivery for {staff}: {e}")

    # 2. Publish real-time event to SSE / Redis Pub/Sub
    publish_realtime_event(
        event_type="lab_order_created",
        data={
            "title": "New Lab Order Created",
            "message": message,
            "encounter_id": encounter.id,
            "encounter_code": encounter.encounter_id,
            "patient_name": patient_name,
            "practitioner_name": practitioner_name,
            "test_count": test_count,
            "service_requests": sr_items,
            "timestamp": timezone.now().isoformat(),
        },
    )

    logger.info(f"Dispatched lab order notification for encounter {encounter_id}")
    return True


@shared_task(name="apps.healthcare.tasks.task_notify_lab_result_approved")
def task_notify_lab_result_approved(lab_test_id):
    """
    Asynchronous Celery task triggered when a Laboratorist approves a Lab Test.
    1. Updates linked Service Request to Completed.
    2. Creates in-app NotificationDelivery for ordering Doctor and Patient.
    3. Dispatches email to Patient with test result summary.
    4. Broadcasts realtime notification to Redis/SSE.
    """
    from .models import LabTest
    from apps.roles.core_models import NotificationDelivery

    try:
        lab_test = LabTest.objects.select_related(
            "patient", "practitioner", "template", "service_request"
        ).get(pk=lab_test_id)
    except LabTest.DoesNotExist:
        logger.error(f"LabTest {lab_test_id} not found for result approval notification.")
        return False

    patient = lab_test.patient
    practitioner = lab_test.practitioner
    patient_name = patient.patient_name if patient else "Patient"
    practitioner_name = practitioner.practitioner_name if practitioner else "Doctor"
    test_name = lab_test.lab_test_name or (lab_test.template.lab_test_name if lab_test.template else "Lab Test")

    # Mark linked Service Request completed if still active
    if lab_test.service_request and lab_test.service_request.status != "Completed":
        lab_test.service_request.status = "Completed"
        lab_test.service_request.save(update_fields=["status"])

    subject = f"Lab Result Approved: {test_name} for {patient_name}"
    message = (
        f"The laboratory has completed and approved results for '{test_name}'.\n"
        f"Patient: {patient_name}\n"
        f"Verified on: {lab_test.approved_date or timezone.now().date()}\n"
        f"Test ID: {lab_test.test_id or f'LT-{lab_test.id}'}"
    )

    # 1. In-app notification to the ordering practitioner
    doctor_user = practitioner.user if practitioner and practitioner.user else None
    if doctor_user:
        try:
            NotificationDelivery.objects.create(
                event="lab_result_approved",
                subject=subject,
                message=message,
                channel="dashboard",
                status="sent",
                recipient=doctor_user,
                recipient_name=doctor_user.username,
                reference_doctype="LabTest",
                reference_name=lab_test.test_id or str(lab_test.id),
            )
        except Exception as e:
            logger.warning(f"Failed to create doctor notification: {e}")

    # 2. In-app notification to the patient if registered user
    patient_user = patient.user if patient and patient.user else None
    if patient_user:
        try:
            NotificationDelivery.objects.create(
                event="lab_result_approved",
                subject=f"Your {test_name} result is ready",
                message=f"Hello {patient_name}, your test result for {test_name} has been approved by the laboratory.",
                channel="dashboard",
                status="sent",
                recipient=patient_user,
                recipient_name=patient_user.username,
                reference_doctype="LabTest",
                reference_name=lab_test.test_id or str(lab_test.id),
            )
        except Exception as e:
            logger.warning(f"Failed to create patient notification: {e}")

    # 3. Email notification to the patient
    recipient_email = lab_test.email or (patient.email if patient else "")
    if recipient_email:
        try:
            email_body = (
                f"Dear {patient_name},\n\n"
                f"Your laboratory results for '{test_name}' are now ready and have been approved by the lab team.\n\n"
                f"Ordering Practitioner: Dr. {practitioner_name}\n"
                f"Report Date: {lab_test.approved_date or timezone.now().date()}\n\n"
                f"You can view your full report in your patient portal or collect a printed copy at the medical center.\n\n"
                f"Thank you,\nMarley Healthcare Diagnostic Services"
            )
            send_mail(
                subject=f"Your Lab Test Results: {test_name}",
                message=email_body,
                from_email=getattr(settings, "DEFAULT_FROM_EMAIL", "noreply@erp.local"),
                recipient_list=[recipient_email],
                fail_silently=True,
            )
            lab_test.email_sent = True
            lab_test.save(update_fields=["email_sent"])
            logger.info(f"Dispatched result email to {recipient_email}")
        except Exception as e:
            logger.warning(f"Failed to send email to {recipient_email}: {e}")

    # 4. Simulated SMS log
    recipient_mobile = lab_test.mobile or (patient.mobile if patient else "")
    if recipient_mobile:
        logger.info(
            f"[SMS Gateway] Dispatched to {recipient_mobile}: "
            f"Hello {patient_name}, your {test_name} result is ready. - Marley Health"
        )

    # 5. Publish real-time event to SSE / Redis Pub/Sub
    publish_realtime_event(
        event_type="lab_result_approved",
        data={
            "title": f"Lab Result Approved: {test_name}",
            "message": message,
            "lab_test_id": lab_test.id,
            "test_id": lab_test.test_id or f"LT-{lab_test.id}",
            "patient_id": patient.id if patient else None,
            "patient_name": patient_name,
            "practitioner_name": practitioner_name,
            "test_name": test_name,
            "status": "Approved",
            "approved_date": str(lab_test.approved_date or timezone.now().date()),
            "timestamp": timezone.now().isoformat(),
        },
        user_id=doctor_user.id if doctor_user else None,
    )

    logger.info(f"Finished result approval processing for lab test {lab_test_id}")
    return True


@shared_task(name="apps.healthcare.tasks.task_check_unfulfilled_orders")
def task_check_unfulfilled_orders():
    """
    Celery Beat periodic scheduler task.
    Scans for active Service Requests older than 24 hours and sends reminders.
    """
    from .models import ServiceRequest

    cutoff = timezone.now() - timedelta(hours=24)
    pending_orders = ServiceRequest.objects.filter(
        status="Active",
        creation__lte=cutoff,
    ).select_related("patient", "practitioner")

    count = pending_orders.count()
    if count > 0:
        logger.info(f"[Celery Beat] Found {count} unfulfilled lab/service requests older than 24h.")
        publish_realtime_event(
            event_type="pending_orders_reminder",
            data={
                "title": "Pending Orders Reminder",
                "message": f"There are {count} active orders pending fulfillment for over 24 hours.",
                "pending_count": count,
                "timestamp": timezone.now().isoformat(),
            },
        )
    return count
