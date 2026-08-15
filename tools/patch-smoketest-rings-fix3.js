#!/usr/bin/env node
/* patch-smoketest-rings-fix3.js — an assertion that never RUNS is not a passing assertion.
 *
 * ── HOW THIS HID ────────────────────────────────────────────────────────────────────────────
 * The last wire gate — "an empty list takes the ring away" — was fed a hand-made `{ar:[],q:n}`.
 * applySnap decodes the unit buffer long before it reaches the scoreboard rows, so a bare object
 * throws, and the check() call after it never executed. It did not fail. It simply was not there,
 * and a missing line in a 650-assertion log looks exactly like a line you did not scroll to.
 *   Mutation testing is what surfaced it: deleting the guest-side clear-first pass — the precise
 * bug the gate names — changed nothing, because the gate had never run in any build.
 *
 * ── THE FIX: BOTH HALVES USE REAL SNAPSHOTS ─────────────────────────────────────────────────
 * The builder already produces exactly the object needed. Packing with a holder gives a snapshot
 * carrying rows; dropping the mask and packing again gives the one carrying an EMPTY list, which
 * is the thing NET._arLast exists to emit. Applying those two in order tests the real path end to
 * end, with no hand-made objects anywhere:
 *     apply the snapshot WITH rows   → the mask arrives on the right unit
 *     apply the snapshot with NONE   → the mask goes away
 * Without the clear-first pass the second one leaves the mask standing, and now that is visible.
 *
 * ⚠ And it is wrapped, so a throw here can never again silently swallow the assertions after it.
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

sub("both halves use real snapshots",
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
'              "guest path (none was — the builder gate above is the one to read)",false);',
'            // ⚠ BOTH halves are REAL snapshots. A hand-made {ar:[]} throws inside applySnap long\n'+
'            // before the scoreboard rows, which silently swallowed the second assertion below —\n'+
'            // it never ran in any build, so deleting the very thing it tests changed nothing.\n'+
'            P._fxMask=G.FX_RESOLVE; P._auraE=4; P._fxStill=1;\n'+
'            const D=pack3().filter(x=>x.ar&&x.ar.length);        // …carrying rows\n'+
'            P._fxMask=0; P._auraE=0;\n'+
'            const E=pack3().filter(x=>x.ar&&x.ar.length===0);    // …carrying the empty list\n'+
'            N.mode="guest";\n'+
'            check("v132.39 ring wire: the harness got BOTH real snapshots it needs — one with "+\n'+
'              "rows ("+D.length+") and one with the empty list ("+E.length+") — so neither "+\n'+
'              "assertion below can pass by never running",D.length>0&&E.length>0);\n'+
'            if(D.length&&E.length){\n'+
'              let threw="";\n'+
'              try{\n'+
'                D[0].q=N.lastQ+1; N.applySnap(D[0]);\n'+
'                const got=P._fxMask===G.FX_RESOLVE&&P._auraE===4;\n'+
'                check("v132.39 ring wire: a GUEST applies the arriving row to the right unit by "+\n'+
'                  "id, wiped locally first so only the wire could have restored it (mask "+\n'+
'                  P._fxMask+", enemies "+P._auraE+")",got);\n'+
'                E[0].q=N.lastQ+1; N.applySnap(E[0]);\n'+
'                check("v132.39 ring wire: …and the EMPTY list takes the ring away, which is the "+\n'+
'                  "whole reason it is sent — without the guest-side clear-first pass the mask "+\n'+
'                  "stands and the ring outlives the buff (mask now "+P._fxMask+")",\n'+
'                  P._fxMask===0);\n'+
'              }catch(e){ threw=e.message; }\n'+
'              check("v132.39 ring wire: …and applying real snapshots did not throw"+\n'+
'                (threw?" ["+threw+"]":""),!threw);\n'+
'            }');

if(failed.length){
  console.error("REFUSING TO WRITE — anchors failed:");
  failed.forEach(f=>console.error("  - "+f));
  process.exit(1);
}
fs.writeFileSync(F,s);
console.log("patched tools/smoketest.js — the empty-list gate now actually runs");
