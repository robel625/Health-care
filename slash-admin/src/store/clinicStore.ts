import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export interface EEUClinicFacility {
  id: string;
  name: string;
  region: string;
  code: string;
  substationTag: string;
}

export const EEU_CLINIC_FACILITIES: EEUClinicFacility[] = [
  {
    id: "all",
    name: "All EEU Healthcare Facilities",
    region: "National Directorate",
    code: "EEU-NAT",
    substationTag: "Directorate View",
  },
  {
    id: "head-office",
    name: "Head Office Central Clinic",
    region: "Addis Ababa",
    code: "EEU-HO-CLN",
    substationTag: "Executive & Admin Hub",
  },
  {
    id: "kality-depot",
    name: "Kality Central Depot Clinic",
    region: "Addis Ababa",
    code: "EEU-KLT-230kV",
    substationTag: "230kV Major Grid Depot",
  },
  {
    id: "legehar-substation",
    name: "Legehar Substation Clinic",
    region: "Addis Ababa",
    code: "EEU-LGH-CLN",
    substationTag: "Central Distribution",
  },
  {
    id: "adama-regional",
    name: "Adama Regional Clinic",
    region: "Oromia",
    code: "EEU-ADM-132kV",
    substationTag: "Central Rift Distribution",
  },
  {
    id: "hawassa-regional",
    name: "Hawassa Regional Clinic",
    region: "Sidama",
    code: "EEU-HWS-CLN",
    substationTag: "Southern Region Grid",
  },
  {
    id: "bahir-dar-regional",
    name: "Bahir Dar Regional Clinic",
    region: "Amhara",
    code: "EEU-BDR-CLN",
    substationTag: "North-West Grid Depot",
  },
  {
    id: "dire-dawa-regional",
    name: "Dire Dawa Regional Clinic",
    region: "Dire Dawa",
    code: "EEU-DD-CLN",
    substationTag: "Eastern Regional Grid",
  },
  {
    id: "mekelle-regional",
    name: "Mekelle Regional Clinic",
    region: "Tigray",
    code: "EEU-MKL-CLN",
    substationTag: "Northern Regional Grid",
  },
  {
    id: "jimma-regional",
    name: "Jimma Regional Clinic",
    region: "Oromia",
    code: "EEU-JMA-CLN",
    substationTag: "South-West Grid Depot",
  },
];

interface ClinicStoreState {
  activeClinicId: string;
  activeClinic: EEUClinicFacility;
  setActiveClinicId: (id: string) => void;
}

export const useClinicStore = create<ClinicStoreState>()(
  persist(
    (set) => ({
      activeClinicId: "head-office",
      activeClinic: EEU_CLINIC_FACILITIES[1], // Head Office by default
      setActiveClinicId: (id: string) => {
        const found = EEU_CLINIC_FACILITIES.find((c) => c.id === id) || EEU_CLINIC_FACILITIES[0];
        set({ activeClinicId: id, activeClinic: found });
      },
    }),
    {
      name: "eeu_active_clinic_storage",
      storage: createJSONStorage(() => localStorage),
    }
  )
);
