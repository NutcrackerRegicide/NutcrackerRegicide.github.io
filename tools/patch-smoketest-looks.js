#!/usr/bin/env node
/* patch-smoketest-looks.js — gate the v132.42 persistent looks and the vignette.
 *
 * ── WHAT MAKES THESE DIFFERENT FROM EVERY EFFECT BEFORE THEM ────────────────────────────────
 * Every earlier effect was an EVENT — it happened, it was drawn, it was relayed. These are worn:
 * a unit carries the look for as long as it holds the buff. That means the failure modes are
 * different, and so are the assertions:
 *     · a look must APPEAR from the holding alone, with no event to trigger it
 *     · it must VANISH the moment the buff goes, with nothing having noticed
 *     · KING'S GUARD must respect its condition — near your king, not merely holding the buff.
 *       A look that ignores its condition is a look that lies, and this one exists to explain why
 *       a unit is hard to kill.
 *     · DESPERATION must SCALE. It is a gradient; drawn flat it says the wrong thing.
 *
 * ── AND THE VIGNETTE'S LATCH, WHICH IS THE WHOLE DESIGN ─────────────────────────────────────
 * It fires on CROSSING a quarter health, once, and re-arms only after recovering past 40%. Both
 * halves are asserted: a player parked at 20% must not pulse every frame, and one who heals to
 * 30% must not re-arm — because clearing at the same line makes anybody hovering there strobe the
 * entire screen every time a heal ticks them over it and a blow takes them back under.
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

sub("export the look surface",
  'RING_MIN,RING_TIGHTEN,getPlayer:()=>player,fxTick,fxStats,vfxPlay,isHuman};";',
  'RING_MIN,RING_TIGHTEN,getPlayer:()=>player,fxTick,fxStats,vfxPlay,isHuman,'+
  'tickVignette,KGUARD_R,nearOwnKing};";');

sub("the look gates",
'      // ---- v132.41: THE SET-PIECES ----',
'      // ---- v132.42: THE PERSISTENT LOOKS ----\n'+
'      {\n'+
'        const S=G.buffFxStats, FX=G.buffFxTick;\n'+
'        const _pk=[];\n'+
'        for(const u of G.units)if(u.buffs&&Object.keys(u.buffs).length){_pk.push([u,u.buffs]);u.buffs={};}\n'+
'        try{\n'+
'          const L=mkB(0,{}); L.buffs={};\n'+
'          FX(0.016);\n'+
'          check("v132.42 looks: the stage is clear before the block ("+S().looks+")",S().looks===0);\n'+
'          // a look appears from the HOLDING alone — no event, nothing to trigger it\n'+
'          L.buffs={captain:1}; FX(0.016);\n'+
'          const cap=S().looks;\n'+
'          check("v132.42 CAPTAIN\'S BANNER: the look appears from the HOLDING alone — no event "+\n'+
'            "fires it, which is the whole difference between these and every effect before them "+\n'+
'            "("+cap+")",cap===1);\n'+
'          // …and vanishes the moment the buff goes\n'+
'          L.buffs={}; FX(0.016);\n'+
'          check("v132.42 looks: …and it VANISHES when the buff does, with nothing having to "+\n'+
'            "notice ("+S().looks+")",S().looks===0);\n'+
'          // DESPERATION scales with missing health\n'+
'          L.buffs={fervor:1}; L.hp=L.maxHp*0.95; FX(0.016);\n'+
'          const nearFull=S().looks;\n'+
'          L.hp=L.maxHp*0.20; FX(0.016);\n'+
'          const hurt=S().looks;\n'+
'          check("v132.42 DESPERATION: nothing at 95% health, a haze at 20% — it is a GRADIENT, "+\n'+
'            "and drawn flat it would say the wrong thing ("+nearFull+" → "+hurt+")",\n'+
'            nearFull===0&&hurt===1);\n'+
'          // KING\'S GUARD respects its CONDITION, not merely the holding\n'+
'          L.buffs={kguard:1}; L.hp=L.maxHp;\n'+
'          const k=G.kings&&G.kings[0];\n'+
'          if(k&&k.root){\n'+
'            const kx=k.root.position.x, kz=k.root.position.z;\n'+
'            L.root.position.set(kx+G.KGUARD_R+40,0,kz);  FX(0.016); const far=S().rings;\n'+
'            L.root.position.set(kx+2,0,kz);              FX(0.016); const near=S().rings;\n'+
'            check("v132.42 KING\'S GUARD: the ring obeys its CONDITION — nothing "+(G.KGUARD_R+40)+\n'+
'              " units from your king, a ring beside him. A look that ignores its condition is a "+\n'+
'              "look that lies, and this one exists to explain why a unit is hard to kill ("+\n'+
'              far+" → "+near+")",far===0&&near===1);\n'+
'          }\n'+
'          L.buffs={}; L.alive=false; FX(0.016);\n'+
'        }finally{ for(const [u,b] of _pk)u.buffs=b; FX(0.016); }\n'+
'      }\n'+
'      // ---- v132.42: SURVIVAL INSTINCT — the latch is the design ----\n'+
'      {\n'+
'        const P=G.getPlayer(), b0=P.buffs, hp0=P.hp;\n'+
'        const el=document.getElementById("vig");\n'+
'        const op=()=>parseFloat(el.style.opacity||"0");\n'+
'        try{\n'+
'          P.buffs={flight:1}; P.alive=true;\n'+
'          P.hp=P.maxHp; G.tickVignette(0.016);\n'+
'          for(let i=0;i<80;i++)G.tickVignette(0.016);      // drain any leftover pulse\n'+
'          check("v132.42 vignette: dark at full health ("+op().toFixed(2)+")",op()===0);\n'+
'          P.hp=P.maxHp*0.20; G.tickVignette(0.016);\n'+
'          const lit=op();\n'+
'          check("v132.42 vignette: it lights on CROSSING under a quarter health ("+lit.toFixed(2)+\n'+
'            ")",lit>0);\n'+
'          for(let i=0;i<80;i++)G.tickVignette(0.016);      // still under, still parked there\n'+
'          check("v132.42 vignette: …and it does NOT re-fire while you sit at 20% — it is an EDGE, "+\n'+
'            "not a level, or a wounded player strobes the whole screen ("+op().toFixed(2)+")",\n'+
'            op()===0);\n'+
'          P.hp=P.maxHp*0.30; G.tickVignette(0.016);\n'+
'          P.hp=P.maxHp*0.20; G.tickVignette(0.016);\n'+
'          check("v132.42 vignette: …and healing to 30% does NOT re-arm it. Clearing at the same "+\n'+
'            "line as it fires makes anyone hovering there flash every time a heal ticks them over "+\n'+
'            "and a blow takes them back under ("+op().toFixed(2)+")",op()===0);\n'+
'          P.hp=P.maxHp*0.60; G.tickVignette(0.016);        // recovered past 40% — re-armed\n'+
'          P.hp=P.maxHp*0.20; G.tickVignette(0.016);\n'+
'          check("v132.42 vignette: …but recovering past 40% DOES re-arm it, so the second time "+\n'+
'            "you are in real trouble it still speaks ("+op().toFixed(2)+")",op()>0);\n'+
'        }finally{ P.buffs=b0; P.hp=hp0; for(let i=0;i<80;i++)G.tickVignette(0.016); }\n'+
'      }\n'+
'      // ---- v132.41: THE SET-PIECES ----');

if(failed.length){
  console.error("REFUSING TO WRITE — anchors failed:");
  failed.forEach(f=>console.error("  - "+f));
  process.exit(1);
}
fs.writeFileSync(F,s);
console.log("patched tools/smoketest.js — the look + vignette gates");
