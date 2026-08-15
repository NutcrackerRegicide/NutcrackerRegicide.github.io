#!/usr/bin/env node
/* patch-looks-visible.js — the same vacuity as v132.39's, made twice in one session.
 *
 * ── WHAT HAPPENED ───────────────────────────────────────────────────────────────────────────
 * "…and it VANISHES when the buff does" reads buffFxStats().looks, which is _lookOn — a counter
 * of what was DRAWN THIS FRAME. Delete the hide-all pass, so every look ever drawn stays on
 * screen for the rest of the match, and _lookOn still reads 0 next frame because nothing was
 * drawn. The meshes are all still there. The gate stayed green under the exact mutation it exists
 * to catch.
 *
 * tools/patch-smoketest-rings-fix2.js is that same bug, found the same way, earlier in this same
 * session, in the same file — the ring version read _ringOn instead of counting visible meshes. I
 * fixed it there, wrote up why, and then built the look pool by copying the shape of the ring
 * pool, counter and all.
 *
 * ── THE FIX, AND THE RULE ───────────────────────────────────────────────────────────────────
 * buffFxStats() now reports lookVis and ringVis — actual VISIBLE meshes — alongside the draw
 * counters, and the disappearance gates read those. The draw counters keep their uses: a delta
 * across one tick is exactly what "walking into the king's light adds one ring" needs.
 *   The rule, since it has now cost two rounds: a counter reset every frame can answer "how much
 * work did this frame do", and it can never answer "what is on screen".
 */
const fs=require("fs"),path=require("path");
let failed=[];
function mk(box){return function(name,from,to){
  const n=box.o.split(from).length-1;
  if(n!==1){failed.push(name+" (matched "+n+" times, need exactly 1)");return;}
  box.o=box.o.split(from).join(to);};}
const P={comb:path.join(__dirname,"..","js","05-combat.js"),
         st:path.join(__dirname,"smoketest.js")};
const c={o:fs.readFileSync(P.comb,"utf8")}, t={o:fs.readFileSync(P.st,"utf8")};
const subC=mk(c), subT=mk(t);

subC("report VISIBLE meshes, not draws-this-frame",
`function buffFxStats(){return {rings:_ringOn,looks:_lookOn,lookPool:_lookPool?_lookPool.length:0,
  pool:_ringPool?_ringPool.length:0,`,
`// ⚠ rings/looks count what was DRAWN THIS FRAME; ringVis/lookVis count what is ON SCREEN. They
// answer different questions and only the second one can see a hide-all pass that stopped
// running — a draw counter reads zero either way. See tools/patch-looks-visible.js.
function buffFxStats(){return {rings:_ringOn,looks:_lookOn,lookPool:_lookPool?_lookPool.length:0,
  lookVis:_lookPool?_lookPool.filter(m=>m.visible).length:0,
  ringVis:_ringPool?_ringPool.filter(m=>m.visible).length:0,
  pool:_ringPool?_ringPool.length:0,`);

subT("the disappearance gate reads visible meshes",
`          L.buffs={}; FX(0.016);
          check("v132.42 looks: …and it VANISHES when the buff does, with nothing having to "+
            "notice ("+S().looks+")",S().looks===0);`,
`          L.buffs={}; FX(0.016);
          // ⚠ lookVis, NOT looks. looks counts draws THIS FRAME, so deleting the hide-all pass —
          // which leaves every look ever drawn on screen for the rest of the match, the exact bug
          // named here — still reads 0. Same vacuity as the ring version earlier this session.
          check("v132.42 looks: …and it VANISHES when the buff does, with nothing having to "+
            "notice ("+S().lookVis+" still visible)",S().lookVis===0);`);

subT("the opening gate too",
`          check("v132.42 looks: the stage is clear before the block ("+S().looks+")",S().looks===0);`,
`          check("v132.42 looks: the stage is clear before the block ("+S().lookVis+" visible)",
            S().lookVis===0);`);

if(failed.length){
  console.error("REFUSING TO WRITE — anchors failed:");
  failed.forEach(f=>console.error("  - "+f));
  process.exit(1);
}
fs.writeFileSync(P.comb,c.o); fs.writeFileSync(P.st,t.o);
console.log("patched — the look gates count what is on screen");
