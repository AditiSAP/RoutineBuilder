import { describe, expect, it } from "vitest";
import { LocalRoutineRepository, toggleCompletion } from "./storage";
import type { RoutineData } from "./types";

describe("completion persistence", () => {
  it("scopes completion to one calendar date and preserves history", () => {
    const data: RoutineData = { version: 1, items: [], completions: {} };
    const monday = toggleCompletion(data, "2026-09-28", "wake");
    expect(monday.completions["2026-09-28"]?.wake).toBe(true);
    expect(monday.completions["2026-09-29"]).toBeUndefined();
    const tuesday = toggleCompletion(monday, "2026-09-29", "wake");
    expect(tuesday.completions["2026-09-28"]?.wake).toBe(true);
    expect(tuesday.completions["2026-09-29"]?.wake).toBe(true);
  });

  it("round-trips data through the repository abstraction", async () => {
    const memory = new Map<string, string>();
    const storage = { getItem: async (key: string) => memory.get(key) ?? null, setItem: async (key: string, value: string) => void memory.set(key, value) };
    const repository = new LocalRoutineRepository(storage);
    const changed = toggleCompletion(await repository.load(), "2026-09-28", "wake");
    await repository.save(changed);
    expect((await repository.load()).completions["2026-09-28"]?.wake).toBe(true);
  });
});
