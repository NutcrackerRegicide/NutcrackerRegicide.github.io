#!/usr/bin/env node
/* v132.4 — THE POLYGON OFFSET WAS TEARING THE ROAD OPEN
   -----------------------------------------------------
   node tools/patch-vikingoffset.js     (idempotent: re-running reports NOTHING WRITTEN)

   The shipped Viking ribbon renders as a ROPE LADDER: a regular series of green wedges cut across
   it, grass showing through, at roughly 3-unit spacing. _viking/_poly-cmp.png is the proof — the
   same frame with the offset on and off, and the right-hand half is a clean continuous track.

   WHAT IT WAS, AND WHY THE FIRST TWO GUESSES WERE WRONG:
     Guess 1, from the picture alone: colour banding. It is not — the wedges are LAWN green, not a
     darker band of dirt, so the ribbon is not being drawn there at all.
     Guess 2, and it was a good theory with arithmetic behind it: chord sag. A ribbon segment
     spanning a convex crease in the terrain cuts a chord UNDER the ridge, and 0.035 of offset is
     not much. A ~3-unit repeat matched the terrain lattice (550/155 = 3.5 across) exactly.
     So I measured it instead of acting on it — tools/vikingroad.js check 2b, clearance at every
     TRIANGLE CENTROID, where a chord sags most:
         worst clearance   0.0118 (viking)   0.0287 (King's Road)
         triangles under the ground   0/15360        0/16224
     Thin, but POSITIVE everywhere. The ground is not coming up through the road. Theory dead.

     What it actually was: polygonOffset:true, factor 1.0. THE FACTOR TERM IS PROPORTIONAL TO THE
     POLYGON'S DEPTH SLOPE, and this ribbon is draped over terrain, so every facet that tilts gets
     pushed back by an amount that grows with the tilt — on the steeper facets, by more than the
     0.035 it was floating above the ground. The terrain then wins the depth test and draws over the
     road. The lattice pattern was the terrain's own facets showing through, which is why it looked
     so much like the chord-sag theory. I had reached for polygonOffset for a reason that had
     nothing to do with the terrain — losing the depth tie to the King's Road at the junction — and
     it went and fought the surface the road is lying ON.

   THE HEIGHT SPLIT ALONE DOES THE JOB IT WAS BROUGHT IN FOR. The King's Road is at groundY+0.06 and
   this is at +0.035; tools/vikingroad.js measures the gap where they overlap at 0.025 and the King's
   Road on top at 47/47 sample points. A town junction is seen from 20-40 units, where the depth
   buffer resolves about 1e-4 — a 250x margin. The offset was never load-bearing.

   AND THE CLEARANCE OVER THE TERRAIN GOES UP ANYWAY: SUB 6 -> 10. That is not required to fix this
   bug; it is the margin I would rather have than 0.0118, and it pays a second debt. The finest edge
   wander term has a 1.54-unit period and cross-sections were 0.96 apart — 1.6 samples a period,
   UNDER Nyquist, so that term was not drawing a nibbled edge, it was aliasing. This is the exact
   trap kingsRoad's own comment records at SUB=6 ("the old 4 put cross-sections 1.7 units apart —
   under Nyquist, so that term was not drawing a nibbled edge, it was aliasing into a sampling-rate
   zigzag"), and I copied the constant without re-deriving it for a ribbon with a different wander.
   0.58 apart is 2.6 samples a period, and it roughly halves the chord sag.
   Cost: 25,600 triangles against 15,360, still ONE draw call. The King's Road is 16,224 and its own
   note says 16k is less than four trees.                                                          */
const fs=require("fs"),path=require("path"),ROOT=path.join(__dirname,"..");
let total=0,failed=0;
const F={};
const load=f=>(F[f]=F[f]!==undefined?F[f]:fs.readFileSync(path.join(ROOT,"js",f),"utf8"));
function sub(file,from,to,why){
  const s=load(file), n=s.split(from).length-1;
  if(n!==1){console.log("  !! "+file+" expected 1, found "+n+"  <<"+from.slice(0,64).replace(/\n/g,"\\n")+">>");failed++;return;}
  F[file]=s.split(from).join(to); total++; console.log("  ok  "+why);
}
if(load("02-world.js").indexOf("SUB=10, M=N*SUB, TILE=11.5")>=0){console.log("already applied — NOTHING WRITTEN");process.exit(0);}

sub("02-world.js",
`  const vmesh=new THREE.Mesh(vgeo,_fogClamp(toonMat({map:_vtex,vertexColors:true,
    // pushed AWAY from the camera so the King's Road wins the 13.9 units they share out of the
    // throne even at grazing angles, where 0.025 of height alone would not be decisive.
    polygonOffset:true,polygonOffsetFactor:1.0,polygonOffsetUnits:1.0}),GROUND_FOG));`,
`  // v132.4 NO polygonOffset. IT TORE THE ROAD OPEN — see _viking/_poly-cmp.png. The factor term is
  // proportional to the polygon's DEPTH SLOPE, and a ribbon draped over terrain tilts with every
  // facet under it, so the steeper facets were pushed back further than the 0.035 they float above
  // the ground and the TERRAIN won the depth test. It rendered as a rope ladder: a regular lattice
  // of lawn-green wedges cut across the track, which is the terrain's own facets showing through.
  // It was brought in to lose a depth tie to the King's Road at the junction and it went and fought
  // the surface the road lies ON. The height split does that job by itself: +0.035 against the
  // King's Road's +0.06 is 0.025 of separation, measured at 47/47 sample points across the shared
  // stretch, against ~1e-4 of depth resolution at the 20-40 units a town junction is seen from.
  const vmesh=new THREE.Mesh(vgeo,_fogClamp(toonMat({map:_vtex,vertexColors:true}),GROUND_FOG));`,
  "02-world.js: the polygon offset goes — it was fighting the ground, not the King's Road");

sub("02-world.js",
`  const N=40, SUB=6, M=N*SUB, TILE=11.5, HW0=2.55;`,
`  // v132.4 SUB 6 -> 10. Not needed for the tearing bug above; it is margin over the terrain (chord
  // sag at the worst crease was 0.0118 against the King's Road's 0.0287) AND it pays off a Nyquist
  // debt: the finest edge-wander term has a 1.54-unit period and cross-sections were 0.96 apart, so
  // that term was aliasing rather than nibbling the edge. kingsRoad's own note records falling into
  // exactly this at SUB=4; I copied its 6 without re-deriving it for a different wander.
  const N=40, SUB=10, M=N*SUB, TILE=11.5, HW0=2.55;`,
  "02-world.js: SUB 6 -> 10 — cross-sections 0.58 apart, above Nyquist for the finest term");

if(failed){console.log("\n"+failed+" site(s) did not match — NOTHING WRITTEN.");process.exit(1);}
for(const f in F)fs.writeFileSync(path.join(ROOT,"js",f),F[f]);
console.log("\n"+total+" written.\n");
