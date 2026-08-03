import { Settings2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
    currencyConversionEnabled,
    onCurrencyConversionEnabledChange,
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
    dailyActualHours,
    estimatedHours,
    grossSalary,
    taxAmount,
    extraDeductionAmount,
    netSalary,
    convertedGrossSalary,
    convertedNetSalary,
    convertedTaxAmount,
    convertedExtraDeductionAmount,
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
    <div className="min-h-screen bg-background px-4 py-8 text-foreground">
      <div className="mx-auto w-full max-w-[1700px]">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground">
            <img
              src="./punchboard_icon.svg"
              alt=""
              className="h-8 w-8 rounded-lg"
            />
            Punchboard
          </h1>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => moveMonth("prev")}>
              Prev
            </Button>
            <Input
              className="h-9 w-auto min-w-0 [color-scheme:light] dark:[color-scheme:dark]"
              type="month"
              value={monthKey}
              onChange={(event) => handleMonthChange(event.target.value)}
            />
            <Button variant="outline" size="sm" onClick={() => moveMonth("next")}>
              Next
            </Button>
          </div>

          <div className="flex items-center gap-2">
            {!isFileMode ? (
              <a
                href="../#downloads"
                className={buttonVariants({
                  variant: "outline",
                  size: "sm",
                  className: "text-xs",
                })}
              >
                Get the desktop app
              </a>
            ) : null}
            <ThemeToggle theme={theme} onThemeChange={setTheme} />
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => setShowConfig(!showConfig)}
            >
              <Settings2 />
              {showConfig ? "Hide settings" : "Show settings"}
            </Button>
          </div>
        </div>

        <ConfigPanel
          open={showConfig}
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
          currencyConversionEnabled={currencyConversionEnabled}
          onCurrencyConversionEnabledChange={onCurrencyConversionEnabledChange}
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

        <Card className="bg-card/70 p-6 shadow-xl backdrop-blur">
          <StatsBar
            workingDaysCount={exceptionSummary.workingDaysCount}
            vacationDays={exceptionSummary.vacationDays}
            sickDays={exceptionSummary.sickDays}
            actualHours={actualHours}
            estimatedHours={estimatedHours}
            extraHoursTotal={extraHoursTotal}
            currency={currency}
            secondaryCurrency={secondaryCurrency}
            currencyConversionEnabled={currencyConversionEnabled}
            grossSalary={grossSalary}
            taxAmount={taxAmount}
            extraDeductionAmount={extraDeductionAmount}
            netSalary={netSalary}
            convertedGrossSalary={convertedGrossSalary}
            convertedNetSalary={convertedNetSalary}
            convertedTaxAmount={convertedTaxAmount}
            convertedExtraDeductionAmount={convertedExtraDeductionAmount}
          />
          <CalendarGrid
            cells={calendarCells}
            payslipDateLookup={payslipDateLookup}
            workingDateLookup={workingDateLookup}
            selectedMonthInfo={selectedMonthInfo}
            exceptions={exceptions}
            dailyHours={dailyHours}
            extraHours={extraHours}
            dailyActualHours={dailyActualHours}
            hoursPerDay={hoursPerDay}
            today={today}
            onSetException={setDayException}
            onHoursChange={updateDayHours}
            onExtraHoursChange={updateExtraHours}
          />
        </Card>

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
