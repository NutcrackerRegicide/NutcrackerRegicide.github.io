#!/usr/bin/env node
/* auracost.js — what does the v132.50 aura cost a frame, and does the bigger pool matter?
 *
 * ── WHY A DIFFERENTIAL ──────────────────────────────────────────────────────────────────────
 * Same argument as ringcost.js: an absolute millisecond from a stubbed renderer means little,
 * but the DIFFERENCE between the same scene with capped players and without is the work the
 * aura adds, measured against itself.
 *
 * v132.50 raised AURA_MAX from 320 to 640 and the cap's emission rate from 34/s to 105/s, so
 * there are two separate questions and this tool separates them:
 *   · the SWEEP — auraTick walks every slot in the pool every frame whether or not it is live,
 *     so doubling AURA_MAX doubles that walk. Measured by the empty column: no emitters at all.
 *   · the LOAD  — emitting and advancing real motes. Measured by the capped column.
 * If the empty column is near zero the pool size is free and only live motes cost anything,
 * which is the shape the design assumes.
 *
 * ⚠ The "GAME ERROR: Cannot access 'Sound' before initialization" lines on stderr are the game's
 * own crash reporter catching a benign temporal-dead-zone throw while the bundle is eval'd in one
 * gulp. smoketest.js gets the same. Left visible on purpose — see ringcost.js.
 *
 * Usage: node tools/auracost.js
 */
const cp=require("child_process"),path=require("path");
const HERE=__dirname;
if(process.env.AURAN===undefined){
  const run=(n)=>cp.execSync("node "+JSON.stringify(__filename),
    {cwd:path.join(HERE,".."),env:Object.assign({},process.env,{AURAN:String(n)})}).toString().trim();
  const a=run(0), b=run(1), c=run(4);
  console.log("  no emitter (pool swept only)   "+a);
  console.log("  1 capped player                "+b);
  console.log("  4 capped players               "+c);
  const ms=s=>parseFloat(s);
  console.log("\n  sweeping the whole "+(process.env.POOL||"640")+"-slot pool with nothing in it: "+
    (ms(a)*1000).toFixed(1)+" us/frame");
  console.log("  one capped player adds "+((ms(b)-ms(a))*1000).toFixed(1)+
    " us; four add "+((ms(c)-ms(a))*1000).toFixed(1)+" us in total.");
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
b+=";global.__B={units,auraTick,auraStats,camera,makeUnit,XP_MAX_LVL,AURA_MAX,terrainHeight};";
const log=console.log; console.log=()=>{};
(0,eval)(b);
console.log=log;
const B=global.__B, N=parseInt(process.env.AURAN,10);
const CX=-40,CZ=40;
B.camera.position.set(CX,30,CZ);
for(let i=0;i<N;i++){
  const u=B.makeUnit(0,"clubman",CX+(i%4)-1.5,CZ+((i/4)|0),{name:"C"+i,bot:{role:"citizen"}});
  u.bot=null; u.remote="cost"+i; u.lvl=B.XP_MAX_LVL; u._auraAcc=0;
}
for(let i=0;i<80;i++)B.auraTick(0.016);                 // warm: build the pool, reach steady state
const F=6000, t0=process.hrtime.bigint();
for(let i=0;i<F;i++)B.auraTick(0.016);
const ms=Number(process.hrtime.bigint()-t0)/1e6/F;
console.log(ms.toFixed(4)+" ms/frame   live="+B.auraStats().live+" of "+B.AURA_MAX+
  "   units walked="+B.units.length);
process.exit(0);   // the bundle's boot timers would take the process down after the print
