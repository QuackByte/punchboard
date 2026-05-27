import { TrackerUiState, UI_STATE_KEY } from "./types";

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

function getCurrentPayslipEndMonthKey(today: Date, startDay: number) {
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
