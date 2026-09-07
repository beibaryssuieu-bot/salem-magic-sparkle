/** Мұғалімдер жиналысына QR арқылы тіркелу модулінің ортақ тұрақтылары. */

export const SCHOOL_NAME = '"№82 жалпы білім беретін орта мектебі" КММ';
export const SCHOOL_CITY = "Ақтөбе қаласы";
export const SCHOOL_SHORT_NAME = "№82 ЖББОМ";

export const POSITIONS = [
  "Мұғалім",
  "Директор",
  "Директордың орынбасары",
  "Әдіскер",
  "Педагог-психолог",
  "Тәрбиеші",
  "Кітапханашы",
  "Басқа",
] as const;

export const DEPARTMENTS = [
  "Информатика және физика",
  "Тарих және жаратылыстану",
  "Музыка және көркем еңбек",
  "Математика",
  "Қазақ тілі мен әдебиеті",
  "Орыс тілі мен әдебиеті",
  "Шет тілдері",
  "Бастауыш сыныптар",
  "Дене шынықтыру",
  "Басқа",
] as const;

export type Position = (typeof POSITIONS)[number];
export type Department = (typeof DEPARTMENTS)[number];

export type MeetingStatus = "ok" | "duplicate" | "closed" | "not_found" | "invalid_fields" | "open";

export type MeetingInfo = {
  id: string;
  title: string;
  meeting_date: string;
  start_time: string;
  end_time: string;
  location: string | null;
  expected_count: number;
  registration_open: boolean;
  qr_token: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type CheckinResponse = {
  status: MeetingStatus;
  registered_at?: string;
  meeting?: MeetingInfo;
  teacher_id?: string;
};

export function formatMeetingDate(dateStr: string) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("kk-KZ", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function formatTimeRange(start: string, end: string) {
  return `${start.slice(0, 5)} – ${end.slice(0, 5)}`;
}

export function formatDateTime(isoString: string) {
  return new Date(isoString).toLocaleString("kk-KZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
