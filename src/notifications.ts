import * as Notifications from "expo-notifications";
import { notificationPlans } from "./notification-plans";
import type { RoutineItem } from "./types";

export const NOTIFICATION_CHANNEL = "routine-reminders";

export async function configureNotificationChannel(): Promise<void> {
  await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNEL, {
    name: "Routine reminders",
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

export async function rescheduleNotifications(items: RoutineItem[]): Promise<number> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  const plans = notificationPlans(items, new Date());
  for (const plan of plans) {
    await Notifications.scheduleNotificationAsync({
      content: { title: plan.title, body: plan.body, data: { itemId: plan.itemId } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: plan.date, channelId: NOTIFICATION_CHANNEL },
    });
  }
  return plans.length;
}
