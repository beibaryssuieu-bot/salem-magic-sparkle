import { createFileRoute } from "@tanstack/react-router";

/**
 * Бір реттік әкімшілік операция: мұғалімнің логинін ауыстырады
 * (email + profiles.username), ескі логинге тіркелген деректерді
 * (аккаунт id) сол күйінде қалдырып. Пароль мен аты-жөн/сынып
 * sync-roster-де SCHOOL_ROSTER бойынша кейін жаңартылады — оны
 * осыдан кейін қайта шақыру керек.
 * Тек ROSTER_SEED_TOKEN тақырыбымен шақырылады.
 */
export const Route = createFileRoute("/api/public/rename-logins")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = request.headers.get("x-seed-token");
        const expected = process.env["ROSTER_SEED_TOKEN"];
        if (!expected || token !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        try {
          const body = (await request.json()) as {
            renames?: { oldLogin: string; newLogin: string }[];
          };
          const renames = body.renames ?? [];
          if (!Array.isArray(renames) || renames.length === 0) {
            return new Response("renames array required", { status: 400 });
          }

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          const renamed: string[] = [];
          const failed: { oldLogin: string; message: string }[] = [];

          for (const { oldLogin, newLogin } of renames) {
            const { data: profile, error: findError } = await supabaseAdmin
              .from("profiles")
              .select("id")
              .eq("username", oldLogin)
              .maybeSingle();
            if (findError) {
              failed.push({ oldLogin, message: findError.message });
              continue;
            }
            if (!profile) {
              failed.push({ oldLogin, message: "profile not found" });
              continue;
            }

            const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(profile.id, {
              email: `${newLogin}@tarbie.local`,
              user_metadata: { username: newLogin },
            });
            if (authError) {
              failed.push({ oldLogin, message: authError.message });
              continue;
            }

            const { error: profileError } = await supabaseAdmin
              .from("profiles")
              .update({ username: newLogin })
              .eq("id", profile.id);
            if (profileError) {
              failed.push({ oldLogin, message: profileError.message });
              continue;
            }

            renamed.push(`${oldLogin} -> ${newLogin}`);
          }

          return Response.json({ renamed, failed });
        } catch (error) {
          console.error("[rename-logins]", error);
          const message = error instanceof Error ? error.message : String(error);
          return new Response(`Unhandled error: ${message}`, { status: 500 });
        }
      },
    },
  },
});
