import { useMemo } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export type GridCell = { present: number; total: number };

export type AttendanceGridProps = {
  classes: { id: string; name: string }[];
  /** Бағандар: ISO күндер тізімі */
  days: string[];
  /** Баған тақырыптары (күн нөмірі немесе «Дү», «Сй» …) */
  dayLabels: string[];
  /** key: `${classId}|${isoDay}` */
  cells: Map<string, GridCell>;
  totalLabel: string;
  fileName: string;
  sheetName?: string;
  emptyText?: string;
};

function percentClass(pct: number | null) {
  if (pct === null) return "text-muted-foreground/60";
  if (pct >= 90) return "font-semibold text-primary";
  if (pct >= 75) return "font-semibold";
  return "font-semibold text-destructive";
}

/**
 * Қатысым кестесі: жолдар — сыныптар, бағандар — күндер,
 * ұяшық — «келгені/барлығы», соңғы баған — жалпы пайыз.
 */
export function AttendanceGrid({
  classes,
  days,
  dayLabels,
  cells,
  totalLabel,
  fileName,
  sheetName = "Қатысым",
  emptyText = "Дерек жоқ.",
}: AttendanceGridProps) {
  const rows = useMemo(
    () =>
      classes.map((c) => {
        let present = 0;
        let total = 0;
        for (const d of days) {
          const cell = cells.get(`${c.id}|${d}`);
          if (cell) {
            present += cell.present;
            total += cell.total;
          }
        }
        return {
          id: c.id,
          name: c.name,
          present,
          total,
          percent: total > 0 ? Math.round((present / total) * 100) : null,
        };
      }),
    [classes, days, cells],
  );

  const overall = useMemo(() => {
    const present = rows.reduce((s, r) => s + r.present, 0);
    const total = rows.reduce((s, r) => s + r.total, 0);
    return total > 0 ? Math.round((present / total) * 100) : null;
  }, [rows]);

  async function exportXlsx() {
    const XLSX = await import("xlsx");
    const header = ["Сынып", ...dayLabels, totalLabel];
    const body = rows.map((r) => [
      `${r.name} сынып`,
      ...days.map((d) => {
        const cell = cells.get(`${r.id}|${d}`);
        return cell ? `${cell.present}/${cell.total}` : "";
      }),
      r.percent !== null ? `${r.percent}%` : "",
    ]);
    const sheet = XLSX.utils.aoa_to_sheet([header, ...body]);
    sheet["!cols"] = [{ wch: 14 }, ...days.map(() => ({ wch: 8 })), { wch: 14 }];
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, sheetName);
    XLSX.writeFile(book, fileName);
    toast.success("Файл жүктелді");
  }

  if (classes.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyText}</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {totalLabel}:{" "}
          <span className={percentClass(overall)}>
            {overall !== null ? `${overall}%` : "—"}
          </span>
        </p>
        <Button size="sm" variant="outline" onClick={exportXlsx}>
          <Download className="mr-2 size-4" /> Жүктеу
        </Button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-max min-w-full border-separate border-spacing-0 text-xs">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-card px-2 py-2 text-left font-medium text-muted-foreground">
                Сынып
              </th>
              {dayLabels.map((label, i) => (
                <th
                  key={days[i]}
                  className="min-w-14 px-2 py-2 text-center font-medium text-muted-foreground"
                >
                  {label}
                </th>
              ))}
              <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                {totalLabel}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="sticky left-0 z-10 whitespace-nowrap border-t border-border/60 bg-card px-2 py-1.5 font-medium">
                  {r.name}
                </td>
                {days.map((d) => {
                  const cell = cells.get(`${r.id}|${d}`);
                  return (
                    <td
                      key={d}
                      className="border-t border-border/60 px-2 py-1.5 text-center tabular-nums"
                    >
                      {cell ? (
                        `${cell.present}/${cell.total}`
                      ) : (
                        <span className="text-muted-foreground/50">—</span>
                      )}
                    </td>
                  );
                })}
                <td
                  className={
                    "border-t border-border/60 px-3 py-1.5 text-right " +
                    percentClass(r.percent)
                  }
                >
                  {r.percent !== null ? `${r.percent}%` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        Ұяшық форматы: келгені / жалпы оқушы саны. «—» — дерек енгізілмеген.
      </p>
    </div>
  );
}
