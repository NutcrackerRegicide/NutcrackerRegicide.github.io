#!/usr/bin/env node
/* patch-playtest-1.js — v132.47: John's playtest, items 1 and 4.
 *
 * ══ 1. SANCTUARY HEALS WHILE YOU WALK ═══════════════════════════════════════════════════════
 * "sanctuary seems to heal even when i am moving" — it does, always, for everybody, and it has
 * since v132.35.
 *
 * u.moving is a CONSUMABLE flag. animateUnit() reads it and clears it on its first line:
 *     const moving=u.moving; u.moving=false;
 * and animateUnit runs from updateUnitCommon, which 09-main.js calls at line 744 — four lines
 * BEFORE statusTick at 748, which is what drives auraBuffTick. So by the time the stillness clock
 * looks at u.moving it has already been consumed and reads false. The clock has never once been
 * reset by walking. 10-net.js:2167 even calls it "the consumable flag" in a comment.
 *   This is not a flag that needs setting later; it is a flag that cannot be trusted from here at
 * all. "Still" means "has not moved", so the fix MEASURES it: the unit's own position, compared
 * against where it was on the previous scan. That is immune to frame ordering, to who consumed
 * what, and to any future reordering of the two calls.
 *
 * ⚠ AND THE THRESHOLD IS NOT ZERO. Units drift by tiny amounts from separation and terrain
 * settling even when nobody is walking, so a zero-tolerance test would mean the zone could never
 * open at all. STILL_EPS is a quarter of a unit per scan — far below a walk, far above a jitter.
 *
 * ══ 4. THE LEVEL AURA LINGERS ═══════════════════════════════════════════════════════════════
 * "it needs to go away much much quicker" — and the screenshot shows exactly why it reads badly:
 * the motes are hanging in the air over the buildings where units USED TO BE. A mote is emitted at
 * a position and then rises on its own; it does not follow the unit. So at 1.45 seconds of life
 * and 1.55 units/sec of climb, a walking player leaves a trail of sparks two units long behind
 * and above them, and a player who has walked away leaves it hanging over empty ground.
 *   Life drops to 0.55s and the climb to 0.9 u/s, so a mote travels half a unit instead of two
 *   and a quarter and dies near the body that made it. The EMISSION RATE is untouched: the aura
 *   should still be as dense at level 25, it should just not smear.
 */
const fs=require("fs"),path=require("path");
let failed=[];
function mk(box){return function(name,from,to){
  const n=box.o.split(from).length-1;
  if(n!==1){failed.push(name+" (matched "+n+" times, need exactly 1)");return;}
  box.o=box.o.split(from).join(to);};}
const P={comb:path.join(__dirname,"..","js","05-combat.js"),
         data:path.join(__dirname,"..","js","00-data.js")};
const c={o:fs.readFileSync(P.comb,"utf8")}, d={o:fs.readFileSync(P.data,"utf8")};
const subC=mk(c), subD=mk(d);

subC("stillness is MEASURED, not flagged",
`  // SANCTUARY's clock. Deliberately not reset by taking damage — standing your ground under fire
  // is the whole fantasy.
  u._stillT=u.moving?0:(u._stillT||0)+dt;`,
`  // SANCTUARY's clock. Deliberately not reset by taking damage — standing your ground under fire
  // is the whole fantasy.
  // ⚠ v132.47: MEASURED, not flagged. u.moving is CONSUMABLE — animateUnit clears it on its first
  // line, and updateUnitCommon (which calls it) runs BEFORE statusTick, which drives this. So this
  // clock read a flag that had already been wiped and was never once reset by walking: the zone
  // healed you at a dead run, from v132.35 until John walked out of it and kept healing.
  // Position cannot be consumed by anything, and does not care what order the frame runs in.
  {
    const _px=u.root.position.x, _pz=u.root.position.z;
    const _lx=(u._stillX===undefined)?_px:u._stillX, _lz=(u._stillZ===undefined)?_pz:u._stillZ;
    const _d2=(_px-_lx)*(_px-_lx)+(_pz-_lz)*(_pz-_lz);
    u._stillX=_px; u._stillZ=_pz;
    // not zero: separation and terrain settling nudge a standing unit, and a zero-tolerance test
    // would mean the zone could never open at all
    u._stillT=(_d2>STILL_EPS*STILL_EPS)?0:(u._stillT||0)+dt;
  }`);

subC("the threshold",
`const AURA_STILL=3;      // SANCTUARY's stillness clock`,
`const AURA_STILL=3;      // SANCTUARY's stillness clock
const STILL_EPS=0.25;    // v132.47: how far a "still" unit may drift between frames. Far below a
                         // walking pace, far above the jitter of separation and terrain settling.`);

subD("the aura stops smearing",
`      AURA_LIFE=1.45,      // seconds a mote lives
      AURA_RISE=1.55,      // units/sec it climbs`,
`      // v132.47 (John, playtesting): "the aura lingers too long… it needs to go away much much
      // quicker". A mote is emitted at a POSITION and then rises on its own — it does not follow
      // the unit. At 1.45s and 1.55u/s each one travelled 2.2 units, so a walking player dragged a
      // two-unit smear behind them and a player who had walked away left it hanging over empty
      // ground, which is what his screenshot shows above the houses.
      // Life and climb only. The RATE is untouched: level 25 should be no less dense, it should
      // simply not smear.
      AURA_LIFE=0.55,      // seconds a mote lives (was 1.45)
      AURA_RISE=0.90,      // units/sec it climbs (was 1.55) — half a unit travelled, not 2.2`);

if(failed.length){
  console.error("REFUSING TO WRITE — anchors failed:");
  failed.forEach(f=>console.error("  - "+f));
  process.exit(1);
}
fs.writeFileSync(P.comb,c.o); fs.writeFileSync(P.data,d.o);
console.log("patched — sanctuary measures stillness; the aura stops smearing");
