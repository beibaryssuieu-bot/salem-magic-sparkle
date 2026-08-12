import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

/**
 * Google Gemini API-ін оның OpenAI-үйлесімді ұшымен (endpoint) тікелей
 * шақыратын провайдер (BYOK — жеке API кілт, Lovable AI Gateway-ге тәуелсіз).
 *
 * Кілтті https://aistudio.google.com/apikey арқылы тегін алып, Lovable
 * жобасының Environment Variables бөліміне GOOGLE_GENERATIVE_AI_API_KEY
 * атымен қосыңыз.
 */
export function createGoogleAiProvider(apiKey: string) {
  return createOpenAICompatible({
    name: "google",
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });
}
