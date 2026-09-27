The process

1. One-time tooling

rustup target add wasm32-unknown-unknown     # the std library, precompiled for wasm
cargo install wasm-pack                        # build orchestrator

wasm-pack runs three things for you: cargo build for the wasm target → wasm-bindgen (generates the JS glue that marshals strings in/out of wasm memory) → wasm-opt (shrinks the binary, if binaryen is present).

2. Build

wasm-pack build --target web --out-dir web/pkg --release

--target web emits a plain ES module you import directly in a <script type="module"> — no bundler. (Other modes: bundler for vite/webpack, nodejs, no-modules.)

Produces web/pkg/: rubiksolver.js (glue), rubiksolver_bg.wasm (compiled code), rubiksolver.d.ts, package.json.

3. Serve it

Browsers refuse to import modules or fetch .wasm over file://, so you need a local HTTP server:

python3 -m http.server -d web 8080
# then open http://localhost:8080

(or npx serve web, or cargo install basic-http-server && basic-http-server web.)

4. What the page does

import init, { solve, Status } from './pkg/rubiksolver.js';
await init();                              // fetch + compile the .wasm
const r = solve(layoutText, 'kociemba');   // -> {status: Status.Ok (0), value: "R U' F2 ..."}

init() instantiates the module; after that the exported functions are just synchronous calls. wasm-bindgen copies your JS string into wasm linear memory, runs the Rust function, reads the result back. Nothing throws: calls that can fail return a status code (0 = success) — see API.md for every code.
