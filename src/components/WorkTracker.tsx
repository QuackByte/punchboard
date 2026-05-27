import CalendarGrid from "./workTracker/CalendarGrid";
import CalendarMarkModeBar from "./workTracker/CalendarMarkModeBar";
import ConfigPanel from "./workTracker/ConfigPanel";
import StatsBar from "./workTracker/StatsBar";
import { useTheme } from "./workTracker/useTheme";
import { useWorkTracker } from "./workTracker/useWorkTracker";
import YearlyOverview from "./workTracker/YearlyOverview";

export default function WorkTracker() {
  const { theme, setTheme } = useTheme();
  const {
    today,
    monthKey,
    selectedDays,
    hoursPerDay,
    hourlyRate,
    taxPercent,
    extraDeduction,
    payslipStartDay,
    defaultHours,
    exceptionMode,
    setExceptionMode,
    exceptions,
    dailyHours,
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
    payslipDateLookup,
    workingDateLookup,
    applyException,
    updateDayHours,
    recentActivity,
    yearlyData,
    calendarCells,
    selectedMonthInfo,
    exportData,
    importData,
  } = useWorkTracker();

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-8 text-slate-800 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto grid w-full max-w-6xl gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
        <ConfigPanel
          theme={theme}
          onThemeChange={setTheme}
          savedMonthsCount={savedMonths.length}
          lastSavedAt={lastSavedAt}
          monthKey={monthKey}
          onMonthChange={handleMonthChange}
          onPrevMonth={() => moveMonth("prev")}
          onNextMonth={() => moveMonth("next")}
          selectedDays={selectedDays}
          onToggleDay={toggleDay}
          hoursPerDay={hoursPerDay}
          onHoursPerDayChange={onHoursPerDayChange}
          hourlyRate={hourlyRate}
          onHourlyRateChange={onHourlyRateChange}
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
        />

        <section className="rounded-2xl border border-slate-200 bg-white/70 p-6 shadow-xl backdrop-blur dark:border-slate-800 dark:bg-slate-900/70">
          <CalendarMarkModeBar
            exceptionMode={exceptionMode}
            onModeChange={setExceptionMode}
          />
          <StatsBar
            workingDaysCount={exceptionSummary.workingDaysCount}
            vacationDays={exceptionSummary.vacationDays}
            sickDays={exceptionSummary.sickDays}
            actualHours={actualHours}
            estimatedHours={estimatedHours}
            grossSalary={grossSalary}
            taxAmount={taxAmount}
            extraDeductionAmount={extraDeductionAmount}
            netSalary={netSalary}
          />
          <CalendarGrid
            cells={calendarCells}
            payslipDateLookup={payslipDateLookup}
            workingDateLookup={workingDateLookup}
            selectedMonthInfo={selectedMonthInfo}
            exceptions={exceptions}
            dailyHours={dailyHours}
            hoursPerDay={hoursPerDay}
            today={today}
            onCellClick={applyException}
            onHoursChange={updateDayHours}
          />
        </section>
      </div>

      <YearlyOverview
        graphYear={graphYear}
        onPrevYear={() => setGraphYear(graphYear - 1)}
        onNextYear={() => setGraphYear(graphYear + 1)}
        yearlyData={yearlyData}
      />
    </div>
  );
}
