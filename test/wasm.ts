import { readFileSync } from "node:fs";

/** The solver's `.wasm`, for tests that load it without a server. */
export const wasmBytes = () =>
  readFileSync(new URL("../public/solver/rubiksolver_bg.wasm", import.meta.url));

/** Letters only, so layouts compare regardless of spacing and `|`. */
export const stickers = (layout: string) => layout.replace(/[^A-Za-z?]/g, "");
