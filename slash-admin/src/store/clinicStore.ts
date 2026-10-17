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
    id: "eeu-medium-clinic",
    name: "Ethiopian Electric Utility Medium Clinic",
    region: "Addis Ababa",
    code: "EEU-MED-CLN",
    substationTag: "EEU Medium Clinic Hub",
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
      activeClinicId: "eeu-medium-clinic",
      activeClinic: EEU_CLINIC_FACILITIES[0],
      setActiveClinicId: (id: string) => {
        set({ activeClinicId: "eeu-medium-clinic", activeClinic: EEU_CLINIC_FACILITIES[0] });
      },
    }),
    {
      name: "eeu_active_clinic_storage",
      version: 2,
      migrate: () => ({
        activeClinicId: "eeu-medium-clinic",
        activeClinic: EEU_CLINIC_FACILITIES[0],
      }),
      storage: createJSONStorage(() => localStorage),
    }
  )
);
