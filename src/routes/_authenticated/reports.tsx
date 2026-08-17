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
  file_path: string | null;
  file_name: string | null;
  link_url: string | null;
  status: string;
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

  const [title, setTitle] = useState("");
  const [comment, setComment] = useState("");
  const [classId, setClassId] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [removeExistingFile, setRemoveExistingFile] = useState(false);
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
        .select(
          "id, user_id, class_id, title, comment, file_path, file_name, link_url, status, created_at",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ReportRow[];
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

  const { data: notif } = useReportNotifications(!!me?.isAdmin);

  function resetForm() {
    setTitle("");
    setComment("");
    setLinkUrl("");
    setFile(null);
    setRemoveExistingFile(false);
    setEditingReport(null);
  }

  const keptExistingFile = !!editingReport?.file_path && !removeExistingFile && !file;
  const hasAttachment = !!file || keptExistingFile || !!linkUrl.trim();
  const canSubmit = !!title.trim() && hasAttachment;

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!title.trim()) throw new Error("title_required");
      const trimmedLink = linkUrl.trim();
      if (!file && !trimmedLink) throw new Error("file_or_link_required");
      if (trimmedLink && !isValidUrl(trimmedLink)) throw new Error("invalid_url");

      const own = (classesQuery.data ?? []).find((c) => c.name === me?.profile?.class_name);
      const targetClassId = me?.isAdmin ? classId : (own?.id ?? "");

      let file_path: string | null = null;
      let file_name: string | null = null;
      let file_type: string | null = null;
      if (file) {
        const path = `${user!.id}/${crypto.randomUUID()}-${file.name.replace(/[^\w.-]/g, "_")}`;
        const up = await supabase.storage.from("reports").upload(path, file);
        if (up.error) throw up.error;
        file_path = path;
        file_name = file.name;
        file_type = file.type || null;
      }

      const { error } = await supabase.from("reports").insert({
        user_id: user!.id,
        class_id: targetClassId || null,
        title: title.trim(),
        comment: comment.trim() || null,
        file_path,
        file_name,
        file_type,
        link_url: trimmedLink || null,
        status: "pending",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Есеп жіберілді");
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["reports"] });
      queryClient.invalidateQueries({ queryKey: ["report-notifications"] });
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
      const trimmedLink = linkUrl.trim();
      if (trimmedLink && !isValidUrl(trimmedLink)) throw new Error("invalid_url");

      let file_path = editingReport.file_path;
      let file_name = editingReport.file_name;
      let file_type: string | null = null;
      if (file) {
        const path = `${user!.id}/${crypto.randomUUID()}-${file.name.replace(/[^\w.-]/g, "_")}`;
        const up = await supabase.storage.from("reports").upload(path, file);
        if (up.error) throw up.error;
        if (editingReport.file_path) {
          await supabase.storage.from("reports").remove([editingReport.file_path]);
        }
        file_path = path;
        file_name = file.name;
        file_type = file.type || null;
      } else if (removeExistingFile && editingReport.file_path) {
        await supabase.storage.from("reports").remove([editingReport.file_path]);
        file_path = null;
        file_name = null;
      }

      if (!file_path && !trimmedLink) throw new Error("file_or_link_required");

      const wasViewed = editingReport.status === "viewed";
      const { error } = await supabase
        .from("reports")
        .update({
          title: title.trim(),
          comment: comment.trim() || null,
          link_url: trimmedLink || null,
          file_path,
          file_name,
          ...(file ? { file_type } : {}),
          // Әкімші бұрын қарап қойған есепті сынып жетекші өзгертсе,
          // әкімшіге қайта жаңа өзгеріс ретінде хабарлансын.
          ...(wasViewed ? { status: "pending", viewed_at: null } : {}),
        })
        .eq("id", editingReport.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Өзгерістер сақталды");
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["reports"] });
      queryClient.invalidateQueries({ queryKey: ["report-notifications"] });
    },
    onError: (err: Error) => {
      if (err.message === "file_or_link_required") {
        toast.error("Файл немесе сілтеме қосыңыз");
      } else if (err.message === "invalid_url") {
        toast.error("Сілтеме дұрыс емес (https://... форматында болуы керек)");
      } else {
        toast.error("Сақтау сәтсіз аяқталды");
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (row: ReportRow) => {
      if (row.file_path) await supabase.storage.from("reports").remove([row.file_path]);
      const { error } = await supabase.from("reports").delete().eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Жойылды");
      queryClient.invalidateQueries({ queryKey: ["reports"] });
      queryClient.invalidateQueries({ queryKey: ["report-notifications"] });
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

  async function download(row: ReportRow) {
    if (!row.file_path) return;
    const { data, error } = await supabase.storage
      .from("reports")
      .createSignedUrl(row.file_path, 60, row.file_name ? { download: row.file_name } : {});
    if (error || !data) {
      toast.error("Файлды ашу мүмкін болмады");
      return;
    }
    window.open(data.signedUrl, "_blank");
  }

  function startEdit(row: ReportRow) {
    setEditingReport(row);
    setTitle(row.title);
    setComment(row.comment ?? "");
    setLinkUrl(row.link_url ?? "");
    setFile(null);
    setRemoveExistingFile(false);
  }

  const classes = sortClassesByLiter(classesQuery.data ?? []);
  const myClass = classes.find((c) => c.name === me?.profile?.class_name);
  const allRows = reportsQuery.data ?? [];
  const rows = me?.isAdmin
    ? filterClassId === "all"
      ? allRows
      : allRows.filter((r) => r.class_id === filterClassId)
    : allRows.filter((r) => !!myClass && r.class_id === myClass.id);

  const viewingReport = allRows.find((r) => r.id === viewingId) ?? null;

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
        Атқарылған жұмыстар бойынша файл және/немесе сілтеме жіберіңіз.
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

            <div className="space-y-2 rounded-xl border border-dashed border-border p-3">
              <Label htmlFor="r-file" className="flex items-center gap-2">
                <Paperclip className="size-4" /> Файл тіркеу
              </Label>
              <Input
                id="r-file"
                type="file"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              {editingReport?.file_name && !file && !removeExistingFile && (
                <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span className="truncate">Қазіргі файл: {editingReport.file_name}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-auto shrink-0 px-2 py-1 text-destructive"
                    onClick={() => setRemoveExistingFile(true)}
                  >
                    Өшіру
                  </Button>
                </div>
              )}
              {removeExistingFile && (
                <p className="text-xs text-muted-foreground">
                  Файл өшіріледі.{" "}
                  <button
                    type="button"
                    className="underline"
                    onClick={() => setRemoveExistingFile(false)}
                  >
                    Болдырмау
                  </button>
                </p>
              )}
            </div>

            <div className="space-y-2 rounded-xl border border-dashed border-border p-3">
              <Label htmlFor="r-link" className="flex items-center gap-2">
                <Link2 className="size-4" /> Сілтеме қосу
              </Label>
              <Input
                id="r-link"
                type="url"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://drive.google.com/..."
              />
              <p className="text-xs text-muted-foreground">
                Google Drive, Google Docs, Canva, YouTube немесе кез келген веб-сілтеме.
              </p>
            </div>

            {!hasAttachment && (
              <p className="text-xs text-destructive">Файл немесе сілтеме қосыңыз</p>
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
                          {r.file_name && <span>· 📎 1 файл</span>}
                          {r.link_url && <span>· 🔗 1 сілтеме</span>}
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
                        {r.file_name && (
                          <Button
                            variant="outline"
                            size="icon"
                            title="Файлды жүктеу"
                            onClick={() => download(r)}
                          >
                            <Download className="size-4" />
                          </Button>
                        )}
                        {r.link_url && (
                          <Button variant="outline" size="icon" title="Сілтемені ашу" asChild>
                            <a href={r.link_url} target="_blank" rel="noreferrer">
                              <ExternalLink className="size-4" />
                            </a>
                          </Button>
                        )}
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
                    {viewingReport.file_name && (
                      <Button variant="outline" size="sm" onClick={() => download(viewingReport)}>
                        <Paperclip className="size-4" /> {viewingReport.file_name}
                      </Button>
                    )}
                    {viewingReport.link_url && (
                      <Button variant="outline" size="sm" asChild>
                        <a href={viewingReport.link_url} target="_blank" rel="noreferrer">
                          <ExternalLink className="size-4" /> Сілтемені ашу
                        </a>
                      </Button>
                    )}
                    {!viewingReport.file_name && !viewingReport.link_url && (
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
