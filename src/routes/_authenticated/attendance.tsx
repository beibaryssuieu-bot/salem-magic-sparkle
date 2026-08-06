import { useEffect, useState } from "react";
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
import { useProfile, useSession } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/attendance")({
  head: () => ({
    meta: [
      { title: "Қатысым — TÄRBIE OS" },
      {
        name: "description",
        content:
          "Сынып жетекшілерінің күнделікті сабаққа қатысым есебі: жалпы оқушы саны, келгендер саны және түсініктеме.",
      },
      { property: "og:title", content: "Қатысым — TÄRBIE OS" },
      {
        property: "og:description",
        content: "Күн сайынғы қатысым деректері әкімшіге көрінеді.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AttendancePage,
});

type AttendanceRow = {
  id: string;
  user_id: string;
  class_id: string;
  day: string;
  total_students: number;
  present_students: number;
  comment: string | null;
};

function AttendancePage() {
  const { user } = useSession();
  const { data: me } = useProfile(user);
  const queryClient = useQueryClient();

  const [classId, setClassId] = useState("");
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

  const attendanceQuery = useQuery({
    queryKey: ["attendance"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance")
        .select("id, user_id, class_id, day, total_students, present_students, comment")
        .order("day", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as AttendanceRow[];
    },
  });

  const classes = classesQuery.data ?? [];
  const myClass = classes.find((c) => c.name === me?.profile?.class_name);
  const activeClassId = classId || myClass?.id || classes[0]?.id || "";

  useEffect(() => {
    const existing = (attendanceQuery.data ?? []).find(
      (r) => r.class_id === activeClassId && r.day === day,
    );
    setTotal(existing?.total_students ?? 0);
    setPresent(existing?.present_students ?? 0);
    setComment(existing?.comment ?? "");
  }, [activeClassId, day, attendanceQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("attendance").upsert(
        {
          user_id: user!.id,
          class_id: activeClassId,
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

  const rows = attendanceQuery.data ?? [];
  const percent = total > 0 ? Math.round((present / total) * 100) : 0;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <h1 className="font-display text-2xl font-bold md:text-3xl">Қатысым</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Күн сайын сыныптағы оқушылардың қатысымын белгілеп отырыңыз.
        {me?.isAdmin ? " Әкімші барлық сыныптардың деректерін көреді." : ""}
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_2fr]">
        <section className="rounded-2xl border border-border bg-card p-6">
          <h2 className="font-display font-bold">Күндік белгі</h2>
          <div className="mt-4 space-y-4">
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
              <Label htmlFor="a-day">Күні</Label>
              <Input
                id="a-day"
                type="date"
                value={day}
                onChange={(e) => setDay(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="a-total">Барлығы</Label>
                <Input
                  id="a-total"
                  type="number"
                  min={0}
                  max={60}
                  value={total}
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
                  onChange={(e) =>
                    setPresent(Math.max(0, Math.min(60, Number(e.target.value) || 0)))
                  }
                />
              </div>
            </div>
            <p className="text-sm text-muted-foreground">Қатысым: {percent}%</p>
            <div className="space-y-2">
              <Label htmlFor="a-comment">Комментарий</Label>
              <Textarea
                id="a-comment"
                value={comment}
                maxLength={500}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Себебі, ескертпе"
              />
            </div>
            <Button
              className="w-full"
              onClick={() => saveMutation.mutate()}
              disabled={!activeClassId || saveMutation.isPending}
            >
              Сақтау
            </Button>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-6">
          <h2 className="font-display font-bold">Соңғы жазбалар</h2>
          {rows.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">Әзірге дерек жоқ.</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground">
                    <th className="py-2 font-medium">Күні</th>
                    <th className="py-2 font-medium">Сынып</th>
                    <th className="py-2 text-right font-medium">Келгені</th>
                    <th className="py-2 text-right font-medium">%</th>
                    <th className="py-2 font-medium">Комментарий</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-t border-border/60">
                      <td className="py-2 pr-3">
                        {new Date(r.day).toLocaleDateString("kk-KZ")}
                      </td>
                      <td className="py-2 pr-3">
                        {classes.find((c) => c.id === r.class_id)?.name ?? "—"}
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
    </div>
  );
}
