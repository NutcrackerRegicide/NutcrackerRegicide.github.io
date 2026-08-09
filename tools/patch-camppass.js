#!/usr/bin/env node
/* v131.32 — THE CORNER CAMPS GET THEIR FLOORS BACK
   ------------------------------------------------
   node tools/patch-camppass.js          (idempotent: re-running reports NOTHING WRITTEN)

   John: "corner camps have been overtaken by mountains, wolves are clipping through mountains."

   Both halves of that are one fact, and it is a fact I half-recorded and then did not act on.
   v131.28 closed "mountains never collide" as not-a-bug and the evidence was sound FOR THE FIELD —
   the map clamp is the mountain collider, its own comment says so, smoketest.js asserts it, and no
   ridge geometry stands more than 40 units inside the walkable boundary. The camps were named as
   the exception in the same breath and I left it at a footnote. They are walkable by
   inCampGround(), they sit OUTSIDE the border clamp, and they are inside the ring's own footprint,
   so in a camp there is nothing at all between a wolf and a mountain.

   MEASURED (tools/campridge.js), sampling each pocket's floor and raycasting down onto the real
   merged ridge meshes — the fraction of the floor with rock standing over KNEE HEIGHT:

     corner (-230,-143)  51.3%      corner (230,143)   45.3%
     corner (230,-143)   21.4%      BOSS bay (0,-169)  44.4%
     corner (-230,143)   27.9%      corner (0,143)      9.4%

   HALF THE FLOOR of the worst corner camp is inside a mountain. These are the pockets you fight
   creeps in for the whole early game.

   WHY THE GUARDS DID NOT CATCH IT. Each ring already has one — nearCamp(x,z,10), (x,z,6), (x,z,8) —
   and all three test THE RING POINT against a flat pad, while the thing that actually lands is a
   peak jittered up to 5 units off that point wearing a FLARED SKIRT. flare(geo,h,k) multiplies the
   base radius by (1+k), and k is 1.2 on the near ring, 1.3 on the far and 2.1 on the foothills, so a
   foothill cone of r 8.5 spreads to 26.35 on the ground. A pad of 8 against a skirt of 26 is not a
   guard, it is a rounding error. buildRidgePass is worse: pad 4 against k 1.9 and r up to 24, i.e. a
   skirt of 69.6 — and it re-jitters the peak by up to 6 units AFTER its push, back toward the camp
   it just cleared.

   >>> AND THE FIX HAS TO NOT MOVE THE WORLD, WHICH IS WHAT SHAPES IT. <<<
   These loops run inside the seeded window. Widening the existing pads is the obvious fix and it is
   the wrong one: the guards are `continue`s BEFORE the draws, so changing which iterations skip
   changes how many Math.random()s are consumed, and every resource node moves on the wire. That is
   the trap that cost v131.29 an attempt.
   So the existing guards are left EXACTLY as they are, and a second test is added AFTER the last
   draw of each iteration. Iterations the old guard skipped still draw nothing; iterations that pass
   still draw everything. The only thing that changes is whether the result is PUSHED. Same
   technique as v131.30's grass exclusion, and the same reason it is free.
   Each peak is tested against ITS OWN skirt — r*(1+k) — rather than a worst case, so the ring keeps
   every cone that was never a problem.

   buildRidgePass is free by comparison: it runs BELOW the handback and draws from hash(), which is
   positional rather than sequential. Its jitter moves ahead of its push (so the push is the last
   word), its pad becomes the real skirt, and it gives up and skips rather than shoving a peak into
   the next county.

   WHAT THIS DELIBERATELY DOES NOT DO: add a mountain collider. The camps are meant to be passes —
   "the pass stays open where a camp nests" is the ring's own comment — so the right answer is that
   there is no mountain in the pocket to collide with. A collider would be a second implementation
   of a constraint, and the first one is a rejection test that costs nothing per frame.            */
const fs=require("fs"),path=require("path"),ROOT=path.join(__dirname,"..");
let total=0,failed=0;
const F={};
const load=f=>(F[f]=F[f]!==undefined?F[f]:fs.readFileSync(path.join(ROOT,"js",f),"utf8"));
function sub(file,from,to,why){
  const s=load(file), n=s.split(from).length-1;
  if(n!==1){console.log("  !! "+file+" expected 1, found "+n+"  <<"+from.slice(0,64).replace(/\n/g,"\\n")+">>");failed++;return;}
  F[file]=s.split(from).join(to); total++; console.log("  ok  "+why);
}
if(load("02-world.js").indexOf("SKIRT, NOT THE AXIS")>=0){console.log("already applied — NOTHING WRITTEN");process.exit(0);}

// ---- 1. the near range ---------------------------------------------------------------------
sub("02-world.js",
`    const ry=Math.random()*Math.PI;
    const col=ridgeTint(px,pz,(jr-0.5)*0.06);
    near.push({geo:flare(new THREE.ConeGeometry(r,h,seg,3),h,1.2),matrix:M(px,h*0.42,pz,ry),color:col});`,
`    const ry=Math.random()*Math.PI;
    // v131.32 THE SKIRT, NOT THE AXIS — and AFTER the draws, which is the only reason this is free.
    // The guard above tests the RING POINT against a flat pad of 10. What lands is this peak, up to
    // 3.5 units off that point, wearing a flare of 1.2 — a base radius of r*2.2, up to 30.8. Half
    // the floor of the worst corner camp was inside a mountain (tools/campridge.js). Every
    // Math.random() for this iteration has now been drawn, so declining to PUSH costs nothing on
    // the wire; widening the guard above would have moved every resource node in the world.
    if(nearCamp(px,pz,r*2.2))continue;
    const col=ridgeTint(px,pz,(jr-0.5)*0.06);
    near.push({geo:flare(new THREE.ConeGeometry(r,h,seg,3),h,1.2),matrix:M(px,h*0.42,pz,ry),color:col});`,
  "02-world.js: the near range keeps its skirt out of the camps");

// ---- 2. the far range ----------------------------------------------------------------------
sub("02-world.js",
`    const ry=Math.random()*Math.PI;
    const col=ridgeTint(px,pz,(jr-0.5)*0.05);
    far.push({geo:flare(new THREE.ConeGeometry(r,h,8,3),h,1.3),matrix:M(px,h*0.42,pz,ry),color:col});`,
`    const ry=Math.random()*Math.PI;
    // v131.32 same test, this ring's own skirt: flare 1.3, so r*2.3 and up to 46 on the ground.
    // Recorded as a GAP like the guard above does, so buildRidgePass can close the skyline behind
    // the camp from further out instead of leaving a notch in it.
    if(nearCamp(px,pz,r*2.3)){RIDGE_GAPS.push([x,z]);continue;}
    const col=ridgeTint(px,pz,(jr-0.5)*0.05);
    far.push({geo:flare(new THREE.ConeGeometry(r,h,8,3),h,1.3),matrix:M(px,h*0.42,pz,ry),color:col});`,
  "02-world.js: the far range too, and it hands the hole to buildRidgePass");

// ---- 3. the foothills — the worst offender, because k is 2.1 -------------------------------
sub("02-world.js",
`    const px=x+(Math.random()-0.5)*5, pz=z+(Math.random()-0.5)*5;
    const col=ridgeTint(px,pz,(jr-0.5)*0.06);`,
`    const px=x+(Math.random()-0.5)*5, pz=z+(Math.random()-0.5)*5;
    // v131.32 THE WORST OF THE THREE, because this ring's flare is 2.1 — the note below says so in
    // as many words ("their flare has to work hardest… the skirt reaches across a skipped point as
    // well as an adjacent one"). r*3.1 is up to 26.35 on the ground against a guard pad of 8, and
    // these are the cones a camp actually touches: the foothill line stands closest to the pockets.
    if(nearCamp(px,pz,r*3.1))continue;
    const col=ridgeTint(px,pz,(jr-0.5)*0.06);`,
  "02-world.js: the foothills, whose 2.1 flare is why a pad of 8 never worked");

// ---- 4. buildRidgePass: free, and it was shoving peaks back in after clearing them ----------
sub("02-world.js",
`    let guard=0;
    while(nearCamp(px,pz,4)&&guard++<6){px*=1.06; pz*=1.06;} // never stand a mountain in a camp's hollow
    const j=hash(gx,gz,1);
    // taller than the ring it stands behind (33–48 against 22–36): it is a third further away and has
    // to clear both the ring's own peaks and the terrain edge to show at all
    const h=33+j*15, r=15+hash(gx,gz,2)*9;
    px+=(hash(gx,gz,3)-0.5)*12; pz+=(hash(gx,gz,4)-0.5)*12;`,
`    const j=hash(gx,gz,1);
    // taller than the ring it stands behind (33–48 against 22–36): it is a third further away and has
    // to clear both the ring's own peaks and the terrain edge to show at all
    const h=33+j*15, r=15+hash(gx,gz,2)*9;
    // v131.32 THE JITTER MOVES AHEAD OF THE PUSH, AND THE PAD BECOMES THE REAL SKIRT.
    // This read \`while(nearCamp(px,pz,4))\` and then jittered by up to 6 AFTERWARDS, so the push
    // cleared the camp and the jitter walked it back in. And a pad of 4 was never the right number:
    // this range's flare is 1.9 and r reaches 24, so its skirt is r*2.9 — up to 69.6 on the ground,
    // seventeen times the pad it was tested against.
    // Free to fix, unlike the three rings above: this runs BELOW the handback and draws from hash(),
    // which is positional rather than sequential, so nothing here is on the wire.
    px+=(hash(gx,gz,3)-0.5)*12; pz+=(hash(gx,gz,4)-0.5)*12;
    let guard=0;
    while(nearCamp(px,pz,r*2.9)&&guard++<14){px*=1.05; pz*=1.05;} // never stand a mountain in a hollow
    if(nearCamp(px,pz,r*2.9))continue;   // …and if it will not clear, the pass simply stays open`,
  "02-world.js: the pass ridge stops jittering itself back into the camp it just left");

if(failed){console.log("\n"+failed+" site(s) did not match — NOTHING WRITTEN.");process.exit(1);}
for(const f in F)fs.writeFileSync(path.join(ROOT,"js",f),F[f]);
console.log("\n"+total+" written.\n");
