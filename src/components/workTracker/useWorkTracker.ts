import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ACTIVITY_LOG_KEY,
  ActivityLogEntry,
  ActivityType,
  CurrencyCode,
  DataFile,
  DayKey,
  ExceptionType,
  SAVED_MONTHS_KEY,
  SETTINGS_KEY,
  TrackerData,
  TrackerSettings,
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
  parseMonthKey,
  safeStorageGetItem,
  safeStorageRemoveItem,
  safeStorageSetItem,
} from "./utils";

const isFileMode = !!window.fileAPI?.isElectron;

export function useWorkTracker() {
  const initialUiState = getInitialUiState();
  const today = new Date();

  const DEFAULT_HOURLY_RATE = 15;
  const DEFAULT_TAX_PERCENT = 0;
  const DEFAULT_DEFAULT_HOURS = 8;
  const DEFAULT_CURRENCY: CurrencyCode = "GBP";
  const DEFAULT_SECONDARY_CURRENCY: CurrencyCode = "EUR";
  const DEFAULT_CONVERSION_RATE = 1;

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
  const [currency, setCurrency] = useState<CurrencyCode>(DEFAULT_CURRENCY);
  const [secondaryCurrency, setSecondaryCurrency] = useState<CurrencyCode>(
    DEFAULT_SECONDARY_CURRENCY,
  );
  const [conversionRate, setConversionRate] = useState<number>(
    DEFAULT_CONVERSION_RATE,
  );
  const [taxPercent, setTaxPercent] = useState<number>(0);
  const [extraDeduction, setExtraDeduction] = useState<number>(0);
  const [payslipStartDay, setPayslipStartDay] = useState<number>(21);
  const [defaultHours, setDefaultHours] = useState<number>(8);
  const [exceptions, setExceptions] = useState<Record<string, ExceptionType>>(
    {},
  );
  const [dailyHours, setDailyHours] = useState<Record<string, number>>({});
  const [extraHours, setExtraHours] = useState<Record<string, number>>({});
  const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>([]);
  const [savedMonths, setSavedMonths] = useState<string[]>([]);
  const [lastSavedAt, setLastSavedAt] = useState<string>("");
  const [isMonthHydrated, setIsMonthHydrated] = useState<boolean>(false);
  const [graphYear, setGraphYear] = useState<number>(initialUiState.graphYear);

  const [fileInitialized, setFileInitialized] = useState<boolean>(!isFileMode);
  const [filePath, setFilePath] = useState<string>("");

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

  const populateLocalStorageFromFile = (payload: DataFile) => {
    if (payload.settings) {
      safeStorageSetItem(SETTINGS_KEY, JSON.stringify(payload.settings));
    }
    if (payload.uiState) {
      safeStorageSetItem(UI_STATE_KEY, JSON.stringify(payload.uiState));
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
        JSON.stringify(payload.activityLog.slice(0, 200)),
      );
    }
    if (payload.months && typeof payload.months === "object") {
      Object.entries(payload.months).forEach(([mk, data]) => {
        if (/^\d{4}-\d{2}$/.test(mk)) {
          safeStorageSetItem(`tracker-${mk}`, JSON.stringify(data));
        }
      });
    }
  };

  const buildFilePayload = useCallback(
    (
      currentMonthKey: string,
      currentGraphYear: number,
      currentPayslipStartDay: number,
      currentSavedMonths: string[],
      currentActivityLog: ActivityLogEntry[],
      currentMonthData: TrackerData,
    ): DataFile => {
      const months: Record<string, TrackerData> = {};
      const allMonths = currentSavedMonths.includes(currentMonthKey)
        ? currentSavedMonths
        : [...currentSavedMonths, currentMonthKey];

      allMonths.forEach((mk) => {
        if (mk === currentMonthKey) {
          months[mk] = currentMonthData;
          return;
        }
        const raw = safeStorageGetItem(`tracker-${mk}`);
        if (raw) {
          try {
            months[mk] = JSON.parse(raw) as TrackerData;
          } catch {
            // skip corrupt entry
          }
        }
      });

      return {
        version: 1,
        savedAt: new Date().toISOString(),
        uiState: { monthKey: currentMonthKey, graphYear: currentGraphYear },
        settings: { payslipStartDay: currentPayslipStartDay },
        savedMonths: currentSavedMonths,
        activityLog: currentActivityLog,
        months,
      };
    },
    [],
  );

  const fileWritePendingRef = useRef(false);

  const getSavedMonthKeys = () => {
    const rawSavedMonths = safeStorageGetItem(SAVED_MONTHS_KEY);
    if (!rawSavedMonths) {
      return [] as string[];
    }

    try {
      const parsed = JSON.parse(rawSavedMonths) as unknown;
      if (!Array.isArray(parsed)) {
        return [] as string[];
      }
      return parsed.filter(
        (month): month is string =>
          typeof month === "string" && /^\d{4}-\d{2}$/.test(month),
      );
    } catch {
      return [] as string[];
    }
  };

  const getCarryForwardGlobalValues = (targetMonth: string) => {
    const priorMonths = getSavedMonthKeys()
      .filter((mk) => mk <= targetMonth)
      .sort()
      .reverse();

    for (const mk of priorMonths) {
      const raw = safeStorageGetItem(`tracker-${mk}`);
      if (!raw) {
        continue;
      }

      try {
        const data = JSON.parse(raw) as Partial<TrackerData>;
        if (
          typeof data.hourlyRate === "number" &&
          typeof data.taxPercent === "number"
        ) {
          return {
            hourlyRate: Math.max(0, data.hourlyRate),
            taxPercent: clampPercent(data.taxPercent),
            defaultHours:
              typeof data.defaultHours === "number"
                ? Math.max(0, data.defaultHours)
                : DEFAULT_DEFAULT_HOURS,
            currency: data.currency ?? DEFAULT_CURRENCY,
            secondaryCurrency:
              data.secondaryCurrency ?? DEFAULT_SECONDARY_CURRENCY,
            conversionRate:
              typeof data.conversionRate === "number"
                ? Math.max(0, data.conversionRate)
                : DEFAULT_CONVERSION_RATE,
          };
        }
      } catch {
        // ignore corrupted month data and continue
      }
    }

    return {
      hourlyRate: DEFAULT_HOURLY_RATE,
      taxPercent: DEFAULT_TAX_PERCENT,
      defaultHours: DEFAULT_DEFAULT_HOURS,
      currency: DEFAULT_CURRENCY,
      secondaryCurrency: DEFAULT_SECONDARY_CURRENCY,
      conversionRate: DEFAULT_CONVERSION_RATE,
    };
  };

  const updateCurrentAndFutureMonthsGlobalValue = (
    field: "hourlyRate" | "taxPercent" | "defaultHours" | "conversionRate",
    value: number,
  ) => {
    const monthsToUpdate = getSavedMonthKeys().filter((mk) => mk >= monthKey);

    monthsToUpdate.forEach((mk) => {
      const raw = safeStorageGetItem(`tracker-${mk}`);
      if (!raw) {
        return;
      }

      try {
        const data = JSON.parse(raw) as TrackerData;
        const nextData: TrackerData = {
          ...data,
          [field]: value,
        };
        safeStorageSetItem(`tracker-${mk}`, JSON.stringify(nextData));
      } catch {
        // ignore corrupted month data
      }
    });
  };

  const updateCurrentAndFutureMonthsCurrency = (
    field: "currency" | "secondaryCurrency",
    value: CurrencyCode,
  ) => {
    const monthsToUpdate = getSavedMonthKeys().filter((mk) => mk >= monthKey);

    monthsToUpdate.forEach((mk) => {
      const raw = safeStorageGetItem(`tracker-${mk}`);
      if (!raw) {
        return;
      }

      try {
        const data = JSON.parse(raw) as TrackerData;
        const nextData: TrackerData = { ...data, [field]: value };
        safeStorageSetItem(`tracker-${mk}`, JSON.stringify(nextData));
      } catch {
        // ignore corrupted month data
      }
    });
  };

  const initializeFromFile = useCallback(
    (payload: DataFile, path: string) => {
      populateLocalStorageFromFile(payload);

      if (payload.settings) {
        setPayslipStartDay(clampDay(payload.settings.payslipStartDay ?? 21));
      }
      if (payload.uiState) {
        setMonthKey(payload.uiState.monthKey);
        setGraphYear(payload.uiState.graphYear);
      }
      if (Array.isArray(payload.savedMonths)) {
        setSavedMonths(payload.savedMonths);
      }
      if (Array.isArray(payload.activityLog)) {
        setActivityLog(payload.activityLog.slice(0, 200));
      }

      setFilePath(path);
      setFileInitialized(true);
    },
    [],
  );

  const tryLoadRememberedFile = useCallback(async () => {
    if (!isFileMode) return;
    const path = await window.fileAPI!.getRememberedPath();
    if (!path) return;
    const raw = await window.fileAPI!.readFile();
    if (!raw) return;
    try {
      const payload = JSON.parse(raw) as DataFile;
      if (payload.version === 1) {
        initializeFromFile(payload, path);
      }
    } catch {
      // corrupted file — stay on picker screen
    }
  }, [initializeFromFile]);

  useEffect(() => {
    void tryLoadRememberedFile();
  }, [tryLoadRememberedFile]);

  const chooseExistingFile = useCallback(async () => {
    const path = await window.fileAPI!.openDialog();
    if (!path) return;
    await window.fileAPI!.setRememberedPath(path);
    const raw = await window.fileAPI!.readFile();
    if (raw) {
      try {
        const payload = JSON.parse(raw) as DataFile;
        if (payload.version === 1) {
          initializeFromFile(payload, path);
          return;
        }
      } catch {
        // fall through to fresh init
      }
    }
    const emptyPayload: DataFile = {
      version: 1,
      savedAt: new Date().toISOString(),
      uiState: { monthKey, graphYear },
      settings: { payslipStartDay },
      savedMonths: [],
      activityLog: [],
      months: {},
    };
    initializeFromFile(emptyPayload, path);
  }, [monthKey, graphYear, payslipStartDay, initializeFromFile]);

  const createNewFile = useCallback(async () => {
    const path = await window.fileAPI!.saveDialog();
    if (!path) return;
    await window.fileAPI!.setRememberedPath(path);
    const emptyPayload: DataFile = {
      version: 1,
      savedAt: new Date().toISOString(),
      uiState: { monthKey, graphYear },
      settings: { payslipStartDay },
      savedMonths: [],
      activityLog: [],
      months: {},
    };
    await window.fileAPI!.writeFile(JSON.stringify(emptyPayload, null, 2));
    initializeFromFile(emptyPayload, path);
  }, [monthKey, graphYear, payslipStartDay, initializeFromFile]);

  const changeFile = useCallback(async () => {
    setFileInitialized(false);
    await chooseExistingFile();
  }, [chooseExistingFile]);

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
    const clamped = Math.max(0, value || 0);
    setHourlyRate(clamped);
    updateCurrentAndFutureMonthsGlobalValue("hourlyRate", clamped);
    addActivity("value-change", `Updated hourly rate to ${clamped}`);
  };

  const onCurrencyChange = (value: CurrencyCode) => {
    setCurrency(value);
    updateCurrentAndFutureMonthsCurrency("currency", value);
    addActivity("value-change", `Updated currency to ${value}`);
  };

  const onSecondaryCurrencyChange = (value: CurrencyCode) => {
    setSecondaryCurrency(value);
    updateCurrentAndFutureMonthsCurrency("secondaryCurrency", value);
    addActivity("value-change", `Updated secondary currency to ${value}`);
  };

  const onConversionRateChange = (value: number) => {
    const clamped = Math.max(0, value || 0);
    setConversionRate(clamped);
    updateCurrentAndFutureMonthsGlobalValue("conversionRate", clamped);
    addActivity("value-change", `Updated conversion rate to ${clamped}`);
  };

  const onTaxPercentChange = (value: number) => {
    const clamped = clampPercent(value);
    setTaxPercent(clamped);
    updateCurrentAndFutureMonthsGlobalValue("taxPercent", clamped);
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

  const onDefaultHoursChange = (value: number) => {
    const next = Math.max(0, value || 0);
    setDefaultHours(next);
    updateCurrentAndFutureMonthsGlobalValue("defaultHours", next);
    addActivity("value-change", `Updated holiday hours/day to ${next}`);
  };

  useEffect(() => {
    if (isFileMode) return;

    const rawSettings = safeStorageGetItem(SETTINGS_KEY);
    if (rawSettings) {
      try {
        const parsed = JSON.parse(rawSettings) as Partial<TrackerSettings>;
        setPayslipStartDay(clampDay(parsed.payslipStartDay ?? 21));
      } catch {
        safeStorageRemoveItem(SETTINGS_KEY);
      }
    }

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
    safeStorageSetItem(
      SETTINGS_KEY,
      JSON.stringify({ payslipStartDay } satisfies TrackerSettings),
    );
  }, [payslipStartDay]);

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
    // In file mode, wait for the remembered/chosen file to actually finish
    // loading before hydrating a month. Otherwise this can run once with
    // whatever (possibly empty) localStorage cache exists pre-load, decide
    // the month has no data, and write defaults into that month's cache
    // before the real file data has populated it — permanently masking the
    // real data once the file does load (the write "sticks" as if it were a
    // real saved month).
    if (isFileMode && !fileInitialized) {
      return;
    }

    setIsMonthHydrated(false);

    const saved = safeStorageGetItem(`tracker-${monthKey}`);
    const legacyData = saved ? null : null;

    if (!saved && !legacyData) {
      const carryForward = getCarryForwardGlobalValues(monthKey);
      setSelectedDays(["mon", "tue", "wed", "thu", "fri"]);
      setHoursPerDay(8);
      setHourlyRate(carryForward.hourlyRate);
      setCurrency(carryForward.currency);
      setSecondaryCurrency(carryForward.secondaryCurrency);
      setConversionRate(carryForward.conversionRate);
      setTaxPercent(carryForward.taxPercent);
      setExtraDeduction(0);
      setDefaultHours(carryForward.defaultHours);
      setExceptions({});
      setDailyHours({});
      setExtraHours({});
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
      setCurrency(data.currency ?? DEFAULT_CURRENCY);
      setSecondaryCurrency(data.secondaryCurrency ?? DEFAULT_SECONDARY_CURRENCY);
      setConversionRate(
        typeof data.conversionRate === "number"
          ? data.conversionRate
          : DEFAULT_CONVERSION_RATE,
      );
      setTaxPercent(data.taxPercent ?? 0);
      setExtraDeduction(data.extraDeduction ?? 0);
      setDefaultHours(
        typeof data.defaultHours === "number"
          ? data.defaultHours
          : getCarryForwardGlobalValues(monthKey).defaultHours,
      );
      setExceptions(data.exceptions ?? {});
      setDailyHours(data.dailyHours ?? {});
      setExtraHours(data.extraHours ?? {});
    } catch {
      safeStorageRemoveItem(`tracker-${monthKey}`);
      const carryForward = getCarryForwardGlobalValues(monthKey);
      setSelectedDays(["mon", "tue", "wed", "thu", "fri"]);
      setHoursPerDay(8);
      setHourlyRate(carryForward.hourlyRate);
      setCurrency(carryForward.currency);
      setSecondaryCurrency(carryForward.secondaryCurrency);
      setConversionRate(carryForward.conversionRate);
      setTaxPercent(carryForward.taxPercent);
      setExtraDeduction(0);
      setDefaultHours(carryForward.defaultHours);
      setExceptions({});
      setDailyHours({});
      setExtraHours({});
    } finally {
      setIsMonthHydrated(true);
    }
  }, [monthKey, fileInitialized]);

  useEffect(() => {
    if (!isMonthHydrated) {
      return;
    }

    const data: TrackerData = {
      selectedDays,
      hoursPerDay,
      hourlyRate,
      currency,
      secondaryCurrency,
      conversionRate,
      taxPercent,
      extraDeduction,
      defaultHours,
      exceptions,
      dailyHours,
      extraHours,
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
    currency,
    secondaryCurrency,
    conversionRate,
    taxPercent,
    extraDeduction,
    defaultHours,
    exceptions,
    dailyHours,
    extraHours,
    monthKey,
    isMonthHydrated,
  ]);

  useEffect(() => {
    if (!isFileMode || !fileInitialized || !isMonthHydrated) return;
    if (fileWritePendingRef.current) return;

    fileWritePendingRef.current = true;

    const currentMonthData: TrackerData = {
      selectedDays,
      hoursPerDay,
      hourlyRate,
      currency,
      secondaryCurrency,
      conversionRate,
      taxPercent,
      extraDeduction,
      defaultHours,
      exceptions,
      dailyHours,
      extraHours,
    };

    const payload = buildFilePayload(
      monthKey,
      graphYear,
      payslipStartDay,
      savedMonths,
      activityLog,
      currentMonthData,
    );

    void window.fileAPI!.writeFile(JSON.stringify(payload, null, 2)).finally(
      () => {
        fileWritePendingRef.current = false;
      },
    );
  }, [
    isFileMode,
    fileInitialized,
    isMonthHydrated,
    selectedDays,
    hoursPerDay,
    hourlyRate,
    currency,
    secondaryCurrency,
    conversionRate,
    taxPercent,
    extraDeduction,
    defaultHours,
    exceptions,
    dailyHours,
    extraHours,
    monthKey,
    graphYear,
    payslipStartDay,
    savedMonths,
    activityLog,
    buildFilePayload,
  ]);

  const workingDates = useMemo(() => {
    const rangeDates = getDatesInPayslipRange(monthKey, payslipStartDay);
    return rangeDates.filter((date) =>
      selectedDays.includes(weekdayMap[date.getDay()]),
    );
  }, [monthKey, payslipStartDay, selectedDays]);

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

  const workingDateLookup = useMemo(() => {
    const lookup = new Set<string>();
    workingDates.forEach((date) => {
      lookup.add(dateKey(date));
    });
    return lookup;
  }, [workingDates]);

  const payslipDateLookup = useMemo(() => {
    const lookup = new Set<string>();
    const rangeDates = getDatesInPayslipRange(monthKey, payslipStartDay);
    rangeDates.forEach((date) => {
      lookup.add(dateKey(date));
    });
    return lookup;
  }, [monthKey, payslipStartDay]);

  const extraHoursTotal = useMemo(() => {
    const rangeDates = getDatesInPayslipRange(monthKey, payslipStartDay);
    return rangeDates.reduce((total, date) => {
      const key = dateKey(date);
      if (workingDateLookup.has(key)) {
        return total;
      }
      return total + clampHours(extraHours[key] ?? 0);
    }, 0);
  }, [monthKey, payslipStartDay, workingDateLookup, extraHours]);

  const actualHours = useMemo(
    () =>
      workingDates.reduce((total, date) => {
        const key = dateKey(date);
        if (exceptions[key] === "sick") {
          return total;
        }
        if (exceptions[key] === "vacation") {
          const manualHours = dailyHours[key] ?? 0;
          return total + defaultHours + clampHours(manualHours);
        }
        const dayHours = dailyHours[key] ?? hoursPerDay;
        return total + clampHours(dayHours);
      }, extraHoursTotal),
    [
      workingDates,
      exceptions,
      dailyHours,
      hoursPerDay,
      defaultHours,
      extraHoursTotal,
    ],
  );

  const estimatedHours = workingDates.length * hoursPerDay;
  const grossSalary = actualHours * hourlyRate;
  const taxAmount = grossSalary * (clampPercent(taxPercent) / 100);
  const extraDeductionAmount = Math.max(0, extraDeduction);
  const netSalary = Math.max(0, grossSalary - taxAmount - extraDeductionAmount);
  const convertedGrossSalary = grossSalary * conversionRate;
  const convertedNetSalary = netSalary * conversionRate;
  const convertedTaxAmount = taxAmount * conversionRate;
  const convertedExtraDeductionAmount = extraDeductionAmount * conversionRate;

  const setDayException = (key: string, type: ExceptionType | "none") => {
    if (!workingDateLookup.has(key)) {
      return;
    }

    setExceptions((previous) => {
      const next = { ...previous };
      if (type === "none" || previous[key] === type) {
        delete next[key];
        addActivity("exception-change", `Cleared mark on ${key}`);
      } else {
        next[key] = type;
        addActivity("exception-change", `Marked ${key} as ${type}`);
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

  const updateExtraHours = (key: string, value: number) => {
    if (!payslipDateLookup.has(key) || workingDateLookup.has(key)) {
      return;
    }

    const nextValue = clampHours(value);
    setExtraHours((previous) => {
      if (nextValue === 0) {
        const { [key]: _removed, ...rest } = previous;
        return rest;
      }
      return { ...previous, [key]: nextValue };
    });
    addActivity("hours-change", `Logged ${nextValue} extra hours on ${key}`);
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
      const legacyData = null;

      if (dataStr || legacyData) {
        try {
          const data: TrackerData = dataStr ? JSON.parse(dataStr) : legacyData;
          const rangeDates = getDatesInPayslipRange(mKey, payslipStartDay);

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
                  (data.defaultHours ?? DEFAULT_DEFAULT_HOURS) +
                  clampHours(manualHours);
              } else {
                const hours = data.dailyHours[key] ?? data.hoursPerDay;
                totalActualHours += clampHours(hours);
              }
            } else if (!isWorkingDay) {
              totalActualHours += clampHours(data.extraHours?.[key] ?? 0);
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
  }, [graphYear, monthKey, actualHours, payslipStartDay]);

  const calendarCells = useMemo(() => {
    const rangeDates = getDatesInPayslipRange(monthKey, payslipStartDay);
    const cells: Array<Date | null> = [];

    if (rangeDates.length === 0) {
      return cells;
    }

    const firstDate = rangeDates[0];
    // Monday-first offset: Date#getDay() is Sunday-indexed (0=Sun..6=Sat).
    const dayOfWeek = (firstDate.getDay() + 6) % 7;
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
  }, [monthKey, payslipStartDay]);

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
    const currentMonthData: TrackerData = {
      selectedDays,
      hoursPerDay,
      hourlyRate,
      currency,
      secondaryCurrency,
      conversionRate,
      taxPercent,
      extraDeduction,
      defaultHours,
      exceptions,
      dailyHours,
      extraHours,
    };

    const payload = buildFilePayload(
      monthKey,
      graphYear,
      payslipStartDay,
      savedMonths,
      activityLog,
      currentMonthData,
    );

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
        const payload = JSON.parse(text) as DataFile;

        if (payload.version !== 1) {
          alert("Unsupported backup format version.");
          return;
        }

        populateLocalStorageFromFile(payload);

        if (isFileMode) {
          initializeFromFile(payload, filePath);
        } else {
          window.location.reload();
        }
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
    currency,
    secondaryCurrency,
    conversionRate,
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
    onCurrencyChange,
    onSecondaryCurrencyChange,
    onConversionRateChange,
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
  };
}
