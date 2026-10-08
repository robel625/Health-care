"""
Management command to seed a complete Marley-compliant Pharmacy catalog:
- Medication Formulary (Medications, Classes, Ingredients, Linked Items)
- Drug Interactions
- Inpatient Medication Orders & Order Entries (scheduled doses)
- Outpatient Prescriptions (MedicationRequest & DrugPrescription)
- Pharmacy Stock Balances in Main Pharmacy Warehouse
"""
from decimal import Decimal
from datetime import date, time, timedelta
from django.core.management.base import BaseCommand
from django.utils import timezone
from apps.healthcare.models import (
    Patient, HealthcarePractitioner, MedicalDepartment,
    HealthcareServiceUnit, InpatientRecord, InpatientOccupancy,
    MedicationClass, Medication, MedicationIngredient, MedicationLinkedItem,
    DosageForm, PrescriptionDosage, PrescriptionDuration,
    DrugInteraction, DrugPrescription, MedicationRequest,
    InpatientMedicationOrder, InpatientMedicationOrderEntry,
    PharmacyWarehouse, PharmacyStock,
)
from apps.setup.models import Company


class Command(BaseCommand):
    help = "Seeds comprehensive Marley Pharmacy Formulary, Inpatient Orders, and Stock"

    def handle(self, *args, **options):
        self.stdout.write("Starting Marley Pharmacy Catalog seeding...")

        pharmacy_wh, _ = PharmacyWarehouse.objects.get_or_create(
            warehouse_name="Main Pharmacy",
            defaults={"is_active": True}
        )

        # 1. Seed Medication Classes
        med_classes_data = [
            "Analgesics & Antipyretics",
            "Antibiotics & Antimicrobials",
            "Antihypertensives & Cardiovascular",
            "Antidiabetics",
            "Bronchodilators & Respiratory",
            "Proton Pump Inhibitors & GI",
            "Antihistamines & Allergy",
            "Anticoagulants & Antiplatelets",
            "Corticosteroids & Anti-inflammatory",
            "Central Nervous System Agents",
        ]

        class_objs = {}
        for c_name in med_classes_data:
            obj, _ = MedicationClass.objects.get_or_create(
                medication_class=c_name
            )
            class_objs[c_name] = obj

        self.stdout.write(f"  [OK] Medication Classes: {len(class_objs)}")

        # 2. Dosage Forms mapping
        df_map = {df.dosage_form: df for df in DosageForm.objects.all()}

        # 3. Medications Catalog (Formulary)
        catalog = [
            # Analgesics
            ("Paracetamol 500mg", "Paracetamol", "500", "mg", "Tablet", "Analgesics & Antipyretics", Decimal("0.25"), 600),
            ("Paracetamol 1000mg IV", "Paracetamol IV Infusion", "1000", "mg", "Injection", "Analgesics & Antipyretics", Decimal("4.50"), 120),
            ("Ibuprofen 400mg", "Ibuprofen", "400", "mg", "Tablet", "Analgesics & Antipyretics", Decimal("0.40"), 450),
            ("Diclofenac 50mg", "Diclofenac Sodium", "50", "mg", "Tablet", "Analgesics & Antipyretics", Decimal("0.35"), 300),
            ("Tramadol 50mg", "Tramadol HCl", "50", "mg", "Capsule", "Analgesics & Antipyretics", Decimal("0.85"), 200),
            ("Morphine 10mg/mL", "Morphine Sulfate", "10", "mg/mL", "Injection", "Analgesics & Antipyretics", Decimal("6.20"), 80),

            # Antibiotics
            ("Amoxicillin 500mg", "Amoxicillin Trihydrate", "500", "mg", "Capsule", "Antibiotics & Antimicrobials", Decimal("0.60"), 500),
            ("Amoxicillin 250mg", "Amoxicillin", "250", "mg", "Capsule", "Antibiotics & Antimicrobials", Decimal("0.35"), 350),
            ("Amoxicillin + Clavulanate 625mg", "Co-Amoxiclav", "625", "mg", "Tablet", "Antibiotics & Antimicrobials", Decimal("1.20"), 300),
            ("Ciprofloxacin 500mg", "Ciprofloxacin HCl", "500", "mg", "Tablet", "Antibiotics & Antimicrobials", Decimal("0.75"), 250),
            ("Azithromycin 500mg", "Azithromycin", "500", "mg", "Tablet", "Antibiotics & Antimicrobials", Decimal("1.50"), 200),
            ("Ceftriaxone 1g IV", "Ceftriaxone Sodium", "1", "g", "Injection", "Antibiotics & Antimicrobials", Decimal("5.80"), 150),
            ("Metronidazole 400mg", "Metronidazole", "400", "mg", "Tablet", "Antibiotics & Antimicrobials", Decimal("0.30"), 300),
            ("Doxycycline 100mg", "Doxycycline Hyclate", "100", "mg", "Capsule", "Antibiotics & Antimicrobials", Decimal("0.50"), 200),
            ("Gentamicin 80mg/2mL", "Gentamicin Sulfate", "80", "mg", "Injection", "Antibiotics & Antimicrobials", Decimal("2.10"), 100),

            # Antihypertensives & Cardiovascular
            ("Amlodipine 5mg", "Amlodipine Besylate", "5", "mg", "Tablet", "Antihypertensives & Cardiovascular", Decimal("0.30"), 400),
            ("Amlodipine 10mg", "Amlodipine Besylate", "10", "mg", "Tablet", "Antihypertensives & Cardiovascular", Decimal("0.50"), 300),
            ("Losartan 50mg", "Losartan Potassium", "50", "mg", "Tablet", "Antihypertensives & Cardiovascular", Decimal("0.45"), 350),
            ("Lisinopril 10mg", "Lisinopril", "10", "mg", "Tablet", "Antihypertensives & Cardiovascular", Decimal("0.40"), 280),
            ("Atenolol 50mg", "Atenolol", "50", "mg", "Tablet", "Antihypertensives & Cardiovascular", Decimal("0.25"), 250),
            ("Furosemide 40mg", "Furosemide", "40", "mg", "Tablet", "Antihypertensives & Cardiovascular", Decimal("0.20"), 300),
            ("Furosemide 20mg/2mL IV", "Furosemide Injection", "20", "mg", "Injection", "Antihypertensives & Cardiovascular", Decimal("1.80"), 120),
            ("Atorvastatin 20mg", "Atorvastatin Calcium", "20", "mg", "Tablet", "Antihypertensives & Cardiovascular", Decimal("0.80"), 350),

            # Antidiabetics
            ("Metformin 500mg", "Metformin HCl", "500", "mg", "Tablet", "Antidiabetics", Decimal("0.20"), 500),
            ("Metformin 850mg", "Metformin HCl", "850", "mg", "Tablet", "Antidiabetics", Decimal("0.30"), 300),
            ("Glibenclamide 5mg", "Glibenclamide", "5", "mg", "Tablet", "Antidiabetics", Decimal("0.25"), 200),
            ("Insulin Regular 100IU/mL", "Human Insulin (Regular)", "100", "IU/mL", "Injection", "Antidiabetics", Decimal("14.50"), 80),
            ("Insulin Glargine 100IU/mL", "Insulin Glargine Long-Acting", "100", "IU/mL", "Injection", "Antidiabetics", Decimal("28.00"), 60),

            # Respiratory
            ("Salbutamol Inhaler 100mcg", "Salbutamol (Albuterol)", "100", "mcg/dose", "Inhaler", "Bronchodilators & Respiratory", Decimal("4.20"), 150),
            ("Salbutamol 4mg", "Salbutamol Sulfate", "4", "mg", "Tablet", "Bronchodilators & Respiratory", Decimal("0.15"), 300),
            ("Budecort Inhaler 200mcg", "Budesonide", "200", "mcg/dose", "Inhaler", "Bronchodilators & Respiratory", Decimal("8.50"), 90),
            ("Ipratropium Respules 0.5mg", "Ipratropium Bromide", "0.5", "mg/2mL", "Drops", "Bronchodilators & Respiratory", Decimal("1.20"), 140),

            # Gastrointestinal
            ("Omeprazole 20mg", "Omeprazole", "20", "mg", "Capsule", "Proton Pump Inhibitors & GI", Decimal("0.35"), 450),
            ("Pantoprazole 40mg IV", "Pantoprazole Sodium", "40", "mg", "Injection", "Proton Pump Inhibitors & GI", Decimal("3.20"), 180),
            ("Ondansetron 4mg", "Ondansetron HCl", "4", "mg", "Tablet", "Proton Pump Inhibitors & GI", Decimal("0.60"), 250),
            ("Ondansetron 4mg/2mL IV", "Ondansetron Injection", "4", "mg", "Injection", "Proton Pump Inhibitors & GI", Decimal("2.40"), 150),
            ("Oral Rehydration Salts (ORS)", "Electrolyte Replacement", "20.5", "g", "Powder", "Proton Pump Inhibitors & GI", Decimal("0.45"), 500),

            # Antihistamines
            ("Cetirizine 10mg", "Cetirizine HCl", "10", "mg", "Tablet", "Antihistamines & Allergy", Decimal("0.25"), 400),
            ("Loratadine 10mg", "Loratadine", "10", "mg", "Tablet", "Antihistamines & Allergy", Decimal("0.30"), 300),
            ("Chlorpheniramine 4mg", "Chlorpheniramine Maleate", "4", "mg", "Tablet", "Antihistamines & Allergy", Decimal("0.10"), 350),

            # Anticoagulants
            ("Warfarin 5mg", "Warfarin Sodium", "5", "mg", "Tablet", "Anticoagulants & Antiplatelets", Decimal("0.40"), 200),
            ("Aspirin 81mg (Ecosprin)", "Acetylsalicylic Acid", "81", "mg", "Tablet", "Anticoagulants & Antiplatelets", Decimal("0.15"), 500),
            ("Clopidogrel 75mg", "Clopidogrel Bisulfate", "75", "mg", "Tablet", "Anticoagulants & Antiplatelets", Decimal("0.70"), 250),
            ("Enoxaparin 40mg/0.4mL", "Low Molecular Weight Heparin", "40", "mg", "Injection", "Anticoagulants & Antiplatelets", Decimal("9.50"), 100),

            # Corticosteroids
            ("Prednisolone 5mg", "Prednisolone", "5", "mg", "Tablet", "Corticosteroids & Anti-inflammatory", Decimal("0.20"), 300),
            ("Hydrocortisone 100mg IV", "Hydrocortisone Sodium Succinate", "100", "mg", "Injection", "Corticosteroids & Anti-inflammatory", Decimal("3.80"), 120),
            ("Dexamethasone 4mg/mL", "Dexamethasone Sodium Phosphate", "4", "mg/mL", "Injection", "Corticosteroids & Anti-inflammatory", Decimal("1.50"), 180),
        ]

        created_meds = 0
        from django.db.models import Sum

        for name, gen, strength, str_uom, form_name, cls_name, price, init_qty in catalog:
            df = df_map.get(form_name)
            mc = class_objs.get(cls_name)

            med, _ = Medication.objects.get_or_create(
                generic_name=gen,
                defaults={
                    "strength": strength,
                    "strength_uom": str_uom,
                    "dosage_form": df,
                    "medication_class": mc,
                    "is_combination": False,
                    "disabled": False,
                }
            )

            PharmacyStock.objects.update_or_create(
                warehouse=pharmacy_wh,
                item_code=name,
                defaults={
                    "medication": med,
                    "item_name": name,
                    "item_group": "Pharmaceuticals",
                    "actual_qty": Decimal(str(init_qty)),
                    "valuation_rate": price,
                    "reorder_level": Decimal("25.00"),
                    "stock_uom": str_uom or "Nos",
                }
            )

            created_meds += 1

        self.stdout.write(f"  [OK] Medication Catalog seeded: {created_meds} medications with stock balances.")

        # 4. Seed Known Drug Interactions
        interactions_data = [
            ("Warfarin", "Ibuprofen", "Severe", "Increased risk of major gastrointestinal hemorrhage and bleeding."),
            ("Warfarin", "Acetylsalicylic Acid", "Severe", "Additive antiplatelet and anticoagulant effect increasing hemorrhage risk."),
            ("Ciprofloxacin HCl", "Electrolyte Replacement", "Moderate", "Chelation with polyvalent cations decreases ciprofloxacin bioavailability."),
            ("Tramadol HCl", "Ondansetron HCl", "Moderate", "Ondansetron may inhibit analgesic efficacy of tramadol via 5HT3 receptor antagonism."),
            ("Clopidogrel Bisulfate", "Omeprazole", "Moderate", "Omeprazole inhibits CYP2C19, significantly reducing active metabolite of clopidogrel."),
            ("Amlodipine Besylate", "Atenolol", "Mild", "Additive hypotensive effect; monitor blood pressure and bradycardia."),
            ("Metformin HCl", "Furosemide", "Moderate", "Furosemide may increase metformin plasma concentrations and lactic acidosis risk."),
            ("Gentamicin Sulfate", "Furosemide Injection", "Severe", "Potentiated nephrotoxicity and ototoxicity when combined with loop diuretics."),
        ]

        interaction_count = 0
        for gen1, gen2, severity, desc in interactions_data:
            m1 = Medication.objects.filter(generic_name__icontains=gen1).first()
            m2 = Medication.objects.filter(generic_name__icontains=gen2).first()
            if m1 and m2:
                DrugInteraction.objects.get_or_create(
                    drug1=m1,
                    drug2=m2,
                    defaults={"severity": severity, "description": desc}
                )
                interaction_count += 1

        self.stdout.write(f"  [OK] Drug Interactions seeded: {interaction_count} interaction rules.")

        # 5. Seed Inpatient Medication Orders (IMO) & Scheduled Entries for Admitted Patients
        admitted_patient = Patient.objects.filter(inpatient_status="Admitted").first()
        if not admitted_patient:
            admitted_patient = Patient.objects.first()
            if admitted_patient:
                admitted_patient.inpatient_status = "Admitted"
                admitted_patient.save(update_fields=["inpatient_status"])

        practitioner = HealthcarePractitioner.objects.first()
        inp_record = InpatientRecord.objects.filter(status="Admitted").first()
        if not inp_record and admitted_patient:
            inp_record, _ = InpatientRecord.objects.get_or_create(
                patient=admitted_patient,
                defaults={"status": "Admitted", "admission_date": timezone.now().date()}
            )

        ward_bed = HealthcareServiceUnit.objects.filter(is_group=False).first()
        if inp_record and ward_bed:
            InpatientOccupancy.objects.get_or_create(
                inpatient_record=inp_record,
                service_unit=ward_bed,
                defaults={
                    "start_date": timezone.now().date() - timedelta(days=2),
                    "start_time": time(9, 0),
                    "is_active": True
                }
            )

        # Create scheduled Inpatient Medication Orders
        scheduled_orders = [
            ("Ceftriaxone 1g IV", "1g", "Once daily", "IV Infusion", [time(8, 0)], Decimal("1.00"), "Administer in 100mL Normal Saline over 30 mins"),
            ("Pantoprazole 40mg IV", "40mg", "Twice daily", "IV Push", [time(8, 0), time(20, 0)], Decimal("1.00"), "Slow IV injection before meals"),
            ("Paracetamol 1000mg IV", "1000mg", "Every 6 hours", "IV Infusion", [time(8, 0), time(14, 0), time(20, 0)], Decimal("1.00"), "For post-operative analgesia as scheduled"),
            ("Enoxaparin 40mg/0.4mL", "40mg", "Once daily", "Subcutaneous", [time(22, 0)], Decimal("1.00"), "Deep SC injection in abdominal wall"),
            ("Amlodipine 5mg", "5mg", "Once daily morning", "Oral", [time(8, 0)], Decimal("1.00"), "Administer with morning vitals"),
        ]

        today = timezone.now().date()
        imo_count = 0
        entry_count = 0

        for med_name, dose, freq, route, times, qty, notes in scheduled_orders:
            order, _ = InpatientMedicationOrder.objects.get_or_create(
                inpatient_record=inp_record,
                patient=admitted_patient,
                medication_name=med_name,
                defaults={
                    "practitioner": practitioner,
                    "dosage": dose,
                    "frequency": freq,
                    "route": route,
                    "start_date": today - timedelta(days=1),
                    "end_date": today + timedelta(days=3),
                    "status": "Active",
                    "notes": notes,
                }
            )
            imo_count += 1

            # Create scheduled administration entries for today
            for t in times:
                entry_obj, created = InpatientMedicationOrderEntry.objects.get_or_create(
                    order=order,
                    medication_name=med_name,
                    dosage=dose,
                    notes=f"Scheduled administration at {t.strftime('%H:%M')}. {notes}",
                    defaults={
                        "frequency": freq,
                        "route": route,
                        "quantity": qty,
                        "status": "Active",
                    }
                )
                entry_count += 1

        self.stdout.write(f"  [OK] Inpatient Medication Orders seeded: {imo_count} orders with {entry_count} administration doses.")

        # 6. Seed Outpatient Doctor Prescriptions (MedicationRequest & DrugPrescription)
        outpatients = Patient.objects.exclude(id=admitted_patient.id if admitted_patient else 0)[:5]
        outpatient_rx = [
            ("Amoxicillin + Clavulanate 625mg", "1 tablet", "1-0-1", "7 Day", "Oral after meals", Decimal("14.00")),
            ("Omeprazole 20mg", "1 capsule", "1-0-0", "14 Day", "Take 30 mins before breakfast", Decimal("14.00")),
            ("Cetirizine 10mg", "1 tablet", "0-0-1", "10 Day", "Take at bedtime", Decimal("10.00")),
            ("Salbutamol Inhaler 100mcg", "2 puffs", "PRN", "30 Day", "Inhale as needed for shortness of breath", Decimal("1.00")),
            ("Metformin 500mg", "1 tablet", "1-0-1", "30 Day", "Take with meals for blood glucose control", Decimal("60.00")),
            ("Atorvastatin 20mg", "1 tablet", "0-0-1", "30 Day", "Take at bedtime", Decimal("30.00")),
        ]

        rx_count = 0
        for i, pat in enumerate(outpatients):
            rx1 = outpatient_rx[i % len(outpatient_rx)]
            rx2 = outpatient_rx[(i + 1) % len(outpatient_rx)]

            for med_name, dose, code, period, inst, qty in [rx1, rx2]:
                MedicationRequest.objects.get_or_create(
                    patient=pat,
                    medication_name=med_name,
                    defaults={
                        "practitioner": practitioner,
                        "dosage_instruction": f"{dose} ({code}) for {period}. {inst}",
                        "quantity": qty,
                        "status": "Active",
                        "intent": "Order",
                        "priority": "Routine",
                        "warehouse": pharmacy_wh,
                        "notes": inst,
                    }
                )

                DrugPrescription.objects.get_or_create(
                    patient=pat,
                    medication_name=med_name,
                    dosage=code,
                    period=period,
                    defaults={
                        "practitioner": practitioner,
                        "strength": dose,
                        "quantity": qty,
                        "status": "Active",
                        "comment": inst,
                    }
                )
                rx_count += 1

        self.stdout.write(f"  [OK] Outpatient Prescriptions seeded: {rx_count} active prescriptions.")
        self.stdout.write(self.style.SUCCESS("Marley Pharmacy catalog and workflow data successfully seeded!"))
