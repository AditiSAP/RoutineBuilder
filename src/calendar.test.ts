import { describe, expect, it } from "vitest";
import { eventDescription, googleCalendarUrl, importIcs, routineToIcs } from "./calendar";
import type { RoutineItem } from "./types";

const workout: RoutineItem = {
  id: "workout", title: "Workout", emoji: "🏃", startTime: "22:00", endTime: "06:00",
  category: "Fitness", days: [1, 3, 5], reminderMinutes: 10, notes: "Intervals",
  links: [{ id: "link", label: "Video", url: "https://example.com/workout" }], order: 0,
};

describe("calendar mapping", () => {
  it("includes notes, links, recurrence, and an overnight end in ICS", () => {
    const ics = routineToIcs([workout], new Date(2026, 8, 28));
    expect(ics).toContain("RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR");
    expect(ics).toContain("DTSTART:20260928T220000");
    expect(ics).toContain("DTEND:20260929T060000");
    expect(ics).toContain("Video: https://example.com/workout");
  });

  it("creates a standards-based Google Calendar template URL", () => {
    const url = new URL(googleCalendarUrl(workout, new Date(2026, 8, 28)));
    expect(url.hostname).toBe("calendar.google.com");
    expect(url.searchParams.get("recur")).toBe("RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR");
    expect(url.searchParams.get("details")).toBe(eventDescription(workout));
  });

  it("imports exported events", () => {
    const imported = importIcs(routineToIcs([workout], new Date(2026, 8, 28)));
    expect(imported).toHaveLength(1);
    expect(imported[0]).toMatchObject({ title: "Workout", startTime: "22:00", endTime: "06:00", days: [1, 3, 5] });
  });
});
