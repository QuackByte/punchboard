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
  "Sun",
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
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

export type DayKey = (typeof daysOfWeek)[number]["key"];
export type ExceptionType = "vacation" | "sick";
export type MarkMode = ExceptionType | "none";
export type ActivityType =
  | "month-change"
  | "weekday-toggle"
  | "exception-change"
  | "value-change"
  | "hours-change";

export interface TrackerData {
  selectedDays: DayKey[];
  hoursPerDay: number;
  hourlyRate: number;
  taxPercent: number;
  extraDeduction: number;
  payslipStartDay: number;
  payslipEndDay: number;
  defaultHours: number;
  exceptions: Record<string, ExceptionType>;
  dailyHours: Record<string, number>;
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
export const HOLIDAY_DEFAULT_HOURS = 9;
