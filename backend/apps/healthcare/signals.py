"""
Healthcare Notification Signals — connects clinical events to the Notification Dispatcher.

Dispatches real-time clinical alerts when:
- Abnormal / panic vital signs telemetry is logged
- Patient appointments are scheduled or cancelled
- Doctor prescribes new medications (Rx)
- Lab tests are ordered or verified by a pathologist
- Inpatients are admitted or discharged
- Pharmacy fulfills dispensary requests
- Formulary drug stock falls below reorder buffer
- Medical sick leave slips are issued
"""

import logging
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.contrib.auth.models import User

from apps.roles.notification_dispatcher import dispatch_notification
from apps.healthcare.models import (
    VitalSigns,
    PatientAppointment,
    DrugPrescription,
    LabTest,
    InpatientRecord,
    MedicationRequest,
    PharmacyStock,
    MedicalLeaveSlip,
)

logger = logging.getLogger(__name__)


# ── 1. Vital Signs Telemetry Alert ───────────────────────────────

@receiver(post_save, sender=VitalSigns)
def on_vital_signs_saved(sender, instance, created, **kwargs):
    """
    Check if patient vital signs exceed critical thresholds.
    If so, immediately dispatch a high-acuity vital_signs_alert.
    """
    try:
        is_critical = False
        reasons = []

        bp_sys = instance.bp_systolic
        bp_dia = instance.bp_diastolic
        pulse = instance.pulse
        temp = instance.temperature
        rr = instance.respiratory_rate

        # Blood Pressure alert thresholds
        if bp_sys and (bp_sys >= 160 or bp_sys <= 85):
            is_critical = True
            reasons.append(f"BP {bp_sys}/{bp_dia or '?'}")
        elif bp_dia and (bp_dia >= 105 or bp_dia <= 50):
            is_critical = True
            reasons.append(f"BP {bp_sys or '?'}/{bp_dia}")

        # Cardiac Pulse thresholds
        if pulse and (pulse >= 125 or pulse <= 45):
            is_critical = True
            reasons.append(f"HR {pulse} bpm")

        # Pyrexia / Hypothermia thresholds
        if temp and (temp >= 39.0 or temp <= 35.0):
            is_critical = True
            reasons.append(f"Temp {temp}°C")

        # Respiratory distress thresholds
        if rr and (rr >= 28 or rr <= 10):
            is_critical = True
            reasons.append(f"RR {rr}/min")

        if is_critical:
            patient_name = instance.patient.patient_name if instance.patient else "Patient"
            reason_str = ", ".join(reasons)
            subject = f"[CRITICAL VITAL SIGNS] {patient_name} ({reason_str})"
            message = (
                f"Abnormal telemetry alert recorded for {patient_name}. "
                f"Readings: BP {bp_sys or 'N/A'}/{bp_dia or 'N/A'} mmHg, Pulse {pulse or 'N/A'} bpm, "
                f"Temp {temp or 'N/A'}°C, RR {rr or 'N/A'}/min. STAT clinician review required."
            )

            extra_recipients = []
            # If logged during an encounter or appointment with a practitioner, notify that doctor
            if instance.encounter and instance.encounter.practitioner and instance.encounter.practitioner.user:
                extra_recipients.append(instance.encounter.practitioner.user)
            elif instance.appointment and instance.appointment.practitioner and instance.appointment.practitioner.user:
                extra_recipients.append(instance.appointment.practitioner.user)

            dispatch_notification(
                event="vital_signs_alert",
                subject=subject,
                message=message,
                reference_doctype="Vital Signs",
                reference_name=str(instance.id),
                extra_recipients=extra_recipients,
            )
    except Exception as e:
        logger.warning(f"Error dispatching vital signs alert: {e}")


# ── 2. Patient Appointment Scheduling & Cancellation ─────────────

@receiver(post_save, sender=PatientAppointment)
def on_appointment_saved(sender, instance, created, **kwargs):
    try:
        patient_name = instance.patient_name or (instance.patient.patient_name if instance.patient else "Patient")
        practitioner_name = instance.practitioner_name or (instance.practitioner.practitioner_name if instance.practitioner else "Attending Clinician")

        extra_recipients = []
        if instance.practitioner and instance.practitioner.user:
            extra_recipients.append(instance.practitioner.user)
        if instance.patient and instance.patient.user:
            extra_recipients.append(instance.patient.user)

        if created:
            subject = f"[APPOINTMENT BOOKED] {patient_name} with {practitioner_name}"
            message = (
                f"New clinical appointment scheduled for {patient_name} on {instance.appointment_date} "
                f"at {instance.appointment_time or 'TBD'} in {instance.department or 'OPD'}."
            )
            dispatch_notification(
                event="patient_appointment_created",
                subject=subject,
                message=message,
                reference_doctype="Patient Appointment",
                reference_name=str(instance.id),
                extra_recipients=extra_recipients,
            )
        elif instance.status == "Cancelled":
            subject = f"[APPOINTMENT CANCELLED] {patient_name} ({practitioner_name})"
            message = (
                f"Appointment on {instance.appointment_date} at {instance.appointment_time or 'TBD'} "
                f"for {patient_name} has been cancelled."
            )
            dispatch_notification(
                event="patient_appointment_cancelled",
                subject=subject,
                message=message,
                reference_doctype="Patient Appointment",
                reference_name=str(instance.id),
                extra_recipients=extra_recipients,
            )
    except Exception as e:
        logger.warning(f"Error dispatching appointment notification: {e}")


# ── 3. Drug Prescription (Rx) Issued ─────────────────────────────

@receiver(post_save, sender=DrugPrescription)
def on_prescription_saved(sender, instance, created, **kwargs):
    try:
        if created:
            patient_name = instance.patient.patient_name if instance.patient else "Patient"
            med_name = instance.medication_name or "Medication"
            dosage = instance.dosage or "As directed"
            dr_name = instance.practitioner.practitioner_name if instance.practitioner else "Prescribing Physician"

            subject = f"[PRESCRIPTION CREATED] {med_name} for {patient_name}"
            message = (
                f"Physician {dr_name} prescribed {med_name} (Dosage: {dosage}) for {patient_name}. "
                f"Formulary routing to hospital dispensary active."
            )

            extra_recipients = []
            if instance.practitioner and instance.practitioner.user:
                extra_recipients.append(instance.practitioner.user)
            if instance.patient and instance.patient.user:
                extra_recipients.append(instance.patient.user)

            dispatch_notification(
                event="prescription_created",
                subject=subject,
                message=message,
                reference_doctype="Drug Prescription",
                reference_name=str(instance.id),
                extra_recipients=extra_recipients,
            )
    except Exception as e:
        logger.warning(f"Error dispatching prescription notification: {e}")


# ── 4. Diagnostic Lab Tests (Ordered & Result Verified) ─────────

@receiver(post_save, sender=LabTest)
def on_lab_test_saved(sender, instance, created, **kwargs):
    try:
        patient_name = instance.patient.patient_name if instance.patient else "Patient"
        test_name = instance.lab_test_name or "Diagnostic Panel"

        extra_recipients = []
        if instance.practitioner and instance.practitioner.user:
            extra_recipients.append(instance.practitioner.user)
        if instance.patient and instance.patient.user:
            extra_recipients.append(instance.patient.user)

        if created:
            subject = f"[LAB TEST ORDERED] {test_name} for {patient_name}"
            message = (
                f"Diagnostic requisition for {test_name} has been placed for {patient_name}. "
                f"Specimen collection and pathology analysis queued."
            )
            dispatch_notification(
                event="lab_test_ordered",
                subject=subject,
                message=message,
                reference_doctype="Lab Test",
                reference_name=str(instance.id),
                extra_recipients=extra_recipients,
            )
        elif instance.status in ["Approved", "Completed"]:
            subject = f"[LAB RESULT VERIFIED] {test_name} for {patient_name}"
            message = (
                f"Pathology laboratory findings for {test_name} ({patient_name}) have been verified "
                f"and released to electronic health chart."
            )
            dispatch_notification(
                event="lab_test_approved",
                subject=subject,
                message=message,
                reference_doctype="Lab Test",
                reference_name=str(instance.id),
                extra_recipients=extra_recipients,
            )
    except Exception as e:
        logger.warning(f"Error dispatching lab test notification: {e}")


# ── 5. Inpatient Care (Admission & Discharge) ────────────────────

@receiver(post_save, sender=InpatientRecord)
def on_inpatient_record_saved(sender, instance, created, **kwargs):
    try:
        patient_name = instance.patient.patient_name if instance.patient else "Patient"
        ward_name = instance.department.department if instance.department else "General Ward"

        extra_recipients = []
        if instance.practitioner and instance.practitioner.user:
            extra_recipients.append(instance.practitioner.user)

        if created or instance.status == "Admitted":
            subject = f"[INPATIENT ADMISSION] {patient_name} ({ward_name})"
            message = (
                f"Patient {patient_name} admitted to inpatient service under {ward_name} on "
                f"{instance.admission_date}. Nursing shift roster and bed occupancy updated."
            )
            dispatch_notification(
                event="inpatient_admission",
                subject=subject,
                message=message,
                reference_doctype="Inpatient Record",
                reference_name=str(instance.id),
                extra_recipients=extra_recipients,
            )
        elif instance.status == "Discharged" or instance.discharge_date:
            subject = f"[INPATIENT DISCHARGE] {patient_name} ({ward_name})"
            message = (
                f"Patient {patient_name} formal discharge cleared from {ward_name}. "
                f"Clinical discharge summary finalized."
            )
            dispatch_notification(
                event="inpatient_discharge",
                subject=subject,
                message=message,
                reference_doctype="Inpatient Record",
                reference_name=str(instance.id),
                extra_recipients=extra_recipients,
            )
    except Exception as e:
        logger.warning(f"Error dispatching inpatient notification: {e}")


# ── 6. Pharmacy Dispensary Medication Fulfilled ──────────────────

@receiver(post_save, sender=MedicationRequest)
def on_medication_request_saved(sender, instance, created, **kwargs):
    try:
        if instance.status == "Dispensed":
            patient_name = instance.patient.patient_name if instance.patient else "Patient"
            med_name = instance.medication_name or "Medication"

            subject = f"[PHARMACY DISPENSED] {med_name} to {patient_name}"
            message = (
                f"Medication {med_name} (Qty: {instance.quantity or 1}) has been dispensed by the "
                f"hospital pharmacy dispensary for {patient_name}."
            )

            extra_recipients = []
            if instance.practitioner and instance.practitioner.user:
                extra_recipients.append(instance.practitioner.user)
            if instance.patient and instance.patient.user:
                extra_recipients.append(instance.patient.user)

            dispatch_notification(
                event="pharmacy_dispensed",
                subject=subject,
                message=message,
                reference_doctype="Medication Request",
                reference_name=str(instance.id),
                extra_recipients=extra_recipients,
            )
    except Exception as e:
        logger.warning(f"Error dispatching pharmacy dispense notification: {e}")


# ── 7. Pharmacy Formulary Low Stock Alert ────────────────────────

@receiver(post_save, sender=PharmacyStock)
def on_pharmacy_stock_saved(sender, instance, created, **kwargs):
    try:
        reorder = instance.reorder_level or 10
        actual = instance.actual_qty or 0
        if actual <= reorder:
            item_name = instance.item_name or instance.item_code or "Pharmaceutical"
            subject = f"[LOW PHARMACY STOCK] {item_name} ({actual} units remaining)"
            message = (
                f"Formulary alert: Stock for {item_name} ({actual} units) has fallen at or below "
                f"the hospital buffer threshold ({reorder} units). Immediate reorder requisition recommended."
            )
            dispatch_notification(
                event="low_stock_alert",
                subject=subject,
                message=message,
                reference_doctype="Pharmacy Stock",
                reference_name=str(instance.id),
            )
    except Exception as e:
        logger.warning(f"Error dispatching low stock alert: {e}")


# ── 8. Medical Sick Leave Certificate Issued ─────────────────────

@receiver(post_save, sender=MedicalLeaveSlip)
def on_medical_leave_slip_saved(sender, instance, created, **kwargs):
    try:
        if created:
            patient_name = instance.patient.patient_name if instance.patient else "Patient"
            days = instance.total_days or 1
            subject = f"[MEDICAL LEAVE ISSUED] {patient_name} ({days} days)"
            message = (
                f"Attending physician issued an official clinical sick leave slip for {patient_name} "
                f"({days} days, effective {instance.from_date} to {instance.to_date})."
            )

            extra_recipients = []
            if instance.practitioner and instance.practitioner.user:
                extra_recipients.append(instance.practitioner.user)
            if instance.patient and instance.patient.user:
                extra_recipients.append(instance.patient.user)

            dispatch_notification(
                event="medical_leave_created",
                subject=subject,
                message=message,
                reference_doctype="Medical Leave Slip",
                reference_name=str(instance.id),
                extra_recipients=extra_recipients,
            )
    except Exception as e:
        logger.warning(f"Error dispatching medical leave notification: {e}")
