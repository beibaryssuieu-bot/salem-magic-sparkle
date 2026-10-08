import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Download,
  ExternalLink,
  Eye,
  Link2,
  Paperclip,
  Pencil,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { useReportNotifications } from "@/lib/report-notifications";
import { useStorageActions } from "@/lib/storage-client";
import { sortClassesByLiter } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({
    meta: [
      { title: "Есептер — tarbie+" },
      {
        name: "description",
        content:
          "Сынып жетекшілерінің атқарылған жұмыстары бойынша құжаттарын, презентацияларын, фотоларын және сілтемелерін жүктеу бөлімі.",
      },
      { property: "og:title", content: "Есептер — tarbie+" },
      {
        property: "og:description",
        content: "Жетекшілердің жұмыс есептері: файл, сілтеме және түсініктеме.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ReportsPage,
});

type ReportRow = {
  id: string;
  user_id: string;
  class_id: string | null;
  title: string;
  comment: string | null;
  status: string;
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

function statusInfo(status: string) {
  return status === "viewed"
    ? { emoji: "🟢", label: "Тапсырылды" }
    : { emoji: "🟡", label: "Қаралуда" };
}

function ReportsPage() {
  const { user } = useSession();
  const { data: me } = useProfile(user);
  const queryClient = useQueryClient();
  const { uploadFile, openStoredFile, removeStoredFile } = useStorageActions();

  const [title, setTitle] = useState("");
  const [comment, setComment] = useState("");
  const [classId, setClassId] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [linkUrls, setLinkUrls] = useState<string[]>([""]);
  const [editNewFile, setEditNewFile] = useState<File | null>(null);
  const [editNewLink, setEditNewLink] = useState("");
  const [filterClassId, setFilterClassId] = useState("all");
  const [editingReport, setEditingReport] = useState<ReportRow | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);

  const classesQuery = useQuery({
    queryKey: ["classes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("classes").select("id, name").order("name");
      if (error) throw error;
      return data;
    },
  });

  const reportsQuery = useQuery({
    queryKey: ["reports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reports")
        .select("id, user_id, class_id, title, comment, status, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ReportRow[];
    },
  });

  const allRows = reportsQuery.data ?? [];
  const reportIds = allRows.map((r) => r.id);

  const attachmentsQuery = useQuery({
    queryKey: ["report-attachments", reportIds.join(",")],
    enabled: reportsQuery.isSuccess,
    queryFn: async () => {
      if (reportIds.length === 0) return [] as AttachmentRow[];
      const { data, error } = await supabase
        .from("report_attachments")
        .select("*")
        .in("report_id", reportIds);
      if (error) throw error;
      return (data ?? []) as AttachmentRow[];
    },
  });

  function attachmentsOf(reportId: string) {
    return (attachmentsQuery.data ?? []).filter((a) => a.report_id === reportId);
  }

  const authorsQuery = useQuery({
    queryKey: ["profiles-all"],
    enabled: !!me?.isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, full_name, username");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: notif } = useReportNotifications(!!me?.isAdmin);

  function invalidateReportData() {
    queryClient.invalidateQueries({ queryKey: ["reports"] });
    queryClient.invalidateQueries({ queryKey: ["report-attachments"] });
    queryClient.invalidateQueries({ queryKey: ["report-notifications"] });
  }

  function resetForm() {
    setTitle("");
    setComment("");
    setFiles([]);
    setLinkUrls([""]);
    setEditNewFile(null);
    setEditNewLink("");
    setEditingReport(null);
  }

  const trimmedNewLinks = linkUrls.map((l) => l.trim()).filter(Boolean);
  const hasAttachment = files.length > 0 || trimmedNewLinks.length > 0;
  const canSubmit = !!title.trim() && (editingReport ? true : hasAttachment);

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!title.trim()) throw new Error("title_required");
      for (const l of trimmedNewLinks) if (!isValidUrl(l)) throw new Error("invalid_url");
      if (files.length === 0 && trimmedNewLinks.length === 0) {
        throw new Error("file_or_link_required");
      }

      const own = (classesQuery.data ?? []).find((c) => c.name === me?.profile?.class_name);
      const targetClassId = me?.isAdmin ? classId : (own?.id ?? "");

      const { data: inserted, error } = await supabase
        .from("reports")
        .insert({
          user_id: user!.id,
          class_id: targetClassId || null,
          title: title.trim(),
          comment: comment.trim() || null,
          status: "pending",
        })
        .select("id")
        .single();
      if (error) throw error;
      const reportId = inserted.id as string;

      for (const file of files) {
        const { key } = await uploadFile(file);
        const { error: attErr } = await supabase.from("report_attachments").insert({
          report_id: reportId,
          kind: "file",
          file_path: key,
          file_name: file.name,
          file_type: file.type || null,
        });
        if (attErr) throw attErr;
      }
      for (const link of trimmedNewLinks) {
        const { error: attErr } = await supabase.from("report_attachments").insert({
          report_id: reportId,
          kind: "link",
          link_url: link,
        });
        if (attErr) throw attErr;
      }
    },
    onSuccess: () => {
      toast.success("Есеп жіберілді");
      resetForm();
      invalidateReportData();
    },
    onError: (err: Error) => {
      if (err.message === "file_or_link_required") {
        toast.error("Файл немесе сілтеме қосыңыз");
      } else if (err.message === "invalid_url") {
        toast.error("Сілтеме дұрыс емес (https://... форматында болуы керек)");
      } else {
        toast.error("Жүктеу сәтсіз аяқталды");
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editingReport) return;
      if (!title.trim()) throw new Error("title_required");
      const wasViewed = editingReport.status === "viewed";
      const { error } = await supabase
        .from("reports")
        .update({
          title: title.trim(),
          comment: comment.trim() || null,
          ...(wasViewed ? { status: "pending", viewed_at: null } : {}),
        })
        .eq("id", editingReport.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Өзгерістер сақталды");
      resetForm();
      invalidateReportData();
    },
    onError: (err: Error) => {
      toast.error(err.message === "title_required" ? "Атауын жазыңыз" : "Сақтау сәтсіз аяқталды");
    },
  });

  async function markPendingIfWasViewed() {
    if (editingReport?.status === "viewed") {
      await supabase
        .from("reports")
        .update({ status: "pending", viewed_at: null })
        .eq("id", editingReport.id);
    }
  }

  const addAttachmentFileMutation = useMutation({
    mutationFn: async () => {
      if (!editingReport || !editNewFile) throw new Error("no_file");
      const { key } = await uploadFile(editNewFile);
      const { error } = await supabase.from("report_attachments").insert({
        report_id: editingReport.id,
        kind: "file",
        file_path: key,
        file_name: editNewFile.name,
        file_type: editNewFile.type || null,
      });
      if (error) throw error;
      await markPendingIfWasViewed();
    },
    onSuccess: () => {
      toast.success("Файл қосылды");
      setEditNewFile(null);
      invalidateReportData();
    },
    onError: () => toast.error("Файл қосылмады"),
  });

  const addAttachmentLinkMutation = useMutation({
    mutationFn: async () => {
      if (!editingReport) throw new Error("no_report");
      const trimmed = editNewLink.trim();
      if (!trimmed) throw new Error("empty");
      if (!isValidUrl(trimmed)) throw new Error("invalid_url");
      const { error } = await supabase.from("report_attachments").insert({
        report_id: editingReport.id,
        kind: "link",
        link_url: trimmed,
      });
      if (error) throw error;
      await markPendingIfWasViewed();
    },
    onSuccess: () => {
      toast.success("Сілтеме қосылды");
      setEditNewLink("");
      invalidateReportData();
    },
    onError: (err: Error) =>
      toast.error(err.message === "invalid_url" ? "Сілтеме дұрыс емес" : "Сілтеме қосылмады"),
  });

  const removeAttachmentMutation = useMutation({
    mutationFn: async (att: AttachmentRow) => {
      if (att.file_path) await removeStoredFile("report_attachments", att.file_path);
      const { error } = await supabase.from("report_attachments").delete().eq("id", att.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Жойылды");
      invalidateReportData();
    },
    onError: () => toast.error("Жою мүмкін болмады"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (row: ReportRow) => {
      for (const att of attachmentsOf(row.id)) {
        if (att.file_path) await removeStoredFile("report_attachments", att.file_path);
      }
      const { error } = await supabase.from("reports").delete().eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Жойылды");
      invalidateReportData();
    },
    onError: () => toast.error("Жою мүмкін болмады"),
  });

  const markViewedMutation = useMutation({
    mutationFn: async (row: ReportRow) => {
      if (row.status === "viewed") return;
      const { error } = await supabase
        .from("reports")
        .update({ status: "viewed", viewed_at: new Date().toISOString() })
        .eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reports"] });
      queryClient.invalidateQueries({ queryKey: ["report-notifications"] });
    },
  });

  async function openAttachment(att: AttachmentRow) {
    if (!att.file_path) return;
    try {
      await openStoredFile("report_attachments", att.file_path, att.file_name);
    } catch {
      toast.error("Файлды ашу мүмкін болмады");
    }
  }

  function startEdit(row: ReportRow) {
    setEditingReport(row);
    setTitle(row.title);
    setComment(row.comment ?? "");
    setFiles([]);
    setLinkUrls([""]);
    setEditNewFile(null);
    setEditNewLink("");
  }

  const classes = sortClassesByLiter(classesQuery.data ?? []);
  const myClass = classes.find((c) => c.name === me?.profile?.class_name);
  const rows = me?.isAdmin
    ? filterClassId === "all"
      ? allRows
      : allRows.filter((r) => r.class_id === filterClassId)
    : allRows.filter((r) => !!myClass && r.class_id === myClass.id);

  const viewingReport = allRows.find((r) => r.id === viewingId) ?? null;
  const viewingAttachments = viewingReport ? attachmentsOf(viewingReport.id) : [];

  useEffect(() => {
    if (!viewingReport || !me?.isAdmin) return;
    if (viewingReport.status === "pending") {
      markViewedMutation.mutate(viewingReport);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewingReport?.id, me?.isAdmin]);

  function authorName(id: string) {
    const p = authorsQuery.data?.find((a) => a.id === id);
    return p?.full_name || p?.username || "";
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-2xl font-bold md:text-3xl">Есептер</h1>
        {me?.isAdmin && !!notif?.total && (
          <Badge variant="destructive" className="text-sm">
            {notif.total}
          </Badge>
        )}
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        Атқарылған жұмыстар бойынша файл(дар) және/немесе сілтеме(лер) жіберіңіз.
        {me?.isAdmin ? " Әкімші барлық жетекшілердің есептерін көреді." : ""}
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_2fr]">
        <section className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display font-bold">
              {editingReport ? "Есепті өзгерту" : "Жаңа есеп"}
            </h2>
            {editingReport && (
              <Button variant="ghost" size="sm" onClick={resetForm}>
                <X className="size-4" /> Болдырмау
              </Button>
            )}
          </div>
          <div className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="r-title">Есеп атауы</Label>
              <Input
                id="r-title"
                value={title}
                maxLength={120}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Қыркүйек айындағы тәрбие жұмысы"
              />
            </div>
            <div className="space-y-2">
              <Label>Сынып</Label>
              {me?.isAdmin ? (
                <Select value={classId} onValueChange={setClassId} disabled={!!editingReport}>
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
              ) : (
                <Input
                  value={myClass ? `${myClass.name} сынып` : "Сынып тағайындалмаған"}
                  readOnly
                />
              )}
            </div>

            {editingReport ? (
              <div className="space-y-2 rounded-xl border border-dashed border-border p-3">
                <Label className="flex items-center gap-2">
                  <Paperclip className="size-4" /> Тіркелген материалдар
                </Label>
                {attachmentsOf(editingReport.id).length > 0 ? (
                  <ul className="space-y-2">
                    {attachmentsOf(editingReport.id).map((a) => (
                      <li
                        key={a.id}
                        className="flex items-center justify-between gap-2 rounded-lg border border-border/60 p-2 text-xs"
                      >
                        {a.kind === "file" ? (
                          <button
                            type="button"
                            className="flex min-w-0 items-center gap-2 truncate text-left hover:underline"
                            onClick={() => openAttachment(a)}
                          >
                            <Paperclip className="size-3.5 shrink-0" />
                            <span className="truncate">{a.file_name}</span>
                          </button>
                        ) : (
                          <a
                            href={a.link_url ?? "#"}
                            target="_blank"
                            rel="noreferrer"
                            className="flex min-w-0 items-center gap-2 truncate hover:underline"
                          >
                            <Link2 className="size-3.5 shrink-0" />
                            <span className="truncate">{a.link_url}</span>
                          </a>
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-6 shrink-0"
                          onClick={() => removeAttachmentMutation.mutate(a)}
                        >
                          <X className="size-3.5" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-muted-foreground">Әзірге материал жоқ.</p>
                )}

                <div className="grid gap-2 pt-2 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Input
                      type="file"
                      onChange={(e) => setEditNewFile(e.target.files?.[0] ?? null)}
                    />
                    <Button
                      type="button"
                      size="sm"
                      className="w-full"
                      onClick={() => addAttachmentFileMutation.mutate()}
                      disabled={!editNewFile || addAttachmentFileMutation.isPending}
                    >
                      Файл қосу
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <Input
                      type="url"
                      value={editNewLink}
                      onChange={(e) => setEditNewLink(e.target.value)}
                      placeholder="https://..."
                    />
                    <Button
                      type="button"
                      size="sm"
                      className="w-full"
                      onClick={() => addAttachmentLinkMutation.mutate()}
                      disabled={!editNewLink.trim() || addAttachmentLinkMutation.isPending}
                    >
                      Сілтеме қосу
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="space-y-2 rounded-xl border border-dashed border-border p-3">
                  <Label htmlFor="r-files" className="flex items-center gap-2">
                    <Paperclip className="size-4" /> Файл(дар) тіркеу
                  </Label>
                  <Input
                    id="r-files"
                    type="file"
                    multiple
                    onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
                  />
                  {files.length > 0 && (
                    <ul className="space-y-1">
                      {files.map((f, i) => (
                        <li
                          key={`${f.name}-${i}`}
                          className="flex items-center justify-between gap-2 text-xs text-muted-foreground"
                        >
                          <span className="truncate">{f.name}</span>
                          <button
                            type="button"
                            onClick={() => setFiles(files.filter((_, j) => j !== i))}
                          >
                            <X className="size-3.5" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="space-y-2 rounded-xl border border-dashed border-border p-3">
                  <Label className="flex items-center gap-2">
                    <Link2 className="size-4" /> Сілтеме(лер) қосу
                  </Label>
                  <div className="space-y-2">
                    {linkUrls.map((l, i) => (
                      <div key={i} className="flex gap-2">
                        <Input
                          type="url"
                          value={l}
                          onChange={(e) => {
                            const next = [...linkUrls];
                            next[i] = e.target.value;
                            setLinkUrls(next);
                          }}
                          placeholder="https://drive.google.com/..."
                        />
                        {linkUrls.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="shrink-0"
                            onClick={() => setLinkUrls(linkUrls.filter((_, j) => j !== i))}
                          >
                            <X className="size-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setLinkUrls([...linkUrls, ""])}
                  >
                    + Тағы сілтеме
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Google Drive, Google Docs, Canva, YouTube немесе кез келген веб-сілтеме.
                  </p>
                </div>

                {!hasAttachment && (
                  <p className="text-xs text-destructive">Файл немесе сілтеме қосыңыз</p>
                )}
              </>
            )}

            <div className="space-y-2">
              <Label htmlFor="r-comment">Қысқаша түсініктеме</Label>
              <Textarea
                id="r-comment"
                value={comment}
                maxLength={500}
                onChange={(e) => setComment(e.target.value)}
              />
            </div>

            {editingReport ? (
              <Button
                className="w-full"
                onClick={() => updateMutation.mutate()}
                disabled={!canSubmit || updateMutation.isPending}
              >
                Сақтау
              </Button>
            ) : (
              <Button
                className="w-full"
                onClick={() => uploadMutation.mutate()}
                disabled={!canSubmit || uploadMutation.isPending}
              >
                <Upload className="size-4" /> Есеп қосу
              </Button>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-6">
          <h2 className="font-display font-bold">Жүктелген есептер</h2>

          {me?.isAdmin && (
            <div className="mt-4 max-w-xs space-y-2">
              <Label>Сынып бойынша сүзгі</Label>
              <Select value={filterClassId} onValueChange={setFilterClassId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    <span className="inline-flex items-center gap-2">
                      <span>Барлығы</span>
                      {!!notif?.total && (
                        <Badge variant="destructive" className="px-1.5 py-0">
                          {notif.total}
                        </Badge>
                      )}
                    </span>
                  </SelectItem>
                  {classes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      <span className="inline-flex items-center gap-2">
                        <span>{c.name} сынып</span>
                        {!!notif?.byClass[c.id] && (
                          <Badge variant="destructive" className="px-1.5 py-0">
                            {notif.byClass[c.id]}
                          </Badge>
                        )}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {rows.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">Әзірге есеп жоқ.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {rows.map((r) => {
                const st = statusInfo(r.status);
                const atts = attachmentsOf(r.id);
                const fileCount = atts.filter((a) => a.kind === "file").length;
                const linkCount = atts.filter((a) => a.kind === "link").length;
                return (
                  <li key={r.id} className="rounded-xl border border-border/60 p-4 text-sm">
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold">{r.title}</p>
                        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                          <span>📅 {new Date(r.created_at).toLocaleDateString("kk-KZ")}</span>
                          {r.class_id && (
                            <span>
                              · {classes.find((c) => c.id === r.class_id)?.name ?? ""} сынып
                            </span>
                          )}
                          {me?.isAdmin && authorName(r.user_id) && (
                            <span>· {authorName(r.user_id)}</span>
                          )}
                          {fileCount > 0 && <span>· 📎 {fileCount} файл</span>}
                          {linkCount > 0 && <span>· 🔗 {linkCount} сілтеме</span>}
                        </p>
                        <p className="mt-1 text-xs">
                          {st.emoji} {st.label}
                        </p>
                        {r.comment && <p className="mt-2 text-muted-foreground">{r.comment}</p>}
                      </div>
                      <div className="flex shrink-0 flex-wrap justify-end gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          title="Қарау"
                          onClick={() => setViewingId(r.id)}
                        >
                          <Eye className="size-4" />
                        </Button>
                        {r.user_id === user?.id && (
                          <Button
                            variant="outline"
                            size="icon"
                            title="Өзгерту"
                            onClick={() => startEdit(r)}
                          >
                            <Pencil className="size-4" />
                          </Button>
                        )}
                        {(r.user_id === user?.id || me?.isAdmin) && (
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Жою"
                            onClick={() => deleteMutation.mutate(r)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <Dialog open={!!viewingId} onOpenChange={(open) => !open && setViewingId(null)}>
        <DialogContent className="max-w-lg">
          {viewingReport && (
            <>
              <DialogHeader>
                <DialogTitle>{viewingReport.title}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                {viewingReport.class_id && (
                  <p>
                    <span className="text-muted-foreground">Сынып: </span>
                    {classes.find((c) => c.id === viewingReport.class_id)?.name ?? ""} сынып
                  </p>
                )}
                {me?.isAdmin && authorName(viewingReport.user_id) && (
                  <p>
                    <span className="text-muted-foreground">Сынып жетекші: </span>
                    {authorName(viewingReport.user_id)}
                  </p>
                )}
                <p>
                  <span className="text-muted-foreground">Күні: </span>
                  {new Date(viewingReport.created_at).toLocaleDateString("kk-KZ")}
                </p>
                <div className="space-y-2">
                  <p className="text-muted-foreground">Тіркелген материалдар:</p>
                  <div className="flex flex-wrap gap-2">
                    {viewingAttachments.length > 0 ? (
                      viewingAttachments.map((a) =>
                        a.kind === "file" ? (
                          <Button
                            key={a.id}
                            variant="outline"
                            size="sm"
                            onClick={() => openAttachment(a)}
                          >
                            <Download className="size-4" /> {a.file_name}
                          </Button>
                        ) : (
                          <Button key={a.id} variant="outline" size="sm" asChild>
                            <a href={a.link_url ?? "#"} target="_blank" rel="noreferrer">
                              <ExternalLink className="size-4" /> {a.link_url}
                            </a>
                          </Button>
                        ),
                      )
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </div>
                </div>
                {viewingReport.comment && (
                  <div>
                    <p className="text-muted-foreground">Түсініктеме:</p>
                    <p className="mt-1">{viewingReport.comment}</p>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
