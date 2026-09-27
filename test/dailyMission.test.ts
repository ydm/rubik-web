import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import init, * as solver from "../public/solver/rubiksolver.js";
import {
  isConsistent,
  loadDailyScramble,
  saveDailyScramble,
  todayKey,
  type DailyScramble,
} from "@/lib/dailyMission";
import { wasmBytes } from "./wasm";

let entry: DailyScramble;

beforeAll(async () => {
  await init({ module_or_path: wasmBytes() });
  const scramble = solver.scramble_moves(20).trim();
  entry = { scramble, layout: solver.apply_moves(solver.solved(), scramble).value };
});

/** An in-memory `localStorage`. */
function fakeStorage() {
  const data = new Map<string, string>();
  const storage = {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  };
  vi.stubGlobal("localStorage", storage);
  return storage;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("todayKey", () => {
  it("is the local calendar date, zero-padded", () => {
    expect(todayKey(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
    expect(todayKey(new Date(2026, 11, 31, 0, 0))).toBe("2026-12-31");
  });

  it("changes at local midnight", () => {
    expect(todayKey(new Date(2026, 8, 27, 23, 59, 59))).not.toBe(
      todayKey(new Date(2026, 8, 28, 0, 0, 0)),
    );
  });
});

describe("isConsistent", () => {
  it("accepts a scramble with the layout it leads to", () => {
    expect(isConsistent(entry)).toBe(true);
  });

  it("rejects a layout the scramble doesn't lead to", () => {
    const other = solver.apply_moves(solver.solved(), "R U").value;
    expect(isConsistent({ ...entry, layout: other })).toBe(false);
  });

  it.each([
    ["an empty scramble", ""],
    ["a bad move token", "R X U"],
    ["Bulgarian notation", "Д Г"],
  ])("rejects %s", (_, scramble) => {
    expect(isConsistent({ ...entry, scramble })).toBe(false);
  });

  it("rejects a malformed layout", () => {
    expect(isConsistent({ ...entry, layout: "nope" })).toBe(false);
  });
});

describe("daily storage", () => {
  it("gives back the same scramble all day", () => {
    fakeStorage();
    saveDailyScramble("2026-09-27", entry);
    expect(loadDailyScramble("2026-09-27")).toEqual(entry);
    expect(loadDailyScramble("2026-09-27")).toEqual(entry);
  });

  it("has nothing for a new day", () => {
    fakeStorage();
    saveDailyScramble("2026-09-27", entry);
    expect(loadDailyScramble("2026-09-28")).toBeNull();
  });

  it("replaces the previous day's scramble", () => {
    const storage = fakeStorage();
    saveDailyScramble("2026-09-27", entry);
    const next = { ...entry, scramble: "R U", layout: solver.apply_moves(solver.solved(), "R U").value };
    saveDailyScramble("2026-09-28", next);
    expect(loadDailyScramble("2026-09-28")).toEqual(next);
    expect(loadDailyScramble("2026-09-27")).toBeNull();
    expect(JSON.parse(storage.getItem("rubikweb.dailyMission")!).date).toBe("2026-09-28");
  });

  it.each([
    ["nothing stored", null],
    ["not JSON", "{oops"],
    ["missing fields", JSON.stringify({ date: "2026-09-27" })],
  ])("ignores %s", (_, raw) => {
    const storage = fakeStorage();
    if (raw !== null) storage.setItem("rubikweb.dailyMission", raw);
    expect(loadDailyScramble("2026-09-27")).toBeNull();
  });

  it("ignores an entry edited so the scramble no longer matches", () => {
    const storage = fakeStorage();
    storage.setItem(
      "rubikweb.dailyMission",
      JSON.stringify({ date: "2026-09-27", ...entry, scramble: "R" }),
    );
    expect(loadDailyScramble("2026-09-27")).toBeNull();
  });

  it("copes with storage being blocked", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new DOMException("blocked", "SecurityError");
      },
      setItem: () => {
        throw new DOMException("blocked", "SecurityError");
      },
    });
    expect(() => saveDailyScramble("2026-09-27", entry)).not.toThrow();
    expect(loadDailyScramble("2026-09-27")).toBeNull();
  });
});
