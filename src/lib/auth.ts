import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Логин (пайдаланушы аты) арқылы кіру үшін ішкі, тұрақты email жасалады.
 * Пайдаланушы бұл адресті ешқашан көрмейді.
 */
export function usernameToEmail(username: string) {
  const normalized = username.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "");
  return `${normalized}@tarbie.local`;
}

export function normalizeUsername(username: string) {
  return username.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "");
}

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { session, user: session?.user ?? null, loading };
}

export type Profile = {
  id: string;
  username: string;
  full_name: string;
  class_name: string | null;
};

export function useProfile(user: User | null) {
  return useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [profileRes, rolesRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, username, full_name, class_name")
          .eq("id", user!.id)
          .maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", user!.id),
      ]);
      if (profileRes.error) throw profileRes.error;
      if (rolesRes.error) throw rolesRes.error;
      const roles = (rolesRes.data ?? []).map((r) => r.role);
      return {
        profile: profileRes.data as Profile | null,
        roles,
        isAdmin: roles.includes("admin"),
      };
    },
  });
}
