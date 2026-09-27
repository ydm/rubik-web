/**
 * The solver's failures in Bulgarian, for the status line. Each status comes
 * from `public/solver/API.md`; `Record<SolverStatus, …>` makes a missing one a
 * type error.
 */

import { SolverError, type SolverStatus } from "@/lib/solver";

/** For statuses only a bug in this app can cause (a malformed layout, a bad
 *  move token, a function the app never calls): shown with the code. */
const INTERNAL_ERROR = "Вътрешна грешка в приложението";

/** Every solver failure status, in Bulgarian (see `public/solver/API.md`). */
export const SOLVER_MESSAGES: Record<SolverStatus, string> = {
  // Layout parsing: the app builds the layout itself.
  WrongRowCount: INTERNAL_ERROR,
  WrongCellCount: INTERNAL_ERROR,
  UnknownColour: INTERNAL_ERROR,
  BadToken: INTERNAL_ERROR,
  // Only the full solver can say this, and it's only called with no `?` left.
  WildcardInCube: INTERNAL_ERROR,
  NotSolvable:
    "Такъв куб не може да се получи с въртене — провери оцветяването: по 9 стикера от всеки цвят и само истински кубчета.",
  WrongCentre: "Цветът на център е сгрешен — центровете никога не се местят.",
  PartialPiece:
    "Едно кубче е оцветено само отчасти — оцвети всичките му стикери или нито един.",
  NotAPiece:
    "Цветовете на едно кубче не образуват истинско кубче (напр. бяло с жълто или ъгъл в огледален ред).",
  DrawnTwice: "Едно и също кубче е оцветено на две места.",
  UnfixableTwist:
    "Ъглите са завъртени по невъзможен начин — някой ъгъл е оцветен грешно.",
  UnfixableFlip:
    "Ръбовете са обърнати по невъзможен начин — някой ръб е оцветен грешно.",
  UnfixableParity:
    "Излиза, че само две кубчета са разменени, а това е невъзможно — провери оцветяването.",
  FaceletMismatch:
    "Оцветен стикер не съвпада с куба — оцвети цялото кубче или провери цвета.",
  SentAndHeld: "Едно кубче е едновременно за подреждане и задържано на място.",
  HomeSlotHeld: "Мястото на едно кубче е заето от друго, задържано кубче.",
  WouldTwistCorner:
    "Така кубът би останал с един ъгъл, завъртян на място — провери оцветяването.",
  WouldFlipEdge:
    "Така кубът би останал с един ръб, обърнат на място — провери оцветяването.",
  WouldSwapPair:
    "Така кубът би останал с две разменени кубчета — провери оцветяването.",
  Unreachable:
    "Оцветените кубчета не могат да стигнат до местата си — провери оцветяването.",
  NoSolution: "Не открих решение за този куб.",
  // `reach` is never called.
  NoMatch: INTERNAL_ERROR,
  OutOfTurns:
    "Не открих достатъчно кратко решение — оцвети целия куб или по-малко стикери.",
  SearchBudget:
    "Твърде много оцветени кубчета за търсене — оцвети целия куб или по-малко стикери.",
  UnknownAlgorithm: INTERNAL_ERROR,
  BadMove: INTERNAL_ERROR,
};

/** A failed solver call (or a failure to load the solver) as shown to the player. */
export function solverErrorMessage(err: unknown): string {
  if (!(err instanceof SolverError)) {
    // The worker or the WASM never loaded (e.g. no connection).
    return "Нареждащата програма не се зареди — провери връзката и опитай пак.";
  }
  if (err.status === "Unknown") {
    return `Нареждащата програма върна непозната грешка (код ${err.code}).`;
  }
  const text = SOLVER_MESSAGES[err.status];
  return text === INTERNAL_ERROR ? `${text} (код ${err.code}).` : text;
}
