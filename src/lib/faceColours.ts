/**
 * Which colour each face of the player's cube is — real cubes don't all use
 * the standard scheme. Kept in `localStorage`.
 *
 * A sticker's letter (`W Y G B R O`) is what the solver understands: it means
 * "the colour of this face's centre" (`W` = the U centre, and so on), not a
 * literal colour. The scheme only changes how each letter is drawn, so painting
 * and solving work the same whatever colours are picked.
 */

import { useSyncExternalStore } from "react";
import type { FaceKey } from "@/components/RubiksCube";

/** The colours a face can be given. No black or grey: those are the cube
 *  body and unpainted stickers. */
export const FACE_COLOUR_OPTIONS = [
  { id: "white", name: "Бяло", hex: "#f7f7f7" },
  { id: "yellow", name: "Жълто", hex: "#ffd534" },
  { id: "orange", name: "Оранжево", hex: "#ff7b1a" },
  { id: "red", name: "Червено", hex: "#c8102e" },
  { id: "pink", name: "Розово", hex: "#ff69b4" },
  { id: "purple", name: "Лилаво", hex: "#7b3fbf" },
  { id: "blue", name: "Синьо", hex: "#0051ba" },
  { id: "lightBlue", name: "Светлосиньо", hex: "#4fc3f7" },
  { id: "green", name: "Зелено", hex: "#00923f" },
  { id: "lime", name: "Светлозелено", hex: "#9ad63b" },
] as const;

export type FaceColourId = (typeof FACE_COLOUR_OPTIONS)[number]["id"];

/** A colour for every face, no two alike. */
export type FaceScheme = Record<FaceKey, FaceColourId>;

/** The usual Western scheme — what the app has always drawn. */
export const DEFAULT_SCHEME: FaceScheme = {
  U: "white",
  D: "yellow",
  F: "green",
  B: "blue",
  L: "orange",
  R: "red",
};

/** The sticker letter that stands for each face's colour. */
export const FACE_CODE: Record<FaceKey, string> = {
  U: "W",
  D: "Y",
  F: "G",
  B: "B",
  L: "O",
  R: "R",
};

const FACES = Object.keys(FACE_CODE) as FaceKey[];
const HEX = Object.fromEntries(FACE_COLOUR_OPTIONS.map((o) => [o.id, o.hex])) as Record<
  FaceColourId,
  string
>;

/** Sticker letter -> the colour to draw it in, under `scheme`. */
export function schemeColors(scheme: FaceScheme): Record<string, string> {
  return Object.fromEntries(FACES.map((f) => [FACE_CODE[f], HEX[scheme[f]]]));
}

/**
 * `scheme` with `face` set to `colour`. If another face already has that
 * colour, the two swap, so the scheme never has two faces alike.
 */
export function withFaceColour(
  scheme: FaceScheme,
  face: FaceKey,
  colour: FaceColourId,
): FaceScheme {
  const next = { ...scheme };
  const other = FACES.find((f) => f !== face && scheme[f] === colour);
  if (other) next[other] = scheme[face];
  next[face] = colour;
  return next;
}

/** A stored scheme, or null if it's missing, malformed or has a repeat. */
export function parseScheme(raw: string | null): FaceScheme | null {
  if (!raw) return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof data !== "object" || data === null) return null;
  const record = data as Record<string, unknown>;
  const scheme = {} as FaceScheme;
  for (const face of FACES) {
    const colour = record[face];
    if (!FACE_COLOUR_OPTIONS.some((o) => o.id === colour)) return null;
    scheme[face] = colour as FaceColourId;
  }
  if (new Set(Object.values(scheme)).size !== FACES.length) return null;
  return scheme;
}

// ---------------------------------------------------------------------------
// Store: `localStorage`, shared by every component and kept in sync across tabs
// ---------------------------------------------------------------------------

const STORAGE_KEY = "rubikweb.faceColours";

const listeners = new Set<() => void>();
/** Loaded on first read; null = read `localStorage` again. */
let current: FaceScheme | null = null;

function getSnapshot(): FaceScheme {
  if (current === null) {
    try {
      current = parseScheme(localStorage.getItem(STORAGE_KEY)) ?? DEFAULT_SCHEME;
    } catch {
      // Storage blocked (private mode, site data off): use the defaults.
      current = DEFAULT_SCHEME;
    }
  }
  return current;
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  // Another tab changed the colours.
  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY && event.key !== null) return;
    current = null;
    onChange();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

/** Make `scheme` the player's colours, here and in `localStorage`. */
export function saveFaceScheme(scheme: FaceScheme): void {
  current = scheme;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(scheme));
  } catch {
    // Can't persist; still use it for this visit.
  }
  listeners.forEach((l) => l());
}

/** The player's colour scheme. The server render (and the first client
 *  render, so hydration matches) uses the defaults. */
export function useFaceScheme(): FaceScheme {
  return useSyncExternalStore(subscribe, getSnapshot, () => DEFAULT_SCHEME);
}
