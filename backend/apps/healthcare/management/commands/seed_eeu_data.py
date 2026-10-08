import datetime
from django.core.management.base import BaseCommand
from django.utils import timezone
from apps.healthcare.models import (
    Patient, HealthcarePractitioner, EEUWorkplaceIncident,
    EEUFitnessEvaluation, EEUFirstAidKit, MedicalLeaveSlip,
    EEUEmergencySOS, EEUPMECampaign, EEUToxicSurveillance, ExternalReferral,
)


class Command(BaseCommand):
    help = "Seeds occupational health and safety data customized for Ethiopian Electric Utility (EEU)."

    def handle(self, *args, **options):
        self.stdout.write("Seeding Ethiopian Electric Utility (EEU) Occupational Health Data...")

        # 1. Update existing patients with EEU staff details
        patients = list(Patient.objects.all())
        sample_eeu_staff = [
            {
                "first_name": "Abebe", "last_name": "Bekele", "sex": "Male", "blood_group": "O+",
                "eeu_staff_id": "EEU-EMP-08421", "eeu_department": "Distribution Directorate",
                "eeu_region": "Addis Ababa", "eeu_work_station": "Kality Substation Feeder 4",
                "eeu_cadre": "Senior High-Voltage Lineman", "eeu_beneficiary_type": "Staff",
                "eeu_medical_coverage_status": "Active Coverage",
                "eeu_climbing_fitness_status": "Fit to Climb",
                "eeu_annual_benefit_ceiling_etb": 25000.00,
                "eeu_benefit_used_etb": 14800.00,
                "mobile": "+251911234567", "email": "abebe.bekele@eeu.gov.et"
            },
            {
                "first_name": "Tigist", "last_name": "Haile", "sex": "Female", "blood_group": "A+",
                "eeu_staff_id": "EEU-EMP-09153", "eeu_department": "Transmission Grid Directorate",
                "eeu_region": "Oromia", "eeu_work_station": "Sebeta 230kV Substation",
                "eeu_cadre": "Substation Electrical Engineer", "eeu_beneficiary_type": "Staff",
                "eeu_medical_coverage_status": "Active Coverage",
                "eeu_climbing_fitness_status": "Restricted Ground Duty",
                "eeu_annual_benefit_ceiling_etb": 25000.00,
                "eeu_benefit_used_etb": 3200.00,
                "mobile": "+251911345678", "email": "tigist.haile@eeu.gov.et"
            },
            {
                "first_name": "Dawit", "last_name": "Tadesse", "sex": "Male", "blood_group": "B+",
                "eeu_staff_id": "EEU-EMP-10492", "eeu_department": "Distribution Directorate",
                "eeu_region": "Addis Ababa", "eeu_work_station": "Legehar Line Maintenance Depot",
                "eeu_cadre": "Utility Pole Climbing Technician", "eeu_beneficiary_type": "Staff",
                "eeu_medical_coverage_status": "Active Coverage",
                "eeu_climbing_fitness_status": "Fit to Climb",
                "eeu_annual_benefit_ceiling_etb": 25000.00,
                "eeu_benefit_used_etb": 22400.00,
                "mobile": "+251911456789", "email": "dawit.tadesse@eeu.gov.et"
            },
            {
                "first_name": "Mulu", "last_name": "Kassa", "sex": "Female", "blood_group": "AB+",
                "eeu_staff_id": "EEU-EMP-11024", "eeu_department": "Customer Services & Metering",
                "eeu_region": "Amhara", "eeu_work_station": "Bahir Dar Regional District",
                "eeu_cadre": "Senior Meter & Energy Auditor", "eeu_beneficiary_type": "Staff",
                "eeu_medical_coverage_status": "Active Coverage",
                "eeu_climbing_fitness_status": "Not Applicable",
                "eeu_annual_benefit_ceiling_etb": 25000.00,
                "eeu_benefit_used_etb": 8900.00,
                "mobile": "+251911567890", "email": "mulu.kassa@eeu.gov.et"
            },
            {
                "first_name": "Yohannes", "last_name": "Alemu", "sex": "Male", "blood_group": "O-",
                "eeu_staff_id": "EEU-EMP-12501", "eeu_department": "Generation & Hydro Plants",
                "eeu_region": "Oromia", "eeu_work_station": "Adama Regional Substation",
                "eeu_cadre": "High-Voltage Transformer Specialist", "eeu_beneficiary_type": "Staff",
                "eeu_medical_coverage_status": "Active Coverage",
                "eeu_climbing_fitness_status": "Temporarily Unfit",
                "eeu_annual_benefit_ceiling_etb": 25000.00,
                "eeu_benefit_used_etb": 18500.00,
                "mobile": "+251911678901", "email": "yohannes.alemu@eeu.gov.et"
            },
            {
                "first_name": "Hirut", "last_name": "Bekele", "sex": "Female", "blood_group": "O+",
                "eeu_staff_id": "EEU-DEP-08421-01", "eeu_department": "Distribution Directorate",
                "eeu_region": "Addis Ababa", "eeu_work_station": "Kality Staff Quarters",
                "eeu_cadre": "Dependent Family Member", "eeu_beneficiary_type": "Spouse",
                "eeu_primary_staff_id": "EEU-EMP-08421", "eeu_medical_coverage_status": "Active Coverage",
                "eeu_climbing_fitness_status": "Not Applicable",
                "eeu_annual_benefit_ceiling_etb": 20000.00,
                "eeu_benefit_used_etb": 4100.00,
                "mobile": "+251911789012", "email": "hirut.bekele@gmail.com"
            },
            {
                "first_name": "Natnael", "last_name": "Bekele", "sex": "Male", "blood_group": "O+",
                "eeu_staff_id": "EEU-DEP-08421-02", "eeu_department": "Distribution Directorate",
                "eeu_region": "Addis Ababa", "eeu_work_station": "Kality Staff Quarters",
                "eeu_cadre": "Dependent Child", "eeu_beneficiary_type": "Child",
                "eeu_primary_staff_id": "EEU-EMP-08421", "eeu_medical_coverage_status": "Active Coverage",
                "eeu_climbing_fitness_status": "Not Applicable",
                "eeu_annual_benefit_ceiling_etb": 15000.00,
                "eeu_benefit_used_etb": 1800.00,
                "mobile": "+251911890123", "email": ""
            }
        ]

        active_patients = []
        for i, sdata in enumerate(sample_eeu_staff):
            if i < len(patients):
                p = patients[i]
                p.first_name = sdata["first_name"]
                p.last_name = sdata["last_name"]
                p.patient_name = f"{sdata['first_name']} {sdata['last_name']}"
                p.sex = sdata["sex"]
                p.blood_group = sdata["blood_group"]
                p.eeu_staff_id = sdata["eeu_staff_id"]
                p.eeu_department = sdata["eeu_department"]
                p.eeu_region = sdata["eeu_region"]
                p.eeu_work_station = sdata["eeu_work_station"]
                p.eeu_cadre = sdata["eeu_cadre"]
                p.eeu_beneficiary_type = sdata["eeu_beneficiary_type"]
                p.eeu_primary_staff_id = sdata.get("eeu_primary_staff_id", "")
                p.eeu_medical_coverage_status = sdata["eeu_medical_coverage_status"]
                p.eeu_climbing_fitness_status = sdata["eeu_climbing_fitness_status"]
                p.eeu_annual_benefit_ceiling_etb = sdata["eeu_annual_benefit_ceiling_etb"]
                p.eeu_benefit_used_etb = sdata["eeu_benefit_used_etb"]
                p.mobile = sdata["mobile"]
                p.email = sdata["email"]
                p.save()
                active_patients.append(p)
            else:
                p = Patient.objects.create(
                    patient_id=f"EEU-PAT-{1000 + i}",
                    first_name=sdata["first_name"],
                    last_name=sdata["last_name"],
                    patient_name=f"{sdata['first_name']} {sdata['last_name']}",
                    sex=sdata["sex"],
                    blood_group=sdata["blood_group"],
                    eeu_staff_id=sdata["eeu_staff_id"],
                    eeu_department=sdata["eeu_department"],
                    eeu_region=sdata["eeu_region"],
                    eeu_work_station=sdata["eeu_work_station"],
                    eeu_cadre=sdata["eeu_cadre"],
                    eeu_beneficiary_type=sdata["eeu_beneficiary_type"],
                    eeu_primary_staff_id=sdata.get("eeu_primary_staff_id", ""),
                    eeu_medical_coverage_status=sdata["eeu_medical_coverage_status"],
                    eeu_climbing_fitness_status=sdata["eeu_climbing_fitness_status"],
                    mobile=sdata["mobile"],
                    email=sdata["email"]
                )
                active_patients.append(p)

        self.stdout.write(f"Updated/Created {len(active_patients)} EEU staff and dependent patient records.")

        # 2. Seed Workplace & Electrical Incidents
        doc = HealthcarePractitioner.objects.first()
        today = timezone.now()

        incidents_data = [
            {
                "patient": active_patients[0],  # Abebe
                "voltage_level": "Medium Voltage (15kV / 33kV)",
                "incident_type": "Electrical Arc Flash / Thermal Burn",
                "work_location": "Kality 230kV/15kV Substation Feeder Bay 4",
                "region": "Addis Ababa",
                "severity": "Moderate / Outpatient Care",
                "ppe_compliance": "Fully Compliant (Harness, Insulating Gloves, Boots, Helmet)",
                "clinical_findings": "2nd-degree superficial thermal flash burn on right forearm and dorsum of hand (~4% BSA). No electrical entry/exit puncture marks. Normal sinus rhythm on 12-lead ECG, cardiac enzymes negative.",
                "immediate_treatment_given": "Copious cooling, silver sulfadiazine burn dressing, tetanus toxoid booster, IV analgesia.",
                "duty_recommendation": "Restricted Ground Duty Only",
                "reported_by": "Eng. Girma Wolde (Safety Officer)",
                "status": "Treatment Ongoing"
            },
            {
                "patient": active_patients[2],  # Dawit
                "voltage_level": "Low Voltage (220V/380V)",
                "incident_type": "Fall from Height / Utility Pole / Tower",
                "work_location": "Gullele Feeder 03 (Distribution Pole #44)",
                "region": "Addis Ababa",
                "severity": "Moderate / Outpatient Care",
                "ppe_compliance": "Fully Compliant (Harness, Insulating Gloves, Boots, Helmet)",
                "clinical_findings": "Arrested fall from 8-meter utility pole via safety harness line arrestor. Musculoskeletal contusion to lumbar spine and right shoulder. X-rays negative for fracture.",
                "immediate_treatment_given": "C-spine clearance, rigid immobilization, NSAIDs, physical therapy referral.",
                "duty_recommendation": "Medical Sick Leave",
                "reported_by": "Moges Assefa (Line Team Foreman)",
                "status": "Under Medical Review"
            },
            {
                "patient": active_patients[4],  # Yohannes
                "voltage_level": "High Voltage (66kV / 132kV / 230kV / 400kV)",
                "incident_type": "Substation Transformer Oil / Chemical Splash",
                "work_location": "Adama 132kV Main Transformer Radiator Bank",
                "region": "Oromia",
                "severity": "Minor / First Aid Only",
                "ppe_compliance": "Partial PPE Worn (Missing Gloves / Harness)",
                "clinical_findings": "High-temperature dielectric mineral oil splash onto facial periphery and eye margin. Chemical conjunctivitis right eye, cornea intact under fluorescein staining.",
                "immediate_treatment_given": "15-minute emergency saline eye irrigation, antibiotic eye ointment, protective eye shield.",
                "duty_recommendation": "Restricted Ground Duty Only",
                "reported_by": "Solomon Demisse (Substation Lead)",
                "status": "Under Medical Review"
            }
        ]

        for idata in incidents_data:
            EEUWorkplaceIncident.objects.get_or_create(
                patient=idata["patient"],
                work_location=idata["work_location"],
                defaults=idata
            )
        self.stdout.write("Seeded EEU workplace incidents.")

        # 3. Seed Lineman Fitness Evaluations
        fitness_data = [
            {
                "patient": active_patients[0],  # Abebe
                "practitioner": doc,
                "evaluation_type": "Annual High-Voltage Climbing Exam",
                "climbing_fitness": "Fit to Climb (Certified)",
                "color_vision": "Normal Color Vision (Ishihara 15/15)",
                "audiometry_hearing": "Normal Bilateral Hearing",
                "cardiovascular_status": "Normal / Cleared for Heavy Exertion",
                "vertigo_vestibular_check": "Negative (No Vertigo / Cleared for Heights)",
                "physician_remarks": "Passed full utility pole climbing medical protocol. Cardiovascular endurance sound, vertigo test negative, vision 20/20 with full color discrimination.",
                "status": "Certified & Valid"
            },
            {
                "patient": active_patients[1],  # Tigist
                "practitioner": doc,
                "evaluation_type": "Substation Noise & Audiometry Screening",
                "climbing_fitness": "Restricted to Ground Duty Only",
                "color_vision": "Normal Color Vision (Ishihara 15/15)",
                "audiometry_hearing": "Mild Occupational Noise Shift (<25 dB)",
                "cardiovascular_status": "Normal / Cleared for Heavy Exertion",
                "vertigo_vestibular_check": "Negative (No Vertigo / Cleared for Heights)",
                "physician_remarks": "Substation transformer noise exposure check shows mild bilateral threshold shift at 4kHz. Custom ear defenders mandated in 230kV transformer yard.",
                "status": "Conditional Clearance"
            },
            {
                "patient": active_patients[2],  # Dawit
                "practitioner": doc,
                "evaluation_type": "Post-Injury Return to Duty Clearance",
                "climbing_fitness": "Temporarily Unfit (Re-eval in 30 Days)",
                "color_vision": "Normal Color Vision (Ishihara 15/15)",
                "audiometry_hearing": "Normal Bilateral Hearing",
                "cardiovascular_status": "Normal / Cleared for Heavy Exertion",
                "vertigo_vestibular_check": "Negative (No Vertigo / Cleared for Heights)",
                "physician_remarks": "Post-fall lumbar strain recovering. Ground duty allowed, pole climbing restricted for 30 days pending physical therapy completion.",
                "status": "Conditional Clearance"
            }
        ]

        for fdata in fitness_data:
            EEUFitnessEvaluation.objects.get_or_create(
                patient=fdata["patient"],
                evaluation_type=fdata["evaluation_type"],
                defaults=fdata
            )
        self.stdout.write("Seeded EEU lineman fitness evaluations.")

        # 4. Seed Emergency First Aid Kits
        kits_data = [
            {
                "kit_code": "EEU-KIT-TRK-01",
                "kit_type": "Line Truck Emergency First-Aid Kit",
                "assigned_unit": "Line Patrol Truck ET-03-49281 (North Addis)",
                "region": "Addis Ababa",
                "custodian_name": "Ato Moges Assefa",
                "status": "Fully Stocked & Sealed",
                "burn_dressings_stocked": True,
                "trauma_bandages_stocked": True,
                "splints_tourniquet_stocked": True,
                "eye_wash_stocked": True,
                "notes": "Equipped with specialized Water-Jel burn dressings and heavy-duty cervical collar."
            },
            {
                "kit_code": "EEU-KIT-TRK-02",
                "kit_type": "Line Truck Emergency First-Aid Kit",
                "assigned_unit": "Emergency Heavy Restoration Truck ET-03-51829",
                "region": "Addis Ababa",
                "custodian_name": "Ato Kifle Mengistu",
                "status": "Needs Replenishment",
                "burn_dressings_stocked": False,
                "trauma_bandages_stocked": True,
                "splints_tourniquet_stocked": True,
                "eye_wash_stocked": True,
                "notes": "Burn dressings used during feeder arc flash incident; replenishment order pending at central pharmacy."
            },
            {
                "kit_code": "EEU-KIT-SUB-01",
                "kit_type": "High-Voltage Substation First-Aid Station",
                "assigned_unit": "Kality 230kV Substation Control Room Station",
                "region": "Addis Ababa",
                "custodian_name": "Eng. Solomon Demisse",
                "status": "Fully Stocked & Sealed",
                "burn_dressings_stocked": True,
                "trauma_bandages_stocked": True,
                "splints_tourniquet_stocked": True,
                "eye_wash_stocked": True,
                "notes": "Wall-mounted high-voltage station kit with 2x eye wash stations for battery room acid spills."
            },
            {
                "kit_code": "EEU-KIT-SUB-02",
                "kit_type": "High-Voltage Substation First-Aid Station",
                "assigned_unit": "Legehar Substation First-Aid Bay",
                "region": "Addis Ababa",
                "custodian_name": "Ato Berhanu Tulu",
                "status": "Fully Stocked & Sealed",
                "burn_dressings_stocked": True,
                "trauma_bandages_stocked": True,
                "splints_tourniquet_stocked": True,
                "eye_wash_stocked": True,
                "notes": "Inspected and sealed by EEU Health Directorate auditor."
            },
            {
                "kit_code": "EEU-KIT-DEP-01",
                "kit_type": "Regional Depot First-Aid Box",
                "assigned_unit": "Adama Regional Power Depot Emergency Bay",
                "region": "Oromia",
                "custodian_name": "Ato Getachew Kebede",
                "status": "Critical - Missing Burn / Trauma Kit",
                "burn_dressings_stocked": False,
                "trauma_bandages_stocked": False,
                "splints_tourniquet_stocked": True,
                "eye_wash_stocked": True,
                "notes": "Emergency restock required from Central Medical Store immediately."
            }
        ]

        for kdata in kits_data:
            EEUFirstAidKit.objects.get_or_create(
                kit_code=kdata["kit_code"],
                defaults=kdata
            )
        self.stdout.write("Seeded EEU emergency first aid kits.")

        # 5. Seed Medical Leave Certificates (Sick Leaves)
        leave_data = [
            {
                "patient": active_patients[0],  # Abebe
                "practitioner": doc,
                "diagnosis": "2nd-degree occupational arc flash burn to right upper extremity, undergoing daily dressing changes.",
                "from_date": today.date(),
                "to_date": today.date() + datetime.timedelta(days=14),
                "total_days": 14,
                "fitness_state": "Fit for Light Duty Only",
                "fit_to_work_date": today.date() + datetime.timedelta(days=15),
                "eeu_clinic_branch": "Kality Central Depot Clinic",
                "eeu_leave_category": "Occupational High-Voltage/Arc Flash Recovery",
                "eeu_duty_restriction": "Restricted to Light Ground Duty (No Climbing / No Field Patrol)",
                "doctor_remarks": "No live wire work or utility pole climbing allowed until full dermal re-epithelialization.",
                "status": "Issued"
            },
            {
                "patient": active_patients[2],  # Dawit
                "practitioner": doc,
                "diagnosis": "Acute lumbar contusion and muscular spasm secondary to arrested fall from utility pole.",
                "from_date": today.date() - datetime.timedelta(days=3),
                "to_date": today.date() + datetime.timedelta(days=7),
                "total_days": 10,
                "fitness_state": "Unfit for Work / School",
                "fit_to_work_date": today.date() + datetime.timedelta(days=8),
                "eeu_clinic_branch": "Head Office Central Clinic",
                "eeu_leave_category": "Work-Related Electrical/Mechanical Injury",
                "eeu_duty_restriction": "Complete Bed Rest / Total Absence",
                "doctor_remarks": "Strict bed rest and analgesia. Re-evaluation scheduled before return to light duty.",
                "status": "Issued"
            }
        ]

        for ldata in leave_data:
            slip, _ = MedicalLeaveSlip.objects.get_or_create(
                patient=ldata["patient"],
                from_date=ldata["from_date"],
                defaults=ldata
            )
            # Link to corresponding incident if exists
            inc = EEUWorkplaceIncident.objects.filter(patient=ldata["patient"]).first()
            if inc:
                inc.sick_leave_slip = slip
                inc.lost_work_days = ldata["total_days"]
                inc.save()

        # Update kits with restock status
        EEUFirstAidKit.objects.filter(kit_code="EEU-KIT-TRK-02").update(
            restock_requisition_status="Pharmacy Requisition Sent",
            restock_notes="Requisition #REQ-PHARM-2026-084: 6x Water-Jel 10x10cm Burn Dressings, 2x Silver Sulfadiazine Cream."
        )
        EEUFirstAidKit.objects.filter(kit_code="EEU-KIT-DEP-01").update(
            restock_requisition_status="Pharmacy Requisition Sent",
            restock_notes="Requisition #REQ-PHARM-2026-089: Complete Trauma Pack Replenishment, 4x CAT Tourniquets, 4x Pressure Dressings."
        )

        # 6. Seed Substation Emergency SOS Calls
        sos_data = [
            {
                "sos_id": "EEU-SOS-2026-0001",
                "substation_name": "Kality 230kV Substation Bay 4",
                "region": "Addis Ababa",
                "voltage_level": "230kV High Voltage Grid",
                "hazard_type": "Arc Flash Explosion",
                "casualty_count": 2,
                "severity_level": "Severe - Burn ICU / Resuscitation Required",
                "caller_name": "Eng. Fikadu Worku (Safety Officer)",
                "caller_phone": "+251-91-122-3344",
                "destination_clinic": "Kality Substation Clinic",
                "eta_minutes": 10,
                "pre_arrival_prep_notes": "Prep sterile burn blankets, 2L normal saline IV line, and cardiac monitor. 2nd & 3rd degree flash burns suspected on forearms and chest.",
                "status": "Active / En Route"
            },
            {
                "sos_id": "EEU-SOS-2026-0002",
                "substation_name": "Sebeta 132kV Switchyard",
                "region": "Oromia",
                "voltage_level": "132kV Grid Transmission",
                "hazard_type": "Direct High-Voltage Electrocution",
                "casualty_count": 1,
                "severity_level": "Critical - CPR / Resuscitation En Route",
                "caller_name": "Foreman Bekele Tola",
                "caller_phone": "+251-91-344-5566",
                "destination_clinic": "Head Office Central Clinic",
                "eta_minutes": 20,
                "pre_arrival_prep_notes": "Defibrillator on standby. Patient regained pulse following field CPR; currently receiving high-flow oxygen via bag valve mask.",
                "status": "Arrived at Clinic"
            },
            {
                "sos_id": "EEU-SOS-2026-0003",
                "substation_name": "Adama II Wind Farm Substation",
                "region": "Oromia",
                "voltage_level": "33kV Distribution",
                "hazard_type": "Pylon Fall from Height",
                "casualty_count": 1,
                "severity_level": "Moderate - Conscious / Trauma Dressing",
                "caller_name": "Technician Getachew Zewde",
                "caller_phone": "+251-91-455-6677",
                "destination_clinic": "Adama Regional Clinic",
                "eta_minutes": 25,
                "pre_arrival_prep_notes": "Spinal backboard applied. Splinting of right lower leg. Neurologically intact.",
                "status": "Treated & Admitted"
            }
        ]
        for sdata in sos_data:
            EEUEmergencySOS.objects.get_or_create(sos_id=sdata["sos_id"], defaults=sdata)
        self.stdout.write("Seeded EEU Substation Emergency SOS records.")

        # 7. Seed Periodic Medical Examination (PME) Campaigns
        pme_data = [
            {
                "campaign_id": "EEU-PME-2026-001",
                "campaign_name": "2026 Central Transmission Grid Lineman Annual Height Screening",
                "target_year": 2026,
                "target_directorate": "Transmission Grid Directorate",
                "target_region": "Addis Ababa",
                "substation_focus": "Kality, Sebeta, and Legetafo 132/230kV Grid Corridors",
                "start_date": today.date() - datetime.timedelta(days=45),
                "end_date": today.date() + datetime.timedelta(days=15),
                "target_count": 50,
                "completed_count": 39,
                "fit_certified_count": 36,
                "status": "Active Campaign",
                "notes": "Mandatory annual screening: pure-tone audiometry, Ishihara color vision, and cardiovascular altitude stress evaluation."
            },
            {
                "campaign_id": "EEU-PME-2026-002",
                "campaign_name": "2026 Oromia Regional Distribution Crew Annual Clearance",
                "target_year": 2026,
                "target_directorate": "Distribution Directorate",
                "target_region": "Oromia",
                "substation_focus": "Adama, Bishoftu, and Mojo 15/33kV Distribution Substations",
                "start_date": today.date() - datetime.timedelta(days=20),
                "end_date": today.date() + datetime.timedelta(days=40),
                "target_count": 35,
                "completed_count": 14,
                "fit_certified_count": 12,
                "status": "Active Campaign",
                "notes": "Mobile clinic deployment across Adama and Bishoftu line depots."
            },
            {
                "campaign_id": "EEU-PME-2025-004",
                "campaign_name": "2025 Generation & Hydro Station Annual Physical Exam",
                "target_year": 2025,
                "target_directorate": "Generation & Hydro Plants",
                "target_region": "Central Ethiopia",
                "substation_focus": "Koka & Melka Wakena Hydroelectric Plants",
                "start_date": today.date() - datetime.timedelta(days=250),
                "end_date": today.date() - datetime.timedelta(days=200),
                "target_count": 40,
                "completed_count": 40,
                "fit_certified_count": 38,
                "status": "Completed & Certified",
                "notes": "Annual occupational hearing and pulmonary health audit successfully closed."
            }
        ]
        for pdata in pme_data:
            EEUPMECampaign.objects.get_or_create(campaign_id=pdata["campaign_id"], defaults=pdata)
        self.stdout.write("Seeded EEU PME Campaign records.")

        # 8. Seed Toxic Chemical & SF6 Surveillance Records
        if active_patients:
            tox_data = [
                {
                    "surveillance_id": "EEU-TOX-2026-0001",
                    "patient": active_patients[0],  # Abebe
                    "examination_date": today.date() - datetime.timedelta(days=10),
                    "work_location": "Kality Substation 230kV GIS Switchgear Room",
                    "chemical_agent": "SF6 Breakdown Gas (SOF2 / HF byproducts)",
                    "exposure_route": "Inhalation / Respiratory",
                    "exposure_severity": "Mild Irritation / Monitored",
                    "spirometry_fev1_actual": 3.45,
                    "spirometry_fev1_predicted_pct": 92,
                    "dermatological_findings": "No active chemical dermatitis",
                    "clinical_management": "Preventative salbutamol nebulization; switchgear compartment sealed & ventilated with dry nitrogen.",
                    "duty_recommendation": "Cleared for Continued Substation Duty"
                },
                {
                    "surveillance_id": "EEU-TOX-2026-0002",
                    "patient": active_patients[4],  # Yohannes
                    "examination_date": today.date() - datetime.timedelta(days=5),
                    "work_location": "Sebeta Transformer Maintenance & Degassing Workshop",
                    "chemical_agent": "Transformer Mineral Oil / PCB Splashing",
                    "exposure_route": "Dermal / Skin Contact",
                    "exposure_severity": "Moderate - Respiratory Bronchospasm",
                    "spirometry_fev1_actual": 2.80,
                    "spirometry_fev1_predicted_pct": 74,
                    "dermatological_findings": "Erythematous contact dermatitis across both dorsal forearms",
                    "clinical_management": "Topical hydrocortisone 1% cream, oral cetirizine, and barrier cream. Advised strict nitrile chemical glove protocol.",
                    "duty_recommendation": "Mandatory Respirator / Full Chemical PPE"
                }
            ]
            for tdata in tox_data:
                EEUToxicSurveillance.objects.get_or_create(surveillance_id=tdata["surveillance_id"], defaults=tdata)
            self.stdout.write("Seeded EEU Chemical & SF6 Surveillance records.")

        # 9. Seed Guarantee of Payment (GOP) External Referral
        if active_patients:
            ExternalReferral.objects.get_or_create(
                referral_id="EEU-REF-2026-0001",
                defaults={
                    "patient": active_patients[0],
                    "referring_practitioner": doc,
                    "referral_date": today.date(),
                    "priority": "Emergency",
                    "target_facility": "ALERT Center (Burn ICU & Trauma)",
                    "receiving_specialist": "Chief Burn Surgery & Critical Care Admissions",
                    "clinical_indication": "Urgent transfer for specialized third-degree electrical arc-flash burn debridement and biological dressing.",
                    "provisional_diagnosis": "High-Voltage Arc Flash Thermal Burns (18% TBSA, Right Upper Extremity & Torso)",
                    "treatment_summary": "Intravenous Ringer's Lactate resuscitation initiated at 500ml/hr. Silver sulfadiazine dressings applied. Tetanus toxoid booster administered.",
                    "is_eeu_guarantee_of_payment": True,
                    "eeu_gop_authorized_amount_etb": 25000.00,
                    "eeu_gop_coverage_scope": "Emergency Inpatient, Burn ICU & Specialized Surgery",
                    "eeu_gop_authorization_code": "EEU-GOP-2026-0001",
                    "eeu_specialist_hospital_tier": "ALERT Center (Burn ICU & Trauma)",
                    "status": "Active"
                }
            )
            self.stdout.write("Seeded EEU Guarantee of Payment referral.")

        self.stdout.write(self.style.SUCCESS("All EEU Occupational Health and Safety extensions seeded successfully!"))

