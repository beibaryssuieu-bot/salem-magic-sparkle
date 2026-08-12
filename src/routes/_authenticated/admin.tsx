import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  CRITERIA,
  GROUPS,
  MAX_TOTAL,
  criterionMax,
  criterionPoints,
  levelLabel,
  percentOf,
  totalPoints,
  type ClassScoreRow,
  type Scores,
} from "@/lib/criteria";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Балдық мониторингті енгізу — tarbie+" },
      {
        name: "description",
        content:
          "Әкімшіге арналған бет: сынып жетекшілерінің критерийлер бойынша айлық баллдарын енгізу.",
      },
      { property: "og:title", content: "Балдық мониторингті енгізу — tarbie+" },
      {
        property: "og:description",
        content: "Барлық сыныптар бойынша критерийлік балдарды бір жерден енгізіңіз.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminPage,
});

function currentPeriod() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

function AdminPage() {
  const { user } = useSession();
  const { data: me, isLoading: profileLoading } = useProfile(user);
  const queryClient = useQueryClient();

  const [classId, setClassId] = useState("");
  const [period, setPeriod] = useState(currentPeriod());
  const [scores, setScores] = useState<Scores>({});
  const [note, setNote] = useState("");
  const [newClass, setNewClass] = useState("");

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
        scores: (r.scores ?? {}) as Scores,
      })) as ClassScoreRow[];
    },
  });

  const classes = classesQuery.data ?? [];
  const activeClassId = classId || classes[0]?.id || "";
  const periodDate = period;

  useEffect(() => {
    const existing = (scoresQuery.data ?? []).find(
      (r) => r.class_id === activeClassId && r.period === periodDate,
    );
    setScores(existing?.scores ?? {});
    setNote(existing?.note ?? "");
  }, [activeClassId, periodDate, scoresQuery.data]);

  const total = totalPoints(scores);
  const percent = percentOf(total);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("class_scores").upsert(
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
      toast.success("Баллдар сақталды");
      queryClient.invalidateQueries({ queryKey: ["class_scores"] });
    },
    onError: () => toast.error("Сақтау сәтсіз аяқталды"),
  });

  const addClassMutation = useMutation({
    mutationFn: async () => {
      const name = newClass.trim();
      if (name.length < 1 || name.length > 20) throw new Error("invalid");
      const { error } = await supabase.from("classes").insert({ name });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Сынып қосылды");
      setNewClass("");
      queryClient.invalidateQueries({ queryKey: ["classes"] });
    },
    onError: () => toast.error("Сынып қосылмады"),
  });

  if (profileLoading) {
    return (
      <div>
        <p className="p-10 text-center text-muted-foreground">Жүктелуде…</p>
      </div>
    );
  }

  if (!me?.isAdmin) {
    return (
      <div>
        <div className="mx-auto max-w-lg px-4 py-20 text-center">
          <h1 className="font-display text-xl font-bold">Рұқсат жоқ</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Бұл бөлім тек әкімшіге (директордың тәрбие ісі жөніндегі орынбасары) арналған.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mx-auto w-full max-w-6xl px-4 py-8">
        <h1 className="font-display text-2xl font-bold md:text-3xl">Балдық мониторингті енгізу</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Сынып пен кезеңді (ай не апта) таңдап, әр критерий бойынша нәтижені белгілеңіз.
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
                <PeriodPicker idPrefix="admin" value={period} onChange={setPeriod} />
              </div>
            </div>

            {GROUPS.map((g) => (
              <div key={g} className="rounded-2xl border border-border bg-card p-6">
                <h2 className="font-display font-bold">{g}</h2>
                <div className="mt-4 space-y-4">
                  {CRITERIA.filter((c) => c.group === g).map((c) => {
                    const pts = criterionPoints(c, scores[c.key]);
                    return (
                      <div
                        key={c.key}
                        className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3 last:border-0 last:pb-0"
                      >
                        <div className="min-w-[220px] flex-1">
                          <p className="text-sm">{c.label}</p>
                          <p className="text-xs text-muted-foreground">
                            Макс. {criterionMax(c)} балл
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          {c.type === "tier" && (
                            <Select
                              value={String(scores[c.key] ?? 0)}
                              onValueChange={(v) =>
                                setScores((s) => ({ ...s, [c.key]: Number(v) }))
                              }
                            >
                              <SelectTrigger className="w-48">
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
                          )}
                          {c.type === "fixed" && (
                            <Checkbox
                              checked={Boolean(scores[c.key])}
                              onCheckedChange={(v) =>
                                setScores((s) => ({ ...s, [c.key]: v ? 1 : 0 }))
                              }
                            />
                          )}
                          {c.type === "count" && (
                            <Input
                              type="number"
                              min={0}
                              max={c.maxUnits}
                              className="w-24"
                              value={scores[c.key] ?? 0}
                              onChange={(e) =>
                                setScores((s) => ({
                                  ...s,
                                  [c.key]: Math.max(
                                    0,
                                    Math.min(c.maxUnits, Number(e.target.value) || 0),
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
            ))}

            <div className="rounded-2xl border border-border bg-card p-6">
              <Label htmlFor="note">Түсініктеме</Label>
              <Textarea
                id="note"
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
                {MAX_TOTAL} баллдан · {percent}%
              </p>
              <p className="mt-1 text-sm opacity-80">{levelLabel(percent)}</p>
            </div>

            <div className="rounded-2xl border border-border bg-card p-6">
              <h2 className="font-display font-bold">Жаңа сынып</h2>
              <div className="mt-3 flex gap-2">
                <Input
                  value={newClass}
                  maxLength={20}
                  onChange={(e) => setNewClass(e.target.value)}
                  placeholder='10 "А"'
                />
                <Button
                  variant="secondary"
                  onClick={() => addClassMutation.mutate()}
                  disabled={addClassMutation.isPending}
                >
                  Қосу
                </Button>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-6">
              <h2 className="font-display font-bold">Соңғы жазбалар</h2>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                {(scoresQuery.data ?? []).slice(0, 8).map((r) => (
                  <li key={r.id} className="flex justify-between">
                    <span>{classes.find((c) => c.id === r.class_id)?.name ?? "—"}</span>
                    <span>
                      {periodTitle(r.period)} · {totalPoints(r.scores)} балл
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
