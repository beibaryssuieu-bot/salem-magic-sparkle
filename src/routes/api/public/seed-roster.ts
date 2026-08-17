import { createFileRoute } from "@tanstack/react-router";
import { SCHOOL_ROSTER } from "@/lib/school-roster";

/**
 * Бір реттік әкімшілік операция: ескі сыныптар мен жетекші аккаунттарын тазалап,
 * жаңа тізім бойынша сыныптарды және жетекшілерді тіркейді.
 * Тек ROSTER_SEED_TOKEN тақырыбымен шақырылады. Әкімші аккаунты тиілмейді.
 */
export const Route = createFileRoute("/api/public/seed-roster")({
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

          // 1. Әкімші емес пайдаланушыларды өшіру
          const { data: adminRoles, error: rolesError } = await supabaseAdmin
            .from("user_roles")
            .select("user_id")
            .eq("role", "admin");
          if (rolesError) return new Response(`user_roles: ${rolesError.message}`, { status: 500 });
          const adminIds = new Set((adminRoles ?? []).map((r) => r.user_id));

          let deletedUsers = 0;
          for (let page = 1; page <= 20; page++) {
            const { data, error } = await supabaseAdmin.auth.admin.listUsers({
              page,
              perPage: 200,
            });
            if (error) return new Response(`listUsers: ${error.message}`, { status: 500 });
            const users = data?.users ?? [];
            if (users.length === 0) break;
            for (const u of users) {
              if (adminIds.has(u.id)) continue;
              const res = await supabaseAdmin.auth.admin.deleteUser(u.id);
              if (!res.error) deletedUsers++;
            }
            if (users.length < 200) break;
          }

          // 2. Сыныпқа тәуелді деректерді және сыныптарды тазалау
          for (const table of [
            "attendance",
            "class_metrics",
            "class_quality",
            "class_scores",
            "reports",
          ] as const) {
            const { error } = await supabaseAdmin.from(table).delete().not("id", "is", null);
            if (error) return new Response(`${table}: ${error.message}`, { status: 500 });
          }
          {
            const { error } = await supabaseAdmin.from("classes").delete().not("id", "is", null);
            if (error) return new Response(`classes: ${error.message}`, { status: 500 });
          }

          // 3. Жаңа сыныптарды тіркеу
          const { error: insertError } = await supabaseAdmin
            .from("classes")
            .insert(SCHOOL_ROSTER.map((r) => ({ name: r.className })));
          if (insertError)
            return new Response(`classes insert: ${insertError.message}`, { status: 500 });

          // 4. Сынып жетекшілерін тіркеу
          const created: string[] = [];
          const failed: { login: string; message: string }[] = [];
          for (const entry of SCHOOL_ROSTER) {
            if (!entry.login || !entry.fullName) continue;
            const { error } = await supabaseAdmin.auth.admin.createUser({
              email: `${entry.login}@tarbie.local`,
              password: `${entry.login}82`,
              email_confirm: true,
              user_metadata: {
                username: entry.login,
                full_name: entry.fullName,
                class_name: entry.className,
              },
            });
            if (error) failed.push({ login: entry.login, message: error.message });
            else created.push(entry.login);
          }

          return Response.json({
            deletedUsers,
            classes: SCHOOL_ROSTER.length,
            createdTeachers: created.length,
            failed,
          });
        } catch (error) {
          console.error("[seed-roster]", error);
          const message = error instanceof Error ? error.message : String(error);
          return new Response(`Unhandled error: ${message}`, { status: 500 });
        }
      },
    },
  },
});
