import AsyncStorage from "@react-native-async-storage/async-storage";
import { seedItems } from "./seed";
import type { RoutineData } from "./types";

export interface RoutineRepository {
  load(): Promise<RoutineData>;
  save(data: RoutineData): Promise<void>;
}

const STORAGE_KEY = "dayframe:routine:v1";

function freshData(): RoutineData {
  return { version: 1, items: structuredClone(seedItems), completions: {} };
}

export class LocalRoutineRepository implements RoutineRepository {
  constructor(private readonly storage: Pick<typeof AsyncStorage, "getItem" | "setItem"> = AsyncStorage) {}

  async load(): Promise<RoutineData> {
    const raw = await this.storage.getItem(STORAGE_KEY);
    if (!raw) return freshData();
    try {
      const parsed = JSON.parse(raw) as Partial<RoutineData>;
      if (parsed.version !== 1 || !Array.isArray(parsed.items) || typeof parsed.completions !== "object") {
        throw new Error("Unsupported routine data");
      }
      return parsed as RoutineData;
    } catch {
      return freshData();
    }
  }

  async save(data: RoutineData): Promise<void> {
    await this.storage.setItem(STORAGE_KEY, JSON.stringify(data));
  }
}

export function toggleCompletion(data: RoutineData, dateKey: string, itemId: string): RoutineData {
  const dateCompletions = { ...(data.completions[dateKey] ?? {}) };
  dateCompletions[itemId] = !dateCompletions[itemId];
  return { ...data, completions: { ...data.completions, [dateKey]: dateCompletions } };
}
