#!/usr/bin/env node
/* pathprobe.js — a fast bench for the movement layer. v134.0.
 *
 * The whole pathing suite in smoketest.js used ONE isolated obstacle on clear ground, which is
 * exactly the case local steering already handled. Nothing put two buildings side by side, nothing
 * ran a crowd against a collider, nothing ever checked that separate() left bodies somewhere legal.
 * This is the bench those questions get asked on: it loads the bundle the way nodehash.js does
 * (~2s, no campaign) so a movement experiment costs seconds instead of the suite's four minutes.
 *
 * The measurements it prints are the ones the smoketest gates were written from — keep them in
 * step. Usage: [ROOT=/path/to/tree] node tools/pathprobe.js
 */
const fs=require("fs"),path=require("path");
const ROOT=process.env.ROOT?path.resolve(process.env.ROOT):path.join(__dirname,"..");
// PROBE_SEED seeds the world exactly the way smoketest.js does, and for the same reason: it must
// run BEFORE the bundle is evaluated, because 02-world.js captures Math.random at load time.
// Campaign health varies by seed, so any claim of the form "the AI does X better now" has to be
// made across several of them or it is a claim about one map.
if(process.env.PROBE_SEED){
  let a=(parseInt(process.env.PROBE_SEED,10)|0);
  Math.random=function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);
    t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};
}
global.window=global;
const THREE=require(path.join(__dirname,"..","node_modules","three"));
global.THREE=THREE;
function mkEl(){return{style:{},classList:{toggle(){},add(){},remove(){},contains:()=>false},innerHTML:"",textContent:"",
  dataset:{},children:[],firstChild:null,addEventListener(){},appendChild(){},removeChild(){},
  remove(){},querySelector:()=>mkEl(),querySelectorAll:()=>[],
  getContext:()=>new Proxy({},{get:(t,k)=>(typeof t[k]!=="undefined")?t[k]:()=>{}}),width:0,height:0};}
const elems={};
global.document={getElementById:id=>elems[id]||(elems[id]=mkEl()),createElement:()=>mkEl(),
  querySelector:()=>mkEl(),querySelectorAll:()=>[],addEventListener(){},body:{appendChild(){}},
  documentElement:mkEl(),exitPointerLock(){},pointerLockElement:null};
global.addEventListener=()=>{};
global.innerWidth=1280;global.innerHeight=720;global.devicePixelRatio=1;
global.location={reload(){}};
global.atob=s=>Buffer.from(s,"base64").toString("binary");
global.requestAnimationFrame=()=>{};
THREE.WebGLRenderer=function(){return{setSize(){},setPixelRatio(){},render(){},
  shadowMap:{},domElement:mkEl()}};
try{(0,eval)(fs.readFileSync(path.join(ROOT,"assets/anims.js"),"utf8"));}catch(e){}
const order=["00-data","01-engine","02-world","03-buildings","04-units","05-combat",
  "06-input","07-ai","08-ui","09-main","10-net","11-audio","12-touch","13-deskui"];
let bundle=order.map(f=>fs.readFileSync(path.join(ROOT,"js",f+".js"),"utf8")).join("\n");
bundle+="\n;global.__P={units,buildings,makeUnit,makeBuilding,moveToward,moveUnit,separate,tick,NET,nodes,updateBot,setGameOver,menuUp:()=>inMenu,CLS,isSiege,teamAge,stock,kings,"+
  "steerAroundBuildings,walkable,validFor,BLD,teamAge,MAP,BLUE,RED,advanceT:(s)=>{T+=s;},getT:()=>T,"+
  (fs.readFileSync(path.join(ROOT,"js","05-combat.js"),"utf8").indexOf("function pushOutOfBuildings")>=0
     ?"pushOutOfBuildings,pickDetour,detourFree,MOVE_STALL_T,":"")+
  "};";
try{(0,eval)(bundle);}catch(e){console.error("LOAD FAIL:",e.message);process.exit(1);}
const G=global.__P;
const HAS_V134=typeof G.pushOutOfBuildings==="function";

// ---- an INDEPENDENT read of the collider ----
// Deliberately NOT pushOutOfBuildings. A test that asks the code under test whether the code under
// test worked proves nothing — the falsify note in the handoff is exactly this: "a mutation that
// also blinds the instrument proves nothing".
function insideBuilding(b,x,z){
  if(!b.alive||b.def.flat||b.def.wall||b.def.blockShapes)return false;
  const rot=b.rot||0,c=Math.cos(rot),sn=Math.sin(rot);
  const lx=(x-b.x)*c-(z-b.z)*sn, lz=(x-b.x)*sn+(z-b.z)*c;
  const A=Math.max((b.def.age||0),Math.min(5,(G.teamAge&&G.teamAge[b.team])||0));
  if(b.def.fx!==undefined){
    const fx=(b.def.fxA&&b.def.fxA[A]!==undefined)?b.def.fxA[A]:b.def.fx;
    const fz=(b.def.fzA&&b.def.fzA[A]!==undefined)?b.def.fzA[A]:b.def.fz;
    return Math.abs(lx)<fx+0.7-1e-4&&Math.abs(lz)<fz+0.7-1e-4;
  }
  const r=(b.def.rBlock!==undefined?b.def.rBlock:b.def.r)+0.7;
  return (x-b.x)*(x-b.x)+(z-b.z)*(z-b.z)<r*r-1e-3;
}
function anyInside(x,z){for(const b of G.buildings)if(insideBuilding(b,x,z))return b;return null;}
function clear(){for(const u of G.units)if(u._probe){u.alive=false;u._probe=false;}
  for(const b of G.buildings)if(b._probe){b.alive=false;b._probe=false;}}
function bld(team,type,x,z){const b=G.makeBuilding(team,type,x,z,true);b._probe=true;return b;}
function guy(team,x,z,n){const u=G.makeUnit(team,"villager",x,z,{name:n||"Probe",bot:{role:"citizen"}});
  u._probe=true;u.bot=null;return u;}
const out=[];
function say(k,v){out.push([k,v]);console.log(k.padEnd(52," ")+" "+v);}

// ---------------------------------------------------------------------------
// F. THE CAMPAIGN. The number that speaks to John's report directly: over a real match,
//    how much of the army is standing inside a building at any moment. NET.uiSolo() first —
//    tickBody returns early on inMenu (trap #12), so a campaign that forgets it measures a
//    frozen world and reports every spawn position as a verdict. Run with PROBE_CAMPAIGN=1.
// ---------------------------------------------------------------------------
function runCampaign(){
  clear();
  if(G.menuUp())G.NET.uiSolo();
  const MIN=+(process.env.PROBE_MIN||6);
  const samples=[]; let peak=0, insideUnitFrames=0, unitFrames=0, wedged=new Map();
  const frames=Math.round(MIN*60/0.05);
  for(let f=0;f<frames;f++){
    G.setGameOver(false); G.tick(0.05);
    if(f%20)continue;                                  // sample at 1 Hz
    let ins=0,live=0;
    for(const u of G.units){
      if(!u.alive||u.isPlayer)continue;
      live++;
      const p=u.root.position;
      if(anyInside(p.x,p.z)){ins++;wedged.set(u,(wedged.get(u)||0)+1);}
    }
    insideUnitFrames+=ins; unitFrames+=live; peak=Math.max(peak,ins);
    if(f%(60*20)===0)samples.push(ins);
  }
  const pct=unitFrames?100*insideUnitFrames/unitFrames:0;
  let chronic=0; const secs=MIN*60;
  for(const [u,n] of wedged)if(n>secs*0.25)chronic++;   // inside for a quarter of the match
  say("CAMPAIGN "+MIN+"min: mean % of the army inside a collider",pct.toFixed(2)+"%");
  say("  peak bodies inside a collider at once",peak);
  say("  per-minute samples",samples.join(" "));
  say("  bodies inside for >25% of the match",chronic);
  let sidesteps=0,movers=0;
  for(const u of G.units){if(u._stkT){sidesteps+=u._stkT;movers++;}}
  say("  total sidesteps issued / bodies that needed one",sidesteps+" / "+movers);
  // --- campaign health, so a pathing change can be checked for side effects on the WAR ---
  const veh=G.units.filter(u=>G.CLS[u.cls]&&(G.CLS[u.cls].rig==="cart"||G.isSiege(u.cls)));
  const liveB=(t)=>G.buildings.filter(b=>b.alive&&b.built&&b.team===t).length;
  const liveU=(t)=>G.units.filter(u=>u.alive&&u.team===t).length;
  const mil=(t)=>G.units.filter(u=>u.alive&&u.team===t&&u.cls!=="villager"&&!u.isKing).length;
  say("  HEALTH vehicles ever/alive",veh.length+"/"+veh.filter(u=>u.alive).length);
  say("  HEALTH buildings blue/red",liveB(0)+"/"+liveB(1));
  say("  HEALTH units blue/red (military)",liveU(0)+"/"+liveU(1)+" ("+mil(0)+"/"+mil(1)+")");
  say("  HEALTH ages blue/red",G.teamAge[0]+"/"+G.teamAge[1]);
  say("  HEALTH kings alive",(G.kings[0].alive?1:0)+"/"+(G.kings[1].alive?1:0));
}

// The bench scenarios below spawn and kill bodies, and a killed body is a body the game will
// RESPAWN — so running them first leaves ~60 phantom blue villagers in the campaign and every
// HEALTH number after that is fiction. Campaign mode runs the campaign and nothing else.
if(process.env.PROBE_CAMPAIGN){
  console.log("ROOT       "+ROOT);
  console.log("v134 layer "+(HAS_V134?"present":"ABSENT (pre-v134 tree)"));
  console.log("");
  runCampaign();
  console.log("");
  process.exit(0);
}

console.log("ROOT       "+ROOT);
console.log("v134 layer "+(HAS_V134?"present":"ABSENT (pre-v134 tree)"));
console.log("");

// ---------------------------------------------------------------------------
// A. THE HAUL. A crowd of villagers converging on a stand point on the FAR side of a
//    building — the drop-off queue, which is where John sees the jam. Bodies move,
//    separate() runs after them exactly as 09-main.js runs it, and we count how many
//    are standing INSIDE a collider on each frame.
// ---------------------------------------------------------------------------
function haul(type,n,frames){
  clear();
  const b=bld(0,type,-120,-60);
  const A=Math.max((b.def.age||0),Math.min(5,G.teamAge[0]||0));
  const fz=(b.def.fzA&&b.def.fzA[A]!==undefined)?b.def.fzA[A]:(b.def.fz!==undefined?b.def.fz:b.def.rBlock);
  const goal={x:b.x,z:b.z-fz-2.2};                 // the north stand point
  const crowd=[];
  for(let i=0;i<n;i++)crowd.push(guy(0,b.x-4+(i%5)*2,b.z+fz+8+Math.floor(i/5)*2,"H"+i));
  let insideFrames=0,worstInside=0,arrived=0,sidesteps=0;
  const done=new Set();
  for(let f=0;f<frames;f++){
    for(const u of crowd){
      if(done.has(u))continue;
      if(G.moveToward(u,goal.x,goal.z,0.05,1.6))done.add(u);
    }
    G.separate(); G.advanceT(0.05);
    let ins=0;
    for(const u of crowd)if(anyInside(u.root.position.x,u.root.position.z))ins++;
    if(ins){insideFrames++;worstInside=Math.max(worstInside,ins);}
  }
  arrived=done.size;
  for(const u of crowd)sidesteps+=(u._stkT||0);
  let stillIn=0;
  for(const u of crowd)if(anyInside(u.root.position.x,u.root.position.z))stillIn++;
  clear();
  return {insideFrames,worstInside,arrived,n,sidesteps,stillIn,frames};
}
{
  const r=haul("storage_pit",18,700);
  say("HAUL pit: frames with a body inside the collider",r.insideFrames+" of "+r.frames);
  say("  worst simultaneous bodies inside",r.worstInside);
  say("  still inside at the end",r.stillIn);
  say("  reached the stand point",r.arrived+" of "+r.n);
  say("  sidesteps issued",r.sidesteps);
}
{
  const r=haul("barracks",18,700);
  say("HAUL barracks: frames with a body inside the collider",r.insideFrames+" of "+r.frames);
  say("  worst simultaneous bodies inside",r.worstInside);
  say("  still inside at the end",r.stillIn);
  say("  reached the stand point",r.arrived+" of "+r.n);
  say("  sidesteps issued",r.sidesteps);
}

// ---------------------------------------------------------------------------
// B. THE STATIC SHOVE. No movement at all: a packed blob beside a building, and only
//    separate() running. Anything that ends up inside got there by teleport.
// ---------------------------------------------------------------------------
{
  clear();
  const b=bld(0,"barracks",-120,-60);
  const A=Math.max((b.def.age||0),Math.min(5,G.teamAge[0]||0));
  const fz=(b.def.fzA&&b.def.fzA[A]!==undefined)?b.def.fzA[A]:b.def.fz;
  const face=b.z+fz+0.7;
  const crowd=[];
  for(let i=0;i<24;i++)crowd.push(guy(0,b.x-1.2+(i%3)*1.2,face+0.1+Math.floor(i/3)*0.9,"S"+i));
  for(let i=0;i<80;i++)G.separate();
  let inside=0,deepest=0;
  for(const u of crowd){
    const p=u.root.position;
    if(anyInside(p.x,p.z))inside++;
    deepest=Math.max(deepest,face-p.z);
  }
  say("SHOVE: bodies teleported inside by separate() alone",inside+" of 24");
  say("  deepest penetration past the face",deepest.toFixed(2));
  clear();
}

// ---------------------------------------------------------------------------
// C. THE POCKET BORDER. A body legally standing in a camp pocket, pressed to its EDGE.
//    The old walkable() failure snapped to the map rectangle, which is a teleport out
//    of ground the fringe rule says a body may stand on.
// ---------------------------------------------------------------------------
{
  clear();
  const u=guy(0,0,G.MAP.z+40,"Pocketed");     // north-mid pocket, well outside the rectangle
  let biggest=0;
  for(let i=0;i<200;i++){
    const p0x=u.root.position.x,p0z=u.root.position.z;
    G.moveUnit(u,0,1,0.05);                   // press north, out through the pocket's rim
    biggest=Math.max(biggest,Math.hypot(u.root.position.x-p0x,u.root.position.z-p0z));
  }
  say("POCKET: biggest single-frame jump (a step is "+(u.spd*0.05).toFixed(2)+")",biggest.toFixed(2));
  say("  final z (rectangle edge is "+(G.MAP.z+9)+")",u.root.position.z.toFixed(1));
  clear();
}

// ---------------------------------------------------------------------------
// D. THE DETOUR IS SOMEWHERE REAL.
// ---------------------------------------------------------------------------
if(HAS_V134){
  clear();
  bld(0,"barracks",-120,-40); bld(0,"barracks",-142,-58); bld(0,"barracks",-98,-58);
  const u=guy(0,-120,-58,"Detourer");
  let bad=0,n=0;
  for(let k=0;k<=4;k++){ u._stkN=k;
    for(const side of [1,-1]){ u._detSide=side;
      const d=G.pickDetour(u,0,50,50); n++;
      if(!G.walkable(d.x,d.z)||anyInside(d.x,d.z))bad++; } }
  say("DETOUR: points unwalkable or inside a building",bad+" of "+n);
  clear();
}

// ---------------------------------------------------------------------------
// E. NON-VACUITY. Open ground must cost NO sidesteps.
// ---------------------------------------------------------------------------
{
  clear();
  const u=guy(0,-120,-100,"Stroller");
  let steps=0,arrived=false;
  while(steps<900&&!arrived){arrived=G.moveToward(u,-60,-100,0.05,1.2);steps++;G.advanceT(0.05);}
  say("OPEN: reaches the goal",arrived?steps+" steps":"NEVER");
  say("  sidesteps issued on open ground (must be 0)",u._stkT||0);
  clear();
}

console.log("");
process.exit(0);
