/* REGICIDE PVP — 04-units.js */
// ---------- units ----------
let UID=0;

// small helper: a limb group pivoted at its top (shoulder/hip), mesh hanging below
function limb(w,h,d,c,px,py,pz){ // tapered organic limb, pivoted at the top joint
  const g=new THREE.Group(); g.position.set(px,py,pz);
  const mtl=(c&&c.isMaterial)?c:mat(c);
  const m=new THREE.Mesh(new THREE.CylinderGeometry(w*0.62,w*0.42,h,7),mtl);
  m.position.y=-h/2; m.castShadow=false; g.add(m);
  return g;
}
function endCap(parent,r,mtl,y){ // hand / hoof at a limb's end
  const m=new THREE.Mesh(new THREE.SphereGeometry(r,6,5),mtl);
  m.position.y=y; m.castShadow=false; parent.add(m); return m;
}
function limb2(rT,rM,rB,hU,hL,mtl,px,py,pz){ // articulated: upper pivots at joint, lower at elbow/knee
  const upper=new THREE.Group(); upper.position.set(px,py,pz);
  const cap=new THREE.Mesh(new THREE.SphereGeometry(rT*1.02,7,6),mtl);
  cap.castShadow=false; upper.add(cap); // rounded top: the limb flows out of the body
  const um=new THREE.Mesh(new THREE.CylinderGeometry(rT,rM,hU,7),mtl);
  um.position.y=-hU/2; um.castShadow=false; upper.add(um);
  const lower=new THREE.Group(); lower.position.y=-hU;
  const joint=new THREE.Mesh(new THREE.SphereGeometry(rM*1.06,6,5),mtl);
  joint.castShadow=false; lower.add(joint);
  const lm=new THREE.Mesh(new THREE.CylinderGeometry(rM*0.95,rB,hL,7),mtl);
  lm.position.y=-hL/2; lm.castShadow=false; lower.add(lm);
  upper.add(lower);
  return {upper,lower};
}

const _noSh=m=>{m.castShadow=false;return m;};
// v113 THE OX CART's size lives HERE, as one number. The rig is modelled at 1:1 and hung off a
// single scaled group, so this scales the beast, the wain, the load, the wheel roll rate AND the
// health-bar / name-tag heights together. (Shipped at 2.5 first; John called it down to 1.7.)
const OXSCALE=1.7;
const OX_BAR_Y=()=>2.9*OXSCALE+1.0;  // just clear of the banner top
const OX_TAG_Y=()=>OX_BAR_Y()+0.9;
function wheelGroup(r,w,color,spokes){ // axle along X; spin the returned group about X
  const G=new THREE.Group();
  const rimGeo=new THREE.CylinderGeometry(r,r,w,10,1,true); rimGeo.rotateZ(Math.PI/2);
  const rim=new THREE.Mesh(rimGeo,texturedMat("wood",color)); rim.castShadow=false; G.add(rim);
  const tyreGeo=new THREE.TorusGeometry(r,w*0.42,5,12); tyreGeo.rotateY(Math.PI/2);
  const tyre=new THREE.Mesh(tyreGeo,plainMat(0x3a3a42)); tyre.castShadow=false; G.add(tyre); // iron tyre
  const hubGeo=new THREE.CylinderGeometry(r*0.24,r*0.24,w*1.5,7); hubGeo.rotateZ(Math.PI/2);
  const hub=new THREE.Mesh(hubGeo,plainMat(0x4a3826)); hub.castShadow=false; G.add(hub);
  const n=spokes||6;
  for(let i=0;i<n;i++){
    const sp=new THREE.Mesh(new THREE.BoxGeometry(w*0.5,r*1.86,r*0.14),texturedMat("wood",color));
    sp.rotation.x=i*Math.PI/n; sp.castShadow=false; G.add(sp);
  }
  G.userData.rr=2.75/r; // roll rate scales with radius (halved: stately, not frantic)
  return G;
}
function kitStoneAge(R,tc){ // STONE: pelt, bone charms, team loincloth, hide cap
  const pelt=new THREE.Mesh(new THREE.BoxGeometry(0.5,1.1,0.62),texturedMat("hide",0x6b4a2b));
  pelt.position.set(-0.28,0.85,0); pelt.rotation.z=0.3; pelt.castShadow=false; R.torso.add(pelt);
  for(let i=0;i<3;i++){const bone=new THREE.Mesh(new THREE.BoxGeometry(0.07,0.16,0.05),plainMat(0xe8e4d8));
    bone.position.set(-0.16+i*0.16,1.02,0.42); bone.castShadow=false; R.torso.add(bone);}
  const clothF=_noSh(box(0.36,0.46,0.07,tc)); clothF.position.set(0,0.0,0.3); R.torso.add(clothF);
  const clothB=_noSh(box(0.36,0.42,0.07,tc)); clothB.position.set(0,0.02,-0.3); R.torso.add(clothB);
  const cap=_noSh(new THREE.Mesh(new THREE.SphereGeometry(0.56,8,6,0,Math.PI*2,0,Math.PI*0.5),texturedMat("hide",0x7a5230)));
  cap.position.y=0.72; R.head.add(cap);
  const fur=_noSh(cyl(0.58,0.61,0.16,0x5a3c22,9)); fur.position.y=0.72; R.head.add(fur);
  const tailH=_noSh(box(0.13,0.4,0.1,0x5a3c22)); tailH.position.set(0,0.86,-0.52); tailH.rotation.x=0.5; R.head.add(tailH);
}
function kitDendra(R,tc){ // BRONZE: the Dendra panoply + boar's-tusk helm
  const bronze=texturedMat("metal",0xb08a3f), bronzeD=texturedMat("metal",0x9a7532);
  for(let i=0;i<3;i++){
    const hoop=new THREE.Mesh(new THREE.CylinderGeometry(0.57,0.6,0.21,10),i%2?bronze:bronzeD);
    hoop.scale.z=0.8; hoop.position.y=0.36+i*0.23; hoop.castShadow=false; R.torso.add(hoop);
  }
  for(const sx of [-0.5,0.5]){
    const sg=new THREE.Mesh(new THREE.SphereGeometry(0.3,8,6,0,Math.PI*2,0,Math.PI*0.55),bronze);
    sg.position.set(sx,1.0,0); sg.scale.set(1.15,0.75,1.1); sg.castShadow=false; R.torso.add(sg);
  }
  const gorget=new THREE.Mesh(new THREE.CylinderGeometry(0.5,0.55,0.14,10),bronzeD);
  gorget.scale.z=0.75; gorget.position.y=1.06; gorget.castShadow=false; R.torso.add(gorget);
  const tuskDome=_noSh(cone(0.52,0.8,0xd8c9a2,9)); tuskDome.position.y=1.02; R.head.add(tuskDome);
  for(let i=0;i<3;i++){const row=_noSh(cyl(0.47-i*0.09,0.5-i*0.09,0.09,0xf0ead8,9));
    row.position.y=0.76+i*0.24; R.head.add(row);}
  const knob=_noSh(new THREE.Mesh(new THREE.SphereGeometry(0.09,6,5),plainMat(0xf0ead8))); knob.position.y=1.48; R.head.add(knob);
  const tuft=_noSh(cone(0.09,0.42,tc,5)); tuft.position.set(0,1.52,-0.12); tuft.rotation.x=0.45; R.head.add(tuft);
}
function kitSkinsArcher(R,tc,fancy){ // BRONZE/IRON: skins, wool, linen, metal charms, team kilt, leather cap
  const wrap=_noSh(box(0.34,0.8,0.06,0x9a8a6a)); wrap.rotation.z=0.5; wrap.position.set(0,0.6,0.42); R.torso.add(wrap); // wool wrap
  const linen=_noSh(box(0.5,0.3,0.05,0xd8cdb4)); linen.position.set(0,0.28,0.44); R.torso.add(linen); // linen band
  const kilt=new THREE.Mesh(new THREE.CylinderGeometry(0.56,0.63,0.45,10),texturedMat("cloth",tc));
  kilt.scale.z=0.8; kilt.position.y=-0.02; kilt.castShadow=false; R.torso.add(kilt); // the team kilt
  const belt=new THREE.Mesh(new THREE.CylinderGeometry(0.55,0.55,0.14,10),texturedMat("cloth",0x9a6a2e));
  belt.scale.z=0.8; belt.position.y=0.24; belt.castShadow=false; R.torso.add(belt); // woven belt
  const toggle=_noSh(box(0.1,0.18,0.06,0xe8e4d8)); toggle.position.set(0,0.24,0.45); R.torso.add(toggle); // bone toggle
  const torc=_noSh(new THREE.Mesh(new THREE.TorusGeometry(0.2,0.045,4,8,Math.PI),plainMat(fancy?0xd9a92e:0xb08a3f)));
  torc.rotation.x=Math.PI/2+0.3; torc.position.set(0,1.02,0.3); R.torso.add(torc); // metal torc
  const band=_noSh(cyl(0.19,0.19,0.09,fancy?0xd9a92e:0xb08a3f,7)); band.position.y=-0.26; R.armR.add(band); // armband
  const cap=_noSh(new THREE.Mesh(new THREE.SphereGeometry(0.54,8,6,0,Math.PI*2,0,Math.PI*0.5),texturedMat("hide",0x7a5230)));
  cap.position.y=0.74; R.head.add(cap); // the leather cap
  const stitch=_noSh(cyl(0.55,0.56,0.09,fancy?0xd9a92e:0x5a3c22,9)); stitch.position.y=0.72; R.head.add(stitch);
  if(fancy){ // the Improved Archer earns his bronze
    const band2=_noSh(cyl(0.19,0.19,0.09,0xd9a92e,7)); band2.position.y=-0.26; R.armL.add(band2);
    const disc=_noSh(cyl(0.16,0.16,0.05,0xb08a3f,8)); disc.rotation.x=Math.PI/2; disc.position.set(0,0.78,0.46); R.torso.add(disc);
    const hemG=new THREE.Mesh(new THREE.CylinderGeometry(0.635,0.635,0.06,10),plainMat(0xd9a92e));
    hemG.scale.z=0.8; hemG.position.y=-0.22; hemG.castShadow=false; R.torso.add(hemG);
    for(let i=0;i<3;i++){const stud=_noSh(new THREE.Mesh(new THREE.SphereGeometry(0.04,4,4),plainMat(0xd9a92e)));
      stud.position.set(-0.2+i*0.2,0.95,0.38); R.head.add(stud);}
  }
}
function kitLamellar(R,tc){ // IRON: laced lamellar rows + the Negau bell helm
  const iron=texturedMat("metal",0x7d858f), ironD=texturedMat("metal",0x687079);
  for(let i=0;i<4;i++){
    const row=new THREE.Mesh(new THREE.CylinderGeometry(0.555,0.58,0.165,10),i%2?iron:ironD);
    row.scale.z=0.8; row.position.y=0.32+i*0.18; row.castShadow=false; R.torso.add(row);
  }
  for(let i=0;i<5;i++){
    const pl=_noSh(box(0.09,0.62,0.03,0x565e68)); pl.position.set(-0.32+i*0.16,0.6,0.455); R.torso.add(pl);
  }
  const bell=_noSh(new THREE.Mesh(new THREE.SphereGeometry(0.55,9,7,0,Math.PI*2,0,Math.PI*0.52),iron));
  bell.position.y=0.8; bell.scale.y=1.2; R.head.add(bell);
  const ridge=_noSh(box(0.09,0.18,0.72,0x9aa2ad)); ridge.position.y=1.44; R.head.add(ridge);
  const brimN=_noSh(cyl(0.6,0.63,0.07,0x687079,10)); brimN.position.y=0.78; R.head.add(brimN);
  const tuft=_noSh(cone(0.09,0.42,tc,5)); tuft.position.set(0,1.5,-0.16); tuft.rotation.x=0.5; R.head.add(tuft);
}
function weaponGrip(fa,rotX,z){ // hand-anchored weapon group: pieces stack along +Y, grip at y=0
  // +PI flips the stack axis so +Y points down-forward — the classic carry — instead of up-backward
  const g=new THREE.Group(); g.position.set(0,-0.52,z===undefined?0.15:z);
  g.rotation.x=rotX+Math.PI; fa.add(g); return g;
}
function buildBodyFor(u){
  // v122 THE LEAK THAT CRASHED THE PHONE. This removed the old body's children and never DISPOSED
  // them. Three.js does not free GPU buffers on remove(), so every class change, every arm-up and
  // every respawn-as-a-different-unit orphaned ~25-40 BufferGeometries on the GPU. Across 100 bots
  // dying and re-arming through six ages, a 30-45 minute match leaked tens of thousands — which is
  // exactly when John's iPhone went white and reloaded to the main menu (iOS killing the tab under
  // memory pressure). 03-buildings has always disposed its geometry on restyle; units never did.
  //
  // MATERIALS are deliberately left alone: they come from the _skinCache and are shared by every
  // unit that wears them, so disposing one would blank half the army.
  // MODEL-BACKED bodies are also skipped: SkeletonUtils.clone() SHARES geometry with the loaded
  // glTF, so disposing a clone's buffers would destroy MODELS[cls] for everyone.
  if(!u._modelBody){
    for(const c of u.body.children)c.traverse(o=>{if(o.geometry)o.geometry.dispose();});
  }
  u._modelBody=false;
  while(u.body.children.length)u.body.remove(u.body.children[0]);
  u.body.scale.setScalar(1); // giants (vikingboss 1.45x) must not leak their size into a rebuilt class
  u.mixer=null; u.actions=null; u.curAction=null; u.rig=null;

  // external glTF model takes over if one is registered + loaded for this class
  if(tryAttachModel(u)){
    refreshBar(u);
    return;
  }

  const d=CLS[u.cls], tc=TEAMCOL[u.team];
  const R=u.rig={};
  if(d.rig==="cart"){ // v113 THE MARKET MULE: a real mule in harness, hauling a merchant's wagon
    // Was a grey box on four sticks — John's placeholder call. Rebuilt on the DESTRIER anatomy
    // (barrel + chest + rump, neck-and-head on a pivot, jointed legs with knees and hooves) so it
    // reads as an animal, then muled: shorter, stockier, long ears, dun coat, mealy muzzle.
    u.rigBaseY=0;
    const MG=new THREE.Group(); MG.scale.setScalar(0.62); MG.position.set(0,0,1.45); u.body.add(MG); R.horseG=MG;
    const coat=[0x8d8578,0x9a8f7c,0x7e766a,0xa39682][u.id%4], dark=0x5d564c, mealy=0xd6cdba;
    const hideM=texturedMat("hide",coat), darkM=plainMat(dark);
    const barrel=new THREE.Mesh(new THREE.CylinderGeometry(0.94,0.86,2.7,9),hideM);
    barrel.rotation.x=Math.PI/2; barrel.scale.x=0.8; barrel.position.y=2.45; barrel.castShadow=true; MG.add(barrel);
    const chest=new THREE.Mesh(new THREE.SphereGeometry(0.96,8,7),hideM);
    chest.scale.set(0.84,1.0,0.95); chest.position.set(0,2.5,1.2); chest.castShadow=false; MG.add(chest);
    const rump=new THREE.Mesh(new THREE.SphereGeometry(0.96,8,7),hideM); // the mule's famously round quarters
    rump.scale.set(0.84,1.04,1.05); rump.position.set(0,2.52,-1.2); rump.castShadow=false; MG.add(rump);
    const belly=_noSh(new THREE.Mesh(new THREE.SphereGeometry(0.72,7,6),plainMat(mealy)));
    belly.scale.set(0.72,0.5,1.5); belly.position.set(0,1.86,-0.1); MG.add(belly); // mealy underside
    const NG=new THREE.Group(); NG.position.set(0,2.86,1.1); MG.add(NG); R.horseNeck=NG;
    const neck=new THREE.Mesh(new THREE.CylinderGeometry(0.34,0.6,1.55,8),hideM);
    neck.position.set(0,0.48,0.5); neck.rotation.x=0.62; NG.add(neck);
    const head=new THREE.Mesh(new THREE.BoxGeometry(0.5,0.58,0.92),hideM); head.position.set(0,1.24,1.02); head.rotation.x=0.3; NG.add(head);
    const muzzle=_noSh(new THREE.Mesh(new THREE.BoxGeometry(0.38,0.4,0.5),plainMat(mealy))); muzzle.position.set(0,1.02,1.5); NG.add(muzzle);
    const nose=_noSh(box(0.3,0.12,0.1,dark)); nose.position.set(0,0.94,1.72); NG.add(nose);
    for(const ex of [-0.15,0.15]){
      const eye=_noSh(new THREE.Mesh(new THREE.SphereGeometry(0.07,5,4),plainMat(0x14100c)));
      eye.position.set(ex*1.55,1.36,1.28); NG.add(eye);
      const ear=_noSh(new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.13,0.86,5),hideM)); // THE EARS: a mule's signature
      ear.position.set(ex,2.1,0.68); ear.rotation.set(-0.18,0,ex>0?0.16:-0.16); NG.add(ear);
      const inner=_noSh(new THREE.Mesh(new THREE.CylinderGeometry(0.03,0.07,0.6,4),plainMat(0x40382f)));
      inner.position.set(ex*1.02,2.06,0.76); inner.rotation.copy(ear.rotation); NG.add(inner);
    }
    const bridle=_noSh(box(0.54,0.09,0.1,0x4a3320)); bridle.position.set(0,1.2,1.28); NG.add(bridle);
    const brow=_noSh(box(0.14,0.34,0.4,0x3a2f22)); brow.position.set(0,1.66,0.92); brow.rotation.x=0.3; NG.add(brow); // clipped mane tuft
    const tail=new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.16,1.15,5),plainMat(0x3a3128));
    tail.position.set(0,2.4,-2.1); tail.rotation.x=2.85; tail.castShadow=false; MG.add(tail);
    R.horseLegs=[]; // jointed, but they TROT in diagonal pairs — a draught animal never gallops
    for(const [lx,lz,front] of [[-0.46,1.0,1],[0.46,1.0,1],[-0.46,-1.05,0],[0.46,-1.05,0]]){
      const hip=new THREE.Group(); hip.position.set(lx,2.34,lz); MG.add(hip);
      const thigh=new THREE.Mesh(new THREE.BoxGeometry(0.38,1.1,0.46),hideM); thigh.position.y=-0.46; thigh.castShadow=false; hip.add(thigh);
      const knee=new THREE.Group(); knee.position.y=-1.0; hip.add(knee);
      const cap=_noSh(new THREE.Mesh(new THREE.SphereGeometry(0.19,6,5),plainMat(0x6a6154))); knee.add(cap);
      const shank=new THREE.Mesh(new THREE.BoxGeometry(0.22,0.95,0.26),plainMat(0x554d43)); shank.position.y=-0.48; shank.castShadow=false; knee.add(shank);
      const fetlock=_noSh(new THREE.Mesh(new THREE.SphereGeometry(0.12,5,4),plainMat(0x453e35))); fetlock.position.y=-0.92; knee.add(fetlock);
      const hoof=_noSh(box(0.3,0.26,0.38,0x2b2118)); hoof.position.set(0,-1.02,0.04); knee.add(hoof);
      hip.userData.knee=knee; hip.userData.front=front; hip.userData.trot=1;
      R.horseLegs.push(hip);
    }
    // ---- harness: breast-collar, traces and hames, the whole reason it pulls ----
    const collar=_noSh(new THREE.Mesh(new THREE.TorusGeometry(0.58,0.13,5,10),texturedMat("hide",0x5a3f28)));
    collar.position.set(0,2.62,1.42); collar.rotation.x=0.42; MG.add(collar);
    for(const s of [-1,1]){
      const trace=_noSh(box(0.09,0.09,2.5,0x4a3320)); trace.position.set(s*0.72,2.5,-0.3); MG.add(trace);
      const hame=_noSh(box(0.1,0.6,0.1,0x8a7a4a)); hame.position.set(s*0.5,2.95,1.3); hame.rotation.z=s*0.3; MG.add(hame);
    }
    const pad=_noSh(new THREE.Mesh(new THREE.BoxGeometry(1.1,0.18,0.9),texturedMat("cloth",tc))); pad.position.set(0,3.16,0.1); MG.add(pad); // team saddle-pad
    // ---- THE WAGON: shafts, plank bed, staked sides, a canvas tilt and the merchant's cargo ----
    const woodM=texturedMat("wood",0x8a6a3f), woodD=texturedMat("wood",0x6b4a2b);
    for(const s of [-1,1]){
      const shaft=new THREE.Mesh(new THREE.BoxGeometry(0.11,0.11,2.5),woodM); shaft.position.set(s*0.46,1.12,0.75); shaft.castShadow=false; u.body.add(shaft);
    }
    const bed=new THREE.Mesh(new THREE.BoxGeometry(1.8,0.26,2.3),woodM); bed.position.set(0,1.02,-0.85); bed.castShadow=true; u.body.add(bed);
    for(let i=0;i<4;i++){const plank=_noSh(new THREE.Mesh(new THREE.BoxGeometry(0.38,0.06,2.25),woodD)); plank.position.set(-0.66+i*0.44,1.17,-0.85); u.body.add(plank);}
    for(const s of [-1,1]){ // side boards + corner stakes
      const side=_noSh(new THREE.Mesh(new THREE.BoxGeometry(0.1,0.52,2.3),woodD)); side.position.set(s*0.88,1.4,-0.85); u.body.add(side);
      for(const sz of [0.2,-1.9]){const stake=_noSh(box(0.11,0.86,0.11,0x5a4632)); stake.position.set(s*0.88,1.6,sz); u.body.add(stake);}
    }
    const tailgate=_noSh(new THREE.Mesh(new THREE.BoxGeometry(1.8,0.52,0.1),woodD)); tailgate.position.set(0,1.4,-1.95); u.body.add(tailgate);
    for(let i=0;i<4;i++){ // the canvas tilt: four hoops under a stretched cover
      const hoop=_noSh(new THREE.Mesh(new THREE.TorusGeometry(0.86,0.045,4,9,Math.PI),plainMat(0x6b5a3f)));
      hoop.position.set(0,1.5,0.05-i*0.62); hoop.rotation.y=Math.PI/2; u.body.add(hoop);
    }
    const tilt=new THREE.Mesh(new THREE.CylinderGeometry(0.9,0.9,2.1,9,1,true,0,Math.PI),texturedMat("cloth",0xe4dcc4));
    tilt.rotation.z=Math.PI/2; tilt.position.set(0,1.5,-0.85); tilt.castShadow=true; u.body.add(tilt);
    const stripe=_noSh(new THREE.Mesh(new THREE.CylinderGeometry(0.92,0.92,0.22,9,1,true,0,Math.PI),texturedMat("cloth",tc)));
    stripe.rotation.z=Math.PI/2; stripe.position.set(0,1.5,-1.82); u.body.add(stripe); // team band on the tail of the tilt
    const goods=new THREE.Group(); // v99: the cargo shows only when the cart is LOADED
    for(const [gx,gz] of [[-0.42,-0.4],[0.42,-0.4],[0,-1.15]]){ // amphorae + a spice sack
      const jar=_noSh(new THREE.Mesh(new THREE.CylinderGeometry(0.14,0.22,0.5,7),plainMat(0xb07a46)));
      jar.position.set(gx,1.45,gz); goods.add(jar);
      const neckJ=_noSh(new THREE.Mesh(new THREE.CylinderGeometry(0.08,0.08,0.16,6),plainMat(0x9a6a3a)));
      neckJ.position.set(gx,1.76,gz); goods.add(neckJ);
    }
    const chest2=_noSh(new THREE.Mesh(new THREE.BoxGeometry(0.72,0.4,0.6),woodD)); chest2.position.set(0,1.38,-1.55); goods.add(chest2);
    const lid=_noSh(box(0.76,0.14,0.64,0xe0a92e)); lid.position.set(0,1.62,-1.55); goods.add(lid); // the gold showing over the rim
    const sack=_noSh(new THREE.Mesh(new THREE.SphereGeometry(0.3,6,5),texturedMat("cloth",0xc9bd8a)));
    sack.scale.set(1,0.8,1.1); sack.position.set(-0.35,1.5,-1.2); goods.add(sack);
    u.body.add(goods); R.goods=goods; goods.visible=false;
    const pole=_noSh(cyl(0.045,0.045,1.5,0x5a4632,5)); pole.position.set(0,2.0,-1.98); u.body.add(pole);
    const banner=_noSh(new THREE.Mesh(new THREE.BoxGeometry(0.62,0.42,0.04),texturedMat("cloth",tc))); banner.position.set(0.31,2.5,-1.98); u.body.add(banner);
    const lantern=_noSh(box(0.16,0.22,0.16,0xffd98a)); lantern.position.set(0.72,1.86,0.18); u.body.add(lantern); // a trader's lamp on the near stake
    R.wheels=[];
    for(const [wx,wz,wr] of [[-1.0,-1.5,0.56],[1.0,-1.5,0.56],[-0.86,0.35,0.38],[0.86,0.35,0.38]]){
      const W=wheelGroup(wr,0.14,0x5a4632,wr>0.5?8:6); W.position.set(wx,wr,wz); // big behind, small on the steering axle
      u.body.add(W); R.wheels.push(W);
    }
    refreshBar(u);
    return;
  }
  if(d.rig==="oxcart"){ // v113 THE OX CART, rebuilt: a real yoked ox dragging a timber wain
    // v99's version was a stack of boxes. John's call: 2.5× the size and give it some pizazz.
    // Everything hangs off ONE scaled group so the size is a single number to tune (OXSCALE),
    // and the ox itself now shares the destrier's anatomy — barrel, jointed legs, hoofed feet —
    // with the mass pushed forward into shoulders and a zebu hump.
    u.rigBaseY=0;
    const OX=new THREE.Group(); OX.scale.setScalar(OXSCALE); u.body.add(OX); // OXSCALE is module-level
    const hide=0x6b4a33, dark=0x54382a, muzz=0x9a7a5f, horn=0xe8dcc0;
    const hideM=texturedMat("hide",hide), darkM=plainMat(dark);
    // ---- the beast ----
    const OG=new THREE.Group(); OG.position.set(0,0,0.62); OX.add(OG); R.horseG=OG;
    const barrel=new THREE.Mesh(new THREE.CylinderGeometry(0.62,0.56,1.7,9),hideM);
    barrel.rotation.x=Math.PI/2; barrel.scale.x=0.9; barrel.position.y=1.24; barrel.castShadow=true; OG.add(barrel);
    const fore=new THREE.Mesh(new THREE.SphereGeometry(0.66,8,7),hideM); // massive draught shoulders
    fore.scale.set(0.92,1.0,0.9); fore.position.set(0,1.3,0.78); fore.castShadow=false; OG.add(fore);
    const hindq=new THREE.Mesh(new THREE.SphereGeometry(0.58,8,7),hideM);
    hindq.scale.set(0.9,1.0,0.98); hindq.position.set(0,1.24,-0.82); hindq.castShadow=false; OG.add(hindq);
    const humpM=new THREE.Mesh(new THREE.SphereGeometry(0.42,8,7),texturedMat("hide",dark)); // the zebu hump
    humpM.scale.set(0.72,0.86,1.05); humpM.position.set(0,1.86,0.6); humpM.castShadow=false; OG.add(humpM);
    const dewlap=_noSh(new THREE.Mesh(new THREE.BoxGeometry(0.26,0.5,0.72),texturedMat("hide",dark)));
    dewlap.position.set(0,0.92,1.06); dewlap.rotation.x=0.22; OG.add(dewlap); // the loose throat fold
    // The head hangs FORWARD and LOW off the withers — an ox carries its skull below the shoulder
    // line, which is what separates its silhouette from a horse's.
    const NG=new THREE.Group(); NG.position.set(0,1.42,1.06); OG.add(NG); R.horseNeck=NG;
    const neck=new THREE.Mesh(new THREE.CylinderGeometry(0.4,0.56,0.85,8),hideM);
    neck.position.set(0,0.02,0.34); neck.rotation.x=1.24; NG.add(neck); // short, thick, almost horizontal
    const skull=new THREE.Mesh(new THREE.BoxGeometry(0.5,0.46,0.78),hideM); skull.position.set(0,-0.14,0.92); skull.rotation.x=0.1; NG.add(skull);
    const jaw=_noSh(new THREE.Mesh(new THREE.BoxGeometry(0.4,0.24,0.66),hideM)); jaw.position.set(0,-0.38,0.98); NG.add(jaw);
    const snout=_noSh(box(0.4,0.36,0.34,muzz)); snout.position.set(0,-0.26,1.34); NG.add(snout);
    const nostril=_noSh(box(0.3,0.08,0.07,0x3a2b20)); nostril.position.set(0,-0.2,1.5); NG.add(nostril);
    const blaze=_noSh(box(0.15,0.36,0.07,0xe8e2d0)); blaze.position.set(0,0.0,1.28); NG.add(blaze); // white face blaze
    for(const s of [-1,1]){
      const eye=_noSh(new THREE.Mesh(new THREE.SphereGeometry(0.07,5,4),plainMat(0x14100c))); eye.position.set(s*0.24,-0.04,1.16); NG.add(eye);
      const ear=_noSh(new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.13,0.32,5),hideM));
      ear.position.set(s*0.34,0.02,0.7); ear.rotation.z=s*1.2; NG.add(ear);
      // HORNS: a stout base sweeping OUT off the poll, then a short tip hooking UP. Bone, not
      // chalk — the first pass sat too high, too big and too white and read as tusks.
      const hbase=_noSh(new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.1,0.34,6),plainMat(horn)));
      hbase.position.set(s*0.3,0.12,0.78); hbase.rotation.z=s*1.24; NG.add(hbase);
      const htip=_noSh(new THREE.Mesh(new THREE.CylinderGeometry(0.015,0.055,0.3,6),plainMat(0x6b5f4c)));
      htip.position.set(s*0.5,0.26,0.76); htip.rotation.z=s*0.5; NG.add(htip);
    }
    const tail=new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.09,0.9,5),darkM);
    tail.position.set(0,1.2,-1.42); tail.rotation.x=2.9; tail.castShadow=false; OG.add(tail);
    const tuft=_noSh(new THREE.Mesh(new THREE.SphereGeometry(0.13,5,4),plainMat(0x2b2118))); tuft.position.set(0,0.74,-1.62); OG.add(tuft);
    R.horseLegs=[]; // jointed like the destrier, but flagged TROT — an ox plods, it never gallops
    for(const [lx,lz,front] of [[-0.42,0.72,1],[0.42,0.72,1],[-0.4,-0.78,0],[0.4,-0.78,0]]){
      const hip=new THREE.Group(); hip.position.set(lx,1.2,lz); OG.add(hip);
      const thigh=new THREE.Mesh(new THREE.BoxGeometry(0.32,0.6,0.4),hideM); thigh.position.y=-0.26; thigh.castShadow=false; hip.add(thigh);
      const knee=new THREE.Group(); knee.position.y=-0.55; hip.add(knee);
      const cap=_noSh(new THREE.Mesh(new THREE.SphereGeometry(0.16,6,5),plainMat(0x5f4230))); knee.add(cap);
      const shank=new THREE.Mesh(new THREE.BoxGeometry(0.22,0.5,0.24),plainMat(0x4a3426)); shank.position.y=-0.26; shank.castShadow=false; knee.add(shank);
      const hoof=_noSh(box(0.28,0.2,0.32,0x241c14)); hoof.position.set(0,-0.56,0.03); knee.add(hoof);
      const cleft=_noSh(box(0.05,0.21,0.35,0x120e0a)); cleft.position.set(0,-0.56,0.04); knee.add(cleft); // CLOVEN — an ox is not a horse
      hip.userData.knee=knee; hip.userData.front=front; hip.userData.trot=1;
      R.horseLegs.push(hip);
    }
    // ---- the YOKE: a carved beam across the withers, bows under the neck, chained to the pole ----
    const woodM=texturedMat("wood",0x8a6a3f), woodD=texturedMat("wood",0x6b4a2b);
    const yoke=new THREE.Mesh(new THREE.BoxGeometry(1.5,0.18,0.24),woodD); yoke.position.set(0,2.06,1.42); yoke.castShadow=false; OX.add(yoke);
    for(const s of [-1,1]){
      const bow=_noSh(new THREE.Mesh(new THREE.TorusGeometry(0.3,0.055,4,8,Math.PI),plainMat(0x5a4632)));
      bow.position.set(s*0.34,2.0,1.42); bow.rotation.set(Math.PI/2,0,Math.PI); OX.add(bow);
      const strap=_noSh(box(0.1,0.24,0.1,0x4a3320)); strap.position.set(s*0.6,1.94,1.42); OX.add(strap);
    }
    const pole=new THREE.Mesh(new THREE.BoxGeometry(0.14,0.14,2.9),woodM); pole.position.set(0,1.1,0.5); pole.castShadow=false; OX.add(pole);
    for(const s of [-1,1]){ // draught chains from the yoke down to the pole head — short, paired,
      // and dark, instead of the single pale tube that read as a stray pipe over the ox's back
      const chain=_noSh(new THREE.Mesh(new THREE.BoxGeometry(0.06,0.06,0.62),plainMat(0x4a4a52)));
      chain.position.set(s*0.2,1.66,1.14); chain.rotation.x=-0.62; OX.add(chain);
    }
    // ---- THE WAIN: a plank bed on a heavy frame, stake rails, rope lashings, iron-tyred wheels ----
    const frame=new THREE.Mesh(new THREE.BoxGeometry(1.9,0.2,2.5),woodD); frame.position.set(0,0.92,-1.15); frame.castShadow=true; OX.add(frame);
    for(let i=0;i<5;i++){const plank=_noSh(new THREE.Mesh(new THREE.BoxGeometry(0.34,0.08,2.45),woodM)); plank.position.set(-0.76+i*0.38,1.05,-1.15); OX.add(plank);}
    for(const s of [-1,1]){
      const rail=_noSh(new THREE.Mesh(new THREE.BoxGeometry(0.1,0.14,2.45),woodD)); rail.position.set(s*0.95,1.62,-1.15); OX.add(rail);
      for(const sz of [-0.15,-1.15,-2.15]){ // upright stakes holding the load in
        const stake=_noSh(new THREE.Mesh(new THREE.BoxGeometry(0.11,0.72,0.11),woodD)); stake.position.set(s*0.95,1.4,sz); OX.add(stake);
        const iron=_noSh(box(0.13,0.08,0.13,0x4a4a52)); iron.position.set(s*0.95,1.08,sz); OX.add(iron); // stake shoe
      }
    }
    const headboard=_noSh(new THREE.Mesh(new THREE.BoxGeometry(1.9,0.6,0.1),woodD)); headboard.position.set(0,1.38,0.05); OX.add(headboard);
    const tailboard=_noSh(new THREE.Mesh(new THREE.BoxGeometry(1.9,0.5,0.1),woodD)); tailboard.position.set(0,1.33,-2.38); OX.add(tailboard);
    for(const rz of [-0.6,-1.8]){ // rope lashings cinched flat ACROSS the load and hauled down to
      // the rails. (A half-torus here arched fore-and-aft instead — a pale pipe over the whole wain.)
      const rope=_noSh(new THREE.Mesh(new THREE.BoxGeometry(2.0,0.07,0.09),plainMat(0xb8a888)));
      rope.position.set(0,2.12,rz); OX.add(rope);
      for(const s of [-1,1]){
        const drop=_noSh(new THREE.Mesh(new THREE.BoxGeometry(0.07,0.62,0.09),plainMat(0xb8a888)));
        drop.position.set(s*1.0,1.82,rz); OX.add(drop);
      }
    }
    const axeH=_noSh(cyl(0.045,0.045,0.9,0x8a6a3f,5)); axeH.position.set(-1.02,1.3,-1.9); axeH.rotation.x=0.35; OX.add(axeH); // the woodsman's axe rides the rail
    const axeB=_noSh(box(0.1,0.26,0.3,0x9aa2ad)); axeB.position.set(-1.02,1.72,-2.0); OX.add(axeB);
    const pole2=_noSh(cyl(0.05,0.05,1.5,0x5a4632,5)); pole2.position.set(0.72,2.1,-2.42); OX.add(pole2);
    const banner2=_noSh(new THREE.Mesh(new THREE.BoxGeometry(0.66,0.44,0.05),texturedMat("cloth",tc))); banner2.position.set(0.39,2.62,-2.42); OX.add(banner2);
    const logs=new THREE.Group(); // the LOAD: eight logs stacked in a proper pyramid as the haul grows
    for(let li=0;li<8;li++){
      const row=li<3?0:li<6?1:2, inRow=li<3?li:li<6?li-3:li-6, wide=row<2?3:2;
      const lg=new THREE.Mesh(new THREE.CylinderGeometry(0.17,0.15,2.2,7),texturedMat("wood",0x7a5a34));
      lg.rotation.z=Math.PI/2; lg.rotation.y=(Math.random()-0.5)*0.05; lg.castShadow=true;
      lg.position.set(0,1.28+row*0.32,-1.15+(inRow-(wide-1)/2)*0.42);
      for(const be of [-1,1]){ // pale sawn ends — the cylinder's OWN axis is local Y, so the caps
        // ride y=±half-length; putting them on local x parked them above the log instead.
        const bark=_noSh(new THREE.Mesh(new THREE.CylinderGeometry(0.158,0.158,0.1,7),plainMat(0xc2b191)));
        bark.position.y=be*1.06; lg.add(bark);
      }
      logs.add(lg);
    }
    OX.add(logs); R.logs=logs; logs.visible=false;
    R.wheels=[];
    for(const [wx,wz] of [[-1.12,-1.95],[1.12,-1.95],[-1.02,-0.25],[1.02,-0.25]]){
      const back=wz<-1, r=back?0.72:0.5;
      const W=wheelGroup(r,0.2,0x5a4632,back?9:7); W.position.set(wx,r,wz);
      W.userData.rr=2.75/(r*OXSCALE); // wheelGroup sizes the roll rate off the LOCAL radius — correct for the group scale
      OX.add(W); R.wheels.push(W);
    }
    refreshBar(u);
    return;
  }
  if(d.rig==="wolf"){ // WILD WOLF: a lean gray hunter — no humanoid
    u.rigBaseY=0;
    const fur=0x8a8f96, dark=0x6d737c, belly=0xb8bcc2;
    const torso=box(0.62,0.6,1.55,fur); torso.position.set(0,0.95,0); torso.castShadow=true; u.body.add(torso);
    const chest=box(0.7,0.66,0.6,dark); chest.position.set(0,1.0,0.55); u.body.add(chest); // heavy shoulders + ruff
    const under=box(0.5,0.2,1.2,belly); under.position.set(0,0.68,0); under.castShadow=false; u.body.add(under);
    const HD=new THREE.Group(); HD.position.set(0,1.3,0.95); u.body.add(HD); R.head=HD;
    const skull=box(0.46,0.42,0.5,fur); skull.castShadow=false; HD.add(skull);
    const snout=box(0.24,0.22,0.42,dark); snout.position.set(0,-0.06,0.4); snout.castShadow=false; HD.add(snout);
    const nose=box(0.12,0.1,0.08,0x2b2118); nose.position.set(0,-0.02,0.62); nose.castShadow=false; HD.add(nose);
    for(const s of [-1,1]){
      const ear=cone(0.1,0.26,dark,4); ear.position.set(s*0.15,0.32,-0.05); ear.castShadow=false; HD.add(ear);
      const eye=box(0.07,0.06,0.03,0xd8b02e); eye.position.set(s*0.13,0.08,0.26); eye.castShadow=false; HD.add(eye); // amber eyes
    }
    const tail=new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.11,0.85,5),plainMat(dark));
    tail.position.set(0,1.15,-0.95); tail.rotation.x=-2.4; tail.castShadow=false; u.body.add(tail);
    R.horseLegs=[]; // reuse the cart-mule trot: diagonal pairs
    for(const [lx,lz] of [[-0.22,0.55],[0.22,0.55],[-0.22,-0.55],[0.22,-0.55]]){
      const leg=limb(0.15,0.75,0.15,dark,lx,0.95,lz); u.body.add(leg); R.horseLegs.push(leg);
    }
    refreshBar(u); return;
  }
  if(d.rig==="ram"){ // THE BATTERING RAM: an A-framed, hide-roofed engine, log slung on chains
    u.rigBaseY=0;
    const SG=new THREE.Group(); SG.scale.setScalar(2.15); u.body.add(SG);
    const skidL=new THREE.Mesh(new THREE.BoxGeometry(0.3,0.3,3.6),texturedMat("wood",0x6b4a2b)); skidL.position.set(-1.05,0.45,0); skidL.castShadow=true; SG.add(skidL);
    const skidR=skidL.clone(); skidR.position.x=1.05; SG.add(skidR);
    for(const bz of [-1.5,0,1.5]){const cross=new THREE.Mesh(new THREE.BoxGeometry(2.3,0.22,0.26),texturedMat("wood",0x8a6a3f)); cross.position.set(0,0.5,bz); cross.castShadow=false; SG.add(cross);}
    for(const az of [-1.35,-0.45,0.45,1.35])for(const sx of [-1,1]){ // the A-frame pairs
      const legA=new THREE.Mesh(new THREE.BoxGeometry(0.2,2.6,0.24),texturedMat("wood",0x8a6a3f));
      legA.position.set(sx*0.62,1.6,az); legA.rotation.z=sx*0.44; legA.castShadow=false; SG.add(legA);
    }
    const ridge=new THREE.Mesh(new THREE.BoxGeometry(0.24,0.24,3.5),texturedMat("wood",0x5a4632)); ridge.position.set(0,2.75,0); ridge.castShadow=false; SG.add(ridge);
    for(const sx of [-1,1]){ // fresh hides stretched over the frame
      const hide=new THREE.Mesh(new THREE.BoxGeometry(1.7,0.1,3.7),texturedMat("hide",0x8a5a3a));
      hide.position.set(sx*0.58,2.32,0); hide.rotation.z=-sx*0.62; hide.castShadow=true; SG.add(hide);
      const wall=new THREE.Mesh(new THREE.BoxGeometry(0.1,0.85,3.5),texturedMat("hide",0x7a4c30));
      wall.position.set(sx*1.18,1.05,0); wall.castShadow=false; SG.add(wall); // hide walls shield the crew
      for(const hz of [-1.1,0.4]){const strap=new THREE.Mesh(new THREE.BoxGeometry(1.55,0.12,0.14),plainMat(0x4a3320));
        strap.position.set(sx*0.58,2.36,hz); strap.rotation.z=-sx*0.62; strap.castShadow=false; SG.add(strap);}
    }
    const trimH=new THREE.Mesh(new THREE.BoxGeometry(0.3,0.14,3.6),plainMat(tc)); trimH.position.set(0,2.82,0); trimH.castShadow=false; SG.add(trimH);
    R.log=new THREE.Group(); R.log.position.set(0,1.55,0); SG.add(R.log);
    const logM=new THREE.Mesh(new THREE.CylinderGeometry(0.42,0.42,4.6,9),texturedMat("wood",0x6b4a2b));
    logM.rotation.x=Math.PI/2; logM.position.z=-0.1; logM.castShadow=true; R.log.add(logM);
    const ramHead=new THREE.Mesh(new THREE.CylinderGeometry(0.5,0.36,0.7,9),texturedMat("metal",0x7d848d));
    ramHead.rotation.x=Math.PI/2; ramHead.position.z=2.35; ramHead.castShadow=false; R.log.add(ramHead);
    for(const bz of [-1.6,-0.4,0.9]){const bandL=new THREE.Mesh(new THREE.CylinderGeometry(0.46,0.46,0.14,9),plainMat(0x4a4e56));
      bandL.rotation.x=Math.PI/2; bandL.position.z=bz; bandL.castShadow=false; R.log.add(bandL);}
    for(const cz of [-1.4,1.2]){const chain=new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.05,1.15,5),plainMat(0x3a3a42));
      chain.position.set(0,1.1,cz); chain.castShadow=false; SG.add(chain);} // the suspension
    R.wheels=[];
    for(const [wx,wz] of [[-1.25,1.3],[1.25,1.3],[-1.25,-1.3],[1.25,-1.3]]){
      const W=wheelGroup(0.55,0.15,0x5a4632,6); W.position.set(wx,0.55,wz); SG.add(W); R.wheels.push(W);
    }
    refreshBar(u); return;
  }
  if(d.rig==="catapult"||d.rig==="treb"){
    u.rigBaseY=0;
    const tall=d.rig==="treb";
    const SG=new THREE.Group(); SG.scale.setScalar(tall?2.6:2.6); u.body.add(SG);
    if(!tall){ // THE ONAGER: torsion bundle, kicking arm, padded stop
      const skid1=new THREE.Mesh(new THREE.BoxGeometry(0.34,0.34,2.9),texturedMat("wood",0x6b4a2b)); skid1.position.set(-0.75,0.5,0); skid1.castShadow=true; SG.add(skid1);
      const skid2=skid1.clone(); skid2.position.x=0.75; SG.add(skid2);
      for(const bz of [-1.15,0,1.15]){const cross=new THREE.Mesh(new THREE.BoxGeometry(1.85,0.26,0.3),texturedMat("wood",0x8a6a3f)); cross.position.set(0,0.55,bz); cross.castShadow=false; SG.add(cross);}
      const bundle=new THREE.Mesh(new THREE.CylinderGeometry(0.26,0.26,1.7,8),texturedMat("cloth",0x9a8a6a));
      bundle.rotation.z=Math.PI/2; bundle.position.set(0,1.35,0.45); bundle.castShadow=false; SG.add(bundle); // the twisted sinew, raised
      for(const px of [-0.75,0.75]){
        const upA=new THREE.Mesh(new THREE.BoxGeometry(0.22,2.4,0.26),texturedMat("wood",0x7a5a34));
        upA.position.set(px,1.55,-0.32); upA.rotation.x=0.1; upA.castShadow=false; SG.add(upA);
        const capU=new THREE.Mesh(new THREE.BoxGeometry(0.3,0.24,0.34),texturedMat("wood",0x5a4632));
        capU.position.set(px,2.72,-0.44); capU.castShadow=false; SG.add(capU); // the bar sits in these
      }
      const stop=new THREE.Mesh(new THREE.CylinderGeometry(0.16,0.16,1.8,7),texturedMat("hide",0x8a5a3a));
      stop.rotation.z=Math.PI/2; stop.position.set(0,2.72,-0.44); stop.castShadow=false; SG.add(stop); // BOLTED to the uprights
      R.arm=new THREE.Group(); R.arm.position.set(0,1.35,0.45); SG.add(R.arm);
      u.armRest=-0.45;
      const armM=new THREE.Mesh(new THREE.BoxGeometry(0.24,0.26,2.2),texturedMat("wood",0x8a6a3f)); armM.position.z=-0.95; armM.castShadow=true; R.arm.add(armM);
      const spoonCup=new THREE.Mesh(new THREE.CylinderGeometry(0.32,0.2,0.26,8),texturedMat("wood",0x6b4a2b));
      spoonCup.position.set(0,0.1,-1.98); spoonCup.castShadow=false; R.arm.add(spoonCup);
      const stone=new THREE.Mesh(new THREE.DodecahedronGeometry(0.19),plainMat(0x8d949c)); stone.position.set(0,0.26,-1.98); stone.castShadow=false; R.arm.add(stone);
      R.arm.rotation.x=u.armRest;
    }else{ // THE WARWOLF: twin A-frames, long beam, hanging counterweight, sling
      u.armRest=-0.62; // cocked, with the sling swinging clear of the turf
      const skid1=new THREE.Mesh(new THREE.BoxGeometry(0.4,0.4,4.2),texturedMat("wood",0x6b4a2b)); skid1.position.set(-1.05,0.55,0); skid1.castShadow=true; SG.add(skid1);
      const skid2=skid1.clone(); skid2.position.x=1.05; SG.add(skid2);
      for(const bz of [-1.7,0,1.7]){const cross=new THREE.Mesh(new THREE.BoxGeometry(2.5,0.3,0.34),texturedMat("wood",0x8a6a3f)); cross.position.set(0,0.6,bz); cross.castShadow=false; SG.add(cross);}
      for(const sx of [-1.05,1.05])for(const lz of [-1,1]){ // the twin A-frames
        const legT=new THREE.Mesh(new THREE.BoxGeometry(0.26,3.4,0.3),texturedMat("wood",0x7a5a34));
        legT.position.set(sx,2.1,lz*0.85); legT.rotation.x=lz*0.42; legT.castShadow=false; SG.add(legT);
      }
      const axleT=new THREE.Mesh(new THREE.CylinderGeometry(0.14,0.14,2.5,7),plainMat(0x4a3826));
      axleT.rotation.z=Math.PI/2; axleT.position.y=3.55; axleT.castShadow=false; SG.add(axleT);
      for(const sx of [-1.05,1.05]){const brace=new THREE.Mesh(new THREE.BoxGeometry(0.2,0.2,2.3),texturedMat("wood",0x8a6a3f));
        brace.position.set(sx,1.9,0); brace.castShadow=false; SG.add(brace);}
      R.arm=new THREE.Group(); R.arm.position.set(0,3.55,0); SG.add(R.arm);
      const beam=new THREE.Mesh(new THREE.BoxGeometry(0.28,0.3,5.4),texturedMat("wood",0x8a6a3f)); beam.position.z=-1.5; beam.castShadow=true; R.arm.add(beam);
      const cwArm=new THREE.Mesh(new THREE.BoxGeometry(0.34,0.36,1.4),texturedMat("wood",0x7a5a34)); cwArm.position.z=1.5; cwArm.castShadow=false; R.arm.add(cwArm);
      const weight=new THREE.Mesh(new THREE.BoxGeometry(1.15,1.15,1.15),texturedMat("metal",0x4a4e56));
      weight.position.set(0,-0.75,1.9); weight.castShadow=true; R.arm.add(weight); // the hanging box
      for(const wb of [-0.35,0.35]){const bandW=new THREE.Mesh(new THREE.BoxGeometry(1.2,0.14,0.16),plainMat(0x2e2e32));
        bandW.position.set(0,-0.75+wb,1.9); bandW.castShadow=false; R.arm.add(bandW);}
      for(const rx of [-0.07,0.07]){const rope=new THREE.Mesh(new THREE.CylinderGeometry(0.03,0.03,1.3,4),plainMat(0x9a8a6a));
        rope.position.set(rx,-0.32,-4.35); rope.rotation.x=0.35; rope.castShadow=false; R.arm.add(rope);} // slung from the tip
      const pouch=new THREE.Mesh(new THREE.SphereGeometry(0.22,6,5),texturedMat("hide",0x6b4a2b));
      pouch.scale.y=0.7; pouch.position.set(0,-0.85,-4.55); pouch.castShadow=false; R.arm.add(pouch);
      for(const bz of [-2.6,-1.1]){const wrap=new THREE.Mesh(new THREE.BoxGeometry(0.34,0.36,0.16),plainMat(0x2e2e32));
        wrap.position.set(0,0,bz); wrap.castShadow=false; R.arm.add(wrap);} // iron beam bands
      R.arm.rotation.x=u.armRest;
      // --- pizzazz: bracing, winch, pennant, ammo pile ---
      for(const sx of [-1.05,1.05])for(const dg of [-1,1]){
        const brace=new THREE.Mesh(new THREE.BoxGeometry(0.14,2.1,0.16),texturedMat("wood",0x8a6a3f));
        brace.position.set(sx,1.7,0); brace.rotation.x=dg*0.72; brace.castShadow=false; SG.add(brace); // the X-bracing
      }
      for(const sx of [-1.18,1.18]){const capA=new THREE.Mesh(new THREE.CylinderGeometry(0.2,0.2,0.14,7),plainMat(0x4a4e56));
        capA.rotation.z=Math.PI/2; capA.position.set(sx,3.55,0); capA.castShadow=false; SG.add(capA);} // iron axle caps
      const pole=new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.05,1.1,5),texturedMat("wood",0x6b4a2b));
      pole.position.set(0,4.3,0.85); pole.castShadow=false; SG.add(pole);
      const pennant=new THREE.Mesh(new THREE.BoxGeometry(0.7,0.34,0.05),plainMat(tc));
      pennant.position.set(0.35,4.7,0.85); pennant.castShadow=false; SG.add(pennant); // colors at the apex
      const drum=new THREE.Mesh(new THREE.CylinderGeometry(0.24,0.24,1.4,7),texturedMat("wood",0x6b4a2b));
      drum.rotation.z=Math.PI/2; drum.position.set(0,0.95,1.75); drum.castShadow=false; SG.add(drum); // the winch
      for(const hx of [-0.75,0.75]){const crank=new THREE.Mesh(new THREE.BoxGeometry(0.09,0.55,0.09),plainMat(0x4a3826));
        crank.position.set(hx,1.2,1.75); crank.rotation.z=0.5; crank.castShadow=false; SG.add(crank);}
      for(let i=0;i<3;i++){const ammo=new THREE.Mesh(new THREE.DodecahedronGeometry(0.26),plainMat(i%2?0x8d949c:0x7b828b));
        ammo.position.set(-0.5+i*0.5,0.95,-1.6+(i%2)*0.3); ammo.castShadow=false; SG.add(ammo);} // stones waiting
    }
    R.wheels=[];
    for(const [wx,wz] of [[-1.15,1.35],[1.15,1.35],[-1.15,-1.35],[1.15,-1.35]]){
      const W=wheelGroup(0.52,0.14,0x5a4632,6); W.position.set(wx,0.52,wz); SG.add(W); R.wheels.push(W);
    }
    refreshBar(u); return;
  }
  if(d.rig==="cannon"){ // JAIVANA and her long-barrelled sister
    u.rigBaseY=0;
    const culv=u.cls==="culverin";
    const SG=new THREE.Group(); SG.scale.setScalar(culv?2.45:2.65); R.gunSG=SG; u.body.add(SG);
    for(const sx of [-0.42,0.42]){ // the carriage cheeks
      const cheek=new THREE.Mesh(new THREE.BoxGeometry(0.18,0.85,2.1),texturedMat("wood",0x5a4632));
      cheek.position.set(sx,0.85,-0.35); cheek.castShadow=true; SG.add(cheek);
      const sun=new THREE.Mesh(new THREE.CylinderGeometry(0.2,0.2,0.05,9),plainMat(0xd9a92e));
      sun.rotation.z=Math.PI/2; sun.position.set(sx*1.6,1.0,-0.7); sun.castShadow=false; SG.add(sun); // gilt roundels
    }
    const trail=new THREE.Mesh(new THREE.BoxGeometry(0.8,0.22,1.1),texturedMat("wood",0x6b4a2b)); trail.position.set(0,0.5,-1.45); trail.castShadow=false; SG.add(trail);
    const axleC=new THREE.Mesh(new THREE.CylinderGeometry(0.12,0.12,2.1,7),plainMat(0x4a3826));
    axleC.rotation.z=Math.PI/2; axleC.position.set(0,0.85,0.15); axleC.castShadow=false; SG.add(axleC);
    R.barrel=new THREE.Group(); R.barrel.position.set(0,1.3,0); R.barrel.rotation.x=-0.06; SG.add(R.barrel);
    const bl=culv?3.9:2.9, br=culv?0.17:0.3;
    const barrelM=new THREE.Mesh(new THREE.CylinderGeometry(br*0.82,br,bl,10),
      culv?texturedMat("metal",0xc8d0da):texturedMat("metal",0x4a4034));
    barrelM.rotation.x=Math.PI/2+0.02; barrelM.position.z=bl*0.14; barrelM.castShadow=true; R.barrel.add(barrelM); // seated over the axle
    const muzzleR=new THREE.Mesh(new THREE.CylinderGeometry(br*1.05,br*0.95,0.18,10),plainMat(culv?0xdde4ec:0xd9a92e));
    muzzleR.rotation.x=Math.PI/2; muzzleR.position.z=bl*0.14+bl/2-0.08; muzzleR.castShadow=false; R.barrel.add(muzzleR);
    for(let i=0;i<4;i++){ // reinforcing rings down the chase — gilt on Jaivana, steel on the culverin
      const ring=new THREE.Mesh(new THREE.CylinderGeometry(br*1.03,br*1.03,0.09,10),plainMat(culv?0x9aa2ad:0xd9a92e));
      ring.rotation.x=Math.PI/2; ring.position.z=bl*0.14-bl*0.38+i*bl*0.24; ring.castShadow=false; R.barrel.add(ring);
    }
    const cascabel=new THREE.Mesh(new THREE.SphereGeometry(br*0.9,7,6),plainMat(culv?0xb9c0c9:0xd9a92e));
    cascabel.position.z=bl*0.14-bl/2-0.05; cascabel.castShadow=false; R.barrel.add(cascabel); // the knob
    const wedge=new THREE.Mesh(new THREE.BoxGeometry(0.34,0.22,0.4),texturedMat("wood",0x8a6a3f)); wedge.position.set(0,1.05,-0.9); wedge.castShadow=false; SG.add(wedge);
    for(const dz of [-0.15,0.25]){ // the dolphins: lifting handles cast into the barrel
      const dol=new THREE.Mesh(new THREE.TorusGeometry(br*0.55,0.045,4,8,Math.PI),plainMat(culv?0x9aa2ad:0xd9a92e));
      dol.position.set(0,br*0.95,dz); dol.rotation.y=Math.PI/2; dol.castShadow=false; R.barrel.add(dol);
    }
    const touch=new THREE.Mesh(new THREE.BoxGeometry(0.12,0.09,0.14),plainMat(culv?0xb9c0c9:0xd9a92e));
    touch.position.set(0,br*0.95,bl*0.14-bl/2+0.35); touch.castShadow=false; R.barrel.add(touch); // the touch-hole
    if(culv){const sight=new THREE.Mesh(new THREE.BoxGeometry(0.05,0.14,0.05),plainMat(0xdde4ec));
      sight.position.set(0,br*1.05,bl*0.14+bl/2-0.3); sight.castShadow=false; R.barrel.add(sight);} // the sniper's blade
    for(const sx of [-0.42,0.42])for(const bz of [0.35,-1.0]){ // iron straps on the cheeks
      const strapC=new THREE.Mesh(new THREE.BoxGeometry(0.22,0.7,0.1),plainMat(0x3a3a42));
      strapC.position.set(sx,0.85,bz); strapC.castShadow=false; SG.add(strapC);
    }
    const ringB=new THREE.Mesh(new THREE.TorusGeometry(0.12,0.035,4,8),plainMat(0x3a3a42));
    ringB.position.set(0,0.6,-1.98); ringB.rotation.x=Math.PI/2; ringB.castShadow=false; SG.add(ringB); // towing ring
    if(culv){ // the culverin's sight blade and engraved chase
      const sight=new THREE.Mesh(new THREE.BoxGeometry(0.04,0.12,0.04),plainMat(0x4a4e56));
      sight.position.set(0,br+0.14,bl*0.14+bl/2-0.3); sight.castShadow=false; R.barrel.add(sight);
      for(let i=0;i<3;i++){const etch=new THREE.Mesh(new THREE.CylinderGeometry(br*1.01,br*1.01,0.03,10),plainMat(0x7d858f));
        etch.rotation.x=Math.PI/2; etch.position.z=bl*0.14+bl*0.12+i*0.28; etch.castShadow=false; R.barrel.add(etch);}
    }
    R.wheels=[];
    for(const wx of [-0.62,0.62]){
      const W=wheelGroup(0.85,0.16,0x5a4632,8); W.position.set(wx,0.85,0.15); SG.add(W); R.wheels.push(W);
    }
    refreshBar(u); return;
  }
  const mounted=!!d.mounted;
  const lift=mounted?(u.cls==="chariot"?1.42:1.85):0; // riders sit the 80% horse
  u.rigBaseY=(mounted?0.95:1.2)+lift; // foot troops got their legs back

  if(mounted){ // A REAL HORSE: doubled in size, proper anatomy, barded by its age
    const cls=u.cls;
    const bard=cls==="cataphract"?"scale":cls==="knight"?"plate":"none";
    const coat=[0x8a5a30,0x6d4620,0x54401f,0x9a7a4a][u.id%4], dark=0x5f3d1f;
    const hideM=texturedMat("hide",coat), darkM=plainMat(dark);
    const HG=new THREE.Group(); HG.position.z=(cls==="chariot"?2.55:0);
    HG.scale.setScalar(0.8); u.body.add(HG); R.horseG=HG; // the destrier, four-fifths of its former glory
    // body: chest, barrel, hindquarters — no more hot dog
    const barrel=new THREE.Mesh(new THREE.CylinderGeometry(0.98,0.86,3.4,9),hideM);
    barrel.rotation.x=Math.PI/2; barrel.scale.x=0.82; barrel.position.y=2.5; barrel.castShadow=true; HG.add(barrel);
    const chest=new THREE.Mesh(new THREE.SphereGeometry(1.02,8,7),hideM);
    chest.scale.set(0.85,1.05,1.05); chest.position.set(0,2.55,1.6); chest.castShadow=false; HG.add(chest);
    const rump=new THREE.Mesh(new THREE.SphereGeometry(0.98,8,7),hideM);
    rump.scale.set(0.82,1.02,1.15); rump.position.set(0,2.6,-1.5); rump.castShadow=false; HG.add(rump);
    const wither=new THREE.Mesh(new THREE.SphereGeometry(0.7,7,6),hideM);
    wither.scale.set(0.75,0.7,1); wither.position.set(0,3.15,0.9); wither.castShadow=false; HG.add(wither);
    // the whole neck-and-head rides one pivot so it can bob with the stride
    const NG=new THREE.Group(); NG.position.set(0,3.0,1.5); HG.add(NG); R.horseNeck=NG;
    const neck=new THREE.Mesh(new THREE.CylinderGeometry(0.32,0.62,1.9,8),hideM);
    neck.position.set(0,0.6,0.65); neck.rotation.x=0.72; NG.add(neck);
    const head=new THREE.Mesh(new THREE.BoxGeometry(0.52,0.6,1.0),hideM); head.position.set(0,1.5,1.3); head.rotation.x=0.35; NG.add(head);
    const muzzle=new THREE.Mesh(new THREE.BoxGeometry(0.36,0.4,0.55),hideM); muzzle.position.set(0,1.25,1.85); NG.add(muzzle);
    const nose=_noSh(box(0.3,0.12,0.1,dark)); nose.position.set(0,1.14,2.1); NG.add(nose);
    for(const ex of [-0.15,0.15]){ // eyes and ears bring it alive
      const eye=_noSh(new THREE.Mesh(new THREE.SphereGeometry(0.07,5,4),plainMat(0x14100c)));
      eye.position.set(ex*1.6,1.62,1.55); NG.add(eye);
      const ear=_noSh(cone(0.09,0.32,dark,4)); ear.position.set(ex,2.0,1.05); ear.rotation.x=-0.15; NG.add(ear);
    }
    for(let i=0;i<4;i++){ // mane running down the crest
      const mn=_noSh(box(0.14,0.5,0.34,0x3a2814));
      mn.position.set(0,1.85-i*0.42,1.0-i*0.3); mn.rotation.x=0.72; NG.add(mn);
    }
    const forelock=_noSh(box(0.22,0.3,0.12,0x3a2814)); forelock.position.set(0,1.86,1.22); NG.add(forelock);
    const tail=new THREE.Mesh(new THREE.CylinderGeometry(0.14,0.04,1.4,5),plainMat(0x3a2814));
    tail.position.set(0,2.55,-2.55); tail.rotation.x=2.95; tail.castShadow=false; HG.add(tail); // rooted at the croup
    // legs with hooves, doubled
    R.horseLegs=[];
    for(const [lx,lz,front] of [[-0.5,1.3,1],[0.5,1.3,1],[-0.5,-1.3,0],[0.5,-1.3,0]]){
      const hip=new THREE.Group(); hip.position.set(lx,2.4,lz); HG.add(hip);
      const thigh=new THREE.Mesh(new THREE.BoxGeometry(0.4,1.2,0.5),hideM);
      thigh.position.y=-0.5; thigh.castShadow=false; hip.add(thigh);
      const knee=new THREE.Group(); knee.position.y=-1.1; hip.add(knee); // the carpus / hock
      const cap=_noSh(new THREE.Mesh(new THREE.SphereGeometry(0.2,6,5),plainMat(0x6d4a24))); knee.add(cap);
      const cannon=new THREE.Mesh(new THREE.BoxGeometry(0.24,1.05,0.28),plainMat(0x5a3c1e));
      cannon.position.y=-0.52; cannon.castShadow=false; knee.add(cannon);
      const fetlock=_noSh(new THREE.Mesh(new THREE.SphereGeometry(0.13,5,4),plainMat(0x4a3018))); fetlock.position.y=-1.0; knee.add(fetlock);
      const hoof=_noSh(box(0.32,0.26,0.42,0x2b2118)); hoof.position.set(0,-1.12,0.05); knee.add(hoof);
      hip.userData.knee=knee; hip.userData.front=front;
      R.horseLegs.push(hip);
    }
    // tack and barding by class
    if(cls!=="chariot"){ // saddle for every true rider
      const pad=_noSh(new THREE.Mesh(new THREE.BoxGeometry(1.35,0.16,1.5),texturedMat("cloth",tc))); pad.position.set(0,3.42,0); HG.add(pad);
      const seat=_noSh(new THREE.Mesh(new THREE.BoxGeometry(1.05,0.18,1.1),texturedMat("hide",0x4a3320))); seat.position.set(0,3.55,0); HG.add(seat);
      const cantle=_noSh(box(0.9,0.3,0.16,0x4a3320)); cantle.position.set(0,3.7,-0.55); HG.add(cantle);
      if(cls!=="scout"){ // stirrups arrive with the heavy cavalry age
        for(const sx of [-0.72,0.72]){
          const strap=_noSh(box(0.09,0.95,0.14,0x4a3320)); strap.position.set(sx,3.0,0.15); HG.add(strap);
          const ring=_noSh(new THREE.Mesh(new THREE.TorusGeometry(0.14,0.045,4,8),plainMat(0x9aa2ad)));
          ring.position.set(sx,2.5,0.15); HG.add(ring);
        }
      }
      const rein=_noSh(cyl(0.03,0.03,1.9,0x4a3320,4)); rein.position.set(0,3.9,1.5); rein.rotation.x=0.9; HG.add(rein);
    }
    if(cls==="chariot"){ // plumed draft horse in cloth trappings
      for(let i=0;i<3;i++){const pl=_noSh(cone(0.09,0.7-i*0.12,i===1?0xe8e2d0:tc,5));
        pl.position.set((i-1)*0.14,5.35,2.5); HG.add(pl);} // the headdress
      const collar=_noSh(new THREE.Mesh(new THREE.TorusGeometry(0.62,0.12,5,9),texturedMat("cloth",tc)));
      collar.position.set(0,2.9,1.95); collar.rotation.x=0.5; HG.add(collar);
      const blanket=_noSh(new THREE.Mesh(new THREE.BoxGeometry(1.6,0.12,2.2),texturedMat("cloth",tc)));
      blanket.position.set(0,3.35,-0.2); HG.add(blanket);
    }
    if(cls==="heavycav"){ // leather breast-collar hung with bronze phalerae
      const strap=_noSh(box(1.5,0.2,0.14,0x4a3320)); strap.position.set(0,2.75,2.3); HG.add(strap);
      for(const px of [-0.4,0,0.4]){const disc=_noSh(cyl(0.14,0.14,0.06,0xb08a3f,7));
        disc.rotation.x=Math.PI/2; disc.position.set(px,2.6,2.42); HG.add(disc);}
      const cham=_noSh(box(0.4,0.5,0.16,0xb08a3f)); cham.position.set(0,4.55,3.15); cham.rotation.x=0.35; HG.add(cham);
    }
    if(bard==="scale"){ // the cataphract's steed wears a full scale trapper
      const trap=new THREE.Mesh(new THREE.CylinderGeometry(1.12,1.2,3.2,10,1,true),texturedMat("metal",0x8d949c));
      trap.rotation.x=Math.PI/2; trap.scale.x=0.85; trap.position.y=2.6; trap.castShadow=false; HG.add(trap); // full wrap, both flanks
      for(let i=0;i<4;i++){const row=_noSh(box(1.9,0.14,0.05,0x687079)); row.position.set(0,2.05+i*0.35,1.72-i*0.02); row.rotation.x=0.1; HG.add(row);}
      const crinet=new THREE.Mesh(new THREE.CylinderGeometry(0.4,0.68,1.8,7),texturedMat("metal",0x8d949c));
      crinet.position.set(0,3.62,2.18); crinet.rotation.x=0.72; crinet.castShadow=false; HG.add(crinet);
      const chamS=_noSh(box(0.5,0.66,0.2,0x7d858f)); chamS.position.set(0,4.5,3.1); chamS.rotation.x=0.35; HG.add(chamS);
    }
    if(bard==="plate"){ // the knight's destrier in polished plate and caparison
      const capar=new THREE.Mesh(new THREE.BoxGeometry(1.9,1.5,3.6),texturedMat("cloth",tc));
      capar.position.y=2.15; capar.castShadow=false; HG.add(capar); // flowing caparison skirt
      const peytral=new THREE.Mesh(new THREE.SphereGeometry(1.06,8,6,0,Math.PI*2,0,Math.PI*0.5),texturedMat("metal",0xb9c0c9));
      peytral.position.set(0,2.6,1.7); peytral.rotation.x=Math.PI/2; peytral.castShadow=false; HG.add(peytral);
      const croup=_noSh(new THREE.Mesh(new THREE.SphereGeometry(1.0,8,6,0,Math.PI*2,0,Math.PI*0.45),texturedMat("metal",0xb9c0c9)));
      croup.position.set(0,3.0,-1.5); HG.add(croup);
      for(let i=0;i<3;i++){const cr=_noSh(box(0.62,0.22,0.4,0xaeb6c0)); cr.position.set(0,3.75-i*0.3,2.0+i*0.22); cr.rotation.x=0.72; HG.add(cr);} // crinet segments
      const chamP=_noSh(box(0.5,0.7,0.22,0xc2c9d4)); chamP.position.set(0,4.5,3.1); chamP.rotation.x=0.35; HG.add(chamP);
      const spike=_noSh(cone(0.08,0.35,0xd9a92e,5)); spike.position.set(0,4.95,3.0); HG.add(spike);
      const plumeH=_noSh(cone(0.1,0.55,tc,5)); plumeH.position.set(0,5.3,2.5); HG.add(plumeH);
    }
    if(cls==="chariot"){ // THE CAR: platform, curved rail, spoked wheels, draw-pole
      const CAR=new THREE.Group(); CAR.scale.setScalar(0.85); u.body.add(CAR);
      const floor=new THREE.Mesh(new THREE.BoxGeometry(2.0,0.22,1.7),texturedMat("wood",0x8a6a3f));
      floor.position.set(0,1.45,-0.1); floor.castShadow=true; CAR.add(floor);
      const front=new THREE.Mesh(new THREE.CylinderGeometry(1.05,1.05,1.1,9,1,true,Math.PI*1.15,Math.PI*0.7),texturedMat("wood",0xa8703d));
      front.position.set(0,2.0,0.05); front.rotation.y=Math.PI/2; front.castShadow=false; CAR.add(front); // the guard rail curves BEHIND the crew
      const railT=_noSh(new THREE.Mesh(new THREE.TorusGeometry(1.02,0.06,5,10,Math.PI*0.7),plainMat(0xd9a92e)));
      railT.rotation.x=Math.PI/2; railT.rotation.z=Math.PI*0.65; railT.position.set(0,2.55,0.05); CAR.add(railT);
      for(const sx of [-1.15,1.15]){
        const W=wheelGroup(1.05,0.16,0x8a6a3f,6); W.position.set(sx,1.05,-0.35); CAR.add(W); (R.wheels=R.wheels||[]).push(W);
      }
      const pole=new THREE.Mesh(new THREE.CylinderGeometry(0.09,0.11,3.4,6),texturedMat("wood",0x8a6a3f));
      pole.position.set(0,1.7,1.5); pole.rotation.x=Math.PI/2-0.12; CAR.add(pole);
      const yoke=_noSh(box(1.5,0.12,0.12,0x8a6a3f)); yoke.position.set(0,2.5,3.05); CAR.add(yoke);
      const quiverC=_noSh(cyl(0.16,0.16,0.8,0x7a4c26,6)); quiverC.position.set(0.95,2.0,-0.15); quiverC.rotation.z=0.2; CAR.add(quiverC);
    }
  }

  // legs — dressed for their age: Stone-age bare skin, Enlightenment stockings
  const skinT=SKIN_TONES[u.id%SKIN_TONES.length], hairT=HAIR_TONES[(u.id*7+3)%HAIR_TONES.length];
  const skinM=plainMat(skinT), bootM=plainMat(0x3a2c1e);
  // villagers dress for their team's CURRENT age, like the town they serve
  const vAge=u.cls==="villager"?Math.max(0,Math.min(5,(typeof teamAge!=="undefined"&&teamAge[u.team])||0)):-1;
  let bare={clubman:1,spearman:1,slinger:1}[u.cls]; const stockings=u.cls==="musketeer";
  const greaves=u.cls==="hoplite", plateBoots={pikeman:1,halberdier:1}[u.cls];
  let chiton=u.cls==="comparcher"; // bare legs and sandals under the wool chiton
  if(vAge===0)bare=true;              // Stone: bare legs, wrapped feet
  if(vAge===1||vAge===3)chiton=true;  // Bronze tunic / Classical chiton: bare legs, sandals
  let trouser=bare?skinM:texturedMat("cloth",
    stockings?0x2b3242:(u.team===BLUE?0x8e2a2a:0x27406e)); // breeches / parade trousers
  if(vAge===1||vAge===3)trouser=skinM;                     // Bronze/Classical: bare legs under the tunic
  if(vAge===2)trouser=texturedMat("cloth",0x3f4a30);       // Iron: wool leggings
  if(vAge===4)trouser=texturedMat("cloth",0x5a5148);       // Medieval: grey hose
  if(vAge===5)trouser=texturedMat("cloth",0x2b3242);       // Enlightenment: navy knee breeches
  let bootLeg=(bare||chiton)?skinM
    :stockings?plainMat(0xe8e4d8)
    :greaves?texturedMat("metal",0xb08a3f)       // bronze greaves
    :plateBoots?texturedMat("metal",0x9aa2ad)    // high plate boots
    :plainMat(0x141414);
  if(vAge===2)bootLeg=plainMat(0x2c2118);        // Iron: sturdy dark boots
  if(vAge===4)bootLeg=plainMat(0x3a2c1e);        // Medieval: leather boots
  if(vAge===5)bootLeg=plainMat(0xe8e4d8);        // Enlightenment: white stockings
  const legL=limb2(0.21,0.17,0.14,0.62,0.55,trouser,-0.26,u.rigBaseY,mounted?0.15:0);
  const legR=limb2(0.21,0.17,0.14,0.62,0.55,trouser, 0.26,u.rigBaseY,mounted?0.15:0);
  for(const LG of [legL,legR]){ // shins: boots, white stockings, or bare skin
    LG.lower.children.forEach(m=>{if(m.geometry&&m.geometry.type==="CylinderGeometry")m.material=bootLeg;});
    if(!bare&&!chiton){
      const cuff=new THREE.Mesh(new THREE.CylinderGeometry(0.19,0.19,0.1,8),
        plainMat(greaves?0x9a7532:plateBoots?0x8d949c:0xd9a92e)); // knee cop / greave rim / gold cuff
      cuff.position.y=stockings?0.0:-0.06; cuff.castShadow=false; LG.lower.add(cuff);
    }
  }
  R.legL=legL.upper; R.shinL=legL.lower;
  R.legR=legR.upper; R.shinR=legR.lower;
  for(const S of [R.shinL,R.shinR]){ // feet follow the knee: boots, sandals, or bare
    const vShoe=vAge===5?plainMat(0x1d1a17):bootM; // Enlightenment: black leather shoes
    const f=new THREE.Mesh(new THREE.BoxGeometry(0.28,0.18,0.48),(bare||greaves||chiton)?skinM:plateBoots?plainMat(0x8d949c):vShoe);
    if(greaves||chiton){const strap=new THREE.Mesh(new THREE.BoxGeometry(0.3,0.06,0.1),plainMat(0x5a3c22));
      strap.position.set(0,0.06,0.08); strap.castShadow=false; f.add(strap);} // sandal lacing
    if(vAge===0){const wrap=new THREE.Mesh(new THREE.BoxGeometry(0.3,0.1,0.32),texturedMat("hide",0x8a6a48));
      wrap.position.set(0,0.05,0); wrap.castShadow=false; f.add(wrap);} // hide foot wrappings
    if(vAge===5){const buck=new THREE.Mesh(new THREE.BoxGeometry(0.14,0.1,0.04),plainMat(0xd9a92e));
      buck.position.set(0,0.06,0.25); buck.castShadow=false; f.add(buck);} // brass shoe buckle
    f.position.set(0,-0.51,0.08); f.castShadow=false; S.add(f);
  }
  const pelvis=new THREE.Mesh(new THREE.CylinderGeometry(0.35,0.32,0.26,8),trouser);
  pelvis.scale.z=0.72; pelvis.position.y=u.rigBaseY-0.08; pelvis.castShadow=false; u.body.add(pelvis);
  u.body.add(R.legL,R.legR);

  // torso: broad shoulders tapering to the waist, belted, with a real neck
  R.torso=new THREE.Group(); R.torso.position.y=u.rigBaseY;
  const VILL_TUNIC=[null,                      // Stone: bare-chested under the fur
    ["cloth",0xdcc49a],                        // Bronze: warm sand wool tunic
    ["cloth",0x4a5a38],                        // Iron: deep green layered wool
    ["cloth",0xefe9dc],                        // Classical: bright off-white chiton
    ["cloth",0x5f574c],                        // Medieval: dark grey-brown wool
    ["cloth",0xd8cdb4]];                       // Enlightenment: loose linen shirt
  const tunic=u.cls==="villager"?(vAge===0?skinM:texturedMat(VILL_TUNIC[vAge][0],VILL_TUNIC[vAge][1]))
    :bare?skinM                                         // Stone: bare-chested
    :{archer:1,imparcher:1}[u.cls]?texturedMat("hide",0x8a6a48) // skins and wool
    :u.cls==="comparcher"?skinM                         // chiton bares the arms
    :u.cls==="crossbowman"?texturedMat("cloth",0x3f6b35)// lincoln green
    :u.cls==="skirmisher"?texturedMat("hide",0x6a5638)  // ranger buckskin
    :{cataphract:1,elitescout:1}[u.cls]?texturedMat("metal",0x8d949c) // mail head to toe
    :u.cls==="vanguard"?texturedMat("metal",0x8d949c)   // Medieval: chainmail sleeves
    :u.cls==="musketeer"?texturedMat("uniform",tc)      // Enlightenment: team cassock
    :texturedMat("uniform",d.col);
  // NUTCRACKER column: a proud straight cylinder of painted wood
  const torsoM=new THREE.Mesh(new THREE.CylinderGeometry(0.5,0.52,1.05,10),tunic);
  torsoM.scale.z=0.8; torsoM.position.y=0.56; torsoM.castShadow=true; R.torso.add(torsoM);
  const armorShoulders={shortsword:1,broadsword:1,legionaire:1,vanguard:1,
    spearfighter:1,impspear:1,hoplite:1,pikeman:1,halberdier:1,
    archer:1,imparcher:1,comparcher:1,crossbowman:1,skirmisher:1}[u.cls];
  const soldierly=(CLS[u.cls].tier>=1||u.isKing)&&!armorShoulders;
  for(const sx of [-0.52,0.52]){ // epaulettes for soldiers, plain shoulders for villagers
    if(soldierly){
      const ep=new THREE.Mesh(new THREE.BoxGeometry(0.34,0.1,0.4),plainMat(0xd9a92e));
      ep.position.set(sx,1.02,0); ep.castShadow=false; R.torso.add(ep);
      const fr=new THREE.Mesh(new THREE.BoxGeometry(0.3,0.16,0.34),plainMat(0xb8871f));
      fr.position.set(sx*1.08,0.9,0); fr.castShadow=false; R.torso.add(fr);
    }else{
      const sh=new THREE.Mesh(new THREE.SphereGeometry(0.16,7,6),tunic);
      sh.position.set(sx,0.97,0); sh.scale.set(1.05,0.78,0.92); sh.castShadow=false; R.torso.add(sh);
    }
  }
  if(u.cls==="villager"){ // six ages of working clothes — the town's wardrobe on its people
    if(vAge===0){ // STONE: fur cape over the shoulder, bone charms, team loincloth
      const pelt=new THREE.Mesh(new THREE.BoxGeometry(0.5,1.1,0.62),texturedMat("hide",0x6b4a2b));
      pelt.position.set(-0.28,0.85,0); pelt.rotation.z=0.3; pelt.castShadow=false; R.torso.add(pelt);
      for(let i=0;i<3;i++){const bone=new THREE.Mesh(new THREE.BoxGeometry(0.07,0.16,0.05),plainMat(0xe8e4d8));
        bone.position.set(-0.16+i*0.16,1.02,0.42); bone.castShadow=false; R.torso.add(bone);}
      const clothF=_noSh(box(0.36,0.46,0.07,tc)); clothF.position.set(0,0.0,0.3); R.torso.add(clothF);
      const clothB=_noSh(box(0.36,0.42,0.07,tc)); clothB.position.set(0,0.02,-0.3); R.torso.add(clothB);
      for(let i=0;i<3;i++){ // jagged hide loincloth strips
        const rag=new THREE.Mesh(new THREE.BoxGeometry(0.15,0.28,0.05),texturedMat("hide",0x8a6a48));
        rag.position.set(-0.24+i*0.24,0.02,0.36); rag.rotation.z=(i%2?0.18:-0.15); rag.castShadow=false; R.torso.add(rag);
      }
    }else if(vAge===1){ // BRONZE: belted cream tunic, short cloak, bronze accents
      const hem=new THREE.Mesh(new THREE.CylinderGeometry(0.5,0.56,0.3,10),texturedMat("cloth",0xe3d6b4));
      hem.scale.z=0.8; hem.position.y=0.02; hem.castShadow=false; R.torso.add(hem); // knee-length skirt of the tunic
      const beltB=new THREE.Mesh(new THREE.CylinderGeometry(0.53,0.53,0.11,10),plainMat(0xc9a44a));
      beltB.scale.z=0.8; beltB.position.y=0.3; beltB.castShadow=false; R.torso.add(beltB); // bronze belt
      const cloak=_noSh(box(0.72,0.85,0.08,0x8ba05e)); cloak.position.set(0,0.55,-0.44); R.torso.add(cloak); // green short cloak
      for(const sx of [-1,1]){const edge=_noSh(box(0.14,0.7,0.1,0x8ba05e)); edge.position.set(sx*0.4,0.62,-0.24); edge.rotation.y=sx*0.5; R.torso.add(edge);} // it wraps the shoulders
      const pin=_noSh(box(0.12,0.12,0.05,0xc9a44a)); pin.position.set(0.24,0.95,0.42); R.torso.add(pin); // bronze cloak pin
    }else if(vAge===2){ // IRON: layered wool over leggings, deep hood on the back, iron buckle
      const layer=new THREE.Mesh(new THREE.CylinderGeometry(0.54,0.6,0.42,10),texturedMat("cloth",0x5a4a36));
      layer.scale.z=0.8; layer.position.y=-0.02; layer.castShadow=false; R.torso.add(layer); // heavy under-layer
      const beltI=new THREE.Mesh(new THREE.CylinderGeometry(0.53,0.53,0.12,10),plainMat(0x3a2c1e));
      beltI.scale.z=0.8; beltI.position.y=0.3; beltI.castShadow=false; R.torso.add(beltI);
      const buckI=_noSh(box(0.16,0.12,0.05,0x6a7280)); buckI.position.set(0,0.3,0.44); R.torso.add(buckI); // iron buckle
      const hoodB=_noSh(box(0.62,0.66,0.16,0x7a3428)); hoodB.position.set(0,0.72,-0.46); hoodB.rotation.x=0.15; R.torso.add(hoodB); // rust-red hood, thrown back
    }else if(vAge===3){ // CLASSICAL: chiton folds + himation draped over one shoulder
      const foldH=new THREE.Mesh(new THREE.CylinderGeometry(0.51,0.57,0.26,10),texturedMat("cloth",0xe8e2d0));
      foldH.scale.z=0.8; foldH.position.y=0.0; foldH.castShadow=false; R.torso.add(foldH); // chiton skirt
      const cord=new THREE.Mesh(new THREE.CylinderGeometry(0.52,0.52,0.07,10),plainMat(0x8a6a48));
      cord.scale.z=0.8; cord.position.y=0.3; cord.castShadow=false; R.torso.add(cord); // waist cord
      const hima=_noSh(box(0.36,0.9,0.09,0xb8603a)); hima.rotation.z=-0.5; hima.position.set(-0.1,0.56,0.41); R.torso.add(hima); // terracotta himation, opposite shoulder
      const himaB=_noSh(box(0.4,0.8,0.09,0xb8603a)); himaB.rotation.z=0.45; himaB.position.set(0.08,0.5,-0.43); R.torso.add(himaB);
    }else if(vAge===4){ // MEDIEVAL: leather work apron, pouch belt, wool everything
      const apron=_noSh(new THREE.Mesh(new THREE.BoxGeometry(0.56,0.88,0.08),texturedMat("hide",0x6b4a2b)));
      apron.position.set(0,0.4,0.43); R.torso.add(apron); // the leather apron
      const bib=_noSh(box(0.34,0.3,0.08,0x5a3c22)); bib.position.set(0,0.92,0.44); R.torso.add(bib);
      const beltM=new THREE.Mesh(new THREE.CylinderGeometry(0.53,0.53,0.12,10),plainMat(0x3a2c1e));
      beltM.scale.z=0.8; beltM.position.y=0.24; beltM.castShadow=false; R.torso.add(beltM);
      const pouch=_noSh(box(0.2,0.24,0.14,0x7a5230)); pouch.position.set(0.4,0.14,0.3); R.torso.add(pouch); // belt pouch
    }else{ // ENLIGHTENMENT: waistcoat over linen, brass buttons, neckerchief
      const vest=_noSh(box(0.6,0.94,0.09,0x5a4632)); vest.position.set(0,0.5,0.42); R.torso.add(vest); // the waistcoat front
      for(const sx of [-0.19,0.19]){const stripe=_noSh(box(0.07,0.94,0.02,0x8a7248)); stripe.position.set(sx,0.5,0.475); R.torso.add(stripe);} // earth-tone stripes
      const placket=_noSh(box(0.12,0.94,0.02,0xd8cdb4)); placket.position.set(0,0.5,0.475); R.torso.add(placket); // linen shows down the middle
      const vestB=_noSh(box(0.62,0.94,0.08,0x4e3d2a)); vestB.position.set(0,0.5,-0.43); R.torso.add(vestB);
      for(const ss of [-1,1]){const side=_noSh(box(0.1,0.9,0.5,0x53412c)); side.position.set(ss*0.44,0.48,0); R.torso.add(side);} // it wraps the ribs
      for(let i=0;i<3;i++){const btn=_noSh(box(0.06,0.06,0.03,0xd9a92e)); btn.position.set(0.08,0.78-i*0.24,0.49); R.torso.add(btn);} // brass buttons on the placket
      const kerchief=_noSh(box(0.3,0.2,0.1,tc)); kerchief.position.set(0,1.0,0.34); R.torso.add(kerchief); // team neckerchief
      const beltE=new THREE.Mesh(new THREE.CylinderGeometry(0.53,0.53,0.1,10),plainMat(0x1d1a17));
      beltE.scale.z=0.8; beltE.position.y=0.22; beltE.castShadow=false; R.torso.add(beltE);
    }
  }else if(bare){ // a knotted hide waistband holds the loincloth
    const wb=new THREE.Mesh(new THREE.CylinderGeometry(0.53,0.53,0.14,10),texturedMat("hide",0x6b4a2b));
    wb.scale.z=0.8; wb.position.y=0.26; wb.castShadow=false; R.torso.add(wb);
  }else{
    const belt=new THREE.Mesh(new THREE.CylinderGeometry(0.53,0.53,0.16,10),plainMat(0x1d1d1d));
    belt.scale.z=0.8; belt.position.y=0.26; belt.castShadow=false; R.torso.add(belt);
    const buckle=new THREE.Mesh(new THREE.BoxGeometry(0.2,0.14,0.05),plainMat(0xd9a92e));
    buckle.position.set(0,0.26,0.44); buckle.castShadow=false; R.torso.add(buckle);
  }
  if(!{clubman:1,shortsword:1,broadsword:1,legionaire:1,vanguard:1,musketeer:1,
       spearman:1,spearfighter:1,impspear:1,hoplite:1,pikeman:1,halberdier:1,
       slinger:1,archer:1,imparcher:1,comparcher:1,crossbowman:1,skirmisher:1}[u.cls]){
    const sash=box(0.34,0.68,0.06,tc); sash.rotation.z=0.5; sash.position.set(0,0.56,0.4);
    sash.castShadow=false; R.torso.add(sash); // baldric across the chest
  } // (the melee line wears its team colors bespoke: loincloth, plumes, cross, cassock)
  // the LEVER: lower jaw + hanging beard rise from the torso — the head sits above them
  // the LOWER JAW: its teeth crown the torso's top edge — the mouth is the seam between head and body
  const jaw=new THREE.Mesh(new THREE.BoxGeometry(0.62,0.3,0.56),skinM);
  jaw.position.set(0,0.95,0.24); jaw.castShadow=false; R.torso.add(jaw);
  const mouthIn=new THREE.Mesh(new THREE.BoxGeometry(0.44,0.2,0.04),plainMat(0xa32126));
  mouthIn.position.set(0,1.0,0.51); mouthIn.castShadow=false; R.torso.add(mouthIn);
  const lowTeeth=new THREE.Mesh(new THREE.BoxGeometry(0.36,0.11,0.05),plainMat(0xf6f3ea));
  lowTeeth.position.set(0,1.05,0.52); lowTeeth.castShadow=false; R.torso.add(lowTeeth); // top edge = torso top
  const beard=new THREE.Mesh(new THREE.BoxGeometry(0.44,0.5,0.24),plainMat(0xe9e5db));
  beard.position.set(0,0.62,0.42); beard.castShadow=false; R.torso.add(beard);
  const beardTip=new THREE.Mesh(new THREE.BoxGeometry(0.28,0.22,0.18),plainMat(0xdcd8cc));
  beardTip.position.set(0,0.3,0.44); beardTip.castShadow=false; R.torso.add(beardTip);
  R.head=new THREE.Group(); R.head.position.y=1.0; // seated low: the mouth meets the body
  // EGG head: widest at the cheeks, tapering top and bottom — 9 carved staves keep a flat face facet
  // egg base flares to nearly the torso's circumference — one continuous carving
  const eggProf=[[0.48,0],[0.53,0.1],[0.56,0.22],[0.58,0.38],[0.58,0.52],
    [0.54,0.66],[0.47,0.78],[0.36,0.88],[0.21,0.95],[0.06,1.0]];
  const eggPts=eggProf.map(p=>new THREE.Vector2(p[0],p[1]*1.15));
  const headM=new THREE.Mesh(new THREE.LatheGeometry(eggPts,9),headMaterials(skinT,hairT));
  headM.rotation.y=Math.PI; // face band (u=0.5) forward, seam behind
  headM.position.y=0; headM.castShadow=false; R.head.add(headM);
  // v128.1: the head is the single most valuable outline on the whole unit — it is what the eye
  // finds first at phone size, and the egg silhouette is unmistakable once it has an edge. ONE
  // extra draw call per unit, against the ~33 a body already costs, so this is a 3% bill for most
  // of the readability. The limbs and the fifty little props are deliberately left un-inked: they
  // would multiply the call count for detail nobody can resolve at 0.7 pixel ratio anyway.
  inkOutline(headM,2.0);
  R.torso.add(R.head);
  const armL=limb2(0.16,0.13,0.10,0.5,0.52,tunic,-0.68,0.96,0);
  const armR=limb2(0.16,0.13,0.10,0.5,0.52,tunic, 0.68,0.96,0);
  R.armL=armL.upper; R.faL=armL.lower;
  R.armR=armR.upper; R.faR=armR.lower;
  endCap(R.faL,0.12,skinM,-0.54); endCap(R.faR,0.12,skinM,-0.54); // hands
  R.torso.add(R.armL,R.armR);
  u.body.add(R.torso);

  const noShadow=m=>{m.castShadow=false;return m;};
  const rig=CLS[u.cls].rig, tier=CLS[u.cls].tier||0;
  // class flair — hats on the head, WEAPONS IN HANDS so they swing
  if(rig==="villager"){
    // ---- the hat tells the century ----
    if(vAge===1){ // rounded wool cap with a rolled rim — warm tan, not head-colored
      const capW=noShadow(new THREE.Mesh(new THREE.SphereGeometry(0.5,8,6,0,Math.PI*2,0,Math.PI*0.5),texturedMat("cloth",0xb08a5a)));
      capW.position.y=0.88; R.head.add(capW);
      const rim=noShadow(cyl(0.52,0.55,0.14,0x7a5a34,9)); rim.position.y=0.86; R.head.add(rim);
    }else if(vAge===2){ // the Phrygian cap: a wool base that WRAPS the skull, cone rising from it
      const base2=noShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.55,0.63,0.34,9),texturedMat("cloth",0x8a3a2a)));
      base2.position.y=0.8; R.head.add(base2); // hugs the crown — no scalp shows through
      const skull2=noShadow(new THREE.Mesh(new THREE.SphereGeometry(0.56,8,5,0,Math.PI*2,0,Math.PI*0.5),texturedMat("cloth",0x8a3a2a)));
      skull2.position.y=0.9; skull2.scale.y=0.7; R.head.add(skull2); // rounds the top of the base
      const phry=noShadow(cone(0.42,0.7,0x8a3a2a,8)); phry.rotation.x=0.35; phry.position.set(0,1.32,0.1); R.head.add(phry);
      const tip=noShadow(new THREE.Mesh(new THREE.SphereGeometry(0.15,6,5),plainMat(0x7a2f22)));
      tip.position.set(0,1.6,0.36); R.head.add(tip); // the forward curl
      const band2=noShadow(cyl(0.6,0.64,0.13,0x6e2c20,9)); band2.position.y=0.66; R.head.add(band2);
    }else if(vAge===3){ // the petasos: flat wide brim against the Mediterranean sun
      const brim=noShadow(cyl(1.0,1.0,0.05,0xc9a86a,10)); brim.position.y=0.82; R.head.add(brim);
      const crown=noShadow(new THREE.Mesh(new THREE.SphereGeometry(0.42,8,5,0,Math.PI*2,0,Math.PI*0.5),plainMat(0xc9a86a)));
      crown.position.y=0.82; R.head.add(crown);
      const cordP=noShadow(cyl(0.43,0.43,0.06,0x8a6a48,8)); cordP.position.y=0.86; R.head.add(cordP);
    }else if(vAge===4){ // the hood: up over the crown, tilted back so the face shows, draped behind
      const hood=noShadow(new THREE.Mesh(new THREE.SphereGeometry(0.62,9,7,0,Math.PI*2,0,Math.PI*0.56),texturedMat("cloth",0x6a6156)));
      hood.position.set(0,0.68,-0.12); hood.rotation.x=-0.38; hood.scale.set(1,1.12,1.18); R.head.add(hood);
      const rimH=noShadow(new THREE.Mesh(new THREE.TorusGeometry(0.58,0.07,5,12,Math.PI),plainMat(0x57503f)));
      rimH.rotation.x=-0.38; rimH.position.set(0,0.7,-0.1); R.head.add(rimH); // the hood's front hem, arched over the brow
      const drape=noShadow(box(0.52,0.55,0.16,0x6a6156)); drape.position.set(0,0.28,-0.58); drape.rotation.x=0.35; R.head.add(drape); // falls down the back
      const mantle=noShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.56,0.8,0.4,9),texturedMat("cloth",0x6a6156)));
      mantle.scale.z=0.85; mantle.position.y=0.98; R.torso.add(mantle); // shoulder mantle of the hood
    }else if(vAge===5){ // the tricorn: black felt crown, three upswept brim panels, gold edging
      const crown5=noShadow(cyl(0.4,0.5,0.3,0x22201d,9)); crown5.position.y=0.92; R.head.add(crown5);
      const dome5=noShadow(new THREE.Mesh(new THREE.SphereGeometry(0.41,8,5,0,Math.PI*2,0,Math.PI*0.5),plainMat(0x22201d)));
      dome5.position.y=1.02; R.head.add(dome5);
      for(let i=0;i<3;i++){ // each brim panel lives on its own pivot: yaw the pivot, pitch the panel
        const car=new THREE.Group(); car.rotation.y=i*Math.PI*2/3; car.position.y=0.86; R.head.add(car);
        const brim=noShadow(box(1.02,0.06,0.38,0x2a2723)); brim.position.set(0,0.08,0.44); brim.rotation.x=0.52; car.add(brim);
        const gold5=noShadow(box(1.02,0.035,0.09,0xd9a92e)); gold5.position.set(0,0.045,0.15); brim.add(gold5); // lies flat on the brim's outer edge
      }
    }else if(vAge===0){ // rough hide cap, fur band, bone tail — over messy hair
      const cap=noShadow(new THREE.Mesh(new THREE.SphereGeometry(0.53,8,6,0,Math.PI*2,0,Math.PI*0.5),texturedMat("hide",0x7a5230)));
      cap.position.y=0.9; R.head.add(cap); // riding high — the eyes stay clear
      const fur=noShadow(cyl(0.55,0.58,0.15,0x5a3c22,9)); fur.position.y=0.9; R.head.add(fur);
      const tailH=noShadow(box(0.13,0.38,0.1,0x5a3c22)); tailH.position.set(0,1.02,-0.48); tailH.rotation.x=0.5; R.head.add(tailH);
      const boneH=noShadow(box(0.06,0.2,0.05,0xe8e4d8)); boneH.position.set(0.28,0.98,0.38); boneH.rotation.z=0.4; R.head.add(boneH);
    }
    // ---- the tool tells the trade ----
    const TG=weaponGrip(R.faR,-0.9); // gripped in the fist like every weapon
    if(vAge!==5)TG.rotation.x-=Math.PI/4; // carried at the ready, leveled 45° off vertical (playtest-tuned; shovel rests low)
    const TS=new THREE.Group(); TG.add(TS); // spin carrier: rotates the tool about its own haft
    if(vAge!==5)TS.rotation.y=-Math.PI/2;   // playtest: 90° clockwise seen top-down
    const haftM=texturedMat("wood",0x8a6a3f);
    if(vAge===0){ // crude stone axe, lashed head
      const haft=noShadow(new THREE.Mesh(new THREE.BoxGeometry(0.11,0.85,0.11),haftM)); haft.position.y=0.1; TS.add(haft);
      const stone=noShadow(box(0.34,0.2,0.13,0x8a8378)); stone.position.set(0.1,0.5,0); TS.add(stone);
      const lash=noShadow(box(0.14,0.1,0.15,0x5a3c22)); lash.position.set(0,0.5,0); TS.add(lash);
    }else if(vAge===1){ // bronze sickle
      const haft=noShadow(new THREE.Mesh(new THREE.BoxGeometry(0.1,0.6,0.1),haftM)); haft.position.y=0; TS.add(haft);
      const blade=noShadow(new THREE.Mesh(new THREE.TorusGeometry(0.26,0.05,5,9,Math.PI*1.05),plainMat(0xc9a44a)));
      blade.position.set(0.08,0.3,0); TS.add(blade); // the hook rides the haft's tip
    }else if(vAge===2){ // iron pick
      const haft=noShadow(new THREE.Mesh(new THREE.BoxGeometry(0.1,0.85,0.1),haftM)); haft.position.y=0.1; TS.add(haft);
      const pickL=noShadow(cone(0.07,0.4,0x6a7280,5)); pickL.rotation.z=Math.PI/2; pickL.position.set(-0.24,0.52,0); TS.add(pickL);
      const pickR=noShadow(cone(0.07,0.4,0x6a7280,5)); pickR.rotation.z=-Math.PI/2; pickR.position.set(0.24,0.52,0); TS.add(pickR);
    }else if(vAge===3){ // the balanced sickle, steel on a turned grip
      const haft=noShadow(new THREE.Mesh(new THREE.BoxGeometry(0.1,0.66,0.1),haftM)); haft.position.y=0.02; TS.add(haft);
      const grip=noShadow(cyl(0.07,0.07,0.16,0xe8e2d0,6)); grip.position.y=-0.24; TS.add(grip);
      const blade=noShadow(new THREE.Mesh(new THREE.TorusGeometry(0.28,0.045,5,9,Math.PI*1.1),plainMat(0xb9c0c9)));
      blade.position.set(0.08,0.34,0); TS.add(blade); // hook at the tip
    }else if(vAge===4){ // the scythe: long snath, angled blade
      const haft=noShadow(new THREE.Mesh(new THREE.BoxGeometry(0.09,1.15,0.09),haftM)); haft.position.y=0.2; TS.add(haft);
      const peg=noShadow(box(0.2,0.07,0.07,0x6b4a2b)); peg.position.set(0.1,0.05,0); TS.add(peg); // grip peg
      const blade=noShadow(box(0.55,0.07,0.11,0x9aa2ad)); blade.position.set(0.26,0.78,0); blade.rotation.z=-0.5; TS.add(blade);
    }else{ // the improved shovel: iron blade, D-grip
      const haft=noShadow(new THREE.Mesh(new THREE.BoxGeometry(0.09,0.8,0.09),haftM)); haft.position.y=0.06; TS.add(haft);
      const blade=noShadow(box(0.26,0.32,0.06,0x8d949c)); blade.position.y=0.6; TS.add(blade);
      const dgrip=noShadow(new THREE.Mesh(new THREE.TorusGeometry(0.1,0.035,5,8),plainMat(0x5a4632)));
      dgrip.position.y=-0.36; TS.add(dgrip);
    }
  }
  if(rig==="sword"){ // THE MELEE LINE — six ages you can read at a glance
    if(u.cls==="clubman"){ // STONE: bare skin, hide cap, a REAL club
      kitStoneAge(R,tc);
      // the CLUB: one line from grip to head — nothing floats
      const CG=weaponGrip(R.faR,-0.9);
      const haft=noShadow(cyl(0.06,0.09,0.9,0x7a5230,7)); haft.position.y=0.3; CG.add(haft);
      const headC=noShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.27,0.16,0.62,8),texturedMat("wood",0x6b4a2b)));
      headC.position.y=0.95; CG.add(headC);
      for(const a of [0.6,2.2,4.0]){const stud=noShadow(box(0.1,0.1,0.1,0x4a3320));
        stud.position.set(Math.cos(a)*0.24,1.05,Math.sin(a)*0.24); CG.add(stud);}
    }
    if(u.cls==="shortsword"){ // BRONZE: the Dendra panoply + a boar's-tusk helm — no shield
      kitDendra(R,tc);
      // the bronze shortsword
      const SG=weaponGrip(R.faR,-0.9);
      const ssw=noShadow(box(0.13,1.0,0.12,0xc9a44a)); ssw.position.y=0.62; SG.add(ssw);
      const sgd=noShadow(box(0.38,0.08,0.14,0x9a7532)); sgd.position.y=0.12; SG.add(sgd);
    }
    if(u.cls==="broadsword"){ // IRON: lamellar rows, the Negau bell helm, a true broadsword
      kitLamellar(R,tc);
      // longer and wider than the bronze blade
      const BG=weaponGrip(R.faR,-0.9);
      const bsw=noShadow(box(0.2,1.35,0.13,0xb9c0c9)); bsw.position.y=0.8; BG.add(bsw);
      const bgd=noShadow(box(0.48,0.09,0.15,0x8d949c)); bgd.position.y=0.12; BG.add(bgd);
      // a small round buckler
      const buck=noShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.42,0.42,0.09,10),heraldryMat(u.team,u.id)));
      buck.rotation.z=Math.PI/2; buck.position.set(-0.14,-0.3,0.15); R.faL.add(buck);
      const bossB=noShadow(new THREE.Mesh(new THREE.SphereGeometry(0.1,6,5),plainMat(0x9aa2ad))); bossB.position.set(-0.2,-0.3,0.15); R.faL.add(bossB);
    }
    if(u.cls==="legionaire"){ // CLASSICAL: polished segmentata with gold trim, the tower scutum
      const steel=texturedMat("metal",0xd5dae2), steelD=texturedMat("metal",0xc2c9d4), gold=plainMat(0xd9a92e);
      for(let i=0;i<4;i++){ // bright horizontal bands
        const band=new THREE.Mesh(new THREE.CylinderGeometry(0.555,0.58,0.155,10),i%2?steel:steelD);
        band.scale.z=0.8; band.position.y=0.3+i*0.17; band.castShadow=false; R.torso.add(band);
      }
      const trim=new THREE.Mesh(new THREE.CylinderGeometry(0.585,0.585,0.05,10),gold);
      trim.scale.z=0.8; trim.position.y=0.93; trim.castShadow=false; R.torso.add(trim);
      for(const sx of [-0.48,0.48])for(let i=0;i<3;i++){ // layered shoulder plates, gold on top
        const sp=new THREE.Mesh(new THREE.BoxGeometry(0.42-i*0.06,0.07,0.52-i*0.06),i===0?gold:steel);
        sp.position.set(sx*(1+i*0.08),1.08-i*0.09,0); sp.castShadow=false; R.torso.add(sp);
      }
      // imperial galea: bright dome, gold browband, flared neck guard, cheek plates, crest
      const dome=noShadow(new THREE.Mesh(new THREE.SphereGeometry(0.58,8,6,0,Math.PI*2,0,Math.PI*0.55),steel));
      dome.position.y=0.95; dome.scale.y=0.85; R.head.add(dome);
      const brow=noShadow(cyl(0.55,0.58,0.09,0xd9a92e,9)); brow.position.y=0.85; R.head.add(brow);
      const neckR=noShadow(box(0.72,0.09,0.36,0xc2c9d4)); neckR.position.set(0,0.66,-0.44); neckR.rotation.x=0.35; R.head.add(neckR);
      for(const cx of [-0.5,0.5]){const cheek=noShadow(box(0.1,0.5,0.4,0xc2c9d4)); cheek.position.set(cx,0.5,0.12); R.head.add(cheek);}
      const crest=noShadow(box(0.14,0.34,1.0,0xb42222)); crest.position.y=1.4; R.head.add(crest);
      const crestG=noShadow(box(0.06,0.1,1.02,0xd9a92e)); crestG.position.y=1.21; R.head.add(crestG);
      // the gladius: mirror-bright, visibly edged, gold furniture
      const GG=weaponGrip(R.faR,-0.9);
      const gla=noShadow(box(0.16,1.15,0.1,0xf0f4f8)); gla.position.y=0.72; GG.add(gla);
      for(const ex of [-0.09,0.09]){const edge=noShadow(box(0.035,1.05,0.11,0xffffff));
        edge.position.set(ex,0.72,0); GG.add(edge);}
      const ggd=noShadow(box(0.42,0.08,0.14,0xd9a92e)); ggd.position.y=0.12; GG.add(ggd);
      const pomG=noShadow(new THREE.Mesh(new THREE.SphereGeometry(0.09,6,5),gold)); pomG.position.y=-0.08; GG.add(pomG);
      // the tower scutum — the biggest shield on the field, gold-rimmed
      const scutum=noShadow(new THREE.Mesh(new THREE.BoxGeometry(0.12,1.5,0.95),heraldryMat(u.team,u.id)));
      scutum.position.set(-0.12,-0.3,0.15); R.faL.add(scutum);
      for(const rz of [0.6,-0.3]){const rim=noShadow(box(0.13,1.54,0.06,0xd9a92e));
        rim.position.set(-0.12,-0.3,rz); R.faL.add(rim);}
      const boss=noShadow(new THREE.Mesh(new THREE.SphereGeometry(0.13,6,5),gold)); boss.position.set(-0.2,-0.3,0.15); R.faL.add(boss);
    }
    if(u.cls==="vanguard"){ // MEDIEVAL: mail + white surcoat + closed great helm + a giant two-hander
      // white surcoat over the mail, team-colored cross on the chest
      const surF=noShadow(box(0.62,0.95,0.08,0xe8e6df)); surF.position.set(0,0.5,0.42); R.torso.add(surF);
      const surB=noShadow(box(0.62,0.95,0.08,0xe8e6df)); surB.position.set(0,0.5,-0.42); R.torso.add(surB);
      const skirtV=noShadow(box(0.5,0.44,0.07,0xe8e6df)); skirtV.position.set(0,-0.12,0.36); R.torso.add(skirtV);
      const crossV=noShadow(box(0.14,0.62,0.03,tc)); crossV.position.set(0,0.5,0.47); R.torso.add(crossV);
      const crossH=noShadow(box(0.42,0.14,0.03,tc)); crossH.position.set(0,0.62,0.47); R.torso.add(crossH);
      for(const sx of [-0.5,0.5]){ // mail shoulder caps
        const mc=new THREE.Mesh(new THREE.SphereGeometry(0.24,7,6),texturedMat("metal",0x8d949c));
        mc.position.set(sx,1.0,0); mc.scale.set(1.1,0.8,1); mc.castShadow=false; R.torso.add(mc);
      }
      // the GREAT HELM: a closed steel drum — cross-slit face, gold band, flat crown
      const gh=noShadow(cyl(0.6,0.63,0.92,0xb4bcc6,10)); gh.position.y=0.6; R.head.add(gh);
      const ghTop=noShadow(cyl(0.63,0.63,0.09,0x9aa2ad,10)); ghTop.position.y=1.09; R.head.add(ghTop);
      const slit=noShadow(box(0.66,0.06,0.06,0x101014)); slit.position.set(0,0.76,0.56); R.head.add(slit);
      const breath=noShadow(box(0.06,0.4,0.06,0x101014)); breath.position.set(0,0.5,0.6); R.head.add(breath);
      const bandV=noShadow(box(0.09,0.92,0.03,0xd9a92e)); bandV.position.set(0,0.6,0.63); R.head.add(bandV);
      // the giant two-hander, carried high over the shoulder
      const ZG=weaponGrip(R.faR,-0.9);
      const zw=noShadow(box(0.17,1.9,0.12,0xdfe4ea)); zw.position.y=1.1; ZG.add(zw);
      const zgd=noShadow(box(0.64,0.1,0.16,0x8d949c)); zgd.position.y=0.13; ZG.add(zgd);
      const zpom=noShadow(new THREE.Mesh(new THREE.SphereGeometry(0.11,6,5),plainMat(0xd9a92e))); zpom.position.y=-0.1; ZG.add(zpom);
      // no shield — both fists belong on the hilt
    }
  }
  if(rig==="pike"){ // THE ANTI-CAVALRY LINE — six ages of spears
    if(u.cls==="spearman"){ // STONE: the clubman's cousin, flint on a stick
      kitStoneAge(R,tc);
      const SP=weaponGrip(R.faR,-1.35,0.3);
      const shaft=noShadow(cyl(0.05,0.06,2.4,0x7a5230,6)); shaft.position.y=0.7; SP.add(shaft);
      const lash=noShadow(cyl(0.075,0.075,0.14,0x4a3320,5)); lash.position.y=1.82; SP.add(lash);
      const flint=noShadow(cone(0.11,0.4,0x8d949c,4)); flint.position.y=2.05; SP.add(flint);
    }
    if(u.cls==="spearfighter"){ // BRONZE: Dendra panoply, bronze-tipped spear
      kitDendra(R,tc);
      const SP=weaponGrip(R.faR,-1.35,0.3);
      const shaft=noShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.055,0.06,2.8,6),texturedMat("wood",0x8a6a3f)));
      shaft.position.y=0.9; SP.add(shaft);
      const collar=noShadow(cyl(0.075,0.075,0.1,0x9a7532,6)); collar.position.y=2.28; SP.add(collar);
      const tipB=noShadow(cone(0.12,0.5,0xc9a44a,5)); tipB.position.y=2.55; SP.add(tipB);
    }
    if(u.cls==="impspear"){ // IRON: lamellar, a longer iron-tipped spear with wing lugs
      kitLamellar(R,tc);
      const SP=weaponGrip(R.faR,-1.35,0.3);
      const shaft=noShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.055,0.06,3.1,6),texturedMat("wood",0x8a6a3f)));
      shaft.position.y=1.05; SP.add(shaft);
      const collar=noShadow(cyl(0.08,0.08,0.1,0x687079,6)); collar.position.y=2.52; SP.add(collar);
      for(const lx of [-0.1,0.1]){const lug=noShadow(box(0.14,0.07,0.06,0x8d949c)); lug.position.set(lx,2.6,0); SP.add(lug);}
      const tipI=noShadow(cone(0.13,0.55,0xb9c0c9,5)); tipI.position.y=2.9; SP.add(tipI);
    }
    if(u.cls==="hoplite"){ // CLASSICAL: bronze panoply of the phalanx
      const bronze=texturedMat("metal",0xb08a3f), bronzeD=texturedMat("metal",0x9a7532);
      // muscled bronze cuirass with pteruges below
      const cuir=new THREE.Mesh(new THREE.CylinderGeometry(0.555,0.585,0.8,10),bronze);
      cuir.scale.z=0.8; cuir.position.y=0.58; cuir.castShadow=false; R.torso.add(cuir);
      for(const px of [-0.17,0.17]){const pec=new THREE.Mesh(new THREE.SphereGeometry(0.15,6,5),bronzeD);
        pec.position.set(px,0.76,0.4); pec.scale.set(1.25,1,0.5); pec.castShadow=false; R.torso.add(pec);}
      const absB=noShadow(box(0.3,0.24,0.05,0x9a7532)); absB.position.set(0,0.42,0.46); R.torso.add(absB);
      for(let i=0;i<6;i++){const pt=noShadow(box(0.14,0.32,0.05,0x7a5230)); pt.position.set(-0.33+i*0.13,0.04,0.4); R.torso.add(pt);}
      // Corinthian helm with a proud brush crest
      const dome=noShadow(new THREE.Mesh(new THREE.SphereGeometry(0.57,8,6,0,Math.PI*2,0,Math.PI*0.6),bronze));
      dome.position.y=0.85; R.head.add(dome);
      for(const cx of [-0.42,0.42]){const cheek=noShadow(box(0.12,0.55,0.42,0xb08a3f)); cheek.position.set(cx,0.42,0.2); R.head.add(cheek);}
      const nasal=noShadow(box(0.12,0.4,0.1,0xb08a3f)); nasal.position.set(0,0.6,0.52); R.head.add(nasal);
      const crestBase=noShadow(box(0.12,0.1,1.05,0xd9a92e)); crestBase.position.y=1.32; R.head.add(crestBase);
      const crest=noShadow(box(0.1,0.42,1.15,0xb42222)); crest.position.y=1.56; R.head.add(crest);
      // greaves live in the shared leg pass; sandals on the feet
      // the great hoplon
      const aspis=noShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.78,0.78,0.1,12),heraldryMat(u.team,u.id)));
      aspis.rotation.z=Math.PI/2; aspis.position.set(-0.14,-0.3,0.15); R.faL.add(aspis);
      const rim=noShadow(new THREE.Mesh(new THREE.TorusGeometry(0.76,0.05,5,14),plainMat(0xb08a3f)));
      rim.rotation.y=Math.PI/2; rim.position.set(-0.19,-0.3,0.15); R.faL.add(rim);
      // the doru: ash shaft, bronze leaf, sauroter butt-spike
      const SP=weaponGrip(R.faR,-1.35,0.3);
      const shaft=noShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.055,0.06,3.4,6),texturedMat("wood",0x8a6a3f)));
      shaft.position.y=1.1; SP.add(shaft);
      const leaf=noShadow(cone(0.13,0.55,0xc9a44a,5)); leaf.position.y=3.05; SP.add(leaf);
      const saur=noShadow(cone(0.08,0.3,0x9a7532,5)); saur.rotation.x=Math.PI; saur.position.y=-0.5; SP.add(saur);
    }
    if(u.cls==="pikeman"){ // MEDIEVAL: cuirass over gambeson, morion helm, plate boots
      const steel=texturedMat("metal",0xaeb6c0);
      for(let i=0;i<3;i++){ // quilted gambeson rows
        const q=new THREE.Mesh(new THREE.CylinderGeometry(0.555,0.575,0.17,10),texturedMat("cloth",0xcbb488));
        q.scale.z=0.8; q.position.y=0.16+i*0.16; q.castShadow=false; R.torso.add(q);
      }
      const cuirP=new THREE.Mesh(new THREE.CylinderGeometry(0.55,0.59,0.5,10),steel);
      cuirP.scale.z=0.8; cuirP.position.y=0.76; cuirP.castShadow=false; R.torso.add(cuirP);
      const ridgeP=noShadow(box(0.06,0.5,0.04,0x8d949c)); ridgeP.position.set(0,0.76,0.45); R.torso.add(ridgeP);
      // the MORION: swooping brim, high comb, team plume
      const domeM=noShadow(new THREE.Mesh(new THREE.SphereGeometry(0.5,9,7,0,Math.PI*2,0,Math.PI*0.55),steel));
      domeM.position.y=0.95; domeM.scale.set(0.95,0.9,1.1); R.head.add(domeM);
      const brimM=noShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.58,0.62,0.07,10),texturedMat("metal",0x9aa2ad)));
      brimM.scale.z=1.3; brimM.position.y=0.9; R.head.add(brimM);
      for(const bz of [-1,1]){const swoop=noShadow(box(0.28,0.24,0.28,0x9aa2ad));
        swoop.position.set(0,1.04,bz*0.82); swoop.rotation.x=bz*0.6; R.head.add(swoop);}
      const comb=noShadow(box(0.09,0.34,0.85,0xc2c9d4)); comb.position.y=1.42; R.head.add(comb);
      const plumeP=noShadow(cone(0.08,0.4,tc,5)); plumeP.position.set(0,1.56,-0.4); plumeP.rotation.x=0.5; R.head.add(plumeP);
      // the fancy spear: dark shaft, steel leaf, gold collar, team tassel
      const SP=weaponGrip(R.faR,-1.35,0.3);
      const shaft=noShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.055,0.06,3.5,6),texturedMat("wood",0x6b4a2b)));
      shaft.position.y=1.15; SP.add(shaft);
      const collarG=noShadow(cyl(0.08,0.08,0.12,0xd9a92e,6)); collarG.position.y=2.78; SP.add(collarG);
      const tass=noShadow(cone(0.11,0.32,tc,5)); tass.rotation.x=Math.PI; tass.position.y=2.62; SP.add(tass);
      const leafP=noShadow(cone(0.13,0.6,0xd5dae2,5)); leafP.position.y=3.15; SP.add(leafP);
    }
    if(u.cls==="halberdier"){ // ENLIGHTENMENT: gold-riveted brigandine, closed morion, the halberd
      const steel=texturedMat("metal",0xaeb6c0), goldH=plainMat(0xd9a92e);
      for(let ry=0;ry<3;ry++)for(let rx=0;rx<4;rx++){ // the rivet grid over the wool
        const riv=noShadow(new THREE.Mesh(new THREE.SphereGeometry(0.035,4,4),goldH));
        riv.position.set(-0.27+rx*0.18,0.3+ry*0.26,0.46); R.torso.add(riv);
      }
      for(const ty of [0.14,0.92]){ // gold trim bands top and bottom
        const trim=new THREE.Mesh(new THREE.CylinderGeometry(0.545,0.545,0.06,10),goldH);
        trim.scale.z=0.8; trim.position.y=ty; trim.castShadow=false; R.torso.add(trim);
      }
      for(const sx of [-0.5,0.5])for(let i=0;i<3;i++){ // steel pauldrons, gold on top
        const sp=new THREE.Mesh(new THREE.BoxGeometry(0.44-i*0.07,0.08,0.54-i*0.07),i===0?goldH:steel);
        sp.position.set(sx*(1+i*0.08),1.08-i*0.09,0); sp.castShadow=false; R.torso.add(sp);
      }
      // the CLOSED MORION: comb, swoops, gold trim, and a slitted face plate
      const domeH=noShadow(new THREE.Mesh(new THREE.SphereGeometry(0.5,9,7,0,Math.PI*2,0,Math.PI*0.55),steel));
      domeH.position.y=0.95; domeH.scale.set(0.95,0.9,1.1); R.head.add(domeH);
      const brimH=noShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.58,0.62,0.07,10),goldH.clone?goldH:goldH));
      brimH.scale.z=1.3; brimH.position.y=0.9; R.head.add(brimH);
      for(const bz of [-1,1]){const swoop=noShadow(box(0.28,0.24,0.28,0xd9a92e));
        swoop.position.set(0,1.04,bz*0.82); swoop.rotation.x=bz*0.6; R.head.add(swoop);}
      const combH=noShadow(box(0.09,0.36,0.85,0xd9a92e)); combH.position.y=1.42; R.head.add(combH);
      const faceP=noShadow(box(0.64,0.52,0.09,0xaeb6c0)); faceP.position.set(0,0.52,0.5); R.head.add(faceP);
      const slitH=noShadow(box(0.5,0.06,0.05,0x101014)); slitH.position.set(0,0.66,0.56); R.head.add(slitH);
      // the HALBERD: spike, axe blade, rear hook, gold collar
      const SP=weaponGrip(R.faR,-1.35,0.3);
      const shaft=noShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.065,3.3,6),texturedMat("wood",0x4a3826)));
      shaft.position.y=1.05; SP.add(shaft);
      const collarH=noShadow(cyl(0.085,0.085,0.12,0xd9a92e,6)); collarH.position.y=2.3; SP.add(collarH);
      const axe=noShadow(box(0.05,0.55,0.42,0xd5dae2)); axe.position.set(0,2.62,0.28); SP.add(axe);
      const axeEdge=noShadow(box(0.06,0.57,0.06,0xf0f4f8)); axeEdge.position.set(0,2.62,0.5); SP.add(axeEdge);
      const hook=noShadow(box(0.05,0.3,0.22,0xb9c0c9)); hook.position.set(0,2.58,-0.2); hook.rotation.x=0.35; SP.add(hook);
      const spike=noShadow(cone(0.1,0.55,0xd5dae2,5)); spike.position.y=3.15; SP.add(spike);
    }
  }
  if(rig==="bow"){ // THE RANGED LINE — six ages from slung stones to rifled steel
    if(u.cls==="slinger"){ // STONE: hides, a hip-bag of stones, the whirling sling
      kitStoneAge(R,tc);
      const SL=new THREE.Group(); SL.position.set(0,-0.54,0.12); R.faR.add(SL);
      for(const sx of [-0.035,0.035]){const strap=noShadow(box(0.03,0.72,0.02,0x5a3c22));
        strap.position.set(sx,-0.36,0); SL.add(strap);}
      const pouch=noShadow(new THREE.Mesh(new THREE.SphereGeometry(0.13,6,5),texturedMat("hide",0x6b4a2b)));
      pouch.scale.y=0.7; pouch.position.y=-0.74; SL.add(pouch);
      const stone=noShadow(new THREE.Mesh(new THREE.SphereGeometry(0.09,5,4),plainMat(0x8d949c))); stone.position.y=-0.68; SL.add(stone);
      const bag=noShadow(new THREE.Mesh(new THREE.SphereGeometry(0.2,6,5),texturedMat("hide",0x7a5230)));
      bag.scale.set(1,0.8,0.7); bag.position.set(0.42,0.12,0.28); R.torso.add(bag);
      for(const [ox,oz] of [[0.38,0.36],[0.48,0.28]]){const st=noShadow(new THREE.Mesh(new THREE.SphereGeometry(0.06,4,4),plainMat(0x9aa2ad)));
        st.position.set(ox,0.32,oz); R.torso.add(st);}
    }
    if(u.cls==="archer")kitSkinsArcher(R,tc,false);   // BRONZE: skins, wool, linen, team kilt
    if(u.cls==="imparcher")kitSkinsArcher(R,tc,true); // IRON: the same, gone fancy
    if(u.cls==="comparcher"){ // CLASSICAL: pinned wool chiton, pilos cap, sandals
      const chitonM=texturedMat("cloth",0xe3dbc6);
      const chi=new THREE.Mesh(new THREE.CylinderGeometry(0.555,0.6,0.85,10),chitonM);
      chi.scale.z=0.8; chi.position.y=0.5; chi.castShadow=false; R.torso.add(chi);
      const pleats=new THREE.Mesh(new THREE.CylinderGeometry(0.6,0.67,0.34,10),chitonM);
      pleats.scale.z=0.8; pleats.position.y=-0.02; pleats.castShadow=false; R.torso.add(pleats);
      for(const px of [-0.28,0.28]){const pin=noShadow(new THREE.Mesh(new THREE.SphereGeometry(0.07,5,4),plainMat(0xd9a92e)));
        pin.position.set(px,0.96,0.36); R.torso.add(pin);} // shoulder pins
      const beltC=new THREE.Mesh(new THREE.CylinderGeometry(0.57,0.57,0.12,10),texturedMat("cloth",tc));
      beltC.scale.z=0.8; beltC.position.y=0.3; beltC.castShadow=false; R.torso.add(beltC); // team waist cord
      const pilos=noShadow(cone(0.46,0.8,0xcbb488,9)); pilos.position.y=1.05; R.head.add(pilos); // the felt pilos
      const roll=noShadow(cyl(0.48,0.5,0.12,0xb8a878,9)); roll.position.y=0.7; R.head.add(roll);
    }
    if(u.cls==="crossbowman"){ // MEDIEVAL: lincoln green and the bycocket
      const green=0x2f4f2a;
      const hood=noShadow(cone(0.62,0.55,green,9)); hood.position.y=1.0; hood.rotation.x=0.12; R.torso.add(hood); // hood down the shoulders
      const beltX=new THREE.Mesh(new THREE.CylinderGeometry(0.55,0.55,0.13,10),texturedMat("hide",0x4a3a26));
      beltX.scale.z=0.8; beltX.position.y=0.22; beltX.castShadow=false; R.torso.add(beltX);
      // the BYCOCKET: swept crown, forward point, upturned back brim, team feather
      const crownB=noShadow(new THREE.Mesh(new THREE.SphereGeometry(0.5,8,6,0,Math.PI*2,0,Math.PI*0.55),plainMat(green)));
      crownB.position.y=0.92; crownB.scale.set(0.9,0.8,1.3); crownB.rotation.x=-0.12; R.head.add(crownB);
      const point=noShadow(cone(0.16,0.6,green,5)); point.rotation.x=1.25; point.position.set(0,1.02,0.62); R.head.add(point);
      const backBrim=noShadow(box(0.55,0.22,0.1,0x223d1f)); backBrim.position.set(0,1.1,-0.52); backBrim.rotation.x=-0.4; R.head.add(backBrim);
      const feather=noShadow(cone(0.06,0.6,tc,4)); feather.position.set(0.28,1.3,-0.25); feather.rotation.x=-0.7; feather.rotation.z=-0.25; R.head.add(feather);
    }
    if(u.cls==="skirmisher"){ // ENLIGHTENMENT: Rogers' Rangers — scrappy buckskin and a plain rifle
      for(let i=0;i<5;i++){const fr=noShadow(box(0.05,0.16,0.04,0x4a3a26)); // buckskin fringe
        fr.position.set(-0.3+i*0.15,0.52,0.44); R.torso.add(fr);}
      const strapS=noShadow(box(0.26,0.9,0.05,0x4a3a26)); strapS.rotation.z=0.55; strapS.position.set(-0.06,0.62,0.42); R.torso.add(strapS);
      const horn=noShadow(cone(0.09,0.42,0xe8dfc8,6)); horn.rotation.z=1.1; horn.rotation.x=0.4;
      horn.position.set(0.4,0.2,0.32); R.torso.add(horn); // the powder horn
      const satchel=noShadow(new THREE.Mesh(new THREE.BoxGeometry(0.34,0.28,0.14),texturedMat("hide",0x3a2e1e)));
      satchel.position.set(-0.42,0.14,0.3); R.torso.add(satchel);
      const bedroll=noShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.14,0.14,1.05,7),texturedMat("cloth",tc)));
      bedroll.rotation.z=0.9; bedroll.position.set(0,0.72,-0.44); R.torso.add(bedroll); // team blanket roll
      // weathered tricorne, tall team plume
      const triS=noShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.82,0.82,0.07,3),plainMat(0x2b2318)));
      triS.rotation.y=Math.PI/6; triS.position.y=1.04; R.head.add(triS);
      const crownS=noShadow(cyl(0.44,0.4,0.38,0x2b2318,9)); crownS.position.y=1.2; R.head.add(crownS);
      const plumeS=noShadow(cone(0.09,0.62,tc,5)); plumeS.position.set(0.3,1.42,0.12); plumeS.rotation.z=-0.35; R.head.add(plumeS);
      // the ranger's rifle — plain iron and walnut; R.musketG wires the shouldered aim for free
      const MG=new THREE.Group(); MG.position.set(0,-0.5,0.25); MG.rotation.x=0.15;
      const butt=noShadow(box(0.12,0.18,0.46,0x4a3826)); butt.position.set(0,-0.06,-0.34); butt.rotation.x=0.35; MG.add(butt);
      const breech=noShadow(box(0.09,0.13,0.3,0x352a1c)); breech.position.set(0,0,-0.04); MG.add(breech);
      const foreW=noShadow(box(0.08,0.09,1.0,0x4a3826)); foreW.position.set(0,-0.03,0.55); MG.add(foreW);
      const barrel=noShadow(cyl(0.04,0.045,1.7,0x2e2e32,7)); barrel.rotation.x=Math.PI/2; barrel.position.set(0,0.04,0.72); MG.add(barrel);
      const bandR=noShadow(cyl(0.055,0.055,0.05,0x4a4e56,7)); bandR.rotation.x=Math.PI/2; bandR.position.set(0,0.04,1.35); MG.add(bandR);
      R.musketG=MG; R.faR.add(MG);
    }
    if(u.cls==="crossbowman"){ // the crossbow, now with a stirrup and string
      const stockM=noShadow(box(0.14,0.16,1.1,0x6b4a2b)); stockM.position.set(0,-0.45,0.4); R.faR.add(stockM);
      const bowArm=noShadow(box(0.95,0.08,0.1,0x8a6a3f)); bowArm.position.set(0,-0.45,0.85); R.faR.add(bowArm);
      const stringX=noShadow(box(0.9,0.03,0.03,0xe8e4d8)); stringX.position.set(0,-0.45,0.72); R.faR.add(stringX);
      const stirrup=noShadow(new THREE.Mesh(new THREE.TorusGeometry(0.09,0.03,4,8),plainMat(0x4a4e56)));
      stirrup.position.set(0,-0.45,0.96); R.faR.add(stirrup);
    }else if(u.cls!=="slinger"&&u.cls!=="skirmisher"){ // the wooden bow for tiers 1-3
      const BG=new THREE.Group(); BG.position.set(0,-0.54,0.18); R.faL.add(BG); R.bowG=BG;
      const br=0.55+tier*0.06;
      const bowGeo=new THREE.TorusGeometry(br,0.07,5,10,Math.PI);
      bowGeo.rotateZ(-Math.PI/2); bowGeo.rotateY(-Math.PI/2); // chord along the forearm, belly forward
      const bow=new THREE.Mesh(bowGeo,mat(0x6b4a2b)); bow.castShadow=false; BG.add(bow);
      const string=noShadow(cyl(0.018,0.018,br*2,0xe8e4d8,4)); string.position.z=-0.02; BG.add(string);
      BG.position.z=0.18-br*0.85; // slide the whole bow back: the fist grips the WOODEN belly, the string rides behind it
    }
    if(u.cls!=="slinger"&&u.cls!=="skirmisher"){ // the quiver, with arrows to spare
      const quiver=noShadow(cyl(0.2,0.2,0.9,0x6b4a2b)); quiver.position.set(-0.35,0.6,-0.5); quiver.rotation.x=0.4; R.torso.add(quiver);
      for(let i=0;i<3;i++){const sh=noShadow(cyl(0.03,0.03,0.5,0x8a6a3f,4));
        sh.rotation.x=0.4; sh.position.set(-0.43+i*0.08,1.05,-0.66); R.torso.add(sh);
        const fl=noShadow(box(0.08,0.12,0.08,i===1?tc:0xe8e2d0)); fl.rotation.x=0.4; fl.position.set(-0.43+i*0.08,1.28,-0.76); R.torso.add(fl);}
    }
  }
  if(rig==="musket"){ // ENLIGHTENMENT: the King's Musketeers — cassock, tricorne, gold everywhere
    const white=plainMat(0xf0ede4), goldM=plainMat(0xd9a92e);
    // the skirted cassock with a gold-fringed hem and buttons
    const skirt=new THREE.Mesh(new THREE.CylinderGeometry(0.54,0.68,0.52,10),texturedMat("uniform",tc));
    skirt.scale.z=0.8; skirt.position.y=0.02; skirt.castShadow=false; R.torso.add(skirt);
    const hem=noShadow(cyl(0.69,0.69,0.06,0xd9a92e,10)); hem.scale.z=0.8; hem.position.y=-0.22; R.torso.add(hem);
    for(let i=0;i<4;i++){const btn=noShadow(new THREE.Mesh(new THREE.SphereGeometry(0.045,5,4),goldM));
      btn.position.set(0.16,0.78-i*0.16,0.45); R.torso.add(btn);}
    // the white fleur-de-lis cross across the breast
    const fV=noShadow(box(0.13,0.66,0.03,0xf0ede4)); fV.position.set(-0.12,0.56,0.46); R.torso.add(fV);
    const fH=noShadow(box(0.44,0.13,0.03,0xf0ede4)); fH.position.set(-0.12,0.62,0.46); R.torso.add(fH);
    for(const [px,py] of [[-0.12,0.92],[-0.12,0.26],[-0.37,0.62],[0.13,0.62]]){ // lily tips
      const tip=noShadow(new THREE.Mesh(new THREE.SphereGeometry(0.06,5,4),white)); tip.position.set(px,py,0.46); R.torso.add(tip);}
    for(const sx of [-0.52,0.52])for(let i=0;i<3;i++){ // gold shoulder fringe
      const fr=noShadow(box(0.06,0.16,0.28,0xb8871f)); fr.position.set(sx*1.06,0.8,-0.16+i*0.16); R.torso.add(fr);}
    const bando=new THREE.Mesh(new THREE.BoxGeometry(0.3,1.0,0.07),plainMat(0x3a2c1e));
    bando.rotation.z=0.55; bando.position.set(0.1,0.72,0.43); bando.castShadow=false; R.torso.add(bando);
    for(let i=0;i<4;i++){const charge=new THREE.Mesh(new THREE.CylinderGeometry(0.045,0.045,0.14,5),plainMat(0xe8e4d8));
      charge.rotation.z=0.55; charge.position.set(-0.2+i*0.18,0.92-i*0.13,0.47); charge.castShadow=false; R.torso.add(charge);}
    // the TRICORNE v2: a real crown swallowing the skull, a flat triangular brim, cocked flaps
    const crownT=noShadow(cyl(0.45,0.4,0.4,0x1d232e,9)); crownT.position.y=1.18; R.head.add(crownT);
    const edgeT=noShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.95,0.95,0.045,3),plainMat(0xd9a92e)));
    edgeT.rotation.y=Math.PI/6; edgeT.position.y=1.0; R.head.add(edgeT);
    const brimT=noShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.88,0.88,0.07,3),plainMat(0x1d232e)));
    brimT.rotation.y=Math.PI/6; brimT.position.y=1.05; R.head.add(brimT);
    const featherT=noShadow(cone(0.07,0.44,0xf0ede4,4)); featherT.position.set(0.4,1.3,0.26); featherT.rotation.z=-0.5; R.head.add(featherT);
    // the FULL MUSKET: one gun, one group — animateUnit pitches R.musketG when shouldered
    const MG=new THREE.Group(); MG.position.set(0,-0.5,0.25); MG.rotation.x=0.15;
    const butt=noShadow(box(0.13,0.2,0.5,0x6b4a2b)); butt.position.set(0,-0.06,-0.38); butt.rotation.x=0.35; MG.add(butt);
    const breech=noShadow(box(0.1,0.15,0.34,0x4a3826)); breech.position.set(0,0,-0.05); MG.add(breech);
    const lock=noShadow(box(0.05,0.11,0.18,0xd9a92e)); lock.position.set(0.07,0,-0.02); MG.add(lock);
    const foreW=noShadow(box(0.09,0.1,1.15,0x6b4a2b)); foreW.position.set(0,-0.035,0.62); MG.add(foreW);
    const barrel=noShadow(cyl(0.045,0.05,1.95,0x3a3a3a,7)); barrel.rotation.x=Math.PI/2; barrel.position.set(0,0.045,0.85); MG.add(barrel);
    const band1=noShadow(cyl(0.06,0.06,0.05,0xd9a92e,7)); band1.rotation.x=Math.PI/2; band1.position.set(0,0.045,1.6); MG.add(band1);
    const band2=noShadow(cyl(0.065,0.065,0.05,0xd9a92e,7)); band2.rotation.x=Math.PI/2; band2.position.set(0,0.02,0.25); MG.add(band2);
    // v84 BAYONET: socket ring + a long triangular blade past the muzzle — steel for what powder can't reach
    const bSock=noShadow(cyl(0.058,0.058,0.1,0x9aa2ad,6)); bSock.rotation.x=Math.PI/2; bSock.position.set(0,0.045,1.8); MG.add(bSock);
    const bayo=noShadow(new THREE.Mesh(new THREE.BoxGeometry(0.035,0.085,0.52),texturedMat("metal",0xc9ced6))); bayo.position.set(0,0.08,2.08); MG.add(bayo);
    const bayoTip=noShadow(cone(0.04,0.18,0xc9ced6,4)); bayoTip.rotation.x=Math.PI/2; bayoTip.position.set(0,0.08,2.42); MG.add(bayoTip);
    R.musketG=MG; R.faR.add(MG);
  }
  if(rig==="cavalry"){ // five ages in the saddle
    if(u.cls==="chariot"){ // BRONZE: the Egyptian charioteer, standing tall
      const band=noShadow(cyl(0.56,0.56,0.14,0xd9a92e,9)); band.position.y=0.62; R.head.add(band);
      const stripeB=noShadow(box(0.2,0.5,0.06,tc)); stripeB.position.set(0,0.9,-0.5); R.head.add(stripeB); // headcloth tail
      const broad=noShadow(cyl(0.62,0.66,0.16,0xd9a92e,9)); broad.position.y=1.18; R.torso.add(broad); // broad collar
      const SP=weaponGrip(R.faR,-1.3,0.35);
      const shaft=noShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.055,0.06,4.4,6),texturedMat("wood",0x8a6a3f)));
      shaft.position.y=1.5; SP.add(shaft);
      const tipC=noShadow(cone(0.12,0.5,0xc9a44a,5)); tipC.position.y=3.85; SP.add(tipC);
    }
    if(u.cls==="heavycav"){ // IRON: bronze scale over leather, the Boeotian helm
      const scaleM=texturedMat("metal",0xb08a3f);
      for(let i=0;i<3;i++){const row=new THREE.Mesh(new THREE.CylinderGeometry(0.555,0.58,0.2,10),i%2?scaleM:texturedMat("metal",0x9a7532));
        row.scale.z=0.8; row.position.y=0.3+i*0.24; row.castShadow=false; R.torso.add(row);}
      for(let rx=0;rx<4;rx++)for(let ry=0;ry<2;ry++){const sc=noShadow(box(0.1,0.12,0.04,0x9a7532));
        sc.position.set(-0.24+rx*0.16,0.4+ry*0.26,0.46); R.torso.add(sc);}
      const strapH=noShadow(box(0.2,0.9,0.06,0x4a3320)); strapH.rotation.z=0.6; strapH.position.set(0,0.6,0.44); R.torso.add(strapH);
      // the Boeotian: a soft bronze dome with a wide wavy fold-down brim
      const domeB=noShadow(new THREE.Mesh(new THREE.SphereGeometry(0.5,9,7,0,Math.PI*2,0,Math.PI*0.55),texturedMat("metal",0xb08a3f)));
      domeB.position.y=0.98; R.head.add(domeB);
      const brimB=noShadow(new THREE.Mesh(new THREE.SphereGeometry(0.68,9,5,0,Math.PI*2,Math.PI*0.32,Math.PI*0.22),texturedMat("metal",0x9a7532)));
      brimB.position.y=1.02; brimB.scale.y=1.5; R.head.add(brimB); // the drooping brim
      const knotB=noShadow(new THREE.Mesh(new THREE.SphereGeometry(0.08,5,4),plainMat(0x9a7532))); knotB.position.y=1.5; R.head.add(knotB);
      const SW=weaponGrip(R.faR,-1.25,0.35); // the iron cavalry sword
      const crossH=noShadow(box(0.34,0.07,0.09,0x9a7532)); crossH.position.y=0.14; SW.add(crossH);
      const bladeH=noShadow(box(0.07,1.2,0.16,0xb9c0c9)); bladeH.position.y=0.76; SW.add(bladeH);
      const tipH=noShadow(cone(0.085,0.2,0xb9c0c9,4)); tipH.position.y=1.46; SW.add(tipH);
      const pomH=noShadow(new THREE.Mesh(new THREE.SphereGeometry(0.08,5,4),plainMat(0x9a7532))); pomH.position.y=-0.14; SW.add(pomH);
    }
    if(u.cls==="cataphract"){ // CLASSICAL: mail head to toe, the faceless Sasanian helm
      for(let i=0;i<3;i++){const skirtM=new THREE.Mesh(new THREE.CylinderGeometry(0.56+i*0.02,0.58+i*0.02,0.2,10),texturedMat("metal",i%2?0x8d949c:0x7d858f));
        skirtM.scale.z=0.8; skirtM.position.y=0.14+i*0.3; skirtM.castShadow=false; R.torso.add(skirtM);}
      const domeC=noShadow(new THREE.Mesh(new THREE.SphereGeometry(0.52,9,7),texturedMat("metal",0x9aa2ad)));
      domeC.position.y=0.72; domeC.scale.y=1.15; R.head.add(domeC); // the whole head, encased
      const spikeC=noShadow(cone(0.09,0.4,0x9aa2ad,5)); spikeC.position.y=1.45; R.head.add(spikeC);
      const aventail=noShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.54,0.68,0.55,9),texturedMat("metal",0x7d858f)));
      aventail.position.y=0.12; R.head.add(aventail); // mail falling to the shoulders
      const eyeL=noShadow(box(0.14,0.05,0.05,0x0c0c10)); eyeL.position.set(-0.14,0.82,0.5); R.head.add(eyeL);
      const eyeR=noShadow(box(0.14,0.05,0.05,0x0c0c10)); eyeR.position.set(0.14,0.82,0.5); R.head.add(eyeR); // minute slits
      const noseS=noShadow(box(0.05,0.14,0.05,0x0c0c10)); noseS.position.set(0,0.62,0.52); R.head.add(noseS);
      const SC=weaponGrip(R.faR,-1.25,0.35); // the scimitar: a broad, sweeping curve
      const guardS=noShadow(cyl(0.12,0.12,0.06,0xd9a92e,7)); guardS.position.y=0.1; SC.add(guardS);
      const scA=noShadow(box(0.06,0.75,0.2,0xd5dae2)); scA.position.y=0.5; SC.add(scA);
      const scB=noShadow(box(0.06,0.6,0.24,0xd5dae2)); scB.position.set(0,1.05,0.13); scB.rotation.x=0.42; SC.add(scB);
      const scTip=noShadow(box(0.06,0.3,0.2,0xe8edf2)); scTip.position.set(0,1.4,0.34); scTip.rotation.x=0.8; SC.add(scTip);
    }
    if(u.cls==="knight"){ // MEDIEVAL: full plate, high plumes, the couched lance
      const cuirK=new THREE.Mesh(new THREE.CylinderGeometry(0.56,0.6,0.85,10),texturedMat("metal",0xb9c0c9));
      cuirK.scale.z=0.8; cuirK.position.y=0.55; cuirK.castShadow=false; R.torso.add(cuirK);
      const ridgeK=noShadow(box(0.06,0.8,0.05,0xd9a92e)); ridgeK.position.set(0,0.55,0.46); R.torso.add(ridgeK);
      for(const sx of [-0.5,0.5])for(let i=0;i<3;i++){
        const sp=new THREE.Mesh(new THREE.BoxGeometry(0.46-i*0.07,0.09,0.56-i*0.07),i===0?plainMat(0xd9a92e):texturedMat("metal",0xc2c9d4));
        sp.position.set(sx*(1+i*0.08),1.1-i*0.09,0); sp.castShadow=false; R.torso.add(sp);
      }
      const gh=noShadow(new THREE.Mesh(new THREE.SphereGeometry(0.52,9,7),texturedMat("metal",0xc2c9d4)));
      gh.position.y=0.75; gh.scale.set(0.95,1.15,0.95); R.head.add(gh); // rounded great bascinet
      const visor=noShadow(box(0.74,0.4,0.22,0xaeb6c0)); visor.position.set(0,0.78,0.4); R.head.add(visor);
      const slitK=noShadow(box(0.56,0.06,0.06,0x0c0c10)); slitK.position.set(0,0.88,0.52); R.head.add(slitK);
      const browG=noShadow(box(0.78,0.09,0.14,0xd9a92e)); browG.position.set(0,1.04,0.38); R.head.add(browG);
      const plumeBase=noShadow(cyl(0.1,0.12,0.12,0xd9a92e,6)); plumeBase.position.set(0,1.42,-0.08); R.head.add(plumeBase);
      for(let i=0;i<3;i++){const pl=noShadow(cone(0.085,0.66-Math.abs(i-1)*0.12,i===1?0xe8e2d0:tc,5));
        pl.position.set((i-1)*0.13,1.72,-0.14-Math.abs(i-1)*0.04); pl.rotation.x=-0.38; R.head.add(pl);} // gathered plumes, swept back
      const LL=5.4, LGr=weaponGrip(R.faR,-1.4,0.4);
      const lance=noShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.08,0.11,LL,7),texturedMat("wood",0x8a6a3f)));
      lance.position.y=LL/2-1.0; LGr.add(lance);
      const vamp=noShadow(cone(0.32,0.5,0xc2c9d4,8)); vamp.rotation.x=Math.PI; vamp.position.y=0.35; LGr.add(vamp); // the vamplate
      const tipL=noShadow(cone(0.14,0.55,0xdcdcdc,5)); tipL.position.y=LL-0.75; LGr.add(tipL);
      for(let i=0;i<3;i++){const band=noShadow(cyl(0.1,0.1,0.1,i%2?tc:0xe8e2d0,7)); band.position.y=1.4+i*0.9; LGr.add(band);} // striped
      const shield=noShadow(new THREE.Mesh(new THREE.BoxGeometry(0.15,1.05,0.85),heraldryMat(u.team,u.id))); shield.position.set(-0.1,-0.3,0.15); R.faL.add(shield);
    }
    if(u.cls==="dragoon"){ // ENLIGHTENMENT: wool and leather, saber and pistol
      const bandolier=noShadow(box(0.24,0.95,0.06,0x4a3320)); bandolier.rotation.z=0.55; bandolier.position.set(-0.04,0.6,0.44); R.torso.add(bandolier);
      for(let i=0;i<3;i++){const cart=noShadow(box(0.08,0.16,0.05,0xd8cdb4)); cart.position.set(-0.26+i*0.2,0.72-i*0.13,0.48); R.torso.add(cart);}
      const beltD=new THREE.Mesh(new THREE.CylinderGeometry(0.55,0.55,0.13,10),texturedMat("hide",0x3a2e1e));
      beltD.scale.z=0.8; beltD.position.y=0.2; beltD.castShadow=false; R.torso.add(beltD);
      // broad-brimmed hat, one side pinned up, team plume
      const brimD=noShadow(cyl(0.78,0.8,0.07,0x2b2318,10)); brimD.position.y=0.95; R.head.add(brimD);
      const pin=noShadow(box(0.7,0.3,0.08,0x2b2318)); pin.position.set(0.55,1.12,0); pin.rotation.z=0.55; R.head.add(pin); // the cocked side
      const crownD=noShadow(cyl(0.44,0.4,0.42,0x2b2318,9)); crownD.position.y=1.16; R.head.add(crownD);
      const plumeD=noShadow(cone(0.08,0.6,tc,5)); plumeD.position.set(0.45,1.5,0); plumeD.rotation.z=-0.5; R.head.add(plumeD);
      // the SABER: a curved blade of two angled segments
      const SB=weaponGrip(R.faR,-1.3,0.35);
      const guard=noShadow(new THREE.Mesh(new THREE.TorusGeometry(0.12,0.03,4,8),plainMat(0xd9a92e))); guard.position.y=0.08; SB.add(guard);
      const bl1=noShadow(box(0.05,0.85,0.14,0xd5dae2)); bl1.position.y=0.55; SB.add(bl1);
      const bl2=noShadow(box(0.05,0.6,0.13,0xd5dae2)); bl2.position.set(0,1.14,0.09); bl2.rotation.x=0.3; SB.add(bl2);
      // the PISTOL rides the off hand — six shots, then the saber talks
      const PG=new THREE.Group(); PG.position.set(0,-0.5,0.25); PG.rotation.x=0.35; R.faL.add(PG); R.pistolG=PG;
      const grip=noShadow(box(0.1,0.24,0.12,0x4a3826)); grip.position.y=-0.08; PG.add(grip);
      const barrelP=noShadow(cyl(0.045,0.05,0.55,0x2e2e32,7)); barrelP.rotation.x=Math.PI/2; barrelP.position.set(0,0.06,0.3); PG.add(barrelP);
      const lockP=noShadow(box(0.07,0.09,0.14,0xd9a92e)); lockP.position.set(0.05,0.04,0.06); PG.add(lockP);
    }
  }
  if(rig==="scout"){ // built for speed: leather, nothing heavier
    const capS=noShadow(new THREE.Mesh(new THREE.SphereGeometry(0.54,8,6,0,Math.PI*2,0,Math.PI*0.5),texturedMat("hide",0x7a5230)));
    capS.position.y=0.74; R.head.add(capS);
    const stitchS=noShadow(cyl(0.55,0.56,0.09,0x5a3c22,9)); stitchS.position.y=0.72; R.head.add(stitchS);
    if(u.cls==="elitescout"){ // the elite ride in mail
      for(let i=0;i<3;i++){const rowE=new THREE.Mesh(new THREE.CylinderGeometry(0.555,0.58,0.2,10),texturedMat("metal",i%2?0x8d949c:0x7d858f));
        rowE.scale.z=0.8; rowE.position.y=0.24+i*0.28; rowE.castShadow=false; R.torso.add(rowE);}
      const coif=noShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.5,0.6,0.4,9),texturedMat("metal",0x7d858f)));
      coif.position.y=0.28; R.head.add(coif); // mail coif under the cap
    }else{ // plain scout: crossed jerkin straps, light as it gets
      const j1=noShadow(box(0.2,0.95,0.05,0x6b4a2b)); j1.rotation.z=0.55; j1.position.set(0,0.6,0.44); R.torso.add(j1);
      const j2=noShadow(box(0.2,0.95,0.05,0x6b4a2b)); j2.rotation.z=-0.55; j2.position.set(0,0.6,0.44); R.torso.add(j2);
    }
    const SPs=weaponGrip(R.faR,-1.25,0.35);
    const shaftS=noShadow(cyl(0.05,0.06,2.8,0x8a6a3f,6)); shaftS.position.y=0.9; SPs.add(shaftS);
    const tipS=noShadow(cone(0.11,0.4,0x8d949c,4)); tipS.position.y=2.5; SPs.add(tipS);
    if(CLS[u.cls].tier>=4){const banner=noShadow(box(0.7,0.5,0.06,tc)); banner.position.set(0,1.9,0.1); SPs.add(banner);}
  }
  if(rig==="priest"){
    const aura=new THREE.Mesh(new THREE.RingGeometry(CLS[u.cls].heal.rng-0.3,CLS[u.cls].heal.rng,32),
      new THREE.MeshBasicMaterial({color:0x6fdc7a,transparent:true,opacity:0.16,side:THREE.DoubleSide}));
    aura.rotation.x=-Math.PI/2; aura.position.y=0.07; u.body.add(aura);
    const hoodP=noShadow(cone(0.92,0.9,0xe8e2d0,6)); hoodP.position.y=1.24; R.head.add(hoodP);
    const robe=noShadow(new THREE.Mesh(new THREE.BoxGeometry(1.2,0.9,0.8),texturedMat("robe",0xe8e2d0))); robe.position.y=0.15; R.torso.add(robe);
    // the staff grips the fist like the villager's tools: hand-anchored, carried at the ready, angled OUT (no more shoulder impalement)
    const SG=weaponGrip(R.faR,-0.9);
    SG.rotation.x-=Math.PI/4; // leveled 45° off vertical, same at-ready carry the tools use
    const staff=noShadow(cyl(0.06,0.06,2.0,0x8a6a3f)); staff.position.y=0.55; SG.add(staff); // gripped ~1/4 up the haft: a little butt below the fist, the length held outward
    const orb=noShadow(new THREE.Mesh(new THREE.SphereGeometry(0.16,6,5),mat(0xffe27a))); orb.position.y=1.6; SG.add(orb); // the golden orb crowns the outward tip
  }
  if(rig==="barbarian"){ // CAMP BARBARIAN: furs, wild hair, a knobbed club
    const hairM=0x3a2814;
    const mane=noShadow(box(0.78,0.5,0.72,hairM)); mane.position.y=1.15; R.head.add(mane); // a wild shag
    const beard=noShadow(box(0.5,0.42,0.18,hairM)); beard.position.set(0,0.45,0.32); R.head.add(beard);
    const vest=noShadow(new THREE.Mesh(new THREE.BoxGeometry(1.25,0.95,0.85),texturedMat("hide",0x6b4a2b))); vest.position.y=0.1; R.torso.add(vest);
    for(const s of [-1,1]){const shp=noShadow(new THREE.Mesh(new THREE.SphereGeometry(0.34,6,5),texturedMat("hide",0x5a4028))); shp.position.set(s*0.62,0.6,0); R.torso.add(shp);} // fur shoulders
    const neckB=noShadow(box(0.5,0.1,0.1,0xe8e4d8)); neckB.position.set(0,0.52,0.4); R.torso.add(neckB); // a bone necklace
    const CG=weaponGrip(R.faR,-0.9); CG.rotation.x-=Math.PI/4; // the tools' at-ready carry
    const haft=noShadow(new THREE.Mesh(new THREE.BoxGeometry(0.13,1.15,0.13),texturedMat("wood",0x6b4a2b))); haft.position.y=0.3; CG.add(haft);
    const knob=noShadow(new THREE.Mesh(new THREE.SphereGeometry(0.26,6,5),texturedMat("wood",0x5a4028))); knob.position.y=0.95; CG.add(knob);
    for(let i=0;i<3;i++){const spike=noShadow(cone(0.06,0.16,0x9aa2ad,4)); const a=i*2.1; spike.position.set(Math.cos(a)*0.24,0.95+((i%2)?0.1:-0.06),Math.sin(a)*0.24); spike.rotation.z=-Math.cos(a)*1.2; spike.rotation.x=Math.sin(a)*1.2; CG.add(spike);}
  }
  if(rig==="viking"||rig==="vikingboss"){ // SHORE RAIDERS: horned helms, round shields, bearded axes
    const boss=rig==="vikingboss";
    const helm=noShadow(new THREE.Mesh(new THREE.SphereGeometry(0.52,7,5,0,Math.PI*2,0,Math.PI*0.55),texturedMat("metal",boss?0x8a7a3a:0x7d848d)));
    helm.position.y=1.05; helm.scale.y=1.15; R.head.add(helm);
    for(const s of [-1,1]){const horn=noShadow(cone(0.11,boss?0.75:0.5,0xe8e4d8,5)); horn.position.set(s*0.5,1.25,0); horn.rotation.z=s*0.9; R.head.add(horn);}
    const beard=noShadow(box(0.52,0.5,0.2,boss?0xb8622e:0x8a5a30)); beard.position.set(0,0.4,0.3); R.head.add(beard); // the chieftain's is fire-red
    const tunic=noShadow(new THREE.Mesh(new THREE.BoxGeometry(1.28,0.95,0.85),texturedMat("cloth",boss?0x4a5a6c:0x6a7a8c))); tunic.position.y=0.1; R.torso.add(tunic);
    const belt=noShadow(box(1.3,0.18,0.88,0x4a3320)); belt.position.y=-0.35; R.torso.add(belt);
    // a round war shield on the LEFT forearm
    const sh=noShadow(new THREE.Mesh(new THREE.CylinderGeometry(boss?0.85:0.65,boss?0.85:0.65,0.12,10),plainMat(boss?0x2b3542:0x8e1f1f)));
    sh.rotation.z=Math.PI/2; sh.position.set(-0.15,-0.35,0); R.faL.add(sh);
    const shBoss=noShadow(new THREE.Mesh(new THREE.SphereGeometry(0.14,5,4),plainMat(0x9aa2ad))); shBoss.position.set(-0.24,-0.35,0); R.faL.add(shBoss);
    // the axe: one hand for raiders, a long-hafted monster for the chieftain
    const AG=weaponGrip(R.faR,-0.9); AG.rotation.x-=Math.PI/4;
    const haft=noShadow(new THREE.Mesh(new THREE.BoxGeometry(0.12,boss?1.7:1.05,0.12),texturedMat("wood",0x6b4a2b))); haft.position.y=boss?0.55:0.25; AG.add(haft);
    const bit=noShadow(new THREE.Mesh(new THREE.BoxGeometry(boss?0.65:0.45,boss?0.5:0.36,0.1),texturedMat("metal",0x9aa2ad)));
    bit.position.set(boss?0.34:0.24,boss?1.25:0.7,0); AG.add(bit);
    const horn2=noShadow(new THREE.Mesh(new THREE.BoxGeometry(0.2,0.16,0.09),plainMat(0x7d848d))); horn2.position.set(-0.14,boss?1.25:0.7,0); AG.add(horn2); // the back-spike
    if(boss){
      u.body.scale.setScalar(1.45); // the chieftain towers over his crew
      const cloak=noShadow(new THREE.Mesh(new THREE.BoxGeometry(1.4,1.5,0.22),texturedMat("hide",0x5a3020))); cloak.position.set(0,-0.1,-0.5); R.torso.add(cloak);
    }
  }
  if(rig==="king"){
    const crownG=new THREE.Mesh(new THREE.CylinderGeometry(0.66,0.6,0.52,8),texturedMat("metal",0xe8c53a));const crown=noShadow(crownG); crown.position.y=1.36; R.head.add(crown);
    for(let i=0;i<5;i++){
      const spike=noShadow(cone(0.09,0.28,0xe8c53a,4));
      const a=i/5*Math.PI*2;
      spike.position.set(Math.cos(a)*0.36,1.1,Math.sin(a)*0.36); R.head.add(spike);
    }
    const cape=noShadow(new THREE.Mesh(new THREE.BoxGeometry(1.2,1.6,0.12),texturedMat("cloth",0x8e1f1f))); cape.position.set(0,0.35,-0.45); R.torso.add(cape);
    const scepter=noShadow(box(0.14,1.4,0.14,0xe8c53a)); scepter.position.set(0,-0.5,0.25); scepter.rotation.x=-0.7; R.faR.add(scepter);
  }
  refreshBar(u);
}

// ---------- name tags: a small billboard above every player-controlled body ----------
function _makeTagSprite(text,team){
  const c=document.createElement("canvas"); c.width=256; c.height=64;
  const g=c.getContext("2d");
  if(g.clearRect){ // headless stubs no-op all of this safely
    g.clearRect(0,0,256,64);
    g.font="bold 34px Georgia, serif"; g.textAlign="center"; g.textBaseline="middle";
    g.lineWidth=6; g.strokeStyle="rgba(20,12,4,0.85)"; g.strokeText(text,128,32);
    g.fillStyle=team===BLUE?"#9db8ff":"#ffb0a6"; g.fillText(text,128,32);
  }
  const tex=new THREE.CanvasTexture(c);
  tex.magFilter=THREE.LinearFilter; tex.minFilter=THREE.LinearFilter; tex.generateMipmaps=false;
  const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,transparent:true,depthWrite:false}));
  sp.scale.set(3.4,0.85,1); sp.center.set(0.5,0);
  return sp;
}
function setNameTag(u,name){
  if(!u)return;
  const _ty=(CLS[u.cls]&&CLS[u.cls].rig==="oxcart")?OX_TAG_Y():(CLS[u.cls]&&CLS[u.cls].mounted)?6.2:5.1; // v113: the wain rides high
  if(u._tag&&u._tagText===name){u._tag.position.y=_ty;return;} // track mounts
  if(u._tag){u.root.remove(u._tag);if(u._tag.material.map)u._tag.material.map.dispose();u._tag.material.dispose();}
  u._tag=_makeTagSprite(name,u.team); u._tagText=name;
  u._tag.position.y=_ty; // just above the health bar
  u.root.add(u._tag);
}
function clearNameTag(u){
  if(u&&u._tag){u.root.remove(u._tag);if(u._tag.material.map)u._tag.material.map.dispose();u._tag.material.dispose();u._tag=null;u._tagText=null;}
}
function syncNameTags(sc){ // sc rows: [name, score, team, unitId, lvl?] — tag those bodies, untag the rest
  const want={};
  for(const row of sc){if(row.length>=4&&typeof row[3]==="number")
    want[row[3]]=row[0]+(row[4]?" ⭐"+row[4]:"");} // v87: everyone sees a player's LEVEL over their head
  for(const u of units){
    if(want[u.id]!==undefined&&u!==player)setNameTag(u,want[u.id]);
    else if(u._tag)clearNameTag(u);
  }
}
// v99 CARGO VISUALS: every client can SEE what a cart hauls. Hosts compute the load
// from live state; guests read the cargo byte the snapshot delivered (u._cargo).
function cargoFrac(u){
  if(typeof u._cargo==="number")return u._cargo; // a guest's view of everyone else
  if(u.cls==="oxcart")return Math.min(1,((u.carry&&u.carry.wood)||0)/300);
  if(u.cls==="trader")return u.tradeLoaded?1:0;
  if(u.bot&&u.bot.role==="cart")return u.tradePhase==="back"?1:0;
  return 0;
}
function updateCargoVisual(u){
  const R=u.rig; if(!R)return;
  const load=cargoFrac(u);
  if(R.goods)R.goods.visible=load>0.01;      // trade carts: the gold rides only when loaded
  if(R.logs){                                 // the ox: the log pile grows with the haul
    R.logs.visible=load>0.01;
    const n=R.logs.children.length, ln=Math.max(1,Math.ceil(load*n)); // v113: the stack is 8 logs now, not 6
    R.logs.children.forEach((lg,i)=>{lg.visible=i<ln;});
  }
}
function refreshBar(u){
  if(u.bar){ // v122: dispose, don't just detach — two SpriteMaterials per class change adds up
    u.root.remove(u.bar.bg); u.root.remove(u.bar.fg);
    if(u.bar.bg.material)u.bar.bg.material.dispose();
    if(u.bar.fg.material)u.bar.fg.material.dispose();
  }
  const rg=CLS[u.cls].rig;
  const barY = CLS[u.cls].mounted?5.4
    :rg==="treb"?16:rg==="ram"?11.5:rg==="catapult"?9
    :rg==="oxcart"?OX_BAR_Y() // v113: the wain rides high — the bar tracks OXSCALE
    :rg==="cannon"?8:4.3;
  u.bar=makeBar(u.root,barY,1.7,u.team===BLUE?0x53d769:0xff6b5e);
  if(u.isPlayer){u.bar.bg.visible=false;u.bar.fg.visible=false;} // you have the HUD bar
}

// ---------- optional glTF models (see assets/models/README-ASSETS.md) ----------
function tryAttachModel(u){
  const M=MODELS[u.cls]; if(!M)return false;
  u._modelBody=true; // its geometry is SHARED with MODELS[cls] — never dispose it (see buildBodyFor)
  const inst=(THREE.SkeletonUtils&&THREE.SkeletonUtils.clone)?THREE.SkeletonUtils.clone(M.scene):M.scene.clone();
  inst.traverse(o=>{
    if(o.isMesh){
      o.castShadow=true;o.frustumCulled=false;
      if(o.material){ // FBX metallic factors render as charcoal under filmic light
        if(o.material.metalness!==undefined)o.material.metalness=0;
        if(o.material.roughness!==undefined)o.material.roughness=0.9;
        o.material.needsUpdate=true;
      }
      if(o.material&&o.material.map){ // point-sampled skins: sharp PS1 pixels, no smear
        const t=o.material.map;
        t.magFilter=THREE.NearestFilter;t.minFilter=THREE.NearestFilter;
        t.generateMipmaps=false;t.needsUpdate=true;
      }
    }
  });
  const c=M.cfg;
  inst.scale.setScalar(c.scale||1);
  inst.position.y=c.y||0;
  inst.rotation.y=(c.rotY!==undefined)?c.rotY:0;
  u.body.add(inst);
  if(M.clips&&M.clips.length){
    u.mixer=new THREE.AnimationMixer(inst);
    const find=re=>{const cl=M.clips.find(k=>re.test(k.name));return cl?u.mixer.clipAction(cl):null;};
    u.actions={
      idle:find(/idle/i)||u.mixer.clipAction(M.clips[0]),
      walk:find(/walk|run|gallop/i),
      attack:find(/attack|slash|shoot|melee|punch|stab/i),
      work:find(/work|gather|chop|farm/i)
    };
    if(u.actions.work)u.actions.work.setLoop(THREE.LoopRepeat);
    if(u.actions.attack){
      const dur=u.actions.attack.getClip().duration;
      if(!u.actions.work&&dur>1.5){
        // no Work clip: a long "attack" doubles as the work loop (old villager behavior)
        u.actions.attack.setLoop(THREE.LoopRepeat);
      }else{
        // real strike: one-shot, TIME-SCALED to land within one attack cooldown
        u.actions.attack.setLoop(THREE.LoopOnce);
        u.actions.attack.clampWhenFinished=true;
        u.attackAnimDur=0.9;
        u.actions.attack.timeScale=dur/u.attackAnimDur;
      }
    }
    if(u.actions.idle)u.actions.idle.play();
    u.curAction=u.actions.idle;
  }
  return true;
}
// ---------- baked Mixamo playback retargeted onto the procedural rigs ----------
const _limbBones={LeftArm:"armL",LeftForeArm:"faL",RightArm:"armR",RightForeArm:"faR",
  LeftUpLeg:"legL",LeftLeg:"shinL",RightUpLeg:"legR",RightLeg:"shinR"};
const _coreBones={Spine1:"torso",Head:"head"};
const _bq=new THREE.Quaternion();
const WOODEN=true; // nutcrackers move in stop-motion steps, like toys animated by hand
const _dq=new THREE.Quaternion();
function _sampleQ(arr,n,tt,flip,damp){
  if(WOODEN)tt=Math.floor(tt);
  const i0=Math.floor(tt)%n,i1=(i0+1)%n,f=WOODEN?0:tt-Math.floor(tt),a=i0*4,b=i1*4;
  let x=arr[a]*(1-f)+arr[b]*f, y=arr[a+1]*(1-f)+arr[b+1]*f,
      z=arr[a+2]*(1-f)+arr[b+2]*f, w=arr[a+3]*(1-f)+arr[b+3]*f;
  if(flip){x*=flip[0];y*=flip[1];z*=flip[2];}
  _bq.set(x,y,z,w).normalize();
  if(damp!==undefined&&damp<1)return _dq.set(0,0,0,1).slerp(_bq,damp);
  return _bq;
}
function _clipFrom(pool,idx){
  const A=window.BAKED_ANIMS;
  if(!A||!A.pools[pool]||!A.pools[pool].length)return null;
  const names=A.pools[pool];
  return A.clips[names[idx%names.length]];
}
function applyBaked(u,R,dt,moving,working){
  const A=window.BAKED_ANIMS; if(!A)return false;
  if(CLS[u.cls].mounted)return false; // riders keep their sitting pose
  const LF=A.limbFlip||[1,-1,-1];
  let clip=null,tt=0;
  if(u.attackAnimT>0){
    clip=_clipFrom("attack",u.id);
    if(clip){const prog=1-(u.attackAnimT/0.9);tt=Math.min(clip.n-1.001,prog*(clip.n-1));}
  }
  if(!clip&&working){
    const node=u.gathering||(u.bot&&u.bot.node);
    const sub=(u.task&&u.task.site)?/build|hammer|work/i:
              (node&&node.type==="food")?/harvest|pick|farm/i:
              node?/mine|chop/i:null;
    const names=A.pools.work||[];
    let pick=sub?names.find(n=>sub.test(n)):null;
    clip=pick?A.clips[pick]:_clipFrom("work",u.id);
    if(clip){u.bakedT=(u.bakedT||0)+dt*clip.fps;tt=u.bakedT%clip.n;}}
  if(!clip&&moving){
    clip=_clipFrom("walk",u.spd>8.5?1:0)||_clipFrom("walk",0);
    if(clip){u.bakedT=(u.bakedT||0)+dt*clip.fps*(0.55+u.spd*0.055);tt=u.bakedT%clip.n;}}
  if(!clip)return false;
  const striking=u.attackAnimT>0;
  const LEGS={LeftUpLeg:"legL",LeftLeg:"shinL",RightUpLeg:"legR",RightLeg:"shinR"};
  for(const bn in _limbBones){
    const g=R[_limbBones[bn]],arr=clip.bones[bn];
    if(!g||!arr)continue;
    if(striking&&LEGS[bn]){continue;} // toy soldiers strike from planted feet
    const damp=LEGS[bn]?0.9:(striking?0.95:0.8);
    g.quaternion.copy(_sampleQ(arr,clip.n,tt,LF,damp));
  }
  if(striking){ // braced stance while the arms do the work
    R.legL.rotation.set(-0.14,0,0); R.shinL.rotation.set(0.18,0,0);
    R.legR.rotation.set(0.2,0,0);   R.shinR.rotation.set(0.22,0,0);
  }
  for(const bn in _coreBones){
    const g=R[_coreBones[bn]],arr=clip.bones[bn];
    if(g&&arr)g.quaternion.copy(_sampleQ(arr,clip.n,tt,null,bn==="Head"?0.5:(striking?0.6:0.4)));
  }
  if(clip.bob&&clip.bob.length)R.torso.position.y=u.rigBaseY+(clip.bob[Math.floor(tt)%clip.n]||0);
  u.body.rotation.x=moving?0.07:0;
  return true;
}
// event-driven strike: restart the attack clip and hold it until it completes
function triggerAttackAnim(u){
  // v100 SOUND — melee swing whoosh. Combat lines only: ranged/siege get bow/siege cues,
  // villagers/oxen get gather cues. Universal hook: fires for player, bots, and guest re-triggers.
  if(typeof Sound!=="undefined"&&u&&u.root&&u.cls&&CLS[u.cls]){
    const _c=CLS[u.cls],_ln=_c.line,_p={x:u.root.position.x,z:u.root.position.z};
    // v102: swing character by unit — scouts slash light, heavies swing deep, the rest airy
    if(_ln==="scoutline")Sound.play("swinglight",_p);
    else if(_ln==="cavalry"||((_ln==="melee"||_ln==="anticav")&&(_c.tier||0)>=3))Sound.play("swingheavy",_p);
    else if(_ln==="melee"||_ln==="anticav"||_ln==="royal")Sound.play("swing",_p);
    // v109 THE VOICES: battle chatter — ~1 in 4 MELEE swings carries the soldier's own attack shout
    if((_ln==="melee"||_ln==="anticav"||_ln==="royal"||_ln==="cavalry"||_ln==="scoutline")&&
       Math.random()<0.25&&Sound.vox)Sound.vox("atk",u,_p);
  }
  const A=window.BAKED_ANIMS;
  if(A&&A.pools.attack&&u.rig&&u.rig.torso&&!CLS[u.cls].mounted){u.attackAnimT=0.9;return;}
  if(!u.mixer||!u.actions||!u.actions.attack||!u.attackAnimDur)return;
  const a=u.actions.attack;
  if(u.curAction&&u.curAction!==a)u.curAction.fadeOut(0.08);
  a.reset().fadeIn(0.08).play();
  u.curAction=a;
  u.attackAnimT=u.attackAnimDur;
}
function setAction(u,name){
  if(!u.actions)return;
  const a=u.actions[name]||u.actions.idle;
  if(!a||a===u.curAction)return;
  if(u.curAction)u.curAction.fadeOut(0.15);
  a.reset().fadeIn(0.15).play();
  u.curAction=a;
}

// ---------- animation state machine ----------
function animateUnit(u,dt){
  const moving=u.moving; u.moving=false;

  if(u.mixer){ // real model: drive its clips
    if(u.attackAnimT>0){
      u.attackAnimT-=dt; // a strike is playing — let it land
    }else{
      const working=u.cls==="villager"&&!moving&&
        (u.gathering||(u.bot&&u.bot.node)||u.task||(u.isPlayer&&keys.e));
      if(working&&u.actions&&(u.actions.work||u.actions.attack))setAction(u,u.actions.work?"work":"attack");
      else if(moving)setAction(u,"walk");
      else setAction(u,"idle");
    }
    u.mixer.update(dt);
    return;
  }
  const R=u.rig; if(!R)return;
  const t=u.walkT;
  let ls=0,rs=0,al=0,ar=0,bob=0,lean=0;
  if(moving){
    ls=Math.sin(t)*0.72; rs=-ls;
    al=-ls*0.42; ar=ls*0.42;
    bob=Math.abs(Math.sin(t))*0.045;
    lean=0.09; // lean into the stride
  }else{ // idle breathing + sway
    al=Math.sin(T*1.6+u.id)*0.06; ar=-al;
    bob=Math.sin(T*2+u.id)*0.02;
  }
  // villagers chopping at a node or hammering a site
  const chopping=u.cls==="villager"&&!moving&&
    (u.gathering||(u.bot&&u.bot.node)||u.task||(u.isPlayer&&keys.e));
  if(chopping)ar=-1.6+Math.sin(T*7+u.id)*0.75;
  // melee swing: big overhead arc, weapon rides the arm.
  // the SPEAR LINE thrusts instead: the arm coils back, then drives the point forward
  if(u.swing>0){
    const k=Math.max(0,u.swing)/0.25;
    if(CLS[u.cls].line==="anticav"){
      const w=(k-0.5)/0.5;
      ar=k>0.5?0.9*w-1.2*(1-w):-1.2*(k/0.5); // +back at the coil, -forward at full extension
      lean=k>0.5?-0.08:0.2*(k/0.5);          // rock back, then lunge into it
    }else{
      ar=-2.35*k+0.55*(1-k);
      lean=0.16*(1-Math.abs(k*2-1));
    }
  }
  if(u.blocking){al=-1.3;lean=-0.12;}          // shield up
  if(u.isPlayer&&aiming){
    if(R.musketG){al=-1.35;ar=-1.15;}            // musket to the shoulder
    else{al=-1.5;ar=-1.3;}                       // bow drawn down the camera
  }
  let __baked=false;
  if(R.torso&&!u.blocking&&!(u.isPlayer&&aiming))
    __baked=applyBaked(u,R,dt,moving,chopping);
  if(R.torso&&!__baked){ // procedural fallback — and always for blocking/aiming/mounted
    let flL=0.32,flR=0.32;             // elbows carry a natural bend
    let shL=0.16,shR=0.16;             // knees never lock straight
    if(moving){ // knees flex through the forward swing — the actual mechanics of a stride
      shL=0.14+Math.max(0,Math.sin(t-1.9))*0.95;
      shR=0.14+Math.max(0,Math.sin(t-1.9+Math.PI))*0.95;
      flL=0.35+Math.max(0,al)*0.6;   flR=0.35+Math.max(0,ar)*0.6;
    }
    const chopping2=u.swing<=0&&Math.abs(ar+1.6)<0.9&&ar<-0.7; // mid-chop pose
    if(chopping2)flR=0.6;
    if(u.swing>0){const k=Math.max(0,u.swing)/0.25; flR=0.15+k*1.1;} // cock, then extend through the strike
    if(u.blocking)flL=1.05;                                          // shield braced across
    if(u.isPlayer&&aiming){
      if(R.musketG){flL=0.75;flR=0.45;}                              // left hand cradles the fore-stock
      else{flL=0.5;flR=0.55;}                                        // drawn to the cheek
    }
    const sitting=CLS[u.cls].mounted&&R.shinL;
    if(sitting){ ls=-1.0; rs=-1.0; shL=1.35; shR=1.35; }             // riders sit their mounts
    // full-axis writes: clear any twist left over from baked playback
    R.legL.rotation.set(ls,0,0); R.legR.rotation.set(rs,0,0);
    if(R.shinL){R.shinL.rotation.set(shL,0,0); R.shinR.rotation.set(shR,0,0);}
    R.armL.rotation.set(al,0,0); R.armR.rotation.set(ar,0,0);
    if(R.faL){R.faL.rotation.set(-flL,0,0); R.faR.rotation.set(-flR,0,0);}
    if(R.bowG)R.bowG.rotation.x=(u.isPlayer&&aiming)?2.0:0; // upright while the arm rises to draw
    if(R.musketG){ // the gun never leaves the right hand
      const MG=R.musketG;
      if(u.isPlayer&&aiming){ // arm raised, gun shouldered and leveled with the eye
        R.armR.rotation.set(-1.2,-0.2,0);     R.faR.rotation.set(-0.35,0,0);
        R.armL.rotation.set(-1.25,0.45,-0.3); R.faL.rotation.set(-0.55,0,0);
        MG.position.set(0,-0.46,0.18);
        // chain compensation: arm (-1.2) + forearm (-0.35) tipped back level, then camera pitch
        MG.rotation.set(1.55+((typeof camPitch!=="undefined"?camPitch:0.55)-0.55)*0.7,0,0);
      }else{ // carried easy at the side
        MG.position.set(0,-0.5,0.25); MG.rotation.set(0.15,0,0);
      }
    }
    R.torso.position.y=u.rigBaseY+bob;
    const tt=(typeof T!=="undefined"?T:0)+u.id*1.7;
    if(moving){ // shoulders counter the stride; a touch of lateral sway
      const tw=Math.sin(u.walkT*1.15)*0.12;
      R.torso.rotation.set(0,tw,Math.sin(u.walkT*1.15)*0.03);
      R.head.rotation.set(0,-tw*0.5,0);
    }else{
      R.torso.rotation.x*=0.8; R.torso.rotation.y*=0.9; R.torso.rotation.z*=0.9;
      R.torso.position.y=u.rigBaseY+Math.sin(tt*1.5)*0.02;   // breathing
      if(!u.blocking&&!(u.isPlayer&&aiming))
        R.head.rotation.set(0,Math.sin(tt*0.35)*0.22,0);     // idle glances
    }
    u.body.rotation.x=lean;
  }
  if(R.horseLegs){
    if(R.horseLegs[0].userData&&R.horseLegs[0].userData.trot){ // v113 THE DRAUGHT TROT (ox, market mule)
      // Jointed like the destrier, but a harnessed animal never gallops: diagonal pairs swing
      // together (LF+RH, then RF+LH), knees fold on the recovery, and the body rocks a little
      // as the load shifts. Slower cadence and shallower reach than the war-horse.
      const tt2=t*1.15;
      for(let i=0;i<4;i++){
        const L=R.horseLegs[i], front=L.userData.front;
        const ph=tt2+((i===0||i===3)?0:Math.PI); // legs are [LF,RF,LH,RH] — 0 & 3 are one diagonal
        const tgtHip=moving?Math.sin(ph)*(front?0.5:0.44):0;
        L.rotation.x+=(tgtHip-L.rotation.x)*Math.min(1,dt*12);
        const kn=L.userData.knee;
        const flex=moving?Math.max(0,Math.sin(ph+Math.PI*0.4))*(front?0.5:0.62):0;
        kn.rotation.x+=(flex-kn.rotation.x)*Math.min(1,dt*12);
      }
      if(R.horseG){ // the plod: a shallow rise on each diagonal beat
        const bob=moving?Math.abs(Math.sin(tt2))*0.05:0;
        R.horseG.position.y+=(bob-R.horseG.position.y)*Math.min(1,dt*10);
      }
      if(R.horseNeck){ // the head nods into the collar as it pulls
        const nod=moving?0.06+Math.sin(tt2*2)*0.045:0;
        R.horseNeck.rotation.x+=(nod-R.horseNeck.rotation.x)*Math.min(1,dt*8);
      }
    }else if(R.horseLegs[0].userData&&R.horseLegs[0].userData.knee){ // the jointed destrier
      // THE FOUR-BEAT GALLOP (transverse, right lead): each hoof strikes alone —
      // beat 1 left hind, beat 2 right hind with the diagonal left fore close behind,
      // beat 3 the leading right fore, then the suspension when everything is airborne.
      const gt=t*1.5;
      const BEAT=[0.32,0.50,0.00,0.18]; // legs are [LF,RF,LH,RH] — footfall fraction of the stride
      for(let i=0;i<4;i++){
        const L=R.horseLegs[i], front=L.userData.front;
        const ph=gt-BEAT[i]*Math.PI*2;
        const tgtHip=moving?Math.sin(ph)*(front?0.78:0.68):0;
        L.rotation.x+=(tgtHip-L.rotation.x)*Math.min(1,dt*14);
        // the carpus folds on the recovery swing, snaps straight for the strike
        const flex=moving?Math.max(0,Math.sin(ph+Math.PI*0.45))*(front?0.95:1.2):0;
        const kn=L.userData.knee;
        kn.rotation.x+=(flex-kn.rotation.x)*Math.min(1,dt*14);
      }
      if(R.horseG){ // the suspension: a breath of air under all four hooves
        const bob=moving?Math.max(0,Math.sin(gt+Math.PI*1.35))*0.14:0;
        R.horseG.position.y+=(bob-R.horseG.position.y)*Math.min(1,dt*12);
      }
      if(R.horseNeck){ // the head reaches with the stride — subtle, or it looks like nodding
        const reach=moving?Math.sin(gt+Math.PI*0.55)*0.055:0;
        R.horseNeck.rotation.x+=(reach-R.horseNeck.rotation.x)*Math.min(1,dt*10);
      }
    }else{ // the cart mule keeps its old trot
      const g=moving?Math.sin(t*1.35)*0.8:0;
      R.horseLegs[0].rotation.x=g;  R.horseLegs[1].rotation.x=-g;
      R.horseLegs[2].rotation.x=-g; R.horseLegs[3].rotation.x=g;
    }
  }
  if(R.wheels)for(const w of R.wheels)if(moving)w.rotation.x+=dt*(w.userData.rr||7); // roll, don't twirl
  if(u.alive&&CLS[u.cls]&&CLS[u.cls].rig==="wolf"){ // the pounce: crouch back, spring forward
    if(u.swing>0){const k=1-u.swing/0.25; u.body.rotation.x=-0.4+k*0.55; u.body.position.y=Math.sin(k*Math.PI)*0.35;}
    else{u.body.rotation.x+=(0-u.body.rotation.x)*Math.min(1,dt*8); u.body.position.y+=(0-u.body.position.y)*Math.min(1,dt*8);}
  }
  if(R.barrel&&CLS[u.cls]&&CLS[u.cls].rig==="cannon"){ // the muzzle follows the gunner's eye
    let el=0.06;
    if(u.isPlayer&&aiming){
      const cd=new THREE.Vector3(); camera.getWorldDirection(cd);
      el=THREE.MathUtils.clamp(Math.asin(THREE.MathUtils.clamp(cd.y,-1,1)),-0.12,0.45);
    }
    // +x rotation LOWERS a +z muzzle, so the barrel takes the NEGATED angle
    R.barrel.rotation.x+=((-el)-R.barrel.rotation.x)*Math.min(1,dt*8);
  }
  if(R.gunSG){ // the gun leaps back on firing, then rolls home
    if(u._recoil>0)u._recoil-=dt;
    const rz=(u._recoil>0)?-0.5*(u._recoil/0.4):0;
    R.gunSG.position.z+=(rz-R.gunSG.position.z)*Math.min(1,dt*(u._recoil>0?22:4));
  }
  if(R.log){ // ram log swings forward on the strike
    if(u.swing>0)R.log.position.z=(1-u.swing/0.25)*1.1;
    else R.log.position.z+=(0-R.log.position.z)*Math.min(1,dt*5);
  }
  if(R.arm){ // throwing arm — the trebuchet heaves, the onager kicks
    const rest=(u.armRest===undefined?-1.15:u.armRest);
    if(u.cls==="trebuchet"){
      if(u.swing>0.2&&!u._trebGo){u._trebGo=1;u._trebT=0;} // the release
      if(u._trebGo){
        u._trebT+=dt;
        const k=Math.min(1,u._trebT/1.15);
        const e=k<0.5?2*k*k:1-Math.pow(-2*k+2,2)/2; // heavy start, whip through, heavy settle
        R.arm.rotation.x=rest+e*1.9;
        if(k>=1)u._trebGo=0;
      }else R.arm.rotation.x+=(rest-R.arm.rotation.x)*Math.min(1,dt*0.8); // the slow winch home
    }
    else if(u.swing>0)R.arm.rotation.x=rest+(1-u.swing/0.25)*1.9;
    else R.arm.rotation.x+=(rest-R.arm.rotation.x)*Math.min(1,dt*2.5);
  }
  if(R.barrel){ // recoil
    if(u.swing>0)R.barrel.position.z=0.2-(1-u.swing/0.25)*0.35;
    else R.barrel.position.z+=(0.2-R.barrel.position.z)*Math.min(1,dt*4);
  }
}

function makeUnit(team,cls,x,z,opts){
  opts=opts||{};
  const root=new THREE.Group(); root.position.set(x,terrainHeight(x,z),z); scene.add(root);
  const body=new THREE.Group(); root.add(body);
  const ring=new THREE.Mesh(new THREE.RingGeometry(0.85,1.15,16),
    new THREE.MeshBasicMaterial({color:opts.isPlayer?0xffffff:TEAMCOL[team],side:THREE.DoubleSide}));
  ring.rotation.x=-Math.PI/2; ring.position.y=0.06; root.add(ring);
  const u={id:UID++,team,cls,root,body,ring,alive:true,hp:1,maxHp:1,atkT:0,
    facing:0,carry:{food:0,gold:0,stone:0,wood:0},gathering:null,gatherT:0,buildT:0,
    isPlayer:!!opts.isPlayer,isKing:!!opts.isKing,name:opts.name||"Unit",
    bot:opts.bot||null,respawnT:0,walkT:0,convertGoal:null,rally:false,anchor:{x,z},corpse:false,
    scriptedCls:null,reconvertT:0,moving:false,dieT:0,blocking:false,task:null,
    convertTo:null,rigBaseY:1.2,attackAnimT:0,attackAnimDur:0};
  buildBodyFor(u);
  setClassStats(u);
  units.push(u); return u;
}
function restyleUnits(team,defer){ // villagers change wardrobe with the age, like the town does
  for(const u of units){
    if(u.alive&&u.team===team&&u.cls==="villager"){
      if(defer)_restyleQ.push({kind:"u",u});
      else buildBodyFor(u);
    }
  }
}
function setClassStats(u){
  const d=CLS[u.cls];
  const b=ageBuff(u.team); // troops trained in later ages are hardier
  u.maxHp=Math.round(d.hp*b); u.hp=u.maxHp; u.spd=d.spd; u.dmg=d.dmg*b; u.rng=d.rng; u.cd=d.cd;
  u.ranged=!!d.ranged;
  if(u.buffs)applyBuffStats(u); // v87: blacksmith buffs ride on top of every class's base stats
  setBar(u.bar,1);
}
// v87: the STAT-model buffs (max HP, speed, attack cooldown) — event-time buffs
// (damage, crit, dodge, lifesteal…) apply at their callsites in dealDamage & co.
// Never touches rng: the garrison range boost stacks after this and must survive.
function applyBuffStats(u){
  const d=CLS[u.cls]; if(!d)return;
  const frac=u.maxHp>0?Math.max(0,Math.min(1,u.hp/u.maxHp)):1;
  u.maxHp=Math.round(d.hp*ageBuff(u.team)*(1+0.05*buffSt(u,"hp")));
  u.hp=Math.max(1,Math.round(u.maxHp*frac));
  u.spd=d.spd+0.5*buffSt(u,"spd");
  u.cd=Math.max(0.2,d.cd-0.1*buffSt(u,"atkspd"));
  if(u.bar)setBar(u.bar,u.hp/u.maxHp);
}
function setClass(u,cls){
  u.cls=cls; buildBodyFor(u); setClassStats(u);
  if(cls==="dragoon")u.ammo=6; // a fresh dragoon rides out with a loaded revolver
  u.gathering=null;
  if(u.isPlayer)updatePlayerHud();
}
function dist2(ax,az,bx,bz){const dx=ax-bx,dz=az-bz;return dx*dx+dz*dz;}
function dist(a,b){return Math.sqrt(dist2(a.root.position.x,a.root.position.z,b.root.position.x,b.root.position.z));}
