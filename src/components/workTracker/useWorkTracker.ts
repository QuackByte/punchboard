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
  TimeEntry,
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
  formatClock,
  formatMonthKey,
  getCurrentPayslipEndMonthKey,
  getDatesInPayslipRange,
  getInitialUiState,
  minutesSinceMidnight,
  parseDayInput,
  parseMonthKey,
  safeStorageGetItem,
  safeStorageRemoveItem,
  safeStorageSetItem,
  sumEntriesHours,
} from "./utils";
import {
  BrowserDataFileHandle,
  chooseExistingDataFile,
  chooseNewOrExistingDataFile,
  forgetDataFile,
  getRememberedDataFile,
  hasDataFilePermission,
  readDataFile,
  rememberDataFile,
  supportsBrowserDataFiles,
  writeDataFile,
} from "./browserDataFile";

function parseDataFile(raw: string) {
  const payload = JSON.parse(raw) as DataFile;
  if (
    payload.version !== 1 ||
    !payload.months ||
    typeof payload.months !== "object"
  ) {
    throw new Error("This is not a supported Punchboard data file.");
  }
  return payload;
}

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
  const DEFAULT_CURRENCY_CONVERSION_ENABLED = false;

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
  const [currencyConversionEnabled, setCurrencyConversionEnabled] =
    useState<boolean>(DEFAULT_CURRENCY_CONVERSION_ENABLED);
  const [taxPercent, setTaxPercent] = useState<number>(0);
  const [extraDeduction, setExtraDeduction] = useState<number>(0);
  const [payslipStartDay, setPayslipStartDay] = useState<number>(21);
  const [defaultHours, setDefaultHours] = useState<number>(8);
  const [exceptions, setExceptions] = useState<Record<string, ExceptionType>>(
    {},
  );
  const [dailyHours, setDailyHours] = useState<Record<string, number>>({});
  const [extraHours, setExtraHours] = useState<Record<string, number>>({});
  const [timeEntries, setTimeEntries] = useState<Record<string, TimeEntry[]>>(
    {},
  );
  const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>([]);
  const [savedMonths, setSavedMonths] = useState<string[]>([]);
  const [lastSavedAt, setLastSavedAt] = useState<string>("");
  const [isMonthHydrated, setIsMonthHydrated] = useState<boolean>(false);
  const [hydratedMonthKey, setHydratedMonthKey] = useState<string | null>(null);
  const [graphYear, setGraphYear] = useState<number>(initialUiState.graphYear);

  const [fileInitialized, setFileInitialized] = useState<boolean>(!isFileMode);
  const [filePath, setFilePath] = useState<string>("");
  const browserFileSupported = !isFileMode && supportsBrowserDataFiles();
  const [browserFileHandle, setBrowserFileHandle] =
    useState<BrowserDataFileHandle | null>(null);
  const [browserFileNeedsPermission, setBrowserFileNeedsPermission] =
    useState(false);
  const [browserFileError, setBrowserFileError] = useState<string | null>(null);
  const [startupAvailable, setStartupAvailable] = useState(false);
  const [openAtLogin, setOpenAtLogin] = useState(false);
  const [startupError, setStartupError] = useState<string | null>(null);
  const [trayPunchPending, setTrayPunchPending] = useState(false);
  const [fileLoadVersion, setFileLoadVersion] = useState(0);
  const activeBrowserFileHandleRef =
    useRef<BrowserDataFileHandle | null>(null);
  const browserFileContentsRef = useRef<string | null>(null);
  const browserFileWriteBlockedRef = useRef(false);

  useEffect(() => {
    const desktop = window.desktop;
    if (!desktop?.isElectron) return;
    let active = true;
    const unsubscribe = desktop.onOpenAtLoginChanged(setOpenAtLogin);
    void desktop
      .getStartupConfig()
      .then((config) => {
        if (!active) return;
        setStartupAvailable(config.available);
        setOpenAtLogin(config.openAtLogin);
      })
      .catch((error: unknown) => {
        if (active) {
          setStartupError(
            error instanceof Error ? error.message : "Could not load startup setting.",
          );
        }
      });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const changeOpenAtLogin = useCallback(async (enabled: boolean) => {
    if (!window.desktop?.isElectron) return;
    setStartupError(null);
    try {
      const result = await window.desktop.setOpenAtLogin(enabled);
      setOpenAtLogin(result.openAtLogin);
      setStartupError(result.message ?? null);
    } catch (error) {
      setStartupError(
        error instanceof Error ? error.message : "Could not update startup setting.",
      );
    }
  }, []);

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
        savedMonths: allMonths,
        activityLog: currentActivityLog,
        months,
      };
    },
    [],
  );

  const fileWriteInFlightRef = useRef(false);
  const pendingFilePayloadRef = useRef<string | null>(null);

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
            currencyConversionEnabled:
              data.currencyConversionEnabled ??
              DEFAULT_CURRENCY_CONVERSION_ENABLED,
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
      currencyConversionEnabled: DEFAULT_CURRENCY_CONVERSION_ENABLED,
    };
  };

  /**
   * Rate/tax/currency settings carry forward: changing them in one month
   * also rewrites every already-saved later month.
   */
  const updateCurrentAndFutureMonths = <
    K extends
      | "hourlyRate"
      | "taxPercent"
      | "defaultHours"
      | "conversionRate"
      | "currency"
      | "secondaryCurrency"
      | "currencyConversionEnabled",
  >(
    field: K,
    value: TrackerData[K],
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

  const loadBrowserDataFile = useCallback(
    (handle: BrowserDataFileHandle, raw: string) => {
      const payload = parseDataFile(raw);
      activeBrowserFileHandleRef.current = handle;
      browserFileContentsRef.current = raw;
      browserFileWriteBlockedRef.current = false;
      setBrowserFileHandle(handle);
      setBrowserFileNeedsPermission(false);
      setBrowserFileError(null);
      setIsMonthHydrated(false);
      initializeFromFile(payload, handle.name);
      setFileLoadVersion((version) => version + 1);
    },
    [initializeFromFile],
  );

  useEffect(() => {
    if (!browserFileSupported) return;

    let active = true;
    void getRememberedDataFile()
      .then(async (handle) => {
        if (!active || !handle) return;

        setBrowserFileHandle(handle);
        setFilePath(handle.name);
        if (!(await hasDataFilePermission(handle))) {
          if (active) setBrowserFileNeedsPermission(true);
          return;
        }

        const raw = await readDataFile(handle);
        if (active) loadBrowserDataFile(handle, raw);
      })
      .catch((error: unknown) => {
        if (active) {
          setBrowserFileError(
            error instanceof Error
              ? error.message
              : "Could not reopen the shared data file.",
          );
        }
      });

    return () => {
      active = false;
    };
  }, [browserFileSupported, loadBrowserDataFile]);

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
    updateCurrentAndFutureMonths("hourlyRate", clamped);
    addActivity("value-change", `Updated hourly rate to ${clamped}`);
  };

  const onCurrencyChange = (value: CurrencyCode) => {
    setCurrency(value);
    updateCurrentAndFutureMonths("currency", value);
    addActivity("value-change", `Updated currency to ${value}`);
  };

  const onSecondaryCurrencyChange = (value: CurrencyCode) => {
    setSecondaryCurrency(value);
    updateCurrentAndFutureMonths("secondaryCurrency", value);
    addActivity("value-change", `Updated secondary currency to ${value}`);
  };

  const onConversionRateChange = (value: number) => {
    const clamped = Math.max(0, value || 0);
    setConversionRate(clamped);
    updateCurrentAndFutureMonths("conversionRate", clamped);
    addActivity("value-change", `Updated conversion rate to ${clamped}`);
  };

  const onCurrencyConversionEnabledChange = (value: boolean) => {
    setCurrencyConversionEnabled(value);
    updateCurrentAndFutureMonths("currencyConversionEnabled", value);
    addActivity(
      "value-change",
      `${value ? "Enabled" : "Disabled"} currency conversion`,
    );
  };

  const onTaxPercentChange = (value: number) => {
    const clamped = clampPercent(value);
    setTaxPercent(clamped);
    updateCurrentAndFutureMonths("taxPercent", clamped);
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
    updateCurrentAndFutureMonths("defaultHours", next);
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

    if (!saved) {
      const carryForward = getCarryForwardGlobalValues(monthKey);
      setSelectedDays(["mon", "tue", "wed", "thu", "fri"]);
      setHoursPerDay(8);
      setHourlyRate(carryForward.hourlyRate);
      setCurrency(carryForward.currency);
      setSecondaryCurrency(carryForward.secondaryCurrency);
      setConversionRate(carryForward.conversionRate);
      setCurrencyConversionEnabled(carryForward.currencyConversionEnabled);
      setTaxPercent(carryForward.taxPercent);
      setExtraDeduction(0);
      setDefaultHours(carryForward.defaultHours);
      setExceptions({});
      setDailyHours({});
      setExtraHours({});
      setTimeEntries({});
      setIsMonthHydrated(true);
      return;
    }

    try {
      const data = JSON.parse(saved) as TrackerData;

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
      setCurrencyConversionEnabled(
        data.currencyConversionEnabled ?? DEFAULT_CURRENCY_CONVERSION_ENABLED,
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
      setTimeEntries(data.timeEntries ?? {});
    } catch {
      safeStorageRemoveItem(`tracker-${monthKey}`);
      const carryForward = getCarryForwardGlobalValues(monthKey);
      setSelectedDays(["mon", "tue", "wed", "thu", "fri"]);
      setHoursPerDay(8);
      setHourlyRate(carryForward.hourlyRate);
      setCurrency(carryForward.currency);
      setSecondaryCurrency(carryForward.secondaryCurrency);
      setConversionRate(carryForward.conversionRate);
      setCurrencyConversionEnabled(carryForward.currencyConversionEnabled);
      setTaxPercent(carryForward.taxPercent);
      setExtraDeduction(0);
      setDefaultHours(carryForward.defaultHours);
      setExceptions({});
      setDailyHours({});
      setExtraHours({});
      setTimeEntries({});
    } finally {
      setIsMonthHydrated(true);
      setHydratedMonthKey(monthKey);
    }
  }, [monthKey, fileInitialized, fileLoadVersion]);

  const currentMonthData = useMemo<TrackerData>(
    () => ({
      selectedDays,
      hoursPerDay,
      hourlyRate,
      currency,
      secondaryCurrency,
      conversionRate,
      currencyConversionEnabled,
      taxPercent,
      extraDeduction,
      defaultHours,
      exceptions,
      dailyHours,
      extraHours,
      timeEntries,
    }),
    [
      selectedDays,
      hoursPerDay,
      hourlyRate,
      currency,
      secondaryCurrency,
      conversionRate,
      currencyConversionEnabled,
      taxPercent,
      extraDeduction,
      defaultHours,
      exceptions,
      dailyHours,
      extraHours,
      timeEntries,
    ],
  );

  const connectBrowserDataFile = useCallback(async () => {
    if (!browserFileSupported) return;
    if (fileWriteInFlightRef.current) {
      window.alert("Wait for the current autosave to finish before changing files.");
      return;
    }

    try {
      const handle = await chooseExistingDataFile();
      if (!handle) return;
      if (!(await hasDataFilePermission(handle, true))) {
        await rememberDataFile(handle);
        activeBrowserFileHandleRef.current = null;
        setBrowserFileHandle(handle);
        setFilePath(handle.name);
        setBrowserFileNeedsPermission(true);
        return;
      }

      const raw = await readDataFile(handle);
      parseDataFile(raw);
      if (
        savedMonths.length > 0 &&
        !window.confirm(
          `Load data from ${handle.name} into this browser? This replaces the data currently stored in this browser. Export a backup first if you want to keep it.`,
        )
      ) {
        return;
      }

      await rememberDataFile(handle);
      loadBrowserDataFile(handle, raw);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setBrowserFileError(
        error instanceof Error ? error.message : "Could not open the data file.",
      );
    }
  }, [browserFileSupported, loadBrowserDataFile, savedMonths.length]);

  const saveBrowserDataToFile = useCallback(async () => {
    if (!browserFileSupported) return;
    if (fileWriteInFlightRef.current) {
      window.alert("Wait for the current autosave to finish before changing files.");
      return;
    }

    try {
      const handle = await chooseNewOrExistingDataFile();
      if (!(await hasDataFilePermission(handle, true))) {
        setBrowserFileError(
          "Write permission was not granted. Select the file again to save browser data.",
        );
        return;
      }

      const existingFile = await handle.getFile();
      if (
        existingFile.size > 0 &&
        !window.confirm(
          `Replace ${handle.name} with this browser's data? This overwrites the current file contents.`,
        )
      ) {
        return;
      }

      const payload = buildFilePayload(
        monthKey,
        graphYear,
        payslipStartDay,
        savedMonths,
        activityLog,
        currentMonthData,
      );
      const contents = JSON.stringify(payload, null, 2);
      await writeDataFile(handle, contents);
      await rememberDataFile(handle);
      activeBrowserFileHandleRef.current = handle;
      browserFileContentsRef.current = contents;
      browserFileWriteBlockedRef.current = false;
      setBrowserFileHandle(handle);
      setBrowserFileNeedsPermission(false);
      setBrowserFileError(null);
      setFilePath(handle.name);
      setLastSavedAt(new Date().toISOString());
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setBrowserFileError(
        error instanceof Error ? error.message : "Could not save to the data file.",
      );
    }
  }, [
    activityLog,
    browserFileSupported,
    buildFilePayload,
    currentMonthData,
    graphYear,
    monthKey,
    payslipStartDay,
    savedMonths,
  ]);

  const reconnectBrowserDataFile = useCallback(async () => {
    if (!browserFileHandle) return;
    if (fileWriteInFlightRef.current) {
      window.alert("Wait for the current autosave to finish before reconnecting.");
      return;
    }

    try {
      if (!(await hasDataFilePermission(browserFileHandle, true))) {
        setBrowserFileNeedsPermission(true);
        return;
      }
      const raw = await readDataFile(browserFileHandle);
      parseDataFile(raw);
      if (
        savedMonths.length > 0 &&
        !window.confirm(
          `Reload ${browserFileHandle.name}? This replaces the data currently stored in this browser.`,
        )
      ) {
        return;
      }
      await rememberDataFile(browserFileHandle);
      loadBrowserDataFile(browserFileHandle, raw);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setBrowserFileError(
        error instanceof Error ? error.message : "Could not reconnect the data file.",
      );
    }
  }, [browserFileHandle, loadBrowserDataFile, savedMonths.length]);

  const reloadBrowserDataFile = useCallback(async () => {
    if (!browserFileHandle) return;
    if (fileWriteInFlightRef.current) {
      window.alert("Wait for the current autosave to finish before reloading.");
      return;
    }

    try {
      const raw = await readDataFile(browserFileHandle);
      parseDataFile(raw);
      if (
        !window.confirm(
          `Reload ${browserFileHandle.name} and discard the unsaved browser changes?`,
        )
      ) {
        return;
      }
      loadBrowserDataFile(browserFileHandle, raw);
    } catch (error) {
      setBrowserFileError(
        error instanceof Error ? error.message : "Could not reload the data file.",
      );
    }
  }, [browserFileHandle, loadBrowserDataFile]);

  const overwriteBrowserDataFile = useCallback(async () => {
    if (!browserFileHandle) return;
    if (fileWriteInFlightRef.current) {
      window.alert("Wait for the current autosave to finish before overwriting.");
      return;
    }
    if (
      !window.confirm(
        `Overwrite ${browserFileHandle.name} with this browser's data?`,
      )
    ) {
      return;
    }

    try {
      const payload = buildFilePayload(
        monthKey,
        graphYear,
        payslipStartDay,
        savedMonths,
        activityLog,
        currentMonthData,
      );
      const contents = JSON.stringify(payload, null, 2);
      await writeDataFile(browserFileHandle, contents);
      browserFileContentsRef.current = contents;
      browserFileWriteBlockedRef.current = false;
      setBrowserFileError(null);
      setLastSavedAt(new Date().toISOString());
    } catch (error) {
      setBrowserFileNeedsPermission(
        error instanceof DOMException && error.name === "NotAllowedError",
      );
      setBrowserFileError(
        error instanceof Error ? error.message : "Could not overwrite the data file.",
      );
    }
  }, [
    activityLog,
    browserFileHandle,
    buildFilePayload,
    currentMonthData,
    graphYear,
    monthKey,
    payslipStartDay,
    savedMonths,
  ]);

  const disconnectBrowserDataFile = useCallback(async () => {
    if (fileWriteInFlightRef.current) {
      window.alert("Wait for the current autosave to finish before disconnecting.");
      return;
    }
    try {
      await forgetDataFile();
      activeBrowserFileHandleRef.current = null;
      browserFileContentsRef.current = null;
      browserFileWriteBlockedRef.current = false;
      setBrowserFileHandle(null);
      setBrowserFileNeedsPermission(false);
      setBrowserFileError(null);
      setFilePath("");
    } catch (error) {
      setBrowserFileError(
        error instanceof Error
          ? error.message
          : "Could not disconnect the selected file.",
      );
    }
  }, []);

  useEffect(() => {
    if (!isMonthHydrated) {
      return;
    }

    safeStorageSetItem(`tracker-${monthKey}`, JSON.stringify(currentMonthData));

    setSavedMonths((previous) => {
      if (previous.includes(monthKey)) {
        return previous;
      }
      const next = [...previous, monthKey].sort();
      safeStorageSetItem(SAVED_MONTHS_KEY, JSON.stringify(next));
      return next;
    });

    setLastSavedAt(new Date().toISOString());
  }, [currentMonthData, monthKey, isMonthHydrated]);

  useEffect(() => {
    if (
      (!isFileMode &&
        (!browserFileHandle ||
          browserFileNeedsPermission ||
          browserFileWriteBlockedRef.current)) ||
      !fileInitialized ||
      !isMonthHydrated
    ) {
      return;
    }

    const payload = buildFilePayload(
      monthKey,
      graphYear,
      payslipStartDay,
      savedMonths,
      activityLog,
      currentMonthData,
    );

    // Writes are serialized: if one is in flight, remember the latest payload
    // and write it once the current write finishes, so no edit is dropped.
    pendingFilePayloadRef.current = JSON.stringify(payload, null, 2);
    if (fileWriteInFlightRef.current) return;

    const flush = () => {
      const next = pendingFilePayloadRef.current;
      if (next === null) {
        fileWriteInFlightRef.current = false;
        return;
      }
      if (!isFileMode && browserFileWriteBlockedRef.current) {
        pendingFilePayloadRef.current = null;
        fileWriteInFlightRef.current = false;
        return;
      }
      pendingFilePayloadRef.current = null;
      fileWriteInFlightRef.current = true;
      void (async () => {
        try {
          if (isFileMode) {
            const written = await window.fileAPI!.writeFile(next);
            if (!written) throw new Error("Could not write the desktop data file.");
          } else {
            const handle = activeBrowserFileHandleRef.current;
            if (!handle) {
              pendingFilePayloadRef.current = null;
              return;
            }
            const currentContents = await readDataFile(handle);
            if (activeBrowserFileHandleRef.current !== handle) return;
            if (
              browserFileContentsRef.current !== null &&
              currentContents !== browserFileContentsRef.current
            ) {
              browserFileWriteBlockedRef.current = true;
              setBrowserFileError(
                "This file changed outside the browser. Reload it or explicitly overwrite it to continue syncing.",
              );
              return;
            }
            await writeDataFile(handle, next);
            if (activeBrowserFileHandleRef.current === handle) {
              browserFileContentsRef.current = next;
              setBrowserFileError(null);
            }
          }
          setLastSavedAt(new Date().toISOString());
        } catch (error) {
          if (!isFileMode) {
            browserFileWriteBlockedRef.current = true;
            setBrowserFileNeedsPermission(
              error instanceof DOMException && error.name === "NotAllowedError",
            );
            setBrowserFileError(
              error instanceof Error
                ? error.message
                : "Could not autosave the shared data file.",
            );
          }
        } finally {
          flush();
        }
      })();
    };
    flush();
  }, [
    browserFileHandle,
    browserFileNeedsPermission,
    fileInitialized,
    isMonthHydrated,
    currentMonthData,
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

  const dailyActualHours = useMemo(() => {
    const map: Record<string, number> = {};

    workingDates.forEach((date) => {
      const key = dateKey(date);
      if (exceptions[key] === "sick") {
        map[key] = 0;
        return;
      }
      if (exceptions[key] === "vacation") {
        const manualHours = dailyHours[key] ?? 0;
        map[key] = defaultHours + clampHours(manualHours);
        return;
      }
      map[key] = clampHours(dailyHours[key] ?? hoursPerDay);
    });

    const rangeDates = getDatesInPayslipRange(monthKey, payslipStartDay);
    rangeDates.forEach((date) => {
      const key = dateKey(date);
      if (workingDateLookup.has(key)) {
        return;
      }
      map[key] = clampHours(extraHours[key] ?? 0);
    });

    return map;
  }, [
    workingDates,
    exceptions,
    dailyHours,
    hoursPerDay,
    defaultHours,
    monthKey,
    payslipStartDay,
    workingDateLookup,
    extraHours,
  ]);

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

    // Logged outside the state updater so StrictMode's double-invoke
    // doesn't record the change twice.
    const clearing = type === "none" || exceptions[key] === type;
    setExceptions((previous) => {
      const next = { ...previous };
      if (clearing) {
        delete next[key];
      } else {
        next[key] = type;
      }
      return next;
    });
    addActivity(
      "exception-change",
      clearing ? `Cleared mark on ${key}` : `Marked ${key} as ${type}`,
    );
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

  /**
   * Replaces a day's clocked sessions and re-derives its hour total, so
   * every existing calculation (stats, week totals, yearly chart) keeps
   * working off dailyHours/extraHours.
   */
  const setDayEntries = (key: string, entries: TimeEntry[]) => {
    if (!payslipDateLookup.has(key)) {
      return;
    }

    // Not re-sorted here: the day editor edits rows in place, and reordering
    // while someone is typing a time would shuffle the focused row.
    const sorted = entries;
    const hours = clampHours(sumEntriesHours(sorted));

    setTimeEntries((previous) => {
      if (sorted.length === 0) {
        const { [key]: _removed, ...rest } = previous;
        return rest;
      }
      return { ...previous, [key]: sorted };
    });

    if (workingDateLookup.has(key)) {
      setDailyHours((previous) => {
        if (sorted.length === 0) {
          const { [key]: _removed, ...rest } = previous;
          return rest;
        }
        return { ...previous, [key]: hours };
      });
    } else {
      setExtraHours((previous) => {
        if (hours === 0) {
          const { [key]: _removed, ...rest } = previous;
          return rest;
        }
        return { ...previous, [key]: hours };
      });
    }

    addActivity(
      "hours-change",
      sorted.length === 0
        ? `Cleared sessions on ${key}`
        : `Logged ${sorted.length} session${sorted.length === 1 ? "" : "s"} on ${key}`,
    );
  };

  /** Sets a plain hour total for a day, dropping any clocked sessions. */
  const setDayTotal = (key: string, hours: number) => {
    setTimeEntries((previous) => {
      if (!previous[key]) {
        return previous;
      }
      const { [key]: _removed, ...rest } = previous;
      return rest;
    });

    if (workingDateLookup.has(key)) {
      updateDayHours(key, hours);
    } else {
      updateExtraHours(key, hours);
    }
  };

  /** Drops any override so a workday falls back to the scheduled hours. */
  const resetDay = (key: string) => {
    setTimeEntries((previous) => {
      const { [key]: _removed, ...rest } = previous;
      return rest;
    });
    setDailyHours((previous) => {
      const { [key]: _removed, ...rest } = previous;
      return rest;
    });
    setExtraHours((previous) => {
      const { [key]: _removed, ...rest } = previous;
      return rest;
    });
    addActivity("hours-change", `Reset ${key} to schedule`);
  };

  /**
   * Applies quick-entry text such as "9-13, 14-18" or "7.5". Returns false
   * when the text can't be parsed so the caller can flag the input.
   */
  const applyDayInput = (key: string, text: string) => {
    const parsed = parseDayInput(text);
    if (!parsed) {
      return false;
    }
    if (parsed.kind === "sessions") {
      setDayEntries(key, parsed.entries);
    } else {
      setDayTotal(key, parsed.hours);
    }
    return true;
  };

  const currentPeriodMonthKey = getCurrentPayslipEndMonthKey(
    today,
    payslipStartDay,
  );
  const isViewingCurrentPeriod = monthKey === currentPeriodMonthKey;
  const todayKey = dateKey(today);

  /** The (single) running session in the loaded period, if any. */
  const openSession = useMemo(() => {
    for (const [key, entries] of Object.entries(timeEntries)) {
      const index = entries.findIndex((entry) => entry.end === null);
      if (index !== -1) {
        return { key, index, entry: entries[index] };
      }
    }
    return null;
  }, [timeEntries]);

  const punchIn = () => {
    if (!isViewingCurrentPeriod || openSession) {
      return;
    }
    const entries = timeEntries[todayKey] ?? [];
    setDayEntries(todayKey, [
      ...entries,
      { start: formatClock(minutesSinceMidnight(new Date())), end: null },
    ]);
  };

  const punchOut = () => {
    if (!openSession || openSession.key !== todayKey) {
      return;
    }
    const now = formatClock(minutesSinceMidnight(new Date()));
    const entries = timeEntries[todayKey] ?? [];
    const next = entries
      .map((entry, index) =>
        index === openSession.index ? { ...entry, end: now } : entry,
      )
      // A punch in/out within the same minute isn't a real session.
      .filter((entry) => entry.start !== entry.end);
    setDayEntries(todayKey, next);
  };

  const handleTrayPunchToggle = useCallback(() => {
    if (!fileInitialized) {
      window.desktop?.showMainWindow();
      return;
    }
    if (openSession?.key === todayKey) {
      punchOut();
      return;
    }
    if (openSession) {
      window.desktop?.showMainWindow();
      return;
    }
    if (isViewingCurrentPeriod) {
      punchIn();
      return;
    }

    setMonthKey(currentPeriodMonthKey);
    setTrayPunchPending(true);
  }, [
    currentPeriodMonthKey,
    fileInitialized,
    isViewingCurrentPeriod,
    openSession,
    punchIn,
    punchOut,
    todayKey,
  ]);

  useEffect(() => {
    if (!window.desktop?.isElectron) return;
    return window.desktop.onTrayPunchToggle(handleTrayPunchToggle);
  }, [handleTrayPunchToggle]);

  useEffect(() => {
    if (
      !trayPunchPending ||
      !isViewingCurrentPeriod ||
      !isMonthHydrated ||
      hydratedMonthKey !== currentPeriodMonthKey
    ) {
      return;
    }
    setTrayPunchPending(false);
    if (openSession?.key === todayKey) punchOut();
    else if (!openSession) punchIn();
  }, [
    currentPeriodMonthKey,
    hydratedMonthKey,
    isMonthHydrated,
    isViewingCurrentPeriod,
    openSession,
    punchIn,
    punchOut,
    todayKey,
    trayPunchPending,
  ]);

  /**
   * Today's punch-clock state for the tray. While another month is open in
   * the main window, it comes from the saved current-period data instead.
   */
  const trayToday = useMemo(() => {
    if (isViewingCurrentPeriod) {
      return {
        entries: timeEntries[todayKey] ?? [],
        targetHours:
          workingDateLookup.has(todayKey) && !exceptions[todayKey]
            ? hoursPerDay
            : 0,
        openSession: openSession
          ? { key: openSession.key, entry: openSession.entry }
          : null,
      };
    }

    let stored: Partial<TrackerData> = {};
    try {
      stored = JSON.parse(
        safeStorageGetItem(`tracker-${currentPeriodMonthKey}`) ?? "{}",
      ) as Partial<TrackerData>;
    } catch {
      // fall back to the default schedule below
    }
    const storedEntries = stored.timeEntries ?? {};
    const days = stored.selectedDays ?? ["mon", "tue", "wed", "thu", "fri"];
    let storedOpen: { key: string; entry: TimeEntry } | null = null;
    for (const [key, entries] of Object.entries(storedEntries)) {
      const entry = entries.find((candidate) => candidate.end === null);
      if (entry) {
        storedOpen = { key, entry };
        break;
      }
    }

    return {
      entries: storedEntries[todayKey] ?? [],
      targetHours:
        days.includes(weekdayMap[today.getDay()]) &&
        !stored.exceptions?.[todayKey]
          ? (stored.hoursPerDay ?? 8)
          : 0,
      openSession: storedOpen,
    };
    // `today` changes identity every render; todayKey captures the date.
  }, [
    isViewingCurrentPeriod,
    timeEntries,
    todayKey,
    workingDateLookup,
    exceptions,
    hoursPerDay,
    openSession,
    currentPeriodMonthKey,
    lastSavedAt,
  ]);

  useEffect(() => {
    if (!window.desktop?.isElectron) return;
    const trayOpen = trayToday.openSession;
    window.desktop.updateTrayStatus({
      ready: fileInitialized,
      canPunchIn: fileInitialized && !trayOpen,
      canPunchOut: fileInitialized && trayOpen?.key === todayKey,
      hasStaleSession: !!trayOpen && trayOpen.key !== todayKey,
      sessionStart: trayOpen?.entry.start ?? null,
      todayKey,
      todayEntries: trayToday.entries,
      targetHours: trayToday.targetHours,
      openSession: trayOpen,
    });
  }, [fileInitialized, trayToday, todayKey]);

  const goToCurrentPeriod = () => {
    handleMonthChange(currentPeriodMonthKey);
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

      if (dataStr) {
        try {
          const data: TrackerData = JSON.parse(dataStr);
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
    anchor.download = `punchboard-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const importData = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      void (async () => {
        try {
          const text = event.target?.result as string;
          const payload = parseDataFile(text);

          if (isFileMode) {
            initializeFromFile(payload, filePath);
          } else if (browserFileHandle) {
            if (
              !window.confirm(
                `Restore this backup to ${browserFileHandle.name}? It will replace the shared file contents.`,
              )
            ) {
              return;
            }
            const contents = JSON.stringify(payload, null, 2);
            await writeDataFile(browserFileHandle, contents);
            loadBrowserDataFile(browserFileHandle, contents);
          } else {
            populateLocalStorageFromFile(payload);
            window.location.reload();
          }
        } catch (error) {
          setBrowserFileError(
            error instanceof Error ? error.message : "Failed to import the backup.",
          );
          alert("Failed to import: the file is not a valid backup.");
        }
      })();
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
    currencyConversionEnabled,
    taxPercent,
    extraDeduction,
    payslipStartDay,
    defaultHours,
    exceptions,
    dailyHours,
    extraHours,
    extraHoursTotal,
    timeEntries,
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
    onCurrencyConversionEnabledChange,
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
    setDayEntries,
    setDayTotal,
    resetDay,
    applyDayInput,
    todayKey,
    isViewingCurrentPeriod,
    goToCurrentPeriod,
    openSession,
    punchIn,
    punchOut,
    recentActivity,
    yearlyData,
    calendarCells,
    selectedMonthInfo,
    exportData,
    importData,
    isFileMode,
    browserFileSupported,
    browserFileHandle,
    browserFileNeedsPermission,
    browserFileError,
    fileInitialized,
    filePath,
    chooseExistingFile,
    createNewFile,
    changeFile,
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
  };
}
