import { EllipsisVertical } from "lucide-react";
import { Fragment, ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import HoursInput from "./HoursInput";
import { calendarHeaders, ExceptionType } from "./types";
import { dateKey, formatDuration } from "./utils";

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
  dailyActualHours: Record<string, number>;
  hoursPerDay: number;
  today: Date;
  onSetException: (key: string, type: ExceptionType | "none") => void;
  onHoursChange: (key: string, value: number) => void;
  onExtraHoursChange: (key: string, value: number) => void;
}

function chunkIntoWeeks<T>(items: T[]): T[][] {
  const weeks: T[][] = [];
  for (let index = 0; index < items.length; index += 7) {
    weeks.push(items.slice(index, index + 7));
  }
  return weeks;
}

export default function CalendarGrid({
  cells,
  payslipDateLookup,
  workingDateLookup,
  selectedMonthInfo,
  exceptions,
  dailyHours,
  extraHours,
  dailyActualHours,
  hoursPerDay,
  today,
  onSetException,
  onHoursChange,
  onExtraHoursChange,
}: CalendarGridProps) {
  const renderCell = (cell: Date | null, index: number): ReactNode => {
    if (!cell) {
      return (
        <div
          key={`empty-${index}`}
          className="h-20 rounded-lg border border-transparent bg-muted/30"
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
        ? "border-amber-300/80 bg-amber-400/20 dark:border-amber-400/60"
        : "border-rose-300/80 bg-rose-400/20 dark:border-rose-400/60"
      : isWorkingDay
        ? "border-primary/60 bg-primary/15"
        : canLogExtraHours && extraHoursForDay > 0
          ? "border-violet-300/80 bg-violet-400/20 dark:border-violet-400/60"
          : inPayslipRange
            ? "border-muted-foreground/30 bg-muted/70"
            : "border-border bg-muted/30";

    const dayCell = (
      <div
        className={cn(
          "h-20 rounded-lg border p-2 text-left transition",
          backgroundClass,
          isToday && "ring-2 ring-amber-400/80",
          !isInSelectedMonth && "opacity-80",
        )}
      >
        <div className="flex items-center justify-between gap-1">
          <p className="text-sm font-medium text-foreground">
            {cell.getDate()}
          </p>
          <div className="flex items-center gap-1">
            {!isInSelectedMonth ? (
              <Badge
                variant="outline"
                className="bg-card/80 px-1.5 py-0 text-[10px] font-normal uppercase text-muted-foreground"
              >
                {monthTag}
              </Badge>
            ) : null}
            {isWorkingDay ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Mark vacation or sick for ${cell.toDateString()}`}
                    className="h-6 w-6 shrink-0 rounded text-muted-foreground hover:bg-muted hover:text-foreground [&_svg]:size-3.5"
                  >
                    <EllipsisVertical />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  <DropdownMenuItem
                    className="text-amber-700 focus:text-amber-700 dark:text-amber-300 dark:focus:text-amber-200"
                    onSelect={() => onSetException(key, "vacation")}
                  >
                    Mark vacation
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-rose-700 focus:text-rose-700 dark:text-rose-300 dark:focus:text-rose-200"
                    onSelect={() => onSetException(key, "sick")}
                  >
                    Mark sick
                  </DropdownMenuItem>
                  {exceptionType ? (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onSelect={() => onSetException(key, "none")}
                      >
                        Clear mark
                      </DropdownMenuItem>
                    </>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </div>
        </div>

        <p className="mt-1 text-[10px] text-muted-foreground">
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
          <HoursInput
            className={cn(
              "mt-1 h-6 rounded border-transparent bg-transparent px-1.5 py-0.5 text-[10px] transition-colors hover:border-input/80 hover:bg-card/70 focus-visible:border-input/80 focus-visible:bg-card/70 focus-visible:ring-1 focus-visible:ring-offset-0 md:text-[10px]",
              hoursForDay === hoursPerDay
                ? "text-muted-foreground hover:text-foreground focus-visible:text-foreground"
                : "font-semibold text-foreground",
            )}
            value={hoursForDay}
            onClick={(event) => event.stopPropagation()}
            onCommit={(value) => onHoursChange(key, value)}
          />
        ) : canLogExtraHours ? (
          <HoursInput
            className="mt-1 h-6 rounded border-violet-300 bg-card/70 px-1.5 py-0.5 text-[10px] focus-visible:ring-1 focus-visible:ring-violet-500 focus-visible:ring-offset-0 md:text-[10px] dark:border-violet-700"
            placeholder="+ extra hrs"
            blankWhenZero
            value={extraHoursForDay}
            onClick={(event) => event.stopPropagation()}
            onCommit={(value) => onExtraHoursChange(key, value)}
          />
        ) : null}
      </div>
    );

    if (!isWorkingDay) {
      return <div key={key}>{dayCell}</div>;
    }

    return (
      <ContextMenu key={key}>
        <ContextMenuTrigger asChild>{dayCell}</ContextMenuTrigger>
        <ContextMenuContent className="w-40">
          <ContextMenuItem
            className="text-amber-700 focus:text-amber-700 dark:text-amber-300 dark:focus:text-amber-200"
            onSelect={() => onSetException(key, "vacation")}
          >
            Mark vacation
          </ContextMenuItem>
          <ContextMenuItem
            className="text-rose-700 focus:text-rose-700 dark:text-rose-300 dark:focus:text-rose-200"
            onSelect={() => onSetException(key, "sick")}
          >
            Mark sick
          </ContextMenuItem>
          {exceptionType ? (
            <>
              <ContextMenuSeparator />
              <ContextMenuItem onSelect={() => onSetException(key, "none")}>
                Clear mark
              </ContextMenuItem>
            </>
          ) : null}
        </ContextMenuContent>
      </ContextMenu>
    );
  };

  return (
    <>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {selectedMonthInfo.label}
        </p>
        <p className="text-xs text-muted-foreground">
          <span aria-hidden="true">⋮</span> or right-click a workday to mark
          vacation/sick
        </p>
      </div>

      <div className="grid grid-cols-7 gap-2 border-b pb-2 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {calendarHeaders.map((header) => (
          <div key={header}>{header}</div>
        ))}
      </div>

      <div className="mt-2 grid grid-cols-7 gap-2">
        {chunkIntoWeeks(cells).map((week, weekIndex) => {
          const hasAnyDate = week.some((cell) => cell !== null);
          const weekTotal = week.reduce((total, cell) => {
            if (!cell) {
              return total;
            }
            return total + (dailyActualHours[dateKey(cell)] ?? 0);
          }, 0);

          return (
            <Fragment key={`week-${weekIndex}`}>
              {week.map((cell, index) => renderCell(cell, weekIndex * 7 + index))}
              {hasAnyDate ? (
                <div className="col-span-7 mb-1 flex items-center justify-end gap-1.5 px-1 text-[11px] text-muted-foreground">
                  <span className="font-medium uppercase tracking-wide">
                    Week total
                  </span>
                  <span className="font-semibold text-foreground">
                    {formatDuration(weekTotal)}
                  </span>
                </div>
              ) : null}
            </Fragment>
          );
        })}
      </div>
    </>
  );
}
