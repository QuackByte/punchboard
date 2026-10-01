import { ArrowRight, CalendarClock, LogIn, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { TimeEntry } from "./types";
import { useNow } from "./useNow";
import {
  entryMinutes,
  formatDuration,
  keyToDate,
  minutesSinceMidnight,
  sumEntriesHours,
} from "./utils";

interface PunchClockProps {
  todayKey: string;
  todayEntries: TimeEntry[];
  /** Scheduled hours for today (0 when today isn't a workday). */
  targetHours: number;
  openSession: { key: string; entry: TimeEntry } | null;
  isViewingCurrentPeriod: boolean;
  onPunchIn: () => void;
  onPunchOut: () => void;
  onGoToCurrentPeriod: () => void;
  onEditDay: (key: string) => void;
}

export default function PunchClock({
  todayKey,
  todayEntries,
  targetHours,
  openSession,
  isViewingCurrentPeriod,
  onPunchIn,
  onPunchOut,
  onGoToCurrentPeriod,
  onEditDay,
}: PunchClockProps) {
  const now = useNow(1000);
  const nowMinutes = minutesSinceMidnight(now);
  const isRunning = openSession?.key === todayKey;
  const isStale = !!openSession && openSession.key !== todayKey;

  const todayHours = isViewingCurrentPeriod
    ? sumEntriesHours(todayEntries, nowMinutes)
    : 0;
  const runningMinutes =
    isRunning && openSession ? entryMinutes(openSession.entry, nowMinutes) : 0;
  const progress =
    targetHours > 0 ? Math.min(1, todayHours / targetHours) : todayHours > 0 ? 1 : 0;

  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");

  return (
    <section
      aria-label="Punch clock"
      className="relative flex flex-col overflow-hidden rounded-2xl border border-ink-border bg-ink p-5 text-ink-foreground shadow-[0_20px_50px_-24px_hsl(var(--ink)/0.8)]"
    >
      {/* Brand glow behind the digits */}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full blur-3xl transition-colors duration-700",
          isRunning ? "bg-signal/25" : "bg-brand/20",
        )}
      />

      <div className="relative flex items-center justify-between">
        <span className="font-mono text-[10.5px] font-medium uppercase tracking-[0.14em] text-ink-muted">
          01 · Punch clock
        </span>
        <span className="font-mono text-[11px] text-ink-muted">
          {now.toLocaleDateString("en-GB", {
            weekday: "short",
            day: "numeric",
            month: "short",
          })}
        </span>
      </div>

      <div className="relative mt-4 flex items-baseline font-mono tabular leading-none">
        <span className="text-[56px] font-semibold tracking-tight">
          {hh}
          <span
            className={cn(
              "mx-0.5",
              isRunning ? "text-signal" : "text-brand",
              now.getSeconds() % 2 === 0 ? "opacity-100" : "opacity-40",
            )}
          >
            :
          </span>
          {mm}
        </span>
        <span className="ml-2 text-xl text-ink-muted">{ss}</span>
      </div>

      <p className="relative mt-3 flex min-h-5 items-center gap-2 text-sm">
        {isRunning && openSession ? (
          <>
            <span className="h-2 w-2 animate-punch-pulse rounded-full bg-signal" />
            <span>
              On the clock since{" "}
              <span className="font-mono">{openSession.entry.start}</span>
              <span className="text-ink-muted">
                {" "}
                · {formatDuration(runningMinutes / 60)}
              </span>
            </span>
          </>
        ) : isStale && openSession ? (
          <>
            <span className="h-2 w-2 rounded-full bg-vacation" />
            <span>
              Session left open on{" "}
              {keyToDate(openSession.key).toLocaleDateString("en-GB", {
                weekday: "short",
                day: "numeric",
                month: "short",
              })}
            </span>
          </>
        ) : (
          <>
            <span className="h-2 w-2 rounded-full bg-ink-muted/50" />
            <span className="text-ink-muted">
              {isViewingCurrentPeriod
                ? todayEntries.length > 0
                  ? "Off the clock"
                  : "Not punched in yet today"
                : "Viewing another period"}
            </span>
          </>
        )}
      </p>

      {/* Today's progress against the scheduled hours */}
      <div className="relative mt-5">
        <div className="flex items-baseline justify-between font-mono text-xs">
          <span className="text-ink-muted">Today</span>
          <span className="tabular">
            {formatDuration(todayHours)}
            {targetHours > 0 ? (
              <span className="text-ink-muted">
                {" "}
                / {formatDuration(targetHours)}
              </span>
            ) : null}
          </span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink-foreground/10">
          <div
            className={cn(
              "h-full rounded-full transition-[width] duration-700 ease-out",
              isRunning ? "bg-signal" : "bg-brand",
            )}
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      </div>

      {todayEntries.length > 0 && isViewingCurrentPeriod ? (
        <ul className="relative mt-4 flex flex-wrap gap-1.5">
          {todayEntries.map((entry, index) => (
            <li
              key={`${entry.start}-${index}`}
              className="flex items-center gap-1 rounded-md border border-ink-border bg-ink-foreground/[0.04] px-2 py-1 font-mono text-[11px]"
            >
              {entry.start}
              <ArrowRight className="h-3 w-3 text-ink-muted" />
              {entry.end ?? <span className="text-signal">now</span>}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="relative mt-auto pt-5">
        {!isViewingCurrentPeriod ? (
          <PunchButton tone="neutral" onClick={onGoToCurrentPeriod}>
            <CalendarClock /> Jump to today
          </PunchButton>
        ) : isStale && openSession ? (
          <PunchButton tone="neutral" onClick={() => onEditDay(openSession.key)}>
            <CalendarClock /> Set an end time
          </PunchButton>
        ) : isRunning ? (
          <PunchButton tone="signal" onClick={onPunchOut}>
            <LogOut /> Punch out
          </PunchButton>
        ) : (
          <PunchButton tone="brand" onClick={onPunchIn}>
            <LogIn /> Punch in
          </PunchButton>
        )}
      </div>
    </section>
  );
}

function PunchButton({
  tone,
  onClick,
  children,
}: {
  tone: "brand" | "signal" | "neutral";
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group flex h-12 w-full items-center justify-center gap-2 rounded-xl text-[15px] font-semibold transition-all duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-ink [&_svg]:h-4 [&_svg]:w-4 [&_svg]:transition-transform group-hover:[&_svg]:translate-x-0.5",
        tone === "brand" &&
          "bg-brand text-[hsl(195_80%_9%)] shadow-[0_0_0_1px_hsl(var(--brand)/0.5),0_10px_30px_-10px_hsl(var(--brand)/0.7)] hover:brightness-110",
        tone === "signal" &&
          "bg-signal text-[hsl(18_80%_10%)] shadow-[0_0_0_1px_hsl(var(--signal)/0.5),0_10px_30px_-10px_hsl(var(--signal)/0.7)] hover:brightness-110",
        tone === "neutral" &&
          "border border-ink-border bg-ink-foreground/[0.06] text-ink-foreground hover:bg-ink-foreground/10",
      )}
    >
      {children}
    </button>
  );
}
