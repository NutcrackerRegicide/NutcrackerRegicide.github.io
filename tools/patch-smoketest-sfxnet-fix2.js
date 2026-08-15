#!/usr/bin/env node
/* patch-smoketest-sfxnet-fix2.js — two of my own gates were vacuous. Falsification found both.
 *
 * ── "A GUEST NEVER RELAYS" PASSED WITH THE GUARD DELETED ────────────────────────────────────
 * Deleting `NET.mode==="host"` from _sfxAt — which makes every guest echo every cue, the exact
 * feedback loop the assertion is named after — left the gate GREEN. The assertion was measuring
 * the throttle, not the mode: the host loop immediately above had just stamped all twelve keys,
 * T does not advance between synchronous blocks, so the guest loop was refused for being too
 * soon rather than for being a guest. Same instant, same stamps, wrong reason, green light.
 *   Clearing the stamps first is what makes the mode the only remaining variable.
 *
 * ── AND `.every()` IS TRUE OF AN EMPTY WIRE ─────────────────────────────────────────────────
 * The positional assertion is `wire.every(o => typeof o.x === "number" && ...)`. Delete the
 * broadcast entirely and `wire` is empty, and every() over nothing is true — so the gate that
 * exists to prove the cues carry a position passed in the one case where they carry nothing at
 * all. It now requires the wire to be non-empty before it believes anything about its contents.
 *
 * Both are the same lesson the handoff already records under §2, arrived at twice more: a gate
 * that has not been driven red has not been tested, and the thing that reddens it must be the
 * thing it names.
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

sub("non-vacuous positional check",
'          check("v132.37 relay: …positionally, so each guest culls and pans it against ITS OWN "+\n'+
'            "listener, not the host\'s",wire.every(o=>typeof o.x==="number"&&typeof o.z==="number"));',
'          check("v132.37 relay: …positionally, so each guest culls and pans it against ITS OWN "+\n'+
'            "listener, not the host\'s ("+wire.length+" carried a position) — the length check is "+\n'+
'            "not decoration: every() is TRUE of an empty wire, so without it this gate passes "+\n'+
'            "loudest when nothing is broadcast at all",\n'+
'            wire.length>=CUES.length&&wire.every(o=>typeof o.x==="number"&&typeof o.z==="number"));');

sub("clear the stamps before the guest test",
'          wire=[]; N.mode="guest"; for(const k of CUES)G.sfxAt(k,puppet);\n'+
'          check("v132.37 relay: a GUEST never relays — it would be a feedback loop, and a guest "+\n'+
'            "deciding what other clients hear ("+wire.length+" messages)",wire.length===0);',
'          // ⚠ CLEAR AGAIN. Without this the guest loop is refused for being too SOON (the host\n'+
'          // loop above stamped all twelve at this same frozen instant) rather than for being a\n'+
'          // guest — and the gate stayed green with NET.mode==="host" deleted from _sfxAt, which\n'+
'          // is precisely the bug it is named after. Verified by falsification, not by reading.\n'+
'          wire=[]; for(const k in stamps)delete stamps[k];\n'+
'          N.mode="guest"; for(const k of CUES)G.sfxAt(k,puppet);\n'+
'          check("v132.37 relay: a GUEST never relays, with every throttle stamp cleared so the "+\n'+
'            "MODE is the only thing refusing it — an echoing guest is a feedback loop and a "+\n'+
'            "client asserting authority over what other clients hear ("+wire.length+" of "+\n'+
'            CUES.length+" messages)",wire.length===0);');

if(failed.length){
  console.error("REFUSING TO WRITE — anchors failed:");
  failed.forEach(f=>console.error("  - "+f));
  process.exit(1);
}
fs.writeFileSync(F,s);
console.log("patched tools/smoketest.js — two vacuous gates made honest");
