#!/usr/bin/env node
/* v132.53 gates: the sweep must put out a light that auraTick can no longer reach. */
const fs=require('fs'),path=require('path');
const F=path.join(__dirname,'..','tools/smoketest.js');
const src=fs.readFileSync(F,'utf8');
const A=`  // ---------- v132.51: ONE EFFECT SYSTEM MUST NOT FREEZE THE OTHERS ----------`;
if(src.split(A).length-1!==1){console.error('ABORT: anchor');process.exit(1);}
const B=`  // ---------- v132.53: A LIGHT WITH NO LIVING OWNER DIES ON THE RENDER PATH ----------
  // The scenario is the one John photographed and I could not reproduce: the simulation stops
  // touching the aura while the screen keeps drawing. Here that is forced honestly — a full
  // cloud is raised, then auraTick is simply never called again, which is what a throw, a menu,
  // a gameOver or any starved frame path amounts to from the pool's point of view.
  {
    const G=global.__G, CX=-40, CZ=40;
    G.camera.position.set(CX,30,CZ);
    for(let i=0;i<40;i++)G.auraTick(0.05);          // drain whatever earlier blocks left aloft
    const hero=G.makeUnit(0,"clubman",CX,CZ,{name:"Sweep",bot:{role:"citizen"}});
    hero.bot=null; hero.remote="sweep"; hero.lvl=G.XP_MAX_LVL; hero._auraAcc=0;
    for(let i=0;i<30;i++)G.auraTick(0.05);
    const full=G.auraLit();
    check("v132.53 aura: the cloud is up before the simulation is cut — "+full.lit+
      " points actually lit on the colour buffer the GPU draws, not a counter's opinion of them",
      full.lit>=25);
    // CUT THE SIMULATION. auraTick is never called again from here.
    hero.root.position.x+=40;                        // …and the body walks away, as John did
    const stranded=G.auraLit();
    check("v132.53 aura: …and with the sim cut, those "+stranded.lit+" points are STILL lit and "+
      "now "+(stranded.worst===Infinity?"unowned":stranded.worst.toFixed(0)+"u")+" from the body "+
      "— this is the photograph, reproduced: a light where its owner is not",
      stranded.lit>=25&&stranded.worst>10);
    const killed=G.auraSweep();                      // exactly what renderFrame does every frame
    const after=G.auraLit();
    check("v132.53 aura: ONE render-path sweep puts out all "+killed+" of them ("+stranded.lit+
      " lit → "+after.lit+"). renderFrame is the one function every frame path calls; auraTick is "+
      "reached only through tickBody, which returns early on the menu and skips the whole block "+
      "on gameOver — trap #12, which this file names twice already",
      killed>=25&&after.lit===0&&after.deadLit===0);
    // and it must NOT put out a healthy cloud
    hero.root.position.x-=40; hero._auraAcc=0;
    for(let i=0;i<30;i++)G.auraTick(0.05);
    const healthy=G.auraLit().lit, culled=G.auraSweep(), left=G.auraLit().lit;
    check("v132.53 aura: …and it is not a mote-killer — a HEALTHY cloud of "+healthy+
      " survives the same sweep untouched ("+culled+" culled, "+left+" left). A guard that "+
      "cleared the pool every frame would pass the check above and delete the feature",
      healthy>=25&&culled===0&&left===healthy);
    hero.alive=false;
    G.auraSweep();
    check("v132.53 aura: a dead owner's cloud is out on the very next sweep, with no frame of "+
      "simulation in between ("+G.auraLit().lit+" lit)",G.auraLit().lit===0);
    for(let i=0;i<20;i++)G.auraTick(0.05);
  }
`+A;
fs.writeFileSync(F,src.replace(A,B));
console.log('v132.53 sweep gates inserted');
