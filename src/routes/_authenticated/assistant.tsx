import { useCallback, useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";

export const Route = createFileRoute("/_authenticated/assistant")({
  head: () => ({
    meta: [
      { title: "ЖИ көмекші — TÄRBIE OS" },
      {
        name: "description",
        content:
          "Тәрбие жұмысы және TÄRBIE OS жүйесі бойынша сұрақтарға қазақ және орыс тілінде жауап беретін ЖИ көмекші.",
      },
      { property: "og:title", content: "ЖИ көмекші — TÄRBIE OS" },
      {
        property: "og:description",
        content: "Сынып жетекшілерге арналған ЖИ көмекші чаты.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AssistantPage,
});

const SUGGESTIONS = [
  "Сынып сағатына тақырып ұсын",
  "Ата-аналар жиналысын қалай өткіземін?",
  "Қатысымды қалай енгіземін?",
  "Как загрузить отчёт в разделе Есептер?",
];

function toUIMessage(row: { id: string; role: string; content: string }): UIMessage {
  return {
    id: row.id,
    role: row.role === "user" ? "user" : "assistant",
    parts: [{ type: "text", text: row.content }],
  };
}

function textOf(message: UIMessage) {
  return message.parts
    .map((p) => (p.type === "text" ? p.text : ""))
    .join("")
    .trim();
}

function AssistantPage() {
  const { user } = useSession();
  const [initial, setInitial] = useState<UIMessage[] | null>(null);
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const savedIds = useRef(new Set<string>());

  useEffect(() => {
    if (!user) return;
    let active = true;
    supabase
      .from("assistant_messages")
      .select("id, role, content")
      .order("created_at", { ascending: true })
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          toast.error("Тарихты жүктеу мүмкін болмады");
          setInitial([]);
          return;
        }
        const rows = data ?? [];
        for (const r of rows) savedIds.current.add(r.id);
        setInitial(rows.map(toUIMessage));
      });
    return () => {
      active = false;
    };
  }, [user]);

  if (!user || initial === null) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-10 text-sm text-muted-foreground">
        Жүктелуде…
      </div>
    );
  }

  return (
    <Chat
      key={user.id}
      userId={user.id}
      initialMessages={initial}
      input={input}
      setInput={setInput}
      textareaRef={textareaRef}
      savedIds={savedIds.current}
    />
  );
}

function Chat({
  userId,
  initialMessages,
  input,
  setInput,
  textareaRef,
  savedIds,
}: {
  userId: string;
  initialMessages: UIMessage[];
  input: string;
  setInput: (v: string) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  savedIds: Set<string>;
}) {
  const [transport] = useState(() => new DefaultChatTransport({ api: "/api/chat" }));
  const { messages, sendMessage, status, setMessages } = useChat({
    id: `assistant-${userId}`,
    messages: initialMessages,
    transport,
    onError: () => toast.error("Жауап алу мүмкін болмады. Кейінірек қайталап көріңіз."),
  });

  const persist = useCallback(
    async (message: UIMessage) => {
      const content = textOf(message);
      if (!content || savedIds.has(message.id)) return;
      savedIds.add(message.id);
      const { error } = await supabase
        .from("assistant_messages")
        .insert({ user_id: userId, role: message.role, content });
      if (error) {
        savedIds.delete(message.id);
        toast.error("Хабарламаны сақтау мүмкін болмады");
      }
    },
    [savedIds, userId],
  );

  useEffect(() => {
    if (status !== "ready") return;
    for (const m of messages) {
      if (m.role === "user" || m.role === "assistant") void persist(m);
    }
  }, [messages, status, persist]);

  useEffect(() => {
    textareaRef.current?.focus();
  }, [status, textareaRef]);

  const busy = status === "submitted" || status === "streaming";

  async function submit(text: string) {
    const value = text.trim();
    if (!value || busy) return;
    setInput("");
    await sendMessage({ text: value });
  }

  async function clearHistory() {
    const { error } = await supabase.from("assistant_messages").delete().eq("user_id", userId);
    if (error) {
      toast.error("Тарихты тазалау мүмкін болмады");
      return;
    }
    savedIds.clear();
    setMessages([]);
    toast.success("Тарих тазаланды");
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-3.5rem)] w-full max-w-3xl flex-col px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold md:text-3xl">ЖИ көмекші</h1>
          <p className="text-sm text-muted-foreground">
            Тәрбие жұмысы және жүйе бойынша сұрақтарыңызға қазақша не орысша жауап береді.
          </p>
        </div>
        {messages.length > 0 && (
          <Button variant="ghost" size="sm" onClick={clearHistory}>
            <Trash2 className="mr-2 size-4" /> Тарихты тазалау
          </Button>
        )}
      </div>

      <Conversation className="mt-5 flex-1 rounded-2xl border border-border bg-card">
        <ConversationContent>
          {messages.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-sm text-muted-foreground">
                Сұрағыңызды жазыңыз немесе дайын нұсқаны таңдаңыз:
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((s) => (
                  <Button key={s} variant="outline" size="sm" onClick={() => submit(s)}>
                    {s}
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m) => (
              <Message from={m.role} key={m.id}>
                <MessageContent>
                  {m.parts.map((part, i) =>
                    part.type === "text" ? (
                      <MessageResponse key={i}>{part.text}</MessageResponse>
                    ) : null,
                  )}
                </MessageContent>
              </Message>
            ))
          )}
          {status === "submitted" && (
            <Shimmer className="px-2 text-sm">Ойланып жатыр...</Shimmer>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <PromptInput
        className="mt-4"
        onSubmit={(_message, event) => {
          event.preventDefault();
          void submit(input);
        }}
      >
        <PromptInputTextarea
          ref={textareaRef}
          value={input}
          autoFocus
          placeholder="Сұрағыңызды жазыңыз…"
          onChange={(e) => setInput(e.target.value)}
        />
        <PromptInputFooter className="justify-end">
          <PromptInputSubmit status={status} disabled={!input.trim() || busy} />
        </PromptInputFooter>
      </PromptInput>
    </div>
  );
}
