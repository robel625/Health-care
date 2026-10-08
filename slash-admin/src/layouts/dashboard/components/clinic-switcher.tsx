import { useClinicStore, EEU_CLINIC_FACILITIES } from "@/store/clinicStore";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/ui/dropdown-menu";
import { Button } from "@/ui/button";
import { Icon } from "@/components/icon";
import { toast } from "sonner";

export default function ClinicSwitcher() {
  const { activeClinic, setActiveClinicId } = useClinicStore();

  const handleSelect = (id: string, name: string) => {
    setActiveClinicId(id);
    toast.success(`Active Facility Switched: ${name}`, {
      description: "Emergency supplies, appointments, and queues updated.",
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8.5 px-2.5 gap-2 border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-foreground font-medium rounded-full text-xs transition-all shadow-sm"
        >
          <span className="flex items-center justify-center w-5 h-5 rounded-full bg-amber-500 text-slate-950 font-black shrink-0 shadow-xs">
            ⚡
          </span>
          <span className="max-w-[140px] sm:max-w-[190px] truncate text-left font-semibold">
            {activeClinic.name}
          </span>
          <Icon icon="lucide:chevrons-up-down" className="w-3.5 h-3.5 text-muted-foreground ml-0.5 shrink-0" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-72 p-1.5 shadow-xl border-border/80">
        <DropdownMenuLabel className="px-2.5 py-1.5 text-xs text-muted-foreground font-medium flex items-center justify-between">
          <span>EEU REGIONAL CLINIC / DEPOT</span>
          <span className="text-[10px] uppercase font-bold text-amber-500">Live Station</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        <div className="max-h-[360px] overflow-y-auto space-y-0.5">
          {EEU_CLINIC_FACILITIES.map((facility) => {
            const isSelected = facility.id === activeClinic.id;
            return (
              <DropdownMenuItem
                key={facility.id}
                onClick={() => handleSelect(facility.id, facility.name)}
                className={`flex flex-col items-start gap-0.5 px-2.5 py-2 cursor-pointer rounded-md transition-colors ${
                  isSelected ? "bg-amber-500/15 font-semibold text-amber-500" : "hover:bg-muted"
                }`}
              >
                <div className="w-full flex items-center justify-between">
                  <span className="text-xs">{facility.name}</span>
                  {isSelected && <Icon icon="lucide:check" className="w-4 h-4 text-amber-500" />}
                </div>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  <span className="font-mono">{facility.code}</span>
                  <span>•</span>
                  <span>{facility.region}</span>
                </div>
              </DropdownMenuItem>
            );
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
