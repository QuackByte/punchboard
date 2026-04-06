interface StatsBarProps {
  workingDaysCount: number;
  vacationDays: number;
  sickDays: number;
  actualHours: number;
  estimatedHours: number;
  grossSalary: number;
  taxAmount: number;
  extraDeductionAmount: number;
  netSalary: number;
}

export default function StatsBar({
  workingDaysCount,
  vacationDays,
  sickDays,
  actualHours,
  estimatedHours,
  grossSalary,
  taxAmount,
  extraDeductionAmount,
  netSalary,
}: StatsBarProps) {
  return (
    <div className="mb-4 flex flex-wrap justify-center gap-3">
      <div className="w-full min-w-[170px] flex-1 rounded-lg border border-slate-200 bg-white/70 p-3 dark:border-slate-700 dark:bg-slate-950/70 sm:max-w-[220px]">
        <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Working days
        </p>
        <p className="mt-1 text-xl font-semibold text-slate-900 dark:text-white">
          {workingDaysCount}
        </p>
      </div>
      <div className="w-full min-w-[170px] flex-1 rounded-lg border border-amber-400/60 bg-amber-50 p-3 dark:border-amber-500/40 dark:bg-amber-500/10 sm:max-w-[220px]">
        <p className="text-xs uppercase tracking-wide text-amber-700 dark:text-amber-200">
          Vacation
        </p>
        <p className="mt-1 text-xl font-semibold text-amber-800 dark:text-amber-100">
          {vacationDays}
        </p>
      </div>
      <div className="w-full min-w-[170px] flex-1 rounded-lg border border-rose-400/60 bg-rose-50 p-3 dark:border-rose-500/40 dark:bg-rose-500/10 sm:max-w-[220px]">
        <p className="text-xs uppercase tracking-wide text-rose-700 dark:text-rose-200">
          Sick
        </p>
        <p className="mt-1 text-xl font-semibold text-rose-800 dark:text-rose-100">
          {sickDays}
        </p>
      </div>
      <div className="w-full min-w-[170px] flex-1 rounded-lg border border-slate-200 bg-white/70 p-3 dark:border-slate-700 dark:bg-slate-950/70 sm:max-w-[220px]">
        <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Actual hours
        </p>
        <p className="mt-1 text-xl font-semibold text-slate-900 dark:text-white">
          {actualHours}
        </p>
      </div>
      <div className="w-full min-w-[170px] flex-1 rounded-lg border border-slate-200 bg-white/70 p-3 dark:border-slate-700 dark:bg-slate-950/70 sm:max-w-[220px]">
        <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Estimated hours
        </p>
        <p className="mt-1 text-xl font-semibold text-slate-900 dark:text-white">
          {estimatedHours}
        </p>
      </div>
      <div className="w-full min-w-[170px] flex-1 rounded-lg border border-cyan-400/60 bg-cyan-50 p-3 dark:border-cyan-500/50 dark:bg-cyan-500/10 sm:max-w-[220px]">
        <p className="text-xs uppercase tracking-wide text-cyan-700 dark:text-cyan-200">
          Gross pay
        </p>
        <p className="mt-1 text-xl font-semibold text-cyan-800 dark:text-cyan-100">
          {grossSalary.toFixed(2)}
        </p>
      </div>
      <div className="w-full min-w-[170px] flex-1 rounded-lg border border-orange-400/60 bg-orange-50 p-3 dark:border-orange-500/40 dark:bg-orange-500/10 sm:max-w-[220px]">
        <p className="text-xs uppercase tracking-wide text-orange-700 dark:text-orange-200">
          Tax amount
        </p>
        <p className="mt-1 text-xl font-semibold text-orange-800 dark:text-orange-100">
          {taxAmount.toFixed(2)}
        </p>
      </div>
      <div className="w-full min-w-[170px] flex-1 rounded-lg border border-violet-400/60 bg-violet-50 p-3 dark:border-violet-500/40 dark:bg-violet-500/10 sm:max-w-[220px]">
        <p className="text-xs uppercase tracking-wide text-violet-700 dark:text-violet-200">
          Deductions
        </p>
        <p className="mt-1 text-xl font-semibold text-violet-800 dark:text-violet-100">
          {extraDeductionAmount.toFixed(2)}
        </p>
      </div>
      <div className="w-full min-w-[170px] flex-1 rounded-lg border border-emerald-400/60 bg-emerald-50 p-3 dark:border-emerald-500/40 dark:bg-emerald-500/10 sm:max-w-[220px]">
        <p className="text-xs uppercase tracking-wide text-emerald-700 dark:text-emerald-200">
          Net pay
        </p>
        <p className="mt-1 text-xl font-semibold text-emerald-800 dark:text-emerald-100">
          {netSalary.toFixed(2)}
        </p>
      </div>
    </div>
  );
}
