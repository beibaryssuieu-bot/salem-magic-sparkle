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

/**
 * Мұғалімнің логині мен аты-жөнін өзгерту — тек әкімшіге.
 * Логин нақты өзгертілгенде ғана пароль автоматты login+82 форматына
 * қайта орнатылады (аты-жөн ғана өзгерсе, пароль тиілмейді).
 */
export const updateTeacherProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { profileId: string; newLogin: string; fullName: string }) => {
    const newLogin = input.newLogin.trim().toLowerCase();
    const fullName = input.fullName.trim();
    if (!LOGIN_PATTERN.test(newLogin)) {
      throw new Error("Логин тек латын әріптері мен цифрлардан тұруы керек (2-40 таңба)");
    }
    if (!fullName) throw new Error("Аты-жөнін жазыңыз");
    if (!input.profileId) throw new Error("Invalid profileId");
    return { profileId: input.profileId, newLogin, fullName };
  })
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: current, error: currentError } = await supabaseAdmin
      .from("profiles")
      .select("username")
      .eq("id", data.profileId)
      .maybeSingle();
    if (currentError) throw new Error(currentError.message);
    if (!current) throw new Error("Профиль табылмады");

    const loginChanged = current.username !== data.newLogin;

    if (loginChanged) {
      const { data: existing, error: existingError } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("username", data.newLogin)
        .maybeSingle();
      if (existingError) throw new Error(existingError.message);
      if (existing && existing.id !== data.profileId) {
        throw new Error("Бұл логин бұрыннан қолданыста");
      }
    }

    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(data.profileId, {
      ...(loginChanged
        ? { email: `${data.newLogin}@tarbie.local`, password: `${data.newLogin}82` }
        : {}),
      user_metadata: { username: data.newLogin, full_name: data.fullName },
    });
    if (authError) throw new Error(authError.message);

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({ username: data.newLogin, full_name: data.fullName })
      .eq("id", data.profileId);
    if (profileError) throw new Error(profileError.message);

    return { ok: true, newLogin: data.newLogin, loginChanged };
  });
