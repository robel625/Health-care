"""
Tests for the Lab Test stack rebuilt against Marley's `Lab Test` doctype.

Three things are covered: the reference data Marley's `healthcare/setup.py`
ships (migration 0025), the model's document hooks (`after_insert`,
`validate`, `before_save`), and the lifecycle actions that stand in for
docstatus on this stack (`submit`, `cancel`, `approve`, `reject`,
`create_multiple`).
"""

from datetime import date

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIRequestFactory, force_authenticate

from .models import (
    Antibiotic,
    HealthcarePractitioner,
    HealthcareSettings,
    LabPrescription,
    LabTest,
    LabTestTemplate,
    LabTestUOM,
    MedicalDepartment,
    NormalTestResult,
    Patient,
    PatientEncounter,
    Sensitivity,
    SensitivityTestResult,
    ServiceRequest,
)
from .serializers import LabTestSerializer
from .views import LabTestViewSet

# The 23 departments from Marley `healthcare/setup.py` →
# `create_medical_departments()`.
MARLEY_DEPARTMENTS = [
    "Accident And Emergency Care", "Anaesthetics", "Biochemistry", "Cardiology",
    "Diabetology", "Dermatology", "Diagnostic Imaging", "ENT",
    "Gastroenterology", "General Surgery", "Gynaecology", "Haematology",
    "Maternity", "Microbiology", "Nephrology", "Neurology", "Oncology",
    "Orthopaedics", "Pathology", "Physiotherapy", "Rheumatology", "Serology",
    "Urology",
]


class ReferenceDataTests(TestCase):
    """Migration 0025 seeds what Marley's setup.py ships."""

    def test_marley_departments_seeded(self):
        names = set(MedicalDepartment.objects.values_list("department", flat=True))
        missing = set(MARLEY_DEPARTMENTS) - names
        self.assertFalse(missing, f"missing departments: {sorted(missing)}")

    def test_lab_reference_data_seeded(self):
        """Migration 0029: Marley's UOMs, sensitivities and antibiotics."""
        uoms = set(LabTestUOM.objects.values_list("lab_test_uom", flat=True))
        # A sample of the 22, including Marley's own "ulU / ml" spelling.
        self.assertLessEqual(
            {"umol/L", "mg / dl", "/HPF", "ulU / ml", "ug / dl"} - uoms,
            set(),
        )
        levels = set(Sensitivity.objects.values_list("sensitivity", flat=True))
        self.assertLessEqual(
            {
                "Low Sensitivity", "High Sensitivity", "Moderate Sensitivity",
                "Susceptible", "Resistant", "Intermediate",
            }
            - levels,
            set(),
        )
        # The 166 antibiotics, first and last from Marley's list verbatim.
        self.assertGreaterEqual(Antibiotic.objects.count(), 166)
        self.assertTrue(
            Antibiotic.objects.filter(antibiotic_name="Amoxicillin").exists()
        )
        self.assertTrue(
            Antibiotic.objects.filter(antibiotic_name="Capreomycin").exists()
        )


class LabTestModelTests(TestCase):
    """Marley's `after_insert`, `validate` and `before_save` hooks."""

    def setUp(self):
        self.patient = Patient.objects.create(
            first_name="John", last_name="Doe", sex="Male", dob=date(1990, 1, 1)
        )
        self.practitioner = HealthcarePractitioner.objects.create(
            first_name="Ada", last_name="Lovelace"
        )
        self.template = LabTestTemplate.objects.create(
            lab_test_name="Complete Blood Count",
            lab_test_template_type="Single",
            lab_test_normal_range="4 - 6",
        )

    def make_test(self, **kwargs):
        defaults = dict(
            patient=self.patient,
            practitioner=self.practitioner,
            template=self.template,
            lab_test_name="Complete Blood Count",
            date=date.today(),
        )
        defaults.update(kwargs)
        return LabTest.objects.create(**defaults)

    def test_after_insert_loads_from_template(self):
        test = self.make_test()
        self.assertTrue(test.test_id.startswith("HLC-LAB-"))
        self.assertEqual(test.status, "Draft")
        self.assertEqual(test.lab_test_name, "Complete Blood Count")
        self.assertEqual(test.result_date, date.today())
        self.assertTrue(test.normal_toggle)
        row = test.normal_test_items.get()
        self.assertEqual(row.normal_range, "4 - 6")
        self.assertTrue(row.require_result_value)
        self.assertFalse(row.allow_blank)
        self.assertEqual(row.template, self.template)
        # The patient block is denormalised the way Marley's fetch_from does.
        self.assertEqual(test.patient_sex, "Male")
        self.assertTrue(test.patient_age)

    def test_validate_computes_secondary_uom_result(self):
        uom = LabTestUOM.objects.create(lab_test_uom="mg / dl")
        test = self.make_test()
        row = test.normal_test_items.get()
        row.result_value = "10"
        row.secondary_uom = uom
        row.conversion_factor = 2
        row.save()
        test.save()
        row.refresh_from_db()
        self.assertEqual(float(row.secondary_uom_result), 20.0)

    def test_before_save_sorts_sensitivity_rows(self):
        low = Sensitivity.objects.create(sensitivity="High Sensitivity")
        high = Sensitivity.objects.create(sensitivity="Resistant")
        abx = Antibiotic.objects.create(antibiotic_name="Penicillin")
        abx2 = Antibiotic.objects.create(antibiotic_name="Amoxicillin")
        test = self.make_test()
        SensitivityTestResult.objects.create(
            lab_test=test, antibiotic=abx, antibiotic_sensitivity=high
        )
        SensitivityTestResult.objects.create(
            lab_test=test, antibiotic=abx2, antibiotic_sensitivity=low
        )
        test.save()
        rows = list(test.sensitivity_test_items.order_by("idx"))
        self.assertEqual(
            [r.antibiotic_sensitivity.sensitivity for r in rows],
            ["High Sensitivity", "Resistant"],
        )
        self.assertEqual([r.idx for r in rows], [1, 2])

    def test_serializer_serves_nested_children_and_names(self):
        test = self.make_test()
        data = LabTestSerializer(test).data
        self.assertEqual(data["patient_name"], test.patient.patient_name)
        self.assertEqual(data["template_name"], "Complete Blood Count")
        self.assertEqual(len(data["normal_test_items"]), 1)
        self.assertIn("descriptive_test_items", data)
        self.assertIn("sensitivity_test_items", data)
        self.assertIn("organism_test_items", data)
        self.assertIn("codification_table", data)

    def test_sensitivity_row_matches_marley_fields(self):
        abx = Antibiotic.objects.create(antibiotic_name="Penicillin")
        sens = Sensitivity.objects.create(sensitivity="Resistant")
        test = self.make_test()
        row = SensitivityTestResult.objects.create(
            lab_test=test, antibiotic=abx, antibiotic_sensitivity=sens
        )
        data = LabTestSerializer(test).data
        self.assertEqual(data["sensitivity_test_items"][0]["antibiotic_name"], "Penicillin")
        self.assertEqual(data["sensitivity_test_items"][0]["sensitivity_name"], "Resistant")
        # Marley's child doctype has exactly these two links besides the parent.
        self.assertFalse(hasattr(row, "zone_of_inhibition"))


class LabTestLifecycleTests(TestCase):
    """The actions that stand in for Marley's docstatus lifecycle."""

    def setUp(self):
        self.factory = APIRequestFactory()
        self.user = get_user_model().objects.create_user(
            username="labadmin", is_staff=True
        )
        self.patient = Patient.objects.create(
            first_name="John", last_name="Doe", sex="Male", dob=date(1990, 1, 1)
        )
        self.practitioner = HealthcarePractitioner.objects.create(
            first_name="Ada", last_name="Lovelace"
        )
        self.template = LabTestTemplate.objects.create(
            lab_test_name="Lipid Profile",
            lab_test_template_type="Single",
            lab_test_normal_range="0 - 200",
        )
        self.service_request = ServiceRequest.objects.create(
            patient=self.patient, status="Active"
        )

    def call(self, action, pk=None, data=None, method="post"):
        path = f"/api/healthcare/lab-tests/{pk}/{action}/" if pk else f"/api/healthcare/lab-tests/{action}/"
        req = getattr(self.factory, method)(path, data or {}, format="json")
        force_authenticate(req, user=self.user)
        if pk:
            view = LabTestViewSet.as_view({method: action})
            return view(req, pk=str(pk))
        view = LabTestViewSet.as_view({method: action})
        return view(req)

    def make_test(self, **kwargs):
        defaults = dict(
            patient=self.patient,
            practitioner=self.practitioner,
            template=self.template,
            lab_test_name="Lipid Profile",
            date=date.today(),
        )
        defaults.update(kwargs)
        return LabTest.objects.create(**defaults)

    def test_submit_requires_result_values(self):
        test = self.make_test()
        resp = self.call("submit", pk=test.pk)
        self.assertEqual(resp.status_code, 400)
        self.assertIn("Please enter the result value", str(resp.data))

    def test_submit_marks_completed_and_completes_order(self):
        test = self.make_test(service_request=self.service_request)
        test.normal_test_items.update(result_value="150")
        resp = self.call("submit", pk=test.pk)
        self.assertEqual(resp.status_code, 200)
        test.refresh_from_db()
        self.service_request.refresh_from_db()
        self.assertEqual(test.status, "Completed")
        self.assertEqual(test.submitted_date, date.today())
        self.assertEqual(self.service_request.status, "Completed")

    def test_submit_only_from_draft(self):
        test = self.make_test(status="Completed")
        resp = self.call("submit", pk=test.pk)
        self.assertEqual(resp.status_code, 400)

    def test_cancel_only_from_submitted_and_reactivates_order(self):
        draft = self.make_test()
        resp = self.call("cancel", pk=draft.pk)
        self.assertEqual(resp.status_code, 400)

        submitted = self.make_test(service_request=self.service_request)
        submitted.normal_test_items.update(result_value="150")
        self.call("submit", pk=submitted.pk)
        resp = self.call("cancel", pk=submitted.pk)
        self.assertEqual(resp.status_code, 200)
        submitted.refresh_from_db()
        self.service_request.refresh_from_db()
        self.assertEqual(submitted.status, "Cancelled")
        self.assertEqual(self.service_request.status, "Active")

    def test_approve_and_reject_stamp_approved_date(self):
        test = self.make_test(status="Completed")
        resp = self.call("approve", pk=test.pk)
        self.assertEqual(resp.status_code, 200)
        test.refresh_from_db()
        self.assertEqual(test.status, "Approved")
        self.assertEqual(test.approved_date, date.today())

        other = self.make_test(status="Completed")
        resp = self.call("reject", pk=other.pk)
        self.assertEqual(resp.status_code, 200)
        other.refresh_from_db()
        self.assertEqual(other.status, "Rejected")
        self.assertEqual(other.approved_date, date.today())

    def test_create_multiple_from_encounter(self):
        encounter = PatientEncounter.objects.create(
            patient=self.patient,
            practitioner=self.practitioner,
            encounter_date=date.today(),
        )
        rx = LabPrescription.objects.create(
            encounter=encounter,
            patient=self.patient,
            lab_test_code=self.template,
            lab_test_name="Lipid Profile",
        )
        resp = self.call(
            "create_multiple",
            data={
                "patient": self.patient.pk,
                "doctype": "Patient Encounter",
                "docname": encounter.pk,
            },
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data["created"]), 1)
        rx.refresh_from_db()
        self.assertTrue(rx.lab_test_created)
        test = LabTest.objects.get(prescription=rx)
        self.assertEqual(test.template, self.template)
        self.assertEqual(test.encounter, encounter)

        # A second run creates nothing: the prescription is already taken.
        resp = self.call(
            "create_multiple",
            data={
                "patient": self.patient.pk,
                "doctype": "Patient Encounter",
                "docname": encounter.pk,
            },
        )
        self.assertEqual(resp.data["created"], [])

    def test_create_multiple_requires_source(self):
        resp = self.call("create_multiple", data={})
        self.assertEqual(resp.status_code, 400)

    def test_list_filters_by_encounter(self):
        """The encounter page's linked-Lab-Tests query must filter."""
        encounter = PatientEncounter.objects.create(
            patient=self.patient,
            practitioner=self.practitioner,
            encounter_date=date.today(),
        )
        mine = self.make_test(encounter=encounter)
        self.make_test()
        req = self.factory.get(
            "/api/healthcare/lab-tests/", {"encounter": encounter.pk}
        )
        force_authenticate(req, user=self.user)
        view = LabTestViewSet.as_view({"get": "list"})
        resp = view(req)
        ids = {r["id"] for r in resp.data["results"]}
        self.assertEqual(ids, {mine.pk})

    def test_list_filters_by_status_in(self):
        self.make_test(status="Completed")
        self.make_test(status="Draft")
        resp = self.call(
            "list",
            data={},
            method="get",
        )
        # The plain list still serves everything…
        self.assertEqual(resp.status_code, 200)
        # …and `status__in` narrows it the way the list page asks.
        req = self.factory.get(
            "/api/healthcare/lab-tests/",
            {"status__in": "Completed,Approved,Rejected,Cancelled"},
        )
        force_authenticate(req, user=self.user)
        view = LabTestViewSet.as_view({"get": "list"})
        resp = view(req)
        statuses = {r["status"] for r in resp.data["results"]}
        self.assertNotIn("Draft", statuses)
