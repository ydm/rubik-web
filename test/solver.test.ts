import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyMoveToFacelets,
  BLANK_CUBE,
  faceletsToVerboseString,
  parseNetString,
} from "@/components/RubiksCube";
import { wasmBytes } from "./wasm";

type Listener = ((event: { data: unknown }) => void) | null;

/**
 * Stands in for the browser's module `Worker`: runs the real
 * `public/solver-worker.js` in-process against a fake `self`.
 */
class FakeWorker {
  /** Make the next worker fail to load, as if its script 404'd. */
  static failNextLoad = false;
  static created = 0;

  onmessage: Listener = null;
  onerror: ((event: { message: string; preventDefault(): void }) => void) | null = null;
  private handler: Promise<Listener>;

  constructor(url: string, options: WorkerOptions) {
    expect(url).toBe("/solver-worker.js");
    expect(options).toEqual({ type: "module" });
    FakeWorker.created++;
    if (FakeWorker.failNextLoad) {
      FakeWorker.failNextLoad = false;
      this.handler = new Promise(() => {});
      setTimeout(() => this.onerror?.({ message: "404", preventDefault() {} }));
      return;
    }
    const scope: { onmessage: Listener; postMessage: (data: unknown) => void } = {
      onmessage: null,
      postMessage: (data) => this.onmessage?.({ data: structuredClone(data) }),
    };
    vi.stubGlobal("self", scope);
    vi.resetModules();
    this.handler = import("../public/solver-worker.js").then(() => scope.onmessage);
  }

  postMessage(data: unknown) {
    void this.handler.then((onmessage) => onmessage?.({ data: structuredClone(data) }));
  }

  terminate() {}
}

let fetchFails = 0;

beforeEach(() => {
  FakeWorker.failNextLoad = false;
  FakeWorker.created = 0;
  fetchFails = 0;
  vi.stubGlobal("Worker", FakeWorker);
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      if (fetchFails > 0) {
        fetchFails--;
        throw new TypeError("network down");
      }
      return new Response(wasmBytes(), { headers: { "Content-Type": "application/wasm" } });
    }),
  );
  // Fresh copies of `solver.ts` and the WASM glue, so no worker or loaded
  // module carries over from the previous test.
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const loadSolver = () => import("@/lib/solver");

/** Just the centres, in the spaced form the app hands the solver. */
const BLANK = faceletsToVerboseString(parseNetString(BLANK_CUBE));

/** `layout` after `moves`, through the app's own move model. */
const applyAll = (layout: string, moves: string) =>
  faceletsToVerboseString(
    moves.split(" ").filter(Boolean).reduce(applyMoveToFacelets, parseNetString(layout)),
  );

const isSolved = (layout: string) =>
  Object.values(parseNetString(layout)).every((face) => new Set(face).size === 1);

describe("scrambledCube", () => {
  it("returns a layout the scramble actually leads to", async () => {
    const { scrambledCube } = await loadSolver();
    const { layout, scramble } = await scrambledCube(20);
    expect(scramble.split(" ")).toHaveLength(20);
    expect(isSolved(layout)).toBe(false);
    // Walking the scramble back must land on a solved cube.
    const undo = scramble
      .split(" ")
      .reverse()
      .map((m) => (m.endsWith("'") ? m[0] : `${m}'`))
      .join(" ");
    expect(isSolved(applyAll(layout, undo))).toBe(true);
  });
});

describe("homeSolve", () => {
  it("finds the shortest answer for a near-solved cube", async () => {
    const { homeSolve, scrambledCube } = await loadSolver();
    const { layout: solved } = await scrambledCube(0);
    const near = applyAll(solved, "R U F'");
    expect(await homeSolve(near)).toBe("F U' R'");
  });

  it("falls back to a full solver for a fully painted, well-scrambled cube", async () => {
    const { homeSolve, scrambledCube } = await loadSolver();
    const { layout } = await scrambledCube(20);
    const solution = await homeSolve(layout);
    expect(solution.length).toBeGreaterThan(0);
    expect(isSolved(applyAll(layout, solution))).toBe(true);
  });

  it("reports nothing to do for a cube with only its centres", async () => {
    const { homeSolve } = await loadSolver();
    expect(await homeSolve(BLANK)).toBe("");
  });

  /** `BLANK_CUBE` with some stickers painted: `[face, index, colour]`. */
  const painted = (...cells: [keyof ReturnType<typeof parseNetString>, number, string][]) => {
    const f = parseNetString(BLANK_CUBE);
    for (const [face, index, colour] of cells) f[face][index] = colour;
    return faceletsToVerboseString(f);
  };

  it("names a piece that doesn't exist", async () => {
    const { homeSolve, SolverError } = await loadSolver();
    // A white-yellow edge doesn't exist.
    const err = await homeSolve(painted(["U", 7, "W"], ["F", 1, "Y"])).catch((e) => e);
    expect(err).toBeInstanceOf(SolverError);
    expect(err).toMatchObject({ status: "NotAPiece", code: 22 });
  });

  it("names a half-painted piece", async () => {
    const { homeSolve } = await loadSolver();
    await expect(homeSolve(painted(["F", 1, "W"]))).rejects.toMatchObject({
      status: "PartialPiece",
      code: 21,
    });
  });

  it("solves a flipped edge once both halves are painted", async () => {
    const { homeSolve } = await loadSolver();
    expect(await homeSolve(painted(["F", 1, "W"], ["U", 7, "G"]))).toBe("F R U");
  });

  it("doesn't fall back for an impossible full cube", async () => {
    const { homeSolve, scrambledCube } = await loadSolver();
    const { layout } = await scrambledCube(0);
    // Swap two stickers of a solved cube: every colour still appears 9 times,
    // but no turning produces it.
    const f = parseNetString(layout);
    [f.U[0], f.D[8]] = [f.D[8], f.U[0]];
    await expect(homeSolve(faceletsToVerboseString(f))).rejects.toMatchObject({
      status: "NotSolvable",
      code: 10,
    });
  });
});

describe("recovering from load failures", () => {
  it("retries the WASM download after it fails", async () => {
    const { homeSolve } = await loadSolver();
    fetchFails = 1;
    await expect(homeSolve(BLANK)).rejects.toThrow(/network down/);
    expect(await homeSolve(BLANK)).toBe("");
    expect(FakeWorker.created).toBe(1);
  });

  it("starts a new worker after the worker script fails to load", async () => {
    const { homeSolve } = await loadSolver();
    FakeWorker.failNextLoad = true;
    await expect(homeSolve(BLANK)).rejects.toThrow(/404/);
    expect(await homeSolve(BLANK)).toBe("");
    expect(FakeWorker.created).toBe(2);
  });
});

describe("the worker", () => {
  it("refuses to call anything outside the solver's API", async () => {
    const { scrambledCube } = await loadSolver();
    await scrambledCube(1); // warm up so `self.onmessage` is installed
    const replies: unknown[] = [];
    const scope = globalThis.self as unknown as {
      onmessage: (e: { data: unknown }) => Promise<void>;
      postMessage: (d: unknown) => void;
    };
    scope.postMessage = (d) => replies.push(d);
    await scope.onmessage({ data: { id: 7, fn: "default", args: [] } });
    expect(replies).toEqual([{ id: 7, error: "unknown solver function: default" }]);
  });

  it("posts a Reply as plain status + value, and a plain string as Ok", async () => {
    const { scrambledCube } = await loadSolver();
    await scrambledCube(1);
    const replies: unknown[] = [];
    const scope = globalThis.self as unknown as {
      onmessage: (e: { data: unknown }) => Promise<void>;
      postMessage: (d: unknown) => void;
    };
    scope.postMessage = (d) => replies.push(d);
    await scope.onmessage({ data: { id: 1, fn: "apply_moves", args: ["nope", "R"] } });
    await scope.onmessage({ data: { id: 2, fn: "scramble_moves", args: [0] } });
    expect(replies).toEqual([
      { id: 1, status: "BadToken", code: 4, value: "" },
      { id: 2, status: "Ok", code: 0, value: "" },
    ]);
  });
});
