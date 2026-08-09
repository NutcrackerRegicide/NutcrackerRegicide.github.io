#!/usr/bin/env node
/* v132.11 — THE BAZAARS STAND BESIDE THE ROADS, NOT ON THEM
   ---------------------------------------------------------
   node tools/patch-bazaaroffset.js     (idempotent: re-running reports NOTHING WRITTEN)

   John, playtesting: "grand bazaar should be to the right of kings road while the other two bazaars
   should be to the left of vikings roads. right now all bazaars are directly on top of the roads."

   HE IS DESCRIBING AN OFFSET THAT EXISTS AND IS TOO SMALL TO SEE. The Grand Bazaar was
   roadPoint(0.5) + 3.2 in z, against a plaza of 11.4 and a road whose half-width reaches 5.86 — so
   the ribbon runs 8.2 units INSIDE the plaza's outer step. The two team bazaars had no offset at
   all: they were vikingPoint(team, 0.42), the spine itself, so the track goes straight through the
   middle of the flagstones. A market on a road is a roadblock; a market BESIDE a road is a market.

   THE NUMBERS ARE THE TWO SURFACES PLUS A STRIP OF LAWN YOU CAN SEE:
       Grand   plaza 11.4 + King's half-width 5.86 + 6 = 23.3  ->  24
       team    plaza  8.6 + Viking half-width 3.22 + 6 = 17.8  ->  18

   WHICH SIDE, AND WHY IT IS NOT ARBITRARY. John's frame: blue stands at (-175, 0) facing red, so
   forward is +x, up is +y, and right = cross(forward, up) = +z.
     · "to the RIGHT of kings road"  -> +z. The sketch agrees: the Grand Bazaar is drawn BELOW the
       King's Road, and the sketch's up is the Vikings, which is -z.
     · "to the LEFT of vikings roads" -> -z, which is the OUTSIDE of the arc, away from the King's
       Road. The sketch agrees again: both team bazaars sit outside the curve, on the Viking side.

   AND THE TEAM BAZAARS ARE OFFSET ALONG THE SPINE'S OWN NORMAL, not along z. The Viking road runs
   diagonally and its bearing changes along its length, so a flat "+z" offset would swing the plaza
   from beside the road to in front of it as the bearing turns. vikingOffset() takes the across-track
   normal from a central difference on the real spine and picks whichever of the two points away
   from the King's Road, which is the one with nz < 0. Same construction the road ribbon itself uses
   to lay its cross-sections, for the same reason.

   THE CLEARANCES ARE LEFT ALONE ON PURPOSE. TREE_CLEAR_ROAD is 21 and TREE_CLEAR_BAZAAR is 15, so
   at an offset of 24 the two cleared corridors still overlap and no wood grows between the Grand
   Bazaar and the King's Road. For a CAMP that would be the bug John reported one message earlier —
   a hollow that should be hidden sitting in one continuous bare avenue. For a market it is the
   correct read: a trade post has an open forecourt onto the highway. Do not "fix" this by symmetry
   with the camp rule; they want opposite things.

   Everything downstream is derived and follows by itself: 01-engine.js's plaza flats come from
   BAZAAR_SITES (tools/mapconst.js is the gate), neutralMarkets is populated from it, and the
   foliage exclusion and tree clearance both read neutralMarkets. Nothing else is typed.          */
const fs=require("fs"),path=require("path"),ROOT=path.join(__dirname,"..");
let total=0,failed=0;
const F={};
const load=f=>(F[f]=F[f]!==undefined?F[f]:fs.readFileSync(path.join(ROOT,"js",f),"utf8"));
function sub(file,from,to,why){
  const s=load(file), n=s.split(from).length-1;
  if(n!==1){console.log("  !! "+file+" expected 1, found "+n+"  <<"+from.slice(0,64).replace(/\n/g,"\\n")+">>");failed++;return;}
  F[file]=s.split(from).join(to); total++; console.log("  ok  "+why);
}
if(load("00-data.js").indexOf("vikingOffset")>=0){console.log("already applied — NOTHING WRITTEN");process.exit(0);}

sub("00-data.js",
`// The three sites, and everything downstream reads THIS. \`plaza\` is the plinth's outer step, which
// is what the terrain has to be level across and what the foliage has to keep off.
const BAZAAR_SITES=[
  {what:"grand", grand:true,  scale:1.32, plaza:11.4, p:()=>{const q=roadPoint(0.5);   return {x:q.x,z:q.z+3.2};}},
  {what:"blue",  team:0,      scale:1.00, plaza:8.6,  p:()=>{const q=vikingPoint(0,0.42); return {x:q.x,z:q.z};}},
  {what:"red",   team:1,      scale:1.00, plaza:8.6,  p:()=>{const q=vikingPoint(1,0.42); return {x:q.x,z:q.z};}},
];`,
`// v132.11 A MARKET BESIDE A ROAD, NOT ON IT. John: "grand bazaar should be to the right of kings
// road while the other two bazaars should be to the left of vikings roads. right now all bazaars
// are directly on top of the roads." The Grand had an offset of 3.2 against a plaza of 11.4 and a
// ribbon reaching 5.86 of half-width, so the road ran 8.2 units inside its outer step; the team
// bazaars had NO offset — they were the spine itself, with the track through the flagstones.
//   Grand  11.4 + 5.86 + 6 of visible lawn = 23.3 -> 24
//   team    8.6 + 3.22 + 6                 = 17.8 -> 18
// WHICH SIDE IS NOT ARBITRARY. Blue faces +x down the King's Road, so right = cross(forward,up) =
// +z, and the sketch agrees on both counts: the Grand Bazaar is drawn on the far side of the King's
// Road from the Vikings (+z), and both team bazaars sit OUTSIDE the Viking arc (-z).
// THE TEAM OFFSET RIDES THE SPINE'S OWN NORMAL, not z. The Viking road runs diagonally and its
// bearing turns along its length, so a flat +-z offset would swing the plaza from beside the road
// to in front of it. Take the across-track normal from a central difference and keep the one
// pointing away from the King's Road — the same construction the ribbon uses for its cross-sections.
function vikingOffset(team,t,off){
  const e=0.004;
  const a=vikingPoint(team,Math.max(0,t-e)), b=vikingPoint(team,Math.min(1,t+e));
  let tx=b.x-a.x, tz=b.z-a.z; const tl=Math.hypot(tx,tz)||1; tx/=tl; tz/=tl;
  let nx=-tz, nz=tx;
  if(nz>0){nx=-nx; nz=-nz;}                       // away from the King's Road
  const c=vikingPoint(team,t);
  return {x:c.x+nx*off, z:c.z+nz*off};
}
// The three sites, and everything downstream reads THIS. \`plaza\` is the plinth's outer step, which
// is what the terrain has to be level across and what the foliage has to keep off.
const BAZAAR_SITES=[
  {what:"grand", grand:true,  scale:1.32, plaza:11.4, p:()=>{const q=roadPoint(0.5); return {x:q.x,z:q.z+24};}},
  {what:"blue",  team:0,      scale:1.00, plaza:8.6,  p:()=>vikingOffset(0,0.42,18)},
  {what:"red",   team:1,      scale:1.00, plaza:8.6,  p:()=>vikingOffset(1,0.42,18)},
];`,
  "00-data.js: the bazaars step off the roads — Grand to +z, the pair outside the arc");

if(failed){console.log("\n"+failed+" site(s) did not match — NOTHING WRITTEN.");process.exit(1);}
for(const f in F)fs.writeFileSync(path.join(ROOT,"js",f),F[f]);
console.log("\n"+total+" written.\n");
