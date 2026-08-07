/** «Үздік сынып» рейтингінің критерийлері — сынып жетекші рейтингінен тәуелсіз. */

export type ClassCriterion =
  | {
      key: string;
      label: string;
      hint?: string;
      type: "tier";
      tiers: { label: string; points: number }[];
    }
  | {
      key: string;
      label: string;
      hint?: string;
      type: "number";
      max: number;
      step: number;
    };

export const CLASS_CRITERIA: ClassCriterion[] = [
  {
    key: "punctuality",
    label: "Сабаққа кешікпеу",
    type: "tier",
    tiers: [
      { label: "Кешікпесе", points: 5 },
      { label: "Кешіксе", points: 0 },
    ],
  },
  {
    key: "attendance",
    label: "Қатысым",
    type: "tier",
    tiers: [
      { label: "100% қатысым", points: 5 },
      { label: "Дәлелді себеппен келмесе", points: 2.5 },
      { label: "Дәлелсіз себеппен келмесе", points: 0 },
    ],
  },
  {
    key: "uniform",
    label: "Мектеп формасы",
    type: "tier",
    tiers: [
      { label: "Форма сақталса", points: 5 },
      { label: "Форма сақталмаса", points: 0 },
    ],
  },
  {
    key: "hygiene",
    label: "Гигиена",
    type: "tier",
    tiers: [
      { label: "Барлығы таза болса", points: 5 },
      { label: "Талап сақталмаса", points: 0 },
    ],
  },
  {
    key: "grade_fund",
    label: "Баға қоры",
    hint: "Bilimclass жоғарғы бағалары бойынша анықталады (0–5 балл)",
    type: "number",
    max: 5,
    step: 0.5,
  },
];

export type ClassScores = Record<string, number>;

export function classCriterionMax(c: ClassCriterion) {
  return c.type === "number" ? c.max : Math.max(...c.tiers.map((t) => t.points));
}

export function classCriterionPoints(c: ClassCriterion, raw: number | undefined) {
  if (c.type === "number") return Math.max(0, Math.min(c.max, raw ?? 0));
  const tier = c.tiers[raw ?? 0];
  return tier?.points ?? 0;
}

export const CLASS_MAX_TOTAL = CLASS_CRITERIA.reduce((s, c) => s + classCriterionMax(c), 0);

export function classTotalPoints(scores: ClassScores) {
  const total = CLASS_CRITERIA.reduce(
    (s, c) => s + classCriterionPoints(c, scores[c.key]),
    0,
  );
  return Math.round(total * 10) / 10;
}

export function classPercentOf(points: number, max = CLASS_MAX_TOTAL) {
  if (max <= 0) return 0;
  return Math.round((points / max) * 100);
}

export type ClassQualityRow = {
  id: string;
  class_id: string;
  period: string;
  scores: ClassScores;
  note: string | null;
};
