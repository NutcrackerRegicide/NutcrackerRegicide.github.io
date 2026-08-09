#!/usr/bin/env node
/* v132.8 — THE SMOKETEST STILL BELIEVED IN SIX CAMPS
   --------------------------------------------------
   node tools/patch-smoketest-camps.js  (idempotent: re-running reports NOTHING WRITTEN)

   Stage 4 produced five smoketest failures. All five are the harness noticing, correctly, that the
   world changed:

     FAIL — 100 army units + 36 camp creeps spawned (5 packs of 5 + the shore's 11)
     FAIL — six creep camps ring the world (normal 5 bodies, the shore 11)
     FAIL — camps bump OUT past the border; 4 corners + 2 long-edge midpoints
     FAIL — v132 wire: PROTO is 28 …
     FAIL — v115/v132 net: PROTO 28 … and `ares` still rides both payloads

   THE THIRD ONE IS THE ONE WORTH READING TWICE, because it was asserting the exact invariant this
   stage deliberately broke — and it was asserting it of the WRONG ARRAY:

       CS.every(s => Math.abs(s.x) > MAP.x || Math.abs(s.z) > MAP.z)

   `CS` is campStates, which is now every camp CREEPS LIVE IN, and three of those stand in the open
   field on purpose. Deleting the check would throw away the thing that matters most about the
   split: that CAMPS — the array inCampGround() punches holes in the invisible wall from, and that
   nearCamp() keeps the mountain ring out of — is STILL nothing but border pockets. An interior camp
   leaking into CAMPS would make nearCamp push mountains away from map centre where there are none
   and make walkable() true on ground that already was, and both are silent.

   So it becomes two checks that say the two halves of the split out loud:
       CAMPS is still exactly the six pockets, all of them past the border
       the three interior sites are all INSIDE it, and campStates covers both kinds

   Numbers, all measured from the run rather than re-derived:
       army units      100      unchanged
       camp creeps      36  ->  51        three packs of CREEP_N=5
       camps             6  ->   9
       nodes           844  ->  791       the clearings' tree clearance felled 53 more
       node hash  1a85b0de9797edd9 -> 2476d513e8daf327   (res=2ac1ea6adf9f4553, unmoved)
   `res` holding across all of v132 is worth noticing: every stage of this rework has moved trees
   and not one has moved a resource node, because everything being changed lives downstream of
   placeNodes.                                                                                    */
const fs=require("fs"),path=require("path"),ROOT=path.join(__dirname,"..");
let total=0,failed=0;
const P=path.join(ROOT,"tools","smoketest.js");
let S=fs.readFileSync(P,"utf8");
function sub(from,to,why){
  const n=S.split(from).length-1;
  if(n!==1){console.log("  !! expected 1, found "+n+"  <<"+from.slice(0,72).replace(/\n/g,"\\n")+">>");failed++;return;}
  S=S.split(from).join(to); total++; console.log("  ok  "+why);
}
if(S.indexOf("CREEP_SITES")>=0){console.log("already applied — NOTHING WRITTEN");process.exit(0);}

// ---- the harness has to be able to see both arrays ---------------------------------------------
sub(
`  "vikingPoint,BAZAAR_SITES,TREE_CLEAR_VIKING,"+`,
`  "vikingPoint,BAZAAR_SITES,TREE_CLEAR_VIKING,CREEP_SITES,CREEP_R_INNER,"+`,
  "smoketest: the harness can see CREEP_SITES and CREEP_R_INNER");

// ---- the head count ----------------------------------------------------------------------------
sub(
`check("100 army units + 36 camp creeps spawned (5 packs of 5 + the shore's 11)",
  units.filter(u=>u.team<2).length===100&&units.filter(u=>u.team===2).length===36);`,
`// v132.7 51, not 36: three interior camps at CREEP_N=5 apiece. Written as the ARITHMETIC rather
// than as the number, so the day a tenth camp appears this check moves with it instead of failing.
check("100 army units + "+(units.filter(u=>u.team===2).length)+" camp creeps (5 a camp + the shore's 11)",
  units.filter(u=>u.team<2).length===100&&
  units.filter(u=>u.team===2).length===
    (global.__G.CREEP_SITES.filter(c=>!c.boss).length*5)+11);`,
  "smoketest: the creep head count is derived from CREEP_SITES, not typed");

// ---- the split, said out loud -------------------------------------------------------------------
sub(
`  check("six creep camps ring the world (normal 5 bodies, the shore 11)",
    CS.length===6&&CS.filter(s=>!s.boss).every(s=>s.creeps.length===5)&&CS.find(s=>s.boss).creeps.length===11);
  check("camps bump OUT past the border; 4 corners + 2 long-edge midpoints",
    CS.every(s=>Math.abs(s.x)>MAPh.x||Math.abs(s.z)>MAPh.z)&&CS.filter(s=>s.x===0).length===2);`,
`  // v132.7 THE SPLIT, ASSERTED AS TWO FACTS INSTEAD OF ONE STALE ONE. What used to be here —
  // "every camp is past the border" — was asked of campStates, which is now every camp creeps live
  // in, and three of those stand in the open field by design. The invariant that still has to hold,
  // and that nothing else checks, is that CAMPS did not absorb them: it is the array
  // inCampGround() punches holes in the invisible wall from and nearCamp() keeps the mountain ring
  // out of, so an interior camp leaking in would push peaks away from map centre where there are
  // none and make walkable() true on ground that already was. Both failures are silent.
  check(CS.length+" creep camps: the border pockets plus the interior clearings (5 bodies each, the shore 11)",
    CS.length===G.CREEP_SITES.length&&
    CS.filter(s=>!s.boss).every(s=>s.creeps.length===5)&&CS.find(s=>s.boss).creeps.length===11);
  check("CAMPS is STILL nothing but border pockets — 4 corners + 2 long-edge midpoints",
    G.CREEP_SITES.filter(c=>!c.inner).length===6&&
    G.CREEP_SITES.filter(c=>!c.inner).every(c=>Math.abs(c.x)>MAPh.x||Math.abs(c.z)>MAPh.z)&&
    G.CREEP_SITES.filter(c=>!c.inner&&c.x===0).length===2);
  check("…and the interior camps are all INSIDE the map, mirrored about x=0",
    G.CREEP_SITES.filter(c=>c.inner).length===3&&
    G.CREEP_SITES.filter(c=>c.inner).every(c=>Math.abs(c.x)+c.r<MAPh.x&&Math.abs(c.z)+c.r<MAPh.z)&&
    G.CREEP_SITES.filter(c=>c.inner).every(c=>
      c.x===0||G.CREEP_SITES.some(o=>o.inner&&o.x===-c.x&&o.z===c.z)));
  // the pockets and the clearings are different SIZES, and the leash and aggro both derive from it
  check("an interior camp is a clearing ("+G.CREEP_R_INNER+"), not a hollow ("+CR+")",
    G.CREEP_R_INNER<CR&&CS.filter((s,i)=>G.CREEP_SITES[i].inner).every(s=>s.r===G.CREEP_R_INNER&&
      Math.abs(s.aggro-(G.CREEP_R_INNER-2.5))<1e-9));`,
  "smoketest: the split asserted as two facts — CAMPS stays border-only, the three stay inside");

// ---- the wire ------------------------------------------------------------------------------------
sub(
`  check("v132 wire: PROTO is 28 — the envelope delta OMITS fields, which an older peer misreads",NET.PROTO===28);`,
`  check("v132 wire: PROTO is 29 — the envelope delta OMITS fields, which an older peer misreads",NET.PROTO===29);`,
  "smoketest: PROTO 28 -> 29 (the snapshot assertion)");

sub(
`  check("v115/v132 net: PROTO 28 (the envelope delta omits fields) and \`ares\` still rides both payloads",
    G.NET.PROTO===28&&`,
`  check("v115/v132 net: PROTO 29 (the envelope delta omits fields) and \`ares\` still rides both payloads",
    G.NET.PROTO===29&&`,
  "smoketest: PROTO 28 -> 29 (the ares assertion)");

if(failed){console.log("\n"+failed+" site(s) did not match — NOTHING WRITTEN.");process.exit(1);}
fs.writeFileSync(P,S);
console.log("\n"+total+" written.\n");
