import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { normalizeUsername, usernameToEmail } from "@/lib/auth";
import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Жүйеге кіру — TÄRBIE OS" },
      {
        name: "description",
        content:
          "Сынып жетекшілері мен әкімшілерге арналған TÄRBIE OS жүйесіне логин және құпиясөз арқылы кіру беті.",
      },
      { property: "og:title", content: "Жүйеге кіру — TÄRBIE OS" },
      {
        property: "og:description",
        content: "Логин мен құпиясөз арқылы сыныбыңыздың тәрбиелік шкаласына қол жеткізіңіз.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

const loginSchema = z.object({
  username: z.string().trim().min(3, "Логин кемінде 3 таңба").max(40),
  password: z.string().min(6, "Құпиясөз кемінде 6 таңба").max(72),
});

const signupSchema = loginSchema.extend({
  full_name: z.string().trim().min(2, "Аты-жөніңізді енгізіңіз").max(100),
  class_name: z.string().trim().max(20).optional(),
});

function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = loginSchema.safeParse({
      username: String(fd.get("username") ?? ""),
      password: String(fd.get("password") ?? ""),
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Деректерді тексеріңіз");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: usernameToEmail(parsed.data.username),
      password: parsed.data.password,
    });
    setLoading(false);
    if (error) {
      toast.error("Логин немесе құпиясөз қате");
      return;
    }
    toast.success("Қош келдіңіз!");
    navigate({ to: "/dashboard" });
  }

  async function handleSignup(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = signupSchema.safeParse({
      username: String(fd.get("username") ?? ""),
      password: String(fd.get("password") ?? ""),
      full_name: String(fd.get("full_name") ?? ""),
      class_name: String(fd.get("class_name") ?? ""),
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Деректерді тексеріңіз");
      return;
    }
    const username = normalizeUsername(parsed.data.username);
    if (username.length < 3) {
      toast.error("Логин латын әріптерімен жазылуы керек (мысалы: aigul7a)");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: usernameToEmail(username),
      password: parsed.data.password,
      options: {
        emailRedirectTo: window.location.origin,
        data: {
          username,
          full_name: parsed.data.full_name,
          class_name: parsed.data.class_name ?? "",
        },
      },
    });
    setLoading(false);
    if (error) {
      const m = error.message.toLowerCase();
      toast.error(
        m.includes("registered") || m.includes("already")
          ? "Бұл логин бұрын тіркелген"
          : m.includes("weak") || m.includes("pwned")
            ? "Құпиясөз тым қарапайым — күрделірек құпиясөз таңдаңыз"
            : `Тіркелу сәтсіз: ${error.message}`,
      );
      return;
    }
    toast.success("Тіркелдіңіз! Жүйеге кіріп жатырсыз…");
    navigate({ to: "/dashboard" });
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto flex w-full max-w-md flex-col px-4 py-14">
        <h1 className="font-display text-2xl font-bold">TÄRBIE OS жүйесіне кіру</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Логин мен құпиясөзді енгізіңіз. Логинді латын әріптерімен жазыңыз.
        </p>

        <Tabs defaultValue="login" className="mt-8">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">Кіру</TabsTrigger>
            <TabsTrigger value="signup">Тіркелу</TabsTrigger>
          </TabsList>

          <TabsContent value="login">
            <form onSubmit={handleLogin} className="space-y-4 rounded-2xl border border-border bg-card p-6">
              <div className="space-y-2">
                <Label htmlFor="login-username">Логин</Label>
                <Input id="login-username" name="username" autoComplete="username" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="login-password">Құпиясөз</Label>
                <Input
                  id="login-password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                Кіру
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="signup">
            <form onSubmit={handleSignup} className="space-y-4 rounded-2xl border border-border bg-card p-6">
              <div className="space-y-2">
                <Label htmlFor="signup-name">Аты-жөні</Label>
                <Input id="signup-name" name="full_name" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-class">Сыныбы</Label>
                <Input id="signup-class" name="class_name" placeholder='7 "А"' />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-username">Логин (латынша)</Label>
                <Input id="signup-username" name="username" autoComplete="username" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-password">Құпиясөз</Label>
                <Input
                  id="signup-password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                Тіркелу
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
