import { createFileRoute } from "@tanstack/react-router";
import { SCHOOL_ROSTER } from "@/lib/school-roster";

/**
 * Ағымдағы сынып жетекшілер тізімін SCHOOL_ROSTER бойынша жаңартады.
 * seed-roster-тен айырмашылығы — ешкімді және ештеңені өшірмейді:
 * - жетіспейтін сыныптарды қосады (бар болғандарын тимейді);
 * - логині бар пайдаланушыны табады (profiles.username бойынша) —
 *   табылса, аты-жөні/сыныбы жаңартылады ЖӘНЕ паролі login+"82"
 *   форматына қайта орнатылады;
 * - табылмаса, жаңа аккаунт жасайды (паролі сол форматпен).
 * Тек ROSTER_SEED_TOKEN тақырыбымен шақырылады. Әкімші аккаунты тиілмейді.
 */
export const Route = createFileRoute("/api/public/sync-roster")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = request.headers.get("x-seed-token");
        const expected = process.env["ROSTER_SEED_TOKEN"];
        if (!expected || token !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          // 1. Жетіспейтін сыныптарды қосу (барларын тимейді)
          const { error: classError } = await supabaseAdmin.from("classes").upsert(
            SCHOOL_ROSTER.map((r) => ({ name: r.className })),
            { onConflict: "name", ignoreDuplicates: true },
          );
          if (classError) return new Response(`classes: ${classError.message}`, { status: 500 });

          // 2. Логині бар жазбаларды profiles кестесінен бір сұраныспен табу
          const entries = SCHOOL_ROSTER.filter(
            (r): r is { className: string; fullName: string; login: string } =>
              !!r.login && !!r.fullName,
          );
          const logins = entries.map((e) => e.login);
          const { data: existingProfiles, error: profilesError } = await supabaseAdmin
            .from("profiles")
            .select("id, username")
            .in("username", logins);
          if (profilesError)
            return new Response(`profiles: ${profilesError.message}`, { status: 500 });
          const idByLogin = new Map((existingProfiles ?? []).map((p) => [p.username, p.id]));

          const updated: string[] = [];
          const created: string[] = [];
          const failed: { login: string; message: string }[] = [];

          for (const entry of entries) {
            const password = `${entry.login}82`;
            const userId = idByLogin.get(entry.login);

            if (userId) {
              const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
                password,
                user_metadata: {
                  username: entry.login,
                  full_name: entry.fullName,
                  class_name: entry.className,
                },
              });
              if (authError) {
                failed.push({ login: entry.login, message: authError.message });
                continue;
              }
              const { error: profileError } = await supabaseAdmin
                .from("profiles")
                .update({ full_name: entry.fullName, class_name: entry.className })
                .eq("id", userId);
              if (profileError) {
                failed.push({ login: entry.login, message: profileError.message });
                continue;
              }
              updated.push(entry.login);
            } else {
              const { error: createError } = await supabaseAdmin.auth.admin.createUser({
                email: `${entry.login}@tarbie.local`,
                password,
                email_confirm: true,
                user_metadata: {
                  username: entry.login,
                  full_name: entry.fullName,
                  class_name: entry.className,
                },
              });
              if (createError) {
                failed.push({ login: entry.login, message: createError.message });
                continue;
              }
              created.push(entry.login);
            }
          }

          return Response.json({
            classes: SCHOOL_ROSTER.length,
            updatedTeachers: updated.length,
            createdTeachers: created.length,
            failed,
          });
        } catch (error) {
          console.error("[sync-roster]", error);
          const message = error instanceof Error ? error.message : String(error);
          return new Response(`Unhandled error: ${message}`, { status: 500 });
        }
      },
    },
  },
});
