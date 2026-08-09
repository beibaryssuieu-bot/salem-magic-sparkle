import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useProfile, useSession } from "@/lib/auth";
import { MAX_TOTAL, percentOf, totalPoints, type ClassScoreRow } from "@/lib/criteria";
import {
  CLASS_MAX_TOTAL,
  classPercentOf,
  classTotalPoints,
  type ClassQualityRow,
  type ClassScores,
} from "@/lib/class-criteria";
import { periodTitle } from "@/lib/periods";

type Warning = { kind: string; rank: number; count: number; percent: number; period: string };

/** Соңғы кезең бойынша антирейтингке (соңғы 3 орын) кірген жетекшіні ескерту */
export function RatingAlert() {
  const { user } = useSession();
  const { data: me } = useProfile(user);
  const myClassName = me?.profile?.class_name ?? "";

  const classesQuery = useQuery({
    queryKey: ["classes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("classes").select("id, name").order("name");
      if (error) throw error;
      return data;
    },
    enabled: Boolean(myClassName),
  });

  const scoresQuery = useQuery({
    queryKey: ["class_scores"],
    queryFn: async () => {
      const { data, error } = await supabase.from("class_scores").select("*");
      if (error) throw error;
      return (data ?? []).map((r) => ({
        ...r,
        scores: (r.scores ?? {}) as Record<string, number>,
      })) as ClassScoreRow[];
    },
    enabled: Boolean(myClassName),
  });

  const qualityQuery = useQuery({
    queryKey: ["class_quality"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("class_quality")
        .select("id, class_id, period, scores, note");
      if (error) throw error;
      return (data ?? []).map((r) => ({
        ...r,
        scores: (r.scores ?? {}) as ClassScores,
      })) as ClassQualityRow[];
    },
    enabled: Boolean(myClassName),
  });

  const warnings = useMemo<Warning[]>(() => {
    const classes = classesQuery.data ?? [];
    const myClass = classes.find((c) => c.name === myClassName);
    if (!myClass) return [];

    const build = (
      rows: { class_id: string; period: string }[],
      points: (row: never) => number,
      max: number,
      pct: (p: number, m: number) => number,
      kind: string,
    ): Warning | null => {
      if (rows.length === 0) return null;
      const last = rows.reduce((a, r) => (r.period > a ? r.period : a), rows[0]!.period);
      const inPeriod = rows.filter((r) => r.period === last);
      const list = inPeriod
        .map((r) => ({
          classId: r.class_id,
          percent: pct(points(r as never), max),
        }))
        .sort((a, b) => b.percent - a.percent);
      if (list.length < 5) return null;
      const idx = list.findIndex((r) => r.classId === myClass.id);
      if (idx === -1) return null;
      const rank = idx + 1;
      if (rank <= list.length - 3) return null;
      return { kind, rank, count: list.length, percent: list[idx]!.percent, period: last };
    };

    const result: Warning[] = [];
    const teacher = build(
      scoresQuery.data ?? [],
      (r: never) => totalPoints((r as unknown as ClassScoreRow).scores),
      MAX_TOTAL,
      percentOf,
      "Сынып жетекші рейтингі",
    );
    if (teacher) result.push(teacher);

    const klass = build(
      qualityQuery.data ?? [],
      (r: never) => classTotalPoints((r as unknown as ClassQualityRow).scores),
      CLASS_MAX_TOTAL,
      classPercentOf,
      "Сынып рейтингі",
    );
    if (klass) result.push(klass);

    return result;
  }, [classesQuery.data, scoresQuery.data, qualityQuery.data, myClassName]);

  useEffect(() => {
    if (warnings.length === 0) return;
    const key = `anti-rating:${myClassName}:${warnings.map((w) => `${w.kind}${w.period}`).join("|")}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    toast.warning("Назар аударыңыз: рейтинг төмендеген", {
      description: warnings
        .map((w) => `${w.kind}: ${w.count} сыныптың ішінде ${w.rank}-орын`)
        .join(" · "),
    });
  }, [warnings, myClassName]);

  if (warnings.length === 0) return null;

  return (
    <div className="mt-6 rounded-2xl border border-destructive/40 bg-destructive/10 p-5">
      <h2 className="flex items-center gap-2 font-display font-bold text-destructive">
        <AlertTriangle className="size-4" /> Ескерту: антирейтингке кірдіңіз
      </h2>
      <ul className="mt-3 space-y-1.5 text-sm">
        {warnings.map((w) => (
          <li key={w.kind}>
            <span className="font-semibold">{w.kind}</span> — {periodTitle(w.period)}: {w.count}{" "}
            сыныптың ішінде <span className="font-semibold">{w.rank}-орын</span> ({w.percent}%).
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-muted-foreground">
        Көрсеткішті жақсарту үшін әлсіз бағыттарды қарап, есептеріңізді уақытылы жүктеңіз.
      </p>
    </div>
  );
}
