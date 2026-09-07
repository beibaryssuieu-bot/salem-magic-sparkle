import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  Bell,
  CalendarClock,
  Download,
  Maximize2,
  Printer,
  Search,
  Trash2,
  Users,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MetricRing } from "@/components/metric-ring";
import { useProfile, useSession } from "@/lib/auth";
import {
  DEPARTMENTS,
  POSITIONS,
  formatDateTime,
  formatMeetingDate,
  formatTimeRange,
  type MeetingInfo,
} from "@/lib/meeting-constants";
import { generateQrDataUrl, meetingCheckinUrl } from "@/lib/qr";
import { broadcastMeetingNotification } from "@/lib/meeting-notifications";

export const Route = createFileRoute("/_authenticated/meetings_/$meetingId")({
  head: () => ({ meta: [{ title: "Жиналыс — tarbie+" }] }),
  component: MeetingDetailPage,
});

type ParticipantRow = {
  id: string;
  registered_at: string;
  full_name: string;
  position: string;
  department: string;
  school: string;
};

function MeetingDetailPage() {
  const { meetingId } = Route.useParams();
  const { user } = useSession();
  const { data: me } = useProfile(user);
  const queryClient = useQueryClient();

  const meetingQuery = useQuery({
    queryKey: ["meeting", meetingId],
    enabled: !!me?.isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meetings")
        .select("*")
        .eq("id", meetingId)
        .single();
      if (error) throw error;
      return data as MeetingInfo;
    },
  });

  const participantsQuery = useQuery({
    queryKey: ["meeting-participants", meetingId],
    enabled: !!me?.isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meeting_attendance")
        .select(
          "id, registered_at, teacher:meeting_teachers(full_name, position, department, school)",
        )
        .eq("meeting_id", meetingId)
        .order("registered_at", { ascending: false });
      if (error) throw error;
      return (data ?? [])
        .filter((r) => !!r.teacher)
        .map((r) => ({
          id: r.id,
          registered_at: r.registered_at,
          full_name: r.teacher!.full_name,
          position: r.teacher!.position,
          department: r.teacher!.department,
          school: r.teacher!.school,
        })) as ParticipantRow[];
    },
  });

  const targetsQuery = useQuery({
    queryKey: ["meeting-dept-targets", meetingId],
    enabled: !!me?.isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meeting_department_targets")
        .select("department, expected_count")
        .eq("meeting_id", meetingId);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Real-time: жаңа тіркелу келгенде дэшборд пен қатысушылар тізімі дереу жаңарады.
  useEffect(() => {
    if (!me?.isAdmin) return;
    const channel = supabase
      .channel(`meeting-attendance-live-${meetingId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "meeting_attendance",
          filter: `meeting_id=eq.${meetingId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["meeting-participants", meetingId] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [meetingId, me?.isAdmin, queryClient]);

  if (!me?.isAdmin) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center text-sm text-muted-foreground">
        Бұл бөлім тек әкімшілерге арналған.
      </div>
    );
  }

  const meeting = meetingQuery.data;
  const participants = participantsQuery.data ?? [];

  if (meetingQuery.isLoading) {
    return <p className="p-10 text-center text-muted-foreground">Жүктелуде…</p>;
  }
  if (!meeting) {
    return <p className="p-10 text-center text-muted-foreground">Жиналыс табылмады.</p>;
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <Link
        to="/meetings"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Жиналыстар
      </Link>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold md:text-3xl">{meeting.title}</h1>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
            <CalendarClock className="size-4 shrink-0" />
            {formatMeetingDate(meeting.meeting_date)} ·{" "}
            {formatTimeRange(meeting.start_time, meeting.end_time)}
          </p>
        </div>
        <Badge variant={meeting.registration_open ? "default" : "secondary"} className="text-sm">
          {meeting.registration_open ? "Тіркеу ашық" : "Тіркеу жабық"}
        </Badge>
      </div>

      <Tabs defaultValue="dashboard" className="mt-6">
        <TabsList className="flex h-auto flex-wrap justify-start gap-1 bg-muted/70 p-1">
          <TabsTrigger value="dashboard">Дашборд</TabsTrigger>
          <TabsTrigger value="participants">Қатысушылар</TabsTrigger>
          <TabsTrigger value="stats">Статистика</TabsTrigger>
          <TabsTrigger value="qr">QR код</TabsTrigger>
          <TabsTrigger value="settings">Баптаулар</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard">
          <DashboardTab meeting={meeting} participants={participants} />
        </TabsContent>
        <TabsContent value="participants">
          <ParticipantsTab
            meeting={meeting}
            participants={participants}
            queryClient={queryClient}
          />
        </TabsContent>
        <TabsContent value="stats">
          <StatsTab participants={participants} targets={targetsQuery.data ?? []} />
        </TabsContent>
        <TabsContent value="qr">
          <QrTab meeting={meeting} />
        </TabsContent>
        <TabsContent value="settings">
          <SettingsTab meeting={meeting} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ---------- Дашборд ----------

function DashboardTab({
  meeting,
  participants,
}: {
  meeting: MeetingInfo;
  participants: ParticipantRow[];
}) {
  const attended = participants.length;
  const notAttended = Math.max(meeting.expected_count - attended, 0);
  const percent =
    meeting.expected_count > 0 ? Math.round((attended / meeting.expected_count) * 100) : 0;
  const recent = participants.slice(0, 6);

  return (
    <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1fr_1fr_auto]">
      <StatCard label="Барлық шақырылған" value={meeting.expected_count} icon={Users} />
      <StatCard label="Қатысқандар" value={attended} icon={Users} tone="success" />
      <StatCard label="Қатыспағандар" value={notAttended} icon={Users} tone="warning" />
      <div className="flex items-center justify-center rounded-2xl border border-border bg-card p-5">
        <MetricRing value={percent} label="Қатысу пайызы" />
      </div>

      <div className="lg:col-span-4 rounded-2xl border border-border bg-card p-6">
        <h2 className="font-display font-bold">Соңғы тіркелгендер</h2>
        {recent.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Әзірге ешкім тіркелген жоқ.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border/60 text-sm">
            {recent.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="font-medium">{p.full_name}</span>
                <span className="text-muted-foreground">{p.department}</span>
                <span className="text-muted-foreground">{formatDateTime(p.registered_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: typeof Users;
  tone?: "success" | "warning";
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <Icon
          className={`size-4 ${tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : "text-muted-foreground"}`}
        />
      </div>
      <p className="mt-2 font-display text-3xl font-bold text-foreground">{value}</p>
    </div>
  );
}

// ---------- Қатысушылар ----------

function ParticipantsTab({
  meeting,
  participants,
  queryClient,
}: {
  meeting: MeetingInfo;
  participants: ParticipantRow[];
  queryClient: ReturnType<typeof useQueryClient>;
}) {
  const [search, setSearch] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("Барлығы");
  const [positionFilter, setPositionFilter] = useState("Барлығы");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("meeting_attendance").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Жазба өшірілді");
      queryClient.invalidateQueries({ queryKey: ["meeting-participants", meeting.id] });
    },
    onError: () => toast.error("Өшіру сәтсіз аяқталды"),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = participants.filter((p) => {
      if (q && !p.full_name.toLowerCase().includes(q)) return false;
      if (departmentFilter !== "Барлығы" && p.department !== departmentFilter) return false;
      if (positionFilter !== "Барлығы" && p.position !== positionFilter) return false;
      return true;
    });
    rows = [...rows].sort((a, b) =>
      sortDir === "desc"
        ? b.registered_at.localeCompare(a.registered_at)
        : a.registered_at.localeCompare(b.registered_at),
    );
    return rows;
  }, [participants, search, departmentFilter, positionFilter, sortDir]);

  async function exportXlsx() {
    const XLSX = await import("xlsx");
    const header = ["№", "Аты-жөні", "Лауазымы", "Кафедрасы", "Мектеп", "Күні", "Уақыты", "Статус"];
    const body = filtered.map((p, i) => {
      const dt = new Date(p.registered_at);
      return [
        i + 1,
        p.full_name,
        p.position,
        p.department,
        p.school,
        dt.toLocaleDateString("kk-KZ"),
        dt.toLocaleTimeString("kk-KZ", { hour: "2-digit", minute: "2-digit" }),
        "Қатысты",
      ];
    });
    const sheet = XLSX.utils.aoa_to_sheet([header, ...body]);
    sheet["!cols"] = [
      { wch: 4 },
      { wch: 26 },
      { wch: 20 },
      { wch: 26 },
      { wch: 22 },
      { wch: 12 },
      { wch: 10 },
      { wch: 12 },
    ];
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "Қатысушылар");
    XLSX.writeFile(book, `qatysushylar-${meeting.meeting_date}.xlsx`);
    toast.success("Файл жүктелді");
  }

  return (
    <div className="mt-4 space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-4">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Аты-жөні бойынша іздеу…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
          <SelectTrigger className="w-[220px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Барлығы">Барлық кафедра</SelectItem>
            {DEPARTMENTS.map((d) => (
              <SelectItem key={d} value={d}>
                {d}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={positionFilter} onValueChange={setPositionFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Барлығы">Барлық лауазым</SelectItem>
            {POSITIONS.map((p) => (
              <SelectItem key={p} value={p}>
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setSortDir((d) => (d === "desc" ? "asc" : "desc"))}
        >
          Уақыты бойынша: {sortDir === "desc" ? "жаңадан" : "ескіден"}
        </Button>
        <Button size="sm" onClick={exportXlsx} className="ml-auto">
          <Download className="size-4" /> EXCEL-ГЕ ЖҮКТЕУ
        </Button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">№</TableHead>
              <TableHead>Аты-жөні</TableHead>
              <TableHead>Лауазымы</TableHead>
              <TableHead>Кафедрасы</TableHead>
              <TableHead>Мектеп</TableHead>
              <TableHead>Уақыты</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                  Қатысушы табылмады.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((p, i) => (
                <TableRow key={p.id}>
                  <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                  <TableCell className="font-medium">{p.full_name}</TableCell>
                  <TableCell>{p.position}</TableCell>
                  <TableCell>{p.department}</TableCell>
                  <TableCell className="text-muted-foreground">{p.school}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDateTime(p.registered_at)}
                  </TableCell>
                  <TableCell>🟢 Қатысты</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Жазбаны өшіру"
                      onClick={() => deleteMutation.mutate(p.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ---------- Статистика ----------

function StatsTab({
  participants,
  targets,
}: {
  participants: ParticipantRow[];
  targets: { department: string; expected_count: number }[];
}) {
  const targetMap = new Map(targets.map((t) => [t.department, t.expected_count]));
  const rows = DEPARTMENTS.map((d) => {
    const attended = participants.filter((p) => p.department === d).length;
    const expected = targetMap.get(d) ?? 0;
    const percent = expected > 0 ? Math.round((attended / expected) * 100) : null;
    return { department: d, attended, expected, percent };
  });
  const chartData = rows.map((r) => ({ name: r.department.split(" ")[0], attended: r.attended }));

  return (
    <div className="mt-4 space-y-4">
      <div className="rounded-2xl border border-border bg-card p-6">
        <h2 className="font-display font-bold">Кафедра бойынша қатысу</h2>
        <div className="mt-4 h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/60" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11 }}
                interval={0}
                angle={-25}
                textAnchor="end"
                height={60}
              />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{ borderRadius: 12, border: "1px solid var(--border)", fontSize: 12 }}
              />
              <Bar
                dataKey="attended"
                name="Қатысты"
                radius={[6, 6, 0, 0]}
                fill="var(--color-chart-1)"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6">
        <h2 className="font-display font-bold">Кафедралар бойынша тізім</h2>
        <ul className="mt-3 divide-y divide-border/60 text-sm">
          {rows.map((r) => (
            <li key={r.department} className="flex items-center justify-between gap-3 py-2.5">
              <span className="font-medium">{r.department}</span>
              <span className="text-muted-foreground">
                {r.expected > 0 ? (
                  <>
                    {r.attended} / {r.expected} —{" "}
                    <span className="font-semibold text-foreground">{r.percent}%</span>
                  </>
                ) : (
                  <>қатысты: {r.attended}</>
                )}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-muted-foreground">
          Пайызды көру үшін «Баптаулар» бетінде кафедраға күтілетін санды белгілеңіз.
        </p>
      </div>
    </div>
  );
}

// ---------- QR код ----------

function QrTab({ meeting }: { meeting: MeetingInfo }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const link = meetingCheckinUrl(meeting.qr_token);

  useEffect(() => {
    let cancelled = false;
    generateQrDataUrl(link, 640).then((url) => {
      if (!cancelled) setDataUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [link]);

  function download() {
    if (!dataUrl) return;
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `qr-${meeting.meeting_date}.png`;
    a.click();
  }

  function print() {
    if (!dataUrl) return;
    const w = window.open("", "_blank", "width=600,height=760");
    if (!w) return;
    w.document.write(`<!doctype html><html><head><title>${meeting.title}</title>
      <style>
        body{font-family:sans-serif;text-align:center;padding:40px}
        h1{font-size:20px;margin-bottom:4px}
        p{color:#555;margin-top:0}
        img{width:420px;height:420px;margin-top:24px}
      </style></head>
      <body>
        <h1>${meeting.title}</h1>
        <p>${formatMeetingDate(meeting.meeting_date)} · ${formatTimeRange(meeting.start_time, meeting.end_time)}</p>
        <img src="${dataUrl}" />
        <p style="margin-top:16px;font-size:12px;word-break:break-all">${link}</p>
      </body></html>`);
    w.document.close();
    w.focus();
    w.print();
  }

  return (
    <div className="mt-4 rounded-2xl border border-border bg-card p-6">
      <h2 className="font-display font-bold">Жиналыстың QR коды</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Мұғалімдер осы кодты сканерлеп, қатысуын тіркейді.
      </p>
      <div className="mt-6 flex flex-col items-center gap-4">
        {dataUrl ? (
          <img
            src={dataUrl}
            alt="QR код"
            className="size-64 rounded-2xl border border-border sm:size-80"
          />
        ) : (
          <div className="flex size-64 items-center justify-center text-sm text-muted-foreground sm:size-80">
            Жасалуда…
          </div>
        )}
        <p className="max-w-xs break-all text-center text-xs text-muted-foreground">{link}</p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button variant="outline" onClick={() => setFullscreen(true)} disabled={!dataUrl}>
            <Maximize2 className="size-4" /> Толық экран
          </Button>
          <Button variant="outline" onClick={download} disabled={!dataUrl}>
            <Download className="size-4" /> PNG жүктеу
          </Button>
          <Button variant="outline" onClick={print} disabled={!dataUrl}>
            <Printer className="size-4" /> Басып шығару
          </Button>
        </div>
      </div>

      <Dialog open={fullscreen} onOpenChange={setFullscreen}>
        <DialogContent className="flex max-w-2xl flex-col items-center gap-4 p-10">
          <DialogHeader>
            <DialogTitle className="text-center">{meeting.title}</DialogTitle>
          </DialogHeader>
          {dataUrl && <img src={dataUrl} alt="QR код" className="size-full max-w-md" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------- Баптаулар ----------

function SettingsTab({ meeting }: { meeting: MeetingInfo }) {
  const queryClient = useQueryClient();
  const navigate = Route.useNavigate();

  const [title, setTitle] = useState(meeting.title);
  const [date, setDate] = useState(meeting.meeting_date);
  const [start, setStart] = useState(meeting.start_time.slice(0, 5));
  const [end, setEnd] = useState(meeting.end_time.slice(0, 5));
  const [location, setLocation] = useState(meeting.location ?? "");
  const [expected, setExpected] = useState(String(meeting.expected_count));
  const [notifTitle, setNotifTitle] = useState("📢 Жиналыс 10 минуттан кейін басталады.");
  const [notifBody, setNotifBody] = useState("");
  const [deptTargets, setDeptTargets] = useState<Record<string, string>>({});

  const targetsQuery = useQuery({
    queryKey: ["meeting-dept-targets", meeting.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meeting_department_targets")
        .select("department, expected_count")
        .eq("meeting_id", meeting.id);
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!targetsQuery.data) return;
    const map: Record<string, string> = {};
    for (const t of targetsQuery.data) map[t.department] = String(t.expected_count);
    setDeptTargets(map);
  }, [targetsQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("meetings")
        .update({
          title: title.trim(),
          meeting_date: date,
          start_time: start,
          end_time: end,
          location: location.trim() || null,
          expected_count: Math.max(0, Number(expected) || 0),
        })
        .eq("id", meeting.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Сақталды");
      queryClient.invalidateQueries({ queryKey: ["meeting", meeting.id] });
      queryClient.invalidateQueries({ queryKey: ["meetings"] });
    },
    onError: () => toast.error("Сақтау сәтсіз аяқталды"),
  });

  const toggleMutation = useMutation({
    mutationFn: async (open: boolean) => {
      const { error } = await supabase
        .from("meetings")
        .update({ registration_open: open })
        .eq("id", meeting.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meeting", meeting.id] });
      queryClient.invalidateQueries({ queryKey: ["meetings"] });
    },
    onError: () => toast.error("Өзгерту сәтсіз аяқталды"),
  });

  const saveTargetsMutation = useMutation({
    mutationFn: async () => {
      const rows = DEPARTMENTS.map((d) => ({
        meeting_id: meeting.id,
        department: d,
        expected_count: Math.max(0, Number(deptTargets[d] ?? 0) || 0),
      }));
      const { error } = await supabase
        .from("meeting_department_targets")
        .upsert(rows, { onConflict: "meeting_id,department" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Кафедра нормалары сақталды");
      queryClient.invalidateQueries({ queryKey: ["meeting-dept-targets", meeting.id] });
    },
    onError: () => toast.error("Сақтау сәтсіз аяқталды"),
  });

  const notifyMutation = useMutation({
    mutationFn: async () => {
      if (!notifTitle.trim() || !notifBody.trim()) throw new Error("empty");
      await broadcastMeetingNotification(meeting.id, notifTitle.trim(), notifBody.trim());
    },
    onSuccess: () => {
      toast.success("Хабарландыру жіберілді");
      setNotifBody("");
    },
    onError: (err: Error) =>
      toast.error(
        err.message === "empty" ? "Тақырып пен мәтінді толтырыңыз" : "Жіберу сәтсіз аяқталды",
      ),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("meetings").delete().eq("id", meeting.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Жиналыс жойылды");
      queryClient.invalidateQueries({ queryKey: ["meetings"] });
      navigate({ to: "/meetings" });
    },
    onError: () => toast.error("Жою сәтсіз аяқталды"),
  });

  return (
    <div className="mt-4 space-y-4">
      <div className="flex items-center justify-between rounded-2xl border border-border bg-card p-5">
        <div>
          <p className="font-display font-bold">Тіркеу мәртебесі</p>
          <p className="text-sm text-muted-foreground">
            Жабылған кезде QR кодты сканерлеген мұғалімдерге тіркелу аяқталғаны көрсетіледі.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium">
            {meeting.registration_open ? "Ашық" : "Жабық"}
          </span>
          <Switch
            checked={meeting.registration_open}
            onCheckedChange={(v) => toggleMutation.mutate(v)}
          />
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6">
        <h2 className="font-display font-bold">Жиналыс деректері</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Атауы</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Күні</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Күтілетін саны</Label>
            <Input
              type="number"
              min={0}
              value={expected}
              onChange={(e) => setExpected(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Басталу уақыты</Label>
            <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Аяқталу уақыты</Label>
            <Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Өтетін орны</Label>
            <Input value={location} onChange={(e) => setLocation(e.target.value)} />
          </div>
        </div>
        <Button
          className="mt-4"
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
        >
          Сақтау
        </Button>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6">
        <h2 className="font-display font-bold">Кафедра бойынша күтілетін сан</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Статистика бетінде пайызбен көру үшін толтырыңыз (міндетті емес).
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {DEPARTMENTS.map((d) => (
            <div key={d} className="flex items-center justify-between gap-3">
              <Label className="text-sm font-normal">{d}</Label>
              <Input
                type="number"
                min={0}
                className="w-24"
                value={deptTargets[d] ?? ""}
                onChange={(e) => setDeptTargets((m) => ({ ...m, [d]: e.target.value }))}
              />
            </div>
          ))}
        </div>
        <Button
          className="mt-4"
          variant="outline"
          onClick={() => saveTargetsMutation.mutate()}
          disabled={saveTargetsMutation.isPending}
        >
          Нормаларды сақтау
        </Button>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6">
        <h2 className="flex items-center gap-2 font-display font-bold">
          <Bell className="size-4" /> Қатысушыларға хабарландыру жіберу
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Жиналыстың QR бетін ашық ұстаған қатысушыларға жедел жетеді.
        </p>
        <div className="mt-4 space-y-3">
          <Input
            placeholder="Тақырып"
            value={notifTitle}
            onChange={(e) => setNotifTitle(e.target.value)}
          />
          <Input
            placeholder="Хабарлама мәтіні"
            value={notifBody}
            onChange={(e) => setNotifBody(e.target.value)}
          />
          <Button onClick={() => notifyMutation.mutate()} disabled={notifyMutation.isPending}>
            Жіберу
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-destructive/40 bg-card p-6">
        <h2 className="font-display font-bold text-destructive">Қауіпті аймақ</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Жиналысты жою барлық қатысу жазбаларын да жояды. Бұл әрекетті болдырмау мүмкін емес.
        </p>
        <Button
          variant="destructive"
          className="mt-3"
          onClick={() => {
            if (confirm("Жиналысты шынымен жоясыз ба?")) deleteMutation.mutate();
          }}
          disabled={deleteMutation.isPending}
        >
          <Trash2 className="size-4" /> Жиналысты жою
        </Button>
      </div>
    </div>
  );
}
