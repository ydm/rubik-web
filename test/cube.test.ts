import { beforeAll, describe, expect, it } from "vitest";
import init, * as solverWasm from "../public/solver/rubiksolver.js";
import {
  applyMoveToFacelets,
  BLANK_CUBE,
  FACE_LABELS,
  faceletsToNetString,
  faceletsToVerboseString,
  parseNetString,
  type FaceKey,
} from "@/components/RubiksCube";
import { stickers, wasmBytes } from "./wasm";

beforeAll(async () => {
  await init({ module_or_path: wasmBytes() });
});

/** The WASM API, with `apply_moves` unwrapped to its layout. */
const solver = {
  solved: () => solverWasm.solved(),
  scramble_moves: (n: number) => solverWasm.scramble_moves(n),
  apply_moves: (layout: string, moves: string) => {
    const reply = solverWasm.apply_moves(layout, moves);
    expect(solverWasm.Status[reply.status]).toBe("Ok");
    return reply.value;
  },
};

/** `layout` with `moves` applied through the app's own move model. */
const applyAll = (layout: string, moves: string[]) =>
  faceletsToVerboseString(
    moves.reduce(applyMoveToFacelets, parseNetString(layout)),
  );

const toBg = (move: string) => FACE_LABELS.bg[move[0] as FaceKey] + move.slice(1);

describe("applyMoveToFacelets", () => {
  const moves = ["U", "D", "F", "B", "L", "R"].flatMap((m) => [m, `${m}'`, `${m}2`]);

  it.each(moves)("turns %s the way the solver does, in either notation", (move) => {
    const want = stickers(solver.apply_moves(solver.solved(), move));
    expect(stickers(applyAll(solver.solved(), [move]))).toBe(want);
    expect(stickers(applyAll(solver.solved(), [toBg(move)]))).toBe(want);
  });

  it("follows the solver through random scrambles", () => {
    for (let i = 0; i < 50; i++) {
      const scramble = solver.scramble_moves(20).trim();
      const want = stickers(solver.apply_moves(solver.solved(), scramble));
      expect(stickers(applyAll(solver.solved(), scramble.split(" ").map(toBg)))).toBe(want);
    }
  });

  it("undoes a move with its inverse and four quarter turns", () => {
    const start = solver.apply_moves(solver.solved(), "R U F' L");
    expect(stickers(applyAll(start, ["R", "R'"]))).toBe(stickers(start));
    expect(stickers(applyAll(start, ["Г", "Г", "Г", "Г"]))).toBe(stickers(start));
  });

  it("leaves the cube alone for an unknown move", () => {
    const f = parseNetString(solver.solved());
    expect(applyMoveToFacelets(f, "X")).toBe(f);
  });
});

describe("net strings", () => {
  it("round-trips through both serialisations", () => {
    const f = parseNetString(solver.apply_moves(solver.solved(), "R U F'"));
    expect(parseNetString(faceletsToNetString(f))).toEqual(f);
    expect(parseNetString(faceletsToVerboseString(f))).toEqual(f);
  });

  it("keeps unset stickers", () => {
    const f = parseNetString(BLANK_CUBE);
    expect(f.U).toEqual(["?", "?", "?", "?", "W", "?", "?", "?", "?"]);
  });

  it("rejects a malformed net", () => {
    expect(() => parseNetString("WWW")).toThrow(/expected 9 non-empty lines/);
    const short = BLANK_CUBE.replace("?W?", "?W");
    expect(() => parseNetString(short)).toThrow(/line 2 has 2 colour/);
  });
});
