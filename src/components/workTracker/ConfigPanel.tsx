import { ReactNode, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  ActivityLogEntry,
  CurrencyCode,
  DayKey,
  currencyOptions,
  daysOfWeek,
} from "./types";
import { clampDay, clampPercent } from "./utils";

interface ConfigPanelProps {
  open: boolean;
  savedMonthsCount: number;
  lastSavedAt: string;
  onClose: () => void;
  selectedDays: DayKey[];
  onToggleDay: (key: DayKey) => void;
  hoursPerDay: number;
  onHoursPerDayChange: (value: number) => void;
  hourlyRate: number;
  onHourlyRateChange: (value: number) => void;
  currency: CurrencyCode;
  onCurrencyChange: (value: CurrencyCode) => void;
  secondaryCurrency: CurrencyCode;
  onSecondaryCurrencyChange: (value: CurrencyCode) => void;
  conversionRate: number;
  onConversionRateChange: (value: number) => void;
  currencyConversionEnabled: boolean;
  onCurrencyConversionEnabledChange: (value: boolean) => void;
  taxPercent: number;
  onTaxPercentChange: (value: number) => void;
  extraDeduction: number;
  onExtraDeductionChange: (value: number) => void;
  payslipStartDay: number;
  onPayslipStartDayChange: (value: number) => void;
  defaultHours: number;
  onDefaultHoursChange: (value: number) => void;
  recentActivity: ActivityLogEntry[];
  onExportData: () => void;
  onImportData: (file: File) => void;
  isFileMode: boolean;
  filePath: string;
  onChangeFile: () => void;
  browserFileSupported: boolean;
  hasBrowserFile: boolean;
  browserFileNeedsPermission: boolean;
  browserFileError: string | null;
  onConnectBrowserFile: () => void;
  onSaveBrowserDataToFile: () => void;
  onReconnectBrowserFile: () => void;
  onReloadBrowserFile: () => void;
  onOverwriteBrowserFile: () => void;
  onDisconnectBrowserFile: () => void;
  startupAvailable: boolean;
  openAtLogin: boolean;
  startupError: string | null;
  onOpenAtLoginChange: (enabled: boolean) => void;
  showTray: boolean;
  onShowTrayChange: (enabled: boolean) => void;
}

function Section({
  title,
  children,
  first = false,
}: {
  title: string;
  children: ReactNode;
  first?: boolean;
}) {
  return (
    <div className="mt-6">
      {!first ? <Separator className="mb-6" /> : null}
      <p className="stamp">{title}</p>
      <div className="mt-3 space-y-4">{children}</div>
    </div>
  );
}

const isMac = window.desktop?.platform === "darwin";

function PreferenceRow({
  id,
  label,
  description,
  checked,
  disabled = false,
  onCheckedChange,
}: {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-lg border bg-muted/40 p-3",
        disabled && "opacity-60",
      )}
    >
      <div className="space-y-1">
        <Label htmlFor={id}>{label}</Label>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
      />
    </div>
  );
}

function CurrencySelect({
  value,
  onChange,
  ariaLabel,
}: {
  value: CurrencyCode;
  onChange: (value: CurrencyCode) => void;
  ariaLabel: string;
}) {
  return (
    <Select
      value={value}
      onValueChange={(next) => onChange(next as CurrencyCode)}
    >
      <SelectTrigger aria-label={ariaLabel}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {currencyOptions.map((option) => (
          <SelectItem key={option.code} value={option.code}>
            {option.code} ({option.symbol})
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export default function ConfigPanel({
  open,
  savedMonthsCount,
  lastSavedAt,
  onClose,
  selectedDays,
  onToggleDay,
  hoursPerDay,
  onHoursPerDayChange,
  hourlyRate,
  onHourlyRateChange,
  currency,
  onCurrencyChange,
  secondaryCurrency,
  onSecondaryCurrencyChange,
  conversionRate,
  onConversionRateChange,
  currencyConversionEnabled,
  onCurrencyConversionEnabledChange,
  taxPercent,
  onTaxPercentChange,
  extraDeduction,
  onExtraDeductionChange,
  payslipStartDay,
  onPayslipStartDayChange,
  defaultHours,
  onDefaultHoursChange,
  recentActivity,
  onExportData,
  onImportData,
  isFileMode,
  filePath,
  onChangeFile,
  browserFileSupported,
  hasBrowserFile,
  browserFileNeedsPermission,
  browserFileError,
  onConnectBrowserFile,
  onSaveBrowserDataToFile,
  onReconnectBrowserFile,
  onReloadBrowserFile,
  onOverwriteBrowserFile,
  onDisconnectBrowserFile,
  startupAvailable,
  openAtLogin,
  startupError,
  onOpenAtLoginChange,
  showTray,
  onShowTrayChange,
}: ConfigPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [updateStatus, setUpdateStatus] = useState<string | null>(null);
  const [checkingForUpdates, setCheckingForUpdates] = useState(false);

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleCheckForUpdates = async () => {
    if (!window.updateAPI) return;

    setCheckingForUpdates(true);
    setUpdateStatus(null);
    try {
      const result = await window.updateAPI.check();
      if (result.status === "available") {
        setUpdateStatus(`Update v${result.version} found — downloading...`);
      } else if (result.status === "not-available") {
        setUpdateStatus(`You're up to date (v${result.version}).`);
      } else {
        setUpdateStatus(result.message);
      }
    } finally {
      setCheckingForUpdates(false);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onImportData(file);
      event.target.value = "";
    }
  };

  return (
    <Sheet open={open} onOpenChange={(next) => (!next ? onClose() : undefined)}>
      <SheetContent side="right" className="w-full overflow-y-auto bg-popover sm:max-w-sm">
        <SheetHeader>
          <SheetTitle className="text-xl tracking-tight">Settings</SheetTitle>
          <SheetDescription>
            Configure your schedule, pay, and data file.
          </SheetDescription>
        </SheetHeader>

        <Section title="File" first>
          <p className="text-xs text-muted-foreground">
            {isFileMode || hasBrowserFile ? (
              <>
                <span className="block truncate" title={filePath}>
                  📁 {filePath || "No file chosen"}
                </span>
                <span className="block">
                  {browserFileNeedsPermission
                    ? "Browser permission is needed to resume autosaving."
                    : browserFileError ??
                      `Months saved: ${savedMonthsCount} | Last save: ${
                        lastSavedAt
                          ? new Date(lastSavedAt).toLocaleString()
                          : "not yet"
                      }`}
                </span>
              </>
            ) : (
              <>
                Saved months: {savedMonthsCount} | Last save:{" "}
                {lastSavedAt
                  ? new Date(lastSavedAt).toLocaleString()
                  : "not yet"}
              </>
            )}
          </p>

          {!isFileMode && hasBrowserFile && !browserFileError ? (
            <p className="text-xs text-muted-foreground">
              Changes autosave to this file. Use one app at a time; external
              edits are detected and paused to avoid overwriting them.
            </p>
          ) : null}

          {!isFileMode && !hasBrowserFile && browserFileError ? (
            <p className="text-xs text-destructive">{browserFileError}</p>
          ) : null}

          <div className="space-y-2">
            {isFileMode ? (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 text-xs"
                  onClick={onChangeFile}
                >
                  Change file
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 text-xs"
                  onClick={onExportData}
                >
                  Save backup copy
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 text-xs"
                  onClick={handleImportClick}
                >
                  Restore backup
                </Button>
              </div>
            ) : (
              <>
                {browserFileSupported && hasBrowserFile ? (
                  <div className="flex gap-2">
                    {browserFileNeedsPermission ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 text-xs"
                        onClick={onReconnectBrowserFile}
                      >
                        Reconnect file
                      </Button>
                    ) : browserFileError ? (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 text-xs"
                          onClick={onReloadBrowserFile}
                        >
                          Reload file
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 text-xs"
                          onClick={onOverwriteBrowserFile}
                        >
                          Overwrite file
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 text-xs"
                          onClick={onConnectBrowserFile}
                        >
                          Change file
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 text-xs"
                          onClick={onConnectBrowserFile}
                        >
                          Change file
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 text-xs"
                          onClick={onDisconnectBrowserFile}
                        >
                          Disconnect
                        </Button>
                      </>
                    )}
                  </div>
                ) : null}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 text-xs"
                    onClick={onExportData}
                  >
                    {hasBrowserFile ? "Save backup copy" : "Export backup"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 text-xs"
                    onClick={handleImportClick}
                  >
                    {hasBrowserFile ? "Restore backup" : "Import backup"}
                  </Button>
                </div>
              </>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          {!isFileMode && browserFileSupported && !hasBrowserFile ? (
            <div className="space-y-2 rounded-lg border bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground">
                Web data currently autosaves in this browser. Select the same
                JSON file used by the desktop app to share changes between them.
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 text-xs"
                  onClick={onConnectBrowserFile}
                >
                  Open shared file
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 text-xs"
                  onClick={onSaveBrowserDataToFile}
                >
                  Save web data to file
                </Button>
              </div>
            </div>
          ) : null}

          {!isFileMode && !browserFileSupported ? (
            <p className="text-xs text-muted-foreground">
              Web data autosaves in this browser. Shared-file autosave requires
              a browser that supports local file access, such as Chrome or Edge.
            </p>
          ) : null}

          {isFileMode ? (
            <div>
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs"
                disabled={checkingForUpdates}
                onClick={handleCheckForUpdates}
              >
                {checkingForUpdates ? "Checking..." : "Check for updates"}
              </Button>
              {updateStatus ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  {updateStatus}
                </p>
              ) : null}
            </div>
          ) : null}
        </Section>

        {isFileMode ? (
          <Section title="Desktop app">
            <PreferenceRow
              id="show-tray"
              label={isMac ? "Show in menu bar" : "Show in system tray"}
              description={
                isMac
                  ? "Punch in and out from the menu bar, with the running time next to the icon."
                  : "Punch in and out from the system tray."
              }
              checked={showTray}
              onCheckedChange={onShowTrayChange}
            />
            <PreferenceRow
              id="open-at-login"
              label="Open at login"
              description={
                startupAvailable
                  ? showTray
                    ? `Start Punchboard when you sign in, quietly in the ${isMac ? "menu bar" : "tray"}.`
                    : "Start Punchboard when you sign in."
                  : "Available in the installed app on macOS and Windows."
              }
              checked={openAtLogin}
              disabled={!startupAvailable}
              onCheckedChange={onOpenAtLoginChange}
            />
            {startupError ? (
              <p className="text-xs text-destructive">{startupError}</p>
            ) : null}
          </Section>
        ) : null}

        <Section title="Schedule">
          <div>
            <Label>Working weekdays</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {daysOfWeek.map((day) => {
                const active = selectedDays.includes(day.key);
                return (
                  <Button
                    key={day.key}
                    variant="outline"
                    size="sm"
                    onClick={() => onToggleDay(day.key)}
                    className={cn(
                      "h-8 rounded-full px-3 font-mono text-xs",
                      active &&
                        "border-foreground bg-foreground text-background hover:bg-foreground/90 hover:text-background",
                    )}
                  >
                    {day.label}
                  </Button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="payslip-start-day">Payslip start day</Label>
            <Input
              id="payslip-start-day"
              type="number"
              min={1}
              max={31}
              value={payslipStartDay}
              onChange={(event) =>
                onPayslipStartDayChange(clampDay(Number(event.target.value)))
              }
            />
          </div>
        </Section>

        <Section title="Pay & currency">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="hours-per-day">Hours/day</Label>
              <Input
                id="hours-per-day"
                type="number"
                min={0}
                value={hoursPerDay}
                onChange={(event) =>
                  onHoursPerDayChange(Number(event.target.value))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="hourly-rate">Rate (per hour)</Label>
              <Input
                id="hourly-rate"
                type="number"
                min={0}
                value={hourlyRate}
                onChange={(event) =>
                  onHourlyRateChange(Number(event.target.value))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tax-percent">Tax (%)</Label>
              <Input
                id="tax-percent"
                type="number"
                min={0}
                max={100}
                step={0.1}
                value={taxPercent}
                onChange={(event) =>
                  onTaxPercentChange(clampPercent(Number(event.target.value)))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="extra-deduction">Extra deduction</Label>
              <Input
                id="extra-deduction"
                type="number"
                min={0}
                step={0.01}
                value={extraDeduction}
                onChange={(event) =>
                  onExtraDeductionChange(Number(event.target.value))
                }
              />
            </div>

            <div className="col-span-2 space-y-2">
              <Label htmlFor="default-hours">Holiday hours/day</Label>
              <Input
                id="default-hours"
                type="number"
                min={0}
                value={defaultHours}
                onChange={(event) =>
                  onDefaultHoursChange(Number(event.target.value))
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Currency</Label>
            <CurrencySelect
              value={currency}
              onChange={onCurrencyChange}
              ariaLabel="Primary currency"
            />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <Label htmlFor="currency-conversion-enabled">
                Currency conversion
              </Label>
              <Switch
                id="currency-conversion-enabled"
                checked={currencyConversionEnabled}
                onCheckedChange={onCurrencyConversionEnabledChange}
              />
            </div>

            {currencyConversionEnabled ? (
              <>
                <div className="mt-3 flex items-center gap-2">
                  <span className="shrink-0 text-sm text-muted-foreground">
                    {currency} →
                  </span>
                  <CurrencySelect
                    value={secondaryCurrency}
                    onChange={onSecondaryCurrencyChange}
                    ariaLabel="Secondary currency"
                  />
                </div>

                {currency !== secondaryCurrency ? (
                  <div className="mt-3 space-y-2">
                    <Label htmlFor="conversion-rate">
                      Conversion rate ({currency} → {secondaryCurrency})
                    </Label>
                    <Input
                      id="conversion-rate"
                      type="number"
                      min={0}
                      step={0.0001}
                      value={conversionRate}
                      onChange={(event) =>
                        onConversionRateChange(Number(event.target.value))
                      }
                    />
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
        </Section>

        <Section title="Recent activity">
          <div className="rounded-lg border bg-muted/40 p-3">
            {recentActivity.length === 0 ? (
              <p className="text-xs text-muted-foreground">No activity yet.</p>
            ) : (
              <div className="space-y-1">
                {recentActivity.map((entry) => (
                  <p key={entry.id} className="text-xs text-muted-foreground">
                    <span className="font-mono text-[10.5px] text-muted-foreground/70">
                      {new Date(entry.timestamp).toLocaleString("en-GB", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>{" "}
                    {entry.message}
                  </p>
                ))}
              </div>
            )}
          </div>
        </Section>

        <Section title="About">
          <p className="text-xs text-muted-foreground">
            Punchboard v{__APP_VERSION__}
            <br />
            Made by{" "}
            <a
              href="https://quackbyte.dev"
              target="_blank"
              rel="noreferrer"
              className="underline hover:text-foreground"
            >
              QuackByte
            </a>
            <br />
            &copy; {new Date().getFullYear()} &middot; MIT License
          </p>
        </Section>
      </SheetContent>
    </Sheet>
  );
}
