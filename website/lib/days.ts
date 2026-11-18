// Days as the admin panel counts them: calendar days in Argentina (UTC-3 all year, no daylight
// saving), so "today" and every per-day bar match the clock of the person reading it. The daily
// download totals and the per-day download sets are keyed the same way.

export const DAY = 24 * 60 * 60 * 1000;
const OFFSET = -3 * 60 * 60 * 1000;

/** The Argentine calendar day of a moment, as YYYY-MM-DD. */
export function day(t: number): string {
  return new Date(t + OFFSET).toISOString().slice(0, 10);
}

/** The moment an Argentine calendar day (YYYY-MM-DD) begins. */
export function dayStart(d: string): number {
  return Date.parse(`${d}T00:00:00Z`) - OFFSET;
}
