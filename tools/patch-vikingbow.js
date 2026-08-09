#!/usr/bin/env node
/* v132.9 — THE VIKING ROAD'S BOW WAS PULLING IT TOWARDS THE KING'S ROAD
   ---------------------------------------------------------------------
   node tools/patch-vikingbow.js        (idempotent: re-running reports NOTHING WRITTEN)

   John, playtesting: "the viking roads need to BOW OUT MORE AWAY FROM KINGS ROAD they are too
   close together."

   HE IS RIGHT AND THE SIGN WAS WRONG. vikingPoint's z term read

       z = A.z + (B.z - A.z) * t + Math.sin(t*PI) * 18

   with A.z = 0 and B.z = -150, so the straight line runs NEGATIVE and the sine adds a POSITIVE 18.
   The bow was pulling the road back UP towards z = 0 — which is where the King's Road is. The
   comment above it claimed "it swings away from the King's Road on the way out". It swung into it.
   Only the x term bowed outward, and at 0.35 of a 26-unit amplitude that is +-9.1 of lateral swing
   on a 231-unit road: nothing.

   MEASURED, on the shipped build, walking out from the blue throne:

       t      Viking z    King's Road z at the same x    apart
       0.10     -15.4              3.3                    18.7
       0.15     -14.5              5.5                    20.0
       0.20     -19.4              6.4                    25.8

   Twenty units of separation between two dirt ribbons whose own half-widths are 5.9 and 3.2 leaves
   about eleven of grass — and then the TREE CLEARANCE eats it, because the King's Road clears 21
   and the Viking road clears 12 and 21 + 12 = 33 against a 20-unit gap. The two corridors merge
   into ONE bare avenue with a stripe of lawn up the middle, which is exactly what John's screenshot
   shows and exactly the "too close together" he is describing. The roads were never the problem;
   the ground between them had no woods left on it.

   THE FIX IS THE SIGN, AND THEN SOME AMPLITUDE:
       z bow   +18  ->  -30      it now swings AWAY, southward, as the comment always claimed
       x bow   0.35 ->  0.55     +-14.3 of lateral swing instead of +-9.1

   Predicted separation from the King's Road at the same x, same three points: 27.6 / 34.9 / 54.0,
   against tree clearances that sum to 33. The corridors come apart and the wood between them grows
   back. tools/vikingsurvey.js measures it for real after this lands.

   WHAT MOVES WITH IT, and this is the part worth being careful about:
     · THE TWO TEAM BAZAARS. They are DEFINED as vikingPoint(team, 0.42), so they follow the road —
       (-110.3, -45.6) becomes (-115.4, -92.1). That is the point of defining them that way, and
       01-engine.js's plaza flats are derived from BAZAAR_SITES so they follow too (mapconst gate).
       The trade run to a team bazaar lengthens from 79 to 110 units off the throne. It costs
       nothing: team bazaars are NOT trade-cart destinations — carts route to the Grand Bazaar and
       only there — so this is travel time for players and raiders, which is what the road is for.
     · THE THREE INTERIOR CREEP CAMPS were sited against the OLD road. They are re-sited in the same
       commit, against this one, and John asked for two other things about them at the same time.
     · t = 0.42 IS KEPT. The road is longer now, so the bazaar sits slightly further out along it —
       still "not quite halfway", which is the read.

   >>> PROTO 29 -> 30. <<< Every node moves: the bazaars moved, so their tree clearance moved, and
   the road's own clearance corridor moved with the spine.                                        */
const fs=require("fs"),path=require("path"),ROOT=path.join(__dirname,"..");
let total=0,failed=0;
const F={};
const load=f=>(F[f]=F[f]!==undefined?F[f]:fs.readFileSync(path.join(ROOT,"js",f),"utf8"));
function sub(file,from,to,why){
  const s=load(file), n=s.split(from).length-1;
  if(n!==1){console.log("  !! "+file+" expected 1, found "+n+"  <<"+from.slice(0,64).replace(/\n/g,"\\n")+">>");failed++;return;}
  F[file]=s.split(from).join(to); total++; console.log("  ok  "+why);
}
if(load("00-data.js").indexOf("bow*0.55")>=0){console.log("already applied — NOTHING WRITTEN");process.exit(0);}

sub("00-data.js",
`const VIKING_END={x:0,z:-150};
function vikingPoint(team,t){
  const A=TCPOS[team], B=VIKING_END;
  const bow=Math.sin(t*Math.PI)*(team===0?-26:26);   // mirrored, so neither team's path is shorter
  return {x:A[0]+(B.x-A[0])*t+bow*0.35,
          z:A[1]+(B.z-A[1])*t+Math.sin(t*Math.PI)*18};
}`,
`const VIKING_END={x:0,z:-150};
// v132.9 THE BOW HAD THE WRONG SIGN AND THE COMMENT ABOVE IT WAS DESCRIBING WHAT IT MEANT TO DO.
// A.z is 0 and B.z is -150, so the straight line runs NEGATIVE — and the z term added a POSITIVE
// sin(t*PI)*18, pulling the road back UP towards z=0, which is where the King's Road is. Measured
// on the shipped build, 18.7 / 20.0 / 25.8 units apart at t = 0.10 / 0.15 / 0.20.
// TWENTY UNITS IS NOT THE PROBLEM BY ITSELF — the ribbons are only 5.9 and 3.2 of half-width. The
// TREE CLEARANCE is: 21 for the King's Road plus 12 for this one is 33 against a 20-unit gap, so
// the two cleared corridors merged into one bare avenue with a stripe of lawn up the middle. That
// is John's "too close together": not the roads, the wood that was no longer between them.
// -30 swings it AWAY, southward, as the comment always claimed; 0.55 gives +-14.3 of lateral swing
// instead of +-9.1 on a 231-unit road. Separation becomes 27.6 / 34.9 / 54.0 against a 33 sum.
// KEEP THE MIRRORING. z(team 0) === z(team 1) and x mirrors about 0, so neither branch is shorter
// and the two team bazaars — which are DEFINED as vikingPoint(team, 0.42) and so move with this —
// stay exactly as far from their own thrones as each other.
function vikingPoint(team,t){
  const A=TCPOS[team], B=VIKING_END;
  const bow=Math.sin(t*Math.PI)*(team===0?-26:26);   // mirrored, so neither team's path is shorter
  return {x:A[0]+(B.x-A[0])*t+bow*0.55,
          z:A[1]+(B.z-A[1])*t-Math.sin(t*Math.PI)*30};
}`,
  "00-data.js: the bow swings AWAY from the King's Road instead of into it");

sub("10-net.js",
`  PROTO:29,             // bumped whenever the wire format changes OR the generated world does.`,
`  // v132.9 29 -> 30: the Viking road's bow was reversed. The spine moved, so its clearance corridor
  // moved, so the trees moved; and the two team bazaars are defined ON the spine, so they moved too
  // and took their own clearance with them. Every node index downstream is different.
  PROTO:30,             // bumped whenever the wire format changes OR the generated world does.`,
  "10-net.js: PROTO 29 -> 30");

if(failed){console.log("\n"+failed+" site(s) did not match — NOTHING WRITTEN.");process.exit(1);}
for(const f in F)fs.writeFileSync(path.join(ROOT,"js",f),F[f]);
console.log("\n"+total+" written.\n");
console.log("  next: tools/vikingsurvey.js, then re-site the three interior camps against this road.\n");
