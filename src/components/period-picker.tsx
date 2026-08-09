import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isWeekPeriod, mondayOf, weekPeriodDate, weekRangeLabel } from "@/lib/periods";

/**
 * Кезең таңдағыш: айлық немесе апталық.
 * value — дерекқорға сақталатын кезең күні (YYYY-MM-DD).
 */
export function PeriodPicker({
  value,
  onChange,
  idPrefix = "period",
}: {
  value: string;
  onChange: (period: string) => void;
  idPrefix?: string;
}) {
  const [mode, setMode] = useState<"month" | "week">(isWeekPeriod(value) ? "week" : "month");

  const month = value.slice(0, 7);
  const weekDay = isWeekPeriod(value) ? mondayOf(value) : mondayOf(new Date().toISOString().slice(0, 10));

  return (
    <div className="space-y-3">
      <div className="inline-flex rounded-xl border border-border bg-card p-1">
        <Button
          type="button"
          variant={mode === "month" ? "default" : "ghost"}
          size="sm"
          onClick={() => {
            setMode("month");
            onChange(`${new Date().toISOString().slice(0, 7)}-01`);
          }}
        >
          Айлық
        </Button>
        <Button
          type="button"
          variant={mode === "week" ? "default" : "ghost"}
          size="sm"
          onClick={() => {
            setMode("week");
            onChange(weekPeriodDate(new Date().toISOString().slice(0, 10)));
          }}
        >
          Апталық
        </Button>
      </div>

      {mode === "month" ? (
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-month`}>Ай</Label>
          <Input
            id={`${idPrefix}-month`}
            type="month"
            value={month}
            onChange={(e) => e.target.value && onChange(`${e.target.value}-01`)}
          />
        </div>
      ) : (
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-week`}>Апта (кез келген күнін таңдаңыз)</Label>
          <Input
            id={`${idPrefix}-week`}
            type="date"
            value={weekDay}
            onChange={(e) => e.target.value && onChange(weekPeriodDate(e.target.value))}
          />
          <p className="text-xs text-muted-foreground">Апта: {weekRangeLabel(value)}</p>
        </div>
      )}
    </div>
  );
}
