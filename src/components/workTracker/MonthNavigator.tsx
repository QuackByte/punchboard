import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { formatMonthKey } from "./utils";

interface MonthNavigatorProps {
  monthKey: string;
  year: number;
  monthIndex: number;
  periodLabel: string;
  isViewingCurrentPeriod: boolean;
  savedMonths: string[];
  onMove: (direction: "prev" | "next") => void;
  onSelect: (monthKey: string) => void;
  onToday: () => void;
}

export default function MonthNavigator({
  monthKey,
  year,
  monthIndex,
  periodLabel,
  isViewingCurrentPeriod,
  savedMonths,
  onMove,
  onSelect,
  onToday,
}: MonthNavigatorProps) {
  const [open, setOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(year);

  return (
    <div className="flex items-center gap-1 rounded-2xl border bg-card/80 p-1 shadow-sm backdrop-blur">
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9 rounded-xl"
        aria-label="Previous period"
        onClick={() => onMove("prev")}
      >
        <ChevronLeft />
      </Button>

      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (next) setPickerYear(year);
        }}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            className="flex min-w-[11.5rem] flex-col items-center rounded-xl px-3 py-1 outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="flex items-center gap-1 text-[15px] font-semibold leading-tight">
              {new Date(year, monthIndex, 1).toLocaleDateString("en-GB", {
                month: "long",
                year: "numeric",
              })}
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            </span>
            <span className="font-mono text-[10.5px] text-muted-foreground">
              {periodLabel}
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-3" align="center">
          <div className="mb-2 flex items-center justify-between">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              aria-label="Previous year"
              onClick={() => setPickerYear(pickerYear - 1)}
            >
              <ChevronLeft />
            </Button>
            <span className="font-mono text-sm font-semibold">{pickerYear}</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              aria-label="Next year"
              onClick={() => setPickerYear(pickerYear + 1)}
            >
              <ChevronRight />
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-1">
            {Array.from({ length: 12 }, (_, index) => {
              const key = formatMonthKey(new Date(pickerYear, index, 1));
              const isSelected = key === monthKey;
              const hasData = savedMonths.includes(key);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    onSelect(key);
                    setOpen(false);
                  }}
                  className={cn(
                    "relative h-9 rounded-lg text-sm transition-colors hover:bg-accent",
                    isSelected &&
                      "bg-primary font-semibold text-primary-foreground hover:bg-primary",
                  )}
                >
                  {new Date(pickerYear, index, 1).toLocaleDateString("en-GB", {
                    month: "short",
                  })}
                  {hasData && !isSelected ? (
                    <span className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-primary" />
                  ) : null}
                </button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>

      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9 rounded-xl"
        aria-label="Next period"
        onClick={() => onMove("next")}
      >
        <ChevronRight />
      </Button>

      {!isViewingCurrentPeriod ? (
        <Button
          variant="ghost"
          size="sm"
          className="h-9 rounded-xl px-3 text-xs font-semibold text-primary hover:text-primary"
          onClick={onToday}
        >
          Today
        </Button>
      ) : null}
    </div>
  );
}
