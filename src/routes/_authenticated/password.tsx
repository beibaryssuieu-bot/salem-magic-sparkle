import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { KeyRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useProfile, useSession } from "@/lib/auth";
import { usernameToEmail } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/password")({
  head: () => ({
    meta: [
      { title: "Парольді өзгерту — TÄRBIE OS" },
      {
        name: "description",
        content: "Сынып жетекшілері мен әкімші өз аккаунтының паролін ауыстыратын бет.",
      },
      { property: "og:title", content: "Парольді өзгерту — TÄRBIE OS" },
      {
        property: "og:description",
        content: "Бастапқы парольді ауыстырып, аккаунтыңызды қорғаңыз.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PasswordPage,
});

function PasswordPage() {
  const { user } = useSession();
  const { data: me } = useProfile(user);

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (next.length < 6) {
      toast.error("Жаңа пароль кемінде 6 таңба болуы керек");
      return;
    }
    if (next !== repeat) {
      toast.error("Жаңа парольдер сәйкес келмейді");
      return;
    }
    const username = me?.profile?.username;
    if (!username) {
      toast.error("Профиль жүктелмеді, қайта көріңіз");
      return;
    }

    setLoading(true);
    const check = await supabase.auth.signInWithPassword({
      email: usernameToEmail(username),
      password: current,
    });
    if (check.error) {
      setLoading(false);
      toast.error("Қазіргі пароль қате");
      return;
    }

    const { error } = await supabase.auth.updateUser({ password: next });
    setLoading(false);
    if (error) {
      toast.error("Парольді өзгерту сәтсіз аяқталды");
      return;
    }
    setCurrent("");
    setNext("");
    setRepeat("");
    toast.success("Пароль өзгертілді. Келесі кіруде жаңа парольді қолданыңыз.");
  }

  return (
    <div className="mx-auto w-full max-w-md px-4 py-8">
      <h1 className="font-display text-2xl font-bold md:text-3xl">Парольді өзгерту</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Логиніңіз: <span className="font-medium">{me?.profile?.username}</span>. Бастапқы
        парольді өзіңіз білетін жаңа парольге ауыстырыңыз.
      </p>

      <form onSubmit={submit} className="mt-8 space-y-4 rounded-2xl border border-border bg-card p-6">
        <div className="space-y-2">
          <Label htmlFor="p-current">Қазіргі пароль</Label>
          <Input
            id="p-current"
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="p-next">Жаңа пароль</Label>
          <Input
            id="p-next"
            type="password"
            autoComplete="new-password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="p-repeat">Жаңа парольді қайталаңыз</Label>
          <Input
            id="p-repeat"
            type="password"
            autoComplete="new-password"
            value={repeat}
            onChange={(e) => setRepeat(e.target.value)}
            required
          />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          <KeyRound className="size-4" /> Сақтау
        </Button>
      </form>
    </div>
  );
}
