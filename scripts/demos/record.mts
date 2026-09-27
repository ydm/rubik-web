/**
 * Record the short demo videos for the Инструкции page by driving the real
 * app in a phone-sized browser.
 *
 *   pnpm build && pnpm start          # in one terminal
 *   node scripts/demos/record.mts [scenario] [--url http://localhost:3000] [--dry]
 *
 * `--dry` runs the scenarios without filming, printing the solutions they
 * play, to check a new scenario quickly.
 *
 * Writes public/instructions/<scenario>.{mp4,webm,jpg}. Needs ffmpeg and a
 * Chromium (set CHROMIUM, default /usr/bin/chromium).
 *
 * The page's clock is faked (timers, requestAnimationFrame, performance.now),
 * and the recorder steps it one video frame at a time, screenshotting each
 * step. So every frame is exact and at full Retina resolution, however slow
 * the capture itself is — headless Chrome's live screencast only gives 1×.
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, type Page } from "playwright";
import * as THREE from "three";

const VIEWPORT = { width: 390, height: 844 };
const SCALE = 2; // device pixel ratio: record at Retina sharpness
const FPS = 30;
const OUT_DIR = "public/instructions";
const FADE = 0.35; // seconds of fade from/to black, so the loop restarts cleanly

type Point = { x: number; y: number };

// ---------------------------------------------------------------------------
// Recording: step the page's clock, one screenshot per video frame
// ---------------------------------------------------------------------------

class Recorder {
  readonly page: Page;
  /** While false, time still passes but no frames are kept (off-camera setup). */
  filming = true;
  private dir: string;
  private count = 0;

  constructor(page: Page, dir: string) {
    this.page = page;
    this.dir = dir;
  }

  get frames() {
    return this.count;
  }

  /** Advance one video frame and capture it. */
  async frame() {
    await this.page.clock.runFor(1000 / FPS);
    if (!this.filming) return;
    const file = join(this.dir, `${String(this.count++).padStart(5, "0")}.jpg`);
    await this.page.screenshot({ path: file, type: "jpeg", quality: 92 });
  }

  /** Let `ms` of app time pass on camera. */
  async hold(ms: number) {
    for (let t = 0; t < ms; t += 1000 / FPS) await this.frame();
  }

  /** Tap a point: press, a short touch, release, then `pause` ms on camera. */
  async tapAt({ x, y }: Point, pause = 450) {
    await this.page.mouse.move(x, y);
    await this.page.mouse.down();
    await this.hold(110);
    await this.page.mouse.up();
    await this.hold(pause);
  }

  /** Tap the centre of the first element matching `selector`. */
  async tap(selector: string, pause = 450) {
    const box = await this.page.locator(selector).first().boundingBox();
    if (!box) throw new Error(`nothing to tap: ${selector}`);
    await this.tapAt({ x: box.x + box.width / 2, y: box.y + box.height / 2 }, pause);
  }

  /** Drag from `from` to `to` over `ms`, filming the whole move. */
  async drag(from: Point, to: Point, ms: number) {
    const steps = Math.max(1, Math.round((ms / 1000) * FPS));
    await this.page.mouse.move(from.x, from.y);
    await this.page.mouse.down();
    for (let i = 1; i <= steps; i++) {
      const k = i / steps;
      await this.page.mouse.move(from.x + (to.x - from.x) * k, from.y + (to.y - from.y) * k);
      await this.frame();
    }
    await this.page.mouse.up();
  }
}

// ---------------------------------------------------------------------------
// Where the cube's stickers are on screen
// ---------------------------------------------------------------------------

type FaceKey = "U" | "D" | "F" | "B" | "L" | "R";

/** Same mapping as `placement` in src/components/RubiksCube.tsx. */
function placement(face: FaceKey, index: number): { cubie: number[]; normal: number[] } {
  const r = Math.floor(index / 3);
  const c = index % 3;
  switch (face) {
    case "U": return { cubie: [c - 1, 1, r - 1], normal: [0, 1, 0] };
    case "D": return { cubie: [c - 1, -1, 1 - r], normal: [0, -1, 0] };
    case "F": return { cubie: [c - 1, 1 - r, 1], normal: [0, 0, 1] };
    case "B": return { cubie: [1 - c, 1 - r, -1], normal: [0, 0, -1] };
    case "R": return { cubie: [1, 1 - r, 1 - c], normal: [1, 0, 0] };
    case "L": return { cubie: [-1, 1 - r, c - 1], normal: [-1, 0, 0] };
  }
}

/** The app's starting camera (see the scene setup in RubiksCube.tsx). */
const CAMERA_START = new THREE.Vector3(5.04, 5.28, 6.72);

/**
 * Turns a sticker into the pixel to tap, following the camera as it orbits.
 * The orbit mirrors OrbitControls: dragging (dx, dy) pixels turns the camera
 * by 2π·dx / (canvas height) around the vertical axis and 2π·dy / (canvas
 * height) up or down.
 */
class CubeView {
  /** Degrees the camera has swung left (around the cube) and down. */
  private yaw = 0;
  private pitch = 0;
  private rec: Recorder;
  private box: { x: number; y: number; width: number; height: number };

  private constructor(rec: Recorder, box: CubeView["box"]) {
    this.rec = rec;
    this.box = box;
  }

  static async of(rec: Recorder) {
    const box = await rec.page.locator("canvas").first().boundingBox();
    if (!box) throw new Error("no cube canvas on screen");
    return new CubeView(rec, box);
  }

  /** Where the camera is now. */
  private cameraPosition() {
    const s = new THREE.Spherical().setFromVector3(CAMERA_START);
    s.theta -= THREE.MathUtils.degToRad(this.yaw);
    s.phi += THREE.MathUtils.degToRad(this.pitch);
    return new THREE.Vector3().setFromSpherical(s);
  }

  /** Where the centre of sticker `face[index]` is, in page pixels. Throws if
   *  the sticker faces away from the camera (or only just), since tapping
   *  there would hit something else. */
  sticker(face: FaceKey, index: number): Point {
    const { cubie, normal } = placement(face, index);
    const n = new THREE.Vector3(normal[0], normal[1], normal[2]);
    const world = new THREE.Vector3(cubie[0], cubie[1], cubie[2]).addScaledVector(n, 0.481);
    const eye = this.cameraPosition();
    const facing = n.dot(eye.clone().sub(world).normalize());
    if (facing < 0.25) {
      throw new Error(`sticker ${face}${index} isn't facing the camera (yaw ${this.yaw}, pitch ${this.pitch})`);
    }
    const camera = new THREE.PerspectiveCamera(45, this.box.width / this.box.height, 0.1, 100);
    camera.position.copy(eye);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    const p = world.project(camera);
    return {
      x: this.box.x + ((p.x + 1) / 2) * this.box.width,
      y: this.box.y + ((1 - p.y) / 2) * this.box.height,
    };
  }

  /**
   * Swing the camera around the cube with one drag: `yaw` degrees to the left
   * (showing the L face) and `pitch` degrees down (showing the D face).
   * Negative values go the other way.
   */
  async orbit(yaw: number, pitch = 0) {
    const dx = (yaw / 360) * this.box.height;
    const dy = -(pitch / 360) * this.box.height; // dragging up lowers the camera
    const cx = this.box.x + this.box.width / 2;
    const cy = this.box.y + this.box.height * 0.62;
    await this.rec.drag({ x: cx - dx / 2, y: cy - dy / 2 }, { x: cx + dx / 2, y: cy + dy / 2 }, 800);
    this.yaw += yaw;
    this.pitch += pitch;
    await this.rec.hold(700); // the orbit's damping eases it to a stop
  }
}

// ---------------------------------------------------------------------------
// Showing taps
// ---------------------------------------------------------------------------

/**
 * A translucent circle wherever the pointer presses, following drags. Animated
 * with requestAnimationFrame, not CSS transitions, so it runs on the faked
 * clock like everything else.
 */
const TOUCH_INDICATOR = `
addEventListener("DOMContentLoaded", () => {
  const dot = document.createElement("div");
  Object.assign(dot.style, {
    position: "fixed", left: "0", top: "0", width: "46px", height: "46px",
    margin: "-23px 0 0 -23px", borderRadius: "50%", pointerEvents: "none",
    zIndex: "2147483647", background: "rgba(255,255,255,0.28)",
    border: "2px solid rgba(255,255,255,0.9)", opacity: "0",
  });
  document.body.appendChild(dot);
  let down = false, changed = -1e9;
  const at = (e) => { dot.style.left = e.clientX + "px"; dot.style.top = e.clientY + "px"; };
  addEventListener("pointerdown", (e) => { at(e); down = true; changed = performance.now(); }, true);
  addEventListener("pointermove", (e) => { if (down) at(e); }, true);
  addEventListener("pointerup", () => { down = false; changed = performance.now(); }, true);
  const tick = () => {
    const k = Math.min(1, (performance.now() - changed) / 180);
    const ease = 1 - (1 - k) * (1 - k);
    dot.style.opacity = String(down ? ease : 1 - ease);
    dot.style.transform = "scale(" + (down ? 0.6 + 0.4 * ease : 1 + 0.35 * ease) + ")";
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
});`;

/** The paint swatch for a colour, by its Bulgarian name (default scheme). */
const swatch = (name: string) => `button[aria-label="${name}"]`;

/** Tap Нареди and step through the answer it gives. */
async function solveAndPlay(rec: Recorder) {
  await rec.tap("text=Нареди >> nth=0", 300);
  // A new answer starts at "Начало", so the back arrow is disabled. The
  // solver answers from a worker, on real time rather than the page's clock.
  await rec.page.locator('[aria-label="Предишна стъпка"]:disabled').waitFor();
  await rec.hold(800);
  const trail = await rec.page.locator("header button:not([aria-label])").allTextContents();
  const steps = trail.length;
  console.log(`  solution: ${trail.slice(1).join(" ")}`);
  for (let i = 1; i < steps; i++) {
    await rec.tap('[aria-label="Следваща стъпка"]', 750);
  }
}

// ---------------------------------------------------------------------------
// Scenarios
// ---------------------------------------------------------------------------

type Scenario = (rec: Recorder) => Promise<void>;

/**
 * The white cross: paint the four white edges where they sit on a scrambled
 * cube (both stickers of each — the solver refuses a half-painted piece),
 * solve, and play the solution.
 * Layout: white-red at FR (white front), white-blue flipped in UF,
 * white-orange at FL (white left), white-green at UL (white up).
 * Solution: U' R U' F U B.
 */
async function whiteCross(rec: Recorder, cube: CubeView) {
  // Edges both of whose stickers face the camera from the start.
  await rec.tap(swatch("Бяло"));
  await rec.tapAt(cube.sticker("F", 5));
  await rec.tapAt(cube.sticker("F", 1));
  await rec.tap(swatch("Червено"));
  await rec.tapAt(cube.sticker("R", 3));
  await rec.tap(swatch("Синьо"));
  await rec.tapAt(cube.sticker("U", 7));

  // Turn the cube to reach the left side.
  await cube.orbit(75);
  await rec.tap(swatch("Бяло"));
  await rec.tapAt(cube.sticker("L", 5));
  await rec.tapAt(cube.sticker("U", 3));
  await rec.tap(swatch("Оранжево"));
  await rec.tapAt(cube.sticker("F", 3));
  await rec.tap(swatch("Зелено"));
  await rec.tapAt(cube.sticker("L", 1));
  await cube.orbit(-75);

  await solveAndPlay(rec);
}

/**
 * The white corners, on the cube the cross left: paint all three stickers of
 * each white corner where it sits, solve again, play the solution.
 * Layout (all four twisted in the front slots):
 *   UFR: U=red   F=blue   R=white     UFL: U=green F=white L=red
 *   DFR: D=white F=orange R=blue      DFL: D=green F=white L=orange
 * Solution: L' F D' R F' L D F' R' D F'.
 */
async function whiteCorners(rec: Recorder, cube: CubeView) {
  // Everything the starting view shows.
  await rec.tap(swatch("Бяло"));
  await rec.tapAt(cube.sticker("R", 0));
  await rec.tapAt(cube.sticker("F", 0));
  await rec.tapAt(cube.sticker("F", 6));
  await rec.tap(swatch("Червено"));
  await rec.tapAt(cube.sticker("U", 8));
  await rec.tap(swatch("Синьо"));
  await rec.tapAt(cube.sticker("F", 2));
  await rec.tapAt(cube.sticker("R", 6));
  await rec.tap(swatch("Зелено"));
  await rec.tapAt(cube.sticker("U", 6));
  await rec.tap(swatch("Оранжево"));
  await rec.tapAt(cube.sticker("F", 8));

  // Tip the cube to see its left and bottom sides.
  await cube.orbit(75, 70);
  await rec.tapAt(cube.sticker("L", 8));
  await rec.tap(swatch("Червено"));
  await rec.tapAt(cube.sticker("L", 2));
  await rec.tap(swatch("Зелено"));
  await rec.tapAt(cube.sticker("D", 0));
  await rec.tap(swatch("Бяло"));
  await rec.tapAt(cube.sticker("D", 2));
  await cube.orbit(-75, -70);

  await solveAndPlay(rec);
}

/**
 * The middle layer, on the cube the first two steps left: paint both stickers
 * of each of the four middle-layer edges where they sit, solve again, play the
 * solution. (Many middle-layer layouts are too much for the solver's search,
 * so this one was picked from those it answers.)
 * Layout: green-orange flipped at DF (green down), blue-orange at DR,
 * blue-red in FR (red front), green-red in FL (green front).
 * Solution: D' F L F D' L' U L' B' U'.
 */
async function middleEdges(rec: Recorder, cube: CubeView) {
  // Everything the starting view shows.
  await rec.tap(swatch("Червено"));
  await rec.tapAt(cube.sticker("F", 5));
  await rec.tap(swatch("Синьо"));
  await rec.tapAt(cube.sticker("R", 3));
  await rec.tap(swatch("Зелено"));
  await rec.tapAt(cube.sticker("F", 3));
  await rec.tap(swatch("Оранжево"));
  await rec.tapAt(cube.sticker("F", 7));
  await rec.tapAt(cube.sticker("R", 7));

  // Tip the cube to see its left and bottom sides.
  await cube.orbit(75, 70);
  await rec.tap(swatch("Червено"));
  await rec.tapAt(cube.sticker("L", 5));
  await rec.tap(swatch("Зелено"));
  await rec.tapAt(cube.sticker("D", 1));
  await rec.tap(swatch("Синьо"));
  await rec.tapAt(cube.sticker("D", 5));
  await cube.orbit(-75, -70);

  await solveAndPlay(rec);
}

/**
 * The yellow cross on the bottom, with the first two layers done: paint both
 * stickers of the four bottom edges where they sit, solve again, play it.
 * Layout: yellow-red flipped at DF, yellow-orange flipped at DR,
 * yellow-green at DB, yellow-blue at DL (yellow down on both).
 * Solution: D' L' D' F' D F L.
 */
async function yellowCross(rec: Recorder, cube: CubeView) {
  // Tip the cube to see its bottom, front and right.
  await cube.orbit(0, 70);
  await rec.tap(swatch("Жълто"));
  await rec.tapAt(cube.sticker("F", 7));
  await rec.tapAt(cube.sticker("R", 7));
  await rec.tapAt(cube.sticker("D", 7));
  await rec.tapAt(cube.sticker("D", 3));
  await rec.tap(swatch("Червено"));
  await rec.tapAt(cube.sticker("D", 1));
  await rec.tap(swatch("Оранжево"));
  await rec.tapAt(cube.sticker("D", 5));

  // Round to the back and left.
  await cube.orbit(180);
  await rec.tap(swatch("Зелено"));
  await rec.tapAt(cube.sticker("B", 7));
  await rec.tap(swatch("Синьо"));
  await rec.tapAt(cube.sticker("L", 7));
  await cube.orbit(-180, -70);

  await solveAndPlay(rec);
}

/**
 * The yellow corners, the last step: paint all three stickers of each bottom
 * corner, solve again, play it — and the cube is solved.
 * Layout (a twisted three-cycle; DFR is already home):
 *   DFR: D=yellow F=green R=red       DFL: D=red    F=yellow L=blue
 *   DBR: D=orange R=yellow B=blue     DBL: D=yellow B=orange L=green
 * Solution: R F' R' B R F R' B'.
 */
async function yellowCorners(rec: Recorder, cube: CubeView) {
  // Tip the cube to see its bottom, front and right.
  await cube.orbit(0, 70);
  await rec.tap(swatch("Жълто"));
  await rec.tapAt(cube.sticker("D", 2));
  await rec.tapAt(cube.sticker("F", 6));
  await rec.tapAt(cube.sticker("R", 8));
  await rec.tapAt(cube.sticker("D", 6));
  await rec.tap(swatch("Зелено"));
  await rec.tapAt(cube.sticker("F", 8));
  await rec.tap(swatch("Червено"));
  await rec.tapAt(cube.sticker("R", 6));
  await rec.tapAt(cube.sticker("D", 0));
  await rec.tap(swatch("Оранжево"));
  await rec.tapAt(cube.sticker("D", 8));

  // Round to the back and left.
  await cube.orbit(180);
  await rec.tapAt(cube.sticker("B", 8));
  await rec.tap(swatch("Синьо"));
  await rec.tapAt(cube.sticker("L", 8));
  await rec.tapAt(cube.sticker("B", 6));
  await rec.tap(swatch("Зелено"));
  await rec.tapAt(cube.sticker("L", 6));
  await cube.orbit(-180, -70);

  await solveAndPlay(rec);
}

const SCENARIOS: Record<string, Scenario> = {
  "white-cross": async (rec) => {
    const cube = await CubeView.of(rec);
    await rec.hold(900);
    await whiteCross(rec, cube);
    await rec.hold(2400); // admire the cross before the loop restarts
  },

  /** Picks up where "white-cross" ends: that is played off camera first. */
  "white-corners": async (rec) => {
    const cube = await CubeView.of(rec);
    rec.filming = false;
    await whiteCross(rec, cube);
    await rec.hold(600);
    rec.filming = true;
    await rec.hold(900);
    await whiteCorners(rec, cube);
    await rec.hold(2400); // admire the finished first layer before the loop restarts
  },

  /** Picks up where "white-corners" ends: both earlier steps are played off camera. */
  "middle-edges": async (rec) => {
    const cube = await CubeView.of(rec);
    rec.filming = false;
    await whiteCross(rec, cube);
    await whiteCorners(rec, cube);
    await rec.hold(600);
    rec.filming = true;
    await rec.hold(900);
    await middleEdges(rec, cube);
    await rec.hold(2400); // admire the two finished layers before the loop restarts
  },

  /** Picks up where "middle-edges" ends: the earlier steps are played off camera. */
  "yellow-cross": async (rec) => {
    const cube = await CubeView.of(rec);
    rec.filming = false;
    await whiteCross(rec, cube);
    await whiteCorners(rec, cube);
    await middleEdges(rec, cube);
    await rec.hold(600);
    rec.filming = true;
    await rec.hold(900);
    await yellowCross(rec, cube);
    await rec.hold(2400);
  },

  /** Picks up where "yellow-cross" ends, and finishes the cube. */
  "yellow-corners": async (rec) => {
    const cube = await CubeView.of(rec);
    rec.filming = false;
    await whiteCross(rec, cube);
    await whiteCorners(rec, cube);
    await middleEdges(rec, cube);
    await yellowCross(rec, cube);
    await rec.hold(600);
    rec.filming = true;
    await rec.hold(900);
    await yellowCorners(rec, cube);
    await rec.hold(2400); // admire the solved cube before the loop restarts
  },
};

// ---------------------------------------------------------------------------
// Running a scenario and encoding the result
// ---------------------------------------------------------------------------

async function record(name: string, scenario: Scenario, url: string, dry: boolean) {
  const frames = mkdtempSync(join(tmpdir(), `demo-${name}-`));
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM ?? "/usr/bin/chromium",
    // WebGL in headless Chrome runs on SwiftShader, which newer Chrome only
    // allows when asked.
    args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
  });
  try {
    const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: SCALE });
    await context.addInitScript(TOUCH_INDICATOR);
    const page = await context.newPage();
    await page.clock.install();
    await page.goto(url);
    await page.locator("canvas").first().waitFor();
    // Fonts, the solver and today's scramble load on real time; let the
    // page's own clock catch up too.
    await page.waitForTimeout(1500);
    // Then stop the clock: from here on, only `Recorder.frame` moves it,
    // 1/FPS at a time. (Installed, the fake clock still runs in real time.)
    const now = await page.evaluate(() => Date.now());
    await page.clock.pauseAt(now + 100);

    const rec = new Recorder(page, frames);
    if (dry) {
      // Run the whole scenario off camera, e.g. to check its solutions.
      rec.filming = false;
      Object.defineProperty(rec, "filming", { get: () => false, set: () => {} });
      await scenario(rec);
      console.log(`${name}: dry run done`);
      return;
    }
    await scenario(rec);
    const length = rec.frames / FPS;
    console.log(`${name}: ${rec.frames} frames, ${length.toFixed(1)}s`);

    mkdirSync(OUT_DIR, { recursive: true });
    const out = join(OUT_DIR, name);
    const input = ["-y", "-loglevel", "error", "-framerate", String(FPS), "-i", join(frames, "%05d.jpg")];
    const filters = `fade=in:st=0:d=${FADE},fade=out:st=${(length - FADE).toFixed(3)}:d=${FADE},format=yuv420p`;
    execFileSync("ffmpeg", [...input, "-vf", filters, "-c:v", "libx264", "-preset", "slow", "-crf", "24", "-movflags", "+faststart", "-an", `${out}.mp4`]);
    execFileSync("ffmpeg", [...input, "-vf", filters, "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "34", "-row-mt", "1", "-an", `${out}.webm`]);
    // Poster: the finished result, just before the fade out.
    const posterFrame = Math.max(0, rec.frames - Math.round((FADE + 0.3) * FPS));
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", join(frames, `${String(posterFrame).padStart(5, "0")}.jpg`), "-q:v", "4", `${out}.jpg`]);
    console.log(`wrote ${out}.mp4, .webm, .jpg`);
  } finally {
    await browser.close();
    rmSync(frames, { recursive: true, force: true });
  }
}

const args = process.argv.slice(2);
const dryFlag = args.indexOf("--dry");
const dry = dryFlag >= 0 && Boolean(args.splice(dryFlag, 1));
const urlFlag = args.indexOf("--url");
const url = urlFlag >= 0 ? args.splice(urlFlag, 2)[1] : "http://localhost:3000";
const names = args.length ? args : Object.keys(SCENARIOS);
for (const name of names) {
  const scenario = SCENARIOS[name];
  if (!scenario) throw new Error(`unknown scenario "${name}"; have: ${Object.keys(SCENARIOS).join(", ")}`);
  await record(name, scenario, url, dry);
}
