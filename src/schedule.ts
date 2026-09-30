import type { RoutineItem } from "./types";

export function parseTime(value: string): number {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!match) throw new Error(`Invalid time: ${value}`);
  return Number(match[1]) * 60 + Number(match[2]);
}

export function formatTime(value: string): string {
  const minutes = parseTime(value);
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${hour % 12 || 12}:${minute.toString().padStart(2, "0")} ${hour < 12 ? "AM" : "PM"}`;
}

export function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseDateKey(key: string): Date {
  const [year, month, day] = key.split("-").map(Number);
  if (year === undefined || month === undefined || day === undefined) {
    throw new Error(`Invalid date key: ${key}`);
  }
  return new Date(year, month - 1, day);
}

export function addDays(date: Date, amount: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

export function occursOn(item: RoutineItem, date: Date): boolean {
  return item.days.includes(date.getDay());
}

export function itemsForDate(items: RoutineItem[], date: Date): RoutineItem[] {
  return items
    .filter((item) => occursOn(item, date))
    .sort((a, b) => parseTime(a.startTime) - parseTime(b.startTime) || a.order - b.order);
}

export function itemDateRange(item: RoutineItem, date: Date): { start: Date; end?: Date } {
  const start = new Date(date);
  const startMinutes = parseTime(item.startTime);
  start.setHours(Math.floor(startMinutes / 60), startMinutes % 60, 0, 0);
  if (!item.endTime) return { start };
  const end = new Date(date);
  const endMinutes = parseTime(item.endTime);
  end.setHours(Math.floor(endMinutes / 60), endMinutes % 60, 0, 0);
  if (endMinutes <= startMinutes) end.setDate(end.getDate() + 1);
  return { start, end };
}

export function displayDuration(item: RoutineItem): string {
  if (!item.endTime) return "At this time";
  let duration = parseTime(item.endTime) - parseTime(item.startTime);
  if (duration <= 0) duration += 24 * 60;
  if (duration < 60) return `${duration} min`;
  const hours = Math.floor(duration / 60);
  const minutes = duration % 60;
  return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
}
