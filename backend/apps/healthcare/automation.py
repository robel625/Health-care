"""
Healthcare Automation Module
============================
Implements Marley-style automation triggers:
1. Encounter Submit → Auto-create Service Requests, Medication Requests, Therapy Plans
2. Patient Medical Record → Auto-log all patient activities
3. Fee Validity → Track free follow-up visits
4. Appointment → Encounter → Billing pipeline
"""

import logging
from datetime import timedelta
from decimal import Decimal
from django.utils import timezone
from django.contrib.auth import get_user_model

User = get_user_model()
logger = logging.getLogger(__name__)


def log_patient_medical_record(patient, subject, content, reference_doctype="", reference_name="", user=None):
    """Create a Patient Medical Record entry (Marley pattern)."""
    from .models import PatientMedicalRecord
    try:
        record = PatientMedicalRecord(
            patient=patient,
            subject=subject,
            content=content,
            reference_doctype=reference_doctype,
            reference_name=reference_name,
            user=user or _get_system_user(),
        )
        record.save()
        logger.info(f"Medical record created for patient {patient}: {subject}")
        return record
    except Exception as e:
        logger.error(f"Failed to create medical record: {e}")
        return None


def _get_system_user():
    """Get the system user for automated actions."""
    try:
        return User.objects.filter(is_superuser=True).first()
    except Exception:
        return None


# ════════════════════════════════════════════════════════════════════════════
# ENCOUNTER SUBMIT TRIGGERS
# ════════════════════════════════════════════════════════════════════════════

def on_encounter_submit(encounter):
    """
    Called when a Patient Encounter is submitted.
    Mirrors Marley's PatientEncounter.on_submit():
    1. Creates Service Requests for lab tests, observations, procedures, therapies
    2. Creates Medication Requests for drug prescriptions
    3. Creates Therapy Plan if therapies were prescribed
    4. Logs Patient Medical Record entry
    5. Closes the linked appointment (if any)
    6. Creates Fee Validity record
    """
    created_requests = {
        "service_requests": [],
        "medication_requests": [],
        "therapy_plans": [],
    }

    # 1. Create Service Requests from lab prescriptions
    _create_service_requests_from_labs(encounter, created_requests)

    # 2. Create Service Requests from procedure prescriptions
    _create_service_requests_from_procedures(encounter, created_requests)

    # 3. Create Medication Requests from drug prescriptions
    _create_medication_requests(encounter, created_requests)

    # 4. Therapy Plans disabled for EEU staff clinic (referrals used instead)
    # _create_therapy_plan(encounter, created_requests)

    # 5. Log patient medical record
    _log_encounter_medical_record(encounter)

    # 6. Close the linked appointment
    _close_linked_appointment(encounter)

    # 7. Fee Validity disabled (EEU clinic is 100% free of charge for employees)
    # _create_fee_validity(encounter)

    # 8. Dispatch Celery task for lab order notifications (realtime & in-app)
    if created_requests.get("service_requests"):
        try:
            from .tasks import task_notify_lab_order_created
            sr_ids = [sr.id for sr in created_requests["service_requests"]]
            task_notify_lab_order_created.delay(encounter.id, sr_ids)
        except Exception as e:
            logger.warning(f"Could not queue celery task for encounter {encounter.id}: {e}")
            try:
                from .tasks import task_notify_lab_order_created
                sr_ids = [sr.id for sr in created_requests["service_requests"]]
                task_notify_lab_order_created(encounter.id, sr_ids)
            except Exception as e2:
                logger.error(f"Fallback lab order notification failed: {e2}")

    return created_requests


def on_encounter_cancel(encounter):
    """
    Called when a Patient Encounter is cancelled.
    Mirrors Marley's PatientEncounter.on_cancel():
    1. Cancels all linked Service Requests
    2. Cancels all linked Medication Requests
    3. Re-opens the linked appointment
    """
    from .models import ServiceRequest, MedicationRequest, TherapyPlan

    # Cancel Service Requests
    service_requests = ServiceRequest.objects.filter(
        reference_doctype="PatientEncounter",
        reference_name=encounter.encounter_id,
    )
    for sr in service_requests:
        sr.status = "Cancelled"
        sr.save(update_fields=["status"])

    # Cancel Medication Requests
    med_requests = MedicationRequest.objects.filter(encounter=encounter)
    for mr in med_requests:
        mr.status = "Cancelled"
        mr.save(update_fields=["status"])

    # Cancel Therapy Plans
    therapy_plans = TherapyPlan.objects.filter(
        reference_doctype="PatientEncounter",
        reference_name=encounter.encounter_id,
    )
    for tp in therapy_plans:
        tp.status = "Cancelled"
        tp.save(update_fields=["status"])

    # Re-open the appointment
    if encounter.appointment:
        encounter.appointment.status = "Open"
        encounter.appointment.save(update_fields=["status"])

    # Log cancellation
    log_patient_medical_record(
        patient=encounter.patient,
        subject=f"Encounter Cancelled: {encounter.encounter_id}",
        content=f"Encounter {encounter.encounter_id} was cancelled by the practitioner.",
        reference_doctype="PatientEncounter",
        reference_name=encounter.encounter_id,
    )


# ── Service Request Creation ──────────────────────────────────────────

def _create_service_requests_from_labs(encounter, created_requests):
    """Create Service Requests for each lab prescription in the encounter."""
    from .models import ServiceRequest, ServiceRequestCategory

    lab_prescriptions = encounter.lab_prescriptions.all()
    for lab_rx in lab_prescriptions:
        if lab_rx.service_request_id:
            continue  # Already has a service request

        # Determine template
        template_name = lab_rx.lab_test_name or ""
        template_doctype = ""
        if lab_rx.lab_test_code:
            template_doctype = "Lab Test Template"
            template_name = lab_rx.lab_test_code.lab_test_name

        if not template_name:
            continue

        # Find or create the "Lab Test" category
        category, _ = ServiceRequestCategory.objects.get_or_create(
            category="Lab Test",
            defaults={"description": "Laboratory test orders"},
        )

        sr = ServiceRequest(
            title=f"Lab Test: {template_name}",
            patient=encounter.patient,
            practitioner=encounter.practitioner,
            department=encounter.department,
            category=category,
            status="Active",
            intent=lab_rx.intent or "Order",
            priority=lab_rx.priority or "Routine",
            notes=lab_rx.lab_test_comment or "",
            reference_doctype="PatientEncounter",
            reference_name=encounter.encounter_id,
        )
        sr.save()

        # Link back to the prescription
        lab_rx.service_request = sr
        lab_rx.save(update_fields=["service_request"])

        created_requests["service_requests"].append(sr)
        logger.info(f"Created Service Request {sr.request_id} for lab: {template_name}")


def _create_service_requests_from_procedures(encounter, created_requests):
    """Create Service Requests for each procedure prescription."""
    from .models import ServiceRequest, ServiceRequestCategory

    procedure_prescriptions = encounter.procedure_prescriptions.all()
    for proc_rx in procedure_prescriptions:
        if proc_rx.service_request_id:
            continue

        template_name = proc_rx.procedure_name or ""
        if proc_rx.procedure:
            template_name = proc_rx.procedure.procedure_name if hasattr(proc_rx.procedure, 'procedure_name') else str(proc_rx.procedure)

        if not template_name:
            continue

        category, _ = ServiceRequestCategory.objects.get_or_create(
            category="Procedure",
            defaults={"description": "Clinical procedure orders"},
        )

        sr = ServiceRequest(
            title=f"Procedure: {template_name}",
            patient=encounter.patient,
            practitioner=proc_rx.practitioner or encounter.practitioner,
            department=proc_rx.department or encounter.department,
            category=category,
            status="Active",
            intent=proc_rx.intent or "Order",
            priority=proc_rx.priority or "Routine",
            notes=proc_rx.comments or "",
            reference_doctype="PatientEncounter",
            reference_name=encounter.encounter_id,
        )
        sr.save()

        proc_rx.service_request = sr
        proc_rx.save(update_fields=["service_request"])

        created_requests["service_requests"].append(sr)
        logger.info(f"Created Service Request {sr.request_id} for procedure: {template_name}")


# ── Medication Request Creation ───────────────────────────────────────

def _create_medication_requests(encounter, created_requests):
    """Create Medication Requests for each drug prescription."""
    from .models import MedicationRequest

    drug_prescriptions = encounter.drug_prescriptions.all()
    for drug_rx in drug_prescriptions:
        if not drug_rx.medication_name:
            continue

        existing = MedicationRequest.objects.filter(
            encounter=encounter,
            medication_name=drug_rx.medication_name,
        ).first()
        if existing:
            created_requests["medication_requests"].append(existing)
            continue

        # Calculate dosage instruction
        dosage_instruction = f"{drug_rx.dosage or ''} {drug_rx.dosage_form or ''}".strip()
        if drug_rx.period:
            dosage_instruction += f" for {drug_rx.period}"
        if drug_rx.interval:
            dosage_instruction += f", every {drug_rx.interval}"

        qty = drug_rx.quantity or Decimal("1")

        mr = MedicationRequest(
            patient=encounter.patient,
            practitioner=encounter.practitioner,
            encounter=encounter,
            medication_name=drug_rx.medication_name,
            dosage_instruction=dosage_instruction,
            status="Active",
            intent=drug_rx.intent or "Order",
            priority=drug_rx.priority or "Routine",
            quantity=qty,
            refill_count=drug_rx.refills or 0,
            notes=drug_rx.comment or "",
        )
        mr.save()

        created_requests["medication_requests"].append(mr)
        logger.info(f"Created Medication Request {mr.request_id} for: {drug_rx.medication_name}")


# ── Therapy Plan Creation ─────────────────────────────────────────────

def _create_therapy_plan(encounter, created_requests):
    """Disabled for EEU clinic - patients requiring therapy/rehab are referred out."""
    return
    from .models import TherapyPlan, TherapySession, TherapyPlanDetail

    therapy_details = list(
        TherapyPlanDetail.objects.filter(
            encounter=encounter, plan__isnull=True
        ).select_related("therapy_type")
    )
    if not therapy_details:
        return

    total_sessions = sum(d.no_of_sessions or 1 for d in therapy_details)
    plan = TherapyPlan.objects.create(
        patient=encounter.patient,
        practitioner=encounter.practitioner,
        therapy_type=therapy_details[0].therapy_type,
        title=f"Therapy Plan - {encounter.patient}",
        status="Active",
        start_date=encounter.encounter_date,
        total_sessions=total_sessions,
        reference_doctype="PatientEncounter",
        reference_name=encounter.encounter_id,
    )

    # Schedule one session per prescribed session, in sequence from the
    # encounter date, and attach each detail to the plan it produced.
    session_date = encounter.encounter_date
    session_number = 0
    for detail in therapy_details:
        detail.plan = plan
        detail.save(update_fields=["plan"])
        for _ in range(detail.no_of_sessions or 1):
            session_number += 1
            TherapySession.objects.create(
                plan=plan,
                patient=encounter.patient,
                practitioner=encounter.practitioner,
                therapy_type=detail.therapy_type,
                session_date=session_date,
                status="Scheduled",
                notes=detail.description or "",
            )
            session_date = session_date + timedelta(days=7)

    created_requests["therapy_plans"].append(plan)
    logger.info(f"Created Therapy Plan {plan.plan_id} for encounter {encounter.encounter_id}")


# ── Medical Record Logging ────────────────────────────────────────────

def _log_encounter_medical_record(encounter):
    """Log the encounter submission as a medical record entry."""
    diagnoses = ", ".join(
        d.diagnosis for d in encounter.diagnoses.all()[:5]
    ) or "No diagnosis recorded"

    symptoms = ", ".join(
        s.symptom for s in encounter.symptoms_list.all()[:5]
    ) or "No symptoms recorded"

    lab_count = encounter.lab_prescriptions.count()
    drug_count = encounter.drug_prescriptions.count()
    proc_count = encounter.procedure_prescriptions.count()

    content = f"""
Patient: {encounter.patient}
Practitioner: {encounter.practitioner or 'N/A'}
Date: {encounter.encounter_date}

Diagnoses: {diagnoses}
Symptoms: {symptoms}

Orders:
- {lab_count} Lab Test(s) prescribed
- {drug_count} Drug(s) prescribed
- {proc_count} Procedure(s) prescribed

Notes: {encounter.clinical_notes or encounter.notes or 'None'}
"""

    log_patient_medical_record(
        patient=encounter.patient,
        subject=f"Consultation with {encounter.practitioner or 'Doctor'} on {encounter.encounter_date}",
        content=content.strip(),
        reference_doctype="PatientEncounter",
        reference_name=encounter.encounter_id,
    )


# ── Appointment Closure ───────────────────────────────────────────────

def _close_linked_appointment(encounter):
    """Close the linked appointment when encounter is submitted (Marley pattern)."""
    if encounter.appointment:
        encounter.appointment.status = "Closed"
        encounter.appointment.save(update_fields=["status"])
        logger.info(f"Closed appointment {encounter.appointment.appointment_id}")


# ── Fee Validity ──────────────────────────────────────────────────────

def _create_fee_validity(encounter):
    """Disabled for EEU clinic - all consultations and medications are 100% free for staff."""
    return
    from .models import FeeValidity, HealthcareSettings

    if not encounter.practitioner:
        return

    # Get validity duration from settings (default: 7 days, max 1 visit)
    try:
        settings = HealthcareSettings.objects.first()
        validity_days = getattr(settings, 'follow_up_validity_days', 7) if settings else 7
    except Exception:
        validity_days = 7

    from datetime import timedelta
    valid_from = encounter.encounter_date
    valid_till = valid_from + timedelta(days=validity_days)

    fv = FeeValidity(
        practitioner=encounter.practitioner,
        patient=encounter.patient,
        valid_from=valid_from,
        valid_till=valid_till,
        visit_count=0,
        max_visits=1,
    )
    fv.save()
    logger.info(f"Created Fee Validity for patient {encounter.patient}, valid till {valid_till}")


# ════════════════════════════════════════════════════════════════════════════
# APPOINTMENT WORKFLOW TRIGGERS
# ════════════════════════════════════════════════════════════════════════════

def on_appointment_checkin(appointment):
    """
    Called when a patient checks in for their appointment.
    Creates a Vital Signs record placeholder and logs the check-in.
    """
    appt_type = getattr(appointment.appointment_type, "appointment_type", "") if appointment.appointment_type else "consultation"
    log_patient_medical_record(
        patient=appointment.patient,
        subject=f"Checked in for appointment: {appointment.appointment_id}",
        content=f"Patient checked in for {appt_type} with {appointment.practitioner_name or 'practitioner'} at {appointment.appointment_time or 'N/A'}.",
        reference_doctype="PatientAppointment",
        reference_name=appointment.appointment_id,
    )


def on_appointment_checkout(appointment):
    """Called when a patient checks out."""
    log_patient_medical_record(
        patient=appointment.patient,
        subject=f"Checked out from appointment: {appointment.appointment_id}",
        content=f"Patient checked out from appointment with {appointment.practitioner_name or 'practitioner'}.",
        reference_doctype="PatientAppointment",
        reference_name=appointment.appointment_id,
    )


def on_appointment_cancel(appointment):
    """Called when an appointment is cancelled."""
    log_patient_medical_record(
        patient=appointment.patient,
        subject=f"Appointment Cancelled: {appointment.appointment_id}",
        content=f"Appointment with {appointment.practitioner_name or 'practitioner'} on {appointment.appointment_date} was cancelled.",
        reference_doctype="PatientAppointment",
        reference_name=appointment.appointment_id,
    )


# ════════════════════════════════════════════════════════════════════════════
# VITAL SIGNS TRIGGERS
# ════════════════════════════════════════════════════════════════════════════

def on_vital_signs_create(vital_signs):
    """Log vital signs recording as a medical record entry."""
    readings = []
    if vital_signs.temperature:
        readings.append(f"Temp: {vital_signs.temperature}°C")
    if vital_signs.pulse:
        readings.append(f"Pulse: {vital_signs.pulse} bpm")
    if vital_signs.bp_systolic and vital_signs.bp_diastolic:
        readings.append(f"BP: {vital_signs.bp_systolic}/{vital_signs.bp_diastolic} mmHg")
    if vital_signs.respiratory_rate:
        readings.append(f"RR: {vital_signs.respiratory_rate}/min")
    if vital_signs.height:
        readings.append(f"Height: {vital_signs.height} cm")
    if vital_signs.weight:
        readings.append(f"Weight: {vital_signs.weight} kg")

    content = f"Vital Signs recorded on {vital_signs.signs_date}:\n" + "\n".join(readings) if readings else "Vital signs recorded."

    log_patient_medical_record(
        patient=vital_signs.patient,
        subject=f"Vital Signs recorded on {vital_signs.signs_date}",
        content=content,
        reference_doctype="VitalSigns",
        reference_name=vital_signs.title or f"VS-{vital_signs.id}",
    )


# ════════════════════════════════════════════════════════════════════════════
# LAB TEST TRIGGERS
# ════════════════════════════════════════════════════════════════════════════

def on_lab_test_approve(lab_test):
    """Log lab test approval as a medical record entry and dispatch Celery notifications."""
    log_patient_medical_record(
        patient=lab_test.patient,
        subject=f"Lab Test Approved: {lab_test.lab_test_name}",
        content=f"Lab test '{lab_test.lab_test_name}' was approved.\nResult: {lab_test.result or 'Pending'}",
        reference_doctype="LabTest",
        reference_name=lab_test.test_id or f"LT-{lab_test.id}",
    )
    # Queue Celery task for doctor/patient notifications, email, and realtime broadcast
    try:
        from .tasks import task_notify_lab_result_approved
        task_notify_lab_result_approved.delay(lab_test.id)
    except Exception as e:
        logger.warning(f"Could not queue celery task for lab test {lab_test.id}: {e}")
        try:
            from .tasks import task_notify_lab_result_approved
            task_notify_lab_result_approved(lab_test.id)
        except Exception as e2:
            logger.error(f"Fallback lab result notification failed: {e2}")


# ════════════════════════════════════════════════════════════════════════════
# PATIENT REGISTRATION TRIGGERS
# ════════════════════════════════════════════════════════════════════════════

def on_patient_create(patient):
    """Log patient registration."""
    log_patient_medical_record(
        patient=patient,
        subject="Patient Registered",
        content=f"New patient registered: {patient.patient_name}\nDOB: {patient.dob or 'N/A'}\nGender: {patient.sex or 'N/A'}\nMobile: {patient.mobile or 'N/A'}",
        reference_doctype="Patient",
        reference_name=patient.patient_id,
    )


# ════════════════════════════════════════════════════════════════════════════
# ENCOUNTER SAVE TRIGGERS (Marley pattern: on_update)
# ════════════════════════════════════════════════════════════════════════════

def on_encounter_update(encounter):
    """
    Called on every encounter save.
    In Marley, this closes the linked appointment on first save after creation.
    """
    if encounter.appointment and encounter.status in ("Submitted", "Completed"):
        appointment = encounter.appointment
        if appointment.status != "Closed":
            appointment.status = "Closed"
            appointment.save(update_fields=["status"])
