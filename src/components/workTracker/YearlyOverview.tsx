import { YearlyDataPoint } from "./types";

interface YearlyOverviewProps {
  graphYear: number;
  onPrevYear: () => void;
  onNextYear: () => void;
  yearlyData: YearlyDataPoint[];
}

export default function YearlyOverview({
  graphYear,
  onPrevYear,
  onNextYear,
  yearlyData,
}: YearlyOverviewProps) {
  const maxHours = Math.max(
    ...yearlyData.map((monthData) => monthData.actualHours),
    1,
  );

  return (
    <div className="mx-auto mt-8 w-full max-w-6xl rounded-2xl border border-slate-200 bg-white/70 p-6 shadow-xl backdrop-blur dark:border-slate-800 dark:bg-slate-900/70">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
          Yearly Overview
        </h2>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onPrevYear}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 transition hover:border-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:border-slate-500"
          >
            ← Prev
          </button>
          <span className="w-20 text-center text-lg font-semibold">
            {graphYear}
          </span>
          <button
            type="button"
            onClick={onNextYear}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 transition hover:border-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:border-slate-500"
          >
            Next →
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        {/* Bar area — bars are direct flex children so height:% resolves correctly */}
        <div className="flex h-48 items-end justify-around gap-2 rounded-t-lg border border-b-0 border-slate-200 bg-slate-50/50 px-4 pt-6 dark:border-slate-700 dark:bg-slate-950/50">
          {yearlyData.map((monthData) => {
            const rawHeightPercent = (monthData.actualHours / maxHours) * 100;
            const heightPercent =
              monthData.actualHours > 0 ? Math.max(rawHeightPercent, 4) : 0;

            return (
              <div
                key={monthData.monthKey}
                className="group relative w-8 rounded-t-lg border border-cyan-500/50 bg-gradient-to-b from-cyan-500/40 to-cyan-500/20 transition hover:from-cyan-500/60 hover:to-cyan-500/30"
                style={{ height: `${heightPercent}%` }}
              >
                <div className="pointer-events-none absolute bottom-full left-1/2 mb-2 -translate-x-1/2 whitespace-nowrap rounded bg-slate-700 px-2 py-1 text-xs text-white opacity-0 transition group-hover:opacity-100 dark:bg-slate-900 dark:text-cyan-100">
                  {monthData.actualHours.toFixed(1)}h
                </div>
              </div>
            );
          })}
        </div>

        {/* Labels row — separate from bar area so they don't affect bar height resolution */}
        <div className="flex justify-around gap-2 rounded-b-lg border border-t border-slate-200 bg-slate-50/50 px-4 py-2 dark:border-slate-700 dark:bg-slate-950/50">
          {yearlyData.map((monthData) => (
            <div
              key={monthData.monthKey}
              className="flex w-8 flex-col items-center gap-0.5"
            >
              <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
                {monthData.month}
              </p>
              <p className="text-[10px] text-slate-400 dark:text-slate-500">
                {monthData.actualHours.toFixed(0)}h
              </p>
            </div>
          ))}
        </div>
      </div>

      <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
        Bar height represents worked hours. Hover over bars to see exact hours.
      </p>
    </div>
  );
}
