import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, Clock3, Loader2, MapPin, TriangleAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DEPARTMENTS,
  POSITIONS,
  SCHOOL_CITY,
  SCHOOL_SHORT_NAME,
  formatDateTime,
  formatMeetingDate,
  formatTimeRange,
  type CheckinResponse,
  type MeetingInfo,
} from "@/lib/meeting-constants";
import { loadStoredTeacherProfile, saveStoredTeacherProfile } from "@/lib/meeting-teacher-storage";
import {
  requestNotificationPermission,
  showLocalNotification,
  subscribeMeetingBroadcasts,
} from "@/lib/meeting-notifications";

export const Route = createFileRoute("/qr/$token")({
  head: () => ({
    meta: [
      { title: "Мұғалімдер жиналысы — қатысуды тіркеу" },
      { name: "robots", content: "noindex, nofollow" },
      { name: "viewport", content: "width=device-width, initial-scale=1, maximum-scale=1" },
    ],
  }),
  component: CheckinPage,
});

type Screen = "loading" | "not_found" | "closed" | "duplicate" | "form" | "success";

function SchoolBadge() {
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <img
        src="/school-logo.jpg"
        alt={SCHOOL_SHORT_NAME}
        className="size-16 rounded-full object-cover shadow-md ring-2 ring-white"
      />
      <div>
        <p className="text-sm font-semibold text-foreground">{SCHOOL_SHORT_NAME}</p>
        <p className="text-xs text-muted-foreground">{SCHOOL_CITY}</p>
      </div>
    </div>
  );
}

function MeetingSummary({ meeting }: { meeting: MeetingInfo }) {
  return (
    <div className="mt-4 space-y-1.5 rounded-xl bg-muted/60 p-4 text-sm">
      <p className="font-display font-bold text-foreground">{meeting.title}</p>
      <p className="flex items-center gap-1.5 text-muted-foreground">
        <Clock3 className="size-3.5 shrink-0" />
        {formatMeetingDate(meeting.meeting_date)} ·{" "}
        {formatTimeRange(meeting.start_time, meeting.end_time)}
      </p>
      {meeting.location && (
        <p className="flex items-center gap-1.5 text-muted-foreground">
          <MapPin className="size-3.5 shrink-0" />
          {meeting.location}
        </p>
      )}
    </div>
  );
}

function CheckinPage() {
  const { token } = Route.useParams();

  const [screen, setScreen] = useState<Screen>("loading");
  const [meeting, setMeeting] = useState<MeetingInfo | null>(null);
  const [duplicateAt, setDuplicateAt] = useState<string | null>(null);
  const [registeredAt, setRegisteredAt] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [position, setPosition] = useState("");
  const [department, setDepartment] = useState("");
  const [school, setSchool] = useState("");

  // Бастапқы күй: сақталған профильді толтыру + осы жиналысқа бұрын
  // тіркелгенін жазусыз тексеру.
  useEffect(() => {
    let cancelled = false;
    const stored = loadStoredTeacherProfile();
    if (stored) {
      setFullName(stored.fullName);
      setPosition(stored.position);
      setDepartment(stored.department);
      setSchool(stored.school);
    } else {
      setSchool(SCHOOL_SHORT_NAME);
    }
    (async () => {
      const { data, error } = await supabase.rpc("get_meeting_registration_status", {
        p_qr_token: token,
        p_full_name: stored?.fullName ?? "",
      });
      if (cancelled) return;
      const res = (error ? null : (data as unknown as CheckinResponse)) ?? {
        status: "not_found" as const,
      };
      if (res.status === "not_found") {
        setScreen("not_found");
        return;
      }
      if (res.meeting) setMeeting(res.meeting);
      if (res.status === "closed") {
        setScreen("closed");
      } else if (res.status === "duplicate") {
        setDuplicateAt(res.registered_at ?? null);
        setScreen("duplicate");
      } else {
        setScreen("form");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  // Жиналыс белгілі болғаннан кейін әкімшінің жедел хабарламаларын тыңдау.
  useEffect(() => {
    if (!meeting?.id) return;
    return subscribeMeetingBroadcasts(meeting.id, (payload) => {
      toast.info(payload.title, { description: payload.body });
      showLocalNotification(payload.title, payload.body);
    });
  }, [meeting?.id]);

  const checkinMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("checkin_meeting_attendance", {
        p_qr_token: token,
        p_full_name: fullName.trim(),
        p_position: position,
        p_department: department,
        p_school: school.trim(),
      });
      if (error) throw error;
      return data as unknown as CheckinResponse;
    },
    onSuccess: (res) => {
      if (res.status === "invalid_fields") {
        toast.error("Барлық өрісті толтырыңыз");
        return;
      }
      if (res.status === "not_found") {
        setScreen("not_found");
        return;
      }
      if (res.meeting) setMeeting(res.meeting);
      if (res.status === "closed") {
        setScreen("closed");
        return;
      }

      saveStoredTeacherProfile({
        fullName: fullName.trim(),
        position,
        department,
        school: school.trim(),
      });

      if (res.status === "duplicate") {
        setDuplicateAt(res.registered_at ?? null);
        setScreen("duplicate");
        return;
      }

      setRegisteredAt(res.registered_at ?? new Date().toISOString());
      setScreen("success");
      void requestNotificationPermission().then((perm) => {
        if (perm === "granted") {
          showLocalNotification("🔔 Мұғалімдер жиналысы", "Сіз жиналысқа белгілендіңіз.");
        }
      });
    },
    onError: () => toast.error("Тіркеу сәтсіз аяқталды. Қайта көріңіз."),
  });

  const canSubmit =
    fullName.trim().length > 1 && !!position && !!department && school.trim().length > 1;

  return (
    <div className="flex min-h-screen items-start justify-center bg-gradient-to-b from-secondary/60 to-background px-4 py-8 sm:py-14">
      <div className="w-full max-w-md">
        <SchoolBadge />

        <div className="mt-6 rounded-3xl border border-border bg-card p-6 shadow-panel sm:p-8">
          {screen === "loading" && (
            <div className="flex flex-col items-center gap-3 py-10 text-muted-foreground">
              <Loader2 className="size-6 animate-spin" />
              <p className="text-sm">Жүктелуде…</p>
            </div>
          )}

          {screen === "not_found" && (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <TriangleAlert className="size-10 text-destructive" />
              <p className="font-display text-lg font-bold">QR коды жарамсыз</p>
              <p className="text-sm text-muted-foreground">
                Бұл сілтеме бойынша жиналыс табылмады. Ұйымдастырушыдан жаңа QR кодын сұраңыз.
              </p>
            </div>
          )}

          {screen === "closed" && (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <TriangleAlert className="size-10 text-warning" />
              <p className="text-lg font-bold text-foreground">
                ⚠️ Бұл жиналысқа тіркелу аяқталды.
              </p>
              {meeting && <MeetingSummary meeting={meeting} />}
            </div>
          )}

          {screen === "duplicate" && (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <TriangleAlert className="size-10 text-warning" />
              <p className="text-lg font-bold text-foreground">
                ⚠️ Сіз бұл жиналысқа бұрын тіркелдіңіз.
              </p>
              {duplicateAt && (
                <p className="text-sm text-muted-foreground">
                  Тіркелген уақыты:{" "}
                  <span className="font-medium">{formatDateTime(duplicateAt)}</span>
                </p>
              )}
              {meeting && <MeetingSummary meeting={meeting} />}
            </div>
          )}

          {screen === "success" && meeting && (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <CheckCircle2 className="size-12 text-success" />
              <p className="text-lg font-bold text-foreground">✅ Қатысуыңыз тіркелді!</p>
              <div className="mt-2 w-full space-y-2 rounded-xl bg-muted/60 p-4 text-left text-sm">
                <Row label="Аты-жөні" value={fullName.trim()} />
                <Row label="Жиналыс" value={meeting.title} />
                <Row label="Күні" value={formatMeetingDate(meeting.meeting_date)} />
                <Row label="Уақыты" value={formatTimeRange(meeting.start_time, meeting.end_time)} />
                <Row label="Кафедра" value={department} />
                <Row label="Статус" value="🟢 Қатысты" />
                {registeredAt && (
                  <Row label="Тіркелген уақыт" value={formatDateTime(registeredAt)} />
                )}
              </div>
            </div>
          )}

          {screen === "form" && (
            <>
              <h1 className="text-center font-display text-2xl font-extrabold tracking-tight text-foreground">
                МҰҒАЛІМДЕР ЖИНАЛЫСЫ
              </h1>
              <p className="mt-1 text-center text-sm text-muted-foreground">Қатысуды тіркеу</p>
              {meeting && <MeetingSummary meeting={meeting} />}

              <form
                className="mt-6 space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (canSubmit) checkinMutation.mutate();
                }}
              >
                <div className="space-y-1.5">
                  <Label htmlFor="ci-name">Аты-жөні</Label>
                  <Input
                    id="ci-name"
                    autoComplete="name"
                    placeholder="Мысалы: Айгүл Серікқызы"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="h-12 text-base"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="ci-position">Лауазымы</Label>
                  <Select value={position} onValueChange={setPosition}>
                    <SelectTrigger id="ci-position" className="h-12 text-base">
                      <SelectValue placeholder="Таңдаңыз" />
                    </SelectTrigger>
                    <SelectContent>
                      {POSITIONS.map((p) => (
                        <SelectItem key={p} value={p}>
                          {p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="ci-department">Кафедра</Label>
                  <Select value={department} onValueChange={setDepartment}>
                    <SelectTrigger id="ci-department" className="h-12 text-base">
                      <SelectValue placeholder="Таңдаңыз" />
                    </SelectTrigger>
                    <SelectContent>
                      {DEPARTMENTS.map((d) => (
                        <SelectItem key={d} value={d}>
                          {d}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="ci-school">Мектеп / ұйым</Label>
                  <Input
                    id="ci-school"
                    placeholder={SCHOOL_SHORT_NAME}
                    value={school}
                    onChange={(e) => setSchool(e.target.value)}
                    className="h-12 text-base"
                    required
                  />
                </div>

                <Button
                  type="submit"
                  className="h-14 w-full text-base font-bold tracking-wide"
                  disabled={!canSubmit || checkinMutation.isPending}
                >
                  {checkinMutation.isPending ? (
                    <Loader2 className="size-5 animate-spin" />
                  ) : (
                    "ҚАТЫСУДЫ РАСТАУ"
                  )}
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium text-foreground">{value}</span>
    </div>
  );
}
