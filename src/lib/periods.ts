import { KZ_MONTHS } from "@/lib/metrics";

/** Оқу жылы: қыркүйек (09) — мамыр (05) */
export const ACADEMIC_MONTHS = [9, 10, 11, 12, 1, 2, 3, 4, 5] as const;

export type PeriodKind = "month" | "quarter" | "half" | "year";

export type PeriodOption = {
  value: string;
  label: string;
  /** period датасы: YYYY-MM-01 форматындағы тізім */
  periods: string[];
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function periodDate(startYear: number, month: number) {
  const year = month >= 9 ? startYear : startYear + 1;
  return `${year}-${pad(month)}-01`;
}

/** Ағымдағы оқу жылының басталу жылы (қыркүйек) */
export function currentAcademicYear(date = new Date()) {
  return date.getMonth() + 1 >= 9 ? date.getFullYear() : date.getFullYear() - 1;
}

export function academicYearOptions(count = 4, from = currentAcademicYear()) {
  return Array.from({ length: count }, (_, i) => from - i).map((y) => ({
    value: String(y),
    label: `${y}–${y + 1} оқу жылы`,
  }));
}

const QUARTERS: { label: string; months: number[] }[] = [
  { label: "I тоқсан (қыркүйек–қазан)", months: [9, 10] },
  { label: "II тоқсан (қараша–желтоқсан)", months: [11, 12] },
  { label: "III тоқсан (қаңтар–наурыз)", months: [1, 2, 3] },
  { label: "IV тоқсан (сәуір–мамыр)", months: [4, 5] },
];

export function periodOptions(kind: PeriodKind, startYear: number): PeriodOption[] {
  if (kind === "month") {
    return ACADEMIC_MONTHS.map((m) => ({
      value: `m-${m}`,
      label: `${KZ_MONTHS[m - 1]} ${m >= 9 ? startYear : startYear + 1}`,
      periods: [periodDate(startYear, m)],
    }));
  }
  if (kind === "quarter") {
    return QUARTERS.map((q, i) => ({
      value: `q-${i}`,
      label: q.label,
      periods: q.months.map((m) => periodDate(startYear, m)),
    }));
  }
  if (kind === "half") {
    return [
      {
        value: "h-1",
        label: "I жартыжылдық (қыркүйек–желтоқсан)",
        periods: [9, 10, 11, 12].map((m) => periodDate(startYear, m)),
      },
      {
        value: "h-2",
        label: "II жартыжылдық (қаңтар–мамыр)",
        periods: [1, 2, 3, 4, 5].map((m) => periodDate(startYear, m)),
      },
    ];
  }
  return [
    {
      value: "y",
      label: `${startYear}–${startYear + 1} оқу жылы (қыркүйек–мамыр)`,
      periods: ACADEMIC_MONTHS.map((m) => periodDate(startYear, m)),
    },
  ];
}

export const PERIOD_KIND_LABELS: Record<PeriodKind, string> = {
  month: "Айлық",
  quarter: "Тоқсандық",
  half: "Жартыжылдық",
  year: "Жылдық",
};
