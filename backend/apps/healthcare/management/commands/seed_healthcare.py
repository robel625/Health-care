"""
Seed healthcare module test data.
Run: python manage.py seed_healthcare
"""
from datetime import date, time, timedelta
from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from django.utils import timezone
from apps.healthcare.models import (
    MedicalDepartment, HealthcareServiceUnitType, HealthcareServiceUnit,
    Patient, HealthcarePractitioner, PractitionerSchedule,
    PatientAppointment, VitalSigns, PatientEncounter, Diagnosis, Symptom,
    DrugPrescription, LabTestTemplate, LabTest, LabTestSample,
    ClinicalProcedureTemplate, ClinicalProcedure,
    TherapyType, TherapyPlan, TherapySession, Exercise,
    InsurancePayor, InsurancePayorContract, PatientInsurancePolicy, InsuranceClaim,
    InpatientRecord, InpatientMedicationEntry, InpatientOccupancy,
    Observation, ClinicalNote, HealthcareSettings,
    DosageForm, BodyPart, SampleType, Complaint, TriageLevel,
    MedicationClass, Medication, HealthcareActivity,
    Allergy, PatientRelation, NursingTask, EmergencyRecord,
    ServiceRequestCategory, ServiceRequest,
    AppointmentTypeConfig,
)


class Command(BaseCommand):
    help = "Seed comprehensive healthcare test data"

    def handle(self, *args, **kwargs):
        self.stdout.write("Seeding healthcare data...")
        now = timezone.now()
        today = now.date()

        # ── Departments ─────────────────────────────────────────────
        depts = {}
        for name in ["Cardiology", "Neurology", "Orthopedics", "Pediatrics",
                      "Dermatology", "Ophthalmology", "General Medicine",
                      "Emergency", "Radiology", "Pathology", "Physiotherapy",
                      "Psychiatry", "Urology", "ENT", "Oncology"]:
            d, _ = MedicalDepartment.objects.get_or_create(department=name)
            depts[name] = d
        self.stdout.write(f"  {len(depts)} departments")

        # ── Service Unit Types ──────────────────────────────────────
        sutypes = {}
        for name in ["Consultation Room", "Operation Theatre", "ICU",
                      "General Ward", "Private Room", "Emergency Bay",
                      "Laboratory", "Physiotherapy Room"]:
            s, _ = HealthcareServiceUnitType.objects.get_or_create(service_unit_type=name)
            sutypes[name] = s
        self.stdout.write(f"  {len(sutypes)} service unit types")

        # ── Service Units ───────────────────────────────────────────
        sus = {}
        units = [
            ("Consultation Room 1", "Consultation Room", "General Medicine"),
            ("Consultation Room 2", "Consultation Room", "Cardiology"),
            ("OT-1", "Operation Theatre", "Orthopedics"),
            ("ICU-1", "ICU", "General Medicine"),
            ("ICU-2", "ICU", "Cardiology"),
            ("Ward A - Bed 1", "General Ward", "General Medicine"),
            ("Ward A - Bed 2", "General Ward", "General Medicine"),
            ("Ward B - Bed 1", "General Ward", "Pediatrics"),
            ("Private Room 101", "Private Room", "Cardiology"),
            ("Emergency Bay 1", "Emergency Bay", "Emergency"),
            ("Lab-1", "Laboratory", "Pathology"),
            ("Physio Room 1", "Physiotherapy Room", "Physiotherapy"),
        ]
        for uname, utype, dept in units:
            su, _ = HealthcareServiceUnit.objects.get_or_create(
                service_unit_name=uname,
                defaults={
                    "service_unit_type": sutypes[utype],
                    "department": depts[dept],
                    "is_active": True,
                },
            )
            sus[uname] = su
        self.stdout.write(f"  {len(sus)} service units")

        # ── Patients ────────────────────────────────────────────────
        patients = []
        patient_data = [
            ("James", "", "Anderson", "Male", "O+", date(1985, 3, 15), "555-0101", "james@email.com"),
            ("Sarah", "Marie", "Johnson", "Female", "A+", date(1990, 7, 22), "555-0102", "sarah@email.com"),
            ("Michael", "", "Williams", "Male", "B+", date(1978, 11, 8), "555-0103", "michael@email.com"),
            ("Emily", "Rose", "Brown", "Female", "AB+", date(2005, 1, 30), "555-0104", "emily@email.com"),
            ("David", "", "Jones", "Male", "A-", date(1962, 9, 12), "555-0105", "david@email.com"),
            ("Lisa", "Ann", "Davis", "Female", "O-", date(1995, 4, 18), "555-0106", "lisa@email.com"),
            ("Robert", "", "Miller", "Male", "B-", date(1988, 6, 25), "555-0107", "robert@email.com"),
            ("Jennifer", "", "Wilson", "Female", "A+", date(2000, 12, 3), "555-0108", "jennifer@email.com"),
            ("William", "Thomas", "Moore", "Male", "O+", date(1955, 2, 14), "555-0109", "william@email.com"),
            ("Amanda", "", "Taylor", "Female", "AB-", date(1992, 8, 7), "555-0110", "amanda@email.com"),
            ("Christopher", "", "Lee", "Male", "B+", date(1980, 5, 20), "555-0111", "chris@email.com"),
            ("Jessica", "Marie", "Clark", "Female", "A+", date(1998, 10, 15), "555-0112", "jessica@email.com"),
        ]
        for fn, mn, ln, sex, bg, dob, mobile, email in patient_data:
            p, _ = Patient.objects.get_or_create(
                first_name=fn, last_name=ln,
                defaults={
                    "middle_name": mn, "sex": sex, "blood_group": bg,
                    "dob": dob, "age": (today.year - dob.year),
                    "mobile": mobile, "email": email,
                    "status": "Active",
                    "allergies": "Penicillin" if ln == "Anderson" else "",
                    "medical_history": "Hypertension" if ln == "Miller" else "",
                    "occupation": "Engineer" if ln == "Anderson" else "Teacher",
                },
            )
            patients.append(p)
        self.stdout.write(f"  {len(patients)} patients")

        # ── Practitioners ───────────────────────────────────────────
        practitioners = []
        prac_data = [
            ("Richard", "", "Smith", "Male", "Cardiology", "Senior Cardiologist", 250),
            ("Patricia", "", "Brown", "Female", "Neurology", "Neurologist", 220),
            ("Thomas", "James", "White", "Male", "Orthopedics", "Orthopedic Surgeon", 300),
            ("Maria", "", "Garcia", "Female", "Pediatrics", "Pediatrician", 180),
            ("John", "", "Davis", "Male", "General Medicine", "General Practitioner", 150),
            ("Helen", "Grace", "Miller", "Female", "Dermatology", "Dermatologist", 200),
            ("James", "Patrick", "Wilson", "Male", "Emergency", "Emergency Physician", 230),
            ("Susan", "", "Anderson", "Female", "Physiotherapy", "Physiotherapist", 160),
            ("Daniel", "", "Taylor", "Male", "Psychiatry", "Psychiatrist", 240),
            ("Karen", "", "Thomas", "Female", "Ophthalmology", "Ophthalmologist", 210),
        ]
        for fn, mn, ln, sex, dept, desig, charge in prac_data:
            pr, _ = HealthcarePractitioner.objects.get_or_create(
                first_name=fn, last_name=ln,
                defaults={
                    "middle_name": mn, "gender": sex,
                    "department": depts.get(dept),
                    "designation": desig,
                    "op_consulting_charge": charge,
                    "status": "Active",
                    "practitioner_type": "Internal",
                },
            )
            practitioners.append(pr)

            # Add schedules
            for day in ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]:
                PractitionerSchedule.objects.get_or_create(
                    practitioner=pr, day=day,
                    defaults={
                        "start_time": time(9, 0),
                        "end_time": time(17, 0),
                        "max_appointments": 20,
                        "is_active": True,
                    },
                )
        self.stdout.write(f"  {len(practitioners)} practitioners with schedules")

        # ── Lab Test Templates ──────────────────────────────────────
        lab_templates = []
        for name, group in [("Complete Blood Count", "Hematology"),
                            ("Lipid Profile", "Biochemistry"),
                            ("Thyroid Profile", "Endocrinology"),
                            ("Liver Function Test", "Biochemistry"),
                            ("Kidney Function Test", "Biochemistry"),
                            ("Urinalysis", "Clinical Pathology"),
                            ("Blood Glucose", "Biochemistry"),
                            ("HbA1c", "Endocrinology"),
                            ("ECG", "Cardiology"),
                            ("Chest X-Ray", "Radiology")]:
            # Marley's `lab_test_group` is a Link to Item Group, so the demo
            # group names are materialised as groups the way migration 0022
            # does it for templates that already have one.
            lt, _ = LabTestTemplate.objects.get_or_create(
                lab_test_name=name, defaults={"lab_test_group": group}
            )
            lab_templates.append(lt)
        self.stdout.write(f"  {len(lab_templates)} lab test templates")

        # ── Lab Test Samples ────────────────────────────────────────
        for name in ["Blood", "Urine", "Stool", "Sputum", "CSF"]:
            LabTestSample.objects.get_or_create(sample=name)
        self.stdout.write("  5 lab test samples")

        # ── Clinical Procedure Templates ────────────────────────────
        for name in ["Appendectomy", "Colonoscopy", "Cataract Surgery",
                      "Knee Arthroscopy", "Biopsy", "ECG Recording"]:
            ClinicalProcedureTemplate.objects.get_or_create(
                template_name=name, description=f"Standard {name} procedure"
            )
        self.stdout.write("  6 clinical procedure templates")

        # ── Appointments ────────────────────────────────────────────
        appointments = []
        apt_status = ["Scheduled", "Closed", "Cancelled", "Open"]
        apt_types = list(AppointmentTypeConfig.objects.all())
        if not apt_types:
            apt_types_names = ["Consultation", "Follow Up", "Procedure", "Lab Test"]
            apt_types = []
            for name in apt_types_names:
                obj, _ = AppointmentTypeConfig.objects.get_or_create(
                    appointment_type=name,
                    defaults={"allow_booking_for": "Practitioner", "default_duration": 30},
                )
                apt_types.append(obj)
        for i, patient in enumerate(patients[:8]):
            pr = practitioners[i % len(practitioners)]
            apt, _ = PatientAppointment.objects.get_or_create(
                patient=patient,
                practitioner=pr,
                appointment_date=today - timedelta(days=i),
                defaults={
                    "status": apt_status[i % len(apt_status)],
                    "appointment_type": apt_types[i % len(apt_types)],
                    "department": pr.department,
                    "duration": 30,
                    "notes": f"Regular checkup for {patient.patient_name}",
                },
            )
            appointments.append(apt)
        self.stdout.write(f"  {len(appointments)} appointments")

        # ── Vital Signs ─────────────────────────────────────────────
        vs_count = 0
        for patient in patients[:8]:
            for days_ago in range(3):
                VitalSigns.objects.get_or_create(
                    patient=patient,
                    signs_date=today - timedelta(days=days_ago),
                    defaults={
                        "temperature": 98.6,
                        "pulse": 72,
                        "respiratory_rate": 16,
                        "bp_systolic": 120,
                        "bp_diastolic": 80,
                        "bp": "120/80 mmHg",
                        "height": 170,
                        "weight": 70,
                        "bmi": 24.2,
                        "nutrition_note": "Normal",
                        "vital_signs_note": "Normal vitals",
                        "title": f"{patient.patient_name} - {today - timedelta(days=days_ago)}",
                    },
                )
                vs_count += 1
        self.stdout.write(f"  {vs_count} vital signs")

        # ── Encounters ──────────────────────────────────────────────
        encounters = []
        for i, patient in enumerate(patients[:6]):
            pr = practitioners[i % len(practitioners)]
            enc, _ = PatientEncounter.objects.get_or_create(
                patient=patient,
                practitioner=pr,
                encounter_date=today - timedelta(days=i),
                defaults={
                    "status": "Completed",
                    "department": pr.department,
                    "symptoms": "General fatigue, mild headache",
                    "physical_examination": "Vitals within normal limits",
                    "clinical_notes": "Patient presents with typical symptoms. Recommend follow-up.",
                },
            )
            encounters.append(enc)

            # Diagnosis
            Diagnosis.objects.get_or_create(
                encounter=enc,
                diagnosis="Essential Hypertension" if i == 0 else
                          "Migraine" if i == 1 else
                          "Type 2 Diabetes Mellitus" if i == 2 else
                          "Upper Respiratory Tract Infection" if i == 3 else
                          "Low Back Pain" if i == 4 else
                          "General Health Checkup",
                defaults={"status": "Active", "is_primary": True},
            )

            # Symptom
            Symptom.objects.get_or_create(
                encounter=enc,
                symptom="Headache",
                defaults={"severity": "Moderate", "duration": "2 days"},
            )

            # Prescription
            DrugPrescription.objects.get_or_create(
                patient=patient,
                practitioner=pr,
                encounter=enc,
                medication_name="Paracetamol 500mg" if i % 2 == 0 else "Amoxicillin 250mg",
                defaults={
                    "dosage_form": "Tablet",
                    "dosage": "1 tablet",
                    "period": "5 days",
                    "status": "Active",
                    "comment": "Take after food",
                },
            )

            # Lab Test
            LabTest.objects.get_or_create(
                patient=patient,
                practitioner=pr,
                template=lab_templates[i % len(lab_templates)],
                lab_test_name=lab_templates[i % len(lab_templates)].lab_test_name,
                date=today - timedelta(days=i),
                defaults={
                    "status": ["Completed", "Approved", "Draft"][i % 3],
                    "result": "Values within normal range" if i < 3 else "",
                },
            )

            # Observation
            Observation.objects.get_or_create(
                patient=patient,
                encounter=enc,
                observation_type="BMI",
                defaults={
                    "value": "24.2",
                    "unit": "kg/m2",
                    "reference_range": "18.5-24.9",
                    "status": "Final",
                    "observation_date": today - timedelta(days=i),
                },
            )

            # Clinical Note
            ClinicalNote.objects.get_or_create(
                encounter=enc,
                note_type="Progress Note",
                defaults={
                    "note_content": f"Patient {patient.patient_name} is responding well to treatment. Continue current medication and follow up in 2 weeks.",
                    "author": pr,
                },
            )
        self.stdout.write(f"  {len(encounters)} encounters with diagnoses, symptoms, prescriptions, lab tests")

        # ── Therapy ─────────────────────────────────────────────────
        therapy_types = []
        for name in ["Physiotherapy", "Speech Therapy", "Occupational Therapy",
                      "Cognitive Behavioral Therapy"]:
            tt, _ = TherapyType.objects.get_or_create(therapy_type=name)
            therapy_types.append(tt)
        self.stdout.write(f"  {len(therapy_types)} therapy types")

        # Therapy Plans
        for i, patient in enumerate(patients[6:10]):
            pr = practitioners[7]  # physiotherapist
            tp, _ = TherapyPlan.objects.get_or_create(
                patient=patient,
                practitioner=pr,
                therapy_type=therapy_types[0],
                defaults={
                    "title": f"Rehabilitation Plan for {patient.patient_name}",
                    "status": "Active" if i < 2 else "Draft",
                    "start_date": today - timedelta(days=30),
                    "end_date": today + timedelta(days=30),
                    "goals": "Restore full range of motion and strength",
                    "total_sessions": 12,
                    "completed_sessions": i * 3,
                },
            )
            # Sessions
            for s in range(3):
                TherapySession.objects.get_or_create(
                    plan=tp,
                    patient=patient,
                    practitioner=pr,
                    session_date=today - timedelta(days=(3 - s) * 7),
                    defaults={
                        "duration": 45,
                        "status": "Completed",
                        "notes": f"Session {s + 1}: Stretching and strengthening exercises",
                        "exercises_performed": "Quad sets, hamstring stretches, wall slides",
                        "patient_response": "Good progress, mild discomfort",
                    },
                )
        self.stdout.write("  4 therapy plans with sessions")

        # Exercises
        for name, body, diff in [
            ("Quad Sets", "Knee", "Beginner"),
            ("Hamstring Stretch", "Leg", "Beginner"),
            ("Wall Slides", "Knee", "Intermediate"),
            ("Shoulder External Rotation", "Shoulder", "Beginner"),
            ("Plank Hold", "Core", "Intermediate"),
            ("Resistance Band Rows", "Back", "Intermediate"),
        ]:
            Exercise.objects.get_or_create(
                exercise_name=name,
                defaults={
                    "body_part": body,
                    "difficulty_level": diff,
                    "duration_minutes": 15,
                    "instructions": f"Perform {name} as directed by your therapist.",
                    "therapy_type": therapy_types[0],
                },
            )
        self.stdout.write("  6 exercises")

        # ── Insurance ───────────────────────────────────────────────
        payors = []
        for name, pid in [("Blue Cross Blue Shield", "BCBS-001"),
                          ("Aetna Health", "AET-002"),
                          ("United Healthcare", "UHC-003"),
                          ("Cigna", "CIG-004")]:
            payor, _ = InsurancePayor.objects.get_or_create(
                payor_name=name,
                defaults={"payor_id": pid, "is_active": True},
            )
            payors.append(payor)
        self.stdout.write(f"  {len(payors)} insurance payors")

        # Contracts
        for payor in payors:
            InsurancePayorContract.objects.get_or_create(
                contract_name=f"Standard Contract - {payor.payor_name}",
                payor=payor,
                defaults={
                    "start_date": today - timedelta(days=365),
                    "end_date": today + timedelta(days=365),
                    "coverage_percent": 80,
                    "max_amount": 100000,
                    "is_active": True,
                },
            )

        # Policies
        for i, patient in enumerate(patients[:6]):
            payor = payors[i % len(payors)]
            PatientInsurancePolicy.objects.get_or_create(
                policy_number=f"POL-{1000 + i}",
                patient=patient,
                payor=payor,
                defaults={
                    "coverage_type": "Individual",
                    "start_date": today - timedelta(days=365),
                    "end_date": today + timedelta(days=365),
                    "coverage_percent": 80,
                    "max_coverage": 50000,
                    "is_active": True,
                },
            )

        # Claims
        for i, patient in enumerate(patients[:4]):
            enc = encounters[i] if i < len(encounters) else encounters[0]
            InsuranceClaim.objects.get_or_create(
                patient=patient,
                payor=payors[i % len(payors)],
                encounter=enc,
                defaults={
                    "claim_amount": 2500 + i * 500,
                    "approved_amount": 2000 + i * 400 if i < 3 else 0,
                    "status": ["Approved", "Paid", "Submitted", "Under Review"][i % 4],
                    "submitted_date": today - timedelta(days=i * 7),
                },
            )
        self.stdout.write("  4 insurance policies and claims")

        # ── Inpatient ───────────────────────────────────────────────
        for i, patient in enumerate(patients[4:7]):
            pr = practitioners[i % len(practitioners)]
            record, _ = InpatientRecord.objects.get_or_create(
                patient=patient,
                defaults={
                    "practitioner": pr,
                    "service_unit": sus.get("ICU-1") if i == 0 else sus.get("Ward A - Bed 1"),
                    "department": pr.department,
                    "status": "Admitted" if i == 0 else "Discharged" if i == 1 else "Admission Scheduled",
                    "admission_date": today - timedelta(days=5 - i),
                    "chief_complaint": "Chest pain" if i == 0 else "Post-surgery recovery" if i == 1 else "Elective admission",
                    "height": 175,
                    "weight": 80,
                },
            )
            # Medication entries
            InpatientMedicationEntry.objects.get_or_create(
                inpatient_record=record,
                medication_name="Morphine 10mg" if i == 0 else "Paracetamol 500mg",
                entry_date=today - timedelta(days=3),
                defaults={
                    "dosage": "10mg",
                    "frequency": "Every 6 hours",
                    "route": "IV" if i == 0 else "Oral",
                    "practitioner": pr,
                    "status": "Active" if i == 0 else "Completed",
                },
            )
            # Occupancy
            InpatientOccupancy.objects.get_or_create(
                inpatient_record=record,
                service_unit=sus.get("ICU-1") if i == 0 else sus.get("Ward A - Bed 1"),
                defaults={
                    "start_date": today - timedelta(days=5 - i),
                    "is_active": i == 0,
                },
            )

        patient1 = patients[0]
        patient1.inpatient_status = "Admitted"
        patient1.save()
        self.stdout.write("  3 inpatient records with medications")

        # ── Healthcare Settings ─────────────────────────────────────
        HealthcareSettings.objects.get_or_create(id=1)
        self.stdout.write("  Healthcare settings created")

        # ═══════════════════════════════════════════════════════════════
        # REFERENCE DATA (Marley additions)
        # ═══════════════════════════════════════════════════════════════

        # Dosage Forms
        for df in ["Tablet", "Capsule", "Syrup", "Injection", "Drops",
                   "Inhaler", "Cream", "Ointment", "Suspension", "Gel"]:
            DosageForm.objects.get_or_create(dosage_form=df)
        self.stdout.write(f"  Dosage Forms: {DosageForm.objects.count()}")

        # Body Parts
        for bp in ["Head", "Neck", "Chest", "Abdomen", "Upper Limb",
                   "Lower Limb", "Back", "Pelvis", "Skin", "Eyes", "Ears"]:
            BodyPart.objects.get_or_create(body_part=bp)
        self.stdout.write(f"  Body Parts: {BodyPart.objects.count()}")

        # Sample Types
        for st in ["Blood", "Urine", "Stool", "Sputum", "CSF",
                   "Tissue", "Swab", "Saliva"]:
            SampleType.objects.get_or_create(sample_type=st)
        self.stdout.write(f"  Sample Types: {SampleType.objects.count()}")

        # Complaints
        for comp in ["Headache", "Fever", "Cough", "Chest Pain",
                     "Abdominal Pain", "Back Pain", "Shortness of Breath",
                     "Dizziness", "Fatigue", "Nausea", "Joint Pain",
                     "Skin Rash", "Vision Problems", "Hearing Loss"]:
            Complaint.objects.get_or_create(complaint=comp)
        self.stdout.write(f"  Complaints: {Complaint.objects.count()}")

        # Triage Levels
        triage_data = [
            ("Resuscitation", "R1", "#FF0000", 1, 0, "Immediate life-saving intervention"),
            ("Emergent", "E2", "#FF6600", 2, 10, "High risk, confused/lethargic"),
            ("Urgent", "U3", "#FFCC00", 3, 30, "Serious condition"),
            ("Semi-Urgent", "S4", "#00CC00", 4, 60, "Non-urgent, stable"),
            ("Non-Urgent", "N5", "#0066FF", 5, 120, "Can wait, minor conditions"),
        ]
        for name, code, color, priority, reassess, desc in triage_data:
            TriageLevel.objects.get_or_create(
                triage_level=name,
                defaults={"code": code, "color": color, "priority": priority,
                          "target_reassessment_mins": reassess, "description": desc},
            )
        self.stdout.write(f"  Triage Levels: {TriageLevel.objects.count()}")

        # Medication Classes
        for mc in ["Antibiotic", "Analgesic", "Antihistamine", "Antidepressant",
                   "Antihypertensive", "Antidiabetic", "Anticoagulant",
                   "Bronchodilator", "Corticosteroid", "Diuretic"]:
            MedicationClass.objects.get_or_create(medication_class=mc)
        self.stdout.write(f"  Medication Classes: {MedicationClass.objects.count()}")

        # Medications
        med_classes = {mc.medication_class: mc for mc in MedicationClass.objects.all()}
        dosage_forms = {df.dosage_form: df for df in DosageForm.objects.all()}
        med_data = [
            ("Amoxicillin", "Antibiotic", "500", "mg", "Capsule"),
            ("Paracetamol", "Analgesic", "500", "mg", "Tablet"),
            ("Ibuprofen", "Analgesic", "400", "mg", "Tablet"),
            ("Metformin", "Antidiabetic", "850", "mg", "Tablet"),
            ("Amlodipine", "Antihypertensive", "5", "mg", "Tablet"),
            ("Loratadine", "Antihistamine", "10", "mg", "Tablet"),
            ("Salbutamol", "Bronchodilator", "100", "mcg", "Inhaler"),
            ("Prednisolone", "Corticosteroid", "5", "mg", "Tablet"),
            ("Omeprazole", "Analgesic", "20", "mg", "Capsule"),
            ("Cetirizine", "Antihistamine", "10", "mg", "Tablet"),
        ]
        for gen_name, mc_name, strength, uom, df_name in med_data:
            Medication.objects.get_or_create(
                generic_name=gen_name,
                defaults={
                    "medication_class": med_classes.get(mc_name),
                    "dosage_form": dosage_forms.get(df_name),
                    "strength": strength,
                    "strength_uom": uom,
                },
            )
        self.stdout.write(f"  Medications: {Medication.objects.count()}")

        # Healthcare Activities
        for act in ["Vital Signs Monitoring", "Medication Administration",
                    "Wound Dressing", "IV Insertion", "Catheter Care",
                    "Patient Mobilization", "Breathing Exercises",
                    "Diet Education", "Fall Prevention", "Hand Hygiene"]:
            HealthcareActivity.objects.get_or_create(activity=act)
        self.stdout.write(f"  Healthcare Activities: {HealthcareActivity.objects.count()}")

        # Allergies
        allergy_data = [
            (0, "Penicillin", "Drug", "Severe", "Anaphylaxis"),
            (1, "Aspirin", "Drug", "Moderate", "Hives, rash"),
            (2, "Peanuts", "Food", "Severe", "Throat swelling"),
            (4, "Sulfa Drugs", "Drug", "Fatal", "Stevens-Johnson Syndrome"),
            (5, "Shellfish", "Food", "Moderate", "GI upset"),
        ]
        for pi, allergy, atype, sev, reaction in allergy_data:
            if pi < len(patients):
                Allergy.objects.get_or_create(
                    patient=patients[pi], allergy=allergy,
                    defaults={"allergy_type": atype, "severity": sev, "reaction": reaction, "status": "Active"},
                )
        self.stdout.write(f"  Allergies: {Allergy.objects.count()}")

        # Patient Relations
        if len(patients) >= 3:
            PatientRelation.objects.get_or_create(
                patient=patients[0], relation="Spouse",
                defaults={"contact_name": patients[1].patient_name, "contact_phone": patients[1].mobile},
            )
            PatientRelation.objects.get_or_create(
                patient=patients[1], relation="Spouse",
                defaults={"contact_name": patients[0].patient_name, "contact_phone": patients[0].mobile},
            )
        self.stdout.write(f"  Patient Relations: {PatientRelation.objects.count()}")

        # Nursing Tasks
        for i, patient in enumerate(patients[:4]):
            NursingTask.objects.get_or_create(
                patient=patient, title=f"Medication round - {patient.patient_name}",
                defaults={
                    "status": "Open" if i < 2 else "Completed",
                    "mandatory": True,
                    "task_date": today,
                    "description": f"Administer scheduled medications for {patient.patient_name}",
                },
            )
        self.stdout.write(f"  Nursing Tasks: {NursingTask.objects.count()}")

        # Emergency Records
        for i, patient in enumerate(patients[:3]):
            EmergencyRecord.objects.get_or_create(
                patient=patient,
                defaults={
                    "status": "Open" if i == 0 else "In Treatment" if i == 1 else "Discharged",
                    "arrival_datetime": now - timedelta(hours=6 - i * 2),
                    "arrival_mode": ["Walk-in", "Ambulance", "Walk-in"][i],
                    "chief_complaint": ["Chest pain", "Severe headache", "Fractured wrist"][i],
                    "triage_level": TriageLevel.objects.filter(priority=i + 1).first(),
                },
            )
        self.stdout.write(f"  Emergency Records: {EmergencyRecord.objects.count()}")

        # Service Request Categories
        for cat in ["Laboratory", "Radiology", "Consultation", "Procedure",
                    "Referral", "Therapy"]:
            ServiceRequestCategory.objects.get_or_create(category=cat)

        # Service Requests
        for i, patient in enumerate(patients[:4]):
            pr = practitioners[i % len(practitioners)]
            ServiceRequest.objects.get_or_create(
                patient=patient, practitioner=pr,
                title=f"Lab work for {patient.patient_name}",
                defaults={
                    "status": ["Active", "Completed", "Draft"][i % 3],
                    "priority": ["Routine", "Urgent"][i % 2],
                    "notes": "Standard lab work requested",
                },
            )
        self.stdout.write(f"  Service Request Categories: {ServiceRequestCategory.objects.count()}")
        self.stdout.write(f"  Service Requests: {ServiceRequest.objects.count()}")

        # ── Summary ─────────────────────────────────────────────────
        self.stdout.write(self.style.SUCCESS("\n=== Healthcare Data Summary ==="))
        self.stdout.write(f"  Medical Departments:    {MedicalDepartment.objects.count()}")
        self.stdout.write(f"  Service Unit Types:     {HealthcareServiceUnitType.objects.count()}")
        self.stdout.write(f"  Service Units:          {HealthcareServiceUnit.objects.count()}")
        self.stdout.write(f"  Patients:               {Patient.objects.count()}")
        self.stdout.write(f"  Practitioners:          {HealthcarePractitioner.objects.count()}")
        self.stdout.write(f"  Practitioner Schedules: {PractitionerSchedule.objects.count()}")
        self.stdout.write(f"  Appointments:           {PatientAppointment.objects.count()}")
        self.stdout.write(f"  Vital Signs:            {VitalSigns.objects.count()}")
        self.stdout.write(f"  Encounters:             {PatientEncounter.objects.count()}")
        self.stdout.write(f"  Diagnoses:              {Diagnosis.objects.count()}")
        self.stdout.write(f"  Symptoms:               {Symptom.objects.count()}")
        self.stdout.write(f"  Drug Prescriptions:     {DrugPrescription.objects.count()}")
        self.stdout.write(f"  Lab Test Templates:     {LabTestTemplate.objects.count()}")
        self.stdout.write(f"  Lab Tests:              {LabTest.objects.count()}")
        self.stdout.write(f"  Clinical Procedures:    {ClinicalProcedure.objects.count()}")
        self.stdout.write(f"  Therapy Types:          {TherapyType.objects.count()}")
        self.stdout.write(f"  Therapy Plans:          {TherapyPlan.objects.count()}")
        self.stdout.write(f"  Therapy Sessions:       {TherapySession.objects.count()}")
        self.stdout.write(f"  Exercises:              {Exercise.objects.count()}")
        self.stdout.write(f"  Insurance Payors:       {InsurancePayor.objects.count()}")
        self.stdout.write(f"  Insurance Policies:     {PatientInsurancePolicy.objects.count()}")
        self.stdout.write(f"  Insurance Claims:       {InsuranceClaim.objects.count()}")
        self.stdout.write(f"  Inpatient Records:      {InpatientRecord.objects.count()}")
        self.stdout.write(f"  Inpatient Medications:  {InpatientMedicationEntry.objects.count()}")
        self.stdout.write(f"  Inpatient Occupancies:  {InpatientOccupancy.objects.count()}")
        self.stdout.write(f"  Observations:           {Observation.objects.count()}")
        self.stdout.write(f"  Clinical Notes:         {ClinicalNote.objects.count()}")
        self.stdout.write(f"  Dosage Forms:           {DosageForm.objects.count()}")
        self.stdout.write(f"  Body Parts:             {BodyPart.objects.count()}")
        self.stdout.write(f"  Sample Types:           {SampleType.objects.count()}")
        self.stdout.write(f"  Complaints:             {Complaint.objects.count()}")
        self.stdout.write(f"  Triage Levels:          {TriageLevel.objects.count()}")
        self.stdout.write(f"  Medication Classes:     {MedicationClass.objects.count()}")
        self.stdout.write(f"  Medications:            {Medication.objects.count()}")
        self.stdout.write(f"  Healthcare Activities:  {HealthcareActivity.objects.count()}")
        self.stdout.write(f"  Allergies:              {Allergy.objects.count()}")
        self.stdout.write(f"  Patient Relations:      {PatientRelation.objects.count()}")
        self.stdout.write(f"  Nursing Tasks:          {NursingTask.objects.count()}")
        self.stdout.write(f"  Emergency Records:      {EmergencyRecord.objects.count()}")
        self.stdout.write(f"  Service Requests:       {ServiceRequest.objects.count()}")
        self.stdout.write(self.style.SUCCESS("\nHealthcare data seeded successfully!"))
