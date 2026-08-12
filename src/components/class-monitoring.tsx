import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getClassAttendanceSummary } from "@/lib/attendance.functions";
import { classPercentOf, classTotalPoints, type ClassQualityRow } from "@/lib/class-criteria";
import { sortClassesByLiter } from "@/lib/utils";

function monthBounds(month: string) {
  const y = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7));
  const end = new Date(y, m, 0);
  return {
    start: `${month}-01`,
    end: `${month}-${String(end.getDate()).padStart(2, "0")}`,
  };
}

/**
 * Барлық сыныптардың жинақталған мониторингі.
 * Кез келген сынып жетекшісіне көрінеді — тек агрегат көрсеткіштер,
 * оқушылардың жеке деректері көрсетілмейді.
 *
 * «Сынып сапасы %» — Админ → Сынып критерийлері бөлімінде қойылған балдардан
 * есептеледі (class_quality кестесі, барлық пайдаланушыға оқуға ашық), сондықтан
 * бұл баған әрдайым көрінеді. Қатысым % — жеке күндер тек иесіне/әкімшіге
 * ашық болғандықтан, жинақ көрсеткіш арнайы серверлік функциямен алынады;
 * ол сәтсіз аяқталса да, сынып сапасы кестесі бөгелмей көрсетіледі.
 */
export function ClassMonitoring() {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const bounds = monthBounds(month);
  const fetchSummary = useServerFn(getClassAttendanceSummary);

  const classesQuery = useQuery({
    queryKey: ["classes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("classes").select("id, name").order("name");
      if (error) throw error;
      return data;
    },
  });

  const summaryQuery = useQuery({
    queryKey: ["class-attendance-summary", bounds.start, bounds.end],
    queryFn: () => fetchSummary({ data: { from: bounds.start, to: bounds.end } }),
    retry: false,
  });

  const qualityQuery = useQuery({
    queryKey: ["class_quality", month],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("class_quality")
        .select("id, class_id, period, scores, note")
        .gte("period", bounds.start)
        .lte("period", bounds.end);
      if (error) throw error;
      return (data ?? []).map((r) => ({
        ...r,
        scores: (r.scores ?? {}) as Record<string, number>,
      })) as ClassQualityRow[];
    },
  });

  const rows = useMemo(() => {
    const quality = new Map<string, number[]>();
    for (const q of qualityQuery.data ?? []) {
      const list = quality.get(q.class_id) ?? [];
      list.push(classPercentOf(classTotalPoints(q.scores)));
      quality.set(q.class_id, list);
    }

    const attendance = new Map<string, { percent: number | null; days: number }>();
    for (const s of summaryQuery.data ?? []) {
      attendance.set(s.classId, { percent: s.percent, days: s.days });
    }

    const list = (classesQuery.data ?? []).map((c) => {
      const qs = quality.get(c.id) ?? [];
      const qualityPercent =
        qs.length > 0 ? Math.round(qs.reduce((a, b) => a + b, 0) / qs.length) : null;
      const a = attendance.get(c.id);
      return {
        id: c.id,
        name: c.name,
        attendance: a?.percent ?? null,
        days: a?.days ?? 0,
        qualityPercent,
      };
    });

    // Сынып критерийлері бөлімінде қойылған балдар бойынша есептелетін
    // «Сынып сапасы %» негізгі көрсеткіш болғандықтан, тізім осы бойынша сұрыпталады.
    return sortClassesByLiter(list).sort(
      (a, b) => (b.qualityPercent ?? -1) - (a.qualityPercent ?? -1),
    );
  }, [classesQuery.data, summaryQuery.data, qualityQuery.data]);

  const loading = classesQuery.isLoading || qualityQuery.isLoading;
  const failed = classesQuery.isError || qualityQuery.isError;

  return (
    <section className="mt-6 rounded-2xl border border-border bg-card p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-lg font-bold">Сынып мониторингі</h2>
          <p className="text-sm text-muted-foreground">
            Барлық сыныптардың жинақталған көрсеткіштері (жеке деректерсіз).
          </p>
        </div>
        <div className="space-y-1">
          <Label htmlFor="cm-month">Ай</Label>
          <Input
            id="cm-month"
            type="month"
            value={month}
            onChange={(e) => e.target.value && setMonth(e.target.value)}
            className="w-44"
          />
        </div>
      </div>

      {loading ? (
        <p className="mt-6 text-sm text-muted-foreground">Жүктелуде…</p>
      ) : failed ? (
        <p className="mt-6 text-sm text-destructive">Деректерді жүктеу мүмкін болмады.</p>
      ) : rows.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">Әзірге сынып қосылмаған.</p>
      ) : (
        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="py-2 font-medium">Сынып</th>
                <th className="py-2 text-right font-medium">Сынып сапасы %</th>
                <th className="py-2 text-right font-medium">Қатысым %</th>
                <th className="py-2 text-right font-medium">Белгіленген күн</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-border/60">
                  <td className="py-2 pr-3 font-medium">{r.name} сынып</td>
                  <td className="py-2 text-right">
                    {r.qualityPercent !== null ? (
                      <span
                        className={
                          r.qualityPercent >= 90
                            ? "font-semibold text-primary"
                            : r.qualityPercent >= 75
                              ? "font-semibold"
                              : "font-semibold text-destructive"
                        }
                      >
                        {r.qualityPercent}%
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="py-2 text-right">
                    {r.attendance !== null ? (
                      <span
                        className={
                          r.attendance >= 90
                            ? "font-semibold text-primary"
                            : r.attendance >= 75
                              ? "font-semibold"
                              : "font-semibold text-destructive"
                        }
                      >
                        {r.attendance}%
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="py-2 text-right text-muted-foreground">{r.days}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {summaryQuery.isError && (
            <p className="mt-3 text-xs text-muted-foreground">
              Қатысым % уақытша қолжетімсіз. Сынып сапасы деректері бұған байланысты емес.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
