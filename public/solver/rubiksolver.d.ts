/* tslint:disable */
/* eslint-disable */

/**
 * What a fallible call hands back: a [`Status`] (`Ok`, i.e. `0`, on
 * success) and, on success, the result text. `value` is the empty string
 * on failure — and also on a successful zero-move answer, so read
 * `status`, not `value`, to tell the two apart.
 */
export class Reply {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    readonly status: Status;
    readonly value: string;
}

/**
 * Result code of a WebAssembly call: [`Status::Ok`] (`0`) on success,
 * otherwise which kind of [`Error`] it was.
 *
 * The numbers are part of the public API — never renumber a variant, only
 * add new ones. They are grouped by tens: layout parsing, cube legality,
 * drawing a part cube, reading `home` marks, impossible `home` tasks,
 * search limits, bad arguments.
 */
export enum Status {
    Ok = 0,
    WrongRowCount = 1,
    WrongCellCount = 2,
    UnknownColour = 3,
    BadToken = 4,
    WildcardInCube = 5,
    NotSolvable = 10,
    WrongCentre = 20,
    PartialPiece = 21,
    NotAPiece = 22,
    DrawnTwice = 23,
    UnfixableTwist = 24,
    UnfixableFlip = 25,
    UnfixableParity = 26,
    FaceletMismatch = 30,
    SentAndHeld = 31,
    HomeSlotHeld = 32,
    WouldTwistCorner = 40,
    WouldFlipEdge = 41,
    WouldSwapPair = 42,
    Unreachable = 43,
    NoSolution = 50,
    NoMatch = 51,
    OutOfTurns = 52,
    SearchBudget = 53,
    UnknownAlgorithm = 60,
    BadMove = 61,
}

/**
 * The names accepted by [`solve`] / [`transition`], comma-separated.
 */
export function algorithms(): string;

/**
 * Apply a space-separated move sequence (`R U' F2` …) to `layout` and return
 * the resulting layout.
 */
export function apply_moves(layout: string, moves: string): Reply;

/**
 * Turns that send the pieces coloured in `marks` to their home slots while
 * leaving the `=` ones exactly as they are.
 *
 * `marks` is a picture of the cube you are holding, not of the finished one:
 * draw a piece in full where it is now to send it home, `=` a piece to say
 * it is already done, `?` to leave one out. Pieces left out are filled in
 * with something legal, which is harmless — the answer only ever constrains
 * the pieces you drew.
 *
 * Pass an empty `layout` and `marks` doubles as the cube. Give a `layout`
 * and it is the cube instead, with `marks` read against it — the form to use
 * when you already hold a full scramble and want to mark it up. Fails if
 * the marks contradict each other or the cube, if no sequence can exist, or
 * if none was found within `max_turns`.
 */
export function home(layout: string, marks: string, max_turns: number): Reply;

/**
 * Shortest sequence to any state matching `goal`, a layout whose cells may
 * be `?` (don't care) or `=` (don't care about the colour, but keep the
 * piece that is in this slot now right where it is). `max_depth` bounds the
 * search.
 */
export function reach(layout: string, goal: string, max_depth: number): Reply;

/**
 * A full layout for a partly drawn one: the pieces it leaves out are filled
 * into the slots nobody claimed, then twisted, flipped or swapped as needed
 * to make a cube that could actually exist.
 *
 * A layout that already has all 54 stickers comes back untouched. Fails if
 * what was drawn cannot occur on a real cube — a centre out of place, a
 * piece drawn twice, colours no piece carries.
 */
export function realize(layout: string): Reply;

/**
 * The layout a fresh [`scramble_moves`] of `moves` turns lands on. This draws
 * its own random turns; pair the path with its cube via
 * `apply_moves(solved(), scramble_moves(n))` if you need them consistent.
 */
export function scramble(moves: number): string;

/**
 * `moves` random quarter turns with no wasted moves (nothing that cancels or
 * folds into a shorter turn), in notation — the path a solved cube takes to
 * the scrambled state. Uses `Math.random`.
 */
export function scramble_moves(moves: number): string;

/**
 * Shortest sequence (per `algo`) that returns `layout` to solved.
 */
export function solve(layout: string, algo: string): Reply;

/**
 * The solved cube's layout — a handy starting point for a UI.
 */
export function solved(): string;

/**
 * Shortest sequence (per `algo`) taking `from` to `to`.
 */
export function transition(from: string, to: string, algo: string): Reply;

/**
 * [`Status::Ok`] if `layout` is a physically reachable, solvable cube,
 * [`Status::NotSolvable`] if it parses but is not, or the parse error.
 */
export function validate(layout: string): Status;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_reply_free: (a: number, b: number) => void;
    readonly algorithms: () => [number, number];
    readonly apply_moves: (a: number, b: number, c: number, d: number) => number;
    readonly home: (a: number, b: number, c: number, d: number, e: number) => number;
    readonly reach: (a: number, b: number, c: number, d: number, e: number) => number;
    readonly realize: (a: number, b: number) => number;
    readonly reply_status: (a: number) => number;
    readonly reply_value: (a: number) => [number, number];
    readonly scramble: (a: number) => [number, number];
    readonly scramble_moves: (a: number) => [number, number];
    readonly solve: (a: number, b: number, c: number, d: number) => number;
    readonly solved: () => [number, number];
    readonly transition: (a: number, b: number, c: number, d: number, e: number, f: number) => number;
    readonly validate: (a: number, b: number) => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
