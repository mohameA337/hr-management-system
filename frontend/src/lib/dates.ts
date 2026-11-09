// Date helpers working on the API's plain strings: 'YYYY-MM-DD', 'YYYY-MM-DD HH:MM:SS', 'YYYY-MM'.
// Everything uses local time, matching the company timezone the backend stores.

const pad = (n: number) => String(n).padStart(2, '0');

export function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function toDateTimeString(date: Date): string {
  return `${toDateKey(date)} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export function parseDateKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function todayKey(): string {
  return toDateKey(new Date());
}

export function addDays(key: string, days: number): string {
  const date = parseDateKey(key);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
}

export function isWeekend(key: string): boolean {
  const day = parseDateKey(key).getDay();
  return day === 0 || day === 6;
}

export function eachDay(start: string, end: string): string[] {
  const days: string[] = [];
  for (let day = start; day <= end; day = addDays(day, 1)) days.push(day);
  return days;
}

/** Monday–Friday and not a public holiday. */
export function isWorkingDay(key: string, holidays: ReadonlySet<string> = new Set()): boolean {
  return !isWeekend(key) && !holidays.has(key);
}

/** Working days in the range, both ends included (LEAVE-4). */
export function workingDaysBetween(start: string, end: string, holidays: ReadonlySet<string> = new Set()): number {
  return eachDay(start, end).filter((day) => isWorkingDay(day, holidays)).length;
}

/** The date `count` working days after `from`, e.g. 3 working days after a Friday is Wednesday. */
export function addWorkingDays(from: string, count: number, holidays: ReadonlySet<string> = new Set()): string {
  let day = from;
  for (let added = 0; added < count; ) {
    day = addDays(day, 1);
    if (isWorkingDay(day, holidays)) added++;
  }
  return day;
}

export function monthKey(year: number, month: number): string {
  return `${year}-${pad(month)}`;
}

export function currentMonthKey(): string {
  return todayKey().slice(0, 7);
}

export function parseMonthKey(key: string): { year: number; month: number } {
  const [year, month] = key.split('-').map(Number);
  return { year, month };
}

export function addMonths(key: string, months: number): string {
  const { year, month } = parseMonthKey(key);
  const date = new Date(year, month - 1 + months, 1);
  return monthKey(date.getFullYear(), date.getMonth() + 1);
}
