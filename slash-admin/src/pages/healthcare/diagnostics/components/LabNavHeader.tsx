import { useLocation, useNavigate } from "react-router";
import { Icon } from "@/components/icon";
import { Button } from "@/ui/button";
import { Badge } from "@/ui/badge";

interface LabNavHeaderProps {
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  badge?: string;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

const TABS = [
  { label: "Lab Dashboard", path: "/healthcare/lab-dashboard", icon: "solar:chart-square-bold-duotone", badge: "Live" },
  { label: "Lab Tests & Worklist", path: "/healthcare/lab-tests", icon: "solar:test-tube-bold-duotone", badge: null },
  { label: "Sample Collections", path: "/healthcare/sample-collections", icon: "solar:pipette-bold-duotone", badge: null },
  { label: "Clinical Observations", path: "/healthcare/observations", icon: "solar:notes-bold-duotone", badge: null },
  { label: "Diagnostic Reports", path: "/healthcare/diagnostics/reports", icon: "solar:document-medicine-bold-duotone", badge: null },
  { label: "Test Templates", path: "/healthcare/lab-test-templates", icon: "solar:settings-minimalistic-bold-duotone", badge: null },
  { label: "Sample Types & UOM", path: "/healthcare/lab-test-samples", icon: "solar:box-minimalistic-bold-duotone", badge: null },
];

export default function LabNavHeader({
  title,
  subtitle,
  action,
  badge,
  onRefresh,
  isRefreshing,
}: LabNavHeaderProps) {
  const location = useLocation();
  const navigate = useNavigate();

  const isCurrent = (path: string) => {
    if (path === "/healthcare/lab-dashboard") {
      return (
        location.pathname === "/healthcare/lab-dashboard" ||
        location.pathname === "/healthcare/lab-dashboard/" ||
        location.pathname === "/healthcare/diagnostics" ||
        location.pathname === "/healthcare/diagnostics/" ||
        location.pathname === "/healthcare/diagnostics/dashboard"
      );
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div className="space-y-4 mb-6">
      {/* Top Banner with Real-time Status Badge & Action Cluster */}
      <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-r from-cyan-500/10 via-blue-500/5 to-indigo-500/10 p-5 backdrop-blur-md shadow-xs dark:border-border/40">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="font-medium text-muted-foreground/80">EEU Health Services</span>
              <span>/</span>
              <span className="font-semibold text-cyan-600 dark:text-cyan-400">Diagnostics & Laboratory</span>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border border-cyan-500/20">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-500 animate-pulse" />
                Specimen Accessioning & LIS Active
              </span>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/20">
                <Icon icon="solar:test-tube-bold-duotone" size={24} />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                  {title || "Clinical Laboratory Command Center"}
                  {badge && (
                    <Badge variant="outline" className="text-xs bg-cyan-50 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300 border-cyan-300 dark:border-cyan-800">
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
            {onRefresh && (
              <Button
                variant="outline"
                size="sm"
                onClick={onRefresh}
                disabled={isRefreshing}
                className="gap-2 border-border/80 hover:bg-muted/60"
              >
                <Icon
                  icon="solar:restart-bold"
                  size={16}
                  className={isRefreshing ? "animate-spin text-cyan-600" : "text-muted-foreground"}
                />
                <span className="text-xs font-medium">Sync Data</span>
              </Button>
            )}

            {action || (
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate("/healthcare/encounters/new")}
                  className="gap-1.5 border-border/80 text-xs hover:bg-muted/50"
                >
                  <Icon icon="solar:clipboard-add-bold-duotone" size={16} className="text-blue-500" />
                  Order Lab Test
                </Button>
                <Button
                  size="sm"
                  onClick={() => navigate("/healthcare/lab-tests/new")}
                  className="gap-1.5 text-xs bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white shadow-sm shadow-cyan-500/25"
                >
                  <Icon icon="solar:add-circle-bold" size={16} />
                  New Lab Test
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Laboratory Navigation Sub-Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none border-b border-border/40">
        {TABS.map((tab) => {
          const active = isCurrent(tab.path);
          return (
            <button
              key={tab.path}
              type="button"
              onClick={() => navigate(tab.path)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-150 cursor-pointer ${
                active
                  ? "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 font-bold border border-cyan-500/30 shadow-xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
              }`}
            >
              <Icon
                icon={tab.icon}
                size={16}
                className={active ? "text-cyan-600 dark:text-cyan-400" : "text-muted-foreground/70"}
              />
              <span>{tab.label}</span>
              {tab.badge && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold uppercase ${
                    active
                      ? "bg-cyan-600 text-white"
                      : "bg-muted text-muted-foreground"
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
