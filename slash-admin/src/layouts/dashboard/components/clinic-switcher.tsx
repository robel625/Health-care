import { useClinicStore } from "@/store/clinicStore";

export default function ClinicSwitcher() {
  const { activeClinic } = useClinicStore();

  return (
    <div
      className="inline-flex items-center gap-2 h-8 px-2.5 sm:px-3 rounded-full border border-amber-500/30 bg-amber-500/10 text-foreground font-medium text-xs shadow-xs select-none"
      title="Ethiopian Electric Utility Medium Clinic • Addis Ababa"
    >
      <span className="flex items-center justify-center w-5 h-5 rounded-full bg-amber-500 text-slate-950 font-black shrink-0 text-[11px] shadow-xs">
        ⚡
      </span>
      <span className="font-semibold text-slate-900 dark:text-slate-100 max-w-[170px] sm:max-w-[260px] truncate">
        {activeClinic?.name || "Ethiopian Electric Utility Medium Clinic"}
      </span>
      <span className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        Medium Clinic
      </span>
    </div>
  );
}
