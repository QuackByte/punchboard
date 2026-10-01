import { Download, FileDown, Printer, Settings2, Sheet } from "lucide-react";
import { useEffect, useState } from "react";
import { flushSync } from "react-dom";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import CalendarGrid from "./workTracker/CalendarGrid";
import ConfigPanel from "./workTracker/ConfigPanel";
import FilePickerScreen from "./workTracker/FilePickerScreen";
import MonthNavigator from "./workTracker/MonthNavigator";
import { HoursSummary, PaySummary } from "./workTracker/PeriodSummary";
import PunchClock from "./workTracker/PunchClock";
import ThemeToggle from "./workTracker/ThemeToggle";
import TimesheetPrint from "./workTracker/TimesheetPrint";
import {
  buildTimesheetRows,
  downloadTextFile,
  TimesheetMeta,
  timesheetCsv,
} from "./workTracker/timesheet";
import UndoToast from "./workTracker/UndoToast";
import { useDesktopPreferences } from "./workTracker/useDesktopPreferences";
import { usePanelVisibility } from "./workTracker/usePanelVisibility";
import { useTheme } from "./workTracker/useTheme";
import { useWorkTracker } from "./workTracker/useWorkTracker";
import { dateKey, getPayslipRange } from "./workTracker/utils";
import YearlyOverview from "./workTracker/YearlyOverview";

const shortcutLabel = /Mac|iPhone|iPad/.test(navigator.platform)
  ? "⌘,"
  : "Ctrl+,";

/** True when a key press is meant for a text field rather than a shortcut. */
function isTypingTarget(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
  );
}

function formatPeriodLabel(
  monthKey: string,
  payslipStartDay: number,
  withYear = false,
) {
  const { start, end } = getPayslipRange(monthKey, payslipStartDay);
  const format = (date: Date) =>
    date.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      ...(withYear ? { year: "numeric" } : {}),
    });
  return `${format(start)} – ${format(end)}`;
}

export default function WorkTracker() {
  const { theme, setTheme } = useTheme();
  const { showConfig, setShowConfig } = usePanelVisibility();
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [focusTodayRequest, setFocusTodayRequest] = useState(0);
  const [isPrinting, setIsPrinting] = useState(false);
  const tracker = useWorkTracker();
  const desktop = useDesktopPreferences();
  const { undo, goToCurrentPeriod: jumpToCurrentPeriod } = tracker;

  // ⌘, / Ctrl+, opens Settings, like any desktop app. The macOS app menu
  // sends the same request from the main process.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "," && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setShowConfig(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    const unsubscribe = window.desktop?.onOpenSettings(() =>
      setShowConfig(true),
    );
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      unsubscribe?.();
    };
  }, [setShowConfig]);

  // T jumps to today on the time card; ⌘Z / Ctrl+Z undoes the last
  // destructive change (text fields keep their own undo).
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return;
      if (
        event.key.toLowerCase() === "z" &&
        (event.metaKey || event.ctrlKey) &&
        !event.shiftKey &&
        !event.altKey
      ) {
        if (undo()) event.preventDefault();
        return;
      }
      if (
        event.key.toLowerCase() === "t" &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !document.querySelector("[data-radix-popper-content-wrapper]")
      ) {
        event.preventDefault();
        jumpToCurrentPeriod();
        setFocusTodayRequest((request) => request + 1);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [undo, jumpToCurrentPeriod]);
  const {
    today,
    monthKey,
    selectedDays,
    hoursPerDay,
    hourlyRate,
    currency,
    secondaryCurrency,
    currencyConversionEnabled,
    taxPercent,
    payslipStartDay,
    exceptions,
    dailyHours,
    extraHours,
    extraHoursTotal,
    timeEntries,
    savedMonths,
    graphYear,
    setGraphYear,
    handleMonthChange,
    moveMonth,
    exceptionSummary,
    actualHours,
    dailyActualHours,
    estimatedHours,
    grossSalary,
    taxAmount,
    extraDeductionAmount,
    netSalary,
    convertedNetSalary,
    payslipDateLookup,
    workingDateLookup,
    setDayException,
    setDayEntries,
    resetDay,
    applyDayInput,
    todayKey,
    isViewingCurrentPeriod,
    goToCurrentPeriod,
    openSession,
    punchIn,
    punchOut,
    yearlyData,
    calendarCells,
    selectedMonthInfo,
    isFileMode,
    fileInitialized,
    chooseExistingFile,
    createNewFile,
    browserFileSupported,
    browserFileHandle,
    browserFileNeedsPermission,
    browserFileError,
    connectBrowserDataFile,
    saveBrowserDataToFile,
    reconnectBrowserDataFile,
    reloadBrowserDataFile,
    overwriteBrowserDataFile,
    disconnectBrowserDataFile,
  } = tracker;

  if (isFileMode && !fileInitialized) {
    return (
      <FilePickerScreen
        onChooseExisting={chooseExistingFile}
        onCreateNew={createNewFile}
      />
    );
  }

  const periodLabel = formatPeriodLabel(monthKey, payslipStartDay);
  const toDate = isViewingCurrentPeriod
    ? calendarCells.reduce(
        (totals, cell) => {
          if (!cell || cell > today) return totals;
          const key = dateKey(cell);
          totals.logged += dailyActualHours[key] ?? 0;
          if (workingDateLookup.has(key)) {
            totals.scheduled += hoursPerDay;
            totals.daysElapsed += 1;
          }
          return totals;
        },
        { logged: 0, scheduled: 0, daysElapsed: 0 },
      )
    : null;
  const timesheetMeta: TimesheetMeta = {
    title: selectedMonthInfo.label,
    periodLabel: formatPeriodLabel(monthKey, payslipStartDay, true),
    currency,
    hourlyRate,
    taxPercent,
    overtimeMultiplier: tracker.workRules.overtimeMultiplier,
  };
  const timesheetRows = () => buildTimesheetRows(tracker.period, timeEntries);

  const downloadCsv = () => {
    downloadTextFile(
      `punchboard-timesheet-${monthKey}.csv`,
      timesheetCsv(timesheetRows(), tracker.period, tracker.pay, timesheetMeta),
      "text/csv;charset=utf-8",
    );
  };

  // The printable sheet only exists while printing, so it never weighs on
  // normal renders. flushSync puts it in the DOM before the dialog opens.
  const printTimesheet = () => {
    flushSync(() => setIsPrinting(true));
    const previousTitle = document.title;
    // Browsers use the title as the suggested PDF file name.
    document.title = `Punchboard timesheet ${monthKey}`;
    window.print();
    document.title = previousTitle;
    setIsPrinting(false);
  };

  const isTodayWorkday =
    selectedDays.length > 0 &&
    workingDateLookup.has(todayKey) &&
    !exceptions[todayKey];

  return (
    <>
      <div className="min-h-screen px-4 pb-16 pt-5 text-foreground print:hidden sm:px-6">
        <div className="mx-auto w-full max-w-[1320px]">
          <header className="mb-6 grid grid-cols-[1fr_auto] items-center gap-3 lg:grid-cols-[1fr_auto_1fr]">
            <div className="flex items-center gap-2.5">
              <img
                src="./punchboard_icon.svg"
                alt=""
                className="h-9 w-9 rounded-[10px] shadow-sm"
              />
              <div className="leading-none">
                <p className="text-[19px] font-bold tracking-tight">Punchboard</p>
                <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                  Time card
                </p>
              </div>
            </div>

            <div className="order-last col-span-2 flex justify-center lg:order-none lg:col-span-1">
              <MonthNavigator
                monthKey={monthKey}
                year={selectedMonthInfo.year}
                monthIndex={selectedMonthInfo.monthIndex}
                periodLabel={periodLabel}
                isViewingCurrentPeriod={isViewingCurrentPeriod}
                savedMonths={savedMonths}
                onMove={moveMonth}
                onSelect={handleMonthChange}
                onToday={goToCurrentPeriod}
              />
            </div>

            <div className="flex items-center justify-end gap-2">
              {!isFileMode ? (
                <a
                  href="../#downloads"
                  className={cn(
                    buttonVariants({ variant: "ghost", size: "sm" }),
                    "hidden h-9 rounded-xl text-xs text-muted-foreground sm:inline-flex",
                  )}
                >
                  <Download className="!h-3.5 !w-3.5" />
                  Desktop app
                </a>
              ) : null}
              <DropdownMenu>
                <DropdownMenuTrigger
                  aria-label="Export timesheet"
                  title="Export timesheet"
                  className="grid h-9 w-9 place-items-center rounded-xl border bg-card/80 text-muted-foreground backdrop-blur transition-colors hover:text-foreground"
                >
                  <FileDown className="h-4 w-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="font-normal">
                    <span className="stamp">Timesheet</span>
                    <span className="mt-0.5 block font-mono text-[11px] text-muted-foreground">
                      {periodLabel}
                    </span>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={downloadCsv}>
                    <Sheet className="mr-2 h-4 w-4" />
                    Download CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => window.setTimeout(printTimesheet, 0)}>
                    <Printer className="mr-2 h-4 w-4" />
                    Print or save as PDF…
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <ThemeToggle theme={theme} onThemeChange={setTheme} />
              <button
                type="button"
                aria-label="Settings"
                title={`Settings (${shortcutLabel})`}
                onClick={() => setShowConfig(!showConfig)}
                className="grid h-9 w-9 place-items-center rounded-xl border bg-card/80 text-muted-foreground backdrop-blur transition-colors hover:text-foreground"
              >
                <Settings2 className="h-4 w-4" />
              </button>
            </div>
          </header>

          <ConfigPanel
            open={showConfig}
            savedMonthsCount={savedMonths.length}
            lastSavedAt={tracker.lastSavedAt}
            onClose={() => setShowConfig(false)}
            selectedDays={selectedDays}
            onToggleDay={tracker.toggleDay}
            hoursPerDay={hoursPerDay}
            onHoursPerDayChange={tracker.onHoursPerDayChange}
            hourlyRate={hourlyRate}
            onHourlyRateChange={tracker.onHourlyRateChange}
            currency={currency}
            onCurrencyChange={tracker.onCurrencyChange}
            secondaryCurrency={secondaryCurrency}
            onSecondaryCurrencyChange={tracker.onSecondaryCurrencyChange}
            conversionRate={tracker.conversionRate}
            onConversionRateChange={tracker.onConversionRateChange}
            currencyConversionEnabled={currencyConversionEnabled}
            onCurrencyConversionEnabledChange={
              tracker.onCurrencyConversionEnabledChange
            }
            taxPercent={taxPercent}
            onTaxPercentChange={tracker.onTaxPercentChange}
            extraDeduction={tracker.extraDeduction}
            onExtraDeductionChange={tracker.onExtraDeductionChange}
            payslipStartDay={payslipStartDay}
            onPayslipStartDayChange={tracker.onPayslipStartDayChange}
            defaultHours={tracker.defaultHours}
            onDefaultHoursChange={tracker.onDefaultHoursChange}
            recentActivity={tracker.recentActivity}
            onExportData={tracker.exportData}
            onImportData={tracker.importData}
            isFileMode={isFileMode}
            filePath={tracker.filePath}
            onChangeFile={tracker.changeFile}
            browserFileSupported={browserFileSupported}
            hasBrowserFile={browserFileHandle !== null}
            browserFileNeedsPermission={browserFileNeedsPermission}
            browserFileError={browserFileError}
            onConnectBrowserFile={connectBrowserDataFile}
            onSaveBrowserDataToFile={saveBrowserDataToFile}
            onReconnectBrowserFile={reconnectBrowserDataFile}
            onReloadBrowserFile={reloadBrowserDataFile}
            onOverwriteBrowserFile={overwriteBrowserDataFile}
            onDisconnectBrowserFile={disconnectBrowserDataFile}
            startupAvailable={desktop.startupAvailable}
            openAtLogin={desktop.openAtLogin}
            startupError={desktop.startupError}
            onOpenAtLoginChange={desktop.changeOpenAtLogin}
            showTray={desktop.showTray}
            onShowTrayChange={desktop.changeShowTray}
            desktopPreferences={desktop.preferences}
            onDesktopPreferencesChange={desktop.changeDesktopPreferences}
            workRules={tracker.workRules}
            onWorkRulesChange={tracker.onWorkRulesChange}
          />

          <main className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)_minmax(0,1fr)]">
              <div className="animate-rise-in md:col-span-2 xl:col-span-1">
                <PunchClock
                  todayKey={todayKey}
                  todayEntries={timeEntries[todayKey] ?? []}
                  targetHours={isTodayWorkday ? hoursPerDay : 0}
                  openSession={openSession}
                  isViewingCurrentPeriod={isViewingCurrentPeriod}
                  onPunchIn={punchIn}
                  onPunchOut={punchOut}
                  onGoToCurrentPeriod={goToCurrentPeriod}
                  onEditDay={setEditingKey}
                />
              </div>
              <div className="animate-rise-in [animation-delay:60ms] [&>section]:h-full">
                <HoursSummary
                  periodLabel={periodLabel}
                  workingDaysCount={exceptionSummary.workingDaysCount}
                  vacationDays={exceptionSummary.vacationDays}
                  sickDays={exceptionSummary.sickDays}
                  actualHours={actualHours}
                  estimatedHours={estimatedHours}
                  extraHoursTotal={extraHoursTotal}
                  toDate={toDate}
                />
              </div>
              <div className="animate-rise-in [animation-delay:120ms] [&>section]:h-full">
                <PaySummary
                  currency={currency}
                  secondaryCurrency={secondaryCurrency}
                  showConversion={
                    currencyConversionEnabled && currency !== secondaryCurrency
                  }
                  hourlyRate={hourlyRate}
                  taxPercent={taxPercent}
                  overtimeMultiplier={tracker.workRules.overtimeMultiplier}
                  pay={tracker.pay}
                  grossSalary={grossSalary}
                  taxAmount={taxAmount}
                  extraDeductionAmount={extraDeductionAmount}
                  netSalary={netSalary}
                  convertedNetSalary={convertedNetSalary}
                />
              </div>
            </div>

            <div className="animate-rise-in [animation-delay:180ms]">
              <CalendarGrid
                cells={calendarCells}
                payslipDateLookup={payslipDateLookup}
                workingDateLookup={workingDateLookup}
                selectedMonthInfo={selectedMonthInfo}
                periodLabel={periodLabel}
                exceptions={exceptions}
                dailyHours={dailyHours}
                extraHours={extraHours}
                dailyActualHours={dailyActualHours}
                timeEntries={timeEntries}
                hoursPerDay={hoursPerDay}
                workRules={tracker.workRules}
                today={today}
                focusTodayRequest={focusTodayRequest}
                editingKey={editingKey}
                onEditingKeyChange={setEditingKey}
                onSetException={setDayException}
                onApplyDayInput={applyDayInput}
                onSetDayEntries={setDayEntries}
                onRemoveSession={tracker.removeSession}
                onResetDay={resetDay}
              />
            </div>

            <div className="animate-rise-in [animation-delay:240ms]">
              <YearlyOverview
                graphYear={graphYear}
                selectedMonthKey={monthKey}
                onPrevYear={() => setGraphYear(graphYear - 1)}
                onNextYear={() => setGraphYear(graphYear + 1)}
                onSelectMonth={handleMonthChange}
                yearlyData={yearlyData}
              />
            </div>
          </main>
        </div>

        <UndoToast
          offer={tracker.undoOffer}
          onUndo={undo}
          onDismiss={tracker.dismissUndo}
        />
      </div>
      {isPrinting ? (
        <TimesheetPrint
          rows={timesheetRows()}
          period={tracker.period}
          pay={tracker.pay}
          meta={timesheetMeta}
        />
      ) : null}
    </>
  );
}
