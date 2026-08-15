#!/usr/bin/env node
/* patch-sfx-four.js — v132.38: four buffs that had no voice at all.
 *
 * SIXTH SENSE · KEEN EYE · SURVIVAL INSTINCT · CULLER
 *
 * ── WHY THESE FOUR AND NOT THE OTHER TWENTY-THREE ───────────────────────────────────────────
 * Of the 48 buffs without a cue, most are permanent stat changes — there is no MOMENT for a sound
 * to belong to, and a cue on "+5% damage" would have to fire on every blow you ever land. Another
 * ten are continuous or per-tick, where a cue is a drone. These four are the ones with a discrete,
 * dramatic, player-facing instant that currently passes in silence:
 *     SIXTH SENSE     a blow that should have landed and didn't. The same moment as ARROW WARD and
 *                     IRON GUARD, both of which got cues in v132.37 — this was the odd one out.
 *     KEEN EYE        a critical. Prints "CRITICAL HIT!" in gold and sounds exactly like a jab.
 *     SURVIVAL INSTINCT  crossing under a quarter health. Latched, so it is once a fight.
 *     CULLER          an execute.
 *
 * ── ALL FOUR ARE BAKED COMPOSITES ───────────────────────────────────────────────────────────
 * tools/sfxdupe.js measures the bank by waveform, and the library had no single unused file that
 * fit any of these. Each is two library sounds mixed at build time (tools/sfxmix.js), which is
 * John's rule applied forward rather than as a repair: a shared ingredient is fine, a shared SOUND
 * is not. Each was screened against all 154 other entries before being embedded.
 *
 * ⚠ THE DODGE CUE GOES BEFORE THE `return`. dealDamage bails out on a dodge — that is the whole
 * mechanic — so a cue placed after it is a cue that never plays. Same trap as the two blocks.
 *
 * ⚠ THE CULL CUE IS NOT A DEATH CUE. Setting hp to 0 lets the ordinary kill path below run
 * unchanged, so the death sound still fires. cullkill rides ON TOP of it and says "that was you",
 * which is why it is priced quietly enough to sit under the death rather than replace it.
 */
const fs=require("fs"),path=require("path");
const F=path.join(__dirname,"..","js","05-combat.js");
let s=fs.readFileSync(F,"utf8");
let failed=[];
function sub(name,from,to){
  const n=s.split(from).length-1;
  if(n!==1){failed.push(name+" (matched "+n+" times, need exactly 1)");return;}
  s=s.split(from).join(to);
}

sub("keen eye cue",
`      m*=2; puff(victim.root.position.x,2.4,victim.root.position.z,0xffd24a,1.1);
      if(attU.isPlayer)msg("CRITICAL HIT!","gold");`,
`      m*=2; puff(victim.root.position.x,2.4,victim.root.position.z,0xffd24a,1.1);
      _sfxAt("critstrike",victim);        // v132.38: it prints CRITICAL HIT in gold and sounded
      if(attU.isPlayer)msg("CRITICAL HIT!","gold");   // like every other blow`);

sub("sixth sense cue — BEFORE the return",
`      puff(victim.root.position.x,1.6,victim.root.position.z,0x9fd8ff);
      if(victim.isPlayer)msg("Dodged!","blue");
      victim._lastHurt=T;
      return;`,
`      puff(victim.root.position.x,1.6,victim.root.position.z,0x9fd8ff);
      _sfxAt("dodgeswish",victim);        // v132.38: ⚠ BEFORE the return — dealDamage bails out on
      if(victim.isPlayer)msg("Dodged!","blue");       // a dodge, so anything after it never runs
      victim._lastHurt=T;
      return;`);

sub("culler cue",
`    victim.hp=0;
    puff(victim.root.position.x,1.8,victim.root.position.z,0xd8e070,1.2);`,
`    victim.hp=0;
    puff(victim.root.position.x,1.8,victim.root.position.z,0xd8e070,1.2);
    _sfxAt("cullkill",victim);            // v132.38: rides ON TOP of the ordinary death sound —
                                          // the kill path below still runs, so this says "that
                                          // was you", it does not replace the creature dying`);

sub("survival instinct cue",
`    victim._lowLatch=true;
    tmodAdd(victim,"spdmul",0.40*buffSt(victim,"flight"),5,false);`,
`    victim._lowLatch=true;
    tmodAdd(victim,"spdmul",0.40*buffSt(victim,"flight"),5,false);
    _sfxAt("lastlegs",victim);            // v132.38: the latch above makes this once a fight, which
                                          // is why it can afford to be the longest of the cues`);

if(failed.length){
  console.error("REFUSING TO WRITE — anchors failed:");
  failed.forEach(f=>console.error("  - "+f));
  process.exit(1);
}
fs.writeFileSync(F,s);
console.log("patched js/05-combat.js — four buffs found their voice");
