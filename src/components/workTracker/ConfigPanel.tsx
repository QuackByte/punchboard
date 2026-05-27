import { useRef } from "react";
import { ActivityLogEntry, DayKey, daysOfWeek } from "./types";
import ThemeToggle from "./ThemeToggle";
import { Theme } from "./useTheme";
import { clampDay, clampPercent } from "./utils";

interface ConfigPanelProps {
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
  savedMonthsCount: number;
  lastSavedAt: string;
  monthKey: string;
  onMonthChange: (month: string) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  selectedDays: DayKey[];
  onToggleDay: (key: DayKey) => void;
  hoursPerDay: number;
  onHoursPerDayChange: (value: number) => void;
  hourlyRate: number;
  onHourlyRateChange: (value: number) => void;
  taxPercent: number;
  onTaxPercentChange: (value: number) => void;
  extraDeduction: number;
  onExtraDeductionChange: (value: number) => void;
  payslipStartDay: number;
  onPayslipStartDayChange: (value: number) => void;
  defaultHours: number;
  onDefaultHoursChange: (value: number) => void;
  recentActivity: ActivityLogEntry[];
  onExportData: () => void;
  onImportData: (file: File) => void;
}

export default function ConfigPanel({
  theme,
  onThemeChange,
  savedMonthsCount,
  lastSavedAt,
  monthKey,
  onMonthChange,
  onPrevMonth,
  onNextMonth,
  selectedDays,
  onToggleDay,
  hoursPerDay,
  onHoursPerDayChange,
  hourlyRate,
  onHourlyRateChange,
  taxPercent,
  onTaxPercentChange,
  extraDeduction,
  onExtraDeductionChange,
  payslipStartDay,
  onPayslipStartDayChange,
  defaultHours,
  onDefaultHoursChange,
  recentActivity,
  onExportData,
  onImportData,
}: ConfigPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onImportData(file);
      event.target.value = "";
    }
  };
  return (
    <section className="rounded-2xl border border-slate-200 bg-white/70 p-6 shadow-xl backdrop-blur dark:border-slate-800 dark:bg-slate-900/70">
      <div className="flex items-start justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
          Work Hours Tracker
        </h1>
        <ThemeToggle theme={theme} onThemeChange={onThemeChange} />
      </div>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
        Configure your month, global payslip start day, and weekday schedule.
      </p>
      <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
        Saved months: {savedMonthsCount} | Last save:{" "}
        {lastSavedAt ? new Date(lastSavedAt).toLocaleString() : "not yet"}
      </p>

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={onExportData}
          className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:border-cyan-400 hover:text-cyan-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:border-cyan-500 dark:hover:text-cyan-300"
        >
          Export backup
        </button>
        <button
          type="button"
          onClick={handleImportClick}
          className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:border-cyan-400 hover:text-cyan-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:border-cyan-500 dark:hover:text-cyan-300"
        >
          Import backup
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      <div className="mt-6 space-y-4">
        <div>
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
            Payslip month (finishing month)
          </p>
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={onPrevMonth}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 transition hover:border-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:border-slate-500"
            >
              Prev
            </button>
            <input
              className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-800 outline-none ring-cyan-500 transition focus:ring-2 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              type="month"
              value={monthKey}
              onChange={(event) => onMonthChange(event.target.value)}
            />
            <button
              type="button"
              onClick={onNextMonth}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 transition hover:border-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:border-slate-500"
            >
              Next
            </button>
          </div>
        </div>

        <div>
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
            Working weekdays
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {daysOfWeek.map((day) => {
              const active = selectedDays.includes(day.key);
              return (
                <button
                  key={day.key}
                  type="button"
                  onClick={() => onToggleDay(day.key)}
                  className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                    active
                      ? "border-cyan-500 bg-cyan-500/20 text-cyan-700 dark:border-cyan-400 dark:text-cyan-200"
                      : "border-slate-300 bg-white text-slate-600 hover:border-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:border-slate-500"
                  }`}
                >
                  {day.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
            Hours/day
            <input
              className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-800 outline-none ring-cyan-500 transition focus:ring-2 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              type="number"
              min={0}
              value={hoursPerDay}
              onChange={(event) =>
                onHoursPerDayChange(Number(event.target.value))
              }
            />
          </label>

          <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
            Rate (per hour)
            <input
              className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-800 outline-none ring-cyan-500 transition focus:ring-2 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              type="number"
              min={0}
              value={hourlyRate}
              onChange={(event) =>
                onHourlyRateChange(Number(event.target.value))
              }
            />
          </label>

          <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
            Tax (%)
            <input
              className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-800 outline-none ring-cyan-500 transition focus:ring-2 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              type="number"
              min={0}
              max={100}
              step={0.1}
              value={taxPercent}
              onChange={(event) =>
                onTaxPercentChange(clampPercent(Number(event.target.value)))
              }
            />
          </label>

          <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
            Extra deduction
            <input
              className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-800 outline-none ring-cyan-500 transition focus:ring-2 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              type="number"
              min={0}
              step={0.01}
              value={extraDeduction}
              onChange={(event) =>
                onExtraDeductionChange(Number(event.target.value))
              }
            />
          </label>

          <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
            Payslip start day
            <input
              className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-800 outline-none ring-cyan-500 transition focus:ring-2 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              type="number"
              min={1}
              max={31}
              value={payslipStartDay}
              onChange={(event) =>
                onPayslipStartDayChange(clampDay(Number(event.target.value)))
              }
            />
          </label>

          <label className="col-span-2 text-sm font-medium text-slate-600 dark:text-slate-300">
            Default hours/day
            <input
              className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-800 outline-none ring-cyan-500 transition focus:ring-2 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              type="number"
              min={0}
              value={defaultHours}
              onChange={(event) =>
                onDefaultHoursChange(Number(event.target.value))
              }
            />
          </label>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3 dark:border-slate-800 dark:bg-slate-950/60">
          <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Recent activity
          </p>
          <div className="mt-2 space-y-1">
            {recentActivity.length === 0 ? (
              <p className="text-xs text-slate-400 dark:text-slate-500">
                No activity yet.
              </p>
            ) : (
              recentActivity.map((entry) => (
                <p
                  key={entry.id}
                  className="text-xs text-slate-600 dark:text-slate-300"
                >
                  {new Date(entry.timestamp).toLocaleString()} - {entry.message}
                </p>
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
