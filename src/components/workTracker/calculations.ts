import {
  DayKey,
  ExceptionType,
  TimeEntry,
  TrackerData,
  WorkRules,
  weekdayMap,
} from "./types";
import {
  clampHours,
  clampPercent,
  dateKey,
  getDatesInPayslipRange,
  parseClock,
} from "./utils";

/*
 * Pure hour and pay calculations. Everything here is deterministic and free
 * of React/storage so it can be unit tested and reused for the current
 * month, the yearly chart and timesheet exports alike.
 */

export const DEFAULT_WORK_RULES: WorkRules = {
  breakMinutes: 0,
  breakAfterHours: 6,
  roundingMinutes: 0,
  overtimeMultiplier: 1,
  overtimeIncludesLongDays: false,
};

export function normalizeWorkRules(raw: Partial<WorkRules> | undefined): WorkRules {
  const number = (value: unknown, fallback: number, min: number, max: number) =>
    typeof value === "number" && Number.isFinite(value)
      ? Math.min(max, Math.max(min, value))
      : fallback;

  return {
    breakMinutes: number(raw?.breakMinutes, 0, 0, 240),
    breakAfterHours: number(raw?.breakAfterHours, 6, 0, 24),
    roundingMinutes: [0, 5, 6, 10, 15, 30].includes(raw?.roundingMinutes as number)
      ? (raw!.roundingMinutes as number)
      : 0,
    overtimeMultiplier: number(raw?.overtimeMultiplier, 1, 1, 5),
    overtimeIncludesLongDays: raw?.overtimeIncludesLongDays === true,
  };
}

/** Rounds minutes-since-midnight to the nearest step (no-op for step 0). */
export function roundMinutes(minutes: number, step: number) {
  if (!step) return minutes;
  return Math.round(minutes / step) * step;
}

interface SessionSpan {
  start: number;
  /** May exceed 1440 for sessions that run past midnight. */
  end: number;
}

function toSpans(
  entries: TimeEntry[],
  roundingMinutes: number,
  nowMinutes?: number,
): SessionSpan[] {
  const spans: SessionSpan[] = [];
  for (const entry of entries) {
    const start = parseClock(entry.start);
    const end =
      entry.end !== null
        ? parseClock(entry.end)
        : nowMinutes !== undefined
          ? nowMinutes
          : null;
    if (start === null || end === null) continue;

    const roundedStart = roundMinutes(start, roundingMinutes);
    let roundedEnd = roundMinutes(end, roundingMinutes);
    if (end < start) roundedEnd += 1440;
    if (roundedEnd <= roundedStart) continue;
    spans.push({ start: roundedStart, end: roundedEnd });
  }
  return spans.sort((a, b) => a.start - b.start);
}

export interface WorkedTime {
  /** Minutes on the clock after rounding, before any break deduction. */
  clockedMinutes: number;
  /** Unpaid break deducted automatically. */
  breakMinutes: number;
  /** Paid minutes: clocked minus the automatic break. */
  workedMinutes: number;
}

/**
 * Applies the rounding and automatic-break rules to a day's sessions.
 * Running sessions count up to `nowMinutes` when given, otherwise not at all.
 *
 * The automatic break only tops up what's missing: gaps between sessions
 * already count as break, so someone who clocks out for lunch isn't
 * deducted twice.
 */
export function workedTime(
  entries: TimeEntry[],
  rules: Pick<WorkRules, "breakMinutes" | "breakAfterHours" | "roundingMinutes">,
  nowMinutes?: number,
): WorkedTime {
  const spans = toSpans(entries, rules.roundingMinutes, nowMinutes);
  const clockedMinutes = spans.reduce(
    (total, span) => total + span.end - span.start,
    0,
  );

  let gapMinutes = 0;
  for (let index = 1; index < spans.length; index += 1) {
    gapMinutes += Math.max(0, spans[index].start - spans[index - 1].end);
  }

  const breakMinutes =
    rules.breakMinutes > 0 && clockedMinutes >= rules.breakAfterHours * 60
      ? Math.min(clockedMinutes, Math.max(0, rules.breakMinutes - gapMinutes))
      : 0;

  return {
    clockedMinutes,
    breakMinutes,
    workedMinutes: clockedMinutes - breakMinutes,
  };
}

export type DaySource = "sessions" | "manual" | "scheduled" | "none";

export interface DayResult {
  key: string;
  date: Date;
  isWorkingDay: boolean;
  exception?: ExceptionType;
  /** Paid hours for the day. */
  hours: number;
  /** Of `hours`, how many count as overtime. */
  overtimeHours: number;
  breakMinutes: number;
  source: DaySource;
}

export interface PeriodResult {
  days: DayResult[];
  byKey: Record<string, DayResult>;
  workingDaysCount: number;
  vacationDays: number;
  sickDays: number;
  actualHours: number;
  estimatedHours: number;
  /** Hours logged on days off. */
  extraHoursTotal: number;
  overtimeHours: number;
  breakMinutesTotal: number;
}

type PeriodData = Pick<
  TrackerData,
  | "selectedDays"
  | "hoursPerDay"
  | "defaultHours"
  | "exceptions"
  | "dailyHours"
  | "extraHours"
  | "timeEntries"
>;

/**
 * Works out every day of a payslip period: which days are workdays, how many
 * hours each one counts for, and which of those are overtime.
 */
export function computePeriod(
  data: PeriodData,
  monthKey: string,
  payslipStartDay: number,
  rules: WorkRules,
  live?: { key: string; nowMinutes: number },
): PeriodResult {
  const selectedDays = data.selectedDays ?? [];
  const exceptions = data.exceptions ?? {};
  const dailyHours = data.dailyHours ?? {};
  const extraHours = data.extraHours ?? {};
  const timeEntries = data.timeEntries ?? {};
  const defaultHours =
    typeof data.defaultHours === "number" ? data.defaultHours : 8;

  const days: DayResult[] = [];
  const byKey: Record<string, DayResult> = {};
  let workingDaysCount = 0;
  let vacationDays = 0;
  let sickDays = 0;
  let actualHours = 0;
  let extraHoursTotal = 0;
  let overtimeHours = 0;
  let breakMinutesTotal = 0;

  for (const date of getDatesInPayslipRange(monthKey, payslipStartDay)) {
    const key = dateKey(date);
    const isWorkingDay = selectedDays.includes(
      weekdayMap[date.getDay()] as DayKey,
    );
    const exception = isWorkingDay ? exceptions[key] : undefined;
    const entries = timeEntries[key] ?? [];
    const worked =
      entries.length > 0
        ? workedTime(
            entries,
            rules,
            live && live.key === key ? live.nowMinutes : undefined,
          )
        : null;
    const sessionHours = worked ? worked.workedMinutes / 60 : 0;

    let hours = 0;
    let source: DaySource = "none";
    let dayOvertime = 0;

    if (isWorkingDay) {
      workingDaysCount += 1;
      if (exception === "sick") {
        sickDays += 1;
      } else if (exception === "vacation") {
        vacationDays += 1;
        const logged = worked ? sessionHours : clampHours(dailyHours[key] ?? 0);
        hours = defaultHours + logged;
        source = worked ? "sessions" : dailyHours[key] !== undefined ? "manual" : "scheduled";
      } else if (worked) {
        hours = sessionHours;
        source = "sessions";
      } else if (dailyHours[key] !== undefined) {
        hours = clampHours(dailyHours[key]);
        source = "manual";
      } else {
        hours = data.hoursPerDay;
        source = "scheduled";
      }

      if (rules.overtimeIncludesLongDays && !exception) {
        dayOvertime = Math.max(0, hours - data.hoursPerDay);
      }
    } else {
      hours = worked ? sessionHours : clampHours(extraHours[key] ?? 0);
      source = worked ? "sessions" : hours > 0 ? "manual" : "none";
      extraHoursTotal += hours;
      dayOvertime = hours;
    }

    const result: DayResult = {
      key,
      date,
      isWorkingDay,
      exception,
      hours,
      overtimeHours: dayOvertime,
      breakMinutes: worked?.breakMinutes ?? 0,
      source,
    };
    days.push(result);
    byKey[key] = result;
    actualHours += hours;
    overtimeHours += dayOvertime;
    breakMinutesTotal += result.breakMinutes;
  }

  return {
    days,
    byKey,
    workingDaysCount,
    vacationDays,
    sickDays,
    actualHours,
    estimatedHours: workingDaysCount * data.hoursPerDay,
    extraHoursTotal,
    overtimeHours,
    breakMinutesTotal,
  };
}

export interface PayResult {
  regularHours: number;
  overtimeHours: number;
  regularPay: number;
  overtimePay: number;
  gross: number;
  tax: number;
  deductions: number;
  net: number;
}

/**
 * Turns hours into an estimated payslip. Overtime is only paid differently
 * when the multiplier is above 1; otherwise every hour is paid at the rate.
 */
export function computePay(
  period: Pick<PeriodResult, "actualHours" | "overtimeHours">,
  pay: {
    hourlyRate: number;
    taxPercent: number;
    extraDeduction: number;
    overtimeMultiplier: number;
  },
): PayResult {
  const multiplier = Math.max(1, pay.overtimeMultiplier || 1);
  const overtimeHours = multiplier > 1 ? period.overtimeHours : 0;
  const regularHours = Math.max(0, period.actualHours - overtimeHours);
  const regularPay = regularHours * pay.hourlyRate;
  const overtimePay = overtimeHours * pay.hourlyRate * multiplier;
  const gross = regularPay + overtimePay;
  const tax = gross * (clampPercent(pay.taxPercent) / 100);
  const deductions = Math.max(0, pay.extraDeduction);

  return {
    regularHours,
    overtimeHours,
    regularPay,
    overtimePay,
    gross,
    tax,
    deductions,
    net: Math.max(0, gross - tax - deductions),
  };
}
