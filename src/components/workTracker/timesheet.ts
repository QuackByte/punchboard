import { DayResult, PayResult, PeriodResult } from "./calculations";
import { TimeEntry } from "./types";

/*
 * Timesheet export: turns a computed period into rows for the CSV download
 * and the printable sheet, so both always agree with the on-screen totals.
 */

export interface TimesheetRow {
  key: string;
  date: Date;
  status: "Workday" | "Day off" | "Vacation" | "Sick";
  sessions: string;
  notes: string;
  clockedHours: number;
  breakMinutes: number;
  hours: number;
  overtimeHours: number;
  /** Whether the hours come from the schedule rather than anything logged. */
  assumed: boolean;
}

export interface TimesheetMeta {
  title: string;
  periodLabel: string;
  currency: string;
  hourlyRate: number;
  taxPercent: number;
  overtimeMultiplier: number;
}

function statusOf(day: DayResult): TimesheetRow["status"] {
  if (day.exception === "vacation") return "Vacation";
  if (day.exception === "sick") return "Sick";
  return day.isWorkingDay ? "Workday" : "Day off";
}

export function buildTimesheetRows(
  period: PeriodResult,
  timeEntries: Record<string, TimeEntry[]>,
): TimesheetRow[] {
  return period.days.map((day) => {
    const entries = timeEntries[day.key] ?? [];
    return {
      key: day.key,
      date: day.date,
      status: statusOf(day),
      sessions: entries
        .map((entry) => `${entry.start}–${entry.end ?? "running"}`)
        .join(", "),
      notes: entries
        .map((entry) => entry.note?.trim())
        .filter(Boolean)
        .join("; "),
      clockedHours: day.clockedMinutes / 60,
      breakMinutes: day.breakMinutes,
      hours: day.hours,
      overtimeHours: day.overtimeHours,
      assumed: day.source === "scheduled",
    };
  });
}

/** ISO-style local date, e.g. 2026-10-01. */
export function isoDate(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function csvCell(value: string | number) {
  const text = typeof value === "number" ? String(round2(value)) : value;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

export function timesheetCsv(
  rows: TimesheetRow[],
  period: PeriodResult,
  pay: PayResult,
  meta: TimesheetMeta,
) {
  const lines: Array<Array<string | number>> = [
    [
      "Date",
      "Weekday",
      "Status",
      "Sessions",
      "Notes",
      "Clocked (h)",
      "Break (min)",
      "Hours",
      "Overtime (h)",
      "Source",
    ],
    ...rows.map((row) => [
      isoDate(row.date),
      row.date.toLocaleDateString("en-GB", { weekday: "short" }),
      row.status,
      row.sessions,
      row.notes,
      row.clockedHours,
      row.breakMinutes,
      row.hours,
      row.overtimeHours,
      row.assumed ? "Scheduled" : row.sessions ? "Punched" : row.hours > 0 ? "Manual" : "",
    ]),
    [],
    ["Period", meta.periodLabel],
    ["Hours worked", period.actualHours],
    ["Hours scheduled", period.estimatedHours],
    ["Overtime hours", period.overtimeHours],
    ["Workdays", period.workingDaysCount],
    ["Vacation days", period.vacationDays],
    ["Sick days", period.sickDays],
    ["Breaks deducted (min)", period.breakMinutesTotal],
    [`Hourly rate (${meta.currency})`, meta.hourlyRate],
  ];

  if (pay.overtimePay > 0) {
    lines.push(
      [`Regular pay (${meta.currency})`, pay.regularPay],
      [`Overtime pay ×${meta.overtimeMultiplier} (${meta.currency})`, pay.overtimePay],
    );
  }
  lines.push(
    [`Gross (${meta.currency})`, pay.gross],
    [`Tax ${meta.taxPercent}% (${meta.currency})`, pay.tax],
    [`Deductions (${meta.currency})`, pay.deductions],
    [`Net (${meta.currency})`, pay.net],
  );

  // CRLF and a BOM so Excel opens it as UTF-8 with the en dashes intact.
  return "﻿" + lines.map((line) => line.map(csvCell).join(",")).join("\r\n");
}

export function downloadTextFile(fileName: string, contents: string, type: string) {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
