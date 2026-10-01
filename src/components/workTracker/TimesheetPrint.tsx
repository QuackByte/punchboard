import { PayResult, PeriodResult } from "./calculations";
import { formatMoney } from "./PeriodSummary";
import { CurrencyCode } from "./types";
import { formatDuration } from "./utils";
import { isoDate, TimesheetMeta, TimesheetRow } from "./timesheet";

/**
 * The printable timesheet. Only rendered while printing; the rest of the
 * app is hidden with `print:hidden`, so "Save as PDF" gives a clean sheet.
 */
export default function TimesheetPrint({
  rows,
  period,
  pay,
  meta,
}: {
  rows: TimesheetRow[];
  period: PeriodResult;
  pay: PayResult;
  meta: TimesheetMeta;
}) {
  const money = (amount: number) =>
    formatMoney(amount, meta.currency as CurrencyCode);
  const hours = (value: number) => (value > 0 ? formatDuration(value) : "");

  return (
    <div className="timesheet hidden bg-white font-sans text-[10pt] text-neutral-900 print:block">
      <header className="flex items-end justify-between border-b-2 border-neutral-900 pb-2">
        <div>
          <p className="font-mono text-[8pt] uppercase tracking-[0.2em] text-neutral-500">
            Timesheet
          </p>
          <h1 className="text-[18pt] font-bold leading-tight">{meta.title}</h1>
          <p className="font-mono text-[9pt] text-neutral-600">{meta.periodLabel}</p>
        </div>
        <div className="flex items-center gap-2 text-right">
          <div>
            <p className="text-[11pt] font-semibold">Punchboard</p>
            <p className="font-mono text-[8pt] text-neutral-500">
              Generated {new Date().toLocaleString("en-GB", {
                day: "numeric",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
          <img src="./punchboard_icon.svg" alt="" className="h-9 w-9 rounded-lg" />
        </div>
      </header>

      <table className="mt-3 w-full border-collapse text-[8.5pt]">
        <thead>
          <tr className="border-b border-neutral-400 text-left font-mono text-[7.5pt] uppercase tracking-wider text-neutral-500">
            <th className="py-1 pr-2 font-medium">Date</th>
            <th className="py-1 pr-2 font-medium">Status</th>
            <th className="py-1 pr-2 font-medium">Sessions</th>
            <th className="py-1 pr-2 font-medium">Notes</th>
            <th className="py-1 pr-2 text-right font-medium">Break</th>
            <th className="py-1 pr-2 text-right font-medium">Hours</th>
            <th className="py-1 text-right font-medium">Overtime</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const quiet = row.status === "Day off" && row.hours === 0;
            return (
              <tr
                key={row.key}
                className={`break-inside-avoid border-b border-neutral-200 ${quiet ? "text-neutral-400" : ""}`}
              >
                <td className="whitespace-nowrap py-[1.5px] pr-2 font-mono">
                  {row.date.toLocaleDateString("en-GB", { weekday: "short" })}{" "}
                  {isoDate(row.date)}
                </td>
                <td className="py-[1.5px] pr-2">{quiet ? "" : row.status}</td>
                <td className="py-[1.5px] pr-2 font-mono">
                  {row.sessions || (row.assumed ? <span className="text-neutral-400">scheduled</span> : "")}
                </td>
                <td className="py-[1.5px] pr-2 text-neutral-600">{row.notes}</td>
                <td className="py-[1.5px] pr-2 text-right font-mono">
                  {row.breakMinutes > 0 ? `${row.breakMinutes}m` : ""}
                </td>
                <td className="py-[1.5px] pr-2 text-right font-mono font-semibold">
                  {hours(row.hours)}
                </td>
                <td className="py-[1.5px] text-right font-mono">{hours(row.overtimeHours)}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-neutral-900 font-mono font-semibold">
            <td className="py-1.5" colSpan={4}>
              Total
            </td>
            <td className="py-1.5 pr-2 text-right">
              {period.breakMinutesTotal > 0 ? formatDuration(period.breakMinutesTotal / 60) : ""}
            </td>
            <td className="py-1.5 pr-2 text-right">{formatDuration(period.actualHours)}</td>
            <td className="py-1.5 text-right">{hours(period.overtimeHours)}</td>
          </tr>
        </tfoot>
      </table>

      <section className="mt-4 grid break-inside-avoid grid-cols-2 gap-8">
        <dl className="space-y-0.5 text-[9pt]">
          <SummaryLine label="Scheduled" value={formatDuration(period.estimatedHours)} />
          <SummaryLine label="Worked" value={formatDuration(period.actualHours)} />
          <SummaryLine label="Workdays" value={String(period.workingDaysCount)} />
          <SummaryLine label="Vacation days" value={String(period.vacationDays)} />
          <SummaryLine label="Sick days" value={String(period.sickDays)} />
          <SummaryLine label="Days-off hours" value={formatDuration(period.extraHoursTotal)} />
        </dl>
        <dl className="space-y-0.5 text-[9pt]">
          <SummaryLine label="Rate" value={`${money(meta.hourlyRate)}/h`} />
          {pay.overtimePay > 0 ? (
            <>
              <SummaryLine
                label={`Regular ${formatDuration(pay.regularHours)}`}
                value={money(pay.regularPay)}
              />
              <SummaryLine
                label={`Overtime ${formatDuration(pay.overtimeHours)} ×${meta.overtimeMultiplier}`}
                value={money(pay.overtimePay)}
              />
            </>
          ) : null}
          <SummaryLine label="Gross" value={money(pay.gross)} />
          <SummaryLine label={`Tax ${meta.taxPercent}%`} value={`−${money(pay.tax)}`} />
          <SummaryLine label="Deductions" value={`−${money(pay.deductions)}`} />
          <div className="flex items-baseline justify-between border-t-2 border-neutral-900 pt-1 text-[11pt] font-bold">
            <dt>Net pay</dt>
            <dd className="font-mono">{money(pay.net)}</dd>
          </div>
        </dl>
      </section>

      <footer className="mt-7 grid break-inside-avoid grid-cols-2 gap-8 text-[8.5pt] text-neutral-500">
        <p className="border-t border-neutral-400 pt-1">Employee signature</p>
        <p className="border-t border-neutral-400 pt-1">Approved by</p>
      </footer>
    </div>
  );
}

function SummaryLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-dotted border-neutral-300 pb-0.5">
      <dt className="text-neutral-600">{label}</dt>
      <dd className="font-mono">{value}</dd>
    </div>
  );
}
