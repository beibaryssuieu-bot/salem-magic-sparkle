import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, Trash2, Upload } from "lucide-react";
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
import { sortClassesByLiter } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({
    meta: [
      { title: "Есептер — TÄRBIE OS" },
      {
        name: "description",
        content:
          "Сынып жетекшілерінің атқарылған жұмыстары бойынша құжаттарын, презентацияларын және фотоларын жүктеу бөлімі.",
      },
      { property: "og:title", content: "Есептер — TÄRBIE OS" },
      {
        property: "og:description",
        content: "Жетекшілердің жұмыс есептері: құжат, презентация, фото және түсініктеме.",
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
  file_path: string;
  file_name: string;
  created_at: string;
};

function ReportsPage() {
  const { user } = useSession();
  const { data: me } = useProfile(user);
  const queryClient = useQueryClient();

  const [title, setTitle] = useState("");
  const [comment, setComment] = useState("");
  const [classId, setClassId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [filterClassId, setFilterClassId] = useState("all");

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
        .select("id, user_id, class_id, title, comment, file_path, file_name, created_at");
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

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!file || !title.trim()) throw new Error("empty");
      const path = `${user!.id}/${crypto.randomUUID()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
      const up = await supabase.storage.from("reports").upload(path, file);
      if (up.error) throw up.error;
      const { error } = await supabase.from("reports").insert({
        user_id: user!.id,
        class_id: classId || null,
        title: title.trim(),
        comment: comment.trim() || null,
        file_path: path,
        file_name: file.name,
        file_type: file.type || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Есеп жүктелді");
      setTitle("");
      setComment("");
      setFile(null);
      queryClient.invalidateQueries({ queryKey: ["reports"] });
    },
    onError: () => toast.error("Жүктеу сәтсіз аяқталды"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (row: ReportRow) => {
      await supabase.storage.from("reports").remove([row.file_path]);
      const { error } = await supabase.from("reports").delete().eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Жойылды");
      queryClient.invalidateQueries({ queryKey: ["reports"] });
    },
    onError: () => toast.error("Жою мүмкін болмады"),
  });

  async function download(row: ReportRow) {
    const { data, error } = await supabase.storage
      .from("reports")
      .createSignedUrl(row.file_path, 60, { download: row.file_name });
    if (error || !data) {
      toast.error("Файлды ашу мүмкін болмады");
      return;
    }
    window.open(data.signedUrl, "_blank");
  }

  const classes = sortClassesByLiter(classesQuery.data ?? []);
  const allRows = reportsQuery.data ?? [];
  const rows =
    filterClassId === "all" ? allRows : allRows.filter((r) => r.class_id === filterClassId);

  function authorName(id: string) {
    const p = authorsQuery.data?.find((a) => a.id === id);
    return p?.full_name || p?.username || "";
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <h1 className="font-display text-2xl font-bold md:text-3xl">Есептер</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Атқарылған жұмыстар бойынша құжат, презентация немесе фото жүктеңіз.
        {me?.isAdmin ? " Әкімші барлық жетекшілердің есептерін көреді." : ""}
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_2fr]">
        <section className="rounded-2xl border border-border bg-card p-6">
          <h2 className="font-display font-bold">Жаңа есеп</h2>
          <div className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="r-title">Тақырып</Label>
              <Input
                id="r-title"
                value={title}
                maxLength={120}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ашық тәрбие сағаты"
              />
            </div>
            <div className="space-y-2">
              <Label>Сынып</Label>
              <Select value={classId} onValueChange={setClassId}>
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
              <Label htmlFor="r-file">Файл</Label>
              <Input
                id="r-file"
                type="file"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="r-comment">Комментарий</Label>
              <Textarea
                id="r-comment"
                value={comment}
                maxLength={500}
                onChange={(e) => setComment(e.target.value)}
              />
            </div>
            <Button
              className="w-full"
              onClick={() => uploadMutation.mutate()}
              disabled={!file || !title.trim() || uploadMutation.isPending}
            >
              <Upload className="size-4" /> Жүктеу
            </Button>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-6">
          <h2 className="font-display font-bold">Жүктелген есептер</h2>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              variant={filterClassId === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterClassId("all")}
            >
              Барлығы
            </Button>
            {classes.map((c) => (
              <Button
                key={c.id}
                variant={filterClassId === c.id ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterClassId(c.id)}
              >
                {c.name}
              </Button>
            ))}
          </div>

          {rows.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">Әзірге есеп жоқ.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {rows.map((r) => (
                <li
                  key={r.id}
                  className="rounded-xl border border-border/60 p-4 text-sm"
                >
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold">{r.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(r.created_at).toLocaleDateString("kk-KZ")}
                        {r.class_id &&
                          ` · ${classes.find((c) => c.id === r.class_id)?.name ?? ""} сынып`}
                        {me?.isAdmin && authorName(r.user_id) ? ` · ${authorName(r.user_id)}` : ""}
                      </p>
                      {r.comment && <p className="mt-2 text-muted-foreground">{r.comment}</p>}
                      <p className="mt-1 truncate text-xs text-muted-foreground">{r.file_name}</p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button variant="outline" size="icon" onClick={() => download(r)}>
                        <Download className="size-4" />
                      </Button>
                      {(r.user_id === user?.id || me?.isAdmin) && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteMutation.mutate(r)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
