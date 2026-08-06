import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Сынып атауын сан мен литерге бөлу: «5А» → { grade: 5, liter: «А» } */
function parseClassName(name: string) {
  const match = name.match(/^(\d+)\s*([A-Za-zА-Яа-яӘәІіҢңҒғҮүҰұҚқӨөҺһ]+)?/u);
  return {
    grade: match ? Number(match[1]) : 0,
    liter: (match?.[2] ?? "").toUpperCase(),
  };
}

/** Сыныптарды алдымен сан бойынша, содан кейін литер бойынша сорттау */
export function sortClassesByLiter<T extends { name: string }>(classes: T[]): T[] {
  return [...classes].sort((a, b) => {
    const pa = parseClassName(a.name);
    const pb = parseClassName(b.name);
    if (pa.grade !== pb.grade) return pa.grade - pb.grade;
    return pa.liter.localeCompare(pb.liter, "kk");
  });
}
