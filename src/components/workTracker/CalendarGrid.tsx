import { Fragment, ReactNode, useEffect, useRef } from "react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { workedTime } from "./calculations";
import DayEditor from "./DayEditor";
import { calendarHeaders, ExceptionType, TimeEntry, WorkRules } from "./types";
import { useNow } from "./useNow";
import {
  dateKey,
  formatDuration,
  keyToDate,
  minutesSinceMidnight,
  parseClock,
} from "./utils";

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
  periodLabel: string;
  exceptions: Record<string, ExceptionType>;
  dailyHours: Record<string, number>;
  extraHours: Record<string, number>;
  dailyActualHours: Record<string, number>;
  timeEntries: Record<string, TimeEntry[]>;
  hoursPerDay: number;
  workRules: WorkRules;
  today: Date;
  /** Bumped to move keyboard focus to today's cell. */
  focusTodayRequest: number;
  editingKey: string | null;
  onEditingKeyChange: (key: string | null) => void;
  onSetException: (key: string, type: ExceptionType | "none") => void;
  onApplyDayInput: (key: string, text: string) => boolean;
  onSetDayEntries: (key: string, entries: TimeEntry[]) => void;
  onRemoveSession: (key: string, index: number) => void;
  onResetDay: (key: string) => void;
}

const ARROW_STEPS: Record<string, number> = {
  ArrowLeft: -1,
  ArrowRight: 1,
  ArrowUp: -7,
  ArrowDown: 7,
};

/** Visible window of the day for the mini timeline in each cell. */
const TIMELINE_START = 6 * 60;
const TIMELINE_END = 22 * 60;

function chunkIntoWeeks<T>(items: T[]): T[][] {
  const weeks: T[][] = [];
  for (let index = 0; index < items.length; index += 7) {
    weeks.push(items.slice(index, index + 7));
  }
  return weeks;
}

function isoWeekNumber(date: Date) {
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayNumber = (target.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNumber + 3);
  const firstThursday = new Date(target.getFullYear(), 0, 4);
  return (
    1 +
    Math.round(
      ((target.getTime() - firstThursday.getTime()) / 86400000 -
        3 +
        ((firstThursday.getDay() + 6) % 7)) /
        7,
    )
  );
}

function Timeline({
  entries,
  nowMinutes,
}: {
  entries: TimeEntry[];
  nowMinutes?: number;
}) {
  const span = TIMELINE_END - TIMELINE_START;
  const clampPct = (minutes: number) =>
    (Math.min(Math.max(minutes, TIMELINE_START), TIMELINE_END) -
      TIMELINE_START) /
    span;

  return (
    <div className="relative h-1 overflow-hidden rounded-full bg-foreground/[0.07]">
      {entries.map((entry, index) => {
        const start = parseClock(entry.start);
        const endText = entry.end;
        let end =
          endText !== null
            ? parseClock(endText)
            : nowMinutes !== undefined
              ? nowMinutes
              : null;
        if (start === null || end === null) {
          return null;
        }
        if (end < start) {
          end = TIMELINE_END;
        }
        const left = clampPct(start);
        const width = Math.max(clampPct(end) - left, 0.02);
        return (
          <span
            key={index}
            className={cn(
              "absolute inset-y-0 rounded-full",
              entry.end === null ? "bg-signal" : "bg-primary",
            )}
            style={{ left: `${left * 100}%`, width: `${width * 100}%` }}
          />
        );
      })}
    </div>
  );
}

export default function CalendarGrid({
  cells,
  payslipDateLookup,
  workingDateLookup,
  selectedMonthInfo,
  periodLabel,
  exceptions,
  dailyHours,
  extraHours,
  dailyActualHours,
  timeEntries,
  hoursPerDay,
  workRules,
  today,
  focusTodayRequest,
  editingKey,
  onEditingKeyChange,
  onSetException,
  onApplyDayInput,
  onSetDayEntries,
  onRemoveSession,
  onResetDay,
}: CalendarGridProps) {
  const now = useNow(30_000);
  const nowMinutes = minutesSinceMidnight(now);
  const todayKey = dateKey(today);
  const cellRefs = useRef(new Map<string, HTMLButtonElement>());

  // When the editor is opened from elsewhere (e.g. the punch clock), bring
  // the day into view so its popover has something to anchor to.
  useEffect(() => {
    if (!editingKey) return;
    cellRefs.current
      .get(editingKey)
      ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [editingKey]);

  useEffect(() => {
    if (!focusTodayRequest) return;
    const cell = cellRefs.current.get(todayKey);
    cell?.focus();
    cell?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    // Only on request; the cell itself may arrive a render later after a
    // period change, which `cells` covers.
  }, [focusTodayRequest, cells]);

  /** Arrow keys walk the card day by day (left/right) or week by week. */
  const moveFocus = (fromKey: string, step: number) => {
    const target = keyToDate(fromKey);
    target.setDate(target.getDate() + step);
    const cell = cellRefs.current.get(dateKey(target));
    if (cell && !cell.disabled) {
      cell.focus();
    }
  };

  const renderCell = (cell: Date | null, index: number): ReactNode => {
    if (!cell) {
      return <div key={`empty-${index}`} aria-hidden />;
    }

    const key = dateKey(cell);
    const inPayslipRange = payslipDateLookup.has(key);
    const isWorkingDay = workingDateLookup.has(key);
    const isToday = todayKey === key;
    const exceptionType = exceptions[key];
    const entries = timeEntries[key] ?? [];
    const liveNow = isToday ? nowMinutes : undefined;
    const hasEntries = entries.length > 0;
    const isRunning = entries.some((entry) => entry.end === null);
    const hasOverride = isWorkingDay
      ? dailyHours[key] !== undefined || hasEntries
      : (extraHours[key] ?? 0) > 0 || hasEntries;
    // dailyActualHours already applies the time rules; for a running
    // session swap in the live figure so the cell ticks along.
    const stored = hasEntries ? workedTime(entries, workRules) : null;
    const live =
      hasEntries && isRunning && liveNow !== undefined
        ? workedTime(entries, workRules, liveNow)
        : stored;
    const total =
      (dailyActualHours[key] ?? 0) +
      (stored && live ? (live.workedMinutes - stored.workedMinutes) / 60 : 0);
    const notes = entries
      .map((entry) => entry.note?.trim())
      .filter(Boolean)
      .join(" · ");
    const isScheduledOnly = isWorkingDay && !hasOverride && !exceptionType;
    const showMonthTag = cell.getDate() === 1 || index === cells.findIndex(Boolean);
    const isPast = cell < today && !isToday;

    const dayCell = (
      <button
        type="button"
        ref={(node) => {
          if (node) cellRefs.current.set(key, node);
          else cellRefs.current.delete(key);
        }}
        disabled={!inPayslipRange}
        title={notes || undefined}
        aria-label={`${cell.toDateString()}, ${formatDuration(total)}${exceptionType ? `, ${exceptionType}` : ""}${notes ? `, ${notes}` : ""}`}
        onKeyDown={(event) => {
          const step = ARROW_STEPS[event.key];
          if (step && !event.metaKey && !event.ctrlKey && !event.altKey) {
            event.preventDefault();
            moveFocus(key, step);
          }
        }}
        className={cn(
          "group relative flex h-[68px] w-full flex-col rounded-lg border p-1.5 text-left sm:h-[92px] sm:rounded-xl sm:p-2.5 outline-none transition-[transform,box-shadow,background-color,border-color] duration-150 focus-visible:ring-2 focus-visible:ring-ring hover:-translate-y-px hover:shadow-md active:translate-y-0 data-[state=open]:ring-2 data-[state=open]:ring-primary",
          exceptionType === "vacation"
            ? "border-vacation/40 bg-[repeating-linear-gradient(135deg,hsl(var(--vacation)/0.16)_0_6px,hsl(var(--vacation)/0.08)_6px_12px)]"
            : exceptionType === "sick"
              ? "border-sick/40 bg-[repeating-linear-gradient(135deg,hsl(var(--sick)/0.16)_0_6px,hsl(var(--sick)/0.08)_6px_12px)]"
              : isWorkingDay
                ? "bg-card"
                : hasOverride
                  ? "border-extra/40 bg-extra/[0.07]"
                  : "border-dashed bg-transparent hover:bg-card/60",
          isToday && "border-primary shadow-[0_0_0_1px_hsl(var(--primary))]",
          !inPayslipRange && "pointer-events-none opacity-40",
        )}
      >
        <div className="flex items-start justify-between gap-1">
          <span
            className={cn(
              "font-mono text-[13px] font-semibold leading-none",
              !isWorkingDay && !hasOverride && "text-muted-foreground",
              isToday &&
                "-m-1 rounded-md bg-primary px-1 py-1 text-primary-foreground",
            )}
          >
            {cell.getDate()}
            {showMonthTag ? (
              <span
                className={cn(
                  "ml-1 hidden text-[9.5px] font-medium uppercase tracking-wider sm:inline",
                  isToday ? "text-primary-foreground/80" : "text-muted-foreground",
                )}
              >
                {cell.toLocaleDateString("en-US", { month: "short" })}
              </span>
            ) : null}
          </span>
          {notes && !exceptionType && !isRunning ? (
            <span
              aria-hidden
              className="mt-0.5 h-1.5 w-1.5 rounded-full bg-foreground/30"
            />
          ) : null}
          {exceptionType ? (
            <span
              className={cn(
                "font-mono text-[9.5px] font-semibold uppercase tracking-wider",
                exceptionType === "vacation"
                  ? "text-[hsl(32_90%_32%)] dark:text-vacation"
                  : "text-[hsl(350_70%_42%)] dark:text-sick",
              )}
            >
              {exceptionType === "vacation" ? "Vac" : "Sick"}
            </span>
          ) : isRunning ? (
            <span className="h-2 w-2 animate-punch-pulse rounded-full bg-signal" />
          ) : null}
        </div>

        <div className="mt-auto">
          {exceptionType === "sick" ? null : total > 0 || isWorkingDay ? (
            <p
              className={cn(
                "font-mono text-[11px] font-semibold leading-none tabular sm:text-[15px]",
                isScheduledOnly &&
                  cn(
                    "font-medium text-muted-foreground/80",
                    !isPast && "text-muted-foreground/55",
                  ),
                !isWorkingDay && hasOverride && "text-[hsl(262_60%_45%)] dark:text-extra",
              )}
            >
              {!isWorkingDay && hasOverride ? "+" : ""}
              {formatDuration(total)}
            </p>
          ) : (
            <p className="text-[11px] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
              + Log extra
            </p>
          )}
          <div className="mt-2">
            {hasEntries ? (
              <Timeline entries={entries} nowMinutes={liveNow} />
            ) : (
              <div
                className={cn(
                  "h-1 rounded-full",
                  isScheduledOnly
                    ? "border-t border-dashed border-muted-foreground/30"
                    : "",
                )}
              />
            )}
          </div>
        </div>
      </button>
    );

    const popover = (
      <Popover
        open={editingKey === key}
        onOpenChange={(open) => onEditingKeyChange(open ? key : null)}
      >
        <PopoverTrigger asChild>{dayCell}</PopoverTrigger>
        <PopoverContent className="w-[330px]" align="start">
          <DayEditor
            date={cell}
            isWorkingDay={isWorkingDay}
            isToday={isToday}
            exceptionType={exceptionType}
            entries={entries}
            totalHours={total}
            breakMinutes={live?.breakMinutes ?? 0}
            hasOverride={hasOverride}
            hoursPerDay={hoursPerDay}
            nowMinutes={nowMinutes}
            onApplyText={(text) => onApplyDayInput(key, text)}
            onSetEntries={(next) => onSetDayEntries(key, next)}
            onRemoveEntry={(index) => onRemoveSession(key, index)}
            onReset={() => onResetDay(key)}
            onSetException={(type) => onSetException(key, type)}
          />
        </PopoverContent>
      </Popover>
    );

    if (!isWorkingDay) {
      return <Fragment key={key}>{popover}</Fragment>;
    }

    return (
      <ContextMenu key={key}>
        <ContextMenuTrigger asChild>
          <div>{popover}</div>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-44">
          <ContextMenuItem onSelect={() => onEditingKeyChange(key)}>
            Log times…
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onSelect={() => onSetException(key, "vacation")}>
            <span className="mr-2 h-1.5 w-1.5 rounded-full bg-vacation" />
            {exceptionType === "vacation" ? "Unmark vacation" : "Mark vacation"}
          </ContextMenuItem>
          <ContextMenuItem onSelect={() => onSetException(key, "sick")}>
            <span className="mr-2 h-1.5 w-1.5 rounded-full bg-sick" />
            {exceptionType === "sick" ? "Unmark sick" : "Mark sick"}
          </ContextMenuItem>
          {hasOverride ? (
            <>
              <ContextMenuSeparator />
              <ContextMenuItem onSelect={() => onResetDay(key)}>
                Reset to schedule
              </ContextMenuItem>
            </>
          ) : null}
        </ContextMenuContent>
      </ContextMenu>
    );
  };

  return (
    <section aria-label="Time card" className="panel p-5">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="stamp">04 · Time card</span>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight">
            {selectedMonthInfo.label}
            <span className="ml-2 font-mono text-sm font-normal text-muted-foreground">
              {periodLabel}
            </span>
          </h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Click a day to log times · right-click to mark ·{" "}
          <kbd className="font-mono">←→↑↓</kbd> move · <kbd className="font-mono">T</kbd> today
        </p>
      </div>

      <div className="grid grid-cols-7 gap-1 sm:grid-cols-[repeat(7,minmax(0,1fr))_minmax(64px,84px)] sm:gap-2">
        {calendarHeaders.map((header, index) => (
          <div
            key={header}
            className={cn(
              "stamp pb-1 pl-1 text-[9px] tracking-[0.08em] sm:text-[10.5px] sm:tracking-[0.14em]",
              index >= 5 && "text-muted-foreground/60",
            )}
          >
            {header}
          </div>
        ))}
        <div className="stamp hidden pb-1 text-right sm:block">Week</div>

        {chunkIntoWeeks(cells).map((week, weekIndex) => {
          const firstDate = week.find((cell): cell is Date => cell !== null);
          const weekTotal = week.reduce((total, cell) => {
            if (!cell) {
              return total;
            }
            return total + (dailyActualHours[dateKey(cell)] ?? 0);
          }, 0);
          const weekScheduled = week.reduce(
            (total, cell) =>
              cell && workingDateLookup.has(dateKey(cell))
                ? total + hoursPerDay
                : total,
            0,
          );

          return (
            <Fragment key={`week-${weekIndex}`}>
              {week.map((cell, index) =>
                renderCell(cell, weekIndex * 7 + index),
              )}
              <div className="hidden flex-col items-end justify-center rounded-xl border border-dashed px-2 text-right sm:flex">
                {firstDate ? (
                  <>
                    <span className="font-mono text-[9.5px] uppercase tracking-wider text-muted-foreground">
                      W{isoWeekNumber(firstDate)}
                    </span>
                    <span className="mt-1 font-mono text-sm font-semibold tabular">
                      {formatDuration(weekTotal)}
                    </span>
                    {weekScheduled > 0 ? (
                      <span
                        className={cn(
                          "font-mono text-[10px] tabular",
                          weekTotal >= weekScheduled
                            ? "text-primary"
                            : "text-muted-foreground",
                        )}
                      >
                        /{formatDuration(weekScheduled)}
                      </span>
                    ) : null}
                  </>
                ) : null}
              </div>
            </Fragment>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t pt-3 text-[11px] text-muted-foreground">
        <LegendItem swatch={<span className="font-mono font-semibold text-foreground">8h</span>}>
          Logged
        </LegendItem>
        <LegendItem swatch={<span className="font-mono text-muted-foreground/60">8h</span>}>
          Scheduled
        </LegendItem>
        <LegendItem swatch={<span className="h-1 w-5 rounded-full bg-primary" />}>
          Sessions (6:00–22:00)
        </LegendItem>
        <LegendItem swatch={<span className="h-2.5 w-2.5 rounded-sm bg-vacation/60" />}>
          Vacation
        </LegendItem>
        <LegendItem swatch={<span className="h-2.5 w-2.5 rounded-sm bg-sick/60" />}>
          Sick
        </LegendItem>
        <LegendItem swatch={<span className="h-2.5 w-2.5 rounded-sm bg-extra/60" />}>
          Extra hours
        </LegendItem>
      </div>
    </section>
  );
}

function LegendItem({
  swatch,
  children,
}: {
  swatch: ReactNode;
  children: ReactNode;
}) {
  return (
    <span className="flex items-center gap-1.5">
      {swatch}
      {children}
    </span>
  );
}
