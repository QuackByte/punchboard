import {
  DayKey,
  ExceptionType,
  SalarySettings,
  TimeEntry,
  TrackerData,
  WorkRules,
  weekdayMap,
} from "./types";
import {
  clampHours,
  clampPercent,
  dateKey,
  formatClock,
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
  balanceWeek: true,
  carryBalance: true,
  balanceResetsYearly: false,
  balanceCapHours: 0,
  balanceStartDate: "",
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
    balanceWeek: raw?.balanceWeek !== false,
    carryBalance: raw?.carryBalance !== false,
    balanceResetsYearly: raw?.balanceResetsYearly === true,
    balanceCapHours: number(raw?.balanceCapHours, 0, 0, 1000),
    balanceStartDate:
      typeof raw?.balanceStartDate === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(raw.balanceStartDate)
        ? raw.balanceStartDate
        : "",
  };
}

export const DEFAULT_SALARY: SalarySettings = {
  enabled: false,
  basis: "weekly",
  weeklyHours: 0,
  yearlyAmount: 0,
  overtimePaid: false,
};

export function normalizeSalary(raw: Partial<SalarySettings> | undefined): SalarySettings {
  const amount = (value: unknown, max: number) =>
    typeof value === "number" && Number.isFinite(value)
      ? Math.min(max, Math.max(0, value))
      : 0;

  return {
    enabled: raw?.enabled === true,
    basis: raw?.basis === "yearly" ? "yearly" : "weekly",
    weeklyHours: amount(raw?.weeklyHours, 168),
    yearlyAmount: amount(raw?.yearlyAmount, Number.MAX_SAFE_INTEGER),
    overtimePaid: raw?.overtimePaid === true,
  };
}

/**
 * What a salary works out to: the gross paid each payslip period (a twelfth
 * of the year) and the hourly rate it implies for the contracted hours.
 */
export function salaryBreakdown(salary: SalarySettings, hourlyRate: number) {
  const yearlyHours = salary.weeklyHours * 52;
  const yearly =
    salary.basis === "yearly" ? salary.yearlyAmount : hourlyRate * yearlyHours;
  const rate =
    salary.basis === "yearly"
      ? yearlyHours > 0
        ? yearly / yearlyHours
        : 0
      : hourlyRate;
  return { yearly, perPeriod: yearly / 12, rate };
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

export interface FinishEstimate {
  /** Minutes since midnight; past 1440 when it runs into tomorrow. */
  finishMinutes: number;
  /** Clock time still to go, automatic break included. */
  remainingMinutes: number;
}

/**
 * When today's target is reached if the clock runs from `nowMinutes` on: a
 * running session keeps going, otherwise one is assumed to start now. The
 * automatic break is included when the day will reach its threshold, and
 * time off the clock already counts towards it. Null once the target is met.
 */
export function estimateFinish(
  entries: TimeEntry[],
  targetHours: number,
  rules: Pick<WorkRules, "breakMinutes" | "breakAfterHours">,
  nowMinutes: number,
): FinishEstimate | null {
  const target = Math.round(targetHours * 60);
  if (target <= 0) return null;

  const running = entries.some((entry) => entry.end === null);
  const pending = running
    ? entries
    : [...entries, { start: formatClock(nowMinutes), end: null }];
  // Estimates use exact minutes; rounding would only make them jump.
  const exact = { ...rules, roundingMinutes: 0 };
  const workedAt = (minutes: number) =>
    workedTime(pending, exact, minutes).workedMinutes;

  if (workedAt(nowMinutes) >= target) return null;

  // Reaching the break threshold on the way adds the break; one more pass
  // covers it, since the break only applies once.
  let finish = nowMinutes;
  for (let pass = 0; pass < 3; pass += 1) {
    const missing = target - workedAt(finish);
    if (missing <= 0) break;
    finish += missing;
  }

  return { finishMinutes: finish, remainingMinutes: finish - nowMinutes };
}

/**
 * Today's target when the week is balanced: the weekly hours minus what the
 * days before today already count for, shared evenly over today and the
 * workdays still to come. Vacation counts its holiday hours and a sick day
 * its share of the week, whether it's past or still ahead. 0 when today
 * isn't a plain workday.
 *
 * `carriedHours` (see `hourBalance`) comes off the week: banked hours make
 * it shorter, a shortfall longer.
 *
 * `settled` days were already paid for some other way, e.g. by the hour
 * before a switch to a salary mid-week: a workday counts as exactly its
 * share whatever was worked, a day off as nothing.
 *
 * `week` holds the week's days (any order, any that are known); `today` is
 * matched by date.
 */
export function weeklyDayTarget(
  week: DayResult[],
  today: Date,
  weeklyHours: number,
  workdaysPerWeek: number,
  carriedHours = 0,
  settled: (day: DayResult) => boolean = () => false,
): number {
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const todayResult = week.find((day) => day.date.getTime() === todayStart);
  if (!todayResult?.isWorkingDay || todayResult.exception) return 0;

  const share = workdaysPerWeek > 0 ? weeklyHours / workdaysPerWeek : 0;
  const credit = (day: DayResult) => {
    if (settled(day)) return day.isWorkingDay ? share : 0;
    return day.exception === "sick" ? share : day.hours;
  };

  let counted = 0;
  let daysLeft = 0;
  for (const day of week) {
    const time = day.date.getTime();
    if (time < todayStart) {
      counted += credit(day);
    } else if (day.isWorkingDay && !day.exception) {
      daysLeft += 1;
    } else if (time > todayStart && day.exception) {
      counted += credit(day);
    }
  }

  return Math.max(0, weeklyHours - carriedHours - counted) / Math.max(1, daysLeft);
}

/** Weekly hours: a salary's contracted hours, else the schedule's. */
export function weeklyHoursOf(
  data: Pick<TrackerData, "selectedDays" | "hoursPerDay" | "salary">,
) {
  const salary = normalizeSalary(data.salary);
  return salary.enabled && salary.weeklyHours > 0
    ? salary.weeklyHours
    : (data.selectedDays ?? []).length * (data.hoursPerDay ?? 8);
}

/**
 * Hours banked (or owed, when negative) on days before `before` (and from
 * `from`, when given): each workday counts what it's worth minus its share
 * of the weekly hours, a sick day nothing, and days off whatever was worked
 * on them. With `overtimePaid`, overtime hours were paid on the payslip, so
 * they don't bank.
 */
export function hourBalance(
  days: DayResult[],
  before: Date,
  share: number,
  options: { from?: Date; overtimePaid?: boolean } = {},
): number {
  let balance = 0;
  for (const day of days) {
    if (day.date >= before || (options.from && day.date < options.from)) continue;
    const hours = options.overtimePaid ? day.hours - day.overtimeHours : day.hours;
    if (!day.isWorkingDay) balance += hours;
    else if (day.exception !== "sick") balance += hours - share;
  }
  return balance;
}

/** A payslip period as the carried balance sees it. */
export interface BalanceSource {
  days: DayResult[];
  /** Each workday's share of the weekly hours. */
  share: number;
  /** Overtime was paid on top of the salary, so it doesn't bank. */
  overtimePaid: boolean;
}

/**
 * A period's contribution to the carried balance, or null when nothing in
 * it can bank: by the hour every hour was paid, so only salaried periods
 * count.
 */
export function balanceSource(
  data: Pick<TrackerData, "selectedDays" | "hoursPerDay" | "salary">,
  days: DayResult[],
): BalanceSource | null {
  const salary = normalizeSalary(data.salary);
  const workdays = (data.selectedDays ?? []).length;
  if (!salary.enabled || workdays === 0) return null;
  return {
    days,
    share: weeklyHoursOf(data) / workdays,
    overtimePaid: salary.overtimePaid,
  };
}

/**
 * The balance carried into the week starting `monday`, under the rules:
 * counted from the start date and, when it resets yearly, from 1 January,
 * whichever is later, and kept within the cap.
 */
export function carriedBalance(
  sources: BalanceSource[],
  monday: Date,
  rules: Pick<WorkRules, "balanceResetsYearly" | "balanceCapHours" | "balanceStartDate">,
): number {
  const starts = [
    rules.balanceResetsYearly ? new Date(monday.getFullYear(), 0, 1) : null,
    rules.balanceStartDate ? keyToStartDate(rules.balanceStartDate) : null,
  ].filter((date): date is Date => date !== null);
  const from =
    starts.length > 0
      ? new Date(Math.max(...starts.map((date) => date.getTime())))
      : undefined;
  const balance = sources.reduce(
    (total, source) =>
      total +
      hourBalance(source.days, monday, source.share, {
        from,
        overtimePaid: source.overtimePaid,
      }),
    0,
  );
  const cap = rules.balanceCapHours;
  return cap > 0 ? Math.min(cap, Math.max(-cap, balance)) : balance;
}

/** A "YYYY-MM-DD" date as local midnight. */
function keyToStartDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export interface VacationYear {
  /** Vacation days up to and including today. */
  taken: number;
  /** Vacation days marked after today. */
  booked: number;
}

/** The leave year starting in `year`: from its start month to a year on. */
export function leaveYearRange(year: number, startMonth: number) {
  const month = Math.min(12, Math.max(1, Math.round(startMonth) || 1)) - 1;
  return { start: new Date(year, month, 1), end: new Date(year + 1, month, 1) };
}

/**
 * Vacation days from `start` up to (not including) `end`. `days` may come
 * from several payslip periods (they straddle the year's ends); only
 * workdays marked vacation count, the same days the period totals count.
 */
export function countVacation(
  days: DayResult[],
  range: { start: Date; end: Date },
  today: Date,
): VacationYear {
  const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  const seen = new Set<string>();
  const result: VacationYear = { taken: 0, booked: 0 };
  for (const day of days) {
    if (day.exception !== "vacation") continue;
    if (day.date < range.start || day.date >= range.end) continue;
    if (seen.has(day.key)) continue;
    seen.add(day.key);
    if (day.date < endOfToday) result.taken += 1;
    else result.booked += 1;
  }
  return result;
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
  /** Minutes on the clock from sessions, before the break (0 without sessions). */
  clockedMinutes: number;
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
      clockedMinutes: worked?.clockedMinutes ?? 0,
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
  salaried: boolean;
  /**
   * The year's gross: the salary, or by the hour an estimate from the
   * weekly hours (0 when they aren't known).
   */
  yearly: number;
  /** Hourly rate: the one set, or the one a salary implies. */
  rate: number;
  /** Gross over hours actually worked (0 without hours). */
  effectiveRate: number;
  regularHours: number;
  overtimeHours: number;
  /** Overtime a salary doesn't pay for, tracked only. */
  unpaidOvertimeHours: number;
  /** Hours × rate, or the period's salary. */
  regularPay: number;
  overtimePay: number;
  gross: number;
  tax: number;
  deductions: number;
  net: number;
}

/**
 * Turns hours into an estimated payslip.
 *
 * By the hour, overtime is only paid differently when the multiplier is
 * above 1; otherwise every hour is paid at the rate. On a salary the gross
 * is fixed, and overtime is either paid on top at the implied rate × the
 * multiplier or tracked as unpaid.
 */
export function computePay(
  period: Pick<PeriodResult, "actualHours" | "overtimeHours">,
  pay: {
    hourlyRate: number;
    taxPercent: number;
    extraDeduction: number;
    overtimeMultiplier: number;
    salary?: SalarySettings;
    /** For the yearly estimate by the hour. */
    weeklyHours?: number;
  },
): PayResult {
  const multiplier = Math.max(1, pay.overtimeMultiplier || 1);
  const salaried = pay.salary?.enabled === true;

  let rate = pay.hourlyRate;
  let yearly = pay.hourlyRate * (pay.weeklyHours ?? 0) * 52;
  let overtimeHours: number;
  let unpaidOvertimeHours = 0;
  let regularPay: number;

  if (salaried) {
    const salary = salaryBreakdown(pay.salary!, pay.hourlyRate);
    rate = salary.rate;
    yearly = salary.yearly;
    if (pay.salary!.overtimePaid) {
      overtimeHours = period.overtimeHours;
    } else {
      overtimeHours = 0;
      unpaidOvertimeHours = period.overtimeHours;
    }
    regularPay = salary.perPeriod;
  } else {
    overtimeHours = multiplier > 1 ? period.overtimeHours : 0;
    regularPay = Math.max(0, period.actualHours - overtimeHours) * rate;
  }

  const regularHours = Math.max(0, period.actualHours - overtimeHours);
  const overtimePay = overtimeHours * rate * multiplier;
  const gross = regularPay + overtimePay;
  const tax = gross * (clampPercent(pay.taxPercent) / 100);
  const deductions = Math.max(0, pay.extraDeduction);

  return {
    salaried,
    yearly,
    rate,
    effectiveRate: period.actualHours > 0 ? gross / period.actualHours : 0,
    regularHours,
    overtimeHours,
    unpaidOvertimeHours,
    regularPay,
    overtimePay,
    gross,
    tax,
    deductions,
    net: Math.max(0, gross - tax - deductions),
  };
}
