import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

type RlsClient = SupabaseClient<Database>;

const LOGIN_PATTERN = /^[a-z0-9]{2,40}$/;

async function requireAdmin(supabase: RlsClient, userId: string) {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Access denied");
}

/** Мұғалімнің логинін (әрі паролін login+82 форматына) ауыстыру — тек әкімшіге. */
export const renameTeacherLogin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { profileId: string; newLogin: string }) => {
    const newLogin = input.newLogin.trim().toLowerCase();
    if (!LOGIN_PATTERN.test(newLogin)) {
      throw new Error("Логин тек латын әріптері мен цифрлардан тұруы керек (2-40 таңба)");
    }
    if (!input.profileId) throw new Error("Invalid profileId");
    return { profileId: input.profileId, newLogin };
  })
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existing, error: existingError } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("username", data.newLogin)
      .maybeSingle();
    if (existingError) throw new Error(existingError.message);
    if (existing && existing.id !== data.profileId) {
      throw new Error("Бұл логин бұрыннан қолданыста");
    }

    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(data.profileId, {
      email: `${data.newLogin}@tarbie.local`,
      password: `${data.newLogin}82`,
      user_metadata: { username: data.newLogin },
    });
    if (authError) throw new Error(authError.message);

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({ username: data.newLogin })
      .eq("id", data.profileId);
    if (profileError) throw new Error(profileError.message);

    return { ok: true, newLogin: data.newLogin };
  });
