import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/app-header";
import { MetricRing } from "@/components/metric-ring";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useProfile, useSession } from "@/lib/auth";
import {
  METRICS,
  formatPeriod,
  indexLabel,
  overallIndex,
  type ClassMetric,
} from "@/lib/metrics";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Сыныптың шкаласы — TÄRBIE OS" },
      {
        name: "description",
        content:
          "Сынып жетекшісіне арналған дашборд: тәртіп, қатысу, кітап оқу, волонтерлік және психологиялық ахуал көрсеткіштері.",
      },
      { property: "og:title", content: "Сыныптың шкаласы — TÄRBIE OS" },
      {
        property: "og:description",
        content: "Өз сыныбыңыздың айлық тәрбиелік көрсеткіштерін бір экраннан бақылаңыз.",
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
  const [period, setPeriod] = useState<string>("");

  const classesQuery = useQuery({
    queryKey: ["classes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("classes").select("id, name").order("name");
      if (error) throw error;
      return data;
    },
  });

  const metricsQuery = useQuery({
    queryKey: ["metrics"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("class_metrics")
        .select("*")
        .order("period", { ascending: false });
      if (error) throw error;
      return data as ClassMetric[];
    },
  });

  const eventsQuery = useQuery({
    queryKey: ["events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .order("event_date", { ascending: false })
        .limit(4);
      if (error) throw error;
      return data;
    },
  });

  const classes = classesQuery.data ?? [];
  const myClassId = useMemo(() => {
    const mine = classes.find((c) => c.name === me?.profile?.class_name);
    return mine?.id ?? classes[0]?.id ?? "";
  }, [classes, me?.profile?.class_name]);

  const activeClassId = classId || myClassId;
  const classMetrics = (metricsQuery.data ?? []).filter((m) => m.class_id === activeClassId);
  const activePeriod = period || classMetrics[0]?.period || "";
  const current = classMetrics.find((m) => m.period === activePeriod);
  const previous = classMetrics.find((m) => m.period < activePeriod);
  const activeClass = classes.find((c) => c.id === activeClassId);

  const weakest = current
    ? METRICS.map((m) => ({ ...m, value: current[m.key] })).sort((a, b) => a.value - b.value).slice(0, 3)
    : [];

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto w-full max-w-7xl px-4 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">
              Сәлеметсіз бе, {me?.profile?.full_name || me?.profile?.username}
            </p>
            <h1 className="font-display text-2xl font-bold md:text-3xl">Тәрбиелік көрсеткіштер</h1>
          </div>

          <div className="flex flex-wrap gap-2">
            <Select value={activeClassId} onValueChange={setClassId}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Сынып" />
              </SelectTrigger>
              <SelectContent>
                {classes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name} сынып
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={activePeriod} onValueChange={setPeriod}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Кезең" />
              </SelectTrigger>
              <SelectContent>
                {classMetrics.map((m) => (
                  <SelectItem key={m.id} value={m.period}>
                    {formatPeriod(m.period)}
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

        {!current ? (
          <div className="mt-10 rounded-2xl border border-dashed border-border p-10 text-center text-muted-foreground">
            Бұл сынып бойынша әзірге көрсеткіш енгізілмеген.
          </div>
        ) : (
          <>
            <section className="mt-8 rounded-3xl panel-dark p-6 md:p-8">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-display text-lg font-bold">
                  {activeClass?.name} сынып · {formatPeriod(current.period)}
                </h2>
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs">
                  Жалпы индекс: {overallIndex(current)}% — {indexLabel(overallIndex(current))}
                </span>
              </div>
              <div className="mt-8 grid grid-cols-2 justify-items-center gap-6 sm:grid-cols-3 lg:grid-cols-5">
                {METRICS.map((m) => (
                  <MetricRing
                    key={m.key}
                    value={current[m.key]}
                    label={m.label}
                    color={m.color}
                  />
                ))}
              </div>
            </section>

            <section className="mt-6 grid gap-5 lg:grid-cols-3">
              <div className="rounded-2xl border border-border bg-card p-6">
                <h3 className="font-display font-bold">Жалпы индекс</h3>
                <p className="mt-3 font-display text-4xl font-bold text-primary">
                  {overallIndex(current)}%
                </p>
                <p className="text-sm text-muted-foreground">{indexLabel(overallIndex(current))}</p>
                {previous && (
                  <p className="mt-4 flex items-center gap-2 text-sm">
                    <TrendingUp className="size-4 text-primary" />
                    Өткен кезеңмен салыстырғанда{" "}
                    <span className="font-semibold">
                      {overallIndex(current) - overallIndex(previous) >= 0 ? "+" : ""}
                      {overallIndex(current) - overallIndex(previous)}%
                    </span>
                  </p>
                )}
              </div>

              <div className="rounded-2xl border border-border bg-card p-6">
                <h3 className="font-display font-bold">Әлсіз бағыттар</h3>
                <ul className="mt-4 space-y-3">
                  {weakest.map((m) => (
                    <li key={m.key} className="text-sm">
                      <div className="flex justify-between">
                        <span>{m.label}</span>
                        <span className="font-semibold">{m.value}%</span>
                      </div>
                      <div className="mt-1 h-2 rounded-full bg-secondary">
                        <div
                          className="h-2 rounded-full"
                          style={{ width: `${m.value}%`, background: m.color }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-2xl border border-border bg-card p-6">
                <h3 className="flex items-center gap-2 font-display font-bold">
                  <AlertTriangle className="size-4 text-[var(--color-warning)]" /> Ұсыныстар
                </h3>
                <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                  {weakest.map((m) => (
                    <li key={m.key} className="flex gap-2">
                      <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
                      {m.label} бағытын күшейту үшін келесі айға арнайы іс-шара жоспарлаңыз.
                    </li>
                  ))}
                </ul>
                {current.note && (
                  <p className="mt-4 rounded-lg bg-secondary p-3 text-sm">{current.note}</p>
                )}
              </div>
            </section>
          </>
        )}

        <section className="mt-6 rounded-2xl border border-border bg-card p-6">
          <h3 className="font-display font-bold">Соңғы іс-шаралар</h3>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {(eventsQuery.data ?? []).map((e) => (
              <li key={e.id} className="rounded-xl bg-secondary/60 p-4 text-sm">
                <p className="font-medium">{e.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{e.event_date}</p>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
