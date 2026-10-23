export const daysOfWeek = [
  { key: "mon", label: "Mon" },
  { key: "tue", label: "Tue" },
  { key: "wed", label: "Wed" },
  { key: "thu", label: "Thu" },
  { key: "fri", label: "Fri" },
  { key: "sat", label: "Sat" },
  { key: "sun", label: "Sun" },
] as const;

export const calendarHeaders = [
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
  "Sun",
] as const;

export const weekdayMap = [
  "sun",
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
] as const;

export const currencyOptions = [
  { code: "GBP", symbol: "£" },
  { code: "EUR", symbol: "€" },
  { code: "USD", symbol: "$" },
] as const;

export type CurrencyCode = (typeof currencyOptions)[number]["code"];

export function getCurrencySymbol(currency: CurrencyCode) {
  return currencyOptions.find((option) => option.code === currency)!.symbol;
}

export type DayKey = (typeof daysOfWeek)[number]["key"];

/**
 * One clocked session within a day, as "HH:MM" wall-clock times. A null
 * `end` means the session is still running (punched in, not yet out). An
 * `end` earlier than `start` means the session ran past midnight.
 */
export interface TimeEntry {
  start: string;
  end: string | null;
  /** Optional label, e.g. a client or "on call". */
  note?: string;
}
export type ExceptionType = "vacation" | "sick";
export type ActivityType =
  | "month-change"
  | "weekday-toggle"
  | "exception-change"
  | "value-change"
  | "hours-change";

/**
 * A fixed salary, entered either as an hourly rate over contracted weekly
 * hours or as a yearly amount. It's paid the same every payslip period
 * whatever hours are logged; hours still show the balance and overtime.
 */
export interface SalarySettings {
  enabled: boolean;
  basis: "weekly" | "yearly";
  /** Contracted hours per week (0 = not set yet). */
  weeklyHours: number;
  /** Gross per year, used when the basis is "yearly". */
  yearlyAmount: number;
  /** Pay overtime on top of the salary; otherwise it's tracked but unpaid. */
  overtimePaid: boolean;
}

export interface TrackerData {
  selectedDays: DayKey[];
  hoursPerDay: number;
  hourlyRate: number;
  currency: CurrencyCode;
  secondaryCurrency: CurrencyCode;
  conversionRate: number;
  currencyConversionEnabled: boolean;
  taxPercent: number;
  extraDeduction: number;
  defaultHours: number;
  exceptions: Record<string, ExceptionType>;
  dailyHours: Record<string, number>;
  extraHours: Record<string, number>;
  /**
   * Clocked sessions per day. When a day has entries, its hours in
   * `dailyHours`/`extraHours` are derived from them, so files stay readable
   * by older versions that only know about hour totals.
   */
  timeEntries?: Record<string, TimeEntry[]>;
  /** Missing in older files, which were always paid by the hour. */
  salary?: SalarySettings;
}

/**
 * How clocked time turns into paid time. Applied when hours are calculated,
 * never baked into the stored sessions, so changing a rule re-applies it.
 */
export interface WorkRules {
  /** Unpaid break deducted on long days (0 = off). */
  breakMinutes: number;
  /** Deduct the break once a day reaches this many clocked hours. */
  breakAfterHours: number;
  /** Round each punch to the nearest N minutes (0 = exact). */
  roundingMinutes: number;
  /** Pay multiplier for overtime (1 = paid at the normal rate). */
  overtimeMultiplier: number;
  /** Also count hours beyond the schedule on workdays as overtime. */
  overtimeIncludesLongDays: boolean;
  /**
   * Today's target is what's left of the week's hours, shared over the
   * workdays still to come, rather than the fixed hours per day.
   */
  balanceWeek: boolean;
  /**
   * With the week balanced, hours over or under in earlier weeks come off
   * or go onto this week's hours.
   */
  carryBalance: boolean;
  /** Start the carried balance from zero every 1 January. */
  balanceResetsYearly: boolean;
  /** Most hours carried either way (0 = no limit). */
  balanceCapHours: number;
}

export interface TrackerSettings extends Partial<WorkRules> {
  payslipStartDay: number;
  /** Vacation allowance per leave year (0 = not tracked). */
  vacationDaysPerYear?: number;
  /** Month the leave year starts in, 1–12 (1 = calendar year). */
  leaveYearStartMonth?: number;
}

export interface DataFile {
  version: 1;
  savedAt: string;
  uiState: TrackerUiState;
  settings: TrackerSettings;
  savedMonths: string[];
  activityLog: ActivityLogEntry[];
  months: Record<string, TrackerData>;
}

export interface ActivityLogEntry {
  id: string;
  monthKey: string;
  timestamp: string;
  type: ActivityType;
  message: string;
}

export interface TrackerUiState {
  monthKey: string;
  graphYear: number;
}

export interface YearlyDataPoint {
  month: string;
  monthKey: string;
  actualHours: number;
}

export const ACTIVITY_LOG_KEY = "tracker-activity-log-v1";
export const SAVED_MONTHS_KEY = "tracker-saved-months-v1";
export const UI_STATE_KEY = "tracker-ui-state-v1";
export const SETTINGS_KEY = "tracker-settings-v1";
