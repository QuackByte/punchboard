import { Download, Settings2 } from "lucide-react";
import { useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import CalendarGrid from "./workTracker/CalendarGrid";
import ConfigPanel from "./workTracker/ConfigPanel";
import FilePickerScreen from "./workTracker/FilePickerScreen";
import MonthNavigator from "./workTracker/MonthNavigator";
import { HoursSummary, PaySummary } from "./workTracker/PeriodSummary";
import PunchClock from "./workTracker/PunchClock";
import ThemeToggle from "./workTracker/ThemeToggle";
import { usePanelVisibility } from "./workTracker/usePanelVisibility";
import { useTheme } from "./workTracker/useTheme";
import { useWorkTracker } from "./workTracker/useWorkTracker";
import { dateKey, getPayslipRange } from "./workTracker/utils";
import YearlyOverview from "./workTracker/YearlyOverview";

function formatPeriodLabel(monthKey: string, payslipStartDay: number) {
  const { start, end } = getPayslipRange(monthKey, payslipStartDay);
  const format = (date: Date) =>
    date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  return `${format(start)} – ${format(end)}`;
}

export default function WorkTracker() {
  const { theme, setTheme } = useTheme();
  const { showConfig, setShowConfig } = usePanelVisibility();
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const tracker = useWorkTracker();
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
    startupAvailable,
    openAtLogin,
    startupError,
    changeOpenAtLogin,
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
  const isTodayWorkday =
    selectedDays.length > 0 &&
    workingDateLookup.has(todayKey) &&
    !exceptions[todayKey];

  return (
    <div className="min-h-screen px-4 pb-16 pt-5 text-foreground sm:px-6">
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
            <ThemeToggle theme={theme} onThemeChange={setTheme} />
            <button
              type="button"
              aria-label="Settings"
              title="Settings"
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
          startupAvailable={startupAvailable}
          openAtLogin={openAtLogin}
          startupError={startupError}
          onOpenAtLoginChange={changeOpenAtLogin}
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
              today={today}
              editingKey={editingKey}
              onEditingKeyChange={setEditingKey}
              onSetException={setDayException}
              onApplyDayInput={applyDayInput}
              onSetDayEntries={setDayEntries}
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
    </div>
  );
}
