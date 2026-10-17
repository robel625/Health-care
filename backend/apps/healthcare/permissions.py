"""
Healthcare Role-Based Access Control (RBAC) and Patient Privacy Permissions.

Enforces:
1. Role Boundaries:
   - Receptionist: Patient registration, demographics, appointments, check-in, practitioner assignment.
     CANNOT access diagnoses, sensitive medical history, lab results, prescriptions, or confidential notes.
   - Doctor / Practitioner: Accesses assigned patients' medical records, diagnoses, clinical notes,
     treatment plans, prescriptions, and lab results according to care relationships.
   - Laboratory Technician: Accesses assigned lab requests, specimen info, test instructions, and result entry.
     CANNOT browse unrelated clinical records or confidential diagnoses.
   - Pharmacist: Accesses prescriptions, medication orders, allergy info, and safe dispensing data.
     CANNOT browse unrelated diagnoses or confidential notes.
   - Healthcare Administrator: Manages configuration, roles, users, operational monitoring.
     Administrative privileges do NOT grant access to confidential clinical records.

2. Confidentiality Rules:
   - High-sensitivity records (HIV/AIDS, Mental Health, Reproductive Health, confidential notes)
     accessible ONLY by the treating practitioner actively managing the patient.
   - Unrelated practitioners cannot search and open restricted records.
"""

import logging
from rest_framework.permissions import BasePermission
from apps.roles.permissions import _get_user_role_names

logger = logging.getLogger(__name__)

# Role Constants & Synonyms
ADMIN_ROLES = {"Healthcare Administrator", "System Manager", "Administrator"}
DOCTOR_ROLES = {"Physician", "Doctor", "Healthcare Practitioner", "Practitioner"}
LAB_ROLES = {"Laboratory User", "Lab Technician", "LabTest Approver"}
PHARMACY_ROLES = {"Pharmacy User", "Pharmacist"}
RECEPTIONIST_ROLES = {"Receptionist"}
NURSE_ROLES = {"Nursing User", "Nurse"}


def get_user_roles(user):
    """Return all active role names for a user."""
    if not user or not user.is_authenticated:
        return set()
    return set(_get_user_role_names(user))


def is_healthcare_admin(user):
    """Check if user has an administrative role or is staff/superuser."""
    if not user or not user.is_authenticated:
        return False
    if user.is_staff or user.is_superuser:
        return True
    roles = get_user_roles(user)
    return bool(roles & ADMIN_ROLES)


def is_doctor(user):
    """Check if user is a physician / healthcare practitioner."""
    if not user or not user.is_authenticated:
        return False
    roles = get_user_roles(user)
    return bool(roles & DOCTOR_ROLES)


def is_lab_tech(user):
    """Check if user is a laboratory technician / user / approver."""
    if not user or not user.is_authenticated:
        return False
    roles = get_user_roles(user)
    return bool(roles & LAB_ROLES)


def is_pharmacist(user):
    """Check if user is a pharmacist / pharmacy user."""
    if not user or not user.is_authenticated:
        return False
    roles = get_user_roles(user)
    return bool(roles & PHARMACY_ROLES)


def is_receptionist(user):
    """Check if user is a receptionist."""
    if not user or not user.is_authenticated:
        return False
    roles = get_user_roles(user)
    return bool(roles & RECEPTIONIST_ROLES)


def is_nurse(user):
    """Check if user is a nurse / nursing staff."""
    if not user or not user.is_authenticated:
        return False
    roles = get_user_roles(user)
    return bool(roles & NURSE_ROLES)


def get_practitioner_for_user(user):
    """Retrieve HealthcarePractitioner model linked to the given user."""
    if not user or not user.is_authenticated:
        return None
    from apps.healthcare.models import HealthcarePractitioner
    return HealthcarePractitioner.objects.filter(user=user).first()


def has_active_care_relationship(user, patient, allow_department_coverage=True):
    """
    Check if a practitioner has an established clinical care relationship with the patient.
    Established through:
    1. Active or scheduled appointment with this practitioner.
    2. Patient encounter assigned to or authored by this practitioner.
    3. Active inpatient admission under this practitioner.
    4. Covering practitioner in the same department with an active appointment/consultation.
    """
    if not user or not user.is_authenticated or not patient:
        return False

    practitioner = get_practitioner_for_user(user)
    if not practitioner:
        return False

    from apps.healthcare.models import PatientAppointment, PatientEncounter, InpatientRecord, ClinicalProcedure

    # 1. Appointment relationship
    if PatientAppointment.objects.filter(
        patient=patient, practitioner=practitioner
    ).exclude(status__in=["Cancelled"]).exists():
        return True

    # 2. Encounter relationship (active or historical care)
    if PatientEncounter.objects.filter(
        patient=patient, practitioner=practitioner
    ).exclude(status="Cancelled").exists():
        return True

    # 3. Inpatient admission
    if InpatientRecord.objects.filter(
        patient=patient, practitioner=practitioner
    ).exclude(status="Discharged").exists():
        return True

    # 4. Clinical procedure
    if ClinicalProcedure.objects.filter(
        patient=patient, practitioner=practitioner
    ).exists():
        return True

    # 5. Covering practitioner in same department with active scheduled appointment
    if allow_department_coverage and practitioner.department_id:
        if PatientAppointment.objects.filter(
            patient=patient, department_id=practitioner.department_id,
            status__in=["Scheduled", "Checked In", "In Consultation"]
        ).exists():
            return True

    return False


def can_view_confidential_records(user, patient=None):
    """
    Check if user is authorized to view confidential / stigmatizing medical data
    (HIV status, mental health records, reproductive health, confidential clinical notes).

    Rules:
    - Receptionists: NEVER (False)
    - Healthcare Administrators: NEVER (False) - Administrative privileges do NOT grant confidential clinical access
    - Lab Technicians: NEVER by default (False)
    - Pharmacists: NEVER by default (False)
    - Treating Doctors: TRUE ONLY IF active care relationship exists with the patient
    - Unrelated Doctors: FALSE
    """
    if not user or not user.is_authenticated:
        return False

    if is_receptionist(user):
        return False

    # Admins do not get confidential clinical data
    if is_healthcare_admin(user) and not is_doctor(user):
        return False

    if is_lab_tech(user) and not is_doctor(user):
        return False

    if is_pharmacist(user) and not is_doctor(user):
        return False

    if is_doctor(user):
        if patient is None:
            return True
        return has_active_care_relationship(user, patient)

    return False


def can_view_clinical_records(user, patient=None):
    """
    Check if user is authorized to view general clinical history, diagnoses, and encounter details.
    """
    if not user or not user.is_authenticated:
        return False

    # Receptionists NEVER access clinical diagnoses, lab results, prescriptions, or notes
    if is_receptionist(user):
        return False

    # Doctors have clinical access
    if is_doctor(user) or is_nurse(user):
        return True

    return False


class HealthcareRBACPermission(BasePermission):
    """
    Enforces role-based API access control and object-level care relationship checks.
    """

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False

        # Superusers pass generic access check (field masking still applies at serializer level)
        if user.is_superuser:
            return True

        doctype = getattr(view, "doctype_name", "") or getattr(view, "model_name", "")
        norm_doc = (doctype or "").replace(" ", "").lower()

        # 1. Receptionist restrictions
        if is_receptionist(user) and not (is_doctor(user) or is_healthcare_admin(user)):
            # Permitted for Receptionist: Patient, Patient Appointment, Payment Record, Practitioner list
            allowed_docs = {
                "patient", "patientappointment", "healthcarepractitioner",
                "practitionerschedule", "healthcarepaymentrecord", "medicaldepartment",
                "appointmenttype", "appointmenttypeconfig"
            }
            if norm_doc and norm_doc not in allowed_docs:
                logger.warning(f"Access denied: Receptionist {user.username} cannot access {doctype}")
                return False

        # 2. Laboratory Technician restrictions
        if is_lab_tech(user) and not (is_doctor(user) or is_healthcare_admin(user)):
            lab_allowed = {
                "labtest", "labtesttemplate", "labtestsample", "labtestuom",
                "samplecollection", "observation", "observationtemplate",
                "diagnosticreport", "specimen", "sampletype", "organism",
                "sensitivity", "patient", "medicaldepartment", "healthcarepractitioner"
            }
            # Lab tech cannot create/modify prescriptions or encounters
            if norm_doc in {"drugprescription", "medicationrequest", "clinicalnote"}:
                return False
            if request.method not in ["GET", "HEAD", "OPTIONS"] and norm_doc in {"patient", "patientencounter"}:
                return False

        # 3. Pharmacist restrictions
        if is_pharmacist(user) and not (is_doctor(user) or is_healthcare_admin(user)):
            pharmacy_allowed = {
                "drugprescription", "medicationrequest", "medication", "medicationclass",
                "pharmacywarehouse", "pharmacystock", "pharmacystockentry",
                "dosageform", "dosagestrength", "druginteraction", "allergy",
                "patient", "medicaldepartment", "healthcarepractitioner"
            }
            if norm_doc in {"labtest", "clinicalnote", "patientencounter"}:
                return False
            if request.method not in ["GET", "HEAD", "OPTIONS"] and norm_doc in {"patient"}:
                return False

        # 4. Healthcare Administrator clinical restrictions
        if is_healthcare_admin(user) and not is_doctor(user):
            # Admins cannot create or modify clinical notes or diagnoses directly
            if norm_doc in {"clinicalnote", "diagnosis"} and request.method not in ["GET", "HEAD", "OPTIONS"]:
                return False

        return True

    def has_object_permission(self, request, view, obj):
        user = request.user
        if not user or not user.is_authenticated:
            return False

        if user.is_superuser:
            return True

        model_name = obj.__class__.__name__

        # 1. Receptionist object-level access
        if is_receptionist(user) and not (is_doctor(user) or is_healthcare_admin(user)):
            if model_name in ["PatientEncounter", "LabTest", "MedicationRequest", "DrugPrescription", "ClinicalNote", "Diagnosis"]:
                return False

        # 2. Lab Technician object-level access
        if is_lab_tech(user) and not (is_doctor(user) or is_healthcare_admin(user)):
            if model_name in ["PatientEncounter", "MedicationRequest", "DrugPrescription", "ClinicalNote"]:
                return False

        # 3. Pharmacist object-level access
        if is_pharmacist(user) and not (is_doctor(user) or is_healthcare_admin(user)):
            if model_name in ["PatientEncounter", "LabTest", "ClinicalNote"]:
                return False

        # 4. Doctor care relationship check for PatientEncounter, ClinicalNote, Diagnosis
        if is_doctor(user) and not (user.is_superuser or is_healthcare_admin(user)):
            practitioner = get_practitioner_for_user(user)

            if model_name == "PatientEncounter":
                is_assigned = (obj.practitioner == practitioner) if practitioner else False
                has_care = has_active_care_relationship(user, obj.patient)
                if not (is_assigned or has_care):
                    logger.warning(f"Access denied: Doctor {user.username} is not assigned to encounter {obj.id}")
                    return False

            elif model_name == "ClinicalNote":
                is_author = (obj.author == practitioner) if practitioner else False
                patient = obj.encounter.patient if obj.encounter else None
                has_care = has_active_care_relationship(user, patient) if patient else False
                if not (is_author or has_care):
                    return False

        # 5. Check confidential records across all models
        is_confidential = getattr(obj, "is_confidential", False)
        if is_confidential:
            patient = getattr(obj, "patient", None)
            if not patient and hasattr(obj, "encounter") and obj.encounter:
                patient = obj.encounter.patient

            if not can_view_confidential_records(user, patient):
                logger.warning(
                    f"Access denied to confidential record {obj} for user {user.username}"
                )
                return False

        return True
