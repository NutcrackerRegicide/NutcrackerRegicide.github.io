#!/usr/bin/env node
/* v132.12 — THE INTERIOR CAMPS: RIGHT SIDE OF THE ROAD, SMALLER, AND IN THE TREES
   ------------------------------------------------------------------------------
   node tools/patch-campsites2.js       (idempotent: re-running reports NOTHING WRITTEN)

   Four things John asked for after playtesting v132.8, and one of them says the layout was mirrored:

   1. "If i am on blue team facing down kings road toward red base, there should be TWO new camps on
      the RIGHT side of kings road and ONE on the left side. right now it is the opposite."
      HE IS RIGHT AND I HAD THE AXIS BACKWARDS. Blue stands at (-175, 0) facing +x with +y up, so
      right = cross(forward, up) = +z. v132.7 shipped ONE camp at +z and the PAIR at -z. Re-reading
      the sketch confirms it independently: its "up" is the VIKINGS, and the Viking bay is at
      z = -196, so sketch-up is -z. The lone camp is drawn between the Viking arc and the King's
      Road (-z) and the pair on the far side of the King's Road (+z). Both readings agree; mine did
      not match either.
   2. "i wish the camps closest to the bazaar were a little bit further away from the bazaar" — and
      then, more strongly: "there should not even be creep camps near the bazaar." The old pair sat
      33.7 from a team bazaar. The clearance is now plaza + disc + 30, and moving the pair to the far
      side of the King's Road puts them 180+ from any team bazaar anyway.
   3. "more tucked into heavily wooded areas. for example this camp is pretty much just in the open."
   4. "make footprint of inner map creep camps smaller (reduce by 30%?)" — r 16 -> 11.

   ================================ (3) IS THE ONE WITH A DESIGN IN IT ================================
   "Tucked in" turned out to have two halves, and only the second one is obvious.

   THE FIRST HALF IS A CLEARANCE COLLISION, and it is the same bug the Viking road's bow was fixed
   for one patch earlier. A road clears trees to 21. A camp clears them to r+4. If the camp centre is
   any closer to the road than the SUM of those, the two cleared corridors weld together and render
   as one continuous bare avenue with the camp as a bulge in it — which is precisely why the old camp
   at (79, -33), 29.7 off the Viking road, "is pretty much just in the open". So the siting minimum
   is no longer "keep the two decals apart" (21.4 from the King's Road) but "keep the two CLEARINGS
   apart" (38). tools/campsite.js carries it now and it is the constraint that rejects the most
   ground on the map.

   THE SECOND HALF IS THAT THE WOOD HAS TO BE PUT THERE. Siting a camp inside existing forest does
   not work and the reason is circular: TREE_STANDS' 14 wild stands are rejection-sampled against
   clearOf(), which tests the camps, so moving a camp reshuffles which stands are accepted and the
   forest you sited into is not the forest you get. The 10 HAND-placed stands are stable — but they
   mirror through map CENTRE, (x,z) -> (-x,-z), so no x-mirrored pair can sit in hand-placed woods on
   both sides. There is no arrangement of the existing stands that does this.
   So the woods are planted ON the camps, deliberately, and the camp's own r+4 clearance punches the
   hollow out of the middle: dense forest from 15 to ~24, thinning to nothing at 30, around a 9.5
   trampled disc. That is what a camp in the woods looks like, and it is placed rather than hoped for.
   THE STAND PAIRS ARE CHOSEN TO SATISFY BOTH SYMMETRIES AT ONCE. stand(x,z,r) pushes (x,z) AND
   (-x,-z). Calling it at (65, 77) and again at (65, -77) yields stands at all four of (+-65, +-77) —
   a set closed under the trees' 180-degree convention AND under the roads' x-mirror one, so the two
   camps of the pair get identical cover without either convention being bent.
   The stand cap stays at 24. Six of the wild stands become camp thickets; the COUNT is what sets
   meadow gap size (v132.0 measured this the hard way), so holding the count holds the meadows.

   ================================ THE SITES ================================
   Measured by tools/campsite.js against the v132.9 roads and the v132.11 bazaars, not typed:

                     to King's Rd   to Viking   ground spread
       (0, -72)          84.0          75.5        0.57        its own mirror
       (+-65, 77)        62.9         134.3        1.19 / 1.19 a mirrored pair

   1.19 against 1.19 is the pair validated on both halves — the terrain is noise and noise does not
   mirror, so this is asked, not assumed.

   ================================ (4) AND WHAT r ACTUALLY CONTROLS ================================
   r 16 -> 11 is not only a footprint. 07-ai.js derives everything from it:
       trampled disc   r - 1.5   14.5 -> 9.5
       hard leash      r - 1.2   14.8 -> 9.8    (21.8 while the camp is awake, v132.10)
       aggro ring      r - 2.5   13.5 -> 8.5
       creep posts     r*0.35 and +r*0.17
   An 8.5 aggro ring is why v132.10 had to land first: at 8.5 a slinger with range 16 could stand
   outside the ring and shoot the pack to death without being seen. It wakes on damage now.       */
const fs=require("fs"),path=require("path"),ROOT=path.join(__dirname,"..");
let total=0,failed=0;
const F={};
const load=f=>(F[f]=F[f]!==undefined?F[f]:fs.readFileSync(path.join(ROOT,"js",f),"utf8"));
function sub(file,from,to,why){
  const s=load(file), n=s.split(from).length-1;
  if(n!==1){console.log("  !! "+file+" expected 1, found "+n+"  <<"+from.slice(0,64).replace(/\n/g,"\\n")+">>");failed++;return;}
  F[file]=s.split(from).join(to); total++; console.log("  ok  "+why);
}
if(load("00-data.js").indexOf("CREEP_R_INNER=11")>=0){console.log("already applied — NOTHING WRITTEN");process.exit(0);}

// ---- the sites ---------------------------------------------------------------------------------
sub("00-data.js",
`const CREEP_R_INNER=16;
const CREEP_SITES=CAMPS.concat([
  {x: 0,z: 55,r:CREEP_R_INNER,inner:true},   // north of the Grand Bazaar, on the centre line
  {x: 79,z:-33,r:CREEP_R_INNER,inner:true},  // the wedge between the Kings Road and the red branch
  {x:-79,z:-33,r:CREEP_R_INNER,inner:true},  // …and its mirror, on the blue side
]);`,
`// v132.12 r 16 -> 11, John's "reduce by 30%". It is not only a footprint: 07-ai.js derives the
// trampled disc (r-1.5 -> 9.5), the hard leash (r-1.2 -> 9.8) and the aggro ring (r-2.5 -> 8.5)
// from it, and an 8.5 ring is why v132.10's wake-on-damage had to land first — a slinger's range is
// 16, so without it the whole pack could be shot to death from outside its own awareness.
const CREEP_R_INNER=11;
// v132.12 AND THE LAYOUT WAS MIRRORED. John: "facing down kings road toward red base, there should
// be TWO new camps on the RIGHT side of kings road and ONE on the left. right now it is the
// opposite." Blue faces +x with +y up, so right = cross(forward,up) = +z — and the sketch says the
// same thing independently, because its "up" is the VIKINGS and the bay is at z = -196: the lone
// camp sits between the Viking arc and the King's Road (-z), the pair on the far side (+z).
// Sited by tools/campsite.js against the v132.9 roads and the v132.11 bazaars:
//                  to King's Rd   to Viking   ground spread
//     (0, -72)        84.0           75.5       0.57        its own mirror
//     (+-65, 77)      62.9          134.3       1.19 / 1.19 both halves measured, not assumed
const CREEP_SITES=CAMPS.concat([
  {x: 0,z:-72,r:CREEP_R_INNER,inner:true},   // the lone camp, between the Kings Road and the arc
  {x: 65,z: 77,r:CREEP_R_INNER,inner:true},  // the pair, on the far side of the Kings Road…
  {x:-65,z: 77,r:CREEP_R_INNER,inner:true},  // …mirrored about x=0, so neither team owns one
]);`,
  "00-data.js: r 11, and the layout un-mirrored to match the sketch");

// ---- the woods that make them camps in a forest -------------------------------------------------
sub("02-world.js",
`  stand(64,46,30); stand(120,88,26); stand(18,-88,29);`,
`  stand(64,46,30); stand(120,88,26); stand(18,-88,29);
  // v132.12 THE CAMP THICKETS. John: "more tucked into heavily wooded areas. for example this camp
  // is pretty much just in the open." Siting a camp INTO existing forest cannot work — the 14 wild
  // stands below are rejection-sampled against clearOf(), which tests the camps, so moving a camp
  // reshuffles the forest you sited into. And the hand stands above mirror through map CENTRE,
  // (x,z)->(-x,-z), so no x-mirrored pair of camps can sit in them on both sides. So the wood is
  // PLACED, and the camp's own r+4 clearance punches the hollow out of the middle: dense from 15 to
  // ~24, gone by 30, around a 9.5 trampled disc.
  // TWO CALLS FOR THE PAIR, AND THAT IS THE TRICK: stand() pushes (x,z) and (-x,-z), so (65,77) and
  // (65,-77) together yield all four of (+-65,+-77) — a set closed under the trees' 180-degree
  // convention AND under the roads' x-mirror one. Neither convention is bent and both camps of the
  // pair get identical cover.
  stand(0,-72,30);                      // the lone camp (its mirror lands at (0, 72), also useful)
  stand(65,77,30); stand(65,-77,30);    // -> (+-65, +-77): the pair, both halves
  // THE CAP BELOW STAYS AT 24. Six of the wild stands become camp thickets; stand COUNT is what
  // sets meadow gap size at fixed coverage (v132.0 measured that the hard way), so holding the
  // count holds the meadows.`,
  "02-world.js: woods planted on the camps, closed under both symmetries");

if(failed){console.log("\n"+failed+" site(s) did not match — NOTHING WRITTEN.");process.exit(1);}
for(const f in F)fs.writeFileSync(path.join(ROOT,"js",f),F[f]);
console.log("\n"+total+" written.\n");
