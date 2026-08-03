#!/usr/bin/env node
/* REGICIDE PVP — tools/headless.js — HOW EXPENSIVE IS AN AUTHORITY WITH NO SCREEN? (v128.5)
   ------------------------------------------------------------------------------------------
   node tools/headless.js [ticks] [--render]

   The dedicated-server question turns on ONE number that nobody had measured: what does a full
   136-unit REGICIDE tick actually cost when nothing is being drawn? A 30Hz authority has 33.3ms
   per tick. If the sim fits inside that with room to spare, a headless server is a small project.
   If it does not, no amount of transport work saves it.

   This boots the real game exactly as tools/smoketest.js does — all 14 scripts, real world gen,
   real AI, real combat — with the WebGLRenderer stubbed to a no-op, then times steady-state
   ticks. It is not a benchmark of the netcode; it is a benchmark of the SIMULATION, which is the
   thing a server would have to carry.

   --render keeps renderFrame in the loop (scene-graph work, still no GPU) so the two can be
   compared: the difference is roughly what a server stops paying for.                        */
const fs=require('fs'),path=require('path');
const ROOT=path.join(__dirname,'..');
const TICKS=Number(process.argv[2])||600;
const KEEP_RENDER=process.argv.includes("--render");

global.window=global;
const THREE=require('three'); global.THREE=THREE;
function mkEl(){return{style:{},classList:{toggle(){},add(){},remove(){}},innerHTML:"",textContent:"",
  dataset:{},children:[],firstChild:null,addEventListener(){},appendChild(){},removeChild(){},
  querySelector:()=>mkEl(),querySelectorAll:()=>[],
  getContext:()=>new Proxy({},{get:(t,k)=>(typeof t[k]!=="undefined")?t[k]:()=>{}}),width:0,height:0};}
const elems={};
global.document={getElementById:id=>elems[id]||(elems[id]=mkEl()),createElement:()=>mkEl(),
  querySelector:()=>mkEl(),querySelectorAll:()=>[],addEventListener(){},body:{appendChild(){}},
  exitPointerLock(){},pointerLockElement:null};
global.addEventListener=()=>{};
global.innerWidth=1280;global.innerHeight=720;global.devicePixelRatio=1;
global.location={reload(){}};
global.atob=s=>Buffer.from(s,"base64").toString("binary");
global.requestAnimationFrame=()=>{};
THREE.WebGLRenderer=function(){return{setSize(){},setPixelRatio(){},render(){},
  shadowMap:{},domElement:mkEl()}};

const order=["00-data","01-engine","02-world","03-buildings","04-units","05-combat",
  "06-input","07-ai","08-ui","09-main","10-net","11-audio","12-touch","13-deskui"];
let bundle=order.map(f=>fs.readFileSync(path.join(ROOT,"js",f+".js"),"utf8")).join("\n");
// tickBody returns immediately while `inMenu` is true (00-data.js:321) — a benchmark that
// forgot to leave the menu measures an idle map and reports a server 200x faster than it is.
// NET.uiSolo is the real entry point: it clears inMenu and sounds the horns.
bundle+="\n;global.__H={units,buildings,tick,tickBody,clock,NET,renderFrame,setGameOver,"+
  "startWar:()=>NET.uiSolo(),menuUp:()=>inMenu,setRender:f=>{renderFrame=f;},T:()=>T};";
const t0=process.hrtime.bigint();
(0,eval)(bundle);
const bootMs=Number(process.hrtime.bigint()-t0)/1e6;
const H=global.__H;

// a FIXED 30Hz step, exactly as a server tick loop would drive it — the sim must never read
// wall time for its own advance or two servers would disagree about how fast the world runs
H.clock.getDelta=()=>1/30;
H.startWar();                          // leave the menu — otherwise tickBody does nothing at all
if(H.menuUp())throw new Error("still in the menu after startWar — the benchmark would measure an idle map");
if(!KEEP_RENDER)H.setRender(()=>{});   // …and this is the part a server does not pay for
H.setGameOver(false);

// warm up: let world gen settle, buildings finish, the AI find its feet
// 10 sim-seconds is not a game. The field logs show 62-83 buildings and a live war; that takes
// MINUTES of simulated time to develop, and an empty map would flatter the server enormously.
const WARM=Number(process.env.WARM||9000); // 5 sim-minutes at 30Hz
const wu0=Date.now();
for(let i=0;i<WARM;i++){H.tickBody();
  if(i%1500===0)process.stderr.write("  warm "+i+"/"+WARM+" ("+Math.round(i/30)+"s sim) blds="+
    H.buildings.length+" units="+H.units.length+" @"+(Date.now()-wu0)+"ms real\n");}

const samples=new Float64Array(TICKS);
const memBefore=process.memoryUsage().heapUsed;
for(let i=0;i<TICKS;i++){
  const a=process.hrtime.bigint();
  H.tickBody();
  samples[i]=Number(process.hrtime.bigint()-a)/1e6;
}
const memAfter=process.memoryUsage().heapUsed;

const sorted=Array.from(samples).sort((a,b)=>a-b);
const at=p=>sorted[Math.min(sorted.length-1,Math.floor(sorted.length*p))];
const mean=sorted.reduce((s,x)=>s+x,0)/sorted.length;
const r2=v=>Math.round(v*100)/100;
const BUDGET=1000/30;

console.log("=".repeat(74));
console.log("REGICIDE HEADLESS TICK COST"+(KEEP_RENDER?"  (renderFrame KEPT — client-shaped)":"  (no renderFrame — server-shaped)"));
console.log("=".repeat(74));
console.log("  boot (world gen + "+order.length+" scripts) : "+r2(bootMs)+" ms");
console.log("  units "+H.units.length+"   buildings "+H.buildings.length+"   ticks sampled "+TICKS);
console.log("");
console.log("  per tick   mean "+r2(mean)+"   med "+r2(at(0.5))+"   p90 "+r2(at(0.9))+
            "   p99 "+r2(at(0.99))+"   max "+r2(at(1))+"  ms");
console.log("  30Hz budget is "+r2(BUDGET)+" ms  →  headroom at p99: "+
            r2(100*(1-at(0.99)/BUDGET))+"%   ("+r2(BUDGET/at(0.99))+"x)");
console.log("  sustained  "+r2(1000/mean)+" ticks/s if it ran flat out");
console.log("  heap grew  "+r2((memAfter-memBefore)/1048576)+" MB across the sample"+
            "  ("+r2((memAfter-memBefore)/TICKS/1024)+" KB/tick, GC permitting)");
console.log("");
const over=sorted.filter(x=>x>BUDGET).length;
console.log("  ticks over budget: "+over+" / "+TICKS+" ("+Math.round(100*over/TICKS)+"%)");
console.log("=".repeat(74));
// the game leaves timers running (the fast-lane retry, the hall registry); a benchmark should
// report and leave rather than idle in someone's terminal
process.exit(0);
