import { useLocation, useNavigate } from "react-router";
import { Icon } from "@/components/icon";
import { Button } from "@/ui/button";
import { Badge } from "@/ui/badge";

interface PharmacyNavHeaderProps {
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  badge?: string;
}

const TABS = [
  { label: "Dashboard", path: "/healthcare/pharmacy", icon: "solar:widget-2-bold-duotone", badge: null },
  { label: "Outpatient Dispensing", path: "/healthcare/pharmacy/outpatient", icon: "solar:bag-check-bold-duotone", badge: "Dispensary" },
  { label: "Prescriptions", path: "/healthcare/pharmacy/medication-requests", icon: "solar:pill-bold-duotone", badge: "Rx" },
  { label: "Pharmacy Stock", path: "/healthcare/pharmacy/stock", icon: "solar:box-minimalistic-bold-duotone", badge: null },
  { label: "Stock Intake Console", path: "/healthcare/pharmacy/stock/intake", icon: "solar:box-bold-duotone", badge: "Intake" },
  { label: "Formulary & Safety", path: "/healthcare/pharmacy/medications", icon: "solar:shield-check-bold-duotone", badge: "Safety" },
];

export default function PharmacyNavHeader({ title, subtitle, action, badge }: PharmacyNavHeaderProps) {
  const location = useLocation();
  const navigate = useNavigate();

  const isCurrent = (path: string) => {
    if (path === "/healthcare/pharmacy") {
      return location.pathname === "/healthcare/pharmacy" || location.pathname === "/healthcare/pharmacy/";
    }
    if (path === "/healthcare/pharmacy/stock") {
      return location.pathname === "/healthcare/pharmacy/stock" || location.pathname === "/healthcare/pharmacy/stock/";
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div className="space-y-4 mb-6">
      {/* Top Bar with Live Indicator & Action Cluster */}
      <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-r from-emerald-500/5 via-teal-500/5 to-transparent p-5 backdrop-blur-sm shadow-xs dark:border-border/40">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="font-medium text-muted-foreground/80">Healthcare</span>
              <span>/</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">Pharmacy Operations</span>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live Dispensary & Stock Sync
              </span>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/20">
                <Icon icon="solar:pill-bold-duotone" size={24} />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                  {title || "Pharmacy Operations & Analytics"}
                  {badge && (
                    <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800">
                      {badge}
                    </Badge>
                  )}
                </h1>
                {subtitle && (
                  <p className="text-sm text-muted-foreground max-w-3xl leading-relaxed">
                    {subtitle}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 self-start lg:self-center">
            {action || (
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 border-border hover:bg-muted/80 shadow-xs"
                  onClick={() => navigate("/healthcare/pharmacy/stock/intake")}
                >
                  <Icon icon="solar:box-bold" size={16} className="text-blue-500" />
                  <span>Receive Stock</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 border-border hover:bg-muted/80 shadow-xs"
                  onClick={() => navigate("/healthcare/pharmacy/medication-requests")}
                >
                  <Icon icon="solar:prescription-bold" size={16} className="text-amber-500" />
                  <span>Rx Queue</span>
                </Button>
                <Button
                  size="sm"
                  className="gap-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-sm shadow-emerald-600/25"
                  onClick={() => navigate("/healthcare/pharmacy/outpatient")}
                >
                  <Icon icon="solar:bag-check-bold" size={16} />
                  <span>Outpatient POS</span>
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs with pill styling and badges */}
      <div className="flex items-center gap-1.5 border-b border-border/80 overflow-x-auto pb-1 scrollbar-thin">
        {TABS.map((tab) => {
          const active = isCurrent(tab.path);
          return (
            <button
              key={tab.path}
              type="button"
              onClick={() => navigate(tab.path)}
              className={`group flex items-center gap-2 px-3.5 py-2.5 text-xs sm:text-sm font-medium rounded-xl transition-all duration-150 whitespace-nowrap ${
                active
                  ? "bg-emerald-600 text-white shadow-sm shadow-emerald-600/30 font-semibold"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
              }`}
            >
              <Icon
                icon={tab.icon}
                size={18}
                className={`transition-transform duration-150 ${active ? "text-white" : "text-muted-foreground group-hover:scale-110"}`}
              />
              <span>{tab.label}</span>
              {tab.badge && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-md font-semibold tracking-wide ${
                    active
                      ? "bg-white/20 text-white"
                      : "bg-muted text-muted-foreground group-hover:bg-muted-foreground/15"
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
