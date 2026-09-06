#!/usr/bin/env node
/* REGICIDE PVP — tools/towerbox.js — WHAT IS A GUARD TOWER ACTUALLY THE SIZE OF? (v134.11)
   ------------------------------------------------------------------------------------------
   node tools/towerbox.js [type]

   John: "All guard towers should be the same size regardless of age to prevent that issue from
   happening. Or at least have the same footprint."

   BLD.tower.fxA/fzA say the plan goes 4.20 x 6.30 at age 3, 4.00 x 4.00 at age 4 and 8.96 x 9.03
   at age 5 — and 9.03 is what collapses the bazaar ring from four towers to two. But fxA is a
   MEASUREMENT of the model, not a dial (v131.19: "a building restyles as the town ages, so its
   blocker has to age with it"), so before touching either the table or the model we need to know
   what is actually out there at 9.03 and whether it is a WALL or a flagpole.

   This boots the real bundle in Node (the tools/headless.js pattern — real three, stubbed
   renderer), builds the tower at each age, and reports every part by how far it reaches, so the
   extremes have names instead of numbers.                                                     */
const fs=require('fs'),path=require('path');
const ROOT=path.join(__dirname,'..');
const TYPE=process.argv[2]||"tower";

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
bundle+="\n;global.__G={buildingMesh,BLD,BSCALE,bSpace,teamAge};";
(0,eval)(bundle);
const G=global.__G;

// One part's reach, in the model frame the collider works in (05-combat.js:2352 rotates the body
// into the building's own frame, so the box is MODEL space and never a world AABB).
// ⚠ EVERY VERTEX, not the eight corners of geometry.boundingBox. Pushing a geometry's AABB through
// a rotation measures the ROTATED BOX, which is strictly bigger than the rotated shape and wildly
// bigger for a low-segment cylinder. That is the whole bug this tool was written to find.
function extents(group,everyVertex){
  group.updateMatrixWorld(true);
  let fx=0,fz=0; const who=[];
  group.traverse(o=>{
    if(!o.isMesh||!o.geometry||!o.geometry.attributes||!o.geometry.attributes.position)return;
    const pos=o.geometry.attributes.position, m=o.matrixWorld, v=new THREE.Vector3();
    let px=0,pz=0,y0=1e9;
    for(let i=0;i<pos.count;i++){
      v.fromBufferAttribute(pos,i).applyMatrix4(m);
      if(Math.abs(v.x)>px)px=Math.abs(v.x);
      if(Math.abs(v.z)>pz)pz=Math.abs(v.z);
      if(v.y<y0)y0=v.y;
    }
    if(!everyVertex&&y0>2.0)return;          // only what a body can walk into
    if(px>fx)fx=px; if(pz>fz)fz=pz;
    who.push({px,pz,y0,reach:Math.max(px,pz),name:(o.geometry.type||"?").replace("Geometry","")+
      " ("+o.position.x.toFixed(1)+","+o.position.y.toFixed(1)+","+o.position.z.toFixed(1)+")"});
  });
  who.sort((a,b)=>b.reach-a.reach);
  return {fx,fz,who};
}

const TYPES=TYPE==="all"?Object.keys(G.BLD).filter(t=>G.BLD[t].fxA):[TYPE];
console.log("TABLE vs THE MODEL — half-extents in model space, every vertex.");
console.log("`over` is table minus model: invisible wall standing round nothing.\n");
let worst=[];
for(const t of TYPES){
  const bs=(G.BSCALE&&G.BSCALE[t])||1, minAge=(G.BLD[t]&&G.BLD[t].age)||0;
  console.log("== "+t+(bs!==1?"  (BSCALE "+bs+")":""));
  for(let age=minAge;age<=5;age++){
    const g=G.buildingMesh(t,0,age,0,0);
    const all=extents(g,true), low=extents(g,false);
    const tx=G.BLD[t].fxA[age], tz=G.BLD[t].fzA[age];
    const ox=tx-all.fx*bs, oz=tz-all.fz*bs;
    const flag=(ox>0.15||oz>0.15)?"  <== OVER-BLOCKS":"";
    console.log("   age "+age+"  table "+tx.toFixed(2)+" x "+tz.toFixed(2)+
      "   model(all) "+(all.fx*bs).toFixed(2)+" x "+(all.fz*bs).toFixed(2)+
      "   model(<y2) "+(low.fx*bs).toFixed(2)+" x "+(low.fz*bs).toFixed(2)+
      "   over "+ox.toFixed(2)+" / "+oz.toFixed(2)+flag);
    if(ox>0.15||oz>0.15){
      worst.push({t,age,ox,oz});
      for(const p of all.who.slice(0,2))
        console.log("        widest part: "+(p.reach*bs).toFixed(2)+"  "+p.name);
    }
  }
}
if(worst.length){
  console.log("\nOVER-BLOCKING, worst first:");
  worst.sort((a,b)=>Math.max(b.ox,b.oz)-Math.max(a.ox,a.oz));
  for(const w of worst)console.log("   "+w.t+" age "+w.age+"   "+w.ox.toFixed(2)+" x / "+w.oz.toFixed(2)+" z");
}else console.log("\nNo type over-blocks by more than 0.15.");
process.exit(0);
