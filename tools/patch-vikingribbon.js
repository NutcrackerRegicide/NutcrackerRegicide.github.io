#!/usr/bin/env node
/* v132.2 — MAP REWORK STAGE 2/3, SECOND HALF: THE VIKING ROAD ITSELF
   ------------------------------------------------------------------
   node tools/patch-vikingribbon.js      (idempotent: re-running reports NOTHING WRITTEN)

   John: "viking road - new path that goes from each base to the viking camp. this should be a small
   dirt path and includes the blue team and red team bazaars."

   v132.1 put the SITES on that path — vikingPoint(), VIKING_END and the two team bazaars, with the
   terrain flattened under their plazas. This is the road you can see. Two branches, one mesh.

   ================================ WHAT THE SURVEY MEASURED ================================
   tools/vikingsurvey.js walked both branches before a single vertex was written, because every
   "it will probably be fine" in this project has been wrong when somebody finally measured it —
   the ring ate the corner camps, the bay flat drifted ten units, the batter was a third
   see-through. What it found, and what each number changed:

     arc length 231.2 per branch, 66% of the King's Road's 352.8
     ground -2.31..2.15, worst grade 19.6% at (-96.6, -57)
         -> shallow enough for a draped ribbon; no cut, no fill, no flats along the route.
     every one of 401 samples per branch inside walkable()
         -> the far end at (0,-150) is real ground, not the border clamp.
     THE JUNCTION: both roads leave the SAME throne, so they share ground for the first 13.9 units,
     overlapping by up to 7.45. Once clear they never come within 7.6 of each other again.
         -> this is a T-junction, not a collision, and it is SHORT. Handled below with a height
            split and polygonOffset instead of by bending the spine away, which would have cost the
            bow its shape for 14 units of overlap at the one place a junction belongs.
     SIX "peaks" within the corridor, two of them 1.9 units off the spine.
         -> and this is why the survey exists. They are not peaks. tools/_idprobe.js identified all
            three checked: 648-vertex meshes standing 7-8 above the ground at (-56,-96), (-41,-106)
            and (58,-73), each one exactly on a `wood` node. THEY ARE TREES, growing in the middle
            of the road. The terrain underneath is flat. So the route needs no re-routing at all —
            it needs tree clearance, which is the third patch below. Had I trusted the label
            instead of the probe I would have spent the afternoon moving a spine that was fine.

   ================================ WHY IT IS NOT A SMALL KING'S ROAD ================================
   The tempting move is to call kingsRoad's sweep with a smaller half-width. That ships two roads
   made of the same material at two sizes, which reads as one road that got narrower — the opposite
   of a highway and a track. The two are built to differ in the one thing that carries material:

     THE CROSS-SECTION. A cart road has TWO wheel ruts because a cart has two wheels; kingsRoad
     spends its resolution on a wandering pair of gaussians 2.4 off the spine. People walk in single
     file, so a footpath has ONE trodden hollow up the middle and nothing else. That is the whole
     difference and it is free.
     THE VALUE ORDER IS INVERTED, on purpose. The King's Road is dark in the ruts and palest at the
     shoulder (dust thrown off the wheels). This is palest in the MIDDLE — bare dry compacted earth
     — and darkens outward into a shaded, littered margin under the canopy. Two roads whose profiles
     run opposite ways cannot be mistaken for each other at any distance.
     WIDTH 4.9-6.2 against 9.1-10.2, and the edge wanders proportionally HARDER: +-0.67 on a 2.45
     half-width is 27% where the King's Road's +-0.82 on 4.8 is 17%. A maintained road has a
     definable edge; a track does not.
     TILE 11.5 against 19.2 — the same ~2:1 stretch along the direction of travel against a
     narrower ribbon, so the grain stays the same size in world units and the two share one map.

   THE PALETTE IS DIVIDED THROUGH THE SAME MEASURED _RGAIN kingsRoad uses, because it is the same
   sun, the same toon ramp, the same grit map and the same grade. Authored as sRGB bytes as they
   should come OFF the composer, not as they go into the material. Re-measure with tools/roadshot.js
   if any of those move.

   ================================ THE JUNCTION, IN TWO PARTS ================================
   Coplanar decals strobe. Both roads are draped to groundY, so at the junction they are the same
   surface twice:
     1. HEIGHT. The King's Road sits at groundY+0.06; this sits at +0.035. The King's Road wins the
        overlap, which is the right way round — a track meets a road, the road does not stop.
        0.025 of separation against ~0.005 of depth resolution at 200 units is a 5x margin.
     2. polygonOffset +1/+1 pushes this ribbon AWAY from the camera, so at the grazing angles where
        0.025 is not enough the King's Road still wins. It is the same cure 01-engine.js:401 already
        applies to the ink hulls, and it costs nothing.
   And at the far end there is no seam to solve at all: raidShore lays a sand disc of radius 51 at
   (0,-196), at +0.05, so the last 5 units of path run UNDER the beach and the sand wins by 0.015.
   The ribbon tapers to 30% over t 0.90..1.00 — 21 units of fraying out — so the track dies into the
   strand instead of stopping on the grass with a blunt end 5 units short of it.

   ================================ THE STREAM ================================
   §10.7: every Math.random AND every THREE constructor inside the seeded window draws from the one
   stream that builds nodes[]. THIS FUNCTION MAKES NO Math.random CALLS AT ALL — the half-width
   breathes on sines of t and the edges wander on sines of their own world position, which is what
   kingsRoad already does for its edges and is strictly better than a random anyway because it is
   continuous along the road. Three constructors (BufferGeometry, MeshToonMaterial, Mesh) = 12 uuid
   draws, and they land AFTER the last node is created (placeNodes 400, plantForests 1281, kingsRoad
   1594 — nothing downstream of 1594 calls makeNode), so they cannot move a node index.

   The TREE CLEARANCE can and does: it runs inside plantForests and removes trees, which removes
   wood nodes. That is deliberate and it is paid for:

   >>> PROTO 27 -> 28. <<<
   MEASURED, NOT ASSUMED. tools/nodehash.js against the committed v132.0:
       WORKING TREE : 893 nodes (837 wood)  all=a850b8fdec988cda  res=2ac1ea6adf9f4553
       BASE (v132.0): 880 nodes (824 wood)  all=34d24d58499fbac7  res=2ac1ea6adf9f4553
   v132.1 ALREADY moved the tree stream — 27 as shipped in v132.0 no longer describes this world
   before this patch adds a line — and the resource indices held, which is why the two hashes differ
   in `all` and agree in `res`. v132.0's header argued for one bump at the head of the branch; that
   argument only holds while the branch has not shipped a build under the old number, and 27 is
   committed. 28 costs nothing and a silent desync costs a match.

   The tree clearance is 12 against the King's Road's 21. Deliberately tight: the corridor stays
   walkable and buildable (a live wood node refuses building placement within r+3) while the woods
   still crowd the track, which is the read John's sketch asks for. Canopies are ~7.5 across, so at
   12 they reach to ~4.5 off the spine and overhang a path whose edge is at 3.1 — a shaded track,
   with the trunks well clear of it.
   Foliage keeps off at 6.0 against the King's Road's 9.0, same reasoning, and it leaves margin for
   one artefact §8.7 names: the contact-shadow pools under props reach 1.85 behind their prop, so
   the nearest possible pool edge is 6.0-1.85 = 4.15 off the spine against a path edge at 3.12. No
   lawn-green pool can land on the dirt.                                                          */
const fs=require("fs"),path=require("path"),ROOT=path.join(__dirname,"..");
let total=0,failed=0;
const F={};
const load=f=>(F[f]=F[f]!==undefined?F[f]:fs.readFileSync(path.join(ROOT,"js",f),"utf8"));
function sub(file,from,to,why){
  const s=load(file), n=s.split(from).length-1;
  if(n!==1){console.log("  !! "+file+" expected 1, found "+n+"  <<"+from.slice(0,64).replace(/\n/g,"\\n")+">>");failed++;return;}
  F[file]=s.split(from).join(to); total++; console.log("  ok  "+why);
}
if(load("02-world.js").indexOf("vikingRoad")>=0){console.log("already applied — NOTHING WRITTEN");process.exit(0);}

// ================================ 1. THE RIBBON ================================
sub("02-world.js",
`  rmesh.castShadow=false; rmesh.receiveShadow=true;   // a decal IS the ground, §3.8
  scene.add(rmesh);
})();
(function ponds(){ // still water, sandy rims, reeds and cattails`,
`  rmesh.castShadow=false; rmesh.receiveShadow=true;   // a decal IS the ground, §3.8
  scene.add(rmesh);
})();
// ==================== v132.2 THE VIKING ROAD: two branches, one mesh, one draw call ====================
// A narrow dirt track from each throne out to the mouth of the Viking bay, through that team's own
// bazaar at t=0.42. The spine is vikingPoint() in 00-data.js and is READ here and never touched —
// it is shared with the bazaar sites, the terrain flats under their plazas, the tree clearance and
// the foliage exclusion, and tools/mapconst.js exists to catch anybody who copies it instead.
//
// WHY IT IS NOT kingsRoad WITH A SMALLER NUMBER: a cart road has two wheel ruts because a cart has
// two wheels. People walk in single file, so a footpath has ONE trodden hollow and no shoulder, and
// its value runs the other way — palest in the bare middle, darkening outward into a shaded margin.
// See tools/patch-vikingribbon.js for the survey those choices were made against.
//
// NO Math.random IN HERE (§10.7). The half-width breathes on sines of t and each edge wanders on
// sines of its OWN world position — the same trick kingsRoad uses for its edges, and better than a
// random because it is continuous along the road instead of per-cross-section.
(function vikingRoad(){
  const N=40, SUB=6, M=N*SUB, TILE=11.5, HW0=2.45;
  const _ss=(a,b,v)=>{const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t);};

  // Authored as sRGB bytes AS THEY SHOULD COME OFF THE COMPOSER on sunlit ground, then divided
  // through the SAME measured pipeline gain kingsRoad uses — same sun, same ramp, same grit map,
  // same grade. If any of those move, both roads are re-measured together with tools/roadshot.js.
  // ORDER MATTERS AND IT IS THE OPPOSITE OF THE KING'S ROAD: bare compacted earth in the middle,
  // shaded litter at the margin. Two roads whose profiles run opposite ways cannot be confused.
  const _TGT=[[152,129,95],[127,105,75],[103,85,61]];   // trodden centre / flank / shaded margin
  const _RGAIN=[0.87,0.71,0.56];
  const _s2l=v=>{v/=255;return v<=0.04045?v/12.92:Math.pow((v+0.055)/1.055,2.4);};
  const STOP=_TGT.map(c=>[_s2l(c[0])/_RGAIN[0],_s2l(c[1])/_RGAIN[1],_s2l(c[2])/_RGAIN[2]]);

  const _c=[0,0,0];
  const pathTint=(s,x,z)=>{
    const a=Math.abs(s);
    // ONE hollow. No rut pair, no wandering gauge, no shoulder — all three of those are cart-road
    // features and putting them on a footpath is what would make this read as a narrow King's Road.
    const bare=1-_ss(0.10,0.58,a);      // the trodden strip, worn to dry earth
    const margin=_ss(0.46,0.92,a);      // grass litter and canopy shade creeping back in
    // wear at periods 21.7 / 8.8 / 4.4 units — nothing sharing a factor with the 11.5 tile, so the
    // map and the vertex layer cannot phase-lock and draw a rhythm along the path.
    const wear=0.17*Math.sin(x*0.29+z*0.19)
              +0.11*Math.sin(x*0.71-z*0.44)
              +0.06*Math.sin(x*1.43+z*0.93);
    // …and banded to five levels over the 0..2 span, like every other surface in this world (§3.7).
    const t=Math.max(0,Math.min(2,0.72-0.62*bare+1.16*margin+wear));
    const q=Math.round(t*2)/2;
    const i=q<1?0:1, f=q<1?q:q-1;
    // dry/damp rather than light/dark, the same axis the meadow and the King's Road use
    const dry=Math.max(0,wear), damp=Math.max(0,-wear);
    const gr=[1+dry*0.10-damp*0.05, 1+dry*0.03-damp*0.03, 1-dry*0.16+damp*0.12];
    for(let k=0;k<3;k++)_c[k]=(STOP[i][k]+(STOP[i+1][k]-STOP[i][k])*f)*gr[k];
    return _c;
  };

  // 17 columns against the King's Road's 27: half the width and no rut pair to resolve, so the
  // resolution goes where this profile actually bends — around a=0.5, where bare hands over to
  // margin. Sampling this at two vertices is the bug v131.15 found in the road: a cross-section
  // needs vertices to live in.
  const S=[-1,-0.94,-0.86,-0.76,-0.64,-0.50,-0.34,-0.17,0,
            0.17,0.34,0.50,0.64,0.76,0.86,0.94,1], K=S.length;
  const pos=[], uv=[], idx=[];
  for(const team of [0,1]){
    const base=pos.length/3;                    // both branches share one buffer -> one draw call
    let arc=0, pcx=0, pcz=0;
    for(let j=0;j<=M;j++){
      const t=j/M;
      const e=0.0012;                           // tangent from a central difference on the spine
      const p0=vikingPoint(team,Math.max(0,t-e)), p1=vikingPoint(team,Math.min(1,t+e));
      let tx=p1.x-p0.x, tz=p1.z-p0.z;
      const tl=Math.hypot(tx,tz)||1; tx/=tl; tz/=tl;
      const nx=-tz, nz=tx;                      // the across-track normal
      const c=vikingPoint(team,t);
      if(j)arc+=Math.hypot(c.x-pcx,c.z-pcz);    // cumulative arc length, for v
      pcx=c.x; pcz=c.z;
      // THE TAPER. raidShore's sand disc is r51 at (0,-196) and this ends at (0,-150), so only the
      // last 5 units are covered by beach. Without a taper the track stops dead on the grass just
      // short of the strand. 21 units of fraying to 30% reads as a path dying into loose sand.
      const tap=1-0.70*_ss(0.90,1.00,t);
      const hw=HW0+0.30*Math.sin(t*17.3+team*2.1)+0.18*Math.sin(t*41.7-team*1.3);
      const w=[0,0];
      for(let k=0;k<2;k++){
        const sgn=k?1:-1;
        const ex=c.x+nx*sgn*hw, ez=c.z+nz*sgn*hw;      // the nominal edge, then perturb it
        // each side driven off ITS OWN world position, or both edges move together and the ribbon
        // merely snakes. +-0.67 on 2.45 — 27%, against the King's Road's 17%. A track has no edge.
        w[k]=Math.max(0.25,(hw+0.34*Math.sin(ex*0.77+ez*0.53)
                              +0.21*Math.sin(ex*1.61-ez*1.07)
                              +0.12*Math.sin(ex*3.30+ez*2.40))*tap);
      }
      for(let k=0;k<K;k++){
        const s=S[k], ww=s<0?w[0]:w[1];
        const px=c.x+nx*s*ww, pz=c.z+nz*s*ww;
        // +0.035, UNDER the King's Road's +0.06 — see the junction note in the patch header. The
        // beach at +0.05 is over both, which is why the far end needs no seam work.
        pos.push(px,groundY(px,pz)+0.035,pz);
        uv.push(0.5+s*0.5, arc/TILE);           // u edge-locked across, v on arc length
      }
    }
    for(let j=0;j<M;j++)for(let k=0;k<K-1;k++){
      const a=base+j*K+k;
      idx.push(a,a+1,a+K, a+1,a+K+1,a+K);       // winding gives +Y; the material is FrontSide
    }
  }
  const vgeo=new THREE.BufferGeometry();
  vgeo.setAttribute("position",new THREE.Float32BufferAttribute(pos,3));
  vgeo.setAttribute("uv",new THREE.Float32BufferAttribute(uv,2));
  vgeo.setIndex(idx);
  const V=pos.length/3, col=new Float32Array(V*3);
  // v%K is safe across the two branches: each contributes exactly (M+1)*K vertices, a whole
  // multiple of K, so column k of branch 1 is still column k.
  for(let v=0;v<V;v++){
    const t=pathTint(S[v%K],pos[v*3],pos[v*3+2]);
    col[v*3]=t[0]; col[v*3+1]=t[1]; col[v*3+2]=t[2];
  }
  vgeo.setAttribute("color",new THREE.BufferAttribute(col,3));
  vgeo.computeVertexNormals();
  // THE SAME TEXTURE OBJECT the King's Road minted. texturedMat caches on kind+hex, so this is the
  // one already uploaded with mipmaps, NearestFilter magnification and full anisotropy — and
  // sharing it means the two roads cannot drift apart in filtering, which is a real hazard given
  // how long it took to work out that the near road's softness was in the swatch and not the mode.
  // Tiling lives in the UVs, not in .repeat, so a shared map can carry two different tile sizes.
  const _vtex=texturedMat("dirt",0xCFCFCF).map;
  const vmesh=new THREE.Mesh(vgeo,_fogClamp(toonMat({map:_vtex,vertexColors:true,
    // pushed AWAY from the camera so the King's Road wins the 13.9 units they share out of the
    // throne even at grazing angles, where 0.025 of height alone would not be decisive.
    polygonOffset:true,polygonOffsetFactor:1.0,polygonOffsetUnits:1.0}),GROUND_FOG));
  vmesh.castShadow=false; vmesh.receiveShadow=true;   // a decal IS the ground, §3.8
  scene.add(vmesh);
})();
(function ponds(){ // still water, sandy rims, reeds and cattails`,
  "02-world.js: the Viking road — two branches, one mesh, no Math.random");

// ================================ 2. FOLIAGE KEEPS OFF IT ================================
sub("02-world.js",
`const _FOL_ROAD=[]; for(let i=0;i<=40;i++)_FOL_ROAD.push(roadPoint(i/40));`,
`const _FOL_ROAD=[]; for(let i=0;i<=40;i++)_FOL_ROAD.push(roadPoint(i/40));
// v132.2 …and the Viking track, both branches. 34 samples per branch is 6.8 units apart, so with a
// 6.0 keep-off the cleared band never pinches below 4.9 half-width between samples — against a path
// edge that reaches 3.12 at its widest.
const _FOL_VIKING=[];
for(const _vt of [0,1])for(let i=0;i<=33;i++)_FOL_VIKING.push(vikingPoint(_vt,i/33));`,
  "02-world.js: the Viking spine, sampled for the foliage exclusion");

sub("02-world.js",
`  for(const r of _FOL_ROAD){const dx=x-r.x,dz=z-r.z;if(dx*dx+dz*dz<9*9)return false;}`,
`  for(const r of _FOL_ROAD){const dx=x-r.x,dz=z-r.z;if(dx*dx+dz*dz<9*9)return false;}
  // v132.2 6.0 for the Viking track against 9.0 for the King's Road — it is half the width and the
  // woods are SUPPOSED to crowd it. It still leaves margin for the artefact §8.7 names: a contact
  // shadow pool reaches 1.85 behind its prop, so the nearest one can land is 6.0-1.85 = 4.15 off
  // the spine, against a path edge at 3.12. No lawn-green pool on the dirt.
  for(const r of _FOL_VIKING){const dx=x-r.x,dz=z-r.z;if(dx*dx+dz*dz<6*6)return false;}`,
  "02-world.js: undergrowth stops growing through the Viking road");

// ================================ 3. TREES KEEP OFF IT ================================
sub("02-world.js",
`const TREE_CLEAR_NODE=8;    // don't bury the stone/gold/berry nodes`,
`const TREE_CLEAR_NODE=8;    // don't bury the stone/gold/berry nodes
// v132.2 THE VIKING TRACK, AND IT IS TIGHT ON PURPOSE. tools/vikingsurvey.js found trees standing
// 1.9 units off the spine — in the middle of the road — so this is not optional. But 21 like the
// King's Road would drive a 42-wide avenue through the southern woods and turn a track into a
// second highway. Canopies are ~7.5 across, so at 12 the trunks are well clear while the branches
// reach to ~4.5 off the spine and overhang a path whose edge is at 3.12: a shaded track through
// real woods. It also keeps the corridor buildable — a live wood node refuses any building within
// r+3, which is the functional reason clear lanes exist at all.
const TREE_CLEAR_VIKING=12;`,
  "02-world.js: TREE_CLEAR_VIKING — a track through the woods, not an avenue");

sub("02-world.js",
`  const ROADPTS=[]; for(let i=0;i<=60;i++)ROADPTS.push(roadPoint(i/60));`,
`  const ROADPTS=[]; for(let i=0;i<=60;i++)ROADPTS.push(roadPoint(i/60));
  const VIKPTS=[]; for(const vt of [0,1])for(let i=0;i<=40;i++)VIKPTS.push(vikingPoint(vt,i/40));`,
  "02-world.js: the Viking spine, sampled for tree clearance");

sub("02-world.js",
`    for(const p of ROADPTS)if(_d2(x,z,p.x,p.z)<TREE_CLEAR_ROAD*TREE_CLEAR_ROAD)return false;`,
`    for(const p of ROADPTS)if(_d2(x,z,p.x,p.z)<TREE_CLEAR_ROAD*TREE_CLEAR_ROAD)return false;
    for(const p of VIKPTS)if(_d2(x,z,p.x,p.z)<TREE_CLEAR_VIKING*TREE_CLEAR_VIKING)return false;`,
  "02-world.js: no more trees growing in the middle of the Viking road");

// ================================ 4. THE WIRE ================================
sub("10-net.js",
`  // v132.0 26 -> 27: the map rework. MAP.x/MAP.z changed, so every node moved. Bumped at the HEAD
  // of the branch on purpose — every later stage (the Viking road, the camp split, the re-sited
  // bazaars) is then free to move the world without a second break. It also pays off the 696-draw
  // stream debt v131.29 had to carry purely to keep 26 interoperating; that is deleted separately.
  PROTO:27,             // bumped whenever the wire format changes OR the generated world does.`,
`  // v132.0 26 -> 27: the map rework. MAP.x/MAP.z changed, so every node moved. It also paid off the
  // 696-draw stream debt v131.29 had to carry purely to keep 26 interoperating.
  // v132.2 27 -> 28. v132.0's plan was ONE bump at the head of the branch, with every later stage
  // then free to move the world. That plan only holds while nothing has SHIPPED under the old
  // number, and 27 is committed. MEASURED with tools/nodehash.js rather than reasoned about:
  //     working tree : 893 nodes (837 wood)  all=a850b8fdec988cda  res=2ac1ea6adf9f4553
  //     v132.0       : 880 nodes (824 wood)  all=34d24d58499fbac7  res=2ac1ea6adf9f4553
  // — the re-sited bazaars had already moved the tree stream before the Viking road added a line,
  // and its clearance moves it again. res holding while all moves is the signature of a change
  // downstream of placeNodes: the resource indices are the same, the trees are not.
  PROTO:28,             // bumped whenever the wire format changes OR the generated world does.`,
  "10-net.js: PROTO 27 -> 28, on a measured node-stream move");

if(failed){console.log("\n"+failed+" site(s) did not match — NOTHING WRITTEN.");process.exit(1);}
for(const f in F)fs.writeFileSync(path.join(ROOT,"js",f),F[f]);
console.log("\n"+total+" written.\n");
console.log("  next: tools/vikingroad.js is the gate — it measures the ribbon that now exists,");
console.log("  where the two roads overlap, and whether anything still stands in the road.\n");
