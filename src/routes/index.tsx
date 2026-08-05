import { createFileRoute, Link } from "@tanstack/react-router";
import {
  BarChart3,
  Bot,
  CalendarCheck,
  Compass,
  Database,
  FileBarChart,
  LineChart,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TÄRBIE OS — мектептің тәрбие жұмысын басқару жүйесі" },
      {
        name: "description",
        content:
          "TÄRBIE OS — мектептің тәрбиелік көрсеткіштерін жинайтын, талдайтын және сынып жетекшілеріне жеке шкала беретін цифрлық басқару жүйесі.",
      },
      { property: "og:title", content: "TÄRBIE OS — мектептің тәрбие жұмысын басқару жүйесі" },
      {
        property: "og:description",
        content:
          "TÄRBIE OS — мектептің тәрбиелік көрсеткіштерін жинайтын, талдайтын және сынып жетекшілеріне жеке шкала беретін цифрлық басқару жүйесі.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const modules = [
  {
    icon: Database,
    title: "AI SCAN",
    subtitle: "Деректерді жинау",
    text: "Қатысу, үйірме, кітапхана, психолог қорытындысы және ата-ана сауалнамасы бір жерде.",
  },
  {
    icon: BarChart3,
    title: "AI ANALYTICS",
    subtitle: "Талдау және көрсеткіштер",
    text: "Деректер талданып, әр сыныптың тәрбиелік профилі қалыптасады.",
  },
  {
    icon: Compass,
    title: "AI NAVIGATOR",
    subtitle: "Ұсыныстар жүйесі",
    text: "Әлсіз бағыттарды анықтап, келесі айға нақты іс-шаралар ұсынады.",
  },
  {
    icon: CalendarCheck,
    title: "AI PLANNER",
    subtitle: "Жоспарлау",
    text: "Айлық тәрбие жоспары, тәрбие сағаттары және ата-аналар жиналысы.",
  },
  {
    icon: Bot,
    title: "AI COPILOT",
    subtitle: "Көмекші ассистент",
    text: "Сценарий, презентация, хабарлама мәтіндерін дайындауға көмектеседі.",
  },
  {
    icon: FileBarChart,
    title: "AI REPORTER",
    subtitle: "Автоматты есеп",
    text: "Ай соңында аналитикалық есеп, диаграмма және рейтинг дайын болады.",
  },
];

const flow = [
  "Деректер жиналады",
  "Сынып профилі құрылады",
  "Ұсыныс беріледі",
  "Жоспар жасалады",
  "Іс-шара орындалады",
  "Есеп дайындалады",
  "Жаңа цикл басталады",
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main>
        <section className="hero-mesh text-surface-foreground">
          <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-20 md:grid-cols-[1.1fr_0.9fr] md:items-center md:py-28">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/15 px-3 py-1 text-xs font-medium uppercase tracking-wide">
                <Sparkles className="size-3.5" /> Мектептің тәрбие операциялық жүйесі
              </span>
              <h1 className="mt-5 font-display text-4xl font-bold leading-tight md:text-6xl">
                TÄRBIE OS
              </h1>
              <p className="mt-4 max-w-xl text-lg opacity-90">
                Мектептің тәрбиелік басқаруына арналған жасанды интеллект жүйесі. Әр сынып
                жетекшісі жүйеге кіріп, өз сыныбының шкаласын нақты уақытта бақылайды.
              </p>
              <blockquote className="mt-6 border-l-2 border-primary/60 pl-4 font-display text-base italic opacity-90">
                «Тәрбие деректермен басқарылады, AI бағыт береді, мұғалім шешім қабылдайды.»
              </blockquote>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild size="lg">
                  <Link to="/auth">Жүйеге кіру</Link>
                </Button>
                <Button asChild size="lg" variant="secondary">
                  <Link to="/dashboard">Менің сыныбымның шкаласы</Link>
                </Button>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
              <h2 className="font-display text-sm uppercase tracking-widest opacity-70">
                Жобаның мақсаты
              </h2>
              <ul className="mt-4 space-y-3 text-sm">
                {[
                  "Деректерге негізделген басқару",
                  "Әр сыныпқа жеке тәрбие маршруты",
                  "Мұғалімнің уақытын үнемдеу",
                  "Нәтижеге бағытталған тәрбие",
                  "Біртұтас цифрлық экожүйе құру",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
                    <span className="opacity-90">{item}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-6 flex items-center gap-2 border-t border-white/10 pt-4 text-xs opacity-75">
                <Users className="size-4" /> Директор орынбасары · Сынып жетекшісі · Педагог-психолог
                · Ата-аналар
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-7xl px-4 py-16">
          <h2 className="text-center font-display text-2xl font-bold md:text-3xl">
            TÄRBIE OS — AI модульдері
          </h2>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {modules.map((m, i) => (
              <article
                key={m.title}
                className="rounded-2xl border border-border bg-card p-6 shadow-card transition-transform hover:-translate-y-1"
              >
                <div className="flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-secondary text-secondary-foreground">
                    <m.icon className="size-5" />
                  </span>
                  <span className="font-display text-xs text-muted-foreground">0{i + 1}</span>
                </div>
                <h3 className="mt-4 font-display text-lg font-bold">{m.title}</h3>
                <p className="text-sm font-medium text-primary">{m.subtitle}</p>
                <p className="mt-2 text-sm text-muted-foreground">{m.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="border-y border-border bg-secondary/40">
          <div className="mx-auto w-full max-w-7xl px-4 py-16">
            <h2 className="text-center font-display text-2xl font-bold md:text-3xl">
              Жүйе қалай жұмыс істейді?
            </h2>
            <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {flow.map((step, i) => (
                <li
                  key={step}
                  className="rounded-xl border border-border bg-card px-4 py-5 text-sm shadow-card"
                >
                  <span className="font-display text-xs text-primary">Қадам {i + 1}</span>
                  <p className="mt-1 font-medium">{step}</p>
                </li>
              ))}
            </ol>
            <p className="mt-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <LineChart className="size-4" /> Үздіксіз жақсарту циклі
            </p>
          </div>
        </section>

        <section className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-16 md:grid-cols-3">
          {[
            {
              title: "Жобаның нәтижелері",
              items: [
                "Тәрбие жұмысы деректерге негізделеді",
                "Әр сыныпқа жеке көзқарас",
                "Қағаз есеп азаяды",
                "Ата-анамен байланыс күшейеді",
              ],
            },
            {
              title: "Мектеп үшін пайдасы",
              items: [
                "Стратегиялық басқару жеңілдейді",
                "Нақты деректерге сүйеніп шешім",
                "Тәуекел алдын ала анықталады",
                "Тәрбие жұмысының тиімділігі артады",
              ],
            },
            {
              title: "Оқушы үшін пайдасы",
              items: [
                "Өз даму траекториясын көреді",
                "Мотивациясы артады",
                "Тұлғалық қасиеттері дамиды",
                "Жетістіктерін бақылайды",
              ],
            },
          ].map((block) => (
            <div key={block.title} className="rounded-2xl border border-border bg-card p-6">
              <h3 className="font-display text-lg font-bold text-primary">{block.title}</h3>
              <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                {block.items.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      </main>

      <footer className="panel-dark">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-2 px-4 py-10">
          <p className="font-display text-xl font-bold">TÄRBIE OS</p>
          <p className="text-sm opacity-80">
            Мектептің тәрбиелік басқаруын жаңа деңгейге шығаратын AI операциялық жүйесі.
          </p>
        </div>
      </footer>
    </div>
  );
}
