export type FreshnessLevel = "fresh" | "warm" | "stale";

/** Días de calendario locales, para que «hoy» cambie al llegar la medianoche. */
export function daysSince(lastPracticedAt: number | null, now = Date.now()): {
  text: string;
  level: FreshnessLevel;
} {
  if (lastPracticedAt === null || !Number.isFinite(lastPracticedAt)) {
    return { text: "sin practicar", level: "stale" };
  }
  const date = new Date(lastPracticedAt);
  const today = new Date(now);
  const calendarDay = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  const days = Math.max(0, Math.floor((calendarDay(today) - calendarDay(date)) / 86_400_000));
  return {
    text: days === 0 ? "hoy" : days === 1 ? "hace 1 día" : `hace ${days} días`,
    level: days <= 3 ? "fresh" : days <= 10 ? "warm" : "stale",
  };
}
