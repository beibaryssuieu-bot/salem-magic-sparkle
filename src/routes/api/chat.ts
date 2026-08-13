import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createGoogleAiProvider } from "@/lib/ai-gateway.server";

const SYSTEM_PROMPT = `Сен — «tarbie+» мектеп тәрбие жұмысын басқару жүйесінің ЖИ көмекшісісің.
Мектеп: №82 мектеп. Жүйеде мына бөлімдер бар:
- Басты бет (Жеке мониторинг және Сынып мониторингі),
- Рейтинг («Үздік сынып жетекші» және «Үздік сынып»),
- Есептер (сынып жетекшілер құжат, презентация, фото жүктейді),
- EduQor (ортақ құжаттар кітапханасы),
- Іс-шаралар (әкімші енгізетін күнтізбе),
- Қатысым (күндік, апталық, айлық мониторинг, Excel-ге жүктеу),
- Парольді өзгерту.
Рөлдер: әкімші (барлық сыныптарды көреді) және сынып жетекші (тек өз сыныбының деректерін өзгертеді).

Міндетің: жүйені пайдалану және тәрбие жұмысы (сынып сағаттары, ата-анамен жұмыс, тәртіп, психология,
оқушы белсенділігі, есеп жазу) бойынша нақты әрі қысқа кеңес беру.
Пайдаланушы қай тілде жазса — сол тілде жауап бер (қазақша немесе орысша).
Оқушылардың жеке деректерін сұрама және ойдан шығарма. Нақты сандық деректерді жүйенің тиісті бөлімінен қарауды ұсын.`;

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { messages } = (await request.json()) as { messages?: unknown };
          if (!Array.isArray(messages)) {
            return new Response("Messages are required", { status: 400 });
          }

          const key = process.env["GOOGLE_GENERATIVE_AI_API_KEY"];
          if (!key) return new Response("Missing GOOGLE_GENERATIVE_AI_API_KEY", { status: 500 });

          const google = createGoogleAiProvider(key);

          const result = streamText({
            model: google("gemini-2.5-flash"),
            system: SYSTEM_PROMPT,
            messages: await convertToModelMessages(messages as UIMessage[]),
          });

          return result.toUIMessageStreamResponse({
            originalMessages: messages as UIMessage[],
            // AI SDK-дың әдепкі "An error occurred." хабарын нақты себеппен
            // ауыстырамыз — сынап-тексеру үшін (сезімтал дерек ағызбайды,
            // тек провайдер қатесінің мәтіні).
            onError: (error) => {
              console.error("[api/chat] stream error", error);
              const responseBody =
                error && typeof error === "object" && "responseBody" in error
                  ? String((error as { responseBody?: unknown }).responseBody ?? "")
                  : "";
              const base = error instanceof Error ? error.message : String(error);
              return responseBody ? `${base}: ${responseBody}` : base;
            },
          });
        } catch (error) {
          console.error("[api/chat]", error);
          const message = error instanceof Error ? error.message : "Unknown error";
          return new Response(message, { status: 500 });
        }
      },
    },
  },
});
