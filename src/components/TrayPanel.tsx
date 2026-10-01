import { AppWindow, Ellipsis } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { TrayStatus } from "@/electron";
import PunchClock from "./workTracker/PunchClock";

const EMPTY_STATUS: TrayStatus = {
  ready: false,
  canPunchIn: false,
  canPunchOut: false,
  hasStaleSession: false,
  sessionStart: null,
  todayKey: "",
  todayEntries: [],
  targetHours: 0,
  openSession: null,
};

/**
 * The menu bar / tray popover: a compact punch clock that mirrors the main
 * window's state. All actions are relayed to the main window, which owns the
 * data, so the two can never disagree.
 */
export default function TrayPanel() {
  const [status, setStatus] = useState<TrayStatus>(EMPTY_STATUS);
  const rootRef = useRef<HTMLDivElement>(null);
  const desktop = window.desktop;

  useEffect(() => {
    if (!desktop) return;
    void desktop.getTrayStatus().then(setStatus);
    return desktop.onTrayStatus(setStatus);
  }, [desktop]);

  // The popover window sizes itself to its content.
  useLayoutEffect(() => {
    const node = rootRef.current;
    if (!node || !desktop) return;
    const observer = new ResizeObserver(() => {
      desktop.resizeTray(node.getBoundingClientRect().height);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [desktop]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") window.close();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const openMain = () => desktop?.openMainFromTray();

  const footer = (
    <div className="flex items-center gap-1.5 border-t border-ink-border pt-3">
      <button
        type="button"
        onClick={openMain}
        className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg text-xs font-medium text-ink-muted transition-colors hover:bg-ink-foreground/[0.06] hover:text-ink-foreground"
      >
        <AppWindow className="h-3.5 w-3.5" /> Open Punchboard
      </button>
      <button
        type="button"
        aria-label="More options"
        title="More options"
        onClick={() => desktop?.showTrayMenu()}
        className="grid h-8 w-8 place-items-center rounded-lg text-ink-muted transition-colors hover:bg-ink-foreground/[0.06] hover:text-ink-foreground"
      >
        <Ellipsis className="h-4 w-4" />
      </button>
    </div>
  );

  const label = (
    <span className="flex items-center gap-1.5">
      <img src="./punchboard_icon.svg" alt="" className="h-4 w-4 rounded" />
      Punchboard
    </span>
  );

  return (
    <div ref={rootRef} className="p-2">
      {status.ready ? (
        <PunchClock
          label={label}
          className="p-4 shadow-none"
          compact
          todayKey={status.todayKey}
          todayEntries={status.todayEntries}
          targetHours={status.targetHours}
          openSession={status.openSession}
          isViewingCurrentPeriod
          onPunchIn={() => desktop?.requestTrayPunch()}
          onPunchOut={() => desktop?.requestTrayPunch()}
          onGoToCurrentPeriod={openMain}
          onEditDay={openMain}
          footer={footer}
        />
      ) : (
        <section className="rounded-2xl border border-ink-border bg-ink p-4 text-ink-foreground">
          <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-muted">
            {label}
          </p>
          <p className="mt-4 text-sm">
            Choose a data file in Punchboard to start punching in from here.
          </p>
          <div className="mt-4">{footer}</div>
        </section>
      )}
    </div>
  );
}
