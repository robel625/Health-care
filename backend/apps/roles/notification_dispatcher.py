"""
Notification Dispatcher — sends notifications when ERP events occur.

Usage:
    from apps.roles.notification_dispatcher import dispatch_notification

    dispatch_notification(
        event="comment_added",
        subject="New comment on Sales Order SO-0001",
        message="John added a comment: 'Looks good!'",
        reference_doctype="Sales Order",
        reference_name="SO-0001",
        triggered_by=request.user,
    )
"""

import logging
from typing import Optional

from django.contrib.auth.models import User
from django.utils import timezone

logger = logging.getLogger(__name__)


def dispatch_notification(
    event: str,
    subject: str = "",
    message: str = "",
    reference_doctype: str = "",
    reference_name: str = "",
    triggered_by: Optional[User] = None,
    extra_recipients: Optional[list] = None,
) -> list:
    """
    Dispatch a notification for the given event.

    Looks up NotificationSetting for the event, determines recipients,
    and creates NotificationDelivery records.

    Returns list of created NotificationDelivery instances.
    """
    from .core_models import NotificationSetting, NotificationDelivery, UserNotificationSetting

    try:
        setting = NotificationSetting.objects.get(event=event)
    except NotificationSetting.DoesNotExist:
        logger.debug(f"No NotificationSetting for event '{event}', skipping.")
        return []

    if not setting.enabled:
        logger.debug(f"NotificationSetting for '{event}' is disabled, skipping.")
        return []

    # Determine recipients from global setting
    recipients = _get_recipients(setting, triggered_by)
    if extra_recipients:
        for extra in extra_recipients:
            if extra and extra not in recipients and getattr(extra, "is_active", True):
                recipients.append(extra)

    if not recipients:
        logger.debug(f"No recipients found for event '{event}'.")
        return []

    deliveries = []

    for recipient in recipients:
        # Check per-user overrides
        effective = UserNotificationSetting.get_effective(recipient, event)

        if effective["muted"]:
            continue
        if not effective["enabled"]:
            continue

        # Dashboard notification
        if effective["send_dashboard"]:
            delivery = NotificationDelivery.objects.create(
                event=event,
                subject=subject or _default_subject(event),
                message=message or _default_message(event),
                channel="dashboard",
                status="sent",
                recipient=recipient,
                recipient_name=recipient.username,
                reference_doctype=reference_doctype,
                reference_name=reference_name,
                triggered_by=triggered_by,
            )
            deliveries.append(delivery)

        # System notification
        if effective["send_system"]:
            delivery = NotificationDelivery.objects.create(
                event=event,
                subject=subject or _default_subject(event),
                message=message or _default_message(event),
                channel="system",
                status="sent",
                recipient=recipient,
                recipient_name=recipient.username,
                reference_doctype=reference_doctype,
                reference_name=reference_name,
                triggered_by=triggered_by,
            )
            deliveries.append(delivery)

        # Email notification — actually send via Django email backend
        if effective["send_email"] and recipient.email:
            email_subject = _render_template(setting.subject_template, subject, event)
            email_message = _render_template(setting.message_template, message, event)
            final_subject = email_subject or subject or _default_subject(event)
            final_message = email_message or message or _default_message(event)

            # Build HTML email body
            html_body = _build_html_email(
                subject=final_subject,
                message=final_message,
                event=event,
                reference_doctype=reference_doctype,
                reference_name=reference_name,
                triggered_by=triggered_by,
            )

            # Attempt to send
            email_success = _send_email(
                to_email=recipient.email,
                subject=final_subject,
                message=final_message,
                html_message=html_body,
            )

            delivery = NotificationDelivery.objects.create(
                event=event,
                subject=final_subject,
                message=final_message,
                channel="email",
                status="sent" if email_success else "failed",
                recipient=recipient,
                recipient_name=recipient.username,
                reference_doctype=reference_doctype,
                reference_name=reference_name,
                triggered_by=triggered_by,
                email_sent=email_success,
                email_sent_at=timezone.now() if email_success else None,
            )
            deliveries.append(delivery)

    logger.info(
        f"Dispatched {len(deliveries)} notifications for event '{event}' "
        f"to {len(recipients)} recipient(s)."
    )

    return deliveries


ROLE_SYNONYMS = {
    "Nurse": ["Nurse", "Nursing User"],
    "Nursing User": ["Nurse", "Nursing User"],
    "Pharmacist": ["Pharmacist", "Pharmacy User"],
    "Pharmacy User": ["Pharmacist", "Pharmacy User"],
    "Lab Technician": ["Lab Technician", "Laboratory User", "LabTest Approver"],
    "Laboratory User": ["Lab Technician", "Laboratory User", "LabTest Approver"],
    "Physician": ["Physician", "Doctor"],
    "Healthcare Administrator": ["Healthcare Administrator", "System Manager", "Administrator"],
    "System Manager": ["System Manager", "Healthcare Administrator", "Administrator"],
}


def _get_recipients(setting, triggered_by=None):
    """
    Determine the list of User objects who should receive this notification
    based on the NotificationSetting's recipient configuration.
    """
    from apps.roles.models import HasRole, UserRole

    recipient_type = setting.recipient_type

    if recipient_type == "all":
        return list(User.objects.filter(is_active=True))

    elif recipient_type == "system_managers":
        role_names = ["System Manager", "Administrator", "Healthcare Administrator"]
        user_ids = set()
        user_ids.update(
            HasRole.objects.filter(role__name__in=role_names, role__is_active=True)
            .values_list("user_id", flat=True)
        )
        user_ids.update(
            UserRole.objects.filter(role__name__in=role_names, role__is_active=True)
            .values_list("user_id", flat=True)
        )
        return list(User.objects.filter(id__in=user_ids, is_active=True))

    elif recipient_type == "roles":
        configured_roles = setting.recipient_roles or []
        if not configured_roles:
            return []
        expanded_roles = []
        for r in configured_roles:
            expanded_roles.extend(ROLE_SYNONYMS.get(r, [r]))
        expanded_roles = list(set(expanded_roles))

        user_ids = set()
        user_ids.update(
            HasRole.objects.filter(role__name__in=expanded_roles, role__is_active=True)
            .values_list("user_id", flat=True)
        )
        user_ids.update(
            UserRole.objects.filter(role__name__in=expanded_roles, role__is_active=True)
            .values_list("user_id", flat=True)
        )
        return list(User.objects.filter(id__in=user_ids, is_active=True))

    elif recipient_type == "users":
        usernames = setting.recipient_users or []
        if not usernames:
            return []
        return list(User.objects.filter(username__in=usernames, is_active=True))

    elif recipient_type == "owner":
        if triggered_by:
            return [triggered_by]
        return []

    return []


def _default_subject(event: str) -> str:
    """Generate a default subject line for an event."""
    labels = {
        "vital_signs_alert": "[CRITICAL VITAL SIGNS] Critical Vital Signs Alert",
        "patient_appointment_created": "[APPOINTMENT BOOKED] New Patient Appointment Scheduled",
        "patient_appointment_cancelled": "[APPOINTMENT CANCELLED] Patient Appointment Cancelled",
        "inpatient_admission": "[INPATIENT ADMISSION] Inpatient Bed Admission",
        "inpatient_discharge": "[INPATIENT DISCHARGE] Inpatient Discharge",
        "lab_test_ordered": "[LAB TEST ORDERED] Diagnostic Lab Test Ordered",
        "lab_test_approved": "[LAB TEST VERIFIED] Diagnostic Lab Test Result Verified",
        "prescription_created": "[PRESCRIPTION CREATED] New Drug Prescription (Rx) Created",
        "pharmacy_dispensed": "[PHARMACY DISPENSED] Medication Dispensed by Pharmacy",
        "low_stock_alert": "[LOW PHARMACY STOCK] Pharmacy Formulary Low Stock Warning",
        "medical_leave_created": "[MEDICAL LEAVE ISSUED] Medical Leave Certificate Issued",
        "workflow_approved": "Workflow Approved",
        "workflow_rejected": "Workflow Rejected",
        "workflow_action": "Clinical Workflow Review Required",
        "comment_added": "New Clinical Note / Comment",
        "communication_received": "New Intake Message Received",
        "document_shared": "Medical Record Shared",
        "system_error": "Emergency Clinical System Error",
        "user_created": "Medical Staff Account Created",
        "password_changed": "HIPAA Security / Password Changed",
        "scheduled_job_failure": "Clinical Scheduled Job Failure",
    }
    return labels.get(event, event.replace("_", " ").title())


def _default_message(event: str) -> str:
    """Generate a default message body for an event."""
    return _default_subject(event)


def _render_template(template: str, fallback: str, event: str) -> str:
    """
    Simple template rendering.
    In production, this would use Jinja2 like Frappe.
    For now, just return the template or fallback.
    """
    if template:
        return template
    return fallback


def _send_email(
    to_email: str,
    subject: str,
    message: str,
    html_message: str = "",
) -> bool:
    """
    Send an email using the default outgoing EmailAccount.
    Falls back to Django's DEFAULT_FROM_EMAIL if no account is configured.
    Returns True on success, False on failure.
    """
    from .core_models import EmailAccount

    account = EmailAccount.get_default_outgoing()

    if account:
        return account.send_email(
            subject=subject,
            message=message,
            recipient_list=[to_email],
            html_message=html_message or None,
        )

    # Fallback: use Django's built-in send_mail with DEFAULT_FROM_EMAIL
    from django.core.mail import send_mail
    from django.conf import settings

    try:
        send_mail(
            subject=subject,
            message=message,
            from_email=getattr(settings, "DEFAULT_FROM_EMAIL", "noreply@erp.local"),
            recipient_list=[to_email],
            fail_silently=False,
            html_message=html_message or None,
        )
        return True
    except Exception as e:
        logger.error(f"Failed to send email to {to_email}: {e}")
        return False


def _build_html_email(
    subject: str,
    message: str,
    event: str,
    reference_doctype: str = "",
    reference_name: str = "",
    triggered_by=None,
) -> str:
    """
    Build a styled HTML email body.
    Mirrors Frappe's email notification format.
    """
    from django.conf import settings
    from django.utils.html import escape

    app_name = getattr(settings, "SPECTACULAR_SETTINGS", {}).get("TITLE", "ERP System")
    event_label = event.replace("_", " ").title()
    actor = triggered_by.username if triggered_by else "System"

    ref_section = ""
    if reference_doctype:
        ref_section = f"""
        <tr>
            <td style="padding: 8px 0; color: #666; font-size: 13px;">Document:</td>
            <td style="padding: 8px 0; font-weight: 500;">
                {escape(reference_doctype)}{': ' + escape(reference_name) if reference_name else ''}
            </td>
        </tr>"""

    return f"""
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="margin: 0; padding: 0; background-color: #f4f6f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 24px 30px; border-radius: 12px 12px 0 0;">
                <h1 style="color: white; margin: 0; font-size: 20px; font-weight: 600;">{escape(app_name)}</h1>
                <p style="color: rgba(255,255,255,0.85); margin: 4px 0 0; font-size: 14px;">{escape(event_label)}</p>
            </div>

            <!-- Body -->
            <div style="background: white; padding: 30px; border: 1px solid #e8ecf1; border-top: none;">
                <h2 style="color: #1a1a2e; margin: 0 0 16px; font-size: 18px;">{escape(subject)}</h2>
                <div style="color: #4a4a6a; font-size: 14px; line-height: 1.6; margin-bottom: 20px;">
                    {message.replace(chr(10), '<br>') if message else ''}
                </div>

                <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                    <tr>
                        <td style="padding: 8px 0; color: #666; font-size: 13px;">Event:</td>
                        <td style="padding: 8px 0; font-weight: 500;">{escape(event_label)}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; color: #666; font-size: 13px;">Triggered by:</td>
                        <td style="padding: 8px 0; font-weight: 500;">{escape(actor)}</td>
                    </tr>
                    {ref_section}
                </table>

                <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                <p style="color: #999; font-size: 12px; margin: 0;">
                    This is an automated notification from {escape(app_name)}. Do not reply to this email.
                </p>
            </div>

            <!-- Footer -->
            <div style="text-align: center; padding: 16px; color: #999; font-size: 11px;">
                {escape(app_name)} Notification System
            </div>
        </div>
    </body>
    </html>
    """
