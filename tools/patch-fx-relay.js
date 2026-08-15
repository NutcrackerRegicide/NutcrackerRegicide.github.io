#!/usr/bin/env node
/* patch-fx-relay.js — v132.41: the set-pieces reach guests, or they are a host slideshow.
 *
 * ── THE SAME TRAP, A THIRD TIME ─────────────────────────────────────────────────────────────
 * Every one of these fires inside dealDamage, which returns on the first line for a guest —
 * "host owns all damage". So a shockwave, a crit burst, a parried facet: all of them would draw
 * on the host's screen and nowhere else. The sounds hit this in v132.37 and the rings in v132.39.
 * It is not a bug that recurs; it is the SHAPE of this codebase, and every display feature born
 * inside dealDamage has to answer it.
 *
 * ── WHY A NEW CHANNEL AND NOT s.fx ──────────────────────────────────────────────────────────
 * s.fx already exists and is already batched — but it is a fixed four-integer arrow row,
 * [attUnit, attBld, tgtUnit, tgtBld], consumed by a loop that calls _real_shootArrow on every
 * entry. Adding a kind discriminator means editing that consumer, and the arrow theatre is load-
 * bearing show for every ranged exchange in the game. A parallel channel costs a few bytes and
 * leaves a proven path untouched.
 *
 * ── FIVE SMALL INTEGERS, BATCHED ────────────────────────────────────────────────────────────
 * [kind, x*10, z*10, p, q] — p and q mean whatever the kind needs: an angle for the two blocks, a
 * destination for the volley, a duration for the lingering ones. Batched into the snapshot like
 * the arrows rather than sent per event, because a busy melee produces bursts and one packet a
 * frame beats forty.
 *
 * ⚠ THE QUEUE IS CAPPED. A pathological frame — a slam catching thirty units, each rolling its
 * own proc — must not put a thousand rows on the wire. Past the cap the frame's remaining effects
 * are dropped, and dropping a spark nobody will separate from the forty before it is the correct
 * failure. Silently unbounded is not.
 *
 * ⚠ AND THE HOST DRAWS LOCALLY TOO. _vfx() plays it here AND queues it, exactly as _sfxAt does,
 * so a listening host sees what it sends and a headless server simply draws into nothing.
 *
 * PROTO 42 → 43.
 */
const fs=require("fs"),path=require("path");
let failed=[];
function mk(box){return function(name,from,to){
  const n=box.o.split(from).length-1;
  if(n!==1){failed.push(name+" (matched "+n+" times, need exactly 1)");return;}
  box.o=box.o.split(from).join(to);};}
const P={net:path.join(__dirname,"..","js","10-net.js"),
         comb:path.join(__dirname,"..","js","05-combat.js")};
const n={o:fs.readFileSync(P.net,"utf8")}, c={o:fs.readFileSync(P.comb,"utf8")};
const subN=mk(n), subC=mk(c);

subN("PROTO 43",
`  PROTO:42,             // v132.40 public buff rows (s.bfa) — every client learns every player's`,
`  PROTO:43,             // v132.41 the batched set-piece channel (s.vfx). Was:
                        // v132.40 public buff rows (s.bfa) — every client learns every player's`);

subN("the queue",
`NET.bcast=function(o){for(const c of NET.conns){try{if(c.open)c.send(o);}catch(_){}}};`,
`NET.bcast=function(o){for(const c of NET.conns){try{if(c.open)c.send(o);}catch(_){}}};
// v132.41 THE SET-PIECE QUEUE. Batched onto the snapshot like the arrow theatre above it. Capped:
// one slam catching thirty units, each rolling its own proc, must not put a thousand rows on the
// wire — past the cap the rest of the frame is dropped, and dropping a spark nobody could pick
// out of the forty before it is the right failure. Silently unbounded is not.
NET._vfx=[]; NET.VFX_MAX=48;
NET.vfxPush=function(row){ if(NET.mode==="host"&&NET._vfx.length<NET.VFX_MAX)NET._vfx.push(row); };`);

subN("ship the queue",
`  if(NET._fx.length)s.fx=NET._fx.splice(0,NET._fx.length); // batched arrow theatre rides the snap`,
`  if(NET._fx.length)s.fx=NET._fx.splice(0,NET._fx.length); // batched arrow theatre rides the snap
  if(NET._vfx.length)s.vfx=NET._vfx.splice(0,NET._vfx.length); // v132.41 the set-pieces, same ride`);

subN("count it",
`    (s.bfa?s.bfa.reduce((a,r)=>a+8+r[1].length*3,0):0)+ // v132.40: the loadouts, on full snaps`,
`    (s.bfa?s.bfa.reduce((a,r)=>a+8+r[1].length*3,0):0)+ // v132.40: the loadouts, on full snaps
    (s.vfx?s.vfx.length*12:0)+ // v132.41: five small ints a set-piece`);

subN("guest plays them",
`  if(s.fx)for(const f of s.fx){ // v95: batched arrow theatre — damage is host-only, this is the show`,
`  if(s.vfx&&typeof vfxPlay==="function")for(const v of s.vfx)vfxPlay(v); // v132.41 the set-pieces
  if(s.fx)for(const f of s.fx){ // v95: batched arrow theatre — damage is host-only, this is the show`);

subC("the emitter and the kinds",
`function fxStats(){return {live:_fxLive.length,sprites:_fxsPool?_fxsPool.length:0,`,
`// The wire vocabulary. Small integers, because the row is [kind,x*10,z*10,p,q] and p/q mean
// whatever the kind needs — an angle, a destination, a duration.
const VFX_QUAKE=1, VFX_CRIT=2, VFX_CULL=3, VFX_SHRUG=4, VFX_DODGE=5,
      VFX_WARD=6, VFX_GUARD=7, VFX_VOLLEY=8, VFX_BLEED=9, VFX_VENOM=10, VFX_STUN=11;
// ONE path: draw it here, and put it on the wire. Identical reasoning to _sfxAt in v132.37 —
// dealDamage returns early on a guest, so without this every set-piece is a host-only slideshow,
// and on a dedicated server it draws into an empty room.
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
        fxs(x,gy+2.4,z,0xfff4d0,0.30,0.19,Math.cos(a)*13,1.2,Math.sin(a)*13,0,0.55,1);}
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
    case VFX_STUN: {           // CONCUSSIVE BLOW — sparks ORBITING for the stun's own duration,
      const dur=Math.max(0.4,(p||15)/10);           // so the ring is the timer: you can see it end
      for(let i=0;i<3;i++){const a=Math.PI*2*i/3;
        fxs(x+Math.cos(a)*0.85,gy+2.9,z+Math.sin(a)*0.85,0xffe9a8,0.30,dur,
            -Math.sin(a)*2.6,0.15,Math.cos(a)*2.6,0,1,0.95);}
      break; }
  }
}
function fxStats(){return {live:_fxLive.length,sprites:_fxsPool?_fxsPool.length:0,`);

if(failed.length){
  console.error("REFUSING TO WRITE — anchors failed:");
  failed.forEach(f=>console.error("  - "+f));
  process.exit(1);
}
fs.writeFileSync(P.net,n.o); fs.writeFileSync(P.comb,c.o);
console.log("patched — the set-pieces have a wire. PROTO 43.");
