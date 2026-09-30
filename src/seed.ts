import type { RoutineItem } from "./types";

const everyDay = [0, 1, 2, 3, 4, 5, 6];
const weekdays = [1, 2, 3, 4, 5];

export const seedItems: RoutineItem[] = [
  { id: "wake", title: "Wake up & hydrate", emoji: "☀️", startTime: "06:00", endTime: "06:10", category: "Morning", days: everyDay, reminderMinutes: 0, notes: "Drink a full glass of water and open the curtains.", links: [], order: 0 },
  { id: "mindful", title: "Mindful start", emoji: "🧘", startTime: "06:10", endTime: "06:30", category: "Wellbeing", days: everyDay, reminderMinutes: null, notes: "Breathing, journaling, or quiet reflection.", links: [], order: 1 },
  { id: "workout", title: "Morning workout", emoji: "🏃", startTime: "06:30", endTime: "07:15", category: "Fitness", days: weekdays, reminderMinutes: 10, notes: "Alternate strength, mobility, and cardio.", links: [{ id: "workout-link", label: "Open workout", url: "https://www.youtube.com/results?search_query=30+minute+home+workout" }], order: 2 },
  { id: "ready", title: "Shower & get ready", emoji: "🚿", startTime: "07:15", endTime: "07:45", category: "Morning", days: everyDay, reminderMinutes: null, notes: "", links: [], order: 3 },
  { id: "breakfast", title: "Breakfast", emoji: "🥣", startTime: "07:45", endTime: "08:15", category: "Meals", days: everyDay, reminderMinutes: null, notes: "A balanced breakfast, without screens.", links: [], order: 4 },
  { id: "plan", title: "Plan the day", emoji: "✍️", startTime: "08:15", endTime: "08:30", category: "Focus", days: weekdays, reminderMinutes: 5, notes: "Choose the three outcomes that matter most.", links: [], order: 5 },
  { id: "deep-work", title: "Deep work", emoji: "🎯", startTime: "08:30", endTime: "12:00", category: "Work", days: weekdays, reminderMinutes: 5, notes: "Silence notifications and protect this block.", links: [], order: 6 },
  { id: "lunch", title: "Lunch & walk", emoji: "🥗", startTime: "12:00", endTime: "13:00", category: "Meals", days: everyDay, reminderMinutes: 10, notes: "Step outside after eating.", links: [], order: 7 },
  { id: "afternoon", title: "Afternoon focus", emoji: "💻", startTime: "13:00", endTime: "17:00", category: "Work", days: weekdays, reminderMinutes: null, notes: "Meetings, collaboration, and lighter focus work.", links: [], order: 8 },
  { id: "reset", title: "Close the workday", emoji: "✅", startTime: "17:00", endTime: "17:15", category: "Focus", days: weekdays, reminderMinutes: 5, notes: "Capture loose ends and choose tomorrow's first task.", links: [], order: 9 },
  { id: "personal", title: "Personal time", emoji: "🌿", startTime: "17:15", endTime: "18:30", category: "Personal", days: everyDay, reminderMinutes: null, notes: "Errands, hobbies, friends, or time outdoors.", links: [], order: 10 },
  { id: "dinner", title: "Dinner", emoji: "🍲", startTime: "18:30", endTime: "19:15", category: "Meals", days: everyDay, reminderMinutes: 10, notes: "", links: [], order: 11 },
  { id: "evening", title: "Unhurried evening", emoji: "🎨", startTime: "19:15", endTime: "21:00", category: "Personal", days: everyDay, reminderMinutes: null, notes: "Make, read, connect, or rest.", links: [], order: 12 },
  { id: "wind-down", title: "Wind down", emoji: "📖", startTime: "21:00", endTime: "21:45", category: "Wellbeing", days: everyDay, reminderMinutes: 15, notes: "Dim lights and leave devices outside the bedroom.", links: [], order: 13 },
  { id: "sleep", title: "Sleep", emoji: "🌙", startTime: "22:00", endTime: "06:00", category: "Sleep", days: everyDay, reminderMinutes: 15, notes: "This overnight block ends the following morning.", links: [], order: 14 },
];
