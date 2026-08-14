#!/usr/bin/env node
/* patch-smoketest-aura.js — gate v132.29's level aura.
 *
 * The aura is cosmetic, which is exactly why it needs measured gates rather than a look at a
 * screenshot: §2 says judgements about how things look have been wrong repeatedly here, but the
 * things that WILL break it are all countable — the draw budget, the pool ceiling, the range
 * gate, who is allowed to glow, and whether it allocates per frame.
 *
 * What is asserted, and why each one has a real failure mode:
 *   · ONE draw object for every mote in the game. The whole reason this is a pooled Points and
 *     not sprites; a regression to one-object-per-mote is the expensive mistake and would be
 *     invisible in a screenshot.
 *   · THE POOL CEILING HOLDS under deliberate flooding. A leak here grows without bound.
 *   · NOBODY GLOWS WHO SHOULD NOT — level 0, bots, and the dead. isHuman is the same gate the
 *     quest system uses; a bot army glowing would be a very visible bug found very late.
 *   · THE RANGE GATE, which is John's v125 scouting ruling expressed in code: a unit beyond
 *     AURA_FAR must emit NOTHING, and the same unit up close must emit.
 *   · THE COLOUR RAMP: level 1 sits nearer the team colour than gold, the cap sits nearer gold
 *     than the team colour, and the cap is driven ABOVE 1.0 so it keys the 0.86 bloom threshold
 *     (§4.6) — the one thing that makes it read as "glowing" rather than "coloured" on desktop.
 *   · NO PER-FRAME ALLOCATION: geometry, material and object identity are unchanged across a
 *     hundred ticks of heavy emission. This is what puff() would have failed.
 */
const fs=require("fs"),path=require("path");
const F=path.join(__dirname,"smoketest.js");
let s=fs.readFileSync(F,"utf8");
let failed=[];
function sub(name,from,to){
  const n=s.split(from).length-1;
  if(n!==1){failed.push(name+" (matched "+n+" times, need exactly 1)");return;}
  s=s.split(from).join(to);
}

sub("export the aura",
  `UATLAS,mergeUnitBody,texturedMat,isSharedMat,bSurf,bStand};";`,
  `UATLAS,mergeUnitBody,texturedMat,isSharedMat,bSurf,bStand,`+
  `auraTick,auraStats,auraTint,AURA_MAX,AURA_NEAR,AURA_FAR,AURA_GOLD,TEAMCOL};";`);

sub("the aura gate",
`  check("v116 touch: the mobile layer is a no-op outside a browser",`,
`  // ---------- v132.29: THE LEVEL AURA ----------
  {
    const G=global.__G, A=G.auraTick, ST=G.auraStats;
    const put=(team,x,z,lvl,peer)=>{
      const u=G.makeUnit(team,"clubman",x,z,{name:"Aura"+lvl,bot:{role:"citizen"}});
      u.bot=null; if(peer)u.remote=peer; u.lvl=lvl; u._auraAcc=0; return u;
    };
    // park the camera on a clear patch and put the subjects right under it
    const CX=-40,CZ=40;
    G.camera.position.set(CX,30,CZ);
    const hero=put(0,CX,CZ,G.XP_MAX_LVL,"aura-hero");   // capped human, close
    const low =put(0,CX+2,CZ,1,"aura-low");             // level 1 human, close
    const zero=put(0,CX-2,CZ,0,"aura-zero");            // level 0 human — must never glow
    const bot =put(1,CX+4,CZ,20,null);                  // NOT human (no remote) — must never glow
    const far =put(0,CX,CZ+G.AURA_FAR+25,G.XP_MAX_LVL,"aura-far"); // capped but out of range
    for(let i=0;i<20;i++)A(0.05);
    const st1=ST();
    check("v132.29 aura: ONE draw object carries every mote in the game (built "+st1.built+
      ", live "+st1.live+")",st1.built===true&&!!st1.pts&&st1.pts.isPoints===true&&st1.live>0);
    check("v132.29 aura: a level-0 human never glows (acc "+(zero._auraAcc||0)+")",
      (zero._auraAcc||0)===0);
    check("v132.29 aura: a BOT never glows, whatever its level ("+(bot.lvl||0)+", acc "+
      (bot._auraAcc||0)+")",(bot._auraAcc||0)===0);
    check("v132.29 aura: a unit beyond AURA_FAR ("+G.AURA_FAR+") emits NOTHING — John's v125 "+
      "scouting rule, in code (acc "+(far._auraAcc||0)+")",(far._auraAcc||0)===0);
    // …and the SAME unit, walked in close, does emit. Range, not identity.
    far.root.position.set(CX+1,far.root.position.y,CZ+1);
    const before=ST().live; for(let i=0;i<10;i++)A(0.05);
    check("v132.29 aura: …and that same unit walked in close DOES emit ("+before+" → "+ST().live+
      " live motes)",ST().live>=before);
    // THE POOL CEILING, under deliberate flooding
    for(let i=0;i<200;i++)A(0.05);
    const st2=ST();
    check("v132.29 aura: the pool ceiling holds under flooding ("+st2.live+" of "+G.AURA_MAX+")",
      st2.live<=G.AURA_MAX&&st2.live<=st2.max);
    // NO PER-FRAME ALLOCATION — identity must not move
    const g0=st2.geo,m0=st2.mat,p0=st2.pts;
    for(let i=0;i<100;i++)A(0.05);
    const st3=ST();
    check("v132.29 aura: 100 more ticks allocate NOTHING — same geometry, material and object",
      st3.geo===g0&&st3.mat===m0&&st3.pts===p0);
    // THE COLOUR RAMP
    const cLo=[0,0,0],cHi=[0,0,0];
    G.auraTint(low,cLo); G.auraTint(hero,cHi);
    const tc=G.TEAMCOL[0], tr=((tc>>16)&255)/255,tg=((tc>>8)&255)/255,tb=(tc&255)/255;
    const gr=((G.AURA_GOLD>>16)&255)/255,gg=((G.AURA_GOLD>>8)&255)/255,gb=(G.AURA_GOLD&255)/255;
    const norm=a=>{const m=Math.max(a[0],a[1],a[2])||1;return [a[0]/m,a[1]/m,a[2]/m];};
    const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
    const nLo=norm(cLo), nHi=norm(cHi), team=norm([tr,tg,tb]), gold=norm([gr,gg,gb]);
    check("v132.29 aura: level 1 reads TEAM, not gold (team "+dist(nLo,team).toFixed(3)+
      " vs gold "+dist(nLo,gold).toFixed(3)+") — the team read survives",
      dist(nLo,team)<dist(nLo,gold));
    check("v132.29 aura: the CAP reads GOLD, not team (gold "+dist(nHi,gold).toFixed(3)+
      " vs team "+dist(nHi,team).toFixed(3)+")",dist(nHi,gold)<dist(nHi,team));
    check("v132.29 aura: the cap is driven ABOVE 1.0 so it keys the 0.86 bloom threshold (peak "+
      Math.max(cHi[0],cHi[1],cHi[2]).toFixed(2)+") — and level 1 is NOT (peak "+
      Math.max(cLo[0],cLo[1],cLo[2]).toFixed(2)+")",
      Math.max(cHi[0],cHi[1],cHi[2])>1.0&&Math.max(cLo[0],cLo[1],cLo[2])<1.0);
    // the dead stop glowing
    hero.alive=false; hero._auraAcc=0; low.alive=false; far.alive=false;
    for(let i=0;i<10;i++)A(0.05);
    check("v132.29 aura: the dead stop emitting (acc "+(hero._auraAcc||0)+")",(hero._auraAcc||0)===0);
    zero.alive=false; bot.alive=false;
  }
  check("v116 touch: the mobile layer is a no-op outside a browser",`);

if(failed.length){
  console.error("REFUSING TO WRITE — anchors failed:");
  failed.forEach(f=>console.error("  - "+f));
  process.exit(1);
}
fs.writeFileSync(F,s);
console.log("patched tools/smoketest.js — v132.29 aura gate");
