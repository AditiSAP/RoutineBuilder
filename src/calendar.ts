import { itemDateRange } from "./schedule";
import type { RoutineItem } from "./types";

const DAY_CODES = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function localCalendarDate(date: Date): string {
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}T${pad(date.getHours())}${pad(date.getMinutes())}00`;
}

function googleUtcDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

export function eventDescription(item: RoutineItem): string {
  return [
    item.notes.trim(),
    ...item.links.map((link) => `${link.label}: ${link.url}`),
    "Created with Dayframe Routine Builder",
  ].filter(Boolean).join("\n\n");
}

export function googleCalendarUrl(item: RoutineItem, date: Date): string {
  const { start, end } = itemDateRange(item, date);
  const fallbackEnd = new Date(start.getTime() + 30 * 60_000);
  const params = {
    action: "TEMPLATE",
    text: `${item.emoji} ${item.title}`,
    dates: `${googleUtcDate(start)}/${googleUtcDate(end ?? fallbackEnd)}`,
    details: eventDescription(item),
    recur: `RRULE:FREQ=WEEKLY;BYDAY=${item.days.map((day) => DAY_CODES[day]).join(",")}`,
  };
  return `https://calendar.google.com/calendar/render?${Object.entries(params).map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join("&")}`;
}

function escapeIcs(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

export function routineToIcs(items: RoutineItem[], date: Date): string {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Dayframe//Routine Builder//EN", "CALSCALE:GREGORIAN"];
  for (const item of items) {
    const { start, end } = itemDateRange(item, date);
    lines.push(
      "BEGIN:VEVENT",
      `UID:${item.id}@dayframe.local`,
      `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")}`,
      `DTSTART:${localCalendarDate(start)}`,
      `DTEND:${localCalendarDate(end ?? new Date(start.getTime() + 30 * 60_000))}`,
      `RRULE:FREQ=WEEKLY;BYDAY=${item.days.map((day) => DAY_CODES[day]).join(",")}`,
      `SUMMARY:${escapeIcs(`${item.emoji} ${item.title}`)}`,
      `DESCRIPTION:${escapeIcs(eventDescription(item))}`,
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return `${lines.join("\r\n")}\r\n`;
}

function unfoldIcs(text: string): string[] {
  return text.replace(/\r?\n[ \t]/g, "").split(/\r?\n/);
}

function unescapeIcs(value: string): string {
  return value.replace(/\\n/gi, "\n").replace(/\\([\\,;])/g, "$1");
}

export function importIcs(text: string, startOrder = 0): RoutineItem[] {
  const blocks = unfoldIcs(text).join("\n").match(/BEGIN:VEVENT\n[\s\S]*?END:VEVENT/g) ?? [];
  return blocks.map((block, index) => {
    const value = (name: string) => {
      const match = block.match(new RegExp(`^${name}(?:;[^:]*)?:(.*)$`, "m"));
      return match?.[1]?.trim() ?? "";
    };
    const startRaw = value("DTSTART");
    if (!/^\d{8}T\d{4}/.test(startRaw)) throw new Error("An imported event has no supported DTSTART.");
    const endRaw = value("DTEND");
    const toTime = (raw: string) => raw ? `${raw.slice(9, 11)}:${raw.slice(11, 13)}` : "";
    const rule = value("RRULE");
    const byDay = /BYDAY=([^;]+)/.exec(rule)?.[1]?.split(",") ?? [];
    const days = byDay.length ? byDay.map((code) => DAY_CODES.indexOf(code)).filter((day) => day >= 0) : [0, 1, 2, 3, 4, 5, 6];
    const summary = unescapeIcs(value("SUMMARY")).replace(/^\p{Extended_Pictographic}\uFE0F?\s*/u, "");
    return {
      id: `imported-${Date.now()}-${index}-${Math.random().toString(36).slice(2)}`,
      title: summary || "Imported event",
      emoji: "📅",
      startTime: toTime(startRaw),
      endTime: toTime(endRaw),
      category: "Imported",
      days,
      reminderMinutes: null,
      notes: unescapeIcs(value("DESCRIPTION")),
      links: [],
      order: startOrder + index,
    };
  });
}
