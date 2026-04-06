import { calendarHeaders, ExceptionType } from "./types";
import { dateKey } from "./utils";

interface SelectedMonthInfo {
  year: number;
  monthIndex: number;
  label: string;
}

interface CalendarGridProps {
  cells: Array<Date | null>;
  payslipDateLookup: Set<string>;
  workingDateLookup: Set<string>;
  selectedMonthInfo: SelectedMonthInfo;
  exceptions: Record<string, ExceptionType>;
  dailyHours: Record<string, number>;
  hoursPerDay: number;
  today: Date;
  onCellClick: (key: string) => void;
  onHoursChange: (key: string, value: number) => void;
}

export default function CalendarGrid({
  cells,
  payslipDateLookup,
  workingDateLookup,
  selectedMonthInfo,
  exceptions,
  dailyHours,
  hoursPerDay,
  today,
  onCellClick,
  onHoursChange,
}: CalendarGridProps) {
  return (
    <>
      <div className="grid grid-cols-7 gap-2 text-center text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {calendarHeaders.map((header) => (
          <div key={header}>{header}</div>
        ))}
      </div>

      <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
        Main month: {selectedMonthInfo.label}. Days from other months are tagged
        with their month abbreviation.
      </p>

      <div className="mt-2 grid grid-cols-7 gap-2">
        {cells.map((cell, index) => {
          if (!cell) {
            return (
              <div
                key={`empty-${index}`}
                className="h-20 rounded-lg border border-transparent bg-slate-200/30 dark:bg-slate-950/30"
              />
            );
          }

          const key = dateKey(cell);
          const inPayslipRange = payslipDateLookup.has(key);
          const isWorkingDay = workingDateLookup.has(key);
          const isToday = dateKey(today) === key;
          const isInSelectedMonth =
            cell.getFullYear() === selectedMonthInfo.year &&
            cell.getMonth() === selectedMonthInfo.monthIndex;
          const exceptionType = exceptions[key];
          const hoursForDay =
            exceptionType === "vacation"
              ? (dailyHours[key] ?? 0)
              : (dailyHours[key] ?? hoursPerDay);
          const monthTag = cell.toLocaleDateString("en-US", {
            month: "short",
          });

          const backgroundClass = exceptionType
            ? exceptionType === "vacation"
              ? "border-amber-300/80 bg-amber-400/20"
              : "border-rose-300/80 bg-rose-400/20"
            : isWorkingDay
              ? "border-cyan-400/70 bg-cyan-500/20"
              : inPayslipRange
                ? "border-slate-300 bg-slate-200/80 dark:border-slate-600 dark:bg-slate-800/80"
                : "border-slate-200 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-950/70";

          return (
            <div
              key={key}
              onClick={isWorkingDay ? () => onCellClick(key) : undefined}
              className={`h-20 rounded-lg border p-2 text-left transition ${backgroundClass} ${
                isToday ? "ring-2 ring-amber-400/80" : ""
              } ${!isInSelectedMonth ? "opacity-80" : ""} ${
                isWorkingDay
                  ? "cursor-pointer hover:-translate-y-0.5"
                  : "cursor-default"
              }`}
            >
              <div className="flex items-center justify-between gap-1">
                <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                  {cell.getDate()}
                </p>
                {!isInSelectedMonth ? (
                  <span className="rounded border border-slate-300 bg-white/80 px-1.5 py-0.5 text-[10px] uppercase text-slate-600 dark:border-slate-600 dark:bg-slate-900/80 dark:text-slate-300">
                    {monthTag}
                  </span>
                ) : null}
              </div>

              <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">
                {exceptionType === "vacation"
                  ? "Vacation"
                  : exceptionType === "sick"
                    ? "Sick"
                    : isWorkingDay
                      ? "Workday"
                      : inPayslipRange
                        ? "In period"
                        : "-"}
              </p>

              {isWorkingDay ? (
                <input
                  className="mt-1 w-full rounded border border-slate-300 bg-white/70 px-1.5 py-0.5 text-[10px] text-slate-800 outline-none ring-cyan-500 focus:ring-1 dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-100"
                  type="number"
                  min={0}
                  max={24}
                  step={0.5}
                  value={hoursForDay}
                  onClick={(event) => event.stopPropagation()}
                  onChange={(event) =>
                    onHoursChange(key, Number(event.target.value))
                  }
                />
              ) : null}
            </div>
          );
        })}
      </div>
    </>
  );
}
