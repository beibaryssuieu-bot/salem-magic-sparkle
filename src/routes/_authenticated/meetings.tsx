import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarClock, Lock, LockOpen, Plus, QrCode, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useProfile, useSession } from "@/lib/auth";
import { formatMeetingDate, formatTimeRange, type MeetingInfo } from "@/lib/meeting-constants";

export const Route = createFileRoute("/_authenticated/meetings")({
  head: () => ({
    meta: [
      { title: "Жиналыстар — tarbie+" },
      {
        name: "description",
        content: "Мұғалімдер жиналысына QR арқылы қатысуды тіркеу: жиналыстарды құру және басқару.",
      },
    ],
  }),
  component: MeetingsPage,
});

type MeetingWithCount = MeetingInfo & { attended: number };

function emptyForm() {
  const today = new Date().toISOString().slice(0, 10);
  return {
    title: "",
    meeting_date: today,
    start_time: "09:00",
    end_time: "10:00",
    location: "",
    expected_count: "200",
  };
}

function MeetingsPage() {
  const { user } = useSession();
  const { data: me } = useProfile(user);
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyForm());
  const [creating, setCreating] = useState(false);

  const meetingsQuery = useQuery({
    queryKey: ["meetings"],
    queryFn: async () => {
      const [meetingsRes, attendanceRes] = await Promise.all([
        supabase
          .from("meetings")
          .select("*")
          .order("meeting_date", { ascending: false })
          .order("start_time", { ascending: false }),
        supabase.from("meeting_attendance").select("meeting_id"),
      ]);
      if (meetingsRes.error) throw meetingsRes.error;
      if (attendanceRes.error) throw attendanceRes.error;
      const counts = new Map<string, number>();
      for (const row of attendanceRes.data ?? []) {
        counts.set(row.meeting_id, (counts.get(row.meeting_id) ?? 0) + 1);
      }
      return (meetingsRes.data ?? []).map((m) => ({
        ...m,
        attended: counts.get(m.id) ?? 0,
      })) as MeetingWithCount[];
    },
    enabled: !!me?.isAdmin,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!form.title.trim() || !form.meeting_date || !form.start_time || !form.end_time) {
        throw new Error("empty");
      }
      const { data, error } = await supabase
        .from("meetings")
        .insert({
          title: form.title.trim(),
          meeting_date: form.meeting_date,
          start_time: form.start_time,
          end_time: form.end_time,
          location: form.location.trim() || null,
          expected_count: Math.max(0, Number(form.expected_count) || 0),
          created_by: user!.id,
        })
        .select("id")
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: () => {
      toast.success("Жиналыс құрылды");
      setForm(emptyForm());
      setCreating(false);
      queryClient.invalidateQueries({ queryKey: ["meetings"] });
    },
    onError: (err: Error) =>
      toast.error(
        err.message === "empty"
          ? "Барлық өрісті толтырыңыз"
          : `Құру сәтсіз аяқталды: ${err.message}`,
      ),
  });

  const toggleMutation = useMutation({
    mutationFn: async (meeting: MeetingWithCount) => {
      const { error } = await supabase
        .from("meetings")
        .update({ registration_open: !meeting.registration_open })
        .eq("id", meeting.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meetings"] });
    },
    onError: () => toast.error("Өзгерту сәтсіз аяқталды"),
  });

  if (!me?.isAdmin) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center text-sm text-muted-foreground">
        Бұл бөлім тек әкімшілерге арналған.
      </div>
    );
  }

  const rows = meetingsQuery.data ?? [];

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold md:text-3xl">Жиналыстар</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Мұғалімдер жиналысына QR арқылы қатысуды тіркеу.
          </p>
        </div>
        <Button onClick={() => setCreating((v) => !v)}>
          <Plus className="size-4" /> Жаңа жиналыс
        </Button>
      </div>

      {creating && (
        <div className="mt-6 rounded-2xl border border-border bg-card p-6">
          <h2 className="font-display font-bold">Жаңа жиналыс құру</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="m-title">Жиналыс атауы</Label>
              <Input
                id="m-title"
                value={form.title}
                maxLength={150}
                placeholder="Мысалы: Қыркүйек айлық жиналысы"
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="m-date">Күні</Label>
              <Input
                id="m-date"
                type="date"
                value={form.meeting_date}
                onChange={(e) => setForm((f) => ({ ...f, meeting_date: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="m-expected">Күтілетін саны</Label>
              <Input
                id="m-expected"
                type="number"
                min={0}
                value={form.expected_count}
                onChange={(e) => setForm((f) => ({ ...f, expected_count: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="m-start">Басталу уақыты</Label>
              <Input
                id="m-start"
                type="time"
                value={form.start_time}
                onChange={(e) => setForm((f) => ({ ...f, start_time: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="m-end">Аяқталу уақыты</Label>
              <Input
                id="m-end"
                type="time"
                value={form.end_time}
                onChange={(e) => setForm((f) => ({ ...f, end_time: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="m-location">Өтетін орны (міндетті емес)</Label>
              <Input
                id="m-location"
                value={form.location}
                placeholder="Мысалы: Акт залы"
                onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
              />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
              Құру
            </Button>
            <Button variant="outline" onClick={() => setCreating(false)}>
              Бас тарту
            </Button>
          </div>
        </div>
      )}

      <div className="mt-6 space-y-3">
        {meetingsQuery.isLoading && <p className="text-sm text-muted-foreground">Жүктелуде…</p>}
        {!meetingsQuery.isLoading && rows.length === 0 && (
          <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Әзірге жиналыс жоқ. «Жаңа жиналыс» батырмасын басып бастаңыз.
          </p>
        )}
        {rows.map((m) => {
          const percent =
            m.expected_count > 0 ? Math.round((m.attended / m.expected_count) * 100) : 0;
          return (
            <div
              key={m.id}
              className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-card p-5"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-display font-bold text-foreground">{m.title}</p>
                  <Badge variant={m.registration_open ? "default" : "secondary"}>
                    {m.registration_open ? "Тіркеу ашық" : "Тіркеу жабық"}
                  </Badge>
                </div>
                <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                  <CalendarClock className="size-3.5 shrink-0" />
                  {formatMeetingDate(m.meeting_date)} · {formatTimeRange(m.start_time, m.end_time)}
                </p>
                <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Users className="size-3.5 shrink-0" />
                  {m.attended} / {m.expected_count} қатысты ({percent}%)
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toggleMutation.mutate(m)}
                  disabled={toggleMutation.isPending}
                >
                  {m.registration_open ? (
                    <>
                      <Lock className="size-4" /> Жабу
                    </>
                  ) : (
                    <>
                      <LockOpen className="size-4" /> Ашу
                    </>
                  )}
                </Button>
                <Button asChild size="sm">
                  <Link to="/meetings/$meetingId" params={{ meetingId: m.id }}>
                    <QrCode className="size-4" /> Ашу
                  </Link>
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
