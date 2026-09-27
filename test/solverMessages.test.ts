import { beforeAll, describe, expect, it } from "vitest";
import init, { Status } from "../public/solver/rubiksolver.js";
import { SOLVER_STATUSES, SolverError } from "@/lib/solver";
import { SOLVER_MESSAGES, solverErrorMessage } from "@/lib/solverMessages";
import { wasmBytes } from "./wasm";

beforeAll(async () => {
  await init({ module_or_path: wasmBytes() });
});

/** The failure names the WASM build actually exports. */
const wasmStatuses = () =>
  Object.keys(Status).filter((k) => Number.isNaN(Number(k)) && k !== "Ok");

describe("solver statuses", () => {
  it("cover every failure the WASM solver can return", () => {
    expect([...SOLVER_STATUSES].sort()).toEqual(wasmStatuses().sort());
  });

  it("each have a Bulgarian message", () => {
    for (const status of SOLVER_STATUSES) {
      expect(SOLVER_MESSAGES[status], status).toMatch(/[А-Яа-я]/);
    }
  });
});

describe("solverErrorMessage", () => {
  const error = (status: string) =>
    new SolverError(status as never, Status[status as keyof typeof Status] as number);

  it("explains what the player painted wrong", () => {
    expect(solverErrorMessage(error("PartialPiece"))).toBe(
      "Едно кубче е оцветено само отчасти — оцвети всичките му стикери или нито един.",
    );
    expect(solverErrorMessage(error("NotSolvable"))).toMatch(/^Такъв куб не може/);
  });

  it("marks the app's own mistakes as internal, with the code", () => {
    expect(solverErrorMessage(error("BadMove"))).toBe(
      "Вътрешна грешка в приложението (код 61).",
    );
  });

  it("reports a status newer than the app by its code", () => {
    expect(solverErrorMessage(new SolverError("Unknown", 99))).toBe(
      "Решаващата програма върна непозната грешка (код 99).",
    );
  });

  it("reports a solver that never loaded", () => {
    expect(solverErrorMessage(new TypeError("network down"))).toMatch(/не се зареди/);
  });
});
