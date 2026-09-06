#!/usr/bin/env node
/* REGICIDE PVP — tools/ringfit.js — HOW MANY GUARD TOWERS DOES A BAZAAR RING ACTUALLY HOLD? (v134.11)
   ------------------------------------------------------------------------------------------
   node tools/ringfit.js [trials]

   John asked for two to FIVE. v134.10 measured four at ages 3-4 and two at age 5, so before the
   ceiling moves we need to know what the ring can physically take — and what, if anything, has to
   change for five to be reachable at every age the Guard Tower exists in.

   Three things are varied independently so their effects can be told apart:
     · the FOOTPRINT — the shipped table against the corrected one (tools/towerbox.js)
     · the SAMPLER   — the shipped uniform radius against one biased to the outer edge
     · the AGE       — 3, 4, 5

   Ground is CLEARED first. validFor reads buildings, nodes and townBoards; a bench that clears
   only one of them measures the leftovers of an earlier bench, which is the mistake five benches
   in this suite have now made.                                                                */
const fs=require('fs'),path=require('path');
const ROOT=path.join(__dirname,'..');
const TRIALS=Number(process.argv[2])||40;

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
bundle+="\n;global.__G={BLD,buildings,nodes,townBoards,neutralMarkets,teamAge,validFor,makeBuilding,"+
  "bazTowerSpot,bSpace,MAP,TCPOS,BAZ_TOWER_GAP,BAZ_TOWER_OUT,dist2};";
(0,eval)(bundle);
const G=global.__G;

const TEAM=0;
const clear=()=>{G.buildings.length=0; G.nodes.length=0; G.townBoards.length=0;};

// the shipped sampler's twin, with the radius rule as a parameter. `bias` 0 is uniform in the
// band (what ships); 1 puts every candidate on the outer edge, where the chords are longest.
let WANT=4, SLOTS=5;
// THE LATTICE. Slots are laid out for the MOST the square could ever earn, never for the number it
// wants today: two towers seated 180 apart can never grow into five, because each 180 arc then
// takes exactly one more. The radius is the one the tightest spacing needs at that slot count, at
// the LARGEST the building ever gets — a ring laid at the Classical footprint stops accepting
// towers the moment the town reaches Enlightenment.
function spot(m,bias){
  const tc=G.TCPOS[TEAM], plaza=(m.plaza||8.6);
  const inner=plaza+G.BAZ_TOWER_GAP;
  const outer=Math.max(inner+1,Math.min(inner+G.BAZ_TOWER_OUT,(G.BLD.tower.atk.rng||18)-1.5));
  let wMax=0;
  for(let a=(G.BLD.tower.age||0);a<=5;a++)
    wMax=Math.max(wMax,2*Math.max(G.BLD.tower.fxA[a],G.BLD.tower.fzA[a]));
  const need=wMax+Math.max(2.2,Math.min(6.0,0.75*wMax));
  const rLat=Math.max(inner,Math.min(outer,need/(2*Math.sin(Math.PI/SLOTS))));
  const step=Math.PI*2/SLOTS;
  const held=[],pts=[];
  for(const b of G.buildings)
    if(b.alive&&b.team===TEAM&&b.type==="tower"&&G.dist2(b.x,b.z,m.x,m.z)<Math.pow(outer+3,2)){
      held.push(Math.atan2(b.z-m.z,b.x-m.x)); pts.push(b);
    }
  // the pattern is anchored on the first tower that stood, so it never shifts under itself
  const anchor=held.length?held[0]:Math.atan2(tc[1]-m.z,tc[0]-m.x);
  // how much a candidate may wander and still leave its neighbours room
  const slack=Math.max(0,step-2*Math.asin(Math.min(1,need/(2*rLat))));
  // ⚠ THE JITTER ONLY EVER GOES OUTWARD. rLat is the radius at which the slot count EXACTLY fits;
  // a candidate half a unit inside it has a shorter chord than the spacing needs and validFor
  // refuses the last tower. Measured: +-0.085 of radius wobble cost the fifth tower at age 5.
  const jit=slack*0.8, rj=Math.max(0,outer-rLat);
  let best=null,bs=-1e12,near=null,nd=1e12;
  for(let i=0;i<36;i++){
    const a=anchor+(i%SLOTS)*step+(Math.random()-0.5)*jit;
    const r=Math.max(inner,Math.min(outer,rLat+Math.random()*rj));
    const x=m.x+Math.cos(a)*r, z=m.z+Math.sin(a)*r;
    if(Math.abs(x)>G.MAP.x-6||Math.abs(z)>G.MAP.z-6)continue;
    if(!G.validFor("tower",x,z,TEAM))continue;
    const d=G.dist2(x,z,tc[0],tc[1]);
    if(d<nd){nd=d;near={x,z};}
    let sep=Math.PI;
    for(const t of held){const g=Math.abs(((a-t+Math.PI*3)%(Math.PI*2))-Math.PI); if(g<sep)sep=g;}
    const score=sep-Math.sqrt(d)*0.0008;
    if(score>bs){bs=score;best={x,z};}
  }
  return best||near;
}
function fits(m,age,bias,useShipped,want){
  G.teamAge[TEAM]=age; G.teamAge[1]=age;
  WANT=want||4;
  clear();
  let n=0;
  for(let k=0;k<(want||8);k++){
    const s=useShipped?G.bazTowerSpot(TEAM,m):spot(m,bias);
    if(!s)break;
    const b=G.makeBuilding(TEAM,"tower",s.x,s.z,true); if(!b)break;
    b.bazTower=true; n++;
  }
  clear();
  return n;
}

const SHIPPED={fx:G.BLD.tower.fxA.slice(),fz:G.BLD.tower.fzA.slice()};
// tools/towerbox.js, every vertex: the Enlightenment bastion is a pentagon of circumradius 6.6
// turned PI/5, so it stands 6.28 x 6.60 — not the 8.96 x 9.03 the table records, which is that
// pentagon's AXIS-ALIGNED BOX pushed through the same rotation.
const FIXED  ={fx:SHIPPED.fx.slice(),fz:SHIPPED.fz.slice()};
FIXED.fx[5]=6.28; FIXED.fz[5]=6.60;
const setBox=(T)=>{G.BLD.tower.fxA=T.fx.slice(); G.BLD.tower.fzA=T.fz.slice();};

const squares=[{name:"viking (plaza 8.6)",m:{x:0,z:0,plaza:8.6}},
               {name:"grand  (plaza 11.4)",m:{x:0,z:0,plaza:11.4}}];
console.log("Guard towers seated on one bazaar ring — best of "+TRIALS+" trials, and the mean.\n");
console.log("                                        age 3        age 4        age 5");
for(const S of squares){
  console.log("-- "+S.name);
  for(const V of [{n:"shipped box, shipped sampler",T:SHIPPED,bias:0,ship:true},
                  {n:"CORRECTED box, shipped sampler",T:FIXED,bias:0,ship:true},
                  {n:"CORRECTED box, rim-biased",T:FIXED,bias:1,ship:false},
                  {n:"CORRECTED box, LATTICE (fill 5)",T:FIXED,bias:2,ship:false,want:5},
                  {n:"CORRECTED box, LATTICE (fill 2 then 5)",T:FIXED,bias:3,ship:false,want:5}]){
    setBox(V.T);
    const cells=[];
    for(const age of [3,4,5]){
      let best=0,sum=0;
      for(let t=0;t<TRIALS;t++){const n=fits(S.m,age,V.bias,V.ship,V.want); if(n>best)best=n; sum+=n;}
      const sp=2*G.bSpace(G.BLD.tower,TEAM)+6.0;
      cells.push((best+"  (mean "+(sum/TRIALS).toFixed(1)+")").padEnd(13));
    }
    console.log("   "+V.n.padEnd(34)+cells.join(""));
  }
  // and what the geometry says is possible at all, at the rim
  const plaza=S.m.plaza, inner=plaza+G.BAZ_TOWER_GAP;
  const outer=Math.max(inner+1,Math.min(inner+G.BAZ_TOWER_OUT,(G.BLD.tower.atk.rng||18)-1.5));
  const line=[];
  for(const age of [3,4,5]){
    G.teamAge[TEAM]=age; setBox(FIXED);
    const D=2*G.bSpace(G.BLD.tower,TEAM)+6.0;
    let cap=0; for(let n=3;n<=9;n++)if(2*outer*Math.sin(Math.PI/n)>=D)cap=n;
    line.push(("<="+cap+" at r"+outer.toFixed(1)+", need "+D.toFixed(1)).padEnd(13));
  }
  console.log("   "+"ceiling on the rim (corrected)".padEnd(34)+line.join(""));
}
setBox(SHIPPED);
process.exit(0);
