import { useState, useMemo, useRef, useCallback } from "react";
import { Icon } from "@/components/icon";
import { Card, CardContent, CardHeader } from "@/ui/card";
import { Badge } from "@/ui/badge";
import { cn } from "@/utils";

export interface ActivityHeatmapItem {
  id?: any;
  text?: string;
  time?: string;
  reference_doctype?: string;
  reference_name?: string;
  user?: string;
}

export interface ActivityHeatmapProps {
  activity?: ActivityHeatmapItem[];
  title?: string;
  message?: string;
  colorScheme?: "blue" | "emerald";
  startOnMonday?: boolean;
  className?: string;
  onSelectDate?: (dateStr: string, items: ActivityHeatmapItem[]) => void;
}

interface DayCell {
  date: Date;
  dateStr: string;
  dayOfWeek: number; // 0..6
  count: number;
  items: ActivityHeatmapItem[];
  isToday: boolean;
  isFuture: boolean;
}

interface WeekColumn {
  weekIndex: number;
  days: DayCell[];
  monthLabel?: string;
}

/**
 * Format local Date to 'YYYY-MM-DD' avoiding UTC timezone off-by-one shifts.
 */
function toDateStr(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Human-friendly date display: "Wednesday, Sep 23, 2026"
 */
function formatDisplayDate(d: Date): string {
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Extract YYYY-MM-DD from any date string or ISO timestamp.
 */
function extractDateStr(raw?: string): string | null {
  if (!raw) return null;
  const s = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return s;
  }
  const parsed = new Date(s);
  if (isNaN(parsed.getTime())) return null;
  return toDateStr(parsed);
}

const DAY_LABELS_MON = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_LABELS_SUN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * Marley / Frappe Charts inspired Calendar Activity Heatmap.
 * Renders a 7-day vertical by 52-week horizontal contribution grid with
 * real patient transaction density, interactive tooltips, and Marley caption.
 */
export default function ActivityHeatmap({
  activity = [],
  title = "Activity",
  message = "This is based on transactions against this Patient. See timeline below for details",
  colorScheme = "blue",
  startOnMonday = true,
  className,
  onSelectDate,
}: ActivityHeatmapProps) {
  const [theme, setTheme] = useState<"blue" | "emerald">(colorScheme);
  const [hoveredCell, setHoveredCell] = useState<{
    cell: DayCell;
    rect: DOMRect;
  } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Group activity items by date string (YYYY-MM-DD)
  const { dateMap, totalTransactions, activeDaysCount } = useMemo(() => {
    const map: Record<string, ActivityHeatmapItem[]> = {};
    let total = 0;

    for (const item of activity) {
      const dStr = extractDateStr(item.time);
      if (!dStr) continue;
      if (!map[dStr]) map[dStr] = [];
      map[dStr].push(item);
      total++;
    }

    const activeDays = Object.keys(map).length;
    return { dateMap: map, totalTransactions: total, activeDaysCount: activeDays };
  }, [activity]);

  // Build the 52-week calendar grid
  const { weeks, dayLabels } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = toDateStr(today);

    const labels = startOnMonday ? DAY_LABELS_MON : DAY_LABELS_SUN;

    // Determine day index for today:
    // startOnMonday: Mon=0, Tue=1, ..., Sun=6
    // startOnSunday: Sun=0, Mon=1, ..., Sat=6
    const todayDayIndex = startOnMonday
      ? (today.getDay() + 6) % 7
      : today.getDay();

    // End on the last day of the current week (Sunday or Saturday)
    const endDate = new Date(today);
    endDate.setDate(today.getDate() + (6 - todayDayIndex));

    // 52 weeks = 52 * 7 = 364 days
    const startDate = new Date(endDate);
    startDate.setDate(endDate.getDate() - (52 * 7) + 1);

    const weekList: WeekColumn[] = [];
    let lastMonth = -1;
    let lastLabeledWeek = -999;

    for (let w = 0; w < 52; w++) {
      const days: DayCell[] = [];

      for (let d = 0; d < 7; d++) {
        const cellDate = new Date(startDate);
        cellDate.setDate(startDate.getDate() + w * 7 + d);
        const cellDateStr = toDateStr(cellDate);
        const isFuture = cellDate.getTime() > today.getTime();
        const isToday = cellDateStr === todayStr;
        const items = dateMap[cellDateStr] || [];

        days.push({
          date: cellDate,
          dateStr: cellDateStr,
          dayOfWeek: d,
          count: items.length,
          items,
          isToday,
          isFuture,
        });
      }

      // Compute month label if month has turned and spaced adequately
      let monthLabel: string | undefined;
      const midDay = days[3] || days[0];
      const curMonth = midDay.date.getMonth();

      if (curMonth !== lastMonth && w - lastLabeledWeek >= 3) {
        monthLabel = midDay.date.toLocaleString("en-US", { month: "short" });
        lastMonth = curMonth;
        lastLabeledWeek = w;
      }

      weekList.push({
        weekIndex: w,
        days,
        monthLabel,
      });
    }

    return { weeks: weekList, dayLabels: labels };
  }, [dateMap, startOnMonday]);

  // Color mapping based on transaction count
  const getCellColorClass = useCallback(
    (cell: DayCell) => {
      if (cell.isFuture) {
        return "bg-transparent border border-dashed border-border/30 opacity-40 cursor-not-allowed";
      }

      if (cell.count === 0) {
        return "bg-slate-100 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 hover:border-slate-400";
      }

      if (theme === "emerald") {
        if (cell.count >= 5) return "bg-emerald-700 text-white border border-emerald-800 hover:ring-1 hover:ring-emerald-400";
        if (cell.count >= 3) return "bg-emerald-500 text-white border border-emerald-600 hover:ring-1 hover:ring-emerald-300";
        if (cell.count >= 2) return "bg-emerald-400 text-slate-900 border border-emerald-500 hover:ring-1 hover:ring-emerald-200";
        return "bg-emerald-200 dark:bg-emerald-900/70 border border-emerald-300 dark:border-emerald-800 hover:ring-1 hover:ring-emerald-300";
      }

      // Default: Blue theme (matches slash-admin healthcare theme)
      if (cell.count >= 5) return "bg-blue-700 text-white border border-blue-800 hover:ring-1 hover:ring-blue-400";
      if (cell.count >= 3) return "bg-blue-500 text-white border border-blue-600 hover:ring-1 hover:ring-blue-300";
      if (cell.count >= 2) return "bg-blue-400 text-slate-900 border border-blue-500 hover:ring-1 hover:ring-blue-200";
      return "bg-blue-200 dark:bg-blue-900/70 border border-blue-300 dark:border-blue-800 hover:ring-1 hover:ring-blue-300";
    },
    [theme]
  );

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="pb-3 border-b">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center text-blue-600">
              <Icon icon="solar:chart-square-bold-duotone" size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-base leading-tight">{title}</h3>
                <Icon icon="solar:alt-arrow-down-bold" size={14} className="text-muted-foreground" />
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Activity distribution across 52 weeks (7 days/week)
              </p>
            </div>
          </div>

          {/* Stats Badges & Controls */}
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-xs py-1 px-2.5 bg-background shadow-xs font-normal">
              <span className="font-semibold text-foreground mr-1">{totalTransactions}</span> transactions
            </Badge>
            <Badge variant="outline" className="text-xs py-1 px-2.5 bg-background shadow-xs font-normal">
              <span className="font-semibold text-foreground mr-1">{activeDaysCount}</span> active days
            </Badge>

            {/* Color Scheme Picker */}
            <div className="flex items-center rounded-md border bg-muted/40 p-0.5 ml-1">
              <button
                type="button"
                title="Blue theme"
                onClick={() => setTheme("blue")}
                className={cn(
                  "w-5 h-5 rounded-sm flex items-center justify-center transition-all",
                  theme === "blue" ? "bg-background shadow-xs" : "opacity-50 hover:opacity-100"
                )}
              >
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
              </button>
              <button
                type="button"
                title="Frappe Emerald theme"
                onClick={() => setTheme("emerald")}
                className={cn(
                  "w-5 h-5 rounded-sm flex items-center justify-center transition-all",
                  theme === "emerald" ? "bg-background shadow-xs" : "opacity-50 hover:opacity-100"
                )}
              >
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              </button>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-4">
        {/* Heatmap Outer Scroll Container */}
        <div
          ref={containerRef}
          className="relative overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-muted-foreground/20"
          onMouseLeave={() => setHoveredCell(null)}
        >
          <div className="inline-block min-w-[760px] select-none">
            {/* ── Top Month Labels Header ────────────────────── */}
            <div className="flex items-center mb-1.5 pl-9">
              {weeks.map((w, idx) => (
                <div
                  key={idx}
                  className="w-[12px] mr-[3px] text-[10px] text-muted-foreground font-medium shrink-0 h-4 flex items-center"
                >
                  {w.monthLabel ? (
                    <span className="truncate leading-none uppercase tracking-wider text-[9px]">
                      {w.monthLabel}
                    </span>
                  ) : null}
                </div>
              ))}
            </div>

            {/* ── Main 7-Row Grid with Left Day Labels ──────── */}
            <div className="flex items-start">
              {/* Vertical Day Labels (Sun..Sat or Mon..Sun) */}
              <div className="flex flex-col gap-[3px] pr-2 shrink-0 w-8">
                {dayLabels.map((label, dIdx) => (
                  <div
                    key={dIdx}
                    className="h-[12px] text-[10px] text-muted-foreground font-medium leading-[12px] text-right flex items-center justify-end"
                  >
                    {label}
                  </div>
                ))}
              </div>

              {/* 52 Week Columns */}
              <div className="flex gap-[3px]">
                {weeks.map((week) => (
                  <div key={week.weekIndex} className="flex flex-col gap-[3px]">
                    {week.days.map((cell) => {
                      const titleText = cell.isFuture
                        ? `${formatDisplayDate(cell.date)} (Future)`
                        : cell.count === 0
                        ? `No transactions on ${formatDisplayDate(cell.date)}`
                        : `${cell.count} transaction${cell.count > 1 ? "s" : ""} on ${formatDisplayDate(cell.date)}`;

                      return (
                        <div
                          key={cell.dateStr}
                          title={titleText}
                          onClick={() => {
                            if (!cell.isFuture) {
                              onSelectDate?.(cell.dateStr, cell.items);
                            }
                          }}
                          onMouseEnter={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            setHoveredCell({ cell, rect });
                          }}
                          className={cn(
                            "w-[12px] h-[12px] rounded-[2px] transition-all cursor-pointer",
                            getCellColorClass(cell),
                            cell.isToday && "ring-1.5 ring-offset-1 ring-blue-600 dark:ring-blue-400 z-10"
                          )}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Floating Interactive Hover Tooltip ─────────── */}
          {hoveredCell && containerRef.current && (
            <FloatingTooltip
              cell={hoveredCell.cell}
              triggerRect={hoveredCell.rect}
              containerEl={containerRef.current}
            />
          )}
        </div>

        {/* ── Footer: Marley Prompt & Color Legend ─────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-4 pt-3 border-t text-xs text-muted-foreground">
          <p className="flex items-center gap-1.5">
            <Icon icon="solar:info-circle-linear" size={14} className="shrink-0 text-blue-500" />
            <span>{message}</span>
          </p>

          {/* Frappe/GitHub Style "Less ... More" Legend */}
          <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
            <span className="text-[11px] text-muted-foreground mr-0.5">Less</span>
            <span
              className="w-2.5 h-2.5 rounded-[2px] bg-slate-100 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60"
              title="0 transactions"
            />
            <span
              className={cn(
                "w-2.5 h-2.5 rounded-[2px]",
                theme === "emerald" ? "bg-emerald-200 dark:bg-emerald-900/70" : "bg-blue-200 dark:bg-blue-900/70"
              )}
              title="1 transaction"
            />
            <span
              className={cn(
                "w-2.5 h-2.5 rounded-[2px]",
                theme === "emerald" ? "bg-emerald-400 dark:bg-emerald-700" : "bg-blue-400 dark:bg-blue-700"
              )}
              title="2 transactions"
            />
            <span
              className={cn(
                "w-2.5 h-2.5 rounded-[2px]",
                theme === "emerald" ? "bg-emerald-500" : "bg-blue-500"
              )}
              title="3-4 transactions"
            />
            <span
              className={cn(
                "w-2.5 h-2.5 rounded-[2px]",
                theme === "emerald" ? "bg-emerald-700" : "bg-blue-700"
              )}
              title="5+ transactions"
            />
            <span className="text-[11px] text-muted-foreground ml-0.5">More</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Floating tooltip anchored relative to container to avoid clipping.
 */
function FloatingTooltip({
  cell,
  triggerRect,
  containerEl,
}: {
  cell: DayCell;
  triggerRect: DOMRect;
  containerEl: HTMLElement;
}) {
  const containerRect = containerEl.getBoundingClientRect();
  const left = triggerRect.left - containerRect.left + containerEl.scrollLeft + 6;
  const top = triggerRect.top - containerRect.top + containerEl.scrollTop - 8;

  // Bound left position so it doesn't overflow right edge
  const clampedLeft = Math.max(8, Math.min(left, containerEl.scrollWidth - 220));

  // If trigger is near the top of container, flip tooltip below cell instead of above
  const isNearTop = top < 110;
  const transform = isNearTop ? "translate(-50%, 22px)" : "translate(-50%, -100%)";

  return (
    <div
      style={{
        position: "absolute",
        left: `${clampedLeft}px`,
        top: `${top}px`,
        transform,
      }}
      className="pointer-events-none z-50 min-w-[190px] max-w-[260px] rounded-md bg-slate-900 text-white p-2.5 text-xs shadow-xl animate-in fade-in-0 zoom-in-95"
    >
      <div className="font-semibold text-slate-100 flex items-center justify-between gap-2 border-b border-slate-700/80 pb-1 mb-1.5">
        <span>{formatDisplayDate(cell.date)}</span>
        {cell.isToday && (
          <span className="text-[10px] bg-blue-500/30 text-blue-300 px-1 py-0.2 rounded font-normal">
            Today
          </span>
        )}
      </div>

      <div className="text-slate-300 text-[11px] mb-1">
        {cell.isFuture ? (
          <span className="text-slate-400 italic">Future date</span>
        ) : cell.count === 0 ? (
          <span className="text-slate-400">No transactions recorded</span>
        ) : (
          <span className="font-medium text-emerald-400">
            {cell.count} transaction{cell.count > 1 ? "s" : ""}
          </span>
        )}
      </div>

      {cell.items && cell.items.length > 0 && (
        <div className="space-y-1 mt-1.5 pt-1 border-t border-slate-800">
          {cell.items.slice(0, 3).map((item, i) => (
            <div key={i} className="text-[10px] text-slate-300 truncate flex items-center gap-1">
              <span className="w-1 h-1 rounded-full bg-blue-400 shrink-0" />
              <span className="truncate">{item.text || item.reference_doctype || "Transaction"}</span>
            </div>
          ))}
          {cell.items.length > 3 && (
            <div className="text-[10px] text-slate-400 italic">
              +{cell.items.length - 3} more...
            </div>
          )}
        </div>
      )}
    </div>
  );
}
