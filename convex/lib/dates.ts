const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Today's date as YYYY-MM-DD in UTC. All loan dates are calendar days in UTC. */
export function today(now = Date.now()): string {
  return new Date(now).toISOString().slice(0, 10);
}

export function isValidDate(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export function daysBetween(start: string, end: string): number {
  const ms = Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

/** Two inclusive date ranges overlap. */
export function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart <= bEnd && bStart <= aEnd;
}
