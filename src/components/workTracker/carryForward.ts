import { DEFAULT_SALARY, normalizeSalary } from "./calculations";
import { SalarySettings, TrackerData } from "./types";
import { clampPercent } from "./utils";

/** The pay settings that carry forward from month to month. */
export type CarriedPayField =
  | "hourlyRate"
  | "taxPercent"
  | "extraDeduction"
  | "defaultHours"
  | "conversionRate"
  | "currency"
  | "secondaryCurrency"
  | "currencyConversionEnabled"
  | "salary";

export type CarriedPay = Pick<TrackerData, Exclude<CarriedPayField, "salary">> & {
  salary: SalarySettings;
};

export const DEFAULT_PAY: CarriedPay = {
  hourlyRate: 15,
  taxPercent: 0,
  extraDeduction: 0,
  defaultHours: 8,
  currency: "GBP",
  secondaryCurrency: "EUR",
  conversionRate: 1,
  currencyConversionEnabled: false,
  salary: DEFAULT_SALARY,
};

/** What a new month takes from an earlier one, or null if it can't be read. */
export function carryForwardPay(data: Partial<TrackerData>): CarriedPay | null {
  if (
    typeof data.hourlyRate !== "number" ||
    typeof data.taxPercent !== "number"
  ) {
    return null;
  }
  const amount = (value: unknown, fallback: number) =>
    typeof value === "number" ? Math.max(0, value) : fallback;

  return {
    hourlyRate: Math.max(0, data.hourlyRate),
    taxPercent: clampPercent(data.taxPercent),
    extraDeduction: amount(data.extraDeduction, DEFAULT_PAY.extraDeduction),
    defaultHours: amount(data.defaultHours, DEFAULT_PAY.defaultHours),
    currency: data.currency ?? DEFAULT_PAY.currency,
    secondaryCurrency: data.secondaryCurrency ?? DEFAULT_PAY.secondaryCurrency,
    conversionRate: amount(data.conversionRate, DEFAULT_PAY.conversionRate),
    currencyConversionEnabled:
      data.currencyConversionEnabled ?? DEFAULT_PAY.currencyConversionEnabled,
    salary: normalizeSalary(data.salary),
  };
}
