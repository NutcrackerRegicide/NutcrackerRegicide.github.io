#!/usr/bin/env node
/* v132.20 — THE RAMPS TURN NINETY DEGREES
   ---------------------------------------
   node tools/patch-rampturn.js         (idempotent: re-running reports NOTHING WRITTEN)

   John: "can you also rotate ramps so they are perpendicular to the wall?"

   THE CODE ARGUES AGAINST THIS IN WRITING, so it is worth saying why the owner wins:

       "ALONG THE INNER FACE, NOT OUT THE BACK. A perpendicular ramp needs an 8.0 run behind the
        wall and every segment of a curtain would grow a tail into its own courtyard. Run it in x
        instead and it lives inside the segment's own 12.5 length."

   That is a real cost and it is still real. But a ramp lying along the wall does not read as a way
   up — it reads as a slab leaning on the masonry, which is what his screenshot shows, and it was
   already causing confusion in the one probe that drives it: tools/wallpop.js records that its
   first run "drove every lane at the curtain in +z and reported the ramp broken, because a body
   walking AT the wall crosses the 2.6-deep ramp band in a fifth of a second and never travels the
   8 units of x the rise is spread over." A ramp you have to approach SIDEWAYS is a ramp nobody
   finds. The tail is the price of it being legible.

   THE TAIL IS SHORTENED RATHER THAN PAID IN FULL: rise 4.0 over a run of 6.0 instead of 8.0, so
   1:1.5 at 33.7 degrees instead of 1:2 at 26.6. Steeper, and it reaches 9.4 behind the wall's centre
   line instead of the 11.4 a straight rotation of the old run would have cost.

   FOUR THINGS MOVE TOGETHER AND ALL FOUR ARE THE SAME RAMP:
     the mesh          BoxGeometry's long axis goes from x to z, and the tilt from rotation.z to
                       rotation.x. NOTE THE SIGN: rotation about +x sends +z DOWNWARD (y' = -z sin),
                       so the angle is NEGATIVE to lift the end that meets the deck. Getting that
                       backwards buries the ramp in the ground, which is the T-R-S trap in a
                       different costume — this file has paid for that one three times.
     the kerb          one kerb became two, because a ramp you walk UP has an edge on both sides.
     the band          WALL_RAMP_* stops being an x-run inside a z-strip and becomes a z-run inside
                       an x-strip.
     wallFloorAt       interpolates the rise on lz instead of lx.

   IF THE MESH AND THE BAND EVER DISAGREE the symptom is an invisible slope beside a visible one,
   which is exactly the defect v131.28 found at the gates. tools/wallpop.js drives a real body up it
   and is updated in the same commit; it is the only thing that can tell.                          */
const fs=require("fs"),path=require("path"),ROOT=path.join(__dirname,"..");
let total=0,failed=0;
const F={};
const load=f=>(F[f]=F[f]!==undefined?F[f]:fs.readFileSync(path.join(ROOT,"js",f),"utf8"));
function sub(file,from,to,why){
  const s=load(file), n=s.split(from).length-1;
  if(n!==1){console.log("  !! "+file+" expected 1, found "+n+"  <<"+from.slice(0,64).replace(/\n/g,"\\n")+">>");failed++;return;}
  F[file]=s.split(from).join(to); total++; console.log("  ok  "+why);
}
if(load("03-buildings.js").indexOf("WALL_RAMP_HX")>=0){console.log("already applied — NOTHING WRITTEN");process.exit(0);}

// ---- the band -------------------------------------------------------------------------------------
sub("03-buildings.js",
`const WALL_RAMP_Z0=-5.4, WALL_RAMP_Z1=-2.8, WALL_RAMP_X0=-6.0, WALL_RAMP_RUN=8.0, WALL_RAMP_FLAT=0.8;`,
`// v132.20 THE RAMP TURNED NINETY DEGREES (John: "rotate ramps so they are perpendicular to the
// wall"), so the band turns with it: it is now a RUN IN Z inside a narrow strip of X, where it used
// to be a run in x inside a strip of z.
//   WALL_RAMP_HX     half the ramp's width, centred on the segment
//   WALL_RAMP_ZTOP   where it meets the terreplein's inner edge (WALL_DECK_Z0)
//   WALL_RAMP_RUN    6.0, not 8.0: rise 4.0 over 6.0 is 1:1.5 at 33.7 degrees, so the tail behind
//                    the wall is 6.0 rather than the 8.0 the old run would have cost when stood up.
//                    The tail is the price of a ramp you can see is a ramp; this is the smaller bill.
const WALL_RAMP_HX=1.1, WALL_RAMP_ZTOP=-3.4, WALL_RAMP_RUN=6.0, WALL_RAMP_FLAT=0.8;`,
  "03-buildings.js: the ramp band becomes a run in z");

// ---- wallFloorAt ----------------------------------------------------------------------------------
sub("03-buildings.js",
`    if(!b.def.gate&&lz>=WALL_RAMP_Z0&&lz<=WALL_RAMP_Z1&&lx>=WALL_RAMP_X0&&lx<=WALL_RAMP_X0+WALL_RAMP_RUN)`,
`    if(!b.def.gate&&Math.abs(lx)<=WALL_RAMP_HX&&
       lz>=WALL_RAMP_ZTOP-WALL_RAMP_RUN&&lz<=WALL_RAMP_ZTOP)`,
  "03-buildings.js: wallFloorAt's ramp band turns with the ramp");

sub("03-buildings.js",
`      return Math.max(b.root.position.y+WALL_DECK_Y*
        Math.min(1,(lx-WALL_RAMP_X0)/(WALL_RAMP_RUN-WALL_RAMP_FLAT)),   // flat landing at the top`,
`      return Math.max(b.root.position.y+WALL_DECK_Y*
        Math.min(1,(lz-(WALL_RAMP_ZTOP-WALL_RAMP_RUN))/(WALL_RAMP_RUN-WALL_RAMP_FLAT)), // flat landing at the top`,
  "03-buildings.js: …and the rise interpolates on lz");

// ---- the mesh --------------------------------------------------------------------------------------
sub("03-buildings.js",
`      // ALONG THE INNER FACE, NOT OUT THE BACK. A perpendicular ramp needs an 8.0 run behind the
      // wall and every segment of a curtain would grow a tail into its own courtyard. Run it in x
      // instead and it lives inside the segment's own 12.5 length. Rise 4.00 over a run of 8.00 is
      // 1:2, atan(0.5) = 0.46365 rad; the slab's own length is hypot(8,4) = 8.9443, and centred at
      // x=-2.0, y=2.0 its ends land at (-6.0, 0.0) and (+2.0, 4.0) — ground to walkway exactly.
      // z=-4.4 puts it just behind the terreplein's inner edge at -3.4, so it meets the deck rather
      // than overlapping it.
      const RRISE=4.0, RRUN=8.0, RANG=Math.atan2(RRISE,RRUN);
      const ramp=new THREE.Mesh(new THREE.BoxGeometry(Math.hypot(RRUN,RRISE),0.4,2.0),
        texturedMat("metal",P.stone));
      ramp.rotation.z=RANG; ramp.position.set(-2.0,RRISE/2,-4.4);
      ramp.castShadow=true; ramp.receiveShadow=true; g.add(ramp);
      // a low kerb on the open side, so the ramp reads as a ramp and not as a leaning slab
      const kerb=new THREE.Mesh(new THREE.BoxGeometry(Math.hypot(RRUN,RRISE),0.34,0.26),aWall(age));
      kerb.rotation.z=RANG; kerb.position.set(-2.0,RRISE/2+0.30,-5.33);
      kerb.castShadow=false; g.add(kerb);`,
`      // v132.20 OUT THE BACK, PERPENDICULAR, which is what John asked for and overrides the note
      // that used to stand here ("a perpendicular ramp needs an 8.0 run behind the wall and every
      // segment of a curtain would grow a tail into its own courtyard"). The cost is real and it is
      // paid: a ramp lying ALONG the wall does not read as a way up, it reads as a slab leaning on
      // the masonry — and tools/wallpop.js already recorded that its first run "reported the ramp
      // broken, because a body walking AT the wall crosses the 2.6-deep ramp band in a fifth of a
      // second and never travels the 8 units of x the rise is spread over". A ramp you have to
      // approach sideways is a ramp nobody finds.
      // 6.0 OF RUN, NOT 8.0: rise 4.0 over 6.0 is 1:1.5 at 33.7 degrees, so the tail is 6.0 behind
      // the terreplein's inner edge instead of 8.0. Steeper, and the smaller bill.
      // THE SIGN IS THE TRAP. Rotation about +x sends +z DOWNWARD (y' = y cos - z sin), so the angle
      // has to be NEGATIVE for the +z end — the one that meets the deck — to rise. Positive buries
      // the ramp in the ground. Same family as the T-R-S trap this file has paid for three times.
      // Ends, checked: length hypot(6,4) = 7.2111 centred at z = ZTOP - RRUN/2 = -6.4, y = 2.0.
      // Local +z end (0,0,3.606) turns to (0,+2.0,+3.0) -> world (0, 4.0, -3.4) = the deck edge.
      // Local -z end turns to (0,-2.0,-3.0) -> world (0, 0.0, -9.4) = the ground.
      const RRISE=4.0, RRUN=WALL_RAMP_RUN, RANG=Math.atan2(RRISE,RRUN);
      const RLEN=Math.hypot(RRUN,RRISE), RMIDZ=WALL_RAMP_ZTOP-RRUN/2;
      const ramp=new THREE.Mesh(new THREE.BoxGeometry(WALL_RAMP_HX*2,0.4,RLEN),
        texturedMat("metal",P.stone));
      ramp.rotation.x=-RANG; ramp.position.set(0,RRISE/2,RMIDZ);
      ramp.castShadow=true; ramp.receiveShadow=true; g.add(ramp);
      // TWO kerbs now, not one: a ramp you walk UP has an edge on either side of you, and a single
      // kerb on a perpendicular ramp is a handrail on one side of a staircase.
      for(const ks of [-1,1]){
        const kerb=new THREE.Mesh(new THREE.BoxGeometry(0.26,0.34,RLEN),aWall(age));
        kerb.rotation.x=-RANG; kerb.position.set(ks*(WALL_RAMP_HX+0.13),RRISE/2+0.30,RMIDZ);
        kerb.castShadow=false; g.add(kerb);
      }`,
  "03-buildings.js: the ramp mesh turns, and grows a second kerb");

if(failed){console.log("\n"+failed+" site(s) did not match — NOTHING WRITTEN.");process.exit(1);}
for(const f in F)fs.writeFileSync(path.join(ROOT,"js",f),F[f]);
console.log("\n"+total+" written.\n");
console.log("  tools/wallpop.js drives the ramp along x and must be turned with it.\n");
