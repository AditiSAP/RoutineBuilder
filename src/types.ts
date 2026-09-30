export const WEEKDAYS = [
  { value: 0, short: "Sun" },
  { value: 1, short: "Mon" },
  { value: 2, short: "Tue" },
  { value: 3, short: "Wed" },
  { value: 4, short: "Thu" },
  { value: 5, short: "Fri" },
  { value: 6, short: "Sat" },
] as const;

export type RoutineLink = { id: string; label: string; url: string };

export type RoutineItem = {
  id: string;
  title: string;
  emoji: string;
  startTime: string;
  endTime: string;
  category: string;
  days: number[];
  reminderMinutes: number | null;
  notes: string;
  links: RoutineLink[];
  order: number;
};

export type CompletionMap = Record<string, Record<string, boolean>>;

export type RoutineData = {
  version: 1;
  items: RoutineItem[];
  completions: CompletionMap;
};
