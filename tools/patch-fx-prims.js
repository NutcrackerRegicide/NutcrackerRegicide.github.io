#!/usr/bin/env node
/* patch-fx-prims.js — v132.41: three pooled primitives, and the eleven set-pieces built on them.
 *
 * ── WHY NOT JUST CALL puff() MORE ───────────────────────────────────────────────────────────
 * puff() is the game's whole transient vocabulary: one Sprite that grows, rises and fades over
 * 0.35s, with all three behaviours hardcoded in updateEffects. It cannot fall, cannot hold its
 * size, cannot travel sideways — so drips, shatter shards, spike bursts and after-images are all
 * out of reach. And it mints a fresh Sprite AND SpriteMaterial per call, which in r128 is two
 * generateUUID() calls — eight random draws — plus two objects for the collector, on every hit
 * that lands anywhere on the map.
 *   ⚠ puff() IS LEFT ALONE. Rewriting the primitive every impact in the game depends on, in the
 *   same version that adds eleven new effects, is two risks wearing one version number. Its churn
 *   is real and belongs in the handoff as its own piece of work.
 *
 * ── THE THREE PRIMITIVES ────────────────────────────────────────────────────────────────────
 *   fxs()   a POOLED sprite with per-particle velocity, gravity, spin and a size curve. Drips,
 *           shards, spikes, sparks and after-images are all this one function with different
 *           numbers, which is why eleven effects need three primitives rather than eleven.
 *   fxRing()an expanding ground ring. Reuses the v132.39 _ringGeo — one unit-radius geometry
 *           scaled per frame — so a shockwave costs a scale assignment, not a rebuild.
 *   fxFacet()a flat hexagon standing in the air, angled at whoever swung. A block must not read
 *           as a hit, and today both are the same round puff; shape carries that better than
 *           colour does.
 *
 * ⚠ ONE NAMESPACE FOR FOURTEEN FILES. The bundle evaluates as a single script, so every top-level
 * binding in every js/ file shares one scope. This patch first shipped a `let _facetGeo` and
 * 04-units.js already had a FUNCTION of that name — the low-poly helper every unit body is built
 * from. It surfaced as a hard LOAD FAIL, which was lucky: with a different declaration order it
 * would have silently shadowed the helper and broken every unit mesh in the game. Any new
 * top-level name has to be checked against the whole bundle, not against its own file.
 *
 * ── EVERYTHING IS POOLED AND LAZY ───────────────────────────────────────────────────────────
 * Same two rules as the rings: nothing is constructed at load (the seeded window — invariant #2),
 * and nothing allocates per frame once warm. The pools have CEILINGS: past them the oldest
 * particle is recycled rather than a new one made, so a hundred-unit melee degrades by dropping
 * the oldest spark instead of by allocating without bound.
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

sub("the primitives",
`// ---------- v132.34: the DEBUFF half of the timed system ----------`,
`// ---------- v132.41 THE SET-PIECES: three pooled primitives ----------
// Ceilings, not limits-by-hope. Past them the OLDEST particle is recycled, so a hundred-unit
// melee degrades by dropping the stalest spark rather than by allocating for ever.
const FXS_MAX=260, FXHEX_MAX=24, FXRING_MAX=24;
let _fxsPool=null,_fxsGeo=null,_fxsNext=0;
let _hexPool=null,_hexGeo=null;
let _xringPool=null;
const _fxLive=[];        // {m,t,dur,kind,...} — everything animating this frame
function _fxBuild(){     // LAZY. Never at load — invariant #2, the seeded window.
  if(_fxsPool)return;
  _ringBuild();          // the v132.41 shockwave rides the v132.39 ring geometry
  _fxsPool=[]; _hexPool=[]; _xringPool=[];
  _hexGeo=new THREE.CircleGeometry(1,6);     // six sides: a FACET, not a puff
}
function _fxsTake(){
  if(_fxsPool.length<FXS_MAX){
    const m=new THREE.Sprite(new THREE.SpriteMaterial({color:0xffffff,transparent:true,opacity:1,
      depthWrite:false}));
    scene.add(m); _fxsPool.push(m); return m;
  }
  const m=_fxsPool[_fxsNext++%FXS_MAX];      // recycle the oldest
  return m;
}
// ONE sprite, many behaviours. vy<0 falls, g pulls, grow<1 shrinks — drips, shards, spikes,
// sparks and after-images are all this with different numbers.
function fxs(x,y,z,col,size,life,vx,vy,vz,g,grow,fade0){
  if(typeof scene==="undefined"||typeof THREE==="undefined")return null;
  _fxBuild();
  const m=_fxsTake(); m.visible=true;
  m.position.set(x,y,z); m.scale.set(size,size,1);
  m.material.color.setHex(col); m.material.opacity=(fade0===undefined?1:fade0);
  const e={m,t:life,dur:life,vx:vx||0,vy:vy||0,vz:vz||0,g:g||0,grow:(grow===undefined?1:grow),
    op0:(fade0===undefined?1:fade0),kind:"s"};
  _fxLive.push(e); return e;
}
function fxRing(x,z,r0,r1,life,col,op0){    // an expanding ground ring — the shockwave
  if(typeof scene==="undefined"||typeof THREE==="undefined")return null;
  _fxBuild();
  let m=null;
  for(const q of _xringPool)if(!q.visible){m=q;break;}
  if(!m){
    if(_xringPool.length>=FXRING_MAX)m=_xringPool[0];
    else{ m=new THREE.Mesh(_ringGeo,new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,
      opacity:1,depthWrite:false,side:THREE.DoubleSide})); m.renderOrder=-1;
      scene.add(m); _xringPool.push(m); }
  }
  m.visible=true; m.material.color.setHex(col);
  m.position.set(x,(typeof terrainHeight==="function"?terrainHeight(x,z):0)+RING_Y+0.02,z);
  m.scale.set(r0,1,r0);
  const e={m,t:life,dur:life,r0,r1,op0:(op0===undefined?0.75:op0),kind:"r"};
  _fxLive.push(e); return e;
}
function fxFacet(x,y,z,ang,col,life,size){  // a hexagon standing in the air, facing the attacker
  if(typeof scene==="undefined"||typeof THREE==="undefined")return null;
  _fxBuild();
  let m=null;
  for(const q of _hexPool)if(!q.visible){m=q;break;}
  if(!m){
    if(_hexPool.length>=FXHEX_MAX)m=_hexPool[0];
    else{ m=new THREE.Mesh(_hexGeo,new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,
      opacity:1,depthWrite:false,side:THREE.DoubleSide})); scene.add(m); _hexPool.push(m); }
  }
  m.visible=true; m.material.color.setHex(col);
  m.position.set(x,y,z); m.rotation.set(0,ang,0); m.scale.set(size||1.5,size||1.5,1);
  const e={m,t:life,dur:life,op0:0.85,kind:"f"};
  _fxLive.push(e); return e;
}
function fxTick(dt){
  if(!_fxLive.length)return;
  for(let i=_fxLive.length-1;i>=0;i--){
    const e=_fxLive[i]; e.t-=dt;
    const k=Math.max(0,e.t/e.dur);            // 1 at birth, 0 at death
    if(e.t<=0){ e.m.visible=false; _fxLive.splice(i,1); continue; }
    if(e.kind==="s"){
      e.vy-=e.g*dt;
      e.m.position.x+=e.vx*dt; e.m.position.y+=e.vy*dt; e.m.position.z+=e.vz*dt;
      if(e.grow!==1)e.m.scale.multiplyScalar(1+(e.grow-1)*dt);
      e.m.material.opacity=e.op0*k;
    }else if(e.kind==="r"){
      const r=e.r0+(e.r1-e.r0)*(1-k);         // out from r0 to r1 over its life
      e.m.scale.set(r,1,r);
      e.m.material.opacity=e.op0*k*k;         // squared: bright at the front, gone at the edge
    }else{
      e.m.material.opacity=e.op0*k;
      e.m.scale.multiplyScalar(1+0.6*dt);
    }
  }
}
function fxStats(){return {live:_fxLive.length,sprites:_fxsPool?_fxsPool.length:0,
  facets:_hexPool?_hexPool.length:0,rings:_xringPool?_xringPool.length:0,built:!!_fxsPool};}
// ---------- v132.34: the DEBUFF half of the timed system ----------`);

sub("drive fxTick from the ONE function both frame paths call",
`  if(typeof buffFxTick==="function")buffFxTick(dt); // v132.39 the Batch D rings — same reasoning
                                                   // as the aura above: BOTH frame paths land here`,
`  if(typeof buffFxTick==="function")buffFxTick(dt); // v132.39 the Batch D rings — same reasoning
                                                   // as the aura above: BOTH frame paths land here
  if(typeof fxTick==="function")fxTick(dt);         // v132.41 the set-pieces, same reasoning again`);

if(failed.length){
  console.error("REFUSING TO WRITE — anchors failed:");
  failed.forEach(f=>console.error("  - "+f));
  process.exit(1);
}
fs.writeFileSync(F,s);
console.log("patched js/05-combat.js — three pooled FX primitives");
