import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut, LayoutDashboard, Settings2, TreeDeciduous } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useProfile, useSession } from "@/lib/auth";

export function AppHeader() {
  const { user } = useSession();
  const { data } = useProfile(user);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <TreeDeciduous className="size-5" />
          </span>
          <span className="font-display text-lg font-bold tracking-tight">TÄRBIE OS</span>
        </Link>

        <nav className="flex items-center gap-2">
          {user ? (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link to="/dashboard">
                  <LayoutDashboard className="size-4" /> Басты бет
                </Link>
              </Button>
              {data?.isAdmin && (
                <Button asChild variant="ghost" size="sm">
                  <Link to="/admin">
                    <Settings2 className="size-4" /> Басқару
                  </Link>
                </Button>
              )}
              <span className="hidden text-sm text-muted-foreground sm:inline">
                {data?.profile?.full_name || data?.profile?.username}
              </span>
              <Button variant="outline" size="sm" onClick={signOut}>
                <LogOut className="size-4" /> Шығу
              </Button>
            </>
          ) : (
            <Button asChild size="sm">
              <Link to="/auth">Жүйеге кіру</Link>
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
}
