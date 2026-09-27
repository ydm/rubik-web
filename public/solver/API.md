# WebAssembly API

The functions exported by `src/wasm.rs` (via `wasm-bindgen`), as seen from
JavaScript after `wasm-pack build --target web`.

```js
import init, * as rubiksolver from './pkg/rubiksolver.js';
await init();                       // load + instantiate the .wasm, once

const { Status } = rubiksolver;
const r = rubiksolver.solve(rubiksolver.scramble(20), 'kociemba');
if (r.status === Status.Ok) console.log(r.value);        // "R U' F ..."
else console.log('failed:', Status[r.status]);          // e.g. "NoSolution"
```

All calls are **synchronous** once `init()` has resolved. Rust `usize`
parameters are plain `number`s; every string is UTF-8.

Nothing throws for bad input. A function that can fail returns a
[`Reply`](#results-and-status-codes) (or, for `validate`, a bare
[`Status`](#status-codes)) whose status is `0` on success and names the error
otherwise.

## Functions

| Function | Signature (TS) | Description |
|---|---|---|
| `solved` | `() => string` | The solved cube as a [layout](#layout-format). Handy UI starting point. Cannot fail. |
| `algorithms` | `() => string` | Comma-separated [solver names](#algorithms) valid for `algo`. Read this instead of hardcoding the list. Cannot fail. |
| `validate` | `(layout: string) => Status` | `Ok` if `layout` is a physically reachable, solvable cube: centres in place, colour counts, real cubies (a corner in mirror-image order is not one), and the twist/flip/parity laws. `NotSolvable` if it parses but is not; a [parse status](#status-codes) if it does not parse. |
| `realize` | `(layout: string) => Reply` | `value`: a full layout for a partly drawn [one](#wildcards). Pieces left out go into the slots nobody claimed, then get twisted, flipped or swapped as needed to make a cube that could exist. A layout already carrying 54 stickers comes back untouched. |
| `solve` | `(layout: string, algo: string) => Reply` | `value`: move sequence (per `algo`) returning `layout` to solved, in [notation](#move-notation). |
| `transition` | `(from: string, to: string, algo: string) => Reply` | `value`: sequence (per `algo`) taking cube `from` to cube `to`. |
| `reach` | `(layout: string, goal: string, max_depth: number) => Reply` | `value`: shortest sequence to **any** state matching `goal`, a picture of the [finished cube](#two-kinds-of-goal-file) that may use the [wildcards](#wildcards) `?` and `=`. `max_depth` bounds the search. |
| `home` | `(layout: string, marks: string, max_turns: number) => Reply` | `value`: shortest sequence sending the pieces coloured in `marks` to their **home slots**, leaving the `=` ones exactly as they are. `marks` pictures the [cube you are holding](#two-kinds-of-goal-file); pass `""` for `layout` and it doubles as the cube. |
| `apply_moves` | `(layout: string, moves: string) => Reply` | `value`: the layout after applying a space-separated move sequence (`R U' F2` …) to `layout`. |
| `scramble_moves` | `(moves: number) => string` | `moves` random quarter turns in notation: the path a solved cube takes to a scrambled state. No wasted moves (nothing that cancels or folds shorter). Uses `Math.random`. Cannot fail. |
| `scramble` | `(moves: number) => string` | The layout that `moves` random quarter turns land on. Draws its **own** randomness; for a matching path/cube pair use `apply_moves(solved(), scramble_moves(n)).value`. Cannot fail. |

Which statuses each function can return is listed [below](#which-function-returns-what).

Anywhere a **cube** is expected, a layout with `?` or `=` cells is only
accepted by `home`. The other functions want all 54 stickers.

## Results and status codes

### `Reply`

```ts
class Reply {
  readonly status: Status;  // Status.Ok (0) on success
  readonly value: string;   // the result on success, "" on failure
  free(): void;             // optional: releases it now instead of at GC
}
```

Read `status` first. `value` is `""` on **any** failure, and it is also `""`
for a successful zero-move answer (an already solved cube through `solve`, a
goal already satisfied through `reach`), so the empty string alone does not
tell you which. Count moves with `v ? v.split(' ').length : 0`, since
`''.split(' ')` is `['']`.

A `Reply` is not a string. Pass `reply.value` on to the next call, never the
`Reply` itself: the generated glue does not check argument types, and handing
an object to a `string` parameter can crash the call with a WebAssembly
`RuntimeError` instead of returning a status.

A `Reply` lives in WebAssembly memory. The glue frees it when the JS object is
garbage-collected (via `FinalizationRegistry`), so calling `free()` is only
needed if you want the memory back sooner.

### Status codes

`Status` is exported as a frozen object that maps both ways:
`Status.NoSolution === 50` and `Status[50] === 'NoSolution'`. Compare against
the names, not the numbers. The numbers are stable, though: new codes only
ever get added, and existing ones are never renumbered.

| Code | Name | Meaning |
|---:|---|---|
| **0** | `Ok` | Success. For a `Reply`, `value` holds the result. |
| | ***Layout parsing*** | |
| 1 | `WrongRowCount` | The layout does not have exactly 9 non-empty rows. |
| 2 | `WrongCellCount` | A row has the wrong number of cells: 3 for the U and D rows, 12 for the four middle rows (`\|` separators don't count). |
| 3 | `UnknownColour` | A one-character cell that is not `W O G R B Y`, `?` or `=`, e.g. a lower-case `w`. |
| 4 | `BadToken` | A cell longer than one character, e.g. `WW` or `nope`, usually a missing space. Cells are read before rows are counted, so a garbled layout reports this in preference to 1 or 2. |
| 5 | `WildcardInCube` | A `?` or `=` cell in a layout that has to be a full cube. |
| | ***Cube legality*** | |
| 10 | `NotSolvable` | A full 54-sticker cube that no amount of turning could produce: a centre out of place (the cube is turned over), wrong colour counts, stickers that form no real piece (including a mirror-image corner), or a broken twist/flip/parity law. |
| | ***Drawing a partial cube*** (`realize`, and the cube side of `home`) | |
| 20 | `WrongCentre` | A centre drawn in a colour it can never show. Centres never move: U is W, D is Y, F is G, B is B, L is O, R is R. |
| 21 | `PartialPiece` | Only some of a piece's stickers are coloured in. `realize` needs every sticker of a piece, or none. |
| 22 | `NotAPiece` | A piece's colours match no real piece, e.g. white with yellow, or a corner's colours in mirror-image order. For `home`, this is a piece written out in full. |
| 23 | `DrawnTwice` | The same piece is drawn in two different slots. |
| 24 | `UnfixableTwist` | The corners drawn are twisted in a way no cube can be, and no undrawn corner is left to cancel it. |
| 25 | `UnfixableFlip` | The edges drawn are flipped in a way no cube can be, and no undrawn edge is left to cancel it. |
| 26 | `UnfixableParity` | The pieces drawn would need a single pair swapped, and there are not two undrawn pieces of one kind to absorb it. |
| | ***Reading `home` marks*** | |
| 30 | `FaceletMismatch` | A partly coloured piece shows a colour that the cube does not have there. Colour it where it really sits, or write out all its stickers so that it is found wherever it is. |
| 31 | `SentAndHeld` | A piece is coloured in to go home and also held with `=` somewhere else. |
| 32 | `HomeSlotHeld` | A piece's home slot is held with `=` by a different piece. |
| | ***Impossible `home` tasks*** (proved impossible at any length, so a larger `max_turns` will not help) | |
| 40 | `WouldTwistCorner` | The only arrangement satisfying the marks leaves one corner twisted in place. Release a held piece. |
| 41 | `WouldFlipEdge` | The only arrangement satisfying the marks leaves one edge flipped in place. Release a held piece. |
| 42 | `WouldSwapPair` | The only arrangement satisfying the marks swaps two pieces and moves nothing else. Release a held piece. |
| 43 | `Unreachable` | Every arrangement the tracked pieces can reach was tried, and none matched. |
| | ***Search limits*** (nothing found, though a larger limit might find something) | |
| 50 | `NoSolution` | `solve`/`transition`: the chosen solver found nothing within its built-in reach (see [Algorithms](#algorithms)). Try `kociemba`. |
| 51 | `NoMatch` | `reach`: no match within `max_depth` turns. |
| 52 | `OutOfTurns` | `home`: nothing within `max_turns` turns. |
| 53 | `SearchBudget` | `home`: gave up at its internal memory ceiling before reaching `max_turns`. Holding fewer pieces leaves more room. |
| | ***Bad arguments*** | |
| 60 | `UnknownAlgorithm` | `algo` is not one of [`algorithms()`](#algorithms). |
| 61 | `BadMove` | A move token is not a face letter `U D F B L R` optionally followed by `'` or `2`. The prime is the ASCII apostrophe; a typographic `’` is a bad move. |

### Which function returns what

Besides `Ok`:

| Function | Possible statuses |
|---|---|
| `validate` | 1–5 (`layout` doesn't parse), 10 |
| `realize` | 1–4, 20–26 |
| `solve` | 1–5, 60, 10, 50 |
| `transition` | 1–5, 60, 10, 50 |
| `reach` | 1–5 (`layout` or `goal`), 51 |
| `home` | 1–4 (`marks` or `layout`); 20–26 (whichever of them draws the cube); 10; 20, 22, 30–32 (reading the marks); 40–43; 52, 53 |
| `apply_moves` | 1–5, 61 |

`reach` accepts any 54-sticker `layout`, including one that `validate` would
reject; the pattern search does not need a real cube. `solve` checks
`layout` before it runs anything, so an impossible cube gets `NotSolvable`
straight away and never waits on a search. For `transition`, `NotSolvable`
means that nothing was found and at least one end is not a real cube. When
several problems exist, the first check to fail decides the code, in the order
given per row.

## Examples

Every result below is what the current build actually returns. Layouts are
written with `L()` standing in for the nine-row text, to keep the snippets
short:

```js
import init, * as rubiksolver from './pkg/rubiksolver.js';
await init();

const { Status } = rubiksolver;
const L = (...rows) => rows.join('\n');
```

A `Reply` is shown here as `{status, value}`, the two fields you read off it.

### Reading and building cubes

```js
rubiksolver.solved();
// "         W W W\n         W W W\n         W W W\n O O O | G G G | ... "

rubiksolver.algorithms();
// "bidirectional-bfs,bfs,iddfs,ida*,thistlethwaite,kociemba"

rubiksolver.validate(rubiksolver.solved());   // Status.Ok (0)
rubiksolver.validate(oneCornerTwisted);  // Status.NotSolvable (10): 54 real stickers, no cube looks like it
rubiksolver.validate(cornerMirrored);    // Status.NotSolvable (10): URF reading W/G/R instead of W/R/G
rubiksolver.validate('nope');            // Status.BadToken (4)

rubiksolver.apply_moves(rubiksolver.solved(), "R U' F2");   // {status: 0, value: <the layout you land on>}
rubiksolver.apply_moves(rubiksolver.solved(), "R U’");      // {status: Status.BadMove (61), value: ""}
```

### Filling in a partly drawn cube

```js
const marks = L(
  '         ? ? ?',
  '         ? W ?',
  '         ? ? ?',
  ' ? ? ? | ? ? ? | ? ? ? | ? ? ?',
  ' ? O ? | ? G ? | ? R ? | ? B ?',
  ' ? W ? | ? ? ? | ? ? ? | ? ? ?',
  '         ? ? ?',
  '         G Y ?',
  '         ? ? ?',
);

rubiksolver.realize(marks);   // {status: 0, value: <a full layout with that edge at DL>}

rubiksolver.realize(marks.replace(' ? W ? |', ' ? ? ? |'));
// {status: Status.PartialPiece (21), value: ""}: only one of DL's two stickers drawn
```

### Solving

```js
const scrambled = rubiksolver.apply_moves(rubiksolver.solved(), "R U R' U' F'").value;

rubiksolver.solve(scrambled, 'bidirectional-bfs').value;   // "F U R U' R'"   (optimal)
rubiksolver.solve(scrambled, 'kociemba').value;            // "F U R U' R R R" (fast, not optimal)
rubiksolver.solve(rubiksolver.solved(), 'kociemba');            // {status: 0, value: ""}: already there
rubiksolver.solve(scrambled, 'dijkstra');                  // {status: Status.UnknownAlgorithm (60), value: ""}

const target = rubiksolver.apply_moves(rubiksolver.solved(), 'R U').value;
rubiksolver.transition(rubiksolver.solved(), target, 'bidirectional-bfs').value;   // "R U"
```

Note the two solvers on the same cube: `bidirectional-bfs` finds the shortest
sequence, `kociemba` finds one instantly whatever the scramble. Neither is
wrong; they answer different questions.

### `reach`: a goal stated as the finished cube

```js
const goal = L(
  '         ? ? ?',
  '         ? ? ?',
  '         ? ? G',                        // green here when you are done
  ' ? ? ? | ? ? ? | ? ? ? | ? ? ?',
  ' ? ? ? | ? ? ? | ? ? ? | ? ? ?',
  ' = = = | = = = | = = = | = = =',        // and the bottom layer untouched
  '         = = =',
  '         = = =',
  '         = = =',
);

rubiksolver.reach(rubiksolver.solved(), goal, 7).value;    // "L U B L' B' L' U"
rubiksolver.reach(rubiksolver.solved(), goal, 6).status;   // Status.NoMatch (51)
```

Replace the `=` cells with `?` and the answer collapses to a single `R`, which
gets green up there by dragging a bottom-layer corner along with it.

`=` is strict about orientation, and that is what costs the seventh turn.
`F' U F R U R'` puts green in place in six and returns every bottom-layer
piece to its own slot. But it leaves the DFR corner twisted where it stands,
so it does not qualify.

### `home`: a goal stated as "put this where it belongs"

Same `marks` as above: the white-green edge drawn where it currently sits.

```js
rubiksolver.home('', marks, 12).value;                         // "L' F": the marks are the cube
rubiksolver.home(rubiksolver.realize(marks).value, marks, 12).value;  // "L' F": same, cube given separately
rubiksolver.home('', marks, 1).status;                         // Status.OutOfTurns (52)
```

To show the cube it filled in, or to check the answer, chain the three:

```js
const before = rubiksolver.realize(marks);
const found  = rubiksolver.home('', marks, 12);
if (before.status === Status.Ok && found.status === Status.Ok) {
  const after = rubiksolver.apply_moves(before.value, found.value).value;
}
```

`web/index.html` does exactly this; see its second panel.

### Scrambling

Both draw on `Math.random`, so these vary run to run:

```js
rubiksolver.scramble_moves(8);   // e.g. "F L' R' B' R R U R"
rubiksolver.scramble(8);         // the layout eight random turns land on

// For a path and cube that match each other:
const path = rubiksolver.scramble_moves(20);
const cube = rubiksolver.apply_moves(rubiksolver.solved(), path).value;
```


## Algorithms

`solve` and `transition` take one of these by name. The first four are plain
graph searches: optimal, but they only see a few turns out, so they are for
short scrambles and teaching, not for a cube off a table.

| `algo` | Reach | Notes |
|---|---|---|
| `bidirectional-bfs` | ~8 turns | Meet-in-the-middle, 4 plies per side. Optimal. |
| `bfs` | 5 turns | One-directional, hits memory first. Optimal. |
| `iddfs` | 6 turns | O(depth) memory. Optimal. |
| `ida*` | 6 turns | IDDFS plus a mismatched-sticker heuristic. Optimal. |
| `thistlethwaite` | any cube | Four-phase subgroup descent, ~35-60 quarter turns. Instant. |
| `kociemba` | any cube | Two-phase, ~25-35 quarter turns. The one to default to. |

Both full solvers build pruning tables on first use — a moment's pause on the
first call, then cached for the life of the page.

## Layout format

Nine whitespace-separated rows, letters `W O G R B Y` (Up/Left/Front/Right/Back/Down
centre colours). `|` column separators and exact spacing are ignored on input.

```
         W W W
         W W W
         W W W
 O O O | G G G | R R R | B B B
 O O O | G G G | R R R | B B B
 O O O | G G G | R R R | B B B
         Y Y Y
         Y Y Y
         Y Y Y
```

Rows 1-3 are the U face, rows 4-6 are `L | F | R | B`, rows 7-9 are D.

### Wildcards

Only the goal files of `reach` and `home` accept these; every other function
wants 54 colour letters.

| Cell | Means |
|---|---|
| `?` | ignore this facelet entirely |
| `=` | leave the piece this facelet belongs to **exactly** as it is: same slot, same way up |
| `W O G R B Y` | `reach`: end up showing this colour here. `home`: this is a piece on the cube as it looks now — send it home |

`=` marks a whole piece, not a facelet, so one sticker of a corner is enough;
on a centre it is a no-op, since centres never move. It constrains the
**finished** cube only — a sequence is free to swing a held piece out of the
way and bring it back, which is how conjugates and commutators work at all.

## Two kinds of goal file

Both functions take a 9-row layout, but they read it against opposite ends of
the job. Getting them the wrong way round is the easy mistake to make.

|  | `reach(layout, goal, …)` | `home(layout, marks, …)` |
|---|---|---|
| The file pictures | the **finished** cube | the cube you are **holding** |
| A colour cell says | "this facelet must read G when you're done" | "the piece here looks like this — put it where it belongs" |
| You must know | where the piece goes and which way round | nothing; just copy what you see |
| Wrong colours are | simply a different goal | a typo, and reported as one |

Worked calls for both are under [Examples](#examples).

`reach` searches by iterative deepening, so `max_depth` is the thing to watch:
each extra turn costs about ten times the last. A goal with no match at all
takes the full sweep — in a release build roughly 0.06 s at depth 6, 0.6 s at
7, 6 s at 8. Past ~9, use a real solver instead.

`home` searches from both ends at once, so it reaches much further for the
same limit — a dozen turns in well under a second while the pieces held number
seven or eight. Hold most of the cube and the answers grow with it; past
roughly 12 turns it stops at an internal memory ceiling (a few hundred MB)
rather than grinding (`SearchBudget`). Its three ways of failing are three
distinct groups of [status codes](#status-codes): the marks contradict each
other (30s), no sequence can exist at all because the arithmetic of twists,
flips and swaps rules it out (40s), or none was found before the limit
(`OutOfTurns`, `SearchBudget`).

## Move notation

Space-separated tokens: a face letter `U D F B L R`, optionally suffixed with
`'` (counter-clockwise) or `2` (half turn). Example: `R U' F2 D L' B`.
`solve`/`transition`/`reach`/`home`/`scramble_moves` emit quarter turns only
(`R`, `R'`); `apply_moves` also accepts `R2`.
Prime is the ASCII apostrophe `'`; a typographic `’` (or any other token)
is a bad move, and `apply_moves` returns `Status.BadMove`.
