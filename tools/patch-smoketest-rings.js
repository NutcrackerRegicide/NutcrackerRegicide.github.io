#!/usr/bin/env node
/* patch-smoketest-rings.js — gate the Batch D rings.
 *
 * ── THE ASSERTION THAT PROTECTS THE MAP ─────────────────────────────────────────────────────
 * The very first gate is that the ring geometry is NOT BUILT AT LOAD. Seventeen geometries and a
 * material constructed at file scope would run inside the seeded world-gen window, and in r128
 * every BufferGeometry and every Material mints a uuid — four random draws each. That shifts every
 * subsequent draw and moves every tree on the map. `nodehash` would catch it after the fact; this
 * catches it in the file that caused it, and says why.
 *
 * ── AND THE ONES THAT PROTECT THE FRAME ─────────────────────────────────────────────────────
 * The pool must stay a pool. Hundreds of frames with rings coming and going must not grow it
 * without bound — a leak here is a mesh added to the scene every frame, which is the classic way
 * a display feature becomes a frame-rate bug three minutes into a match.
 *
 * ── THE EFFECTS ARE MEASURED, NOT MERELY PRESENT ────────────────────────────────────────────
 * "Something was drawn" is not the claim. The claims are:
 *   · UNBOWED's ring TIGHTENS with the enemy count — the drawn radius at 0 enemies is strictly
 *     larger than at the cap. If it did not, the ring would be decoration rather than a reading.
 *   · PHALANX gains a SECOND ring at its cap — one ring below, two at it.
 *   · SANCTUARY GROWS over the stillness clock, and its radius at half-wound is about half.
 *   · A unit that DROPS the buff leaves nothing behind. This is the hide-all-then-re-arm, and
 *     getting it wrong leaves a ring on the ground forever.
 *
 * ── AND THE ONE THAT MAKES IT A GAME FEATURE RATHER THAN A HOST FEATURE ─────────────────────
 * buffFxTick is driven from updateEffects because BOTH frame paths call it. That is asserted by
 * driving a real NET.guestFrame and checking a ring appeared — not by reading the source and
 * agreeing with myself. Trap #12 is exactly this mistake, and it shipped once already.
 */
const fs=require("fs"),path=require("path");
const F=path.join(__dirname,"smoketest.js");
let s=fs.readFileSync(F,"utf8");
let failed=[];
function sub(name,from,to){
  const n=s.split(from).length-1;
  if(n!==1){failed.push(name+" (matched "+n+" times, need exactly 1)");return;}
  s=s.split(from).join(to);
}

// ⚠ `NET.PROTO===40` appears at TWO sites, so neither can be an anchor on its own — that is the
// documented patch trap, and the exactly-once rule caught it. Each is anchored on its whole line.
sub("PROTO 41 (the wire gate)",
  'check("v132 wire: PROTO is 40 — five proc ids, completing the 60-buff forge",NET.PROTO===40);',
  'check("v132.39 wire: PROTO is 41 — the aura-ring rows (s.ar) are new snapshot vocabulary",\n'+
  '    NET.PROTO===41);');
sub("PROTO 41 (the payload gate)",
  'G.NET.PROTO===40&&Array.isArray(w.ares)',
  'G.NET.PROTO===41&&Array.isArray(w.ares)');
sub("PROTO 41 (the payload label)",
  '"v115/v132 net: PROTO 40 (the full 60-buff forge) and `ares` still rides both payloads"',
  '"v115/v132.39 net: PROTO 41 (the aura rings) and `ares` still rides both payloads"');

sub("export the ring system",
  'getT:()=>T,sfxAt:_sfxAt,SFX_NET,sfxLast:()=>_sfxLast};";',
  'getT:()=>T,sfxAt:_sfxAt,SFX_NET,sfxLast:()=>_sfxLast,'+
  'buffFxTick,buffFxStats,updateEffects,FX_SANCT,FX_BRAND,FX_KIN,FX_STEW,FX_RESOLVE,FX_PHALANX,'+
  'RING_MIN,RING_TIGHTEN};";');

sub("ring gates",
'      // ---- v132.37: WHO HEARS THEM — the relay, and the dedicated-server shape ----',
'      // ---- v132.39: THE BATCH D RINGS ----\n'+
'      {\n'+
'        const S=G.buffFxStats, FX=G.buffFxTick;\n'+
'        // THE SEEDED WINDOW. Seventeen geometries and a material at file scope would each mint a\n'+
'        // uuid — four random draws — inside world gen, and move every tree on the map.\n'+
'        check("v132.39 rings: NOTHING is built at load — the ring geometry is lazy, because a "+\n'+
'          "BufferGeometry minted inside the seeded window costs four random draws and moves the "+\n'+
'          "whole map (invariant #2)",S().built===false);\n'+
'        const R=mkB(0,{}); R._fxMask=0;\n'+
'        FX(0.016);\n'+
'        check("v132.39 rings: …and it builds on FIRST TICK, not never",S().built===true);\n'+
'        check("v132.39 rings: a unit holding none of the six draws nothing ("+S().rings+")",\n'+
'          S().rings===0);\n'+
'        // SANCTUARY grows over the stillness clock\n'+
'        R._fxMask=G.FX_SANCT; R._fxStill=1; FX(0.016);\n'+
'        const full=S().live[0]?S().live[0].r:0;\n'+
'        R._fxStill=0.5; FX(0.016);\n'+
'        const half=S().live[0]?S().live[0].r:0;\n'+
'        check("v132.39 SANCTUARY: the ring GROWS over the 3s stillness clock, so the wind-up you "+\n'+
'          "cannot otherwise see IS the effect (half-wound "+half.toFixed(1)+" vs open "+\n'+
'          full.toFixed(1)+" units)",full>0&&half>0&&Math.abs(half-full/2)<0.6);\n'+
'        check("v132.39 SANCTUARY: …and open, it is drawn at the REAL scan radius ("+full.toFixed(1)+\n'+
'          " vs AURA_BR "+G.AURA_BR+")",Math.abs(full-G.AURA_BR)<0.01);\n'+
'        // UNBOWED tightens\n'+
'        R._fxMask=G.FX_RESOLVE; R._auraE=0; FX(0.016);\n'+
'        const wide=S().live[0].r;\n'+
'        R._auraE=5; FX(0.016);\n'+
'        const tight=S().live[0].r;\n'+
'        check("v132.39 UNBOWED: the ring TIGHTENS as enemies crowd you — a ring closing in IS the "+\n'+
'          "sentence \'surrounded makes you tougher\' ("+wide.toFixed(1)+" -> "+tight.toFixed(1)+\n'+
'          " units at the 5-enemy cap)",G.RING_TIGHTEN?(tight<wide-1&&Math.abs(tight-G.RING_MIN)<0.01)\n'+
'                                                     :Math.abs(tight-wide)<0.01);\n'+
'        // PHALANX is its mirror: a second ring at the cap\n'+
'        R._fxMask=G.FX_PHALANX; R._auraA=0; FX(0.016);\n'+
'        const one=S().rings;\n'+
'        R._auraA=4; FX(0.016);\n'+
'        const two=S().rings;\n'+
'        check("v132.39 PHALANX: a SECOND concentric ring appears at the +20% cap, so you can see "+\n'+
'          "you are getting the full bonus ("+one+" ring below the cap, "+two+" at it)",\n'+
'          one===1&&two===2);\n'+
'        // dropping the buff leaves nothing behind\n'+
'        R._fxMask=0; FX(0.016);\n'+
'        check("v132.39 rings: dropping the buff CLEARS the ring — hide-all then re-arm, or a "+\n'+
'          "Sanctuary you walked out of stays painted on the ground for the rest of the match ("+\n'+
'          S().rings+" left)",S().rings===0);\n'+
'        // THE POOL IS A POOL\n'+
'        const before=S().pool;\n'+
'        for(let i=0;i<200;i++){R._fxMask=(i%2)?G.FX_SANCT:0;R._fxStill=1;FX(0.016);}\n'+
'        R._fxMask=0; FX(0.016);\n'+
'        check("v132.39 rings: the pool is a POOL — 200 frames of rings appearing and vanishing "+\n'+
'          "did not grow it (was "+before+", now "+S().pool+"). A mesh added per frame is how a "+\n'+
'          "display feature becomes a frame-rate bug three minutes in",S().pool<=before+1);\n'+
'        R.alive=false; R._fxMask=0; FX(0.016);\n'+
'      }\n'+
'      // ---- v132.37: WHO HEARS THEM — the relay, and the dedicated-server shape ----');

if(failed.length){
  console.error("REFUSING TO WRITE — anchors failed:");
  failed.forEach(f=>console.error("  - "+f));
  process.exit(1);
}
fs.writeFileSync(F,s);
console.log("patched tools/smoketest.js — the ring gates");
