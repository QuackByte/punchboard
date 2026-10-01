import { ArrowRight, Plus, RotateCcw, StickyNote, X } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { ExceptionType, TimeEntry } from "./types";
import {
  entryMinutes,
  formatClock,
  formatDuration,
  parseClock,
  parseDayInput,
  sumEntriesHours,
} from "./utils";

interface DayEditorProps {
  date: Date;
  isWorkingDay: boolean;
  isToday: boolean;
  exceptionType?: ExceptionType;
  entries: TimeEntry[];
  totalHours: number;
  /** Automatic break deducted from totalHours. */
  breakMinutes: number;
  hasOverride: boolean;
  hoursPerDay: number;
  nowMinutes: number;
  onApplyText: (text: string) => boolean;
  onSetEntries: (entries: TimeEntry[]) => void;
  onRemoveEntry: (index: number) => void;
  onReset: () => void;
  onSetException: (type: ExceptionType | "none") => void;
}

export default function DayEditor({
  date,
  isWorkingDay,
  isToday,
  exceptionType,
  entries,
  totalHours,
  breakMinutes,
  hasOverride,
  hoursPerDay,
  nowMinutes,
  onApplyText,
  onSetEntries,
  onRemoveEntry,
  onReset,
  onSetException,
}: DayEditorProps) {
  const [text, setText] = useState("");
  const [isInvalid, setIsInvalid] = useState(false);

  const preview = text.trim() ? parseDayInput(text) : null;
  const previewLabel = !text.trim()
    ? null
    : preview === null
      ? "Couldn't read that — try 9-17:30 or 7.5"
      : preview.kind === "sessions"
        ? `${preview.entries.length} session${preview.entries.length === 1 ? "" : "s"} · ${formatDuration(sumEntriesHours(preview.entries))}`
        : `${formatDuration(preview.hours)} total`;

  const submit = () => {
    if (!text.trim()) {
      return;
    }
    if (onApplyText(text)) {
      setText("");
      setIsInvalid(false);
    } else {
      setIsInvalid(true);
    }
  };

  const updateEntry = (index: number, patch: Partial<TimeEntry>) => {
    onSetEntries(
      entries.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)),
    );
  };

  const addSession = () => {
    const last = entries[entries.length - 1];
    const lastEnd = last?.end ? parseClock(last.end) : null;
    const start =
      lastEnd !== null
        ? Math.min(lastEnd + 60, 23 * 60)
        : isToday && entries.length === 0
          ? nowMinutes
          : 9 * 60;
    const length =
      entries.length === 0 ? Math.max(1, hoursPerDay) * 60 : 4 * 60;
    const end = Math.min(start + length, 23 * 60 + 59);
    onSetEntries([
      ...entries,
      { start: formatClock(start), end: formatClock(end) },
    ]);
  };

  const statusLabel = exceptionType
    ? exceptionType === "vacation"
      ? "Vacation"
      : "Sick"
    : isWorkingDay
      ? "Workday"
      : "Day off";

  return (
    <div className="space-y-4">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-lg font-semibold leading-tight">
            {date.toLocaleDateString("en-GB", { weekday: "long" })}
          </p>
          <p className="font-mono text-xs text-muted-foreground">
            {date.toLocaleDateString("en-GB", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>
        <span
          className={cn(
            "rounded-full border px-2 py-0.5 font-mono text-[10.5px] uppercase tracking-wider",
            exceptionType === "vacation" &&
              "border-vacation/40 bg-vacation/15 text-[hsl(32_90%_30%)] dark:text-vacation",
            exceptionType === "sick" &&
              "border-sick/40 bg-sick/15 text-[hsl(350_70%_40%)] dark:text-sick",
            !exceptionType &&
              isWorkingDay &&
              "border-primary/30 bg-primary/10 text-primary",
            !exceptionType && !isWorkingDay && "text-muted-foreground",
          )}
        >
          {statusLabel}
        </span>
      </header>

      {exceptionType === "sick" ? null : (
        <>
          <div>
            <label htmlFor="day-quick-entry" className="stamp">
              Quick entry
            </label>
            <div
              className={cn(
                "mt-1.5 flex items-center rounded-lg border bg-background/60 pr-1 transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20",
                isInvalid && "border-destructive focus-within:border-destructive",
              )}
            >
              <input
                id="day-quick-entry"
                autoFocus
                autoComplete="off"
                spellCheck={false}
                value={text}
                placeholder="9-13, 14-18:30  or  7.5"
                className="h-9 min-w-0 flex-1 bg-transparent px-3 font-mono text-sm outline-none placeholder:text-muted-foreground/60"
                onChange={(event) => {
                  setText(event.target.value);
                  setIsInvalid(false);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    submit();
                  }
                }}
              />
              <button
                type="button"
                onClick={submit}
                disabled={!preview}
                aria-label="Apply quick entry"
                className="grid h-7 w-7 place-items-center rounded-md bg-primary text-primary-foreground transition-opacity disabled:opacity-25"
              >
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
            <p
              className={cn(
                "mt-1 h-4 font-mono text-[11px]",
                preview === null && text.trim()
                  ? "text-destructive"
                  : "text-muted-foreground",
              )}
            >
              {previewLabel ? `→ ${previewLabel}` : "Enter to save · replaces this day"}
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <span className="stamp">Sessions</span>
              <span className="font-mono text-xs tabular">
                {formatDuration(totalHours)}
                {breakMinutes > 0 ? (
                  <span className="text-muted-foreground">
                    {" "}
                    · −{formatDuration(breakMinutes / 60)} break
                  </span>
                ) : null}
                {!hasOverride && isWorkingDay && !exceptionType ? (
                  <span className="text-muted-foreground"> · scheduled</span>
                ) : null}
              </span>
            </div>

            {entries.length > 0 ? (
              <ul className="mt-2 space-y-1.5">
                {entries.map((entry, index) => (
                  <li
                    key={index}
                    className="group rounded-lg border bg-background/60 px-2 py-1"
                  >
                    <div className="flex items-center gap-1.5">
                    <TimeField
                      label="Start"
                      value={entry.start}
                      onChange={(value) =>
                        value && updateEntry(index, { start: value })
                      }
                    />
                    <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                    {entry.end === null && isToday ? (
                      <span className="flex h-7 w-[4.5rem] items-center gap-1.5 font-mono text-sm text-signal">
                        <span className="h-1.5 w-1.5 animate-punch-pulse rounded-full bg-signal" />
                        now
                      </span>
                    ) : (
                      <TimeField
                        label="End"
                        value={entry.end ?? ""}
                        invalid={entry.end === null}
                        onChange={(value) =>
                          updateEntry(index, { end: value || null })
                        }
                      />
                    )}
                    <span className="ml-auto font-mono text-[11px] text-muted-foreground tabular">
                      {formatDuration(
                        entryMinutes(entry, isToday ? nowMinutes : undefined) / 60,
                      )}
                    </span>
                    <button
                      type="button"
                      aria-label="Remove session"
                      onClick={() => onRemoveEntry(index)}
                      className="grid h-6 w-6 place-items-center rounded-md text-muted-foreground opacity-60 transition hover:bg-destructive/10 hover:text-destructive hover:opacity-100"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                    </div>
                    <NoteField
                      value={entry.note ?? ""}
                      onCommit={(note) =>
                        updateEntry(index, { note: note || undefined })
                      }
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">
                No clocked sessions
                {isWorkingDay && !exceptionType
                  ? hasOverride
                    ? " — a total is set manually."
                    : ` — counting the scheduled ${formatDuration(hoursPerDay)}.`
                  : "."}
              </p>
            )}

            <div className="mt-2 flex items-center gap-1">
              <button
                type="button"
                onClick={addSession}
                className="flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
              >
                <Plus className="h-3.5 w-3.5" /> Add session
              </button>
              {hasOverride ? (
                <button
                  type="button"
                  onClick={onReset}
                  className="ml-auto flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <RotateCcw className="h-3 w-3" />
                  {isWorkingDay ? "Reset to schedule" : "Clear"}
                </button>
              ) : null}
            </div>
          </div>
        </>
      )}

      {isWorkingDay ? (
        <div className="border-t pt-3">
          <span className="stamp">Mark day</span>
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            <MarkButton
              active={exceptionType === "vacation"}
              tone="vacation"
              onClick={() => onSetException("vacation")}
            >
              Vacation
            </MarkButton>
            <MarkButton
              active={exceptionType === "sick"}
              tone="sick"
              onClick={() => onSetException("sick")}
            >
              Sick
            </MarkButton>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * A per-session note, saved on blur/Enter so typing doesn't write the data
 * file on every keystroke.
 */
function NoteField({
  value,
  onCommit,
}: {
  value: string;
  onCommit: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);

  const commit = () => {
    const next = draft.trim();
    if (next !== value) {
      onCommit(next);
    }
  };

  return (
    <div className="flex items-center gap-1.5 pl-1">
      <StickyNote className="h-3 w-3 shrink-0 text-muted-foreground/60" />
      <input
        aria-label="Session note"
        value={draft}
        maxLength={120}
        placeholder="Add a note"
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commit();
            event.currentTarget.blur();
          }
        }}
        className="h-6 min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground/50"
      />
    </div>
  );
}

function TimeField({
  label,
  value,
  invalid = false,
  onChange,
}: {
  label: string;
  value: string;
  invalid?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <input
      type="time"
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={cn(
        "h-7 w-[4.5rem] rounded-md bg-transparent px-1 font-mono text-sm tabular outline-none transition-colors hover:bg-muted focus:bg-muted focus:ring-1 focus:ring-primary",
        invalid && "ring-1 ring-vacation",
      )}
    />
  );
}

function MarkButton({
  active,
  tone,
  onClick,
  children,
}: {
  active: boolean;
  tone: "vacation" | "sick";
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex h-8 items-center justify-center gap-1.5 rounded-lg border text-xs font-medium transition-colors",
        tone === "vacation"
          ? active
            ? "border-vacation bg-vacation/20 text-[hsl(32_90%_28%)] dark:text-vacation"
            : "hover:border-vacation/50 hover:bg-vacation/10"
          : active
            ? "border-sick bg-sick/20 text-[hsl(350_70%_38%)] dark:text-sick"
            : "hover:border-sick/50 hover:bg-sick/10",
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          tone === "vacation" ? "bg-vacation" : "bg-sick",
        )}
      />
      {children}
      {active ? <X className="h-3 w-3 opacity-60" /> : null}
    </button>
  );
}
