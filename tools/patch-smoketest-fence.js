#!/usr/bin/env node
/* v132.51 gates: the install-path cache guard, the fence, and the leash. */
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

/* the harness needs the puff pool to watch it drain */
sub('tools/smoketest.js',
`auraLive,AURA_LEASH,AURA_LEASH_Y,`,
`auraLive,AURA_LEASH,AURA_LEASH_Y,puff,fxEffects:()=>effects,`,
'smoketest: export puff and the effects pool');

/* ---- the guard on the INSTALL path, beside the ones on the fetch path ---- */
sub('tools/smoketest.js',
`    check("v128.7 deploy: sw.js itself is registered with updateViaCache:none",`,
`    // v132.51 THE GUARD THAT WAS MISSING, AND IT COST A PLAYTEST. Every deploy gate above
    // watches the FETCH handler. Nothing watched INSTALL, where the cache is actually filled —
    // and cache.add() revalidates against the browser's own HTTP cache, so a brand-new worker
    // could fill a brand-new cache with YESTERDAY'S FILES. John played a build with v132.50's
    // 05-combat.js and v132.49's 00-data.js: auraTick threw ReferenceError sixty times a second
    // and every particle in the game froze in mid-air. Bumping VERSION did not save him, because
    // VERSION only names the cache — it says nothing about what goes into it.
    const inst=swSrc.slice(swSrc.indexOf('addEventListener("install"'),swSrc.indexOf('addEventListener("activate"'));
    check("v132.51 deploy: the INSTALL fills the cache from the NETWORK (cache:\\"reload\\"), not "+
      "from the browser's HTTP cache — otherwise a version bump can ship a build that is new in "+
      "some files and stale in others, which is not a slow update but a different program",
      /cache\\s*:\\s*["']reload["']/.test(inst));
    check("v128.7 deploy: sw.js itself is registered with updateViaCache:none",`,
'smoketest: the install-path cache gate');

/* ---- the fence, and the leash ---- */
sub('tools/smoketest.js',
`  check("v116 touch: the mobile layer is a no-op outside a browser",`,
`  // ---------- v132.51: ONE EFFECT SYSTEM MUST NOT FREEZE THE OTHERS ----------
  {
    const G=global.__G;
    const CX=-40,CZ=40;
    G.camera.position.set(CX,30,CZ);
    // Break auraTick the way a mixed cache broke it. A levelled human with no root throws on the
    // emitter's very first line — the same shape of failure as a missing constant, reached
    // through the REAL updateEffects rather than by swapping the function out.
    const wreck=G.makeUnit(0,"clubman",CX,CZ,{name:"Wreck",bot:{role:"citizen"}});
    wreck.bot=null; wreck.remote="wreck"; wreck.lvl=5; wreck._auraAcc=0; wreck.root=null;
    let direct=false; try{G.auraTick(0.05);}catch(e){direct=true;}
    check("v132.51 fx: the gate is not vacuous — auraTick really does throw on this unit ("+
      (direct?"threw":"DID NOT THROW")+"), so the fence below is being asked a real question",
      direct===true);
    for(let i=0;i<6;i++)G.puff(CX,2,CZ,0xffffff,0.6,0.30);
    const puffs0=G.fxEffects().length;
    let escaped=false;
    try{ for(let i=0;i<40;i++)G.updateEffects(0.05); }catch(e){ escaped=true; }
    const puffs1=G.fxEffects().length;
    check("v132.51 fx: a throwing effect system is FENCED — updateEffects survived it ("+
      (escaped?"THREW":"held")+") and the puff sprites still faded ("+puffs0+" → "+puffs1+
      "). Before the fence, auraTick threw on line one and the fade loop three systems below it "+
      "never ran, so every puff a villager had ever made hung in the air lit forever — which is "+
      "the band of lights John photographed over his town and reported as level sparkles",
      !escaped&&puffs0>=6&&puffs1===0);
    const wi=G.units.indexOf(wreck); if(wi>=0)G.units.splice(wi,1);   // it has no root: evict it

    // ---- THE LEASH ----
    const led=G.makeUnit(0,"clubman",CX,CZ,{name:"Leash",bot:{role:"citizen"}});
    led.bot=null; led.remote="leash"; led.lvl=G.XP_MAX_LVL; led._auraAcc=0;
    let worst=0;
    for(let i=0;i<60;i++){G.auraTick(0.05); const s=G.auraSpread(led); if(s>worst)worst=s;}
    for(let i=0;i<60;i++){led.root.position.x+=0.5; G.auraTick(0.05);
      const s=G.auraSpread(led); if(s>worst)worst=s;}
    check("v132.51 aura: no mote is EVER further than the leash from the body that owns it ("+
      worst.toFixed(2)+"u against a leash of "+G.AURA_LEASH+"u), standing or sprinting. Today's "+
      "radius and climb already keep it under; the clamp is what keeps John's rule true when "+
      "some later version widens them",worst>0&&worst<=G.AURA_LEASH+0.01);
    led.alive=false;
    for(let i=0;i<10;i++)G.auraTick(0.05);
  }
  check("v116 touch: the mobile layer is a no-op outside a browser",`,
'smoketest: the fence and leash gates');

console.log('v132.51 gates: '+edits+' edits applied');
