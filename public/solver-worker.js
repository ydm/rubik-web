// Runs the WASM solver in `solver/` off the main thread, so a long search
// can't freeze the page. Protocol (see `src/lib/solver.ts`):
//   in:  { id, fn, args }                 -- call `rubiksolver[fn](...args)`
//   out: { id, status, code, value }      -- the call's answer: `status` is the
//                                            solver's `Status` name ("Ok" on
//                                            success), `code` its number
//      | { id, error }                    -- the call never ran (load failure)

import init, * as rubiksolver from "./solver/rubiksolver.js";

const CALLABLE = new Set(["home", "solve", "apply_moves", "scramble_moves", "solved"]);

let ready = null;
function load() {
  if (!ready) {
    ready = init();
    // Don't keep a failed fetch around: the next call tries again.
    ready.catch(() => {
      ready = null;
    });
  }
  return ready;
}

self.onmessage = async ({ data: { id, fn, args } }) => {
  try {
    if (!CALLABLE.has(fn)) throw new Error(`unknown solver function: ${fn}`);
    await load();
    const out = rubiksolver[fn](...args);
    if (out instanceof rubiksolver.Reply) {
      // A `Reply` lives in WASM memory and its fields are getters, so it can't
      // be posted as is: read it out here, then free it.
      const { status, value } = out;
      out.free();
      self.postMessage({ id, status: rubiksolver.Status[status] ?? "Unknown", code: status, value });
    } else {
      // Functions that cannot fail hand back a plain string.
      self.postMessage({ id, status: "Ok", code: rubiksolver.Status.Ok, value: out });
    }
  } catch (err) {
    self.postMessage({ id, error: err instanceof Error ? err.message : String(err) });
  }
};
