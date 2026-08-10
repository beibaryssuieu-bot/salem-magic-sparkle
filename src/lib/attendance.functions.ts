import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ClassAttendanceSummary = {
  classId: string;
  name: string;
  present: number;
  total: number;
  days: number;
  percent: number | null;
};

/**
 * Барлық сыныптардың ЖИНАҚТАЛҒАН қатысым статистикасы.
 * Кірген кез келген пайдаланушыға қолжетімді, бірақ тек агрегат:
 * ескертпелер, мұғалім деректері және күнделікті жазбалар қайтарылмайды.
 */
export const getClassAttendanceSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { from: string; to: string }) => {
    const iso = /^\d{4}-\d{2}-\d{2}$/;
    if (!iso.test(input.from) || !iso.test(input.to)) throw new Error("Invalid range");
    return input;
  })
  .handler(async ({ data }): Promise<ClassAttendanceSummary[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [classesRes, rowsRes] = await Promise.all([
      supabaseAdmin.from("classes").select("id, name"),
      supabaseAdmin
        .from("attendance")
        .select("class_id, total_students, present_students")
        .gte("day", data.from)
        .lte("day", data.to),
    ]);
    if (classesRes.error) throw new Error(classesRes.error.message);
    if (rowsRes.error) throw new Error(rowsRes.error.message);

    const agg = new Map<string, { present: number; total: number; days: number }>();
    for (const r of rowsRes.data ?? []) {
      const cur = agg.get(r.class_id) ?? { present: 0, total: 0, days: 0 };
      cur.present += r.present_students;
      cur.total += r.total_students;
      cur.days += 1;
      agg.set(r.class_id, cur);
    }

    return (classesRes.data ?? []).map((c) => {
      const a = agg.get(c.id) ?? { present: 0, total: 0, days: 0 };
      return {
        classId: c.id,
        name: c.name,
        present: a.present,
        total: a.total,
        days: a.days,
        percent: a.total > 0 ? Math.round((a.present / a.total) * 100) : null,
      };
    });
  });
