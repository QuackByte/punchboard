import { ReactNode, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ActivityLogEntry,
  CurrencyCode,
  DayKey,
  currencyOptions,
  daysOfWeek,
} from "./types";
import { clampDay, clampPercent } from "./utils";

interface ConfigPanelProps {
  savedMonthsCount: number;
  lastSavedAt: string;
  onClose: () => void;
  selectedDays: DayKey[];
  onToggleDay: (key: DayKey) => void;
  hoursPerDay: number;
  onHoursPerDayChange: (value: number) => void;
  hourlyRate: number;
  onHourlyRateChange: (value: number) => void;
  currency: CurrencyCode;
  onCurrencyChange: (value: CurrencyCode) => void;
  secondaryCurrency: CurrencyCode;
  onSecondaryCurrencyChange: (value: CurrencyCode) => void;
  conversionRate: number;
  onConversionRateChange: (value: number) => void;
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
  isFileMode: boolean;
  filePath: string;
  onChangeFile: () => void;
}

const inputClass =
  "mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-800 outline-none ring-cyan-500 transition focus:ring-2 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100";
const labelClass = "text-sm font-medium text-slate-600 dark:text-slate-300";

function Section({
  title,
  children,
  first = false,
}: {
  title: string;
  children: ReactNode;
  first?: boolean;
}) {
  return (
    <div
      className={
        first
          ? "mt-6"
          : "mt-6 border-t border-slate-200 pt-6 dark:border-slate-800"
      }
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
        {title}
      </p>
      <div className="mt-3 space-y-4">{children}</div>
    </div>
  );
}

export default function ConfigPanel({
  savedMonthsCount,
  lastSavedAt,
  onClose,
  selectedDays,
  onToggleDay,
  hoursPerDay,
  onHoursPerDayChange,
  hourlyRate,
  onHourlyRateChange,
  currency,
  onCurrencyChange,
  secondaryCurrency,
  onSecondaryCurrencyChange,
  conversionRate,
  onConversionRateChange,
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
  isFileMode,
  filePath,
  onChangeFile,
}: ConfigPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

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

  return createPortal(
    <div
      className="fixed inset-0 z-40 flex justify-end bg-slate-950/50"
      onClick={onClose}
    >
      <section
        onClick={(event) => event.stopPropagation()}
        className={`h-full w-full max-w-sm overflow-y-auto border-l border-slate-200 bg-white p-6 shadow-xl transition-transform duration-200 ease-out dark:border-slate-800 dark:bg-slate-900 ${
          entered ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white">
            Settings
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Hide settings"
            className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-600 transition hover:border-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:border-slate-500"
          >
            ✕
          </button>
        </div>

      <Section title="File" first>
        <p className="text-xs text-slate-400 dark:text-slate-500">
          {isFileMode ? (
            <>
              <span className="block truncate" title={filePath}>
                📁 {filePath || "No file chosen"}
              </span>
              <span>
                Months saved: {savedMonthsCount} | Last save:{" "}
                {lastSavedAt
                  ? new Date(lastSavedAt).toLocaleString()
                  : "not yet"}
              </span>
            </>
          ) : (
            <>
              Saved months: {savedMonthsCount} | Last save:{" "}
              {lastSavedAt ? new Date(lastSavedAt).toLocaleString() : "not yet"}
            </>
          )}
        </p>

        <div className="flex gap-2">
          {isFileMode && (
            <button
              type="button"
              onClick={onChangeFile}
              className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:border-cyan-400 hover:text-cyan-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:border-cyan-500 dark:hover:text-cyan-300"
            >
              Change file
            </button>
          )}
          <button
            type="button"
            onClick={onExportData}
            className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:border-cyan-400 hover:text-cyan-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:border-cyan-500 dark:hover:text-cyan-300"
          >
            {isFileMode ? "Save backup copy" : "Export backup"}
          </button>
          <button
            type="button"
            onClick={handleImportClick}
            className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:border-cyan-400 hover:text-cyan-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:border-cyan-500 dark:hover:text-cyan-300"
          >
            {isFileMode ? "Restore backup" : "Import backup"}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
      </Section>

      <Section title="Schedule">
        <div>
          <p className={labelClass}>Working weekdays</p>
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

        <label className={labelClass}>
          Payslip start day
          <input
            className={inputClass}
            type="number"
            min={1}
            max={31}
            value={payslipStartDay}
            onChange={(event) =>
              onPayslipStartDayChange(clampDay(Number(event.target.value)))
            }
          />
        </label>
      </Section>

      <Section title="Pay & currency">
        <div className="grid grid-cols-2 gap-3">
          <label className={labelClass}>
            Hours/day
            <input
              className={inputClass}
              type="number"
              min={0}
              value={hoursPerDay}
              onChange={(event) =>
                onHoursPerDayChange(Number(event.target.value))
              }
            />
          </label>

          <label className={labelClass}>
            Rate (per hour)
            <input
              className={inputClass}
              type="number"
              min={0}
              value={hourlyRate}
              onChange={(event) =>
                onHourlyRateChange(Number(event.target.value))
              }
            />
          </label>

          <label className={labelClass}>
            Tax (%)
            <input
              className={inputClass}
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

          <label className={labelClass}>
            Extra deduction
            <input
              className={inputClass}
              type="number"
              min={0}
              step={0.01}
              value={extraDeduction}
              onChange={(event) =>
                onExtraDeductionChange(Number(event.target.value))
              }
            />
          </label>

          <label className="col-span-2 text-sm font-medium text-slate-600 dark:text-slate-300">
            Holiday hours/day
            <input
              className={inputClass}
              type="number"
              min={0}
              value={defaultHours}
              onChange={(event) =>
                onDefaultHoursChange(Number(event.target.value))
              }
            />
          </label>
        </div>

        <div>
          <p className={labelClass}>Currency conversion</p>
          <div className="mt-2 flex items-center gap-2">
            <select
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-800 outline-none ring-cyan-500 transition focus:ring-2 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              value={currency}
              onChange={(event) =>
                onCurrencyChange(event.target.value as CurrencyCode)
              }
            >
              {currencyOptions.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.code} ({option.symbol})
                </option>
              ))}
            </select>
            <span className="shrink-0 text-slate-400 dark:text-slate-500">
              →
            </span>
            <select
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-800 outline-none ring-cyan-500 transition focus:ring-2 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              value={secondaryCurrency}
              onChange={(event) =>
                onSecondaryCurrencyChange(event.target.value as CurrencyCode)
              }
            >
              {currencyOptions.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.code} ({option.symbol})
                </option>
              ))}
            </select>
          </div>

          <label className="mt-3 block text-sm font-medium text-slate-600 dark:text-slate-300">
            Conversion rate ({currency} → {secondaryCurrency})
            <input
              className={inputClass}
              type="number"
              min={0}
              step={0.0001}
              disabled={currency === secondaryCurrency}
              value={conversionRate}
              onChange={(event) =>
                onConversionRateChange(Number(event.target.value))
              }
            />
          </label>
        </div>
      </Section>

      <Section title="Recent activity">
        <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3 dark:border-slate-800 dark:bg-slate-950/60">
          {recentActivity.length === 0 ? (
            <p className="text-xs text-slate-400 dark:text-slate-500">
              No activity yet.
            </p>
          ) : (
            <div className="space-y-1">
              {recentActivity.map((entry) => (
                <p
                  key={entry.id}
                  className="text-xs text-slate-600 dark:text-slate-300"
                >
                  {new Date(entry.timestamp).toLocaleString()} - {entry.message}
                </p>
              ))}
            </div>
          )}
        </div>
      </Section>
      </section>
    </div>,
    document.body,
  );
}
