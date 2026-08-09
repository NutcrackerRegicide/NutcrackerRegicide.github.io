#!/usr/bin/env node
/* v131.29 — THE BAZAAR STOPS BEING A GARDEN GAZEBO
   ------------------------------------------------
   node tools/patch-bazaar.js          (idempotent: re-running reports NOTHING WRITTEN)

   John, on two screenshots: "lets update bazaar model looks a little wimpy compared to new
   graphics" and "market model needs to be reworked looks very wimpy compared to other buildings".
   Both photographs are of the SAME object — the roadside bazaar — and that is worth saying out
   loud, because "market" reads as BLD.market in 03-buildings.js and rebuilding that would have been
   the wrong building entirely. His ruling: "Full redesign but you can keep the same model
   throughout all ages", which fits this object exactly: it is world-gen, neutral, and has no age
   ladder to keep.

   WHAT WAS THERE: a 9-wide sand pad, four 0.14-radius posts, one 4-radius canopy topping out at
   4.4, three crates, two pots, a rug and a lantern. Against a house at 5.0 and the market building
   at 9.5 that is not architecture, it is garden furniture — standing in a town where every other
   structure had been rebuilt around it.

   >>> THE TRAP THIS PATCH IS SHAPED BY, AND IT COST A WHOLE FIRST ATTEMPT. <<<
   r128 mints a uuid in the constructor of BufferGeometry, Material AND Object3D, and generateUUID
   draws FOUR Math.random()s — measured in the shipped build by tools/streamdebt.js, not read off
   minified source. So EVERY OBJECT CONSTRUCTED INSIDE THE SEEDED WINDOW IS PART OF THE WIRE FORMAT.
   §10.7 states this rule for Math.random() calls and the uuids are the same rule one level down;
   the note at 02-world.js:181 already says in as many words that "a merge that saves draw calls has
   to be paid for BELOW the handback".
   The first cut of this redesign merged the bazaar in place, inside the window, and the world went
   from 736 nodes to 661. Same seed, different forest — every tree and every wood pile moved, and
   PROTO 26 would have stopped interoperating for a prop nobody can attack.

   SO THE PATCH SPLITS IN TWO:
     · inside the window, only numbers — the three sites, PROP_FEET, neutralMarkets — plus a
       DOCUMENTED DEBT of 696 draws, which is exactly what the old builder's 1 Group + 19 Meshes +
       19 geometries + 19 materials per bazaar used to spend (232 x 3, measured).
     · below the handback, the geometry, where it is free.
   tools/nodehash.js is the guard: all=a0e4532bfa20051c res=2ac1ea6adf9f4553, unchanged.
   The debt is a debt, not a design. It should be deleted the next time PROTO bumps for a reason of
   its own, and the comment in the source says so.

   TWO OTHER THINGS MADE THE REDESIGN AFFORDABLE:
     · IT WAS COSTING ~54 DRAW CALLS TO LOOK LIKE THAT. mat() has no cache, so eighteen parts on a
       group is eighteen materials and eighteen draws, times three. One merged vertex-coloured mesh
       on one shared material takes the whole feature to 3 — ~51 calls FREED, which pays for the new
       geometry several times over. §9.3 wants the number stated before and after; it is strongly
       negative before a triangle is spent.
     · THERE IS ROOM. terrainHeight flattens a radius of 10 around each bazaar with a 12 falloff
       (01-engine.js) and the old plinth used 4.8 of it. The deck goes to 7.4 and still stands on
       dead level ground.

   WHAT IT IS NOW — a caravanserai on the King's Road, topping out at 10.0 against a house at 5.0,
   the market building at 9.5 and a barracks at 11.2:
     · a sunk two-course plinth, 17.2 across at the step and 14.8 at the deck, so the slopes stay
       hidden the way the old one did
     · a covered hall on six stone-footed timber posts, beamed, under a hipped canopy 12.4 x 9.0
     · A CLERESTORY LANTERN, and that is the silhouette decision. §5.5 gives every building type its
       own top profile and says two types may not share one; a gable, a hip, a dome, a cone, a
       stepped parapet, a portico and a tower are all taken. A LOUVRED DRUM BETWEEN TWO HIPS is not,
       and it is also the correct thing over a covered market — it is how the heat leaves.
     · four stalls with counters, awnings and goods, standing OUTSIDE the roofline where they can be
       seen, two of them facing the road
     · pennant poles at the diagonals, and the wares: amphorae, barrels, sacks, crates, bolts of
       cloth hanging from the eaves, a carpet

   IT STAYS OPEN AT GROUND LEVEL ON PURPOSE. Bazaars are not in `buildings`, so moveUnit never sees
   them, and nothing in this game collides with a prop — trees and boulders included. A market you
   walk through is the correct market; a solid trading hall you walk through would be a defect. The
   mass is in the roof and the plinth, and at body height there is nothing but posts.               */
const fs=require("fs"),path=require("path"),ROOT=path.join(__dirname,"..");
const P=path.join(ROOT,"js","02-world.js");
let s=fs.readFileSync(P,"utf8");

if(s.indexOf("BAZAAR_STREAM_DEBT")>=0){console.log("already applied — NOTHING WRITTEN");process.exit(0);}

// ---------- 1. the window keeps only the numbers ----------
const startMark="(function placeNeutralMarkets(){";
const endMark="    neutralMarkets.push({x,z});\n  }\n})();";
const a=s.indexOf(startMark), b=s.indexOf(endMark);
if(a<0||b<0||b<a){console.log("!! could not locate placeNeutralMarkets — NOTHING WRITTEN");process.exit(1);}
const old=s.slice(a,b+endMark.length);

const lean=`// v131.29 THE BAZAARS ARE PLACED HERE AND BUILT BELOW THE HANDBACK, and the split is not tidiness.
// r128 mints a uuid in the constructor of BufferGeometry, Material AND Object3D, and generateUUID
// draws FOUR Math.random()s — measured in this build by tools/streamdebt.js, not assumed. So
// everything CONSTRUCTED inside this window is part of the seeded sequence that places nodes[],
// which the netcode indexes POSITIONALLY (10-net.js). §10.7 states the rule for Math.random() calls;
// the uuids are the same rule one level down, and the note at :181 already says a merge "has to be
// paid for BELOW the handback".
// Measured the hard way: merging the three bazaars in place took the world from 736 nodes to 661.
// Same seed, different forest.
const NEUTRAL_MARKET_SITES=[];
// THE DEBT. The old builder constructed 1 Group + 19 Meshes + 19 geometries + 19 materials per
// bazaar — 232 draws, 696 across the three — and every one of them was part of the sequence. The
// geometry now lives below the handback where it is free, so those draws have to be spent anyway or
// the world moves. tools/streamdebt.js measures the number by reconstructing the old builder part
// for part; tools/nodehash.js is the guard and must still read
//     all=a0e4532bfa20051c   res=2ac1ea6adf9f4553
// THIS IS A DEBT, NOT A DESIGN. It exists only to keep PROTO 26 interoperating across a change to a
// prop nobody can attack, and it should be deleted the next time PROTO bumps for a reason of its own.
const BAZAAR_STREAM_DEBT=696;
(function placeNeutralMarkets(){
  for(const t of BAZAAR_T){
    const rp=roadPoint(t), x=rp.x, z=rp.z+3.2;
    NEUTRAL_MARKET_SITES.push([x,z]);
    // v131.1 …AND THE THREE BAZAARS WERE THE LAST STATIC THING ON THE MAP STANDING ON CLEAN LAWN.
    // The foot scales with the plinth: 5.3 was 1.14x a 4.65 mean radius, and the new deck is 7.4, so
    // 8.4 keeps the same RIM — a tight band at the foot plus the down-sun tail — rather than the
    // 1.8x a small shrub wants, which on a disc this size would paint a stain across the meadow.
    // Numbers into an array carry no uuid, so this stays inside the window for free (§G.4).
    PROP_FEET.push([x,z,8.4]);
    neutralMarkets.push({x,z});
  }
  for(let i=0;i<BAZAAR_STREAM_DEBT;i++)Math.random();   // see above: pay what the old meshes cost
})();`;
s=s.slice(0,a)+lean+s.slice(a+old.length);

// ---------- 2. the geometry, below the handback ----------
const hand="// world gen done — hand Math.random back to the casino\nMath.random=__realRandom;\n";
if(s.split(hand).length-1!==1){console.log("!! could not locate the handback — NOTHING WRITTEN");process.exit(1);}

const builder=hand+`
// ============ v131.29 THE CARAVANSERAI, BUILT BELOW THE HANDBACK WHERE GEOMETRY IS FREE ============
// See tools/patch-bazaar.js for the brief and for why this is not up in the seeded window.
// ONE MESH, ONE SHARED MATERIAL, THREE DRAW CALLS FOR THE WHOLE FEATURE — down from ~54, because
// mat() has no cache and the old group minted a material per part. That saving is what pays for the
// geometry, and it pays several times over.
// AND IT STAYS OPEN AT GROUND LEVEL ON PURPOSE. Bazaars are not in \`buildings\`, so moveUnit never
// sees them — nothing in this game collides with a prop, trees and boulders included. A market you
// walk through is the correct market; a solid trading hall you walk through would be a defect. So
// the mass is in the roof and the plinth, and at body height there is nothing but posts.
const BAZAAR_MAT=toonMat({vertexColors:true});
(function buildNeutralMarkets(){
  const _e=new THREE.Euler(), _q=new THREE.Quaternion(), _v=new THREE.Vector3(), _sc=new THREE.Vector3();
  const _m=(px,py,pz,rx,ry,rz,sx,sy,sz)=>{
    _e.set(rx||0,ry||0,rz||0);
    return new THREE.Matrix4().compose(_v.set(px,py,pz),_q.setFromEuler(_e),
      _sc.set(sx===undefined?1:sx,sy===undefined?1:sy,sz===undefined?1:sz));
  };
  const BOXG=(w,h,d)=>new THREE.BoxGeometry(w,h,d);
  const CYLG=(rt,rb,h,sg)=>new THREE.CylinderGeometry(rt,rb,h,sg||8);
  const CONEG=(r,h,sg)=>new THREE.ConeGeometry(r,h,sg||4);
  // §2.4's hard floor is 0.25 of screen value between a roof and what it sits on: sand at 0.771
  // against terracotta at 0.402 is 0.37. The gold is the frame's one warm note (§8.5) spent on a
  // thin band rather than a whole roof — the v130.1 inversion, kept.
  const SAND=0xD9C48F, PAVE=0xC9BBA0, PIER=0xBCB0A0, TIMB=0x8A6B45, BEAM=0x7A5A3A,
        ROOF=0xB4543A, ROOFD=0x7E3624, GOLDT=0xCFB53B, LANT=0xD8D2AC, SLOT=0x2A2018,
        AWNA=0x8E1F1F, AWNB=0xC9863C, CRATE=0xB08A5A, BARREL=0x7A5A34, SACK=0xC9B78A,
        AMPH=0xA8623A, CLOTHA=0x3A5A7A, ROPE=0x9A8A6A;
  for(const [x,z] of NEUTRAL_MARKET_SITES){
    const BP=[];
    const put=(geo,color,mtx)=>BP.push({geo,matrix:mtx,color});

    // ---- the plinth: two sunk courses, so the top stays level and the slopes stay hidden ----
    // 7.4 of deck against the 10 that terrainHeight flattens here; the old one used 4.8 of it.
    put(CYLG(8.2,8.6,1.8,12),SAND,_m(0,-0.55,0));
    put(CYLG(7.4,7.7,1.6,12),PAVE,_m(0,0.05,0));

    // ---- the hall: six posts, stone-footed, beamed ----
    for(const px of [-4.6,0,4.6])for(const pz of [-3.2,3.2]){
      put(CYLG(0.46,0.54,1.50,8),PIER,_m(px,1.60,pz));        // the stone foot
      put(CYLG(0.30,0.34,2.50,8),TIMB,_m(px,3.60,pz));        // …and the timber above it
      put(BOXG(0.86,0.44,0.26),BEAM,_m(px,4.60,pz*0.86));     // the bracket under the plate
    }
    for(const pz of [-3.2,3.2])put(BOXG(10.6,0.42,0.38),BEAM,_m(0,4.92,pz));
    for(const px of [-4.6,4.6])put(BOXG(0.38,0.42,7.0),BEAM,_m(px,4.92,0));

    // ---- the canopy: a hipped square scaled to a rectangle ----
    // ConeGeometry(r,h,4) puts its first vertex on +z, so a pi/4 yaw sends the CORNERS to the
    // diagonals and the flats to the axes: half-width is r/sqrt(2). 8.77 gives 12.40 across, and a
    // z scale of 0.726 makes it 9.00 deep. The corners land at 7.66 against a 7.4 deck, so the roof
    // overhangs its own plinth all the way round — §5.5's eave shadow, which is the single strongest
    // thing separating a roof from what is under it at 46px.
    put(CONEG(8.77,2.40,4),ROOF,_m(0,6.12,0,0,Math.PI/4,0,1,1,0.726));
    put(CONEG(8.95,0.34,4),GOLDT,_m(0,5.06,0,0,Math.PI/4,0,1,1,0.726));   // the eave band
    put(CONEG(8.60,0.30,4),ROOFD,_m(0,5.36,0,0,Math.PI/4,0,1,1,0.726));   // a dark course above it

    // ---- THE CLERESTORY LANTERN, which is what makes this shape nobody else's ----
    put(CYLG(2.40,2.58,1.20,8),LANT,_m(0,6.92,0));
    for(let i=0;i<8;i++){const a2=i*Math.PI/4;
      put(BOXG(0.90,0.78,0.16),SLOT,_m(Math.sin(a2)*2.46,6.92,Math.cos(a2)*2.46,0,a2,0));}
    put(CONEG(3.62,1.30,4),ROOF,_m(0,8.17,0,0,Math.PI/4,0));
    put(CONEG(3.78,0.26,4),GOLDT,_m(0,7.66,0,0,Math.PI/4,0));
    put(CYLG(0.15,0.15,0.90,6),GOLDT,_m(0,9.15,0));                        // the finial
    put(CONEG(0.30,0.52,6),GOLDT,_m(0,9.75,0));

    // ---- four stalls, OUTSIDE the roofline where they can actually be seen ----
    // The canopy reaches z +-4.5, so these stand at +-5.9 in the open. Two face the road, which is
    // on the -z side (the bazaar sits at roadPoint + 3.2z).
    for(const sx2 of [-1,1])for(const sz2 of [-1,1]){
      const bx=sx2*3.2, bz=sz2*5.9, col=(sx2*sz2>0)?AWNA:AWNB;
      for(const o of [-1.5,1.5])put(CYLG(0.13,0.15,2.40,6),TIMB,_m(bx+o,2.05,bz));
      put(BOXG(3.30,0.34,1.20),TIMB,_m(bx,2.05,bz));                       // the counter
      put(BOXG(3.10,0.62,0.90),BEAM,_m(bx,1.55,bz));                       // its apron
      put(BOXG(3.70,0.16,2.10),col,_m(bx,3.34,bz-sz2*0.30,sz2*0.20,0,0));  // the awning, raked
      put(BOXG(3.80,0.10,0.24),GOLDT,_m(bx,3.16,bz-sz2*1.32,sz2*0.20,0,0));// its valance
      put(BOXG(0.70,0.42,0.52),(sx2>0)?SACK:CRATE,_m(bx-0.9,2.42,bz));     // goods ON the counter
      put(CYLG(0.26,0.20,0.46,7),AMPH,_m(bx+0.8,2.44,bz));
    }

    // ---- the wares, on the deck and under the canopy ----
    for(let i=0;i<5;i++){                                                  // crates, stacked in twos
      const cx=-3.9+i*1.95, cz=(i%2)?1.9:-1.9;
      put(BOXG(0.92,0.92,0.92),CRATE,_m(cx,1.31,cz,0,i*0.7,0));
      if(i%2)put(BOXG(0.74,0.74,0.74),CRATE,_m(cx+0.12,2.14,cz-0.1,0,i*1.1,0));
    }
    for(let i=0;i<3;i++)put(CYLG(0.42,0.46,0.96,8),BARREL,_m(-5.9+i*0.95,1.33,-0.6));
    for(let i=0;i<4;i++)put(CYLG(0.40,0.28,1.00,7),AMPH,_m(5.0+((i%2)?0.9:0),1.35,-1.4+i*0.75));
    for(let i=0;i<3;i++)put(BOXG(0.64,0.52,0.52),SACK,_m(-1.4+i*0.7,1.11,4.1,0,i*0.5,0));
    // rolled bolts of cloth leaning on the posts — colour the WARES carry, not the structure
    for(let i=0;i<3;i++)put(CYLG(0.17,0.19,1.70,6),(i===1)?CLOTHA:AWNA,_m(4.2+i*0.34,1.70,3.0,0.20,0,0.16));
    // …and hanging from the eaves, which is the read that says TRADE from across the map
    for(const hx of [-5.2,-2.0,2.0,5.2]){
      put(CYLG(0.04,0.04,0.60,4),ROPE,_m(hx,4.55,-4.2));
      put(BOXG(0.62,1.05,0.10),(hx<0)?AWNB:CLOTHA,_m(hx,3.70,-4.2));
    }
    put(BOXG(2.70,0.08,1.80),AWNA,_m(0.4,0.92,6.3,0,0.2,0));
    put(BOXG(2.80,0.06,0.32),GOLDT,_m(0.4,0.94,7.05,0,0.2,0));
    // pennant poles at the diagonals: the vertical accent, and the only silhouette event outside
    // the roof (§6.3's two-event budget, applied to a prop)
    for(const sx2 of [-1,1])for(const sz2 of [-1,1]){
      put(CYLG(0.11,0.13,4.60,6),TIMB,_m(sx2*5.4,3.15,sz2*4.6));
      put(BOXG(0.10,0.62,0.94),(sx2>0)?AWNB:AWNA,_m(sx2*5.4,5.10,sz2*4.6+0.5));
    }

    const bz=new THREE.Mesh(_mergeColored(BP),BAZAAR_MAT);
    bz.castShadow=true; bz.receiveShadow=true;
    bz.position.set(x,terrainHeight(x,z),z); scene.add(bz);
  }
})();
`;
s=s.split(hand).join(builder);

fs.writeFileSync(P,s);
console.log("bazaar: placement stays in the seeded window (numbers + a 696-draw debt);");
console.log("        geometry moves below the handback as one merged mesh per site.");
console.log("~18 meshes on ~18 materials per bazaar  ->  1 mesh on 1 shared material, 3 calls total");
console.log("node hash must STILL read all=a0e4532bfa20051c  res=2ac1ea6adf9f4553");
