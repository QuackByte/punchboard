import { MarkMode } from "./types";

interface CalendarMarkModeBarProps {
  exceptionMode: MarkMode;
  onModeChange: (mode: MarkMode) => void;
}

const inactiveBtn =
  "border-slate-300 bg-white text-slate-600 hover:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-500";

export default function CalendarMarkModeBar({
  exceptionMode,
  onModeChange,
}: CalendarMarkModeBarProps) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-700 dark:bg-slate-950/70">
      <span className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
        Calendar mark mode
      </span>
      <button
        type="button"
        onClick={() => onModeChange("vacation")}
        className={`rounded-md border px-2.5 py-1.5 text-xs font-medium transition ${
          exceptionMode === "vacation"
            ? "border-amber-300 bg-amber-400/20 text-amber-700 dark:text-amber-100"
            : inactiveBtn
        }`}
      >
        Vacation
      </button>
      <button
        type="button"
        onClick={() => onModeChange("sick")}
        className={`rounded-md border px-2.5 py-1.5 text-xs font-medium transition ${
          exceptionMode === "sick"
            ? "border-rose-300 bg-rose-400/20 text-rose-700 dark:text-rose-100"
            : inactiveBtn
        }`}
      >
        Sick
      </button>
      <button
        type="button"
        onClick={() => onModeChange("none")}
        className={`rounded-md border px-2.5 py-1.5 text-xs font-medium transition ${
          exceptionMode === "none"
            ? "border-slate-400 bg-slate-200 text-slate-800 dark:border-slate-400 dark:bg-slate-700 dark:text-slate-100"
            : inactiveBtn
        }`}
      >
        Clear
      </button>
      <span className="ml-auto text-xs text-slate-500 dark:text-slate-400">
        Set hours per day and mark exceptions
      </span>
    </div>
  );
}
