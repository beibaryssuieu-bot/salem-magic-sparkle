/**
 * Браузерлік push-хабарландырулар (Web Notifications API) және жиналыс
 * ішіндегі жедел хабарландыруларды тарату (Supabase Realtime broadcast).
 *
 * Ескерту: толық offline push (телефон құлыпталған кезде де келетін) үшін
 * Service Worker + FCM/VAPID инфрақұрылымы қажет болар еді. Мұнда — ашық
 * бет/қойынды үшін нақты жұмыс істейтін хабарландыру: тіркелгеннен кейін
 * дереу расталады, ал әкімші жіберген хабарлама — сол жиналыстың QR бетін
 * ашық ұстаған әрбір қатысушыға Realtime арқылы бірден жетеді.
 */
import { supabase } from "@/integrations/supabase/client";

export function notificationsSupported() {
  return typeof window !== "undefined" && "Notification" in window;
}

export async function requestNotificationPermission(): Promise<NotificationPermission | null> {
  if (!notificationsSupported()) return null;
  if (Notification.permission === "granted" || Notification.permission === "denied") {
    return Notification.permission;
  }
  try {
    return await Notification.requestPermission();
  } catch {
    return null;
  }
}

export function showLocalNotification(title: string, body: string) {
  if (!notificationsSupported() || Notification.permission !== "granted") return;
  try {
    new Notification(title, { body, icon: "/school-logo.jpg" });
  } catch {
    // Кейбір мобильді браузерлерде тікелей `new Notification()` қолдау таппайды —
    // ондайда тек тіркеу растауы (тост) көрсетіледі, қалғаны бетте.
  }
}

export type MeetingBroadcast = { title: string; body: string; sentAt: string };

function meetingChannelName(meetingId: string) {
  return `meeting-notify-${meetingId}`;
}

/** Жиналыс QR бетінде: әкімшінің хабарламаларын тыңдау. */
export function subscribeMeetingBroadcasts(
  meetingId: string,
  onMessage: (payload: MeetingBroadcast) => void,
) {
  const channel = supabase
    .channel(meetingChannelName(meetingId))
    .on("broadcast", { event: "notify" }, ({ payload }) => {
      onMessage(payload as MeetingBroadcast);
    })
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}

/** Әкімшінің панелінде: тіркелген қатысушыларға хабарлама жіберу. */
export async function broadcastMeetingNotification(meetingId: string, title: string, body: string) {
  const channel = supabase.channel(meetingChannelName(meetingId));
  await new Promise<void>((resolve) => {
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") resolve();
    });
  });
  await channel.send({
    type: "broadcast",
    event: "notify",
    payload: { title, body, sentAt: new Date().toISOString() } satisfies MeetingBroadcast,
  });
  await supabase.removeChannel(channel);
}
