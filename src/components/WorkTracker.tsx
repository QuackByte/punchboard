import CalendarGrid from "./workTracker/CalendarGrid";
import ConfigPanel from "./workTracker/ConfigPanel";
import FilePickerScreen from "./workTracker/FilePickerScreen";
import StatsBar from "./workTracker/StatsBar";
import ThemeToggle from "./workTracker/ThemeToggle";
import { usePanelVisibility } from "./workTracker/usePanelVisibility";
import { useTheme } from "./workTracker/useTheme";
import { useWorkTracker } from "./workTracker/useWorkTracker";
import YearlyOverview from "./workTracker/YearlyOverview";

export default function WorkTracker() {
  const { theme, setTheme } = useTheme();
  const { showConfig, setShowConfig } = usePanelVisibility();
  const {
    today,
    monthKey,
    selectedDays,
    hoursPerDay,
    hourlyRate,
    currency,
    onCurrencyChange,
    secondaryCurrency,
    onSecondaryCurrencyChange,
    conversionRate,
    onConversionRateChange,
    taxPercent,
    extraDeduction,
    payslipStartDay,
    defaultHours,
    exceptions,
    dailyHours,
    extraHours,
    extraHoursTotal,
    savedMonths,
    lastSavedAt,
    graphYear,
    setGraphYear,
    handleMonthChange,
    moveMonth,
    toggleDay,
    onHoursPerDayChange,
    onHourlyRateChange,
    onTaxPercentChange,
    onExtraDeductionChange,
    onPayslipStartDayChange,
    onDefaultHoursChange,
    exceptionSummary,
    actualHours,
    estimatedHours,
    grossSalary,
    taxAmount,
    extraDeductionAmount,
    netSalary,
    convertedGrossSalary,
    convertedNetSalary,
    payslipDateLookup,
    workingDateLookup,
    setDayException,
    updateDayHours,
    updateExtraHours,
    recentActivity,
    yearlyData,
    calendarCells,
    selectedMonthInfo,
    exportData,
    importData,
    isFileMode,
    fileInitialized,
    filePath,
    chooseExistingFile,
    createNewFile,
    changeFile,
  } = useWorkTracker();

  if (isFileMode && !fileInitialized) {
    return (
      <FilePickerScreen
        onChooseExisting={chooseExistingFile}
        onCreateNew={createNewFile}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-8 text-slate-800 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto w-full max-w-[1700px]">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
            Work Hours Tracker
          </h1>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => moveMonth("prev")}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 transition hover:border-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:border-slate-500"
            >
              Prev
            </button>
            <input
              className="min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-800 outline-none ring-cyan-500 transition focus:ring-2 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              type="month"
              value={monthKey}
              onChange={(event) => handleMonthChange(event.target.value)}
            />
            <button
              type="button"
              onClick={() => moveMonth("next")}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 transition hover:border-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:border-slate-500"
            >
              Next
            </button>
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle theme={theme} onThemeChange={setTheme} />
            <button
              type="button"
              onClick={() => setShowConfig(!showConfig)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:border-cyan-400 hover:text-cyan-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:border-cyan-500 dark:hover:text-cyan-300"
            >
              {showConfig ? "Hide settings" : "Show settings"}
            </button>
          </div>
        </div>

        {showConfig ? (
          <ConfigPanel
            savedMonthsCount={savedMonths.length}
            lastSavedAt={lastSavedAt}
            onClose={() => setShowConfig(false)}
            selectedDays={selectedDays}
            onToggleDay={toggleDay}
            hoursPerDay={hoursPerDay}
            onHoursPerDayChange={onHoursPerDayChange}
            hourlyRate={hourlyRate}
            onHourlyRateChange={onHourlyRateChange}
            currency={currency}
            onCurrencyChange={onCurrencyChange}
            secondaryCurrency={secondaryCurrency}
            onSecondaryCurrencyChange={onSecondaryCurrencyChange}
            conversionRate={conversionRate}
            onConversionRateChange={onConversionRateChange}
            taxPercent={taxPercent}
            onTaxPercentChange={onTaxPercentChange}
            extraDeduction={extraDeduction}
            onExtraDeductionChange={onExtraDeductionChange}
            payslipStartDay={payslipStartDay}
            onPayslipStartDayChange={onPayslipStartDayChange}
            defaultHours={defaultHours}
            onDefaultHoursChange={onDefaultHoursChange}
            recentActivity={recentActivity}
            onExportData={exportData}
            onImportData={importData}
            isFileMode={isFileMode}
            filePath={filePath}
            onChangeFile={changeFile}
          />
        ) : null}

        <section className="rounded-2xl border border-slate-200 bg-white/70 p-6 shadow-xl backdrop-blur dark:border-slate-800 dark:bg-slate-900/70">
          <StatsBar
            workingDaysCount={exceptionSummary.workingDaysCount}
            vacationDays={exceptionSummary.vacationDays}
            sickDays={exceptionSummary.sickDays}
            actualHours={actualHours}
            estimatedHours={estimatedHours}
            extraHoursTotal={extraHoursTotal}
            currency={currency}
            secondaryCurrency={secondaryCurrency}
            grossSalary={grossSalary}
            taxAmount={taxAmount}
            extraDeductionAmount={extraDeductionAmount}
            netSalary={netSalary}
            convertedGrossSalary={convertedGrossSalary}
            convertedNetSalary={convertedNetSalary}
          />
          <CalendarGrid
            cells={calendarCells}
            payslipDateLookup={payslipDateLookup}
            workingDateLookup={workingDateLookup}
            selectedMonthInfo={selectedMonthInfo}
            exceptions={exceptions}
            dailyHours={dailyHours}
            extraHours={extraHours}
            hoursPerDay={hoursPerDay}
            today={today}
            onSetException={setDayException}
            onHoursChange={updateDayHours}
            onExtraHoursChange={updateExtraHours}
          />
        </section>

        <YearlyOverview
          graphYear={graphYear}
          onPrevYear={() => setGraphYear(graphYear - 1)}
          onNextYear={() => setGraphYear(graphYear + 1)}
          yearlyData={yearlyData}
        />
      </div>
    </div>
  );
}
