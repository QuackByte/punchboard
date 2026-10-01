import { describe, expect, it } from "vitest";
import {
  dateKey,
  formatDuration,
  getCurrentPayslipEndMonthKey,
  getDatesInPayslipRange,
  keyToDate,
  parseClock,
  parseDayInput,
  parseHoursInput,
  sumEntriesHours,
} from "../utils";

describe("parseClock", () => {
  it.each([
    ["9", 540],
    ["9:30", 570],
    ["0930", 570],
    ["9.30", 570],
    ["9h30", 570],
    ["5pm", 1020],
    ["12am", 0],
    ["12pm", 720],
    [" 23:59 ", 1439],
  ])("parses %s", (input, minutes) => {
    expect(parseClock(input)).toBe(minutes);
  });

  it.each(["", "24:00", "9:60", "13pm", "noon"])("rejects %s", (input) => {
    expect(parseClock(input)).toBeNull();
  });
});

describe("parseHoursInput", () => {
  it.each([
    ["7.5", 7.5],
    ["9h 40m", 9 + 40 / 60],
    ["9h", 9],
    ["40m", 40 / 60],
    ["08:30 to 18:45", 10.25],
    ["8-12", 4],
  ])("parses %s", (input, hours) => {
    expect(parseHoursInput(input)).toBeCloseTo(hours);
  });

  it.each(["", "abc", "18-8", "9h 75m"])("rejects %s", (input) => {
    expect(parseHoursInput(input)).toBeNull();
  });
});

describe("parseDayInput", () => {
  it("parses a list of sessions and sorts them", () => {
    expect(parseDayInput("14:30-18, 9-13")).toEqual({
      kind: "sessions",
      entries: [
        { start: "09:00", end: "13:00" },
        { start: "14:30", end: "18:00" },
      ],
    });
  });

  it("accepts 'to', semicolons and 'and' as separators", () => {
    const result = parseDayInput("8:45 to 12:15; 13-17:30 and 19-20");
    expect(result?.kind).toBe("sessions");
    expect(result && result.kind === "sessions" && result.entries).toHaveLength(3);
  });

  it("parses a single total", () => {
    expect(parseDayInput("7h 30m")).toEqual({ kind: "total", hours: 7.5 });
  });

  it("rejects nonsense and zero-length sessions", () => {
    expect(parseDayInput("hello")).toBeNull();
    expect(parseDayInput("9-9")).toBeNull();
    expect(parseDayInput("25")).toBeNull();
  });
});

describe("sumEntriesHours", () => {
  it("handles overnight and running sessions", () => {
    expect(sumEntriesHours([{ start: "22:00", end: "02:00" }])).toBe(4);
    expect(sumEntriesHours([{ start: "09:00", end: null }])).toBe(0);
    expect(sumEntriesHours([{ start: "09:00", end: null }], 600)).toBe(1);
  });
});

describe("formatDuration", () => {
  it.each([
    [8, "8h"],
    [7.5, "7h 30m"],
    [0.25, "15m"],
    [0, "0h"],
    [-3, "0h"],
  ])("formats %s", (hours, text) => {
    expect(formatDuration(hours)).toBe(text);
  });
});

describe("payslip ranges", () => {
  it("runs from the start day of the previous month to the day before", () => {
    const dates = getDatesInPayslipRange("2026-03", 21);
    expect(dateKey(dates[0])).toBe("2026-1-21");
    expect(dateKey(dates[dates.length - 1])).toBe("2026-2-20");
    expect(dates).toHaveLength(28);
  });

  it("clamps the start day to short months", () => {
    const dates = getDatesInPayslipRange("2026-03", 31);
    expect(dateKey(dates[0])).toBe("2026-1-28");
    expect(dateKey(dates[dates.length - 1])).toBe("2026-2-30");
  });

  it("is the previous calendar month when the start day is 1", () => {
    const dates = getDatesInPayslipRange("2026-03", 1);
    expect(dateKey(dates[0])).toBe("2026-1-1");
    expect(dates).toHaveLength(28);
  });

  it("picks the period that contains today", () => {
    expect(getCurrentPayslipEndMonthKey(new Date(2026, 9, 1), 21)).toBe("2026-10");
    expect(getCurrentPayslipEndMonthKey(new Date(2026, 9, 21), 21)).toBe("2026-11");
    expect(getCurrentPayslipEndMonthKey(new Date(2026, 11, 25), 21)).toBe("2027-01");
  });

  it("round-trips date keys", () => {
    const date = new Date(2026, 9, 1);
    expect(keyToDate(dateKey(date)).getTime()).toBe(date.getTime());
  });
});
