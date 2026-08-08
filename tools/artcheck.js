#!/usr/bin/env node
/* artcheck.js — THE CRITIC'S EYES.
 *
 * Renders the same six vantage points vista.js uses, drops them in a labelled folder,
 * and builds side-by-side pairs against the frozen v129.4 baseline plus a contact sheet.
 * A critic agent that has to hunt for two files and remember which was which will
 * eventually compare the wrong pair and score it confidently; this makes the comparison
 * the only thing on screen.
 *
 * Usage:
 *   node tools/artcheck.js <label>        render current build, diff against baseline
 *   node tools/artcheck.js <label> --keep keep the previous run of the same label
 *
 * Outputs under _art/<label>/ :
 *   shot-*.png      the raw renders (what the game looks like now)
 *   pair-*.png      baseline LEFT, current RIGHT, captioned
 *   contact.png     all six pairs stacked — the one file to look at first
 *   metrics.json    draw calls / tris / geometries / textures, and the delta vs baseline
 *
 * WHY NOT JUST RE-RUN vista.js: because the frame-cost numbers have to travel WITH the
 * picture. Every visual change in this project has to be paid for out of a 17fps budget,
 * and a critic looking at a prettier screenshot with no idea it cost 400 draw calls will
 * approve the change that makes the game unplayable.
 */
const fs = require("fs"), path = require("path"), cp = require("child_process");
const ROOT = path.join(__dirname, "..");
const BASE = path.join(ROOT, "_baseline_v129.4");
const label = process.argv[2] || "current";
const OUT = path.join(ROOT, "_art", label);

// 07-downsun has no entry in _baseline_v129.4 and is not supposed to: it is a vantage the freeze
// never shot. It is copied in and left unpaired — the pair loop below skips anything the baseline
// does not carry, so a new vantage costs nothing and does not put a half-empty panel on the sheet.
const SHOTS = ["01-meadow", "02-town", "03-forest", "04-crowd", "05-lowsun", "06-wide", "07-downsun"];

// v131 THIS TOOL WAS MANUFACTURING A TRIANGLE REGRESSION THAT DID NOT EXIST, and the v130.7 critic
// scored a lane on it: "372,169 triangles against a 174,803 baseline … roughly +140k landed in the
// static scene." Nothing landed in the static scene. THE TWO NUMBERS WERE NEVER THE SAME MEASUREMENT.
//   · 174,803 is vista.js's read-out — the composer, the 06-wide camera at (0,60,130), frustum
//     culling most of the map away.
//   · 372,169 is drawcost.js's — renderer.render, a 1400x760 buffer, and a camera parked 18 units
//     off a Town Centre at (-170,14,18) where a whole base is inside the frustum.
// Two cameras, two viewports, two culls. Subtracting one from the other is not a delta, and the
// `delta.tris` field below has been printing that subtraction into metrics.json since it was added.
// Measured properly — drawcost.js run against `git archive HEAD`, same vantage, same process
// arithmetic — the pre-overhaul static scene was 193 calls / 314,461 tris and today it is 196 /
// 314,059. The static scene went DOWN 402 triangles. Every triangle the overhaul actually spent is
// in the units (720/unit → 1,170/unit), which is the number the units lane reported all along.
// So the baseline now carries BOTH measurements, each labelled with the tool that can reproduce it,
// and the triangle gate is stated against the one that has a camera the tool actually drives.
// RE-BASELINE `drawcostBase` WHENEVER THE OWNER ACCEPTS A NEW STATIC-SCENE COST — that is what makes
// this a gate instead of a number in a log. See ART-DIRECTION-AGES.md §H A10.
const BASE_METRICS = {
  // vista.js read-out at 06-wide, through the composer — the v129.4 freeze. NOT comparable with
  // anything drawcost prints; kept because the draw-call figure is what §9.3's budget is written in.
  drawCalls: 607, tris: 174803, geometries: 1392, textures: 30,
  // drawcost.js at the Town Centre vantage. THIS is the one the triangle gate reads.
  // Captured 2026-08-07 from git archive HEAD (v130.7, pre-overhaul).
  drawcostBase: { staticTris: 314461, staticCalls: 193, trisPerUnit: 720 },
  // AD §9.3 / F9's camera-pass ceiling, also drawcost.js and also that vantage: the overhaul must
  // finish under 678 (match start) / 975 (11-building mid-game base) WITH units in frame.
  f9: { start: 678, base: 975 },
};
// §H A10: a costume batch may spend 15% of the static scene's triangles and no more without the
// owner signing it off. Per-unit is the number the unit lanes move, and it is reported separately
// so a hat that quietly doubles a unit cannot hide inside a static-scene budget 300x its size.
const TRI_BUDGET = 0.15;

function sh(cmd) { return cp.execSync(cmd, { stdio: ["ignore", "pipe", "pipe"], maxBuffer: 1 << 26 }).toString(); }

if (!process.argv.includes("--keep")) fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

// ---- 1. render the current build ------------------------------------------------
// vista.js always writes to _vista/, so run it and move the results under our label.
console.log("rendering six vantage points…");
const vistaOut = path.join(ROOT, "_vista");
fs.rmSync(vistaOut, { recursive: true, force: true });
let renderLog = "";
try {
  renderLog = sh(`cd ${JSON.stringify(ROOT)} && node tools/vista.js 2>&1`);
} catch (e) {
  renderLog = (e.stdout ? e.stdout.toString() : "") + (e.stderr ? e.stderr.toString() : "");
  console.error("vista.js failed — see render.log");
}
fs.writeFileSync(path.join(OUT, "render.log"), renderLog);

for (const s of SHOTS) {
  const src = path.join(vistaOut, s + ".png");
  if (fs.existsSync(src)) fs.copyFileSync(src, path.join(OUT, "shot-" + s + ".png"));
}

// ---- 2. the numbers, straight out of vista's own read-out ------------------------
// vista.js prints: "render: N draw calls · N triangles · N geometries · N textures · N scene children"
const m = renderLog.match(/render:\s*([\d,]+)\s*draw calls[^\d]*([\d,]+)\s*triangles[^\d]*([\d,]+)\s*geometries[^\d]*([\d,]+)\s*textures/);
const num = s => parseInt(String(s).replace(/,/g, ""), 10);
const metrics = m
  ? { drawCalls: num(m[1]), tris: num(m[2]), geometries: num(m[3]), textures: num(m[4]) }
  : null;

// vista's final read-out is taken after the scene is torn down on some builds, so it can
// report 1 draw call. drawcost.js is the trustworthy source for the scene-cost numbers.
let drawcost = null;
try {
  const dc = sh(`cd ${JSON.stringify(ROOT)} && node tools/drawcost.js 2>&1`);
  fs.writeFileSync(path.join(OUT, "drawcost.log"), dc);
  const w = dc.match(/scene WITH\s+(\d+) units:\s*([\d,]+)\s*draw calls\s*([\d,]+)\s*tris/);
  const wo = dc.match(/scene WITHOUT units\s*:\s*([\d,]+)\s*draw calls\s*([\d,]+)\s*tris/);
  if (w) drawcost = {
    units: num(w[1]), withUnits: { drawCalls: num(w[2]), tris: num(w[3]) },
    withoutUnits: wo ? { drawCalls: num(wo[1]), tris: num(wo[2]) } : null,
  };
} catch (e) { /* drawcost is a nice-to-have; the pictures are the point */ }

const report = {
  label,
  when: new Date().toISOString(),
  baseline: BASE_METRICS,
  vistaReadout: metrics,
  drawcost,
  delta: drawcost ? (() => {
    const B = BASE_METRICS.drawcostBase;
    const statTris = drawcost.withoutUnits ? drawcost.withoutUnits.tris : null;
    const perUnit = drawcost.units
      ? Math.round((drawcost.withUnits.tris - (statTris === null ? 0 : statTris)) / drawcost.units) : null;
    const statCalls = drawcost.withoutUnits ? drawcost.withoutUnits.drawCalls : null;
    return {
      // v131.2 THE CALL DELTA WAS THE VERY MISTAKE THE COMMENT ABOVE WAS WRITTEN TO STOP, LEFT IN
      // PLACE FOR HALF THE FILE. It was `drawcost.withUnits.drawCalls - BASE_METRICS.drawCalls` —
      // 537 taken by drawcost.js at a Town Centre closeup in a 1400x760 buffer, minus 607 taken by
      // vista.js through the composer at 06-wide — printed as the headline "-70 FREE or cheaper
      // than baseline". Two cameras, two viewports, two culls, and the subtraction reads as a WIN,
      // which is the worst direction for a wrong number to point. The triangle gate below was fixed
      // for exactly this in v131 and the call gate was not. Like for like is withoutUnits against
      // drawcostBase.staticCalls: same tool, same vantage, same process arithmetic. It comes out at
      // +1, not -70.
      // THE WITH-UNITS NUMBER IS STILL REPORTED, against §9.3's own 678/975 — which is a drawcost
      // figure and therefore comparable — but it is deliberately NOT the gate: unit population at
      // that vantage varies with AI timing, so it cannot be A/B'd between two runs of a batch.
      staticCalls: statCalls, staticCallsBase: B.staticCalls,
      staticCallsDelta: statCalls === null ? null : statCalls - B.staticCalls,
      sceneCalls: drawcost.withUnits.drawCalls, sceneCallsF9: BASE_METRICS.f9,
      // like for like, both from drawcost.js at the same vantage — see the note at BASE_METRICS
      staticTris: statTris, staticTrisBase: B.staticTris,
      staticTrisDelta: statTris === null ? null : statTris - B.staticTris,
      trisPerUnit: perUnit, trisPerUnitBase: B.trisPerUnit,
      trisPerUnitDelta: perUnit === null ? null : perUnit - B.trisPerUnit,
      triVerdict: statTris === null ? "not measured"
        : statTris > B.staticTris * (1 + TRI_BUDGET)
          ? "STATIC SCENE OVER TRIANGLE BUDGET — >15% above the recorded baseline (§H A10)"
          : statTris > B.staticTris ? "acceptable — static scene within 15% of baseline"
            : "static scene FREE or cheaper than baseline",
      // v131.1 …AND THE SECOND HALF OF §H A10 HAD NO VERDICT AT ALL. The clause fails a batch on
      // EITHER number — static scene or per unit — and the line above only ever read the first, so
      // the tool printed "per unit 1331 (base 720) → +611" and then, one line up, the word
      // "acceptable". A critic reading the summary sees a green verdict beside a number that is 85%
      // over budget, which is precisely the silence this whole clause exists to break: draw calls
      // went DOWN 64 across the batch that spent those triangles, so the only gate that fires today
      // is the one that was already passing. Both halves get their own sentence now, and the
      // headline `verdict` is the WORSE of the three rather than the draw-call one wearing the
      // crown. A costume batch that doubles a unit has to be signed off, not merely mentioned.
      unitTriVerdict: perUnit === null ? "not measured"
        : perUnit > B.trisPerUnit * (1 + TRI_BUDGET)
          ? "PER-UNIT OVER TRIANGLE BUDGET — >15% above the recorded baseline, needs owner sign-off (§H A10)"
          : perUnit > B.trisPerUnit ? "acceptable — per unit within 15% of baseline"
            : "per unit FREE or cheaper than baseline",
      verdict: statCalls === null ? "not measured"
        : statCalls > B.staticCalls * (1 + TRI_BUDGET)
          ? "STATIC SCENE OVER DRAW-CALL BUDGET — >15% above the recorded baseline (§H A10 / §9.3)"
          : statCalls > B.staticCalls ? "acceptable — static scene within 15% of baseline"
            : "static scene FREE or cheaper than baseline",
      // §9.3's own ceiling, reported not gated — see the note above.
      sceneCallVerdict: drawcost.withUnits.drawCalls > BASE_METRICS.f9.base
        ? "OVER §9.3 — above the 975-call mid-game ceiling"
        : drawcost.withUnits.drawCalls > BASE_METRICS.f9.start
          ? "under the 975 mid-game ceiling, above the 678 match-start one"
          : "under both §9.3 ceilings",
    };
  })() : null,
};
fs.writeFileSync(path.join(OUT, "metrics.json"), JSON.stringify(report, null, 2));

// ---- 3. the pairs, captioned so the critic cannot mix them up -------------------
// The caption used to read "537 draw calls (baseline 607)" — the same two-camera subtraction as the
// delta, pasted onto every pair image where it is the last thing a critic reads. Static scene
// against the static baseline, both from drawcost at one vantage, or nothing.
const cap = drawcost && drawcost.withoutUnits
  ? `${label}  —  static scene ${drawcost.withoutUnits.drawCalls} draw calls (drawcost base ${BASE_METRICS.drawcostBase.staticCalls})`
  : label;
let paired = 0;
for (const s of SHOTS) {
  const a = path.join(BASE, s + ".png");
  const b = path.join(OUT, "shot-" + s + ".png");
  if (!fs.existsSync(a) || !fs.existsSync(b)) continue;
  const out = path.join(OUT, "pair-" + s + ".png");
  try {
    sh(`convert ${JSON.stringify(a)} -resize 900x -bordercolor '#111' -border 6 ` +
       `-background '#111' -fill '#ddd' -pointsize 22 label:'BEFORE  v129.4  —  ${s}' +swap -gravity center -append /tmp/_a.png && ` +
       `convert ${JSON.stringify(b)} -resize 900x -bordercolor '#111' -border 6 ` +
       `-background '#111' -fill '#7fd77f' -pointsize 22 label:'AFTER  ${cap.replace(/'/g, "")}' +swap -gravity center -append /tmp/_b.png && ` +
       `convert /tmp/_a.png /tmp/_b.png +append -background '#111' -bordercolor '#111' -border 10 ${JSON.stringify(out)}`);
    paired++;
  } catch (e) { console.error("pair failed for", s, e.message.split("\n")[0]); }
}

if (paired) {
  try {
    sh(`montage ${JSON.stringify(path.join(OUT, "pair-*.png"))} -tile 1x -geometry +0+8 ` +
       `-background '#111' ${JSON.stringify(path.join(OUT, "contact.png"))}`);
  } catch (e) { console.error("contact sheet failed:", e.message.split("\n")[0]); }
}

console.log("\n=== artcheck: " + label + " ===");
// counted against SHOTS.length, not a hardcoded 6 — the seventh vantage printed "7/6" for one run
console.log("shots   :", SHOTS.filter(s => fs.existsSync(path.join(OUT, "shot-" + s + ".png"))).length + "/" + SHOTS.length);
console.log("pairs   :", paired + "/" + SHOTS.length + " (07-downsun has no v129.4 baseline — unpaired by design)");
if (drawcost) {
  const d = report.delta, sgn = n => (n >= 0 ? "+" : "") + n;
  if (d.staticCalls !== null)
    console.log("calls   : static scene", d.staticCalls, "(drawcost base " + d.staticCallsBase + ")  →", sgn(d.staticCallsDelta), " " + d.verdict);
  console.log("        : with units  ", d.sceneCalls, "(§9.3 ceilings " + d.sceneCallsF9.start + " start / " + d.sceneCallsF9.base + " base)  —", d.sceneCallVerdict);
  // Unit population at this vantage moves with AI timing, so this number cannot be A/B'd between
  // two runs of one batch and the 678 line is not a gate. The 975 ceiling still is: noise here
  // moves the count by tens, and F9 fails a build that goes through it.
  console.log("        :              only the 975 ceiling is a gate — the 678 line moves with AI timing");
  // THE TRIANGLE LINE — added v131 because nothing printed it and a lane got scored on a subtraction
  // of two different cameras. Both halves are drawcost.js at the same vantage, so both are real.
  if (d.staticTris !== null)
    console.log("tris    : static scene", d.staticTris, "(base " + d.staticTrisBase + ")  →", sgn(d.staticTrisDelta), " " + d.triVerdict);
  if (d.trisPerUnit !== null)
    console.log("        : per unit    ", d.trisPerUnit, "(base " + d.trisPerUnitBase + ")  →", sgn(d.trisPerUnitDelta), " " + d.unitTriVerdict);
  if (d.trisPerUnit !== null)
    console.log("        :              whole frame", drawcost.withUnits.tris, "over", drawcost.units, "units");
  // ONE LINE THAT SAYS PASS OR FAIL. Three verdicts printed three lines apart is three chances for a
  // reader to take the friendliest one; §H A10 fails the batch if ANY of them does.
  const bad = [d.verdict, d.triVerdict, d.unitTriVerdict, d.sceneCallVerdict]
    .filter(v => /OVER BUDGET|OVER TRIANGLE BUDGET|OVER DRAW-CALL BUDGET|OVER §9\.3/.test(v));
  console.log("GATE    :", bad.length ? "FAIL (§H A10) — " + bad.join(" | ") : "pass — draw calls, static triangles and per-unit triangles all within budget");
}
console.log("out     :", OUT);
console.log("look at :", path.join(OUT, "contact.png"));
