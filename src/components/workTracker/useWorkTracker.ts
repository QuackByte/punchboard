import { useEffect, useMemo, useState } from "react";
import {
  ACTIVITY_LOG_KEY,
  ActivityLogEntry,
  ActivityType,
  DayKey,
  ExceptionType,
  HOLIDAY_DEFAULT_HOURS,
  MarkMode,
  SAVED_MONTHS_KEY,
  TrackerData,
  TrackerUiState,
  UI_STATE_KEY,
  weekdayMap,
  YearlyDataPoint,
} from "./types";
import {
  clampDay,
  clampHours,
  clampPercent,
  dateKey,
  formatMonthKey,
  getDatesInPayslipRange,
  getInitialUiState,
  getPreviousMonthKey,
  parseMonthKey,
  safeStorageGetItem,
  safeStorageRemoveItem,
  safeStorageSetItem,
} from "./utils";

export function useWorkTracker() {
  const initialUiState = getInitialUiState();
  const today = new Date();

  const getLegacyDataForMonth = (targetMonthKey: string) => {
    const legacyMonthKey = getPreviousMonthKey(targetMonthKey);
    const rawLegacyData = safeStorageGetItem(`tracker-${legacyMonthKey}`);

    if (!rawLegacyData) {
      return null;
    }

    try {
      const parsed = JSON.parse(rawLegacyData) as TrackerData;
      const resolvedMonthKey =
        parsed.payslipEndDay < parsed.payslipStartDay
          ? formatMonthKey(
              new Date(
                parseMonthKey(legacyMonthKey).year,
                parseMonthKey(legacyMonthKey).monthIndex + 1,
                1,
              ),
            )
          : legacyMonthKey;

      if (resolvedMonthKey !== targetMonthKey) {
        return null;
      }

      return parsed;
    } catch {
      return null;
    }
  };

  const [monthKey, setMonthKey] = useState<string>(initialUiState.monthKey);
  const [selectedDays, setSelectedDays] = useState<DayKey[]>([
    "mon",
    "tue",
    "wed",
    "thu",
    "fri",
  ]);
  const [hoursPerDay, setHoursPerDay] = useState<number>(8);
  const [hourlyRate, setHourlyRate] = useState<number>(15);
  const [taxPercent, setTaxPercent] = useState<number>(0);
  const [extraDeduction, setExtraDeduction] = useState<number>(0);
  const [payslipStartDay, setPayslipStartDay] = useState<number>(21);
  const [payslipEndDay, setPayslipEndDay] = useState<number>(20);
  const [defaultHours, setDefaultHours] = useState<number>(8);
  const [exceptionMode, setExceptionMode] = useState<MarkMode>("none");
  const [exceptions, setExceptions] = useState<Record<string, ExceptionType>>(
    {},
  );
  const [dailyHours, setDailyHours] = useState<Record<string, number>>({});
  const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>([]);
  const [savedMonths, setSavedMonths] = useState<string[]>([]);
  const [lastSavedAt, setLastSavedAt] = useState<string>("");
  const [isMonthHydrated, setIsMonthHydrated] = useState<boolean>(false);
  const [graphYear, setGraphYear] = useState<number>(initialUiState.graphYear);

  const addActivity = (type: ActivityType, message: string) => {
    const entry: ActivityLogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      monthKey,
      timestamp: new Date().toISOString(),
      type,
      message,
    };
    setActivityLog((previous) => [entry, ...previous].slice(0, 200));
  };

  const handleMonthChange = (nextMonth: string) => {
    if (!nextMonth || nextMonth === monthKey) {
      return;
    }
    setMonthKey(nextMonth);
    addActivity("month-change", `Switched to ${nextMonth}`);
  };

  const moveMonth = (direction: "prev" | "next") => {
    const { year, monthIndex } = parseMonthKey(monthKey);
    const nextDate =
      direction === "prev"
        ? new Date(year, monthIndex - 1, 1)
        : new Date(year, monthIndex + 1, 1);
    handleMonthChange(formatMonthKey(nextDate));
  };

  const toggleDay = (key: DayKey) => {
    setSelectedDays((previous) =>
      previous.includes(key)
        ? previous.filter((day) => day !== key)
        : [...previous, key],
    );
    addActivity("weekday-toggle", `Toggled weekday ${key.toUpperCase()}`);
  };

  const onHoursPerDayChange = (value: number) => {
    setHoursPerDay(value);
    addActivity("value-change", `Updated hours/day to ${value}`);
  };

  const onHourlyRateChange = (value: number) => {
    setHourlyRate(value);
    addActivity("value-change", `Updated hourly rate to ${value}`);
  };

  const onTaxPercentChange = (value: number) => {
    const clamped = clampPercent(value);
    setTaxPercent(clamped);
    addActivity("value-change", `Updated tax to ${clamped}%`);
  };

  const onExtraDeductionChange = (value: number) => {
    const next = Math.max(0, value || 0);
    setExtraDeduction(next);
    addActivity("value-change", `Updated extra deduction to ${next}`);
  };

  const onPayslipStartDayChange = (value: number) => {
    const clamped = clampDay(value);
    setPayslipStartDay(clamped);
    addActivity("value-change", `Updated payslip start day to ${clamped}`);
  };

  const onPayslipEndDayChange = (value: number) => {
    const clamped = clampDay(value);
    setPayslipEndDay(clamped);
    addActivity("value-change", `Updated payslip end day to ${clamped}`);
  };

  const onDefaultHoursChange = (value: number) => {
    setDefaultHours(value);
    addActivity("value-change", `Updated default hours/day to ${value}`);
  };

  useEffect(() => {
    const rawLog = safeStorageGetItem(ACTIVITY_LOG_KEY);
    if (rawLog) {
      try {
        const parsed = JSON.parse(rawLog) as ActivityLogEntry[];
        setActivityLog(Array.isArray(parsed) ? parsed.slice(0, 200) : []);
      } catch {
        safeStorageRemoveItem(ACTIVITY_LOG_KEY);
      }
    }

    const rawSavedMonths = safeStorageGetItem(SAVED_MONTHS_KEY);
    if (rawSavedMonths) {
      try {
        const parsed = JSON.parse(rawSavedMonths) as string[];
        setSavedMonths(Array.isArray(parsed) ? parsed : []);
      } catch {
        safeStorageRemoveItem(SAVED_MONTHS_KEY);
      }
    }
  }, []);

  useEffect(() => {
    safeStorageSetItem(ACTIVITY_LOG_KEY, JSON.stringify(activityLog));
  }, [activityLog]);

  useEffect(() => {
    safeStorageSetItem(
      UI_STATE_KEY,
      JSON.stringify({ monthKey, graphYear } satisfies TrackerUiState),
    );
  }, [monthKey, graphYear]);

  useEffect(() => {
    setIsMonthHydrated(false);

    const saved = safeStorageGetItem(`tracker-${monthKey}`);
    const legacyData = saved ? null : getLegacyDataForMonth(monthKey);

    if (!saved && !legacyData) {
      setSelectedDays(["mon", "tue", "wed", "thu", "fri"]);
      setHoursPerDay(8);
      setHourlyRate(15);
      setTaxPercent(0);
      setExtraDeduction(0);
      setPayslipStartDay(21);
      setPayslipEndDay(20);
      setDefaultHours(8);
      setExceptions({});
      setDailyHours({});
      setIsMonthHydrated(true);
      return;
    }

    try {
      const data = saved ? (JSON.parse(saved) as TrackerData) : legacyData;

      if (!data) {
        throw new Error("Missing tracker data");
      }

      setSelectedDays(data.selectedDays);
      setHoursPerDay(data.hoursPerDay);
      setHourlyRate(data.hourlyRate);
      setTaxPercent(data.taxPercent ?? 0);
      setExtraDeduction(data.extraDeduction ?? 0);
      setPayslipStartDay(data.payslipStartDay);
      setPayslipEndDay(data.payslipEndDay);
      setDefaultHours(data.defaultHours);
      setExceptions(data.exceptions ?? {});
      setDailyHours(data.dailyHours ?? {});
    } catch {
      safeStorageRemoveItem(`tracker-${monthKey}`);
      setSelectedDays(["mon", "tue", "wed", "thu", "fri"]);
      setHoursPerDay(8);
      setHourlyRate(15);
      setTaxPercent(0);
      setExtraDeduction(0);
      setPayslipStartDay(21);
      setPayslipEndDay(20);
      setDefaultHours(8);
      setExceptions({});
      setDailyHours({});
    } finally {
      setIsMonthHydrated(true);
    }
  }, [monthKey]);

  useEffect(() => {
    if (!isMonthHydrated) {
      return;
    }

    const data: TrackerData = {
      selectedDays,
      hoursPerDay,
      hourlyRate,
      taxPercent,
      extraDeduction,
      payslipStartDay,
      payslipEndDay,
      defaultHours,
      exceptions,
      dailyHours,
    };

    safeStorageSetItem(`tracker-${monthKey}`, JSON.stringify(data));

    setSavedMonths((previous) => {
      if (previous.includes(monthKey)) {
        return previous;
      }
      const next = [...previous, monthKey].sort();
      safeStorageSetItem(SAVED_MONTHS_KEY, JSON.stringify(next));
      return next;
    });

    setLastSavedAt(new Date().toISOString());
  }, [
    selectedDays,
    hoursPerDay,
    hourlyRate,
    taxPercent,
    extraDeduction,
    payslipStartDay,
    payslipEndDay,
    defaultHours,
    exceptions,
    dailyHours,
    monthKey,
    isMonthHydrated,
  ]);

  const workingDates = useMemo(() => {
    const rangeDates = getDatesInPayslipRange(
      monthKey,
      payslipStartDay,
      payslipEndDay,
    );
    return rangeDates.filter((date) =>
      selectedDays.includes(weekdayMap[date.getDay()]),
    );
  }, [monthKey, payslipStartDay, payslipEndDay, selectedDays]);

  const exceptionSummary = useMemo(() => {
    let vacationDays = 0;
    let sickDays = 0;

    workingDates.forEach((date) => {
      const key = dateKey(date);
      if (exceptions[key] === "vacation") {
        vacationDays += 1;
      }
      if (exceptions[key] === "sick") {
        sickDays += 1;
      }
    });

    return { workingDaysCount: workingDates.length, vacationDays, sickDays };
  }, [workingDates, exceptions]);

  const actualHours = useMemo(
    () =>
      workingDates.reduce((total, date) => {
        const key = dateKey(date);
        if (exceptions[key] === "sick") {
          return total;
        }
        if (exceptions[key] === "vacation") {
          const manualHours = dailyHours[key] ?? 0;
          return total + HOLIDAY_DEFAULT_HOURS + clampHours(manualHours);
        }
        const dayHours = dailyHours[key] ?? hoursPerDay;
        return total + clampHours(dayHours);
      }, 0),
    [workingDates, exceptions, dailyHours, hoursPerDay],
  );

  const estimatedHours = workingDates.length * defaultHours;
  const grossSalary = actualHours * hourlyRate;
  const taxAmount = grossSalary * (clampPercent(taxPercent) / 100);
  const extraDeductionAmount = Math.max(0, extraDeduction);
  const netSalary = Math.max(0, grossSalary - taxAmount - extraDeductionAmount);

  const workingDateLookup = useMemo(() => {
    const lookup = new Set<string>();
    workingDates.forEach((date) => {
      lookup.add(dateKey(date));
    });
    return lookup;
  }, [workingDates]);

  const payslipDateLookup = useMemo(() => {
    const lookup = new Set<string>();
    const rangeDates = getDatesInPayslipRange(
      monthKey,
      payslipStartDay,
      payslipEndDay,
    );
    rangeDates.forEach((date) => {
      lookup.add(dateKey(date));
    });
    return lookup;
  }, [monthKey, payslipStartDay, payslipEndDay]);

  const applyException = (key: string) => {
    if (!workingDateLookup.has(key)) {
      return;
    }

    setExceptions((previous) => {
      const next = { ...previous };
      if (exceptionMode === "none" || previous[key] === exceptionMode) {
        delete next[key];
        addActivity("exception-change", `Cleared mark on ${key}`);
      } else {
        next[key] = exceptionMode;
        addActivity("exception-change", `Marked ${key} as ${exceptionMode}`);
      }
      return next;
    });
  };

  const updateDayHours = (key: string, value: number) => {
    if (!workingDateLookup.has(key)) {
      return;
    }

    const nextValue = clampHours(value);
    setDailyHours((previous) => ({ ...previous, [key]: nextValue }));
    addActivity("hours-change", `Updated ${key} hours to ${nextValue}`);
  };

  const recentActivity = useMemo(() => activityLog.slice(0, 8), [activityLog]);

  const yearlyData = useMemo(() => {
    const monthsData: YearlyDataPoint[] = [];

    for (let monthIndex = 0; monthIndex < 12; monthIndex += 1) {
      const monthName = new Date(graphYear, monthIndex, 1).toLocaleDateString(
        "en-US",
        { month: "short" },
      );
      const mKey = `${graphYear}-${String(monthIndex + 1).padStart(2, "0")}`;

      if (mKey === monthKey) {
        monthsData.push({
          month: monthName,
          monthKey: mKey,
          actualHours: actualHours,
        });
        continue;
      }

      const dataStr = safeStorageGetItem(`tracker-${mKey}`);
      const legacyData = dataStr ? null : getLegacyDataForMonth(mKey);

      if (dataStr || legacyData) {
        try {
          const data: TrackerData = dataStr ? JSON.parse(dataStr) : legacyData;
          const rangeDates = getDatesInPayslipRange(
            mKey,
            data.payslipStartDay,
            data.payslipEndDay,
          );

          let totalActualHours = 0;
          rangeDates.forEach((date) => {
            const key = dateKey(date);
            const isWorkingDay = data.selectedDays.includes(
              weekdayMap[date.getDay()] as DayKey,
            );

            if (isWorkingDay && data.exceptions[key] !== "sick") {
              if (data.exceptions[key] === "vacation") {
                const manualHours = data.dailyHours[key] ?? 0;
                totalActualHours +=
                  HOLIDAY_DEFAULT_HOURS + clampHours(manualHours);
              } else {
                const hours = data.dailyHours[key] ?? data.hoursPerDay;
                totalActualHours += clampHours(hours);
              }
            }
          });

          monthsData.push({
            month: monthName,
            monthKey: mKey,
            actualHours: totalActualHours,
          });
        } catch {
          monthsData.push({ month: monthName, monthKey: mKey, actualHours: 0 });
        }
      } else {
        monthsData.push({ month: monthName, monthKey: mKey, actualHours: 0 });
      }
    }

    return monthsData;
  }, [graphYear, monthKey, actualHours]);

  const calendarCells = useMemo(() => {
    const rangeDates = getDatesInPayslipRange(
      monthKey,
      payslipStartDay,
      payslipEndDay,
    );
    const cells: Array<Date | null> = [];

    if (rangeDates.length === 0) {
      return cells;
    }

    const firstDate = rangeDates[0];
    const dayOfWeek = firstDate.getDay();
    for (let index = 0; index < dayOfWeek; index += 1) {
      cells.push(null);
    }

    rangeDates.forEach((date) => {
      cells.push(new Date(date));
    });

    while (cells.length % 7 !== 0) {
      cells.push(null);
    }

    return cells;
  }, [monthKey, payslipStartDay, payslipEndDay]);

  const selectedMonthInfo = useMemo(() => {
    const { year, monthIndex } = parseMonthKey(monthKey);
    return {
      year,
      monthIndex,
      label: new Date(year, monthIndex, 1).toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      }),
    };
  }, [monthKey]);

  const exportData = () => {
    const months: Record<string, TrackerData> = {};

    const allMonths = savedMonths.includes(monthKey)
      ? savedMonths
      : [...savedMonths, monthKey];

    allMonths.forEach((mk) => {
      const raw = safeStorageGetItem(`tracker-${mk}`);
      if (raw) {
        try {
          months[mk] = JSON.parse(raw) as TrackerData;
        } catch {
          // skip corrupt entry
        }
      }
    });

    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      uiState: { monthKey, graphYear },
      savedMonths,
      activityLog,
      months,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `work-hours-tracker-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const importData = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const payload = JSON.parse(text) as {
          version: number;
          uiState?: unknown;
          savedMonths?: unknown;
          activityLog?: unknown;
          months?: Record<string, unknown>;
        };

        if (payload.version !== 1) {
          alert("Unsupported backup format version.");
          return;
        }

        if (payload.months && typeof payload.months === "object") {
          Object.entries(payload.months).forEach(([mk, data]) => {
            if (/^\d{4}-\d{2}$/.test(mk)) {
              safeStorageSetItem(`tracker-${mk}`, JSON.stringify(data));
            }
          });
        }

        if (Array.isArray(payload.savedMonths)) {
          safeStorageSetItem(
            SAVED_MONTHS_KEY,
            JSON.stringify(payload.savedMonths),
          );
        }

        if (Array.isArray(payload.activityLog)) {
          safeStorageSetItem(
            ACTIVITY_LOG_KEY,
            JSON.stringify(
              (payload.activityLog as ActivityLogEntry[]).slice(0, 200),
            ),
          );
        }

        if (payload.uiState && typeof payload.uiState === "object") {
          safeStorageSetItem(UI_STATE_KEY, JSON.stringify(payload.uiState));
        }

        window.location.reload();
      } catch {
        alert("Failed to import: the file is not a valid backup.");
      }
    };
    reader.readAsText(file);
  };

  return {
    today,
    monthKey,
    selectedDays,
    hoursPerDay,
    hourlyRate,
    taxPercent,
    extraDeduction,
    payslipStartDay,
    payslipEndDay,
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
    onPayslipEndDayChange,
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
  };
}
