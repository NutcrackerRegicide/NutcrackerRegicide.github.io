#!/usr/bin/env node
/* v132.7 — MAP REWORK STAGE 4: CAMPS AND CREEP_SITES ARE TWO DIFFERENT THINGS
   ---------------------------------------------------------------------------
   node tools/patch-creepsites.js       (idempotent: re-running reports NOTHING WRITTEN)

   John's ruling: "three new creep camps", nine in total. claude/REGICIDE-MAP-REWORK.md §5 says how,
   and the how is the whole point of this patch:

     Every camp today is a pocket BUMPED OUTSIDE the border, reached through a pass. John's three
     new ones are in the OPEN INTERIOR. That is a different object: contested ground you cross, not
     a safe pocket you farm. Adding three rows to CAMPS would WORK BY ACCIDENT — nearCamp would
     push mountains away from map centre where there are none, and inCampGround would return true on
     ground that is already walkable — but it would leave two unrelated meanings on one array, and
     the next person to widen a nearCamp pad would not know which he was changing.

   SO THE ARRAY SPLITS ALONG WHAT ITS READERS ACTUALLY ASK IT:

     CAMPS (6, unchanged)          the BORDER POCKETS. Read by inCampGround() — which punches the
                                   holes in the invisible wall — by nearCamp(), which keeps the
                                   mountain ring out of the hollows, and by the bay flat and
                                   raidShore, which want the boss. All three questions are about
                                   ground outside the border. None of them is about creeps.
     CREEP_SITES (9 = 6 + 3)       WHERE CREEPS LIVE. Read by 07-ai.js's spawn loop, by
                                   creepCampGrounds' scenery, and now by the tree clearance, the
                                   foliage exclusion and validFor.

   ORDER IS ON THE WIRE, so the three are APPENDED. campStates[i] is indexed by chest events
   ({t:"chest", i:st.i}) and by the late-joiner's w.camps[], and every camp mints CREEP_N unit
   bodies in sequence so unit ids depend on it. Appending leaves indices 0-5 and every existing unit
   id exactly where they were; prepending or interleaving would have silently renumbered the world.

   ================================ WHERE THE THREE GO ================================
   Sited by tools/campsite.js, not typed. The sketch gives intent — one on the centre line north of
   the Grand Bazaar, two flanking to the south — and intent is not coordinates.

                       to King's Rd   to Viking   ground spread
     (0, 55)              43.0          147.9        1.12         its own mirror
     (+-79, -33)          47.3           29.7        1.45 / 1.46  a mirrored pair

   THE SYMMETRY IS x -> -x, NOT THE 180 DEGREES TREE_STANDS USE. This world carries both conventions
   and they are not interchangeable: the stands mirror through map centre, while the roads, thrones
   and border camps mirror about x=0 (roadPoint's own comment: "z(t) === z(1-t)"). A creep camp has
   to relate to the ROADS, so it takes the roads' convention — and under x -> -x a site at (0, z) is
   its own mirror while a pair at (+-X, z) swaps, so each is exactly as far from one throne as from
   the other.

   AND THE PAIR WAS VALIDATED ON BOTH HALVES, which is not pedantry: THE TERRAIN IS NOT MIRROR-
   SYMMETRIC. The roads and thrones are, the height field is noise and noise is not. campsite.js's
   map shows a row where x=+70..91 is level and x=+42..63 is refused as steep. A pair checked only
   on one side is a pair where one team's camp sits in a bowl. 1.45 against 1.46 is the measured
   result of asking.

   RADIUS 16, not the border pockets' 26. A pocket is a hollow carved into a mountain range; this is
   a clearing. It also sets the two numbers the fight is made of, because both derive from r:
     the leash    r - 1.2  = 14.8   (07-ai.js, and it reads st.r — no change needed)
     the aggro    r - 2.5  = 13.5   just inside the 14.5 trampled disc, so stepping on the dirt is
                                    what wakes them, and marching past on a road 30-47 away is not.

   ================================ WHAT THE INTERIOR EXPOSES ================================
   Three things have never come up because no camp has ever stood on ordinary ground:

     TREES WOULD GROW IN IT. plantForests knows about bases, roads, bazaars and nodes. A camp buried
     in forest is unreadable and unfightable. Cleared to r + 4.
     UNDERGROWTH WOULD GROW THROUGH IT, the same way it grew through the plazas before v131.30.
     YOU COULD BUILD ON IT. validFor's border check refused the six pockets for free — they are past
     |x| > MAP.x-3. These are not. And creeps target UNITS, never buildings, and do not steer around
     them: a house dropped in a camp would be un-attackable AND un-blockable, and would end the
     fight for the treasure before it started. Refused within C.r + the building's own r + 2.

   Two smaller truths that were true and are not any more:
     the minimap drew every non-boss camp as the same 3.4px disc. It now scales with st.r, or a
     16-radius clearing claims as much of the map as a 26-radius pocket.
     the tip at 85s said wild camps "lurk in nooks beyond the map's edge". A third of them no
     longer do.

   >>> PROTO 28 -> 29. <<< Fifteen new creep bodies are minted, so the unit count changes and the
   tree clearance moves the node stream. Measured with tools/nodehash.js, not assumed.            */
const fs=require("fs"),path=require("path"),ROOT=path.join(__dirname,"..");
let total=0,failed=0;
const F={};
const load=f=>(F[f]=F[f]!==undefined?F[f]:fs.readFileSync(path.join(ROOT,"js",f),"utf8"));
function sub(file,from,to,why){
  const s=load(file), n=s.split(from).length-1;
  if(n!==1){console.log("  !! "+file+" expected 1, found "+n+"  <<"+from.slice(0,64).replace(/\n/g,"\\n")+">>");failed++;return;}
  F[file]=s.split(from).join(to); total++; console.log("  ok  "+why);
}
if(load("00-data.js").indexOf("CREEP_SITES")>=0){console.log("already applied — NOTHING WRITTEN");process.exit(0);}

// ================================ 1. THE SPLIT ================================
sub("00-data.js",
`function inCampGround(x,z){ // is this spot on a camp pocket's ground?
  for(const C of CAMPS){const dx=x-C.x,dz=z-C.z;if(dx*dx+dz*dz<C.r*C.r)return true;}
  return false;
}`,
`function inCampGround(x,z){ // is this spot on a camp pocket's ground?
  for(const C of CAMPS){const dx=x-C.x,dz=z-C.z;if(dx*dx+dz*dz<C.r*C.r)return true;}
  return false;
}
// ==================== v132.7 CAMPS IS THE BORDER POCKETS. CREEP_SITES IS WHERE CREEPS LIVE. ====================
// They were one array because for fifty versions every camp was both. John's three new ones are in
// the OPEN INTERIOR — contested ground you cross, not a safe pocket you farm — and the moment those
// exist the two meanings come apart:
//   CAMPS       inCampGround() (the holes in the invisible wall), nearCamp() (keep the mountain ring
//               out of the hollows), the bay flat, raidShore. Every one of those is a question about
//               ground OUTSIDE the border, and none of them is about creeps. An interior camp in
//               here would make nearCamp push mountains away from map centre, where there are none.
//   CREEP_SITES 07-ai.js's spawn loop, creepCampGrounds' scenery, the tree clearance, the foliage
//               exclusion, validFor.
// THE THREE ARE APPENDED, AND THAT IS LOAD-BEARING: campStates[i] is indexed by chest events
// ({t:"chest", i:st.i}) and by the late joiner's w.camps[], and each camp mints CREEP_N unit bodies
// in sequence, so unit ids depend on this order. Appending leaves 0-5 and every existing id alone.
//
// RADIUS 16 AGAINST THE POCKETS' 26 — a clearing, not a hollow carved into a mountain range. It also
// sets the fight, because 07-ai.js derives both numbers from r: the hard leash at r-1.2 = 14.8 and
// the aggro ring at r-2.5 = 13.5, which sits just inside the 14.5 trampled disc. Stepping onto the
// dirt is what wakes them; marching past on a road 30-47 away is not.
//
// THE SITES ARE MEASURED, NOT TYPED — tools/campsite.js, which walks the whole field against the
// roads, the thrones, the plazas, the ponds, the border pockets and the ground itself:
//                     to King's Rd   to Viking   ground spread
//     (0, 55)            43.0          147.9        1.12        its own mirror
//     (+-79, -33)        47.3           29.7        1.45 / 1.46 a mirrored pair
// MIRRORED ABOUT x=0, which is the ROADS' convention (roadPoint: "z(t) === z(1-t)") and NOT the
// 180-degree one TREE_STANDS uses. Both live in this world; they are not interchangeable. And the
// pair was validated on BOTH halves because the terrain is noise and noise does not mirror — 1.45
// against 1.46 is the measured result of asking rather than assuming.
const CREEP_R_INNER=16;
const CREEP_SITES=CAMPS.concat([
  {x: 0,z: 55,r:CREEP_R_INNER,inner:true},   // north of the Grand Bazaar, on the centre line
  {x: 79,z:-33,r:CREEP_R_INNER,inner:true},  // the wedge between the Kings Road and the red branch
  {x:-79,z:-33,r:CREEP_R_INNER,inner:true},  // …and its mirror, on the blue side
]);`,
  "00-data.js: CREEP_SITES — the six pockets plus three interior clearings");

// ================================ 2. THE SPAWNER ================================
sub("07-ai.js",
`// ---------- THE WILDS: six creep camps ring the world's edge (v77) ----------`,
`// ---------- THE WILDS: nine creep camps — six ring the world's edge, three stand in the field ----------
// v132.7 CREEP_SITES, not CAMPS: this loop wants everywhere creeps LIVE, which is no longer the same
// question as where the border pockets are. See the note at CREEP_SITES in 00-data.js. Nothing else
// in here changes — st.r, st.aggro and the hard leash were already derived from the site's own
// radius, so a 16-radius clearing works out of the box and a 26-radius hollow is unaffected.`,
  "07-ai.js: the header says nine and says why");

sub("07-ai.js",
`for(let ci=0;ci<CAMPS.length;ci++){
  const C=CAMPS[ci];`,
`for(let ci=0;ci<CREEP_SITES.length;ci++){
  const C=CREEP_SITES[ci];`,
  "07-ai.js: the spawn loop walks CREEP_SITES");

// ================================ 3. THE SCENERY ================================
sub("02-world.js",
`// ---------- creep camp grounds (v77): six wild nooks bumped out past the border ----------
(function creepCampGrounds(){
  for(const C of CAMPS){`,
`// ---------- creep camp grounds (v77): nine wild camps — six nooks past the border, three in the field ----------
// v132.7 CREEP_SITES. Everything below already scales off C.r (the trampled disc at r-1.5, the bone
// scatter at r*0.7, the palisade arc at r-0.8), so an interior clearing dresses itself. The arc's
// "outward" is atan2(C.x, C.z) — a direction from map centre — which for a pocket points at the
// mountains it is carved into and for a clearing simply picks a side for the windbreak. That reads
// as a camp either way; it is the one thing here that means slightly less in the open field.
(function creepCampGrounds(){
  for(const C of CREEP_SITES){`,
  "02-world.js: the camp scenery dresses all nine");

// ================================ 4. TREES AND UNDERGROWTH KEEP OFF ================================
sub("02-world.js",
`    for(const p of VIKPTS)if(_d2(x,z,p.x,p.z)<TREE_CLEAR_VIKING*TREE_CLEAR_VIKING)return false;`,
`    for(const p of VIKPTS)if(_d2(x,z,p.x,p.z)<TREE_CLEAR_VIKING*TREE_CLEAR_VIKING)return false;
    // v132.7 THE CREEP CAMPS. Never needed before: all six pockets sit past the border and this
    // function only ever scatters inside the map, so they were clear for free. The three interior
    // camps are not, and a wolf den buried in forest is unreadable AND unfightable. r+4 puts the
    // treeline just outside the trampled disc, which is what a clearing looks like.
    for(const C of CREEP_SITES)if(_d2(x,z,C.x,C.z)<(C.r+4)*(C.r+4))return false;`,
  "02-world.js: no trees growing inside a creep camp");

sub("02-world.js",
`  for(const p of PONDS){const dx=x-p[0],dz=z-p[1],rr=p[2]+2.4;if(dx*dx+dz*dz<rr*rr)return false;}
  return true;
}`,
`  for(const p of PONDS){const dx=x-p[0],dz=z-p[1],rr=p[2]+2.4;if(dx*dx+dz*dz<rr*rr)return false;}
  // v132.7 …and the creep camps, for the same reason the plazas are here: the trampled disc is a
  // hard-worn surface and undergrowth standing in it is §8.7's artefact, exactly as it was when
  // ferns grew through the bazaar flagstones before v131.30. C.r, so the greenery starts at the rim
  // of the dirt rather than on it.
  for(const C of CREEP_SITES){const dx=x-C.x,dz=z-C.z;if(dx*dx+dz*dz<C.r*C.r)return false;}
  return true;
}`,
  "02-world.js: undergrowth stops growing through the camp floors");

// ================================ 5. YOU CANNOT BUILD IN THE WILDS ================================
sub("06-input.js",
`  if(Math.abs(x)>MAP.x-3||Math.abs(z)>MAP.z-3)return false;
  const r=BLD[type].r;`,
`  if(Math.abs(x)>MAP.x-3||Math.abs(z)>MAP.z-3)return false;
  const r=BLD[type].r;
  // v132.7 THE WILDS ARE NOT A BUILDING PLOT. This never came up because all six camps were border
  // pockets and the line above already refuses them — they are past |x| > MAP.x-3. The three
  // interior camps stand on ordinary buildable ground, and creeps target UNITS, never buildings,
  // and do not steer around them: a house dropped in a camp would be un-attackable AND un-blockable
  // and would settle the fight for the treasure before it started. Placement only — the footprint
  // is not otherwise special, and nothing stops you building right up against the rim.
  if(typeof CREEP_SITES!=="undefined")
    for(const C of CREEP_SITES)if(dist2(x,z,C.x,C.z)<Math.pow(C.r+r+2,2))return false;`,
  "06-input.js: no building inside a creep camp — players and the AI both come through here");

// ================================ 6. THE MINIMAP AND THE TIP ================================
sub("08-ui.js",
`      mm.fillStyle="#4a3a26";
      mm.beginPath();mm.arc(px(st.x),pz(st.z),3.4,0,7);mm.fill();`,
`      mm.fillStyle="#4a3a26";
      // v132.7 SCALED, because the camps are no longer all one size. A flat 3.4 drew a 16-radius
      // interior clearing as though it claimed as much ground as a 26-radius border hollow.
      mm.beginPath();mm.arc(px(st.x),pz(st.z),3.4*((st.r||CAMP_R)/CAMP_R),0,7);mm.fill();`,
  "08-ui.js: the minimap draws a camp the size it is");

sub("09-main.js",
`  [85, "WILD CAMPS lurk in nooks beyond the map's edge — wolves hoard FOOD, barbarians hoard GOLD. Their chests can be STOLEN. Bring 2-3 allies; the packs tear loners apart."],`,
`  [85, "WILD CAMPS: six lurk in nooks beyond the map's edge, THREE STAND IN THE OPEN FIELD — wolves hoard FOOD, barbarians hoard GOLD. Their chests can be STOLEN. Bring 2-3 allies; the packs tear loners apart."],`,
  "09-main.js: the tip stops saying they are all beyond the edge");

// ================================ 7. THE WIRE ================================
sub("10-net.js",
`  PROTO:28,             // bumped whenever the wire format changes OR the generated world does.`,
`  // v132.7 28 -> 29: three interior creep camps. Fifteen more creep bodies are minted, so the unit
  // count and every id after them changes, and the camps' tree clearance moves the node stream.
  // The three are APPENDED to CREEP_SITES so indices 0-5 and the existing ids hold — but a peer on
  // 28 has six camps and 15 fewer units, which is a desync, not a degraded experience.
  PROTO:29,             // bumped whenever the wire format changes OR the generated world does.`,
  "10-net.js: PROTO 28 -> 29");

if(failed){console.log("\n"+failed+" site(s) did not match — NOTHING WRITTEN.");process.exit(1);}
for(const f in F)fs.writeFileSync(path.join(ROOT,"js",f),F[f]);
console.log("\n"+total+" written.\n");
