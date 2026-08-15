#!/usr/bin/env node
/* ringcost.js — what do the v132.39 rings actually cost a frame?
 *
 * ── WHY A DIFFERENTIAL AND NOT A NUMBER ─────────────────────────────────────────────────────
 * An absolute millisecond figure from a headless harness with a stubbed renderer means very
 * little — there is no GPU, no compositor and no real frame. What DOES carry over is the
 * DIFFERENCE between the same scene with holders and without: that is the work the ring system
 * adds, measured against itself, with everything else held constant.
 *
 * The shape that matters is whether it scales with HOLDERS or with UNITS. buffFxTick walks every
 * unit to read a mask, so there is a floor proportional to the army; everything after the mask
 * check is proportional to holders, and holders are `isHuman` — a handful. If the two columns
 * below are close, the walk dominates and adding players is nearly free, which is the intended
 * shape. If holders=8 is far above holders=0, something inside the per-holder branch is doing
 * more than it should.
 *
 * ⚠ The two "GAME ERROR: Cannot access 'Sound' before initialization" lines on stderr are the
 * game's OWN crash reporter catching a benign temporal-dead-zone throw: the bundle's boot tick()
 * runs during eval, before 11-audio.js's `const Sound` has initialised. tools/smoketest.js gets
 * exactly the same and carries on. It is noise from evaluating a browser bundle in one gulp, not
 * a fault in the thing being measured — and it is left visible rather than swallowed, because a
 * tool that hides a line beginning GAME ERROR is a tool that will hide a real one some day.
 *
 * Usage: node tools/ringcost.js
 */
const cp=require("child_process"),path=require("path");
const HERE=__dirname;
if(process.env.RINGHOLDERS===undefined){
  const run=(n)=>cp.execSync("node "+JSON.stringify(__filename),
    {cwd:path.join(HERE,".."),env:Object.assign({},process.env,{RINGHOLDERS:String(n)})}).toString().trim();
  const a=run(0), b=run(8);
  console.log("  holders=0   "+a);
  console.log("  holders=8   "+b);
  const ms=(s)=>parseFloat(s);
  console.log("\n  the rings add "+((ms(b)-ms(a))*1000).toFixed(1)+
    " microseconds a frame with a full lobby holding all four ringed buffs.");
  process.exit(0);
}
// ---- the measured child ----
const fs=require("fs");
global.window=global; const THREE=require("three"); global.THREE=THREE;
Math.random=(a=>()=>{a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;
  return((t^t>>>14)>>>0)/4294967296;})(0x5E1F);
function mkEl(){return{style:{},classList:{toggle(){},add(){},remove(){}},innerHTML:"",textContent:"",
  dataset:{},children:[],firstChild:null,addEventListener(){},appendChild(){},removeChild(){},remove(){},
  querySelector:()=>mkEl(),querySelectorAll:()=>[],
  getContext:()=>new Proxy({},{get:(t,k)=>(typeof t[k]!=="undefined")?t[k]:()=>{}}),width:0,height:0};}
const elems={};
global.document={getElementById:id=>elems[id]||(elems[id]=mkEl()),createElement:()=>mkEl(),
  querySelector:()=>mkEl(),querySelectorAll:()=>[],addEventListener(){},body:{appendChild(){}},
  exitPointerLock(){},pointerLockElement:null};
global.addEventListener=()=>{};global.innerWidth=1280;global.innerHeight=720;global.devicePixelRatio=1;
global.location={reload(){}};global.atob=s=>Buffer.from(s,"base64").toString("binary");
global.requestAnimationFrame=()=>{};
THREE.WebGLRenderer=function(){return{setSize(){},setPixelRatio(){},render(){},shadowMap:{},domElement:mkEl()}};
const ROOT=path.join(HERE,"..");
const order=["00-data","01-engine","02-world","03-buildings","04-units","05-combat",
  "06-input","07-ai","08-ui","09-main","10-net","11-audio","12-touch","13-deskui"];
let b=order.map(f=>fs.readFileSync(path.join(ROOT,"js",f+".js"),"utf8")).join("\n");
b+=";global.__B={units,buffFxTick,buffFxStats,FX_SANCT,FX_BRAND,FX_RESOLVE,FX_PHALANX};";
const log=console.log; console.log=()=>{};
(0,eval)(b);
console.log=log;
const B=global.__B, N=parseInt(process.env.RINGHOLDERS,10);
for(const u of B.units.filter(u=>u.alive).slice(0,N)){
  u._fxMask=B.FX_SANCT|B.FX_BRAND|B.FX_RESOLVE|B.FX_PHALANX;
  u._fxStill=1; u._auraA=4; u._auraE=5;
}
B.buffFxTick(0.016);                                   // warm — build the pool once
const F=4000, t0=process.hrtime.bigint();
for(let i=0;i<F;i++)B.buffFxTick(0.016);
const ms=Number(process.hrtime.bigint()-t0)/1e6/F;
const st=B.buffFxStats();
console.log(ms.toFixed(4)+" ms/frame   rings drawn="+st.rings+"  pool="+st.pool+
  "  units walked="+B.units.length);
// ⚠ exit HARD. The bundle's own boot tick schedules timers (a HUD toast, the autoplay retry), and
// one of them fires a second later into a stubbed DOM and takes the process with it — after the
// measurement has already printed, which is the worst possible time to die.
process.exit(0);
