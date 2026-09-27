/**
 * The Мисия puzzle is daily: one scramble per calendar day, kept in
 * `localStorage` so every visit that day gets the same cube, and rolled
 * afresh once the date changes.
 *
 * The solver's scramble can't be seeded, so the scramble itself is stored
 * rather than something to regenerate it from. That makes the puzzle daily
 * per browser, not shared between players.
 */

import { applyMoveToFacelets, parseNetString } from "@/components/RubiksCube";

/** A scramble in the solver's (Latin) notation and the layout it leads to. */
export type DailyScramble = { layout: string; scramble: string };

const STORAGE_KEY = "rubikweb.dailyMission";

/** Today's date in the player's own time zone, e.g. `"2026-09-27"`. */
export function todayKey(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** The move that undoes `move` (`R` <-> `R'`; a half turn undoes itself). */
const invert = (move: string) =>
  move.endsWith("'") ? move.slice(0, -1) : move.endsWith("2") ? move : `${move}'`;

/**
 * Whether `scramble` really leads a solved cube to `layout` — so a stored
 * entry that was damaged or edited by hand is never played.
 */
export function isConsistent({ layout, scramble }: DailyScramble): boolean {
  const moves = scramble.split(" ").filter(Boolean);
  if (moves.length === 0 || !moves.every((m) => /^[UDFBLR]['2]?$/.test(m))) return false;
  let cube;
  try {
    cube = parseNetString(layout);
  } catch {
    return false;
  }
  for (let i = moves.length - 1; i >= 0; i--) {
    cube = applyMoveToFacelets(cube, invert(moves[i]));
  }
  // Walked back to solved: every face one colour, the one its centre shows.
  return Object.values(cube).every((face) => face.every((c) => c === face[4]));
}

/** Today's stored scramble, or null if there is none for `today` (or it's
 *  unreadable, or storage is blocked). */
export function loadDailyScramble(today: string): DailyScramble | null {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    if (
      data?.date !== today ||
      typeof data.layout !== "string" ||
      typeof data.scramble !== "string"
    ) {
      return null;
    }
    const entry = { layout: data.layout, scramble: data.scramble };
    return isConsistent(entry) ? entry : null;
  } catch {
    return null;
  }
}

/** Keep `entry` as the scramble for `today`, replacing any older day's. */
export function saveDailyScramble(today: string, entry: DailyScramble): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ date: today, ...entry }));
  } catch {
    // Can't persist: this visit still plays it, the next one rolls again.
  }
}
