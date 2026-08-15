#!/usr/bin/env node
/* patch-fx-looks.js — v132.42: the PERSISTENT looks, which v132.40 is what made possible.
 *
 * ── WHY THESE COULD NOT HAVE BEEN BUILT BEFORE ──────────────────────────────────────────────
 * Every effect so far has been an EVENT: something happened, draw it, relay it. These are the
 * other kind — a look a unit wears for as long as it holds a buff. That needs the client to know
 * what other units are HOLDING, not merely what just happened to them, and until v132.40 a client
 * knew only its own loadout. So this version is the one that pays for that one.
 *
 * ── ONE POOLED BILLBOARD, FOUR LOOKS ────────────────────────────────────────────────────────
 * Same discipline as the rings: hide everything, then re-arm from live state each frame. A unit
 * that died, walked out of range or lost the buff leaves nothing behind, without any code having
 * to notice that it did. Four looks share one pool:
 *     KING'S GUARD   a faint gold ring at the feet while inside the king's 18 units — it explains
 *                    why that unit is suddenly hard to kill, which is otherwise a mystery to
 *                    whoever is hitting it
 *     DESPERATION    a red haze that deepens as health falls. A gradient, not an edge.
 *     YEOMAN         a marker over a villager who fights. This is a FAIRNESS argument, not a
 *                    decorative one: double health and double damage on something that looks
 *                    exactly like a farmer is a surprise an opponent deserves to see coming.
 *     CAPTAIN        a team-coloured pennant over the holder — "form up here".
 *
 * ── AND ONE EMITTER ─────────────────────────────────────────────────────────────────────────
 *     SECOND SKIN    one pale-green mote every two seconds. Deliberately near-subliminal: this is
 *                    a permanent background state, and anything stronger becomes wallpaper you
 *                    stop seeing inside a minute.
 *
 * ── WHAT I AM DELIBERATELY NOT SHIPPING, AND WHY ────────────────────────────────────────────
 *   KILLING FRENZY and BLOODRUSH are timed modifiers, and tmodSync sends {t:"tmd"} to ONE
 *     connection — the owner — exactly as buffs did before v132.40. So a guest knows its own
 *     stacks and nothing about anyone else's, and building them now would ship two more half-dead
 *     effects. They want the same treatment buffs just got; that is a version of its own.
 *   YEOMAN gets a MARKER, not a re-model. A real silhouette change means the body pipeline, and
 *     u.body is destroyed and geometry-disposed on every rebuild — that is its own piece of work
 *     with its own risks, not a rider on an effects pass.
 *   KNIFE FIGHTER stays a line of puffs. A flying knife needs a projectile kind, a mesh, a travel
 *     path and lag compensation. It was a Batch F when I first said so and it still is.
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

sub("the look pool",
`function buffFxStats(){`,
`// v132.42 THE PERSISTENT LOOKS. One pooled billboard, four looks, same hide-all-then-re-arm rule
// as the rings above — a unit that died or dropped the buff leaves nothing behind, and no code
// has to notice that it did.
let _lookPool=null,_lookOn=0;
function _lookAt(u,yOff,col,size,op){
  if(!_lookPool)_lookPool=[];
  let m=null;
  for(const q of _lookPool)if(!q.visible){m=q;break;}
  if(!m){ m=new THREE.Sprite(new THREE.SpriteMaterial({color:0xffffff,transparent:true,
    opacity:1,depthWrite:false})); scene.add(m); _lookPool.push(m); }
  m.visible=true; m.material.color.setHex(col); m.material.opacity=op;
  m.scale.set(size,size,1);
  m.position.set(u.root.position.x,u.root.position.y+yOff,u.root.position.z);
  _lookOn++;
}
function buffFxStats(){`);

sub("hide the looks with the rings",
`  for(const m of _ringPool)m.visible=false;              // hide-all then re-arm: a unit that died
  for(const m of _threadPool)m.visible=false;            // or dropped a buff leaves nothing behind
  _ringOn=0;`,
`  for(const m of _ringPool)m.visible=false;              // hide-all then re-arm: a unit that died
  for(const m of _threadPool)m.visible=false;            // or dropped a buff leaves nothing behind
  if(_lookPool)for(const m of _lookPool)m.visible=false; // v132.42 the persistent looks, same rule
  _ringOn=0; _lookOn=0;`);

sub("draw the looks",
`  for(const u of units){
    const fx=u._fxMask|0;
    if(!fx||!u.alive||!u.root)continue;`,
`  // v132.42 THE PERSISTENT LOOKS. Keyed on what a unit HOLDS rather than on the ring mask, which
  // is why they had to wait for v132.40 — before that a client knew only its own loadout. Only
  // humans can hold a buff, so the check that skips the other 480 units is the first thing done.
  if(typeof buffSt==="function"&&typeof isHuman==="function")for(const u of units){
    if(!u.alive||!u.root||!isHuman(u)||!u.buffs)continue;
    const kg=buffSt(u,"kguard");
    if(kg&&typeof nearOwnKing==="function"&&nearOwnKing(u))
      _ringAt(u,1.7,0xFFD98A,0.30+0.10*Math.sin(t*2.2));   // standing in the king's light
    const fv=buffSt(u,"fervor");
    if(fv&&u.maxHp>0){                                     // DESPERATION — a gradient, not an edge
      const miss=1-Math.max(0,u.hp)/u.maxHp;
      if(miss>0.12)_lookAt(u,1.5,0xc4402a,2.6,Math.min(0.42,0.42*miss));
    }
    if(buffSt(u,"yeoman")&&u.cls==="villager")             // a farmer who fights — an opponent
      _lookAt(u,3.0,0xE0C53A,0.75,0.85);                   // deserves to see that coming
    if(buffSt(u,"captain"))                                // "form up on me"
      _lookAt(u,3.4,(typeof TEAMCOL!=="undefined"&&TEAMCOL[u.team]!==undefined)?TEAMCOL[u.team]:0xffffff,
        0.8,0.9);
    const rg=buffSt(u,"regen");                            // SECOND SKIN — one mote every two
    if(rg&&u.hp<u.maxHp&&typeof fxs==="function"){         // seconds. Near-subliminal on purpose:
      u._regT=(u._regT||0)+dt;                             // a permanent state drawn loudly is
      if(u._regT>=2){u._regT=0;                            // wallpaper inside a minute
        fxs(u.root.position.x+(Math.random()-0.5)*0.6,u.root.position.y+0.9,
            u.root.position.z+(Math.random()-0.5)*0.6,0x9FE0A8,0.20,1.5,0,1.1,0,0,1,0.55);}
    }
  }
  for(const u of units){
    const fx=u._fxMask|0;
    if(!fx||!u.alive||!u.root)continue;`);

sub("report the looks",
`function buffFxStats(){return {rings:_ringOn,pool:_ringPool?_ringPool.length:0,`,
`function buffFxStats(){return {rings:_ringOn,looks:_lookOn,lookPool:_lookPool?_lookPool.length:0,
  pool:_ringPool?_ringPool.length:0,`);

// ---- SECOND WIND gets a moment ----
sub("SECOND WIND — a brief green wash",
`      const fe=buffSt(attU,"feast");                                  // SECOND WIND
      if(fe)attU.hp=Math.min(attU.maxHp,attU.hp+attU.maxHp*0.10*fe);`,
`      const fe=buffSt(attU,"feast");                                  // SECOND WIND
      if(fe){attU.hp=Math.min(attU.maxHp,attU.hp+attU.maxHp*0.10*fe);
        _vfx(VFX_FEAST,attU.root.position.x,attU.root.position.z,0,0);} // relief, not a spell`);

sub("the feast kind",
`      VFX_WARD=6, VFX_GUARD=7, VFX_VOLLEY=8, VFX_BLEED=9, VFX_VENOM=10, VFX_STUN=11;`,
`      VFX_WARD=6, VFX_GUARD=7, VFX_VOLLEY=8, VFX_BLEED=9, VFX_VENOM=10, VFX_STUN=11,
      VFX_FEAST=12;   // v132.42 SECOND WIND`);

sub("the feast renderer",
`    case VFX_STUN: {           // CONCUSSIVE BLOW — sparks ORBITING for the stun's own duration,`,
`    case VFX_FEAST: {          // SECOND WIND — a quick upward wash. Relief, not a spell.
      for(let i=0;i<5;i++){const a=Math.PI*2*i/5;
        fxs(x+Math.cos(a)*0.5,gy+0.5,z+Math.sin(a)*0.5,0x9FE0A8,0.42,0.28,0,3.4,0,0,0.9,0.8);}
      break; }
    case VFX_STUN: {           // CONCUSSIVE BLOW — sparks ORBITING for the stun's own duration,`);

if(failed.length){
  console.error("REFUSING TO WRITE — anchors failed:");
  failed.forEach(f=>console.error("  - "+f));
  process.exit(1);
}
fs.writeFileSync(F,s);
console.log("patched js/05-combat.js — the persistent looks + Second Wind");
