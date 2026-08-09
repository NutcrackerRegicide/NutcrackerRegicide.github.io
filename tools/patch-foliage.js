#!/usr/bin/env node
/* v131.30 — UNDERGROWTH STOPS GROWING THROUGH THINGS
   --------------------------------------------------
   node tools/patch-foliage.js          (idempotent: re-running reports NOTHING WRITTEN)

   John: "fix undergrowth at buildings". §8.7 has had this on the books since the art direction was
   written — "a hard exclusion zone: zero props within 1.5 tiles of any building footprint or road.
   Undergrowth currently grows through bazaar plazas, through pond water, across the beach and
   inside creep-camp fire rings" — and the new bazaar made it impossible to ignore, because a 17-unit
   plinth has bushes standing on it where a 9-unit one had them standing beside it.

   THE COMPLAINT IS THREE DIFFERENT BUGS AND ONLY ONE OF THEM IS A RADIUS.

   1. plantGrass HAS NO EXCLUSION AT ALL. Not the roads, not the town centres, nothing — 310 patches
      of 6-13 blades scattered over the whole map and pushed unconditionally. undergrowth() has a
      clear() with the Town Centres at 34 and the King's Road at 9; the older layer never got one.

   2. undergrowth's clear() TESTS THE PATCH CENTRE, NOT THE PIECES. Every layer picks a legal centre
      with spot() and then spreads its blades, clovers, bushes and ferns up to 2.1 units around it,
      so a patch sitting legally just outside a plaza throws a third of itself onto the flagstones.
      That is exactly the read in the render: bushes ON the bazaar's rim, not near it.

   3. BUILDINGS DO NOT EXIST YET WHEN THE FOLIAGE IS SOWN. The world is generated once at load and
      every barracks, house and tower is placed minutes later, so no world-gen radius can ever
      exclude them. This is the part John actually asked about and it needs a runtime mechanism,
      not a bigger number.

   >>> AND THE WHOLE THING IS SHAPED BY THE SEEDED WINDOW, WHICH COST v131.29 AN ATTEMPT. <<<
   plantGrass runs INSIDE it and burns 7 Math.random()s per blade; its own comment says "this layer
   is ON THE WIRE … every node index downstream of here moves if the CALL COUNT moves". But look at
   the shape of that loop: all seven draws happen BEFORE mats.push(). So a test placed on the PUSH
   changes what is kept and not what is drawn, and the stream is untouched. That is the only reason
   this fix is affordable at all.
   undergrowth() is easier still — it runs below the handback on its own mulberry32(0x5EEDF00D), so
   nothing it does can move a node. Deterministic across peers either way, because the seed is.
   tools/nodehash.js is the guard: all=a0e4532bfa20051c res=2ac1ea6adf9f4553, unchanged.

   WHAT IS DELIBERATELY NOT FIXED: the camps and the beach, which §8.7 also names. Both foliage
   layers draw their positions from MAP (|x|<=212, |z|<=125) and every camp pocket is bumped OUTSIDE
   the border — the boss bay sits at z -169. Neither layer can reach them. If something is growing on
   that beach it is another layer entirely, and guessing at a radius for it would be inventing a fix
   for a bug nobody has located.

   FOUR CHANGES:
     A. one shared predicate, foliageClear(x,z), hoisted above plantGrass so both layers can see it:
        town centres 34, the King's Road polyline 9, the bazaar plazas 10.5 (the new deck is 7.4 and
        the sunk step 8.6), the three ponds at their own rim + 2.4.
     B. plantGrass gates its push on it — no stream change, by construction.
     C. scatter() gates EVERY PIECE on it, which is one edit covering all six undergrowth layers
        exactly, instead of six edits covering their patch centres approximately. A rejected instance
        gets a zero-scale matrix, which is how an InstancedMesh hides one thing without moving the
        rest.
     D. a registry and clearFoliageAt(x,z,r), called from makeBuilding, so a building placed at
        minute nine clears the ground it stands on. Display-only — no simulation reads it, so host
        and guest may disagree for ever without desyncing, which is the same argument setGarrisonView
        already makes for .visible.                                                                */
const fs=require("fs"),path=require("path"),ROOT=path.join(__dirname,"..");
let total=0,failed=0;
const F={};
const load=f=>(F[f]=F[f]!==undefined?F[f]:fs.readFileSync(path.join(ROOT,"js",f),"utf8"));
function sub(file,from,to,why){
  const s=load(file), n=s.split(from).length-1;
  if(n!==1){console.log("  !! "+file+" expected 1, found "+n+"  <<"+from.slice(0,64).replace(/\n/g,"\\n")+">>");failed++;return;}
  F[file]=s.split(from).join(to); total++; console.log("  ok  "+why);
}
if(load("02-world.js").indexOf("function foliageClear")>=0){console.log("already applied — NOTHING WRITTEN");process.exit(0);}

// ---- A. the shared predicate + the registry, above plantGrass ------------------------------------
sub("02-world.js",
`(function plantGrass(){`,
`// ==================== v131.30 ONE EXCLUSION TEST, SHARED BY EVERY FOLIAGE LAYER ====================
// §8.7: "zero props within 1.5 tiles of any building footprint or road. Undergrowth currently grows
// through bazaar plazas, through pond water …". There were two tests before this and they disagreed:
// undergrowth() had one covering the Town Centres and the road, plantGrass had NONE, and neither
// knew about the plazas or the water. One predicate, defined before the first layer that needs it.
// The pond table is hoisted out of ponds() below rather than copied, so the two cannot drift.
const PONDS=[[-105,82,6.5],[98,-88,7],[-24,-104,5.5]];
const _FOL_ROAD=[]; for(let i=0;i<=40;i++)_FOL_ROAD.push(roadPoint(i/40));
function foliageClear(x,z){
  // dist2() lives in 04-units.js, which loads AFTER this file, and separate <script> tags do not
  // hoist across each other — calling it here throws at load and kills the whole IIFE silently,
  // which is a mistake this file has already made once and left a comment about.
  for(const t of TCPOS){const dx=x-t[0],dz=z-t[1];if(dx*dx+dz*dz<34*34)return false;}
  for(const r of _FOL_ROAD){const dx=x-r.x,dz=z-r.z;if(dx*dx+dz*dz<9*9)return false;}
  // the bazaar plazas: the v131.29 deck is 7.4 and its sunk step 8.6, so 10.5 keeps greenery off
  // the flagstones AND off the rim the contact shadow paints
  for(const m of neutralMarkets){const dx=x-m.x,dz=z-m.z;if(dx*dx+dz*dz<10.5*10.5)return false;}
  for(const p of PONDS){const dx=x-p[0],dz=z-p[1],rr=p[2]+2.4;if(dx*dx+dz*dz<rr*rr)return false;}
  return true;
}
// ---------- and the runtime half: a building placed at minute nine clears its own ground ----------
// No world-gen radius can exclude a barracks, because the barracks does not exist when the grass is
// sown. Every instanced layer registers itself here and makeBuilding (03-buildings.js) calls
// clearFoliageAt with the footprint it is about to stand on.
// PURELY DISPLAY. Nothing in the simulation reads an instance matrix, so a host and a guest may
// disagree about this for ever without desyncing — the same argument setGarrisonView already makes
// for .visible. It is also one-way: foliage does not grow back when a building falls, which is both
// cheaper and more truthful about ground somebody has been building on.
const FOLIAGE_LAYERS=[];
const _FOL_GONE=new THREE.Matrix4().makeScale(0,0,0);
function registerFoliage(inst){
  const n=inst.count, px=new Float32Array(n), pz=new Float32Array(n), m=new THREE.Matrix4();
  for(let i=0;i<n;i++){inst.getMatrixAt(i,m);px[i]=m.elements[12];pz[i]=m.elements[14];}
  FOLIAGE_LAYERS.push({inst,px,pz,live:new Uint8Array(n).fill(1)});
  return inst;
}
function clearFoliageAt(x,z,r){
  if(!FOLIAGE_LAYERS.length)return 0;
  const rr=r*r; let hit=0;
  for(const L of FOLIAGE_LAYERS){
    let dirty=false;
    for(let i=0;i<L.px.length;i++){
      if(!L.live[i])continue;
      const dx=L.px[i]-x, dz=L.pz[i]-z;
      if(dx*dx+dz*dz>rr)continue;
      L.live[i]=0; L.inst.setMatrixAt(i,_FOL_GONE); dirty=true; hit++;
    }
    if(dirty)L.inst.instanceMatrix.needsUpdate=true;
  }
  return hit;
}
(function plantGrass(){`,
  "02-world.js: one shared exclusion predicate, plus the runtime clear a building needs");

// ---- ponds read the hoisted table ---------------------------------------------------------------
sub("02-world.js",
`  for(const [px,pz,pr] of [[-105,82,6.5],[98,-88,7],[-24,-104,5.5]]){`,
`  for(const [px,pz,pr] of PONDS){   // v131.30 hoisted above plantGrass so foliageClear sees it too`,
  "02-world.js: the pond table has one owner instead of two copies");

// ---- B. plantGrass gates the PUSH, which is free ------------------------------------------------
sub("02-world.js",
`      col.setHex(tones[(Math.random()*tones.length)|0]).offsetHSL(0,0,(Math.random()-0.5)*0.04);
      mats.push([dummy.matrix.clone(),col.clone()]);`,
`      col.setHex(tones[(Math.random()*tones.length)|0]).offsetHSL(0,0,(Math.random()-0.5)*0.04);
      // v131.30 …AND THE TEST GOES ON THE PUSH, NOT ON THE DRAW. This layer is on the wire: all
      // SEVEN Math.random()s above happen unconditionally, and the note at the head of this
      // function is right that moving the call count moves every node index downstream. Rejecting
      // AFTER the last draw changes what is kept and not what is drawn, so the stream is untouched
      // by construction — verified by tools/nodehash.js, which must still read a0e4532bfa20051c.
      // Before this, plantGrass had no exclusion of any kind: not the plazas, not the water, not
      // even the roads and the two thrones that undergrowth() has always avoided.
      if(!foliageClear(x,z))continue;
      mats.push([dummy.matrix.clone(),col.clone()]);`,
  "02-world.js: the grass layer gets an exclusion at last, and it costs nothing on the wire");

sub("02-world.js",
`  for(let i=0;i<mats.length;i++){inst.setMatrixAt(i,mats[i][0]);inst.setColorAt(i,mats[i][1].convertSRGBToLinear());}`,
`  for(let i=0;i<mats.length;i++){inst.setMatrixAt(i,mats[i][0]);inst.setColorAt(i,mats[i][1].convertSRGBToLinear());}
  registerFoliage(inst);   // v131.30 so a building placed later can clear the ground it stands on`,
  "02-world.js: …and the grass registers for runtime clearing");

// ---- C. scatter() gates every PIECE, one edit for all six layers ---------------------------------
sub("02-world.js",
`    for(let i=0;i<count;i++){
      place(i,dummy,col);
      dummy.updateMatrix();
      inst.setMatrixAt(i,dummy.matrix);`,
`    for(let i=0;i<count;i++){
      place(i,dummy,col);
      // v131.30 THE TEST IS ON THE PIECE, NOT ON THE PATCH. clear() below is only consulted by
      // spot(), which picks a patch CENTRE — and every layer then spreads its blades, clovers,
      // bushes and ferns up to 2.1 units around it. So a patch standing legally just outside a
      // plaza throws a third of itself onto the flagstones, which is exactly what the bazaar
      // render shows: bushes ON the rim rather than beside it. One test here is all six layers,
      // exactly, instead of six tests on their centres, approximately.
      // A zero-scale matrix is how an InstancedMesh hides ONE instance without disturbing the rest;
      // the colour is still written so the buffer stays uniform.
      if(!foliageClear(dummy.position.x,dummy.position.z))dummy.scale.set(0,0,0);
      dummy.updateMatrix();
      inst.setMatrixAt(i,dummy.matrix);`,
  "02-world.js: every undergrowth PIECE is tested, not just its patch centre");

sub("02-world.js",
`    inst.frustumCulled=false;
    scene.add(inst);
    return inst;`,
`    inst.frustumCulled=false;
    scene.add(inst);
    registerFoliage(inst);   // v131.30 runtime clearing, same as the grass layer
    return inst;`,
  "02-world.js: …and every undergrowth layer registers too");

// spot() uses the shared predicate now, so patch centres stop landing in water
sub("02-world.js",
`  const clear=(x,z)=>{
    for(const t of TCPOS){const dx=x-t[0],dz=z-t[1];if(dx*dx+dz*dz<34*34)return false;}
    for(const r of ROAD){const dx=x-r.x,dz=z-r.z;if(dx*dx+dz*dz<9*9)return false;}
    return true;
  };`,
`  // v131.30 was a private copy of the Town Centre and road tests. It is now the one shared
  // predicate (see foliageClear, above plantGrass), which also knows about the bazaar plazas and
  // the ponds — so patch centres stop being placed in water and then rejected piece by piece.
  const clear=foliageClear;`,
  "02-world.js: undergrowth's private exclusion becomes the shared one");

// ---- D. makeBuilding clears the ground it is about to stand on -----------------------------------
sub("03-buildings.js",
`  buildings.push(b); return b;`,
`  // v131.30 A BUILDING CLEARS THE GROUND IT STANDS ON. No world-gen exclusion can cover this: the
  // foliage is sown once at load and this barracks is being placed minutes later, so §8.7's "zero
  // props within 1.5 tiles of any building footprint" is a RUNTIME rule for everything except the
  // Town Centres. The radius is the building's own physical extent — bSteer is the longest half
  // extent it will ever have and rBlock is what a body is pushed out to — plus a tile of margin, so
  // the clearing matches the footprint rather than a guess about it.
  // Display only: nothing in the simulation reads an instance matrix (10.6 / §G), so this cannot
  // desync, and it is deliberately one-way — ground somebody has built on stays cleared.
  if(typeof clearFoliageAt==="function"){
    const _fr=Math.max((typeof bSteer==="function")?bSteer(b.def):0,b.def.rBlock||b.def.r||0)
      *((typeof BSCALE!=="undefined"&&BSCALE[type])||1)+1.5;
    clearFoliageAt(b.x,b.z,_fr);
  }
  buildings.push(b); return b;`,
  "03-buildings.js: a building clears the undergrowth it is standing in");

if(failed){console.log("\n"+failed+" site(s) did not match — NOTHING WRITTEN.");process.exit(1);}
for(const f in F)fs.writeFileSync(path.join(ROOT,"js",f),F[f]);
console.log("\n"+total+" written.\n");
