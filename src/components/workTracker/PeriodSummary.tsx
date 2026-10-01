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
  hourlyRate: number;
  taxPercent: number;
  overtimeMultiplier: number;
  pay: PayResult;
  grossSalary: number;
  taxAmount: number;
  extraDeductionAmount: number;
  netSalary: number;
  convertedNetSalary: number;
}

export function PaySummary({
  currency,
  secondaryCurrency,
  showConversion,
  hourlyRate,
  taxPercent,
  overtimeMultiplier,
  pay,
  grossSalary,
  taxAmount,
  extraDeductionAmount,
  netSalary,
  convertedNetSalary,
}: PaySummaryProps) {
  return (
    <section aria-label="Estimated pay" className="panel flex flex-col p-5">
      <div className="flex items-center justify-between">
        <span className="stamp">03 · Payslip</span>
        <span className="font-mono text-[11px] text-muted-foreground">
          {formatMoney(hourlyRate, currency)}/h
        </span>
      </div>

      <dl className="mb-4 mt-4 space-y-1.5 font-mono text-[13px]">
        {pay.overtimePay > 0 ? (
          <>
            <ReceiptLine
              label={`Regular ${formatDuration(pay.regularHours)}`}
              value={formatMoney(pay.regularPay, currency)}
              muted
            />
            <ReceiptLine
              label={`Overtime ${formatDuration(pay.overtimeHours)} ×${overtimeMultiplier}`}
              value={`+${formatMoney(pay.overtimePay, currency)}`}
              accent
            />
          </>
        ) : null}
        <ReceiptLine label="Gross" value={formatMoney(grossSalary, currency)} />
        <ReceiptLine
          label={`Tax ${taxPercent}%`}
          value={`−${formatMoney(taxAmount, currency)}`}
          muted
        />
        <ReceiptLine
          label="Deductions"
          value={`−${formatMoney(extraDeductionAmount, currency)}`}
          muted
        />
      </dl>

      <div className="perforation mt-auto pt-0" aria-hidden />

      <div className="flex items-end justify-between gap-3">
        <span className="stamp mb-1.5">Net pay</span>
        <div className="text-right">
          <p className="font-mono text-[34px] font-semibold leading-none tracking-tight tabular">
            {formatMoney(netSalary, currency)}
          </p>
          {showConversion ? (
            <p className="mt-1.5 font-mono text-xs text-muted-foreground">
              ≈ {formatMoney(convertedNetSalary, secondaryCurrency)}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function ReceiptLine({
  label,
  value,
  muted = false,
  accent = false,
}: {
  label: string;
  value: string;
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
    </div>
  );
}
