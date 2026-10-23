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
  taxPercent: number;
  overtimeMultiplier: number;
  /** Money also given in a second currency. */
  conversion?: { currency: string; rate: number };
  /** Vacation in the leave year, when an allowance is set. */
  vacation?: { label: string; used: number; allowance: number };
}

/** The payslip's money lines, labelled without a currency. */
export function payLines(pay: PayResult, meta: TimesheetMeta): Array<[string, number]> {
  const lines: Array<[string, number]> = [];
  if (pay.salaried) {
    lines.push(["Yearly salary", pay.yearly], ["Salary", pay.regularPay]);
    if (pay.overtimePay > 0) {
      lines.push([`Overtime pay ×${meta.overtimeMultiplier}`, pay.overtimePay]);
    }
  } else if (pay.overtimePay > 0) {
    lines.push(
      ["Regular pay", pay.regularPay],
      [`Overtime pay ×${meta.overtimeMultiplier}`, pay.overtimePay],
    );
  }
  lines.push(
    ["Gross", pay.gross],
    [`Tax ${meta.taxPercent}%`, pay.tax],
    ["Deductions", pay.deductions],
    ["Net", pay.net],
  );
  return lines;
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
  ];
  if (meta.vacation) {
    lines.push(
      [`Vacation days used (${meta.vacation.label})`, meta.vacation.used],
      ["Vacation allowance", meta.vacation.allowance],
    );
  }
  lines.push(
    ["Breaks deducted (min)", period.breakMinutesTotal],
    [`Hourly rate (${meta.currency})`, pay.rate],
  );
  if (pay.salaried) {
    lines.push(
      [`Effective hourly rate (${meta.currency})`, pay.effectiveRate],
      ["Unpaid overtime (h)", pay.unpaidOvertimeHours],
    );
  }

  const money = payLines(pay, meta);
  for (const [label, amount] of money) {
    lines.push([`${label} (${meta.currency})`, amount]);
  }
  if (meta.conversion) {
    const { currency, rate } = meta.conversion;
    lines.push([], [`Converted to ${currency}`, `at ${rate}`]);
    for (const [label, amount] of money) {
      lines.push([`${label} (${currency})`, amount * rate]);
    }
  }

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
