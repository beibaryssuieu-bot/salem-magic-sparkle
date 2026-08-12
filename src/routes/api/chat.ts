import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

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
        const { messages } = (await request.json()) as { messages?: unknown };
        if (!Array.isArray(messages)) {
          return new Response("Messages are required", { status: 400 });
        }

        const key = process.env["LOVABLE_API_KEY"];
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const gateway = createLovableAiGatewayProvider(key);

        const result = streamText({
          model: gateway("google/gemini-3.6-flash"),
          system: SYSTEM_PROMPT,
          messages: await convertToModelMessages(messages as UIMessage[]),
        });

        return result.toUIMessageStreamResponse({
          originalMessages: messages as UIMessage[],
        });
      },
    },
  },
});
