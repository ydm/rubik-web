/**
 * Client for the WASM cube solver in `public/solver/`.
 *
 * Those files are static assets, not part of the bundle. The solver's calls are
 * synchronous and a search can take a second or more, so it runs in a module
 * worker (`public/solver-worker.js` — kept outside the wasm-pack output folder
 * so a solver rebuild leaves it alone) and every call here is a message round
 * trip to it.
 *
 * The solver's layout string is the same 9-row format `faceletsToVerboseString`
 * produces (letters `W O G R B Y`, `|` and spacing ignored), so cube state can
 * be handed straight to it.
 *
 * The solver doesn't throw: a call that can fail returns a status, named after
 * its `Status` enum (see `public/solver/API.md`). Here a failed status becomes
 * a `SolverError` carrying that name.
 */

import { withBasePath } from "@/lib/site";

type SolverFn = "home" | "solve" | "apply_moves" | "scramble_moves" | "solved";

/** Every failure status the solver defines (API.md, "Status codes"). */
export const SOLVER_STATUSES = [
  // Layout parsing
  "WrongRowCount",
  "WrongCellCount",
  "UnknownColour",
  "BadToken",
  "WildcardInCube",
  // Cube legality
  "NotSolvable",
  // Drawing a partial cube
  "WrongCentre",
  "PartialPiece",
  "NotAPiece",
  "DrawnTwice",
  "UnfixableTwist",
  "UnfixableFlip",
  "UnfixableParity",
  // Reading `home` marks
  "FaceletMismatch",
  "SentAndHeld",
  "HomeSlotHeld",
  // Impossible `home` tasks
  "WouldTwistCorner",
  "WouldFlipEdge",
  "WouldSwapPair",
  "Unreachable",
  // Search limits
  "NoSolution",
  "NoMatch",
  "OutOfTurns",
  "SearchBudget",
  // Bad arguments
  "UnknownAlgorithm",
  "BadMove",
] as const;

export type SolverStatus = (typeof SOLVER_STATUSES)[number];

/** A solver call that came back with a failure status. */
export class SolverError extends Error {
  constructor(
    /** The solver's status name, e.g. `"PartialPiece"`. A code newer than
     *  this app arrives as `"Unknown"`. */
    readonly status: SolverStatus | "Unknown",
    /** The status number, stable across solver versions. */
    readonly code: number,
  ) {
    super(`solver status ${status} (${code})`);
    this.name = "SolverError";
  }
}

type WorkerReply =
  | { id: number; status: SolverStatus | "Ok" | "Unknown"; code: number; value: string }
  | { id: number; error: string };

const WORKER_URL = withBasePath("/solver-worker.js");

let worker: Worker | null = null;
let nextId = 0;
const pending = new Map<
  number,
  { resolve: (value: string) => void; reject: (err: Error) => void }
>();

function getWorker(): Worker {
  if (worker) return worker;
  const w = new Worker(WORKER_URL, { type: "module" });
  w.onmessage = ({ data }: MessageEvent<WorkerReply>) => {
    const call = pending.get(data.id);
    if (!call) return;
    pending.delete(data.id);
    if ("error" in data) call.reject(new Error(data.error));
    else if (data.status === "Ok") call.resolve(data.value);
    else call.reject(new SolverError(data.status, data.code));
  };
  // The worker script itself failed (e.g. it couldn't be fetched): fail what
  // is waiting on it and start a fresh worker on the next call.
  w.onerror = (event) => {
    event.preventDefault();
    w.terminate();
    if (worker === w) worker = null;
    const err = new Error(event.message || "the solver failed to load");
    for (const call of pending.values()) call.reject(err);
    pending.clear();
  };
  worker = w;
  return w;
}

function call(fn: SolverFn, ...args: (string | number)[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });
    try {
      getWorker().postMessage({ id, fn, args });
    } catch (err) {
      pending.delete(id);
      reject(err instanceof Error ? err : new Error(String(err)));
    }
  });
}

/**
 * Shortest sequence sending every coloured facelet in `marks` home; `?`
 * cells are ignored, so a partly painted cube works fine (`""` = nothing to
 * do). Throws a `SolverError` if the marks contradict each other or the
 * cube, or if no sequence is found within `maxTurns`.
 *
 * `home` gives up on a well-scrambled cube (`SearchBudget` / `OutOfTurns`), so
 * once every sticker is painted in, fall back to the Kociemba solver, which
 * handles any full cube in ~30 turns.
 */
export async function homeSolve(
  marks: string,
  maxTurns = 40,
): Promise<string> {
  try {
    return (await call("home", "", marks, maxTurns)).trim();
  } catch (err) {
    const searchRanOut =
      err instanceof SolverError &&
      (err.status === "SearchBudget" || err.status === "OutOfTurns");
    if (!searchRanOut || marks.includes("?")) throw err;
    return (await call("solve", marks, "kociemba")).trim();
  }
}

/**
 * A fresh scramble: `turns` random quarter turns applied to a solved cube.
 * Returns the resulting layout string (feed straight to `<RubiksCube cube>`)
 * and the scramble sequence that produced it.
 */
export async function scrambledCube(
  turns = 20,
): Promise<{ layout: string; scramble: string }> {
  const scramble = (await call("scramble_moves", turns)).trim();
  const layout = await call("apply_moves", await call("solved"), scramble);
  return { layout, scramble };
}
