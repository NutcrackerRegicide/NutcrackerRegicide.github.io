#!/usr/bin/env node
/* mapdrift.js — WHAT THE MAP ACTUALLY SAYS, against the numbers the AI was written with.
 *
 * The marshal's file carries a handful of literals that encode a map shape: the curtain's length,
 * the tower screen's z-span, the z the Kings Road is assumed to cross the wall line at, and the
 * box the patrol walks. The map has been reworked twice since most of them were written. This
 * prints, for each, the literal beside the number the live world hands back.
 *
 * Usage: [ROOT=/path/to/tree] node tools/mapdrift.js
 */
const fs=require("fs"),path=require("path");
const ROOT=process.env.ROOT?path.resolve(process.env.ROOT):path.join(__dirname,"..");
// PROBE_SEED seeds the world exactly the way smoketest.js and pathprobe.js do, and for the same
// reason: it must run BEFORE the bundle is evaluated, because 02-world.js captures Math.random at
// load time. A screen's coverage is a property of a MAP and an army, so quote several seeds.
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
bundle+="\n;global.__M={MAP,TCPOS,roadPoint,LANE_Z,LANE_EDGE,TC_RING,BAZAAR_SITES,CREEP_SITES,neutralMarkets,walkable,buildings,BLD,wallLineSegments,validFor,units,tick,setGameOver,getT:()=>T,NET,menuUp:()=>inMenu,clock,directors,manageBands,stock,nodes,BAZ_TOWERS,teamAge,directors,setAIDiff:v=>{aiDifficulty=v;},getAIDiff:()=>aiDifficulty,isWorker,CLS,bSpace,bSurf,makeBuilding,BAZ_TOWER_GAP,BAZ_TOWER_OUT,bazTowerSpot,bazTowerWant};";
try{(0,eval)(bundle);}catch(e){console.error("LOAD FAIL:",e.message);process.exit(1);}
const M=global.__M;
const {MAP,TCPOS,roadPoint,LANE_Z,LANE_EDGE}=M;
const fx=v=>(Math.round(v*100)/100).toFixed(2);

console.log("MAP half-extents  x "+MAP.x+"  z "+MAP.z+"   (a "+(MAP.x*2)+" x "+(MAP.z*2)+" field)");
console.log("TCPOS             blue "+TCPOS[0]+"   red "+TCPOS[1]);
console.log("LANE_Z            ["+LANE_Z.join(", ")+"]   LANE_EDGE "+LANE_EDGE);
console.log("");

// --- 1. WHERE THE KINGS ROAD CROSSES THE WALL LINE -------------------------------------------
// x is linear in t along roadPoint, so invert it and read z.
const r0=roadPoint(0), r1=roadPoint(1);
const tAt=(x)=>(x-r0.x)/(r1.x-r0.x);
console.log("1. THE GATE — `Math.abs(b.z-6)`, \"the road runs ~z 6 at the wall line\"");
console.log("   roadPoint(0) = ("+fx(r0.x)+", "+fx(r0.z)+")   roadPoint(1) = ("+fx(r1.x)+", "+fx(r1.z)+")");
for(const team of [0,1]){
  const tc=TCPOS[team], side=(team===0?1:-1);
  for(const front of [34,48,62,76]){
    const wx=tc[0]+side*front, t=tAt(wx);
    if(t<0||t>1){console.log("   team"+team+" front "+front+"  x "+fx(wx)+"  OFF THE ROAD (t "+fx(t)+")");continue;}
    const q=roadPoint(t);
    console.log("   team"+team+" front "+front+"  wall x "+fx(wx)+"  ->  road z "+fx(q.z)+
      "   (literal 6, error "+fx(q.z-6)+")");
  }
}
console.log("");

// --- 2. THE CURTAIN'S SPAN vs THE LANES ------------------------------------------------------
console.log("2. THE CURTAIN — `wallLineSegments(wt, front, tc[1]-48, front, tc[1]+48)`");
console.log("   spans z -48 .. +48 (96 long) on a map "+(MAP.z*2)+" deep.");
console.log("   lanes it covers: "+LANE_Z.filter(z=>Math.abs(z)<=48).join(", ")+
  "   lanes it MISSES: "+LANE_Z.filter(z=>Math.abs(z)>48).join(", "));
console.log("");

// --- 3. THE TOWER SCREEN ---------------------------------------------------------------------
console.log("3. THE TOWER SCREEN — `z=(Math.random()-0.5)*66`  ->  z -33 .. +33");
console.log("   lanes it covers: "+LANE_Z.filter(z=>Math.abs(z)<=33).join(", ")+
  "   lanes it MISSES: "+LANE_Z.filter(z=>Math.abs(z)>33).join(", "));
console.log("");

// --- 4. THE PATROL BOX -----------------------------------------------------------------------
console.log("4. THE PATROL BOX — offsets (15,11) (22,16) (4,-24) (26,-6) from the throne");
console.log("   furthest point "+fx(Math.max(...[[15,11],[22,16],[4,-24],[26,-6]].map(p=>Math.hypot(p[0],p[1]))))+
  " from the Town Center, against TC_RING "+M.TC_RING+" — the whole loop is INSIDE the farm ring.");
console.log("");

// --- 5. WHAT ELSE IS OUT THERE ---------------------------------------------------------------
console.log("5. THE THINGS WORTH WALKING TO");
for(const m of M.neutralMarkets||[])
  console.log("   bazaar "+(m.what||"?")+"  ("+fx(m.x)+", "+fx(m.z)+")   |z| "+fx(Math.abs(m.z)));


// --- 6. THE ONLY QUESTION THAT DECIDES 2 AND 3: WHERE DO THEY ACTUALLY COME THROUGH? ----------
// A screen is wrong if it does not stand where the enemy walks. Run a campaign and take a 1 Hz
// occupancy histogram of enemy SOLDIERS in an 8-wide slab at each defender's wall line.
const MIN=+(process.env.MAP_MIN||15);
// ⚠ tick() takes NO dt — it reads clock.getDelta(), which headless is REAL elapsed time, so an
// unpinned loop runs the world at about a twentieth of the speed it advertises. Same pin the
// smoketest and pathprobe use.
M.clock.getDelta=()=>1/30;
if(M.menuUp())M.NET.uiSolo();   // the war WAITS at the main menu (Trap #12)
const BUCK=20, NB=Math.ceil(MAP.z*2/BUCK);
const hist=[ new Array(NB).fill(0), new Array(NB).fill(0) ];
const raw=[[],[]];
// v134.10 the question John asked: how often does a square actually change hands, and can the
// stone pay for two-to-four towers on each one?
const _mk=M.neutralMarkets||[];
const _own=_mk.map(m=>m.owner);
const _lost=_mk.map(()=>[0,0]), _took=_mk.map(()=>[0,0]), _held=_mk.map(()=>[0,0]);
const _stoneIn=[0,0], _stonePrev=[M.stock[0].stone,M.stock[1].stone];
// v134.11 …AND WHEN EACH TEAM REACHES EACH AGE, because a Guard Tower is an AGE 3 building and
// nothing above measures whether a marshal ever gets there. Four seeded twenty-minute campaigns
// found one team of eight at age 3 and two still at age 0: the whole bazaar garrison, and the
// castle, and the stone wall, exist only in games that run long enough to unlock them.
const _ageAt=[{},{}], _agePrev=[M.teamAge[0]|0,M.teamAge[1]|0];
const bi=(z)=>Math.max(0,Math.min(NB-1,Math.floor((z+MAP.z)/BUCK)));
const FRONT=40;
let seen=[0,0];
const frames=Math.round(MIN*60*30);
for(let f=0;f<frames;f++){
  M.setGameOver(false); M.tick();
  if(f%30)continue;
  for(let i=0;i<_mk.length;i++){
    const now=_mk[i].owner, was=_own[i];
    if(now!==was){ if(was===0||was===1)_lost[i][was]++; if(now===0||now===1)_took[i][now]++; _own[i]=now; }
    if(now===0||now===1)_held[i][now]++;
  }
  for(const t of [0,1]){
    const s2=M.stock[t].stone; if(s2>_stonePrev[t])_stoneIn[t]+=s2-_stonePrev[t]; _stonePrev[t]=s2;
    const a2=M.teamAge[t]|0; if(a2>_agePrev[t]){for(let k=_agePrev[t]+1;k<=a2;k++)_ageAt[t][k]=M.getT();_agePrev[t]=a2;}
    const wallX=TCPOS[t][0]+(t===0?1:-1)*FRONT;
    for(const u of M.units){
      if(!u.alive||u.team===t||u.isKing||M.isWorker(u))continue;
      const p=u.root.position;
      if(Math.abs(p.x-wallX)>8)continue;
      hist[t][bi(p.z)]++; raw[t].push(p.z); seen[t]++;
    }
  }
}
console.log("   [debug] T="+M.getT().toFixed(0)+"  units="+M.units.filter(u=>u.alive).length+"  buildings="+M.buildings.filter(b=>b.alive).length+"  menu="+M.menuUp());
console.log("");
console.log("6. WHERE THE ENEMY ACTUALLY CROSSES ("+MIN+" min, "+(process.env.PROBE_SEED||"default seed")+
  ", tier "+M.getAIDiff()+") — enemy soldiers in an 8-wide slab at each wall line, 1 Hz");
for(const t of [0,1]){
  if(!seen[t]){console.log("   team"+t+": nothing ever crossed");continue;}
  const rows=[];
  for(let i=0;i<NB;i++)if(hist[t][i]){
    const lo=-MAP.z+i*BUCK, hi=lo+BUCK;
    rows.push({lo,hi,n:hist[t][i],pct:100*hist[t][i]/seen[t]});
  }
  console.log("   team"+t+" ("+seen[t]+" sightings at x "+fx(TCPOS[t][0]+(t===0?1:-1)*FRONT)+"):");
  for(const r of rows)
    console.log("      z "+String(r.lo).padStart(5)+" .. "+String(r.hi).padStart(5)+"  "+
      String(r.n).padStart(5)+"  "+r.pct.toFixed(1).padStart(5)+"%  "+"#".repeat(Math.round(r.pct/2)));
  // coverage of a candidate screen, measured on the RAW sightings rather than the buckets
  const cov=(f)=>{let n=0;for(const s2 of raw[t])if(f(s2))n++;return 100*n/seen[t];};
  const nearLane=(w)=>(z)=>LANE_Z.some(L=>Math.abs(z-L)<=w);
  console.log("      |z|<=33 (the shipped screen)      "+cov(z=>Math.abs(z)<=33).toFixed(1)+"%");
  console.log("      |z|<=48 (the curtain's span)      "+cov(z=>Math.abs(z)<=48).toFixed(1)+"%");
  console.log("      |z|<=106 (out to the far lanes)   "+cov(z=>Math.abs(z)<=106).toFixed(1)+"%");
  console.log("      within 15 of a LANE_Z            "+cov(nearLane(15)).toFixed(1)+"%");
  console.log("      within 20 of a LANE_Z            "+cov(nearLane(20)).toFixed(1)+"%");
  console.log("      within 25 of a LANE_Z            "+cov(nearLane(25)).toFixed(1)+"%");
  // …and the number that actually matters: was there a tower IN RANGE of the sighting? A screen is
  // only as wide as the towers standing in it, and a Guard Tower's reach is a fixed 18.
  const RNG=(M.BLD.tower.atk&&M.BLD.tower.atk.rng)||18;
  const mine=M.buildings.filter(b=>b.alive&&b.team===t&&(b.type==="tower"||b.type==="watch_tower"));
  const wallX2=TCPOS[t][0]+(t===0?1:-1)*FRONT;
  const inRange=cov(z=>mine.some(b=>Math.hypot(b.x-wallX2,b.z-z)<=RNG));
  console.log("      IN RANGE of a tower this marshal actually built ("+mine.length+" of them, reach "+
    RNG+"): "+inRange.toFixed(1)+"%");
  console.log("      ceiling if every LANE_Z carried one: "+cov(nearLane(RNG)).toFixed(1)+"%");
}
// --- 7. AND WHERE THE AI PUT ITS OWN SCREEN -----------------------------------------------------
console.log("");
console.log("7. WHAT THE MARSHALS ACTUALLY BUILT");
for(const t of [0,1]){
  const tw=M.buildings.filter(b=>b.alive&&b.team===t&&(b.type==="tower"||b.type==="watch_tower"));
  const wl=M.buildings.filter(b=>b.alive&&b.team===t&&b.def.wall);
  const zs=(a)=>a.length?("z "+fx(Math.min(...a.map(b=>b.z)))+" .. "+fx(Math.max(...a.map(b=>b.z)))):"none";
  const g=tw.filter(b=>b.type==="tower"), w2=tw.filter(b=>b.type==="watch_tower");
  console.log("   team"+t+": "+g.length+" guard towers ("+zs(g)+")   "+w2.length+" watch towers ("+zs(w2)+
    ")   "+wl.length+" wall segments ("+zs(wl)+")");
}

// --- 9. BAND HEALTH: how much of the army the marshal can actually see ------------------------
console.log("");
console.log("9. THE BAND ECONOMY AT THE WHISTLE");
for(const D of M.directors){
  const sol=M.units.filter(v=>v.alive&&v.team===D.team&&v.bot&&!v.isKing&&!v.remote&&
    !M.isWorker(v)&&M.CLS[v.cls].line!=="healer");
  const orph=sol.filter(v=>v.bandRef&&D.bands.includes(v.bandRef)&&v.bandRef.members.indexOf(v)<0);
  const inBand=sol.filter(v=>v.bandRef&&D.bands.includes(v.bandRef)&&v.bandRef.members.indexOf(v)>=0);
  const loose=sol.length-orph.length-inBand.length;
  const mission=D.bands.filter(b=>b.role!=="kingsguard").length;
  console.log("   team"+D.team+" ("+D.pers+"): "+sol.length+" bandable soldiers — "+inBand.length+
    " in a band, "+loose+" loose, "+orph.length+" ORPHANED · "+D.bands.length+" bands ("+mission+
    " mission): "+D.bands.map(b=>b.role+":"+b.members.length).join(", "));
}

// --- 10. THE SQUARES: TURNOVER, AND WHETHER THE STONE PAYS FOR TOWERS ON THEM ------------------
console.log("");
console.log("10. WHAT A SQUARE COSTS TO KEEP ("+MIN+" min)");
const TOWER_STONE=(M.BLD.tower.cost&&M.BLD.tower.cost.stone)||250;
for(let i=0;i<_mk.length;i++){
  const m=_mk[i];
  console.log("   "+(m.what||"?").padEnd(6)+" ("+fx(m.x)+","+fx(m.z)+")  lost by blue "+_lost[i][0]+
    " / red "+_lost[i][1]+"   took blue "+_took[i][0]+" / red "+_took[i][1]+
    "   held-seconds blue "+_held[i][0]+" / red "+_held[i][1]+"   owner now "+m.owner);
}
console.log("");
let piles=0, left=0;
for(const n of M.nodes)if(n.type==="stone"){piles++; left+=n.amount;}
for(const t of [0,1]){
  const towers=M.buildings.filter(b=>b.alive&&b.team===t&&b.type==="tower").length;
  const cas=M.buildings.filter(b=>b.alive&&b.team===t&&b.type==="castle").length;
  const wl=M.buildings.filter(b=>b.alive&&b.team===t&&b.def.wall).length;
  const baz=M.buildings.filter(b=>b.alive&&b.team===t&&b.type==="tower"&&
    (_mk||[]).some(m=>Math.hypot(b.x-m.x,b.z-m.z)<28)).length;
  const _ages=Object.keys(_ageAt[t]).map(k=>"age "+k+" at "+Math.round(_ageAt[t][k]/60)+"min").join(", ")||"never left age "+(M.teamAge[t]||0);
  console.log("      reached: "+_ages+"   (Guard Tower unlocks at age "+(M.BLD.tower.age||0)+")");
  console.log("   team"+t+" [age "+(M.teamAge[t]||0)+"]: mined "+Math.round(_stoneIn[t])+" stone, "+Math.round(M.stock[t].stone)+
    " in hand · "+towers+" Guard Towers ("+baz+" of them ringing a square) · "+cas+" castles · "+
    wl+" wall segments   [stone spent on towers "+(towers*TOWER_STONE)+"]");
  for(let i=0;i<_mk.length;i++){
    const m=_mk[i];
    const ring=M.buildings.filter(b=>b.alive&&b.team===t&&b.type==="tower"&&
      Math.hypot(b.x-m.x,b.z-m.z)<28);
    if(!ring.length&&m.owner!==t)continue;
    const bearings=ring.map(b=>Math.round(Math.atan2(b.z-m.z,b.x-m.x)*180/Math.PI));
    let worst=360;
    if(bearings.length>1){for(let j=0;j<bearings.length;j++)for(let k=j+1;k<bearings.length;k++){
      let g=Math.abs(bearings[j]-bearings[k]); if(g>180)g=360-g; if(g<worst)worst=g; }}
    console.log("      "+(m.what||"?").padEnd(6)+" owner "+m.owner+"  lost by this team "+
      ((m.lost&&m.lost[t])||0)+"  -> wants "+M.bazTowerWant(t,m)+
      ", has "+ring.length+(bearings.length>1?("  bearings ["+bearings.join(",")+"] closest pair "+worst+"deg"):""));
  }
}
console.log("   the map still holds "+Math.round(left)+" stone in "+piles+" piles"+
  "   ·  BAZ_TOWERS is currently "+M.BAZ_TOWERS);
