export const CATEGORIES = [
  { id: "power", label: "Power tools" },
  { id: "hand", label: "Hand tools" },
  { id: "garden", label: "Garden" },
  { id: "ladders", label: "Ladders" },
  { id: "cleaning", label: "Cleaning" },
  { id: "other", label: "Other" },
] as const;

export type Category = (typeof CATEGORIES)[number]["id"];

export function categoryLabel(id: Category): string {
  return CATEGORIES.find((c) => c.id === id)?.label ?? "Other";
}

export function toolRef(ref: number): string {
  return `LL-${String(ref).padStart(3, "0")}`;
}

const dayFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

/** "2026-11-14" -> "14 Nov" */
export function formatDay(date: string): string {
  return dayFmt.format(new Date(`${date}T00:00:00Z`));
}

export function formatRange(start: string, end: string): string {
  return start === end ? formatDay(start) : `${formatDay(start)} to ${formatDay(end)}`;
}

export function dayCount(start: string, end: string): number {
  return Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000) + 1;
}

export function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

/** 1731234567890 -> "2 days ago" */
export function timeAgo(ms: number, now = Date.now()): string {
  const seconds = Math.round((ms - now) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 60) return "just now";
  if (abs < 3600) return rtf.format(Math.round(seconds / 60), "minute");
  if (abs < 86_400) return rtf.format(Math.round(seconds / 3600), "hour");
  return rtf.format(Math.round(seconds / 86_400), "day");
}

/** Turn a Convex error into a sentence for the person. */
export function errorMessage(error: unknown): string {
  if (error && typeof error === "object" && "data" in error && typeof error.data === "string") {
    return error.data;
  }
  return "Something went wrong. Check your connection and try again.";
}
