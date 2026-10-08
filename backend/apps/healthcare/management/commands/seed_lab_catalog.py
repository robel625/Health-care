import os
from decimal import Decimal
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Seed extensive, professional clinical Lab Test Samples (50+) and Lab Test Templates (50+) with compound panels, normal ranges, and tube colors."

    def handle(self, *args, **options):
        self.stdout.write("=================================================================")
        self.stdout.write(" SEEDING EXPANDED CLINICAL LAB TEST SAMPLES & TEMPLATES")
        self.stdout.write("=================================================================")

        from apps.healthcare.models import (
            LabTestUOM,
            LabTestSample,
            SampleType,
            LabTestTemplate,
            NormalTestTemplate,
            MedicalDepartment,
        )
        from apps.setup.models import Company

        # ── 1. ENSURE UOMS ───────────────────────────────────────────────
        uoms_data = [
            ("ml", "Milliliter"),
            ("uL", "Microliter"),
            ("L", "Liter"),
            ("container", "Sterile Specimen Container"),
            ("swab", "Culture Swab"),
            ("slide", "Microscope Glass Slide"),
            ("tube", "Specimen Collection Tube"),
            ("drop", "Drop"),
            ("vial", "Transport Vial"),
            ("strip", "Urine Test Strip"),
            ("mg/dL", "Milligrams per Deciliter"),
            ("g/dL", "Grams per Deciliter"),
            ("g/L", "Grams per Liter"),
            ("mg/L", "Milligrams per Liter"),
            ("ug/dL", "Micrograms per Deciliter"),
            ("ng/dL", "Nanograms per Deciliter"),
            ("ng/mL", "Nanograms per Milliliter"),
            ("pg/mL", "Picograms per Milliliter"),
            ("mmol/L", "Millimoles per Liter"),
            ("umol/L", "Micromoles per Liter"),
            ("mEq/L", "Milliequivalents per Liter"),
            ("U/L", "Units per Liter"),
            ("IU/L", "International Units per Liter"),
            ("IU/mL", "International Units per Milliliter"),
            ("uIU/mL", "Micro International Units per Milliliter"),
            ("10^3/uL", "Thousand Cells per Microliter"),
            ("10^6/uL", "Million Cells per Microliter"),
            ("%", "Percentage"),
            ("fl", "Femtoliter"),
            ("pg", "Picogram"),
            ("sec", "Seconds"),
            ("ratio", "Normalized Ratio"),
            ("index", "Antibody Index / S/CO"),
            ("mm/hr", "Millimeters per Hour"),
            ("copies/mL", "Viral RNA/DNA Copies per Milliliter"),
            ("/HPF", "Per High Power Field"),
            ("/LPF", "Per Low Power Field"),
            ("mOsm/kg", "Milliosmoles per Kilogram"),
            ("ml/min/1.73m2", "Glomerular Filtration Rate"),
            ("beats/min", "Beats per Minute"),
            ("breaths/min", "Breaths per Minute"),
            ("mmHg", "Millimeters of Mercury"),
            (" deg C", "Degrees Celsius"),
        ]

        uom_map = {}
        for code, desc in uoms_data:
            obj, _ = LabTestUOM.objects.get_or_create(
                lab_test_uom=code,
                defaults={"uom_description": desc}
            )
            uom_map[code] = obj
        self.stdout.write(f"  [OK] Loaded/Verified {len(uoms_data)} Lab Test UOMs")

        # ── 2. ENSURE SAMPLE TYPES ───────────────────────────────────────
        sample_types_data = [
            "Blood", "Serum", "Plasma", "Urine", "Stool", "Sputum", "CSF",
            "Fluid", "Swab", "Tissue", "Bone Marrow", "Saliva", "Semen", "Stone", "Other"
        ]
        sample_type_map = {}
        for st_name in sample_types_data:
            obj, _ = SampleType.objects.get_or_create(sample_type=st_name)
            sample_type_map[st_name] = obj
        self.stdout.write(f"  [OK] Loaded/Verified {len(sample_types_data)} Sample Types")

        # ── 3. LAB TEST SAMPLES (50+ Clinical Specimens) ────────────────
        samples_catalog = [
            # Whole Blood & Tube Types
            ("Whole Blood (EDTA)", "ml", "Lavender", "Blood", "Whole blood collected in K2/K3 EDTA tube for hematology & molecular tests"),
            ("Whole Blood (Sodium Heparin)", "ml", "Green", "Blood", "Heparinized whole blood for cytogenetics, osmotic fragility, and blood gas"),
            ("Whole Blood (Lithium Heparin)", "ml", "Green", "Blood", "Whole blood for rapid plasma clinical chemistry assays"),
            ("Whole Blood (Sodium Citrate 3.2%)", "ml", "Light Blue", "Blood", "1:9 buffered citrate blood for coagulation cascade panels (PT, aPTT)"),
            ("Whole Blood (Sodium Fluoride / Oxalate)", "ml", "Gray", "Blood", "Glycolysis inhibitor tube for blood glucose and lactate"),
            ("Whole Blood (ACD Solution A/B)", "ml", "Yellow", "Blood", "Acid citrate dextrose for HLA phenotyping, paternity, and DNA banking"),
            ("Whole Blood (Trace Element Free)", "ml", "Royal Blue", "Blood", "Special low-metal tube for Lead, Arsenic, Mercury, Zinc, Copper"),
            ("Whole Blood (Blood Culture - Aerobic)", "vial", "Yellow", "Blood", "SPS blood culture bottle for aerobic bacterial isolation"),
            ("Whole Blood (Blood Culture - Anaerobic)", "vial", "Red", "Blood", "SPS blood culture bottle for anaerobic bacterial isolation"),
            ("Whole Blood (Pediatric Blood Culture)", "vial", "Pink", "Blood", "Low-volume pediatric blood culture bottle (1-3 mL)"),
            ("Capillary Blood (Fingerstick)", "ml", "Lavender", "Blood", "Micro-collection capillary tube for POC glucose, CBC, or bilirubin"),
            ("Capillary Blood (Heelstick)", "ml", "Gold", "Blood", "Neonatal heelstick specimen for metabolic newborn screening"),
            ("Arterial Blood (Heparinized Syringe)", "ml", "Green", "Blood", "Direct arterial puncture blood for blood gas (ABG) & lactate"),
            ("Cord Blood", "ml", "Lavender", "Blood", "Umbilical cord venous blood for direct Coombs test & neonatal typing"),

            # Serum & Plasma
            ("Serum (SST / Gel Separator)", "ml", "Gold", "Serum", "Clot activator with gel barrier for general biochemistry & serology"),
            ("Serum (Plain / No Additive)", "ml", "Red", "Serum", "Silicone-coated plain glass or plastic tube for drug levels & blood banking"),
            ("Serum (Rapid Clot Activator / Thrombin)", "ml", "Orange", "Serum", "Fast clotting tube for stat biochemistry tests"),
            ("Citrated Plasma (Platelet-Poor)", "ml", "Light Blue", "Plasma", "Double-centrifuged plasma for lupus anticoagulant & factor assays"),
            ("Heparinized Plasma", "ml", "Green", "Plasma", "Separated plasma from lithium heparin tube for stat panels"),

            # Urine Specimens
            ("Midstream Clean-Catch Urine", "ml", "Yellow", "Urine", "Fresh midstream urine for routine urinalysis, microscopy, and culture"),
            ("24-Hour Urine Specimen", "container", "Brown", "Urine", "24-hour pooled collection with/without preservative for protein & clearance"),
            ("Catheterized Urine Specimen", "ml", "Yellow", "Urine", "Urine collected via aseptic Foley or straight catheterization"),
            ("First-Morning Urine", "ml", "Yellow", "Urine", "Concentrated overnight specimen for microalbuminuria & pregnancy test"),
            ("Pediatric Bag Urine Collection", "ml", "Yellow", "Urine", "Urine collected using pediatric adhesive collection bag"),
            ("Suprapubic Urine Aspirate", "ml", "Clear", "Urine", "Aspiration needle specimen from bladder, gold standard for sterility"),

            # Body Fluids & Aspirates
            ("CSF (Cerebrospinal Fluid - Tube 1)", "ml", "Clear", "CSF", "Initial lumbar puncture aliquot for clinical chemistry & protein"),
            ("CSF (Cerebrospinal Fluid - Tube 2)", "ml", "Clear", "CSF", "Second LP aliquot for microbiology Gram stain and cultures"),
            ("CSF (Cerebrospinal Fluid - Tube 3)", "ml", "Clear", "CSF", "Third LP aliquot for cell count and manual differential"),
            ("CSF (Cerebrospinal Fluid - Tube 4)", "ml", "Clear", "CSF", "Fourth aliquot for viral PCR panels & specialized immunology"),
            ("Pleural Fluid (Thoracentesis)", "ml", "Clear", "Fluid", "Thoracentesis fluid to distinguish transudate from exudate"),
            ("Peritoneal Fluid (Ascitic Fluid)", "ml", "Clear", "Fluid", "Abdominal paracentesis fluid for SAAG, cell count, culture"),
            ("Synovial Fluid (Joint Aspirate)", "ml", "Clear", "Fluid", "Arthrocentesis joint fluid for polarized microscopy & crystals"),
            ("Pericardial Fluid", "ml", "Clear", "Fluid", "Pericardiocentesis fluid for effusion etiology & cytology"),
            ("Amniotic Fluid", "ml", "Brown", "Fluid", "Amniocentesis fluid protected from light for fetal lung maturity/karyotype"),
            ("Bronchoalveolar Lavage (BAL)", "ml", "Clear", "Fluid", "Bronchoscopy saline wash for fungal, viral, and PCP evaluation"),
            ("Fine Needle Aspirate (FNA Rinse)", "vial", "Clear", "Fluid", "FNA needle rinse in CytoLyt / PreservCyt solution for cytology"),
            ("Cyst Fluid Aspirate", "ml", "Clear", "Fluid", "Aspirated fluid from renal, thyroid, breast, or ovarian cysts"),
            ("Gastric Aspirate", "ml", "Clear", "Fluid", "Nasogastric tube aspirate for pH and occult blood"),

            # Microbiology Swabs & Transport Media
            ("Nasopharyngeal Swab (Viral Transport)", "swab", "White", "Swab", "Flocked flexible swab in VTM for COVID-19, Influenza, RSV"),
            ("Oropharyngeal / Throat Swab", "swab", "Red", "Swab", "Throat swab in Amies transport medium for Strep A and culture"),
            ("Nasal Swab (Anterior Nares)", "swab", "White", "Swab", "Bilateral anterior nares swab for MRSA surveillance screening"),
            ("Wound Swab (Superficial Exudate)", "swab", "Green", "Swab", "Surface wound or ulcer swab in Stuart transport medium"),
            ("Deep Wound Pus / Aspirate", "vial", "Clear", "Swab", "Anaerobic transport vial with needle aspirate of closed abscess"),
            ("Endocervical Swab (NAAT)", "swab", "White", "Swab", "Aptima / Cobas transport tube for Chlamydia & Gonorrhea PCR"),
            ("Vaginal Swab (Wet Mount / Culture)", "swab", "Pink", "Swab", "Vaginal discharge swab for BV, Trichomonas, Candida"),
            ("Urethral Swab", "swab", "Orange", "Swab", "Mini-tip swab for male urethritis & sexually transmitted infections"),
            ("Conjunctival Swab (Eye)", "swab", "White", "Swab", "Eye discharge swab for bacterial and adenoviral culture"),
            ("Ear Canal Swab (Otitis)", "swab", "White", "Swab", "External auditory canal swab for fungal and bacterial otitis"),
            ("Rectal Swab (Fecal Screen)", "swab", "Brown", "Swab", "Rectal mucosal swab for CRE, VRE, or enteric pathogen screening"),

            # Stool & Gastrointestinal
            ("Stool (Clean Cup / Unpreserved)", "container", "Brown", "Stool", "Fresh solid or liquid feces for occult blood, calprotectin, C. diff"),
            ("Stool (Cary-Blair Medium)", "vial", "Green", "Stool", "Fecal specimen in enteric transport medium for enteric stool culture"),
            ("Stool (SAF / Formalin Preserved)", "vial", "White", "Stool", "Preserved stool for concentration & ova and parasite examination"),

            # Respiratory Expectorations
            ("Sputum (Early Morning Expectorated)", "container", "Blue", "Sputum", "Deep cough morning sputum for routine culture and Gram stain"),
            ("Sputum (Acid-Fast Bacilli - AFB)", "container", "Blue", "Sputum", "Sputum specimen dedicated for Ziehl-Neelsen TB smear & GeneXpert"),
            ("Induced Sputum (Nebulized)", "container", "Blue", "Sputum", "Hypertonic saline induced sputum for Pneumocystis and TB"),
            ("Tracheal Suction Aspirate", "container", "Blue", "Sputum", "In-line mucous trap aspirate from intubated ventilated patient"),

            # Tissues, Cytology, Calculi
            ("Surgical Biopsy Tissue (Formalin 10%)", "container", "White", "Tissue", "Tissue immersed in 10% neutral buffered formalin for histopathology"),
            ("Fresh Tissue (Unfixed / Saline Gauze)", "container", "White", "Tissue", "Unfixed operative tissue for immediate intraoperative frozen section"),
            ("Cervical Cytology (Liquid-Based Pap)", "vial", "White", "Tissue", "ThinPrep or SurePath liquid cytology vial for Pap smear & HPV"),
            ("Bone Marrow Aspirate & Core Biopsy", "tube", "Blue", "Bone Marrow", "Aspirate in EDTA + core biopsy in B-5/formalin + air-dried smear slides"),
            ("Skin Scrapings / Nail Clippings", "container", "White", "Tissue", "Epidermal scales or subungual debris in sterile envelope for KOH mount"),
            ("Kidney Calculus / Urinary Stone", "container", "Clear", "Stone", "Dry surgical or voided stone for chemical crystallographic analysis"),
            ("Gallstones (Cholelith)", "container", "Clear", "Stone", "Biliary stones for macroscopic and chemical composition"),
            ("Saliva Specimen", "tube", "Clear", "Saliva", "Salivette collection tube for late-night salivary cortisol"),
            ("Semen Specimen", "container", "White", "Semen", "Sterile container specimen kept at 37 deg C for semen fertility analysis"),
        ]

        sample_map = {}
        created_samples_count = 0
        for name, uom_code, color, st_code, desc in samples_catalog:
            uom_obj = uom_map.get(uom_code)
            st_obj = sample_type_map.get(st_code)
            obj, created = LabTestSample.objects.get_or_create(
                sample=name,
                defaults={
                    "sample_uom": uom_obj,
                    "sample_type": st_obj,
                    "container_closure_color": color,
                }
            )
            if created:
                created_samples_count += 1
            else:
                # Update attributes if needed
                if not obj.sample_uom and uom_obj:
                    obj.sample_uom = uom_obj
                if not obj.sample_type and st_obj:
                    obj.sample_type = st_obj
                if not obj.container_closure_color:
                    obj.container_closure_color = color
                obj.save()
            sample_map[name] = obj

        total_samples = LabTestSample.objects.count()
        self.stdout.write(f"  [OK] Processed {len(samples_catalog)} Samples (Total in DB: {total_samples}, New: {created_samples_count})")

        # ── 4. DEPARTMENTS & ITEM GROUPS ─────────────────────────────────
        dept_names = ["Haematology", "Biochemistry", "Microbiology", "Clinical Pathology", "Endocrinology", "Serology", "Cardiology", "Diagnostic Imaging", "General Medicine"]
        dept_map = {}
        for dn in dept_names:
            dept_obj, _ = MedicalDepartment.objects.get_or_create(department=dn)
            dept_map[dn] = dept_obj

        group_map = {
            gn: gn
            for gn in ["Hematology", "Biochemistry", "Microbiology", "Clinical Pathology", "Endocrinology", "Cardiology", "Radiology", "Laboratory"]
        }

        # ── 5. LAB TEST TEMPLATES (50+ Medical Standard Catalogs) ────────
        templates_catalog = [
            # =============================================================
            # 1. HEMATOLOGY & COAGULATION
            # =============================================================
            {
                "name": "Complete Blood Count (CBC) with Differential",
                "type": "Compound",
                "dept": "Haematology",
                "group": "Hematology",
                "sample": "Whole Blood (EDTA)",
                "rate": Decimal("25.00"),
                "desc": "Automated 5-part differential complete hemogram evaluating red cells, white cells, and platelets.",
                "components": [
                    ("Hemoglobin", "g/dL", "13.0 - 17.0"),
                    ("Hematocrit (PCV)", "%", "40.0 - 52.0"),
                    ("Total Leukocyte Count (WBC)", "10^3/uL", "4.5 - 11.0"),
                    ("Red Blood Cell Count (RBC)", "10^6/uL", "4.5 - 5.9"),
                    ("Mean Corpuscular Volume (MCV)", "fl", "80.0 - 100.0"),
                    ("Mean Corpuscular Hemoglobin (MCH)", "pg", "27.0 - 33.0"),
                    ("MCHC", "g/dL", "32.0 - 36.0"),
                    ("Red Cell Distribution Width (RDW-CV)", "%", "11.5 - 14.5"),
                    ("Platelet Count", "10^3/uL", "150 - 450"),
                    ("Neutrophils %", "%", "40 - 75"),
                    ("Lymphocytes %", "%", "20 - 45"),
                    ("Monocytes %", "%", "2 - 10"),
                    ("Eosinophils %", "%", "1 - 6"),
                    ("Basophils %", "%", "0 - 1"),
                ]
            },
            {
                "name": "Erythrocyte Sedimentation Rate (ESR - Westergren)",
                "type": "Single",
                "dept": "Haematology",
                "group": "Hematology",
                "sample": "Whole Blood (EDTA)",
                "uom": "mm/hr",
                "range": "0 - 15 mm/hr (Males), 0 - 20 mm/hr (Females)",
                "rate": Decimal("10.00"),
                "desc": "Non-specific inflammatory marker measuring sedimentation rate of erythrocytes over 1 hour."
            },
            {
                "name": "Coagulation Profile (PT / INR / aPTT)",
                "type": "Compound",
                "dept": "Haematology",
                "group": "Hematology",
                "sample": "Whole Blood (Sodium Citrate 3.2%)",
                "rate": Decimal("35.00"),
                "desc": "Screening assessment of extrinsic and intrinsic coagulation pathways prior to surgery or during anticoagulation.",
                "components": [
                    ("Prothrombin Time (PT)", "sec", "11.0 - 13.5"),
                    ("INR (International Normalized Ratio)", "ratio", "0.8 - 1.2"),
                    ("Activated Partial Thromboplastin Time (aPTT)", "sec", "25.0 - 35.0"),
                    ("Control PT", "sec", "12.0 - 12.5"),
                ]
            },
            {
                "name": "D-Dimer Quantitative Assay",
                "type": "Single",
                "dept": "Haematology",
                "group": "Hematology",
                "sample": "Citrated Plasma (Platelet-Poor)",
                "uom": "ng/mL",
                "range": "< 500 ng/mL FEU",
                "rate": Decimal("40.00"),
                "desc": "Quantitative fibrin degradation product test for ruling out Deep Vein Thrombosis (DVT) and Pulmonary Embolism (PE)."
            },
            {
                "name": "ABO and Rh Blood Grouping with Crossmatch",
                "type": "Compound",
                "dept": "Haematology",
                "group": "Hematology",
                "sample": "Whole Blood (EDTA)",
                "rate": Decimal("20.00"),
                "desc": "Forward and reverse typing for ABO antigen and Rh(D) status with antibody screening.",
                "components": [
                    ("ABO Blood Group", "ratio", "A / B / AB / O"),
                    ("Rh(D) Factor", "ratio", "Positive / Negative"),
                    ("Direct Antiglobulin Test (DAT)", "ratio", "Negative"),
                ]
            },
            {
                "name": "Peripheral Blood Smear Examination (Manual PBS)",
                "type": "Descriptive",
                "dept": "Haematology",
                "group": "Hematology",
                "sample": "Whole Blood (EDTA)",
                "rate": Decimal("20.00"),
                "desc": "Microscopic evaluation of stained thin blood film for RBC poikilocytosis, anisocytosis, atypical leukocytes, and parasites."
            },
            {
                "name": "Reticulocyte Count and Index Panel",
                "type": "Compound",
                "dept": "Haematology",
                "group": "Hematology",
                "sample": "Whole Blood (EDTA)",
                "rate": Decimal("22.00"),
                "desc": "Supravital new methylene blue staining evaluating bone marrow erythropoietic response.",
                "components": [
                    ("Reticulocyte Count %", "%", "0.5 - 2.5"),
                    ("Absolute Reticulocyte Count", "10^3/uL", "25 - 100"),
                    ("Reticulocyte Production Index (RPI)", "ratio", "> 2.0"),
                ]
            },
            {
                "name": "Hemoglobin Electrophoresis (HPLC)",
                "type": "Compound",
                "dept": "Haematology",
                "group": "Hematology",
                "sample": "Whole Blood (EDTA)",
                "rate": Decimal("60.00"),
                "desc": "High-performance liquid chromatography separation for Thalassemia and Sickle Cell variants.",
                "components": [
                    ("Hemoglobin A (HbA0)", "%", "95.0 - 98.0"),
                    ("Hemoglobin A2 (HbA2)", "%", "1.5 - 3.5"),
                    ("Fetal Hemoglobin (HbF)", "%", "< 1.5"),
                    ("Hemoglobin S (HbS)", "%", "0.0 (Negative)"),
                ]
            },

            # =============================================================
            # 2. BIOCHEMISTRY & METABOLIC PANELS
            # =============================================================
            {
                "name": "Comprehensive Metabolic Panel (CMP - 14)",
                "type": "Compound",
                "dept": "Biochemistry",
                "group": "Biochemistry",
                "sample": "Serum (SST / Gel Separator)",
                "rate": Decimal("45.00"),
                "desc": "Broad clinical panel evaluating fluid balance, kidney function, liver function, and electrolytes.",
                "components": [
                    ("Serum Sodium (Na+)", "mmol/L", "136 - 145"),
                    ("Serum Potassium (K+)", "mmol/L", "3.5 - 5.1"),
                    ("Serum Chloride (Cl-)", "mmol/L", "98 - 107"),
                    ("Bicarbonate (CO2 Total)", "mmol/L", "22 - 29"),
                    ("Blood Urea Nitrogen (BUN)", "mg/dL", "7 - 20"),
                    ("Serum Creatinine", "mg/dL", "0.7 - 1.3"),
                    ("eGFR (CKD-EPI)", "ml/min/1.73m2", "> 90"),
                    ("Fasting Serum Glucose", "mg/dL", "70 - 99"),
                    ("Serum Calcium (Total)", "mg/dL", "8.5 - 10.5"),
                    ("Total Serum Protein", "g/dL", "6.4 - 8.3"),
                    ("Serum Albumin", "g/dL", "3.5 - 5.0"),
                    ("Total Bilirubin", "mg/dL", "0.2 - 1.2"),
                    ("Alkaline Phosphatase (ALP)", "U/L", "44 - 147"),
                    ("Alanine Aminotransferase (ALT/SGPT)", "U/L", "7 - 56"),
                    ("Aspartate Aminotransferase (AST/SGOT)", "U/L", "10 - 40"),
                ]
            },
            {
                "name": "Basic Metabolic Panel (BMP - 8)",
                "type": "Compound",
                "dept": "Biochemistry",
                "group": "Biochemistry",
                "sample": "Serum (SST / Gel Separator)",
                "rate": Decimal("30.00"),
                "desc": "Essential 8-test panel evaluating electrolytes, acid-base status, kidney function, and glucose.",
                "components": [
                    ("Sodium", "mmol/L", "136 - 145"),
                    ("Potassium", "mmol/L", "3.5 - 5.1"),
                    ("Chloride", "mmol/L", "98 - 107"),
                    ("Bicarbonate (HCO3)", "mmol/L", "22 - 29"),
                    ("Blood Urea Nitrogen", "mg/dL", "7 - 20"),
                    ("Creatinine", "mg/dL", "0.7 - 1.3"),
                    ("Glucose", "mg/dL", "70 - 99"),
                    ("Calcium Total", "mg/dL", "8.5 - 10.5"),
                ]
            },
            {
                "name": "Renal Function Test (RFT / KFT)",
                "type": "Compound",
                "dept": "Biochemistry",
                "group": "Biochemistry",
                "sample": "Serum (SST / Gel Separator)",
                "rate": Decimal("35.00"),
                "desc": "Kidney excretory function, nitrogenous waste elimination, and electrolyte balance.",
                "components": [
                    ("Serum Creatinine", "mg/dL", "0.7 - 1.3"),
                    ("Blood Urea", "mg/dL", "15 - 45"),
                    ("Blood Urea Nitrogen (BUN)", "mg/dL", "7 - 20"),
                    ("Uric Acid", "mg/dL", "3.5 - 7.2"),
                    ("Sodium (Na+)", "mmol/L", "136 - 145"),
                    ("Potassium (K+)", "mmol/L", "3.5 - 5.1"),
                    ("Estimated GFR", "ml/min/1.73m2", "> 90"),
                ]
            },
            {
                "name": "Liver Function Test (LFT / Hepatic Panel)",
                "type": "Compound",
                "dept": "Biochemistry",
                "group": "Biochemistry",
                "sample": "Serum (SST / Gel Separator)",
                "rate": Decimal("35.00"),
                "desc": "Diagnostic panel evaluating hepatocellular injury, biliary stasis, and hepatic protein synthesis.",
                "components": [
                    ("Total Bilirubin", "mg/dL", "0.2 - 1.2"),
                    ("Direct Bilirubin (Conjugated)", "mg/dL", "0.0 - 0.3"),
                    ("Indirect Bilirubin", "mg/dL", "0.2 - 0.9"),
                    ("ALT / SGPT", "U/L", "7 - 56"),
                    ("AST / SGOT", "U/L", "10 - 40"),
                    ("Alkaline Phosphatase (ALP)", "U/L", "44 - 147"),
                    ("Gamma-Glutamyl Transferase (GGT)", "U/L", "9 - 48"),
                    ("Total Protein", "g/dL", "6.4 - 8.3"),
                    ("Serum Albumin", "g/dL", "3.5 - 5.0"),
                    ("Serum Globulin", "g/dL", "2.3 - 3.5"),
                    ("A/G Ratio", "ratio", "1.2 - 2.2"),
                ]
            },
            {
                "name": "Lipid Profile / Coronary Heart Disease Risk Panel",
                "type": "Compound",
                "dept": "Biochemistry",
                "group": "Biochemistry",
                "sample": "Serum (SST / Gel Separator)",
                "rate": Decimal("30.00"),
                "desc": "Fasting cardiovascular risk profile measuring cholesterol fractions and atherogenic triglycerides.",
                "components": [
                    ("Total Cholesterol", "mg/dL", "< 200 (Desirable)"),
                    ("Triglycerides", "mg/dL", "< 150 (Normal)"),
                    ("HDL Cholesterol (Good)", "mg/dL", "> 40 (Male), > 50 (Female)"),
                    ("LDL Cholesterol (Calculated)", "mg/dL", "< 100 (Optimal)"),
                    ("VLDL Cholesterol", "mg/dL", "5 - 30"),
                    ("Total Cholesterol / HDL Ratio", "ratio", "< 4.5"),
                    ("Non-HDL Cholesterol", "mg/dL", "< 130"),
                ]
            },
            {
                "name": "Serum Electrolytes Panel (Na, K, Cl, HCO3)",
                "type": "Compound",
                "dept": "Biochemistry",
                "group": "Biochemistry",
                "sample": "Serum (SST / Gel Separator)",
                "rate": Decimal("25.00"),
                "desc": "Electrolyte and fluid balance determination by ion-selective electrode (ISE).",
                "components": [
                    ("Sodium (Na+)", "mmol/L", "136 - 145"),
                    ("Potassium (K+)", "mmol/L", "3.5 - 5.1"),
                    ("Chloride (Cl-)", "mmol/L", "98 - 107"),
                    ("Bicarbonate (HCO3-)", "mmol/L", "22 - 29"),
                    ("Anion Gap", "mEq/L", "8 - 16"),
                ]
            },
            {
                "name": "Arterial Blood Gas (ABG) with Lactate",
                "type": "Compound",
                "dept": "Biochemistry",
                "group": "Biochemistry",
                "sample": "Arterial Blood (Heparinized Syringe)",
                "rate": Decimal("50.00"),
                "desc": "Critical care evaluation of oxygenation, alveolar ventilation, acid-base disorders, and tissue perfusion.",
                "components": [
                    ("pH (Arterial)", "ratio", "7.35 - 7.45"),
                    ("pCO2 (Partial Pressure CO2)", "mmHg", "35.0 - 45.0"),
                    ("pO2 (Partial Pressure O2)", "mmHg", "80.0 - 100.0"),
                    ("Actual Bicarbonate (HCO3)", "mmol/L", "22.0 - 26.0"),
                    ("Base Excess (BE)", "mmol/L", "-2.0 to +2.0"),
                    ("Oxygen Saturation (SaO2)", "%", "95.0 - 99.0"),
                    ("Arterial Lactate", "mmol/L", "0.5 - 2.0"),
                ]
            },
            {
                "name": "Pancreatic Enzyme Panel (Amylase & Lipase)",
                "type": "Compound",
                "dept": "Biochemistry",
                "group": "Biochemistry",
                "sample": "Serum (SST / Gel Separator)",
                "rate": Decimal("35.00"),
                "desc": "Serum amylase and pancreatic-specific lipase for investigation of acute pancreatitis and epigastric pain.",
                "components": [
                    ("Serum Amylase", "U/L", "28 - 100"),
                    ("Serum Lipase", "U/L", "13 - 60"),
                ]
            },
            {
                "name": "Serum Iron Studies Panel",
                "type": "Compound",
                "dept": "Biochemistry",
                "group": "Biochemistry",
                "sample": "Serum (SST / Gel Separator)",
                "rate": Decimal("45.00"),
                "desc": "Total body iron reserves assessment for microcytic anemia, hemochromatosis, and chronic disease.",
                "components": [
                    ("Serum Iron", "ug/dL", "60 - 170"),
                    ("Total Iron Binding Capacity (TIBC)", "ug/dL", "240 - 450"),
                    ("Transferrin Saturation %", "%", "20 - 50"),
                    ("Serum Ferritin", "ng/mL", "30 - 400 (Male), 15 - 150 (Female)"),
                ]
            },
            {
                "name": "Bone & Mineral Metabolism Profile",
                "type": "Compound",
                "dept": "Biochemistry",
                "group": "Biochemistry",
                "sample": "Serum (SST / Gel Separator)",
                "rate": Decimal("40.00"),
                "desc": "Evaluation of calcium homeostasis, osteomalacia, osteoporosis, and parathyroid gland activity.",
                "components": [
                    ("Total Calcium", "mg/dL", "8.5 - 10.5"),
                    ("Ionized Calcium", "mmol/L", "1.15 - 1.33"),
                    ("Inorganic Phosphorus", "mg/dL", "2.5 - 4.5"),
                    ("Serum Magnesium", "mg/dL", "1.7 - 2.2"),
                    ("Alkaline Phosphatase (ALP)", "U/L", "44 - 147"),
                ]
            },
            {
                "name": "Serum Uric Acid Quantitative",
                "type": "Single",
                "dept": "Biochemistry",
                "group": "Biochemistry",
                "sample": "Serum (SST / Gel Separator)",
                "uom": "mg/dL",
                "range": "3.5 - 7.2 mg/dL (Male), 2.6 - 6.0 mg/dL (Female)",
                "rate": Decimal("15.00"),
                "desc": "Quantitative measurement for diagnosis of gouty arthritis and monitoring tumor lysis syndrome."
            },
            {
                "name": "Lactate Dehydrogenase (LDH Total)",
                "type": "Single",
                "dept": "Biochemistry",
                "group": "Biochemistry",
                "sample": "Serum (SST / Gel Separator)",
                "uom": "U/L",
                "range": "140 - 280 U/L",
                "rate": Decimal("18.00"),
                "desc": "Intracellular enzyme elevated in hemolysis, tissue necrosis, myocardial infarction, and lymphoma."
            },

            # =============================================================
            # 3. CARDIAC BIOMARKERS
            # =============================================================
            {
                "name": "Cardiac Troponin I High-Sensitivity (hs-cTnI)",
                "type": "Single",
                "dept": "Biochemistry",
                "group": "Cardiology",
                "sample": "Serum (SST / Gel Separator)",
                "uom": "ng/mL",
                "range": "< 0.04 ng/mL (99th percentile cutoff)",
                "rate": Decimal("50.00"),
                "desc": "Gold-standard ultra-sensitive myocardial necrosis biomarker for Acute Myocardial Infarction (AMI)."
            },
            {
                "name": "Cardiac Markers Panel (Troponin I / CK-MB / Myoglobin)",
                "type": "Compound",
                "dept": "Biochemistry",
                "group": "Cardiology",
                "sample": "Serum (SST / Gel Separator)",
                "rate": Decimal("75.00"),
                "desc": "Combined chest pain evaluation panel for acute coronary syndrome stratification.",
                "components": [
                    ("hs-Troponin I", "ng/mL", "< 0.04"),
                    ("CK-MB Mass", "ng/mL", "0.0 - 5.0"),
                    ("Myoglobin", "ng/mL", "25 - 72"),
                    ("CPK (Total Creatine Kinase)", "U/L", "38 - 174"),
                ]
            },
            {
                "name": "NT-proBNP (N-Terminal pro-B-Type Natriuretic Peptide)",
                "type": "Single",
                "dept": "Biochemistry",
                "group": "Cardiology",
                "sample": "Serum (SST / Gel Separator)",
                "uom": "pg/mL",
                "range": "< 125 pg/mL (<75y), < 450 pg/mL (>75y)",
                "rate": Decimal("65.00"),
                "desc": "Ventricular neurohormone for diagnosis and severity monitoring of Congestive Heart Failure (CHF)."
            },
            {
                "name": "High-Sensitivity C-Reactive Protein (hs-CRP)",
                "type": "Single",
                "dept": "Biochemistry",
                "group": "Cardiology",
                "sample": "Serum (SST / Gel Separator)",
                "uom": "mg/L",
                "range": "< 1.0 (Low Risk), 1.0 - 3.0 (Average), > 3.0 (High Risk)",
                "rate": Decimal("25.00"),
                "desc": "Microvascular cardiovascular inflammation biomarker for atherogenic risk stratification."
            },

            # =============================================================
            # 4. ENDOCRINOLOGY, HORMONES & VITAMINS
            # =============================================================
            {
                "name": "Thyroid Profile Comprehensive (T3, T4, TSH, FT3, FT4)",
                "type": "Compound",
                "dept": "Endocrinology",
                "group": "Endocrinology",
                "sample": "Serum (SST / Gel Separator)",
                "rate": Decimal("45.00"),
                "desc": "Complete pituitary-thyroid hormonal axis evaluation for hypo/hyperthyroidism.",
                "components": [
                    ("TSH (Thyroid Stimulating Hormone)", "uIU/mL", "0.4 - 4.0"),
                    ("Total Triiodothyronine (T3)", "ng/dL", "80 - 200"),
                    ("Total Thyroxine (T4)", "ug/dL", "5.1 - 14.1"),
                    ("Free T3 (FT3)", "pg/mL", "2.3 - 4.2"),
                    ("Free T4 (FT4)", "ng/dL", "0.8 - 1.8"),
                ]
            },
            {
                "name": "Glycated Hemoglobin (HbA1c) Panel",
                "type": "Compound",
                "dept": "Biochemistry",
                "group": "Endocrinology",
                "sample": "Whole Blood (EDTA)",
                "rate": Decimal("30.00"),
                "desc": "Reflects mean 3-month glycemic control in diabetic patients via ion-exchange HPLC.",
                "components": [
                    ("HbA1c (Glycosylated Hemoglobin)", "%", "< 5.7 (Normal), 5.7 - 6.4 (Prediabetes), >= 6.5 (Diabetes)"),
                    ("Estimated Average Glucose (eAG)", "mg/dL", "97 - 126 mg/dL"),
                ]
            },
            {
                "name": "Fasting & Postprandial Blood Glucose (FBS / PPBS)",
                "type": "Compound",
                "dept": "Biochemistry",
                "group": "Endocrinology",
                "sample": "Whole Blood (Sodium Fluoride / Oxalate)",
                "rate": Decimal("15.00"),
                "desc": "Diagnostic screening for diabetes mellitus with paired fasting and 2-hour post-meal glucose.",
                "components": [
                    ("Fasting Blood Sugar (FBS)", "mg/dL", "70 - 99 (Normal), 100 - 125 (Prediabetes), >= 126 (Diabetes)"),
                    ("Postprandial Blood Sugar (PPBS - 2hr)", "mg/dL", "< 140 (Normal), 140 - 199 (Impaired), >= 200 (Diabetes)"),
                ]
            },
            {
                "name": "25-Hydroxy Vitamin D (Total D2 + D3)",
                "type": "Single",
                "dept": "Endocrinology",
                "group": "Endocrinology",
                "sample": "Serum (SST / Gel Separator)",
                "uom": "ng/mL",
                "range": "< 20 (Deficient), 20 - 30 (Insufficient), 30 - 100 (Sufficiency)",
                "rate": Decimal("40.00"),
                "desc": "Chemiluminescent immunoassay measuring circulating vitamin D reserves."
            },
            {
                "name": "Vitamin B12 & Folate Combined Panel",
                "type": "Compound",
                "dept": "Endocrinology",
                "group": "Endocrinology",
                "sample": "Serum (SST / Gel Separator)",
                "rate": Decimal("50.00"),
                "desc": "Diagnostic workup for megaloblastic macrocytic anemia and peripheral neuropathy.",
                "components": [
                    ("Serum Vitamin B12 (Cobalamin)", "pg/mL", "200 - 900"),
                    ("Serum Folate (Folic Acid)", "ng/mL", "4.0 - 20.0"),
                ]
            },
            {
                "name": "Female Reproductive Hormone Panel (Day 2/3)",
                "type": "Compound",
                "dept": "Endocrinology",
                "group": "Endocrinology",
                "sample": "Serum (SST / Gel Separator)",
                "rate": Decimal("65.00"),
                "desc": "Ovarian reserve and pituitary gonadotropin panel for infertility, amenorrhea, and PCOS.",
                "components": [
                    ("Follicle Stimulating Hormone (FSH)", "mIU/mL", "3.5 - 12.5 (Follicular)"),
                    ("Luteinizing Hormone (LH)", "mIU/mL", "2.4 - 12.6 (Follicular)"),
                    ("Estradiol (E2)", "pg/mL", "20 - 150 (Follicular)"),
                    ("Serum Prolactin", "ng/mL", "4.8 - 23.3 (Non-pregnant)"),
                ]
            },
            {
                "name": "Testosterone Total and Free Panel (Male)",
                "type": "Compound",
                "dept": "Endocrinology",
                "group": "Endocrinology",
                "sample": "Serum (SST / Gel Separator)",
                "rate": Decimal("55.00"),
                "desc": "Morning androgen evaluation for hypogonadism, erectile dysfunction, and fatigue.",
                "components": [
                    ("Total Testosterone", "ng/dL", "300 - 1000"),
                    ("Free Testosterone", "pg/mL", "9.0 - 30.0"),
                    ("Sex Hormone Binding Globulin (SHBG)", "nmol/L", "10 - 57"),
                ]
            },
            {
                "name": "Serum Cortisol (Morning 8 AM & Evening 4 PM)",
                "type": "Compound",
                "dept": "Endocrinology",
                "group": "Endocrinology",
                "sample": "Serum (SST / Gel Separator)",
                "rate": Decimal("40.00"),
                "desc": "Adrenal glucocorticoid diurnal rhythm for Cushing's syndrome and Addison's disease.",
                "components": [
                    ("Morning Cortisol (8:00 AM)", "ug/dL", "6.2 - 19.4"),
                    ("Evening Cortisol (4:00 PM)", "ug/dL", "2.3 - 11.9"),
                ]
            },
            {
                "name": "Beta-hCG Quantitative (Pregnancy / Tumor Marker)",
                "type": "Single",
                "dept": "Endocrinology",
                "group": "Endocrinology",
                "sample": "Serum (SST / Gel Separator)",
                "uom": "mIU/mL",
                "range": "< 5.0 (Non-pregnant), > 25.0 (Positive Pregnancy)",
                "rate": Decimal("30.00"),
                "desc": "Quantitation of human chorionic gonadotropin for ectopic pregnancy, gestational age, and choriocarcinoma."
            },
            {
                "name": "Prostate Specific Antigen (PSA Total & Free)",
                "type": "Compound",
                "dept": "Endocrinology",
                "group": "Endocrinology",
                "sample": "Serum (SST / Gel Separator)",
                "rate": Decimal("45.00"),
                "desc": "Screening for prostate adenocarcinoma and benign prostatic hyperplasia (BPH).",
                "components": [
                    ("Total PSA", "ng/mL", "< 4.0"),
                    ("Free PSA", "ng/mL", "0.2 - 0.9"),
                    ("Free / Total PSA Ratio", "%", "> 25% (Low Risk of Malignancy)"),
                ]
            },

            # =============================================================
            # 5. INFECTIOUS DISEASE & SEROLOGY
            # =============================================================
            {
                "name": "Viral Hepatitis Comprehensive Panel (Hep A, B, C)",
                "type": "Compound",
                "dept": "Serology",
                "group": "Microbiology",
                "sample": "Serum (SST / Gel Separator)",
                "rate": Decimal("70.00"),
                "desc": "Serological screening for acute and chronic viral hepatitides.",
                "components": [
                    ("Hepatitis B Surface Antigen (HBsAg)", "index", "< 1.0 (Non-Reactive)"),
                    ("Hepatitis B Surface Antibody (Anti-HBs)", "mIU/mL", ">= 10.0 (Immune/Protected)"),
                    ("Hepatitis B Core Total (Anti-HBc)", "index", "Non-Reactive"),
                    ("Hepatitis C Antibody (Anti-HCV Total)", "index", "< 1.0 (Non-Reactive)"),
                    ("Hepatitis A IgM Antibody (Anti-HAV IgM)", "index", "< 1.0 (Non-Reactive)"),
                ]
            },
            {
                "name": "HIV 1 & 2 4th Generation Ag/Ab Combination Screen",
                "type": "Single",
                "dept": "Serology",
                "group": "Microbiology",
                "sample": "Serum (SST / Gel Separator)",
                "uom": "index",
                "range": "< 1.0 (Non-Reactive / Negative)",
                "rate": Decimal("30.00"),
                "desc": "Simultaneous detection of HIV-1 p24 antigen and antibodies to HIV-1 (Groups M and O) and HIV-2."
            },
            {
                "name": "Syphilis Serology (RPR Titer & TPHA)",
                "type": "Compound",
                "dept": "Serology",
                "group": "Microbiology",
                "sample": "Serum (SST / Gel Separator)",
                "rate": Decimal("25.00"),
                "desc": "Non-treponemal reagin screening followed by confirmatory Treponema pallidum hemagglutination.",
                "components": [
                    ("Rapid Plasma Reagin (RPR)", "ratio", "Non-Reactive"),
                    ("TPHA Confirmatory Antibody", "ratio", "Non-Reactive"),
                ]
            },
            {
                "name": "Widal Agglutination Slide & Tube Test (Enteric Fever)",
                "type": "Compound",
                "dept": "Serology",
                "group": "Microbiology",
                "sample": "Serum (SST / Gel Separator)",
                "rate": Decimal("20.00"),
                "desc": "Diagnostic antibody titers for Salmonella enterica serovars Typhi and Paratyphi.",
                "components": [
                    ("S. Typhi 'O' Antigen Titer", "ratio", "< 1:80 (Normal Baseline)"),
                    ("S. Typhi 'H' Antigen Titer", "ratio", "< 1:160 (Normal Baseline)"),
                    ("S. Paratyphi 'AH' Titer", "ratio", "< 1:80"),
                    ("S. Paratyphi 'BH' Titer", "ratio", "< 1:80"),
                ]
            },
            {
                "name": "Dengue Duo Panel (NS1 Antigen + IgM/IgG Antibodies)",
                "type": "Compound",
                "dept": "Serology",
                "group": "Microbiology",
                "sample": "Serum (SST / Gel Separator)",
                "rate": Decimal("40.00"),
                "desc": "Early acute phase (Day 1-5) NS1 viral antigen with subsequent IgM/IgG seroconversion antibodies.",
                "components": [
                    ("Dengue NS1 Antigen", "ratio", "Negative"),
                    ("Dengue IgM Antibody (Acute)", "ratio", "Negative"),
                    ("Dengue IgG Antibody (Past)", "ratio", "Negative"),
                ]
            },
            {
                "name": "Malaria Rapid Antigen & Blood Film Examination",
                "type": "Compound",
                "dept": "Haematology",
                "group": "Hematology",
                "sample": "Whole Blood (EDTA)",
                "rate": Decimal("25.00"),
                "desc": "Combined immunochromatographic Pf/Pv antigen test and Giemsa-stained thick/thin blood smears.",
                "components": [
                    ("Plasmodium falciparum (HRP-II Ag)", "ratio", "Negative"),
                    ("Plasmodium vivax (pLDH Ag)", "ratio", "Negative"),
                    ("Thick & Thin Smear for Parasites", "ratio", "No hemoparasites seen"),
                    ("Parasitemia Percentage", "%", "0.0%"),
                ]
            },
            {
                "name": "Autoimmune & Rheumatoid Arthritis Panel (RF + Anti-CCP + ANA)",
                "type": "Compound",
                "dept": "Serology",
                "group": "Biochemistry",
                "sample": "Serum (SST / Gel Separator)",
                "rate": Decimal("65.00"),
                "desc": "Investigation of autoimmune polyarthritis, SLE, and erosive rheumatoid disease.",
                "components": [
                    ("Rheumatoid Factor (RF Quantitative)", "IU/mL", "< 14.0"),
                    ("Anti-Cyclic Citrullinated Peptide (Anti-CCP)", "U/mL", "< 20.0 (Negative)"),
                    ("Antinuclear Antibodies (ANA IFA / Screen)", "index", "Negative (< 1:80)"),
                ]
            },
            {
                "name": "COVID-19 / Influenza A & B / RSV Multiplex Real-Time PCR",
                "type": "Compound",
                "dept": "Microbiology",
                "group": "Microbiology",
                "sample": "Nasopharyngeal Swab (Viral Transport)",
                "rate": Decimal("85.00"),
                "desc": "Simultaneous qualitative multiplex molecular RNA amplification of upper respiratory viral pathogens.",
                "components": [
                    ("SARS-CoV-2 (COVID-19) RNA", "ratio", "Not Detected"),
                    ("Influenza A Virus RNA", "ratio", "Not Detected"),
                    ("Influenza B Virus RNA", "ratio", "Not Detected"),
                    ("Respiratory Syncytial Virus (RSV) RNA", "ratio", "Not Detected"),
                ]
            },
            {
                "name": "Procalcitonin (PCT) Sepsis Biomarker",
                "type": "Single",
                "dept": "Biochemistry",
                "group": "Biochemistry",
                "sample": "Serum (SST / Gel Separator)",
                "uom": "ng/mL",
                "range": "< 0.10 (Normal), 0.5 - 2.0 (Systemic Infection Risk), > 2.0 (Severe Sepsis)",
                "rate": Decimal("55.00"),
                "desc": "Calcitonin precursor elevated in systemic bacterial infection and bacteremia, guides antibiotic stewardship."
            },

            # =============================================================
            # 6. URINALYSIS, STOOL & BODY FLUIDS
            # =============================================================
            {
                "name": "Urinalysis Routine & Microscopic Examination (R&M)",
                "type": "Compound",
                "dept": "Clinical Pathology",
                "group": "Clinical Pathology",
                "sample": "Midstream Clean-Catch Urine",
                "rate": Decimal("15.00"),
                "desc": "Automated dipstick reflectance chemistry and microscopic examination of centrifuged sediment.",
                "components": [
                    ("Color", "ratio", "Pale Yellow / Straw"),
                    ("Clarity / Appearance", "ratio", "Clear"),
                    ("Specific Gravity", "ratio", "1.005 - 1.030"),
                    ("pH", "ratio", "5.0 - 8.0"),
                    ("Urine Protein", "mg/dL", "Negative"),
                    ("Urine Glucose", "mg/dL", "Negative"),
                    ("Urine Ketones", "mg/dL", "Negative"),
                    ("Urine Bilirubin", "ratio", "Negative"),
                    ("Urine Blood / Hemoglobin", "ratio", "Negative"),
                    ("Urine Nitrite", "ratio", "Negative"),
                    ("Leukocyte Esterase", "ratio", "Negative"),
                    ("RBC (Microscopy)", "/HPF", "0 - 2 /HPF"),
                    ("WBC / Pus Cells (Microscopy)", "/HPF", "0 - 5 /HPF"),
                    ("Epithelial Cells", "/HPF", "0 - 5 /HPF"),
                    ("Casts", "/LPF", "None seen (Occasional hyaline)"),
                    ("Crystals", "/HPF", "None seen"),
                    ("Bacteria", "/HPF", "Absent / None"),
                ]
            },
            {
                "name": "Urine Culture and Antimicrobial Sensitivity (C&S)",
                "type": "Descriptive",
                "dept": "Microbiology",
                "group": "Microbiology",
                "sample": "Midstream Clean-Catch Urine",
                "rate": Decimal("35.00"),
                "desc": "Quantitative bacterial culture, colony count (CFU/mL), identification, and Kirby-Bauer / MIC susceptibility."
            },
            {
                "name": "Stool Routine & Occult Blood Examination (R&M + FOBT)",
                "type": "Compound",
                "dept": "Clinical Pathology",
                "group": "Clinical Pathology",
                "sample": "Stool (Clean Cup / Unpreserved)",
                "rate": Decimal("20.00"),
                "desc": "Macroscopic consistency, wet mount for parasites, and immunochemical fecal occult blood testing.",
                "components": [
                    ("Consistency", "ratio", "Formed / Semi-formed"),
                    ("Color", "ratio", "Brown"),
                    ("Mucus", "ratio", "Absent"),
                    ("Fecal Occult Blood (FOBT / iFOBT)", "ratio", "Negative"),
                    ("Red Blood Cells", "/HPF", "Nil / None"),
                    ("Pus Cells / Leukocytes", "/HPF", "0 - 2 /HPF"),
                    ("Ova & Parasites / Cysts", "ratio", "No ova or parasites seen"),
                ]
            },
            {
                "name": "Stool Culture for Enteric Pathogens",
                "type": "Descriptive",
                "dept": "Microbiology",
                "group": "Microbiology",
                "sample": "Stool (Cary-Blair Medium)",
                "rate": Decimal("35.00"),
                "desc": "Selective isolation of Salmonella, Shigella, Campylobacter, and Shiga toxin-producing E. coli."
            },
            {
                "name": "Sputum for Acid Fast Bacilli (AFB Smear / GeneXpert TB)",
                "type": "Descriptive",
                "dept": "Microbiology",
                "group": "Microbiology",
                "sample": "Sputum (Acid-Fast Bacilli - AFB)",
                "rate": Decimal("40.00"),
                "desc": "Ziehl-Neelsen / Auramine fluorochrome microscopy and automated real-time PCR for Mycobacterium tuberculosis & Rifampicin resistance."
            },
            {
                "name": "Blood Culture & Sensitivity (Aerobic & Anaerobic)",
                "type": "Descriptive",
                "dept": "Microbiology",
                "group": "Microbiology",
                "sample": "Whole Blood (Blood Culture - Aerobic)",
                "rate": Decimal("60.00"),
                "desc": "Continuous automated bottle monitoring up to 5 days with identification and MIC susceptibility for bacteremia."
            },
            {
                "name": "Wound Swab Culture and Antimicrobial Sensitivity",
                "type": "Descriptive",
                "dept": "Microbiology",
                "group": "Microbiology",
                "sample": "Wound Swab (Superficial Exudate)",
                "rate": Decimal("35.00"),
                "desc": "Gram stain morphology followed by quantitative aerobic and anaerobic culture with antibiotic sensitivity profiling."
            },
            {
                "name": "Cerebrospinal Fluid (CSF) Analysis Comprehensive",
                "type": "Compound",
                "dept": "Clinical Pathology",
                "group": "Clinical Pathology",
                "sample": "CSF (Cerebrospinal Fluid - Tube 1)",
                "rate": Decimal("55.00"),
                "desc": "Cytological cell count, protein, glucose, and microbiological staining for acute meningitis workup.",
                "components": [
                    ("Appearance", "ratio", "Clear, colorless"),
                    ("Total Leukocyte Count (CSF)", "cells/mcL", "0 - 5 (Adults)"),
                    ("Polymorphs (Neutrophils)", "%", "0%"),
                    ("Lymphocytes", "%", "60 - 100%"),
                    ("CSF Protein", "mg/dL", "15 - 45"),
                    ("CSF Glucose", "mg/dL", "40 - 70 (or 60% of serum glucose)"),
                    ("CSF Chloride", "mmol/L", "118 - 132"),
                ]
            },
            {
                "name": "Semen Analysis (WHO 6th Edition Criteria)",
                "type": "Compound",
                "dept": "Clinical Pathology",
                "group": "Clinical Pathology",
                "sample": "Semen Specimen",
                "rate": Decimal("45.00"),
                "desc": "Standardized evaluation of male fertility measuring volume, concentration, progressive motility, and strict morphology.",
                "components": [
                    ("Liquefaction Time", "min", "< 60 minutes"),
                    ("Semen Volume", "ml", ">= 1.4 mL"),
                    ("Sperm Concentration", "10^6/uL", ">= 16.0 Million/mL"),
                    ("Total Sperm Count per Ejaculate", "10^6/uL", ">= 39.0 Million"),
                    ("Total Motility (PR + NP)", "%", ">= 42%"),
                    ("Progressive Motility (PR)", "%", ">= 30%"),
                    ("Normal Sperm Morphology", "%", ">= 4.0%"),
                    ("Vitality (Live Sperm)", "%", ">= 54%"),
                ]
            },

            # =============================================================
            # 7. TUMOR MARKERS & SPECIAL DIAGNOSTICS
            # =============================================================
            {
                "name": "Tumor Markers Comprehensive Panel (CEA, CA125, CA19-9, AFP)",
                "type": "Compound",
                "dept": "Biochemistry",
                "group": "Biochemistry",
                "sample": "Serum (SST / Gel Separator)",
                "rate": Decimal("90.00"),
                "desc": "Serum oncological biomarker panel for gastrointestinal, ovarian, pancreatic, and hepatocellular carcinomas.",
                "components": [
                    ("Carcinoembryonic Antigen (CEA)", "ng/mL", "< 3.0 (Non-smokers), < 5.0 (Smokers)"),
                    ("Cancer Antigen 125 (CA-125)", "U/mL", "< 35.0"),
                    ("Carbohydrate Antigen 19-9 (CA 19-9)", "U/mL", "< 37.0"),
                    ("Alpha-Fetoprotein (AFP)", "ng/mL", "< 7.0"),
                ]
            },
            {
                "name": "Cervical Liquid-Based Cytology (Pap Smear / ThinPrep)",
                "type": "Descriptive",
                "dept": "Clinical Pathology",
                "group": "Clinical Pathology",
                "sample": "Cervical Cytology (Liquid-Based Pap)",
                "rate": Decimal("40.00"),
                "desc": "Liquid-based cervical screening reported according to the Bethesda System for intraepithelial lesions."
            },
            {
                "name": "Histopathology Examination (Surgical Biopsy Specimen)",
                "type": "Descriptive",
                "dept": "Clinical Pathology",
                "group": "Clinical Pathology",
                "sample": "Surgical Biopsy Tissue (Formalin 10%)",
                "rate": Decimal("75.00"),
                "desc": "Gross description, paraffin embedding, microtomy, H&E staining, and microscopic diagnostic histopathological review."
            },
            {
                "name": "Kidney Stone / Urinary Calculus Crystallographic Analysis",
                "type": "Descriptive",
                "dept": "Clinical Pathology",
                "group": "Clinical Pathology",
                "sample": "Kidney Calculus / Urinary Stone",
                "rate": Decimal("45.00"),
                "desc": "Chemical and crystallographic composition testing for calcium oxalate, uric acid, cystine, and struvite."
            },
        ]

        templates_created_count = 0
        templates_updated_count = 0
        compound_events_count = 0

        for t_data in templates_catalog:
            dept_obj = dept_map.get(t_data.get("dept"))
            group_obj = group_map.get(t_data.get("group"))
            sample_obj = sample_map.get(t_data.get("sample"))

            uom_single_obj = None
            if t_data.get("uom"):
                uom_single_obj = uom_map.get(t_data.get("uom"))

            lt, created = LabTestTemplate.objects.get_or_create(
                lab_test_name=t_data["name"],
                defaults={
                    "lab_test_code": t_data["name"][:50],
                    "lab_test_template_type": t_data["type"],
                    "department": dept_obj,
                    "lab_test_group": group_obj,
                    "sample": sample_obj,
                    "lab_test_uom": uom_single_obj,
                    "lab_test_normal_range": t_data.get("range", ""),
                    "lab_test_description": t_data.get("desc", ""),
                    "is_billable": True,
                    "lab_test_rate": t_data.get("rate", Decimal("20.00")),
                    "disabled": False,
                }
            )

            if created:
                templates_created_count += 1
            else:
                templates_updated_count += 1
                lt.lab_test_template_type = t_data["type"]
                lt.department = dept_obj
                lt.lab_test_group = group_obj
                lt.sample = sample_obj
                if uom_single_obj:
                    lt.lab_test_uom = uom_single_obj
                if t_data.get("range"):
                    lt.lab_test_normal_range = t_data.get("range")
                if t_data.get("desc"):
                    lt.lab_test_description = t_data.get("desc")
                lt.lab_test_rate = t_data.get("rate", Decimal("20.00"))
                lt.save()

            # If Compound, seed child NormalTestTemplate rows
            if t_data.get("type") == "Compound" and t_data.get("components"):
                for idx, (comp_name, comp_uom_str, comp_norm_range) in enumerate(t_data["components"]):
                    comp_uom_obj = uom_map.get(comp_uom_str)
                    norm_row, row_created = NormalTestTemplate.objects.get_or_create(
                        parent_template=lt,
                        lab_test_event=comp_name,
                        defaults={
                            "idx": idx + 1,
                            "lab_test_uom": comp_uom_obj,
                            "normal_range": comp_norm_range,
                        }
                    )
                    if not row_created:
                        norm_row.idx = idx + 1
                        norm_row.lab_test_uom = comp_uom_obj
                        norm_row.normal_range = comp_norm_range
                        norm_row.save()
                    compound_events_count += 1

        total_templates = LabTestTemplate.objects.count()
        total_compound_rows = NormalTestTemplate.objects.count()

        self.stdout.write("=================================================================")
        self.stdout.write(" SUCCESS: SEEDING COMPLETE!")
        self.stdout.write(f"   * Total Lab Test Samples:      {total_samples} (Added: {created_samples_count})")
        self.stdout.write(f"   * Total Lab Test Templates:    {total_templates} (Added: {templates_created_count})")
        self.stdout.write(f"   * Compound Analyte Rows:       {total_compound_rows}")
        self.stdout.write("=================================================================")
