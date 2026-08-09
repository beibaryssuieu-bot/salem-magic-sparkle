import { KZ_MONTHS, formatPeriod } from "@/lib/metrics";

/** Оқу жылы: қыркүйек (09) — мамыр (05) */
export const ACADEMIC_MONTHS = [9, 10, 11, 12, 1, 2, 3, 4, 5] as const;

export type PeriodKind = "week" | "month" | "quarter" | "half" | "year";

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

/** Негізгі оқу жылы — 2026–2027 */
export const DEFAULT_ACADEMIC_START_YEAR = 2026;

export function academicYearOptions(count = 4, toYear = currentAcademicYear() + 1) {
  return Array.from({ length: count }, (_, i) => toYear - i).map((y) => ({
    value: String(y),
    label: `${y}–${y + 1} оқу жылы`,
  }));
}

/** Оқу жылындағы барлық айлар (YYYY-MM-01) */
export function academicYearPeriodList(startYear: number): string[] {
  return ACADEMIC_MONTHS.map((m) => periodDate(startYear, m));
}

const QUARTERS: { label: string; months: number[] }[] = [
  { label: "I тоқсан (қыркүйек–қазан)", months: [9, 10] },
  { label: "II тоқсан (қараша–желтоқсан)", months: [11, 12] },
  { label: "III тоқсан (қаңтар–наурыз)", months: [1, 2, 3] },
  { label: "IV тоқсан (сәуір–мамыр)", months: [4, 5] },
];

/** Берілген күннің дүйсенбісі (ISO) */
export function mondayOf(iso: string) {
  const d = new Date(iso + "T12:00:00");
  const shift = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - shift);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Апта кезеңінің сақталатын күні. Айлық кезеңдер әрқашан «-01» болғандықтан,
 * дүйсенбі айдың 1-і болса, кезең күні 2-сіне ығыстырылады (қақтығысты болдырмау).
 */
export function weekPeriodDate(iso: string) {
  const monday = mondayOf(iso);
  if (!monday.endsWith("-01")) return monday;
  const d = new Date(monday + "T12:00:00");
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Апта аралығының қысқаша жазбасы: 01.09–07.09 */
export function weekRangeLabel(period: string) {
  const s = new Date(mondayOf(period) + "T12:00:00");
  const e = new Date(s);
  e.setDate(e.getDate() + 6);
  const f = (d: Date) => `${pad(d.getDate())}.${pad(d.getMonth() + 1)}`;
  return `${f(s)}–${f(e)}`;
}

/** Оқу жылындағы барлық апталар (кезең күндері) */
export function academicWeeks(startYear: number): string[] {
  const from = `${startYear}-09-01`;
  const to = `${startYear + 1}-05-31`;
  let cur = mondayOf(from);
  if (cur < from) {
    const d = new Date(cur + "T12:00:00");
    d.setDate(d.getDate() + 7);
    cur = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  const weeks: string[] = [];
  while (cur <= to) {
    weeks.push(weekPeriodDate(cur));
    const d = new Date(cur + "T12:00:00");
    d.setDate(d.getDate() + 7);
    cur = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  return weeks;
}

export function periodOptions(kind: PeriodKind, startYear: number): PeriodOption[] {
  if (kind === "week") {
    return academicWeeks(startYear).map((mon, i) => ({
      value: `w-${mon}`,
      label: `${i + 1}-апта (${weekRangeLabel(mon)})`,
      periods: [mon],
    }));
  }
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

/** Кезең апталық па (айлық кезеңдер әрқашан «-01») */
export function isWeekPeriod(period: string) {
  return !period.endsWith("-01");
}

export const PERIOD_KIND_LABELS: Record<PeriodKind, string> = {
  week: "Апталық",
  month: "Айлық",
  quarter: "Тоқсандық",
  half: "Жартыжылдық",
  year: "Жылдық",
};

/** Кезеңнің оқылатын атауы (ай немесе апта) */
export function periodTitle(period: string) {
  return isWeekPeriod(period) ? `Апта ${weekRangeLabel(period)}` : formatPeriod(period);
}
