/* REGICIDE PVP — 05-combat.js */
// ---------- effects / projectiles ----------
// ---------- v132.32 TIMED SELF-MODIFIERS ----------
// One entry per KIND, refreshed rather than duplicated — five kills in a row must not leave five
// timers behind. `fade` scales the magnitude by the life remaining, which is what "fading over
// two seconds" means and what a plain expiry cannot say.
const TMOD_OOC=5;      // seconds unhit before LONG STRIDER opens up — the same threshold, and the
                       // same field, Second Skin already uses, so the game has ONE definition of
                       // "out of combat" rather than two that drift apart.
const TMOD_LOW=0.25;   // the SURVIVAL INSTINCT line
// v132.43: the kinds, in a FIXED order, because the wire ships an index rather than a name.
// Appending is safe; reordering is a PROTO change. Same contract as the BUFFS index in v132.40.
const TMOD_KINDS=["bleed","poison","stun","healblock","spdmul","dmgflat"];
function tmodAdd(u,k,mag,dur,fade,cap){
  if(!u)return;
  if(!u._tmods)u._tmods=[];
  for(const e of u._tmods){
    if(e.k!==k)continue;
    e.mag=cap?Math.min(cap,e.mag+mag):Math.max(e.mag,mag);   // accumulate to a cap, or refresh
    e.t=dur; e.dur=dur; e.fade=!!fade;
    tmodSync(u,k,mag,dur,fade,cap);
    return;
  }
  u._tmods.push({k:k,mag:mag,t:dur,dur:dur,fade:!!fade});
  tmodSync(u,k,mag,dur,fade,cap);
}
// v132.33: ship it to the owner so their PREDICTION matches. The send lives in tmodAdd and not at
// its call sites — a call site that forgets to sync is the exact bug this fixes, and batches C-E
// will add more of them. Guests and solo play fall straight through the mode check.
function tmodSync(u,k,mag,dur,fade,cap){
  if(typeof NET==="undefined"||NET.mode!=="host"||!u||!u.remote)return;
  const r=NET.remotes[u.remote]; if(!r||!r.conn)return;
  try{r.conn.send({t:"tmd",k:k,m:mag,d:dur,f:fade?1:0,c:cap||0});}catch(_){}
}
function tmodSyncClear(u){
  if(typeof NET==="undefined"||NET.mode!=="host"||!u||!u.remote)return;
  const r=NET.remotes[u.remote]; if(!r||!r.conn)return;
  try{r.conn.send({t:"tmd",clr:1});}catch(_){}
}
function tmodSum(u,k){ // ADDITIVE kinds (flat damage): two sources add
  const a=u&&u._tmods; if(!a)return 0;
  let s=0;
  for(const e of a)if(e.k===k)s+=e.fade?e.mag*(e.t/e.dur):e.mag;
  return s;
}
function tmodMul(u,k){ // MULTIPLICATIVE kinds (move speed): two sources compound
  const a=u&&u._tmods; if(!a)return 1;
  let m=1;
  for(const e of a)if(e.k===k)m*=1+(e.fade?e.mag*(e.t/e.dur):e.mag);
  return m;
}
// v132.37: every triggered buff has its own cue. Positional, so the existing panner places it.
// ONE path for all twelve: play it here, and put it on the wire. Ten of the twelve fire from
// host-only code (dealDamage bails on guests; auraBuffTick and knifeTick run in the host loop),
// so without the broadcast a guest hears almost none of them — and a DEDICATED SERVER, which has
// no local player at all, would play the whole set to an empty room.
// Half the client-side category window: the host relays a slightly denser stream than it plays,
// and each guest thins it with its own throttle, judged at its own position. See js/11-audio.js.
const SFX_NET={bleedhit:0.10,venomhit:0.10,gashcut:0.10,stunhit:0.075,shrugoff:0.125,sear:0.30,
  knifethrow:0.075,volleyshot:0.06,wardblock:0.06,guardblock:0.06,sanctuary:0.45,quakeslam:0.125,
  critstrike:0.07,dodgeswish:0.075,lastlegs:0.20,cullkill:0.10};   // v132.38, half the ear again
const _sfxLast={};
const _sfxAt=(k,u)=>{
  if(!u||!u.root)return;
  const x=u.root.position.x, z=u.root.position.z;
  if(typeof Sound!=="undefined")Sound.play(k,{x,z});          // silent on a headless server
  if(typeof NET!=="undefined"&&NET.mode==="host"&&NET.bcast&&typeof T!=="undefined"){
    const d=T-(_sfxLast[k]!==undefined?_sfxLast[k]:-1e9);     // d<0 = the clock restarted
    if(d<0||d>=(SFX_NET[k]||0)){_sfxLast[k]=T;NET.bcast({t:"snd",k,x,z});}
  }
};
// v132.36: RAPID VOLLEY and EARTHSHAKER both re-enter dealDamage. Without this the extra shots
// would each roll their own volley and the slam would chain off its own splash.
let _volleyIn=false;
// KNIFE FIGHTER. Its own 2-second clock, holders only, host-side. It is NOT a flying projectile:
// that would need a projectile kind, a mesh, a travel path and lag compensation. It resolves
// against the nearest enemy in range with a puff along the line, which is honest about what it is.
const KNIFE_R=14, KNIFE_EVERY=2;
function knifeTick(u,dt){
  const st=(typeof buffSt==="function")?buffSt(u,"knives"):0;
  if(!st||!u.alive)return;
  u._knifeT=(u._knifeT||0)+dt;
  if(u._knifeT<KNIFE_EVERY)return;
  u._knifeT=0;
  if(Math.random()>=0.10*st)return;
  const px=u.root.position.x, pz=u.root.position.z, R2=KNIFE_R*KNIFE_R;
  let best=null,bd=R2;
  for(const o of units){
    if(!o.alive||o.team===u.team||o.team===undefined)continue;
    const dx=o.root.position.x-px, dz=o.root.position.z-pz;
    const d2=dx*dx+dz*dz;
    if(d2<bd){bd=d2;best=o;}
  }
  if(!best)return;
  // v132.44: it FLIES now. The three static puffs read as three separate things happening rather
  // than as one thing travelling — which was the whole complaint in the worksheet. And it goes on
  // the wire: knifeTick runs in the host unit loop, so the old dots drew on the host alone.
  _vfx(VFX_KNIFE,px,pz,Math.round(best.root.position.x*10),Math.round(best.root.position.z*10));
  _sfxAt("knifethrow",u);
  dealDamage(u,best,(u.dmg||5)*0.6*st);
}
// ---------- v132.35 RADIUS AURAS ----------
// The one buff shape that can wreck the tick budget. Three rules keep it cheap: only HOLDERS
// scan, they scan at 4 Hz rather than per frame, and ONE pass over units serves all six effects.
const AURA_BR=10;        // the radius they share — the Temple's heal reach, so the game has one
                         // idea of "near you" rather than six
const AURA_SCAN=0.25;    // seconds between scans. A heal-over-time cannot tell; the budget can.
const AURA_STILL=3;      // SANCTUARY's stillness clock
// v132.47: a SPEED, not a per-frame distance. The first cut of this compared raw displacement
// against a fixed 0.25 and was wrong in the same way the bug it replaced was wrong: at 60fps a
// unit walking at 4 units/sec moves 0.067 in a frame, so every walking unit read as STILL and the
// zone would have gone on healing at a run. The smoketest caught it by moving a unit at a
// realistic pace, which is the only reason it is not in this build.
// Class speeds run 2.6-7.0 u/s, so 0.6 is far below the slowest walk and far above the drift of
// separation and terrain settling.
const STILL_SPD=0.6;     // units/sec above which a unit counts as MOVING
function auraBuffTick(u,dt){
  if(!u.alive||typeof isHuman!=="function"||!isHuman(u))return;
  const sanct=buffSt(u,"sanctuary"), brand=buffSt(u,"brand"), kin=buffSt(u,"kinship"),
        stew=buffSt(u,"steward"), res=buffSt(u,"resolve"), pha=buffSt(u,"phalanx");
  if(!(sanct||brand||kin||stew||res||pha)){
    u._auraE=0;u._auraA=0;u._stillT=0;
    u._fxMask=0;u._fxKin=0;u._fxStw=0;u._fxStill=0;      // v132.39: …and drop the ring. A stale
    return;                                              // mask here is a ring that never leaves.
  }
  // SANCTUARY's clock. Deliberately not reset by taking damage — standing your ground under fire
  // is the whole fantasy.
  // ⚠ v132.47: MEASURED, not flagged. u.moving is CONSUMABLE — animateUnit clears it on its first
  // line, and updateUnitCommon (which calls it) runs BEFORE statusTick, which drives this. So this
  // clock read a flag that had already been wiped and was never once reset by walking: the zone
  // healed you at a dead run, from v132.35 until John walked out of it and kept healing.
  // Position cannot be consumed by anything, and does not care what order the frame runs in.
  {
    const _px=u.root.position.x, _pz=u.root.position.z;
    const _lx=(u._stillX===undefined)?_px:u._stillX, _lz=(u._stillZ===undefined)?_pz:u._stillZ;
    const _d2=(_px-_lx)*(_px-_lx)+(_pz-_lz)*(_pz-_lz);
    u._stillX=_px; u._stillZ=_pz;
    // not zero: separation and terrain settling nudge a standing unit, and a zero-tolerance test
    // would mean the zone could never open at all
    const _lim=STILL_SPD*Math.max(1e-4,dt);            // a distance budget for THIS frame
    u._stillT=(_d2>_lim*_lim)?0:(u._stillT||0)+dt;
  }
  u._auraW=(u._auraW||0)+dt;
  if(u._auraW<AURA_SCAN)return;
  const step=u._auraW; u._auraW=0;
  const R2=AURA_BR*AURA_BR, px=u.root.position.x, pz=u.root.position.z;
  const zoneOpen=sanct&&u._stillT>=AURA_STILL;
  // the cue belongs to the MOMENT the zone opens, not to every scan while it is open
  if(zoneOpen&&!u._zoneWasOpen)_sfxAt("sanctuary",u);
  u._zoneWasOpen=zoneOpen;
  // v132.39: what the RINGS need. The display reads only these fields, so host and guest run the
  // same drawing code and a dedicated server needs no special case. Six bits, two counts, one
  // clock, two ids — see patch-buff-rings-net.js for how they reach a guest.
  u._fxMask=(sanct?1:0)|(brand?2:0)|(kin?4:0)|(stew?8:0)|(res?16:0)|(pha?32:0);
  u._fxStill=Math.min(1,(u._stillT||0)/AURA_STILL);
  let allies=0, enemies=0, kinNear=false, kinId=0;
  // ONE pass. Six effects.
  for(const o of units){
    if(!o.alive||o===u)continue;
    const dx=o.root.position.x-px, dz=o.root.position.z-pz;
    if(dx*dx+dz*dz>R2)continue;
    if(o.team===u.team){
      allies++;
      if(kin&&!kinNear&&o.cls===u.cls&&!o.isKing){kinNear=true;kinId=o.id;} // v132.39: WHICH one,
                                                                            // for the thread
      if(zoneOpen&&o.hp<o.maxHp){                       // SANCTUARY mends the whole warband
        o.hp=Math.min(o.maxHp,o.hp+u.maxHp*0.03*sanct*step);
        if(o.bar&&typeof setBar==="function")setBar(o.bar,o.hp/o.maxHp);
      }
    }else{
      enemies++;                                         // the wilds count: surrounded is surrounded
      if(brand&&typeof dealDamage==="function"){
        dealDamage(u,o,1*brand*step);                    // SEARING PRESENCE
        // continuous damage, so the cue is THROTTLED — a sizzle every ~2.5s, not a buzz
        if(typeof T!=="undefined"&&T-(u._searT||-999)>2.5){u._searT=T;_sfxAt("sear",u);}
      }
    }
  }
  u._auraA=allies; u._auraE=enemies;                     // cached for the damage-time readers
  u._fxKin=kinId;                                        // v132.39: 0 when nobody of your kind is near
  if(zoneOpen&&u.hp<u.maxHp){                            // …and it mends the one who opened it
    u.hp=Math.min(u.maxHp,u.hp+u.maxHp*0.03*sanct*step);
    if(u.isPlayer&&typeof updatePlayerHud==="function")updatePlayerHud();
  }
  if(kin&&kinNear&&u.hp<u.maxHp){                        // KINSHIP
    u.hp=Math.min(u.maxHp,u.hp+1.0*kin*step);
    if(u.bar&&typeof setBar==="function")setBar(u.bar,u.hp/u.maxHp);
  }
  let _stw=0;
  if(stew&&u.cls==="villager"&&typeof buildings!=="undefined"){ // STEWARD
    for(const b of buildings){
      if(!b.alive||b.team!==u.team||!b.built||b.hp>=b.def.hp)continue;
      const bx=b.x-px, bz=b.z-pz;
      if(bx*bx+bz*bz>R2)continue;
      b.hp=Math.min(b.def.hp,b.hp+0.5*stew*step);
      if(!_stw)_stw=b.id;                                // v132.39: the first one mended gets the ring
    }
  }
  u._fxStw=_stw;
}
// ---------- v132.39 BATCH D MADE VISIBLE: the ground rings ----------
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
  if(_lookPool)for(const m of _lookPool)m.visible=false; // v132.42 the persistent looks, same rule
  _ringOn=0; _lookOn=0;
  const t=(typeof T!=="undefined")?T:0;
  // v132.42 THE PERSISTENT LOOKS. Keyed on what a unit HOLDS rather than on the ring mask, which
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
    // v132.43 KILLING FRENZY — a chevron per +2 damage. The stack count and the seven-second
    // window were both invisible; this shows the first directly and the second by winking out.
    if(typeof tmodSum==="function"&&u._tmods){
      const fl=tmodSum(u,"dmgflat");
      if(fl>0){const nch=Math.min(5,Math.round(fl/2));
        for(let i=0;i<nch;i++)_lookAt(u,3.6+i*0.34,0xE05A3A,0.42,0.9);}
      // …and a trail while the unit is moving faster than it should be. This reads the MODIFIER,
      // not BLOODRUSH: HUNTER'S STEP and SURVIVAL INSTINCT push the same value, and drawing a
      // trail for one of three things that move you would be a lie about what you are seeing.
      if(typeof tmodMul==="function"&&typeof fxs==="function"&&tmodMul(u,"spdmul")>1.05&&u.moving){
        u._trailT=(u._trailT||0)+dt;
        if(u._trailT>=0.055){u._trailT=0;
          fxs(u.root.position.x,u.root.position.y+0.85,u.root.position.z,0xBFD8FF,0.34,0.30,
              0,0.5,0,0,0.7,0.42);}
      }
    }
    // v132.47 VENOMOUS — a slight green glow on the weapon. ⚠ NOT parented to the weapon mesh:
    // that lives under u.body, which is emptied and geometry-disposed on every rebuild, so an
    // attachment there works until the first restyle and then silently never again (invariant #9).
    // Positioned at the hand each frame instead — forward and out to the right, at chest height,
    // tracking the facing so it reads as being ON the blade while owning nothing.
    if(buffSt(u,"venom"))
      _lookAtOff(u,0.55,0.45,1.55,0x8fd45a,0.42,0.30+0.10*Math.sin(t*3.1));
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
// Test surface. `live` is what is ON SCREEN this frame — radius, opacity and colour per ring —
// so a gate can assert that UNBOWED tightened rather than merely that something was drawn.
// v132.42 THE PERSISTENT LOOKS. One pooled billboard, four looks, same hide-all-then-re-arm rule
// as the rings above — a unit that died or dropped the buff leaves nothing behind, and no code
// has to notice that it did.
let _lookPool=null,_lookOn=0;
// v132.47: a look at an OFFSET from the unit rather than straight above it — the venom glow sits
// where the weapon hand is, which means tracking the facing.
function _lookAtOff(u,fwd,side,yOff,col,size,op){
  const f=u.facing||0;
  const fx=Math.sin(f), fz=Math.cos(f);
  _lookRaw(u.root.position.x+fx*fwd+fz*side,
           u.root.position.y+yOff,
           u.root.position.z+fz*fwd-fx*side,col,size,op);
}
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
function _lookRaw(x,y,z,col,size,op){
  if(!_lookPool)_lookPool=[];
  let m=null;
  for(const q of _lookPool)if(!q.visible){m=q;break;}
  if(!m){ m=new THREE.Sprite(new THREE.SpriteMaterial({color:0xffffff,transparent:true,
    opacity:1,depthWrite:false})); scene.add(m); _lookPool.push(m); }
  m.visible=true; m.material.color.setHex(col); m.material.opacity=op;
  m.scale.set(size,size,1); m.position.set(x,y,z);
  _lookOn++;
}
// ⚠ rings/looks count what was DRAWN THIS FRAME; ringVis/lookVis count what is ON SCREEN. They
// answer different questions and only the second one can see a hide-all pass that stopped
// running — a draw counter reads zero either way. See tools/patch-looks-visible.js.
function buffFxStats(){return {rings:_ringOn,looks:_lookOn,lookPool:_lookPool?_lookPool.length:0,
  lookVis:_lookPool?_lookPool.filter(m=>m.visible).length:0,
  ringVis:_ringPool?_ringPool.filter(m=>m.visible).length:0,
  pool:_ringPool?_ringPool.length:0,
  threads:_threadPool?_threadPool.filter(m=>m.visible).length:0,built:!!_ringGeo,
  live:_ringPool?_ringPool.filter(m=>m.visible).map(m=>({r:m.scale.x,
    op:m.material.opacity,col:m.material.color.getHex()})):[]};}
// ---------- v132.41 THE SET-PIECES: three pooled primitives ----------
// Ceilings, not limits-by-hope. Past them the OLDEST particle is recycled, so a hundred-unit
// melee degrades by dropping the stalest spark rather than by allocating for ever.
const FXS_MAX=260, FXHEX_MAX=24, FXRING_MAX=24;
let _fxsPool=null,_fxsGeo=null,_fxsNext=0;
// v132.45 THE SHAPES. Raw-byte DataTextures, the same way _auraDot does it and for the same
// reason: canvas is stubbed in the headless harness. Built LAZILY — three textures at load would
// each mint a uuid inside the seeded window and move every tree on the map (invariant #2).
let _texSoft=null,_texBlade=null,_texSliver=null;
function _mkTex(w,h,fn){
  const d=new Uint8Array(w*h*4);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const a=Math.max(0,Math.min(1,fn((x+0.5)/w,(y+0.5)/h)));
    const i=(y*w+x)*4; d[i]=255;d[i+1]=255;d[i+2]=255;d[i+3]=Math.round(255*a);
  }
  const t=new THREE.DataTexture(d,w,h,THREE.RGBAFormat); t.needsUpdate=true; return t;
}
function _texBuild(){
  if(_texSoft)return;
  // a round falloff — what a mote, a drip, a shard or a spark should look like
  _texSoft=_mkTex(16,16,(u,v)=>{const r=Math.hypot(u-0.5,v-0.5)*2; const a=1-r; return a*a;});
  // A KNIFE, pointing along +u. Proportions matter more than resolution here: the first cut had a
  // guard nearly as tall as the image and a blade 62% of the height, which rendered as a cleaver.
  // A knife is mostly THIN — a slim grip, a guard barely wider than it, and a long narrow blade
  // that carries a slight belly before the point. 48px of length so the taper is smooth rather
  // than stepped; the alpha is anti-aliased at the edge for the same reason.
  _texBlade=_mkTex(48,16,(u,v)=>{
    const dy=Math.abs(v-0.5)*2;                        // 0 at the spine, 1 at the edges
    const edge=(w)=>Math.max(0,Math.min(1,(w-dy)*7));  // soft edge instead of a hard step
    if(u>=0.34){                                       // the blade: a belly, then a point
      const t=(u-0.34)/0.66;                           // 0 at the guard, 1 at the tip
      const w=0.40*Math.sqrt(Math.max(0,1-t*t))*(1-0.15*t);
      return edge(w);
    }
    if(u>=0.28)return edge(0.62);                      // the guard — wider than the grip, no more
    if(u>=0.03)return edge(0.20);                      // a slim grip
    return 0;
  });
  // A SHARD for the crit burst, pointing along +u. Concave sides so it reads as a splinter of
  // light rather than as a triangle.
  _texSliver=_mkTex(32,8,(u,v)=>{
    const dy=Math.abs(v-0.5)*2;
    const w=0.92*Math.pow(1-u,1.6);
    return Math.max(0,Math.min(1,(w-dy)*9));
  });
}
// ⚠ _hexGeo, NOT _facetGeo. 04-units.js already has a top-level function of that name — the
// low-poly helper every unit body is built with — and the fourteen files evaluate as ONE script,
// so every top-level binding in any of them shares one namespace. The clash was a hard LOAD FAIL
// here; with a different declaration order it would instead have silently shadowed the helper and
// broken every unit mesh in the game. Check new top-level names against the whole bundle.
let _hexPool=null,_hexGeo=null;
let _xringPool=null;
const _fxLive=[];        // {m,t,dur,kind,...} — everything animating this frame
function _fxBuild(){     // LAZY. Never at load — invariant #2, the seeded window.
  if(_fxsPool)return;
  _ringBuild();          // the v132.41 shockwave rides the v132.39 ring geometry
  _texBuild();
  _fxsPool=[]; _hexPool=[]; _xringPool=[];
  _hexGeo=new THREE.CircleGeometry(1,6);   // six sides: a FACET, not a puff
}
function _fxsTake(){
  if(_fxsPool.length<FXS_MAX){
    // ⚠ BORN WITH A MAP. no-map → map changes the shader defines and forces a recompile; texture
    // → texture is a uniform swap. So it starts with the soft dot and only ever exchanges it.
    const m=new THREE.Sprite(new THREE.SpriteMaterial({color:0xffffff,transparent:true,opacity:1,
      depthWrite:false,map:_texSoft}));
    scene.add(m); _fxsPool.push(m); return m;
  }
  const m=_fxsPool[_fxsNext++%FXS_MAX];      // recycle the oldest
  return m;
}
// ONE sprite, many behaviours. vy<0 falls, g pulls, grow<1 shrinks — drips, shards, spikes,
// sparks and after-images are all this with different numbers.
// opts: {tex:"blade"|"sliver", rot:radians, spin:rad/s, ar:aspect}. Everything without opts gets
// the soft dot, which is why drips, shards, motes and sparks all improved without a call site
// changing. Shape only matters where the thing is meant to be recognisable.
function fxs(x,y,z,col,size,life,vx,vy,vz,g,grow,fade0,opts){
  if(typeof scene==="undefined"||typeof THREE==="undefined")return null;
  _fxBuild();
  const m=_fxsTake(); m.visible=true;
  const o=opts||{};
  // o.map is an explicit texture (the damage numbers); o.tex names one of the three shapes
  m.material.map=o.map?o.map:(o.tex==="blade")?_texBlade:(o.tex==="sliver")?_texSliver:_texSoft;
  m.material.rotation=o.rot||0;
  m.position.set(x,y,z);
  const ar=o.ar||1;                                    // a blade is longer than it is wide
  m.scale.set(size*ar,size,1);
  m.material.color.setHex(col); m.material.opacity=(fade0===undefined?1:fade0);
  const e={m,t:life,dur:life,vx:vx||0,vy:vy||0,vz:vz||0,g:g||0,grow:(grow===undefined?1:grow),
    op0:(fade0===undefined?1:fade0),kind:"s",spin:o.spin||0};
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
      if(e.spin)e.m.material.rotation+=e.spin*dt;      // a thrown knife tumbles
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
// The wire vocabulary. Small integers, because the row is [kind,x*10,z*10,p,q] and p/q mean
// whatever the kind needs — an angle, a destination, a duration.
const VFX_QUAKE=1, VFX_CRIT=2, VFX_CULL=3, VFX_SHRUG=4, VFX_DODGE=5,
      VFX_WARD=6, VFX_GUARD=7, VFX_VOLLEY=8, VFX_BLEED=9, VFX_VENOM=10, VFX_STUN=11,
      VFX_FEAST=12,   // v132.42 SECOND WIND
      VFX_KNIFE=13;   // v132.44 KNIFE FIGHTER — the only buff whose fiction is a thrown object
// ONE path: draw it here, and put it on the wire. Identical reasoning to _sfxAt in v132.37 —
// dealDamage returns early on a guest, so without this every set-piece is a host-only slideshow,
// and on a dedicated server it draws into an empty room.
// the bearing from whoever swung to whoever was hit, so a facet faces the blow it stopped
function _fxAng(att,victim){
  if(!att||!att.root||!victim||!victim.root)return 0;
  return Math.atan2(att.root.position.x-victim.root.position.x,
                    att.root.position.z-victim.root.position.z);
}
function _vfx(kind,x,z,p,q){
  vfxPlay([kind,Math.round(x*10),Math.round(z*10),p|0,q|0]);
  if(typeof NET!=="undefined"&&NET.mode==="host"&&NET.vfxPush)
    NET.vfxPush([kind,Math.round(x*10),Math.round(z*10),p|0,q|0]);
}
// …and this is the ONLY place a set-piece is drawn, host and guest alike, so there is no second
// site to forget and no branch that asks which machine it is running on.
function vfxPlay(v){
  if(typeof scene==="undefined"||typeof THREE==="undefined")return;
  const k=v[0], x=v[1]/10, z=v[2]/10, p=v[3], q=v[4];
  const gy=(typeof terrainHeight==="function"?terrainHeight(x,z):0);
  switch(k){
    case VFX_QUAKE: {          // EARTHSHAKER — the radius made visible, plus the dirt it throws
      fxRing(x,z,0.6,(p||100)/10,0.38,0xc9a06a,0.8);
      for(let i=0;i<6;i++){const a=Math.PI*2*i/6+0.3;
        fxs(x+Math.cos(a)*1.2,gy+0.5,z+Math.sin(a)*1.2,0x9a8a6a,0.55,0.55,
            Math.cos(a)*7,5.5,Math.sin(a)*7,14,1,0.9);}
      break; }
    case VFX_CRIT: {           // KEEN EYE — a SPIKE burst. Sharp and quick, because at 3 stacks
      for(let i=0;i<8;i++){    // it rides ~15% of your blows and a bigger flash becomes wallpaper
        const a=Math.PI*2*i/8;
        fxs(x,gy+2.4,z,0xfff4d0,0.26,0.19,Math.cos(a)*13,1.2,Math.sin(a)*13,0,0.55,1,
            {tex:"sliver",ar:2.4,rot:a});}   // v132.45: the worksheet said SPIKE burst, and eight
                                             // squares are not spikes
      break; }
    case VFX_CULL:             // CULLER — one hard white flash. It skipped the fight; say so.
      fxs(x,gy+1.8,z,0xffffff,2.2,0.16,0,0.6,0,0,0.35,1);
      break;
    case VFX_SHRUG: {          // SHRUG IT OFF — the debuffs SHATTER and fly off
      const cols=[0xb3262a,0x8fd45a,0xffe9a8,0xd8dde2,0xb3262a];
      for(let i=0;i<7;i++){const a=Math.PI*2*i/7+0.4;
        fxs(x,gy+1.9,z,cols[i%cols.length],0.34,0.45,Math.cos(a)*6.5,3.2,Math.sin(a)*6.5,9,0.8,1);}
      break; }
    case VFX_DODGE: {          // SIXTH SENSE — a sidestep AFTER-IMAGE, not a small blue hit
      const a=(p/100)+Math.PI/2;
      for(let i=0;i<4;i++)
        fxs(x+Math.cos(a)*0.75,gy+0.7+i*0.55,z+Math.sin(a)*0.75,0x9fd8ff,0.62-i*0.06,0.22,
            Math.cos(a)*1.4,0.3,Math.sin(a)*1.4,0,1,0.55);
      break; }
    case VFX_WARD:             // ARROW WARD — a hex FACET. A block must not read as a hit, and
      fxFacet(x,gy+2.0,z,p/100,0x9fd8ff,0.30,1.7);   // shape carries that better than colour
      break;
    case VFX_GUARD:            // IRON GUARD — the same facet in steel: one idea, two damage types
      fxFacet(x,gy+2.0,z,p/100,0xd8dde2,0.30,1.7);
      break;
    case VFX_VOLLEY: {         // RAPID VOLLEY — THREE streaks, staggered onto the three twangs
      const tx=p/10, tz=q/10;
      for(let n=0;n<3;n++)for(let i=1;i<=4;i++){
        const f=i/5;
        fxs(x+(tx-x)*f,gy+1.7,z+(tz-z)*f,0xe8dcc0,0.22,0.16+n*0.115,0,0,0,0,1,0.85);
      }
      break; }
    case VFX_BLEED:            // SERRATED EDGE — it keeps bleeding, so the mark LINGERS
    case VFX_VENOM: {          // VENOMOUS — the same idea in green; they are the same kind of thing
      const col=(k===VFX_BLEED)?0xb3262a:0x8fd45a;
      const n=Math.max(1,Math.min(10,p|0));
      for(let i=0;i<n;i++)
        fxs(x+(Math.random()-0.5)*0.7,gy+1.9,z+(Math.random()-0.5)*0.7,col,0.20,0.9+i*0.55,
            0,-0.4,0,5.5,1,0.85);
      break; }
    case VFX_FEAST: {          // SECOND WIND — a quick upward wash. Relief, not a spell.
      for(let i=0;i<5;i++){const a=Math.PI*2*i/5;
        fxs(x+Math.cos(a)*0.5,gy+0.5,z+Math.sin(a)*0.5,0x9FE0A8,0.42,0.28,0,3.4,0,0,0.9,0.8);}
      break; }
    case VFX_KNIFE: {          // KNIFE FIGHTER — it FLIES. One pooled sprite along the bearing to
      const tx=p/10, tz=q/10;  // its mark, plus two motes trailing. No projectile kind, no
      const dx=tx-x, dz=tz-z;  // collision, no lag compensation: the damage resolved instantly
      const d=Math.hypot(dx,dz)||0.001;              // and still does. This is a knife you SEE
      const life=Math.min(0.34,0.055+d*0.019);       // thrown, not one whose flight decides
      // v132.45: a BLADE, pointed along its travel and tumbling. Sprite rotation is screen-space,
      // so the bearing is taken in screen terms — good enough at this speed and this size, and it
      // is what turns "a thing sliding sideways" into "a thing thrown".
      fxs(x,gy+1.7,z,0xe8e4d8,0.30,life,dx/d*(d/life),0.55,dz/d*(d/life),1.2,1,0.95,
          {tex:"blade",ar:2.0,rot:Math.atan2(dz,dx),spin:11});
      for(let i=1;i<=2;i++)                          // …and a little of the air it left behind
        fxs(x+dx*(i*0.13),gy+1.7,z+dz*(i*0.13),0xd8dde2,0.20,life*0.55,
            dx/d*(d/life)*0.6,0.3,dz/d*(d/life)*0.6,0.8,0.85,0.5);
      break; }
    case VFX_STUN: {           // CONCUSSIVE BLOW — sparks ORBITING for the stun's own duration,
      const dur=Math.max(0.4,(p||15)/10);           // so the ring is the timer: you can see it end
      for(let i=0;i<3;i++){const a=Math.PI*2*i/3;
        fxs(x+Math.cos(a)*0.85,gy+2.9,z+Math.sin(a)*0.85,0xffe9a8,0.30,dur,
            -Math.sin(a)*2.6,0.15,Math.cos(a)*2.6,0,1,0.95);}
      break; }
  }
}
// The 'pos' view is where the live sprites actually are. A count can say something was drawn; only this
// can say it MOVED — and "the knife flies" is a claim about displacement, not about population.
// ---------- v132.46 DAMAGE NUMBERS ----------
// A texture per DISTINCT VALUE, built once and cached. A match uses a narrow band of numbers, so
// the cache stays small; the cap is there for the long game with strange ones, not for the normal
// case. Same canvas path as _makeTagSprite, including its note that the headless stubs no-op it.
// v132.49 (John): "make floating damage numbers 1.6x larger". The sprite scale is what the eye
// sees, so that is what carries the 1.6 — and the canvas and font carry it too, or the same texels
// stretch over 1.6x the screen and the numbers get bigger AND blurrier.
const DNUM_SCALE=1.6;
const DNUM_W=208, DNUM_H=104;      // 128x64 * 1.6, aspect held at 2:1 so DNUM_AR still matches
const DNUM_FONT=58, DNUM_FONT_CRIT=74;
const DNUM_AR=2.0;
// ⚠ 192 -> 64. A 1.6x canvas is 2.6x the bytes, and at 192 that would be ~16 MB of textures for a
// cosmetic change. 192 was always generous — a match reuses a narrow band of values — so at 64
// the whole cache is ~5.4 MB against the old ~6 MB. Bigger, sharper, and slightly cheaper.
const DNUM_CACHE=64;
let _dnumTex=null,_dnumOrder=null,_dnumMade=0;
function _dnumTexFor(n,crit){
  if(!_dnumTex){_dnumTex={};_dnumOrder=[];}
  const key=(crit?"c":"n")+n;
  if(_dnumTex[key])return _dnumTex[key];
  const c=document.createElement("canvas"); c.width=DNUM_W; c.height=DNUM_H;
  const g=c.getContext("2d");
  if(g.clearRect){                                  // headless stubs no-op all of this safely
    g.clearRect(0,0,DNUM_W,DNUM_H);
    g.font="bold "+(crit?DNUM_FONT_CRIT:DNUM_FONT)+"px Georgia, serif";
    g.textAlign="center"; g.textBaseline="middle";
    g.lineWidth=11; g.strokeStyle="rgba(18,10,4,0.92)";   // the outline scales with the face, or
    g.strokeText(String(n),DNUM_W/2,DNUM_H/2);            // it thins to nothing at this size
    g.fillStyle=crit?"#FFD24A":"#F4EEDC";           // a crit is GOLD and larger — it must not read
    g.fillText(String(n),DNUM_W/2,DNUM_H/2);        // as a normal blow with a bigger font alone
  }
  const t=new THREE.CanvasTexture(c);
  t.magFilter=THREE.LinearFilter; t.minFilter=THREE.LinearFilter; t.generateMipmaps=false;
  _dnumTex[key]=t; _dnumOrder.push(key); _dnumMade++;
  if(_dnumOrder.length>DNUM_CACHE){                 // evict the oldest, and dispose it properly
    const old=_dnumOrder.shift();
    if(_dnumTex[old]&&_dnumTex[old].dispose)_dnumTex[old].dispose();
    delete _dnumTex[old];
  }
  return t;
}
// ⚠ FRACTIONAL DAMAGE BANKS. SEARING PRESENCE deals 0.25 four times a second; rounded that is a
// "0" four times a second per burning enemy. Banking turns it into one honest "1" a second.
function dmgNum(victim,amount,crit){
  if(!victim||!victim.root||typeof scene==="undefined"||typeof THREE==="undefined")return false;
  victim._dnumBank=(victim._dnumBank||0)+amount;
  if(victim._dnumBank<1)return false;
  const n=Math.floor(victim._dnumBank);
  victim._dnumBank-=n;
  // …and they FAN OUT. Three volley blows at one point is one unreadable number.
  const t=(typeof T!=="undefined")?T:0;
  if(t-(victim._dnumT||-99)>0.45)victim._dnumI=0;
  const i=(victim._dnumI=(victim._dnumI||0)+1)-1;
  victim._dnumT=t;
  const off=(i%3-1)*0.85;
  _dnumLast={n:n,crit:!!crit,id:victim.id}; _dnumEmits++;
  fxs(victim.root.position.x+off,victim.root.position.y+3.1+i*0.28,victim.root.position.z,
      0xffffff,(crit?1.15:0.85)*DNUM_SCALE,crit?1.25:1.0,
      off*0.5,2.3,0, -1.6, 1, 1, {map:_dnumTexFor(n,!!crit),ar:DNUM_AR});
  return true;
}
// Test surface. `last` is the figure actually PUT ON SCREEN — which is the only thing worth
// asserting, because the whole point of the feature is that it agrees with the damage the game
// applied. A count of how many were drawn would not catch a number that is simply wrong.
let _dnumLast=null,_dnumEmits=0;
// ⚠ `emits` counts NUMBERS DRAWN. `made` counts textures CREATED, which is a cache-miss counter —
// draw a value that was drawn before and it does not move. A gate that used `made` to ask "did a
// number appear" stayed green with the attacker check deleted, because the value happened to be
// cached already. Adjacent is not the claim.
function dnumStats(){return {cached:_dnumTex?Object.keys(_dnumTex).length:0,made:_dnumMade,
  emits:_dnumEmits,last:_dnumLast,scale:DNUM_SCALE,cap:DNUM_CACHE,w:DNUM_W,h:DNUM_H};}
function fxTex(){return {soft:_texSoft,blade:_texBlade,sliver:_texSliver};}
function fxStats(){return {maps:_fxLive.filter(e=>e.kind==="s").map(e=>({
    blade:e.m.material.map===_texBlade,sliver:e.m.material.map===_texSliver,
    soft:e.m.material.map===_texSoft,rot:e.m.material.rotation})),
  pos:_fxLive.filter(e=>e.kind==="s").map(e=>({x:e.m.position.x,z:e.m.position.z})),
  live:_fxLive.length,sprites:_fxsPool?_fxsPool.length:0,
  facets:_hexPool?_hexPool.length:0,rings:_xringPool?_xringPool.length:0,built:!!_fxsPool};}
// ---------- v132.34: the DEBUFF half of the timed system ----------
// Damage-over-time is applied HERE and only here, from the host's own unit loop. It deliberately
// does not live in updateUnitCommon: 10-net.js calls that on the guest too, and a guest owns no
// damage (05-combat.js returns early for exactly this reason).
const DOT_KINDS=["bleed","poison"];
function statusTick(u,dt){
  tmodTick(u,dt);
  if(typeof auraBuffTick==="function")auraBuffTick(u,dt); // v132.35 radius auras — holders only
  if(typeof knifeTick==="function"&&isHuman(u))knifeTick(u,dt); // v132.36 KNIFE FIGHTER
  if(!u.alive||!u._tmods)return;
  let dps=0;
  for(const k of DOT_KINDS)dps+=tmodSum(u,k);
  if(dps>0){
    u.hp-=dps*dt;
    if(u.bar&&typeof setBar==="function")setBar(u.bar,Math.max(0,u.hp/u.maxHp));
    if(Math.random()<dt*2)puff(u.root.position.x,1.7,u.root.position.z,
      tmodSum(u,"poison")>0?0x8fd45a:0xb3262a,0.5);
    if(u.hp<=0&&typeof killUnit==="function"){u.hp=0;killUnit(u,u._dotBy||null);}
    else if(u.isPlayer&&typeof updatePlayerHud==="function")updatePlayerHud();
  }
}
function isStunned(u){return !!(u&&u._tmods&&tmodSum(u,"stun")>0);}
function healBlocked(u){return !!(u&&u._tmods&&tmodSum(u,"healblock")>0);}
// SHRUG IT OFF sheds everything an enemy put on you — and nothing you earned yourself.
const DEBUFF_KINDS=["bleed","poison","stun","healblock"];
function shedDebuffs(u){
  if(!u||!u._tmods)return 0;
  let n=0;
  for(let i=u._tmods.length-1;i>=0;i--){
    const e=u._tmods[i];
    const bad=DEBUFF_KINDS.indexOf(e.k)>=0||(e.k==="spdmul"&&e.mag<0);
    if(bad){u._tmods.splice(i,1);n++;}
  }
  if(!u._tmods.length)u._tmods=null;
  if(n&&typeof tmodSyncClear==="function"&&u.remote)tmodSyncClear(u); // the owner's screen too
  return n;
}
function tmodTick(u,dt){
  const a=u&&u._tmods;
  if(a&&a.length){
    for(let i=a.length-1;i>=0;i--){a[i].t-=dt;if(a[i].t<=0)a.splice(i,1);}
    if(!a.length)u._tmods=null;
  }
  // SURVIVAL INSTINCT's latch is released HERE and not in dealDamage: healing back over the line
  // never calls dealDamage, so a latch cleared there would stick for the rest of the life.
  if(u._lowLatch&&u.maxHp>0&&u.hp>=u.maxHp*TMOD_LOW)u._lowLatch=false;
}
// ---- v132.30 BATCH A helpers ----
// WOODSMAN. There is no "in the woods" test in this game and scanning 674 wood nodes per blow
// would be absurd. TREE_STANDS is 25 circles with a radius — the same structures the v115 forest
// gates assert against — so this is a 25-iteration loop, run only for a unit holding the buff.
function inTheWoods(u){
  if(typeof TREE_STANDS==="undefined"||!TREE_STANDS.length||!u||!u.root)return false;
  const x=u.root.position.x,z=u.root.position.z;
  for(const s of TREE_STANDS){
    const dx=x-s.x,dz=z-s.z;
    if(dx*dx+dz*dz<s.r*s.r)return true;
  }
  return false;
}
const KGUARD_R=18; // how close "near your King" is
function nearOwnKing(u){
  if(typeof kings==="undefined"||!u||!u.root)return false;
  const k=kings[u.team];
  if(!k||!k.alive||!k.root)return false;
  const dx=u.root.position.x-k.root.position.x, dz=u.root.position.z-k.root.position.z;
  return dx*dx+dz*dz<KGUARD_R*KGUARD_R;
}
function puff(x,y,z,color,scale,life){
  const s=new THREE.Sprite(new THREE.SpriteMaterial({color,transparent:true,opacity:0.9}));
  s.position.set(x,y,z); const sc=scale||0.7; s.scale.set(sc,sc,1); scene.add(s);
  effects.push({s,t:life||0.35});
}
// ---------- v132.29 THE LEVEL AURA ----------
// One pooled Points for every mote in the game. Lazily built, so nothing here is constructed
// inside the seeded world-gen window (invariant #2 — a uuid costs four randoms).
let _auraPts=null,_auraGeo=null,_auraPos=null,_auraCol=null,_auraMat=null;
let _auraLife=null,_auraVel=null,_auraNext=0,_auraLive=0,_auraBase=null;
let _auraOff=null,_auraOwn=null,_auraL0=null;   // v132.50: offset-from-owner, owner, birth-life
let _auraEmits=0;                               // lifetime emissions — the only observable RATE
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
  _auraOff=new Float32Array(AURA_MAX*3);    // v132.50: position RELATIVE to the owner
  _auraOwn=new Array(AURA_MAX).fill(null);  // ...and which unit that is
  _auraL0 =new Float32Array(AURA_MAX);      // birth-life; the fade curve needs it now that life
                                            // varies per mote with the owner's level
  _auraCol=new Float32Array(AURA_MAX*3);
  _auraBase=new Float32Array(AURA_MAX*3);   // the mote's OWN colour, never scaled — see auraTick
  _auraLife=new Float32Array(AURA_MAX);
  _auraVel=new Float32Array(AURA_MAX*3);
  _auraGeo=new THREE.BufferGeometry();
  _auraGeo.setAttribute("position",new THREE.BufferAttribute(_auraPos,3));
  _auraGeo.setAttribute("color",new THREE.BufferAttribute(_auraCol,3));
  _auraMat=new THREE.PointsMaterial({size:AURA_SIZE,sizeAttenuation:false,vertexColors:true,
    transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,map:_auraDot()});
  _auraPts=new THREE.Points(_auraGeo,_auraMat);
  _auraPts.frustumCulled=false;   // the pool spans the map; culling it as one blob would pop
  _auraPts.renderOrder=3;
  scene.add(_auraPts);
}
function auraEmit(u,yOff,rad,rise,life,r,g,b){
  auraInit();
  // claim the next slot round-robin. A full pool overwrites the OLDEST mote, which is the one
  // closest to fading anyway — so the ceiling degrades gracefully instead of dropping new work.
  const i=_auraNext; _auraNext=(_auraNext+1)%AURA_MAX;
  if(_auraLife[i]<=0)_auraLive++;
  const a=Math.random()*Math.PI*2, rr=Math.sqrt(Math.random())*rad;
  // v132.50: the mote is born as an OFFSET. It never learns a world position of its own; the
  // world position below is a derived value, recomputed from the owner on every single frame.
  _auraOwn[i]=u;
  _auraOff[i*3]=Math.cos(a)*rr;
  _auraOff[i*3+1]=yOff+Math.random()*0.5;
  _auraOff[i*3+2]=Math.sin(a)*rr;
  _auraPos[i*3]  =u.root.position.x+_auraOff[i*3];
  _auraPos[i*3+1]=u.root.position.y+_auraOff[i*3+1];
  _auraPos[i*3+2]=u.root.position.z+_auraOff[i*3+2];
  _auraVel[i*3]=(Math.random()-0.5)*0.35;
  _auraVel[i*3+1]=rise*(0.75+Math.random()*0.5);
  _auraVel[i*3+2]=(Math.random()-0.5)*0.35;
  _auraBase[i*3]=r; _auraBase[i*3+1]=g; _auraBase[i*3+2]=b;
  _auraCol[i*3]=r; _auraCol[i*3+1]=g; _auraCol[i*3+2]=b;
  _auraLife[i]=life; _auraL0[i]=life;
  _auraEmits++;
}
function auraTint(u,out){ // team colour at level 1 → gold at the cap
  const t=Math.max(0,Math.min(1,(u.lvl||0)/XP_MAX_LVL));
  const ease=t*t;                         // hold the team read low, let gold arrive late
  // v132.50: HUE and BRIGHTNESS are separate ramps. They used to share ease=t^2, and once the
  // DENSITY curve went superlinear too the two back-loaded curves compounded: a level 16 player
  // — two thirds of the way up a long ladder — photographed as three dim blue specks. Gold still
  // arrives late (that is the team read, §2.5), but the light comes up early enough to be a
  // reward you can see on the way.
  const lit=Math.pow(t,0.8);
  const tc=(typeof TEAMCOL!=="undefined"&&TEAMCOL[u.team]!==undefined)?TEAMCOL[u.team]:0xffffff;
  const r0=((tc>>16)&255)/255, g0=((tc>>8)&255)/255, b0=(tc&255)/255;
  const r1=((AURA_GOLD>>16)&255)/255, g1=((AURA_GOLD>>8)&255)/255, b1=(AURA_GOLD&255)/255;
  const k=0.55+lit*(AURA_HOT-0.55);       // dim at level 1, driven past 1.0 at the cap for bloom
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
      if(_auraLife[i]<=0){ _auraCol[i*3]=0;_auraCol[i*3+1]=0;_auraCol[i*3+2]=0;
        _auraOwn[i]=null; _auraLive--; continue; }
      // v132.50 THE DRIFT PLAYS OUT IN THE OFFSET and the world position is REBUILT from the
      // owner every frame. This IS the no-trail fix: however fast the body moves the cloud
      // arrives with it, because the cloud has no world position of its own to be left behind at.
      _auraOff[i*3]+=_auraVel[i*3]*dt;
      _auraOff[i*3+1]+=_auraVel[i*3+1]*dt;
      _auraOff[i*3+2]+=_auraVel[i*3+2]*dt;
      const own=_auraOwn[i];
      if(own&&own.alive&&own.root){
        _auraPos[i*3]  =own.root.position.x+_auraOff[i*3];
        _auraPos[i*3+1]=own.root.position.y+_auraOff[i*3+1];
        _auraPos[i*3+2]=own.root.position.z+_auraOff[i*3+2];
      }else{
        // the owner died mid-flight. Let the last motes finish where they are rather than snap
        // to the origin — and a corpse does not walk, so nothing here can smear.
        _auraOwn[i]=null;
        _auraPos[i*3]+=_auraVel[i*3]*dt;
        _auraPos[i*3+1]+=_auraVel[i*3+1]*dt;
        _auraPos[i*3+2]+=_auraVel[i*3+2]*dt;
      }
      // FADE FROM THE STORED BASE, never by compounding the live colour. Multiplying the
      // current colour each tick decays it geometrically: a mote was down to a third of its
      // brightness within half a second, so at any instant only the five or six youngest motes
      // read at all and a 34/sec emitter photographed as a handful of sparks. Powers below 1
      // HOLD the mote near full brightness for most of its life, then drop it quickly.
      const f=Math.pow(_auraLife[i]/(_auraL0[i]||1),0.55);   // v132.50: life is per-mote now
      _auraCol[i*3]=_auraBase[i*3]*f;
      _auraCol[i*3+1]=_auraBase[i*3+1]*f;
      _auraCol[i*3+2]=_auraBase[i*3+2]*f;
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
    // v132.50: ONE superlinear curve drives rate, radius, climb and life together, so the cap is
    // a different SHAPE and not merely a busier one. John: "the emphasis does not change much
    // from lvl 1 to 25". Level 1 is a few sparks at the ankles; the cap is a waist-wide column
    // standing two and a half units tall.
    const tc2=Math.pow(t,AURA_CURVE);
    const rate=(AURA_RATE_LO+(AURA_RATE_HI-AURA_RATE_LO)*tc2)*near;
    const rad =AURA_R_LO   +(AURA_R_HI   -AURA_R_LO)   *tc2;
    const rise=AURA_RISE_LO+(AURA_RISE_HI-AURA_RISE_LO)*tc2;
    const life=AURA_LIFE_LO+(AURA_LIFE_HI-AURA_LIFE_LO)*tc2;
    u._auraAcc=(u._auraAcc||0)+rate*dt;
    let n=Math.floor(u._auraAcc); if(n<=0)continue;
    if(n>6)n=6;                            // one unit cannot monopolise the pool in a long frame
    u._auraAcc-=n;
    for(let k=0;k<n;k++)
      auraEmit(u,0.35,rad,rise,life,_auraRGB[0],_auraRGB[1],_auraRGB[2]);
  }
}
// v132.50 instruments. auraSpread is the trail measurement and it is deliberately HORIZONTAL:
// the vertical column is the effect John wants, the horizontal smear is the bug he reported.
function auraSpread(only){   // pass a unit to measure ONLY its motes — see patch-aura-emits.js
  if(!_auraPts)return 0;
  let worst=0;
  for(let i=0;i<AURA_MAX;i++){
    if(_auraLife[i]<=0)continue;
    const own=_auraOwn[i]; if(!own||!own.alive||!own.root)continue;
    if(only&&own!==only)continue;
    const d=Math.hypot(_auraPos[i*3]-own.root.position.x,_auraPos[i*3+2]-own.root.position.z);
    if(d>worst)worst=d;
  }
  return worst;
}
function auraShape(u){ // the cloud this one unit is wearing: how many motes, how wide, how tall
  if(!_auraPts)return{n:0,rad:0,top:0};
  let n=0,rad=0,top=0;
  for(let i=0;i<AURA_MAX;i++){
    if(_auraLife[i]<=0||_auraOwn[i]!==u)continue;
    n++;
    const d=Math.hypot(_auraPos[i*3]-u.root.position.x,_auraPos[i*3+2]-u.root.position.z);
    if(d>rad)rad=d;
    const h=_auraPos[i*3+1]-u.root.position.y; if(h>top)top=h;
  }
  return{n:n,rad:rad,top:top};
}
function auraLive(){ // ALLOCATES. Gates and tools only — never call this from a frame.
  const out=[];
  if(!_auraPts)return out;
  for(let i=0;i<AURA_MAX;i++){
    if(_auraLife[i]<=0)continue;   // a dead slot keeps its last coordinates; only colour is zeroed
    out.push({x:_auraPos[i*3],y:_auraPos[i*3+1],z:_auraPos[i*3+2],owned:!!_auraOwn[i]});
  }
  return out;
}
function auraStats(){return{live:_auraLive,max:AURA_MAX,built:!!_auraPts,
  geo:_auraGeo,mat:_auraMat,pts:_auraPts,spread:auraSpread(),emits:_auraEmits};}
function cannonPlume(f,mx,my,mz){ // the gun speaks: a flash and a modest roll of smoke
  const dx=Math.sin(f),dz=Math.cos(f);
  puff(mx,my,mz,0xffe9a8,0.9,0.14); // the muzzle flash
  const tones=[0xe8e8e8,0xc4c4c4,0x9c9c9c,0x7c7c7c];
  for(let i=0;i<4;i++){
    const t=i/3, spread=0.22+t*0.42;
    puff(mx+dx*(0.45+t*1.6)+(Math.random()-0.5)*spread,
         my+0.12+t*0.5+(Math.random()-0.5)*0.26,
         mz+dz*(0.45+t*1.6)+(Math.random()-0.5)*spread,
         tones[i],0.65+t*0.7,0.35+t*0.25);
  }
}
function hitFlash(u){
  puff(u.root.position.x,(u.cls==="scout"?2.6:1.8)+u.root.position.y,u.root.position.z,0xff3b2f);
}
function shootArrow(att,target){
  const c=att.def?null:CLS[att.cls];
  const siege=c&&isSiege(att.cls);
  // v100 SOUND — projectile launch. Runs on host (via the wrapper) AND on guests (fx theatre
  // replays call the unwrapped shootArrow directly), so both sides hear ranged & siege.
  if(typeof Sound!=="undefined"){
    const _sx=att.root?att.root.position.x:att.x, _sz=att.root?att.root.position.z:att.z;
    // v102: cannon powder-blast · catapult creak · musket gunshot · bow twang
    let _k="bow";
    if(siege)_k=(c&&c.rig==="cannon")?"cannonfire":"siegefire";
    else if(c&&c.rig==="musket")_k="gun";
    Sound.play(_k,{x:_sx,z:_sz});
  }
  let m;
  if(siege){
    m=new THREE.Mesh(new THREE.SphereGeometry(c.rig==="cannon"?0.2:0.32,6,5),
      mat(c.rig==="cannon"?0x2b2b2b:0x8d8d8d));
    m.castShadow=false;
  }else{
    m=cyl(0.05,0.05,0.9,0x4a3826,4); m.castShadow=false;
  }
  const y=att.cls==="scout"?2.4:(att.def&&att.type==="tower"?8:1.8);
  const sx=att.root?att.root.position.x:att.x, sz=att.root?att.root.position.z:att.z;
  const gy=att.root?att.root.position.y:0;
  m.position.set(sx,(att.def?8:y)+gy,sz);
  scene.add(m);
  const tx0=target.root?target.root.position.x:target.x, tz0=target.root?target.root.position.z:target.z;
  const d0=Math.hypot(tx0-(att.root?att.root.position.x:att.x),tz0-(att.root?att.root.position.z:att.z));
  if(c&&c.rig==="cannon"){ // recoil + the full plume
    att._recoil=0.4;
    const f=att.facing||0;
    cannonPlume(f,sx+Math.sin(f)*5.0,gy+3.4,sz+Math.cos(f)*5.0);
  }
  projectiles.push({m,target,spd:siege?(c.rig==="treb"?19:(c.rig==="cannon"?69:23)):30,life:siege?4:2.2,att,
    dmg:att.def?att.def.atk.dmg:att.dmg,attCls:att.def?null:att.cls,baseY:m.position.y,ignoreB:att.garrison||null,
    splash:c&&c.splash,arcH:(c&&c.arc)?Math.min(9,d0*0.22):0,total:Math.max(1,d0),
    bMult:c?(c.bMult||1):1});
}
function splashDamage(att,x,z,r,dmg){ // the stone lands: everything nearby suffers
  for(const v of units){
    if(!v.alive||v.garrison||(att&&v.team===att.team))continue;
    const d=Math.sqrt(dist2(x,z,v.root.position.x,v.root.position.z));
    if(d<r)dealDamage(att,v,dmg*(1-0.6*d/r));
  }
  for(const b of buildings){
    if(!b.alive||(att&&b.team===att.team))continue;
    const d=Math.sqrt(dist2(x,z,b.x,b.z));
    if(d<r+b.def.r*0.6)damageBuilding(b,dmg*0.8,att);
  }
}
function launchLob(att,tx,tz,theatre){ // catapult & trebuchet skill shot
  const sx=att.root.position.x, sz=att.root.position.z;
  const dist=Math.hypot(tx-sx,tz-sz);
  const m=new THREE.Mesh(new THREE.SphereGeometry(att.cls==="trebuchet"?0.55:0.42,6,5),mat(0x8d8d8d));
  m.castShadow=false; m.position.set(sx,att.root.position.y+5,sz); scene.add(m);
  projectiles.push({lob:1,m,att:theatre?null:att,x0:sx,z0:sz,y0:att.root.position.y+5,tx,tz,
    t:0,dur:dist/17+0.85,peak:9+dist*0.24,dmg:att.dmg,life:20});
  att.swing=0.25; triggerAttackAnim(att);
  if(typeof Sound!=="undefined")Sound.play("siegefire",{x:att.root.position.x,z:att.root.position.z}); // v100
  if(typeof NET!=="undefined"&&NET.mode==="host"&&!theatre)
    NET.bcast({t:"lob",uid:att.id,tx:r1(tx),tz:r1(tz)});
}
function updateProjectiles(dt){
  for(let i=projectiles.length-1;i>=0;i--){
    const p=projectiles[i]; p.life-=dt;
    if(p.lob){ // the skill shot: a heavy stone on a fixed arc
      p.t+=dt;
      const k=Math.min(1,p.t/p.dur);
      p.m.position.x=p.x0+(p.tx-p.x0)*k;
      p.m.position.z=p.z0+(p.tz-p.z0)*k;
      const gy=terrainHeight(p.m.position.x,p.m.position.z);
      p.m.position.y=p.y0+(gy+0.3-p.y0)*k+Math.sin(k*Math.PI)*p.peak;
      p.m.rotation.x+=dt*4;
      if(k>=1){
        puff(p.tx,gy+0.6,p.tz,0x9a8a6a); puff(p.tx+0.7,gy+0.4,p.tz-0.5,0x7a6a4a); puff(p.tx-0.6,gy+0.5,p.tz+0.6,0x8a7a5a);
        if(p.att)splashDamage(p.att,p.tx,p.tz,4.5,p.dmg);
        scene.remove(p.m); projectiles.splice(i,1);
      }
      continue;
    }
    if(p.free){ // manually aimed straight shot
      // v128.5 THE ARROW USED TO STEP OVER PEOPLE. dt is clamped to 0.05 (09-main), and a
      // full-draw arrow flies at 36×1.6 = 57.6 u/s — up to 2.88 units per step against a hit
      // DIAMETER of 2.24. A single point-in-circle test per step therefore missed cleanly
      // through a body whenever the frame was long, and the host was measured pegged at that
      // clamp (17fps median), so this was the normal case rather than an edge one. Sweep the
      // segment the arrow actually travelled instead. Costs nothing and it fixes the host's
      // own shots as well as every guest's.
      const _px=p.m.position.x, _pz=p.m.position.z;
      p.m.position.addScaledVector(p.vel,dt);
      p.traveled+=p.spd*dt;
      let done=p.traveled>p.maxRange||p.life<=0;
      if(!done&&p.m.position.y<terrainHeight(p.m.position.x,p.m.position.z)+0.15){
        puff(p.m.position.x,p.m.position.y+0.3,p.m.position.z,0x9a8a6a); done=true;
      }
      if(!done)for(const v of units){
        if(v.team===p.att.team||!v.alive||v.garrison)continue;
        if(segDist2(_px,_pz,p.m.position.x,p.m.position.z,v.root.position.x,v.root.position.z)<ARROW_HIT2){
          dealDamage(p.att,v,p.dmg*rps(p.attCls,v.cls));done=true;break;
        }
      }
      // v131.6 rBlock, MEASURED. This 0.8 inset was sized against the pre-v131 models and the
      // arrow was dying deep inside the new ones: `node tools/_blockprobe.js --proj` puts the
      // median bearing 9.02 units inside a castle wall at r*0.8, 3.60 inside a forge and 2.10
      // inside a guard tower — the shot vanishes in the masonry instead of striking the face. At
      // rBlock*0.8 the same medians are 2.54 / 1.20 / 0.58. The one type that gets worse is the
      // house, whose rBlock is SMALLER than its r (3.8 against 4.6): its arrows now land 0.71
      // inside the wall instead of 0.07. Twelve types better, one 0.64 worse, and the shot now
      // agrees with the body — you cannot walk somewhere your own arrows fly through.
      if(!done)for(const b of buildings){
        if(!b.alive||b.def.flat)continue;
        if(b!==p.ignoreB&&!_shotClears(b,p.m.position)&&
           segDist2(_px,_pz,p.m.position.x,p.m.position.z,b.x,b.z)<Math.pow(b.def.rBlock*0.8,2)){
          if(b.team!==p.att.team)damageBuilding(b,p.dmg,p.att);
          done=true;break;
        }
      }
      if(done){scene.remove(p.m);projectiles.splice(i,1);}
      continue;
    }
    const t=p.target;
    const isBld=!!t.def;
    let tx,ty,tz,deadTarget=!t.alive;
    if(isBld){ tx=t.x; ty=2.5+t.root.position.y; tz=t.z; }
    else { tx=t.root.position.x; ty=(t.cls==="scout"?2.2:1.5)+t.root.position.y; tz=t.root.position.z; }
    if(p.life<=0||deadTarget){ scene.remove(p.m); projectiles.splice(i,1); continue; }
    const dir=new THREE.Vector3(tx-p.m.position.x,ty-p.m.position.y,tz-p.m.position.z);
    const d=dir.length();
    if(d<(isBld?t.def.r:0.9)){
      scene.remove(p.m); projectiles.splice(i,1);
      if(isBld){ damageBuilding(t,p.dmg*(p.bMult||1),p.att); }
      else { dealDamage(p.att,t,p.dmg*(p.attCls?rps(p.attCls,t.cls):1)); }
      if(p.splash){ // boulders and shells burst on impact
        const ix=p.m.position.x,iz=p.m.position.z;
        puff(ix,1.5,iz,0xb0a080); puff(ix,2.4,iz,0x8d8d8d);
        for(const v of units){
          if(v.team===p.att.team||!v.alive||v===t||v.garrison)continue; // splash spares the tower crew
          if(dist2(ix,iz,v.root.position.x,v.root.position.z)<p.splash*p.splash)
            dealDamage(p.att,v,p.dmg*0.5*(p.attCls?rps(p.attCls,v.cls):1));
        }
      }
      continue;
    }
    dir.normalize();
    p.m.position.addScaledVector(dir,p.spd*dt);
    if(p.arcH){ // lobbed boulders sail in a high arc, launch height blending to impact height
      const prog=Math.min(1,1-Math.min(1,d/p.total));
      p.m.position.y=(1-prog)*p.baseY+prog*ty+p.arcH*Math.sin(Math.PI*prog);
    }
    if(!p.att.def&&!p.arcH){ // tower arrows and lobs sail over walls; flat shots don't
      let blk=null;
      for(const b of buildings){
        if(!b.alive||b===p.target||b.def.flat)continue;
        if(b!==p.ignoreB&&!_shotClears(b,p.m.position)&&
           dist2(p.m.position.x,p.m.position.z,b.x,b.z)<Math.pow(b.def.rBlock*0.8,2)){blk=b;break;} // v131.6 rBlock — see :126
      }
      if(blk){
        if(blk.team!==p.att.team)damageBuilding(blk,p.dmg*0.5,p.att);
        puff(p.m.position.x,p.m.position.y,p.m.position.z,0xd8c49a);
        scene.remove(p.m);projectiles.splice(i,1);continue;
      }
    }
    p.m.lookAt(tx,ty,tz); p.m.rotateX(Math.PI/2);
  }
}
function updateEffects(dt){
  // v132.29: the level aura rides here because BOTH frame paths provably call updateEffects —
  // tickBody (09-main.js) and NET.guestFrame (10-net.js:2133). Putting it in tickBody alone is
  // trap #12, the v128.8 ribbon a guest could never clear.
  auraTick(dt);
  if(typeof buffFxTick==="function")buffFxTick(dt); // v132.39 the Batch D rings — same reasoning
                                                   // as the aura above: BOTH frame paths land here
  if(typeof fxTick==="function")fxTick(dt);         // v132.41 the set-pieces, same reasoning again
  for(let i=effects.length-1;i>=0;i--){
    const e=effects[i]; e.t-=dt;
    e.s.scale.multiplyScalar(1+dt*4); e.s.material.opacity=Math.max(0,e.t*2.5);
    e.s.position.y+=dt*2;
    if(e.t<=0){scene.remove(e.s);effects.splice(i,1);}
  }
}

// ---------- line of sight ----------
function hasLOS(x1,z1,x2,z2,ignore){
  for(const b of buildings){
    if(!b.alive||b===ignore||b.def.flat)continue;
    const dx=x2-x1,dz=z2-z1,L2=dx*dx+dz*dz;
    if(L2<0.001)continue;
    let t=((b.x-x1)*dx+(b.z-z1)*dz)/L2;
    t=Math.max(0,Math.min(1,t));
    // v131.6 rBlock. SIGHT MUST AGREE WITH THE SHOT: this is what picks the target, and the arrow
    // is stopped by rBlock*0.8 twenty lines up. On r*0.85 an archer would happily choose a target
    // through 8.47 units of castle (measured, median bearing) and then watch every arrow burst on
    // the curtain wall. Same circle, same answer.
    const px=x1+dx*t,pz=z1+dz*t,rr=b.def.rBlock*0.85;
    if(dist2(px,pz,b.x,b.z)<rr*rr)return false;
  }
  return true;
}

// ---------- combat ----------
// ==================== v132.26 THE BAZAARS CHANGE HANDS ====================
// Host-authoritative: a guest reads owner/cap off the wire and draws them, and never runs this.
// See 00-data.js for the rules and the reasoning; this is only their arithmetic.
// GARRISONED BODIES DO NOT COUNT. A unit up a watch tower or on a rampart is not in the collision
// world at all (v132.22), and a tower standing beside a plaza would otherwise capture the square
// under it for ever with nobody on the ground.
// NEITHER DO CREEPS: NEUTRAL is a team index like any other and wolves standing in a market would
// otherwise freeze it as "contested" for as long as the camp lives.
const _bazAcc=[0,0];
function bazaarTick(dt){
  if(typeof neutralMarkets==="undefined"||!neutralMarkets.length)return;
  for(const m of neutralMarkets){
    const R=(m.plaza||9)+BAZ_CAP_R, R2=R*R;
    let n0=0,n1=0; const h0=[],h1=[]; // v132.28: h0/h1 are the HUMANS in the plaza this tick —
    // the loop counted heads and threw the names away, so a capture knew its team but not its
    // captors. Only populated for the Grand Bazaar, which is the only one a quest asks about.
    for(const u of units){
      if(!u.alive||u.team===NEUTRAL||u.garrison)continue;
      if(dist2(u.root.position.x,u.root.position.z,m.x,m.z)>R2)continue;
      if(u.team===BLUE){n0++; if(m.grand&&isHuman(u))h0.push(u);}
      else{n1++; if(m.grand&&isHuman(u))h1.push(u);}
    }
    if(n0&&n1)continue;                                  // contested: frozen
    if(!n0&&!n1)continue;                                // empty: frozen, no decay
    const T0=n0?BLUE:RED;
    if(m.owner===T0){                                    // the owner scrubs out an attacker
      if(m.capTeam!==-1&&m.capTeam!==T0){
        m.cap-=dt/BAZ_CAP_T;
        if(m.cap<=0){m.cap=0;m.capTeam=-1;}
      }
      continue;
    }
    if(m.capTeam!==T0){m.capTeam=T0;m.cap=0;}
    m.cap+=dt/BAZ_CAP_T;
    if(m.cap>=1){
      const was=m.owner;
      m.owner=T0; m.cap=0; m.capTeam=-1;
      // v132.28 LORD OF THE CROSSROADS: everyone of the taking team standing in the Grand
      // Bazaar's plaza on the frame it flips. Standing there IS the capture, so presence at
      // the flip is the whole of the deed.
      if(m.grand&&typeof questProgress==="function")
        for(const _u of (T0===BLUE?h0:h1))questProgress(_u,"cap_grand");
      bazaarTaken(m,T0,was);
    }
  }
  // the income. Fractional yield is banked and paid in whole units, because stock is read with
  // Math.floor everywhere and a 0.4 that never becomes a 1 is a resource nobody can spend.
  for(const t of [BLUE,RED]){
    const y=bazaarYield(t);
    if(!y){_bazAcc[t]=0;continue;}
    _bazAcc[t]+=y*dt;
    // THE EPSILON IS FLOAT ERROR, NOT GENEROSITY. Ten seconds at +1/s is three hundred additions
    // of 1/30, which lands on 9.999999999999998 — so tools/bazaars.js, reading the STOCKPILE
    // rather than the yield function, measured 9 where 10 was owed. The remainder carries forward,
    // so nothing was being lost over a match; it was arriving one late, for ever. 1e-9 cancels the
    // accumulated error and is far below anything a player can observe.
    const whole=Math.floor(_bazAcc[t]+1e-9);
    if(whole>0){
      _bazAcc[t]-=whole;
      // v132.27 FOOD, GOLD AND TIMBER — NOT STONE. See BAZ_YIELD_RES in 00-data.js: stone is the
      // one resource whose scarcity is a stated design rule and a smoketest assertion, and a tap
      // that pays it for standing still cancels both.
      for(const r of BAZ_YIELD_RES)stock[t][r]+=whole;
      if(t===MYTEAM&&typeof updateResHud==="function")updateResHud();
    }
  }
}
// announced on both machines: the host calls this from bazaarTick, a guest from applySnap when the
// owner byte it receives disagrees with the one it is drawing.
function bazaarTaken(m,team,was){
  const who=(m.what==="grand")?"the Grand Bazaar":(m.what==="blue"?"the western bazaar":"the eastern bazaar");
  const mine=(team===MYTEAM);
  if(typeof msg==="function")
    msg((mine?"You take ":"The enemy takes ")+who+"! "+
        (mine?("+"+bazaarYield(team)+" food, gold and timber a second."):""),mine?"blue":"warn");
  if(typeof Sound!=="undefined")try{Sound.play(mine?"ui_confirm":"ui_open",{x:m.x,z:m.z});}catch(_){}
  if(typeof puff==="function")try{puff(m.x,4.5,m.z,TEAMCOL[team],2.4,1.1);}catch(_){}
}
// the marks are pure render state — a guest and the host may disagree about them for ever without
// desyncing — so they are driven once a frame from whatever the sim says, not from the flip.
function bazaarDraw(){
  if(typeof neutralMarkets==="undefined")return;
  for(const m of neutralMarkets){
    const k=m.mark; if(!k)continue;
    if(k.shownOwner!==m.owner){
      k.shownOwner=m.owner;
      const c=TEAMCOL[m.owner<0?2:m.owner];
      k.ring.material.color.setHex(c); k.cloth.material.color.setHex(c);
      k.ring.material.opacity=(m.owner<0)?0.30:0.42;
    }
    const showing=(m.capTeam>=0&&m.cap>0.01);
    if(k.arc.visible!==showing)k.arc.visible=showing;
    if(showing){
      if(k.shownCapTeam!==m.capTeam){k.shownCapTeam=m.capTeam;k.arc.material.color.setHex(TEAMCOL[m.capTeam]);}
      if(Math.abs(k.shownCap-m.cap)>0.02){
        k.shownCap=m.cap;
        k.arc.geometry.dispose();
        k.arc.geometry=new THREE.RingGeometry(k.R*0.94,k.R*1.06,48,1,Math.PI/2,-m.cap*Math.PI*2);
      }
    }
  }
}
function dealDamage(att,victim,dmg){
  let _wasCrit=false;   // v132.46: set by KEEN EYE below, read at the subtraction
  if(typeof NET!=="undefined"&&NET.mode==="guest")return; // host owns all damage
  if(!victim.alive||gameOver)return;
  if(victim.blocking){
    const meleeAtt=att&&att.cls&&!CLS[att.cls].ranged&&!att.def;
    if(meleeAtt&&T-(victim.blockStart||-9)<0.28+0.07*buffSt(victim,"parry")){ // DUELIST widens the window
      // PARRY: perfect-timing block negates and staggers
      puff(victim.root.position.x,1.9,victim.root.position.z,0xffe27a);
      if(att.atkT!==undefined)att.atkT=Math.max(att.atkT,1.2);
      if(victim.isPlayer)msg("PARRY! "+(att.name||"The enemy")+" staggers.","blue");
      if(typeof questProgress==="function")questProgress(victim,"parry");
      if(typeof Sound!=="undefined"){Sound.play("parry",{x:victim.root.position.x,z:victim.root.position.z}); // v102: the ringing shing
        Sound.play("veffort",{x:victim.root.position.x,z:victim.root.position.z});} // v109: the strain behind the steel
      return;
    }
    dmg*=0.3; // raised shield
    if(typeof Sound!=="undefined"){Sound.play("block",{x:victim.root.position.x,z:victim.root.position.z}); // v102: shield-up block
      Sound.play("veffort",{x:victim.root.position.x,z:victim.root.position.z});} // v109: the strain behind the shield
  }
  // ---- v87 BLACKSMITH BUFFS: attacker-side (humans only) ----
  const attU=att&&!att.def&&att.cls?att:null; // a unit, not a tower
  if(attU&&isHuman(attU)&&attU.team!==victim.team){
    if(attU._tmods)dmg+=tmodSum(attU,"dmgflat");                   // KILLING FRENZY — flat, and
                                                                   // added before the multipliers
                                                                   // so a crit doubles it too
    let m=1+0.05*buffSt(attU,"dmg");                               // HONED EDGE
    if(victim.team===NEUTRAL)m*=1+0.15*buffSt(attU,"slayer");      // WILD SLAYER
    if(isSiege(attU.cls))m*=1+0.10*buffSt(attU,"siege");           // SIEGEWRIGHT
    if(victim.hp>=victim.maxHp)m*=1+0.50*buffSt(attU,"ambush");    // FIRST BLOOD — read BEFORE the hp subtraction below
    if(CLS[attU.cls]&&CLS[attU.cls].ranged&&victim.cls&&isSiege(victim.cls))
      m*=1+0.50*buffSt(attU,"enginebane");                         // ENGINEBANE
    if(attU.cls==="villager")m*=1+1.00*buffSt(attU,"yeoman");       // YEOMAN — the damage half
    if(buffSt(attU,"fervor")){                                     // DESPERATION is attack SPEED,
      // …handled in updateUnitCommon; nothing to do to damage here.
    }
    if(buffSt(attU,"woods")&&inTheWoods(attU))m*=1+0.10*buffSt(attU,"woods"); // WOODSMAN
    if(buffSt(attU,"kguard")&&nearOwnKing(attU))m*=1+0.10*buffSt(attU,"kguard"); // KING'S GUARD — damage half
    if(buffSt(attU,"phalanx"))                                     // PHALANX — reads the CACHED
      m*=1+Math.min(0.20,0.05*buffSt(attU,"phalanx")*(attU._auraA||0)); // count, never a fresh scan
    const cs=buffSt(attU,"crit");                                  // KEEN EYE
    if(cs&&Math.random()<0.05*cs){
      m*=2; _wasCrit=true;   // v132.46: a plain local — the roll and the subtraction share a scope
      puff(victim.root.position.x,2.4,victim.root.position.z,0xffd24a,1.1);
      _vfx(VFX_CRIT,victim.root.position.x,victim.root.position.z,0,0);         // v132.41: sharp and quick — at 3 stacks this
      _sfxAt("critstrike",victim);                // rides ~15% of blows        // v132.38: it prints CRITICAL HIT in gold and sounded
      if(attU.isPlayer)msg("CRITICAL HIT!","gold");   // like every other blow
    }
    dmg*=m;
  }
  // CAPTAIN'S BANNER: any friendly attacker fighting near a banner-bearer hits harder
  if(attU&&attU.team!==victim.team&&attU.team!==NEUTRAL&&typeof _captains!=="undefined"&&_captains.length){
    let cap=0;
    for(const h of _captains){
      if(h.team!==attU.team||h===attU||!h.alive)continue;
      if(dist2(attU.root.position.x,attU.root.position.z,h.root.position.x,h.root.position.z)<12*12)
        cap=Math.max(cap,buffSt(h,"captain"));
    }
    if(cap)dmg*=1+0.01*cap;
  }
  // ---- victim-side (humans only): dodge, then the tempered shield ----
  if(isHuman(victim)){
    const ds=buffSt(victim,"dodge");                               // SIXTH SENSE
    if(ds&&Math.random()<0.05*ds){
      puff(victim.root.position.x,1.6,victim.root.position.z,0x9fd8ff);
      // ⚠ BEFORE the return below — dealDamage bails on a dodge, so anything after never runs
      _vfx(VFX_DODGE,victim.root.position.x,victim.root.position.z,Math.round((victim.facing||0)*100),0);
      _sfxAt("dodgeswish",victim);        // v132.38: ⚠ BEFORE the return — dealDamage bails out on
      if(victim.isPlayer)msg("Dodged!","blue");       // a dodge, so anything after it never runs
      victim._lastHurt=T;
      return;
    }
    // ---- v132.36 THE CHARGES. A last-used STAMP is the whole mechanism: ready when enough time
    // has passed. Stacking shortens the cooldown (30/stacks) rather than granting parallel
    // charges, which is the same curve without a second system. Placed AFTER the dodge so two
    // evasions cannot both fire on one blow, and BEFORE the multipliers because a blocked blow
    // is cancelled, not reduced.
    {
      const rangedBlow=!!(att&&(att.def||(att.cls&&CLS[att.cls]&&CLS[att.cls].ranged)));
      const wd=buffSt(victim,"ward"), gd=buffSt(victim,"guardup");
      if(rangedBlow&&wd&&T-(victim._wardT||-999)>=30/wd){
        victim._wardT=T; victim._lastHurt=T;
        puff(victim.root.position.x,2.2,victim.root.position.z,0x9fd8ff,1.0);
        _vfx(VFX_WARD,victim.root.position.x,victim.root.position.z,Math.round(_fxAng(att,victim)*100),0);
        _sfxAt("wardblock",victim);   // v132.37: _sfxAt relays it — the archer whose shot was
                                      // stopped should hear it, and on their screen it happened
                                      // to somebody else. (Was hand-broadcast here; that would
                                      // double-send now.)
        if(victim.isPlayer&&typeof msg==="function")msg("Arrow warded!","blue");
        return;
      }
      if(!rangedBlow&&gd&&att&&att.cls&&T-(victim._guardT||-999)>=30/gd){
        victim._guardT=T; victim._lastHurt=T;
        puff(victim.root.position.x,2.2,victim.root.position.z,0xd8dde2,1.0);
        _vfx(VFX_GUARD,victim.root.position.x,victim.root.position.z,Math.round(_fxAng(att,victim)*100),0);
        _sfxAt("guardblock",victim);  // v132.37: relayed by _sfxAt, as above
        if(victim.isPlayer&&typeof msg==="function")msg("Blow turned aside!","blue");
        return;
      }
    }
    dmg*=1-0.05*buffSt(victim,"shield");                           // RAISED SHIELD (the buff)
    if(att&&att.team===NEUTRAL)dmg*=1-0.10*buffSt(victim,"warden"); // BEAST WARDEN
    if(victim.cls==="villager")dmg*=Math.pow(0.5,buffSt(victim,"yeoman")); // YEOMAN — the health half,
      // as a reduction rather than a maxHp change: applyBuffStats preserves the hp FRACTION across a
      // recompute, so doubling maxHp mid-fight would silently heal the villager.
    if(buffSt(victim,"kguard")&&nearOwnKing(victim))dmg*=1-0.10*buffSt(victim,"kguard"); // KING'S GUARD
    if(buffSt(victim,"resolve"))                                   // UNBOWED — the more of them
      dmg*=1-Math.min(0.25,0.05*buffSt(victim,"resolve")*(victim._auraE||0)); // there are, the harder
    if(buffSt(victim,"tribute")&&typeof stock!=="undefined"&&stock[victim.team]){         // BLOOD TAX
      stock[victim.team].gold+=1*buffSt(victim,"tribute");
      if(typeof updateResHud==="function")updateResHud();
    }
  }
  victim._lastHurt=T; // Second Skin waits for quiet
  victim.hp-=dmg; hitFlash(victim);
  // ---- v132.46 THE DAMAGE NUMBER. Read HERE and nowhere earlier: every multiplier, the dodge,
  // both charge blocks and the shield have already had their say by this line, so this is the
  // only place the figure is the one the game actually used. ----
  if(attU&&dmg>0){
    if(attU===player&&typeof dmgNum==="function")dmgNum(victim,dmg,_wasCrit);
    else if(attU.remote&&typeof NET!=="undefined"&&NET.mode==="host"&&NET.remotes[attU.remote]){
      // ⚠ TO THE ONE WHO SWUNG, not to everyone. Broadcasting would put every unit's damage on
      // every screen, which is the blizzard this is meant to replace. Same targeted shape as
      // syncBuffs and the garrison cue.
      const _r=NET.remotes[attU.remote];
      if(_r.conn){try{_r.conn.send({t:"dnum",i:victim.id,d:Math.round(dmg*100),c:_wasCrit?1:0});}catch(_){}}
    }
  }
  // CULLER: finish a wounded beast outright. Sets hp to 0 rather than calling killUnit, so the
  // ordinary kill path below runs once and unchanged — loot, quests, participation and score all
  // stay on their single road.
  if(victim.team===NEUTRAL&&victim.hp>0&&attU&&buffSt(attU,"cull")&&
     victim.hp<victim.maxHp*0.15){
    victim.hp=0;
    puff(victim.root.position.x,1.8,victim.root.position.z,0xd8e070,1.2);
    _vfx(VFX_CULL,victim.root.position.x,victim.root.position.z,0,0);
    _sfxAt("cullkill",victim);            // v132.38: rides ON TOP of the ordinary death sound —
                                          // the kill path below still runs, so this says "that
                                          // was you", it does not replace the creature dying
  }
  // SURVIVAL INSTINCT: an EDGE, not a level. The latch stops it re-arming on every blow landed
  // while already under a quarter health, which would be a permanent speed buff in disguise.
  if(isHuman(victim)&&victim.alive&&buffSt(victim,"flight")&&victim.maxHp>0&&
     victim.hp>0&&victim.hp<victim.maxHp*TMOD_LOW&&!victim._lowLatch){
    victim._lowLatch=true;
    tmodAdd(victim,"spdmul",0.40*buffSt(victim,"flight"),5,false);
    _sfxAt("lastlegs",victim);            // v132.38: the latch above makes this once a fight, which
                                          // is why it can afford to be the longest of the cues
  }
  // HUNTER'S STEP: a landed MELEE blow quickens the step.
  if(attU&&isHuman(attU)&&buffSt(attU,"hunt")&&CLS[attU.cls]&&!CLS[attU.cls].ranged&&
     attU.team!==victim.team){
    tmodAdd(attU,"spdmul",0.10*buffSt(attU,"hunt"),2,false);
  }
  // ---- v132.36 BATCH E: EARTHSHAKER and RAPID VOLLEY ----
  if(attU&&isHuman(attU)&&attU.team!==victim.team&&!_volleyIn){
    const meleeE=CLS[attU.cls]&&!CLS[attU.cls].ranged;
    const qk=buffSt(attU,"quake");
    if(qk&&meleeE&&Math.random()<0.05*qk){                 // EARTHSHAKER — borrows AURA_BR rather
      const R=(typeof AURA_BR!=="undefined"?AURA_BR:10);   // than inventing a third idea of "near"
      const R2=R*R, px=attU.root.position.x, pz=attU.root.position.z;
      puff(px,0.6,pz,0xc9a06a,2.2);
      _vfx(VFX_QUAKE,px,pz,Math.round(R*10),0);   // v132.41: the shockwave carries the RADIUS —
      _sfxAt("quakeslam",attU);                   // nobody could tell what it reached before
      for(const o of units){
        if(!o.alive||o===attU||o===victim||o.team===attU.team)continue;
        const dx=o.root.position.x-px, dz=o.root.position.z-pz;
        if(dx*dx+dz*dz>R2)continue;
        _volleyIn=true; dealDamage(attU,o,(attU.dmg||5)*0.5*qk); _volleyIn=false;
      }
    }
    const vo=buffSt(attU,"volley");
    if(vo&&!meleeE&&T-(attU._volleyT||-999)>=10&&Math.random()<0.05*vo){
      attU._volleyT=T;                                     // RAPID VOLLEY — THREE BLOWS, not triple
      _volleyIn=true;                                      // damage, so per-hit buffs stay honest
      for(let k=0;k<2&&victim.alive;k++)dealDamage(attU,victim,dmg);
      _volleyIn=false;
      _vfx(VFX_VOLLEY,attU.root.position.x,attU.root.position.z,                  // v132.41: three streaks, staggered onto
        Math.round(victim.root.position.x*10),Math.round(victim.root.position.z*10)); // the three twangs already in the sound
      _sfxAt("volleyshot",attU);
      if(attU.isPlayer&&typeof msg==="function")msg("Rapid volley!","gold");
    }
  }
  // ---- v132.34 BATCH C: what the blow leaves BEHIND on the victim ----
  if(attU&&isHuman(attU)&&attU.team!==victim.team&&victim.alive){
    const melee=CLS[attU.cls]&&!CLS[attU.cls].ranged;
    const bl=buffSt(attU,"bleed");
    if(bl&&Math.random()<0.05*bl){                      // SERRATED EDGE — 1 HP/s for 20s = 20 HP
      tmodAdd(victim,"bleed",1,20,false); victim._dotBy=attU;
      puff(victim.root.position.x,2.0,victim.root.position.z,0xb3262a,0.7);
      _vfx(VFX_BLEED,victim.root.position.x,victim.root.position.z,6,0);  // drips while it bleeds — you can see who is dying
      _sfxAt("bleedhit",victim);
    }
    const vn=buffSt(attU,"venom");
    if(vn&&Math.random()<0.05*vn){                      // VENOMOUS — 10 HP over 10s, and half speed
      tmodAdd(victim,"poison",1,10,false); victim._dotBy=attU;
      tmodAdd(victim,"spdmul",-0.5,10,false);           // a NEGATIVE spdmul is the whole slow
      puff(victim.root.position.x,2.0,victim.root.position.z,0x8fd45a,0.8);
      _vfx(VFX_VENOM,victim.root.position.x,victim.root.position.z,5,0);
      _sfxAt("venomhit",victim);
    }
    const cc=buffSt(attU,"concuss");
    if(cc&&melee&&T-(attU._stunCd||-999)>=30&&Math.random()<0.05*cc){
      attU._stunCd=T;                                   // the 30s belongs to the WIELDER, or one
      tmodAdd(victim,"stun",1,1.5,false);               // player stun-locks a crowd by rotating
      puff(victim.root.position.x,2.8,victim.root.position.z,0xffe9a8,1.1);
      _vfx(VFX_STUN,victim.root.position.x,victim.root.position.z,15,0);  // 1.5s — the same clock tmodAdd just set above
      _sfxAt("stunhit",victim);   // v132.37: its own cue. It borrowed the generic "hit" before,
                                  // which made the game's biggest melee moment sound like a jab.
    }
    if(buffSt(attU,"gash")){                                      // DEEP GASH
      // …but the cue only when it lands FRESH. It rides every blow you throw, so a sound per hit
      // would simply thicken the impact that already plays.
      if(!(victim._tmods&&tmodSum(victim,"healblock")>0))_sfxAt("gashcut",victim);
      tmodAdd(victim,"healblock",1,3,false);
    }
  }
  // SHRUG IT OFF: struck, and everything the enemy put on you falls away.
  if(isHuman(victim)&&victim._tmods&&buffSt(victim,"shrug")&&
     Math.random()<0.10*buffSt(victim,"shrug")){
    if(shedDebuffs(victim)){
      _vfx(VFX_SHRUG,victim.root.position.x,victim.root.position.z,0,0);
      _sfxAt("shrugoff",victim);
      if(victim.isPlayer&&typeof msg==="function")msg("You shrug it off!","blue");
    }
  }
  // BRAMBLE MAIL: a melee attacker takes it back. att.hp is touched DIRECTLY — recursing into
  // dealDamage would re-run every modifier including the attacker's own thorns, and two units
  // both wearing it would volley a blow back and forth.
  if(isHuman(victim)&&buffSt(victim,"thorns")&&att&&!att.def&&att.cls&&
     CLS[att.cls]&&!CLS[att.cls].ranged&&att.alive&&att.team!==victim.team){
    att.hp-=1*buffSt(victim,"thorns");
    if(att.hp<=0&&typeof killUnit==="function"){att.hp=0;killUnit(att,victim);}
  }
  // v132.10 THE PACK NOTICES. Camps aggro'd on an intruder's distance from the camp CENTRE and on
  // nothing else, so anything with range could stand off and shoot them to death unopposed. Waking
  // on damage is the rule that was missing, and it wakes the whole camp because st.wake is on the
  // camp state. NOT for a tower (att.def): creeps have no attack against buildings, so that would
  // set them charging something they can never hurt, for ever.
  if(victim.bot&&victim.bot.camp&&att&&!att.def&&att.team!==undefined&&att.team!==NEUTRAL){
    victim.bot.camp.wake=T+CAMP_WAKE;
    victim.bot.camp.threat=att;
    // v132.28 PARTICIPATION. Any damage to any member puts a human on the camp's list; the
    // pack is cleared by whoever fought it, not by whoever landed the last blow. Bots are not
    // recorded — they never quest and hold no XP (the isHuman gate is the same one questProgress
    // uses). The list lives on the CAMP STATE, so it survives the death of any individual creep
    // and is cleared when the next wave lands.
    if(typeof isHuman==="function"&&isHuman(att)){
      const _st=victim.bot.camp;
      if(!_st.part)_st.part=[];
      if(_st.part.indexOf(att)<0)_st.part.push(att);
    }
  }
  // v100 SOUND — impact, keyed to the attacker: siege thud · arrow strike · melee clash.
  // (host/solo only — dealDamage returns early on guests; their impacts ride swings & deaths)
  if(typeof Sound!=="undefined"){
    // v102: impact by attacker — cannon blast · siege boulder · arrow · spear thud · melee clash
    let _hk="hit";
    if(att&&att.def)_hk="arrowhit";
    else if(att&&att.cls&&isSiege(att.cls))_hk=(CLS[att.cls]&&CLS[att.cls].rig==="cannon")?"cannonhit":"siegehit";
    else if(att&&att.cls&&CLS[att.cls]&&CLS[att.cls].ranged)_hk="arrowhit";
    else if(att&&att.bot&&att.bot.camp&&att.bot.camp.kind==="wolf")_hk="wolfbite"; // v110: a wolf's blow IS the bite
    else if(att&&att.cls&&CLS[att.cls]&&CLS[att.cls].line==="anticav")_hk="spearhit";
    Sound.play(_hk,{x:victim.root.position.x,z:victim.root.position.z});
    // v109 THE VOICES: the struck cry out — ~1 in 3 non-lethal hits, graded by the blow
    // (host-side like impacts; a guest hears their OWN hits via the hp-drop hook in applySnap)
    if(victim.hp>0&&victim.alive&&!victim.def&&Math.random()<0.34&&
       !(victim.bot&&victim.bot.camp&&victim.bot.camp.kind==="wolf")) // v110: wolves don't cry like men
      Sound.vox(dmg<12?"painm":dmg<25?"pain":"painh",victim,{x:victim.root.position.x,z:victim.root.position.z});
  }
  if(attU&&isHuman(attU)&&attU.alive&&attU.team!==victim.team){    // BLOODTHIRST drinks
    const ls=buffSt(attU,"leech");
    if(ls&&attU.hp<attU.maxHp){
      attU.hp=Math.min(attU.maxHp,attU.hp+1*ls);
      setBar(attU.bar,attU.hp/attU.maxHp);
      if(attU.isPlayer)updatePlayerHud();
    }
  }
  setBar(victim.bar,victim.hp/victim.maxHp);
  // fleeing bots get poked awake
  if(victim.bot)victim.bot.lastHitT=T;
  // a worker under attack raises a DISTRESS call — the war room hears about it
  if(victim.bot&&(victim.cls==="villager"||victim.bot.role==="cart")&&
     att&&att.team!==undefined&&att.team!==victim.team&&
     !(att.bot&&att.bot.role==="creep")&& // camp creeps never bait rescue bands into the wilds — the AI leaves camps alone
     typeof directors!=="undefined"&&directors[victim.team]){
    directors[victim.team].distress={x:victim.root.position.x,z:victim.root.position.z,until:T+12};
  }
  if(victim.isKing&&victim.hp<victim.maxHp*0.5&&!victim.warned){
    victim.warned=true;
    msg(victim.team===BLUE?"⚠ YOUR KING IS BADLY WOUNDED — DEFEND HIM!":"Their king is wounded — press the attack!",
        victim.team===BLUE?"warn":"gold");
    if(typeof Sound!=="undefined"&&victim.team===MYTEAM)Sound.play("alert_attack"); // v100: under-attack horn
  }
  if(victim.hp<=0){
    // ---- v132.30 BATCH A: what a kill pays the killer ----
    if(attU&&isHuman(attU)&&attU.alive&&attU.team!==victim.team){
      const fe=buffSt(attU,"feast");                                  // SECOND WIND
      if(fe){attU.hp=Math.min(attU.maxHp,attU.hp+attU.maxHp*0.10*fe);
        _vfx(VFX_FEAST,attU.root.position.x,attU.root.position.z,0,0);} // relief, not a spell
      const fr=buffSt(attU,"frenzy");                                 // KILLING FRENZY
      if(fr)tmodAdd(attU,"dmgflat",2*fr,7,false,10*fr);                // +2 a kill, capped at +10
      const su=buffSt(attU,"surge");                                   // BLOODRUSH
      if(su)tmodAdd(attU,"spdmul",0.50*su,2,true);                     // …and it FADES over the 2s
      const tr=buffSt(attU,"trophy");                                 // TROPHY HUNTER — permanent,
      if(tr){                                                         // and it must survive a recompute
        attU.hpBonus=Math.min(100,(attU.hpBonus||0)+1*tr);
        if(typeof applyBuffStats==="function")applyBuffStats(attU);
      }
      if(typeof stock!=="undefined"&&stock[attU.team]){
        const pu=buffSt(attU,"purse"), fo=buffSt(attU,"forage");      // CUTPURSE · SCAVENGER
        if(pu)stock[attU.team].gold+=10*pu;
        if(fo)stock[attU.team].food+=10*fo;
        if((pu||fo)&&typeof updateResHud==="function")updateResHud();
      }
    }
    awardPts(att,victim.cls==="villager"?10:costPts(CLS[victim.cls]&&CLS[victim.cls].cost)); // a kill is worth its cost; a villager, 10
    if(victim.isKing)awardPts(att,500);                           // the regicide bonus
    killUnit(victim,att);
  }
  if(victim.isPlayer)updatePlayerHud();
  if(victim.isKing)updateKingBars();
}
function killUnit(u,killer){
  // ---- v99 PLUNDER: a slain cart spills its cargo into the killer's TEAM stockpile ----
  // (before the corpse's pockets are emptied below — order matters)
  if(killer&&killer.team!==undefined&&killer.team!==u.team&&killer.team!==NEUTRAL&&u.team!==NEUTRAL){
    let loot=null;
    if(u.cls==="oxcart"&&u.carry&&u.carry.wood>0){
      stock[killer.team].wood+=u.carry.wood; loot=u.carry.wood+" wood";
      if(typeof questProgress==="function"&&isHuman(killer))questProgress(killer,"plunder_ox"); // v132.28 HIGHWAYMAN
    }else if(u.cls==="trader"&&u.tradeLoaded){ // the haul's earned value so far
      const g=Math.round(tradeGold(Math.hypot(u.root.position.x-u.tradeLoaded.x,u.root.position.z-u.tradeLoaded.z)));
      if(g>0){stock[killer.team].gold+=g; loot=g+" gold";
        if(typeof questProgress==="function"&&isHuman(killer))questProgress(killer,"plunder_tr");} // v132.28 ROAD AGENT
    }else if(u.bot&&u.bot.role==="cart"&&u.tradePhase==="back"&&u.tradeTarget&&u.bot.home){
      const g=Math.round(tradeGold(Math.hypot(u.bot.home.x-u.tradeTarget.x,u.bot.home.z-u.tradeTarget.z)));
      if(g>0){stock[killer.team].gold+=g; loot=g+" gold";
        if(typeof questProgress==="function"&&isHuman(killer))questProgress(killer,"plunder_tr");} // v132.28 ROAD AGENT
    }
    if(loot){
      updateResHud();
      if(typeof Sound!=="undefined")Sound.play("bighaul"); // v104: plunder is a big haul (was "plunder")
      const kn0=killer.isPlayer?"You":(killer.def?"A "+killer.def.name:killer.name);
      msg("💰 "+kn0+" plundered "+loot+" from the fallen cart!",killer.team===BLUE?"blue":"warn");
      if(typeof NET!=="undefined"&&NET.mode==="host")
        NET.bcast({t:"note",m:"💰 "+kn0.replace(/^You$/,"The host")+" plundered "+loot+" from a fallen cart!",tone:killer.team===BLUE?"blue":"warn"});
    }
  }
  u.alive=false; u.gathering=null; u.blocking=false; u.task=null;
  if(typeof Sound!=="undefined"&&!u.isKing){ // v102: death mix — armored units clatter; others fall, ~1/3 squish
    const _c=CLS[u.cls]||{},_arm=(_c.line==="cavalry")||((_c.line==="melee"||_c.line==="anticav")&&(_c.tier||0)>=3);
    const _p={x:u.root.position.x,z:u.root.position.z};
    Sound.play(_arm?(Math.random()<0.3?"gore":"deathheavy"):(Math.random()<0.33?"gore":"death"),_p);
    // v109 THE VOICES: ~70% of the fallen cry out as they go (YOU always do); 1 in 5 gets the long scream
    // (v110: wolf-camp creeps die without a human voice — their body-drop foley stands alone)
    if((u===player||Math.random()<0.7)&&!(u.bot&&u.bot.camp&&u.bot.camp.kind==="wolf"))
      Sound.vox(Math.random()<0.2?"deathi":"death",u,_p);
  }
  u.dieT=0.9; // fall over before vanishing
  u.bar.bg.visible=false; u.bar.fg.visible=false;
  u.carry.food=0;u.carry.gold=0;u.carry.stone=0;u.carry.wood=0;
  // ---- v87 QUEST CREDIT: the killing blow, sorted by what fell ----
  if(killer&&!killer.def&&isHuman(killer)&&killer.team!==u.team&&typeof questProgress==="function"){
    if(_pistolCtx)questProgress(killer,"pistol"); // the dragoon's sidearm spoke
    if(u.team===NEUTRAL)questProgress(killer,"kill_creep");
    else if(u.cls==="villager")questProgress(killer,"kill_vil");
    else if(!u.isKing&&MIL_LINES.includes(CLS[u.cls].line))questProgress(killer,"kill_mil");
    // v132.28 HORSEBANE: the spear line cutting down a horseman. "anticav" is the same line key
    // rps() reads for the 3.8x counter (00-data.js:351), so the quest and the bonus agree.
    if(CLS[killer.cls]&&CLS[killer.cls].line==="anticav"&&CLS[u.cls]&&CLS[u.cls].mounted)
      questProgress(killer,"counter_cav");
  }
  // v109 THE VOICES: kill-streak bloodlust — a human's 3rd quick kill (8s window) draws a growl, self-heard
  if(killer&&!killer.def&&isHuman(killer)&&killer.team!==u.team&&typeof Sound!=="undefined"){
    killer._vstreak=(killer._vstreak||[]).filter(t2=>T-t2<8); killer._vstreak.push(T);
    if(killer._vstreak.length===3){
      if(killer===player)Sound.play("vgrowl");
      else if(typeof NET!=="undefined"&&NET.mode==="host")
        for(const _k2 in NET.remotes){const _rr=NET.remotes[_k2];
          if(_rr.unit===killer&&_rr.conn){try{_rr.conn.send({t:"snd",k:"vgrowl"});}catch(_){}break;}}
    }
  }
  const kn=killer? (killer.isPlayer?"You":(killer.def?killer.def.name:killer.name)) : "The wilds";
  if(u.isKing){ endGame(u.team===BLUE?RED:BLUE, kn); return; }
  if(u.bot&&u.bot.role==="cart"){ // NPC carts are plundered for good; the Market builds anew
    u.respawnT=Infinity;
    msg(u.team===BLUE?"⚠ Your trade cart was plundered by "+kn+"!":"Red trade cart plundered — their gold bleeds.",
        u.team===BLUE?"warn":"gold");
    return;
  }
  if(u.isPlayer||u.remote)u.tradeLoaded=null;
  if(isHuman(u)&&typeof releaseWarband==="function"&&releaseWarband(u)) // v95: the band answers no dead horn
    msg(u.isPlayer?"Your warband returns to guard the King.":u.name+"'s warband returns to the King.","warn");
  // v132.28: the guard now tests EVERYTHING the wipe below clears. It used to test only
  // lvl/xp/quest/buffs, so a fresh player holding nothing but a drawn draft — or banked rerolls,
  // or a standing forge offer — died without losing them. The two lists must stay identical.
  if(isHuman(u)&&((u.lvl||0)>0||(u.xp||0)>0||u.quest||(u.buffs&&Object.keys(u.buffs).length)||
     u.questDraft||(u.qRerolls||0)>0||u.smithOffer||u._scoutOut)){
    // ---- v132.48 DEATH TAKES HALF, AND HANDS IT BACK AS COIN ----
    // Was: lvl=0, xp=0 — a total wipe, which John called too harsh after playing it. Now half the
    // level survives AND becomes spendable XP, so you rise with a bare forge and the means to
    // stock it. ⚠ The XP is SET, not added: a level 20 holding 6 unspent rises with exactly 10.
    const _lv0=u.lvl||0;
    const _lv1=Math.floor(_lv0*DEATH_KEEP);
    u.lvl=_lv1; u.xp=_lv1;
    u.buffs={}; u.quest=null; u.questDraft=null; u.qRerolls=0; u._scoutOut=false; u.smithOffer=null; // v99: death also wipes the standing draft + banked rerolls
    u.hpBonus=0;      // v132.30: TROPHY HUNTER is a buff's earnings — death takes it with the buffs
    u._tmods=null; u._lowLatch=false; // v132.32: and the timed modifiers die with the body
    if(typeof tmodSyncClear==="function")tmodSyncClear(u); // …on the owner's screen as well as here
    u._rrCycle=false; // v132.28.2: re-arm the reroll grant, or a player who died QUESTLESS would
                      // carry the spent cycle into the new life and never be granted one
    if(typeof questNotify==="function"){
      questNotify(u,_lv1>0
        ? "💀 Death takes half — you rise at level "+_lv1+" with "+_lv1+
          " XP to spend, and the forge is bare."
        : "💀 Death takes its due — your level, XP and blacksmith buffs are lost.","warn");
      syncQuest(u); syncBuffs(u);
      if(u.isPlayer&&typeof updateQuestHud==="function")updateQuestHud();
    }
  }
  u.corpse=true; // the body lies in state where it fell until it respawns (or a priest raises it)
  if(u.bot&&u.bot.role==="creep"){ // camp creeps: the camp manager rules their rebirth
    u.respawnT=Infinity;
    if(killer===player)msg("You slew a "+CLS[u.cls].name+"!","gold");
    // v132.28: CAMP BREAKER no longer belongs to the last blow — campTick pays every
    // participant when the pack falls (07-ai.js). One event, one rule, one place.
    return;
  }
  const involves=u.isPlayer||killer===player;
  const nearP=player&&dist2(u.root.position.x,u.root.position.z,player.root.position.x,player.root.position.z)<30*30;
  if(involves||(nearP&&Math.random()<0.55))
    msg(kn+" slew "+(u.isPlayer?"you":u.name)+" ("+CLS[u.cls].name+")",u.team===BLUE?"warn":"gold");
  u.respawnT=respawnDelay(u.team);
  if(u.isPlayer){
    document.getElementById("deathoverlay").style.display="flex";
    closeMenus(); cancelPlacing();
    if(document.exitPointerLock)document.exitPointerLock();
  }
}
function respawnUnit(u){
  const tc=teamTC(u.team);
  let hx=tc?tc.x:TCPOS[u.team][0], hz=tc?tc.z:TCPOS[u.team][1];
  let _spawnHost=tc||null;                       // which building the ring is drawn around
  { // spawn point: bots take the nearest; the PLAYER chooses with V (Town Center vs forward castle)
    const wantCastle=!u.isPlayer||(typeof spawnPref!=="undefined"&&spawnPref==="castle");
    if(wantCastle){
      let bd=u.isPlayer?Infinity:dist2(u.root.position.x,u.root.position.z,hx,hz);
      for(const b of buildings){
        if(b.team!==u.team||!b.alive||!b.built||b.type!=="castle")continue;
        const d=dist2(u.root.position.x,u.root.position.z,b.x,b.z);
        if(d<bd){bd=d;hx=b.x;hz=b.z;_spawnHost=b;}
      }
    }
  }
  // v131.28 OUTSIDE THE BLOCKER, NOT OUTSIDE A GUESS. This was a flat 14 with the comment "outside
  // the 2x TC/castle footprint", and a castle blocks to 19.8: at age 4 the mural and gate drums
  // span radius 12.45-18.35 and at age 5 the bastions span 7.12-14.08, so ~30% of respawn angles
  // put the reborn villager INSIDE the stone. The circle's outward-only push then teleported him
  // from 14 to 19.8 in one frame — straight out through the curtain. Now that the castle blocks on
  // its real outline that push would be to the nearest FACE instead, and inside a sealed ward that
  // is a trap, so the ring has to clear the collider rather than very nearly clear it.
  const _spB=_spawnHost;
  const _spR=(_spB&&_spB.def)?((_spB.def.rBlock||_spB.def.r)+2.6):14;   // defensive: teamTC may hand back a stub
  const a=Math.random()*Math.PI*2;
  u.root.position.set(hx+Math.cos(a)*_spR,0,hz+Math.sin(a)*_spR);
  u.root.position.y=terrainHeight(u.root.position.x,u.root.position.z);
  u.cls="villager"; buildBodyFor(u); setClassStats(u);
  u.alive=true; u.root.visible=true; u.warned=false;
  u.corpse=false; u.body.rotation.x=0; // stand the reborn villager back up (buildBodyFor clears meshes but not the toppled tilt)
  u.chargeTo=null; u.rally=false; u.rallyBy=null; // the dead answer no horn — a respawned villager forgets the band
  if(u.isPlayer){
    document.getElementById("deathoverlay").style.display="none";
    updatePlayerHud();
    // v132.28: the quest panel was never repainted on respawn, so a wiped level, quest and buff
    // list stayed on screen — reading as if death had cost nothing — until some later quest
    // event happened to redraw it.
    if(typeof updateQuestHud==="function")updateQuestHud();
    msg("You respawn as a Villager. Re-arm at the Barracks.","blue");
  }
}
// ---------- THE PRIEST'S MIRACLE — resurrection ----------
const RES_CHARGE=2.0;   // seconds of channeling (holding LMB) before the rite is ready
const RES_CD=10;        // seconds of cooldown after a resurrection ("faith")
function resCdFor(u){return Math.max(3,RES_CD-1.5*buffSt(u,"zeal"));} // v87 ZEALOTRY
const RES_REACH=3.6;    // how close the priest must stand over a fallen ally
const RES_PTS=25;       // score reward for raising the dead
// restore a fallen ally to life right where they lie, keeping the class they died as
function resurrectUnit(u,by){
  if(!u||u.alive)return false;
  u.alive=true; u.corpse=false; u.dieT=0;
  u.root.visible=true; u.body.rotation.x=0;
  u.root.position.y=terrainHeight(u.root.position.x,u.root.position.z);
  u.hp=u.maxHp; if(u.bar){setBar(u.bar,1); u.bar.bg.visible=false; u.bar.fg.visible=false;} // bars reappear only when wounded again
  u.respawnT=0; u.warned=false; u.gathering=null; u.task=null; u.blocking=false;
  if(by){ by._resAt=(typeof T!=="undefined")?T:0; awardPts(by,RES_PTS);
    if(typeof questProgress==="function")questProgress(by,"res"); } // BATTLEFIELD MEDIC
  if(typeof puff==="function")puff(u.root.position.x,1.6,u.root.position.z,0xfff0b0); // a burst of holy light
  if(typeof Sound!=="undefined")Sound.play("res",{x:u.root.position.x,z:u.root.position.z}); // v103: heavenly choir
  if(typeof NET!=="undefined"&&NET.mode==="host")NET.bcast({t:"snd",k:"res",x:u.root.position.x,z:u.root.position.z}); // guests hear allied miracles
  const bn=by?(by.isPlayer?"You":by.name):"A priest";
  if(by&&by.isPlayer)msg("✝ You raise "+u.name+" ("+CLS[u.cls].name+") from the dead!","blue");
  else msg("✝ "+bn+" raised "+(u.isPlayer?"you":u.name)+" from the dead.","blue");
  if(u.isPlayer){ // a downed player pulled back into the fight mid-field
    const dov=document.getElementById("deathoverlay"); if(dov)dov.style.display="none";
    if(typeof updatePlayerHud==="function")updatePlayerHud();
  }
  if(typeof updateRoster==="function")updateRoster();
  return true;
}
function nearestEnemyBuilding(u,maxReach){
  let bb=null,bd=1e9;
  for(const b of buildings){
    if(b.team===u.team||!b.alive)continue;
    // v131.6 bSurf: reach is measured from the WALL. On plain `r` a swordsman shoved out to
    // rBlock+0.7 by a barracks reads 4.4 units of gap and never swings. See 00-data.js.
    const d=Math.sqrt(dist2(u.root.position.x,u.root.position.z,b.x,b.z))-bSurf(b.def);
    if(d<maxReach&&d<bd){bd=d;bb=b;}
  }
  return bb;
}
function tryMeleeAttack(u){
  if(u.atkT>0)return;
  if(isSiege(u.cls)){ // rams hunt structures before troops
    const bb=nearestEnemyBuilding(u,u.rng+0.6);
    if(bb){
      u.atkT=u.cd; u.swing=0.25; triggerAttackAnim(u);
      u.facing=Math.atan2(bb.x-u.root.position.x,bb.z-u.root.position.z);
      damageBuilding(bb,u.dmg*(CLS[u.cls].bMult||1),u);
      return true;
    }
  }
  // nearest enemy unit in reach, else enemy building
  let best=null,bd=1e9;
  for(const v of units){
    if(v.team===u.team||!v.alive||v.garrison)continue; // safe up in the tower
    const d=_rwT?rwDist(u,v):dist(u,v); // v128.5: as the acting guest saw it
    if(d<u.rng+0.8&&d<bd){bd=d;best=v;}
  }
  if(best){
    u.atkT=u.cd; u.swing=0.25; triggerAttackAnim(u);
    u.facing=Math.atan2(best.root.position.x-u.root.position.x,best.root.position.z-u.root.position.z);
    dealDamage(u,best,u.dmg*rps(u.cls,best.cls));
    return true;
  }
  let bb=null;bd=1e9;
  for(const b of buildings){
    if(b.team===u.team||!b.alive)continue;
    const d=Math.sqrt(dist2(u.root.position.x,u.root.position.z,b.x,b.z))-bSurf(b.def); // v131.6 from the wall — see :470
    if(d<u.rng+0.6&&d<bd){bd=d;bb=b;}
  }
  if(bb){
    u.atkT=u.cd; u.swing=0.25; triggerAttackAnim(u);
    // scout-line TRAMPLE wrecks crops; siege engines wreck everything
    const mult=(CLS[u.cls].line==="scoutline"&&bb.type==="farm")?4:(CLS[u.cls].bMult||1);
    damageBuilding(bb,u.dmg*mult,u);
    return true;
  }
  return false;
}
function tryRangedAttack(u){
  if(u.atkT>0)return;
  if(u.garrison)u.facing=u.facing; // (range boost applied on garrison entry)
  if(isSiege(u.cls)){ // artillery bombards structures first
    let bb=null,bd=1e9;
    for(const b of buildings){
      if(b.team===u.team||!b.alive)continue;
      const d=Math.sqrt(dist2(u.root.position.x,u.root.position.z,b.x,b.z));
      if(d<u.rng&&d<bd&&hasLOS(u.root.position.x,u.root.position.z,b.x,b.z,b)){bd=d;bb=b;}
    }
    if(bb){
      u.atkT=u.cd; u.swing=0.25; triggerAttackAnim(u);
      u.facing=Math.atan2(bb.x-u.root.position.x,bb.z-u.root.position.z);
      shootArrow(u,bb);
      if(CLS[u.cls].rig==="cannon"){puff(u.root.position.x+Math.sin(u.facing)*2,1.4,u.root.position.z+Math.cos(u.facing)*2,0xdddddd);
        puff(u.root.position.x+Math.sin(u.facing)*2.6,1.6,u.root.position.z+Math.cos(u.facing)*2.6,0x9a9a9a);}
      return true;
    }
  }
  let best=null,bd=1e9;
  for(const v of units){
    if(v.team===u.team||!v.alive||v.garrison)continue; // safe up in the tower
    const d=dist(u,v);
    if(d<u.rng&&d<bd&&hasLOS(u.root.position.x,u.root.position.z,v.root.position.x,v.root.position.z,null)){bd=d;best=v;}
  }
  if(!best){
    for(const b of buildings){
      if(b.team===u.team||!b.alive)continue;
      const d=Math.sqrt(dist2(u.root.position.x,u.root.position.z,b.x,b.z));
      if(d<u.rng&&d<bd&&hasLOS(u.root.position.x,u.root.position.z,b.x,b.z,b)){bd=d;best=b;}
    }
  }
  if(best){
    u.atkT=u.cd; u.swing=0.25; triggerAttackAnim(u);
    const tx=best.root?best.root.position.x:best.x, tz=best.root?best.root.position.z:best.z;
    u.facing=Math.atan2(tx-u.root.position.x,tz-u.root.position.z);
    shootArrow(u,best);
    if(CLS[u.cls].rig==="musket")puff(u.root.position.x+Math.sin(u.facing)*1.4,1.9,u.root.position.z+Math.cos(u.facing)*1.4,0xd8d8d8);
    return true;
  }
  return false;
}
// ==================== v128.5: LAG COMPENSATION, COMBAT SIDE ====================
// `_rwT` is the host-clock instant the acting guest was looking at, set by driveRemote around a
// target scan and cleared straight after. Zero means "no rewind" — the host player, every AI
// bot and the solo game all run through the same code with it at zero and behave identically.
let _rwT=0;
function setRewind(t){ _rwT=(typeof t==="number"&&t>0)?t:0; }
// The distance from `u` to `v` as the ACTOR saw it: the closest v came across the swing's active
// window, never worse than the present-tick answer. Sampling the window rather than one instant
// is what makes a swing connect when the target was crossing the arc — the "weapon sweep" half
// of the problem — and taking the min with the present means compensation can only ever add
// hits a fair player deserved, never take one away.
function rwDist(u,v){
  const ux=u.root.position.x, uz=u.root.position.z;
  let best=dist2(ux,uz,v.root.position.x,v.root.position.z);
  if(_rwT&&typeof NET!=="undefined"&&NET.histAt){
    const W=NET.MELEE_WINDOW_MS||120;
    for(let k=0;k<3;k++){
      if(NET.histAt(v,_rwT+W*k*0.5)){
        const d=dist2(ux,uz,NET._rwX,NET._rwZ);
        if(d<best)best=d;
      }
    }
  }
  return Math.sqrt(best);
}
function rwDist2(u,v){ const d=rwDist(u,v); return d*d; }
// Squared distance from point (cx,cz) to the segment (ax,az)-(bx,bz). Scalar, allocation-free —
// this runs inside the projectile loop.
function segDist2(ax,az,bx,bz,cx,cz){
  const dx=bx-ax, dz=bz-az, l2=dx*dx+dz*dz;
  if(l2<1e-9)return dist2(ax,az,cx,cz);
  let t=((cx-ax)*dx+(cz-az)*dz)/l2;
  if(t<0)t=0; else if(t>1)t=1;
  const px=ax+dx*t, pz=az+dz*t;
  return dist2(px,pz,cx,cz);
}
const ARROW_HIT2=1.25; // the historical point-test radius², now applied to a swept segment
function pistolTarget(u,rng,rwT){
  const prev=_rwT;                       // save/restore, never clobber: tryAttack also sets it
  if(rwT!==undefined)setRewind(rwT);
  let best=null,bd=rng*rng;
  for(const e of units){
    if(!e.alive||e.team===u.team)continue;
    const d=_rwT?rwDist2(u,e):dist2(e.root.position.x,e.root.position.z,u.root.position.x,u.root.position.z);
    if(d<bd){bd=d;best=e;}
  }
  _rwT=prev;
  return best;
}
let _pistolCtx=false; // v87: killUnit reads this to credit the "Last Shot" quest
function pistolShot(u,t){ // the dragoon's sidearm: loud, brutal, six rounds
  u.ammo--; u.ammoT=0; u.atkT=1.0; u.swing=0.25; triggerAttackAnim(u);
  u.facing=Math.atan2(t.root.position.x-u.root.position.x,t.root.position.z-u.root.position.z);
  _pistolCtx=true; dealDamage(u,t,55); _pistolCtx=false;
}
function tryAttack(u){ if(u.dmg<=0)return false;
  if(u.cls==="dragoon"&&(u.ammo||0)>0&&u.atkT<=0){ // powder before steel
    const t=pistolTarget(u,15);
    if(t){pistolShot(u,t);return true;}
  }
  if(u.cls==="musketeer"&&u.atkT<=0){ // v84 BAYONET: steel at arm's length before powder
    const by=CLS.musketeer.bayonet;
    let t=null,bd=(by.rng+0.6)*(by.rng+0.6);
    for(const v of units){
      if(v.team===u.team||!v.alive||v.garrison)continue;
      const dv=_rwT?rwDist2(u,v):dist2(u.root.position.x,u.root.position.z,v.root.position.x,v.root.position.z);
      if(dv<bd){bd=dv;t=v;}
    }
    if(t){
      u.atkT=by.cd; u.swing=0.25; triggerAttackAnim(u);
      u.facing=Math.atan2(t.root.position.x-u.root.position.x,t.root.position.z-u.root.position.z);
      const dl=CLS[t.cls].line; // the sword-line counters ride the blade, not the ball
      const m=dl==="ranged"?1.8:dl==="anticav"?1.25:isSiege(t.cls)?2.0:1.0;
      dealDamage(u,t,by.dmg*m);
      return true;
    }
    const bb=nearestEnemyBuilding(u,by.rng+0.6);
    if(bb){
      u.atkT=by.cd; u.swing=0.25; triggerAttackAnim(u);
      u.facing=Math.atan2(bb.x-u.root.position.x,bb.z-u.root.position.z);
      damageBuilding(bb,by.dmg*1.5,u); // a bayonet chews wood like any melee steel
      return true;
    }
  }
  return u.ranged?tryRangedAttack(u):tryMeleeAttack(u); }

// ---------- movement helpers ----------
// v131.28 THE CLEAR PASSAGE THROUGH A GATE, in MODEL space, as a half-width the body's CENTRE may
// occupy — i.e. the opening's own half-width less the 0.7 the rest of this function uses for a
// body. Returns null for any gate whose passage has not been measured off the mesh, and null means
// "behave exactly as this did before", so an unmeasured age cannot regress.
//   age 5 (fort_gate / stone_gate): piers at model x +-(PGAP/2 .. PGAP/2+PW), PGAP 3.4
//     -> opening 3.40 wide, half 1.70, less 0.70 = 1.00 of freedom for the centre.
//   ages 0-4 are NOT measured here on purpose. The Medieval twin-tower gatehouse's drums leave
//     inner faces at |x| 2.50 but its jambs close to |x| 0.80, which is 1.60 of air against a 1.40
//     body — either a deliberate non-passage or a second sealed gate, and the source does not say
//     which. Guessing it open is how a gate stops being a wall.
// v132.17 HOW HIGH A WALL ACTUALLY STANDS, so a shot flying over one is not stopped by a circle
// drawn in plan. MEASURED by tools/shootover.js as the 90th PERCENTILE of the top surface and not
// the maximum: the age-5 profile is 4.0 across the terreplein, 5.2 across the parapet and a single
// 11.0 spike at z=0 which is a banner on a pole. A ceiling taken from the max would sit above the
// parapet the man is standing behind and fix nothing.
// Only the age-5 curtain is low, which is §F.6's whole argument — "the trade is firepower for
// height, and the drop in height is the upgrade" — and it is also the only one you can walk on. The
// wall you can stand on is the wall you can shoot over; that is one fact, not two.
// v132.18 …AND IT IS A HEIGHT ABOVE THE WALL'S OWN BASE, so the caller has to add the base. These
// numbers were measured off a MODEL; a projectile's y is measured from sea level. v132.17 compared
// the two directly and it only works where a wall stands at y = 0 — which is precisely where the
// gate built its test curtain, so all three checks passed and John got a shot that still died on
// his own parapet. Terrain in play runs about -2.5 to +2: on low ground the arrow's world y falls
// under 5.2 and is eaten by the wall it is standing on, and on high ground it sails through merlons
// that should stop it. Split in two so the frame is impossible to get wrong at a glance.
function _wallTopLocal(b){
  const a=Math.max((b.def.age||0),
    Math.min(5,(typeof teamAge!=="undefined"&&teamAge[b.team])||0));
  const wood=b.type.indexOf("wood")===0;
  const fort=(b.type.indexOf("fort")===0)||a>=4;
  if(b.def.gate){
    if(wood)return a<=3?8.4:10.5;
    return fort?(a>=5?9.4:11.6):10.1;
  }
  if(wood)return a<=2?6.9:7.2;
  return fort?(a>=5?5.2:10.4):8.2;
}
function wallTopY(b){                            // WORLD height of the top of this wall
  if(!b||!b.def||!b.def.wall)return Infinity;
  return b.root.position.y+_wallTopLocal(b);
}
// …and the one place that decides whether a shot is stopped by a wall at all. ONE function, called
// from all three sites that carry the circle — the free shot, the homing shot and the guest's
// rewind — because 05-combat already warns that the rewind "must use the SAME circle as :126 or a
// guest's shot and the host's disagree", and three copies of a condition is how that happens.
function _shotClears(b,pos){
  if(!b.def.wall)return false;
  if(pos.y>wallTopY(b))return true;                    // over the top of it
  if(b.def.gate){                                      // …or straight through the gateway
    const r=b.rot||0, c=Math.cos(r), s=Math.sin(r);
    if(Math.abs((pos.x-b.x)*c-(pos.z-b.z)*s)<GATE_PASS/2-0.4)return true;
  }
  return false;
}
function _gatePassHX(b){
  const a=Math.max((b.def.age||0),
    Math.min(5,(typeof teamAge!=="undefined"&&teamAge[b.team])||0));
  // v132.15 GATE_PASS, NOT A SECOND COPY OF IT. This read 3.4 — the model's passage, re-typed here
  // — which is the same species of drift as the hand-copied road spine and the hand-typed bazaar
  // flats. Now that all four model branches leave the same opening, every gate that HAS a measured
  // passage gets one, not just age 5.
  if(a>=3&&(b.type==="fort_gate"||b.type==="stone_gate"))return GATE_PASS/2-0.7;
  if(a>=2&&b.type==="wood_gate")return GATE_PASS/2-0.7;
  return null;
}
function moveUnit(u,dx,dz,dt){
  if(u&&u._tmods&&typeof isStunned==="function"&&isStunned(u))return false; // v132.34 CONCUSSIVE BLOW
  const len=Math.hypot(dx,dz);
  if(len<0.001)return false;
  dx/=len; dz/=len;
  // PACK MULE (v132.30): a laden villager moves FASTER, to +10% at a full pack. Scaled here and
  // not on u.spd, because u.spd is a stat applyBuffStats rewrites from the class table every time
  // a buff lands — a load-dependent value written there is erased at the next visit to the forge.
  // moveUnit is also the one door all three movers pass through (local player, host-driven remote,
  // and the guest's own prediction), so this reads the same on every screen.
  let _spd=u.spd;
  // v132.32: the timed speed modifiers (BLOODRUSH, SURVIVAL INSTINCT, HUNTER'S STEP) compound
  // here, and LONG STRIDER rides the same line as a STATE rather than a timer.
  if(u._tmods)_spd*=tmodMul(u,"spdmul");
  if(typeof buffSt==="function"&&buffSt(u,"stride")&&
     typeof T!=="undefined"&&T-(u._lastHurt||-99)>TMOD_OOC)
    _spd*=1+0.30*buffSt(u,"stride");
  const _mu=(typeof buffSt==="function")?buffSt(u,"mule"):0;
  if(_mu&&u.cls==="villager"&&u.carry){
    const cap=(typeof carryCap==="function")?carryCap(u):20;
    const load=(u.carry.food||0)+(u.carry.gold||0)+(u.carry.stone||0)+(u.carry.wood||0);
    if(cap>0)_spd*=1+0.10*_mu*Math.max(0,Math.min(1,load/cap));
  }
  let nx=u.root.position.x+dx*_spd*dt;
  let nz=u.root.position.z+dz*_spd*dt;
  if(!walkable(nx,nz)){ // the wall stands at the MOUNTAINS: fringe apron + camp pockets are open ground
    nx=Math.max(-(MAP.x+BORDER_FRINGE),Math.min(MAP.x+BORDER_FRINGE,nx));
    nz=Math.max(-(MAP.z+BORDER_FRINGE),Math.min(MAP.z+BORDER_FRINGE,nz));
  }
  // push out of buildings (farm FIELDS are walkable; the barn standing on one is not)
  for(const b of buildings){
    if(!b.alive)continue;
    if(b.def.flat){
      // `flat` means the FIELD, and it has to keep meaning that: the crop rows are walked on by
      // every villager who harvests them and by 07-ai.js's farm logic. So the plot stays open and
      // the masses standing on it block individually — see BLD.farm.blockParts. Model-local
      // coordinates, so BSCALE and the plot's own rotation are applied here, once, in one place.
      const P=b.def.blockParts; if(!P)continue;
      const bs=(typeof BSCALE!=="undefined"&&BSCALE[b.type])||1;
      const rot=b.rot||0, c=Math.cos(rot), sn=Math.sin(rot);
      // THE SAME AGE THE MODEL USED, derived the same way. buildingMesh (03-buildings.js:1057)
      // does `age=max(BLD[type].age||0, min(5,age))`, and BLD.farm.age is 1 — a farm unlocks at
      // Bronze and is NEVER drawn at Stone. A collider that read teamAge raw would think a Stone
      // farm had no barn while the model drew one. Two derivations of the same number is how a
      // wall ends up standing somewhere the building isn't.
      const A=Math.max((b.def.age||0),
        Math.min(5,(typeof teamAge!=="undefined"&&teamAge[b.team])||0));
      for(const q of P){
        if(q.minAge!==undefined&&A<q.minAge)continue;   // the barn arrives at Bronze
        if(q.maxAge!==undefined&&A>q.maxAge)continue;   // the dovecote is Medieval only
        const qx=q.x*bs, qz=q.z*bs, qr=q.r*bs+0.7;
        // local -> world, the same convention the wall OBB below inverts (x' = x*cos + z*sin)
        const wx=b.x+qx*c+qz*sn, wz=b.z-qx*sn+qz*c;
        const dd=dist2(nx,nz,wx,wz);
        if(dd<qr*qr){const d=Math.sqrt(dd)||0.001;
          nx=wx+(nx-wx)/d*qr; nz=wz+(nz-wz)/d*qr;}
      }
      continue;
    }
    if(b.def.gate&&b.team===u.team){
      // v131.28 YOUR OWN GATE STANDS OPEN — AT ITS OPENING. This was a blanket `continue`, i.e. no
      // collider at all, so the owner walked through the piers and the rustication exactly as
      // easily as through the gateway, and the gateway did no work. It also hid the fact that the
      // age-5 rampart was never split (03-buildings.js), because the one thing that could have
      // noticed was switched off.
      // PLAYER ONLY, AND BOTS KEEP THE BYPASS UNCHANGED. 07-ai.js routes a bot to a gate on a 3.5
      // arrival radius and re-routes along the wall line; handing it a 3.4-wide doorway to thread
      // is a pathing change, and this is not the commit to make one in.
      const _gp=_gatePassHX(b);
      if(!u.isPlayer||_gp===null)continue;                 // as before for bots, and for any age
      const _r=b.rot||0,_c=Math.cos(_r),_s=Math.sin(_r);   //   whose passage is not measured
      if(Math.abs((nx-b.x)*_c-(nz-b.z)*_s)<_gp)continue;   // lined up with it: through you go
    }                                                      // otherwise: your own piers are stone
    // v131.24 A BODY ON THE WALKWAY IS ABOVE THIS WALL, NOT INSIDE IT. The wall's box is thin
    // (hw 1.30) and the ramp lies entirely outside it, so the climb was always unobstructed -- what
    // blocked the walk ALONG the terreplein was this box, at deck height, where there is nothing.
    // Player only, per the owner's scoping, so bots keep colliding with walls exactly as before.
    // v131.28 …AND A GUEST IS ON IT TOO. This tested u.isPlayer, which on the HOST is false for
    // every guest-driven body (10-net.js names those u.remote). So the host blocked a guest at the
    // wall's box and drew him at terrain height while his own client predicted him on the deck —
    // not a cosmetic asymmetry but a live position disagreement between the two machines.
    if(b.def.wall&&(u.isPlayer||u.remote)&&typeof wallFloorAt==="function"){
      const wf=wallFloorAt(nx,nz);
      if(wf!==null&&u.root.position.y>wf-1.2)continue;   // standing on it, or stepping onto it
    }
    if(b.def.wall){ // walls are LONG: oriented-box collision, not a circle
      const rot=b.rot||0,c=Math.cos(rot),sn=Math.sin(rot);
      const dx0=nx-b.x,dz0=nz-b.z;
      const lx=dx0*c-dz0*sn, lz=dx0*sn+dz0*c;
      const hl=6.25+0.55, hw=0.6+0.7;
      if(Math.abs(lx)<hl&&Math.abs(lz)<hw){
        const pz=(lz>=0?hw:-hw);
        // head-on shoves become wall-following: how much of the desired motion
        // points INTO the wall (vs along it) decides how hard we drift endward
        const tX=c, tZ=-sn;                       // the wall's long axis in world
        const along=dx*tX+dz*tZ;                  // tangential share of desired motion
        const into=1-Math.min(1,Math.abs(along)); // mostly head-on? drift more
        const s=(Math.abs(along)>0.25)?Math.sign(along):(lx>=0?1:-1); // keep momentum, else nearest end
        let gx=lx+s*u.spd*dt*(0.35+0.85*into);    // slide toward the chosen end
        nx=b.x+gx*c+pz*sn; nz=b.z-gx*sn+pz*c;
      }
      continue;
    }
    // v131.28 …AND SOME BUILDINGS ARE NOT ONE BOX. 00-data.js's own note — "castle: NO BOX ON
    // PURPOSE… a single box would fill the courtyard solid" — is true of one box and was taken as
    // an argument for a circle, which stands 3.50 off an age-4 curtain and 9.80 off an age-5
    // platform's flat face. Several shapes describe a castle; one never could.
    if(b.def.blockShapes){
      const _sA=Math.max((b.def.age||0),
        Math.min(5,(typeof teamAge!=="undefined"&&teamAge[b.team])||0));
      const L=b.def.blockShapes[_sA];
      if(L){
        const bs=(typeof BSCALE!=="undefined"&&BSCALE[b.type])||1;
        const rot=b.rot||0, c=Math.cos(rot), sn=Math.sin(rot);
        for(const q of L){
          const qx=q.x*bs, qz=q.z*bs;
          // model -> world, the same convention as blockParts above and the wall OBB below
          const wx=b.x+qx*c+qz*sn, wz=b.z-qx*sn+qz*c;
          if(q.r!==undefined){                                  // a drum
            const qr=q.r*bs+0.7, dd=dist2(nx,nz,wx,wz);
            if(dd<qr*qr){const d=Math.sqrt(dd)||0.001;
              nx=wx+(nx-wx)/d*qr; nz=wz+(nz-wz)/d*qr;}
            continue;
          }
          // a slab, carrying its OWN yaw on top of the building's — the curtain segments each
          // stand square to their own radial, which is the whole reason a circle could not do this
          const t=rot+(q.yaw||0), tc2=Math.cos(t), ts=Math.sin(t);
          const dx1=nx-wx, dz1=nz-wz;
          const lx=dx1*tc2-dz1*ts, lz=dx1*ts+dz1*tc2;
          const hx=q.hx*bs+0.7, hz=q.hz*bs+0.7;
          const ax=Math.abs(lx), az=Math.abs(lz);
          if(ax<hx&&az<hz){                                     // out along the LEAST penetration
            let gx=lx, gz=lz;
            if(hx-ax<hz-az)gx=(lx>=0?hx:-hx); else gz=(lz>=0?hz:-hz);
            nx=wx+gx*tc2+gz*ts; nz=wz-gx*ts+gz*tc2;
          }
        }
      }
      continue;
    }
    // v131.9 THE PUSH IS A BOX WHERE WE HAVE ONE. A circumscribing circle stands proud of a flat
    // wall by (corner - halfwidth) and proud of a diagonal by nothing, which is why it played as
    // an invisible wall that moved depending on which way you walked at it. Push out along the
    // axis of LEAST penetration, so a body sliding along a wall keeps sliding instead of being
    // flicked round a corner.
    if(b.def.fx!==undefined){
      const rot=b.rot||0, c=Math.cos(rot), sn=Math.sin(rot);
      const dx0=nx-b.x, dz0=nz-b.z;
      const lx=dx0*c-dz0*sn, lz=dx0*sn+dz0*c;
      // v131.19 THE BOX IS PER AGE. A building restyles as the town ages and its footprint moves
      // with it: a Bronze guard tower is 4.20 wide and its Enlightenment bastion 8.96, so one
      // baked maximum left 5.03 units of invisible wall standing round the early model. The age is
      // derived the same way buildingMesh derives it, or the collider and the mesh disagree.
      const _bA=Math.max((b.def.age||0),
        Math.min(5,(typeof teamAge!=="undefined"&&teamAge[b.team])||0));
      const _fx=(b.def.fxA&&b.def.fxA[_bA]!==undefined)?b.def.fxA[_bA]:b.def.fx;
      const _fz=(b.def.fzA&&b.def.fzA[_bA]!==undefined)?b.def.fzA[_bA]:b.def.fz;
      const hx=_fx+0.7, hz=_fz+0.7;                // +0.7: the body's own half-width, as before
      const ax=Math.abs(lx), az=Math.abs(lz);
      if(ax<hx&&az<hz){
        let gx=lx, gz=lz;
        if(hx-ax<hz-az)gx=(lx>=0?hx:-hx); else gz=(lz>=0?hz:-hz);
        nx=b.x+gx*c+gz*sn; nz=b.z-gx*sn+gz*c;
      }
      continue;
    }
    // and the circle stays for the types that have no box yet — the castle, and anything new
    // whose footprint has not been measured. `r` is the SPACING radius as well as the physical one
    // (03-buildings.js:2985 has said so all along), so when the v131 models outgrew their blockers
    // and the fix was to grow `r`, the exclusion disc `r+r'+2.2` in validFor grew with it and the
    // AI stopped being able to place a stable, a market or a forge at all. One number cannot be
    // both the wall you cannot walk through and the elbow room between two plots. rBlock is the
    // wall; it defaults to r for anything without one (00-data.js, under the table).
    const dd=dist2(nx,nz,b.x,b.z), r=b.def.rBlock+0.7;
    if(dd<r*r){
      const d=Math.sqrt(dd)||0.001;
      nx=b.x+(nx-b.x)/d*r; nz=b.z+(nz-b.z)/d*r;
    }
  }
  const ox=u.root.position.x, oz=u.root.position.z;
  u.root.position.x=nx; u.root.position.z=nz;
  // face the REALIZED motion: sliding along a wall or a building's edge no longer
  // crab-walks the body sideways while it stares at the blocked heading
  const rx2=nx-ox, rz2=nz-oz, rl2=Math.hypot(rx2,rz2), step=u.spd*dt;
  if(rl2>step*0.15)u.facing=Math.atan2(rx2,rz2);
  else if(rl2<step*0.03){u.facing=Math.atan2(dx,dz);return false;} // pinned: face intent, legs stop
  else u.facing=Math.atan2(dx,dz);
  u.walkT+=dt*(3.5+u.spd*0.75)*Math.min(1,rl2/Math.max(0.0001,step)); // stride matches ground covered
  u.gathering=null; u.moving=true;
  u._mv=T; // timestamp survives animateUnit consuming the flag
  return true;
}
// ---- proactive avoidance: see the building coming, turn parallel to its edge ----
// Returns a (possibly redirected) unit heading. When the straight line to the goal
// clips a building's circle, the unit steers onto the tangent — walking around the
// edge — instead of shoving into the facade and hoping the collision push slides it.
function steerAroundBuildings(u,hx,hz,distT,tx2,tz2){
  const px=u.root.position.x, pz=u.root.position.z;
  const look=Math.min(distT,16); // only worry about what's actually on the way
  let blk=null,bd=1e9;
  if(u._avB&&u._avB.alive&&T<u._avT){blk=u._avB;} // committed: keep rounding the same edge
  else for(const b of buildings){
    if(!b.alive||b.def.flat||b.def.wall)continue; // walls slide endward in moveUnit already
    if(b.def.gate&&b.team===u.team)continue;      // own gates stand open
    const rr=bSteer(b.def)+1.4;     // v131.9 the EDGE we round is the box, where there is one
    if(dist2(tx2,tz2,b.x,b.z)<(rr+0.8)*(rr+0.8))continue; // that's our destination's building — walk up to it
    const ox=b.x-px, oz=b.z-pz;
    const proj=ox*hx+oz*hz;             // how far ahead along our heading
    if(proj<=0.1||proj-rr>look)continue; // behind us, or beyond the horizon
    const lat=ox*hz-oz*hx;              // signed lateral miss distance
    if(Math.abs(lat)>=rr)continue;      // heading already clears the edge
    if(proj<bd){bd=proj;blk=b;}
  }
  if(!blk){u._avB=null;return [hx,hz];}
  if(blk!==u._avB){u._avB=blk;u._avT=T+0.25;u._avS=0;} // fresh commitment to this edge
  const rx=px-blk.x, rz=pz-blk.z, RL=Math.hypot(rx,rz)||0.001;
  let s=u._avS||0;
  if(!s){s=((-rz/RL)*hx+(rx/RL)*hz>=0)?1:-1;u._avS=s;} // choose a side ONCE, stick with it
  let sx=-rz/RL*s, sz=rx/RL*s;
  const rr=bSteer(blk.def)+1.4;                  // v131.9 must agree with the box the push uses
  if(RL<rr+0.6){sx+=rx/RL*0.7;sz+=rz/RL*0.7;}    // pressed against the edge: ease outward too
  const SL=Math.hypot(sx,sz)||1;
  return [sx/SL,sz/SL];
}
// ---------- wall-line routing: nobody bounces off a wall they could walk around ----------
function wallInPath(u,hx,hz,look){ // the first wall segment the heading would strike
  const px=u.root.position.x, pz=u.root.position.z;
  for(let t=2;t<=look;t+=2){
    const sx=px+hx*t, sz=pz+hz*t;
    for(const b of buildings){
      if(!b.alive||!b.def.wall)continue;
      if(b.def.gate&&b.team===u.team)continue; // own gates stand open
      const rot=b.rot||0,c=Math.cos(rot),sn=Math.sin(rot);
      const dx0=sx-b.x,dz0=sz-b.z;
      const lx=dx0*c-dz0*sn, lz=dx0*sn+dz0*c;
      if(Math.abs(lx)<6.8&&Math.abs(lz)<2.3)return b; // true segment extent — joints are covered by neighbors
    }
  }
  return null;
}
function wallCrossPoint(u,hit,tx,tz){ // where to walk instead: our gate, or the line's end
  // gather the whole wall LINE the struck segment belongs to (chained same-team segments)
  const line=[hit], seen=new Set([hit.id]);
  for(let i=0;i<line.length;i++){
    const a=line[i];
    for(const b of buildings){
      if(!b.alive||!b.def.wall||b.team!==hit.team||seen.has(b.id))continue;
      if(dist2(a.x,a.z,b.x,b.z)<13.5*13.5){seen.add(b.id);line.push(b);}
    }
  }
  const px=u.root.position.x, pz=u.root.position.z;
  // our own wall with a gate? walk to the gate — it opens for us
  if(hit.team===u.team){
    let g=null,gd=1e12;
    for(const b of line)if(b.def.gate){const d=dist2(px,pz,b.x,b.z);if(d<gd){gd=d;g=b;}}
    if(g){
      if(gd<3.5*3.5)return null; // already in the doorway: walk on through
      return{x:g.x,z:g.z};
    }
  }
  // otherwise: find the line's open ENDS and round the cheaper one.
  // the waypoint sits past the tip AND on the TARGET's side of the wall — a
  // waypoint on the wall's own axis just parks the walker at the tip forever
  const ends=[];
  for(const a of line){
    const rot=a.rot||0, ax=Math.cos(rot), az=-Math.sin(rot);
    const pxp=-az, pzp=ax; // the wall's perpendicular
    const sideT=((tx-a.x)*pxp+(tz-a.z)*pzp)>=0?1:-1; // which side is the target on?
    for(const s of [1,-1]){
      const ex=a.x+ax*s*6.25, ez=a.z+az*s*6.25;
      let covered=false; // a tip another segment continues from is not an end
      for(const b of line){
        if(b===a)continue;
        if(dist2(ex,ez,b.x,b.z)<7.5*7.5){covered=true;break;}
      }
      if(!covered)ends.push({
        x:a.x+ax*s*(6.25+3.2)+pxp*sideT*3.2,
        z:a.z+az*s*(6.25+3.2)+pzp*sideT*3.2});
    }
  }
  if(!ends.length)return null; // a closed ring: nothing to round (that is what siege is for)
  let bestP=null,bd=1e12;
  for(const p of ends){
    if(Math.hypot(px-p.x,pz-p.z)<3)continue; // already there: not a useful crossing target
    const d=Math.hypot(px-p.x,pz-p.z)+Math.hypot(tx-p.x,tz-p.z); // shortest total detour
    if(d<bd){bd=d;bestP=p;}
  }
  return bestP;
}
function moveToward(u,x,z,dt,stopDist){
  const dx=x-u.root.position.x, dz=z-u.root.position.z;
  const distT=Math.hypot(dx,dz);
  if(distT<=(stopDist||0.5)){u._stk=0;u._det=null;u._stkN=0;u._wwp=null;return true;}
  // a detour in progress takes priority — walk it out
  if(u._det&&T<u._det.until){
    moveUnit(u,u._det.x-u.root.position.x,u._det.z-u.root.position.z,dt);
    return false;
  }
  // an active wall waypoint (a gate, or the wall line's end) comes next
  if(u._wwp&&T<u._wwp.until){
    if(dist2(u.root.position.x,u.root.position.z,u._wwp.x,u._wwp.z)<2.5*2.5)u._wwp=null;
    else{
      moveUnit(u,u._wwp.x-u.root.position.x,u._wwp.z-u.root.position.z,dt);
      return false;
    }
  }
  // would the straight line strike a wall? route through a gate or around the end instead
  const wHit=wallInPath(u,dx/(distT||1),dz/(distT||1),Math.min(distT,14));
  if(wHit){
    const wp=wallCrossPoint(u,wHit,x,z);
    if(wp){
      u._wwp={x:wp.x,z:wp.z,until:T+3};
      moveUnit(u,wp.x-u.root.position.x,wp.z-u.root.position.z,dt);
      return false;
    }
  }
  const px=u.root.position.x, pz=u.root.position.z;
  const [sx,sz]=steerAroundBuildings(u,dx/(distT||1),dz/(distT||1),distT,x,z);
  moveUnit(u,sx,sz,dt);
  const moved=Math.hypot(u.root.position.x-px,u.root.position.z-pz);
  if(moved<u.spd*dt*0.25){ // pressing forward, going nowhere: something's in the way
    u._stk=(u._stk||0)+dt;
    if(u._stk>0.9){
      u._stk=0;
      const eb=nearestEnemyBuilding(u,Math.max(3.5,u.rng+1.5));
      if(eb&&u.dmg>0){ // an enemy wall bars the road? tear it down
        u.facing=Math.atan2(eb.x-px,eb.z-pz);
        tryAttack(u);
      }else{ // friendly obstruction: sidestep — wider every failed attempt
        u._detSide=-(u._detSide||1);
        u._stkN=Math.min(4,(u._stkN||0)+1);
        const L=Math.hypot(dx,dz)||1, D=8+7*u._stkN;
        u._det={x:px+dx/L*4-dz/L*D*u._detSide,
                z:pz+dz/L*4+dx/L*D*u._detSide,
                until:T+1.1+0.45*u._stkN};
      }
    }
  }else u._stk=0;
  return false;
}

// ---------- v124 THE CONVERGENCE ----------
// John: "archer projectile does not quite line up with crosshair, probably same for
// musketeer/skirmisher." Right on both counts, and it was worse than a rounding error.
//
// The old code spawned the arrow a FULL UNIT off the right shoulder and then gave it a velocity
// PARALLEL to the camera ray. Parallel lines never meet: the shot tracked ~1 unit right of the
// crosshair at EVERY range, forever. On top of that sits third-person parallax — the crosshair is
// the CAMERA's ray and the camera stands behind and above the shoulder, so even a centred muzzle
// would not agree with it.
//
// The fix is what every shooter does: pick the point the crosshair is actually over, then aim the
// muzzle AT THAT POINT rather than along a parallel heading. The convergence distance is measured
// from the feet, not the lens, because the camera's stand-off would otherwise pull the aim point
// toward the player by however far the camera sits back.
function aimRay(range){
  const dir=new THREE.Vector3();
  camera.getWorldDirection(dir);
  return {dir,pt:aimPointFor(dir,range)};
}
function aimPointFor(dir,range){
  const cp=camera.position, pp=player.root.position;
  const back=Math.hypot(cp.x-pp.x,cp.z-pp.z);   // how far the camera stands off the shoulder
  const d=back+range;
  return new THREE.Vector3(cp.x+dir.x*d, cp.y+dir.y*d, cp.z+dir.z*d);
}
// aim a projectile from `muzzle` at `pt` — the whole point of the exercise
function convergeFrom(muzzle,pt){ return pt.clone().sub(muzzle).normalize(); }

// ---------- v124 THE DRAW ----------
// John: "archer aim will be reworked where it becomes a charged shot — the longer you hold down
// fire and release, the faster the projectile and more damage it does."
//
// WHICH CLASSES DRAW is an explicit list, and it has to be. Crossbowman and Skirmisher are tagged
// rig:"bow" for their ANIMATION rig, so the obvious `rig==="bow"` test would have handed the draw
// to exactly the two units John excluded. His rule: "crossbowman or musketeer, skirmisher... should
// just fire and reload."
//
// The consequence is a nice one: the draw is an early-and-mid-game skill that technology retires.
// Ages 0-3 archery is timing and commitment; from the Medieval Age the crossbow — whose whole
// historical selling point was needing no strength or training — and then the musket trade that
// skill away for a mechanism. The Slinger is in by judgement call: a sling is whirled rather than
// drawn, but excluding it would leave the Stone Age with no ranged skill expression at all.
const DRAW_CLASSES=new Set(["slinger","archer","imparcher","comparcher"]);
const DRAW_FULL=1.2;    // seconds to a full draw
const DRAW_DMG=[0.5,2.0];  // tap -> full, multiplied into the unit's base damage
const DRAW_SPD=[0.6,1.6];  // tap -> full, multiplied into the 36 u/s arrow
function isDrawClass(cls){ return DRAW_CLASSES.has(cls); }
// The fire-and-reload lines keep EXACTLY their old behaviour — the v113 aimed-shot bonus of 1.35x
// and the standard arrow speed. Nothing about crossbow/skirmisher/musket play changes in v124.
function drawScale(cls,lv){
  if(!isDrawClass(cls))return {dmg:1.35,spd:1};
  const t=Math.max(0,Math.min(1,lv||0));
  return {dmg:DRAW_DMG[0]+(DRAW_DMG[1]-DRAW_DMG[0])*t,
          spd:DRAW_SPD[0]+(DRAW_SPD[1]-DRAW_SPD[0])*t};
}
function drawLevel(){
  return isDrawClass(player.cls)?Math.min(1,(player._drawT||0)/DRAW_FULL):1;
}
// Called once per frame from updatePlayer (and the guest frame). Holding primary while aiming
// builds the draw; RELEASING looses it. A tap still looses — weak and slow — because a panicked
// press that produces no arrow at all reads as a broken button.
function tickDraw(dt){
  if(!player||!player.alive||!isDrawClass(player.cls)||!aiming){
    if(player)player._drawT=0;
    return;
  }
  if(lmbHeld){
    if(player.atkT<=0)player._drawT=(player._drawT||0)+dt;
  }else if(player._drawT>0){
    const lv=Math.min(1,player._drawT/DRAW_FULL);
    player._drawT=0;
    fireAimedShot(lv);
  }
}
// how full the bow is right now, 0..1 — the mobile FIRE ring and any future desktop meter read this
function drawFill(){
  return (player&&isDrawClass(player.cls)&&aiming)?Math.min(1,(player._drawT||0)/DRAW_FULL):0;
}

// The host resolving a GUEST's loosed arrow. Before v124 this did not exist: a guest's aimed shot
// was called locally from its own click handler while driveRemote saw only the `atk` bit and ran a
// plain auto-attack — the guest watched a free-aimed arrow, the host resolved a generic swing.
// Survivable while every shot did the same damage. Not survivable once the draw multiplies it.
// `dir` arrives ALREADY CONVERGED from the guest, so what the host launches is the line the guest
// actually saw leave the bow.
// v128.5 CATCH-UP. A guest's arrow is loosed at a world that is ~276ms in the host's past, so
// spawning it "now" means the shot was aimed at where the target USED to be — the measured
// error is 1.70 units at median ping against a hit radius of 1.118, i.e. the target has already
// left the cylinder before the arrow exists. Instead the arrow is born at the instant the guest
// saw and fast-forwarded to the present, tested each step as a SWEPT SEGMENT against positions
// rewound to that same step. If it connects during the catch-up it connects; if not it enters
// the world already at the position it should have reached, and continues normally from there.
// Returns true when the arrow was consumed (hit, spent, or buried) and must not be pushed.
function catchUpArrow(p,fromT,now){
  if(!(fromT>0)||!(fromT<now))return false;
  if(typeof NET==="undefined"||!NET.histAt)return false;
  const step=(NET.CATCHUP_STEP_MS||16.7)/1000;
  const vx=p.vel.x, vy=p.vel.y, vz=p.vel.z;
  let t=fromT;
  let guard=0;
  while(t<now&&guard++<64){
    const h=Math.min(step,(now-t)/1000);
    const x0=p.m.position.x, z0=p.m.position.z;
    p.m.position.x+=vx*h; p.m.position.y+=vy*h; p.m.position.z+=vz*h;
    p.traveled+=p.spd*h;
    t+=h*1000;
    if(p.traveled>p.maxRange)return true;
    if(p.m.position.y<terrainHeight(p.m.position.x,p.m.position.z)+0.15){
      puff(p.m.position.x,p.m.position.y+0.3,p.m.position.z,0x9a8a6a); return true;
    }
    for(const v of units){
      if(v.team===p.att.team||!v.alive||v.garrison)continue;
      NET.histAt(v,t); // writes _rwX/_rwZ, falling back to the present when it has no history
      if(segDist2(x0,z0,p.m.position.x,p.m.position.z,NET._rwX,NET._rwZ)<ARROW_HIT2){
        dealDamage(p.att,v,p.dmg*rps(p.attCls,v.cls));
        return true;
      }
    }
    for(const b of buildings){ // a wall in the way stops it in the past too
      if(!b.alive||b.def.flat)continue;
      if(b!==p.ignoreB&&!_shotClears(b,p.m.position)&&
         segDist2(x0,z0,p.m.position.x,p.m.position.z,b.x,b.z)<Math.pow(b.def.rBlock*0.8,2)){ // v131.6 rBlock — the rewind must use the SAME circle as :126 or a guest's shot and the host's disagree
        if(b.team!==p.att.team)damageBuilding(b,p.dmg,p.att);
        return true;
      }
    }
  }
  return false;
}
function fireAimedFor(u,dir,lv,rwT){
  if(!u||!u.alive||u.atkT>0)return false;
  u.atkT=u.cd; u.swing=0.25; triggerAttackAnim(u);
  u.facing=Math.atan2(dir.x,dir.z);
  const D=drawScale(u.cls,lv);
  const right=new THREE.Vector3(-dir.z,0,dir.x);
  const muzzle=new THREE.Vector3(
    u.root.position.x+dir.x*0.8+right.x,
    u.root.position.y+1.7,
    u.root.position.z+dir.z*0.8+right.z);
  const m=cyl(0.05,0.05,0.9,0x4a3826,4);
  m.position.copy(muzzle);
  m.lookAt(muzzle.clone().add(dir)); m.rotateX(Math.PI/2);
  scene.add(m);
  const shot={m,free:true,vel:dir.clone().multiplyScalar(36*D.spd),spd:36*D.spd,traveled:0,
    maxRange:34,att:u,dmg:u.dmg*D.dmg,attCls:u.cls,life:3};
  // v128.5: a guest's arrow starts in the past and catches up before it joins the world
  if(rwT&&typeof NET!=="undefined"&&catchUpArrow(shot,rwT,NET.now())){
    scene.remove(m);
  }else projectiles.push(shot);
  if(typeof Sound!=="undefined"){
    const k=CLS[u.cls].rig==="musket"?"gun":"bow";
    Sound.play(k,{x:u.root.position.x,z:u.root.position.z});
    if(typeof NET!=="undefined"&&NET.mode==="host"&&NET.bcast)
      NET.bcast({t:"snd",k,x:u.root.position.x,z:u.root.position.z});
  }
  return true;
}

// player archer: manually aimed straight shot along the camera.
// lv is the draw level 0..1 for the drawing classes; the fire-and-reload lines ignore it.
function fireAimedShot(lv){
  if(player.atkT>0)return;
  player.atkT=player.cd; player.swing=0.25; triggerAttackAnim(player);
  // v113 THE SILENT ARCHER: manual aimed fire made NO sound — the launch foley lived in
  // shootArrow (the auto/AI path) and this hand-aimed branch never called it. Same key law as
  // shootArrow: bow twang · musket crack · powder blast. Host also broadcasts it positionally,
  // since a free-aimed shot doesn't ride the snapshot's _fx arrow theatre.
  if(typeof Sound!=="undefined"){
    const _r=CLS[player.cls].rig;
    const _k=_r==="cannon"?"cannonfire":_r==="musket"?"gun":"bow";
    const _sx=player.root.position.x,_sz=player.root.position.z;
    Sound.play(_k,{x:_sx,z:_sz});
    if(typeof NET!=="undefined"&&NET.mode==="host"&&NET.bcast)NET.bcast({t:"snd",k:_k,x:_sx,z:_sz});
  }
  if(CLS[player.cls].rig==="cannon"){ // gunnery = archery: the camera ray IS the shot, elevation clamped
    const dirC=new THREE.Vector3();
    camera.getWorldDirection(dirC);
    dirC.y=THREE.MathUtils.clamp(dirC.y,-0.12,0.45); dirC.normalize();
    player.facing=Math.atan2(dirC.x,dirC.z);
    const f=player.facing;
    const sx=player.root.position.x, sz=player.root.position.z, gy=player.root.position.y;
    player._recoil=0.4;
    cannonPlume(f,sx+Math.sin(f)*5.0,gy+3.2,sz+Math.cos(f)*5.0);
    const mC=new THREE.Mesh(new THREE.SphereGeometry(player.cls==="culverin"?0.16:0.22,6,5),mat(0x2b2b2b));
    mC.castShadow=false;
    // v124: the barrel sits 4.5 units out and 3.2 up — the widest muzzle offset in the game, so the
    // convergence matters most here. Aim the ball AT the crosshair point, not parallel to the ray.
    const muzC=new THREE.Vector3(sx+dirC.x*4.5,gy+3.2+dirC.y*4.5,sz+dirC.z*4.5);
    const velC=convergeFrom(muzC,aimPointFor(dirC,player.rng+28));
    mC.position.copy(muzC); scene.add(mC);
    projectiles.push({m:mC,free:true,vel:velC.multiplyScalar(100),spd:100,traveled:0,
      maxRange:player.rng+28,att:player,dmg:player.dmg*1.2,attCls:player.cls,life:2.5});
    return;
  }
  const {dir,pt}=aimRay(34);       // full 3D aim: down off the parapet, up at the walls
  player.facing=Math.atan2(dir.x,dir.z);
  // v124 THE DRAW — 0..1. tickDraw hands the released level in; a direct call (fire-and-reload
  // lines, or any older path) falls through to a full-strength shot.
  const draw=(typeof lv==="number")?lv:drawLevel();
  const D=drawScale(player.cls,draw);
  const right=new THREE.Vector3(-dir.z,0,dir.x); // shoulder offset matches the aim camera
  const m=cyl(0.05,0.05,0.9,0x4a3826,4);
  const muzzle=new THREE.Vector3(
    player.root.position.x+dir.x*0.8+right.x,
    player.root.position.y+1.7,
    player.root.position.z+dir.z*0.8+right.z);
  const vdir=convergeFrom(muzzle,pt);
  m.position.copy(muzzle);
  m.lookAt(muzzle.clone().add(vdir)); m.rotateX(Math.PI/2);
  scene.add(m);
  projectiles.push({m,free:true,vel:vdir.clone().multiplyScalar(36*D.spd),spd:36*D.spd,traveled:0,
    maxRange:34,att:player,dmg:player.dmg*D.dmg,attCls:player.cls,life:3});
  // v124: on a guest the arrow above is pure theatre — dealDamage returns early off the host — so
  // the loosed shot has to be REPORTED. It rides the next input packet the way the siege lob does.
  // The direction is already converged, so the host launches the exact line the guest watched.
  if(typeof NET!=="undefined"&&NET.mode==="guest")
    NET._pendingShot={dx:r3(vdir.x),dy:r3(vdir.y),dz:r3(vdir.z),lv:Math.round(draw*100)/100};
}
function r3(n){return Math.round(n*1000)/1000;}
