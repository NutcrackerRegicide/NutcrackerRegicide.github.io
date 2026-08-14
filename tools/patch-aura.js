#!/usr/bin/env node
/* patch-aura.js — v132.29: THE LEVEL AURA. Rising motes, team-tinted early, gold at the cap,
 * readable only once you are close.
 *
 * John's three rulings: FORM = rising motes/embers · COLOUR = team-tinted low, gold at the top ·
 * RANGE = only once they are close (the v125 "you should have to scout for it" precedent).
 *
 * ── WHY NOT `puff()` ────────────────────────────────────────────────────────────────────────
 * puff() already does "rises and fades" and was the obvious reuse. It is the wrong tool here:
 * it mints a NEW Sprite AND a NEW SpriteMaterial per call and, on expiry, only does
 * `scene.remove(e.s)` — the material is never disposed (05-combat.js:188-196). That is
 * survivable for one-shot impacts. A continuous emitter running for a whole match, on every
 * levelled player, would leak a material per mote and cost ONE DRAW CALL PER MOTE.
 *
 * ── WHAT THIS IS INSTEAD ────────────────────────────────────────────────────────────────────
 * ONE pooled THREE.Points for the entire scene: a fixed AURA_MAX-slot BufferGeometry with
 * per-vertex colour, additively blended. Consequences, all of them the point:
 *   · ONE draw call for every mote in the game, at any player count.
 *   · ZERO allocation after warm-up — slots are recycled, nothing is created or disposed
 *     per mote, so there is no material to leak.
 *   · ADDITIVE blending means "fade" is just multiplying the vertex colour toward black, which
 *     needs no per-instance alpha (PointsMaterial opacity is per-MATERIAL, and that single fact
 *     is what rules out one-sprite-per-mote sharing a material).
 *   · It reads WITHOUT bloom, which mobile requires — 12-touch.js:191 sets composer=null.
 *     Additive light on dark terrain is visible on its own; bloom only adds the halo. At the top
 *     of the ramp the colour is driven past 1.0 so it keys the 0.86 threshold (§4.6) on desktop
 *     and simply clips to bright gold on mobile.
 *   · The dot texture is a procedural DataTexture, not a canvas — canvas is stubbed to a Proxy
 *     in the harness, so a canvas texture would be a headless-only landmine.
 *
 * ── WHERE IT IS DRIVEN, AND THE TRAP THAT DECIDED IT ─────────────────────────────────────────
 * From inside updateEffects(dt). tickBody's copy sits inside `if(!gameOver)` in the HOST branch,
 * which a guest never reaches — that is trap #12, the v128.8 objective ribbon that sat on screen
 * for entire matches. So this was VERIFIED, not assumed: NET.guestFrame calls updateEffects at
 * 10-net.js:2133. Both frame paths provably run it, it is already spied by the v127 wiring probe,
 * and it does not run in the menu or after a regicide — all three correct.
 *
 * ── THE SEEDED WINDOW ───────────────────────────────────────────────────────────────────────
 * THREE.Points, BufferGeometry, PointsMaterial and DataTexture each mint a uuid, and
 * generateUUID() draws FOUR randoms (invariant #2). Every one of them is created LAZILY on first
 * emit, which cannot happen before world gen has handed back — updateEffects is not called during
 * placeNodes. nodehash is asserted unchanged after this patch.
 */
const fs=require("fs"),path=require("path");
let failed=[];
function mk(box){
  return function sub(name,from,to){
    const n=box.o.split(from).length-1;
    if(n!==1){failed.push(name+" (matched "+n+" times, need exactly 1)");return;}
    box.o=box.o.split(from).join(to);
  };
}
const P={data:path.join(__dirname,"..","js","00-data.js"),
         combat:path.join(__dirname,"..","js","05-combat.js")};
const d={o:fs.readFileSync(P.data,"utf8")}, c={o:fs.readFileSync(P.combat,"utf8")};
const subD=mk(d), subC=mk(c);

// ---- the dials, in one place ----
subD("aura constants",
`const XP_MAX_LVL=25, BUFF_MAX_STACK=3, BOARD_REACH=5, QUEST_REROLL_MAX=3;`,
`const XP_MAX_LVL=25, BUFF_MAX_STACK=3, BOARD_REACH=5, QUEST_REROLL_MAX=3;
// ---------- v132.29 THE LEVEL AURA — every dial in one place ----------
// Rising motes off a levelled player: team-tinted at low level, gold at the cap. Cosmetic only,
// never on the wire, never simulation. See tools/patch-aura.js for the reasoning.
const AURA_MAX=192,        // mote slots for the WHOLE scene — one pooled Points, one draw call
      AURA_NEAR=34,        // full strength within this distance of the camera
      AURA_FAR=62,         // invisible beyond it — John: you should have to get close (v125)
      AURA_RATE_LO=1.1,    // motes/sec at level 1
      AURA_RATE_HI=9.0,    // motes/sec at the cap
      AURA_LIFE=1.15,      // seconds a mote lives
      AURA_RISE=1.9,       // units/sec it climbs
      AURA_R=0.62,         // emission radius around the unit
      AURA_GOLD=0xFFC64A,  // the cap colour — warm, agrees with the §2 palette
      AURA_HOT=2.1;        // colour multiplier at the cap, to key the 0.86 bloom threshold (§4.6)`);

// ---- the system ----
subC("the aura system",
`function cannonPlume(f,mx,my,mz){ // the gun speaks: a flash and a modest roll of smoke`,
`// ---------- v132.29 THE LEVEL AURA ----------
// One pooled Points for every mote in the game. Lazily built, so nothing here is constructed
// inside the seeded world-gen window (invariant #2 — a uuid costs four randoms).
let _auraPts=null,_auraGeo=null,_auraPos=null,_auraCol=null,_auraMat=null;
let _auraLife=null,_auraVel=null,_auraNext=0,_auraLive=0;
function _auraDot(){ // a soft radial dot, built as raw bytes — canvas is stubbed in the harness
  const N=16,data=new Uint8Array(N*N*4);
  for(let y=0;y<N;y++)for(let x=0;x<N;x++){
    const dx=(x+0.5)/N-0.5, dy=(y+0.5)/N-0.5;
    const r=Math.sqrt(dx*dx+dy*dy)*2;
    const a=Math.max(0,1-r); const v=Math.round(255*a*a); // squared falloff: a soft core, no rim
    const i=(y*N+x)*4; data[i]=255;data[i+1]=255;data[i+2]=255;data[i+3]=v;
  }
  const t=new THREE.DataTexture(data,N,N,THREE.RGBAFormat);
  t.needsUpdate=true; return t;
}
function auraInit(){
  if(_auraPts)return;
  _auraPos=new Float32Array(AURA_MAX*3);
  _auraCol=new Float32Array(AURA_MAX*3);
  _auraLife=new Float32Array(AURA_MAX);
  _auraVel=new Float32Array(AURA_MAX*3);
  _auraGeo=new THREE.BufferGeometry();
  _auraGeo.setAttribute("position",new THREE.BufferAttribute(_auraPos,3));
  _auraGeo.setAttribute("color",new THREE.BufferAttribute(_auraCol,3));
  _auraMat=new THREE.PointsMaterial({size:0.42,sizeAttenuation:true,vertexColors:true,
    transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,map:_auraDot()});
  _auraPts=new THREE.Points(_auraGeo,_auraMat);
  _auraPts.frustumCulled=false;   // the pool spans the map; culling it as one blob would pop
  _auraPts.renderOrder=3;
  scene.add(_auraPts);
}
function auraEmit(x,y,z,r,g,b){
  auraInit();
  // claim the next slot round-robin. A full pool overwrites the OLDEST mote, which is the one
  // closest to fading anyway — so the ceiling degrades gracefully instead of dropping new work.
  const i=_auraNext; _auraNext=(_auraNext+1)%AURA_MAX;
  if(_auraLife[i]<=0)_auraLive++;
  const a=Math.random()*Math.PI*2, rr=Math.sqrt(Math.random())*AURA_R;
  _auraPos[i*3]=x+Math.cos(a)*rr; _auraPos[i*3+1]=y+Math.random()*0.5; _auraPos[i*3+2]=z+Math.sin(a)*rr;
  _auraVel[i*3]=(Math.random()-0.5)*0.35;
  _auraVel[i*3+1]=AURA_RISE*(0.75+Math.random()*0.5);
  _auraVel[i*3+2]=(Math.random()-0.5)*0.35;
  _auraCol[i*3]=r; _auraCol[i*3+1]=g; _auraCol[i*3+2]=b;
  _auraLife[i]=AURA_LIFE;
}
function auraTint(u,out){ // team colour at level 1 → gold at the cap
  const t=Math.max(0,Math.min(1,(u.lvl||0)/XP_MAX_LVL));
  const ease=t*t;                         // hold the team read low, let gold arrive late
  const tc=(typeof TEAMCOL!=="undefined"&&TEAMCOL[u.team]!==undefined)?TEAMCOL[u.team]:0xffffff;
  const r0=((tc>>16)&255)/255, g0=((tc>>8)&255)/255, b0=(tc&255)/255;
  const r1=((AURA_GOLD>>16)&255)/255, g1=((AURA_GOLD>>8)&255)/255, b1=(AURA_GOLD&255)/255;
  const k=0.55+ease*(AURA_HOT-0.55);      // dim at level 1, driven past 1.0 at the cap for bloom
  out[0]=(r0+(r1-r0)*ease)*k; out[1]=(g0+(g1-g0)*ease)*k; out[2]=(b0+(b1-b0)*ease)*k;
  return t;
}
const _auraRGB=[0,0,0];
function auraTick(dt){
  // ---- advance and fade what is already in the air ----
  if(_auraPts){
    for(let i=0;i<AURA_MAX;i++){
      if(_auraLife[i]<=0)continue;
      _auraLife[i]-=dt;
      if(_auraLife[i]<=0){ _auraCol[i*3]=0;_auraCol[i*3+1]=0;_auraCol[i*3+2]=0; _auraLive--; continue; }
      _auraPos[i*3]+=_auraVel[i*3]*dt;
      _auraPos[i*3+1]+=_auraVel[i*3+1]*dt;
      _auraPos[i*3+2]+=_auraVel[i*3+2]*dt;
      const f=_auraLife[i]/AURA_LIFE;     // additive: fading the COLOUR is fading the mote out
      _auraCol[i*3]*=f>0.02?(1-dt/AURA_LIFE*1.15):0;
      _auraCol[i*3+1]*=f>0.02?(1-dt/AURA_LIFE*1.15):0;
      _auraCol[i*3+2]*=f>0.02?(1-dt/AURA_LIFE*1.15):0;
    }
    _auraGeo.attributes.position.needsUpdate=true;
    _auraGeo.attributes.color.needsUpdate=true;
  }
  // ---- emit ----
  if(typeof camera==="undefined"||!camera)return;
  const cx=camera.position.x, cz=camera.position.z;
  for(const u of units){
    if(!u.alive||!isHuman(u)||!(u.lvl>0))continue;
    // RANGE (John, per the v125 scouting precedent): full strength close, gone by AURA_FAR.
    const d=Math.hypot(u.root.position.x-cx,u.root.position.z-cz);
    if(d>=AURA_FAR){u._auraAcc=0;continue;}
    const near=d<=AURA_NEAR?1:(AURA_FAR-d)/(AURA_FAR-AURA_NEAR);
    const t=auraTint(u,_auraRGB);
    const rate=(AURA_RATE_LO+(AURA_RATE_HI-AURA_RATE_LO)*t)*near;
    u._auraAcc=(u._auraAcc||0)+rate*dt;
    let n=Math.floor(u._auraAcc); if(n<=0)continue;
    if(n>4)n=4;                            // one unit cannot monopolise the pool in a long frame
    u._auraAcc-=n;
    for(let k=0;k<n;k++)
      auraEmit(u.root.position.x,u.root.position.y+0.35,u.root.position.z,_auraRGB[0],_auraRGB[1],_auraRGB[2]);
  }
}
function auraStats(){return{live:_auraLive,max:AURA_MAX,built:!!_auraPts,
  geo:_auraGeo,mat:_auraMat,pts:_auraPts};}
function cannonPlume(f,mx,my,mz){ // the gun speaks: a flash and a modest roll of smoke`);

subC("drive it from updateEffects",
`function updateEffects(dt){
  for(let i=effects.length-1;i>=0;i--){`,
`function updateEffects(dt){
  // v132.29: the level aura rides here because BOTH frame paths provably call updateEffects —
  // tickBody (09-main.js) and NET.guestFrame (10-net.js:2133). Putting it in tickBody alone is
  // trap #12, the v128.8 ribbon a guest could never clear.
  auraTick(dt);
  for(let i=effects.length-1;i>=0;i--){`);

if(failed.length){
  console.error("REFUSING TO WRITE — anchors failed:");
  failed.forEach(f=>console.error("  - "+f));
  process.exit(1);
}
fs.writeFileSync(P.data,d.o);
fs.writeFileSync(P.combat,c.o);
console.log("patched js/00-data.js + js/05-combat.js — the level aura");
