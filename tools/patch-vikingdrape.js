#!/usr/bin/env node
/* v132.14 — THE RIBBON HAS TO CLEAR THE RIDGE BETWEEN ITS OWN VERTICES
   --------------------------------------------------------------------
   node tools/patch-vikingdrape.js      (idempotent: re-running reports NOTHING WRITTEN)

   The v132.9 bow moved the Viking road onto new ground, and tools/vikingroad.js check 2b went from
   comfortable to hanging by a thread:

       worst clearance at a triangle centroid    0.0153  ->  0.0004      (King's Road: 0.0378)
       worst at (105, -103.1)

   FOUR TEN-THOUSANDTHS. Nothing has erupted through the road yet — 0 of 25,600 triangles are under
   the ground — but that is not a margin, it is a coincidence, and the next time anything moves it
   becomes the rope-ladder bug of v132.4 with a different cause.

   WHERE IT IS AND WHY THAT IS NOT A COINCIDENCE. (105, -103.1) is 23 units from the RED team's
   bazaar. terrainHeight flattens a disc of plaza+1.8 = 10.4 under each plaza with a 12-unit ramp,
   so the flat's influence reaches 22.4 — and the road, offset 18 from the spine the bazaar sits on,
   runs straight through the ramp's outer rim. That rim is a CREASE in terrainHeight, and groundY's
   own header says the drawn mesh rides up to 0.12 ABOVE the function across a crease. The ribbon
   floats 0.035. The bow simply moved the road onto the one kind of ground that eats that margin.

   WHY NOT JUST LIFT IT. 0.035 is not a free parameter:
     · the King's Road is at +0.06 and has to win the junction, so the ceiling is that.
     · raidShore's sand disc is at +0.05 and has to cover the tapered tip, so the ceiling is really
       0.05 — that is what makes the track die into the strand instead of stopping on the beach.
     · and kingsRoad's own notes already rejected a bigger constant: it "floats the road a quarter
       unit off the ground everywhere else, and at the closest zoom a quarter unit is a twenty-pixel
       lip down both edges."
   A global lift pays everywhere for a problem that exists in a few metres of crease.

   SO SAMPLE THE GROUND THE WAY THE CHORD ACTUALLY MEETS IT. The sag is not at the vertices — every
   vertex is exactly 0.035 above groundY, which check 2 confirms to a millionth. It is BETWEEN them:
   a segment spanning a ridge cuts a chord underneath it. So each vertex takes the MAXIMUM of
   groundY at itself and at half a cross-section step forward and back along the tangent. On flat
   ground all three agree and nothing changes. Over a ridge the two ends rise to meet it and the
   chord clears by construction.
   HS = 0.34 against a cross-section spacing of 0.58 (SUB 10 over 241 units): just over half, so the
   samples bracket the gap the chord has to span.
   It costs three groundY calls per vertex instead of one — pure arithmetic on the same lattice, no
   constructor, no Math.random, nothing on the wire (§10.7).

   THE LIFT IS LOCAL AND BOUNDED by the crease height itself, which is what makes this different
   from raising the constant: on the 95% of the road that is not crossing a flat's rim, the three
   samples return the same number and the ribbon sits exactly where it did.                       */
const fs=require("fs"),path=require("path"),ROOT=path.join(__dirname,"..");
let total=0,failed=0;
const F={};
const load=f=>(F[f]=F[f]!==undefined?F[f]:fs.readFileSync(path.join(ROOT,"js",f),"utf8"));
function sub(file,from,to,why){
  const s=load(file), n=s.split(from).length-1;
  if(n!==1){console.log("  !! "+file+" expected 1, found "+n+"  <<"+from.slice(0,64).replace(/\n/g,"\\n")+">>");failed++;return;}
  F[file]=s.split(from).join(to); total++; console.log("  ok  "+why);
}
if(load("02-world.js").indexOf("_VHS=0.34")>=0){console.log("already applied — NOTHING WRITTEN");process.exit(0);}

sub("02-world.js",
`        // +0.035, UNDER the King's Road's +0.06 — see the junction note in the patch header. The
        // beach at +0.05 is over both, which is why the far end needs no seam work.
        pos.push(px,groundY(px,pz)+0.035,pz);`,
`        // +0.035, UNDER the King's Road's +0.06 — see the junction note in the patch header. The
        // beach at +0.05 is over both, which is why the far end needs no seam work.
        // v132.14 …AND THE CHORD BETWEEN TWO VERTICES HAS TO CLEAR THE RIDGE BETWEEN THEM. Every
        // vertex sits exactly 0.035 above groundY and always did; the sag is in the SEGMENT. Where
        // the road crosses the rim of a bazaar's terrain flat — a crease, and groundY's own header
        // warns the drawn mesh rides up to 0.12 above the function across one — the chord had 0.0004
        // of clearance left. Take the max of groundY here and half a cross-section step forward and
        // back along the tangent: identical on flat ground, and over a ridge the ends rise to meet
        // it so the chord clears by construction. Local and bounded by the crease, where lifting the
        // constant would pay everywhere (and cannot go far: the beach sits at 0.05).
        const gy=Math.max(groundY(px,pz),
                          groundY(px+tx*_VHS,pz+tz*_VHS),
                          groundY(px-tx*_VHS,pz-tz*_VHS));
        pos.push(px,gy+0.035,pz);`,
  "02-world.js: each vertex clears the ridge its own chord has to span");

sub("02-world.js",
`  const N=40, SUB=10, M=N*SUB, TILE=11.5, HW0=2.55;`,
`  const N=40, SUB=10, M=N*SUB, TILE=11.5, HW0=2.55;
  // half a cross-section step: 241 units over M=400 is 0.58 apart, so 0.34 brackets the gap a chord
  // has to span. See the drape note at the vertex push below.
  const _VHS=0.34;`,
  "02-world.js: _VHS, half a cross-section step");

if(failed){console.log("\n"+failed+" site(s) did not match — NOTHING WRITTEN.");process.exit(1);}
for(const f in F)fs.writeFileSync(path.join(ROOT,"js",f),F[f]);
console.log("\n"+total+" written.\n");
