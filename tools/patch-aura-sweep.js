#!/usr/bin/env node
/* v132.53 — ENFORCE THE RULE ON THE RENDER PATH, AND MAKE THE STATS STOP LYING.

   John has now reported glowing dots hanging in the world across four versions. I have chased
   it through the aura emitter, the effects fence, the service-worker cache and the ambient dust,
   and fixed real bugs in three of those — none of which was HIS bug. He proved where it lives by
   bisection: `_auraPts.visible=false` removes the dots. It is this pool. I cannot reproduce it
   here: walking, dying, respawning, backgrounding the tab and opening the menu at a full cloud
   all leave zero dead-but-lit points and a worst distance of one unit.

   So stop hunting and make the symptom impossible instead.

   1) THE SWEEP. auraTick runs from updateEffects, which lives inside tickBody's `if(!gameOver)`
      block and behind its `if(inMenu) return`. renderFrame is the one function EVERY frame path
      calls — this file's own comments call relying on tickBody "trap #12", twice, for exactly
      this class of bug. A mote's right to exist is now checked on the render path: if its owner
      is gone, dead, no longer human, no longer levelled, or if the mote has outlived its life or
      strayed past the leash, it goes dark THIS FRAME. Whatever stops auraTick — a throw, a
      starved frame path, a state I have not thought of — cannot leave a light in the sky.

   2) auraStats().live IS A COUNTER, AND I TRUSTED IT TWICE. It reported 1 while John was looking
      at thirty dots, and I read that as "the pool is fine" both times. This session's own
      recurring lesson is that counters, presence and adjacency are easy to assert and none of
      them is ever the claim. auraStats now also reports what is actually on screen: `lit` counts
      points whose colour is non-black, `deadLit` those that are lit with no life left, `worst`
      the furthest any lit point sits from its owner, and `swept` how many the sweep has had to
      kill. If this ever recurs, one call answers it instead of six rounds of bisection. */
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

sub('js/05-combat.js',
`function auraLive(){ // ALLOCATES. Gates and tools only — never call this from a frame.`,
`// v132.53 THE SWEEP — the invariant, enforced where every frame path passes. Cheap: a lit point
// costs six compares and a hypot, and the overwhelming majority of the pool is already black, so
// the common case is one compare per slot. Returns how many it had to put out, which is a number
// worth watching: in a healthy build it is zero for the whole match.
let _auraSwept=0;
function auraSweep(){
  if(!_auraPts)return 0;
  let killed=0;
  for(let i=0;i<AURA_MAX;i++){
    if(_auraCol[i*3]===0&&_auraCol[i*3+1]===0&&_auraCol[i*3+2]===0)continue;  // already dark
    const own=_auraOwn[i];
    const ok = _auraLife[i]>0 && own && own.alive && own.root &&
               (typeof isHuman!=="function"||isHuman(own)) && own.lvl>0 &&
               Math.hypot(_auraPos[i*3]-own.root.position.x,
                          _auraPos[i*3+2]-own.root.position.z)<=AURA_LEASH+0.5;
    if(ok)continue;
    _auraCol[i*3]=0;_auraCol[i*3+1]=0;_auraCol[i*3+2]=0;
    if(_auraLife[i]>0){_auraLife[i]=0;_auraLive--;}
    _auraOwn[i]=null; killed++;
  }
  if(killed){ _auraSwept+=killed; if(_auraGeo)_auraGeo.attributes.color.needsUpdate=true; }
  return killed;
}
function auraLit(){ // what is ACTUALLY on screen, as opposed to what the counter believes
  if(!_auraPts)return{lit:0,deadLit:0,worst:0};
  let lit=0,deadLit=0,worst=0;
  for(let i=0;i<AURA_MAX;i++){
    if(_auraCol[i*3]===0&&_auraCol[i*3+1]===0&&_auraCol[i*3+2]===0)continue;
    lit++;
    if(_auraLife[i]<=0)deadLit++;
    const own=_auraOwn[i];
    if(own&&own.root){
      const d=Math.hypot(_auraPos[i*3]-own.root.position.x,_auraPos[i*3+2]-own.root.position.z);
      if(d>worst)worst=d;
    }else worst=Infinity;   // lit with no owner at all is the worst case there is
  }
  return{lit:lit,deadLit:deadLit,worst:worst};
}
function auraLive(){ // ALLOCATES. Gates and tools only — never call this from a frame.`,
'05-combat: auraSweep + auraLit');

sub('js/05-combat.js',
`function auraStats(){return{live:_auraLive,max:AURA_MAX,built:!!_auraPts,
  geo:_auraGeo,mat:_auraMat,pts:_auraPts,spread:auraSpread(),emits:_auraEmits};}`,
`function auraStats(){
  // v132.53: `+"`live`"+` is a COUNTER and it lied to me twice while John looked at thirty dots.
  // Everything from `+"`lit`"+` down is measured off the colour buffer that the GPU actually draws.
  const L=auraLit();
  return{live:_auraLive,max:AURA_MAX,built:!!_auraPts,
    geo:_auraGeo,mat:_auraMat,pts:_auraPts,spread:auraSpread(),emits:_auraEmits,
    lit:L.lit,deadLit:L.deadLit,worst:L.worst,swept:_auraSwept};}`,
'05-combat: auraStats reports the rendered truth');

sub('js/09-main.js',
`function renderFrame(dt){
  tickObjectiveFade();`,
`function renderFrame(dt){
  // v132.53 THE AURA SWEEP RIDES HERE, and the reason is the comment three lines below: this is
  // the one function every frame path calls. auraTick lives in updateEffects, which sits inside
  // tickBody's !gameOver block and behind its inMenu return — so anything that stops tickBody
  // freezes the motes lit and in place, and John has been photographing exactly that for four
  // versions. A mote that has no living, levelled, human owner within the leash goes dark on the
  // frame it is drawn, whatever the simulation did or failed to do.
  if(typeof auraSweep==="function"){try{auraSweep();}catch(e){}}
  tickObjectiveFade();`,
'09-main: sweep the aura on the render path');

sub('tools/smoketest.js',
`auraLive,AURA_LEASH,AURA_LEASH_Y,puff,fxEffects:()=>effects,dustPts:()=>dustPts,`,
`auraLive,auraSweep,auraLit,renderFrame,AURA_LEASH,AURA_LEASH_Y,puff,fxEffects:()=>effects,dustPts:()=>dustPts,`,
'smoketest: export the sweep');

console.log('v132.53 aura-sweep: '+edits+' edits applied');
