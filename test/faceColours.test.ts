import { afterEach, describe, expect, it, vi } from "vitest";
import { COLORS, NEUTRAL_COLOR } from "@/components/RubiksCube";
import {
  DEFAULT_SCHEME,
  FACE_COLOUR_OPTIONS,
  parseScheme,
  saveFaceScheme,
  schemeColors,
  withFaceColour,
  type FaceScheme,
} from "@/lib/faceColours";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("colour options", () => {
  it("are all distinct, and never the unpainted grey or black", () => {
    const hexes = FACE_COLOUR_OPTIONS.map((o) => o.hex.toLowerCase());
    expect(new Set(hexes).size).toBe(hexes.length);
    expect(hexes).not.toContain(NEUTRAL_COLOR.toLowerCase());
    expect(hexes).not.toContain("#000000");
  });

  it("include the six standard colours", () => {
    const ids = FACE_COLOUR_OPTIONS.map((o) => o.id);
    for (const id of ["white", "yellow", "green", "blue", "red", "orange", "purple"]) {
      expect(ids).toContain(id);
    }
  });
});

describe("schemeColors", () => {
  it("draws the default scheme exactly as the app always has", () => {
    expect(schemeColors(DEFAULT_SCHEME)).toEqual(COLORS);
  });

  it("recolours the letter of the face that changed", () => {
    const colors = schemeColors({ ...DEFAULT_SCHEME, U: "purple" });
    expect(colors.W).toBe("#7b3fbf");
    expect(colors.Y).toBe(COLORS.Y);
  });
});

describe("withFaceColour", () => {
  it("sets a colour no other face has", () => {
    expect(withFaceColour(DEFAULT_SCHEME, "U", "pink")).toEqual({ ...DEFAULT_SCHEME, U: "pink" });
  });

  it("swaps with the face that already had the colour", () => {
    const next = withFaceColour(DEFAULT_SCHEME, "U", "yellow");
    expect(next).toEqual({ ...DEFAULT_SCHEME, U: "yellow", D: "white" });
  });

  it("leaves the scheme alone when the colour is already that face's", () => {
    expect(withFaceColour(DEFAULT_SCHEME, "F", "green")).toEqual(DEFAULT_SCHEME);
  });

  it("does not modify its input", () => {
    const before = { ...DEFAULT_SCHEME };
    withFaceColour(DEFAULT_SCHEME, "U", "yellow");
    expect(DEFAULT_SCHEME).toEqual(before);
  });
});

describe("parseScheme", () => {
  const custom: FaceScheme = { ...DEFAULT_SCHEME, U: "purple", B: "lightBlue" };

  it("reads back a saved scheme", () => {
    expect(parseScheme(JSON.stringify(custom))).toEqual(custom);
  });

  it.each([
    ["nothing stored", null],
    ["not JSON", "{oops"],
    ["not an object", '"white"'],
    ["a face missing", JSON.stringify({ ...DEFAULT_SCHEME, R: undefined })],
    ["an unknown colour", JSON.stringify({ ...DEFAULT_SCHEME, R: "black" })],
    ["two faces alike", JSON.stringify({ ...DEFAULT_SCHEME, R: "white" })],
  ])("rejects %s", (_, raw) => {
    expect(parseScheme(raw)).toBeNull();
  });
});

describe("saveFaceScheme", () => {
  it("stores the scheme in localStorage", () => {
    const setItem = vi.fn();
    vi.stubGlobal("localStorage", { setItem, getItem: () => null });
    const scheme = withFaceColour(DEFAULT_SCHEME, "L", "pink");
    saveFaceScheme(scheme);
    expect(setItem).toHaveBeenCalledWith("rubikweb.faceColours", JSON.stringify(scheme));
    expect(parseScheme(setItem.mock.calls[0][1])).toEqual(scheme);
  });

  it("doesn't throw when storage is blocked", () => {
    vi.stubGlobal("localStorage", {
      setItem: () => {
        throw new DOMException("blocked", "SecurityError");
      },
    });
    expect(() => saveFaceScheme(DEFAULT_SCHEME)).not.toThrow();
  });
});
