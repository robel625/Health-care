import os
from decimal import Decimal
from django.core.management.base import BaseCommand
from django.utils import timezone


class Command(BaseCommand):
    help = "Seed rich, comprehensive clinical diagnostic masters: UOMs, Samples, Observation Templates, Reference Ranges, Lab Test Templates, and Pharmacy Stock."

    def handle(self, *args, **options):
        self.stdout.write("Starting comprehensive clinical diagnostic seeding...")

        from apps.healthcare.models import (
            LabTestUOM,
            LabTestSample,
            ObservationTemplate,
            ObservationReferenceRange,
            LabTestTemplate,
            NormalTestTemplate,
            Medication,
            DosageForm,
            PharmacyWarehouse,
            PharmacyStock,
        )
        from apps.setup.models import Company

        # ── 1. LAB TEST UOMS ─────────────────────────────────────────────
        uoms = [
            ("umol/L", "Micromoles per Liter"),
            ("mg/L", "Milligrams per Liter"),
            ("mg/dL", "Milligrams per Deciliter"),
            ("mg / dl", "Milligrams per Deciliter (legacy)"),
            ("g/dL", "Grams per Deciliter"),
            ("g/L", "Grams per Liter"),
            ("pg/mL", "Picograms per Milliliter"),
            ("pg/ml", "Picograms per Milliliter (legacy)"),
            ("ng/mL", "Nanograms per Milliliter"),
            ("ng/ml", "Nanograms per Milliliter (legacy)"),
            ("ng/dL", "Nanograms per Deciliter"),
            ("ug/dL", "Micrograms per Deciliter"),
            ("uIU/mL", "Micro International Units per Milliliter"),
            ("ulU / ml", "Micro International Units per Milliliter (legacy)"),
            ("IU/mL", "International Units per Milliliter"),
            ("IU/L", "International Units per Liter"),
            ("U/L", "Units per Liter"),
            ("U / L", "Units per Liter (legacy)"),
            ("U/mL", "Units per Milliliter"),
            ("mmol/L", "Millimoles per Liter"),
            ("mEq/L", "Milliequivalents per Liter"),
            ("10^3/uL", "Thousand Cells per Microliter"),
            ("10^6/uL", "Million Cells per Microliter"),
            ("Cells / cumm", "Cells per Cubic Millimeter"),
            ("Million Cells / cumm", "Million Cells per Cubic Millimeter"),
            ("Lakhs Cells / cumm", "Lakhs Cells per Cubic Millimeter"),
            ("/HPF", "Per High Power Field"),
            ("/LPF", "Per Low Power Field"),
            ("fl", "Femtoliters"),
            ("pg", "Picograms"),
            ("%", "Percentage"),
            ("gm %", "Gram Percent"),
            ("mm/hr", "Millimeters per Hour"),
            ("mm / hr", "Millimeters per Hour (legacy)"),
            ("sec", "Seconds"),
            ("seconds", "Seconds"),
            ("ratio", "Ratio"),
            ("index", "Index Value"),
            ("copies/mL", "Copies per Milliliter"),
            ("mg/24hr", "Milligrams per 24 Hours"),
            ("mOsm/kg", "Milliosmoles per Kilogram"),
            ("ml/min/1.73m2", "Milliliters per Minute per 1.73 m² BSA"),
            ("beats/min", "Beats per Minute"),
            ("breaths/min", "Breaths per Minute"),
            ("mmHg", "Millimeters of Mercury"),
            ("°C", "Degrees Celsius"),
            ("°F", "Degrees Fahrenheit"),
            ("kg/m2", "Kilograms per Square Meter (BMI)"),
            ("/10", "Numerical Rating Scale"),
            ("ml", "Milliliter"),
            ("container", "Container"),
            ("swab", "Swab"),
            ("slide", "Slide"),
            ("drop", "Drop"),
            ("tube", "Tube"),
        ]

        uom_map = {}
        for code, desc in uoms:
            obj, _ = LabTestUOM.objects.get_or_create(
                lab_test_uom=code,
                defaults={"uom_description": desc}
            )
            uom_map[code] = obj
        self.stdout.write(f"  [OK] Seeded/Verified {len(uoms)} Lab Test UOMs")

        # ── 2. LAB TEST SAMPLES ──────────────────────────────────────────
        samples_data = [
            ("Blood", "ml", "Lavender", "Whole blood collected in EDTA, Heparin, or Citrate tube"),
            ("Serum", "ml", "Gold", "Serum separated after whole blood coagulation"),
            ("Plasma", "ml", "Light Blue", "Liquid cell-free part of blood treated with anticoagulants"),
            ("Urine", "ml", "Yellow", "Midstream clean-catch urine specimen"),
            ("Stool", "container", "Brown", "Fecal specimen for routine examination, occult blood, culture"),
            ("Sputum", "container", "Blue", "Deep cough sputum specimen for AFB stain or culture"),
            ("CSF (Cerebrospinal Fluid)", "ml", "Clear", "Lumbar puncture spinal fluid specimen"),
            ("Synovial Fluid", "ml", "Clear", "Aspirated joint fluid specimen"),
            ("Pleural Fluid", "ml", "Clear", "Thoracentesis pleural cavity fluid"),
            ("Peritoneal Fluid", "ml", "Clear", "Paracentesis peritoneal ascitic fluid"),
            ("Nasopharyngeal Swab", "swab", "White", "Swab for viral respiratory panels (COVID, Influenza, RSV)"),
            ("Throat Swab", "swab", "Red", "Pharyngeal swab for Strep A and throat culture"),
            ("Wound Swab", "swab", "Green", "Pus or surface exudate swab for Gram stain and culture"),
            ("Biopsy Tissue", "container", "White", "Formalin-fixed surgical tissue for histopathology"),
            ("Bone Marrow", "slide", "Blue", "Aspirate and trephine biopsy slides"),
            ("Semen", "ml", "White", "Seminal fluid for fertility evaluation"),
        ]

        sample_map = {}
        for name, uom_str, color, desc in samples_data:
            uom_obj = uom_map.get(uom_str)
            obj, _ = LabTestSample.objects.get_or_create(
                sample=name,
                defaults={
                    "sample_uom": uom_obj,
                    "container_closure_color": color,
                }
            )
            if not obj.sample_uom and uom_obj:
                obj.sample_uom = uom_obj
            if not obj.container_closure_color:
                obj.container_closure_color = color
            obj.save()
            sample_map[name] = obj
        self.stdout.write(f"  [OK] Seeded/Verified {len(samples_data)} Lab Test Samples")

        # ── 3. OBSERVATION TEMPLATES & REFERENCE RANGES ──────────────────
        obs_definitions = [
            # Vital Signs
            {
                "observation": "Pulse Rate", "category": "Vital Signs", "abbr": "PR",
                "data_type": "Quantity", "unit": "beats/min", "sample": None,
                "ranges": [("All", 0, 120, "60", "100", "<50 or >120", "Normal resting heart rate")],
            },
            {
                "observation": "Respiratory Rate", "category": "Vital Signs", "abbr": "RR",
                "data_type": "Quantity", "unit": "breaths/min", "sample": None,
                "ranges": [("All", 0, 120, "12", "20", "<10 or >24", "Normal adult respiratory rate")],
            },
            {
                "observation": "Body Temperature", "category": "Vital Signs", "abbr": "TEMP",
                "data_type": "Quantity", "unit": "°C", "sample": None,
                "ranges": [("All", 0, 120, "36.5", "37.5", "<35.0 or >38.5", "Normal core body temperature")],
            },
            {
                "observation": "BP Systolic", "category": "Vital Signs", "abbr": "BPS",
                "data_type": "Quantity", "unit": "mmHg", "sample": None,
                "ranges": [("All", 18, 120, "90", "120", "<90 or >140", "Normal resting systolic blood pressure")],
            },
            {
                "observation": "BP Diastolic", "category": "Vital Signs", "abbr": "BPD",
                "data_type": "Quantity", "unit": "mmHg", "sample": None,
                "ranges": [("All", 18, 120, "60", "80", "<60 or >90", "Normal resting diastolic blood pressure")],
            },
            {
                "observation": "Oxygen Saturation", "category": "Vital Signs", "abbr": "SpO2",
                "data_type": "Quantity", "unit": "%", "sample": None,
                "ranges": [("All", 0, 120, "95", "100", "<90", "Normal peripheral pulse oximetry")],
            },
            {
                "observation": "Body Mass Index", "category": "Vital Signs", "abbr": "BMI",
                "data_type": "Quantity", "unit": "kg/m2", "sample": None,
                "ranges": [("All", 18, 120, "18.5", "24.9", "<18.5 or >=30", "Normal healthy weight range")],
            },
            {
                "observation": "Random Blood Sugar", "category": "Laboratory", "abbr": "RBS",
                "data_type": "Quantity", "unit": "mg/dL", "sample": "Blood",
                "ranges": [("All", 0, 120, "70", "140", "<70 or >200", "Normal random blood glucose")],
            },
            {
                "observation": "Fasting Blood Sugar", "category": "Laboratory", "abbr": "FBS",
                "data_type": "Quantity", "unit": "mg/dL", "sample": "Blood",
                "ranges": [("All", 0, 120, "70", "99", "<70 or >=126", "Normal fasting glucose; >=126 is diabetic threshold")],
            },
            {
                "observation": "Pain Score", "category": "Vital Signs", "abbr": "PAIN",
                "data_type": "Quantity", "unit": "/10", "sample": None,
                "ranges": [("All", 0, 120, "0", "3", ">=7", "Mild pain 1-3, Moderate 4-6, Severe 7-10")],
            },

            # Complete Blood Count (CBC)
            {
                "observation": "White Blood Cell Count", "category": "Laboratory", "abbr": "WBC",
                "data_type": "Quantity", "unit": "10^3/uL", "sample": "Blood",
                "ranges": [("All", 0, 120, "4.5", "11.0", "<4.0 or >15.0", "Normal total leukocyte count")],
            },
            {
                "observation": "Red Blood Cell Count", "category": "Laboratory", "abbr": "RBC",
                "data_type": "Quantity", "unit": "10^6/uL", "sample": "Blood",
                "ranges": [
                    ("Male", 18, 120, "4.7", "6.1", "<4.0 or >6.5", "Normal adult male erythrocyte count"),
                    ("Female", 18, 120, "4.2", "5.4", "<3.8 or >5.8", "Normal adult female erythrocyte count"),
                ],
            },
            {
                "observation": "Hemoglobin", "category": "Laboratory", "abbr": "HGB",
                "data_type": "Quantity", "unit": "g/dL", "sample": "Blood",
                "ranges": [
                    ("Male", 18, 120, "13.8", "17.2", "<12.0 or >18.5", "Normal adult male hemoglobin"),
                    ("Female", 18, 120, "12.1", "15.1", "<11.0 or >16.5", "Normal adult female hemoglobin"),
                ],
            },
            {
                "observation": "Hematocrit", "category": "Laboratory", "abbr": "HCT",
                "data_type": "Quantity", "unit": "%", "sample": "Blood",
                "ranges": [
                    ("Male", 18, 120, "40.7", "50.3", "<36.0 or >54.0", "Normal male packed cell volume"),
                    ("Female", 18, 120, "36.1", "44.3", "<33.0 or >48.0", "Normal female packed cell volume"),
                ],
            },
            {
                "observation": "Mean Corpuscular Volume", "category": "Laboratory", "abbr": "MCV",
                "data_type": "Quantity", "unit": "fl", "sample": "Blood",
                "ranges": [("All", 18, 120, "80.0", "100.0", "<75.0 or >105.0", "Normal red blood cell volume")],
            },
            {
                "observation": "Mean Corpuscular Hemoglobin", "category": "Laboratory", "abbr": "MCH",
                "data_type": "Quantity", "unit": "pg", "sample": "Blood",
                "ranges": [("All", 18, 120, "27.0", "33.0", "<25.0 or >35.0", "Normal average hemoglobin per RBC")],
            },
            {
                "observation": "Platelet Count", "category": "Laboratory", "abbr": "PLT",
                "data_type": "Quantity", "unit": "10^3/uL", "sample": "Blood",
                "ranges": [("All", 0, 120, "150", "450", "<100 or >500", "Normal thrombocyte count")],
            },
            {
                "observation": "Neutrophils Percentage", "category": "Laboratory", "abbr": "NEUT%",
                "data_type": "Quantity", "unit": "%", "sample": "Blood",
                "ranges": [("All", 0, 120, "40", "70", "<35 or >80", "Relative neutrophil percentage")],
            },
            {
                "observation": "Lymphocytes Percentage", "category": "Laboratory", "abbr": "LYMPH%",
                "data_type": "Quantity", "unit": "%", "sample": "Blood",
                "ranges": [("All", 0, 120, "20", "40", "<15 or >50", "Relative lymphocyte percentage")],
            },

            # Lipid Profile
            {
                "observation": "Total Cholesterol", "category": "Laboratory", "abbr": "CHOL",
                "data_type": "Quantity", "unit": "mg/dL", "sample": "Serum",
                "ranges": [("All", 18, 120, "125", "200", ">240", "Desirable: <200 mg/dL, High: >=240 mg/dL")],
            },
            {
                "observation": "Triglycerides", "category": "Laboratory", "abbr": "TRIG",
                "data_type": "Quantity", "unit": "mg/dL", "sample": "Serum",
                "ranges": [("All", 18, 120, "50", "150", ">=200", "Normal: <150 mg/dL, High: 200-499 mg/dL")],
            },
            {
                "observation": "HDL Cholesterol", "category": "Laboratory", "abbr": "HDL",
                "data_type": "Quantity", "unit": "mg/dL", "sample": "Serum",
                "ranges": [
                    ("Male", 18, 120, "40", "60", "<40", "Desirable: >=40 mg/dL for men"),
                    ("Female", 18, 120, "50", "70", "<50", "Desirable: >=50 mg/dL for women"),
                ],
            },
            {
                "observation": "LDL Cholesterol", "category": "Laboratory", "abbr": "LDL",
                "data_type": "Quantity", "unit": "mg/dL", "sample": "Serum",
                "ranges": [("All", 18, 120, "50", "100", ">=160", "Optimal: <100 mg/dL, High: >=160 mg/dL")],
            },
            {
                "observation": "VLDL Cholesterol", "category": "Laboratory", "abbr": "VLDL",
                "data_type": "Quantity", "unit": "mg/dL", "sample": "Serum",
                "ranges": [("All", 18, 120, "5", "30", ">40", "Normal very-low-density lipoprotein")],
            },

            # Renal Function Test (RFT)
            {
                "observation": "Blood Urea Nitrogen", "category": "Laboratory", "abbr": "BUN",
                "data_type": "Quantity", "unit": "mg/dL", "sample": "Serum",
                "ranges": [("All", 0, 120, "7", "20", ">30", "Normal blood urea nitrogen")],
            },
            {
                "observation": "Serum Creatinine", "category": "Laboratory", "abbr": "CREAT",
                "data_type": "Quantity", "unit": "mg/dL", "sample": "Serum",
                "ranges": [
                    ("Male", 18, 120, "0.74", "1.35", ">1.50", "Normal adult male serum creatinine"),
                    ("Female", 18, 120, "0.59", "1.04", ">1.20", "Normal adult female serum creatinine"),
                ],
            },
            {
                "observation": "Estimated GFR", "category": "Laboratory", "abbr": "eGFR",
                "data_type": "Quantity", "unit": "ml/min/1.73m2", "sample": "Serum",
                "ranges": [("All", 18, 120, "90", "140", "<60", "Normal >=90; <60 indicates renal impairment")],
            },
            {
                "observation": "Serum Uric Acid", "category": "Laboratory", "abbr": "URIC",
                "data_type": "Quantity", "unit": "mg/dL", "sample": "Serum",
                "ranges": [
                    ("Male", 18, 120, "3.4", "7.0", ">8.0", "Normal male uric acid"),
                    ("Female", 18, 120, "2.4", "6.0", ">7.0", "Normal female uric acid"),
                ],
            },
            {
                "observation": "Serum Sodium", "category": "Laboratory", "abbr": "Na+",
                "data_type": "Quantity", "unit": "mmol/L", "sample": "Serum",
                "ranges": [("All", 0, 120, "135", "145", "<130 or >150", "Normal serum electrolyte sodium")],
            },
            {
                "observation": "Serum Potassium", "category": "Laboratory", "abbr": "K+",
                "data_type": "Quantity", "unit": "mmol/L", "sample": "Serum",
                "ranges": [("All", 0, 120, "3.5", "5.0", "<3.0 or >5.5", "Normal serum electrolyte potassium")],
            },
            {
                "observation": "Serum Chloride", "category": "Laboratory", "abbr": "Cl-",
                "data_type": "Quantity", "unit": "mmol/L", "sample": "Serum",
                "ranges": [("All", 0, 120, "96", "106", "<90 or >112", "Normal serum electrolyte chloride")],
            },

            # Liver Function Test (LFT)
            {
                "observation": "Total Bilirubin", "category": "Laboratory", "abbr": "TBIL",
                "data_type": "Quantity", "unit": "mg/dL", "sample": "Serum",
                "ranges": [("All", 0, 120, "0.2", "1.2", ">2.0", "Normal total serum bilirubin")],
            },
            {
                "observation": "Direct Bilirubin", "category": "Laboratory", "abbr": "DBIL",
                "data_type": "Quantity", "unit": "mg/dL", "sample": "Serum",
                "ranges": [("All", 0, 120, "0.0", "0.3", ">0.5", "Normal conjugated direct bilirubin")],
            },
            {
                "observation": "AST / SGOT", "category": "Laboratory", "abbr": "AST",
                "data_type": "Quantity", "unit": "U/L", "sample": "Serum",
                "ranges": [("All", 0, 120, "10", "40", ">50", "Aspartate aminotransferase")],
            },
            {
                "observation": "ALT / SGPT", "category": "Laboratory", "abbr": "ALT",
                "data_type": "Quantity", "unit": "U/L", "sample": "Serum",
                "ranges": [("All", 0, 120, "7", "56", ">60", "Alanine aminotransferase")],
            },
            {
                "observation": "Alkaline Phosphatase", "category": "Laboratory", "abbr": "ALP",
                "data_type": "Quantity", "unit": "U/L", "sample": "Serum",
                "ranges": [("All", 18, 120, "44", "147", ">160", "Serum alkaline phosphatase")],
            },
            {
                "observation": "Total Protein", "category": "Laboratory", "abbr": "TP",
                "data_type": "Quantity", "unit": "g/dL", "sample": "Serum",
                "ranges": [("All", 0, 120, "6.0", "8.3", "<5.5 or >9.0", "Normal total serum protein")],
            },
            {
                "observation": "Serum Albumin", "category": "Laboratory", "abbr": "ALB",
                "data_type": "Quantity", "unit": "g/dL", "sample": "Serum",
                "ranges": [("All", 0, 120, "3.5", "5.0", "<3.0", "Normal serum albumin")],
            },

            # Thyroid Panel
            {
                "observation": "Thyroid Stimulating Hormone", "category": "Laboratory", "abbr": "TSH",
                "data_type": "Quantity", "unit": "uIU/mL", "sample": "Serum",
                "ranges": [("All", 18, 120, "0.4", "4.0", "<0.1 or >5.0", "Normal serum TSH")],
            },
            {
                "observation": "Free T3", "category": "Laboratory", "abbr": "FT3",
                "data_type": "Quantity", "unit": "pg/mL", "sample": "Serum",
                "ranges": [("All", 18, 120, "2.3", "4.2", "<1.8 or >4.8", "Normal free triiodothyronine")],
            },
            {
                "observation": "Free T4", "category": "Laboratory", "abbr": "FT4",
                "data_type": "Quantity", "unit": "ng/dL", "sample": "Serum",
                "ranges": [("All", 18, 120, "0.8", "1.8", "<0.6 or >2.2", "Normal free thyroxine")],
            },

            # Urinalysis Analytes (Qualitative / Select)
            {
                "observation": "Urine Color", "category": "Laboratory", "abbr": "U-COL",
                "data_type": "Select", "unit": "", "sample": "Urine",
                "options": "Pale Yellow\nStraw\nAmber\nDark Yellow\nRed\nBrown\nCloudy",
                "ranges": [],
            },
            {
                "observation": "Urine Clarity", "category": "Laboratory", "abbr": "U-CLA",
                "data_type": "Select", "unit": "", "sample": "Urine",
                "options": "Clear\nSlightly Hazy\nCloudy\nTurbid",
                "ranges": [],
            },
            {
                "observation": "Urine pH", "category": "Laboratory", "abbr": "U-pH",
                "data_type": "Quantity", "unit": "", "sample": "Urine",
                "ranges": [("All", 0, 120, "4.5", "8.0", "<4.5 or >8.5", "Normal fresh urine pH (4.5 - 8.0)")],
            },
            {
                "observation": "Urine Specific Gravity", "category": "Laboratory", "abbr": "U-SG",
                "data_type": "Quantity", "unit": "", "sample": "Urine",
                "ranges": [("All", 0, 120, "1.005", "1.030", "<1.002 or >1.035", "Urine concentration / specific gravity")],
            },
            {
                "observation": "Urine Protein", "category": "Laboratory", "abbr": "U-PRO",
                "data_type": "Select", "unit": "", "sample": "Urine",
                "options": "Negative\nTrace\n1+ (30 mg/dL)\n2+ (100 mg/dL)\n3+ (300 mg/dL)\n4+ (1000 mg/dL)",
                "ranges": [],
            },
            {
                "observation": "Urine Glucose", "category": "Laboratory", "abbr": "U-GLU",
                "data_type": "Select", "unit": "", "sample": "Urine",
                "options": "Negative\nTrace\n100 mg/dL\n250 mg/dL\n500 mg/dL\n>=1000 mg/dL",
                "ranges": [],
            },
            {
                "observation": "Urine Ketones", "category": "Laboratory", "abbr": "U-KET",
                "data_type": "Select", "unit": "", "sample": "Urine",
                "options": "Negative\nTrace\nSmall\nModerate\nLarge",
                "ranges": [],
            },
            {
                "observation": "Urine Leukocyte Esterase", "category": "Laboratory", "abbr": "U-LEU",
                "data_type": "Select", "unit": "", "sample": "Urine",
                "options": "Negative\nTrace\nSmall\nModerate\nLarge",
                "ranges": [],
            },
            {
                "observation": "Urine Nitrite", "category": "Laboratory", "abbr": "U-NIT",
                "data_type": "Boolean", "unit": "", "sample": "Urine",
                "options": "Negative\nPositive",
                "ranges": [],
            },

            # Coagulation & Cardiac
            {
                "observation": "Prothrombin Time", "category": "Laboratory", "abbr": "PT",
                "data_type": "Quantity", "unit": "sec", "sample": "Plasma",
                "ranges": [("All", 0, 120, "11.0", "13.5", ">15.0", "Normal prothrombin time")],
            },
            {
                "observation": "INR", "category": "Laboratory", "abbr": "INR",
                "data_type": "Quantity", "unit": "ratio", "sample": "Plasma",
                "ranges": [("All", 0, 120, "0.8", "1.1", ">1.3", "Normal non-anticoagulated INR")],
            },
            {
                "observation": "aPTT", "category": "Laboratory", "abbr": "aPTT",
                "data_type": "Quantity", "unit": "sec", "sample": "Plasma",
                "ranges": [("All", 0, 120, "25", "35", ">40", "Activated partial thromboplastin time")],
            },
            {
                "observation": "Troponin I", "category": "Laboratory", "abbr": "TROP-I",
                "data_type": "Quantity", "unit": "ng/mL", "sample": "Serum",
                "ranges": [("All", 0, 120, "0.00", "0.04", ">=0.04", "Cardiac troponin I myocardial injury marker")],
            },
            {
                "observation": "C-Reactive Protein", "category": "Laboratory", "abbr": "CRP",
                "data_type": "Quantity", "unit": "mg/L", "sample": "Serum",
                "ranges": [("All", 0, 120, "0.0", "5.0", ">10.0", "Acute phase systemic inflammation marker")],
            },
            {
                "observation": "Erythrocyte Sedimentation Rate", "category": "Laboratory", "abbr": "ESR",
                "data_type": "Quantity", "unit": "mm/hr", "sample": "Blood",
                "ranges": [
                    ("Male", 18, 120, "0", "15", ">20", "Normal adult male Westergren ESR"),
                    ("Female", 18, 120, "0", "20", ">25", "Normal adult female Westergren ESR"),
                ],
            },
            {
                "observation": "HbA1c", "category": "Laboratory", "abbr": "HbA1c",
                "data_type": "Quantity", "unit": "%", "sample": "Blood",
                "ranges": [("All", 0, 120, "4.0", "5.6", ">=6.5", "Normal: <5.7%, Prediabetes: 5.7-6.4%, Diabetes: >=6.5%")],
            },

            # Serology / Rapid Diagnostics
            {
                "observation": "HIV 1/2 Antibody / Antigen", "category": "Laboratory", "abbr": "HIV",
                "data_type": "Select", "unit": "", "sample": "Serum",
                "options": "Non-Reactive\nReactive\nIndeterminate",
                "ranges": [],
            },
            {
                "observation": "Hepatitis B Surface Antigen", "category": "Laboratory", "abbr": "HBsAg",
                "data_type": "Select", "unit": "", "sample": "Serum",
                "options": "Negative\nPositive",
                "ranges": [],
            },
            {
                "observation": "Hepatitis C Antibody", "category": "Laboratory", "abbr": "Anti-HCV",
                "data_type": "Select", "unit": "", "sample": "Serum",
                "options": "Negative\nPositive",
                "ranges": [],
            },
            {
                "observation": "Syphilis VDRL / RPR", "category": "Laboratory", "abbr": "VDRL",
                "data_type": "Select", "unit": "", "sample": "Serum",
                "options": "Non-Reactive\nReactive",
                "ranges": [],
            },
            {
                "observation": "Malaria Rapid Diagnostic Test", "category": "Laboratory", "abbr": "Malaria RDT",
                "data_type": "Select", "unit": "", "sample": "Blood",
                "options": "Negative\nP. falciparum Positive\nP. vivax Positive\nMixed (Pf + Pv) Positive",
                "ranges": [],
            },
            {
                "observation": "Widal Agglutination Test", "category": "Laboratory", "abbr": "Widal",
                "data_type": "Select", "unit": "", "sample": "Serum",
                "options": "Negative (< 1:80)\nBorderline (1:80)\nPositive (1:160)\nStrongly Positive (1:320+)",
                "ranges": [],
            },
        ]

        created_obs_count = 0
        created_ranges_count = 0

        for item in obs_definitions:
            tpl, created = ObservationTemplate.objects.get_or_create(
                observation=item["observation"],
                defaults={
                    "observation_category": item["category"],
                    "abbr": item["abbr"],
                    "permitted_data_type": item["data_type"],
                    "permitted_unit": item["unit"],
                    "sample_collection_required": bool(item["sample"]),
                    "description": f"Standard {item['category']} measurement: {item['observation']}",
                    "is_active": True,
                }
            )
            # Update attributes if they were empty
            tpl.observation_category = item["category"]
            tpl.permitted_data_type = item["data_type"]
            tpl.permitted_unit = item["unit"]
            tpl.abbr = item["abbr"]
            tpl.sample_collection_required = bool(item["sample"])
            tpl.save()
            created_obs_count += 1

            # Seed Reference Ranges
            for applies_to, age_f, age_t, norm_f, norm_t, abn_str, interp in item.get("ranges", []):
                rng, rng_created = ObservationReferenceRange.objects.get_or_create(
                    observation_template=tpl,
                    applies_to=applies_to,
                    defaults={
                        "age_from": Decimal(str(age_f)),
                        "age_to": Decimal(str(age_t)),
                        "normal_from": norm_f,
                        "normal_to": norm_t,
                        "abnormal_from": abn_str.split(" or ")[0] if " or " in abn_str else abn_str,
                        "abnormal_to": abn_str.split(" or ")[-1] if " or " in abn_str else "",
                        "short_interpretation": interp,
                    }
                )
                if rng_created:
                    created_ranges_count += 1

        self.stdout.write(f"  [OK] Seeded/Verified {created_obs_count} Observation Templates & {created_ranges_count} Reference Ranges")

        # ── 4. COMPOUND LAB TEST TEMPLATES ───────────────────────────────
        lab_test_templates = [
            {
                "name": "Complete Blood Count (CBC)",
                "type": "Compound",
                "sample": "Blood",
                "desc": "Automated hemogram covering erythron, leukon, and thrombocyte parameters.",
                "components": [
                    ("White Blood Cell Count", "WBC", "10^3/uL", "4.5", "11.0"),
                    ("Red Blood Cell Count", "RBC", "10^6/uL", "4.2", "5.8"),
                    ("Hemoglobin", "HGB", "g/dL", "12.0", "17.0"),
                    ("Hematocrit", "HCT", "%", "36.0", "50.0"),
                    ("Mean Corpuscular Volume", "MCV", "fl", "80.0", "100.0"),
                    ("Mean Corpuscular Hemoglobin", "MCH", "pg", "27.0", "33.0"),
                    ("Platelet Count", "PLT", "10^3/uL", "150", "450"),
                    ("Neutrophils Percentage", "NEUT%", "%", "40", "70"),
                    ("Lymphocytes Percentage", "LYMPH%", "%", "20", "40"),
                ],
            },
            {
                "name": "Lipid Profile",
                "type": "Compound",
                "sample": "Serum",
                "desc": "Complete lipid risk evaluation panel.",
                "components": [
                    ("Total Cholesterol", "CHOL", "mg/dL", "125", "200"),
                    ("Triglycerides", "TRIG", "mg/dL", "50", "150"),
                    ("HDL Cholesterol", "HDL", "mg/dL", "40", "70"),
                    ("LDL Cholesterol", "LDL", "mg/dL", "50", "100"),
                    ("VLDL Cholesterol", "VLDL", "mg/dL", "5", "30"),
                ],
            },
            {
                "name": "Renal Function Test (RFT / KFT)",
                "type": "Compound",
                "sample": "Serum",
                "desc": "Kidney function tests assessing urea, creatinine, eGFR, and electrolytes.",
                "components": [
                    ("Blood Urea Nitrogen", "BUN", "mg/dL", "7", "20"),
                    ("Serum Creatinine", "CREAT", "mg/dL", "0.6", "1.3"),
                    ("Estimated GFR", "eGFR", "ml/min/1.73m2", "90", "140"),
                    ("Serum Uric Acid", "URIC", "mg/dL", "2.5", "7.0"),
                    ("Serum Sodium", "Na+", "mmol/L", "135", "145"),
                    ("Serum Potassium", "K+", "mmol/L", "3.5", "5.0"),
                    ("Serum Chloride", "Cl-", "mmol/L", "96", "106"),
                ],
            },
            {
                "name": "Liver Function Test (LFT)",
                "type": "Compound",
                "sample": "Serum",
                "desc": "Hepatic enzyme and synthetic function panel.",
                "components": [
                    ("Total Bilirubin", "TBIL", "mg/dL", "0.2", "1.2"),
                    ("Direct Bilirubin", "DBIL", "mg/dL", "0.0", "0.3"),
                    ("AST / SGOT", "AST", "U/L", "10", "40"),
                    ("ALT / SGPT", "ALT", "U/L", "7", "56"),
                    ("Alkaline Phosphatase", "ALP", "U/L", "44", "147"),
                    ("Total Protein", "TP", "g/dL", "6.0", "8.3"),
                    ("Serum Albumin", "ALB", "g/dL", "3.5", "5.0"),
                ],
            },
            {
                "name": "Urinalysis (Routine & Microscopy)",
                "type": "Compound",
                "sample": "Urine",
                "desc": "Physical, chemical, and microscopic examination of urine.",
                "components": [
                    ("Urine pH", "U-pH", "", "4.5", "8.0"),
                    ("Urine Specific Gravity", "U-SG", "", "1.005", "1.030"),
                ],
            },
            {
                "name": "Thyroid Profile (TFT)",
                "type": "Compound",
                "sample": "Serum",
                "desc": "Evaluation of thyroid hormonal activity.",
                "components": [
                    ("Thyroid Stimulating Hormone", "TSH", "uIU/mL", "0.4", "4.0"),
                    ("Free T3", "FT3", "pg/mL", "2.3", "4.2"),
                    ("Free T4", "FT4", "ng/dL", "0.8", "1.8"),
                ],
            },
            {
                "name": "Coagulation Profile (PT/INR/aPTT)",
                "type": "Compound",
                "sample": "Plasma",
                "desc": "Hemostasis screening panel.",
                "components": [
                    ("Prothrombin Time", "PT", "sec", "11.0", "13.5"),
                    ("INR", "INR", "ratio", "0.8", "1.1"),
                    ("aPTT", "aPTT", "sec", "25", "35"),
                ],
            },
        ]

        for lt_data in lab_test_templates:
            sample_obj = sample_map.get(lt_data["sample"])
            lt, _ = LabTestTemplate.objects.get_or_create(
                lab_test_name=lt_data["name"],
                defaults={
                    "lab_test_code": lt_data["name"][:50],
                    "lab_test_template_type": lt_data["type"],
                    "sample": sample_obj,
                    "lab_test_description": lt_data["desc"],
                    "disabled": False,
                }
            )
            lt.lab_test_template_type = lt_data["type"]
            lt.sample = sample_obj
            lt.save()

            # Seed compound children as NormalTestTemplate
            for idx, (comp_name, comp_event, comp_uom_str, norm_from, norm_to) in enumerate(lt_data.get("components", [])):
                uom_obj = uom_map.get(comp_uom_str)
                NormalTestTemplate.objects.get_or_create(
                    parent_template=lt,
                    lab_test_event=comp_name,
                    defaults={
                        "idx": idx + 1,
                        "lab_test_uom": uom_obj,
                        "normal_range": f"{norm_from} - {norm_to}" if norm_from and norm_to else "",
                    }
                )

        self.stdout.write(f"  [OK] Seeded/Verified {len(lab_test_templates)} Compound Lab Test Templates")

        # ── 5. PHARMACY WAREHOUSE & STOCK DEMO DATA ──────────────────────
        pharmacy_wh, _ = PharmacyWarehouse.objects.get_or_create(
            warehouse_name="Main Pharmacy",
            defaults={"is_active": True}
        )

        medications_stock_plan = [
            # In-Stock Medications
            ("Amoxicillin 500mg", "Capsule", "Antibiotic", 150, Decimal("0.50")),
            ("Paracetamol 500mg", "Tablet", "Analgesic & Antipyretic", 500, Decimal("0.10")),
            ("Ibuprofen 400mg", "Tablet", "NSAID", 200, Decimal("0.15")),
            ("Metformin 500mg", "Tablet", "Antidiabetic", 300, Decimal("0.20")),
            ("Omeprazole 20mg", "Capsule", "Proton Pump Inhibitor", 180, Decimal("0.40")),
            ("Ciprofloxacin 500mg", "Tablet", "Fluoroquinolone Antibiotic", 120, Decimal("0.80")),
            ("Cetirizine 10mg", "Tablet", "Antihistamine", 250, Decimal("0.12")),
            ("Azithromycin 500mg", "Tablet", "Macrolide Antibiotic", 80, Decimal("1.20")),
            ("Salbutamol Inhaler 100mcg", "Inhaler", "Bronchodilator", 40, Decimal("5.00")),
            ("Oral Rehydration Salts (ORS)", "Powder", "Electrolyte Solution", 350, Decimal("0.30")),
            # Out-of-Stock Medications (0 qty on hand — for testing external pharmacy Rx paper flow)
            ("Ceftriaxone 1g Injection", "Injection", "Cephalosporin Antibiotic", 0, Decimal("4.50")),
            ("Insulin Glargine 100 IU/mL", "Injection", "Long-acting Insulin", 0, Decimal("18.00")),
            ("Atorvastatin 20mg", "Tablet", "Statin / Lipid Lowering", 0, Decimal("0.90")),
            ("Amoxicillin + Clavulanic Acid 625mg", "Tablet", "Penicillin Combination", 0, Decimal("1.50")),
            ("Eye Drops Moxifloxacin 0.5%", "Drops", "Ophthalmic Antibiotic", 0, Decimal("6.00")),
        ]

        # Ensure Dosage Forms exist
        for med_name, form_name, _, _, _ in medications_stock_plan:
            DosageForm.objects.get_or_create(dosage_form=form_name)

        for med_name, form_name, desc, qty, rate in medications_stock_plan:
            med_obj, _ = Medication.objects.get_or_create(
                generic_name=med_name,
                defaults={"abbr": med_name[:10], "reference_url": ""}
            )

            PharmacyStock.objects.update_or_create(
                warehouse=pharmacy_wh,
                item_code=med_name,
                defaults={
                    "medication": med_obj,
                    "item_name": med_name,
                    "item_group": "Pharmaceuticals",
                    "actual_qty": Decimal(str(qty)),
                    "valuation_rate": rate,
                    "reorder_level": Decimal("25.00"),
                    "stock_uom": "Nos",
                }
            )

        self.stdout.write(f"  [OK] Verified Pharmacy Warehouse & Seeded stock for {len(medications_stock_plan)} medications")
        from django.core.management import call_command
        call_command("seed_lab_catalog")
        self.stdout.write(self.style.SUCCESS("Comprehensive clinical diagnostic masters seeded successfully!"))
