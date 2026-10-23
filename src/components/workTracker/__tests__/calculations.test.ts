import { describe, expect, it } from "vitest";
import {
  computePay,
  balanceSource,
  carriedBalance,
  computePeriod,
  countVacation,
  DEFAULT_SALARY,
  DEFAULT_WORK_RULES,
  estimateFinish,
  hourBalance,
  leaveYearRange,
  normalizeSalary,
  normalizeWorkRules,
  roundMinutes,
  weeklyDayTarget,
  weeklyHoursOf,
  workedTime,
} from "../calculations";
import { SalarySettings, TrackerData, WorkRules } from "../types";

const rules = (patch: Partial<WorkRules> = {}): WorkRules => ({
  ...DEFAULT_WORK_RULES,
  ...patch,
});

// Periods are named after the month they end in: with start day 1,
// "2026-04" runs 1-31 March 2026, which has 22 weekdays.
const MONTH = "2026-04";
const START_DAY = 1;

function data(patch: Partial<TrackerData> = {}): TrackerData {
  return {
    selectedDays: ["mon", "tue", "wed", "thu", "fri"],
    hoursPerDay: 8,
    hourlyRate: 20,
    currency: "EUR",
    secondaryCurrency: "USD",
    conversionRate: 1,
    currencyConversionEnabled: false,
    taxPercent: 0,
    extraDeduction: 0,
    defaultHours: 8,
    exceptions: {},
    dailyHours: {},
    extraHours: {},
    timeEntries: {},
    ...patch,
  };
}

// Monday 2 March and Saturday 7 March 2026 (months are zero-based in keys).
const MONDAY = "2026-2-2";
const SATURDAY = "2026-2-7";

describe("normalizeWorkRules", () => {
  it("fills defaults and clamps values", () => {
    expect(normalizeWorkRules(undefined)).toEqual(DEFAULT_WORK_RULES);
    expect(
      normalizeWorkRules({
        breakMinutes: -10,
        breakAfterHours: 99,
        roundingMinutes: 7,
        overtimeMultiplier: 9,
        overtimeIncludesLongDays: true,
        balanceWeek: false,
        carryBalance: false,
        balanceResetsYearly: true,
        balanceCapHours: -3,
        balanceStartDate: "21/10/2026",
      }),
    ).toEqual({
      breakMinutes: 0,
      breakAfterHours: 24,
      roundingMinutes: 0,
      overtimeMultiplier: 5,
      overtimeIncludesLongDays: true,
      balanceWeek: false,
      carryBalance: false,
      balanceResetsYearly: true,
      balanceCapHours: 0,
      balanceStartDate: "",
    });
  });
});

describe("roundMinutes", () => {
  it("rounds to the nearest step", () => {
    expect(roundMinutes(487, 15)).toBe(480); // 08:07 -> 08:00
    expect(roundMinutes(488, 15)).toBe(495); // 08:08 -> 08:15
    expect(roundMinutes(487, 0)).toBe(487);
  });
});

describe("workedTime", () => {
  const day = [
    { start: "08:58", end: "13:02" },
    { start: "13:30", end: "17:07" },
  ];

  it("sums sessions exactly without rules", () => {
    expect(workedTime(day, rules())).toEqual({
      clockedMinutes: 244 + 217,
      breakMinutes: 0,
      workedMinutes: 461,
    });
  });

  it("rounds each punch", () => {
    // 09:00-13:00 + 13:30-17:00 with 15-minute rounding.
    expect(workedTime(day, rules({ roundingMinutes: 15 })).clockedMinutes).toBe(450);
  });

  it("only tops up the break beyond gaps already taken", () => {
    const result = workedTime(day, rules({ roundingMinutes: 15, breakMinutes: 45 }));
    // 30 minutes of gap already, so 15 more are deducted.
    expect(result.breakMinutes).toBe(15);
    expect(result.workedMinutes).toBe(435);
  });

  it("deducts the full break from one long session", () => {
    const result = workedTime(
      [{ start: "09:00", end: "17:00" }],
      rules({ breakMinutes: 30, breakAfterHours: 6 }),
    );
    expect(result).toEqual({ clockedMinutes: 480, breakMinutes: 30, workedMinutes: 450 });
  });

  it("skips the break on short days", () => {
    const result = workedTime(
      [{ start: "09:00", end: "13:00" }],
      rules({ breakMinutes: 30, breakAfterHours: 6 }),
    );
    expect(result.breakMinutes).toBe(0);
  });

  it("counts running sessions up to now and overnight sessions", () => {
    expect(workedTime([{ start: "09:00", end: null }], rules()).clockedMinutes).toBe(0);
    expect(workedTime([{ start: "09:00", end: null }], rules(), 630).clockedMinutes).toBe(90);
    expect(workedTime([{ start: "22:00", end: "06:00" }], rules()).clockedMinutes).toBe(480);
  });
});

describe("computePeriod", () => {
  it("assumes the schedule for days without input", () => {
    const period = computePeriod(data(), MONTH, START_DAY, rules());
    expect(period.workingDaysCount).toBe(22);
    expect(period.estimatedHours).toBe(176);
    expect(period.actualHours).toBe(176);
    expect(period.byKey[MONDAY].source).toBe("scheduled");
    expect(period.byKey[SATURDAY]).toMatchObject({ isWorkingDay: false, hours: 0, source: "none" });
  });

  it("prefers sessions over manual hours", () => {
    const period = computePeriod(
      data({
        dailyHours: { [MONDAY]: 3 },
        timeEntries: { [MONDAY]: [{ start: "09:00", end: "19:00" }] },
      }),
      MONTH,
      START_DAY,
      rules(),
    );
    expect(period.byKey[MONDAY]).toMatchObject({ hours: 10, source: "sessions" });
    expect(period.actualHours).toBe(176 + 2);
  });

  it("handles sick and vacation days", () => {
    const period = computePeriod(
      data({
        defaultHours: 7,
        exceptions: { [MONDAY]: "sick", "2026-2-3": "vacation" },
        dailyHours: { "2026-2-3": 1 },
      }),
      MONTH,
      START_DAY,
      rules(),
    );
    expect(period.sickDays).toBe(1);
    expect(period.vacationDays).toBe(1);
    expect(period.byKey[MONDAY].hours).toBe(0);
    expect(period.byKey["2026-2-3"].hours).toBe(8);
    expect(period.actualHours).toBe(176 - 8 - 8 + 8);
  });

  it("counts days off as overtime", () => {
    const period = computePeriod(
      data({ extraHours: { [SATURDAY]: 4 } }),
      MONTH,
      START_DAY,
      rules(),
    );
    expect(period.extraHoursTotal).toBe(4);
    expect(period.overtimeHours).toBe(4);
    expect(period.actualHours).toBe(180);
  });

  it("optionally counts long workdays as overtime", () => {
    const input = data({ dailyHours: { [MONDAY]: 10 } });
    expect(computePeriod(input, MONTH, START_DAY, rules()).overtimeHours).toBe(0);
    expect(
      computePeriod(input, MONTH, START_DAY, rules({ overtimeIncludesLongDays: true }))
        .overtimeHours,
    ).toBe(2);
  });

  it("applies the live clock only to the live day", () => {
    const input = data({ timeEntries: { [MONDAY]: [{ start: "09:00", end: null }] } });
    expect(computePeriod(input, MONTH, START_DAY, rules()).byKey[MONDAY].hours).toBe(0);
    expect(
      computePeriod(input, MONTH, START_DAY, rules(), { key: MONDAY, nowMinutes: 720 })
        .byKey[MONDAY].hours,
    ).toBe(3);
  });

  it("totals breaks", () => {
    const period = computePeriod(
      data({ timeEntries: { [MONDAY]: [{ start: "09:00", end: "17:30" }] } }),
      MONTH,
      START_DAY,
      rules({ breakMinutes: 30 }),
    );
    expect(period.breakMinutesTotal).toBe(30);
    expect(period.byKey[MONDAY].hours).toBe(8);
  });
});

describe("computePay", () => {
  const pay = { hourlyRate: 20, taxPercent: 25, extraDeduction: 50, overtimeMultiplier: 1 };

  it("pays every hour at the rate without a multiplier", () => {
    expect(computePay({ actualHours: 100, overtimeHours: 10 }, pay)).toEqual({
      salaried: false,
      yearly: 0,
      rate: 20,
      effectiveRate: 20,
      regularHours: 100,
      overtimeHours: 0,
      unpaidOvertimeHours: 0,
      regularPay: 2000,
      overtimePay: 0,
      gross: 2000,
      tax: 500,
      deductions: 50,
      net: 1450,
    });
  });

  it("pays overtime at the multiplier", () => {
    const result = computePay(
      { actualHours: 100, overtimeHours: 10 },
      { ...pay, overtimeMultiplier: 1.5 },
    );
    expect(result.regularPay).toBe(1800);
    expect(result.overtimePay).toBe(300);
    expect(result.gross).toBe(2100);
    expect(result.net).toBe(2100 - 525 - 50);
  });

  it("never goes negative", () => {
    expect(computePay({ actualHours: 1, overtimeHours: 0 }, { ...pay, extraDeduction: 1000 }).net).toBe(0);
  });
});

describe("computePay on a salary", () => {
  const salary = (patch: Partial<SalarySettings> = {}): SalarySettings => ({
    ...DEFAULT_SALARY,
    enabled: true,
    weeklyHours: 40,
    ...patch,
  });
  const pay = { hourlyRate: 15, taxPercent: 0, extraDeduction: 0, overtimeMultiplier: 1.5 };

  it("pays an hourly rate over weekly hours as a twelfth of the year", () => {
    // 15 × 40 × 52 = 31,200 a year, 2,600 a period.
    const result = computePay({ actualHours: 120, overtimeHours: 0 }, { ...pay, salary: salary() });
    expect(result.salaried).toBe(true);
    expect(result.rate).toBe(15);
    expect(result.yearly).toBe(31200);
    expect(result.regularPay).toBe(2600);
    expect(result.gross).toBe(2600);
  });

  it("pays a yearly amount and derives the rate from the weekly hours", () => {
    const result = computePay(
      { actualHours: 160, overtimeHours: 0 },
      { ...pay, salary: salary({ basis: "yearly", yearlyAmount: 41600 }) },
    );
    expect(result.regularPay).toBeCloseTo(41600 / 12);
    expect(result.rate).toBe(20);
  });

  it("doesn't change with the hours worked", () => {
    const short = computePay({ actualHours: 50, overtimeHours: 0 }, { ...pay, salary: salary() });
    const long = computePay({ actualHours: 200, overtimeHours: 0 }, { ...pay, salary: salary() });
    expect(short.gross).toBe(long.gross);
    expect(long.effectiveRate).toBe(2600 / 200);
  });

  it("tracks overtime as unpaid by default", () => {
    const result = computePay({ actualHours: 180, overtimeHours: 10 }, { ...pay, salary: salary() });
    expect(result.overtimePay).toBe(0);
    expect(result.overtimeHours).toBe(0);
    expect(result.unpaidOvertimeHours).toBe(10);
    expect(result.gross).toBe(2600);
  });

  it("pays overtime on top at the implied rate, even at 1×", () => {
    const paid = computePay(
      { actualHours: 180, overtimeHours: 10 },
      { ...pay, salary: salary({ overtimePaid: true }) },
    );
    expect(paid.overtimePay).toBe(10 * 15 * 1.5);
    expect(paid.gross).toBe(2600 + 225);
    expect(paid.unpaidOvertimeHours).toBe(0);

    const flat = computePay(
      { actualHours: 180, overtimeHours: 10 },
      { ...pay, overtimeMultiplier: 1, salary: salary({ overtimePaid: true }) },
    );
    expect(flat.overtimePay).toBe(150);
  });

  it("ignores a salary that's switched off", () => {
    const result = computePay(
      { actualHours: 100, overtimeHours: 0 },
      { ...pay, salary: salary({ enabled: false }) },
    );
    expect(result.salaried).toBe(false);
    expect(result.gross).toBe(1500);
  });

  it("pays nothing hourly on a yearly basis without contracted hours", () => {
    const result = computePay(
      { actualHours: 100, overtimeHours: 5 },
      { ...pay, salary: salary({ basis: "yearly", yearlyAmount: 12000, weeklyHours: 0, overtimePaid: true }) },
    );
    expect(result.rate).toBe(0);
    expect(result.gross).toBe(1000);
  });
});

describe("normalizeSalary", () => {
  it("defaults to hourly pay for older files", () => {
    expect(normalizeSalary(undefined)).toEqual(DEFAULT_SALARY);
  });

  it("clamps bad values", () => {
    expect(
      normalizeSalary({ basis: "monthly" as never, weeklyHours: 500, yearlyAmount: -1 }),
    ).toMatchObject({ basis: "weekly", weeklyHours: 168, yearlyAmount: 0 });
  });
});

describe("estimateFinish", () => {
  const noBreak = { breakMinutes: 0, breakAfterHours: 6 };
  const lunch = { breakMinutes: 30, breakAfterHours: 6 };
  const at = (clock: string) => {
    const [h, m] = clock.split(":").map(Number);
    return h * 60 + m;
  };

  it("finishes 9 hours after a 7am start", () => {
    const result = estimateFinish([{ start: "07:00", end: null }], 9, noBreak, at("10:00"));
    expect(result).toEqual({ finishMinutes: at("16:00"), remainingMinutes: 360 });
  });

  it("adds the automatic break the day will reach", () => {
    const result = estimateFinish([{ start: "07:00", end: null }], 9, lunch, at("10:00"));
    expect(result?.finishMinutes).toBe(at("16:30"));
  });

  it("counts time off the clock towards the break", () => {
    // 07:00–11:00, back at 11:20: 20 min of the 30 already taken.
    const result = estimateFinish(
      [
        { start: "07:00", end: "11:00" },
        { start: "11:20", end: null },
      ],
      9,
      lunch,
      at("12:00"),
    );
    expect(result?.finishMinutes).toBe(at("16:30"));
  });

  it("assumes a start now when off the clock", () => {
    expect(estimateFinish([], 8, noBreak, at("09:15"))?.finishMinutes).toBe(at("17:15"));
  });

  it("runs past midnight", () => {
    const result = estimateFinish([{ start: "20:00", end: null }], 8, noBreak, at("21:00"));
    expect(result?.finishMinutes).toBe(at("04:00") + 1440);
  });

  it("is null once the target is met or without one", () => {
    expect(estimateFinish([{ start: "07:00", end: "16:00" }], 9, noBreak, at("17:00"))).toBeNull();
    expect(estimateFinish([], 0, noBreak, at("09:00"))).toBeNull();
  });
});

describe("weeklyDayTarget", () => {
  // The week of Monday 2 – Sunday 8 March 2026, on a 45h, 9h-a-day schedule.
  const WEEK_DAYS = ["2026-2-2", "2026-2-3", "2026-2-4", "2026-2-5", "2026-2-6"];
  const THURSDAY = new Date(2026, 2, 5);
  const FRIDAY = new Date(2026, 2, 6);
  const week = (patch: Partial<TrackerData>) =>
    computePeriod(data({ hoursPerDay: 9, ...patch }), MONTH, START_DAY, rules()).days.filter(
      (day) => day.date >= new Date(2026, 2, 2) && day.date <= new Date(2026, 2, 8),
    );
  const logged = (...hours: number[]) =>
    Object.fromEntries(hours.map((value, index) => [WEEK_DAYS[index], value]));

  it("leaves 5h for Friday after 40h Monday to Thursday", () => {
    expect(weeklyDayTarget(week({ dailyHours: logged(10, 10, 10, 10) }), FRIDAY, 45, 5)).toBe(5);
  });

  it("asks for more when the week is short", () => {
    expect(weeklyDayTarget(week({ dailyHours: logged(8, 8, 8, 8) }), FRIDAY, 45, 5)).toBe(13);
  });

  it("shares what's left over the days still to come", () => {
    // 20h done by Thursday leaves 25h for Thursday and Friday.
    expect(weeklyDayTarget(week({ dailyHours: logged(10, 10, 0) }), THURSDAY, 45, 5)).toBe(12.5);
  });

  it("is the plain daily hours on a steady week", () => {
    expect(weeklyDayTarget(week({}), THURSDAY, 45, 5)).toBe(9);
  });

  it("uses contracted hours that differ from the schedule", () => {
    expect(weeklyDayTarget(week({ dailyHours: logged(8, 8, 8, 8) }), FRIDAY, 40, 5)).toBe(8);
  });

  it("credits sick days with their share and vacation with holiday hours", () => {
    // Monday sick (9h share), Tuesday vacation (8h holiday), Wed–Thu 9h each.
    const days = week({
      exceptions: { "2026-2-2": "sick", "2026-2-3": "vacation" },
      dailyHours: { "2026-2-4": 9, "2026-2-5": 9 },
    });
    expect(weeklyDayTarget(days, FRIDAY, 45, 5)).toBe(10);
  });

  it("leaves days marked off later in the week out of the share", () => {
    const days = week({ exceptions: { "2026-2-6": "vacation" } });
    // Mon–Wed scheduled 27h, Friday's 8h holiday: 10h left for Thursday alone.
    expect(weeklyDayTarget(days, THURSDAY, 45, 5)).toBe(10);
  });

  it("counts days settled by the hour as their share, not what was worked", () => {
    // A contract change mid-week: Mon–Tue paid by the hour, Wed on a salary.
    const days = week({ dailyHours: logged(12 + 5 / 60, 11.5, 10 + 55 / 60, 8 + 52 / 60) });
    const settled = (day: { key: string }) => day.key === "2026-2-2" || day.key === "2026-2-3";
    // Without it the hourly days leave only 1h 38m; with it, 45 − 18 − 19h 47m.
    expect(weeklyDayTarget(days, FRIDAY, 45, 5)).toBeCloseTo(1 + 38 / 60);
    expect(weeklyDayTarget(days, FRIDAY, 45, 5, 0, settled)).toBeCloseTo(7 + 13 / 60);
  });

  it("is 0 on days off, marked days, and once the week is done", () => {
    expect(weeklyDayTarget(week({}), new Date(2026, 2, 7), 45, 5)).toBe(0);
    expect(weeklyDayTarget(week({ exceptions: { "2026-2-6": "sick" } }), FRIDAY, 45, 5)).toBe(0);
    expect(weeklyDayTarget(week({ dailyHours: logged(12, 12, 12, 12) }), FRIDAY, 45, 5)).toBe(0);
  });
});

describe("countVacation", () => {
  // Payslips from the 21st: "2026-01" runs 21 Dec 2025 – 20 Jan 2026.
  const days = (mk: string, exceptions: TrackerData["exceptions"]) =>
    computePeriod(data({ exceptions }), mk, 21, rules()).days;
  const TODAY = new Date(2026, 0, 14);

  it("splits taken and booked days around today", () => {
    const result = countVacation(
      days("2026-01", { "2026-0-12": "vacation", "2026-0-14": "vacation", "2026-0-15": "vacation" }),
      leaveYearRange(2026, 1),
      TODAY,
    );
    expect(result).toEqual({ taken: 2, booked: 1 });
  });

  it("only counts days in the calendar year", () => {
    // 22 Dec 2025 is in the "2026-01" period but not in 2026.
    const result = countVacation(
      days("2026-01", { "2025-11-22": "vacation", "2026-0-5": "vacation" }),
      leaveYearRange(2026, 1),
      TODAY,
    );
    expect(result).toEqual({ taken: 1, booked: 0 });
  });

  it("ignores sick days and weekends", () => {
    // 10 Jan 2026 is a Saturday, so it can't be marked.
    const result = countVacation(
      days("2026-01", { "2026-0-6": "sick", "2026-0-10": "vacation" }),
      leaveYearRange(2026, 1),
      TODAY,
    );
    expect(result).toEqual({ taken: 0, booked: 0 });
  });

  it("adds up days across periods without double counting", () => {
    const january = days("2026-01", { "2026-0-5": "vacation" });
    const february = days("2026-02", { "2026-0-26": "vacation" });
    expect(countVacation([...january, ...february, ...january], leaveYearRange(2026, 1), TODAY)).toEqual({
      taken: 1,
      booked: 1,
    });
  });
});

describe("hourBalance", () => {
  // March 2026 on a 45h week, 9h a day; Monday 9 March starts the next week.
  const NEXT_MONDAY = new Date(2026, 2, 9);
  const days = (patch: Partial<TrackerData>) =>
    computePeriod(data({ hoursPerDay: 9, ...patch }), MONTH, START_DAY, rules()).days;
  const firstWeek = (...hours: number[]) =>
    Object.fromEntries(hours.map((value, index) => [`2026-2-${index + 2}`, value]));
  const weekOf = (monday: Date) =>
    days({}).filter(
      (day) =>
        day.date >= monday &&
        day.date < new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 7),
    );

  it("banks a 50h week as 5h, which leaves 40h for the next", () => {
    const balance = hourBalance(days({ dailyHours: firstWeek(10, 10, 10, 10, 10) }), NEXT_MONDAY, 9);
    expect(balance).toBe(5);
    // Monday of the next week: 40h over five days.
    expect(weeklyDayTarget(weekOf(NEXT_MONDAY), NEXT_MONDAY, 45, 5, balance)).toBe(8);
  });

  it("owes a short week, making the next one longer", () => {
    const balance = hourBalance(days({ dailyHours: firstWeek(8, 8, 8, 8, 8) }), NEXT_MONDAY, 9);
    expect(balance).toBe(-5);
    expect(weeklyDayTarget(weekOf(NEXT_MONDAY), NEXT_MONDAY, 45, 5, balance)).toBe(10);
  });

  it("is neutral on scheduled, sick and matching vacation days", () => {
    const balance = hourBalance(
      days({ defaultHours: 9, exceptions: { "2026-2-2": "sick", "2026-2-3": "vacation" } }),
      NEXT_MONDAY,
      9,
    );
    expect(balance).toBe(0);
  });

  it("banks hours on days off and ignores days from `before` on", () => {
    // Saturday 7 March counts; Tuesday 10 March is after the cut-off.
    const balance = hourBalance(
      days({ extraHours: { "2026-2-7": 4 }, dailyHours: { "2026-2-10": 12 } }),
      NEXT_MONDAY,
      9,
    );
    expect(balance).toBe(4);
  });
});

describe("weeklyHoursOf", () => {
  it("uses a salary's contracted hours, else the schedule", () => {
    expect(weeklyHoursOf(data({ hoursPerDay: 9 }))).toBe(45);
    expect(
      weeklyHoursOf(data({ salary: { ...DEFAULT_SALARY, enabled: true, weeklyHours: 37.5 } })),
    ).toBe(37.5);
  });
});

describe("leave years", () => {
  it("runs from the start month to a year on", () => {
    expect(leaveYearRange(2026, 4)).toEqual({
      start: new Date(2026, 3, 1),
      end: new Date(2027, 3, 1),
    });
    expect(leaveYearRange(2026, 99).start).toEqual(new Date(2026, 11, 1));
  });

  it("counts vacation in an April–March leave year", () => {
    const march = computePeriod(
      data({ exceptions: { "2026-2-2": "vacation", "2026-2-31": "vacation" } }),
      MONTH,
      START_DAY,
      rules(),
    ).days;
    // 2 March is in the 2025 leave year; 31 March too (it ends 31 March 2026).
    expect(countVacation(march, leaveYearRange(2025, 4), new Date(2026, 5, 1))).toEqual({
      taken: 2,
      booked: 0,
    });
    expect(countVacation(march, leaveYearRange(2026, 4), new Date(2026, 5, 1))).toEqual({
      taken: 0,
      booked: 0,
    });
  });
});

describe("carriedBalance", () => {
  // Dec 2025 – Jan 2026 periods on a 45h week, 9h a day, from the 1st.
  const period = (mk: string, dailyHours: Record<string, number>) => ({
    days: computePeriod(data({ hoursPerDay: 9, dailyHours }), mk, START_DAY, rules()).days,
    share: 9,
    overtimePaid: false,
  });
  // 10h on Mon 1 Dec 2025 and on Mon 5 Jan 2026.
  const sources = [period("2026-01", { "2025-11-1": 10 }), period("2026-02", { "2026-0-5": 10 })];
  const MONDAY = new Date(2026, 0, 12);
  const noLimits = { balanceResetsYearly: false, balanceCapHours: 0, balanceStartDate: "" };

  it("adds up every period before the week", () => {
    expect(carriedBalance(sources, MONDAY, noLimits)).toBe(2);
  });

  it("starts from zero on 1 January when it resets", () => {
    expect(carriedBalance(sources, MONDAY, { ...noLimits, balanceResetsYearly: true })).toBe(1);
  });

  it("stays within the cap either way", () => {
    expect(carriedBalance(sources, MONDAY, { ...noLimits, balanceCapHours: 1.5 })).toBe(1.5);
    const short = [period("2026-02", { "2026-0-5": 0 })];
    expect(carriedBalance(short, MONDAY, { ...noLimits, balanceCapHours: 4 })).toBe(-4);
  });

  it("skips days before the start date", () => {
    expect(carriedBalance(sources, MONDAY, { ...noLimits, balanceStartDate: "2026-01-05" })).toBe(1);
    expect(carriedBalance(sources, MONDAY, { ...noLimits, balanceStartDate: "2026-01-06" })).toBe(0);
  });

  it("starts from the later of the start date and 1 January", () => {
    const rulesBoth = { ...noLimits, balanceResetsYearly: true, balanceStartDate: "2025-06-01" };
    expect(carriedBalance(sources, MONDAY, rulesBoth)).toBe(1);
  });
});

describe("balanceSource", () => {
  const salary = (patch: Partial<SalarySettings> = {}): SalarySettings => ({
    ...DEFAULT_SALARY,
    enabled: true,
    weeklyHours: 45,
    ...patch,
  });

  it("leaves out periods paid by the hour, whose hours were all paid", () => {
    expect(balanceSource(data({ hoursPerDay: 9 }), [])).toBeNull();
    expect(balanceSource(data({ salary: salary({ enabled: false }) }), [])).toBeNull();
  });

  it("shares a salary's weekly hours over the scheduled days", () => {
    expect(balanceSource(data({ salary: salary({ overtimePaid: true }) }), [])).toEqual({
      days: [],
      share: 9,
      overtimePaid: true,
    });
  });

  it("switching to a salary mid-history only banks from the salaried periods", () => {
    // February (hourly): a 50h week. March (salaried): a 46h week.
    const hourly = data({ hoursPerDay: 9, dailyHours: { "2026-1-2": 14 } });
    const salaried = data({ hoursPerDay: 9, salary: salary(), dailyHours: { "2026-2-2": 10 } });
    const sources = [
      balanceSource(hourly, computePeriod(hourly, "2026-03", START_DAY, rules()).days),
      balanceSource(salaried, computePeriod(salaried, MONTH, START_DAY, rules()).days),
    ].filter((source): source is NonNullable<typeof source> => source !== null);
    const limits = { balanceResetsYearly: false, balanceCapHours: 0, balanceStartDate: "" };
    expect(carriedBalance(sources, new Date(2026, 3, 1), limits)).toBe(1);
  });
});

describe("hourBalance with overtime paid on top", () => {
  // Monday 2 March 11h (2h over), Saturday 7 March 4h, on 9h days.
  const days = (overtimeIncludesLongDays: boolean) =>
    computePeriod(
      data({ hoursPerDay: 9, dailyHours: { "2026-2-2": 11 }, extraHours: { "2026-2-7": 4 } }),
      MONTH,
      START_DAY,
      rules({ overtimeIncludesLongDays }),
    ).days;
  const NEXT_MONDAY = new Date(2026, 2, 9);

  it("doesn't bank days-off hours, which were paid", () => {
    expect(hourBalance(days(false), NEXT_MONDAY, 9, { overtimePaid: true })).toBe(2);
    expect(hourBalance(days(false), NEXT_MONDAY, 9)).toBe(6);
  });

  it("doesn't bank long days either when they count as overtime", () => {
    expect(hourBalance(days(true), NEXT_MONDAY, 9, { overtimePaid: true })).toBe(0);
  });
});

describe("computePay yearly estimate", () => {
  it("estimates the year by the hour from the weekly hours", () => {
    const result = computePay(
      { actualHours: 100, overtimeHours: 0 },
      { hourlyRate: 20, taxPercent: 0, extraDeduction: 0, overtimeMultiplier: 1, weeklyHours: 40 },
    );
    expect(result.yearly).toBe(41600);
  });
});
