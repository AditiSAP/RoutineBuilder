import { describe, expect, it } from "vitest";
import { notificationPlans } from "./notification-plans";
import type { RoutineItem } from "./types";

const routine: RoutineItem = {
  id: "workout", title: "Workout", emoji: "🏃", startTime: "09:00", endTime: "10:00",
  category: "Fitness", days: [1], reminderMinutes: 15, notes: "", links: [], order: 0,
};

describe("notification mapping", () => {
  it("schedules applicable recurrence at the configured lead time", () => {
    const monday = new Date(2026, 8, 28, 8, 0);
    const plans = notificationPlans([routine], monday, 2);
    expect(plans).toHaveLength(1);
    expect(plans[0]?.date.getHours()).toBe(8);
    expect(plans[0]?.date.getMinutes()).toBe(45);
    expect(plans[0]?.itemId).toBe("workout");
  });

  it("does not schedule disabled, past, or non-applicable reminders", () => {
    const mondayAfterStart = new Date(2026, 8, 28, 10, 0);
    expect(notificationPlans([routine, { ...routine, id: "off", reminderMinutes: null }], mondayAfterStart, 1)).toEqual([]);
  });
});
