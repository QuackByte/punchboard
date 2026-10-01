import { TimeEntry, TrackerUiState, UI_STATE_KEY } from "./types";

export function safeStorageGetItem(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function safeStorageSetItem(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Ignore quota/security errors so app remains usable.
  }
}

export function safeStorageRemoveItem(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    // Ignore storage errors so app remains usable.
  }
}

export function formatMonthKey(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${date.getFullYear()}-${month}`;
}

export function parseMonthKey(monthKey: string) {
  const [yearText, monthText] = monthKey.split("-");
  const year = Number(yearText);
  const monthIndex = Number(monthText) - 1;

  if (
    !Number.isFinite(year) ||
    !Number.isFinite(monthIndex) ||
    monthIndex < 0 ||
    monthIndex > 11
  ) {
    const now = new Date();
    return { year: now.getFullYear(), monthIndex: now.getMonth() };
  }

  return { year, monthIndex };
}

export function getInitialUiState() {
  const now = new Date();
  const fallback: TrackerUiState = {
    monthKey: getCurrentPayslipEndMonthKey(now, 21),
    graphYear: now.getFullYear(),
  };

  const raw = safeStorageGetItem(UI_STATE_KEY);
  if (!raw) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<TrackerUiState>;
    const monthKey =
      typeof parsed.monthKey === "string" &&
      /^\d{4}-\d{2}$/.test(parsed.monthKey)
        ? parsed.monthKey
        : fallback.monthKey;
    const graphYear =
      typeof parsed.graphYear === "number" && Number.isFinite(parsed.graphYear)
        ? parsed.graphYear
        : fallback.graphYear;

    return { monthKey, graphYear };
  } catch {
    safeStorageRemoveItem(UI_STATE_KEY);
    return fallback;
  }
}

export function getCurrentPayslipEndMonthKey(today: Date, startDay: number) {
  const safeStartDay = clampDay(startDay);
  const endMonthDate =
    today.getDate() >= safeStartDay
      ? new Date(today.getFullYear(), today.getMonth() + 1, 1)
      : new Date(today.getFullYear(), today.getMonth(), 1);

  return formatMonthKey(endMonthDate);
}

export function getPayslipRange(monthKey: string, startDay: number) {
  const { year, monthIndex } = parseMonthKey(monthKey);
  const safeStartDay = clampDay(startDay);
  const startMonthDate = new Date(year, monthIndex - 1, 1);
  const startMonthDays = new Date(
    startMonthDate.getFullYear(),
    startMonthDate.getMonth() + 1,
    0,
  ).getDate();
  const resolvedStartDay = Math.min(safeStartDay, startMonthDays);
  const start = new Date(
    startMonthDate.getFullYear(),
    startMonthDate.getMonth(),
    resolvedStartDay,
  );

  const endMonthDays = new Date(year, monthIndex + 1, 0).getDate();
  const endMonthStartDay = Math.min(safeStartDay, endMonthDays);
  const end = new Date(year, monthIndex, endMonthStartDay - 1);

  return { start, end };
}

export function getPreviousMonthKey(monthKey: string) {
  const { year, monthIndex } = parseMonthKey(monthKey);
  return formatMonthKey(new Date(year, monthIndex - 1, 1));
}

export function getDatesInPayslipRange(monthKey: string, startDay: number) {
  const { start, end } = getPayslipRange(monthKey, startDay);
  const dates: Date[] = [];
  const current = new Date(start);

  while (current <= end) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

export function dateKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

export function clampDay(day: number) {
  return Math.min(31, Math.max(1, day || 1));
}

export function clampHours(hours: number) {
  if (!Number.isFinite(hours)) {
    return 0;
  }
  return Math.min(24, Math.max(0, hours));
}

export function clampPercent(percent: number) {
  if (!Number.isFinite(percent)) {
    return 0;
  }
  return Math.min(100, Math.max(0, percent));
}

const TIME_RANGE_REGEX =
  /^(\d{1,2})(?::(\d{2}))?\s*(?:-|to|–|—)\s*(\d{1,2})(?::(\d{2}))?$/i;
const DURATION_REGEX =
  /^(?:(\d{1,2}(?:\.\d+)?)\s*h)?\s*(?:(\d{1,2})\s*m)?$/i;

/**
 * Parses hours entered as a plain decimal ("7.5"), a duration ("9h 40m",
 * "9h", "40m"), or a time range ("08:30 to 18:45", "08:30-18:45"). Returns
 * null when the text doesn't match any of these shapes.
 */
export function parseHoursInput(rawInput: string): number | null {
  const input = rawInput.trim();
  if (!input) {
    return null;
  }

  const rangeMatch = input.match(TIME_RANGE_REGEX);
  if (rangeMatch) {
    const startHour = Number(rangeMatch[1]);
    const startMinute = Number(rangeMatch[2] ?? 0);
    const endHour = Number(rangeMatch[3]);
    const endMinute = Number(rangeMatch[4] ?? 0);

    if (
      startHour > 23 ||
      endHour > 23 ||
      startMinute > 59 ||
      endMinute > 59
    ) {
      return null;
    }

    const diffMinutes = endHour * 60 + endMinute - (startHour * 60 + startMinute);
    if (diffMinutes <= 0) {
      return null;
    }

    return diffMinutes / 60;
  }

  const durationMatch = input.match(DURATION_REGEX);
  if (
    durationMatch &&
    (durationMatch[1] !== undefined || durationMatch[2] !== undefined)
  ) {
    const hoursPart = Number(durationMatch[1] ?? 0);
    const minutesPart = Number(durationMatch[2] ?? 0);
    if (minutesPart > 59) {
      return null;
    }
    return hoursPart + minutesPart / 60;
  }

  const plainNumber = Number(input);
  if (Number.isFinite(plainNumber)) {
    return plainNumber;
  }

  return null;
}

/** Formats hours as a duration string, e.g. 9.5 -> "9h 30m", 8 -> "8h". */
export function formatDuration(hours: number) {
  const totalMinutes = Math.round(Math.max(0, hours) * 60);
  const wholeHours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (minutes === 0) {
    return `${wholeHours}h`;
  }
  if (wholeHours === 0) {
    return `${minutes}m`;
  }

  return `${wholeHours}h ${String(minutes).padStart(2, "0")}m`;
}

/** Same as formatDuration, but returns "" for zero/blank values. */
export function formatDurationOrBlank(hours: number) {
  if (!hours || hours <= 0) {
    return "";
  }
  return formatDuration(hours);
}

const CLOCK_REGEX = /^(\d{1,2})(?:[:.h]?(\d{2}))?\s*(am|pm)?$/i;

/**
 * Parses a wall-clock time like "9", "9:30", "0930", "9.30" or "5pm" into
 * minutes since midnight. Returns null when it isn't a valid time.
 */
export function parseClock(rawInput: string): number | null {
  const input = rawInput.trim().toLowerCase();
  const match = input.match(CLOCK_REGEX);
  if (!match) {
    return null;
  }

  let hour = Number(match[1]);
  const minute = Number(match[2] ?? 0);
  const meridiem = match[3];

  if (meridiem) {
    if (hour < 1 || hour > 12) {
      return null;
    }
    hour = (hour % 12) + (meridiem === "pm" ? 12 : 0);
  }

  if (hour > 23 || minute > 59) {
    return null;
  }

  return hour * 60 + minute;
}

/** Formats minutes since midnight as "HH:MM". */
export function formatClock(minutes: number) {
  const normalized = ((Math.round(minutes) % 1440) + 1440) % 1440;
  const hour = Math.floor(normalized / 60);
  const minute = normalized % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function minutesSinceMidnight(date: Date) {
  return date.getHours() * 60 + date.getMinutes();
}

/**
 * Length of a session in minutes. Running sessions count up to `nowMinutes`
 * when given, otherwise they count as zero. Sessions whose end is before
 * their start are treated as running past midnight.
 */
export function entryMinutes(entry: TimeEntry, nowMinutes?: number) {
  const start = parseClock(entry.start);
  if (start === null) {
    return 0;
  }

  const endText = entry.end ?? (nowMinutes !== undefined ? formatClock(nowMinutes) : null);
  const end = endText === null ? null : parseClock(endText);
  if (end === null) {
    return 0;
  }

  return end >= start ? end - start : end + 1440 - start;
}

/** Total hours across a day's sessions (running sessions as in entryMinutes). */
export function sumEntriesHours(entries: TimeEntry[], nowMinutes?: number) {
  return (
    entries.reduce((total, entry) => total + entryMinutes(entry, nowMinutes), 0) /
    60
  );
}

export function sortEntries(entries: TimeEntry[]) {
  return [...entries].sort(
    (a, b) => (parseClock(a.start) ?? 0) - (parseClock(b.start) ?? 0),
  );
}

const SESSION_RANGE_REGEX = /^(.+?)\s*(?:-|to|–|—)\s*(.+)$/i;

/**
 * Parses a quick-entry line for a day. Accepts either a list of sessions
 * ("9-13, 14:30-18", "8:45 to 12:15; 13-17:30") or a single total
 * ("7.5", "7h 30m"). Returns null when the text can't be understood.
 */
export function parseDayInput(
  rawInput: string,
): { kind: "sessions"; entries: TimeEntry[] } | { kind: "total"; hours: number } | null {
  const input = rawInput.trim();
  if (!input) {
    return null;
  }

  const parts = input
    .split(/[,;]|\s+and\s+/i)
    .map((part) => part.trim())
    .filter(Boolean);
  const looksLikeSessions = parts.every((part) => SESSION_RANGE_REGEX.test(part));

  if (looksLikeSessions) {
    const entries: TimeEntry[] = [];
    for (const part of parts) {
      const match = part.match(SESSION_RANGE_REGEX)!;
      const start = parseClock(match[1]);
      const end = parseClock(match[2]);
      if (start === null || end === null || start === end) {
        return null;
      }
      entries.push({ start: formatClock(start), end: formatClock(end) });
    }
    return { kind: "sessions", entries: sortEntries(entries) };
  }

  if (parts.length === 1) {
    const hours = parseHoursInput(input);
    if (hours !== null && hours >= 0 && hours <= 24) {
      return { kind: "total", hours };
    }
  }

  return null;
}

/** Formats a day's sessions back into quick-entry text, e.g. "09:00–13:00, 14:00–18:00". */
export function formatEntries(entries: TimeEntry[]) {
  return entries
    .map((entry) => `${entry.start}–${entry.end ?? "…"}`)
    .join(", ");
}

/** Inverse of dateKey ("2026-9-1" -> Oct 1 2026; months are zero-based). */
export function keyToDate(key: string) {
  const [year, monthIndex, day] = key.split("-").map(Number);
  return new Date(year, monthIndex, day);
}
