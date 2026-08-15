#!/usr/bin/env node
/* patch-smoketest-rings-fix2.js — two ring gates passed while the thing they name was broken.
 *
 * ── 1. THE GUEST GATE WAS THE WORST KIND OF VACUOUS ─────────────────────────────────────────
 * Making buffFxTick host-only — literally re-introducing trap #12, the bug the assertion exists
 * to catch — left it GREEN. The reason: the block called FX() directly to measure the host case,
 * and _ringOn still held that count when the guest frame was measured. So it asserted "a ring was
 * drawn at some point recently", which is true whoever drew it.
 *   Now the counter is driven to a known ZERO first (one tick with no mask), the mask is set
 * WITHOUT calling FX, and only then does the guest frame run. If NET.guestFrame does not reach
 * buffFxTick, the count stays at zero and the gate says so.
 *
 * ── 2. AND "DROPPING THE BUFF CLEARS THE RING" MEASURED THE WRONG NUMBER ────────────────────
 * It read _ringOn, which counts rings DRAWN THIS FRAME. Delete the hide-all pass — so every ring
 * ever drawn stays on the ground forever, exactly the bug named in the assertion — and _ringOn
 * still reads 0, because nothing was drawn this frame. The meshes are all still visible.
 *   It now reads the count of VISIBLE MESHES, which is what a player would see.
 *
 * Both found by mutation, neither by reading. Ninth and tenth vacuous gates of my own this
 * session; the pattern is always the same — the assertion measured something adjacent to its
 * sentence rather than the sentence itself.
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

sub("clears the ring — count VISIBLE meshes, not draws-this-frame",
'        R._fxMask=0; FX(0.016);\n'+
'        check("v132.39 rings: dropping the buff CLEARS the ring — hide-all then re-arm, or a "+\n'+
'          "Sanctuary you walked out of stays painted on the ground for the rest of the match ("+\n'+
'          S().rings+" left)",S().rings===0);',
'        R._fxMask=0; FX(0.016);\n'+
'        // ⚠ VISIBLE MESHES, not _ringOn. _ringOn counts what was DRAWN this frame, so deleting\n'+
'        // the hide-all pass — which leaves every ring ever drawn on the ground forever, the exact\n'+
'        // bug named here — still reads 0. Found by mutation; the first version was vacuous.\n'+
'        check("v132.39 rings: dropping the buff CLEARS the ring — hide-all then re-arm, or a "+\n'+
'          "Sanctuary you walked out of stays painted on the ground for the rest of the match ("+\n'+
'          S().live.length+" still visible)",S().live.length===0);');

sub("guest gate — drive the counter to a known zero first",
'          const mode0=G.NET.mode;\n'+
'          R._fxMask=G.FX_SANCT; R._fxStill=1;\n'+
'          FX(0.016); const hostRings=S().rings;\n'+
'          for(const m of []){}\n'+
'          G.NET.mode="guest";\n'+
'          let threw="";\n'+
'          try{ G.NET.guestFrame(0.016); }catch(e){ threw=e.message; }\n'+
'          const guestRings=S().rings;\n'+
'          G.NET.mode=mode0;',
'          const mode0=G.NET.mode;\n'+
'          R._fxMask=G.FX_SANCT; R._fxStill=1;\n'+
'          FX(0.016); const hostRings=S().live.length;\n'+
'          // ⚠ DRIVE THE COUNTER TO A KNOWN ZERO. The first version measured after its own direct\n'+
'          // FX() call, so it asserted "a ring was drawn recently" — true whoever drew it, and it\n'+
'          // stayed GREEN with buffFxTick made host-only, which is the exact bug it is named for.\n'+
'          R._fxMask=0; FX(0.016);\n'+
'          const zeroed=S().live.length;\n'+
'          R._fxMask=G.FX_SANCT;            // armed, but NOTHING has drawn it — only a guest frame can\n'+
'          G.NET.mode="guest";\n'+
'          let threw="";\n'+
'          try{ G.NET.guestFrame(0.016); }catch(e){ threw=e.message; }\n'+
'          const guestRings=S().live.length;\n'+
'          G.NET.mode=mode0;\n'+
'          check("v132.39 rings on a GUEST: …and the counter really was at zero before the guest "+\n'+
'            "frame ran ("+zeroed+"), so the next assertion cannot pass on the host\'s leftovers",\n'+
'            zeroed===0);');

sub("guest gate message",
'          check("v132.39 rings on a GUEST: a real NET.guestFrame draws them — buffFxTick rides "+\n'+
'            "updateEffects because BOTH frame paths call it. Display code in tickBody\'s host "+\n'+
'            "branch is trap #12, and that shipped once already (host "+hostRings+", guest "+\n'+
'            guestRings+")"+(threw?" ["+threw+"]":""),!threw&&guestRings>=1);',
'          check("v132.39 rings on a GUEST: a real NET.guestFrame draws them from a standing start "+\n'+
'            "— buffFxTick rides updateEffects because BOTH frame paths call it. Display code in "+\n'+
'            "tickBody\'s host branch is trap #12, and that shipped once already (host "+hostRings+\n'+
'            ", zeroed 0, guest "+guestRings+")"+(threw?" ["+threw+"]":""),\n'+
'            !threw&&hostRings>=1&&guestRings>=1);');

if(failed.length){
  console.error("REFUSING TO WRITE — anchors failed:");
  failed.forEach(f=>console.error("  - "+f));
  process.exit(1);
}
fs.writeFileSync(F,s);
console.log("patched tools/smoketest.js — two vacuous ring gates made honest");
