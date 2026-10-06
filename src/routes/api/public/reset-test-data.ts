import { createFileRoute } from "@tanstack/react-router";

/**
 * Бір реттік әкімшілік операция: сайт нақты жұмысын бастар алдында тест
 * кезінде енгізілген деректерді тазалайды.
 *
 * Өшіреді: attendance (қатысым), class_scores, class_quality (ұпайлар),
 * reports (есептер), events + event_plans + event_reports +
 * event_report_attachments (іс-шаралар, cascade арқылы), сәйкес R2
 * файлдары.
 * Тимейді: classes (сыныптар тізімі), auth аккаунттар (логин/пароль),
 * eduqor_docs (ортақ құжат қоры).
 * Тек ROSTER_SEED_TOKEN тақырыбымен шақырылады.
 */
export const Route = createFileRoute("/api/public/reset-test-data")({
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
          const { r2DeleteObject } = await import("@/lib/r2.server");

          const fileKeys: string[] = [];

          const { data: reportFiles, error: reportFilesError } = await supabaseAdmin
            .from("reports")
            .select("file_path")
            .not("file_path", "is", null);
          if (reportFilesError)
            return new Response(`reports select: ${reportFilesError.message}`, { status: 500 });
          for (const r of reportFiles ?? []) if (r.file_path) fileKeys.push(r.file_path);

          const { data: planFiles, error: planFilesError } = await supabaseAdmin
            .from("event_plans")
            .select("file_path")
            .not("file_path", "is", null);
          if (planFilesError)
            return new Response(`event_plans select: ${planFilesError.message}`, { status: 500 });
          for (const r of planFiles ?? []) if (r.file_path) fileKeys.push(r.file_path);

          const { data: attachmentFiles, error: attachmentFilesError } = await supabaseAdmin
            .from("event_report_attachments")
            .select("file_path")
            .not("file_path", "is", null);
          if (attachmentFilesError)
            return new Response(
              `event_report_attachments select: ${attachmentFilesError.message}`,
              {
                status: 500,
              },
            );
          for (const r of attachmentFiles ?? []) if (r.file_path) fileKeys.push(r.file_path);

          let deletedFiles = 0;
          const failedFiles: { key: string; message: string }[] = [];
          for (const key of fileKeys) {
            try {
              await r2DeleteObject(key);
              deletedFiles++;
            } catch (error) {
              failedFiles.push({
                key,
                message: error instanceof Error ? error.message : String(error),
              });
            }
          }

          const deletedRows: Record<string, number> = {};
          for (const table of [
            "attendance",
            "class_scores",
            "class_quality",
            "reports",
            "events",
          ] as const) {
            const { error, count } = await supabaseAdmin
              .from(table)
              .delete({ count: "exact" })
              .not("id", "is", null);
            if (error) return new Response(`${table}: ${error.message}`, { status: 500 });
            deletedRows[table] = count ?? 0;
          }

          return Response.json({ deletedRows, deletedFiles, failedFiles });
        } catch (error) {
          console.error("[reset-test-data]", error);
          const message = error instanceof Error ? error.message : String(error);
          return new Response(`Unhandled error: ${message}`, { status: 500 });
        }
      },
    },
  },
});
