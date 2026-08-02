const worldDeco=[]; // distance-culled scenery
// MULTIPLAYER: world generation must be identical on every machine, so this whole
// file runs under a seeded RNG. Node order = network node index. Restored at EOF.
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);
  t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;}}
// drape a flat decal geometry over the rolling terrain: vertex heights get baked in
function drapedDecal(radius,segs,color,cx,cz,off,tex){
  const geo=new THREE.CircleGeometry(radius,segs);
  geo.rotateX(-Math.PI/2);
  const pa=geo.attributes.position;
  for(let i=0;i<pa.count;i++)
    pa.setY(i,terrainHeight(cx+pa.getX(i),cz+pa.getZ(i))+off);
  geo.computeVertexNormals();
  const m=new THREE.Mesh(geo,tex?texturedMat(tex,color):mat(color));
  m.position.set(cx,0,cz); m.castShadow=false; m.receiveShadow=false;
  return m;
}
const __realRandom=Math.random;
Math.random=mulberry32(0x20260710);
/* REGICIDE PVP — 02-world.js */
// ---------- ground & scenery ----------
(function buildTerrain(){
  const geo=new THREE.PlaneGeometry(MAP.x*2+110,MAP.z*2+200,150,120); // v82: reaches under the deepened camp hollows + the Viking bay
  const pa=geo.attributes.position;
  for(let i=0;i<pa.count;i++){
    // plane is XY; after rotation.x=-90°, local +z becomes world up and local y becomes -world z
    pa.setZ(i,terrainHeight(pa.getX(i),-pa.getY(i)));
  }
  geo.computeVertexNormals();
  // elevation tinting: crests lighten, valleys cool and darken, steep faces show dirt —
  // this is what makes the hills READ
  const colArr=new Float32Array(pa.count*3);
  for(let i=0;i<pa.count;i++){
    const wx=pa.getX(i), wz=-pa.getY(i), h=pa.getZ(i);
    const slope=Math.min(1,Math.hypot(
      terrainHeight(wx+2,wz)-terrainHeight(wx-2,wz),
      terrainHeight(wx,wz+2)-terrainHeight(wx,wz-2))*0.45);
    const lift=Math.max(-1,Math.min(1,h/2.2));
    let r=1+lift*0.10, gg=1+lift*0.09, b=1+lift*0.05;
    if(lift<0){ r+=lift*0.06; b-=lift*0.05; }          // valleys: darker, cooler
    r=r*(1-slope)+slope*0.80; gg=gg*(1-slope)+slope*0.68; b=b*(1-slope)+slope*0.52; // slope dirt
    colArr[i*3]=r; colArr[i*3+1]=gg; colArr[i*3+2]=b;
  }
  geo.setAttribute("color",new THREE.BufferAttribute(colArr,3));
  const g=new THREE.Mesh(geo,new THREE.MeshLambertMaterial({color:0xffffff,map:grassTex,vertexColors:true}));
  g.rotation.x=-Math.PI/2; g.receiveShadow=true; scene.add(g);
  // chunky grass tufts + dirt patches for that low-poly MMO look
  for(let i=0;i<195;i++){
    const gx=(Math.random()*2-1)*MAP.x, gz=(Math.random()*2-1)*MAP.z;
    scene.add(drapedDecal(1.5+Math.random()*3,7,Math.random()<0.5?0x7fae54:0x5f8a3e,gx,gz,0.04));
  }
  // (the old green border blocks are gone — a mountain ring at EOF frames the world now)
  // (trees now grow in FORESTS below — and every one of them is choppable)
})();

// ---------- resource nodes ----------
function makeNode(type,x,z,amount){
  const g=new THREE.Group();
  if(type==="food"){
    for(let i=0;i<3;i++){
      const s=new THREE.Mesh(new THREE.SphereGeometry(0.9-i*0.12,5,4),mat(0x3e7a35));
      s.position.set((Math.random()-0.5)*1.4,0.7+i*0.28,(Math.random()-0.5)*1.4);
      s.castShadow=true; g.add(s);
    }
    for(let i=0;i<7;i++){
      const b=new THREE.Mesh(new THREE.SphereGeometry(0.16,4,4),mat(0xd23c2f));
      b.position.set((Math.random()-0.5)*1.8,0.6+Math.random()*1.1,(Math.random()-0.5)*1.8);
      g.add(b);
    }
  }else if(type==="gold"){
    for(let i=0;i<4;i++){
      const n=new THREE.Mesh(new THREE.DodecahedronGeometry(0.55+Math.random()*0.35),mat(0xe0a92e));
      n.position.set((Math.random()-0.5)*1.8,0.4,(Math.random()-0.5)*1.8);
      n.castShadow=true; g.add(n);
    }
  }else{ // stone: big grey slabs
    for(let i=0;i<5;i++){
      const n=new THREE.Mesh(new THREE.DodecahedronGeometry(0.5+Math.random()*0.5),mat(i%2?0x8d949c:0x757c85));
      n.position.set((Math.random()-0.5)*2.2,0.35+Math.random()*0.3,(Math.random()-0.5)*2.2);
      n.rotation.set(Math.random(),Math.random(),Math.random());
      n.castShadow=true; g.add(n);
    }
  }
  const ny=terrainHeight(x,z);
  g.position.set(x,ny,z); scene.add(g);
  const node={type,x,z,y:ny,amount:amount||(type==="food"?950:850),mesh:g,r:2.2};
  nodes.push(node); return node;
}
(function placeNodes(){
  for(const side of [-1,1]){
    // base clusters
    for(const [bx,bz] of [[140,-38],[148,32],[125,-58]])
      for(let i=0;i<3;i++)makeNode("food",side*bx+(Math.random()-0.5)*8,bz+(Math.random()-0.5)*8,380);
    for(const [gx,gz] of [[135,52],[155,-10]])
      for(let i=0;i<3;i++)makeNode("gold",side*gx+(Math.random()-0.5)*8,gz+(Math.random()-0.5)*8,300);
    // forward (contested) clusters
    for(let i=0;i<3;i++)makeNode("food",side*(65+Math.random()*20),40+(Math.random()-0.5)*27,650);
    for(let i=0;i<3;i++)makeNode("gold",side*(70+Math.random()*20),-42+(Math.random()-0.5)*25,600);
  }
  // STONE: a scarce critical mineral — exactly 5 piles on the whole map
  makeNode("stone",-148,12,500); makeNode("stone",148,-12,500);   // one near each team
  makeNode("stone",-88,-18,700); makeNode("stone",88,18,700);     // midpoints
  makeNode("stone",0,-30,900);                                    // center (clear of the bazaar)
  // center prize
  for(let i=0;i<4;i++)makeNode("gold",(Math.random()-0.5)*30,(Math.random()-0.5)*40,900);
  for(let i=0;i<5;i++)makeNode("food",(Math.random()-0.5)*35,(Math.random()-0.5)*45,950);
})();

// ---------- the Kings Road's course (shared by the road decals AND the bazaars) ----------
// Mirror-symmetric about x=0: z(t)===z(1-t), so anything placed at t and 1-t is
// EXACTLY as far from one throne as from the other.
function roadPoint(t){
  const A=TCPOS[0],B=TCPOS[1];
  return {x:A[0]+(B[0]-A[0])*t,
          z:A[1]+(B[1]-A[1])*t+Math.sin(t*Math.PI)*16+Math.sin(t*Math.PI*3)*4};
}
// ---------- neutral trade bazaars ----------
// v78: all three sit ALONG the Kings Road — a near stall for each team and the center
// prize — nudged just off the ruts so the traffic rolls past the stalls.
const BAZAAR_T=[0.28,0.5,0.72]; // road fractions: mirrored pair + dead center (the balance dial)
(function placeNeutralMarkets(){
  for(const t of BAZAAR_T){
    const rp=roadPoint(t), x=rp.x, z=rp.z+3.2;
    const g=new THREE.Group();
    const plaza=new THREE.Mesh(new THREE.CylinderGeometry(4.5,4.8,1.6,10),mat(0xd9c48f));
    plaza.position.y=-0.55; g.add(plaza); // sunk plinth: the top stays level, slopes stay hidden
    for(const [px,pz] of [[-2.4,-2.4],[2.4,-2.4],[-2.4,2.4],[2.4,2.4]]){
      const post=cyl(0.14,0.14,3,0x8a6a3f); post.position.set(px,1.5,pz); g.add(post);
    }
    const canopy=cone(4,1.6,0xe0a92e,4); canopy.position.y=3.6; canopy.rotation.y=Math.PI/4; g.add(canopy);
    const trim=cone(4.2,0.4,0x8e1f1f,4); trim.position.y=2.95; trim.rotation.y=Math.PI/4; g.add(trim);
    for(let i=0;i<3;i++){
      const crate=box(0.8,0.8,0.8,0xb08a5a); crate.position.set(-1.5+i*1.5,0.65,(i%2?1.4:-1.2)); crate.rotation.y=i*0.7; g.add(crate);
    }
    const rug=box(2.6,0.06,1.7,0x8e1f1f); rug.position.set(0.4,0.28,3.2); rug.rotation.y=0.2; g.add(rug);
    const rugT=box(2.7,0.05,0.3,0xe0a92e); rugT.position.set(0.4,0.32,3.95); rugT.rotation.y=0.2; g.add(rugT);
    for(let i=0;i<2;i++){ // wares dangling from the canopy edge
      const str=cyl(0.03,0.03,0.7,0x9a8a6a,4); str.position.set(-2.2+i*4.4,2.6,2.1); g.add(str);
      const good=new THREE.Mesh(new THREE.SphereGeometry(0.24,6,5),mat(i?0xc23a3a:0xe0a92e));
      good.position.set(-2.2+i*4.4,2.15,2.1); good.castShadow=false; g.add(good);
    }
    const pot=cyl(0.35,0.25,0.7,0xa8623a,7); pot.position.set(-2.6,0.6,-1.8); g.add(pot);
    const pot2=cyl(0.28,0.2,0.55,0x8e4a2a,7); pot2.position.set(-2,0.5,-2.3); g.add(pot2);
    const lant=box(0.28,0.36,0.28,0xd9a92e); lant.position.set(2.4,2.3,2.3); lant.castShadow=false; g.add(lant);
    g.position.set(x,terrainHeight(x,z),z); scene.add(g);
    neutralMarkets.push({x,z});
  }
})();

// ---------- sparse grass: scattered patches of small clumped blades ----------
(function plantGrass(){
  const mats=[]; const dummy=new THREE.Object3D(); const col=new THREE.Color();
  const tones=[0x6f8f57,0x66854f,0x77965e,0x5f7c4a];
  const PATCHES=310;
  for(let p=0;p<PATCHES;p++){
    const cx=(Math.random()*2-1)*MAP.x, cz=(Math.random()*2-1)*MAP.z;
    const blades=6+((Math.random()*7)|0);
    for(let b=0;b<blades;b++){
      const a=Math.random()*Math.PI*2, r=Math.random()*1.6;
      const x=cx+Math.cos(a)*r, z=cz+Math.sin(a)*r;
      dummy.position.set(x,terrainHeight(x,z),z);
      dummy.rotation.y=Math.random()*Math.PI;
      dummy.rotation.z=(Math.random()-0.5)*0.3;
      const sc=0.55+Math.random()*0.5; dummy.scale.set(sc,sc,sc);
      dummy.updateMatrix();
      col.setHex(tones[(Math.random()*tones.length)|0]).offsetHSL(0,0,(Math.random()-0.5)*0.04);
      mats.push([dummy.matrix.clone(),col.clone()]);
    }
  }
  const bladeGeo=new THREE.PlaneGeometry(0.22,0.5);
  bladeGeo.translate(0,0.25,0);
  { const n=bladeGeo.attributes.normal;                 // v128: skyward normals — see undergrowth()
    for(let i=0;i<n.count;i++)n.setXYZ(i,0,1,0); n.needsUpdate=true; }
  const inst=new THREE.InstancedMesh(bladeGeo,
    new THREE.MeshLambertMaterial({side:THREE.DoubleSide}),mats.length);
  for(let i=0;i<mats.length;i++){inst.setMatrixAt(i,mats[i][0]);inst.setColorAt(i,mats[i][1]);}
  inst.instanceMatrix.needsUpdate=true;
  if(inst.instanceColor)inst.instanceColor.needsUpdate=true;
  inst.castShadow=false; inst.receiveShadow=false;
  inst.frustumCulled=false; // v128: see the note in undergrowth() — this layer was half-invisible too
  scene.add(inst);
})();

// ---------- FORESTS: the wood economy ----------
// v114 THE GREAT WOOD. Two problems with the v34 tree: it stood 5.5 units tall next to a
// 4.43-unit nutcracker (a "forest" you could see over), and it was a GROUP OF THREE MESHES —
// so a map flush with trees meant thousands of draw calls. Both are fixed here:
//   · trees now stand ~13 units — three times a soldier, tall enough to ride a knight under
//   · every tree is ONE vertex-coloured mesh built from a handful of pre-merged geometries,
//     so a tree costs a single draw call and the whole forest shares one material
// Every tree is still a real, choppable wood node — John's call over an instanced backdrop.
function _mergeColored(parts){ // parts: [{geo, matrix, color}] -> one vertex-coloured BufferGeometry
  // (r128 ships BufferGeometryUtils as a separate file the game doesn't load, so merge by hand)
  let n=0;
  const bufs=parts.map(p=>{
    const g=(p.geo.index?p.geo.toNonIndexed():p.geo.clone());
    // applyMatrix4 transforms the NORMALS too (via the normal matrix), so the cones keep the
    // smooth shading ConeGeometry gave them. Recomputing normals here flat-shades every facet
    // and the canopy reads as pale mint instead of forest green.
    g.applyMatrix4(p.matrix);
    n+=g.attributes.position.count;
    return {g,c:new THREE.Color(p.color)};
  });
  const pos=new Float32Array(n*3), nor=new Float32Array(n*3), col=new Float32Array(n*3);
  let o=0;
  for(const {g,c} of bufs){
    const k=g.attributes.position.count;
    pos.set(g.attributes.position.array,o*3);
    nor.set(g.attributes.normal.array,o*3);
    for(let i=0;i<k;i++){col[(o+i)*3]=c.r;col[(o+i)*3+1]=c.g;col[(o+i)*3+2]=c.b;}
    o+=k;
  }
  const out=new THREE.BufferGeometry();
  out.setAttribute("position",new THREE.BufferAttribute(pos,3));
  out.setAttribute("normal",new THREE.BufferAttribute(nor,3));
  out.setAttribute("color",new THREE.BufferAttribute(col,3));
  out.computeBoundingSphere();
  return out;
}
const TREE_MAT=new THREE.MeshLambertMaterial({vertexColors:true});
const TREE_GEOS=[], STUMP_GEOS=[], TREE_H=[];
// ONE dial for how tall the wood stands, the way OXSCALE is one dial for the cart. At 1.30 the
// average tree is ~13.3 units against a 4.43-unit nutcracker — three times a soldier's height.
const TREE_SCALE=1.30;
(function buildTreeGeometries(){ // eight silhouettes, built once, shared by every tree on the map
  // needles run a shade under the v34 cones: a tiered canopy catches far more of the hemisphere
  // light than two smooth cones did, so the same hex read noticeably paler against the grass
  const BARK=[0x6b4a2b,0x60422a,0x745232], NEEDLE=[0x355f2b,0x305828,0x3b6731,0x2d5232];
  const M=(x,y,z,sx,sy,sz)=>new THREE.Matrix4().compose(
    new THREE.Vector3(x,y,z),new THREE.Quaternion(),new THREE.Vector3(sx===undefined?1:sx,sy===undefined?1:sy,sz===undefined?1:sz));
  for(let v=0;v<8;v++){
    const h=(4.2+Math.random()*1.9)*TREE_SCALE; // the bole (was a 1.8-2.7 stick)
    const rT=(0.34+Math.random()*0.1)*TREE_SCALE, rB=rT*1.45;
    const bark=BARK[v%BARK.length], needle=NEEDLE[v%NEEDLE.length];
    const parts=[{geo:new THREE.CylinderGeometry(rT,rB,h,6),matrix:M(0,h/2,0),color:bark}];
    // three tiers of canopy, each narrower and shorter than the one below
    const tiers=3+(v%2), base=h*0.62;
    let r=(2.6+Math.random()*0.5)*TREE_SCALE, ch=(3.4+Math.random()*0.7)*TREE_SCALE, y=base+ch*0.5;
    for(let t=0;t<tiers;t++){
      const c=new THREE.Color(needle); c.offsetHSL(0,0,t*0.022); // upper tiers catch more light
      parts.push({geo:new THREE.ConeGeometry(r,ch,7),matrix:M(0,y,0),color:c.getHex()});
      y+=ch*0.46; r*=0.74; ch*=0.82;
    }
    TREE_GEOS.push(_mergeColored(parts));
    TREE_H.push(y+ch*0.5);
    // the stump left when the tree is felled — same bole, cut off at the knees
    STUMP_GEOS.push(_mergeColored([
      {geo:new THREE.CylinderGeometry(rB*0.94,rB,h*0.2,6),matrix:M(0,h*0.1,0),color:bark},
      {geo:new THREE.CylinderGeometry(rB*0.9,rB*0.9,0.12,6),matrix:M(0,h*0.2,0),color:0xc2b191}])); // pale sawn top
  }
})();
function makeTree(x,z){
  const v=(Math.random()*TREE_GEOS.length)|0;
  const m=new THREE.Mesh(TREE_GEOS[v],TREE_MAT);
  const sc=0.86+Math.random()*0.34;             // no two trees quite the same height
  const ny=terrainHeight(x,z);
  m.position.set(x,ny,z); m.rotation.y=Math.random()*6.28; m.scale.setScalar(sc);
  m.castShadow=true; m.receiveShadow=false;
  // v128.1: NO OUTLINE ON TREES, and the smoketest is why. `v114 draw budget` asserts that a tree
  // is ONE mesh sharing pre-built geometry — an invariant written when a forest of three-mesh trees
  // was costing thousands of draw calls — and a hull child breaks it by doubling the forest.
  // The check went red the moment I added one, which is exactly what it is for.
  // The RIGHT fix is to bake the hull into the merged geometry itself: _mergeColored already welds
  // several geometries into one vertex-coloured buffer, so an inside-out, normal-expanded copy of
  // the canopy and trunk with black vertex colours would give every tree an outline for ZERO extra
  // draw calls — vertices instead of calls, which is the same trade v114 made in the first place.
  // That is a real piece of work and it is the next thing to do here, not a line to sneak in.
  scene.add(m); worldDeco.push(m);
  const node={type:"wood",x,z,y:ny,amount:140,mesh:m,r:1.5,gv:v,th:TREE_H[v]*sc,canopy:null,trunk:null};
  nodes.push(node);
  return node;
}
function depleteNode(n){
  if(n.type==="wood"&&n.gv!==undefined){ // felled: swap the whole tree for its stump
    n.mesh.geometry=STUMP_GEOS[n.gv]; n.mesh.castShadow=false;
  }else if(n.type==="wood"&&n.canopy){   // (legacy shape — kept so old saves/tests don't crash)
    for(const c of n.canopy)c.visible=false;
    n.trunk.scale.y=0.22; n.trunk.position.y=n.th*0.11;
  }else n.mesh.visible=false;
}
// ---------- planting: the map runs flush with forest, minus the ground the game needs ----------
// Clear lanes matter more than coverage: a wood node blocks building placement (validFor
// refuses anything within r+3 of a live node), so the base yards, the King's Road and the
// bazaar plazas stay open or you couldn't build, march or trade.
const TREE_CLEAR_BASE=52;   // both town-centre yards — room for a full build-out
const TREE_CLEAR_ROAD=21;   // the King's Road corridor stays marchable
const TREE_CLEAR_BAZAAR=15; // trade plazas
const TREE_CLEAR_NODE=8;    // don't bury the stone/gold/berry nodes
// dist2() lives in 04-units.js, which loads AFTER this file — separate <script> tags don't
// share hoisting, so world generation needs its own squared-distance helper.
const _d2=(ax,az,bx,bz)=>{const dx=ax-bx,dz=az-bz;return dx*dx+dz*dz;};
// v114b FORESTS, NOT WOODLAND PASTURE. The first pass planted a jittered grid — one tree every
// 11.5 units over the whole map. From the ground it read as forest, but from above it was uniform
// scrub with no character: no stands to fight through, no meadows to fight in, and wood was
// underfoot everywhere instead of being somewhere you GO. Trees are now grown from a field of
// forest STANDS: density falls off from each stand's centre, so the map gets real woods with open
// country between them, plus a thin scatter of lone trees so the meadows aren't sterile.
const TREE_STANDS=[];
(function plantForests(){
  const ROADPTS=[]; for(let i=0;i<=60;i++)ROADPTS.push(roadPoint(i/60));
  const clearOf=(x,z)=>{
    for(const t of TCPOS)if(_d2(x,z,t[0],t[1])<TREE_CLEAR_BASE*TREE_CLEAR_BASE)return false;
    for(const p of ROADPTS)if(_d2(x,z,p.x,p.z)<TREE_CLEAR_ROAD*TREE_CLEAR_ROAD)return false;
    for(const m of neutralMarkets)if(_d2(x,z,m.x,m.z)<TREE_CLEAR_BAZAAR*TREE_CLEAR_BAZAAR)return false;
    for(const n of nodes)if(n.type!=="wood"&&_d2(x,z,n.x,n.z)<TREE_CLEAR_NODE*TREE_CLEAR_NODE)return false;
    return true;
  };
  // Every stand is placed ONCE and mirrored through the map's centre, (x,z) -> (-x,-z) — the same
  // 180° symmetry the two thrones sit on, so neither team can ever draw the better wood.
  const stand=(x,z,r)=>{TREE_STANDS.push({x,z,r},{x:-x,z:-z,r});};
  stand(148,48,31); stand(122,-58,28);   // THE HOME WOODS: timber inside every team's reach
  // three stands sit deliberately ON the v113 flanking lanes (07-ai's LANE_Z = 0, ±46, ±88 — keep
  // these in step if those move), so a band that swings wide moves through real cover
  stand(64,46,30); stand(120,88,26); stand(18,-88,29);
  // ...and the rest of the wild wood wherever it fits, no two stands sitting on top of each other
  let guard=0;
  while(TREE_STANDS.length<30&&guard++<6000){
    const x=6+Math.random()*(MAP.x-36), z=(Math.random()*2-1)*(MAP.z-28), r=23+Math.random()*21;
    if(!clearOf(x,z))continue;
    let clash=false;
    // 0.8 keeps stands genuinely separate — at 0.42 they merged back into one blurred sheet
    for(const s of TREE_STANDS)if(_d2(x,z,s.x,s.z)<Math.pow(r+s.r,2)*0.8){clash=true;break;}
    if(!clash)stand(x,z,r);
  }
  const STEP=7.4, EDGE=4, LONE=0.03; // 3% of open country carries a lone tree — meadows stay open
  for(let gx=-MAP.x+EDGE;gx<=MAP.x-EDGE;gx+=STEP){
    for(let gz=-MAP.z+EDGE;gz<=MAP.z-EDGE;gz+=STEP){
      const x=gx+(Math.random()-0.5)*STEP*0.9, z=gz+(Math.random()-0.5)*STEP*0.9;
      if(Math.abs(x)>MAP.x-EDGE||Math.abs(z)>MAP.z-EDGE)continue;
      if(!clearOf(x,z))continue;
      let dens=0;
      for(const s of TREE_STANDS){
        const dd=Math.sqrt(_d2(x,z,s.x,s.z));
        if(dd<s.r)dens=Math.max(dens,1-Math.pow(dd/s.r,3.2)); // solid to the heart, ragged only at the eaves
      }
      dens=Math.min(1,dens*1.45+LONE);
      if(Math.random()>dens)continue;
      makeTree(x,z);
    }
  }
})();

// ==================== SCENIC LAYER (v34) ====================
// Everything below is cosmetic, castShadow-free, and distance-culled via worldDeco.
// keep the mountain frame OUT of the creep camp pockets — each camp sits in a carved nook
function nearCamp(x,z,pad){
  for(const C of CAMPS){const dx=x-C.x,dz=z-C.z;if(dx*dx+dz*dz<(C.r+pad)*(C.r+pad))return true;}
  return false;
}
(function mountainRing(){ // the world's frame: snow-capped peaks over green foothills
  // v128: cold blue-grey peaks are the single most desaturating thing on the horizon of a lush
  // map — they read as a storm front behind a summer meadow. Warmed toward stone-and-moss so the
  // frame belongs to the same picture as the field it surrounds.
  const rockMats=[texturedMat("hide",0x7d7f6e),texturedMat("hide",0x8b8c78),texturedMat("hide",0x6d7060)];
  const hillMats=[texturedMat("hide",0x4a6a3c),texturedMat("hide",0x55663d)];
  const snowMat=mat(0xe8ecf0);
  const hazeMats=[mat(0x8b939e),mat(0x99a1ab)]; // the far range fades toward the sky
  const ring=(ox,oz)=>{ // walk the rectangle perimeter
    const pts=[];
    const X=MAP.x+ox, Z=MAP.z+oz;
    for(let x=-X;x<=X;x+=15+Math.random()*6){pts.push([x,-Z]);pts.push([x,Z]);}
    for(let z=-Z;z<=Z;z+=15+Math.random()*6){pts.push([-X,z]);pts.push([X,z]);}
    return pts;
  };
  for(const [x,z] of ring(16,14)){ // the tall back range
    if(nearCamp(x,z,10))continue;  // the pass stays open where a camp nests
    const h=13+Math.random()*11, r=8+Math.random()*6;
    const peak=new THREE.Mesh(new THREE.ConeGeometry(r,h,5+((Math.random()*3)|0)),
      rockMats[(Math.random()*rockMats.length)|0]);
    peak.position.set(x+(Math.random()-0.5)*7,h*0.42,z+(Math.random()-0.5)*7);
    peak.rotation.y=Math.random()*Math.PI;
    peak.castShadow=false; scene.add(peak); worldDeco.push(peak);
    if(h>17){ // the tall ones wear snow
      const cap=new THREE.Mesh(new THREE.ConeGeometry(r*0.45,h*0.3,5),snowMat);
      cap.position.set(peak.position.x,h*0.78,peak.position.z);
      cap.rotation.y=peak.rotation.y; cap.castShadow=false; scene.add(cap); worldDeco.push(cap);
    }
  }
  for(const [x,z] of ring(38,32)){ // the FAR RANGE: taller, hazier, half-lost in the fog
    if(Math.random()<0.3)continue;
    if(nearCamp(x,z,6))continue;
    const h=22+Math.random()*14, r=13+Math.random()*7;
    const far=new THREE.Mesh(new THREE.ConeGeometry(r,h,5),hazeMats[(Math.random()*2)|0]);
    far.position.set(x+(Math.random()-0.5)*10,h*0.42,z+(Math.random()-0.5)*10);
    far.rotation.y=Math.random()*Math.PI;
    far.castShadow=false; scene.add(far); worldDeco.push(far);
    const cap=new THREE.Mesh(new THREE.ConeGeometry(r*0.5,h*0.32,5),snowMat);
    cap.position.set(far.position.x,h*0.76,far.position.z);
    cap.rotation.y=far.rotation.y; cap.castShadow=false; scene.add(cap); worldDeco.push(cap);
  }
  for(const [x,z] of ring(7,6)){ // green foothills in front, sparser
    if(Math.random()<0.45)continue;
    if(nearCamp(x,z,8))continue;
    const h=4.5+Math.random()*4, r=5+Math.random()*3.5;
    const hill=new THREE.Mesh(new THREE.ConeGeometry(r,h,6),hillMats[(Math.random()*2)|0]);
    hill.position.set(x+(Math.random()-0.5)*5,h*0.4,z+(Math.random()-0.5)*5);
    hill.castShadow=false; scene.add(hill); worldDeco.push(hill);
  }
})();
(function kingsRoad(){ // a winding dirt road from throne to throne — the "hold the road" band's home
  const N=52;
  for(let i=0;i<=N;i++){
    const rp=roadPoint(i/N); // the ONE course — the bazaars sit on the same curve
    const seg=drapedDecal(2.1+Math.random()*0.8,8,i%2?0x9a8464:0x8a7454,rp.x,rp.z,0.06,"hide"); // rutted dirt
    scene.add(seg); worldDeco.push(seg);
  }
})();
(function ponds(){ // still water, sandy rims, reeds and cattails
  for(const [px,pz,pr] of [[-105,82,6.5],[98,-88,7],[-24,-104,5.5]]){
    const y=terrainHeight(px,pz);
    const rim=new THREE.Mesh(new THREE.CircleGeometry(pr+1.3,10),mat(0xcbb488));
    rim.rotation.x=-Math.PI/2; rim.position.set(px,y+0.04,pz); rim.castShadow=false; scene.add(rim); worldDeco.push(rim);
    const water=new THREE.Mesh(new THREE.CircleGeometry(pr,10),
      new THREE.MeshLambertMaterial({color:0x4a7a9c}));
    water.rotation.x=-Math.PI/2; water.position.set(px,y+0.09,pz); water.castShadow=false; scene.add(water); worldDeco.push(water);
    for(let i=0;i<2;i++){ // lily pads
      const pad=new THREE.Mesh(new THREE.CircleGeometry(0.55,6),mat(0x5f8a3e));
      pad.rotation.x=-Math.PI/2;
      pad.position.set(px+(Math.random()-0.5)*pr,y+0.12,pz+(Math.random()-0.5)*pr);
      pad.castShadow=false; scene.add(pad); worldDeco.push(pad);
    }
    for(let i=0;i<9;i++){ // reeds and cattails around the bank
      const a=Math.random()*Math.PI*2, rr=pr+0.5+Math.random()*1.2;
      const rx=px+Math.cos(a)*rr, rz=pz+Math.sin(a)*rr;
      const reed=cyl(0.045,0.06,1.0+Math.random()*0.6,0x4a6a30,4);
      reed.position.set(rx,terrainHeight(rx,rz)+0.55,rz);
      reed.rotation.z=(Math.random()-0.5)*0.25; reed.castShadow=false; scene.add(reed); worldDeco.push(reed);
      if(i%3===0){const tail=cyl(0.09,0.09,0.3,0x6b4a2b,4);
        tail.position.set(rx,terrainHeight(rx,rz)+1.35,rz); tail.castShadow=false; scene.add(tail); worldDeco.push(tail);}
    }
  }
})();
(function wildflowers(){ // instanced blossoms in drifts — nearly free
  const tones=[0xd23c5f,0xe8e2d0,0x9a5fd2,0xe0b32e];
  const items=[]; const dummy=new THREE.Object3D(); const col=new THREE.Color();
  for(let p=0;p<16;p++){
    const cx=(Math.random()*2-1)*(MAP.x-24), cz=(Math.random()*2-1)*(MAP.z-20);
    for(let f=0;f<8;f++){
      const a=Math.random()*Math.PI*2, r=Math.random()*3.2;
      const x=cx+Math.cos(a)*r, z=cz+Math.sin(a)*r;
      dummy.position.set(x,terrainHeight(x,z)+0.16,z);
      dummy.rotation.x=-Math.PI/2+((Math.random()-0.5)*0.4);
      const sc=0.7+Math.random()*0.6; dummy.scale.set(sc,sc,sc);
      dummy.updateMatrix();
      col.setHex(tones[(Math.random()*tones.length)|0]);
      items.push([dummy.matrix.clone(),col.clone()]);
    }
  }
  const geo=new THREE.CircleGeometry(0.2,5);
  const inst=new THREE.InstancedMesh(geo,new THREE.MeshLambertMaterial({side:THREE.DoubleSide}),items.length);
  for(let i=0;i<items.length;i++){inst.setMatrixAt(i,items[i][0]);inst.setColorAt(i,items[i][1]);}
  inst.instanceMatrix.needsUpdate=true;
  if(inst.instanceColor)inst.instanceColor.needsUpdate=true;
  inst.castShadow=false; inst.frustumCulled=false; scene.add(inst); // v128: same culling trap
})();
(function rocksAndLogs(){ // boulder clusters and mossy deadfall
  for(let c=0;c<8;c++){
    const cx=(Math.random()*2-1)*(MAP.x-30), cz=(Math.random()*2-1)*(MAP.z-24);
    const n=2+((Math.random()*2)|0);
    for(let i=0;i<n;i++){
      const b=new THREE.Mesh(new THREE.DodecahedronGeometry(0.5+Math.random()*0.7),
        mat(i%2?0x8d949c:0x757c85));
      const bx=cx+(Math.random()-0.5)*3, bz=cz+(Math.random()-0.5)*3;
      b.position.set(bx,terrainHeight(bx,bz)+0.3,bz);
      b.rotation.set(Math.random(),Math.random(),Math.random());
      b.castShadow=false; scene.add(b); worldDeco.push(b);
    }
  }
  for(let i=0;i<6;i++){
    const lx=(Math.random()*2-1)*(MAP.x-36), lz=(Math.random()*2-1)*(MAP.z-28);
    const log=cyl(0.32,0.38,2.4+Math.random()*1.2,0x6b4a2b,6);
    log.rotation.z=Math.PI/2; log.rotation.y=Math.random()*Math.PI;
    log.position.set(lx,terrainHeight(lx,lz)+0.34,lz);
    log.castShadow=false; scene.add(log); worldDeco.push(log);
    const moss=drapedDecal(0.5,6,0x5f8a3e,lx+0.6,lz+0.4,0.06);
    scene.add(moss); worldDeco.push(moss);
  }
})();
// ---------- creep camp grounds (v77): six wild nooks bumped out past the border ----------
(function creepCampGrounds(){
  for(const C of CAMPS){
    if(C.boss)continue; // the raid shore gets its own scene below
    // worn earth: a big trampled dirt disc, then a darker inner ring
    scene.add(drapedDecal(C.r-1.5,16,0x8a7454,C.x,C.z,0.05,"hide"));
    scene.add(drapedDecal(4.2,10,0x6f5a40,C.x,C.z,0.07));
    // fire pit at the heart — the chest will appear here
    const y=terrainHeight(C.x,C.z);
    const g=new THREE.Group();
    for(let i=0;i<5;i++){const st=new THREE.Mesh(new THREE.DodecahedronGeometry(0.28+Math.random()*0.14),mat(0x757c85));
      const a=i/5*Math.PI*2; st.position.set(Math.cos(a)*0.85,0.2,Math.sin(a)*0.85); st.castShadow=false; g.add(st);}
    const ember=new THREE.Mesh(new THREE.CylinderGeometry(0.5,0.6,0.16,8),mat(0x3a2a1c)); ember.position.y=0.1; ember.castShadow=false; g.add(ember);
    const flame=new THREE.Mesh(new THREE.ConeGeometry(0.32,0.9,6),new THREE.MeshBasicMaterial({color:0xe0762e})); flame.position.y=0.6; g.add(flame);
    const flame2=new THREE.Mesh(new THREE.ConeGeometry(0.16,0.55,5),new THREE.MeshBasicMaterial({color:0xffd24a})); flame2.position.y=0.75; g.add(flame2);
    // gnawed bones and a skull post — fair warning
    for(let i=0;i<7;i++){const bx=C.x+(Math.random()-0.5)*C.r*1.4,bz=C.z+(Math.random()-0.5)*C.r*1.4;
      const bone=cyl(0.07,0.07,0.7+Math.random()*0.4,0xe8e4d8,4);
      bone.rotation.z=Math.PI/2; bone.rotation.y=Math.random()*Math.PI;
      bone.position.set(bx-C.x,terrainHeight(bx,bz)-y+0.12,bz-C.z); bone.castShadow=false; g.add(bone);}
    const post=cyl(0.12,0.14,2.2,0x6b4a2b,5); post.position.set(3.2,1.1,-2.6); post.castShadow=false; g.add(post);
    const skull=new THREE.Mesh(new THREE.SphereGeometry(0.3,6,5),mat(0xe8e4d8)); skull.position.set(3.2,2.35,-2.6); skull.castShadow=false; g.add(skull);
    // a rough palisade arc on the OUTWARD side — frames the hollow against the peaks
    const away=Math.atan2(C.x,C.z); // direction from map center, roughly outward
    for(let k=-7;k<=7;k++){
      const a=away+k*0.11, rr=C.r-0.8;
      const sx=Math.sin(a)*rr, sz=Math.cos(a)*rr;
      const stake=cyl(0.16,0.22,2.6+Math.random()*0.8,0x5a4028,5);
      stake.position.set(sx,terrainHeight(C.x+sx,C.z+sz)-y+1.2,sz);
      stake.rotation.x=(Math.random()-0.5)*0.14; stake.rotation.z=(Math.random()-0.5)*0.14;
      stake.castShadow=false; g.add(stake);
    }
    g.position.set(C.x,y,C.z); scene.add(g);
    worldDeco.push(g);
  }
})();
// ---------- THE SOUTHERN SHORE (v79): the raid boss camp — beach, ocean, wrecked longship ----------
(function raidShore(){
  const C=CAMPS.find(c=>c.boss); if(!C)return;
  const y=terrainHeight(C.x,C.z);
  // SAND: a broad pale strand filling the pocket, streaked with lighter drifts
  scene.add(drapedDecal(C.r-1,18,0xd9c48f,C.x,C.z,0.05,"hide"));
  for(let i=0;i<6;i++){
    const a=Math.random()*Math.PI*2, rr=Math.random()*(C.r-6);
    scene.add(drapedDecal(2.5+Math.random()*3.5,8,Math.random()<0.5?0xe2d0a2:0xcbb488,
      C.x+Math.cos(a)*rr,C.z+Math.sin(a)*rr,0.07));
  }
  // OCEAN: still water south of the strand, with foam lines lapping the sand
  const sea=new THREE.Mesh(new THREE.PlaneGeometry(C.r*4.2,50),
    new THREE.MeshLambertMaterial({color:0x4a7a9c}));
  sea.rotation.x=-Math.PI/2; sea.position.set(C.x,0.09,C.z-C.r-12); sea.castShadow=false; sea.receiveShadow=false; scene.add(sea);
  const deep=new THREE.Mesh(new THREE.PlaneGeometry(C.r*4.8,28),
    new THREE.MeshLambertMaterial({color:0x3a6584}));
  deep.rotation.x=-Math.PI/2; deep.position.set(C.x,0.07,C.z-C.r-36); deep.castShadow=false; scene.add(deep);
  for(let i=0;i<3;i++){ // foam arcs where the tide dies
    const foam=new THREE.Mesh(new THREE.TorusGeometry(C.r*0.62+i*9,0.32,4,30,Math.PI*0.85),
      new THREE.MeshBasicMaterial({color:0xe8ecf0,transparent:true,opacity:0.5-i*0.12}));
    foam.rotation.x=-Math.PI/2; foam.rotation.z=Math.PI*1.08;
    foam.position.set(C.x,0.12,C.z-C.r+6); foam.castShadow=false; scene.add(foam); worldDeco.push(foam);
  }
  // THE WRECK: a massive beached longship, keeled over into the sand
  const W=new THREE.Group();
  const oakD=texturedMat("wood",0x4e3a26), oakL=texturedMat("wood",0x6b4a2b);
  // hull: stacked, narrowing strakes — clinker-built the blocky way
  for(let s=0;s<4;s++){
    const half=new THREE.Mesh(new THREE.BoxGeometry(3.6-s*0.5,0.75,20-s*1.6),s%2?oakL:oakD);
    half.position.y=1.1+s*0.62; half.castShadow=true; W.add(half);
  }
  const keel=new THREE.Mesh(new THREE.BoxGeometry(0.5,0.8,22),oakD); keel.position.y=0.55; keel.castShadow=false; W.add(keel);
  // the BREACH: the hull torn open amidships — ribs jut from the wound
  const hole=new THREE.Mesh(new THREE.BoxGeometry(3.9,1.5,4.2),plainMat(0x1c1410));
  hole.position.set(0,1.7,2.5); W.add(hole);
  for(let i=0;i<4;i++){const rib=new THREE.Mesh(new THREE.BoxGeometry(0.18,1.8+Math.random()*0.7,0.22),oakD);
    rib.position.set((i%2?1.5:-1.5),2.3,1.2+i*0.9); rib.rotation.z=(i%2?1:-1)*(0.5+Math.random()*0.3); rib.castShadow=false; W.add(rib);}
  // dragon prow rearing at the bow
  const neck=new THREE.Mesh(new THREE.CylinderGeometry(0.34,0.5,3.4,6),oakD);
  neck.position.set(0,3.4,9.4); neck.rotation.x=0.5; neck.castShadow=true; W.add(neck);
  const dhead=new THREE.Mesh(new THREE.BoxGeometry(0.7,0.7,1.3),oakD); dhead.position.set(0,4.9,10.1); W.add(dhead);
  const jaw=new THREE.Mesh(new THREE.BoxGeometry(0.5,0.22,0.9),oakL); jaw.position.set(0,4.55,10.5); W.add(jaw);
  for(const s of [-1,1]){const horn=cone(0.1,0.55,0xe8e4d8,4); horn.position.set(s*0.25,5.4,9.8); horn.rotation.z=s*0.4; horn.castShadow=false; W.add(horn);}
  const stern=new THREE.Mesh(new THREE.CylinderGeometry(0.3,0.44,2.6,6),oakD);
  stern.position.set(0,3.1,-9.6); stern.rotation.x=-0.55; stern.castShadow=false; W.add(stern);
  // snapped mast, fallen across the gunwale, dragging its tattered sail
  const mast=new THREE.Mesh(new THREE.CylinderGeometry(0.28,0.34,11,7),oakL);
  mast.position.set(2.6,3.6,-1); mast.rotation.z=1.15; mast.rotation.x=0.25; mast.castShadow=true; W.add(mast);
  const stump=new THREE.Mesh(new THREE.CylinderGeometry(0.3,0.36,2.2,7),oakL);
  stump.position.set(0,3.2,-1); stump.castShadow=false; W.add(stump);
  const sail=new THREE.Mesh(new THREE.PlaneGeometry(6.5,4.2,4,3),
    new THREE.MeshLambertMaterial({color:0xb8b2a0,side:THREE.DoubleSide}));
  {const pa=sail.geometry.attributes.position; // wind-torn: ragged, draped verts
   for(let i=0;i<pa.count;i++){pa.setZ(i,Math.sin(i*1.7)*0.5);if(pa.getY(i)<-1.4&&(i%3===0))pa.setY(i,pa.getY(i)+0.9);}
   sail.geometry.computeVertexNormals();}
  sail.position.set(4.6,2.6,-1); sail.rotation.set(0.5,0.5,0.9); sail.castShadow=false; W.add(sail);
  // red-and-white war shields down the surviving gunwale
  for(let i=0;i<5;i++){
    const sh=new THREE.Mesh(new THREE.CylinderGeometry(0.55,0.55,0.14,10),plainMat(i%2?0x8e1f1f:0xd8d2c2));
    sh.rotation.z=Math.PI/2; sh.rotation.y=0.12; sh.position.set(-1.95,2.6,-6.5+i*2.6); sh.castShadow=false; W.add(sh);
    const bossN=new THREE.Mesh(new THREE.SphereGeometry(0.12,5,4),plainMat(0x9aa2ad)); bossN.position.set(-2.08,2.6,-6.5+i*2.6); bossN.castShadow=false; W.add(bossN);
  }
  W.scale.setScalar(1.6); // the wreck grows with its bay — still a colossus on the widened sand
  W.position.set(C.x-7,y,C.z-6);
  W.rotation.y=0.55; W.rotation.z=0.16; // driven ashore at an angle, keeled to port
  scene.add(W); worldDeco.push(W);
  // flotsam: oars, barrels, driftwood, a cold fire ring where the chests will drop
  for(let i=0;i<8;i++){
    const oar=new THREE.Group();
    const shaft=cyl(0.07,0.07,3.4,0x6b4a2b,5); shaft.rotation.z=Math.PI/2; oar.add(shaft);
    const blade=new THREE.Mesh(new THREE.BoxGeometry(0.9,0.05,0.4),oakL); blade.position.x=1.9; oar.add(blade);
    const ox=C.x+(Math.random()-0.5)*C.r*1.6, oz=C.z+(Math.random()-0.5)*C.r*1.1;
    oar.position.set(ox,terrainHeight(ox,oz)+0.15,oz); oar.rotation.y=Math.random()*Math.PI;
    oar.traverse(o=>o.castShadow=false); scene.add(oar); worldDeco.push(oar);
  }
  for(let i=0;i<6;i++){
    const bx=C.x+(Math.random()-0.5)*C.r*1.5, bz=C.z+(Math.random()-0.5)*C.r;
    const bar=cyl(0.42,0.5,0.9,0x7a5230,8); bar.position.set(bx,terrainHeight(bx,bz)+0.45,bz);
    bar.rotation.z=(Math.random()<0.5)?Math.PI/2:0; bar.castShadow=false; scene.add(bar); worldDeco.push(bar);
  }
  const ring=drapedDecal(2.2,8,0x6f5a40,C.x,C.z,0.07); scene.add(ring); // the fire ring — treasure drops here
})();
// ---------- THE TOWN BOARDS (v87): a quest board beside each throne ----------
// Deterministic placement (same spot on host and guest): just outside the TC
// footprint, on the road-facing side, clear of the farm ring's favorite arcs.
(function(){
  for(const team of [BLUE,RED]){
    const sgn=team===BLUE?1:-1; // face inward, toward the Kings Road
    const bx=TCPOS[team][0]+sgn*13, bz=TCPOS[team][1]-8;
    const g=new THREE.Group();
    const postL=new THREE.Mesh(new THREE.CylinderGeometry(0.14,0.17,3.1,6),texturedMat("wood",0x6b4a2b));
    postL.position.set(-1.05,1.55,0); postL.castShadow=true; g.add(postL);
    const postR=postL.clone(); postR.position.x=1.05; g.add(postR);
    const plank=new THREE.Mesh(new THREE.BoxGeometry(2.9,1.7,0.16),texturedMat("wood",0x8a6a3f));
    plank.position.y=2.25; plank.castShadow=true; g.add(plank);
    const roof=new THREE.Mesh(new THREE.BoxGeometry(3.3,0.14,0.9),texturedMat("wood",0x5a4632));
    roof.position.y=3.25; roof.rotation.x=0.18; roof.castShadow=false; g.add(roof);
    for(let i=0;i<3;i++){ // pinned parchments — the quests themselves
      const p=new THREE.Mesh(new THREE.PlaneGeometry(0.62,0.78),
        new THREE.MeshLambertMaterial({color:i===1?0xf0e6c8:0xe6d9b0,side:THREE.DoubleSide}));
      p.position.set(-0.85+i*0.85,2.25+(i%2?0.08:-0.06),0.1); p.rotation.z=(i-1)*0.07; p.castShadow=false; g.add(p);
    }
    const seal=new THREE.Mesh(new THREE.CircleGeometry(0.09,8),
      new THREE.MeshBasicMaterial({color:team===BLUE?0x3d6ef2:0xd94a3d}));
    seal.position.set(0,2.55,0.11); g.add(seal);
    g.position.set(bx,terrainHeight(bx,bz),bz);
    g.rotation.y=sgn>0?Math.PI/2:-Math.PI/2; // parchment face toward the town's heart
    scene.add(g); worldDeco.push(g);
    townBoards.push({team,x:bx,z:bz,mesh:g});
  }
})();
// world gen done — hand Math.random back to the casino
Math.random=__realRandom;

// =============================================================================================
// v128 THE UNDERGROWTH — density, variety, and not one byte of it on the wire
// =============================================================================================
// WHY THIS LIVES DOWN HERE, BELOW THE LINE, WITH ITS OWN GENERATOR:
// everything between `Math.random=mulberry32(...)` and the line above draws from ONE seeded
// stream, and `nodes` — every tree, every ore vein — is built from it. Add or remove a single
// Math.random() call anywhere in that window and every subsequent draw shifts, which moves every
// node position and every node INDEX. That is not a cosmetic problem: the netcode indexes nodes
// by position in a deterministic world build, so a shifted stream means a v127 peer and a v128
// peer disagree about which tree is tree 300 — same bytes, different world. It is precisely why
// v114 had to bump PROTO when the forest was replanted.
// So the undergrowth runs AFTER the handback and draws from its own `sow`. The seeded world is
// untouched, every peer still grows identical foliage, and PROTO stays 26.
//
// It is also all InstancedMesh. The host in John's field logs was at 10–19 fps against ~1,800
// draw calls, so "more foliage" had to mean more INSTANCES, not more objects: the six layers
// below add ~14,000 pieces of greenery for six draw calls and six materials.
(function undergrowth(){
  const sow=mulberry32(0x5EEDF00D);          // its own stream, deterministic across peers
  const R=()=>sow(), RR=(a,b)=>a+sow()*(b-a);
  const dummy=new THREE.Object3D(), col=new THREE.Color();
  // shared toon material per layer — one draw call each
  const leafMat=()=>toonMat({side:THREE.DoubleSide,vertexColors:false});
  // THE ONE TRICK THAT MAKES STYLISED GRASS WORK. A blade is a vertical plane, so its normal
  // points sideways — edge-on to a sun that is almost overhead. Under a toon ramp that is not a
  // slightly darker green, it is a hard drop into the BOTTOM cell, and 9,000 blades render as
  // 9,000 near-black slivers scattered over a bright lawn. (The v34 grass layer has been doing
  // exactly this, unnoticed, for as long as it has existed.) Point every blade normal at the sky
  // instead: the grass then takes the same light as the ground it grows from, reads as one lit
  // surface, and the silhouette still does all the shape work.
  // …but only PART of the way. Snapping the normal fully to +Y hands every blade the maximum the
  // sun has to give, which is just the opposite failure: 20,000 pieces of greenery all pinned to
  // the ramp's top cell, rendering as pale mint confetti. Blending 70% toward the sky keeps them
  // firmly in the lit bands while leaving enough of the real normal that a leaning blade still
  // shades differently from an upright one.
  const SKY_BLEND=0.45; // tuned by eye against renders: 1.0 blows out, 0.7 still reads mint, 0.45 sits in the lawn
  const skyward=g=>{
    const n=g.attributes.normal, v=new THREE.Vector3();
    for(let i=0;i<n.count;i++){
      v.fromBufferAttribute(n,i);
      v.set(v.x*(1-SKY_BLEND),v.y*(1-SKY_BLEND)+SKY_BLEND,v.z*(1-SKY_BLEND)).normalize();
      n.setXYZ(i,v.x,v.y,v.z);
    }
    n.needsUpdate=true; return g;
  };

  function scatter(geo,count,place,opts){
    opts=opts||{};
    const inst=new THREE.InstancedMesh(geo,leafMat(),count);
    for(let i=0;i<count;i++){
      place(i,dummy,col);
      dummy.updateMatrix();
      inst.setMatrixAt(i,dummy.matrix);
      inst.setColorAt(i,col);
    }
    inst.instanceMatrix.needsUpdate=true;
    if(inst.instanceColor)inst.instanceColor.needsUpdate=true;
    inst.castShadow=!!opts.shadow; inst.receiveShadow=false;
    // r128's InstancedMesh does NOT fold the instance matrices into its bounding sphere — the
    // sphere is the BASE geometry's, sitting at the object's origin. So a layer of 9,000 blades
    // spread over a 400-unit map is frustum-tested as a single 1-unit plane at world (0,0,0) and
    // the entire layer blinks out the moment the camera looks away from the middle of the map.
    // That is why the first render of this block showed almost nothing. One draw call each is far
    // too cheap to be worth culling anyway.
    inst.frustumCulled=false;
    scene.add(inst);
    return inst;
  }
  // keep the undergrowth off the roads, the plazas and the two thrones — a lawn growing through
  // the Town Centre's flagstones is the one thing that would read as a bug rather than a garden
  // NOTE the hand-rolled distance: `dist2()` lives in 04-units.js, which loads AFTER this file,
  // and separate <script> tags do not hoist across each other. There is a comment saying exactly
  // this ~400 lines up, and calling dist2 here still threw `dist2 is not defined` at load —
  // silently, because the whole IIFE died and simply produced no foliage at all.
  // The Kings Road CURVES — roadPoint() carries two sine terms — so the straight z-band this used
  // to test missed the bends, and `v114 clear lanes` duly reported undergrowth growing through the
  // highway. Walk the actual polyline instead.
  const ROAD=[]; for(let i=0;i<=40;i++)ROAD.push(roadPoint(i/40));
  const clear=(x,z)=>{
    for(const t of TCPOS){const dx=x-t[0],dz=z-t[1];if(dx*dx+dz*dz<34*34)return false;}
    for(const r of ROAD){const dx=x-r.x,dz=z-r.z;if(dx*dx+dz*dz<9*9)return false;}
    return true;
  };
  const spot=(spread)=>{ // rejection-sample a legal patch centre
    for(let k=0;k<24;k++){
      const x=(R()*2-1)*(MAP.x-spread), z=(R()*2-1)*(MAP.z-spread);
      if(clear(x,z))return [x,z];
    }
    return null;
  };

  // ---- 1. TUFTED GRASS: the big one. Tall, leaning, in drifts, in FOUR greens ----
  // The v34 layer was 310 patches of 6-12 blades at 0.22×0.5 — about 2,700 slivers spread over a
  // 400×400 map, which is to say invisible. These are twice the size, five times as many, and
  // clumped hard enough to read as undergrowth rather than stubble.
  {
    const TONES=[0x3d6f1e,0x35651a,0x487c26,0x2b5714,0x528a2c]; // v128: dropped hard — skyward normals mean these render a full band brighter than they look here
    const blades=[];
    for(let p=0;p<900;p++){
      const c=spot(6); if(!c)continue;
      const n=7+((R()*10)|0);
      const tone=TONES[(R()*TONES.length)|0];
      for(let b=0;b<n;b++){
        const a=R()*Math.PI*2, r=R()*2.1;
        blades.push([c[0]+Math.cos(a)*r,c[1]+Math.sin(a)*r,tone]);
      }
    }
    const g=skyward(new THREE.PlaneGeometry(0.34,1.05)); g.translate(0,0.52,0);
    scatter(g,blades.length,(i,d,c)=>{
      const [x,z,tone]=blades[i];
      d.position.set(x,terrainHeight(x,z),z);
      d.rotation.set((R()-0.5)*0.12,R()*Math.PI,(R()-0.5)*0.38); // the lean is what sells it
      const s=0.7+R()*0.75; d.scale.set(s,s*(0.8+R()*0.5),s);
      c.setHex(tone).offsetHSL(0,(R()-0.5)*0.07,(R()-0.5)*0.09);
    });
  }
  // ---- 2. CLOVER MATS: flat rosettes that fill the ground plane between the blades ----
  {
    const pts=[];
    for(let p=0;p<420;p++){
      const c=spot(5); if(!c)continue;
      const n=5+((R()*7)|0);
      for(let b=0;b<n;b++){const a=R()*Math.PI*2,r=R()*1.7;pts.push([c[0]+Math.cos(a)*r,c[1]+Math.sin(a)*r]);}
    }
    const g=new THREE.CircleGeometry(0.3,6); g.rotateX(-Math.PI/2); // smaller: big flat discs caught full sun and read as bleached patches
    scatter(g,pts.length,(i,d,c)=>{
      const [x,z]=pts[i];
      d.position.set(x,terrainHeight(x,z)+0.05,z);
      d.rotation.set(0,R()*Math.PI,0);
      const s=0.7+R()*0.8; d.scale.set(s,1,s);
      c.setHex(R()<0.5?0x336618:0x3d7220).offsetHSL(0,(R()-0.5)*0.06,(R()-0.5)*0.07);
    });
  }
  // ---- 3. BUSHES: rounded low-poly shrubs, the mid-height layer the map never had ----
  {
    const pts=[];
    for(let p=0;p<210;p++){
      const c=spot(10); if(!c)continue;
      const n=1+((R()*3)|0);
      for(let b=0;b<n;b++){const a=R()*Math.PI*2,r=R()*2.6;pts.push([c[0]+Math.cos(a)*r,c[1]+Math.sin(a)*r]);}
    }
    const g=new THREE.IcosahedronGeometry(1.0,0);
    scatter(g,pts.length,(i,d,c)=>{
      const [x,z]=pts[i];
      d.position.set(x,terrainHeight(x,z)+0.62,z);
      d.rotation.set(R()*0.5,R()*Math.PI,R()*0.5);
      d.scale.set(0.85+R()*0.9,0.62+R()*0.5,0.85+R()*0.9); // squashed: shrubs, not boulders
      c.setHex([0x2c5a1a,0x33661f,0x254c14,0x3a7024][(R()*4)|0]).offsetHSL(0,(R()-0.5)*0.05,(R()-0.5)*0.06);
    },{shadow:true});
  }
  // ---- 4. FERNS: tall thin fans that break the silhouette at the forest edge ----
  {
    const pts=[];
    for(let p=0;p<260;p++){
      const c=spot(6); if(!c)continue;
      const n=3+((R()*4)|0);
      for(let b=0;b<n;b++){const a=R()*Math.PI*2,r=R()*1.5;pts.push([c[0]+Math.cos(a)*r,c[1]+Math.sin(a)*r]);}
    }
    const g=skyward(new THREE.ConeGeometry(0.55,1.5,4,1,true)); g.translate(0,0.75,0);
    scatter(g,pts.length,(i,d,c)=>{
      const [x,z]=pts[i];
      d.position.set(x,terrainHeight(x,z),z);
      d.rotation.set((R()-0.5)*0.2,R()*Math.PI,(R()-0.5)*0.2);
      const s=0.7+R()*0.7; d.scale.set(s*1.15,s,s*1.15);
      c.setHex([0x27500f,0x2f5c18,0x20440b][(R()*3)|0]).offsetHSL(0,(R()-0.5)*0.05,(R()-0.5)*0.06);
    });
  }
  // ---- 5. BLOSSOM DRIFTS: five hues, in beds, at a size you can actually see ----
  // (the v34 wildflower layer is still there; this sits alongside it and does the heavy lifting)
  {
    const TONES=[0xff5d7a,0xffd93d,0xf7f4ea,0xb56cf0,0xff9a3d];
    const pts=[];
    for(let p=0;p<150;p++){
      const c=spot(8); if(!c)continue;
      const tone=TONES[(R()*TONES.length)|0];
      const n=9+((R()*14)|0);
      for(let b=0;b<n;b++){const a=R()*Math.PI*2,r=R()*3.4;pts.push([c[0]+Math.cos(a)*r,c[1]+Math.sin(a)*r,tone]);}
    }
    const g=new THREE.CircleGeometry(0.3,5); g.rotateX(-Math.PI/2);
    scatter(g,pts.length,(i,d,c)=>{
      const [x,z,tone]=pts[i];
      d.position.set(x,terrainHeight(x,z)+0.3,z);
      d.rotation.set((R()-0.5)*0.5,R()*Math.PI,(R()-0.5)*0.5);
      const s=0.8+R()*0.7; d.scale.set(s,s,s);
      c.setHex(tone).offsetHSL(0,0,(R()-0.5)*0.05);
    });
  }
  // ---- 6. STALKS: a few thousand single tall blades, scattered map-wide, no clumping ----
  // Clumped foliage leaves bald ground between the drifts. This is the thin wash over everything
  // that stops the lawn ever looking empty, and at one draw call it is effectively free.
  {
    const pts=[];
    for(let i=0;i<3200;i++){
      const x=(R()*2-1)*MAP.x, z=(R()*2-1)*MAP.z;
      if(clear(x,z))pts.push([x,z]);
    }
    const g=skyward(new THREE.PlaneGeometry(0.2,0.8)); g.translate(0,0.4,0);
    scatter(g,pts.length,(i,d,c)=>{
      const [x,z]=pts[i];
      d.position.set(x,terrainHeight(x,z),z);
      d.rotation.set(0,R()*Math.PI,(R()-0.5)*0.3);
      const s=0.7+R()*0.8; d.scale.set(s,s,s);
      c.setHex([0x3f7320,0x36661a,0x497e28][(R()*3)|0]).offsetHSL(0,(R()-0.5)*0.06,(R()-0.5)*0.08);
    });
  }
})();
