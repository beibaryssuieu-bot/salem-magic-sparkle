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
import { useProfile, useSession } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/eduqor")({
  head: () => ({
    meta: [
      { title: "EduQor — ортақ құжаттар — TÄRBIE OS" },
      {
        name: "description",
        content:
          "EduQor — сынып жетекшілерінің ортақ құжаттар қоры: кез келген жетекші жүктей алады, барлығы көріп, жүктеп ала алады.",
      },
      { property: "og:title", content: "EduQor — ортақ құжаттар — TÄRBIE OS" },
      {
        property: "og:description",
        content: "Сынып жетекшілері арасында әдістемелік материалдармен алмасу кеңістігі.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: EduQorPage,
});

type DocRow = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  file_path: string;
  file_name: string;
  created_at: string;
};

function EduQorPage() {
  const { user } = useSession();
  const { data: me } = useProfile(user);
  const queryClient = useQueryClient();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const docsQuery = useQuery({
    queryKey: ["eduqor_docs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("eduqor_docs")
        .select("id, user_id, title, description, file_path, file_name, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as DocRow[];
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!file || !title.trim()) throw new Error("empty");
      const path = `${user!.id}/${crypto.randomUUID()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
      const up = await supabase.storage.from("eduqor").upload(path, file);
      if (up.error) throw up.error;
      const { error } = await supabase.from("eduqor_docs").insert({
        user_id: user!.id,
        title: title.trim(),
        description: description.trim() || null,
        file_path: path,
        file_name: file.name,
        file_type: file.type || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Құжат ортақ қорға қосылды");
      setTitle("");
      setDescription("");
      setFile(null);
      queryClient.invalidateQueries({ queryKey: ["eduqor_docs"] });
    },
    onError: () => toast.error("Жүктеу сәтсіз аяқталды"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (row: DocRow) => {
      await supabase.storage.from("eduqor").remove([row.file_path]);
      const { error } = await supabase.from("eduqor_docs").delete().eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Жойылды");
      queryClient.invalidateQueries({ queryKey: ["eduqor_docs"] });
    },
    onError: () => toast.error("Жою мүмкін болмады"),
  });

  async function download(row: DocRow) {
    const { data, error } = await supabase.storage
      .from("eduqor")
      .createSignedUrl(row.file_path, 60, { download: row.file_name });
    if (error || !data) {
      toast.error("Файлды ашу мүмкін болмады");
      return;
    }
    window.open(data.signedUrl, "_blank");
  }

  const rows = docsQuery.data ?? [];

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <h1 className="font-display text-2xl font-bold md:text-3xl">EduQor</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Сынып жетекшілерінің ортақ құжат қоры — кез келген жетекші жүктей алады, барлығы жүктеп ала
        алады.
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_2fr]">
        <section className="rounded-2xl border border-border bg-card p-6">
          <h2 className="font-display font-bold">Құжат қосу</h2>
          <div className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="e-title">Атауы</Label>
              <Input
                id="e-title"
                value={title}
                maxLength={120}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Тәрбие сағатының жоспары"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="e-file">Файл</Label>
              <Input
                id="e-file"
                type="file"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="e-desc">Сипаттама</Label>
              <Textarea
                id="e-desc"
                value={description}
                maxLength={500}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <Button
              className="w-full"
              onClick={() => uploadMutation.mutate()}
              disabled={!file || !title.trim() || uploadMutation.isPending}
            >
              <Upload className="size-4" /> Бөлісу
            </Button>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-6">
          <h2 className="font-display font-bold">Ортақ құжаттар</h2>
          {rows.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">Әзірге құжат жоқ.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {rows.map((r) => (
                <li key={r.id} className="rounded-xl border border-border/60 p-4 text-sm">
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold">{r.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(r.created_at).toLocaleDateString("kk-KZ")}
                      </p>
                      {r.description && (
                        <p className="mt-2 text-muted-foreground">{r.description}</p>
                      )}
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
