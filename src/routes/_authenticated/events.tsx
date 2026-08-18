import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarDays, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useProfile, useSession } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/events")({
  head: () => ({
    meta: [
      { title: "Іс-шаралар — tarbie+" },
      {
        name: "description",
        content:
          "Мектептің алдағы тәрбие іс-шараларының күнтізбесі: әкімші енгізеді, сынып жетекшілері көреді.",
      },
      { property: "og:title", content: "Іс-шаралар — tarbie+" },
      {
        property: "og:description",
        content: "Алдағы мектеп іс-шараларының тізімі мен сипаттамасы.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: EventsPage,
});

type EventRow = {
  id: string;
  title: string;
  event_date: string;
  description: string | null;
};

function EventsPage() {
  const { user } = useSession();
  const { data: me } = useProfile(user);
  const queryClient = useQueryClient();

  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [description, setDescription] = useState("");

  const eventsQuery = useQuery({
    queryKey: ["events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id, title, event_date, description")
        .order("event_date", { ascending: true });
      if (error) throw error;
      return (data ?? []) as EventRow[];
    },
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!title.trim() || !date) throw new Error("empty");
      const { error } = await supabase.from("events").insert({
        title: title.trim(),
        event_date: date,
        description: description.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Іс-шара қосылды");
      setTitle("");
      setDate("");
      setDescription("");
      queryClient.invalidateQueries({ queryKey: ["events"] });
    },
    onError: () => toast.error("Қосу мүмкін болмады"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("events").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Жойылды");
      queryClient.invalidateQueries({ queryKey: ["events"] });
    },
    onError: () => toast.error("Жою мүмкін болмады"),
  });

  const today = new Date().toISOString().slice(0, 10);
  const rows = eventsQuery.data ?? [];
  const upcoming = rows.filter((e) => e.event_date >= today);
  const past = rows.filter((e) => e.event_date < today).reverse();

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <h1 className="font-display text-2xl font-bold md:text-3xl">Іс-шаралар</h1>
      <p className="mt-2 text-sm text-muted-foreground">Алдағы мектеп іс-шараларының күнтізбесі.</p>

      <div className="mt-8 grid gap-6 lg:grid-cols-[2fr_1fr]">
        <section className="space-y-6">
          <div className="rounded-2xl border border-border bg-card p-6">
            <h2 className="font-display font-bold">Алдағы іс-шаралар</h2>
            {upcoming.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">Жоспарланған іс-шара жоқ.</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {upcoming.map((e) => (
                  <li
                    key={e.id}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 rounded-xl border border-border/60 p-4 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 font-semibold">
                        <CalendarDays className="size-4 shrink-0 text-primary" />
                        {e.title}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {new Date(e.event_date).toLocaleDateString("kk-KZ")}
                      </p>
                      {e.description && (
                        <p className="mt-2 text-muted-foreground">{e.description}</p>
                      )}
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button asChild variant="outline" size="sm">
                        <Link to="/events/$eventId" params={{ eventId: e.id }}>
                          Ашу
                        </Link>
                      </Button>
                      {me?.isAdmin && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteMutation.mutate(e.id)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {past.length > 0 && (
            <div className="rounded-2xl border border-border bg-card p-6">
              <h2 className="font-display font-bold">Өткен іс-шаралар</h2>
              <ul className="mt-4 space-y-2 text-sm">
                {past.map((e) => (
                  <li key={e.id} className="flex items-center justify-between gap-4">
                    <span className="min-w-0 truncate text-muted-foreground">{e.title}</span>
                    <span className="flex shrink-0 items-center gap-3">
                      <span className="text-muted-foreground">
                        {new Date(e.event_date).toLocaleDateString("kk-KZ")}
                      </span>
                      <Link
                        to="/events/$eventId"
                        params={{ eventId: e.id }}
                        className="font-medium text-primary hover:underline"
                      >
                        Ашу
                      </Link>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {me?.isAdmin && (
          <aside className="rounded-2xl border border-border bg-card p-6 lg:sticky lg:top-6 lg:self-start">
            <h2 className="font-display font-bold">Жаңа іс-шара</h2>
            <div className="mt-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="ev-title">Атауы</Label>
                <Input
                  id="ev-title"
                  value={title}
                  maxLength={120}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ev-date">Күні</Label>
                <Input
                  id="ev-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ev-desc">Сипаттама</Label>
                <Textarea
                  id="ev-desc"
                  value={description}
                  maxLength={500}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <Button
                className="w-full"
                onClick={() => addMutation.mutate()}
                disabled={!title.trim() || !date || addMutation.isPending}
              >
                <Plus className="size-4" /> Қосу
              </Button>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
