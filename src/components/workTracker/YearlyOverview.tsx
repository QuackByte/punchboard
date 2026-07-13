import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { YearlyDataPoint } from "./types";

interface YearlyOverviewProps {
  graphYear: number;
  onPrevYear: () => void;
  onNextYear: () => void;
  yearlyData: YearlyDataPoint[];
}

export default function YearlyOverview({
  graphYear,
  onPrevYear,
  onNextYear,
  yearlyData,
}: YearlyOverviewProps) {
  const maxHours = Math.max(
    ...yearlyData.map((monthData) => monthData.actualHours),
    1,
  );

  return (
    <Card className="mt-8 w-full bg-card/70 shadow-xl backdrop-blur">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-xl">Yearly Overview</CardTitle>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={onPrevYear}>
            <ChevronLeft />
            Prev
          </Button>
          <span className="w-20 text-center text-lg font-semibold">
            {graphYear}
          </span>
          <Button variant="outline" size="sm" onClick={onNextYear}>
            Next
            <ChevronRight />
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        <div className="overflow-x-auto">
          {/* Bar area — bars are direct flex children so height:% resolves correctly */}
          <div className="flex h-48 items-end justify-around gap-2 rounded-t-lg border border-b-0 bg-muted/40 px-4 pt-6">
            <TooltipProvider delayDuration={100}>
              {yearlyData.map((monthData) => {
                const rawHeightPercent =
                  (monthData.actualHours / maxHours) * 100;
                const heightPercent =
                  monthData.actualHours > 0 ? Math.max(rawHeightPercent, 4) : 0;

                return (
                  <Tooltip key={monthData.monthKey}>
                    <TooltipTrigger asChild>
                      <div
                        className="w-8 rounded-t-lg border border-primary/50 bg-gradient-to-b from-primary/40 to-primary/20 transition hover:from-primary/60 hover:to-primary/30"
                        style={{ height: `${heightPercent}%` }}
                      />
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      {monthData.actualHours.toFixed(1)}h
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </TooltipProvider>
          </div>

          {/* Labels row — separate from bar area so they don't affect bar height resolution */}
          <div className="flex justify-around gap-2 rounded-b-lg border border-t bg-muted/40 px-4 py-2">
            {yearlyData.map((monthData) => (
              <div
                key={monthData.monthKey}
                className="flex w-8 flex-col items-center gap-0.5"
              >
                <p className="text-xs font-medium text-foreground">
                  {monthData.month}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {monthData.actualHours.toFixed(0)}h
                </p>
              </div>
            ))}
          </div>
        </div>

        <p className="mt-4 text-xs text-muted-foreground">
          Bar height represents worked hours. Hover over bars to see exact
          hours.
        </p>
      </CardContent>
    </Card>
  );
}
