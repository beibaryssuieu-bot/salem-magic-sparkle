import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useProfile, useSession } from "@/lib/auth";
import { renameTeacherLogin } from "@/lib/teacher-accounts.functions";
import { sortClassesByLiter } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/teachers")({
  head: () => ({
    meta: [{ title: "Мұғалімдер — tarbie+" }],
  }),
  component: TeachersPage,
});

type ProfileRow = {
  id: string;
  username: string;
  full_name: string;
  class_name: string | null;
};

function TeachersPage() {
  const { user } = useSession();
  const { data: me, isLoading: profileLoading } = useProfile(user);
  const queryClient = useQueryClient();
  const renameLogin = useServerFn(renameTeacherLogin);

  const [editing, setEditing] = useState<ProfileRow | null>(null);
  const [newLogin, setNewLogin] = useState("");

  const profilesQuery = useQuery({
    queryKey: ["profiles-teachers"],
    enabled: !!me?.isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, full_name, class_name")
        .order("class_name");
      if (error) throw error;
      return (data ?? []) as ProfileRow[];
    },
  });

  const renameMutation = useMutation({
    mutationFn: async () => {
      if (!editing) throw new Error("no_profile");
      return renameLogin({ data: { profileId: editing.id, newLogin } });
    },
    onSuccess: (res) => {
      toast.success(`Логин ауыстырылды: ${res.newLogin} (пароль: ${res.newLogin}82)`);
      setEditing(null);
      setNewLogin("");
      queryClient.invalidateQueries({ queryKey: ["profiles-teachers"] });
    },
    onError: (err: Error) => toast.error(err.message || "Ауыстыру сәтсіз аяқталды"),
  });

  if (profileLoading) {
    return <p className="p-10 text-center text-muted-foreground">Жүктелуде…</p>;
  }

  if (!me?.isAdmin) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <h1 className="font-display text-xl font-bold">Рұқсат жоқ</h1>
        <p className="mt-2 text-sm text-muted-foreground">Бұл бөлім тек әкімшіге арналған.</p>
      </div>
    );
  }

  const rows = sortClassesByLiter(
    (profilesQuery.data ?? []).map((p) => ({ ...p, name: p.class_name ?? "—" })),
  );

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8">
      <h1 className="font-display text-2xl font-bold md:text-3xl">Мұғалімдер</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Сынып жетекшілердің логинін өзгерту. Логин ауыстырылғанда пароль автоматты түрде{" "}
        <span className="font-mono">логин+82</span> форматына орнатылады.
      </p>

      <div className="mt-6 overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="p-4 font-medium">Сынып</th>
              <th className="p-4 font-medium">Аты-жөні</th>
              <th className="p-4 font-medium">Логин</th>
              <th className="p-4" />
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} className="border-t border-border/60">
                <td className="p-4 font-medium">{p.class_name ? `${p.class_name} сынып` : "—"}</td>
                <td className="p-4">{p.full_name}</td>
                <td className="p-4 font-mono">{p.username}</td>
                <td className="p-4 text-right">
                  <Button
                    variant="outline"
                    size="icon"
                    title="Логинді өзгерту"
                    onClick={() => {
                      setEditing(p);
                      setNewLogin(p.username);
                    }}
                  >
                    <Pencil className="size-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing?.full_name} — логинді өзгерту</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-login">Жаңа логин</Label>
              <Input
                id="new-login"
                value={newLogin}
                onChange={(e) => setNewLogin(e.target.value.toLowerCase())}
                placeholder="karagulova"
              />
              <p className="text-xs text-muted-foreground">
                Тек латын әріптері мен цифрлар. Пароль автоматты{" "}
                <span className="font-mono">{newLogin || "login"}82</span> болады.
              </p>
            </div>
            <Button
              className="w-full"
              onClick={() => renameMutation.mutate()}
              disabled={!newLogin.trim() || renameMutation.isPending}
            >
              Сақтау
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
