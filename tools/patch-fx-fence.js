#!/usr/bin/env node
/* v132.51 — FENCE EACH PARTICLE SYSTEM, AND LET NO MOTE OUTLIVE ITS OWNER.
   Two changes, from the same playtest.

   1) CONTAINMENT. updateEffects ran four systems as one unbroken sequence, so a throw in the
      FIRST one killed the other three. That is how a missing constant in auraTick stopped puff
      sprites from fading and left John's town lit up like a fairground. The fade loop is the
      cleanup pass for everything else in the file, so it is the one thing that must never be
      reachable-only-if-the-others-succeed. Each system now runs inside its own fence and the
      player is TOLD, once, instead of being left to wonder why the sky is full of lights.

   2) John's rule, made structural: "level sparkles should not linger whatsoever and only be at
      the leveled unit." v132.50 let an orphaned mote finish its life drifting in world space —
      a deliberate choice at the time, to stop motes snapping to the origin when their owner
      died. John has now said plainly that he does not want that. An owner-less mote is killed
      the same frame, and a hard clamp means a live one can never be far from the body either. */
const fs=require('fs'),path=require('path');
const ROOT=path.join(__dirname,'..');
const rd=f=>fs.readFileSync(path.join(ROOT,f),'utf8');
const wr=(f,s)=>fs.writeFileSync(path.join(ROOT,f),s);
let edits=0;
function sub(file,find,repl,label){
  const src=rd(file); const n=src.split(find).length-1;
  if(n!==1){console.error('ABORT ['+label+'] matched '+n+' times, expected 1');process.exit(1);}
  wr(file,src.replace(find,repl)); edits++; console.log('  ok  '+label);
}

/* ---------- 1. the fence ---------- */
sub('js/05-combat.js',
`function updateEffects(dt){
  // v132.29: the level aura rides here because BOTH frame paths provably call updateEffects —
  // tickBody (09-main.js) and NET.guestFrame (10-net.js:2133). Putting it in tickBody alone is
  // trap #12, the v128.8 ribbon a guest could never clear.
  auraTick(dt);
  if(typeof buffFxTick==="function")buffFxTick(dt); // v132.39 the Batch D rings — same reasoning
                                                   // as the aura above: BOTH frame paths land here
  if(typeof fxTick==="function")fxTick(dt);         // v132.41 the set-pieces, same reasoning again
  for(let i=effects.length-1;i>=0;i--){`,
`// v132.51 ONE SYSTEM MUST NOT BE ABLE TO FREEZE THE OTHERS. Reported ONCE per system: a throw
// here repeats sixty times a second, and a console that scrolls is a console nobody reads.
const _fxFail={};
function _fxFence(name,fn,dt){
  try{ fn(dt); }
  catch(e){
    if(!_fxFail[name]){
      _fxFail[name]=1;
      console.error("[fx] "+name+" threw — the other effect systems keep running: "+(e&&e.message));
      // The one failure mode that actually reached a player was a MIXED CACHE (see sw.js
      // v132.51), and from the inside that looks exactly like a missing symbol. Say so.
      if(typeof msg==="function")
        msg("A visual effect failed. If lights are stuck in the air, hard-reload: Ctrl+Shift+R.","red");
    }
  }
}
function updateEffects(dt){
  // v132.29: the level aura rides here because BOTH frame paths provably call updateEffects —
  // tickBody (09-main.js) and NET.guestFrame (10-net.js:2133). Putting it in tickBody alone is
  // trap #12, the v128.8 ribbon a guest could never clear.
  _fxFence("aura",auraTick,dt);
  if(typeof buffFxTick==="function")_fxFence("rings",buffFxTick,dt); // v132.39 the Batch D rings
  if(typeof fxTick==="function")_fxFence("setpieces",fxTick,dt);     // v132.41 the set-pieces
  // THE FADE LOOP IS THE CLEANUP PASS FOR EVERY puff() IN THE GAME, and until v132.51 it sat
  // downstream of three systems that could throw. When auraTick did, sprites stopped fading and
  // simply accumulated — John photographed a town holding hundreds of them. It runs last, and
  // nothing above it can now stop it running.
  for(let i=effects.length-1;i>=0;i--){`,
'05-combat: each effect system runs inside its own fence');

/* ---------- 2. no mote outlives its owner ---------- */
sub('js/05-combat.js',
`      const own=_auraOwn[i];
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
      }`,
`      const own=_auraOwn[i];
      if(!own||!own.alive||!own.root){
        // v132.51 (John): "level sparkles should not linger whatsoever and only be at the
        // leveled unit." v132.50 let an orphan finish its life adrift in world space. That is a
        // mote somewhere its owner is not, which is the whole thing he asked me to remove — so
        // it dies on the frame it is orphaned, not a second later.
        _auraCol[i*3]=0;_auraCol[i*3+1]=0;_auraCol[i*3+2]=0;
        _auraLife[i]=0; _auraOwn[i]=null; _auraLive--; continue;
      }
      // A HARD LEASH as well as a rebuild. The offset is bounded by radius + climb x life today,
      // but that is three constants agreeing to be small; this is the invariant itself, and it
      // is what makes "only at the levelled unit" true no matter what those constants become.
      if(_auraOff[i*3]*_auraOff[i*3]+_auraOff[i*3+2]*_auraOff[i*3+2]>AURA_LEASH*AURA_LEASH){
        const m=Math.hypot(_auraOff[i*3],_auraOff[i*3+2])||1, k=AURA_LEASH/m;
        _auraOff[i*3]*=k; _auraOff[i*3+2]*=k;
      }
      if(_auraOff[i*3+1]>AURA_LEASH_Y)_auraOff[i*3+1]=AURA_LEASH_Y;
      _auraPos[i*3]  =own.root.position.x+_auraOff[i*3];
      _auraPos[i*3+1]=own.root.position.y+_auraOff[i*3+1];
      _auraPos[i*3+2]=own.root.position.z+_auraOff[i*3+2];`,
'05-combat: an orphaned mote dies at once, and a leash bounds the live ones');

sub('js/00-data.js',
`      AURA_SIZE=13.0;      // SCREEN-space mote size, in pixels (sizeAttenuation is OFF).`,
`      // v132.51 THE LEASH. John: "level sparkles ... should only be at the leveled unit."
      // Nothing may render further than this from the body that owns it. The horizontal figure
      // is a little over the cap's emission radius (1.15); the vertical one clears the cap's
      // column (0.85 birth + 2.40 x 1.05 climb = 3.37) with room and no more.
      AURA_LEASH=1.8,      // metres, horizontal — a smear cannot exceed this by construction
      AURA_LEASH_Y=4.2,    // metres, vertical — the column is the effect, so this is generous
      AURA_SIZE=13.0;      // SCREEN-space mote size, in pixels (sizeAttenuation is OFF).`,
'00-data: AURA_LEASH / AURA_LEASH_Y');

sub('tools/smoketest.js',
`auraTick,auraStats,auraTint,auraSpread,auraShape,auraLive,`,
`auraTick,auraStats,auraTint,auraSpread,auraShape,auraLive,updateEffects:updateEffects,AURA_LEASH,AURA_LEASH_Y,`,
'smoketest: export the leash constants');

console.log('v132.51 fx-fence: '+edits+' edits applied');
