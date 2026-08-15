#!/usr/bin/env node
/* patch-smoketest-sfxnet-fix.js — the relay gates were measuring leftovers, not the relay.
 *
 * ── WHAT WENT RED, AND WHY THE GAME WAS INNOCENT ────────────────────────────────────────────
 * Two of the six relay assertions failed on their first run, and both were the TEST'S fault:
 *
 *   1. Seven of the twelve cues "never reached the wire". They had already reached it. The batch
 *      E gates earlier in this file drive knifeTick, the volley, the slam and both blocks, and
 *      the batch D gates drive the sanctuary zone and the searing burn — all with NET.mode
 *      already "host". Each of those stamped _sfxLast[k], and the harness clock T DOES NOT
 *      ADVANCE between synchronous test blocks. So my "first" call for those seven was really
 *      their second, at the same instant, and the throttle correctly refused it.
 *
 *   2. The three-call burst sent zero rather than one, for exactly the same reason: my own
 *      assertion above had just stamped bleedhit at this same T.
 *
 * The fix is to clear the stamps and own the frozen clock rather than fight it. _sfxLast is now
 * exported so the harness can reset it — a test that depends on what some earlier test happened
 * to fire is not measuring anything.
 *
 * ── AND THE FROZEN CLOCK BECOMES THE SHARP INSTRUMENT ───────────────────────────────────────
 * With T stopped, a correct clock-throttle sends EXACTLY ONE no matter how many calls arrive —
 * so the burst assertion is now exact rather than approximate. The re-arm is then proved by
 * winding the stamp back by hand, which is the same technique the SEARING cue gate uses. A
 * throttle keyed on anything other than the clock (a call counter, a frame count) fails one of
 * the two.
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

sub("export the stamps",
  'getT:()=>T,sfxAt:_sfxAt,SFX_NET};";',
  'getT:()=>T,sfxAt:_sfxAt,SFX_NET,sfxLast:()=>_sfxLast};";');

sub("clear the stamps before measuring",
'          N.mode="host";\n'+
'          // every cue reaches the wire at least once\n'+
'          for(const k of CUES){G.sfxAt(k,puppet);}\n',
'          N.mode="host";\n'+
'          // ⚠ CLEAR THE STAMPS FIRST. The batch D and E gates above already drove seven of these\n'+
'          // twelve with NET.mode="host", and T does not advance between synchronous blocks — so\n'+
'          // without this the "first" call for those seven is really their second, at the same\n'+
'          // instant, and the throttle rightly refuses it. That reds a correct relay.\n'+
'          const stamps=G.sfxLast(); for(const k in stamps)delete stamps[k];\n'+
'          // every cue reaches the wire at least once\n'+
'          for(const k of CUES){G.sfxAt(k,puppet);}\n');

sub("burst on a frozen clock, then wind it",
'          wire=[]; const K="bleedhit", W=G.SFX_NET[K];\n'+
'          G.sfxAt(K,puppet); G.sfxAt(K,puppet); G.sfxAt(K,puppet);\n'+
'          const burst=wire.length;\n'+
'          check("v132.37 relay: the WIRE is throttled independently of the ear — the client "+\n'+
'            "throttle runs after the packet is already sent, so it protects nobody\'s bandwidth "+\n'+
'            "(3 calls inside the "+W+"s window → "+burst+" message"+(burst===1?"":"s")+")",burst===1);\n'+
'          check("v132.37 relay: …and it is a real CLOCK window, not a call counter (window "+W+\n'+
'            "s, "+CUES.length+" distinct windows tuned at half the client\'s)",\n'+
'            CUES.every(k=>G.SFX_NET[k]>0));\n',
'          // THE FROZEN CLOCK IS THE INSTRUMENT: with T stopped a correct clock-throttle sends\n'+
'          // exactly one however many calls arrive, so this is an exact count, not a bound.\n'+
'          wire=[]; const K="bleedhit", W=G.SFX_NET[K];\n'+
'          delete stamps[K];\n'+
'          G.sfxAt(K,puppet); G.sfxAt(K,puppet); G.sfxAt(K,puppet);\n'+
'          const burst=wire.length;\n'+
'          check("v132.37 relay: the WIRE is throttled independently of the ear — the client "+\n'+
'            "throttle runs after the packet is already sent, so it protects nobody\'s bandwidth "+\n'+
'            "(3 calls at one instant, "+W+"s window → "+burst+" message"+(burst===1?"":"s")+")",\n'+
'            burst===1);\n'+
'          stamps[K]=G.getT()-W*2;                    // wind the window past, by hand\n'+
'          G.sfxAt(K,puppet);\n'+
'          check("v132.37 relay: …and it RE-ARMS on the clock, so it is a time window and not a "+\n'+
'            "call counter or a latch ("+wire.length+" total)",wire.length===2);\n'+
'          check("v132.37 relay: every cue has its own wire window, tuned at half the client\'s "+\n'+
'            "category throttle — the host relays denser than it plays and lets each guest thin "+\n'+
'            "it at its own position",CUES.every(k=>G.SFX_NET[k]>0));\n');

if(failed.length){
  console.error("REFUSING TO WRITE — anchors failed:");
  failed.forEach(f=>console.error("  - "+f));
  process.exit(1);
}
fs.writeFileSync(F,s);
console.log("patched tools/smoketest.js — relay gates measure the relay now");
