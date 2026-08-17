import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ReportNotifications = {
  total: number;
  byClass: Record<string, number>;
};

const EMPTY: ReportNotifications = { total: 0, byClass: {} };

/**
 * Әкімшіге әлі қаралмаған («pending») есептердің жалпы саны және сынып
 * бойынша бөлінген саны. Real-time subscription бұл жобада қолданылмаған
 * (алдыңғы прецедент жоқ), сондықтан ең сенімді нұсқа ретінде polling
 * қолданылады — 15 секунд сайын автоматты жаңарады, беттi refresh
 * жасаудың қажеті жоқ.
 */
export function useReportNotifications(enabled: boolean) {
  return useQuery({
    queryKey: ["report-notifications"],
    enabled,
    refetchInterval: 15000,
    queryFn: async (): Promise<ReportNotifications> => {
      const { data, error } = await supabase
        .from("reports")
        .select("class_id")
        .eq("status", "pending");
      if (error) throw error;

      const byClass: Record<string, number> = {};
      for (const r of data ?? []) {
        if (!r.class_id) continue;
        byClass[r.class_id] = (byClass[r.class_id] ?? 0) + 1;
      }
      return { total: (data ?? []).length, byClass };
    },
    placeholderData: EMPTY,
  });
}
