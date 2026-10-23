import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { PayResult } from "./calculations";
import { CurrencyCode } from "./types";
import { formatDuration } from "./utils";

export function formatMoney(amount: number, currency: CurrencyCode) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
  }).format(amount);
}

interface HoursSummaryProps {
  periodLabel: string;
  workingDaysCount: number;
  vacationDays: number;
  sickDays: number;
  actualHours: number;
  estimatedHours: number;
  extraHoursTotal: number;
  /** Logged vs scheduled up to and including today; null outside the current period. */
  toDate: { logged: number; scheduled: number; daysElapsed: number } | null;
}

export function HoursSummary({
  periodLabel,
  workingDaysCount,
  vacationDays,
  sickDays,
  actualHours,
  estimatedHours,
  extraHoursTotal,
  toDate,
}: HoursSummaryProps) {
  const delta = actualHours - estimatedHours;
  // The bar spans whichever is larger; anything over schedule shows as extra.
  const barTotal = Math.max(actualHours, estimatedHours, 1);
  const scheduledShare = Math.min(actualHours, estimatedHours) / barTotal;
  const overShare = Math.max(0, actualHours - estimatedHours) / barTotal;

  return (
    <section aria-label="Hours this period" className="panel flex flex-col p-5">
      <div className="flex items-center justify-between">
        <span className="stamp">02 · Hours</span>
        <span className="font-mono text-[11px] text-muted-foreground">
          {periodLabel}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-mono text-[44px] font-semibold leading-none tracking-tight tabular">
          {formatDuration(actualHours)}
        </span>
        <span className="font-mono text-sm text-muted-foreground">
          of {formatDuration(estimatedHours)}
        </span>
        {Math.abs(delta) >= 1 / 60 ? (
          <span
            className={cn(
              "rounded-full px-2 py-0.5 font-mono text-[11px] font-medium",
              delta > 0
                ? "bg-primary/10 text-primary"
                : "bg-vacation/15 text-[hsl(32_90%_32%)] dark:text-vacation",
            )}
          >
            {delta > 0 ? "+" : "−"}
            {formatDuration(Math.abs(delta))}
          </span>
        ) : null}
      </div>

      <div className="mt-4 flex h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full bg-primary transition-[width] duration-700 ease-out"
          style={{ width: `${scheduledShare * 100}%` }}
        />
        {overShare > 0 ? (
          <div
            className="h-full border-l-2 border-card bg-extra transition-[width] duration-700 ease-out"
            style={{ width: `${overShare * 100}%` }}
          />
        ) : null}
      </div>

      {toDate ? (
        <p className="mt-3 flex flex-wrap items-baseline gap-x-1.5 font-mono text-xs text-muted-foreground">
          <span className="text-foreground">To date</span>
          <span className="tabular text-foreground">
            {formatDuration(toDate.logged)}
          </span>
          of {formatDuration(toDate.scheduled)} scheduled
          <span>· {toDate.daysElapsed} of {workingDaysCount} workdays in</span>
        </p>
      ) : null}

      <dl className="mt-auto grid grid-cols-4 gap-2 pt-5">
        <MiniStat label="Workdays" value={workingDaysCount} dot="bg-primary" />
        <MiniStat label="Vacation" value={vacationDays} dot="bg-vacation" />
        <MiniStat label="Sick" value={sickDays} dot="bg-sick" />
        <MiniStat
          label="Extra"
          value={formatDuration(extraHoursTotal)}
          dot="bg-extra"
        />
      </dl>
    </section>
  );
}

function MiniStat({
  label,
  value,
  dot,
}: {
  label: string;
  value: ReactNode;
  dot: string;
}) {
  return (
    <div className="rounded-lg border border-dashed px-2.5 py-2">
      <dt className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <span className={cn("h-1.5 w-1.5 rounded-full", dot)} />
        {label}
      </dt>
      <dd className="mt-0.5 font-mono text-base font-semibold tabular">
        {value}
      </dd>
    </div>
  );
}

interface PaySummaryProps {
  currency: CurrencyCode;
  secondaryCurrency: CurrencyCode;
  showConversion: boolean;
  conversionRate: number;
  taxPercent: number;
  overtimeMultiplier: number;
  pay: PayResult;
}

export function PaySummary({
  currency,
  secondaryCurrency,
  showConversion,
  conversionRate,
  taxPercent,
  overtimeMultiplier,
  pay,
}: PaySummaryProps) {
  /** An amount in the primary currency and, when converting, the secondary. */
  const amount = (value: number, sign = "") => ({
    value: `${sign}${formatMoney(value, currency)}`,
    converted: showConversion
      ? `${sign}${formatMoney(value * conversionRate, secondaryCurrency)}`
      : undefined,
  });

  return (
    <section aria-label="Estimated pay" className="panel flex flex-col p-5">
      <div className="flex items-center justify-between">
        <span className="stamp">03 · Payslip</span>
        <span className="font-mono text-[11px] text-muted-foreground">
          {formatMoney(pay.rate, currency)}/h
          {pay.salaried && pay.effectiveRate > 0 ? (
            <span
              title="Gross over the hours worked"
              className={cn(pay.effectiveRate < pay.rate - 0.005 && "text-extra")}
            >
              {" · "}
              {formatMoney(pay.effectiveRate, currency)}/h worked
            </span>
          ) : null}
          {!pay.salaried && pay.yearly > 0 ? (
            <span title="At the scheduled weekly hours, 52 weeks">
              {" · ≈"}
              {formatMoney(pay.yearly, currency)}/yr
            </span>
          ) : null}
        </span>
      </div>

      <dl className="mb-4 mt-4 space-y-1.5 font-mono text-[13px]">
        {showConversion ? (
          <div className="flex justify-end gap-3 text-[10.5px] uppercase tracking-wider text-muted-foreground/70">
            <span>{currency}</span>
            <span className={CONVERTED_COLUMN}>{secondaryCurrency}</span>
          </div>
        ) : null}
        {pay.salaried ? (
          <>
            <ReceiptLine label="Yearly" {...amount(pay.yearly)} muted />
            <ReceiptLine label="Salary ÷ 12" {...amount(pay.regularPay)} muted />
            {pay.overtimePay > 0 ? (
              <ReceiptLine
                label={`Overtime ${formatDuration(pay.overtimeHours)} ×${overtimeMultiplier}`}
                {...amount(pay.overtimePay, "+")}
                accent
              />
            ) : null}
            {pay.unpaidOvertimeHours > 0 ? (
              <ReceiptLine
                label={`Unpaid overtime ${formatDuration(pay.unpaidOvertimeHours)}`}
                {...amount(0)}
                muted
              />
            ) : null}
          </>
        ) : pay.overtimePay > 0 ? (
          <>
            <ReceiptLine
              label={`Regular ${formatDuration(pay.regularHours)}`}
              {...amount(pay.regularPay)}
              muted
            />
            <ReceiptLine
              label={`Overtime ${formatDuration(pay.overtimeHours)} ×${overtimeMultiplier}`}
              {...amount(pay.overtimePay, "+")}
              accent
            />
          </>
        ) : null}
        <ReceiptLine label="Gross" {...amount(pay.gross)} />
        <ReceiptLine label={`Tax ${taxPercent}%`} {...amount(pay.tax, "−")} muted />
        <ReceiptLine label="Deductions" {...amount(pay.deductions, "−")} muted />
      </dl>

      <div className="perforation mt-auto pt-0" aria-hidden />

      <div className="flex items-end justify-between gap-3">
        <span className="stamp mb-1.5">Net pay</span>
        <div className="text-right">
          <p className="font-mono text-[34px] font-semibold leading-none tracking-tight tabular">
            {formatMoney(pay.net, currency)}
          </p>
          {showConversion ? (
            <p className="mt-1.5 font-mono text-xs text-muted-foreground">
              ≈ {formatMoney(pay.net * conversionRate, secondaryCurrency)}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

const CONVERTED_COLUMN = "w-[6.5rem] shrink-0 text-right";

function ReceiptLine({
  label,
  value,
  converted,
  muted = false,
  accent = false,
}: {
  label: string;
  value: string;
  /** The same amount in the secondary currency. */
  converted?: string;
  muted?: boolean;
  accent?: boolean;
}) {
  return (
    <div className="flex items-baseline">
      <dt className="text-muted-foreground">{label}</dt>
      <span className="leader" aria-hidden />
      <dd
        className={cn(
          "tabular",
          muted && "text-muted-foreground",
          accent && "text-extra",
        )}
      >
        {value}
      </dd>
      {converted !== undefined ? (
        <dd
          className={cn(
            CONVERTED_COLUMN,
            "ml-3 text-[11.5px] tabular text-muted-foreground",
          )}
        >
          {converted}
        </dd>
      ) : null}
    </div>
  );
}
