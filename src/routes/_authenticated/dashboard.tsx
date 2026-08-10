import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { MetricRing } from "@/components/metric-ring";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RatingAlert } from "@/components/rating-alert";
import { ClassMonitoring } from "@/components/class-monitoring";
import { useProfile, useSession } from "@/lib/auth";
import {
  DEFAULT_ACADEMIC_START_YEAR,
  academicWeeks,
  academicYearOptions,
  academicYearPeriodList,
  periodTitle,
} from "@/lib/periods";
import {
  CRITERIA,
  GROUPS,
  MAX_TOTAL,
  criterionMax,
  criterionPoints,
  groupPoints,
  levelLabel,
  percentOf,
  totalPoints,
  type ClassScoreRow,
} from "@/lib/criteria";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Сынып жетекшісінің мониторингі — TÄRBIE OS" },
      {
        name: "description",
        content:
          "Сынып жетекшісінің тәрбие жұмысы бойынша балдық мониторингі: критерийлер, жиналған балл және пайыздық көрсеткіш.",
      },
      { property: "og:title", content: "Сынып жетекшісінің мониторингі — TÄRBIE OS" },
      {
        property: "og:description",
        content: "Балдық жүйе бойынша сынып жетекшісінің айлық мониторинг нәтижесі.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { user } = useSession();
  const { data: me } = useProfile(user);
  const [classId, setClassId] = useState<string>("");
  const [year, setYear] = useState(String(DEFAULT_ACADEMIC_START_YEAR));
  const [period, setPeriod] = useState<string>("");
  const [tab, setTab] = useState<"personal" | "class">("personal");

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
      const { data, error } = await supabase
        .from("class_scores")
        .select("*")
        .order("period", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r) => ({
        ...r,
        scores: (r.scores ?? {}) as Record<string, number>,
      })) as ClassScoreRow[];
    },
  });

  const classes = classesQuery.data ?? [];
  const myClassId = useMemo(() => {
    const mine = classes.find((c) => c.name === me?.profile?.class_name);
    return mine?.id ?? classes[0]?.id ?? "";
  }, [classes, me?.profile?.class_name]);

  const activeClassId = classId || myClassId;
  const classRows = (scoresQuery.data ?? []).filter((r) => r.class_id === activeClassId);

  const allPeriods = useMemo(
    () => [...academicYearPeriodList(Number(year)), ...academicWeeks(Number(year))],
    [year],
  );

  const activePeriod = period || allPeriods[0] || "";
  const current = classRows.find((r) => r.period === activePeriod);
  const periodIndex = allPeriods.indexOf(activePeriod);
  const previous = periodIndex > 0
    ? classRows.find((r) => r.period === allPeriods[periodIndex - 1])
    : undefined;
  const activeClass = classes.find((c) => c.id === activeClassId);

  const total = current ? totalPoints(current.scores) : 0;
  const percent = percentOf(total);
  const prevTotal = previous ? totalPoints(previous.scores) : null;

  const earned = current
    ? CRITERIA.map((c) => ({ c, points: criterionPoints(c, current.scores[c.key]) }))
    : [];
  const weakest = earned
    .filter(({ c }) => c.group !== GROUPS[2] && criterionMax(c) > 0)
    .map(({ c, points }) => ({ c, points, ratio: points / criterionMax(c) }))
    .sort((a, b) => a.ratio - b.ratio)
    .slice(0, 5);

  return (
    <div>
      <div className="mx-auto w-full max-w-7xl px-4 py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">
              Сәлеметсіз бе, {me?.profile?.full_name || me?.profile?.username}
            </p>
            <h1 className="font-display text-2xl font-bold md:text-3xl">
              Сынып жетекшісінің мониторингі
            </h1>
          </div>

          <div className="flex flex-wrap gap-2">
            <Select
              value={activeClassId}
              onValueChange={setClassId}
              disabled={!me?.isAdmin}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Сынып" />
              </SelectTrigger>
              <SelectContent>
                {(me?.isAdmin
                  ? classes
                  : classes.filter((c) => c.name === me?.profile?.class_name)
                ).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name} сынып
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>


            <Select
              value={year}
              onValueChange={(v) => {
                setYear(v);
                setPeriod("");
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

            <Select value={activePeriod} onValueChange={setPeriod}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Кезең" />
              </SelectTrigger>
              <SelectContent>
                {allPeriods.map((p) => (
                  <SelectItem key={p} value={p}>
                    {periodTitle(p)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {me?.isAdmin && (
              <Button asChild variant="outline">
                <Link to="/admin">Деректерді енгізу</Link>
              </Button>
            )}
          </div>
        </div>

        {!me?.isAdmin && <RatingAlert />}

        <div className="mt-6 inline-flex rounded-xl border border-border bg-card p-1">
          <Button
            variant={tab === "personal" ? "default" : "ghost"}
            size="sm"
            onClick={() => setTab("personal")}
          >
            Жеке мониторинг
          </Button>
          <Button
            variant={tab === "class" ? "default" : "ghost"}
            size="sm"
            onClick={() => setTab("class")}
          >
            Сынып мониторингі
          </Button>
        </div>

        {tab === "class" ? (
          <ClassMonitoring />
        ) : !current ? (
          <div className="mt-10 rounded-2xl border border-dashed border-border p-10 text-center text-muted-foreground">
            {activePeriod
              ? `${periodTitle(activePeriod)} бойынша дерек енгізілмеген.`
              : "Бұл сынып бойынша әзірге балл енгізілмеген."}
          </div>
        ) : (
          <>
            <section className="mt-8 rounded-3xl panel-dark p-6 md:p-8">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-display text-lg font-bold">
                  {activeClass?.name} сынып · {periodTitle(current.period)}
                </h2>
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs">
                  Жалпы: {total} балл / {MAX_TOTAL} балл — {percent}% ({levelLabel(percent)})
                </span>
              </div>

              <div className="mt-8 grid grid-cols-2 justify-items-center gap-6 sm:grid-cols-4">
                <MetricRing value={percent} label={`Жалпы: ${total} балл`} />
                {GROUPS.map((g, i) => {
                  const gp = groupPoints(g, current.scores);
                  const isDeduction = g === GROUPS[2];
                  const val = isDeduction ? 0 : percentOf(gp.points, gp.max);
                  return (
                    <MetricRing
                      key={g}
                      value={isDeduction ? Math.min(100, Math.abs(gp.points)) : val}
                      color={`var(--color-chart-${i + 2})`}
                      label={`${g}: ${gp.points} балл`}
                    />
                  );
                })}
              </div>
            </section>

            <section className="mt-6 grid gap-5 lg:grid-cols-3">
              <div className="rounded-2xl border border-border bg-card p-6">
                <h3 className="font-display font-bold">Жалпы нәтиже</h3>
                <p className="mt-3 font-display text-4xl font-bold text-primary">{total} балл</p>
                <p className="text-sm text-muted-foreground">
                  {percent}% · {levelLabel(percent)}
                </p>
                {prevTotal !== null && (
                  <p className="mt-4 flex items-center gap-2 text-sm">
                    <TrendingUp className="size-4 text-primary" />
                    Өткен кезеңмен салыстырғанда{" "}
                    <span className="font-semibold">
                      {total - prevTotal >= 0 ? "+" : ""}
                      {total - prevTotal} балл
                    </span>
                  </p>
                )}
              </div>

              <div className="rounded-2xl border border-border bg-card p-6 lg:col-span-2">
                <h3 className="font-display font-bold">Әлсіз бағыттар</h3>
                <ul className="mt-4 space-y-3">
                  {weakest.map(({ c, points }) => {
                    const pct = percentOf(points, criterionMax(c));
                    return (
                      <li key={c.key} className="text-sm">
                        <div className="flex justify-between gap-4">
                          <span>{c.label}</span>
                          <span className="shrink-0 font-semibold">
                            {points}/{criterionMax(c)} балл · {pct}%
                          </span>
                        </div>
                        <div className="mt-1 h-2 rounded-full bg-secondary">
                          <div
                            className="h-2 rounded-full bg-primary"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </section>

            {GROUPS.map((g) => {
              const list = CRITERIA.filter((c) => c.group === g);
              const gp = groupPoints(g, current.scores);
              return (
                <section key={g} className="mt-6 rounded-2xl border border-border bg-card p-6">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-display font-bold">{g}</h3>
                    <span className="text-sm text-muted-foreground">
                      {gp.points} балл
                      {g !== GROUPS[2] && ` / ${gp.max} балл · ${percentOf(gp.points, gp.max)}%`}
                    </span>
                  </div>
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-muted-foreground">
                          <th className="py-2 font-medium">Критерий</th>
                          <th className="py-2 text-right font-medium">Балл</th>
                          <th className="py-2 text-right font-medium">Макс.</th>
                          <th className="py-2 text-right font-medium">%</th>
                        </tr>
                      </thead>
                      <tbody>
                        {list.map((c) => {
                          const pts = criterionPoints(c, current.scores[c.key]);
                          const max = criterionMax(c);
                          return (
                            <tr key={c.key} className="border-t border-border/60">
                              <td className="py-2 pr-4">{c.label}</td>
                              <td className="py-2 text-right font-semibold">{pts}</td>
                              <td className="py-2 text-right text-muted-foreground">{max}</td>
                              <td className="py-2 text-right">
                                {max > 0 ? `${percentOf(pts, max)}%` : "—"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </section>
              );
            })}

            {current.note && (
              <p className="mt-6 rounded-2xl border border-border bg-secondary/60 p-4 text-sm">
                {current.note}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
