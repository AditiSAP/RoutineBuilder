import { describe, expect, it } from "vitest";
import { displayDuration, formatDateKey, formatTime, itemDateRange, itemsForDate, parseTime } from "./schedule";
import type { RoutineItem } from "./types";

const item = (overrides: Partial<RoutineItem> = {}): RoutineItem => ({
  id: "1", title: "Test", emoji: "🧪", startTime: "09:00", endTime: "10:00",
  category: "Test", days: [1], reminderMinutes: null, notes: "", links: [], order: 0, ...overrides,
});

describe("schedule helpers", () => {
  it("parses and formats valid times", () => {
    expect(parseTime("00:05")).toBe(5);
    expect(formatTime("13:05")).toBe("1:05 PM");
    expect(() => parseTime("24:00")).toThrow();
  });

  it("maps overnight items to the following day", () => {
    const date = new Date(2026, 8, 28);
    const range = itemDateRange(item({ startTime: "22:00", endTime: "06:00" }), date);
    expect(formatDateKey(range.end!)).toBe("2026-09-29");
    expect(displayDuration(item({ startTime: "22:00", endTime: "06:00" }))).toBe("8h");
  });

  it("filters recurrence using the selected local calendar day", () => {
    const monday = new Date(2026, 8, 28);
    expect(itemsForDate([item(), item({ id: "2", days: [2] })], monday).map((value) => value.id)).toEqual(["1"]);
  });
});
