import { describe, expect, it } from "vitest";
import {
  computePay,
  computePeriod,
  DEFAULT_WORK_RULES,
  normalizeWorkRules,
  roundMinutes,
  workedTime,
} from "../calculations";
import { TrackerData, WorkRules } from "../types";

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
      }),
    ).toEqual({
      breakMinutes: 0,
      breakAfterHours: 24,
      roundingMinutes: 0,
      overtimeMultiplier: 5,
      overtimeIncludesLongDays: true,
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
      regularHours: 100,
      overtimeHours: 0,
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
