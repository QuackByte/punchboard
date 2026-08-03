import { ReactNode, useRef } from "react";
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
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      <div className="mt-3 space-y-4">{children}</div>
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
}: ConfigPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImportClick = () => {
    fileInputRef.current?.click();
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
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-sm">
        <SheetHeader>
          <SheetTitle>Settings</SheetTitle>
          <SheetDescription>
            Configure your schedule, pay, and data file.
          </SheetDescription>
        </SheetHeader>

        <Section title="File" first>
          <p className="text-xs text-muted-foreground">
            {isFileMode ? (
              <>
                <span className="block truncate" title={filePath}>
                  📁 {filePath || "No file chosen"}
                </span>
                <span>
                  Months saved: {savedMonthsCount} | Last save:{" "}
                  {lastSavedAt
                    ? new Date(lastSavedAt).toLocaleString()
                    : "not yet"}
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

          <div className="flex gap-2">
            {isFileMode && (
              <Button
                variant="outline"
                size="sm"
                className="flex-1 text-xs"
                onClick={onChangeFile}
              >
                Change file
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="flex-1 text-xs"
              onClick={onExportData}
            >
              {isFileMode ? "Save backup copy" : "Export backup"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 text-xs"
              onClick={handleImportClick}
            >
              {isFileMode ? "Restore backup" : "Import backup"}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
        </Section>

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
                      "h-8 px-3",
                      active &&
                        "border-primary bg-primary/15 text-primary hover:bg-primary/25 hover:text-primary",
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

          <div>
            <Label>Currency conversion</Label>
            <div className="mt-2 flex items-center gap-2">
              <CurrencySelect
                value={currency}
                onChange={onCurrencyChange}
                ariaLabel="Primary currency"
              />
              <span className="shrink-0 text-muted-foreground">→</span>
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
                    {new Date(entry.timestamp).toLocaleString()} -{" "}
                    {entry.message}
                  </p>
                ))}
              </div>
            )}
          </div>
        </Section>
      </SheetContent>
    </Sheet>
  );
}
