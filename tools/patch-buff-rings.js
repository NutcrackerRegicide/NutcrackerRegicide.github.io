#!/usr/bin/env node
/* patch-buff-rings.js — v132.39: BATCH D MADE VISIBLE.
 *
 * Six buffs whose entire mechanic is "within 10 units of me", and not one of them draws anything.
 * You cannot see where Sanctuary heals, how close Searing Presence burns, or whether Unbowed is at
 * its cap. That is a gameplay problem, not a decorative one: you cannot stand in a zone you cannot
 * find.
 *
 * ── WHY RINGS AND NOT GLOWING UNITS ─────────────────────────────────────────────────────────
 * Every unit already carries the level aura — rising motes that turn gold at 25 — and it is how a
 * player decides whether to pick a fight. It has to keep reading. So these effects go on the
 * GROUND, where they compete with nothing, and the unit itself is left alone.
 *
 * ── ONE GEOMETRY SET, SHARED, BUILT LAZILY ──────────────────────────────────────────────────
 * Every ring is the SAME unit-radius geometry, scaled. Rebuilding a RingGeometry per frame to
 * animate a radius would mint a fresh BufferGeometry every time, and in r128 that is a
 * generateUUID() — four random draws — plus garbage, sixty times a second. Scaling a shared mesh
 * costs nothing and does the same job.
 *   ⚠ Built LAZILY on first use, never at load. Anything constructed inside world generation
 *   consumes draws from the seeded window and moves every tree on the map (invariant #2).
 *
 * ── SANCTUARY'S SWEEP IS SIXTEEN GEOMETRIES, NOT A REBUILD ──────────────────────────────────
 * The ring draws itself round over the three seconds of standing still, so the wind-up you cannot
 * currently see IS the effect. A smooth sweep needs a new partial-ring geometry per frame; instead
 * there are sixteen pre-built arcs at 1/16 increments and the mesh swaps between them. Sixteen
 * geometries built once, a swap per frame, and the sweep still reads.
 *
 * ── TWO SUBSTITUTIONS I MADE, AND WHY ───────────────────────────────────────────────────────
 *   SEARING's "ragged" ring is an irregular opacity FLICKER rather than gapped geometry. Gapping
 *     it properly means a second geometry family for one effect; the flicker reads as heat and
 *     costs a sine.
 *   STEWARD gets a ring around the BUILDING rather than a shimmer plus a mote line. Same place
 *     conceptually — the effect belongs to the thing being repaired — and it reuses this pool
 *     instead of needing a third primitive.
 * Both are cheaper than what I described in the worksheet. Say the word and I will build the
 * richer versions; they are not free but they are not large either.
 *
 * ── UNBOWED LIES ABOUT ITS RADIUS, DELIBERATELY ─────────────────────────────────────────────
 * The drawn ring TIGHTENS from 10 units toward 6 as enemies crowd you, which is not where the
 * scan actually reaches. It is drawn that way because the mechanic is "surrounded makes you
 * tougher" and a ring closing in IS that sentence. Flagged in the worksheet, and one constant
 * (RING_TIGHTEN=0) turns it off.
 *
 * ── AND IT IS DRIVEN FROM updateEffects, NOT FROM THE HOST LOOP ──────────────────────────────
 * updateEffects is called by BOTH frame paths — tickBody and NET.guestFrame — which is exactly
 * why the level aura already rides there. Display code in the host branch is trap #12, the
 * v128.8 ribbon a guest could never clear. The state these rings read is replicated separately
 * (see patch-buff-rings-net.js); this file only ever DRAWS.
 */
const fs=require("fs"),path=require("path");
const F=path.join(__dirname,"..","js","05-combat.js");
let s=fs.readFileSync(F,"utf8");
let failed=[];
function sub(name,from,to){
  const n=s.split(from).length-1;
  if(n!==1){failed.push(name+" (matched "+n+" times, need exactly 1)");return;}
  s=s.split(from).join(to);
}

// ---------------- 1. the host records what the rings need ----------------
sub("record the fx mask",
`  let allies=0, enemies=0, kinNear=false;`,
`  // v132.39: what the RINGS need. The display reads only these fields, so host and guest run the
  // same drawing code and a dedicated server needs no special case. Six bits, two counts, one
  // clock, two ids — see patch-buff-rings-net.js for how they reach a guest.
  u._fxMask=(sanct?1:0)|(brand?2:0)|(kin?4:0)|(stew?8:0)|(res?16:0)|(pha?32:0);
  u._fxStill=Math.min(1,(u._stillT||0)/AURA_STILL);
  let allies=0, enemies=0, kinNear=false, kinId=0;`);

sub("record the kinsman",
`      if(kin&&!kinNear&&o.cls===u.cls&&!o.isKing)kinNear=true;`,
`      if(kin&&!kinNear&&o.cls===u.cls&&!o.isKing){kinNear=true;kinId=o.id;} // v132.39: WHICH one,
                                                                            // for the thread`);

sub("publish the counts",
`  u._auraA=allies; u._auraE=enemies;                     // cached for the damage-time readers`,
`  u._auraA=allies; u._auraE=enemies;                     // cached for the damage-time readers
  u._fxKin=kinId;                                        // v132.39: 0 when nobody of your kind is near`);

sub("record the mended building",
`      if(bx*bx+bz*bz>R2)continue;
      b.hp=Math.min(b.def.hp,b.hp+0.5*stew*step);
    }
  }
}`,
`      if(bx*bx+bz*bz>R2)continue;
      b.hp=Math.min(b.def.hp,b.hp+0.5*stew*step);
      if(!_stw)_stw=b.id;                                // v132.39: the first one mended gets the ring
    }
  }
  u._fxStw=_stw;
}`);

sub("declare the steward id",
`  if(stew&&u.cls==="villager"&&typeof buildings!=="undefined"){ // STEWARD`,
`  let _stw=0;
  if(stew&&u.cls==="villager"&&typeof buildings!=="undefined"){ // STEWARD`);

sub("clear the mask on a non-holder",
`  if(!(sanct||brand||kin||stew||res||pha)){u._auraE=0;u._auraA=0;u._stillT=0;return;}`,
`  if(!(sanct||brand||kin||stew||res||pha)){
    u._auraE=0;u._auraA=0;u._stillT=0;
    u._fxMask=0;u._fxKin=0;u._fxStw=0;u._fxStill=0;      // v132.39: …and drop the ring. A stale
    return;                                              // mask here is a ring that never leaves.
  }`);

// ---------------- 2. the ring system ----------------
sub("the ring pool",
`// ---------- v132.34: the DEBUFF half of the timed system ----------`,
`// ---------- v132.39 BATCH D MADE VISIBLE: the ground rings ----------
// FX_* are the six mask bits, in the order auraBuffTick writes them.
const FX_SANCT=1, FX_BRAND=2, FX_KIN=4, FX_STEW=8, FX_RESOLVE=16, FX_PHALANX=32;
const RING_SEGS=48, RING_ARCS=16;   // sixteen pre-built arcs = Sanctuary's sweep without churn
const RING_TIGHTEN=1;               // 0 draws UNBOWED at its true radius instead of closing in
const RING_MIN=6;                   // …and this is how far in it closes at the cap
const RING_Y=0.16;                  // clear of the ground, under everything else
const FX_COL={sanct:0xFFD98A, brand:0xC4402A, resolve:0x8FA4B8, stew:0xC9A06A, kin:0x9FE0A8};
let _ringGeo=null,_ringArc=null,_ringPool=null,_threadGeo=null,_threadPool=null,_ringOn=0;
function _ringBuild(){ // LAZY. Never at load — see invariant #2, the seeded window.
  if(_ringGeo)return;
  _ringGeo=new THREE.RingGeometry(0.94,1.0,RING_SEGS);
  _ringGeo.rotateX(-Math.PI/2);                          // bake the lie-flat into the geometry so
  _ringArc=[];                                           // the mesh's own rotation stays free
  for(let i=1;i<=RING_ARCS;i++){
    const g=new THREE.RingGeometry(0.94,1.0,RING_SEGS,1,Math.PI/2,-(Math.PI*2)*(i/RING_ARCS));
    g.rotateX(-Math.PI/2); _ringArc.push(g);
  }
  _threadGeo=new THREE.CylinderGeometry(0.05,0.05,1,5);
  _threadGeo.translate(0,0.5,0);                         // origin at one END, so scale.y IS length
  _ringPool=[]; _threadPool=[];
}
function _ringTake(){ // one pooled flat ring, hidden when not in use
  for(const m of _ringPool)if(!m.visible)return m;
  const m=new THREE.Mesh(_ringGeo,new THREE.MeshBasicMaterial({
    color:0xffffff,transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide}));
  m.renderOrder=-1; scene.add(m); _ringPool.push(m); return m;
}
function _threadTake(){
  for(const m of _threadPool)if(!m.visible)return m;
  const m=new THREE.Mesh(_threadGeo,new THREE.MeshBasicMaterial({
    color:FX_COL.kin,transparent:true,opacity:0,depthWrite:false}));
  scene.add(m); _threadPool.push(m); return m;
}
function _ringAt(u,R,col,op,arc){
  const m=_ringTake(); m.visible=true;
  m.geometry=(arc!==undefined&&arc<RING_ARCS-1)?_ringArc[Math.max(0,arc|0)]:_ringGeo;
  const x=u.root.position.x, z=u.root.position.z;
  m.position.set(x,(typeof terrainHeight==="function"?terrainHeight(x,z):0)+RING_Y,z);
  m.scale.set(R,1,R); m.material.color.setHex(col); m.material.opacity=op;
  _ringOn++;
}
// THE ONE DISPLAY PATH. Reads only the _fx* fields, which the host computes and the wire
// replicates — so this runs identically on a host, a guest and a headless server.
function buffFxTick(dt){
  if(typeof scene==="undefined"||typeof THREE==="undefined"||typeof units==="undefined")return;
  _ringBuild();
  for(const m of _ringPool)m.visible=false;              // hide-all then re-arm: a unit that died
  for(const m of _threadPool)m.visible=false;            // or dropped a buff leaves nothing behind
  _ringOn=0;
  const t=(typeof T!=="undefined")?T:0;
  for(const u of units){
    const fx=u._fxMask|0;
    if(!fx||!u.alive||!u.root)continue;
    if(fx&FX_SANCT){
      // the ring GROWS over the stillness clock, so the wind-up is the effect, then holds and
      // pulses in time with the heal
      const p=u._fxStill||0, open=p>=1;
      const R=AURA_BR*(open?1:p), pulse=open?(0.55+0.20*Math.sin(t*5.2)):0.30+0.30*p;
      if(R>0.4)_ringAt(u,R,FX_COL.sanct,pulse,open?undefined:Math.floor(p*RING_ARCS));
    }
    if(fx&FX_BRAND){
      // "ragged" as an irregular opacity flicker rather than gapped geometry — reads as heat,
      // costs a sine
      const f=0.42+0.16*Math.sin(t*11.3)+0.08*Math.sin(t*27.7);
      _ringAt(u,AURA_BR,FX_COL.brand,f);
    }
    if(fx&FX_RESOLVE){
      // TIGHTENS as enemies crowd you. The cap is 5 (−5% each, floor −25%).
      const n=Math.min(5,u._auraE||0);
      const R=RING_TIGHTEN?(AURA_BR-(AURA_BR-RING_MIN)*(n/5)):AURA_BR;
      const cap=n>=5;
      _ringAt(u,R,FX_COL.resolve,0.22+0.10*n+(cap?0.12*Math.abs(Math.sin(t*4)):0));
    }
    if(fx&FX_PHALANX){
      // the mirror of UNBOWED: brightens as allies gather, second ring at the +20% cap (4 allies)
      const n=Math.min(4,u._auraA||0);
      const col=(typeof TEAMCOL!=="undefined"&&TEAMCOL[u.team]!==undefined)?TEAMCOL[u.team]:0xffffff;
      _ringAt(u,AURA_BR,col,0.16+0.13*n);
      if(n>=4)_ringAt(u,AURA_BR*0.88,col,0.16+0.10*Math.abs(Math.sin(t*3.1)));
    }
    if((fx&FX_STEW)&&u._fxStw&&typeof buildings!=="undefined"){
      const b=buildings.find(x=>x.id===u._fxStw);
      if(b&&b.alive)_ringAt({root:{position:{x:b.x,z:b.z}}},4.2,FX_COL.stew,0.30+0.16*Math.sin(t*3.6));
    }
    if((fx&FX_KIN)&&u._fxKin){
      const o=units.find(x=>x.id===u._fxKin);
      if(o&&o.alive&&o.root){
        const m=_threadTake(); m.visible=true;
        const a=u.root.position, b2=o.root.position;
        const dx=b2.x-a.x, dy=(b2.y+1.4)-(a.y+1.4), dz=b2.z-a.z;
        const len=Math.hypot(dx,dy,dz)||0.001;
        m.position.set(a.x,a.y+1.4,a.z);
        m.scale.set(1,len,1);
        m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),
          new THREE.Vector3(dx/len,dy/len,dz/len));
        m.material.opacity=0.34+0.14*Math.sin(t*2.4);
      }
    }
  }
}
function buffFxStats(){return {rings:_ringOn,pool:_ringPool?_ringPool.length:0,
  threads:_threadPool?_threadPool.filter(m=>m.visible).length:0,built:!!_ringGeo};}
// ---------- v132.34: the DEBUFF half of the timed system ----------`);

// ---------------- 3. drive it from the ONE function both frame paths call ----------------
sub("drive buffFxTick",
`  auraTick(dt);
  for(let i=effects.length-1;i>=0;i--){`,
`  auraTick(dt);
  if(typeof buffFxTick==="function")buffFxTick(dt); // v132.39 the Batch D rings — same reasoning
                                                   // as the aura above: BOTH frame paths land here
  for(let i=effects.length-1;i>=0;i--){`);

if(failed.length){
  console.error("REFUSING TO WRITE — anchors failed:");
  failed.forEach(f=>console.error("  - "+f));
  process.exit(1);
}
fs.writeFileSync(F,s);
console.log("patched js/05-combat.js — the six radius auras now draw");
