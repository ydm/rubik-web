"use client";

import { useEffect, useImperativeHandle, useRef } from "react";
import type { Ref } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

// ---------------------------------------------------------------------------
// Cube state model + parser
// ---------------------------------------------------------------------------

export type FaceKey = "U" | "L" | "F" | "R" | "B" | "D";

/**
 * Nine single-character colour codes per face, row-major, oriented exactly as
 * the face is drawn in a standard unfolded net (see `parseNetString`).
 */
export type Facelets = Record<FaceKey, string[]>;

/**
 * Colour code -> rendered colour. Codes are whatever your solver emits; the
 * defaults here follow the usual Western scheme (White up, Yellow down,
 * Green front, Blue back, Red right, Orange left).
 */
export const COLORS: Record<string, string> = {
  W: "#f7f7f7",
  Y: "#ffd534",
  G: "#00923f",
  B: "#0051ba",
  R: "#c8102e",
  O: "#ff7b1a",
};

/** Fill for any code not in `COLORS` — e.g. unpainted stickers in "solve" mode. */
export const NEUTRAL_COLOR = "#4b4f58";

const cloneFacelets = (f: Facelets): Facelets => ({
  U: [...f.U],
  L: [...f.L],
  F: [...f.F],
  R: [...f.R],
  B: [...f.B],
  D: [...f.D],
});

/** Language of the single-letter labels painted on the six centre stickers. */
export type LabelLanguage = "en" | "bg" | "none";

/**
 * Centre-sticker labels per face. These are positional: the centre of the face
 * whose outward normal is +Y is always "U", regardless of its colour.
 *
 * The Bulgarian set uses distinct single letters — Горе / Долу / Фронт / Бек /
 * Ляво / (дясно →) Р — because literal initials collide (Горе vs Гръб,
 * Долу vs Дясно, Лице vs Ляво). Override any of them via `labelOverrides`.
 */
export const FACE_LABELS: Record<"en" | "bg", Record<FaceKey, string>> = {
  en: { U: "U", D: "D", F: "F", B: "B", L: "L", R: "R" },
  bg: {
    U: "Г", // Горна
    D: "О", // Основа
    F: "П", // Предна
    B: "З", // Задна
    L: "Л", // Лява
    R: "Д", // Дясна
  },
};

/** Pick a readable ink colour (near-black or near-white) for text on `hex`. */
export function pickInk(hex: string): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 0.55 ? "#1b1b1b" : "#f7f7f7";
}

/** Draw a face colour + centred glyph onto a canvas and wrap it as a texture. */
function makeCenterTexture(bgHex: string, glyph: string): THREE.CanvasTexture {
  const S = 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = S;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = bgHex;
  ctx.fillRect(0, 0, S, S);

  const fontStack =
    '"Geist", system-ui, -apple-system, "Segoe UI", "Noto Sans", Roboto, sans-serif';
  let fontPx = Math.round(S * 0.62);
  ctx.font = `bold ${fontPx}px ${fontStack}`;
  while (ctx.measureText(glyph).width > S * 0.78 && fontPx > 8) {
    fontPx -= 4;
    ctx.font = `bold ${fontPx}px ${fontStack}`;
  }

  ctx.fillStyle = pickInk(bgHex);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(glyph, S / 2, S / 2 + S * 0.02);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/**
 * Parse the compact "unfolded net" form:
 *
 * ```
 *         U U U
 *         U U U
 *         U U U
 *  L L L | F F F | R R R | B B B
 *  L L L | F F F | R R R | B B B
 *  L L L | F F F | R R R | B B B
 *         D D D
 *         D D D
 *         D D D
 * ```
 *
 * Everything that is not a letter (spaces, `|`, `+`, `-`) is ignored, so the
 * spaced variant parses identically. Expects exactly 9 non-empty lines: 3 for
 * U, 3 for the L/F/R/B band, 3 for D.
 */
export function parseNetString(input: string): Facelets {
  // Keep letters and `?` (the unset marker); drop spaces, `|`, etc.
  const strip = (s: string) => s.replace(/[^A-Za-z?]/g, "").toUpperCase();
  const lines = input
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length !== 9) {
    throw new Error(
      `parseNetString: expected 9 non-empty lines, got ${lines.length}`,
    );
  }

  const rows = lines.map(strip);
  const need = (i: number, len: number) => {
    if (rows[i].length !== len) {
      throw new Error(
        `parseNetString: line ${i + 1} has ${rows[i].length} colour(s), ` +
          `expected ${len} ("${lines[i]}")`,
      );
    }
    return rows[i];
  };

  const U: string[] = [];
  const D: string[] = [];
  const L: string[] = [];
  const F: string[] = [];
  const R: string[] = [];
  const B: string[] = [];

  for (let r = 0; r < 3; r++) {
    const top = need(r, 3);
    U.push(top[0], top[1], top[2]);

    const mid = need(r + 3, 12);
    L.push(mid[0], mid[1], mid[2]);
    F.push(mid[3], mid[4], mid[5]);
    R.push(mid[6], mid[7], mid[8]);
    B.push(mid[9], mid[10], mid[11]);

    const bot = need(r + 6, 3);
    D.push(bot[0], bot[1], bot[2]);
  }

  const faces: Facelets = { U, L, F, R, B, D };

  // Soft sanity check: once every sticker is a known colour, expect 9 of each.
  const counts: Record<string, number> = {};
  let known = 0;
  for (const key of Object.keys(faces) as FaceKey[]) {
    for (const c of faces[key]) {
      counts[c] = (counts[c] ?? 0) + 1;
      if (c in COLORS) known++;
    }
  }
  if (known === 54 && Object.values(counts).some((n) => n !== 9)) {
    console.warn(
      "parseNetString: unusual colour distribution",
      counts,
      "(expected every colour to appear 9 times)",
    );
  }

  return faces;
}

/** A sample scrambled cube in the accepted net form. */
export const DEFAULT_CUBE = `
    YYO
    OWW
    RGG
BYB|WWR|WBW|BGO
OOB|RGG|ORR|GBB
OYO|WYB|YRG|RWY
    GRR
    BYW
    GOY
`;

/**
 * Starting point for entering your own cube: every movable sticker unset (`?`),
 * but the six centres fixed to their real colours (U white, D yellow, F green,
 * B blue, L orange, R red) since a real cube's centres never move.
 */
export const BLANK_CUBE = `
    ???
    ?W?
    ???
???|???|???|???
?O?|?G?|?R?|?B?
???|???|???|???
    ???
    ?Y?
    ???
`;

/**
 * Serialize facelets back to the compact net string (inverse of
 * `parseNetString`) — handy for handing a hand-entered cube to a solver.
 */
export function faceletsToNetString(f: Facelets): string {
  const row = (a: string[], r: number) => a.slice(r * 3, r * 3 + 3).join("");
  const band = (r: number) =>
    [row(f.L, r), row(f.F, r), row(f.R, r), row(f.B, r)].join("|");
  return [
    `    ${row(f.U, 0)}`,
    `    ${row(f.U, 1)}`,
    `    ${row(f.U, 2)}`,
    band(0),
    band(1),
    band(2),
    `    ${row(f.D, 0)}`,
    `    ${row(f.D, 1)}`,
    `    ${row(f.D, 2)}`,
  ].join("\n");
}

/**
 * Serialize facelets to the spaced/verbose net string — stickers separated by
 * spaces, `|` between faces, U/D rows indented to sit above the F column.
 */
export function faceletsToVerboseString(f: Facelets): string {
  const row = (a: string[], r: number) => a.slice(r * 3, r * 3 + 3).join(" ");
  const pad = " ".repeat(9); // 1 + "X X X" (5) + " | " (3)
  const band = (r: number) =>
    ` ${[row(f.L, r), row(f.F, r), row(f.R, r), row(f.B, r)].join(" | ")}`;
  return [
    pad + row(f.U, 0),
    pad + row(f.U, 1),
    pad + row(f.U, 2),
    band(0),
    band(1),
    band(2),
    pad + row(f.D, 0),
    pad + row(f.D, 1),
    pad + row(f.D, 2),
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Net sticker -> 3D placement
// ---------------------------------------------------------------------------

type Placement = {
  /** Cubie coordinate, each component in {-1, 0, 1}. */
  cubie: [number, number, number];
  /** Outward normal the sticker faces. */
  normal: [number, number, number];
};

/**
 * Map a sticker at (face, row, col) in the net to the cubie it belongs to and
 * the direction it faces. Axes: +x = R, +y = U, +z = F. Row/col are 0..2 with
 * row 0 = top of the face as drawn, col 0 = left.
 */
function placement(face: FaceKey, r: number, c: number): Placement {
  switch (face) {
    case "U":
      return { cubie: [c - 1, 1, r - 1], normal: [0, 1, 0] };
    case "D":
      return { cubie: [c - 1, -1, 1 - r], normal: [0, -1, 0] };
    case "F":
      return { cubie: [c - 1, 1 - r, 1], normal: [0, 0, 1] };
    case "B":
      return { cubie: [1 - c, 1 - r, -1], normal: [0, 0, -1] };
    case "R":
      return { cubie: [1, 1 - r, 1 - c], normal: [1, 0, 0] };
    case "L":
      return { cubie: [-1, 1 - r, c - 1], normal: [-1, 0, 0] };
    default:
      throw new Error(`placement: unknown face ${face as string}`);
  }
}

/**
 * Euler rotation for a sticker plane (default facing +Z) so it faces outward on
 * each face with its texture upright when that face is viewed head-on.
 */
const FACE_ROT: Record<FaceKey, [number, number, number]> = {
  F: [0, 0, 0],
  B: [0, Math.PI, 0],
  R: [0, Math.PI / 2, 0],
  L: [0, -Math.PI / 2, 0],
  U: [-Math.PI / 2, 0, 0],
  D: [Math.PI / 2, 0, 0],
};

// ---------------------------------------------------------------------------
// Moves
// ---------------------------------------------------------------------------

type Axis = "x" | "y" | "z";

/** For each face: rotation axis, which layer (coord value), and the sign of a
 *  clockwise (unprimed) quarter turn about that axis. */
const MOVE_DEFS: Record<string, { axis: Axis; layer: number; dir: number }> = {
  U: { axis: "y", layer: 1, dir: -1 },
  D: { axis: "y", layer: -1, dir: 1 },
  R: { axis: "x", layer: 1, dir: -1 },
  L: { axis: "x", layer: -1, dir: 1 },
  F: { axis: "z", layer: 1, dir: -1 },
  B: { axis: "z", layer: -1, dir: 1 },
};

/** Cyrillic label -> canonical face letter, so a move token may use either. */
const FACE_ALIAS: Record<string, FaceKey> = Object.fromEntries(
  (Object.entries(FACE_LABELS.bg) as [FaceKey, string][]).map(([k, v]) => [
    v.toUpperCase(),
    k,
  ]),
);

type Pos = { face: FaceKey; index: number };
type Vec3 = [number, number, number];

/** Which sticker position sits where in space: "cubie|normal" -> position. */
const POSITION_AT: Map<string, Pos> = (() => {
  const at = new Map<string, Pos>();
  (Object.keys(FACE_ROT) as FaceKey[]).forEach((face) => {
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        const { cubie, normal } = placement(face, r, c);
        at.set(`${cubie}|${normal}`, { face, index: r * 3 + c });
      }
    }
  });
  return at;
})();

/** Quarter turn of an integer vector about `axis`, right-hand rule. */
function rotateQuarter([x, y, z]: Vec3, axis: Axis, dir: 1 | -1): Vec3 {
  if (axis === "x") return dir > 0 ? [x, -z, y] : [x, z, -y];
  if (axis === "y") return dir > 0 ? [z, y, -x] : [-z, y, x];
  return dir > 0 ? [-y, x, z] : [y, -x, z];
}

/** The turn the renderer animates, as pairs of "sticker here lands there". */
function turnPairs(axis: Axis, layer: number, dir: 1 | -1): [Pos, Pos][] {
  const pairs: [Pos, Pos][] = [];
  (Object.keys(FACE_ROT) as FaceKey[]).forEach((face) => {
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        const { cubie, normal } = placement(face, r, c);
        const coord = axis === "x" ? cubie[0] : axis === "y" ? cubie[1] : cubie[2];
        if (coord !== layer) continue;
        const to = POSITION_AT.get(
          `${rotateQuarter(cubie, axis, dir)}|${rotateQuarter(normal, axis, dir)}`,
        );
        if (to) pairs.push([{ face, index: r * 3 + c }, to]);
      }
    }
  });
  return pairs;
}

/**
 * `f` after `move` — the same rearrangement `applyMove` animates, done on the
 * facelet grid. Accepts either notation, with `'` / `2` suffixes.
 */
export function applyMoveToFacelets(f: Facelets, move: string): Facelets {
  const token = move.trim();
  const head = token[0]?.toUpperCase() ?? "";
  const def = MOVE_DEFS[FACE_ALIAS[head] ?? head];
  if (!def) return f;

  const dir = (def.dir * (token.endsWith("'") ? -1 : 1)) as 1 | -1;
  const pairs = turnPairs(def.axis, def.layer, dir);
  let out = f;
  for (let turn = token.endsWith("2") ? 2 : 1; turn > 0; turn--) {
    const next = cloneFacelets(out);
    for (const [from, to] of pairs) next[to.face][to.index] = out[from.face][from.index];
    out = next;
  }
  return out;
}

/** Eased progress 0..1 for a turn: slow start, fast middle, slow stop. */
const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

/** All quarter-turn moves in Singmaster notation, unprimed then primed. */
export const MOVES = [
  "Л",
  "Д",
  "П",
  "З",
  "Г",
  "О",
  "Л'",
  "Д'",
  "П'",
  "З'",
  "Г'",
  "О'",
] as const;

/** Imperative API exposed via `ref`. */
export type RubiksCubeHandle = {
  /** Queue a turn, e.g. `"R"`, `"U'"` or `"F2"`. Plays after any in flight. */
  applyMove: (move: string) => void;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface RubiksCubeProps {
  /** Imperative handle for driving moves. */
  ref?: Ref<RubiksCubeHandle>;
  /** Cube state as an unfolded-net string (see `parseNetString`). */
  cube: string;
  /**
   * Language of the six centre-sticker letters. Defaults to `'bg'` (Bulgarian).
   * `'none'` hides them.
   */
  labelLanguage?: LabelLanguage;
  /** Per-face label overrides, e.g. `{ F: 'Ф' }`. Wins over `labelLanguage`. */
  labelOverrides?: Partial<Record<FaceKey, string>>;
  /**
   * When set to a colour code (e.g. `"R"`), tapping a sticker paints it that
   * colour instead of orbiting. `null`/undefined = view only.
   */
  paintColor?: string | null;
  /**
   * Colour code -> drawn colour. Defaults to `COLORS`. Changing it recolours
   * the stickers in place: paint, turns and camera are all kept.
   */
  colors?: Record<string, string>;
  /** Called with a fresh copy of the full facelet state after each paint. */
  onFaceletsChange?: (facelets: Facelets) => void;
  /**
   * Bump to rebuild the cube from `cube` even when that string hasn't changed
   * — e.g. to drop turns played since and go back to the layout it describes.
   */
  nonce?: number;
  className?: string;
}

export default function RubiksCube({
  ref,
  cube,
  labelLanguage = "bg",
  labelOverrides,
  paintColor = null,
  colors = COLORS,
  onFaceletsChange,
  nonce = 0,
  className,
}: RubiksCubeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const overridesKey = JSON.stringify(labelOverrides ?? {});

  // Kept in refs so painting or recolouring doesn't force the scene to rebuild.
  const paintColorRef = useRef(paintColor);
  const colorsRef = useRef(colors);
  // Filled in by the scene effect: redraw every sticker from `colorsRef`.
  const recolorRef = useRef<(() => void) | null>(null);
  const onFaceletsChangeRef = useRef(onFaceletsChange);

  // Bridge: the scene effect fills this in; the handle calls through it.
  const applyMoveRef = useRef<((move: string) => void) | null>(null);
  // Camera position/target, kept across scene rebuilds (see the effect).
  const viewRef = useRef<{ position: number[]; target: number[] } | null>(null);
  useImperativeHandle(
    ref,
    () => ({ applyMove: (move) => applyMoveRef.current?.(move) }),
    [],
  );
  useEffect(() => {
    paintColorRef.current = paintColor;
    const el = containerRef.current;
    if (el) el.style.cursor = paintColor ? "crosshair" : "";
  }, [paintColor]);
  useEffect(() => {
    onFaceletsChangeRef.current = onFaceletsChange;
  }, [onFaceletsChange]);
  // Compare by content, so a parent building a fresh object each render
  // doesn't redraw every sticker each time.
  const colorsKey = JSON.stringify(colors);
  useEffect(() => {
    colorsRef.current = colors;
    recolorRef.current?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on content
  }, [colorsKey]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let parsed: Facelets;
    try {
      parsed = parseNetString(cube);
    } catch (err) {
      console.error(err);
      return;
    }
    // Working copy that painting mutates.
    const work = cloneFacelets(parsed);

    // --- scene, camera, renderer -------------------------------------------
    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    // Same view angle, 1.2x further from the cube centre.
    camera.position.set(5.04, 5.28, 6.72);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    // The canvas always fills its container via CSS; the drawing buffer size is
    // managed separately by `resize()` below. This way a stale/zero buffer size
    // can never make the canvas overflow or vanish (the mobile failure mode).
    renderer.domElement.style.display = "block";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    // Touch drags orbit the camera — never scroll / zoom / pull-to-refresh.
    renderer.domElement.style.touchAction = "none";
    container.appendChild(renderer.domElement);

    // --- lights -----------------------------------------------------------
    scene.add(new THREE.AmbientLight(0xffffff, 0.9));
    const key = new THREE.DirectionalLight(0xffffff, 1.1);
    key.position.set(6, 9, 7);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 0.35);
    fill.position.set(-6, -4, -6);
    scene.add(fill);

    // --- cubies ---------------------------------------------------------
    const STEP = 1;
    const cubeGroup = new THREE.Group();
    scene.add(cubeGroup);

    const bodyGeo = new THREE.BoxGeometry(0.96, 0.96, 0.96);
    const bodyMat = new THREE.MeshLambertMaterial({ color: 0x0a0a0a });

    const cubies = new Map<string, THREE.Group>();
    for (let x = -1; x <= 1; x++) {
      for (let y = -1; y <= 1; y++) {
        for (let z = -1; z <= 1; z++) {
          const g = new THREE.Group();
          g.position.set(x * STEP, y * STEP, z * STEP);
          g.add(new THREE.Mesh(bodyGeo, bodyMat));
          cubeGroup.add(g);
          cubies.set(`${x},${y},${z}`, g);
        }
      }
    }

    // --- stickers -------------------------------------------------------
    const overrides = JSON.parse(overridesKey) as Partial<
      Record<FaceKey, string>
    >;
    const labels: Record<FaceKey, string> | null =
      labelLanguage === "none"
        ? null
        : { ...FACE_LABELS[labelLanguage], ...overrides };

    const stickerGeo = new THREE.PlaneGeometry(0.82, 0.82);
    const stickerMats: THREE.Material[] = [];
    // Centre stickers' letter textures, replaced when the colours change.
    const centerTextures = new Map<THREE.Mesh, THREE.CanvasTexture>();
    const hexFor = (code: string) => colorsRef.current[code] ?? NEUTRAL_COLOR;
    // Every sticker with its facelet (in `work`) and centre letter, if any.
    const allStickers: {
      mesh: THREE.Mesh;
      face: FaceKey;
      index: number;
      glyph?: string;
    }[] = [];
    // Meshes that can be painted, plus which facelet each one is.
    const stickerMeshes: THREE.Mesh[] = [];
    const stickerMeta = new Map<THREE.Mesh, { face: FaceKey; index: number }>();
    // Centre stickers + the world orientation their letter should always keep.
    const centerStickers: { mesh: THREE.Mesh; canonical: THREE.Quaternion }[] = [];

    (Object.keys(work) as FaceKey[]).forEach((face) => {
      const rot = FACE_ROT[face];
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          const index = r * 3 + c;
          const code = work[face][index];
          const { cubie: cc, normal } = placement(face, r, c);
          const cubie = cubies.get(`${cc[0]},${cc[1]},${cc[2]}`);
          if (!cubie) continue;

          const hex = hexFor(code);
          const isCenter = r === 1 && c === 1;
          const glyph = isCenter ? labels?.[face] : undefined;

          const mat = new THREE.MeshLambertMaterial();
          if (!glyph) mat.color = new THREE.Color(hex);
          stickerMats.push(mat);

          const sticker = new THREE.Mesh(stickerGeo, mat);
          if (glyph) {
            const tex = makeCenterTexture(hex, glyph);
            centerTextures.set(sticker, tex);
            mat.map = tex;
          }
          allStickers.push({ mesh: sticker, face, index, glyph });
          sticker.rotation.set(rot[0], rot[1], rot[2]);
          sticker.position.set(
            normal[0] * 0.481,
            normal[1] * 0.481,
            normal[2] * 0.481,
          );
          cubie.add(sticker);
          if (isCenter) {
            // Fixed reference point: never paintable, and its letter is kept
            // pinned to this orientation no matter how the cube is turned.
            centerStickers.push({
              mesh: sticker,
              canonical: new THREE.Quaternion().setFromEuler(
                new THREE.Euler(rot[0], rot[1], rot[2]),
              ),
            });
          } else {
            stickerMeshes.push(sticker);
            stickerMeta.set(sticker, { face, index });
          }
        }
      }
    });

    // --- moves ---------------------------------------------------------
    const allCubies = [...cubies.values()];
    const moveQueue: { axis: Axis; layer: number; angle: number }[] = [];
    let activeMove:
      | { axis: Axis; pivot: THREE.Group; members: THREE.Group[]; angle: number; t0: number }
      | null = null;
    const MOVE_MS = 420; // quarter-turn duration
    const snapM = new THREE.Matrix4();
    const worldQ = new THREE.Quaternion();

    // Counter-rotate every centre sticker so its letter stays in a constant
    // orientation relative to the cube while faces turn around it.
    const pinCenterLabels = () => {
      for (const { mesh, canonical } of centerStickers) {
        if (!mesh.parent) continue;
        mesh.parent.getWorldQuaternion(worldQ);
        mesh.quaternion.copy(worldQ).invert().multiply(canonical);
      }
    };

    const enqueueMove = (notation: string) => {
      const token = notation.trim();
      const head = token[0]?.toUpperCase() ?? "";
      const def = MOVE_DEFS[FACE_ALIAS[head] ?? head];
      if (!def) return;
      const angle = def.dir * (token.endsWith("'") ? -1 : 1) * (Math.PI / 2);
      // A half turn (`R2`) plays as two quarter turns, as in `applyMoveToFacelets`.
      for (let turn = token.endsWith("2") ? 2 : 1; turn > 0; turn--) {
        moveQueue.push({ axis: def.axis, layer: def.layer, angle });
      }
      requestRender();
    };

    const beginNextMove = () => {
      const next = moveQueue.shift();
      if (!next) return;
      const pivot = new THREE.Group();
      cubeGroup.add(pivot);
      const members = allCubies.filter(
        (g) => Math.round(g.position[next.axis]) === next.layer,
      );
      members.forEach((g) => pivot.attach(g));
      activeMove = {
        axis: next.axis,
        pivot,
        members,
        angle: next.angle,
        t0: performance.now(),
      };
    };

    // Returns true while a move is animating (so the loop keeps drawing).
    const advanceMove = (): boolean => {
      if (!activeMove) {
        if (moveQueue.length === 0) return false;
        beginNextMove();
        if (!activeMove) return false;
      }
      const m = activeMove;
      const p = Math.min(1, (performance.now() - m.t0) / MOVE_MS);
      m.pivot.rotation[m.axis] = m.angle * easeInOutCubic(p);

      if (p >= 1) {
        m.pivot.rotation[m.axis] = m.angle;
        m.pivot.updateMatrixWorld(true);
        m.members.forEach((g) => {
          cubeGroup.attach(g);
          // Snap back onto the integer lattice / axis-aligned orientation so
          // float error can't accumulate over many moves.
          g.position.set(
            Math.round(g.position.x),
            Math.round(g.position.y),
            Math.round(g.position.z),
          );
          snapM.makeRotationFromQuaternion(g.quaternion);
          const e = snapM.elements;
          [0, 1, 2, 4, 5, 6, 8, 9, 10].forEach((i) => (e[i] = Math.round(e[i])));
          g.quaternion.setFromRotationMatrix(snapM);
        });
        cubeGroup.remove(m.pivot);
        activeMove = null;
      }
      pinCenterLabels();
      return true;
    };

    // --- controls + render loop --------------------------------------------
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.12;
    controls.enablePan = false;
    controls.minDistance = 4;
    controls.maxDistance = 20;

    // A new `cube` rebuilds the scene; keep the angle the viewer had set up,
    // so swapping the cube under them doesn't also swing the camera. A real
    // remount (a new `key`) starts the ref empty and so starts head-on.
    if (viewRef.current) {
      camera.position.fromArray(viewRef.current.position);
      controls.target.fromArray(viewRef.current.target);
    }
    controls.addEventListener("change", () => {
      viewRef.current = {
        position: camera.position.toArray(),
        target: controls.target.toArray(),
      };
    });

    // On-demand rendering: draw only when the view actually changes. While
    // damping is still settling, `controls.update()` returns true, so we keep
    // pumping frames until it comes to rest, then stop.
    let raf = 0;
    const renderFrame = () => {
      raf = 0;
      const controlsMoving = controls.update();
      const moveAnimating = advanceMove();
      renderer.render(scene, camera);
      if (controlsMoving || moveAnimating) requestRender();
    };
    const requestRender = () => {
      if (raf === 0) raf = requestAnimationFrame(renderFrame);
    };
    controls.addEventListener("change", requestRender);

    // --- sizing ---------------------------------------------------------
    // Drive the drawing-buffer size from the container's real box. `false`
    // keeps three from writing inline pixel styles onto the canvas (CSS above
    // owns the visual size). Zero sizes are ignored so we never bake in a bad
    // value during initial layout.
    const resize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w === 0 || h === 0) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      requestRender();
    };
    resize();
    controls.update();
    pinCenterLabels();
    renderer.render(scene, camera);

    const ro = new ResizeObserver(resize);
    ro.observe(container);
    // ResizeObserver alone is unreliable on mobile during first layout and on
    // URL-bar show/hide, so also listen on the window.
    window.addEventListener("resize", resize);
    window.addEventListener("orientationchange", resize);
    // Re-check once more after layout settles.
    const kick = requestAnimationFrame(resize);

    // --- tap to paint --------------------------------------------------
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    let downX = 0;
    let downY = 0;
    let downT = 0;

    const onPointerDown = (e: PointerEvent) => {
      downX = e.clientX;
      downY = e.clientY;
      downT = performance.now();
    };
    const onPointerUp = (e: PointerEvent) => {
      const code = paintColorRef.current;
      if (!code) return;
      // Ignore drags (that was an orbit) and long presses.
      if (Math.hypot(e.clientX - downX, e.clientY - downY) > 6) return;
      if (performance.now() - downT > 700) return;

      const rect = renderer.domElement.getBoundingClientRect();
      ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      scene.updateMatrixWorld();
      raycaster.setFromCamera(ndc, camera);
      const hit = raycaster.intersectObjects(stickerMeshes, false)[0];
      if (!hit) return;

      const mesh = hit.object as THREE.Mesh;
      const meta = stickerMeta.get(mesh);
      if (!meta) return;

      const mat = mesh.material as THREE.MeshLambertMaterial;
      if (mat.map) {
        mat.map.dispose();
        mat.map = null;
        mat.needsUpdate = true;
      }
      mat.color.set(hexFor(code));
      work[meta.face][meta.index] = code;
      onFaceletsChangeRef.current?.(cloneFacelets(work));
      requestRender();
    };
    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointerup", onPointerUp);

    // Let the parent know the starting state.
    onFaceletsChangeRef.current?.(cloneFacelets(work));

    // Expose the move driver to the imperative handle.
    applyMoveRef.current = enqueueMove;

    // Redraw every sticker in the current colours. Stickers travel with their
    // cubie, so each one's facelet in `work` still says what it shows.
    recolorRef.current = () => {
      for (const { mesh, face, index, glyph } of allStickers) {
        const mat = mesh.material as THREE.MeshLambertMaterial;
        const hex = hexFor(work[face][index]);
        if (glyph) {
          centerTextures.get(mesh)?.dispose();
          const tex = makeCenterTexture(hex, glyph);
          centerTextures.set(mesh, tex);
          mat.map = tex;
          mat.needsUpdate = true;
        } else {
          mat.color.set(hex);
        }
      }
      requestRender();
    };

    // --- teardown --------------------------------------------------------
    return () => {
      applyMoveRef.current = null;
      recolorRef.current = null;
      if (raf !== 0) cancelAnimationFrame(raf);
      cancelAnimationFrame(kick);
      ro.disconnect();
      window.removeEventListener("resize", resize);
      window.removeEventListener("orientationchange", resize);
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      controls.removeEventListener("change", requestRender);
      controls.dispose();
      renderer.dispose();
      bodyGeo.dispose();
      bodyMat.dispose();
      stickerGeo.dispose();
      stickerMats.forEach((m) => m.dispose());
      centerTextures.forEach((t) => t.dispose());
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [cube, nonce, labelLanguage, overridesKey]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        display: "block",
        position: "relative",
        width: "100%",
        height: "100%",
        minHeight: 240,
        overflow: "hidden",
        touchAction: "none",
      }}
    />
  );
}
