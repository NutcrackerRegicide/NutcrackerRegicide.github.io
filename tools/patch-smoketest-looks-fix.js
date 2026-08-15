#!/usr/bin/env node
/* patch-smoketest-looks-fix.js — the KING'S GUARD gate depended on a king the campaign may have killed.
 *
 * The assertion moved a probe unit far from kings[0] and then beside it, and expected the ring to
 * follow. It went red — and the game was very likely innocent, because nearOwnKing() requires the
 * king to be ALIVE, and by the time these gates run a two-hundred-second campaign has been
 * fighting over exactly that. A dead king makes both halves false, and "no ring near him" then
 * fails for a reason that has nothing to do with the look.
 *
 * Two changes, and the second is the one that matters:
 *   · the king is made alive for the duration and restored afterwards, so the condition can
 *     actually be true at some point during the test
 *   · the gate now asserts that the ring TRACKS nearOwnKing() rather than tracking a position —
 *     and reports both, so if it ever fails again the message says whether the predicate or the
 *     drawing disagreed. A gate that fails without saying which half broke costs a run to find out.
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

sub("king's guard — assert against the predicate, with the king alive",
'          const k=G.kings&&G.kings[0];\n'+
'          if(k&&k.root){\n'+
'            const kx=k.root.position.x, kz=k.root.position.z;\n'+
'            L.root.position.set(kx+G.KGUARD_R+40,0,kz);  FX(0.016); const far=S().rings;\n'+
'            L.root.position.set(kx+2,0,kz);              FX(0.016); const near=S().rings;\n'+
'            check("v132.42 KING\'S GUARD: the ring obeys its CONDITION — nothing "+(G.KGUARD_R+40)+\n'+
'              " units from your king, a ring beside him. A look that ignores its condition is a "+\n'+
'              "look that lies, and this one exists to explain why a unit is hard to kill ("+\n'+
'              far+" → "+near+")",far===0&&near===1);\n'+
'          }',
'          // ⚠ THE KING HAS TO BE ALIVE. nearOwnKing() requires it, and by the time these gates\n'+
'          // run a two-hundred-second campaign has been fighting over exactly that — a dead king\n'+
'          // makes both halves false and the gate fails for a reason that is nothing to do with\n'+
'          // the look. Revived here, restored after.\n'+
'          const k=G.kings&&G.kings[0];\n'+
'          if(k&&k.root){\n'+
'            const wasAlive=k.alive; k.alive=true;\n'+
'            const kx=k.root.position.x, kz=k.root.position.z;\n'+
'            L.root.position.set(kx+G.KGUARD_R+40,0,kz);\n'+
'            const pFar=G.nearOwnKing(L); FX(0.016); const far=S().rings;\n'+
'            L.root.position.set(kx+2,0,kz);\n'+
'            const pNear=G.nearOwnKing(L); FX(0.016); const near=S().rings;\n'+
'            k.alive=wasAlive;\n'+
'            // assert the ring TRACKS the predicate, and report BOTH — a gate that fails without\n'+
'            // saying which half broke costs a whole run to find out which one it was\n'+
'            check("v132.42 KING\'S GUARD: the ring tracks nearOwnKing() rather than merely the "+\n'+
'              "holding — a look that ignores its condition is a look that lies, and this one "+\n'+
'              "exists to explain why a unit is suddenly hard to kill (predicate "+pFar+"→"+pNear+\n'+
'              ", rings "+far+"→"+near+")",\n'+
'              pFar===false&&pNear===true&&far===0&&near===1);\n'+
'          }');

if(failed.length){
  console.error("REFUSING TO WRITE — anchors failed:");
  failed.forEach(f=>console.error("  - "+f));
  process.exit(1);
}
fs.writeFileSync(F,s);
console.log("patched tools/smoketest.js — king's guard gate is self-diagnosing");
