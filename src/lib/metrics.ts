export const METRICS = [
  { key: "discipline", label: "Тәртіп", color: "var(--color-chart-1)" },
  { key: "attendance", label: "Қатысу", color: "var(--color-chart-2)" },
  { key: "reading", label: "Кітап оқу", color: "var(--color-chart-3)" },
  { key: "volunteering", label: "Волонтерлік", color: "var(--color-chart-4)" },
  { key: "psychology", label: "Психол. ахуал", color: "var(--color-chart-5)" },
] as const;

export type MetricKey = (typeof METRICS)[number]["key"];

export type ClassMetric = {
  id: string;
  class_id: string;
  period: string;
  discipline: number;
  attendance: number;
  reading: number;
  volunteering: number;
  psychology: number;
  note: string | null;
};

export const KZ_MONTHS = [
  "Қаңтар",
  "Ақпан",
  "Наурыз",
  "Сәуір",
  "Мамыр",
  "Маусым",
  "Шілде",
  "Тамыз",
  "Қыркүйек",
  "Қазан",
  "Қараша",
  "Желтоқсан",
];

export function formatPeriod(period: string) {
  const [year, month] = period.split("-");
  return `${KZ_MONTHS[Number(month) - 1]} ${year}`;
}

export function overallIndex(m: ClassMetric) {
  return Math.round(
    (m.discipline + m.attendance + m.reading + m.volunteering + m.psychology) / 5,
  );
}

export function indexLabel(value: number) {
  if (value >= 85) return "Өте жақсы деңгей";
  if (value >= 70) return "Жақсы деңгей";
  if (value >= 55) return "Орташа деңгей";
  return "Назар аудару қажет";
}
