import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/app-header";
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
import { useProfile, useSession } from "@/lib/auth";
import { METRICS, formatPeriod, type ClassMetric, type MetricKey } from "@/lib/metrics";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Көрсеткіштерді басқару — TÄRBIE OS" },
      {
        name: "description",
        content:
          "Әкімшіге арналған бет: барлық сыныптардың айлық тәрбиелік көрсеткіштерін енгізу және жаңарту.",
      },
      { property: "og:title", content: "Көрсеткіштерді басқару — TÄRBIE OS" },
      {
        property: "og:description",
        content: "Барлық сыныптар бойынша айлық шкала деректерін бір жерден енгізіңіз.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminPage,
});

const emptyValues: Record<MetricKey, number> = {
  discipline: 0,
  attendance: 0,
  reading: 0,
  volunteering: 0,
  psychology: 0,
};

function currentPeriod() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

function AdminPage() {
  const { user } = useSession();
  const { data: me, isLoading: profileLoading } = useProfile(user);
  const queryClient = useQueryClient();

  const [classId, setClassId] = useState("");
  const [period, setPeriod] = useState(currentPeriod().slice(0, 7));
  const [values, setValues] = useState<Record<MetricKey, number>>(emptyValues);
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

  const classes = classesQuery.data ?? [];
  const activeClassId = classId || classes[0]?.id || "";
  const periodDate = `${period}-01`;

  useEffect(() => {
    const existing = (metricsQuery.data ?? []).find(
      (m) => m.class_id === activeClassId && m.period === periodDate,
    );
    if (existing) {
      setValues({
        discipline: existing.discipline,
        attendance: existing.attendance,
        reading: existing.reading,
        volunteering: existing.volunteering,
        psychology: existing.psychology,
      });
      setNote(existing.note ?? "");
    } else {
      setValues(emptyValues);
      setNote("");
    }
  }, [activeClassId, periodDate, metricsQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("class_metrics").upsert(
        {
          class_id: activeClassId,
          period: periodDate,
          ...values,
          note: note.trim() || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "class_id,period" },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Көрсеткіштер сақталды");
      queryClient.invalidateQueries({ queryKey: ["metrics"] });
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
      <div className="min-h-screen bg-background">
        <AppHeader />
        <p className="p-10 text-center text-muted-foreground">Жүктелуде…</p>
      </div>
    );
  }

  if (!me?.isAdmin) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
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
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto w-full max-w-5xl px-4 py-10">
        <h1 className="font-display text-2xl font-bold md:text-3xl">Көрсеткіштерді енгізу</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Сынып пен айды таңдап, 0–100 аралығындағы мәндерді енгізіңіз.
        </p>

        <div className="mt-8 grid gap-6 lg:grid-cols-[2fr_1fr]">
          <section className="rounded-2xl border border-border bg-card p-6">
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
              <div className="space-y-2">
                <Label htmlFor="period">Ай</Label>
                <Input
                  id="period"
                  type="month"
                  value={period}
                  onChange={(e) => setPeriod(e.target.value)}
                />
              </div>
            </div>

            <div className="mt-6 space-y-4">
              {METRICS.map((m) => (
                <div key={m.key} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <Label htmlFor={m.key}>{m.label}</Label>
                    <span className="font-semibold">{values[m.key]}%</span>
                  </div>
                  <Input
                    id={m.key}
                    type="range"
                    min={0}
                    max={100}
                    value={values[m.key]}
                    onChange={(e) =>
                      setValues((v) => ({ ...v, [m.key]: Number(e.target.value) }))
                    }
                    className="h-2 cursor-pointer p-0 accent-[var(--color-primary)]"
                  />
                </div>
              ))}
            </div>

            <div className="mt-6 space-y-2">
              <Label htmlFor="note">Түсініктеме</Label>
              <Textarea
                id="note"
                value={note}
                maxLength={500}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Қосымша ескертпе (міндетті емес)"
              />
            </div>

            <Button
              className="mt-6 w-full"
              onClick={() => saveMutation.mutate()}
              disabled={!activeClassId || saveMutation.isPending}
            >
              Сақтау
            </Button>
          </section>

          <aside className="space-y-6">
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
                {(metricsQuery.data ?? []).slice(0, 8).map((m) => (
                  <li key={m.id} className="flex justify-between">
                    <span>{classes.find((c) => c.id === m.class_id)?.name ?? "—"}</span>
                    <span>{formatPeriod(m.period)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
