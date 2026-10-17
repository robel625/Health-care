import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "erp.settings")
django.setup()

import unittest
from django.test import RequestFactory
from django.contrib.auth import get_user_model
from rest_framework.test import APIRequestFactory, force_authenticate
from rest_framework import status

from apps.roles.models import Role, UserRole, HasRole, DocType, DocPerm
from apps.healthcare.models import (
    Patient,
    HealthcarePractitioner,
    MedicalDepartment,
    PatientAppointment,
    PatientEncounter,
    Diagnosis,
    LabTest,
    MedicationRequest,
    Allergy,
)
from apps.healthcare.permissions import (
    is_healthcare_admin,
    is_doctor,
    is_receptionist,
    is_lab_tech,
    is_pharmacist,
    has_active_care_relationship,
    can_view_confidential_records,
)
from apps.healthcare.views import (
    PatientViewSet,
    PatientEncounterViewSet,
    DiagnosisViewSet,
    LabTestViewSet,
    MedicationRequestViewSet,
    PatientAppointmentViewSet,
)
from apps.healthcare.serializers import (
    PatientSerializer,
    PatientEncounterSerializer,
    DiagnosisSerializer,
)
from apps.roles.notification_dispatcher import sanitize_notification_text

User = get_user_model()


class HealthcareRBACTestCase(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.factory = APIRequestFactory()

        # Helper to get or create role
        def get_or_create_role(name):
            r, _ = Role.objects.get_or_create(name=name, defaults={"role_name": name, "is_active": True})
            return r

        cls.role_admin = get_or_create_role("Healthcare Administrator")
        cls.role_doctor = get_or_create_role("Physician")
        cls.role_receptionist = get_or_create_role("Receptionist")
        cls.role_lab_tech = get_or_create_role("Lab Technician")
        cls.role_pharmacist = get_or_create_role("Pharmacist")

        # Create distinct test users
        def create_user_with_role(username, role, is_staff=False):
            u, _ = User.objects.get_or_create(
                username=username,
                defaults={"email": f"{username}@test.hospital.com", "is_staff": is_staff}
            )
            u.is_staff = is_staff
            u.save()
            UserRole.objects.get_or_create(user=u, role=role)
            HasRole.objects.get_or_create(user=u, role=role)
            return u

        cls.user_admin = create_user_with_role("test_admin", cls.role_admin, is_staff=True)
        cls.user_doctor_assigned = create_user_with_role("test_doc_assigned", cls.role_doctor, is_staff=False)
        cls.user_doctor_unrelated = create_user_with_role("test_doc_unrelated", cls.role_doctor, is_staff=False)
        cls.user_receptionist = create_user_with_role("test_receptionist", cls.role_receptionist, is_staff=False)
        cls.user_lab_tech = create_user_with_role("test_lab_tech", cls.role_lab_tech, is_staff=False)
        cls.user_pharmacist = create_user_with_role("test_pharmacist", cls.role_pharmacist, is_staff=False)

        # Create department & practitioners
        cls.dept, _ = MedicalDepartment.objects.get_or_create(department="General Medicine")
        cls.practitioner_assigned, _ = HealthcarePractitioner.objects.get_or_create(
            user=cls.user_doctor_assigned,
            defaults={"practitioner_name": "Dr. Assigned", "department": cls.dept}
        )
        cls.practitioner_unrelated, _ = HealthcarePractitioner.objects.get_or_create(
            user=cls.user_doctor_unrelated,
            defaults={"practitioner_name": "Dr. Unrelated", "department": cls.dept}
        )

        # Create patients
        cls.patient_confidential, _ = Patient.objects.get_or_create(
            first_name="Jane",
            last_name="Confidential",
            defaults={
                "sex": "Female",
                "blood_group": "A+",
            }
        )
        cls.patient_confidential.medical_history = "Diagnosed with HIV/AIDS in 2021"
        cls.patient_confidential.allergies = "Severe Penicillin anaphylaxis"
        cls.patient_confidential.risk_factors = "Immunocompromised"
        cls.patient_confidential.save()

        cls.patient_standard, _ = Patient.objects.get_or_create(
            first_name="Bob",
            last_name="Standard",
            defaults={
                "sex": "Male",
                "blood_group": "O+",
                "medical_history": "Mild hypertension",
                "allergies": "None",
            }
        )

        # Establish care relationship for Dr. Assigned with patient_confidential via appointment
        cls.appointment, _ = PatientAppointment.objects.get_or_create(
            patient=cls.patient_confidential,
            practitioner=cls.practitioner_assigned,
            defaults={"appointment_date": "2026-10-18", "status": "Scheduled"}
        )

        # Create a confidential encounter for patient_confidential
        cls.encounter_confidential = PatientEncounter.objects.filter(
            patient=cls.patient_confidential, is_confidential=True
        ).first() or PatientEncounter.objects.create(
            patient=cls.patient_confidential,
            practitioner=cls.practitioner_assigned,
            encounter_date="2026-10-17",
            status="In Progress",
            encounter_comment="Patient consultation regarding HIV antiretroviral management",
            is_confidential=True,
        )

        # Create a non-confidential encounter for patient_standard
        cls.encounter_standard = PatientEncounter.objects.filter(
            patient=cls.patient_standard, is_confidential=False
        ).first() or PatientEncounter.objects.create(
            patient=cls.patient_standard,
            practitioner=cls.practitioner_assigned,
            encounter_date="2026-10-17",
            status="Completed",
            encounter_comment="Routine occupational checkup",
            is_confidential=False,
        )

        # Create confidential diagnosis
        cls.diag_confidential = Diagnosis.objects.filter(
            encounter=cls.encounter_confidential, is_confidential=True
        ).first() or Diagnosis.objects.create(
            encounter=cls.encounter_confidential,
            diagnosis="HIV Positive - Retroviral Syndrome",
            is_confidential=True,
        )

        # Create standard diagnosis
        cls.diag_standard = Diagnosis.objects.filter(
            encounter=cls.encounter_standard, is_confidential=False
        ).first() or Diagnosis.objects.create(
            encounter=cls.encounter_standard,
            diagnosis="Primary Essential Hypertension",
            is_confidential=False,
        )

        # Create Lab Test
        cls.lab_test = LabTest.objects.filter(
            patient=cls.patient_confidential
        ).first() or LabTest.objects.create(
            patient=cls.patient_confidential,
            practitioner=cls.practitioner_assigned,
            lab_test_name="Complete Blood Count (CBC)",
            status="Draft",
        )

        # Create Medication Request
        cls.med_req = MedicationRequest.objects.filter(
            patient=cls.patient_confidential
        ).first() or MedicationRequest.objects.create(
            patient=cls.patient_confidential,
            practitioner=cls.practitioner_assigned,
            medication_name="Amoxicillin 500mg",
            dosage="1 cap TID",
            quantity=21,
            status="Active",
        )

    # ─────────────────────────────────────────────────────────────
    # SECTION 1: ROLE DETERMINATION & BOUNDARIES
    # ─────────────────────────────────────────────────────────────
    def test_role_identification(self):
        """Verify role predicates match assigned user roles."""
        self.assertTrue(is_healthcare_admin(self.user_admin))
        self.assertFalse(is_doctor(self.user_admin))

        self.assertTrue(is_doctor(self.user_doctor_assigned))
        self.assertTrue(is_doctor(self.user_doctor_unrelated))

        self.assertTrue(is_receptionist(self.user_receptionist))
        self.assertFalse(is_doctor(self.user_receptionist))

        self.assertTrue(is_lab_tech(self.user_lab_tech))
        self.assertFalse(is_doctor(self.user_lab_tech))

        self.assertTrue(is_pharmacist(self.user_pharmacist))
        self.assertFalse(is_doctor(self.user_pharmacist))

    # ─────────────────────────────────────────────────────────────
    # SECTION 2: CARE RELATIONSHIPS & DOCTOR ACCESS CONTROL
    # ─────────────────────────────────────────────────────────────
    def test_care_relationship_authorization(self):
        """Assigned doctor has active care relationship; unrelated doctor does not."""
        has_rel_assigned = has_active_care_relationship(self.user_doctor_assigned, self.patient_confidential)
        has_rel_unrelated = has_active_care_relationship(self.user_doctor_unrelated, self.patient_confidential)

        self.assertTrue(has_rel_assigned, "Assigned doctor must have active care relationship")
        self.assertFalse(has_rel_unrelated, "Unrelated doctor must NOT have active care relationship")

    def test_doctor_encounter_queryset_isolation(self):
        """Unrelated doctor cannot retrieve encounters for patients they do not manage."""
        view = PatientEncounterViewSet()
        
        # Test assigned doctor
        request_assigned = self.factory.get("/api/healthcare/encounters/")
        request_assigned.user = self.user_doctor_assigned
        view.request = request_assigned
        qs_assigned = view.get_queryset()
        self.assertIn(self.encounter_confidential, qs_assigned)

        # Test unrelated doctor
        request_unrelated = self.factory.get("/api/healthcare/encounters/")
        request_unrelated.user = self.user_doctor_unrelated
        view.request = request_unrelated
        qs_unrelated = view.get_queryset()
        self.assertNotIn(self.encounter_confidential, qs_unrelated, "Unrelated doctor must NOT access encounter")

    def test_doctor_unrelated_encounter_detail_forbidden(self):
        """Direct URL access to an encounter by an unrelated doctor returns 403 Forbidden."""
        view = PatientEncounterViewSet.as_view({"get": "retrieve"})
        request = self.factory.get(f"/api/healthcare/encounters/{self.encounter_confidential.id}/")
        force_authenticate(request, user=self.user_doctor_unrelated)
        response = view(request, pk=self.encounter_confidential.id)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    # ─────────────────────────────────────────────────────────────
    # SECTION 3: RECEPTIONIST PRIVACY & REDACTION
    # ─────────────────────────────────────────────────────────────
    def test_receptionist_serializer_redaction(self):
        """Receptionist must not see sensitive clinical history, allergies, or risk factors."""
        request = self.factory.get(f"/api/healthcare/patients/{self.patient_confidential.id}/")
        request.user = self.user_receptionist
        serializer = PatientSerializer(self.patient_confidential, context={"request": request})
        data = serializer.data

        self.assertEqual(data["medical_history"], "")
        self.assertEqual(data["surgical_history"], "")
        self.assertEqual(data["allergies"], "")
        self.assertEqual(data["risk_factors"], "")
        self.assertFalse(data["access_scope"]["can_view_clinical"])

    def test_receptionist_blocked_from_clinical_encounters_and_diagnoses(self):
        """Receptionist querying encounters or diagnoses receives empty queryset."""
        request = self.factory.get("/api/healthcare/encounters/")
        request.user = self.user_receptionist
        
        enc_view = PatientEncounterViewSet()
        enc_view.request = request
        self.assertEqual(enc_view.get_queryset().count(), 0)

        diag_view = DiagnosisViewSet()
        diag_view.request = request
        self.assertEqual(diag_view.get_queryset().count(), 0)

    # ─────────────────────────────────────────────────────────────
    # SECTION 4: HEALTHCARE ADMINISTRATOR PRIVACY BOUNDARY
    # ─────────────────────────────────────────────────────────────
    def test_admin_blocked_from_confidential_encounters_and_diagnoses(self):
        """Healthcare admin privileges do NOT grant access to confidential encounters or diagnoses."""
        request = self.factory.get("/api/healthcare/encounters/")
        request.user = self.user_admin

        enc_view = PatientEncounterViewSet()
        enc_view.request = request
        admin_enc_qs = enc_view.get_queryset()
        
        # Non-confidential encounter is accessible
        self.assertIn(self.encounter_standard, admin_enc_qs)
        # Confidential encounter is EXCLUDED
        self.assertNotIn(self.encounter_confidential, admin_enc_qs)

        # Confidential diagnosis is masked
        diag_view = DiagnosisViewSet()
        diag_view.request = request
        admin_diag_qs = diag_view.get_queryset()
        self.assertNotIn(self.diag_confidential, admin_diag_qs)

    # ─────────────────────────────────────────────────────────────
    # SECTION 5: LABORATORY TECHNICIAN PERMISSIONS
    # ─────────────────────────────────────────────────────────────
    def test_lab_technician_submit_action(self):
        """Lab technician can submit test results; other roles receive 403 Forbidden."""
        view = LabTestViewSet.as_view({"post": "submit"})

        # 1. Lab Technician (Permitted)
        self.lab_test.status = "Draft"
        self.lab_test.save()
        req_lab = self.factory.post(f"/api/healthcare/lab-tests/{self.lab_test.id}/submit/")
        force_authenticate(req_lab, user=self.user_lab_tech)
        res_lab = view(req_lab, pk=self.lab_test.id)
        self.assertEqual(res_lab.status_code, status.HTTP_200_OK)

        # Reset status for next check
        self.lab_test.status = "Draft"
        self.lab_test.save()

        # 2. Receptionist (Forbidden)
        req_rec = self.factory.post(f"/api/healthcare/lab-tests/{self.lab_test.id}/submit/")
        force_authenticate(req_rec, user=self.user_receptionist)
        res_rec = view(req_rec, pk=self.lab_test.id)
        self.assertEqual(res_rec.status_code, status.HTTP_403_FORBIDDEN)

        # 3. Pharmacist (Forbidden)
        req_pharm = self.factory.post(f"/api/healthcare/lab-tests/{self.lab_test.id}/submit/")
        force_authenticate(req_pharm, user=self.user_pharmacist)
        res_pharm = view(req_pharm, pk=self.lab_test.id)
        self.assertEqual(res_pharm.status_code, status.HTTP_403_FORBIDDEN)

    # ─────────────────────────────────────────────────────────────
    # SECTION 6: PHARMACIST DISPENSING PERMISSIONS
    # ─────────────────────────────────────────────────────────────
    def test_pharmacist_dispense_action(self):
        """Pharmacist can dispense medication; other roles receive 403 Forbidden."""
        view = MedicationRequestViewSet.as_view({"post": "dispense"})

        # 1. Pharmacist (Permitted)
        req_pharm = self.factory.post(f"/api/healthcare/medication-requests/{self.med_req.id}/dispense/")
        force_authenticate(req_pharm, user=self.user_pharmacist)
        res_pharm = view(req_pharm, pk=self.med_req.id)
        self.assertEqual(res_pharm.status_code, status.HTTP_200_OK)

        # Reset status
        self.med_req.status = "Active"
        self.med_req.save()

        # 2. Receptionist (Forbidden)
        req_rec = self.factory.post(f"/api/healthcare/medication-requests/{self.med_req.id}/dispense/")
        force_authenticate(req_rec, user=self.user_receptionist)
        res_rec = view(req_rec, pk=self.med_req.id)
        self.assertEqual(res_rec.status_code, status.HTTP_403_FORBIDDEN)

        # 3. Lab Tech (Forbidden)
        req_lab = self.factory.post(f"/api/healthcare/medication-requests/{self.med_req.id}/dispense/")
        force_authenticate(req_lab, user=self.user_lab_tech)
        res_lab = view(req_lab, pk=self.med_req.id)
        self.assertEqual(res_lab.status_code, status.HTTP_403_FORBIDDEN)

    # ─────────────────────────────────────────────────────────────
    # SECTION 7: AUTO SENSITIVITY PROPAGATION & NOTIFICATION SANITIZATION
    # ─────────────────────────────────────────────────────────────
    def test_automatic_sensitivity_propagation(self):
        """Saving diagnosis with sensitive condition automatically propagates is_confidential = True."""
        enc = PatientEncounter.objects.create(
            patient=self.patient_standard,
            practitioner=self.practitioner_assigned,
            encounter_date="2026-10-17",
            status="In Progress",
            is_confidential=False,
        )
        self.assertFalse(enc.is_confidential)

        # Create diagnosis with HIV keyword
        diag = Diagnosis.objects.create(
            encounter=enc,
            diagnosis="Early asymptomatic HIV infection",
            is_confidential=False,
        )
        self.assertTrue(diag.is_confidential, "Sensitive keyword must set diagnosis is_confidential=True")
        
        # Check parent encounter was updated
        enc.refresh_from_db()
        self.assertTrue(enc.is_confidential, "Diagnosis confidentiality must propagate to parent encounter")

    def test_notification_sanitization(self):
        """Notification sanitization masks sensitive diagnoses and HIV status."""
        leaky_text = "New Lab Result: Patient tested positive for HIV/AIDS retrovirus."
        clean_text = sanitize_notification_text(leaky_text)
        self.assertNotIn("HIV", clean_text)
        self.assertNotIn("AIDS", clean_text)
        self.assertIn("[Confidential Condition]", clean_text)


if __name__ == "__main__":
    unittest.main()
