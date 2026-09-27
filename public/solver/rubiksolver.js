/* @ts-self-types="./rubiksolver.d.ts" */

/**
 * What a fallible call hands back: a [`Status`] (`Ok`, i.e. `0`, on
 * success) and, on success, the result text. `value` is the empty string
 * on failure — and also on a successful zero-move answer, so read
 * `status`, not `value`, to tell the two apart.
 */
export class Reply {
    static __wrap(ptr) {
        const obj = Object.create(Reply.prototype);
        obj.__wbg_ptr = ptr;
        ReplyFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        ReplyFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_reply_free(ptr, 0);
    }
    /**
     * @returns {Status}
     */
    get status() {
        const ret = wasm.reply_status(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {string}
     */
    get value() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.reply_value(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
}
if (Symbol.dispose) Reply.prototype[Symbol.dispose] = Reply.prototype.free;

/**
 * Result code of a WebAssembly call: [`Status::Ok`] (`0`) on success,
 * otherwise which kind of [`Error`] it was.
 *
 * The numbers are part of the public API — never renumber a variant, only
 * add new ones. They are grouped by tens: layout parsing, cube legality,
 * drawing a part cube, reading `home` marks, impossible `home` tasks,
 * search limits, bad arguments.
 * @enum {0 | 1 | 2 | 3 | 4 | 5 | 10 | 20 | 21 | 22 | 23 | 24 | 25 | 26 | 30 | 31 | 32 | 40 | 41 | 42 | 43 | 50 | 51 | 52 | 53 | 60 | 61}
 */
export const Status = Object.freeze({
    Ok: 0, "0": "Ok",
    WrongRowCount: 1, "1": "WrongRowCount",
    WrongCellCount: 2, "2": "WrongCellCount",
    UnknownColour: 3, "3": "UnknownColour",
    BadToken: 4, "4": "BadToken",
    WildcardInCube: 5, "5": "WildcardInCube",
    NotSolvable: 10, "10": "NotSolvable",
    WrongCentre: 20, "20": "WrongCentre",
    PartialPiece: 21, "21": "PartialPiece",
    NotAPiece: 22, "22": "NotAPiece",
    DrawnTwice: 23, "23": "DrawnTwice",
    UnfixableTwist: 24, "24": "UnfixableTwist",
    UnfixableFlip: 25, "25": "UnfixableFlip",
    UnfixableParity: 26, "26": "UnfixableParity",
    FaceletMismatch: 30, "30": "FaceletMismatch",
    SentAndHeld: 31, "31": "SentAndHeld",
    HomeSlotHeld: 32, "32": "HomeSlotHeld",
    WouldTwistCorner: 40, "40": "WouldTwistCorner",
    WouldFlipEdge: 41, "41": "WouldFlipEdge",
    WouldSwapPair: 42, "42": "WouldSwapPair",
    Unreachable: 43, "43": "Unreachable",
    NoSolution: 50, "50": "NoSolution",
    NoMatch: 51, "51": "NoMatch",
    OutOfTurns: 52, "52": "OutOfTurns",
    SearchBudget: 53, "53": "SearchBudget",
    UnknownAlgorithm: 60, "60": "UnknownAlgorithm",
    BadMove: 61, "61": "BadMove",
});

/**
 * The names accepted by [`solve`] / [`transition`], comma-separated.
 * @returns {string}
 */
export function algorithms() {
    let deferred1_0;
    let deferred1_1;
    try {
        const ret = wasm.algorithms();
        deferred1_0 = ret[0];
        deferred1_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
}

/**
 * Apply a space-separated move sequence (`R U' F2` …) to `layout` and return
 * the resulting layout.
 * @param {string} layout
 * @param {string} moves
 * @returns {Reply}
 */
export function apply_moves(layout, moves) {
    const ptr0 = passStringToWasm0(layout, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passStringToWasm0(moves, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len1 = WASM_VECTOR_LEN;
    const ret = wasm.apply_moves(ptr0, len0, ptr1, len1);
    return Reply.__wrap(ret);
}

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
 * @param {string} layout
 * @param {string} marks
 * @param {number} max_turns
 * @returns {Reply}
 */
export function home(layout, marks, max_turns) {
    const ptr0 = passStringToWasm0(layout, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passStringToWasm0(marks, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len1 = WASM_VECTOR_LEN;
    const ret = wasm.home(ptr0, len0, ptr1, len1, max_turns);
    return Reply.__wrap(ret);
}

/**
 * Shortest sequence to any state matching `goal`, a layout whose cells may
 * be `?` (don't care) or `=` (don't care about the colour, but keep the
 * piece that is in this slot now right where it is). `max_depth` bounds the
 * search.
 * @param {string} layout
 * @param {string} goal
 * @param {number} max_depth
 * @returns {Reply}
 */
export function reach(layout, goal, max_depth) {
    const ptr0 = passStringToWasm0(layout, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passStringToWasm0(goal, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len1 = WASM_VECTOR_LEN;
    const ret = wasm.reach(ptr0, len0, ptr1, len1, max_depth);
    return Reply.__wrap(ret);
}

/**
 * A full layout for a partly drawn one: the pieces it leaves out are filled
 * into the slots nobody claimed, then twisted, flipped or swapped as needed
 * to make a cube that could actually exist.
 *
 * A layout that already has all 54 stickers comes back untouched. Fails if
 * what was drawn cannot occur on a real cube — a centre out of place, a
 * piece drawn twice, colours no piece carries.
 * @param {string} layout
 * @returns {Reply}
 */
export function realize(layout) {
    const ptr0 = passStringToWasm0(layout, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.realize(ptr0, len0);
    return Reply.__wrap(ret);
}

/**
 * The layout a fresh [`scramble_moves`] of `moves` turns lands on. This draws
 * its own random turns; pair the path with its cube via
 * `apply_moves(solved(), scramble_moves(n))` if you need them consistent.
 * @param {number} moves
 * @returns {string}
 */
export function scramble(moves) {
    let deferred1_0;
    let deferred1_1;
    try {
        const ret = wasm.scramble(moves);
        deferred1_0 = ret[0];
        deferred1_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
}

/**
 * `moves` random quarter turns with no wasted moves (nothing that cancels or
 * folds into a shorter turn), in notation — the path a solved cube takes to
 * the scrambled state. Uses `Math.random`.
 * @param {number} moves
 * @returns {string}
 */
export function scramble_moves(moves) {
    let deferred1_0;
    let deferred1_1;
    try {
        const ret = wasm.scramble_moves(moves);
        deferred1_0 = ret[0];
        deferred1_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
}

/**
 * Shortest sequence (per `algo`) that returns `layout` to solved.
 * @param {string} layout
 * @param {string} algo
 * @returns {Reply}
 */
export function solve(layout, algo) {
    const ptr0 = passStringToWasm0(layout, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passStringToWasm0(algo, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len1 = WASM_VECTOR_LEN;
    const ret = wasm.solve(ptr0, len0, ptr1, len1);
    return Reply.__wrap(ret);
}

/**
 * The solved cube's layout — a handy starting point for a UI.
 * @returns {string}
 */
export function solved() {
    let deferred1_0;
    let deferred1_1;
    try {
        const ret = wasm.solved();
        deferred1_0 = ret[0];
        deferred1_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
}

/**
 * Shortest sequence (per `algo`) taking `from` to `to`.
 * @param {string} from
 * @param {string} to
 * @param {string} algo
 * @returns {Reply}
 */
export function transition(from, to, algo) {
    const ptr0 = passStringToWasm0(from, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passStringToWasm0(to, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len1 = WASM_VECTOR_LEN;
    const ptr2 = passStringToWasm0(algo, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len2 = WASM_VECTOR_LEN;
    const ret = wasm.transition(ptr0, len0, ptr1, len1, ptr2, len2);
    return Reply.__wrap(ret);
}

/**
 * [`Status::Ok`] if `layout` is a physically reachable, solvable cube,
 * [`Status::NotSolvable`] if it parses but is not, or the parse error.
 * @param {string} layout
 * @returns {Status}
 */
export function validate(layout) {
    const ptr0 = passStringToWasm0(layout, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.validate(ptr0, len0);
    return ret;
}
function __wbg_get_imports() {
    const import0 = {
        __proto__: null,
        __wbg___wbindgen_throw_5d9e815e6fdf150f: function(arg0, arg1) {
            throw new Error(getStringFromWasm0(arg0, arg1));
        },
        __wbg_random_fd1f1feb1bdd3544: function() {
            const ret = Math.random();
            return ret;
        },
        __wbindgen_init_externref_table: function() {
            const table = wasm.__wbindgen_externrefs;
            const offset = table.grow(4);
            table.set(0, undefined);
            table.set(offset + 0, undefined);
            table.set(offset + 1, null);
            table.set(offset + 2, true);
            table.set(offset + 3, false);
        },
    };
    return {
        __proto__: null,
        "./rubiksolver_bg.js": import0,
    };
}

const ReplyFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_reply_free(ptr, 1));

function getStringFromWasm0(ptr, len) {
    return decodeText(ptr >>> 0, len);
}

let cachedUint8ArrayMemory0 = null;
function getUint8ArrayMemory0() {
    if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
        cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8ArrayMemory0;
}

function passStringToWasm0(arg, malloc, realloc) {
    if (realloc === undefined) {
        const buf = cachedTextEncoder.encode(arg);
        const ptr = malloc(buf.length, 1) >>> 0;
        getUint8ArrayMemory0().subarray(ptr, ptr + buf.length).set(buf);
        WASM_VECTOR_LEN = buf.length;
        return ptr;
    }

    let len = arg.length;
    let ptr = malloc(len, 1) >>> 0;

    const mem = getUint8ArrayMemory0();

    let offset = 0;

    for (; offset < len; offset++) {
        const code = arg.charCodeAt(offset);
        if (code > 0x7F) break;
        mem[ptr + offset] = code;
    }
    if (offset !== len) {
        if (offset !== 0) {
            arg = arg.slice(offset);
        }
        ptr = realloc(ptr, len, len = offset + arg.length * 3, 1) >>> 0;
        const view = getUint8ArrayMemory0().subarray(ptr + offset, ptr + len);
        const ret = cachedTextEncoder.encodeInto(arg, view);

        offset += ret.written;
        ptr = realloc(ptr, len, offset, 1) >>> 0;
    }

    WASM_VECTOR_LEN = offset;
    return ptr;
}

let cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
cachedTextDecoder.decode();
const MAX_SAFARI_DECODE_BYTES = 2146435072;
let numBytesDecoded = 0;
function decodeText(ptr, len) {
    numBytesDecoded += len;
    if (numBytesDecoded >= MAX_SAFARI_DECODE_BYTES) {
        cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
        cachedTextDecoder.decode();
        numBytesDecoded = len;
    }
    return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

const cachedTextEncoder = new TextEncoder();

if (!('encodeInto' in cachedTextEncoder)) {
    cachedTextEncoder.encodeInto = function (arg, view) {
        const buf = cachedTextEncoder.encode(arg);
        view.set(buf);
        return {
            read: arg.length,
            written: buf.length
        };
    };
}

let WASM_VECTOR_LEN = 0;

let wasmModule, wasmInstance, wasm;
function __wbg_finalize_init(instance, module) {
    wasmInstance = instance;
    wasm = instance.exports;
    wasmModule = module;
    cachedUint8ArrayMemory0 = null;
    wasm.__wbindgen_start();
    return wasm;
}

async function __wbg_load(module, imports) {
    if (typeof Response === 'function' && module instanceof Response) {
        if (!module.ok) {
            throw new Error(`failed to fetch Wasm: ${module.status} ${module.statusText} fetching '${module.url}'`);
        }

        if (typeof WebAssembly.instantiateStreaming === 'function') {
            try {
                return await WebAssembly.instantiateStreaming(module, imports);
            } catch (e) {
                const validResponse = expectedResponseType(module.type);

                if (validResponse && module.headers.get('Content-Type') !== 'application/wasm') {
                    console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", e);

                } else { throw e; }
            }
        }

        const bytes = await module.arrayBuffer();
        return await WebAssembly.instantiate(bytes, imports);
    } else {
        const instance = await WebAssembly.instantiate(module, imports);

        if (instance instanceof WebAssembly.Instance) {
            return { instance, module };
        } else {
            return instance;
        }
    }

    function expectedResponseType(type) {
        switch (type) {
            case 'basic': case 'cors': case 'default': return true;
        }
        return false;
    }
}

function initSync(module) {
    if (wasm !== undefined) return wasm;


    if (module !== undefined) {
        if (Object.getPrototypeOf(module) === Object.prototype) {
            ({module} = module)
        } else {
            console.warn('using deprecated parameters for `initSync()`; pass a single object instead')
        }
    }

    const imports = __wbg_get_imports();
    if (!(module instanceof WebAssembly.Module)) {
        module = new WebAssembly.Module(module);
    }
    const instance = new WebAssembly.Instance(module, imports);
    return __wbg_finalize_init(instance, module);
}

async function __wbg_init(module_or_path) {
    if (wasm !== undefined) return wasm;


    if (module_or_path !== undefined) {
        if (Object.getPrototypeOf(module_or_path) === Object.prototype) {
            ({module_or_path} = module_or_path)
        } else {
            console.warn('using deprecated parameters for the initialization function; pass a single object instead')
        }
    }

    if (module_or_path === undefined) {
        module_or_path = new URL('rubiksolver_bg.wasm', import.meta.url);
    }
    const imports = __wbg_get_imports();

    if (typeof module_or_path === 'string' || (typeof Request === 'function' && module_or_path instanceof Request) || (typeof URL === 'function' && module_or_path instanceof URL)) {
        module_or_path = fetch(module_or_path);
    }

    const { instance, module } = await __wbg_load(await module_or_path, imports);

    return __wbg_finalize_init(instance, module);
}

export { initSync, __wbg_init as default };
