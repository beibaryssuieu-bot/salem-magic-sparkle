import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Trophy, TrendingDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MAX_TOTAL,
  levelLabel,
  percentOf,
  totalPoints,
  type ClassScoreRow,
} from "@/lib/criteria";
import {
  PERIOD_KIND_LABELS,
  academicYearOptions,
  currentAcademicYear,
  periodOptions,
  type PeriodKind,
} from "@/lib/periods";

export const Route = createFileRoute("/_authenticated/rating")({
  head: () => ({
    meta: [
      { title: "Сыныптар рейтингі — TÄRBIE OS" },
      {
        name: "description",
        content:
          "Қыркүйектен мамырға дейінгі айлық, тоқсандық, жартыжылдық және жылдық мониторинг бойынша сыныптар рейтингі.",
      },
      { property: "og:title", content: "Сыныптар рейтингі — TÄRBIE OS" },
      {
        property: "og:description",
        content: "Үздік және назар аударуды қажет ететін сыныптардың балдық рейтингі.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RatingPage,
});

function RatingPage() {
  const [kind, setKind] = useState<PeriodKind>("month");
  const [year, setYear] = useState(String(currentAcademicYear()));
  const [selection, setSelection] = useState("");

  const classesQuery = useQuery({
    queryKey: ["classes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("classes").select("id, name").order("name");
      if (error) throw error;
      return data;
    },
  });

  const scoresQuery = useQuery({
    queryKey: ["class_scores"],
    queryFn: async () => {
      const { data, error } = await supabase.from("class_scores").select("*");
      if (error) throw error;
      return (data ?? []).map((r) => ({
        ...r,
        scores: (r.scores ?? {}) as Record<string, number>,
      })) as ClassScoreRow[];
    },
  });

  const options = useMemo(() => periodOptions(kind, Number(year)), [kind, year]);
  const active = options.find((o) => o.value === selection) ?? options[0];

  const rating = useMemo(() => {
    const classes = classesQuery.data ?? [];
    const rows = scoresQuery.data ?? [];
    const periods = new Set(active?.periods ?? []);
    return classes
      .map((c) => {
        const mine = rows.filter((r) => r.class_id === c.id && periods.has(r.period));
        const points = mine.reduce((s, r) => s + totalPoints(r.scores), 0);
        const max = MAX_TOTAL * Math.max(1, mine.length);
        return {
          id: c.id,
          name: c.name,
          months: mine.length,
          points,
          percent: mine.length ? percentOf(points, max) : 0,
        };
      })
      .filter((r) => r.months > 0)
      .sort((a, b) => b.points - a.points);
  }, [classesQuery.data, scoresQuery.data, active]);

  const best = rating.slice(0, 3);
  const worst = [...rating].reverse().slice(0, 3);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <h1 className="font-display text-2xl font-bold md:text-3xl">Сыныптар рейтингі</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Мониторинг қыркүйектен мамырға дейін: айлық, тоқсандық, жартыжылдық және жылдық қорытынды.
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        <Select
          value={kind}
          onValueChange={(v) => {
            setKind(v as PeriodKind);
            setSelection("");
          }}
        >
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(PERIOD_KIND_LABELS) as PeriodKind[]).map((k) => (
              <SelectItem key={k} value={k}>
                {PERIOD_KIND_LABELS[k]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={year}
          onValueChange={(v) => {
            setYear(v);
            setSelection("");
          }}
        >
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {academicYearOptions().map((y) => (
              <SelectItem key={y.value} value={y.value}>
                {y.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={active?.value ?? ""} onValueChange={setSelection}>
          <SelectTrigger className="w-72">
            <SelectValue placeholder="Кезең" />
          </SelectTrigger>
          <SelectContent>
            {options.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {rating.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-border p-10 text-center text-muted-foreground">
          Бұл кезең бойынша дерек енгізілмеген.
        </div>
      ) : (
        <>
          <div className="mt-8 grid gap-5 md:grid-cols-2">
            <section className="rounded-2xl panel-dark p-6">
              <h2 className="flex items-center gap-2 font-display font-bold">
                <Trophy className="size-4" /> Үздік сыныптар
              </h2>
              <ul className="mt-4 space-y-2 text-sm">
                {best.map((r, i) => (
                  <li key={r.id} className="flex justify-between gap-3">
                    <span>
                      {i + 1}. {r.name} сынып
                    </span>
                    <span className="font-semibold">
                      {r.points} балл · {r.percent}%
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="rounded-2xl border border-border bg-card p-6">
              <h2 className="flex items-center gap-2 font-display font-bold">
                <TrendingDown className="size-4 text-destructive" /> Назар аудару қажет
              </h2>
              <ul className="mt-4 space-y-2 text-sm">
                {worst.map((r) => (
                  <li key={r.id} className="flex justify-between gap-3">
                    <span>{r.name} сынып</span>
                    <span className="font-semibold">
                      {r.points} балл · {r.percent}%
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <section className="mt-6 rounded-2xl border border-border bg-card p-6">
            <h2 className="font-display font-bold">Толық рейтинг — {active?.label}</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground">
                    <th className="py-2 font-medium">#</th>
                    <th className="py-2 font-medium">Сынып</th>
                    <th className="py-2 text-right font-medium">Айлар</th>
                    <th className="py-2 text-right font-medium">Балл</th>
                    <th className="py-2 text-right font-medium">%</th>
                    <th className="py-2 text-right font-medium">Деңгей</th>
                  </tr>
                </thead>
                <tbody>
                  {rating.map((r, i) => (
                    <tr key={r.id} className="border-t border-border/60">
                      <td className="py-2 pr-3">{i + 1}</td>
                      <td className="py-2 pr-3">{r.name} сынып</td>
                      <td className="py-2 text-right">{r.months}</td>
                      <td className="py-2 text-right font-semibold">{r.points}</td>
                      <td className="py-2 text-right">{r.percent}%</td>
                      <td className="py-2 pl-3 text-right text-muted-foreground">
                        {levelLabel(r.percent)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
