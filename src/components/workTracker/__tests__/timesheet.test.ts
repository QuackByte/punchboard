import { describe, expect, it } from "vitest";
import { computePay, computePeriod, DEFAULT_WORK_RULES } from "../calculations";
import { buildTimesheetRows, isoDate, timesheetCsv } from "../timesheet";
import { TrackerData } from "../types";

const data: TrackerData = {
  selectedDays: ["mon", "tue", "wed", "thu", "fri"],
  hoursPerDay: 8,
  hourlyRate: 20,
  currency: "EUR",
  secondaryCurrency: "USD",
  conversionRate: 1,
  currencyConversionEnabled: false,
  taxPercent: 10,
  extraDeduction: 0,
  defaultHours: 8,
  exceptions: { "2026-2-3": "sick" },
  dailyHours: {},
  extraHours: {},
  timeEntries: {
    "2026-2-2": [
      { start: "09:00", end: "13:00", note: 'Client "A", kickoff' },
      { start: "14:00", end: "18:30" },
    ],
  },
};

const rules = { ...DEFAULT_WORK_RULES, breakMinutes: 30, overtimeMultiplier: 1.5 };
// With start day 1, "2026-04" is March 2026.
const period = computePeriod(data, "2026-04", 1, rules);
const pay = computePay(period, { hourlyRate: 20, taxPercent: 10, extraDeduction: 0, overtimeMultiplier: 1.5 });
const rows = buildTimesheetRows(period, data.timeEntries!);

describe("buildTimesheetRows", () => {
  it("has a row per day with sessions, notes and statuses", () => {
    expect(rows).toHaveLength(31);
    const monday = rows.find((row) => row.key === "2026-2-2")!;
    expect(monday).toMatchObject({
      status: "Workday",
      sessions: "09:00–13:00, 14:00–18:30",
      notes: 'Client "A", kickoff',
      clockedHours: 8.5,
      breakMinutes: 0, // the lunch gap already covers the break
      hours: 8.5,
      assumed: false,
    });
    expect(rows.find((row) => row.key === "2026-2-3")!.status).toBe("Sick");
    expect(rows.find((row) => row.key === "2026-2-1")!.status).toBe("Day off");
    expect(rows.find((row) => row.key === "2026-2-4")!.assumed).toBe(true);
  });
});

describe("timesheetCsv", () => {
  const csv = timesheetCsv(rows, period, pay, {
    title: "March 2026",
    periodLabel: "1 Mar 2026 – 31 Mar 2026",
    currency: "EUR",
    hourlyRate: 20,
    taxPercent: 10,
    overtimeMultiplier: 1.5,
  });
  const lines = csv.replace(/^﻿/, "").split("\r\n");

  it("starts with a BOM and a header row", () => {
    expect(csv.startsWith("﻿")).toBe(true);
    expect(lines[0]).toBe(
      "Date,Weekday,Status,Sessions,Notes,Clocked (h),Break (min),Hours,Overtime (h),Source",
    );
  });

  it("quotes cells with commas and quotes", () => {
    const monday = lines.find((line) => line.startsWith("2026-03-02"))!;
    expect(monday).toBe(
      '2026-03-02,Mon,Workday,"09:00–13:00, 14:00–18:30","Client ""A"", kickoff",8.5,0,8.5,0,Punched',
    );
  });

  it("ends with the period summary", () => {
    expect(lines).toContain("Hours worked,168.5");
    expect(lines).toContain("Sick days,1");
    expect(lines.at(-1)).toBe(`Net (EUR),${Math.round(pay.net * 100) / 100}`);
  });
});

describe("isoDate", () => {
  it("pads months and days", () => {
    expect(isoDate(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});
