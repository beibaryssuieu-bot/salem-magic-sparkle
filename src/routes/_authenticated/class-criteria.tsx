import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PeriodPicker } from "@/components/period-picker";
import { useProfile, useSession } from "@/lib/auth";
import { periodTitle } from "@/lib/periods";
import { sortClassesByLiter } from "@/lib/utils";
import {
  CLASS_CRITERIA,
  CLASS_MAX_TOTAL,
  classCriterionMax,
  classCriterionPoints,
  classPercentOf,
  classTotalPoints,
  type ClassQualityRow,
  type ClassScores,
} from "@/lib/class-criteria";

export const Route = createFileRoute("/_authenticated/class-criteria")({
  head: () => ({
    meta: [
      { title: "Сынып критерийлері — TÄRBIE OS" },
      {
        name: "description",
        content:
          "«Үздік сынып» рейтингіне арналған критерийлерді енгізу: кешікпеу, қатысым, форма, гигиена, баға қоры.",
      },
      { property: "og:title", content: "Сынып критерийлері — TÄRBIE OS" },
      {
        property: "og:description",
        content: "Әкімші сыныптардың ай сайынғы критерийлік балдарын енгізеді.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ClassCriteriaPage,
});

function currentPeriod() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

function ClassCriteriaPage() {
  const { user } = useSession();
  const { data: me, isLoading: profileLoading } = useProfile(user);
  const queryClient = useQueryClient();

  const [classId, setClassId] = useState("");
  const [period, setPeriod] = useState(currentPeriod());
  const [scores, setScores] = useState<ClassScores>({});
  const [note, setNote] = useState("");

  const classesQuery = useQuery({
    queryKey: ["classes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("classes").select("id, name").order("name");
      if (error) throw error;
      return data;
    },
  });

  const qualityQuery = useQuery({
    queryKey: ["class_quality"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("class_quality")
        .select("id, class_id, period, scores, note")
        .order("period", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r) => ({
        ...r,
        scores: (r.scores ?? {}) as ClassScores,
      })) as ClassQualityRow[];
    },
  });

  const classes = useMemo(
    () => sortClassesByLiter(classesQuery.data ?? []),
    [classesQuery.data],
  );
  const activeClassId = classId || classes[0]?.id || "";
  const periodDate = period;

  useEffect(() => {
    const existing = (qualityQuery.data ?? []).find(
      (r) => r.class_id === activeClassId && r.period === periodDate,
    );
    setScores(existing?.scores ?? {});
    setNote(existing?.note ?? "");
  }, [activeClassId, periodDate, qualityQuery.data]);

  const total = classTotalPoints(scores);
  const percent = classPercentOf(total);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("class_quality").upsert(
        {
          class_id: activeClassId,
          period: periodDate,
          scores,
          note: note.trim() || null,
        },
        { onConflict: "class_id,period" },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Сынып критерийлері сақталды");
      queryClient.invalidateQueries({ queryKey: ["class_quality"] });
    },
    onError: () => toast.error("Сақтау сәтсіз аяқталды"),
  });

  if (profileLoading) {
    return <p className="p-10 text-center text-muted-foreground">Жүктелуде…</p>;
  }

  if (!me?.isAdmin) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <h1 className="font-display text-xl font-bold">Рұқсат жоқ</h1>
        <p className="mt-2 text-sm text-muted-foreground">Бұл бөлім тек әкімшіге арналған.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <h1 className="font-display text-2xl font-bold md:text-3xl">Сынып критерийлері</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        «Үздік сынып» рейтингі осы критерийлер бойынша есептеледі және сынып жетекші
        рейтингінен тәуелсіз.
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-[2fr_1fr]">
        <section className="space-y-6">
          <div className="rounded-2xl border border-border bg-card p-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Сынып</Label>
                <Select value={activeClassId} onValueChange={setClassId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Сынып таңдаңыз" />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name} сынып
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <PeriodPicker idPrefix="cc" value={period} onChange={setPeriod} />
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6">
            <h2 className="font-display font-bold">Критерийлер</h2>
            <div className="mt-4 space-y-4">
              {CLASS_CRITERIA.map((c) => {
                const pts = classCriterionPoints(c, scores[c.key]);
                return (
                  <div
                    key={c.key}
                    className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3 last:border-0 last:pb-0"
                  >
                    <div className="min-w-[220px] flex-1">
                      <p className="text-sm">{c.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {c.hint ?? `Макс. ${classCriterionMax(c)} балл`}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {c.type === "tier" ? (
                        <Select
                          value={String(scores[c.key] ?? 0)}
                          onValueChange={(v) =>
                            setScores((s) => ({ ...s, [c.key]: Number(v) }))
                          }
                        >
                          <SelectTrigger className="w-64">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {c.tiers.map((t, i) => (
                              <SelectItem key={t.label} value={String(i)}>
                                {t.label} ({t.points} балл)
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          type="number"
                          min={0}
                          max={c.max}
                          step={c.step}
                          className="w-28"
                          value={scores[c.key] ?? 0}
                          onChange={(e) =>
                            setScores((s) => ({
                              ...s,
                              [c.key]: Math.max(
                                0,
                                Math.min(c.max, Number(e.target.value) || 0),
                              ),
                            }))
                          }
                        />
                      )}
                      <span className="w-20 text-right text-sm font-semibold">{pts} балл</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6">
            <Label htmlFor="cc-note">Түсініктеме</Label>
            <Textarea
              id="cc-note"
              className="mt-2"
              value={note}
              maxLength={500}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Қосымша ескертпе (міндетті емес)"
            />
            <Button
              className="mt-4 w-full"
              onClick={() => saveMutation.mutate()}
              disabled={!activeClassId || saveMutation.isPending}
            >
              Сақтау
            </Button>
          </div>
        </section>

        <aside className="space-y-6 lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-2xl panel-dark p-6">
            <h2 className="font-display font-bold">Ағымдағы нәтиже</h2>
            <p className="mt-3 font-display text-4xl font-bold">{total} балл</p>
            <p className="text-sm opacity-80">
              {CLASS_MAX_TOTAL} баллдан · {percent}%
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6">
            <h2 className="font-display font-bold">Соңғы жазбалар</h2>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              {(qualityQuery.data ?? []).slice(0, 8).map((r) => (
                <li key={r.id} className="flex justify-between">
                  <span>{classes.find((c) => c.id === r.class_id)?.name ?? "—"}</span>
                  <span>
                    {periodTitle(r.period)} · {classTotalPoints(r.scores)} балл
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
