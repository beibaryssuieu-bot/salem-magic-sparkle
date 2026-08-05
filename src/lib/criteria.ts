export type Tier = { label: string; points: number };

export type Criterion =
  | {
      key: string;
      label: string;
      group: string;
      type: "tier";
      tiers: Tier[];
    }
  | {
      key: string;
      label: string;
      group: string;
      type: "fixed";
      points: number;
    }
  | {
      key: string;
      label: string;
      group: string;
      type: "count";
      perUnit: number;
      maxUnits: number;
      unitLabel: string;
    };

export const GROUPS = [
  "Мектепішілік тәрбие үдерісі",
  "Мектептен тыс мекемелер мен шаралар",
  "Шегерім баллдары",
] as const;

const G1 = GROUPS[0];
const G2 = GROUPS[1];
const G3 = GROUPS[2];

const tier5 = (a: string, b: string, c: string, d: string, e: string): Tier[] => [
  { label: "Жоқ", points: 0 },
  { label: a, points: 2 },
  { label: b, points: 4 },
  { label: c, points: 6 },
  { label: d, points: 8 },
  { label: e, points: 10 },
];

export const CRITERIA: Criterion[] = [
  {
    key: "quality",
    label: "Сыныптың білім сапасы",
    group: G1,
    type: "tier",
    tiers: [
      { label: "Жоқ", points: 0 },
      { label: "10-30%", points: 10 },
      { label: "31-50%", points: 20 },
      { label: "51-70%", points: 30 },
      { label: "71-85%", points: 40 },
      { label: "86-100%", points: 50 },
    ],
  },
  {
    key: "no_violations",
    label: "Тәртіпбұзушылықтың орын алмауы",
    group: G1,
    type: "fixed",
    points: 5,
  },
  {
    key: "special_needs",
    label: "Ерекше оқытуды қажет ететін / үйден оқитын оқушылармен жұмыс",
    group: G1,
    type: "count",
    perUnit: 5,
    maxUnits: 10,
    unitLabel: "оқушы",
  },
  {
    key: "parent_meeting",
    label: "Ата-аналар жиналысына қатысым",
    group: G1,
    type: "tier",
    tiers: [
      { label: "Жоқ", points: 0 },
      { label: "40-50%", points: 2 },
      { label: "51-60%", points: 4 },
      { label: "61-70%", points: 6 },
      { label: "71-84%", points: 8 },
      { label: "85-100%", points: 10 },
    ],
  },
  {
    key: "open_hour_parents",
    label: "Ата-анамен бірігіп ашық тәрбие сағатын өткізуі",
    group: G1,
    type: "fixed",
    points: 5,
  },
  { key: "open_class_hour", label: "Ашық сынып сағатын өткізу", group: G1, type: "fixed", points: 5 },
  {
    key: "open_event",
    label: "Ашық сыныптан тыс шара өткізу",
    group: G1,
    type: "fixed",
    points: 5,
  },
  {
    key: "youtube",
    label: "Youtube каналға видео жариялау",
    group: G1,
    type: "fixed",
    points: 10,
  },
  {
    key: "clubs_in",
    label: "Мектепішілік үйірме-секцияларға қатысым",
    group: G1,
    type: "tier",
    tiers: tier5("1-5 оқушы", "6-10 оқушы", "11-15 оқушы", "16-20 оқушы", "21-30 оқушы"),
  },
  {
    key: "clubs_out",
    label: "Мектептен тыс үйірме-секцияларға қатысым",
    group: G1,
    type: "tier",
    tiers: tier5("1-5 оқушы", "6-10 оқушы", "11-15 оқушы", "16-20 оқушы", "21-30 оқушы"),
  },
  {
    key: "reading",
    label: "Оқушылардың кітап оқу белсенділігі",
    group: G1,
    type: "tier",
    tiers: [
      { label: "Жоқ", points: 0 },
      { label: "1-5 оқушы", points: 1 },
      { label: "6-10 оқушы", points: 2 },
      { label: "11-15 оқушы", points: 3 },
      { label: "16-20 оқушы", points: 4 },
      { label: "21-30 оқушы", points: 5 },
    ],
  },
  {
    key: "kabbk",
    label: "ҚАББҚ ұйымдастыру",
    group: G1,
    type: "tier",
    tiers: tier5("1-5 оқушы", "6-10 оқушы", "11-15 оқушы", "16-20 оқушы", "21-30 оқушы"),
  },
  {
    key: "theatre",
    label: "Театр қатысымы (бастауыш сынып)",
    group: G1,
    type: "tier",
    tiers: [
      { label: "Жоқ", points: 0 },
      { label: "10-50%", points: 2 },
      { label: "60-80%", points: 4 },
      { label: "90-100%", points: 6 },
    ],
  },
  { key: "national_dress", label: "Ұлттық киімнің сақталуы", group: G1, type: "fixed", points: 10 },
  { key: "instagram", label: "Сынып инстапарақшаның жүргізілуі", group: G1, type: "fixed", points: 10 },
  { key: "mothers_club", label: "Аналар клубына мүшелік етуі", group: G1, type: "fixed", points: 10 },
  { key: "fathers_club", label: "Әкелер клубына мүшелік етуі", group: G1, type: "fixed", points: 10 },
  { key: "public_work", label: "Қоғамдық жұмыс", group: G1, type: "fixed", points: 50 },
  {
    key: "school_contests",
    label: "Мектепішілік байқауларға, шараларға қатысым (әр жетістік)",
    group: G1,
    type: "count",
    perUnit: 1,
    maxUnits: 30,
    unitLabel: "жетістік",
  },

  {
    key: "palace",
    label: "Қалалық оқушылар сарайы",
    group: G2,
    type: "tier",
    tiers: [
      { label: "Жоқ", points: 0 },
      { label: "Қатысым", points: 1 },
      { label: "Жүлделі орын", points: 2 },
    ],
  },
  {
    key: "tech_center",
    label: "Қалалық техникалық-шығармашылық орталығы",
    group: G2,
    type: "tier",
    tiers: [
      { label: "Жоқ", points: 0 },
      { label: "Қатысым", points: 1 },
      { label: "Жүлделі орын", points: 2 },
    ],
  },
  {
    key: "youth_center",
    label: "Балалар және жасөспірімдер шығармашылық орталығы",
    group: G2,
    type: "tier",
    tiers: [
      { label: "Жоқ", points: 0 },
      { label: "Қатысым", points: 1 },
      { label: "Жүлделі орын", points: 2 },
    ],
  },
  {
    key: "tourists",
    label: "Қалалық жас туристер стансасы",
    group: G2,
    type: "tier",
    tiers: [
      { label: "Жоқ", points: 0 },
      { label: "Қатысым", points: 1 },
      { label: "Жүлделі орын", points: 2 },
    ],
  },
  {
    key: "naturalists",
    label: "Қалалық жас натуралистер стансасы",
    group: G2,
    type: "tier",
    tiers: [
      { label: "Жоқ", points: 0 },
      { label: "Қатысым", points: 1 },
      { label: "Жүлделі орын", points: 2 },
    ],
  },
  {
    key: "creative_house",
    label: "Балалар шығармашылық үйі",
    group: G2,
    type: "tier",
    tiers: [
      { label: "Жоқ", points: 0 },
      { label: "Қатысым", points: 1 },
      { label: "Жүлделі орын", points: 2 },
    ],
  },
  {
    key: "art_lyceum",
    label: "Қалалық көркемсурет лицейі",
    group: G2,
    type: "tier",
    tiers: [
      { label: "Жоқ", points: 0 },
      { label: "Қатысым", points: 1 },
      { label: "Жүлделі орын", points: 2 },
    ],
  },
  {
    key: "music_school",
    label: "Қазанғап атындағы өнер мектебі",
    group: G2,
    type: "tier",
    tiers: [
      { label: "Жоқ", points: 0 },
      { label: "Қатысым", points: 1 },
      { label: "Жүлделі орын", points: 2 },
    ],
  },
  {
    key: "city_events",
    label: "Қалалық шараларға қатысу",
    group: G2,
    type: "tier",
    tiers: [
      { label: "Жоқ", points: 0 },
      { label: "Қатысым", points: 1 },
      { label: "Жүлделі орын", points: 2 },
    ],
  },
  {
    key: "region_events",
    label: "Облыстық шараларға қатысу",
    group: G2,
    type: "tier",
    tiers: [
      { label: "Жоқ", points: 0 },
      { label: "Қатысым", points: 1 },
      { label: "Жүлделі орын", points: 3 },
    ],
  },
  {
    key: "republic_events",
    label: "Республикалық шараларға қатысу (тікелей)",
    group: G2,
    type: "tier",
    tiers: [
      { label: "Жоқ", points: 0 },
      { label: "Қатысым", points: 1 },
      { label: "Жүлделі орын", points: 4 },
    ],
  },
  {
    key: "republic_events_online",
    label: "Республикалық шараларға қатысу (сырттай)",
    group: G2,
    type: "tier",
    tiers: [
      { label: "Жоқ", points: 0 },
      { label: "Қатысым", points: 1 },
      { label: "Жүлделі орын", points: 2 },
    ],
  },
  {
    key: "intl_events",
    label: "Халықаралық шараларға қатысу (тікелей)",
    group: G2,
    type: "tier",
    tiers: [
      { label: "Жоқ", points: 0 },
      { label: "Қатысым", points: 1 },
      { label: "Жүлделі орын", points: 5 },
    ],
  },
  {
    key: "intl_events_online",
    label: "Халықаралық шараларға қатысу (сырттай)",
    group: G2,
    type: "tier",
    tiers: [
      { label: "Жоқ", points: 0 },
      { label: "Қатысым", points: 1 },
      { label: "Жүлделі орын", points: 2 },
    ],
  },
  {
    key: "publication",
    label: "Баспа беттеріне мақала жариялау",
    group: G2,
    type: "tier",
    tiers: [
      { label: "Жоқ", points: 0 },
      { label: "Қалалық", points: 2 },
      { label: "Облыстық", points: 3 },
      { label: "Республикалық", points: 4 },
      { label: "Халықаралық", points: 5 },
    ],
  },
  {
    key: "prof_contest",
    label: "Сынып жетекшілердің кәсіби байқауға қатысуы",
    group: G2,
    type: "tier",
    tiers: [
      { label: "Жоқ", points: 0 },
      { label: "Қатысым", points: 1 },
      { label: "Қалалық орын", points: 2 },
      { label: "Облыстық орын", points: 3 },
      { label: "Республикалық орын", points: 4 },
    ],
  },
  {
    key: "seminars",
    label: "Семинар, конференцияларға қатысу",
    group: G2,
    type: "tier",
    tiers: [
      { label: "Жоқ", points: 0 },
      { label: "Қатысым", points: 1 },
      { label: "Қалалық орын", points: 2 },
      { label: "Облыстық орын", points: 3 },
      { label: "Республикалық орын", points: 4 },
    ],
  },

  {
    key: "d_rules",
    label: "Ішкі тәртіп ережесін бұзу — түсініктеме",
    group: G3,
    type: "fixed",
    points: -1,
  },
  {
    key: "d_warning",
    label: "Тәртіптік жаза «ескерту»",
    group: G3,
    type: "fixed",
    points: -2,
  },
  { key: "d_reprimand", label: "Тәртіптік жаза «сөгіс»", group: G3, type: "fixed", points: -3 },
  {
    key: "d_strict",
    label: "Тәртіптік жаза «қатаң сөгіс»",
    group: G3,
    type: "fixed",
    points: -5,
  },
  {
    key: "d_registered",
    label: "Есепте тұрған / құқықбұзушылық тіркелген оқушы",
    group: G3,
    type: "fixed",
    points: -10,
  },
];

export type Scores = Record<string, number>;

export function criterionMax(c: Criterion) {
  if (c.type === "tier") return Math.max(...c.tiers.map((t) => t.points));
  if (c.type === "fixed") return c.points;
  return c.perUnit * c.maxUnits;
}

export function criterionPoints(c: Criterion, raw: number | undefined) {
  const v = Number(raw ?? 0);
  if (!v) return 0;
  if (c.type === "tier") return c.tiers[Math.min(v, c.tiers.length - 1)]?.points ?? 0;
  if (c.type === "fixed") return c.points;
  return Math.min(v, c.maxUnits) * c.perUnit;
}

export const POSITIVE_CRITERIA = CRITERIA.filter((c) => c.group !== GROUPS[2]);

export const MAX_TOTAL = POSITIVE_CRITERIA.reduce((s, c) => s + criterionMax(c), 0);

export function totalPoints(scores: Scores) {
  return CRITERIA.reduce((s, c) => s + criterionPoints(c, scores[c.key]), 0);
}

export function groupPoints(group: string, scores: Scores) {
  const list = CRITERIA.filter((c) => c.group === group);
  return {
    points: list.reduce((s, c) => s + criterionPoints(c, scores[c.key]), 0),
    max: list.reduce((s, c) => s + Math.max(0, criterionMax(c)), 0),
  };
}

export function percentOf(points: number, max = MAX_TOTAL) {
  if (max <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((points / max) * 100)));
}

export function levelLabel(percent: number) {
  if (percent >= 85) return "Өте жоғары деңгей";
  if (percent >= 70) return "Жоғары деңгей";
  if (percent >= 55) return "Орташа деңгей";
  if (percent >= 35) return "Қанағаттанарлық";
  return "Назар аудару қажет";
}

export type ClassScoreRow = {
  id: string;
  class_id: string;
  period: string;
  scores: Scores;
  note: string | null;
};
