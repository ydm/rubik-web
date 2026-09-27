"use client";

import { useEffect, useRef, useState } from "react";
import RubiksCube, {
  applyMoveToFacelets,
  BLANK_CUBE,
  FACE_LABELS,
  faceletsToVerboseString,
  MOVES,
  NEUTRAL_COLOR,
  parseNetString,
  type FaceKey,
  type Facelets,
  type RubiksCubeHandle,
} from "@/components/RubiksCube";
import InstructionsPanel from "@/components/InstructionsPanel";
import MiniCube from "@/components/MiniCube";
import SideNames from "@/components/SideNames";
import {
  FACE_CODE,
  FACE_COLOUR_OPTIONS,
  schemeColors,
  useFaceScheme,
} from "@/lib/faceColours";
import {
  loadDailyScramble,
  saveDailyScramble,
  todayKey,
} from "@/lib/dailyMission";
import { homeSolve, scrambledCube } from "@/lib/solver";
import { solverErrorMessage } from "@/lib/solverMessages";
import { stepBoxClass } from "@/components/StepBox";

type Mode = "solve" | "challenge" | "quickest" | "instructions";

/** `BLANK_CUBE`, in the same verbose form `faceletsToVerboseString` produces
 *  — lets `handleSolve` tell "nothing painted" from an actual solved cube. */
const BLANK_MARKS = faceletsToVerboseString(parseNetString(BLANK_CUBE));

/** Sticker letter -> the face whose colour it stands for. */
const FACE_OF_CODE = Object.fromEntries(
  (Object.entries(FACE_CODE) as [FaceKey, string][]).map(([face, code]) => [
    code,
    face,
  ]),
) as Record<string, FaceKey>;

const COLOUR_NAME = Object.fromEntries(
  FACE_COLOUR_OPTIONS.map((o) => [o.id, o.name]),
);

/**
 * Rewrite a Latin move sequence (`F D U R'`) into the same Bulgarian letters
 * shown on the centre stickers, keeping `'` / `2` suffixes.
 */
function toBgNotation(sequence: string): string {
  return sequence
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => {
      const face = token[0].toUpperCase() as FaceKey;
      return (FACE_LABELS.bg[face] ?? token[0]) + token.slice(1);
    })
    .join(" ");
}

/** The move that undoes `token` (`R` <-> `R'`; a half turn undoes itself). */
function invertMove(token: string): string {
  if (token.endsWith("'")) return token.slice(0, -1);
  if (token.endsWith("2")) return token;
  return `${token}'`;
}

/**
 * The layout a sequence passes through: `states[i]` is `base` with the first
 * `i` moves applied, so `states[0]` is `base` itself.
 */
function moveStates(base: Facelets, moves: string[]): string[] {
  const states = [faceletsToVerboseString(base)];
  let f = base;
  for (const move of moves) {
    f = applyMoveToFacelets(f, move);
    states.push(faceletsToVerboseString(f));
  }
  return states;
}

/** A Мисия scramble: the moves, the layouts they pass through, and where the
 *  cube currently stands among them. */
type Scramble = {
  /** The day this is the puzzle for (`todayKey`). */
  date: string;
  /** The layout the cube is built from. */
  layout: string;
  /** The scramble, move by move. */
  steps: string[];
  /** `states[i]` = the layout after `steps[0..i)`; `states[0]` is solved. */
  states: string[];
  /** Which step the cube stands on, or -1 once hand turns have left the path. */
  index: number;
  /** The layout the cube is showing right now. */
  state: string;
};

/**
 * Today's scramble, worked out in full before anything renders it: the one
 * stored for today if there is one, otherwise a fresh roll, stored for the
 * rest of the day. `fresh` rolls a new one regardless, replacing today's.
 */
async function dailyScramble(fresh = false): Promise<Scramble> {
  const date = todayKey();
  let today = fresh ? null : loadDailyScramble(date);
  if (!today) {
    today = await scrambledCube(20);
    saveDailyScramble(date, today);
  }
  const { layout, scramble } = today;
  const steps = toBgNotation(scramble).split(" ");
  // The scramble runs solved -> layout, so walk it back from the layout to
  // recover the solved cube, then forward again to collect every state.
  let start = parseNetString(layout);
  for (let i = steps.length - 1; i >= 0; i--) {
    start = applyMoveToFacelets(start, invertMove(steps[i]));
  }
  const states = moveStates(start, steps);
  return {
    date,
    layout,
    steps,
    states,
    index: steps.length,
    state: states[steps.length],
  };
}

/**
 * A bold chevron for the step arrows. Drawn symmetrically about the centre of
 * its viewBox, and as tall as a step's text line, so it sits dead centre in a
 * box sized like the steps.
 */
function Chevron({ dir }: { dir: "left" | "right" }) {
  return (
    <svg
      viewBox="0 0 12 20"
      aria-hidden="true"
      className="block h-5 w-3"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={dir === "left" ? "M9 4 3 10l6 6" : "M3 4l6 6-6 6"} />
    </svg>
  );
}

/**
 * A move sequence as a row of clickable steps, with arrows for one at a time.
 * The step whose stored layout the cube is actually showing lights up; turn the
 * cube any other way and nothing does.
 */
function StepTrail({
  steps,
  states,
  current,
  index,
  onGo,
}: {
  steps: string[];
  /** `states[i]` = the layout after `steps[0..i)`. */
  states: string[];
  /** The layout the cube is showing right now. */
  current: string;
  /** Where along the sequence the cube stands, or -1 if it wandered off. */
  index: number;
  onGo: (target: number) => void;
}) {
  // Which state the cube is showing, 0 being "before the first move", or -1
  // when it is showing something the sequence never passes through.
  // Prefer the tracked position, in case the sequence passes a layout twice.
  const at =
    current === ""
      ? -1
      : index >= 0 && states[index] === current
        ? index
        : states.indexOf(current);
  // Keep the step the cube stands on in the middle of the trail, so stepping
  // with the arrows slides the trail along instead of running off its edge.
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const list = listRef.current;
    const crumb = index >= 0 ? list?.children[index] : undefined;
    if (!list || !crumb) return;
    const listBox = list.getBoundingClientRect();
    const crumbBox = crumb.getBoundingClientRect();
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    list.scrollTo({
      left:
        list.scrollLeft +
        (crumbBox.left - listBox.left) +
        crumbBox.width / 2 -
        list.clientWidth / 2,
      behavior: reduce ? "auto" : "smooth",
    });
  }, [index, steps]);
  return (
    <div className="flex w-fit max-w-full items-center gap-1.5">
      <button
        type="button"
        aria-label="Предишна стъпка"
        disabled={index <= 0}
        onClick={() => onGo(index - 1)}
        className={`${stepBoxClass(true)} disabled:opacity-25`}
      >
        <Chevron dir="left" />
      </button>
      <div
        ref={listRef}
        className="flex min-w-0 touch-pan-x items-center gap-1.5 overflow-x-auto"
      >
        <button
          type="button"
          onClick={() => onGo(0)}
          className={stepBoxClass(at === 0)}
        >
          Начало
        </button>
        {steps.map((step, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onGo(i + 1)}
            className={`font-mono ${stepBoxClass(at === i + 1)}`}
          >
            {step}
          </button>
        ))}
      </div>
      <button
        type="button"
        aria-label="Следваща стъпка"
        disabled={index < 0 || index >= steps.length}
        onClick={() => onGo(index + 1)}
        className={`${stepBoxClass(true)} disabled:opacity-25`}
      >
        <Chevron dir="right" />
      </button>
    </div>
  );
}

const TABS: { id: Mode; label: string; icon: React.ReactNode }[] = [
  {
    id: "solve",
    label: "Нареди",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <path d="M12 2.5 21 7v10l-9 4.5L3 17V7z" strokeLinejoin="round" />
        <path d="M12 2.5v19M3 7l9 4.5M21 7l-9 4.5" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: "challenge",
    label: "Мисия",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <rect x="3" y="4.5" width="18" height="16" rx="2" />
        <path d="M3 9.5h18M8 2.5v4M16 2.5v4" strokeLinecap="round" />
      </svg>
    ),
  },
  // {
  //   id: "quickest",
  //   label: "Quickest",
  //   icon: (
  //     <svg viewBox="0 0 24 24" fill="currentColor">
  //       <path d="M13 2 4 14h6l-1 8 9-12h-6z" />
  //     </svg>
  //   ),
  // },
  {
    id: "instructions",
    label: "Инструкции",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <path d="M6 2.5h8.5L19 7v14.5H6z" strokeLinejoin="round" />
        <path
          d="M14.5 2.5V7H19M9 12h7M9 16h7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
];

const PALETTE = ["W", "Y", "G", "B", "R", "O"] as const;
/** Paint code for "no colour" — repaints a sticker back to unset (`?`). */
const ERASE = "?";

export default function Home() {
  const [mode, setMode] = useState<Mode>("solve");
  const [paint, setPaint] = useState<string | null>(null);
  // Bump to re-mount the cube (clears all painted stickers).
  const [clearNonce, setClearNonce] = useState(0);
  // What the solve cube is built from, and a bump to build it again. Solving
  // re-anchors these on what the cube shows, so each solution starts there.
  const [solveLayout, setSolveLayout] = useState(BLANK_CUBE);
  const [solveNonce, setSolveNonce] = useState(0);
  const faceletsRef = useRef<Facelets | null>(null);
  // Both cubes stay mounted and take turns being visible, so paint, turns and
  // camera angle all survive a trip through another tab.
  const solveCubeRef = useRef<RubiksCubeHandle | null>(null);
  const challengeCubeRef = useRef<RubiksCubeHandle | null>(null);
  // Нареди: the solution, as clickable step tokens (Bulgarian notation).
  const [steps, setSteps] = useState<string[]>([]);
  // How many of `steps` are currently applied to the cube (0 = none, steps.length = all).
  const [stepIndex, setStepIndex] = useState(0);
  // The full cube layout each step leads to: stepStates[i] = after steps[0..i).
  const [stepStates, setStepStates] = useState<string[]>([]);
  // The full layout the cube is showing right now — a step lights up only while
  // the two match, so painting over a sticker drops the highlight.
  const [cubeState, setCubeState] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const statusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Bumped by every solve and by anything that changes the solve cube, so a
  // solve still in flight can tell it has been superseded and drop its result.
  const solveRun = useRef(0);
  const solveInFlight = useRef(false);
  // Bumped by every scramble roll: only the latest one gets to land.
  const rollRun = useRef(0);
  // Bumped by every tab tap: async work only updates the status line if the
  // player hasn't moved on since it started.
  const navRun = useRef(0);
  // Мисия: a solver-generated scramble the player tries to undo by hand, which
  // doubles as the trail shown up top. Null until the first one is rolled.
  const [challenge, setChallenge] = useState<Scramble | null>(null);
  // Bumped to rebuild the cube at `challenge.layout`, turns played and all.
  const [challengeNonce, setChallengeNonce] = useState(0);

  // Load today's scramble as the page loads rather than when Мисия is
  // opened, so the tab shows a scrambled cube straight away instead of a
  // stand-in that gets shuffled a moment later.
  useEffect(() => {
    let live = true;
    const run = ++rollRun.current;
    dailyScramble()
      .then((rolled) => {
        if (live && run === rollRun.current) setChallenge(rolled);
      })
      .catch(() => {
        // Opening Мисия rolls again, and reports it, if this didn't land.
      });
    return () => {
      live = false;
    };
  }, []);

  const solving = mode === "solve";
  const playingChallenge = mode === "challenge";
  const inInstructions = mode === "instructions";
  // The player's face colours, as sticker letter -> drawn colour.
  const faceScheme = useFaceScheme();
  const colors = schemeColors(faceScheme);
  // Nothing to say yet in the solve tab -> show the "paint all six sides" hint.
  const showHint = solving && status === null && steps.length === 0;

  const flashStatus = (msg: string | null, autoClear = true) => {
    if (statusTimer.current) clearTimeout(statusTimer.current);
    setStatus(msg);
    if (msg && autoClear) {
      statusTimer.current = setTimeout(() => setStatus(null), 4000);
    }
  };

  const goToMode = async (m: Mode) => {
    // Everything else is left alone: each tab picks its own state back up.
    // Мисия loads today's scramble if it hasn't got one yet, or if the one it
    // has is from an earlier day (the page was left open past midnight).
    const reroll =
      m === "challenge" && (!challenge || challenge.date !== todayKey());
    ++navRun.current;
    setMode(m);
    flashStatus(null);
    if (reroll) await rollChallenge(false);
  };

  /**
   * Put today's scramble on the Мисия cube — or, with `fresh`, a new one that
   * replaces it as today's puzzle ("Ново разбъркване").
   */
  const rollChallenge = async (fresh: boolean) => {
    const nav = navRun.current;
    const run = ++rollRun.current;
    flashStatus("Разбъркване…", false);
    try {
      const rolled = await dailyScramble(fresh);
      if (run === rollRun.current) setChallenge(rolled);
      if (nav === navRun.current) flashStatus(null);
    } catch (err) {
      if (nav === navRun.current) flashStatus(solverErrorMessage(err));
    }
  };

  /** Drop any solve in flight: its answer is for a cube that has since changed. */
  const cancelSolve = () => {
    solveRun.current++;
    if (solveInFlight.current) {
      solveInFlight.current = false;
      flashStatus(null);
    }
  };

  /** A hand-played turn in Мисия — track where it leaves the cube. */
  const playChallengeMove = (move: string) => {
    challengeCubeRef.current?.applyMove(move);
    if (!challenge) return;
    const next = faceletsToVerboseString(
      applyMoveToFacelets(parseNetString(challenge.state), move),
    );
    setChallenge({
      ...challenge,
      state: next,
      index: challenge.states.indexOf(next),
    });
  };

  /**
   * Walk the cube to `target` along the scramble, turning it move by move so
   * the way there can be followed. Hand-played turns are the one exception:
   * they leave the scramble behind, and with no run of moves back to it the
   * cube is rebuilt at the target layout instead.
   */
  const goToChallengeStep = (target: number) => {
    if (!challenge) return;
    const { steps: scramble, states, index } = challenge;
    const clamped = Math.max(0, Math.min(scramble.length, target));
    if (clamped === index) return;

    const cube = challengeCubeRef.current;
    let layout = challenge.layout;
    if (index < 0) {
      layout = states[clamped];
      setChallengeNonce((n) => n + 1);
    } else if (clamped > index) {
      for (let i = index; i < clamped; i++) cube?.applyMove(scramble[i]);
    } else {
      for (let i = index - 1; i >= clamped; i--) {
        cube?.applyMove(invertMove(scramble[i]));
      }
    }
    setChallenge({
      ...challenge,
      layout,
      index: clamped,
      state: states[clamped],
    });
  };

  /** The layout on screen once `steps[0..n)` are applied to the painted cube. */
  const visualAt = (n: number) => {
    let f = faceletsRef.current;
    if (!f) return "";
    for (let i = 0; i < n; i++) f = applyMoveToFacelets(f, steps[i]);
    return faceletsToVerboseString(f);
  };

  // Jump to the cube state after `steps[0..target)`, replaying (or undoing)
  // only the moves between where the cube is now and where it should be.
  const goToStep = (target: number) => {
    const clamped = Math.max(0, Math.min(steps.length, target));
    if (clamped === stepIndex) return;
    cancelSolve();
    const cube = solveCubeRef.current;
    if (clamped > stepIndex) {
      for (let i = stepIndex; i < clamped; i++) cube?.applyMove(steps[i]);
    } else {
      for (let i = stepIndex - 1; i >= clamped; i--) {
        cube?.applyMove(invertMove(steps[i]));
      }
    }
    setStepIndex(clamped);
    setCubeState(visualAt(clamped));
  };

  const handleSolve = async () => {
    if (!faceletsRef.current) return;
    // Solve the cube exactly as it stands on screen: the colours painted in,
    // carried through whatever steps have been played out so far.
    const marks = visualAt(stepIndex);
    if (marks === BLANK_MARKS) {
      flashStatus("Оцвети поне един стикер, преди да решиш.");
      return;
    }
    const run = ++solveRun.current;
    const nav = navRun.current;
    solveInFlight.current = true;
    flashStatus("Решаване…", false);
    try {
      const solution = await homeSolve(marks);
      if (run !== solveRun.current) return;
      solveInFlight.current = false;
      const tokens = solution ? toBgNotation(solution).split(" ") : [];
      // Rebuild the cube from what it is showing, so this state becomes the
      // one the new trail starts from — and the one more colours get added to.
      setSolveLayout(marks);
      setSolveNonce((n) => n + 1);
      setSteps(tokens);
      setStepIndex(0);
      setStepStates(moveStates(parseNetString(marks), tokens));
      setCubeState(marks);
      if (nav !== navRun.current) return;
      if (solution) {
        flashStatus(null);
      } else {
        flashStatus("Кубът вече е решен.");
      }
    } catch (err) {
      if (run !== solveRun.current) return;
      solveInFlight.current = false;
      if (nav === navRun.current) flashStatus(solverErrorMessage(err));
    }
  };

  return (
    <div className="flex h-dvh w-full touch-none flex-col overflow-hidden overscroll-none bg-black">
      <header
        className="shrink-0 border-b border-white/10 bg-zinc-950/95"
        style={{
          height: "calc(4.75rem + env(safe-area-inset-top))",
          paddingTop: "env(safe-area-inset-top)",
        }}
      >
        {inInstructions ? (
          <div className="flex h-full items-center justify-center gap-2.5 px-4">
            <MiniCube className="h-7 w-7" />
            <h1 className="text-lg font-semibold tracking-tight text-white">
              Инструкции и настройки
            </h1>
          </div>
        ) : status !== null ? (
          <div className="flex h-full items-center justify-center px-4 text-center text-xs font-medium text-zinc-300">
            {status}
          </div>
        ) : showHint ? (
          <div className="flex h-full flex-col items-center justify-center gap-1 px-4 text-center">
            <p className="flex items-center gap-2 text-base font-semibold tracking-tight text-white">
              <MiniCube className="h-5 w-5" />
              Оцвети шестте страни:
            </p>
            <p className="text-[13px] leading-5 text-zinc-300">
              <SideNames />
            </p>
          </div>
        ) : solving && steps.length > 0 ? (
          <div className="flex h-full items-center px-2">
            <StepTrail
              steps={steps}
              states={stepStates}
              current={cubeState}
              index={stepIndex}
              onGo={goToStep}
            />
          </div>
        ) : playingChallenge && challenge ? (
          <div className="flex h-full items-center px-2">
            <StepTrail
              steps={challenge.steps}
              states={challenge.states}
              current={challenge.state}
              index={challenge.index}
              onGo={goToChallengeStep}
            />
          </div>
        ) : null}
      </header>

      <div className="relative min-h-0 flex-1">
        {inInstructions && <InstructionsPanel />}

        <div className={solving ? "h-full w-full" : "hidden"}>
          <RubiksCube
            key={`solve-${clearNonce}`}
            ref={solveCubeRef}
            cube={solveLayout}
            colors={colors}
            nonce={solveNonce}
            paintColor={solving ? paint : null}
            onFaceletsChange={(f) => {
              cancelSolve();
              faceletsRef.current = f;
              setCubeState(visualAt(stepIndex));
            }}
            className="h-full w-full"
          />
        </div>

        {/* Mounted only once there's a scramble to show, so the tab never
            flashes a stand-in cube that gets shuffled a moment later. */}
        {challenge && (
          <div className={playingChallenge ? "h-full w-full" : "hidden"}>
            <RubiksCube
              ref={challengeCubeRef}
              cube={challenge.layout}
              colors={colors}
              nonce={challengeNonce}
              className="h-full w-full"
            />
          </div>
        )}

        {solving && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center gap-3 bg-linear-to-t from-black/70 to-transparent px-4 pb-4 pt-8">
            <div className="pointer-events-auto flex gap-2.5">
              {PALETTE.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={COLOUR_NAME[faceScheme[FACE_OF_CODE[c]]]}
                  onClick={() => setPaint(c)}
                  className={`h-9 w-9 rounded-lg border-2 transition-transform ${
                    paint === c
                      ? "scale-110 border-white"
                      : "border-black/30 active:scale-95"
                  }`}
                  style={{ background: colors[c] }}
                />
              ))}
              <button
                type="button"
                aria-label="Без цвят"
                onClick={() => setPaint(ERASE)}
                className={`h-9 w-9 rounded-lg border-2 transition-transform ${
                  paint === ERASE
                    ? "scale-110 border-white"
                    : "border-black/30 active:scale-95"
                }`}
                style={{ background: NEUTRAL_COLOR }}
              />
            </div>
            <div className="pointer-events-auto flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  cancelSolve();
                  setPaint(null);
                  setClearNonce((n) => n + 1);
                  setSolveLayout(BLANK_CUBE);
                  setSteps([]);
                  setStepIndex(0);
                  setStepStates([]);
                  flashStatus(null);
                }}
                className="rounded-full border border-white px-8 py-2 text-sm font-semibold text-white active:bg-white/10"
              >
                Изчисти
              </button>
              <button
                type="button"
                onClick={handleSolve}
                className="rounded-full border border-white bg-white px-8 py-2 text-sm font-semibold text-black active:bg-zinc-200"
              >
                Нареди
              </button>
            </div>
          </div>
        )}

        {playingChallenge && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center gap-3 bg-linear-to-t from-black/70 to-transparent px-4 pb-4 pt-8">
            <div className="pointer-events-auto grid grid-cols-6 gap-2">
              {MOVES.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => playChallengeMove(m)}
                  className="h-10 w-10 rounded-lg bg-zinc-800 font-mono text-sm font-semibold text-zinc-100 active:bg-zinc-600"
                >
                  {m}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => rollChallenge(true)}
              className="pointer-events-auto rounded-full border border-white px-8 py-2 text-sm font-semibold text-white active:bg-white/10"
            >
              Ново разбъркване
            </button>
          </div>
        )}
      </div>

      <nav
        className="flex shrink-0 items-stretch border-t border-white/10 bg-zinc-950/95"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {TABS.map(({ id, label, icon }) => {
          const active = mode === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => goToMode(id)}
              className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-colors ${
                active ? "text-sky-400" : "text-zinc-500 active:text-zinc-300"
              }`}
            >
              <span className="h-6 w-6">{icon}</span>
              {label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
