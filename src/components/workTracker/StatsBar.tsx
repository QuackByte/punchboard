import { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { CurrencyCode, getCurrencySymbol } from "./types";
import { formatDuration } from "./utils";

interface StatsBarProps {
  workingDaysCount: number;
  vacationDays: number;
  sickDays: number;
  actualHours: number;
  estimatedHours: number;
  extraHoursTotal: number;
  currency: CurrencyCode;
  secondaryCurrency: CurrencyCode;
  grossSalary: number;
  taxAmount: number;
  extraDeductionAmount: number;
  netSalary: number;
  convertedGrossSalary: number;
  convertedNetSalary: number;
  convertedTaxAmount: number;
  convertedExtraDeductionAmount: number;
}

function StatCard({
  label,
  value,
  sub,
  accentClass,
  spanClass = "",
  emphasize = false,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  accentClass: string;
  spanClass?: string;
  emphasize?: boolean;
}) {
  return (
    <Card
      className={cn(
        "border-l-4 bg-card p-3 shadow-sm",
        emphasize && "bg-emerald-500/10 dark:bg-emerald-500/10",
        accentClass,
        spanClass,
      )}
    >
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 font-semibold text-foreground",
          emphasize ? "text-2xl" : "text-xl",
        )}
      >
        {value}
      </p>
      {sub}
    </Card>
  );
}

export default function StatsBar({
  workingDaysCount,
  vacationDays,
  sickDays,
  actualHours,
  estimatedHours,
  extraHoursTotal,
  currency,
  secondaryCurrency,
  grossSalary,
  taxAmount,
  extraDeductionAmount,
  netSalary,
  convertedGrossSalary,
  convertedNetSalary,
  convertedTaxAmount,
  convertedExtraDeductionAmount,
}: StatsBarProps) {
  const symbol = getCurrencySymbol(currency);
  const secondarySymbol = getCurrencySymbol(secondaryCurrency);
  const showConversion = currency !== secondaryCurrency;

  return (
    <div className="mb-4 space-y-4">
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Hours
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-12">
          <StatCard
            label="Working days"
            value={workingDaysCount}
            accentClass="border-l-slate-300 dark:border-l-slate-600"
            spanClass="lg:col-span-2"
          />
          <StatCard
            label="Vacation"
            value={vacationDays}
            accentClass="border-l-amber-400 dark:border-l-amber-500"
            spanClass="lg:col-span-2"
          />
          <StatCard
            label="Sick"
            value={sickDays}
            accentClass="border-l-rose-400 dark:border-l-rose-500"
            spanClass="lg:col-span-2"
          />
          <StatCard
            label="Actual hours"
            value={formatDuration(actualHours)}
            accentClass="border-l-slate-300 dark:border-l-slate-600"
            spanClass="lg:col-span-2"
          />
          <StatCard
            label="Estimated hours"
            value={formatDuration(estimatedHours)}
            accentClass="border-l-slate-300 dark:border-l-slate-600"
            spanClass="lg:col-span-2"
          />
          <StatCard
            label="Extra hours"
            value={formatDuration(extraHoursTotal)}
            accentClass="border-l-indigo-400 dark:border-l-indigo-500"
            spanClass="lg:col-span-2"
          />
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Pay
        </p>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-12">
          <StatCard
            label="Gross pay"
            value={`${symbol}${grossSalary.toFixed(2)}`}
            accentClass="border-l-cyan-400 dark:border-l-cyan-500"
            spanClass="lg:col-span-3"
            sub={
              showConversion ? (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  ≈ {secondarySymbol}
                  {convertedGrossSalary.toFixed(2)}
                </p>
              ) : undefined
            }
          />
          <StatCard
            label="Tax amount"
            value={`${symbol}${taxAmount.toFixed(2)}`}
            accentClass="border-l-orange-400 dark:border-l-orange-500"
            spanClass="lg:col-span-3"
            sub={
              showConversion ? (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  ≈ {secondarySymbol}
                  {convertedTaxAmount.toFixed(2)}
                </p>
              ) : undefined
            }
          />
          <StatCard
            label="Deductions"
            value={`${symbol}${extraDeductionAmount.toFixed(2)}`}
            accentClass="border-l-rose-400 dark:border-l-rose-500"
            spanClass="lg:col-span-3"
            sub={
              showConversion ? (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  ≈ {secondarySymbol}
                  {convertedExtraDeductionAmount.toFixed(2)}
                </p>
              ) : undefined
            }
          />
          <StatCard
            label="Net pay"
            value={`${symbol}${netSalary.toFixed(2)}`}
            accentClass="border-l-emerald-400 dark:border-l-emerald-500"
            spanClass="lg:col-span-3"
            emphasize
            sub={
              showConversion ? (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  ≈ {secondarySymbol}
                  {convertedNetSalary.toFixed(2)}
                </p>
              ) : undefined
            }
          />
        </div>
      </div>
    </div>
  );
}
