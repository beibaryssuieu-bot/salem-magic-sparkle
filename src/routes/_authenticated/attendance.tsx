import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useProfile, useSession } from "@/lib/auth";
import { sortClassesByLiter } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/attendance")({
  head: () => ({
    meta: [
      { title: "Қатысым — TÄRBIE OS" },
      {
        name: "description",
        content: "Сыныптардың күнделікті сабаққа қатысу мониторингі.",
      },
      { property: "og:title", content: "Қатысым — TÄRBIE OS" },
      {
        property: "og:description",
        content: "Сынып жетекшілері күндік қатысымды енгізеді, әкімші бақылайды.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AttendancePage,
});

type AttendanceRow = {
  id: string;
  class_id: string;
  day: string;
  total_students: number;
  present_students: number;
  comment: string | null;
};

function shiftDay(iso: string, delta: number) {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
}

function DayPicker({ day, onChange }: { day: string; onChange: (d: string) => void }) {
  const dayLabel = new Date(day + "T12:00:00").toLocaleDateString("kk-KZ", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <>
      <div className="flex flex-wrap items-end gap-3">
        <Button variant="outline" size="icon" onClick={() => onChange(shiftDay(day, -1))}>
          <ChevronLeft className="size-4" />
        </Button>
        <div className="space-y-1">
          <Label htmlFor="att-day">Күні</Label>
          <Input
            id="att-day"
            type="date"
            value={day}
            onChange={(e) => onChange(e.target.value)}
            className="w-44"
          />
        </div>
        <Button variant="outline" size="icon" onClick={() => onChange(shiftDay(day, 1))}>
          <ChevronRight className="size-4" />
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onChange(new Date().toISOString().slice(0, 10))}
        >
          Бүгін
        </Button>
      </div>
      <p className="mt-2 text-sm capitalize text-muted-foreground">{dayLabel}</p>
    </>
  );
}

function monthBounds(month: string) {
  const y = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7));
  const start = `${month}-01`;
  const endDate = new Date(y, m, 0);
  const end = `${month}-${String(endDate.getDate()).padStart(2, "0")}`;
  return { start, end };
}

function AdminAttendanceView() {
  const [mode, setMode] = useState<"day" | "month">("day");
  const [day, setDay] = useState(new Date().toISOString().slice(0, 10));
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));

  const classesQuery = useQuery({
    queryKey: ["classes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("classes").select("id, name").order("name");
      if (error) throw error;
      return data;
    },
  });

  const attendanceQuery = useQuery({
    queryKey: ["attendance", day],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance")
        .select("id, class_id, day, total_students, present_students, comment")
        .eq("day", day);
      if (error) throw error;
      return (data ?? []) as AttendanceRow[];
    },
  });

  const monthQuery = useQuery({
    queryKey: ["attendance-month", month],
    enabled: mode === "month",
    queryFn: async () => {
      const { start, end } = monthBounds(month);
      const { data, error } = await supabase
        .from("attendance")
        .select("id, class_id, day, total_students, present_students, comment")
        .gte("day", start)
        .lte("day", end);
      if (error) throw error;
      return (data ?? []) as AttendanceRow[];
    },
  });

  const classes = useMemo(
    () => sortClassesByLiter(classesQuery.data ?? []),
    [classesQuery.data],
  );

  const monthDays = useMemo(() => {
    const y = Number(month.slice(0, 4));
    const m = Number(month.slice(5, 7));
    const count = new Date(y, m, 0).getDate();
    return Array.from({ length: count }, (_, i) => i + 1);
  }, [month]);

  const monthCells = useMemo(() => {
    const map = new Map<string, AttendanceRow>();
    for (const r of monthQuery.data ?? []) map.set(`${r.class_id}|${r.day}`, r);
    return map;
  }, [monthQuery.data]);

  const monthRows = useMemo(() => {
    const byClass = new Map<string, AttendanceRow[]>();
    for (const r of monthQuery.data ?? []) {
      const list = byClass.get(r.class_id) ?? [];
      list.push(r);
      byClass.set(r.class_id, list);
    }
    return classes.map((c) => {
      const list = byClass.get(c.id) ?? [];
      const total = list.reduce((s2, r) => s2 + r.total_students, 0);
      const present = list.reduce((s2, r) => s2 + r.present_students, 0);
      return {
        classId: c.id,
        name: c.name,
        days: list.length,
        total,
        present,
        percent: total > 0 ? Math.round((present / total) * 100) : null,
      };
    });
  }, [monthQuery.data, classes]);


  const byClass = useMemo(() => {
    const map = new Map<string, AttendanceRow>();
    for (const r of attendanceQuery.data ?? []) map.set(r.class_id, r);
    return map;
  }, [attendanceQuery.data]);

  const rows = classes.map((c) => {
    const r = byClass.get(c.id);
    const total = r?.total_students ?? 0;
    const present = r?.present_students ?? 0;
    const percent = total > 0 ? Math.round((present / total) * 100) : null;
    return { classId: c.id, name: c.name, total, present, percent, comment: r?.comment ?? null };
  });

  const withData = rows.filter((r) => r.total > 0);
  const avgPercent =
    withData.length > 0
      ? Math.round(withData.reduce((s, r) => s + (r.percent ?? 0), 0) / withData.length)
      : null;

  const monthAvg = (() => {
    const withRows = monthRows.filter((r) => r.total > 0);
    if (withRows.length === 0) return null;
    return Math.round(withRows.reduce((s, r) => s + (r.percent ?? 0), 0) / withRows.length);
  })();

  return (
    <>
      <p className="mt-2 text-sm text-muted-foreground">
        Барлық сыныптардың қатысу деректерін күн және ай бойынша бақылаңыз.
      </p>

      <div className="mt-6 inline-flex rounded-xl border border-border bg-card p-1">
        <Button
          variant={mode === "day" ? "default" : "ghost"}
          size="sm"
          onClick={() => setMode("day")}
        >
          Күндік
        </Button>
        <Button
          variant={mode === "month" ? "default" : "ghost"}
          size="sm"
          onClick={() => setMode("month")}
        >
          Айлық
        </Button>
      </div>

      {mode === "day" ? (
        <>
          <div className="mt-6">
            <DayPicker day={day} onChange={setDay} />
          </div>

          {avgPercent !== null && (
            <p className="mt-4 rounded-xl border border-border bg-secondary/40 px-4 py-3 text-sm">
              Орташа қатысу: <span className="font-semibold">{avgPercent}%</span> ·{" "}
              {withData.length} сынып дерек енгізген
            </p>
          )}


      <section className="mt-6 rounded-2xl border border-border bg-card p-6">
        {classes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Сыныптар тізімі жүктелуде…</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="py-2 font-medium">Сынып</th>
                  <th className="py-2 text-right font-medium">Келгені</th>
                  <th className="py-2 text-right font-medium">Қатысу %</th>
                  <th className="py-2 font-medium">Ескертпе</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.classId} className="border-t border-border/60">
                    <td className="py-2.5 pr-3 font-medium">{r.name} сынып</td>
                    <td className="py-2.5 text-right">
                      {r.total > 0 ? (
                        <span>
                          {r.present}/{r.total}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="py-2.5 text-right">
                      {r.percent !== null ? (
                        <span
                          className={
                            r.percent >= 90
                              ? "font-semibold text-primary"
                              : r.percent >= 75
                                ? "font-semibold"
                                : "font-semibold text-destructive"
                          }
                        >
                          {r.percent}%
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="py-2.5 pl-3 text-muted-foreground">{r.comment ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
        </>
      ) : (
        <>
          <div className="mt-6 flex flex-wrap items-end gap-3">
            <Button variant="outline" size="icon" onClick={() => setMonth(shiftMonth(month, -1))}>
              <ChevronLeft className="size-4" />
            </Button>
            <div className="space-y-1">
              <Label htmlFor="att-month">Ай</Label>
              <Input
                id="att-month"
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="w-44"
              />
            </div>
            <Button variant="outline" size="icon" onClick={() => setMonth(shiftMonth(month, 1))}>
              <ChevronRight className="size-4" />
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setMonth(new Date().toISOString().slice(0, 7))}
            >
              Ағымдағы ай
            </Button>
          </div>

          {monthAvg !== null && (
            <p className="mt-4 rounded-xl border border-border bg-secondary/40 px-4 py-3 text-sm">
              Ай бойынша орташа қатысу:{" "}
              <span className="font-semibold">{monthAvg}%</span>
            </p>
          )}

          <section className="mt-6 rounded-2xl border border-border bg-card p-4">
            {classes.length === 0 ? (
              <p className="text-sm text-muted-foreground">Сыныптар тізімі жүктелуде…</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-max min-w-full border-separate border-spacing-0 text-xs">
                  <thead>
                    <tr>
                      <th className="sticky left-0 z-10 bg-card px-2 py-2 text-left font-medium text-muted-foreground">
                        Сынып
                      </th>
                      {monthDays.map((d) => (
                        <th
                          key={d}
                          className="w-9 px-1 py-2 text-center font-medium text-muted-foreground"
                        >
                          {d}
                        </th>
                      ))}
                      <th className="px-2 py-2 text-right font-medium text-muted-foreground">
                        Орташа
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthRows.map((r) => (
                      <tr key={r.classId}>
                        <td className="sticky left-0 z-10 whitespace-nowrap border-t border-border/60 bg-card px-2 py-1.5 font-medium">
                          {r.name}
                        </td>
                        {monthDays.map((d) => {
                          const iso = `${month}-${String(d).padStart(2, "0")}`;
                          const cell = monthCells.get(`${r.classId}|${iso}`);
                          const pct =
                            cell && cell.total_students > 0
                              ? Math.round((cell.present_students / cell.total_students) * 100)
                              : null;
                          return (
                            <td
                              key={d}
                              title={
                                cell
                                  ? `${r.name} · ${iso} · ${cell.present_students}/${cell.total_students}${cell.comment ? ` · ${cell.comment}` : ""}`
                                  : `${r.name} · ${iso} · дерек жоқ`
                              }
                              className={
                                "border-t border-border/60 px-1 py-1.5 text-center tabular-nums " +
                                (pct === null
                                  ? "text-muted-foreground/50"
                                  : pct >= 90
                                    ? "font-semibold text-primary"
                                    : pct >= 75
                                      ? "font-semibold"
                                      : "font-semibold text-destructive")
                              }
                            >
                              {pct === null ? "—" : pct}
                            </td>
                          );
                        })}
                        <td className="border-t border-border/60 px-2 py-1.5 text-right">
                          {r.percent !== null ? (
                            <span
                              className={
                                r.percent >= 90
                                  ? "font-semibold text-primary"
                                  : r.percent >= 75
                                    ? "font-semibold"
                                    : "font-semibold text-destructive"
                              }
                            >
                              {r.percent}%
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="mt-3 text-xs text-muted-foreground">
              Ұяшықтағы сан — сол күнгі қатысу пайызы. «—» деген белгі дерек енгізілмегенін
              білдіреді.
            </p>
          </section>

        </>
      )}
    </>
  );
}

function TeacherAttendanceView() {
  const { user } = useSession();
  const { data: me } = useProfile(user);
  const queryClient = useQueryClient();

  const [day, setDay] = useState(new Date().toISOString().slice(0, 10));
  const [total, setTotal] = useState(0);
  const [present, setPresent] = useState(0);
  const [comment, setComment] = useState("");

  const classesQuery = useQuery({
    queryKey: ["classes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("classes").select("id, name").order("name");
      if (error) throw error;
      return data;
    },
  });

  const myClass = useMemo(
    () => (classesQuery.data ?? []).find((c) => c.name === me?.profile?.class_name),
    [classesQuery.data, me?.profile?.class_name],
  );

  const attendanceQuery = useQuery({
    queryKey: ["attendance", myClass?.id],
    enabled: !!myClass?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance")
        .select("id, class_id, day, total_students, present_students, comment")
        .eq("class_id", myClass!.id)
        .order("day", { ascending: false })
        .limit(30);
      if (error) throw error;
      return (data ?? []) as AttendanceRow[];
    },
  });

  useEffect(() => {
    const existing = (attendanceQuery.data ?? []).find((r) => r.day === day);
    setTotal(existing?.total_students ?? 0);
    setPresent(existing?.present_students ?? 0);
    setComment(existing?.comment ?? "");
  }, [day, attendanceQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("attendance").upsert(
        {
          user_id: user!.id,
          class_id: myClass!.id,
          day,
          total_students: total,
          present_students: present,
          comment: comment.trim() || null,
        },
        { onConflict: "class_id,day" },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Қатысым сақталды");
      queryClient.invalidateQueries({ queryKey: ["attendance"] });
    },
    onError: () => toast.error("Сақтау сәтсіз аяқталды"),
  });

  const percent = total > 0 ? Math.round((present / total) * 100) : 0;
  const recentRows = attendanceQuery.data ?? [];
  const today = new Date().toISOString().slice(0, 10);
  const editable = day === today;

  if (!myClass) {
    return (
      <div className="mt-10 rounded-2xl border border-dashed border-border p-10 text-center text-muted-foreground">
        Сізге сынып тағайындалмаған. Әкімшiden профильде сыныпты көрсетуді сұраңыз.
      </div>
    );
  }

  return (
    <>
      <p className="mt-2 text-sm text-muted-foreground">
        {myClass.name} сыныбының күн сайынғы қатысуын белгілеп отырыңыз.
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_2fr]">
        <section className="rounded-2xl border border-border bg-card p-6">
          <h2 className="font-display font-bold">Күндік белгі — {myClass.name} сынып</h2>
          <div className="mt-4 space-y-4">
            <DayPicker day={day} onChange={setDay} />
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="a-total">Барлығы</Label>
                <Input
                  id="a-total"
                  type="number"
                  min={0}
                  max={60}
                  value={total}
                  disabled={!editable}
                  onChange={(e) =>
                    setTotal(Math.max(0, Math.min(60, Number(e.target.value) || 0)))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="a-present">Келгені</Label>
                <Input
                  id="a-present"
                  type="number"
                  min={0}
                  max={60}
                  value={present}
                  disabled={!editable}
                  onChange={(e) =>
                    setPresent(Math.max(0, Math.min(60, Number(e.target.value) || 0)))
                  }
                />
              </div>
            </div>
            <p className="text-sm text-muted-foreground">Қатысу: {percent}%</p>
            <div className="space-y-2">
              <Label htmlFor="a-comment">Ескертпе</Label>
              <Textarea
                id="a-comment"
                value={comment}
                maxLength={500}
                disabled={!editable}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Себебі, ескертпе"
              />
            </div>
            <Button
              className="w-full"
              onClick={() => saveMutation.mutate()}
              disabled={!editable || saveMutation.isPending}
            >
              Сақтау
            </Button>
            {!editable && (
              <p className="rounded-xl border border-border bg-secondary/40 px-4 py-3 text-sm text-muted-foreground">
                Өткен күндерді өзгерту мүмкін емес — тек ағымдағы күн белгіленеді.
              </p>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-6">
          <h2 className="font-display font-bold">Соңғы жазбалар</h2>
          {recentRows.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">Әзірге дерек жоқ.</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground">
                    <th className="py-2 font-medium">Күні</th>
                    <th className="py-2 text-right font-medium">Келгені</th>
                    <th className="py-2 text-right font-medium">%</th>
                    <th className="py-2 font-medium">Ескертпе</th>
                  </tr>
                </thead>
                <tbody>
                  {recentRows.map((r) => (
                    <tr key={r.id} className="border-t border-border/60">
                      <td className="py-2 pr-3">
                        {new Date(r.day + "T12:00:00").toLocaleDateString("kk-KZ")}
                      </td>
                      <td className="py-2 text-right">
                        {r.present_students}/{r.total_students}
                      </td>
                      <td className="py-2 text-right">
                        {r.total_students > 0
                          ? Math.round((r.present_students / r.total_students) * 100)
                          : 0}
                        %
                      </td>
                      <td className="py-2 pl-3 text-muted-foreground">{r.comment ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </>
  );
}

function AttendancePage() {
  const { user } = useSession();
  const { data: me } = useProfile(user);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <h1 className="font-display text-2xl font-bold md:text-3xl">Қатысым</h1>
      {me?.isAdmin ? <AdminAttendanceView /> : <TeacherAttendanceView />}
    </div>
  );
}
