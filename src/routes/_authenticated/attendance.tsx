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
import { AttendanceGrid, type GridCell } from "@/components/attendance-grid";
import { useProfile, useSession } from "@/lib/auth";
import { mondayOf } from "@/lib/periods";
import { sortClassesByLiter } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/attendance")({
  head: () => ({
    meta: [
      { title: "Қатысым — TÄRBIE OS" },
      {
        name: "description",
        content: "Сыныптардың күнделікті, апталық және айлық сабаққа қатысу мониторингі.",
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

function shiftMonth(month: string, delta: number) {
  const y = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7));
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthBounds(month: string) {
  const y = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7));
  const endDate = new Date(y, m, 0);
  return {
    start: `${month}-01`,
    end: `${month}-${String(endDate.getDate()).padStart(2, "0")}`,
    dayCount: endDate.getDate(),
  };
}

const WEEK_LABELS = ["Дүйсенбі", "Сейсенбі", "Сәрсенбі", "Бейсенбі", "Жұма"];

function weekDays(monday: string) {
  return Array.from({ length: 5 }, (_, i) => shiftDay(monday, i));
}

function shortDate(iso: string) {
  return `${iso.slice(8, 10)}.${iso.slice(5, 7)}`;
}

function toCells(rows: AttendanceRow[]) {
  const map = new Map<string, GridCell>();
  for (const r of rows) {
    map.set(`${r.class_id}|${r.day}`, {
      present: r.present_students,
      total: r.total_students,
    });
  }
  return map;
}

function useRangeAttendance(from: string, to: string, enabled: boolean, classId?: string) {
  return useQuery({
    queryKey: ["attendance-range", from, to, classId ?? "all"],
    enabled,
    queryFn: async () => {
      let q = supabase
        .from("attendance")
        .select("id, class_id, day, total_students, present_students, comment")
        .gte("day", from)
        .lte("day", to);
      if (classId) q = q.eq("class_id", classId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as AttendanceRow[];
    },
  });
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

function WeekNav({ monday, onChange }: { monday: string; onChange: (m: string) => void }) {
  const days = weekDays(monday);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button variant="outline" size="icon" onClick={() => onChange(shiftDay(monday, -7))}>
        <ChevronLeft className="size-4" />
      </Button>
      <span className="text-sm font-medium">
        {shortDate(days[0])} – {shortDate(days[4])}
      </span>
      <Button variant="outline" size="icon" onClick={() => onChange(shiftDay(monday, 7))}>
        <ChevronRight className="size-4" />
      </Button>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => onChange(mondayOf(new Date().toISOString().slice(0, 10)))}
      >
        Ағымдағы апта
      </Button>
    </div>
  );
}

function MonthNav({ month, onChange }: { month: string; onChange: (m: string) => void }) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <Button variant="outline" size="icon" onClick={() => onChange(shiftMonth(month, -1))}>
        <ChevronLeft className="size-4" />
      </Button>
      <div className="space-y-1">
        <Label htmlFor="att-month">Ай</Label>
        <Input
          id="att-month"
          type="month"
          value={month}
          onChange={(e) => e.target.value && onChange(e.target.value)}
          className="w-44"
        />
      </div>
      <Button variant="outline" size="icon" onClick={() => onChange(shiftMonth(month, 1))}>
        <ChevronRight className="size-4" />
      </Button>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => onChange(new Date().toISOString().slice(0, 7))}
      >
        Ағымдағы ай
      </Button>
    </div>
  );
}

function ModeSwitch({
  mode,
  onChange,
  items,
}: {
  mode: string;
  onChange: (m: string) => void;
  items: { value: string; label: string }[];
}) {
  return (
    <div className="inline-flex rounded-xl border border-border bg-card p-1">
      {items.map((i) => (
        <Button
          key={i.value}
          variant={mode === i.value ? "default" : "ghost"}
          size="sm"
          onClick={() => onChange(i.value)}
        >
          {i.label}
        </Button>
      ))}
    </div>
  );
}

function AdminAttendanceView() {
  const [mode, setMode] = useState<"day" | "week" | "month">("day");
  const [day, setDay] = useState(new Date().toISOString().slice(0, 10));
  const [monday, setMonday] = useState(mondayOf(new Date().toISOString().slice(0, 10)));
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));

  const classesQuery = useQuery({
    queryKey: ["classes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("classes").select("id, name").order("name");
      if (error) throw error;
      return data;
    },
  });

  const classes = useMemo(
    () => sortClassesByLiter(classesQuery.data ?? []),
    [classesQuery.data],
  );

  const dayQuery = useRangeAttendance(day, day, mode === "day");
  const week = weekDays(monday);
  const weekQuery = useRangeAttendance(week[0], week[4], mode === "week");
  const bounds = monthBounds(month);
  const monthQuery = useRangeAttendance(bounds.start, bounds.end, mode === "month");

  const dayRows = dayQuery.data ?? [];
  const byClass = useMemo(() => {
    const map = new Map<string, AttendanceRow>();
    for (const r of dayRows) map.set(r.class_id, r);
    return map;
  }, [dayRows]);

  const rows = classes.map((c) => {
    const r = byClass.get(c.id);
    const total = r?.total_students ?? 0;
    const present = r?.present_students ?? 0;
    return {
      classId: c.id,
      name: c.name,
      total,
      present,
      percent: total > 0 ? Math.round((present / total) * 100) : null,
      comment: r?.comment ?? null,
    };
  });

  const withData = rows.filter((r) => r.total > 0);
  const avgPercent =
    withData.length > 0
      ? Math.round(withData.reduce((s, r) => s + (r.percent ?? 0), 0) / withData.length)
      : null;

  const monthDays = Array.from(
    { length: bounds.dayCount },
    (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`,
  );

  return (
    <>
      <p className="mt-2 text-sm text-muted-foreground">
        Барлық сыныптардың қатысу деректерін күн, апта және ай бойынша бақылаңыз.
      </p>

      <div className="mt-6">
        <ModeSwitch
          mode={mode}
          onChange={(m) => setMode(m as typeof mode)}
          items={[
            { value: "day", label: "Күндік" },
            { value: "week", label: "Апталық" },
            { value: "month", label: "Айлық" },
          ]}
        />
      </div>

      {mode === "day" && (
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
      )}

      {mode === "week" && (
        <>
          <div className="mt-6">
            <WeekNav monday={monday} onChange={setMonday} />
          </div>
          <section className="mt-6 rounded-2xl border border-border bg-card p-4">
            <AttendanceGrid
              classes={classes}
              days={week}
              dayLabels={WEEK_LABELS.map((l, i) => `${l} (${shortDate(week[i])})`)}
              cells={toCells(weekQuery.data ?? [])}
              totalLabel="Апталық жалпы"
              fileName={`qatysym-apta-${monday}.xlsx`}
              emptyText="Сыныптар тізімі жүктелуде…"
            />
          </section>
        </>
      )}

      {mode === "month" && (
        <>
          <div className="mt-6">
            <MonthNav month={month} onChange={setMonth} />
          </div>
          <section className="mt-6 rounded-2xl border border-border bg-card p-4">
            <AttendanceGrid
              classes={classes}
              days={monthDays}
              dayLabels={monthDays.map((d) => String(Number(d.slice(8, 10))))}
              cells={toCells(monthQuery.data ?? [])}
              totalLabel="Айлық жалпы"
              fileName={`qatysym-${month}.xlsx`}
              emptyText="Сыныптар тізімі жүктелуде…"
            />
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
  const [mode, setMode] = useState<"week" | "month">("week");
  const [monday, setMonday] = useState(mondayOf(new Date().toISOString().slice(0, 10)));
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));

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

  const week = weekDays(monday);
  const bounds = monthBounds(month);
  const weekQuery = useRangeAttendance(week[0], week[4], !!myClass && mode === "week", myClass?.id);
  const monthQuery = useRangeAttendance(
    bounds.start,
    bounds.end,
    !!myClass && mode === "month",
    myClass?.id,
  );

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
      queryClient.invalidateQueries({ queryKey: ["attendance-range"] });
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
        Сізге сынып тағайындалмаған. Әкімшіден профильде сыныпты көрсетуді сұраңыз.
      </div>
    );
  }

  const monthDays = Array.from(
    { length: bounds.dayCount },
    (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`,
  );
  const gridClasses = [{ id: myClass.id, name: myClass.name }];

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

      <section className="mt-6 rounded-2xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 px-2 pb-3">
          <h2 className="font-display font-bold">
            {myClass.name} сыныбының қатысым кестесі
          </h2>
          <ModeSwitch
            mode={mode}
            onChange={(m) => setMode(m as typeof mode)}
            items={[
              { value: "week", label: "Апталық" },
              { value: "month", label: "Айлық" },
            ]}
          />
        </div>

        <div className="px-2 pb-4">
          {mode === "week" ? (
            <WeekNav monday={monday} onChange={setMonday} />
          ) : (
            <MonthNav month={month} onChange={setMonth} />
          )}
        </div>

        {mode === "week" ? (
          <AttendanceGrid
            classes={gridClasses}
            days={week}
            dayLabels={WEEK_LABELS.map((l, i) => `${l} (${shortDate(week[i])})`)}
            cells={toCells(weekQuery.data ?? [])}
            totalLabel="Апталық жалпы"
            fileName={`qatysym-${myClass.name}-apta-${monday}.xlsx`}
          />
        ) : (
          <AttendanceGrid
            classes={gridClasses}
            days={monthDays}
            dayLabels={monthDays.map((d) => String(Number(d.slice(8, 10))))}
            cells={toCells(monthQuery.data ?? [])}
            totalLabel="Айлық жалпы"
            fileName={`qatysym-${myClass.name}-${month}.xlsx`}
          />
        )}
      </section>
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
