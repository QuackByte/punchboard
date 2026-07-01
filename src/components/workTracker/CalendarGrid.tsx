import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
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
  extraHours: Record<string, number>;
  hoursPerDay: number;
  today: Date;
  onSetException: (key: string, type: ExceptionType | "none") => void;
  onHoursChange: (key: string, value: number) => void;
  onExtraHoursChange: (key: string, value: number) => void;
}

interface MenuState {
  key: string;
  hasException: boolean;
  x: number;
  y: number;
}

export default function CalendarGrid({
  cells,
  payslipDateLookup,
  workingDateLookup,
  selectedMonthInfo,
  exceptions,
  dailyHours,
  extraHours,
  hoursPerDay,
  today,
  onSetException,
  onHoursChange,
  onExtraHoursChange,
}: CalendarGridProps) {
  const [menu, setMenu] = useState<MenuState | null>(null);

  useEffect(() => {
    if (!menu) return;
    const closeMenu = () => setMenu(null);
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenu(null);
      }
    };
    window.addEventListener("click", closeMenu);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("click", closeMenu);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [menu]);

  const openMenuAt = (
    key: string,
    hasException: boolean,
    x: number,
    y: number,
  ) => {
    setMenu({ key, hasException, x, y });
  };

  return (
    <>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
          {selectedMonthInfo.label}
        </p>
        <p className="text-xs text-slate-400 dark:text-slate-500">
          <span aria-hidden="true">⋮</span> or right-click a workday to mark
          vacation/sick
        </p>
      </div>

      <div className="grid grid-cols-7 gap-2 border-b border-slate-200 pb-2 text-center text-xs font-medium uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400">
        {calendarHeaders.map((header) => (
          <div key={header}>{header}</div>
        ))}
      </div>

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
          const canLogExtraHours = inPayslipRange && !isWorkingDay;
          const extraHoursForDay = extraHours[key] ?? 0;
          const monthTag = cell.toLocaleDateString("en-US", {
            month: "short",
          });

          const backgroundClass = exceptionType
            ? exceptionType === "vacation"
              ? "border-amber-300/80 bg-amber-400/20"
              : "border-rose-300/80 bg-rose-400/20"
            : isWorkingDay
              ? "border-cyan-400/70 bg-cyan-500/20"
              : canLogExtraHours && extraHoursForDay > 0
                ? "border-violet-300/80 bg-violet-400/20"
                : inPayslipRange
                  ? "border-slate-300 bg-slate-200/80 dark:border-slate-600 dark:bg-slate-800/80"
                  : "border-slate-200 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-950/70";

          return (
            <div
              key={key}
              onContextMenu={
                isWorkingDay
                  ? (event) => {
                      event.preventDefault();
                      openMenuAt(
                        key,
                        !!exceptionType,
                        event.clientX,
                        event.clientY,
                      );
                    }
                  : undefined
              }
              className={`h-20 rounded-lg border p-2 text-left transition ${backgroundClass} ${
                isToday ? "ring-2 ring-amber-400/80" : ""
              } ${!isInSelectedMonth ? "opacity-80" : ""}`}
            >
              <div className="flex items-center justify-between gap-1">
                <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                  {cell.getDate()}
                </p>
                <div className="flex items-center gap-1">
                  {!isInSelectedMonth ? (
                    <span className="rounded border border-slate-300 bg-white/80 px-1.5 py-0.5 text-[10px] uppercase text-slate-600 dark:border-slate-600 dark:bg-slate-900/80 dark:text-slate-300">
                      {monthTag}
                    </span>
                  ) : null}
                  {isWorkingDay ? (
                    <button
                      type="button"
                      aria-label={`Mark vacation or sick for ${cell.toDateString()}`}
                      aria-haspopup="menu"
                      onClick={(event) => {
                        event.stopPropagation();
                        const rect =
                          event.currentTarget.getBoundingClientRect();
                        openMenuAt(
                          key,
                          !!exceptionType,
                          rect.left,
                          rect.bottom + 4,
                        );
                      }}
                      className="flex h-4 w-4 shrink-0 items-center justify-center rounded text-slate-400 transition hover:bg-slate-300/60 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-slate-700/60 dark:hover:text-slate-200"
                    >
                      <span aria-hidden="true">⋮</span>
                    </button>
                  ) : null}
                </div>
              </div>

              <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">
                {exceptionType === "vacation"
                  ? "Vacation"
                  : exceptionType === "sick"
                    ? "Sick"
                    : isWorkingDay
                      ? "Workday"
                      : canLogExtraHours && extraHoursForDay > 0
                        ? "Extra hours"
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
              ) : canLogExtraHours ? (
                <input
                  className="mt-1 w-full rounded border border-violet-300 bg-white/70 px-1.5 py-0.5 text-[10px] text-slate-800 outline-none ring-violet-500 placeholder:text-slate-400 focus:ring-1 dark:border-violet-700 dark:bg-slate-950/70 dark:text-slate-100"
                  type="number"
                  min={0}
                  max={24}
                  step={0.5}
                  placeholder="+ extra hrs"
                  value={extraHoursForDay || ""}
                  onClick={(event) => event.stopPropagation()}
                  onChange={(event) =>
                    onExtraHoursChange(key, Number(event.target.value))
                  }
                />
              ) : null}
            </div>
          );
        })}
      </div>

      {menu
        ? createPortal(
            <div
              role="menu"
              className="fixed z-50 w-40 overflow-hidden rounded-lg border border-slate-300 bg-white text-sm shadow-xl dark:border-slate-700 dark:bg-slate-900"
              style={{ left: menu.x, top: menu.y }}
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  onSetException(menu.key, "vacation");
                  setMenu(null);
                }}
                className="block w-full px-3 py-2 text-left text-amber-700 hover:bg-amber-400/10 dark:text-amber-200"
              >
                Mark vacation
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  onSetException(menu.key, "sick");
                  setMenu(null);
                }}
                className="block w-full px-3 py-2 text-left text-rose-700 hover:bg-rose-400/10 dark:text-rose-200"
              >
                Mark sick
              </button>
              {menu.hasException ? (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onSetException(menu.key, "none");
                    setMenu(null);
                  }}
                  className="block w-full border-t border-slate-200 px-3 py-2 text-left text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Clear mark
                </button>
              ) : null}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
