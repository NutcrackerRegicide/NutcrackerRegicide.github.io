#!/usr/bin/env node
/* patch-smoketest-farmring-v134.js — the gates for v134.1 THE FARM RING.
 *
 * The suite went green on the ring change without a single assertion touching it, which is exactly
 * the state that makes a rule feel tested when it is not. Five gates, in two groups.
 *
 * CONSTRUCTED, around a real Town Center:
 *   1. no non-farm type is legal anywhere inside TC_RING — swept over every buildable type and
 *      24 bearings, not sampled at one convenient point;
 *   2. a farm is refused inside TC_FARM_MIN;
 *   3. …and legal in the band between them (NON-VACUITY: without this, a rule that refused
 *      everything everywhere would pass gates 1 and 2 perfectly);
 *   4. …and non-farms are legal just outside the ring (the other non-vacuity, and the one that
 *      matters most: findSpot gets 50 attempts, and an AI that cannot find a plot is an AI that
 *      silently stops building. 00-data.js's own note at BLD.castle records that costing a release).
 *
 * OBSERVED, on the campaign the suite already runs:
 *   5. no building either team raised over eight minutes violates the ring, AND the AI still put up
 *      a real town (a ring nobody can build inside would satisfy the first half on its own).
 *   6. no farm's BARN intersects its own Town Center's box — the overlap TC_FARM_MIN exists to
 *      prevent, checked against the geometry rather than against the constant, so the day someone
 *      rescales the farm model this fails instead of quietly going back to overlapping.
 */
const fs=require("fs"),path=require("path");
const F=path.join(__dirname,"..","tools","smoketest.js");
let s=fs.readFileSync(F,"utf8");
let failed=[];
function sub(name,from,to){
  const n=s.split(from).length-1;
  if(n!==1){failed.push(name+" (matched "+n+" times, need exactly 1)");return;}
  s=s.split(from).join(to);
}

sub("export the ring constants and the reason predicate",
`  "walkable,pushOutOfBuildings,pickDetour,detourFree,MOVE_STALL_T,MOVE_GOAL_JUMP,separate,"+`,
`  "walkable,pushOutOfBuildings,pickDetour,detourFree,MOVE_STALL_T,MOVE_GOAL_JUMP,separate,"+
  "TC_RING,TC_FARM_MIN,tcRingReason,farmAdjacent,"+   // v134.1 the farm ring`);

sub("the constructed ring gates",
`check("legal farm spots exist around the TC",farmSpot);`,
`check("legal farm spots exist around the TC",farmSpot);
// ==================== v134.1 THE FARM RING ====================
// John: "the only buildings to be built around the town center, directly adjacent to it, should be
// farms." Measured before the change, blue's town read
//   watch_tower@16.7 farm@21.3 farm@22.4 barracks@22.9 house@25.5 …
// — a tower standing where the corn should be. There was no distance-from-the-TC rule at all; the
// only thing holding anything back was generic spacing, which SHRINKS as the town ages because
// bSpace reads the live age and a Town Center's half-extent drops from 11.26 to 8.50 at Classical.
{
  const G=global.__G, tc=G.teamTC(0), RING=G.TC_RING, FMIN=G.TC_FARM_MIN;
  const at=(t,r,a)=>G.validFor(t,tc.x+Math.cos(a)*r,tc.z+Math.sin(a)*r,0);
  const TYPES=["house","barracks","storage_pit","market","blacksmith","temple","watch_tower",
               "tower","stable","archery_range","siege_workshop","castle","stone_wall","stone_gate"];
  // 1. NOTHING but a farm, anywhere inside the ring.
  const inside=[];
  for(const t of TYPES)for(let i=0;i<24;i++)for(const r of [4,10,16,22,28,RING-0.5]){
    const a=i/24*Math.PI*2;
    if(at(t,r,a)===true)inside.push(t+"@"+r.toFixed(1));
  }
  check("v134.1 ring: NO non-farm plot is legal within "+RING+" of your Town Center ("+
    (inside.length?inside.slice(0,4).join(" · ")+(inside.length>4?" +"+(inside.length-4):""):
     "swept "+TYPES.length+" types x 24 bearings x 6 radii, all refused")+")",
    inside.length===0);
  // 2. …and a farm may not crowd it either — that inner edge is what keeps a barn out of the walls.
  const tooClose=[];
  for(let i=0;i<24;i++)for(const r of [4,10,16,FMIN-0.5]){
    const a=i/24*Math.PI*2;
    if(at("farm",r,a)===true)tooClose.push(r.toFixed(1)+"@"+(a*57.3).toFixed(0)+"deg");
  }
  check("v134.1 ring: a farm is refused inside "+FMIN+" too — its barn would stand in the Town "+
    "Center's walls ("+(tooClose.length?tooClose.slice(0,3).join(" · "):"24 bearings, all refused")+")",
    tooClose.length===0);
  // 3. NON-VACUITY, the fields. A rule that refuses everything everywhere passes 1 and 2 perfectly.
  let farmOk=0;
  for(let i=0;i<24;i++)for(const r of [FMIN+1,24,27,RING-1])
    if(at("farm",r,i/24*Math.PI*2)===true)farmOk++;
  check("v134.1 ring: …and the band between them IS plantable ("+farmOk+" of 96 probes legal) — "+
    "without this, a rule that refused every plot on the map would pass the two gates above",
    farmOk>=8);
  // 4. NON-VACUITY, the town. The one that matters most: findSpot gets 50 attempts, and an AI that
  //    cannot find a plot is an AI that silently stops building.
  let outOk=0;
  for(let i=0;i<24;i++)for(const r of [RING+2,RING+8,RING+16])
    if(at("house",r,i/24*Math.PI*2)===true)outOk++;
  check("v134.1 ring: …and a house is legal just OUTSIDE it ("+outOk+" of 72 probes) — the AI "+
    "samples 50 times before it gives up, so a ring that leaves no room is an AI that stops building",
    outOk>=8);
}`);

sub("the campaign observation",
`check("AI still builds farms with doubled footprint ("+farms+")",farms>=2);`,
`check("AI still builds farms with doubled footprint ("+farms+")",farms>=2);
// v134.1 …AND THE TOWNS OBEY THE RING. Observed on the campaign above, both teams, every building.
{
  const G=global.__G, RING=G.TC_RING, FMIN=G.TC_FARM_MIN;
  const viol=[]; let nonFarm=0, ringFarms=0;
  for(const t of [0,1]){
    const tc=G.buildings.find(b=>b.alive&&b.team===t&&b.type==="towncenter"); if(!tc)continue;
    for(const b of G.buildings){
      if(!b.alive||b.team!==t||b.type==="towncenter")continue;
      const d=Math.hypot(b.x-tc.x,b.z-tc.z);
      if(b.type==="farm"){ if(d<FMIN)viol.push("farm@"+d.toFixed(1)); else if(d<RING)ringFarms++; }
      else { if(d<RING)viol.push(b.type+"@"+d.toFixed(1)); nonFarm++; }
    }
  }
  check("v134.1 ring: eight minutes of AI town-building breaks it "+viol.length+" times ("+
    (viol.length?viol.slice(0,4).join(" · "):"none")+") — v133 put a watch_tower at 16.7 and a "+
    "barracks at 22.9",viol.length===0);
  // …and it is not obeying the ring by building nothing. A starved AI would pass the line above.
  check("v134.1 ring: …and the AI still raised a real town around it ("+nonFarm+" buildings out "+
    "past the ring, "+ringFarms+" fields inside it)",nonFarm>=8&&ringFarms>=3);
}
// v134.1 THE BARN AND THE BOX, pinned per age. TC_FARM_MIN exists so a farm's barn does not stand
// inside its own Town Center's collider — that overlap is a sliver of ground inside two colliders
// at once, legal in neither, and it is the residue v134.0's push-out could not resolve.
//
// The binding case is the DIAGONAL, not the axes: the barn hangs off the farm's own corner at
// (-3.03,-4.72) after BSCALE, and a box's corner is exactly where a diagonal offset reaches
// furthest in. Solved numerically over 3600 bearings, the least farm-centre distance that clears
// the box is
//
//     age 1  23.45      age 2  20.80      age 3  23.75      age 4  26.75      age 5  22.20
//
// driven by the Town Center's own half-extents: 11.26x10.75 at Stone, 8.50x7.75 at Classical,
// PEAKING at 11.88x11.90 at age 4 and dropping to 9.10 at 5. TC_FARM_MIN 21 therefore clears the
// box at ONE age (2) and not at the other four.
//
// The first cut of this gate asserted zero overlap and went red. The second asserted "clears every
// age except the peak at 4" and went red too — and that second red is the useful one, because the
// claim was a guess dressed as a fact. The overlap is the NORMAL state of a farm ring at this
// radius, not a one-age pinch, and a comment saying otherwise is exactly what the next session
// would have believed.
//
// WHY IT SHIPS ANYWAY: clearing every age needs TC_FARM_MIN 27, which against TC_RING 30 leaves a
// three-unit band for a field thirteen wide — the ring would have to move out to ~36 and the town
// with it, and there are only 45 units behind a Town Center before the map edge. The overlap is
// bounded (2.81, gated below), it is strictly smaller than v133's, where farms sat at 16.2, and
// v134.0's push-out and idle sweep resolve bodies out of the sliver — the "nobody standing IN a
// wall" gate measures exactly that on this same campaign and reads 0.00 deep.
//
// THE REAL CURE, when someone wants it: rotate each field so its barn faces AWAY from the Town
// Center. The barn's offset is fixed in world space only because a farm is never rotated;
// makeBuilding already takes a rot and the collider, the apron and the mesh all honour it. Then the
// overlap vanishes at any distance, TC_FARM_MIN can stay where it is, and the barns face the town —
// which is also how a farm ought to look. It needs a shot before it ships, not a derivation.
{
  const G=global.__G, P=G.BLD.farm.blockParts||[], bs=G.BSCALE.farm||1;
  const tcDef=G.BLD.towncenter;
  const clearAt=(A)=>{ // the least farm-centre distance with no barn disc touching the TC box
    const hx=((tcDef.fxA&&tcDef.fxA[A])||tcDef.fx)+0.7, hz=((tcDef.fzA&&tcDef.fzA[A])||tcDef.fz)+0.7;
    for(let D=16;D<=44;D+=0.05){
      let ok=true;
      for(let i=0;i<720&&ok;i++){
        const th=i/720*Math.PI*2, fx=Math.cos(th)*D, fz=Math.sin(th)*D;
        for(const q of P){
          if(q.minAge!==undefined&&A<q.minAge)continue;
          if(q.maxAge!==undefined&&A>q.maxAge)continue;
          const wx=fx+q.x*bs, wz=fz+q.z*bs, qr=q.r*bs+0.7;
          const gx=Math.max(0,Math.abs(wx)-hx), gz=Math.max(0,Math.abs(wz)-hz);
          if(gx*gx+gz*gz<qr*qr){ok=false;break;}
        }
      }
      if(ok)return D;
    }
    return 99;
  };
  const tbl=[1,2,3,4,5].map(A=>({A,d:clearAt(A)}));
  const shown=tbl.map(r=>"age"+r.A+" "+r.d.toFixed(2)).join(" · ");
  // The table is the pin. Rescale the farm model, move a blockPart, or change the Town Center's
  // fxA/fzA and these numbers move and this goes red — which is the only way the sentence
  // "TC_FARM_MIN is 21 because the geometry says so" stays true rather than becoming folklore.
  const expect={1:23.45,2:20.80,3:23.75,4:26.75,5:22.20};
  const drift=tbl.filter(r=>Math.abs(r.d-expect[r.A])>0.1)
                 .map(r=>"age"+r.A+" "+r.d.toFixed(2)+" not "+expect[r.A]);
  check("v134.1 barn: the farm-to-Town-Center clearance table is unmoved ("+shown+")"+
    (drift.length?" — DRIFTED: "+drift.join(" · "):""),drift.length===0);
  // The state of affairs stated as it IS rather than as it would be convenient for it to be. This
  // gate exists so that stays a DECISION rather than drifting into an accident: if a future change
  // clears more ages — rotating the barns would clear all five — this goes red and whoever reads it
  // gets to delete a caveat instead of inheriting a stale one.
  const shortAt=tbl.filter(r=>G.TC_FARM_MIN<r.d).map(r=>"age"+r.A);
  check("v134.1 barn: TC_FARM_MIN ("+G.TC_FARM_MIN+") clears the box at age 2 ALONE — short at "+
    shortAt.join(",")+", because clearing them all needs 26.75 against a ring of "+G.TC_RING+
    ". The overlap is bounded below, no body ends up in it, and the cure is to rotate the barns "+
    "to face away — which needs a shot before it ships",
    shortAt.join(",")==="age1,age3,age4,age5");
  // …and whatever overlap the ring does permit stays inside what a farm at its inner edge can
  // reach. A deeper one would mean the RING leaked, not the barn.
  let worst=0;
  for(const t of [0,1]){
    const tc=G.buildings.find(b=>b.alive&&b.team===t&&b.type==="towncenter"); if(!tc)continue;
    const A=Math.max((tc.def.age||0),Math.min(5,G.teamAge[t]||0));
    const hx=((tc.def.fxA&&tc.def.fxA[A])||tc.def.fx)+0.7, hz=((tc.def.fzA&&tc.def.fzA[A])||tc.def.fz)+0.7;
    for(const f of G.buildings){
      if(!f.alive||f.team!==t||f.type!=="farm")continue;
      const rot=f.rot||0, c=Math.cos(rot), sn=Math.sin(rot);
      for(const q of P){
        if(q.minAge!==undefined&&A<q.minAge)continue;
        if(q.maxAge!==undefined&&A>q.maxAge)continue;
        const qx=q.x*bs, qz=q.z*bs, qr=q.r*bs+0.7;
        const wx=f.x+qx*c+qz*sn, wz=f.z-qx*sn+qz*c;   // the same local->world as the collider
        const gx=Math.max(0,Math.abs(wx-tc.x)-hx), gz=Math.max(0,Math.abs(wz-tc.z)-hz);
        const ov=qr-Math.hypot(gx,gz);
        if(ov>worst)worst=ov;
      }
    }
  }
  check("v134.1 barn: the worst overlap the campaign produced is "+worst.toFixed(2)+", within what "+
    "a farm at the ring's inner edge can reach (2.81) — deeper would mean the ring leaked",
    worst<=2.81);
}`);

if(failed.length){
  console.error("PATCH ABORTED — anchors did not match exactly once:");
  for(const f of failed)console.error("  · "+f);
  process.exit(1);
}
fs.writeFileSync(F,s);
console.log("patch-smoketest-farmring-v134: OK");
