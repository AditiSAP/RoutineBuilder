import { addDays, formatDateKey, itemDateRange } from "./schedule";
import type { RoutineItem } from "./types";

export type NotificationPlan = {
  itemId: string;
  title: string;
  body: string;
  date: Date;
};

export function notificationPlans(items: RoutineItem[], from: Date, daysAhead = 14): NotificationPlan[] {
  const plans: NotificationPlan[] = [];
  for (let offset = 0; offset < daysAhead; offset += 1) {
    const date = addDays(from, offset);
    for (const item of items) {
      if (item.reminderMinutes === null || !item.days.includes(date.getDay())) continue;
      const trigger = new Date(itemDateRange(item, date).start.getTime() - item.reminderMinutes * 60_000);
      if (trigger.getTime() <= from.getTime()) continue;
      plans.push({
        itemId: item.id,
        title: `${item.emoji} ${item.title}`,
        body: item.reminderMinutes === 0 ? "Starts now" : `Starts in ${item.reminderMinutes} minutes`,
        date: trigger,
      });
    }
  }
  return plans;
}

export function notificationSummary(item: RoutineItem): string {
  if (item.reminderMinutes === null) return "No reminder";
  return `${item.reminderMinutes === 0 ? "At start" : `${item.reminderMinutes} min before`} · ${item.days.length === 7 ? "daily" : `${item.days.length} days/week`} · from ${formatDateKey(new Date())}`;
}
