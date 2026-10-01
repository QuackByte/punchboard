import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { YearlyDataPoint } from "./types";
import { formatDuration } from "./utils";

interface YearlyOverviewProps {
  graphYear: number;
  selectedMonthKey: string;
  onPrevYear: () => void;
  onNextYear: () => void;
  onSelectMonth: (monthKey: string) => void;
  yearlyData: YearlyDataPoint[];
}

export default function YearlyOverview({
  graphYear,
  selectedMonthKey,
  onPrevYear,
  onNextYear,
  onSelectMonth,
  yearlyData,
}: YearlyOverviewProps) {
  const maxHours = Math.max(
    ...yearlyData.map((monthData) => monthData.actualHours),
    1,
  );
  const tracked = yearlyData.filter((monthData) => monthData.actualHours > 0);
  const yearTotal = tracked.reduce(
    (total, monthData) => total + monthData.actualHours,
    0,
  );
  const monthlyAverage = tracked.length > 0 ? yearTotal / tracked.length : 0;

  return (
    <section aria-label="Yearly overview" className="panel p-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="stamp">05 · Year</span>
          <div className="mt-1 flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              aria-label="Previous year"
              onClick={onPrevYear}
            >
              <ChevronLeft />
            </Button>
            <h2 className="w-16 text-center font-mono text-2xl font-semibold tabular">
              {graphYear}
            </h2>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              aria-label="Next year"
              onClick={onNextYear}
            >
              <ChevronRight />
            </Button>
          </div>
        </div>

        <dl className="flex gap-6 font-mono">
          <div>
            <dt className="stamp">Total</dt>
            <dd className="text-lg font-semibold tabular">
              {formatDuration(yearTotal)}
            </dd>
          </div>
          <div>
            <dt className="stamp">Avg / month</dt>
            <dd className="text-lg font-semibold tabular">
              {formatDuration(monthlyAverage)}
            </dd>
          </div>
        </dl>
      </div>

      <div className="mt-6 grid h-40 grid-cols-12 items-end gap-2 sm:gap-3">
        {yearlyData.map((monthData) => {
          const heightPercent =
            monthData.actualHours > 0
              ? Math.max((monthData.actualHours / maxHours) * 100, 4)
              : 0;
          const isSelected = monthData.monthKey === selectedMonthKey;

          return (
            <button
              key={monthData.monthKey}
              type="button"
              onClick={() => onSelectMonth(monthData.monthKey)}
              aria-label={`${monthData.month} ${graphYear}: ${formatDuration(monthData.actualHours)}`}
              className="group flex h-full flex-col items-center justify-end gap-1.5 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span
                className={cn(
                  "font-mono text-[10px] tabular text-muted-foreground transition-opacity",
                  monthData.actualHours > 0 || isSelected
                    ? "opacity-100"
                    : "opacity-0 group-hover:opacity-100",
                  isSelected && "font-semibold text-foreground",
                )}
              >
                {Math.round(monthData.actualHours)}h
              </span>
              <div className="relative w-full flex-1">
                <div
                  className={cn(
                    "absolute inset-x-0 bottom-0 rounded-md transition-[height,background-color] duration-500 ease-out",
                    isSelected
                      ? "bg-primary"
                      : "bg-foreground/15 group-hover:bg-primary/50",
                    monthData.actualHours === 0 &&
                      "h-1 border-t border-dashed border-muted-foreground/40 bg-transparent",
                  )}
                  style={
                    monthData.actualHours > 0
                      ? { height: `${heightPercent}%` }
                      : undefined
                  }
                />
              </div>
            </button>
          );
        })}
      </div>
      <div className="mt-2 grid grid-cols-12 gap-2 border-t pt-2 sm:gap-3">
        {yearlyData.map((monthData) => (
          <span
            key={monthData.monthKey}
            className={cn(
              "text-center font-mono text-[10.5px] uppercase tracking-wider text-muted-foreground",
              monthData.monthKey === selectedMonthKey &&
                "font-semibold text-foreground",
            )}
          >
            {monthData.month}
          </span>
        ))}
      </div>
    </section>
  );
}
