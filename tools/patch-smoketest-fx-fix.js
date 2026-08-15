#!/usr/bin/env node
/* patch-smoketest-fx-fix.js — I wrote this lesson down two versions ago and then repeated it.
 *
 * patch-smoketest-rings-net2.js says, in its own header: a hand-made object is not a survivable
 * snapshot, applySnap decodes the unit buffer long before it reaches the scoreboard rows, and the
 * throw leaves NET half-configured so that assertions FURTHER DOWN go red wearing a disguise.
 *   The v132.41 guest gate did it again — `N.applySnap({vfx:[...]})` — and took six assertions
 * with it: four in the v132.37 relay block, two in the SEARING cue block, and two more in the
 * v132.34 stun block. None of those had anything wrong with them.
 *
 * The fix is the one that already worked once: pack a REAL snapshot with a row queued on it, and
 * apply that. Nothing hand-made goes near applySnap.
 *
 * ⚠ Worth stating plainly, because it is the second time: when a gate throws, the damage is not
 * that gate. It is every gate after it, in a different file, describing a different feature.
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

sub("use a real snapshot for the guest gate",
'            settle();\n'+
'            const zero=X().live;\n'+
'            N.mode="guest";\n'+
'            N.applySnap({vfx:[[1,500,500,100,0]],q:N.lastQ+1});\n'+
'            const after=X().live;',
'            // ⚠ A REAL snapshot. A hand-made {vfx:[…]} throws inside applySnap long before the\n'+
'            // batched channels, and the throw leaves NET half-configured — the first version of\n'+
'            // this took SIX assertions down with it, in three other blocks, describing three\n'+
'            // other features. Same mistake tools/patch-smoketest-rings-net2.js exists to record.\n'+
'            N.mode="host"; N._vfx.length=0;\n'+
'            N.vfxPush([1,500,500,100,0]);\n'+
'            const snap=N.packSnap();\n'+
'            settle();\n'+
'            const zero=X().live;\n'+
'            check("v132.41 set-pieces: the host queued the row onto a REAL snapshot ("+\n'+
'              ((snap.vfx||[]).length)+" row), so the guest assertion below is about the wire and "+\n'+
'              "not about a hand-made object",(snap.vfx||[]).length===1);\n'+
'            N.mode="guest";\n'+
'            snap.q=N.lastQ+1; N.applySnap(snap);\n'+
'            const after=X().live;');

if(failed.length){
  console.error("REFUSING TO WRITE — anchors failed:");
  failed.forEach(f=>console.error("  - "+f));
  process.exit(1);
}
fs.writeFileSync(F,s);
console.log("patched tools/smoketest.js — the guest set-piece gate uses a real snapshot");
