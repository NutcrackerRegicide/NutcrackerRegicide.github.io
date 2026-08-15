#!/usr/bin/env node
/* patch-sfx-defs2.js — v132.38: register the four new cues, and put them on the wire.
 *
 * Same two-part registration as v132.37, for the same reason: DEFS is what loadAll() decodes and
 * what resolve() consults, so an unregistered key is 15KB of silence. See tools/patch-sfx-defs.js
 * for the long version of that argument — the gate added in v132.37 (DEFS ≡ SND_DATA, both ways)
 * would now catch this within one smoketest run, which is what it was built for.
 *
 * ── THE GAINS, AGAINST WHAT THEY SIT BESIDE ─────────────────────────────────────────────────
 *   critstrike  0.95  a critical should read as louder than the hit it replaces (hit1 is 0.90)
 *   dodgeswish  0.80  a near miss is quieter than a landed blow, by definition
 *   lastlegs    1.00  once a fight, and it is telling you that you are about to die
 *   cullkill    0.85  it rides ON TOP of the creature's death sound, so it must not bury it
 *
 * ── AND THE TWO RATES ───────────────────────────────────────────────────────────────────────
 * Ear-throttle (11-audio) and wire-window (05-combat, half of it). KEEN EYE is the one that
 * matters: 5% per stack to a cap of 3 is ~15% of every blow you land, which in a real melee is
 * several a second across the whole field. 140ms is roughly the cadence of the swing cue it rides.
 *   SURVIVAL INSTINCT is latched per unit per fight, so its window is only there to stop ten
 *   people crossing the line together from stacking ten horns into one instant.
 */
const fs=require("fs"),path=require("path");
let failed=[];
function mk(box){return function(name,from,to){
  const n=box.o.split(from).length-1;
  if(n!==1){failed.push(name+" (matched "+n+" times, need exactly 1)");return;}
  box.o=box.o.split(from).join(to);};}
const P={aud:path.join(__dirname,"..","js","11-audio.js"),
         comb:path.join(__dirname,"..","js","05-combat.js")};
const a={o:fs.readFileSync(P.aud,"utf8")}, c={o:fs.readFileSync(P.comb,"utf8")};
const subA=mk(a), subC=mk(c);

subA("DEFS for the four",
'  const BUSNAME=["sfx","ambience"];',
'  // ---- v132.38: four buffs that had no voice. Baked composites (tools/sfxmix.js), each one\n'+
'  // screened against every other entry by tools/sfxdupe.js before it was allowed in. ----\n'+
'  DEFS["critstrike"]=[0,1,0,0.95];   // KEEN EYE — louder than the hit1 (0.90) it replaces\n'+
'  DEFS["dodgeswish"]=[0,1,0,0.80];   // SIXTH SENSE — a near miss is quieter than a landed blow\n'+
'  DEFS["lastlegs"]  =[0,1,0,1.00];   // SURVIVAL INSTINCT — once a fight, and it means you are dying\n'+
'  DEFS["cullkill"]  =[0,1,0,0.85];   // CULLER — rides ON TOP of the death sound, must not bury it\n'+
'  const BUSNAME=["sfx","ambience"];');

subA("throttles for the four",
'    knifethrow:150,volleyshot:120,wardblock:120,guardblock:120,sanctuary:900,quakeslam:250};',
'    knifethrow:150,volleyshot:120,wardblock:120,guardblock:120,sanctuary:900,quakeslam:250,\n'+
'    // v132.38. critstrike is the hot one: 5% per stack to a cap of 3 is ~15% of every blow you\n'+
'    // land, and in a real melee that is several a second across the field. 140ms is about the\n'+
'    // cadence of the swing cue it rides on. lastlegs is latched per unit per fight, so its window\n'+
'    // exists only to stop ten people crossing the line together sounding ten horns at once.\n'+
'    critstrike:140,dodgeswish:150,lastlegs:400,cullkill:200};');

subA("voice cap for the four",
'    bleedhit:1,venomhit:1,gashcut:1,stunhit:1,knifethrow:1,sear:1};',
'    bleedhit:1,venomhit:1,gashcut:1,stunhit:1,knifethrow:1,sear:1,\n'+
'    // v132.38: the two frequent ones yield to the voice budget. lastlegs and cullkill do not —\n'+
'    // one is once a fight and the other is an execute; neither should lose to a crowd of crits.\n'+
'    critstrike:1,dodgeswish:1};');

subC("wire windows for the four",
'  knifethrow:0.075,volleyshot:0.06,wardblock:0.06,guardblock:0.06,sanctuary:0.45,quakeslam:0.125};',
'  knifethrow:0.075,volleyshot:0.06,wardblock:0.06,guardblock:0.06,sanctuary:0.45,quakeslam:0.125,\n'+
'  critstrike:0.07,dodgeswish:0.075,lastlegs:0.20,cullkill:0.10};   // v132.38, half the ear again');

if(failed.length){
  console.error("REFUSING TO WRITE — anchors failed:");
  failed.forEach(f=>console.error("  - "+f));
  process.exit(1);
}
fs.writeFileSync(P.aud,a.o); fs.writeFileSync(P.comb,c.o);
console.log("patched — four cues registered, throttled, capped and relayed");
