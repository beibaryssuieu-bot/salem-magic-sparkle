import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  ExternalLink,
  Eye,
  Link2,
  Paperclip,
  Upload,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useProfile, useSession } from "@/lib/auth";
import { sortClassesByLiter } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/events/$eventId")({
  head: () => ({
    meta: [{ title: "Іс-шара — tarbie+" }],
  }),
  component: EventDetailPage,
});

type EventRow = { id: string; title: string; event_date: string; description: string | null };
type PlanRow = {
  id: string;
  event_id: string;
  class_id: string;
  user_id: string;
  file_path: string | null;
  file_name: string | null;
  link_url: string | null;
  created_at: string;
};
type ReportRow = {
  id: string;
  event_id: string;
  class_id: string;
  user_id: string;
  description: string | null;
  created_at: string;
};
type AttachmentRow = {
  id: string;
  report_id: string;
  kind: "file" | "link";
  file_path: string | null;
  file_name: string | null;
  link_url: string | null;
  created_at: string;
};

function isValidUrl(value: string) {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

async function openFile(path: string, name?: string | null) {
  const { data, error } = await supabase.storage
    .from("reports")
    .createSignedUrl(path, 60, name ? { download: name } : {});
  if (error || !data) {
    toast.error("Файлды ашу мүмкін болмады");
    return;
  }
  window.open(data.signedUrl, "_blank");
}

function EventDetailPage() {
  const { eventId } = Route.useParams();
  const { user } = useSession();
  const { data: me } = useProfile(user);
  const queryClient = useQueryClient();

  const [planFile, setPlanFile] = useState<File | null>(null);
  const [planLink, setPlanLink] = useState("");
  const [planRemoveFile, setPlanRemoveFile] = useState(false);
  const [reportDescription, setReportDescription] = useState("");
  const [newLink, setNewLink] = useState("");
  const [newFile, setNewFile] = useState<File | null>(null);
  const [viewingClassId, setViewingClassId] = useState<string | null>(null);

  const eventQuery = useQuery({
    queryKey: ["event", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id, title, event_date, description")
        .eq("id", eventId)
        .single();
      if (error) throw error;
      return data as EventRow;
    },
  });

  const classesQuery = useQuery({
    queryKey: ["classes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("classes").select("id, name").order("name");
      if (error) throw error;
      return data;
    },
  });

  const plansQuery = useQuery({
    queryKey: ["event-plans", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_plans")
        .select("*")
        .eq("event_id", eventId);
      if (error) throw error;
      return (data ?? []) as PlanRow[];
    },
  });

  const reportsQuery = useQuery({
    queryKey: ["event-reports", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_reports")
        .select("*")
        .eq("event_id", eventId);
      if (error) throw error;
      return (data ?? []) as ReportRow[];
    },
  });

  const reportIds = (reportsQuery.data ?? []).map((r) => r.id);
  const attachmentsQuery = useQuery({
    queryKey: ["event-report-attachments", eventId, reportIds.join(",")],
    enabled: reportsQuery.isSuccess,
    queryFn: async () => {
      if (reportIds.length === 0) return [] as AttachmentRow[];
      const { data, error } = await supabase
        .from("event_report_attachments")
        .select("*")
        .in("report_id", reportIds);
      if (error) throw error;
      return (data ?? []) as AttachmentRow[];
    },
  });

  const authorsQuery = useQuery({
    queryKey: ["profiles-all"],
    enabled: !!me?.isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, full_name, username");
      if (error) throw error;
      return data ?? [];
    },
  });

  const classes = sortClassesByLiter(classesQuery.data ?? []);
  const myClass = classes.find((c) => c.name === me?.profile?.class_name);
  const myClassId = myClass?.id;
  const myPlan = plansQuery.data?.find((p) => p.class_id === myClassId);
  const myReport = reportsQuery.data?.find((r) => r.class_id === myClassId);
  const myAttachments = (attachmentsQuery.data ?? []).filter((a) => a.report_id === myReport?.id);

  useEffect(() => {
    if (myPlan) setPlanLink(myPlan.link_url ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myPlan?.id]);

  useEffect(() => {
    if (myReport) setReportDescription(myReport.description ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myReport?.id]);

  function invalidateEventData() {
    queryClient.invalidateQueries({ queryKey: ["event-plans", eventId] });
    queryClient.invalidateQueries({ queryKey: ["event-reports", eventId] });
    queryClient.invalidateQueries({ queryKey: ["event-report-attachments", eventId] });
  }

  const planMutation = useMutation({
    mutationFn: async () => {
      if (!myClassId) throw new Error("no_class");
      const trimmedLink = planLink.trim();
      const keepFile = !!myPlan?.file_path && !planRemoveFile && !planFile;
      if (!planFile && !keepFile && !trimmedLink) throw new Error("file_or_link_required");
      if (trimmedLink && !isValidUrl(trimmedLink)) throw new Error("invalid_url");

      let file_path = myPlan?.file_path ?? null;
      let file_name = myPlan?.file_name ?? null;
      let file_type: string | null = null;
      if (planFile) {
        const path = `${user!.id}/${crypto.randomUUID()}-${planFile.name.replace(/[^\w.-]/g, "_")}`;
        const up = await supabase.storage.from("reports").upload(path, planFile);
        if (up.error) throw up.error;
        if (myPlan?.file_path) await supabase.storage.from("reports").remove([myPlan.file_path]);
        file_path = path;
        file_name = planFile.name;
        file_type = planFile.type || null;
      } else if (planRemoveFile && myPlan?.file_path) {
        await supabase.storage.from("reports").remove([myPlan.file_path]);
        file_path = null;
        file_name = null;
      }

      const { error } = await supabase.from("event_plans").upsert(
        {
          event_id: eventId,
          class_id: myClassId,
          user_id: user!.id,
          file_path,
          file_name,
          ...(planFile ? { file_type } : {}),
          link_url: trimmedLink || null,
        },
        { onConflict: "event_id,class_id" },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("ҚМЖ сақталды");
      setPlanFile(null);
      setPlanRemoveFile(false);
      invalidateEventData();
    },
    onError: (err: Error) => {
      if (err.message === "file_or_link_required") toast.error("Файл немесе сілтеме қосыңыз");
      else if (err.message === "invalid_url") toast.error("Сілтеме дұрыс емес");
      else toast.error("Сақтау сәтсіз аяқталды");
    },
  });

  async function upsertReport(description: string) {
    if (!myClassId) throw new Error("no_class");
    const { data, error } = await supabase
      .from("event_reports")
      .upsert(
        {
          event_id: eventId,
          class_id: myClassId,
          user_id: user!.id,
          description: description.trim() || null,
        },
        { onConflict: "event_id,class_id" },
      )
      .select("id")
      .single();
    if (error) throw error;
    return data.id as string;
  }

  const saveDescriptionMutation = useMutation({
    mutationFn: () => upsertReport(reportDescription),
    onSuccess: () => {
      toast.success("Сипаттама сақталды");
      invalidateEventData();
    },
    onError: () => toast.error("Сақтау сәтсіз аяқталды"),
  });

  const addFileMutation = useMutation({
    mutationFn: async () => {
      if (!newFile) throw new Error("no_file");
      const reportId = await upsertReport(reportDescription);
      const path = `${user!.id}/${crypto.randomUUID()}-${newFile.name.replace(/[^\w.-]/g, "_")}`;
      const up = await supabase.storage.from("reports").upload(path, newFile);
      if (up.error) throw up.error;
      const { error } = await supabase.from("event_report_attachments").insert({
        report_id: reportId,
        kind: "file",
        file_path: path,
        file_name: newFile.name,
        file_type: newFile.type || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Файл қосылды");
      setNewFile(null);
      invalidateEventData();
    },
    onError: () => toast.error("Файл қосылмады"),
  });

  const addLinkMutation = useMutation({
    mutationFn: async () => {
      const trimmed = newLink.trim();
      if (!trimmed) throw new Error("empty");
      if (!isValidUrl(trimmed)) throw new Error("invalid_url");
      const reportId = await upsertReport(reportDescription);
      const { error } = await supabase.from("event_report_attachments").insert({
        report_id: reportId,
        kind: "link",
        link_url: trimmed,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Сілтеме қосылды");
      setNewLink("");
      invalidateEventData();
    },
    onError: (err: Error) =>
      toast.error(err.message === "invalid_url" ? "Сілтеме дұрыс емес" : "Сілтеме қосылмады"),
  });

  const removeAttachmentMutation = useMutation({
    mutationFn: async (att: AttachmentRow) => {
      if (att.file_path) await supabase.storage.from("reports").remove([att.file_path]);
      const { error } = await supabase.from("event_report_attachments").delete().eq("id", att.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Жойылды");
      invalidateEventData();
    },
    onError: () => toast.error("Жою мүмкін болмады"),
  });

  function authorName(id: string) {
    const p = authorsQuery.data?.find((a) => a.id === id);
    return p?.full_name || p?.username || "";
  }

  const event = eventQuery.data;
  const today = new Date().toISOString().slice(0, 10);
  const reportUnlocked = !!event && event.event_date <= today;

  const viewingPlan = plansQuery.data?.find((p) => p.class_id === viewingClassId);
  const viewingReport = reportsQuery.data?.find((r) => r.class_id === viewingClassId);
  const viewingAttachments = (attachmentsQuery.data ?? []).filter(
    (a) => a.report_id === viewingReport?.id,
  );
  const viewingClass = classes.find((c) => c.id === viewingClassId);

  if (eventQuery.isLoading) {
    return <p className="p-10 text-center text-muted-foreground">Жүктелуде…</p>;
  }
  if (!event) {
    return <p className="p-10 text-center text-muted-foreground">Іс-шара табылмады.</p>;
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <Link
        to="/events"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Іс-шаралар
      </Link>

      <div className="mt-3 rounded-2xl panel-dark p-6">
        <h1 className="flex items-center gap-2 font-display text-2xl font-bold">
          <CalendarDays className="size-5" /> {event.title}
        </h1>
        <p className="mt-1 text-sm opacity-80">
          {new Date(event.event_date).toLocaleDateString("kk-KZ")}
        </p>
        {event.description && <p className="mt-3 text-sm opacity-90">{event.description}</p>}
      </div>

      {me?.isAdmin ? (
        <section className="mt-6 rounded-2xl border border-border bg-card p-6">
          <h2 className="font-display font-bold">Іс-шара бойынша есептер</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Қай сынып ҚМЖ мен есепті тапсырғанын бірден көресіз.
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="py-2 font-medium">Сынып</th>
                  <th className="py-2 text-center font-medium">ҚМЖ</th>
                  <th className="py-2 text-center font-medium">Есеп</th>
                  <th className="py-2 text-center font-medium">Материал</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {classes.map((c) => {
                  const plan = plansQuery.data?.find((p) => p.class_id === c.id);
                  const report = reportsQuery.data?.find((r) => r.class_id === c.id);
                  const attCount = (attachmentsQuery.data ?? []).filter(
                    (a) => a.report_id === report?.id,
                  ).length;
                  return (
                    <tr key={c.id} className="border-t border-border/60">
                      <td className="py-2 pr-3 font-medium">{c.name} сынып</td>
                      <td className="py-2 text-center">
                        {plan ? (
                          <Check className="mx-auto size-4 text-primary" />
                        ) : (
                          <X className="mx-auto size-4 text-muted-foreground" />
                        )}
                      </td>
                      <td className="py-2 text-center">
                        {report ? (
                          <Check className="mx-auto size-4 text-primary" />
                        ) : (
                          <X className="mx-auto size-4 text-muted-foreground" />
                        )}
                      </td>
                      <td className="py-2 text-center text-muted-foreground">
                        {attCount > 0 ? `📎 ${attCount}` : "—"}
                      </td>
                      <td className="py-2 text-right">
                        {(plan || report) && (
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Қарау"
                            onClick={() => setViewingClassId(c.id)}
                          >
                            <Eye className="size-4" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <>
          <section className="mt-6 rounded-2xl border border-border bg-card p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display font-bold">ҚМЖ / жоспар</h2>
              <span className="text-sm">
                {myPlan ? "🟢 ҚМЖ тапсырылды" : "🟡 ҚМЖ тапсырылмаған"}
              </span>
            </div>
            {!myClassId ? (
              <p className="mt-3 text-sm text-muted-foreground">Сыныбыңыз тағайындалмаған.</p>
            ) : (
              <div className="mt-4 space-y-4">
                {myPlan?.file_name && !planFile && !planRemoveFile && (
                  <div className="flex items-center justify-between gap-2 rounded-xl border border-dashed border-border p-3 text-sm">
                    <button
                      type="button"
                      className="flex min-w-0 items-center gap-2 truncate text-left hover:underline"
                      onClick={() =>
                        myPlan.file_path && openFile(myPlan.file_path, myPlan.file_name)
                      }
                    >
                      <Paperclip className="size-4 shrink-0" />
                      <span className="truncate">{myPlan.file_name}</span>
                    </button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="shrink-0 text-destructive"
                      onClick={() => setPlanRemoveFile(true)}
                    >
                      Өшіру
                    </Button>
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="plan-file">Файл {myPlan?.file_name ? "(ауыстыру)" : ""}</Label>
                  <Input
                    id="plan-file"
                    type="file"
                    onChange={(e) => setPlanFile(e.target.files?.[0] ?? null)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="plan-link">Сілтеме</Label>
                  <Input
                    id="plan-link"
                    type="url"
                    value={planLink}
                    onChange={(e) => setPlanLink(e.target.value)}
                    placeholder="https://drive.google.com/..."
                  />
                </div>
                <Button onClick={() => planMutation.mutate()} disabled={planMutation.isPending}>
                  <Upload className="size-4" /> ҚМЖ сақтау
                </Button>
              </div>
            )}
          </section>

          <section className="mt-6 rounded-2xl border border-border bg-card p-6">
            <h2 className="font-display font-bold">Есеп тапсыру</h2>
            {!reportUnlocked ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Есеп тапсыру іс-шара өткеннен кейін ашылады.
              </p>
            ) : !myClassId ? (
              <p className="mt-3 text-sm text-muted-foreground">Сыныбыңыз тағайындалмаған.</p>
            ) : (
              <div className="mt-4 space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="report-desc">Қысқаша сипаттама</Label>
                  <Textarea
                    id="report-desc"
                    value={reportDescription}
                    maxLength={1000}
                    onChange={(e) => setReportDescription(e.target.value)}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => saveDescriptionMutation.mutate()}
                    disabled={saveDescriptionMutation.isPending}
                  >
                    Сипаттаманы сақтау
                  </Button>
                </div>

                {myAttachments.length > 0 && (
                  <ul className="space-y-2">
                    {myAttachments.map((a) => (
                      <li
                        key={a.id}
                        className="flex items-center justify-between gap-2 rounded-xl border border-border/60 p-3 text-sm"
                      >
                        {a.kind === "file" ? (
                          <button
                            type="button"
                            className="flex min-w-0 items-center gap-2 truncate text-left hover:underline"
                            onClick={() => a.file_path && openFile(a.file_path, a.file_name)}
                          >
                            <Paperclip className="size-4 shrink-0" /> {a.file_name}
                          </button>
                        ) : (
                          <a
                            href={a.link_url ?? "#"}
                            target="_blank"
                            rel="noreferrer"
                            className="flex min-w-0 items-center gap-2 truncate hover:underline"
                          >
                            <Link2 className="size-4 shrink-0" /> {a.link_url}
                          </a>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeAttachmentMutation.mutate(a)}
                        >
                          <X className="size-4" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2 rounded-xl border border-dashed border-border p-3">
                    <Label htmlFor="report-file" className="flex items-center gap-2">
                      <Paperclip className="size-4" /> Файл / фото / видео қосу
                    </Label>
                    <Input
                      id="report-file"
                      type="file"
                      onChange={(e) => setNewFile(e.target.files?.[0] ?? null)}
                    />
                    <Button
                      size="sm"
                      onClick={() => addFileMutation.mutate()}
                      disabled={!newFile || addFileMutation.isPending}
                    >
                      Қосу
                    </Button>
                  </div>
                  <div className="space-y-2 rounded-xl border border-dashed border-border p-3">
                    <Label htmlFor="report-link" className="flex items-center gap-2">
                      <Link2 className="size-4" /> Сілтеме қосу
                    </Label>
                    <Input
                      id="report-link"
                      type="url"
                      value={newLink}
                      onChange={(e) => setNewLink(e.target.value)}
                      placeholder="https://drive.google.com/..."
                    />
                    <Button
                      size="sm"
                      onClick={() => addLinkMutation.mutate()}
                      disabled={!newLink.trim() || addLinkMutation.isPending}
                    >
                      Қосу
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </section>
        </>
      )}

      <Dialog open={!!viewingClassId} onOpenChange={(open) => !open && setViewingClassId(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{viewingClass?.name} сынып</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 text-sm">
            <div>
              <p className="font-display font-bold">ҚМЖ / жоспар</p>
              {viewingPlan ? (
                <div className="mt-2 space-y-2">
                  {viewingPlan.user_id && (
                    <p className="text-muted-foreground">{authorName(viewingPlan.user_id)}</p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {viewingPlan.file_name && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          viewingPlan.file_path &&
                          openFile(viewingPlan.file_path, viewingPlan.file_name)
                        }
                      >
                        <Paperclip className="size-4" /> {viewingPlan.file_name}
                      </Button>
                    )}
                    {viewingPlan.link_url && (
                      <Button variant="outline" size="sm" asChild>
                        <a href={viewingPlan.link_url} target="_blank" rel="noreferrer">
                          <ExternalLink className="size-4" /> Сілтемені ашу
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <p className="mt-1 text-muted-foreground">Тапсырылмаған</p>
              )}
            </div>

            <div>
              <p className="font-display font-bold">Есеп</p>
              {viewingReport ? (
                <div className="mt-2 space-y-2">
                  {viewingReport.user_id && (
                    <p className="text-muted-foreground">{authorName(viewingReport.user_id)}</p>
                  )}
                  {viewingReport.description && <p>{viewingReport.description}</p>}
                  {viewingAttachments.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {viewingAttachments.map((a) =>
                        a.kind === "file" ? (
                          <Button
                            key={a.id}
                            variant="outline"
                            size="sm"
                            onClick={() => a.file_path && openFile(a.file_path, a.file_name)}
                          >
                            <Paperclip className="size-4" /> {a.file_name}
                          </Button>
                        ) : (
                          <Button key={a.id} variant="outline" size="sm" asChild>
                            <a href={a.link_url ?? "#"} target="_blank" rel="noreferrer">
                              <ExternalLink className="size-4" /> {a.link_url}
                            </a>
                          </Button>
                        ),
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Материал қосылмаған</p>
                  )}
                </div>
              ) : (
                <p className="mt-1 text-muted-foreground">Тапсырылмаған</p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
