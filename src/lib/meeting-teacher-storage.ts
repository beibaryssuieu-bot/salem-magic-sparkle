/**
 * Мұғалімнің профилін (аты-жөні, лауазымы, кафедрасы, мектебі) осы құрылғыда
 * сақтау — келесі жиналыстарда форманы автоматты толтыру үшін. Сервермен
 * байланысы жоқ, тек ыңғайлылық үшін.
 */

const STORAGE_KEY = "qr-meeting-teacher-profile-v1";

export type StoredTeacherProfile = {
  fullName: string;
  position: string;
  department: string;
  school: string;
};

export function loadStoredTeacherProfile(): StoredTeacherProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredTeacherProfile>;
    if (!parsed || typeof parsed.fullName !== "string") return null;
    return {
      fullName: parsed.fullName ?? "",
      position: parsed.position ?? "",
      department: parsed.department ?? "",
      school: parsed.school ?? "",
    };
  } catch {
    return null;
  }
}

export function saveStoredTeacherProfile(profile: StoredTeacherProfile) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // localStorage қолжетімсіз болса (жеке шолу режимі т.б.) — үнсіз өтеміз.
  }
}
