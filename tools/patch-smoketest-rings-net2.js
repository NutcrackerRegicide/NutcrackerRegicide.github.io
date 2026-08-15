#!/usr/bin/env node
/* patch-smoketest-rings-net2.js — test the REAL builder, and stop poisoning the gates below.
 *
 * ── TWO THINGS WENT WRONG, BOTH MINE ────────────────────────────────────────────────────────
 * 1. `NET.applySnap({ar:[...]})` never reached my handler. A bare object is not a survivable
 *    snapshot — applySnap decodes the unit buffer long before it gets to the scoreboard, so it
 *    threw on the missing field and the assertion measured nothing.
 * 2. WORSE: the throw left NET half-configured, and four assertions in the v132.37 relay block
 *    BELOW went red because of it. A test that damages the tests after it is worse than a test
 *    that fails, because the failure lands somewhere else and looks like a different bug. Every
 *    NET mutation here is now inside a try/finally.
 *
 * ── AND THE REGEX GATES BECOME REAL ONES ────────────────────────────────────────────────────
 * NET.packSnap() is the actual builder the game ships from, and the harness already round-trips
 * it. So instead of asserting that the source CONTAINS `_ar.push(...)`, this packs three real
 * snapshots and reads what came out — which also lets the empty-list behaviour be tested as
 * behaviour rather than as a line of code:
 *     holder present   → a row with the mask and the counts
 *     holder drops it  → ONE snapshot carrying an empty array
 *     and after that   → the field is gone again
 * The middle case is the bug this design exists to avoid, and it is now observed rather than
 * argued for. Three packs per phase because the rows ride the 5 Hz scoreboard branch, which fires
 * once every third snapshot.
 *
 * ⚠ packSnap mutates delta caches (_lastBld and friends). The harness already calls it several
 * times for the same reason, so this is in keeping — but it is why the phases pack a fixed number
 * of times rather than looping until something appears.
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

const OLD_START='        // ---- 2. THE STATE. Buffs are per-player-only and auraBuffTick is host-only, so without\n';
const i0=s.indexOf(OLD_START);
const i1=s.indexOf('        R.alive=false; R._fxMask=0;\n',i0);
if(i0<0||i1<0){console.error("REFUSING TO WRITE — could not locate the wire block");process.exit(1);}
const OLD=s.slice(i0,i1);

const NEW=
'        // ---- 2. THE STATE. Buffs are per-player-only and auraBuffTick is host-only, so without\n'+
'        // a wire row a guest has nothing to draw FROM however correct the drawing is. Tested\n'+
'        // against the REAL builder and the REAL applySnap.\n'+
'        // ⚠ every NET mutation below is inside try/finally: the first version of this block threw\n'+
'        // partway through and left NET half-configured, which reddened four assertions in the\n'+
'        // v132.37 relay block further down. A test that damages later tests is worse than one\n'+
'        // that simply fails, because the failure surfaces somewhere else wearing a disguise.\n'+
'        {\n'+
'          const N=G.NET, mode0=N.mode, P=G.player, m0=P._fxMask, q0=N.lastQ;\n'+
'          try{\n'+
'            N.mode="host";\n'+
'            P._fxMask=G.FX_SANCT; P._auraA=3; P._auraE=1; P._fxStill=1; P._fxKin=0; P._fxStw=0;\n'+
'            // the rows ride the 5 Hz scoreboard branch, so three packs guarantee one carrying it\n'+
'            const pack3=()=>{const o=[];for(let i=0;i<3;i++)o.push(N.packSnap());return o;};\n'+
'            const A=pack3().filter(x=>x.ar!==undefined);\n'+
'            const row=A.length?(A[0].ar||[]).find(r=>r[0]===P.id):null;\n'+
'            check("v132.39 ring wire: the REAL snapshot builder ships a row for a holder — id, "+\n'+
'              "mask, both counts, the stillness clock and the two ids ("+(row?JSON.stringify(row):"none")+\n'+
'              ")",!!row&&row[1]===G.FX_SANCT&&row[2]===3&&row[3]===1&&row[4]===100);\n'+
'            // the holder drops it: ONE snapshot must still carry an EMPTY list\n'+
'            P._fxMask=0;\n'+
'            const B=pack3().filter(x=>x.ar!==undefined);\n'+
'            check("v132.39 ring wire: when the last holder drops it, ONE snapshot still carries an "+\n'+
'              "EMPTY list — skipping it to save bytes leaves every guest holding the old rows and "+\n'+
'              "the ring outlives the buff ("+B.length+" carried it, length "+\n'+
'              (B.length?B[0].ar.length:"n/a")+")",B.length===1&&B[0].ar.length===0);\n'+
'            const C=pack3().filter(x=>x.ar!==undefined);\n'+
'            check("v132.39 ring wire: …and then it goes QUIET rather than shipping an empty array "+\n'+
'              "forever ("+C.length+" of 3 carried it)",C.length===0);\n'+
'            // and a guest applies it, through the real applySnap\n'+
'            P._fxMask=G.FX_RESOLVE; P._auraE=4; P._fxStill=1;\n'+
'            const D=pack3().filter(x=>x.ar&&x.ar.length);\n'+
'            P._fxMask=0; P._auraE=0;                       // wipe locally so only the wire can restore it\n'+
'            N.mode="guest";\n'+
'            if(D.length){\n'+
'              const snap=D[0]; snap.q=N.lastQ+1;\n'+
'              N.applySnap(snap);\n'+
'              check("v132.39 ring wire: a GUEST applies the arriving row to the right unit by id, "+\n'+
'                "having been wiped locally first so only the wire could have restored it (mask "+\n'+
'                P._fxMask+", enemies "+P._auraE+")",\n'+
'                P._fxMask===G.FX_RESOLVE&&P._auraE===4);\n'+
'              const gone={ar:[],q:N.lastQ+1};\n'+
'              N.applySnap(gone);\n'+
'              check("v132.39 ring wire: …and the empty list TAKES THE RING AWAY, which is the "+\n'+
'                "whole reason it is sent (mask now "+P._fxMask+")",P._fxMask===0);\n'+
'            }else check("v132.39 ring wire: a snapshot carrying rows was produced to test the "+\n'+
'              "guest path (none was — the builder gate above is the one to read)",false);\n'+
'          }finally{ N.mode=mode0; P._fxMask=m0; N.lastQ=q0; }\n'+
'        }\n';

s=s.slice(0,i0)+NEW+s.slice(i1);
fs.writeFileSync(F,s);
console.log("patched tools/smoketest.js — wire gates now test the real builder, inside try/finally");
